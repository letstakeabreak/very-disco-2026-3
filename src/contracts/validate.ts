import { CONTRACT_VERSION, type AssetRegistry, type GameConfig, type GameSnapshot, type SalvageId } from './index';

export function assertFiniteJson(value: unknown): void {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
  if (typeof value === 'number' && Number.isFinite(value)) return;
  if (Array.isArray(value)) { value.forEach(assertFiniteJson); return; }
  if (typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    Object.values(value as Record<string, unknown>).forEach(assertFiniteJson); return;
  }
  throw new TypeError('Contract values must be finite plain JSON data.');
}
export function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(deepFreeze); Object.freeze(value);
  }
  return value;
}
const salvageIds: readonly SalvageId[] = ['salvage-core', 'salvage-lens', 'salvage-cassette'];
const assetIds = ['press-chamber', ...salvageIds];
const materials = ['metal', 'glass', 'composite'];
function assertSeed(seed: number): void {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw new RangeError('seed must be uint32');
}
function assertEntities(entities: GameSnapshot['entities']): void {
  const ids = new Set(entities.map((entity) => entity.id));
  if (ids.size !== entities.length || ids.has('')) throw new RangeError('Entity IDs must be unique and nonempty');
  if (entities.some((entity) => entity.scale.x <= 0 || entity.scale.y <= 0 || entity.scale.z <= 0 || (entity.assetId !== null && !assetIds.includes(entity.assetId)))) throw new RangeError('Invalid entity transform or asset ID');
}
export function assertConfig(config: GameConfig): void {
  assertFiniteJson(config); assertSeed(config.seed); assertEntities(config.initialEntities);
  if (config.capacity <= 0 || config.pressRatePerSecond <= 0 || config.settleDurationMs < 0 || !Number.isInteger(config.collectionBonus) || config.collectionBonus < 0) throw new RangeError('Capacity and press rate must be positive');
  const ids = config.specimens.map((specimen) => specimen.id);
  if (ids.length !== 3 || new Set(ids).size !== 3 || ids.some((id) => !salvageIds.includes(id))) throw new RangeError('Exactly three unique salvage definitions are required');
  for (const specimen of config.specimens) {
    if (!materials.includes(specimen.material) || specimen.initialVolume <= 0 || !Number.isInteger(specimen.baseValue) || specimen.baseValue < 0 || specimen.safePressure01 <= 0 || specimen.safePressure01 >= 1 || specimen.minimumVolume <= 0 || specimen.minimumVolume > specimen.initialVolume) throw new RangeError('Invalid specimen definition');
  }
}
export function assertSnapshot(snapshot: GameSnapshot): void {
  assertFiniteJson(snapshot); assertSeed(snapshot.seed); assertEntities(snapshot.entities);
  if (snapshot.contractVersion !== CONTRACT_VERSION) throw new TypeError('Unsupported contract version');
  const activePhases = ['idle', 'inspecting', 'compressing', 'settling', 'stored', 'failed', 'complete'];
  if (![...activePhases, 'paused'].includes(snapshot.phase)) throw new TypeError('Unknown phase');
  if (!['scaffold', 'game'].includes(snapshot.implementation)) throw new TypeError('Unknown implementation state');
  if (!Number.isInteger(snapshot.tick) || snapshot.tick < 0 || snapshot.elapsedMs < 0) throw new RangeError('Invalid simulation time');
  if (!Number.isInteger(snapshot.score) || snapshot.score < 0 || snapshot.capacity <= 0 || snapshot.volumeUsed < 0 || snapshot.volumeUsed > snapshot.capacity + 1e-9 || snapshot.pressure01 < 0 || snapshot.pressure01 > 1) throw new RangeError('Invalid score, capacity or pressure');
  if ((snapshot.phase === 'paused') !== (snapshot.resumePhase !== null) || (snapshot.resumePhase !== null && (!activePhases.includes(snapshot.resumePhase) || snapshot.resumePhase === 'compressing'))) throw new RangeError('Invalid pause state');
  const allIds = [...snapshot.remainingSpecimenIds, ...snapshot.storedSpecimenIds];
  if (new Set(allIds).size !== allIds.length || allIds.some((id) => !salvageIds.includes(id))) throw new RangeError('Invalid specimen lists');
  const specimen = snapshot.currentSpecimen;
  if (specimen && (!salvageIds.includes(specimen.id) || !materials.includes(specimen.material) || specimen.currentVolume <= 0 || specimen.integrity01 < 0 || specimen.integrity01 > 1 || specimen.compression01 < 0 || specimen.compression01 > 1 || !Number.isInteger(specimen.value) || specimen.value < 0)) throw new RangeError('Invalid current specimen');
  if (['inspecting', 'compressing', 'settling', 'failed'].includes(snapshot.phase) && specimen === null) throw new RangeError('This phase requires a specimen');
}
export function assertAssetRegistry(registry: AssetRegistry): void {
  assertFiniteJson(registry);
  if (Object.keys(registry).sort().join(',') !== [...assetIds].sort().join(',')) throw new RangeError('Exactly four asset IDs are required');
  for (const [id, asset] of Object.entries(registry)) {
    if (asset.id !== id || !['placeholder', 'generated-unverified', 'verified'].includes(asset.status) || asset.geometry.heightM <= 0) throw new RangeError('Invalid asset record');
    if (asset.status === 'placeholder') {
      if (asset.runtimePath !== null || asset.meshy.taskId !== null || asset.verification.verifiedAt !== null) throw new RangeError('Placeholder must not claim generated or verified files');
      continue;
    }
    if (!asset.runtimePath?.startsWith('assets/') || !asset.runtimePath.endsWith('.glb') || !asset.sourcePath?.startsWith('assets/source/') || !asset.imagegen.imagePath || !asset.imagegen.promptPath || !asset.imagegen.generatedAt || asset.meshy.modelVersion !== 'meshy-7' || !asset.meshy.taskId || !asset.meshy.generatedAt || !asset.licenseNote) throw new RangeError('Generated asset must have complete ImageGen to Meshy 7 lineage');
    if (asset.status === 'verified' && (!asset.verification.reviewer || !asset.verification.verifiedAt || !asset.verification.reportPath || asset.geometry.triangles === null)) throw new RangeError('Verified asset needs a review record and measured triangles');
  }
}
