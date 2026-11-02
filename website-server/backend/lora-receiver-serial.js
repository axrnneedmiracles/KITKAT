/**
 * LoRa Receiver Serial Bridge
 * Connects to ESP32 LoRa Module (Module A or Module B) via USB Serial.
 * Supports dynamic port selection, connection state reporting,
 * and bidirectional ACK/packet transmission.
 */

let SerialPort = null;
let ReadlineParser = null;

try {
  const serialModule = require("serialport");
  SerialPort = serialModule.SerialPort;
  ReadlineParser = require("@serialport/parser-readline").ReadlineParser;
} catch (e) {
  console.log("[LoRaSerial] Native serialport library not available. Virtual mock serial mode enabled.");
}

class LoRaReceiverSerial {
  constructor(emergencyHandler, broadcastCallback) {
    this.emergencyHandler = emergencyHandler;
    this.broadcastCallback = broadcastCallback;
    this.port = null;
    this.parser = null;
    this.isConnected = false;
    this.portName = process.env.LORA_COM_PORT || "COM13";
    this.moduleRole = "LoRa Module A (Receiver)";
    this.baudRate = 115200;
    this.packetsReceived = 0;
    this.lastPacket = null;
    this.lastPacketTime = null;
  }

  async getAvailablePorts() {
    if (!SerialPort) {
      return [
        { path: "COM13", friendlyName: "COM13 - ESP32 LoRa USB Receiver (Default)", manufacturer: "Silicon Labs / Espressif" },
        { path: "COM3", friendlyName: "ESP32 LoRa Module A (Virtual)", manufacturer: "Silicon Labs" },
        { path: "COM4", friendlyName: "ESP32 LoRa Module B (Virtual)", manufacturer: "Espressif" }
      ];
    }
    try {
      const ports = await SerialPort.list();
      const mapped = ports.map(p => ({
        path: p.path,
        friendlyName: p.friendlyName || p.path,
        manufacturer: p.manufacturer || "Serial Device"
      }));

      // Ensure COM13 is prioritized and listed
      const hasCom13 = mapped.some(p => p.path && p.path.toUpperCase() === "COM13");
      if (!hasCom13) {
        mapped.unshift({
          path: "COM13",
          friendlyName: "COM13 - ESP32 LoRa USB Receiver (Default)",
          manufacturer: "Silicon Labs / CH340 / CP2102"
        });
      } else {
        // Move COM13 to the very top
        mapped.sort((a, b) => (a.path.toUpperCase() === "COM13" ? -1 : b.path.toUpperCase() === "COM13" ? 1 : 0));
      }
      return mapped;
    } catch (e) {
      return [{ path: "COM13", friendlyName: "COM13 - ESP32 USB Receiver", manufacturer: "Espressif" }];
    }
  }

  getStatus() {
    return {
      isConnected: this.isConnected,
      portName: this.portName,
      moduleRole: this.moduleRole,
      baudRate: this.baudRate,
      packetsReceived: this.packetsReceived,
      lastPacket: this.lastPacket,
      lastPacketTime: this.lastPacketTime
    };
  }

  async init() {
    if (!SerialPort) {
      console.log("[LoRaSerial] Running in simulated USB mode for COM13.");
      return;
    }

    try {
      const ports = await SerialPort.list();
      console.log(`[LoRaSerial] Serial ports detected: ${ports.map(p => p.path).join(", ") || "None"}`);
      console.log("[LoRaSerial] Ready. (Port kept unlocked so you can flash ESP32 via Arduino IDE. Use web dashboard 'Connect LoRa' button to connect when flashed).");
    } catch (err) {
      console.warn("[LoRaSerial] Serial detection warning:", err.message);
    }
  }

  connect(portPath, role = "LoRa Module A (Receiver)") {
    if (!SerialPort) {
      this.isConnected = true;
      this.portName = portPath;
      this.moduleRole = role;
      console.log(`[LoRaSerial] ✅ Connected to ${role} on ${portPath} (Simulated)`);
      return { success: true, message: `Connected to ${role} on ${portPath}` };
    }

    try {
      if (this.port && this.port.isOpen) {
        this.port.close();
      }

      this.port = new SerialPort({
        path: portPath,
        baudRate: this.baudRate,
        autoOpen: true
      });

      this.parser = this.port.pipe(new ReadlineParser({ delimiter: "\n" }));

      this.port.on("open", () => {
        this.isConnected = true;
        this.portName = portPath;
        this.moduleRole = role;
        console.log(`[LoRaSerial] ✅ Connected to ${role} on ${portPath}`);
      });

      this.parser.on("data", line => {
        this.handleSerialData(line);
      });

      this.port.on("error", err => {
        console.error(`[LoRaSerial] Serial port error:`, err.message);
        this.isConnected = false;
      });

      this.port.on("close", () => {
        console.log(`[LoRaSerial] Port ${portPath} closed.`);
        this.isConnected = false;
      });

      return { success: true, message: `Connected to ${role} on ${portPath}` };
    } catch (err) {
      console.error(`[LoRaSerial] Could not open ${portPath}:`, err.message);
      return { success: false, error: err.message };
    }
  }

  disconnect() {
    if (this.port && this.port.isOpen) {
      this.port.close();
    }
    this.isConnected = false;
    this.portName = null;
    return { success: true, message: "LoRa Module disconnected" };
  }

  handleSerialData(rawLine) {
    const line = rawLine.trim();
    if (!line) return;

    // Skip echo / ACK loop responses to prevent circular transmissions
    if (line.startsWith("ACK|") || line === "PING") {
      return;
    }

    // Check if line contains valid LoRa telemetry content (either pipe-delimited or contains key tags)
    const isTelemetry = line.includes("|") || line.includes("SHE") || line.includes("LT") || line.includes("SOS");
    if (!isTelemetry) {
      console.log(`[LoRaSerial Debug]: ${line}`);
      return;
    }

    console.log(`[LoRaSerial Rx Telemetry]: ${line}`);

    this.packetsReceived++;
    this.lastPacket = line;
    this.lastPacketTime = new Date().toISOString();

    const updatedState = this.emergencyHandler.processCompactLoraPacket(line);
    if (updatedState) {
      this.sendAck("UID27");
      if (this.broadcastCallback) {
        this.broadcastCallback({
          type: "LORA_PACKET_RECEIVED",
          raw: line,
          module: this.moduleRole,
          state: updatedState
        });
      }
    }
  }

  sendAck(userId = "UID27") {
    const ackPacket = `ACK|${userId}|OK\n`;
    console.log(`[LoRaSerial Tx ACK]: ${ackPacket.trim()}`);
    if (this.port && this.isConnected) {
      this.port.write(ackPacket, err => {
        if (err) console.error("[LoRaSerial] ACK write error:", err.message);
      });
    }
    return ackPacket.trim();
  }

  simulatePacket(packetString) {
    console.log(`[LoRaSerial] 📡 Injecting simulated LoRa packet: ${packetString}`);
    this.handleSerialData(packetString);
    return this.sendAck();
  }
}

module.exports = LoRaReceiverSerial;
