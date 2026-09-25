import { CONTRACT_VERSION, MAX_STEP_MS, type ActivePhase, type Game, type GameCommand, type GameConfig, type GameEvent, type GamePhase, type GameSnapshot, type SpecimenState } from '../contracts';
import { assertConfig, deepFreeze } from '../contracts/validate';
export { getGameConfig } from '../content';

/** Deterministic DEEP PRESS rules. Rendering and input remain consumer-owned. */
export function createGame(input: GameConfig): Game {
  assertConfig(input);
  const config = deepFreeze(structuredClone(input));
  const initialIds = config.specimens.map((specimen) => specimen.id);
  let phase: GamePhase = 'idle';
  let resumePhase: ActivePhase | null = null;
  let tick = 0;
  let elapsedMs = 0;
  let pressure01 = 0;
  let strokeStartPressure01 = 0;
  let strokeElapsedMs = 0;
  let inspectionYawRad = 0;
  let volumeUsed = 0;
  let score = 0;
  let remainingSpecimenIds = [...initialIds];
  let storedSpecimenIds: typeof initialIds = [];
  let currentSpecimen: SpecimenState | null = null;
  let settleRemainingMs = 0;
  let brokenOnSettle = false;
  let disposed = false;
  let events: GameEvent[] = [];

  const alive = (): void => { if (disposed) throw new Error('Game is disposed'); };
  const stablePressure = (value: number): number => Math.round(value * 1e12) / 1e12;
  const transition = (to: GamePhase): void => {
    if (phase === to) return;
    events.push({ type: 'phase-changed', tick, from: phase, to });
    phase = to;
  };
  const finish = (): void => {
    transition('complete');
    events.push({ type: 'completed', tick, score });
  };
  const specimenDefinition = (id: SpecimenState['id']) => config.specimens.find((item) => item.id === id)!;
  const reset = (): void => {
    const previousPhase = phase;
    tick = 0; elapsedMs = 0; pressure01 = 0; strokeStartPressure01 = 0; strokeElapsedMs = 0; inspectionYawRad = 0;
    volumeUsed = 0; score = 0; remainingSpecimenIds = [...initialIds]; storedSpecimenIds = [];
    currentSpecimen = null; resumePhase = null; settleRemainingMs = 0; brokenOnSettle = false;
    events = [];
    phase = previousPhase;
    transition('idle');
  };
  const removeRemaining = (id: SpecimenState['id']): void => {
    remainingSpecimenIds = remainingSpecimenIds.filter((remainingId) => remainingId !== id);
  };
  const commitCompression = (): void => {
    if (!currentSpecimen) return;
    const definition = specimenDefinition(currentSpecimen.id);
    const compression01 = pressure01;
    const currentVolume = definition.initialVolume - (definition.initialVolume - definition.minimumVolume) * compression01;
    const damage = compression01 <= definition.safePressure01
      ? 0
      : Math.min(1, ((compression01 - definition.safePressure01) / (1 - definition.safePressure01)) ** 2);
    const integrity01 = 1 - damage;
    const value = Math.round(definition.baseValue * integrity01);
    currentSpecimen = { ...currentSpecimen, currentVolume, integrity01, value, compression01 };
    if (brokenOnSettle) {
      events.push({ type: 'failed', tick, reason: 'specimen-broken' });
      transition('failed');
    } else {
      transition('inspecting');
    }
    settleRemainingMs = 0;
    brokenOnSettle = false;
  };

  return {
    dispatch(command: GameCommand): void {
      alive();
      if (command.type === 'select' && !initialIds.includes(command.specimenId)) throw new RangeError('Unknown specimen ID');
      if (command.type === 'inspect' && !Number.isFinite(command.yawRad)) throw new RangeError('yawRad must be finite');
      if (command.type === 'restart') { reset(); return; }
      if (phase === 'complete') return;
      if (command.type === 'start') { reset(); return; }
      if (command.type === 'resume') {
        if (phase === 'paused' && resumePhase !== null) {
          const next = resumePhase;
          resumePhase = null;
          transition(next);
        }
        return;
      }
      if (phase === 'paused') return;
      if (command.type === 'pause') {
        if (phase === 'compressing') {
          pressure01 = currentSpecimen?.compression01 ?? 0;
          strokeStartPressure01 = pressure01;
          strokeElapsedMs = 0;
          resumePhase = 'inspecting';
        } else {
          resumePhase = phase;
        }
        transition('paused');
        return;
      }
      if (command.type === 'select') {
        const maySelect = phase === 'idle' || phase === 'stored'
          || (phase === 'inspecting' && currentSpecimen?.compression01 === 0);
        if (!maySelect) return;
        if (!remainingSpecimenIds.includes(command.specimenId)) return;
        if (currentSpecimen?.id === command.specimenId) return;
        const definition = specimenDefinition(command.specimenId);
        currentSpecimen = { id: definition.id, material: definition.material, currentVolume: definition.initialVolume, integrity01: 1, value: definition.baseValue, compression01: 0 };
        pressure01 = 0;
        inspectionYawRad = 0;
        events.push({ type: 'specimen-selected', tick, specimenId: definition.id });
        transition('inspecting');
        return;
      }
      if (command.type === 'inspect') {
        if (phase !== 'inspecting') return;
        inspectionYawRad = command.yawRad;
        return;
      }
      if (command.type === 'press-start') {
        if (phase === 'inspecting' && currentSpecimen) {
          strokeStartPressure01 = pressure01;
          strokeElapsedMs = 0;
          transition('compressing');
        }
        return;
      }
      if (command.type === 'press-release') {
        if (phase !== 'compressing') return;
        brokenOnSettle = false;
        settleRemainingMs = config.settleDurationMs;
        events.push({ type: 'press-released', tick, pressure01 });
        transition('settling');
        if (settleRemainingMs === 0) commitCompression();
        return;
      }
      if (command.type === 'store') {
        if (phase !== 'inspecting' || !currentSpecimen || currentSpecimen.compression01 <= 0 || currentSpecimen.integrity01 <= 0) return;
        if (volumeUsed + currentSpecimen.currentVolume > config.capacity + 1e-9) {
          events.push({ type: 'failed', tick, reason: 'capacity-exceeded' });
          transition('failed');
          return;
        }
        const stored = currentSpecimen;
        const scoreDelta = stored.value + config.collectionBonus;
        score += scoreDelta;
        volumeUsed += stored.currentVolume;
        removeRemaining(stored.id);
        storedSpecimenIds = [...storedSpecimenIds, stored.id];
        currentSpecimen = null;
        events.push({ type: 'stored', tick, specimenId: stored.id, scoreDelta });
        if (remainingSpecimenIds.length === 0) finish();
        else transition('stored');
        return;
      }
      if (command.type === 'discard') {
        if ((phase !== 'inspecting' && phase !== 'failed') || !currentSpecimen) return;
        const discardedId = currentSpecimen.id;
        removeRemaining(discardedId);
        currentSpecimen = null;
        pressure01 = 0;
        events.push({ type: 'discarded', tick, specimenId: discardedId });
        if (remainingSpecimenIds.length === 0) finish();
        else transition('idle');
        return;
      }
      if (command.type === 'cash-out') {
        if (phase === 'idle' || phase === 'inspecting' || phase === 'stored' || phase === 'failed') finish();
      }
    },
    step(dtMs: number): void {
      alive();
      if (!Number.isFinite(dtMs) || dtMs < 0 || dtMs > MAX_STEP_MS) throw new RangeError('dtMs must be finite within 0..100');
      if (dtMs === 0 || phase === 'paused' || phase === 'failed' || phase === 'complete' || phase === 'idle') return;
      tick += 1;
      elapsedMs += dtMs;
      let remainingMs = dtMs;
      while (remainingMs > 1e-9) {
        if (phase === 'compressing') {
          const untilBrokenMs = Math.max(0, (1 - pressure01) / config.pressRatePerSecond * 1000);
          if (untilBrokenMs > remainingMs + 1e-9) {
            strokeElapsedMs += remainingMs;
            pressure01 = Math.min(1, stablePressure(strokeStartPressure01 + config.pressRatePerSecond * strokeElapsedMs / 1000));
            remainingMs = 0;
          } else {
            pressure01 = 1;
            strokeElapsedMs += untilBrokenMs;
            remainingMs -= untilBrokenMs;
            brokenOnSettle = true;
            settleRemainingMs = config.settleDurationMs;
            transition('settling');
            if (settleRemainingMs === 0) commitCompression();
          }
        } else if (phase === 'settling') {
          const usedMs = Math.min(remainingMs, settleRemainingMs);
          settleRemainingMs -= usedMs;
          remainingMs -= usedMs;
          if (settleRemainingMs <= 1e-9) {
            settleRemainingMs = 0;
            commitCompression();
          } else {
            remainingMs = 0;
          }
        } else {
          remainingMs = 0;
        }
      }
    },
    snapshot(): GameSnapshot {
      alive();
      return deepFreeze({
        contractVersion: CONTRACT_VERSION, implementation: 'game', seed: config.seed,
        tick, elapsedMs, phase, resumePhase, pressure01, volumeUsed, capacity: config.capacity,
        score, currentSpecimen: currentSpecimen === null ? null : { ...currentSpecimen },
        remainingSpecimenIds: [...remainingSpecimenIds], storedSpecimenIds: [...storedSpecimenIds],
        inspectionYawRad, entities: config.initialEntities,
      });
    },
    drainEvents(): readonly GameEvent[] {
      alive();
      const drained = deepFreeze(events);
      events = [];
      return drained;
    },
    dispose(): void { if (disposed) return; disposed = true; events = []; },
  };
}
