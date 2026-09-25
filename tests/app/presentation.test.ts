import { describe, expect, it } from 'vitest';
import type { GameSnapshot } from '../../src/contracts';
import { SNAPSHOT_FIXTURES } from '../../src/contracts/fixtures';
import { canStore, discardLabel, failureText, failureTitle, phaseLabel, recordText, resultItems, remainingCapacity, specimenResult } from '../../src/app/presentation';

const snapshot = (patch: Partial<GameSnapshot>): GameSnapshot => ({ ...SNAPSHOT_FIXTURES.inspecting, ...patch });
const facts = (state: GameSnapshot): string[] => specimenResult(state).map((fact) => fact.warn ? `!${fact.text}` : fact.text);

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
  });

  it('shows the core-committed volume, value and integrity of the lot in the press', () => {
    const specimen = SNAPSHOT_FIXTURES.inspecting.currentSpecimen!;
    expect(facts(snapshot({ currentSpecimen: null }))).toEqual(['다음 물건을 올려요']);
    expect(facts(snapshot({}))).toEqual(['0.90L', '가치 260']);
    expect(facts(snapshot({ currentSpecimen: { ...specimen, compression01: 0.7, currentVolume: 0.384, value: 330, integrity01: 0.7336 } })))
      .toEqual(['0.38L', '가치 330', '내구도 73%']);
  });

  it('offers discard after a failure and says when it ends the shift', () => {
    expect(failureTitle('specimen-broken')).toBe('부서졌어요');
    expect(failureTitle('capacity-exceeded')).toBe('케이스에 안 들어가요');
    expect(failureText('specimen-broken')).toBe('이 물건은 더 쓸 수 없어요.');
    expect(failureText('capacity-exceeded')).toBe('남은 공간보다 커요.');
    expect(discardLabel(SNAPSHOT_FIXTURES.failed)).toBe('버리고 계속하기');
    expect(discardLabel(snapshot({ remainingSpecimenIds: ['salvage-core'] }))).toBe('버리고 마치기');
    expect(phaseLabel('failed')).toBe('실패');
  });

  it('previews size while pressing and flags lots that will not fit', () => {
    const { compressing, inspecting } = SNAPSHOT_FIXTURES;
    expect(facts(compressing)).toEqual(['예상 0.65L', '들어가요']);
    expect(facts({ ...compressing, volumeUsed: 0.6, storedSpecimens: [{ ...SNAPSHOT_FIXTURES.stored.storedSpecimens[0]!, currentVolume: 0.6 }], storedSpecimenIds: ['salvage-lens'] }))
      .toEqual(['예상 0.65L', '!안 들어가요']);
    const settled = { ...inspecting, currentSpecimen: { ...inspecting.currentSpecimen!, compression01: 0.5, currentVolume: 0.585 }, volumeUsed: 0.6 };
    expect(facts(settled)).toEqual(['0.58L', '가치 260', '내구도 100%', '!안 들어가요']);
  });

  it('leaves tolerance and strain to the characters instead of repeating them as facts', () => {
    const { compressing, inspecting } = SNAPSHOT_FIXTURES;
    const revealed = { ...inspecting, currentSpecimen: { ...inspecting.currentSpecimen!, tolerance: 'fragile' as const } };
    expect(facts(revealed)).toEqual(['0.90L', '가치 260']);
    expect(facts({ ...compressing, stress01: 0.2 })).toEqual(['예상 0.65L', '들어가요']);
  });

  it('lists stored lots and reports the device best', () => {
    expect(resultItems(SNAPSHOT_FIXTURES.complete)).toEqual([['에너지 코어', '0.58L', '가치 260']]);
    expect(recordText(null, false)).toBe('');
    expect(recordText(900, false)).toBe('최고 기록 900점');
    expect(recordText(360, true)).toBe('새 기록이에요');
  });

  it('keeps phase language in one display map', () => {
    expect(phaseLabel('settling')).toBe('확인 중');
  });
});
