package com.shecurity.app.risk

import com.shecurity.app.data.models.*
import kotlin.math.max
import kotlin.math.min

class RiskEngine(
    private val routeAnalyzer: RouteDeviationAnalyzer = RouteDeviationAnalyzer(),
    private val timeAnalyzer: TimeAnomalyAnalyzer = TimeAnomalyAnalyzer(),
    private val motionAnalyzer: MotionAnalyzer = MotionAnalyzer(),
    private val locationAnalyzer: LocationAnalyzer = LocationAnalyzer()
) {
    private var currentRiskScore: Int = 8
    private var lastAssessmentTime: Long = System.currentTimeMillis()

    // Permanent Emergency SOS Lock
    var isEmergencyLocked: Boolean = false

    // Configurable Alert Thresholds
    var normalMaxThreshold = 30
    var cautionMaxThreshold = 60
    var highRiskMaxThreshold = 80
    var emergencyTriggerThreshold = 81

    fun evaluate(
        userLocation: GeoPoint,
        safeRoute: SafeRoute?,
        safeLocations: List<SafeLocation>,
        activeTrip: PlannedTrip?,
        heartRateBpm: Int,
        simulatedHour: Int? = null,
        simulatedMovement: MovementType? = null
    ): RiskAssessment {
        if (isEmergencyLocked) {
            currentRiskScore = 98
            lastAssessmentTime = System.currentTimeMillis()
            return RiskAssessment(
                score = 98,
                status = SafetyStatus.EMERGENCY,
                timePenalty = 25,
                routeDeviationPenalty = 25,
                locationPenalty = 0,
                motionPenalty = 25,
                heartRatePenalty = 25,
                safeContextDiscount = 0,
                reasons = listOf("🚨 EMERGENCY SOS LOCKED ACTIVE", "Assistance Dispatched", "Live GPS Beacon Active"),
                timestamp = lastAssessmentTime
            )
        }

        val reasons = mutableListOf<String>()

        // 1. Route Deviation Analysis
        val (deviationMeters, routePenalty) = routeAnalyzer.analyzeDeviation(userLocation, safeRoute)
        if (routePenalty > 0) {
            reasons.add("Route deviation off corridor (${deviationMeters.toInt()}m) [+$routePenalty]")
        }

        // 2. Time Anomaly Analysis (8:00 PM is hour 20 -> +20 penalty)
        val (timePenalty, timeReason) = timeAnalyzer.analyzeTimeAnomaly(safeRoute, activeTrip, simulatedHour)
        if (timePenalty > 0 && timeReason != null) {
            reasons.add("$timeReason [+$timePenalty]")
        }

        // 3. Motion Analysis (Very Vigorous Shaking -> 45, Running -> 40)
        val (movement, motionPenalty) = if (simulatedMovement != null) {
            motionAnalyzer.setSimulatedMovement(simulatedMovement)
        } else {
            val curr = motionAnalyzer.currentMovement
            val pen = when (curr) {
                MovementType.SUDDEN_MOVEMENT_OR_FALL -> 45
                MovementType.RUNNING -> 40
                else -> 0
            }
            Pair(curr, pen)
        }
        if (motionPenalty > 0) {
            if (movement == MovementType.SUDDEN_MOVEMENT_OR_FALL) {
                reasons.add("🚨 Very Vigorous Distress Shaking Detected [+$motionPenalty]")
            } else if (movement == MovementType.RUNNING) {
                reasons.add("🏃 Rapid Running / Distress Motion Detected [+$motionPenalty]")
            }
        }

        // 4. Heart Rate Anomaly (GoBoult Fit)
        val hrPenalty = when {
            heartRateBpm >= 180 -> 45 // Extreme Tachycardia / Acute Panic (e.g. 230 BPM)
            heartRateBpm >= 135 -> 25 // Tachycardia / Panic pulse
            heartRateBpm >= 110 -> 15 // Elevated pulse
            heartRateBpm in 55..100 -> 0 // Normal resting / light walking
            heartRateBpm in 1..40 -> 45 // Critical Bradycardia / Cardiac Collapse (e.g. 30 BPM)
            heartRateBpm in 41..54 -> 15 // Low heart rate / Bradycardia
            else -> 0
        }
        if (hrPenalty > 0) {
            reasons.add("GoBoult Fit heart rate anomaly: $heartRateBpm BPM [+$hrPenalty]")
        }

        // 5. Safe Location Discount vs Outside Safe Location Penalty
        val (safeDiscount, safeLocationName) = locationAnalyzer.checkSafeLocations(userLocation, safeLocations)
        var locationPenalty = 0
        if (safeDiscount > 0 && safeLocationName != null) {
            reasons.add("Inside safe zone: $safeLocationName [-$safeDiscount]")
        } else if (safeLocations.isNotEmpty()) {
            // Outside all saved safe locations
            locationPenalty = 20
            reasons.add("Outside registered safe zones [+$locationPenalty]")
        }

        // Total instantaneous risk score
        var rawScore = routePenalty + timePenalty + motionPenalty + hrPenalty + locationPenalty - safeDiscount

        // 1. VERY VIGOROUS SHAKING (Violent struggle) -> Guaranteed EMERGENCY trigger (score >= 85)
        if (movement == MovementType.SUDDEN_MOVEMENT_OR_FALL) {
            rawScore = max(rawScore, 85) // Direct EMERGENCY status (threshold is 81)
            reasons.add("🚨 EMERGENCY: Very Vigorous Distress Shaking / Struggle Confirmed")
        }
        // 2. SUSTAINED RUNNING OUTSIDE SAFE ZONE -> Guaranteed EMERGENCY trigger (score >= 85)
        else if (movement == MovementType.RUNNING) {
            if (locationPenalty > 0 || routePenalty > 0 || timePenalty > 0) {
                rawScore = max(rawScore, 85) // Direct EMERGENCY status
                reasons.add("🚨 EMERGENCY: Fleeing / Rapid Running in Unregistered Area")
            } else {
                rawScore = max(rawScore, 50)
            }
        }

        // 3. CRITICAL BRADYCARDIA / CARDIAC COLLAPSE (<= 40 BPM, e.g. 30 BPM) -> Guaranteed EMERGENCY trigger (score >= 92)
        if (heartRateBpm in 1..40) {
            rawScore = max(rawScore, 92)
            reasons.add("🚨 EMERGENCY: Critical Cardiac Collapse ($heartRateBpm BPM Life-Threatening Bradycardia)")
        }
        // 4. EXTREME TACHYCARDIA / ACUTE PANIC (>= 180 BPM, e.g. 230 BPM) -> Guaranteed EMERGENCY trigger (score >= 95)
        else if (heartRateBpm >= 180) {
            rawScore = max(rawScore, 95)
            reasons.add("🚨 EMERGENCY: Extreme Tachycardia / Panic Surge ($heartRateBpm BPM Under Distress)")
        }

        // 6. Dynamic Risk Elevation & Decay logic:
        val targetScore = max(0, min(100, rawScore))
        if (movement == MovementType.RUNNING || movement == MovementType.SUDDEN_MOVEMENT_OR_FALL || targetScore >= currentRiskScore) {
            // Immediate surge to target score when in danger or running
            currentRiskScore = targetScore
        } else {
            // Gradual decay step when calming down
            currentRiskScore = max(targetScore, currentRiskScore - 5)
        }

        // Determine safety status
        val status = when {
            currentRiskScore >= emergencyTriggerThreshold -> SafetyStatus.EMERGENCY
            currentRiskScore > cautionMaxThreshold -> SafetyStatus.HIGH_RISK
            currentRiskScore > normalMaxThreshold -> SafetyStatus.CAUTION
            else -> SafetyStatus.SAFE
        }

        if (reasons.isEmpty()) {
            reasons.add("Normal movement pattern adhered to")
            reasons.add("No anomalies detected")
        }

        lastAssessmentTime = System.currentTimeMillis()

        return RiskAssessment(
            score = currentRiskScore,
            status = status,
            timePenalty = timePenalty,
            routeDeviationPenalty = routePenalty,
            locationPenalty = locationPenalty,
            motionPenalty = motionPenalty,
            heartRatePenalty = hrPenalty,
            safeContextDiscount = safeDiscount,
            reasons = reasons,
            timestamp = lastAssessmentTime
        )
    }

    fun resetRiskToSafe() {
        isEmergencyLocked = false
        currentRiskScore = 8
    }

    fun forceEmergency() {
        isEmergencyLocked = true
        currentRiskScore = 98
    }
}
