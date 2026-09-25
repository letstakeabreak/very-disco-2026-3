import { BufferGeometry, Material, Mesh, Texture } from 'three';
import type { Object3D } from 'three';

/** GLTF clones share buffers and image bitmaps. Dispose each resource exactly once. */
export function disposeObjects(roots: readonly Object3D[], extraTextures: readonly Texture[] = []): void {
  const geometries = new Set<BufferGeometry>();
  const materials = new Set<Material>();
  const textures = new Set<Texture>(extraTextures);
  const images = new Set<{ close: () => void }>();
  for (const root of roots) root.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    geometries.add(object.geometry);
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.add(material);
  });
  for (const material of materials) {
    for (const value of Object.values(material)) if (value instanceof Texture) textures.add(value);
    material.dispose();
  }
  for (const geometry of geometries) geometry.dispose();
  for (const texture of textures) {
    const image: unknown = texture.source.data;
    if (image && typeof image === 'object' && 'close' in image && typeof image.close === 'function') images.add(image as { close: () => void });
    texture.dispose();
  }
  for (const image of images) image.close();
}
