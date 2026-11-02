/* 비트런 2화 전용 직접 해 보기 위젯: Widgets.register('id', (el, opts, ctx) => { … }).
 * 코어 라이브러리(../core/js/widgets.js·widgets-game.js)에 있는 id는 다시 등록하지 않는다(D11). 두 번째 차시가 쓰면 같은 id 그대로 코어로 올린다.
 *
 * bitrun-build  조립 단계 카드(게이미피케이션 K21 '조립 별판'의 차시판 — 코어 step-stars가 생기면 그쪽으로 옮김)
 *   opts: { title, intro?, kits?: { v1: [step…], v2: [step…] } | steps: [step…], defaultKit?(기본 판 — 단추 맨 앞·고르지 않았을 때 이 판), kitNote?, crew?: true, doneText }
 *   step: { label, img, alt, text(HTML), warn?(HTML, 방향 주의), tip?(HTML), credit? }
 *   - 키트 판(V1·V2)을 고르면 그 판의 단계만 보임. 고른 판은 같은 기기의 다른 조립 쪽에도 이어짐(localStorage 'bitrun:kit', 실패하면 조용히 넘어감)
 *   - 한 번에 한 단계(R9 한 화면에 할 일 하나), [했어요] = 별 1칸, [이전]·[다음]·점 단추, 키보드 ←→(카드 안), 시간 제한 없음(R2)
 *   - 모든 단계를 하면 ctx.done()(이 쪽 위젯 완료) + 끝 글. 저장 ctx.setData({ kit, done: { v1: [번호…], v2: [번호…] }, at })
 *   - 그림은 PPT 조립도 원본(바운더리엑스 제작). data-zoom = 코어 그림 크게 보기 */
(() => {
  const W = window.Widgets; if (!W) return;
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const KIT_LABEL = { v1: 'V1 키트(예전)', v2: 'V2 키트' };
  const readKit = () => { try { return localStorage.getItem('bitrun:kit') || ''; } catch (e) { return ''; } };
  const writeKit = (k) => { try { localStorage.setItem('bitrun:kit', k); } catch (e) { /* 저장 못 해도 화면은 그대로 */ } };
  const CSS = `
.bb { display: grid; gap: 12px; }
.bb-top { display: grid; gap: 6px; }
.bb-title { margin: 0; font-weight: 800; font-size: 1.05rem; }
.bb-kit { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.bb-kit button { min-height: 44px; min-width: 96px; border-radius: 999px; border: 1px solid var(--line, #D5DAE6); background: #fff; font: inherit; font-weight: 700; padding: 0 16px; cursor: pointer; }
.bb-kit button[aria-pressed="true"] { border-color: var(--series-ink, #17795A); color: var(--series-ink, #17795A); box-shadow: inset 0 0 0 1px var(--series-ink, #17795A); }
.bb-prog { margin: 0; font-weight: 700; }
.bb-stars { letter-spacing: 2px; color: var(--series-ink, #17795A); }
.bb-dots { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 6px; }
.bb-dots button { width: 40px; height: 40px; border-radius: 50%; border: 1px solid var(--line, #D5DAE6); background: #fff; font: inherit; font-weight: 700; cursor: pointer; }
.bb-dots button.ok { background: var(--series-accent, #2FB78A); border-color: var(--series-accent, #2FB78A); color: #fff; }
.bb-dots button[aria-current="step"] { outline: 3px solid var(--series-ink, #17795A); outline-offset: 2px; }
.bb-card { border: 1px solid var(--line, #D5DAE6); border-radius: 16px; background: #fff; padding: 14px; display: grid; gap: 10px; }
.bb-card h4 { margin: 0; font-size: 1rem; }
.bb-card figure { margin: 0; }
.bb-card img { display: block; width: 100%; max-height: 440px; object-fit: contain; border-radius: 12px; border: 1px solid var(--line, #E3E7F0); background: #fff; cursor: zoom-in; }
.bb-card figcaption { font-size: .82rem; color: var(--muted, #5A6178); margin-top: 4px; }
.bb-text { margin: 0; }
.bb-warn { margin: 0; padding: 8px 12px; border-radius: 10px; background: #FFF4E5; border: 1px solid #F5C27A; }
.bb-tip { margin: 0; padding: 8px 12px; border-radius: 10px; background: #F3F6FB; border: 1px solid #DDE3EE; }
.bb-crew { margin: 0; font-size: .9rem; color: var(--muted, #5A6178); }
.bb-acts { display: flex; flex-wrap: wrap; gap: 8px; justify-content: space-between; }
.bb-acts .btn { min-height: 44px; }
.bb-done { margin: 0; padding: 10px 12px; border-radius: 12px; border: 1px solid var(--series-accent, #2FB78A); background: #EFFAF5; font-weight: 700; }
@media (max-width: 600px) { .bb-acts { justify-content: stretch; } .bb-acts .btn { flex: 1 1 30%; } }
`;
  const ensureCss = () => { if (document.getElementById('bitrun-build-css')) return; const s = document.createElement('style'); s.id = 'bitrun-build-css'; s.textContent = CSS; document.head.appendChild(s); };

  function build(el, o = {}, ctx0 = {}) {
    ensureCss();
    const ctx = Object.assign({ data: () => ({}), setData: () => {}, done: () => false, announce: () => {} }, ctx0);
    const kits = o.kits || null;
    const saved = ctx.data() || {};
    let kit = kits ? (saved.kit || readKit() || o.defaultKit || '') : '_';
    if (kits && kit && !kits[kit]) kit = (o.defaultKit && kits[o.defaultKit]) ? o.defaultKit : '';
    const kitKeys = kits ? Object.keys(kits).sort((a, b) => (b === o.defaultKit) - (a === o.defaultKit)) : [];
    const doneSets = {}; Object.keys(saved.done || {}).forEach((k) => { doneSets[k] = new Set(saved.done[k]); });
    let at = 0;
    const steps = () => (kits ? (kits[kit] || []) : (o.steps || []));
    const doneOf = () => { if (!doneSets[kit]) doneSets[kit] = new Set(); return doneSets[kit]; };
    const store = () => { const d = {}; Object.keys(doneSets).forEach((k) => { d[k] = [...doneSets[k]]; }); ctx.setData({ kit, done: d }); };
    const crewLine = (i) => (o.crew ? `<p class="bb-crew">이번 단계 손: <b>${(i % 4) + 1}번 자리</b> 친구 · 다른 친구는 그림과 똑같은지 봐 줘요.</p>` : '');
    function draw(focusSel) {
      const S = steps(), D = doneOf(), n = S.length, all = n > 0 && D.size >= n;
      if (at >= n) at = Math.max(0, n - 1);
      const s = S[at] || {};
      el.innerHTML = `<div class="widget bb">
        <div class="bb-top">${o.title ? `<p class="bb-title">${esc(o.title)}</p>` : ''}${o.intro ? `<p class="fine" style="margin:0">${o.intro}</p>` : ''}
          ${kits ? `<div class="bb-kit" role="group" aria-label="키트 판 고르기"><span class="fine">우리 키트:</span>${kitKeys.map((k) => `<button type="button" data-kit="${k}" aria-pressed="${kit === k}">${esc(KIT_LABEL[k] || k)}</button>`).join('')}</div>${o.kitNote ? `<p class="fine" style="margin:0">${o.kitNote}</p>` : ''}` : ''}</div>
        ${!kit ? '<p class="bb-tip">먼저 <b>우리 키트</b>를 골라요. 준비물 쪽에서 리벳 나사 모양으로 V1·V2를 알아봤어요.</p>' : `
        <p class="bb-prog" aria-live="polite">별 <b>${D.size}</b> / ${n} <span class="bb-stars" aria-hidden="true">${S.map((_, i) => (D.has(i) ? '★' : '☆')).join('')}</span></p>
        <ol class="bb-dots" aria-label="단계 고르기">${S.map((x, i) => `<li><button type="button" data-go="${i}" class="${D.has(i) ? 'ok' : ''}" ${i === at ? 'aria-current="step"' : ''} aria-label="${i + 1}단계 ${esc(x.label || '')}${D.has(i) ? ' (했어요)' : ''}">${i + 1}</button></li>`).join('')}</ol>
        <article class="bb-card" tabindex="-1" aria-label="${at + 1}단계">
          <h4>${at + 1} / ${n} 단계 · ${esc(s.label || '')}</h4>
          ${s.img ? `<figure><img src="${esc(s.img)}" alt="${esc(s.alt || '')}" loading="lazy" data-zoom tabindex="0" role="button"><figcaption>그림을 누르면 크게 보여요${s.credit ? ` · ${esc(s.credit)}` : ' · 출처: 비트런 조립 설명서(바운더리엑스)'}</figcaption></figure>` : ''}
          <p class="bb-text">${s.text || ''}</p>
          ${s.warn ? `<p class="bb-warn"><b>방향 주의</b> ${s.warn}</p>` : ''}
          ${s.tip ? `<p class="bb-tip">${s.tip}</p>` : ''}
          ${crewLine(at)}
          <div class="bb-acts">
            <button type="button" class="btn ghost" data-prev ${at === 0 ? 'disabled' : ''}>이전 단계</button>
            <button type="button" class="btn ${D.has(at) ? '' : 'primary'}" data-ok aria-pressed="${D.has(at)}">${D.has(at) ? '★ 했어요' : '했어요'}</button>
            <button type="button" class="btn ghost" data-next ${at >= n - 1 ? 'disabled' : ''}>다음 단계</button>
          </div>
        </article>
        ${all ? `<p class="bb-done" role="status">${esc(o.doneText || '모든 단계를 했어요!')}</p>` : ''}`}
      </div>`;
      bind();
      if (focusSel) { const f = el.querySelector(focusSel); if (f) f.focus({ preventScroll: true }); }
    }
    function bind() {
      el.querySelectorAll('[data-kit]').forEach((b) => b.addEventListener('click', () => { kit = b.dataset.kit; writeKit(kit); at = 0; store(); draw('[data-kit][aria-pressed="true"]'); ctx.announce(`${KIT_LABEL[kit] || kit} 조립 순서를 보여 줘요.`); }));
      el.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => { at = +b.dataset.go; draw('.bb-card'); }));
      const pv = el.querySelector('[data-prev]'); if (pv) pv.addEventListener('click', () => { at = Math.max(0, at - 1); draw('.bb-card'); });
      const nx = el.querySelector('[data-next]'); if (nx) nx.addEventListener('click', () => { at = Math.min(steps().length - 1, at + 1); draw('.bb-card'); });
      const ok = el.querySelector('[data-ok]');
      if (ok) ok.addEventListener('click', () => {
        const D = doneOf(), S = steps();
        if (D.has(at)) { D.delete(at); store(); draw('[data-ok]'); ctx.announce(`${at + 1}단계를 다시 안 한 것으로 바꿨어요.`); return; }
        D.add(at); store();
        const all = D.size >= S.length;
        let lit = false;
        if (all) lit = ctx.done();
        const was = at;
        if (!all && at < S.length - 1) at++;
        draw(all ? '.bb-done' : '.bb-card');
        ctx.announce(`${was + 1}단계 했어요. 별 ${D.size}개.${all ? ` ${o.doneText || '모든 단계를 했어요!'}${lit && ctx.say ? ` ${ctx.say} 켜졌어요.` : ''}` : ''}`);
      });
      const card = el.querySelector('.bb-card');
      if (card) card.addEventListener('keydown', (e) => {
        if (e.target.closest('button') && !['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
        if (['ArrowLeft', 'ArrowRight'].includes(e.key)) e.stopPropagation(); // 쪽 넘기기(←→)보다 단계 넘기기 먼저
        if (e.key === 'ArrowLeft' && at > 0) { e.preventDefault(); at--; draw('.bb-card'); } else if (e.key === 'ArrowRight' && at < steps().length - 1) { e.preventDefault(); at++; draw('.bb-card'); }
      });
    }
    draw();
  }
  W.register('bitrun-build', build);
})();
