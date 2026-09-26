import type { GameConfig, GamePhase, GameSnapshot, SalvageId, SpecimenDefinition } from '../contracts';

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
  if (specimen === null) return [{ text: '담을 물건을 골라요' }];
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

/** What happened to each lot this round. `pending` lots can still be pressed; `blocked` ones can no longer fit at all. */
export type LotOutcome = 'pending' | 'blocked' | 'stored' | 'damaged' | 'broken' | 'left';

/** True while even the lot's smallest possible size still fits the room left in the case. */
export function canStillFit(snapshot: GameSnapshot, definition: SpecimenDefinition): boolean {
  return definition.minimumVolume <= remainingCapacity(snapshot) + 1e-9;
}

/**
 * Outcomes from the committed state; `broken` holds lots that reached full pressure this round. With
 * `config`, a pending lot whose smallest size no longer fits is `blocked`.
 */
export function lotOutcomes(snapshot: GameSnapshot, broken: ReadonlySet<SalvageId>, config?: GameConfig): Record<SalvageId, LotOutcome> {
  const outcome = (id: SalvageId): LotOutcome => {
    const stored = snapshot.storedSpecimens.find((item) => item.id === id);
    if (stored) return stored.integrity01 < 1 ? 'damaged' : 'stored';
    if (broken.has(id)) return 'broken';
    if (!snapshot.remainingSpecimenIds.includes(id) || snapshot.phase === 'complete') return 'left';
    const definition = config?.specimens.find((item) => item.id === id);
    return definition && snapshot.currentSpecimen?.id !== id && !canStillFit(snapshot, definition) ? 'blocked' : 'pending';
  };
  return { 'salvage-core': outcome('salvage-core'), 'salvage-lens': outcome('salvage-lens'), 'salvage-cassette': outcome('salvage-cassette') };
}

/** Result rows [name, state, points] in manifest order; points add up to the score (value + recovery bonus). */
export function resultRows(snapshot: GameSnapshot, config: GameConfig, outcomes: Record<SalvageId, LotOutcome>): string[][] {
  return config.specimens.map(({ id }) => {
    const stored = snapshot.storedSpecimens.find((item) => item.id === id);
    if (stored) return [SPECIMEN_LABELS[id], `${stored.currentVolume.toFixed(2)}L${outcomes[id] === 'damaged' ? ' 손상' : ''}`, `${stored.value} + ${config.collectionBonus}`];
    return [SPECIMEN_LABELS[id], outcomes[id] === 'broken' ? '부서짐' : '두고 옴', '0'];
  });
}

export type Grade = 'S' | 'A' | 'B' | 'C';

/** Share of the day's best score and its grade (PRD v1.2: S 98%, A 90%, B 75%). */
export function gradeFor(score: number, best: number): { percent: number; grade: Grade } {
  const percent = best > 0 ? Math.min(100, Math.floor(score / best * 100)) : 0;
  const grade: Grade = percent >= 98 ? 'S' : percent >= 90 ? 'A' : percent >= 75 ? 'B' : 'C';
  return { percent, grade };
}

export interface FillSegment { readonly id: SalvageId; readonly share: number; readonly kind: 'stored' | 'damaged' | 'preview' | 'overflow' }

/**
 * The case as a bar (G7): banked lots in order, then the lot in the press at the size a release would
 * commit. The preview turns to overflow when it would not fit, and is clipped to the room left.
 */
export function caseFill(snapshot: GameSnapshot): FillSegment[] {
  const segments: FillSegment[] = snapshot.storedSpecimens.map((item) => ({ id: item.id, share: item.currentVolume / snapshot.capacity, kind: item.integrity01 < 1 ? 'damaged' : 'stored' }));
  const lot = snapshot.currentSpecimen;
  const volume = snapshot.previewVolume ?? lot?.currentVolume;
  if (lot && volume !== undefined) {
    const room = remainingCapacity(snapshot);
    segments.push({ id: lot.id, share: Math.min(volume, room) / snapshot.capacity, kind: volume <= room + 1e-9 ? 'preview' : 'overflow' });
  }
  return segments;
}

/** Today's device best: a new best replaces the old line. */
export function recordText(best: number | null, isNewBest: boolean): string {
  return isNewBest ? '오늘 새 기록이에요' : best !== null ? `오늘 최고 기록 ${best.toLocaleString('ko-KR')}점` : '';
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
