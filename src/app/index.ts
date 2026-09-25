import { createGame, getGameConfig } from '../core';
import { createRenderer } from '../render';
import type { GameEvent, GameSnapshot, SalvageId } from '../contracts';
import { createRuntime } from './runtime';
import { createInputController, isGameplayPhase } from './input';
import { canStore, cueText, discardLabel, failureText, failureTitle, phaseLabel, recordText, remainingCapacity, resultItems, resultSummary, SPECIMEN_LABELS, specimenResult, tutorialText } from './presentation';
import scoreLicenseUrl from './fonts/S-Core-Dream-license.png?url';
import ridiLicenseUrl from './fonts/RIDIBatang-license.txt?url';
import './style.css';

const KEYBOARD_POINTER_ID = -1;
const BEST_SCORE_KEY = 'deep-press:best-score';

/** Device-local best only; storage may be unavailable (private mode, blocked site data). */
function readBestScore(): number | null {
  try {
    const value = Number(localStorage.getItem(BEST_SCORE_KEY));
    return Number.isInteger(value) && value > 0 ? value : null;
  } catch { return null; }
}

/** App-owned DOM, pointer lifecycle, HUD, tutorial and result flow. No audio. */
export function mountApp(root: HTMLElement): () => void {
  root.style.setProperty('--workshop-ambient', `url("${import.meta.env.BASE_URL}assets/textures/workshop-v4.webp")`);
  root.innerHTML = `<canvas class="scene" aria-label="DEEP PRESS 작업대. 끌어서 물건을 돌려 볼 수 있어요."></canvas>
    <div class="screen">
      <header class="topbar" aria-label="현황"><div class="metric"><span>점수</span><strong id="score">0</strong></div><div class="metric"><span>남은 공간</span><strong><span id="capacity">1.00</span><small>L</small></strong></div><button class="icon-button" id="pause" type="button" aria-label="일시 정지">Ⅱ</button></header>
      <section class="status-card" aria-label="지금 물건과 압력">
        <div class="status-head"><h2 id="specimen-name">빈 프레스</h2><span class="phase-pill" id="phase">대기 중</span></div>
        <div class="pressure-row"><span>압력</span><div class="pressure-track"><span id="pressure-bar"></span></div><strong id="pressure-value">0%</strong></div>
        <p id="result-value">아래에서 물건을 하나 골라 주세요</p>
        <p class="tutorial" id="tutorial" hidden></p>
        <p class="cue" id="cue" hidden></p>
      </section>
      <main class="work-area"><div class="workbench-input" id="workbench-input" role="img" aria-label="물건 돌리기"></div></main>
      <footer class="controls" aria-label="조작">
        <div class="specimen-choices" id="specimen-choices" role="group" aria-label="물건 고르기"></div>
        <div class="operation-row"><div class="specimen-actions" role="group" aria-label="현재 물건 처리"><button class="press-button" id="hold" type="button" aria-label="누르고 있는 동안 물건을 압축해요">꾹 눌러 압축</button>
        <div class="secondary-controls"><button id="store" type="button">담기</button><button id="discard" type="button">버리기</button></div></div>
        <div class="finish-controls" role="group" aria-label="회수 작업 종료"><button id="cash-out" type="button">마치기</button></div></div>
        <p id="dev-note" class="dev-note" hidden></p><p id="live-status" class="visually-hidden" role="status" aria-live="polite"></p>
      </footer>
    </div><div class="overlay" id="overlay" hidden></div>`;

  let canvas = root.querySelector('canvas')!;
  const screen = root.querySelector<HTMLElement>('.screen')!;
  const score = root.querySelector<HTMLElement>('#score')!;
  const capacity = root.querySelector<HTMLElement>('#capacity')!;
  const specimenName = root.querySelector<HTMLElement>('#specimen-name')!;
  const phaseElement = root.querySelector<HTMLElement>('#phase')!;
  const tutorial = root.querySelector<HTMLElement>('#tutorial')!;
  const cue = root.querySelector<HTMLElement>('#cue')!;
  const statusCard = root.querySelector<HTMLElement>('.status-card')!;
  const workbenchInput = root.querySelector<HTMLElement>('#workbench-input')!;
  const pressureValue = root.querySelector<HTMLElement>('#pressure-value')!;
  const pressureBar = root.querySelector<HTMLElement>('#pressure-bar')!;
  const resultValue = root.querySelector<HTMLElement>('#result-value')!;
  const choices = root.querySelector<HTMLElement>('#specimen-choices')!;
  const hold = root.querySelector<HTMLButtonElement>('#hold')!;
  const store = root.querySelector<HTMLButtonElement>('#store')!;
  const discard = root.querySelector<HTMLButtonElement>('#discard')!;
  const cashOut = root.querySelector<HTMLButtonElement>('#cash-out')!;
  const pauseButton = root.querySelector<HTMLButtonElement>('#pause')!;
  const devNote = root.querySelector<HTMLElement>('#dev-note')!;
  const liveStatus = root.querySelector<HTMLElement>('#live-status')!;
  const overlay = root.querySelector<HTMLElement>('#overlay')!;
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
  let renderedChoices = '';
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
    }
  }

  function selectSpecimen(id: SalvageId): void {
    input.clear();
    runtime.dispatch({ type: 'select', specimenId: id });
  }

  function beginRound(reset: boolean): void {
    input.clear();
    started = true;
    tutorialStep = 0;
    tutorialComplete = false;
    failureReason = null;
    newBest = false;
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

  function requestPause(): void {
    // A cancelled gesture may already have paused; otherwise pause here.
    input.cancel();
    if (isGameplayPhase(game.snapshot().phase)) runtime.dispatch({ type: 'pause' });
    renderUi(game.snapshot());
  }

  function overlayState(snapshot: GameSnapshot): string {
    if (fatalMessage) return 'fatal';
    if (!started && snapshot.phase === 'idle') return 'start';
    if (snapshot.phase === 'paused') return 'paused';
    if (snapshot.phase === 'failed') return 'failed';
    if (snapshot.phase === 'complete') return 'complete';
    return '';
  }

  function renderOverlay(snapshot: GameSnapshot): void {
    const key = overlayState(snapshot);
    if (key !== overlayKey) {
      const previousKey = overlayKey;
      overlayKey = key;
      overlay.hidden = !key;
      overlay.className = `overlay overlay-${key}`;
      screen.inert = Boolean(key);
      screen.classList.toggle('awaiting-start', key === 'start');
      const content: Record<string, string> = {
        start: `<div class="mission-identity"><p class="eyebrow">심해 회수반 · 마지막 작업</p><p class="wordmark" aria-label="DEEP PRESS">DEEP<span>PRESS</span></p></div>
        <section class="dialog-card mission-card" role="dialog" aria-modal="true" aria-labelledby="dialog-title" aria-describedby="mission-story">
          <h2 id="dialog-title">가라앉은 연구소에,<br>아직 남은 것들.</h2>
          <p id="mission-story">당신은 마지막 회수 담당자예요.<br>부품과 연구 기록을 수면 위로 보내 주세요.</p>
          <div class="mission-limit"><span>가져갈 수 있는 공간</span><strong>1.00<small>L</small></strong></div>
          <p class="mission-rule">겉은 줄이고, 안의 가치는 지켜요.<br>너무 세게 누르면 소중한 것까지 부서져요.</p>
          <ol class="mission-steps" aria-label="작업 순서"><li><span>01</span>돌려 보고</li><li><span>02</span>눌러 줄이고</li><li><span>03</span>담아 올려요</li></ol>
          <button data-action="start" class="dialog-primary" type="button">회수 시작하기 <span aria-hidden="true">↗</span></button>
          <details class="font-credits"><summary>글꼴 출처</summary><p>에스코어드림 · S-Core / 리디바탕 · 리디주식회사</p><a href="${scoreLicenseUrl}" target="_blank" rel="noopener">에스코어드림 이용 조건</a><a href="${ridiLicenseUrl}" target="_blank" rel="noopener">리디바탕 이용 조건</a></details>
        </section>`,
        paused: `<section class="dialog-card" role="dialog" aria-modal="true" aria-labelledby="dialog-title"><p class="eyebrow">심해 회수반 · 작업 대기</p><h2 id="dialog-title">잠깐 멈췄어요</h2><p>아직 아래에 남은 것들이 있어요.<br>준비되면 이어서 회수해요.</p><button data-action="resume" class="dialog-primary" type="button">계속하기</button></section>`,
        failed: `<section class="dialog-card" role="dialog" aria-modal="true" aria-labelledby="dialog-title"><h2 id="dialog-title">부서졌어요</h2><p id="dialog-copy"></p><p class="dialog-summary" id="dialog-summary"></p><button data-action="discard" class="dialog-primary" type="button" id="dialog-discard">버리고 계속하기</button><button data-action="cash-out" class="dialog-secondary" type="button">지금 점수로 마치기</button><button data-action="restart" class="dialog-secondary" type="button">처음부터 다시</button></section>`,
        complete: `<section class="dialog-card" role="dialog" aria-modal="true" aria-labelledby="dialog-title"><p class="eyebrow">DEEP PRESS</p><h2 id="dialog-title">회수 작업을 마쳤어요</h2><p id="recovery-note"></p><p class="dialog-summary" id="dialog-summary"></p><ul class="dialog-items" id="dialog-items"></ul><p class="dialog-record" id="dialog-record"></p><button data-action="restart" class="dialog-primary" type="button">다시 하기</button></section>`,
        fatal: `<section class="dialog-card" role="alertdialog" aria-modal="true" aria-labelledby="dialog-title"><h2 id="dialog-title">화면을 불러오지 못했어요</h2><p id="dialog-copy"></p><button data-action="retry-renderer" class="dialog-primary" type="button">다시 시도</button></section>`,
      };
      overlay.innerHTML = content[key] ?? '';
      if (key) overlay.querySelector<HTMLButtonElement>('button[data-action]')?.focus({ preventScroll: true });
      else if (previousKey === 'paused' && !pauseButton.hidden) pauseButton.focus({ preventScroll: true });
      else if (previousKey === 'fatal' && !pauseButton.hidden) pauseButton.focus({ preventScroll: true });
    }
    const recoveryNote = overlay.querySelector<HTMLElement>('#recovery-note');
    if (recoveryNote) recoveryNote.textContent = snapshot.storedSpecimenIds.includes('salvage-cassette')
      ? '연구 기록이 수면 위로 돌아가요. 작은 케이스에 남길 것을 잘 골랐어요.'
      : snapshot.storedSpecimenIds.length > 0 ? '건져 올린 부품을 수면 위로 보내요. 다음에는 무엇을 더 담을 수 있을까요?'
      : '이번에는 빈 케이스예요. 다음 작업에서는 물건을 살펴보고, 조금씩 눌러 봐요.';
    const summary = overlay.querySelector<HTMLElement>('#dialog-summary');
    if (summary) summary.textContent = resultSummary(snapshot);
    const copy = overlay.querySelector<HTMLElement>('#dialog-copy');
    const title = overlay.querySelector<HTMLElement>('#dialog-title');
    if (title && key === 'failed') title.textContent = failureTitle(failureReason);
    if (copy && key === 'failed') copy.textContent = failureText(failureReason);
    const items = overlay.querySelector<HTMLElement>('#dialog-items');
    if (items) items.innerHTML = resultItems(snapshot).map((line) => `<li>${line}</li>`).join('');
    const record = overlay.querySelector<HTMLElement>('#dialog-record');
    if (record) record.textContent = recordText(snapshot, bestScore, newBest);
    const discardChoice = overlay.querySelector<HTMLElement>('#dialog-discard');
    if (discardChoice) discardChoice.textContent = discardLabel(snapshot);
    if (copy && key === 'fatal') copy.textContent = `게임은 멈춰 뒀어요. 다시 시도해 보고, 계속 안 되면 새로고침해 주세요. (오류: ${fatalMessage})`;
  }

  function renderChoices(snapshot: GameSnapshot): void {
    const mayChoose = snapshot.phase === 'idle' || snapshot.phase === 'stored'
      || (snapshot.phase === 'inspecting' && snapshot.currentSpecimen?.compression01 === 0);
    const buttons = snapshot.remainingSpecimenIds.map((id) => {
      const selected = snapshot.currentSpecimen?.id === id;
      const disabled = !mayChoose || selected;
      return `<button type="button" data-specimen="${id}"${disabled ? ' disabled' : ''}${selected ? ' aria-current="true"' : ''}>${selected ? '✓ ' : ''}${SPECIMEN_LABELS[id]}</button>`;
    }).join('');
    if (buttons !== renderedChoices) {
      renderedChoices = buttons;
      choices.innerHTML = buttons;
    }
    choices.hidden = buttons.length === 0;
  }

  function renderUi(snapshot: GameSnapshot): void {
    score.textContent = snapshot.score.toLocaleString('ko-KR');
    capacity.textContent = remainingCapacity(snapshot).toFixed(2);
    specimenName.textContent = snapshot.currentSpecimen ? SPECIMEN_LABELS[snapshot.currentSpecimen.id] : '빈 프레스';
    phaseElement.textContent = phaseLabel(snapshot.phase);
    const pressure = Math.round(snapshot.pressure01 * 100);
    pressureValue.textContent = `${pressure}%`;
    pressureBar.style.transform = `scaleX(${snapshot.pressure01})`;
    statusCard.style.setProperty('--light-x', `${14 + snapshot.pressure01 * 72}%`);
    hold.classList.toggle('pressing', snapshot.phase === 'compressing');
    resultValue.textContent = specimenResult(snapshot);
    tutorial.hidden = !started || tutorialComplete || snapshot.currentSpecimen?.id !== tutorialSpecimenId || snapshot.phase === 'complete' || snapshot.phase === 'failed';
    tutorial.textContent = tutorialText(tutorialStep);
    // The first-lot tutorial already asks to rotate; hints and strain still show beside it.
    const cueLine = cueText(snapshot, tutorial.hidden);
    cue.hidden = cueLine === null;
    cue.textContent = cueLine ?? '';
    statusCard.classList.toggle('strained', snapshot.stress01 > 0);
    // Stay enabled while held: disabling the pressed button blurs it and drops capture.
    hold.disabled = snapshot.phase !== 'inspecting' && snapshot.phase !== 'compressing';
    store.disabled = !canStore(snapshot);
    discard.disabled = snapshot.phase !== 'inspecting' && snapshot.phase !== 'failed';
    cashOut.disabled = !['idle', 'inspecting', 'stored', 'failed'].includes(snapshot.phase);
    pauseButton.hidden = snapshot.phase === 'idle' || snapshot.phase === 'paused' || snapshot.phase === 'complete';
    devNote.hidden = snapshot.implementation === 'game';
    devNote.textContent = snapshot.implementation === 'scaffold'
      ? '개발 중: 코어가 연결되면 담기와 마치기가 켜져요.'
      : '';
    liveStatus.textContent = `${phaseLabel(snapshot.phase)} · 압력 ${pressure}% · 점수 ${snapshot.score}점`;
    renderChoices(snapshot);
    renderOverlay(snapshot);
  }

  function resize(): void {
    const width = root.clientWidth;
    let height = root.clientHeight || window.innerHeight;
    let top = 0;
    if (started && height < 700 && width < height) {
      // The fixed 2:3 workshop's gauge and case occupy its central 14–88%.
      // Fit that working area between HUD and controls on short portrait screens.
      const rootTop = root.getBoundingClientRect().top;
      const start = statusCard.getBoundingClientRect().bottom - rootTop + 10;
      const end = root.querySelector<HTMLElement>('.controls')!.getBoundingClientRect().top - rootTop - 10;
      height = Math.max(1, Math.min(width * 1.5, (end - start) / .74));
      top = start - height * .14;
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
    const action = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-action]')?.dataset.action;
    if (action === 'start') beginRound(false);
    if (action === 'restart') beginRound(true);
    if (action === 'resume') { runtime.dispatch({ type: 'resume' }); renderUi(game.snapshot()); }
    if (action === 'cash-out') { runtime.dispatch({ type: 'cash-out' }); renderUi(game.snapshot()); }
    if (action === 'discard') { runtime.dispatch({ type: 'discard' }); renderUi(game.snapshot()); }
    if (action === 'retry-renderer') retryRenderer();
  }, options);
  choices.addEventListener('click', (event) => {
    const id = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-specimen]')?.dataset.specimen as SalvageId | undefined;
    if (id) selectSpecimen(id);
  }, options);
  store.addEventListener('click', () => runtime.dispatch({ type: 'store' }), options);
  discard.addEventListener('click', () => runtime.dispatch({ type: 'discard' }), options);
  cashOut.addEventListener('click', () => runtime.dispatch({ type: 'cash-out' }), options);
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
    if (document.hidden) requestPause();
  }, options);

  let frameId = 0;
  const frame = (now: number): void => {
    const dt = previousTime === null ? 0 : now - previousTime;
    previousTime = now;
    runtime.frame(dt);
    renderUi(game.snapshot());
    frameId = requestAnimationFrame(frame);
  };
  frameId = requestAnimationFrame(frame);
  renderUi(game.snapshot());
  return () => { input.clear(); abort.abort(); observer?.disconnect(); cancelAnimationFrame(frameId); runtime.dispose(); root.replaceChildren(); root.style.removeProperty('--workshop-ambient'); };
}
