(function(){
var host=document.getElementById('vs');if(!host)return;
host.innerHTML='<div class="tool" id="tl"><canvas id="cv"></canvas><div class="ov" id="ov" hidden></div><div class="hud" id="hud"><b id="f">0</b><span>FPS</span><div class="chips"><i>AVG <b id="a">-</b></i><i>1% LOW <b id="l">-</b></i><i>MIN <b id="mn">-</b></i><i>STABLE <b id="s">-</b>%</i></div></div><div class="ctl"><button id="ps" aria-label="Pause or resume (P)">&#10074;&#10074;</button><button id="fs" aria-label="Fullscreen">&#9974;</button></div></div><div class="row"><small>Complexity</small><span role="group" aria-label="Complexity"><button data-m="0">Simple</button><button data-m="1" aria-pressed="true">Standard &#9733;</button><button data-m="2">Advanced</button><button data-m="3">Extreme</button></span><small>Run for</small><select id="du" aria-label="Duration"><option value="0">Until I stop</option><option value="30">30 seconds</option><option value="180">3 minutes</option></select><button id="go" class="big" style="font-size:16px;padding:10px 22px">Run benchmark</button><button id="sh">Share</button></div><p class="note" id="gpu"></p><p class="note"><b>Shader benchmark, not a gaming benchmark.</b> &#9733; Recommended. Heavy workloads can make laptops and phones hot: stop if the device gets very hot, keep this tab visible and plug in power. During a benchmark run the camera is fixed and input is disabled.</p>';
var $=function(i){return document.getElementById(i)},cv=$('cv'),ov=$('ov'),tl=$('tl');
var gl=cv.getContext('webgl2',{antialias:false,powerPreference:'high-performance'})||cv.getContext('webgl',{antialias:false,powerPreference:'high-performance'});
if(!gl){ov.hidden=false;ov.innerHTML='<h3>WebGL not supported</h3><p>Try Chrome, Firefox, Safari or Edge, and make sure hardware acceleration is on.</p>';return}
var v2=!!(window.WebGL2RenderingContext&&gl instanceof WebGL2RenderingContext);
var P=[{n:'Simple',s:24,i:4,k:.45},{n:'Standard',s:40,i:6,k:.6},{n:'Advanced',s:64,i:8,k:.8},{n:'Extreme',s:128,i:14,k:1.1}],m=1,run=false,raf=0;
var fs='precision highp float;uniform vec2 R;uniform vec3 O,G;uniform int S,I;'+
'float dens(vec3 p){vec3 z=p;float r=0.,n=0.;for(int i=0;i<16;i++){if(i>=I)break;r=length(z);if(r>2.)break;float th=acos(clamp(z.z/r,-1.,1.))*8.,ph=atan(z.y,z.x)*8.;z=pow(r,8.)*vec3(sin(th)*cos(ph),sin(ph)*sin(th),cos(th))+p;n+=1.;}return r>2.?clamp((n+1.-log(log(r)/.6931)/2.0794)/float(I),0.,1.):1.;}'+
'void main(){vec2 u=(gl_FragCoord.xy*2.-R)/R.y;vec3 f=normalize(G-O),rt=normalize(cross(f,vec3(0,1,0))),up=cross(rt,f),rd=normalize(f*1.6+rt*u.x+up*u.y);'+
'vec3 bg=mix(vec3(.04,.03,.12),vec3(.1,.04,.2),.5+.5*u.y);float b=dot(O,rd),h=b*b-(dot(O,O)-2.4);vec3 col=vec3(0.);float T=1.;'+
'if(h>0.){float s=sqrt(h),t0=-b-s,dt=2.*s/float(S),j=fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233)))*43758.5453);for(int i=0;i<160;i++){if(i>=S)break;float d=dens(O+rd*(t0+(float(i)+j)*dt));float a=d*d*dt*5.;col+=T*(1.-exp(-a))*(.5+.5*cos(6.28*(d*.9+vec3(0.,.15,.3))))*1.3;T*=exp(-a);}}'+
'gl_FragColor=vec4(col+T*bg,1);}';
function sh(t,s){var o=gl.createShader(t);gl.shaderSource(o,s);gl.compileShader(o);return o}
var pr=gl.createProgram();gl.attachShader(pr,sh(gl.VERTEX_SHADER,'attribute vec2 p;void main(){gl_Position=vec4(p,0,1);}'));gl.attachShader(pr,sh(gl.FRAGMENT_SHADER,fs));gl.linkProgram(pr);
if(!gl.getProgramParameter(pr,gl.LINK_STATUS)){ov.hidden=false;ov.innerHTML='<h3>Shader could not start</h3><p>This GPU or browser rejected the shader. Try another browser.</p>';return}
gl.useProgram(pr);gl.bindBuffer(gl.ARRAY_BUFFER,gl.createBuffer());gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);
var al=gl.getAttribLocation(pr,'p');gl.enableVertexAttribArray(al);gl.vertexAttribPointer(al,2,gl.FLOAT,false,0,0);
var U={};['R','O','G','S','I'].forEach(function(k){U[k]=gl.getUniformLocation(pr,k)});
var e=gl.getExtension('WEBGL_debug_renderer_info'),rend=e?gl.getParameter(e.UNMASKED_RENDERER_WEBGL):'GPU name hidden by browser';
$('gpu').textContent='GPU: '+rend+' | WebGL '+(v2?2:1)+' | Screen '+screen.width+'x'+screen.height+' @'+(window.devicePixelRatio||1)+'x. Drag to rotate, scroll or pinch to zoom, right-click or two fingers to pan, P to pause, Space to reset.';
var yaw,pit,dist,tg;function reset(){yaw=.7;pit=.35;dist=2.4;tg=[0,0,0]}reset();
function size(){var r=cv.getBoundingClientRect(),d=Math.min(window.devicePixelRatio||1,2)*P[m].k,w=r.width*d,h=r.height*d,c=Math.sqrt(Math.min(1,2.2e6/(w*h)));cv.width=Math.max(2,Math.round(w*c));cv.height=Math.max(2,Math.round(h*c));gl.viewport(0,0,cv.width,cv.height)}
function draw(){var cp=Math.cos(pit);gl.uniform2f(U.R,cv.width,cv.height);gl.uniform3f(U.O,tg[0]+dist*cp*Math.sin(yaw),tg[1]+dist*Math.sin(pit),tg[2]+dist*cp*Math.cos(yaw));gl.uniform3f(U.G,tg[0],tg[1],tg[2]);gl.uniform1i(U.S,P[m].s);gl.uniform1i(U.I,P[m].i);gl.drawArrays(gl.TRIANGLES,0,3)}
var pts={};cv.style.touchAction='none';cv.oncontextmenu=function(x){x.preventDefault()};
function pan(dx,dy){var k=dist*.0022;tg[0]+=(-Math.cos(yaw)*dx)*k;tg[2]+=(Math.sin(yaw)*dx)*k;tg[1]+=dy*k}
cv.onpointerdown=function(x){if(meas)return;idle=false;cv.setPointerCapture(x.pointerId);pts[x.pointerId]={x:x.clientX,y:x.clientY,b:x.button}};
cv.onpointerup=cv.onpointercancel=function(x){delete pts[x.pointerId]};
cv.onpointermove=function(x){var p=pts[x.pointerId];if(!p)return;var ks=Object.keys(pts),dx=x.clientX-p.x,dy=x.clientY-p.y;
if(ks.length==1){if(p.b==2||x.shiftKey)pan(dx,dy);else{yaw-=dx*.006;pit=Math.max(-1.45,Math.min(1.45,pit+dy*.006))}}
else{var q=pts[ks[0]==x.pointerId?ks[1]:ks[0]],pd=Math.hypot(p.x-q.x,p.y-q.y),nd=Math.hypot(x.clientX-q.x,x.clientY-q.y);if(nd>0)dist=Math.max(1.5,Math.min(8,dist*pd/nd));pan(dx/2,dy/2)}
p.x=x.clientX;p.y=x.clientY;if(paused)draw()};
cv.addEventListener('wheel',function(x){x.preventDefault();if(meas)return;dist=Math.max(1.5,Math.min(8,dist*Math.exp(x.deltaY*.001)))},{passive:false});
var L=new Float32Array(4096),ln=0,M=new Float32Array(65536),mn=0,mtot=0,mcnt=0,wa=0,wn=0,last=performance.now(),paused=false,inview=true,idle=true,meas=false,t0=0,dur=0,slow=0;
function stats(a,n){n=Math.min(n,a.length);if(n<5)return null;var s=Array.prototype.slice.call(a,0,n).sort(function(x,y){return y-x}),k=Math.max(1,Math.ceil(n*.01)),w=0,t=0,i;for(i=0;i<k;i++)w+=s[i];for(i=0;i<n;i++)t+=s[i];var mean=t/n,v=0;for(i=0;i<n;i++)v+=(s[i]-mean)*(s[i]-mean);
return{avg:1000/mean,low:1000/(w/k),min:1000/s[0],max:1000/s[n-1],st:Math.max(0,Math.round(100*(1-Math.sqrt(v/n)/mean)))}}
var adapt=false,ended='';
function cfg(){var u=navigator.userAgent;return{b:/Edg\//.test(u)?'Edge':/OPR\//.test(u)?'Opera':/Firefox\//.test(u)?'Firefox':/Chrome\//.test(u)?'Chrome':/Safari\//.test(u)?'Safari':'Unknown',o:/Windows/.test(u)?'Windows':/Android/.test(u)?'Android':/iPhone|iPad/.test(u)?'iOS':/Mac/.test(u)?'macOS':/Linux/.test(u)?'Linux':'Unknown'}}
function showMsg(t){ov.innerHTML='<h3>Run stopped</h3><p>'+t+'</p><button id="cl" class="big">Close</button>';ov.hidden=false;$('cl').onclick=function(){ov.hidden=true}}
function cancel(t){meas=false;$('go').textContent='Run benchmark';showMsg(t)}
function loop(now){raf=requestAnimationFrame(loop);var d=now-last;last=now;if(paused)return;
if(!inview||document.hidden){if(meas)cancel('The run was cancelled because the tab or canvas was not visible. Keep it visible and run it again.');return}
if(d>1500&&d<30000&&m>0)slow++;else slow=0;if(slow>=2){slow=0;lower();return}
if(d>0&&d<1000){L[ln++%4096]=d;wa+=d;wn++;if(meas&&now-t0>=1000){M[mn++%65536]=d;mtot+=d;mcnt++}}
if(idle&&!meas)yaw+=d*.00022;draw();
if(wa>=500){var s=stats(L,ln);$('f').textContent=Math.round(1000*wn/wa);if(s){$('a').textContent=s.avg.toFixed(1);$('l').textContent=s.low.toFixed(1);$('mn').textContent=s.min.toFixed(1);$('s').textContent=s.st}wa=0;wn=0}
if(meas&&dur&&now-t0>=dur*1000+1000)finish()}
function lower(){adapt=true;if(meas){ended='The device was too slow for '+P[m].n+' (two frames over 1.5 s), so this run ended early and the preset was lowered. Adaptive results are not comparable with fixed-preset results.';finish()}
m--;document.querySelectorAll('[data-m]').forEach(function(b){b.setAttribute('aria-pressed',+b.dataset.m==m)});size();ln=0;$('gpu').textContent='This preset was too heavy for your GPU, so the test stepped down to '+P[m].n+' to keep your device responsive.'}
function begin(){reset();idle=false;adapt=false;ended='';mn=0;mtot=0;mcnt=0;dur=+$('du').value||0;t0=performance.now();meas=true;ov.hidden=true;if(paused)setPause(false);$('go').textContent='Stop and see result'}
function graph(){var n=Math.min(mn,65536);if(mn>65536)return;var g=$('gr').getContext('2d'),W=$('gr').width,H=$('gr').height,a=[],k=Math.max(1,Math.floor(n/240)),i,j,s;
for(i=0;i+k<=n&&a.length<240;i+=k){s=0;for(j=0;j<k;j++)s+=M[i+j];a.push(s/k)}var mx=Math.max.apply(null,a)*1.15;
g.strokeStyle='#ff6fb5';g.lineWidth=1.5;g.beginPath();a.forEach(function(v,i){var X=i/(a.length-1||1)*W,Y=H-v/mx*H;i?g.lineTo(X,Y):g.moveTo(X,Y)});g.stroke();
g.strokeStyle='#6ee7d8';g.setLineDash([4,4]);var ya=H-(mtot/mcnt)/mx*H;g.beginPath();g.moveTo(0,ya);g.lineTo(W,ya);g.stroke();g.fillStyle='#b4afd9';g.font='11px sans-serif';g.fillText('Frame time over time (ms). Top = '+mx.toFixed(1)+' ms. Dashed = average',6,12)}
function finish(){meas=false;$('go').textContent='Run benchmark';var s=stats(M,mn);if(!s||mcnt<10){showMsg('Not enough frames were measured. Run it for longer.');return}
var g=cfg(),api=v2?'WebGL2':'WebGL1',r={benchmarkVersion:'1.0',preset:P[m].n.toLowerCase(),rayMarchSteps:P[m].s,fractalIterations:P[m].i,resolution:cv.width+'x'+cv.height,api:api.toLowerCase(),durationSeconds:+(mtot/1000).toFixed(1),warmupSeconds:1,averageFps:+(1000*mcnt/mtot).toFixed(1),onePercentLowFps:+s.low.toFixed(1),minFps:+s.min.toFixed(1),maxFps:+s.max.toFixed(1),avgFrameTimeMs:+(mtot/mcnt).toFixed(2),stabilityPercent:s.st,framesMeasured:mcnt,gpu:rend,browser:g.b,os:g.o,adaptiveStepDown:adapt};
var c=function(l,v){return'<div><b>'+v+'</b><span>'+l+'</span></div>'};
ov.innerHTML='<h3 style="font-size:34px">'+r.averageFps+' FPS</h3><p>'+P[m].n+' | '+r.resolution+' | '+api+' | Benchmark v1.0</p><div class="res">'+c('1% low FPS',r.onePercentLowFps)+c('Min FPS',r.minFps)+c('Max FPS',r.maxFps)+c('Frame time',r.avgFrameTimeMs+' ms')+c('Stability',r.stabilityPercent+'%')+c('Frames',r.framesMeasured)+'</div><canvas id="gr" width="560" height="90" style="aspect-ratio:auto;max-width:100%;cursor:default"></canvas><p style="font-size:13px">GPU: '+rend+' | '+g.b+' on '+g.o+' | '+P[m].s+' steps, '+P[m].i+' iterations | '+r.durationSeconds+' s measured after 1 s warm-up'+(adapt?'<br><b>Adaptive step-down occurred.</b> '+ended:'')+'</p><div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center"><button id="dj">Download JSON</button><button id="cp">Copy result</button><button id="cl">Close</button></div>';
ov.hidden=false;graph();$('cl').onclick=function(){ov.hidden=true};
$('dj').onclick=function(){var a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(r,null,2)],{type:'application/json'}));a.download='volumeshader-result.json';a.click()};
$('cp').onclick=function(){var t=r.averageFps+' FPS | '+P[m].n+' | '+r.resolution+' | '+api+' | Benchmark v1.0 | 1% low '+r.onePercentLowFps+' | stability '+r.stabilityPercent+'% | '+rend;if(navigator.clipboard){navigator.clipboard.writeText(t);$('cp').textContent='Copied'}}}
function setPause(v){paused=v;last=performance.now();$('ps').innerHTML=v?'&#9654;':'&#10074;&#10074;';if(v)draw()}
$('go').onclick=function(){meas?finish():begin()};$('ps').onclick=function(){setPause(!paused)};
document.querySelectorAll('[data-m]').forEach(function(b){b.setAttribute('aria-pressed',+b.dataset.m==m);b.onclick=function(){m=+b.dataset.m;document.querySelectorAll('[data-m]').forEach(function(y){y.setAttribute('aria-pressed',y===b)});size();ln=0;if(paused)draw();if(m==3)$('gpu').textContent='Extreme is very heavy and can freeze weak or older PCs. Close other tabs first. The test steps down by itself if frames take over 1.5 seconds.'}});
$('fs').onclick=function(){var d=document;if(d.fullscreenElement||d.webkitFullscreenElement){(d.exitFullscreen||d.webkitExitFullscreen).call(d)}else{(tl.requestFullscreen||tl.webkitRequestFullscreen).call(tl)}};
$('sh').onclick=function(){var u=location.href.split('?')[0];if(navigator.share)navigator.share({title:document.title,url:u}).catch(function(){});else if(navigator.clipboard){navigator.clipboard.writeText(u);$('sh').textContent='Link copied'}};
addEventListener('keydown',function(x){if(x.key==='p'||x.key==='P')setPause(!paused);if(x.key===' '&&x.target===document.body){x.preventDefault();reset();idle=true;if(paused)draw()}});
addEventListener('resize',function(){size();if(paused)draw()});document.addEventListener('fullscreenchange',function(){setTimeout(function(){size();if(paused)draw()},100)});
if(window.IntersectionObserver)new IntersectionObserver(function(e){inview=e[0].isIntersecting}).observe(tl);
cv.addEventListener('webglcontextlost',function(x){x.preventDefault();paused=true;meas=false;showMsg('GPU context was lost. Reload the page to restart the benchmark.')});cv.addEventListener('webglcontextrestored',function(){showMsg('GPU context was restored. Reload the page to restart the benchmark.')});
var q=new URLSearchParams(location.search),qm=q.get('m'),qt=q.get('t');
if(qm!==null&&P[+qm]){m=+qm;document.querySelectorAll('[data-m]').forEach(function(b){b.setAttribute('aria-pressed',+b.dataset.m==m)})}
if(qt==='1')$('du').value='30';if(qt==='2')$('du').value='180';
size();raf=requestAnimationFrame(loop);if(qt==='1'||qt==='2')setTimeout(begin,600);
})();
