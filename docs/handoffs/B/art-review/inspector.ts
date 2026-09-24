import { ACESFilmicToneMapping, AmbientLight, Box3, DirectionalLight, Mesh, MeshLambertMaterial,
  MeshStandardMaterial, PerspectiveCamera, PlaneGeometry, PMREMGenerator, Scene, ShadowMaterial,
  SRGBColorSpace, TextureLoader, Vector3, WebGLRenderer } from 'three';
import type { Object3D, Texture, WebGLRenderTarget } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import type { GameRenderer } from '../../../../src/contracts';
import { createGauge } from '../../../../src/render/gauge';

/** Documentation-only static asset inspection, not an alternate game renderer.
 * Loads the exact shipping GLB. Geometry and embedded PBR maps are not replaced.
 * Neutral studio background and a front-left camera expose the reference side.
 */
export function createInspector(canvas: HTMLCanvasElement, id: 'salvage-cassette' | 'press-chamber', onError: (message: string) => void): GameRenderer {
  const gpu = new WebGLRenderer({ canvas, antialias: true, alpha: false });
  gpu.outputColorSpace = SRGBColorSpace; gpu.toneMapping = ACESFilmicToneMapping; gpu.toneMappingExposure = 0.95;
  gpu.setClearColor('#737a80'); gpu.shadowMap.enabled = true;
  const scene = new Scene(); const camera = new PerspectiveCamera(28, 1, 0.01, 100);
  let object: Object3D | null = null; let environment: WebGLRenderTarget | null = null; let disposed = false; let dial: Texture | null = null;
  const resources: Object3D[] = [];
  const center = new Vector3(); const bounds = new Box3(); let radius = 1;
  const direction = new Vector3(...(id === 'salvage-cassette' ? [-2, 1.6, 4] as const : [-1.5, 1.3, 4] as const)).normalize();
  canvas.dataset['renderState'] = 'loading'; canvas.dataset['viewer'] = 'independent-static-asset';
  canvas.dataset['assetId'] = id; canvas.dataset['runtimePath'] = `assets/models/${id}.glb`;
  const fail = (message: string): void => { if (!disposed) { canvas.dataset['renderState'] = 'error'; onError(message); } };
  const lost = (event: Event): void => { event.preventDefault(); fail('Asset inspector WebGL context lost'); };
  canvas.addEventListener('webglcontextlost', lost);
  scene.add(new AmbientLight('#d2d4d3', 0.12));
  const key = new DirectionalLight('#ffe1ac', 2.6); key.position.set(-1.8, 2.8, 2); key.castShadow = true;
  key.shadow.mapSize.set(1024,1024); key.shadow.normalBias = 0.003; scene.add(key, key.target);
  const rim = new DirectionalLight('#b4cbda',1.2); rim.position.set(1.2,1.7,-1.2); scene.add(rim);
  const fill = new DirectionalLight('#abc5ca',0.3); fill.position.set(0.2,1.8,3.5); scene.add(fill);
  const floor = new Mesh(new PlaneGeometry(20,20),new ShadowMaterial({ opacity: 0.23 }));
  floor.rotation.x = -Math.PI/2; floor.position.y = -0.001; floor.receiveShadow = true; scene.add(floor); resources.push(floor);
  const generator = new PMREMGenerator(gpu); const room = new RoomEnvironment();
  room.traverse((part) => {
    if (!(part instanceof Mesh)) return;
    if (part.material instanceof MeshLambertMaterial && part.material.emissiveIntensity > 2) {
      part.material.emissive.set(part.position.x < -8 || part.position.z > 8 ? '#ffe2ba' : '#edf3ff');
      if (Math.abs(part.position.x) > 8) part.scale.z *= 0.45;
      else if (Math.abs(part.position.z) > 8) part.scale.x *= 0.45;
    } else if (part.material instanceof MeshStandardMaterial) part.material.color.multiplyScalar(0.35);
  });
  environment = generator.fromScene(room,0.02); scene.environment = environment.texture; scene.environmentIntensity = 1;
  room.dispose(); generator.dispose();
  function fit(): void {
    const half = Math.min(camera.fov * Math.PI / 360, Math.atan(Math.tan(camera.fov * Math.PI / 360) * camera.aspect));
    let distance = radius / Math.sin(half);
    camera.updateProjectionMatrix();
    // Fit the actual bounds with a six-percent border, preserving the chosen view direction.
    for (let attempt=0;attempt<3;attempt+=1) {
      camera.position.copy(center).addScaledVector(direction,distance); camera.lookAt(center); camera.updateMatrixWorld(true);
      if (!object) break;
      let extent=0;
      for (const x of [bounds.min.x,bounds.max.x]) for (const y of [bounds.min.y,bounds.max.y]) for (const z of [bounds.min.z,bounds.max.z]) {
        const point=new Vector3(x,y,z).project(camera); extent=Math.max(extent,Math.abs(point.x),Math.abs(point.y));
      }
      distance*=extent/0.88;
    }
    camera.position.copy(center).addScaledVector(direction,distance); camera.lookAt(center); camera.updateMatrixWorld(true);
  }
  function release(roots: readonly Object3D[], extraTextures: readonly Texture[] = []): void {
    const geometries = new Set<import('three').BufferGeometry>(); const materials = new Set<import('three').Material>(); const textures = new Set<Texture>(extraTextures); const images = new Set<{ close(): void }>();
    for (const root of roots) root.traverse((part) => { if (!(part instanceof Mesh)) return; geometries.add(part.geometry);
      for (const material of Array.isArray(part.material) ? part.material : [part.material]) materials.add(material); });
    for (const material of materials) { for (const value of Object.values(material)) if (value && typeof value === 'object' && 'isTexture' in value) textures.add(value as Texture); material.dispose(); }
    for (const geometry of geometries) geometry.dispose();
    for (const texture of textures) { const image = texture.source.data as unknown;
      if (image && typeof image === 'object' && 'close' in image && typeof image.close === 'function') images.add(image as { close(): void }); texture.dispose(); }
    for (const image of images) image.close();
  }
  const dialLoad = id === 'press-chamber' ? new TextureLoader().loadAsync(`${import.meta.env.BASE_URL}assets/textures/pressure-dial.webp`).then(texture => {
    if (disposed) { texture.dispose(); return; } dial=texture; dial.colorSpace=SRGBColorSpace;
  }) : Promise.resolve();
  void Promise.all([new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}assets/models/${id}.glb`),dialLoad]).then(([{ scene: root }]) => {
    if (disposed) { release([root]); return; }
    object = root; resources.push(root); scene.add(root);
    let triangles = 0; let materialCount = 0;
    const prepared = new Set<MeshStandardMaterial>();
    root.traverse((part) => { if (!(part instanceof Mesh)) return;
      part.castShadow = true; part.receiveShadow = true;
      triangles += (part.geometry.index?.count ?? part.geometry.getAttribute('position').count) / 3;
      for (const material of Array.isArray(part.material) ? part.material : [part.material]) {
        materialCount += 1; if (!(material instanceof MeshStandardMaterial) || prepared.has(material)) continue;
        prepared.add(material);
        material.envMapIntensity = 1.35; if (id === 'press-chamber') material.roughness *= 0.72;
        if (material.normalMap) material.normalScale.set(0.55,0.55);
      }
    });
    if (dial) { const gauge=createGauge(dial); gauge.setPressure(0); root.add(gauge.root); canvas.dataset['gauge']='production createGauge / pressure 0'; }
    bounds.setFromObject(root); bounds.getCenter(center);
    radius = bounds.getSize(new Vector3()).length() / 2;
    key.target.position.copy(center); fit();
    canvas.dataset['triangles'] = String(triangles); canvas.dataset['materialCount'] = String(materialCount);
    canvas.dataset['cameraDirection'] = direction.toArray().join(','); canvas.dataset['renderState'] = 'ready';
  }).catch((error: unknown) => fail(String(error)));
  return {
    resize({width,height,dpr}) { if (disposed || width<=0 || height<=0) return; camera.aspect=width/height; gpu.setPixelRatio(Math.min(2,dpr)); gpu.setSize(width,height,false); fit(); },
    render() { if (disposed || !object) return; gpu.render(scene,camera); canvas.dataset['drawCalls'] = String(gpu.info.render.calls); },
    dispose() { if (disposed) return; disposed=true; canvas.dataset['renderState']='disposed'; canvas.removeEventListener('webglcontextlost',lost);
      release(resources,dial?[dial]:[]); environment?.dispose(); key.shadow.dispose(); gpu.dispose(); },
  };
}
