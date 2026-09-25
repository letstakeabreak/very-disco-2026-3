import { DirectionalLight, Mesh, PlaneGeometry, Scene, ShadowMaterial } from 'three';
import type { WebGLRenderTarget } from 'three';
import { createRenderer } from '../../../../src/render';
import { DEFAULT_GAME_CONFIG, SNAPSHOT_FIXTURES } from '../../../../src/contracts/fixtures';
import { assertSnapshot, deepFreeze } from '../../../../src/contracts/validate';
import './capture.css';
const variant = new URLSearchParams(location.search).get('variant') ?? 'baseline';
const canvas = document.querySelector<HTMLCanvasElement>('#art-canvas')!;
const errors: string[] = [];
const report = (message: string): void => { errors.push(message); document.querySelector('#fatal')!.textContent=message; };
let sceneFacts: Record<string, unknown> = {};
let depthFacts: Record<string, unknown> = {};
let received = false;
const originalBeforeRender = Mesh.prototype.onBeforeRender;
Mesh.prototype.onBeforeRender = function (renderer, scene, camera, geometry, material, group): void {
  originalBeforeRender.call(this,renderer,scene,camera,geometry,material,group);
  const receivers: Mesh[] = []; let key: DirectionalLight | undefined;
  scene.traverse(object => {
    if(object instanceof Mesh && object.material instanceof ShadowMaterial) receivers.push(object);
    if(object instanceof DirectionalLight && object.castShadow) key=object;
  });
  const bed = receivers.find(mesh => mesh.geometry instanceof PlaneGeometry && mesh.geometry.parameters.width === 0.3);
  if(bed && variant === 'receive') bed.receiveShadow=true;
  if(!(scene instanceof Scene) || !bed || canvas.dataset['renderState'] !== 'ready' || received) return;
  received = true;
  sceneFacts = {variant,camera:camera.position.toArray(),receivers:receivers.map(mesh=>({name:mesh.name,parent:mesh.parent?.name,receiveShadow:mesh.receiveShadow,castShadow:mesh.castShadow,visible:mesh.visible,position:mesh.position.toArray(),worldPosition:mesh.matrixWorld.elements.slice(12,15),opacity:(mesh.material as ShadowMaterial).opacity,depthTest:(mesh.material as ShadowMaterial).depthTest,depthWrite:(mesh.material as ShadowMaterial).depthWrite})),key:key?{position:key.position.toArray(),target:key.target.position.toArray(),normalBias:key.shadow.normalBias,bias:key.shadow.bias,mapSize:key.shadow.mapSize.toArray()}:null};
  if(key?.shadow.map){
    const target=key.shadow.map as WebGLRenderTarget; const buffer=new Uint8Array(target.width*target.height*4);
    renderer.readRenderTargetPixels(target,0,0,target.width,target.height,buffer);
    let allWhite=0,nonWhite=0,minR=255,maxR=0;
    for(let i=0;i<buffer.length;i+=4){if(buffer[i]===255&&buffer[i+1]===255&&buffer[i+2]===255&&buffer[i+3]===255)allWhite+=1;else nonWhite+=1;minR=Math.min(minR,buffer[i]!);maxR=Math.max(maxR,buffer[i]!);}
    depthFacts={width:target.width,height:target.height,allWhite,nonWhite,minR,maxR,format:target.texture.format,type:target.texture.type};
  }
};
const definition=DEFAULT_GAME_CONFIG.specimens.find(({id})=>id==='salvage-cassette')!;
const snapshot=deepFreeze({...SNAPSHOT_FIXTURES.inspecting,inspectionYawRad:0.45,pressure01:0,currentSpecimen:{id:definition.id,material:definition.material,currentVolume:definition.initialVolume,integrity01:1,value:definition.baseValue,compression01:0}});
assertSnapshot(snapshot);
const viewer=createRenderer({canvas,onFatal:({code,message})=>report(`${code}: ${message}`)});
document.querySelector('#title')!.textContent=`CONTACT SHADOW / ${variant.toUpperCase()}`;
let frames=0;let frameId=0;
const resize=():void=>viewer.resize({width:canvas.clientWidth,height:canvas.clientHeight,dpr:Math.min(2,devicePixelRatio)});
const observer=new ResizeObserver(resize);observer.observe(canvas);resize();
const frame=():void=>{viewer.render(snapshot,16);frames+=1;document.querySelector('#status')!.textContent=canvas.dataset['renderState']??'loading';frameId=requestAnimationFrame(frame);};
frameId=requestAnimationFrame(frame);
window.addEventListener('error',({message})=>report(message));window.addEventListener('unhandledrejection',({reason})=>report(String(reason)));
Object.assign(window,{__shadowProbe:{get ready(){return received&&frames>3&&canvas.dataset['renderState']==='ready';},get errors(){return errors;},get status(){return {...canvas.dataset};},get sceneFacts(){return sceneFacts;},get depthFacts(){return depthFacts;}}});
const dispose=():void=>{cancelAnimationFrame(frameId);observer.disconnect();viewer.dispose();Mesh.prototype.onBeforeRender=originalBeforeRender;};
window.addEventListener('pagehide',dispose,{once:true});if(import.meta.hot)import.meta.hot.dispose(dispose);
