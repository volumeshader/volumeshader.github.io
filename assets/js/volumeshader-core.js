/**
 * VolumeShader Core Engine (v2.0)
 * High-performance WebGL Volumetric Raymarching Benchmark & Diagnostics
 * Inspired by cznull.github.io/vsbm
 */

(function (window) {
  'use strict';

  // Shader Sources
  const VSHADER_SOURCE = `
    #version 100
    precision highp float;
    attribute vec4 position;
    varying vec3 dir, localdir;
    uniform vec3 right, forward, up, origin;
    uniform float x, y;
    void main() {
      gl_Position = position;
      dir = forward + right * position.x * x + up * position.y * y;
      localdir.x = position.x * x;
      localdir.y = position.y * y;
      localdir.z = -1.0;
    }
  `;

  // Default Mandelbulb Raymarching Fragment Shader (Authentic cznull vsbm kernel)
  const MANDELBULB_KERNEL = `
    float kernal(vec3 ver) {
      vec3 a = ver;
      float b, c, d, e;
      for (int i = 0; i < 5; i++) {
        b = length(a);
        c = atan(a.y, a.x) * 8.0;
        e = 1.0 / b;
        d = acos(a.z / b) * 8.0;
        b = pow(b, 8.0);
        a = vec3(b * sin(d) * cos(c), b * sin(d) * sin(c), b * cos(d)) + ver;
        if (b > 6.0) {
          break;
        }
      }
      return 4.0 - a.x * a.x - a.y * a.y - a.z * a.z;
    }
  `;

  const FSHADER_PREAMBLE = `
    #version 100
    #define PI 3.14159265358979324
    #define M_L 0.3819660113
    #define M_R 0.6180339887
    #define MAXR 8
    #define SOLVER 8
    precision highp float;
    float kernal(vec3 ver);
    uniform vec3 right, forward, up, origin;
    varying vec3 dir, localdir;
    uniform float len;
    vec3 ver;
    int sign;
    float v, v1, v2;
    float r1, r2, r3, r4, m1, m2, m3, m4;
    vec3 n, reflect;
    const float step = 0.002;
    vec3 color;
    void main() {
      color.r = 0.0;
      color.g = 0.0;
      color.b = 0.0;
      sign = 0;
      v1 = kernal(origin + dir * (step * len));
      v2 = kernal(origin);
      for (int k = 2; k < 1002; k++) {
        ver = origin + dir * (step * len * float(k));
        v = kernal(ver);
        if (v > 0.0 && v1 < 0.0) {
          r1 = step * len * float(k - 1);
          r2 = step * len * float(k);
          m1 = kernal(origin + dir * r1);
          m2 = kernal(origin + dir * r2);
          for (int l = 0; l < SOLVER; l++) {
            r3 = r1 * 0.5 + r2 * 0.5;
            m3 = kernal(origin + dir * r3);
            if (m3 > 0.0) {
              r2 = r3;
              m2 = m3;
            } else {
              r1 = r3;
              m1 = m3;
            }
          }
          if (r3 < 2.0 * len) {
            sign = 1;
            break;
          }
        }
        if (v < v1 && v1 > v2 && v1 < 0.0 && (v1 * 2.0 > v || v1 * 2.0 > v2)) {
          r1 = step * len * float(k - 2);
          r2 = step * len * (float(k) - 2.0 + 2.0 * M_L);
          r3 = step * len * (float(k) - 2.0 + 2.0 * M_R);
          r4 = step * len * float(k);
          m2 = kernal(origin + dir * r2);
          m3 = kernal(origin + dir * r3);
          for (int l = 0; l < MAXR; l++) {
            if (m2 > m3) {
              r4 = r3;
              r3 = r2;
              r2 = r4 * M_L + r1 * M_R;
              m3 = m2;
              m2 = kernal(origin + dir * r2);
            } else {
              r1 = r2;
              r2 = r3;
              r3 = r4 * M_R + r1 * M_L;
              m2 = m3;
              m3 = kernal(origin + dir * r3);
            }
          }
          if (m2 > 0.0) {
            r1 = step * len * float(k - 2);
            m1 = kernal(origin + dir * r1);
            m2 = kernal(origin + dir * r2);
            for (int l = 0; l < SOLVER; l++) {
              r3 = r1 * 0.5 + r2 * 0.5;
              m3 = kernal(origin + dir * r3);
              if (m3 > 0.0) {
                r2 = r3;
                m2 = m3;
              } else {
                r1 = r3;
                m1 = m3;
              }
            }
            if (r3 < 2.0 * len && r3 > step * len) {
              sign = 1;
              break;
            }
          } else if (m3 > 0.0) {
            r1 = step * len * float(k - 2);
            r2 = r3;
            m1 = kernal(origin + dir * r1);
            m2 = kernal(origin + dir * r2);
            for (int l = 0; l < SOLVER; l++) {
              r3 = r1 * 0.5 + r2 * 0.5;
              m3 = kernal(origin + dir * r3);
              if (m3 > 0.0) {
                r2 = r3;
                m2 = m3;
              } else {
                r1 = r3;
                m1 = m3;
              }
            }
            if (r3 < 2.0 * len && r3 > step * len) {
              sign = 1;
              break;
            }
          }
        }
        v2 = v1;
        v1 = v;
      }
      if (sign == 1) {
        ver = origin + dir * r3;
        r1 = ver.x * ver.x + ver.y * ver.y + ver.z * ver.z;
        n.x = kernal(ver - right * (r3 * 0.00025)) - kernal(ver + right * (r3 * 0.00025));
        n.y = kernal(ver - up * (r3 * 0.00025)) - kernal(ver + up * (r3 * 0.00025));
        n.z = kernal(ver + forward * (r3 * 0.00025)) - kernal(ver - forward * (r3 * 0.00025));
        r3 = n.x * n.x + n.y * n.y + n.z * n.z;
        n = n * (1.0 / sqrt(r3));
        ver = localdir;
        r3 = ver.x * ver.x + ver.y * ver.y + ver.z * ver.z;
        ver = ver * (1.0 / sqrt(r3));
        reflect = n * (-2.0 * dot(ver, n)) + ver;
        r3 = reflect.x * 0.276 + reflect.y * 0.920 + reflect.z * 0.276;
        r4 = n.x * 0.276 + n.y * 0.920 + n.z * 0.276;
        r3 = max(0.0, r3);
        r3 = r3 * r3 * r3 * r3;
        r3 = r3 * 0.45 + r4 * 0.25 + 0.3;
        n.x = sin(r1 * 10.0) * 0.5 + 0.5;
        n.y = sin(r1 * 10.0 + 2.05) * 0.5 + 0.5;
        n.z = sin(r1 * 10.0 - 2.05) * 0.5 + 0.5;
        color = n * r3;
      }
      gl_FragColor = vec4(color.x, color.y, color.z, 1.0);
    }
  `;

  class VolumeShaderEngine {
    constructor(canvas, options = {}) {
      this.canvas = canvas;
      this.options = Object.assign({
        resolution: 1024,
        autoRotate: true,
        onFrameStats: null,
        onBenchmarkComplete: null
      }, options);

      this.gl = null;
      this.shaderProgram = null;
      this.kernelCode = MANDELBULB_KERNEL;
      this.running = false;
      this.animFrameId = null;

      // Camera State
      this.len = 1.6;
      this.ang1 = 2.8;
      this.ang2 = 0.4;
      this.cenx = 0.0;
      this.ceny = 0.0;
      this.cenz = 0.0;
      this.autoRotateSpeed = 0.01;

      // Mouse/Touch State
      this.isMouseDown = false;
      this.mouseButton = 0;
      this.lastMouseX = 0;
      this.lastMouseY = 0;
      this.touchDistance = 0;

      // Benchmark & Metrics
      this.fps = 0;
      this.frameTimeMs = 0;
      this.minFps = Infinity;
      this.maxFps = 0;
      this.avgFps = 0;
      this.low1PctFps = 0;
      this.frameCount = 0;
      this.totalFrames = 0;
      this.totalFrameTimeSum = 0;
      this.frameTimesHistory = [];
      this.historyLimit = 120; // 120 samples for live graph
      this.lastFpsUpdate = performance.now();
      this.lastFrameTimestamp = performance.now();

      // Timed Benchmark Mode
      this.benchmarkMode = false;
      this.benchmarkDurationMs = 20000;
      this.benchmarkStartTime = 0;
      this.warmupDurationMs = 2000; // 2s warmup discarded
      this.benchmarkSamples = [];

      // GPU & Hardware Telemetry
      this.gpuInfo = {
        vendor: 'Unknown Vendor',
        renderer: 'Unknown GPU',
        webglVersion: 'WebGL 1.0',
        supported: false
      };

      this.init();
    }

    init() {
      // 1. Initialize WebGL Context
      const gl = this.canvas.getContext('webgl', { powerPreference: 'high-performance', antialias: false }) ||
                 this.canvas.getContext('experimental-webgl');
      if (!gl) {
        console.error('WebGL is not supported on this browser/device.');
        return false;
      }
      this.gl = gl;

      // 2. Query Unmasked GPU Renderer
      this.detectHardware();

      // 3. Set Resolution Buffer
      this.setResolution(this.options.resolution);

      // 4. Compile Shader Pipeline
      this.buildProgram(this.kernelCode);

      // 5. Quad Geometry Buffer
      const positions = [
        -1.0, -1.0, 0.0,
         1.0, -1.0, 0.0,
         1.0,  1.0, 0.0,
        -1.0, -1.0, 0.0,
         1.0,  1.0, 0.0,
        -1.0,  1.0, 0.0
      ];
      this.posBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this.posBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

      // 6. Bind Gestures & Listeners
      this.bindEvents();

      this.running = true;
      this.lastFrameTimestamp = performance.now();
      this.loop = this.loop.bind(this);
      this.animFrameId = requestAnimationFrame(this.loop);
      return true;
    }

    detectHardware() {
      const gl = this.gl;
      if (!gl) return;
      this.gpuInfo.supported = true;
      this.gpuInfo.webglVersion = gl.getParameter(gl.VERSION);

      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      if (ext) {
        this.gpuInfo.vendor = gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) || 'Generic Vendor';
        this.gpuInfo.renderer = gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || 'Generic GPU';
      } else {
        this.gpuInfo.vendor = gl.getParameter(gl.VENDOR);
        this.gpuInfo.renderer = gl.getParameter(gl.RENDERER);
      }
    }

    buildProgram(kernel) {
      const gl = this.gl;
      const vShader = gl.createShader(gl.VERTEX_SHADER);
      gl.shaderSource(vShader, VSHADER_SOURCE);
      gl.compileShader(vShader);
      if (!gl.getShaderParameter(vShader, gl.COMPILE_STATUS)) {
        console.error('Vertex shader compile error:', gl.getShaderInfoLog(vShader));
        return false;
      }

      const fShader = gl.createShader(gl.FRAGMENT_SHADER);
      const fullFragSource = FSHADER_PREAMBLE + '\n' + kernel;
      gl.shaderSource(fShader, fullFragSource);
      gl.compileShader(fShader);
      if (!gl.getShaderParameter(fShader, gl.COMPILE_STATUS)) {
        const error = gl.getShaderInfoLog(fShader);
        console.error('Fragment shader compile error:', error);
        return { success: false, error: error };
      }

      const program = gl.createProgram();
      gl.attachShader(program, vShader);
      gl.attachShader(program, fShader);
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        const error = gl.getProgramInfoLog(program);
        console.error('Shader linking error:', error);
        return { success: false, error: error };
      }

      if (this.shaderProgram) {
        gl.deleteProgram(this.shaderProgram);
      }
      this.shaderProgram = program;
      gl.useProgram(program);

      // Locate Uniforms & Attributes
      this.locPosition = gl.getAttribLocation(program, 'position');
      this.locRight = gl.getUniformLocation(program, 'right');
      this.locForward = gl.getUniformLocation(program, 'forward');
      this.locUp = gl.getUniformLocation(program, 'up');
      this.locOrigin = gl.getUniformLocation(program, 'origin');
      this.locX = gl.getUniformLocation(program, 'x');
      this.locY = gl.getUniformLocation(program, 'y');
      this.locLen = gl.getUniformLocation(program, 'len');

      this.kernelCode = kernel;
      return { success: true };
    }

    setResolution(res) {
      this.options.resolution = res;
      this.canvas.width = res;
      this.canvas.height = res;
      if (this.gl) {
        this.gl.viewport(0, 0, res, res);
      }
    }

    bindEvents() {
      const c = this.canvas;

      c.addEventListener('mousedown', (e) => {
        this.isMouseDown = true;
        this.mouseButton = e.button;
        this.lastMouseX = e.clientX;
        this.lastMouseY = e.clientY;
      });

      window.addEventListener('mouseup', () => {
        this.isMouseDown = false;
      });

      c.addEventListener('mousemove', (e) => {
        if (!this.isMouseDown) return;
        const dx = e.clientX - this.lastMouseX;
        const dy = e.clientY - this.lastMouseY;
        this.lastMouseX = e.clientX;
        this.lastMouseY = e.clientY;

        if (this.mouseButton === 0) {
          // Orbit rotate
          this.ang1 += dx * 0.005;
          this.ang2 += dy * 0.005;
        } else if (this.mouseButton === 2) {
          // Pan
          const scale = this.len * 0.002;
          this.cenx += scale * (-dx * Math.sin(this.ang1) - dy * Math.sin(this.ang2) * Math.cos(this.ang1));
          this.ceny += scale * (dy * Math.cos(this.ang2));
          this.cenz += scale * (dx * Math.cos(this.ang1) - dy * Math.sin(this.ang2) * Math.sin(this.ang1));
        }
      });

      c.addEventListener('wheel', (e) => {
        e.preventDefault();
        this.len *= Math.exp(e.deltaY * 0.001);
        if (this.len < 0.2) this.len = 0.2;
        if (this.len > 10.0) this.len = 10.0;
      }, { passive: false });

      c.addEventListener('contextmenu', (e) => e.preventDefault());

      // Touch handlers for mobile
      c.addEventListener('touchstart', (e) => {
        if (e.touches.length === 1) {
          this.lastMouseX = e.touches[0].clientX;
          this.lastMouseY = e.touches[0].clientY;
        } else if (e.touches.length === 2) {
          const dx = e.touches[0].clientX - e.touches[1].clientX;
          const dy = e.touches[0].clientY - e.touches[1].clientY;
          this.touchDistance = Math.hypot(dx, dy);
        }
      }, { passive: true });

      c.addEventListener('touchmove', (e) => {
        e.preventDefault();
        if (e.touches.length === 1) {
          const dx = e.touches[0].clientX - this.lastMouseX;
          const dy = e.touches[0].clientY - this.lastMouseY;
          this.lastMouseX = e.touches[0].clientX;
          this.lastMouseY = e.touches[0].clientY;
          this.ang1 += dx * 0.005;
          this.ang2 += dy * 0.005;
        } else if (e.touches.length === 2) {
          const dx = e.touches[0].clientX - e.touches[1].clientX;
          const dy = e.touches[0].clientY - e.touches[1].clientY;
          const newDist = Math.hypot(dx, dy);
          if (this.touchDistance > 0) {
            this.len *= this.touchDistance / newDist;
            if (this.len < 0.2) this.len = 0.2;
            if (this.len > 10.0) this.len = 10.0;
          }
          this.touchDistance = newDist;
        }
      }, { passive: false });
    }

    startTimedBenchmark(durationMs = 20000) {
      this.benchmarkMode = true;
      this.benchmarkDurationMs = durationMs;
      this.benchmarkStartTime = performance.now();
      this.benchmarkSamples = [];
      this.minFps = Infinity;
      this.maxFps = 0;
      this.totalFrames = 0;
      this.totalFrameTimeSum = 0;
    }

    loop(timestamp) {
      if (!this.running) return;

      const now = timestamp || performance.now();
      const deltaMs = now - this.lastFrameTimestamp;
      this.lastFrameTimestamp = now;

      // Handle Auto-Rotation
      if (this.options.autoRotate && !this.isMouseDown) {
        this.ang1 += this.autoRotateSpeed;
      }

      // Render Frame
      this.draw();

      // Track Performance
      if (deltaMs > 0 && deltaMs < 1000) {
        this.frameTimeMs = deltaMs;
        this.frameCount++;
        this.totalFrames++;
        this.totalFrameTimeSum += deltaMs;

        this.frameTimesHistory.push(deltaMs);
        if (this.frameTimesHistory.length > this.historyLimit) {
          this.frameTimesHistory.shift();
        }

        // Rolling 1-sec FPS Calculation
        const elapsedSinceFps = now - this.lastFpsUpdate;
        if (elapsedSinceFps >= 500) {
          this.fps = Math.round((this.frameCount * 1000) / elapsedSinceFps);
          this.frameCount = 0;
          this.lastFpsUpdate = now;

          if (this.fps < this.minFps && this.totalFrames > 10) this.minFps = this.fps;
          if (this.fps > this.maxFps) this.maxFps = this.fps;
          this.avgFps = Math.round((this.totalFrames * 1000) / this.totalFrameTimeSum);

          // Calculate 1% Low FPS
          this.calculate1PctLow();
        }

        // Handle Timed Benchmark
        if (this.benchmarkMode) {
          const runElapsed = now - this.benchmarkStartTime;
          if (runElapsed > this.warmupDurationMs) {
            // Discard warmup; record actual benchmark frames
            this.benchmarkSamples.push(deltaMs);
          }
          if (runElapsed >= this.benchmarkDurationMs) {
            this.completeBenchmark();
          }
        }

        if (typeof this.options.onFrameStats === 'function') {
          this.options.onFrameStats({
            fps: this.fps,
            frameTimeMs: this.frameTimeMs.toFixed(1),
            minFps: this.minFps === Infinity ? 0 : this.minFps,
            maxFps: this.maxFps,
            avgFps: this.avgFps,
            low1PctFps: this.low1PctFps,
            history: this.frameTimesHistory,
            benchmarkMode: this.benchmarkMode,
            benchmarkProgress: this.benchmarkMode ? Math.min(100, Math.round(((now - this.benchmarkStartTime) / this.benchmarkDurationMs) * 100)) : null
          });
        }
      }

      this.animFrameId = requestAnimationFrame(this.loop);
    }

    calculate1PctLow() {
      if (this.frameTimesHistory.length < 20) {
        this.low1PctFps = this.fps;
        return;
      }
      const sorted = [...this.frameTimesHistory].sort((a, b) => a - b);
      const index99 = Math.floor(sorted.length * 0.99);
      const highFrameTime = sorted[Math.min(index99, sorted.length - 1)];
      this.low1PctFps = highFrameTime > 0 ? Math.round(1000 / highFrameTime) : this.fps;
    }

    completeBenchmark() {
      this.benchmarkMode = false;
      const samples = this.benchmarkSamples;
      if (samples.length === 0) return;

      const totalTime = samples.reduce((a, b) => a + b, 0);
      const avgFps = Math.round((samples.length * 1000) / totalTime);

      const sorted = [...samples].sort((a, b) => a - b);
      const index99 = Math.floor(sorted.length * 0.99);
      const p99FrameTime = sorted[index99];
      const low1Pct = Math.round(1000 / p99FrameTime);

      // Resolution factor: 512p = 0.6, 720p = 0.85, 1024p = 1.0, 1440p = 1.35
      let resFactor = 1.0;
      if (this.options.resolution <= 512) resFactor = 0.6;
      else if (this.options.resolution <= 720) resFactor = 0.85;
      else if (this.options.resolution >= 1440) resFactor = 1.4;

      const rawScore = Math.round(((avgFps * 8.5) + (low1Pct * 4.5)) * resFactor);

      // Tier Rating
      let tier = 'C';
      if (rawScore >= 950) tier = 'S';
      else if (rawScore >= 600) tier = 'A';
      else if (rawScore >= 350) tier = 'B';
      else if (rawScore >= 180) tier = 'C';
      else if (rawScore >= 80) tier = 'D';
      else tier = 'F';

      const results = {
        score: rawScore,
        tier: tier,
        avgFps: avgFps,
        low1PctFps: low1Pct,
        minFps: Math.round(1000 / sorted[sorted.length - 1]),
        maxFps: Math.round(1000 / sorted[0]),
        totalFrames: samples.length,
        resolution: this.options.resolution,
        gpuVendor: this.gpuInfo.vendor,
        gpuRenderer: this.gpuInfo.renderer,
        timestamp: new Date().toISOString()
      };

      if (typeof this.options.onBenchmarkComplete === 'function') {
        this.options.onBenchmarkComplete(results);
      }
    }

    draw() {
      const gl = this.gl;
      if (!gl || !this.shaderProgram) return;

      gl.useProgram(this.shaderProgram);

      gl.bindBuffer(gl.ARRAY_BUFFER, this.posBuffer);
      gl.vertexAttribPointer(this.locPosition, 3, gl.FLOAT, false, 0, 0);
      gl.enableVertexAttribArray(this.locPosition);

      // Uniform calculations
      gl.uniform1f(this.locX, 1.0);
      gl.uniform1f(this.locY, 1.0);
      gl.uniform1f(this.locLen, this.len);

      const cos1 = Math.cos(this.ang1);
      const sin1 = Math.sin(this.ang1);
      const cos2 = Math.cos(this.ang2);
      const sin2 = Math.sin(this.ang2);

      gl.uniform3f(
        this.locOrigin,
        this.len * cos1 * cos2 + this.cenx,
        this.len * sin2 + this.ceny,
        this.len * sin1 * cos2 + this.cenz
      );

      gl.uniform3f(this.locRight, sin1, 0.0, -cos1);
      gl.uniform3f(this.locUp, -sin2 * cos1, cos2, -sin2 * sin1);
      gl.uniform3f(this.locForward, -cos1 * cos2, -sin2, -sin1 * cos2);

      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }

    destroy() {
      this.running = false;
      if (this.animFrameId) cancelAnimationFrame(this.animFrameId);
    }
  }

  // Export globally
  window.VolumeShaderEngine = VolumeShaderEngine;
  window.MANDELBULB_KERNEL = MANDELBULB_KERNEL;

})(window);

// Additional Presets for Shader Lab
window.PRESET_JULIA = `float kernal(vec3 ver) {
  vec3 a = ver;
  float b;
  for(int i = 0; i < 6; i++) {
    b = length(a);
    a = vec3(a.x*a.x - a.y*a.y - a.z*a.z, 2.0*a.x*a.y, 2.0*a.x*a.z) + vec3(-0.4, 0.6, 0.1);
    if(b > 4.0) break;
  }
  return 2.5 - dot(a, a);
}`;

window.PRESET_TORUS = `float kernal(vec3 ver) {
  vec2 q = vec2(length(ver.xz) - 1.2, ver.y);
  float d = length(q) - 0.45;
  return -d * 4.0;
}`;

window.PRESET_COSINE = `float kernal(vec3 ver) {
  float d = length(ver) - 1.0 + 0.2 * (sin(ver.x * 6.0) * cos(ver.y * 6.0) * sin(ver.z * 6.0));
  return -d * 3.5;
}`;
