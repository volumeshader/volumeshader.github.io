(function () {
  'use strict';

  const host = document.getElementById('vs-tool');
  if (!host) return;

  const PRESETS = [
    { name: 'Simple', steps: 24, iterations: 4, scale: 0.45 },
    { name: 'Standard', steps: 40, iterations: 6, scale: 0.60 },
    { name: 'Advanced', steps: 64, iterations: 8, scale: 0.80 },
    { name: 'Extreme', steps: 128, iterations: 14, scale: 1.10 }
  ];
  const BENCHMARK_VERSION = '1.0';
  const MAX_PIXELS = 2200000;
  const HISTORY_KEY = 'volumeShaderBM.history.v1';

  host.innerHTML = `
    <div class="tool" id="vs-tool-frame">
      <canvas id="vs-canvas" aria-label="Interactive Volume Shader benchmark visualization"></canvas>
      <div class="canvas-overlay" id="vs-overlay">
        <h3>Ready to test your GPU</h3>
        <p>Pick a complexity level and run the benchmark. The benchmark camera is fixed while measuring so every run uses the same view.</p>
        <button type="button" class="btn-primary" id="vs-overlay-start">Start benchmark</button>
      </div>
      <div class="hud" id="vs-hud" hidden>
        <div class="hud-fps"><span id="vs-fps">0</span><small>FPS</small></div>
        <div class="chips">
          <span class="chip">AVG <b id="vs-avg">-</b></span>
          <span class="chip">1% LOW <b id="vs-low">-</b></span>
          <span class="chip">MIN <b id="vs-min">-</b></span>
          <span class="chip">STABLE <b id="vs-stable">-</b>%</span>
        </div>
      </div>
      <div class="tool-buttons">
        <button type="button" id="vs-pause" aria-label="Pause or resume benchmark">❚❚</button>
        <button type="button" id="vs-fullscreen" aria-label="Fullscreen">⛶</button>
      </div>
    </div>
    <div class="tool-controls">
      <span class="control-label">Complexity</span>
      <div class="preset-group" role="group" aria-label="Complexity">
        <button type="button" data-preset="0">Simple</button>
        <button type="button" data-preset="1" aria-pressed="true">Standard ★</button>
        <button type="button" data-preset="2">Advanced</button>
        <button type="button" data-preset="3">Extreme</button>
      </div>
      <span class="control-label">Run for</span>
      <select class="duration" id="vs-duration" aria-label="Benchmark duration">
        <option value="0">Until I stop</option>
        <option value="30" selected>30 seconds</option>
        <option value="180">3 minutes</option>
      </select>
      <button type="button" class="btn-primary run-btn" id="vs-run">Run benchmark</button>
      <button type="button" id="vs-share">Share</button>
    </div>
    <p class="tool-note" id="vs-status"><strong>Shader benchmark, not a gaming benchmark.</strong> ★ Recommended. Heavy workloads can make laptops and phones hot.</p>
    <p class="tool-note" id="vs-gpu"></p>
  `;

  const $ = (id) => document.getElementById(id);
  const frame = $('vs-tool-frame');
  const canvas = $('vs-canvas');
  const overlay = $('vs-overlay');
  const hud = $('vs-hud');
  const status = $('vs-status');
  const gpuLine = $('vs-gpu');
  const runButton = $('vs-run');
  const duration = $('vs-duration');
  const presetButtons = Array.from(host.querySelectorAll('[data-preset]'));

  function esc(value) {
    return String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  const query = new URLSearchParams(location.search);
  let presetIndex = Math.max(0, Math.min(3, Number(query.get('m') || 1)));
  const queryDuration = Number(query.get('d'));
  if ([0, 30, 180].includes(queryDuration)) duration.value = String(queryDuration);

  const gl = canvas.getContext('webgl2', { antialias: false, powerPreference: 'high-performance' }) ||
             canvas.getContext('webgl', { antialias: false, powerPreference: 'high-performance' });

  if (!gl) {
    overlay.innerHTML = `<h3>WebGL not supported</h3><p>Try Chrome, Firefox, Safari or Edge, and make sure hardware acceleration is enabled.</p><a class="btn-secondary" href="webgl-benchmark.html">Read the WebGL guide</a>`;
    status.textContent = 'This browser could not create a WebGL graphics context.';
    return;
  }

  const isWebGL2 = !!(window.WebGL2RenderingContext && gl instanceof WebGL2RenderingContext);
  const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
  const renderer = debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : 'GPU name hidden by browser';
  const webglVersion = isWebGL2 ? 'WebGL2' : 'WebGL1';
  gpuLine.textContent = `${webglVersion} · GPU: ${renderer} · Screen ${screen.width}×${screen.height} @${(window.devicePixelRatio || 1).toFixed(2)}×`;

  const vertexSource = `attribute vec2 p; void main(){ gl_Position = vec4(p,0.0,1.0); }`;
  const fragmentPrecision = (gl.getShaderPrecisionFormat && gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT).precision > 0) ? 'highp' : 'mediump';
  const fragmentSource = `
    precision ${fragmentPrecision} float;
    uniform vec2 R;
    uniform vec3 O;
    uniform vec3 G;
    uniform int S;
    uniform int I;

    float mandelbulbDensity(vec3 p){
      vec3 z=p;
      float r=0.0;
      float iterCount=0.0;
      for(int i=0;i<16;i++){
        if(i>=I) break;
        r=length(z);
        if(r>2.0) break;
        float theta=acos(clamp(z.z/max(r,0.0001),-1.0,1.0))*8.0;
        float phi=atan(z.y,z.x)*8.0;
        float zr=pow(max(r,0.0001),8.0);
        z=zr*vec3(sin(theta)*cos(phi),sin(theta)*sin(phi),cos(theta))+p;
        iterCount+=1.0;
      }
      if(r>2.0){
        float m=(iterCount+1.0-log(max(log(r)/0.6931,0.0001))/2.0794)/float(I);
        return clamp(m,0.0,1.0);
      }
      return 1.0;
    }

    void main(){
      vec2 uv=(gl_FragCoord.xy*2.0-R)/R.y;
      vec3 forward=normalize(G-O);
      vec3 right=normalize(cross(forward,vec3(0.0,1.0,0.0)));
      vec3 up=cross(right,forward);
      vec3 rd=normalize(forward*1.60+right*uv.x+up*uv.y);
      vec3 bg=mix(vec3(0.025,0.018,0.08),vec3(0.09,0.03,0.16),0.5+0.5*uv.y);
      float b=dot(O,rd);
      float h=b*b-(dot(O,O)-2.4);
      vec3 col=vec3(0.0);
      float T=1.0;
      if(h>0.0){
        float span=sqrt(h);
        float t0=-b-span;
        float dt=2.0*span/float(S);
        float jitter=fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233)))*43758.5453);
        for(int i=0;i<160;i++){
          if(i>=S) break;
          vec3 samplePoint=O+rd*(t0+(float(i)+jitter)*dt);
          float d=mandelbulbDensity(samplePoint);
          float a=d*d*dt*5.0;
          vec3 palette=0.5+0.5*cos(6.28318*(d*0.9+vec3(0.02,0.16,0.32)));
          col+=T*(1.0-exp(-a))*palette*1.28;
          T*=exp(-a);
        }
      }
      gl_FragColor=vec4(col+T*bg,1.0);
    }
  `;

  function compile(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const msg = gl.getShaderInfoLog(shader) || 'Unknown shader compile error';
      gl.deleteShader(shader);
      throw new Error(msg);
    }
    return shader;
  }

  let program;
  try {
    program = gl.createProgram();
    gl.attachShader(program, compile(gl.VERTEX_SHADER, vertexSource));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragmentSource));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) || 'Program link failed');
    gl.useProgram(program);
  } catch (error) {
    overlay.innerHTML = `<h3>Shader could not start</h3><p>This GPU or browser rejected the benchmark shader. Try another current browser or enable hardware acceleration.</p>`;
    status.textContent = 'WebGL was available, but the benchmark shader could not be compiled.';
    return;
  }

  const position = gl.getAttribLocation(program, 'p');
  const uniforms = {
    resolution: gl.getUniformLocation(program, 'R'),
    origin: gl.getUniformLocation(program, 'O'),
    target: gl.getUniformLocation(program, 'G'),
    steps: gl.getUniformLocation(program, 'S'),
    iterations: gl.getUniformLocation(program, 'I')
  };
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 3,-1, -1,3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

  let yaw = 0.72, pitch = 0.35, distance = 2.4, target = [0,0,0];
  let paused = false, measuring = false, rafId = 0, lastTime = performance.now();
  let idle = true, hidden = false, slowFrames = 0, adaptive = false, endedMessage = '';
  let sampleTimes = [], measuredTimes = [], measureStart = 0, measureDuration = 0;
  let liveLastPaint = 0;

  function resetView() { yaw = 0.72; pitch = 0.35; distance = 2.4; target = [0,0,0]; }

  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2) * PRESETS[presetIndex].scale;
    let w = Math.max(2, rect.width * dpr);
    let h = Math.max(2, rect.height * dpr);
    const cap = Math.sqrt(Math.min(1, MAX_PIXELS / Math.max(1, w * h)));
    w = Math.max(2, Math.round(w * cap));
    h = Math.max(2, Math.round(h * cap));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w; canvas.height = h; gl.viewport(0,0,w,h);
    }
  }

  function draw() {
    resizeCanvas();
    const cp = Math.cos(pitch);
    gl.uniform2f(uniforms.resolution, canvas.width, canvas.height);
    gl.uniform3f(uniforms.origin,
      target[0] + distance*cp*Math.sin(yaw),
      target[1] + distance*Math.sin(pitch),
      target[2] + distance*cp*Math.cos(yaw));
    gl.uniform3f(uniforms.target, target[0], target[1], target[2]);
    gl.uniform1i(uniforms.steps, PRESETS[presetIndex].steps);
    gl.uniform1i(uniforms.iterations, PRESETS[presetIndex].iterations);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  function stats(times) {
    if (!times || times.length < 5) return null;
    const sorted = times.slice().sort((a,b) => a-b);
    const sum = times.reduce((a,b) => a+b, 0);
    const mean = sum / times.length;
    const k = Math.max(1, Math.ceil(times.length * 0.01));
    const worstMean = sorted.slice(-k).reduce((a,b) => a+b, 0) / k;
    let variance = 0;
    for (const t of times) variance += (t-mean)*(t-mean);
    variance /= times.length;
    const sd = Math.sqrt(variance);
    return {
      avg: 1000 / mean,
      low: 1000 / worstMean,
      min: 1000 / sorted[sorted.length - 1],
      max: 1000 / sorted[0],
      stability: Math.max(0, Math.min(100, Math.round(100 * (1 - sd / mean))))
    };
  }

  function setPreset(index) {
    presetIndex = Math.max(0, Math.min(3, Number(index)));
    presetButtons.forEach((button, i) => button.setAttribute('aria-pressed', i === presetIndex ? 'true' : 'false'));
    resizeCanvas();
    if (!measuring) draw();
    const p = PRESETS[presetIndex];
    if (presetIndex === 3) status.innerHTML = '<strong>Extreme is very heavy.</strong> Close other tabs first. The test can step down automatically if the device becomes too slow.';
    else status.innerHTML = '<strong>Shader benchmark, not a gaming benchmark.</strong> ★ Recommended. Heavy workloads can make laptops and phones hot.';
    try { localStorage.setItem('volumeShaderBM.lastPreset', String(presetIndex)); } catch (e) { /* storage may be blocked */ }
  }

  function setPause(value) {
    paused = value;
    lastTime = performance.now();
    $('vs-pause').textContent = paused ? '▶' : '❚❚';
    if (paused) draw();
  }

  function showOverlay(title, body, actionsHTML) {
    overlay.hidden = false;
    overlay.innerHTML = `<h3>${title}</h3><p>${body}</p>${actionsHTML || ''}`;
  }

  function scoreObject() {
    const s = stats(measuredTimes);
    if (!s || measuredTimes.length < 10) return null;
    const browser = (() => {
      const ua = navigator.userAgent;
      if (/Edg\//.test(ua)) return 'Edge';
      if (/OPR\//.test(ua)) return 'Opera';
      if (/Firefox\//.test(ua)) return 'Firefox';
      if (/Chrome\//.test(ua)) return 'Chrome';
      if (/Safari\//.test(ua)) return 'Safari';
      return 'Unknown';
    })();
    const os = (() => {
      const ua = navigator.userAgent;
      if (/Windows/.test(ua)) return 'Windows';
      if (/Android/.test(ua)) return 'Android';
      if (/iPhone|iPad/.test(ua)) return 'iOS';
      if (/Mac/.test(ua)) return 'macOS';
      if (/Linux/.test(ua)) return 'Linux';
      return 'Unknown';
    })();
    return {
      benchmarkVersion: BENCHMARK_VERSION,
      preset: PRESETS[presetIndex].name.toLowerCase(),
      rayMarchSteps: PRESETS[presetIndex].steps,
      fractalIterations: PRESETS[presetIndex].iterations,
      resolution: `${canvas.width}x${canvas.height}`,
      api: webglVersion.toLowerCase(),
      durationSeconds: +(measuredTimes.reduce((a,b)=>a+b,0)/1000).toFixed(1),
      warmupSeconds: 1,
      averageFps: +s.avg.toFixed(1),
      onePercentLowFps: +s.low.toFixed(1),
      minFps: +s.min.toFixed(1),
      maxFps: +s.max.toFixed(1),
      avgFrameTimeMs: +(measuredTimes.reduce((a,b)=>a+b,0)/measuredTimes.length).toFixed(2),
      stabilityPercent: s.stability,
      framesMeasured: measuredTimes.length,
      gpu: renderer,
      browser,
      os,
      adaptiveStepDown: adaptive
    };
  }

  function graphSvg(times) {
    if (times.length < 2) return '';
    const count = Math.min(140, times.length);
    const step = Math.max(1, Math.floor(times.length / count));
    const buckets = [];
    for (let i=0; i<times.length && buckets.length<count; i+=step) {
      const chunk = times.slice(i, Math.min(times.length, i+step));
      buckets.push(chunk.reduce((a,b)=>a+b,0)/chunk.length);
    }
    const max = Math.max(...buckets) * 1.15;
    const pts = buckets.map((v,i) => {
      const x = (i / Math.max(1,buckets.length-1)) * 1000;
      const y = 106 - (v / max) * 82;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
    const mean = buckets.reduce((a,b)=>a+b,0)/buckets.length;
    const yMean = 106 - (mean / max) * 82;
    return `<svg viewBox="0 0 1000 118" role="img" aria-label="Frame time over time"><polyline points="${pts}" fill="none" stroke="currentColor" stroke-width="3" vector-effect="non-scaling-stroke"/><line x1="0" y1="${yMean}" x2="1000" y2="${yMean}" stroke="currentColor" stroke-dasharray="7 7" opacity=".45"/><text x="10" y="16" fill="currentColor" opacity=".7" font-size="13">frame time · lower is better</text></svg>`;
  }

  function saveHistory(result) {
    try {
      const list = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
      list.unshift({ ...result, savedAt: new Date().toISOString() });
      localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, 30)));
    } catch (e) { /* localStorage may be blocked */ }
  }

  function finish() {
    if (!measuring) return;
    measuring = false;
    runButton.textContent = 'Run benchmark';
    hud.hidden = false;
    const result = scoreObject();
    if (!result) {
      showOverlay('Not enough frames measured', 'Run the test for longer before stopping it. 30 seconds is a good default.', '<button type="button" class="btn-primary" id="vs-close">Close</button>');
      $('vs-close').onclick = () => overlay.hidden = true;
      return;
    }
    saveHistory(result);
    const adaptiveNote = adaptive ? `<div class="callout"><strong>Adaptive step-down occurred.</strong> ${esc(endedMessage)}</div>` : '';
    showOverlay(`${result.averageFps} FPS`, `${PRESETS[presetIndex].name} · ${result.resolution} · ${webglVersion} · Benchmark v${BENCHMARK_VERSION}`, `
      <div style="width:100%;max-width:760px">
        <div class="metric-grid">
          <div class="metric"><b>${result.onePercentLowFps}</b><span>1% low FPS</span></div>
          <div class="metric"><b>${result.minFps}</b><span>Minimum FPS</span></div>
          <div class="metric"><b>${result.maxFps}</b><span>Maximum FPS</span></div>
          <div class="metric"><b>${result.avgFrameTimeMs} ms</b><span>Average frame time</span></div>
          <div class="metric"><b>${result.stabilityPercent}%</b><span>Stability</span></div>
          <div class="metric"><b>${result.framesMeasured}</b><span>Frames measured</span></div>
        </div>
        <div style="border:1px solid var(--line);border-radius:14px;padding:12px;color:var(--teal)">${graphSvg(measuredTimes)}</div>
        ${adaptiveNote}
        <p class="disclosure">GPU: ${esc(renderer)} · ${esc(result.browser)} on ${esc(result.os)} · ${result.rayMarchSteps} steps · ${result.fractalIterations} iterations · ${result.durationSeconds}s measured after 1s warm-up.</p>
        <div class="hero-actions" style="justify-content:center">
          <button type="button" id="vs-download">Download JSON</button>
          <button type="button" id="vs-copy-result">Copy result</button>
          <button type="button" id="vs-copy-link">Copy test link</button>
          <button type="button" id="vs-close">Close</button>
        </div>
      </div>`);

    $('vs-download').onclick = () => {
      const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'volumeshader-result.json'; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    };
    $('vs-copy-result').onclick = async () => {
      const text = `${result.averageFps} FPS | ${PRESETS[presetIndex].name} | ${result.resolution} | ${webglVersion} | Benchmark v${BENCHMARK_VERSION} | 1% low ${result.onePercentLowFps} | stability ${result.stabilityPercent}% | ${renderer}`;
      try { await navigator.clipboard.writeText(text); $('vs-copy-result').textContent = 'Copied'; } catch(e) { window.prompt('Copy result', text); }
    };
    $('vs-copy-link').onclick = async () => {
      try { await navigator.clipboard.writeText(location.href.split('#')[0] + '#test'); $('vs-copy-link').textContent = 'Copied'; } catch(e) {}
    };
    $('vs-close').onclick = () => { overlay.hidden = true; };
  }

  function begin() {
    resetView();
    sampleTimes = [];
    measuredTimes = [];
    slowFrames = 0;
    adaptive = false;
    endedMessage = '';
    measureStart = performance.now();
    measureDuration = Number(duration.value || 0);
    measuring = true;
    idle = false;
    paused = false;
    overlay.hidden = true;
    hud.hidden = false;
    runButton.textContent = 'Stop and see result';
    lastTime = performance.now();
    status.innerHTML = `<strong>Benchmark running.</strong> Camera is fixed and input is disabled for a repeatable result.`;
  }

  function cancel(message) {
    if (!measuring) return;
    measuring = false;
    runButton.textContent = 'Run benchmark';
    showOverlay('Run stopped', message, '<button type="button" class="btn-primary" id="vs-close">Close</button>');
    $('vs-close').onclick = () => overlay.hidden = true;
  }

  function lowerPreset() {
    if (presetIndex <= 0) return;
    adaptive = true;
    endedMessage = `The device was too slow for ${PRESETS[presetIndex].name}; the run ended early and the preset was lowered to ${PRESETS[presetIndex-1].name}. Adaptive results should not be compared with fixed-preset results.`;
    finish();
    setPreset(presetIndex - 1);
  }

  function tick(now) {
    rafId = requestAnimationFrame(tick);
    const delta = now - lastTime;
    lastTime = now;
    if (paused) return;
    if (document.hidden || hidden) {
      if (measuring) cancel('The run was cancelled because the tab was hidden. Keep the test tab visible and run it again.');
      return;
    }
    if (delta > 1500 && delta < 30000 && presetIndex > 0) slowFrames += 1; else slowFrames = 0;
    if (slowFrames >= 2 && measuring) { slowFrames = 0; lowerPreset(); return; }
    if (delta > 0 && delta < 1000) {
      sampleTimes.push(delta);
      if (sampleTimes.length > 4096) sampleTimes.shift();
      if (measuring && now - measureStart >= 1000) measuredTimes.push(delta);
    }
    if (idle && !measuring) { yaw += delta * 0.00022; }
    draw();

    if (now - liveLastPaint > 450) {
      liveLastPaint = now;
      const s = stats(sampleTimes);
      $('vs-fps').textContent = sampleTimes.length ? Math.round(1000 * sampleTimes.length / sampleTimes.reduce((a,b)=>a+b,0)) : '0';
      if (s) {
        $('vs-avg').textContent = s.avg.toFixed(1);
        $('vs-low').textContent = s.low.toFixed(1);
        $('vs-min').textContent = s.min.toFixed(1);
        $('vs-stable').textContent = s.stability;
      }
    }
    if (measuring && measureDuration && now - measureStart >= (measureDuration + 1) * 1000) finish();
  }

  const pointers = {};
  function pan(dx, dy) {
    const k = distance * 0.0022;
    target[0] += (-Math.cos(yaw) * dx) * k;
    target[2] += (Math.sin(yaw) * dx) * k;
    target[1] += dy * k;
  }
  canvas.oncontextmenu = e => e.preventDefault();
  canvas.addEventListener('pointerdown', e => {
    if (measuring) return;
    idle = false;
    canvas.setPointerCapture(e.pointerId);
    pointers[e.pointerId] = { x:e.clientX, y:e.clientY, button:e.button };
  });
  canvas.addEventListener('pointerup', e => delete pointers[e.pointerId]);
  canvas.addEventListener('pointercancel', e => delete pointers[e.pointerId]);
  canvas.addEventListener('pointermove', e => {
    const p = pointers[e.pointerId]; if (!p) return;
    const ids = Object.keys(pointers); const dx = e.clientX - p.x, dy = e.clientY - p.y;
    if (ids.length === 1) {
      if (p.button === 2 || e.shiftKey) pan(dx,dy);
      else { yaw -= dx * 0.006; pitch = Math.max(-1.45, Math.min(1.45, pitch + dy * 0.006)); }
    } else {
      const otherId = ids.find(id => Number(id) !== e.pointerId);
      const q = pointers[otherId];
      if (q) {
        const oldDist = Math.hypot(p.x-q.x,p.y-q.y), newDist = Math.hypot(e.clientX-q.x,e.clientY-q.y);
        if (newDist > 0) distance = Math.max(1.5, Math.min(8, distance * oldDist / newDist));
        pan(dx/2, dy/2);
      }
    }
    p.x = e.clientX; p.y = e.clientY; draw();
  });
  canvas.addEventListener('wheel', e => {
    e.preventDefault(); if (measuring) return;
    distance = Math.max(1.5, Math.min(8, distance * Math.exp(e.deltaY * 0.001)));
    draw();
  }, { passive:false });

  $('vs-run').onclick = () => measuring ? finish() : begin();
  $('vs-overlay-start').onclick = begin;
  $('vs-pause').onclick = () => setPause(!paused);
  $('vs-fullscreen').onclick = () => {
    const active = document.fullscreenElement || document.webkitFullscreenElement;
    if (active) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    else (frame.requestFullscreen || frame.webkitRequestFullscreen).call(frame);
  };
  $('vs-share').onclick = async () => {
    const url = location.href.split('#')[0] + '#test';
    if (navigator.share) { try { await navigator.share({ title: document.title, url }); } catch(e){} }
    else { try { await navigator.clipboard.writeText(url); $('vs-share').textContent = 'Link copied'; setTimeout(()=> $('vs-share').textContent='Share',1600); } catch(e) { window.prompt('Copy test link', url); } }
  };
  presetButtons.forEach(btn => btn.onclick = () => { if (!measuring) setPreset(Number(btn.dataset.preset)); });
  window.addEventListener('resize', () => { if (!measuring) draw(); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { hidden = false; lastTime = performance.now(); } else hidden = true; });
  canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); if (measuring) measuring=false; showOverlay('Graphics context lost', 'The browser reset the WebGL context. Reload the page before running again.', '<button type="button" class="btn-primary" id="vs-reload">Reload</button>'); $('vs-reload').onclick=()=>location.reload(); });

  document.addEventListener('keydown', e => {
    if (e.key === 'p' || e.key === 'P') { e.preventDefault(); setPause(!paused); }
    if (e.key === ' ' && e.target === document.body) { e.preventDefault(); if (!measuring) { resetView(); idle=true; draw(); } }
  });

  resetView();
  try {
    if (localStorage.getItem('volumeShaderBM.lastPreset') !== null && !query.has('m')) {
      const saved = Number(localStorage.getItem('volumeShaderBM.lastPreset'));
      if ([0,1,2,3].includes(saved)) presetIndex = saved;
    }
  } catch (e) { /* storage may be blocked */ }
  setPreset(presetIndex);
  hud.hidden = false;
  overlay.hidden = false;
  draw();
  rafId = requestAnimationFrame(tick);
  window.VolumeShaderBM = {
    getHistory: () => { try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); } catch (e) { return []; } },
    clearHistory: () => { try { localStorage.removeItem(HISTORY_KEY); } catch (e) {} }
  };
})();
