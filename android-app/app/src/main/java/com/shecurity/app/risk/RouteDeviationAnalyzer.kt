package com.shecurity.app.risk

import com.shecurity.app.data.models.GeoPoint
import com.shecurity.app.data.models.SafeRoute
import kotlin.math.*

class RouteDeviationAnalyzer {

    /**
     * Calculates minimum distance from user coordinate to safe route polyline segments.
     * Returns deviation distance in meters and risk penalty (0 to 25 points).
     */
    fun analyzeDeviation(
        userLocation: GeoPoint,
        safeRoute: SafeRoute?
    ): Pair<Double, Int> {
        if (safeRoute == null || safeRoute.waypoints.size < 2) {
            return Pair(0.0, 0)
        }

        var minDistanceMeters = Double.MAX_VALUE
        val points = safeRoute.waypoints

        for (i in 0 until points.size - 1) {
            val d = distanceToSegment(userLocation, points[i], points[i + 1])
            if (d < minDistanceMeters) {
                minDistanceMeters = d
            }
        }

        val penalty = when {
            minDistanceMeters <= safeRoute.toleranceRadiusMeters -> 0
            minDistanceMeters <= 250.0 -> 10
            minDistanceMeters <= 500.0 -> 20
            else -> 25
        }

        return Pair(minDistanceMeters, penalty)
    }

    /**
     * Haversine distance between two coordinates in meters
     */
    fun haversineDistance(p1: GeoPoint, p2: GeoPoint): Double {
        val earthRadius = 6371000.0 // meters
        val dLat = Math.toRadians(p2.latitude - p1.latitude)
        val dLon = Math.toRadians(p2.longitude - p1.longitude)

        val a = sin(dLat / 2).pow(2) +
                cos(Math.toRadians(p1.latitude)) * cos(Math.toRadians(p2.latitude)) *
                sin(dLon / 2).pow(2)
        val c = 2 * atan2(sqrt(a), sqrt(1 - a))
        return earthRadius * c
    }

    private fun distanceToSegment(p: GeoPoint, v: GeoPoint, w: GeoPoint): Double {
        // Approximate planar projection for local distances (< 10km)
        val l2 = (v.latitude - w.latitude).pow(2) + (v.longitude - w.longitude).pow(2)
        if (l2 == 0.0) return haversineDistance(p, v)

        var t = ((p.latitude - v.latitude) * (w.latitude - v.latitude) +
                (p.longitude - v.longitude) * (w.longitude - v.longitude)) / l2
        t = max(0.0, min(1.0, t))

        val projection = GeoPoint(
            v.latitude + t * (w.latitude - v.latitude),
            v.longitude + t * (w.longitude - v.longitude)
        )
        return haversineDistance(p, projection)
    }
}
