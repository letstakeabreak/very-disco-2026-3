import { describe, expect, it } from 'vitest';
import type { GameSnapshot } from '../../src/contracts';
import { SNAPSHOT_FIXTURES } from '../../src/contracts/fixtures';
import { canStore, cueText, discardLabel, failureText, failureTitle, phaseLabel, recordText, resultItems, remainingCapacity, resultSummary, specimenResult, tutorialText } from '../../src/app/presentation';

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
    expect(resultSummary(state)).toBe('2개 담음 · 0.38L 사용 · 460점');
  });

  it('shows the core-committed volume, value and integrity of the lot in the press', () => {
    const specimen = SNAPSHOT_FIXTURES.inspecting.currentSpecimen!;
    expect(specimenResult(snapshot({ currentSpecimen: null }))).toBe('아래에서 물건을 하나 골라 주세요');
    expect(specimenResult(snapshot({}))).toBe('크기 0.90L · 가치 260');
    expect(specimenResult(snapshot({ currentSpecimen: { ...specimen, compression01: 0.7, currentVolume: 0.384, value: 330, integrity01: 0.7336 } })))
      .toBe('크기 0.38L · 가치 330 · 내구도 73%');
  });

  it('offers discard after a failure and says when it ends the shift', () => {
    expect(failureTitle('specimen-broken')).toBe('부서졌어요');
    expect(failureTitle('capacity-exceeded')).toBe('케이스에 안 들어가요');
    expect(failureText('specimen-broken')).toContain('버리고 다른 물건을 이어서');
    expect(failureText('capacity-exceeded')).toContain('남은 공간보다 커요');
    expect(discardLabel(SNAPSHOT_FIXTURES.failed)).toBe('버리고 계속하기');
    expect(discardLabel(snapshot({ remainingSpecimenIds: ['salvage-core'] }))).toBe('버리고 마치기');
    expect(phaseLabel('failed')).toBe('실패');
  });

  it('previews size while pressing and flags lots that will not fit', () => {
    const { compressing, inspecting } = SNAPSHOT_FIXTURES;
    expect(specimenResult(compressing)).toBe('예상 크기 0.65L · 들어가요');
    expect(specimenResult({ ...compressing, volumeUsed: 0.6, storedSpecimens: [{ ...SNAPSHOT_FIXTURES.stored.storedSpecimens[0]!, currentVolume: 0.6 }], storedSpecimenIds: ['salvage-lens'] }))
      .toBe('예상 크기 0.65L · 안 들어가요');
    const settled = { ...inspecting, currentSpecimen: { ...inspecting.currentSpecimen!, compression01: 0.5, currentVolume: 0.585 }, volumeUsed: 0.6 };
    expect(specimenResult(settled)).toBe('크기 0.58L · 가치 260 · 내구도 100% · 안 들어가요');
  });

  it('cues strain while pressing, then the inspected tolerance, then a nudge to inspect', () => {
    const { compressing, inspecting } = SNAPSHOT_FIXTURES;
    expect(cueText(inspecting)).toBe('돌려 보면 얼마나 버틸지 보여요');
    expect(cueText(inspecting, false)).toBeNull();
    const revealed = { ...inspecting, currentSpecimen: { ...inspecting.currentSpecimen!, tolerance: 'fragile' as const } };
    expect(cueText(revealed)).toBe('약해 보여요. 살살 누르세요');
    expect(cueText({ ...compressing, currentSpecimen: revealed.currentSpecimen })).toBe('약해 보여요. 살살 누르세요');
    expect(cueText({ ...compressing, stress01: 0.2 })).toBe('삐걱거려요! 곧 부서질 수 있어요');
    expect(cueText(SNAPSHOT_FIXTURES.idle)).toBeNull();
  });

  it('lists stored lots and reports score per liter and the device best', () => {
    const { complete } = SNAPSHOT_FIXTURES;
    expect(resultItems(complete)).toEqual(['에너지 코어 · 0.58L · 가치 260']);
    expect(recordText(complete, null, false)).toBe('1L당 615점');
    expect(recordText(complete, 900, false)).toBe('1L당 615점 · 최고 기록 900점');
    expect(recordText(complete, 360, true)).toBe('1L당 615점 · 새 기록!');
    expect(recordText({ ...complete, score: 0, volumeUsed: 0, storedSpecimens: [], storedSpecimenIds: [] }, null, false)).toBe('');
  });

  it('keeps phase and tutorial language in one display map', () => {
    expect(phaseLabel('settling')).toBe('확인 중');
    expect(tutorialText(0)).toContain('좌우로 끌어');
    expect(tutorialText(2)).toContain('담아 보세요');
    expect(tutorialText(99)).toBe(tutorialText(2));
  });
});
