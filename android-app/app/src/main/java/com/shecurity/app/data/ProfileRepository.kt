package com.shecurity.app.data

import android.content.Context
import android.content.SharedPreferences
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import com.shecurity.app.data.models.GeoPoint
import com.shecurity.app.data.models.SafeLocation
import com.shecurity.app.data.models.SafeRoute
import com.shecurity.app.data.models.TrustedContact

class ProfileRepository(context: Context) {

    private val prefs: SharedPreferences = context.getSharedPreferences("shecurity_profile_prefs", Context.MODE_PRIVATE)
    private val gson = Gson()

    fun getUserName(): String = prefs.getString("user_name", "Aditi Sharma") ?: "Aditi Sharma"
    fun setUserName(name: String) = prefs.edit().putString("user_name", name).commit()

    fun getUserPhone(): String = prefs.getString("user_phone", "+91 98765 43210") ?: "+91 98765 43210"
    fun setUserPhone(phone: String) = prefs.edit().putString("user_phone", phone).commit()

    fun getEmergencyNotes(): String = prefs.getString("emergency_notes", "Blood Type: B+, Allergic to Penicillin") ?: ""
    fun setEmergencyNotes(notes: String) = prefs.edit().putString("emergency_notes", notes).commit()

    fun getMapApiKey(): String = prefs.getString("map_api_key", "7c3cf4451a1e4c848898cb5ce57dbee9") ?: "7c3cf4451a1e4c848898cb5ce57dbee9"
    fun setMapApiKey(key: String) = prefs.edit().putString("map_api_key", key.ifBlank { "7c3cf4451a1e4c848898cb5ce57dbee9" }).apply()

    fun getGeoapifyTileUrl(style: String = "dark-matter-dark-purple"): String {
        return "https://maps.geoapify.com/v1/tile/$style/{z}/{x}/{y}.png?apiKey=${getMapApiKey()}"
    }

    fun getStaticMapUrl(lat: Double, lon: Double, zoom: Int = 15, width: Int = 600, height: Int = 400): String {
        val key = getMapApiKey()
        return "https://maps.geoapify.com/v1/staticmap?style=dark-matter-dark-purple&width=$width&height=$height&center=lonlat:$lon,$lat&zoom=$zoom&marker=lonlat:$lon,$lat;color:%23ef4444;size:medium&apiKey=$key"
    }

    fun getSafeLocations(): MutableList<SafeLocation> {
        val json = prefs.getString("safe_locations_json", null)
        if (json != null) {
            val type = object : TypeToken<MutableList<SafeLocation>>() {}.type
            return gson.fromJson(json, type)
        }
        // Defaults
        return mutableListOf(
            SafeLocation("loc-1", "Girls Hostel Complex", GeoPoint(28.6250, 77.2180), 120.0, 25),
            SafeLocation("loc-2", "University Campus", GeoPoint(28.6139, 77.2090), 200.0, 25),
            SafeLocation("loc-3", "Police Assistance Booth", GeoPoint(28.6185, 77.2135), 80.0, 20)
        )
    }

    fun saveSafeLocations(locations: List<SafeLocation>) {
        val json = gson.toJson(locations)
        prefs.edit().putString("safe_locations_json", json).apply()
    }

    fun addSafeLocation(location: SafeLocation) {
        val list = getSafeLocations()
        list.add(location)
        saveSafeLocations(list)
    }

    fun removeSafeLocation(id: String) {
        val list = getSafeLocations().filterNot { it.id == id }
        saveSafeLocations(list)
    }

    fun getSafeRoutes(): MutableList<SafeRoute> {
        val json = prefs.getString("safe_routes_json", null)
        if (json != null) {
            val type = object : TypeToken<MutableList<SafeRoute>>() {}.type
            return gson.fromJson(json, type)
        }
        // Default safe route
        return mutableListOf(
            SafeRoute(
                id = "route-1",
                name = "College → Hostel Normal Corridor",
                start = GeoPoint(28.6139, 77.2090, "College Campus"),
                destination = GeoPoint(28.6250, 77.2180, "Hostel"),
                waypoints = listOf(
                    GeoPoint(28.6139, 77.2090),
                    GeoPoint(28.6165, 77.2115),
                    GeoPoint(28.6190, 77.2140),
                    GeoPoint(28.6220, 77.2160),
                    GeoPoint(28.6250, 77.2180)
                ),
                toleranceRadiusMeters = 100.0
            )
        )
    }

    fun saveSafeRoutes(routes: List<SafeRoute>) {
        val json = gson.toJson(routes)
        prefs.edit().putString("safe_routes_json", json).apply()
    }

    fun addSafeRoute(route: SafeRoute) {
        val list = getSafeRoutes()
        list.add(route)
        saveSafeRoutes(list)
    }

    fun removeSafeRoute(id: String) {
        val list = getSafeRoutes().filterNot { it.id == id }
        saveSafeRoutes(list)
    }

    fun getTrustedContacts(): MutableList<TrustedContact> {
        val json = prefs.getString("contacts_json", null)
        if (json != null) {
            val type = object : TypeToken<MutableList<TrustedContact>>() {}.type
            return gson.fromJson(json, type)
        }
        return mutableListOf(
            TrustedContact("c-1", "Mom", "+91 98111 22233", "Mother"),
            TrustedContact("c-2", "Brother", "+91 98222 33344", "Brother"),
            TrustedContact("c-3", "Emergency Police", "112", "Emergency Services")
        )
    }

    fun saveTrustedContacts(contacts: List<TrustedContact>) {
        val json = gson.toJson(contacts)
        prefs.edit().putString("contacts_json", json).apply()
    }

    fun addTrustedContact(contact: TrustedContact) {
        val list = getTrustedContacts()
        list.add(contact)
        saveTrustedContacts(list)
    }

    fun removeTrustedContact(id: String) {
        val list = getTrustedContacts().filterNot { it.id == id }
        saveTrustedContacts(list)
    }
}
