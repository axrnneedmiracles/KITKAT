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
  initAnimatedGradientBackground();
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

  // 1. Tactical Deep Blackish Stealth Ambient Radial Gradient
  const colors = [
    { color: "rgba(18, 25, 42, 0.95)", stop: "0%" },    // Deep Midnight Slate core
    { color: "rgba(11, 16, 28, 0.98)", stop: "35%" },   // Dark Tactical Obsidian
    { color: "rgba(7, 10, 18, 1)", stop: "65%" },       // Deep Blackish Carbon
    { color: "rgba(4, 6, 11, 1)", stop: "100%" }        // Pure Tactical Abyss Black
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
  const patternAlpha = 14; // Fine matte tactical carbon texture
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

  // Set CARTO Dark Matter as default tile layer (Tactical Blackish Map)
  cartoDark.addTo(map);

  const baseMaps = {
    "🌑 CARTO Dark Matter (Tactical)": cartoDark,
    "🗺️ OpenStreetMap Standard": osmStandard,
    "🧭 OpenStreetMap Voyager (Light)": cartoLight,
    "🏔️ OpenTopoMap (Terrain)": openTopo
  };
  L.control.layers(baseMaps, null, { position: "topleft" }).addTo(map);

  // Live Phone GPS Marker
  const userIcon = L.divIcon({
    className: "custom-user-marker",
    html: `<div id="user-pin-dot" class="user-pin-dot" style="background:#00f0ff; width:18px; height:18px; border-radius:50%; border:2px solid #fff; box-shadow: 0 0 16px #00f0ff;"></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9]
  });

  userMarker = L.marker(defaultCoords, { icon: userIcon }).addTo(map);
  userMarker.bindPopup("<b>Target Tactical Node: BLACK-027</b><br>Awaiting Live GPS Signal...").openPopup();

  userRadarCircle = L.circle(defaultCoords, {
    radius: 35,
    color: "#00f0ff",
    fillColor: "#00f0ff",
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

