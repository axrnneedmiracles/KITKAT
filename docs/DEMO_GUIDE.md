# SHEcurity — Hackathon Demonstration & Jury Pitch Guide

This guide outlines the recommended 8-stage presentation flow to showcase the end-to-end capabilities of SHEcurity.

---

## 30-Second Elevator Pitch

> *"Most women's safety apps rely on a single button or panic alert, leading to high false-alarm rates or failing entirely when the user is incapacitated or network coverage drops. SHEcurity is an intelligent, context-aware safety matrix. It computes a multi-factor risk score directly on the user's phone using time, route deviation, motion, and smartwatch heart-rate telemetry. If the user is in danger, it automatically triggers distress alerts—and if the mobile network fails, it seamlessly switches to an off-grid 433 MHz LoRa radio link to guarantee delivery to the monitoring center."*

---

## The 8-Stage Demonstration Flow

You can execute this flow using either the **interactive buttons on the laptop dashboard** or the **"Demo Stages" menu on the Android phone**.

```text
NORMAL (8) ──> DEVIATION (28) ──> SAFE ZONE DECAY (12) ──> LATE NIGHT (48) 
     ──> RUNNING (72) ──> GOBOLT 142 BPM (94) ──> AUTO SOS (98) ──> LORA FAILOVER
```

---

### Stage 1: Normal Departure
- **Action**: Click **Stage 1 (Normal Depart)**.
- **Display**:
  - Risk Score: **8 / 100** (GREEN — SAFE).
  - Pin on university campus; user is walking along planned safe corridor.
  - Heart Rate: 74 BPM.
- **Talking Point**:
  > *"Aditi leaves campus at 5:15 PM. Because her timing, speed, and path match her regular profile, her risk score remains baseline normal (8/100)."*

---

### Stage 2: Route Deviation
- **Action**: Click **Stage 2 (Deviated)**.
- **Display**:
  - Risk Score: **28 / 100** (YELLOW — CAUTION).
  - Map pin moves 380m off the safe corridor.
  - Explainable factor appears: *'Route deviation detected (+20)'*.
- **Talking Point**:
  > *"She deviates from the usual road to visit a market. Note that SHEcurity does NOT sound a false alarm! It elevates to CAUTION (28/100) and waits for additional context."*

---

### Stage 3: Safe Zone Reached (False-Positive Reduction)
- **Action**: Click **Stage 3 (Safe Zone Decay)**.
- **Display**:
  - Risk Score drops back down to **12 / 100** (GREEN — SAFE).
  - Pin arrives at a recognized safe haven (Police Assistance Booth / Friend's House).
  - Explainable factor: *'Inside safe zone: Police Booth (-20)'*.
- **Talking Point**:
  > *"When she enters a recognized safe location and remains calm, the risk engine decays the score back to SAFE. This prevents alarm fatigue and builds true user trust."*

---

### Stage 4: Curfew / Late Night Anomaly
- **Action**: Click **Stage 4 (Curfew Anomaly)**.
- **Display**:
  - Risk Score elevates to **48 / 100** (YELLOW — CAUTION).
  - Time indicates after 11:30 PM outside safe zones.
  - Explainable factor: *'Critical late night travel hour (+20)'*.
- **Talking Point**:
  > *"Now imagine she is travelling late at night at an unfamiliar hour. The risk increases to 48, putting the system on high alert."*

---

### Stage 5: Motion Anomaly (Running Detected)
- **Action**: Click **Stage 5 (Running Motion)**.
- **Display**:
  - Risk Score jumps to **72 / 100** (ORANGE — HIGH RISK).
  - Motion tile shows running icon in red; phone accelerometer flags high RMS frequency.
  - Explainable factors: *'Curfew (+20)'*, *'Route deviation (+20)'*, *'Sudden running motion (+25)'*.
- **Talking Point**:
  > *"The phone's accelerometer detects sudden running motion. The risk breaches 70/100, entering HIGH RISK."*

---

### Stage 6: GoBoult Fit Smartwatch Heart Rate Spike (142 BPM)
- **Action**: Click **Stage 6 (GoBoult 142 BPM)**.
- **Display**:
  - Heart Rate tile flashes red: **142 BPM** (GoBoult Fit Live).
  - Risk Score hits **94 / 100** (RED — CRITICAL).
- **Talking Point**:
  > *"SHEcurity queries the GoBoult Fit smartwatch. It reads the newest bottom measurement: 142 BPM, indicating severe physiological distress. The multi-signal score reaches 94/100."*

---

### Stage 7: Automatic SOS Dispatch
- **Action**: Click **Stage 7 (Auto SOS)**.
- **Display**:
  - Emergency audio siren sounds on the laptop.
  - Emergency Banner slides down in bold crimson.
  - Event log records: *'EMERGENCY_ALERT triggered automatically'*.
- **Talking Point**:
  > *"Because multiple independent signals aligned (late night + route deviation + running + panic pulse), the phone makes an autonomous decision: AUTOMATIC SOS is dispatched without requiring the user to fumble with her phone."*

---

### Stage 8: Network Blackout & 433 MHz LoRa Radio Fallback
- **Action**: Click **Stage 8 (LoRa Fallback)**.
- **Display**:
  - Primary Internet status changes to: **OFFLINE**.
  - Active Transport badge switches to: **LoRa 433MHz ACTIVE**.
  - Dashboard banner displays: *'🚨 SOS RECEIVED VIA LORA'*.
  - Laptop sends LoRa ACK back to ESP32 #1 and Phone.
- **Talking Point**:
  > *"Now the assailant forces the victim into an area with zero cellular or Wi-Fi coverage. The phone detects missed heartbeats and immediately switches to its secondary channel: the Bluetooth bridge to ESP32 #1, transmitting a compact distress packet over 433 MHz LoRa directly to the laptop receiver. Long-range off-grid protection is maintained!"*

---

### Bonus Demonstration: Discreet Verification & Duress PIN
1. Click **Discreet "Are You Safe?" Ping**.
2. A silent vibration modal appears on the phone.
3. Show the jury:
   - Entering **1234** (Normal PIN) or Fingerprint verifies the user is truly safe and resets the risk score.
   - Entering **5678** (Duress PIN under coercion) displays a fake "All Good" confirmation screen to deceive the attacker, while secretly transmitting a critical 98/100 emergency distress alert to the monitoring center!
