"""Render source geometry for selection calibration (Blender +Z-up coordinates)."""
import bpy
import sys
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[3]
OUT = Path(__file__).resolve().parent / "inspection"
sys.path.insert(0, str(Path(__file__).resolve().parent))
from source_io import resolved_source
OUT.mkdir(exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
asset_id = sys.argv[sys.argv.index("--") + 1] if "--" in sys.argv else "press-chamber"
with resolved_source(ROOT / "assets/source/meshy" / asset_id / f"{asset_id}-master.glb") as source:
    bpy.ops.import_scene.gltf(filepath=str(source))
scene = bpy.context.scene
scene.render.engine = "CYCLES"
scene.cycles.samples = 16
scene.render.resolution_x = 900
scene.render.resolution_y = 1000
scene.render.resolution_percentage = 100
scene.world = bpy.data.worlds.new("World")
scene.world.use_nodes = True
scene.world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.15, 0.15, 0.15, 1)
scene.world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.7
for position, power, size in [((1, -3, 4), 700, 5), ((-3, 1, 3), 500, 4), ((1, 3, 1), 400, 3)]:
    bpy.ops.object.light_add(type="AREA", location=position)
    obj = bpy.context.object
    obj.data.energy = power
    obj.data.shape = "DISK"
    obj.data.size = size
    obj.rotation_euler = (Vector((0, 0, 0)) - obj.location).to_track_quat("-Z", "Y").to_euler()
bpy.ops.object.camera_add()
camera = bpy.context.object
camera.data.type = "ORTHO"
camera.data.ortho_scale = 2.3
scene.camera = camera
for name, location in [("front-negative-y", (0, -5, 0.2)), ("front-positive-y", (0, 5, 0.2)), ("three-quarter", (3, -5, 2.1))]:
    camera.location = location
    camera.rotation_euler = (Vector((0, 0, 0)) - camera.location).to_track_quat("-Z", "Y").to_euler()
    scene.render.filepath = str(OUT / f"{asset_id}-source-{name}.png")
    bpy.ops.render.render(write_still=True)
