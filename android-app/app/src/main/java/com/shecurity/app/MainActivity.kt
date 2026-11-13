package com.shecurity.app

import android.Manifest
import android.annotation.SuppressLint
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.ServiceConnection
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.view.View
import android.widget.*
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import com.google.android.material.button.MaterialButton
import com.google.android.material.card.MaterialCardView
import com.google.android.material.progressindicator.LinearProgressIndicator
import com.shecurity.app.data.models.MovementType
import com.shecurity.app.data.models.SafetyStatus
import com.shecurity.app.service.BoultFitHeartRateService
import com.shecurity.app.service.TrackingService
import com.shecurity.app.ui.DuressDialog
import com.shecurity.app.ui.ProfileActivity
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.collectLatest

class MainActivity : AppCompatActivity() {

    private var trackingService: TrackingService? = null
    private var isBound = false
    private var isEmergencyActive = false

    // UI elements
    private lateinit var cardSafetyStatus: MaterialCardView
    private lateinit var tvStatusTitle: TextView
    private lateinit var tvRiskScore: TextView
    private lateinit var progressRisk: LinearProgressIndicator
    private lateinit var tvExplainableReasons: TextView
    private lateinit var btnSos: MaterialButton
    private lateinit var btnCancelEmergency: MaterialButton

    private lateinit var tvGpsStatus: TextView
    private lateinit var tvNetworkStatus: TextView
    private lateinit var tvBtStatus: TextView
    private lateinit var tvLoraStatus: TextView
    private lateinit var tvHeartRate: TextView
    private lateinit var tvMotionStatus: TextView

    private val serviceConnection = object : ServiceConnection {
        override fun onServiceConnected(name: ComponentName?, binder: IBinder?) {
            val localBinder = binder as TrackingService.LocalBinder
            trackingService = localBinder.getService()
            isBound = true

            val prefs = getSharedPreferences("shecurity_prefs", Context.MODE_PRIVATE)
            var savedHost = prefs.getString("server_host", "192.168.1.11:3000") ?: "192.168.1.11:3000"
            if (savedHost.contains("192.168.1.100") || savedHost.contains("192.168.1.101") || savedHost.contains("192.168.91.")) {
                savedHost = "192.168.1.11:3000"
                prefs.edit().putString("server_host", savedHost).apply()
            }
            trackingService?.communicationManager?.internetTransport?.setServerAddress(savedHost)

            lifecycleScope.launch(Dispatchers.IO) {
                delay(1200)
                if (trackingService?.communicationManager?.internetTransport?.isConnected != true) {
                    val found = trackingService?.communicationManager?.internetTransport?.autoDiscoverServer()
                    if (found != null) {
                        prefs.edit().putString("server_host", found).apply()
                    }
                }
            }

            trackingService?.onRemoteCheckRequested = {
                runOnUiThread {
                    showDiscreetSafeCheck()
                }
            }

            observeServiceTelemetry()
        }

        override fun onServiceDisconnected(name: ComponentName?) {
            trackingService = null
            isBound = false
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        initViews()
        setupSosInteractions()
        requestSystemPermissions()
        startAndBindTrackingService()
    }

    override fun onResume() {
        super.onResume()
        trackingService?.reloadProfiles()
    }

    private fun initViews() {
        cardSafetyStatus = findViewById(R.id.card_safety_status)
        tvStatusTitle = findViewById(R.id.tv_status_title)
        tvRiskScore = findViewById(R.id.tv_risk_score)
        progressRisk = findViewById(R.id.progress_risk)
        tvExplainableReasons = findViewById(R.id.tv_explainable_reasons)
        btnSos = findViewById(R.id.btn_sos)
        btnCancelEmergency = findViewById(R.id.btn_cancel_emergency)

        tvGpsStatus = findViewById(R.id.tv_gps_status)
        tvNetworkStatus = findViewById(R.id.tv_network_status)
        tvBtStatus = findViewById(R.id.tv_bt_status)
        tvLoraStatus = findViewById(R.id.tv_lora_status)
        tvHeartRate = findViewById(R.id.tv_heart_rate)
        tvMotionStatus = findViewById(R.id.tv_motion_status)

        tvNetworkStatus.setOnClickListener {
            showServerConfigDialog()
        }

        tvHeartRate.setOnClickListener {
            showHeartRateConfigDialog()
        }

        findViewById<View>(R.id.btn_open_profile).setOnClickListener {
            startActivity(Intent(this, ProfileActivity::class.java))
        }

        findViewById<MaterialButton>(R.id.btn_card_open_profile).setOnClickListener {
            startActivity(Intent(this, ProfileActivity::class.java))
        }

        findViewById<MaterialButton>(R.id.btn_trigger_safe_check).setOnClickListener {
            showDiscreetSafeCheck()
        }

        findViewById<MaterialButton>(R.id.btn_open_demo_sim).setOnClickListener {
            showServerConfigDialog()
        }

        findViewById<MaterialButton>(R.id.btn_open_lora_config).setOnClickListener {
            showLoraConfigDialog()
        }

        findViewById<MaterialButton>(R.id.btn_connect_esp32_card).setOnClickListener {
            showLoraConfigDialog()
        }

        findViewById<MaterialButton>(R.id.btn_open_phone_bt_settings).setOnClickListener {
            startActivity(Intent(android.provider.Settings.ACTION_BLUETOOTH_SETTINGS))
        }

        findViewById<MaterialButton>(R.id.btn_motion_walk).setOnClickListener {
            val s = trackingService ?: TrackingService.instance
            s?.motionAnalyzer?.setSimulatedMovement(MovementType.WALKING)
            Toast.makeText(this, "Motion set to: WALKING", Toast.LENGTH_SHORT).show()
        }
        findViewById<MaterialButton>(R.id.btn_motion_run).setOnClickListener {
            val s = trackingService ?: TrackingService.instance
            s?.motionAnalyzer?.setSimulatedMovement(MovementType.RUNNING)
            Toast.makeText(this, "Motion set to: RUNNING (Penalty Active)", Toast.LENGTH_SHORT).show()
        }
        findViewById<MaterialButton>(R.id.btn_motion_fall).setOnClickListener {
            val s = trackingService ?: TrackingService.instance
            s?.motionAnalyzer?.setSimulatedMovement(MovementType.SUDDEN_MOVEMENT_OR_FALL)
            Toast.makeText(this, "⚠️ Impact / Fall Registered", Toast.LENGTH_SHORT).show()
        }
        findViewById<MaterialButton>(R.id.btn_motion_reset).setOnClickListener {
            val s = trackingService ?: TrackingService.instance
            s?.motionAnalyzer?.resetToLiveSensor()
            Toast.makeText(this, "🔄 Reset to Real Phone Accelerometer", Toast.LENGTH_SHORT).show()
        }

        findViewById<MaterialButton>(R.id.btn_hr_critical_low).setOnClickListener {
            applyAndDispatchSimulatedHr(30, "📉 Pulse set to: 30 BPM (Critical Bradycardia / Cardiac Collapse)")
        }
        findViewById<MaterialButton>(R.id.btn_hr_normal).setOnClickListener {
            applyAndDispatchSimulatedHr(72, "Pulse set to: 72 BPM (Normal)")
        }
        findViewById<MaterialButton>(R.id.btn_hr_elevated).setOnClickListener {
            applyAndDispatchSimulatedHr(115, "Pulse set to: 115 BPM (Elevated)")
        }
        findViewById<MaterialButton>(R.id.btn_hr_panic).setOnClickListener {
            applyAndDispatchSimulatedHr(145, "⚠️ Pulse set to: 145 BPM (High Panic)")
        }
        findViewById<MaterialButton>(R.id.btn_hr_critical_high).setOnClickListener {
            applyAndDispatchSimulatedHr(230, "🚨 Pulse set to: 230 BPM (Extreme Tachycardia / Acute Danger)")
        }

        findViewById<MaterialButton>(R.id.btn_open_accessibility).setOnClickListener {
            startActivity(Intent(android.provider.Settings.ACTION_ACCESSIBILITY_SETTINGS))
        }

        btnCancelEmergency.setOnClickListener {
            showCancelEmergencyDialog()
        }
    }

    /**
     * Permanent Emergency SOS Trigger:
     * Clicking or holding locks the emergency permanently until user confirms cancel.
     */
    private fun setupSosInteractions() {
        btnSos.setOnClickListener {
            activateEmergencyLock("MANUAL SOS BUTTON PRESSED")
        }

        btnSos.setOnLongClickListener {
            activateEmergencyLock("MANUAL SOS BUTTON HELD")
            true
        }
    }

    private fun activateEmergencyLock(reason: String) {
        isEmergencyActive = true
        val service = trackingService ?: TrackingService.instance
        service?.triggerManualSOS()

        runOnUiThread {
            btnSos.text = "🚨 SOS ACTIVE"
            btnSos.setBackgroundColor(ContextCompat.getColor(this, R.color.danger_red))
            btnCancelEmergency.visibility = View.VISIBLE
            tvStatusTitle.text = "🚨 EMERGENCY"
            tvStatusTitle.setTextColor(ContextCompat.getColor(this, R.color.danger_red))
            cardSafetyStatus.strokeColor = ContextCompat.getColor(this, R.color.danger_red)
            tvRiskScore.text = "Risk Score: 98 / 100"
            progressRisk.progress = 98
            progressRisk.setIndicatorColor(ContextCompat.getColor(this, R.color.danger_red))
            tvExplainableReasons.text = "🚨 EMERGENCY SOS PERMANENTLY BROADCASTING LIVE"
        }

        Toast.makeText(this, "🚨 EMERGENCY ACTIVATED! Broadcasting location...", Toast.LENGTH_LONG).show()
    }

    private fun showCancelEmergencyDialog() {
        AlertDialog.Builder(this)
            .setTitle("Cancel Emergency SOS")
            .setMessage("Are you sure you are safe? This will clear the emergency state on the laptop monitoring center.")
            .setPositiveButton("Yes, I am Safe") { _, _ ->
                isEmergencyActive = false
                val service = trackingService ?: TrackingService.instance
                service?.clearManualSos()
                runOnUiThread {
                    btnSos.text = "SOS"
                    btnCancelEmergency.visibility = View.GONE
                    Toast.makeText(this, "✅ Emergency SOS Cleared. Restoring normal monitoring.", Toast.LENGTH_SHORT).show()
                }
            }
            .setNegativeButton("Keep Emergency Active", null)
            .show()
    }

    /**
     * Dedicated LoRa / Bluetooth Hardware Setup Dialog
     */
    @SuppressLint("MissingPermission")
    private fun showLoraConfigDialog() {
        val adapter = BluetoothAdapter.getDefaultAdapter()
        if (adapter == null) {
            Toast.makeText(this, "Bluetooth hardware not detected on this device", Toast.LENGTH_LONG).show()
            return
        }
        if (!adapter.isEnabled) {
            Toast.makeText(this, "Please enable Bluetooth in your Phone Settings", Toast.LENGTH_LONG).show()
            startActivity(Intent(android.provider.Settings.ACTION_BLUETOOTH_SETTINGS))
            return
        }

        val pairedList = mutableListOf<String>()
        val deviceMap = mutableMapOf<String, BluetoothDevice>()

        adapter.bondedDevices?.forEach { dev ->
            val label = "${dev.name ?: "Unknown"} (${dev.address})"
            pairedList.add(label)
            deviceMap[label] = dev
        }

        val dialogView = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(40, 20, 40, 20)
        }

        val loraTransport = trackingService?.communicationManager?.loraTransport

        val tvStatus = TextView(this).apply {
            val isConn = loraTransport?.isConnected() == true
            val name = loraTransport?.getConnectedDeviceName()
            text = if (isConn) "● Bluetooth LoRa Bridge: CONNECTED ($name)" else "○ Bluetooth LoRa Bridge: DISCONNECTED / STANDBY"
            setTextColor(ContextCompat.getColor(this@MainActivity, if (isConn) R.color.safety_green else R.color.caution_yellow))
            textSize = 13f
            paint.isFakeBoldText = true
            setPadding(0, 0, 0, 16)
        }
        dialogView.addView(tvStatus)

        val spinner = Spinner(this)
        if (pairedList.isNotEmpty()) {
            val spinAdapter = ArrayAdapter(this, android.R.layout.simple_spinner_dropdown_item, pairedList)
            spinner.adapter = spinAdapter
            val defaultIndex = pairedList.indexOfFirst { it.contains("BLACKNET", ignoreCase = true) || it.contains("SHECURITY", ignoreCase = true) || it.contains("ESP32", ignoreCase = true) || it.contains("LORA", ignoreCase = true) }
            if (defaultIndex >= 0) spinner.setSelection(defaultIndex)
            dialogView.addView(TextView(this).apply { text = "Select Paired ESP32 Bluetooth Module:"; textSize = 12f; setTextColor(ContextCompat.getColor(this@MainActivity, R.color.text_secondary)) })
            dialogView.addView(spinner)

            val btnConnectBt = MaterialButton(this).apply {
                text = "Connect to Selected ESP32"
                layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply { topMargin = 12 }
                setOnClickListener {
                    val selLabel = spinner.selectedItem as? String
                    val dev = selLabel?.let { deviceMap[it] }
                    if (dev != null) {
                        Toast.makeText(this@MainActivity, "Connecting to ${dev.name} over Bluetooth RFCOMM...", Toast.LENGTH_SHORT).show()
                        lifecycleScope.launch {
                            val success = loraTransport?.connectToBridge(dev) ?: false
                            if (success) {
                                tvStatus.text = "● Bluetooth LoRa Bridge: CONNECTED (${dev.name})"
                                tvStatus.setTextColor(ContextCompat.getColor(this@MainActivity, R.color.safety_green))
                                tvLoraStatus.text = "ESP32 BT READY"
                                tvLoraStatus.setTextColor(ContextCompat.getColor(this@MainActivity, R.color.safety_green))
                                findViewById<TextView>(R.id.tv_esp32_bridge_badge)?.apply {
                                    text = "CONNECTED (${dev.name})"
                                    setTextColor(ContextCompat.getColor(this@MainActivity, R.color.safety_green))
                                }
                                findViewById<TextView>(R.id.tv_esp32_bridge_desc)?.apply {
                                    text = "● Active Link: ${dev.name} (${dev.address}) • Ready for 433 MHz LoRa failover"
                                }
                                Toast.makeText(this@MainActivity, "✅ Connected to ${dev.name} via Bluetooth!", Toast.LENGTH_LONG).show()
                            } else {
                                Toast.makeText(this@MainActivity, "Could not connect to ${dev.name}. Check if ESP32 #1 is powered on.", Toast.LENGTH_SHORT).show()
                            }
                        }
                    }
                }
            }
            dialogView.addView(btnConnectBt)
        } else {
            dialogView.addView(TextView(this).apply { text = "No paired Bluetooth devices found.\nPlease pair your ESP32 ('BLACKNET_LORA_BRIDGE' or 'SHECURITY_LORA_BRIDGE') in Phone Settings first."; textSize = 12f; setTextColor(ContextCompat.getColor(this@MainActivity, R.color.caution_yellow)) })
        }

        val btnOpenBtSettings = MaterialButton(this).apply {
            text = "⚙️ Open Phone Bluetooth Settings (Pair ESP32)"
            textSize = 12f
            layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply { topMargin = 8 }
            setOnClickListener {
                startActivity(Intent(android.provider.Settings.ACTION_BLUETOOTH_SETTINGS))
            }
        }
        dialogView.addView(btnOpenBtSettings)

        val btnTestPacket = MaterialButton(this).apply {
            text = "Broadcast Test LoRa Packet (433MHz)"
            layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply { topMargin = 16 }
            setOnClickListener {
                lifecycleScope.launch {
                    val packet = com.shecurity.app.data.models.EmergencyPacket(
                        userId = "27",
                        latitude = trackingService?.userLocation?.value?.latitude ?: 28.6139,
                        longitude = trackingService?.userLocation?.value?.longitude ?: 77.2090,
                        riskScore = 94,
                        heartRate = BoultFitHeartRateService.heartRateBpmFlow.value,
                        battery = trackingService?.batteryPercentage?.value ?: 85,
                        movement = com.shecurity.app.data.models.MovementType.RUNNING,
                        isSos = true,
                        reason = "MANUAL LORA BLUETOOTH TEST PACKET"
                    )
                    val result = trackingService?.communicationManager?.loraTransport?.sendEmergencyData(packet)
                    Toast.makeText(this@MainActivity, "LoRa Tx: ${result?.message}", Toast.LENGTH_LONG).show()
                }
            }
        }
        dialogView.addView(btnTestPacket)

        val switchForceLora = Switch(this).apply {
            text = "Force LoRa Radio Fallback (Simulate Off-Grid)"
            isChecked = trackingService?.communicationManager?.activeTransportName == "LORA"
            textSize = 13f
            setTextColor(ContextCompat.getColor(this@MainActivity, R.color.white))
            setPadding(0, 16, 0, 0)
            setOnCheckedChangeListener { _, isChecked ->
                trackingService?.communicationManager?.simulateNetworkFailure(isChecked)
                Toast.makeText(this@MainActivity, if (isChecked) "LoRa Forced Active" else "Auto Failover Restored", Toast.LENGTH_SHORT).show()
            }
        }
        dialogView.addView(switchForceLora)

        AlertDialog.Builder(this)
            .setTitle("LoRa Radio Hardware Link (Bluetooth SPP)")
            .setView(dialogView)
            .setPositiveButton("Done", null)
            .show()
    }

    private fun showServerConfigDialog() {
        val prefs = getSharedPreferences("shecurity_prefs", Context.MODE_PRIVATE)
        var currentHost = prefs.getString("server_host", "192.168.1.100:3000") ?: "192.168.1.100:3000"
        if (currentHost.contains("192.168.1.101")) {
            currentHost = "192.168.1.100:3000"
            prefs.edit().putString("server_host", currentHost).apply()
        }

        val dialogView = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(50, 24, 50, 16)
        }

        val msgTv = TextView(this).apply {
            text = "Enter your Laptop Server Address:\n\n• Same Wi-Fi: 192.168.1.xxx:3000\n• Different Networks / Anywhere: https://xxx.trycloudflare.com (or public tunnel URL)"
            textSize = 13f
            setPadding(0, 0, 0, 16)
        }
        dialogView.addView(msgTv)

        val input = EditText(this).apply {
            setText(currentHost)
            hint = "e.g. 192.168.1.100:3000 or xxx.trycloudflare.com"
            setSelection(text.length)
        }
        dialogView.addView(input)

        val btnAutoDetect = MaterialButton(this).apply {
            text = "🔍 Auto-Detect on Local Wi-Fi"
            textSize = 12f
            setOnClickListener {
                text = "Scanning Local Subnet..."
                isEnabled = false
                lifecycleScope.launch {
                    val found = trackingService?.communicationManager?.internetTransport?.autoDiscoverServer()
                    if (found != null) {
                        input.setText(found)
                        prefs.edit().putString("server_host", found).apply()
                        Toast.makeText(this@MainActivity, "✅ Discovered Laptop at $found!", Toast.LENGTH_SHORT).show()
                    } else {
                        Toast.makeText(this@MainActivity, "Could not find laptop. Please check Wi-Fi or enter manually.", Toast.LENGTH_LONG).show()
                    }
                    text = "🔍 Auto-Detect on Local Wi-Fi"
                    isEnabled = true
                }
            }
        }
        dialogView.addView(btnAutoDetect)

        AlertDialog.Builder(this)
            .setTitle("Connect to Laptop Server")
            .setView(dialogView)
            .setPositiveButton("Connect") { _, _ ->
                val newHost = input.text.toString().trim()
                if (newHost.isNotEmpty()) {
                    prefs.edit().putString("server_host", newHost).apply()
                    trackingService?.communicationManager?.internetTransport?.setServerAddress(newHost)
                    Toast.makeText(this, "Connecting to $newHost...", Toast.LENGTH_SHORT).show()
                }
            }
            .setNegativeButton("Cancel", null)
            .show()
    }

    private fun applyAndDispatchSimulatedHr(bpm: Int, label: String) {
        BoultFitHeartRateService.setSimulatedHeartRate(bpm)
        Toast.makeText(this, label, Toast.LENGTH_SHORT).show()
        tvHeartRate.text = "$bpm BPM"
        lifecycleScope.launch(Dispatchers.IO) {
            val service = trackingService ?: TrackingService.instance
            service?.evaluateAndSync()
        }
    }

    private fun showHeartRateConfigDialog() {
        val isAccEnabled = BoultFitHeartRateService.isAccessibilityEnabled(this)
        val currentBpm = BoultFitHeartRateService.latestBpm

        val options = arrayOf(
            "⚙️ Open Accessibility Settings (Service: ${if (isAccEnabled) "ACTIVE ✅" else "INACTIVE ❌"})",
            "🚀 Launch GoBoult Fit App",
            "📉 Set Pulse: 30 BPM (Critical Bradycardia / Cardiac Collapse)",
            "💚 Set Pulse: 72 BPM (Normal Resting)",
            "⚡ Set Pulse: 115 BPM (Elevated Walking)",
            "⚠️ Set Pulse: 145 BPM (Panic Distress)",
            "🚨 Set Pulse: 230 BPM (Extreme Tachycardia / Acute Panic)"
        )

        AlertDialog.Builder(this)
            .setTitle("❤️ Heart Rate Setup (GoBoult Fit)")
            .setMessage("Current Heart Rate: $currentBpm BPM\nService Status: ${if (isAccEnabled) "Active & Reading Notifications/Screen" else "Accessibility Permission Required"}\n\nMake sure GoBoult Fit is installed and BLACKNET Accessibility Service is enabled.")
            .setItems(options) { _, which ->
                when (which) {
                    0 -> BoultFitHeartRateService.openAccessibilitySettings(this)
                    1 -> {
                        val launched = BoultFitHeartRateService.launchBoultFitApp(this)
                        if (!launched) {
                            Toast.makeText(this, "GoBoult Fit app not found. Please open it from your app drawer.", Toast.LENGTH_LONG).show()
                        }
                    }
                    2 -> applyAndDispatchSimulatedHr(30, "📉 Pulse set to 30 BPM (Critical Collapse)")
                    3 -> applyAndDispatchSimulatedHr(72, "💚 Pulse set to 72 BPM (Normal)")
                    4 -> applyAndDispatchSimulatedHr(115, "⚡ Pulse set to 115 BPM (Elevated)")
                    5 -> applyAndDispatchSimulatedHr(145, "⚠️ Pulse set to 145 BPM (Panic / Distress)")
                    6 -> applyAndDispatchSimulatedHr(230, "🚨 Pulse set to 230 BPM (Extreme Tachycardia)")
                }
            }
            .setPositiveButton("Close", null)
            .show()
    }

    private fun observeServiceTelemetry() {
        val service = trackingService ?: return

        lifecycleScope.launch {
            service.userLocation.collectLatest { loc ->
                runOnUiThread {
                    tvGpsStatus.text = String.format("%.4f, %.4f", loc.latitude, loc.longitude)
                }
            }
        }

        lifecycleScope.launch {
            service.currentRiskAssessment.collectLatest { assessment ->
                if (assessment != null) {
                    runOnUiThread { updateRiskUi(assessment.score, assessment.status, assessment.reasons) }
                }
            }
        }

        lifecycleScope.launch {
            BoultFitHeartRateService.heartRateBpmFlow.collectLatest { bpm ->
                runOnUiThread {
                    tvHeartRate.text = "$bpm BPM"
                    if (bpm > 120) {
                        tvHeartRate.setTextColor(ContextCompat.getColor(this@MainActivity, R.color.danger_red))
                    } else {
                        tvHeartRate.setTextColor(ContextCompat.getColor(this@MainActivity, R.color.safety_green))
                    }
                }
            }
        }

        val tvAccelDetails = findViewById<TextView>(R.id.tv_accelerometer_details)
        val tvSensorBadge = findViewById<TextView>(R.id.tv_sensor_active_badge)

        lifecycleScope.launch {
            while (isBound) {
                val mov = service.motionAnalyzer.currentMovement.name
                val isLive = service.motionAnalyzer.isLiveSensorActive
                val mag = service.motionAnalyzer.lastMagnitude
                val ax = service.motionAnalyzer.lastAx
                val ay = service.motionAnalyzer.lastAy
                val az = service.motionAnalyzer.lastAz
                runOnUiThread {
                    tvMotionStatus.text = mov.replace("_", " ")
                    val statusColor = when (service.motionAnalyzer.currentMovement) {
                        MovementType.RUNNING -> R.color.caution_yellow
                        MovementType.SUDDEN_MOVEMENT_OR_FALL -> R.color.danger_red
                        MovementType.WALKING -> R.color.safety_green
                        MovementType.STATIONARY -> R.color.text_primary
                    }
                    tvMotionStatus.setTextColor(ContextCompat.getColor(this@MainActivity, statusColor))
                    tvAccelDetails?.text = if (isLive) {
                        "📱 Accelerometer: ${String.format("%.2f", mag)} m/s² (X:${String.format("%.1f", ax)} Y:${String.format("%.1f", ay)} Z:${String.format("%.1f", az)})"
                    } else {
                        "📱 Motion Simulation: ${mov.replace("_", " ")} (Override Active)"
                    }
                    tvSensorBadge?.text = if (isLive) "● HARDWARE SENSOR LIVE" else "● OVERRIDE ACTIVE"
                    tvSensorBadge?.setTextColor(ContextCompat.getColor(this@MainActivity, if (isLive) R.color.safety_green else R.color.caution_yellow))
                }
                kotlinx.coroutines.delay(600)
            }
        }

        service.communicationManager.internetTransport.onConnectionStateChanged = { connected ->
            val host = service.communicationManager.internetTransport.serverHost
            runOnUiThread {
                if (connected) {
                    tvNetworkStatus.text = "LIVE SYNC ($host)"
                    tvNetworkStatus.setTextColor(ContextCompat.getColor(this, R.color.safety_green))
                } else {
                    tvNetworkStatus.text = "Connecting ($host)..."
                    tvNetworkStatus.setTextColor(ContextCompat.getColor(this, R.color.caution_yellow))
                }
            }
        }

        service.communicationManager.onTransportChanged = { transport ->
            val host = service.communicationManager.internetTransport.serverHost
            runOnUiThread {
                if (transport.contains("LORA")) {
                    tvLoraStatus.text = "ACTIVE (433MHz)"
                    tvLoraStatus.setTextColor(ContextCompat.getColor(this, R.color.safety_green))
                    tvNetworkStatus.text = "OFFLINE (LoRa Fallback)"
                    tvNetworkStatus.setTextColor(ContextCompat.getColor(this, R.color.caution_yellow))
                } else if (transport.contains("WI-FI")) {
                    tvLoraStatus.text = "Standby (Ready)"
                    tvLoraStatus.setTextColor(ContextCompat.getColor(this, R.color.caution_yellow))
                    tvNetworkStatus.text = "LIVE SYNC ($host)"
                    tvNetworkStatus.setTextColor(ContextCompat.getColor(this, R.color.safety_green))
                } else {
                    tvLoraStatus.text = "Standby"
                    tvLoraStatus.setTextColor(ContextCompat.getColor(this, R.color.caution_yellow))
                }
            }
        }
    }

    private fun updateRiskUi(score: Int, status: SafetyStatus, reasons: List<String>) {
        val service = trackingService ?: TrackingService.instance
        val isLocked = isEmergencyActive || service?.isEmergencyLocked == true || service?.riskEngine?.isEmergencyLocked == true

        if (isLocked) {
            btnSos.text = "🚨 SOS ACTIVE"
            btnSos.setBackgroundColor(ContextCompat.getColor(this, R.color.danger_red))
            btnCancelEmergency.visibility = View.VISIBLE
            tvRiskScore.text = "Risk Score: 98 / 100"
            progressRisk.progress = 98
            tvStatusTitle.text = "EMERGENCY"
            val dangerColor = ContextCompat.getColor(this, R.color.danger_red)
            cardSafetyStatus.strokeColor = dangerColor
            tvStatusTitle.setTextColor(dangerColor)
            progressRisk.setIndicatorColor(dangerColor)
            tvExplainableReasons.text = "🚨 EMERGENCY SOS PERMANENTLY LOCKED ACTIVE • Broadcasting Live"
            return
        }

        tvRiskScore.text = "Risk Score: $score / 100"
        progressRisk.progress = score
        tvStatusTitle.text = status.name

        val color = when (status) {
            SafetyStatus.SAFE -> ContextCompat.getColor(this, R.color.safety_green)
            SafetyStatus.CAUTION -> ContextCompat.getColor(this, R.color.caution_yellow)
            SafetyStatus.HIGH_RISK -> ContextCompat.getColor(this, R.color.risk_orange)
            SafetyStatus.EMERGENCY -> ContextCompat.getColor(this, R.color.danger_red)
        }

        cardSafetyStatus.strokeColor = color
        tvStatusTitle.setTextColor(color)
        progressRisk.setIndicatorColor(color)

        tvExplainableReasons.text = reasons.take(2).joinToString(" • ")
    }

    private fun showDiscreetSafeCheck() {
        val dialog = DuressDialog(this, this) { isDuress ->
            if (isDuress) {
                trackingService?.resolveSafetyCheck("DURESS")
            } else {
                trackingService?.resolveSafetyCheck("SAFE")
            }
        }
        dialog.show()
    }

    private fun startAndBindTrackingService() {
        val intent = Intent(this, TrackingService::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(intent)
        } else {
            startService(intent)
        }
        bindService(intent, serviceConnection, Context.BIND_AUTO_CREATE)
    }

    private fun requestSystemPermissions() {
        val permissions = mutableListOf(
            Manifest.permission.ACCESS_FINE_LOCATION,
            Manifest.permission.ACCESS_COARSE_LOCATION
        )
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            permissions.add(Manifest.permission.BLUETOOTH_CONNECT)
            permissions.add(Manifest.permission.BLUETOOTH_SCAN)
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            permissions.add(Manifest.permission.POST_NOTIFICATIONS)
        }

        val ungranted = permissions.filter {
            ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED
        }

        if (ungranted.isNotEmpty()) {
            ActivityCompat.requestPermissions(this, ungranted.toTypedArray(), 101)
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        if (isBound) {
            unbindService(serviceConnection)
            isBound = false
        }
    }
}
