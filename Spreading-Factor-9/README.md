# ⚡ SHEcurity — Spreading Factor 9 (SF9) LoRa Optimization

## 🎯 Why Spreading Factor 9 (SF9) with 125 kHz Bandwidth?

In our previous test with **SF12 and Bandwidth 62.5 kHz**, the airtime for a single packet was over **1.5 – 2.0 seconds**. When accounting for round-trip acknowledgments (ACK), channel preambles, and retry cycles, end-to-end latency reached **~8 to 10 seconds**!

By shifting to **Spreading Factor 9 (SF9)** and **Bandwidth 125 kHz**:
- **Airtime drops to ~150 ms** (Over **10x faster!**).
- **Sub-second latency**: SOS alerts and duress codes transmit almost instantaneously.
- **Superior sensitivity (-129 dBm)**: Provides a **+6 dB gain over SF7**, doubling the line-of-sight range.
- **Balanced Sweet Spot**: Achieves **3–5+ km urban coverage** without the sluggish multi-second delay of SF12.

---

## 📊 Comparison Table: SF7 vs. SF9 vs. SF12

| Parameter | SF7 / 125 kHz (Original) | SF9 / 125 kHz (⭐ New Sweet Spot) | SF12 / 62.5 kHz (Maximum Range) |
| :--- | :--- | :--- | :--- |
| **Packet Airtime** | ~35 ms | **~150 ms** | ~1,800 ms (1.8 s) |
| **Round-Trip Latency** | ~200 ms | **< 1 second** | ~8 – 10 seconds |
| **Receiver Sensitivity**| -123 dBm | **-129 dBm (+6 dB gain)** | -137 dBm |
| **Noise Immunity** | Standard | **High** | Extreme |
| **Urban Range** | ~1.5 – 2.5 km | **~3.5 – 5 km** | ~5 – 8 km |
| **Use Case** | Fast local testing | **Ideal for Real-Time Safety & Demos** | Slow sensor telemetry |

---

## 📁 Folder Contents

```text
Spreading-Factor-9/
├── transmitter/
│   └── transmitter.ino       # Flash to ESP32 #1 (Transmitter with Phone / Bluetooth)
├── receiver/
│   └── receiver.ino          # Flash to ESP32 #2 (Receiver with Laptop USB Serial)
└── README.md
```

---

## ⚙️ Radio Configuration in Both Codes

```cpp
LoRa.setTxPower(20);              // 20 dBm (100 mW max legal power)
LoRa.setSpreadingFactor(9);       // SF9: Balanced range & speed
LoRa.setSignalBandwidth(125E3);   // 125 kHz: Rock-solid lock
LoRa.setCodingRate4(5);           // CR 4/5: Forward error correction
LoRa.setSyncWord(0x12);           // Sync word: 0x12
LoRa.enableCrc();                 // CRC integrity check
```

---

## 🔌 Hardware Wiring (Both ESP32 #1 & #2)

| ESP32 Pin | SX1278 Ra-02 Pin | Notes |
| :--- | :--- | :--- |
| **3.3V** | **VCC** | ⚠️ Connect **Capacitor (+) longer leg** here |
| **GND** | **GND** | ⚠️ Connect **Capacitor (–) stripe leg** here |
| **GPIO 5** | **NSS / CS** | Chip Select |
| **GPIO 14**| **RST / RESET**| Module Reset |
| **GPIO 2** | **DIO0 / IRQ** | Interrupt Request |
| **GPIO 18**| **SCK** | SPI Clock |
| **GPIO 19**| **MISO** | SPI Data Out |
| **GPIO 23**| **MOSI** | SPI Data In |
| **—** | **ANT** | **17.3 cm wire** or 433 MHz spring coil antenna |

> 💡 **Reminder**: The **100 µF capacitor** across 3.3V and GND provides the instantaneous ~50 mA surge needed during 20 dBm transmit bursts, preventing voltage brownouts.

---

## 🚀 How to Flash & Test

1. **Flash Transmitter (ESP32 #1)**:
   - In Arduino IDE, open `Spreading-Factor-9/transmitter/transmitter.ino`.
   - Connect ESP32 #1 via USB, select your COM port, and click **Upload**.
   - Bluetooth Name: `SHECURITY_LORA_BRIDGE`.

2. **Flash Receiver (ESP32 #2)**:
   - In Arduino IDE, open `Spreading-Factor-9/receiver/receiver.ino`.
   - Connect ESP32 #2 via USB, select its COM port, and click **Upload**.
   - Keep connected to laptop USB at **115200 baud** to feed live telemetry directly to the SHEcurity dashboard!

