# SHEcurity — Website Server & Monitoring Dashboard

This folder contains the laptop monitoring server and tactical operations dashboard for the SHEcurity system.

## Features
- **Real-Time Geospatial Map**: Leaflet.js map with CartoDB Dark Matter styling, rendering user pin, safe route corridors, and safe zones.
- **Dynamic Multi-Signal Risk Gauge**: Live 0–100 risk score breakdown with color-coded safety badges.
- **Explainable Anomaly Reasons**: Clear visual cards displaying exactly why the risk score changed (unusual time, route deviation, running, elevated heart rate, safe decay).
- **GoBoult Fit Heart Rate Monitoring**: Displays real-time pulse readings and flags tachycardia/panic heart rates (>130 BPM).
- **Communication Failover Matrix**: Monitors Primary Internet (Wi-Fi/Cellular), Bluetooth bridge, and LoRa 433MHz fallback status.
- **LoRa Serial Bridge**: Connects to ESP32 #2 via USB Serial (115200 baud), parses compact emergency packets, and sends back acknowledgements (`ACK|UID|OK`).
- **Discreet Verification System**: Operator can send a silent "Are you safe?" challenge. Entering Normal PIN (1234) clears risk, while Duress PIN (5678) silently triggers a critical 98/100 emergency alert.
- **Hackathon Stage Controller**: 8-stage interactive demo bar allowing one-click testing of every scenario from normal departure to LoRa failover.

## Quick Start

### 1. Install Dependencies
```bash
cd website-server/backend
npm install
```

### 2. Start the Server
```bash
npm start
```
The server will start on `http://localhost:3000`.

### 3. Connecting the Hardware
- Plug **ESP32 #2 (LoRa Receiver)** into the laptop via USB.
- The server will auto-detect the COM port. If needed, specify the port manually:
  ```bash
  LORA_COM_PORT=COM3 npm start
  ```
