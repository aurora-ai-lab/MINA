/* Coolcat gallery — vanilla JS, no build step. All paths are relative. */
(function () {
  "use strict";
  const $ = (s) => document.querySelector(s);
  // URL hashes: #<work-id> opens that work (and its tab); #women / #general selects a tab
  const SPARSE_MAX = 2; // show featured layout + "coming soon" card when works <= this

  const CATS = { general: "综合作品", women: "女性人像" };
  const DEFAULT_CAT = "general";
  const state = { works: [], filtered: [], query: "", tag: "", cat: DEFAULT_CAT, current: -1, lastFocus: null };
  const catWorks = () => state.works.filter((w) => w.category === state.cat);
  const el = {
    grid: $("#grid"), tags: $("#tags"), search: $("#search"), status: $("#status"),
    modal: $("#modal"), media: $("#m-media"), title: $("#m-title"), meta: $("#m-meta"),
    mtags: $("#m-tags"), prompt: $("#m-prompt"), extra: $("#m-extra"), copy: $("#copy"),
    share: $("#share"), prev: $("#prev"), next: $("#next"), toast: $("#toast"),
  };
  $("#year").textContent = new Date().getFullYear();

  /* ---------- helpers ---------- */
  function h(tag, attrs, ...kids) {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k === "class") n.className = v;
      else if (k === "text") n.textContent = v;
      else if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v === true ? "" : v);
    }
    for (const k of kids.flat()) if (k != null) n.append(k.nodeType ? k : document.createTextNode(k));
    return n;
  }
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const inline = (s) => esc(s).replace(/`([^`]+)`/g, "<code>$1</code>");
  /** tiny markdown: "- item" lists + inline code, everything else as paragraphs */
  function mdBlock(text) {
    const lines = String(text).split(/\r?\n/);
    if (lines.every((l) => !l.trim() || /^\s*[-*]\s+/.test(l))) {
      const ul = h("ul");
      lines.filter((l) => l.trim()).forEach((l) => { const li = h("li"); li.innerHTML = inline(l.replace(/^\s*[-*]\s+/, "")); ul.append(li); });
      return ul;
    }
    const d = h("div", { class: "body" }); d.innerHTML = inline(text); return d;
  }
  function formatDate(d) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d || "");
    return m ? `${m[1]} 年 ${+m[2]} 月 ${+m[3]} 日` : d || "";
  }
  let toastTimer;
  function toast(msg) {
    el.toast.textContent = msg; el.toast.classList.add("show");
    clearTimeout(toastTimer); toastTimer = setTimeout(() => el.toast.classList.remove("show"), 1800);
  }
  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); return true; } catch (e) { /* fallback */ }
    const ta = h("textarea", { style: "position:fixed;opacity:0;top:0;left:0" }); ta.value = text;
    document.body.append(ta); ta.select();
    let ok = false; try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
    ta.remove(); return ok;
  }

  /* ---------- stardust background ---------- */
  function stars() {
    const c = $("#stars"), ctx = c.getContext("2d");
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let pts = [], w, hgt, dpr;
    function setup() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = innerWidth; hgt = innerHeight; c.width = w * dpr; c.height = hgt * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = Math.round((w * hgt) / 5200);
      pts = Array.from({ length: n }, () => ({
        x: Math.random() * w, y: Math.random() * hgt, r: Math.random() * 1.1 + 0.2,
        a: Math.random() * 0.6 + 0.2, s: Math.random() * 0.02 + 0.004, p: Math.random() * 6.28,
        pink: Math.random() < 0.18,
      }));
    }
    function draw(t) {
      ctx.clearRect(0, 0, w, hgt);
      for (const s of pts) {
        const tw = reduce ? 1 : 0.6 + 0.4 * Math.sin(s.p + t * s.s * 0.06);
        ctx.globalAlpha = s.a * tw;
        ctx.fillStyle = s.pink ? "#ffc8ee" : "#ece4ff";
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, 6.283); ctx.fill();
      }
      if (!reduce) requestAnimationFrame(draw);
    }
    setup(); requestAnimationFrame(draw);
    let rt; addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(() => { setup(); if (reduce) draw(0); }, 150); });
  }

  /* ---------- filtering ---------- */
  function applyFilter() {
    const q = state.query.trim().toLowerCase();
    state.filtered = catWorks().filter((w) => {
      if (state.tag && !(w.tags || []).includes(state.tag)) return false;
      if (!q) return true;
      const hay = [w.title, w.prompt, (w.tags || []).join(" ")].join(" ").toLowerCase();
      return q.split(/\s+/).every((t) => hay.includes(t));
    });
    renderGrid();
  }

  function renderTags() {
    const counts = new Map();
    catWorks().forEach((w) => (w.tags || []).forEach((t) => counts.set(t, (counts.get(t) || 0) + 1)));
    // Map keeps first-seen order (newest work first); stable sort by count keeps that order on ties
    const tags = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    el.tags.replaceChildren(
      h("button", { class: "chip" + (state.tag ? "" : " active"), "aria-pressed": String(!state.tag), onclick: () => setTag("") }, "全部"),
      ...tags.map(([t, n]) =>
        h("button", { class: "chip" + (state.tag === t ? " active" : ""), "aria-pressed": String(state.tag === t), onclick: () => setTag(state.tag === t ? "" : t) },
          "#" + t, h("small", { text: String(n) })))
    );
  }
  function setTag(t) { state.tag = t; renderTags(); applyFilter(); }

  function renderCats() {
    document.querySelectorAll("#cats .cat").forEach((b) => {
      const c = b.dataset.cat;
      b.setAttribute("aria-selected", String(c === state.cat));
      b.querySelector("small").textContent = state.works.filter((w) => w.category === c).length;
    });
  }
  /** switch tab; resets tag filter (tags are per-category), keeps the search text */
  function setCat(c, updateHash) {
    if (!CATS[c]) c = DEFAULT_CAT;
    const changed = c !== state.cat;
    state.cat = c;
    if (changed) state.tag = "";
    renderCats(); renderTags(); applyFilter();
    if (updateHash) history.replaceState(null, "", c === DEFAULT_CAT ? location.pathname + location.search : "#" + c);
  }
  document.querySelectorAll("#cats .cat").forEach((b) => b.addEventListener("click", () => setCat(b.dataset.cat, true)));

  /* ---------- grid ---------- */
  const io = "IntersectionObserver" in window ? new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      const m = e.target; io.unobserve(m);
      if (m.dataset.src) { m.src = m.dataset.src; delete m.dataset.src; }
    });
  }, { rootMargin: "300px 0px" }) : null;

  function lazy(media) {
    if (io) io.observe(media); else { media.src = media.dataset.src; delete media.dataset.src; }
  }

  function card(w, i) {
    let media;
    if (w.mediaType === "video") {
      media = h("video", { muted: true, loop: true, playsinline: true, preload: "metadata", "data-src": w.image, "aria-label": w.title });
      media.muted = true;
      media.addEventListener("loadeddata", () => media.classList.add("loaded"));
    } else {
      media = h("img", { alt: w.title, loading: "lazy", decoding: "async", "data-src": w.image });
      media.addEventListener("load", () => media.classList.add("loaded"));
      media.addEventListener("error", () => media.classList.add("loaded"));
    }
    const c = h("button", {
      class: "card", style: `animation-delay:${Math.min(i, 12) * 60}ms`, "aria-label": `查看作品：${w.title}`,
      onclick: () => openWork(w.id),
    },
      h("div", { class: "thumb" }, media, w.mediaType === "video" ? h("span", { class: "badge", text: "▶ 视频" }) : null),
      h("div", { class: "overlay" }, h("h3", { text: w.title }), h("p", { text: [w.date, ...(w.tags || []).slice(0, 3).map((t) => "#" + t)].join(" · ") }))
    );
    if (w.mediaType === "video") {
      c.addEventListener("mouseenter", () => media.play().catch(() => {}));
      c.addEventListener("mouseleave", () => media.pause());
    }
    lazy(media);
    return c;
  }

  function renderGrid() {
    const list = state.filtered, total = catWorks().length, label = CATS[state.cat];
    const filtering = state.query.trim() || state.tag;
    el.status.textContent = filtering ? `${label} · 找到 ${list.length} / ${total} 件作品` : total ? `${label} · 共 ${total} 件作品 · 点击作品查看提示词` : `${label} · 暂无作品`;
    el.grid.classList.toggle("sparse", !filtering && total > 0 && total <= SPARSE_MAX);
    if (!list.length) {
      el.grid.replaceChildren(total
        ? h("div", { class: "empty" }, h("p", { text: "没有找到匹配的作品，换个关键词试试？" }),
            h("button", { class: "ghost-btn", onclick: () => { el.search.value = ""; state.query = ""; setTag(""); } }, "清除筛选"))
        : h("div", { class: "soon soon-empty" },
            h("span", { class: "spark", text: "✦" }),
            h("h3", { text: `「${label}」更多作品即将上线` }),
            h("p", { text: "这个分类的作品正在创作中，敬请期待。" }),
            h("p", { text: "Coming soon — stay tuned." }),
            h("a", { href: "https://x.com/aicoolcat", target: "_blank", rel: "noopener" }, "在 X 上关注 @aicoolcat →")));
      el.grid.style.columns = "auto";
      return;
    }
    el.grid.style.columns = "";
    const nodes = list.map(card);
    if (!filtering && total <= SPARSE_MAX) {
      nodes.push(h("div", { class: "soon" },
        h("span", { class: "spark", text: "✦" }),
        h("h3", { text: "更多作品即将上线" }),
        h("p", { text: "新的 AI 作品与提示词会持续更新到这里。" }),
        h("p", { text: "More AI art & prompts coming soon." }),
        h("a", { href: "https://x.com/aicoolcat", target: "_blank", rel: "noopener" }, "在 X 上关注 @aicoolcat →")));
    }
    el.grid.replaceChildren(...nodes);
  }

  /* ---------- modal ---------- */
  function navList() { return state.filtered.length ? state.filtered : catWorks(); }

  function openWork(id, fromHash) {
    const target = state.works.find((x) => x.id === id);
    if (!target) return false;
    if (target.category !== state.cat) setCat(target.category); // deep link opens the right tab
    const list = navList();
    let idx = list.findIndex((w) => w.id === id);
    let w = list[idx] || target;
    state.current = idx;
    if (el.modal.hidden) state.lastFocus = document.activeElement;
    fillModal(w);
    el.modal.hidden = false;
    document.body.classList.add("modal-open");
    if (!fromHash && location.hash.slice(1) !== encodeURIComponent(id)) history.replaceState(null, "", "#" + encodeURIComponent(id));
    const multi = list.length > 1 && idx >= 0;
    el.prev.hidden = el.next.hidden = !multi;
    el.modal.querySelector(".modal-close").focus({ preventScroll: true });
    const panel = el.modal.querySelector(".modal-panel");
    panel.scrollTop = 0;
    requestAnimationFrame(() => { panel.scrollTop = 0; });
    return true;
  }

  function fillModal(w) {
    document.title = `${w.title} · Coolcat`;
    let media;
    if (w.mediaType === "video") media = h("video", { src: w.image, controls: true, autoplay: true, loop: true, playsinline: true });
    else media = h("img", { src: w.image, alt: w.title });
    el.media.replaceChildren(media);
    el.title.textContent = w.title;
    const row = (k, v) => v ? h("div", {}, h("b", { text: k }), v) : null;
    el.meta.replaceChildren(...[
      row("日期", formatDate(w.date)),
      row("模型 / 工具", w.model || "未注明"),
      row("分类", CATS[w.category] || w.category),
      row("来源", w.source),
      row("作者", "Coolcat · @aicoolcat"),
    ].filter(Boolean));
    el.mtags.replaceChildren(...(w.tags || []).map((t) =>
      h("button", { class: "chip", onclick: () => { closeModal(); setTag(t); } }, "#" + t)));
    el.prompt.textContent = w.prompt || "（暂无提示词）";
    el.copy.textContent = "复制提示词"; el.copy.classList.remove("done");
    el.copy.disabled = !w.prompt;
    const sec = (title, text) => text ? h("div", { class: "section" }, h("h4", { text: title }), mdBlock(text)) : null;
    el.extra.replaceChildren(...[
      sec("典故", w.story),
      sec("备注", w.notes),
      sec("推文文案", w.tweet),
    ].filter(Boolean));
    el.modal.querySelector(".modal-info").scrollTop = 0;
  }

  function closeModal() {
    if (el.modal.hidden) return;
    el.modal.hidden = true;
    document.body.classList.remove("modal-open");
    const v = el.media.querySelector("video"); if (v) v.pause();
    el.media.replaceChildren();
    document.title = "Coolcat · AI 艺术作品与提示词";
    if (location.hash) history.replaceState(null, "", location.pathname + location.search + (state.cat === DEFAULT_CAT ? "" : "#" + state.cat));
    if (state.lastFocus && state.lastFocus.focus) state.lastFocus.focus({ preventScroll: true });
  }

  function step(d) {
    const list = navList();
    if (list.length < 2 || state.current < 0) return;
    const i = (state.current + d + list.length) % list.length;
    openWork(list[i].id);
  }

  el.modal.addEventListener("click", (e) => { if (e.target.closest("[data-close]")) closeModal(); });
  el.media.addEventListener("click", (e) => { if (e.target === el.media) closeModal(); });
  el.prev.addEventListener("click", () => step(-1));
  el.next.addEventListener("click", () => step(1));
  el.copy.addEventListener("click", async () => {
    const ok = await copyText(el.prompt.textContent);
    el.copy.textContent = ok ? "已复制 ✓" : "复制失败";
    el.copy.classList.toggle("done", ok);
    toast(ok ? "提示词已复制到剪贴板" : "复制失败，请手动选择文本");
    setTimeout(() => { el.copy.textContent = "复制提示词"; el.copy.classList.remove("done"); }, 2000);
  });
  el.share.addEventListener("click", async () => {
    const ok = await copyText(location.href);
    toast(ok ? "作品链接已复制" : "复制失败");
  });
  document.addEventListener("keydown", (e) => {
    if (el.modal.hidden) {
      if (e.key === "/" && document.activeElement !== el.search) { e.preventDefault(); el.search.focus(); }
      return;
    }
    if (e.key === "Escape") closeModal();
    else if (e.key === "ArrowLeft") step(-1);
    else if (e.key === "ArrowRight") step(1);
    else if (e.key === "Tab") { // simple focus trap
      const f = [...el.modal.querySelectorAll("button:not([hidden]):not([disabled]), a[href]")];
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
  function fromHash() {
    const id = decodeURIComponent(location.hash.slice(1));
    if (id && state.works.some((w) => w.id === id)) openWork(id, true);
    else if (CATS[id]) { closeModal(); setCat(id); }
    else if (!id) { closeModal(); setCat(DEFAULT_CAT); }
  }
  addEventListener("hashchange", fromHash);

  let st;
  el.search.addEventListener("input", () => { clearTimeout(st); st = setTimeout(() => { state.query = el.search.value; applyFilter(); }, 120); });

  /* ---------- boot ---------- */
  stars();
  fetch("data/works.json", { cache: "no-cache" })
    .then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then((works) => {
      state.works = (Array.isArray(works) ? works : [])
        .filter((w) => w && w.id && w.image)
        .map((w) => Object.assign({}, w, { category: CATS[w.category] ? w.category : DEFAULT_CAT }))
        .sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(b.id).localeCompare(String(a.id)));
      renderCats(); renderTags(); applyFilter(); fromHash();
    })
    .catch((err) => {
      console.error(err);
      el.status.textContent = "作品数据加载失败（data/works.json）。如果是直接双击打开的本地文件，请用本地服务器预览。";
    });
})();
