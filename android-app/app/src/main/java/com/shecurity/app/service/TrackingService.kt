package com.shecurity.app.service

import android.annotation.SuppressLint
import android.app.*
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.*
import android.util.Log
import androidx.core.app.NotificationCompat
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.LocationCallback
import com.google.android.gms.location.LocationRequest
import com.google.android.gms.location.LocationResult
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import com.shecurity.app.data.ProfileRepository
import com.shecurity.app.data.models.*
import com.shecurity.app.communication.CommunicationManager
import com.shecurity.app.risk.MotionAnalyzer
import com.shecurity.app.risk.RiskEngine
import com.shecurity.app.MainActivity
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow

class TrackingService : Service(), SensorEventListener, LocationListener {

    inner class LocalBinder : Binder() {
        fun getService(): TrackingService = this@TrackingService
    }

    private val binder = LocalBinder()
    private val serviceScope = CoroutineScope(Dispatchers.Main + Job())

    val motionAnalyzer = MotionAnalyzer()
    val communicationManager = CommunicationManager()
    val riskEngine = RiskEngine(motionAnalyzer = motionAnalyzer)
    lateinit var profileRepository: ProfileRepository

    // Permanent Emergency Lock Flag (Never drops down when triggered)
    var isEmergencyLocked: Boolean = false
        private set

    // Real Hardware Telemetry Flows
    private val _userLocation = MutableStateFlow(GeoPoint(28.6139, 77.2090, "Waiting for GPS..."))
    val userLocation: StateFlow<GeoPoint> = _userLocation

    private val _batteryPercentage = MutableStateFlow(100)
    val batteryPercentage: StateFlow<Int> = _batteryPercentage

    private val _currentRiskAssessment = MutableStateFlow<RiskAssessment?>(null)
    val currentRiskAssessment: StateFlow<RiskAssessment?> = _currentRiskAssessment

    var activeRoute: SafeRoute? = null
    val safeLocations = mutableListOf<SafeLocation>()
    var activeTrip: PlannedTrip? = null

    private var sensorManager: SensorManager? = null
    private var accelerometer: Sensor? = null
    private var locationManager: LocationManager? = null
    private var fusedLocationClient: FusedLocationProviderClient? = null
    private var locationCallback: LocationCallback? = null
    private var vibrator: Vibrator? = null

    var onRemoteCheckRequested: (() -> Unit)? = null

    private val batteryReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            intent?.let {
                val level = it.getIntExtra(BatteryManager.EXTRA_LEVEL, -1)
                val scale = it.getIntExtra(BatteryManager.EXTRA_SCALE, -1)
                if (level >= 0 && scale > 0) {
                    _batteryPercentage.value = (level * 100 / scale)
                }
            }
        }
    }

    override fun onCreate() {
        super.onCreate()
        instance = this
        profileRepository = ProfileRepository(this)
        reloadProfiles()
        initHardwareSensors()
        initRealGpsLocation()
        initBatteryMonitoring()
        initVibrator()
        setupRemoteCheckListener()

        communicationManager.internetTransport.onConnectedProfileSync = {
            syncProfileToLaptop()
        }

        val prefs = getSharedPreferences("shecurity_prefs", Context.MODE_PRIVATE)
        val savedHost = prefs.getString("server_host", "192.168.1.11:3000") ?: "192.168.1.11:3000"
        communicationManager.internetTransport.setServerAddress(savedHost)

        // Try background auto-discovery only if on local network (skip if remote cloud tunnel is set)
        serviceScope.launch(Dispatchers.IO) {
            delay(1500)
            if (!communicationManager.internetTransport.isConnected && !communicationManager.internetTransport.isSecure) {
                val found = communicationManager.internetTransport.autoDiscoverServer()
                if (found != null) {
                    prefs.edit().putString("server_host", found).apply()
                }
            }
        }

        startForeground(NOTIFICATION_ID, createNotification("SHEcurity Live Hardware Sync", 8))
        startPeriodicSync()
    }

    fun reloadProfiles() {
        safeLocations.clear()
        safeLocations.addAll(profileRepository.getSafeLocations())
        val routes = profileRepository.getSafeRoutes()
        activeRoute = if (routes.isNotEmpty()) routes[0] else null
        syncProfileToLaptop()
    }

    fun syncProfileToLaptop() {
        if (::profileRepository.isInitialized) {
            val name = profileRepository.getUserName()
            val phone = profileRepository.getUserPhone()
            val notes = profileRepository.getEmergencyNotes()
            communicationManager.internetTransport.syncProfile(name, phone, notes, safeLocations)
        }
    }

    private fun initHardwareSensors() {
        sensorManager = getSystemService(Context.SENSOR_SERVICE) as? SensorManager
        accelerometer = sensorManager?.getDefaultSensor(Sensor.TYPE_ACCELEROMETER)
        accelerometer?.let {
            sensorManager?.registerListener(this, it, SensorManager.SENSOR_DELAY_UI)
        }
    }

    @SuppressLint("MissingPermission")
    private fun initRealGpsLocation() {
        // 1. Google Play Services Fused Location Provider (Fastest, works indoors via Wi-Fi/cell & outdoors via GPS)
        try {
            fusedLocationClient = LocationServices.getFusedLocationProviderClient(this)
            fusedLocationClient?.lastLocation?.addOnSuccessListener { loc ->
                if (loc != null) {
                    onLocationChanged(loc)
                }
            }
            fusedLocationClient?.getCurrentLocation(Priority.PRIORITY_HIGH_ACCURACY, null)?.addOnSuccessListener { loc ->
                if (loc != null) {
                    onLocationChanged(loc)
                }
            }

            val locationRequest = LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, 2000L)
                .setMinUpdateIntervalMillis(1000L)
                .setMinUpdateDistanceMeters(1.0f)
                .build()

            locationCallback = object : LocationCallback() {
                override fun onLocationResult(result: LocationResult) {
                    result.lastLocation?.let { onLocationChanged(it) }
                }
            }

            locationCallback?.let {
                fusedLocationClient?.requestLocationUpdates(locationRequest, it, Looper.getMainLooper())
            }
        } catch (e: Exception) {
            Log.w("TrackingService", "FusedLocationProvider error: ${e.message}")
        }

        // 2. Android LocationManager Fallback (GPS & Network)
        locationManager = getSystemService(Context.LOCATION_SERVICE) as? LocationManager
        try {
            if (locationManager?.isProviderEnabled(LocationManager.GPS_PROVIDER) == true) {
                locationManager?.requestLocationUpdates(
                    LocationManager.GPS_PROVIDER,
                    2000L,
                    1.0f,
                    this
                )
                locationManager?.getLastKnownLocation(LocationManager.GPS_PROVIDER)?.let { onLocationChanged(it) }
            }
            if (locationManager?.isProviderEnabled(LocationManager.NETWORK_PROVIDER) == true) {
                locationManager?.requestLocationUpdates(
                    LocationManager.NETWORK_PROVIDER,
                    2000L,
                    2.0f,
                    this
                )
                locationManager?.getLastKnownLocation(LocationManager.NETWORK_PROVIDER)?.let { onLocationChanged(it) }
            }
        } catch (e: Exception) {}
    }

    private fun initBatteryMonitoring() {
        val filter = IntentFilter(Intent.ACTION_BATTERY_CHANGED)
        registerReceiver(batteryReceiver, filter)
    }

    private fun initVibrator() {
        vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val vibratorManager = getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager
            vibratorManager?.defaultVibrator
        } else {
            @Suppress("DEPRECATION")
            getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
        }
    }

    private fun setupRemoteCheckListener() {
        communicationManager.internetTransport.onSafetyCheckTriggered = {
            serviceScope.launch {
                triggerHapticVibration()
                onRemoteCheckRequested?.invoke()
            }
        }
    }

    fun triggerHapticVibration() {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                vibrator?.vibrate(
                    VibrationEffect.createWaveform(
                        longArrayOf(0, 400, 200, 400, 200, 500),
                        -1
                    )
                )
            } else {
                @Suppress("DEPRECATION")
                vibrator?.vibrate(longArrayOf(0, 400, 200, 400, 200, 500), -1)
            }
        } catch (e: Exception) {}
    }

    private var lastBestLocation: Location? = null
    private var smoothedLat: Double = 0.0
    private var smoothedLon: Double = 0.0

    override fun onLocationChanged(location: Location) {
        if (!isBetterLocation(location, lastBestLocation)) {
            return
        }

        // Apply Stationary Drift Suppression & Smoothing
        if (smoothedLat == 0.0 || smoothedLon == 0.0) {
            smoothedLat = location.latitude
            smoothedLon = location.longitude
        } else {
            val results = FloatArray(1)
            Location.distanceBetween(smoothedLat, smoothedLon, location.latitude, location.longitude, results)
            val distanceMoved = results[0]

            if (distanceMoved < 4.0f && location.speed < 0.5f) {
                // Stationary drift suppression: ignore tiny sensor jitter while stationary
            } else {
                // Smooth moving average to eliminate sudden jumps
                val alpha = if (distanceMoved > 25.0f) 0.85 else 0.55
                smoothedLat = alpha * location.latitude + (1.0 - alpha) * smoothedLat
                smoothedLon = alpha * location.longitude + (1.0 - alpha) * smoothedLon
            }
        }

        lastBestLocation = location
        val accuracyStr = if (location.hasAccuracy()) "${location.accuracy.toInt()}m" else "High"
        val providerStr = location.provider ?: "Fused"
        val geo = GeoPoint(smoothedLat, smoothedLon, "Real Fix ($providerStr, $accuracyStr)")
        _userLocation.value = geo
        serviceScope.launch {
            evaluateAndSync()
        }
    }

    private fun isBetterLocation(location: Location, currentBestLocation: Location?): Boolean {
        if (currentBestLocation == null) return true

        val timeDelta = location.time - currentBestLocation.time
        val isSignificantlyNewer = timeDelta > 30000L
        val isSignificantlyOlder = timeDelta < -30000L
        val isNewer = timeDelta > 0

        if (isSignificantlyNewer) return true
        if (isSignificantlyOlder) return false

        val accuracyDelta = (location.accuracy - currentBestLocation.accuracy).toInt()
        val isLessAccurate = accuracyDelta > 0
        val isMoreAccurate = accuracyDelta < 0
        val isSignificantlyLessAccurate = accuracyDelta > 50

        val isFromSameProvider = location.provider == currentBestLocation.provider
        val isGps = location.provider == LocationManager.GPS_PROVIDER

        // Strongly prioritize GPS over Network provider
        if (isGps && currentBestLocation.provider != LocationManager.GPS_PROVIDER) return true
        if (!isGps && currentBestLocation.provider == LocationManager.GPS_PROVIDER && timeDelta < 15000L) {
            // Discard network update if we got a reliable GPS fix recently
            return false
        }

        if (isMoreAccurate) return true
        if (isNewer && !isLessAccurate) return true
        if (isNewer && !isSignificantlyLessAccurate && isFromSameProvider) return true

        return false
    }

    private var lastBroadcastMovement: MovementType = MovementType.STATIONARY
    private var lastMotionBroadcastTime: Long = 0L

    override fun onSensorChanged(event: SensorEvent?) {
        if (event?.sensor?.type == Sensor.TYPE_ACCELEROMETER) {
            val (movement, _) = motionAnalyzer.processAccelerometer(event.values[0], event.values[1], event.values[2])
            val now = System.currentTimeMillis()
            if (movement != lastBroadcastMovement && (movement == MovementType.RUNNING || movement == MovementType.SUDDEN_MOVEMENT_OR_FALL)) {
                if (now - lastMotionBroadcastTime > 2000L) {
                    lastMotionBroadcastTime = now
                    lastBroadcastMovement = movement
                    serviceScope.launch {
                        evaluateAndSync()
                    }
                }
            } else if (movement == MovementType.STATIONARY || movement == MovementType.WALKING) {
                lastBroadcastMovement = movement
            }
        }
    }

    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {}
    override fun onProviderEnabled(provider: String) {}
    override fun onProviderDisabled(provider: String) {}

    private fun startPeriodicSync() {
        serviceScope.launch {
            while (isActive) {
                evaluateAndSync()
                delay(2500)
            }
        }
    }

    suspend fun evaluateAndSync() {
        val currentHr = BoultFitHeartRateService.heartRateBpmFlow.value

        val assessment: RiskAssessment
        if (isEmergencyLocked || riskEngine.isEmergencyLocked) {
            isEmergencyLocked = true
            riskEngine.isEmergencyLocked = true
            // Permanent Emergency Lock: NEVER decays or drops down until user clicks Cancel
            assessment = RiskAssessment(
                score = 98,
                status = SafetyStatus.EMERGENCY,
                reasons = listOf("🚨 EMERGENCY SOS LOCKED ACTIVE", "Assistance Dispatched", "GPS Broadcast Live"),
                timestamp = System.currentTimeMillis()
            )
        } else {
            assessment = riskEngine.evaluate(
                userLocation = _userLocation.value,
                safeRoute = activeRoute,
                safeLocations = safeLocations,
                activeTrip = activeTrip,
                heartRateBpm = currentHr
            )
        }

        _currentRiskAssessment.value = assessment
        updateNotification(assessment)

        val uName = if (::profileRepository.isInitialized) profileRepository.getUserName() else "Aditi Sharma"
        val uPhone = if (::profileRepository.isInitialized) profileRepository.getUserPhone() else "+91 98765 43210"
        val uNotes = if (::profileRepository.isInitialized) profileRepository.getEmergencyNotes() else ""

        val isEmergencyActive = isEmergencyLocked || 
            assessment.status == SafetyStatus.EMERGENCY || 
            assessment.score >= 80 || 
            (currentHr in 1..40) || 
            (currentHr >= 180)

        val packet = EmergencyPacket(
            userId = "27",
            userName = uName,
            userPhone = uPhone,
            emergencyNotes = uNotes,
            latitude = _userLocation.value.latitude,
            longitude = _userLocation.value.longitude,
            riskScore = assessment.score,
            heartRate = currentHr,
            battery = _batteryPercentage.value,
            movement = motionAnalyzer.currentMovement,
            isSos = isEmergencyActive,
            reason = if (isEmergencyLocked) "MANUAL SOS PERMANENT LOCK ACTIVATED" else assessment.reasons.joinToString("; ")
        )

        communicationManager.sendEmergencyData(packet)
    }

    /**
     * Trigger manual emergency and lock it permanently until user explicitly clears it
     */
    fun triggerManualSOS() {
        isEmergencyLocked = true
        riskEngine.forceEmergency()
        serviceScope.launch {
            evaluateAndSync()
        }
    }

    /**
     * Clear emergency lock when user confirms they are safe
     */
    fun clearManualSos() {
        isEmergencyLocked = false
        riskEngine.resetRiskToSafe()
        communicationManager.internetTransport.sendResolveSos()
        serviceScope.launch {
            evaluateAndSync()
        }
    }

    fun resolveSafetyCheck(result: String) {
        if (result == "SAFE") {
            clearManualSos()
        } else if (result == "DURESS") {
            triggerManualSOS()
        }
        communicationManager.internetTransport.sendCheckResolution(result)
        serviceScope.launch { evaluateAndSync() }
    }

    private fun createNotification(content: String, riskScore: Int): Notification {
        val channelId = "shecurity_tracking_channel"
        val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                channelId,
                "SHEcurity Active Monitoring",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                setSound(null, null)
                enableVibration(false)
                setShowBadge(false)
            }
            manager.createNotificationChannel(channel)
        }

        val pendingIntent = PendingIntent.getActivity(
            this,
            0,
            Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_IMMUTABLE
        )

        return NotificationCompat.Builder(this, channelId)
            .setContentTitle("SHEcurity Live Telemetry Active")
            .setContentText("Risk: $riskScore/100 • $content")
            .setSmallIcon(android.R.drawable.ic_lock_idle_lock)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setSilent(true)
            .build()
    }

    private fun updateNotification(assessment: RiskAssessment) {
        val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        manager.notify(NOTIFICATION_ID, createNotification(assessment.status.name, assessment.score))
    }

    override fun onBind(intent: Intent?): IBinder = binder

    override fun onDestroy() {
        super.onDestroy()
        sensorManager?.unregisterListener(this)
        locationManager?.removeUpdates(this)
        locationCallback?.let { fusedLocationClient?.removeLocationUpdates(it) }
        try {
            unregisterReceiver(batteryReceiver)
        } catch (e: Exception) {}
        serviceScope.cancel()
        if (instance == this) instance = null
    }

    companion object {
        private const val NOTIFICATION_ID = 2001
        var instance: TrackingService? = null
            private set

        fun reloadProfilesIfRunning() {
            instance?.reloadProfiles()
        }
    }
}
