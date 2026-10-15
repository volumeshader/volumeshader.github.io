/**
 * VolumeShader HUD & Controller Logic
 */

(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('shader-canvas');
    if (!canvas) return;

    // HUD Elements
    const fpsVal = document.getElementById('hud-fps');
    const frametimeVal = document.getElementById('hud-frametime');
    const avgFpsVal = document.getElementById('hud-avg-fps');
    const low1PctVal = document.getElementById('hud-low-fps');
    const gpuRendererTag = document.getElementById('hud-gpu-renderer');
    const graphCanvas = document.getElementById('perf-graph');
    const graphCtx = graphCanvas ? graphCanvas.getContext('2d') : null;

    // Buttons & Controls
    const btnBenchmark = document.getElementById('btn-benchmark');
    const btnStress = document.getElementById('btn-stress');
    const btnAutoRotate = document.getElementById('btn-autorotate');
    const btnResetCam = document.getElementById('btn-reset-cam');
    const selectRes = document.getElementById('select-resolution');
    const selectPreset = document.getElementById('select-preset');

    // Scorecard Elements
    const scorecardBanner = document.getElementById('scorecard-banner');
    const scoreVal = document.getElementById('sc-score');
    const tierVal = document.getElementById('sc-tier');
    const scAvgFps = document.getElementById('sc-avg-fps');
    const scLowFps = document.getElementById('sc-low-fps');
    const scGpu = document.getElementById('sc-gpu');
    const scRes = document.getElementById('sc-res');
    const btnCopyScore = document.getElementById('btn-copy-score');
    const btnExportCard = document.getElementById('btn-export-card');

    let currentResults = null;

    // Initialize Engine
    const initialRes = selectRes ? parseInt(selectRes.value, 10) : 1024;
    const engine = new window.VolumeShaderEngine(canvas, {
      resolution: initialRes,
      autoRotate: true,
      onFrameStats: (stats) => {
        if (fpsVal) fpsVal.textContent = stats.fps;
        if (frametimeVal) frametimeVal.textContent = stats.frameTimeMs + ' ms';
        if (avgFpsVal) avgFpsVal.textContent = stats.avgFps;
        if (low1PctVal) low1PctVal.textContent = stats.low1PctFps;

        // Update Benchmark Button Progress if active
        if (stats.benchmarkMode && btnBenchmark) {
          btnBenchmark.textContent = `Benchmarking... ${stats.benchmarkProgress}%`;
          btnBenchmark.classList.add('btn-primary');
        }

        // Draw Graph
        if (graphCtx && stats.history) {
          drawPerfGraph(graphCtx, graphCanvas, stats.history);
        }
      },
      onBenchmarkComplete: (results) => {
        currentResults = results;
        if (btnBenchmark) {
          btnBenchmark.textContent = 'Run 20s Benchmark';
        }
        displayScorecard(results);
      }
    });

    // Populate Detected Hardware
    if (gpuRendererTag && engine.gpuInfo) {
      gpuRendererTag.textContent = `${engine.gpuInfo.renderer} (${engine.gpuInfo.webglVersion})`;
    }

    // Resolution Change
    if (selectRes) {
      selectRes.addEventListener('change', (e) => {
        const res = parseInt(e.target.value, 10);
        engine.setResolution(res);
      });
    }

    // Benchmark Run
    if (btnBenchmark) {
      btnBenchmark.addEventListener('click', () => {
        if (scorecardBanner) scorecardBanner.style.display = 'none';
        engine.startTimedBenchmark(20000);
      });
    }

    // Auto-Rotate Toggle
    if (btnAutoRotate) {
      btnAutoRotate.addEventListener('click', () => {
        engine.options.autoRotate = !engine.options.autoRotate;
        btnAutoRotate.textContent = engine.options.autoRotate ? 'Auto-Rotate: ON' : 'Auto-Rotate: OFF';
      });
    }

    // Reset Camera
    if (btnResetCam) {
      btnResetCam.addEventListener('click', () => {
        engine.len = 1.6;
        engine.ang1 = 2.8;
        engine.ang2 = 0.4;
        engine.cenx = 0;
        engine.ceny = 0;
        engine.cenz = 0;
      });
    }

    // Preset Selection (if present on Shader Lab or Homepage)
    if (selectPreset) {
      selectPreset.addEventListener('change', (e) => {
        const preset = e.target.value;
        let code = window.MANDELBULB_KERNEL;
        if (preset === 'julia') {
          code = `
            float kernal(vec3 ver) {
              vec3 a = ver;
              float b;
              for(int i=0; i<6; i++) {
                b = length(a);
                a = vec3(a.x*a.x - a.y*a.y - a.z*a.z, 2.0*a.x*a.y, 2.0*a.x*a.z) + vec3(-0.4, 0.6, 0.1);
                if(b > 4.0) break;
              }
              return 2.5 - dot(a, a);
            }
          `;
        } else if (preset === 'torus') {
          code = `
            float kernal(vec3 ver) {
              vec2 q = vec2(length(ver.xz) - 1.2, ver.y);
              float d = length(q) - 0.45;
              return -d * 4.0;
            }
          `;
        } else if (preset === 'cosine') {
          code = `
            float kernal(vec3 ver) {
              float d = length(ver) - 1.0 + 0.2 * (sin(ver.x * 6.0) * cos(ver.y * 6.0) * sin(ver.z * 6.0));
              return -d * 3.5;
            }
          `;
        }
        engine.buildProgram(code);
      });
    }

    function displayScorecard(results) {
      if (!scorecardBanner) return;
      scorecardBanner.style.display = 'block';
      if (scoreVal) scoreVal.textContent = results.score;
      if (tierVal) {
        tierVal.textContent = `Tier ${results.tier}`;
        tierVal.className = 'metric-value ' + (results.tier === 'S' || results.tier === 'A' ? 'highlight-emerald' : (results.tier === 'B' ? 'highlight-amber' : 'highlight-rose'));
      }
      if (scAvgFps) scAvgFps.textContent = `${results.avgFps} FPS`;
      if (scLowFps) scLowFps.textContent = `${results.low1PctFps} FPS`;
      if (scGpu) scGpu.textContent = results.gpuRenderer;
      if (scRes) scRes.textContent = `${results.resolution}x${results.resolution}`;

      scorecardBanner.scrollIntoView({ behavior: 'smooth' });
    }

    // Copy Results
    if (btnCopyScore) {
      btnCopyScore.addEventListener('click', () => {
        if (!currentResults) return;
        const text = `VolumeShader BM Benchmark Score: ${currentResults.score} (Tier ${currentResults.tier})\nAverage FPS: ${currentResults.avgFps} | 1% Low: ${currentResults.low1PctFps} FPS\nResolution: ${currentResults.resolution}p | GPU: ${currentResults.gpuRenderer}\nTested via https://volumeshader.github.io/`;
        navigator.clipboard.writeText(text).then(() => {
          btnCopyScore.textContent = 'Copied to Clipboard!';
          setTimeout(() => { btnCopyScore.textContent = 'Copy Score Summary'; }, 2000);
        });
      });
    }

    // Export PNG Card
    if (btnExportCard) {
      btnExportCard.addEventListener('click', () => {
        if (!currentResults) return;
        exportScorecardImage(currentResults);
      });
    }

    // Live Graph Renderer
    function drawPerfGraph(ctx, gCanvas, history) {
      const w = gCanvas.width = gCanvas.clientWidth * window.devicePixelRatio;
      const h = gCanvas.height = gCanvas.clientHeight * window.devicePixelRatio;
      ctx.clearRect(0, 0, w, h);

      // Draw Grid Lines (16.6ms = 60fps, 33.3ms = 30fps)
      const maxMs = 50.0;
      const y60 = h - (16.66 / maxMs) * h;
      const y30 = h - (33.33 / maxMs) * h;

      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(16, 185, 129, 0.35)'; // 60 FPS line
      ctx.beginPath();
      ctx.moveTo(0, y60);
      ctx.lineTo(w, y60);
      ctx.stroke();

      ctx.strokeStyle = 'rgba(245, 158, 11, 0.35)'; // 30 FPS line
      ctx.beginPath();
      ctx.moveTo(0, y30);
      ctx.lineTo(w, y30);
      ctx.stroke();

      // Draw Frametime History Waveform
      if (history.length < 2) return;
      ctx.lineWidth = 2 * window.devicePixelRatio;
      ctx.strokeStyle = '#00f0ff';
      ctx.beginPath();

      const step = w / (engine.historyLimit - 1);
      history.forEach((ms, idx) => {
        const x = idx * step;
        const clampedMs = Math.min(ms, maxMs);
        const y = h - (clampedMs / maxMs) * h;
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    }

    // Export Shareable Image
    function exportScorecardImage(res) {
      const expCanvas = document.createElement('canvas');
      expCanvas.width = 1200;
      expCanvas.height = 630;
      const ctx = expCanvas.getContext('2d');

      // Background
      const bgGrad = ctx.createLinearGradient(0, 0, 1200, 630);
      bgGrad.addColorStop(0, '#0b0c10');
      bgGrad.addColorStop(1, '#151924');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, 1200, 630);

      // Border glow
      ctx.strokeStyle = '#00f0ff';
      ctx.lineWidth = 6;
      ctx.strokeRect(20, 20, 1160, 590);

      // Header
      ctx.fillStyle = '#00f0ff';
      ctx.font = 'bold 36px monospace';
      ctx.fillText('VOLUMESHADER_BM // GPU BENCHMARK CARD', 60, 90);

      ctx.fillStyle = '#9aa5be';
      ctx.font = '24px sans-serif';
      ctx.fillText('Web-Based WebGL Volumetric Raymarching Performance Test', 60, 130);

      // Score Big Block
      ctx.fillStyle = '#1b1e28';
      ctx.fillRect(60, 170, 480, 240);
      ctx.strokeStyle = '#272d3e';
      ctx.lineWidth = 2;
      ctx.strokeRect(60, 170, 480, 240);

      ctx.fillStyle = '#65708a';
      ctx.font = '20px monospace';
      ctx.fillText('BENCHMARK SCORE', 90, 220);

      ctx.fillStyle = '#00f0ff';
      ctx.font = 'bold 96px monospace';
      ctx.fillText(res.score.toString(), 90, 320);

      ctx.fillStyle = res.tier === 'S' || res.tier === 'A' ? '#10b981' : '#f59e0b';
      ctx.font = 'bold 40px sans-serif';
      ctx.fillText(`TIER ${res.tier}`, 90, 380);

      // Metrics Block
      ctx.fillStyle = '#f0f3fa';
      ctx.font = 'bold 28px monospace';
      ctx.fillText(`AVERAGE FPS: ${res.avgFps} FPS`, 580, 220);
      ctx.fillText(`1% LOW FPS:  ${res.low1PctFps} FPS`, 580, 270);
      ctx.fillText(`RESOLUTION:  ${res.resolution}x${res.resolution}`, 580, 320);
      ctx.font = '22px monospace';
      ctx.fillStyle = '#9aa5be';
      ctx.fillText(`GPU: ${res.gpuRenderer}`, 580, 370);

      // Footer
      ctx.fillStyle = '#65708a';
      ctx.font = '20px sans-serif';
      ctx.fillText(`Verified on ${new Date().toLocaleDateString()} via https://volumeshader.github.io/`, 60, 560);

      // Download
      const link = document.createElement('a');
      link.download = `VolumeShader_Score_${res.score}_${res.tier}.png`;
      link.href = expCanvas.toDataURL('image/png');
      link.click();
    }
  });
})();
