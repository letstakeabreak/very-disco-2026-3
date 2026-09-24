"""Validate actual exported GLB data with the Python standard library."""
import hashlib
import json
import math
import struct
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
CONFIG = json.loads((HERE / "mobile-models.json").read_text())


def read_glb(path):
    data = path.read_bytes()
    assert data[:4] == b"glTF" and struct.unpack_from("<I", data, 4)[0] == 2
    assert struct.unpack_from("<I", data, 8)[0] == len(data)
    cursor, doc, binary = 12, None, None
    while cursor < len(data):
        size, kind = struct.unpack_from("<II", data, cursor)
        chunk = data[cursor + 8:cursor + 8 + size]
        if kind == 0x4E4F534A:
            doc = json.loads(chunk)
        elif kind == 0x004E4942:
            binary = chunk
        cursor += size + 8
    assert doc is not None and binary is not None
    assert all("uri" not in item for item in doc.get("buffers", []) + doc.get("images", []))
    return data, doc, binary


def jpeg_size(data):
    assert data[:2] == b"\xff\xd8"
    cursor = 2
    while cursor < len(data):
        assert data[cursor] == 255
        while data[cursor] == 255:
            cursor += 1
        marker = data[cursor]
        cursor += 1
        size = int.from_bytes(data[cursor:cursor + 2], "big")
        if marker in (0xC0, 0xC1, 0xC2):
            return list(reversed(struct.unpack_from(">HH", data, cursor + 3)))
        cursor += size
    raise ValueError("JPEG dimensions missing")


def accessor_values(doc, binary, accessor_id):
    accessor = doc["accessors"][accessor_id]
    assert "sparse" not in accessor
    view = doc["bufferViews"][accessor["bufferView"]]
    fmt = {5121: "B", 5123: "H", 5125: "I", 5126: "f"}[accessor["componentType"]]
    components = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4}[accessor["type"]]
    row = struct.Struct("<" + fmt * components)
    start = view.get("byteOffset", 0) + accessor.get("byteOffset", 0)
    stride = view.get("byteStride", row.size)
    return [row.unpack_from(binary, start + index * stride) for index in range(accessor["count"])]


reports = []
for spec in CONFIG["assets"]:
    path = ROOT / spec["output"]
    data, doc, binary = read_glb(path)
    assert not doc.get("extensionsRequired"), "Unexpected runtime decoder/extension requirement"
    assert not doc.get("animations"), "Unrequested animation data"
    parts, all_points = [], []
    for node in doc["nodes"]:
        assert "matrix" not in node
        assert node.get("translation", [0, 0, 0]) == [0, 0, 0]
        assert node.get("scale", [1, 1, 1]) == [1, 1, 1]
        assert node.get("rotation", [0, 0, 0, 1]) == [0, 0, 0, 1]
        if "mesh" not in node:
            continue
        points, triangles = [], 0
        for primitive in doc["meshes"][node["mesh"]]["primitives"]:
            assert primitive.get("mode", 4) == 4
            positions = accessor_values(doc, binary, primitive["attributes"]["POSITION"])
            normals = accessor_values(doc, binary, primitive["attributes"]["NORMAL"])
            assert all(math.isfinite(x) for p in positions for x in p)
            assert all(abs(sum(x*x for x in n) - 1) < 0.003 for n in normals)
            indices = accessor_values(doc, binary, primitive["indices"])
            assert max(i[0] for i in indices) < len(positions)
            assert len(indices) % 3 == 0
            triangles += len(indices) // 3
            points.extend(positions)
        box = [[min(p[i] for p in points) for i in range(3)], [max(p[i] for p in points) for i in range(3)]]
        parts.append({"name": node["name"], "triangles": triangles, "boundsMeters": box, "bakedVertices": True})
        all_points.extend(points)
    box = [[min(p[i] for p in all_points) for i in range(3)], [max(p[i] for p in all_points) for i in range(3)]]
    dimensions = [box[1][i] - box[0][i] for i in range(3)]
    target_axis = 1 if spec["normalizeDimension"] == "height" else 0
    assert abs(dimensions[target_axis] - spec["targetMeters"]) < 0.000001
    assert abs(box[0][1]) < 0.000001
    assert abs(box[0][0] + box[1][0]) < 0.000001
    assert abs(box[0][2] + box[1][2]) < 0.000001
    textures = []
    for im in doc["images"]:
        view = doc["bufferViews"][im["bufferView"]]
        raw = binary[view.get("byteOffset", 0):view.get("byteOffset", 0) + view["byteLength"]]
        assert im["mimeType"] == "image/jpeg"
        dimensions_px = jpeg_size(raw)
        assert max(dimensions_px) <= CONFIG["textureMaxDimension"]
        textures.append({"name": im.get("name"), "mimeType": im["mimeType"], "dimensions": dimensions_px, "bytes": len(raw)})
    triangles = sum(part["triangles"] for part in parts)
    assert triangles <= spec["maxTriangles"]
    assert len(doc["materials"]) == 1
    material = doc["materials"][0]
    assert "normalTexture" in material
    assert "baseColorTexture" in material["pbrMetallicRoughness"]
    assert "metallicRoughnessTexture" in material["pbrMetallicRoughness"]
    reports.append({"assetId": spec["id"], "path": spec["output"], "sha256": hashlib.sha256(data).hexdigest(), "bytes": len(data), "triangles": triangles, "dimensionsMetersXYZ": dimensions, "boundsMeters": box, "parts": parts, "textures": textures, "materials": doc["materials"], "selfContained": True, "extensionsRequired": doc.get("extensionsRequired", []), "validation": "passed"})
total_bytes = sum(report["bytes"] for report in reports)
total_triangles = sum(report["triangles"] for report in reports)
assert total_bytes <= CONFIG["combinedMaxBytes"]
assert total_triangles < CONFIG.get("combinedMaxTriangles", 90000)
result = {"schemaVersion": 1, "validation": "passed", "combinedBytes": total_bytes, "combinedTriangles": total_triangles, "assets": reports, "unverified": ["real iPhone load", "runtime shader deformation", "browser GPU performance", "gameplay integration"]}
(HERE / "glb-validation.json").write_text(json.dumps(result, indent=2) + "\n")
print(json.dumps({"validation": "passed", "combinedBytes": total_bytes, "combinedTriangles": total_triangles, "assets": [{"assetId": a["assetId"], "dimensionsMetersXYZ": a["dimensionsMetersXYZ"]} for a in reports]}, indent=2))
