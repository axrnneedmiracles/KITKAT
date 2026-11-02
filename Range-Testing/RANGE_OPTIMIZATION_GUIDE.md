# SHEcurity — LoRa Range Optimization & Wiring Guide
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 1. What Changed & Why

### Previous Configuration (Short Range)
| Parameter          | Old Value | Effect                                        |
|--------------------|-----------|-----------------------------------------------|
| Tx Power           | Default   | ~14 dBm (~25 mW) — not using full PA_BOOST    |
| Spreading Factor   | SF7       | Fast but low sensitivity (-123 dBm)            |
| Bandwidth          | 125 kHz   | Wide = more noise captured                     |
| Coding Rate        | 4/5       | Minimal error correction                       |

### New Configuration (Maximum Range)
| Parameter          | New Value | Effect                                         |
|--------------------|-----------|-------------------------------------------------|
| Tx Power           | 20 dBm   | 100 mW — maximum legal ISM power via PA_BOOST  |
| Spreading Factor   | SF12      | Slowest chirp, receiver sensitivity = -137 dBm |
| Bandwidth          | 62.5 kHz  | Half the noise → +3 dB link budget gain        |
| Coding Rate        | 4/8       | Maximum FEC, recovers 50% corrupted bits        |

### Combined Range Improvement
- Link budget gain: ~18–22 dB over previous SF7/BW125/default power config
- Theoretical range increase: 3–5x in open field
- Wall penetration: Significantly improved (lower freq + higher link budget)
- Trade-off: Airtime increases from ~36 ms (SF7) to ~1.5 seconds (SF12)
  - Packet rate drops from ~25/sec to ~1 every 3 sec — acceptable for safety telemetry

---

## 2. Capacitor Modification (HIGHLY RECOMMENDED)

### Why a Capacitor?
During a 20 dBm (100 mW) transmit burst, the SX1278 draws ~120 mA for ~1.5 sec.
The ESP32's on-board 3.3V regulator + Bluetooth radio already consume ~80 mA.
Combined peak: ~200 mA → the 3.3V rail can sag below 3.0V, causing:
- LoRa packet corruption or failed transmission
- Reduced output power (lower range)
- Random resets on the ESP32

A **100 µF electrolytic capacitor** across VCC–GND acts as a local energy reservoir
that absorbs the current spike and keeps the voltage stable.

### What You Need
- **1× Electrolytic Capacitor: 100 µF, 10V or higher** (you have this ✅)
  - Acceptable range: 100–470 µF. Larger = more stable.
  - Voltage rating must be ≥ 6.3V (10V or 16V caps are standard and cheap).

### How to Install the Capacitor

```
     ESP32 3.3V Pin ──────┬──────────── SX1278 VCC
                          │
                    ┌─────┴─────┐
                    │  100 µF   │
                    │  CAP (+)  │  ◄── Longer leg = Positive
                    │           │
                    │  CAP (–)  │  ◄── Shorter leg / stripe = Negative
                    └─────┬─────┘
                          │
     ESP32 GND Pin ───────┴──────────── SX1278 GND
```

### Step-by-Step:
1. **Identify polarity**: The capacitor has a stripe marking on the NEGATIVE (–) side.
   The LONGER leg is POSITIVE (+).
2. **Place the (+) leg** on the wire/rail going to SX1278's VCC (3.3V).
3. **Place the (–) leg** on the wire/rail going to SX1278's GND.
4. Keep the capacitor **as physically close to the SX1278 module as possible**.
5. You can solder it, use a breadboard, or twist the leads onto the jumper wires.

> ⚠️ CAUTION: Installing the capacitor backwards (reversed polarity) can cause it
> to heat up, leak, or burst. Always double-check: (+) to VCC, (–) to GND.

---

## 3. Complete Wiring Table — Wire-to-Wire

### WITHOUT Capacitor (Original, still works but range may be limited):

| Wire # | ESP32 Pin     | →  | SX1278 Pin     | Wire Color (suggested) |
|--------|---------------|----|----------------|------------------------|
| 1      | 3.3V          | →  | VCC            | RED                    |
| 2      | GND           | →  | GND            | BLACK                  |
| 3      | GPIO 5        | →  | NSS / CS       | YELLOW                 |
| 4      | GPIO 14       | →  | RST / RESET    | ORANGE                 |
| 5      | GPIO 2        | →  | DIO0 / IRQ     | GREEN                  |
| 6      | GPIO 18       | →  | SCK            | BLUE                   |
| 7      | GPIO 19       | →  | MISO           | PURPLE                 |
| 8      | GPIO 23       | →  | MOSI           | WHITE                  |
|        | —             |    | ANT            | 17.3 cm antenna wire   |

**Total: 8 jumper wires + 1 antenna**


### WITH 100 µF Capacitor (New, recommended for maximum range):

| Wire # | From                      | →  | To                      | Wire Color (suggested) |
|--------|---------------------------|----|-------------------------|------------------------|
| 1      | ESP32 3.3V                | →  | SX1278 VCC              | RED                    |
| 2      | ESP32 GND                 | →  | SX1278 GND              | BLACK                  |
| 3      | ESP32 GPIO 5              | →  | SX1278 NSS / CS         | YELLOW                 |
| 4      | ESP32 GPIO 14             | →  | SX1278 RST / RESET      | ORANGE                 |
| 5      | ESP32 GPIO 2              | →  | SX1278 DIO0 / IRQ       | GREEN                  |
| 6      | ESP32 GPIO 18             | →  | SX1278 SCK              | BLUE                   |
| 7      | ESP32 GPIO 19             | →  | SX1278 MISO             | PURPLE                 |
| 8      | ESP32 GPIO 23             | →  | SX1278 MOSI             | WHITE                  |
|        | —                         |    | SX1278 ANT              | 17.3 cm antenna wire   |
| CAP +  | VCC rail (Wire #1 joint)  | →  | Capacitor (+) leg       | —                      |
| CAP –  | GND rail (Wire #2 joint)  | →  | Capacitor (–) leg       | —                      |

**Total: 8 jumper wires + 1 antenna + 1 capacitor (bridging VCC–GND)**

> NOTE: The capacitor does NOT add new wires to the ESP32. It bridges across the
> EXISTING VCC and GND wires, right at the SX1278 module pins. Think of it as a
> "battery backup" sitting across the power supply right where the LoRa chip needs it.

---

## 4. Circuit Diagram (ASCII Art)

```
                 ESP32 DevKit V1
               ┌─────────────────┐
               │                 │
        3.3V ──┤                 │
               │           GND ──┤──────────────┐
               │                 │              │
      GPIO 5 ──┤                 │              │
     GPIO 14 ──┤                 │              │
      GPIO 2 ──┤                 │              │
     GPIO 18 ──┤                 │              │
     GPIO 19 ──┤                 │              │
     GPIO 23 ──┤                 │              │
               └─────────────────┘              │
                    │  │  │  │  │  │  │          │
                    │  │  │  │  │  │  │          │
        3.3V ───────┘  │  │  │  │  │  │          │
                    ┌──┴──┴──┴──┴──┴──┴──┐      │
                    │                     │      │
                    │   SX1278 (Ra-02)    │      │
                    │                     │      │
              VCC ──┤    LoRa Module      ├── GND┘
                │   │                     │   │
                │   │        ANT ─────────┤───┤── 🔌 Antenna
                │   └─────────────────────┘   │
                │                             │
            ┌───┴───┐                         │
            │ + CAP │  100 µF                 │
            │ - CAP │  Electrolytic           │
            └───┬───┘                         │
                │                             │
                └─────────────────────────────┘
                        (shared GND rail)
```

---

## 5. LoRa Parameters Reference (Both TX & RX must match!)

```cpp
LoRa.setTxPower(20);              // 20 dBm = 100 mW (PA_BOOST)
LoRa.setSpreadingFactor(12);      // SF12: max range
LoRa.setSignalBandwidth(62.5E3);  // 62.5 kHz: narrow channel
LoRa.setCodingRate4(8);           // CR 4/8: max error correction
LoRa.setSyncWord(0x12);           // Network ID (both must match)
LoRa.enableCrc();                 // Packet integrity check
```

### Parameter Deep-Dive:

| Parameter      | Value    | What It Does                                            |
|----------------|----------|---------------------------------------------------------|
| TxPower(20)    | 20 dBm   | Drives PA_BOOST to 100 mW. 4× more power than default. |
| SF(12)         | SF12     | Each bit encoded as 4096 chirps (vs 128 at SF7).        |
|                |          | Receiver sensitivity improves from -123 to -137 dBm.    |
| BW(62.5E3)     | 62.5 kHz | Half the channel width = half the noise floor.           |
|                |          | Adds ~3 dB to link budget vs 125 kHz.                   |
| CR(8)          | 4/8      | Doubles redundancy bits. Can recover 50% bit errors.    |
| SyncWord(0x12) | 0x12     | Network identifier. Both units must use same value.     |
| CRC            | Enabled  | Rejects corrupted packets silently (no false data).      |

---

## 6. Range Testing Procedure

### Setup:
1. Flash `range_test_transmitter.ino` onto ESP32 #1 (the one you carry).
2. Flash `range_test_receiver.ino` onto ESP32 #2 (stays at laptop/base).
3. Open Serial Monitor (115200 baud) on BOTH ESP32s.
4. Verify both show "LoRa Ready (SF12, BW62.5k, CR4/8, 20dBm)".

### Walk Test:
1. Leave the Receiver ESP32 stationary (plugged into laptop).
2. Power the Transmitter ESP32 with a USB power bank.
3. Walk away in a straight line, checking Serial Monitor on phone/laptop.
4. Note the RSSI and link quality at each distance checkpoint.

### Reading the Results:
| RSSI (dBm)    | Link Quality         | Approximate Status             |
|---------------|----------------------|--------------------------------|
| > -80         | 🟢 EXCELLENT         | Very close, strong signal       |
| -80 to -100   | 🟡 GOOD              | Normal operating range          |
| -100 to -115  | 🟠 WEAK              | Edge of reliable range          |
| < -115        | 🔴 CRITICAL          | Packet loss likely, max range   |

### After Testing:
Once you've confirmed the range, flash back the production firmware:
- ESP32 #1 → `esp32_bluetooth_lora_tx.ino` (from android-app/bluetooth-transmitter/)
- ESP32 #2 → `esp32_lora_receiver.ino` (from website-server/lora-receiver/)

These production codes already have the same long-range LoRa parameters applied.

---

## 7. Troubleshooting

| Problem                          | Fix                                                    |
|----------------------------------|--------------------------------------------------------|
| "LoRa init failed!"             | Check all 8 SPI wires. Ensure VCC is on 3.3V, NOT 5V. |
| Packets received but corrupted  | Add/check the 100 µF capacitor. Check antenna.         |
| Very short range (< 50m)        | Antenna missing or broken. Must be 17.3 cm for 433 MHz.|
| No packets at all               | Verify SyncWord matches (0x12 on both). Check CRC.     |
| Intermittent drops at close range| Likely power sag. Add capacitor. Try 470 µF if 100 µF  |
|                                  | is not enough.                                          |
| ESP32 resets during transmit    | Power sag. Capacitor is mandatory. Check USB cable.    |
