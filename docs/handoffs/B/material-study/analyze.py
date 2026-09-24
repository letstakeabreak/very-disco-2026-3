from pathlib import Path
from io import BytesIO
import json,struct,hashlib,gzip
import numpy as np
from PIL import Image
ROOT=Path(__file__).resolve().parents[4]
OUT=Path(__file__).resolve().parent
IDS=['press-chamber','salvage-cassette','salvage-core','salvage-lens']
rng=np.random.default_rng(426)
def read_glb(path):
 if path.exists():data=path.read_bytes()
 else:
  man=json.loads((path.parent/'archive-manifest.json').read_text())
  data=gzip.decompress(b''.join((path.parent/p['file']).read_bytes() for p in man['parts']))
  assert hashlib.sha256(data).hexdigest()==man['restoredSha256']
 n=struct.unpack_from('<I',data,12)[0];g=json.loads(data[20:20+n]);blob=memoryview(data)[28+n:]
 return data,g,blob

def accessor(g,b,id):
 a=g['accessors'][id];v=g['bufferViews'][a['bufferView']];dt={5126:'<f4',5125:'<u4',5123:'<u2',5121:'u1'}[a['componentType']];count={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}[a['type']];item=np.dtype(dt).itemsize
 return np.ndarray((a['count'],count),dtype=dt,buffer=b,offset=v.get('byteOffset',0)+a.get('byteOffset',0),strides=(v.get('byteStride',count*item),item))

def analyze(path):
 data,g,b=read_glb(path);cache={}
 def image(index):
  i=g['textures'][index]['source']
  if i not in cache:
   im=g['images'][i];v=g['bufferViews'][im['bufferView']];cache[i]=np.array(Image.open(BytesIO(b[v.get('byteOffset',0):v.get('byteOffset',0)+v['byteLength']])).convert('RGB'))/255
  return cache[i]
 def sample(index,uv):
  im=image(index);h,w=im.shape[:2];return im[np.minimum((uv[:,1]%1*h).astype(int),h-1),np.minimum((uv[:,0]%1*w).astype(int),w-1)]
 values=[];materials=[]
 for mi,m in enumerate(g.get('materials',[])):materials.append({'index':mi,'name':m.get('name'),'alphaMode':m.get('alphaMode','OPAQUE'),'pbr':m.get('pbrMetallicRoughness',{}),'extensions':m.get('extensions',{})})
 for mesh in g['meshes']:
  for p in mesh['primitives']:
   v=accessor(g,b,p['attributes']['POSITION']);uv=accessor(g,b,p['attributes']['TEXCOORD_0']);faces=accessor(g,b,p['indices']).reshape(-1,3)
   areas=np.linalg.norm(np.cross(v[faces[:,1]]-v[faces[:,0]],v[faces[:,2]]-v[faces[:,0]]),axis=1)/2;total=float(areas.sum());chosen=rng.choice(len(faces),50000,p=areas/total)
   t=faces[chosen];a=rng.random(50000);q=rng.random(50000);a=np.sqrt(a);weights=np.stack([1-a,a*(1-q),a*q],axis=1)
   tuv=(uv[t]*weights[:,:,None]).sum(axis=1);pos=(v[t]*weights[:,:,None]).sum(axis=1)
   mat=g['materials'][p.get('material',0)];pbr=mat.get('pbrMetallicRoughness',{});mr=sample(pbr['metallicRoughnessTexture']['index'],tuv) if 'metallicRoughnessTexture'in pbr else np.ones((50000,3));bc=sample(pbr['baseColorTexture']['index'],tuv) if 'baseColorTexture'in pbr else np.ones((50000,3))
   linear=np.where(bc<=.04045,bc/12.92,((bc+.055)/1.055)**2.4)*np.array(pbr.get('baseColorFactor',[1,1,1,1])[:3])
   rough=mr[:,1]*pbr.get('roughnessFactor',1);metal=mr[:,2]*pbr.get('metallicFactor',1)
   amber=(bc[:,0]>bc[:,1]*1.28)&(bc[:,1]>bc[:,2]*1.3)&(bc[:,0]>.30)
   values.append((total,rough,metal,linear,amber,pos))
 def stats(channel,mask=False):
  x=np.concatenate([a[channel][a[4]] if mask else a[channel] for a in values]);w=np.concatenate([np.full(int(a[4].sum()) if mask else 50000,a[0]/50000) for a in values]);order=np.argsort(x);c=np.cumsum(w[order]);return {'mean':float(np.average(x,weights=w)),'p10':float(x[order[np.searchsorted(c,c[-1]*.1)]]),'median':float(x[order[np.searchsorted(c,c[-1]*.5)]]),'p90':float(x[order[np.searchsorted(c,c[-1]*.9)]]),'histogramBins0to1':np.histogram(x,bins=np.linspace(0,1,11),weights=w)[0].tolist(),'histogramWeightTotal':float(w.sum())} if len(x) else None
 area=sum(a[0] for a in values);amb=sum(a[0]*a[4].mean() for a in values)/area
 return {'path':str(path.relative_to(ROOT)),'sha256':hashlib.sha256(data).hexdigest(),'bytes':len(data),'materials':materials,'sampleMethod':'50,000 triangle-area-weighted barycentric surface samples per primitive, weighted by primitive area; image UV V sampled as GLB image origin, nearest texel; deterministic seed426. BC sRGB decoded to linear; MR left linear. Histogram weights are surface areas, not a black-atlas texel count.','roughness':stats(1),'metalness':stats(2),'amberAreaFractionByTextureHue':float(amb),'amberRoughness':stats(1,True),'amberMetalness':stats(2,True),'baseColorLinearMean':np.average(np.stack([a[3].mean(axis=0) for a in values]),axis=0,weights=[a[0] for a in values]).tolist(),'embeddedImages':[{'imageIndex':i,'width':im.shape[1],'height':im.shape[0]}for i,im in cache.items()]}
report={}
for id in IDS:
 report[id]={}
 for kind,path in [('source',ROOT/f'assets/source/meshy/{id}/{id}-master.glb'),('runtime',ROOT/f'public/assets/models/{id}.glb')]:
  report[id][kind]=analyze(path);r=report[id][kind];print(id,kind,'R',round(r['roughness']['median'],3),'M',round(r['metalness']['median'],3),'amberM',None if r['amberMetalness']is None else round(r['amberMetalness']['median'],3),flush=True)
(OUT/'pbr-analysis.json').write_text(json.dumps(report,indent=2)+'\n')
