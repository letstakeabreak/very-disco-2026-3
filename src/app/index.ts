import { createGame, getGameConfig } from '../core';
import { createRenderer } from '../render';
import { SNAPSHOT_FIXTURES } from '../contracts/fixtures';
import { CONTRACT_VERSION, type GamePhase } from '../contracts';
import { createRuntime } from './runtime';
import './style.css';

/** DEEP PRESS integration probe. No audio. The game and final art are not implemented. */
export function mountApp(root: HTMLElement): () => void {
  root.innerHTML = `<canvas aria-label="개발용 중립 3D 자리표시자"></canvas><section class="panel"><p class="badge">DEV · CONTRACT 1.0.0</p><h1>DEEP PRESS</h1><p>통합 준비 화면 · 완성 게임 아님</p><p>압축 결과·보관·가치 계산·최종 에셋은 아직 미구현입니다. 오디오 없음.</p><label>계약 장면 <select aria-label="계약 장면"><option value="live">실시간 stub</option>${Object.keys(SNAPSHOT_FIXTURES).map((phase) => `<option value="${phase}">${phase}</option>`).join('')}</select></label><p id="status" role="status"></p><button id="start">압력 입력 시험</button><button id="reset">초기화</button><p id="fatal" role="alert"></p></section>`;
  const canvas = root.querySelector('canvas')!;
  const status = root.querySelector<HTMLElement>('#status')!;
  const fatal = root.querySelector<HTMLElement>('#fatal')!;
  const start = root.querySelector<HTMLButtonElement>('#start')!;
  const reset = root.querySelector<HTMLButtonElement>('#reset')!;
  const select = root.querySelector('select')!;
  const game = createGame(getGameConfig());
  const renderer = createRenderer({ canvas, onFatal: () => { fatal.textContent = '3D 초기화 실패. 이 기기에서 WebGL을 확인하세요.'; } });
  const runtime = createRuntime(game, renderer, () => {});
  const abort = new AbortController();
  const options = { signal: abort.signal };
  start.addEventListener('click', () => { runtime.dispatch({ type: 'select', specimenId: 'salvage-core' }); runtime.dispatch({ type: 'press-start' }); }, options);
  reset.addEventListener('click', () => runtime.dispatch({ type: 'restart' }), options);
  select.addEventListener('change', () => runtime.dispatch({ type: 'restart' }), options);
  let previousTime: number | null = null;
  document.addEventListener('visibilitychange', () => { runtime.dispatch({ type: document.hidden ? 'pause' : 'resume' }); previousTime = null; }, options);
  const resize = (): void => renderer.resize({ width: canvas.clientWidth, height: canvas.clientHeight, dpr: window.devicePixelRatio });
  const observer = new ResizeObserver(resize); observer.observe(canvas); resize();
  let frameId = 0;
  const frame = (now: number): void => {
    const dt = previousTime === null ? 0 : now - previousTime; previousTime = now;
    const fixture = select.value === 'live' ? undefined : SNAPSHOT_FIXTURES[select.value as GamePhase];
    runtime.frame(dt, fixture);
    const snapshot = fixture ?? game.snapshot();
    status.textContent = `${CONTRACT_VERSION} · ${snapshot.phase} · tick ${snapshot.tick} · ${fixture ? 'fixture' : 'stub'}`;
    frameId = requestAnimationFrame(frame);
  };
  frameId = requestAnimationFrame(frame);
  return () => { abort.abort(); observer.disconnect(); cancelAnimationFrame(frameId); runtime.dispose(); root.replaceChildren(); };
}
