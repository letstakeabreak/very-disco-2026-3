import { describe, expect, it } from 'vitest';
import { authoredGameConfig, bestPlan, getGameConfig } from '../../src/core';
import { qualifiesAsDay } from '../../src/content';
import { DEFAULT_GAME_CONFIG } from '../../src/contracts/fixtures';
import { assertConfig } from '../../src/contracts/validate';


describe('authored DEEP PRESS content', () => {
  it('matches the PRD v1.2 base lot and uses a press-chamber entity instead of the fixture placeholder', () => {
    const config = authoredGameConfig();
    expect(config).toMatchObject({
      seed: 260903, capacity: 1, pressRatePerSecond: 0.25, settleDurationMs: 300, collectionBonus: 100,
      specimens: [
        { id: 'salvage-core', material: 'metal', initialVolume: 0.82, minimumVolume: 0.2, baseValue: 260, safePressure01: 0.8, tolerance: 'sturdy' },
        { id: 'salvage-lens', material: 'glass', initialVolume: 0.52, minimumVolume: 0.24, baseValue: 450, safePressure01: 0.38, tolerance: 'fragile' },
        { id: 'salvage-cassette', material: 'composite', initialVolume: 0.64, minimumVolume: 0.18, baseValue: 340, safePressure01: 0.62, tolerance: 'normal' },
      ],
      initialEntities: [{ id: 'press-chamber', assetId: 'press-chamber' }],
    });
    expect(config.initialEntities).not.toEqual(DEFAULT_GAME_CONFIG.initialEntities);
    expect(Object.isFrozen(config.initialEntities[0])).toBe(true);
    assertConfig(config);
  });

  it('returns validated isolated copies', () => {
    const first = getGameConfig(20260926);
    const second = getGameConfig(20260926);
    expect(first).not.toBe(second);
    expect(first.specimens).not.toBe(second.specimens);
    expect(() => { (first.initialEntities[0]!.position as {x:number}).x = 10; }).toThrow();
    expect(getGameConfig().initialEntities[0]!.position.x).toBe(0);
  });
});

describe('오늘의 회수 (PRD v1.2 daily salvage)', () => {
  it('gives everyone the same lot for the same day seed and a different lot the next day', () => {
    const today = getGameConfig(20260926);
    expect(getGameConfig(20260926)).toEqual(today);
    expect(today.seed).toBe(20260926);
    expect(getGameConfig(20260927).specimens).not.toEqual(today.specimens);
    expect(getGameConfig()).toEqual(authoredGameConfig());
  });

  it('only ships days with no dead end, a reason to keep all three, and pressing on every lot', () => {
    const base = authoredGameConfig().specimens;
    for (let offset = 0; offset < 30; offset++) {
      const config = getGameConfig(20260901 + offset);
      assertConfig(config);
      expect(qualifiesAsDay(config)).toBe(true);
      config.specimens.forEach((item, index) => {
        expect(item.tolerance).toBe(base[index]!.tolerance);
        expect(item.material).toBe(base[index]!.material);
      });
      const plan = bestPlan(config);
      expect(Object.keys(plan.compressions)).toHaveLength(3);
      expect(Math.min(...Object.values(plan.compressions) as number[])).toBeGreaterThanOrEqual(0.35);
    }
  });

  it('solves the best score over lots and compressions within the case', () => {
    const config = authoredGameConfig();
    expect(bestPlan(config, ['salvage-lens'])).toEqual({ score: 550, compressions: { 'salvage-lens': expect.any(Number) } });
    const all = bestPlan(config);
    const pair = bestPlan(config, ['salvage-lens', 'salvage-cassette']);
    expect(all.score).toBeGreaterThan(pair.score);
    expect(bestPlan({ ...config, capacity: 0.01 }).score).toBe(0);
  });
});
