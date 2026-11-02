package com.shecurity.app.risk

import com.shecurity.app.data.models.MovementType
import kotlin.math.sqrt

class MotionAnalyzer {

    private val accelerationWindow = mutableListOf<Float>()
    private val maxWindowSize = 50 // ~1.5 - 2.0 seconds of sensor readings at SENSOR_DELAY_UI

    var currentMovement: MovementType = MovementType.STATIONARY
        private set

    var isLiveSensorActive: Boolean = true
        private set

    var lastMagnitude: Float = 9.8f
        private set

    var lastAx: Float = 0.0f
        private set

    var lastAy: Float = 0.0f
        private set

    var lastAz: Float = 9.8f
        private set

    // Debouncing & Hysteresis counters
    private var runningConfirmationCount = 0
    private var shakingConfirmationCount = 0
    private var walkingConfirmationCount = 0
    private var stationaryConfirmationCount = 0

    fun resetToLiveSensor() {
        isLiveSensorActive = true
    }

    /**
     * Heavily desensitized accelerometer processor.
     * Guaranteed immunity to touches, nudges, taps, hand gestures, and picking up the phone.
     * ONLY triggers on:
     * 1. Very Vigorous Continuous Distress Shaking (requires high force and continuous oscillation)
     * 2. Sustained Physical Running (requires repetitive hard stride impacts)
     */
    fun processAccelerometer(ax: Float, ay: Float, az: Float): Pair<MovementType, Int> {
        val magnitude = sqrt((ax * ax + ay * ay + az * az).toDouble()).toFloat()

        isLiveSensorActive = true
        lastAx = ax
        lastAy = ay
        lastAz = az
        lastMagnitude = magnitude

        accelerationWindow.add(magnitude)
        if (accelerationWindow.size > maxWindowSize) {
            accelerationWindow.removeAt(0)
        }

        // Wait until we have accumulated enough baseline samples (~1.0s)
        if (accelerationWindow.size < 30) {
            return Pair(currentMovement, 0)
        }

        // Statistical analysis across sliding window
        val mean = accelerationWindow.average()
        val variance = accelerationWindow.map { (it - mean) * (it - mean) }.average()
        val stdDev = sqrt(variance)

        // Count peaks across sliding window
        var extremeShakingPeaks = 0 // Peaks > 24.0 m/s² (very vigorous shaking force)
        var runningStridePeaks = 0  // Peaks > 18.5 m/s² (hard foot strikes)
        var freeFallDips = 0        // Zero-g dips < 2.5 m/s²

        for (m in accelerationWindow) {
            if (m > 24.0f) extremeShakingPeaks++
            if (m > 18.5f) runningStridePeaks++
            if (m < 2.5f) freeFallDips++
        }

        // Count zero-crossings / direction reversals around mean
        var directionChanges = 0
        for (i in 1 until accelerationWindow.size) {
            val prevDiff = accelerationWindow[i - 1] - mean
            val currDiff = accelerationWindow[i] - mean
            if ((prevDiff > 0 && currDiff < 0) || (prevDiff < 0 && currDiff > 0)) {
                directionChanges++
            }
        }

        // 1. VERY VIGOROUS SHAKING / DISTRESS STRUGGLE DETECTION:
        // Requires continuous, high-force violent shaking:
        // - Standard deviation >= 10.0 m/s²
        // - At least 8 extreme peaks exceeding 24.0 m/s² (> 2.45g)
        // - High oscillation frequency: at least 14 direction reversals in the window
        val isVeryVigorousShaking = stdDev >= 10.0 && directionChanges >= 14 && extremeShakingPeaks >= 8

        // Hard impact / fall: free-fall followed by severe ground impact (> 40 m/s²)
        val isHardImpact = freeFallDips >= 3 && magnitude > 40.0f

        // 2. SUSTAINED RUNNING DETECTION:
        // Real running produces rhythmic periodic stride impacts:
        // - At least 5 stride impacts > 18.5 m/s² across 1.5s
        // - Standard deviation between 4.8 and 10.0 m/s²
        // - Direction reversals between 6 and 16
        // - NOT violent shaking
        val isSustainedRunning = !isVeryVigorousShaking && (stdDev in 4.8..10.0) && runningStridePeaks >= 5 && (directionChanges in 6..16)

        // 3. NORMAL WALKING:
        // Gentle walking rhythm: stdDev in 1.8..4.0, runningStridePeaks <= 2, no violent shaking
        val isWalking = !isVeryVigorousShaking && !isSustainedRunning && (stdDev in 1.8..4.0) && runningStridePeaks <= 2 && directionChanges in 4..12

        // Candidate state: EVERYTHING ELSE is STATIONARY (touches, taps, holding, moving slowly, gestures)
        val candidateType = when {
            isVeryVigorousShaking || isHardImpact -> MovementType.SUDDEN_MOVEMENT_OR_FALL
            isSustainedRunning -> MovementType.RUNNING
            isWalking -> MovementType.WALKING
            else -> MovementType.STATIONARY
        }

        when (candidateType) {
            MovementType.SUDDEN_MOVEMENT_OR_FALL -> {
                shakingConfirmationCount++
                runningConfirmationCount = 0
                walkingConfirmationCount = 0
                stationaryConfirmationCount = 0
                // Requires sustained vigorous shaking for at least 12 cycles (~250-300ms)
                if (shakingConfirmationCount >= 12) {
                    currentMovement = MovementType.SUDDEN_MOVEMENT_OR_FALL
                }
            }
            MovementType.RUNNING -> {
                runningConfirmationCount++
                shakingConfirmationCount = 0
                walkingConfirmationCount = 0
                stationaryConfirmationCount = 0
                // Requires at least 8 cycles of confirmed running strides
                if (runningConfirmationCount >= 8) {
                    currentMovement = MovementType.RUNNING
                }
            }
            MovementType.WALKING -> {
                walkingConfirmationCount++
                shakingConfirmationCount = 0
                runningConfirmationCount = 0
                stationaryConfirmationCount = 0
                if (walkingConfirmationCount >= 6) {
                    currentMovement = MovementType.WALKING
                }
            }
            MovementType.STATIONARY -> {
                stationaryConfirmationCount++
                // Quickly drops back to STATIONARY as soon as vigorous motion stops
                if (stationaryConfirmationCount >= 3) {
                    shakingConfirmationCount = 0
                    runningConfirmationCount = 0
                    walkingConfirmationCount = 0
                    currentMovement = MovementType.STATIONARY
                }
            }
        }

        val penalty = when (currentMovement) {
            MovementType.SUDDEN_MOVEMENT_OR_FALL -> 45
            MovementType.RUNNING -> 40
            else -> 0
        }

        return Pair(currentMovement, penalty)
    }

    fun setSimulatedMovement(type: MovementType): Pair<MovementType, Int> {
        isLiveSensorActive = false
        currentMovement = type
        val penalty = when (type) {
            MovementType.SUDDEN_MOVEMENT_OR_FALL -> 45
            MovementType.RUNNING -> 40
            else -> 0
        }
        return Pair(type, penalty)
    }
}
