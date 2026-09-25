import { describe, expect, it } from 'vitest';
import { SNAPSHOT_FIXTURES } from '../../src/contracts/fixtures';
import { assertSnapshot, deepFreeze } from '../../src/contracts/validate';
import type { GameSnapshot } from '../../src/contracts';
import { finiteFrameDelta, specimenVisuals } from '../../src/render/visual-state';

describe('snapshot to cosmetic state (no GPU or game outcome simulation)', () => {
  it.each(Object.entries(SNAPSHOT_FIXTURES))('consumes the frozen %s fixture without mutation', (_phase, fixture) => {
    const before = JSON.stringify(fixture);
    const visuals = specimenVisuals(fixture);
    assertSnapshot(fixture);
    expect(JSON.stringify(fixture)).toBe(before);
    expect(visuals.map(({ id }) => id)).toEqual(['salvage-core', 'salvage-lens', 'salvage-cassette']);
    expect(visuals.filter(({ location }) => location === 'press')).toHaveLength(fixture.currentSpecimen ? 1 : 0);
    for (const visual of visuals) {
      expect(Number.isFinite(visual.compression)).toBe(true);
      expect(Number.isFinite(visual.damage)).toBe(true);
    }
  });

  it('reads pressure while pressing, committed compression while inspecting, and integrity for damage', () => {
    const fixture = SNAPSHOT_FIXTURES.compressing;
    const currentSpecimen = { ...fixture.currentSpecimen!, compression01: 0.2, integrity01: 0.7 };
    const snapshot: GameSnapshot = deepFreeze({ ...fixture, currentSpecimen, pressure01: 0.8, inspectionYawRad: 1.25 });
    expect(specimenVisuals(snapshot)[0]).toMatchObject({ location: 'press', compression: 0.8, yaw: 1.25 });
    expect(specimenVisuals(snapshot)[0]!.damage).toBeCloseTo(0.3);
    expect(specimenVisuals({ ...snapshot, phase: 'inspecting' })[0]!.compression).toBe(0.2);
  });

  it('uses the paused resume phase without inventing pressure or damage', () => {
    const fixture = SNAPSHOT_FIXTURES.settling;
    const paused: GameSnapshot = deepFreeze({ ...fixture, phase: 'paused', resumePhase: 'settling' });
    expect(specimenVisuals(paused)).toEqual(specimenVisuals(fixture));
    const cancelledStroke: GameSnapshot = deepFreeze({ ...paused, resumePhase: 'inspecting', pressure01: 0.2,
      currentSpecimen: { ...paused.currentSpecimen!, compression01: 0.2 } });
    expect(specimenVisuals(cancelledStroke)[0]!.compression).toBe(0.2);
  });

  it('maps bank order to case slots and discarded specimens to hidden', () => {
    const snapshot: GameSnapshot = deepFreeze({ ...SNAPSHOT_FIXTURES.complete,
      storedSpecimenIds: ['salvage-cassette', 'salvage-core'] });
    expect(specimenVisuals(snapshot)).toMatchObject([
      { id: 'salvage-core', location: 'case', index: 1 },
      { id: 'salvage-lens', location: 'hidden' },
      { id: 'salvage-cassette', location: 'case', index: 0 },
    ]);
  });

  it('packs remaining tray specimens into consecutive slots after selecting one', () => {
    const visuals = specimenVisuals(SNAPSHOT_FIXTURES.inspecting);
    expect(visuals.filter(({ location }) => location === 'tray').map(({ id, index }) => ({ id, index }))).toEqual([
      { id: 'salvage-lens', index: 0 }, { id: 'salvage-cassette', index: 1 },
    ]);
  });

  it('bounds presentation time and rejects invalid deltas', () => {
    expect(finiteFrameDelta(0)).toBe(0);
    expect(finiteFrameDelta(16.7)).toBe(16.7);
    expect(finiteFrameDelta(5000)).toBe(100);
    for (const value of [-1, NaN, Infinity, -Infinity]) expect(() => finiteFrameDelta(value)).toThrow(RangeError);
  });
});
