import type { GamePhase, GameSnapshot, SalvageId } from '../contracts';

export const SPECIMEN_LABELS: Readonly<Record<SalvageId, string>> = {
  'salvage-core': '에너지 코어',
  'salvage-lens': '광학 렌즈',
  'salvage-cassette': '데이터 카세트',
};

const PHASE_LABELS: Readonly<Record<GamePhase, string>> = {
  idle: '대기',
  inspecting: '살펴보기',
  compressing: '압축 중',
  settling: '확인 중',
  stored: '담았어요',
  failed: '실패',
  complete: '끝',
  paused: '일시정지',
};

export function phaseLabel(phase: GamePhase): string {
  return PHASE_LABELS[phase];
}

/** Mirrors only the documented action prerequisites; score and outcome remain core-owned. */
export function canStore(snapshot: GameSnapshot): boolean {
  const specimen = snapshot.currentSpecimen;
  return snapshot.phase === 'inspecting'
    && specimen !== null
    && specimen.compression01 > 0
    && specimen.integrity01 > 0
    && snapshot.volumeUsed + specimen.currentVolume <= snapshot.capacity + 1e-9;
}

export function remainingCapacity(snapshot: GameSnapshot): number {
  return Math.max(0, snapshot.capacity - snapshot.volumeUsed);
}

export interface Fact { readonly text: string; readonly warn?: boolean }

/** Short facts for the lot in the press, shown as separate chips. While pressing: the core's size preview and fit. */
export function specimenResult(snapshot: GameSnapshot): readonly Fact[] {
  const specimen = snapshot.currentSpecimen;
  if (specimen === null) return [{ text: '다음 물건을 올려요' }];
  const room = remainingCapacity(snapshot) + 1e-9;
  if (snapshot.phase === 'compressing' && snapshot.previewVolume !== null) {
    const fits = snapshot.previewVolume <= room;
    return [{ text: `예상 ${snapshot.previewVolume.toFixed(2)}L` }, fits ? { text: '들어가요' } : { text: '안 들어가요', warn: true }];
  }
  const facts: Fact[] = [{ text: `${specimen.currentVolume.toFixed(2)}L` }, { text: `가치 ${specimen.value}` }];
  if (specimen.compression01 > 0) facts.push({ text: `내구도 ${Math.round(specimen.integrity01 * 100)}%` });
  if (specimen.compression01 > 0 && specimen.currentVolume > room) facts.push({ text: '안 들어가요', warn: true });
  return facts;
}

/** Stored lots as [name, volume, value] rows. */
export function resultItems(snapshot: GameSnapshot): string[][] {
  return snapshot.storedSpecimens.map((item) => [SPECIMEN_LABELS[item.id], `${item.currentVolume.toFixed(2)}L`, `가치 ${item.value}`]);
}

/** The device best: a new best replaces the old line. */
export function recordText(best: number | null, isNewBest: boolean): string {
  return isNewBest ? '새 기록이에요' : best !== null ? `최고 기록 ${best}점` : '';
}

export function failureTitle(reason: 'specimen-broken' | 'capacity-exceeded' | null): string {
  return reason === 'capacity-exceeded' ? '케이스에 안 들어가요' : '부서졌어요';
}

export function failureText(reason: 'specimen-broken' | 'capacity-exceeded' | null): string {
  return reason === 'capacity-exceeded' ? '남은 공간보다 커요.' : '이 물건은 더 쓸 수 없어요.';
}

/** Discarding the last unprocessed lot completes the shift. */
export function discardLabel(snapshot: GameSnapshot): string {
  return snapshot.remainingSpecimenIds.length > 1 ? '버리고 계속하기' : '버리고 마치기';
}

/**
 * Sentences with their offsets in the original line. A period only ends a
 * sentence before a space or the end, so "0.24리터" stays whole.
 */
export function splitSentences(text: string): { readonly text: string; readonly start: number }[] {
  const parts: { text: string; start: number }[] = [];
  for (const match of text.matchAll(/.+?(?:[.?!](?=\s|$)|$)\s*/gu)) {
    if (match[0].trim()) parts.push({ text: match[0].trimEnd(), start: match.index });
  }
  return parts;
}

const DEPENDENT_NOUNS = new Set(['것', '게', '거', '수', '건', '줄', '데', '때', '뿐', '채', '듯', '척']);

/**
 * Korean line-break hints on top of word wrapping. A one-syllable dependent
 * noun (게, 수, 건…) stays with the word before it, any other one-syllable
 * word (세, 셋, 이, 꼭, 안…) stays with the word after it, and a sentence
 * never ends on a lone word. Spaces become no-break spaces, so lengths are
 * unchanged.
 */
export function bindWords(sentence: string): string {
  const words = sentence.split(' ');
  const single = (word: string) => [...word.replace(/[.?!]+$/u, '')].length === 1;
  return words.reduce((out, word, index) => {
    if (index === 0) return word;
    const previous = words[index - 1]!;
    const glue = index === words.length - 1
      || (single(word) && DEPENDENT_NOUNS.has(word.replace(/[.?!]+$/u, '')))
      || (single(previous) && !DEPENDENT_NOUNS.has(previous.replace(/[.?!]+$/u, '')));
    return out + (glue ? '\u00A0' : ' ') + word;
  }, '');
}

/** Today's salvage seed: the KST calendar date as YYYYMMDD, so every player on the same Korean day shares a lot. */
export function kstDaySeed(now: Date): number {
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return kst.getUTCFullYear() * 10000 + (kst.getUTCMonth() + 1) * 100 + kst.getUTCDate();
}
