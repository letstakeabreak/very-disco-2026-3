import { ACESFilmicToneMapping, AmbientLight, Box3, BufferGeometry, DirectionalLight, Float32BufferAttribute, LineBasicMaterial, LineLoop, Mesh, MeshLambertMaterial, MeshPhysicalMaterial, MeshStandardMaterial, PerspectiveCamera, Plane, PMREMGenerator, Quaternion, Raycaster, Scene, SRGBColorSpace, Vector2, Vector3, WebGLRenderer } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { deformSpecimen } from '../../../../src/render/deformation';
import { disposeObjects } from '../../../../src/render/resources';
import type { SalvageId } from '../../../../src/contracts';

// Pixels measured on the exact 1024×1536 shipping plate. Corners are rear-left,
// rear-right, front-right, front-left. Third rear-right is an extrapolated clipped corner.
const cavities = [
  [[882,780],[923,791],[892,867],[851,856]],
  [[940,793],[980,804],[951,881],[910,870]],
  [[997,806],[1037,817],[1010,895],[970,884]],
];
const ids: SalvageId[] = ['salvage-cassette','salvage-lens','salvage-core'];
const canvas = document.querySelector<HTMLCanvasElement>('canvas')!;
const stage = document.querySelector<HTMLElement>('#stage')!;
const label = document.querySelector<HTMLElement>('#label')!;
const gpu = new WebGLRenderer({canvas,antialias:true,alpha:true});
gpu.outputColorSpace=SRGBColorSpace;gpu.toneMapping=ACESFilmicToneMapping;gpu.toneMappingExposure=.95;
gpu.setClearColor(0,0);gpu.setPixelRatio(Math.min(2,devicePixelRatio));
const scene=new Scene();const camera=new PerspectiveCamera(34,2/3,.05,20);
camera.position.set(0,1.37,2.7);camera.lookAt(0,.4,0);camera.updateMatrixWorld();
const ray=new Raycaster();const table=new Plane(new Vector3(0,1,0),-.22);
const onTable=(u:number,v:number):Vector3=>{ray.setFromCamera(new Vector2(u*2-1,1-v*2),camera);return ray.ray.intersectPlane(table,new Vector3())!;};
scene.add(new AmbientLight('#7bb6bf',.35));
for(const [color,intensity,position] of [['#ffe1ac',3.2,[-1.8,2.8,2]],['#67b4c6',2.3,[1.2,1.7,-1.2]],['#abc5ca',.8,[.2,1.8,3.5]]] as const){const light=new DirectionalLight(color,intensity);light.position.set(position[0],position[1],position[2]);scene.add(light);}
const generator=new PMREMGenerator(gpu),room=new RoomEnvironment();
room.traverse(part=>{if(part instanceof Mesh&&part.material instanceof MeshLambertMaterial)part.material.emissive.set(part.position.x < -8?'#ffd095':part.position.x>8?'#70bdce':'#c1d5d6');});
const env=generator.fromScene(room,.06);scene.environment=env.texture;scene.environmentIntensity=.75;room.dispose();generator.dispose();
const props=await Promise.all(ids.map(async id=>{
  const {scene:root}=await new GLTFLoader().loadAsync(`/assets/models/${id}.glb`);
  root.traverse(part=>{if(!(part instanceof Mesh))return;if(part.name.startsWith('lens-glass'))part.material=new MeshPhysicalMaterial({color:'#add9d8',roughness:.09,metalness:0,transmission:.72,thickness:.025,ior:1.48,clearcoat:1,clearcoatRoughness:.05,attenuationColor:'#63a6ab',attenuationDistance:.16,envMapIntensity:1.2});
    for(const material of Array.isArray(part.material)?part.material:[part.material])if(material instanceof MeshStandardMaterial){material.envMapIntensity=.75;if(material.normalMap)material.normalScale.set(.55,.55);}});
  const bounds=new Box3().setFromObject(root);const deformation=deformSpecimen(root,id);deformation.compression.value=.55;scene.add(root);return{id,root,bounds,deformation};
}));
const outlines=cavities.map(()=>{const outline=new LineLoop(new BufferGeometry(),new LineBasicMaterial({color:'#8aff97',depthTest:false}));outline.renderOrder=10;scene.add(outline);return outline;});
let mode='aligned';let scale=.52;let fitCenter=true;let faceUp=true;let showOutlines=false;let report:unknown[]=[];
function layout():void{
  report=props.map((prop,i)=>{
    const q=cavities[i]!;const center=q.reduce((a,p)=>[a[0]!+p[0]!/4,a[1]!+p[1]!/4],[0,0]);
    const rear=[(q[0]![0]!+q[1]![0]!)/2,(q[0]![1]!+q[1]![1]!)/2];const front=[(q[2]![0]!+q[3]![0]!)/2,(q[2]![1]!+q[3]![1]!)/2];
    const axis=onTable(front[0]!/1024,front[1]!/1536).sub(onTable(rear[0]!/1024,rear[1]!/1536)).normalize();
    const yaw=Math.atan2(-axis.z,axis.x);const selectedScale=mode==='old'?.43:scale;
    prop.root.rotation.set(0,mode==='old'?-.32:yaw,0);prop.root.scale.setScalar(selectedScale);
    if(mode!=='old'&&faceUp)prop.root.quaternion.multiply(new Quaternion().setFromAxisAngle(new Vector3(1,0,0),-Math.PI/2));
    prop.root.position.copy(mode==='old'?onTable(.862+i*.05,.551+i*.012):onTable(center[0]!/1024,center[1]!/1536));
    const renderedHeight=prop.deformation.height*(1-.55*(prop.id==='salvage-lens'?.12:.52));
    if(mode!=='old'&&fitCenter)prop.root.position.sub(new Vector3(0,renderedHeight/2,0).applyQuaternion(prop.root.quaternion).multiplyScalar(selectedScale));
    prop.root.updateMatrixWorld(true);
    outlines[i]!.geometry.dispose();outlines[i]!.geometry=new BufferGeometry().setAttribute('position',new Float32BufferAttribute(q.flatMap(p=>onTable(p[0]!/1024,p[1]!/1536).toArray()),3));outlines[i]!.visible=showOutlines;
    return{id:prop.id,centerUV:[center[0]!/1024,center[1]!/1536],rearUV:[rear[0]!/1024,rear[1]!/1536],frontUV:[front[0]!/1024,front[1]!/1536],yawRadians:yaw,faceUp,quaternion:prop.root.quaternion.toArray(),scale:selectedScale,position:prop.root.position.toArray(),renderedHeight};
  });
  label.textContent=`ACTUAL WEBGL · LAYOUT STUDY · NOT GAMEPLAY\n${mode} / SCALE ${mode==='old'?.43:scale} / FACE UP ${mode!=='old'&&faceUp} / FOV ${camera.fov} / fixtures compression .55\nGeometry + PBR: unchanged runtime GLBs. No case depth/occlusion geometry.`;
}
const resize=()=>{gpu.setSize(stage.clientWidth,stage.clientHeight,false);};new ResizeObserver(resize).observe(stage);resize();layout();
let frameId=0;const frame=()=>{gpu.render(scene,camera);frameId=requestAnimationFrame(frame);};frame();
Object.assign(window,{__layoutStudy:{get ready(){return true;},get report(){return report;},set(options:{mode?:string;scale?:number;fitCenter?:boolean;faceUp?:boolean;outlines?:boolean;fov?:number;lookY?:number}){mode=options.mode??mode;scale=options.scale??scale;fitCenter=options.fitCenter??fitCenter;faceUp=options.faceUp??faceUp;showOutlines=options.outlines??showOutlines;camera.fov=options.fov??camera.fov;if(options.lookY!==undefined)camera.lookAt(0,options.lookY,0);camera.updateProjectionMatrix();camera.updateMatrixWorld();layout();}}});
window.addEventListener('pagehide',()=>{cancelAnimationFrame(frameId);disposeObjects([...props.map(p=>p.root),...outlines]);props.forEach(p=>p.deformation.depthMaterials.forEach(m=>m.dispose()));env.dispose();gpu.dispose();},{once:true});
