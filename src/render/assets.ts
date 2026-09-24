import type { AssetRegistry } from '../contracts';
import { deepFreeze } from '../contracts/validate';

// Kept generated-unverified until actual iPhone fidelity/performance review.
export const ASSET_REGISTRY: AssetRegistry = deepFreeze({
  "press-chamber": {
    "id": "press-chamber",
    "status": "generated-unverified",
    "runtimePath": "assets/models/press-chamber.glb",
    "sourcePath": "assets/source/meshy/press-chamber",
    "imagegen": {
      "imagePath": "docs/art/concepts/04-press-chamber-reference.png",
      "promptPath": "docs/art/prompts.json",
      "generatedAt": "2026-09-24"
    },
    "meshy": {
      "modelVersion": "meshy-7",
      "taskId": "01a0d317-344c-74d4-8ae3-2a66fcd0e490",
      "generatedAt": "2026-09-24T11:05:11.541000+00:00"
    },
    "licenseNote": "Original ImageGen reference reconstructed using Meshy 7. Request, task and source evidence are preserved in sourcePath/provenance.json; service model echo and legal clearance are not asserted. Runtime geometry, PBR rebake and optical material restoration are derived from that source.",
    "geometry": {
      "triangles": 42998,
      "heightM": 1.100000023841858,
      "pivot": "base-center",
      "upAxis": "+Y",
      "forwardAxis": "+Z"
    },
    "verification": {
      "reviewer": null,
      "verifiedAt": null,
      "reportPath": null
    }
  },
  "salvage-core": {
    "id": "salvage-core",
    "status": "generated-unverified",
    "runtimePath": "assets/models/salvage-core.glb",
    "sourcePath": "assets/source/meshy/salvage-core",
    "imagegen": {
      "imagePath": "assets/source/meshy/salvage-core/input.png",
      "promptPath": "assets/source/meshy/salvage-core/prompt.md",
      "generatedAt": "2026-09-24T12:16:37.206041+00:00"
    },
    "meshy": {
      "modelVersion": "meshy-7",
      "taskId": "01a0d359-b859-70d0-8dd8-e97a946baad3",
      "generatedAt": "2026-09-24T12:17:49.287000+00:00"
    },
    "licenseNote": "Original ImageGen reference reconstructed using Meshy 7. Request, task and source evidence are preserved in sourcePath/provenance.json; service model echo and legal clearance are not asserted. Runtime geometry, PBR rebake and optical material restoration are derived from that source.",
    "geometry": {
      "triangles": 11500,
      "heightM": 0.15000000596046448,
      "pivot": "base-center",
      "upAxis": "+Y",
      "forwardAxis": "+Z"
    },
    "verification": {
      "reviewer": null,
      "verifiedAt": null,
      "reportPath": null
    }
  },
  "salvage-lens": {
    "id": "salvage-lens",
    "status": "generated-unverified",
    "runtimePath": "assets/models/salvage-lens.glb",
    "sourcePath": "assets/source/meshy/salvage-lens",
    "imagegen": {
      "imagePath": "assets/source/meshy/salvage-lens/input.png",
      "promptPath": "assets/source/meshy/salvage-lens/prompt.md",
      "generatedAt": "2026-09-24T12:16:06.574865+00:00"
    },
    "meshy": {
      "modelVersion": "meshy-7",
      "taskId": "01a0d35a-079c-7391-b3bc-90351feb4c04",
      "generatedAt": "2026-09-24T12:18:09.363000+00:00"
    },
    "licenseNote": "Original ImageGen reference reconstructed using Meshy 7. Request, task and source evidence are preserved in sourcePath/provenance.json; service model echo and legal clearance are not asserted. Runtime geometry, PBR rebake and optical material restoration are derived from that source.",
    "geometry": {
      "triangles": 11500,
      "heightM": 0.14999999105930328,
      "pivot": "base-center",
      "upAxis": "+Y",
      "forwardAxis": "+Z"
    },
    "verification": {
      "reviewer": null,
      "verifiedAt": null,
      "reportPath": null
    }
  },
  "salvage-cassette": {
    "id": "salvage-cassette",
    "status": "generated-unverified",
    "runtimePath": "assets/models/salvage-cassette.glb",
    "sourcePath": "assets/source/meshy/salvage-cassette",
    "imagegen": {
      "imagePath": "docs/art/concepts/03-salvage-cassette-reference.png",
      "promptPath": "docs/art/prompts.json",
      "generatedAt": "2026-09-24"
    },
    "meshy": {
      "modelVersion": "meshy-7",
      "taskId": "01a0d316-ae28-71d1-be43-533ccd61421b",
      "generatedAt": "2026-09-24T11:04:36.903000+00:00"
    },
    "licenseNote": "Original ImageGen reference reconstructed using Meshy 7. Request, task and source evidence are preserved in sourcePath/provenance.json; service model echo and legal clearance are not asserted. Runtime geometry, PBR rebake and optical material restoration are derived from that source.",
    "geometry": {
      "triangles": 15000,
      "heightM": 0.1342819482088089,
      "pivot": "base-center",
      "upAxis": "+Y",
      "forwardAxis": "+Z"
    },
    "verification": {
      "reviewer": null,
      "verifiedAt": null,
      "reportPath": null
    }
  }
});
