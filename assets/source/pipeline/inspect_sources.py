"""Read-only Meshy geometry inspection; run with Blender --background --python."""
import bpy
import json
import sys
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[3]
OUT = Path(__file__).resolve().parent
sys.path.insert(0, str(OUT))
from source_io import resolved_source

reports = {}
for asset in ("press-chamber", "salvage-cassette", "salvage-core", "salvage-lens"):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    source = ROOT / "assets/source/meshy" / asset / f"{asset}-master.glb"
    with resolved_source(source) as resolved:
        bpy.ops.import_scene.gltf(filepath=str(resolved))
    report = {"objects": []}
    for obj in bpy.context.scene.objects:
        if obj.type != "MESH":
            continue
        points = [obj.matrix_world @ v.co for v in obj.data.vertices]
        lo = [min(p[i] for p in points) for i in range(3)]
        hi = [max(p[i] for p in points) for i in range(3)]
        hist = []
        for index in range(20):
            bottom = lo[2] + (hi[2] - lo[2]) * index / 20
            top = lo[2] + (hi[2] - lo[2]) * (index + 1) / 20
            selected = [p for p in points if bottom <= p.z < top]
            hist.append({"z": [bottom, top], "vertices": len(selected), "x": [min(p.x for p in selected), max(p.x for p in selected)], "y": [min(p.y for p in selected), max(p.y for p in selected)]} if selected else {"z": [bottom, top], "vertices": 0})
        report["objects"].append({"name": obj.name, "vertices": len(points), "triangles": sum(len(p.vertices) - 2 for p in obj.data.polygons), "blenderBounds": [lo, hi], "matrixWorld": [list(row) for row in obj.matrix_world], "heightSlices": hist})
    report["images"] = [{"name": im.name, "size": list(im.size), "channels": im.channels} for im in bpy.data.images]
    reports[asset] = report
reports["gltfExportProperties"] = list(bpy.ops.export_scene.gltf.get_rna_type().properties.keys())
(OUT / "source-inspection.json").write_text(json.dumps(reports, indent=2) + "\n")
print(json.dumps(reports, indent=2))
