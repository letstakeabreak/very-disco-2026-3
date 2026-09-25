# Lens UV / normal diagnosis — retained evidence

This bounded offline experiment diagnosed an earlier lens runtime model. It is not a runtime replacement or game/device verification. No new ImageGen or paid Meshy jobs were submitted. The inspected runtime input SHA-256 is recorded in [probe-result.json](probe-result.json); the current production model may differ.

## Two retained images

- [Before: inherited UVs, emission-only base color](runtime-basecolor-only.png). Long triangle-shaped streaks remain with lighting and normal maps removed, isolating inherited UV interpolation distortion.
- [After: welded low mesh, new atlas and source base-color projection](rebaked-runtime-basecolor-only.png). Most triangle streaks disappear and painted strips become continuous. This demonstrates improved color mapping; it does not prove that the full PBR result passed.

## Other observations from the completed inspection

Normal-map removal did not eliminate faceted reflections. Runtime indexing contained many split vertices: lens-glass had 5,021 vertices but 1,379 unique positions rounded to 1e-6; lens-housing had 27,653 but 4,225 unique positions. Clearing custom normals and toggling smooth shading alone did not join them.

A normalized-source inspection render was clean with the same report scale, origin and camera, supporting source/target alignment. The full rebaked probe still had unacceptable lighting facets, so it **failed visual approval**. Those additional diagnostic images and the failed experimental GLB were intentionally removed to reduce repository size. Their names, sizes and hashes remain in probe-result.json as historical records; they are not available artifacts in this directory.

## Reproduction and scope

The sibling `lens-bake-probe.py` is retained. It supports `-- diagnose`, `-- bake` and `-- verify-bake`, and writes experimental output only into this directory. `verify-bake` requires generating a new local experimental GLB first. The script reads the current runtime/report, so rerunning it after production changes is a new experiment, not a byte-for-byte replay of the historical input. `source_io.resolved_source` reconstructs and hash-verifies the original archived master without changing it.

The historical bake retained 2,000 glass + 9,500 housing triangles, welded positions at 1e-6, cleared inherited normals, smoothed surfaces, and unwrapped each part at 66 degrees / 0.007 margin. Selected-to-active projection used a 0.003 m cage, 0.02 m maximum ray distance and 12-pixel margin to bake 2K emission base color and tangent normals. Metalness 0.65 and roughness 0.42 were diagnostic constants, not source-derived PBR maps.

The common pipeline owner then reported a successful combination of welding, a shared atlas, 45-degree sharp-edge weighted normals, and source base-color / metallic-roughness / normal rebaking in `rebake_mobile.py`. Production output and final visual validation belong to that pipeline. This diagnostic does not certify its final model.

## Cleanup boundary

Only this agent's experimental files were removed. Four files remain in this directory: this note, probe-result.json, and the two linked before/after PNGs. The reproduction script remains one directory above. The source master, production runtime GLBs and shared pipeline files were not changed by this cleanup.
