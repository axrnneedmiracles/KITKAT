const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const cors = require("cors");
const path = require("path");
const os = require("os");

const EmergencyHandler = require("./emergency-handler");
const LoRaReceiverSerial = require("./lora-receiver-serial");
const TinyFishAgent = require("./tinyfish-agent");
const CloudTunnel = require("./cloud-tunnel");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3000;

function getLocalIpAddress() {
  const interfaces = os.networkInterfaces();
  const nonVirtualCandidates = [];
  const allCandidates = [];

  for (const name of Object.keys(interfaces)) {
    const isVirtual = /(vmnet|virtual|hyper-v|vbox|docker|loopback|wsl)/i.test(name);
    for (const net of interfaces[name]) {
      if (net.family === "IPv4" && !net.internal) {
        if (!isVirtual) {
          nonVirtualCandidates.push({ name, address: net.address });
        }
        allCandidates.push({ name, address: net.address });
      }
    }
  }

  // Prioritize real Wi-Fi or LAN connection (e.g. 192.168.1.x)
  const wifiOrLan = nonVirtualCandidates.find(c => /(wi-fi|wireless|ethernet|lan)/i.test(c.name))
    || nonVirtualCandidates.find(c => c.address.startsWith("192.168.1."))
    || nonVirtualCandidates[0]
    || allCandidates[0];

  return wifiOrLan ? wifiOrLan.address : "127.0.0.1";
}

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "../dashboard")));

const emergencyHandler = new EmergencyHandler();

// Broadcast function to notify all connected clients
function broadcast(payload) {
  const message = JSON.stringify(payload);
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

// Initialize TinyFish Autonomous First-Responder AI Agent
const tinyfishAgent = new TinyFishAgent(broadcast);

// Initialize Cloudflare Global Tunnel for distance testing across different networks
const cloudTunnel = new CloudTunnel(PORT);

// Initialize LoRa serial listener for ESP32 #2
const loraSerial = new LoRaReceiverSerial(emergencyHandler, (event) => {
  broadcast({
    type: "TELEMETRY_UPDATE",
    source: "LORA",
    data: event.state
  });

  // Autonomous TinyFish AI Web Agent Dispatch on LoRa Emergency Distress
  if (event.state.isSosActive || (event.state.riskScore && event.state.riskScore >= 80)) {
    tinyfishAgent.triageAndDispatch(event.state, "LORA_RADIO_SOS");
  }
});
loraSerial.init();

// WebSocket connection handling (Mobile App & Web Dashboard)
wss.on("connection", (ws, req) => {
  const clientIp = req.socket.remoteAddress;
  console.log(`[WebSocket] Client connected from ${clientIp}`);
  
  // Send current state on connection
  ws.send(JSON.stringify({
    type: "INIT_STATE",
    data: emergencyHandler.getState(),
    history: emergencyHandler.getHistory()
  }));

  ws.on("message", (message) => {
    try {
      const parsed = JSON.parse(message);
      handleClientMessage(parsed, ws);
    } catch (e) {
      console.error("[WebSocket] Parse error:", e.message);
    }
  });

  ws.on("close", () => {
    console.log(`[WebSocket] Client disconnected from ${clientIp}`);
  });
});

function handleClientMessage(msg, ws) {
  switch (msg.type) {
    case "DEVICE_REGISTER":
      console.log(`📱 [Android Phone Linked]: Model: ${msg.model} (${msg.device})`);
      const registeredState = emergencyHandler.registerDevice(msg);
      broadcast({
        type: "DEVICE_CONNECTED",
        device: msg,
        data: registeredState
      });
      break;

    case "PROFILE_UPDATE":
      console.log(`👤 [WS Profile Sync Rx]: Name: ${msg.data?.userName}, Phone: ${msg.data?.userPhone}, Zones: ${msg.data?.safeLocations?.length || 0}`);
      const profState = emergencyHandler.updateProfile(msg.data || {});
      broadcast({
        type: "PROFILE_UPDATED",
        data: profState
      });
      break;

    case "HEARTBEAT":
      ws.send(JSON.stringify({ type: "HEARTBEAT_ACK", timestamp: Date.now() }));
      break;

    case "TELEMETRY":
    case "EMERGENCY_ALERT":
      const hrVal = parseInt(msg.data?.heartRate?.bpm || msg.data?.heartRate || 0, 10);
      const isCriticalHr = (hrVal > 0 && hrVal <= 40) || hrVal >= 180;
      const isHighRisk = parseInt(msg.data?.riskScore || 0, 10) >= 80;
      const isSos = msg.type === "EMERGENCY_ALERT" || (msg.data && msg.data.isSos) || isCriticalHr || isHighRisk;

      if (isSos) {
        console.log(`🚨 [EMERGENCY SOS/DISTRESS RECEIVED FROM MOBILE]: User: ${msg.data?.userName || 'Aditi Sharma'}, HR: ${hrVal} BPM, Risk: ${msg.data?.riskScore}/100, Lat: ${msg.data?.latitude}, Lon: ${msg.data?.longitude}`);
      } else {
        console.log(`📡 [Mobile Telemetry Rx]: User: ${msg.data?.userName || 'Aditi Sharma'} (${msg.data?.userPhone || ''}), Lat: ${msg.data?.latitude?.toFixed(4)}, Lon: ${msg.data?.longitude?.toFixed(4)}, Batt: ${msg.data?.battery}%, HR: ${hrVal} BPM, Risk: ${msg.data?.riskScore}/100, Motion: ${msg.data?.movement}`);
      }
      
      const updatedState = emergencyHandler.processTelemetry({ ...msg.data, isSos }, "INTERNET");
      broadcast({
        type: isSos ? "EMERGENCY_ALERT" : "TELEMETRY_UPDATE",
        source: "INTERNET",
        data: updatedState
      });

      // Autonomous TinyFish AI First-Responder Dispatch
      if (isSos || updatedState.isSosActive || (updatedState.riskScore && updatedState.riskScore >= 80) || isCriticalHr) {
        tinyfishAgent.triageAndDispatch(updatedState, "MOBILE_WS_SOS");
      }
      break;

    case "TRIGGER_CHECK":
      console.log("🔔 [Dashboard] Operator clicked 'Check If Safe'. Sending challenge to phone...");
      const checkState = emergencyHandler.triggerSafetyCheck();
      // Broadcast to all clients (especially the Android phone so it vibrates and pops up DuressDialog)
      broadcast({
        type: "SAFETY_CHECK_REQUESTED",
        data: checkState
      });
      break;

    case "RESOLVE_CHECK":
      console.log(`✅ [Phone Verification Result]: User entered ${msg.result}`);
      const resolvedState = emergencyHandler.resolveSafetyCheck(msg.result); // SAFE or DURESS
      broadcast({
        type: "SAFETY_CHECK_RESOLVED",
        result: msg.result,
        data: resolvedState
      });
      break;

    case "RESOLVE_SOS":
      const clearedState = emergencyHandler.cancelSos();
      // Close any active TinyFish first-responder dispatches
      tinyfishAgent.getActiveDispatches().forEach(d => tinyfishAgent.resolveDispatch(d.ticketId, "SOS Resolved by User"));
      broadcast({
        type: "TELEMETRY_UPDATE",
        source: "INTERNET",
        data: clearedState
      });
      break;
  }
}

// LoRa Hardware Control Endpoints
app.get("/api/lora/status", (req, res) => {
  res.json({ success: true, data: loraSerial.getStatus() });
});

app.get("/api/lora/ports", async (req, res) => {
  const ports = await loraSerial.getAvailablePorts();
  res.json({ success: true, ports });
});

app.post("/api/lora/connect", (req, res) => {
  const { port, role } = req.body;
  const result = loraSerial.connect(port, role || "LoRa Module A (Receiver)");
  broadcast({
    type: "LORA_STATUS_CHANGED",
    data: loraSerial.getStatus()
  });
  res.json(result);
});

app.post("/api/lora/disconnect", (req, res) => {
  const result = loraSerial.disconnect();
  broadcast({
    type: "LORA_STATUS_CHANGED",
    data: loraSerial.getStatus()
  });
  res.json(result);
});

app.post("/api/lora/ping", (req, res) => {
  const ack = loraSerial.sendAck("PING");
  res.json({ success: true, message: "LoRa Ping / ACK transmitted", ack });
});

// REST API Endpoints
app.get("/api/network-info", (req, res) => {
  const localIp = getLocalIpAddress();
  res.json({
    success: true,
    ip: localIp,
    port: PORT,
    httpUrl: `http://${localIp}:${PORT}`,
    wsUrl: `ws://${localIp}:${PORT}`
  });
});

app.get("/api/status", (req, res) => {
  const localIp = getLocalIpAddress();
  res.json({
    success: true,
    name: "SHEcurity Operations Server",
    status: "ONLINE",
    ip: localIp,
    port: PORT,
    data: emergencyHandler.getState(),
    lora: loraSerial.getStatus()
  });
});

app.get("/api/history", (req, res) => {
  res.json({ success: true, history: emergencyHandler.getHistory() });
});

app.get("/api/routes", (req, res) => {
  res.json({ success: true, routes: emergencyHandler.safeRoutes });
});

app.post("/api/routes", (req, res) => {
  const newRoute = req.body;
  emergencyHandler.addSafeRoute(newRoute);
  broadcast({
    type: "ROUTES_UPDATED",
    routes: emergencyHandler.safeRoutes
  });
  res.json({ success: true, routes: emergencyHandler.safeRoutes });
});

app.delete("/api/routes/:id", (req, res) => {
  const { id } = req.params;
  emergencyHandler.removeSafeRoute(id);
  broadcast({
    type: "ROUTES_UPDATED",
    routes: emergencyHandler.safeRoutes
  });
  res.json({ success: true, routes: emergencyHandler.safeRoutes });
});

// Profile Management Endpoint (Real-time App -> Laptop Sync)
app.post("/api/profile", (req, res) => {
  console.log(`👤 [Profile Sync Rx]: Name: ${req.body.userName}, Phone: ${req.body.userPhone}, Zones: ${req.body.safeLocations?.length || 0}`);
  const updatedState = emergencyHandler.updateProfile(req.body);
  broadcast({
    type: "PROFILE_UPDATED",
    data: updatedState
  });
  res.json({ success: true, message: "Profile synchronized with laptop", data: updatedState });
});

app.get("/api/profile", (req, res) => {
  res.json({
    success: true,
    data: {
      userName: emergencyHandler.userState.userName,
      userPhone: emergencyHandler.userState.userPhone,
      emergencyNotes: emergencyHandler.userState.emergencyNotes,
      safeLocations: emergencyHandler.safeLocations
    }
  });
});

// Safe Locations (Zones) Management Endpoints
app.get("/api/locations", (req, res) => {
  res.json({ success: true, locations: emergencyHandler.safeLocations });
});

app.post("/api/locations", (req, res) => {
  const newLoc = req.body;
  const updated = emergencyHandler.addSafeLocation(newLoc);
  broadcast({
    type: "LOCATIONS_UPDATED",
    locations: emergencyHandler.safeLocations
  });
  res.json({ success: true, locations: emergencyHandler.safeLocations });
});

app.delete("/api/locations/:id", (req, res) => {
  const { id } = req.params;
  emergencyHandler.removeSafeLocation(id);
  broadcast({
    type: "LOCATIONS_UPDATED",
    locations: emergencyHandler.safeLocations
  });
  res.json({ success: true, locations: emergencyHandler.safeLocations });
});

app.post("/api/heartbeat", (req, res) => {
  res.json({ status: "ACK", serverTime: Date.now() });
});

app.post("/api/telemetry", (req, res) => {
  const hrVal = parseInt(req.body.heartRate?.bpm || req.body.heartRate || 0, 10);
  const isCriticalHr = (hrVal > 0 && hrVal <= 40) || hrVal >= 180;
  const isHighRisk = parseInt(req.body.riskScore || 0, 10) >= 80;
  const isEmergency = Boolean(req.body.isSos || isCriticalHr || isHighRisk);

  console.log(`📡 [Mobile HTTP Telemetry Rx]: HR: ${hrVal} BPM, Risk: ${req.body.riskScore}/100, Batt: ${req.body.battery}%, Emergency: ${isEmergency}`);

  const telemetryData = {
    ...req.body,
    isSos: isEmergency ? true : Boolean(req.body.isSos)
  };

  const updatedState = emergencyHandler.processTelemetry(telemetryData, "INTERNET");
  broadcast({
    type: isEmergency ? "EMERGENCY_ALERT" : "TELEMETRY_UPDATE",
    source: "INTERNET",
    data: updatedState
  });

  if (isEmergency || updatedState.isSosActive || (updatedState.riskScore && updatedState.riskScore >= 80) || isCriticalHr) {
    tinyfishAgent.triageAndDispatch(updatedState, "HTTP_REST_TELEMETRY");
  }

  res.json({ success: true, status: isEmergency ? "EMERGENCY_TRIGGERED" : "ACK", data: updatedState });
});

app.post("/api/sos", (req, res) => {
  console.log(`🚨 [Mobile HTTP SOS Rx]: ${req.body.reason || "Manual SOS"}`);
  const sosData = {
    ...req.body,
    isSos: true,
    riskScore: req.body.riskScore || 95
  };
  const updatedState = emergencyHandler.processTelemetry(sosData, "INTERNET");
  broadcast({
    type: "EMERGENCY_ALERT",
    source: "INTERNET",
    data: updatedState
  });

  // Autonomous TinyFish First-Responder Dispatch
  tinyfishAgent.triageAndDispatch(updatedState, "HTTP_REST_SOS");

  res.json({ success: true, status: "EMERGENCY_DISPATCHED", data: updatedState });
});

app.post("/api/resolve-sos", (req, res) => {
  const clearedState = emergencyHandler.cancelSos();
  // Close any active TinyFish first-responder dispatches
  tinyfishAgent.getActiveDispatches().forEach(d => tinyfishAgent.resolveDispatch(d.ticketId, "SOS Cleared by User"));
  broadcast({
    type: "TELEMETRY_UPDATE",
    source: "INTERNET",
    data: clearedState
  });
  res.json({ success: true, status: "EMERGENCY_CLEARED", data: clearedState });
});

// Emergency Services Portal Route (108 Ambulance & 112 Police)
app.get("/emergency-portal", (req, res) => {
  res.sendFile(path.join(__dirname, "../dashboard/emergency-portal.html"));
});

// TinyFish AI Web Agent REST Endpoints
app.get("/api/tinyfish/status", (req, res) => {
  res.json({ success: true, data: tinyfishAgent.getApiKeyStatus() });
});

app.post("/api/tinyfish/config", (req, res) => {
  const { apiKey } = req.body;
  const result = tinyfishAgent.setApiKey(apiKey);
  res.json(result);
});

app.get("/api/tinyfish/dispatches", (req, res) => {
  res.json({
    success: true,
    dispatches: tinyfishAgent.getActiveDispatches(),
    history: tinyfishAgent.getHistory()
  });
});

app.post("/api/tinyfish/dispatch", async (req, res) => {
  try {
    const record = await tinyfishAgent.triageAndDispatch(req.body, "MANUAL_OR_SIM");
    res.json({ success: true, data: record });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/tinyfish/resolve/:ticketId", (req, res) => {
  const { ticketId } = req.params;
  const { note } = req.body || {};
  const result = tinyfishAgent.resolveDispatch(ticketId, note);
  res.json(result);
});

app.post("/api/tinyfish/clear-all", (req, res) => {
  const result = tinyfishAgent.clearAllDispatches();
  res.json(result);
});

app.post("/api/trigger-check", (req, res) => {
  const checkState = emergencyHandler.triggerSafetyCheck();
  broadcast({
    type: "SAFETY_CHECK_REQUESTED",
    data: checkState
  });
  res.json({ success: true, message: "Safety check sent to mobile phone", data: checkState });
});

app.post("/api/resolve-check", (req, res) => {
  const { result } = req.body;
  const resolvedState = emergencyHandler.resolveSafetyCheck(result);
  broadcast({
    type: "SAFETY_CHECK_RESOLVED",
    result,
    data: resolvedState
  });
  res.json({ success: true, result, data: resolvedState });
});

// Cloud Tunnel Status Endpoint
app.get("/api/tunnel-status", (req, res) => {
  const url = cloudTunnel.getUrl();
  res.json({
    active: !!url,
    url: url || null,
    host: url ? url.replace("https://", "") : null
  });
});

server.listen(PORT, "0.0.0.0", () => {
  const localIp = getLocalIpAddress();
  console.log(`=======================================================`);
  console.log(`🛡️  SHEcurity Laptop Operations Hub is RUNNING`);
  console.log(`🌐  Local Dashboard:    http://localhost:${PORT}`);
  console.log(`📱  Same Wi-Fi Sync:    http://${localIp}:${PORT}`);
  console.log(`📡  Local WebSocket:    ws://${localIp}:${PORT}`);
  console.log(`=======================================================`);

  // Auto-launch Cloudflare Tunnel for distance & cellular testing
  if (process.env.ENABLE_TUNNEL !== "false") {
    cloudTunnel.start((tunnelUrl) => {
      broadcast({
        type: "TUNNEL_READY",
        url: tunnelUrl,
        host: tunnelUrl.replace("https://", "")
      });
    });
  }
});
