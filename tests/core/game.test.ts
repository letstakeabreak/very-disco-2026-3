import { describe, expect, it } from 'vitest';
import { createGame } from '../../src/core';
import { DEFAULT_GAME_CONFIG } from '../../src/contracts/fixtures';
import { assertSnapshot } from '../../src/contracts/validate';

describe('core integration stub, not finished gameplay', () => {
  it('is deterministic and isolates snapshots from caller mutation', () => {
    const config = structuredClone(DEFAULT_GAME_CONFIG);
    const a = createGame(config); const b = createGame(config);
    Object.assign(config.initialEntities[0]!.position, { x: 999 });
    for (const game of [a, b]) { game.dispatch({ type: 'select', specimenId: 'salvage-core' }); game.dispatch({ type: 'press-start' }); for (let i = 0; i < 5; i++) game.step(100); }
    expect(a.snapshot()).toEqual(b.snapshot());
    expect(a.snapshot().entities[0]!.position.x).toBe(0);
    expect(a.snapshot().pressure01).toBeCloseTo(0.125);
    expect(Object.isFrozen(a.snapshot().entities[0]!.position)).toBe(true);
    expect(a.snapshot().implementation).toBe('scaffold');
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
