"""Resolve a raw GLB or verified lossless gzip chunks without editing sources."""
import gzip
import hashlib
import json
import shutil
import tempfile
from contextlib import contextmanager
from pathlib import Path


def digest(path):
    with path.open("rb") as handle:
        return hashlib.file_digest(handle, "sha256").hexdigest()


@contextmanager
def resolved_source(path):
    path = Path(path)
    if path.exists():
        yield path
        return
    manifest_path = path.parent / "archive-manifest.json"
    manifest = json.loads(manifest_path.read_text()) if manifest_path.exists() else None
    with tempfile.TemporaryDirectory(prefix="deep-press-model-") as directory:
        archive = Path(directory) / (path.name + ".gz")
        direct = path.with_suffix(path.suffix + ".gz")
        if direct.exists():
            archive = direct
        else:
            if not manifest or manifest["restoredFile"] != path.name:
                raise FileNotFoundError(f"No source or matching verified archive for {path}")
            with archive.open("wb") as output:
                for entry in manifest["parts"]:
                    part = path.parent / entry["file"]
                    assert part.stat().st_size == entry["bytes"]
                    assert digest(part) == entry["sha256"]
                    with part.open("rb") as source:
                        shutil.copyfileobj(source, output)
        if manifest:
            assert digest(archive) == manifest["archiveSha256"]
        restored = Path(directory) / path.name
        with gzip.open(archive, "rb") as source, restored.open("wb") as output:
            shutil.copyfileobj(source, output)
        if manifest:
            assert restored.stat().st_size == manifest["restoredBytes"]
            assert digest(restored) == manifest["restoredSha256"]
        yield restored
