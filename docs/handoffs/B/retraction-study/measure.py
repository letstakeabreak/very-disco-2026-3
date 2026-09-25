"""Actual GLB pose geometry inspection; no mesh export, render, or source writes."""
import bpy
import hashlib
import json
import math
from datetime import datetime, timezone
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from mathutils.geometry import intersect_ray_tri

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
anchor = json.loads((ROOT / "assets/source/pipeline/anchor-recalculation.json").read_text())["anchors"]
top = round(anchor["ramTopConnectionY"], 8)
flange = round(anchor["ramLowerFlangeTopY"], 8)
span = top - flange
path = ROOT / "public/assets/models/press-chamber.glb"
sha = hashlib.sha256(path.read_bytes()).hexdigest()
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(path))
bpy.context.view_layer.update()


def geometry(name):
    obj = bpy.data.objects[name]
    obj.data.calc_loop_triangles()
    points = [obj.matrix_world @ vertex.co for vertex in obj.data.vertices]
    return [Vector((p.x, p.z, -p.y)) for p in points], [tuple(t.vertices) for t in obj.data.loop_triangles]


ram, indices = geometry("press-ram")
frame, frame_indices = geometry("press-frame")
frame_tree = BVHTree.FromPolygons(frame, frame_indices, all_triangles=True)


def mapped_y(y, travel):
    u = min(1, max(0, (y - flange) / span))
    return y - travel * (1 - u*u*(3 - 2*u))


def proper_intersection(a, b):
    # Proper edge-through-face crossings only; tangency/coplanarity excluded.
    for first, second in ((a, b), (b, a)):
        for i in range(3):
            start, end = first[i], first[(i + 1) % 3]
            direction = end - start
            hit = intersect_ray_tri(*second, direction, start, True)
            if hit is None or direction.length_squared < 1e-16:
                continue
            t = (hit - start).dot(direction) / direction.length_squared
            if not 1e-6 < t < 1 - 1e-6:
                continue
            # Ignore hits on the other triangle's edges.
            edge_distances = [(hit-second[j]).cross(second[(j+1)%3]-second[j]).length / max((second[(j+1)%3]-second[j]).length, 1e-12) for j in range(3)]
            if min(edge_distances) > 1e-7:
                return hit
    return None


def crossings(points):
    tree = BVHTree.FromPolygons(points, indices, all_triangles=True)
    result = {}
    for i, j in tree.overlap(frame_tree):
        hit = proper_intersection([points[k] for k in indices[i]], [frame[k] for k in frame_indices[j]])
        if hit is not None:
            result[(i, j)] = list(hit)
    return result


baseline_crossings = crossings(ram)
poses = []
for travel in [0, -.08, -.09, .071206942, anchor["maxDownwardTravel"]]:
    points = [Vector((p.x, mapped_y(p.y, travel), p.z)) for p in ram]
    new_crossings = crossings(points)
    added = [p for pair,p in new_crossings.items() if pair not in baseline_crossings]
    fixed = [i for i, p in enumerate(ram) if p.y >= top]
    low = [i for i, p in enumerate(ram) if p.y <= flange]
    area_ratios = []
    normal_dot = []
    for ids in indices:
        a,b,c = [ram[i] for i in ids]
        x,y,z = [points[i] for i in ids]
        before=(b-a).cross(c-a); after=(y-x).cross(z-x)
        if before.length < 1e-12:
            continue
        area_ratios.append(after.length/before.length)
        normal_dot.append(before.normalized().dot(after.normalized()))
    ys = sorted(set(p.y for p in ram))
    deltas = [mapped_y(ys[i+1], travel)-mapped_y(ys[i], travel) for i in range(len(ys)-1)]
    poses.append({
        "travelM": travel, "minY": min(p.y for p in points), "maxY": max(p.y for p in points),
        "fixedTopVertices": len(fixed), "maxTopDisplacementM": max((points[i]-ram[i]).length for i in fixed),
        "lowerRigidVertices": len(low), "maxLowerRigidErrorM": max(abs((points[i].y-ram[i].y)+travel) for i in low),
        "minimumAdjacentDistinctVertexHeightDeltaM": min(deltas), "minTriangleAreaRatio": min(area_ratios),
        "minOriginalVsDeformedNormalDot": min(normal_dot),
        "properFrameCrossings": len(new_crossings), "newProperFrameCrossingsVsRest": len(added),
        "newCrossingPointBounds": [[min(p[i] for p in added) for i in range(3)], [max(p[i] for p in added) for i in range(3)]] if added else None,
        "newCrossingPoints": added,
    })

assert hashlib.sha256(path.read_bytes()).hexdigest() == sha
report = {"checkedAt": datetime.now(timezone.utc).isoformat(), "blenderVersion": bpy.app.version_string,
          "scope": "Actual runtime GLB geometry with CPU application of the shader's rounded thresholds; no GLB mutation; not gameplay or device proof",
          "pressSha256": sha, "ramTriangles": len(indices), "ramVertices": len(ram),
          "shaderFlangeY": flange, "shaderTopY": top, "spanM": span,
          "strictPositiveDerivativeRetractionUpperBoundM": 2*span/3,
          "minimumDerivativeAt80mm": 1-1.5*.08/span, "minimumDerivativeAt90mm": 1-1.5*.09/span,
          "proof": "For a=-travel>=0, F(y)=y+a*(1-smoothstep(u)). F'(y)=1-6*a*u*(1-u)/L >= 1-1.5*a/L. Strictly positive for a<2L/3. Above top, F(y)=y; below flange, F(y)=y+a.",
          "poses": poses,
          "limits": ["Frame crossing test detects proper edge-through-face crossings only; tangential and coplanar contacts excluded", "Monotonicity proof applies to the continuous height map; no complete self-intersection certification of the tessellated generated asset", "Authored rest geometry may already contain contact or intersection", "No physical stress, seal, hydraulic mechanism, or device validation"]}
(HERE / "geometry-report.json").write_text(json.dumps(report, indent=2)+"\n")
print(json.dumps(report, indent=2), flush=True)
