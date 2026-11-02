/**
 * LORA TEST TRANSMITTER - Sends a packet every 3 seconds
 * Flash this on the TRANSMITTER ESP32 (NOT the one on COM13)
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

int counter = 0;

void setup() {
  Serial.begin(115200);
  delay(1000);
  
  Serial.println("=== LORA TX TEST ===");
  
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
  
  Serial.println("LoRa TX Ready! Sending packets every 3 seconds...");
}

void loop() {
  counter++;
  String packet = "HELLO_" + String(counter);
  
  Serial.print("Sending: ");
  Serial.println(packet);
  
  LoRa.beginPacket();
  LoRa.print(packet);
  int result = LoRa.endPacket();
  
  if (result) {
    Serial.println(">> SENT OK");
  } else {
    Serial.println(">> SEND FAILED");
  }
  
  delay(3000);
}
