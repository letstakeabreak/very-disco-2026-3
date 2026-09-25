"""Read the final press GLB and refresh anchors only; never bake or export models."""
import bpy
import hashlib
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
sys.path.insert(0, str(HERE))
from press_anchors import calibrate_press


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


config = json.loads((HERE / "mobile-models.json").read_text())
spec = next(asset for asset in config["assets"] if asset["id"] == "press-chamber")
historical_path = HERE / "mobile-model-report.json"
historical_sha = sha(historical_path)
historical = json.loads(historical_path.read_text())
lineage = next(asset for asset in historical["assets"] if asset["assetId"] == "press-chamber")
runtime = ROOT / spec["output"]
before = {str((ROOT / asset["output"]).relative_to(ROOT)): sha(ROOT / asset["output"]) for asset in config["assets"]}
if sha(runtime) != lineage["runtimeSha256"]:
    raise ValueError("Press GLB does not match normalization lineage; remeasure source origin and scale")
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(runtime))
bpy.context.view_layer.update()
parts = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
anchors = calibrate_press(parts, spec["calibration"], lineage["sourceBaseCenterBlender"], lineage["sourceToMetersScale"])
after = {path: sha(ROOT / path) for path in before}
assert before == after, "Anchor-only inspection changed a runtime GLB"
assert sha(historical_path) == historical_sha, "Historical pipeline report changed"
report = {
    "schemaVersion": 1, "checkedAt": datetime.now(timezone.utc).isoformat(),
    "scope": "anchor-only recalculation of the existing final GLB; no bake, decimation, export, browser or device validation",
    "blenderVersion": bpy.app.version_string,
    "sourceCodeSha256": {path.name: sha(path) for path in [HERE / "press_anchors.py", HERE / "recalculate_anchors.py", HERE / "mobile-models.json"]},
    "historicalLineageReport": "mobile-model-report.json", "historicalLineageReportSha256": historical_sha,
    "runtimeHashesBefore": before, "runtimeHashesAfter": after,
    "anchors": anchors, "validation": "passed",
}
output = HERE / "anchor-recalculation.json"
output.write_text(json.dumps(report, indent=2) + "\n")
summary_path = HERE / "runtime-anchors.json"
summary = json.loads(summary_path.read_text())
summary["schemaVersion"] = 2
summary["press"] = {"parts": ["press-frame", "press-ram"], "sharedMaterial": True, **anchors,
                    "runtimeSha256": before[spec["output"]], "measuredFrom": "anchor-recalculation.json"}
summary["measuredFrom"] = {"press": "anchor-recalculation.json", "lens": "glb-validation.json"}
summary_path.write_text(json.dumps(summary, indent=2) + "\n")
print(json.dumps({"validation": "passed", "workbedY": anchors["workbedTopY"], "clearance": anchors["floorClearance"], "specimenBase": anchors["specimenBase"], "travel": anchors["maxDownwardTravel"], "allRuntimeFilesUnchanged": before == after}, indent=2), flush=True)
