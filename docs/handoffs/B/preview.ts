import { createRenderer } from '../../../src/render';
import { DEFAULT_GAME_CONFIG, SNAPSHOT_FIXTURES } from '../../../src/contracts/fixtures';
import { CONTRACT_VERSION, type GamePhase, type GameSnapshot, type RenderFailure, type SalvageId } from '../../../src/contracts';
import { assertSnapshot, deepFreeze } from '../../../src/contracts/validate';
import './preview.css';

type StudyControls = { phase: GamePhase; specimenId: SalvageId; pressure01: number; integrity01: number; yawDeg: number; storedCount: number };
type ProbeError = Readonly<{ at: string; source: string; message: string }>;
type ProbeMetrics = Readonly<{ sampleFrames: number; totalFrames: number; fps: number; p95FrameMs: number; maxFrameMs: number; elapsedMs: number; viewport: { width: number; height: number; dpr: number }; rendererStatus: Record<string, string | undefined> }>;
type RenderProbe = Readonly<{ snapshot: GameSnapshot; controls: Readonly<StudyControls>; metrics: ProbeMetrics; errors: readonly ProbeError[]; setState: (patch: Partial<StudyControls>) => void; resetMetrics: () => void }>;

declare global { interface Window { __renderProbe?: RenderProbe } }

function element<T extends HTMLElement>(id: string): T {
  const result = document.getElementById(id);
  if (!result) throw new Error(`Missing render study element: ${id}`);
  return result as T;
}
const canvas = element<HTMLCanvasElement>('study-canvas');
const phaseSelect = element<HTMLSelectElement>('phase');
const specimenSelect = element<HTMLSelectElement>('specimen');
const pressureInput = element<HTMLInputElement>('pressure');
const integrityInput = element<HTMLInputElement>('integrity');
const yawInput = element<HTMLInputElement>('yaw');
const storedInput = element<HTMLInputElement>('stored');
const performanceLabel = element('performance');
const statusLabel = element('render-status');
const statusLight = element('status-light');
const fatalMessage = element('fatal-message');
const errors: ProbeError[] = [];
const phaseIds = Object.keys(SNAPSHOT_FIXTURES) as GamePhase[];
const salvageIds = DEFAULT_GAME_CONFIG.specimens.map((item) => item.id);
let controls: StudyControls = { phase: 'inspecting', specimenId: 'salvage-core', pressure01: 0, integrity01: 1, yawDeg: 0, storedCount: 0 };
let snapshot: GameSnapshot;
let disposed = false;
let totalFrames = 0;
let startedAt = performance.now();
let samples: number[] = [];
let viewport = { width: 0, height: 0, dpr: 1 };
let previousTime: number | null = null;
let lastStatusTime = 0;
let frameId = 0;

function recordError(source: string, message: string): void {
  errors.push({ at: new Date().toISOString(), source, message });
  if (errors.length > 30) errors.shift();
  statusLight.dataset.state = 'error';
  statusLabel.textContent = 'ERROR';
  fatalMessage.hidden = false;
  fatalMessage.textContent = `${source}: ${message}`;
}
const renderer = createRenderer({ canvas, onFatal: (failure: RenderFailure) => recordError(failure.code, failure.message) });

/** Direct fixture edits for visual QA, deliberately not gameplay formulae or core commands. */
function composeSnapshot(): GameSnapshot {
  const base = structuredClone(SNAPSHOT_FIXTURES[controls.phase]);
  const definition = DEFAULT_GAME_CONFIG.specimens.find((item) => item.id === controls.specimenId)!;
  const orderedIds = [...salvageIds.filter((id) => id !== controls.specimenId), controls.specimenId];
  const storedIds = orderedIds.slice(0, controls.storedCount);
  const hasSpecimen = ['inspecting', 'compressing', 'settling', 'failed', 'paused'].includes(controls.phase);
  const next: GameSnapshot = {
    ...base,
    pressure01: controls.pressure01,
    inspectionYawRad: controls.yawDeg * Math.PI / 180,
    storedSpecimenIds: storedIds,
    remainingSpecimenIds: salvageIds.filter((id) => !storedIds.includes(id)),
    currentSpecimen: hasSpecimen ? {
      id: definition.id, material: definition.material,
      currentVolume: controls.phase === 'failed' ? definition.minimumVolume : base.currentSpecimen?.id === definition.id ? base.currentSpecimen.currentVolume : definition.initialVolume,
      value: controls.phase === 'failed' ? 0 : base.currentSpecimen?.id === definition.id ? base.currentSpecimen.value : definition.baseValue,
      integrity01: controls.integrity01,
      compression01: controls.phase === 'compressing' ? 0 : controls.pressure01,
    } : null,
  };
  assertSnapshot(next);
  return deepFreeze(next);
}

function refreshControls(): void {
  phaseSelect.value = controls.phase;
  specimenSelect.value = controls.specimenId;
  pressureInput.value = String(controls.pressure01);
  integrityInput.value = String(controls.integrity01);
  yawInput.value = String(controls.yawDeg);
  storedInput.value = String(controls.storedCount);
  element('pressure-value').textContent = `${Math.round(controls.pressure01 * 100)}%`;
  element('integrity-value').textContent = `${Math.round(controls.integrity01 * 100)}%`;
  element('yaw-value').textContent = `${Math.round(controls.yawDeg)}°`;
  element('stored-value').textContent = `${controls.storedCount} / 3`;
}

function setState(patch: Partial<StudyControls>): void {
  const next = { ...controls, ...patch };
  if (!phaseIds.includes(next.phase) || !salvageIds.includes(next.specimenId)) throw new RangeError('Unknown study phase or specimen');
  if (![next.pressure01, next.integrity01, next.yawDeg, next.storedCount].every(Number.isFinite) || next.pressure01 < 0 || next.pressure01 > 1 || next.integrity01 < 0 || next.integrity01 > 1 || next.yawDeg < -180 || next.yawDeg > 180 || !Number.isInteger(next.storedCount) || next.storedCount < 0 || next.storedCount > 3) throw new RangeError('Study controls are out of range');
  controls = next;
  snapshot = composeSnapshot();
  refreshControls();
}

function metrics(): ProbeMetrics {
  const sorted = [...samples].sort((a, b) => a - b);
  const total = samples.reduce((sum, value) => sum + value, 0);
  return {
    sampleFrames: samples.length, totalFrames,
    fps: total > 0 ? 1000 * samples.length / total : 0,
    p95FrameMs: sorted[Math.max(0, Math.ceil(sorted.length * 0.95) - 1)] ?? 0,
    maxFrameMs: sorted.at(-1) ?? 0,
    elapsedMs: performance.now() - startedAt,
    viewport: { ...viewport }, rendererStatus: { ...canvas.dataset },
  };
}

const abort = new AbortController();
const listenerOptions = { signal: abort.signal };
phaseSelect.addEventListener('change', () => {
  const phase = phaseSelect.value as GamePhase;
  const fixture = SNAPSHOT_FIXTURES[phase];
  setState({ phase, pressure01: fixture.pressure01, integrity01: fixture.currentSpecimen?.integrity01 ?? 1, storedCount: fixture.storedSpecimenIds.length });
}, listenerOptions);
specimenSelect.addEventListener('change', () => setState({ specimenId: specimenSelect.value as SalvageId }), listenerOptions);
pressureInput.addEventListener('input', () => setState({ pressure01: pressureInput.valueAsNumber }), listenerOptions);
integrityInput.addEventListener('input', () => setState({ integrity01: integrityInput.valueAsNumber }), listenerOptions);
yawInput.addEventListener('input', () => setState({ yawDeg: yawInput.valueAsNumber }), listenerOptions);
storedInput.addEventListener('input', () => setState({ storedCount: storedInput.valueAsNumber }), listenerOptions);
window.addEventListener('error', (event) => recordError('window', event.message), listenerOptions);
window.addEventListener('unhandledrejection', (event) => recordError('promise', String(event.reason)), listenerOptions);
document.addEventListener('visibilitychange', () => { previousTime = null; }, listenerOptions);

function resize(): void {
  viewport = { width: canvas.clientWidth, height: canvas.clientHeight, dpr: Math.min(2, window.devicePixelRatio || 1) };
  renderer.resize(viewport);
}
const observer = new ResizeObserver(resize);
observer.observe(canvas);
element('contract-version').textContent = CONTRACT_VERSION;
setState({});
resize();

window.__renderProbe = {
  get snapshot() { return snapshot; },
  get controls() { return Object.freeze({ ...controls }); },
  get metrics() { return metrics(); },
  get errors() { return [...errors]; },
  setState,
  resetMetrics() { samples = []; totalFrames = 0; startedAt = performance.now(); previousTime = null; },
};

function frame(now: number): void {
  if (disposed) return;
  const rawDt = previousTime === null ? 0 : now - previousTime;
  previousTime = now;
  if (!document.hidden) {
    try { renderer.render(snapshot, Math.min(100, rawDt)); }
    catch (error) { recordError('render', String(error)); }
    totalFrames += 1;
    if (rawDt > 0) { samples.push(rawDt); if (samples.length > 600) samples.shift(); }
  }
  if (now - lastStatusTime >= 500) {
    const current = metrics();
    performanceLabel.textContent = `${current.fps.toFixed(0)} FPS · P95 ${current.p95FrameMs.toFixed(1)} MS · DPR ${viewport.dpr.toFixed(1)}`;
    if (errors.length === 0) { statusLight.dataset.state = 'active'; statusLabel.textContent = 'LIVE RENDER'; }
    lastStatusTime = now;
  }
  frameId = requestAnimationFrame(frame);
}
frameId = requestAnimationFrame(frame);

function dispose(): void {
  if (disposed) return;
  disposed = true;
  cancelAnimationFrame(frameId);
  abort.abort(); observer.disconnect(); renderer.dispose();
  delete window.__renderProbe;
}
window.addEventListener('pagehide', dispose, { once: true, signal: abort.signal });
if (import.meta.hot) import.meta.hot.dispose(dispose);
