import { Mesh, MeshDepthMaterial, RGBADepthPacking } from 'three';
import type { Object3D, MeshStandardMaterial, WebGLProgramParametersWithUniforms } from 'three';

/** Measured from the optimized, baked press mesh; see mobile-model-report.json. */
export const PRESS_ANCHORS = Object.freeze({
  workbedY: 0.36873742938041687,
  platenY: 0.5510312914848328,
  topY: 0.824894937955354,
  flangeY: 0.636993173426317,
  x: 0.021474093198776245,
  z: -0.09367392398416996,
  clearance: 0.003,
  travel: 0.1792938621044159,
});

/** Lower flange translates rigidly; cylinder extends while its upper mount stays fixed. */
export function animateRam(root: Object3D): { travel: { value: number }; depthMaterials: MeshDepthMaterial[] } {
  const travel = { value: 0 };
  const depthMaterials: MeshDepthMaterial[] = [];
  const patch = (shader: WebGLProgramParametersWithUniforms): void => {
    shader.uniforms['ramTravel'] = travel;
    shader.vertexShader = 'uniform float ramTravel;\n' + shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>\ntransformed.y -= ramTravel * (1.0 - smoothstep(${PRESS_ANCHORS.flangeY.toFixed(8)}, ${PRESS_ANCHORS.topY.toFixed(8)}, position.y));`);
  };
  root.traverse((object) => {
    if (!(object instanceof Mesh) || !object.name.startsWith('press-ram')) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    // The two press parts share a source material; only the ram gets this shader.
    object.material = materials.map((original) => {
      const material = original.clone() as MeshStandardMaterial;
      material.onBeforeCompile = patch;
      material.customProgramCacheKey = () => 'deep-press-ram-v1';
      return material;
    });
    if (object.material.length === 1) object.material = object.material[0]!;
    const depth = new MeshDepthMaterial({ depthPacking: RGBADepthPacking });
    depth.onBeforeCompile = patch;
    depth.customProgramCacheKey = () => 'deep-press-ram-depth-v1';
    object.customDepthMaterial = depth;
    depthMaterials.push(depth);
    object.frustumCulled = false;
  });
  if (depthMaterials.length === 0) throw new Error('Press asset has no calibrated press-ram mesh');
  return { travel, depthMaterials };
}
