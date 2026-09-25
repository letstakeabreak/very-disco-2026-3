import { Mesh, Vector3 } from 'three';
import type { Camera, WebGLProgramParametersWithUniforms } from 'three';
import { createRenderer } from '../../../../src/render';
import type { GameSnapshot, SalvageId } from '../../../../src/contracts';
import { DEFAULT_GAME_CONFIG, SNAPSHOT_FIXTURES } from '../../../../src/contracts/fixtures';
import { assertSnapshot, deepFreeze } from '../../../../src/contracts/validate';
import '../reflection-study/capture.css';

const canvas = document.querySelector<HTMLCanvasElement>('canvas')!;
const status = document.querySelector('#status')!;
const errors: string[] = [];
const meshes = new Map<Mesh, WebGLProgramParametersWithUniforms['uniforms']>();
let camera: Camera | null = null;
let caseDepth: Mesh | null = null;
const original = Mesh.prototype.onBeforeRender;
Mesh.prototype.onBeforeRender = function (gpu, scene, view, geometry, material, group): void {
  original.call(this, gpu, scene, view, geometry, material, group);
  if (this.name === 'case-foam-depth') caseDepth = this;
  if (canvas.dataset['renderState'] !== 'ready') return;
  if (!meshes.has(this)) {
    const shader = { uniforms: {}, vertexShader: '#include <begin_vertex>', fragmentShader: '#include <color_fragment>' } as WebGLProgramParametersWithUniforms;
    material.onBeforeCompile(shader, gpu);
    if (shader.uniforms['pressCompression']) meshes.set(this, shader.uniforms);
  }
  if (meshes.has(this)) camera = view;
};
const renderer = createRenderer({ canvas, onFatal: error => errors.push(`${error.code}: ${error.message}`) });
const resize = (): void => renderer.resize({ width: innerWidth, height: innerHeight, dpr: 1 });
resize(); window.addEventListener('resize', resize);
let tick = 0;
let lastSnapshot: GameSnapshot = SNAPSHOT_FIXTURES.idle;
const render = (snapshot: GameSnapshot): void => { assertSnapshot(snapshot); lastSnapshot = snapshot; renderer.render(deepFreeze(snapshot), 0); };

function measure(): Record<string, unknown>[] {
  if (!camera) throw new Error('No production camera observed');
  const stageH = Math.min(innerHeight, innerWidth * 1.5); const stageW = stageH * 2 / 3;
  const result = new Map<string, { id: string; minX: number; minY: number; maxX: number; maxY: number; compression: number; vertices: number }>();
  const point = new Vector3();
  for (const [mesh, uniforms] of meshes) {
    const id = mesh.name.startsWith('lens-') ? 'salvage-lens' : mesh.name.startsWith('cassette-') ? 'salvage-cassette' : mesh.name;
    const bounds = result.get(id) ?? { id, minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity, compression: 0, vertices: 0 };
    const number = (key: string): number => Number(uniforms[key]!.value);
    const h = number('pressHeight'); const compression = number('pressCompression'); const damage = number('pressDamage');
    const glass = number('pressIsGlass'); const glassSurface = number('pressGlassSurface');
    const crush = compression * (glass ? .12 : .52); const shellScale = 1 - crush / .6;
    const positions = mesh.geometry.getAttribute('position'); mesh.updateWorldMatrix(true, false);
    // CPU projection of the actual GLB vertices using the production shader's
    // authored position mapping. Not GPU readback or a physics collision engine.
    for (let i = 0; i < positions.count; i++) {
      point.fromBufferAttribute(positions, i);
      const u = Math.min(1, Math.max(0, point.y / h));
      const t = Math.min(1, Math.max(0, (Math.abs(u - .5) - .16) / .16)); const shell = t * t * (3 - 2 * t);
      const ribs = Math.sin(u * 21.991) * Math.sin(u * 3.14159); const fold = crush * shell;
      const originalZ = point.z;
      if (glassSurface) point.y -= crush * h * .5;
      else if (!glass) point.y *= 1 - crush;
      else point.y = u < .3 ? point.y * shellScale : u < .7 ? point.y - .5 * crush * h
        : .7 * h - .5 * crush * h + (point.y - .7 * h) * shellScale;
      point.x += (Math.sign(point.x) * ribs * fold * h * .13 + Math.sin(originalZ * 70 + u * 11) * damage * shell * h * .035) * (1 - glassSurface);
      point.z += Math.sign(point.z) * ribs * fold * h * .08 * (1 - glassSurface);
      point.applyMatrix4(mesh.matrixWorld).project(camera);
      const x = (innerWidth - stageW) / 2 + (point.x + 1) / 2 * stageW;
      const y = (innerHeight - stageH) / 2 + (1 - point.y) / 2 * stageH;
      bounds.minX = Math.min(bounds.minX, x); bounds.maxX = Math.max(bounds.maxX, x);
      bounds.minY = Math.min(bounds.minY, y); bounds.maxY = Math.max(bounds.maxY, y);
    }
    bounds.compression = compression; bounds.vertices += positions.count; result.set(id, bounds);
  }
  return [...result.values()].map(b => ({ ...b, width: b.maxX - b.minX, height: b.maxY - b.minY,
    bottomMarginTo130pxStudyDock: innerHeight - 130 - b.maxY }));
}
const show = (order: SalvageId[], compression: number): Record<string, unknown> => {
  render({ ...SNAPSHOT_FIXTURES.idle, tick: tick++ });
  for (const id of order) {
    const definition = DEFAULT_GAME_CONFIG.specimens.find(item => item.id === id)!;
    render({ ...SNAPSHOT_FIXTURES.paused, tick: tick++, resumePhase: 'inspecting', pressure01: compression,
      currentSpecimen: { id, material: definition.material, currentVolume: definition.initialVolume, integrity01: 1, value: definition.baseValue, compression01: compression } });
  }
  render({ ...SNAPSHOT_FIXTURES.complete, tick: tick++, phase: 'paused', resumePhase: 'complete', pressure01: 0,
    remainingSpecimenIds: [], storedSpecimenIds: order, currentSpecimen: null });
  status.textContent = `${compression.toFixed(2)} · ${innerWidth}×${innerHeight}`;
  return { order, compression, viewport: { width: innerWidth, height: innerHeight, dpr: 1 }, bounds: measure(), errors, status: { ...canvas.dataset } };
};
function compareDepth(order: SalvageId[], compression: number): Record<string, unknown> {
  show(order, compression);
  if (!caseDepth) throw new Error('Case depth mesh not observed');
  const depth = caseDepth;
  const snapshot = lastSnapshot;
  const gl = canvas.getContext('webgl2')!;
  const pixels = (): Uint8Array => {
    const data = new Uint8Array(canvas.width * canvas.height * 4);
    gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, data);
    return data;
  };
  depth.visible = false; render(snapshot); const withoutDepth = pixels();
  depth.visible = true; render(snapshot); const withDepth = pixels();
  render({ ...snapshot, storedSpecimenIds: [] }); const empty = pixels();
  render(snapshot);
  const stageH = Math.min(innerHeight, innerWidth * 1.5); const stageW = stageH * 2 / 3;
  const visiblePixels = [0, 0, 0];
  let changed = 0; let outsideCase = 0; let frontBefore = 0; let frontAfter = 0;
  const differs = (a: Uint8Array, b: Uint8Array, offset: number): boolean =>
    Math.max(Math.abs(a[offset]! - b[offset]!), Math.abs(a[offset + 1]! - b[offset + 1]!), Math.abs(a[offset + 2]! - b[offset + 2]!)) > 3;
  for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) {
    const offset = ((canvas.height - 1 - y) * canvas.width + x) * 4;
    const u = (x - (innerWidth - stageW) / 2) / stageW * 1024;
    const v = (y - (innerHeight - stageH) / 2) / stageH * 1536;
    if (differs(withDepth, withoutDepth, offset)) {
      changed++;
      if (u < 390 || u > 990 || v < 1045 || v > 1360) outsideCase++;
    }
    if (u > 443 && u < 920 && v > 1222 && v < 1280) {
      if (differs(withoutDepth, empty, offset)) frontBefore++;
      if (differs(withDepth, empty, offset)) frontAfter++;
    }
    if (v > 1085 && v < 1190 && differs(withDepth, empty, offset)) {
      for (const [i, [left, right]] of [[492, 582], [638, 750], [800, 902]].entries()) {
        if (u > left! && u < right!) visiblePixels[i]!++;
      }
    }
  }
  return { order, compression, viewport: { width: innerWidth, height: innerHeight },
    changedPixels: changed, changedOutsideCase: outsideCase,
    specimenPixelsOnFrontBefore: frontBefore, specimenPixelsOnFrontAfter: frontAfter, visiblePixelsInApertures: visiblePixels,
    readback: 'Synchronous default-framebuffer WebGL2 RGBA readPixels. RGB difference threshold >3/255. No screenshot inference.', errors };
}
let frame = 0;
const load = (): void => {
  renderer.render(SNAPSHOT_FIXTURES.inspecting, 0);
  if (canvas.dataset['renderState'] !== 'ready') frame = requestAnimationFrame(load);
  else show(['salvage-cassette', 'salvage-lens', 'salvage-core'], .55);
};
frame = requestAnimationFrame(load);
Object.assign(window, { __caseProbe: { show, compareDepth, errors, get ready() { return canvas.dataset['renderState'] === 'ready'; } } });
window.addEventListener('error', event => errors.push(event.message));
window.addEventListener('unhandledrejection', event => errors.push(String(event.reason)));
const dispose = (): void => { cancelAnimationFrame(frame); window.removeEventListener('resize', resize); renderer.dispose(); Mesh.prototype.onBeforeRender = original; };
window.addEventListener('pagehide', dispose, { once: true }); if (import.meta.hot) import.meta.hot.dispose(dispose);
