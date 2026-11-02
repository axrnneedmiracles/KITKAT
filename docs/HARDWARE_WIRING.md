# SHEcurity Hardware Wiring & Setup Guide

This guide describes how to connect and configure the two ESP32 microcontrollers with their SX1278 (Ra-02 433 MHz) LoRa modules.

---

## 1. Bill of Materials (BOM)

| Item | Qty | Notes |
| :--- | :--- | :--- |
| **ESP32 DevKit V1 (30-pin or 38-pin)** | 2 | One for Transmitter (carried), one for Receiver (laptop USB) |
| **SX1278 Ra-02 433 MHz LoRa Module** | 2 | SPI interface |
| **433 MHz Spring / Whip Antenna** | 2 | 17.3 cm length (quarter-wave) |
| **Jumper Wires (Female-to-Female)** | 14 | Short length (< 10 cm recommended for SPI stability) |
| **Micro-USB / USB-C Cables** | 2 | Data-capable cables |

---

## 2. ESP32 to SX1278 LoRa Pinout (Both Units)

Both **ESP32 #1 (Transmitter)** and **ESP32 #2 (Receiver)** use the exact same SPI wiring to their respective SX1278 modules:

```text
  +------------------+                    +--------------------+
  |      ESP32       |                    |    SX1278 LoRa     |
  |                  |                    |      (Ra-02)       |
  |            3.3V  +------------------->+  3.3V / VCC        |
  |             GND  +------------------->+  GND               |
  |          GPIO 5  +------------------->+  NSS / CS          |
  |         GPIO 14  +------------------->+  RST / RESET       |
  |          GPIO 2  +------------------->+  DIO0 / IRQ        |
  |         GPIO 18  +------------------->+  SCK               |
  |         GPIO 19  +------------------->+  MISO              |
  |         GPIO 23  +------------------->+  MOSI              |
  +------------------+                    +--------------------+
```

> [!CAUTION]
> **POWER SUPPLY WARNING**:
> SX1278 is strictly a **3.3V device**. Connecting it to the ESP32's **VIN (5V)** pin will permanently damage the LoRa chip! Always connect to the **3.3V** pin.

> [!IMPORTANT]
> **ANTENNA REQUIREMENT**:
> Never power or transmit on an SX1278 module without an antenna connected. Operating without an antenna can burn out the RF power amplifier. Use a 17.3 cm straight wire or 433 MHz coil antenna soldered to the ANT pin.

---

## 3. Flashing the Firmware

### In Arduino IDE:
1. Go to **Tools > Board > ESP32 Arduino > ESP32 Dev Module**.
2. Go to **Tools > Manage Libraries...** and install:
   - **LoRa** by Sandeep Mistry (version 0.8.0 or newer).
3. Connect **ESP32 #1**:
   - Open `android-app/bluetooth-transmitter/ESP32/esp32_bluetooth_lora_tx.ino`.
   - Select the correct COM port and click **Upload**.
4. Connect **ESP32 #2**:
   - Open `website-server/lora-receiver/ESP32/esp32_lora_receiver.ino`.
   - Select the correct COM port and click **Upload**.
5. Leave **ESP32 #2** plugged into the laptop via USB. The Node.js server will read from its serial output at 115200 baud.
