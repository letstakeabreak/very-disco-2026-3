# C role handoff — DEEP PRESS

Date: 2026-09-25 (Asia/Seoul)
Role: C — app, input, HUD (`magic3ightball`, verified through connected GitHub identity)
Contract: 1.0.0 · PRD: 1.0.1 (`executionReady: true`)
Current integration base: `integration/v1` at `a1671d7d9d9b6596edb56fc4458ec99914de8d41`

## Contribution history

- C PR [#3](https://github.com/letstakeabreak/very-disco-2026-3/pull/3) is merged into `integration/v1` at `554e2a1182bba9027c28bfac8d1702bbefaff407`.
- C short-viewport PR [#5](https://github.com/letstakeabreak/very-disco-2026-3/pull/5) is merged at `a1671d7d9d9b6596edb56fc4458ec99914de8d41`.
- Renderer recovery follow-up is under review in [PR #6](https://github.com/letstakeabreak/very-disco-2026-3/pull/6), branch `role/c-app-renderer-retry`, based on that integration commit. It remains unmerged for A's integration.
- The current local archive's source tree matches official `bootstrap-v2` (`c739b527449b2527e46b567bfffbd4a7122f571c`); its synthetic Git history is not used for the next GitHub branch.

## C implementation

- App HUD, specimen controls, hold-to-press, tutorial, pause/resume, failure/completion overlays and pointer/keyboard input are in `src/app/**`.
- The short-height layout uses a tighter grid gap at heights up to 580px. Prior desktop Chromium CSS viewport checks covered 320×568 and 320×667; these do not verify iPhone Safari safe areas or touch.
- Renderer fatal errors cancel active input and pause gameplay before offering **다시 시도**. Retrying creates a fresh canvas and renderer, replaces the failed renderer in the fixed-step runtime, resets its accumulator, resizes it, and preserves the paused game state. Runtime cleanup disposes the old/current renderer exactly once; an offered renderer after runtime cleanup is disposed immediately.
- Audio remains out of scope. Score, compression outcomes and game rules remain core-owned.

## Verification for renderer recovery change

- TDD: the two new renderer-replacement tests first failed because `replaceRenderer` did not exist; after implementation `npx vitest run tests/app/runtime.test.ts` passed (5 tests).
- `PATH='/opt/homebrew/bin':$PATH npm run check` passed: bootstrap (23 frozen files), typecheck, module-boundary lint, 8 test files / 23 tests, and Vite build. Vite reports a 547.20 kB minified JavaScript chunk above its 500 kB advisory threshold.
- `npm run ownership -- --role C --base archive-bootstrap-v2` passed; `git diff --check` passed.
- The exact pinned Node 26.8.2 / npm 11.19.1 was unavailable; this run used Node 25.8.1 / npm 11.11.0.
- The retry control has not been exercised in a browser with a simulated WebGL failure, and has not been tested on iPhone Safari. Runtime lifecycle behavior is covered by unit tests only.

## Latest integration audit and remaining work

- Latest C PR #5 is merged. Current open PR list contains B PR [#1](https://github.com/letstakeabreak/very-disco-2026-3/pull/1), draft, head `f77b20c44cc42963dc7a9e53b4f85aa2de19e72a`. B reports an iPhone 16 Pro Max fixture run averaging about 40.05 fps (P95 29 ms) and an earlier GPU context-loss whose cause is unknown. This is renderer fixture evidence, not an integrated gameplay or C touch test.
- The current branch list contains no A role branch. `src/core/index.ts` still identifies itself as `implementation: 'scaffold'`; `src/render/index.ts` on integration is the neutral probe. Game outcomes, connected core/render behavior, and final visual assets are not complete.
- After A/B integration, run the combined app/core/render tests and verify C interaction, renderer recreation after actual context loss, and touch/cancel/resume on real iPhone Safari. Also rerun with the pinned Node/npm versions when available.
- Do not merge from C. Project instructions reserve final integration for A.

## Press, failure and result fixes (2026-09-25)

- Assigned by the user to this session (authenticated GitHub account `letstakeabreak`, working in C's paths for these fixes). Branch `role/c-app-play-fixes` from `integration/v1` at `6045b4e7`.
- **Keyboard press paused immediately.** `renderUi` disabled the hold button as soon as the phase became `compressing`. The focused button then blurred, and the blur handler cancelled the keyboard gesture into `pause`. The hold button now stays enabled while compressing. Disabling a captured, pressed button was also a risk on touch.
- **Failure result covered by a pause.** When the core auto-settled at full pressure, the failure dialog took focus and the still-held hold button blurred. `cancel` then paused, replacing the failure dialog. `cancel` no longer pauses a press gesture the core already ended (the phase is no longer `compressing`). A press cancelled during compression still pauses and drops the uncommitted stroke. `requestPause` and the renderer-fatal path now pause whenever the game is still in a gameplay phase after cancelling, so visibility loss still pauses.
- **No discard after failure.** PRD 1.0.1 rules 6–7 let a failed lot be discarded to continue. The failure dialog now leads with discard (`폐기하고 계속`, or `폐기하고 마치기` for the last lot), then cash-out and restart. The copy explains both choices, and the failed phase label reads `회수 실패`.
- **Settled result not shown.** The pressure card now shows the core-committed volume, value and integrity (`압축 70% · 0.38L · 가치 330 · 무결성 73%`) instead of only the committed pressure. Values are read from the snapshot; nothing is predicted.
- Tests: `tests/app/input.test.ts` covers a hold ended by the core, and `tests/app/presentation.test.ts` covers the result, failure and discard text. All three new cases fail before the fix and pass after.

## HUD kept off the workshop stage (2026-09-25)

- Assigned by the user to this session (authenticated GitHub account `letstakeabreak`, working in C's paths). Branch `role/c-app-readability` from `integration/v1` at `34a7765`.
- Problem: on portrait phones the stacked HUD covered the core readouts. The brand, metric and specimen cards plus the tutorial pill hid B's amber pressure gauge. The pressure card hid the storage case. The renderer centers a 2:3 stage, which leaves empty wall and floor margins above and below it.
- Layout: score, case space and pause share one top row. Specimen name, phase, pressure bar, committed result and the tutorial line share one status card. The bottom holds only specimen choices, the hold button and store/discard/cash-out. At 390×844 the top UI ends at y=180 (gauge starts near 215) and the controls start at y=676 (case ends near 625). At 375×812 the values are 180/644. On wide landscape screens (aspect ≥ 3:2, height ≥ 480px) the panels move into the columns beside the stage. At 320×568 the stage is taller than the space left by the controls, so overlap remains; all controls stay visible with no document overflow.
- The start dialog now states the core trade-off: pressing harder saves space, but each material tolerates a different pressure and breaks when over-pressed.
- The status card is not an ARIA live region because its pressure text changes every frame. Announcements stay in `#live-status`. DOM IDs used by the app code are unchanged.
- Verification: `npm run check` (15 files / 91 tests) and C ownership against `origin/integration/v1` passed. Headless Chromium captures at 390×844, 375×812, 320×568 and 1440×900 were compared with the previous layout. A real-game run (keyboard hold, settle result, store with pressure reset, full-pressure failure, discard, last-lot store to completion at 793 points) passed with no browser errors. Actual iPhone Safari safe-area checks remain with the user.

## In-game copy rewrite (2026-09-25)

- Requested by the user: the copy read as machine-written. The old text mixed formal `합니다` and `해요` endings, used work jargon (회수물, 정산, 폐기, 무결성, 확보 점수, 압착), mixed in English eyebrows (SALVAGE LOST, SHIFT COMPLETE, PAUSED, DISPLAY ERROR) and used long explanatory sentences.
- Reference rules: Toss's writing principles (해요체 throughout, cut words that add no meaning, everyday words over jargon, suggest rather than force) and game onboarding guidance (short, action-first hints shown at the moment they apply).
- New voice: every sentence uses 해요체. Buttons are short verbs (시작하기, 꾹 눌러서 압축, 담기, 버리기, 마치기, 계속하기, 다시 하기). Stats use everyday words (점수, 남은 공간, 크기, 가치, 내구도). Only the `DEEP PRESS` brand stays in English. The failure title now depends on the reason (부서졌어요 / 케이스에 안 들어가요). The specimen label `금속 보호 하우징` became `에너지 코어`, matching its source prompt. Rule-document terms (store/discard/cash-out) are unchanged in code and contracts; only the player-facing words changed.
- Korean text now wraps between words (`word-break: keep-all`) instead of inside them.
- Verification: `npm run check` (91 tests) and C ownership passed. Six 390×844 screens were captured and read, with no overflow. A real-game run reached `작업 끝! 3개 담음 · 0.97L 사용 · 824점` with no browser errors.

## M1 judgment cues and shift records (2026-09-25)

- Assigned by the user to this session (authenticated GitHub account `letstakeabreak`, working in C's paths). Branch `role/c-app-m1` on A's contract 1.1.0 branch `role/a-core-m1`. Target `integration/v2`.
- Status card cue line (mint; red while strained). It shows the core-revealed tolerance (`약해 보여요. 살살 누르세요` / `적당히 버틸 것 같아요` / `튼튼해 보여요. 세게 눌러도 돼요`), or `삐걱거려요! 곧 부서질 수 있어요` while pressing with `stress01 > 0`. Otherwise it nudges `돌려 보면 얼마나 버틸지 보여요`. The nudge is suppressed while the first-lot tutorial already asks to rotate.
- While pressing, the result line shows the core's `previewVolume` and whether it fits the remaining space (`예상 크기 0.39L · 들어가요`). After settling it shows the committed size, value and durability, plus `안 들어가요` when it cannot be stored. No value is predicted and no rule is recomputed. The fit check is the same space prerequisite `canStore` already mirrors.
- The completion dialog lists each stored lot (`에너지 코어 · 0.52L · 가치 260`), the score per liter, and a device-local best (`새 기록!` or `최고 기록 360점`). The best is kept in `localStorage` under `deep-press:best-score`, read and written in try/catch, so blocked storage keeps an in-memory best only.
- Verification:
  - `npm run check` (100 tests on the C branch; 101 with B merged) and C ownership against `role/a-core-m1` passed. New presentation tests cover the preview/fit text, cue priority and nudge suppression, and the result/record text.
  - Headless Chromium with a real mouse drag and hold on the A+B+C candidate: tolerance revealed on drag, strain cue and red pressure while pressing, the committed result after release, the failure path.
  - Completion with the breakdown and `새 기록!`, a later `최고 기록 360점`, and the best kept after reload. No browser errors.
- Known limit: on the first lot, the tutorial and cue lines together make the status card about 16px taller. At 390×844 it then ends just above the gauge. Actual iPhone Safari remains with the user.
