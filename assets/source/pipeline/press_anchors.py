"""Press contact anchors from actual normalized Blender mesh triangles, no export."""
from mathutils import Vector
from mathutils.bvhtree import BVHTree


def world_points(obj):
    return [obj.matrix_world @ vertex.co for vertex in obj.data.vertices]


def calibrate_press(parts, calibration, source_origin, source_scale):
    if calibration["workbedMethod"] != "downward-ray-at-ram-center":
        raise ValueError("Unknown press workbed calibration method")
    ram = next(obj for obj in parts if obj.name == "press-ram")
    frame = next(obj for obj in parts if obj.name == "press-frame")
    points = world_points(ram)
    # Blender +Z is up and -Y is glTF front. Preserve the calibrated ram XZ.
    x = (min(p.x for p in points) + max(p.x for p in points)) / 2
    z = -(min(p.y for p in points) + max(p.y for p in points)) / 2
    platen_y = min(p.z for p in points)
    # Start below the resting platen so the upper frame cannot mask the bed.
    ray_origin = Vector((x, -z, platen_y - 0.01))
    frame_points = world_points(frame)
    tree = BVHTree.FromPolygons(frame_points, [list(face.vertices) for face in frame.data.polygons])
    point, normal, face_index, distance = tree.ray_cast(ray_origin, Vector((0, 0, -1)))
    if point is None:
        raise ValueError("No workbed surface below the ram center")
    if normal.z < 0.97:
        raise ValueError("Workbed ray did not hit a nearly horizontal upward face")
    bed_y = point.z
    lo, hi = calibration["expectedWorkbedYRangeMeters"]
    if not lo <= bed_y <= hi:
        raise ValueError(f"Workbed surface {bed_y} outside reviewed range [{lo}, {hi}]")
    base_y = calibration["specimenBaseYMeters"]
    clearance = base_y - bed_y
    if not 0 <= clearance <= calibration["maxFloorClearanceMeters"]:
        raise ValueError(f"Specimen base clearance {clearance} requires a new contact review")
    if base_y >= platen_y:
        raise ValueError("Specimen base reaches the resting platen")
    travel = platen_y - base_y
    return {
        "coordinateSpace": "asset root, meters, glTF +Y up +Z front",
        "workbedMethod": calibration["workbedMethod"],
        "workbedTopY": bed_y,
        "workbedPoint": [point.x, point.z, -point.y],
        "specimenBase": [x, base_y, z],
        "platenRestBottomY": platen_y,
        "ramTopConnectionY": (calibration["ramTopConnectionSourceZ"] - source_origin[2]) * source_scale,
        "ramLowerFlangeTopY": (calibration["ramLowerFlangeSourceZ"] - source_origin[2]) * source_scale,
        "ramCenterXZ": [x, z],
        "floorClearance": clearance,
        "maxDownwardTravel": travel,
        "translationRangeY": [-travel, 0],
        "contactFormula": "ramTravel = clamp(platenRestBottomY - (specimenBase[1] + specimenRenderedHeight), 0, maxDownwardTravel)",
        "connectionNote": "Keep upper attachment fixed and extend the cylinder body; do not stretch the lower flange.",
        "workbedRay": {
            "origin": [ray_origin.x, ray_origin.z, -ray_origin.y],
            "direction": [0, -1, 0],
            "normal": [normal.x, normal.z, -normal.y],
            "faceIndex": face_index,
            "distance": distance,
            "method": "Blender BVHTree over actual frame polygons in world coordinates; no height-clipped vertex sample",
        },
    }
