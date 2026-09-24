# C role handoff — DEEP PRESS

Date: 2026-09-25 (Asia/Seoul)
Role: C — app, input, HUD (`magic3ightball`, verified through the connected GitHub identity tool)  
Contract: 1.0.0  
PRD: 1.0.1 (`executionReady: true`)  
Target branch: `role/c-app`  
Implementation commit: `06e8d24d1c02b9c04df39ecb8e2ce2b251a69172` (official `bootstrap-v2` parent)
Original C PR: [#3](https://github.com/letstakeabreak/very-disco-2026-3/pull/3), merged into `integration/v1` at `554e2a1182bba9027c28bfac8d1702bbefaff407`
Short-viewport follow-up: `role/c-app-followup`, based on merged integration commit `554e2a1182bba9027c28bfac8d1702bbefaff407`
Follow-up PR: [#5](https://github.com/letstakeabreak/very-disco-2026-3/pull/5), open against `integration/v1`

## Starting point and provenance

The Drive archive `DEEP-PRESS-bootstrap-v2.zip` was downloaded from the user-provided project folder and its SHA-256 matched the value in `00-START-HERE.md`: `4bbe967e112f2a89188e9e1a880e7385057d18cf2b31e993bb39ac1e9fe69d24`. Its top-level directory is named `c739b527449b2527e46b567bfffbd4a7122f571c`; `docs/bootstrap.json` records `bootstrap-v2`, PRD 1.0.1, contract 1.0.0 and 23 frozen-file hashes. `npm run bootstrap:check` passed those 23 frozen-file checks.

The archive does not contain Git metadata, so the initial local work used a synthetic Git commit. The official `bootstrap-v2` annotated tag was resolved: tag object `ba2f00e700c04402cfa6574c4db9cf5ab0d7c2a0` points to commit `c739b527449b2527e46b567bfffbd4a7122f571c`. At verification time `integration/v1` pointed to that commit; after C PR #3 merged, its current head became `554e2a1182bba9027c28bfac8d1702bbefaff407`. The local archive's Git tree hash (`b0e6095ebf9c51eb7fb9711cae4ddb30970cd12d`) exactly matches the official bootstrap commit's tree hash, confirming the checked source tree is identical. The synthetic local commit is not used as the parent of either GitHub contribution branch.

## Implemented

- Replaced the development probe with a DEEP PRESS app screen: 1L capacity and score HUD, specimen selection, pressure display, hold-to-press, store/discard/cash-out controls, tutorial steps, pause/resume, failure and completion overlays, and restart.
- Added pointer capture for horizontal specimen inspection and press hold. A single active pointer is accepted; duplicate pointers/releases are ignored. Pointer cancellation and capture loss pause the game, and visibility loss pauses without auto-resuming.
- Added keyboard press support, safe-area-aware layout, 44px minimum touch targets, a 320px minimum width, and WebGL error messaging. Audio remains absent.
- Reduced the vertical grid gap only at heights up to 580px after a 320×568 browser viewport showed 3.6px of document overflow.
- Kept score, capacity and specimen outcomes core-owned. Storage availability uses only the documented action prerequisites; fixture outcomes are not used as live gameplay.
- Added C tests for pointer lifecycle, cancellation, rotation, presentation labels, storage prerequisites and paused runtime timing.

Implementation paths: `src/app/index.ts`, `src/app/input.ts`, `src/app/presentation.ts`, `src/app/style.css`, `tests/app/input.test.ts`, `tests/app/presentation.test.ts`, `tests/app/runtime.test.ts`. Handoff: `docs/handoffs/C/handoff.md`.

## Verification

Environment: the default runtime is Node `v22.22.3` / npm `10.9.8`; additional checks passed with Node `v24.19.0` / npm `10.9.8` and Node `v25.8.1` / npm `11.11.0`. The repository pins Node `26.8.2` and npm `11.19.1`, which were not available. `npm ci` completed under the default runtime with an engine mismatch warning; package manifests and lockfile were not changed.

- `npm run check` — passed: bootstrap check, typecheck, boundary lint, 8 test files / 21 tests, and Vite build. Vite reports the current JS bundle at about 547 kB minified, above its 500 kB advisory threshold.
- `npm run ownership -- --role C --base archive-bootstrap-v2` — passed against the local archive base. The archive tree hash exactly matches the official bootstrap commit tree, so the checked file contents are the official base contents.
- `git diff --check` — passed after the handoff update.
- Browser review on the development server covered the start overlay, starting a round, drag-to-inspect tutorial progression, press/release, pause and explicit resume. The visible 3D scene on current `integration/v1` is still the neutral renderer stub, and the core snapshot reports `implementation: scaffold`; this is not final art or complete gameplay.
- Responsive browser review used explicit 320×568 and 320×667 CSS viewports. At 320×568, the start and pause dialogs fit; all active controls were visible and at least 44px high, but the page was 3.6px taller than the viewport. A short-height-only 2px gap reduction removed that overflow; the final active screen measured 320×568 with no document overflow and its footer note visible. The screenshot was captured in the Codex browser QA output. This desktop-browser viewport override does not emulate iPhone safe-area insets or Safari.


## Revalidation — 2026-09-25

- `PATH='/opt/homebrew/bin':$PATH npm run check` — passed under Node `v25.8.1` / npm `11.11.0`: bootstrap (23 frozen files), typecheck, boundary lint (12 TypeScript files), 8 test files / 21 tests, and build. Vite reports the same 546.73 kB minified JS chunk advisory.
- `PATH='/Users/hyerimjeong/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH npm run check` — also passed under Node `v24.19.0` / npm `10.9.8`.
- `npm run ownership -- --role C --base archive-bootstrap-v2` — passed; the archive tree remains identical to the official bootstrap tree.
- A fresh GitHub recheck after this handoff update found PR #5 open, non-draft and mergeable against `integration/v1` at base `554e2a1182bba9027c28bfac8d1702bbefaff407`; its status-check list, reviews and inline review threads are empty. B PR #1 remains draft; no A `role/a-core` branch or A PR appeared in the repository search.
- B PR #1 current head `27fc24446bb13e1aceb29d1b1b9cb3a4c770f3bb` remains draft. Source review of B `src/render/index.ts` and C `src/app/index.ts` found the public `createRenderer({ canvas, onFatal })` call and `resize`/`render(snapshot, dtMs)`/`dispose` lifecycle shapes compatible with the v1 `GameRenderer` contract. This is a static API check only; the combined modules were not built or run together.
- Browser recheck at a desktop Chromium CSS viewport of 320×568 covered the start screen, active screen, pause and explicit resume. Content fit the viewport; this remains an emulated desktop viewport, not an iPhone Safari/device check.

## Remaining work and limits

- The exact pinned Node `26.8.2` / npm `11.19.1` runtime is still unavailable. The closest available check used Node `v25.8.1` / npm `11.11.0`; reinstall dependencies and rerun on the exact pins when available.
- Test the full connected core/render loop and a real iPhone Safari session after A/B integrations. Those checks remain unverified. At the latest audit, no A role branch or PR was available and B PR #1 remained draft, so the integrated core/render path is not ready for this check.
- Actual iPhone Safari safe-area behavior and device touch handling remain unverified. The 320×568/667 check was a desktop Chromium CSS viewport override, not an iPhone or Safari run.
- Follow-up PR #5 is open, non-draft and mergeable at latest revalidation; its status-check list, submitted reviews and inline review threads are empty. Do not merge from role C; the project instructions reserve final integration for role A after all roles are ready.
