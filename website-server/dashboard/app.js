/**
 * BLACKNET Operations Dashboard Frontend Logic
 * Independent Tactical Network (Tactical Mesh, LoRa, Multi-Signal Assessment)
 */

let map = null;
let userMarker = null;
let userRadarCircle = null;
let safeRoutePolyline = null;
let breadcrumbPolyline = null;
let breadcrumbs = [];
let safeZoneCircles = [];
let ws = null;
let activeState = null;
let hasReceivedFirstGps = false;
let selectedLoraRole = "LoRa Module A (Receiver)";

// Real-time Clock
setInterval(() => {
  const clockEl = document.getElementById("live-clock");
  if (clockEl) {
    const now = new Date();
    clockEl.innerText = now.toTimeString().split(" ")[0];
  }
}, 1000);

// Initialize application
window.addEventListener("DOMContentLoaded", () => {
  initDelhiMapAndNeuralNetwork();
  initAnimatedGradientBackground();
  initDashboardAmbientTacticalBackground();
  initMap();
  initWebSocket();
  fetchNetworkInfo();
  fetchInitialState();
  fetchHistory();
  fetchLoraStatus();
  fetchTunnelInfo();
  setInterval(fetchTunnelInfo, 5000);
});

function fetchTunnelInfo() {
  fetch("/api/tunnel-status")
    .then(r => r.json())
    .then(res => {
      const chip = document.getElementById("cloud-tunnel-chip");
      const hostEl = document.getElementById("cloud-tunnel-ip");
      if (res && res.active && res.host) {
        if (hostEl) hostEl.innerText = res.host;
        if (chip) chip.style.display = "inline-flex";
      } else {
        if (chip) chip.style.display = "none";
      }
    })
    .catch(() => {});
}

window.copyCloudTunnelEndpoint = function(el) {
  const hostEl = document.getElementById("cloud-tunnel-ip");
  if (!hostEl) return;
  const rawHost = hostEl.innerText.trim();
  const fullUrl = "https://" + rawHost;
  navigator.clipboard.writeText(rawHost).then(() => {
    alert("✅ Copied Cloud Tunnel Address to clipboard:\n\n" + rawHost + "\n\nIn your BLACKNET Android app:\n1. Tap the Server/Host icon\n2. Paste: " + rawHost + "\n3. Tap Connect!\n\n(Works on any 4G/5G mobile network or distant Wi-Fi!)");
  }).catch(() => {
    prompt("Copy this Cloud Tunnel address for your phone app:", rawHost);
  });
};

function fetchNetworkInfo() {
  fetch("/api/network-info")
    .then(r => r.json())
    .then(res => {
      if (res.success && res.ip) {
        const hostIpEl = document.getElementById("server-host-ip");
        const hostLabel = document.querySelector(".nav-host-chip .host-label");
        if (hostIpEl) {
          hostIpEl.innerText = res.isVercel ? res.ip : `${res.ip}:${res.port}`;
        }
        if (hostLabel && res.isVercel) {
          hostLabel.innerText = "CLOUD HOST";
        }
        const bannerIp = document.querySelector("#sync-banner .ip-code");
        if (bannerIp) {
          bannerIp.innerText = res.isVercel ? res.ip : `${res.ip}:${res.port}`;
        }
      }
    })
    .catch(console.error);
}

/**
 * Noisy Gradient Background Engine
 * Integrates procedural radial gradient positioning with a dynamic 2D canvas grain noise generator.
 */
function initAnimatedGradientBackground() {
  const surface = document.getElementById("animated-gradient-surface");
  const noiseCanvas = document.getElementById("noisy-gradient-canvas");
  if (!surface) return;

  // 1. Warm cream/ivory ambient radial gradient for clean professional aesthetic
  const colors = [
    { color: "rgba(245, 240, 230, 0.95)", stop: "0%" },
    { color: "rgba(238, 232, 220, 0.95)", stop: "35%" },
    { color: "rgba(230, 222, 208, 1)", stop: "70%" },
    { color: "rgba(220, 210, 194, 1)", stop: "100%" }
  ];
  const colorStops = colors.map(({ color, stop }) => `${color} ${stop}`).join(",");
  surface.style.background = `radial-gradient(125% 125% at 50% 101%, ${colorStops})`;

  // Breathing animation for gradient position
  let frameCount = 0;
  function animateGradient() {
    frameCount += 0.005;
    const posY = 101 + Math.sin(frameCount) * 3;
    surface.style.background = `radial-gradient(125% 125% at 50% ${posY}%, ${colorStops})`;
    requestAnimationFrame(animateGradient);
  }
  requestAnimationFrame(animateGradient);

  // 2. Canvas Noise Grain Generator
  if (!noiseCanvas) return;
  const ctx = noiseCanvas.getContext("2d");
  if (!ctx) return;

  const patternSize = 100;
  const patternAlpha = 18; // Subtle warm matte paper grain texture
  const intensity = 1.0;
  const patternRefreshInterval = 1;

  const patternCanvas = document.createElement("canvas");
  patternCanvas.width = patternSize;
  patternCanvas.height = patternSize;
  const patternCtx = patternCanvas.getContext("2d");
  if (!patternCtx) return;

  const patternData = patternCtx.createImageData(patternSize, patternSize);
  const pixelLen = patternSize * patternSize * 4;

  let canvasWidth = 0;
  let canvasHeight = 0;

  const resize = () => {
    const dpr = window.devicePixelRatio || 1;
    canvasWidth = window.innerWidth;
    canvasHeight = window.innerHeight;
    noiseCanvas.width = canvasWidth * dpr;
    noiseCanvas.height = canvasHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  const updatePattern = () => {
    for (let i = 0; i < pixelLen; i += 4) {
      const val = Math.random() * 255 * intensity;
      patternData.data[i] = val;
      patternData.data[i + 1] = val;
      patternData.data[i + 2] = val;
      patternData.data[i + 3] = patternAlpha;
    }
    patternCtx.putImageData(patternData, 0, 0);
  };

  const drawGrain = () => {
    if (canvasWidth === 0 || canvasHeight === 0) return;
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    ctx.save();
    const fillPattern = ctx.createPattern(patternCanvas, "repeat");
    if (fillPattern) {
      ctx.fillStyle = fillPattern;
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    }
    ctx.restore();
  };

  let noiseFrame = 0;
  const noiseLoop = () => {
    if (noiseFrame % patternRefreshInterval === 0) {
      updatePattern();
      drawGrain();
    }
    noiseFrame++;
    requestAnimationFrame(noiseLoop);
  };

  window.addEventListener("resize", resize);
  resize();
  updatePattern();
  drawGrain();
  noiseLoop();
}

/**
 * Low-Opacity Ambient Neural Network Background Engine for Dashboard Panel
 * Renders a full-screen interactive constellation of neural nodes, synapses,
 * and high-tech signal packet pulses in low opacity behind the operations cards.
 */
function initDashboardAmbientTacticalBackground() {
  const canvas = document.getElementById("ambient-dashboard-canvas");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  let width = window.innerWidth;
  let height = window.innerHeight;

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener("resize", resize);
  resize();

  // Mouse Parallax & Dynamic Interaction
  let ambientMouseX = 0;
  let ambientMouseY = 0;
  let targetParallaxX = 0;
  let targetParallaxY = 0;
  let rawCursorX = -1000;
  let rawCursorY = -1000;

  window.addEventListener("mousemove", (e) => {
    const halfW = window.innerWidth / 2;
    const halfH = window.innerHeight / 2;
    targetParallaxX = (e.clientX - halfW) * 0.018;
    targetParallaxY = (e.clientY - halfH) * 0.018;
    rawCursorX = e.clientX;
    rawCursorY = e.clientY;
  });

  window.addEventListener("mouseleave", () => {
    rawCursorX = -1000;
    rawCursorY = -1000;
  });

  // Full-Screen Ambient Neural Network Mesh (Dense coverage across all gutters & margins)
  const nodeCount = Math.max(90, Math.min(160, Math.floor((width * height) / 10000)));
  const neuralNodes = [];
  for (let i = 0; i < nodeCount; i++) {
    const roll = Math.random();
    neuralNodes.push({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.42,
      vy: (Math.random() - 0.5) * 0.42,
      radius: 2.2 + Math.random() * 2.2,
      isCrimson: roll < 0.24,
      isAmber: roll >= 0.24 && roll < 0.38,
      pulseOffset: Math.random() * Math.PI * 2
    });
  }

  // Real-time data transmission pulses along synapses across full screen
  const dataPacketCount = 22;
  const dataPackets = [];
  for (let i = 0; i < dataPacketCount; i++) {
    dataPackets.push({
      sourceIdx: Math.floor(Math.random() * nodeCount),
      targetIdx: Math.floor(Math.random() * nodeCount),
      progress: Math.random(),
      speed: 0.004 + Math.random() * 0.008,
      color: Math.random() < 0.65 ? "#dc2626" : "#ea580c"
    });
  }

  const maxDist = 155;

  function renderAmbient() {
    ctx.clearRect(0, 0, width, height);

    ambientMouseX += (targetParallaxX - ambientMouseX) * 0.04;
    ambientMouseY += (targetParallaxY - ambientMouseY) * 0.04;

    const now = performance.now() * 0.002;

    // 1. Update node physics & interactive cursor repulsion
    for (let i = 0; i < neuralNodes.length; i++) {
      const node = neuralNodes[i];
      node.x += node.vx;
      node.y += node.vy;

      // Soft bounce on edges
      if (node.x < 15) { node.x = 15; node.vx = Math.abs(node.vx); }
      if (node.x > width - 15) { node.x = width - 15; node.vx = -Math.abs(node.vx); }
      if (node.y < 15) { node.y = 15; node.vy = Math.abs(node.vy); }
      if (node.y > height - 15) { node.y = height - 15; node.vy = -Math.abs(node.vy); }

      // Cursor interaction
      if (rawCursorX > 0 && rawCursorY > 0) {
        const dx = node.x - rawCursorX;
        const dy = node.y - rawCursorY;
        const distToCursor = Math.hypot(dx, dy);
        if (distToCursor < 140 && distToCursor > 0) {
          const force = (1 - distToCursor / 140) * 0.6;
          node.x += (dx / distToCursor) * force;
          node.y += (dy / distToCursor) * force;
        }
      }
    }

    // 2. Draw Full-Screen Synapses spanning card gaps & margins
    for (let i = 0; i < neuralNodes.length; i++) {
      for (let j = i + 1; j < neuralNodes.length; j++) {
        const n1 = neuralNodes[i];
        const n2 = neuralNodes[j];
        const dist = Math.hypot(n1.x - n2.x, n1.y - n2.y);
        if (dist < maxDist) {
          const alpha = (1 - dist / maxDist) * 0.75;
          ctx.strokeStyle = `rgba(51, 65, 85, ${alpha})`;
          ctx.lineWidth = 1.3;
          ctx.beginPath();
          ctx.moveTo(n1.x + ambientMouseX, n1.y + ambientMouseY);
          ctx.lineTo(n2.x + ambientMouseX, n2.y + ambientMouseY);
          ctx.stroke();
        }
      }
    }

    // 3. Draw Glowing Data Transmission Pulses
    for (let i = 0; i < dataPackets.length; i++) {
      const pkt = dataPackets[i];
      pkt.progress += pkt.speed;
      if (pkt.progress >= 1) {
        pkt.progress = 0;
        pkt.sourceIdx = Math.floor(Math.random() * neuralNodes.length);
        pkt.targetIdx = Math.floor(Math.random() * neuralNodes.length);
      }

      const sNode = neuralNodes[pkt.sourceIdx];
      const tNode = neuralNodes[pkt.targetIdx];
      const dist = Math.hypot(sNode.x - tNode.x, sNode.y - tNode.y);

      if (dist < maxDist) {
        const px = sNode.x + (tNode.x - sNode.x) * pkt.progress + ambientMouseX;
        const py = sNode.y + (tNode.y - sNode.y) * pkt.progress + ambientMouseY;

        // Glowing packet core
        ctx.fillStyle = pkt.color;
        ctx.beginPath();
        ctx.arc(px, py, 3.2, 0, Math.PI * 2);
        ctx.fill();

        // Distinct pulse halo
        ctx.fillStyle = pkt.color === "#dc2626" ? "rgba(220, 38, 38, 0.45)" : "rgba(234, 88, 12, 0.4)";
        ctx.beginPath();
        ctx.arc(px, py, 7, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 4. Draw Neural Nodes
    for (let i = 0; i < neuralNodes.length; i++) {
      const node = neuralNodes[i];
      const pulse = Math.sin(now + node.pulseOffset) * 0.8;
      const px = node.x + ambientMouseX;
      const py = node.y + ambientMouseY;

      if (node.isCrimson) {
        // Crimson signal hub
        ctx.strokeStyle = "rgba(220, 38, 38, 0.5)";
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.arc(px, py, node.radius + 4.5 + pulse, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = "rgba(220, 38, 38, 0.95)";
        ctx.beginPath();
        ctx.arc(px, py, node.radius + pulse * 0.5, 0, Math.PI * 2);
        ctx.fill();
      } else if (node.isAmber) {
        // Amber relay node
        ctx.strokeStyle = "rgba(234, 88, 12, 0.45)";
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(px, py, node.radius + 3.5 + pulse, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = "rgba(234, 88, 12, 0.9)";
        ctx.beginPath();
        ctx.arc(px, py, node.radius + pulse * 0.5, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Tactical dark slate core
        ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
        ctx.beginPath();
        ctx.arc(px, py, node.radius, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    requestAnimationFrame(renderAmbient);
  }

  requestAnimationFrame(renderAmbient);
}

function initMap() {
  const defaultCoords = [28.6139, 77.2090];
  map = L.map("map-container", {
    zoomControl: true,
    attributionControl: false
  }).setView(defaultCoords, 14);

  // 1. Official OpenStreetMap Standard (100% Free, Open-Source, No API Key)
  const osmStandard = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors'
  });

  // 2. CARTO Voyager / Light (Clean Open Street Map view)
  const cartoLight = L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/" target="_blank">CARTO</a>'
  });

  // 3. CARTO Dark Matter (Tactical Dark Map)
  const cartoDark = L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/" target="_blank">CARTO</a>'
  });

  // 4. OpenTopoMap (Topographic Open Street Map view)
  const openTopo = L.tileLayer("https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png", {
    maxZoom: 17,
    attribution: 'Map data: &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors, SRTM | Map style: &copy; <a href="https://opentopomap.org" target="_blank">OpenTopoMap</a>'
  });

  // Set OpenStreetMap Standard as default tile layer (Clean White-ish Map)
  osmStandard.addTo(map);

  const baseMaps = {
    "🗺️ OpenStreetMap Standard": osmStandard,
    "🧭 OpenStreetMap Voyager (Light)": cartoLight,
    "🌑 CARTO Dark Matter (Tactical)": cartoDark,
    "🏔️ OpenTopoMap (Terrain)": openTopo
  };
  L.control.layers(baseMaps, null, { position: "topleft" }).addTo(map);

  // Live Phone GPS Marker
  const userIcon = L.divIcon({
    className: "custom-user-marker",
    html: `<div id="user-pin-dot" class="user-pin-dot" style="background:#e63946; width:18px; height:18px; border-radius:50%; border:2px solid #fff; box-shadow: 0 0 16px rgba(230, 57, 70, 0.6);"></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9]
  });

  userMarker = L.marker(defaultCoords, { icon: userIcon }).addTo(map);
  userMarker.bindPopup("<b>Target Tactical Node: BLACK-027</b><br>Awaiting Live GPS Signal...").openPopup();

  userRadarCircle = L.circle(defaultCoords, {
    radius: 35,
    color: "#e63946",
    fillColor: "#e63946",
    fillOpacity: 0.15,
    weight: 1
  }).addTo(map);

  breadcrumbPolyline = L.polyline([], {
    color: "#94a3b8",
    weight: 2,
    dashArray: "4, 6",
    opacity: 0.7
  }).addTo(map);
}

let pollingFallbackInterval = null;

function startPollingFallback() {
  if (pollingFallbackInterval) return;
  console.log("[Sync] Live HTTP polling fallback enabled (for Vercel / serverless cloud host).");
  pollingFallbackInterval = setInterval(() => {
    fetchInitialState();
    fetchHistory();
  }, 2500);
}

function stopPollingFallback() {
  if (pollingFallbackInterval) {
    clearInterval(pollingFallbackInterval);
    pollingFallbackInterval = null;
  }
}

function initWebSocket() {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const wsUrl = `${protocol}//${window.location.host}`;

  try {
    ws = new WebSocket(wsUrl);
  } catch (e) {
    console.warn("[WebSocket] Direct initialization failed, switching to HTTP polling:", e.message);
    startPollingFallback();
    return;
  }

  ws.onopen = () => {
    console.log("[WebSocket] Connected to BLACKNET Tactical Operations Hub.");
    stopPollingFallback();
    setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "HEARTBEAT" }));
      }
    }, 10000);
  };

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      handleIncomingMessage(msg);
    } catch (err) {
      console.error("[WebSocket] Parse error:", err);
    }
  };

  ws.onerror = () => {
    startPollingFallback();
  };

  ws.onclose = () => {
    console.warn("[WebSocket] Disconnected from server. Activating HTTP polling fallback...");
    startPollingFallback();
    setTimeout(initWebSocket, 10000);
  };
}

function handleIncomingMessage(msg) {
  switch (msg.type) {
    case "INIT_STATE":
      updateDashboard(msg.data);
      if (msg.history) renderHistory(msg.history);
      break;

    case "TUNNEL_READY":
      fetchTunnelInfo();
      break;

    case "DEVICE_CONNECTED":
      console.log("📱 Mobile Device Connected:", msg.device);
      window.tacticalSound.playAckChime();
      updateDashboard(msg.data);
      fetchHistory();
      break;

    case "TELEMETRY_UPDATE":
    case "EMERGENCY_ALERT":
      updateDashboard(msg.data);
      fetchHistory();
      break;

    case "LORA_STATUS_CHANGED":
      updateLoraUi(msg.data);
      break;

    case "PROFILE_UPDATED":
      console.log(`👤 Profile updated from mobile: ${msg.data.userName}`);
      updateDashboard(msg.data);
      fetchHistory();
      if (msg.data.safeLocations) {
        renderSafeLocationsOnMap(msg.data.safeLocations);
      }
      break;

    case "LOCATIONS_UPDATED":
      renderSafeLocationsOnMap(msg.locations);
      break;

    case "LORA_PACKET_RECEIVED":
      window.tacticalSound.playAckChime();
      fetchLoraStatus();
      updateDashboard(msg.state);
      fetchHistory();
      console.log(`📻 [LoRa Radio Rx]: Packet received via ${msg.module || "LoRa Receiver"}: ${msg.raw}`);
      break;

    case "TINYFISH_DISPATCH_TRIGGERED":
      console.log("🤖 TinyFish Autonomous Dispatch:", msg.data);
      const isAmb = msg.data.serviceType === "AMBULANCE";
      const vehicleDesc = isAmb ? `🚑 Ambulance 108 (${msg.data.vehicle.id})` : `🚓 Police 112 PCR (${msg.data.vehicle.id})`;
      showNotificationToast(`🤖 TinyFish Autonomous Agent: Dispatched ${vehicleDesc}!`);
      const tfBadge = document.getElementById("tinyfish-agent-badge");
      if (tfBadge) {
        tfBadge.textContent = `Unit ${msg.data.vehicle.id} En-Route`;
        tfBadge.style.color = "#A82E2E";
        tfBadge.style.borderColor = "#A82E2E";
      }
      break;

    case "TINYFISH_DISPATCH_RESOLVED":
      const resBadge = document.getElementById("tinyfish-agent-badge");
      if (resBadge) {
        resBadge.textContent = "Autonomous Ready";
        resBadge.style.color = "#0369A1";
        resBadge.style.borderColor = "#0369A1";
      }
      break;

    case "SAFETY_CHECK_REQUESTED":
      const btn = document.getElementById("btn-remote-check");
      if (btn) {
        btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Pinging Phone (Vibrating)...`;
        btn.disabled = true;
      }
      break;

    case "SAFETY_CHECK_RESOLVED":
      const resolveBtn = document.getElementById("btn-remote-check");
      if (resolveBtn) {
        resolveBtn.innerHTML = `<i class="fa-solid fa-mobile-retro"></i> TRIGGER "ARE YOU SAFE?" ON PHONE`;
        resolveBtn.disabled = false;
      }

      updateDashboard(msg.data);
      fetchHistory();

      if (msg.result === "SAFE") {
        window.tacticalSound.playAckChime();
        alert("✅ Mobile Device Confirmed: User unlocked with Fingerprint / PIN 1234. Risk score reduced.");
      } else if (msg.result === "DURESS") {
        window.tacticalSound.startEmergencySiren();
        alert("🚨 CRITICAL ALERT: DURESS PIN (5678) ENTERED ON PHONE! Assailant may be coercing user. Distress alarm active.");
      }
      break;
  }
}

function fetchInitialState() {
  fetch("/api/status")
    .then(r => r.json())
    .then(res => {
      if (res.success && res.data) {
        updateDashboard(res.data);
      }
      if (res.lora) {
        updateLoraUi(res.lora);
      }
    })
    .catch(console.error);
}

function fetchHistory() {
  fetch("/api/history")
    .then(r => r.json())
    .then(res => {
      if (res.success && res.history) {
        renderHistory(res.history);
      }
    })
    .catch(console.error);
}

function updateDashboard(state) {
  activeState = state;
  const isEmergency = state.isSosActive || state.riskScore >= 80;

  // 1. Device Connection Indicator
  const deviceStatusText = document.getElementById("device-status-text");
  const deviceDot = document.getElementById("device-dot");
  const lblDeviceName = document.getElementById("lbl-device-name");

  if (state.isDeviceConnected) {
    deviceStatusText.innerText = "CONNECTED (" + (state.deviceModel || "Mobile App") + ")";
    deviceStatusText.className = "text-green";
    deviceDot.className = "dot pulse-green";
    lblDeviceName.innerText = state.deviceModel || "Android Connected";
    lblDeviceName.className = "badge badge-verified";
  } else {
    deviceStatusText.innerText = "AWAITING CONNECTION...";
    deviceStatusText.className = "text-neon-yellow";
    deviceDot.className = "dot dot-waiting";
    lblDeviceName.innerText = "Device Standby";
  }

  // Update Dynamic User Identity & Profile details sent from mobile
  const uNameEl = document.getElementById("lbl-user-name");
  const uPhoneEl = document.getElementById("lbl-user-phone");
  const uNotesEl = document.getElementById("lbl-user-notes");

  if (uNameEl && state.userName) {
    uNameEl.innerText = state.userName;
  }
  if (uPhoneEl && state.userPhone) {
    uPhoneEl.innerText = state.userPhone;
  }
  if (uNotesEl) {
    uNotesEl.innerText = state.emergencyNotes ? `Notes: ${state.emergencyNotes}` : "";
    uNotesEl.style.display = state.emergencyNotes ? "inline-block" : "none";
  }

  // Render Safe Zones / Locations on Map
  if (state.safeLocations && Array.isArray(state.safeLocations)) {
    renderSafeLocationsOnMap(state.safeLocations);
  }

  // 2. Real GPS Coordinates & Map
  const lat = state.location.latitude;
  const lon = state.location.longitude;
  document.getElementById("val-lat").innerText = state.isDeviceConnected ? lat.toFixed(6) : "--.------";
  document.getElementById("val-lon").innerText = state.isDeviceConnected ? lon.toFixed(6) : "--.------";
  document.getElementById("val-address").innerText = state.location.address;

  if (map && userMarker && state.isDeviceConnected) {
    const latLng = [lat, lon];
    userMarker.setLatLng(latLng);
    userRadarCircle.setLatLng(latLng);

    // Smooth Camera: only pan or fly if the user has moved > 20 meters, or on initial GPS fix
    const prevPos = userMarker.getLatLng();
    const distMoved = prevPos ? map.distance(prevPos, latLng) : 999;

    if (distMoved > 20 || !hasReceivedFirstGps) {
      if (isEmergency) {
        map.flyTo(latLng, 17, { animate: true, duration: 1.0 });
        userMarker.openPopup();
        userRadarCircle.setRadius(120);
      } else {
        userRadarCircle.setRadius(40);
        if (!hasReceivedFirstGps) {
          map.setView(latLng, 16);
        } else {
          map.panTo(latLng);
        }
      }
      hasReceivedFirstGps = true;
    }

    breadcrumbs.push(latLng);
    if (breadcrumbs.length > 50) breadcrumbs.shift();
    breadcrumbPolyline.setLatLngs(breadcrumbs);

    const dot = document.getElementById("user-pin-dot");
    let markerColor = "#10b981";
    if (state.riskScore >= 80) markerColor = "#ef4444";
    else if (state.riskScore >= 60) markerColor = "#f97316";
    else if (state.riskScore >= 30) markerColor = "#f59e0b";

    if (dot) {
      dot.style.backgroundColor = markerColor;
      dot.style.boxShadow = isEmergency ? `0 0 30px #ef4444` : `0 0 16px ${markerColor}`;
    }
    userRadarCircle.setStyle({ color: markerColor, fillColor: markerColor, fillOpacity: isEmergency ? 0.35 : 0.15 });

    userMarker.setPopupContent(`
      <div style="font-family:sans-serif; min-width:180px;">
        <b style="font-size:14px; color:${markerColor}">${isEmergency ? '🚨 SOS EMERGENCY' : state.userName}</b><br>
        <span style="font-size:11px; color:#94a3b8;">${state.deviceModel || "Mobile Phone"}</span><br>
        Status: <strong style="color:${markerColor}">${state.status}</strong><br>
        Risk Score: <b>${state.riskScore}/100</b><br>
        Motion: ${state.movement}<br>
        Battery: ${state.battery}%<br>
        Location: ${lat.toFixed(4)}, ${lon.toFixed(4)}
      </div>
    `);
  }

  // Update Persistent Dispatch Dock
  const dispatchDock = document.getElementById("dispatch-dock");
  const dispatchTarget = document.getElementById("dispatch-target-coords");
  const dispatchPill = document.getElementById("dispatch-status-pill");

  if (dispatchTarget) {
    dispatchTarget.innerText = state.isDeviceConnected ? `${lat.toFixed(4)}, ${lon.toFixed(4)}` : "28.6645, 77.2975";
  }

  if (dispatchDock) {
    if (isEmergency) {
      dispatchDock.classList.add("emergency-mode");
      if (dispatchPill) {
        dispatchPill.className = "status-badge emergency";
        dispatchPill.innerText = "🚨 DISTRESS SOS ACTIVE";
      }
    } else {
      dispatchDock.classList.remove("emergency-mode");
      if (dispatchPill) {
        dispatchPill.className = "status-badge safe";
        dispatchPill.innerText = state.isDeviceConnected ? "MONITORING" : "STANDBY";
      }
    }
  }

  // Draw Safe Routes & Safe Zones
  if (state.safeRoutes) {
    renderCustomRoutes(state.safeRoutes);
  }

  if (state.safeLocations) {
    renderSafeLocationsOnMap(state.safeLocations);
  }

  // 3. Risk Meter & Status Badge
  const scoreNum = document.getElementById("risk-score-num");
  const meterBar = document.getElementById("gauge-meter-bar");
  const statusBadge = document.getElementById("safety-status-badge");

  scoreNum.innerText = state.riskScore;
  meterBar.style.width = `${state.riskScore}%`;

  statusBadge.className = "status-badge " + (state.status ? state.status.toLowerCase() : "normal");
  statusBadge.innerText = state.status;

  if (state.riskScore >= 80) {
    scoreNum.style.color = "var(--color-red)";
  } else if (state.riskScore >= 60) {
    scoreNum.style.color = "var(--color-orange)";
  } else if (state.riskScore >= 30) {
    scoreNum.style.color = "var(--color-yellow)";
  } else {
    scoreNum.style.color = "var(--color-green)";
  }

  // 4. Explainable Reasons List
  const reasonsUl = document.getElementById("risk-reasons-list");
  reasonsUl.innerHTML = "";
  if (state.riskReasons && state.riskReasons.length > 0) {
    state.riskReasons.forEach(reason => {
      const li = document.createElement("li");
      li.className = isEmergency ? "reason-item danger" : "reason-item warning";
      const icon = isEmergency ? "fa-solid fa-triangle-exclamation text-red" : "fa-solid fa-circle-info text-neon-cyan";
      li.innerHTML = `<i class="${icon}"></i> ${reason}`;
      reasonsUl.appendChild(li);
    });
  }

  // 5. Real Telemetry Data
  document.getElementById("val-bpm").innerText = state.heartRate.bpm;
  document.getElementById("val-bpm-status").innerText = state.heartRate.status + (state.heartRate.source ? ` (${state.heartRate.source})` : "");

  document.getElementById("val-movement").innerText = state.movement;
  const moveIcon = document.getElementById("icon-movement");
  if (state.movement === "Running" || state.movement === "RUNNING") {
    moveIcon.className = "fa-solid fa-person-running text-red";
  } else if (state.movement === "Walking" || state.movement === "WALKING") {
    moveIcon.className = "fa-solid fa-person-walking text-neon-blue";
  } else if (state.movement.includes("Fall") || state.movement.includes("FALL")) {
    moveIcon.className = "fa-solid fa-person-falling-burst text-red";
  } else {
    moveIcon.className = "fa-solid fa-person text-neon-cyan";
  }

  const devMeters = state.routeStatus ? state.routeStatus.deviationMeters || 0 : 0;
  document.getElementById("val-deviation").innerHTML = `${devMeters} <span class="unit">m</span>`;
  document.getElementById("val-deviation-status").innerText = state.routeStatus && state.routeStatus.isDeviated ? "⚠️ Off Safe Corridor" : "On Safe Corridor";

  document.getElementById("val-battery").innerText = state.battery !== "--" ? `${state.battery}%` : "--%";

  // 6. Active Transport Channel
  const activeTransport = state.communication.activeTransport;
  document.getElementById("val-transport-title").innerText = activeTransport;
  document.getElementById("val-transport-desc").innerText = activeTransport === "LORA" ? "ESP32 433MHz LoRa Radio Active" : "Live Phone Stream";

  // 7. Emergency Banner & Sound
  const banner = document.getElementById("emergency-banner");
  if (isEmergency) {
    banner.style.display = "block";
    window.tacticalSound.startEmergencySiren();
  } else {
    banner.style.display = "none";
    window.tacticalSound.stopEmergencySiren();
  }
}

function renderHistory(history) {
  const tbody = document.getElementById("event-log-body");
  if (!tbody) return;
  tbody.innerHTML = "";

  history.forEach(evt => {
    const tr = document.createElement("tr");
    const timeStr = new Date(evt.timestamp).toLocaleTimeString();
    const isSos = evt.type.includes("EMERGENCY") || evt.type.includes("DURESS");

    tr.innerHTML = `
      <td>${timeStr}</td>
      <td><span class="status-badge ${isSos ? 'emergency' : 'caution'}">${evt.type}</span></td>
      <td><strong>${evt.transport}</strong></td>
      <td><strong>${evt.riskScore}/100</strong></td>
      <td>${evt.summary}</td>
    `;
    tbody.appendChild(tr);
  });
}

// -------------------------------------------------------------
// LoRa Hardware Module Management Functions
// -------------------------------------------------------------

function openLoraModal() {
  document.getElementById("lora-modal").style.display = "flex";
  fetchLoraPorts();
  fetchLoraStatus();
}

function closeLoraModal() {
  document.getElementById("lora-modal").style.display = "none";
}

function selectLoraRole(key) {
  const lblA = document.getElementById("lbl-role-a");
  const lblB = document.getElementById("lbl-role-b");
  if (key === 'a') {
    selectedLoraRole = "LoRa Module A (Receiver)";
    lblA.classList.add("active");
    lblB.classList.remove("active");
  } else {
    selectedLoraRole = "LoRa Module B (Receiver)";
    lblB.classList.add("active");
    lblA.classList.remove("active");
  }
}

function fetchLoraPorts() {
  const sel = document.getElementById("sel-lora-port");
  sel.innerHTML = `<option value="COM13">Scanning ports (Default: COM13)...</option>`;

  fetch("/api/lora/ports")
    .then(r => r.json())
    .then(res => {
      sel.innerHTML = "";
      let foundCom13 = false;
      if (res.ports && res.ports.length > 0) {
        res.ports.forEach(p => {
          const opt = document.createElement("option");
          opt.value = p.path;
          opt.innerText = `${p.path} — ${p.friendlyName || p.manufacturer || "USB Serial"}`;
          if (p.path.toUpperCase() === "COM13") {
            opt.selected = true;
            foundCom13 = true;
          }
          sel.appendChild(opt);
        });
      }
      if (!foundCom13) {
        const defaultOpt = document.createElement("option");
        defaultOpt.value = "COM13";
        defaultOpt.innerText = "COM13 — USB LoRa Receiver (Default)";
        defaultOpt.selected = true;
        sel.prepend(defaultOpt);
      }
    })
    .catch(err => {
      sel.innerHTML = `<option value="COM13" selected>COM13 — USB LoRa Receiver (Default)</option>`;
    });
}

function fetchLoraStatus() {
  fetch("/api/lora/status")
    .then(r => r.json())
    .then(res => {
      if (res.success && res.data) {
        updateLoraUi(res.data);
      }
    })
    .catch(console.error);
}

function updateLoraUi(lora) {
  const headerBtn = document.getElementById("btn-open-lora-modal");
  const headerText = document.getElementById("header-lora-status");
  const modalStatus = document.getElementById("modal-lora-status-text");
  const modalPort = document.getElementById("modal-lora-active-port");
  const modalPackets = document.getElementById("modal-lora-packet-count");
  const modalRaw = document.getElementById("modal-lora-last-raw");

  const btnConnect = document.getElementById("btn-lora-connect");
  const btnDisconnect = document.getElementById("btn-lora-disconnect");
  const btnPing = document.getElementById("btn-lora-ping");

  if (lora.isConnected) {
    headerBtn.classList.add("connected");
    headerText.innerText = `LORA: ${lora.moduleRole || "CONNECTED"} (${lora.portName})`;

    if (modalStatus) {
      modalStatus.innerText = "CONNECTED (ACTIVE)";
      modalStatus.className = "text-green";
      modalPort.innerText = `${lora.portName} @ ${lora.baudRate || 115200} bps`;
      modalPackets.innerText = lora.packetsReceived || 0;
      modalRaw.innerText = lora.lastPacket || "Listening on 433 MHz...";

      btnConnect.style.display = "none";
      btnDisconnect.style.display = "inline-flex";
      btnPing.style.display = "inline-flex";
    }
  } else {
    headerBtn.classList.remove("connected");
    headerText.innerText = "LORA: DISCONNECTED";

    if (modalStatus) {
      modalStatus.innerText = "DISCONNECTED";
      modalStatus.className = "text-neon-yellow";
      modalPort.innerText = "None";
      modalPackets.innerText = lora.packetsReceived || 0;
      modalRaw.innerText = "None";

      btnConnect.style.display = "inline-flex";
      btnDisconnect.style.display = "none";
      btnPing.style.display = "none";
    }
  }
}

function connectSelectedLoraPort() {
  const port = document.getElementById("sel-lora-port").value;
  if (!port) {
    alert("Please select a USB COM Port to connect your LoRa module.");
    return;
  }

  fetch("/api/lora/connect", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ port, role: selectedLoraRole })
  })
    .then(r => r.json())
    .then(res => {
      if (res.success) {
        window.tacticalSound.playAckChime();
        fetchLoraStatus();
      } else {
        alert(`Could not connect: ${res.error || "Unknown error"}`);
      }
    })
    .catch(console.error);
}

function disconnectLoraPort() {
  fetch("/api/lora/disconnect", { method: "POST" })
    .then(r => r.json())
    .then(() => {
      fetchLoraStatus();
    })
    .catch(console.error);
}

function pingLoraModule() {
  fetch("/api/lora/ping", { method: "POST" })
    .then(r => r.json())
    .then(res => {
      window.tacticalSound.playBeep(800, 0.1);
      alert(`📡 Broadcasted test ping over LoRa: ${res.ack}`);
    })
    .catch(console.error);
}

// -------------------------------------------------------------
// Emergency & Verification Controls
// -------------------------------------------------------------

function triggerSafetyCheck() {
  window.tacticalSound.playBeep(750, 0.15);
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: "TRIGGER_CHECK" }));
  } else {
    fetch("/api/trigger-check", { method: "POST" }).catch(console.error);
  }
}

function resolveEmergency() {
  window.tacticalSound.stopEmergencySiren();
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: "RESOLVE_SOS" }));
  } else {
    fetch("/api/resolve-sos", { method: "POST" }).catch(console.error);
  }
}

function dispatchManualSOS() {
  window.tacticalSound.playBeep(950, 0.3, "sawtooth");
  fetch("/api/sos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      latitude: activeState ? activeState.location.latitude : 28.6139,
      longitude: activeState ? activeState.location.longitude : 77.2090,
      riskScore: 98,
      reason: "🚨 Operator Force-Dispatched SOS from Laptop Hub"
    })
  }).catch(console.error);
}

function refreshHistory() {
  fetchHistory();
}

// -------------------------------------------------------------
// Google Maps First Responder Tactical Dispatch
// -------------------------------------------------------------

function launchGoogleMapsDispatch() {
  const victimLat = (activeState && activeState.location && activeState.location.latitude) ? activeState.location.latitude : 28.6645;
  const victimLon = (activeState && activeState.location && activeState.location.longitude) ? activeState.location.longitude : 77.2975;
  const dest = `${victimLat},${victimLon}`;

  if (window.tacticalSound) window.tacticalSound.playBeep(900, 0.2);

  // Synchronously open a new tab to prevent browser popup blockers from suppressing it
  const mapTab = window.open("about:blank", "_blank");

  // Default fallback URL: uses device's current location via Google Maps built-in handler
  const fallbackUrl = `https://www.google.com/maps/dir/?api=1&origin=Your+Location&destination=${dest}&travelmode=driving`;

  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const officerLat = pos.coords.latitude;
        const officerLon = pos.coords.longitude;
        const url = `https://www.google.com/maps/dir/?api=1&origin=${officerLat},${officerLon}&destination=${dest}&travelmode=driving`;
        console.log(`🚨 Dispatching First Responders: Officer (${officerLat}, ${officerLon}) -> Victim (${dest})`);
        if (mapTab) mapTab.location.href = url;
      },
      (err) => {
        console.log(`🚨 Dispatching First Responders (Default Origin: Your Location) -> Victim (${dest})`);
        if (mapTab) mapTab.location.href = fallbackUrl;
      },
      { timeout: 3000, enableHighAccuracy: true }
    );
  } else {
    if (mapTab) mapTab.location.href = fallbackUrl;
  }
}

// -------------------------------------------------------------
// Safe Travel Corridors & Route Uploader
// -------------------------------------------------------------

let activeRoutePolylines = [];
let activeRouteBuffers = [];

function openRouteModal() {
  document.getElementById("route-modal").style.display = "flex";
  switchRouteTab("add");
  updateRouteListUI();
}

function closeRouteModal() {
  document.getElementById("route-modal").style.display = "none";
}

function switchRouteTab(tab) {
  const tabAdd = document.getElementById("tab-btn-add");
  const tabList = document.getElementById("tab-btn-list");
  const contentAdd = document.getElementById("route-tab-add-content");
  const contentList = document.getElementById("route-tab-list-content");

  if (tab === "add") {
    tabAdd.classList.add("active");
    tabList.classList.remove("active");
    contentAdd.style.display = "block";
    contentList.style.display = "none";
  } else {
    tabList.classList.add("active");
    tabAdd.classList.remove("active");
    contentAdd.style.display = "none";
    contentList.style.display = "block";
    updateRouteListUI();
  }
}

function autoFillGpsForRoute() {
  const lat = (activeState && activeState.location) ? activeState.location.latitude : 28.6645;
  const lon = (activeState && activeState.location) ? activeState.location.longitude : 77.2975;
  document.getElementById("input-route-dest").value = `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
  alert(`Auto-filled Destination with Phone GPS: ${lat.toFixed(4)}, ${lon.toFixed(4)}`);
}

function saveCustomRoute() {
  const name = document.getElementById("input-route-name").value.trim() || "Custom Safe Corridor";
  const startRaw = document.getElementById("input-route-start").value.trim();
  const destRaw = document.getElementById("input-route-dest").value.trim();
  const waypointsRaw = document.getElementById("input-route-waypoints").value.trim();
  const bufferMeters = parseInt(document.getElementById("input-route-buffer").value, 10) || 120;

  const parseCoord = (str) => {
    const parts = str.split(",").map(p => parseFloat(p.trim()));
    return (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) ? parts : null;
  };

  const start = parseCoord(startRaw) || [28.6558, 77.3005]; // GGSIPU USAR default
  const dest = parseCoord(destRaw) || [28.6650, 77.2980];

  let waypoints = [start];

  if (waypointsRaw) {
    const lines = waypointsRaw.split(/[;\n|]/);
    for (const line of lines) {
      const pt = parseCoord(line);
      if (pt) waypoints.push(pt);
    }
  }

  if (waypoints.length <= 1) {
    // Generate intermediate corridor points
    waypoints = [
      start,
      [start[0] + (dest[0] - start[0]) * 0.25, start[1] + (dest[1] - start[1]) * 0.25],
      [start[0] + (dest[0] - start[0]) * 0.50, start[1] + (dest[1] - start[1]) * 0.50],
      [start[0] + (dest[0] - start[0]) * 0.75, start[1] + (dest[1] - start[1]) * 0.75],
      dest
    ];
  } else if (!waypoints.includes(dest)) {
    waypoints.push(dest);
  }

  const newRoute = {
    id: "route-" + Date.now(),
    name,
    start: { name: "Start Point", lat: start[0], lon: start[1] },
    destination: { name: "Destination", lat: dest[0], lon: dest[1] },
    waypoints,
    toleranceRadiusMeters: bufferMeters
  };

  fetch("/api/routes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(newRoute)
  })
    .then(res => res.json())
    .then(res => {
      if (res.routes) {
        if (!activeState) activeState = {};
        activeState.safeRoutes = res.routes;
        renderCustomRoutes(res.routes);
        updateRouteListUI();
        switchRouteTab("list");
        alert(`✅ Safe Travel Corridor "${name}" Saved & Rendered on Map!`);
      }
    })
    .catch(err => {
      console.error("Error saving route:", err);
      // Local fallback
      if (!activeState) activeState = {};
      if (!activeState.safeRoutes) activeState.safeRoutes = [];
      activeState.safeRoutes.push(newRoute);
      renderCustomRoutes(activeState.safeRoutes);
      updateRouteListUI();
      switchRouteTab("list");
    });
}

function deleteCustomRoute(id) {
  fetch(`/api/routes/${id}`, { method: "DELETE" })
    .then(res => res.json())
    .then(res => {
      if (res.routes && activeState) {
        activeState.safeRoutes = res.routes;
        renderCustomRoutes(res.routes);
        updateRouteListUI();
      }
    })
    .catch(console.error);
}

function updateRouteListUI() {
  const routes = (activeState && activeState.safeRoutes) ? activeState.safeRoutes : [];
  const countSpan = document.getElementById("count-active-routes");
  if (countSpan) countSpan.innerText = routes.length;

  const container = document.getElementById("route-list-container");
  if (!container) return;

  if (routes.length === 0) {
    container.innerHTML = `<p style="font-size:12px; color:var(--text-muted); text-align:center; padding:20px 0;">No active routes configured. Switch to "Add New Corridor" to create one.</p>`;
    return;
  }

  let html = "";
  routes.forEach(rt => {
    html += `
      <div class="route-item-card">
        <div>
          <strong style="color:var(--color-cyan); font-size:13px;">🗺️ ${rt.name}</strong>
          <div style="font-size:11px; color:var(--text-secondary); margin-top:3px;">
            Buffer: ${rt.toleranceRadiusMeters || 100}m &bull; ${rt.waypoints ? rt.waypoints.length : 2} waypoints
          </div>
        </div>
        <button class="btn-sm btn-danger" style="padding:4px 8px; font-size:11px;" onclick="deleteCustomRoute('${rt.id}')">
          <i class="fa-solid fa-trash"></i>
        </button>
      </div>
    `;
  });
  container.innerHTML = html;
}

function renderCustomRoutes(routes) {
  if (!map || !routes) return;

  // Clear existing rendered route lines
  activeRoutePolylines.forEach(p => map.removeLayer(p));
  activeRoutePolylines = [];

  routes.forEach((route, idx) => {
    if (route.waypoints && route.waypoints.length > 0) {
      const poly = L.polyline(route.waypoints, {
        color: idx === 0 ? "#06b6d4" : "#10b981",
        weight: 6,
        opacity: 0.7,
        lineCap: "round"
      }).addTo(map);

      poly.bindPopup(`<b>Safe Travel Corridor:</b> ${route.name}<br>Buffer: ${route.toleranceRadiusMeters || 100}m`);
      activeRoutePolylines.push(poly);
    }
  });
}

function renderSafeLocationsOnMap(locations) {
  if (!map || !locations || !Array.isArray(locations)) return;

  // Clear existing rendered safe zone circles
  safeZoneCircles.forEach(c => map.removeLayer(c));
  safeZoneCircles = [];

  locations.forEach(loc => {
    const lat = loc.lat || (loc.center && loc.center.latitude);
    const lon = loc.lon || (loc.center && loc.center.longitude);
    const radius = loc.radiusMeters || 120;
    if (lat && lon) {
      const circle = L.circle([lat, lon], {
        radius: radius,
        color: "#10b981",
        fillColor: "#10b981",
        fillOpacity: 0.18,
        dashArray: "4, 6"
      }).addTo(map);

      circle.bindPopup(`<b>Safe Haven:</b> ${loc.name}<br>Radius: ${radius}m`);
      safeZoneCircles.push(circle);
    }
  });
}

// --- TinyFish Autonomous Agent Configuration & Modal ---
function openTinyFishModal() {
  const modal = document.getElementById("tinyfish-modal");
  if (modal) {
    modal.style.display = "flex";
    fetchTinyFishStatus();
  }
}

function closeTinyFishModal() {
  const modal = document.getElementById("tinyfish-modal");
  if (modal) modal.style.display = "none";
}

async function fetchTinyFishStatus() {
  try {
    const res = await fetch("/api/tinyfish/status");
    const json = await res.json();
    if (json.success && json.data) {
      const modeEl = document.getElementById("modal-tinyfish-mode");
      const keyEl = document.getElementById("modal-tinyfish-key-status");
      if (modeEl) modeEl.textContent = json.data.mode;
      if (keyEl) keyEl.textContent = json.data.maskedKey;
    }
  } catch (e) {
    console.warn("Could not fetch TinyFish status:", e);
  }
}

async function saveTinyFishKey() {
  const input = document.getElementById("input-tinyfish-key");
  if (!input) return;
  const key = input.value.trim();
  try {
    const res = await fetch("/api/tinyfish/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey: key })
    });
    const json = await res.json();
    if (json.success) {
      alert("✅ TinyFish Configuration Saved! Mode: " + json.mode);
      fetchTinyFishStatus();
      closeTinyFishModal();
    }
  } catch (e) {
    alert("Error saving TinyFish key: " + e.message);
  }
}

/* ==========================================================================
   Cinematic Delhi-NCR Tactical Coverage & Neural Mesh Intro Engine (RUX-Style)
   ========================================================================== */

let introTimerInterval = null;
let introAnimationRunning = true;
let introMapCanvasAnimId = null;
let introNeuralCanvasAnimId = null;

function enterMainDashboard() {
  const introScreen = document.getElementById("intro-screen");
  if (!introScreen) return;

  if (introTimerInterval) {
    clearInterval(introTimerInterval);
    introTimerInterval = null;
  }

  // Set System Online Visual State
  const bootText = document.getElementById("system-boot-text");
  const bootPill = document.getElementById("boot-status-pill");
  const bootBar = document.getElementById("system-boot-bar");
  const bootPercent = document.getElementById("system-boot-percent");
  const timerEl = document.getElementById("intro-countdown-timer");

  if (bootText) bootText.innerText = "✅ SYSTEM ONLINE • ACTIVE";
  if (bootPill) bootPill.classList.add("online");
  if (bootBar) bootBar.style.width = "100%";
  if (bootPercent) bootPercent.innerText = "100%";
  if (timerEl) timerEl.innerText = "SYSTEM ONLINE!";

  // Smooth cross-fade directly into the main operations center
  introScreen.classList.remove("fade-in");
  void introScreen.offsetWidth; // Force DOM reflow to trigger smooth fade-out animation
  introScreen.classList.add("fade-out");

  const topNav = document.querySelector(".top-nav");
  const mainDash = document.querySelector(".main-dashboard");
  if (topNav) {
    topNav.classList.remove("dashboard-fade-in");
    void topNav.offsetWidth;
    topNav.classList.add("dashboard-fade-in");
  }
  if (mainDash) {
    mainDash.classList.remove("dashboard-fade-in");
    void mainDash.offsetWidth;
    mainDash.classList.add("dashboard-fade-in");
  }

  setTimeout(() => {
    introScreen.style.display = "none";
    introAnimationRunning = false;
    if (introMapCanvasAnimId) cancelAnimationFrame(introMapCanvasAnimId);
    if (introNeuralCanvasAnimId) cancelAnimationFrame(introNeuralCanvasAnimId);
    if (map) {
      map.invalidateSize();
    }
  }, 850);
}

function openIntroScreen() {
  const introScreen = document.getElementById("intro-screen");
  if (!introScreen) return;

  if (introTimerInterval) {
    clearInterval(introTimerInterval);
    introTimerInterval = null;
  }

  const timerEl = document.getElementById("intro-countdown-timer");
  if (timerEl) {
    timerEl.innerText = "Interactive Grid Mode";
  }

  const bootText = document.getElementById("system-boot-text");
  if (bootText) bootText.innerText = "SYSTEM ONLINE • INSPECTION MODE";

  introScreen.style.display = "flex";
  introScreen.classList.remove("fade-out");
  introScreen.classList.remove("fade-in");
  // Force DOM reflow to trigger smooth fade-in animation
  void introScreen.offsetWidth;
  introScreen.classList.add("fade-in");

  introAnimationRunning = true;
  initDelhiMapAndNeuralNetwork(false); // don't restart auto-timer when reopened
}

// ==========================================
// SHARED GEOGRAPHIC TACTICAL DATA FOR DELHI-NCR
// ==========================================
const delhiBorderLatLng = [
  [28.85, 77.09], [28.85, 77.04], [28.81, 77.02], [28.78, 77.01],
  [28.70, 76.96], [28.65, 76.93], [28.61, 76.97], [28.53, 76.88],
  [28.50, 76.95], [28.50, 77.05], [28.51, 77.09], [28.48, 77.12],
  [28.47, 77.16], [28.48, 77.21], [28.49, 77.29], [28.54, 77.32],
  [28.61, 77.33], [28.64, 77.34], [28.68, 77.32], [28.72, 77.27],
  [28.74, 77.25], [28.81, 77.14]
];

const yamunaPathLatLng = [
  [28.98, 77.16], [28.88, 77.19], [28.79, 77.22], [28.73, 77.23], [28.67, 77.24],
  [28.63, 77.25], [28.59, 77.26], [28.54, 77.31], [28.47, 77.34], [28.35, 77.37], [28.22, 77.40]
];

const innerRingRoadLatLng = [
  [28.67, 77.23], [28.70, 77.19], [28.67, 77.13], [28.64, 77.14],
  [28.59, 77.16], [28.57, 77.19], [28.57, 77.22], [28.57, 77.25],
  [28.59, 77.26], [28.63, 77.25], [28.65, 77.24]
];

const outerRingRoadLatLng = [
  [28.74, 77.16], [28.70, 77.12], [28.68, 77.09], [28.63, 77.08],
  [28.58, 77.12], [28.54, 77.18], [28.54, 77.23], [28.55, 77.26],
  [28.56, 77.28], [28.54, 77.31]
];

const expresswaysLatLng = [
  {
    name: "NH-48 EXPRESSWAY → GURUGRAM",
    pts: [[28.632, 77.220], [28.59, 77.16], [28.55, 77.12], [28.495, 77.09], [28.44, 77.04], [28.35, 76.92], [28.25, 76.80]]
  },
  {
    name: "DWARKA EXP",
    pts: [[28.55, 77.12], [28.56, 77.05], [28.52, 77.02], [28.46, 77.01], [28.38, 76.94]]
  },
  {
    name: "DND FLYWAY → NOIDA SEC-18 → GREATER NOIDA",
    pts: [[28.57, 77.25], [28.57, 77.32], [28.52, 77.37], [28.47, 77.50], [28.40, 77.62], [28.30, 77.75]]
  },
  {
    name: "MATHURA RD → FARIDABAD SEC-88 [ASIAN FIDELIS]",
    pts: [[28.57, 77.25], [28.50, 77.30], [28.44, 77.33], [28.41, 77.35], [28.32, 77.36], [28.20, 77.38]]
  },
  {
    name: "GT KARNAL RD (NH-44)",
    pts: [[28.67, 77.23], [28.73, 77.17], [28.81, 77.14], [28.88, 77.11], [28.98, 77.08], [29.10, 77.04]]
  },
  {
    name: "ROHTAK RD (NH-9)",
    pts: [[28.67, 77.13], [28.68, 77.07], [28.69, 76.96], [28.69, 76.85], [28.70, 76.70]]
  },
  {
    name: "DELHI-MEERUT EXP",
    pts: [[28.63, 77.25], [28.62, 77.30], [28.63, 77.36], [28.65, 77.45], [28.68, 77.60]]
  }
];

const urbanDistrictPolys = [
  [[28.63, 77.20], [28.63, 77.23], [28.61, 77.24], [28.60, 77.21]],
  [[28.57, 77.20], [28.57, 77.24], [28.52, 77.23], [28.52, 77.19]],
  [[28.73, 77.10], [28.73, 77.15], [28.69, 77.15], [28.69, 77.10]],
  [[28.61, 77.03], [28.61, 77.08], [28.56, 77.08], [28.56, 77.03]],
  [[28.51, 77.07], [28.51, 77.11], [28.47, 77.11], [28.47, 77.07]],
  [[28.58, 77.30], [28.58, 77.34], [28.54, 77.34], [28.54, 77.30]],
  [[28.43, 77.33], [28.43, 77.37], [28.39, 77.37], [28.39, 77.33]]
];

const tacticalNodes = [
  // Central Core (HQ)
  { name: "CONNAUGHT PLACE [CORE-HQ]", lat: 28.632, lng: 77.220, type: "hq", isLabel: true },
  { name: "INDIA GATE", lat: 28.612, lng: 77.229, type: "core", isLabel: false },
  { name: "CENTRAL SECRETARIAT", lat: 28.616, lng: 77.211, type: "core", isLabel: false },
  { name: "PRAGATI MAIDAN", lat: 28.623, lng: 77.242, type: "core", isLabel: false },
  { name: "CHANDNI CHOWK", lat: 28.656, lng: 77.231, type: "core", isLabel: false },
  { name: "KASHMERE GATE ISBT", lat: 28.667, lng: 77.228, type: "core", isLabel: false },
  { name: "KHAN MARKET", lat: 28.600, lng: 77.227, type: "core", isLabel: false },
  { name: "ITO JUNCTION", lat: 28.628, lng: 77.240, type: "core", isLabel: false },

  // South Delhi
  { name: "AIIMS TRAUMA LINK", lat: 28.567, lng: 77.210, type: "core", isLabel: true },
  { name: "HAUZ KHAS / IIT", lat: 28.545, lng: 77.195, type: "corridor", isLabel: false },
  { name: "SAKET DISTRICT CENTRE", lat: 28.524, lng: 77.215, type: "corridor", isLabel: false },
  { name: "GREATER KAILASH", lat: 28.548, lng: 77.242, type: "corridor", isLabel: false },
  { name: "VASANT KUNJ", lat: 28.525, lng: 77.155, type: "corridor", isLabel: false },
  { name: "MEHRAULI / QUTUB", lat: 28.525, lng: 77.185, type: "corridor", isLabel: false },
  { name: "LAJPAT NAGAR", lat: 28.570, lng: 77.242, type: "corridor", isLabel: false },
  { name: "OKHLA INDUSTRIAL", lat: 28.535, lng: 77.272, type: "corridor", isLabel: false },

  // West Delhi
  { name: "DWARKA SEC-21 [TRANSIT]", lat: 28.552, lng: 77.060, type: "corridor", isLabel: true },
  { name: "DWARKA SEC-10", lat: 28.581, lng: 77.050, type: "corridor", isLabel: false },
  { name: "JANAKPURI CENTRE", lat: 28.629, lng: 77.082, type: "corridor", isLabel: false },
  { name: "RAJOURI GARDEN", lat: 28.647, lng: 77.122, type: "corridor", isLabel: false },
  { name: "PUNJABI BAGH", lat: 28.668, lng: 77.132, type: "corridor", isLabel: false },
  { name: "PASCHIM VIHAR", lat: 28.672, lng: 77.102, type: "corridor", isLabel: false },

  // North Delhi
  { name: "ROHINI SEC-14", lat: 28.712, lng: 77.125, type: "corridor", isLabel: true },
  { name: "PITAMPURA NSP", lat: 28.694, lng: 77.152, type: "corridor", isLabel: false },
  { name: "MODEL TOWN / CIVIL LINES", lat: 28.695, lng: 77.202, type: "corridor", isLabel: false },
  { name: "AZADPUR HUB", lat: 28.715, lng: 77.178, type: "corridor", isLabel: false },
  { name: "NARELA NORTH RELAY", lat: 28.845, lng: 77.095, type: "fringe", isLabel: false },
  { name: "BAWANA RELAY", lat: 28.795, lng: 77.032, type: "fringe", isLabel: false },

  // East Delhi
  { name: "MAYUR VIHAR", lat: 28.605, lng: 77.295, type: "corridor", isLabel: false },
  { name: "AKSHARDHAM LINK", lat: 28.618, lng: 77.280, type: "corridor", isLabel: false },
  { name: "LAXMI NAGAR", lat: 28.632, lng: 77.275, type: "corridor", isLabel: false },
  { name: "PREET VIHAR", lat: 28.642, lng: 77.295, type: "corridor", isLabel: false },
  { name: "ANAND VIHAR ISBT", lat: 28.648, lng: 77.315, type: "corridor", isLabel: false },
  { name: "GHAZIPUR BORDER", lat: 28.625, lng: 77.335, type: "fringe", isLabel: false },

  // Gurugram (NCR-SW)
  { name: "CYBER CITY GURGAON [HUB-02]", lat: 28.495, lng: 77.090, type: "hq", isLabel: true },
  { name: "IFFCO CHOWK", lat: 28.472, lng: 77.072, type: "corridor", isLabel: false },
  { name: "GOLF COURSE RD", lat: 28.455, lng: 77.102, type: "corridor", isLabel: false },
  { name: "UDYOG VIHAR", lat: 28.508, lng: 77.082, type: "corridor", isLabel: false },
  { name: "IGI AIRPORT T3", lat: 28.556, lng: 77.085, type: "core", isLabel: true },

  // Noida (NCR-SE)
  { name: "NOIDA SEC-18 [HUB-03]", lat: 28.570, lng: 77.322, type: "hq", isLabel: true },
  { name: "NOIDA SEC-62 IT HUB", lat: 28.625, lng: 77.365, type: "corridor", isLabel: false },
  { name: "FILM CITY / DND", lat: 28.562, lng: 77.310, type: "corridor", isLabel: false },
  { name: "NOIDA EXP SEC-128", lat: 28.520, lng: 77.365, type: "corridor", isLabel: false },
  { name: "PARI CHOWK", lat: 28.470, lng: 77.495, type: "fringe", isLabel: false },

  // Faridabad (NCR-S)
  { name: "FARIDABAD SEC-88 [ASIAN FIDELIS]", lat: 28.410, lng: 77.350, type: "hq", isLabel: true },
  { name: "BADARPUR BORDER", lat: 28.492, lng: 77.300, type: "corridor", isLabel: false },
  { name: "OLD FARIDABAD", lat: 28.425, lng: 77.315, type: "corridor", isLabel: false },
  { name: "SURAJKUND LINK", lat: 28.490, lng: 77.275, type: "corridor", isLabel: false }
];

const radarHubs = [
  { name: "CP HQ", lat: 28.632, lng: 77.220, maxR: 160, currentR: 10, speed: 0.8 },
  { name: "CYBER CITY", lat: 28.495, lng: 77.090, maxR: 130, currentR: 60, speed: 0.7 },
  { name: "NOIDA SEC-18", lat: 28.570, lng: 77.322, maxR: 140, currentR: 35, speed: 0.75 }
];

function initDelhiMapAndNeuralNetwork(startTimer = true) {
  const introScreen = document.getElementById("intro-screen");
  if (!introScreen) return;

  // 1. Precise 3-Second High-Tech Turning On -> System Online Sequence
  if (startTimer) {
    const totalDurationMs = 3000;
    const intervalStepMs = 50;
    let elapsedMs = 0;

    const timerEl = document.getElementById("intro-countdown-timer");
    const bootText = document.getElementById("system-boot-text");
    const bootPill = document.getElementById("boot-status-pill");
    const bootBar = document.getElementById("system-boot-bar");
    const bootPercent = document.getElementById("system-boot-percent");

    if (introTimerInterval) clearInterval(introTimerInterval);

    introTimerInterval = setInterval(() => {
      elapsedMs += intervalStepMs;
      const progress = Math.min(1, elapsedMs / totalDurationMs);
      const percentVal = Math.floor(progress * 100);
      const secondsRemaining = Math.max(0, Math.ceil((totalDurationMs - elapsedMs) / 1000));

      if (bootBar) bootBar.style.width = `${percentVal}%`;
      if (bootPercent) bootPercent.innerText = `${percentVal}%`;

      if (progress < 0.35) {
        if (bootText) bootText.innerText = "TURNING ON • INITIALIZING SENSORS...";
        if (timerEl) timerEl.innerText = `System Online in ${secondsRemaining}s...`;
      } else if (progress < 0.72) {
        if (bootText) bootText.innerText = "TURNING ON • 433 MHZ LORA MESH SYNC...";
        if (timerEl) timerEl.innerText = `System Online in ${secondsRemaining}s...`;
      } else if (progress < 0.94) {
        if (bootText) bootText.innerText = "TURNING ON • 48 TACTICAL NODES LOCKED";
        if (timerEl) timerEl.innerText = `System Online in 1s...`;
      } else {
        if (bootText) bootText.innerText = "✅ SYSTEM ONLINE";
        if (bootPill) bootPill.classList.add("online");
        if (timerEl) timerEl.innerText = "SYSTEM ONLINE!";
      }

      if (elapsedMs >= totalDurationMs) {
        clearInterval(introTimerInterval);
        introTimerInterval = null;
        enterMainDashboard();
      }
    }, intervalStepMs);
  }

  // 2. Setup Canvas Resizing & Parallax
  const mapCanvas = document.getElementById("intro-map-canvas");
  const neuralCanvas = document.getElementById("neural-net-canvas");
  if (!mapCanvas || !neuralCanvas) return;

  let parallaxX = 0;
  let parallaxY = 0;
  let targetParallaxX = 0;
  let targetParallaxY = 0;

  window.addEventListener("mousemove", (e) => {
    const halfW = window.innerWidth / 2;
    const halfH = window.innerHeight / 2;
    targetParallaxX = (e.clientX - halfW) * 0.04;
    targetParallaxY = (e.clientY - halfH) * 0.04;
  });

  // ==========================================
  // PART A: Delhi Full-Screen Background Map & Tactical Grid
  // ==========================================
  const mapCtx = mapCanvas.getContext("2d");
  let mapW = window.innerWidth;
  let mapH = window.innerHeight;

  function resizeMap() {
    const dpr = window.devicePixelRatio || 1;
    mapW = window.innerWidth;
    mapH = window.innerHeight;
    mapCanvas.width = mapW * dpr;
    mapCanvas.height = mapH * dpr;
    mapCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener("resize", resizeMap);
  resizeMap();

  // Create Hatch Pattern for Urban Districts
  const hatchCanvas = document.createElement("canvas");
  hatchCanvas.width = 14;
  hatchCanvas.height = 14;
  const hatchCtx = hatchCanvas.getContext("2d");
  hatchCtx.strokeStyle = "rgba(226, 232, 240, 0.85)";
  hatchCtx.lineWidth = 1;
  hatchCtx.beginPath();
  hatchCtx.moveTo(0, 14);
  hatchCtx.lineTo(14, 0);
  hatchCtx.moveTo(-3, 3);
  hatchCtx.lineTo(3, -3);
  hatchCtx.moveTo(11, 17);
  hatchCtx.lineTo(17, 11);
  hatchCtx.stroke();
  const hatchPattern = mapCtx.createPattern(hatchCanvas, "repeat");

  const introStartTime = performance.now();

  function drawDelhiMap() {
    if (!introAnimationRunning) return;

    // Smooth Parallax
    parallaxX += (targetParallaxX - parallaxX) * 0.05;
    parallaxY += (targetParallaxY - parallaxY) * 0.05;

    mapCtx.clearRect(0, 0, mapW, mapH);

    // Fade-in ramp over 850ms on initial start
    const elapsed = performance.now() - introStartTime;
    const introFade = Math.min(1, elapsed / 850);
    mapCtx.save();
    mapCtx.globalAlpha = introFade;

    // FULL SCREEN BACKGROUND SCALING: Delhi spans edge-to-edge across the whole viewport
    const cx = (mapW > 860 ? mapW * 0.52 : mapW * 0.5) + parallaxX;
    const cy = mapH * 0.50 + parallaxY;
    const scale = Math.max(mapW * 1.35, mapH * 1.6);

    function toCanvas(lat, lng) {
      const x = cx + (lng - 77.20) * scale;
      const y = cy - (lat - 28.62) * scale * 1.14;
      return [x, y];
    }

    // --- 1. Background Grid & Coordinates across full screen ---
    mapCtx.save();
    mapCtx.strokeStyle = "rgba(226, 232, 240, 0.6)";
    mapCtx.lineWidth = 1;
    const gridStep = 75;
    const offsetX = Math.floor(cx % gridStep);
    const offsetY = Math.floor(cy % gridStep);

    for (let x = offsetX; x < mapW; x += gridStep) {
      mapCtx.beginPath();
      mapCtx.moveTo(x, 0);
      mapCtx.lineTo(x, mapH);
      mapCtx.stroke();
    }
    for (let y = offsetY; y < mapH; y += gridStep) {
      mapCtx.beginPath();
      mapCtx.moveTo(0, y);
      mapCtx.lineTo(mapW, y);
      mapCtx.stroke();
    }

    // Header Grid Info
    mapCtx.font = "700 9.5px 'JetBrains Mono', monospace";
    mapCtx.fillStyle = "#94a3b8";
    mapCtx.fillText("28.6304° N, 77.2177° E • DELHI-NCR FULL BACKGROUND TACTICAL GRID", 48, mapH - 24);
    mapCtx.restore();

    // --- 2. NCT Delhi Official State Geographic Boundary Polygon ---
    mapCtx.save();
    mapCtx.beginPath();
    delhiBorderLatLng.forEach(([lat, lng], idx) => {
      const [px, py] = toCanvas(lat, lng);
      if (idx === 0) mapCtx.moveTo(px, py);
      else mapCtx.lineTo(px, py);
    });
    mapCtx.closePath();
    mapCtx.fillStyle = "rgba(241, 245, 249, 0.4)"; // Soft state area fill
    mapCtx.fill();
    mapCtx.strokeStyle = "#94a3b8";
    mapCtx.lineWidth = 2.2;
    mapCtx.setLineDash([6, 5]); // Tactical border dashed line
    mapCtx.stroke();
    mapCtx.setLineDash([]);
    mapCtx.restore();

    // Territory Label
    mapCtx.save();
    mapCtx.font = "900 13px 'Inter', sans-serif";
    mapCtx.fillStyle = "rgba(148, 163, 184, 0.45)";
    mapCtx.letterSpacing = "3px";
    const [nctX, nctY] = toCanvas(28.75, 77.10);
    mapCtx.fillText("NATIONAL CAPITAL TERRITORY OF DELHI", nctX - 120, nctY);
    mapCtx.restore();

    // --- 3. Hatched Cadastral City Blocks ---
    if (hatchPattern) {
      mapCtx.save();
      mapCtx.fillStyle = hatchPattern;
      urbanDistrictPolys.forEach((poly) => {
        mapCtx.beginPath();
        poly.forEach(([lat, lng], idx) => {
          const [px, py] = toCanvas(lat, lng);
          if (idx === 0) mapCtx.moveTo(px, py);
          else mapCtx.lineTo(px, py);
        });
        mapCtx.closePath();
        mapCtx.fill();
        mapCtx.strokeStyle = "rgba(203, 213, 225, 0.85)";
        mapCtx.lineWidth = 1;
        mapCtx.stroke();
      });
      mapCtx.restore();
    }

    // --- 4. Yamuna River Flow (Spans entire screen from top to bottom) ---
    mapCtx.save();
    mapCtx.strokeStyle = "#e0e7ff";
    mapCtx.lineWidth = 18;
    mapCtx.lineCap = "round";
    mapCtx.lineJoin = "round";
    mapCtx.beginPath();
    yamunaPathLatLng.forEach(([lat, lng], idx) => {
      const [px, py] = toCanvas(lat, lng);
      if (idx === 0) mapCtx.moveTo(px, py);
      else mapCtx.lineTo(px, py);
    });
    mapCtx.stroke();

    // River Center Flow Line
    mapCtx.strokeStyle = "#a5b4fc";
    mapCtx.lineWidth = 3.5;
    mapCtx.stroke();

    // River Label
    const [ymX, ymY] = toCanvas(28.64, 77.255);
    mapCtx.font = "700 9px 'JetBrains Mono', monospace";
    mapCtx.fillStyle = "#6366f1";
    mapCtx.fillText("YAMUNA RIVER BASIN", ymX + 16, ymY);
    mapCtx.restore();

    // --- 5. Inner Ring Road & Outer Ring Road (Large sweeping loops) ---
    mapCtx.save();
    // Outer Ring Road
    mapCtx.strokeStyle = "#cbd5e1";
    mapCtx.lineWidth = 2.8;
    mapCtx.lineCap = "round";
    mapCtx.beginPath();
    outerRingRoadLatLng.forEach(([lat, lng], idx) => {
      const [px, py] = toCanvas(lat, lng);
      if (idx === 0) mapCtx.moveTo(px, py);
      else mapCtx.lineTo(px, py);
    });
    mapCtx.stroke();

    // Inner Ring Road (Mahatma Gandhi Marg)
    mapCtx.strokeStyle = "#94a3b8";
    mapCtx.lineWidth = 3.2;
    mapCtx.beginPath();
    innerRingRoadLatLng.forEach(([lat, lng], idx) => {
      const [px, py] = toCanvas(lat, lng);
      if (idx === 0) mapCtx.moveTo(px, py);
      else mapCtx.lineTo(px, py);
    });
    mapCtx.closePath();
    mapCtx.stroke();

    // --- Tactical Concentric Range Rings & Radial Azimuth Spokes (RUX-Style) ---
    mapCtx.save();
    const [cpX, cpY] = toCanvas(28.632, 77.220);

    // 1. Concentric Range Rings radiating outward from CP across the background
    const rangeRings = [
      { r: scale * 0.055, label: "5 KM INNER CORE", dash: [] },
      { r: scale * 0.115, label: "15 KM METRO RING", dash: [4, 4] },
      { r: scale * 0.190, label: "30 KM REGIONAL PERIMETER", dash: [] },
      { r: scale * 0.285, label: "50 KM NCR GRID", dash: [6, 4] },
      { r: scale * 0.400, label: "75 KM TACTICAL RADAR LIMIT", dash: [] },
      { r: scale * 0.540, label: "100 KM INTER-STATE BOUNDARY", dash: [8, 6] }
    ];

    rangeRings.forEach((ring) => {
      mapCtx.save();
      mapCtx.strokeStyle = "rgba(148, 163, 184, 0.42)";
      mapCtx.lineWidth = 1.1;
      if (ring.dash.length > 0) {
        mapCtx.setLineDash(ring.dash);
      }
      mapCtx.beginPath();
      mapCtx.arc(cpX, cpY, ring.r, 0, Math.PI * 2);
      mapCtx.stroke();

      // Range ring distance stamp on horizontal axis
      mapCtx.setLineDash([]);
      mapCtx.font = "700 8px 'JetBrains Mono', monospace";
      mapCtx.fillStyle = "rgba(100, 116, 139, 0.65)";
      mapCtx.fillText(ring.label, cpX + ring.r + 6, cpY - 4);
      mapCtx.restore();
    });

    // 2. Radial Azimuth Spokes radiating outward from CP across the entire screen
    mapCtx.save();
    mapCtx.strokeStyle = "rgba(203, 213, 225, 0.55)";
    mapCtx.lineWidth = 1;
    const spokeAngles = [
      { rad: 0, label: "090° E" },
      { rad: Math.PI / 4, label: "135° SE" },
      { rad: Math.PI / 2, label: "180° S" },
      { rad: (3 * Math.PI) / 4, label: "225° SW" },
      { rad: Math.PI, label: "270° W" },
      { rad: (5 * Math.PI) / 4, label: "315° NW" },
      { rad: (3 * Math.PI) / 2, label: "000° N" },
      { rad: (7 * Math.PI) / 4, label: "045° NE" }
    ];
    const spokeLen = Math.max(mapW, mapH) * 1.6;

    spokeAngles.forEach((spoke) => {
      mapCtx.beginPath();
      const startX = cpX + Math.cos(spoke.rad) * 38;
      const startY = cpY + Math.sin(spoke.rad) * 38;
      const endX = cpX + Math.cos(spoke.rad) * spokeLen;
      const endY = cpY + Math.sin(spoke.rad) * spokeLen;
      mapCtx.moveTo(startX, startY);
      mapCtx.lineTo(endX, endY);
      mapCtx.stroke();
    });
    mapCtx.restore();

    // 3. Connaught Place Core Rings
    mapCtx.strokeStyle = "#475569";
    mapCtx.lineWidth = 2.4;
    mapCtx.beginPath();
    mapCtx.arc(cpX, cpY, 28, 0, Math.PI * 2);
    mapCtx.stroke();
    mapCtx.lineWidth = 1.5;
    mapCtx.beginPath();
    mapCtx.arc(cpX, cpY, 14, 0, Math.PI * 2);
    mapCtx.stroke();
    mapCtx.restore();

    // --- 6. Major Regional Expressways & Transit Corridors (Extended to boundaries) ---
    mapCtx.save();
    mapCtx.lineWidth = 3.2;
    mapCtx.strokeStyle = "#64748b";
    mapCtx.lineCap = "round";
    mapCtx.lineJoin = "round";

    expresswaysLatLng.forEach((exp) => {
      mapCtx.beginPath();
      exp.pts.forEach(([lat, lng], idx) => {
        const [px, py] = toCanvas(lat, lng);
        if (idx === 0) mapCtx.moveTo(px, py);
        else mapCtx.lineTo(px, py);
      });
      mapCtx.stroke();

      // Road tag
      const midIdx = Math.floor(exp.pts.length / 2);
      const [lblX, lblY] = toCanvas(exp.pts[midIdx][0], exp.pts[midIdx][1]);
      mapCtx.save();
      mapCtx.font = "700 8.5px 'JetBrains Mono', monospace";
      mapCtx.fillStyle = "#64748b";
      mapCtx.fillText(exp.name, lblX + 10, lblY - 6);
      mapCtx.restore();
    });
    mapCtx.restore();

    // --- 7. Pulsating Radar Rings from 3 Primary Command Hubs ---
    mapCtx.save();
    radarHubs.forEach((hub) => {
      hub.currentR += hub.speed;
      if (hub.currentR > hub.maxR) {
        hub.currentR = 0;
      }
      const [hx, hy] = toCanvas(hub.lat, hub.lng);
      const ringAlpha = (1 - hub.currentR / hub.maxR) * 0.45;
      mapCtx.strokeStyle = `rgba(220, 38, 38, ${ringAlpha})`;
      mapCtx.lineWidth = 1.5;
      mapCtx.beginPath();
      mapCtx.arc(hx, hy, hub.currentR, 0, Math.PI * 2);
      mapCtx.stroke();

      // Staggered second ring
      const r2 = (hub.currentR + hub.maxR / 2) % hub.maxR;
      const a2 = (1 - r2 / hub.maxR) * 0.3;
      mapCtx.strokeStyle = `rgba(239, 68, 68, ${a2})`;
      mapCtx.lineWidth = 1.2;
      mapCtx.beginPath();
      mapCtx.arc(hx, hy, r2, 0, Math.PI * 2);
      mapCtx.stroke();
    });
    mapCtx.restore();

    // --- 8. The 48 Tactical Coverage Nodes (Immersive full-screen distribution) ---
    mapCtx.save();
    const nowTime = performance.now() * 0.0025;

    tacticalNodes.forEach((node, idx) => {
      const [nx, ny] = toCanvas(node.lat, node.lng);
      const pulse = Math.sin(nowTime + idx * 0.4);

      let baseRadius = 4.2;
      let dotColor = "#ea580c";
      if (node.type === "hq") {
        baseRadius = 5.8;
        dotColor = "#dc2626";
      } else if (node.type === "core") {
        baseRadius = 4.6;
        dotColor = "#ef4444";
      } else if (node.type === "fringe") {
        baseRadius = 3.8;
        dotColor = "#f59e0b";
      }

      // Soft pulsating halo ring around node
      mapCtx.strokeStyle = node.type === "hq" ? "rgba(220, 38, 38, 0.45)" : "rgba(234, 88, 12, 0.3)";
      mapCtx.lineWidth = 1.2;
      mapCtx.beginPath();
      mapCtx.arc(nx, ny, baseRadius + 4.5 + pulse * 1.5, 0, Math.PI * 2);
      mapCtx.stroke();

      // Solid central core dot
      mapCtx.fillStyle = dotColor;
      mapCtx.beginPath();
      mapCtx.arc(nx, ny, baseRadius, 0, Math.PI * 2);
      mapCtx.fill();

      // Center white beacon dot on HQ nodes
      if (node.type === "hq") {
        mapCtx.fillStyle = "#ffffff";
        mapCtx.beginPath();
        mapCtx.arc(nx, ny, 2, 0, Math.PI * 2);
        mapCtx.fill();
      }

      // Crisp Monospace Labels for Key Hubs
      if (node.isLabel) {
        mapCtx.save();
        mapCtx.font = "700 9px 'JetBrains Mono', monospace";
        const textWidth = mapCtx.measureText(node.name).width;

        // Subtle background pill behind label for 100% legibility
        mapCtx.fillStyle = "rgba(255, 255, 255, 0.92)";
        mapCtx.fillRect(nx + 10, ny - 10, textWidth + 10, 16);
        mapCtx.strokeStyle = "rgba(226, 232, 240, 0.95)";
        mapCtx.lineWidth = 1;
        mapCtx.strokeRect(nx + 10, ny - 10, textWidth + 10, 16);

        mapCtx.fillStyle = node.type === "hq" ? "#dc2626" : "#1e293b";
        mapCtx.fillText(node.name, nx + 15, ny + 2.5);
        mapCtx.restore();
      }
    });

    mapCtx.restore();
    mapCtx.restore(); // for introFade globalAlpha

    introMapCanvasAnimId = requestAnimationFrame(drawDelhiMap);
  }

  drawDelhiMap();

  // ==========================================
  // PART B: Left Hero Neural Network Constellation Graph
  // ==========================================
  const neuralCtx = neuralCanvas.getContext("2d");
  let neuralW = 340;
  let neuralH = 220;

  function resizeNeural() {
    const rect = neuralCanvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    neuralW = rect.width || 340;
    neuralH = rect.height || 220;
    neuralCanvas.width = neuralW * dpr;
    neuralCanvas.height = neuralH * dpr;
    neuralCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener("resize", resizeNeural);
  resizeNeural();

  // Initialize Neural Nodes
  const nodeCount = 32;
  const neuralNodes = [];
  for (let i = 0; i < nodeCount; i++) {
    neuralNodes.push({
      x: 20 + Math.random() * (neuralW - 40),
      y: 15 + Math.random() * (neuralH - 30),
      vx: (Math.random() - 0.5) * 0.7,
      vy: (Math.random() - 0.5) * 0.7,
      radius: 2.5 + Math.random() * 2.5,
      isCrimson: Math.random() < 0.22,
      pulsePhase: Math.random() * Math.PI * 2
    });
  }

  // Interactive mouse repulsion inside the neural canvas
  let neuralMouse = { x: -9999, y: -9999, active: false };
  neuralCanvas.addEventListener("mousemove", (e) => {
    const rect = neuralCanvas.getBoundingClientRect();
    neuralMouse.x = e.clientX - rect.left;
    neuralMouse.y = e.clientY - rect.top;
    neuralMouse.active = true;
  });
  neuralCanvas.addEventListener("mouseleave", () => {
    neuralMouse.active = false;
  });

  // Data transmission packets traveling along edges
  const dataPackets = [];
  for (let i = 0; i < 8; i++) {
    dataPackets.push({
      sourceIdx: Math.floor(Math.random() * nodeCount),
      targetIdx: Math.floor(Math.random() * nodeCount),
      progress: Math.random(),
      speed: 0.008 + Math.random() * 0.012
    });
  }

  function drawNeuralNetwork() {
    if (!introAnimationRunning) return;

    neuralCtx.clearRect(0, 0, neuralW, neuralH);

    // 1. Update Physics & Boundaries
    neuralNodes.forEach((node) => {
      // Mouse repulsion
      if (neuralMouse.active) {
        const dx = node.x - neuralMouse.x;
        const dy = node.y - neuralMouse.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 65 && dist > 1) {
          const force = (65 - dist) / 65 * 0.5;
          node.vx += (dx / dist) * force;
          node.vy += (dy / dist) * force;
        }
      }

      // Damping
      node.vx *= 0.985;
      node.vy *= 0.985;

      // Ensure minimal drift
      if (Math.abs(node.vx) < 0.15) node.vx += (Math.random() - 0.5) * 0.08;
      if (Math.abs(node.vy) < 0.15) node.vy += (Math.random() - 0.5) * 0.08;

      node.x += node.vx;
      node.y += node.vy;

      // Bounce softly off margins
      const pad = 12;
      if (node.x < pad) { node.x = pad; node.vx *= -1; }
      if (node.x > neuralW - pad) { node.x = neuralW - pad; node.vx *= -1; }
      if (node.y < pad) { node.y = pad; node.vy *= -1; }
      if (node.y > neuralH - pad) { node.y = neuralH - pad; node.vy *= -1; }
    });

    // 2. Draw Interconnecting Elastic Lines
    const connectionDist = 68;
    for (let i = 0; i < nodeCount; i++) {
      for (let j = i + 1; j < nodeCount; j++) {
        const n1 = neuralNodes[i];
        const n2 = neuralNodes[j];
        const dist = Math.hypot(n1.x - n2.x, n1.y - n2.y);
        if (dist < connectionDist) {
          const lineAlpha = (1 - dist / connectionDist) * 0.42;
          neuralCtx.strokeStyle = `rgba(30, 41, 59, ${lineAlpha})`;
          neuralCtx.lineWidth = 1;
          neuralCtx.beginPath();
          neuralCtx.moveTo(n1.x, n1.y);
          neuralCtx.lineTo(n2.x, n2.y);
          neuralCtx.stroke();
        }
      }
    }

    // 3. Draw Traveling Data Packets
    dataPackets.forEach((pkt) => {
      pkt.progress += pkt.speed;
      if (pkt.progress >= 1) {
        pkt.progress = 0;
        pkt.sourceIdx = pkt.targetIdx;
        pkt.targetIdx = Math.floor(Math.random() * nodeCount);
      }
      const n1 = neuralNodes[pkt.sourceIdx];
      const n2 = neuralNodes[pkt.targetIdx];
      if (n1 && n2) {
        const px = n1.x + (n2.x - n1.x) * pkt.progress;
        const py = n1.y + (n2.y - n1.y) * pkt.progress;
        neuralCtx.fillStyle = "#dc2626";
        neuralCtx.beginPath();
        neuralCtx.arc(px, py, 2.2, 0, Math.PI * 2);
        neuralCtx.fill();
      }
    });

    // 4. Draw Graph Nodes
    const timeSec = performance.now() * 0.003;
    neuralNodes.forEach((node) => {
      const pulse = Math.sin(timeSec + node.pulsePhase) * 0.4;
      neuralCtx.beginPath();
      neuralCtx.arc(node.x, node.y, node.radius + pulse, 0, Math.PI * 2);

      if (node.isCrimson) {
        neuralCtx.fillStyle = "#dc2626";
        neuralCtx.shadowColor = "rgba(220, 38, 38, 0.5)";
        neuralCtx.shadowBlur = 6;
      } else {
        neuralCtx.fillStyle = "#0f172a";
        neuralCtx.shadowColor = "transparent";
        neuralCtx.shadowBlur = 0;
      }
      neuralCtx.fill();
    });

    // Reset shadow
    neuralCtx.shadowColor = "transparent";
    neuralCtx.shadowBlur = 0;

    introNeuralCanvasAnimId = requestAnimationFrame(drawNeuralNetwork);
  }

  drawNeuralNetwork();
}

window.enterMainDashboard = enterMainDashboard;
window.openIntroScreen = openIntroScreen;

