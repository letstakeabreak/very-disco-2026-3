"""Prepare only the new Meshy insert; preserve the shipping cassette and both masters."""
import bpy
import bmesh
import hashlib
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from mathutils import Vector

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[4]
SOURCE = HERE / "insert-master.glb"
OUTPUT = HERE / "insert-mobile.glb"
REPORT = HERE / "mobile-report.json"


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def bounds(obj):
    return [[min(v.co[i] for v in obj.data.vertices) for i in range(3)],
            [max(v.co[i] for v in obj.data.vertices) for i in range(3)]]


bpy.ops.wm.read_factory_settings(use_empty=True)
source_hash = digest(SOURCE)
bpy.ops.import_scene.gltf(filepath=str(SOURCE))
objects = [o for o in bpy.context.scene.objects if o.type == "MESH"]
assert len(objects) == 1, "Inspect a multi-object master before defining its preparation"
source = objects[0]
bpy.context.view_layer.objects.active = source
source.select_set(True)
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
source_box = bounds(source)
source_count = sum(len(p.vertices) - 2 for p in source.data.polygons)
source_images = [{"name": im.name, "size": list(im.size)} for im in bpy.data.images]
factor = 0.18 / (source_box[1][0] - source_box[0][0])
# Blender +Z maps to glTF +Y. Center the part inside the measured cassette window.
origin = (Vector(source_box[0]) + Vector(source_box[1])) / 2 - Vector((0, 0, 0.074)) / factor
bm = bmesh.new()
bm.from_mesh(source.data)
bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=1e-6)
bm.to_mesh(source.data)
bm.free()
source.name = "cassette-interior"
mod = source.modifiers.new("Mobile interior budget", "DECIMATE")
mod.ratio = min(1, 9000 / source_count)
mod.use_collapse_triangulate = True
bpy.ops.object.modifier_apply(modifier=mod.name)
triangles = sum(len(p.vertices) - 2 for p in source.data.polygons)
print(json.dumps({"sourceTriangles": source_count, "mobileTriangles": triangles, "sourceTextures": source_images}), flush=True)
assert triangles <= 9000, triangles
# Preserve the source silhouette before converting to meters. The rejected
# 2,400 target collapsed the shafts and stopped at about 5,000 triangles.
decimated_box = bounds(source)
axis_retention = [(decimated_box[1][i] - decimated_box[0][i]) /
                  (source_box[1][i] - source_box[0][i]) for i in range(3)]
assert all(.98 <= ratio <= 1.02 for ratio in axis_retention), axis_retention
for v in source.data.vertices:
    v.co = (v.co - origin) * factor
for face in source.data.polygons:
    face.use_smooth = True
bpy.ops.export_scene.gltf(filepath=str(OUTPUT), export_format="GLB", use_selection=True,
    export_yup=True, export_apply=True, export_animations=False, export_cameras=False,
    export_lights=False, export_image_format="JPEG", export_jpeg_quality=88)
asset = {"assetId": "cassette-interior", "sourcePath": str(SOURCE.relative_to(ROOT)),
         "sourceSha256": source_hash, "sourceBytes": SOURCE.stat().st_size,
         "sourceTriangles": source_count, "sourceTextures": source_images,
         "sourceBoundsBlender": source_box, "sourceToMetersScale": factor,
         "sourceBaseCenterBlender": list(origin), "runtimePath": str(OUTPUT.relative_to(ROOT)),
         "runtimeSha256": digest(OUTPUT), "runtimeBytes": OUTPUT.stat().st_size,
         "triangles": triangles, "requestedDecimationTarget": 9000, "maxTriangles": 9000,
         "axisExtentRetention": axis_retention,
         "decimationNote": "Measured output is authoritative; Blender collapse can stop above its requested ratio.",
         "boundsBlender": bounds(source),
         "placement": "Source target X length .18m, center Y=.074m, Z=0. Final measured extent is in boundsBlender; designed insert, not recovered hidden geometry."}
# Reuse the existing master-to-mobile PBR bake, with an isolated report/output.
sys.path.insert(0, str(ROOT / "assets/source/pipeline"))
sys.argv = [__file__]
import rebake_mobile
rebake_mobile.REPORT_PATH = REPORT
rebake_mobile.REPORT = {"createdAt": datetime.now(timezone.utc).isoformat(),
    "status": "candidate-device-unverified", "assets": [asset]}
rebake_mobile.bake_asset(asset)
assert digest(SOURCE) == source_hash
print(json.dumps(asset, indent=2), flush=True)
