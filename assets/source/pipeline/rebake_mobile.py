"""Reproject master PBR into a new atlas after decimation.

Old per-corner UVs are unsuitable after aggressive collapse. The source texture
is sampled on the full master surface, never interpolated through its old atlas.
Run Blender --background --factory-startup --python this.py -- asset-id [...]
"""
import bpy
import bmesh
import argparse
import json
import math
import sys
import hashlib
from pathlib import Path
from mathutils import Vector

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
sys.path.insert(0, str(HERE))
from source_io import resolved_source

REPORT_PATH = HERE / "mobile-model-report.json"
REPORT = json.loads(REPORT_PATH.read_text())
parser = argparse.ArgumentParser()
parser.add_argument("assets", nargs="*")
parser.add_argument("--keep-bake-images", action="store_true")
args = parser.parse_args(sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else [])
ASSET_IDS = args.assets or [a["assetId"] for a in REPORT["assets"]]


def make_active(obj, source=None):
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    if source:
        source.select_set(True)
    bpy.context.view_layer.objects.active = obj


def bake_asset(asset):
    if asset.get("assembly"):
        raise ValueError("Prepare the original housing before rebaking a composed asset, then rerun its assembly script")
    asset_id = asset["assetId"]
    directory = HERE / "baked" / asset_id
    directory.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(ROOT / asset["runtimePath"]))
    targets = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    with resolved_source(ROOT / asset["sourcePath"]) as path:
        bpy.ops.import_scene.gltf(filepath=str(path))
    source = next(o for o in bpy.context.scene.objects if o.type == "MESH" and o not in targets)
    source.name = "MASTER_BAKE_SOURCE"
    origin = Vector(asset["sourceBaseCenterBlender"])
    factor = asset["sourceToMetersScale"]
    for vertex in source.data.vertices:
        vertex.co = (vertex.co - origin) * factor
    source.data.update()
    material = source.data.materials[0]
    tree = material.node_tree
    output = next(n for n in tree.nodes if n.type == "OUTPUT_MATERIAL")
    bsdf = next(n for n in tree.nodes if n.type == "BSDF_PRINCIPLED")
    source_base = next(link.from_socket for link in tree.links if link.to_socket == bsdf.inputs["Base Color"])
    rough_socket = next(link.from_socket for link in tree.links if link.to_socket == bsdf.inputs["Roughness"])
    source_mr = rough_socket.node.inputs[0].links[0].from_socket
    emission = tree.nodes.new("ShaderNodeEmission")
    for obj in targets:
        # glTF expands corner normals/UVs to independent vertices. Rejoin
        # identical geometry before smoothing and authoring the new atlas.
        bm = bmesh.new()
        bm.from_mesh(obj.data)
        bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=0.000001)
        for edge in bm.edges:
            edge.smooth = True
            edge.seam = False
        bm.to_mesh(obj.data)
        bm.free()
        obj.data.update()
    # One shared atlas across both parts; multi-object edit unwrap packs them
    # together without overlapping the ram/frame or glass/housing UV islands.
    bpy.ops.object.select_all(action="DESELECT")
    for obj in targets:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = targets[0]
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.006, correct_aspect=True, scale_to_bounds=False)
    bpy.ops.object.mode_set(mode="OBJECT")
    target_mat = bpy.data.materials.new(asset_id + "-rebaked-PBR")
    target_mat.use_nodes = True
    target_tree = target_mat.node_tree
    target_bsdf = target_tree.nodes.get("Principled BSDF")
    image_nodes = {}
    for kind, size in [("baseColor", 2048), ("metallicRoughness", 1024), ("normal", 2048)]:
        image = bpy.data.images.new(f"{asset_id}-{kind}", width=size, height=size, alpha=False)
        image.colorspace_settings.name = "sRGB" if kind == "baseColor" else "Non-Color"
        node = target_tree.nodes.new("ShaderNodeTexImage")
        node.image = image
        image_nodes[kind] = node
    for obj in targets:
        obj.data.materials.clear()
        obj.data.materials.append(target_mat)
        # Weighting large flat faces avoids extending small chamfer normals
        # across entire panels. Curved surfaces retain smooth shading.
        make_active(obj)
        obj.data.normals_split_custom_set([(0, 0, 0)] * len(obj.data.loops))
        obj.data.set_sharp_from_angle(angle=math.radians(45))
        modifier = obj.modifiers.new("Area weighted production normals", "WEIGHTED_NORMAL")
        modifier.keep_sharp = True
        modifier.weight = 50
        bpy.ops.object.modifier_apply(modifier=modifier.name)
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 1
    scene.render.bake.use_selected_to_active = True
    scene.render.bake.use_cage = False
    scene.render.bake.cage_extrusion = 0.003
    scene.render.bake.max_ray_distance = 0.025
    scene.render.bake.margin = 12
    for kind in ("baseColor", "metallicRoughness", "normal"):
        node = image_nodes[kind]
        target_tree.nodes.active = node
        if kind == "normal":
            tree.links.new(bsdf.outputs[0], output.inputs["Surface"])
            bake_type = "NORMAL"
        else:
            tree.links.new(source_base if kind == "baseColor" else source_mr, emission.inputs["Color"])
            tree.links.new(emission.outputs[0], output.inputs["Surface"])
            bake_type = "EMIT"
        for index, obj in enumerate(targets):
            scene.render.bake.use_clear = index == 0
            make_active(obj, source)
            print(f"BAKE {asset_id} {kind} {obj.name}", flush=True)
            bpy.ops.object.bake(type=bake_type)
        if args.keep_bake_images:
            node.image.file_format = "PNG"
            node.image.filepath_raw = str(directory / f"{kind}.png")
            node.image.save()
    target_tree.links.new(image_nodes["baseColor"].outputs["Color"], target_bsdf.inputs["Base Color"])
    separate = target_tree.nodes.new("ShaderNodeSeparateColor")
    target_tree.links.new(image_nodes["metallicRoughness"].outputs["Color"], separate.inputs[0])
    target_tree.links.new(separate.outputs["Green"], target_bsdf.inputs["Roughness"])
    target_tree.links.new(separate.outputs["Blue"], target_bsdf.inputs["Metallic"])
    normal_map = target_tree.nodes.new("ShaderNodeNormalMap")
    target_tree.links.new(image_nodes["normal"].outputs["Color"], normal_map.inputs["Color"])
    target_tree.links.new(normal_map.outputs[0], target_bsdf.inputs["Normal"])
    bpy.data.objects.remove(source, do_unlink=True)
    bpy.ops.object.select_all(action="DESELECT")
    for obj in targets:
        obj.select_set(True)
    output_path = ROOT / asset["runtimePath"]
    bpy.ops.export_scene.gltf(filepath=str(output_path), export_format="GLB", use_selection=True, export_yup=True, export_apply=True, export_animations=False, export_cameras=False, export_lights=False, export_materials="EXPORT", export_image_format="JPEG", export_jpeg_quality=88, export_keep_originals=False, export_tangents=False, export_draco_mesh_compression_enable=False)
    asset["runtimeSha256"] = hashlib.sha256(output_path.read_bytes()).hexdigest()
    asset["runtimeBytes"] = output_path.stat().st_size
    asset["textures"] = [{"name": node.image.name, "dimensions": list(node.image.size)} for node in image_nodes.values()]
    asset["pbrRebake"] = {"method": "Cycles selected-to-active; master -> new shared smart UV atlas", "baseColor": "2048 sRGB", "metallicRoughness": "1024 Non-Color; original G roughness/B metallic", "normal": "2048 tangent-space Non-Color", "cageExtrusionM": .003, "maxRayDistanceM": .025, "marginPx": 12, "bakeImagePolicy": "Textures embedded in runtime GLB; intermediate PNGs retained only with --keep-bake-images", "atlasDirectory": str(directory.relative_to(ROOT)) if args.keep_bake_images else None, "normals": "45 degree sharp edges + area weighted normals", "runtimeTangents": "omitted; Three.js derives tangent frame"}
    REPORT["combinedRuntimeBytes"] = sum(item["runtimeBytes"] for item in REPORT["assets"])
    REPORT_PATH.write_text(json.dumps(REPORT, indent=2) + "\n")
    print(f"REBAKED {asset_id} {output_path.stat().st_size} bytes", flush=True)


if __name__ == "__main__":
    for asset in REPORT["assets"]:
        if asset["assetId"] in ASSET_IDS:
            bake_asset(asset)
