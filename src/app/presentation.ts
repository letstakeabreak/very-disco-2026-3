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

/** Core-committed volume, value and integrity of the lot in the press; never predicted. */
export function specimenResult(snapshot: GameSnapshot): string {
  const specimen = snapshot.currentSpecimen;
  if (specimen === null) return '아래에서 물건을 하나 골라 주세요';
  const outcome = `크기 ${specimen.currentVolume.toFixed(2)}L · 가치 ${specimen.value}`;
  if (specimen.compression01 === 0) return outcome;
  return `${outcome} · 내구도 ${Math.round(specimen.integrity01 * 100)}%`;
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
