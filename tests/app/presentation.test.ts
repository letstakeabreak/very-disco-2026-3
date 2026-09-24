import { describe, expect, it } from 'vitest';
import type { GameSnapshot } from '../../src/contracts';
import { SNAPSHOT_FIXTURES } from '../../src/contracts/fixtures';
import { canStore, phaseLabel, remainingCapacity, resultSummary, tutorialText } from '../../src/app/presentation';

const snapshot = (patch: Partial<GameSnapshot>): GameSnapshot => ({ ...SNAPSHOT_FIXTURES.inspecting, ...patch });

describe('app presentation rules', () => {
  it('enables storage only for a valid compressed object that fits', () => {
    expect(canStore(snapshot({ currentSpecimen: { ...SNAPSHOT_FIXTURES.inspecting.currentSpecimen!, compression01: 0.5, currentVolume: 0.5 } }))).toBe(true);
    expect(canStore(snapshot({ currentSpecimen: { ...SNAPSHOT_FIXTURES.inspecting.currentSpecimen!, compression01: 0 } }))).toBe(false);
    expect(canStore(snapshot({ currentSpecimen: { ...SNAPSHOT_FIXTURES.inspecting.currentSpecimen!, integrity01: 0 } }))).toBe(false);
    expect(canStore(snapshot({ volumeUsed: 0.51, currentSpecimen: { ...SNAPSHOT_FIXTURES.inspecting.currentSpecimen!, compression01: 0.5, currentVolume: 0.5 } }))).toBe(false);
  });

  it('formats remaining case space and outcome directly from the snapshot', () => {
    const state = snapshot({ volumeUsed: 0.375, score: 460, storedSpecimenIds: ['salvage-core', 'salvage-lens'] });
    expect(remainingCapacity(state)).toBe(0.625);
    expect(resultSummary(state)).toBe('2개 보관 · 0.38L 사용 · 460점 확보');
  });

  it('keeps phase and tutorial language in one display map', () => {
    expect(phaseLabel('settling')).toBe('결과 확인 중');
    expect(tutorialText(0)).toContain('좌우로 끌어');
    expect(tutorialText(2)).toContain('보관하세요');
    expect(tutorialText(99)).toBe(tutorialText(2));
  });
});
