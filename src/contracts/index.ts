/** DEEP PRESS contract v1. Integration owner A controls approved shared changes. */
export const CONTRACT_VERSION = '1.0.0' as const;
export const FIXED_STEP_MS = 1000 / 60;
export const MAX_STEP_MS = 100;
export type Vec3 = Readonly<{ x: number; y: number; z: number }>;
export type ActivePhase = 'idle' | 'inspecting' | 'compressing' | 'settling' | 'stored' | 'failed' | 'complete';
export type GamePhase = ActivePhase | 'paused';
export type SalvageId = 'salvage-core' | 'salvage-lens' | 'salvage-cassette';
export type AssetId = 'press-chamber' | SalvageId;
export type Material = 'metal' | 'glass' | 'composite';
export type SceneEntity = Readonly<{ id: string; assetId: AssetId | null; position: Vec3; rotationRad: Vec3; scale: Vec3 }>;
export type SpecimenDefinition = Readonly<{ id: SalvageId; material: Material; initialVolume: number; minimumVolume: number; baseValue: number; safePressure01: number }>;
export type SpecimenState = Readonly<{ id: SalvageId; material: Material; currentVolume: number; integrity01: number; value: number; compression01: number }>;
export type GameConfig = Readonly<{
  seed: number;
  capacity: number;
  pressRatePerSecond: number;
  settleDurationMs: number;
  collectionBonus: number;
  specimens: readonly SpecimenDefinition[];
  initialEntities: readonly SceneEntity[];
}>;
export type GameSnapshot = Readonly<{
  contractVersion: typeof CONTRACT_VERSION;
  implementation: 'scaffold' | 'game';
  seed: number;
  tick: number;
  elapsedMs: number;
  phase: GamePhase;
  resumePhase: ActivePhase | null;
  pressure01: number;
  volumeUsed: number;
  capacity: number;
  score: number;
  currentSpecimen: SpecimenState | null;
  remainingSpecimenIds: readonly SalvageId[];
  storedSpecimenIds: readonly SalvageId[];
  inspectionYawRad: number;
  entities: readonly SceneEntity[];
}>;
export type GameCommand =
  | Readonly<{ type: 'start' }>
  | Readonly<{ type: 'restart' }>
  | Readonly<{ type: 'select'; specimenId: SalvageId }>
  | Readonly<{ type: 'inspect'; yawRad: number }>
  | Readonly<{ type: 'press-start' }>
  | Readonly<{ type: 'press-release' }>
  | Readonly<{ type: 'store' }>
  | Readonly<{ type: 'discard' }>
  | Readonly<{ type: 'cash-out' }>
  | Readonly<{ type: 'pause' }>
  | Readonly<{ type: 'resume' }>;
export type GameEvent =
  | Readonly<{ type: 'phase-changed'; tick: number; from: GamePhase; to: GamePhase }>
  | Readonly<{ type: 'specimen-selected'; tick: number; specimenId: SalvageId }>
  | Readonly<{ type: 'press-released'; tick: number; pressure01: number }>
  | Readonly<{ type: 'stored'; tick: number; specimenId: SalvageId; scoreDelta: number }>
  | Readonly<{ type: 'discarded'; tick: number; specimenId: SalvageId }>
  | Readonly<{ type: 'failed'; tick: number; reason: 'specimen-broken' | 'capacity-exceeded' }>
  | Readonly<{ type: 'completed'; tick: number; score: number }>;
export interface Game {
  dispatch(command: GameCommand): void;
  step(dtMs: number): void;
  snapshot(): GameSnapshot;
  drainEvents(): readonly GameEvent[];
  dispose(): void;
}
export type RendererSize = Readonly<{ width: number; height: number; dpr: number }>;
export type RenderFailure = Readonly<{ code: 'webgl-unavailable' | 'render-failed'; message: string }>;
export type RendererOptions = Readonly<{ canvas: HTMLCanvasElement; onFatal: (failure: RenderFailure) => void }>;
export interface GameRenderer {
  resize(size: RendererSize): void;
  render(snapshot: GameSnapshot, dtMs: number): void;
  dispose(): void;
}
export type AssetRecord = Readonly<{
  id: AssetId;
  status: 'placeholder' | 'generated-unverified' | 'verified';
  runtimePath: string | null;
  sourcePath: string | null;
  imagegen: Readonly<{ imagePath: string | null; promptPath: string | null; generatedAt: string | null }>;
  meshy: Readonly<{ modelVersion: 'meshy-7' | null; taskId: string | null; generatedAt: string | null }>;
  licenseNote: string;
  geometry: Readonly<{ triangles: number | null; heightM: number; pivot: 'base-center'; upAxis: '+Y'; forwardAxis: '+Z' }>;
  verification: Readonly<{ reviewer: string | null; verifiedAt: string | null; reportPath: string | null }>;
}>;
export type AssetRegistry = Readonly<Record<AssetId, AssetRecord>>;
