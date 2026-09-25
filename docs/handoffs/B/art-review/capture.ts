import { createRenderer } from '../../../../src/render';
import { DEFAULT_GAME_CONFIG, SNAPSHOT_FIXTURES } from '../../../../src/contracts/fixtures';
import { assertSnapshot, deepFreeze } from '../../../../src/contracts/validate';
import type { GameSnapshot } from '../../../../src/contracts';
import { createInspector } from './inspector';
import './capture.css';

type ArtProbe = { readonly target: string; readonly ready: boolean; readonly errors: readonly string[];
  readonly snapshot: GameSnapshot | null; readonly status: Record<string, string | undefined>;
  readonly viewport: { width: number; height: number; dpr: number }; readonly frames: number };
declare global { interface Window { __artProbe?: ArtProbe } }
const target = new URLSearchParams(location.search).get('target') ?? '01';
if (!['01','02','03','04','05'].includes(target)) throw new Error('Unknown art target');
const canvas = document.querySelector<HTMLCanvasElement>('#art-canvas')!;
const status = document.querySelector('#status')!;
const fatal = document.querySelector<HTMLParagraphElement>('#fatal')!;
const names: Record<string, string> = { '01':'01 / WORKBENCH','02':'02 / PRESSURE','03':'03 / CASSETTE ASSET','04':'04 / PRESS ASSET','05':'05 / THREE STORED' };
document.querySelector('#title')!.textContent = names[target]!;
const errors: string[] = [];
const report = (message: string): void => { errors.push(message); fatal.hidden = false; fatal.textContent = message; status.textContent = 'ERROR'; };
let snapshot: GameSnapshot | null = null;
if (target === '01' || target === '02') {
  const definition = DEFAULT_GAME_CONFIG.specimens.find(({ id }) => id === 'salvage-cassette')!;
  snapshot = deepFreeze({ ...SNAPSHOT_FIXTURES[target === '01' ? 'inspecting' : 'compressing'],
    inspectionYawRad: 0.45, pressure01: target === '02' ? 0.6 : 0,
    currentSpecimen: { id: definition.id, material: definition.material, currentVolume: definition.initialVolume,
      integrity01: 1, value: definition.baseValue, compression01: 0 } });
} else if (target === '05') {
  snapshot = deepFreeze({ ...SNAPSHOT_FIXTURES.complete, pressure01: 0,
    remainingSpecimenIds: [], storedSpecimenIds: ['salvage-cassette','salvage-lens','salvage-core'] });
}
if (snapshot) assertSnapshot(snapshot);
const viewer = snapshot
  ? createRenderer({ canvas, onFatal: ({ code, message }) => report(`${code}: ${message}`) })
  : createInspector(canvas, target === '03' ? 'salvage-cassette' : 'press-chamber', report);
const abort = new AbortController();
window.addEventListener('error', ({ message }) => report(message), { signal: abort.signal });
window.addEventListener('unhandledrejection', ({ reason }) => report(String(reason)), { signal: abort.signal });
let frameId = 0; let previous = 0; let frames = 0; let disposed = false;
let viewport = { width: 0, height: 0, dpr: 1 };
const resize = (): void => {
  viewport = { width: canvas.clientWidth, height: canvas.clientHeight, dpr: Math.min(2, devicePixelRatio || 1) };
  viewer.resize(viewport);
};
const observer = new ResizeObserver(resize); observer.observe(canvas); resize();
const frame = (now: number): void => {
  if (disposed) return;
  const dt = previous === 0 ? 0 : Math.min(100, now - previous); previous = now;
  try {
    if (snapshot) viewer.render(snapshot, dt);
    else viewer.render(SNAPSHOT_FIXTURES.idle, dt);
    frames += 1;
    status.textContent = errors.length ? 'ERROR' : `${canvas.dataset['renderState']?.toUpperCase() ?? 'LOADING'} · DPR ${viewport.dpr}`;
  } catch (error) { report(String(error)); }
  frameId = requestAnimationFrame(frame);
};
frameId = requestAnimationFrame(frame);
window.__artProbe = { target, get ready() { return canvas.dataset['renderState'] === 'ready' && frames > 2 && errors.length === 0; },
  get errors() { return [...errors]; }, get snapshot() { return snapshot; }, get status() { return { ...canvas.dataset }; },
  get viewport() { return { ...viewport }; }, get frames() { return frames; } };
const dispose = (): void => {
  if (disposed) return; disposed = true; cancelAnimationFrame(frameId); observer.disconnect(); abort.abort(); viewer.dispose(); delete window.__artProbe;
};
window.addEventListener('pagehide', dispose, { once: true, signal: abort.signal });
if (import.meta.hot) import.meta.hot.dispose(dispose);
