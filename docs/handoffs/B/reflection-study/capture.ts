import { Mesh, MeshLambertMaterial, MeshStandardMaterial, PMREMGenerator, Scene } from 'three';
import type { WebGLRenderTarget } from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createRenderer } from '../../../../src/render';
import { DEFAULT_GAME_CONFIG, SNAPSHOT_FIXTURES } from '../../../../src/contracts/fixtures';
import { assertSnapshot, deepFreeze } from '../../../../src/contracts/validate';
import './capture.css';
const variant = new URLSearchParams(location.search).get('variant') ?? 'baseline';
if (!['baseline', 'dark-walls', 'warm-card', 'balanced'].includes(variant)) throw new Error('Unknown reflection study');
const canvas = document.querySelector<HTMLCanvasElement>('#art-canvas')!;
const errors: string[] = [];
const report = (message: string): void => { errors.push(message); };
let installed = false;
let alternative: WebGLRenderTarget | null = null;
const materials: Record<string, unknown>[] = [];
const original = Mesh.prototype.onBeforeRender;
Mesh.prototype.onBeforeRender = function (gpu, scene, camera, geometry, material, group): void {
  original.call(this, gpu, scene, camera, geometry, material, group);
  if (installed || !(scene instanceof Scene) || !scene.environment || canvas.dataset['renderState'] !== 'ready') return;
  installed = true;
  // Defer PMREM generation until the production draw has completed.
  queueMicrotask(() => {
    try {
      const room = new RoomEnvironment();
      room.traverse(object => {
        if (!(object instanceof Mesh)) return;
        if (object.material instanceof MeshLambertMaterial && object.material.emissiveIntensity > 2) {
          const warm = object.position.x < -8 || ((variant === 'warm-card' || variant === 'balanced') && object.position.z > 8);
          object.material.emissive.set(warm ? (variant === 'balanced' || variant === 'baseline' ? '#ffe2ba' : '#ffd092') : '#edf3ff');
          if (Math.abs(object.position.x) > 8) object.scale.z *= .45;
          else if (Math.abs(object.position.z) > 8) object.scale.x *= .45;
        } else if (object.material instanceof MeshStandardMaterial) {
          object.material.color.multiplyScalar(variant === 'baseline' ? 1 : variant === 'balanced' ? .35 : .15);
        }
        materials.push({ type: object.material.type, position: object.position.toArray(), color: object.material.color.toArray(), emissive: object.material.emissive.toArray(), scale: object.scale.toArray() });
      });
      const generator = new PMREMGenerator(gpu);
      alternative = generator.fromScene(room, .02);
      scene.environment = alternative.texture;
      room.dispose(); generator.dispose();
    } catch (error) { report(String(error)); }
  });
};
const definition = DEFAULT_GAME_CONFIG.specimens.find(({ id }) => id === 'salvage-cassette')!;
const snapshot = deepFreeze({ ...SNAPSHOT_FIXTURES.inspecting, inspectionYawRad: .45, pressure01: 0,
  currentSpecimen: { id: definition.id, material: definition.material, currentVolume: definition.initialVolume, integrity01: 1, value: definition.baseValue, compression01: 0 } });
assertSnapshot(snapshot);
const viewer = createRenderer({ canvas, onFatal: ({ code, message }) => report(`${code}: ${message}`) });
document.querySelector('#title')!.textContent = `REFLECTION / ${variant.toUpperCase()}`;
let frames = 0; let frameId = 0;
const resize = (): void => viewer.resize({ width: canvas.clientWidth, height: canvas.clientHeight, dpr: 1 });
const observer = new ResizeObserver(resize); observer.observe(canvas); resize();
const frame = (): void => { viewer.render(snapshot, 16); frames++; document.querySelector('#status')!.textContent = canvas.dataset['renderState'] ?? 'loading'; frameId = requestAnimationFrame(frame); };
frameId = requestAnimationFrame(frame);
window.addEventListener('error', ({ message }) => report(message)); window.addEventListener('unhandledrejection', ({ reason }) => report(String(reason)));
Object.assign(window, { __reflectionProbe: { get ready() { return installed && frames > 10 && alternative !== null; }, get errors() { return errors; }, get status() { return { ...canvas.dataset }; }, materials } });
const dispose = (): void => { cancelAnimationFrame(frameId); observer.disconnect(); viewer.dispose(); alternative?.dispose(); Mesh.prototype.onBeforeRender = original; };
window.addEventListener('pagehide', dispose, { once: true }); if (import.meta.hot) import.meta.hot.dispose(dispose);
