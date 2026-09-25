import { Mesh, MeshPhysicalMaterial, MeshStandardMaterial, ShaderChunk, Vector3 } from 'three';
import type { WebGLProgramParametersWithUniforms, WebGLRenderer } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { deformSpecimen } from '../../../../src/render/deformation';
import { animateRam, PRESS_ANCHORS } from '../../../../src/render/ram';
import { prepareCassette } from '../../../../src/render/cassette';
import { disposeObjects } from '../../../../src/render/resources';
import type { SalvageId } from '../../../../src/contracts';

type Sample = { point: Vector3; normal: Vector3; tangent: Vector3; bitangent: Vector3 };
type Case = { asset: string; mesh: string; compression: number; damage: number; travel: number;
  samples: number; maxNormalDegrees: number; maxTangentDegrees: number; maxOrthogonalityError: number; passed: boolean };
const cases: Case[] = [];
const report = { kind: 'Actual GLSL transform feedback, numerical surface derivatives from the same GPU position output, sampled real GLB vertices. Not gameplay or iPhone performance.', cases, passed: false, error: '' };
Object.assign(window, { __normalCheck: report });
const canvas = document.createElement('canvas');
const gl = canvas.getContext('webgl2');
if (!gl) throw new Error('WebGL 2 unavailable');
const gpu = gl;

function program(vertex: string): WebGLProgram {
  const p = gpu.createProgram()!;
  const shaders = [[gpu.VERTEX_SHADER, vertex], [gpu.FRAGMENT_SHADER, '#version 300 es\nprecision highp float;out vec4 color;void main(){color=vec4(1);}']] as const;
  for (const [type, source] of shaders) {
    const shader = gpu.createShader(type)!; gpu.shaderSource(shader, source); gpu.compileShader(shader);
    if (!gpu.getShaderParameter(shader, gpu.COMPILE_STATUS)) throw new Error(gpu.getShaderInfoLog(shader) ?? 'Compile failed');
    gpu.attachShader(p, shader); gpu.deleteShader(shader);
  }
  gpu.transformFeedbackVaryings(p, ['qaPosition', 'qaNormal', 'qaTangent'], gpu.INTERLEAVED_ATTRIBS);
  gpu.linkProgram(p);
  if (!gpu.getProgramParameter(p, gpu.LINK_STATUS)) throw new Error(gpu.getProgramInfoLog(p) ?? 'Link failed');
  return p;
}

function check(mesh: Mesh, height: number, entry: Omit<Case, 'samples'|'maxNormalDegrees'|'maxTangentDegrees'|'maxOrthogonalityError'|'passed'>): void {
  const material = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as MeshStandardMaterial;
  const shader = { uniforms: {}, fragmentShader: '#include <color_fragment>', vertexShader: `
    in vec3 position; in vec3 normal; in vec4 tangent;
    out vec3 qaPosition; out vec3 qaNormal; out vec3 qaTangent;
    void main(){
      #include <beginnormal_vertex>
      #include <begin_vertex>
      qaPosition=transformed;qaNormal=normalize(objectNormal);qaTangent=normalize(objectTangent);
      gl_Position=vec4(0,0,0,1);
    }` } as unknown as WebGLProgramParametersWithUniforms;
  material.onBeforeCompile(shader, {} as WebGLRenderer);
  const source = '#version 300 es\nprecision highp float;\n#define USE_TANGENT\n' + shader.vertexShader
    .replaceAll('varying ', 'out ').replace('#include <beginnormal_vertex>', ShaderChunk.beginnormal_vertex)
    .replace('#include <begin_vertex>', ShaderChunk.begin_vertex);
  const p = program(source); gpu.useProgram(p);
  for (const [name, uniform] of Object.entries(shader.uniforms)) {
    const location = gpu.getUniformLocation(p, name);
    if (location !== null && typeof uniform.value === 'number') gpu.uniform1f(location, uniform.value);
  }
  const positions = mesh.geometry.getAttribute('position');
  const normals = mesh.geometry.getAttribute('normal');
  const epsilon = height * .0005;
  const samples: Sample[] = [];
  const input: number[] = [];
  const stride = Math.max(1, Math.floor(positions.count / 160));
  for (let i = 0; i < positions.count; i += stride) {
    const point = new Vector3().fromBufferAttribute(positions, i);
    const normal = new Vector3().fromBufferAttribute(normals, i).normalize();
    const u = point.y / height;
    // The authored map has hard derivative boundaries here. Probe the smooth
    // surfaces on each side, not the undefined derivative across a crease.
    if (Math.abs(point.x) < epsilon * 4 || Math.abs(point.z) < epsilon * 4 ||
      [0,.3,.7,1].some(edge => Math.abs(u-edge)<.005)) continue;
    const tangent = new Vector3().crossVectors(normal, Math.abs(normal.x)<.8 ? new Vector3(1,0,0) : new Vector3(0,1,0)).normalize();
    const bitangent = new Vector3().crossVectors(normal,tangent).normalize();
    samples.push({ point, normal, tangent, bitangent });
    for (const offset of [new Vector3(), tangent.clone().multiplyScalar(epsilon), tangent.clone().multiplyScalar(-epsilon), bitangent.clone().multiplyScalar(epsilon), bitangent.clone().multiplyScalar(-epsilon)]) {
      input.push(...point.clone().add(offset).toArray(), ...normal.toArray(), ...tangent.toArray(), 1);
    }
  }
  if (samples.length < 8) throw new Error(`Insufficient actual mesh samples: ${mesh.name}`);
  const vao = gpu.createVertexArray()!; gpu.bindVertexArray(vao);
  const inputBuffer = gpu.createBuffer()!; gpu.bindBuffer(gpu.ARRAY_BUFFER,inputBuffer); gpu.bufferData(gpu.ARRAY_BUFFER,new Float32Array(input),gpu.STATIC_DRAW);
  for (const [name, size, offset] of [['position',3,0],['normal',3,3],['tangent',4,6]] as const) {
    const location=gpu.getAttribLocation(p,name); gpu.enableVertexAttribArray(location); gpu.vertexAttribPointer(location,size,gpu.FLOAT,false,40,offset*4);
  }
  const outputBuffer = gpu.createBuffer()!; gpu.bindBuffer(gpu.TRANSFORM_FEEDBACK_BUFFER,outputBuffer);
  const output = new Float32Array(samples.length*5*9);
  gpu.bufferData(gpu.TRANSFORM_FEEDBACK_BUFFER,output.byteLength,gpu.STREAM_READ);
  const feedback = gpu.createTransformFeedback()!; gpu.bindTransformFeedback(gpu.TRANSFORM_FEEDBACK,feedback);
  gpu.bindBufferBase(gpu.TRANSFORM_FEEDBACK_BUFFER,0,outputBuffer); gpu.enable(gpu.RASTERIZER_DISCARD);
  gpu.beginTransformFeedback(gpu.POINTS); gpu.drawArrays(gpu.POINTS,0,samples.length*5); gpu.endTransformFeedback();
  gpu.disable(gpu.RASTERIZER_DISCARD); gpu.getBufferSubData(gpu.TRANSFORM_FEEDBACK_BUFFER,0,output);
  if (gpu.getError()!==gpu.NO_ERROR) throw new Error('Transform feedback GPU error');
  let maxNormalDegrees=0, maxTangentDegrees=0, maxOrthogonalityError=0;
  const vector=(start:number) => new Vector3(output[start]!,output[start+1]!,output[start+2]!);
  for (let i=0;i<samples.length;i++) {
    const base=i*45;
    const tangent=vector(base+9).sub(vector(base+18)).normalize();
    const bitangent=vector(base+27).sub(vector(base+36)).normalize();
    const expectedNormal=new Vector3().crossVectors(tangent,bitangent).normalize();
    const actualNormal=vector(base+3).normalize(), actualTangent=vector(base+6).normalize();
    maxNormalDegrees=Math.max(maxNormalDegrees,expectedNormal.angleTo(actualNormal)*180/Math.PI);
    maxTangentDegrees=Math.max(maxTangentDegrees,tangent.angleTo(actualTangent)*180/Math.PI);
    maxOrthogonalityError=Math.max(maxOrthogonalityError,Math.abs(actualNormal.dot(actualTangent)));
  }
  cases.push({ ...entry,samples:samples.length,maxNormalDegrees,maxTangentDegrees,maxOrthogonalityError,
    passed:maxNormalDegrees<1 && maxTangentDegrees<1 && maxOrthogonalityError<.0001 });
  gpu.bindTransformFeedback(gpu.TRANSFORM_FEEDBACK,null);gpu.bindVertexArray(null);
  gpu.deleteTransformFeedback(feedback);gpu.deleteBuffer(inputBuffer);gpu.deleteBuffer(outputBuffer);gpu.deleteVertexArray(vao);gpu.deleteProgram(p);
}

try {
  for (const id of ['salvage-core','salvage-lens','salvage-cassette'] as SalvageId[]) {
    const { scene } = await new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}assets/models/${id}.glb`);
    // Match production prepareMesh: glass receives its own material before
    // deformation. The generated lens parts otherwise share the opaque one.
    scene.traverse(object => {
      if (object instanceof Mesh && object.name.startsWith('lens-glass')) object.material = new MeshPhysicalMaterial();
    });
    if (id==='salvage-cassette') prepareCassette(scene);
    const deformation=deformSpecimen(scene,id);
    const meshes: Mesh[]=[];scene.traverse(object=>{if(object instanceof Mesh)meshes.push(object);});
    for (const [compression,damage] of [[0,0],[.6,0],[.6,.5],[1,1]] as const) {
      deformation.compression.value=compression;deformation.damage.value=damage;
      for(const mesh of meshes) check(mesh,deformation.height,{asset:id,mesh:mesh.name,compression,damage,travel:0});
    }
    disposeObjects([scene]);deformation.depthMaterials.forEach(material=>material.dispose());
  }
  const { scene } = await new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}assets/models/press-chamber.glb`);
  const ram=animateRam(scene);const mesh=scene.getObjectByName('press-ram') as Mesh;
  for(const travel of [-.09,0,PRESS_ANCHORS.travel]) {
    ram.travel.value=travel;check(mesh,1.1,{asset:'press-chamber',mesh:mesh.name,compression:0,damage:0,travel});
  }
  disposeObjects([scene]);ram.depthMaterials.forEach(material=>material.dispose());
  report.passed=cases.every(item=>item.passed);
} catch(error) { report.error=String(error); }
document.querySelector('#status')!.textContent=report.passed?'PASS':'FAIL';
document.querySelector('#report')!.textContent=JSON.stringify(report,null,2);
gpu.getExtension('WEBGL_lose_context')?.loseContext();
