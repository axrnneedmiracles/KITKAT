/**
 * ============================================================================
 * SHEcurity — Range Test: Bluetooth SPP + LoRa Transmitter (ESP32 #1) [SF9]
 * ============================================================================
 * CONFIGURATION: Spreading Factor 9 (SF9) | Bandwidth 125 kHz | 20 dBm (100 mW)
 *
 * BASED ON: Range-Testing/range_test_transmitter.ino
 *
 * PURPOSE:
 *   Full-featured transmitter code for range testing with your Android phone.
 *   - Connects to your Android phone via Bluetooth SPP ("SHECURITY_LORA_BRIDGE").
 *   - Relays phone emergency / telemetry packets over LoRa at MAXIMUM RANGE.
 *   - Auto-sends numbered test beacons when idle so you can walk-test range.
 *   - Forwards received LoRa ACKs (with RSSI & SNR) back to your phone via Bluetooth SPP!
 *
 * Hardware:
 *   - ESP32 NodeMCU / DevKit V1
 *   - SX1278 (Ra-02 433MHz) LoRa SPI Module
 *   - 100 µF Electrolytic Capacitor across SX1278 VCC (+) and GND (–)
 *   - 433 MHz Antenna (17.3 cm wire or spring coil)
 *
 * Pinout Connections (ESP32 → SX1278 Ra-02):
 *   ┌──────────────┬────────────────┐
 *   │   ESP32 Pin  │  SX1278 Pin    │
 *   ├──────────────┼────────────────┤
 *   │   3.3V       │  VCC (3.3V!)   │◄── Cap (+) leg (longer leg)
 *   │   GND        │  GND           │◄── Cap (–) leg (stripe with minus)
 *   │   GPIO 5     │  NSS / CS      │
 *   │   GPIO 14    │  RST / RESET   │
 *   │   GPIO 2     │  DIO0 / IRQ    │
 *   │   GPIO 18    │  SCK           │
 *   │   GPIO 19    │  MISO          │
 *   │   GPIO 23    │  MOSI          │
 *   │   —          │  ANT → Antenna │
 *   └──────────────┴────────────────┘
 *
 * Baud Rate: 115200 bps
 * Bluetooth SPP Device Name: SHECURITY_LORA_BRIDGE
 * ============================================================================
 */

#include <SPI.h>
#include <LoRa.h>

// ── Bluetooth SPP (Serial Port Profile) Header for Android App ──
#include "BluetoothSerial.h"

// Check for Bluetooth Classic support
#if !defined(CONFIG_BT_ENABLED) || !defined(CONFIG_BLUEDROID_ENABLED)
#error "Bluetooth is not enabled! Please select 'ESP32 Dev Module' under Tools > Board > esp32."
#endif

// ── LoRa SPI Pins ──
#define LORA_SS    5
#define LORA_RST   14
#define LORA_DIO0  2
#define LORA_BAND  433000000L   // 433.00 MHz ISM Band

// ── Status LED ──
#if defined(LED_BUILTIN) && (LED_BUILTIN != LORA_DIO0)
  #define STATUS_LED LED_BUILTIN
#else
  #define STATUS_LED 4
#endif

// ── Bluetooth SPP Object & Device Name ──
BluetoothSerial SerialBT;
const char* BT_DEVICE_NAME = "SHECURITY_LORA_BRIDGE";

// ── State Variables ──
bool btClientConnected = false;
unsigned long lastPacketSentTime = 0;
unsigned long lastHeartbeatTime = 0;
int packetNumber = 0;

// ── Bluetooth SPP Event Callback ──
void btCallback(esp_spp_cb_event_t event, esp_spp_cb_param_t *param) {
  if (event == ESP_SPP_SRV_OPEN_EVT) {
    btClientConnected = true;
    Serial.println("\n[ESP32-TX-SF9] 📱 >>> PHONE CONNECTED via Bluetooth SPP! <<<");
    blinkLed(5, 40);
  }
  if (event == ESP_SPP_CLOSE_EVT) {
    btClientConnected = false;
    Serial.println("\n[ESP32-TX-SF9] ⚠️ >>> PHONE DISCONNECTED from Bluetooth SPP <<<");
  }
}

void blinkLed(int count, int delayMs) {
  for (int i = 0; i < count; i++) {
    digitalWrite(STATUS_LED, HIGH);
    delay(delayMs);
    digitalWrite(STATUS_LED, LOW);
    delay(delayMs);
  }
}

void setup() {
  Serial.begin(115200);
  delay(500);

  pinMode(STATUS_LED, OUTPUT);
  digitalWrite(STATUS_LED, LOW);

  Serial.println("\n========================================================");
  Serial.println("  SHEcurity Range Test — Bluetooth SPP + LoRa TX (SF9)  ");
  Serial.println("========================================================");

  // 1. Initialize LoRa Module
  LoRa.setPins(LORA_SS, LORA_RST, LORA_DIO0);

  if (!LoRa.begin(LORA_BAND)) {
    Serial.println("[TX] ❌ ERROR: LoRa init failed! Check wiring & 3.3V power rail.");
    while (1) {
      digitalWrite(STATUS_LED, HIGH);
      delay(200);
      digitalWrite(STATUS_LED, LOW);
      delay(200);
    }
  }

  // ── Optimized High-Power Balanced Radio Parameters (SF9 / 125kHz) ──
  LoRa.setTxPower(20);              // 20 dBm = 100 mW (PA_BOOST boosted by 100 µF capacitor)
  LoRa.setSpreadingFactor(9);       // SF9: Balanced ~150ms airtime (eliminates 10-second lag!)
  LoRa.setSignalBandwidth(125E3);   // 125 kHz: Rock-solid lock, zero crystal oscillator drift
  LoRa.setCodingRate4(5);           // CR 4/5: Fast Forward Error Correction
  LoRa.setSyncWord(0x12);           // Sync word (must match receiver)
  LoRa.enableCrc();                 // Rejects corrupted noise packets

  Serial.println("[TX] ✅ LoRa Initialized @ 433 MHz (SF9, BW125k, CR4/5, 20dBm Max Power)");
  Serial.println("[TX] ⚡ Mode: Balanced Long Range (~150ms airtime) + 100mW RF Boost");

  // 2. Initialize Bluetooth SPP (Serial Port Profile)
  SerialBT.register_callback(btCallback);
  if (!SerialBT.begin(BT_DEVICE_NAME)) {
    Serial.println("[TX] ❌ ERROR: Bluetooth SPP init failed!");
  } else {
    Serial.printf("[TX] ✅ Bluetooth SPP Ready. Device Name: \"%s\"\n", BT_DEVICE_NAME);
    Serial.println("[TX] 📲 Open phone Bluetooth, pair with SHECURITY_LORA_BRIDGE");
  }

  blinkLed(3, 100);
  Serial.println("[TX] Ready! You can transmit from phone app or walk-test.\n");
}

String waitForLoRaAck(unsigned long timeoutMs) {
  unsigned long start = millis();
  while (millis() - start < timeoutMs) {
    // If incoming data arrives from Phone via Bluetooth, abort waiting for ACK immediately!
    if (SerialBT.available()) {
      return "";
    }
    int packetSize = LoRa.parsePacket();
    if (packetSize) {
      String ackData = "";
      while (LoRa.available()) {
        ackData += (char)LoRa.read();
      }
      ackData.trim();
      if (ackData.startsWith("ACK")) {
        return ackData;
      }
    }
    delay(5);
  }
  return "";
}

void transmitPacket(String packet, bool isFromPhone) {
  packetNumber++;
  digitalWrite(STATUS_LED, HIGH);

  Serial.printf("[TX #%d] 📡 Sending LoRa: %s\n", packetNumber, packet.c_str());

  LoRa.beginPacket();
  LoRa.print(packet);
  bool success = LoRa.endPacket();

  digitalWrite(STATUS_LED, LOW);

  if (success) {
    Serial.printf("[TX #%d] ✅ Broadcasted at 20dBm (SF9)! Waiting for ACK...\n", packetNumber);

    // SF9 round-trip ACK check (1200ms timeout for SF9 airtime)
    String ack = waitForLoRaAck(1200);
    if (ack.length() > 0) {
      Serial.printf("[TX #%d] 🎯 ACK RECEIVED: %s\n", packetNumber, ack.c_str());
      blinkLed(2, 60);

      // Send ACK with signal strength back to phone over Bluetooth SPP
      if (btClientConnected) {
        SerialBT.println(ack);
      }
    } else {
      Serial.printf("[TX #%d] ℹ️ Packet completed.\n", packetNumber);
      if (btClientConnected) {
        SerialBT.println("ACK|STATUS:RADIO_SENT");
      }
    }
  } else {
    Serial.printf("[TX #%d] ❌ LoRa Transmission Failed!\n", packetNumber);
  }
  lastPacketSentTime = millis();
  Serial.println("────────────────────────────────────────────────────────");
}

void loop() {
  // 1. Heartbeat status logging every 8 seconds
  if (millis() - lastHeartbeatTime > 8000) {
    lastHeartbeatTime = millis();
    if (btClientConnected) {
      Serial.println("[STATUS] 📱 Phone connected via Bluetooth SPP. Live bridge active.");
    } else {
      Serial.println("[STATUS] ⏳ Waiting for Phone Bluetooth pairing (\"SHECURITY_LORA_BRIDGE\")...");
    }
  }

  // 2. Incoming data from Phone via Bluetooth SPP (HIGHEST PRIORITY)
  while (SerialBT.available()) {
    String phonePacket = SerialBT.readStringUntil('\n');
    phonePacket.trim();
    if (phonePacket.length() > 0) {
      Serial.println("\n[BT SPP Rx from Phone]: " + phonePacket);
      transmitPacket(phonePacket, true);
    }
  }

  // 3. Incoming command from Arduino IDE Serial Monitor (for manual testing)
  if (Serial.available()) {
    String consolePacket = Serial.readStringUntil('\n');
    consolePacket.trim();
    if (consolePacket.length() > 0) {
      Serial.println("\n[Console Input]: " + consolePacket);
      transmitPacket(consolePacket, false);
    }
  }

  // 4. Autonomous Walk-Test Beacon:
  // ONLY runs when phone is NOT connected so it never interferes with phone SOS / Safe buttons!
  if (!btClientConnected && (millis() - lastPacketSentTime > 10000)) {
    String beaconPacket = "RANGE_TEST|PKT:" + String(packetNumber + 1) + "|SF9|SHE|NM:Aditi_Sharma|R45|HR78";
    transmitPacket(beaconPacket, false);
  }
}
