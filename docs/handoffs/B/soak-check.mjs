import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../../../', import.meta.url));
const session = 'deep-press-soak';
const output = fileURLToPath(new URL('./evidence/desktop-soak.json', import.meta.url));
const run = (...args) => {
  const response = JSON.parse(execFileSync('npx', ['--yes', 'agent-browser@0.38.1', '--session', session, '--json', ...args], { cwd: root, encoding: 'utf8', timeout: 45000 }));
  if (!response.success) throw new Error(JSON.stringify(response.error));
  return response.data;
};
const evaluate = (source) => run('eval', source).result;
const paths = ['src/render/index.ts','src/render/deformation.ts','src/render/ram.ts','src/render/visual-state.ts','public/assets/models/press-chamber.glb','public/assets/models/salvage-core.glb','public/assets/models/salvage-lens.glb','public/assets/models/salvage-cassette.glb','public/assets/textures/workshop.webp'];
const hashes = () => Object.fromEntries(paths.map(path => [path, createHash('sha256').update(readFileSync(`${root}${path}`)).digest('hex')]));
const report = { kind: 'Desktop Chromium WebGL fixture workload, 390x844 with DPR 2; NOT a physical iPhone or gameplay test', checkedAt: new Date().toISOString(), startHashes: hashes(), samples: [] };
try {
  run('open', 'http://127.0.0.1:5173/docs/handoffs/B/preview.html');
  run('set', 'viewport', '390', '844', '2');
  run('wait', '--load', 'networkidle');
  evaluate(`(async()=>{for(let n=0;n<120;n++)await new Promise(requestAnimationFrame);if(window.__renderProbe.metrics.rendererStatus.renderState!=='ready')throw Error('Models not ready')})()`);
  evaluate(`(()=>{
    const gl=document.querySelector('canvas').getContext('webgl2');const debug=gl.getExtension('WEBGL_debug_renderer_info');
    const started=performance.now();let last=started;let lastControls=0;
    window.__soak={started,frames:[],done:false,phaseSamples:[],environment:{userAgent:navigator.userAgent,dpr:devicePixelRatio,buffer:[gl.drawingBufferWidth,gl.drawingBufferHeight],gpu:debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER)}};
    window.__renderProbe.resetMetrics();
    function frame(now){
      const elapsed=now-started;window.__soak.frames.push(now-last);last=now;
      if(elapsed-lastControls>500){
        const segment=Math.min(5,Math.floor(elapsed/30000));
        const phase=['inspecting','compressing','failed','stored','complete','paused'][segment];
        window.__renderProbe.setState({phase,specimenId:segment===2?'salvage-lens':segment===1?'salvage-cassette':'salvage-core',pressure01:segment===2?1:segment===1?(elapsed%30000)/30000:0.5,integrity01:segment===2?0:0.85,yawDeg:segment<3?Math.sin(elapsed/1800)*160:0,storedCount:segment===4?3:segment===3?2:0});
        window.__soak.phaseSamples.push({elapsed,phase,renderer:window.__renderProbe.metrics.rendererStatus});lastControls=elapsed;
      }
      if(elapsed<180000)requestAnimationFrame(frame);else{window.__soak.done=true;window.__soak.duration=elapsed;}
    }requestAnimationFrame(frame);
  })()`);
  for (let block = 0; block < 7; block += 1) {
    await new Promise(resolve => setTimeout(resolve, 30000));
    const sample = evaluate('({done:window.__soak.done,metrics:window.__renderProbe.metrics,errors:window.__renderProbe.errors})');
    report.samples.push(sample);
    console.log(`Soak ${Math.round(sample.metrics.elapsedMs / 1000)}s: ${sample.metrics.fps.toFixed(1)} FPS, P95 ${sample.metrics.p95FrameMs.toFixed(1)}ms, errors ${sample.errors.length}`);
    if (sample.done) break;
  }
  report.measurement = evaluate(`(()=>{const s=window.__soak;const sorted=[...s.frames].sort((a,b)=>a-b);return {done:s.done,durationMs:s.duration,frames:s.frames.length,fps:1000*s.frames.length/s.frames.reduce((a,b)=>a+b,0),p95FrameMs:sorted[Math.ceil(sorted.length*.95)-1],maxFrameMs:sorted.at(-1),environment:s.environment,phaseSamples:s.phaseSamples,errors:window.__renderProbe.errors}})()`);
  report.endHashes = hashes();
  report.passed = report.measurement.done && report.measurement.durationMs >= 180000 && report.measurement.errors.length === 0 && report.measurement.p95FrameMs <= 33.3 && JSON.stringify(report.startHashes) === JSON.stringify(report.endHashes);
  if (!report.passed) process.exitCode = 1;
} catch(error) { report.passed=false;report.failure=String(error);process.exitCode=1; }
finally { writeFileSync(output, JSON.stringify(report,null,2)+'\n');try{run('close')}catch{} }
