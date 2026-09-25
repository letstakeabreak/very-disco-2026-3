import { ACESFilmicToneMapping, AmbientLight, Box3, DirectionalLight, Mesh, MeshLambertMaterial,
  MeshStandardMaterial, MeshPhysicalMaterial, ShaderChunk, PerspectiveCamera, PlaneGeometry, PMREMGenerator, Scene, ShadowMaterial,
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
export function createInspector(canvas: HTMLCanvasElement, id: 'salvage-cassette' | 'press-chamber', onError: (message: string) => void, variant: 'baseline' | 'reflection' | 'amber' | 'amber-opaque'): GameRenderer {
  const gpu = new WebGLRenderer({ canvas, antialias: true, alpha: false });
  gpu.outputColorSpace = SRGBColorSpace; gpu.toneMapping = ACESFilmicToneMapping; gpu.toneMappingExposure = 0.95;
  gpu.setClearColor('#737a80'); gpu.shadowMap.enabled = true;
  const enhanced = variant !== 'baseline';
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
  scene.add(new AmbientLight(enhanced ? '#d2d4d3' : '#7bb6bf', enhanced ? 0.12 : 0.35));
  const key = new DirectionalLight('#ffe1ac', enhanced ? 2.6 : 3.2); key.position.set(-1.8, 2.8, 2); key.castShadow = true;
  key.shadow.mapSize.set(1024,1024); key.shadow.normalBias = 0.003; scene.add(key, key.target);
  const rim = new DirectionalLight(enhanced ? '#b4cbda' : '#67b4c6', enhanced ? 1.2 : 2.3); rim.position.set(1.2,1.7,-1.2); scene.add(rim);
  const fill = new DirectionalLight('#abc5ca', enhanced ? 0.3 : 0.8); fill.position.set(0.2,1.8,3.5); scene.add(fill);
  const floor = new Mesh(new PlaneGeometry(20,20),new ShadowMaterial({ opacity: 0.23 }));
  floor.rotation.x = -Math.PI/2; floor.position.y = -0.001; floor.receiveShadow = true; scene.add(floor); resources.push(floor);
  const generator = new PMREMGenerator(gpu); const room = new RoomEnvironment();
  room.traverse((part) => {
    if (!(part instanceof Mesh) || !(part.material instanceof MeshLambertMaterial)) return;
    if (!enhanced) { part.material.emissive.set(part.position.x < -8 ? '#ffd095' : part.position.x > 8 ? '#70bdce' : '#c1d5d6'); return; }
    // Studio lighting cards only; none is visible asset or added internal model geometry.
    if (part.material.emissiveIntensity > 2) {
      part.material.emissive.set(part.position.x < -8 ? '#ffe2ba' : '#edf3ff');
      if (Math.abs(part.position.x) > 8) part.scale.z *= 0.45;
      else if (Math.abs(part.position.z) > 8) part.scale.x *= 0.45;
    } else part.material.color.multiplyScalar(0.35);
  });
  environment = generator.fromScene(room, enhanced ? 0.02 : 0.06); scene.environment = environment.texture; scene.environmentIntensity = enhanced ? 1 : 0.75;
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
    const replacement = new Map<MeshStandardMaterial, MeshStandardMaterial>();
    const actual: Record<string, unknown>[] = [];
    root.traverse((part) => { if (!(part instanceof Mesh)) return;
      part.castShadow = true; part.receiveShadow = true;
      triangles += (part.geometry.index?.count ?? part.geometry.getAttribute('position').count) / 3;
      const mapMaterial = (material: import('three').Material): import('three').Material => {
        materialCount += 1; if (!(material instanceof MeshStandardMaterial)) return material;
        if (replacement.has(material)) return replacement.get(material)!;
        let result: MeshStandardMaterial = material;
        if (variant.startsWith('amber') && id === 'salvage-cassette') {
          const physical = new MeshPhysicalMaterial({ name: 'study-amber-dielectric', map: material.map,
            color: material.color, roughnessMap: material.roughnessMap, metalnessMap: material.metalnessMap,
            normalMap: material.normalMap, normalScale: material.normalScale, aoMap: material.aoMap,
            roughness: material.roughness, metalness: material.metalness, side: material.side,
            clearcoat: 1, clearcoatRoughness: 0.08, transmission: variant === 'amber' ? 0.45 : 0, thickness: 0.018, ior: 1.48 });
          physical.onBeforeCompile = (shader) => {
            shader.vertexShader = 'varying vec3 vStudyPosition;\n' + shader.vertexShader;
            shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvStudyPosition = position;');
            shader.fragmentShader = 'varying vec3 vStudyPosition;\n' + shader.fragmentShader;
            shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
              float studyAmber = smoothstep(1.28, 1.5, diffuseColor.r / max(diffuseColor.g, 0.001))
                * smoothstep(1.3, 1.6, diffuseColor.g / max(diffuseColor.b, 0.001))
                * smoothstep(0.06, 0.12, diffuseColor.r)
                * (1.0 - smoothstep(0.057, 0.07, abs(vStudyPosition.x)));`);
            shader.fragmentShader = shader.fragmentShader.replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.12, studyAmber);');
            shader.fragmentShader = shader.fragmentShader.replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor *= 1.0 - studyAmber;');
            shader.fragmentShader = shader.fragmentShader.replace('#include <lights_physical_fragment>', ShaderChunk.lights_physical_fragment.replace('material.clearcoat = clearcoat;', 'material.clearcoat = clearcoat * studyAmber;'));
            shader.fragmentShader = shader.fragmentShader.replace('#include <transmission_fragment>', ShaderChunk.transmission_fragment.replace('material.transmission = transmission;', 'material.transmission = transmission * studyAmber;'));
          };
          physical.customProgramCacheKey = () => `study-amber-v1-${variant}`;
          result = physical; material.dispose();
        }
        result.envMapIntensity = enhanced ? 1.35 : 0.75;
        if (enhanced && id === 'press-chamber') result.roughness *= 0.72;
        if (result.normalMap) result.normalScale.set(0.55,0.55);
        actual.push({ name: result.name, type: result.type, roughness: result.roughness, metalness: result.metalness,
          mapColorSpace: result.map?.colorSpace, mrColorSpace: result.roughnessMap?.colorSpace,
          envMapIntensity: result.envMapIntensity, transmission: result instanceof MeshPhysicalMaterial ? result.transmission : 0 });
        replacement.set(material,result); return result;
      };
      part.material = Array.isArray(part.material) ? part.material.map(mapMaterial) : mapMaterial(part.material);
    });
    if (dial) { const gauge=createGauge(dial); gauge.setPressure(0); root.add(gauge.root); canvas.dataset['gauge']='production createGauge / pressure 0'; }
    bounds.setFromObject(root); bounds.getCenter(center);
    radius = bounds.getSize(new Vector3()).length() / 2;
    key.target.position.copy(center); fit();
    canvas.dataset['variant'] = variant; canvas.dataset['materials'] = JSON.stringify(actual);
    canvas.dataset['triangles'] = String(triangles); canvas.dataset['materialCount'] = String(materialCount);
    canvas.dataset['cameraDirection'] = direction.toArray().join(','); canvas.dataset['renderState'] = 'ready';
  }).catch((error: unknown) => fail(String(error)));
  return {
    resize({width,height,dpr}) { if (disposed || width<=0 || height<=0) return; camera.aspect=width/height; gpu.setPixelRatio(Math.min(2,dpr)); gpu.setSize(width,height,false); fit(); },
    render() { if (disposed || !object) return; gpu.render(scene,camera); canvas.dataset['drawCalls'] = String(gpu.info.render.calls); canvas.dataset['gpuTriangles'] = String(gpu.info.render.triangles); canvas.dataset['textures'] = String(gpu.info.memory.textures); },
    dispose() { if (disposed) return; disposed=true; canvas.dataset['renderState']='disposed'; canvas.removeEventListener('webglcontextlost',lost);
      release(resources,dial?[dial]:[]); environment?.dispose(); key.shadow.dispose(); gpu.dispose(); },
  };
}
