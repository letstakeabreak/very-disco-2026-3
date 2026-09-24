import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { BoxGeometry, DirectionalLight, Euler, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, Plane, Quaternion, Raycaster, ShadowMaterial, Texture, Vector2, Vector3 } from 'three';
import type { Camera, Material, Object3D, Scene, WebGLProgramParametersWithUniforms, WebGLRenderer } from 'three';
import { WebGLShadowMap } from 'three/src/renderers/webgl/WebGLShadowMap.js';
import type { WebGLObjects } from 'three/src/renderers/webgl/WebGLObjects.js';
import type { WebGLCapabilities } from 'three/src/renderers/webgl/WebGLCapabilities.js';
import { SNAPSHOT_FIXTURES } from '../../src/contracts/fixtures';
import { deepFreeze } from '../../src/contracts/validate';
import type { GameSnapshot } from '../../src/contracts';
import { PRESS_ANCHORS, RAM_RETRACTED_TRAVEL } from '../../src/render/ram';

// Only device/IO boundaries are replaced. Scene graph, materials, deformation,
// snapshot interpretation and disposal use the real Three.js implementation.
const boundary = vi.hoisted(() => ({
  unavailable: false, drawError: false, gpu: null as unknown,
  loads: new Map<string, { resolve: (value: unknown) => void; reject: (error: Error) => void }>(),
  draw: vi.fn(), dispose: vi.fn(), pixelRatio: vi.fn(), size: vi.fn(),
}));
vi.mock('three', async (importOriginal) => {
  const actual = await importOriginal<typeof import('three')>();
  return { ...actual,
    WebGLRenderer: class {
      constructor() { if (boundary.unavailable) throw new Error('No GPU'); boundary.gpu = this; }
      shadowMap = {}; info = { autoReset: false, reset() {}, render: { triangles: 0, calls: 0 } };
      setClearColor() {} setViewport() {} clear() {} clearDepth() {}
      setPixelRatio = boundary.pixelRatio; setSize = boundary.size; dispose = boundary.dispose;
      render(...args: unknown[]) { if (boundary.drawError) throw new Error('Draw failed'); boundary.draw(...args); }
    },
    PMREMGenerator: class {
      fromScene() { return { texture: new actual.Texture(), dispose() {} }; }
      dispose() {}
    },
    TextureLoader: class { loadAsync(url: string) {
      return new Promise((resolve, reject) => boundary.loads.set(url, { resolve, reject }));
    } },
  };
});
vi.mock('three/addons/loaders/GLTFLoader.js', () => ({ GLTFLoader: class { loadAsync(url: string) {
  return new Promise((resolve, reject) => boundary.loads.set(url, { resolve, reject }));
} } }));
import { createRenderer } from '../../src/render';

const flush = async (): Promise<void> => { for (let i = 0; i < 8; i += 1) await Promise.resolve(); };
function dialLoad(): { url: string; pending: { resolve: (value: unknown) => void; reject: (error: Error) => void } } {
  const candidates = [...boundary.loads].filter(([url]) => !url.endsWith('.glb') && !url.endsWith('workshop-v4.webp'));
  expect(candidates).toHaveLength(1);
  const [url, pending] = candidates[0]!;
  return { url, pending };
}
function canvas(): HTMLCanvasElement {
  return Object.assign(new EventTarget(), { dataset: {} }) as unknown as HTMLCanvasElement;
}
function model(isPress = false): { scene: Group; mesh: Mesh<BoxGeometry, MeshStandardMaterial> } {
  const scene = new Group(); const mesh = new Mesh(new BoxGeometry(0.1, 0.12, 0.1), new MeshStandardMaterial());
  mesh.geometry.translate(0, 0.06, 0);
  mesh.name = isPress ? 'press-ram-test' : 'specimen-test'; scene.add(mesh);
  // Like the shipping press, the frame keeps the source material after the ram clones it.
  if (isPress) { const frame = new Mesh(mesh.geometry, mesh.material); frame.name = 'press-frame-test'; scene.add(frame); }
  return { scene, mesh };
}
async function finishLoading(): Promise<Map<string, ReturnType<typeof model>>> {
  const models = new Map<string, ReturnType<typeof model>>();
  for (const [url, pending] of boundary.loads) {
    if (url.endsWith('.glb')) {
      const item = model(url.includes('press-chamber')); models.set(url, item); pending.resolve({ scene: item.scene });
    } else pending.resolve(new Texture());
  }
  await flush(); return models;
}
function needleTip(scene: Object3D): Vector3 {
  const needle = scene.getObjectByName('pressure-needle');
  expect(needle).toBeInstanceOf(Group);
  needle!.updateWorldMatrix(true, true);
  const origin = needle!.getWorldPosition(new Vector3());
  let tip = new Vector3();
  needle!.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    const positions = object.geometry.getAttribute('position');
    for (let i = 0; i < positions.count; i += 1) {
      const point = new Vector3().fromBufferAttribute(positions, i).applyMatrix4(object.matrixWorld).sub(origin);
      if (point.lengthSq() > tip.lengthSq()) tip = point;
    }
  });
  expect(tip.length()).toBeGreaterThan(0.07);
  return tip.normalize();
}

function uniform(mesh: Mesh<BoxGeometry, MeshStandardMaterial>, name: string): { value: number } {
  const shader = { uniforms: {}, vertexShader: '#include <begin_vertex>', fragmentShader: '#include <color_fragment>' } as WebGLProgramParametersWithUniforms;
  mesh.material.onBeforeCompile(shader, {} as WebGLRenderer);
  return shader.uniforms[name] as { value: number };
}
function lastStageDraw(): [Scene, Camera] {
  return boundary.draw.mock.calls.filter(([scene]) => (scene as Object3D).getObjectByName('press-ram-test')).at(-1) as [Scene, Camera];
}
beforeEach(() => {
  boundary.loads.clear(); boundary.unavailable = false; boundary.drawError = false; boundary.gpu = null;
  vi.clearAllMocks();
});

describe('renderer lifecycle and cosmetic continuity (device/IO boundary doubles)', () => {
  it('reports unavailable WebGL and leaves a safe idempotent controller', () => {
    boundary.unavailable = true;
    const onFatal = vi.fn(); const renderer = createRenderer({ canvas: canvas(), onFatal });
    renderer.resize({ width: 390, height: 844, dpr: 2 }); renderer.render(SNAPSHOT_FIXTURES.idle, 16);
    renderer.dispose(); renderer.dispose();
    expect(onFatal).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ code: 'webgl-unavailable' }));
    expect(boundary.loads.size).toBe(0);
  });

  it('disposes late GLBs and their bitmaps after an early dispose, without reaching ready', async () => {
    const surface = canvas(); const onFatal = vi.fn(); const renderer = createRenderer({ canvas: surface, onFatal });
    renderer.dispose(); renderer.dispose();
    const item = model(); const bitmap = { close: vi.fn() }; const texture = new Texture(bitmap);
    item.mesh.material.map = texture;
    const geometryDispose = vi.spyOn(item.mesh.geometry, 'dispose'); const textureDispose = vi.spyOn(texture, 'dispose');
    const first = [...boundary.loads.values()][0]!; first.resolve({ scene: item.scene });
    for (const [url, pending] of [...boundary.loads].slice(1)) pending.resolve(url.endsWith('.glb') ? { scene: model().scene } : new Texture());
    await flush(); renderer.render(SNAPSHOT_FIXTURES.idle, 16);
    expect(surface.dataset['renderState']).toBe('disposed');
    expect(geometryDispose).toHaveBeenCalledTimes(1); expect(textureDispose).toHaveBeenCalledTimes(1);
    expect(bitmap.close).toHaveBeenCalledTimes(1); expect(boundary.dispose).toHaveBeenCalledTimes(1);
    expect(boundary.draw).not.toHaveBeenCalled(); expect(onFatal).not.toHaveBeenCalled();
  });

  it('reports a GLB rejection once and releases assets that arrive after the failure', async () => {
    const surface = canvas(); const onFatal = vi.fn(); const renderer = createRenderer({ canvas: surface, onFatal });
    const entries = [...boundary.loads]; entries[0]![1].reject(new Error('Missing press GLB'));
    await flush();
    const late = model(); const dispose = vi.spyOn(late.mesh.geometry, 'dispose');
    entries[1]![1].resolve({ scene: late.scene });
    for (const [url, pending] of entries.slice(2)) pending.resolve(url.endsWith('.glb') ? { scene: model().scene } : new Texture());
    await flush();
    expect(surface.dataset['renderState']).toBe('error');
    expect(onFatal).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ code: 'render-failed', message: expect.stringContaining('Missing press GLB') }));
    expect(dispose).toHaveBeenCalledTimes(1); renderer.dispose();
  });

  it('keeps the 3D stage loading until the dial texture joins the four models and workshop', async () => {
    const surface = canvas(); const onFatal = vi.fn(); const renderer = createRenderer({ canvas: surface, onFatal });
    const dial = dialLoad();
    for (const [url, pending] of boundary.loads) {
      if (url === dial.url) continue;
      pending.resolve(url.endsWith('.glb') ? { scene: model(url.includes('press-chamber')).scene } : new Texture());
    }
    await flush();
    expect(surface.dataset['loadedAssets']).toBe('4'); expect(surface.dataset['renderState']).toBe('loading');
    renderer.render(SNAPSHOT_FIXTURES.inspecting, 16);
    expect(boundary.draw.mock.calls.some(([scene]) => scene.getObjectByName('press-ram-test'))).toBe(false);
    dial.pending.resolve(new Texture()); await flush();
    expect(surface.dataset['renderState']).toBe('ready');
    renderer.render(SNAPSHOT_FIXTURES.inspecting, 16);
    expect(boundary.draw.mock.calls.some(([scene]) => scene.getObjectByName('press-ram-test'))).toBe(true);
    expect(onFatal).not.toHaveBeenCalled(); renderer.dispose();
  });

  it('reports a failed dial once even when another asset fails afterwards', async () => {
    const surface = canvas(); const onFatal = vi.fn(); const renderer = createRenderer({ canvas: surface, onFatal });
    const dial = dialLoad(); dial.pending.reject(new Error('Missing pressure dial')); await flush();
    expect(surface.dataset['renderState']).toBe('error');
    expect(onFatal).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ code: 'render-failed', message: expect.stringContaining('Missing pressure dial') }));
    for (const [url, pending] of boundary.loads) if (url !== dial.url) pending.reject(new Error('Later asset failure'));
    await flush(); renderer.render(SNAPSHOT_FIXTURES.inspecting, 16);
    expect(onFatal).toHaveBeenCalledTimes(1); expect(boundary.draw).not.toHaveBeenCalled(); renderer.dispose();
  });

  it('disposes a dial arriving after early shutdown instead of attaching it or becoming ready', async () => {
    const surface = canvas(); const onFatal = vi.fn(); const renderer = createRenderer({ canvas: surface, onFatal });
    const dial = dialLoad(); const texture = new Texture(); const dispose = vi.spyOn(texture, 'dispose');
    renderer.dispose(); renderer.dispose(); dial.pending.resolve(texture);
    for (const [url, pending] of boundary.loads) {
      if (url !== dial.url) pending.resolve(url.endsWith('.glb') ? { scene: model().scene } : new Texture());
    }
    await flush(); renderer.render(SNAPSHOT_FIXTURES.inspecting, 16);
    expect(dispose).toHaveBeenCalledTimes(1); expect(surface.dataset['renderState']).toBe('disposed');
    expect(boundary.draw).not.toHaveBeenCalled(); expect(onFatal).not.toHaveBeenCalled();
  });

  it('owns and disposes the loaded dial texture exactly once on repeated shutdown', async () => {
    const surface = canvas(); const renderer = createRenderer({ canvas: surface, onFatal: vi.fn() });
    const dial = dialLoad(); const texture = new Texture(); const dispose = vi.spyOn(texture, 'dispose');
    for (const [url, pending] of boundary.loads) {
      pending.resolve(url === dial.url ? texture : url.endsWith('.glb') ? { scene: model(url.includes('press-chamber')).scene } : new Texture());
    }
    await flush(); expect(surface.dataset['renderState']).toBe('ready'); expect(dispose).not.toHaveBeenCalled();
    renderer.dispose(); renderer.dispose(); expect(dispose).toHaveBeenCalledTimes(1);
  });

  it('accepts all immutable fixtures after assets are ready and enforces the DPR cap', async () => {
    const surface = canvas(); const onFatal = vi.fn(); const renderer = createRenderer({ canvas: surface, onFatal });
    await finishLoading();
    expect(surface.dataset['renderState']).toBe('ready'); expect(surface.dataset['loadedAssets']).toBe('4');
    renderer.resize({ width: 390, height: 844, dpr: 3 });
    expect(boundary.pixelRatio).toHaveBeenLastCalledWith(2);
    expect(boundary.size).toHaveBeenLastCalledWith(390, 844, false);
    for (const fixture of Object.values(SNAPSHOT_FIXTURES)) {
      const before = JSON.stringify(fixture); renderer.render(fixture, 16.7); expect(JSON.stringify(fixture)).toBe(before);
    }
    expect(boundary.draw).toHaveBeenCalled(); expect(onFatal).not.toHaveBeenCalled(); renderer.dispose();
  });

  it('points the actual needle left/up/right from pressure and snaps to a paused snapshot', async () => {
    const onFatal = vi.fn(); const renderer = createRenderer({ canvas: canvas(), onFatal }); await finishLoading();
    const tipAt = (snapshot: GameSnapshot): Vector3 => {
      const before = JSON.stringify(snapshot); renderer.render(snapshot, 16);
      expect(JSON.stringify(snapshot)).toBe(before);
      const stage = boundary.draw.mock.calls.map(([scene]) => scene as Object3D).reverse().find((scene) => scene.getObjectByName('pressure-needle'));
      expect(stage).toBeDefined();
      return needleTip(stage!);
    };
    const paused: GameSnapshot = deepFreeze({ ...SNAPSHOT_FIXTURES.settling, phase: 'paused', resumePhase: 'settling' });
    const firstPausedTip = tipAt(paused);
    expect(firstPausedTip.x).toBeCloseTo(0, 6); expect(firstPausedTip.y).toBeCloseTo(1, 6);
    // These three snapshots differ only in authoritative pressure; no renderer-side
    // volume, score, damage or compression rule should decide the needle direction.
    const tips = [0, 0.5, 1].map((pressure01) => tipAt(deepFreeze({ ...SNAPSHOT_FIXTURES.compressing, pressure01 })));
    expect(tips[0]!.x).toBeLessThan(-0.95); expect(tips[0]!.y).toBeGreaterThan(0);
    expect(tips[1]!.x).toBeCloseTo(0, 6); expect(tips[1]!.y).toBeCloseTo(1, 6);
    expect(tips[2]!.x).toBeGreaterThan(0.95); expect(tips[2]!.y).toBeGreaterThan(0);
    expect(tips[0]!.y).toBeCloseTo(tips[2]!.y, 6);
    const pausedTip = tipAt(paused);
    expect(pausedTip.distanceTo(tips[1]!)).toBeLessThan(1e-6);
    renderer.render(paused, 100); renderer.render(paused, 0);
    expect(tipAt(paused).distanceTo(pausedTip)).toBeLessThan(1e-6);
    const cancelled: GameSnapshot = deepFreeze({ ...SNAPSHOT_FIXTURES.inspecting, phase: 'paused', resumePhase: 'inspecting' });
    expect(tipAt(cancelled).distanceTo(tips[0]!)).toBeLessThan(1e-6);
    expect(onFatal).not.toHaveBeenCalled(); renderer.dispose();
  });

  it('snaps a cancelled stroke to committed shape on pause and stays fixed on repeated paused frames', async () => {
    const renderer = createRenderer({ canvas: canvas(), onFatal: vi.fn() }); const models = await finishLoading();
    const core = [...models.entries()].find(([url]) => url.includes('salvage-core'))![1];
    const compression = uniform(core.mesh, 'pressCompression');
    renderer.render(SNAPSHOT_FIXTURES.inspecting, 16);
    for (let i = 0; i < 15; i += 1) renderer.render(SNAPSHOT_FIXTURES.compressing, 16);
    expect(compression.value).toBeGreaterThan(0); expect(compression.value).toBeLessThan(0.4);
    const paused: GameSnapshot = deepFreeze({ ...SNAPSHOT_FIXTURES.compressing, phase: 'paused', resumePhase: 'inspecting', pressure01: 0 });
    renderer.render(paused, 16); expect(compression.value).toBe(0);
    for (let i = 0; i < 10; i += 1) renderer.render(paused, 100);
    expect(compression.value).toBe(0);
    renderer.render(SNAPSHOT_FIXTURES.compressing, 16); expect(compression.value).toBe(0);
    for (let i = 0; i < 15; i += 1) renderer.render(SNAPSHOT_FIXTURES.compressing, 16);
    expect(compression.value).toBeGreaterThan(0);
    renderer.dispose();
  });

  it('opens the inspection gap, follows contact, and retracts on release, cancel and restart', async () => {
    const renderer = createRenderer({ canvas: canvas(), onFatal: vi.fn() }); const models = await finishLoading();
    const press = [...models.entries()].find(([url]) => url.includes('press-chamber'))![1];
    const travel = uniform(press.mesh, 'ramTravel');
    renderer.render({ ...SNAPSHOT_FIXTURES.inspecting, tick: 10 }, 0);
    expect(travel.value).toBe(RAM_RETRACTED_TRAVEL);
    renderer.render({ ...SNAPSHOT_FIXTURES.compressing, tick: 11 }, 16);
    expect(travel.value).toBeGreaterThan(RAM_RETRACTED_TRAVEL); expect(travel.value).toBeLessThan(0);
    for (let i = 0; i < 15; i += 1) renderer.render({ ...SNAPSHOT_FIXTURES.compressing, tick: 11 }, 16);
    expect(travel.value).toBeGreaterThan(0);
    const contact = travel.value;
    const inspecting: GameSnapshot = { ...SNAPSHOT_FIXTURES.inspecting, tick: 12 };
    renderer.render(inspecting, 16);
    expect(travel.value).toBeLessThan(contact); expect(travel.value).toBeGreaterThan(RAM_RETRACTED_TRAVEL);
    const firstRetraction = travel.value;
    renderer.render(inspecting, 0); expect(travel.value).toBe(firstRetraction);
    for (let i = 0; i < 10; i += 1) renderer.render(inspecting, 100);
    expect(travel.value).toBeCloseTo(RAM_RETRACTED_TRAVEL, 6);
    renderer.render({ ...SNAPSHOT_FIXTURES.compressing, tick: 13 }, 16);
    const paused: GameSnapshot = { ...inspecting, tick: 14, phase: 'paused', resumePhase: 'inspecting' };
    renderer.render(paused, 0); expect(travel.value).toBe(RAM_RETRACTED_TRAVEL);
    renderer.render(paused, 100); expect(travel.value).toBe(RAM_RETRACTED_TRAVEL);
    renderer.render({ ...SNAPSHOT_FIXTURES.compressing, tick: 15 }, 16);
    renderer.render(SNAPSHOT_FIXTURES.idle, 0); expect(travel.value).toBe(RAM_RETRACTED_TRAVEL);
    renderer.dispose();
  });

  it('approaches continuously without compressing in mid-air, then keeps the platen on the surface', async () => {
    const renderer = createRenderer({ canvas: canvas(), onFatal: vi.fn() }); const models = await finishLoading();
    const core = [...models.entries()].find(([url]) => url.includes('salvage-core'))![1];
    const press = [...models.entries()].find(([url]) => url.includes('press-chamber'))![1];
    const compression = uniform(core.mesh, 'pressCompression'); const travel = uniform(press.mesh, 'ramTravel');
    const inspecting = deepFreeze({ ...SNAPSHOT_FIXTURES.inspecting, tick: 10 });
    const pressing = deepFreeze({ ...SNAPSHOT_FIXTURES.compressing, tick: 11 });
    renderer.render(inspecting, 0);
    const gap = (): number => PRESS_ANCHORS.platenY - travel.value -
      (PRESS_ANCHORS.workbedY + PRESS_ANCHORS.clearance + core.mesh.geometry.boundingBox!.max.y * 1.1 * (1 - compression.value * 0.52));
    const initialGap = gap(); let previousTravel = travel.value; let touching = false;
    for (let frame = 0; frame < 30; frame += 1) {
      renderer.render(pressing, 16);
      if (frame === 0) { expect(gap()).toBeGreaterThan(initialGap * 0.8); expect(compression.value).toBe(0); }
      expect(gap()).toBeGreaterThanOrEqual(-1e-7);
      if (gap() > 1e-7) {
        expect(compression.value).toBe(0);
        expect(travel.value - previousTravel).toBeCloseTo(0.7 * 0.016, 7);
      } else { touching = true; expect(gap()).toBeCloseTo(0, 7); }
      previousTravel = travel.value;
      const still = [travel.value, compression.value];
      renderer.render(pressing, 0); expect([travel.value, compression.value]).toEqual(still);
    }
    expect(initialGap).toBeGreaterThan(0.1); expect(touching).toBe(true);
    expect(compression.value).toBeGreaterThan(0.39);
    renderer.dispose();
  });

  it('uses only time remaining after approach and preserves a short release through settling', async () => {
    const renderer = createRenderer({ canvas: canvas(), onFatal: vi.fn() }); const models = await finishLoading();
    const core = [...models.entries()].find(([url]) => url.includes('salvage-core'))![1];
    const press = [...models.entries()].find(([url]) => url.includes('press-chamber'))![1];
    const compression = uniform(core.mesh, 'pressCompression'); const travel = uniform(press.mesh, 'ramTravel');
    const sample = (steps: number[]): number[] => {
      renderer.render({ ...SNAPSHOT_FIXTURES.inspecting, tick: 0 }, 0);
      for (const dt of steps) renderer.render({ ...SNAPSHOT_FIXTURES.compressing, tick: 1 }, dt);
      return [travel.value, compression.value];
    };
    const slow = sample([100, 100, 100]);
    for (const count of [9, 18, 36]) {
      const fast = sample(Array<number>(count).fill(300 / count));
      expect(fast[0]).toBeCloseTo(slow[0]!, 7); expect(fast[1]).toBeCloseTo(slow[1]!, 7);
    }
    renderer.render({ ...SNAPSHOT_FIXTURES.inspecting, tick: 0 }, 0);
    renderer.render({ ...SNAPSHOT_FIXTURES.compressing, tick: 1, pressure01: 0.03 }, 16);
    expect(compression.value).toBe(0);
    for (let i = 0; i < 3; i += 1) renderer.render({ ...SNAPSHOT_FIXTURES.settling, tick: 2, pressure01: 0.03 }, 100);
    expect(compression.value).toBeGreaterThan(0.025); expect(compression.value).toBeLessThan(0.03);
    expect(travel.value).toBeGreaterThan(0);
    renderer.dispose();
  });

  it('starts a paused settling scene at its committed shape and ram contact, with no first-frame drift', async () => {
    const renderer = createRenderer({ canvas: canvas(), onFatal: vi.fn() }); const models = await finishLoading();
    const core = [...models.entries()].find(([url]) => url.includes('salvage-core'))![1];
    const press = [...models.entries()].find(([url]) => url.includes('press-chamber'))![1];
    const compression = uniform(core.mesh, 'pressCompression'); const travel = uniform(press.mesh, 'ramTravel');
    const paused: GameSnapshot = deepFreeze({ ...SNAPSHOT_FIXTURES.settling, phase: 'paused', resumePhase: 'settling' });
    renderer.render(paused, 0);
    expect(compression.value).toBe(0.5); expect(travel.value).toBeGreaterThan(0);
    const firstTravel = travel.value;
    renderer.render(paused, 100); expect(travel.value).toBe(firstTravel); expect(compression.value).toBe(0.5);
    renderer.dispose();
  });

  it('does not reuse the previous run stored look after seed or tick reset', async () => {
    const renderer = createRenderer({ canvas: canvas(), onFatal: vi.fn() }); const models = await finishLoading();
    const core = [...models.entries()].find(([url]) => url.includes('salvage-core'))![1]; const compression = uniform(core.mesh, 'pressCompression');
    const pressed: GameSnapshot = deepFreeze({ ...SNAPSHOT_FIXTURES.settling, tick: 100, pressure01: 0.9 });
    renderer.render(pressed, 100);
    renderer.render({ ...SNAPSHOT_FIXTURES.stored, tick: 101 }, 100); expect(compression.value).toBeCloseTo(0.9);
    // A synthetic stored fixture has no committed-shape history in a new run.
    for (let i = 0; i < 20; i += 1) renderer.render({ ...SNAPSHOT_FIXTURES.stored, seed: pressed.seed + 1, tick: 0 }, 100);
    expect(compression.value).toBeCloseTo(0.55, 5);
    renderer.render({ ...pressed, seed: pressed.seed + 1 }, 100);
    for (let i = 0; i < 20; i += 1) renderer.render({ ...SNAPSHOT_FIXTURES.stored, seed: pressed.seed + 1, tick: 0 }, 100);
    expect(compression.value).toBeCloseTo(0.55, 5); renderer.dispose();
  });

  it('keeps contact in press-local meters when the press or active specimen entity transforms', async () => {
    const renderer = createRenderer({ canvas: canvas(), onFatal: vi.fn() }); const models = await finishLoading();
    const press = [...models.entries()].find(([url]) => url.includes('press-chamber'))![1];
    const travel = uniform(press.mesh, 'ramTravel');
    const paused: GameSnapshot = deepFreeze({ ...SNAPSHOT_FIXTURES.settling, phase: 'paused', resumePhase: 'settling' });
    renderer.render(paused, 0); const untransformedContact = travel.value;
    renderer.render({ ...paused, entities: [{ id: 'press', assetId: 'press-chamber',
      position: { x: 0.7, y: 0.2, z: -0.3 }, rotationRad: { x: 0.15, y: 0.4, z: 0.08 }, scale: { x: 2, y: 2, z: 2 } }] }, 0);
    expect(travel.value).toBeCloseTo(untransformedContact, 7);
    renderer.render({ ...paused, entities: [
      { id: 'press', assetId: 'press-chamber', position: { x: 0, y: 0.2, z: 0 }, rotationRad: { x: 0, y: 0, z: 0 }, scale: { x: 2, y: 2, z: 2 } },
      { id: 'raised-core', assetId: 'salvage-core', position: { x: PRESS_ANCHORS.x * 2,
        y: 0.2 + (PRESS_ANCHORS.workbedY + PRESS_ANCHORS.clearance + 0.03) * 2, z: PRESS_ANCHORS.z * 2 },
      rotationRad: { x: 0, y: 0, z: 0 }, scale: { x: 2.2, y: 2.2, z: 2.2 } },
    ] }, 0);
    // Raising the specimen 3 cm in press space reduces the downward ram travel by 3 cm.
    expect(travel.value).toBeCloseTo(untransformedContact - 0.03, 7);
    renderer.dispose();
  });

  it('keeps a stored specimen committed shape and damage while another specimen is inspected', async () => {
    const renderer = createRenderer({ canvas: canvas(), onFatal: vi.fn() }); const models = await finishLoading();
    const core = [...models.entries()].find(([url]) => url.includes('salvage-core'))![1];
    const compression = uniform(core.mesh, 'pressCompression'); const damage = uniform(core.mesh, 'pressDamage');
    const committed: GameSnapshot = deepFreeze({ ...SNAPSHOT_FIXTURES.paused, tick: 50,
      pressure01: 0.95, currentSpecimen: { ...SNAPSHOT_FIXTURES.inspecting.currentSpecimen!, compression01: 0.7, integrity01: 0.65 } });
    renderer.render(committed, 0);
    const stored: GameSnapshot = deepFreeze({ ...SNAPSHOT_FIXTURES.stored, tick: 51 });
    renderer.render(stored, 0);
    const storedRotation = core.scene.quaternion.clone();
    expect(compression.value).toBeCloseTo(0.7); expect(damage.value).toBeCloseTo(0.35);
    for (const pressure01 of [0, 0.2, 0.9]) {
      renderer.render(deepFreeze({ ...stored, tick: 52, phase: 'paused', resumePhase: 'inspecting', pressure01,
        currentSpecimen: { id: 'salvage-lens', material: 'glass', currentVolume: 0.5, integrity01: 0.9, value: 100, compression01: 0.2 } }), 100);
      expect(compression.value).toBeCloseTo(0.7); expect(damage.value).toBeCloseTo(0.35);
      expect(core.scene.quaternion.angleTo(storedRotation)).toBeLessThan(1e-7);
    }
    renderer.dispose();
  });

  it('centers stored models inside the measured image apertures and restores their pose after entity overrides', async () => {
    const renderer = createRenderer({ canvas: canvas(), onFatal: vi.fn() }); const models = await finishLoading();
    const core = [...models.entries()].find(([url]) => url.includes('salvage-core'))![1];
    // Use zero committed deformation so the actual fixture mesh bounds are the visible bounds.
    renderer.render({ ...SNAPSHOT_FIXTURES.paused, tick: 10 }, 0);
    const measured = JSON.parse(readFileSync('docs/handoffs/B/layout-study/foreground-case-measurements.json', 'utf8')) as {
      measurements: { normalizedQuadrilaterals: [number, number][][] };
    };
    const checkAperture = (slot: number): void => {
      const [, camera] = lastStageDraw(); core.scene.updateMatrixWorld(true);
      core.mesh.geometry.computeBoundingBox();
      const center = core.mesh.geometry.boundingBox!.getCenter(new Vector3());
      center.applyMatrix4(core.mesh.matrixWorld).project(camera);
      const point = [(center.x + 1) / 2, (1 - center.y) / 2];
      const polygon = measured.measurements.normalizedQuadrilaterals[slot]!;
      for (const coordinate of polygon.flat()) { expect(coordinate).toBeGreaterThan(0); expect(coordinate).toBeLessThan(1); }
      const crosses = polygon.map((a, i) => { const b = polygon[(i + 1) % polygon.length]!;
        return (b[0] - a[0]) * (point[1]! - a[1]) - (b[1] - a[1]) * (point[0]! - a[0]); });
      expect(crosses.every(value => value > 0) || crosses.every(value => value < 0)).toBe(true);
      expect(new Vector3(0, 0, 1).applyQuaternion(core.scene.quaternion).y).toBeGreaterThan(0.99);
    };
    renderer.render({ ...SNAPSHOT_FIXTURES.stored, tick: 11 }, 0); checkAperture(0);
    const stored: GameSnapshot = deepFreeze({ ...SNAPSHOT_FIXTURES.complete, tick: 12, storedSpecimenIds: ['salvage-lens','salvage-core'] });
    renderer.render(stored, 0); checkAperture(1);
    renderer.render({ ...stored, storedSpecimenIds: ['salvage-lens','salvage-cassette','salvage-core'] }, 0); checkAperture(2);
    renderer.render(stored, 0);
    const position = core.scene.position.clone(); const rotation = core.scene.quaternion.clone(); const scale = core.scene.scale.clone();
    const override = { id: 'placed-core', assetId: 'salvage-core' as const, position: { x: -0.3, y: 0.8, z: 0.6 },
      rotationRad: { x: 0.2, y: -0.4, z: 0.6 }, scale: { x: 1.2, y: 0.8, z: 0.9 } };
    renderer.render(deepFreeze({ ...stored, entities: [override] }), 0);
    expect(core.scene.position.toArray()).toEqual([-0.3, 0.8, 0.6]); expect(core.scene.scale.toArray()).toEqual([1.2, 0.8, 0.9]);
    const explicitRotation = new Quaternion().setFromEuler(new Euler(0.2, -0.4, 0.6, 'XYZ'));
    expect(core.scene.quaternion.angleTo(explicitRotation)).toBeLessThan(1e-7);
    renderer.render(stored, 0);
    expect(core.scene.position.distanceTo(position)).toBeLessThan(1e-9); expect(core.scene.scale.distanceTo(scale)).toBeLessThan(1e-9);
    expect(core.scene.quaternion.angleTo(rotation)).toBeLessThan(1e-7); checkAperture(1);
    renderer.dispose();
  });

  it('occludes below the measured foam mouth while leaving the three apertures open', async () => {
    const renderer = createRenderer({ canvas: canvas(), onFatal: vi.fn() }); await finishLoading();
    renderer.render(SNAPSHOT_FIXTURES.stored, 0);
    const [scene, camera] = lastStageDraw(); scene.updateMatrixWorld(true); camera.updateMatrixWorld(true);
    const depth = scene.getObjectByName('case-foam-depth') as Mesh;
    expect(depth.material).toBeInstanceOf(MeshBasicMaterial);
    expect((depth.material as MeshBasicMaterial).colorWrite).toBe(false);
    expect((depth.material as MeshBasicMaterial).depthWrite).toBe(true);
    const ray = new Raycaster(); const mouth = new Plane(new Vector3(0, 1, 0), -0.22);
    const sample = (x: number, y: number): { distance: number; hit: number | undefined } => {
      ray.setFromCamera(new Vector2(x / 1024 * 2 - 1, 1 - y / 1536 * 2), camera);
      const point = ray.ray.intersectPlane(mouth, new Vector3())!;
      return { distance: ray.ray.origin.distanceTo(point), hit: ray.intersectObject(depth)[0]?.distance };
    };
    // Independently measured foam between openings versus the centers of each opening.
    const foam = sample(616, 1137); expect(foam.hit).toBeCloseTo(foam.distance, 6);
    for (const x of [534, 694, 855]) {
      const aperture = sample(x, 1137);
      // A below-mouth cavity wall may be hit later; no cap may fill the aperture.
      expect(aperture.hit === undefined || aperture.hit > aperture.distance + 0.005).toBe(true);
    }
    expect(sample(300, 1137).hit).toBeUndefined();
    const releaseGeometry = vi.spyOn(depth.geometry, 'dispose');
    const releaseMaterial = vi.spyOn(depth.material as MeshBasicMaterial, 'dispose');
    renderer.dispose(); renderer.dispose();
    expect(releaseGeometry).toHaveBeenCalledTimes(1); expect(releaseMaterial).toHaveBeenCalledTimes(1);
  });

  it('passes worktop clipping into real Three shadow materials and releases ram and cached frame depth materials', async () => {
    const renderer = createRenderer({ canvas: canvas(), onFatal: vi.fn() }); const models = await finishLoading();
    renderer.render(SNAPSHOT_FIXTURES.settling, 0);
    const [scene, camera] = lastStageDraw(); scene.updateMatrixWorld(true);
    const receivers: Mesh[] = [];
    scene.traverse(object => { if (object instanceof Mesh && object.material instanceof ShadowMaterial) receivers.push(object); });
    expect(receivers).toHaveLength(2);
    for (const receiver of receivers) expect(receiver.receiveShadow).toBe(true);
    const press = [...models.entries()].find(([url]) => url.includes('press-chamber'))![1];
    const ram = press.mesh; const frame = press.scene.getObjectByName('press-frame-test') as Mesh<BoxGeometry, MeshStandardMaterial>;
    frame.frustumCulled = false;
    expect(ram.material).not.toBe(frame.material);
    expect(ram.material.clippingPlanes).toHaveLength(1);
    const plane = ram.material.clippingPlanes![0]!;
    expect(plane.distanceToPoint(new Vector3(0, 0, 0))).toBeLessThan(0);
    expect(plane.distanceToPoint(new Vector3(0, 2, 0))).toBeGreaterThan(0);
    const shadowDraw = vi.fn();
    // Execute Three's real material-selection/cache path, replacing only GPU calls.
    const device = {
      localClippingEnabled: (boundary.gpu as WebGLRenderer).localClippingEnabled,
      getRenderTarget: () => null, getActiveCubeFace: () => 0, getActiveMipmapLevel: () => 0,
      setRenderTarget() {}, clear() {}, renderBufferDirect: shadowDraw,
      state: { setBlending() {}, setScissorTest() {}, viewport() {},
        buffers: { color: { setClear() {} }, depth: { getReversed: () => false, setTest() {} } } },
    };
    expect(device.localClippingEnabled).toBe(true);
    const shadowMap = new WebGLShadowMap(device as unknown as WebGLRenderer,
      { update: (object: Mesh) => object.geometry } as WebGLObjects, { maxTextureSize: 2048 } as WebGLCapabilities);
    shadowMap.enabled = true;
    const lights: DirectionalLight[] = []; scene.traverse(object => { if (object instanceof DirectionalLight && object.castShadow) lights.push(object); });
    shadowMap.render(lights, scene, camera);
    const ramDepth = shadowDraw.mock.calls.find(([, , , , object]) => object === ram)![3] as Material;
    const frameDepth = shadowDraw.mock.calls.find(([, , , , object]) => object === frame)![3] as Material;
    expect(ramDepth).toBe(ram.customDepthMaterial);
    for (const depth of [ramDepth, frameDepth]) { expect(depth.clippingPlanes).toHaveLength(1); expect(depth.clippingPlanes![0]).toBe(plane); expect(depth.clipShadows).toBe(true); }
    const depthShader = { uniforms: {}, vertexShader: '#include <begin_vertex>', fragmentShader: '' } as WebGLProgramParametersWithUniforms;
    ramDepth.onBeforeCompile(depthShader, device as unknown as WebGLRenderer);
    expect(depthShader.uniforms['ramTravel']).toBe(uniform(ram, 'ramTravel'));
    const disposeRamDepth = vi.spyOn(ramDepth, 'dispose'); const disposeFrameDepth = vi.spyOn(frameDepth, 'dispose');
    const disposeRam = vi.spyOn(ram.material, 'dispose'); const disposeFrame = vi.spyOn(frame.material, 'dispose');
    renderer.dispose(); renderer.dispose();
    for (const dispose of [disposeRamDepth, disposeFrameDepth, disposeRam, disposeFrame]) expect(dispose).toHaveBeenCalledTimes(1);
  });

  it('reports context loss once and detaches its listener on disposal', async () => {
    const surface = canvas(); const onFatal = vi.fn(); const renderer = createRenderer({ canvas: surface, onFatal });
    await finishLoading(); const event = new Event('webglcontextlost', { cancelable: true });
    surface.dispatchEvent(event); surface.dispatchEvent(new Event('webglcontextlost'));
    expect(event.defaultPrevented).toBe(true); expect(onFatal).toHaveBeenCalledTimes(1);
    expect(surface.dataset['renderState']).toBe('error');
    renderer.dispose(); surface.dispatchEvent(new Event('webglcontextlost')); expect(onFatal).toHaveBeenCalledTimes(1);
  });

  it('reports a draw failure once and ignores subsequent frame and resize calls', async () => {
    const surface = canvas(); const onFatal = vi.fn(); const renderer = createRenderer({ canvas: surface, onFatal });
    await finishLoading(); boundary.drawError = true;
    renderer.render(SNAPSHOT_FIXTURES.idle, 16); renderer.render(SNAPSHOT_FIXTURES.idle, 16);
    renderer.resize({ width: 390, height: 844, dpr: 2 });
    expect(onFatal).toHaveBeenCalledTimes(1); expect(surface.dataset['renderState']).toBe('error');
    expect(boundary.size).not.toHaveBeenCalled(); renderer.dispose();
  });
});
