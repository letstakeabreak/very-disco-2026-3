import { Mesh, MeshPhysicalMaterial, MeshStandardMaterial } from 'three';
import type { Object3D, WebGLProgramParametersWithUniforms } from 'three';

// Texture hue plus the measured central cylinder selects generated glass faces.
// Keep the original UVs and mesh; this is an optical restoration, not new artwork.
const MASK = `float cassetteWindow = smoothstep(1.28,1.5,diffuseColor.r/max(diffuseColor.g,.001))
  * smoothstep(1.3,1.6,diffuseColor.g/max(diffuseColor.b,.001))
  * smoothstep(.06,.12,diffuseColor.r) * (1.0-smoothstep(.057,.07,abs(cassettePosition.x)));`;

function patchMask(shader: WebGLProgramParametersWithUniforms, window: boolean): void {
  shader.vertexShader = 'varying vec3 cassettePosition;\n' + shader.vertexShader.replace(
    '#include <begin_vertex>', '#include <begin_vertex>\ncassettePosition=position;');
  shader.fragmentShader = 'varying vec3 cassettePosition;\n' + shader.fragmentShader.replace(
    '#include <color_fragment>', `#include <color_fragment>\n${MASK}\nif(cassetteWindow${window ? '<=' : '>'}.05)discard;`);
}

/** Separate the opaque housing from the transmission pass so the new internal
 * Meshy component and far housing can both appear through the amber window. */
export function prepareCassette(root: Object3D): void {
  const shells: Mesh[] = [];
  root.traverse(object => { if (object instanceof Mesh && object.name === 'salvage-cassette') shells.push(object); });
  for (const shell of shells) {
    if (!(shell.material instanceof MeshStandardMaterial)) continue;
    const opaque = shell.material;
    opaque.onBeforeCompile = shader => patchMask(shader, false);
    opaque.customProgramCacheKey = () => 'deep-press-cassette-housing-v1';
    const glass = new MeshPhysicalMaterial({ map: opaque.map,
      color: opaque.color, roughness: .08, metalness: 0, transmission: .94,
      thickness: .006, ior: 1.46, clearcoat: .35, clearcoatRoughness: .08,
      attenuationColor: '#ffd174', attenuationDistance: .025, envMapIntensity: 1.35 });
    glass.onBeforeCompile = shader => {
      patchMask(shader, true);
      shader.fragmentShader = shader.fragmentShader.replace(
        'if(cassetteWindow<=.05)discard;', 'if(cassetteWindow<=.05)discard;\ndiffuseColor.rgb=vec3(1.0,.62,.12);');
    };
    glass.customProgramCacheKey = () => 'deep-press-cassette-glass-v1';
    const window = shell.clone(); window.name = 'cassette-window'; window.material = glass;
    window.castShadow = false;
    shell.parent!.add(window);
  }
}
