import { describe, expect, it, vi } from 'vitest';
import { SNAPSHOT_FIXTURES } from '../../src/contracts/fixtures';
import { ASSET_REGISTRY } from '../../src/render/assets';
import { assertSnapshot, assertAssetRegistry } from '../../src/contracts/validate';
import type { AssetRegistry } from '../../src/contracts';

const renderCall = vi.fn();
vi.mock('three', async (importOriginal) => {
  const actual = await importOriginal<typeof import('three')>();
  return { ...actual, WebGLRenderer: class { setPixelRatio() {} setSize() {} render = renderCall; dispose() {} } };
});
import { createRenderer } from '../../src/render';

describe('render consumer contract (CPU mock, not GPU validation)', () => {
  it('accepts every immutable fixture without mutating it', () => {
    const onFatal = vi.fn(); const renderer = createRenderer({ canvas: {} as HTMLCanvasElement, onFatal });
    renderer.resize({ width: 390, height: 844, dpr: 3 });
    for (const fixture of Object.values(SNAPSHOT_FIXTURES)) {
      const before = JSON.stringify(fixture); renderer.render(fixture, 16); assertSnapshot(fixture); expect(JSON.stringify(fixture)).toBe(before);
    }
    expect(onFatal).not.toHaveBeenCalled(); expect(renderCall).toHaveBeenCalledTimes(8);
    renderer.dispose(); renderer.dispose();
  });
  it('tracks four placeholders and rejects fabricated verified status', () => {
    assertAssetRegistry(ASSET_REGISTRY);
    expect(Object.keys(ASSET_REGISTRY)).toHaveLength(4);
    for (const asset of Object.values(ASSET_REGISTRY)) { expect(asset.status).toBe('placeholder'); expect(asset.runtimePath).toBeNull(); expect(asset.meshy.taskId).toBeNull(); }
    const invalid = structuredClone(ASSET_REGISTRY); Object.assign(invalid['press-chamber'], { status: 'verified' });
    expect(() => assertAssetRegistry(invalid as AssetRegistry)).toThrow();
  });
});
