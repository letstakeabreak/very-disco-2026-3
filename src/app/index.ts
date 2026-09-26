import { createGame, getGameConfig } from '../core';
import { createRenderer } from '../render';
import type { GameEvent, GameSnapshot, SalvageId } from '../contracts';
import { createRuntime } from './runtime';
import { createInputController, isGameplayPhase } from './input';
import { INTRO_STORY, STRAIN_LINE, endingStory, reactionLine, toleranceLine, tutorialLine } from './story';
import type { CommsLine, StoryLine } from './story';
import { canStore, discardLabel, failureText, failureTitle, phaseLabel, recordText, remainingCapacity, resultItems, SPECIMEN_LABELS, specimenResult, splitSentences, bindWords } from './presentation';
import ridiLicenseUrl from './fonts/RIDIBatang-license.txt?url';
import logoLicenseUrl from './fonts/AlfaSlabOne-OFL.txt?url';
import './style.css';

const KEYBOARD_POINTER_ID = -1;
const BEST_SCORE_KEY = 'deep-press:best-score';
const TYPE_MS_PER_CHAR = 38;
const asset = (path: string): string => `${import.meta.env.BASE_URL}assets/${path}`;

/** Device-local best only; storage may be unavailable (private mode, blocked site data). */
function readBestScore(): number | null {
  try {
    const value = Number(localStorage.getItem(BEST_SCORE_KEY));
    return Number.isInteger(value) && value > 0 ? value : null;
  } catch { return null; }
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

/** App-owned DOM, pointer lifecycle, HUD, tutorial and result flow. No audio. */
export function mountApp(root: HTMLElement): () => void {
  // Resolve here: a relative custom-property URL is otherwise resolved against
  // the bundled stylesheet in assets/, adding a second assets/ directory.
  const ambientUrl = new URL(`${import.meta.env.BASE_URL}assets/textures/workshop-v4.webp`, document.baseURI);
  root.style.setProperty('--workshop-ambient', `url("${ambientUrl.href}")`);
  root.innerHTML = `<canvas class="scene" aria-label="DEEP PRESS 작업대. 끌어서 물건을 돌려 볼 수 있어요."></canvas>
    <div class="screen hud-hidden">
      <header class="topbar" aria-label="현황"><div class="metrics"><p><span>점수</span><strong id="score">0</strong></p><p><span>남은 공간</span><strong><span id="capacity">1.00</span><small>L</small></strong></p></div><button class="icon-button" id="pause" type="button" aria-label="일시 정지">Ⅱ</button></header>
      <section class="status-card" aria-label="지금 물건과 압력">
        <div class="status-head"><button class="swap" id="swap" type="button" disabled></button><strong class="pressure-value" id="pressure-value" aria-label="압력">0%</strong></div>
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
    <div class="transition" id="transition" hidden><video src="${asset('video/descent.mp4')}" muted playsinline preload="auto" disablepictureinpicture aria-hidden="true"></video><button class="transition-skip" type="button">건너뛰기</button></div>`;

  let canvas = root.querySelector('canvas')!;
  const screen = root.querySelector<HTMLElement>('.screen')!;
  const score = root.querySelector<HTMLElement>('#score')!;
  const capacity = root.querySelector<HTMLElement>('#capacity')!;
  const swap = root.querySelector<HTMLButtonElement>('#swap')!;
  const comms = root.querySelector<HTMLElement>('#comms')!;
  const commsName = root.querySelector<HTMLElement>('#comms-name')!;
  const commsText = root.querySelector<HTMLElement>('#comms-text')!;
  const commsLine = root.querySelector<HTMLElement>('#comms-line')!;
  const statusCard = root.querySelector<HTMLElement>('.status-card')!;
  const workbenchInput = root.querySelector<HTMLElement>('#workbench-input')!;
  const pressureValue = root.querySelector<HTMLElement>('#pressure-value')!;
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
  const video = transition.querySelector('video')!;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const game = createGame(getGameConfig());
  const abort = new AbortController();
  const options = { signal: abort.signal };
  let started = false;
  let tutorialStep = 0;
  let tutorialSpecimenId: SalvageId | null = null;
  let tutorialComplete = false;
  let failureReason: 'specimen-broken' | 'capacity-exceeded' | null = null;
  let bestScore = readBestScore();
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
  let autoSelectAt = 0;
  let voice: CommsLine | null = null;
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
    onInspectionMoved: () => {
      if (!tutorialComplete && game.snapshot().currentSpecimen?.id === tutorialSpecimenId) tutorialStep = Math.max(tutorialStep, 1);
    },
  });
  handleRendererFatal = () => {
    input.cancel();
    if (isGameplayPhase(game.snapshot().phase)) runtime.dispatch({ type: 'pause' });
    renderUi(game.snapshot());
  };

  function consumeEvents(events: readonly GameEvent[]): void {
    for (const event of events) {
      if (event.type === 'press-released' && game.snapshot().currentSpecimen?.id === tutorialSpecimenId) tutorialStep = Math.max(tutorialStep, 2);
      if (event.type === 'stored' && event.specimenId === tutorialSpecimenId) tutorialComplete = true;
      if (event.type === 'failed') failureReason = event.reason;
      if (event.type === 'completed' && event.score > (bestScore ?? 0)) {
        bestScore = event.score; newBest = true;
        try { localStorage.setItem(BEST_SCORE_KEY, String(event.score)); } catch { /* keep the in-memory best */ }
      }
      if (event.type === 'phase-changed' && event.to === 'idle') failureReason = null;
      // Put the next lot in the press once the banked or discarded one has cleared.
      if (event.type === 'stored' || event.type === 'discarded') autoSelectAt = performance.now() + 1000;
      const snapshot = game.snapshot();
      if (event.type === 'specimen-selected') toleranceVoiced = snapshot.currentSpecimen?.tolerance ? event.specimenId : null;
      voice = reactionLine(event, snapshot) ?? voice;
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
    tutorialStep = 0;
    tutorialComplete = false;
    failureReason = null;
    newBest = false;
    autoSelectAt = 0;
    voice = null;
    toleranceVoiced = null;
  }

  function beginRound(reset: boolean): void {
    clearRound();
    started = true;
    runtime.dispatch({ type: reset ? 'restart' : 'start' });
    const firstId = game.snapshot().remainingSpecimenIds[0];
    if (firstId) {
      tutorialSpecimenId = firstId;
      selectSpecimen(firstId);
    }
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
    if (snapshot.phase === 'failed') return 'failed';
    if (snapshot.phase === 'complete') return endingSeen ? 'complete' : 'outro';
    return '';
  }

  function currentStory(snapshot: GameSnapshot): { lines: readonly StoryLine[]; index: number } | null {
    if (overlayKey === 'story' && storyPage !== null) return { lines: INTRO_STORY, index: storyPage };
    if (overlayKey === 'outro') return { lines: endingStory(snapshot), index: outroPage };
    return null;
  }

  function visibleCharacters(line: StoryLine): number {
    if (lineRevealed || reducedMotion.matches) return line.text.length;
    return Math.min(line.text.length, Math.floor((performance.now() - lineStartedAt) / TYPE_MS_PER_CHAR));
  }

  /** Visual-novel stage: full-bleed scene, one standing speaker, a name plate and a typed line. */
  const STORY_MARKUP = `<section class="vn" role="dialog" aria-modal="true" aria-label="이야기">
      <div class="vn-backdrop" aria-hidden="true"></div><img class="vn-sprite away" alt="" aria-hidden="true" width="1024" height="1536">
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
        sprite.src = asset(`characters/${line.pose}.webp`);
        sprite.classList.remove('away', 'enter');
        if (entering) { void sprite.offsetWidth; sprite.classList.add('enter'); }
      } else sprite.classList.remove('away');
    }
    const shown = visibleCharacters(line);
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
          <button data-action="story-open" class="dialog-primary" type="button">시작하기</button>
          <details class="font-credits"><summary>글꼴 출처</summary><p>리디바탕 (리디주식회사)<br>Alfa Slab One (Jm Solé)</p><a href="${ridiLicenseUrl}" target="_blank" rel="noopener">리디바탕 이용 조건</a><a href="${logoLicenseUrl}" target="_blank" rel="noopener">로고 글꼴 OFL 전문</a></details>
        </section>`,
        story: STORY_MARKUP,
        outro: STORY_MARKUP,
        paused: `<section class="dialog-card" role="dialog" aria-modal="true" aria-labelledby="dialog-title"><h2 id="dialog-title">잠깐 멈췄어요</h2><button data-action="resume" class="dialog-primary" type="button">계속하기</button><button data-action="finish" class="dialog-secondary" type="button">여기서 마치기</button><button data-action="story-open" class="dialog-secondary" type="button">이야기 다시 보기</button><button data-action="title" class="dialog-secondary" type="button">처음으로</button></section>`,
        failed: `<section class="dialog-card" role="dialog" aria-modal="true" aria-labelledby="dialog-title"><h2 id="dialog-title">부서졌어요</h2><p id="dialog-copy"></p><button data-action="discard" class="dialog-primary" type="button" id="dialog-discard">버리고 계속하기</button><button data-action="cash-out" class="dialog-secondary" type="button">여기서 마치기</button><button data-action="restart" class="dialog-secondary" type="button">처음부터</button></section>`,
        complete: `<section class="dialog-card result-card" role="dialog" aria-modal="true" aria-labelledby="dialog-title"><h2 id="dialog-title">회수를 마쳤어요</h2><p class="result-score"><strong id="result-score"></strong>점</p><ul class="dialog-items" id="dialog-items"></ul><p class="dialog-record" id="dialog-record"></p><button data-action="restart" class="dialog-primary" type="button">다시 하기</button></section>`,
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
    if (finalScore) finalScore.textContent = snapshot.score.toLocaleString('ko-KR');
    const copy = overlay.querySelector<HTMLElement>('#dialog-copy');
    const title = overlay.querySelector<HTMLElement>('#dialog-title');
    if (title && key === 'failed') title.textContent = failureTitle(failureReason);
    if (copy && key === 'failed') copy.textContent = failureText(failureReason);
    const items = overlay.querySelector<HTMLElement>('#dialog-items');
    if (items) { items.innerHTML = resultItems(snapshot).map((row) => `<li>${row.map((cell) => `<span>${cell}</span>`).join('')}</li>`).join(''); items.hidden = !items.children.length; }
    const record = overlay.querySelector<HTMLElement>('#dialog-record');
    if (record) { record.textContent = recordText(bestScore, newBest); record.hidden = !record.textContent; }
    const discardChoice = overlay.querySelector<HTMLElement>('#dialog-discard');
    if (discardChoice) discardChoice.textContent = discardLabel(snapshot);
    if (copy && key === 'fatal') copy.textContent = `안 되면 새로고침해 주세요. (${fatalMessage})`;
  }

  /** The next remaining lot after the one in the press, for the swap control. */
  function nextLot(snapshot: GameSnapshot): SalvageId | null {
    const ids = snapshot.remainingSpecimenIds;
    const current = snapshot.currentSpecimen;
    if (!current || ids.length < 2) return null;
    return ids[(ids.indexOf(current.id) + 1) % ids.length] ?? null;
  }

  function renderUi(snapshot: GameSnapshot): void {
    score.textContent = snapshot.score.toLocaleString('ko-KR');
    capacity.textContent = remainingCapacity(snapshot).toFixed(2);
    const label = snapshot.currentSpecimen ? SPECIMEN_LABELS[snapshot.currentSpecimen.id] : '빈 프레스';
    // Swapping mirrors the core's select rule: only an untouched lot can go back.
    swap.disabled = snapshot.phase !== 'inspecting' || snapshot.currentSpecimen?.compression01 !== 0 || nextLot(snapshot) === null;
    if (swap.textContent !== label) swap.textContent = label;
    swap.setAttribute('aria-label', swap.disabled ? label : `${label}, 다른 물건으로 바꾸기`);
    const pressure = Math.round(snapshot.pressure01 * 100);
    pressureValue.textContent = `${pressure}%`;
    pressureBar.style.transform = `scaleX(${snapshot.pressure01})`;
    statusCard.style.setProperty('--light-x', `${14 + snapshot.pressure01 * 72}%`);
    hold.classList.toggle('pressing', snapshot.phase === 'compressing');
    const facts = specimenResult(snapshot).map((fact) => `<span${fact.warn ? ' class="warn"' : ''}>${fact.text}</span>`).join('');
    if (resultValue.innerHTML !== facts) resultValue.innerHTML = facts;
    const tutorialActive = started && !tutorialComplete && snapshot.currentSpecimen?.id === tutorialSpecimenId && snapshot.phase !== 'failed' && snapshot.phase !== 'complete';
    const lot = snapshot.currentSpecimen;
    if (lot?.tolerance && toleranceVoiced !== lot.id) { toleranceVoiced = lot.id; voice = toleranceLine(lot.tolerance); }
    // Live strain, then the first-lot tutorial, then the latest reaction.
    const line = snapshot.phase === 'compressing' && snapshot.stress01 > 0 ? STRAIN_LINE : tutorialActive ? tutorialLine(tutorialStep) : voice;
    comms.hidden = line === null;
    comms.classList.toggle('strained', line === STRAIN_LINE);
    const key = line ? `${line.speaker}:${line.text}` : '';
    if (key !== voiceKey) {
      voiceKey = key;
      voiceStartedAt = performance.now();
      commsName.textContent = line?.speaker ?? '';
      commsLine.textContent = line ? `${line.speaker}: ${line.text}` : '';
    }
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
    if (action === 'restart') beginRound(true);
    if (action === 'title') returnToTitle();
    if (action === 'resume') { runtime.dispatch({ type: 'resume' }); renderUi(game.snapshot()); }
    if (action === 'cash-out') { runtime.dispatch({ type: 'cash-out' }); renderUi(game.snapshot()); }
    if (action === 'finish') { runtime.dispatch({ type: 'resume' }); runtime.dispatch({ type: 'cash-out' }); renderUi(game.snapshot()); }
    if (action === 'discard') { runtime.dispatch({ type: 'discard' }); renderUi(game.snapshot()); }
    if (action === 'retry-renderer') retryRenderer();
    if (action === 'story-open') openStory();
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
  swap.addEventListener('click', () => {
    const next = nextLot(game.snapshot());
    if (next) selectSpecimen(next);
  }, options);
  store.addEventListener('click', () => runtime.dispatch({ type: 'store' }), options);
  discard.addEventListener('click', () => runtime.dispatch({ type: 'discard' }), options);
  pauseButton.addEventListener('click', requestPause, options);

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
    if (document.hidden) { finishTransition(); requestPause(); }
  }, options);

  let frameId = 0;
  const frame = (now: number): void => {
    const dt = previousTime === null ? 0 : now - previousTime;
    previousTime = now;
    const phase = game.snapshot().phase;
    if (autoSelectAt && now >= autoSelectAt && (phase === 'idle' || phase === 'stored')) {
      autoSelectAt = 0;
      const next = game.snapshot().remainingSpecimenIds[0];
      if (next) selectSpecimen(next);
    }
    runtime.frame(dt);
    renderUi(game.snapshot());
    frameId = requestAnimationFrame(frame);
  };
  frameId = requestAnimationFrame(frame);
  renderUi(game.snapshot());
  return () => { input.clear(); abort.abort(); observer?.disconnect(); cancelAnimationFrame(frameId); window.clearTimeout(transitionTimer); runtime.dispose(); root.replaceChildren(); root.style.removeProperty('--workshop-ambient'); };
}
