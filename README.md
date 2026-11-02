# 🛡️ SHEcurity (NariKavach / SafeKavach) — Universal Context-Aware Safety & Off-Grid Emergency Ecosystem

> **Next-Generation Autonomous Safety & Defense System for Everyone** — designed for women, solo commuters, elderly individuals with cardiac conditions, night-shift workers, and outdoor trekkers. Combines on-device multimodal AI risk scoring, real-time smartwatch biometric telemetry, off-grid 433 MHz LoRa radio failover, peer-to-peer off-grid mesh chat, discreet duress verification, and **TinyFish Autonomous AI First-Responder Web Agent** for automated 108 Ambulance and 112 Police dispatch.

---

## 🌟 The Main Crux of the Project

Most conventional emergency apps are built solely around a manual panic button that sends an SMS with coordinates to family members who may be asleep, miles away, or unable to intervene. Furthermore, traditional apps fail completely when users enter network dead zones (basements, remote trails, valleys).

**SHEcurity (NariKavach / SafeKavach)** broadens safety into an **inclusive, autonomous, end-to-end response ecosystem for all citizens and outdoor adventurers**:

1. **Universal Protection Across Demographics**:
   - 👩 **Women & Solo Commuters**: Midnight curfew deviation, struggle detection, tactical pursuit classification.
   - 🧓 **Elderly & Medical Patients**: Continuous smartwatch pulse monitoring (detects sudden drops to ≤40 BPM for immediate cardiac collapse triage).
   - 🧗 **Trekkers, Campers & Explorers**: Off-grid navigation, team tracking, and peer-to-peer communication in remote zero-cellular wilderness.
   - 🏢 **Underground / Transit Commuters**: Instant radio failover in basements, parking lots, and metro tunnels.

2. **Multimodal Context-Aware Risk Engine**: Continuously evaluates on-device sensor fusion: GPS corridor deviation, curfew hours, accelerometer motion (running/struggle/fall), and GoBoult Fit smartwatch heart rate (BPM).

3. **Off-Grid LoRa Radio Failover**: When cellular internet or Wi-Fi is lost (or jammed), the system automatically fails over to an **ESP32-based 433 MHz LoRa radio link**, transmitting compressed binary distress telemetry up to 5–10 km to a local receiver hub or repeating node.

4. **Off-Grid "Trekker Chat" (WhatsApp-like Peer-to-Peer Mesh)**:
   - **Zero Internet Required**: Enables encrypted text chat, coordinate drops, and team check-ins directly over LoRa radio waves.
   - **Emergency Group Beaconing**: One-touch group SOS broadcasts vital stats to all team members within radio range.
   - **TinyFish Multimodal Trail Guide**: Trekkers can analyze pictures of unknown wild plants, berries, or snake bites to identify toxicity, medical danger, and first-aid steps completely offline.

5. **Discreet Duress Verification**:
   - **PIN `1234` / Biometric**: Confirms user safety and safely decays alert levels.
   - **PIN `5678` (Duress Trap)**: Renders a counterfeit "Safety Confirmed" UI to appease an attacker while covertly locking emergency Code Red status and transmitting high-priority alerts to dispatchers.

6. **Autonomous Emergency Action via TinyFish AI**: Rather than relying on bystander intervention, an autonomous AI web agent analyzes telemetry, queries nearby medical/tactical infrastructure, logs formal intake tickets, and dispatches vehicles with live turn-by-turn road navigation.

---

## 🤖 TinyFish Autonomous AI First-Responder Integration

The system integrates **TinyFish AI** as an autonomous first-responder agent, bridging the gap between raw hardware telemetry and real-world emergency dispatch infrastructure.

```
 [ Android App / GoBoult Smartwatch / LoRa Radio ]
                        │
                        ▼ (Telemetry: BPM, Motion, GPS, Risk Score)
       [ SHEcurity Central Server (Node.js/WS) ]
                        │
                        ▼
    ┌───────────────────────────────────────────────┐
    │       TINYFISH AUTONOMOUS DISPATCH AGENT      │
    ├───────────────────────────────────────────────┤
    │ 1. Autonomous Multimodal Triage               │
    │    • Pulse ≤ 40 BPM (Cardiac Collapse)        │
    │      ↳ 108 Advanced Life Support Ambulance    │
    │    • Pulse ≥ 180 BPM / Night Pursuit          │
    │      ↳ 112 Tactical PCR Police Squadron       │
    │                                               │
    │ 2. TinyFish Search API Grounding              │
    │    • Query: api.search.tinyfish.ai            │
    │    • Discovers genuine nearest hospitals      │
    │      (Asian Fidelis ~250m, Amrita ~780m)      │
    │                                               │
    │ 3. TinyFish Browser Automation (run-sse)      │
    │    • Headless agent fills emergency intake    │
    │    • Streams live cloud agent execution URL   │
    │                                               │
    │ 4. OpenStreetMap OSRM Road-Following Engine   │
    │    • Snaps turn-by-turn route to actual roads │
    │    • Simulates real-time ambulance transit    │
    └───────────────────────────────────────────────┘
                        │
                        ▼
 [ Emergency Services Dispatch Portal (/emergency-portal) ]
 (Live Leaflet Map, Glowing Patient Badges, Google Maps Deep-Link)
```

### 1. Dual-API TinyFish Implementation
- **TinyFish Search API (`api.search.tinyfish.ai`)**:
  - Dynamically queries verified hospitals and police stations within the victim's immediate GPS coordinates.
  - Returns grounded local infrastructure snippets and verified facility contacts.
- **TinyFish Agent Automation API (`agent.tinyfish.ai/v1/automation/run-sse`)**:
  - Spawns an autonomous cloud browser agent via server-sent events (`run-sse`).
  - Navigates emergency protocols, fills victim medical history (Blood: B+, Allergies: Penicillin, Asthma), and logs the incident.
  - Broadcasts a live interactive browser stream (`streaming_url`) to the dispatch portal.

### 2. Autonomous Triage Decision Matrix
TinyFish continuously evaluates multi-modal telemetry to select the appropriate response service:

| Telemetry Condition | Triage Classification | Priority Code | Dispatched Unit | Response Protocol |
| :--- | :--- | :--- | :--- | :--- |
| **Pulse ≤ 40 BPM** (e.g. 30 BPM) or Sudden Fall | Medical Trauma / Cardiac Collapse | `CODE_RED_CARDIAC_COLLAPSE` | **108 ALS Ambulance** | Oxygen, defibrillator, trauma resuscitation standby. |
| **Pulse ≥ 180 BPM** (e.g. 230 BPM) or High-Speed Running | Tactical Pursuit / Assault | `CODE_BLACK_TACTICAL_PURSUIT` | **112 Police PCR** | Armed patrol intercept, siren intimidation, perimeter cordon. |
| **Curfew Hours (11 PM–5 AM)** + Unsafe Route | Preventive Caution | `CODE_AMBER_DISTRESS` | **Safety Booth Patrol** | Dispatches nearest university/sector assistance unit. |
| **Manual SOS / Duress PIN 5678** | Active Hostage / Threat | `CODE_RED_DISTRESS` | **Dual 112 + 108 Alert** | Covert dispatch with silent beaconing. |

### 3. OpenStreetMap OSRM Road Navigation
Unlike basic simulations that draw straight diagonal lines across buildings:
- Integrated **Open Source Routing Machine (OSRM)** driving API (`https://router.project-osrm.org/route/v1/driving/...`).
- Calculates exact street-level coordinates (e.g. along RPS Savana Road, Kheri Road turns).
- Renders dual-layer navigation polylines (high-contrast casing + solid navigation core).
- Simulates emergency unit transit along physical asphalt streets with dynamic ETA countdown.

### 4. Off-Grid "Trekker Chat" & Multimodal Vision Companion
Designed for outdoor trekking teams, remote field workers, and adventurers traveling through cellular blackouts:
- **WhatsApp-Style Decentralized Messaging**: Connects smartphone to the ESP32 LoRa transmitter via Bluetooth SPP. Trekkers can broadcast text messages, ping fellow teammates, and share live coordinates over 433 MHz radio without Wi-Fi, 4G, or SIM cards.
- **Group Distress Beaconing**: If one member falls into a ravine or suffers an altitude drop, their distress telemetry is automatically repeated across all teammates' phones within a 5–10 km radius.
- **TinyFish Edge Vision (Wilderness Safety)**: Trekkers can snap pictures of unknown jungle foliage, wild berries, poisonous insects, or snake bites. The multimodal TinyFish engine analyzes the image offline, identifies toxicity risks, and displays immediate field remedies/antidote guidance on-screen.

---

## 📁 Repository Structure

```text
WOMENS-SAFETY-SYSTEM/
├── website-server/
│   ├── backend/
│   │   ├── server.js                 # Central Express, WebSocket, and REST hub
│   │   ├── tinyfish-agent.js         # TinyFish AI Triage, Search & Agent Automation Engine
│   │   ├── emergency-handler.js      # On-server state, trip tracker, and safety check challenge
│   │   └── lora-receiver-serial.js   # Hardware serial listener for ESP32 #2 LoRa Rx
│   ├── dashboard/
│   │   ├── emergency-portal.html     # Dedicated First-Responder Dispatch Desk (108 & 112)
│   │   ├── index.html                # Main tactical monitoring dashboard
│   │   ├── app.js                    # Leaflet geospatial map & WebSocket client
│   │   └── SHEcurity-v4.1.apk        # Downloadable Android release package
│   └── lora-receiver/ESP32/          # ESP32 #2 firmware (LoRa 433MHz Rx -> USB Serial)
│
├── android-app/
│   ├── app/src/main/java/com/shecurity/app/
│   │   ├── risk/RiskEngine.kt        # Multi-signal risk assessment with smooth temporal decay
│   │   ├── communication/
│   │   │   ├── CommunicationManager.kt # Parallel non-blocking dual transport (Wi-Fi + LoRa)
│   │   │   ├── InternetTransport.kt    # Persistent WebSocket & HTTP REST with auto-discovery
│   │   │   └── LoRaBluetoothTransport.kt # Bluetooth SPP bridge to ESP32 #1 LoRa transmitter
│   │   ├── service/
│   │   │   ├── TrackingService.kt    # Foreground service tracking GPS, motion & sensors
│   │   │   └── BoultFitHeartRateService.kt # Smartwatch UI hierarchy pulse extractor
│   │   └── ui/                       # MainActivity, DuressDialog, ProfileActivity
│   └── bluetooth-transmitter/ESP32/  # ESP32 #1 firmware (Phone Bluetooth SPP -> LoRa Tx)
│
└── docs/
    ├── ARCHITECTURE.md               # End-to-end dataflow, state machines & equations
    ├── HARDWARE_WIRING.md            # ESP32 to SX1278 Ra-02 433MHz pinout schematics
    └── DEMO_GUIDE.md                 # 8-stage step-by-step hackathon demo script
```

---

## 🚀 Quick Setup & Execution

### 1. Start Laptop Operations & Dispatch Server
```bash
cd website-server/backend
npm install
npm start
```
* **Main Dashboard**: [`http://localhost:3000`](http://localhost:3000)
* **Emergency Services Portal**: [`http://localhost:3000/emergency-portal`](http://localhost:3000/emergency-portal)
* **Testing on Same Wi-Fi**: Enter `192.168.1.xxx:3000` into phone app.
* **Testing from Distance / Different Networks (4G/5G / Remote)**:
  - The server automatically spins up a **Cloudflare Global Tunnel**.
  - A secure public address (e.g. `https://xxxx.trycloudflare.com`) is displayed in the terminal and on the dashboard header.
  - Simply enter that address into the phone app to connect from **any network anywhere in the world**!

### 2. Install Android App on Phone
* Transfer [`SHEcurity-v4.1.apk`](file:///SHEcurity-v4.1.apk) to your Android phone (or download via phone browser).
* The app automatically discovers the laptop server over local Wi-Fi.

### 3. Flash Hardware Firmware (Optional for Off-Grid Demo)
* **Transmitter (ESP32 #1)**: Flash `android-app/bluetooth-transmitter/ESP32/esp32_bluetooth_lora_tx.ino`.
* **Receiver (ESP32 #2)**: Flash `website-server/lora-receiver/ESP32/esp32_lora_receiver.ino` and connect via USB.

---

## 📊 PPT Presentation Summary (Slide-by-Slide Bullets)

### Slide 1: The Problem
* Standard SOS buttons trigger generic SMS alerts that require manual human coordination.
* High rate of false alarms; zero real-time contextual awareness of user biometrics or surroundings.
* Single point of failure: Cellular dead zones or network congestion render mobile SOS useless.

### Slide 2: The Solution — SHEcurity
* Multimodal sensor fusion: GPS + Smartwatch BPM + Accelerometer + Curfew time.
* Seamless failover to **433 MHz LoRa Radio** when off-grid (no internet required).
* Covert duress PIN trap (`5678`) to protect against coerced phone unlocking.

### Slide 3: TinyFish Autonomous AI Agent
* Integrates **TinyFish Search & Browser Automation APIs** (`run-sse`).
* AI autonomously triages incoming trauma:
  * 30 BPM (Collapse) $\rightarrow$ 108 Ambulance intake & dispatch.
  * 230 BPM (Assault) $\rightarrow$ 112 Police PCR intercept.
* Dispatches genuine local facilities (**Asian Fidelis Hospital** ~250m away) using **OpenStreetMap OSRM street-level routing**.

### Slide 4: Real-World Impact & Feasibility
* Zero-latency (<25ms) parallel communication architecture.
* Real-time automated complaint registration eliminates the 15–20 minute human dispatch bottleneck.
* Low-cost off-the-shelf hardware (ESP32 + SX1278 ~₹1,200).
* Universal relevance across demographics: women, cardiac patients, solo night workers, and outdoor trekkers.

### Slide 5: Off-Grid "Trekker Chat" & Multimodal AI Guide
* Decentralized, WhatsApp-style messaging over 433 MHz LoRa mesh (zero cellular/Wi-Fi needed).
* Real-time location drops, group check-ins, and peer-to-peer SOS relaying on remote trails.
* TinyFish on-device image recognition: Trekkers photograph unknown plants, berries, or snake bites for instant offline toxicity and first-aid analysis.

### Slide 6: Future Scope & Regional Expansion
* **Smart Rotational Antennas**: Stepper-driven high-gain Yagi array auto-aligns to incoming RF vectors to extend single-hop range to 25–40+ km.
* **Delhi-NCR Mesh Grid**: Multi-hop relay stations on PCR vans, DTC buses, and streetlights providing citywide offline safety coverage.


