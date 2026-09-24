"""Append the verified insert to the unchanged mobile housing, without re-encoding PBR."""
import copy
import hashlib
import json
import struct
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[4]
OUTPUT = ROOT / "public/assets/models/salvage-cassette.glb"


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def read(path, expected_node):
    data = path.read_bytes()
    assert struct.unpack_from("<III", data) == (0x46546C67, 2, len(data))
    length, kind = struct.unpack_from("<II", data, 12)
    assert kind == 0x4E4F534A
    doc = json.loads(data[20:20 + length])
    offset = 20 + length
    bin_length, kind = struct.unpack_from("<II", data, offset)
    assert kind == 0x004E4942 and offset + 8 + bin_length == len(data)
    assert doc["nodes"] == [{"mesh": 0, "name": expected_node}]
    assert len(doc["meshes"]) == len(doc["materials"]) == len(doc["buffers"]) == 1
    assert not any(key in doc for key in ("skins", "animations", "extensionsUsed", "extensionsRequired"))
    assert all("sparse" not in a for a in doc["accessors"])
    return doc, data[offset + 8:]


shell_path, insert_path = HERE / "shell-mobile.glb", HERE / "insert-mobile.glb"
assert sha(shell_path) == "5ef39a75ca73bf6de45605d32b09099ff66710fa0e009eacca1da9d55c704aee"
shell, left = read(shell_path, "salvage-cassette")
insert, right = read(insert_path, "cassette-interior")
result = copy.deepcopy(shell)
keys = ("bufferViews", "accessors", "images", "samplers", "textures", "materials", "meshes", "nodes")
offsets = {key: len(shell[key]) for key in keys}
for view in insert["bufferViews"]:
    view["byteOffset"] = view.get("byteOffset", 0) + len(left)
for accessor in insert["accessors"]:
    accessor["bufferView"] += offsets["bufferViews"]
for image in insert["images"]:
    image["bufferView"] += offsets["bufferViews"]
for texture in insert["textures"]:
    texture["source"] += offsets["images"]
    texture["sampler"] += offsets["samplers"]
material = insert["materials"][0]
material["normalTexture"]["index"] += offsets["textures"]
for key in ("baseColorTexture", "metallicRoughnessTexture"):
    material["pbrMetallicRoughness"][key]["index"] += offsets["textures"]
for primitive in insert["meshes"][0]["primitives"]:
    assert "targets" not in primitive
    primitive["indices"] += offsets["accessors"]
    primitive["material"] += offsets["materials"]
    primitive["attributes"] = {key: value + offsets["accessors"] for key, value in primitive["attributes"].items()}
insert["nodes"][0]["mesh"] += offsets["meshes"]
for key in keys:
    result[key].extend(insert[key])
result["scenes"][0]["nodes"].append(offsets["nodes"])
result["buffers"] = [{"byteLength": len(left) + len(right)}]
encoded = json.dumps(result, separators=(",", ":")).encode()
encoded += b" " * (-len(encoded) % 4)
binary = left + right
OUTPUT.write_bytes(struct.pack("<III", 0x46546C67, 2, 28 + len(encoded) + len(binary)) +
    struct.pack("<II", len(encoded), 0x4E4F534A) + encoded +
    struct.pack("<II", len(binary), 0x004E4942) + binary)
triangles = sum(result["accessors"][p["indices"]]["count"] // 3 for m in result["meshes"] for p in m["primitives"])
report = {"method": "Append embedded GLB buffers; original housing geometry and texture bytes unchanged",
    "inputs": [{"path": str(p.relative_to(ROOT)), "sha256": sha(p)} for p in (shell_path, insert_path)],
    "output": {"path": str(OUTPUT.relative_to(ROOT)), "sha256": sha(OUTPUT), "bytes": OUTPUT.stat().st_size,
        "triangles": triangles, "meshes": len(result["meshes"]), "materials": len(result["materials"])}}
(HERE / "assembly-report.json").write_text(json.dumps(report, indent=2) + "\n")
# Keep the shipping registry's measurement report authoritative. The original
# master entry still describes the housing; the added source has its own report.
pipeline_path = ROOT / "assets/source/pipeline/mobile-model-report.json"
pipeline = json.loads(pipeline_path.read_text())
asset = next(a for a in pipeline["assets"] if a["assetId"] == "salvage-cassette")
component = json.loads((HERE / "mobile-report.json").read_text())["assets"][0]
asset["runtimeBytes"] = report["output"]["bytes"]
asset["runtimeSha256"] = report["output"]["sha256"]
asset["triangles"] = triangles
asset["assembly"] = {"report": str((HERE / "assembly-report.json").relative_to(ROOT)),
    "componentReport": str((HERE / "mobile-report.json").relative_to(ROOT)),
    "regenerate": "Prepare/rebake the original housing, then run insert-v1/assemble.py"}
asset["textures"] = asset["textures"][:3] + component["textures"]
box = component["boundsBlender"]
asset["parts"] = [part for part in asset["parts"] if part["name"] != "cassette-interior"] + [
    {"name": "cassette-interior", "triangles": component["triangles"], "nodeTranslation": [0, 0, 0],
     "boundsGltfMeters": [[box[0][0], box[0][2], -box[1][1]], [box[1][0], box[1][2], -box[0][1]]]}]
pipeline["combinedRuntimeBytes"] = sum(a["runtimeBytes"] for a in pipeline["assets"])
pipeline_path.write_text(json.dumps(pipeline, indent=2) + "\n")
print(json.dumps(report, indent=2))
