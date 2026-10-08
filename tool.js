(function () {
  var host = document.getElementById("vs") || document.getElementById("vs-tool");
  if (!host) return;

  host.innerHTML =
    '<div class="tool" id="tl">' +
    '<canvas id="cv"></canvas>' +
    '<div class="ov" id="ov"></div>' +
    '<div class="hud" id="hud" hidden><b id="f">0</b><span>FPS</span>' +
    '<div class="chips"><i>AVG <b id="a">-</b></i><i>1% LOW <b id="l">-</b></i>' +
    '<i>MIN <b id="mn">-</b></i><i>STABLE <b id="s">-</b>%</i></div></div>' +
    '<div class="ctl"><button id="ps" aria-label="Pause">&#9654;</button>' +
    '<button id="fs" aria-label="Fullscreen">&#9974;</button></div></div>' +
    '<div class="row"><small>Complexity</small>' +
    '<span role="group" aria-label="Complexity">' +
    '<button data-m="0">Simple</button>' +
    '<button data-m="1" aria-pressed="true">Standard</button>' +
    '<button data-m="2">Advanced</button>' +
    '<button data-m="3">Extreme</button></span>' +
    '<small>Run for</small>' +
    '<select id="du" aria-label="Duration">' +
    '<option value="0">Until I stop</option>' +
    '<option value="30">30 seconds</option>' +
    '<option value="180">3 minutes</option></select>' +
    '<button id="go" class="big" style="font-size:16px;padding:10px 22px">Run benchmark</button>' +
    '<button id="sh">Share</button></div>' +
    '<p class="note" id="gpu"></p>';

  var $ = function (i) { return document.getElementById(i); };
  var cv = $("cv"), ov = $("ov"), tl = $("tl"), hud = $("hud");

  var LEVELS = [
    { n: "Simple", iterations: 2, steps: 250 },
    { n: "Standard", iterations: 5, steps: 1002 },
    { n: "Advanced", iterations: 7, steps: 1500 },
    { n: "Extreme", iterations: 9, steps: 2000 }
  ];
  var m = 1;
  var started = false, paused = true, meas = false, inview = true, idle = true;
  var raf = 0, last = 0, t0 = 0, dur = 0;
  var L = new Float32Array(4096), ln = 0, wa = 0, wn = 0;
  var M = new Float32Array(65536), mn = 0, mtot = 0, mcnt = 0;

  var len = 1.6, ang1 = 2.8, ang2 = 0.4, cenx = 0, ceny = 0, cenz = 0;

  function buildKernel(iters) {
    return (
      "float kernal(vec3 ver){\n" +
      "   vec3 a;\nfloat b,c,d,e;\n   a=ver;\n" +
      "   for(int i=0;i<" + iters + ";i++){\n" +
      "       b=length(a);\n" +
      "       c=atan(a.y,a.x)*8.0;\n" +
      "       e=1.0/b;\n" +
      "       d=acos(a.z/b)*8.0;\n" +
      "       b=pow(b,8.0);\n" +
      "       a=vec3(b*sin(d)*cos(c),b*sin(d)*sin(c),b*cos(d))+ver;\n" +
      "       if(b>6.0){\n" +
      "           break;\n" +
      "       }\n" +
      "   }" +
      "   return 4.0-a.x*a.x-a.y*a.y-a.z*a.z;}"
    );
  }

  function getFragShaderSource(steps) {
    return (
      "#version 100 \n" +
      "#define PI 3.14159265358979324\n" +
      "#define M_L 0.3819660113\n" +
      "#define M_R 0.6180339887\n" +
      "#define MAXR 8\n" +
      "#define SOLVER 8\n" +
      "precision highp float;\n" +
      "float kernal(vec3 ver)\n;" +
      "uniform vec3 right, forward, up, origin;\n" +
      "varying vec3 dir, localdir;\n" +
      "uniform float len;\n" +
      "vec3 ver;\n" +
      "int sign;" +
      "float v, v1, v2;\n" +
      "float r1, r2, r3, r4, m1, m2, m3, m4;\n" +
      "vec3 n, reflect;\n" +
      "const float step = 0.002;\n" +
      "vec3 color;\n" +
      "void main() {\n" +
      "   color.r=0.0;\n" +
      "   color.g=0.0;\n" +
      "   color.b=0.0;\n" +
      "   sign=0;" +
      "   v1 = kernal(origin + dir * (step*len));\n" +
      "   v2 = kernal(origin);\n" +
      "   for (int k = 2; k < " + steps + "; k++) {\n" +
      "      ver = origin + dir * (step*len*float(k));\n" +
      "      v = kernal(ver);\n" +
      "      if (v > 0.0 && v1 < 0.0) {\n" +
      "         r1 = step * len*float(k - 1);\n" +
      "         r2 = step * len*float(k);\n" +
      "         m1 = kernal(origin + dir * r1);\n" +
      "         m2 = kernal(origin + dir * r2);\n" +
      "         for (int l = 0; l < SOLVER; l++) {\n" +
      "            r3 = r1 * 0.5 + r2 * 0.5;\n" +
      "            m3 = kernal(origin + dir * r3);\n" +
      "            if (m3 > 0.0) {\n" +
      "               r2 = r3;\n" +
      "               m2 = m3;\n" +
      "            }\n" +
      "            else {\n" +
      "               r1 = r3;\n" +
      "               m1 = m3;\n" +
      "            }\n" +
      "         }\n" +
      "         if (r3 < 2.0 * len) {\n" +
      "               sign=1;" +
      "            break;\n" +
      "         }\n" +
      "      }\n" +
      "      if (v < v1&&v1>v2&&v1 < 0.0 && (v1*2.0 > v || v1 * 2.0 > v2)) {\n" +
      "         r1 = step * len*float(k - 2);\n" +
      "         r2 = step * len*(float(k) - 2.0 + 2.0*M_L);\n" +
      "         r3 = step * len*(float(k) - 2.0 + 2.0*M_R);\n" +
      "         r4 = step * len*float(k);\n" +
      "         m2 = kernal(origin + dir * r2);\n" +
      "         m3 = kernal(origin + dir * r3);\n" +
      "         for (int l = 0; l < MAXR; l++) {\n" +
      "            if (m2 > m3) {\n" +
      "               r4 = r3;\n" +
      "               r3 = r2;\n" +
      "               r2 = r4 * M_L + r1 * M_R;\n" +
      "               m3 = m2;\n" +
      "               m2 = kernal(origin + dir * r2);\n" +
      "            }\n" +
      "            else {\n" +
      "               r1 = r2;\n" +
      "               r2 = r3;\n" +
      "               r3 = r4 * M_R + r1 * M_L;\n" +
      "               m2 = m3;\n" +
      "               m3 = kernal(origin + dir * r3);\n" +
      "            }\n" +
      "         }\n" +
      "         if (m2 > 0.0) {\n" +
      "            r1 = step * len*float(k - 2);\n" +
      "            r2 = r2;\n" +
      "            m1 = kernal(origin + dir * r1);\n" +
      "            m2 = kernal(origin + dir * r2);\n" +
      "            for (int l = 0; l < SOLVER; l++) {\n" +
      "               r3 = r1 * 0.5 + r2 * 0.5;\n" +
      "               m3 = kernal(origin + dir * r3);\n" +
      "               if (m3 > 0.0) {\n" +
      "                  r2 = r3;\n" +
      "                  m2 = m3;\n" +
      "               }\n" +
      "               else {\n" +
      "                  r1 = r3;\n" +
      "                  m1 = m3;\n" +
      "               }\n" +
      "            }\n" +
      "            if (r3 < 2.0 * len&&r3> step*len) {\n" +
      "                   sign=1;" +
      "               break;\n" +
      "            }\n" +
      "         }\n" +
      "         else if (m3 > 0.0) {\n" +
      "            r1 = step * len*float(k - 2);\n" +
      "            r2 = r3;\n" +
      "            m1 = kernal(origin + dir * r1);\n" +
      "            m2 = kernal(origin + dir * r2);\n" +
      "            for (int l = 0; l < SOLVER; l++) {\n" +
      "               r3 = r1 * 0.5 + r2 * 0.5;\n" +
      "               m3 = kernal(origin + dir * r3);\n" +
      "               if (m3 > 0.0) {\n" +
      "                  r2 = r3;\n" +
      "                  m2 = m3;\n" +
      "               }\n" +
      "               else {\n" +
      "                  r1 = r3;\n" +
      "                  m1 = m3;\n" +
      "               }\n" +
      "            }\n" +
      "            if (r3 < 2.0 * len&&r3> step*len) {\n" +
      "                   sign=1;" +
      "               break;\n" +
      "            }\n" +
      "         }\n" +
      "      }\n" +
      "      v2 = v1;\n" +
      "      v1 = v;\n" +
      "   }\n" +
      "   if (sign==1) {\n" +
      "      r1 = r3;\n" +
      "      ver = origin + dir*r3 ;\n" +
      "      r2 = step*len ;\n" +
      "      v = kernal(ver);\n" +
      "      n.x = kernal(ver+right*r2)-v;\n" +
      "      n.y = kernal(ver+up*r2)-v;\n" +
      "      n.z = kernal(ver+forward*r2)-v;\n" +
      "      r3 = n.x*n.x+n.y*n.y+n.z*n.z;\n" +
      "      n = n * (1.0 / sqrt(r3));\n" +
      "      ver = dir;\n" +
      "      r3 = ver.x*ver.x+ver.y*ver.y+ver.z*ver.z;\n" +
      "      ver = ver * (1.0 / sqrt(r3));\n" +
      "      reflect = n * (-2.0*dot(ver, n)) + ver;\n" +
      "      r3 = reflect.x*0.276+reflect.y*0.920+reflect.z*0.276;\n" +
      "      r4 = n.x*0.276+n.y*0.920+n.z*0.276;\n" +
      "      r3 = max(0.0,r3);\n" +
      "      r3 = r3 * r3*r3*r3;\n" +
      "      r3 = r3 * 0.45 + r4 * 0.25 + 0.3;\n" +
      "      n.x = sin(r1*10.0)*0.5+0.5;\n" +
      "      n.y = sin(r1*10.0+2.05)*0.5+0.5;\n" +
      "      n.z = sin(r1*10.0-2.05)*0.5+0.5;\n" +
      "      color = n*r3;\n" +
      "   }\n" +
      "   gl_FragColor = vec4(color.x, color.y, color.z, 1.0);}"
    );
  }

  var VSHADER =
    "#version 100 \n" +
    "precision highp float;\n" +
    "attribute vec4 position;" +
    "varying vec3 dir, localdir;" +
    "uniform vec3 right, forward, up, origin;" +
    "uniform float x,y;" +
    "void main() {" +
    "   gl_Position = position; " +
    "   dir = forward + right * position.x*x + up * position.y*y;" +
    "   localdir.x = position.x*x;" +
    "   localdir.y = position.y*y;" +
    "   localdir.z = -1.0;" +
    "}";

  var gl =
    cv.getContext("webgl", { antialias: false, powerPreference: "high-performance" }) ||
    cv.getContext("experimental-webgl", { antialias: false, powerPreference: "high-performance" });

  if (!gl) {
    ov.innerHTML =
      "<h3>WebGL not supported</h3><p>Try Chrome, Firefox, Safari or Edge, and make sure hardware acceleration is on.</p>";
    return;
  }

  var vertshader, fragshader, shaderProgram;
  var glposition, glright, glforward, glup, glorigin, glx, gly, gllen;

  function compileShaders() {
    var lv = LEVELS[m];
    var KERNEL = buildKernel(lv.iterations);
    var FSHADER = getFragShaderSource(lv.steps);

    if (shaderProgram) {
      try {
        gl.detachShader(shaderProgram, vertshader);
        gl.detachShader(shaderProgram, fragshader);
      } catch (e) {}
    } else {
      shaderProgram = gl.createProgram();
    }

    if (vertshader) gl.deleteShader(vertshader);
    if (fragshader) gl.deleteShader(fragshader);

    vertshader = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vertshader, VSHADER);
    gl.compileShader(vertshader);
    if (!gl.getShaderParameter(vertshader, gl.COMPILE_STATUS)) {
      ov.innerHTML = "<h3>Shader could not start</h3><p>Vertex shader failed.</p>";
      ov.hidden = false;
      return false;
    }

    fragshader = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fragshader, FSHADER + KERNEL);
    gl.compileShader(fragshader);
    if (!gl.getShaderParameter(fragshader, gl.COMPILE_STATUS)) {
      ov.innerHTML =
        "<h3>Shader could not start</h3><p>This GPU or browser rejected the shader. Try another browser or a lower complexity.</p>";
      ov.hidden = false;
      return false;
    }

    gl.attachShader(shaderProgram, vertshader);
    gl.attachShader(shaderProgram, fragshader);
    gl.linkProgram(shaderProgram);
    if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
      ov.innerHTML = "<h3>Shader could not start</h3><p>Program link failed.</p>";
      ov.hidden = false;
      return false;
    }

    gl.useProgram(shaderProgram);
    glposition = gl.getAttribLocation(shaderProgram, "position");
    glright = gl.getUniformLocation(shaderProgram, "right");
    glforward = gl.getUniformLocation(shaderProgram, "forward");
    glup = gl.getUniformLocation(shaderProgram, "up");
    glorigin = gl.getUniformLocation(shaderProgram, "origin");
    glx = gl.getUniformLocation(shaderProgram, "x");
    gly = gl.getUniformLocation(shaderProgram, "y");
    gllen = gl.getUniformLocation(shaderProgram, "len");
    return true;
  }

  var positions = [-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, -1, 0, 1, 1, 0, -1, 1, 0];
  var buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

  if (!compileShaders()) return;

  gl.enableVertexAttribArray(glposition);
  gl.vertexAttribPointer(glposition, 3, gl.FLOAT, false, 0, 0);

  var e = gl.getExtension("WEBGL_debug_renderer_info");
  var rend = e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : "GPU name hidden by browser";
  $("gpu").textContent =
    "GPU: " + rend +
    " | WebGL 1 | Same engine as volumeshaderbm.com / original VSBM. Drag to rotate, scroll to zoom, right-click to pan.";

  function size() {
    var r = cv.getBoundingClientRect();
    var d = Math.min(window.devicePixelRatio || 1, 2);
    var w = Math.max(2, Math.round(r.width * d));
    var h = Math.max(2, Math.round(r.height * d));
    var maxPix = 1.2e6;
    var scale = Math.sqrt(Math.min(1, maxPix / (w * h)));
    cv.width = Math.max(2, Math.round(w * scale));
    cv.height = Math.max(2, Math.round(h * scale));
    gl.viewport(0, 0, cv.width, cv.height);
  }

  function draw() {
    if (!gl || !shaderProgram || paused) return;
    var aspect = cv.height > 0 ? cv.width / cv.height : 1;
    gl.uniform1f(glx, 2 * aspect);
    gl.uniform1f(gly, 2);
    gl.uniform1f(gllen, len);
    gl.uniform3f(
      glorigin,
      len * Math.cos(ang1) * Math.cos(ang2) + cenx,
      len * Math.sin(ang2) + ceny,
      len * Math.sin(ang1) * Math.cos(ang2) + cenz
    );
    gl.uniform3f(glright, Math.sin(ang1), 0, -Math.cos(ang1));
    gl.uniform3f(
      glup,
      -Math.sin(ang2) * Math.cos(ang1),
      Math.cos(ang2),
      -Math.sin(ang2) * Math.sin(ang1)
    );
    gl.uniform3f(
      glforward,
      -Math.cos(ang1) * Math.cos(ang2),
      -Math.sin(ang2),
      -Math.sin(ang1) * Math.cos(ang2)
    );
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  function stats(a, n) {
    n = Math.min(n, a.length);
    if (n < 5) return null;
    var s = Array.prototype.slice.call(a, 0, n).sort(function (x, y) { return y - x; });
    var k = Math.max(1, Math.ceil(n * 0.01)), w = 0, t = 0, i;
    for (i = 0; i < k; i++) w += s[i];
    for (i = 0; i < n; i++) t += s[i];
    var mean = t / n, v = 0;
    for (i = 0; i < n; i++) v += (s[i] - mean) * (s[i] - mean);
    return {
      avg: 1000 / mean,
      low: 1000 / (w / k),
      min: 1000 / s[0],
      max: 1000 / s[n - 1],
      st: Math.max(0, Math.round(100 * (1 - Math.sqrt(v / n) / mean)))
    };
  }

  function loop(now) {
    if (!started) return;
    raf = requestAnimationFrame(loop);
    var d = now - last;
    last = now;
    if (paused || !inview) return;
    if (d > 0 && d < 1000) {
      L[ln++ % 4096] = d;
      wa += d;
      wn++;
      if (meas) {
        M[mn++ % 65536] = d;
        mtot += d;
        mcnt++;
      }
    }
    if (idle) ang1 += 0.01;
    draw();
    if (wa >= 500) {
      var s = stats(L, ln);
      $("f").textContent = Math.round((1000 * wn) / wa);
      if (s) {
        $("a").textContent = s.avg.toFixed(1);
        $("l").textContent = s.low.toFixed(1);
        $("mn").textContent = s.min.toFixed(1);
        $("s").textContent = s.st;
      }
      wa = 0;
      wn = 0;
    }
    if (meas && dur && now - t0 >= dur * 1000) finish();
  }

  function setPause(v) {
    paused = v;
    last = performance.now();
    $("ps").innerHTML = v ? "&#9654;" : "&#10074;&#10074;";
  }

  function startLive() {
    if (started) return;
    started = true;
    ov.hidden = true;
    hud.hidden = false;
    setPause(false);
    last = performance.now();
    size();
    raf = requestAnimationFrame(loop);
  }

  function begin() {
    if (!started) startLive();
    mn = 0; mtot = 0; mcnt = 0;
    dur = +$("du").value;
    t0 = performance.now();
    meas = true;
    ov.hidden = true;
    if (paused) setPause(false);
    $("go").textContent = "Stop and see result";
  }

  function finish() {
    meas = false;
    $("go").textContent = "Run benchmark";
    var s = stats(M, mn);
    if (!s) return;
    var c = function (l, v) {
      return "<div><b>" + v + "</b><span>" + l + "</span></div>";
    };
    ov.innerHTML =
      "<h3>Your result</h3><div class=\"res\">" +
      c("Average FPS", ((1000 * mcnt) / mtot).toFixed(1)) +
      c("1% low FPS", s.low.toFixed(1)) +
      c("Minimum FPS", s.min.toFixed(1)) +
      c("Maximum FPS", s.max.toFixed(1)) +
      c("Stability", s.st + "%") +
      c("Duration", Math.round(mtot / 1000) + " s") +
      c("Complexity", LEVELS[m].n) +
      c("Resolution", cv.width + "x" + cv.height) +
      '</div><button id="cl" class="big">Close</button>';
    ov.hidden = false;
    $("cl").onclick = function () { ov.hidden = true; };
  }

  var pts = {};
  cv.style.touchAction = "none";
  cv.oncontextmenu = function (x) { x.preventDefault(); };
  function pan(dx, dy) {
    var k = len * 0.0022;
    cenx += -Math.cos(ang1) * dx * k;
    cenz += Math.sin(ang1) * dx * k;
    ceny += dy * k;
  }
  cv.onpointerdown = function (x) {
    if (!started) return;
    idle = false;
    cv.setPointerCapture(x.pointerId);
    pts[x.pointerId] = { x: x.clientX, y: x.clientY, b: x.button };
  };
  cv.onpointerup = cv.onpointercancel = function (x) { delete pts[x.pointerId]; };
  cv.onpointermove = function (x) {
    var p = pts[x.pointerId];
    if (!p || !started) return;
    var ks = Object.keys(pts), dx = x.clientX - p.x, dy = x.clientY - p.y;
    if (ks.length == 1) {
      if (p.b == 2 || x.shiftKey) pan(dx, dy);
      else {
        ang1 -= dx * 0.006;
        ang2 = Math.max(-1.4, Math.min(1.4, ang2 + dy * 0.006));
      }
    } else {
      var q = pts[ks[0] == x.pointerId ? ks[1] : ks[0]],
        pd = Math.hypot(p.x - q.x, p.y - q.y),
        nd = Math.hypot(x.clientX - q.x, x.clientY - q.y);
      if (nd > 0) len = Math.max(0.4, Math.min(8, (len * pd) / nd));
      pan(dx / 2, dy / 2);
    }
    p.x = x.clientX;
    p.y = x.clientY;
  };
  cv.addEventListener("wheel", function (x) {
    if (!started) return;
    x.preventDefault();
    len = Math.max(0.4, Math.min(8, len * Math.exp(x.deltaY * 0.001)));
  }, { passive: false });

  $("go").onclick = function () {
    if (!started) startLive();
    meas ? finish() : begin();
  };
  $("ps").onclick = function () {
    if (!started) { startLive(); return; }
    setPause(!paused);
  };

  document.querySelectorAll("[data-m]").forEach(function (b) {
    b.setAttribute("aria-pressed", +b.dataset.m == m);
    b.onclick = function () {
      m = +b.dataset.m;
      document.querySelectorAll("[data-m]").forEach(function (y) {
        y.setAttribute("aria-pressed", y === b);
      });
      compileShaders();
      size();
      ln = 0;
      if (m == 3)
        $("gpu").textContent =
          "Extreme = 2000 ray steps + 9 kernel iterations (same as volumeshaderbm.com). Can freeze weak devices.";
    };
  });

  $("fs").onclick = function () {
    var d = document;
    if (d.fullscreenElement || d.webkitFullscreenElement) {
      (d.exitFullscreen || d.webkitExitFullscreen).call(d);
    } else {
      (tl.requestFullscreen || tl.webkitRequestFullscreen).call(tl);
    }
  };

  $("sh").onclick = function () {
    var u = location.href.split("?")[0];
    if (navigator.share) navigator.share({ title: document.title, url: u }).catch(function () {});
    else if (navigator.clipboard) {
      navigator.clipboard.writeText(u);
      $("sh").textContent = "Link copied";
    }
  };

  addEventListener("keydown", function (x) {
    if (x.key === "p" || x.key === "P") {
      if (!started) startLive();
      else setPause(!paused);
    }
    if (x.key === " " && x.target === document.body) {
      x.preventDefault();
      ang1 = 2.8; ang2 = 0.4; len = 1.6; cenx = ceny = cenz = 0; idle = true;
    }
  });

  addEventListener("resize", function () { size(); });
  document.addEventListener("fullscreenchange", function () { setTimeout(size, 100); });

  if (window.IntersectionObserver)
    new IntersectionObserver(function (e) { inview = e[0].isIntersecting; }).observe(tl);

  cv.addEventListener("webglcontextlost", function (x) {
    x.preventDefault();
    paused = true;
    started = false;
  });

  var q = new URLSearchParams(location.search), qm = q.get("m"), qt = q.get("t");
  if (qm !== null && LEVELS[+qm]) {
    m = +qm;
    document.querySelectorAll("[data-m]").forEach(function (b) {
      b.setAttribute("aria-pressed", +b.dataset.m == m);
    });
    compileShaders();
  }
  if (qt === "1") $("du").value = "30";
  if (qt === "2") $("du").value = "180";

  size();
  ov.hidden = false;
  ov.innerHTML =
    "<h3>GPU Benchmark Test</h3>" +
    "<p>Test your device's graphics performance with the Volume Shader BM benchmark.<br>" +
    "Pick a complexity below, then press Start. The GPU test does not run until you start it.</p>" +
    '<button id="st" class="big">Start</button>' +
    '<p style="font-size:13px;opacity:.7;margin-top:8px">May cause lag on older devices</p>';
  $("st").onclick = function () { startLive(); };
  $("ps").innerHTML = "&#9654;";

  if (qt === "1" || qt === "2") {
    startLive();
    setTimeout(begin, 600);
  }
})();
