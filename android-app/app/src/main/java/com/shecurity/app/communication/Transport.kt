package com.shecurity.app.communication

import com.shecurity.app.data.models.EmergencyPacket

interface Transport {
    val name: String
    fun isAvailable(): Boolean
    suspend fun sendEmergencyData(packet: EmergencyPacket): TransportResult
    suspend fun checkHealth(): Boolean
}

data class TransportResult(
    val success: Boolean,
    val transportName: String,
    val ackReceived: Boolean,
    val message: String
)
