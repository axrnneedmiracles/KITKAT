/**
 * ============================================================================
 * SHEcurity — ESP32 #1 Bluetooth-to-LoRa Transmitter (Carried with User/Phone)
 * ============================================================================
 * Hardware:
 *   - ESP32 NodeMCU / DevKit V1
 *   - SX1278 (Ra-02 433MHz) LoRa SPI Module
 *
 * Pinout Connections (ESP32 to SX1278 Ra-02):
 *   - NSS  / CS  -> GPIO 5
 *   - RST / RESET-> GPIO 14
 *   - DIO0 / IRQ -> GPIO 2
 *   - SCK        -> GPIO 18
 *   - MISO       -> GPIO 19
 *   - MOSI       -> GPIO 23
 *   - VCC        -> 3.3V ONLY 
 *   - GND        -> GND
 *
 * Baud Rate: 115200 bps
 * Bluetooth Name: SHECURITY_LORA_BRIDGE
 * ============================================================================
 */

#include <SPI.h>
#include <LoRa.h>
#include "BluetoothSerial.h"

// Check for Bluetooth Classic support
#if !defined(CONFIG_BT_ENABLED) || !defined(CONFIG_BLUEDROID_ENABLED)
#error "Bluetooth is not enabled! Please select 'ESP32 Dev Module' under Tools > Board > esp32."
#endif

#define LORA_SS    5
#define LORA_RST   14
#define LORA_DIO0  2
#define LORA_BAND  433000000L // 433.00 MHz ISM Band

#if defined(LED_BUILTIN) && (LED_BUILTIN != LORA_DIO0)
  #define STATUS_LED LED_BUILTIN
#else
  #define STATUS_LED 4
#endif

BluetoothSerial SerialBT;
const char* BT_DEVICE_NAME = "SHECURITY_LORA_BRIDGE";

bool btClientConnected = false;
unsigned long lastPacketSentTime = 0;
unsigned long lastHeartbeat = 0;
int beaconCount = 0;

void btCallback(esp_spp_cb_event_t event, esp_spp_cb_param_t *param) {
  if (event == ESP_SPP_SRV_OPEN_EVT) {
    btClientConnected = true;
    Serial.println("[ESP32-Tx] 📱 >>> PHONE CONNECTED via Bluetooth SPP! <<<");
    blinkLed(5, 40);
  }
  if (event == ESP_SPP_CLOSE_EVT) {
    btClientConnected = false;
    Serial.println("[ESP32-Tx] ⚠️ >>> PHONE DISCONNECTED from Bluetooth <<<");
  }
}

void setup() {
  Serial.begin(115200);
  delay(500);

  pinMode(STATUS_LED, OUTPUT);
  digitalWrite(STATUS_LED, LOW);

  Serial.println("\n[ESP32-Tx] =========================================");
  Serial.println("[ESP32-Tx] Booting SHEcurity Bluetooth-to-LoRa Bridge");
  Serial.println("[ESP32-Tx] =========================================");

  // 1. Initialize LoRa
  LoRa.setPins(LORA_SS, LORA_RST, LORA_DIO0);
  if (!LoRa.begin(LORA_BAND)) {
    Serial.println("[ESP32-Tx] ❌ ERROR: LoRa init failed! Halting.");
    while (1) {
      digitalWrite(STATUS_LED, HIGH);
      delay(300);
      digitalWrite(STATUS_LED, LOW);
      delay(300);
    }
  }

  // ── Optimized High-Power Fast-Response Radio Parameters ──
  LoRa.setTxPower(20);              // 20 dBm = 100 mW (PA_BOOST boosted by 100 µF capacitor)
  LoRa.setSpreadingFactor(7);       // SF7: Instant 35ms packet airtime
  LoRa.setSignalBandwidth(125E3);   // 125 kHz: Rock-solid lock, zero crystal drift
  LoRa.setCodingRate4(5);           // CR 4/5: Fast Forward Error Correction
  LoRa.setSyncWord(0x12);           // Standard sync word
  LoRa.enableCrc();

  Serial.println("[ESP32-Tx] ✅ LoRa initialized at 433.00 MHz (SF7, BW125k, CR4/5, 20dBm)");
  Serial.println("[ESP32-Tx] ⚡ Mode: Lightning Fast (35ms airtime) + 100mW RF Boost");

  // 2. Initialize Bluetooth Serial for Android Phone Bridge
  SerialBT.register_callback(btCallback);
  if (!SerialBT.begin(BT_DEVICE_NAME)) {
    Serial.println("[ESP32-Tx] ❌ ERROR: Bluetooth Serial init failed!");
  } else {
    Serial.printf("[ESP32-Tx] ✅ Bluetooth SPP Active. Device: %s\n", BT_DEVICE_NAME);
  }

  Serial.println("[ESP32-Tx] Ready! Listening for Phone Bluetooth packets...");
  blinkLed(3, 100);
}

void loop() {
  // Print status heartbeat every 8 seconds
  if (millis() - lastHeartbeat > 8000) {
    lastHeartbeat = millis();
    if (btClientConnected) {
      Serial.println("[HEARTBEAT] 📱 Phone connected. Live link active.");
    } else {
      Serial.println("[HEARTBEAT] ⏳ Waiting for Phone Bluetooth. (Auto-beacon active)");
    }
  }

  // 1. Check if packet received from Android Phone over Bluetooth (HIGHEST PRIORITY)
  while (SerialBT.available()) {
    String packetFromPhone = SerialBT.readStringUntil('\n');
    packetFromPhone.trim();

    if (packetFromPhone.length() > 0) {
      Serial.println("[BT Rx from Phone]: " + packetFromPhone);
      broadcastPacket(packetFromPhone, true);
    }
  }

  // 2. Allow USB Serial testing from Arduino IDE Serial Monitor
  if (Serial.available()) {
    String consoleInput = Serial.readStringUntil('\n');
    consoleInput.trim();
    if (consoleInput.length() > 0) {
      Serial.println("[Console Input]: " + consoleInput);
      broadcastPacket(consoleInput, false);
    }
  }

  // 3. Autonomous Beacon: ONLY when phone is NOT connected!
  // When phone is connected, phone sends its own real telemetry and SOS!
  if (!btClientConnected && (millis() - lastPacketSentTime > 10000)) {
    beaconCount++;
    // Valid standard telemetry format expected by website server
    String beaconPacket = "SHE|NM:Aditi_Sharma|PH:+919876543210|LT28.6139|LN77.2090|R45|HR78|BAT88|M_WALK";
    Serial.printf("[LoRa Beacon #%d]: %s\n", beaconCount, beaconPacket.c_str());
    broadcastPacket(beaconPacket, false);
  }
}

void broadcastPacket(String packet, bool replyToBt) {
  digitalWrite(STATUS_LED, HIGH);

  // Send packet over LoRa 433MHz
  LoRa.beginPacket();
  LoRa.print(packet);
  bool success = LoRa.endPacket();

  digitalWrite(STATUS_LED, LOW);

  if (success) {
    Serial.println("[LoRa Tx OK] -> Broadcasted on 433MHz!");
    
    // Fast 600ms ACK check (SF7 airtime is only ~35ms)
    String ack = waitForLoRaAck(600);
    if (ack.length() > 0) {
      Serial.println("[LoRa Rx ACK]: " + ack);
      if (replyToBt) {
        SerialBT.println(ack);
      }
      blinkLed(2, 40);
    } else {
      if (replyToBt) {
        SerialBT.println("ACK|STATUS:RADIO_SENT");
      }
    }
  } else {
    Serial.println("[LoRa Tx ERROR]: Transmission failed.");
  }
  lastPacketSentTime = millis();
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

void blinkLed(int count, int delayMs) {
  for (int i = 0; i < count; i++) {
    digitalWrite(STATUS_LED, HIGH);
    delay(delayMs);
    digitalWrite(STATUS_LED, LOW);
    delay(delayMs);
  }
}
