import { ACESFilmicToneMapping, Box3, DirectionalLight, DoubleSide, HemisphereLight, Mesh, MeshStandardMaterial, PerspectiveCamera, Plane, Scene, Vector3, WebGLRenderer } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { Object3D } from 'three';
const mode = new URLSearchParams(location.search).get('mode') ?? 'textured';
const canvas=document.querySelector('canvas')!;
const gpu=new WebGLRenderer({canvas,antialias:true});gpu.setClearColor('#223039');gpu.setPixelRatio(1);gpu.toneMapping=ACESFilmicToneMapping;gpu.toneMappingExposure=1;gpu.localClippingEnabled=true;
const paths=['/assets/source/meshy/salvage-cassette/salvage-cassette-master.glb','/assets/models/salvage-cassette.glb'];
const scenes:Scene[]=[];const cameras:PerspectiveCamera[]=[];const roots:Object3D[]=[];const errors:string[]=[];let loaded=0;let frames=0;let frameId=0;
document.querySelector('#title')!.textContent=mode==='cut'?'CENTER WINDOW CUTAWAY · GRAY: FRONT FACE / TEAL: BACK FACE':'UNMODIFIED GENERATED SURFACE · TEXTURED COMPARISON';
function report(message:string):void{errors.push(message);document.querySelector('#fatal')!.textContent=message;}
for(let i=0;i<2;i+=1){const scene=new Scene();scene.add(new HemisphereLight('#dde8ee','#324150',2.4));const key=new DirectionalLight('#fff1d8',3);key.position.set(-.5,.7,1);scene.add(key);scenes.push(scene);const camera=new PerspectiveCamera(33,1,.001,10);camera.position.set(.34,.29,.61);camera.lookAt(0,.065,0);cameras.push(camera);
 void new GLTFLoader().loadAsync(paths[i]!).then(({scene:root})=>{const bounds=new Box3().setFromObject(root);const size=bounds.getSize(new Vector3());root.scale.setScalar(.28/size.x);bounds.setFromObject(root);const center=bounds.getCenter(new Vector3());root.position.set(-center.x,-bounds.min.y,-center.z);root.updateMatrixWorld(true);root.traverse(object=>{if(!(object instanceof Mesh))return;if(mode==='cut'){
  const old=object.material;const material=new MeshStandardMaterial({color:'#bccbd1',roughness:.85,metalness:0,side:DoubleSide,clippingPlanes:[new Plane(new Vector3(0,0,-1),0),new Plane(new Vector3(1,0,0),.045),new Plane(new Vector3(-1,0,0),.045)]});
  material.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.rgb = gl_FrontFacing ? vec3(0.65,0.71,0.75) : vec3(0.07,0.48,0.52);');};object.material=material;(Array.isArray(old)?old:[old]).forEach(m=>m.dispose());
 } });scene.add(root);roots.push(root);loaded+=1;}).catch(error=>report(String(error)));}
function resize():void{gpu.setSize(innerWidth,innerHeight,false);cameras.forEach(camera=>{camera.aspect=(innerWidth/2)/innerHeight;camera.updateProjectionMatrix();});}
resize();window.addEventListener('resize',resize);
function frame():void{gpu.setScissorTest(true);for(let i=0;i<2;i+=1){gpu.setViewport(i*innerWidth/2,0,innerWidth/2,innerHeight);gpu.setScissor(i*innerWidth/2,0,innerWidth/2,innerHeight);gpu.render(scenes[i]!,cameras[i]!);}frames+=1;frameId=requestAnimationFrame(frame);}
frameId=requestAnimationFrame(frame);
Object.assign(window,{__structureProbe:{get ready(){return loaded===2&&frames>3;},get errors(){return errors;},get mode(){return mode;},get loaded(){return loaded;}}});
window.addEventListener('error',({message})=>report(message));window.addEventListener('unhandledrejection',({reason})=>report(String(reason)));
window.addEventListener('pagehide',()=>{cancelAnimationFrame(frameId);for(const root of roots)root.traverse(object=>{if(object instanceof Mesh){object.geometry.dispose();(Array.isArray(object.material)?object.material:[object.material]).forEach(material=>material.dispose());}});gpu.dispose();},{once:true});
