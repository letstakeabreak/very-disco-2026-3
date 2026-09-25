# salvage-lens source master

Status: **generated-unverified**. Built-in ImageGen reference → Meshy 7 standard image-to-3D; 4K PBR requested, ultra disabled. One ImageGen call and one paid Meshy create; no paid retry/remesh.

- Reference and exact prompt: [input.png](input.png), [prompt.md](prompt.md).
- Meshy service render: [preview.png](preview.png).
- Generation settings, task trail, measured source structure and limitations: [provenance.json](provenance.json).
- Lossless model archive: five `salvage-lens-master.glb.gz.part-*` files in the exact order recorded in [archive-manifest.json](archive-manifest.json).
- Original GLB: 144,142,508 bytes; 3,952,752 triangles; one mesh, primitive and OPAQUE material.
- Embedded base color and normal are 4096×4096; metallic/roughness is 2048×2048. The 4K request does not mean every PBR map is 4K.
- Confirmed cost: 30 credits. Core and lens together used 60; observed balance 1,050 → 990.

## Archive and exact restoration

The raw master exceeds the normal repository file-size budget. Its lossless gzip archive is 112,768,005 bytes, so it is split into four 25,000,000-byte chunks and one 12,768,005-byte chunk. No geometry, textures or metadata were changed by this archive operation. The manifest records every chunk hash plus complete archive and original GLB hashes.

From this folder, restore the original raw filename with:

```sh
cat salvage-lens-master.glb.gz.part-* | gzip -dc > salvage-lens-master.glb
shasum -a 256 salvage-lens-master.glb
```

Expected restored SHA-256:

```text
6c1804a11b44a4a54411f6e980af7329ae4ef345bbf2aaaac5051875f67f6397
```

The raw filename is deliberately ignored by the local `.gitignore`. The original raw copy and full service task/download metadata are retained in the sibling `very-disco-2026-3-meshy-work` directory, outside Git. The preserved uncompressed file is `../very-disco-2026-3-meshy-work/salvage-lens/salvage-lens-master.glb` relative to the repository root. Credentials and signed URLs are absent from this source package. Do not commit a newly reassembled 112 MB gzip file; the five chunks are the repository copy. Concatenated chunks matched the complete gzip hash, and decompressed bytes matched the original GLB hash.

## Reference versus generated model

The ImageGen reference shows a transparent blue-green convex optical disk. Large rectangular studio-light reflections, a bright cyan lower edge and the view through/refracted inside of the disk make it read as thick glass. The rigid disk sits inside a black circular retaining ring; chipped ivory top and bottom cage rails, metal corrugated struts and black cushion blocks protect it.

The Meshy render retains the overall rectangular cage, circular dark ring, side struts and worn ivory/dark-metal family. However, the optical disk becomes an opaque pale blue-gray convex surface with a small highlight. The reference's transparency, internal optical detail, edge transmission and refraction are missing. Some cushion blocks and small frame joints look softer and less mechanically crisp in the service preview. A different camera angle contributes to the visual difference; this single preview alone cannot establish back-face accuracy or exact topology quality.

The GLB confirms one OPAQUE material, no transmission extension and no separate glass primitive. The render is therefore not evidence of transparent glass support. The front circular disk must be identified on the actual geometry/UV and kept rigid; the surrounding rectangular frame is the compressible part. Restore the disk's glass response with a suitably separated or masked runtime material. Do not apply transparency or jelly-like scaling to the entire asset. The original image is the material target, while the runtime result still needs visual verification.

## Runtime handoff

The PRD's initial 0.58 L is game-rule data, not measured mesh volume. Runtime normalization, mobile optimization, authored compression, rigid-lens preservation, actual scene fidelity and iPhone performance are separate unfinished validations. Source generation and lossless restoration do not certify them.
