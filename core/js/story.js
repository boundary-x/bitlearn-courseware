/* 스토리 컷 쪽 type: 'story'(비트런 시리즈 C2 — planning/bitrun/40-core-brief.md, 칸 규격 41-core-impl.md)
 * 웹툰·그림책처럼 컷을 한 장씩 넘긴다. 말풍선은 그림 위에 % 좌표로 얹고(글은 HTML — 그림에 굽지 않음), 좁은 화면(≤600px)에서는 그림 아래에 차례로 쌓는다.
 * 넘기기: [이전]·[다음] 단추, 점 표시, 키보드 ←→(스토리 안에서, 그리고 app.js가 Story.handleNav로 쪽 넘기기보다 먼저), 스와이프. 말풍선은 차례로 나타남(움직임 줄이기 존중).
 * 마지막 컷 뒤 ending(선택): { kind: 'next'|'choice'|'vote', q, options[], reasonPh, minReason, note } → 학생 결정·윤리 투표. 'next'는 다음 이야기 예고 한 줄.
 * 완료 = 마지막 컷까지 봄 (+ ending이 choice·vote면 답함) → ctx.finish()(app.js가 쪽 완료 = 진행 칸 1칸). 선택·투표 답은 ctx.setData({ choice, reason })로 결과 카드에.
 * page: { type: 'story', id, section, title, cuts: [{ img?, alt, caption?, bubbles?: [{ who, text, x, y, tail?: 'left'|'right'|'up'|'down'|'none', w? }] }], ending?, widget?, widgetOpts? }
 * 등장인물: LESSON.characters = { 키: { name, color, avatar? } } (시리즈 프리셋에 기본값). 말풍선 who가 없는 인물이면 who 글자를 이름으로 쓴다. */
window.Story = (() => {
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const reduce = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const clampPct = (v, d) => (typeof v === 'number' && isFinite(v) ? Math.max(0, Math.min(100, v)) : d);
  let cur = null; // 지금 화면의 스토리(쪽 넘기기 키를 먼저 받음)

  function bubbleHTML(b, chars, i) {
    const c = (chars || {})[b.who] || { name: b.who || '', color: '' };
    const tail = ['left', 'right', 'up', 'down', 'none'].includes(b.tail) ? b.tail : 'down';
    const x = clampPct(b.x, 50), y = clampPct(b.y, 15);
    // 가로 위치에 따라 기준점을 바꿔 그림 밖으로 나가지 않게(왼쪽 30% 안 = 왼쪽 맞춤, 오른쪽 70% 밖 = 오른쪽 맞춤)
    const ax = x < 30 ? 'l' : x > 70 ? 'r' : 'c';
    const face = c.avatar ? `<img class="st-face" src="${esc(c.avatar)}" alt="" aria-hidden="true">` : `<span class="st-face st-init" aria-hidden="true">${esc(Array.from(String(c.name || '?'))[0] || '?')}</span>`;
    return `<div class="st-bub t-${tail} ax-${ax}${c.narr ? ' narr' : ''}" style="--x:${x}%;--y:${y}%;--d:${i};${c.color ? `--who:${esc(c.color)};` : ''}${b.w ? `--w:${Math.max(20, Math.min(70, +b.w))}%;` : ''}">
      ${c.name && !c.narr ? `<b class="st-who">${face}${esc(c.name)}</b>` : ''}<span class="st-say">${b.text || ''}</span></div>`;
  }
  function cutHTML(cut, i, n, chars) {
    const bubs = (cut.bubbles || []).filter((b) => b && b.text);
    return `<figure class="st-cut" data-cut="${i}" aria-roledescription="컷" aria-label="${n}컷 중 ${i + 1}번째"${i ? ' hidden' : ''}>
      <div class="st-pic${cut.img ? '' : ' no-img'}">${cut.img ? `<img src="${esc(cut.img)}" alt="${esc(cut.alt || '')}" decoding="async"${i > 1 ? ' loading="lazy"' : ''}>` : `<p class="st-alt">${esc(cut.alt || '')}</p>`}
        ${bubs.length ? `<div class="st-bubs">${bubs.map((b, k) => bubbleHTML(b, chars, k)).join('')}</div>` : ''}</div>
      ${cut.caption ? `<figcaption class="st-cap">${cut.caption}</figcaption>` : ''}
    </figure>`;
  }
  // K12 칸 채우기: 칸마다 보기(그림 스티커) 하나 또는 짧은 글(최대 8자)
  function slotsHTML(e, saved, rc) {
    const got = saved.slots || [];
    return `<div class="st-end st-slots"><p class="st-end-tag">내가 정해요</p>${rc || ''}<p class="st-end-q" id="stq">${esc(e.q || '')}</p>
      <div class="st-slotlist">${(e.slots || []).map((s, si) => { const g = got[si] || {}; return `<fieldset class="st-slot" data-slot="${si}"><legend>${esc(s.label || `${si + 1}번 칸`)}</legend>
        ${(s.options || []).length ? `<div class="st-sopts" role="radiogroup" aria-label="${esc(s.label || '')}">${s.options.map((o, oi) => `<button type="button" class="st-sopt" role="radio" data-slot="${si}" data-o="${oi}" aria-checked="${g.o === oi}" tabindex="${(g.o == null ? oi === 0 : g.o === oi) ? 0 : -1}">${o.img ? `<img src="${esc(o.img)}" alt="${esc(o.alt || '')}">` : ''}<span>${esc(o.label || '')}</span></button>`).join('')}</div>` : ''}
        ${s.input ? `<label class="field st-sin"><span class="sr">${esc(s.label || '')} 직접 적기</span><input data-slot-in="${si}" maxlength="${Math.max(1, Math.min(20, s.max || 8))}" autocomplete="off" placeholder="${esc(s.ph || '직접 적기')}" value="${esc(g.text || '')}"></label>` : ''}</fieldset>`; }).join('')}</div>
      ${e.reasonPh || e.minReason ? `<label class="field st-why"><span>까닭${e.minReason ? '' : ' (선택)'}</span><textarea rows="2" maxlength="300" placeholder="${esc(e.reasonPh || '왜 그렇게 정했는지 적어요.')}">${esc(saved.reason || '')}</textarea></label>` : ''}
      <p class="st-end-act"><button type="button" class="btn primary" data-decide>이렇게 정하기</button></p>
      <p class="st-end-note fine" data-end-note>${got.length ? '저장한 내 결정이 있어요. 바꿔도 돼요.' : esc(e.note || '칸을 모두 채우면 [이렇게 정하기]를 눌러요.')}</p></div>`;
  }
  /* ★K11 나의 결정 다시 보기(70-gap-meeting 3): ending.recall = { from?(차시 id, 없으면 이 차시), page(그 차시 스토리 쪽 id), options?[](그때 보기 글 — 번호를 글로), label? }
   * ctx.recall(from, page)가 그 쪽 저장분(choice·reason 또는 slots)을 읽기만 해서 한 줄로. 못 찾으면(다른 기기·지움·교사) 빈 글 → 지금 화면 그대로 */
  function recallHTML(e, ctx) {
    const r = e && e.recall; if (!r || !r.page || !ctx || typeof ctx.recall !== 'function') return '';
    const d = ctx.recall(r.from || null, r.page); if (!d) return '';
    let pick = '';
    if (d.choice != null && Array.isArray(r.options) && r.options[d.choice] != null) pick = String(r.options[d.choice]);
    else if (Array.isArray(d.slots)) pick = d.slots.filter(Boolean).map((v) => v.text || v.label || '').filter(Boolean).join(' · ');
    if (!pick) return '';
    const why = String(d.reason || '').trim();
    return `<p class="st-recall" data-recall><b>${esc(r.label || '그때 우리가 고른 답')}</b> <span>${esc(pick)}</span>${why ? `<span class="st-recall-why"> · 까닭: ${esc(why)}</span>` : ''}</p>`;
  }
  function endingHTML(e, saved, teacher, rc) {
    const k = e.kind || 'next';
    if (k === 'slots') return slotsHTML(e, saved, rc);
    if (k === 'next') return `<div class="st-end st-next">${rc || ''}<p class="st-end-q">${e.q ? esc(e.q) : '다음 이야기가 이어져요.'}</p></div>`;
    const opts = e.options || [];
    return `<div class="st-end st-${k}"><p class="st-end-tag">${k === 'vote' ? '우리 모둠 투표' : '내가 정해요'}</p>${rc || ''}<p class="st-end-q" id="stq">${esc(e.q || '')}</p>
      <div class="st-opts" role="radiogroup" aria-labelledby="stq">${opts.map((t, i) => `<button type="button" class="st-opt" role="radio" data-k="${i}" aria-checked="${saved.choice === i}" tabindex="${(saved.choice == null ? i === 0 : saved.choice === i) ? 0 : -1}">${esc(t)}${teacher && k === 'vote' ? `<span class="st-tally" data-tally="${i}" aria-label="손 든 수">0</span>` : ''}</button>`).join('')}</div>
      ${e.reasonPh || e.minReason ? `<label class="field st-why"><span>까닭${e.minReason ? '' : ' (선택)'}</span><textarea rows="2" maxlength="300" placeholder="${esc(e.reasonPh || '왜 그렇게 정했는지 적어요.')}">${esc(saved.reason || '')}</textarea></label>` : ''}
      <p class="st-end-act"><button type="button" class="btn primary" data-decide>${k === 'vote' ? '한 표 던지기' : '이렇게 정하기'}</button>${teacher && k === 'vote' ? ' <span class="fine">선생님: 보기를 누를 때마다 손 든 수를 셀 수 있어요(저장되지 않음).</span>' : ''}</p>
      <p class="st-end-note fine" data-end-note>${saved.choice != null ? `내가 고른 답: ${esc(opts[saved.choice] || '')}` : esc(e.note || (k === 'vote' ? '정답은 없어요. 모둠과 이야기한 뒤 한 표를 던져요.' : '정답은 없어요. 내 생각대로 골라요.'))}</p></div>`;
  }

  /* app.js가 부른다: mount(root, page, ctx). ctx = { characters, isDone, data(), setData(o), finish() → 처음 완료면 true, announce, say, teacher, present, recall(lessonId, pageId) → 저장분 | null } */
  function mount(root, p, ctx) {
    const cuts = (p.cuts || []).filter(Boolean), e = p.ending || null;
    const hasEnd = !!e && (['choice', 'vote', 'next', 'slots'].includes(e.kind) || !e.kind);
    const N = cuts.length + (hasEnd ? 1 : 0);
    const saved = Object.assign({}, ctx.data() || {});
    let i = 0, max = ctx.isDone ? N - 1 : Math.min(N - 1, saved.max || 0);
    const tally = {};
    root.innerHTML = `<section class="story-view" aria-roledescription="이야기" aria-label="${esc(p.title)}" tabindex="-1">
      <div class="st-stage" data-stage>${cuts.map((c, k) => cutHTML(c, k, cuts.length, ctx.characters)).join('')}
        ${hasEnd ? `<div class="st-cut st-end-cut" data-cut="${cuts.length}" hidden>${endingHTML(e, saved, ctx.teacher, recallHTML(e, ctx))}</div>` : ''}</div>
      <nav class="st-nav" aria-label="컷 넘기기">
        <button type="button" class="btn" data-st="prev">이전 컷</button>
        <div class="st-dots">${Array.from({ length: N }, (_, k) => `<button type="button" class="st-dot${hasEnd && k === N - 1 ? ' end' : ''}" data-go="${k}" aria-label="${hasEnd && k === N - 1 ? '마지막: 결정' : `${k + 1}번째 컷`}"></button>`).join('')}</div>
        <span class="st-count" aria-hidden="true"></span>
        <button type="button" class="btn primary" data-st="next">다음 컷</button>
      </nav>
      <p class="sr" data-st-live aria-live="polite"></p>
    </section>`;
    const sec = root.querySelector('.story-view'), live = root.querySelector('[data-st-live]');
    const needAnswer = hasEnd && (e.kind === 'choice' || e.kind === 'vote' || e.kind === 'slots');
    const isFinished = () => max >= N - 1 && (!needAnswer || saved.choice != null || (e.kind === 'slots' && Array.isArray(saved.slots)));
    const tryFinish = () => { if (isFinished() && ctx.finish) { const lit = ctx.finish(); if (lit) ctx.announce(`이야기를 끝까지 봤어요. ${ctx.say || ''} 켜졌어요.`); } };
    function show(k, focus) {
      i = Math.max(0, Math.min(N - 1, k));
      if (i > max) { max = i; ctx.setData({ max }); }
      root.querySelectorAll('[data-cut]').forEach((c) => {
        const on = +c.dataset.cut === i;
        c.hidden = !on;
        if (on) { c.classList.remove('in'); void c.offsetWidth; c.classList.add('in'); }
      });
      root.querySelectorAll('.st-dot').forEach((d) => {
        const k2 = +d.dataset.go;
        d.classList.toggle('on', k2 === i); d.classList.toggle('seen', k2 <= max);
        d.disabled = k2 > max + 1; if (k2 === i) d.setAttribute('aria-current', 'step'); else d.removeAttribute('aria-current');
      });
      const atEnd = hasEnd && i === N - 1;
      root.querySelector('.st-count').textContent = atEnd ? '결정' : `${i + 1} / ${cuts.length}`;
      root.querySelector('[data-st="prev"]').disabled = i === 0;
      const nb = root.querySelector('[data-st="next"]');
      nb.disabled = i === N - 1;
      nb.textContent = hasEnd && i === N - 2 ? (e.kind === 'next' ? '마지막 컷' : '결정하러 가기') : '다음 컷';
      const c = cuts[i];
      live.textContent = atEnd ? `마지막: ${e.q || '다음 이야기'}` : `${cuts.length}컷 중 ${i + 1}번째. ${c.alt || ''} ${String(c.caption || '').replace(/<[^>]+>/g, '')} ${(c.bubbles || []).map((b) => `${((ctx.characters || {})[b.who] || {}).name || b.who || ''}: ${String(b.text || '').replace(/<[^>]+>/g, '')}`).join(' ')}`.trim();
      if (focus) sec.focus({ preventScroll: true });
      tryFinish();
    }
    root.querySelector('[data-st="prev"]').addEventListener('click', () => show(i - 1));
    root.querySelector('[data-st="next"]').addEventListener('click', () => show(i + 1));
    root.querySelectorAll('.st-dot').forEach((d) => d.addEventListener('click', () => show(+d.dataset.go)));
    // 스토리 안 ←→ = 컷 넘기기(입력 칸·보기 묶음 안에서는 그대로). 끝에서는 막지 않아 app.js가 쪽을 넘긴다
    sec.addEventListener('keydown', (ev) => {
      if (ev.target.closest('input, textarea, [role="radiogroup"]')) return;
      const d = ev.key === 'ArrowRight' ? 1 : ev.key === 'ArrowLeft' ? -1 : 0; if (!d) return;
      if ((d > 0 && i < N - 1) || (d < 0 && i > 0)) { ev.preventDefault(); show(i + d); }
    });
    // 스와이프(터치·펜): 가로로 50px 넘게 밀면 넘김. 세로 스크롤은 막지 않음(touch-action: pan-y)
    const stage = root.querySelector('[data-stage]'); let sx = null, sy = null;
    stage.addEventListener('pointerdown', (ev) => { if (ev.pointerType === 'mouse') return; sx = ev.clientX; sy = ev.clientY; });
    stage.addEventListener('pointerup', (ev) => { if (sx == null) return; const dx = ev.clientX - sx, dy = ev.clientY - sy; sx = null; if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) show(i + (dx < 0 ? 1 : -1)); });
    stage.addEventListener('pointercancel', () => { sx = null; });
    // 결정·투표
    if (needAnswer && e.kind === 'slots') {
      const box = root.querySelector('.st-end'), note = box.querySelector('[data-end-note]'), ta = box.querySelector('textarea');
      const pick = (saved.slots || []).map((g) => (g && g.o != null ? g.o : null));
      const sync = (si) => box.querySelectorAll(`.st-sopt[data-slot="${si}"]`).forEach((b) => { const on = +b.dataset.o === pick[si]; b.setAttribute('aria-checked', String(on)); b.tabIndex = on || (pick[si] == null && +b.dataset.o === 0) ? 0 : -1; });
      box.querySelectorAll('.st-sopt').forEach((b) => {
        b.addEventListener('click', () => {
          const si = +b.dataset.slot, oi = +b.dataset.o;
          const keyOf = (s, o) => { const x = (s.options || [])[o] || {}; return x.id != null ? String(x.id) : String(x.label || x.alt || o); };
          if (e.unique || e.distinct) (e.slots || []).forEach((s, sj) => { if (sj !== si && pick[sj] != null && keyOf(s, pick[sj]) === keyOf(e.slots[si], oi)) { pick[sj] = null; sync(sj); } }); // 같은 스티커는 한 칸에만
          pick[si] = oi; sync(si); const inp = box.querySelector(`[data-slot-in="${si}"]`); if (inp) inp.value = '';
        });
        b.addEventListener('keydown', (ev) => { const d = ['ArrowDown', 'ArrowRight'].includes(ev.key) ? 1 : ['ArrowUp', 'ArrowLeft'].includes(ev.key) ? -1 : 0; if (!d) return; ev.preventDefault(); const si = +b.dataset.slot, n = (e.slots[si].options || []).length; const nx = (((pick[si] == null ? +b.dataset.o : pick[si]) + d) % n + n) % n; const nb2 = box.querySelector(`.st-sopt[data-slot="${si}"][data-o="${nx}"]`); if (nb2) { nb2.click(); nb2.focus(); } });
      });
      box.querySelectorAll('[data-slot-in]').forEach((inp) => inp.addEventListener('input', () => { const si = +inp.dataset.slotIn; if (inp.value.trim()) { pick[si] = null; sync(si); } }));
      box.querySelector('[data-decide]').addEventListener('click', () => {
        const vals = (e.slots || []).map((s, si) => { const inp = box.querySelector(`[data-slot-in="${si}"]`), tx = inp ? inp.value.trim() : ''; if (tx) return { text: tx }; if (pick[si] != null) { const o = (s.options || [])[pick[si]] || {}; return { o: pick[si], id: o.id, label: o.label || o.alt || '' }; } return null; });
        const empty = vals.findIndex((v) => !v);
        if (empty >= 0) { note.textContent = `「${(e.slots[empty] || {}).label || `${empty + 1}번 칸`}」 칸을 채워요.`; ctx.announce(note.textContent); const f = box.querySelector(`[data-slot="${empty}"] button, [data-slot-in="${empty}"]`); if (f) f.focus(); return; }
        // ★distinct(70-gap-meeting 1): 스티커든 직접 적은 글이든 같은 이름이 두 칸에 있으면 막음(띄어쓰기·대소문자 무시)
        if (e.distinct) {
          const nm = (v) => String(v.text || v.label || '').replace(/\s+/g, '').toLowerCase();
          const dup = vals.findIndex((v, si) => vals.findIndex((w) => nm(w) === nm(v)) !== si);
          if (dup >= 0) { const first = vals.findIndex((w) => nm(w) === nm(vals[dup])); note.textContent = `「${(e.slots[first] || {}).label || `${first + 1}번`}」 칸과 「${(e.slots[dup] || {}).label || `${dup + 1}번`}」 칸의 이름이 같아요(${vals[dup].text || vals[dup].label}). 친구가 헷갈리지 않게 다른 이름을 지어요.`; ctx.announce(note.textContent); const f = box.querySelector(`[data-slot-in="${dup}"]`) || box.querySelector(`[data-slot="${dup}"] button`); if (f) f.focus(); return; }
        }
        const rs = ta ? ta.value.trim() : '';
        if (e.minReason && rs.length < e.minReason) { note.textContent = `까닭을 ${e.minReason}자 이상 적어요(지금 ${rs.length}자).`; ctx.announce(note.textContent); ta.focus(); return; }
        saved.slots = vals; saved.reason = rs;
        ctx.setData({ slots: vals, reason: rs, at: Date.now() });
        note.textContent = `내 결정을 저장했어요: ${vals.map((v, si) => `${(e.slots[si] || {}).label || ''} ${v.text || v.label}`).join(' · ')}`;
        ctx.announce(note.textContent);
        tryFinish();
      });
    } else if (needAnswer) {
      const box = root.querySelector('.st-end'); let pick = saved.choice != null ? saved.choice : null;
      const ta = box.querySelector('textarea'), note = box.querySelector('[data-end-note]');
      const choose = (k, focus) => { pick = k; box.querySelectorAll('.st-opt').forEach((b) => { const on = +b.dataset.k === k; b.setAttribute('aria-checked', String(on)); b.tabIndex = on ? 0 : -1; if (on && focus) b.focus(); }); };
      box.querySelectorAll('.st-opt').forEach((b) => {
        b.addEventListener('click', () => {
          choose(+b.dataset.k);
          if (ctx.teacher && e.kind === 'vote') { const k = +b.dataset.k; tally[k] = (tally[k] || 0) + 1; const t = b.querySelector('[data-tally]'); if (t) t.textContent = tally[k]; }
        });
        b.addEventListener('keydown', (ev) => { const d = ['ArrowDown', 'ArrowRight'].includes(ev.key) ? 1 : ['ArrowUp', 'ArrowLeft'].includes(ev.key) ? -1 : 0; if (!d) return; ev.preventDefault(); const n = (e.options || []).length; choose(((pick == null ? +b.dataset.k : pick) + d + n) % n, true); });
      });
      box.querySelector('[data-decide]').addEventListener('click', () => {
        if (pick == null) { note.textContent = '먼저 하나를 골라요.'; ctx.announce('먼저 하나를 골라요.'); box.querySelector('.st-opt').focus(); return; }
        const r = ta ? ta.value.trim() : '';
        if (e.minReason && r.length < e.minReason) { note.textContent = `까닭을 ${e.minReason}자 이상 적어요(지금 ${r.length}자).`; ctx.announce(note.textContent); ta.focus(); return; }
        saved.choice = pick; saved.reason = r;
        ctx.setData({ choice: pick, reason: r, at: Date.now() });
        note.textContent = `내가 고른 답: ${(e.options || [])[pick] || ''}. 저장했어요.`;
        ctx.announce(note.textContent);
        tryFinish();
      });
    }
    cur = { root, sec, nav: (d) => { if ((d > 0 && i < N - 1) || (d < 0 && i > 0)) { show(i + d, true); return true; } return false; } };
    show(0);
  }
  // app.js 키보드 넘기기가 먼저 묻는다: 화면에 스토리가 있고 넘길 컷이 남았으면 컷을 넘기고 true
  function handleNav(dir) { if (!cur || !cur.root.isConnected || !cur.sec.offsetParent) return false; return cur.nav(dir); }
  return { mount, handleNav, reduce };
})();
