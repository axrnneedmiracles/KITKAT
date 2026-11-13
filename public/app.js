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

  introScreen.classList.add("fade-out");

  setTimeout(() => {
    introScreen.style.display = "none";
    introAnimationRunning = false;
    if (introMapCanvasAnimId) cancelAnimationFrame(introMapCanvasAnimId);
    if (introNeuralCanvasAnimId) cancelAnimationFrame(introNeuralCanvasAnimId);
    if (map) {
      map.invalidateSize();
    }
  }, 750);
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

  introScreen.style.display = "flex";
  introScreen.classList.remove("fade-out");

  introAnimationRunning = true;
  initDelhiMapAndNeuralNetwork(false); // don't restart auto-timer when reopened
}

function initDelhiMapAndNeuralNetwork(startTimer = true) {
  const introScreen = document.getElementById("intro-screen");
  if (!introScreen) return;

  // 1. Countdown Timer (5 seconds by default)
  if (startTimer) {
    let secondsLeft = 5;
    const timerEl = document.getElementById("intro-countdown-timer");
    if (introTimerInterval) clearInterval(introTimerInterval);
    introTimerInterval = setInterval(() => {
      secondsLeft--;
      if (timerEl) {
        timerEl.innerText = `Auto-entering in ${secondsLeft}s...`;
      }
      if (secondsLeft <= 0) {
        clearInterval(introTimerInterval);
        introTimerInterval = null;
        enterMainDashboard();
      }
    }, 1000);
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
  // PART A: Delhi Map & Red Coverage Mesh
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

  // Create Hatch Pattern for Urban Blocks
  const hatchCanvas = document.createElement("canvas");
  hatchCanvas.width = 16;
  hatchCanvas.height = 16;
  const hatchCtx = hatchCanvas.getContext("2d");
  hatchCtx.strokeStyle = "rgba(226, 232, 240, 0.95)"; // delicate light slate
  hatchCtx.lineWidth = 1.2;
  hatchCtx.beginPath();
  hatchCtx.moveTo(0, 16);
  hatchCtx.lineTo(16, 0);
  hatchCtx.moveTo(-4, 4);
  hatchCtx.lineTo(4, -4);
  hatchCtx.moveTo(12, 20);
  hatchCtx.lineTo(20, 12);
  hatchCtx.stroke();
  const hatchPattern = mapCtx.createPattern(hatchCanvas, "repeat");

  // Multi-tier Tactical Coverage Node Generator
  // Dense core around Connaught Place, spreading into South Delhi, Noida, Gurgaon, Faridabad
  const totalNodes = 380;
  const clusterNodes = [];

  // Color palettes for multi-tiered RUX style
  const deepBurgundy = ["#7f1d1d", "#991b1b", "#b91c1c", "#881337"];
  const brightRedOrange = ["#dc2626", "#ef4444", "#f87171", "#ea580c", "#f97316"];
  const outerPeachAmber = ["#f97316", "#fb923c", "#fdba74", "#fed7aa", "#ffedd5"];

  for (let i = 0; i < totalNodes; i++) {
    let relX = 0;
    let relY = 0;
    let color = "";
    let radius = 4;
    let alpha = 0.85;

    if (i < 150) {
      // Tier 1: Inner Core (Connaught Place / India Gate / Lutyens / ITO)
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.pow(Math.random(), 0.7) * 135;
      relX = Math.cos(angle) * dist * 1.15;
      relY = Math.sin(angle) * dist * 0.95;
      color = deepBurgundy[Math.floor(Math.random() * deepBurgundy.length)];
      radius = 4.5 + Math.random() * 8.5;
      alpha = 0.82 + Math.random() * 0.16;
    } else if (i < 290) {
      // Tier 2: Urban Corridors
      // Weighted towards Gurgaon (SW), Noida (SE), South Delhi/Faridabad (S), North (NW)
      const corridorChoice = Math.random();
      let angle, dist;
      if (corridorChoice < 0.32) {
        // Gurgaon corridor (SW angle ~ 210° - 235°)
        angle = (210 + Math.random() * 30) * (Math.PI / 180);
        dist = 90 + Math.random() * 260;
      } else if (corridorChoice < 0.62) {
        // Noida corridor (SE angle ~ 25° - 55°)
        angle = (25 + Math.random() * 30) * (Math.PI / 180);
        dist = 90 + Math.random() * 240;
      } else if (corridorChoice < 0.85) {
        // South Delhi / Faridabad (S angle ~ 85° - 115°)
        angle = (85 + Math.random() * 30) * (Math.PI / 180);
        dist = 90 + Math.random() * 280;
      } else {
        // North / West Delhi (angles 280° - 350°)
        angle = (280 + Math.random() * 70) * (Math.PI / 180);
        dist = 70 + Math.random() * 200;
      }
      relX = Math.cos(angle) * dist + (Math.random() - 0.5) * 40;
      relY = Math.sin(angle) * dist + (Math.random() - 0.5) * 40;
      color = brightRedOrange[Math.floor(Math.random() * brightRedOrange.length)];
      radius = 3.5 + Math.random() * 6.5;
      alpha = 0.72 + Math.random() * 0.22;
    } else {
      // Tier 3: Peripheral Relays & Transit Corridors (Fringe)
      const angle = Math.random() * Math.PI * 2;
      const dist = 160 + Math.random() * 280;
      relX = Math.cos(angle) * dist * 1.1;
      relY = Math.sin(angle) * dist;
      color = outerPeachAmber[Math.floor(Math.random() * outerPeachAmber.length)];
      radius = 3 + Math.random() * 5.5;
      alpha = 0.6 + Math.random() * 0.25;
    }

    clusterNodes.push({
      relX,
      relY,
      color,
      baseRadius: radius,
      alpha,
      phase: Math.random() * Math.PI * 2,
      pulseSpeed: 0.015 + Math.random() * 0.02
    });
  }

  // Radar wave emitters for 4 primary hubs
  const radarHubs = [
    { relX: 0, relY: 0, maxR: 160, currentR: 10, speed: 0.75, label: "CP CORE-01" },
    { relX: -40, relY: 130, maxR: 120, currentR: 60, speed: 0.65, label: "AIIMS-02" },
    { relX: 230, relY: 120, maxR: 140, currentR: 90, speed: 0.7, label: "NOIDA-03" },
    { relX: 160, relY: 330, maxR: 110, currentR: 35, speed: 0.6, label: "SECTOR-88" }
  ];

  // Tactical City Blocks (cross-hatched polygons)
  const urbanBlocks = [
    // Central Secretariat / Lutyens
    [[-80, -30], [-10, -80], [30, -50], [-20, 20]],
    // Barakhamba / Mandi House
    [[40, -40], [110, -70], [130, -10], [50, 10]],
    // Parliament Street / Janpath West
    [[-110, 10], [-40, 20], [-60, 80], [-130, 60]],
    // India Gate lawns & C-Hexagon
    [[20, 30], [90, 20], [110, 80], [40, 90]],
    // South Delhi (Defence Colony / Lajpat Nagar)
    [[30, 130], [110, 120], [120, 180], [40, 190]],
    // Chanakyapuri Diplomatic Enclave
    [[-160, 60], [-90, 80], [-120, 150], [-180, 130]],
    // Dhaula Kuan / Cantt
    [[-240, 70], [-170, 90], [-200, 160], [-260, 140]],
    // Cyber City Gurgaon
    [[-340, 200], [-280, 210], [-310, 270], [-370, 260]],
    // Noida Sector 18 / Film City
    [[200, 90], [270, 80], [290, 150], [210, 160]],
    // Faridabad Sector 88 Link
    [[130, 300], [200, 290], [210, 360], [140, 370]]
  ];

  function drawDelhiMap() {
    if (!introAnimationRunning) return;

    // Smooth Parallax
    parallaxX += (targetParallaxX - parallaxX) * 0.05;
    parallaxY += (targetParallaxY - parallaxY) * 0.05;

    mapCtx.clearRect(0, 0, mapW, mapH);

    // Dynamic Delhi Center (slightly right on desktop, centered on mobile)
    const cx = (mapW > 860 ? mapW * 0.58 : mapW * 0.5) + parallaxX;
    const cy = mapH * 0.48 + parallaxY;

    // --- 1. Background Grid & Coordinates ---
    mapCtx.save();
    mapCtx.strokeStyle = "rgba(226, 232, 240, 0.6)";
    mapCtx.lineWidth = 1;
    const gridStep = 80;
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
    mapCtx.restore();

    // --- 2. Hatched Cadastral City Blocks ---
    if (hatchPattern) {
      mapCtx.save();
      mapCtx.fillStyle = hatchPattern;
      urbanBlocks.forEach((poly) => {
        mapCtx.beginPath();
        poly.forEach((pt, idx) => {
          const px = cx + pt[0];
          const py = cy + pt[1];
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

    // --- 3. Yamuna River (Flowing North to South-East) ---
    mapCtx.save();
    mapCtx.strokeStyle = "#e0e7ff";
    mapCtx.lineWidth = 18;
    mapCtx.lineCap = "round";
    mapCtx.lineJoin = "round";
    mapCtx.beginPath();
    mapCtx.moveTo(cx + 90, cy - 380);
    mapCtx.bezierCurveTo(cx + 85, cy - 180, cx + 110, cy - 40, cx + 140, cy + 90);
    mapCtx.bezierCurveTo(cx + 170, cy + 200, cx + 220, cy + 300, cx + 260, cy + 420);
    mapCtx.stroke();

    // River inner flow line
    mapCtx.strokeStyle = "#c7d2fe";
    mapCtx.lineWidth = 3.5;
    mapCtx.stroke();
    mapCtx.restore();

    // River label
    mapCtx.save();
    mapCtx.font = "600 9px 'JetBrains Mono', monospace";
    mapCtx.fillStyle = "#818cf8";
    mapCtx.fillText("YAMUNA RIVER BASIN", cx + 160, cy + 80);
    mapCtx.restore();

    // --- 4. Major Delhi Road Networks & Expressways ---
    mapCtx.save();

    // Outer Ring Road Loop
    mapCtx.strokeStyle = "#e2e8f0";
    mapCtx.lineWidth = 3;
    mapCtx.beginPath();
    mapCtx.ellipse(cx, cy + 10, 280, 240, 0, 0, Math.PI * 2);
    mapCtx.stroke();

    // Inner Ring Road Loop (Mahatma Gandhi Marg)
    mapCtx.strokeStyle = "#cbd5e1";
    mapCtx.lineWidth = 3.5;
    mapCtx.beginPath();
    mapCtx.ellipse(cx, cy + 5, 160, 135, 0, 0, Math.PI * 2);
    mapCtx.stroke();

    // Connaught Place Concentric Circles
    mapCtx.strokeStyle = "#94a3b8";
    mapCtx.lineWidth = 2.5;
    mapCtx.beginPath();
    mapCtx.arc(cx, cy, 64, 0, Math.PI * 2); // Outer Circle (Connaught Circus)
    mapCtx.stroke();

    mapCtx.lineWidth = 1.5;
    mapCtx.beginPath();
    mapCtx.arc(cx, cy, 44, 0, Math.PI * 2); // Middle Circle
    mapCtx.stroke();

    mapCtx.lineWidth = 2.5;
    mapCtx.beginPath();
    mapCtx.arc(cx, cy, 24, 0, Math.PI * 2); // Inner Circle
    mapCtx.stroke();

    // Radial Spokes from Connaught Place
    mapCtx.lineWidth = 2;
    mapCtx.strokeStyle = "#cbd5e1";
    const spokeAngles = [0, 45, 90, 135, 180, 225, 270, 315];
    spokeAngles.forEach((deg) => {
      const rad = (deg * Math.PI) / 180;
      mapCtx.beginPath();
      mapCtx.moveTo(cx + Math.cos(rad) * 24, cy + Math.sin(rad) * 24);
      mapCtx.lineTo(cx + Math.cos(rad) * 160, cy + Math.sin(rad) * 135);
      mapCtx.stroke();
    });

    // NH-48 / Delhi-Gurgaon Expressway (to Cyber City / IGI)
    mapCtx.strokeStyle = "#94a3b8";
    mapCtx.lineWidth = 3.5;
    mapCtx.beginPath();
    mapCtx.moveTo(cx - 70, cy + 40);
    mapCtx.lineTo(cx - 170, cy + 100);
    mapCtx.lineTo(cx - 260, cy + 170);
    mapCtx.lineTo(cx - 390, cy + 280);
    mapCtx.stroke();

    // DND Flyway & Noida Expressway
    mapCtx.strokeStyle = "#94a3b8";
    mapCtx.lineWidth = 3.5;
    mapCtx.beginPath();
    mapCtx.moveTo(cx + 80, cy + 85);
    mapCtx.lineTo(cx + 180, cy + 110);
    mapCtx.lineTo(cx + 280, cy + 160);
    mapCtx.lineTo(cx + 420, cy + 260);
    mapCtx.stroke();

    // Mathura Road & Faridabad Bypass (heading south past Badarpur to Sector 88)
    mapCtx.strokeStyle = "#94a3b8";
    mapCtx.lineWidth = 3.5;
    mapCtx.beginPath();
    mapCtx.moveTo(cx + 60, cy + 90);
    mapCtx.lineTo(cx + 100, cy + 170);
    mapCtx.lineTo(cx + 140, cy + 270);
    mapCtx.lineTo(cx + 180, cy + 390);
    mapCtx.stroke();

    // GT Karnal Road (heading north)
    mapCtx.strokeStyle = "#cbd5e1";
    mapCtx.lineWidth = 2.5;
    mapCtx.beginPath();
    mapCtx.moveTo(cx, cy - 64);
    mapCtx.lineTo(cx - 30, cy - 180);
    mapCtx.lineTo(cx - 70, cy - 360);
    mapCtx.stroke();

    // Rohtak Road (heading west)
    mapCtx.beginPath();
    mapCtx.moveTo(cx - 64, cy);
    mapCtx.lineTo(cx - 190, cy - 30);
    mapCtx.lineTo(cx - 360, cy - 60);
    mapCtx.stroke();

    // Vikas Marg (heading east)
    mapCtx.beginPath();
    mapCtx.moveTo(cx + 64, cy);
    mapCtx.lineTo(cx + 200, cy - 20);
    mapCtx.lineTo(cx + 360, cy - 40);
    mapCtx.stroke();

    mapCtx.restore();

    // --- 5. Road & Tactical Location Labels ---
    mapCtx.save();
    mapCtx.font = "700 8.5px 'JetBrains Mono', monospace";
    mapCtx.fillStyle = "#64748b";

    mapCtx.fillText("CONNAUGHT PLACE [CORE-01]", cx - 80, cy - 72);
    mapCtx.fillText("NH-48 EXPRESSWAY → GURGAON", cx - 350, cy + 260);
    mapCtx.fillText("DND FLYWAY → NOIDA SEC-18", cx + 220, cy + 145);
    mapCtx.fillText("MATHURA RD → FARIDABAD SEC-88 [NODE-01]", cx + 90, cy + 365);
    mapCtx.fillText("INNER RING ROAD", cx - 140, cy - 145);
    mapCtx.fillText("OUTER RING ROAD", cx - 250, cy - 245);
    mapCtx.fillText("CYBER CITY GURGAON [HUB-03]", cx - 370, cy + 300);
    mapCtx.fillText("ASIAN FIDELIS / SEC-88 [RELAY]", cx + 150, cy + 410);

    mapCtx.restore();

    // --- 6. Pulsating Radar Rings from 4 Primary Hubs ---
    mapCtx.save();
    radarHubs.forEach((hub) => {
      hub.currentR += hub.speed;
      if (hub.currentR > hub.maxR) {
        hub.currentR = 0;
      }
      const ringAlpha = (1 - hub.currentR / hub.maxR) * 0.45;
      mapCtx.strokeStyle = `rgba(220, 38, 38, ${ringAlpha})`;
      mapCtx.lineWidth = 1.5;
      mapCtx.beginPath();
      mapCtx.arc(cx + hub.relX, cy + hub.relY, hub.currentR, 0, Math.PI * 2);
      mapCtx.stroke();

      // Second staggered wave
      const secondR = (hub.currentR + hub.maxR / 2) % hub.maxR;
      const secondAlpha = (1 - secondR / hub.maxR) * 0.35;
      mapCtx.strokeStyle = `rgba(239, 68, 68, ${secondAlpha})`;
      mapCtx.lineWidth = 1;
      mapCtx.beginPath();
      mapCtx.arc(cx + hub.relX, cy + hub.relY, secondR, 0, Math.PI * 2);
      mapCtx.stroke();
    });
    mapCtx.restore();

    // --- 7. Multi-Tier Red/Orange Coverage Dot Mesh (The RUX-style cluster) ---
    mapCtx.save();
    const nowTime = performance.now() * 0.002;

    clusterNodes.forEach((node) => {
      // Subtle organic breathing oscillation
      const pulse = Math.sin(nowTime + node.phase);
      const curRadius = Math.max(1.5, node.baseRadius + pulse * 0.7);
      const curAlpha = Math.min(1, Math.max(0.2, node.alpha + pulse * 0.08));

      mapCtx.globalAlpha = curAlpha;
      mapCtx.fillStyle = node.color;
      mapCtx.beginPath();
      mapCtx.arc(cx + node.relX, cy + node.relY, curRadius, 0, Math.PI * 2);
      mapCtx.fill();
    });

    mapCtx.restore();

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

