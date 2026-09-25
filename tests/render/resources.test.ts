import { describe, expect, it, vi } from 'vitest';
import { BoxGeometry, Group, Mesh, MeshStandardMaterial, Texture } from 'three';
import { disposeObjects } from '../../src/render/resources';

describe('Three.js resource ownership', () => {
  it('releases shared geometry, materials, textures and bitmap exactly once across cloned roots', () => {
    const bitmap = { close: vi.fn() };
    const texture = new Texture(bitmap);
    const material = new MeshStandardMaterial({ map: texture, normalMap: texture });
    const geometry = new BoxGeometry();
    const root = new Group(); root.add(new Mesh(geometry, [material, material]));
    const geometryDispose = vi.spyOn(geometry, 'dispose');
    const materialDispose = vi.spyOn(material, 'dispose');
    const textureDispose = vi.spyOn(texture, 'dispose');
    disposeObjects([root, root.clone()], [texture, texture]);
    expect(geometryDispose).toHaveBeenCalledTimes(1);
    expect(materialDispose).toHaveBeenCalledTimes(1);
    expect(textureDispose).toHaveBeenCalledTimes(1);
    expect(bitmap.close).toHaveBeenCalledTimes(1);
  });

  it('closes an image shared by distinct texture wrappers once and releases extra textures', () => {
    const bitmap = { close: vi.fn() };
    const first = new Texture(bitmap); const second = new Texture(bitmap);
    const firstDispose = vi.spyOn(first, 'dispose'); const secondDispose = vi.spyOn(second, 'dispose');
    disposeObjects([], [first, second]);
    expect(firstDispose).toHaveBeenCalledTimes(1);
    expect(secondDispose).toHaveBeenCalledTimes(1);
    expect(bitmap.close).toHaveBeenCalledTimes(1);
  });

  it('accepts empty roots and non-bitmap texture data', () => {
    const texture = new Texture({ width: 1, height: 1 });
    expect(() => disposeObjects([new Group()], [texture])).not.toThrow();
  });
});
