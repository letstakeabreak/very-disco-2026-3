"""Headless Blender regressions for physical surface selection and guard failures."""
import bpy
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from press_anchors import calibrate_press

bpy.ops.wm.read_factory_settings(use_empty=True)
calibration = {
    "workbedMethod": "downward-ray-at-ram-center", "expectedWorkbedYRangeMeters": [.36, .39],
    "specimenBaseYMeters": .3782, "maxFloorClearanceMeters": .003,
    "ramTopConnectionSourceZ": .8, "ramLowerFlangeSourceZ": .6,
}


def mesh(name, vertices, faces):
    data = bpy.data.meshes.new(name)
    data.from_pydata(vertices, [], faces)
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    return obj


ram = mesh("press-ram", [(-.15, -.13, .55), (.15, .13, .8)], [])
frame = mesh("press-frame", [(-.2, -.3, .3764), (.2, -.3, .3764), (.2, .3, .3764), (-.2, .3, .3764),
                            (.4, .4, .43), (.5, .4, .43), (.5, .5, .43),
                            (0, 0, .3687)], [(0, 1, 2, 3), (4, 5, 6)])
bpy.context.view_layer.update()


def measure(profile=calibration):
    return calibrate_press([ram, frame], profile, (0, 0, 0), 1)


def rejects(message, profile=calibration):
    try:
        measure(profile)
    except ValueError as error:
        assert message in str(error), str(error)
    else:
        raise AssertionError("Expected calibration rejection: " + message)


result = measure()
assert abs(result["workbedTopY"] - .3764) < 1e-6
assert abs(result["floorClearance"] - .0018) < 1e-6
assert result["specimenBase"][1] == .3782
assert abs(result["maxDownwardTravel"] - (.55 - .3782)) < 1e-6
rejects("clearance", {**calibration, "specimenBaseYMeters": .375})
rejects("clearance", {**calibration, "specimenBaseYMeters": .39})
rejects("outside reviewed range", {**calibration, "expectedWorkbedYRangeMeters": [.36, .37]})
frame.location.x = 2
bpy.context.view_layer.update()
rejects("No workbed surface")
frame.location.x = 0
for vertex in frame.data.vertices[:4]:
    vertex.co.z += vertex.co.x * .5
frame.data.update()
bpy.context.view_layer.update()
rejects("nearly horizontal")
print(json.dumps({"validation": "passed", "checks": ["surface ray ignores low loose vertex and off-axis high lip", "base-clearance-travel arithmetic", "below-surface base rejected", "excessive clearance rejected", "unexpected bed range rejected", "ray miss rejected", "sloped support rejected"]}), flush=True)
