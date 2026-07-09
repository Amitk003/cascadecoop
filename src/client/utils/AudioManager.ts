let ctx: AudioContext | null = null;

function getContext(): AudioContext {
  if (!ctx) {
    ctx = new AudioContext();
  }
  if (ctx.state === 'suspended') {
    void ctx.resume();
  }
  return ctx;
}

function playTone(freq: number, duration: number, type: OscillatorType, volume: number = 0.15): void {
  try {
    const c = getContext();
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(volume, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start(c.currentTime);
    osc.stop(c.currentTime + duration);
  } catch (e) {
    console.debug('Audio play failed:', e);
  }
}

export function playPlacementSound(): void {
  playTone(523, 0.1, 'sine', 0.12);
  setTimeout(() => playTone(659, 0.15, 'sine', 0.1), 80);
}

export function playScoreSound(): void {
  playTone(880, 0.08, 'sine', 0.1);
  setTimeout(() => playTone(1100, 0.12, 'sine', 0.08), 60);
  setTimeout(() => playTone(1320, 0.2, 'sine', 0.06), 120);
}

export function playSimulationStartSound(): void {
  playTone(220, 0.15, 'triangle', 0.1);
  setTimeout(() => playTone(330, 0.15, 'triangle', 0.08), 100);
  setTimeout(() => playTone(440, 0.2, 'triangle', 0.06), 200);
}

export function playRoundEndSound(): void {
  playTone(523, 0.2, 'sine', 0.12);
  setTimeout(() => playTone(659, 0.2, 'sine', 0.1), 150);
  setTimeout(() => playTone(784, 0.3, 'sine', 0.08), 300);
}
