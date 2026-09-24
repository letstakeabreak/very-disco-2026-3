"""Offline source/runtime comparison and press segmentation evidence.

These are Blender inspection renders, never gameplay or device screenshots.
"""
import bpy
import json
import sys
from pathlib import Path
from mathutils import Vector

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
sys.path.insert(0, str(HERE))
from source_io import resolved_source
OUT = HERE / "inspection"
OUT.mkdir(exist_ok=True)
REPORT = json.loads((HERE / "mobile-model-report.json").read_text())


def studio(asset_id):
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 32
    scene.render.resolution_x = 1000
    scene.render.resolution_y = 1000
    scene.render.resolution_percentage = 100
    scene.world = bpy.data.worlds.new("inspection-world")
    scene.world.use_nodes = True
    background = scene.world.node_tree.nodes["Background"]
    background.inputs["Color"].default_value = (0.11, 0.13, 0.15, 1)
    background.inputs["Strength"].default_value = 0.65
    press = asset_id == "press-chamber"
    size = 1.1 if press else 0.28
    center = Vector((0, 0, size * (0.48 if press else 0.24)))
    for position, power in [((2, -3, 4), 500), ((-3, -1, 2), 350), ((1, 2, 3), 650)]:
        bpy.ops.object.light_add(type="AREA", location=Vector(position) * size)
        obj = bpy.context.object
        obj.data.energy = power * size * size
        obj.data.shape = "DISK"
        obj.data.size = size * 3
        obj.rotation_euler = (center - obj.location).to_track_quat("-Z", "Y").to_euler()
    bpy.ops.object.camera_add()
    camera = bpy.context.object
    camera.data.type = "ORTHO"
    camera.data.ortho_scale = size * (1.34 if press else 1.30)
    camera.location = center + Vector((2, -4, 1.8 if press else 1.6)) * size
    camera.rotation_euler = (center - camera.location).to_track_quat("-Z", "Y").to_euler()
    scene.camera = camera
    return scene


def render(scene, name):
    scene.render.filepath = str(OUT / f"{name}.png")
    bpy.ops.render.render(write_still=True)


for asset in REPORT["assets"]:
    if "--" in sys.argv and asset["assetId"] not in sys.argv[sys.argv.index("--") + 1:]:
        continue
    for mode in ("source", "runtime"):
        bpy.ops.wm.read_factory_settings(use_empty=True)
        with resolved_source(ROOT / asset["sourcePath" if mode == "source" else "runtimePath"]) as source:
            bpy.ops.import_scene.gltf(filepath=str(source))
        meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
        if mode == "source":
            origin = Vector(asset["sourceBaseCenterBlender"])
            factor = asset["sourceToMetersScale"]
            for obj in meshes:
                for vertex in obj.data.vertices:
                    vertex.co = (vertex.co - origin) * factor
        scene = studio(asset["assetId"])
        render(scene, f"{asset['assetId']}-{mode}")
        if asset["assetId"] == "salvage-lens" and mode == "runtime":
            for name, color in [("lens-glass", (0.04, 0.58, 0.85, 1)), ("lens-housing", (0.18, 0.22, 0.27, 1))]:
                obj = bpy.data.objects[name]
                material = bpy.data.materials.new(f"debug-{name}")
                material.use_nodes = True
                bsdf = material.node_tree.nodes.get("Principled BSDF")
                bsdf.inputs["Base Color"].default_value = color
                bsdf.inputs["Roughness"].default_value = 0.5
                obj.data.materials.clear()
                obj.data.materials.append(material)
            render(scene, "lens-parts-debug")
        if asset["assetId"] == "press-chamber" and mode == "runtime":
            ram = bpy.data.objects["press-ram"]
            frame = bpy.data.objects["press-frame"]
            for obj, color in [(ram, (0.9, 0.19, 0.04, 1)), (frame, (0.20, 0.27, 0.34, 1))]:
                material = bpy.data.materials.new(f"debug-{obj.name}")
                material.diffuse_color = color
                material.use_nodes = True
                bsdf = material.node_tree.nodes.get("Principled BSDF")
                bsdf.inputs["Base Color"].default_value = color
                bsdf.inputs["Roughness"].default_value = 0.6
                obj.data.materials.clear()
                obj.data.materials.append(material)
            render(scene, "press-parts-debug-rest")
            ram.location.z = -asset["anchors"]["maxDownwardTravel"]
            render(scene, "press-parts-debug-translation-limit")
            ram.location.z = 0
            top = asset["anchors"]["ramTopConnectionY"]
            flange = asset["anchors"]["ramLowerFlangeTopY"]
            distance = asset["anchors"]["maxDownwardTravel"]
            for vertex in ram.data.vertices:
                weight = max(0, min(1, (top - vertex.co.z) / (top - flange)))
                vertex.co.z -= distance * weight
            render(scene, "press-parts-debug-upper-fixed-limit")
