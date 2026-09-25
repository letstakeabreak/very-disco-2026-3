import type { GamePhase, GameSnapshot, SalvageId, Tolerance } from '../contracts';

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

const TUTORIAL_STEPS = [
  '좌우로 끌어서 물건을 돌려 보세요',
  '버튼을 꾹 누르다가, 원하는 만큼 줄면 떼세요',
  '크기와 가치를 보고 담아 보세요',
] as const;

export function phaseLabel(phase: GamePhase): string {
  return PHASE_LABELS[phase];
}

export function tutorialText(step: number): string {
  return TUTORIAL_STEPS[Math.min(TUTORIAL_STEPS.length - 1, Math.max(0, step))] ?? '';
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

/** While pressing: the core's size preview and whether it fits. Otherwise the committed result. */
export function specimenResult(snapshot: GameSnapshot): string {
  const specimen = snapshot.currentSpecimen;
  if (specimen === null) return '아래에서 물건을 하나 골라 주세요';
  const room = remainingCapacity(snapshot) + 1e-9;
  if (snapshot.phase === 'compressing' && snapshot.previewVolume !== null) {
    return `예상 크기 ${snapshot.previewVolume.toFixed(2)}L · ${snapshot.previewVolume <= room ? '들어가요' : '안 들어가요'}`;
  }
  const outcome = `크기 ${specimen.currentVolume.toFixed(2)}L · 가치 ${specimen.value}`;
  if (specimen.compression01 === 0) return outcome;
  const fit = specimen.currentVolume <= room ? '' : ' · 안 들어가요';
  return `${outcome} · 내구도 ${Math.round(specimen.integrity01 * 100)}%${fit}`;
}

const TOLERANCE_HINTS: Readonly<Record<Tolerance, string>> = {
  fragile: '약해 보여요. 살살 누르세요',
  normal: '적당히 버틸 것 같아요',
  sturdy: '튼튼해 보여요. 세게 눌러도 돼요',
};

/** One cue line: live strain while pressing, else the inspected tolerance, else (optionally) a nudge to inspect. */
export function cueText(snapshot: GameSnapshot, nudge = true): string | null {
  const specimen = snapshot.currentSpecimen;
  if (specimen === null || snapshot.phase === 'complete') return null;
  if (snapshot.phase === 'compressing' && snapshot.stress01 > 0) return '삐걱거려요! 곧 부서질 수 있어요';
  if (specimen.tolerance !== null) return TOLERANCE_HINTS[specimen.tolerance];
  return nudge && snapshot.phase === 'inspecting' ? '돌려 보면 얼마나 버틸지 보여요' : null;
}

export function resultItems(snapshot: GameSnapshot): string[] {
  return snapshot.storedSpecimens.map((item) => `${SPECIMEN_LABELS[item.id]} · ${item.currentVolume.toFixed(2)}L · 가치 ${item.value}`);
}

/** Score per liter used, then the device best: a new best replaces the old line. */
export function recordText(snapshot: GameSnapshot, best: number | null, isNewBest: boolean): string {
  const perLiter = snapshot.volumeUsed > 0 ? `1L당 ${Math.round(snapshot.score / snapshot.volumeUsed)}점` : null;
  const record = isNewBest ? '새 기록!' : best !== null ? `최고 기록 ${best}점` : null;
  return [perLiter, record].filter((part) => part !== null).join(' · ');
}

export function failureTitle(reason: 'specimen-broken' | 'capacity-exceeded' | null): string {
  return reason === 'capacity-exceeded' ? '케이스에 안 들어가요' : '부서졌어요';
}

export function failureText(reason: 'specimen-broken' | 'capacity-exceeded' | null): string {
  return reason === 'capacity-exceeded'
    ? '남은 공간보다 커요. 담아 둔 물건은 그대로예요. 이건 버리고 계속하거나, 지금 점수로 마칠 수 있어요.'
    : '이 물건은 이제 가치가 없어요. 버리고 다른 물건을 이어서 하거나, 지금 점수로 마칠 수 있어요.';
}

/** Discarding the last unprocessed lot completes the shift. */
export function discardLabel(snapshot: GameSnapshot): string {
  return snapshot.remainingSpecimenIds.length > 1 ? '버리고 계속하기' : '버리고 마치기';
}

export function resultSummary(snapshot: GameSnapshot): string {
  return `${snapshot.storedSpecimenIds.length}개 담음 · ${snapshot.volumeUsed.toFixed(2)}L 사용 · ${snapshot.score}점`;
}
