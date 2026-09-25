import { ACESFilmicToneMapping, AmbientLight, Box3, Color, DirectionalLight, Mesh, MeshLambertMaterial, MeshPhysicalMaterial,
  MeshStandardMaterial, PerspectiveCamera, PMREMGenerator, Scene, SRGBColorSpace, Vector3, WebGLRenderer } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { disposeObjects } from '../../../../src/render/resources';

const canvas = document.querySelector('canvas')!;
const status = document.querySelector('#status')!;
const gpu = new WebGLRenderer({ canvas, antialias: true });
gpu.outputColorSpace = SRGBColorSpace; gpu.toneMapping = ACESFilmicToneMapping; gpu.toneMappingExposure = .95;
gpu.setClearColor('#737a80');
const scene = new Scene(); const camera = new PerspectiveCamera(28, 1, .01, 100);
scene.add(new AmbientLight('#d2d4d3', .12));
for (const [color, intensity, x, y, z] of [['#ffe1ac', 2.6, -1.8, 2.8, 2], ['#b4cbda', 1.2, 1.2, 1.7, -1.2], ['#abc5ca', .3, .2, 1.8, 3.5]] as const) {
  const light = new DirectionalLight(color, intensity); light.position.set(x, y, z); scene.add(light);
}
const room = new RoomEnvironment();
room.traverse(object => {
  if (!(object instanceof Mesh)) return;
  if (object.material instanceof MeshLambertMaterial && object.material.emissiveIntensity > 2) {
    object.material.emissive.set(object.position.x < -8 || object.position.z > 8 ? '#ffe2ba' : '#edf3ff');
    if (Math.abs(object.position.x) > 8) object.scale.z *= .45;
    else if (Math.abs(object.position.z) > 8) object.scale.x *= .45;
  } else if (object.material instanceof MeshStandardMaterial) object.material.color.multiplyScalar(.35);
});
const pmrem = new PMREMGenerator(gpu); const environment = pmrem.fromScene(room, .02);
scene.environment = environment.texture; scene.environmentIntensity = 1; room.dispose(); pmrem.dispose();
const errors: string[] = []; let ready = false; let frame = 0;
const [cassette, insert] = await Promise.all([
  new GLTFLoader().loadAsync('/assets/source/meshy/salvage-cassette/insert-v1/shell-mobile.glb'),
  new GLTFLoader().loadAsync('/assets/source/meshy/salvage-cassette/insert-v1/insert-mobile.glb'),
]);
cassette.scene.add(insert.scene); scene.add(cassette.scene);
const optics = { tint: { value: new Color().setRGB(1, .62, .12) }, roughness: { value: .08 } };
const maskChunk = `float windowMask = smoothstep(1.28,1.5,diffuseColor.r/max(diffuseColor.g,.001))
  * smoothstep(1.3,1.6,diffuseColor.g/max(diffuseColor.b,.001))
  * smoothstep(.06,.12,diffuseColor.r) * (1.0-smoothstep(.057,.07,abs(vInsertStudy.x)));`;
const parts: { mesh: Mesh; window: Mesh; opaque: MeshStandardMaterial; shell: MeshStandardMaterial; glass: MeshPhysicalMaterial }[] = [];
cassette.scene.traverse(object => {
  if (!(object instanceof Mesh) || !(object.material instanceof MeshStandardMaterial)) return;
  object.material.envMapIntensity = 1.35; if (object.material.normalMap) object.material.normalScale.set(.55, .55);
  if (object.name === 'cassette-interior') return;
  const original = object.material;
  const shell = original.clone();
  shell.onBeforeCompile = shader => {
    shader.vertexShader = 'varying vec3 vInsertStudy;\n' + shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvInsertStudy=position;');
    shader.fragmentShader = 'varying vec3 vInsertStudy;\n' + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>\n${maskChunk}\nif(windowMask>.05)discard;`);
  };
  shell.customProgramCacheKey = () => 'cassette-insert-opaque-shell-v2';
  const glass = new MeshPhysicalMaterial({ name: 'candidate-window', map: original.map, color: original.color,
    roughnessMap: original.roughnessMap, metalnessMap: original.metalnessMap, normalMap: original.normalMap,
    normalScale: original.normalScale, roughness: original.roughness, metalness: original.metalness,
    envMapIntensity: 1.35, clearcoat: .35, clearcoatRoughness: .08, transmission: .94,
    thickness: .006, ior: 1.46, attenuationColor: '#ffd174', attenuationDistance: .025 });
  glass.onBeforeCompile = shader => {
    shader.uniforms['studyTint'] = optics.tint; shader.uniforms['studyRoughness'] = optics.roughness;
    shader.vertexShader = 'varying vec3 vInsertStudy;\n' + shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvInsertStudy=position;');
    shader.fragmentShader = 'varying vec3 vInsertStudy;\nuniform vec3 studyTint;\nuniform float studyRoughness;\n' + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      ${maskChunk}\nif(windowMask<=.05)discard;
      diffuseColor.rgb=studyTint;`);
    shader.fragmentShader = shader.fragmentShader.replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor=studyRoughness;');
    shader.fragmentShader = shader.fragmentShader.replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor=0.0;');
    shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\nnormal=nonPerturbedNormal;');
  };
  glass.customProgramCacheKey = () => 'cassette-insert-study-v2';
  const window = object.clone(); window.name += '-window'; window.material = glass;
  parts.push({ mesh: object, window, opaque: original, shell, glass });
});
for (const part of parts) part.mesh.parent!.add(part.window);
const bounds = new Box3().setFromObject(cassette.scene); const center = bounds.getCenter(new Vector3());
const direction = new Vector3(-2, 1.6, 4).normalize();
function resize(): void {
  camera.aspect = innerWidth / innerHeight;
  const half = Math.min(camera.fov * Math.PI / 360, Math.atan(Math.tan(camera.fov * Math.PI / 360) * camera.aspect));
  const distance = bounds.getSize(new Vector3()).length() / 2 / Math.sin(half) * .92;
  camera.position.copy(center).addScaledVector(direction, distance); camera.lookAt(center); camera.updateProjectionMatrix();
  gpu.setPixelRatio(1); gpu.setSize(innerWidth, innerHeight, false);
}
function show(mode: 'baseline' | 'glass-only' | 'assembled' | 'insert-only', yaw = 0): void {
  for (const part of parts) {
    part.mesh.material = mode === 'baseline' ? part.opaque : part.shell;
    part.mesh.visible = mode !== 'insert-only';
    part.window.visible = mode === 'assembled' || mode === 'glass-only';
  }
  insert.scene.visible = mode === 'assembled' || mode === 'insert-only'; cassette.scene.rotation.y = yaw;
  status.textContent = mode.toUpperCase(); gpu.render(scene, camera);
}
const probe = { get ready() { return ready; }, errors, show,
  optics(tint: [number, number, number], roughness: number, transmission: number, thickness: number): void {
    optics.tint.value.setRGB(...tint); optics.roughness.value = roughness;
    for (const part of parts) { part.glass.transmission = transmission; part.glass.thickness = thickness; }
  }, get metrics() {
  return { calls: gpu.info.render.calls, triangles: gpu.info.render.triangles, textures: gpu.info.memory.textures, width: innerWidth, height: innerHeight, parts: parts.length };
} };
Object.assign(window, { __cassetteProbe: probe });
window.addEventListener('error', event => errors.push(event.message));
window.addEventListener('unhandledrejection', event => errors.push(String(event.reason)));
window.addEventListener('resize', resize); resize(); show('assembled'); ready = true;
const animate = (): void => { gpu.render(scene, camera); frame = requestAnimationFrame(animate); }; frame = requestAnimationFrame(animate);
const dispose = (): void => { cancelAnimationFrame(frame); disposeObjects([cassette.scene]);
  for (const part of parts) { part.opaque.dispose(); part.shell.dispose(); part.glass.dispose(); } environment.dispose(); gpu.dispose(); };
window.addEventListener('pagehide', dispose, { once: true }); if (import.meta.hot) import.meta.hot.dispose(dispose);
