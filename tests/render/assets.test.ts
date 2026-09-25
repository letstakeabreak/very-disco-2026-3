import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { assertAssetRegistry } from '../../src/contracts/validate';
import type { AssetRegistry } from '../../src/contracts';
import { ASSET_REGISTRY } from '../../src/render/assets';

type PreparedAsset = {
  assetId: string; runtimePath: string; runtimeSha256: string; runtimeBytes: number; triangles: number;
  textures: { dimensions: number[] }[];
};
const prepared = JSON.parse(readFileSync(resolve('assets/source/pipeline/mobile-model-report.json'), 'utf8')) as { assets: PreparedAsset[] };

describe('generated runtime asset evidence (not device approval)', () => {
  it('retains generated-unverified status until actual device review exists', () => {
    assertAssetRegistry(ASSET_REGISTRY);
    expect(Object.keys(ASSET_REGISTRY)).toHaveLength(4);
    for (const asset of Object.values(ASSET_REGISTRY)) {
      expect(asset.status).toBe('generated-unverified');
      expect(asset.verification).toEqual({ reviewer: null, verifiedAt: null, reportPath: null });
    }
    const invalid = structuredClone(ASSET_REGISTRY); Object.assign(invalid['press-chamber'], { status: 'verified' });
    expect(() => assertAssetRegistry(invalid as AssetRegistry)).toThrow();
  });

  it.each(Object.entries(ASSET_REGISTRY))('%s points to preserved lineage and a measured self-contained GLB', (id, asset) => {
    expect(asset.runtimePath).toBeTruthy(); expect(asset.sourcePath).toBeTruthy();
    for (const path of [asset.sourcePath, asset.imagegen.imagePath, asset.imagegen.promptPath]) {
      expect(path).toBeTruthy(); expect(existsSync(resolve(path!))).toBe(true);
    }
    expect(asset.meshy.modelVersion).toBe('meshy-7'); expect(asset.meshy.taskId).toBeTruthy();
    const report = prepared.assets.find((item) => item.assetId === id)!;
    expect(report).toBeDefined(); expect(report.runtimePath).toBe(`public/${asset.runtimePath}`);
    const bytes = readFileSync(resolve(report.runtimePath));
    expect(bytes.toString('ascii', 0, 4)).toBe('glTF');
    expect(bytes.readUInt32LE(4)).toBe(2); expect(bytes.readUInt32LE(8)).toBe(bytes.length);
    expect(bytes.length).toBe(report.runtimeBytes);
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(report.runtimeSha256);
    expect(asset.geometry.triangles).toBe(report.triangles);
    for (const texture of report.textures) expect(Math.max(...texture.dimensions)).toBeLessThanOrEqual(2048);
    const jsonLength = bytes.readUInt32LE(12);
    expect(bytes.readUInt32LE(16)).toBe(0x4e4f534a);
    const gltf = JSON.parse(bytes.toString('utf8', 20, 20 + jsonLength)) as { buffers?: { uri?: string }[]; images?: { uri?: string }[] };
    for (const resource of [...gltf.buffers ?? [], ...gltf.images ?? []]) expect(resource.uri).toBeUndefined();
  });
});
