import { ACESFilmicToneMapping, AmbientLight, DirectionalLight, Mesh, MeshLambertMaterial, MeshStandardMaterial,
  PCFShadowMap, PerspectiveCamera, PMREMGenerator, Scene, SRGBColorSpace, TextureLoader, WebGLRenderer } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { animateRam, PRESS_ANCHORS } from '../../../../src/render/ram';
import { deformSpecimen } from '../../../../src/render/deformation';
import { createGauge } from '../../../../src/render/gauge';
import { disposeObjects } from '../../../../src/render/resources';
import './viewer.css';
const query=new URLSearchParams(location.search);
const pose=query.get('pose')??'rest';
const view=query.get('view')??'front';
if(!['rest','retracted','retracted80','contact'].includes(pose))throw new Error('Unknown pose');
const canvas=document.querySelector('canvas')!;
const probe={ready:false,errors:[] as string[],pose,view,travel:0,compression:0,ramBottomY:0,specimenTopY:0,clearance:0,loadedGlbs:0,frames:0};
Object.assign(window,{__retractionProbe:probe});
const fail=(error:unknown):void=>{probe.errors.push(String(error));document.querySelector('#status')!.textContent='ERROR';};
window.addEventListener('error',e=>fail(e.message));window.addEventListener('unhandledrejection',e=>fail(e.reason));
const gpu=new WebGLRenderer({canvas,antialias:true});
gpu.outputColorSpace=SRGBColorSpace;gpu.toneMapping=ACESFilmicToneMapping;gpu.toneMappingExposure=.95;
gpu.setClearColor('#283134');gpu.shadowMap.enabled=true;gpu.shadowMap.type=PCFShadowMap;
const scene=new Scene();const camera=new PerspectiveCamera(34,innerWidth/innerHeight,.02,20);
camera.position.fromArray(view==='oblique'?[1.05,1.05,1.8]:[0,.96,1.7]);
camera.lookAt(.02,.67,-.09);camera.updateMatrixWorld();
scene.add(new AmbientLight('#d2d4d3',.12));
const key=new DirectionalLight('#ffe1ac',2.6);key.position.set(-1.8,2.8,2);key.target.position.set(0,.6,0);
key.castShadow=true;key.shadow.mapSize.set(1024,1024);key.shadow.normalBias=.0015;key.shadow.bias=-.00005;
key.shadow.camera.left=-1.3;key.shadow.camera.right=1.3;key.shadow.camera.top=1.8;key.shadow.camera.bottom=-1;
scene.add(key,key.target);
const rim=new DirectionalLight('#b4cbda',1.2);rim.position.set(1.2,1.7,-1.2);scene.add(rim);
const fill=new DirectionalLight('#abc5ca',.3);fill.position.set(.2,1.8,3.5);scene.add(fill);
const generator=new PMREMGenerator(gpu);const room=new RoomEnvironment();
room.traverse(object=>{if(!(object instanceof Mesh)||!(object.material instanceof MeshLambertMaterial))return;
  if(object.material.emissiveIntensity>2){object.material.emissive.set(object.position.x < -8?'#ffe2ba':'#edf3ff');
    if(Math.abs(object.position.x)>8)object.scale.z*=.45;else if(Math.abs(object.position.z)>8)object.scale.x*=.45;
  }else object.material.color.multiplyScalar(.35);
});
const environment=generator.fromScene(room,.02);scene.environment=environment.texture;room.dispose();generator.dispose();
const loader=new GLTFLoader();
const url=(path:string):string=>`${import.meta.env.BASE_URL}assets/${path}`;
let disposed=false;let cleanup=():void=>{};
const resize=():void=>{gpu.setPixelRatio(1);gpu.setSize(innerWidth,innerHeight,false);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();};
resize();window.addEventListener('resize',resize);
void Promise.all([loader.loadAsync(url('models/press-chamber.glb')),loader.loadAsync(url('models/salvage-cassette.glb')),new TextureLoader().loadAsync(url('textures/pressure-dial.webp'))]).then(([pressGlb,cassetteGlb,dial])=>{
 const press=pressGlb.scene,cassette=cassetteGlb.scene;dial.colorSpace=SRGBColorSpace;
 if(disposed){disposeObjects([press,cassette],[dial]);return;}
 for(const root of [press,cassette]){const prepared=new Set<MeshStandardMaterial>();root.traverse(object=>{
  if(!(object instanceof Mesh))return;object.castShadow=true;object.receiveShadow=true;
  for(const material of Array.isArray(object.material)?object.material:[object.material]){
   if(!(material instanceof MeshStandardMaterial)||prepared.has(material))continue;prepared.add(material);
   material.envMapIntensity=1.35;if(root===press)material.roughness*=.72;
   if(material.normalMap)material.normalScale.set(.55,.55);
  }
 });scene.add(root);}
 const ram=animateRam(press),deformation=deformSpecimen(cassette,'salvage-cassette');
 const compression=pose==='contact'?.6:0;deformation.compression.value=compression;
 cassette.position.set(PRESS_ANCHORS.x,PRESS_ANCHORS.workbedY+PRESS_ANCHORS.clearance,PRESS_ANCHORS.z);
 cassette.rotation.y=.45;cassette.scale.setScalar(1.1);
 const specimenTopY=cassette.position.y+deformation.height*(1-compression*.52)*1.1;
 const travel=pose==='retracted'?-.09:pose==='retracted80'?-.08:pose==='contact'?Math.max(0,PRESS_ANCHORS.platenY-specimenTopY):0;
 ram.travel.value=travel;const gauge=createGauge(dial);gauge.setPressure(compression);press.add(gauge.root);
 Object.assign(probe,{ready:true,loadedGlbs:2,travel,compression,specimenTopY,ramBottomY:PRESS_ANCHORS.platenY-travel,clearance:PRESS_ANCHORS.platenY-travel-specimenTopY});
 document.querySelector('#title')!.textContent=`RAM / ${pose.toUpperCase()} / ${view.toUpperCase()}`;
 document.querySelector('#status')!.textContent='READY · DPR 1';
 document.querySelector('#metrics')!.textContent=`travel ${travel.toFixed(5)} m · top connection fixed\nplaten–specimen bounds gap ${(probe.clearance*1000).toFixed(1)} mm · scale 1.1 · yaw 0.45\nIndependent lighting/camera · snapshot-driven shader pose only`;
 cleanup=()=>{disposeObjects([press,cassette],[dial]);for(const depth of [...ram.depthMaterials,...deformation.depthMaterials])depth.dispose();};
}).catch(fail);
let frame=0;
const draw=():void=>{if(disposed)return;gpu.render(scene,camera);probe.frames++;frame=requestAnimationFrame(draw);};draw();
const dispose=():void=>{if(disposed)return;disposed=true;cancelAnimationFrame(frame);window.removeEventListener('resize',resize);cleanup();environment.dispose();key.shadow.dispose();gpu.dispose();};
window.addEventListener('pagehide',dispose);if(import.meta.hot)import.meta.hot.dispose(dispose);
