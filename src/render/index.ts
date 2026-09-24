import { AmbientLight, BoxGeometry, Color, DirectionalLight, Mesh, MeshStandardMaterial, PerspectiveCamera, Scene, WebGLRenderer } from 'three';
import type { GameRenderer, GameSnapshot, RendererOptions } from '../contracts';

/** Neutral DEV probe only. Camera, primitive and materials are not an approved art direction. */
export function createRenderer({ canvas, onFatal }: RendererOptions): GameRenderer {
  let renderer: WebGLRenderer;
  try { renderer = new WebGLRenderer({ canvas, antialias: true, alpha: false }); }
  catch (error) { onFatal({ code: 'webgl-unavailable', message: String(error) }); return { resize() {}, render() {}, dispose() {} }; }
  const scene = new Scene();
  scene.background = new Color('#191b20');
  const camera = new PerspectiveCamera(42, 1, 0.1, 40);
  camera.position.set(3, 2, 4); camera.lookAt(0, 0, 0);
  scene.add(new AmbientLight('#ffffff', 2));
  const light = new DirectionalLight('#ffffff', 3); light.position.set(2, 8, 4); scene.add(light);
  const geometry = new BoxGeometry(0.7, 0.7, 0.7);
  const material = new MeshStandardMaterial({ color: '#858d9e', wireframe: true });
  const meshes = new Map<string, Mesh>();
  let disposed = false;
  let failed = false;
  function sync(snapshot: GameSnapshot): void {
    const ids = new Set(snapshot.entities.map((entity) => entity.id));
    for (const [id, mesh] of meshes) if (!ids.has(id)) { scene.remove(mesh); meshes.delete(id); }
    for (const entity of snapshot.entities) {
      let mesh = meshes.get(entity.id);
      if (!mesh) { mesh = new Mesh(geometry, material); meshes.set(entity.id, mesh); scene.add(mesh); }
      mesh.position.set(entity.position.x, entity.position.y, entity.position.z);
      mesh.rotation.set(entity.rotationRad.x, entity.rotationRad.y, entity.rotationRad.z, 'XYZ');
      mesh.scale.set(entity.scale.x, entity.scale.y, entity.scale.z);
    }
  }
  return {
    resize({ width, height, dpr }) { if (disposed || failed || width <= 0 || height <= 0) return; renderer.setPixelRatio(Math.min(2, Math.max(1, dpr))); renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix(); },
    render(snapshot, _dtMs) { if (disposed || failed) return; try { sync(snapshot); renderer.render(scene, camera); } catch (error) { failed = true; onFatal({ code: 'render-failed', message: String(error) }); } },
    dispose() { if (disposed) return; disposed = true; geometry.dispose(); material.dispose(); renderer.dispose(); meshes.clear(); },
  };
}
