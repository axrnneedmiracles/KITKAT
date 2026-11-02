package com.shecurity.app.data.models

import com.google.gson.Gson

data class EmergencyPacket(
    val userId: String = "27",
    val userName: String = "Aditi Sharma",
    val userPhone: String = "+91 98765 43210",
    val emergencyNotes: String = "",
    val latitude: Double,
    val longitude: Double,
    val riskScore: Int,
    val heartRate: Int,
    val battery: Int,
    val movement: MovementType,
    val isSos: Boolean = true,
    val reason: String = "Automated Anomaly Threshold Exceeded",
    val timestamp: Long = System.currentTimeMillis()
) {
    /**
     * Compact pipe-delimited format (< 50 bytes) for 433 MHz LoRa transmission.
     * Example: SHE|UID27|LT28.6139|LN77.2090|R94|HR142|BAT82|M_RUN|T1718002938
     */
    fun toCompactLoRaString(): String {
        val moveCode = when (movement) {
            MovementType.RUNNING -> "RUN"
            MovementType.WALKING -> "WALK"
            MovementType.SUDDEN_MOVEMENT_OR_FALL -> "FALL"
            MovementType.STATIONARY -> "STAT"
        }
        val latShort = String.format("%.4f", latitude)
        val lonShort = String.format("%.4f", longitude)
        val sosTag = if (isSos) "|SOS" else "|SAFE"
        val cleanName = userName.replace("|", "").replace(" ", "_")
        val cleanPhone = userPhone.replace("|", "").replace(" ", "")
        return "SHE|NM:$cleanName|PH:$cleanPhone|LT$latShort|LN$lonShort|R$riskScore|HR$heartRate|BAT$battery|M_$moveCode$sosTag"
    }

    /**
     * Standard JSON for HTTP REST & WebSocket transport
     */
    fun toJson(): String {
        return Gson().toJson(this)
    }

    companion object {
        fun fromCompactString(raw: String): EmergencyPacket? {
            return try {
                val parts = raw.trim().split("|")
                var uid = "27"
                var lat = 0.0
                var lon = 0.0
                var r = 0
                var hr = 72
                var bat = 80
                var mov = MovementType.STATIONARY
                var ts = System.currentTimeMillis()

                for (p in parts) {
                    when {
                        p.startsWith("UID") -> uid = p.removePrefix("UID")
                        p.startsWith("LT") -> lat = p.removePrefix("LT").toDouble()
                        p.startsWith("LN") -> lon = p.removePrefix("LN").toDouble()
                        p.startsWith("R") -> r = p.removePrefix("R").toInt()
                        p.startsWith("HR") -> hr = p.removePrefix("HR").toInt()
                        p.startsWith("BAT") -> bat = p.removePrefix("BAT").toInt()
                        p.startsWith("M_") -> {
                            val code = p.removePrefix("M_")
                            mov = when (code) {
                                "RUN" -> MovementType.RUNNING
                                "WALK" -> MovementType.WALKING
                                "FALL" -> MovementType.SUDDEN_MOVEMENT_OR_FALL
                                else -> MovementType.STATIONARY
                            }
                        }
                        p.startsWith("T") -> ts = p.removePrefix("T").toLong() * 1000
                    }
                }

                EmergencyPacket(
                    userId = uid,
                    latitude = lat,
                    longitude = lon,
                    riskScore = r,
                    heartRate = hr,
                    battery = bat,
                    movement = mov,
                    timestamp = ts
                )
            } catch (e: Exception) {
                null
            }
        }
    }
}
