// Emberline's sound: everything synthesized with WebAudio, no audio files.
// A low engine hum that climbs with the throttle, wind over the wings, a
// chime for a ring (brighter through the heart), a thud for a hit, and a
// small dawn fanfare when the mail gets through.

export function createSound() {
  let ac = null;
  let engine = null;
  let engineGain = null;
  let windGain = null;
  let muted = false;

  function ensure() {
    if (ac) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ac = new AC();

    engine = ac.createOscillator();
    engine.type = 'sawtooth';
    engine.frequency.value = 62;
    const engineFilter = ac.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 320;
    engineGain = ac.createGain();
    engineGain.gain.value = 0;
    engine.connect(engineFilter).connect(engineGain).connect(ac.destination);
    engine.start();

    const noiseLength = ac.sampleRate * 2;
    const noiseBuffer = ac.createBuffer(1, noiseLength, ac.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < noiseLength; i += 1) data[i] = Math.random() * 2 - 1;
    const wind = ac.createBufferSource();
    wind.buffer = noiseBuffer;
    wind.loop = true;
    const windFilter = ac.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.value = 700;
    windFilter.Q.value = 0.6;
    windGain = ac.createGain();
    windGain.gain.value = 0;
    wind.connect(windFilter).connect(windGain).connect(ac.destination);
    wind.start();
    return true;
  }

  function tone(freq, at, dur, type = 'sine', vol = 0.16) {
    if (!ac || muted) return;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    const t0 = ac.currentTime + at;
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(vol, t0 + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain).connect(ac.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  return {
    /** Call from a user gesture; safe to call again. */
    unlock() {
      if (ensure() && ac.state === 'suspended') ac.resume();
    },
    /** Continuous engine/wind levels for the current speed. */
    setEngine(speed, boosting, running) {
      if (!ac) return;
      const t = ac.currentTime;
      const target = muted || !running ? 0 : 0.05 + (speed / 90) * 0.05;
      engineGain.gain.setTargetAtTime(target, t, 0.12);
      engine.frequency.setTargetAtTime(52 + speed * 0.85 + (boosting ? 14 : 0), t, 0.15);
      windGain.gain.setTargetAtTime(muted || !running ? 0 : 0.012 + (speed / 90) * 0.035, t, 0.2);
    },
    ring(heart) {
      tone(heart ? 1318 : 1046, 0, 0.22, 'sine', 0.14);
      tone(heart ? 1760 : 1318, 0.07, 0.3, 'sine', 0.12);
      if (heart) tone(2217, 0.15, 0.4, 'sine', 0.1);
    },
    hit() {
      tone(96, 0, 0.3, 'square', 0.2);
      tone(58, 0.02, 0.42, 'sawtooth', 0.16);
    },
    leg() {
      tone(784, 0, 0.18, 'triangle', 0.12);
      tone(1046, 0.1, 0.26, 'triangle', 0.12);
    },
    landed() {
      [523, 659, 784, 1046].forEach((f, i) => tone(f, i * 0.11, 0.5, 'triangle', 0.14));
    },
    over() {
      [392, 330, 262].forEach((f, i) => tone(f, i * 0.16, 0.5, 'triangle', 0.12));
    },
    toggleMute() {
      muted = !muted;
      return muted;
    },
  };
}
