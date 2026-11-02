package com.shecurity.app.risk

import com.shecurity.app.data.models.PlannedTrip
import com.shecurity.app.data.models.SafeRoute
import java.util.Calendar

class TimeAnomalyAnalyzer {

    /**
     * Evaluates time variance based on regular route hours and planned trips.
     * Returns penalty score and human-readable explanation.
     */
    fun analyzeTimeAnomaly(
        safeRoute: SafeRoute?,
        activeTrip: PlannedTrip?,
        simulatedHour: Int? = null
    ): Pair<Int, String?> {
        val currentHour = simulatedHour ?: Calendar.getInstance().get(Calendar.HOUR_OF_DAY)

        // 1. If user is currently on an active planned trip
        if (activeTrip != null) {
            return if (currentHour > activeTrip.expectedArrivalHour + 1) {
                Pair(15, "Planned trip arrival delayed by >1 hour")
            } else {
                Pair(0, null)
            }
        }

        // 2. Regular route curfew check
        if (safeRoute != null) {
            val isWithinRegularHours = currentHour in safeRoute.regularStartHour..safeRoute.regularEndHour
            if (isWithinRegularHours) {
                return Pair(0, null)
            }
        }

        // 3. Evening & Late-night travel danger hours (Hour 20 is 8:00 PM)
        return when (currentHour) {
            in 23..24, in 0..5 -> Pair(30, "Critical late night travel hour ($currentHour:00)")
            in 20..22 -> Pair(20, "Evening / Night travel hour ($currentHour:00)")
            else -> Pair(5, "Unscheduled transit time ($currentHour:00)")
        }
    }
}
