/* 비트런 5·6화 전용 직접 해 보기 위젯(lesson-bitrun05·06에 같은 파일): Widgets.register('id', (el, opts, ctx) => { … }).
 * 코어 id는 다시 등록하지 않는다(D11). 두 차시가 같이 쓰는 leg-mix는 코어로 올릴 후보(planning/notes.md '코어 요청').
 *   leg-mix       두 다리 방향(앞·멈춤·뒤)·빠르기(느림·보통·빠름)를 고르면 서보 속도 숫자와 비트런 움직임(앞으로·뒤로·제자리 돌기·크게 돌기)을 보여 줌
 *                 opts { title?, intro?, img?, alt?, goals?: ['forward','backward'] | ['spinR','spinL'] (다 보면 ctx.done), start?: { l: 'f'|'s'|'b', r, sp } }
 *   stop-practice 비트런이 칸을 따라 저절로 걷고, 발판(P)에 왔을 때 [멈춤(로고)]를 누르는 연습(20-gamification 5화 t-stop, 코어 path-code mode:'stop' 대신)
 *                 opts { cells: 10, pad: 7, speed: 700, img?, goal?, overText?, explain? }
 *   fn-names      ★ 함수 이름 짓기(6화 컷 7): 동작 4개에 이름 → 짝이 이름만 보고 맞히기. 저장 ctx.setData({ names, ok })
 *                 opts { slots: [{ label, ph, options[] }], after? }
 * 비트런은 그리지 않는다(실물 사진 opts.img만). 색 띠·그라데이션 테두리 없음. */
(function () {
  if (!window.Widgets || !window.Widgets.register) return;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const reduce = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function css() {
  if (typeof document === 'undefined' || !document.getElementById || document.getElementById('br56-style')) return;
  {
    const st = document.createElement('style'); st.id = 'br56-style';
    st.textContent = '.br56{display:grid;gap:12px}.br56 .br-img{display:block;max-width:100%;max-height:220px;margin:0 auto;border-radius:12px}'
      + '.br56 .br-legs{display:grid;grid-template-columns:1fr 1fr;gap:10px}@media (max-width:520px){.br56 .br-legs{grid-template-columns:1fr}}'
      + '.br56 .br-leg{border:1px solid var(--line,#d9deea);border-radius:14px;padding:10px 12px;background:var(--card,#fff)}'
      + '.br56 .br-leg h4{margin:0 0 6px;font-size:1rem}.br56 .br-row{display:flex;flex-wrap:wrap;gap:6px;margin:4px 0}'
      + '.br56 .br-row button{min-height:44px;min-width:44px}.br56 button[aria-pressed="true"]{background:#17795A;color:#fff;border-color:transparent}'
      + '.br56 .br-out{border:1px solid var(--line,#d9deea);border-radius:14px;padding:12px 14px;background:var(--card,#fff)}'
      + '.br56 .br-code{font-weight:700;font-size:1rem;margin:4px 0}.br56 .br-res{font-size:1.15rem;font-weight:800;color:#17795A;margin:2px 0}'
      + '.br56 .br-fine{color:var(--muted,#434A6C);font-size:.9rem;margin:2px 0}'
      + '.br56 .br-track{display:grid;gap:4px;align-items:center}.br56 .br-cell{height:54px;border:1px solid var(--line,#d9deea);border-radius:10px;background:#F6F8FC;position:relative}'
      + '.br56 .br-cell.pad{background:#E3F6EE;border-color:#2FB78A}.br56 .br-cell .bot{position:absolute;inset:4px;display:flex;align-items:center;justify-content:center}'
      + '.br56 .br-cell .bot img{max-width:100%;max-height:100%}.br56 .br-cell .bot i{width:30px;height:30px;border-radius:50%;background:#2FB78A;display:block}'
      + '.br56 .br-cell .lab{position:absolute;bottom:2px;left:0;right:0;text-align:center;font-size:.75rem;color:#17795A;font-weight:800}'
      + '.br56 .br-names{display:grid;gap:10px}.br56 .br-name{border:1px solid var(--line,#d9deea);border-radius:14px;padding:10px 12px;background:var(--card,#fff)}'
      + '.br56 .br-name label{display:block;font-weight:800;margin-bottom:4px}.br56 .br-name input{width:100%;max-width:260px;min-height:44px;font-size:1rem;padding:6px 10px;border:1.5px solid var(--line-strong,#7F87B2);border-radius:10px}'
      + '.br56 .warn{color:#9A5B00;font-weight:700}';
    document.head.appendChild(st);
  }
  }

  /* ---------- leg-mix ---------- */
  const DIR = [{ k: 'f', t: '앞 ↑' }, { k: 's', t: '멈춤 ■' }, { k: 'b', t: '뒤 ↓' }];
  const SP = [{ v: 30, t: '느림' }, { v: 50, t: '보통' }, { v: 100, t: '빠름' }];
  function legMix(el, o = {}, ctx = {}) {
    css();
    const st = Object.assign({ l: 'f', r: 'f', sp: 50 }, o.start || {});
    const seen = new Set((ctx.data && (ctx.data() || {}).seen) || []);
    const goals = o.goals || [];
    const num = (side) => { const d = st[side]; if (d === 's') return 0; const v = st.sp; const fwd = side === 'l' ? v : -v; return d === 'f' ? fwd : -fwd; };
    const sign = (n) => (n > 0 ? '+' + n : n < 0 ? '−' + Math.abs(n) : '0');
    function result() {
      const { l, r } = st;
      if (l === 's' && r === 's') return { k: 'stop', t: '멈춰 있어요', d: '두 다리 모두 0이에요.' };
      if (l === 'f' && r === 'f') return { k: 'forward', t: '앞으로 걸어요', d: '두 다리가 모두 앞으로 바닥을 밀어요. 숫자는 왼쪽 +, 오른쪽 −로 부호가 달라요(거울처럼 마주 달려서요).' };
      if (l === 'b' && r === 'b') return { k: 'backward', t: '뒤로 걸어요', d: '앞으로 갈 때와 두 다리 부호가 모두 반대예요.' };
      if (l === 'f' && r === 'b') return { k: 'spinR', t: '제자리에서 오른쪽으로 돌아요', d: '두 다리가 반대로 움직여요. 숫자는 두 다리 부호가 같아요(둘 다 +).' };
      if (l === 'b' && r === 'f') return { k: 'spinL', t: '제자리에서 왼쪽으로 돌아요', d: '두 다리가 반대로 움직여요. 숫자는 두 다리 부호가 같아요(둘 다 −).' };
      if (r === 's') return { k: 'arc', t: l === 'f' ? '오른쪽으로 크게 돌아요' : '뒤로 크게 돌아요', d: '한 발만 굴러요. 멈춘 다리를 축으로 크게 돌아요.' };
      return { k: 'arc', t: r === 'f' ? '왼쪽으로 크게 돌아요' : '뒤로 크게 돌아요', d: '한 발만 굴러요. 멈춘 다리를 축으로 크게 돌아요.' };
    }
    const legHTML = (side, name) => `<div class="br-leg" role="group" aria-label="${name}"><h4>${name}</h4>
      <div class="br-row" role="radiogroup" aria-label="${name} 움직임">${DIR.map((d) => `<button type="button" class="btn small" data-side="${side}" data-dir="${d.k}" aria-pressed="false">${d.t}</button>`).join('')}</div></div>`;
    el.innerHTML = `<div class="br56">${o.title ? `<h4 style="margin:0">${esc(o.title)}</h4>` : ''}
      ${o.intro ? `<p class="br-fine">${o.intro}</p>` : ''}
      ${o.img ? `<img class="br-img" src="${esc(o.img)}" alt="${esc(o.alt || '')}">` : ''}
      <div class="br-legs">${legHTML('l', '왼쪽 다리')}${legHTML('r', '오른쪽 다리')}</div>
      <div class="br-leg"><h4>빠르기(두 다리 같이)</h4><div class="br-row" role="radiogroup" aria-label="빠르기">${SP.map((s) => `<button type="button" class="btn small" data-sp="${s.v}" aria-pressed="false">${s.t} ${s.v}</button>`).join('')}</div></div>
      <div class="br-out" aria-live="polite"><p class="br-fine">코드로 보면(연속 서보 속도)</p><p class="br-code" data-code></p><p class="br-res" data-res></p><p class="br-fine" data-why></p><p class="br-fine" data-goal></p></div>
      <p class="br-fine">화면 속 계산이에요. 진짜 비트런은 바닥·건전지·모터마다 조금씩 달라요. 실습에서 직접 확인해요.</p></div>`;
    const draw = () => {
      el.querySelectorAll('[data-dir]').forEach((b) => b.setAttribute('aria-pressed', String(st[b.dataset.side] === b.dataset.dir)));
      el.querySelectorAll('[data-sp]').forEach((b) => b.setAttribute('aria-pressed', String(+b.dataset.sp === st.sp)));
      el.querySelector('[data-code]').textContent = `왼쪽 다리 서보 ${sign(num('l'))} · 오른쪽 다리 서보 ${sign(num('r'))}`;
      const r = result(); seen.add(r.k);
      el.querySelector('[data-res]').textContent = r.t; el.querySelector('[data-why]').textContent = r.d;
      if (goals.length) {
        const left = goals.filter((g) => !seen.has(g));
        const NAME = { forward: '앞으로 걷기', backward: '뒤로 걷기', spinR: '제자리 오른쪽 돌기', spinL: '제자리 왼쪽 돌기' };
        el.querySelector('[data-goal]').textContent = left.length ? `해 볼 것: ${left.map((g) => NAME[g] || g).join(', ')}` : '모두 해 봤어요!';
        if (!left.length && ctx.done) ctx.done();
      }
      if (ctx.setData) ctx.setData({ seen: [...seen] });
    };
    el.addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.dir) st[b.dataset.side] = b.dataset.dir; else if (b.dataset.sp) st.sp = +b.dataset.sp; else return;
      draw();
    });
    draw();
  }

  /* ---------- stop-practice ---------- */
  function stopPractice(el, o = {}, ctx = {}) {
    css();
    const N = o.cells || 10, PAD = o.pad != null ? o.pad : 7, SPD = o.speed || 700;
    let pos = 0, timer = null, wins = 0;
    el.innerHTML = `<div class="br56"><p class="br-fine">${o.goal || '[출발]을 누르면 비트런이 저절로 걸어가요. 발판에 닿았을 때 [멈춤(로고)]를 눌러요.'}</p>
      <div class="br-track" style="grid-template-columns:repeat(${N},1fr)" aria-hidden="true">${Array.from({ length: N }, (_, i) => `<div class="br-cell${i === PAD ? ' pad' : ''}">${i === PAD ? '<span class="lab">발판</span>' : ''}<span class="bot" data-bot="${i}"></span></div>`).join('')}</div>
      <div class="br-row"><button type="button" class="btn small" data-go>출발</button><button type="button" class="btn" data-stop disabled>멈춤(로고)</button></div>
      <div class="br-out" aria-live="polite"><p class="br-res" data-res>비트런이 출발선에 있어요.</p><p class="br-fine" data-why></p></div></div>`;
    const bot = o.img ? `<img src="${esc(o.img)}" alt="">` : '<i></i>';
    const res = el.querySelector('[data-res]'), why = el.querySelector('[data-why]'), go = el.querySelector('[data-go]'), stop = el.querySelector('[data-stop]');
    const draw = () => el.querySelectorAll('[data-bot]').forEach((b) => { b.innerHTML = +b.dataset.bot === pos ? bot : ''; });
    const end = () => { clearInterval(timer); timer = null; stop.disabled = true; go.disabled = false; go.textContent = '다시 출발'; };
    go.addEventListener('click', () => {
      pos = 0; draw(); res.textContent = '걷는 중… 발판에 닿으면 멈춰요!'; why.textContent = ''; go.disabled = true; stop.disabled = false; stop.focus();
      timer = setInterval(() => {
        pos++; draw();
        if (pos >= N - 1) { end(); res.textContent = o.overText || '발판을 지나갔어요. 다시 해 봐요.'; why.textContent = '멈춤 스위치는 가까이 있어야 제때 누를 수 있어요.'; }
      }, reduce() ? Math.max(SPD, 900) : SPD);
    });
    stop.addEventListener('click', () => {
      if (!timer) return; end();
      if (pos === PAD) { wins++; res.textContent = '발판 위에서 딱 멈췄어요!'; why.textContent = o.explain || '움직이는 기계는 사람이 언제든 멈출 수 있어야 해요.'; if (ctx.done) ctx.done(); if (ctx.setData) ctx.setData({ wins }); }
      else { res.textContent = pos < PAD ? '발판 앞에서 멈췄어요. 다시 해 봐요.' : '발판을 지나서 멈췄어요. 다시 해 봐요.'; why.textContent = ''; }
    });
    draw();
  }

  /* ---------- fn-names ---------- */
  function fnNames(el, o = {}, ctx = {}) {
    css();
    const slots = o.slots || [];
    const saved = (ctx.data && ctx.data()) || {};
    const names = saved.names || slots.map(() => '');
    el.innerHTML = `<div class="br56"><p class="br-fine">모둠이 의논한 뒤 대장이 적어요. 이름만 보고 친구가 동작을 맞힐 수 있어야 해요.</p>
      <div class="br-names">${slots.map((s, i) => `<div class="br-name"><label for="fnn-${i}">${esc(s.label)}</label>
        <input id="fnn-${i}" data-i="${i}" maxlength="12" autocomplete="off" placeholder="${esc(s.ph || '이름 적기')}" value="${esc(names[i] || '')}">
        <div class="br-row">${(s.options || []).map((t) => `<button type="button" class="btn small ghost" data-pick="${i}" data-t="${esc(t)}">${esc(t)}</button>`).join('')}</div></div>`).join('')}</div>
      <div class="br-row"><button type="button" class="btn" data-save>이름 정하기</button></div>
      <div class="br-out" aria-live="polite"><p class="br-res" data-res></p><p class="br-fine" data-why></p>
        <div data-pair hidden><p class="br-fine">${esc(o.after || '짝에게 이름만 보여 주고 동작을 몸으로 해 보게 해요. 못 맞히면 이름을 같이 고쳐요.')}</p>
        <div class="br-row"><button type="button" class="btn small" data-ok>짝이 모두 맞혔어요</button></div></div></div></div>`;
    const res = el.querySelector('[data-res]'), why = el.querySelector('[data-why]'), pair = el.querySelector('[data-pair]');
    const read = () => [...el.querySelectorAll('input[data-i]')].map((x) => x.value.trim());
    const show = (ns) => { res.textContent = '우리 모둠 함수 이름: ' + ns.join(' · '); pair.hidden = false; };
    if (saved.names && saved.names.every(Boolean)) show(saved.names);
    if (saved.ok) why.textContent = '짝 확인 끝! 실습에서 이 이름으로 함수를 만들어요.';
    el.addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.pick != null) { const x = el.querySelector(`#fnn-${b.dataset.pick}`); x.value = b.dataset.t; x.focus(); return; }
      if (b.hasAttribute('data-save')) {
        const ns = read();
        if (ns.some((n) => !n)) { res.textContent = ''; why.innerHTML = '<span class="warn">빈 이름이 있어요. 네 동작에 모두 이름을 붙여요.</span>'; return; }
        if (new Set(ns).size < ns.length) { res.textContent = ''; why.innerHTML = '<span class="warn">같은 이름이 두 번 있어요. 이름이 같으면 비트런이 어느 동작인지 몰라요.</span>'; return; }
        if (ns.some((n) => /^[0-9]/.test(n))) { res.textContent = ''; why.innerHTML = '<span class="warn">MakeCode 함수 이름은 숫자로 시작할 수 없어요.</span>'; return; }
        why.textContent = ''; show(ns); if (ctx.setData) ctx.setData({ names: ns, ok: !!saved.ok }); saved.names = ns;
      }
      if (b.hasAttribute('data-ok')) { saved.ok = true; why.textContent = '짝 확인 끝! 실습에서 이 이름으로 함수를 만들어요.'; if (ctx.setData) ctx.setData({ names: saved.names || read(), ok: true }); if (ctx.done) ctx.done(); }
    });
  }

  window.Widgets.register('leg-mix', legMix);
  window.Widgets.register('stop-practice', stopPractice);
  window.Widgets.register('fn-names', fnNames);
})();
