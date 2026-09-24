import {
  ACESFilmicToneMapping, AmbientLight, Box3, DirectionalLight, Group, Matrix4, Mesh,
  MeshLambertMaterial, MeshPhysicalMaterial, MeshStandardMaterial, OrthographicCamera, PCFShadowMap, PerspectiveCamera,
  Plane, PlaneGeometry, PMREMGenerator, Quaternion, Raycaster, Scene, ShaderMaterial,
  ShadowMaterial, SRGBColorSpace, TextureLoader, Vector2, Vector3, WebGLRenderer,
} from 'three';
import type { Object3D, Texture, WebGLRenderTarget } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import type { AssetId, GameRenderer, GameSnapshot, RendererOptions, SalvageId } from '../contracts';
import { deformSpecimen, type Deformation } from './deformation';
import { createGauge } from './gauge';
import { disposeObjects } from './resources';
import { finiteFrameDelta, specimenVisuals, SPECIMEN_IDS } from './visual-state';
import { animateRam, PRESS_ANCHORS, RAM_RETRACTED_TRAVEL } from './ram';
import { ASSET_REGISTRY } from './assets';
import { createCaseDepth } from './case-depth';

const STAGE_ASPECT = 2 / 3;
const WORKTOP_Y = 0.22;
const RAM_APPROACH_METERS_PER_MS = 0.0007;
const ASSET_IDS: readonly AssetId[] = ['press-chamber', ...SPECIMEN_IDS];
const assetUrl = (path: string): string => `${import.meta.env.BASE_URL}assets/${path}`;
type Prop = { root: Object3D; bounds: Box3; deformation: Deformation; compression: number; damage: number; initialized: boolean };

function surfaceTop(bounds: Box3, height: number, toPress: Matrix4): number {
  let top = -Infinity;
  for (const x of [bounds.min.x, bounds.max.x]) for (const y of [0, height]) for (const z of [bounds.min.z, bounds.max.z]) {
    top = Math.max(top, new Vector3(x, y, z).applyMatrix4(toPress).y);
  }
  return top;
}

/** Fixed-camera 2.5D workshop with four real PBR meshes. It consumes, never judges, state. */
export function createRenderer({ canvas, onFatal }: RendererOptions): GameRenderer {
  let gpu: WebGLRenderer;
  try { gpu = new WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' }); }
  catch (error) { onFatal({ code: 'webgl-unavailable', message: String(error) }); return { resize() {}, render() {}, dispose() {} }; }
  let disposed = false;
  let failed = false;
  let ready = false;
  let loaded = 0;
  let width = 1;
  let height = 1;
  let stageWidth = 1;
  let stageHeight = 1;
  let previousSeed: number | null = null;
  let previousTick = 0;
  let hasSynced = false;
  const roots: Object3D[] = [];
  const props = new Map<SalvageId, Prop>();
  const storedLooks = new Map<SalvageId, { compression: number; damage: number }>();
  const depths: { dispose(): void }[] = [];
  let press: Object3D | null = null;
  let ram: ReturnType<typeof animateRam> | null = null;
  let gauge: ReturnType<typeof createGauge> | null = null;
  let plate: Texture | null = null;
  let dial: Texture | null = null;
  let environment: WebGLRenderTarget | null = null;
  canvas.dataset['renderState'] = 'loading';
  canvas.dataset['loadedAssets'] = '0';

  function fail(error: unknown): void {
    if (disposed || failed) return;
    failed = true;
    canvas.dataset['renderState'] = 'error';
    onFatal({ code: 'render-failed', message: String(error) });
  }
  const contextLost = (event: Event): void => { event.preventDefault(); fail(new Error('WebGL context lost; recreate renderer to retry')); };
  canvas.addEventListener('webglcontextlost', contextLost);
  gpu.setClearColor('#071316', 1);
  gpu.autoClear = false;
  gpu.outputColorSpace = SRGBColorSpace;
  gpu.toneMapping = ACESFilmicToneMapping;
  gpu.toneMappingExposure = 0.95;
  gpu.shadowMap.enabled = true;
  gpu.shadowMap.type = PCFShadowMap;
  gpu.localClippingEnabled = true;
  gpu.info.autoReset = false;

  const scene = new Scene();
  const stage = new Group();
  scene.add(stage);
  const camera = new PerspectiveCamera(34, STAGE_ASPECT, 0.05, 20);
  camera.position.set(0, 1.37, 2.7);
  camera.lookAt(0, 0.40, 0);
  camera.updateMatrixWorld();
  const ray = new Raycaster();
  const floor = new Plane(new Vector3(0, 1, 0), -WORKTOP_Y);
  function onTable(u: number, v: number): Vector3 {
    ray.setFromCamera(new Vector2(u * 2 - 1, 1 - v * 2), camera);
    return ray.ray.intersectPlane(floor, new Vector3())!;
  }
  const trays = [onTable(0.105, 0.49), onTable(0.09, 0.595), onTable(0.10, 0.655)];
  // Foam apertures measured on the generated 1024 × 1536 workshop plate.
  // Derive direction from the same camera/plane used for their centers.
  const slots = [
    [0.521484375, 0.740071614583, 0.53173828125, 0.700846354167, 0.51123046875, 0.779296875],
    [0.67724609375, 0.740397135417, 0.677734375, 0.700846354167, 0.6767578125, 0.779947916667],
    [0.8349609375, 0.741048177083, 0.826171875, 0.701497395833, 0.84375, 0.780598958333],
  ].map(([u, v, rearU, rearV, frontU, frontV]) => {
    const axis = onTable(frontU!, frontV!).sub(onTable(rearU!, rearV!));
    const rotation = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), Math.atan2(-axis.z, axis.x))
      .multiply(new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), -Math.PI / 2));
    return { center: onTable(u!, v!), rotation };
  });
  const caseOffset = new Vector3();
  const caseDepth = createCaseDepth(onTable);
  stage.add(caseDepth); roots.push(caseDepth);
  scene.add(new AmbientLight('#d2d4d3', 0.12));
  const key = new DirectionalLight('#ffe1ac', 2.6);
  key.position.set(-1.8, 2.8, 2.0);
  key.target.position.set(0, 0.45, 0);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = -1.3; key.shadow.camera.right = 1.3;
  key.shadow.camera.top = 1.8; key.shadow.camera.bottom = -1.0;
  key.shadow.camera.near = 0.2; key.shadow.camera.far = 7;
  key.shadow.normalBias = 0.0015;
  key.shadow.bias = -0.00005;
  scene.add(key, key.target);
  const rim = new DirectionalLight('#b4cbda', 1.2);
  rim.position.set(1.2, 1.7, -1.2); scene.add(rim);
  const fill = new DirectionalLight('#abc5ca', 0.3);
  fill.position.set(0.2, 1.8, 3.5); scene.add(fill);
  const shadow = new Mesh(new PlaneGeometry(5, 5), new ShadowMaterial({ opacity: 0.52, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = WORKTOP_Y + 0.001; shadow.receiveShadow = true;
  scene.add(shadow); roots.push(shadow);
  const bedShadow = new Mesh(new PlaneGeometry(0.30, 0.27), new ShadowMaterial({ opacity: 0.4, depthWrite: false }));
  bedShadow.rotation.x = -Math.PI / 2;
  bedShadow.receiveShadow = true;
  // Sit above the mildly uneven bed top so its contact shadow is not buried in the GLB.
  bedShadow.position.set(PRESS_ANCHORS.x, PRESS_ANCHORS.workbedY + 0.0035, PRESS_ANCHORS.z);
  stage.add(bedShadow); roots.push(bedShadow);

  const background = new Scene();
  const flatCamera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const plateMaterial = new ShaderMaterial({
    depthTest: false, depthWrite: false, toneMapped: false,
    uniforms: { plate: { value: null }, stageFraction: { value: new Vector2(1, 1) } },
    vertexShader: 'varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy,0.0,1.0);}',
    fragmentShader: `uniform sampler2D plate; uniform vec2 stageFraction; varying vec2 vUv;
      void main(){
        vec2 stageUv=(vUv-.5)/stageFraction+.5;
        vec3 surround=mix(vec3(.0045,.006,.006),vec3(.002,.009,.012),vUv.x)*(.8+.2*(1.0-vUv.y));
        vec3 workshop=texture2D(plate,clamp(stageUv,0.0,1.0)).rgb;
        vec2 edge=min(stageUv,1.0-stageUv);
        float blend=smoothstep(-.012,.015,min(edge.x,edge.y));
        gl_FragColor=vec4(mix(surround,workshop,blend),1.0);
        #include <colorspace_fragment>
      }`,
  });
  const backdrop = new Mesh(new PlaneGeometry(2, 2), plateMaterial);
  background.add(backdrop); roots.push(backdrop);

  try {
    const generator = new PMREMGenerator(gpu);
    const room = new RoomEnvironment();
    // Narrow reflection cards separate worn metal from the dark room without a teal wash.
    room.traverse((object) => {
      if (object instanceof Mesh && object.material instanceof MeshLambertMaterial) {
        if (object.material.emissiveIntensity > 2) {
          object.material.emissive.set(object.position.x < -8 || object.position.z > 8 ? '#ffe2ba' : '#edf3ff');
          if (Math.abs(object.position.x) > 8) object.scale.z *= 0.45;
          else if (Math.abs(object.position.z) > 8) object.scale.x *= 0.45;
        }
      } else if (object instanceof Mesh && object.material instanceof MeshStandardMaterial) {
        object.material.color.multiplyScalar(0.35);
      }
    });
    environment = generator.fromScene(room, 0.02);
    scene.environment = environment.texture;
    scene.environmentIntensity = 1;
    room.dispose(); generator.dispose();
  } catch (error) { fail(error); }

  function prepareMesh(root: Object3D, id: AssetId): void {
    const prepared = new Set<MeshStandardMaterial>();
    root.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      object.castShadow = true; object.receiveShadow = true;
      if (object.name.startsWith('lens-glass')) {
        // Meshy's baked opaque reflection is replaced on the original generated glass faces.
        object.material = new MeshPhysicalMaterial({ color: '#add9d8', roughness: 0.09, metalness: 0,
          transmission: 0.72, thickness: 0.025, ior: 1.48, clearcoat: 1, clearcoatRoughness: 0.05,
          attenuationColor: '#63a6ab', attenuationDistance: 0.16, envMapIntensity: 1.2 });
        object.castShadow = false;
      }
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        if (!(material instanceof MeshStandardMaterial) || prepared.has(material)) continue;
        prepared.add(material);
        material.envMapIntensity = 1.35;
        if (id === 'press-chamber') material.roughness *= 0.72;
        if (material.normalMap) material.normalScale.set(0.55, 0.55);
      }
    });
  }
  const loader = new GLTFLoader();
  const loading = ASSET_IDS.map(async (id) => {
    const path = ASSET_REGISTRY[id].runtimePath;
    if (!path) throw new Error(`No runtime asset registered for ${id}`);
    const gltf = await loader.loadAsync(`${import.meta.env.BASE_URL}${path}`).catch((error: unknown) => {
      throw new Error(`Could not load ${id}: ${String(error)}`);
    });
    if (disposed || failed) { disposeObjects([gltf.scene]); return; }
    const root = gltf.scene;
    prepareMesh(root, id);
    roots.push(root); stage.add(root);
    if (id === 'press-chamber') {
      press = root; ram = animateRam(root); depths.push(...ram.depthMaterials);
      // The original lower plinth sits inside the workbench, below its visible surface.
      root.traverse((object) => {
        if (!(object instanceof Mesh)) return;
        for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
          material.clippingPlanes = [floor]; material.clipShadows = true;
        }
      });
      press.add(bedShadow);
    } else {
      const deformation = deformSpecimen(root, id);
      depths.push(...deformation.depthMaterials);
      props.set(id, { root, bounds: new Box3().setFromObject(root), deformation, compression: 0, damage: 0, initialized: false });
      root.visible = false;
    }
    loaded += 1; canvas.dataset['loadedAssets'] = String(loaded);
  });
  const loadingPlate = new TextureLoader().loadAsync(assetUrl('textures/workshop-v4.webp')).then((texture) => {
    if (disposed || failed) { texture.dispose(); return; }
    plate = texture; texture.colorSpace = SRGBColorSpace;
    plateMaterial.uniforms['plate']!.value = texture;
  });
  const loadingDial = new TextureLoader().loadAsync(assetUrl('textures/pressure-dial.webp')).then((texture) => {
    if (disposed || failed) { disposeObjects([], [texture]); return; }
    dial = texture; texture.colorSpace = SRGBColorSpace;
  }).catch((error: unknown) => { throw new Error(`Could not load pressure dial: ${String(error)}`); });
  void Promise.all([...loading, loadingPlate, loadingDial]).then(() => {
    if (!disposed && !failed && press && dial) {
      gauge = createGauge(dial); press.add(gauge.root);
      ready = true; canvas.dataset['renderState'] = 'ready';
    }
  }).catch(fail);

  function sync(snapshot: GameSnapshot, dt: number): void {
    if (previousSeed !== snapshot.seed || snapshot.tick < previousTick || (snapshot.phase === 'idle' && snapshot.storedSpecimenIds.length === 0)) {
      storedLooks.clear();
      for (const prop of props.values()) prop.initialized = false;
      hasSynced = false;
    }
    previousSeed = snapshot.seed; previousTick = snapshot.tick;
    const phase = snapshot.phase === 'paused' ? snapshot.resumePhase : snapshot.phase;
    const paused = snapshot.phase === 'paused';
    gauge?.setPressure(snapshot.pressure01);
    // Pause can cancel an uncommitted stroke: show its authoritative settled state immediately.
    const blend = paused || !hasSynced ? 1 : 1 - Math.exp(-dt / 65);
    const inContact = snapshot.currentSpecimen !== null && (phase === 'compressing' || phase === 'settling' || phase === 'failed');
    let contactReached = paused || !hasSynced;
    let currentTop: number = PRESS_ANCHORS.workbedY;
    if (press) {
      const entity = snapshot.entities.find((item) => item.assetId === 'press-chamber');
      press.position.set(entity?.position.x ?? 0, entity?.position.y ?? 0, entity?.position.z ?? 0);
      press.rotation.set(entity?.rotationRad.x ?? 0, entity?.rotationRad.y ?? 0, entity?.rotationRad.z ?? 0, 'XYZ');
      press.scale.set(entity?.scale.x ?? 1, entity?.scale.y ?? 1, entity?.scale.z ?? 1);
      press.updateMatrixWorld(true);
    }
    for (const visual of specimenVisuals(snapshot)) {
      const prop = props.get(visual.id);
      if (!prop) continue;
      prop.root.visible = visual.location !== 'hidden';
      let look = { compression: visual.compression, damage: visual.damage };
      if (visual.location === 'press') storedLooks.set(visual.id, look);
      if (visual.location === 'case') look = storedLooks.get(visual.id) ?? look;
      const compressionScale = visual.id === 'salvage-lens' ? 0.12 : 0.52;
      prop.root.scale.setScalar(1);
      prop.root.rotation.set(0, visual.yaw, 0);
      if (visual.location === 'press') {
        prop.root.position.set(PRESS_ANCHORS.x, PRESS_ANCHORS.workbedY + PRESS_ANCHORS.clearance, PRESS_ANCHORS.z);
        if (press) {
          prop.root.position.applyMatrix4(press.matrixWorld);
          prop.root.rotation.set(press.rotation.x, press.rotation.y + visual.yaw, press.rotation.z);
          prop.root.scale.copy(press.scale).multiplyScalar(1.1);
        }
      } else if (visual.location === 'tray') {
        prop.root.position.copy(trays[visual.index]!); prop.root.rotation.y = -0.15;
        prop.root.scale.setScalar(Math.min(1, 0.19 / (prop.bounds.max.x - prop.bounds.min.x)));
      } else if (visual.location === 'case') {
        const slot = slots[visual.index]!;
        prop.root.quaternion.copy(slot.rotation); prop.root.scale.setScalar(0.7);
        prop.root.position.copy(slot.center);
      }
      const entity = snapshot.entities.find((item) => item.assetId === visual.id);
      if (entity) {
        prop.root.position.set(entity.position.x, entity.position.y, entity.position.z);
        prop.root.rotation.set(entity.rotationRad.x, entity.rotationRad.y + visual.yaw, entity.rotationRad.z, 'XYZ');
        prop.root.scale.set(entity.scale.x, entity.scale.y, entity.scale.z);
      }
      let toPress: Matrix4 | null = null;
      let compressionBlend = prop.initialized ? blend : 1;
      if (visual.location === 'press' && press) {
        prop.root.updateMatrixWorld(true);
        toPress = new Matrix4().copy(press.matrixWorld).invert().multiply(prop.root.matrixWorld);
        if (inContact && ram && prop.initialized && !paused && hasSynced) {
          // Hold the existing shape until the platen reaches it. Only the remaining
          // frame time advances compression, so split frames give the same approach.
          const top = surfaceTop(prop.bounds, prop.deformation.height * (1 - prop.compression * compressionScale), toPress);
          const contact = Math.min(PRESS_ANCHORS.travel, Math.max(0, PRESS_ANCHORS.platenY - top));
          const approachMs = Math.max(0, contact - ram.travel.value) / RAM_APPROACH_METERS_PER_MS;
          contactReached = approachMs <= dt;
          compressionBlend = 1 - Math.exp(-Math.max(0, dt - approachMs) / 65);
        }
      }
      prop.compression += (look.compression - prop.compression) * compressionBlend;
      prop.damage += (look.damage - prop.damage) * (prop.initialized ? blend : 1);
      prop.initialized = true;
      prop.deformation.compression.value = prop.compression;
      prop.deformation.damage.value = prop.damage;
      const renderedHeight = prop.deformation.height * (1 - prop.compression * compressionScale);
      for (const material of prop.deformation.materials) if (material instanceof MeshPhysicalMaterial) material.transmission = 0.72 * (1 - prop.damage * 0.85);
      if (toPress) currentTop = surfaceTop(prop.bounds, renderedHeight, toPress);
      if (visual.location === 'case' && !entity) {
        // The front (+Z) faces up; recenter after lying down and after deformation.
        const slot = slots[visual.index]!;
        caseOffset.set(0, renderedHeight / 2, 0).applyQuaternion(slot.rotation).multiplyScalar(0.7);
        prop.root.position.sub(caseOffset);
        // Art-directed seating below the photographed foam mouth; no volume/physics rule.
        prop.root.position.y -= 0.018;
      }
    }
    if (ram) {
      const target = inContact ? Math.min(PRESS_ANCHORS.travel, Math.max(0, PRESS_ANCHORS.platenY - currentTop)) : RAM_RETRACTED_TRAVEL;
      // After approach, follow the deformed surface without a second easing lag.
      ram.travel.value = inContact
        ? contactReached ? target : Math.min(target, ram.travel.value + RAM_APPROACH_METERS_PER_MS * dt)
        : ram.travel.value + (target - ram.travel.value) * blend;
    }
    hasSynced = true;
  }

  return {
    resize(size) {
      if (disposed || failed || !Number.isFinite(size.width) || !Number.isFinite(size.height) || size.width <= 0 || size.height <= 0) return;
      width = size.width; height = size.height;
      const dpr = Number.isFinite(size.dpr) ? Math.min(2, Math.max(1, size.dpr)) : 1;
      gpu.setPixelRatio(dpr); gpu.setSize(width, height, false);
      stageHeight = Math.min(height, width / STAGE_ASPECT); stageWidth = stageHeight * STAGE_ASPECT;
      (plateMaterial.uniforms['stageFraction']!.value as Vector2).set(stageWidth / width, stageHeight / height);
    },
    render(snapshot, dtMs) {
      if (disposed || failed) return;
      try {
        const dt = finiteFrameDelta(dtMs);
        gpu.info.reset();
        gpu.setViewport(0, 0, width, height); gpu.clear();
        if (plate) gpu.render(background, flatCamera);
        if (ready) {
          sync(snapshot, dt);
          gpu.clearDepth();
          gpu.setViewport((width - stageWidth) / 2, (height - stageHeight) / 2, stageWidth, stageHeight);
          gpu.render(scene, camera);
        }
        canvas.dataset['triangles'] = String(gpu.info.render.triangles);
        canvas.dataset['drawCalls'] = String(gpu.info.render.calls);
        let visibleTriangles = 0;
        stage.traverseVisible((object) => {
          if (object instanceof Mesh) visibleTriangles += (object.geometry.index?.count ?? object.geometry.getAttribute('position').count) / 3;
        });
        canvas.dataset['visibleTriangles'] = String(visibleTriangles);
      } catch (error) { fail(error); }
    },
    dispose() {
      if (disposed) return;
      disposed = true; canvas.dataset['renderState'] = 'disposed';
      canvas.removeEventListener('webglcontextlost', contextLost);
      disposeObjects(roots, [plate, dial].filter((texture): texture is Texture => texture !== null));
      depths.forEach((material) => material.dispose());
      environment?.dispose(); key.shadow.dispose();
      props.clear(); storedLooks.clear(); gpu.dispose();
    },
  };
}
