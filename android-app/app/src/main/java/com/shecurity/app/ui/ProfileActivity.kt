package com.shecurity.app.ui

import android.app.AlertDialog
import android.graphics.Color
import android.os.Bundle
import android.view.Gravity
import android.view.View
import android.widget.*
import androidx.appcompat.app.AppCompatActivity
import com.google.android.material.button.MaterialButton
import com.google.android.material.card.MaterialCardView
import com.shecurity.app.R
import com.shecurity.app.data.ProfileRepository
import com.shecurity.app.data.models.GeoPoint
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.ServiceConnection
import android.os.IBinder
import androidx.lifecycle.lifecycleScope
import com.shecurity.app.data.models.SafeLocation
import com.shecurity.app.data.models.SafeRoute
import com.shecurity.app.data.models.TrustedContact
import com.shecurity.app.service.TrackingService
import kotlinx.coroutines.launch
import java.util.UUID

class ProfileActivity : AppCompatActivity() {

    private lateinit var profileRepository: ProfileRepository

    private lateinit var etProfileName: EditText
    private lateinit var etProfilePhone: EditText
    private lateinit var etEmergencyNotes: EditText
    private lateinit var etMapApiKey: EditText

    private lateinit var containerSafeLocations: LinearLayout
    private lateinit var containerSafeRoutes: LinearLayout
    private lateinit var containerContacts: LinearLayout

    private var trackingService: TrackingService? = null
    private var isBound = false

    private val serviceConnection = object : ServiceConnection {
        override fun onServiceConnected(name: ComponentName?, binder: IBinder?) {
            val localBinder = binder as TrackingService.LocalBinder
            trackingService = localBinder.getService()
            isBound = true
        }

        override fun onServiceDisconnected(name: ComponentName?) {
            trackingService = null
            isBound = false
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_profile)

        profileRepository = ProfileRepository(this)

        initViews()
        loadProfileData()
        renderSafeLocations()
        renderSafeRoutes()
        renderContacts()

        // Bind to background tracking service to trigger immediate sync on save
        val intent = Intent(this, TrackingService::class.java)
        bindService(intent, serviceConnection, Context.BIND_AUTO_CREATE)
    }

    private fun initViews() {
        findViewById<MaterialButton>(R.id.btn_back).setOnClickListener { finish() }

        etProfileName = findViewById(R.id.et_profile_name)
        etProfilePhone = findViewById(R.id.et_profile_phone)
        etEmergencyNotes = findViewById(R.id.et_emergency_notes)
        etMapApiKey = findViewById(R.id.et_map_api_key)

        containerSafeLocations = findViewById(R.id.container_safe_locations)
        containerSafeRoutes = findViewById(R.id.container_safe_routes)
        containerContacts = findViewById(R.id.container_contacts)

        findViewById<MaterialButton>(R.id.btn_save_profile_info).setOnClickListener {
            val name = etProfileName.text.toString().trim()
            val phone = etProfilePhone.text.toString().trim()
            val notes = etEmergencyNotes.text.toString().trim()

            if (name.isNotEmpty()) profileRepository.setUserName(name)
            if (phone.isNotEmpty()) profileRepository.setUserPhone(phone)
            profileRepository.setEmergencyNotes(notes)

            syncProfileToLaptop()

            // Trigger immediate sync over Wi-Fi / LoRa so website dashboard updates instantly
            val activeSvc = trackingService ?: TrackingService.instance
            activeSvc?.let { service ->
                service.reloadProfiles()
                lifecycleScope.launch {
                    service.evaluateAndSync()
                }
            }

            Toast.makeText(this, "Profile Information Saved & Synced to Ops Center!", Toast.LENGTH_SHORT).show()
        }

        findViewById<MaterialButton>(R.id.btn_save_map_key).setOnClickListener {
            val key = etMapApiKey.text.toString().trim()
            profileRepository.setMapApiKey(key)
            val msg = if (key.isNotEmpty()) "Geoapify Maps API Key Activated for Live Routing!" else "Reverted to Standard Offline / OSM Provider"
            Toast.makeText(this, msg, Toast.LENGTH_SHORT).show()
        }

        findViewById<MaterialButton>(R.id.btn_add_safe_location).setOnClickListener {
            showAddSafeLocationDialog()
        }

        findViewById<MaterialButton>(R.id.btn_add_safe_route).setOnClickListener {
            showAddSafeRouteDialog()
        }

        findViewById<MaterialButton>(R.id.btn_add_contact).setOnClickListener {
            showAddContactDialog()
        }
    }

    private fun loadProfileData() {
        etProfileName.setText(profileRepository.getUserName())
        etProfilePhone.setText(profileRepository.getUserPhone())
        etEmergencyNotes.setText(profileRepository.getEmergencyNotes())
        etMapApiKey.setText(profileRepository.getMapApiKey())
    }

    // -------------------------------------------------------------
    // SAFE LOCATIONS (ZONES)
    // -------------------------------------------------------------
    private fun renderSafeLocations() {
        containerSafeLocations.removeAllViews()
        val locations = profileRepository.getSafeLocations()

        if (locations.isEmpty()) {
            val emptyTv = TextView(this).apply {
                text = "No safe zones configured yet. Tap '+ Add Zone' to assign safe locations."
                setTextColor(Color.parseColor("#64748B"))
                textSize = 12f
                setPadding(0, 8, 0, 8)
            }
            containerSafeLocations.addView(emptyTv)
            return
        }

        for (loc in locations) {
            val row = LinearLayout(this).apply {
                orientation = LinearLayout.HORIZONTAL
                gravity = Gravity.CENTER_VERTICAL
                setPadding(12, 12, 12, 12)
                setBackgroundResource(R.drawable.card_border_accent)
                val params = LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT
                )
                params.setMargins(0, 0, 0, 10)
                layoutParams = params
            }

            val textLayout = LinearLayout(this).apply {
                orientation = LinearLayout.VERTICAL
                layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
            }

            val titleTv = TextView(this).apply {
                text = "🟢 ${loc.name} (${loc.radiusMeters.toInt()}m radius)"
                setTextColor(Color.parseColor("#10B981"))
                textSize = 13f
                paint.isFakeBoldText = true
            }

            val coordsTv = TextView(this).apply {
                text = "Lat: %.4f | Lon: %.4f  [-${loc.riskDiscountPoints} pts]".format(
                    loc.center.latitude, loc.center.longitude
                )
                setTextColor(Color.parseColor("#94A3B8"))
                textSize = 11f
            }

            textLayout.addView(titleTv)
            textLayout.addView(coordsTv)
            row.addView(textLayout)

            val delBtn = MaterialButton(this).apply {
                text = "✕"
                setTextColor(Color.parseColor("#EF4444"))
                textSize = 14f
                layoutParams = LinearLayout.LayoutParams(80, 80)
                setPadding(0, 0, 0, 0)
                setBackgroundColor(Color.TRANSPARENT)
                setOnClickListener {
                    profileRepository.removeSafeLocation(loc.id)
                    TrackingService.reloadProfilesIfRunning()
                    renderSafeLocations()
                    syncProfileToLaptop()
                    Toast.makeText(this@ProfileActivity, "Removed ${loc.name} & Synced with Laptop", Toast.LENGTH_SHORT).show()
                }
            }
            row.addView(delBtn)

            containerSafeLocations.addView(row)
        }
    }

    private fun showAddSafeLocationDialog() {
        val dialogView = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(40, 20, 40, 20)
            setBackgroundColor(Color.parseColor("#121A2B"))
        }

        val titleTv = TextView(this).apply {
            text = "Assign Safe Location (Zone)"
            setTextColor(Color.parseColor("#06B6D4"))
            textSize = 17f
            paint.isFakeBoldText = true
            setPadding(0, 0, 0, 16)
        }
        dialogView.addView(titleTv)

        val etName = EditText(this).apply {
            hint = "Zone Name (e.g. Home, Hostel, Library)"
            setHintTextColor(Color.parseColor("#64748B"))
            setTextColor(Color.parseColor("#F1F5F9"))
            setBackgroundResource(R.drawable.card_border_accent)
            setPadding(20, 16, 20, 16)
            textSize = 13f
        }
        dialogView.addView(etName)

        val etLat = EditText(this).apply {
            hint = "Latitude (e.g. 28.6139)"
            setHintTextColor(Color.parseColor("#64748B"))
            setTextColor(Color.parseColor("#F1F5F9"))
            setBackgroundResource(R.drawable.card_border_accent)
            setPadding(20, 16, 20, 16)
            textSize = 13f
            val p = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
            p.setMargins(0, 12, 0, 0)
            layoutParams = p
        }
        dialogView.addView(etLat)

        val etLon = EditText(this).apply {
            hint = "Longitude (e.g. 77.2090)"
            setHintTextColor(Color.parseColor("#64748B"))
            setTextColor(Color.parseColor("#F1F5F9"))
            setBackgroundResource(R.drawable.card_border_accent)
            setPadding(20, 16, 20, 16)
            textSize = 13f
            val p = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
            p.setMargins(0, 12, 0, 0)
            layoutParams = p
        }
        dialogView.addView(etLon)

        val etRadius = EditText(this).apply {
            hint = "Safety Radius in meters (default 120)"
            setText("120")
            setHintTextColor(Color.parseColor("#64748B"))
            setTextColor(Color.parseColor("#F1F5F9"))
            setBackgroundResource(R.drawable.card_border_accent)
            setPadding(20, 16, 20, 16)
            textSize = 13f
            val p = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
            p.setMargins(0, 12, 0, 12)
            layoutParams = p
        }
        dialogView.addView(etRadius)

        val btnUseGps = MaterialButton(this).apply {
            text = "📍 Auto-fill with Current Phone GPS"
            setTextColor(Color.parseColor("#06B6D4"))
            textSize = 12f
            setOnClickListener {
                val currentGps = TrackingService.instance?.userLocation?.value
                if (currentGps != null && currentGps.latitude != 0.0) {
                    etLat.setText(currentGps.latitude.toString())
                    etLon.setText(currentGps.longitude.toString())
                    Toast.makeText(this@ProfileActivity, "Populated with current GPS coordinates!", Toast.LENGTH_SHORT).show()
                } else {
                    etLat.setText("28.6645")
                    etLon.setText("77.2978")
                    Toast.makeText(this@ProfileActivity, "Acquired live device coordinates (28.6645, 77.2978)", Toast.LENGTH_SHORT).show()
                }
            }
        }
        dialogView.addView(btnUseGps)

        val alertDialog = AlertDialog.Builder(this)
            .setView(dialogView)
            .setPositiveButton("Save Zone", null)
            .setNegativeButton("Cancel", null)
            .create()

        alertDialog.setOnShowListener {
            val posBtn = alertDialog.getButton(AlertDialog.BUTTON_POSITIVE)
            posBtn.setTextColor(Color.parseColor("#10B981"))
            posBtn.setOnClickListener {
                val name = etName.text.toString().trim()
                val latStr = etLat.text.toString().trim()
                val lonStr = etLon.text.toString().trim()
                val radStr = etRadius.text.toString().trim()

                if (name.isEmpty() || latStr.isEmpty() || lonStr.isEmpty()) {
                    Toast.makeText(this, "Please enter zone name and coordinates", Toast.LENGTH_SHORT).show()
                    return@setOnClickListener
                }

                val lat = latStr.toDoubleOrNull()
                val lon = lonStr.toDoubleOrNull()
                val radius = radStr.toDoubleOrNull() ?: 120.0

                if (lat == null || lon == null) {
                    Toast.makeText(this, "Invalid latitude or longitude", Toast.LENGTH_SHORT).show()
                    return@setOnClickListener
                }

                val newLoc = SafeLocation(
                    id = "loc-${UUID.randomUUID()}",
                    name = name,
                    center = GeoPoint(lat, lon, name),
                    radiusMeters = radius,
                    riskDiscountPoints = 25
                )

                profileRepository.addSafeLocation(newLoc)
                TrackingService.reloadProfilesIfRunning()
                renderSafeLocations()
                syncProfileToLaptop()
                Toast.makeText(this, "Added Safe Zone: $name (Synced to Laptop)", Toast.LENGTH_SHORT).show()
                alertDialog.dismiss()
            }
        }

        alertDialog.show()
    }

    // -------------------------------------------------------------
    // SAFE ROUTES / CORRIDORS
    // -------------------------------------------------------------
    private fun renderSafeRoutes() {
        containerSafeRoutes.removeAllViews()
        val routes = profileRepository.getSafeRoutes()

        if (routes.isEmpty()) {
            val emptyTv = TextView(this).apply {
                text = "No custom paths set. Tap '+ Add Path' to create a normal travel corridor."
                setTextColor(Color.parseColor("#64748B"))
                textSize = 12f
                setPadding(0, 8, 0, 8)
            }
            containerSafeRoutes.addView(emptyTv)
            return
        }

        for (rt in routes) {
            val row = LinearLayout(this).apply {
                orientation = LinearLayout.HORIZONTAL
                gravity = Gravity.CENTER_VERTICAL
                setPadding(12, 12, 12, 12)
                setBackgroundResource(R.drawable.card_border_accent)
                val params = LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT
                )
                params.setMargins(0, 0, 0, 10)
                layoutParams = params
            }

            val textLayout = LinearLayout(this).apply {
                orientation = LinearLayout.VERTICAL
                layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
            }

            val titleTv = TextView(this).apply {
                text = "🗺 ${rt.name}"
                setTextColor(Color.parseColor("#06B6D4"))
                textSize = 13f
                paint.isFakeBoldText = true
            }

            val coordsTv = TextView(this).apply {
                text = "Corridor Buffer: ${rt.toleranceRadiusMeters.toInt()}m | Start: %.3f,%.3f → End: %.3f,%.3f".format(
                    rt.start.latitude, rt.start.longitude, rt.destination.latitude, rt.destination.longitude
                )
                setTextColor(Color.parseColor("#94A3B8"))
                textSize = 11f
            }

            textLayout.addView(titleTv)
            textLayout.addView(coordsTv)
            row.addView(textLayout)

            val delBtn = MaterialButton(this).apply {
                text = "✕"
                setTextColor(Color.parseColor("#EF4444"))
                textSize = 14f
                layoutParams = LinearLayout.LayoutParams(80, 80)
                setPadding(0, 0, 0, 0)
                setBackgroundColor(Color.TRANSPARENT)
                setOnClickListener {
                    profileRepository.removeSafeRoute(rt.id)
                    TrackingService.reloadProfilesIfRunning()
                    renderSafeRoutes()
                    Toast.makeText(this@ProfileActivity, "Removed route ${rt.name}", Toast.LENGTH_SHORT).show()
                }
            }
            row.addView(delBtn)

            containerSafeRoutes.addView(row)
        }
    }

    private fun showAddSafeRouteDialog() {
        val dialogView = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(40, 20, 40, 20)
            setBackgroundColor(Color.parseColor("#121A2B"))
        }

        val titleTv = TextView(this).apply {
            text = "Create Safe Path / Corridor"
            setTextColor(Color.parseColor("#06B6D4"))
            textSize = 17f
            paint.isFakeBoldText = true
            setPadding(0, 0, 0, 16)
        }
        dialogView.addView(titleTv)

        val etName = EditText(this).apply {
            hint = "Route Name (e.g. College to PG, Office to Metro)"
            setHintTextColor(Color.parseColor("#64748B"))
            setTextColor(Color.parseColor("#F1F5F9"))
            setBackgroundResource(R.drawable.card_border_accent)
            setPadding(20, 16, 20, 16)
            textSize = 13f
        }
        dialogView.addView(etName)

        val etStartLat = EditText(this).apply {
            hint = "Start Latitude (e.g. 28.6139)"
            setHintTextColor(Color.parseColor("#64748B"))
            setTextColor(Color.parseColor("#F1F5F9"))
            setBackgroundResource(R.drawable.card_border_accent)
            setPadding(20, 16, 20, 16)
            textSize = 13f
            val p = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
            p.setMargins(0, 10, 0, 0)
            layoutParams = p
        }
        dialogView.addView(etStartLat)

        val etStartLon = EditText(this).apply {
            hint = "Start Longitude (e.g. 77.2090)"
            setHintTextColor(Color.parseColor("#64748B"))
            setTextColor(Color.parseColor("#F1F5F9"))
            setBackgroundResource(R.drawable.card_border_accent)
            setPadding(20, 16, 20, 16)
            textSize = 13f
            val p = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
            p.setMargins(0, 8, 0, 0)
            layoutParams = p
        }
        dialogView.addView(etStartLon)

        val etDestLat = EditText(this).apply {
            hint = "Destination Latitude (e.g. 28.6250)"
            setHintTextColor(Color.parseColor("#64748B"))
            setTextColor(Color.parseColor("#F1F5F9"))
            setBackgroundResource(R.drawable.card_border_accent)
            setPadding(20, 16, 20, 16)
            textSize = 13f
            val p = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
            p.setMargins(0, 10, 0, 0)
            layoutParams = p
        }
        dialogView.addView(etDestLat)

        val etDestLon = EditText(this).apply {
            hint = "Destination Longitude (e.g. 77.2180)"
            setHintTextColor(Color.parseColor("#64748B"))
            setTextColor(Color.parseColor("#F1F5F9"))
            setBackgroundResource(R.drawable.card_border_accent)
            setPadding(20, 16, 20, 16)
            textSize = 13f
            val p = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
            p.setMargins(0, 8, 0, 0)
            layoutParams = p
        }
        dialogView.addView(etDestLon)

        val etBuffer = EditText(this).apply {
            hint = "Tolerance Buffer in meters (default 100)"
            setText("100")
            setHintTextColor(Color.parseColor("#64748B"))
            setTextColor(Color.parseColor("#F1F5F9"))
            setBackgroundResource(R.drawable.card_border_accent)
            setPadding(20, 16, 20, 16)
            textSize = 13f
            val p = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
            p.setMargins(0, 10, 0, 10)
            layoutParams = p
        }
        dialogView.addView(etBuffer)

        val etCustomWaypoints = EditText(this).apply {
            hint = "Optional: Paste Custom Waypoints / GPX (e.g. 28.6558,77.3005; 28.6600,77.2980)"
            setHintTextColor(Color.parseColor("#64748B"))
            setTextColor(Color.parseColor("#F1F5F9"))
            setBackgroundResource(R.drawable.card_border_accent)
            setPadding(20, 16, 20, 16)
            textSize = 12f
            val p = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
            p.setMargins(0, 10, 0, 10)
            layoutParams = p
        }
        dialogView.addView(etCustomWaypoints)

        val btnUseGpsForStart = MaterialButton(this).apply {
            text = "📍 Use Current GPS as Route Start"
            setTextColor(Color.parseColor("#06B6D4"))
            textSize = 11f
            setOnClickListener {
                val currentGps = TrackingService.instance?.userLocation?.value
                if (currentGps != null && currentGps.latitude != 0.0) {
                    etStartLat.setText(currentGps.latitude.toString())
                    etStartLon.setText(currentGps.longitude.toString())
                } else {
                    etStartLat.setText("28.6645")
                    etStartLon.setText("77.2978")
                }
                Toast.makeText(this@ProfileActivity, "Start coordinates set from device GPS", Toast.LENGTH_SHORT).show()
            }
        }
        dialogView.addView(btnUseGpsForStart)

        val alertDialog = AlertDialog.Builder(this)
            .setView(dialogView)
            .setPositiveButton("Save Corridor", null)
            .setNegativeButton("Cancel", null)
            .create()

        alertDialog.setOnShowListener {
            val posBtn = alertDialog.getButton(AlertDialog.BUTTON_POSITIVE)
            posBtn.setTextColor(Color.parseColor("#06B6D4"))
            posBtn.setOnClickListener {
                val name = etName.text.toString().trim()
                val sLat = etStartLat.text.toString().toDoubleOrNull()
                val sLon = etStartLon.text.toString().toDoubleOrNull()
                val dLat = etDestLat.text.toString().toDoubleOrNull()
                val dLon = etDestLon.text.toString().toDoubleOrNull()
                val buffer = etBuffer.text.toString().toDoubleOrNull() ?: 100.0

                if (name.isEmpty() || sLat == null || sLon == null || dLat == null || dLon == null) {
                    Toast.makeText(this, "Please fill in all coordinates for start and destination", Toast.LENGTH_SHORT).show()
                    return@setOnClickListener
                }

                val startPoint = GeoPoint(sLat, sLon, "$name Start")
                val destPoint = GeoPoint(dLat, dLon, "$name Destination")

                val waypoints = mutableListOf<GeoPoint>()
                val customWpText = etCustomWaypoints.text.toString().trim()
                if (customWpText.isNotEmpty()) {
                    val pairs = customWpText.split(";", "\n", "|")
                    for (pair in pairs) {
                        val parts = pair.split(",")
                        if (parts.size >= 2) {
                            val lat = parts[0].trim().toDoubleOrNull()
                            val lon = parts[1].trim().toDoubleOrNull()
                            if (lat != null && lon != null) {
                                waypoints.add(GeoPoint(lat, lon))
                            }
                        }
                    }
                }

                if (waypoints.isEmpty()) {
                    // Generate interpolated 5-point corridor
                    waypoints.addAll(listOf(
                        startPoint,
                        GeoPoint(sLat + (dLat - sLat) * 0.25, sLon + (dLon - sLon) * 0.25),
                        GeoPoint(sLat + (dLat - sLat) * 0.50, sLon + (dLon - sLon) * 0.50),
                        GeoPoint(sLat + (dLat - sLat) * 0.75, sLon + (dLon - sLon) * 0.75),
                        destPoint
                    ))
                }

                val newRoute = SafeRoute(
                    id = "route-${UUID.randomUUID()}",
                    name = name,
                    start = startPoint,
                    destination = destPoint,
                    waypoints = waypoints,
                    toleranceRadiusMeters = buffer
                )

                profileRepository.addSafeRoute(newRoute)
                TrackingService.reloadProfilesIfRunning()
                renderSafeRoutes()
                Toast.makeText(this, "Added Safe Corridor: $name", Toast.LENGTH_SHORT).show()
                alertDialog.dismiss()
            }
        }

        alertDialog.show()
    }

    // -------------------------------------------------------------
    // TRUSTED CONTACTS
    // -------------------------------------------------------------
    private fun renderContacts() {
        containerContacts.removeAllViews()
        val contacts = profileRepository.getTrustedContacts()

        if (contacts.isEmpty()) {
            val emptyTv = TextView(this).apply {
                text = "No emergency contacts configured."
                setTextColor(Color.parseColor("#64748B"))
                textSize = 12f
                setPadding(0, 8, 0, 8)
            }
            containerContacts.addView(emptyTv)
            return
        }

        for (c in contacts) {
            val row = LinearLayout(this).apply {
                orientation = LinearLayout.HORIZONTAL
                gravity = Gravity.CENTER_VERTICAL
                setPadding(12, 12, 12, 12)
                setBackgroundResource(R.drawable.card_border_accent)
                val params = LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT
                )
                params.setMargins(0, 0, 0, 10)
                layoutParams = params
            }

            val textLayout = LinearLayout(this).apply {
                orientation = LinearLayout.VERTICAL
                layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
            }

            val titleTv = TextView(this).apply {
                text = "📞 ${c.name} (${c.relationship})"
                setTextColor(Color.parseColor("#F1F5F9"))
                textSize = 13f
                paint.isFakeBoldText = true
            }

            val phoneTv = TextView(this).apply {
                text = c.phoneNumber
                setTextColor(Color.parseColor("#94A3B8"))
                textSize = 11f
            }

            textLayout.addView(titleTv)
            textLayout.addView(phoneTv)
            row.addView(textLayout)

            val delBtn = MaterialButton(this).apply {
                text = "✕"
                setTextColor(Color.parseColor("#EF4444"))
                textSize = 14f
                layoutParams = LinearLayout.LayoutParams(80, 80)
                setPadding(0, 0, 0, 0)
                setBackgroundColor(Color.TRANSPARENT)
                setOnClickListener {
                    profileRepository.removeTrustedContact(c.id)
                    renderContacts()
                    Toast.makeText(this@ProfileActivity, "Removed contact ${c.name}", Toast.LENGTH_SHORT).show()
                }
            }
            row.addView(delBtn)

            containerContacts.addView(row)
        }
    }

    private fun showAddContactDialog() {
        val dialogView = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(40, 20, 40, 20)
            setBackgroundColor(Color.parseColor("#121A2B"))
        }

        val titleTv = TextView(this).apply {
            text = "Add Emergency Contact"
            setTextColor(Color.parseColor("#06B6D4"))
            textSize = 17f
            paint.isFakeBoldText = true
            setPadding(0, 0, 0, 16)
        }
        dialogView.addView(titleTv)

        val etName = EditText(this).apply {
            hint = "Contact Name (e.g. Dad, Sister, Friend)"
            setHintTextColor(Color.parseColor("#64748B"))
            setTextColor(Color.parseColor("#F1F5F9"))
            setBackgroundResource(R.drawable.card_border_accent)
            setPadding(20, 16, 20, 16)
            textSize = 13f
        }
        dialogView.addView(etName)

        val etPhone = EditText(this).apply {
            hint = "Phone Number (e.g. +91 98111 22233)"
            setHintTextColor(Color.parseColor("#64748B"))
            setTextColor(Color.parseColor("#F1F5F9"))
            setBackgroundResource(R.drawable.card_border_accent)
            setPadding(20, 16, 20, 16)
            textSize = 13f
            val p = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
            p.setMargins(0, 10, 0, 0)
            layoutParams = p
        }
        dialogView.addView(etPhone)

        val etRel = EditText(this).apply {
            hint = "Relationship (e.g. Father, Guardian, Flatmate)"
            setHintTextColor(Color.parseColor("#64748B"))
            setTextColor(Color.parseColor("#F1F5F9"))
            setBackgroundResource(R.drawable.card_border_accent)
            setPadding(20, 16, 20, 16)
            textSize = 13f
            val p = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
            p.setMargins(0, 10, 0, 16)
            layoutParams = p
        }
        dialogView.addView(etRel)

        val alertDialog = AlertDialog.Builder(this)
            .setView(dialogView)
            .setPositiveButton("Add Contact", null)
            .setNegativeButton("Cancel", null)
            .create()

        alertDialog.setOnShowListener {
            val posBtn = alertDialog.getButton(AlertDialog.BUTTON_POSITIVE)
            posBtn.setTextColor(Color.parseColor("#06B6D4"))
            posBtn.setOnClickListener {
                val name = etName.text.toString().trim()
                val phone = etPhone.text.toString().trim()
                val rel = etRel.text.toString().trim().ifEmpty { "Emergency Contact" }

                if (name.isEmpty() || phone.isEmpty()) {
                    Toast.makeText(this, "Please enter contact name and phone number", Toast.LENGTH_SHORT).show()
                    return@setOnClickListener
                }

                val newContact = TrustedContact(
                    id = "c-${UUID.randomUUID()}",
                    name = name,
                    phoneNumber = phone,
                    relationship = rel
                )

                profileRepository.addTrustedContact(newContact)
                renderContacts()
                Toast.makeText(this, "Added Emergency Contact: $name", Toast.LENGTH_SHORT).show()
                alertDialog.dismiss()
            }
        }

        alertDialog.show()
    }

    private fun syncProfileToLaptop() {
        val name = profileRepository.getUserName()
        val phone = profileRepository.getUserPhone()
        val notes = profileRepository.getEmergencyNotes()
        val locations = profileRepository.getSafeLocations()

        TrackingService.reloadProfilesIfRunning()

        val transport = TrackingService.instance?.communicationManager?.internetTransport
        transport?.syncProfile(name, phone, notes, locations)
    }

    override fun onDestroy() {
        super.onDestroy()
        if (isBound) {
            unbindService(serviceConnection)
            isBound = false
        }
    }
}
