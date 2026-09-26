import { describe, expect, it } from 'vitest';
import type { GameSnapshot } from '../../src/contracts';
import { SNAPSHOT_FIXTURES } from '../../src/contracts/fixtures';
import { canStore, discardLabel, failureText, failureTitle, phaseLabel, recordText, resultItems, remainingCapacity, specimenResult, splitSentences, bindWords } from '../../src/app/presentation';

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

  it('splits typed lines into sentences without breaking decimals', () => {
    expect(splitSentences('담았어요. 이제 0.24리터 남았어요.')).toEqual([{ text: '담았어요.', start: 0 }, { text: '이제 0.24리터 남았어요.', start: 6 }]);
    expect(splitSentences('삐걱거려요! 손 떼요!').map((part) => part.text)).toEqual(['삐걱거려요!', '손 떼요!']);
    expect(splitSentences('그럼 작업대로 가요')).toEqual([{ text: '그럼 작업대로 가요', start: 0 }]);
  });

  it('keeps one-syllable words and sentence endings from standing alone on a line', () => {
    const nb = '\u00A0';
    expect(bindWords('남은 건 작업실 하나와 부품 세 개뿐이다.')).toBe(`남은${nb}건 작업실 하나와 부품 세${nb}개뿐이다.`);
    expect(bindWords('이 프레스로 눌러서 부피를 줄여야 해요.')).toBe(`이${nb}프레스로 눌러서 부피를 줄여야${nb}해요.`);
    expect(bindWords('캡슐에 실을 수 있는 게 1리터짜리 하나뿐이거든요.')).toBe(`캡슐에 실을${nb}수 있는${nb}게 1리터짜리${nb}하나뿐이거든요.`);
    expect(bindWords('그럼')).toBe('그럼');
    expect(bindWords('손 떼요!').length).toBe('손 떼요!'.length);
  });
});
