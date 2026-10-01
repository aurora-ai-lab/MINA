/* Coolcat sky: a tiny progressive WebGL backdrop with CSS fallback. */
(() => {
  const canvas = document.querySelector('#sky-canvas');
  if (!canvas) return;
  const intro = document.querySelector('#intro-screen');
  const introSkip = document.querySelector('#intro-skip');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (intro) {
    const seen = sessionStorage.getItem('coolcat-intro-seen');
    if (seen || reduce.matches) intro.remove();
    else {
      sessionStorage.setItem('coolcat-intro-seen', '1');
      const dismiss = () => { intro.classList.add('is-done'); setTimeout(() => intro.remove(), 700); };
      introSkip?.addEventListener('click', dismiss);
      setTimeout(dismiss, 1700);
    }
  }
  const toggle = document.querySelector('#motion-toggle');
  let paused = reduce.matches || localStorage.getItem('coolcat-motion') === 'paused';
  let progress = 0, frame = 0, gl, program, time = 0;
  const vertex = `attribute vec2 p; varying vec2 uv; void main(){uv=p*.5+.5; gl_Position=vec4(p,0.,1.);}`;
  const fragment = `precision mediump float; varying vec2 uv; uniform float u_time; uniform float u_progress;
    float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
    float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
    float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<4;i++){v+=a*noise(p);p=p*2.02+4.;a*=.5;}return v;}
    void main(){float p=clamp(u_progress,0.,1.);vec3 dayTop=vec3(.55,.78,.95),dayBot=vec3(.10,.42,.78);vec3 duskTop=vec3(.98,.46,.36),duskBot=vec3(.28,.18,.42);vec3 nightTop=vec3(.10,.10,.28),nightBot=vec3(.02,.02,.07);vec3 top=mix(mix(dayTop,duskTop,smoothstep(.28,.56,p)),nightTop,smoothstep(.60,.88,p));vec3 bot=mix(mix(dayBot,duskBot,smoothstep(.28,.56,p)),nightBot,smoothstep(.60,.88,p));vec3 col=mix(bot,top,pow(uv.y,.72));float n=fbm(vec2(uv.x*3.5+u_time*.006,uv.y*2.5-u_time*.003));float cloud=smoothstep(.55,.76,n)*smoothstep(.12,.72,uv.y)*(1.-smoothstep(.68,.92,p));col=mix(col,vec3(.92,.96,1.),cloud*.38);float sun=exp(-length((uv-vec2(.78,.78))*vec2(1.,1.2))*12.);col+=vec3(1.,.72,.4)*sun*(1.-smoothstep(.3,.76,p));float stars=step(.82,p)*step(.91,hash(floor(uv*vec2(95.,58.))))*smoothstep(.36,.88,uv.y);col+=vec3(1.,.82,.58)*stars*(.35+.3*sin(u_time*2.+uv.x*40.));gl_FragColor=vec4(col,1.);}`;
  const compile = (type, source) => { const shader = gl.createShader(type); gl.shaderSource(shader, source); gl.compileShader(shader); return gl.getShaderParameter(shader, gl.COMPILE_STATUS) ? shader : null; };
  function setup() { gl = canvas.getContext('webgl', { alpha: false, antialias: false, powerPreference: 'low-power' }); if (!gl) return false; const vs = compile(gl.VERTEX_SHADER, vertex), fs = compile(gl.FRAGMENT_SHADER, fragment); if (!vs || !fs) return false; program = gl.createProgram(); gl.attachShader(program, vs); gl.attachShader(program, fs); gl.linkProgram(program); if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return false; const buffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buffer); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,1,1]), gl.STATIC_DRAW); const loc = gl.getAttribLocation(program, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0); gl.useProgram(program); program.uTime = gl.getUniformLocation(program, 'u_time'); program.uProgress = gl.getUniformLocation(program, 'u_progress'); resize(); return true; }
  function resize() { if (!gl) return; const dpr = Math.min(devicePixelRatio || 1, 1.5); canvas.width = innerWidth * dpr; canvas.height = innerHeight * dpr; gl.viewport(0, 0, canvas.width, canvas.height); }
  function getProgress() { const max = Math.max(1, document.documentElement.scrollHeight - innerHeight); return Math.min(1, Math.max(0, scrollY / max)); }
  function draw(now) { progress += (getProgress() - progress) * .08; document.documentElement.style.setProperty('--sky-progress', progress.toFixed(3)); if (gl) { gl.uniform1f(program.uTime, time); gl.uniform1f(program.uProgress, progress); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); } time = now * .001; if (!paused && !document.hidden) frame = requestAnimationFrame(draw); }
  function restart() { cancelAnimationFrame(frame); if (!paused) frame = requestAnimationFrame(draw); else draw(time * 1000); }
  if (!setup()) canvas.hidden = true;
  addEventListener('resize', resize, { passive: true }); addEventListener('scroll', () => { if (paused) draw(time * 1000); }, { passive: true }); document.addEventListener('visibilitychange', restart);
  if (toggle) { toggle.setAttribute('aria-pressed', String(paused)); toggle.textContent = paused ? '播放动效' : '暂停动效'; toggle.addEventListener('click', () => { paused = !paused; localStorage.setItem('coolcat-motion', paused ? 'paused' : 'playing'); toggle.setAttribute('aria-pressed', String(paused)); toggle.textContent = paused ? '播放动效' : '暂停动效'; restart(); }); }
  reduce.addEventListener?.('change', () => { paused = reduce.matches; if (toggle) { toggle.setAttribute('aria-pressed', String(paused)); toggle.textContent = paused ? '播放动效' : '暂停动效'; } restart(); });
  restart();
})();
