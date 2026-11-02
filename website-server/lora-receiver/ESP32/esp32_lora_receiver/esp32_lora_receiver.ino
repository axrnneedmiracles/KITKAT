/**
 * ============================================================================
 * SHEcurity — ESP32 #2 LoRa to USB Serial Receiver (Base Station on Laptop)
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
 *   - VCC        -> 3.3V ONLY (DO NOT CONNECT TO 5V!)
 *   - GND        -> GND
 *
 * Baud Rate: 115200 bps
 * ============================================================================
 */

#include <SPI.h>
#include <LoRa.h>

#define LORA_SS    5
#define LORA_RST   14
#define LORA_DIO0  2
#define LORA_BAND  433000000L // 433.00 MHz ISM Band

#if defined(LED_BUILTIN) && (LED_BUILTIN != LORA_DIO0)
  #define STATUS_LED LED_BUILTIN
#else
  #define STATUS_LED 4
#endif

void setup() {
  Serial.begin(115200);
  delay(500);
  
  pinMode(STATUS_LED, OUTPUT);
  digitalWrite(STATUS_LED, LOW);

  Serial.println("[ESP32-Rx] Booting SHEcurity LoRa Receiver Base Station...");

  LoRa.setPins(LORA_SS, LORA_RST, LORA_DIO0);

  if (!LoRa.begin(LORA_BAND)) {
    Serial.println("[ESP32-Rx] ERROR: LoRa init failed! Check wiring & 3.3V power.");
    while (1) {
      digitalWrite(STATUS_LED, HIGH);
      delay(200);
      digitalWrite(STATUS_LED, LOW);
      delay(200);
    }
  }

  // ── Optimized High-Power Fast-Response Radio Parameters (Matches Transmitter!) ──
  LoRa.setTxPower(20);              // 20 dBm = 100 mW (PA_BOOST, for ACK replies)
  LoRa.setSpreadingFactor(7);       // SF7: Instant 35ms packet airtime
  LoRa.setSignalBandwidth(125E3);   // 125 kHz: Rock-solid lock, zero crystal drift
  LoRa.setCodingRate4(5);           // CR 4/5: Fast Forward Error Correction
  LoRa.setSyncWord(0x12);           // Standard sync word
  LoRa.enableCrc();

  Serial.println("[ESP32-Rx] ✅ LoRa Receiver Ready on 433.00 MHz (SF7, BW125k, CR4/5, 20dBm)");
  Serial.println("[ESP32-Rx] ⚡ Mode: Lightning Fast (35ms airtime) + 100mW RF Boost");
  blinkLed(3, 100);
}

void loop() {
  // 1. Check for incoming LoRa packet
  int packetSize = LoRa.parsePacket();
  if (packetSize) {
    digitalWrite(STATUS_LED, HIGH);
    
    String receivedData = "";
    while (LoRa.available()) {
      receivedData += (char)LoRa.read();
    }
    receivedData.trim();

    int rssi = LoRa.packetRssi();
    float snr = LoRa.packetSnr();

    // Forward telemetry packet directly to Laptop Serial
    if (receivedData.length() > 0) {
      Serial.println(receivedData);
    }

    // Auto-reply with LoRa ACK if it's not already an ACK
    if (!receivedData.startsWith("ACK")) {
      delay(40); // 40ms pause so transmitter switches back to RX mode
      LoRa.beginPacket();
      LoRa.print("ACK|UID27|OK");
      LoRa.endPacket();
    }

    digitalWrite(STATUS_LED, LOW);
  }

  // 2. Allow laptop backend to send ACK downlinks via USB Serial
  if (Serial.available()) {
    String cmd = Serial.readStringUntil('\n');
    cmd.trim();
    if (cmd.startsWith("ACK")) {
      digitalWrite(STATUS_LED, HIGH);
      LoRa.beginPacket();
      LoRa.print(cmd);
      LoRa.endPacket();
      digitalWrite(STATUS_LED, LOW);
    }
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
