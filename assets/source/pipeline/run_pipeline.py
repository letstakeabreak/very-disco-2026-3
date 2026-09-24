"""Rebuild all mobile assets from preserved masters, including final PBR bake."""
import argparse
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
parser = argparse.ArgumentParser()
parser.add_argument("--blender", default="/Applications/Blender.app/Contents/MacOS/Blender")
parser.add_argument("--skip-renders", action="store_true", help="File validation still runs; visual review remains required")
args = parser.parse_args()
for script in ("prepare_mobile.py", "rebake_mobile.py"):
    subprocess.run([args.blender, "--background", "--factory-startup", "--python-exit-code", "1", "--python", str(HERE / script)], cwd=ROOT, check=True)
subprocess.run([sys.executable, str(HERE / "validate_glbs.py")], cwd=ROOT, check=True)
if not args.skip_renders:
    subprocess.run([args.blender, "--background", "--factory-startup", "--python-exit-code", "1", "--python", str(HERE / "verify_visuals.py")], cwd=ROOT, check=True)
print("Rebuild and structural validation passed. Inspect comparison renders; real device validation is separate.")
