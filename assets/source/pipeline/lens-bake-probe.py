"""Read-only source/runtime diagnosis and isolated lens PBR re-bake experiment.
Blender --background --factory-startup --python .../lens-bake-probe.py -- diagnose|bake
Writes only lens-probe/. These images are offline inspections, never gameplay evidence.
"""
import bpy, bmesh, json, sys, math, hashlib
from pathlib import Path
from mathutils import Vector
HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[2]
OUT=HERE/'lens-probe';OUT.mkdir(exist_ok=True)
sys.path.insert(0,str(HERE))
from source_io import resolved_source
REPORT=json.loads((HERE/'mobile-model-report.json').read_text())
SPEC=next(a for a in REPORT['assets'] if a['assetId']=='salvage-lens')
MODE=sys.argv[sys.argv.index('--')+1] if '--' in sys.argv else 'diagnose'

def select(obj):
 bpy.ops.object.select_all(action='DESELECT');obj.select_set(True);bpy.context.view_layer.objects.active=obj

def studio():
 scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=16
 scene.render.resolution_x=768;scene.render.resolution_y=768;scene.render.resolution_percentage=100
 scene.world=bpy.data.worlds.new('probe-world');scene.world.use_nodes=True
 scene.world.node_tree.nodes['Background'].inputs['Color'].default_value=(.11,.13,.15,1)
 scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value=.65
 size=.20;center=Vector((0,0,.075))
 for pos,power in [((2,-3,4),500),((-3,-1,2),350),((1,2,3),650)]:
  bpy.ops.object.light_add(type='AREA',location=Vector(pos)*size);o=bpy.context.object;o.data.energy=power*size*size;o.data.shape='DISK';o.data.size=size*3;o.rotation_euler=(center-o.location).to_track_quat('-Z','Y').to_euler()
 bpy.ops.object.camera_add();cam=bpy.context.object;cam.data.type='ORTHO';cam.data.ortho_scale=.215;cam.location=center+Vector((2,-4,1.6))*size;cam.rotation_euler=(center-cam.location).to_track_quat('-Z','Y').to_euler();scene.camera=cam
 return scene

def render(scene,name):
 scene.render.filepath=str(OUT/(name+'.png'));bpy.ops.render.render(write_still=True)

def import_runtime(path=None):
 bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=str(path or ROOT/SPEC['runtimePath']))
 return [o for o in bpy.context.scene.objects if o.type=='MESH']

def materials(objects):
 return list({m for o in objects for m in o.data.materials if m})

def unlink_input(mat,node,name):
 for link in list(node.inputs[name].links):mat.node_tree.links.remove(link)

def diagnose(path=None,prefix=""):
 for mode in ['runtime-original','runtime-basecolor-only','runtime-uniform-with-original-normals','runtime-uniform-recomputed-normals','runtime-texture-without-normalmap']:
  objects=import_runtime(path)
  if mode=='runtime-basecolor-only':
   for m in materials(objects):
    tree=m.node_tree;bs=tree.nodes.get('Principled BSDF');out=next(n for n in tree.nodes if n.type=='OUTPUT_MATERIAL');em=tree.nodes.new('ShaderNodeEmission')
    if bs.inputs['Base Color'].is_linked:tree.links.new(bs.inputs['Base Color'].links[0].from_socket,em.inputs['Color'])
    else:em.inputs['Color'].default_value=bs.inputs['Base Color'].default_value
    tree.links.new(em.outputs['Emission'],out.inputs['Surface'])
  if mode in ['runtime-uniform-with-original-normals','runtime-uniform-recomputed-normals']:
   for o in objects:
    m=bpy.data.materials.new(o.name+'-uniform');m.use_nodes=True;b=m.node_tree.nodes['Principled BSDF'];b.inputs['Base Color'].default_value=(.38,.38,.38,1);b.inputs['Metallic'].default_value=.65;b.inputs['Roughness'].default_value=.34;o.data.materials.clear();o.data.materials.append(m)
    if mode.endswith('recomputed-normals'):
     o.data.normals_split_custom_set([(0,0,0)]*len(o.data.loops))
     for p in o.data.polygons:p.use_smooth=True
  if mode=='runtime-texture-without-normalmap':
   for m in materials(objects):unlink_input(m,m.node_tree.nodes['Principled BSDF'],'Normal')
  render(studio(),prefix+mode)
 print('DIAGNOSE_DONE',flush=True)

def bake():
 objects=import_runtime()
 # Drop inherited source-space split normals; the baked tangent normal map will restore detail.
 for o in objects:
  bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.000001);bm.to_mesh(o.data);bm.free()
  o.data.normals_split_custom_set([(0,0,0)]*len(o.data.loops))
  for edge in o.data.edges:edge.use_edge_sharp=False
  for poly in o.data.polygons:poly.use_smooth=True
  select(o);bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.uv.smart_project(angle_limit=math.radians(66),island_margin=.007);bpy.ops.object.mode_set(mode='OBJECT')
  o.data.materials.clear()
 with resolved_source(ROOT/SPEC['sourcePath']) as source:
  bpy.ops.import_scene.gltf(filepath=str(source))
 high=next(o for o in bpy.context.scene.objects if o.type=='MESH' and o not in objects)
 select(high);bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
 origin=Vector(SPEC['sourceBaseCenterBlender']);factor=SPEC['sourceToMetersScale']
 for v in high.data.vertices:v.co=(v.co-origin)*factor
 high.data.update()
 for o in objects:o.hide_render=True
 render(studio(),'normalized-source')
 for o in objects:o.hide_render=False
 scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=1
 scene.render.bake.use_selected_to_active=True;scene.render.bake.cage_extrusion=.003;scene.render.bake.max_ray_distance=.02;scene.render.bake.margin=12;scene.render.bake.use_clear=True
 source_mats=materials([high]);source_surface=[]
 for m in source_mats:
  tree=m.node_tree;bs=tree.nodes.get('Principled BSDF');out=next(n for n in tree.nodes if n.type=='OUTPUT_MATERIAL')
  original=out.inputs['Surface'].links[0].from_socket;em=tree.nodes.new('ShaderNodeEmission')
  if bs.inputs['Base Color'].is_linked:tree.links.new(bs.inputs['Base Color'].links[0].from_socket,em.inputs['Color'])
  else:em.inputs['Color'].default_value=bs.inputs['Base Color'].default_value
  source_surface.append((m,original,em,out))
 for o in objects:
  mat=bpy.data.materials.new(o.name+'-rebaked');mat.use_nodes=True;o.data.materials.append(mat);tree=mat.node_tree;bs=tree.nodes['Principled BSDF'];bs.inputs['Metallic'].default_value=.65;bs.inputs['Roughness'].default_value=.42
  images={}
  for kind in ['basecolor','normal']:
   image=bpy.data.images.new(o.name+'-'+kind,width=2048,height=2048,alpha=False);image.colorspace_settings.name='sRGB' if kind=='basecolor' else 'Non-Color';image.file_format='PNG'
   tex=tree.nodes.new('ShaderNodeTexImage');tex.image=image;tree.nodes.active=tex
   for m,original,em,out in source_surface:m.node_tree.links.new(em.outputs['Emission'] if kind=='basecolor' else original,out.inputs['Surface'])
   select(o);high.select_set(True);bpy.context.view_layer.objects.active=o
   bpy.ops.object.bake(type='EMIT' if kind=='basecolor' else 'NORMAL')
   image.filepath_raw=str(OUT/(o.name+'-'+kind+'.png'));image.save();images[kind]=(image,tex)
   print('BAKED',o.name,kind,flush=True)
  tree.links.new(images['basecolor'][1].outputs['Color'],bs.inputs['Base Color'])
  normal=tree.nodes.new('ShaderNodeNormalMap');tree.links.new(images['normal'][1].outputs['Color'],normal.inputs['Color']);tree.links.new(normal.outputs['Normal'],bs.inputs['Normal'])
 bpy.data.objects.remove(high,do_unlink=True)
 scene=studio();render(scene,'runtime-rebaked')
 bpy.ops.object.select_all(action='DESELECT')
 for o in objects:o.select_set(True)
 path=OUT/'salvage-lens-rebaked.glb'
 bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_yup=True,export_apply=True,export_animations=False,export_cameras=False,export_lights=False,export_materials='EXPORT',export_image_format='JPEG',export_jpeg_quality=90,export_texcoords=True,export_normals=True,export_tangents=False)
 result={'status':'experimental-offline-unverified','sourceSha256':SPEC['sourceSha256'],'inputRuntimeSha256':hashlib.sha256((ROOT/SPEC['runtimePath']).read_bytes()).hexdigest(),'outputSha256':hashlib.sha256(path.read_bytes()).hexdigest(),'outputBytes':path.stat().st_size,'triangleCounts':{o.name:sum(len(p.vertices)-2 for p in o.data.polygons) for o in objects},'limitations':['Base color and tangent normals baked; metalness/roughness are temporary constants, not source PBR maps.','Transparent glass requires runtime material replacement.','Offline inspection only, no gameplay/device verification.']}
 (OUT/'probe-result.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result),flush=True)

if MODE=='diagnose':diagnose()
elif MODE=='bake':bake()
elif MODE=='verify-bake':diagnose(OUT/'salvage-lens-rebaked.glb','rebaked-')
else:raise ValueError(MODE)
