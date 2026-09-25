"""Diagnostic comparison for normals; renders never presented as gameplay."""
import bpy
import math
from pathlib import Path
from mathutils import Vector
HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(ROOT / "public/assets/models/press-chamber.glb"))
for obj in list(bpy.context.scene.objects):
    if obj.type != "MESH": continue
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    obj.data.normals_split_custom_set([(0, 0, 0)] * len(obj.data.loops))
    obj.data.set_sharp_from_angle(angle=math.radians(45))
    modifier = obj.modifiers.new("Weighted", "WEIGHTED_NORMAL")
    modifier.keep_sharp = True
    modifier.weight = 50
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    obj.select_set(False)
scene=bpy.context.scene
scene.render.engine="CYCLES"
scene.cycles.samples=16
scene.render.resolution_x=1000
scene.render.resolution_y=1000
scene.render.resolution_percentage=100
scene.world=bpy.data.worlds.new("W")
scene.world.use_nodes=True
scene.world.node_tree.nodes["Background"].inputs["Strength"].default_value=.6
for position,power in [((2,-3,4),600),((-3,-1,2),400),((1,2,3),700)]:
    bpy.ops.object.light_add(type="AREA",location=position)
    light=bpy.context.object
    light.data.energy=power
    light.data.size=3
    light.rotation_euler=(Vector((0,0,.5))-light.location).to_track_quat("-Z","Y").to_euler()
bpy.ops.object.camera_add(location=(2,-4,2.3))
cam=bpy.context.object
cam.data.type="ORTHO"
cam.data.ortho_scale=1.47
cam.rotation_euler=(Vector((0,0,.528))-cam.location).to_track_quat("-Z","Y").to_euler()
scene.camera=cam
scene.render.filepath=str(HERE / "inspection/press-weighted-normal-test.png")
bpy.ops.render.render(write_still=True)
for material in bpy.data.materials:
    if not material.use_nodes: continue
    nodes = material.node_tree.nodes
    bsdf = nodes.get("Principled BSDF")
    if not bsdf: continue
    base_source = next((link.from_socket for link in material.node_tree.links if link.to_socket == bsdf.inputs["Base Color"]), None)
    output = next(node for node in nodes if node.type == "OUTPUT_MATERIAL")
    emission = nodes.new("ShaderNodeEmission")
    material.node_tree.links.new(base_source, emission.inputs["Color"])
    material.node_tree.links.new(emission.outputs[0], output.inputs["Surface"])
scene.render.filepath=str(HERE / "inspection/press-basecolor-only.png")
bpy.ops.render.render(write_still=True)
for obj in bpy.context.scene.objects:
    if obj.type != "MESH": continue
    material = bpy.data.materials.new("gray")
    material.use_nodes = True
    bsdf = material.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (.3,.3,.3,1)
    bsdf.inputs["Metallic"].default_value = .4
    bsdf.inputs["Roughness"].default_value = .35
    obj.data.materials.clear()
    obj.data.materials.append(material)
scene.render.filepath=str(HERE / "inspection/press-geometry-only.png")
bpy.ops.render.render(write_still=True)
