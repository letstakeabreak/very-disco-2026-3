import { CONTRACT_VERSION, MAX_STEP_MS, type ActivePhase, type Game, type GameConfig, type GameEvent, type GamePhase, type GameSnapshot, type SpecimenState } from '../contracts';
import { assertConfig, deepFreeze } from '../contracts/validate';
export { getGameConfig } from '../content';

/** DEV STUB: transport, selection and pressure only. Role A implements compression/value/storage outcomes. */
export function createGame(input: GameConfig): Game {
  assertConfig(input);
  const config = deepFreeze(structuredClone(input));
  let phase: GamePhase = 'idle';
  let resumePhase: ActivePhase | null = null;
  let tick = 0;
  let elapsedMs = 0;
  let pressure01 = 0;
  let inspectionYawRad = 0;
  let currentSpecimen: SpecimenState | null = null;
  let disposed = false;
  let events: GameEvent[] = [];
  const alive = (): void => { if (disposed) throw new Error('Game is disposed'); };
  const transition = (to: GamePhase): void => {
    if (phase !== to) events.push({ type: 'phase-changed', tick, from: phase, to });
    phase = to;
  };
  const reset = (): void => { tick = 0; elapsedMs = 0; pressure01 = 0; inspectionYawRad = 0; currentSpecimen = null; resumePhase = null; events = []; transition('idle'); };
  return {
    dispatch(command) {
      alive();
      if (command.type === 'start' || command.type === 'restart') { reset(); return; }
      if (command.type === 'resume') {
        if (phase === 'paused' && resumePhase !== null) { const next = resumePhase; resumePhase = null; transition(next); }
        return;
      }
      if (phase === 'paused') return;
      if (command.type === 'pause') {
        resumePhase = phase === 'compressing' ? 'inspecting' : phase;
        if (phase === 'compressing') pressure01 = currentSpecimen?.compression01 ?? 0;
        transition('paused'); return;
      }
      if (command.type === 'select' && (phase === 'idle' || phase === 'inspecting' || phase === 'stored')) {
        const definition = config.specimens.find((item) => item.id === command.specimenId);
        if (!definition) throw new RangeError('Unknown specimen');
        currentSpecimen = { id: definition.id, material: definition.material, currentVolume: definition.initialVolume, integrity01: 1, value: definition.baseValue, compression01: 0 };
        pressure01 = 0; inspectionYawRad = 0;
        events.push({ type: 'specimen-selected', tick, specimenId: definition.id }); transition('inspecting');
      }
      if (command.type === 'inspect' && phase === 'inspecting') { if (!Number.isFinite(command.yawRad)) throw new RangeError('yawRad must be finite'); inspectionYawRad = command.yawRad; }
      if (command.type === 'press-start' && phase === 'inspecting') transition('compressing');
      if (command.type === 'press-release' && phase === 'compressing') { events.push({ type: 'press-released', tick, pressure01 }); transition('settling'); }
      // store/discard/cash-out and settling resolution intentionally remain unimplemented.
    },
    step(dtMs) {
      alive();
      if (!Number.isFinite(dtMs) || dtMs < 0 || dtMs > MAX_STEP_MS) throw new RangeError('dtMs must be finite within 0..100');
      if (dtMs === 0 || phase === 'paused' || phase === 'failed' || phase === 'complete' || phase === 'idle') return;
      tick += 1; elapsedMs += dtMs;
      if (phase === 'compressing') pressure01 = Math.min(1, pressure01 + dtMs / 1000 * config.pressRatePerSecond);
    },
    snapshot(): GameSnapshot { alive(); return deepFreeze({ contractVersion: CONTRACT_VERSION, implementation: 'scaffold', seed: config.seed, tick, elapsedMs, phase, resumePhase, pressure01, volumeUsed: 0, capacity: config.capacity, score: 0, currentSpecimen: currentSpecimen === null ? null : { ...currentSpecimen }, remainingSpecimenIds: config.specimens.map((item) => item.id), storedSpecimenIds: [], inspectionYawRad, entities: config.initialEntities }); },
    drainEvents() { alive(); const result = deepFreeze(events); events = []; return result; },
    dispose() { disposed = true; events = []; },
  };
}
