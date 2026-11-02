# SHEcurity — Android Application

This folder contains the native Android application (written in **Kotlin**) for the SHEcurity Women's Personal Safety System.

## Architectural Highlights

### 1. Local On-Device Risk Engine (`com.shecurity.app.risk`)
- **100% on-device execution**: Evaluates risk independently without requiring a network server.
- **Dynamic 0–100 Bounded Score**:
  - `0–30`: NORMAL (Green)
  - `31–60`: CAUTION (Yellow)
  - `61–80`: HIGH RISK (Orange)
  - `81–100`: EMERGENCY (Red — Automated SOS trigger)
- **Multi-Factor Signals**:
  - **Route Deviation**: Cross-track distance to polyline corridor (>100m adds progressive penalty).
  - **Time Anomaly**: Departure/arrival curfew variance.
  - **Motion Anomaly**: 3-axis accelerometer vector magnitude and RMS frequency analysis (Walking vs Running vs Possible Fall).
  - **Heart Rate Anomaly**: Smartwatch BPM tracking (>135 BPM flags panic/tachycardia).
  - **Safe Zone Discount**: Proximity to Home, College, Hostel reduces score by 20–30 pts.
  - **Dynamic Risk Decay**: Elevated risk drops smoothly when returning to safe conditions, mitigating false alarms.

### 2. Smartwatch Heart Rate Integration (`BoultFitHeartRateService`)
- Android `AccessibilityService` tailored for the **GoBoult Fit** smartwatch companion application.
- Clicks "Measure", waits for measurement completion.
- Distinguishes the cached historical reading at the top from the freshly updated reading at the bottom with current date/time, extracts the BPM integer, and streams it to the Risk Engine.
- Includes manual simulation override for testing without a physical smartwatch.

### 3. Dual Communication & Instant Failover (`CommunicationManager`)
- Abstraction layer offering unified `sendEmergencyData(packet)`.
- **Primary**: Wi-Fi / LTE HTTP & WebSocket heartbeat.
- **Secondary**: Bluetooth SPP bridge to **ESP32 #1**, which broadcasts compact 433 MHz LoRa packets to **ESP32 #2** on the laptop.
- Instant fallback upon missed heartbeats or timeouts.

### 4. Discreet Verification & Duress Protection (`DuressDialog`)
- Silent vibration alert prompted on mobile phone.
- **Biometric Scan or PIN 1234**: Confirms user is truly safe and clears risk.
- **Duress PIN 5678**: Displays a fake "Safety Confirmed" screen to pacify an assailant, while secretly transmitting a critical 98/100 SOS distress signal to the laptop operations center.

### 5. Manual SOS & Shortcuts
- Large press-and-hold (1.5s) SOS button to eliminate accidental touches.
- Discreet triple-tap emergency shortcut.

## Project Structure
```text
android-app/
├── app/
│   ├── src/main/java/com/shecurity/app/
│   │   ├── communication/         # Internet & LoRa Bluetooth transport manager
│   │   ├── data/models/           # EmergencyPacket, RiskAssessment, SafeProfile
│   │   ├── risk/                  # Local on-device multi-factor Risk Engine
│   │   ├── service/               # Foreground tracking & GoBoult Fit accessibility service
│   │   └── ui/                    # Main dashboard, profile, and duress dialogs
│   ├── src/main/res/              # XML layouts, themes, colors, and accessibility configs
│   └── build.gradle.kts
├── bluetooth-transmitter/
│   └── ESP32/
│       └── esp32_bluetooth_lora_tx.ino  # ESP32 #1 Bluetooth-to-LoRa firmware
└── README.md
```

## How to Build in Android Studio
1. Open Android Studio.
2. Select **Open an Existing Project** and choose `android-app/`.
3. Allow Gradle to sync dependencies (Android SDK 34, Kotlin 1.9).
4. Run on an Android device or emulator (Android 8.0 / API 26+).
5. For GoBoult Fit screen scraping, enable **SHEcurity Heart Rate Service** under **Settings > Accessibility**.
