import { createRenderer } from '../../../../src/render';
import { DEFAULT_GAME_CONFIG, SNAPSHOT_FIXTURES } from '../../../../src/contracts/fixtures';
import { assertSnapshot, deepFreeze } from '../../../../src/contracts/validate';
import type { GameSnapshot } from '../../../../src/contracts';

const canvas = document.querySelector('canvas')!;
const status = document.querySelector('#status')!;
const errors: string[] = [];
const renderer = createRenderer({ canvas, onFatal: error => errors.push(`${error.code}: ${error.message}`) });
let tick = 0; let frame = 0;
const definition = DEFAULT_GAME_CONFIG.specimens.find(item => item.id === 'salvage-cassette')!;
function show(damage: number, pose: 'inspect' | 'failed' = 'inspect'): Record<string, unknown> {
  const snapshot: GameSnapshot = deepFreeze({ ...SNAPSHOT_FIXTURES.paused, tick: tick++, resumePhase: pose === 'inspect' ? 'inspecting' : 'failed',
    pressure01: .55, inspectionYawRad: .45, storedSpecimenIds: [], remainingSpecimenIds: ['salvage-core','salvage-lens','salvage-cassette'],
    currentSpecimen: { id: 'salvage-cassette', material: definition.material, currentVolume: definition.initialVolume,
      value: definition.baseValue, compression01: .55, integrity01: 1 - damage } });
  assertSnapshot(snapshot); renderer.render(snapshot, 0);
  status.textContent = `${pose.toUpperCase()} · DAMAGE ${Math.round(damage * 100)}%`;
  return { snapshot, status: { ...canvas.dataset }, errors, viewport: [innerWidth, innerHeight] };
}
function pixels(): Uint8Array {
  const gl = canvas.getContext('webgl2')!;
  const data = new Uint8Array(canvas.width * canvas.height * 4);
  gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, data);
  return data;
}
function compare(damage: number, pose: 'inspect' | 'failed'): Record<string, unknown> {
  show(0, pose); const intact = pixels();
  show(damage, pose); const changed = pixels();
  let count = 0; let minX = canvas.width; let minY = canvas.height; let maxX = -1; let maxY = -1;
  for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) {
    const offset = ((canvas.height - 1 - y) * canvas.width + x) * 4;
    if (Math.max(...[0,1,2].map(channel => Math.abs(intact[offset + channel]! - changed[offset + channel]!))) <= 3) continue;
    count++; minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
  }
  return { damage, pose, changedPixels: count, bounds: count ? [minX,minY,maxX,maxY] : null,
    method: 'Synchronous WebGL2 readPixels; RGB difference >3/255; same snapshot except integrity. Not a human recognition score.' };
}
function store(damage: number): Record<string, unknown> {
  show(damage);
  const snapshot: GameSnapshot = deepFreeze({ ...SNAPSHOT_FIXTURES.stored, tick: tick++, phase: 'paused', resumePhase: 'stored',
    currentSpecimen: null, storedSpecimenIds: ['salvage-cassette'], remainingSpecimenIds: ['salvage-core','salvage-lens'] });
  assertSnapshot(snapshot); renderer.render(snapshot, 0);
  status.textContent = `STORED HISTORY · DAMAGE ${Math.round(damage * 100)}%`;
  return { snapshot, damage, pose: 'stored', status: { ...canvas.dataset }, errors, viewport: [innerWidth, innerHeight],
    boundary: 'Visual history from the preceding current specimen, not damage restored from stored snapshot fields.' };
}
const resize = (): void => renderer.resize({ width: innerWidth, height: innerHeight, dpr: 1 });
resize(); window.addEventListener('resize', resize);
const load = (): void => {
  renderer.render(SNAPSHOT_FIXTURES.inspecting, 0);
  if (canvas.dataset['renderState'] !== 'ready') frame = requestAnimationFrame(load);
  else show(0);
};
frame = requestAnimationFrame(load);
Object.assign(window, { __damageProbe: { show, compare, store, errors, get ready() { return canvas.dataset['renderState'] === 'ready'; } } });
window.addEventListener('error', event => errors.push(event.message));
window.addEventListener('unhandledrejection', event => errors.push(String(event.reason)));
const dispose = (): void => { cancelAnimationFrame(frame); window.removeEventListener('resize', resize); renderer.dispose(); };
window.addEventListener('pagehide', dispose, { once: true }); if (import.meta.hot) import.meta.hot.dispose(dispose);
