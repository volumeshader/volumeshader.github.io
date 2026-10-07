(function(){
var host=document.getElementById('vs');if(!host)return;
host.innerHTML='<div class="tool" id="tl"><canvas id="cv"></canvas><div class="ov" id="ov"><button id="go" class="big">Start test</button><p>May cause lag on older devices</p></div><div class="hud" id="hud" hidden><b id="f">0</b><span>FPS</span><div class="chips"><i>AVG <b id="a">-</b></i><i>1% LOW <b id="l">-</b></i><i>MIN <b id="mn">-</b></i><i>STABLE <b id="s">-</b>%</i></div></div><div class="ctl"><button id="stop" aria-label="Stop (P)" hidden>&#9632;</button><button id="fs" aria-label="Fullscreen">&#9974;</button></div></div><div class="row"><small>Complexity</small><span role="group" aria-label="Complexity"><button data-m="0">Simple</button><button data-m="1" aria-pressed="true">Standard</button><button data-m="2">Advanced</button><button data-m="3">Extreme</button></span><small>Run for</small><select id="du" aria-label="Duration"><option value="0">Free run</option><option value="30">30 seconds</option><option value="180">3 minutes</option></select><button id="sh">Share</button></div><p class="note" id="gpu"></p>';
var $=function(i){return document.getElementById(i)},cv=$('cv'),ov=$('ov'),tl=$('tl');
var gl=cv.getContext('webgl2',{antialias:false,powerPreference:'high-performance'})||cv.getContext('webgl',{antialias:false,powerPreference:'high-performance'});
if(!gl){ov.innerHTML='<h3>WebGL not supported</h3><p>Try Chrome, Firefox, Safari or Edge, and make sure hardware acceleration is on.</p>';return}
var v2=!!(window.WebGL2RenderingContext&&gl instanceof WebGL2RenderingContext);
var P=[{n:'Simple',s:48,i:4,k:.5},{n:'Standard',s:80,i:7,k:.8},{n:'Advanced',s:110,i:10,k:1},{n:'Extreme',s:128,i:14,k:1.25}],m=1,run=false,raf=0;
var fs='precision highp float;uniform vec2 R;uniform vec3 O,G;uniform int S,I;float tr;'+
'float de(vec3 p){vec3 z=p;float dr=1.,r=0.;tr=9.;for(int i=0;i<16;i++){if(i>=I)break;r=length(z);if(r>2.)break;tr=min(tr,r);float th=acos(clamp(z.z/r,-1.,1.))*8.,ph=atan(z.y,z.x)*8.;dr=pow(r,7.)*8.*dr+1.;z=pow(r,8.)*vec3(sin(th)*cos(ph),sin(ph)*sin(th),cos(th))+p;}return .5*log(r)*r/dr;}'+
'void main(){vec2 u=(gl_FragCoord.xy*2.-R)/R.y;vec3 f=normalize(G-O),rt=normalize(cross(f,vec3(0,1,0))),up=cross(rt,f),rd=normalize(f*1.6+rt*u.x+up*u.y);'+
'float d=0.,n=0.,gw=0.;bool hit=false;for(int i=0;i<128;i++){if(i>=S)break;float h=de(O+rd*d);gw+=.012/(.04+h*h*40.);if(h<.0012){hit=true;break;}d+=h;n+=1.;if(d>8.)break;}'+
'vec3 bg=mix(vec3(.04,.03,.12),vec3(.1,.04,.2),.5+.5*u.y);vec3 c=hit?(.5+.5*cos(6.28*(tr*.7+vec3(0.,.15,.3))))*(1.15-n/float(S)):bg;c+=vec3(.5,.25,.9)*gw*.012;gl_FragColor=vec4(c,1);}';
function sh(t,s){var o=gl.createShader(t);gl.shaderSource(o,s);gl.compileShader(o);return o}
var pr=gl.createProgram();gl.attachShader(pr,sh(gl.VERTEX_SHADER,'attribute vec2 p;void main(){gl_Position=vec4(p,0,1);}'));gl.attachShader(pr,sh(gl.FRAGMENT_SHADER,fs));gl.linkProgram(pr);
if(!gl.getProgramParameter(pr,gl.LINK_STATUS)){ov.innerHTML='<h3>Shader could not start</h3><p>This GPU or browser rejected the shader. Try another browser.</p>';return}
gl.useProgram(pr);gl.bindBuffer(gl.ARRAY_BUFFER,gl.createBuffer());gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);
var al=gl.getAttribLocation(pr,'p');gl.enableVertexAttribArray(al);gl.vertexAttribPointer(al,2,gl.FLOAT,false,0,0);
var U={};['R','O','G','S','I'].forEach(function(k){U[k]=gl.getUniformLocation(pr,k)});
var e=gl.getExtension('WEBGL_debug_renderer_info'),rend=e?gl.getParameter(e.UNMASKED_RENDERER_WEBGL):'GPU name hidden by browser';
$('gpu').textContent='GPU: '+rend+' | WebGL '+(v2?2:1)+' | Screen '+screen.width+'x'+screen.height+' @'+(window.devicePixelRatio||1)+'x. Drag to rotate, scroll or pinch to zoom, right-click or two fingers to pan, P to stop, Space to reset.';
var yaw,pit,dist,tg;function reset(){yaw=.7;pit=.35;dist=3.1;tg=[0,0,0]}reset();
function size(){var r=cv.getBoundingClientRect(),d=Math.min(window.devicePixelRatio||1,2)*P[m].k;cv.width=Math.max(2,Math.round(r.width*d));cv.height=Math.max(2,Math.round(r.height*d));gl.viewport(0,0,cv.width,cv.height)}
function draw(){var cp=Math.cos(pit);gl.uniform2f(U.R,cv.width,cv.height);gl.uniform3f(U.O,tg[0]+dist*cp*Math.sin(yaw),tg[1]+dist*Math.sin(pit),tg[2]+dist*cp*Math.cos(yaw));gl.uniform3f(U.G,tg[0],tg[1],tg[2]);gl.uniform1i(U.S,P[m].s);gl.uniform1i(U.I,P[m].i);gl.drawArrays(gl.TRIANGLES,0,3)}
var pts={};cv.style.touchAction='none';cv.oncontextmenu=function(x){x.preventDefault()};
function pan(dx,dy){var k=dist*.0022;tg[0]+=(-Math.cos(yaw)*dx)*k;tg[2]+=(Math.sin(yaw)*dx)*k;tg[1]+=dy*k}
cv.onpointerdown=function(x){cv.setPointerCapture(x.pointerId);pts[x.pointerId]={x:x.clientX,y:x.clientY,b:x.button}};
cv.onpointerup=cv.onpointercancel=function(x){delete pts[x.pointerId]};
cv.onpointermove=function(x){var p=pts[x.pointerId];if(!p)return;var ks=Object.keys(pts),dx=x.clientX-p.x,dy=x.clientY-p.y;
if(ks.length==1){if(p.b==2||x.shiftKey)pan(dx,dy);else{yaw-=dx*.006;pit=Math.max(-1.45,Math.min(1.45,pit+dy*.006))}}
else{var q=pts[ks[0]==x.pointerId?ks[1]:ks[0]],pd=Math.hypot(p.x-q.x,p.y-q.y),nd=Math.hypot(x.clientX-q.x,x.clientY-q.y);if(nd>0)dist=Math.max(1.5,Math.min(8,dist*pd/nd));pan(dx/2,dy/2)}
p.x=x.clientX;p.y=x.clientY};
cv.addEventListener('wheel',function(x){x.preventDefault();dist=Math.max(1.5,Math.min(8,dist*Math.exp(x.deltaY*.001)))},{passive:false});
var R=new Float32Array(8192),rn=0,tot=0,cnt=0,last,t0,dur,wa,wn,mx;
function stats(){var n=Math.min(rn,8192),a=Array.prototype.slice.call(R,0,n).sort(function(x,y){return y-x}),k=Math.max(1,Math.ceil(n*.01)),w=0,s=0,i;for(i=0;i<k;i++)w+=a[i];for(i=0;i<n;i++)s+=a[i];var mean=s/n,v=0;for(i=0;i<n;i++)v+=(a[i]-mean)*(a[i]-mean);
return{low:1000/(w/k),min:1000/a[0],max:1000/a[n-1],st:Math.max(0,Math.round(100*(1-Math.sqrt(v/n)/mean)))}}
function loop(now){if(!run)return;var d=now-last;last=now;if(d>0&&d<1000){R[rn++%8192]=d;tot+=d;cnt++;wa+=d;wn++}draw();
if(wa>=500){var s=stats();$('f').textContent=Math.round(1000*wn/wa);$('a').textContent=(1000*cnt/tot).toFixed(1);$('l').textContent=s.low.toFixed(1);$('mn').textContent=s.min.toFixed(1);$('s').textContent=s.st;wa=0;wn=0}
if(dur&&now-t0>=dur*1000){stop();return}raf=requestAnimationFrame(loop)}
function start(){ov.hidden=true;$('hud').hidden=false;$('stop').hidden=false;rn=0;tot=0;cnt=0;wa=0;wn=0;dur=+$('du').value;size();run=true;last=t0=performance.now();raf=requestAnimationFrame(loop)}
function stop(){if(!run)return;run=false;cancelAnimationFrame(raf);$('hud').hidden=true;$('stop').hidden=true;
if(cnt<10){ov.hidden=false;return}var s=stats(),c=function(l,v){return'<div><b>'+v+'</b><span>'+l+'</span></div>'};
ov.innerHTML='<h3>Your result</h3><div class="res">'+c('Average FPS',(1000*cnt/tot).toFixed(1))+c('1% low FPS',s.low.toFixed(1))+c('Minimum FPS',s.min.toFixed(1))+c('Maximum FPS',s.max.toFixed(1))+c('Stability',s.st+'%')+c('Duration',Math.round(tot/1000)+' s')+c('Complexity',P[m].n)+c('Resolution',cv.width+'x'+cv.height)+'</div><button id="go" class="big">Run again</button>';
ov.hidden=false;$('go').onclick=start}
$('go').onclick=start;$('stop').onclick=stop;
document.querySelectorAll('[data-m]').forEach(function(b){b.setAttribute('aria-pressed',+b.dataset.m==m);b.onclick=function(){m=+b.dataset.m;document.querySelectorAll('[data-m]').forEach(function(y){y.setAttribute('aria-pressed',y===b)});size();if(!run)draw()}});
$('fs').onclick=function(){var d=document;if(d.fullscreenElement||d.webkitFullscreenElement){(d.exitFullscreen||d.webkitExitFullscreen).call(d)}else{(tl.requestFullscreen||tl.webkitRequestFullscreen).call(tl)}};
$('sh').onclick=function(){var u=location.href.split('?')[0];if(navigator.share)navigator.share({title:document.title,url:u}).catch(function(){});else if(navigator.clipboard){navigator.clipboard.writeText(u);$('sh').textContent='Link copied'}};
addEventListener('keydown',function(x){if(x.key==='p'||x.key==='P')stop();if(x.key===' '&&x.target===document.body){x.preventDefault();reset()}});
addEventListener('resize',function(){size();if(!run)draw()});document.addEventListener('fullscreenchange',function(){setTimeout(function(){size();if(!run)draw()},100)});
document.addEventListener('visibilitychange',function(){if(document.hidden)stop()});
cv.addEventListener('webglcontextlost',function(x){x.preventDefault();stop()});
var q=new URLSearchParams(location.search),qm=q.get('m'),qt=q.get('t');if(qm!==null&&P[+qm]){m=+qm;document.querySelectorAll('[data-m]').forEach(function(b){b.setAttribute('aria-pressed',+b.dataset.m==m)})}
if(qt==='1')$('du').value='30';if(qt==='2')$('du').value='180';
size();draw();
})();
