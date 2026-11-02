/* 가이드 쪽 라이브러리(S3-7) — 쪽 `type:'guide'`, `guide:'<id>'`, `guideOpts`, (선택) `steps[]`·`trouble[]`.
 * MakeCode 밖에서 학생이 직접 하는 일(블루투스 연결, Teachable Machine, AI 웹앱)을 단계 카드로 안내한다.
 * - 단계마다 [했어요](다시 누르면 취소). 필수 단계를 모두 하면 '확인한 쪽'(app.js bindTheory → state.guides[쪽 id].done → state.seen)
 * - 적는 칸(장치 이름 등)과 고른 기기는 그 기기에 저장(state.guides). 학생 이름은 받지 않는다
 * - 단계 글은 라이브러리 기본값 + opts로 바꿈: steps(통째로 바꿈) · skip:[id] · extra:{ id: HTML(그 단계 끝에 더함) } · trouble(통째로 바꿈)
 * - 14~17차시도 같은 id를 opts만 바꿔 쓴다(bt-connect: appName·speedOn·sign·nameCode)
 * 화면: 흰 카드(색 띠·그라데이션 테두리 없음), 번호 원, 끝난 단계는 초록 ✓. CSS는 이 파일이 한 번 넣는다(코어 CSS를 건드리지 않음)
 * app.js가 넘기는 ctx: { teacher, say, announce(t), get() → 저장값, set(g) → 이번에 진행 칸이 켜졌으면 true } */
window.Guides = (() => {
  const lib = {};
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  function register(id, fn) { if (lib[id]) throw new Error('가이드 id 겹침: ' + id); lib[id] = fn; }

  const CSS = `
.guide { display: grid; gap: 14px; margin-top: 18px; }
.guide-intro { margin: 0; color: var(--muted, #434A6C); }
.guide-progress { font-weight: 700; color: var(--ink-2, #2A3157); margin: 0; }
.guide-steps { list-style: none; margin: 0; padding: 0; display: grid; gap: 12px; }
.g-step { background: #fff; border: 1px solid var(--line, rgba(20,26,51,.12)); border-radius: var(--r-lg, 18px); padding: 16px 18px; display: grid; grid-template-columns: 40px 1fr; gap: 4px 14px; }
.g-step .g-num { width: 34px; height: 34px; border-radius: 50%; display: grid; place-items: center; font-weight: 800; background: #EEF2FF; color: var(--violet-ink, #2C3BDF); }
.g-step.done .g-num { background: var(--green-strong, #047857); color: #fff; }
.g-step h3 { margin: 4px 0 6px; font-size: 1.05rem; }
.g-step .g-body { grid-column: 2; }
.g-step .g-body p { margin: 0 0 8px; }
.g-step .g-body ol, .g-step .g-body ul { margin: 0 0 8px; padding-left: 1.2em; }
.g-step figure { margin: 8px 0; } .g-step figure img { max-width: 100%; height: auto; border-radius: 10px; border: 1px solid var(--edge, rgba(20,26,51,.07)); }
.g-step .g-acts { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-top: 6px; }
.g-step .g-ok[aria-pressed="true"] { background: var(--green-strong, #047857); color: #fff; border-color: transparent; }
.g-field { display: grid; gap: 4px; max-width: 320px; margin: 6px 0; }
.g-field input { font: inherit; font-size: 1.2rem; letter-spacing: .12em; padding: 8px 10px; border-radius: 10px; border: 1px solid var(--line, rgba(20,26,51,.12)); text-transform: lowercase; }
.g-field .g-msg { font-size: .9rem; color: var(--muted, #434A6C); min-height: 1.2em; }
.g-field .g-msg.bad { color: var(--red-ink, #B91C1C); }
.g-name-big { display: inline-block; font-size: 1.5rem; font-weight: 800; letter-spacing: .14em; padding: 2px 10px; border-radius: 8px; background: #EEF2FF; }
.g-pick { display: flex; flex-wrap: wrap; gap: 8px; margin: 6px 0; }
.g-pick-out { margin: 6px 0 0; padding: 10px 12px; border-radius: 10px; background: #F8F9FF; border: 1px solid var(--edge, rgba(20,26,51,.07)); }
.g-trouble { background: #fff; border: 1px solid var(--line, rgba(20,26,51,.12)); border-radius: var(--r-lg, 18px); padding: 12px 18px; }
.g-trouble summary { font-weight: 800; cursor: pointer; min-height: 40px; display: flex; align-items: center; }
.g-trouble dl { margin: 6px 0 0; } .g-trouble dt { font-weight: 700; margin-top: 10px; } .g-trouble dd { margin: 4px 0 0; }
.g-done { margin: 0; padding: 12px 16px; border-radius: 12px; background: var(--green-soft, rgba(16,185,129,.12)); color: var(--green-ink, #065F46); font-weight: 700; }
@media (max-width: 560px) { .g-step { grid-template-columns: 1fr; } .g-step .g-body { grid-column: 1; } }
`;
  function ensureCss() {
    if (document.getElementById('guides-css')) return;
    const st = document.createElement('style'); st.id = 'guides-css'; st.textContent = CSS; document.head.appendChild(st);
  }

  /* 공통 틀: def = { intro, steps:[{ id, title, body, img?, alt?, field?, pick?, optional? }], trouble:[{ q, a }], doneText }
   * field = { key, label, placeholder, pattern(정규식 글), bad(틀렸을 때 문장), show(쓴 값을 보여 줄 다른 단계 id 목록 — body의 {key} 자리) }
   * pick = { key, label, options:[{ id, label, out(HTML) }] } — 고르면 out을 아래에 보여 줌 */
  function mountSteps(el, def, ctx) {
    ensureCss();
    const g = Object.assign({ steps: {} }, ctx.get ? ctx.get() : {});
    g.steps = Object.assign({}, g.steps);
    const fill = (html) => String(html || '').replace(/\{(\w+)\}/g, (m, k) => (g[k] ? `<span class="g-name-big">${esc(g[k])}</span>` : m === '{deviceName}' ? '<b>내 장치 이름</b>' : m));
    const need = def.steps.filter((s) => !s.optional);
    const doneN = () => need.filter((s) => g.steps[s.id]).length;
    const store = () => { g.done = doneN() === need.length; const lit = ctx.set ? ctx.set(g) : false; return lit; };
    const stepHTML = (s, i) => {
      const f = s.field, pk = s.pick, ok = !!g.steps[s.id];
      return `<li class="g-step ${ok ? 'done' : ''}" data-step="${esc(s.id)}"><span class="g-num" aria-hidden="true">${ok ? '✓' : i + 1}</span>
        <div class="g-body"><h3><span class="sr">${i + 1}단계: </span>${esc(s.title)}${s.optional ? ' <small class="opt-tag">선택</small>' : ''}</h3>
          <div class="g-text">${fill(s.body)}</div>
          ${s.img ? `<figure><img src="${esc(s.img)}" alt="${esc(s.alt || '')}" loading="lazy" data-zoom tabindex="0" role="button"></figure>` : ''}
          ${f ? `<label class="g-field"><span>${esc(f.label)}</span><input data-gfield="${esc(f.key)}" maxlength="${f.max || 12}" autocomplete="off" spellcheck="false" placeholder="${esc(f.placeholder || '')}" value="${esc(g[f.key] || '')}"><span class="g-msg" aria-live="polite"></span></label>` : ''}
          ${pk ? `<div class="g-pick" role="group" aria-label="${esc(pk.label)}">${pk.options.map((o) => `<button type="button" class="pick-chip" data-gpick="${esc(pk.key)}" data-v="${esc(o.id)}" aria-pressed="${g[pk.key] === o.id}">${esc(o.label)}</button>`).join('')}</div><div class="g-pick-out" data-gout="${esc(pk.key)}" ${g[pk.key] ? '' : 'hidden'}>${g[pk.key] ? (pk.options.find((o) => o.id === g[pk.key]) || {}).out || '' : ''}</div>` : ''}
          <div class="g-acts"><button type="button" class="btn small g-ok" data-gok="${esc(s.id)}" aria-pressed="${ok}">${ok ? '✓ 했어요' : '했어요'}</button></div>
        </div></li>`;
    };
    const render = () => {
      el.innerHTML = `<section class="guide" aria-label="${esc(def.label || '따라 하기')}">
        ${def.intro ? `<p class="guide-intro">${def.intro}</p>` : ''}
        <p class="guide-progress" aria-live="polite">${doneN()}/${need.length}단계 했어요</p>
        <ol class="guide-steps">${def.steps.map(stepHTML).join('')}</ol>
        ${(def.trouble || []).length ? `<details class="g-trouble"><summary>잘 안 되나요? 문제 해결</summary><dl>${def.trouble.map((t) => `<dt>${esc(t.q)}</dt><dd>${t.a}</dd>`).join('')}</dl></details>` : ''}
        ${g.done ? `<p class="g-done" role="status">${esc(def.doneText || '모든 단계를 했어요!')}</p>` : ''}
      </section>`;
    };
    render();
    el.addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b || !el.contains(b)) return;
      if (b.dataset.gok) {
        const id = b.dataset.gok, s = def.steps.find((x) => x.id === id);
        if (!g.steps[id] && s.field && !String(g[s.field.key] || '').trim() && !s.field.optional) { const m = $msg(s.field.key); if (m) { m.textContent = s.field.empty || '먼저 칸에 적어요.'; m.classList.add('bad'); } const i = el.querySelector(`[data-gfield="${s.field.key}"]`); if (i) i.focus(); return; }
        if (!g.steps[id] && s.pick && !g[s.pick.key]) { if (ctx.announce) ctx.announce('먼저 하나를 골라요.'); const c = el.querySelector(`[data-gpick="${s.pick.key}"]`); if (c) c.focus(); return; }
        if (g.steps[id]) delete g.steps[id]; else g.steps[id] = Date.now();
        const lit = store(); render();
        const nb = el.querySelector(`[data-gok="${id}"]`); if (nb) nb.focus({ preventScroll: true });
        if (ctx.announce) ctx.announce(g.steps[id] ? `${s.title}: 했어요. ${doneN()}/${need.length}단계${lit ? `, ${ctx.say || 'LED가'} 켜졌어요` : ''}.` : `${s.title}: 취소했어요.`);
        return;
      }
      if (b.dataset.gpick) {
        const key = b.dataset.gpick; g[key] = b.dataset.v; store();
        el.querySelectorAll(`[data-gpick="${key}"]`).forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
        const pk = def.steps.map((s) => s.pick).find((p) => p && p.key === key), o = pk.options.find((x) => x.id === g[key]);
        const out = el.querySelector(`[data-gout="${key}"]`); if (out) { out.hidden = false; out.innerHTML = o.out || ''; }
      }
    });
    const $msg = (key) => { const i = el.querySelector(`[data-gfield="${key}"]`); return i && i.parentNode.querySelector('.g-msg'); };
    el.addEventListener('input', (e) => {
      const i = e.target.closest('[data-gfield]'); if (!i) return;
      const key = i.dataset.gfield, f = def.steps.map((s) => s.field).find((x) => x && x.key === key);
      const v = i.value.trim().toLowerCase(); g[key] = v; store();
      const m = $msg(key); if (!m) return;
      const bad = v && f.pattern && !new RegExp(f.pattern).test(v);
      m.textContent = bad ? f.bad || '다시 확인해 봐요.' : v ? '저장했어요(이 기기에만).' : ''; m.classList.toggle('bad', !!bad);
      // 이 값을 쓰는 다른 단계 글({key})을 바로 바꾼다
      def.steps.forEach((s) => { if (s.id !== f.step && String(s.body || '').includes(`{${key}}`)) { const t = el.querySelector(`[data-step="${s.id}"] .g-text`); if (t) t.innerHTML = fill(s.body); } });
    });
  }

  /* bt-connect: 블루투스로 마이크로비트와 기기 연결(11~12 실습 2, 14~17차시 공통 흐름 — PPT 11~12 S30~S43)
   * opts: appName('블루투스 컨트롤러') · sign(연결되면 보이는 표시, 기본 마이크로비트 화면 ✓) · nameCode(장치 이름 확인 코드 안내 HTML)
   *       appUrl(있으면 [앱 열기] 링크, 없으면 찾아 들어가는 길만) · speedOn(연결되면 속도 값 안내) · steps/skip/extra/trouble/intro */
  const BT_DEFAULT = (o) => [
    { id: 'setting', title: "프로젝트 설정: '페어링 필요 없음'",
      body: `<p>블루투스로 연결하려면 MakeCode 프로젝트가 <b>'페어링이 필요하지 않습니다(누구나 블루투스로 연결)'</b>로 되어 있어야 해요.</p>
        <p>이 웹앱에서 만든 프로젝트는 <b>처음부터 이렇게 맞춰져 있어요.</b> 확인만 해요: MakeCode 오른쪽 위 톱니바퀴 → [프로젝트 설정].</p>
        <p class="fine">MakeCode를 새 탭에서 따로 열어 만들었다면 같은 곳에서 직접 켜고 저장해요.</p>` },
    { id: 'name', title: '내 마이크로비트 장치 이름 확인하기',
      body: `${o.nameCode || '<p>장치 이름을 보여 주는 코드를 다운로드하면 포니봇 OLED 화면에 <b>영어 소문자 5글자</b>가 나와요(예: vazog).</p>'}
        <p>교실에는 마이크로비트가 많아서, 연결할 때 <b>내 이름</b>을 골라야 해요. 아래 칸에 적어 두면 연결 단계에 크게 보여요.</p>`,
      field: { key: 'deviceName', label: '내 장치 이름(소문자 5글자)', placeholder: '예) vazog', pattern: '^[a-z]{5}$', bad: '장치 이름은 영어 소문자 5글자예요. 화면을 다시 봐요.', empty: '먼저 장치 이름을 적어요.', max: 5, step: 'name' } },
    { id: 'device', title: '조종할 기기와 브라우저 고르기',
      body: '<p>블루투스가 되는 기기를 골라요. 기기마다 쓰는 브라우저가 달라요.</p>',
      pick: { key: 'device', label: '조종할 기기', options: [
        { id: 'pc', label: '노트북·크롬북', out: '<b>크롬(Chrome)</b> 브라우저를 써요. 컴퓨터의 블루투스가 켜져 있어야 해요.' },
        { id: 'android', label: '안드로이드 폰·태블릿', out: '<b>크롬(Chrome)</b> 브라우저를 써요. 블루투스와 위치(근처 기기 찾기)를 켜요.' },
        { id: 'ios', label: '아이폰·아이패드', out: '<b>블루파이(Bluefy)</b> 브라우저 앱을 내려받아 써요. 아이폰·아이패드의 기본 브라우저(사파리)로는 웹 블루투스 연결이 안 돼요.' },
      ] } },
    { id: 'app', title: `${o.appName || '블루투스 컨트롤러'} 열기`,
      body: `<ol><li>구글에서 <b>바운더리엑스</b>를 검색해 들어가요.</li><li>[EDU] → [AI WEB APP(FOR MICRO:BIT)]을 눌러요.</li><li><b>${esc(o.appName || '블루투스 컨트롤러')}</b>의 [앱 열기]를 눌러요.</li></ol>
        ${o.appUrl ? `<p><a class="btn small" href="${esc(o.appUrl)}" target="_blank" rel="noopener">${esc(o.appName || '블루투스 컨트롤러')} 새 탭으로 열기</a></p>` : ''}` },
    { id: 'connect', title: '연결하기: Connect → 내 장치 이름 → 페어링',
      body: `<ol><li>왼쪽 위 <b>[Connect]</b>를 눌러요.</li><li>목록에서 <b>BBC micro:bit [</b>{deviceName}<b>]</b>을 골라 <b>[페어링]</b>을 눌러요(브라우저 창의 단추 이름이에요. 프로젝트 설정의 '페어링 필요 없음'은 그대로 둬요).</li><li>버튼 글자가 <b>Connected</b>로 바뀌면 연결된 거예요.</li></ol>
        <p>${esc(o.sign || '마이크로비트 화면에 ✓ 표시가 나와요(V2는 소리도 나요).')}${o.speedOn != null ? ` 연결되면 코드의 속도 값이 ${esc(o.speedOn)}이 되어 포니봇이 움직일 준비가 돼요.` : ''}</p>` },
  ];
  const BT_TROUBLE = [
    { q: '장치 목록에 내 마이크로비트가 안 보여요', a: "<ol><li>모둠의 다른 기기나 다른 탭이 이미 연결했는지 봐요. 마이크로비트는 <b>한 번에 한 기기와만</b> 연결돼요.</li><li>포니봇 전원이 켜져 있고, 블루투스 코드를 <b>다운로드</b>했는지 봐요.</li><li>코딩 화면을 새로 고침(Ctrl + F5)한 뒤 코드를 <b>다시 다운로드</b>해요.</li><li>MakeCode [프로젝트 설정]이 '페어링 필요 없음'인지 봐요.</li><li>그래도 안 되면 기기 블루투스를 껐다 켜요.</li></ol>" },
    { q: '이름이 비슷한 장치가 여러 개예요', a: '<p>1단계에 적은 <b>내 장치 이름 5글자</b>와 똑같은 것만 골라요. 다른 모둠 포니봇에 연결하면 그 포니봇이 움직여요.</p>' },
    { q: '연결은 됐는데 포니봇이 안 움직여요', a: '<p>포니봇 전원 스위치를 켰는지 봐요(모터는 전원이 켜져야 움직여요). 연결이 끊기면 속도가 0이 되도록 만든 코드라면, 다시 연결해요.</p>' },
    { q: '아이폰에서 [Connect]를 눌러도 아무 일이 없어요', a: '<p>사파리 대신 <b>블루파이(Bluefy)</b> 앱으로 같은 주소를 열어요.</p>' },
    { q: '연결이 자꾸 끊겨요', a: '<p>조종하는 사람이 포니봇 가까이(몇 걸음 안)에서 따라가며 해 봐요. 블루투스는 멀어지거나 배터리가 약하면 끊기기 쉬워요.</p>' },
  ];
  register('bt-connect', (el, o, ctx) => {
    const skip = new Set(o.skip || []);
    let steps = (o.steps || BT_DEFAULT(o)).filter((s) => !skip.has(s.id));
    if (o.extra) steps = steps.map((s) => (o.extra[s.id] ? Object.assign({}, s, { body: s.body + o.extra[s.id] }) : s));
    mountSteps(el, {
      label: '블루투스 연결 단계',
      intro: o.intro || '차례대로 하고 단계마다 [했어요]를 눌러요. 다 하면 진행 표시가 켜져요.',
      steps, trouble: o.trouble || BT_TROUBLE,
      doneText: o.doneText || '블루투스 연결 단계를 모두 했어요! 이제 버튼으로 포니봇을 조종해 봐요.',
    }, ctx);
  });

  function mount(el, id, opts, ctx) {
    const fn = lib[id];
    if (!fn) { el.innerHTML = `<p class="fine">가이드 '${esc(id)}'를 찾지 못했어요.</p>`; return; }
    fn(el, opts || {}, ctx || {});
  }
  return { register, mount, steps: mountSteps, has: (id) => !!lib[id], list: () => Object.keys(lib) };
})();
