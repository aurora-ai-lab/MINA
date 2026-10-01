// Dependency-free WebGL hero. Content and CSS fallback remain usable without it.
const stage = document.querySelector('#hero-stage');
const canvas = document.querySelector('#hero-canvas');
const control = document.querySelector('#hero-motion');
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
let paused = reduced.matches;
let visible = true;
let frame = 0;
let elapsed = 0;
let previous = 0;
let render = () => {};

function updateControl() {
  stage.classList.toggle('motion-paused', paused);
  control.setAttribute('aria-pressed', String(paused));
  control.textContent = paused ? '播放动效' : '暂停动效';
  document.dispatchEvent(new CustomEvent('coolcat-motion', { detail: { paused } }));
}
function tick(now) {
  frame = 0;
  if (document.hidden || !visible) return;
  if (!paused) elapsed += previous ? Math.min(now - previous, 50) / 1000 : 0;
  previous = now;
  render(elapsed);
  if (!paused) frame = requestAnimationFrame(tick);
}
function refresh() {
  cancelAnimationFrame(frame);
  previous = 0;
  frame = requestAnimationFrame(tick);
}
control.addEventListener('click', () => { paused = !paused; updateControl(); refresh(); });
reduced.addEventListener('change', () => { paused = reduced.matches; updateControl(); refresh(); });
document.addEventListener('visibilitychange', () => {
  stage.classList.toggle('hero-inactive', document.hidden || !visible);
  refresh();
});
if ('IntersectionObserver' in window) new IntersectionObserver(([entry]) => {
  visible = entry.isIntersecting;
  stage.classList.toggle('hero-inactive', document.hidden || !visible);
  refresh();
}).observe(stage);
updateControl();

try {
  const gl = canvas.getContext('webgl', { alpha: true, antialias: true, powerPreference: 'low-power' });
  if (!gl) throw new Error('WebGL unavailable');
  function compile(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error('Hero shader compilation failed');
    return shader;
  }
  const vertex = compile(gl.VERTEX_SHADER, `
    attribute vec3 position;
    uniform float time, aspect;
    uniform vec2 pointer;
    varying float depth;
    void main() {
      float a = time * .13 + pointer.x * .28;
      float b = .32 + pointer.y * .18;
      vec3 p = position;
      p.xz = mat2(cos(a), -sin(a), sin(a), cos(a)) * p.xz;
      p.yz = mat2(cos(b), -sin(b), sin(b), cos(b)) * p.yz;
      float distance = 3.6 - p.z;
      depth = clamp((p.z + 1.6) / 3.2, 0., 1.);
      gl_Position = vec4(p.x * 2.3 / (distance * aspect), p.y * 2.3 / distance, 0., 1.);
      gl_PointSize = 1.2 + depth * 2.;
    }`);
  const fragment = compile(gl.FRAGMENT_SHADER, `
    precision mediump float;
    varying float depth;
    uniform float particles;
    void main() {
      float alpha = .17 + depth * .55;
      if (particles > .5) {
        float r = length(gl_PointCoord - vec2(.5));
        alpha *= 1. - smoothstep(.15, .5, r);
      }
      vec3 color = mix(vec3(.61, .42, 1.), vec3(1., .72, .9), depth);
      gl_FragColor = vec4(color, alpha);
    }`);
  const program = gl.createProgram();
  gl.attachShader(program, vertex); gl.attachShader(program, fragment); gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('Hero shader link failed');
  gl.useProgram(program);
  const lines = [];
  const segments = 160;
  function point(angle, tilt, twist, radius) {
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius * Math.cos(tilt);
    const z = Math.sin(angle) * radius * Math.sin(tilt);
    return [x * Math.cos(twist) - y * Math.sin(twist), x * Math.sin(twist) + y * Math.cos(twist), z];
  }
  for (let ring = 0; ring < 7; ring++) for (let i = 0; i < segments; i++) {
    lines.push(...point(i / segments * Math.PI * 2, .35 + ring * .23, ring * .7, 1.05 + ring * .075));
    lines.push(...point((i + 1) / segments * Math.PI * 2, .35 + ring * .23, ring * .7, 1.05 + ring * .075));
  }
  const points = [];
  const particleCount = matchMedia('(max-width: 700px)').matches ? 250 : 700;
  for (let i = 0; i < particleCount; i++) {
    const azimuth = Math.random() * Math.PI * 2;
    const height = Math.random() * 2 - 1;
    const radius = 1.25 + Math.random() * .42;
    const width = Math.sqrt(1 - height * height);
    points.push(Math.cos(azimuth) * width * radius, height * radius, Math.sin(azimuth) * width * radius);
  }
  function buffer(data) {
    const result = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, result);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW); return result;
  }
  const lineBuffer = buffer(lines), pointBuffer = buffer(points);
  const position = gl.getAttribLocation(program, 'position');
  const uniforms = Object.fromEntries(['time','aspect','pointer','particles'].map(name => [name, gl.getUniformLocation(program, name)]));
  const pointer = [0, 0];
  stage.addEventListener('pointermove', event => {
    if (paused || reduced.matches || event.pointerType !== 'mouse') return;
    const bounds = stage.getBoundingClientRect();
    pointer[0] = (event.clientX - bounds.left) / bounds.width * 2 - 1;
    pointer[1] = (event.clientY - bounds.top) / bounds.height * 2 - 1;
  }, { passive: true });
  stage.addEventListener('pointerleave', () => { pointer[0] = pointer[1] = 0; });
  gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
  gl.enableVertexAttribArray(position);
  function resize() {
    const dpr = Math.min(devicePixelRatio || 1, matchMedia('(max-width: 700px)').matches ? 1.25 : 1.5);
    const width = Math.max(1, Math.round(canvas.clientWidth * dpr));
    const height = Math.max(1, Math.round(canvas.clientHeight * dpr));
    if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
    gl.viewport(0, 0, width, height);
    gl.uniform1f(uniforms.aspect, width / height);
  }
  render = time => {
    resize(); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform1f(uniforms.time, time); gl.uniform2fv(uniforms.pointer, pointer);
    gl.uniform1f(uniforms.particles, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, lineBuffer); gl.vertexAttribPointer(position, 3, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.LINES, 0, lines.length / 3);
    gl.uniform1f(uniforms.particles, 1);
    gl.bindBuffer(gl.ARRAY_BUFFER, pointBuffer); gl.vertexAttribPointer(position, 3, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.POINTS, 0, points.length / 3);
  };
  canvas.addEventListener('webglcontextlost', event => {
    event.preventDefault(); cancelAnimationFrame(frame); render = () => {};
    stage.classList.remove('hero-webgl');
  });
  addEventListener('resize', refresh, { passive: true });
  render(0); stage.classList.add('hero-webgl'); refresh();
} catch (error) {
  // The CSS scene and DOM copy stay visible if graphics setup fails.
  stage.classList.remove('hero-webgl');
  console.info('Coolcat hero: CSS fallback', error.message);
}
