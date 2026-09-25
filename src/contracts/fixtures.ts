import { CONTRACT_VERSION, type GameConfig, type GamePhase, type GameSnapshot, type SpecimenState } from './index';
import { deepFreeze } from './validate';

export const DEFAULT_GAME_CONFIG: GameConfig = deepFreeze({
  seed: 260903, capacity: 1, pressRatePerSecond: 0.25, settleDurationMs: 300, collectionBonus: 100,
  specimens: [
    { id: 'salvage-core', material: 'metal', initialVolume: 0.90, minimumVolume: 0.27, baseValue: 260, safePressure01: 0.80, tolerance: 'sturdy' },
    { id: 'salvage-lens', material: 'glass', initialVolume: 0.58, minimumVolume: 0.30, baseValue: 450, safePressure01: 0.38, tolerance: 'fragile' },
    { id: 'salvage-cassette', material: 'composite', initialVolume: 0.72, minimumVolume: 0.24, baseValue: 340, safePressure01: 0.62, tolerance: 'normal' },
  ],
  initialEntities: [{ id: 'dev-placeholder', assetId: null, position: { x: 0, y: 0, z: 0 }, rotationRad: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 } }],
});
const specimen: SpecimenState = { id: 'salvage-core', material: 'metal', currentVolume: 0.90, integrity01: 1, value: 260, compression01: 0, tolerance: null };
const storedCore: SpecimenState = { ...specimen, currentVolume: 0.585, compression01: 0.5, tolerance: 'sturdy' };
const base: GameSnapshot = {
  contractVersion: CONTRACT_VERSION, implementation: 'scaffold', seed: DEFAULT_GAME_CONFIG.seed,
  tick: 0, elapsedMs: 0, phase: 'idle', resumePhase: null, entities: DEFAULT_GAME_CONFIG.initialEntities,
  pressure01: 0, volumeUsed: 0, capacity: 1, score: 0, currentSpecimen: null,
  remainingSpecimenIds: ['salvage-core', 'salvage-lens', 'salvage-cassette'], storedSpecimenIds: [], storedSpecimens: [],
  stress01: 0, previewVolume: null, inspectionYawRad: 0,
};
/** Consumer samples only; fixture outcomes are NOT implemented gameplay. */
export const SNAPSHOT_FIXTURES: Readonly<Record<GamePhase, GameSnapshot>> = deepFreeze({
  idle: base,
  inspecting: { ...base, phase: 'inspecting', currentSpecimen: specimen, previewVolume: 0.90 },
  compressing: { ...base, phase: 'compressing', tick: 60, elapsedMs: 1000, pressure01: 0.4, currentSpecimen: specimen, previewVolume: 0.648 },
  settling: { ...base, phase: 'settling', tick: 120, elapsedMs: 2000, pressure01: 0.5, currentSpecimen: { ...specimen, currentVolume: 0.585, integrity01: 1, value: 260, compression01: 0.5 }, previewVolume: 0.585 },
  stored: { ...base, phase: 'stored', score: 360, volumeUsed: 0.585, remainingSpecimenIds: ['salvage-lens', 'salvage-cassette'], storedSpecimenIds: ['salvage-core'], storedSpecimens: [storedCore] },
  failed: { ...base, phase: 'failed', pressure01: 1, stress01: 1, previewVolume: 0.27, currentSpecimen: { ...specimen, currentVolume: 0.27, integrity01: 0, value: 0, compression01: 1, tolerance: 'sturdy' } },
  complete: { ...base, phase: 'complete', score: 360, volumeUsed: 0.585, remainingSpecimenIds: [], storedSpecimenIds: ['salvage-core'], storedSpecimens: [storedCore] },
  paused: { ...base, phase: 'paused', resumePhase: 'inspecting', currentSpecimen: specimen, previewVolume: 0.90 },
});
