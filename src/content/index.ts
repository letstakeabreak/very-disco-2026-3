import type { GameConfig } from '../contracts';
import { assertConfig, deepFreeze } from '../contracts/validate';

/** Authored DEEP PRESS starting lot and workbench placement. */
const AUTHORED_GAME_CONFIG: GameConfig = deepFreeze({
  seed: 260903,
  capacity: 1,
  pressRatePerSecond: 0.25,
  settleDurationMs: 300,
  collectionBonus: 100,
  specimens: [
    { id: 'salvage-core', material: 'metal', initialVolume: 0.9, minimumVolume: 0.27, baseValue: 260, safePressure01: 0.8, tolerance: 'sturdy' },
    { id: 'salvage-lens', material: 'glass', initialVolume: 0.58, minimumVolume: 0.3, baseValue: 450, safePressure01: 0.38, tolerance: 'fragile' },
    { id: 'salvage-cassette', material: 'composite', initialVolume: 0.72, minimumVolume: 0.24, baseValue: 340, safePressure01: 0.62, tolerance: 'normal' },
  ],
  initialEntities: [{
    id: 'press-chamber', assetId: 'press-chamber',
    position: { x: 0, y: 0, z: 0 }, rotationRad: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 },
  }],
});

/** Return an isolated copy so consumers cannot mutate authored content. */
export function getGameConfig(): GameConfig {
  const config = structuredClone(AUTHORED_GAME_CONFIG);
  assertConfig(config);
  return deepFreeze(config);
}
