import type { GamePhase, GameSnapshot, SalvageId } from '../contracts';

export const SPECIMEN_LABELS: Readonly<Record<SalvageId, string>> = {
  'salvage-core': '금속 보호 하우징',
  'salvage-lens': '광학 렌즈',
  'salvage-cassette': '데이터 카세트',
};

const PHASE_LABELS: Readonly<Record<GamePhase, string>> = {
  idle: '대기 중',
  inspecting: '회수물 검사',
  compressing: '압착 중',
  settling: '결과 확인 중',
  stored: '보관 완료',
  failed: '회수 실패',
  complete: '정산 완료',
  paused: '일시 정지',
};

const TUTORIAL_STEPS = [
  '회수물을 좌우로 끌어 살펴보세요.',
  '압착 버튼을 누르고 있다가 원하는 순간 떼세요.',
  '결과와 남은 공간을 확인하고 보관하세요.',
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
  if (specimen === null) return '물건을 검사해 압착을 시작하세요.';
  const outcome = `${specimen.currentVolume.toFixed(2)}L · 가치 ${specimen.value}`;
  if (specimen.compression01 === 0) return `${outcome} · 압착 전`;
  return `압축 ${Math.round(specimen.compression01 * 100)}% · ${outcome} · 무결성 ${Math.round(specimen.integrity01 * 100)}%`;
}

export function failureText(reason: 'specimen-broken' | 'capacity-exceeded' | null): string {
  return reason === 'capacity-exceeded'
    ? '케이스 용량을 초과했습니다. 이미 보관한 회수품은 유지됩니다. 이 회수물을 폐기하고 계속하거나, 확보한 점수로 정산하세요.'
    : '회수물이 한계 압력에 도달해 가치를 잃었습니다. 폐기하고 남은 회수물로 계속하거나, 확보한 점수로 정산하세요.';
}

/** Discarding the last unprocessed lot completes the shift. */
export function discardLabel(snapshot: GameSnapshot): string {
  return snapshot.remainingSpecimenIds.length > 1 ? '폐기하고 계속' : '폐기하고 마치기';
}

export function resultSummary(snapshot: GameSnapshot): string {
  return `${snapshot.storedSpecimenIds.length}개 보관 · ${snapshot.volumeUsed.toFixed(2)}L 사용 · ${snapshot.score}점 확보`;
}
