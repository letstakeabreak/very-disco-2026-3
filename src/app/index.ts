import { bestPlan, createGame, getGameConfig } from '../core';
import { createRenderer } from '../render';
import type { GameEvent, GameSnapshot, SalvageId } from '../contracts';
import { createRuntime } from './runtime';
import { createAudio } from './audio';
import { createInputController, isGameplayPhase } from './input';
import { CASE_CLOSING_LINE, HULL_LINES, INTRO_STORY, ROUND_START_LINE, STRAIN_LINE, endingStory, reactionLine, toleranceLine, tutorialLine, tutorialStage } from './story';
import type { CommsLine, StoryLine } from './story';
import { canStore, caseFill, discardLabel, failureText, failureTitle, gradeFor, lotOutcomes, phaseLabel, recordText, remainingCapacity, resultRows, SPECIMEN_LABELS, specimenResult, splitSentences, bindWords, kstDaySeed } from './presentation';
import ridiLicenseUrl from './fonts/RIDIBatang-license.txt?url';
import logoLicenseUrl from './fonts/AlfaSlabOne-OFL.txt?url';
import './style.css';

const KEYBOARD_POINTER_ID = -1;
const INTRO_SEEN_KEY = 'deep-press:intro-seen';
const TUTORIAL_DONE_KEY = 'deep-press:tutorial-done';
const MUTED_KEY = 'deep-press:muted';
const TYPE_MS_PER_CHAR = 38;
const asset = (path: string): string => `${import.meta.env.BASE_URL}assets/${path}`;
/** Today's device best lives under the day seed, so each day's salvage keeps its own record. */
const bestScoreKey = (seed: number): string => `deep-press:best:${seed}`;

/** Device-local memory only; storage may be unavailable (private mode, blocked site data). */
function readStored(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
function writeStored(key: string, value: string): void {
  try { localStorage.setItem(key, value); } catch { /* keep the in-memory value */ }
}
function readBestScore(seed: number): number | null {
  const value = Number(readStored(bestScoreKey(seed)));
  return Number.isInteger(value) && value > 0 ? value : null;
}

/**
 * Writes a typed line without reflow: every sentence is laid out in full from
 * the first frame (untyped text stays hidden in place) and wraps as one unit,
 * so words never jump lines while typing and a sentence starts a fresh line
 * when it does not fit beside the previous one.
 */
function typeLine(target: HTMLElement, text: string, count: number): void {
  if (target.dataset.line !== text) {
    target.dataset.line = text;
    target.replaceChildren(...splitSentences(text).map(({ text, start }) => ({ text: bindWords(text), start })).flatMap(({ text: sentence, start }, index) => {
      const phrase = document.createElement('span');
      phrase.className = 'phrase';
      phrase.dataset.text = sentence;
      phrase.dataset.start = String(start);
      phrase.append(document.createElement('span'), document.createElement('span'));
      phrase.lastElementChild!.className = 'untyped';
      phrase.lastElementChild!.textContent = sentence;
      return index ? [' ', phrase] : [phrase];
    }));
  }
  for (const phrase of target.querySelectorAll<HTMLElement>('.phrase')) {
    const sentence = phrase.dataset.text!;
    const shown = Math.min(sentence.length, Math.max(0, count - Number(phrase.dataset.start)));
    const [typed, untyped] = phrase.children as unknown as [HTMLElement, HTMLElement];
    if (typed.textContent!.length !== shown) { typed.textContent = sentence.slice(0, shown); untyped.textContent = sentence.slice(shown); }
  }
}

/** App-owned DOM, pointer lifecycle, HUD, tutorial, result flow and synthesized sound. */
export function mountApp(root: HTMLElement): () => void {
  // Resolve here: a relative custom-property URL is otherwise resolved against
  // the bundled stylesheet in assets/, adding a second assets/ directory.
  const ambientUrl = new URL(`${import.meta.env.BASE_URL}assets/textures/workshop-v4.webp`, document.baseURI);
  root.style.setProperty('--workshop-ambient', `url("${ambientUrl.href}")`);
  root.innerHTML = `<canvas class="scene" aria-label="DEEP PRESS 작업대. 끌어서 물건을 돌려 볼 수 있어요."></canvas>
    <div class="screen hud-hidden">
      <header class="topbar" aria-label="현황"><div class="metrics"><p><span>점수</span><strong id="score">0</strong></p><p><span>남은 공간</span><strong><span id="capacity">1.00</span><small>L</small></strong></p><div class="case-fill" id="case-fill" aria-hidden="true"></div></div><button class="icon-button" id="pause" type="button" aria-label="일시 정지">Ⅱ</button></header>
      <section class="status-card" aria-label="오늘 건진 물건과 지금 물건">
        <div class="manifest" id="manifest" role="group" aria-label="오늘 건진 물건"></div>
        <p class="facts" id="result-value"></p>
        <div class="pressure-track" aria-hidden="true"><span id="pressure-bar"></span></div>
      </section>
      <main class="work-area"><div class="workbench-input" id="workbench-input" role="img" aria-label="물건 돌리기"></div></main>
      <footer class="controls" aria-label="조작">
        <p class="comms" id="comms" hidden><b id="comms-name"></b><span id="comms-text" aria-hidden="true"></span><span class="visually-hidden" id="comms-line" aria-live="polite"></span></p>
        <div class="operation-row" role="group" aria-label="현재 물건 처리"><button class="press-button" id="hold" type="button" aria-label="누르고 있는 동안 물건을 압축해요">압축하기</button><button class="secondary" id="store" type="button">담기</button><button class="ghost" id="discard" type="button">버리기</button></div>
        <p id="dev-note" class="dev-note" hidden></p><p id="live-status" class="visually-hidden" role="status" aria-live="polite"></p>
      </footer>
    </div><div class="overlay" id="overlay" hidden></div>
    <div class="hull" id="hull" aria-hidden="true"></div>
    <div class="transition" id="transition" hidden><video src="${asset('video/descent.mp4')}" muted playsinline preload="auto" disablepictureinpicture aria-hidden="true"></video><button class="transition-skip" type="button">건너뛰기</button></div>`;

  let canvas = root.querySelector('canvas')!;
  const screen = root.querySelector<HTMLElement>('.screen')!;
  const score = root.querySelector<HTMLElement>('#score')!;
  const capacity = root.querySelector<HTMLElement>('#capacity')!;
  const manifest = root.querySelector<HTMLElement>('#manifest')!;
  const fill = root.querySelector<HTMLElement>('#case-fill')!;
  const comms = root.querySelector<HTMLElement>('#comms')!;
  const commsName = root.querySelector<HTMLElement>('#comms-name')!;
  const commsText = root.querySelector<HTMLElement>('#comms-text')!;
  const commsLine = root.querySelector<HTMLElement>('#comms-line')!;
  const statusCard = root.querySelector<HTMLElement>('.status-card')!;
  const workbenchInput = root.querySelector<HTMLElement>('#workbench-input')!;
  const pressureBar = root.querySelector<HTMLElement>('#pressure-bar')!;
  const resultValue = root.querySelector<HTMLElement>('#result-value')!;
  const hold = root.querySelector<HTMLButtonElement>('#hold')!;
  const store = root.querySelector<HTMLButtonElement>('#store')!;
  const discard = root.querySelector<HTMLButtonElement>('#discard')!;
  const pauseButton = root.querySelector<HTMLButtonElement>('#pause')!;
  const devNote = root.querySelector<HTMLElement>('#dev-note')!;
  const liveStatus = root.querySelector<HTMLElement>('#live-status')!;
  const overlay = root.querySelector<HTMLElement>('#overlay')!;
  const transition = root.querySelector<HTMLElement>('#transition')!;
  const hull = root.querySelector<HTMLElement>('#hull')!;
  const video = transition.querySelector('video')!;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const dayConfig = getGameConfig(kstDaySeed(new Date()));
  const dayBest = bestPlan(dayConfig).score;
  const game = createGame(dayConfig);
  const audio = createAudio(readStored(MUTED_KEY) === '1');
  const abort = new AbortController();
  const options = { signal: abort.signal };
  let started = false;
  let introSeen = readStored(INTRO_SEEN_KEY) === '1';
  let tutorialDone = readStored(TUTORIAL_DONE_KEY) === '1';
  const broken = new Set<SalvageId>();
  let renderedManifest = '';
  let failureReason: 'specimen-broken' | 'capacity-exceeded' | null = null;
  let bestScore = readBestScore(dayConfig.seed);
  let newBest = false;
  let fatalMessage = '';
  let overlayKey = '';
  let storyPage: number | null = null;
  let outroPage = 0;
  let endingSeen = false;
  let renderedLine = '';
  let lineStartedAt = 0;
  let lineRevealed = false;
  let transitioning = false;
  let hudHidden = true;
  let transitionTimer = 0;
  let voice: CommsLine | null = null;
  let closeCaseAt = 0;
  // G13: a line is held on screen until read; lines already read never type out again.
  let voiceHoldUntil = 0;
  const readLines = new Set<string>();
  // G10: the hull complains every so often while the player works.
  let nextHullAt = 0;
  let hullLine = 0;
  let nextAlarmAt = 0;
  // G12: let the break play before the choices appear.
  let failedRevealAt = 0;
  let lastValue: { id: SalvageId; value: number } | null = null;
  let typedTick = 0;
  let toleranceVoiced: SalvageId | null = null;
  let voiceKey = '';
  let voiceStartedAt = 0;
  let previousTime: number | null = null;

  let handleRendererFatal = (): void => {};
  const createAppRenderer = (targetCanvas: HTMLCanvasElement) => createRenderer({ canvas: targetCanvas, onFatal: ({ code }) => { fatalMessage = code; handleRendererFatal(); } });
  let renderer = createAppRenderer(canvas);
  const runtime = createRuntime(game, renderer, (events) => consumeEvents(events));
  const input = createInputController({
    getSnapshot: () => game.snapshot(),
    dispatch: (command) => runtime.dispatch(command),
    onInspectionMoved: () => {},
  });
  handleRendererFatal = () => {
    input.cancel();
    if (isGameplayPhase(game.snapshot().phase)) runtime.dispatch({ type: 'pause' });
    renderUi(game.snapshot());
  };

  function consumeEvents(events: readonly GameEvent[]): void {
    for (const event of events) {
      audio.event(event, game.snapshot());
      // The tutorial is done once a first lot is banked; later runs on this device skip it.
      if (event.type === 'stored' && !tutorialDone) { tutorialDone = true; writeStored(TUTORIAL_DONE_KEY, '1'); }
      if (event.type === 'failed') failureReason = event.reason;
      if (event.type === 'failed' && event.reason === 'specimen-broken') {
        const id = game.snapshot().currentSpecimen?.id; if (id) broken.add(id);
        failedRevealAt = performance.now() + (reducedMotion.matches ? 0 : 1200);
        root.classList.remove('shatter'); void root.offsetWidth; root.classList.add('shatter');
      }
      if (event.type === 'completed' && event.score > (bestScore ?? 0)) {
        bestScore = event.score; newBest = true;
        writeStored(bestScoreKey(dayConfig.seed), String(event.score));
      }
      if (event.type === 'phase-changed' && event.to === 'idle') failureReason = null;
      const snapshot = game.snapshot();
      if (event.type === 'specimen-selected') toleranceVoiced = snapshot.currentSpecimen?.tolerance ? event.specimenId : null;
      voice = reactionLine(event, snapshot, dayConfig) ?? voice;
      // Nothing left fits: let 도현's line land, then close the case.
      if (voice === CASE_CLOSING_LINE && event.type === 'stored') closeCaseAt = performance.now() + 2200;
    }
  }

  function selectSpecimen(id: SalvageId): void {
    input.clear();
    runtime.dispatch({ type: 'select', specimenId: id });
  }

  function clearRound(): void {
    input.clear();
    storyPage = null;
    outroPage = 0;
    endingSeen = false;
    broken.clear();
    failureReason = null;
    newBest = false;
    voice = ROUND_START_LINE;
    closeCaseAt = 0;
    failedRevealAt = 0;
    lastValue = null;
    nextHullAt = performance.now() + 20000;
    nextAlarmAt = performance.now() + 9000;
    toleranceVoiced = null;
  }

  function beginRound(reset: boolean): void {
    clearRound();
    started = true;
    // The player picks the first lot from the manifest after seeing all three.
    runtime.dispatch({ type: reset ? 'restart' : 'start' });
    renderUi(game.snapshot());
    resize();
    hold.focus({ preventScroll: true });
  }

  /** Abandon the round and show the title again. */
  function returnToTitle(): void {
    clearRound();
    started = false;
    runtime.dispatch({ type: 'restart' });
    renderUi(game.snapshot());
  }

  function requestPause(): void {
    // A cancelled gesture may already have paused; otherwise pause here.
    input.cancel();
    if (isGameplayPhase(game.snapshot().phase)) runtime.dispatch({ type: 'pause' });
    renderUi(game.snapshot());
  }

  function overlayState(snapshot: GameSnapshot): string {
    if (fatalMessage) return 'fatal';
    if (storyPage !== null) return 'story';
    if (!started && snapshot.phase === 'idle') return 'start';
    if (snapshot.phase === 'paused') return 'paused';
    if (snapshot.phase === 'failed') return performance.now() >= failedRevealAt ? 'failed' : '';
    if (snapshot.phase === 'complete') return endingSeen ? 'complete' : 'outro';
    return '';
  }

  function currentStory(snapshot: GameSnapshot): { lines: readonly StoryLine[]; index: number } | null {
    if (overlayKey === 'story' && storyPage !== null) return { lines: INTRO_STORY, index: storyPage };
    if (overlayKey === 'outro') return { lines: endingStory(lotOutcomes(snapshot, broken)), index: outroPage };
    return null;
  }

  function visibleCharacters(line: StoryLine): number {
    if (lineRevealed || reducedMotion.matches) return line.text.length;
    return Math.min(line.text.length, Math.floor((performance.now() - lineStartedAt) / TYPE_MS_PER_CHAR));
  }

  /** Visual-novel stage: full-bleed scene, one standing speaker, a name plate and a typed line. */
  const STORY_MARKUP = `<section class="vn" role="dialog" aria-modal="true" aria-label="이야기">
      <div class="vn-backdrop" aria-hidden="true"></div><div class="vn-figure" aria-hidden="true"><img class="vn-sprite away" alt="" width="1024" height="1536"></div>
      <button class="vn-skip" data-action="story-skip" type="button">건너뛰기</button>
      <button class="vn-box" data-action="story-next" type="button"><span class="vn-name" hidden></span><span class="vn-text" aria-hidden="true"></span><span class="visually-hidden vn-line" aria-live="polite"></span><span class="vn-next" aria-hidden="true">▼</span></button>
    </section>`;

  function renderStory(snapshot: GameSnapshot): void {
    const story = currentStory(snapshot);
    const stage = overlay.querySelector<HTMLElement>('.vn');
    if (!story || !stage) return;
    const line = story.lines[story.index]!;
    const lineKey = `${overlayKey}-${story.index}`;
    if (lineKey !== renderedLine) {
      renderedLine = lineKey;
      lineStartedAt = performance.now();
      lineRevealed = false;
      stage.dataset.scene = line.scene;
      stage.dataset.mood = line.mood ?? '';
      stage.classList.toggle('narration', line.speaker === null);
      const name = stage.querySelector<HTMLElement>('.vn-name')!;
      name.hidden = line.speaker === null;
      name.textContent = line.speaker ?? '';
      stage.querySelector<HTMLElement>('.vn-line')!.textContent = line.speaker ? `${line.speaker}: ${line.text}` : line.text;
      const sprite = stage.querySelector<HTMLImageElement>('.vn-sprite')!;
      if (line.pose === null) sprite.classList.add('away');
      else if (sprite.dataset.pose !== line.pose) {
        const entering = sprite.dataset.speaker !== line.speaker;
        sprite.dataset.pose = line.pose;
        sprite.dataset.speaker = line.speaker ?? '';
        sprite.dataset.side = line.speaker === '윤서' ? 'left' : 'right';
        // 윤서 speaks from the support ship: she appears on the comm screen, 도현 stands in the room.
        stage.querySelector<HTMLElement>('.vn-figure')!.toggleAttribute('data-remote', line.speaker === '윤서');
        sprite.src = asset(`characters/${line.pose}.webp`);
        sprite.classList.remove('away', 'enter');
        if (entering) { void sprite.offsetWidth; sprite.classList.add('enter'); }
      } else sprite.classList.remove('away');
    }
    const shown = visibleCharacters(line);
    // A soft tick every few letters while a story line types out.
    if (shown < line.text.length && shown - typedTick >= 3) { typedTick = shown; audio.cue('type'); }
    if (shown < typedTick) typedTick = shown;
    typeLine(stage.querySelector<HTMLElement>('.vn-text')!, line.text, shown);
    stage.classList.toggle('typing', shown < line.text.length);
  }

  function openStory(): void {
    storyPage = 0;
    for (const pose of new Set(INTRO_STORY.map(line => line.pose))) if (pose) new Image().src = asset(`characters/${pose}.webp`);
    renderUi(game.snapshot());
  }

  function advanceStory(skip: boolean): void {
    const snapshot = game.snapshot();
    const story = currentStory(snapshot);
    if (!story) return;
    const line = story.lines[story.index]!;
    if (!skip && visibleCharacters(line) < line.text.length) { lineRevealed = true; renderUi(snapshot); return; }
    const last = skip || story.index === story.lines.length - 1;
    if (overlayKey === 'outro') { if (last) endingSeen = true; else outroPage += 1; }
    else if (last) finishIntro();
    else storyPage = story.index + 1;
    renderUi(game.snapshot());
  }

  function finishIntro(): void {
    storyPage = null;
    if (!introSeen) { introSeen = true; writeStored(INTRO_SEEN_KEY, '1'); }
    if (started) {
      runtime.dispatch({ type: 'resume' }); renderUi(game.snapshot());
      hold.focus({ preventScroll: true });
    }
    else playTransition();
  }

  /** The descent video bridges the story into the live workbench; the round starts underneath it. */
  function playTransition(): void {
    beginRound(false);
    if (reducedMotion.matches) return;
    transitioning = true;
    transition.hidden = false;
    transition.classList.remove('leaving');
    video.currentTime = 0;
    transitionTimer = window.setTimeout(finishTransition, 3000);
    video.play().catch(finishTransition);
    transition.querySelector<HTMLButtonElement>('button')!.focus({ preventScroll: true });
    renderUi(game.snapshot());
  }

  function finishTransition(): void {
    if (!transitioning) return;
    transitioning = false;
    window.clearTimeout(transitionTimer);
    video.pause();
    transition.classList.add('leaving');
    window.setTimeout(() => { if (!transitioning) transition.hidden = true; }, 600);
    renderUi(game.snapshot());
    hold.focus({ preventScroll: true });
  }

  function renderOverlay(snapshot: GameSnapshot): void {
    const key = overlayState(snapshot);
    if (key !== overlayKey) {
      const previousKey = overlayKey;
      overlayKey = key;
      overlay.hidden = !key;
      overlay.className = `overlay overlay-${key}`;
      screen.inert = Boolean(key);
      const content: Record<string, string> = {
        start: `<div class="mission-identity"><p class="wordmark" aria-label="DEEP PRESS">DEEP<span>PRESS</span></p></div>
        <section class="dialog-card mission-card" role="dialog" aria-modal="true" aria-labelledby="dialog-title">
          <h2 id="dialog-title">남길 것을<br>골라 주세요.</h2>
          ${introSeen ? '<button data-action="quick-start" class="dialog-primary" type="button">시작하기</button><button data-action="story-open" class="dialog-secondary" type="button">이야기 보기</button>'
            : '<button data-action="story-open" class="dialog-primary" type="button">시작하기</button>'}
          <details class="font-credits"><summary>글꼴 출처</summary><p>리디바탕 (리디주식회사)<br>Alfa Slab One (Jm Solé)</p><a href="${ridiLicenseUrl}" target="_blank" rel="noopener">리디바탕 이용 조건</a><a href="${logoLicenseUrl}" target="_blank" rel="noopener">로고 글꼴 OFL 전문</a></details>
        </section>`,
        story: STORY_MARKUP,
        outro: STORY_MARKUP,
        paused: `<section class="dialog-card" role="dialog" aria-modal="true" aria-labelledby="dialog-title"><h2 id="dialog-title">잠깐 멈췄어요</h2><button data-action="resume" class="dialog-primary" type="button">계속하기</button><button data-action="finish" class="dialog-secondary" type="button">여기서 마치기</button><button data-action="story-open" class="dialog-secondary" type="button">이야기 다시 보기</button><button data-action="sound" class="dialog-secondary" type="button" id="sound-toggle"></button><button data-action="title" class="dialog-secondary" type="button">처음으로</button></section>`,
        failed: `<section class="dialog-card" role="dialog" aria-modal="true" aria-labelledby="dialog-title"><h2 id="dialog-title">부서졌어요</h2><p id="dialog-copy"></p><button data-action="discard" class="dialog-primary" type="button" id="dialog-discard">버리고 계속하기</button><button data-action="cash-out" class="dialog-secondary" type="button" id="dialog-cash-out">여기서 마치기</button><button data-action="restart" class="dialog-secondary" type="button">처음부터</button></section>`,
        complete: `<section class="dialog-card result-card" role="dialog" aria-modal="true" aria-labelledby="dialog-title"><h2 id="dialog-title">회수를 마쳤어요</h2><div class="result-head"><p class="result-score"><strong id="result-score"></strong>점</p><p class="grade" id="result-grade"></p></div><p class="result-par" id="result-par"></p><ul class="dialog-items" id="dialog-items"></ul><p class="dialog-record" id="dialog-record"></p><button data-action="restart" class="dialog-primary" type="button">다시 하기</button></section>`,
        fatal: `<section class="dialog-card" role="alertdialog" aria-modal="true" aria-labelledby="dialog-title"><h2 id="dialog-title">화면을 불러오지 못했어요</h2><p id="dialog-copy"></p><button data-action="retry-renderer" class="dialog-primary" type="button">다시 시도</button></section>`,
      };
      overlay.innerHTML = content[key] ?? '';
      renderedLine = '';
      if (key) overlay.querySelector<HTMLButtonElement>('.dialog-primary, .vn-box')?.focus({ preventScroll: true });
      else if (previousKey === 'paused' && !pauseButton.hidden) pauseButton.focus({ preventScroll: true });
      else if (previousKey === 'fatal' && !pauseButton.hidden) pauseButton.focus({ preventScroll: true });
    }
    renderStory(snapshot);
    const finalScore = overlay.querySelector<HTMLElement>('#result-score');
    if (finalScore) {
      finalScore.textContent = snapshot.score.toLocaleString('ko-KR');
      const { percent, grade } = gradeFor(snapshot.score, dayBest);
      const gradeBadge = overlay.querySelector<HTMLElement>('#result-grade')!;
      gradeBadge.textContent = grade;
      gradeBadge.dataset.grade = grade;
      gradeBadge.setAttribute('aria-label', `등급 ${grade}`);
      overlay.querySelector<HTMLElement>('#result-par')!.textContent = `오늘 만점 ${dayBest.toLocaleString('ko-KR')}점 중 ${percent}%`;
    }
    const copy = overlay.querySelector<HTMLElement>('#dialog-copy');
    const title = overlay.querySelector<HTMLElement>('#dialog-title');
    if (title && key === 'failed') title.textContent = failureTitle(failureReason);
    if (copy && key === 'failed') copy.textContent = failureText(failureReason);
    const items = overlay.querySelector<HTMLElement>('#dialog-items');
    if (items) {
      const outcomes = lotOutcomes(snapshot, broken);
      const rows = resultRows(snapshot, dayConfig, outcomes).map((row, index) => `<li data-outcome="${outcomes[dayConfig.specimens[index]!.id]}">${row.map((cell) => `<span>${cell}</span>`).join('')}</li>`).join('');
      if (items.innerHTML !== rows) items.innerHTML = rows;
    }
    const record = overlay.querySelector<HTMLElement>('#dialog-record');
    if (record) { record.textContent = recordText(bestScore, newBest); record.hidden = !record.textContent; }
    const soundToggle = overlay.querySelector<HTMLElement>('#sound-toggle');
    if (soundToggle) soundToggle.textContent = audio.muted ? '소리 켜기' : '소리 끄기';
    const discardChoice = overlay.querySelector<HTMLElement>('#dialog-discard');
    if (discardChoice) discardChoice.textContent = discardLabel(snapshot);
    // G19: with no other lot left, finishing here is the same as discarding: offer one button.
    const cashOutChoice = overlay.querySelector<HTMLElement>('#dialog-cash-out');
    if (cashOutChoice) cashOutChoice.hidden = snapshot.remainingSpecimenIds.length <= 1;
    if (copy && key === 'fatal') copy.textContent = `안 되면 새로고침해 주세요. (${fatalMessage})`;
  }

  /**
   * All three lots from the start of the round (G1): size and value to plan with, then what became of
   * each. A lot can be chosen whenever the core's select rule allows it (nothing pressed yet).
   */
  function renderManifest(snapshot: GameSnapshot): void {
    const outcomes = lotOutcomes(snapshot, broken, dayConfig);
    const mayChoose = snapshot.phase === 'idle' || snapshot.phase === 'stored'
      || (snapshot.phase === 'inspecting' && snapshot.currentSpecimen?.compression01 === 0);
    const html = dayConfig.specimens.map((lot) => {
      const current = snapshot.currentSpecimen?.id === lot.id;
      const outcome = outcomes[lot.id];
      const stored = snapshot.storedSpecimens.find((item) => item.id === lot.id);
      const meta = stored ? [`${stored.currentVolume.toFixed(2)}L`, `가치 ${stored.value}`]
        : outcome === 'broken' ? ['부서짐'] : outcome === 'left' ? ['두고 옴'] : outcome === 'blocked' ? ['안 들어감'] : [`${lot.initialVolume.toFixed(2)}L`, `가치 ${lot.baseValue}`];
      const selectable = outcome === 'pending' && !current && mayChoose;
      return `<button type="button" class="lot" data-lot="${lot.id}" data-state="${current && outcome !== 'broken' ? 'current' : outcome}"${selectable ? '' : ' disabled'}${current ? ' aria-current="true"' : ''}><span class="lot-name">${SPECIMEN_LABELS[lot.id]}</span><span class="lot-meta">${meta.map((part) => `<span>${part}</span>`).join('')}</span></button>`;
    }).join('');
    if (html !== renderedManifest) { renderedManifest = html; manifest.innerHTML = html; }
  }

  function renderUi(snapshot: GameSnapshot): void {
    score.textContent = snapshot.score.toLocaleString('ko-KR');
    capacity.textContent = remainingCapacity(snapshot).toFixed(2);
    renderManifest(snapshot);
    const fillHtml = caseFill(snapshot).map((segment) => `<span data-kind="${segment.kind}" style="width:${(segment.share * 100).toFixed(2)}%"></span>`).join('');
    if (fill.innerHTML !== fillHtml) fill.innerHTML = fillHtml;
    const pressure = Math.round(snapshot.pressure01 * 100);
    pressureBar.style.transform = `scaleX(${snapshot.pressure01})`;
    statusCard.style.setProperty('--light-x', `${14 + snapshot.pressure01 * 72}%`);
    hold.classList.toggle('pressing', snapshot.phase === 'compressing');
    // G12: a committed loss of value is called out next to the facts for a moment.
    const committed = snapshot.phase === 'inspecting' ? snapshot.currentSpecimen : null;
    if (committed && lastValue?.id === committed.id && committed.value < lastValue.value) {
      const drop = document.createElement('span');
      drop.className = 'value-drop';
      drop.textContent = `가치 −${lastValue.value - committed.value}`;
      drop.addEventListener('animationend', () => drop.remove());
      statusCard.append(drop);
    }
    if (committed) lastValue = { id: committed.id, value: committed.value };
    else if (!snapshot.currentSpecimen) lastValue = null;
    const facts = specimenResult(snapshot).map((fact) => `<span${fact.warn ? ' class="warn"' : ''}>${fact.text}</span>`).join('');
    if (resultValue.innerHTML !== facts) resultValue.innerHTML = facts;
    const tutorialActive = started && !tutorialDone && snapshot.phase !== 'failed' && snapshot.phase !== 'complete';
    const lot = snapshot.currentSpecimen;
    if (lot?.tolerance && toleranceVoiced !== lot.id) { toleranceVoiced = lot.id; voice = toleranceLine(lot.tolerance); }
    // Live strain, then the first-run tutorial (read from the round), then the latest reaction.
    const line = snapshot.phase === 'compressing' && snapshot.stress01 > 0 ? STRAIN_LINE
      : tutorialActive ? tutorialLine(tutorialStage(snapshot), lot?.tolerance ?? null) : voice;
    comms.hidden = line === null;
    comms.classList.toggle('strained', line === STRAIN_LINE);
    const key = line ? `${line.speaker}:${line.text}` : '';
    if (key !== voiceKey) {
      voiceKey = key;
      // A line that was already read (for example, back from a strain warning) shows at once.
      voiceStartedAt = readLines.has(key) ? -Infinity : performance.now();
      voiceHoldUntil = line ? performance.now() + line.text.length * 24 + 1500 : 0;
      commsName.textContent = line?.speaker ?? '';
      comms.dataset.speaker = line?.speaker ?? '';
      commsLine.textContent = line ? `${line.speaker}: ${line.text}` : '';
    }
    if (line && performance.now() - voiceStartedAt >= line.text.length * 24) readLines.add(key);
    // The same typed delivery as the story, a little quicker at the bench.
    if (line) typeLine(commsText, line.text, reducedMotion.matches ? line.text.length : Math.floor((performance.now() - voiceStartedAt) / 24));
    statusCard.classList.toggle('strained', snapshot.stress01 > 0);
    // Stay enabled while held: disabling the pressed button blurs it and drops capture.
    hold.disabled = snapshot.phase !== 'inspecting' && snapshot.phase !== 'compressing';
    store.disabled = !canStore(snapshot);
    discard.disabled = snapshot.phase !== 'inspecting' && snapshot.phase !== 'failed';
    pauseButton.hidden = snapshot.phase === 'idle' || snapshot.phase === 'paused' || snapshot.phase === 'complete';
    devNote.hidden = snapshot.implementation === 'game';
    devNote.textContent = snapshot.implementation === 'scaffold'
      ? '개발 중: 코어가 연결되면 담기와 마치기가 켜져요.'
      : '';
    liveStatus.textContent = `${phaseLabel(snapshot.phase)} · 압력 ${pressure}% · 점수 ${snapshot.score}점`;
    renderOverlay(snapshot);
    // The HUD steps back whenever a full scene (story, video, result) is the figure.
    const hideHud = !started || transitioning || storyPage !== null || overlayKey === 'outro' || overlayKey === 'complete';
    if (hideHud !== hudHidden) {
      hudHidden = hideHud;
      screen.classList.toggle('hud-hidden', hideHud);
      if (!hideHud) screen.classList.add('entering');
      resize();
    }
  }

  function resize(): void {
    const width = root.clientWidth;
    let height = root.clientHeight || window.innerHeight;
    let top = 0;
    if (!hudHidden && width < height) {
      // The fixed 2:3 workshop's gauge and case occupy its central 14–88%, and
      // the renderer centres that stage vertically. When the HUD would cover the
      // gauge there, fit the working area between HUD and controls instead.
      const rootTop = root.getBoundingClientRect().top;
      const start = statusCard.getBoundingClientRect().bottom - rootTop + 10;
      const stage = Math.min(height, width * 1.5);
      if (start > (height - stage) / 2 + stage * .14) {
        const end = root.querySelector<HTMLElement>('.controls')!.getBoundingClientRect().top - rootTop - 10;
        height = Math.max(1, Math.min(width * 1.5, (end - start) / .74));
        top = start - height * .14;
      }
    }
    canvas.style.top = `${top}px`;
    canvas.style.height = `${height}px`;
    renderer.resize({ width, height, dpr: window.devicePixelRatio });
  }

  function retryRenderer(): void {
    input.clear();
    const replacementCanvas = document.createElement('canvas');
    replacementCanvas.className = canvas.className;
    replacementCanvas.setAttribute('aria-label', canvas.getAttribute('aria-label') ?? 'DEEP PRESS 작업대');
    canvas.replaceWith(replacementCanvas);
    canvas = replacementCanvas;
    fatalMessage = '';
    renderer = createAppRenderer(canvas);
    runtime.replaceRenderer(renderer);
    resize();
    renderUi(game.snapshot());
  }

  const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(resize);
  observer?.observe(root);
  observer?.observe(statusCard);
  observer?.observe(root.querySelector<HTMLElement>('.controls')!);
  window.addEventListener('resize', resize, options);
  resize();

  overlay.addEventListener('click', (event) => {
    const target = event.target as HTMLElement;
    const action = target.closest<HTMLButtonElement>('button[data-action]')?.dataset.action ?? (target.closest('.vn') ? 'story-next' : undefined);
    if (action && action !== 'story-next') audio.cue('tap');
    if (action === 'sound') { audio.setMuted(!audio.muted); writeStored(MUTED_KEY, audio.muted ? '1' : '0'); renderUi(game.snapshot()); }
    if (action === 'restart') beginRound(true);
    if (action === 'title') returnToTitle();
    if (action === 'resume') { runtime.dispatch({ type: 'resume' }); renderUi(game.snapshot()); }
    if (action === 'cash-out') { runtime.dispatch({ type: 'cash-out' }); renderUi(game.snapshot()); }
    if (action === 'finish') { runtime.dispatch({ type: 'resume' }); runtime.dispatch({ type: 'cash-out' }); renderUi(game.snapshot()); }
    if (action === 'discard') { runtime.dispatch({ type: 'discard' }); renderUi(game.snapshot()); }
    if (action === 'retry-renderer') retryRenderer();
    if (action === 'story-open') openStory();
    if (action === 'quick-start') playTransition();
    if (action === 'story-next') advanceStory(false);
    if (action === 'story-skip') advanceStory(true);
  }, options);
  transition.addEventListener('click', finishTransition, options);
  video.addEventListener('playing', () => { window.clearTimeout(transitionTimer); transitionTimer = window.setTimeout(finishTransition, 9000); }, options);
  video.addEventListener('ended', finishTransition, options);
  video.addEventListener('error', finishTransition, options);
  screen.addEventListener('animationend', () => screen.classList.remove('entering'), options);
  overlay.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && storyPage !== null && !fatalMessage) { storyPage = null; renderUi(game.snapshot()); }
  }, options);
  transition.addEventListener('keydown', (event) => { if (event.key === 'Escape') finishTransition(); }, options);
  manifest.addEventListener('click', (event) => {
    const id = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-lot]:not(:disabled)')?.dataset.lot as SalvageId | undefined;
    if (id) selectSpecimen(id);
  }, options);
  // iOS only lets sound start inside a user gesture: every first touch or key press unlocks it.
  root.addEventListener('pointerdown', () => audio.unlock(), { ...options, capture: true });
  root.addEventListener('keydown', () => audio.unlock(), { ...options, capture: true });
  store.addEventListener('click', () => runtime.dispatch({ type: 'store' }), options);
  discard.addEventListener('click', () => runtime.dispatch({ type: 'discard' }), options);
  pauseButton.addEventListener('click', () => { audio.cue('tap'); requestPause(); }, options);

  function capture(target: HTMLElement, pointerId: number): void {
    try { target.setPointerCapture(pointerId); } catch { input.cancel(pointerId); }
  }

  workbenchInput.addEventListener('pointerdown', (event) => {
    if (!event.isPrimary || !input.beginInspect({ pointerId: event.pointerId, clientX: event.clientX, surfaceWidth: workbenchInput.clientWidth })) return;
    event.preventDefault();
    capture(workbenchInput, event.pointerId);
  }, options);
  workbenchInput.addEventListener('pointermove', (event) => {
    if (input.moveInspect({ pointerId: event.pointerId, clientX: event.clientX, surfaceWidth: workbenchInput.clientWidth })) event.preventDefault();
  }, options);
  workbenchInput.addEventListener('pointerup', (event) => { input.endInspect(event.pointerId); }, options);
  hold.addEventListener('pointerdown', (event) => {
    if (!event.isPrimary || !input.beginPress(event.pointerId)) return;
    event.preventDefault();
    capture(hold, event.pointerId);
  }, options);
  hold.addEventListener('pointerup', (event) => { input.endPress(event.pointerId); }, options);
  for (const target of [workbenchInput, hold]) {
    target.addEventListener('pointercancel', (event) => { input.cancel((event as PointerEvent).pointerId); }, options);
    target.addEventListener('lostpointercapture', (event) => { input.cancel((event as PointerEvent).pointerId); }, options);
  }
  hold.addEventListener('keydown', (event) => {
    if ((event.key === ' ' || event.key === 'Enter') && !event.repeat && input.beginPress(KEYBOARD_POINTER_ID)) event.preventDefault();
  }, options);
  hold.addEventListener('keyup', (event) => {
    if (event.key === ' ' || event.key === 'Enter') { input.endPress(KEYBOARD_POINTER_ID); event.preventDefault(); }
  }, options);
  hold.addEventListener('blur', () => { input.cancel(KEYBOARD_POINTER_ID); }, options);
  document.addEventListener('visibilitychange', () => {
    previousTime = null;
    audio.setSuspended(document.hidden);
    if (document.hidden) { finishTransition(); requestPause(); }
  }, options);

  let frameId = 0;
  const frame = (now: number): void => {
    const dt = previousTime === null ? 0 : now - previousTime;
    previousTime = now;
    audio.update(game.snapshot());
    if (root.dataset.audio !== audio.state) root.dataset.audio = audio.state;
    if (closeCaseAt && now >= closeCaseAt && ['idle', 'stored'].includes(game.snapshot().phase)) { closeCaseAt = 0; runtime.dispatch({ type: 'cash-out' }); }
    if (nextAlarmAt && now >= nextAlarmAt && started && !hudHidden && !overlayKey) { nextAlarmAt = now + 18000; audio.cue('alarm'); }
    // G10: presentation-only pressure. Waits for the current line to be read and never runs under a dialog.
    const phase = game.snapshot().phase;
    if (nextHullAt && now >= nextHullAt && started && !hudHidden && !overlayKey && ['idle', 'inspecting', 'stored'].includes(phase)) {
      nextHullAt = now + 22000 + Math.random() * 12000;
      hull.classList.remove('quake'); void hull.offsetWidth; hull.classList.add('quake');
      audio.cue('hull');
      if (now >= voiceHoldUntil && !(started && !tutorialDone)) { voice = HULL_LINES[hullLine % HULL_LINES.length]!; hullLine += 1; }
    }
    runtime.frame(dt);
    renderUi(game.snapshot());
    frameId = requestAnimationFrame(frame);
  };
  frameId = requestAnimationFrame(frame);
  renderUi(game.snapshot());
  return () => { input.clear(); abort.abort(); observer?.disconnect(); cancelAnimationFrame(frameId); window.clearTimeout(transitionTimer); audio.dispose(); runtime.dispose(); root.replaceChildren(); root.style.removeProperty('--workshop-ambient'); };
}
