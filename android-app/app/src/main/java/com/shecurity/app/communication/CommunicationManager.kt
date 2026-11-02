package com.shecurity.app.communication

import com.shecurity.app.data.models.EmergencyPacket
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.launch

class CommunicationManager(
    val internetTransport: InternetTransport = InternetTransport(),
    val loraTransport: LoRaBluetoothTransport = LoRaBluetoothTransport()
) {
    var activeTransportName: String = "DUAL (WI-FI + LORA)"
        private set

    var onTransportChanged: ((String) -> Unit)? = null
    var onAckReceived: ((String) -> Unit)? = null

    init {
        // Pre-warm Bluetooth link in the background for instant LoRa failover
        CoroutineScope(Dispatchers.IO).launch {
            loraTransport.connectToBridge()
        }
    }

    var isSimulatedNetworkFailure: Boolean = false
        private set

    /**
     * Automatic Network-to-LoRa Failover Dispatcher:
     * - Primary: Streams over Wi-Fi / Internet when network connection is online.
     * - Failover: Automatically switches to 433 MHz LoRa Radio whenever Wi-Fi / network is lost.
     * - SOS: In critical emergencies, broadcasts over both if available.
     */
    suspend fun sendEmergencyData(packet: EmergencyPacket): TransportResult = kotlinx.coroutines.withContext(Dispatchers.IO) {
        val loraDeferred = async {
            if (loraTransport.isConnected() || loraTransport.isAvailable()) {
                try {
                    loraTransport.sendEmergencyData(packet)
                } catch (e: Exception) {
                    null
                }
            } else null
        }

        val internetDeferred = async {
            if (!isSimulatedNetworkFailure) {
                try {
                    internetTransport.sendEmergencyData(packet)
                } catch (e: Exception) {
                    null
                }
            } else null
        }

        val loraResult = loraDeferred.await()
        val internetResult = internetDeferred.await()

        // 3. Determine active transport name and notify UI
        if (loraResult?.success == true && internetResult?.success == true) {
            activeTransportName = "DUAL SYNC (WI-FI + LORA)"
            onTransportChanged?.invoke(activeTransportName)
            onAckReceived?.invoke("Confirmed via Dual LoRa + Wi-Fi")
            return@withContext internetResult
        } else if (loraResult?.success == true) {
            activeTransportName = "LORA RADIO FALLBACK"
            onTransportChanged?.invoke(activeTransportName)
            if (loraResult.ackReceived) {
                onAckReceived?.invoke("ACK confirmed via LoRa Base Station")
            }
            return@withContext loraResult
        } else if (internetResult?.success == true) {
            activeTransportName = "WI-FI / INTERNET"
            onTransportChanged?.invoke(activeTransportName)
            if (internetResult.ackReceived) {
                onAckReceived?.invoke("ACK confirmed via Server Wi-Fi")
            }
            return@withContext internetResult
        } else {
            activeTransportName = "OFFLINE STANDBY"
            onTransportChanged?.invoke(activeTransportName)
            return@withContext loraResult ?: internetResult ?: TransportResult(false, "NONE", false, "All transports offline")
        }
    }

    /**
     * Periodic connectivity heartbeat check
     */
    suspend fun checkConnections(): Pair<Boolean, Boolean> {
        val internetOk = internetTransport.checkHealth()
        val loraOk = loraTransport.checkHealth()
        return Pair(internetOk, loraOk)
    }

    fun simulateNetworkFailure(failed: Boolean) {
        internetTransport.setSimulatedNetworkFailure(failed)
        activeTransportName = if (failed) "LORA RADIO FALLBACK" else "DUAL (WI-FI + LORA)"
        onTransportChanged?.invoke(activeTransportName)
    }
}
