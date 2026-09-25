import type { GameSnapshot, SalvageId } from '../contracts';

export const SPECIMEN_IDS: readonly SalvageId[] = ['salvage-core', 'salvage-lens', 'salvage-cassette'];
export type SpecimenVisual = Readonly<{ id: SalvageId; location: 'press' | 'tray' | 'case' | 'hidden'; index: number; compression: number; damage: number; yaw: number }>;

/** Cosmetic interpretation only: no capacity, score, integrity or outcome computation. */
export function specimenVisuals(snapshot: GameSnapshot): readonly SpecimenVisual[] {
  const trayIds = snapshot.remainingSpecimenIds.filter((id) => id !== snapshot.currentSpecimen?.id);
  return SPECIMEN_IDS.map((id) => {
    const current = snapshot.currentSpecimen;
    if (current?.id === id) {
      const phase = snapshot.phase === 'paused' ? snapshot.resumePhase : snapshot.phase;
      const pressing = phase === 'compressing' || phase === 'settling';
      return { id, location: 'press', index: 0, compression: pressing ? snapshot.pressure01 : current.compression01, damage: 1 - current.integrity01, yaw: snapshot.inspectionYawRad };
    }
    const storedIndex = snapshot.storedSpecimenIds.indexOf(id);
    if (storedIndex >= 0) {
      // Contract 1.1 carries each stored lot's committed state, so any renderer can restore it.
      const stored = snapshot.storedSpecimens.find((item) => item.id === id);
      return { id, location: 'case', index: storedIndex, compression: stored?.compression01 ?? 0, damage: stored ? 1 - stored.integrity01 : 0, yaw: 0 };
    }
    return { id, location: trayIds.includes(id) ? 'tray' : 'hidden', index: Math.max(0, trayIds.indexOf(id)), compression: 0, damage: 0, yaw: 0 };
  });
}

export function finiteFrameDelta(dtMs: number): number {
  if (!Number.isFinite(dtMs) || dtMs < 0) throw new RangeError('Render delta must be finite and nonnegative');
  return Math.min(dtMs, 100);
}
