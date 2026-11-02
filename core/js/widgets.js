/* 이론 페이지 위젯("직접 해 보기"): 등록 API + 코어 위젯 라이브러리 (설계 02-split-plan.md 3.7, 결정 D4·D11)
 *   Widgets.register(id, (el, opts) => …)  위젯을 이름으로 등록. 같은 id를 두 번 등록하면 오류(코어 id를 차시가 다시 등록해도 오류)
 *   Widgets.mount(el, id, opts, ctx)       차시 데이터의 page.widget(id)·page.widgetOpts(opts)로 app.js가 부른다. ctx = { done, isDone, announce, say }(진행 기록, S3-3)
 * 라이브러리: ipo(opts.steps) | motors·mecanum(opts.keys, first) | coords(opts.w·h·text·col·row…, 별칭 oled) | sequence(opts.code)
 *   | led-grid(opts.modes icons·draw·timeline, icons, steps[{icon|leds|arrow|clear, pause}], loop, pauses, editPause, showCode, start — 1차시 LED 화면)
 *   | classify(opts.title·intro·bins[{id,label,desc}]·cards[{id,label,img,alt,bin,why,hint}]·shuffle·doneText — S3-3 분류 게임)
 *   | line-follow(opts.mode sensor·drive — 9~10차시 라인 센서·선 따라가기, 함수 머리 주석) | rgb-mix mode 'sensor'(presets·judge — 9~10차시 컬러 센서)
 *   | sense-decide(opts.sensor·short·threshold·op·ops·yes·no·led·presets·marks·oled·code·noise·quiz·hint) | rgb-mix(opts.modes all·each·mix·fade, mode·colors·color·brightness·base·leds·showBlock, fade: var·start·step·times·pause·editable·ranges) — S3-4(각 함수 머리 주석)
 *   | msg-map(opts.kind uart·radio, from, to, title, intro, varName, rows[{value,act,move}], ask[{value,act,answer,choices}], showCode — 11~12차시 받은 값 → 동작 명령표)
 *   opts를 비우면 3~4차시 지금 값(기본값)으로 그린다. 차시 전용 위젯은 차시 js/lesson-widgets.js에서 Widgets.register로 더한다. */
window.Widgets = (() => {
  const $ = (s, el = document) => el.querySelector(s);
  const REG = Object.create(null);
  function register(id, fn) {
    if (typeof id !== 'string' || !id) throw new Error('Widgets.register: 위젯 id가 필요해요');
    if (typeof fn !== 'function') throw new Error(`Widgets.register(${id}): 두 번째 값은 (el, opts) => … 함수여야 해요`);
    if (REG[id]) throw new Error(`Widgets.register: 이미 등록된 위젯 id예요: ${id}`);
    REG[id] = fn;
  }

  // 바퀴 상태: 1 앞으로, -1 뒤로, 0 정지  (FL 왼쪽 앞=M4, FR 오른쪽 앞=M1, RL 왼쪽 뒤=M3, RR 오른쪽 뒤=M2)
  const MOVES = {
    '↑': { w: [1, 1, 1, 1], v: [0, -1], name: '직진' },
    '↓': { w: [-1, -1, -1, -1], v: [0, 1], name: '후진' },
    '↶': { w: [-1, 1, -1, 1], rot: -1, name: '제자리 좌회전' },
    '↷': { w: [1, -1, 1, -1], rot: 1, name: '제자리 우회전' },
    '↖': { w: [0, 1, 1, 0], v: [-0.7, -0.7], name: '왼쪽 대각선 앞' },
    '↗': { w: [1, 0, 0, 1], v: [0.7, -0.7], name: '오른쪽 대각선 앞' },
    '←': { w: [-1, 1, 1, -1], v: [-1, 0], name: '왼쪽 옆' },
    's': { w: [0, 0, 0, 0], name: '정지' },
    '→': { w: [1, -1, -1, 1], v: [1, 0], name: '오른쪽 옆' },
    '↙': { w: [-1, 0, 0, -1], v: [-0.7, 0.7], name: '왼쪽 대각선 뒤' },
    '↘': { w: [0, -1, -1, 0], v: [0.7, 0.7], name: '오른쪽 대각선 뒤' },
  };
  const WHEELS = [
    { key: 'FL', m: 'M4', ko: '왼쪽 앞', x: 78, y: 30, rollers: '\\', side: 'L' },
    { key: 'FR', m: 'M1', ko: '오른쪽 앞', x: 202, y: 30, rollers: '/', side: 'R' },
    { key: 'RL', m: 'M3', ko: '왼쪽 뒤', x: 78, y: 130, rollers: '/', side: 'L' },
    { key: 'RR', m: 'M2', ko: '오른쪽 뒤', x: 202, y: 130, rollers: '\\', side: 'R' },
  ];

  let robotN = 0; // clipPath id가 겹치지 않게
  function robotSVG(move, mecanum) {
    const st = MOVES[move] || MOVES.s; const rid = `rw${++robotN}`;
    const wheel = (wh, i) => {
      const s = st.w[i];
      const fill = s > 0 ? '#17A673' : s < 0 ? '#FF3B3B' : '#9AA3B2';
      const arrow = s === 0 ? '' : `<path d="${s > 0 ? `M${wh.x + 20} ${wh.y + 6} l-9 12 h18 z` : `M${wh.x + 20} ${wh.y + 54} l-9 -12 h18 z`}" fill="#fff"/>`;
      const rollers = mecanum ? Array.from({ length: 7 }, (_, k) => {
        const yy = wh.y - 2 + k * 10;
        return wh.rollers === '/' ? `<line x1="${wh.x + 4}" y1="${yy + 14}" x2="${wh.x + 36}" y2="${yy - 12}" stroke="rgba(255,255,255,.35)" stroke-width="3"/>` : `<line x1="${wh.x + 4}" y1="${yy - 12}" x2="${wh.x + 36}" y2="${yy + 14}" stroke="rgba(255,255,255,.35)" stroke-width="3"/>`;
      }).join('') : '';
      return `<g><clipPath id="${rid}-${i}"><rect x="${wh.x}" y="${wh.y}" width="40" height="60" rx="8"/></clipPath><rect x="${wh.x}" y="${wh.y}" width="40" height="60" rx="8" fill="${fill}"/><g clip-path="url(#${rid}-${i})">${rollers}</g>${arrow}</g>`;
    };
    const label = (wh, i) => {
      // 11차: 옆으로 미끄러지는 바퀴(±14)와 우리말 이름표가 겹치지 않게 바퀴에서 22 띄움
      const s = st.w[i]; const x = wh.side === 'L' ? wh.x - 22 : wh.x + 62; const a = wh.side === 'L' ? 'end' : 'start';
      return `<text x="${x}" y="${wh.y + 26}" text-anchor="${a}" font-size="13" font-weight="700" fill="#1E2533">${wh.ko}</text>
        <text x="${x}" y="${wh.y + 44}" text-anchor="${a}" font-size="13" fill="${s > 0 ? '#0F7A53' : s < 0 ? '#C42A2A' : '#5B6578'}">${s > 0 ? '앞으로' : s < 0 ? '뒤로' : '정지'}</text>
        <text x="${x}" y="${wh.y + 60}" text-anchor="${a}" font-size="11" fill="#5B6578">${wh.m}${mecanum ? ` · ${wh.key}` : ''}</text>`;
    };
    let center = '';
    if (st.v) {
      const [vx, vy] = st.v; const cx = 160, cy = 110, L = 34;
      const x2 = cx + vx * L, y2 = cy + vy * L;
      const ang = Math.atan2(vy, vx);
      const hx1 = x2 - 12 * Math.cos(ang - 0.5), hy1 = y2 - 12 * Math.sin(ang - 0.5);
      const hx2 = x2 - 12 * Math.cos(ang + 0.5), hy2 = y2 - 12 * Math.sin(ang + 0.5);
      center = `<line x1="${cx - vx * L}" y1="${cy - vy * L}" x2="${x2}" y2="${y2}" stroke="#6ABBFC" stroke-width="8" stroke-linecap="round"/><path d="M${x2} ${y2} L${hx1} ${hy1} L${hx2} ${hy2} z" fill="#6ABBFC" stroke="#6ABBFC" stroke-width="4" stroke-linejoin="round"/>`;
    } else if (st.rot) {
      const sweep = st.rot > 0 ? 1 : 0;
      center = `<path d="M${st.rot > 0 ? 136 : 184} 96 A 28 28 0 1 ${sweep} ${st.rot > 0 ? 184 : 136} 96" fill="none" stroke="#6ABBFC" stroke-width="8" stroke-linecap="round"/><circle cx="${st.rot > 0 ? 184 : 136}" cy="96" r="7" fill="#6ABBFC"/>`;
    } else {
      center = `<circle cx="160" cy="110" r="10" fill="#9AA3B2"/>`;
    }
    const anim = st.v ? `style="--dx:${st.v[0] * 14}px;--dy:${st.v[1] * 14}px"` : st.rot ? `style="--rot:${st.rot * 20}deg"` : '';
    return `<svg viewBox="-12 0 344 230" class="robot-svg" role="img" aria-label="포니봇 위에서 본 모습: ${st.name}">
      <text x="160" y="14" text-anchor="middle" font-size="12" fill="#5B6578">앞쪽</text>
      ${WHEELS.map(label).join('')}
      <g class="robot-body ${st.v ? 'slide' : st.rot ? 'spin' : ''}" ${anim}>
        <rect x="112" y="24" width="96" height="174" rx="16" fill="#1E2547"/>
        <circle cx="146" cy="27" r="7" fill="#CBD5E1" stroke="#0B1020" stroke-width="3"/><circle cx="174" cy="27" r="7" fill="#CBD5E1" stroke="#0B1020" stroke-width="3"/>
        <rect x="146" y="40" width="28" height="72" rx="5" fill="#12161F"/>
        <path d="M150,114 V146 M170,114 V146" stroke="#12161F" stroke-width="5" stroke-linecap="round"/>
        <rect x="134" y="170" width="52" height="5" rx="2" fill="#2A2F4D" stroke="#C9A227"/><rect x="148" y="180" width="24" height="12" rx="2" fill="#1E3A8A"/>
        ${WHEELS.map(wheel).join('')}
        ${center}
      </g></svg>`;
  }

  function padHTML(keys, current) {
    return `<div class="dir-pad ${keys.length > 4 ? 'grid9' : 'grid4'}">${keys.map((k) => `<button class="${k === current ? 'on' : ''}" data-dir="${k}" aria-label="${MOVES[k].name}">${k}</button>`).join('')}</div>`;
  }

  function driveWidget(el, keys, mecanum, first) {
    let cur = first;
    const draw = () => {
      el.innerHTML = `<div class="widget sim">
        <div class="sim-stage">${robotSVG(cur, mecanum)}</div>
        <div class="sim-side">
          <p class="sim-label">${mecanum ? '메카넘' : '포니봇'} <b>${cur}</b> ${MOVES[cur].name}</p>
          ${padHTML(keys, cur)}
          <p class="legend"><span class="sw g"></span>앞으로 회전 <span class="sw r"></span>뒤로 회전 <span class="sw n"></span>정지</p>
        </div></div>`;
      el.querySelectorAll('[data-dir]').forEach((b) => b.addEventListener('click', () => { cur = b.dataset.dir; draw(); el.querySelector(`[data-dir="${cur}"]`).focus(); }));
    };
    draw();
  }

  /* 입력 → 처리 → 출력. opts: steps[{ t, s, d, c }](단계), intro(처음 안내), start(첫 버튼 글자) — 기본값은 3~4차시(초음파 → 마이크로비트 → 모터) */
  const IPO_STEPS = [
    { t: '입력', s: '센서', d: '초음파 센서: "앞에 벽이 10cm!"', c: '#2F6BDB' },
    { t: '처리', s: '컨트롤러', d: '마이크로비트: "너무 가까워, 멈춰야 해"', c: '#1E2533' },
    { t: '출력', s: '액추에이터', d: '모터: 바퀴를 멈춰요', c: '#17A673' },
  ];
  function ipo(el, o = {}) {
    const steps = o.steps || IPO_STEPS, last = steps.length - 1;
    const intro = o.intro || '버튼을 눌러 로봇이 벽을 만났을 때 무슨 일이 일어나는지 따라가 봐요.', start = o.start || '로봇 작동해 보기';
    let i = -1;
    const draw = () => {
      el.innerHTML = `<div class="widget ipo">
        <div class="ipo-row">${steps.map((s, k) => `<div class="ipo-node ${k === i ? 'on' : ''}" style="--c:${s.c}"><b>${s.t}</b><span>${s.s}</span></div>${k < last ? '<span class="ipo-arrow" aria-hidden="true"></span>' : ''}`).join('')}</div>
        <p class="ipo-say" aria-live="polite">${i < 0 ? intro : steps[i].d}</p>
        <button class="btn small primary" data-go>${i < 0 ? start : i < last ? '다음 단계' : '처음부터'}</button></div>`;
      $('[data-go]', el).addEventListener('click', () => { i = i >= last ? -1 : i + 1; draw(); $('[data-go]', el).focus(); });
    };
    draw();
  }

  /* 좌표 화면(coords, 3~4차시 이름 oled). opts: w·h(화면 픽셀, 128×64), text('777'), col(57)·row(3)(처음 위치), colMax(w − 8)·rowMax(h ÷ 8 − 1),
   *   scale(그리는 배율 4), label(화면 낭독 이름), legend(아래 설명) — 기본값은 3~4차시 OLED. 글자 폭 6픽셀·한 줄 8픽셀(OLED 글꼴) */
  function coords(el, o = {}) {
    const w = o.w || 128, h = o.h || 64, S = o.scale || 4; // 화면 배율
    const text = o.text != null ? String(o.text) : '777', col0 = o.col != null ? o.col : 57, row0 = o.row != null ? o.row : 3;
    const colMax = o.colMax != null ? o.colMax : w - 8, rowMax = o.rowMax != null ? o.rowMax : Math.floor(h / 8) - 1;
    const label = o.label || `OLED 화면 ${w} × ${h}. 눌러서 좌표를 확인해 봐요.`;
    const legend = o.legend || `슬라이더로 "숫자 출력 - 내용: ${text}, 위치: ${col0}열 ${row0}행, 색상: 1" 블록의 열·행 값을 바꾸듯 ${text}을 옮겨 봐요. 열은 점(픽셀) 단위, 행은 줄(0~${rowMax}) 단위예요.`;
    el.innerHTML = `<div class="widget oled">
      <div class="oled-frame"><canvas width="${w * S}" height="${h * S}" aria-label="${label}"></canvas></div>
      <p class="oled-read" aria-live="polite">화면을 눌러 봐요.</p>
      <div class="oled-ctl">
        <label>열(좌우) <input type="range" min="0" max="${colMax}" value="${col0}" data-col><output data-colv>${col0}</output></label>
        <label>행(위아래) <input type="range" min="0" max="${rowMax}" value="${row0}" data-row><output data-rowv>${row0}</output></label>
      </div>
      <p class="legend">${legend}</p></div>`;
    const cv = $('canvas', el); const ctx = cv.getContext('2d');
    let mark = null;
    const draw = () => {
      ctx.fillStyle = '#05070B'; ctx.fillRect(0, 0, cv.width, cv.height);
      ctx.strokeStyle = 'rgba(120,180,255,.08)'; ctx.lineWidth = 1;
      for (let x = 0; x <= w; x += 8) { ctx.beginPath(); ctx.moveTo(x * S, 0); ctx.lineTo(x * S, h * S); ctx.stroke(); }
      for (let y = 0; y <= h; y += 8) { ctx.beginPath(); ctx.moveTo(0, y * S); ctx.lineTo(w * S, y * S); ctx.stroke(); }
      const col = +$('[data-col]', el).value, row = +$('[data-row]', el).value;
      ctx.fillStyle = '#EAF6FF'; ctx.font = `${7 * S}px "Courier New", monospace`; ctx.textBaseline = 'top';
      text.split('').forEach((ch, k) => ctx.fillText(ch, (col + k * 6) * S, (row * 8) * S + 2));
      ctx.fillStyle = '#C4B5FD'; ctx.font = `bold ${3 * S}px sans-serif`;
      ctx.fillText('(0,0)', 2, 2); ctx.textAlign = 'right'; ctx.textBaseline = 'bottom'; ctx.fillText(`(${w - 1},${h - 1})`, cv.width - 2, cv.height - 2); ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      if (mark) {
        ctx.strokeStyle = '#FF3B3B'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(mark.x * S + S / 2, 0); ctx.lineTo(mark.x * S + S / 2, cv.height); ctx.moveTo(0, mark.y * S + S / 2); ctx.lineTo(cv.width, mark.y * S + S / 2); ctx.stroke();
        ctx.fillStyle = '#FF3B3B'; ctx.fillRect(mark.x * S, mark.y * S, S, S);
      }
    };
    cv.addEventListener('pointerdown', (e) => {
      const r = cv.getBoundingClientRect();
      const x = Math.min(w - 1, Math.max(0, Math.floor(((e.clientX - r.left) / r.width) * w)));
      const y = Math.min(h - 1, Math.max(0, Math.floor(((e.clientY - r.top) / r.height) * h)));
      mark = { x, y };
      $('.oled-read', el).innerHTML = `x = <b>${x}</b>, y = <b>${y}</b> (글자로는 ${Math.floor(y / 8)}행)`;
      draw();
    });
    el.querySelectorAll('input').forEach((inp) => inp.addEventListener('input', () => { $('[data-colv]', el).textContent = $('[data-col]', el).value; $('[data-rowv]', el).textContent = $('[data-row]', el).value; draw(); }));
    draw();
  }

  /* 순차구조 한 단계씩. opts: code[{ t, c, hat?, mv?:[dx,dy] }](블록 줄 — '일시중지'로 시작하는 줄에서 이동, '모든 모터 정지'에서 멈춤), intro(처음 안내)
   * 기본값은 3~4차시(메카넘 ↑ → ↓ ← 사각형) */
  const SEQ_CODE = [
      { t: 'A 버튼 누를 때', c: '#A800A8', hat: true }, // MakeCode 입력 색 #D400D4를 한 단계 진하게(흰 글자 6.5:1)
      { t: '메카넘 ↑ 방향 255 속도로 이동', c: '#58ACFA', mv: [0, -1] },
      { t: '일시중지 500 ms', c: '#1E90FF' },
      { t: '메카넘 → 방향 255 속도로 이동', c: '#58ACFA', mv: [1, 0] },
      { t: '일시중지 500 ms', c: '#1E90FF' },
      { t: '메카넘 ↓ 방향 255 속도로 이동', c: '#58ACFA', mv: [0, 1] },
      { t: '일시중지 500 ms', c: '#1E90FF' },
      { t: '메카넘 ← 방향 255 속도로 이동', c: '#58ACFA', mv: [-1, 0] },
      { t: '일시중지 500 ms', c: '#1E90FF' },
      { t: '모든 모터 정지', c: '#58ACFA' },
  ];
  function sequence(el, o = {}) {
    const code = o.code || SEQ_CODE, intro = o.intro || 'A 버튼을 눌렀다고 생각하고 시작해요.';
    let i = -1;
    const draw = () => {
      // 위치 계산: 일시중지 블록이 실행될 때 실제로 이동
      let x = 0, y = 1, dir = null; const trail = [[x, y]];
      for (let k = 0; k <= i; k++) {
        if (code[k].mv) dir = code[k].mv;
        if (code[k].t.startsWith('일시중지') && dir) { x += dir[0]; y += dir[1]; trail.push([x, y]); }
        if (code[k].t === '모든 모터 정지') dir = null;
      }
      const P = (v) => 30 + v * 70;
      el.innerHTML = `<div class="widget seq">
        <ol class="seq-code">${code.map((b, k) => `<li class="${k === i ? 'run' : k < i ? 'past' : ''}"${k === i ? ' aria-current="step"' : ''}><span class="seq-n">${k + 1}</span><span class="seq-b${b.hat ? ' hat' : ''}" style="--c:${b.c}">${b.t}</span></li>`).join('')}</ol>
        <div class="seq-side">
          <svg viewBox="0 0 160 160" class="seq-map" aria-label="포니봇 이동 경로">
            <rect x="30" y="30" width="70" height="70" fill="none" stroke="#D6DCE5" stroke-dasharray="4 4"/>
            <polyline points="${trail.map(([a, b]) => `${P(a)},${P(b)}`).join(' ')}" fill="none" stroke="#4E5AE4" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
            ${[[-17, -12], [11, -12], [-17, 3], [11, 3]].map(([dx, dy]) => `<rect x="${P(x) + dx}" y="${P(y) + dy}" width="6" height="10" rx="2" fill="#9AA3B2"/>`).join('')}<rect x="${P(x) - 12}" y="${P(y) - 14}" width="24" height="28" rx="5" fill="#1E2547"/><path d="M${P(x)} ${P(y) - 22} l-7 8 h14 z" fill="#6ABBFC"/>
          </svg>
          <p class="legend" aria-live="polite">${i < 0 ? intro : `${i + 1}번 블록 실행 중: ${code[i].t}`}</p>
          <p style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn small primary" data-step ${i >= code.length - 1 ? 'disabled' : ''}>한 단계씩</button><button class="btn small" data-reset>처음부터</button></p>
        </div></div>`;
      $('[data-step]', el).addEventListener('click', () => { i++; draw(); const b = $('[data-step]', el); (b.disabled ? $('[data-reset]', el) : b).focus(); });
      $('[data-reset]', el).addEventListener('click', () => { i = -1; draw(); });
    };
    draw();
  }

  /* ---------- S3-4 공통 도구 ---------- */
  const escH = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const pick = (...xs) => xs.find((x) => x !== undefined && x !== null);
  let wN = 0; // 위젯마다 고유 id 앞머리(label for·aria 연결)
  const reduceMotion = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  // 비교 연산자: 블록에 보이는 기호(≤ ≥ = ≠)와 코드 기호(<= >= == !=)를 모두 받는다
  const OP_ALIAS = { '≤': '<=', '≥': '>=', '=': '==', '≠': '!=', '===': '==', '!==': '!=' };
  const OP_SHOW = { '<': '<', '>': '>', '<=': '≤', '>=': '≥', '==': '=', '!=': '≠' };
  const OP_TEST = { '<': (a, b) => a < b, '>': (a, b) => a > b, '<=': (a, b) => a <= b, '>=': (a, b) => a >= b, '==': (a, b) => a === b, '!=': (a, b) => a !== b };
  const OP_SAY = { '<': '보다 작으면', '>': '보다 크면', '<=': ' 이하이면', '>=': ' 이상이면', '==': '와 같으면', '!=': '와 다르면' };
  const opN = (x) => OP_ALIAS[x] || x;
  const iga = (n) => (/[013678]$/.test(String(n)) ? '이' : '가'); // 숫자 + 이/가
  // 포니봇 LED 색(ai_ponybot_light v1.0.0 NeoPixelColors, 블록에 보이는 이름)
  const LED_COLORS = [['Red', '빨간색', 0xFF0000], ['Orange', '주황색', 0xFFA500], ['Yellow', '노란색', 0xFFFF00], ['Green', '초록색', 0x00FF00], ['Blue', '파란색', 0x0000FF], ['Indigo', '남색', 0x000080], ['Violet', '보라색', 0x8A2BE2], ['White', '흰색', 0xFFFFFF], ['Black', '끄기', 0x000000]];
  const hex6 = (c) => '#' + (c >>> 0).toString(16).padStart(6, '0').toUpperCase();
  /** 색 값: 'White'·'white'·'#FFFFFF'·0xFFFFFF·'off' → 숫자(0 = 꺼짐) */
  const colorOf = (c) => { if (typeof c === 'number') return c; const s = String(c || ''); if (/^off$/i.test(s)) return 0; if (/^#[0-9a-f]{6}$/i.test(s)) return parseInt(s.slice(1), 16); const k = LED_COLORS.find((x) => x[0].toLowerCase() === s.toLowerCase()); return k ? k[2] : 0xFFFFFF; };
  const colorKo = (c) => { const k = LED_COLORS.find((x) => x[2] === c); return k ? k[1] : hex6(c); };
  const ro = (w) => (/색$/.test(w) ? `${w}으로` : `${w}로`); // 빨간색으로 · 끄기로
  // 블록 글에 보이는 색: 확장 NeoPixelColors 블록 글자 그대로 '빨간색(red)'(끄기는 '"끄기"로'). 학생 설명 글·색 단추는 우리말만(LED_COLORS[1])
  const blockRo = (k) => { const c = LED_COLORS.find((x) => x[0] === k); return !c ? null : k === 'Black' ? '"끄기"로' : `${c[1]}(${k.toLowerCase()})으로`; };
  const nro = (n) => `${n}${/[036]$/.test(String(n)) ? '으로' : '로'}`; // 숫자 + (으)로: 0·3·6(받침, ㄹ 빼고) → 으로 · 1·2·7 → 로
  const eul = (w) => (/[013678]$/.test(String(w)) ? '을' : '를'); // 끝 숫자 받침: L1을 · L2를 · L3을
  // 밝기 계산: 확장 setAllRGB·setPixelRGB 그대로(밝기 < 255면 (값 × 밝기) >> 8) — engine/leds.js와 같음
  const scaleOut = (c, b) => { let r = (c >> 16) & 255, g = (c >> 8) & 255, bl = c & 255; if (b < 255) { r = (r * b) >> 8; g = (g * b) >> 8; bl = (bl * b) >> 8; } return [r, g, bl]; };
  /* LED 하나: 색 = 블록 색, 빛 세기 = 밝기(바탕은 꺼진 LED 색). out = 실제로 나가는 R·G·B */
  const ledDot = (color, bright, out, label, extra = '', style = '') => {
    const lit = out.some((v) => v > 0), a = lit ? (0.35 + 0.65 * Math.min(255, bright) / 255).toFixed(2) : 0;
    return `<span class="led-dot${lit ? ' on' : ''}${extra}" style="--c:${hex6(color)};--a:${a};${style}"><i aria-hidden="true"></i><b>${escH(label)}</b></span>`;
  };

  /* ---------- 센서 → 판단 → 결과(sense-decide) ----------
   * 센서 값 슬라이더 → 기준값 → 비교 연산자 → 참/거짓 → 결과(LED). 실습 화면이 아니라 이론 쪽 '직접 해 보기'에서만 쓴다(결정 D18).
   * opts(모두 선택, 기본값 = 5~6차시 오토 라이트)
   *   sensor  '빛 밝기' | { label, min:0, max:255, value:128, unit }      short  식에 쓰는 짧은 이름(기본 sensor.label)
   *   threshold 40 | { label:'기준값', value:40, min, max, editable:true }
   *   op '<'  ops ['<', '>'] (≤ ≥ = ≠ 또는 <= >= == != — 하나면 고정)
   *   yes / no  'LED 켜기' | { label:'어두워요', act:'LED 4개를 흰색으로 켜요', leds:'#FFFFFF'|'White'|'off' }   (기본 yes.leds = 'White', no.leds = 'off', led:false면 LED 그림 없음)
   *   presets [{ label:'손으로 가리기', value:5 }]   marks [{ value, label }](눈금)   oled true(OLED 그림에 지금 숫자)   code true(만약 블록 글)
   *   noise 2(값이 ±2쯤 흔들림, 움직임 줄이기면 끔)   quiz [{ value, op, threshold?(또는 th), ans:true|false }](참일까 거짓일까?)   hint(아래 설명)
   *   (설계 개정 2) threshold.value '$rec.threshold' + fallback 60 = 학생 측정 기록(없으면 60) — app.js recOpts가 위젯에 넘기기 전에 숫자로 바꿈
   *   ★7~8차시(LED가 아닌 결과): led:false + result:true(또는 yes/no에 icon) → 결과 칸에 그림 + label(예 '경보 울림'·'조용', '정지'·'직진')
   *     yes/no.icon 'bell'(울림)|'quiet'(조용)|'stop'(정지)|'go'(직진)|'none'   sensor.step(슬라이더 간격)
   *     none: true | { at:500, label:'못 잼' } — 값이 at 이상이면 '못 잼'으로 보임(초음파: 아무것도 안 돌아오면 500) */
  // 결과 그림(sense-decide result, 7~8차시): 글자 없는 단순 선 그림
  const RES_ICON = {
    bell: '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M16 5c-5 0-8 4-8 9v6l-3 3h22l-3-3v-6c0-5-3-9-8-9z" fill="#FDE68A" stroke="#92400E" stroke-width="2" stroke-linejoin="round"/><path d="M13 26a3 3 0 0 0 6 0" fill="none" stroke="#92400E" stroke-width="2"/><path d="M3 10c1-3 2-4 4-6M29 10c-1-3-2-4-4-6" stroke="#B45309" stroke-width="2" fill="none" stroke-linecap="round"/></svg>',
    quiet: '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M16 5c-5 0-8 4-8 9v6l-3 3h22l-3-3v-6c0-5-3-9-8-9z" fill="#EEF1F7" stroke="#5B6478" stroke-width="2" stroke-linejoin="round"/><path d="M5 5l22 22" stroke="#5B6478" stroke-width="2.5" stroke-linecap="round"/></svg>',
    stop: '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M11 3h10l8 8v10l-8 8H11l-8-8V11z" fill="#FECACA" stroke="#B91C1C" stroke-width="2" stroke-linejoin="round"/><path d="M10 16h12" stroke="#B91C1C" stroke-width="3" stroke-linecap="round"/></svg>',
    go: '<svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="13" fill="#BBF7D0" stroke="#15803D" stroke-width="2"/><path d="M16 23V10M10 15l6-6 6 6" fill="none" stroke="#15803D" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  };
  // 눈금 글: '이름 값'. 이름에 그 값이 이미 있으면(예 '2cm') 값을 또 붙이지 않는다(★7~8 페르소나 2회차 #30 '2cm 2')
  const markText = (m) => { const l = m.label == null ? '' : String(m.label); return !l ? String(m.value) : (l.match(/-?\d+(?:\.\d+)?/g) || []).some((n) => +n === +m.value) ? l : `${l} ${m.value}`; };
  function senseDecide(el, o = {}) {
    if (o.thresholds) return senseTwo(el, o); // 두 기준값 모드(켜는 값 < 끄는 값)
    const id = `sd${++wN}`;
    const S = o.sensor && typeof o.sensor === 'object' ? o.sensor : { label: o.sensor };
    const sensor = S.label || '빛 밝기', short = o.short || sensor, unitRaw = pick(S.unit, o.unit, ''), unit = unitRaw ? ` ${unitRaw}` : '';
    const min = pick(S.min, o.min, 0), max = pick(S.max, o.max, 255);
    const TH = o.threshold && typeof o.threshold === 'object' ? o.threshold : { value: o.threshold };
    const thLabel = TH.label || '기준값', thEdit = pick(TH.editable, o.thresholdEdit, true) !== false, thMin = pick(TH.min, min), thMax = pick(TH.max, max);
    const ops = (o.ops || [o.op || '<', '>']).map(opN).filter((x, i, a) => OP_TEST[x] && a.indexOf(x) === i);
    let base = pick(S.value, o.value, Math.round((min + max) / 2)), th = pick(TH.value, 40), op = OP_TEST[opN(o.op)] ? opN(o.op) : ops[0] || '<', jit = 0;
    const side = (x, dflt) => Object.assign({}, dflt, typeof x === 'string' ? { act: x } : x || {});
    const yes = side(o.yes, { label: '참', act: 'LED 4개가 흰색으로 켜져요', leds: o.led === false ? null : (o.led || 'White') });
    const no = side(o.no, { label: '거짓', act: 'LED가 꺼져요', leds: o.led === false ? null : 'off' });
    const showLeds = o.led !== false && (yes.leds != null || no.leds != null);
    const showRes = !!(o.result || yes.icon || no.icon);
    const NONE = o.none ? Object.assign({ at: 500, label: '못 잼' }, o.none === true ? {} : o.none) : null, isNone = (v) => !!NONE && v >= NONE.at;
    const step = pick(S.step, o.step, 1);
    const pct = (x) => Math.max(0, Math.min(100, ((x - min) / (max - min || 1)) * 100));
    const val = () => Math.max(min, Math.min(max, base + jit));
    el.innerHTML = `<div class="widget sense" id="${id}">
      ${o.presets && o.presets.length ? `<div class="sd-presets" role="group" aria-label="${escH(sensor)} 값 고르기">${o.presets.map((p, i) => `<button type="button" class="btn small" data-preset="${i}">${escH(p.label)} <small>${p.value}</small></button>`).join('')}</div>` : ''}
      <div class="sd-row">
        <label class="sd-ctl" for="${id}-v"><span class="sd-k">${escH(sensor)}</span><span class="sd-val"><output data-vo for="${id}-v"></output>${escH(unit)}</span></label>
        <input id="${id}-v" type="range" min="${min}" max="${max}" step="${step}" value="${base}" data-v>
      </div>
      <div class="sd-row">
        <label class="sd-ctl" for="${id}-t"><span class="sd-k">${escH(thLabel)}</span><span class="sd-val"><output data-to for="${id}-t"></output>${escH(unit)}</span></label>
        ${thEdit ? `<input id="${id}-t" type="range" min="${thMin}" max="${thMax}" step="1" value="${th}" data-t>` : ''}
      </div>
      <div class="sd-track" aria-hidden="true"><span class="sd-zone" data-zone></span>${(o.marks || []).map((m) => { const x = pct(m.value); return `<span class="sd-mark" style="left:${x}%;transform:translateX(${x < 15 ? '-8px' : x > 85 ? 'calc(-100% + 8px)' : '-50%'});justify-items:${x < 15 ? 'start' : x > 85 ? 'end' : 'center'}"><i></i><em>${escH(markText(m))}</em></span>`; }).join('')}<span class="sd-th" data-thm></span><span class="sd-pin" data-pin></span></div>
      <div class="sd-cmp">
        <span class="sd-if">만약</span><span class="sd-num" data-a></span>
        ${ops.length > 1 ? `<span class="sd-ops" role="radiogroup" aria-label="비교 연산자">${ops.map((x) => `<button type="button" role="radio" data-op="${escH(x)}" aria-label="${escH(OP_SHOW[x])} (${OP_SAY[x].trim()})">${escH(OP_SHOW[x])}</button>`).join('')}</span>` : `<span class="sd-op1" data-op1></span>`}
        <span class="sd-num" data-b></span><span class="sd-arrow" aria-hidden="true">→</span><span class="sd-tf" data-tf></span>
      </div>
      <div class="sd-out">${showRes ? '<span class="sd-res" data-res aria-hidden="true"></span>' : ''}${o.oled ? '<span class="sd-oled" data-oled aria-hidden="true"></span>' : ''}${showLeds ? '<span class="sd-leds" data-leds aria-hidden="true"></span>' : ''}<p class="sd-say" data-say aria-hidden="true"></p><p class="sr" data-say-sr aria-live="polite"></p></div>
      ${o.code ? '<ol class="sd-code" data-code aria-label="같은 뜻의 블록"></ol>' : ''}
      ${o.quiz && o.quiz.length ? '<div class="sd-quiz" data-quiz></div>' : ''}
      <p class="legend">${escH(o.hint || `${short} 값과 기준값을 바꿔 보며 언제 참이 되는지 확인해 봐요.`)}</p></div>`;
    const q = (s) => el.querySelector(s);
    const draw = () => {
      const v = val(), ok = OP_TEST[op](v, th), r = ok ? yes : no;
      q('[data-vo]').textContent = isNone(v) ? `${v} (${NONE.label})` : v; q('[data-to]').textContent = th; q('[data-a]').textContent = v; q('[data-b]').textContent = th;
      const rs = q('[data-res]'); if (rs) { rs.className = `sd-res ${ok ? 't' : 'f'}`; rs.innerHTML = `${RES_ICON[r.icon] || ''}<b>${escH(r.label)}</b>`; }
      const o1 = q('[data-op1]'); if (o1) o1.textContent = OP_SHOW[op];
      const tf = q('[data-tf]'); tf.textContent = ok ? '참' : '거짓'; tf.classList.toggle('t', ok); tf.classList.toggle('f', !ok);
      // 참이 되는 구간(눈금 위 색칠): < · ≤ 는 기준값 왼쪽, > · ≥ 는 오른쪽, = 는 점, ≠ 는 전체
      const z = q('[data-zone]'), tp = pct(th);
      const [a, b] = op === '<' || op === '<=' ? [0, tp] : op === '>' || op === '>=' ? [tp, 100] : op === '==' ? [tp - 0.6, tp + 0.6] : [0, 100];
      z.style.left = `${a}%`; z.style.width = `${Math.max(0, b - a)}%`;
      z.classList.toggle('thin-l', a === 0 && b - a < 8); z.classList.toggle('thin-r', b === 100 && b - a < 8); // ★#30 좁은 구간이 '0'처럼 보이지 않게
      q('[data-thm]').style.left = `${tp}%`; const pin = q('[data-pin]'); pin.style.left = `${pct(v)}%`; pin.classList.toggle('t', ok);
      const leds = q('[data-leds]');
      if (leds) { const c = r.leds == null ? 0 : colorOf(r.leds); leds.innerHTML = [1, 2, 3, 4].map((n) => ledDot(c, 255, scaleOut(c, 255), `L${n}`)).join(''); }
      const ol = q('[data-oled]'); if (ol) ol.textContent = v;
      const code = q('[data-code]');
      if (code) code.innerHTML = [[`만약 ${short} ${OP_SHOW[op]} ${th} 이면`, ok], [yes.code || yes.act, ok, 1], ['아니면', !ok], [no.code || no.act, !ok, 1]].map(([t, on, ind]) => `<li class="${ind ? 'in' : ''}${on ? ' run' : ''}"><span>${escH(t)}</span></li>`).join('');
      // 보이는 문장은 늘 화면 값 그대로(페르소나 2회차 #2: 잡음 중 문장이 멈춘 값이라 149/150이 어긋났음). 낭독(숨김 줄)은 값이 멈췄을 때만
      const say = `${short} ${v}${unit}${isNone(v) ? `(${NONE.label})` : ''}${iga(v)} ${th}${OP_SAY[op]} → ${ok ? '참' : '거짓'}${r.label && r.label !== '참' && r.label !== '거짓' ? ` · ${r.label}` : ''}: ${r.act}`;
      q('[data-say]').textContent = say; const sr = q('[data-say-sr]'); if (!jit || !sr.textContent) sr.textContent = say;
      el.querySelectorAll('[data-op]').forEach((x) => x.setAttribute('aria-checked', String(x.dataset.op === op)));
    };
    q('[data-v]').addEventListener('input', (e) => { base = +e.target.value; jit = 0; draw(); });
    const t = q('[data-t]'); if (t) t.addEventListener('input', (e) => { th = +e.target.value; draw(); });
    el.querySelectorAll('[data-preset]').forEach((b) => b.addEventListener('click', () => { base = +o.presets[+b.dataset.preset].value; jit = 0; q('[data-v]').value = base; draw(); }));
    el.querySelectorAll('[data-op]').forEach((b) => b.addEventListener('click', () => { op = b.dataset.op; draw(); b.focus(); }));
    const og = q('.sd-ops'); if (og) og.addEventListener('keydown', (e) => { // 라디오 묶음: 왼쪽·오른쪽 화살표
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return; e.preventDefault();
      op = ops[(ops.indexOf(op) + (e.key === 'ArrowRight' ? 1 : ops.length - 1)) % ops.length]; draw(); const nb = [...el.querySelectorAll('[data-op]')].find((x) => x.dataset.op === op); if (nb) nb.focus();
    });
    // 센서 잡음 맛보기: 값이 ±noise 안에서 흔들림(움직임 줄이기·숨은 탭·화면에서 빠지면 멈춤)
    if (o.noise > 0 && !reduceMotion()) {
      const tm = setInterval(() => {
        if (!el.isConnected) { clearInterval(tm); return; }
        if (document.hidden) return;
        jit = Math.round((Math.random() * 2 - 1) * o.noise); draw();
      }, 450);
    }
    // 참일까 거짓일까?(quiz): 하나씩 묻고, 답하면 위젯이 그 값으로 바뀌어 확인
    const qz = q('[data-quiz]');
    if (qz) {
      let k = 0;
      const ask = () => {
        const it = o.quiz[k], iop = opN(it.op), ith = pick(it.threshold, pick(it.th, th));
        qz.innerHTML = `<p class="sd-qq"><b>참일까 거짓일까?</b> (${k + 1}/${o.quiz.length}) ${escH(short)} 값이 ${it.value}일 때 <b class="sd-qx">${escH(short)} ${escH(OP_SHOW[iop])} ${ith}</b></p>
          <p class="sd-qa"><button type="button" class="btn small" data-ans="1">참</button><button type="button" class="btn small" data-ans="0">거짓</button></p><p class="sd-qr" aria-live="polite"></p>`;
        qz.querySelectorAll('[data-ans]').forEach((b) => b.addEventListener('click', () => {
          const right = OP_TEST[iop](it.value, ith), mine = b.dataset.ans === '1';
          base = it.value; jit = 0; th = ith; if (OP_TEST[iop]) op = iop; q('[data-v]').value = base; if (t) t.value = th; draw();
          qz.querySelector('.sd-qr').innerHTML = `${mine === right ? '<b class="ok">맞아요!</b>' : '<b class="no">다시 봐요.</b>'} ${it.value} ${escH(OP_SHOW[iop])} ${ith}${iga(ith) === '이' ? '은' : '는'} ${right ? '참' : '거짓'}이에요.${k < o.quiz.length - 1 ? ' <button type="button" class="btn small" data-next>다음 문제</button>' : ''}`;
          const nx = qz.querySelector('[data-next]'); if (nx) { nx.addEventListener('click', () => { k++; ask(); const f = qz.querySelector('[data-ans]'); if (f) f.focus(); }); nx.focus(); }
        }));
      };
      ask();
    }
    draw();
  }

  /* 두 기준값 모드(P12·persona 22): thresholds: { on: 40, off: 60, labelOn: '켜는 값', labelOff: '끄는 값' } — 빛 밝기 < 켜는 값이면 켜고, > 끄는 값이면 끄고, 그 사이는 그대로.
   * 기준값 하나일 때 기준값 근처에서 깜빡이던 것(noise로 보임)이 멈추는 것을 비교해 본다. 나머지 opts(sensor·presets·noise·oled·code·hint·yes·no)는 같음 */
  function senseTwo(el, o) {
    const id = `sd${++wN}`;
    const S = o.sensor && typeof o.sensor === 'object' ? o.sensor : { label: o.sensor };
    const sensor = S.label || '빛 밝기', short = o.short || sensor, unitRaw = pick(S.unit, o.unit, ''), unit = unitRaw ? ` ${unitRaw}` : '';
    const min = pick(S.min, o.min, 0), max = pick(S.max, o.max, 255), TT = o.thresholds;
    let base = pick(S.value, o.value, Math.round((min + max) / 2)), on = pick(TT.on, 40), off = pick(TT.off, 60), jit = 0, lit = false;
    if (off < on) [on, off] = [off, on];
    const side = (x, dflt) => Object.assign({}, dflt, typeof x === 'string' ? { act: x } : x || {});
    const yes = side(o.yes, { act: 'LED를 켜요', leds: o.led || 'White' }), no = side(o.no, { act: 'LED를 꺼요', leds: 'off' });
    const pct = (x) => Math.max(0, Math.min(100, ((x - min) / (max - min || 1)) * 100));
    const val = () => Math.max(min, Math.min(max, base + jit));
    el.innerHTML = `<div class="widget sense two" id="${id}">
      ${o.presets && o.presets.length ? `<div class="sd-presets" role="group" aria-label="${escH(sensor)} 값 고르기">${o.presets.map((p, i) => `<button type="button" class="btn small" data-preset="${i}">${escH(p.label)} <small>${p.value}</small></button>`).join('')}</div>` : ''}
      <div class="sd-row"><label class="sd-ctl" for="${id}-v"><span class="sd-k">${escH(sensor)}</span><span class="sd-val"><output data-vo></output>${escH(unit)}</span></label><input id="${id}-v" type="range" min="${min}" max="${max}" step="1" value="${base}" data-v></div>
      <div class="sd-row"><label class="sd-ctl" for="${id}-on"><span class="sd-k">${escH(TT.labelOn || '켜는 값')}(이보다 작으면 켜기)</span><span class="sd-val"><output data-on></output></span></label><input id="${id}-on" type="range" min="${min}" max="${max}" step="1" value="${on}" data-ton></div>
      <div class="sd-row"><label class="sd-ctl" for="${id}-off"><span class="sd-k">${escH(TT.labelOff || '끄는 값')}(이보다 크면 끄기)</span><span class="sd-val"><output data-off></output></span></label><input id="${id}-off" type="range" min="${min}" max="${max}" step="1" value="${off}" data-toff></div>
      <div class="sd-track" aria-hidden="true"><span class="sd-zone" data-zon></span><span class="sd-zone keep" data-zkeep></span><span class="sd-th" data-thon></span><span class="sd-th" data-thoff></span><span class="sd-pin" data-pin></span></div>
      <div class="sd-out">${showRes ? '<span class="sd-res" data-res aria-hidden="true"></span>' : ''}${o.oled ? '<span class="sd-oled" data-oled aria-hidden="true"></span>' : ''}<span class="sd-leds" data-leds aria-hidden="true"></span><p class="sd-say" data-say aria-hidden="true"></p><p class="sr" data-say-sr aria-live="polite"></p></div>
      ${o.code ? '<ol class="sd-code" data-code aria-label="같은 뜻의 블록"></ol>' : ''}
      <p class="legend">${escH(o.hint || `값이 ${on}과 ${off} 사이일 때는 바꾸지 않고 그대로 둬요. 그래서 기준값 근처에서 깜빡이지 않아요.`)}</p></div>`;
    const q = (s) => el.querySelector(s);
    const draw = () => {
      const v = val(), was = lit;
      if (v < on) lit = true; else if (v > off) lit = false;
      const why = v < on ? `${v} < ${on} → 켜기` : v > off ? `${v} > ${off} → 끄기` : `${on} ≤ ${v} ≤ ${off} → 그대로(${lit ? '켜짐' : '꺼짐'})`;
      q('[data-vo]').textContent = v; q('[data-on]').textContent = on; q('[data-off]').textContent = off;
      const zo = q('[data-zon]'), zk = q('[data-zkeep]');
      zo.style.left = '0%'; zo.style.width = `${pct(on)}%`; zk.style.left = `${pct(on)}%`; zk.style.width = `${Math.max(0, pct(off) - pct(on))}%`;
      q('[data-thon]').style.left = `${pct(on)}%`; q('[data-thoff]').style.left = `${pct(off)}%`;
      const pin = q('[data-pin]'); pin.style.left = `${pct(v)}%`; pin.classList.toggle('t', lit);
      const c = colorOf(lit ? yes.leds : no.leds); q('[data-leds]').innerHTML = [1, 2, 3, 4].map((n) => ledDot(c, 255, scaleOut(c, 255), `L${n}`)).join('');
      const ol = q('[data-oled]'); if (ol) ol.textContent = v;
      const code = q('[data-code]');
      if (code) code.innerHTML = [[`만약 ${short} < ${on} 이면`, v < on], [yes.act, v < on, 1], [`아니면 만약 ${short} > ${off} 이면`, v > off], [no.act, v > off, 1]].map(([t, r, ind]) => `<li class="${ind ? 'in' : ''}${r ? ' run' : ''}"><span>${escH(t)}</span></li>`).join('');
      const say = `${short} ${why}: ${lit ? yes.act : no.act}`; q('[data-say]').textContent = say; // 보이는 문장은 늘 화면 값 그대로, 낭독은 멈췄을 때·켜짐이 바뀔 때만
      const sr = q('[data-say-sr]'); if (!jit || was !== lit || !sr.textContent) sr.textContent = say;
    };
    q('[data-v]').addEventListener('input', (e) => { base = +e.target.value; jit = 0; draw(); });
    q('[data-ton]').addEventListener('input', (e) => { on = Math.min(+e.target.value, off); e.target.value = on; draw(); });
    q('[data-toff]').addEventListener('input', (e) => { off = Math.max(+e.target.value, on); e.target.value = off; draw(); });
    el.querySelectorAll('[data-preset]').forEach((b) => b.addEventListener('click', () => { base = +o.presets[+b.dataset.preset].value; jit = 0; q('[data-v]').value = base; draw(); }));
    if (o.noise > 0 && !reduceMotion()) { const tm = setInterval(() => { if (!el.isConnected) { clearInterval(tm); return; } if (document.hidden) return; jit = Math.round((Math.random() * 2 - 1) * o.noise); draw(); }, 450); }
    draw();
  }

  /* ---------- 포니봇 LED 4개 색·밝기(rgb-mix) ----------
   * 블록 값과 같은 뜻: '라이트를 모두 ~으로 켜기'·'라이트의 밝기를 ~로 변경하기'·'~번째 라이트 색상을 ~으로 설정하기'·'라이트를 설정한대로 켜기'
   * opts
   *   modes ['all', 'each', 'mix', 'fade'] 중 고름(기본 ['all', 'each'], mix:true면 mix를 더함)   mode 처음 방식
   *     all  = 모두 같은 색(색 고르기 → 바로 켜짐)   each = 하나씩(LED 고르기 → 색 → '라이트를 설정한대로 켜기'를 눌러야 보임. 색을 정할 때의 밝기가 그 LED에 남음)
   *     mix  = 빨강·초록·파랑 값으로 섞기(neopixel.rgb)   fade = 변수와 반복으로 밝기가 1씩 오르기
   *   colors 'ponybot-light'(9가지) | ['Red', …]   color 처음 색   brightness 128 | { min, max, value }(처음 128 = LED 설정 블록 기본값)
   *   base 위에서 본 포니봇 그림 주소 + leds [{ name:'L1', index:0, ko:'오른쪽 앞', x:78, y:18 }](x·y는 %) — 없으면 한 줄로
   *   showBlock true(같은 뜻의 블록 글)
   *   fade: var('밝기'), start(0), step(1), times(255), pause(5, ms), editable(['start','step','times']), ranges({ start:[0,255], step:[-15,15], times:[1,300] })
   *   (설계 개정 2) open ['all'] = 처음 펼칠 방식(나머지 방식과 밝기('bright')는 [더 해 보기]로 펼침), tapSay '{name} · 블록 번호 {index} · 우리가 세면 {nth}'(LED를 누르면 보이는 글,
   *     leds[]의 name·index·ko·nth), legend(아래 설명 한 줄), applyOnShow(밝기·색을 바꾸면 [라이트를 모두 켜기]가 깜빡이고 "눌러야 바뀌어요")
   * 밝기(확장 ai_ponybot_light v1.0.0 그대로, engine/leds.js와 같음): '밝기 변경'은 값만 기억(& 0xff — 256은 0). 밝기는 그 뒤에 색을 버퍼에 쓸 때
   *   ('모두 켜기' = setAllRGB, '번째 라이트 색상 설정' = setPixelRGB) (값 × 밝기) >> 8로 곱해져 LED마다 남고, '설정한대로 켜기'(show)는 버퍼를 그대로 보내기만 함.
   *   그래서 '하나씩'에서 밝기만 바꾸고 [설정한대로 켜기]를 누르면 그대로 — 색을 다시 정해야 바뀜. 움직임 줄이기면 fade [실행]은 끝 상태로 바로 감 */
  function rgbMix(el, o = {}) {
    if (o.mode === 'sensor') return rgbSensor(el, o); // 9~10차시: 컬러 센서가 읽은 R·G·B(아래 rgbSensor). 다른 모드는 그대로
    const id = `rm${++wN}`;
    const ALL = ['all', 'each', 'mix', 'fade'];
    let modes = (o.modes || ['all', 'each']).filter((m) => ALL.includes(m));
    if (o.mix && !modes.includes('mix')) modes.push('mix');
    if (o.mode && ALL.includes(o.mode) && !modes.includes(o.mode)) modes.unshift(o.mode);
    if (!modes.length) modes = ['all'];
    let mode = modes.includes(o.mode) ? o.mode : modes[0];
    const pal = Array.isArray(o.colors) ? LED_COLORS.filter((c) => o.colors.some((x) => String(x).toLowerCase() === c[0].toLowerCase())) : LED_COLORS;
    const BR = o.brightness && typeof o.brightness === 'object' ? o.brightness : { value: o.brightness };
    const brMin = pick(BR.min, 0), brMax = pick(BR.max, 255);
    let bright = Math.max(0, Math.min(255, pick(BR.value, 128) | 0));
    let cur = pal.find((c) => c[0].toLowerCase() === String(o.color || '').toLowerCase()) || pal[0];
    let mixRGB = [255, 128, 0];
    const applyOnShow = !!o.applyOnShow; let pendingAll = false;
    let sel = 0;
    const FADE = { v: o.var || '밝기', start: pick(o.start, 0), step: pick(o.step, 1), times: pick(o.times, 255), pause: Math.max(1, pick(o.pause, 5)) };
    const fadeColor = colorOf(o.fadeColor || o.color || 'Orange');
    const editable = o.editable || ['start', 'step', 'times'];
    const ranges = Object.assign({ start: [0, 255], step: [-15, 15], times: [1, 300] }, o.ranges || {});
    let fv = FADE.start, fi = 0, timer = null; // fade: 변수 값, 반복 몇 번째
    const blank = () => ({ color: 0, bright: 128, out: [0, 0, 0] });
    let buf = [0, 1, 2, 3].map(blank), shown = buf.map((x) => Object.assign({}, x));
    const colorVal = () => (mode === 'mix' ? (mixRGB[0] << 16) | (mixRGB[1] << 8) | mixRGB[2] : mode === 'fade' ? fadeColor : cur[2]);
    const blockColor = () => blockRo(mode === 'fade' ? (LED_COLORS.find((c) => c[2] === fadeColor) || [])[0] : cur[0]) || ro(colorName()); // 블록 글용
    const colorName = () => (mode === 'mix' ? `빨강 ${mixRGB[0]}·초록 ${mixRGB[1]}·파랑 ${mixRGB[2]}` : mode === 'fade' ? colorKo(fadeColor) : cur[1]);
    const write = (i, b = bright) => { buf[i] = { color: colorVal(), bright: b, out: scaleOut(colorVal(), b) }; };
    const send = () => { shown = buf.map((x) => ({ color: x.color, bright: x.bright, out: x.out.slice() })); };
    const allOn = (b) => { [0, 1, 2, 3].forEach((i) => write(i, b)); send(); };
    const POS = Array.isArray(o.leds) && o.leds.length === 4 ? o.leds : null;
    const MODE_KO = { all: '모두 같은 색', each: '하나씩', mix: '빛 섞기', fade: '점점 밝게(반복)' };
    const num = (k, label) => `<label class="rm-n">${label} <input type="number" inputmode="numeric" data-fk="${k}" value="${FADE[k]}" min="${ranges[k][0]}" max="${ranges[k][1]}"${editable.includes(k) ? '' : ' disabled'}></label>`;
    // open: 처음에 보일 방식(나머지·밝기는 [더 해 보기]로). 처음 방식은 늘 보임
    const OPEN = Array.isArray(o.open) && o.open.length ? o.open.concat(mode) : null;
    let opened = !OPEN;
    const shut = (k) => !opened && !OPEN.includes(k);
    // 용어 고정표(5~6 설계 1.1): 학생 글에 '2번째' 대신 '블록 번호 2', 우리가 세는 차례는 '셋째'(블록 글 '2번째 라이트 색상을…'만 그대로)
    const NTH = ['첫째', '둘째', '셋째', '넷째'];
    const ledF = (i) => { const P = POS ? POS[i] || {} : {}; return { name: P.name || `L${i + 1}`, index: P.index != null ? P.index : i, ko: P.ko || '', nth: P.nth || NTH[i] || `${i + 1}째` }; };
    const tapText = (i) => { const f = ledF(i); return String(o.tapSay || '').replace(/\{(name|index|ko|nth)\}/g, (x, k) => f[k]); };
    const ledNo = (i) => { const f = ledF(i); return `${f.name}(블록 번호 ${f.index})`; }; // L3(블록 번호 2)
    el.innerHTML = `<div class="widget rgbmix" id="${id}">
      ${modes.length > 1 ? `<div class="rm-mode" role="radiogroup" aria-label="켜는 방법">${modes.map((m) => `<button type="button" role="radio" data-mode="${m}"${shut(m) ? ' hidden data-shut' : ''}>${MODE_KO[m]}</button>`).join('')}${OPEN && (modes.some(shut) || shut('bright')) ? '<button type="button" class="rm-more" data-more aria-expanded="false">더 해 보기</button>' : ''}</div>` : ''}
      <div class="rm-stage">${POS && o.base ? `<span class="rm-front" aria-hidden="true"><b>▲</b> 앞</span><div class="rm-map"><img src="${escH(o.base)}" alt="위에서 본 포니봇(위쪽이 앞)" loading="lazy"><span class="rm-leds" data-leds></span></div>` : '<span class="rm-leds row" data-leds></span>'}
        ${o.numNote === null ? '' : `<p class="fine rm-num">${escH(o.numNote || '블록 번호는 0부터 세요: L1 = 0, L2 = 1, L3 = 2, L4 = 3')}</p>`}</div>
      <div class="rm-ctl">
        <div class="rm-sw" role="radiogroup" aria-label="색" data-p="all each">${pal.map((c) => `<button type="button" role="radio" data-color="${c[0]}" style="--c:${hex6(c[2])}"><i aria-hidden="true"></i>${c[1]}</button>`).join('')}</div>
        <div class="rm-mix" data-p="mix">${['빨강(R)', '초록(G)', '파랑(B)'].map((n, k) => `<label>${n} <input type="range" min="0" max="255" value="${mixRGB[k]}" data-rgb="${k}"><output>${mixRGB[k]}</output></label>`).join('')}</div>
        <label class="rm-br" for="${id}-b" data-p="all each mix">밝기 <input id="${id}-b" type="range" min="${brMin}" max="${brMax}" value="${bright}" data-br><output data-bro for="${id}-b">${bright}</output></label>
        <p class="rm-acts"><button type="button" class="btn small primary" data-allshow data-p="${o.applyOnShow ? 'all mix' : 'none'}">라이트를 모두 켜기</button><button type="button" class="btn small primary" data-show data-p="each">라이트를 설정한대로 켜기</button><span class="rm-tip" data-tip hidden>눌러야 바뀌어요</span></p>
        <div class="rm-fade" data-p="fade">
          <div class="rm-box" aria-hidden="true"><span>변수 ${escH(FADE.v)}</span><b data-fv>${fv}</b></div>
          <div class="rm-fnum">${num('start', `${escH(FADE.v)}에 넣을 처음 값`)}${num('step', '한 번에 더할 값')}${num('times', '반복 횟수')}</div>
          <p class="rm-fbtn"><button type="button" class="btn small primary" data-run>실행</button><button type="button" class="btn small" data-step>한 번씩</button><button type="button" class="btn small" data-reset>처음으로</button></p>
        </div>
      </div>
      ${o.showBlock === false ? '' : '<ol class="rm-blocks" data-blocks aria-label="같은 뜻의 블록"></ol>'}
      <p class="rm-out" data-out aria-live="polite"></p>${o.legend ? `<p class="legend">${escH(o.legend)}</p>` : ''}</div>`;
    const q = (s) => el.querySelector(s);
    const stop = () => { if (timer) { clearTimeout(timer); timer = null; } const r = q('[data-run]'); if (r) r.textContent = '실행'; };
    const fadeStepOnce = () => { // 반복 한 번: 밝기를 (변수)로 변경 → 모두 켜기 → 일시중지 → 변수 값 증가
      const b = fv & 0xff; allOn(b); fv += FADE.step; fi++;
    };
    const blocksFor = () => {
      if (mode === 'all') return [`라이트의 밝기를 ${bright}로 변경하기`, `라이트를 모두 ${blockColor()} 켜기`];
      if (mode === 'mix') return [`라이트의 밝기를 ${bright}로 변경하기`, `라이트를 모두 (빨강(R): ${mixRGB[0]} 초록(G): ${mixRGB[1]} 파랑(B): ${mixRGB[2]})로 켜기`];
      if (mode === 'each') return [`라이트의 밝기를 ${bright}로 변경하기`, `${sel}번째 라이트 색상을 ${blockColor()} 설정하기`, '라이트를 설정한대로 켜기'];
      return [`${FADE.v}에 ${FADE.start} 저장`, `${FADE.times}번 반복:`, `  라이트의 밝기를 (${FADE.v})로 변경하기`, `  라이트를 모두 ${blockColor()} 켜기`, `  일시중지 ${FADE.pause} ms`, `  ${FADE.v} 값 ${FADE.step} 증가`];
    };
    const draw = (say) => {
      el.querySelectorAll('[data-mode]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.mode === mode)));
      el.querySelectorAll('[data-color]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.color === cur[0])));
      el.querySelectorAll('[data-p]').forEach((x) => { x.hidden = !x.dataset.p.split(' ').includes(mode); });
      if (shut('bright')) q('.rm-br').hidden = true; // open에 'bright'가 없으면 밝기는 [더 해 보기] 뒤에
      const pending = (i) => mode === 'each' && (buf[i].color !== shown[i].color || buf[i].out.join() !== shown[i].out.join());
      // (P12·D56-8) 바뀐 값이 아직 LED에 안 갔으면 켜기 단추가 깜빡이고 "눌러야 바뀌어요"(움직임 줄이기면 깜빡임 없이 테두리만)
      const waiting = (mode === 'each' && [0, 1, 2, 3].some(pending)) || ((mode === 'all' || mode === 'mix') && applyOnShow && pendingAll);
      const tip = q('[data-tip]'); tip.hidden = !waiting;
      q('[data-show]').classList.toggle('nudge', waiting && mode === 'each'); q('[data-allshow]').classList.toggle('nudge', waiting && mode !== 'each');
      q('[data-leds]').innerHTML = shown.map((x, i) => {
        const P = POS && o.base ? POS[i] : null, style = P ? `left:${P.x}%;top:${P.y}%` : '';
        const name = (P && P.name) || `L${i + 1}`, ko = P && P.ko ? ` ${P.ko}` : '';
        const dot = ledDot(x.color, x.bright, x.out, name, `${pending(i) ? ' pend' : ''}${mode === 'each' && i === sel ? ' sel' : ''}`, mode === 'each' ? '' : style);
        if (mode !== 'each' && o.tapSay) return `<button type="button" class="rm-pick rm-tap" data-tap="${i}" style="${style}" aria-label="${escH(tapText(i))}">${ledDot(x.color, x.bright, x.out, name, '', '')}</button>`; // 누르면 이름·블록 번호(설계 개정 2 tapSay)
        return mode === 'each' ? `<button type="button" class="rm-pick" data-pick="${i}" style="${style}" aria-pressed="${i === sel}" aria-label="${escH(ledF(i).name)}${ledF(i).ko ? ' ' + escH(ledF(i).ko) : ''}(블록 번호 ${ledF(i).index}) 고르기${pending(i) ? ', 아직 켜기 전' : ''}">${dot}</button>` : dot;
      }).join('');
      const bl = q('[data-blocks]'); if (bl) bl.innerHTML = blocksFor().map((t) => `<li class="${t.startsWith('  ') ? 'in' : ''}"><span class="rm-block">${escH(t.trim())}</span></li>`).join('');
      const fvEl = q('[data-fv]'); if (fvEl) fvEl.textContent = fv;
      const out = shown.map((x, i) => `L${i + 1} ${x.out.some((v) => v > 0) ? `R${x.out[0]}·G${x.out[1]}·B${x.out[2]}` : '꺼짐'}`).join(', ');
      if (say !== null) q('[data-out]').textContent = `${say ? say + (/[.!?]$/.test(say) ? ' ' : '. ') : ''}실제로 나가는 빛: ${out}`; // say 뒤에 마침표(글이 '셋째 실제로…'로 붙지 않게)
    };
    // applyOnShow: '모두 같은 색'·'빛 섞기'에서도 색·밝기를 바꾸면 [라이트를 모두 켜기]를 눌러야 LED가 바뀜('모두 켜기'가 그 순간의 밝기로 색을 다시 씀 — 확장 setAllRGB와 같음)
    // '하나씩'(each): 색을 고를 때 그 순간의 밝기로 고른 LED 버퍼에 씀(확장 setPixelRGB). 밝기만 바꾸면 버퍼는 그대로
    const apply = () => { if (mode === 'each') write(sel); else if (mode !== 'fade') { if (applyOnShow) pendingAll = true; else allOn(bright); } };
    const resetFade = () => { stop(); fv = FADE.start; fi = 0; buf = [0, 1, 2, 3].map(blank); send(); };
    el.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => {
      stop(); mode = b.dataset.mode;
      if (mode === 'fade') resetFade(); else if (mode !== 'each') apply();
      draw({ all: applyOnShow ? '색을 고른 뒤 [라이트를 모두 켜기]를 눌러요.' : '모두 같은 색으로 켰어요.', each: '불빛을 골라 색을 정한 뒤 "라이트를 설정한대로 켜기"를 눌러요. 밝기는 색을 정하기 전에 바꿔요.', mix: '빨강·초록·파랑 빛을 섞어 색을 만들어요.', fade: '[실행]을 누르면 변수 값이 바뀌며 불빛이 점점 밝아져요.' }[mode]); b.focus();
    }));
    const mg = q('.rm-mode'); if (mg) mg.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return; e.preventDefault();
      const vis = modes.filter((m) => !shut(m)), n = vis[(vis.indexOf(mode) + (e.key === 'ArrowRight' ? 1 : vis.length - 1)) % vis.length]; const nb = q(`[data-mode="${n}"]`); if (nb) nb.click();
    });
    el.querySelectorAll('[data-color]').forEach((b) => b.addEventListener('click', () => { cur = pal.find((c) => c[0] === b.dataset.color); apply(); draw(mode === 'each' ? `${ledNo(sel)} 색을 ${ro(cur[1])} 정했어요. 지금 밝기 ${bright}${iga(bright)} 이 불빛에 함께 들어가요. 아직 켜기 전이에요.` : ''); b.focus(); }));
    // 밝기 슬라이더 = '밝기 변경' 블록: 값만 기억. '모두 같은 색'·'빛 섞기'는 [모두 켜기](applyOnShow면 누를 때, 아니면 바로)가 그 밝기로 다시 씀.
    // '하나씩'은 버퍼를 건드리지 않음 → 색을 다시 골라야 그 불빛에 새 밝기가 들어가고, [설정한대로 켜기]는 버퍼를 보내기만 함(확장 show)
    const BR_SAY = '밝기를 바꾼 뒤에는 색을 다시 정해야(모두 켜기·색상 설정) 바뀌어요.';
    q('[data-br]').addEventListener('input', (e) => { bright = +e.target.value; q('[data-bro]').textContent = bright; if (mode !== 'each') apply(); draw(mode === 'each' ? `${BR_SAY} ${ledNo(sel)} 색을 다시 고른 뒤 [라이트를 설정한대로 켜기]를 눌러요.` : applyOnShow ? `${BR_SAY} [라이트를 모두 켜기]를 눌러요.` : ''); });
    q('[data-show]').addEventListener('click', () => { const fresh = [0, 1, 2, 3].some((i) => buf[i].color !== shown[i].color || buf[i].out.join() !== shown[i].out.join()); send(); draw(fresh ? '설정한 대로 켰어요.' : '새로 정한 색이 없어 그대로예요. "설정한대로 켜기"는 정해 둔 색을 보내기만 해요. 밝기를 바꿨다면 색을 다시 정해요.'); });
    q('[data-allshow]').addEventListener('click', () => { allOn(bright); pendingAll = false; draw('모두 켰어요.'); });
    el.addEventListener('click', (e) => {
      const tp = e.target.closest('[data-tap]'); if (tp) { const i = +tp.dataset.tap; draw(tapText(i)); const n = q(`[data-tap="${i}"]`); if (n) n.focus(); return; }
      const mb = e.target.closest('[data-more]'); if (mb) { opened = true; el.querySelectorAll('[data-shut]').forEach((b) => { b.hidden = false; b.removeAttribute('data-shut'); }); const nx = el.querySelector('.rm-mode [data-mode]:not([aria-checked="true"])'); mb.remove(); draw('다른 방법도 해 봐요.'); if (nx) nx.focus(); return; }
      const p = e.target.closest('[data-pick]'); if (!p) return; sel = +p.dataset.pick; draw(o.tapSay ? `${tapText(sel)} — 골랐어요.` : `${ledNo(sel)}${eul(ledF(sel).name)} 골랐어요.`); const n = q(`[data-pick="${sel}"]`); if (n) n.focus();
    });
    el.querySelectorAll('[data-rgb]').forEach((r) => r.addEventListener('input', () => { mixRGB[+r.dataset.rgb] = +r.value; r.nextElementSibling.textContent = r.value; apply(); draw(); }));
    el.querySelectorAll('[data-fk]').forEach((inp) => inp.addEventListener('change', () => {
      const k = inp.dataset.fk, [lo, hi] = ranges[k]; let v = Math.round(+inp.value); if (!isFinite(v)) v = FADE[k]; v = Math.max(lo, Math.min(hi, v)); inp.value = v; FADE[k] = v; resetFade(); draw('값을 바꿨어요. [실행]을 눌러 봐요.');
    }));
    const finish = () => { stop(); draw(`반복 ${fi}번을 마쳤어요. 상자 "${FADE.v}"에는 ${fv}${iga(fv)} 들어 있어요.${FADE.start + FADE.step * FADE.times > 255 ? ' 밝기는 255 다음에 0으로 돌아가요(확장이 256을 0으로 바꿔요).' : ''}`); };
    const tick = () => { if (!el.isConnected) { stop(); return; } fadeStepOnce(); draw(null); if (fi >= FADE.times) { finish(); return; } timer = setTimeout(tick, FADE.pause); };
    q('[data-run]').addEventListener('click', () => {
      if (timer) { stop(); draw(`멈췄어요. 상자에는 ${fv}${iga(fv)} 들어 있어요.`); return; }
      if (fi >= FADE.times) resetFade();
      if (reduceMotion()) { while (fi < FADE.times) fadeStepOnce(); finish(); return; } // 움직임 줄이기: 끝 상태로 바로
      q('[data-run]').textContent = '멈춤'; draw(null); tick();
    });
    q('[data-step]').addEventListener('click', () => { stop(); if (fi >= FADE.times) resetFade(); const b = fv & 0xff; fadeStepOnce(); draw(`반복 ${fi}번째: 밝기 ${nro(b)} 켜고, 상자 값은 ${fv}${iga(fv)} 됐어요.`); });
    q('[data-reset]').addEventListener('click', () => { resetFade(); draw('처음으로 돌아갔어요.'); });
    if (mode === 'fade') resetFade(); else if (mode !== 'each') apply();
    draw();
  }

  /* ---------- S3-3 분류 게임 classify: 카드를 알맞은 상자에 넣기 ----------
   * opts: title?, intro?, bins: [{ id, label, desc? }], cards: [{ id, label, img?, alt?, bin, alsoOk?: [상자 id…], why, hint? }], shuffle(기본 true), doneText?
   *   alsoOk = 기준에 따라 맞는 다른 상자(그 상자에 넣어도 정답, 카드는 넣은 상자에 들어가고 why는 그대로)
   *   카드를 눌러 고른 뒤 상자를 누른다(키보드·터치). 마우스·펜은 카드를 상자로 끌어도 된다(터치는 스크롤을 막지 않게 누르기만).
   *   맞으면 카드가 상자로 들어가고 why를 보여 줌, 틀리면 hint(없으면 기본 문장) 뒤 다시. 다 넣으면 완료 + ctx.done()(진행 기록, app.js).
   * ctx(넷째 값, app.js): { done() → 처음 완료면 true, isDone, announce(글), say('화면 점이' 같은 진행 이름) } — 없으면 위젯 안 라이브 영역만 */
  function classify(el, o = {}, ctx = {}) {
    const id = `cf${++wN}`;
    const bins = (o.bins || []).filter((b) => b && b.id != null);
    const cards0 = (o.cards || []).filter((c) => c && c.id != null && bins.some((b) => String(b.id) === String(c.bin)));
    const say = (t) => { const s = el.querySelector('[data-say]'); if (s) s.innerHTML = t; if (ctx.announce) ctx.announce(t.replace(/<[^>]+>/g, '')); };
    let order = [], placed = {}, sel = null, wrong = 0;
    const reset = () => {
      order = cards0.slice();
      if (o.shuffle !== false) for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
      placed = {}; sel = null; wrong = 0;
    };
    const cardHTML = (c) => `<button type="button" class="cf-card${c.img ? ' has-img' : ''}" data-card="${escH(c.id)}" aria-pressed="false">${c.img ? `<img src="${escH(c.img)}" alt="${escH(c.alt || '')}" loading="lazy" draggable="false">` : ''}<span>${escH(c.label)}</span></button>`;
    const draw = () => {
      const left = order.filter((c) => placed[c.id] == null), done = !left.length && cards0.length > 0;
      el.innerHTML = `<div class="widget classify" id="${id}">
        ${o.title ? `<p class="cf-title">${escH(o.title)}</p>` : ''}
        <p class="cf-guide"><span class="cf-how"><b>① 카드 누르기</b><span aria-hidden="true"> → </span><b>② 상자 누르기</b></span>${o.intro ? ` ${escH(o.intro)}` : ''}<span class="cf-drag"> 마우스로 끌어 넣어도 돼요.</span></p>
        <div class="cf-deck" role="group" aria-label="남은 카드 ${left.length}장">${left.map(cardHTML).join('') || `<p class="cf-empty">${done ? '카드를 모두 넣었어요.' : ''}</p>`}</div>
        <div class="cf-bins" role="group" aria-label="상자">${bins.map((b) => {
          const inn = cards0.filter((c) => placed[c.id] != null && String(placed[c.id]) === String(b.id));
          return `<button type="button" class="cf-bin" data-bin="${escH(b.id)}" aria-describedby="${id}-say"><span class="cf-bin-h"><b>${escH(b.label)}</b><span class="cf-n" aria-label="들어간 카드 ${inn.length}장">${inn.length}</span></span>${b.desc ? `<small>${escH(b.desc)}</small>` : ''}${inn.length ? `<span class="cf-in">${inn.map((c) => `<span class="cf-chip"><span aria-hidden="true">✓</span> ${escH(c.label)}</span>`).join('')}</span>` : ''}</button>`;
        }).join('')}</div>
        <p class="cf-say" id="${id}-say" data-say aria-live="polite">${done ? '' : (ctx.isDone ? '이미 해낸 게임이에요. 다시 해 봐도 돼요.' : '')}</p>
        ${done ? `<div class="cf-done"><p><b>${escH(o.doneText || '다 맞혔어요!')}</b> 카드 ${cards0.length}장${wrong ? ` · 다시 한 번 ${wrong}번` : ' · 한 번에 모두'}</p>
          <details class="cf-why"><summary>까닭 다시 보기</summary><ul>${cards0.map((c) => `<li><b>${escH(c.label)}</b> → ${escH((bins.find((b) => String(b.id) === String(placed[c.id] != null ? placed[c.id] : c.bin)) || {}).label || '')}${c.why ? `: ${escH(c.why)}` : ''}</li>`).join('')}</ul></details></div>` : ''}
        <p class="cf-tools"><span class="cf-progress">${cards0.length - left.length} / ${cards0.length}</span><button type="button" class="btn small ghost" data-reset>처음부터</button></p>
      </div>`;
      bind();
    };
    const card = (cid) => cards0.find((c) => String(c.id) === String(cid));
    const choose = (cid) => {
      sel = sel === cid ? null : cid;
      el.querySelectorAll('.cf-card').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.card === sel)));
      el.querySelector('.classify').classList.toggle('picking', !!sel);
      if (sel) {
        say(`<b>${escH(card(sel).label)}</b> 카드를 골랐어요. ② 알맞은 상자를 눌러요.`);
        // 폰(좁은 화면): 카드 줄이 길어 상자가 아래에 숨으므로, 고르면 상자 줄을 화면 안으로(페르소나 2회차 2차시 #10)
        const bx = el.querySelector('.cf-bins'); if (bx && window.matchMedia && window.matchMedia('(max-width: 520px)').matches && bx.scrollIntoView) bx.scrollIntoView({ block: 'nearest', behavior: reduceMotion() ? 'auto' : 'smooth' });
      }
    };
    const drop = (cid, bid) => {
      const c = card(cid); if (!c || placed[c.id] != null) return;
      const okBins = [c.bin, ...(c.alsoOk || [])].map(String);
      if (okBins.includes(String(bid))) {
        placed[c.id] = String(bid); sel = null;
        const allDone = cards0.every((x) => placed[x.id] != null);
        draw();
        const bn = (bins.find((b) => String(b.id) === String(bid)) || {}).label || '';
        if (allDone) {
          const first = ctx.done ? ctx.done() : false;
          say(`<b>정답!</b> ${escH(c.why || '')} ${escH(o.doneText || '다 맞혔어요!')}${first && ctx.say ? ` ${escH(ctx.say)} 켜졌어요.` : ''}`);
          const d = el.querySelector('.cf-done'); if (d) d.setAttribute('tabindex', '-1'), d.focus({ preventScroll: false });
        } else {
          say(`<b>정답!</b> ${escH(c.label)} → ${escH(bn)}. ${escH(c.why || '')}`);
          const next = el.querySelector('.cf-card'); if (next) next.focus({ preventScroll: true });
        }
      } else {
        wrong++; sel = null; // 틀리면 고른 카드를 내려놓는다(다시 카드부터 고름)
        el.querySelectorAll('.cf-card').forEach((x) => x.setAttribute('aria-pressed', 'false')); el.querySelector('.classify').classList.remove('picking');
        const b = el.querySelector(`.cf-bin[data-bin="${CSS.escape(String(bid))}"]`), k = el.querySelector(`.cf-card[data-card="${CSS.escape(String(c.id))}"]`);
        [b, k].forEach((x) => { if (!x) return; x.classList.remove('nope'); void x.offsetWidth; x.classList.add('nope'); });
        say(`아직 아니에요. ${escH(c.hint || `${c.label}${/[가-힣]$/.test(c.label) && (c.label.charCodeAt(c.label.length - 1) - 0xAC00) % 28 ? '은' : '는'} 다른 상자에 어울려요. 다시 골라 봐요.`)}`);
        if (k) k.focus({ preventScroll: true });
      }
    };
    function bind() {
      const root = el.querySelector('.classify');
      root.querySelectorAll('.cf-card').forEach((b) => {
        b.addEventListener('click', () => { if (b._dragged) { b._dragged = false; return; } choose(b.dataset.card); });
        // 마우스·펜 끌기(터치는 누르기만 — 스크롤을 막지 않게)
        b.addEventListener('pointerdown', (e) => {
          if (e.pointerType === 'touch' || e.button !== 0) return;
          const sx = e.clientX, sy = e.clientY; let ghost = null;
          const move = (ev) => {
            if (!ghost && Math.hypot(ev.clientX - sx, ev.clientY - sy) < 6) return;
            if (!ghost) { ghost = b.cloneNode(true); ghost.classList.add('cf-ghost'); ghost.removeAttribute('data-card'); ghost.setAttribute('aria-hidden', 'true'); document.body.appendChild(ghost); b.classList.add('dragging'); }
            ghost.style.left = `${ev.clientX}px`; ghost.style.top = `${ev.clientY}px`;
            root.querySelectorAll('.cf-bin').forEach((x) => x.classList.toggle('over', x === (document.elementFromPoint(ev.clientX, ev.clientY) || { closest: () => null }).closest('.cf-bin')));
          };
          const up = (ev) => {
            document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', up);
            if (!ghost) return;
            ghost.remove(); b.classList.remove('dragging'); b._dragged = true;
            root.querySelectorAll('.cf-bin.over').forEach((x) => x.classList.remove('over'));
            const t = document.elementFromPoint(ev.clientX, ev.clientY), bin = t && t.closest('.cf-bin');
            if (bin && root.contains(bin)) drop(b.dataset.card, bin.dataset.bin);
            setTimeout(() => { b._dragged = false; }, 0);
          };
          document.addEventListener('pointermove', move); document.addEventListener('pointerup', up);
        });
      });
      root.querySelectorAll('.cf-bin').forEach((b) => b.addEventListener('click', () => {
        if (!sel) { say('먼저 카드를 하나 골라요.'); const k = root.querySelector('.cf-card'); if (k) k.focus({ preventScroll: true }); return; }
        drop(sel, b.dataset.bin);
      }));
      root.addEventListener('keydown', (e) => { if (e.key === 'Escape' && sel) { e.stopPropagation(); choose(sel); say('고른 카드를 내려놓았어요.'); } });
      root.querySelector('[data-reset]').addEventListener('click', () => { reset(); draw(); say('처음부터 다시 해요.'); const k = el.querySelector('.cf-card'); if (k) k.focus({ preventScroll: true }); });
    }
    reset(); draw();
  }

  /* ---------- 1차시 LED 화면 5×5 led-grid: 그리기·아이콘 고르기·일시중지 타임라인 ----------
   * opts: title?, modes: ['icons','draw','timeline'] 중 고름(기본 셋 다), mode(처음 탭), icons: [IconNames…](고르기 목록, 기본 모두),
   *   steps: [{ icon | leds('# . …' 25칸) | arrow | clear: true, pause(ms, 기본 0) }…](타임라인), loop(기본 true = 무한반복), pauses: [100, 200, 500, 1000, 2000](고를 일시중지 값),
   *   editPause(기본 true), showCode(기본 true: 블록 글자·JavaScript 한 줄), start(그리기 처음 모양 25칸)
   * 시간(pxt-microbit 원본): 아이콘·화살표 출력은 그린 뒤 600ms, LED 출력은 400ms 머물고 → 그다음 일시중지. 무한반복은 바퀴마다 20ms 더함(matrix.js)
   * 모양 표·한국어 이름은 엔진(window.PB.matrix = engine/matrix.js)을 그대로 쓴다 */
  function ledGrid(el, o = {}) {
    const MX = (window.PB && window.PB.matrix) || null;
    if (!MX) { el.innerHTML = '<div class="widget"><p class="fine">LED 화면 모양 표(엔진)를 불러오지 못했어요.</p></div>'; return; }
    const id = `lg${++wN}`;
    const MODES = { icons: '아이콘 고르기', draw: '직접 그리기', timeline: '차례로 보여 주기' };
    const modes = (o.modes || ['icons', 'draw', 'timeline']).filter((m) => MODES[m]);
    let mode = modes.includes(o.mode) ? o.mode : modes[0];
    const iconList = (o.icons || Object.keys(MX.ICONS).filter((k) => k !== 'EigthNote')).filter((k) => MX.ICONS[k]);
    let cells = MX.parseLeds(o.start || '') || MX.ICONS[iconList[0]] || MX.BLANK, pick = iconList[0];
    const PAUSES = o.pauses || [0, 100, 200, 500, 1000, 2000];
    const HOLD = { icon: 600, arrow: 600, leds: 400, clear: 0 };
    const steps = (o.steps || [{ icon: 'Heart', pause: 1000 }, { icon: 'SmallHeart', pause: 1000 }]).map((s) => {
      const kind = s.clear ? 'clear' : s.icon ? 'icon' : s.arrow != null ? 'arrow' : 'leds';
      const c = kind === 'clear' ? MX.BLANK : kind === 'icon' ? MX.ICONS[s.icon] : kind === 'arrow' ? MX.ARROWS[MX.arrowName(s.arrow)] : MX.parseLeds(s.leds);
      return { kind, cells: c || MX.BLANK, icon: s.icon, arrow: MX.arrowName(s.arrow), pause: +s.pause || 0 };
    });
    const loop = o.loop !== false, editPause = o.editPause !== false, showCode = o.showCode !== false;
    let timer = null, at = -1, elapsed = 0;
    const stepName = (s) => (s.kind === 'icon' ? `아이콘 출력 [${MX.ICON_KO[s.icon] || s.icon}]` : s.kind === 'arrow' ? `화살표 출력 [${MX.ARROW_KO[s.arrow] || s.arrow}]` : s.kind === 'clear' ? 'LED 스크린 지우기' : 'LED 출력');
    const stepMs = (s) => HOLD[s.kind] + s.pause;
    const grid = (c, editable) => `<div class="lg-grid${editable ? ' edit' : ''}" role="${editable ? 'group' : 'img'}" aria-label="${editable ? '5×5 LED: 눌러서 켜고 끄기' : `LED 화면: ${escH(nameOf(c))}`}">${[...c].map((v, i) => editable
      ? `<button type="button" class="lg-led${v === '1' ? ' on' : ''}" data-i="${i}" aria-pressed="${v === '1'}" aria-label="${Math.floor(i / 5) + 1}행 ${(i % 5) + 1}열"></button>`
      : `<i class="lg-led${v === '1' ? ' on' : ''}"></i>`).join('')}</div>`;
    const nameOf = (c) => { const ic = MX.iconOf(c); return c === MX.BLANK ? '빈 화면' : ic ? `${MX.ICON_KO[ic] || ic} 모양` : `켜진 점 ${[...c].filter((x) => x === '1').length}개`; };
    const ledsTs = (c) => `basic.showLeds(\`\n${[0, 1, 2, 3, 4].map((r) => '    ' + [...c.slice(r * 5, r * 5 + 5)].map((x) => (x === '1' ? '#' : '.')).join(' ')).join('\n')}\n    \`)`;
    const say = (t) => { const s = el.querySelector('[data-say]'); if (s) s.textContent = t; };
    function draw() {
      stop();
      const tabs = modes.length > 1 ? `<div class="lg-tabs" role="tablist" aria-label="LED 화면 해 보기">${modes.map((m) => `<button type="button" role="tab" data-mode="${m}" aria-selected="${m === mode}">${MODES[m]}</button>`).join('')}</div>` : '';
      let body = '';
      if (mode === 'icons') {
        body = `<div class="lg-row">${grid(MX.ICONS[pick], false)}<div class="lg-side">
            <p class="lg-block"><b>아이콘 출력</b> [${escH(MX.ICON_KO[pick] || pick)}]</p>
            ${showCode ? `<pre class="lg-code">basic.showIcon(IconNames.${escH(pick)})</pre>` : ''}
            <p class="fine">아이콘을 띄운 뒤 0.6초 머물러요(아이콘 출력의 기본 시간).</p></div></div>
          <div class="lg-icons" role="radiogroup" aria-label="아이콘">${iconList.map((k) => `<button type="button" role="radio" class="lg-ic" data-icon="${escH(k)}" aria-checked="${k === pick}" title="${escH(MX.ICON_KO[k] || k)}">${grid(MX.ICONS[k], false).replace('class="lg-grid"', 'class="lg-grid mini"')}<span>${escH(MX.ICON_KO[k] || k)}</span></button>`).join('')}</div>`;
      } else if (mode === 'draw') {
        const ic = MX.iconOf(cells);
        body = `<div class="lg-row">${grid(cells, true)}<div class="lg-side">
            <p class="lg-block"><b>LED 출력</b> · ${escH(nameOf(cells))}${ic ? ' (아이콘과 같은 모양)' : ''}</p>
            ${showCode ? `<pre class="lg-code">${escH(ledsTs(cells))}</pre>` : ''}
            <p class="lg-tools"><button type="button" class="btn small ghost" data-fill="0">모두 끄기</button><button type="button" class="btn small ghost" data-fill="1">모두 켜기</button></p></div></div>`;
      } else {
        const total = steps.reduce((a, s) => a + stepMs(s), 0) + (loop ? 20 : 0);
        body = `<div class="lg-row tl">${grid(at >= 0 ? steps[at].cells : MX.BLANK, false)}<div class="lg-side">
            <p class="lg-block"><b>${loop ? '무한반복' : '시작하면'}</b> · 한 바퀴 ${(total / 1000).toFixed(2).replace(/\.?0+$/, '')}초</p>
            <ol class="lg-steps">${steps.map((s, i) => `<li class="${i === at ? 'run' : ''}"${i === at ? ' aria-current="step"' : ''}><span class="lg-sn">${escH(stepName(s))}</span><span class="lg-ms">${HOLD[s.kind] ? `${HOLD[s.kind]}ms 머묾` : '기다림 없음'}</span>
              <label class="lg-p">일시중지 ${editPause ? `<select data-pause="${i}" aria-label="${i + 1}번째 다음 일시중지(ms)">${[...new Set([...PAUSES, s.pause])].sort((a, b) => a - b).map((v) => `<option value="${v}"${v === s.pause ? ' selected' : ''}>${v}</option>`).join('')}</select>` : s.pause} ms</label>
              <span class="lg-sum">= ${(stepMs(s) / 1000).toFixed(2).replace(/\.?0+$/, '') || 0}초</span></li>`).join('')}</ol>
            <p class="lg-tools"><button type="button" class="btn small primary" data-play>${'재생'}</button><button type="button" class="btn small" data-step>한 단계씩</button><button type="button" class="btn small ghost" data-reset>처음으로</button></p></div></div>`;
      }
      el.innerHTML = `<div class="widget led-grid" id="${id}">${o.title ? `<p class="lg-title">${escH(o.title)}</p>` : ''}${tabs}${body}<p class="lg-say fine" data-say aria-live="polite"></p></div>`;
      bind();
    }
    function stop() { if (timer) { clearTimeout(timer); timer = null; } const b = el.querySelector('[data-play]'); if (b) b.textContent = '재생'; }
    function showStep(i) {
      at = i; const s = steps[i];
      const g = el.querySelector('.lg-grid'); if (g) g.outerHTML = grid(s.cells, false);
      el.querySelectorAll('.lg-steps li').forEach((li, k) => { li.classList.toggle('run', k === i); if (k === i) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current'); });
      say(`${i + 1}번째: ${stepName(s)} → ${HOLD[s.kind] ? `${HOLD[s.kind]}ms 머물고 ` : ''}일시중지 ${s.pause}ms(모두 ${stepMs(s)}ms)`);
    }
    function tick() {
      if (!el.isConnected) { stop(); return; }
      let n = at + 1;
      if (n >= steps.length) { if (!loop) { stop(); say('끝까지 보여 줬어요.'); return; } n = 0; }
      showStep(n);
      timer = setTimeout(tick, Math.max(50, stepMs(steps[n]) + (loop && n === steps.length - 1 ? 20 : 0)));
    }
    function bind() {
      el.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => { mode = b.dataset.mode; at = -1; draw(); const t = el.querySelector(`[data-mode="${mode}"]`); if (t) t.focus(); }));
      el.querySelectorAll('[data-icon]').forEach((b) => b.addEventListener('click', () => { pick = b.dataset.icon; draw(); const t = el.querySelector(`[data-icon="${CSS.escape(pick)}"]`); if (t) t.focus(); say(`${MX.ICON_KO[pick] || pick} 아이콘이에요.`); }));
      el.querySelectorAll('.lg-grid.edit .lg-led').forEach((b) => b.addEventListener('click', () => { const i = +b.dataset.i; cells = cells.slice(0, i) + (cells[i] === '1' ? '0' : '1') + cells.slice(i + 1); draw(); const t = el.querySelector(`.lg-led[data-i="${i}"]`); if (t) t.focus(); say(`${Math.floor(i / 5) + 1}행 ${(i % 5) + 1}열을 ${cells[i] === '1' ? '켰어요' : '껐어요'}. ${nameOf(cells)}.`); }));
      el.querySelectorAll('[data-fill]').forEach((b) => b.addEventListener('click', () => { cells = b.dataset.fill.repeat(25); draw(); say(b.dataset.fill === '1' ? '모두 켰어요.' : '모두 껐어요.'); }));
      el.querySelectorAll('[data-pause]').forEach((s) => s.addEventListener('change', () => { steps[+s.dataset.pause].pause = +s.value; const keep = at; draw(); at = keep; if (at >= 0) showStep(at); say(`${+s.dataset.pause + 1}번째 다음 일시중지를 ${s.value}ms로 바꿨어요.`); }));
      const play = el.querySelector('[data-play]');
      if (play) play.addEventListener('click', () => { if (timer) { stop(); say('멈췄어요.'); return; } play.textContent = '멈춤'; tick(); });
      const st = el.querySelector('[data-step]'); if (st) st.addEventListener('click', () => { stop(); showStep(at + 1 >= steps.length ? 0 : at + 1); });
      const rs = el.querySelector('[data-reset]'); if (rs) rs.addEventListener('click', () => { stop(); at = -1; draw(); say('처음으로 돌아갔어요.'); });
    }
    draw();
  }

  /* ---------- 비례 변환·제한 그래프(map-graph, 7~8차시 '거리에 따라 속도') ----------
   * 입력 값 → Math.map(값, 입력 낮음, 입력 높음, 출력 낮음, 출력 높음) → (제한 켜면) Math.constrain(…, 낮음, 높음) → 출력. 그래프에 선과 지금 점.
   * map만 쓰면 범위 밖에서 선이 계속 뻗고(점선), 제한을 켜면 낮음·높음에서 잘린다(굵은 선). 실습 화면이 아니라 이론 쪽 '직접 해 보기'(D18)
   * opts(모두 선택, 기본값 = 7~8차시 p4 감속)
   *   input   { label:'거리', unit:'cm', min:0, max:100, value:35, step:1, var:'센서_값'(TS 이름, 기본 label) }
   *   output  { label:'속도', unit:'' }
   *   from [10, 60]  to [30, 60]  constrain [30, 60] | null(처음엔 끔) | true(= to 범위)   constrainOn(처음 켬, 기본 constrain이 배열이면 true)
   *   editable ['from', 'to', 'constrain'](숫자 칸으로 바꿀 수 있는 것, 기본 ['from','to','constrain']) · toggle(제한 켜기 단추, 기본 true)
   *   mode 'map'(비례 변환 + 제한) | 'constrain'(제한만: 출력 = 값을 낮음~높음에 가둠) | 'maxmin'(큰값·작은값)   modes ['map','maxmin'](둘 이상이면 탭)
   *   maxmin { fn:'max'|'min', k:5 }(큰값(k, 값) · 작은값(k, 값))
   *   presets [{ label, from, to, constrain, value }]   marks [{ value, label }](입력 눈금)   code true(블록 글·TS 한 줄)   quiz [{ value, constrain?:true|false }](출력은 얼마?)   hint */
  function mapGraph(el, o = {}) {
    const id = `mg${++wN}`;
    const I = Object.assign({ label: '거리', unit: 'cm', min: 0, max: 100, value: 35, step: 1 }, o.input || {}), O = Object.assign({ label: '속도', unit: '' }, o.output || {});
    const vname = I.var || String(I.label).replace(/\s/g, '_');
    let from = (o.from || [10, 60]).slice(), to = (o.to || [30, 60]).slice();
    let cl = o.constrain === true ? [Math.min(...to), Math.max(...to)] : Array.isArray(o.constrain) ? o.constrain.slice() : [Math.min(...to), Math.max(...to)];
    let clOn = o.constrainOn != null ? !!o.constrainOn : o.constrain !== null && o.constrain !== false;
    const MODES = { map: '비례 변환', constrain: '제한', maxmin: '큰값·작은값' };
    const modes = (o.modes || [o.mode || 'map']).filter((m) => MODES[m]); let mode = modes.includes(o.mode) ? o.mode : modes[0] || 'map';
    const MM = Object.assign({ fn: 'max', k: 5 }, o.maxmin || {});
    const editable = o.editable || ['from', 'to', 'constrain'];
    let x = +I.value;
    const unit = (u) => (u ? ` ${u}` : '');
    const r2 = (v) => (Math.abs(v - Math.round(v)) < 1e-9 ? String(Math.round(v)) : String(+v.toFixed(2)));
    const mapF = (v) => (from[1] === from[0] ? to[0] : ((v - from[0]) * (to[1] - to[0])) / (from[1] - from[0]) + to[0]); // MakeCode Math.map 그대로(반올림·자르기 없음)
    const lo = () => Math.min(cl[0], cl[1]), hi = () => Math.max(cl[0], cl[1]);
    const clamp = (v) => (v < lo() ? lo() : v > hi() ? hi() : v); // Math.constrain
    const raw = (v) => (mode === 'map' ? mapF(v) : v);
    const outF = (v) => (mode === 'maxmin' ? (MM.fn === 'max' ? Math.max(MM.k, v) : Math.min(MM.k, v)) : mode === 'constrain' ? clamp(v) : clOn ? clamp(mapF(v)) : mapF(v));
    const num = (key, i, val, label) => `<label class="mg-n"><span>${escH(label)}</span>${editable.includes(key) ? `<input type="number" inputmode="decimal" data-n="${key}:${i}" value="${val}" aria-label="${escH(label)}">` : `<b>${val}</b>`}</label>`;
    el.innerHTML = `<div class="widget mapg" id="${id}">
      ${modes.length > 1 ? `<div class="mg-tabs" role="radiogroup" aria-label="계산 블록">${modes.map((m) => `<button type="button" role="radio" data-mode="${m}" aria-checked="${m === mode}">${MODES[m]}</button>`).join('')}</div>` : ''}
      ${o.presets && o.presets.length ? `<div class="sd-presets" role="group" aria-label="보기 고르기">${o.presets.map((p, i) => `<button type="button" class="btn small" data-preset="${i}">${escH(p.label)}</button>`).join('')}</div>` : ''}
      <div class="sd-row">
        <label class="sd-ctl" for="${id}-v"><span class="sd-k">${escH(I.label)}</span><span class="sd-val"><output data-vo for="${id}-v"></output>${escH(unit(I.unit))}</span></label>
        <input id="${id}-v" type="range" min="${I.min}" max="${I.max}" step="${I.step}" value="${x}" data-v>
      </div>
      <div class="mg-nums" data-nums></div>
      <figure class="mg-fig"><svg class="mg-svg" viewBox="0 0 340 230" role="img" aria-labelledby="${id}-cap" data-svg></svg><figcaption class="sr" id="${id}-cap" data-cap></figcaption></figure>
      <div class="mg-out"><p class="mg-say" data-say aria-hidden="true"></p><p class="sr" data-say-sr aria-live="polite"></p></div>
      ${o.code ? '<div class="mg-code" data-code></div>' : ''}
      ${o.quiz && o.quiz.length ? '<div class="sd-quiz" data-quiz></div>' : ''}
      <p class="legend">${escH(o.hint || (mode === 'map' ? `${I.label} 값을 움직이고 [제한 켜기]를 눌러, 범위 밖에서 선이 어떻게 달라지는지 비교해 봐요.` : `${I.label} 값을 움직여 출력이 어떻게 바뀌는지 봐요.`))}</p></div>`;
    const q = (s) => el.querySelector(s);
    const drawNums = () => {
      const box = q('[data-nums]');
      if (mode === 'map') box.innerHTML = `<div class="mg-grp"><span class="mg-gl">입력 범위</span>${num('from', 0, from[0], '입력 낮음')}${num('from', 1, from[1], '입력 높음')}</div>
        <div class="mg-grp"><span class="mg-gl">출력 범위</span>${num('to', 0, to[0], '출력 낮음')}${num('to', 1, to[1], '출력 높음')}</div>
        <div class="mg-grp"><span class="mg-gl">제한</span>${o.toggle === false ? '' : `<button type="button" class="btn small mg-tg" data-tg aria-pressed="${clOn}">${clOn ? '제한 켜짐' : '제한 켜기'}</button>`}${num('constrain', 0, cl[0], '제한 낮음')}${num('constrain', 1, cl[1], '제한 높음')}</div>`;
      else if (mode === 'constrain') box.innerHTML = `<div class="mg-grp"><span class="mg-gl">제한</span>${num('constrain', 0, cl[0], '제한 낮음')}${num('constrain', 1, cl[1], '제한 높음')}</div>`;
      else box.innerHTML = `<div class="mg-grp"><span class="mg-gl">블록</span><span class="mg-ops" role="radiogroup" aria-label="큰값 또는 작은값"><button type="button" role="radio" data-mm="max" aria-checked="${MM.fn === 'max'}">큰값</button><button type="button" role="radio" data-mm="min" aria-checked="${MM.fn === 'min'}">작은값</button></span>${num('k', 0, MM.k, '비교할 수')}</div>`;
      box.querySelectorAll('[data-n]').forEach((inp) => inp.addEventListener('input', () => {
        const [k, i] = inp.dataset.n.split(':'), v = parseFloat(inp.value); if (!isFinite(v)) return;
        if (k === 'from') from[+i] = v; else if (k === 'to') to[+i] = v; else if (k === 'constrain') cl[+i] = v; else MM.k = v;
        draw();
      }));
      const tg = box.querySelector('[data-tg]'); if (tg) tg.addEventListener('click', () => { clOn = !clOn; tg.setAttribute('aria-pressed', String(clOn)); tg.textContent = clOn ? '제한 켜짐' : '제한 켜기'; draw(); });
      box.querySelectorAll('[data-mm]').forEach((b) => b.addEventListener('click', () => { MM.fn = b.dataset.mm; drawNums(); draw(); const t = box.querySelector(`[data-mm="${MM.fn}"]`); if (t) t.focus(); }));
      const mmg = box.querySelector('.mg-ops'); if (mmg) mmg.addEventListener('keydown', (e) => { if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return; e.preventDefault(); MM.fn = MM.fn === 'max' ? 'min' : 'max'; drawNums(); draw(); const t = box.querySelector(`[data-mm="${MM.fn}"]`); if (t) t.focus(); });
    };
    const blockText = () => {
      if (mode === 'maxmin') return [`${MM.fn === 'max' ? '큰값' : '작은값'} (${MM.k}, ${I.label})`, `Math.${MM.fn}(${MM.k}, ${vname})`];
      if (mode === 'constrain') return [`${I.label} 을 ${lo()}~${hi()} 로 제한`, `Math.constrain(${vname}, ${lo()}, ${hi()})`];
      const m = `비례 변환: ${I.label} 을 ${from[0]}~${from[1]} 에서 ${to[0]}~${to[1]} 범위로 변환`, mt = `Math.map(${vname}, ${from[0]}, ${from[1]}, ${to[0]}, ${to[1]})`;
      return clOn ? [`( ${m} ) 을 ${lo()}~${hi()} 로 제한`, `Math.constrain(${mt}, ${lo()}, ${hi()})`] : [m, mt];
    };
    function draw() {
      const v = x, y = outF(v), yr = raw(v);
      q('[data-vo]').textContent = r2(v);
      // 축 범위: 입력 min~max 전체에서 map 선(자르지 않은 것)과 제한선이 들어가게
      const xs = [I.min, I.max], ys = [...xs.map((t) => raw(t)), ...xs.map((t) => outF(t)), y, ...(mode === 'map' || mode === 'constrain' ? [lo(), hi()] : [MM.k])];
      let y0 = Math.min(...ys), y1 = Math.max(...ys); if (y1 - y0 < 1e-6) { y0 -= 1; y1 += 1; } const pad = (y1 - y0) * 0.08; y0 -= pad; y1 += pad;
      const L = 46, R = 326, T = 12, B = 196, px = (t) => L + ((t - I.min) / (I.max - I.min || 1)) * (R - L), py = (t) => B - ((t - y0) / (y1 - y0)) * (B - T);
      const pts = (f) => { const n = 60, a = []; for (let k = 0; k <= n; k++) { const t = I.min + ((I.max - I.min) * k) / n; a.push(`${px(t).toFixed(1)},${py(f(t)).toFixed(1)}`); } return a.join(' '); };
      const ticks = (a, b, n = 4) => Array.from({ length: n + 1 }, (_, k) => a + ((b - a) * k) / n);
      const niceTicks = (a, b) => { const raw0 = (b - a) / 4, p10 = Math.pow(10, Math.floor(Math.log10(raw0 || 1))), st = [1, 2, 5, 10].map((m) => m * p10).find((m) => m >= raw0) || raw0, out = []; for (let t = Math.ceil(a / st) * st; t <= b + 1e-9; t += st) out.push(+t.toFixed(6)); return out; }; // 세로 눈금: 1·2·5 간격
      let s = `<rect x="${L}" y="${T}" width="${R - L}" height="${B - T}" class="mg-bg"/>`;
      ticks(I.min, I.max).forEach((t) => { s += `<line x1="${px(t)}" y1="${B}" x2="${px(t)}" y2="${B + 4}" class="mg-ax"/><text x="${px(t)}" y="${B + 16}" class="mg-t" text-anchor="middle">${r2(t)}</text>`; });
      niceTicks(y0, y1).forEach((t) => { s += `<line x1="${L - 4}" y1="${py(t)}" x2="${L}" y2="${py(t)}" class="mg-ax"/><text x="${L - 6}" y="${py(t) + 4}" class="mg-t" text-anchor="end">${r2(t)}</text>`; });
      s += `<line x1="${L}" y1="${B}" x2="${R}" y2="${B}" class="mg-ax"/><line x1="${L}" y1="${T}" x2="${L}" y2="${B}" class="mg-ax"/>`;
      s += `<text x="${R}" y="${B + 30}" class="mg-t b" text-anchor="end">${escH(I.label)}${escH(unit(I.unit))}</text><text x="${L}" y="${T - 2}" class="mg-t b" dy="-1">${escH(O.label)}</text>`;
      if (mode === 'map' || mode === 'constrain') { [lo(), hi()].forEach((t) => { s += `<line x1="${L}" y1="${py(t)}" x2="${R}" y2="${py(t)}" class="mg-lim${mode === 'constrain' || clOn ? ' on' : ''}"/>`; }); }
      if (mode === 'map') {
        s += `<rect x="${Math.min(px(from[0]), px(from[1]))}" y="${T}" width="${Math.abs(px(from[1]) - px(from[0]))}" height="${B - T}" class="mg-band"/>`;
        s += `<polyline points="${pts(mapF)}" class="mg-raw${clOn ? ' ghost' : ''}"/>`;
        if (clOn) s += `<polyline points="${pts((t) => clamp(mapF(t)))}" class="mg-line"/>`;
        [[from[0], to[0]], [from[1], to[1]]].forEach(([a, b]) => { s += `<circle cx="${px(a)}" cy="${py(b)}" r="4" class="mg-key"/>`; });
      } else s += `<polyline points="${pts(outF)}" class="mg-line"/>`;
      const cut = mode === 'map' && clOn && Math.abs(yr - y) > 1e-9;
      if (cut) s += `<line x1="${px(v)}" y1="${py(yr)}" x2="${px(v)}" y2="${py(y)}" class="mg-drop"/><circle cx="${px(v)}" cy="${py(yr)}" r="5" class="mg-pt ghost"/>`;
      s += `<line x1="${px(v)}" y1="${B}" x2="${px(v)}" y2="${py(y)}" class="mg-guide"/><circle cx="${px(v)}" cy="${py(y)}" r="7" class="mg-pt"/>`;
      q('[data-svg]').innerHTML = s;
      const outside = mode === 'map' && (v < Math.min(...from) || v > Math.max(...from));
      let say;
      if (mode === 'map') say = `${I.label} ${r2(v)}${unit(I.unit)} → 비례 변환 ${r2(yr)}${outside ? '(입력 범위 밖이라 출력 범위도 넘을 수 있어요)' : ''}${clOn ? ` → 제한 ${lo()}~${hi()} → ${O.label} ${r2(y)}${cut ? '(잘렸어요)' : ''}` : ` → ${O.label} ${r2(y)}`}`;
      else if (mode === 'constrain') say = `${I.label} ${r2(v)}${unit(I.unit)} → 제한 ${lo()}~${hi()} → ${O.label} ${r2(y)}${y !== v ? '(잘렸어요)' : ''}`;
      else say = `${MM.fn === 'max' ? '큰값' : '작은값'}(${MM.k}, ${r2(v)}) → ${r2(y)}${MM.fn === 'max' ? ` · ${MM.k}보다 작아지지 않아요` : ` · ${MM.k}보다 커지지 않아요`}`;
      q('[data-say]').textContent = say; q('[data-say-sr]').textContent = say;
      q('[data-cap]').textContent = `그래프: 가로 ${I.label}, 세로 ${O.label}. 지금 점 (${r2(v)}, ${r2(y)}).`;
      const code = q('[data-code]'); if (code) { const [bt, ts] = blockText(); code.innerHTML = `<p class="mg-blk"><span>${escH(bt)}</span></p><pre class="mg-ts">${escH(ts)}</pre>`; }
    }
    q('[data-v]').addEventListener('input', (e) => { x = +e.target.value; draw(); });
    el.querySelectorAll('[data-preset]').forEach((b) => b.addEventListener('click', () => {
      const p = o.presets[+b.dataset.preset];
      if (p.from) from = p.from.slice(); if (p.to) to = p.to.slice();
      if (p.constrain === null || p.constrain === false) clOn = false; else if (p.constrain) { cl = p.constrain === true ? [Math.min(...to), Math.max(...to)] : p.constrain.slice(); clOn = true; }
      if (p.value != null) { x = +p.value; q('[data-v]').value = x; }
      drawNums(); draw();
    }));
    el.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => { mode = b.dataset.mode; el.querySelectorAll('[data-mode]').forEach((t) => t.setAttribute('aria-checked', String(t.dataset.mode === mode))); drawNums(); draw(); b.focus(); }));
    const tabs = q('.mg-tabs'); if (tabs) tabs.addEventListener('keydown', (e) => { if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return; e.preventDefault(); mode = modes[(modes.indexOf(mode) + (e.key === 'ArrowRight' ? 1 : modes.length - 1)) % modes.length]; const nb = q(`[data-mode="${mode}"]`); if (nb) nb.click(); });
    const qz = q('[data-quiz]');
    if (qz) {
      let k = 0;
      const ask = () => {
        const it = o.quiz[k], keep = clOn; if (it.constrain != null && mode === 'map') clOn = !!it.constrain;
        const right = outF(it.value); clOn = keep;
        const R = +r2(right), wrong = [...new Set([mapF(it.value), lo(), hi(), it.value, right + 10, right - 10].map((z) => +r2(z)))].filter((z) => z !== R); // 헷갈리기 쉬운 값: 자르지 않은 값·제한 끝·입력 그대로
        const choices = [R, ...wrong.slice(0, 2)].sort((a, b) => a - b);
        qz.innerHTML = `<p class="sd-qq"><b>출력은 얼마일까?</b> (${k + 1}/${o.quiz.length}) ${escH(I.label)} ${it.value}${escH(unit(I.unit))}${it.constrain != null && mode === 'map' ? (it.constrain ? ' · 제한 켬' : ' · 제한 끔') : ''}</p>
          <p class="sd-qa">${choices.map((c) => `<button type="button" class="btn small" data-ans="${c}">${c}</button>`).join('')}</p><p class="sd-qr" aria-live="polite"></p>`;
        qz.querySelectorAll('[data-ans]').forEach((b) => b.addEventListener('click', () => {
          if (it.constrain != null && mode === 'map') clOn = !!it.constrain;
          x = it.value; q('[data-v]').value = x; drawNums(); draw();
          const ok = +b.dataset.ans === +r2(right);
          qz.querySelector('.sd-qr').innerHTML = `${ok ? '<b class="ok">맞아요!</b>' : '<b class="no">다시 봐요.</b>'} ${escH(I.label)} ${it.value} → ${O.label} ${r2(right)}이에요.${k < o.quiz.length - 1 ? ' <button type="button" class="btn small" data-next>다음 문제</button>' : ''}`;
          const nx = qz.querySelector('[data-next]'); if (nx) { nx.addEventListener('click', () => { k++; ask(); const f = qz.querySelector('[data-ans]'); if (f) f.focus(); }); nx.focus(); }
        }));
      };
      ask();
    }
    drawNums(); draw();
  }

  /* ---------- 부품 눌러 보기 hotspots(1차시 마이크로비트 앞·뒤, 포니봇 부품 지도) ----------
   * opts: title?, intro?, img, alt, credit?, sides?: [{ id, label, img, alt, credit? }], spots: [{ id, label, x, y, w?, h?, desc, side? }], start?(처음 고른 부품 id), numbers?(기본 true)
   *   x·y = 부품 가운데, w·h = 부품 크기(있으면 둥근 네모 테두리, 없으면 동그라미) — 모두 그림 폭·높이에 대한 %(0~100).
   *   sides가 있으면 [앞면|뒷면] 단추로 바꾸고 spot.side = 그 면 id(없으면 첫 면). sides가 없으면 img 하나.
   *   번호는 spots 차례 그대로(면을 바꿔도 같은 부품은 같은 번호). 그림 위 번호(마우스·터치)와 아래 부품 이름 단추(키보드: Tab·Enter/Space, ←/→로 이웃 부품)를 누르면
   *   그림 위 그 자리에 테두리 + 아래에 이름·하는 일. 살펴본 부품은 ✓, 'n / N 살펴봄'. 네이티브 창 없음 */
  function hotspots(el, o = {}) {
    const id = `hs${++wN}`;
    const multi = Array.isArray(o.sides) && o.sides.length > 0;
    const sides = (multi ? o.sides : [{ id: '_', label: '', img: o.img, alt: o.alt, credit: o.credit }]).filter((s) => s && s.img).map((s) => Object.assign({}, s, { id: String(s.id) }));
    const sideOf = (sp) => (multi ? (sp.side != null ? String(sp.side) : sides[0].id) : '_');
    const spots = (o.spots || []).filter((s) => s && s.id != null && isFinite(+s.x) && isFinite(+s.y) && sides.some((d) => d.id === sideOf(s)));
    const P = (v) => Math.max(0, Math.min(100, +v));
    const no = (sp) => spots.indexOf(sp) + 1;
    const st = spots.find((s) => String(s.id) === String(o.start));
    let cur = st ? sideOf(st) : (sides[0] || {}).id, sel = st ? String(st.id) : null;
    const seen = new Set(sel ? [sel] : []);
    const intro = o.intro || '번호나 아래 부품 이름을 눌러 무엇을 하는지 알아봐요.';
    el.innerHTML = `<div class="widget hotspots" id="${id}">
      ${o.title ? `<p class="hs-title">${escH(o.title)}</p>` : ''}
      ${sides.length > 1 ? `<div class="hs-sides" role="group" aria-label="보는 면">${sides.map((d) => `<button type="button" data-side="${escH(d.id)}" aria-pressed="false">${escH(d.label || d.id)}</button>`).join('')}</div>` : ''}
      <div class="hs-stage"><div class="hs-pic" data-pic><img data-img alt="" draggable="false"><span class="hs-mark" data-mark aria-hidden="true" hidden></span><span data-dots></span></div></div>
      <p class="hs-credit" data-credit hidden></p>
      <ol class="hs-list" data-list aria-label="부품 목록"></ol>
      <div class="hs-info" data-info aria-live="polite"></div>
      <p class="hs-progress" data-prog></p>
    </div>`;
    const q = (s) => el.querySelector(s);
    const onSide = () => spots.filter((s) => sideOf(s) === cur);
    const draw = (focusId) => {
      const sd = sides.find((d) => d.id === cur) || sides[0]; if (!sd) return;
      const img = q('[data-img]');
      if (img.getAttribute('src') !== sd.img) img.setAttribute('src', sd.img);
      img.alt = sd.alt || o.alt || '';
      const cr = sd.credit || o.credit, crEl = q('[data-credit]'); crEl.hidden = !cr; crEl.textContent = cr ? `사진 출처: ${cr}` : '';
      el.querySelectorAll('[data-side]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.side === cur)));
      const list = onSide();
      // 고른 부품의 번호는 테두리 왼쪽 위 모서리로 비켜 앉는다(번호가 부품을 가리지 않게)
      const at = (s) => (String(s.id) === sel && s.w != null && s.h != null ? `left:${P(s.x - s.w / 2)}%;top:${P(s.y - s.h / 2)}%` : `left:${P(s.x)}%;top:${P(s.y)}%`);
      q('[data-dots]').innerHTML = o.numbers === false ? '' : list.map((s) => `<button type="button" class="hs-dot${String(s.id) === sel ? ` on${s.w != null && s.h != null ? ' corner' : ''}` : ''}${seen.has(String(s.id)) ? ' seen' : ''}" data-dot="${escH(s.id)}" tabindex="-1" aria-hidden="true" style="${at(s)}">${no(s)}</button>`).join('');
      q('[data-list]').innerHTML = list.map((s) => `<li><button type="button" class="hs-item" data-pick="${escH(s.id)}" aria-pressed="${String(s.id) === sel}"><span class="hs-n" aria-hidden="true">${no(s)}</span><span class="hs-l">${escH(s.label)}</span>${seen.has(String(s.id)) ? '<span class="hs-ok" aria-label="살펴봄">✓</span>' : ''}</button></li>`).join('');
      const sp = spots.find((s) => String(s.id) === sel && sideOf(s) === cur), mk = q('[data-mark]');
      mk.hidden = !sp;
      if (sp) {
        const box = sp.w != null && sp.h != null;
        mk.className = `hs-mark${box ? ' box' : ''}`;
        mk.style.cssText = box ? `left:${P(sp.x - sp.w / 2)}%;top:${P(sp.y - sp.h / 2)}%;width:${Math.min(+sp.w, 100)}%;height:${Math.min(+sp.h, 100)}%` : `left:${P(sp.x)}%;top:${P(sp.y)}%`;
      }
      q('[data-info]').innerHTML = sp ? `<p class="hs-name"><span class="hs-n" aria-hidden="true">${no(sp)}</span><b>${escH(sp.label)}</b></p><p class="hs-desc">${escH(sp.desc || '')}</p>` : `<p class="hs-hint">${escH(intro)}</p>`;
      q('[data-prog]').textContent = spots.length ? `살펴본 부품 ${seen.size} / ${spots.length}` : '';
      el.querySelectorAll('[data-dot]').forEach((b) => b.addEventListener('click', () => pick(b.dataset.dot)));
      el.querySelectorAll('[data-pick]').forEach((b) => {
        b.addEventListener('click', () => pick(b.dataset.pick, true));
        b.addEventListener('keydown', (e) => {
          const k = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key]; if (!k) return;
          e.preventDefault();
          const ids = onSide().map((s) => String(s.id)), i = ids.indexOf(b.dataset.pick);
          pick(ids[(i + k + ids.length) % ids.length], true);
        });
      });
      if (focusId != null) { const f = el.querySelector(`[data-pick="${CSS.escape(String(focusId))}"]`); if (f) f.focus(); }
    };
    function pick(sid, keepFocus) { sel = String(sid); seen.add(sel); draw(keepFocus ? sel : null); }
    el.querySelectorAll('[data-side]').forEach((b) => b.addEventListener('click', () => {
      if (b.dataset.side === cur) return;
      cur = b.dataset.side; sel = null; draw();
    }));
    draw();
  }

  /* ---------- 9~10차시 라인 센서 line-follow (mode 'sensor' | 'drive') ----------
   * 확장 ai_ponybot_basic v1.3.1: 라인 센서 값 1 = 선을 봤어요(●), 0 = 못 봤어요(◌). TwoLineState ◌◌ · ◌● · ●◌ · ●●(왼쪽, 오른쪽 차례).
   *   Clockwise(블록 ↶) = 왼쪽으로 돎, CounterClockwise(↷) = 오른쪽으로 돎. 속도 값이 대략 30보다 작으면 '삐~' 소리만 나고 안 움직임(로봇마다 조금 다름, hardware.md).
   * mode 'sensor'(기본): 위에서 본 주행 매트 한 칸(흰 바탕·굵은 검은 선, ▲ 앞)과 포니봇·바닥 앞쪽 라인 센서 2개. 끌기·←→ 키·단추로 좌우 이동 →
   *   두 점 ●/◌, 'L 0 · R 1', 블록 글('두 라인 센서의 값이 ◌ ●'), 할 일('오른쪽으로 돌기 ↷'). [가로선 위에 놓기]로 ●●.
   *   opts: title, intro, cross(기본 true — 가로선 단추), start(처음 위치 -90~90, 기본 0 = 선 가운데), lineWidth(기본 36), spacing(센서 사이, 기본 60),
   *         text: { OffOff|OffOn|OnOff|OnOn: { block, todo, why } }(글 바꾸기), showBlock(기본 true)
   * mode 'drive': 곡선이 있는 코스(직선 + 곡선 + 끝 가로선)를 4갈래 규칙(◌◌ 앞 · ◌● ↷ · ●◌ ↶ · ●● 멈춤)으로 달리는 간단한 모형.
   *   직진 속도·회전 속도 슬라이더(0~255, 기본 35·85) → [달려 보기] → 완주(시간)·흔들거림(아슬아슬 완주)·커브 이탈·안 움직임. [처음으로].
   *   모형(lineSim): 힘 = (속도 − 20) ÷ 235(30 미만은 0), 직진 속도와 회전 빠르기는 힘에 비례, 돌기 시작해도 앞으로 가던 힘이 천천히 줄어(관성) →
   *   직진이 빠를수록·회전이 약할수록 커브에서 밀려 나감. 수는 화면 속 모형 값(실물과 다름). opts: speed, turn, note(아래 문장), rate(재생 배속, 기본 4), title, intro
   *   움직임 줄이기면 끝 모습·지나간 길만 바로 그린다. */
  const LF_TXT = {
    OffOff: { block: '두 라인 센서의 값이 ◌ ◌', todo: '앞으로 가기 ↑', why: '선이 두 센서 사이에 있어요.' },
    OffOn: { block: '두 라인 센서의 값이 ◌ ●', todo: '오른쪽으로 돌기 ↷', why: '오른쪽 센서가 선을 밟았어요. 선이 오른쪽으로 휘었어요.' },
    OnOff: { block: '두 라인 센서의 값이 ● ◌', todo: '왼쪽으로 돌기 ↶', why: '왼쪽 센서가 선을 밟았어요. 선이 왼쪽으로 휘었어요.' },
    OnOn: { block: '두 라인 센서의 값이 ● ●', todo: '멈추기', why: '두 센서가 모두 가로선을 밟았어요.' },
  };
  const lfKey = (L, R) => (L ? (R ? 'OnOn' : 'OnOff') : R ? 'OffOn' : 'OffOff');
  const dotS = (v) => (v ? '●' : '◌');
  function lineFollow(el, o = {}) {
    if (o.mode === 'drive') return lineDrive(el, o);
    const id = `lf${++wN}`, TX = {};
    Object.keys(LF_TXT).forEach((k) => { TX[k] = Object.assign({}, LF_TXT[k], (o.text || {})[k] || {}); });
    const LW = pick(o.lineWidth, 36), SP = pick(o.spacing, 60), MAX = 90;
    let off = Math.max(-MAX, Math.min(MAX, pick(o.start, 0) | 0)), cross = false, drag = null;
    el.innerHTML = `<div class="widget lfw" id="${id}">
      ${o.title ? `<p class="lf-title">${escH(o.title)}</p>` : ''}<p class="lf-intro">${escH(o.intro || '포니봇을 왼쪽·오른쪽으로 옮겨 봐요. 끌거나, 그림을 누른 뒤 ← → 키를 써요.')}</p>
      <div class="lf-stage"><span class="rm-front" aria-hidden="true"><b>▲</b> 앞</span>
        <svg class="lf-svg" viewBox="0 0 320 200" role="slider" tabindex="0" aria-label="포니봇 위치(위에서 본 주행 매트)" aria-valuemin="${-MAX}" aria-valuemax="${MAX}" data-svg>
          <rect x="1" y="1" width="318" height="198" rx="12" class="lf-mat"/>
          <rect x="${160 - LW / 2}" y="1" width="${LW}" height="198" class="lf-line"/>
          <rect x="1" y="62" width="318" height="${LW}" class="lf-line" data-cross hidden/>
          <g data-bot></g>
        </svg></div>
      <p class="lf-btns"><button type="button" class="btn small" data-mv="-1">← 왼쪽으로</button><button type="button" class="btn small" data-mv="0">가운데</button><button type="button" class="btn small" data-mv="1">오른쪽으로 →</button>${o.cross === false ? '' : '<button type="button" class="btn small" data-cr aria-pressed="false">가로선 위에 놓기</button>'}</p>
      <div class="lf-read" aria-live="polite" data-read></div></div>`;
    const q = (s) => el.querySelector(s), svg = q('[data-svg]');
    const sensors = () => {
      const cx = 160 + off, xs = [cx - SP / 2, cx + SP / 2];
      return xs.map((x) => (cross || Math.abs(x - 160) <= LW / 2 ? 1 : 0));
    };
    const draw = (announce) => {
      const [L, R] = sensors(), k = lfKey(L, R), t = TX[k], cx = 160 + off;
      q('[data-cross]').hidden = !cross;
      const sd = (x, v) => `<circle cx="${x}" cy="80" r="9" class="lf-sen${v ? ' on' : ''}"/>`;
      q('[data-bot]').innerHTML = `<rect x="${cx - 55}" y="72" width="110" height="96" rx="16" class="lf-body"/><rect x="${cx - 58}" y="88" width="10" height="34" rx="4" class="lf-wheel"/><rect x="${cx + 48}" y="88" width="10" height="34" rx="4" class="lf-wheel"/><rect x="${cx - 58}" y="128" width="10" height="34" rx="4" class="lf-wheel"/><rect x="${cx + 48}" y="128" width="10" height="34" rx="4" class="lf-wheel"/><path d="M${cx - 10} 108 L${cx} 94 L${cx + 10} 108 Z" class="lf-arrow"/>${sd(cx - SP / 2, L)}${sd(cx + SP / 2, R)}<text x="${cx - SP / 2}" y="64" class="lf-lab">L</text><text x="${cx + SP / 2}" y="64" class="lf-lab">R</text>`;
      svg.setAttribute('aria-valuenow', String(off));
      svg.setAttribute('aria-valuetext', `왼쪽 센서 ${L}, 오른쪽 센서 ${R}. ${t.todo}`);
      q('[data-read]').innerHTML = `<p class="lf-dots"><span class="lf-d"><b>${dotS(L)}</b>왼쪽</span><span class="lf-d"><b>${dotS(R)}</b>오른쪽</span><span class="lf-v">L ${L} · R ${R}</span></p>
        ${o.showBlock === false ? '' : `<p class="lf-blk"><span class="rm-block">${escH(t.block)}</span></p>`}<p class="lf-todo">할 일: <b>${escH(t.todo)}</b></p><p class="lf-why">${escH(t.why)}</p>`;
      if (announce === false) q('[data-read]').setAttribute('aria-live', 'off'); else q('[data-read]').setAttribute('aria-live', 'polite');
    };
    const move = (d) => { off = Math.max(-MAX, Math.min(MAX, off + d)); draw(); };
    el.querySelectorAll('[data-mv]').forEach((b) => b.addEventListener('click', () => { const d = +b.dataset.mv; if (d === 0) off = 0; else move(d * 12); draw(); }));
    const cr = q('[data-cr]'); if (cr) cr.addEventListener('click', () => { cross = !cross; cr.setAttribute('aria-pressed', String(cross)); cr.textContent = cross ? '가로선에서 내리기' : '가로선 위에 놓기'; draw(); });
    svg.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); move((e.key === 'ArrowLeft' ? -1 : 1) * (e.shiftKey ? 24 : 6)); }
      else if (e.key === 'Home') { e.preventDefault(); off = 0; draw(); }
    });
    // 끌기(마우스·펜·터치): 그림 폭 기준으로 위치를 옮김. 터치는 가로로 끌 때만(세로 스크롤은 그대로 — touch-action: pan-y)
    const xOf = (e) => { const r = svg.getBoundingClientRect(); return ((e.clientX - r.left) / r.width) * 320; };
    svg.addEventListener('pointerdown', (e) => { drag = { x: xOf(e), off }; try { svg.setPointerCapture(e.pointerId); } catch (_) {} });
    svg.addEventListener('pointermove', (e) => { if (!drag) return; off = Math.max(-MAX, Math.min(MAX, Math.round(drag.off + xOf(e) - drag.x))); draw(false); });
    const end = () => { if (drag) { drag = null; draw(); } };
    svg.addEventListener('pointerup', end); svg.addEventListener('pointercancel', end);
    draw(false);
  }

  /* 코스: 직선 → 왼쪽 커브 80° → 직선 → 오른쪽 커브 160° → 직선 → 왼쪽 커브 80° → 직선 → 가로선(끝). 점 = [x, y, 커브면 1] */
  function lfCourse(R0 = 55) {
    const segs = [['S', 80], ['L', R0, 90], ['S', 90], ['R', R0 * 0.85, 180], ['S', 90], ['L', R0, 90], ['S', 80]]; // 가로·세로 비율이 휴대폰에서도 읽히게(∩ 모양)
    let x = 0, y = 0, th = 0; const pts = [[x, y, 0]];
    for (const s of segs) {
      if (s[0] === 'S') { const n = Math.ceil(s[1] / 2); for (let i = 1; i <= n; i++) pts.push([x + Math.cos(th) * s[1] * i / n, y + Math.sin(th) * s[1] * i / n, 0]); x += Math.cos(th) * s[1]; y += Math.sin(th) * s[1]; }
      else {
        const R = s[1], ang = s[2] * Math.PI / 180, dir = s[0] === 'L' ? -1 : 1, n = Math.ceil(R * ang / 2), cx = x - Math.sin(th) * R * dir, cy = y + Math.cos(th) * R * dir, a0 = Math.atan2(y - cy, x - cx);
        for (let i = 1; i <= n; i++) { const a = a0 + dir * ang * i / n; pts.push([cx + Math.cos(a) * R, cy + Math.sin(a) * R, 1]); }
        x = pts[pts.length - 1][0]; y = pts[pts.length - 1][1]; th += dir * ang;
      }
    }
    return { pts, end: [x, y], endTh: th };
  }
  /** 선 따라가기 모형(화면 없이도 돎 — 시험용으로 Widgets.lineSim). 결과 { kind: finish|wobble|off|nomove|noturn|timeout, t(ms), curve, maxDev, trail[[x,y,θ,L,R,t]] } */
  function lineSim(speed, turn, o = {}) {
    const C = o.course || lfCourse(), P = C.pts, half = 6, SP = 22, AHEAD = 16, dead = 30, tauV = 1300, tauW = 60, dt = 40, T = o.maxMs || 60000;
    const pw = (s) => (s < dead ? 0 : (Math.min(255, s) - 20) / 235), vT = 600 * pw(speed), wT = 200 * pw(turn) * Math.PI / 180;
    let x = 0, y = 0, th = 0, v = 0, w = 0, idx = 0, t = 0, best = 0, bestT = 0, maxDev = 0, res = null;
    const near = (px, py) => { let bd = 1e9, bi = idx; for (let i = Math.max(0, idx - 30); i < Math.min(P.length, idx + 60); i++) { const d = Math.hypot(P[i][0] - px, P[i][1] - py); if (d < bd) { bd = d; bi = i; } } return [bd, bi]; };
    const onCross = (px, py) => { const ex = px - C.end[0], ey = py - C.end[1], a = ex * Math.cos(C.endTh) + ey * Math.sin(C.endTh), l = -ex * Math.sin(C.endTh) + ey * Math.cos(C.endTh); return Math.abs(a - 4) <= half && Math.abs(l) <= 28; };
    const sense = (side) => { const sx = x + Math.cos(th) * AHEAD - Math.sin(th) * side * SP / 2, sy = y + Math.sin(th) * AHEAD + Math.cos(th) * side * SP / 2; return near(sx, sy)[0] <= half || onCross(sx, sy) ? 1 : 0; };
    const trail = [[x, y, th, 0, 0, 0]];
    if (vT === 0) return { kind: 'nomove', t: 0, maxDev: 0, trail, course: C };
    while (t < T) {
      const L = sense(-1), R = sense(1); let tv = 0, tw = 0;
      if (!L && !R) tv = vT; else if (!L && R) tw = wT; else if (L && !R) tw = -wT;
      for (let k = 0; k < 4; k++) { const h = dt / 4; v += (tv - v) * (1 - Math.exp(-h / tauV)); w += (tw - w) * (1 - Math.exp(-h / tauW)); th += w * h / 1000; x += Math.cos(th) * v * h / 1000; y += Math.sin(th) * v * h / 1000; }
      t += dt;
      const [dc, ic] = near(x, y); idx = ic; if (dc > maxDev) maxDev = dc;
      if (ic > best + 2) { best = ic; bestT = t; }
      trail.push([x, y, th, L, R, t]);
      if (L && R && Math.hypot(x - C.end[0], y - C.end[1]) < 30) { res = { kind: maxDev >= 8 ? 'wobble' : 'finish', t }; break; }
      if (dc > half + 26 && !L && !R) { res = { kind: wT === 0 ? 'noturn' : 'off', t, curve: !!P[ic][2] }; break; } // 회전 속도 30 미만: 돌지 못하고 밀려 나감
      if (t - bestT > 4000) { res = { kind: wT === 0 ? 'noturn' : 'timeout', t, curve: !!P[ic][2] }; break; }
    }
    if (!res) res = { kind: 'timeout', t };
    return Object.assign(res, { maxDev, trail, course: C, progress: best / (P.length - 1) });
  }
  function lineDrive(el, o = {}) {
    const id = `lf${++wN}`, C = lfCourse(), P = C.pts;
    let speed = Math.max(0, Math.min(255, pick(o.speed, 35) | 0)), turn = Math.max(0, Math.min(255, pick(o.turn, 85) | 0)), raf = null, last = null;
    const xs = P.map((p) => p[0]), ys = P.map((p) => p[1]), M = 34, minX = Math.min(...xs) - M, minY = Math.min(...ys) - M, VW = Math.max(...xs) - minX + M, VH = Math.max(...ys) - minY + M;
    const d = 'M' + P.map((p) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' L');
    const ex = C.end[0], ey = C.end[1], nx = -Math.sin(C.endTh), ny = Math.cos(C.endTh);
    const rate = Math.max(1, pick(o.rate, 4));
    el.innerHTML = `<div class="widget lfw lfd" id="${id}">
      ${o.title ? `<p class="lf-title">${escH(o.title)}</p>` : ''}<p class="lf-intro">${escH(o.intro || '직진 속도와 회전 속도를 정하고 [달려 보기]를 눌러요. 포니봇은 4가지 경우(◌◌ 앞 · ◌● ↷ · ●◌ ↶ · ●● 멈춤)대로 움직여요.')}</p>
      <div class="lf-stage"><svg class="lf-svg lf-course" viewBox="${minX.toFixed(0)} ${minY.toFixed(0)} ${VW.toFixed(0)} ${VH.toFixed(0)}" role="img" aria-label="곡선이 있는 주행 코스(왼쪽 출발, 오른쪽 끝 가로선)">
        <rect x="${minX + 2}" y="${minY + 2}" width="${VW - 4}" height="${VH - 4}" rx="14" class="lf-mat"/>
        <path d="${d}" class="lf-path"/>
        <line x1="${(ex + nx * 28).toFixed(1)}" y1="${(ey + ny * 28).toFixed(1)}" x2="${(ex - nx * 28).toFixed(1)}" y2="${(ey - ny * 28).toFixed(1)}" class="lf-path"/>
        <text x="0" y="${-18}" class="lf-tag">출발</text><text x="${ex.toFixed(0)}" y="${(ey - 34).toFixed(0)}" class="lf-tag">끝</text>
        <polyline class="lf-trail" data-trail points=""/><g data-car></g></svg></div>
      <div class="lf-sl">
        <label for="${id}-s">직진 속도 <input id="${id}-s" type="range" min="0" max="255" value="${speed}" data-sp><output for="${id}-s" data-spo>${speed}</output></label>
        <label for="${id}-t">회전 속도 <input id="${id}-t" type="range" min="0" max="255" value="${turn}" data-tu><output for="${id}-t" data-tuo>${turn}</output></label>
      </div>
      <p class="lf-btns"><button type="button" class="btn small primary" data-go>달려 보기</button><button type="button" class="btn small" data-reset>처음으로</button><span class="lf-live" data-sense aria-hidden="true"></span></p>
      <div class="lf-res" data-res aria-live="polite"></div>
      <p class="fine lf-note">${escH(o.note || '화면 속 모형이에요. 실제 포니봇은 바닥·배터리에 따라 달라요. 진짜 값은 실습에서 재요.')}</p></div>`;
    const q = (s) => el.querySelector(s);
    const car = (x, y, th, L, R) => {
      const deg = th * 180 / Math.PI, s = (side, v) => `<circle cx="16" cy="${side * 11}" r="3.6" class="lf-sen${v ? ' on' : ''}"/>`;
      q('[data-car]').innerHTML = `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${deg.toFixed(1)})"><rect x="-15" y="-14" width="30" height="28" rx="6" class="lf-body"/><path d="M4 -6 L12 0 L4 6 Z" class="lf-arrow"/>${s(-1, L)}${s(1, R)}</g>`;
      q('[data-sense]').textContent = `L ${L} · R ${R}  ${dotS(L)} ${dotS(R)}`; // 페르소나 2회차 #22: 라인 센서는 0·1 두 값만
    };
    const stop = () => { if (raf) { cancelAnimationFrame(raf); raf = null; } q('[data-go]').disabled = false; };
    const reset = (say) => { stop(); q('[data-trail]').setAttribute('points', ''); car(0, 0, 0, 0, 0); if (say) q('[data-res]').innerHTML = `<p>${escH(say)}</p>`; };
    const sec = (ms) => (ms / 1000).toFixed(1);
    const result = (r) => {
      const why = speed >= 50 ? '직진이 빨라서 커브에서 밀려 나갔어요. 직진 속도를 낮추거나 회전 속도를 올려 봐요.' : '회전이 약해서 커브를 다 돌지 못했어요. 회전 속도를 올려 봐요.';
      const T = {
        finish: ['ok', `완주했어요! 걸린 시간 ${sec(r.t)}초(모형 시간)`, '더 빠르게 하려면 직진 속도를 조금씩 올리고, 이탈하면 회전 속도도 함께 올려요.'],
        wobble: ['warn', `완주했지만 흔들거리며 아슬아슬했어요. 걸린 시간 ${sec(r.t)}초(모형 시간)`, '선에서 많이 벗어났다가 돌아왔어요. 직진 속도를 조금 낮추거나 회전 속도를 조금 올려 봐요.'],
        off: ['no', `${r.curve ? '커브' : '직선'}에서 선 밖으로 나갔어요(${sec(r.t)}초).`, why],
        nomove: ['no', '삐~ 바퀴가 안 움직여요.', '직진 속도가 대략 30보다 작으면 \'삐~\' 소리만 나고 안 움직여요(로봇마다 조금 달라요). 30보다 넉넉히 크게 해요.'],
        noturn: ['no', '커브에서 돌지 못하고 선 밖으로 나갔어요.', '회전 속도가 대략 30보다 작으면 \'삐~\' 소리만 나고 돌지 못해요(로봇마다 조금 달라요). 회전 속도를 30보다 넉넉히 크게 올려 봐요.'],
        timeout: ['warn', '끝까지 가지 못했어요.', '직진 속도와 회전 속도를 바꿔 다시 해 봐요.'],
      }[r.kind];
      q('[data-res]').innerHTML = `<p class="lf-r ${T[0]}"><b>${escH(T[1])}</b></p><p>${escH(T[2])}</p><p class="fine">직진 속도 ${speed} · 회전 속도 ${turn}</p>`;
    };
    const paint = (r, upto) => {
      const tr = r.trail, k = Math.min(tr.length - 1, upto);
      q('[data-trail]').setAttribute('points', tr.slice(0, k + 1).filter((_, i) => i % 2 === 0 || i === k).map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' '));
      const p = tr[k]; car(p[0], p[1], p[2], p[3], p[4]);
    };
    const run = () => {
      stop(); last = lineSim(speed, turn);
      if (last.kind === 'nomove' || reduceMotion()) { paint(last, last.trail.length - 1); result(last); return; }
      q('[data-go]').disabled = true; q('[data-res]').innerHTML = `<p>달리는 중… (${rate}배 빠르게)</p>`;
      const t0 = performance.now(), tr = last.trail;
      const step = (now) => {
        if (!el.isConnected) { stop(); return; }
        const ms = (now - t0) * rate; let k = 0; while (k < tr.length - 1 && tr[k + 1][5] <= ms) k++;
        paint(last, k);
        if (k >= tr.length - 1) { stop(); result(last); q('[data-go]').focus(); return; }
        raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    };
    q('[data-sp]').addEventListener('input', (e) => { speed = +e.target.value; q('[data-spo]').textContent = speed; });
    q('[data-tu]').addEventListener('input', (e) => { turn = +e.target.value; q('[data-tuo]').textContent = turn; });
    q('[data-go]').addEventListener('click', run);
    q('[data-reset]').addEventListener('click', () => reset('처음 자리로 돌아왔어요.'));
    reset('');
  }

  /* ---------- 9~10차시 rgb-mix mode 'sensor': 컬러 센서가 읽은 R·G·B ----------
   * R·G·B 슬라이더(0~255, "센서가 읽은 값") → 섞인 색 칸. opts.presets [{ label:'빨강 칩', r:200, g:30, b:40 }](예시값), opts.judge(true면
   * 확장 v1.3.1 isColorAdvanced 식으로 '감지된 색상이 빨간색/초록색/파란색/노란색' 4가지 참·거짓 — 임계값 칸은 쓰지 않음, R+G+B < 60이면 모두 거짓),
   * opts.r·g·b(처음 값, 기본 200·30·40), opts.note(아래 문장), opts.title */
  const DC_KO = [['Red', '빨간색'], ['Green', '초록색'], ['Blue', '파란색'], ['Yellow', '노란색']];
  function isColorV131(c, r, g, b) { // engine/linecolor.js isColor와 같은 식
    if (r + g + b < 60) return false;
    if (c === 'Red') return r > g && r > b && r > g * 1.5;
    if (c === 'Yellow') return r > b && g > b && r > g && r <= g * 1.5;
    if (c === 'Green') return g > r && g >= b && g > r * 1.4;
    if (c === 'Blue') return b > r && b > g;
    return false;
  }
  function rgbSensor(el, o = {}) {
    const id = `rs${++wN}`, v = [pick(o.r, 200), pick(o.g, 30), pick(o.b, 40)].map((x) => Math.max(0, Math.min(255, x | 0)));
    const pre = Array.isArray(o.presets) ? o.presets : [];
    el.innerHTML = `<div class="widget rgbmix rgbsense" id="${id}">
      ${o.title ? `<p class="lf-title">${escH(o.title)}</p>` : ''}
      ${pre.length ? `<div class="sd-presets" role="group" aria-label="예시값">${pre.map((p, i) => `<button type="button" class="btn small" data-pre="${i}"><i class="rs-chip" style="--c:rgb(${p.r | 0},${p.g | 0},${p.b | 0})" aria-hidden="true"></i>${escH(p.label)}</button>`).join('')}<small>예시값</small></div>` : ''}
      <div class="rs-row"><div class="rs-box" data-box role="img" aria-label=""></div>
        <div class="rm-mix rs-sl">${['빨간색(R)', '초록색(G)', '파란색(B)'].map((n, k) => `<label for="${id}-${k}">${n} <input id="${id}-${k}" type="range" min="0" max="255" value="${v[k]}" data-rgb="${k}"><output for="${id}-${k}">${v[k]}</output></label>`).join('')}
        <p class="fine rs-cap">센서가 읽은 값(0~255)</p></div></div>
      ${o.judge ? `<ul class="rs-judge" data-judge aria-label="감지된 색상 블록 결과"></ul>` : ''}
      <p class="rm-out" data-out aria-live="polite"></p>${o.note ? `<p class="fine">${escH(o.note)}</p>` : ''}</div>`;
    const q = (s) => el.querySelector(s);
    const draw = (say) => {
      const [r, g, b] = v;
      el.querySelectorAll('[data-rgb]').forEach((inp) => { inp.value = v[+inp.dataset.rgb]; inp.nextElementSibling.textContent = v[+inp.dataset.rgb]; });
      const box = q('[data-box]'); box.style.background = `rgb(${r},${g},${b})`; box.setAttribute('aria-label', `섞인 색: 빨강 ${r}, 초록 ${g}, 파랑 ${b}`);
      const j = q('[data-judge]');
      if (j) j.innerHTML = DC_KO.map(([k, ko]) => { const t = isColorV131(k, r, g, b); return `<li><span class="rm-block">감지된 색상이 ${ko}</span> <span class="sd-tf ${t ? 't' : 'f'}">${t ? '참' : '거짓'}</span></li>`; }).join('');
      const tr = DC_KO.filter(([k]) => isColorV131(k, r, g, b)).map(([, ko]) => ko);
      q('[data-out]').textContent = `${say ? say + ' ' : ''}R ${r} · G ${g} · B ${b}${o.judge ? ` → ${tr.length ? `'${tr[0]}' 블록이 참` : r + g + b < 60 ? '세 값의 합이 60보다 작아 모두 거짓' : '네 가지 모두 거짓'}` : ''}`;
    };
    el.querySelectorAll('[data-rgb]').forEach((inp) => inp.addEventListener('input', () => { v[+inp.dataset.rgb] = +inp.value; draw(); }));
    el.querySelectorAll('[data-pre]').forEach((b) => b.addEventListener('click', () => { const p = pre[+b.dataset.pre]; v[0] = p.r | 0; v[1] = p.g | 0; v[2] = p.b | 0; draw(`${p.label}(예시값):`); }));
    draw();
  }

  /* 코어 라이브러리 등록. motors·mecanum opts: keys(방향 단추), first(처음 방향) */
  /* 11~12차시 msg-map: 받은 값 → 동작 매핑판(블루투스 게임패드 글자 U·D·L·R·B… / 라디오 수 0~4). [보내기] 단추를 누르면 값이 날아가 포니봇이 그 방향으로 움직임.
   * opts: kind('uart' | 'radio'), from('게임패드'), to('제어용 포니봇'), title, intro, varName('데이터' | 'receivedNumber'),
   *       rows[{ value, act, move }](move = ↑ ↓ ↶ ↷ ← → s), ask[{ value, act, answer, choices:[move…] }](빈 줄 — 미션처럼 학생이 동작을 고름), showCode(true)
   * 14~17차시도 같은 위젯(none·stop·slow·fast, up·down·left·right)을 rows만 바꿔 쓴다 */
  const MM_ROWS = [
    { value: 'U', act: '전진', move: '↑' }, { value: 'D', act: '후진', move: '↓' }, { value: 'L', act: '제자리 좌회전', move: '↶' },
    { value: 'R', act: '제자리 우회전', move: '↷' }, { value: 'B', act: '정지', move: 's' },
  ];
  function msgMap(el, o = {}) {
    const radio = o.kind === 'radio', rows = o.rows || MM_ROWS, ask = o.ask || [], all = rows.concat(ask.map((a) => Object.assign({ ask: true }, a)));
    const vn = o.varName || (radio ? 'receivedNumber' : '데이터'), q = (x) => (radio ? String(x) : `"${x}"`);
    const from = o.from || (radio ? '조종용 마이크로비트' : '게임패드'), to = o.to || '제어용 포니봇', via = radio ? '라디오' : '블루투스';
    const e = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    let cur = null, said = o.intro || `${from}에서 값을 골라 보내 봐요. 받은 값에 따라 ${to}의 움직임이 바뀌어요.`;
    const solved = {};
    const rowOf = (v) => all.find((r) => String(r.value) === String(v));
    const draw = (focusV) => {
      const r = cur != null ? rowOf(cur) : null, open = r && r.ask && !solved[r.value];
      const move = r && !open ? r.ask ? r.answer : r.move : 's';
      el.innerHTML = `<div class="widget msgmap">
        ${o.title ? `<p class="mm-title"><b>${e(o.title)}</b></p>` : ''}
        <div class="mm-main">
          <div class="mm-send"><p class="mm-k">${e(from)}</p><div class="mm-pad" role="group" aria-label="${e(from)}에서 보낼 값">${all.map((x) => `<button type="button" class="btn small${String(x.value) === String(cur) ? ' on' : ''}" data-mm="${e(x.value)}" aria-pressed="${String(x.value) === String(cur)}">${e(x.value)}</button>`).join('')}</div></div>
          <div class="mm-flow" aria-hidden="true"><span class="mm-via">${via}</span><span class="mm-pkt${cur != null ? ' go' : ''}">${cur != null ? e(cur) : '…'}</span></div>
          <div class="mm-bot"><p class="mm-k">${e(to)}</p><div class="sim-stage">${robotSVG(move, true)}</div></div>
        </div>
        ${open ? `<div class="mm-ask" role="group" aria-label="${e(r.value)}을 받으면 어떻게 움직일까요"><p><b>${e(r.value)}</b>을(를) 받으면 어떻게 움직이게 할까요?</p>${(r.choices || ['←', '→', '↶', '↷']).map((m) => `<button type="button" class="btn small" data-mm-pick="${e(m)}">${e(m)} ${e((MOVES[m] || {}).name || '')}</button>`).join('')}</div>` : ''}
        <table class="mm-table"><caption class="sr">받은 값과 동작</caption><thead><tr><th scope="col">받은 값</th><th scope="col">동작</th></tr></thead><tbody>
          ${all.map((x) => { const hide = x.ask && !solved[x.value]; return `<tr class="${String(x.value) === String(cur) ? 'on' : ''}"><td><b>${e(x.value)}</b></td><td>${hide ? '<span class="mm-q">? (골라 봐요)</span>' : `${(x.ask ? x.answer : x.move) === 's' ? '' : e((x.ask ? x.answer : x.move) || '') + ' '}${e(x.act || (MOVES[x.ask ? x.answer : x.move] || {}).name || '')}`}</td></tr>`; }).join('')}
        </tbody></table>
        ${o.showCode !== false && r && !open ? `<p class="mm-code"><span class="sr">블록으로 보면: </span>만약 <b>${e(vn)} = ${e(q(r.value))}</b> 이면 → ${e(r.act || (MOVES[move] || {}).name || '')}</p>` : ''}
        <p class="mm-say" aria-live="polite">${e(said)}</p></div>`;
      if (focusV != null) { const b = el.querySelector(`[data-mm="${CSS.escape(String(focusV))}"]`); if (b) b.focus(); }
    };
    el.addEventListener('click', (ev) => {
      const b = ev.target.closest('button'); if (!b || !el.contains(b)) return;
      if (b.dataset.mm != null) {
        cur = b.dataset.mm; const r = rowOf(cur);
        said = r.ask && !solved[r.value] ? `${r.value}을(를) 받았어요. 어떻게 움직일지 골라요.` : `${via}로 ${r.value}을(를) 보냈어요 → ${to}: ${r.ask ? r.act || (MOVES[r.answer] || {}).name : r.act || (MOVES[r.move] || {}).name}.`;
        draw(cur); return;
      }
      if (b.dataset.mmPick) {
        const r = rowOf(cur), m = b.dataset.mmPick;
        if (m === r.answer) { solved[r.value] = true; said = `맞아요! ${r.value} → ${r.act || (MOVES[m] || {}).name}.`; }
        else said = `아직 아니에요. 목표 동작(${r.act || '목표'})이 되도록 다시 골라 봐요.`;
        draw(); const nb = el.querySelector('[data-mm-pick]') || el.querySelector(`[data-mm="${CSS.escape(String(cur))}"]`); if (nb) nb.focus();
      }
    });
    draw();
  }

  register('ipo', ipo);
  register('motors', (el, o = {}) => driveWidget(el, o.keys || ['↑', '↓', '↶', '↷'], false, o.first || '↑'));
  register('mecanum', (el, o = {}) => driveWidget(el, o.keys || ['↖', '↑', '↗', '←', 's', '→', '↙', '↓', '↘'], true, o.first || '←'));
  register('coords', coords);
  register('oled', coords); // 3~4차시가 쓰는 이름(별칭)
  register('sequence', sequence);
  register('sense-decide', senseDecide); // S3-4: 센서 → 기준값 → 비교 → 참/거짓 → 결과
  register('rgb-mix', rgbMix);           // S3-4: 포니봇 LED 4개 색·밝기·하나씩
  register('classify', classify);        // S3-3: 분류 게임(카드 → 상자), 다 맞히면 진행 기록
  register('led-grid', ledGrid);         // 1차시: 마이크로비트 LED 화면 5×5(아이콘 고르기·그리기·일시중지 타임라인)
  register('map-graph', mapGraph);       // 7~8차시: 비례 변환(Math.map)·제한(Math.constrain)·큰값/작은값 그래프
  register('msg-map', msgMap);           // 11~12차시: 받은 값 → 동작 매핑판(블루투스 글자·라디오 수, 14~17도)
  register('hotspots', hotspots);        // 1차시: 부품 눌러 보기(그림 위 번호 → 테두리 + 이름·하는 일, 앞면/뒷면)
  register('line-follow', lineFollow);   // 9~10차시: 라인 센서 ●◌(mode sensor) · 선 따라가기 속도 맞추기(mode drive)

  return {
    register,
    mount(el, name, opts, ctx) { const fn = REG[name]; if (el && fn) fn(el, opts || {}, ctx || {}); }, // ctx: app.js가 주는 진행 도우미(classify가 씀)
    has: (id) => !!REG[id],
    get ids() { return Object.keys(REG); },
    lineSim, isColorV131, // 9~10차시 시험용(line-follow drive 모형, rgb-mix sensor 판정)
  };
})();
