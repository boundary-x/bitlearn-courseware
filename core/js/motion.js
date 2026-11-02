/* ==========================================================================
   motion.js — "원리 보기" 플레이어 + 그리기 도구(Motion.kit) + 장면 등록(Motion.register)
   --------------------------------------------------------------------------
   HyperFrames 계약
   - 컴포지션마다 gsap.timeline({ paused: true }) 정확히 1개 → window.__timelines[id]
   - 장면 = 타임라인 label 'id:key'. 결정론(Math.random·Date.now 없음), 무한 반복 없음
   - 좌표는 미리 계산(트윈 중 측정 없음). transform·opacity + 선 그리기(strokeDashoffset)만 움직임
   - CSS transform을 주는 요소에는 GSAP transform을 걸지 않음(정적 배치 g ⟶ 애니메이션 g 중첩)
   - render(root,id) = 정적 DOM(GSAP 없이도 포스터로 보임), build(root,id,gsap) = 타임라인
   - Motion.standaloneHTML(id, {base, scenes, opts}) → HyperFrames CLI로 MP4 렌더할 독립 HTML(base = 코어 폴더 주소, 기본은 이 파일 위치의 ../)
   - 장면(컴포지션)은 이 파일에 없다: 차시 js/lesson-scenes.js(또는 코어 장면 라이브러리)가 Motion.register로 등록
   공개 API(app.js가 호출): mount(el,id,{present,onTry,opts}) · unmountAll() · pauseAll() · handleNav(dir) · register(id,factory) · kit · ids
   ========================================================================== */
window.Motion = (() => {
  'use strict';
  const GSAP_SRC = 'https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js';
  const GSAP_SRI = 'sha512-7eHRwcbYkK4d9g/6tD/mhkf++eoTHwpNM9woBxtPUBWm67zeAfFC+HrdoE2GanKeocly/VxeLvIqwvCdk7qScg==';
  const W = 960, H = 720, EPS = 0.04;
  // 코어 폴더 주소(css/motion.css·js/motion.js가 있는 곳): 독립 HTML 내보내기의 기본 base(S2-3에서 motion.js를 core/js로 옮김)
  const CORE_BASE = (typeof document !== 'undefined' && document.currentScript && document.currentScript.src) ? new URL('../', document.currentScript.src).href : '';

  // 색: 위젯과 같은 규칙(초록 앞으로, 빨강 뒤로, 회색 정지, 분홍 이동 방향). 글자색은 진한 쪽.
  const C = {
    ink: '#141A33', muted: '#5B6578', fwd: '#17A673', fwdInk: '#0F7A53', back: '#FF3B3B', backInk: '#C42A2A',
    stop: '#9AA3B2', move: '#6ABBFC', moveInk: '#2C3BDF', force: '#4E5AE4', vert: '#2F6BDB', side: '#2C3BDF',
    body: '#1E2547', robility: '#58ACFA', basic: '#1E90FF', blockInk: '#0B1F3A', hl: '#FACC15', red: '#E11D48',
  };

  /* ---------- SVG 문자열 도우미 ---------- */
  const r1 = (n) => Math.round(n * 10) / 10;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const at = (o) => Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== false).map(([k, v]) => ` ${k}="${v}"`).join('');
  const T = (x, y, s, o = {}) => `<text${at({ x: r1(x), y: r1(y), 'font-size': o.fs || 28, 'font-weight': o.fw || 700, fill: o.c || C.ink, 'text-anchor': o.a || 'start', id: o.id, class: o.cls, 'data-f': o.f, opacity: o.op })}>${esc(s)}</text>`;
  // 그리기용 대시: 간격을 넉넉히(L+60) 두고 시작 오프셋을 L+30으로 → 둥근 끝 점이 남지 않음
  const dashAttr = (L) => ({ 'stroke-dasharray': `${r1(L)} ${r1(L + 60)}`, 'data-len': r1(L) });

  // 화살표: 몸통(line.dl) + 머리(polygon.hd). halo = 흰 테두리(어두운 몸체 위에서도 보이게)
  function arrow(x1, y1, x2, y2, o = {}) {
    const c = o.c || C.force, w = o.w || 10, hd = o.head || w * 2.8;
    const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy), ux = dx / len, uy = dy / len;
    const bx = x2 - ux * hd * 0.8, by = y2 - uy * hd * 0.8, px = -uy, py = ux, hw = hd * 0.62;
    const P = `${r1(x2)},${r1(y2)} ${r1(bx + px * hw)},${r1(by + py * hw)} ${r1(bx - px * hw)},${r1(by - py * hw)}`;
    const L = Math.hypot(bx - x1, by - y1);
    const ln = (stroke, sw, dash) => `<line class="dl"${at(Object.assign({ x1: r1(x1), y1: r1(y1), x2: r1(bx), y2: r1(by), stroke, 'stroke-width': sw, 'stroke-linecap': 'round' }, o.draw ? dashAttr(L) : dash ? { 'stroke-dasharray': dash } : {}))}/>`;
    const halo = o.halo === false ? '' : ln('#fff', w + 8) + `<polygon class="hd" points="${P}" fill="#fff" stroke="#fff" stroke-width="8" stroke-linejoin="round"/>`;
    return `<g${at({ id: o.id, class: o.cls, 'data-f': o.f })}>${halo}${ln(c, w, o.dash)}<polygon class="hd" points="${P}" fill="${c}" stroke="${c}" stroke-width="2" stroke-linejoin="round"/>${o.extra || ''}</g>`;
  }
  const drawPath = (d, L, o = {}) => `<path class="dl"${at(Object.assign({ id: o.id, d, fill: 'none', stroke: o.c, 'stroke-width': o.w || 8, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'data-f': o.f, opacity: o.op }, dashAttr(L)))}/>`;

  // MakeCode 블록 모양(위 홈, 아래 돌기)
  function blockPath(x, y, w, h) {
    const r = 10;
    return `M${x + r},${y} H${x + 16} l7,7 h22 l7,-7 H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h - r} Q${x + w},${y + h} ${x + w - r},${y + h} H${x + 52} l-7,7 h-22 l-7,-7 H${x + r} Q${x},${y + h} ${x},${y + h - r} V${y + r} Q${x},${y} ${x + r},${y} Z`;
  }
  const blockShape = (x, y, w, h, color) => `<path d="${blockPath(x, y, w, h)}" fill="${color}" stroke="rgba(11,31,58,.28)" stroke-width="2"/>`;
  const block = (x, y, w, h, label, color, fs = 26) => blockShape(x, y, w, h, color) + T(x + 18, y + h / 2 + fs * 0.34, label, { fs, fw: 800, c: C.blockInk });

  // 숫자 테이프: 창(clip) 안에서 줄을 steps 이즈로 넘김 → 콜백 없이 seek해도 정확
  function tape(id, x, y, w, h, items, o = {}) {
    const fs = o.fs || 48, cx = x + w / 2, base = y + h / 2 + fs * 0.36;
    return `<clipPath id="${id}-clip"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="12"/></clipPath><g clip-path="url(#${id}-clip)"><g id="${id}">${items.map((s, k) => T(cx, base + k * h, s, { fs, fw: 800, c: o.c || '#fff', a: 'middle' })).join('')}</g></g>`;
  }
  const pill = (x, y, w, h, text, o = {}) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${h / 2}" fill="${o.bg || '#fff'}" stroke="${o.line || 'rgba(20,26,51,.14)'}" stroke-width="2"/>` + T(x + w / 2, y + h / 2 + (o.fs || 24) * 0.35, text, { fs: o.fs || 24, fw: 800, c: o.c || C.ink, a: 'middle' });

  /* ---------- 포니봇(위에서 본 모습, 원점 중심, 앞 = 위) ----------
   * 10차: 형태도(planning/ref/ponybot-views.webp) 기준 — 앞 = 초음파 눈 2개, 위판 가운데 앞 절반 = 접힌 스마트폰 거치대 + 뒤 U자 받침,
   * 뒤 = 세로로 선 마이크로비트(위에서는 얇은 기판 한 줄) + 그 뒤 가장자리 OLED, 모래시계 윤곽 차체, 바퀴 축마다 작은 파란 부품, 롤러 45° X자 */
  const WH = { FL: [-112, -95, '\\'], FR: [112, -95, '/'], RL: [-112, 95, '/'], RR: [112, 95, '\\'] };
  const WCOL = { n: C.stop, f: C.fwd, b: C.back };
  // 바퀴 상태 층: n(회색, 늘 바닥에 깔림) · f(초록 ↑) · b(빨강 ↓). 클래스 `${p}-${바퀴}-${상태}` + `${p}-s${상태}`
  function bot(p, o = {}) {
    const st = o.states || ['n', 'f', 'b'], poster = o.poster || {};
    const lay = (k, s, inner) => `<g class="${p}-${k}-${s} ${p}-s${s}"${s !== 'n' && poster[k] !== s ? ' data-f="0"' : ''}>${inner}</g>`;
    let wheels = '';
    Object.keys(WH).forEach((k) => {
      const [cx, cy, roll] = WH[k], x0 = cx - 32, y0 = cy - 52;
      st.forEach((s) => { wheels += lay(k, s, `<rect x="${x0}" y="${y0}" width="64" height="104" rx="12" fill="${WCOL[s]}"/>`); });
      let deco = '';
      if (o.mecanum) for (let i = -1; i < 7; i++) { const yy = y0 + 14 + i * 16; deco += roll === '/' ? `<line x1="${x0 + 6}" y1="${yy + 22}" x2="${x0 + 58}" y2="${yy - 22}"/>` : `<line x1="${x0 + 6}" y1="${yy - 22}" x2="${x0 + 58}" y2="${yy + 22}"/>`; }
      else for (let i = 0; i < 7; i++) { const yy = y0 + 10 + i * 14; deco += `<line x1="${x0 + 6}" y1="${yy}" x2="${x0 + 58}" y2="${yy}"/>`; }
      const cid = `${p}-clip-${k}`;
      wheels += `<clipPath id="${cid}"><rect x="${x0}" y="${y0}" width="64" height="104" rx="12"/></clipPath><g clip-path="url(#${cid})" stroke="${o.mecanum ? 'rgba(255,255,255,.35)' : 'rgba(0,0,0,.16)'}" stroke-width="${o.mecanum ? 4 : 3}" stroke-linecap="round">${deco}</g>`;
      // 바퀴 축의 작은 파란 부품(형태도 정면도·평면도)
      wheels += `<rect x="${cx > 0 ? 70 : -80}" y="${cy - 11}" width="10" height="22" rx="3" fill="#2F80ED"/>`;
      if (st.includes('f')) wheels += lay(k, 'f', `<g fill="#fff"><rect x="${cx - 5}" y="${cy - 8}" width="10" height="36" rx="3"/><path d="M${cx},${cy - 36} L${cx - 18},${cy - 8} H${cx + 18} Z"/></g>`);
      if (st.includes('b')) wheels += lay(k, 'b', `<g fill="#fff"><rect x="${cx - 5}" y="${cy - 28}" width="10" height="36" rx="3"/><path d="M${cx},${cy + 36} L${cx - 18},${cy + 8} H${cx + 18} Z"/></g>`);
    });
    const eye = (x) => `<circle cx="${x}" cy="-150" r="18" fill="#CBD5E1" stroke="${C.body}" stroke-width="5"/><circle cx="${x}" cy="-150" r="8" fill="#334155"/>`;
    const body = `<path d="M-58,-150 H58 Q70,-150 70,-138 V-52 L84,-34 V34 L70,52 V138 Q70,150 58,150 H-58 Q-70,150 -70,138 V52 L-84,34 V-34 L-70,-52 V-138 Q-70,-150 -58,-150 Z" fill="${C.body}"/>`;
    const top = '<rect x="-30" y="-132" width="60" height="114" rx="10" fill="#12161F"/>' + // 접힌 스마트폰 거치대(앞 절반)
      '<path d="M-20,-14 V52 M20,-14 V52" stroke="#12161F" stroke-width="8" stroke-linecap="round"/><circle cx="0" cy="36" r="8" fill="#0B0F17"/>' + // U자 받침·구멍
      '<rect x="-44" y="86" width="88" height="10" rx="3" fill="#2A2F4D" stroke="#C9A227" stroke-width="2"/>' + // 세로로 선 마이크로비트(위에서 본 모서리)
      '<rect x="-24" y="106" width="48" height="26" rx="4" fill="#1E3A8A" stroke="#0B1020" stroke-width="3"/>'; // OLED(뒤 가장자리)
    return `${body}${top}${wheels}${eye(-36)}${eye(36)}`;
  }

  /* ---------- 타임라인 도우미 ---------- */
  const arr = (x) => (x == null ? [] : Array.isArray(x) ? x.filter(Boolean) : x.length !== undefined && !x.tagName ? Array.from(x) : [x]);
  const X = {
    set(tl, els, v, t = 0) { const a = arr(els); if (a.length) tl.set(a, v, t); },
    show(tl, els, t, d = 0.35, ex) { const a = arr(els); if (a.length) tl.to(a, Object.assign({ opacity: 1, duration: d, ease: 'power1.out' }, ex), t); },
    hide(tl, els, t, d = 0.3, ex) { const a = arr(els); if (a.length) tl.to(a, Object.assign({ opacity: 0, duration: d, ease: 'power1.in' }, ex), t); },
    to(tl, els, v, t) { const a = arr(els); if (a.length) tl.to(a, v, t); },
    lines: (el) => (el.classList.contains('dl') ? [el] : Array.from(el.querySelectorAll('.dl'))),
    drawInit(tl, el) {
      tl.set(X.lines(el), { strokeDashoffset: (i, n) => +n.getAttribute('data-len') + 30 }, 0);
      const hd = el.querySelectorAll('.hd'); if (hd.length) tl.set(hd, { opacity: 0 }, 0);
    },
    draw(tl, el, t, d = 0.6, ease = 'power2.out') {
      tl.to(X.lines(el), { strokeDashoffset: 0, duration: d, ease }, t);
      const hd = el.querySelectorAll('.hd'); if (hd.length) tl.to(hd, { opacity: 1, duration: 0.15 }, t + d - 0.12);
    },
  };

  // 5×8 픽셀 글꼴(6×8 칸 = 글자 폭 6픽셀, 한 줄 8픽셀)
  const GLYPH = {
    p: ['.....', '.....', '####.', '#...#', '#...#', '####.', '#....', '#....'],
    a: ['.....', '.....', '.###.', '....#', '.####', '#...#', '.####', '.....'],
    r: ['.....', '.....', '#.##.', '##..#', '#....', '#....', '#....', '.....'],
    k: ['#....', '#....', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '.....'],
    i: ['..#..', '.....', '.##..', '..#..', '..#..', '..#..', '.###.', '.....'],
    n: ['.....', '.....', '#.##.', '##..#', '#...#', '#...#', '#...#', '.....'],
    g: ['.....', '.....', '.####', '#...#', '#...#', '.####', '....#', '.###.'],
  };

  /* ---------- 장면 등록(설계 02-split-plan.md 3.6) ----------
   * Motion.register(id, (K, opts) => ({ title, duration, scenes: [{ key, t, chip, cap, alt }], svg(), build(tl, $, $$) }))
   * K = Motion.kit(그리기 도구), opts = page.motionOpts(같은 장면을 차시마다 숫자·글자만 바꿔 씀).
   * 차시 장면 파일(js/lesson-scenes.js)·코어 장면 라이브러리가 부른다. 같은 id를 두 번 등록하면 오류(코어 id를 차시가 다시 등록해도 오류) */
  const kit = Object.freeze({ W, H, C, r1, esc, at, T, dashAttr, arrow, drawPath, blockPath, blockShape, block, tape, pill, bot, WH, WCOL, X, arr, GLYPH });
  const REG = Object.create(null);
  function register(id, factory) {
    if (typeof id !== 'string' || !id) throw new Error('Motion.register: 장면 id가 필요해요');
    if (typeof factory !== 'function') throw new Error(`Motion.register(${id}): 두 번째 값은 (K, opts) => 컴포지션 함수여야 해요`);
    if (REG[id]) throw new Error(`Motion.register: 이미 등록된 장면 id예요: ${id}`);
    REG[id] = { factory, src: (typeof document !== 'undefined' && document.currentScript && document.currentScript.src) || '', made: new Map() };
  }
  // 컴포지션 검사: t 오름차순, key 고유, duration ≥ 마지막 t
  function checkComp(id, d) {
    const bad = (m) => { throw new Error(`Motion 장면 ${id}: ${m}`); };
    if (!d || !Array.isArray(d.scenes) || !d.scenes.length) bad('scenes 배열이 비었어요');
    if (typeof d.svg !== 'function' || typeof d.build !== 'function') bad('svg()·build()가 필요해요');
    const keys = new Set();
    d.scenes.forEach((s, i) => {
      if (!s.key || keys.has(s.key)) bad(`장면 key가 없거나 겹쳐요: ${s.key}`); keys.add(s.key);
      if (!(s.t >= 0) || (i && s.t <= d.scenes[i - 1].t)) bad(`t는 0 이상 오름차순이어야 해요: ${s.key}`);
    });
    if (!(d.duration >= d.scenes[d.scenes.length - 1].t)) bad('duration이 마지막 장면 t보다 짧아요');
    return d;
  }
  // id + opts → 컴포지션(같은 opts면 한 번만 만든다)
  function comp(id, opts) {
    const r = REG[id]; if (!r) return null;
    const o = opts || {}, k = JSON.stringify(o);
    if (!r.made.has(k)) r.made.set(k, checkComp(id, r.factory(kit, o)));
    return r.made.get(k);
  }

  /* ---------- 컴포지션: render(정적 DOM) / build(타임라인) ---------- */
  function render(root, id, opts) {
    const d = comp(id, opts);
    root.classList.add('mo-comp');
    Object.entries({ 'data-composition-id': id, 'data-start': '0', 'data-width': W, 'data-height': H, 'data-duration': d.duration }).forEach(([k, v]) => root.setAttribute(k, v));
    root.innerHTML = `<svg class="mo-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(d.title)}" focusable="false">${d.svg()}</svg>`
      + `<div class="mo-caps" aria-hidden="true">${d.scenes.map((s) => `<p class="mo-cap" data-cap="${s.key}">${esc(s.cap)}</p>`).join('')}</div>`;
  }
  function build(root, id, gsap, opts) {
    const d = comp(id, opts);
    const tl = gsap.timeline({ paused: true });
    const $ = (s) => root.querySelector(s), $$ = (s) => Array.from(root.querySelectorAll(s));
    d.scenes.forEach((s) => tl.addLabel(`${id}:${s.key}`, s.t));
    const caps = $$('.mo-cap');
    tl.set(caps, { opacity: 0 }, 0);
    d.scenes.forEach((s, i) => {
      tl.to(caps[i], { opacity: 1, duration: 0.3, ease: 'power1.out' }, s.t + 0.05);
      const nx = d.scenes[i + 1]; if (nx) tl.to(caps[i], { opacity: 0, duration: 0.2, ease: 'power1.in' }, nx.t);
    });
    d.build(tl, $, $$);
    tl.set({}, {}, d.duration); // 길이 = data-duration
    (window.__timelines = window.__timelines || {})[id] = tl;
    return tl;
  }
  function compose(root, id, opts) { render(root, id, opts); const tl = build(root, id, window.gsap, opts); tl.seek(0); return tl; }
  function standaloneHTML(id, o = {}) {
    const d = comp(id, o.opts), base = o.base != null ? o.base : CORE_BASE;
    // 장면 파일: 지정한 목록, 없으면 이 장면을 등록한 파일(절대 주소)
    const scenes = o.scenes || (REG[id] && REG[id].src ? [REG[id].src] : []);
    return `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=${W}">
<title>${esc(d.title)}</title>
<link rel="stylesheet" href="${base}css/motion.css">
<style>html,body{margin:0;width:${W}px;height:${H}px;overflow:hidden;background:#F7F8FE}#root{width:100%;height:100%}</style>
<script src="${o.gsap || GSAP_SRC}"></script>
<script src="${base}js/motion.js"></script>
${scenes.map((s) => `<script src="${s}"></script>\n`).join('')}</head><body>
<div id="root" data-composition-id="${id}" data-start="0" data-width="${W}" data-height="${H}" data-duration="${d.duration}"></div>
<script>Motion.compose(document.getElementById('root'), '${id}'${o.opts ? `, ${JSON.stringify(o.opts)}` : ''});</script>
</body></html>`;
  }

  /* ---------- GSAP 늦게 불러오기 (이론 페이지에서 처음 필요할 때) ---------- */
  let gsapP = null;
  function loadGsap() {
    if (window.gsap && window.gsap.timeline) return Promise.resolve(window.gsap);
    if (gsapP) return gsapP;
    gsapP = new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = GSAP_SRC; s.integrity = GSAP_SRI; s.crossOrigin = 'anonymous'; s.referrerPolicy = 'no-referrer'; s.async = true;
      const to = setTimeout(() => rej(new Error('timeout')), 15000);
      s.onload = () => { clearTimeout(to); if (window.gsap && window.gsap.timeline) res(window.gsap); else rej(new Error('gsap missing')); };
      s.onerror = () => { clearTimeout(to); rej(new Error('load failed')); };
      document.head.appendChild(s);
    }).catch((e) => { gsapP = null; throw e; });
    return gsapP;
  }

  /* ---------- 플레이어 ---------- */
  const ICON = {
    play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z" fill="currentColor"/></svg>',
    pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h3.6v14H7zM13.4 5H17v14h-3.6z" fill="currentColor"/></svg>',
    restart: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5.6 9.2A7 7 0 1 1 5 13" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><path d="M4.6 4.6v4.9h4.9" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    next: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 5.5v13l9-6.5z" fill="currentColor"/><path d="M16.6 5.5h2.6v13h-2.6z" fill="currentColor"/></svg>',
  };
  const PREF_KEY = 'ponybot:motion';
  const loadPref = () => { try { return Object.assign({ cap: true, slow: false }, JSON.parse(localStorage.getItem(PREF_KEY)) || {}); } catch (e) { return { cap: true, slow: false }; } };
  const savePref = (p) => { try { localStorage.setItem(PREF_KEY, JSON.stringify(p)); } catch (e) { /* 저장 못 해도 동작 */ } };
  const fmt = (t) => { const s = Math.max(0, Math.round(t)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

  const players = new Set();

  function createPlayer(el, id, opts) {
    const d = comp(id, opts.opts), n = d.scenes.length, starts = d.scenes.map((s) => s.t), dur = d.duration;
    const sceneEnd = (i) => (i < n - 1 ? starts[i + 1] - EPS : dur);
    const sceneAt = (t) => { let i = 0; for (let k = 0; k < n; k++) if (t >= starts[k] - 1e-6) i = k; return i; };
    const pref = loadPref();
    let tl = null, mm = null, state = 'loading', engaged = false, reduced = false, failed = false, destroyed = false;
    let stopAt = null, ratio = 0, pendingPlay = false, lastKey = null, lastTime = '';
    let stopEachUser = null, presentMode = !!opts.present || document.body.classList.contains('present');
    const isStopEach = () => (stopEachUser !== null ? stopEachUser : presentMode);
    const side = el.closest('.side');
    const canTry = typeof opts.onTry === 'function' && !!(side && side.querySelector('[data-media="widget"]'));

    el.innerHTML = `<div class="mo-player" data-state="loading">
      <div class="mo-stage" tabindex="0" role="group" aria-roledescription="애니메이션" aria-label="원리 보기: ${esc(d.title)}. 스페이스 키나 K 키로 재생하고, 왼쪽·오른쪽 화살표로 장면을 옮겨요.">
        <div class="mo-host"></div>
        <button type="button" class="mo-poster" aria-label="원리 보기 재생 (${fmt(dur)}, 장면 ${n}개)"><span class="mo-poster-btn" aria-hidden="true">${ICON.play}</span><span class="mo-poster-meta">원리 보기 · ${fmt(dur)} · 장면 ${n}개</span></button>
      </div>
      <p class="mo-fail" role="status">애니메이션을 불러오지 못했어요. 아래 "글로 보기"로 내용을 확인해 주세요.</p>
      <ol class="mo-scenes" style="--n:${n}" aria-label="장면">${d.scenes.map((s, i) => `<li><button type="button" class="mo-chip" data-i="${i}" aria-label="장면 ${i + 1}: ${esc(s.chip)}"><span class="mo-seg" aria-hidden="true"><i></i></span><span class="mo-chip-t"><b>${i + 1}</b> ${esc(s.chip)}</span></button></li>`).join('')}</ol>
      <div class="mo-ctrl">
        <button type="button" class="mo-btn mo-play" aria-label="재생">${ICON.play}</button>
        <button type="button" class="mo-btn mo-restart" aria-label="처음부터 재생">${ICON.restart}</button>
        <button type="button" class="mo-skip" aria-label="마지막 정리 장면으로 건너뛰기">건너뛰기</button>
        ${canTry ? '<button type="button" class="btn gradient small mo-try" hidden>직접 해 보기</button>' : ''}
        <span class="mo-time" aria-hidden="true">0:00 / ${fmt(dur)}</span>
        <span class="mo-opts">
          <button type="button" class="mo-tog" data-opt="cap" aria-pressed="${pref.cap}">자막</button>
          <button type="button" class="mo-tog" data-opt="speed" aria-pressed="${pref.slow}" aria-label="천천히 재생 (0.75배)">${pref.slow ? '0.75×' : '1×'}</button>
          <button type="button" class="mo-tog" data-opt="stop" aria-pressed="false">장면마다 멈춤</button>
        </span>
      </div>
      <p class="sr mo-live" aria-live="polite"></p>
      <details class="mo-text"><summary>글로 보기</summary><ol>${d.scenes.map((s, i) => `<li><b>${i + 1}. ${esc(s.chip)}</b> ${esc(s.cap)}<p>${esc(s.alt)}</p></li>`).join('')}</ol></details>
    </div>`;
    const root = el.querySelector('.mo-player'), stage = root.querySelector('.mo-stage'), host = root.querySelector('.mo-host');
    const posterBtn = root.querySelector('.mo-poster'), chips = Array.from(root.querySelectorAll('.mo-chip'));
    const playBtn = root.querySelector('.mo-play'), restartBtn = root.querySelector('.mo-restart'), skipBtn = root.querySelector('.mo-skip'), tryBtn = root.querySelector('.mo-try');
    const timeEl = root.querySelector('.mo-time'), live = root.querySelector('.mo-live'), details = root.querySelector('.mo-text');
    const tog = (k) => root.querySelector(`[data-opt="${k}"]`);
    root.classList.toggle('cap-off', !pref.cap);
    render(host, id, opts.opts);
    host.classList.add('mo-static');
    const svgEl = host.querySelector('.mo-svg');

    function renderToggles() {
      tog('cap').setAttribute('aria-pressed', String(pref.cap));
      tog('speed').setAttribute('aria-pressed', String(pref.slow)); tog('speed').textContent = pref.slow ? '0.75×' : '1×';
      tog('stop').setAttribute('aria-pressed', String(isStopEach()));
    }
    function setState(s) {
      state = s; root.dataset.state = s;
      const last = tl ? sceneAt(tl.time()) >= n - 1 : false;
      let icon = 'play', label = '재생', text = '', strong = false;
      if (s === 'playing') { icon = 'pause'; label = '일시정지'; }
      else if (s === 'paused') label = '이어서 재생';
      else if (s === 'boundary') { icon = 'next'; text = '다음 장면'; label = '다음 장면 재생'; strong = true; }
      else if (s === 'ended') { icon = 'restart'; text = '다시 보기'; label = '처음부터 다시 보기'; strong = true; }
      else if (s === 'reduced') { if (last) { icon = 'restart'; text = '처음 장면'; } else { icon = 'next'; text = '다음 장면'; } label = text; strong = true; }
      playBtn.innerHTML = ICON[icon] + (text ? `<span>${text}</span>` : '');
      playBtn.setAttribute('aria-label', label);
      playBtn.classList.toggle('has-text', !!text); playBtn.classList.toggle('strong', strong);
      restartBtn.hidden = s === 'ended' || (s === 'reduced' && last);
      skipBtn.hidden = s === 'ended' || (s === 'reduced' && last);
      if (tryBtn) tryBtn.hidden = !(s === 'ended' || (s === 'reduced' && last));
    }
    function highlight(key) {
      document.querySelectorAll('.theory .body [data-scene]').forEach((p) => {
        p.classList.toggle('scene-on', !!key && p.getAttribute('data-scene').split(/\s+/).includes(key));
      });
    }
    function updateUI() {
      if (!tl) return;
      const t = tl.time(), cur = sceneAt(t), showCur = state !== 'poster' && state !== 'loading' && state !== 'failed';
      chips.forEach((c, i) => {
        const p = showCur ? Math.max(0, Math.min(1, (t - starts[i]) / (sceneEnd(i) - starts[i]))) : 0;
        c.style.setProperty('--p', p.toFixed(3));
        if (showCur && i === cur) c.setAttribute('aria-current', 'step'); else c.removeAttribute('aria-current');
      });
      const txt = `${fmt(showCur ? t : 0)} / ${fmt(dur)}`; if (txt !== lastTime) { timeEl.textContent = txt; lastTime = txt; }
      const idx = showCur ? cur : -1, key = `${idx}|${engaged}`;
      if (key !== lastKey) {
        lastKey = key;
        const sc = idx >= 0 ? d.scenes[idx] : null;
        svgEl.setAttribute('aria-label', sc ? `${d.title} · 장면 ${idx + 1}: ${sc.cap}` : d.title);
        highlight(sc && engaged ? sc.key : null);
        if (sc && engaged) live.textContent = `장면 ${idx + 1}. ${sc.cap}`;
      }
    }
    function playFrom(t) {
      if (failed) return;
      if (!tl) { pendingPlay = true; return; }
      if (reduced) { engaged = true; showSceneEnd(sceneAt(t)); return; }
      if (t >= dur - 1e-3) t = 0;
      engaged = true;
      stopAt = isStopEach() ? sceneEnd(sceneAt(t + 1e-4)) : null;
      tl.timeScale(pref.slow ? 0.75 : 1);
      tl.play(t);
      setState('playing'); updateUI();
    }
    function pause() {
      if (tl && state === 'playing') { tl.pause(); stopAt = null; setState('paused'); updateUI(); }
    }
    function showSceneEnd(i) {
      if (!tl) return;
      tl.pause(); stopAt = null; tl.seek(sceneEnd(i));
      setState(reduced ? 'reduced' : i >= n - 1 ? 'ended' : 'boundary');
      updateUI();
    }
    function goScene(i) { engaged = true; if (reduced) showSceneEnd(i); else playFrom(starts[i]); }
    function togglePlay() {
      if (failed) return;
      if (!tl) { pendingPlay = true; return; }
      if (reduced) { const i = sceneAt(tl.time()); engaged = true; showSceneEnd(i >= n - 1 ? 0 : i + 1); return; }
      if (state === 'poster' || state === 'ended') playFrom(0);
      else if (state === 'playing') pause();
      else if (state === 'boundary') playFrom(starts[Math.min(n - 1, sceneAt(tl.time()) + 1)]);
      else playFrom(tl.time());
    }
    function stepScene(dir) {
      if (!tl || failed) return;
      if (state === 'poster') { if (dir > 0) goScene(0); return; }
      const cur = sceneAt(tl.time());
      if (dir > 0 && cur >= n - 1) { if (reduced) return; showSceneEnd(n - 1); return; }
      goScene(Math.max(0, Math.min(n - 1, cur + dir)));
    }
    // 투사 모드 빌드 규칙(클리커 →/PageDown)
    function nav(dir) {
      const t = tl.time(), cur = sceneAt(t);
      reveal();
      if (dir > 0) {
        if (reduced) { if (!engaged) { engaged = true; showSceneEnd(Math.min(1, n - 1)); return true; } if (cur < n - 1) { showSceneEnd(cur + 1); return true; } return false; }
        if (state === 'poster') { playFrom(0); return true; }
        if (state === 'playing') { engaged = true; showSceneEnd(cur); return true; }
        if (state === 'paused') { playFrom(t); return true; }
        if (state === 'boundary') { playFrom(starts[cur + 1]); return true; }
        return false;
      }
      if (state === 'poster' || (reduced && !engaged)) return false;
      if (cur > 0) { engaged = true; showSceneEnd(cur - 1); return true; }
      return false;
    }
    // 투사 모드에서 클리커로 넘길 때 무대가 상단 바·페이저에 가리지 않게(html scroll-padding 사용)
    const reveal = () => { if (!presentMode) return; const r = stage.getBoundingClientRect(); if (r.top < 70 || r.bottom > window.innerHeight - 100) stage.scrollIntoView({ block: 'nearest' }); };
    // 키를 누른 순간 직접 잼(IO 첫 알림 전에도 정확). 위 60px = 고정 상단 바
    const visible = () => {
      if (!stage.getClientRects().length) return false;
      const r = stage.getBoundingClientRect(), shown = Math.min(r.bottom, window.innerHeight) - Math.max(r.top, 60);
      return r.height > 0 && shown / r.height >= 0.3;
    };
    // 빌드 규칙은 투사 모드에서만(학생이 장면마다 멈춤을 켜도 ←/→ 페이지 넘김은 그대로)
    const navigable = () => !!tl && !failed && !destroyed && presentMode && isStopEach() && visible();
    function setReduced(r) {
      reduced = r;
      if (!tl) return;
      tl.pause(); stopAt = null;
      if (r) { const i = state === 'loading' || state === 'poster' ? 0 : sceneAt(tl.time()); tl.seek(sceneEnd(i)); setState('reduced'); }
      else if (state === 'reduced' || state === 'loading') {
        if (engaged) setState(sceneAt(tl.time()) >= n - 1 ? 'ended' : 'boundary');
        else { tl.seek(sceneEnd(0)); setState('poster'); }
      }
      updateUI();
    }

    // 이벤트
    posterBtn.addEventListener('click', () => { playFrom(0); playBtn.focus({ preventScroll: true }); reveal(); });
    playBtn.addEventListener('click', togglePlay);
    restartBtn.addEventListener('click', () => { engaged = true; if (reduced) showSceneEnd(0); else playFrom(0); });
    chips.forEach((c) => c.addEventListener('click', () => goScene(+c.dataset.i)));
    skipBtn.addEventListener('click', () => { if (!tl) return; engaged = true; showSceneEnd(n - 1); (tryBtn && !tryBtn.hidden ? tryBtn : playBtn).focus({ preventScroll: true }); });
    if (tryBtn) tryBtn.addEventListener('click', () => { pause(); opts.onTry(); const tab = side && side.querySelector('[data-media="widget"]'); if (tab) tab.focus({ preventScroll: true }); });
    tog('cap').addEventListener('click', () => { pref.cap = !pref.cap; savePref(pref); root.classList.toggle('cap-off', !pref.cap); renderToggles(); });
    tog('speed').addEventListener('click', () => { pref.slow = !pref.slow; savePref(pref); if (tl) tl.timeScale(pref.slow ? 0.75 : 1); renderToggles(); });
    tog('stop').addEventListener('click', () => {
      stopEachUser = !isStopEach(); renderToggles();
      if (tl && state === 'playing') stopAt = isStopEach() ? sceneEnd(sceneAt(tl.time())) : null;
    });
    root.addEventListener('keydown', (e) => {
      if (e.altKey || e.ctrlKey || e.metaKey || e.target.closest('.mo-text')) return;
      const onBtn = !!e.target.closest('button, a, summary');
      const isK = e.code === 'KeyK' || e.key === 'k' || e.key === 'K';
      if (isK || ((e.key === ' ' || e.key === 'Spacebar') && !onBtn)) { e.preventDefault(); e.stopPropagation(); togglePlay(); return; }
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); e.stopPropagation(); stepScene(e.key === 'ArrowRight' ? 1 : -1); }
    });
    const onVis = () => { if (document.hidden) pause(); };
    document.addEventListener('visibilitychange', onVis);
    let io = null;
    if ('IntersectionObserver' in window) {
      io = new IntersectionObserver((es) => es.forEach((e) => { ratio = e.isIntersecting ? e.intersectionRatio : 0; if (ratio < 0.3) pause(); }), { threshold: [0, 0.3, 0.6, 1], rootMargin: '-60px 0px 0px 0px' }); // 위 60px = 고정 상단 바
      io.observe(stage);
    } else ratio = 1;
    const mo = new MutationObserver(() => { const pm = document.body.classList.contains('present'); if (pm !== presentMode) { presentMode = pm; renderToggles(); } });
    mo.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    renderToggles();

    loadGsap().then((gsap) => {
      if (destroyed) return;
      tl = build(host, id, gsap, opts.opts);
      host.classList.remove('mo-static');
      tl.eventCallback('onUpdate', () => {
        if (state === 'playing' && stopAt !== null && tl.time() >= stopAt) {
          const s = stopAt; stopAt = null; tl.pause(s);
          setState(s >= dur - 1e-3 ? 'ended' : 'boundary');
        }
        updateUI();
      });
      tl.eventCallback('onComplete', () => { stopAt = null; setState('ended'); updateUI(); });
      mm = gsap.matchMedia();
      mm.add({ reduce: '(prefers-reduced-motion: reduce)', ok: '(prefers-reduced-motion: no-preference)' }, (ctx) => { setReduced(!!ctx.conditions.reduce); });
      if (!reduced && state === 'loading') { tl.seek(sceneEnd(0)); setState('poster'); updateUI(); }
      if (pendingPlay) { pendingPlay = false; playFrom(0); }
    }).catch(() => {
      if (destroyed) return;
      failed = true; setState('failed'); details.open = true;
    });

    return {
      el, id,
      pause, nav, navigable,
      destroy() {
        destroyed = true;
        if (tl) { tl.kill(); if (window.__timelines && window.__timelines[id] === tl) delete window.__timelines[id]; }
        if (mm) mm.revert();
        if (io) io.disconnect();
        mo.disconnect();
        document.removeEventListener('visibilitychange', onVis);
        highlight(null);
      },
      // 점검·내보내기용
      get timeline() { return tl; }, get state() { return state; }, get ratio() { return ratio; }, scenes: d.scenes, sceneEnd, goScene, showSceneEnd,
    };
  }

  return {
    mount(el, id, opts = {}) {
      if (!el || !REG[id]) return null;
      const p = createPlayer(el, id, opts);
      players.add(p);
      return p;
    },
    unmountAll() { players.forEach((p) => p.destroy()); players.clear(); },
    pauseAll() { players.forEach((p) => p.pause()); },
    handleNav(dir) {
      for (const p of players) if (p.navigable()) return p.nav(dir);
      return false;
    },
    // HyperFrames 내보내기·점검
    players: () => Array.from(players),
    get ids() { return Object.keys(REG); },
    register, kit,
    info: (id, opts) => { const d = comp(id, opts); return d && { title: d.title, duration: d.duration, scenes: d.scenes.map((s) => ({ key: s.key, label: `${id}:${s.key}`, t: s.t, chip: s.chip, cap: s.cap })) }; },
    render, build, compose, standaloneHTML, loadGsap,
  };
})();
