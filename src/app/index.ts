import { createGame, getGameConfig } from '../core';
import { createRenderer } from '../render';
import { CONTRACT_VERSION, type GameEvent, type GameSnapshot, type SalvageId } from '../contracts';
import { createRuntime } from './runtime';
import { createInputController, isGameplayPhase } from './input';
import { canStore, discardLabel, failureText, phaseLabel, remainingCapacity, resultSummary, SPECIMEN_LABELS, specimenResult, tutorialText } from './presentation';
import './style.css';

const KEYBOARD_POINTER_ID = -1;

/** App-owned DOM, pointer lifecycle, HUD, tutorial and result flow. No audio. */
export function mountApp(root: HTMLElement): () => void {
  root.innerHTML = `<canvas class="scene" aria-label="DEEP PRESS 작업대. 회수물을 끌어 살펴볼 수 있습니다."></canvas>
    <div class="screen">
      <header class="topbar"><div class="brand"><p class="eyebrow">DEEP RECOVERY · ${CONTRACT_VERSION}</p><h1>DEEP PRESS</h1></div><button class="icon-button" id="pause" type="button" aria-label="일시 정지">Ⅱ</button></header>
      <section class="hud" aria-label="회수 현황"><div class="metric"><span>확보 점수</span><strong id="score">0</strong></div><div class="metric"><span>케이스 여유</span><strong><span id="capacity">1.00</span><small>L</small></strong></div></section>
      <main class="work-area">
        <div class="specimen-card" aria-live="polite"><div><span class="eyebrow">CURRENT SALVAGE</span><h2 id="specimen-name">회수물을 선택하세요</h2></div><span class="phase-pill" id="phase">대기 중</span></div>
        <p class="tutorial" id="tutorial" hidden></p>
        <div class="workbench-input" id="workbench-input" role="img" aria-label="회수물 회전 조작 영역"></div>
        <div class="pressure-card" aria-label="현재 압력"><div class="pressure-label"><span>압력</span><strong id="pressure-value">0%</strong></div><div class="pressure-track"><span id="pressure-bar"></span></div><p id="result-value">물건을 검사해 압착을 시작하세요.</p></div>
        <div class="specimen-choices" id="specimen-choices" role="group" aria-label="회수물 선택"></div>
      </main>
      <footer class="controls" aria-label="작업 조작">
        <button class="press-button" id="hold" type="button" aria-label="누르고 있는 동안 회수물을 압착">누르고 압착</button>
        <div class="secondary-controls"><button id="store" type="button">보관</button><button id="discard" type="button">폐기</button><button id="cash-out" type="button">정산</button></div>
        <p id="dev-note" class="dev-note" hidden></p><p id="live-status" class="visually-hidden" role="status" aria-live="polite"></p>
      </footer>
    </div><div class="overlay" id="overlay" hidden></div>`;

  let canvas = root.querySelector('canvas')!;
  const score = root.querySelector<HTMLElement>('#score')!;
  const capacity = root.querySelector<HTMLElement>('#capacity')!;
  const specimenName = root.querySelector<HTMLElement>('#specimen-name')!;
  const phaseElement = root.querySelector<HTMLElement>('#phase')!;
  const tutorial = root.querySelector<HTMLElement>('#tutorial')!;
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
    runtime.dispatch({ type: reset ? 'restart' : 'start' });
    const firstId = game.snapshot().remainingSpecimenIds[0];
    if (firstId) {
      tutorialSpecimenId = firstId;
      selectSpecimen(firstId);
    }
    renderUi(game.snapshot());
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
      overlay.className = `overlay${key === 'fatal' ? ' overlay-error' : ''}`;
      const content: Record<string, string> = {
        start: `<section class="dialog-card" role="dialog" aria-modal="true" aria-labelledby="dialog-title"><p class="eyebrow">SALVAGE SHIFT 01</p><h2 id="dialog-title">공간은 1L</h2><p>회수물을 살펴보고, 눌러 담아 케이스에 보관하세요.</p><button data-action="start" class="dialog-primary" type="button">작업 시작</button></section>`,
        paused: `<section class="dialog-card" role="dialog" aria-modal="true" aria-labelledby="dialog-title"><p class="eyebrow">PAUSED</p><h2 id="dialog-title">작업이 멈췄습니다</h2><p>압력은 멈춰 있습니다. 준비되면 이어서 작업하세요.</p><button data-action="resume" class="dialog-primary" type="button">계속하기</button></section>`,
        failed: `<section class="dialog-card" role="dialog" aria-modal="true" aria-labelledby="dialog-title"><p class="eyebrow">SALVAGE LOST</p><h2 id="dialog-title">회수 실패</h2><p id="dialog-copy"></p><p class="dialog-summary" id="dialog-summary"></p><button data-action="discard" class="dialog-primary" type="button" id="dialog-discard">폐기하고 계속</button><button data-action="cash-out" class="dialog-secondary" type="button">확보 점수 정산</button><button data-action="restart" class="dialog-secondary" type="button">다시 하기</button></section>`,
        complete: `<section class="dialog-card" role="dialog" aria-modal="true" aria-labelledby="dialog-title"><p class="eyebrow">SHIFT COMPLETE</p><h2 id="dialog-title">회수 완료</h2><p>이번 작업 결과</p><p class="dialog-summary" id="dialog-summary"></p><button data-action="restart" class="dialog-primary" type="button">다시 하기</button></section>`,
        fatal: `<section class="dialog-card" role="alertdialog" aria-modal="true" aria-labelledby="dialog-title"><p class="eyebrow">DISPLAY ERROR</p><h2 id="dialog-title">3D 화면을 시작할 수 없습니다</h2><p id="dialog-copy"></p><button data-action="retry-renderer" class="dialog-primary" type="button">다시 시도</button></section>`,
      };
      overlay.innerHTML = content[key] ?? '';
      if (key) overlay.querySelector<HTMLButtonElement>('button[data-action]')?.focus({ preventScroll: true });
      else if (previousKey === 'paused' && !pauseButton.hidden) pauseButton.focus({ preventScroll: true });
      else if (previousKey === 'fatal' && !pauseButton.hidden) pauseButton.focus({ preventScroll: true });
    }
    const summary = overlay.querySelector<HTMLElement>('#dialog-summary');
    if (summary) summary.textContent = resultSummary(snapshot);
    const copy = overlay.querySelector<HTMLElement>('#dialog-copy');
    if (copy && key === 'failed') copy.textContent = failureText(failureReason);
    const discardChoice = overlay.querySelector<HTMLElement>('#dialog-discard');
    if (discardChoice) discardChoice.textContent = discardLabel(snapshot);
    if (copy && key === 'fatal') copy.textContent = `3D 초기화 오류 (${fatalMessage}). 현재 작업은 일시 정지되었습니다. 그래픽 연결을 다시 시도하거나 페이지를 새로고침해 주세요.`;
  }

  function renderChoices(snapshot: GameSnapshot): void {
    const mayChoose = snapshot.phase === 'idle' || snapshot.phase === 'stored'
      || (snapshot.phase === 'inspecting' && snapshot.currentSpecimen?.compression01 === 0);
    const buttons = snapshot.remainingSpecimenIds.map((id) => {
      const selected = snapshot.currentSpecimen?.id === id;
      const disabled = !mayChoose || selected;
      return `<button type="button" data-specimen="${id}"${disabled ? ' disabled' : ''}${selected ? ' aria-current="true"' : ''}>${SPECIMEN_LABELS[id]}${selected ? ' · 선택됨' : ''}</button>`;
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
    specimenName.textContent = snapshot.currentSpecimen ? SPECIMEN_LABELS[snapshot.currentSpecimen.id] : '회수물을 선택하세요';
    phaseElement.textContent = phaseLabel(snapshot.phase);
    const pressure = Math.round(snapshot.pressure01 * 100);
    pressureValue.textContent = `${pressure}%`;
    pressureBar.style.transform = `scaleX(${snapshot.pressure01})`;
    resultValue.textContent = specimenResult(snapshot);
    tutorial.hidden = !started || tutorialComplete || snapshot.currentSpecimen?.id !== tutorialSpecimenId || snapshot.phase === 'complete' || snapshot.phase === 'failed';
    tutorial.textContent = tutorialText(tutorialStep);
    // Stay enabled while held: disabling the pressed button blurs it and drops capture.
    hold.disabled = snapshot.phase !== 'inspecting' && snapshot.phase !== 'compressing';
    store.disabled = !canStore(snapshot);
    discard.disabled = snapshot.phase !== 'inspecting' && snapshot.phase !== 'failed';
    cashOut.disabled = !['idle', 'inspecting', 'stored', 'failed'].includes(snapshot.phase);
    pauseButton.hidden = snapshot.phase === 'idle' || snapshot.phase === 'paused' || snapshot.phase === 'complete';
    devNote.hidden = snapshot.implementation === 'game';
    devNote.textContent = snapshot.implementation === 'scaffold'
      ? '개발 연결 중: 압축 결과·보관·정산은 코어 구현과 연결되면 활성화됩니다.'
      : '';
    liveStatus.textContent = `${phaseLabel(snapshot.phase)} · 압력 ${pressure}% · 확보 점수 ${snapshot.score}`;
    renderChoices(snapshot);
    renderOverlay(snapshot);
  }

  function resize(): void {
    renderer.resize({ width: root.clientWidth, height: root.clientHeight || window.innerHeight, dpr: window.devicePixelRatio });
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
  return () => { input.clear(); abort.abort(); observer?.disconnect(); cancelAnimationFrame(frameId); runtime.dispose(); root.replaceChildren(); };
}
