import { describe, expect, it } from 'vitest';
import { createGame, getGameConfig } from '../../src/core';
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
    const game = createGame(getGameConfig());
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
    press(game, 20); // p = 0.5
    expect(game.snapshot().currentSpecimen?.compression01).toBe(0);
    settle(game);
    const result = game.snapshot().currentSpecimen!;
    expect(game.snapshot().phase).toBe('inspecting');
    expect(result.currentVolume).toBeCloseTo(0.585);
    expect(result.integrity01).toBe(1);
    expect(result.value).toBe(260);
    expect(result.compression01).toBeCloseTo(0.5);
    game.dispatch({ type: 'store' });
    expect(game.snapshot()).toMatchObject({ phase: 'stored', score: 360, volumeUsed: 0.585, currentSpecimen: null });
    expect(game.snapshot().remainingSpecimenIds).not.toContain('salvage-core');
    expect(game.snapshot().storedSpecimenIds).toEqual(['salvage-core']);
  });

  it('applies the safe-pressure damage curve and fails after an automatic full-pressure stroke', () => {
    const game = selected();
    press(game, 36); // p = 0.9, core integrity = 0.75
    settle(game);
    expect(game.snapshot().currentSpecimen?.currentVolume).toBeCloseTo(0.333);
    expect(game.snapshot().currentSpecimen?.integrity01).toBeCloseTo(0.75);
    expect(game.snapshot().currentSpecimen).toMatchObject({ value: 195 });
    expect(game.snapshot().currentSpecimen?.compression01).toBeCloseTo(0.9);
    const broken = selected('salvage-lens');
    broken.dispatch({ type: 'press-start' });
    for (let i = 0; i < 40; i++) broken.step(100);
    expect(broken.snapshot().phase).toBe('settling');
    settle(broken);
    expect(broken.snapshot()).toMatchObject({ phase: 'failed', pressure01: 1, currentSpecimen: { currentVolume: 0.3, integrity01: 0, value: 0, compression01: 1 } });
    expect(broken.drainEvents().some((event) => event.type === 'failed' && event.reason === 'specimen-broken')).toBe(true);
  });

  it('keeps committed compression monotonic, preserves settling across pause, and cancels an active stroke', () => {
    const game = selected();
    press(game, 20); settle(game);
    game.dispatch({ type: 'press-start' }); game.step(100); game.dispatch({ type: 'pause' });
    expect(game.snapshot()).toMatchObject({ phase: 'paused', resumePhase: 'inspecting' });
    expect(game.snapshot().pressure01).toBeCloseTo(0.5);
    expect(game.snapshot().currentSpecimen?.compression01).toBeCloseTo(0.5);
    game.step(100); game.dispatch({ type: 'resume' });
    game.dispatch({ type: 'press-release' });
    expect(game.snapshot().phase).toBe('inspecting');
    press(game, 4); // adds 0.1, rather than restarting from zero
    settle(game);
    expect(game.snapshot().currentSpecimen?.compression01).toBeCloseTo(0.6);

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
    press(game, 20); settle(game); game.dispatch({ type: 'store' });
    game.dispatch({ type: 'select', specimenId: 'salvage-lens' });
    press(game, 20); settle(game); game.dispatch({ type: 'store' });
    expect(game.snapshot()).toMatchObject({ phase: 'failed', score: 360, volumeUsed: 0.585, storedSpecimenIds: ['salvage-core'], remainingSpecimenIds: ['salvage-lens', 'salvage-cassette'], currentSpecimen: { id: 'salvage-lens' } });
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
    expect(game.snapshot()).toEqual(createGame(getGameConfig()).snapshot());
  });

  it('applies the raw-volume capacity tolerance at its exact boundary', () => {
    const config = getGameConfig();
    const fitsTolerance = createGame({ ...config, capacity: 0.585 - 0.5e-9 });
    fitsTolerance.dispatch({ type: 'select', specimenId: 'salvage-core' });
    press(fitsTolerance, 20); settle(fitsTolerance); fitsTolerance.dispatch({ type: 'store' });
    expect(fitsTolerance.snapshot()).toMatchObject({ phase: 'stored', volumeUsed: 0.585 });

    const exceedsTolerance = createGame({ ...config, capacity: 0.585 - 2e-9 });
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
    const game = createGame(getGameConfig());
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
    const config = getGameConfig();
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
