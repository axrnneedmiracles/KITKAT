package com.shecurity.app.risk

import com.shecurity.app.data.models.GeoPoint
import com.shecurity.app.data.models.SafeLocation
import kotlin.math.*

class LocationAnalyzer {

    fun checkSafeLocations(
        userLocation: GeoPoint,
        safeLocations: List<SafeLocation>
    ): Pair<Int, String?> {
        for (loc in safeLocations) {
            val dist = haversineDistance(userLocation, loc.center)
            if (dist <= loc.radiusMeters) {
                return Pair(loc.riskDiscountPoints, loc.name)
            }
        }
        return Pair(0, null)
    }

    private fun haversineDistance(p1: GeoPoint, p2: GeoPoint): Double {
        val earthRadius = 6371000.0
        val dLat = Math.toRadians(p2.latitude - p1.latitude)
        val dLon = Math.toRadians(p2.longitude - p1.longitude)

        val a = sin(dLat / 2).pow(2) +
                cos(Math.toRadians(p1.latitude)) * cos(Math.toRadians(p2.latitude)) *
                sin(dLon / 2).pow(2)
        val c = 2 * atan2(sqrt(a), sqrt(1 - a))
        return earthRadius * c
    }
}
