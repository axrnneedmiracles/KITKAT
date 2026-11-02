/**
 * ============================================================================
 * SHEcurity — Range Test: LoRa Receiver (ESP32 #2)
 * ============================================================================
 * PURPOSE:
 *   Standalone range test sketch. Listens for test packets from
 *   range_test_transmitter.ino, prints RSSI and SNR for each received
 *   packet, and sends back an ACK. Open Serial Monitor on both ESP32s
 *   and walk away to measure effective range.
 *
 * Hardware:
 *   - ESP32 NodeMCU / DevKit V1
 *   - SX1278 (Ra-02 433MHz) LoRa SPI Module
 *   - 100 µF Electrolytic Capacitor across SX1278 VCC–GND (RECOMMENDED)
 *   - 433 MHz Antenna (17.3 cm wire or spring coil)
 *
 * Pinout Connections (ESP32 → SX1278 Ra-02):
 *   ┌──────────────┬────────────────┐
 *   │   ESP32 Pin  │  SX1278 Pin    │
 *   ├──────────────┼────────────────┤
 *   │   3.3V       │  VCC (3.3V!)   │◄── Cap (+) leg here
 *   │   GND        │  GND           │◄── Cap (–) leg here
 *   │   GPIO 5     │  NSS / CS      │
 *   │   GPIO 14    │  RST / RESET   │
 *   │   GPIO 2     │  DIO0 / IRQ    │
 *   │   GPIO 18    │  SCK           │
 *   │   GPIO 19    │  MISO          │
 *   │   GPIO 23    │  MOSI          │
 *   │   —          │  ANT → Antenna │
 *   └──────────────┴────────────────┘
 *
 *   ⚠️ CAPACITOR: Solder/place a 100 µF (or up to 470 µF, 10V+) electrolytic
 *      capacitor across the SX1278's VCC and GND pins, as close to the module
 *      as possible. The (+) stripe goes to VCC, the (–) stripe goes to GND.
 *      This smooths the 3.3V rail during 100mW transmit bursts.
 *
 * Baud Rate: 115200 bps
 * ============================================================================
 */

#include <SPI.h>
#include <LoRa.h>

#define LORA_SS    5
#define LORA_RST   14
#define LORA_DIO0  2
#define LORA_BAND  433000000L   // 433.00 MHz ISM Band

#if defined(LED_BUILTIN) && (LED_BUILTIN != LORA_DIO0)
  #define STATUS_LED LED_BUILTIN
#else
  #define STATUS_LED 4
#endif

int packetsReceived = 0;
int packetsMissed = 0;
int lastPacketNum = 0;

void setup() {
  Serial.begin(115200);
  delay(500);

  pinMode(STATUS_LED, OUTPUT);
  digitalWrite(STATUS_LED, LOW);

  Serial.println("\n=========================================");
  Serial.println("  SHEcurity LoRa RANGE TEST — Receiver");
  Serial.println("=========================================");

  LoRa.setPins(LORA_SS, LORA_RST, LORA_DIO0);

  if (!LoRa.begin(LORA_BAND)) {
    Serial.println("[RX] ERROR: LoRa init failed! Check wiring & 3.3V power.");
    while (1) {
      digitalWrite(STATUS_LED, HIGH);
      delay(200);
      digitalWrite(STATUS_LED, LOW);
      delay(200);
    }
  }

  // ── Optimized High-Power Fast-Response Radio Parameters (Matches Transmitter!) ──
  LoRa.setTxPower(20);              // 20 dBm for ACK replies
  LoRa.setSpreadingFactor(7);       // SF7: Instant 35ms packet airtime
  LoRa.setSignalBandwidth(125E3);   // 125 kHz: Rock-solid lock, zero crystal drift
  LoRa.setCodingRate4(5);           // CR 4/5: Fast Forward Error Correction
  LoRa.setSyncWord(0x12);
  LoRa.enableCrc();

  Serial.println("[RX] ✅ LoRa Ready (SF7, BW125k, CR4/5, 20dBm, CRC ON)");
  Serial.println("[RX] ⚡ Mode: Lightning Fast (35ms airtime) + 100mW RF Boost");
  Serial.println("[RX] Listening for range test packets...\n");
  blinkLed(3, 100);
}

void loop() {
  int packetSize = LoRa.parsePacket();
  if (packetSize) {
    digitalWrite(STATUS_LED, HIGH);

    String receivedData = "";
    while (LoRa.available()) {
      receivedData += (char)LoRa.read();
    }
    receivedData.trim();

    // Output pure telemetry line directly for website backend compatibility
    if (receivedData.length() > 0) {
      Serial.println(receivedData);
    }

    int rssi = LoRa.packetRssi();
    float snr = LoRa.packetSnr();

    packetsReceived++;

    // Extract packet number to detect missed packets
    int pktIdx = receivedData.indexOf("PKT:");
    if (pktIdx >= 0) {
      int endIdx = receivedData.indexOf("|", pktIdx + 4);
      if (endIdx < 0) endIdx = receivedData.length();
      int currentPktNum = receivedData.substring(pktIdx + 4, endIdx).toInt();
      if (lastPacketNum > 0 && currentPktNum > lastPacketNum + 1) {
        int missed = currentPktNum - lastPacketNum - 1;
        packetsMissed += missed;
        Serial.printf("[RX] ⚠️ Missed %d packet(s)! (expected #%d, got #%d)\n",
                      missed, lastPacketNum + 1, currentPktNum);
      }
      lastPacketNum = currentPktNum;
    }

    // ── Signal Quality Report ──
    Serial.println("┌──────────────────────────────────────┐");
    Serial.printf( "│ PACKET #%d RECEIVED                   \n", packetsReceived);
    Serial.printf( "│ Data: %s\n", receivedData.c_str());
    Serial.printf( "│ RSSI: %d dBm\n", rssi);
    Serial.printf( "│ SNR:  %.1f dB\n", snr);
    Serial.printf( "│ Size: %d bytes\n", packetSize);

    // ── Link Quality Assessment ──
    String quality;
    if (rssi > -80)       quality = "🟢 EXCELLENT";
    else if (rssi > -100) quality = "🟡 GOOD";
    else if (rssi > -115) quality = "🟠 WEAK (edge of range)";
    else                  quality = "🔴 CRITICAL (packet loss imminent)";

    Serial.printf( "│ Link: %s\n", quality.c_str());
    Serial.printf( "│ Stats: %d received, %d missed (%.1f%% loss)\n",
                   packetsReceived, packetsMissed,
                   packetsReceived + packetsMissed > 0
                     ? (packetsMissed * 100.0 / (packetsReceived + packetsMissed))
                     : 0.0);
    Serial.println("└──────────────────────────────────────┘");

    // Send ACK back with signal quality report
    if (receivedData.length() > 0) {
      delay(100); // Let transmitter switch to RX
      LoRa.beginPacket();
      LoRa.print("ACK|RANGE|RSSI:" + String(rssi) + "|SNR:" + String(snr, 1));
      LoRa.endPacket();
      Serial.println("[RX] ✅ ACK sent with signal report\n");
    }

    digitalWrite(STATUS_LED, LOW);
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
