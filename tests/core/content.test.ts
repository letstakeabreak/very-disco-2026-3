import { describe, expect, it } from 'vitest';
import { getGameConfig } from '../../src/core';
import { DEFAULT_GAME_CONFIG } from '../../src/contracts/fixtures';
import { assertConfig } from '../../src/contracts/validate';

describe('authored DEEP PRESS content', () => {
  it('matches PRD v1.1 values and uses a press-chamber entity instead of the fixture placeholder', () => {
    const config = getGameConfig();
    expect(config).toMatchObject({
      seed: 260903, capacity: 1, pressRatePerSecond: 0.25, settleDurationMs: 300, collectionBonus: 100,
      specimens: [
        { id: 'salvage-core', material: 'metal', initialVolume: 0.9, minimumVolume: 0.27, baseValue: 260, safePressure01: 0.8, tolerance: 'sturdy' },
        { id: 'salvage-lens', material: 'glass', initialVolume: 0.58, minimumVolume: 0.3, baseValue: 450, safePressure01: 0.38, tolerance: 'fragile' },
        { id: 'salvage-cassette', material: 'composite', initialVolume: 0.72, minimumVolume: 0.24, baseValue: 340, safePressure01: 0.62, tolerance: 'normal' },
      ],
      initialEntities: [{ id: 'press-chamber', assetId: 'press-chamber' }],
    });
    expect(config.initialEntities).not.toEqual(DEFAULT_GAME_CONFIG.initialEntities);
    expect(Object.isFrozen(config.initialEntities[0])).toBe(true);
    assertConfig(config);
  });

  it('returns validated isolated copies', () => {
    const first = getGameConfig();
    const second = getGameConfig();
    expect(first).not.toBe(second);
    expect(first.specimens).not.toBe(second.specimens);
    expect(() => { (first.initialEntities[0]!.position as {x:number}).x = 10; }).toThrow();
    expect(getGameConfig().initialEntities[0]!.position.x).toBe(0);
  });
});
