/**
 * LORA TEST RECEIVER - Listens and prints anything received
 * Flash this on the RECEIVER ESP32 (the one on COM13)
 * 
 * Wiring ESP32 -> SX1278:
 *   NSS/CS  -> GPIO 5
 *   RST     -> GPIO 14
 *   DIO0    -> GPIO 2
 *   SCK     -> GPIO 18
 *   MISO    -> GPIO 19
 *   MOSI    -> GPIO 23
 *   VCC     -> 3.3V
 *   GND     -> GND
 */

#include <SPI.h>
#include <LoRa.h>

#define LORA_SS    5
#define LORA_RST   14
#define LORA_DIO0  2

void setup() {
  Serial.begin(115200);
  delay(1000);
  
  Serial.println("=== LORA RX TEST ===");
  
  LoRa.setPins(LORA_SS, LORA_RST, LORA_DIO0);
  
  if (!LoRa.begin(433000000)) {
    Serial.println("ERROR: LoRa FAILED! Check wiring!");
    while (1) delay(1000);
  }
  
  LoRa.setSpreadingFactor(7);
  LoRa.setSignalBandwidth(125E3);
  LoRa.setCodingRate4(5);
  LoRa.setSyncWord(0x12);
  LoRa.enableCrc();
  
  Serial.println("LoRa RX Ready! Waiting for packets...");
}

void loop() {
  int packetSize = LoRa.parsePacket();
  if (packetSize) {
    String data = "";
    while (LoRa.available()) {
      data += (char)LoRa.read();
    }
    
    int rssi = LoRa.packetRssi();
    float snr = LoRa.packetSnr();
    
    Serial.print(">> RECEIVED: ");
    Serial.print(data);
    Serial.print(" | RSSI: ");
    Serial.print(rssi);
    Serial.print(" | SNR: ");
    Serial.println(snr);
  }
}
