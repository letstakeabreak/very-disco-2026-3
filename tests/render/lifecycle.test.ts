import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BoxGeometry, Group, Mesh, MeshStandardMaterial, Texture } from 'three';
import type { WebGLProgramParametersWithUniforms, WebGLRenderer } from 'three';
import { SNAPSHOT_FIXTURES } from '../../src/contracts/fixtures';
import { deepFreeze } from '../../src/contracts/validate';
import type { GameSnapshot } from '../../src/contracts';
import { PRESS_ANCHORS } from '../../src/render/ram';

// Only device/IO boundaries are replaced. Scene graph, materials, deformation,
// snapshot interpretation and disposal use the real Three.js implementation.
const boundary = vi.hoisted(() => ({
  unavailable: false, drawError: false,
  loads: new Map<string, { resolve: (value: unknown) => void; reject: (error: Error) => void }>(),
  draw: vi.fn(), dispose: vi.fn(), pixelRatio: vi.fn(), size: vi.fn(),
}));
vi.mock('three', async (importOriginal) => {
  const actual = await importOriginal<typeof import('three')>();
  return { ...actual,
    WebGLRenderer: class {
      constructor() { if (boundary.unavailable) throw new Error('No GPU'); }
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
function canvas(): HTMLCanvasElement {
  return Object.assign(new EventTarget(), { dataset: {} }) as unknown as HTMLCanvasElement;
}
function model(isPress = false): { scene: Group; mesh: Mesh<BoxGeometry, MeshStandardMaterial> } {
  const scene = new Group(); const mesh = new Mesh(new BoxGeometry(0.1, 0.12, 0.1), new MeshStandardMaterial());
  mesh.geometry.translate(0, 0.06, 0);
  mesh.name = isPress ? 'press-ram-test' : 'specimen-test'; scene.add(mesh);
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
function uniform(mesh: Mesh<BoxGeometry, MeshStandardMaterial>, name: string): { value: number } {
  const shader = { uniforms: {}, vertexShader: '#include <begin_vertex>', fragmentShader: '#include <color_fragment>' } as WebGLProgramParametersWithUniforms;
  mesh.material.onBeforeCompile(shader, {} as WebGLRenderer);
  return shader.uniforms[name] as { value: number };
}
beforeEach(() => {
  boundary.loads.clear(); boundary.unavailable = false; boundary.drawError = false;
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

  it('snaps a cancelled stroke to committed shape on pause and stays fixed on repeated paused frames', async () => {
    const renderer = createRenderer({ canvas: canvas(), onFatal: vi.fn() }); const models = await finishLoading();
    const core = [...models.entries()].find(([url]) => url.includes('salvage-core'))![1];
    const compression = uniform(core.mesh, 'pressCompression');
    renderer.render(SNAPSHOT_FIXTURES.inspecting, 16); renderer.render(SNAPSHOT_FIXTURES.compressing, 16);
    expect(compression.value).toBeGreaterThan(0); expect(compression.value).toBeLessThan(0.4);
    const paused: GameSnapshot = deepFreeze({ ...SNAPSHOT_FIXTURES.compressing, phase: 'paused', resumePhase: 'inspecting', pressure01: 0 });
    renderer.render(paused, 16); expect(compression.value).toBe(0);
    for (let i = 0; i < 10; i += 1) renderer.render(paused, 100);
    expect(compression.value).toBe(0);
    renderer.render(SNAPSHOT_FIXTURES.compressing, 16); expect(compression.value).toBeGreaterThan(0);
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
      rotationRad: { x: 0, y: 0, z: 0 }, scale: { x: 2, y: 2, z: 2 } },
    ] }, 0);
    // Raising the specimen 3 cm in press space reduces the downward ram travel by 3 cm.
    expect(travel.value).toBeCloseTo(untransformedContact - 0.03, 7);
    renderer.dispose();
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
