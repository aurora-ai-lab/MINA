// Dependency-free realtime 3D planet. CSS remains visible if WebGL is unavailable.
const stage = document.querySelector('#hero-stage');
const canvas = document.querySelector('#hero-canvas');
const control = document.querySelector('#hero-motion');
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const savedPause = (() => { try { return localStorage.getItem('mina-hero-paused') === 'true'; } catch { return false; } })();
let paused = savedPause || reduced.matches || document.body.classList.contains('retro-ui');
let visible = true;
let frame = 0;
let previous = 0;
let rotation = 0;
let tilt = -0.38;
let velocityX = 0;
let velocityY = 0;
let zoom = 1;
let targetZoom = 1;
let pointerX = 0;
let pointerY = 0;
let render = () => {};

function updateControl() {
  stage.classList.toggle('motion-paused', paused);
  control.setAttribute('aria-pressed', String(paused));
  control.textContent = paused ? '播放动效' : '暂停动效';
  try { localStorage.setItem('mina-hero-paused', String(paused)); } catch {}
  document.dispatchEvent(new CustomEvent('coolcat-motion', { detail: { paused } }));
}
function tick(now) {
  frame = 0;
  if (document.hidden || !visible) return;
  const dt = previous ? Math.min(now - previous, 50) / 1000 : 0;
  previous = now;
  if (!paused) {
    rotation += 0.05 * dt + velocityX;
    tilt = Math.max(-0.8, Math.min(0.8, tilt + velocityY));
    velocityX *= 0.92; velocityY *= 0.92;
    zoom += (targetZoom - zoom) * 0.08;
  }
  render(now / 1000);
  if (!paused) frame = requestAnimationFrame(tick);
}
function refresh() { cancelAnimationFrame(frame); previous = 0; frame = requestAnimationFrame(tick); }

control.addEventListener('click', () => { paused = !paused; updateControl(); refresh(); });
reduced.addEventListener('change', () => { paused = reduced.matches; updateControl(); refresh(); });
document.addEventListener('visibilitychange', () => { stage.classList.toggle('hero-inactive', document.hidden || !visible); refresh(); });
if ('IntersectionObserver' in window) new IntersectionObserver(([entry]) => {
  visible = entry.isIntersecting; stage.classList.toggle('hero-inactive', document.hidden || !visible); refresh();
}).observe(stage);
updateControl();

try {
  const gl = canvas.getContext('webgl', { alpha: true, antialias: true, powerPreference: 'high-performance' });
  if (!gl) throw new Error('WebGL unavailable');
  const mobile = matchMedia('(max-width: 767px)').matches;

  function shader(type, source) {
    const item = gl.createShader(type); gl.shaderSource(item, source); gl.compileShader(item);
    if (!gl.getShaderParameter(item, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(item));
    return item;
  }
  function program(vertexSource, fragmentSource) {
    const item = gl.createProgram(); gl.attachShader(item, shader(gl.VERTEX_SHADER, vertexSource)); gl.attachShader(item, shader(gl.FRAGMENT_SHADER, fragmentSource)); gl.linkProgram(item);
    if (!gl.getProgramParameter(item, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(item));
    return item;
  }
  function sphereData(latitudes, longitudes) {
    const positions = [], normals = [], uvs = [], indices = [];
    for (let y = 0; y <= latitudes; y++) {
      const v = y / latitudes, phi = v * Math.PI;
      for (let x = 0; x <= longitudes; x++) {
        const u = x / longitudes, theta = u * Math.PI * 2;
        const nx = Math.sin(phi) * Math.cos(theta), ny = Math.cos(phi), nz = Math.sin(phi) * Math.sin(theta);
        positions.push(nx, ny, nz); normals.push(nx, ny, nz); uvs.push(u, v);
      }
    }
    for (let y = 0; y < latitudes; y++) for (let x = 0; x < longitudes; x++) {
      const a = y * (longitudes + 1) + x, b = a + longitudes + 1;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
    return { positions, normals, uvs, indices };
  }
  function ringData(segments) {
    const positions = [], uvs = [], indices = [];
    for (let i = 0; i <= segments; i++) {
      const t = i / segments * Math.PI * 2, c = Math.cos(t), s = Math.sin(t);
      positions.push(c * 0.7, s * 0.7, 0, c * 1.12, s * 1.12, 0); uvs.push(0, i / segments, 1, i / segments);
      if (i < segments) { const n = i * 2; indices.push(n, n + 1, n + 2, n + 1, n + 3, n + 2); }
    }
    return { positions, uvs, indices };
  }
  function buffer(target, data, type) { const item = gl.createBuffer(); gl.bindBuffer(target, item); gl.bufferData(target, new (type || Float32Array)(data), gl.STATIC_DRAW); return item; }
  function attr(item, name, size, bufferItem) { const location = gl.getAttribLocation(item, name); if (location < 0) return; gl.bindBuffer(gl.ARRAY_BUFFER, bufferItem); gl.enableVertexAttribArray(location); gl.vertexAttribPointer(location, size, gl.FLOAT, false, 0, 0); }

  const vertexCommon = `
    attribute vec3 position; attribute vec3 normal; attribute vec2 uv;
    uniform float rotation, tilt, zoom, aspect; uniform vec2 camera;
    varying vec3 vPosition, vNormal; varying vec2 vUv;
    mat3 ry(float a){float c=cos(a),s=sin(a);return mat3(c,0.,-s,0.,1.,0.,s,0.,c);}
    mat3 rx(float a){float c=cos(a),s=sin(a);return mat3(1.,0.,0.,0.,c,-s,0.,s,c);}
    void main(){ vec3 p=rx(tilt)*ry(rotation)*position; vPosition=p; vNormal=normalize(rx(tilt)*ry(rotation)*normal); vUv=uv; float z=3.15/zoom; p.xy-=camera*.12; gl_Position=vec4(p.x/(z*.56*aspect),p.y/(z*.56),p.z/z,1.); }
  `;
  const planetProgram = program(vertexCommon, `
    precision highp float; varying vec3 vPosition,vNormal; varying vec2 vUv; uniform float time;
    float hash(vec3 p){p=fract(p*.3183099+.1);p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
    float noise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
    float fbm(vec3 p){float v=0.,a=.5;for(int i=0;i<4;i++){v+=a*noise(p);p=p*2.03+4.1;a*=.5;}return v;}
    void main(){
      float rock=fbm(vPosition*4.8), detail=fbm(vPosition*12.0+3.); float cracks=smoothstep(.79,.96,1.-abs(detail*2.-1.));
      vec3 base=mix(vec3(.035,.018,.09),vec3(.22,.09,.27),rock); base=mix(base,vec3(.38,.16,.40),smoothstep(.55,.82,rock));
      vec3 normal=normalize(vNormal); vec3 light=normalize(vec3(-.55,.72,1.)); float ndl=smoothstep(.05,.85,dot(normal,light));
      float pulse=.76+.24*sin(time*1.8); vec3 lava=vec3(.91,.27,.92); vec3 color=mix(base,lava,cracks*.82); color+=lava*cracks*pulse*.65;
      float night=1.-ndl; color+=lava*night*cracks*.22; gl_FragColor=vec4(color*(.22+ndl*.9),1.);
    }
  `);
  const atmosphereProgram = program(vertexCommon.replace('position; normal;', 'position; normal;'), `
    precision mediump float; varying vec3 vPosition,vNormal; uniform float time;
    void main(){vec3 V=normalize(vec3(-vPosition.xy,3.));float rim=pow(1.-max(dot(normalize(vNormal),V),0.),3.);vec3 color=mix(vec3(.91,.47,.98),vec3(.55,.36,1.),rim);gl_FragColor=vec4(color,rim*(.48+.08*sin(time*.7)));}
  `);
  const ringProgram = program(vertexCommon, `
    precision mediump float; varying vec3 vPosition; varying vec2 vUv; uniform float time;
    void main(){float edge=smoothstep(0.,.12,vUv.x)*smoothstep(1.,.82,vUv.x);float grain=.72+.28*sin(vUv.y*80.+time*.2);vec3 color=mix(vec3(.46,.25,.86),vec3(.95,.51,.88),vUv.y);gl_FragColor=vec4(color,edge*.32*grain);}
  `);
  const sphere = sphereData(mobile ? 40 : 72, mobile ? 64 : 112);
  const ring = ringData(mobile ? 96 : 160);
  const sphereBuffers = { position: buffer(gl.ARRAY_BUFFER, sphere.positions), normal: buffer(gl.ARRAY_BUFFER, sphere.normals), uv: buffer(gl.ARRAY_BUFFER, sphere.uvs), index: buffer(gl.ELEMENT_ARRAY_BUFFER, sphere.indices, Uint16Array) };
  const ringBuffers = { position: buffer(gl.ARRAY_BUFFER, ring.positions), uv: buffer(gl.ARRAY_BUFFER, ring.uvs), index: buffer(gl.ELEMENT_ARRAY_BUFFER, ring.indices, Uint16Array) };
  const uniforms = item => Object.fromEntries(['rotation','tilt','zoom','aspect','camera','time'].map(name => [name, gl.getUniformLocation(item, name)]));
  const planetUniforms = uniforms(planetProgram), atmosphereUniforms = uniforms(atmosphereProgram), ringUniforms = uniforms(ringProgram);
  const setUniforms = u => { gl.uniform1f(u.rotation, rotation); gl.uniform1f(u.tilt, tilt); gl.uniform1f(u.zoom, zoom); gl.uniform1f(u.aspect, canvas.clientWidth / Math.max(1, canvas.clientHeight)); gl.uniform2f(u.camera, pointerX, pointerY); };
  function drawSphere(item, u, indexCount) { gl.useProgram(item); setUniforms(u); gl.uniform1f(u.time, performance.now() / 1000); attr(item, 'position', 3, sphereBuffers.position); attr(item, 'normal', 3, sphereBuffers.normal); attr(item, 'uv', 2, sphereBuffers.uv); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, sphereBuffers.index); gl.drawElements(gl.TRIANGLES, indexCount, gl.UNSIGNED_SHORT, 0); }
  function drawRing() { gl.useProgram(ringProgram); setUniforms(ringUniforms); gl.uniform1f(ringUniforms.time, performance.now() / 1000); attr(ringProgram, 'position', 3, ringBuffers.position); attr(ringProgram, 'uv', 2, ringBuffers.uv); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ringBuffers.index); gl.drawElements(gl.TRIANGLES, ring.indices.length, gl.UNSIGNED_SHORT, 0); }

  let dragging = false, lastX = 0, lastY = 0;
  canvas.addEventListener('pointerdown', event => { dragging = true; lastX = event.clientX; lastY = event.clientY; canvas.setPointerCapture?.(event.pointerId); });
  canvas.addEventListener('pointermove', event => {
    if (event.pointerType === 'mouse' && !dragging) return;
    if (dragging) { const dx = event.clientX - lastX, dy = event.clientY - lastY; rotation += dx * .008; tilt += dy * .004; velocityX = dx * .00035; velocityY = dy * .00018; lastX = event.clientX; lastY = event.clientY; }
  }, { passive: true });
  const endDrag = event => { dragging = false; canvas.releasePointerCapture?.(event.pointerId); };
  canvas.addEventListener('pointerup', endDrag); canvas.addEventListener('pointercancel', endDrag); canvas.addEventListener('pointerleave', () => { if (!dragging) { pointerX = 0; pointerY = 0; } });
  canvas.addEventListener('wheel', event => { event.preventDefault(); targetZoom = Math.max(.85, Math.min(1.15, targetZoom - event.deltaY * .00045)); }, { passive: false });
  stage.addEventListener('pointermove', event => { if (event.pointerType === 'mouse') { const b = stage.getBoundingClientRect(); pointerX = (event.clientX - b.left) / b.width * 2 - 1; pointerY = (event.clientY - b.top) / b.height * 2 - 1; } }, { passive: true });
  stage.addEventListener('pointerleave', () => { pointerX = pointerY = 0; });
  function resize() { const dpr = Math.min(devicePixelRatio || 1, mobile ? 1.5 : 2); const w = Math.max(1, Math.round(canvas.clientWidth * dpr)), h = Math.max(1, Math.round(canvas.clientHeight * dpr)); if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; } gl.viewport(0, 0, w, h); }
  gl.enable(gl.DEPTH_TEST); gl.enable(gl.CULL_FACE); gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE); gl.clearColor(0, 0, 0, 0);
  render = time => { resize(); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); gl.cullFace(gl.BACK); gl.depthMask(true); drawRing(); drawSphere(planetProgram, planetUniforms, sphere.indices.length); gl.depthMask(false); gl.cullFace(gl.FRONT); drawSphere(atmosphereProgram, atmosphereUniforms, sphere.indices.length); gl.cullFace(gl.BACK); gl.depthMask(true); };
  canvas.addEventListener('webglcontextlost', event => { event.preventDefault(); cancelAnimationFrame(frame); stage.classList.remove('hero-planet-ready'); });
  addEventListener('resize', refresh, { passive: true }); render(0); stage.classList.add('hero-planet-ready'); refresh();
} catch (error) {
  stage.classList.remove('hero-planet-ready');
  console.info('Coolcat hero: CSS planet fallback', error.message);
}
