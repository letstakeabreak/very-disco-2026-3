import '../preview';

// This is a local QA fixture controller, never imported by the game.
const probe = window.__renderProbe!;
type Controls = Parameters<typeof probe.setState>[0];
const run = new URLSearchParams(location.search).get('run');
if (!run) throw new Error('Open the URL printed by device-qa/server.mjs');
const canvas = document.querySelector('canvas')!;
const gl = canvas.getContext('webgl2')!;
const debug = gl.getExtension('WEBGL_debug_renderer_info');
const visibility: { at: string; hidden: boolean }[] = [];
const resizes: { at: string; width: number; height: number; dpr: number }[] = [];
const collectorErrors: string[] = [];
const note = document.querySelector('.scene-note')!;
let lastCommand = 0;
let measuring = false;
let ready = false;
let result: object | null = null;
let elapsedMs = 0;
let frames: number[] = [];

document.addEventListener('visibilitychange', () => visibility.push({ at: new Date().toISOString(), hidden: document.hidden }));
window.addEventListener('resize', () => resizes.push({ at: new Date().toISOString(), width: innerWidth, height: innerHeight, dpr: devicePixelRatio }));

function state() {
  return {
    at: new Date().toISOString(), ready, lastCommand, measuring, elapsedMs, sampleFrames: frames.length,
    environment: { userAgent: navigator.userAgent, dpr: devicePixelRatio,
      screen: [screen.width, screen.height], viewport: [innerWidth, innerHeight],
      buffer: [gl.drawingBufferWidth, gl.drawingBufferHeight],
      gpu: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) as string : gl.getParameter(gl.RENDERER) as string },
    controls: probe.controls, metrics: probe.metrics, errors: probe.errors,
    visibility, resizes, collectorErrors, result,
  };
}
async function publish() {
  const response = await fetch(`/qa/report?run=${run}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(state()) });
  if (!response.ok) throw new Error(`Collector returned ${response.status}`);
}
function statistics(samples: number[]) {
  const sorted = [...samples].sort((a, b) => a - b);
  const total = samples.reduce((sum, value) => sum + value, 0);
  return { frames: samples.length, durationMs: total, fps: total > 0 ? samples.length * 1000 / total : 0,
    p95FrameMs: sorted[Math.ceil(sorted.length * .95) - 1] ?? 0, maxFrameMs: sorted.at(-1) ?? 0 };
}
function startSoak() {
  measuring = true; result = null; frames = []; elapsedMs = 0;
  visibility.length = 0; resizes.length = 0;
  const startedAt = new Date().toISOString();
  const segments = Array.from({ length: 9 }, () => [] as number[]);
  const phaseSamples: object[] = [];
  let started: number | null = null;
  let previous = 0;
  let lastControls = -1000;
  function frame(now: number) {
    if (started === null) { started = now; previous = now; }
    else {
      const dt = now - previous;
      frames.push(dt);
      // Attribute each completed interval to the state present at its start.
      segments[Math.min(8, Math.floor((previous - started) / 20000))]!.push(dt);
      previous = now;
    }
    elapsedMs = now - started;
    const segment = Math.min(8, Math.floor(elapsedMs / 20000));
    if (elapsedMs - lastControls >= 500) {
      const pressure = (elapsedMs % 20000) / 20000;
      const controls: Controls[] = [
        { phase: 'inspecting', specimenId: 'salvage-core', pressure01: 0, integrity01: 1 },
        { phase: 'compressing', specimenId: 'salvage-core', pressure01: pressure, integrity01: 1 },
        { phase: 'failed', specimenId: 'salvage-core', pressure01: 1, integrity01: 0 },
        { phase: 'inspecting', specimenId: 'salvage-lens', pressure01: 0, integrity01: 1 },
        { phase: 'failed', specimenId: 'salvage-lens', pressure01: 1, integrity01: 0 },
        { phase: 'inspecting', specimenId: 'salvage-cassette', pressure01: 0, integrity01: 1 },
        { phase: 'compressing', specimenId: 'salvage-cassette', pressure01: pressure, integrity01: 1 - pressure },
        { phase: 'failed', specimenId: 'salvage-cassette', pressure01: 1, integrity01: 0 },
        { phase: 'stored', specimenId: 'salvage-cassette', pressure01: .55, integrity01: .5 },
      ];
      probe.setState({ ...controls[segment], yawDeg: segment < 8 ? Math.sin(elapsedMs / 1800) * 160 : 0, storedCount: segment === 8 ? 3 : 0 });
      phaseSamples.push({ elapsedMs, controls: probe.controls, renderer: probe.metrics.rendererStatus });
      note.textContent = `DEVICE RENDER FIXTURES · ${Math.floor(elapsedMs / 1000)} / 180 S`;
      lastControls = elapsedMs;
    }
    if (elapsedMs < 180000) { requestAnimationFrame(frame); return; }
    measuring = false;
    const totals = statistics(frames);
    result = { kind: 'Physical-device-capable B renderer fixture workload; device identity requires independent host evidence. Not integrated gameplay.',
      startedAt, endedAt: new Date().toISOString(), ...totals,
      segments: segments.map((samples, index) => ({ index, ...statistics(samples) })),
      frameIntervalsMs: frames, phaseSamples,
      passed: totals.durationMs >= 180000 && totals.p95FrameMs <= 33.3 && !visibility.some(item => item.hidden) && probe.errors.length === 0,
    };
    note.textContent = 'DEVICE RENDER FIXTURES · MEASUREMENT RECORDED';
    void publish().catch(error => collectorErrors.push(String(error)));
  }
  requestAnimationFrame(frame);
}

async function poll() {
  try {
    if (!ready) {
      ready = probe.metrics.rendererStatus.renderState === 'ready';
      if (ready) note.textContent = 'DEVICE RENDER FIXTURES · READY · NOT GAMEPLAY';
    }
    if (ready && !measuring) {
      const response = await fetch(`/qa/command?run=${run}`, { cache: 'no-store' });
      if (!response.ok) throw new Error(`Command returned ${response.status}`);
      const command = await response.json() as { id: number; action: 'setState' | 'soak'; controls?: Controls };
      if (command.id > lastCommand) {
        lastCommand = command.id;
        if (command.action === 'soak') startSoak();
        else probe.setState(command.controls ?? {});
      }
    }
    await publish();
  } catch (error) { collectorErrors.push(String(error)); }
  setTimeout(() => { void poll(); }, measuring ? 10000 : 1000);
}
void poll();
