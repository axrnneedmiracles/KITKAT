/**
 * SHEcurity Emergency Handler
 * Manages live user state, real-time telemetry ingestion from physical mobile device,
 * risk explainability, event audit logging, and bi-directional safety verification.
 */

class EmergencyHandler {
  constructor() {
    this.userState = {
      userId: "SHE-027",
      userName: "Aditi Sharma",
      deviceModel: "Awaiting Mobile Connection...",
      isDeviceConnected: false,
      status: "WAITING", // WAITING | SAFE | CAUTION | HIGH_RISK | EMERGENCY
      riskScore: 0,
      riskLevel: "NORMAL",
      isSosActive: false,
      lastUpdated: null,
      location: {
        latitude: 28.6139,
        longitude: 77.2090,
        address: "Awaiting Live GPS Signal from Android Device...",
        speed: 0,
        heading: 0
      },
      movement: "Stationary",
      heartRate: {
        bpm: "--",
        source: "GoBoult Fit",
        status: "Standby",
        updatedAt: null
      },
      battery: "--",
      routeStatus: {
        activeRoute: "College → Hostel",
        isDeviated: false,
        deviationMeters: 0,
        nearestSafeZone: "University Gate 4"
      },
      communication: {
        primary: "DISCONNECTED",
        bluetooth: "STANDBY",
        lora: "STANDBY",
        activeTransport: "NONE"
      },
      riskReasons: ["Awaiting real telemetry stream from Android device..."],
      verification: {
        status: "IDLE", // IDLE | PENDING | VERIFIED_SAFE | DURESS_ALERT
        requestedAt: null,
        resolvedAt: null
      }
    };

    this.eventHistory = [
      {
        id: "EVT-1001",
        timestamp: new Date().toISOString(),
        type: "SYSTEM_READY",
        transport: "SERVER",
        riskScore: 0,
        summary: "SHEcurity Operations Server initialized. Ready for mobile app sync."
      }
    ];

    this.safeRoutes = [
      {
        id: "route-1",
        name: "College → Hostel Normal Corridor",
        start: { name: "University Campus", lat: 28.6139, lon: 77.2090 },
        destination: { name: "Girls Hostel Complex", lat: 28.6250, lon: 77.2180 },
        waypoints: [
          [28.6139, 77.2090],
          [28.6165, 77.2115],
          [28.6190, 77.2140],
          [28.6220, 77.2160],
          [28.6250, 77.2180]
        ]
      }
    ];

    this.safeLocations = [
      { id: "safe-1", name: "Hostel Complex", lat: 28.6250, lon: 77.2180, radiusMeters: 120 },
      { id: "safe-2", name: "University Campus", lat: 28.6139, lon: 77.2090, radiusMeters: 200 },
      { id: "safe-3", name: "Police Assistance Booth", lat: 28.6185, lon: 77.2135, radiusMeters: 80 }
    ];
  }

  addSafeRoute(route) {
    if (!route.id) route.id = "route-" + Date.now();
    this.safeRoutes.push(route);
    this.eventHistory.push({
      id: "EVT-" + (1000 + this.eventHistory.length + 1),
      timestamp: new Date().toISOString(),
      type: "ROUTE_CREATED",
      transport: "SERVER",
      riskScore: this.userState.riskScore,
      summary: `Custom safe travel corridor registered: ${route.name}`
    });
    return this.safeRoutes;
  }

  removeSafeRoute(id) {
    this.safeRoutes = this.safeRoutes.filter(r => r.id !== id);
    return this.safeRoutes;
  }

  updateProfile(profile) {
    if (profile.userName) this.userState.userName = profile.userName;
    if (profile.userPhone) this.userState.userPhone = profile.userPhone;
    if (profile.emergencyNotes !== undefined) this.userState.emergencyNotes = profile.emergencyNotes;
    if (Array.isArray(profile.safeLocations)) {
      this.safeLocations = profile.safeLocations.map(loc => ({
        id: loc.id || "loc-" + Date.now(),
        name: loc.name || "Safe Zone",
        lat: parseFloat(loc.lat || loc.center?.latitude || 0),
        lon: parseFloat(loc.lon || loc.center?.longitude || 0),
        radiusMeters: parseFloat(loc.radiusMeters || 120)
      }));
    }
    this.eventHistory.push({
      id: "EVT-" + (1000 + this.eventHistory.length + 1),
      timestamp: new Date().toISOString(),
      type: "PROFILE_UPDATED",
      transport: "SERVER",
      riskScore: this.userState.riskScore,
      summary: `User profile updated: ${this.userState.userName} (${this.safeLocations.length} safe zones)`
    });
    return this.getState();
  }

  setSafeLocations(locations) {
    if (Array.isArray(locations)) {
      this.safeLocations = locations.map(loc => ({
        id: loc.id || "loc-" + Date.now(),
        name: loc.name || "Safe Zone",
        lat: parseFloat(loc.lat || loc.center?.latitude || 0),
        lon: parseFloat(loc.lon || loc.center?.longitude || 0),
        radiusMeters: parseFloat(loc.radiusMeters || 120)
      }));
    }
    return this.safeLocations;
  }

  addSafeLocation(loc) {
    const newLoc = {
      id: loc.id || "loc-" + Date.now(),
      name: loc.name || "Safe Zone",
      lat: parseFloat(loc.lat || loc.center?.latitude || 0),
      lon: parseFloat(loc.lon || loc.center?.longitude || 0),
      radiusMeters: parseFloat(loc.radiusMeters || 120)
    };
    this.safeLocations.push(newLoc);
    return this.safeLocations;
  }

  removeSafeLocation(id) {
    this.safeLocations = this.safeLocations.filter(l => l.id !== id);
    return this.safeLocations;
  }

  registerDevice(deviceInfo) {
    this.userState.isDeviceConnected = true;
    this.userState.deviceModel = deviceInfo.model || deviceInfo.device || "Android Device";
    this.userState.communication.primary = "CONNECTED";
    this.userState.communication.activeTransport = "INTERNET";
    this.userState.status = "SAFE";

    this.eventHistory.push({
      id: "EVT-" + (1000 + this.eventHistory.length + 1),
      timestamp: new Date().toISOString(),
      type: "DEVICE_CONNECTED",
      transport: "WEBSOCKET",
      riskScore: this.userState.riskScore,
      summary: `Mobile device linked successfully: ${this.userState.deviceModel}`
    });

    return this.getState();
  }

  getState() {
    return {
      ...this.userState,
      safeRoutes: this.safeRoutes,
      safeLocations: this.safeLocations,
      historyCount: this.eventHistory.length
    };
  }

  getHistory(limit = 20) {
    return this.eventHistory.slice(-limit).reverse();
  }

  processTelemetry(data, transport = "INTERNET") {
    const timestamp = new Date().toISOString();
    this.userState.lastUpdated = timestamp;
    this.userState.isDeviceConnected = true;
    if (transport === "INTERNET") {
      this.lastInternetTelemetryTime = Date.now();
      this.userState.communication.primary = "CONNECTED";
      if (!this.userState.communication.lora || this.userState.communication.lora === "DISCONNECTED") {
        this.userState.communication.lora = "STANDBY";
      }
      this.userState.communication.activeTransport = this.userState.communication.lora.includes("ACTIVE") 
        ? "DUAL SYNC (WI-FI + LORA)" 
        : "WI-FI / INTERNET";
    } else if (transport === "LORA") {
      this.userState.communication.lora = "ACTIVE (433 MHz)";
      this.userState.communication.activeTransport = this.userState.communication.primary === "CONNECTED"
        ? "DUAL SYNC (WI-FI + LORA)"
        : "LORA RADIO FALLBACK";
    }

    if (data.userName) this.userState.userName = data.userName;
    if (data.userPhone) this.userState.userPhone = data.userPhone;
    if (data.emergencyNotes !== undefined) this.userState.emergencyNotes = data.emergencyNotes;

    if (data.latitude !== undefined && data.longitude !== undefined) {
      const newLat = parseFloat(data.latitude);
      const newLon = parseFloat(data.longitude);

      // Prevent GPS bouncing: ignore hardcoded fallback beacon coordinates (28.6139, 77.2090)
      // if we have recent real GPS telemetry from the mobile phone
      const isDummyBeacon = transport === "LORA" && Math.abs(newLat - 28.6139) < 0.001 && Math.abs(newLon - 77.2090) < 0.001;
      const isInternetActive = (Date.now() - (this.lastInternetTelemetryTime || 0)) < 15000;

      if (!isDummyBeacon || !isInternetActive) {
        this.userState.location.latitude = newLat;
        this.userState.location.longitude = newLon;
        this.userState.location.address = data.address || `Live GPS Fix (${newLat.toFixed(4)}, ${newLon.toFixed(4)})`;
        if (data.speed !== undefined) this.userState.location.speed = parseFloat(data.speed);
      }
    }

    // Handle SOS activation or cancellation
    const isExplicitSafe = data.isSafe === true || data.status === "SAFE" || 
      (data.reason && (data.reason.includes("SAFE") || data.reason.includes("CLEARED"))) ||
      (data.isSos === false && data.riskScore !== undefined && data.riskScore <= 40);

    if (isExplicitSafe && !data.isSos) {
      this.userState.isSosActive = false;
      this.userState.status = "SAFE";
      this.userState.riskLevel = "NORMAL";
      if (data.riskScore !== undefined) {
        this.userState.riskScore = Math.min(100, Math.max(0, parseInt(data.riskScore, 10)));
      } else {
        this.userState.riskScore = 8;
      }
      this.updateRiskLevel();
    } else {
      const incomingBpm = parseInt(data.heartRate?.bpm || data.heartRate || 0, 10);
      const isCriticalHr = (incomingBpm > 0 && incomingBpm <= 40) || incomingBpm >= 180;
      if (data.isSos === true || data.isSos === "true" || data.type === "EMERGENCY_ALERT" || isCriticalHr) {
        this.userState.isSosActive = true;
      }
    }

    // If SOS remains active, lock risk score at 98 / EMERGENCY
    if (this.userState.isSosActive) {
      this.userState.riskScore = 98;
      this.userState.status = "EMERGENCY";
      this.userState.riskLevel = "EMERGENCY";
    } else {
      if (data.riskScore !== undefined && !isExplicitSafe) {
        this.userState.riskScore = Math.min(100, Math.max(0, parseInt(data.riskScore, 10)));
      }
      this.updateRiskLevel();
    }

    if (data.movement) {
      this.userState.movement = data.movement.replace("_", " ");
    }

    if (data.heartRate !== undefined) {
      const bpm = parseInt(data.heartRate, 10);
      if (!isNaN(bpm) && bpm > 0) {
        this.userState.heartRate = {
          bpm,
          source: data.heartRateSource || "GoBoult Fit Live",
          status: bpm > 130 ? "Elevated / Panic" : bpm < 50 ? "Bradycardia" : "Normal Rhythm",
          updatedAt: timestamp
        };
      }
    }

    if (data.battery !== undefined) {
      this.userState.battery = parseInt(data.battery, 10);
    }

    if (data.routeStatus) {
      this.userState.routeStatus = { ...this.userState.routeStatus, ...data.routeStatus };
    }

    if (Array.isArray(data.riskReasons) && data.riskReasons.length > 0) {
      this.userState.riskReasons = data.riskReasons;
    } else if (data.reason) {
      this.userState.riskReasons = [data.reason];
    }

    const isEmergency = this.userState.isSosActive || this.userState.riskScore >= 80;
    const isSignificant = isEmergency || this.userState.riskScore >= 60 || transport === "LORA";

    if (isSignificant) {
      this.eventHistory.push({
        id: "EVT-" + (1000 + this.eventHistory.length + 1),
        timestamp,
        type: isEmergency ? "EMERGENCY_ALERT" : "HIGH_RISK_WARNING",
        transport,
        riskScore: this.userState.riskScore,
        summary: isEmergency
          ? `EMERGENCY SOS: Location [${this.userState.location.latitude.toFixed(4)}, ${this.userState.location.longitude.toFixed(4)}]. HR: ${this.userState.heartRate.bpm} BPM. Motion: ${this.userState.movement}.`
          : `Risk elevation (${this.userState.riskScore}/100). Movement: ${this.userState.movement}. Transport: ${transport}.`
      });
    }

    return this.getState();
  }

  processCompactLoraPacket(rawPacketString) {
    try {
      const trimmed = rawPacketString.trim();
      let parsed = { isSos: false };
      let explicitSos = false;
      let explicitSafe = false;

      if (trimmed.includes("|") || trimmed.includes(",")) {
        const delimiter = trimmed.includes("|") ? "|" : ",";
        const parts = trimmed.split(delimiter);
        for (const part of parts) {
          const cleanPart = part.trim();
          if (cleanPart === "SOS" || cleanPart === "SOS1" || cleanPart.includes("EMERGENCY")) {
            explicitSos = true;
          } else if (cleanPart === "SAFE" || cleanPart === "CLEAR" || cleanPart === "OK" || cleanPart === "RESOLVED") {
            explicitSafe = true;
          } else if (cleanPart.startsWith("NM:")) {
            parsed.userName = cleanPart.replace("NM:", "").replace(/_/g, " ");
          } else if (cleanPart.startsWith("PH:")) {
            parsed.userPhone = cleanPart.replace("PH:", "");
          } else if (cleanPart.startsWith("UID")) {
            parsed.userId = cleanPart.replace("UID", "");
          } else if (cleanPart.startsWith("LT") || cleanPart.startsWith("LAT:")) {
            parsed.latitude = parseFloat(cleanPart.replace("LT", "").replace("LAT:", ""));
          } else if (cleanPart.startsWith("LN") || cleanPart.startsWith("LON:")) {
            parsed.longitude = parseFloat(cleanPart.replace("LN", "").replace("LON:", ""));
          } else if (cleanPart.startsWith("R") || cleanPart.startsWith("RISK:")) {
            parsed.riskScore = parseInt(cleanPart.replace("R", "").replace("RISK:", ""), 10);
          } else if (cleanPart.startsWith("HR") || cleanPart.startsWith("BPM:")) {
            parsed.heartRate = parseInt(cleanPart.replace("HR", "").replace("BPM:", ""), 10);
          } else if (cleanPart.startsWith("BAT") || cleanPart.startsWith("BAT:")) {
            parsed.battery = parseInt(cleanPart.replace("BAT:", "").replace("BAT", ""), 10);
          } else if (cleanPart.startsWith("M_")) {
            const m = cleanPart.replace("M_", "");
            parsed.movement = m === "RUN" ? "Running" : m === "WALK" ? "Walking" : m === "FALL" ? "Possible Fall" : "Stationary";
          }
        }
      } else {
        // Raw text packet fallback
        if (trimmed.toUpperCase().includes("SOS") || trimmed.toUpperCase().includes("HELP")) {
          explicitSos = true;
        }
      }

      if (explicitSafe && !explicitSos) {
        return this.cancelSos();
      }

      parsed.isSos = explicitSos || (parsed.riskScore !== undefined && parsed.riskScore >= 80);

      parsed.reason = parsed.isSos ? "LoRa Emergency SOS Distress Signal" : "LoRa Routine Telemetry Stream";
      parsed.riskReasons = [
        "Received via 433MHz LoRa radio link",
        parsed.isSos ? "Manual SOS Triggered or High Risk" : "Normal off-grid tracking adhered to"
      ];

      return this.processTelemetry(parsed, "LORA");
    } catch (err) {
      console.error("[EmergencyHandler] Error parsing LoRa packet:", err.message);
      return null;
    }
  }

  updateRiskLevel() {
    const score = this.userState.riskScore;
    if (this.userState.isSosActive || score >= 81) {
      this.userState.status = "EMERGENCY";
      this.userState.riskLevel = "EMERGENCY";
    } else if (score >= 61) {
      this.userState.status = "HIGH_RISK";
      this.userState.riskLevel = "HIGH_RISK";
    } else if (score >= 31) {
      this.userState.status = "CAUTION";
      this.userState.riskLevel = "CAUTION";
    } else {
      this.userState.status = "SAFE";
      this.userState.riskLevel = "NORMAL";
    }
  }

  triggerSafetyCheck() {
    this.userState.verification.status = "PENDING";
    this.userState.verification.requestedAt = new Date().toISOString();
    this.userState.verification.resolvedAt = null;

    this.eventHistory.push({
      id: "EVT-" + (1000 + this.eventHistory.length + 1),
      timestamp: this.userState.verification.requestedAt,
      type: "SAFETY_CHECK_REQUESTED",
      transport: this.userState.communication.activeTransport,
      riskScore: this.userState.riskScore,
      summary: "Operator initiated discreet 'Are you safe?' vibration challenge to mobile phone."
    });

    return this.getState();
  }

  resolveSafetyCheck(result) {
    const now = new Date().toISOString();
    this.userState.verification.resolvedAt = now;

    if (result === "SAFE") {
      this.userState.verification.status = "VERIFIED_SAFE";
      this.userState.isSosActive = false;
      this.userState.riskScore = Math.max(5, this.userState.riskScore - 30);
      this.updateRiskLevel();
      this.eventHistory.push({
        id: "EVT-" + (1000 + this.eventHistory.length + 1),
        timestamp: now,
        type: "SAFETY_CONFIRMED",
        transport: this.userState.communication.activeTransport,
        riskScore: this.userState.riskScore,
        summary: "User verified SAFE on mobile phone with Biometric Fingerprint / Safe PIN (1234)."
      });
    } else if (result === "DURESS") {
      this.userState.verification.status = "DURESS_ALERT";
      this.userState.isSosActive = true;
      this.userState.riskScore = 98;
      this.updateRiskLevel();
      this.userState.riskReasons.unshift("🚨 DURESS CODE (5678) ENTERED UNDER COERCION");
      this.eventHistory.push({
        id: "EVT-" + (1000 + this.eventHistory.length + 1),
        timestamp: now,
        type: "DURESS_SOS",
        transport: this.userState.communication.activeTransport,
        riskScore: 98,
        summary: "CRITICAL: Duress code 5678 entered! Phone shows fake all-clear to attacker, but distress signal sent."
      });
    }

    return this.getState();
  }

  cancelSos() {
    this.userState.isSosActive = false;
    this.userState.riskScore = 8;
    this.userState.status = "SAFE";
    this.userState.riskLevel = "NORMAL";
    this.userState.riskReasons = ["Emergency cleared by user/operator. Restoring normal baseline monitoring."];
    this.eventHistory.push({
      id: "EVT-" + (1000 + this.eventHistory.length + 1),
      timestamp: new Date().toISOString(),
      type: "EMERGENCY_RESOLVED",
      transport: this.userState.communication.activeTransport,
      riskScore: 8,
      summary: "Emergency SOS cleared. Restoring normal baseline monitoring."
    });
    return this.getState();
  }
}

module.exports = EmergencyHandler;
