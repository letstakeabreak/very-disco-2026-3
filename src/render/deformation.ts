import { Box3, Mesh, MeshDepthMaterial, MeshStandardMaterial, RGBADepthPacking, ShaderChunk, Vector3 } from 'three';
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
  // Crushed housings spread sideways past the platen: a barrel for the metal
  // core, splayed protective bands around rigid optics. Pressure drives it only.
  float bulge = pressCompression * mix(0.18 * sin(u * 3.14159), 0.10 * shell, pressIsGlass) * housing;
  transformed.x += position.x * bulge;
  transformed.z += position.z * bulge;
  transformed.x += sign(position.x) * ribs * fold * h * 0.13 * housing;
  transformed.z += sign(position.z) * ribs * fold * h * 0.08 * housing;
  transformed.x += sin(position.z * 70.0 + u * 11.0) * pressDamage * shell * h * 0.035 * housing;
`;

// Inverse-transpose of the authored deformation Jacobian. The existing normal
// map keeps its fine surface detail; its supporting surface follows the fold.
const NORMAL = `
  if (pressGlassSurface < 0.5) {
    float h = max(pressHeight, 0.001);
    float u = clamp(position.y / h, 0.0, 1.0);
    float t = clamp((abs(u-0.5)-0.16)/0.16, 0.0, 1.0);
    float shell = t*t*(3.0-2.0*t);
    float shellDerivative = 6.0*t*(1.0-t)*sign(u-0.5)/0.16;
    float ribs = sin(u*21.991)*sin(u*3.14159);
    float ribsDerivative = 21.991*cos(u*21.991)*sin(u*3.14159)
      + 3.14159*sin(u*21.991)*cos(u*3.14159);
    float crush = pressCompression*mix(0.52,0.12,pressIsGlass);
    float inside = position.y > 0.0 && position.y < h ? 1.0 : 0.0;
    float foldDerivative = crush*(ribsDerivative*shell+ribs*shellDerivative)*inside;
    float wave = position.z*70.0+u*11.0;
    float bulge = pressCompression*mix(0.18*sin(u*3.14159),0.10*shell,pressIsGlass);
    float bulgeDerivative = pressCompression*mix(0.18*3.14159*cos(u*3.14159),0.10*shellDerivative,pressIsGlass)*inside/h;
    float dxdx = 1.0+bulge;
    float dzdz = 1.0+bulge;
    float dxdy = sign(position.x)*foldDerivative*0.13 + position.x*bulgeDerivative
      + pressDamage*0.035*(cos(wave)*11.0*shell+sin(wave)*shellDerivative)*inside;
    float dxdz = cos(wave)*70.0*pressDamage*shell*h*0.035;
    float dzdy = sign(position.z)*foldDerivative*0.08 + position.z*bulgeDerivative;
    float dydy = mix(1.0-crush, u < 0.3 || u >= 0.7 ? 1.0-crush/0.6 : 1.0, pressIsGlass);
    // Cofactor of J = [dxdx dxdy dxdz; 0 dydy 0; 0 dzdy dzdz], i.e. det(J)·J^-T.
    vec3 n = objectNormal;
    objectNormal = vec3(dydy*dzdz*n.x,
      -(dxdy*dzdz-dxdz*dzdy)*n.x+dxdx*dzdz*n.y-dxdx*dzdy*n.z,
      -dxdz*dydy*n.x+dxdx*dydy*n.z);
    #ifdef USE_TANGENT
      objectTangent = vec3(dxdx*objectTangent.x+dxdy*objectTangent.y+dxdz*objectTangent.z,
        dydy*objectTangent.y,dzdy*objectTangent.y+dzdz*objectTangent.z);
    #endif
  }
`;

// Authored surface fracture on the generated cylinder. It changes appearance
// only; the core owns damage, failure and salvage value.
const CASSETTE_FRACTURE = `
  float cylinderAngle = atan(cassettePosition.z, cassettePosition.y - 0.074);
  vec2 impact = vec2(cassettePosition.x / 0.105 - 0.03, (cylinderAngle - 1.2) * 0.28);
  float fractureRadius = length(impact);
  float fractureAngle = atan(impact.y, impact.x);
  float spoke = abs(sin(fractureAngle * 3.0 + sin(fractureRadius * 43.0) * 0.12));
  float crack = (1.0-smoothstep(0.018,0.05+fwidth(spoke),spoke)) * smoothstep(0.03,0.08,fractureRadius);
  float ring = abs(fractureRadius - 0.26 - sin(fractureAngle * 7.0) * 0.014);
  crack = max(crack,1.0-smoothstep(0.006,0.012+fwidth(fractureRadius),ring));
  float opening = smoothstep(0.38,0.92,pressDamage);
  float holeEdge = fractureRadius - opening * (0.24 + sin(fractureAngle*5.0)*0.025 + sin(fractureAngle*13.0)*0.012);
  if (opening > 0.0 && holeEdge < 0.0) discard;
  float chip = (1.0-smoothstep(0.008,0.018+fwidth(fractureRadius),abs(holeEdge))) * opening;
  float cassetteCrack = max(crack * pressDamage,chip);
  diffuseColor.rgb = mix(diffuseColor.rgb,vec3(0.82,0.67,0.37),cassetteCrack*0.65);
  roughnessFactor = min(1.0,roughnessFactor + pressDamage*0.12 + cassetteCrack*0.3);
`;

export function deformSpecimen(root: Object3D, id: SalvageId): Deformation {
  const size = new Box3().setFromObject(root).getSize(new Vector3());
  const deformation: Deformation = { compression: { value: 0 }, damage: { value: 0 }, height: size.y, materials: [], depthMaterials: [] };
  const patchVertex = (shader: WebGLProgramParametersWithUniforms, glassSurface: boolean): void => {
    shader.uniforms['pressCompression'] = deformation.compression;
    shader.uniforms['pressDamage'] = deformation.damage;
    shader.uniforms['pressHeight'] = { value: Math.max(size.y, 0.01) };
    shader.uniforms['pressIsGlass'] = { value: id === 'salvage-core' ? 0 : 1 };
    shader.uniforms['pressGlassSurface'] = { value: glassSurface ? 1 : 0 };
    shader.vertexShader = DECLARATIONS + shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n' + VERTEX);
  };
  root.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    const source = Array.isArray(object.material) ? object.material : [object.material];
    const glassSurface = object.name.startsWith('lens-glass');
    const rigidSurface = glassSurface || object.name === 'cassette-window' || object.name === 'cassette-interior';
    const glassBox = new Box3().setFromObject(object);
    const glassCenter = glassBox.getCenter(new Vector3());
    const glassSize = glassBox.getSize(new Vector3());
    object.material = source.map((original) => {
      const material = original as MeshStandardMaterial;
      const prepareOptics = material.onBeforeCompile;
      const opticsKey = material.customProgramCacheKey();
      material.onBeforeCompile = (shader, renderer) => {
        patchVertex(shader, rigidSurface);
        shader.vertexShader = shader.vertexShader.replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\n' + NORMAL);
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
        // Optical masks must read the original albedo before damage darkens it.
        prepareOptics.call(material, shader, renderer);
        if (object.name === 'cassette-window') {
          shader.fragmentShader = shader.fragmentShader.replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n' + CASSETTE_FRACTURE)
            .replace('#include <transmission_fragment>', ShaderChunk.transmission_fragment.replace(
              'material.transmission = transmission;', 'material.transmission = transmission * (1.0-pressDamage*0.25) * (1.0-cassetteCrack*0.9);'));
        }
      };
      material.customProgramCacheKey = () => `deep-press-shell-v7-${id}-${rigidSurface}-${opticsKey}`;
      deformation.materials.push(material);
      return material;
    });
    if (object.material.length === 1) object.material = object.material[0]!;
    const depth = new MeshDepthMaterial({ depthPacking: RGBADepthPacking });
    depth.onBeforeCompile = (shader) => patchVertex(shader, rigidSurface);
    depth.customProgramCacheKey = () => `deep-press-shell-depth-v4-${id}-${rigidSurface}`;
    object.customDepthMaterial = depth;
    deformation.depthMaterials.push(depth);
    object.frustumCulled = false;
  });
  return deformation;
}
