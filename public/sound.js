/**
 * SHEcurity Web Audio Alert Synthesizer
 * Generates tactical alarm tones without external audio file dependencies.
 */

class TacticalSound {
  constructor() {
    this.ctx = null;
    this.isAlarmPlaying = false;
    this.alarmInterval = null;
  }

  init() {
    if (!this.ctx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioContext();
    }
  }

  playBeep(freq = 880, duration = 0.15, type = "sine") {
    try {
      this.init();
      if (this.ctx.state === "suspended") this.ctx.resume();
      
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      
      gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
      
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      
      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch (e) {
      console.warn("AudioContext play error:", e);
    }
  }

  startEmergencySiren() {
    if (this.isAlarmPlaying) return;
    this.isAlarmPlaying = true;
    
    const cycle = () => {
      if (!this.isAlarmPlaying) return;
      this.playBeep(920, 0.25, "sawtooth");
      setTimeout(() => {
        if (this.isAlarmPlaying) this.playBeep(640, 0.25, "sawtooth");
      }, 300);
    };

    cycle();
    this.alarmInterval = setInterval(cycle, 1200);
  }

  stopEmergencySiren() {
    this.isAlarmPlaying = false;
    if (this.alarmInterval) {
      clearInterval(this.alarmInterval);
      this.alarmInterval = null;
    }
  }

  playAckChime() {
    this.playBeep(523.25, 0.1, "triangle"); // C5
    setTimeout(() => this.playBeep(659.25, 0.1, "triangle"), 100); // E5
    setTimeout(() => this.playBeep(783.99, 0.2, "triangle"), 200); // G5
  }
}

window.tacticalSound = new TacticalSound();
