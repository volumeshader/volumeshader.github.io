(function(){
var host=document.getElementById('vs');if(!host)return;
host.innerHTML='<div class="tool" id="tl"><canvas id="cv"></canvas><div class="ov" id="ov" hidden></div><div class="hud" id="hud"><b id="f">0</b><span>FPS</span><div class="chips"><i>AVG <b id="a">-</b></i><i>1% LOW <b id="l">-</b></i><i>MIN <b id="mn">-</b></i><i>STABLE <b id="s">-</b>%</i></div></div><div class="ctl"><button id="ps" aria-label="Pause or resume (P)">&#10074;&#10074;</button><button id="fs" aria-label="Fullscreen">&#9974;</button></div></div><div class="row"><small>Complexity</small><span role="group" aria-label="Complexity"><button data-m="0">Simple</button><button data-m="1" aria-pressed="true">Standard</button><button data-m="2">Advanced</button><button data-m="3">Extreme</button></span><small>Run for</small><select id="du" aria-label="Duration"><option value="0">Until I stop</option><option value="30">30 seconds</option><option value="180">3 minutes</option></select><button id="go" class="big" style="font-size:16px;padding:10px 22px">Run benchmark</button><button id="sh">Share</button></div><p class="note" id="gpu"></p>';
var $=function(i){return document.getElementById(i)},cv=$('cv'),ov=$('ov'),tl=$('tl');
var gl=cv.getContext('webgl2',{antialias:false,powerPreference:'high-performance'})||cv.getContext('webgl',{antialias:false,powerPreference:'high-performance'});
if(!gl){ov.hidden=false;ov.innerHTML='<h3>WebGL not supported</h3><p>Try Chrome, Firefox, Safari or Edge, and make sure hardware acceleration is on.</p>';return}
var v2=!!(window.WebGL2RenderingContext&&gl instanceof WebGL2RenderingContext);
var P=[
  {n:'Simple',s:250,i:2,k:0.6},
  {n:'Standard',s:1002,i:5,k:0.85},
  {n:'Advanced',s:1500,i:7,k:1.1},
  {n:'Extreme',s:2000,i:9,k:1.4}
],m=1,run=false,raf=0;
var fs='precision highp float;uniform vec2 R;uniform vec3 O,G;uniform int S,I;'+'float kernal(vec3 ver){vec3 a=ver;float b,c,d,e;for(int i=0;i<16;i++){if(i>=I)break;b=length(a);if(b>6.0)break;c=atan(a.y,a.x)*8.0;e=1.0/b;d=acos(clamp(a.z/b,-1.0,1.0))*8.0;b=pow(b,8.0);a=vec3(b*sin(d)*cos(c),b*sin(d)*sin(c),b*cos(d))+ver;}return 4.0-dot(a,a);}'+'void main(){vec2 u=(gl_FragCoord.xy*2.0-R)/R.y;vec3 f=normalize(G-O),rt=normalize(cross(f,vec3(0.0,1.0,0.0))),up=cross(rt,f),rd=normalize(f*1.6+rt*u.x+up*u.y);'+'vec3 bg=mix(vec3(0.04,0.03,0.12),vec3(0.12,0.05,0.22),0.5+0.5*u.y);vec3 col=bg;float stepSz=0.002*3.1;float v1=kernal(O+rd*stepSz),v2=kernal(O);int hit=0;float tHit=0.0;'+'for(int k=2;k<2000;k++){if(k>=S)break;vec3 ver=O+rd*(stepSz*float(k));float v=kernal(ver);'+'if(v>0.0&&v1<0.0){float r1=stepSz*float(k-1),r2=stepSz*float(k);for(int l=0;l<8;l++){float r3=0.5*(r1+r2);float m3=kernal(O+rd*r3);if(m3>0.0){r2=r3;}else{r1=r3;}}tHit=0.5*(r1+r2);hit=1;break;}'+'if(v<v1&&v1>v2&&v1<0.0&&(v1*2.0>v||v1*2.0>v2)){float r1=stepSz*float(k-2),r2=stepSz*float(k);for(int l=0;l<8;l++){float r3=0.5*(r1+r2);float m3=kernal(O+rd*r3);if(m3>0.0){r2=r3;}else{r1=r3;}}tHit=0.5*(r1+r2);hit=1;break;}'+'v2=v1;v1=v;}'+'if(hit==1){vec3 p=O+rd*tHit;float e=0.001*tHit;vec3 n=normalize(vec3(kernal(p+vec3(e,0,0))-kernal(p-vec3(e,0,0)),kernal(p+vec3(0,e,0))-kernal(p-vec3(0,e,0)),kernal(p+vec3(0,0,e))-kernal(p-vec3(0,0,e))));'+'float dif=max(0.0,dot(n,normalize(vec3(0.4,0.7,0.3))));float fre=pow(1.0-max(0.0,dot(n,-rd)),3.0);'+'col=mix(vec3(0.15,0.08,0.35),vec3(0.95,0.55,0.85),dif)*0.85+vec3(0.4,0.7,1.0)*fre*0.6+vec3(0.1);col*=1.0/(1.0+tHit*0.08);}'+'gl_FragColor=vec4(col,1.0);}';
function sh(t,s){var o=gl.createShader(t);gl.shaderSource(o,s);gl.compileShader(o);return o}
var pr=gl.createProgram();gl.attachShader(pr,sh(gl.VERTEX_SHADER,'attribute vec2 p;void main(){gl_Position=vec4(p,0,1);}'));gl.attachShader(pr,sh(gl.FRAGMENT_SHADER,fs));gl.linkProgram(pr);
if(!gl.getProgramParameter(pr,gl.LINK_STATUS)){ov.hidden=false;ov.innerHTML='<h3>Shader could not start</h3><p>This GPU or browser rejected the shader. Try another browser.</p>';return}
gl.useProgram(pr);gl.bindBuffer(gl.ARRAY_BUFFER,gl.createBuffer());gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);
var al=gl.getAttribLocation(pr,'p');gl.enableVertexAttribArray(al);gl.vertexAttribPointer(al,2,gl.FLOAT,false,0,0);
var U={};['R','O','G','S','I'].forEach(function(k){U[k]=gl.getUniformLocation(pr,k)});
var e=gl.getExtension('WEBGL_debug_renderer_info'),rend=e?gl.getParameter(e.UNMASKED_RENDERER_WEBGL):'GPU name hidden by browser';
$('gpu').textContent='GPU: '+rend+' | WebGL '+(v2?2:1)+' | Screen '+screen.width+'x'+screen.height+' @'+(window.devicePixelRatio||1)+'x. Drag to rotate, scroll or pinch to zoom, right-click or two fingers to pan, P to pause, Space to reset.';
var yaw,pit,dist,tg;function reset(){yaw=.7;pit=.35;dist=3.1;tg=[0,0,0]}reset();
function size(){var r=cv.getBoundingClientRect(),d=Math.min(window.devicePixelRatio||1,2.5)*P[m].k,w=r.width*d,h=r.height*d,c=Math.sqrt(Math.min(1,4.5e6/(w*h)));cv.width=Math.max(2,Math.round(w*c));cv.height=Math.max(2,Math.round(h*c));gl.viewport(0,0,cv.width,cv.height)}
function draw(){var cp=Math.cos(pit);gl.uniform2f(U.R,cv.width,cv.height);gl.uniform3f(U.O,tg[0]+dist*cp*Math.sin(yaw),tg[1]+dist*Math.sin(pit),tg[2]+dist*cp*Math.cos(yaw));gl.uniform3f(U.G,tg[0],tg[1],tg[2]);gl.uniform1i(U.S,P[m].s);gl.uniform1i(U.I,P[m].i);gl.drawArrays(gl.TRIANGLES,0,3)}
var pts={};cv.style.touchAction='none';cv.oncontextmenu=function(x){x.preventDefault()};
function pan(dx,dy){var k=dist*.0022;tg[0]+=(-Math.cos(yaw)*dx)*k;tg[2]+=(Math.sin(yaw)*dx)*k;tg[1]+=dy*k}
cv.onpointerdown=function(x){idle=false;cv.setPointerCapture(x.pointerId);pts[x.pointerId]={x:x.clientX,y:x.clientY,b:x.button}};
cv.onpointerup=cv.onpointercancel=function(x){delete pts[x.pointerId]};
cv.onpointermove=function(x){var p=pts[x.pointerId];if(!p)return;var ks=Object.keys(pts),dx=x.clientX-p.x,dy=x.clientY-p.y;
if(ks.length==1){if(p.b==2||x.shiftKey)pan(dx,dy);else{yaw-=dx*.006;pit=Math.max(-1.45,Math.min(1.45,pit+dy*.006))}}
else{var q=pts[ks[0]==x.pointerId?ks[1]:ks[0]],pd=Math.hypot(p.x-q.x,p.y-q.y),nd=Math.hypot(x.clientX-q.x,x.clientY-q.y);if(nd>0)dist=Math.max(1.5,Math.min(8,dist*pd/nd));pan(dx/2,dy/2)}
p.x=x.clientX;p.y=x.clientY;if(paused)draw()};
cv.addEventListener('wheel',function(x){x.preventDefault();dist=Math.max(1.5,Math.min(8,dist*Math.exp(x.deltaY*.001)))},{passive:false});
var L=new Float32Array(4096),ln=0,M=new Float32Array(65536),mn=0,mtot=0,mcnt=0,wa=0,wn=0,last=performance.now(),paused=true,started=false,inview=true,idle=true,meas=false,t0=0,dur=0,slow=0;
function stats(a,n){n=Math.min(n,a.length);if(n<5)return null;var s=Array.prototype.slice.call(a,0,n).sort(function(x,y){return y-x}),k=Math.max(1,Math.ceil(n*.01)),w=0,t=0,i;for(i=0;i<k;i++)w+=s[i];for(i=0;i<n;i++)t+=s[i];var mean=t/n,v=0;for(i=0;i<n;i++)v+=(s[i]-mean)*(s[i]-mean);
return{avg:1000/mean,low:1000/(w/k),min:1000/s[0],max:1000/s[n-1],st:Math.max(0,Math.round(100*(1-Math.sqrt(v/n)/mean)))}}
function loop(now){if(!started)return;raf=requestAnimationFrame(loop);var d=now-last;last=now;if(paused||!inview)return;if(d>4000&&d<30000&&m>0)slow++;else slow=0;if(slow>=4){slow=0;lower();return}
if(d>0&&d<1000){L[ln++%4096]=d;wa+=d;wn++;if(meas){M[mn++%65536]=d;mtot+=d;mcnt++}}
if(idle)yaw+=d*.00022;draw();
if(wa>=500){var s=stats(L,ln);$('f').textContent=Math.round(1000*wn/wa);if(s){$('a').textContent=s.avg.toFixed(1);$('l').textContent=s.low.toFixed(1);$('mn').textContent=s.min.toFixed(1);$('s').textContent=s.st}wa=0;wn=0}
if(meas&&dur&&now-t0>=dur*1000)finish()}
function lower(){m--;if(meas)finish();document.querySelectorAll('[data-m]').forEach(function(b){b.setAttribute('aria-pressed',+b.dataset.m==m)});size();ln=0;$('gpu').textContent='This level was too heavy for your GPU, so the test stepped down to '+P[m].n+' to keep your device responsive.'}
function begin(){mn=0;mtot=0;mcnt=0;dur=+$('du').value;t0=performance.now();meas=true;ov.hidden=true;if(paused)setPause(false);$('go').textContent='Stop and see result'}
function finish(){meas=false;$('go').textContent='Run benchmark';var s=stats(M,mn);if(!s)return;var c=function(l,v){return'<div><b>'+v+'</b><span>'+l+'</span></div>'};
ov.innerHTML='<h3>Your result</h3><div class="res">'+c('Average FPS',(1000*mcnt/mtot).toFixed(1))+c('1% low FPS',s.low.toFixed(1))+c('Minimum FPS',s.min.toFixed(1))+c('Maximum FPS',s.max.toFixed(1))+c('Stability',s.st+'%')+c('Duration',Math.round(mtot/1000)+' s')+c('Complexity',P[m].n)+c('Resolution',cv.width+'x'+cv.height)+'</div><button id="cl" class="big">Close</button>';
ov.hidden=false;$('cl').onclick=function(){ov.hidden=true}}
function setPause(v){paused=v;last=performance.now();$('ps').innerHTML=v?'&#9654;':'&#10074;&#10074;';if(v)draw()}
function startLive(){if(started)return;started=true;ov.hidden=true;setPause(false);last=performance.now();raf=requestAnimationFrame(loop)}
$('go').onclick=function(){if(!started)startLive();meas?finish():begin()};$('ps').onclick=function(){if(!started){startLive();return}setPause(!paused)};
document.querySelectorAll('[data-m]').forEach(function(b){b.setAttribute('aria-pressed',+b.dataset.m==m);b.onclick=function(){m=+b.dataset.m;document.querySelectorAll('[data-m]').forEach(function(y){y.setAttribute('aria-pressed',y===b)});size();ln=0;if(started&&paused)draw();if(m==3)$('gpu').textContent='Extreme uses ~2000 ray steps + 9 Mandelbulb iterations (same as original Volume Shader BM). It can freeze weak PCs and throttle strong ones. Close other tabs. The test only steps down if frames take over 4 seconds repeatedly.'}});
$('fs').onclick=function(){var d=document;if(d.fullscreenElement||d.webkitFullscreenElement){(d.exitFullscreen||d.webkitExitFullscreen).call(d)}else{(tl.requestFullscreen||tl.webkitRequestFullscreen).call(tl)}};
$('sh').onclick=function(){var u=location.href.split('?')[0];if(navigator.share)navigator.share({title:document.title,url:u}).catch(function(){});else if(navigator.clipboard){navigator.clipboard.writeText(u);$('sh').textContent='Link copied'}};
addEventListener('keydown',function(x){if(x.key==='p'||x.key==='P')setPause(!paused);if(x.key===' '&&x.target===document.body){x.preventDefault();reset();idle=true;if(paused)draw()}});
addEventListener('resize',function(){size();if(paused)draw()});document.addEventListener('fullscreenchange',function(){setTimeout(function(){size();if(paused)draw()},100)});
if(window.IntersectionObserver)new IntersectionObserver(function(e){inview=e[0].isIntersecting}).observe(tl);
cv.addEventListener('webglcontextlost',function(x){x.preventDefault();paused=true});
var q=new URLSearchParams(location.search),qm=q.get('m'),qt=q.get('t');
if(qm!==null&&P[+qm]){m=+qm;document.querySelectorAll('[data-m]').forEach(function(b){b.setAttribute('aria-pressed',+b.dataset.m==m)})}
if(qt==='1')$('du').value='30';if(qt==='2')$('du').value='180';
size();
ov.hidden=false;
ov.innerHTML='<h3>Ready when you are</h3><p>Pick a complexity level below, then press Start. The GPU test does not run until you start it.</p><button id="st" class="big">Start test</button>';
$('st').onclick=function(){startLive()};
$('ps').innerHTML='&#9654;';
if(qt==='1'||qt==='2'){startLive();setTimeout(begin,600)}
})();
