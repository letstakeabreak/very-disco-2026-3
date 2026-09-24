import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {Vector3,Box3,Matrix4,BufferGeometry,Float32BufferAttribute,Mesh,MeshBasicMaterial,DoubleSide,Raycaster} from 'three';
const root=fileURLToPath(new URL('../../../../',import.meta.url));
const out=fileURLToPath(new URL('./',import.meta.url));
mkdirSync(out,{recursive:true});
const sha=path=>createHash('sha256').update(readFileSync(root+path)).digest('hex');
function load(name){
 const bytes=readFileSync(root+`public/assets/models/${name}.glb`);const jsonLength=bytes.readUInt32LE(12);const json=JSON.parse(bytes.subarray(20,20+jsonLength).toString());const bin=bytes.subarray(28+jsonLength);
 function accessor(id){const a=json.accessors[id],v=json.bufferViews[a.bufferView];if(a.sparse)throw new Error('Unsupported sparse');const width={SCALAR:1,VEC2:2,VEC3:3,VEC4:4}[a.type];const [size,read]={5126:[4,'readFloatLE'],5125:[4,'readUInt32LE'],5123:[2,'readUInt16LE'],5121:[1,'readUInt8']}[a.componentType];return Array.from({length:a.count},(_,i)=>Array.from({length:width},(_,c)=>bin[read]((v.byteOffset??0)+(a.byteOffset??0)+i*(v.byteStride??size*width)+c*size)));}
 return json.nodes.filter(n=>n.mesh!==undefined).map(node=>{if(node.matrix||node.translation||node.rotation||node.scale)throw new Error('Expected actual baked mesh in asset-root coordinates');const p=json.meshes[node.mesh].primitives[0];const vertices=accessor(p.attributes.POSITION).map(p=>new Vector3(...p));const indices=accessor(p.indices).flat();const triangles=[];for(let i=0;i<indices.length;i+=3){const t=indices.slice(i,i+3).map(n=>vertices[n]);const cross=new Vector3().subVectors(t[1],t[0]).cross(new Vector3().subVectors(t[2],t[0]));triangles.push({p:t,normal:cross.clone().normalize(),area:cross.length()/2,center:t.reduce((s,v)=>s.add(v),new Vector3()).multiplyScalar(1/3)});}return{name:node.name,vertices,triangles,bounds:new Box3().setFromPoints(vertices)};});
}
const press=load('press-chamber'),frame=press.find(m=>m.name==='press-frame'),ram=press.find(m=>m.name==='press-ram'),cassette=load('salvage-cassette')[0];
function ray(triangles,x,z,ymax=.48,bottom=false){let best=bottom?Infinity:-Infinity,face=null;for(const t of triangles){const[a,b,c]=t.p;const den=(b.z-c.z)*(a.x-c.x)+(c.x-b.x)*(a.z-c.z);if(Math.abs(den)<1e-12)continue;const u=((b.z-c.z)*(x-c.x)+(c.x-b.x)*(z-c.z))/den;const v=((c.z-a.z)*(x-c.x)+(a.x-c.x)*(z-c.z))/den;if(u< -1e-8||v< -1e-8||u+v>1+1e-8)continue;const y=u*a.y+v*b.y+(1-u-v)*c.y;if(y>=ymax)continue;if(bottom?y<best:y>best){best=y;face=t;}}return Number.isFinite(best)?{y:best,normal:face.normal.toArray()}:null;}
const roi=t=>t.center.x>-.22&&t.center.x<.25&&t.center.z>-.30&&t.center.z<.28&&t.center.y>.28&&t.center.y<.41;
const flat=frame.triangles.filter(t=>roi(t)&&t.normal.y>.97);
const histogram={};for(const t of flat){const key=(Math.round(t.center.y/.001)*.001).toFixed(3);histogram[key]=(histogram[key]??0)+t.area;}
const bins=Object.entries(histogram).sort((a,b)=>b[1]-a[1]);
const sections=[-.1,0,.0214740932,.1].map(x=>({x,samples:Array.from({length:111},(_,i)=>{const z=-.275+i*.005;return{z,...ray(frame.triangles,x,z)};})}));
const anchor={x:.021474093198776245,y:.36873742938041687,z:-.09367392398416996,clearance:.003};
const report={checkedAt:new Date().toISOString(),units:'meters; baked GLB asset-root +Y up, +Z front',inputs:Object.fromEntries(['press-chamber','salvage-cassette'].map(id=>[`public/assets/models/${id}.glb`,sha(`public/assets/models/${id}.glb`)])),bounds:Object.fromEntries([...press,cassette].map(m=>[m.name,{min:m.bounds.min.toArray(),max:m.bounds.max.toArray(),center:m.bounds.getCenter(new Vector3()).toArray(),triangles:m.triangles.length}])),anchor,flatUpwardFaceHeightAreaBins:bins,sections,atAnchor:ray(frame.triangles,anchor.x,anchor.z),ramUndersideAtAnchor:ray(ram.triangles,anchor.x,anchor.z,2,true)};
const checkGeometry=new BufferGeometry();checkGeometry.setAttribute('position',new Float32BufferAttribute(frame.triangles.flatMap(t=>t.p.flatMap(p=>p.toArray())),3));
const checkMesh=new Mesh(checkGeometry,new MeshBasicMaterial({side:DoubleSide}));checkMesh.updateMatrixWorld(true);
const rayCrossChecks=[[anchor.x,anchor.z],[.021474,0],[.021474,.20]].map(([x,z])=>{const actual=new Raycaster(new Vector3(x,.48,z),new Vector3(0,-1,0)).intersectObject(checkMesh)[0]?.point.y;const measured=ray(frame.triangles,x,z)?.y;if(actual===undefined||measured===undefined||Math.abs(actual-measured)>1e-8)throw new Error('Three.js Raycaster cross-check failed');return{x,z,y:actual,difference:actual-measured};});
checkGeometry.dispose();checkMesh.material.dispose();

// Vertical rays rasterized per actual triangle, without Box3 support-plane assumptions.
const grid={x0:-.26,z0:-.3,step:.0025,nx:209,nz:249};
function raster(triangles,{bottom=false,ymax=.48}={}){
 const heights=Array(grid.nx*grid.nz).fill(bottom?Infinity:-Infinity),normals=Array(grid.nx*grid.nz).fill(null);
 for(const t of triangles){const[a,b,c]=t.p;const den=(b.z-c.z)*(a.x-c.x)+(c.x-b.x)*(a.z-c.z);if(Math.abs(den)<1e-12)continue;
  const xlo=Math.max(0,Math.ceil((Math.min(a.x,b.x,c.x)-grid.x0)/grid.step)),xhi=Math.min(grid.nx-1,Math.floor((Math.max(a.x,b.x,c.x)-grid.x0)/grid.step));
  const zlo=Math.max(0,Math.ceil((Math.min(a.z,b.z,c.z)-grid.z0)/grid.step)),zhi=Math.min(grid.nz-1,Math.floor((Math.max(a.z,b.z,c.z)-grid.z0)/grid.step));
  for(let iz=zlo;iz<=zhi;iz++)for(let ix=xlo;ix<=xhi;ix++){const x=grid.x0+ix*grid.step,z=grid.z0+iz*grid.step,u=((b.z-c.z)*(x-c.x)+(c.x-b.x)*(z-c.z))/den,v=((c.z-a.z)*(x-c.x)+(a.x-c.x)*(z-c.z))/den;if(u< -1e-8||v< -1e-8||u+v>1+1e-8)continue;const y=u*a.y+v*b.y+(1-u-v)*c.y;if(y>=ymax)continue;const k=iz*grid.nx+ix;if(bottom?y<heights[k]:y>heights[k]){heights[k]=y;normals[k]=t.normal.toArray();}}
 }
 return{heights:heights.map(v=>Number.isFinite(v)?v:null),normals};
}
const bedGrid=raster(frame.triangles),ramGrid=raster(ram.triangles,{bottom:true,ymax:2});
function percentile(values,q){const a=[...values].sort((a,b)=>a-b);return a[Math.round((a.length-1)*q)]??null;}
function stats(values){return{count:values.length,min:Math.min(...values),p05:percentile(values,.05),median:percentile(values,.5),p95:percentile(values,.95),max:Math.max(...values)};}
function point(k){return{x:grid.x0+(k%grid.nx)*grid.step,z:grid.z0+Math.floor(k/grid.nx)*grid.step};}
const surfaceCells=bedGrid.heights.flatMap((y,k)=>y!==null&&y>.367&&y<.39&&bedGrid.normals[k]?.[1]>.97?[{...point(k),y}]:[]);
const sx=surfaceCells.map(p=>p.x),sz=surfaceCells.map(p=>p.z),sy=surfaceCells.map(p=>p.y);
const bedSurface={definition:'vertical top hit below Y=.48, Y in (.367,.39), geometric normal.y>.97; approximate sampled near-horizontal bed face, edge resolution 2.5mm',bounds:{x:[Math.min(...sx),Math.max(...sx)],z:[Math.min(...sz),Math.max(...sz)],y:[Math.min(...sy),Math.max(...sy)]},area:surfaceCells.length*grid.step**2,height:stats(sy),areaCentroid:surfaceCells.reduce((a,p)=>({x:a.x+p.x/surfaceCells.length,y:a.y+p.y/surfaceCells.length,z:a.z+p.z/surfaceCells.length}),{x:0,y:0,z:0})};
const ramCells=ramGrid.heights.flatMap((y,k)=>y!==null&&y<.555?[{...point(k),y}]:[]);
const ramFootprint={definition:'ram first upward hit, underside Y<.555; sampled actual low platen footprint',bounds:{x:[Math.min(...ramCells.map(p=>p.x)),Math.max(...ramCells.map(p=>p.x))],z:[Math.min(...ramCells.map(p=>p.z)),Math.max(...ramCells.map(p=>p.z))]},height:stats(ramCells.map(p=>p.y)),area:ramCells.length*grid.step**2,areaCentroid:ramCells.reduce((a,p)=>({x:a.x+p.x/ramCells.length,y:a.y+p.y/ramCells.length,z:a.z+p.z/ramCells.length}),{x:0,y:0,z:0})};
function placement(x,z,yaw,baseY,label,scale=1){
 const matrix=new Matrix4().makeRotationY(yaw).multiply(new Matrix4().makeScale(scale,scale,scale));matrix.setPosition(x,baseY,z);
 const triangles=cassette.triangles.map(t=>({...t,p:t.p.map(v=>v.clone().applyMatrix4(matrix))}));
 const bottom=raster(triangles,{bottom:true,ymax:2}),top=raster(triangles,{ymax:2});
 const gaps=[],missing=[],all=[];for(let k=0;k<bottom.heights.length;k++){const cy=bottom.heights[k],by=bedGrid.heights[k];if(cy===null)continue;if(by===null){missing.push(point(k));continue;}const gap=cy-by;gaps.push(gap);all.push({...point(k),bottom:cy,bed:by,gap});}
 const minPoint=all.reduce((a,p)=>p.gap<a.gap?p:a,all[0]);
 const requiredBase=baseY-Math.min(...gaps);
 const contactAtTangent=all.filter(p=>p.gap-Math.min(...gaps)<=.001);
 const underPlaten=bottom.heights.reduce((n,y,k)=>n+(y!==null&&ramGrid.heights[k]!==null&&ramGrid.heights[k]<.555?1:0),0);
 return{label,x,z,yawRad:yaw,scale,baseY,footprintBounds:new Box3().setFromPoints(triangles.flatMap(t=>t.p)),gap:stats(gaps),minimumGapPoint:minPoint,belowBedSamples:gaps.filter(g=>g<0).length,missingBedSamples:missing.length,requiredBaseYForZeroPenetrationSampled:requiredBase,projectedFootprintWithinRamFraction:underPlaten/(gaps.length+missing.length),nearContactWithin1mmAtTangent:contactAtTangent,rasters:{bottom:bottom.heights,top:top.heights}};
}
const placements=[placement(anchor.x,anchor.z,.45,anchor.y+anchor.clearance,'current-anchor-yaw045'),placement(anchor.x,anchor.z,0,anchor.y+anchor.clearance,'current-anchor-yaw0'),placement(anchor.x,0,.45,anchor.y+anchor.clearance,'move-front-z0-yaw045'),placement(anchor.x,.03,.45,anchor.y+anchor.clearance,'move-front-z003-yaw045'),placement(anchor.x,anchor.z,.45,anchor.y+anchor.clearance+.005,'proposed-scale110-yaw045',1.1)];
const yawSweep=[1,1.1].flatMap(scale=>Array.from({length:24},(_,i)=>{const yaw=i*Math.PI/12,p=placement(anchor.x,anchor.z,yaw,anchor.y+anchor.clearance,'yaw-sweep',scale);return{scale,yawRad:yaw,requiredBaseYForZeroPenetrationSampled:p.requiredBaseYForZeroPenetrationSampled,projectedFootprintWithinRamFraction:p.projectedFootprintWithinRamFraction};}));
const oldSampleBoxGltf={x:[-.11529092829580562,.15066233842221582],y:[.31322397916089967,.37103990670829556],z:[-.11536628008525392,.058081502556933985]};
const oldBoxSurfaceSamples=bedGrid.heights.flatMap((y,k)=>{const{x,z}=point(k);return y!==null&&x>=oldSampleBoxGltf.x[0]&&x<=oldSampleBoxGltf.x[1]&&z>=oldSampleBoxGltf.z[0]&&z<=oldSampleBoxGltf.z[1]?[y]:[];});
const oldCalibration={sampleBox:oldSampleBoxGltf,actualSurfaceHeightInSameXZ:stats(oldBoxSurfaceSamples),surfaceSamplesAboveOldBoxCeilingFraction:oldBoxSurfaceSamples.filter(y=>y>oldSampleBoxGltf.y[1]).length/oldBoxSurfaceSamples.length,note:'Bounds converted from sourceBedSampleBoxBlender using recorded sourceBaseCenter/sourceToMetersScale. Old pipeline selects vertices inside a height-limited 3D box, then max Y; it does not raycast the workbed top.'};
const measurements={...report,grid,rayCrossChecks,bedSurface,ramFootprint,oldCalibration,yawSweep,placements:placements.map(({rasters,...p})=>p)};
writeFileSync(out+'measurement.json',JSON.stringify(measurements,null,2)+'\n');
writeFileSync(out+'heightfields.json',JSON.stringify({grid,bed:bedGrid.heights,ram:ramGrid.heights,placements:placements.map(p=>({label:p.label,...p.rasters}))})+'\n');
console.log(JSON.stringify({rayCrossChecks,bedSurface,ramFootprint,oldCalibration,yawSweep,placements:measurements.placements.map(({nearContactWithin1mmAtTangent,...p})=>({...p,nearContactSamples:nearContactWithin1mmAtTangent.length}))},null,2));
