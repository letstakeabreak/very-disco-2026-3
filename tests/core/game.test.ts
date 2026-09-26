import { describe, expect, it } from 'vitest';
import { authoredGameConfig, createGame } from '../../src/core';
import { DEFAULT_GAME_CONFIG } from '../../src/contracts/fixtures';
import { assertSnapshot } from '../../src/contracts/validate';

describe('deterministic DEEP PRESS core', () => {
  it('is deterministic and isolates snapshots from caller mutation', () => {
    const config = structuredClone(DEFAULT_GAME_CONFIG);
    const a = createGame(config); const b = createGame(config);
    Object.assign(config.initialEntities[0]!.position, { x: 999 });
    for (const game of [a, b]) { game.dispatch({ type: 'select', specimenId: 'salvage-core' }); game.dispatch({ type: 'press-start' }); for (let i = 0; i < 5; i++) game.step(100); }
    expect(a.snapshot()).toEqual(b.snapshot());
    expect(a.snapshot().entities[0]!.position.x).toBe(0);
    expect(a.snapshot().pressure01).toBeCloseTo(0.125);
    expect(Object.isFrozen(a.snapshot().entities[0]!.position)).toBe(true);
    expect(a.snapshot().implementation).toBe('game');
    assertSnapshot(a.snapshot());
  });
  it('cancels uncommitted pressure on pause and never resumes a held press automatically', () => {
    const game = createGame(DEFAULT_GAME_CONFIG);
    game.dispatch({ type: 'select', specimenId: 'salvage-core' }); game.dispatch({ type: 'press-start' }); game.step(100); game.dispatch({ type: 'pause' });
    const paused = game.snapshot(); game.step(100); game.dispatch({ type: 'press-release' });
    expect(paused.pressure01).toBe(paused.currentSpecimen!.compression01);
    expect(game.snapshot()).toEqual(paused);
    game.dispatch({ type: 'resume' }); game.dispatch({ type: 'press-release' }); game.step(100);
    expect(game.snapshot().phase).toBe('inspecting');
    expect(game.snapshot().pressure01).toBe(paused.pressure01);
  });
  it('drains events once, resets deterministically and rejects invalid time/disposed use', () => {
    const game = createGame(DEFAULT_GAME_CONFIG);
    game.dispatch({ type: 'select', specimenId: 'salvage-lens' }); game.dispatch({ type: 'press-start' }); game.step(50); game.dispatch({ type: 'press-release' });
    expect(game.drainEvents().some((event) => event.type === 'press-released')).toBe(true);
    expect(game.drainEvents()).toEqual([]);
    game.dispatch({ type: 'restart' });
    expect(game.snapshot()).toEqual(createGame(DEFAULT_GAME_CONFIG).snapshot());
    for (const dt of [NaN, Infinity, -1, 101]) expect(() => game.step(dt)).toThrow();
    game.dispose(); game.dispose(); expect(() => game.snapshot()).toThrow('disposed');
  });
});

describe('DEEP PRESS authored game rules', () => {
  function selected(id: 'salvage-core' | 'salvage-lens' | 'salvage-cassette' = 'salvage-core') {
    const game = createGame(authoredGameConfig());
    game.dispatch({ type: 'start' });
    game.dispatch({ type: 'select', specimenId: id });
    return game;
  }

  function press(game: ReturnType<typeof createGame>, steps: number, dtMs = 100) {
    game.dispatch({ type: 'press-start' });
    for (let i = 0; i < steps; i++) game.step(dtMs);
    game.dispatch({ type: 'press-release' });
  }

  function settle(game: ReturnType<typeof createGame>, steps = 3) {
    for (let i = 0; i < steps; i++) game.step(100);
  }

  it('commits the documented compression, integrity, value and storage bonus after settling', () => {
    const game = selected();
    press(game, 20); // released at p = 0.5, the ram's lag adds 0.03
    expect(game.snapshot().currentSpecimen?.compression01).toBe(0);
    settle(game);
    const result = game.snapshot().currentSpecimen!;
    expect(game.snapshot().phase).toBe('inspecting');
    expect(result.compression01).toBeCloseTo(0.53);
    expect(result.currentVolume).toBeCloseTo(0.4914);
    expect(result.integrity01).toBe(1);
    expect(result.value).toBe(260);
    game.dispatch({ type: 'store' });
    expect(game.snapshot()).toMatchObject({ phase: 'stored', score: 360, currentSpecimen: null, pressure01: 0 });
    expect(game.snapshot().volumeUsed).toBeCloseTo(0.4914);
    expect(game.snapshot().remainingSpecimenIds).not.toContain('salvage-core');
    expect(game.snapshot().storedSpecimenIds).toEqual(['salvage-core']);
  });

  it('applies the safe-pressure damage curve and fails after an automatic full-pressure stroke', () => {
    const game = selected();
    press(game, 36); // released at 0.9, committed at 0.93: core integrity = 1 - (0.13 / 0.2)^2
    settle(game);
    expect(game.snapshot().currentSpecimen?.compression01).toBeCloseTo(0.93);
    expect(game.snapshot().currentSpecimen?.currentVolume).toBeCloseTo(0.2434);
    expect(game.snapshot().currentSpecimen?.integrity01).toBeCloseTo(0.5775);
    expect(game.snapshot().currentSpecimen).toMatchObject({ value: 150 });
    const broken = selected('salvage-lens');
    broken.dispatch({ type: 'press-start' });
    for (let i = 0; i < 40; i++) broken.step(100);
    expect(broken.snapshot().phase).toBe('settling');
    settle(broken);
    expect(broken.snapshot()).toMatchObject({ phase: 'failed', pressure01: 1, currentSpecimen: { currentVolume: 0.24, integrity01: 0, value: 0, compression01: 1 } });
    expect(broken.drainEvents().some((event) => event.type === 'failed' && event.reason === 'specimen-broken')).toBe(true);
  });

  it('keeps pushing for the ram lag after release and can break the lot inside it', () => {
    const lagged = selected('salvage-lens');
    lagged.dispatch({ type: 'press-start' });
    for (let i = 0; i < 39; i++) lagged.step(100); // p = 0.975
    lagged.dispatch({ type: 'press-release' });
    lagged.step(100); // lag pushes to 1.0 before the settle window ends
    expect(lagged.snapshot()).toMatchObject({ phase: 'settling', pressure01: 1 });
    settle(lagged);
    expect(lagged.snapshot()).toMatchObject({ phase: 'failed', currentSpecimen: { integrity01: 0, compression01: 1 } });
  });

  it('keeps committed compression monotonic, preserves settling across pause, and cancels an active stroke', () => {
    const game = selected();
    press(game, 20); settle(game);
    game.dispatch({ type: 'press-start' }); game.step(100); game.dispatch({ type: 'pause' });
    expect(game.snapshot()).toMatchObject({ phase: 'paused', resumePhase: 'inspecting' });
    expect(game.snapshot().pressure01).toBeCloseTo(0.53);
    expect(game.snapshot().currentSpecimen?.compression01).toBeCloseTo(0.53);
    game.step(100); game.dispatch({ type: 'resume' });
    game.dispatch({ type: 'press-release' });
    expect(game.snapshot().phase).toBe('inspecting');
    press(game, 4); // adds 0.1 and the 0.03 lag, rather than restarting from zero
    settle(game);
    expect(game.snapshot().currentSpecimen?.compression01).toBeCloseTo(0.66);

    game.dispatch({ type: 'press-start' }); game.step(100); game.dispatch({ type: 'press-release' });
    game.step(100); game.dispatch({ type: 'pause' });
    const paused = game.snapshot();
    game.step(100); game.dispatch({ type: 'resume' }); game.step(100); game.step(99);
    expect(game.snapshot().phase).toBe('settling');
    game.step(1);
    expect(game.snapshot().phase).toBe('inspecting');
    expect(paused.resumePhase).toBe('settling');
  });

  it('rejects overcapacity without changing banked items and supports discard, cash-out and deterministic restart', () => {
    const game = selected('salvage-core');
    press(game, 1); settle(game); game.dispatch({ type: 'store' }); // a light touch keeps the core large
    const banked = game.snapshot().volumeUsed;
    game.dispatch({ type: 'select', specimenId: 'salvage-lens' });
    press(game, 1); settle(game); game.dispatch({ type: 'store' });
    expect(game.snapshot()).toMatchObject({ phase: 'failed', score: 360, storedSpecimenIds: ['salvage-core'], remainingSpecimenIds: ['salvage-lens', 'salvage-cassette'], currentSpecimen: { id: 'salvage-lens' } });
    expect(game.snapshot().volumeUsed).toBe(banked);
    game.dispatch({ type: 'discard' });
    expect(game.snapshot().phase).toBe('idle');
    expect(game.drainEvents().some((event) => event.type === 'discarded' && event.specimenId === 'salvage-lens')).toBe(true);
    game.dispatch({ type: 'cash-out' });
    expect(game.snapshot()).toMatchObject({ phase: 'complete', score: 360, currentSpecimen: null });
    const completionEvents = game.drainEvents();
    expect(completionEvents.filter((event) => event.type === 'completed')).toHaveLength(1);
    expect(Object.isFrozen(completionEvents)).toBe(true);
    expect(Object.isFrozen(completionEvents[0])).toBe(true);
    const complete = game.snapshot();
    game.dispatch({ type: 'start' }); game.dispatch({ type: 'select', specimenId: 'salvage-cassette' });
    game.dispatch({ type: 'discard' }); game.dispatch({ type: 'store' }); game.step(100);
    expect(game.snapshot()).toEqual(complete);
    expect(game.snapshot().phase).toBe('complete');
    game.dispatch({ type: 'restart' });
    expect(game.snapshot()).toEqual(createGame(authoredGameConfig()).snapshot());
  });

  it('applies the raw-volume capacity tolerance at its exact boundary', () => {
    const config = authoredGameConfig();
    const probe = createGame(config);
    probe.dispatch({ type: 'select', specimenId: 'salvage-core' });
    press(probe, 20); settle(probe);
    const volume = probe.snapshot().currentSpecimen!.currentVolume;
    const fitsTolerance = createGame({ ...config, capacity: volume - 0.5e-9 });
    fitsTolerance.dispatch({ type: 'select', specimenId: 'salvage-core' });
    press(fitsTolerance, 20); settle(fitsTolerance); fitsTolerance.dispatch({ type: 'store' });
    expect(fitsTolerance.snapshot()).toMatchObject({ phase: 'stored', volumeUsed: volume });

    const exceedsTolerance = createGame({ ...config, capacity: volume - 2e-9 });
    exceedsTolerance.dispatch({ type: 'select', specimenId: 'salvage-core' });
    press(exceedsTolerance, 20); settle(exceedsTolerance); exceedsTolerance.dispatch({ type: 'store' });
    expect(exceedsTolerance.snapshot()).toMatchObject({ phase: 'failed', volumeUsed: 0, score: 0 });
  });

  it('produces equivalent outcomes when the same duration is split into different valid steps', () => {
    const small = selected('salvage-cassette'); const large = selected('salvage-cassette');
    for (const game of [small, large]) game.dispatch({ type: 'press-start' });
    for (let i = 0; i < 10; i++) small.step(10);
    large.step(100);
    small.dispatch({ type: 'press-release' }); large.dispatch({ type: 'press-release' });
    for (let i = 0; i < 30; i++) small.step(10);
    for (let i = 0; i < 3; i++) large.step(100);
    expect(small.snapshot().phase).toBe('inspecting');
    expect(large.snapshot().phase).toBe('inspecting');
    expect(small.snapshot().currentSpecimen).toEqual(large.snapshot().currentSpecimen);
  });

  it('validates invalid command values and protects selection boundaries', () => {
    const game = createGame(authoredGameConfig());
    game.dispatch({ type: 'store' }); game.dispatch({ type: 'discard' }); game.dispatch({ type: 'press-release' });
    expect(game.snapshot()).toMatchObject({ phase: 'idle', score: 0, volumeUsed: 0, currentSpecimen: null });
    game.dispatch({ type: 'select', specimenId: 'salvage-core' });
    game.dispatch({ type: 'inspect', yawRad: 1.25 });
    const inspected = game.snapshot();
    game.dispatch({ type: 'select', specimenId: 'salvage-core' });
    expect(game.snapshot()).toEqual(inspected);
    game.dispatch({ type: 'select', specimenId: 'salvage-lens' });
    expect(game.snapshot().currentSpecimen?.id).toBe('salvage-lens');
    game.dispatch({ type: 'select', specimenId: 'salvage-core' });
    game.dispatch({ type: 'press-start' });
    game.dispatch({ type: 'select', specimenId: 'salvage-lens' }); // cannot replace a pressed specimen
    expect(game.snapshot().currentSpecimen?.id).toBe('salvage-core');
    expect(() => game.dispatch({ type: 'inspect', yawRad: Number.NaN })).toThrow('finite');
    expect(() => game.dispatch({ type: 'select', specimenId: 'unknown' as 'salvage-core' })).toThrow('Unknown specimen');
  });

  it('completes once when the final remaining specimen is processed', () => {
    const game = selected();
    const strokes = [36, 36, 36] as const;
    const ids = ['salvage-core', 'salvage-lens', 'salvage-cassette'] as const;
    for (let index = 0; index < ids.length; index++) {
      const id = ids[index]!;
      if (game.snapshot().currentSpecimen?.id !== id) game.dispatch({ type: 'select', specimenId: id });
      press(game, strokes[index]!);
      settle(game);
      game.dispatch({ type: 'store' });
    }
    expect(game.snapshot().phase).toBe('complete');
    expect(game.snapshot().pressure01).toBe(0);
    expect(game.snapshot().remainingSpecimenIds).toEqual([]);
    expect(game.snapshot().storedSpecimenIds).toEqual(['salvage-core', 'salvage-lens', 'salvage-cassette']);
    expect(game.drainEvents().filter((event) => event.type === 'completed')).toHaveLength(1);
  });

  it('completes after discarding the final remaining specimen without awarding its value', () => {
    const game = selected('salvage-core');
    game.dispatch({ type: 'discard' });
    expect(game.snapshot()).toMatchObject({ phase: 'idle', remainingSpecimenIds: ['salvage-lens', 'salvage-cassette'], score: 0 });
    game.dispatch({ type: 'select', specimenId: 'salvage-lens' }); game.dispatch({ type: 'discard' });
    game.dispatch({ type: 'select', specimenId: 'salvage-cassette' }); game.dispatch({ type: 'discard' });
    expect(game.snapshot()).toMatchObject({ phase: 'complete', remainingSpecimenIds: [], storedSpecimenIds: [], score: 0, volumeUsed: 0 });
    expect(game.drainEvents().filter((event) => event.type === 'completed')).toHaveLength(1);
  });

  it('restarts repeatedly from active phases without leaking prior-round state or events', () => {
    const config = authoredGameConfig();
    const game = createGame(config);
    for (const id of ['salvage-core', 'salvage-lens', 'salvage-cassette'] as const) {
      game.dispatch({ type: 'select', specimenId: id });
      game.dispatch({ type: 'press-start' });
      game.step(100);
      expect(game.snapshot().phase).toBe('compressing');
      game.dispatch({ type: 'restart' });
      expect(game.snapshot()).toEqual(createGame(config).snapshot());
      expect(game.drainEvents()).toEqual([{ type: 'phase-changed', tick: 0, from: 'compressing', to: 'idle' }]);
    }
  });
});

describe('contract 1.2 inspection hints, stress cue, preview and stored states', () => {
  const start = (id: 'salvage-core' | 'salvage-lens' | 'salvage-cassette') => {
    const game = createGame(authoredGameConfig());
    game.dispatch({ type: 'start' }); game.dispatch({ type: 'select', specimenId: id });
    return game;
  };
  const stroke = (game: ReturnType<typeof createGame>, steps: number) => {
    game.dispatch({ type: 'press-start' }); for (let i = 0; i < steps; i++) game.step(100);
  };

  it('reveals the authored tolerance only after rotating 45 degrees, and keeps it per lot until restart', () => {
    const game = start('salvage-lens');
    expect(game.snapshot().currentSpecimen?.tolerance).toBeNull();
    game.dispatch({ type: 'inspect', yawRad: 0.7 });
    expect(game.snapshot().currentSpecimen?.tolerance).toBeNull();
    game.dispatch({ type: 'inspect', yawRad: -Math.PI / 4 });
    expect(game.snapshot().currentSpecimen?.tolerance).toBe('fragile');
    game.dispatch({ type: 'select', specimenId: 'salvage-core' });
    expect(game.snapshot().currentSpecimen?.tolerance).toBeNull();
    game.dispatch({ type: 'select', specimenId: 'salvage-lens' });
    expect(game.snapshot().currentSpecimen?.tolerance).toBe('fragile');
    stroke(game, 4); game.dispatch({ type: 'press-release' }); for (let i = 0; i < 3; i++) game.step(100);
    expect(game.snapshot().currentSpecimen?.tolerance).toBe('fragile');
    game.dispatch({ type: 'restart' }); game.dispatch({ type: 'select', specimenId: 'salvage-lens' });
    expect(game.snapshot().currentSpecimen?.tolerance).toBeNull();
  });

  it('keeps stress at zero until 0.08 before the safe pressure and reaches one at full pressure', () => {
    const game = start('salvage-core'); // safe 0.80, warning from 0.72
    expect(game.snapshot().stress01).toBe(0);
    stroke(game, 28); // p = 0.70
    expect(game.snapshot().pressure01).toBeCloseTo(0.7);
    expect(game.snapshot().stress01).toBe(0);
    game.step(100); game.step(100); // p = 0.75, warning before any damage
    expect(game.snapshot().stress01).toBeCloseTo(0.03 / 0.28);
    game.step(100); game.step(100); // p = 0.80
    expect(game.snapshot().stress01).toBeCloseTo(0.08 / 0.28);
    for (let i = 0; i < 8; i++) game.step(100); // auto-settles at full pressure
    expect(game.snapshot().stress01).toBe(1);
    const idle = createGame(authoredGameConfig()).snapshot();
    expect(idle.stress01).toBe(0); expect(idle.previewVolume).toBeNull();
  });

  it('previews the volume a release would commit, lag included, and settles to it', () => {
    const game = start('salvage-cassette'); // 0.64 → 0.18 L
    expect(game.snapshot().previewVolume).toBeCloseTo(0.64);
    stroke(game, 20); // p = 0.5, a release now commits 0.53
    expect(game.snapshot().previewVolume).toBeCloseTo(0.64 - 0.46 * 0.53);
    expect(game.snapshot().currentSpecimen?.currentVolume).toBeCloseTo(0.64);
    game.dispatch({ type: 'press-release' }); for (let i = 0; i < 3; i++) game.step(100);
    expect(game.snapshot().previewVolume).toBe(game.snapshot().currentSpecimen?.currentVolume);
    game.dispatch({ type: 'store' });
    expect(game.snapshot().previewVolume).toBeNull();
  });

  it('records each stored lot state in order, matching volume used, and clears it on restart', () => {
    const game = start('salvage-core');
    game.dispatch({ type: 'inspect', yawRad: 1 });
    stroke(game, 34); game.dispatch({ type: 'press-release' }); for (let i = 0; i < 3; i++) game.step(100);
    const committedCore = game.snapshot().currentSpecimen!;
    game.dispatch({ type: 'store' });
    game.dispatch({ type: 'select', specimenId: 'salvage-lens' });
    stroke(game, 30); game.dispatch({ type: 'press-release' }); for (let i = 0; i < 3; i++) game.step(100);
    game.dispatch({ type: 'store' });
    const snapshot = game.snapshot();
    expect(snapshot.storedSpecimens.map((item) => item.id)).toEqual(['salvage-core', 'salvage-lens']);
    expect(snapshot.storedSpecimens[0]).toEqual(committedCore);
    expect(snapshot.storedSpecimens[0]!.tolerance).toBe('sturdy');
    expect(snapshot.storedSpecimens[1]!.tolerance).toBeNull();
    expect(snapshot.storedSpecimens.reduce((sum, item) => sum + item.currentVolume, 0)).toBeCloseTo(snapshot.volumeUsed);
    game.dispatch({ type: 'restart' });
    expect(game.snapshot().storedSpecimens).toEqual([]);
  });

  it('produces contract-valid snapshots through a whole shift', () => {
    const game = start('salvage-core');
    const check = () => assertSnapshot(game.snapshot());
    for (const id of ['salvage-core', 'salvage-lens', 'salvage-cassette'] as const) {
      if (game.snapshot().currentSpecimen?.id !== id) game.dispatch({ type: 'select', specimenId: id });
      check(); game.dispatch({ type: 'inspect', yawRad: 0.9 }); check();
      game.dispatch({ type: 'press-start' });
      for (let i = 0; i < 36; i++) { game.step(100); check(); }
      game.dispatch({ type: 'press-release' });
      for (let i = 0; i < 3; i++) { game.step(100); check(); }
      game.dispatch({ type: 'store' }); check();
    }
    expect(game.snapshot().phase).toBe('complete');
  });
});
