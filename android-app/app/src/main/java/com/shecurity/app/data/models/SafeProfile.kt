package com.shecurity.app.data.models

data class GeoPoint(
    val latitude: Double,
    val longitude: Double,
    val name: String = ""
)

data class SafeRoute(
    val id: String,
    val name: String,
    val start: GeoPoint,
    val destination: GeoPoint,
    val waypoints: List<GeoPoint>,
    val toleranceRadiusMeters: Double = 100.0,
    val regularStartHour: Int = 17, // 5:00 PM
    val regularEndHour: Int = 22    // 10:00 PM
)

data class SafeLocation(
    val id: String,
    val name: String,
    val center: GeoPoint,
    val radiusMeters: Double = 120.0,
    val riskDiscountPoints: Int = 25
)

data class TrustedContact(
    val id: String,
    val name: String,
    val phoneNumber: String,
    val relationship: String
)

data class PlannedTrip(
    val id: String,
    val title: String,
    val origin: String,
    val destination: String,
    val departureDate: String,
    val departureHour: Int,
    val expectedArrivalHour: Int
)
