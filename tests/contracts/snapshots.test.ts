import { describe, expect, it } from 'vitest';
import { SNAPSHOT_FIXTURES, DEFAULT_GAME_CONFIG } from '../../src/contracts/fixtures';
import { assertSnapshot, assertConfig } from '../../src/contracts/validate';
import type { GameSnapshot } from '../../src/contracts';

describe('snapshot consumer contract', () => {
  it('has a valid finite immutable fixture for every DEEP PRESS phase', () => {
    expect(Object.keys(SNAPSHOT_FIXTURES).sort()).toEqual(['complete', 'compressing', 'failed', 'idle', 'inspecting', 'paused', 'settling', 'stored']);
    assertConfig(DEFAULT_GAME_CONFIG);
    for (const snapshot of Object.values(SNAPSHOT_FIXTURES)) {
      assertSnapshot(snapshot);
      expect(JSON.parse(JSON.stringify(snapshot))).toEqual(snapshot);
      expect(Object.isFrozen(snapshot.entities[0]!.position)).toBe(true);
      expect(Object.isFrozen(snapshot.remainingSpecimenIds)).toBe(true);
    }
  });
  it('rejects nonfinite values, overcapacity, unknown assets and broken pause semantics', () => {
    const base = SNAPSHOT_FIXTURES.idle;
    expect(() => assertSnapshot({ ...base, elapsedMs: NaN })).toThrow();
    expect(() => assertSnapshot({ ...base, pressure01: 1.01 })).toThrow();
    expect(() => assertSnapshot({ ...base, volumeUsed: 1.01 })).toThrow();
    expect(() => assertSnapshot({ ...base, phase: 'paused', resumePhase: null })).toThrow();
    expect(() => assertSnapshot({ ...base, phase: 'paused', resumePhase: 'compressing' })).toThrow();
    expect(() => assertSnapshot({ ...base, entities: [{ ...base.entities[0]!, position: { x: Infinity, y: 0, z: 0 } }] })).toThrow();
    expect(() => assertSnapshot({ ...base, score: undefined } as unknown as GameSnapshot)).toThrow();
    expect(() => assertConfig({ ...DEFAULT_GAME_CONFIG, seed: -1 })).toThrow();
  });
});
