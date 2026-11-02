package com.shecurity.app.communication

import android.annotation.SuppressLint
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothSocket
import android.util.Log
import com.shecurity.app.data.models.EmergencyPacket
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.withContext
import java.io.InputStream
import java.io.OutputStream
import java.util.UUID

class LoRaBluetoothTransport : Transport {

    companion object {
        private const val TAG = "LoRaBtTransport"
        private val SPP_UUID: UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB")
    }

    override val name: String = "LORA_BLUETOOTH"

    var targetDevice: BluetoothDevice? = null
        private set

    private var socket: BluetoothSocket? = null
    private var outputStream: OutputStream? = null
    private var inputStream: InputStream? = null
    private var isSimulatedMode = false

    fun enableSimulatedHardware(enabled: Boolean) {
        isSimulatedMode = enabled
    }

    fun setTargetDevice(device: BluetoothDevice?) {
        this.targetDevice = device
    }

    override fun isAvailable(): Boolean {
        if (isSimulatedMode) return true
        val adapter = BluetoothAdapter.getDefaultAdapter() ?: return false
        return adapter.isEnabled
    }

    fun isConnected(): Boolean {
        return socket?.isConnected == true
    }

    @SuppressLint("MissingPermission")
    fun getConnectedDeviceName(): String? {
        return if (isConnected()) (targetDevice?.name ?: "SHECURITY_LORA_BRIDGE") else null
    }

    fun disconnect() {
        try {
            outputStream?.close()
            inputStream?.close()
            socket?.close()
        } catch (e: Exception) {
            Log.w(TAG, "Disconnect error: ${e.message}")
        } finally {
            socket = null
            outputStream = null
            inputStream = null
        }
    }

    @SuppressLint("MissingPermission")
    suspend fun connectToBridge(specificDevice: BluetoothDevice? = null): Boolean = withContext(Dispatchers.IO) {
        if (isSimulatedMode) return@withContext true

        val adapter = BluetoothAdapter.getDefaultAdapter() ?: return@withContext false
        if (!adapter.isEnabled) return@withContext false

        val deviceToConnect = specificDevice ?: targetDevice ?: run {
            val pairedDevices: Set<BluetoothDevice>? = adapter.bondedDevices
            pairedDevices?.find { dev ->
                val n = dev.name ?: ""
                n.contains("SHECURITY", ignoreCase = true) ||
                n.contains("ESP32", ignoreCase = true) ||
                n.contains("LORA", ignoreCase = true) ||
                n.contains("BRIDGE", ignoreCase = true)
            }
        }

        if (deviceToConnect == null) {
            Log.w(TAG, "No paired ESP32 device found. Pair 'SHECURITY_LORA_BRIDGE' in Android Bluetooth settings.")
            return@withContext false
        }

        disconnect()
        targetDevice = deviceToConnect

        var connectedSocket: BluetoothSocket? = null
        try {
            adapter.cancelDiscovery()
            Log.d(TAG, "Attempting Insecure SPP connection to ${deviceToConnect.name} (${deviceToConnect.address})...")
            // Try insecure RFCOMM socket (standard for ESP32 Bluedroid SPP)
            val s = deviceToConnect.createInsecureRfcommSocketToServiceRecord(SPP_UUID)
            s.connect()
            connectedSocket = s
        } catch (e1: Exception) {
            Log.w(TAG, "Insecure SPP by UUID failed (${e1.message}), trying channel 1 reflection...")
            try {
                val m = deviceToConnect.javaClass.getMethod("createInsecureRfcommSocket", Int::class.javaPrimitiveType)
                val s = m.invoke(deviceToConnect, 1) as BluetoothSocket
                s.connect()
                connectedSocket = s
            } catch (e2: Exception) {
                Log.w(TAG, "Insecure channel 1 failed (${e2.message}), trying standard secure SPP...")
                try {
                    val s = deviceToConnect.createRfcommSocketToServiceRecord(SPP_UUID)
                    s.connect()
                    connectedSocket = s
                } catch (e3: Exception) {
                    Log.e(TAG, "All Bluetooth connection attempts failed: ${e3.message}")
                    connectedSocket = null
                }
            }
        }

        if (connectedSocket != null && connectedSocket.isConnected) {
            socket = connectedSocket
            outputStream = connectedSocket.outputStream
            inputStream = connectedSocket.inputStream
            Log.i(TAG, "✅ Connected to ESP32 LoRa Bridge: ${deviceToConnect.name}")
            true
        } else {
            Log.w(TAG, "❌ Failed to connect to ESP32 LoRa Bridge.")
            false
        }
    }

    override suspend fun checkHealth(): Boolean = withContext(Dispatchers.IO) {
        if (isSimulatedMode) return@withContext true
        socket?.isConnected == true
    }

    override suspend fun sendEmergencyData(packet: EmergencyPacket): TransportResult = withContext(Dispatchers.IO) {
        val compactString = packet.toCompactLoRaString() + "\n"

        if (isSimulatedMode) {
            delay(200)
            return@withContext TransportResult(
                success = true,
                transportName = name,
                ackReceived = true,
                message = "Simulated LoRa 433MHz: $compactString"
            )
        }

        // Auto-reconnect if socket was dropped
        if (socket == null || socket?.isConnected == false) {
            val ok = connectToBridge()
            if (!ok) {
                return@withContext TransportResult(
                    success = false,
                    transportName = name,
                    ackReceived = false,
                    message = "LoRa ESP32 Bluetooth disconnected (Pair SHECURITY_LORA_BRIDGE)"
                )
            }
        }

        val out = outputStream
        if (out == null || socket?.isConnected != true) {
            return@withContext TransportResult(
                success = false,
                transportName = name,
                ackReceived = false,
                message = "LoRa Bluetooth socket unavailable"
            )
        }

        try {
            val bytes = compactString.toByteArray(Charsets.UTF_8)
            out.write(bytes)
            out.flush()
            Log.d(TAG, "📡 [LoRa BT Tx to ESP32]: ${compactString.trim()}")

            // Non-blocking wait for ACK from ESP32 receiver (up to 3500ms for SF12 long-range)
            var ack = false
            var ackResponse = ""
            val inStream = inputStream

            if (inStream != null) {
                val start = System.currentTimeMillis()
                while (System.currentTimeMillis() - start < 3500) {
                    if (inStream.available() > 0) {
                        val buffer = ByteArray(128)
                        val bytesRead = inStream.read(buffer)
                        if (bytesRead > 0) {
                            ackResponse = String(buffer, 0, bytesRead).trim()
                            Log.d(TAG, "📻 [LoRa BT Rx from ESP32]: $ackResponse")
                            if (ackResponse.contains("ACK")) {
                                ack = true
                                break
                            }
                        }
                    }
                    delay(50)
                }
            }

            TransportResult(
                success = true,
                transportName = name,
                ackReceived = ack,
                message = if (ack) "LoRa ACK verified: $ackResponse" else "Packet transmitted over 433MHz LoRa"
            )
        } catch (e: Exception) {
            Log.e(TAG, "LoRa Bluetooth transmission error: ${e.message}")
            disconnect()
            TransportResult(
                success = false,
                transportName = name,
                ackReceived = false,
                message = "Bluetooth LoRa error: ${e.message}"
            )
        }
    }
}
