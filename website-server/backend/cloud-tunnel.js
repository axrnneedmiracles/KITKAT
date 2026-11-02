/**
 * Cloudflare Tunnel Integration for SHEcurity
 * Enables distance testing across different networks (e.g. mobile data 4G/5G vs home Wi-Fi)
 * Provides a free, secure global HTTPS & WSS endpoint without requiring port forwarding.
 */

const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

class CloudTunnel {
  constructor(localPort = 3000) {
    this.localPort = localPort;
    this.process = null;
    this.tunnelUrl = null;
    this.cloudflaredBinary = path.resolve(__dirname, "../cloudflared.exe");
    this.statusFile = path.resolve(__dirname, "../dashboard/tunnel-info.json");
  }

  start(onReadyCallback) {
    if (!fs.existsSync(this.cloudflaredBinary)) {
      console.log("[CloudTunnel] ℹ️ cloudflared.exe not found at", this.cloudflaredBinary);
      return;
    }

    try {
      this.process = spawn(this.cloudflaredBinary, [
        "tunnel",
        "--url",
        `http://localhost:${this.localPort}`
      ]);

      const onData = (data) => {
        const text = data.toString();
        const match = text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/i);
        if (match && !this.tunnelUrl) {
          this.tunnelUrl = match[0];
          console.log("\n=======================================================");
          console.log("🌐 GLOBAL CLOUD TUNNEL ACTIVE (FOR DIFFERENT NETWORKS):");
          console.log(`🔗 Public URL: ${this.tunnelUrl}`);
          console.log(`📱 In Phone App, connect to: ${this.tunnelUrl.replace("https://", "")}`);
          console.log("=======================================================\n");

          // Save to dashboard info file for web UI banner
          try {
            fs.writeFileSync(
              this.statusFile,
              JSON.stringify({
                active: true,
                url: this.tunnelUrl,
                host: this.tunnelUrl.replace("https://", ""),
                timestamp: new Date().toISOString()
              }, null, 2)
            );
          } catch (e) {}

          if (typeof onReadyCallback === "function") {
            onReadyCallback(this.tunnelUrl);
          }
        }
      };

      this.process.stderr.on("data", onData);
      this.process.stdout.on("data", onData);

      this.process.on("error", (err) => {
        console.warn("[CloudTunnel] ⚠️ Warning: Failed to spawn cloudflared:", err.message);
      });

      this.process.on("close", (code) => {
        this.tunnelUrl = null;
        try {
          if (fs.existsSync(this.statusFile)) fs.unlinkSync(this.statusFile);
        } catch (e) {}
      });

      // Cleanup on server exit
      process.on("exit", () => this.stop());
      process.on("SIGINT", () => {
        this.stop();
        process.exit();
      });
      process.on("SIGTERM", () => {
        this.stop();
        process.exit();
      });

    } catch (err) {
      console.warn("[CloudTunnel] ⚠️ Could not start tunnel:", err.message);
    }
  }

  stop() {
    if (this.process) {
      try {
        this.process.kill();
      } catch (e) {}
      this.process = null;
    }
    this.tunnelUrl = null;
    try {
      if (fs.existsSync(this.statusFile)) fs.unlinkSync(this.statusFile);
    } catch (e) {}
  }

  getUrl() {
    return this.tunnelUrl;
  }
}

module.exports = CloudTunnel;

