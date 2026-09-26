import type { GameEvent, GameSnapshot } from '../contracts';

/** One-shot cues the app plays outside the core's event stream. */
export type AudioCue = 'tap' | 'type' | 'hull' | 'alarm';

/**
 * Synthesized sound (PRD v1.2, G11): no audio files. Continuous layers follow the snapshot, one-shots
 * follow core events and app cues. Silent until the first user gesture unlocks it (iOS) and while muted.
 */
export interface GameAudio {
  readonly muted: boolean;
  /** 'off' before the first gesture, then the context state (for diagnostics, like renderState). */
  readonly state: string;
  unlock(): void;
  setMuted(muted: boolean): void;
  setSuspended(suspended: boolean): void;
  update(snapshot: GameSnapshot): void;
  event(event: GameEvent, snapshot: GameSnapshot): void;
  cue(cue: AudioCue): void;
  dispose(): void;
}

/** Hydraulic layer level and pitch: on only while the ram is pressing, rising with pressure. */
export function hydraulicVoice(snapshot: GameSnapshot): { gain: number; frequency: number } {
  const pressing = snapshot.phase === 'compressing';
  return { gain: pressing ? 0.1 + snapshot.pressure01 * 0.08 : 0, frequency: 46 + snapshot.pressure01 * 30 };
}

/** Creak layer: follows the core's warning cue while pressing, silent otherwise. */
export function creakVoice(snapshot: GameSnapshot): number {
  return snapshot.phase === 'compressing' ? Math.min(1, snapshot.stress01) * 0.3 : 0;
}

type Context = AudioContext;

function noiseBuffer(context: Context, seconds: number, brown: boolean): AudioBuffer {
  const buffer = context.createBuffer(1, Math.floor(context.sampleRate * seconds), context.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let index = 0; index < data.length; index++) {
    const white = Math.random() * 2 - 1;
    last = brown ? (last + 0.02 * white) / 1.02 : white;
    data[index] = brown ? last * 3.5 : white;
  }
  return buffer;
}

const silent: GameAudio = {
  muted: true,
  state: 'off',
  unlock() {}, setMuted() {}, setSuspended() {}, update() {}, event() {}, cue() {}, dispose() {},
};

export function createAudio(startMuted: boolean): GameAudio {
  const AudioContextClass = typeof window === 'undefined' ? undefined : window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return { ...silent, muted: startMuted };
  let context: Context | null = null;
  let muted = startMuted;
  let suspended = false;
  let master: GainNode | null = null;
  let hydraulic: { osc: OscillatorNode; filter: BiquadFilterNode; gain: GainNode } | null = null;
  let creak: { filter: BiquadFilterNode; gain: GainNode } | null = null;
  let white: AudioBuffer | null = null;

  const now = () => context!.currentTime;
  const envelope = (node: GainNode, peak: number, attack: number, decay: number, at = now()) => {
    node.gain.cancelScheduledValues(at);
    node.gain.setValueAtTime(0.0001, at);
    node.gain.exponentialRampToValueAtTime(peak, at + attack);
    node.gain.exponentialRampToValueAtTime(0.0001, at + attack + decay);
  };
  const tone = (type: OscillatorType, from: number, to: number, peak: number, decay: number, delay = 0) => {
    if (!context || !master) return;
    const at = now() + delay;
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, at);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), at + decay);
    envelope(gain, peak, 0.005, decay, at);
    osc.connect(gain).connect(master);
    osc.start(at); osc.stop(at + decay + 0.05);
  };
  const burst = (type: BiquadFilterType, frequency: number, peak: number, decay: number, delay = 0) => {
    if (!context || !master || !white) return;
    const at = now() + delay;
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    source.buffer = white;
    filter.type = type; filter.frequency.value = frequency;
    envelope(gain, peak, 0.004, decay, at);
    source.connect(filter).connect(gain).connect(master);
    source.start(at); source.stop(at + decay + 0.05);
  };

  function build(): void {
    const ctx = new AudioContextClass!();
    context = ctx;
    white = noiseBuffer(ctx, 1.5, false);
    const compressor = ctx.createDynamicsCompressor();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.9;
    master.connect(compressor).connect(ctx.destination);

    // Deep-sea bed: brown noise under a slowly breathing low-pass, and a faint low hum.
    const bed = ctx.createBufferSource();
    bed.buffer = noiseBuffer(ctx, 4, true); bed.loop = true;
    const bedFilter = ctx.createBiquadFilter(); bedFilter.type = 'lowpass'; bedFilter.frequency.value = 220;
    const breath = ctx.createOscillator(); breath.frequency.value = 0.07;
    const breathDepth = ctx.createGain(); breathDepth.gain.value = 90;
    breath.connect(breathDepth).connect(bedFilter.frequency);
    const bedGain = ctx.createGain(); bedGain.gain.value = 0.16;
    bed.connect(bedFilter).connect(bedGain).connect(master);
    const hum = ctx.createOscillator(); hum.frequency.value = 55;
    const humGain = ctx.createGain(); humGain.gain.value = 0.025;
    hum.connect(humGain).connect(master);
    bed.start(); breath.start(); hum.start();

    // Hydraulic ram: a low saw through a low-pass that opens with pressure.
    const osc = ctx.createOscillator(); osc.type = 'sawtooth'; osc.frequency.value = 46;
    const filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 380;
    const gain = ctx.createGain(); gain.gain.value = 0;
    osc.connect(filter).connect(gain).connect(master); osc.start();
    hydraulic = { osc, filter, gain };

    // Creak: band-passed noise with a stick-slip wobble.
    const creakSource = ctx.createBufferSource(); creakSource.buffer = white; creakSource.loop = true;
    const creakFilter = ctx.createBiquadFilter(); creakFilter.type = 'bandpass'; creakFilter.frequency.value = 900; creakFilter.Q.value = 9;
    const wobble = ctx.createOscillator(); wobble.type = 'square'; wobble.frequency.value = 11;
    const wobbleDepth = ctx.createGain(); wobbleDepth.gain.value = 260;
    wobble.connect(wobbleDepth).connect(creakFilter.frequency);
    const creakGain = ctx.createGain(); creakGain.gain.value = 0;
    creakSource.connect(creakFilter).connect(creakGain).connect(master);
    creakSource.start(); wobble.start();
    creak = { filter: creakFilter, gain: creakGain };
  }

  return {
    get muted() { return muted; },
    get state() { return context?.state ?? 'off'; },
    unlock() {
      if (!context) { try { build(); } catch { return; } }
      if (!suspended) void context!.resume().catch(() => {});
    },
    setMuted(next) {
      muted = next;
      if (context && master) master.gain.setTargetAtTime(next ? 0 : 0.9, now(), 0.05);
    },
    setSuspended(next) {
      suspended = next;
      if (!context) return;
      void (next ? context.suspend() : context.resume()).catch(() => {});
    },
    update(snapshot) {
      if (!context || !hydraulic || !creak) return;
      const at = now();
      const ram = hydraulicVoice(snapshot);
      hydraulic.gain.gain.setTargetAtTime(ram.gain, at, 0.04);
      hydraulic.osc.frequency.setTargetAtTime(ram.frequency, at, 0.05);
      hydraulic.filter.frequency.setTargetAtTime(380 + snapshot.pressure01 * 700, at, 0.05);
      creak.gain.gain.setTargetAtTime(creakVoice(snapshot), at, 0.03);
      creak.filter.frequency.setTargetAtTime(700 + snapshot.stress01 * 900, at, 0.05);
    },
    event(event) {
      if (!context) return;
      if (event.type === 'press-released') burst('highpass', 2200, 0.12, 0.35);
      if (event.type === 'stored') { tone('sine', 120, 55, 0.5, 0.28); tone('square', 2100, 1800, 0.05, 0.03, 0.12); }
      if (event.type === 'discarded') { tone('sine', 85, 50, 0.3, 0.22); burst('lowpass', 900, 0.08, 0.3, 0.05); }
      if (event.type === 'failed' && event.reason === 'specimen-broken') {
        burst('highpass', 1400, 0.5, 0.55);
        tone('sine', 70, 35, 0.7, 0.45);
        tone('triangle', 1850, 1700, 0.12, 0.9, 0.03);
        tone('triangle', 2630, 2500, 0.08, 0.7, 0.05);
      }
      if (event.type === 'specimen-selected') tone('sine', 220, 180, 0.06, 0.12);
      if (event.type === 'completed') { tone('sine', 330, 330, 0.08, 0.5); tone('sine', 495, 495, 0.06, 0.6, 0.12); }
    },
    cue(cue) {
      if (!context) return;
      if (cue === 'tap') tone('square', 1500, 1300, 0.025, 0.03);
      if (cue === 'type') tone('square', 2900, 2700, 0.012, 0.015);
      if (cue === 'alarm') { tone('sine', 660, 660, 0.03, 0.25); tone('sine', 520, 520, 0.03, 0.25, 0.3); }
      if (cue === 'hull') {
        tone('sawtooth', 44, 32, 0.22, 1.4);
        burst('lowpass', 300, 0.25, 1.2);
        [0.5, 0.85, 1.3].forEach((delay, index) => tone('sine', 1500 + index * 180, 1200, 0.05, 0.15, delay));
      }
    },
    dispose() { void context?.close().catch(() => {}); context = null; },
  };
}
