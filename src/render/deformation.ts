import { Box3, Mesh, MeshDepthMaterial, MeshStandardMaterial, RGBADepthPacking, Vector3 } from 'three';
import type { Object3D, WebGLProgramParametersWithUniforms } from 'three';
import type { SalvageId } from '../contracts';

export type Deformation = { compression: { value: number }; damage: { value: number }; height: number; materials: MeshStandardMaterial[]; depthMaterials: MeshDepthMaterial[] };

const DECLARATIONS = `
uniform float pressCompression;
uniform float pressDamage;
uniform float pressHeight;
uniform float pressIsGlass;
uniform float pressGlassSurface;
`;
const VERTEX = `
  float h = max(pressHeight, 0.001);
  float u = clamp(position.y / h, 0.0, 1.0);
  float shell = smoothstep(0.16, 0.32, abs(u - 0.5));
  float crush = pressCompression * mix(0.52, 0.12, pressIsGlass);
  float ribs = sin(u * 21.991) * sin(u * 3.14159);
  // Protective bands fold at their joints; central glass remains rigid until damaged.
  float fold = crush * shell;
  float shellScale = 1.0 - crush / 0.6;
  float rigidGlassY = u < 0.3 ? position.y * shellScale
    : (u < 0.7 ? position.y - 0.5 * crush * h
    : 0.7 * h - 0.5 * crush * h + (position.y - 0.7 * h) * shellScale);
  transformed.y = mix(position.y * (1.0 - crush), rigidGlassY, pressIsGlass);
  transformed.y = mix(transformed.y, position.y - crush * h * 0.5, pressGlassSurface);
  float housing = 1.0 - pressGlassSurface;
  transformed.x += sign(position.x) * ribs * fold * h * 0.13 * housing;
  transformed.z += sign(position.z) * ribs * fold * h * 0.08 * housing;
  transformed.x += sin(position.z * 70.0 + u * 11.0) * pressDamage * shell * h * 0.035 * housing;
`;

export function deformSpecimen(root: Object3D, id: SalvageId): Deformation {
  const size = new Box3().setFromObject(root).getSize(new Vector3());
  const deformation: Deformation = { compression: { value: 0 }, damage: { value: 0 }, height: size.y, materials: [], depthMaterials: [] };
  const patchVertex = (shader: WebGLProgramParametersWithUniforms, glassSurface: boolean): void => {
    shader.uniforms['pressCompression'] = deformation.compression;
    shader.uniforms['pressDamage'] = deformation.damage;
    shader.uniforms['pressHeight'] = { value: Math.max(size.y, 0.01) };
    shader.uniforms['pressIsGlass'] = { value: id === 'salvage-lens' ? 1 : 0 };
    shader.uniforms['pressGlassSurface'] = { value: glassSurface ? 1 : 0 };
    shader.vertexShader = DECLARATIONS + shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n' + VERTEX);
  };
  root.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    const source = Array.isArray(object.material) ? object.material : [object.material];
    const glassSurface = object.name.startsWith('lens-glass');
    const glassBox = new Box3().setFromObject(object);
    const glassCenter = glassBox.getCenter(new Vector3());
    const glassSize = glassBox.getSize(new Vector3());
    object.material = source.map((original) => {
      const material = original as MeshStandardMaterial;
      material.onBeforeCompile = (shader) => {
        patchVertex(shader, glassSurface);
        shader.fragmentShader = 'uniform float pressDamage;\n' + shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>\n diffuseColor.rgb *= mix(vec3(1.0), vec3(0.30, 0.24, 0.21), pressDamage * 0.72);`);
        if (glassSurface) {
          shader.vertexShader = 'varying vec2 fracturePosition;\n' + shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>\nfracturePosition = (position.xy - vec2(${glassCenter.x.toFixed(8)}, ${glassCenter.y.toFixed(8)})) / vec2(${glassSize.x.toFixed(8)}, ${glassSize.y.toFixed(8)});`);
          shader.fragmentShader = 'varying vec2 fracturePosition;\n' + shader.fragmentShader;
          shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
            float radius = length(fracturePosition);
            float angle = atan(fracturePosition.y, fracturePosition.x);
            float ray = abs(sin(angle * 4.0 + sin(radius * 37.0) * 0.13));
            float pixel = max(fwidth(ray), 0.015);
            float crack = (1.0-smoothstep(0.015,0.035+pixel,ray)) * smoothstep(0.035,0.085,radius);
            crack = max(crack, 1.0-smoothstep(0.004,0.012+fwidth(radius),abs(radius-0.24-sin(angle*7.0)*0.018)));
            // An authored missing shard makes severe damage readable at phone scale.
            // Only snapshot integrity drives this look; this does not decide a failure.
            float missing = smoothstep(0.4,0.95,pressDamage);
            float wedgeEdge = abs(angle-0.45) - missing*0.72 - sin(radius*62.0)*0.045;
            if (missing > 0.0 && wedgeEdge < 0.0 && radius > 0.04) discard;
            float chippedEdge = (1.0-smoothstep(0.015,0.04+fwidth(wedgeEdge),abs(wedgeEdge))) * missing;
            diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.68,0.82,0.79), max(crack*pressDamage,chippedEdge)*0.85);
          `).replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = min(1.0, roughnessFactor + pressDamage * 0.65);');
        }
      };
      material.customProgramCacheKey = () => `deep-press-shell-v3-${glassSurface}`;
      deformation.materials.push(material);
      return material;
    });
    if (object.material.length === 1) object.material = object.material[0]!;
    const depth = new MeshDepthMaterial({ depthPacking: RGBADepthPacking });
    depth.onBeforeCompile = (shader) => patchVertex(shader, object.name.startsWith('lens-glass'));
    depth.customProgramCacheKey = () => `deep-press-shell-depth-v2-${object.name.startsWith('lens-glass')}`;
    object.customDepthMaterial = depth;
    deformation.depthMaterials.push(depth);
    object.frustumCulled = false;
  });
  return deformation;
}
