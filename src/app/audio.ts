import type { GameEvent, GameSnapshot } from '../contracts';

/** One-shot cues the app plays outside the core's event stream. */
export type AudioCue = 'tap' | 'type' | 'hull' | 'alarm';

/**
 * Game sound (G11) from CC0 recordings: see assets/source/audio (sources, cuts, make-audio.py).
 * Continuous layers follow the snapshot, one-shots follow core events and app cues. Silent until
 * the first user gesture unlocks it (iOS), at zero volume, and wherever Web Audio is missing.
 */
export interface GameAudio {
  /** 'off' before the first gesture, then the context state (for diagnostics, like renderState). */
  readonly state: string;
  unlock(): void;
  /** Background bed and effect volumes, 0–1 each (settings menu). */
  setVolumes(music: number, effects: number): void;
  setSuspended(suspended: boolean): void;
  update(snapshot: GameSnapshot): void;
  event(event: GameEvent, snapshot: GameSnapshot): void;
  cue(cue: AudioCue): void;
  dispose(): void;
}

const SOUNDS = ['bed-sea', 'bed-hull', 'press', 'creak', 'break-glass', 'break-metal', 'release', 'store', 'discard', 'hull-groan', 'drip', 'alarm', 'click'] as const;
type Sound = typeof SOUNDS[number];

/** Seamless loop windows written by make-audio.py (0.25 s of wrapped padding on each side). */
const LOOPS: Readonly<Partial<Record<Sound, readonly [number, number]>>> = {
  'bed-sea': [0.25, 20.25], 'bed-hull': [0.25, 20.25], press: [0.25, 8.25], creak: [0.25, 12.25],
};

/** Hydraulic layer: on only while the ram is pressing, strained a little higher with pressure. */
export function hydraulicVoice(snapshot: GameSnapshot): { gain: number; rate: number } {
  const pressing = snapshot.phase === 'compressing';
  return { gain: pressing ? 0.55 + snapshot.pressure01 * 0.35 : 0, rate: 0.92 + snapshot.pressure01 * 0.2 };
}

/** Creak layer: follows the core's warning cue while pressing, silent otherwise. */
export function creakVoice(snapshot: GameSnapshot): number {
  return snapshot.phase === 'compressing' ? Math.min(1, snapshot.stress01) * 1.1 : 0;
}

const silent: GameAudio = {
  state: 'off',
  unlock() {}, setVolumes() {}, setSuspended() {}, update() {}, event() {}, cue() {}, dispose() {},
};

export function createAudio(startMusic: number, startEffects: number): GameAudio {
  const AudioContextClass = typeof window === 'undefined' ? undefined : window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass || typeof fetch === 'undefined') return silent;
  // Start the downloads at once; decoding waits for the context the first gesture creates.
  const files = new Map(SOUNDS.map((name) => [name, fetch(`${import.meta.env.BASE_URL}assets/audio/${name}.mp3`).then((response) => response.arrayBuffer()).catch(() => null)]));
  const buffers = new Map<Sound, AudioBuffer>();
  let context: AudioContext | null = null;
  let music: GainNode | null = null;
  let effects: GainNode | null = null;
  let volumes = { music: startMusic, effects: startEffects };
  let suspended = false;
  let press: { source: AudioBufferSourceNode; gain: GainNode } | null = null;
  let creak: { gain: GainNode } | null = null;

  const loop = (name: Sound, level: number, bus: GainNode | null): { source: AudioBufferSourceNode; gain: GainNode } | null => {
    const buffer = buffers.get(name);
    if (!context || !bus || !buffer) return null;
    const source = context.createBufferSource();
    const gain = context.createGain();
    source.buffer = buffer; source.loop = true;
    [source.loopStart, source.loopEnd] = LOOPS[name]!;
    gain.gain.value = level;
    source.connect(gain).connect(bus);
    source.start(0, source.loopStart);
    return { source, gain };
  };

  const play = (name: Sound, level: number, options: { rate?: number; delay?: number; lowpass?: number } = {}): void => {
    const buffer = buffers.get(name);
    if (!context || !effects || !buffer) return;
    const source = context.createBufferSource();
    const gain = context.createGain();
    source.buffer = buffer;
    source.playbackRate.value = options.rate ?? 1;
    gain.gain.value = level;
    let tail: AudioNode = source;
    if (options.lowpass) {
      const filter = context.createBiquadFilter();
      filter.type = 'lowpass'; filter.frequency.value = options.lowpass;
      tail = tail.connect(filter);
    }
    tail.connect(gain).connect(effects);
    source.start(context.currentTime + (options.delay ?? 0));
  };

  function build(): void {
    const ctx = new AudioContextClass!();
    context = ctx;
    const compressor = ctx.createDynamicsCompressor();
    compressor.connect(ctx.destination);
    music = ctx.createGain(); music.gain.value = volumes.music; music.connect(compressor);
    effects = ctx.createGain(); effects.gain.value = volumes.effects; effects.connect(compressor);
    void Promise.all(SOUNDS.map(async (name) => {
      const data = await files.get(name);
      if (!data || context !== ctx) return;
      try { buffers.set(name, await ctx.decodeAudioData(data)); } catch { /* that sound stays silent */ }
    })).then(() => {
      if (context !== ctx) return;
      // The deep-sea bed runs for the whole session; the ram and the creak idle at zero gain.
      loop('bed-sea', 0.6, music); loop('bed-hull', 0.4, music);
      press = loop('press', 0, effects);
      const creakLayer = loop('creak', 0, effects);
      creak = creakLayer && { gain: creakLayer.gain };
    });
  }

  return {
    get state() { return context?.state ?? 'off'; },
    unlock() {
      if (!context) { try { build(); } catch { return; } }
      if (!suspended) void context!.resume().catch(() => {});
    },
    setVolumes(nextMusic, nextEffects) {
      volumes = { music: nextMusic, effects: nextEffects };
      if (!context) return;
      music?.gain.setTargetAtTime(nextMusic, context.currentTime, 0.05);
      effects?.gain.setTargetAtTime(nextEffects, context.currentTime, 0.05);
    },
    setSuspended(next) {
      suspended = next;
      if (!context) return;
      void (next ? context.suspend() : context.resume()).catch(() => {});
    },
    update(snapshot) {
      if (!context) return;
      const at = context.currentTime;
      if (press) {
        const ram = hydraulicVoice(snapshot);
        press.gain.gain.setTargetAtTime(ram.gain, at, 0.05);
        press.source.playbackRate.setTargetAtTime(ram.rate, at, 0.08);
      }
      creak?.gain.gain.setTargetAtTime(creakVoice(snapshot), at, 0.04);
    },
    event(event, snapshot) {
      if (event.type === 'press-released') play('release', 0.45);
      if (event.type === 'specimen-selected') play('store', 0.25, { rate: 0.8 });
      if (event.type === 'stored') play('store', 0.9);
      if (event.type === 'discarded') play('discard', 0.6);
      if (event.type === 'failed' && event.reason === 'specimen-broken') {
        // Glass shatters; the core's housing and the cassette's composite shell crunch.
        if (snapshot.currentSpecimen?.material === 'glass') { play('break-glass', 1); play('break-metal', 0.35, { rate: 1.2 }); }
        else { play('break-metal', 1); play('break-glass', 0.25, { rate: 0.7, delay: 0.08 }); }
      }
      if (event.type === 'failed' && event.reason === 'capacity-exceeded') play('discard', 0.4, { rate: 0.8 });
    },
    cue(cue) {
      if (cue === 'tap') play('click', 0.5);
      if (cue === 'type') play('click', 0.12, { rate: 1.5 });
      if (cue === 'alarm') play('alarm', 0.28, { lowpass: 1400 });
      if (cue === 'hull') { play('hull-groan', 0.85); play('drip', 0.5, { delay: 1.4 }); }
    },
    dispose() { void context?.close().catch(() => {}); context = null; },
  };
}
