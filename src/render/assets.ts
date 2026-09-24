import type { AssetId, AssetRecord, AssetRegistry } from '../contracts';
import { deepFreeze } from '../contracts/validate';

const placeholder = (id: AssetId): AssetRecord => ({
  id, status: 'placeholder', runtimePath: null, sourcePath: null,
  imagegen: { imagePath: null, promptPath: null, generatedAt: null },
  meshy: { modelVersion: null, taskId: null, generatedAt: null },
  licenseNote: 'No game asset generated or verified yet.',
  geometry: { triangles: null, heightM: 1, pivot: 'base-center', upAxis: '+Y', forwardAxis: '+Z' },
  verification: { reviewer: null, verifiedAt: null, reportPath: null },
});
export const ASSET_REGISTRY: AssetRegistry = deepFreeze({
  'press-chamber': placeholder('press-chamber'),
  'salvage-core': placeholder('salvage-core'),
  'salvage-lens': placeholder('salvage-lens'),
  'salvage-cassette': placeholder('salvage-cassette'),
});
