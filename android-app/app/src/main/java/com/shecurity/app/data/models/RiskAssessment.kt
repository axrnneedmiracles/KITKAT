package com.shecurity.app.data.models

enum class SafetyStatus {
    SAFE,       // 0 - 30
    CAUTION,    // 31 - 60
    HIGH_RISK,  // 61 - 80
    EMERGENCY   // 81 - 100
}

enum class MovementType {
    STATIONARY,
    WALKING,
    RUNNING,
    SUDDEN_MOVEMENT_OR_FALL
}

data class RiskAssessment(
    val score: Int,
    val status: SafetyStatus,
    val timePenalty: Int = 0,
    val routeDeviationPenalty: Int = 0,
    val locationPenalty: Int = 0,
    val motionPenalty: Int = 0,
    val heartRatePenalty: Int = 0,
    val safeContextDiscount: Int = 0,
    val reasons: List<String> = emptyList(),
    val timestamp: Long = System.currentTimeMillis()
)
