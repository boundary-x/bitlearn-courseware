/* 비트런 8화 전용 직접 해 보기 위젯: Widgets.register('id', (el, opts, ctx) => { … }).
 * 코어 라이브러리(../core/js/widgets.js·widgets-game.js)에 있는 id는 다시 등록하지 않는다(D11). 두 번째 차시가 쓰면 같은 id 그대로 코어로 올린다.
 *
 * rule-rank — 규칙 카드 우선순위 정하기(바이블 v2.1 8화 컷 8 ★, 정답 없음)
 *   카드 n장 중 3장을 1·2·3순위 칸에 놓고 순위마다 까닭 한 줄 → [우리 순서 정하기]
 *   opts.must 카드(사람의 안전)가 3장 안에 없으면 박사 안내 AI가 opts.recheck로 되묻고 끝내지 않음(고쳐서 다시)
 *   다 되면 [opts.data.label](방문객·어린이 자료 더하기) → opts.data.done 글 → 쪽 완료(ctx.done), 기록 ctx.setData({ ranks, reasons, dataAdded, rechecks })
 *   opts: { title, cards[{ id, text, think }], must, recheck, slots(3), reasonPh, minReason(2), data{ label, done }, note }
 *   키보드: 카드·칸 모두 단추(Tab·Enter/Space). 움직임 없음. 흰 카드 + 1px 테두리(색 띠 없음) */
(function () {
  if (!window.Widgets || !window.Widgets.register) return;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let n = 0;

  function style() {
    if (document.getElementById('rr8-style')) return;
    const st = document.createElement('style'); st.id = 'rr8-style';
    st.textContent = '.rr8{display:grid;gap:12px}.rr8-title{margin:0;font-weight:800}'
      + '.rr8-cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:8px;margin:0;padding:0;list-style:none}'
      + '.rr8-card{width:100%;min-height:64px;text-align:left;padding:10px 12px;border:1px solid var(--line,#d9deea);border-radius:12px;background:var(--card,#fff);font:inherit;color:var(--ink,#1d2433);cursor:pointer}'
      + '.rr8-card[aria-pressed="true"]{border-color:var(--series-accent,#2FB78A);box-shadow:0 0 0 2px var(--series-accent,#2FB78A) inset}'
      + '.rr8-card b{display:inline-grid;place-items:center;min-width:24px;height:24px;margin-right:6px;border-radius:999px;background:var(--series-accent,#2FB78A);color:#fff;font-size:.85rem}'
      + '.rr8-slots{display:grid;gap:8px;margin:0;padding:0;list-style:none}'
      + '.rr8-slot{display:grid;grid-template-columns:auto 1fr;gap:6px 10px;align-items:center;padding:10px 12px;border:1px dashed var(--line,#d9deea);border-radius:12px;background:var(--card,#fff)}'
      + '.rr8-slot.full{border-style:solid}.rr8-n{font-weight:900;color:var(--series-ink,#17795A)}'
      + '.rr8-slot .rr8-txt{font-weight:700}.rr8-slot input{grid-column:1/-1;width:100%;padding:8px 10px;border:1px solid var(--line,#d9deea);border-radius:10px;font:inherit}'
      + '.rr8-x{justify-self:end;grid-column:1/-1}.rr8-msg{margin:0;padding:10px 12px;border:1px solid var(--line,#d9deea);border-radius:12px;background:var(--card,#fff)}'
      + '.rr8-msg.ask{border-color:#E0A800}.rr8-msg ul{margin:6px 0 0;padding-left:1.2em}'
      + '@media (max-width:600px){.rr8-cards{grid-template-columns:1fr 1fr}}';
    document.head.appendChild(st);
  }

  function ruleRank(el, o = {}, ctx = {}) {
    style();
    const id = `rr8-${++n}`;
    const cards = (o.cards || []).filter((c) => c && c.id && c.text);
    const S = Math.max(1, +o.slots || 3), min = o.minReason != null ? +o.minReason : 2;
    const get = typeof ctx.data === 'function' ? ctx.data : () => null, set = typeof ctx.setData === 'function' ? ctx.setData : () => {};
    const saved = get() || {};
    let ranks = Array.isArray(saved.ranks) ? saved.ranks.filter((k) => cards.some((c) => c.id === k)).slice(0, S) : [];
    const reasons = Object.assign({}, saved.reasons || {});
    let decided = !!saved.decided, dataAdded = !!saved.dataAdded, rechecks = +saved.rechecks || 0;
    const byId = (k) => cards.find((c) => c.id === k);
    const announce = (t) => { if (typeof ctx.announce === 'function') ctx.announce(String(t).replace(/<[^>]+>/g, '')); };
    const store = () => set({ ranks: ranks.slice(), reasons: Object.assign({}, reasons), decided, dataAdded, rechecks, pick: ranks.map((k) => (byId(k) || {}).text).join(' > ') });

    function render() {
      const full = ranks.length === S;
      el.innerHTML = `<div class="widget rr8" id="${id}">
        ${o.title ? `<p class="rr8-title">${esc(o.title)}</p>` : ''}
        <p class="fine" id="${id}-how">① 중요하다고 생각하는 규칙부터 차례로 눌러요. ② 순서를 바꾸려면 [빼기]를 누르고 다시 골라요. ③ 그 순서로 정한 까닭을 한 줄씩 적어요.</p>
        <ul class="rr8-cards" aria-describedby="${id}-how">${cards.map((c) => { const r = ranks.indexOf(c.id); return `<li><button type="button" class="rr8-card" data-card="${esc(c.id)}" aria-pressed="${r >= 0}" ${decided ? 'disabled' : ''}>${r >= 0 ? `<b aria-hidden="true">${r + 1}</b>` : ''}${esc(c.text)}${r >= 0 ? `<span class="sr"> (${r + 1}순위)</span>` : ''}</button></li>`; }).join('')}</ul>
        <ol class="rr8-slots" aria-label="우리 모둠 순위">${Array.from({ length: S }, (_, i) => { const c = byId(ranks[i]); return `<li class="rr8-slot${c ? ' full' : ''}"><span class="rr8-n">${i + 1}순위</span><span class="rr8-txt">${c ? esc(c.text) : '<span class="fine">빈 칸</span>'}</span>${c ? `<input type="text" maxlength="80" data-why="${esc(c.id)}" aria-label="${i + 1}순위 까닭" placeholder="${esc(o.reasonPh || '이 순위인 까닭')}" value="${esc(reasons[c.id] || '')}" ${decided ? 'disabled' : ''}>${decided ? '' : `<button type="button" class="btn small rr8-x" data-out="${esc(c.id)}">빼기</button>`}` : ''}</li>`; }).join('')}</ol>
        <p>${decided ? `<button type="button" class="btn small" data-redo>순서 다시 정하기</button>` : `<button type="button" class="btn primary" data-go aria-disabled="${!full}">우리 순서 정하기</button>`} <span class="fine" data-need></span></p>
        <div data-out-msg aria-live="polite"></div>
        ${o.note ? `<p class="fine">${esc(o.note)}</p>` : ''}
      </div>`;
      bind();
      need();
      if (decided) showResult(false);
    }
    function need() {
      const nd = el.querySelector('[data-need]'); if (!nd || decided) return;
      const miss = ranks.filter((k) => String(reasons[k] || '').trim().length < min).length;
      nd.textContent = ranks.length < S ? ` 카드를 ${S - ranks.length}장 더 골라요.` : miss ? ` 까닭을 ${miss}칸 더 적어요(${min}자 이상).` : '';
      const go = el.querySelector('[data-go]'); if (go) go.setAttribute('aria-disabled', String(!(ranks.length === S && !miss)));
    }
    function showResult(fresh) {
      const box = el.querySelector('[data-out-msg]');
      const list = ranks.map((k, i) => `<li><b>${i + 1}순위 ${esc(byId(k).text)}</b> — ${esc(reasons[k] || '')}<br><span class="fine">${esc(byId(k).think || '')}</span></li>`).join('');
      box.innerHTML = `<p class="rr8-msg"><b>우리 모둠 규칙 순서</b></p><ul>${list}</ul>`
        + (o.data ? (dataAdded ? `<p class="rr8-msg">${esc(o.data.done || '자료를 더했어요.')}</p>` : `<p><button type="button" class="btn primary" data-add>${esc(o.data.label || '자료 더하기')}</button></p>`) : '');
      const add = box.querySelector('[data-add]');
      if (add) add.addEventListener('click', () => { dataAdded = true; store(); finish(); showResult(true); const m = box.querySelector('.rr8-msg:last-of-type'); if (m) announce(m.textContent); });
      if (fresh && !o.data) finish();
    }
    function finish() { if (typeof ctx.done === 'function') ctx.done(); }
    function bind() {
      el.querySelectorAll('[data-card]').forEach((b) => b.addEventListener('click', () => {
        const k = b.dataset.card, r = ranks.indexOf(k);
        if (r >= 0) ranks.splice(r, 1); else if (ranks.length < S) ranks.push(k); else { announce(`순위 칸이 다 찼어요. 칸에서 [빼기]를 먼저 눌러요.`); return; }
        store(); render();
        const again = el.querySelector(`[data-card="${CSS.escape(k)}"]`); if (again) again.focus();
      }));
      el.querySelectorAll('[data-out]').forEach((b) => b.addEventListener('click', () => { const k = b.dataset.out; ranks = ranks.filter((x) => x !== k); store(); render(); }));
      el.querySelectorAll('[data-why]').forEach((t) => t.addEventListener('input', () => { reasons[t.dataset.why] = t.value; store(); need(); }));
      const go = el.querySelector('[data-go]');
      if (go) go.addEventListener('click', () => {
        if (go.getAttribute('aria-disabled') === 'true') { need(); return; }
        const box = el.querySelector('[data-out-msg]');
        if (o.must && !ranks.includes(o.must)) {
          rechecks += 1; store();
          box.innerHTML = `<p class="rr8-msg ask"><b>박사 안내 AI</b>: ${esc(o.recheck || '가장 먼저 지켜야 할 것은 무엇일까요?')}</p>`;
          announce(box.textContent); return;
        }
        decided = true; store(); render(); showResult(true);
        announce('우리 모둠 규칙 순서를 정했어요.');
      });
      const redo = el.querySelector('[data-redo]');
      if (redo) redo.addEventListener('click', () => { decided = false; store(); render(); });
    }
    render();
  }

  window.Widgets.register('rule-rank', ruleRank);
})();
