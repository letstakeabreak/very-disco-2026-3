import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BufferGeometry, Group, Mesh, MeshStandardMaterial } from 'three';
import type { WebGLProgramParametersWithUniforms } from 'three';
import { animateRam, PRESS_ANCHORS, RAM_RETRACTED_TRAVEL } from '../../src/render/ram';

const flange = Number(PRESS_ANCHORS.flangeY.toFixed(8));
const top = Number(PRESS_ANCHORS.topY.toFixed(8));
const span = top - flange;
function mappedY(y: number, travel: number): number {
  const u = Math.max(0, Math.min(1, (y - flange) / span));
  return y - travel * (1 - u * u * (3 - 2 * u));
}
function actualRamHeights(): number[] {
  const bytes = readFileSync('public/assets/models/press-chamber.glb');
  const length = bytes.readUInt32LE(12);
  const gltf = JSON.parse(bytes.toString('utf8', 20, 20 + length)) as {
    nodes: { name: string; mesh: number }[]; meshes: { primitives: { attributes: { POSITION: number } }[] }[];
    accessors: { bufferView: number; byteOffset?: number; count: number; componentType: number; type: string }[];
    bufferViews: { byteOffset?: number; byteStride?: number }[];
  };
  const node = gltf.nodes.find(node => node.name === 'press-ram')!;
  const accessor = gltf.accessors[gltf.meshes[node.mesh]!.primitives[0]!.attributes.POSITION]!;
  const view = gltf.bufferViews[accessor.bufferView]!;
  expect(accessor.componentType).toBe(5126); expect(accessor.type).toBe('VEC3');
  return Array.from({ length: accessor.count }, (_, index) => bytes.readFloatLE(28 + length + (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0) + index * (view.byteStride ?? 12) + 4));
}

describe('upward ram retraction (pose geometry, not full collision approval)', () => {
  it('keeps a positive height derivative with margin below the fold threshold', () => {
    const amount = -RAM_RETRACTED_TRAVEL;
    expect(amount).toBeGreaterThan(0);
    expect(amount).toBeLessThan(2 * span / 3);
    expect(1 - 1.5 * amount / span).toBeGreaterThan(0.28);
    // Beyond the analytical limit the middle of the sleeve would reverse.
    expect(1 - 1.5 * (2 * span / 3 + 0.001) / span).toBeLessThan(0);
  });

  it('preserves ordering of actual GLB vertex heights and fixes the upper connection', () => {
    const heights = [...new Set(actualRamHeights())].sort((a, b) => a - b);
    let fixed = 0; let rigid = 0;
    for (const [index, y] of heights.entries()) {
      const mapped = mappedY(y, RAM_RETRACTED_TRAVEL);
      if (index) expect(mapped).toBeGreaterThan(mappedY(heights[index - 1]!, RAM_RETRACTED_TRAVEL));
      if (y >= top) { expect(mapped).toBe(y); fixed += 1; }
      if (y <= flange) { expect(mapped - y).toBeCloseTo(-RAM_RETRACTED_TRAVEL, 12); rigid += 1; }
    }
    expect(fixed).toBeGreaterThan(0); expect(rigid).toBeGreaterThan(0);
    expect(mappedY(Math.min(...heights), RAM_RETRACTED_TRAVEL)).toBeCloseTo(PRESS_ANCHORS.platenY + .09, 7);
  });

  it('initializes color and shadow shaders with one retracted uniform while keeping geometry intact', () => {
    const root = new Group(); const geometry = new BufferGeometry(); const original = new MeshStandardMaterial();
    const ram = new Mesh(geometry, original); ram.name = 'press-ram'; root.add(ram);
    const control = animateRam(root);
    const color = { uniforms: {}, vertexShader: '#include <begin_vertex>', fragmentShader: '' } as unknown as WebGLProgramParametersWithUniforms;
    const depth = { uniforms: {}, vertexShader: '#include <begin_vertex>', fragmentShader: '' } as unknown as WebGLProgramParametersWithUniforms;
    const material = ram.material as MeshStandardMaterial;
    material.onBeforeCompile(color, undefined!); control.depthMaterials[0]!.onBeforeCompile(depth, undefined!);
    expect(control.travel.value).toBe(RAM_RETRACTED_TRAVEL);
    expect(color.uniforms['ramTravel']).toBe(control.travel); expect(depth.uniforms['ramTravel']).toBe(control.travel);
    expect(color.vertexShader).toBe(depth.vertexShader);
    expect(ram.geometry).toBe(geometry); expect(ram.position.toArray()).toEqual([0, 0, 0]);
    material.dispose(); original.dispose(); geometry.dispose(); control.depthMaterials.forEach(material => material.dispose());
  });
});
