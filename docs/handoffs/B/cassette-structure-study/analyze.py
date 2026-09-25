from pathlib import Path
from io import BytesIO
import hashlib,json,struct
import numpy as np
from PIL import Image
ROOT=Path(__file__).resolve().parents[4];OUT=Path(__file__).resolve().parent

def load(path):
 raw=path.read_bytes();n=struct.unpack_from('<I',raw,12)[0];g=json.loads(raw[20:20+n]);b=memoryview(raw)[28+n:]
 def acc(i):
  a=g['accessors'][i];bv=g['bufferViews'][a['bufferView']];dt={5126:'<f4',5125:'<u4',5123:'<u2'}[a['componentType']];k={'SCALAR':1,'VEC2':2,'VEC3':3}[a['type']];sz=np.dtype(dt).itemsize
  return np.ndarray((a['count'],k),dtype=dt,buffer=b,offset=bv.get('byteOffset',0)+a.get('byteOffset',0),strides=(bv.get('byteStride',k*sz),sz)).copy()
 p=g['meshes'][0]['primitives'][0];v=acc(p['attributes']['POSITION']);uv=acc(p['attributes']['TEXCOORD_0']);f=acc(p['indices']).reshape(-1,3)
 bounds=[v.min(0).tolist(),v.max(0).tolist()];scale=.28/(v[:,0].max()-v[:,0].min());v=(v-(v.min(0)+v.max(0))/2)*scale;v[:,1]-=v[:,1].min()
 m=g['materials'][p['material']];im=g['images'][g['textures'][m['pbrMetallicRoughness']['baseColorTexture']['index']]['source']];bv=g['bufferViews'][im['bufferView']];img=np.array(Image.open(BytesIO(b[bv.get('byteOffset',0):bv.get('byteOffset',0)+bv['byteLength']])).convert('RGB'))/255
 def colors(uvs):
  h,w=img.shape[:2];return img[np.minimum((uvs[:,1]%1*h).astype(int),h-1),np.minimum((uvs[:,0]%1*w).astype(int),w-1)]
 return raw,g,v,f,uv,colors,bounds

def connected(v,f):
 # Weld UV/normal seams at 1 micrometre in width-normalized coordinates.
 _,inverse=np.unique(np.round(v/1e-6).astype(np.int64),axis=0,return_inverse=True);faces=inverse[f];p=np.arange(inverse.max()+1,dtype=np.int32)
 a=faces[:,[0,1]].reshape(-1);b=faces[:,[1,2]].reshape(-1)
 for iteration in range(100):
  ra=p[a];rb=p[b];old=p.copy();np.minimum.at(p,np.maximum(ra,rb),np.minimum(ra,rb));p=p[p];p=p[p]
  if np.array_equal(p,old):break
 while not np.array_equal(p,p[p]):p=p[p]
 labels=p[faces[:,0]];ids,counts=np.unique(labels,return_counts=True);order=np.argsort(counts)[::-1]
 comps=[]
 for ci in order[:20]:
  vv=v[np.unique(f[labels==ids[ci]])];comps.append({'triangles':int(counts[ci]),'bounds':[vv.min(0).tolist(),vv.max(0).tolist()]})
 edges=np.concatenate([faces[:,[0,1]],faces[:,[1,2]],faces[:,[2,0]]]);codes=np.minimum(edges[:,0],edges[:,1]).astype(np.int64)*len(p)+np.maximum(edges[:,0],edges[:,1]);_,edgeCounts=np.unique(codes,return_counts=True)
 return {'boundaryEdges':int((edgeCounts==1).sum()),'nonManifoldEdges':int((edgeCounts>2).sum()),'count':len(ids),'weldedVertices':len(p),'iterations':iteration+1,'largestComponents':comps}

def analyze(kind,path):
 raw,g,v,f,uv,colors,bounds=load(path);tri=v[f];triuv=uv[f];cent=tri.mean(1);col=colors(triuv.mean(1));amber=(col[:,0]>col[:,1]*1.28)&(col[:,1]>col[:,2]*1.3)&(col[:,0]>.3)&(np.abs(cent[:,0])<.06)
 sections=[]
 for axis,value in [(0,-.035),(0,0),(0,.035),(1,.067)]:
  candidates=(tri[:,:,axis].min(1)<value)&(tri[:,:,axis].max(1)>value);t=tri[candidates];u=triuv[candidates];d=t[:,:,axis]-value;points=[];uvpoints=[]
  allpoints=np.zeros((len(t),3,3));alluv=np.zeros((len(t),3,2));valid=np.zeros((len(t),3),bool)
  for k,(a,b) in enumerate([(0,1),(1,2),(2,0)]):
   valid[:,k]=(d[:,a]*d[:,b]<0);q=-d[:,a]/np.where(abs(d[:,b]-d[:,a])>1e-15,d[:,b]-d[:,a],1);allpoints[:,k]=t[:,a]+q[:,None]*(t[:,b]-t[:,a]);alluv[:,k]=u[:,a]+q[:,None]*(u[:,b]-u[:,a])
  ok=valid.sum(1)==2;seg=allpoints[ok][valid[ok]].reshape(-1,2,3);suv=alluv[ok][valid[ok]].reshape(-1,2,2);rgb=colors(suv.mean(1));isamber=(rgb[:,0]>rgb[:,1]*1.28)&(rgb[:,1]>rgb[:,2]*1.3)&(rgb[:,0]>.30)
  sections.append({'axis':axis,'value':value,'segments':np.round(seg,7).tolist(),'amber':isamber.tolist()})
 rays=[];xymin=tri[:,:,:2].min(1);xymax=tri[:,:,:2].max(1)
 for x in np.linspace(-.04,.04,9):
  for y in np.linspace(.036,.10,9):
   point=np.array([x,y]);mask=((xymin<=point)&(xymax>=point)).all(1);t=tri[mask];A=t[:,1,:2]-t[:,0,:2];B=t[:,2,:2]-t[:,0,:2];P=point-t[:,0,:2];det=A[:,0]*B[:,1]-A[:,1]*B[:,0];den=np.where(abs(det)>1e-16,det,1);a=(P[:,0]*B[:,1]-P[:,1]*B[:,0])/den;b=(A[:,0]*P[:,1]-A[:,1]*P[:,0])/den;valid=(abs(det)>1e-16)&(a>=-1e-7)&(b>=-1e-7)&(a+b<=1+1e-7)
   z=t[:,0,2]+a*(t[:,1,2]-t[:,0,2])+b*(t[:,2,2]-t[:,0,2]);z=np.sort(z[valid]);hits=[]
   for h in z:
    if not hits or h-hits[-1]>1e-5:hits.append(float(h))
   rays.append({'x':float(x),'y':float(y),'zHits':hits,'count':len(hits)})
 interiorLow=np.array([-.035,.057,-.037]);interiorHigh=np.array([.035,.093,.037]);interiorCandidates=((tri.min(1)<=interiorHigh)&(tri.max(1)>=interiorLow)).all(1)
 result={'interiorCoreBox':{'min':interiorLow.tolist(),'max':interiorHigh.tolist(),'trianglesWhoseAABBOverlap':int(interiorCandidates.sum()),'note':'Zero candidates proves no triangle surface within this box; not a claim about unseen material volume.'},'path':str(path.relative_to(ROOT)),'sha256':hashlib.sha256(raw).hexdigest(),'bytes':len(raw),'vertices':len(v),'triangles':len(f),'meshCount':len(g['meshes']),'primitiveCount':sum(len(m['primitives'])for m in g['meshes']),'materials':len(g['materials']),'boundsOriginal':bounds,'normalizedBounds':[v.min(0).tolist(),v.max(0).tolist()],'normalize':'uniform scale to width .28m; base Y=0 and X/Z center=0; no rotations','connected':connected(v,f),'amberSelectionTopology':connected(v,f[amber]),'amberTrianglesByCentroidHue':int(amber.sum()),'amberBounds':[tri[amber].reshape(-1,3).min(0).tolist(),tri[amber].reshape(-1,3).max(0).tolist()],'rays':rays,'rayCountHistogram':{str(n):sum(r['count']==n for r in rays)for n in sorted(set(r['count']for r in rays))}}
 (OUT/f'{kind}-sections.json').write_text(json.dumps(sections,separators=(',',':')))
 print(kind,json.dumps({k:result[k]for k in ['triangles','connected','amberTrianglesByCentroidHue','rayCountHistogram']})[:4500],flush=True)
 return result
report={kind:analyze(kind,ROOT/path)for kind,path in [('source','assets/source/meshy/salvage-cassette/salvage-cassette-master.glb'),('runtime','public/assets/models/salvage-cassette.glb')]}
(OUT/'analysis.json').write_text(json.dumps(report,indent=2)+'\n')
