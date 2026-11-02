package com.shecurity.app.communication

import android.content.Context
import android.os.Build
import android.util.Log
import com.google.gson.Gson
import com.shecurity.app.data.models.EmergencyPacket
import kotlinx.coroutines.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import java.util.concurrent.TimeUnit

class InternetTransport(
    var serverHost: String = "192.168.1.11:3000" // Local Wi-Fi Laptop IP
) : Transport {

    override val name: String = "INTERNET"

    // Dedicated WebSocket client: ping every 10s to stay permanently alive, no read timeout
    private val wsClient = OkHttpClient.Builder()
        .connectTimeout(5, TimeUnit.SECONDS)
        .readTimeout(0, TimeUnit.MILLISECONDS) // No read timeout for persistent WebSocket
        .pingInterval(10, TimeUnit.SECONDS)   // Active RFC ping/pong keepalive
        .retryOnConnectionFailure(true)
        .build()

    // Fast HTTP REST client for health checks & telemetry fallbacks
    private val httpClient = OkHttpClient.Builder()
        .connectTimeout(2, TimeUnit.SECONDS)
        .readTimeout(3, TimeUnit.SECONDS)
        .writeTimeout(3, TimeUnit.SECONDS)
        .build()

    private val jsonMediaType = "application/json; charset=utf-8".toMediaType()
    private val gson = Gson()

    private var webSocket: WebSocket? = null
    var isConnected: Boolean = false
        private set

    private var isSimulatedFailure: Boolean = false
    private var reconnectJob: Job? = null

    // Callbacks for live sync
    var onSafetyCheckTriggered: (() -> Unit)? = null
    var onConnectionStateChanged: ((Boolean) -> Unit)? = null
    var onConnectedProfileSync: (() -> Unit)? = null

    var isSecure: Boolean = false
        private set

    val httpBaseUrl: String
        get() = if (isSecure) "https://$serverHost" else "http://$serverHost"

    val wsUrl: String
        get() = if (isSecure) "wss://$serverHost" else "ws://$serverHost"

    fun setServerAddress(host: String) {
        val trimmed = host.trim().removeSuffix("/")
        if (trimmed.isEmpty()) return

        // Auto-detect secure tunnel or cloud domain (Cloudflare trycloudflare, ngrok, localtunnel, etc.)
        val detectedSecure = trimmed.startsWith("https://", ignoreCase = true) ||
                             trimmed.startsWith("wss://", ignoreCase = true) ||
                             trimmed.contains(".trycloudflare.com", ignoreCase = true) ||
                             trimmed.contains(".ngrok", ignoreCase = true) ||
                             trimmed.contains(".loca.lt", ignoreCase = true) ||
                             trimmed.contains(".pinggy.link", ignoreCase = true) ||
                             (trimmed.contains(".") && !trimmed.matches(Regex("^[0-9.:]+$")))

        val cleanHost = trimmed
            .removePrefix("http://")
            .removePrefix("https://")
            .removePrefix("ws://")
            .removePrefix("wss://")
            .removeSuffix("/")

        this.isSecure = detectedSecure
        this.serverHost = cleanHost
        Log.d("InternetTransport", "🎯 Server address set to: $cleanHost | isSecure=$isSecure | wsUrl=$wsUrl | httpUrl=$httpBaseUrl")
        connectWebSocket()
    }

    @Synchronized
    fun connectWebSocket() {
        if (isSimulatedFailure) return

        try {
            webSocket?.close(1000, "Reconnecting with updated address")
        } catch (e: Exception) {}

        try {
            val request = Request.Builder().url(wsUrl).build()

            webSocket = wsClient.newWebSocket(request, object : WebSocketListener() {
                override fun onOpen(ws: WebSocket, response: Response) {
                    isConnected = true
                    reconnectJob?.cancel()
                    Log.d("InternetTransport", "✅ WebSocket connected to $wsUrl")
                    onConnectionStateChanged?.invoke(true)

                    // Announce device connection
                    val handshake = mapOf(
                        "type" to "DEVICE_REGISTER",
                        "device" to "Android Phone",
                        "model" to "${Build.MANUFACTURER} ${Build.MODEL}",
                        "sdk" to Build.VERSION.SDK_INT
                    )
                    ws.send(gson.toJson(handshake))

                    // Sync user profile immediately on connection
                    onConnectedProfileSync?.invoke()
                }

                override fun onMessage(ws: WebSocket, text: String) {
                    try {
                        val map = gson.fromJson(text, Map::class.java)
                        val type = map["type"] as? String
                        if (type == "SAFETY_CHECK_REQUESTED") {
                            Log.d("InternetTransport", "🔔 Remote Safety Check Challenge received from Website!")
                            onSafetyCheckTriggered?.invoke()
                        }
                    } catch (e: Exception) {
                        Log.e("InternetTransport", "WebSocket parse error: ${e.message}")
                    }
                }

                override fun onClosing(ws: WebSocket, code: Int, reason: String) {
                    isConnected = false
                    onConnectionStateChanged?.invoke(false)
                    scheduleReconnect()
                }

                override fun onFailure(ws: WebSocket, t: Throwable, response: Response?) {
                    isConnected = false
                    Log.w("InternetTransport", "WebSocket disconnected: ${t.message}")
                    onConnectionStateChanged?.invoke(false)
                    scheduleReconnect()
                }
            })
        } catch (e: Exception) {
            isConnected = false
            onConnectionStateChanged?.invoke(false)
            scheduleReconnect()
        }
    }

    private fun scheduleReconnect() {
        if (isSimulatedFailure) return
        reconnectJob?.cancel()
        reconnectJob = CoroutineScope(Dispatchers.IO).launch {
            delay(3000)
            if (!isConnected && !isSimulatedFailure) {
                Log.d("InternetTransport", "🔄 Auto-reconnecting WebSocket to $wsUrl...")
                connectWebSocket()
            }
        }
    }

    override fun isAvailable(): Boolean = isConnected || !isSimulatedFailure

    fun setSimulatedNetworkFailure(failed: Boolean) {
        isSimulatedFailure = failed
        isConnected = !failed
        if (failed) {
            reconnectJob?.cancel()
            try {
                webSocket?.close(1000, "Simulated network failure")
            } catch (e: Exception) {}
        } else {
            connectWebSocket()
        }
        onConnectionStateChanged?.invoke(isConnected)
    }

    override suspend fun checkHealth(): Boolean = withContext(Dispatchers.IO) {
        if (isSimulatedFailure) return@withContext false
        if (isConnected) return@withContext true

        // If WebSocket is not connected, check if laptop HTTP server is reachable
        try {
            val req = Request.Builder()
                .url("$httpBaseUrl/api/status")
                .get()
                .build()

            val res = httpClient.newCall(req).execute()
            val ok = res.isSuccessful
            res.close()
            if (ok) {
                // HTTP is reachable! Reconnect WebSocket in background
                connectWebSocket()
                return@withContext true
            }
        } catch (e: Exception) {}

        false
    }

    /**
     * Fast Subnet Auto-Discovery:
     * Concurrently probes 192.168.1.100..105, 10.0.2.2, and 192.168.1.1..20 to discover laptop IP!
     */
    suspend fun autoDiscoverServer(onFound: ((String) -> Unit)? = null): String? = withContext(Dispatchers.IO) {
        // Skip scanning local Wi-Fi subnet if a secure cloud tunnel is active
        if (isSecure) {
            Log.d("InternetTransport", "Skipping local subnet scan; cloud tunnel is active: $serverHost")
            return@withContext serverHost
        }

        val candidates = linkedSetOf<String>()
        candidates.add("192.168.1.11")
        if (serverHost.isNotEmpty()) candidates.add(serverHost.substringBefore(":"))
        candidates.add("192.168.1.100")
        candidates.add("192.168.1.101")
        candidates.add("192.168.1.102")
        candidates.add("192.168.1.103")
        candidates.add("192.168.1.104")
        candidates.add("192.168.1.105")
        candidates.add("10.0.2.2")
        for (i in 1..25) {
            candidates.add("192.168.1.$i")
        }

        val probeClient = OkHttpClient.Builder()
            .connectTimeout(400, TimeUnit.MILLISECONDS)
            .readTimeout(400, TimeUnit.MILLISECONDS)
            .build()

        val deferredList = candidates.map { ip ->
            async {
                val url = "http://$ip:3000/api/status"
                try {
                    val req = Request.Builder().url(url).get().build()
                    val resp = probeClient.newCall(req).execute()
                    val body = resp.body?.string() ?: ""
                    resp.close()
                    if (resp.isSuccessful && (body.contains("SHEcurity") || body.contains("ONLINE") || body.contains("success"))) {
                        return@async "$ip:3000"
                    }
                } catch (ignored: Exception) {}
                null
            }
        }

        for (d in deferredList) {
            val found = d.await()
            if (found != null) {
                Log.d("InternetTransport", "🎯 Auto-discovered SHEcurity laptop server at $found")
                setServerAddress(found)
                onFound?.invoke(found)
                return@withContext found
            }
        }

        null
    }

    override suspend fun sendEmergencyData(packet: EmergencyPacket): TransportResult = withContext(Dispatchers.IO) {
        // First try fast real-time WebSocket if connected
        val wsPayload = mapOf(
            "type" to if (packet.isSos) "EMERGENCY_ALERT" else "TELEMETRY",
            "data" to mapOf(
                "userId" to packet.userId,
                "userName" to packet.userName,
                "userPhone" to packet.userPhone,
                "emergencyNotes" to packet.emergencyNotes,
                "latitude" to packet.latitude,
                "longitude" to packet.longitude,
                "riskScore" to packet.riskScore,
                "heartRate" to packet.heartRate,
                "battery" to packet.battery,
                "movement" to packet.movement.name,
                "isSos" to packet.isSos,
                "reason" to packet.reason
            )
        )

        if (isConnected && webSocket?.send(gson.toJson(wsPayload)) == true) {
            return@withContext TransportResult(
                success = true,
                transportName = name,
                ackReceived = true,
                message = "Live Telemetry Streamed via WebSocket"
            )
        }

        // Fallback to HTTP POST if WebSocket frame failed or not yet open
        try {
            val endpoint = if (packet.isSos) "$httpBaseUrl/api/sos" else "$httpBaseUrl/api/telemetry"
            val req = Request.Builder()
                .url(endpoint)
                .post(packet.toJson().toRequestBody(jsonMediaType))
                .build()

            val response = httpClient.newCall(req).execute()
            val isSuccess = response.isSuccessful
            response.close()

            if (isSuccess && !isConnected) {
                connectWebSocket()
            }

            TransportResult(
                success = isSuccess,
                transportName = name,
                ackReceived = isSuccess,
                message = if (isSuccess) "Server ACK via HTTP" else "HTTP ${response.code}"
            )
        } catch (e: Exception) {
            isConnected = false
            TransportResult(
                success = false,
                transportName = name,
                ackReceived = false,
                message = "Internet failed: ${e.message}"
            )
        }
    }

    /**
     * Send biometric / PIN resolution back to website server
     */
    fun sendCheckResolution(result: String) {
        val payload = mapOf(
            "type" to "RESOLVE_CHECK",
            "result" to result // "SAFE" or "DURESS"
        )
        if (isConnected && webSocket?.send(gson.toJson(payload)) == true) {
            return
        }
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val req = Request.Builder()
                    .url("$httpBaseUrl/api/resolve-check")
                    .post(gson.toJson(payload).toRequestBody(jsonMediaType))
                    .build()
                httpClient.newCall(req).execute().close()
            } catch (e: Exception) {}
        }
    }

    /**
     * Clear emergency lock on laptop monitoring center
     */
    fun sendResolveSos() {
        val payload = mapOf("type" to "RESOLVE_SOS")
        if (isConnected && webSocket?.send(gson.toJson(payload)) == true) {
            return
        }
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val req = Request.Builder()
                    .url("$httpBaseUrl/api/resolve-sos")
                    .post("{}".toRequestBody(jsonMediaType))
                    .build()
                httpClient.newCall(req).execute().close()
            } catch (e: Exception) {}
        }
    }

    /**
     * Real-time profile & safe locations sync with laptop dashboard
     */
    fun syncProfile(
        userName: String,
        userPhone: String,
        emergencyNotes: String,
        safeLocations: List<com.shecurity.app.data.models.SafeLocation>
    ) {
        val payload = mapOf(
            "userName" to userName,
            "userPhone" to userPhone,
            "emergencyNotes" to emergencyNotes,
            "safeLocations" to safeLocations.map { loc ->
                mapOf(
                    "id" to loc.id,
                    "name" to loc.name,
                    "lat" to loc.center.latitude,
                    "lon" to loc.center.longitude,
                    "radiusMeters" to loc.radiusMeters
                )
            }
        )

        val json = gson.toJson(payload)

        // 1. Instant WebSocket Frame
        if (isConnected) {
            val wsMsg = mapOf(
                "type" to "PROFILE_UPDATE",
                "data" to payload
            )
            webSocket?.send(gson.toJson(wsMsg))
        }

        // 2. HTTP POST REST (/api/profile)
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val req = Request.Builder()
                    .url("$httpBaseUrl/api/profile")
                    .post(json.toRequestBody(jsonMediaType))
                    .build()
                val resp = httpClient.newCall(req).execute()
                Log.d("InternetTransport", "✅ Profile HTTP sync status: ${resp.code}")
                resp.close()
            } catch (e: Exception) {
                Log.w("InternetTransport", "Profile HTTP sync error: ${e.message}")
            }
        }
    }
}
