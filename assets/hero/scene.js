// Dependency-free canvas planet. The CSS planet remains visible if canvas is unavailable.
const stage = document.querySelector('#hero-stage');
const canvas = document.querySelector('#hero-canvas');
const control = document.querySelector('#hero-motion');
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
let paused = reduced.matches;
let visible = true;
let frame = 0;
let elapsed = 0;
let previous = 0;
let pointerX = 0;
let pointerY = 0;
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
  const ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) throw new Error('Canvas unavailable');

  function resize() {
    const dpr = Math.min(devicePixelRatio || 1, matchMedia('(max-width: 700px)').matches ? 1.5 : 2);
    const width = Math.max(1, Math.round(canvas.clientWidth * dpr));
    const height = Math.max(1, Math.round(canvas.clientHeight * dpr));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function blob(cx, cy, rx, ry, seed, fill, phase) {
    ctx.beginPath();
    for (let i = 0; i <= 20; i++) {
      const angle = (i / 20) * Math.PI * 2;
      const wave = 0.82 + 0.12 * Math.sin(angle * 3 + seed) + 0.07 * Math.sin(angle * 5 - seed * 1.7 + phase);
      const x = cx + Math.cos(angle) * rx * wave;
      const y = cy + Math.sin(angle) * ry * wave;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
  }

  function render(time) {
    resize();
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    ctx.clearRect(0, 0, width, height);
    const size = Math.min(width, height);
    const radius = size * 0.36;
    const cx = width * 0.59 + pointerX * 11;
    const cy = height * 0.5 + pointerY * 8;
    const spin = time * 0.055;

    const glow = ctx.createRadialGradient(cx, cy, radius * 0.55, cx, cy, radius * 1.5);
    glow.addColorStop(0, 'rgba(166, 120, 255, .32)');
    glow.addColorStop(.48, 'rgba(100, 69, 210, .13)');
    glow.addColorStop(1, 'rgba(100, 69, 210, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(cx, cy, radius * 1.5, 0, Math.PI * 2); ctx.fill();

    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.clip();
    const planet = ctx.createRadialGradient(cx - radius * .38, cy - radius * .42, radius * .05, cx, cy, radius * 1.18);
    planet.addColorStop(0, '#f4c9ff');
    planet.addColorStop(.18, '#ba8fe9');
    planet.addColorStop(.52, '#6745b0');
    planet.addColorStop(.83, '#30205f');
    planet.addColorStop(1, '#100c2d');
    ctx.fillStyle = planet;
    ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);

    // Slow, soft bands keep the surface visibly full while suggesting rotation.
    ctx.globalAlpha = .22;
    for (let i = 0; i < 7; i++) {
      const y = cy - radius * .8 + i * radius * .27;
      ctx.fillStyle = i % 2 ? '#f6d8ff' : '#2d1b64';
      ctx.beginPath();
      ctx.ellipse(cx + Math.sin(spin + i) * radius * .13, y, radius * .92, radius * (.08 + (i % 3) * .025), 0, 0, Math.PI * 2);
      ctx.fill();
    }

    const drift = Math.sin(spin) * radius * .2;
    ctx.globalAlpha = .38;
    ctx.filter = 'blur(3px)';
    blob(cx - radius * .33 + drift, cy - radius * .05, radius * .27, radius * .17, 1.1, '#d99cf2', spin);
    blob(cx + radius * .29 + drift, cy + radius * .23, radius * .22, radius * .14, 2.8, '#34206f', spin);
    blob(cx - radius * .08 + drift, cy + radius * .5, radius * .3, radius * .1, 4.3, '#8f69d0', spin);
    ctx.filter = 'none';

    ctx.globalAlpha = .24;
    ctx.strokeStyle = '#fff1ff';
    ctx.lineWidth = Math.max(2, radius * .025);
    for (let i = 0; i < 5; i++) {
      const y = cy - radius * .45 + i * radius * .2;
      ctx.beginPath();
      ctx.moveTo(cx - radius * .95, y);
      ctx.bezierCurveTo(cx - radius * .35, y - radius * .13, cx + radius * .35, y + radius * .13, cx + radius * .95, y - radius * .02);
      ctx.stroke();
    }
    ctx.restore();

    const edge = ctx.createRadialGradient(cx - radius * .35, cy - radius * .4, radius * .68, cx, cy, radius * 1.05);
    edge.addColorStop(0, 'rgba(255,255,255,0)');
    edge.addColorStop(.82, 'rgba(255,255,255,0)');
    edge.addColorStop(1, 'rgba(208,173,255,.8)');
    ctx.fillStyle = edge;
    ctx.beginPath(); ctx.arc(cx, cy, radius * 1.015, 0, Math.PI * 2); ctx.fill();
  }

  stage.addEventListener('pointermove', event => {
    if (paused || reduced.matches || event.pointerType !== 'mouse') return;
    const bounds = stage.getBoundingClientRect();
    pointerX = (event.clientX - bounds.left) / bounds.width * 2 - 1;
    pointerY = (event.clientY - bounds.top) / bounds.height * 2 - 1;
  }, { passive: true });
  stage.addEventListener('pointerleave', () => { pointerX = pointerY = 0; });
  addEventListener('resize', refresh, { passive: true });
  render(0);
  stage.classList.add('hero-planet-ready');
  refresh();
} catch (error) {
  // The CSS planet and DOM copy stay visible if canvas setup fails.
  console.info('Coolcat hero: CSS planet fallback', error.message);
}
