import { expect, it, vi } from 'vitest';
import { BoxGeometry, Group, Mesh, MeshPhysicalMaterial, MeshStandardMaterial, Texture } from 'three';
import type { WebGLProgramParametersWithUniforms, WebGLRenderer } from 'three';
import { prepareCassette } from '../../src/render/cassette';
import { deformSpecimen } from '../../src/render/deformation';
import { disposeObjects } from '../../src/render/resources';

it('keeps cassette optics when snapshot deformation is installed and releases shared resources once', () => {
  const root = new Group(); const bitmap = { close: vi.fn() }; const map = new Texture(bitmap);
  const shell = new Mesh(new BoxGeometry(.28, .134, .138), new MeshStandardMaterial({ map }));
  shell.geometry.translate(0, .067, 0); shell.name = 'salvage-cassette';
  const insert = new Mesh(new BoxGeometry(.18, .065, .065), new MeshStandardMaterial());
  insert.geometry.translate(0, .074, 0); insert.name = 'cassette-interior'; root.add(shell, insert);
  const before = shell.geometry.getAttribute('position').array.slice();
  prepareCassette(root);
  const window = root.getObjectByName('cassette-window') as Mesh;
  expect(window.material).toBeInstanceOf(MeshPhysicalMaterial);
  expect(window.geometry).toBe(shell.geometry); expect(window.castShadow).toBe(false);
  expect(shell.geometry.getAttribute('position').array).toEqual(before);
  const deformation = deformSpecimen(root, 'salvage-cassette');
  deformation.compression.value = .8; deformation.damage.value = .6;
  for (const mesh of [shell, insert, window]) {
    const shader = { uniforms: {}, vertexShader: '#include <begin_vertex>', fragmentShader: '#include <color_fragment>' } as WebGLProgramParametersWithUniforms;
    const material = mesh.material as MeshStandardMaterial;
    material.onBeforeCompile(shader, {} as WebGLRenderer);
    expect(shader.uniforms['pressCompression']).toBe(deformation.compression);
    expect(shader.uniforms['pressDamage']).toBe(deformation.damage);
    expect(shader.uniforms['pressGlassSurface']!.value).toBe(mesh === shell ? 0 : 1);
    expect(shader.uniforms['pressIsGlass']!.value).toBe(1);
    if (mesh !== insert) {
      // Classify the original albedo; damage must not make the optical mask vanish.
      expect(shader.fragmentShader.indexOf('float cassetteWindow')).toBeGreaterThan(-1);
      expect(shader.fragmentShader.indexOf('float cassetteWindow')).toBeLessThan(shader.fragmentShader.indexOf('pressDamage * 0.72'));
    }
  }
  const geometryDispose = vi.spyOn(shell.geometry, 'dispose'); const mapDispose = vi.spyOn(map, 'dispose');
  disposeObjects([root]); deformation.depthMaterials.forEach(material => material.dispose());
  expect(geometryDispose).toHaveBeenCalledTimes(1); expect(mapDispose).toHaveBeenCalledTimes(1);
  expect(bitmap.close).toHaveBeenCalledTimes(1);
});
