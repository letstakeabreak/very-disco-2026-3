import { Mesh, Vector3 } from 'three';
import type { WebGLProgramParametersWithUniforms } from 'three';
import { createRenderer } from '../../../../src/render';
import type { GameSnapshot, SalvageId } from '../../../../src/contracts';
import { DEFAULT_GAME_CONFIG, SNAPSHOT_FIXTURES } from '../../../../src/contracts/fixtures';
import { assertSnapshot, deepFreeze } from '../../../../src/contracts/validate';
import { PRESS_ANCHORS } from '../../../../src/render/ram';
import '../reflection-study/capture.css';

const canvas = document.querySelector<HTMLCanvasElement>('canvas')!;
const status = document.querySelector('#status')!;
const errors: string[] = [];
const meshes = new Map<Mesh, WebGLProgramParametersWithUniforms['uniforms']>();
const original = Mesh.prototype.onBeforeRender;
// Observe the production material's existing uniforms without changing its shader or pose.
Mesh.prototype.onBeforeRender = function (gpu, scene, camera, geometry, material, group): void {
  original.call(this, gpu, scene, camera, geometry, material, group);
  if (canvas.dataset['renderState'] !== 'ready' || meshes.has(this)) return;
  const shader = { uniforms: {}, vertexShader: '#include <begin_vertex>', fragmentShader: '#include <color_fragment>' } as WebGLProgramParametersWithUniforms;
  material.onBeforeCompile(shader, gpu);
  if (shader.uniforms['ramTravel'] || shader.uniforms['pressCompression']) meshes.set(this, shader.uniforms);
};
const viewer = createRenderer({ canvas, onFatal: error => errors.push(`${error.code}: ${error.message}`) });
let id: SalvageId = 'salvage-cassette'; let tick = 0; let elapsed = 0;
const snapshot = (phase: GameSnapshot['phase'], pressure01: number): GameSnapshot => {
  const definition = DEFAULT_GAME_CONFIG.specimens.find(item => item.id === id)!;
  const value = deepFreeze({ ...SNAPSHOT_FIXTURES.inspecting, tick: tick++, phase, inspectionYawRad: .45, pressure01,
    resumePhase: phase === 'paused' ? 'inspecting' as const : null,
    currentSpecimen: { id, material: definition.material, currentVolume: definition.initialVolume, integrity01: 1, value: definition.baseValue, compression01: 0 } });
  assertSnapshot(value); return value;
};
const resize = (): void => viewer.resize({ width: innerWidth, height: innerHeight, dpr: 1 });
resize(); window.addEventListener('resize', resize);

function measure(): Record<string, unknown> {
  let platenY = Infinity; let specimenTopY = -Infinity; let compression = 0; let travel = 0;
  for (const [mesh, uniforms] of meshes) {
    const isRam = mesh.name.startsWith('press-ram');
    const isSpecimen = mesh.name === id || (id === 'salvage-lens' && mesh.name.startsWith('lens-'));
    if (!isRam && !isSpecimen) continue;
    mesh.updateWorldMatrix(true, false);
    const positions = mesh.geometry.getAttribute('position'); const point = new Vector3();
    // Independent CPU evaluation of the shader's vertical mapping on every actual
    // GLB vertex; screenshots still come from the real GPU shader. No box test double.
    const height = Number(uniforms['pressHeight']?.value ?? 0);
    compression = isSpecimen ? Number(uniforms['pressCompression']!.value) : compression;
    travel = isRam ? Number(uniforms['ramTravel']!.value) : travel;
    for (let i = 0; i < positions.count; i++) {
      point.fromBufferAttribute(positions, i);
      if (isRam) {
        const t = Math.min(1, Math.max(0, (point.y - Number(PRESS_ANCHORS.flangeY.toFixed(8))) /
          (Number(PRESS_ANCHORS.topY.toFixed(8)) - Number(PRESS_ANCHORS.flangeY.toFixed(8)))));
        point.y -= travel * (1 - t * t * (3 - 2 * t));
      } else {
        const glass = Number(uniforms['pressIsGlass']!.value); const crush = compression * (glass ? .12 : .52);
        const u = Math.min(1, Math.max(0, point.y / height)); const shellScale = 1 - crush / .6;
        if (Number(uniforms['pressGlassSurface']!.value)) point.y -= crush * height * .5;
        else if (!glass) point.y *= 1 - crush;
        else point.y = u < .3 ? point.y * shellScale : u < .7 ? point.y - .5 * crush * height
          : .7 * height - .5 * crush * height + (point.y - .7 * height) * shellScale;
      }
      point.applyMatrix4(mesh.matrixWorld);
      if (isRam) platenY = Math.min(platenY, point.y);
      else specimenTopY = Math.max(specimenTopY, point.y);
    }
  }
  return { elapsedMs: elapsed, id, compression, ramTravel: travel, platenY, specimenTopY,
    vertexGapM: platenY - specimenTopY, renderState: canvas.dataset['renderState'], loadedAssets: canvas.dataset['loadedAssets'] };
}
const reset = (asset: SalvageId): Record<string, unknown> => {
  id = asset; tick = 0; elapsed = 0;
  viewer.render(SNAPSHOT_FIXTURES.idle, 0); viewer.render(snapshot('inspecting', 0), 0);
  status.textContent = `${id} · 0ms`; return measure();
};
const advance = (dt: number, phase: GameSnapshot['phase'] = 'compressing', pressure = .4): Record<string, unknown> => {
  elapsed += dt; viewer.render(snapshot(phase, pressure), dt);
  status.textContent = `${id} · ${elapsed}ms`; return measure();
};
let frame = 0;
const load = (): void => {
  viewer.render(snapshot('inspecting', 0), 0);
  if (canvas.dataset['renderState'] !== 'ready') frame = requestAnimationFrame(load);
  else reset(id);
};
frame = requestAnimationFrame(load);
Object.assign(window, { __motionProbe: { reset, advance, measure, errors, get ready() { return canvas.dataset['renderState'] === 'ready'; } } });
window.addEventListener('error', event => errors.push(event.message));
window.addEventListener('unhandledrejection', event => errors.push(String(event.reason)));
const dispose = (): void => { cancelAnimationFrame(frame); window.removeEventListener('resize', resize); viewer.dispose(); Mesh.prototype.onBeforeRender = original; };
window.addEventListener('pagehide', dispose, { once: true }); if (import.meta.hot) import.meta.hot.dispose(dispose);
