"""Preserve Meshy masters and create self-contained mobile GLBs.

Run: Blender --background --factory-startup --python assets/source/pipeline/prepare_mobile.py
Asset paths, physical scale and geometry selection live in mobile-models.json.
New sources need measured bounds and a visually checked part selection before use.
"""
import bpy
import bmesh
import hashlib
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from mathutils.geometry import barycentric_transform

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
sys.path.insert(0, str(HERE))
from source_io import resolved_source
from press_anchors import calibrate_press
CONFIG = json.loads((HERE / "mobile-models.json").read_text())


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def bounds(obj):
    points = [obj.matrix_world @ v.co for v in obj.data.vertices]
    return [[min(p[i] for p in points) for i in range(3)], [max(p[i] for p in points) for i in range(3)]]


def gltf_point(p):
    return [p[0], p[2], -p[1]]


def gltf_bounds(box):
    return [[box[0][0], box[0][2], -box[1][1]], [box[1][0], box[1][2], -box[0][1]]]


def triangle_count(obj):
    return sum(len(face.vertices) - 2 for face in obj.data.polygons)


def in_box(point, box):
    return all(box[0][i] <= point[i] <= box[1][i] for i in range(3))


def selected_by(point, part):
    if "sourceFaceCenterBoxBlender" in part:
        return in_box(point, part["sourceFaceCenterBoxBlender"])
    if "sourceFrontDiskBlender" in part:
        disk = part["sourceFrontDiskBlender"]
        return (point.x - disk["centerXZ"][0]) ** 2 + (point.z - disk["centerXZ"][1]) ** 2 <= disk["radius"] ** 2 and point.y <= disk["maxY"]
    raise ValueError("Missing geometric selector")


def select_object(obj):
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


def prepare(spec, source):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    original_hash = sha256(source)
    bpy.ops.import_scene.gltf(filepath=str(source))
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    if len(meshes) != 1:
        raise ValueError("This profile expects one master mesh; define explicit assembly handling for another source")
    source_obj = meshes[0]
    select_object(source_obj)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    source_box = bounds(source_obj)
    axis = 2 if spec["normalizeDimension"] == "height" else 0
    factor = spec["targetMeters"] / (source_box[1][axis] - source_box[0][axis])
    origin = Vector(((source_box[0][0] + source_box[1][0]) / 2, (source_box[0][1] + source_box[1][1]) / 2, source_box[0][2]))
    source_triangles = triangle_count(source_obj)
    source_images = [{"name": image.name, "dimensions": list(image.size)} for image in bpy.data.images]
    parts = []
    selectors = [part for part in spec["parts"] if not part.get("remainder")]
    for part in spec["parts"]:
        obj = source_obj.copy()
        obj.data = source_obj.data.copy()
        bpy.context.collection.objects.link(obj)
        obj.name = part["name"]
        obj.data.name = part["name"]
        bm = bmesh.new()
        bm.from_mesh(obj.data)
        selected = []
        for face in bm.faces:
            center = face.calc_center_median()
            keep = (not any(selected_by(center, selector) for selector in selectors)) if part.get("remainder") else selected_by(center, part)
            if not keep:
                selected.append(face)
        bmesh.ops.delete(bm, geom=selected, context="FACES")
        loose = [v for v in bm.verts if not v.link_faces]
        if loose:
            bmesh.ops.delete(bm, geom=loose, context="VERTS")
        # glTF duplicates vertices along UV seams; weld coordinates while
        # preserving per-loop UVs so simplification cannot open cracks.
        bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=0.000001)
        bm.to_mesh(obj.data)
        bm.free()
        before = triangle_count(obj)
        for vertex in obj.data.vertices:
            vertex.co = (vertex.co - origin) * factor
        select_object(obj)
        modifier = obj.modifiers.new("Mobile triangle budget", "DECIMATE")
        modifier.decimate_type = "COLLAPSE"
        modifier.ratio = min(1.0, part["triangleBudget"] / before)
        modifier.use_collapse_triangulate = True
        bpy.ops.object.modifier_apply(modifier=modifier.name)
        for polygon in obj.data.polygons:
            polygon.use_smooth = True
        parts.append(obj)
        print(json.dumps({"asset": spec["id"], "part": obj.name, "trianglesBefore": before, "trianglesAfter": triangle_count(obj)}), flush=True)
    # Decimation changes extreme vertices slightly. Renormalize the final mesh,
    # so the authored physical dimension and base-center are exact at export.
    part_boxes = [bounds(obj) for obj in parts]
    final_box = [[min(box[0][i] for box in part_boxes) for i in range(3)], [max(box[1][i] for box in part_boxes) for i in range(3)]]
    recenter = Vector(((final_box[0][0] + final_box[1][0]) / 2, (final_box[0][1] + final_box[1][1]) / 2, final_box[0][2]))
    correction = spec["targetMeters"] / (final_box[1][axis] - final_box[0][axis])
    for obj in parts:
        for vertex in obj.data.vertices:
            vertex.co = (vertex.co - recenter) * correction
    origin += recenter / factor
    factor *= correction
    # Reconstruct low-mesh vertex normals from the actual nearest master
    # triangle AFTER every coordinate change. This avoids the false metal dents
    # caused by averaging highly unequal decimated triangles.
    for vertex in source_obj.data.vertices:
        vertex.co = (vertex.co - origin) * factor
    source_obj.data.update()
    bpy.context.view_layer.update()
    tree = BVHTree.FromObject(source_obj, bpy.context.evaluated_depsgraph_get())
    source_mesh = source_obj.data
    source_normals = [normal.vector.copy() for normal in source_mesh.corner_normals]
    for obj in parts:
        obj.data.update()
        normals = [None] * len(obj.data.loops)
        for face in obj.data.polygons:
            for loop_id in face.loop_indices:
                vertex = obj.data.vertices[obj.data.loops[loop_id].vertex_index]
                # Sample just inside each face. At a bevel boundary a shared
                # vertex has multiple correct normals; sampling exactly on it
                # would arbitrarily choose the other side of the bevel.
                sample = vertex.co.lerp(face.center, 0.05)
                point, _, face_id, _ = tree.find_nearest(sample)
                polygon = source_mesh.polygons[face_id]
                ids = polygon.vertices
                a, b, c = (source_mesh.vertices[index].co for index in ids)
                na, nb, nc = (source_normals[index] for index in polygon.loop_indices)
                normal = barycentric_transform(point, a, b, c, na, nb, nc)
                # Bound rounding below 0.2 degree; identical plane normals can
                # share exported vertices instead of splitting every triangle.
                normal.normalize()
                normals[loop_id] = Vector(tuple(round(component * 256) / 256 for component in normal)).normalized()
        obj.data.normals_split_custom_set(normals)
        obj.data.update()
    bpy.data.objects.remove(source_obj, do_unlink=True)
    for image in bpy.data.images:
        width, height = image.size
        limit = CONFIG.get("textureMaxDimensionByImageName", {}).get(image.name, CONFIG["textureMaxDimension"])
        shrink = min(1.0, limit / max(width, height))
        if shrink < 1:
            image.scale(round(width * shrink), round(height * shrink))
    output = ROOT / spec["output"]
    output.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.object.select_all(action="DESELECT")
    for obj in parts:
        obj.select_set(True)
    bpy.ops.export_scene.gltf(
        filepath=str(output), export_format="GLB", use_selection=True,
        export_yup=True, export_apply=True, export_animations=False,
        export_cameras=False, export_lights=False, export_materials="EXPORT",
        export_image_format="JPEG", export_jpeg_quality=CONFIG["jpegQuality"],
        export_keep_originals=False, export_texcoords=True, export_normals=True,
        export_tangents=False, export_extras=False,
        export_draco_mesh_compression_enable=False,
    )
    result = {
        "assetId": spec["id"], "sourcePath": spec["source"], "sourceSha256": original_hash,
        "sourceBytes": source.stat().st_size, "sourceTriangles": source_triangles,
        "sourceTextures": source_images, "sourceBoundsBlender": source_box,
        "sourceToMetersScale": factor, "sourceBaseCenterBlender": list(origin),
        "runtimePath": spec["output"], "runtimeSha256": sha256(output), "runtimeBytes": output.stat().st_size,
        "triangles": sum(triangle_count(obj) for obj in parts),
        "parts": [{"name": obj.name, "triangles": triangle_count(obj), "boundsGltfMeters": gltf_bounds(bounds(obj)), "nodeTranslation": [0, 0, 0]} for obj in parts],
        "textures": [{"name": image.name, "dimensions": list(image.size)} for image in bpy.data.images],
        "normalizedAxis": "glTF +Y up, +Z front", "pivot": "base-center; part origins share model base-center",
        "status": "offline-prepared-device-unverified",
    }
    if spec.get("calibration"):
        result["anchors"] = calibrate_press(parts, spec["calibration"], origin, factor)
    assert result["triangles"] <= spec["maxTriangles"], result
    assert sha256(source) == original_hash, "Master changed unexpectedly"
    return result


reports = []
for spec in CONFIG["assets"]:
    with resolved_source(ROOT / spec["source"]) as source:
        reports.append(prepare(spec, source))
total = sum(report["runtimeBytes"] for report in reports)
report = {"schemaVersion": 1, "createdAt": datetime.now(timezone.utc).isoformat(), "blenderVersion": bpy.app.version_string, "pipelineConfig": "assets/source/pipeline/mobile-models.json", "jpegQuality": CONFIG["jpegQuality"], "geometryCompression": "none; standard glTF no decoder dependency", "combinedRuntimeBytes": total, "assets": reports}
(HERE / "mobile-model-report.json").write_text(json.dumps(report, indent=2) + "\n")
assert total <= CONFIG["combinedMaxBytes"], f"Combined budget exceeded: {total}"
print(json.dumps(report, indent=2), flush=True)
