/* 복습: 4지선다 퀴즈 + 코드 순서 맞추기
 * UI/UX 5차(구현 B): 결과 LED = 진행 LED(같은 그림은 같은 뜻), "통과까지 N개", 틀린 문제 다시 보기,
 * 정답·오답을 색만이 아니라 기호·글자로, 화면 낭독기 알림·초점 이동, 끌기는 손잡이에서만(터치 스크롤 허용)
 * 9차 D18: state.quiz = { best, last, at, first?, firstAt?, tries? } — first·firstAt은 이 판이 처음일 때만(옛 기록은 없음),
 *   tries = 끝까지 푼 판 수(옛 기록은 1판 한 것으로 보고 이어 셈). 통과 LED는 지금처럼 best 기준.
 *   state.order = { done, at?, tries } — tries = 처음 완료할 때까지 [순서 확인]을 누른 수(완료 뒤 다시 하면 늘지 않음).
 *   출제: 학생이 본 단원(이론 확인 문제를 푼 페이지 state.seen + 미션을 하나라도 한 실습)의 문항을 먼저, 모자라면 나머지에서.
 *   심화 문항(q.level === 'adv')은 한 판에 L.quizAdvPerRound개(기본 1)만 — 본 단원에서 먼저. */
window.Review = (() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const App = () => window.App || {};
  const say = (t) => { const a = App().announce; if (typeof a === 'function') a(t); };
  const isStudent = () => document.body.classList.contains('student');
  const meLink = () => (isStudent() ? '<a class="btn" href="#/me">내 결과 카드 보기</a>' : '');
  // 진행 표시 이름(페르소나 2회차 1·2차시 #3): 차시 L.progressWord(기본 'LED'). 3~4는 'LED' 그대로
  const PWd = () => String((window.LESSON && window.LESSON.progressWord) || 'LED');
  const PWiga = () => { const w = PWd(), c = w.charCodeAt(w.length - 1); return w + (c >= 0xAC00 && c <= 0xD7A3 && (c - 0xAC00) % 28 ? '이' : '가'); };
  // 순서 맞추기 고정 글: 실습 없는 차시(실습 쪽 0개)는 '코드·블록' 대신 '카드·차례'(페르소나 2회차 2차시). 실습 차시는 예전 그대로
  const W = (L) => (!(L.pages || []).some((p) => p.type === 'lab')
    ? { game: '차례 맞추기', unit: '문제', next: '다음 문제', unused: '쓰지 않는 카드', need: '꼭 필요한 카드', done: '차례를 정확히 이해했어요.' }
    : { game: '코드 순서 맞추기', unit: '코드', next: '다음 코드', unused: '쓰지 않는 블록', need: '꼭 필요한 블록', done: '코드 흐름을 정확히 이해했어요.' });
  const roundN = (L) => Math.min(L.quizPerRound || 10, L.quiz.length);
  const needOf = (n) => Math.ceil(n * 0.6);
  // 보기 옆 화면 낭독기용 글자(정답·오답을 색으로만 알리지 않게)
  const mark = (btn, t) => { if (!btn.querySelector('.sr')) btn.insertAdjacentHTML('beforeend', `<span class="sr"> (${t})</span>`); };

  function view(L, state, opt = {}) {
    const n = roundN(L), need = needOf(n);
    const qPass = !!(state.quiz && state.quiz.best >= need), oDone = !!(state.order && state.order.done);
    const qz = state.quiz;
    const best = qz ? `${qz.first != null ? `첫 시도 ${qz.first} · ` : ''}최고 기록 ${qz.best} / ${n}${qz.tries ? ` · ${qz.tries}번 도전` : ''}` : '아직 도전 전';
    const oTries = state.order && state.order.tries;
    return `<div class="page">
      ${opt.where || '<span class="section-tag">정리</span>'}
      <h1>복습 게임</h1>
      <p>오늘 배운 내용을 게임으로 확인해요. 게임을 통과하면 ${App().esc(PWiga())} 2칸씩 켜져요.</p>
      <div class="review-pick" id="reviewPick">${(L.quiz || []).length ? `
        <button class="game-card" data-game="quiz">
          <div class="art">${quizArt()}</div>
          <h3>${App().esc(L.quizTitle || '복습 퀴즈')} <span class="game-reward${qPass ? ' ok' : ''}">${qPass ? '✓ 통과' : `${App().esc(PWd())} 2칸`}</span></h3><p>${n}문제, ${need}개 이상 맞히면 통과 · ${best}</p>
        </button>` : ''}${(L.order || []).length ? `
        <button class="game-card" data-game="order">
          <div class="art">${orderArt()}</div>
          <h3>${W(L).game} <span class="game-reward${oDone ? ' ok' : ''}">${oDone ? '✓ 완료' : `${App().esc(PWd())} 2칸`}</span></h3><p>${W(L).unit} ${L.order.length}개 · ${oDone ? `완료${oTries ? ` · 확인 ${oTries}번` : ''}` : (oTries ? `확인 ${oTries}번 · 진행 중` : '아직 도전 전')}</p>
        </button>` : ''}
      </div>
      <div id="gameArea"></div>
    </div>`;
  }

  const quizArt = () => `<svg width="120" height="70" viewBox="0 0 120 70" aria-hidden="true"><rect x="6" y="8" width="50" height="24" rx="8" fill="#2F6BDB"/><rect x="64" y="8" width="50" height="24" rx="8" fill="#fff" stroke="#2F6BDB" stroke-width="2"/><rect x="6" y="38" width="50" height="24" rx="8" fill="#fff" stroke="#2F6BDB" stroke-width="2"/><rect x="64" y="38" width="50" height="24" rx="8" fill="#fff" stroke="#2F6BDB" stroke-width="2"/><path d="M22 20l6 6 10-12" stroke="#fff" stroke-width="4" fill="none" stroke-linecap="round"/></svg>`;
  const orderArt = () => `<svg width="120" height="76" viewBox="0 0 120 76" aria-hidden="true"><rect x="14" y="4" width="80" height="18" rx="5" fill="#1E9BD7"/><rect x="24" y="28" width="80" height="18" rx="5" fill="#E0A400"/><rect x="24" y="52" width="70" height="18" rx="5" fill="#17A673"/><rect x="14" y="22" width="10" height="48" fill="#1E9BD7"/></svg>`;

  function bind(root, L, state, save) {
    root.querySelectorAll('[data-game]').forEach((b) => b.addEventListener('click', () => {
      $('#reviewPick').hidden = true;
      if (b.dataset.game === 'quiz') runQuiz($('#gameArea'), L, state, save);
      else runOrder($('#gameArea'), L, state, save, 0);
    }));
  }

  const back = () => `<button class="btn ghost small" data-back>게임 목록으로</button>`;
  function bindBack(area) {
    area.querySelectorAll('[data-back]').forEach((b) => b.addEventListener('click', () => { area.innerHTML = ''; $('#reviewPick').hidden = false; window.dispatchEvent(new HashChangeEvent('hashchange')); }));
  }
  const focusEl = (el) => { if (!el) return; el.focus({ preventScroll: false }); };

  /* ---------- 퀴즈 ---------- */
  function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

  // 학생이 본 단원(이론 확인 문제를 푼 페이지, 미션을 하나라도 한 실습)의 section 모음. 아무것도 없으면 빈 집합(= 전체에서 출제)
  function seenSections(L, state) {
    const out = new Set();
    (L.pages || []).forEach((p) => {
      if (p.type === 'lab') { if ((p.missions || []).some((m) => state.missions && state.missions[m.id])) out.add(p.section); }
      else if (state.seen && state.seen[p.id]) out.add(p.section);
    });
    return out;
  }
  // 한 판 문항 고르기: 심화(adv)는 quizAdvPerRound개까지(본 단원 먼저) → 본 단원 기본 문항 → 나머지 기본 문항 → 남은 심화
  function pickQuestions(L, state) {
    const n = roundN(L);
    const secOf = {}; (L.pages || []).forEach((p) => { secOf[p.id] = p.section; });
    const seen = seenSections(L, state);
    const inSeen = (q) => !seen.size || !q.page || seen.has(secOf[q.page]);
    const adv = (q) => q.level === 'adv';
    const advN = Math.max(0, Math.min(n, L.quizAdvPerRound == null ? 1 : L.quizAdvPerRound));
    const pickAdv = shuffle(L.quiz.filter((q) => adv(q) && inSeen(q))).slice(0, advN);
    const pool = [
      ...shuffle(L.quiz.filter((q) => !adv(q) && inSeen(q))),
      ...shuffle(L.quiz.filter((q) => !adv(q) && !inSeen(q))),
      ...shuffle(L.quiz.filter((q) => adv(q) && !pickAdv.includes(q))),
    ];
    return shuffle(pickAdv.concat(pool.slice(0, n - pickAdv.length)));
  }

  function runQuiz(area, L, state, save) {
    const esc = App().esc;
    const qs = pickQuestions(L, state).map((q) => {
      const opts = shuffle(q.options.map((o, k) => ({ o, ok: k === q.answer })));
      return { ...q, opts };
    });
    let i = 0, score = 0, streak = 0;
    const wrong = [];
    const draw = () => {
      if (i >= qs.length) return finish();
      const q = qs[i];
      area.innerHTML = `<div class="quiz">
        <div class="quiz-head">${back()}<div class="quiz-bar" aria-hidden="true"><span style="width:${(i / qs.length) * 100}%"></span></div><b>${i + 1} / ${qs.length}</b></div>
        <div class="q-card">
          ${q.img ? `<img src="${esc(q.img)}" alt="${esc(q.alt || '')}" data-zoom tabindex="0" role="button">${q.credit ? `<small class="credit">출처: ${esc(q.credit)}</small>` : ''}` : ''}
          ${q.level === 'adv' ? '<p class="fine q-level">심화 문제</p>' : ''}<h2 class="q" tabindex="-1"><span class="sr">${i + 1}번 문제. ${q.level === 'adv' ? '심화. ' : ''}</span>${esc(q.q)}</h2>
          <div class="options">${q.opts.map((o, k) => `<button class="option" data-k="${k}">${esc(o.o)}</button>`).join('')}</div>
          <div class="explain" hidden></div>
          <p style="margin:14px 0 0;text-align:right"><button class="btn primary" data-next hidden>${i + 1 < qs.length ? '다음 문제' : '결과 보기'}</button></p>
        </div></div>`;
      bindBack(area);
      // 새 문제로 초점(화면 낭독기가 문제를 읽고, 초점이 BODY로 사라지지 않게)
      focusEl($('.q', area));
      area.querySelectorAll('.option').forEach((b) => b.addEventListener('click', () => {
        const pick = q.opts[+b.dataset.k];
        const ans = q.opts.find((o) => o.ok);
        area.querySelectorAll('.option').forEach((x) => { x.disabled = true; if (q.opts[+x.dataset.k].ok) { x.classList.add('correct'); mark(x, '정답'); } });
        if (pick.ok) { score++; streak++; } else { b.classList.add('wrong'); mark(b, '내가 고른 답, 틀렸어요'); streak = 0; wrong.push({ q, pick: pick.o, ans: ans ? ans.o : '' }); }
        const ex = $('.explain', area); ex.hidden = false;
        ex.innerHTML = `${pick.ok ? (streak >= 3 ? `<b>${streak}연속 정답!</b> ` : '<b>정답!</b> ') : '<b>이렇게 기억해요.</b> '}${esc(q.explain || '')}`;
        const nx = $('[data-next]', area); nx.hidden = false; nx.focus();
        say(pick.ok ? `정답! ${q.explain || ''}` : `아쉬워요. 정답은 ${ans ? ans.o : ''}. ${q.explain || ''}`);
        nx.addEventListener('click', () => { i++; draw(); });
      }));
    };
    const finish = () => {
      const prev = state.quiz;
      const prevBest = prev ? prev.best || 0 : 0;
      const need = needOf(qs.length), passed = score >= need, wasPassed = prevBest >= need;
      const now = Date.now();
      // 옛 기록(best·last·at)은 그대로 두고 키만 더한다. 첫 시도는 이 판이 처음일 때만 적는다(옛 기록이 있으면 모름 → 비움)
      const rec = Object.assign({}, prev || {}, { best: Math.max(prevBest, score), last: score, at: now, tries: prev ? (prev.tries || 1) + 1 : 1 });
      if (!prev) { rec.first = score; rec.firstAt = now; }
      state.quiz = rec;
      save();
      // 결과 LED는 점수 비율이 아니라 진짜 진행 LED(상단 LED와 같은 그림 = 같은 뜻)
      const led = App().ledPattern ? App().ledPattern() : null;
      const perfect = score === qs.length;
      let msg;
      if (perfect) msg = `${qs.length}문제 모두 정답이에요. 오늘 배운 내용을 정확히 이해했어요.${wasPassed ? '' : ` ${PWd()} 2칸이 켜졌어요.`}`;
      else if (passed) msg = `${wasPassed ? '이번에도 통과예요!' : `통과! ${PWd()} 2칸이 켜졌어요.`}${wrong.length ? ` 아래에서 틀린 ${wrong.length}문제를 확인하면 완벽해요.` : ''}`;
      else if (wasPassed) msg = `이번에는 ${score}개 맞혔어요. 최고 기록 ${state.quiz.best}개로 이미 통과했어요. 틀린 문제를 보고 다시 도전해 봐요.`;
      else msg = `<b>${need - score}개</b>만 더 맞히면 통과예요. 아래에서 틀린 문제를 보고 다시 도전해요!`;
      const review = wrong.length ? `<details class="quiz-review"${passed ? '' : ' open'}><summary>틀린 문제 ${wrong.length}개 다시 보기</summary><ol>${wrong.map((w) => `<li><p class="qr-q">${esc(w.q.q)}</p><p class="qr-a">내 답 <s>${esc(w.pick)}</s> → 정답 <b>${esc(w.ans)}</b></p>${w.q.explain ? `<p class="qr-ex">${esc(w.q.explain)}</p>` : ''}</li>`).join('')}</ol></details>` : '';
      area.innerHTML = `<div class="quiz"><div class="q-card result">
        ${App().art(passed ? 'win' : 'charge', 'quiz-mascot')}${led ? App().matrixHTML(led.cells, true) : ''}
        ${led ? `<p class="quiz-led-note">내 LED ${led.lit} / 25칸</p>` : ''}
        <div class="score" tabindex="-1"><span class="sr">${qs.length}문제 중 </span>${score} / ${qs.length}</div>
        <p>${msg}</p>
        ${review}
        <p class="quiz-actions"><button class="btn primary" data-retry>새 문제로 다시 도전</button> ${back()} ${meLink()}</p>
      </div></div>`;
      bindBack(area);
      $('[data-retry]', area).addEventListener('click', () => runQuiz(area, L, state, save));
      focusEl($('.score', area));
      say(`${qs.length}문제 중 ${score}개 맞혔어요. ${msg}`);
    };
    draw();
  }

  /* ---------- 순서 맞추기 ---------- */
  /* 설계 개정 2: set.extra = 쓰지 않는 블록(줄마다 [빼기]로 아래 '쓰지 않는 블록' 칸에 둠, 정답 = 단계만 차례대로 + 쓰지 않는 블록은 모두 뺌)
   *  글 안 '{rec.키|기본}'은 학생 측정 기록으로 보여 줌(App().recText). extra가 없으면 예전 그대로 */
  function runOrder(area, L, state, save, n) {
    const esc = App().esc;
    const T = (s) => (App().recText ? App().recText(s) : s);
    const set = L.order[n];
    const extras = Array.isArray(set.extra) ? set.extra : [];
    let items = shuffle(set.steps.map((s, k) => ({ ...s, k })).concat(extras.map((s, k) => ({ ...s, k: -1 - k, extra: true }))));
    if (items.every((it, idx) => set.steps[idx] && it.text === set.steps[idx].text)) items.reverse();
    let outs = []; // [빼기]로 뺀 줄
    let focusAfter = null; // ▲▼로 옮긴 뒤 같은 줄의 같은 버튼으로 초점을 돌려준다
    const draw = (checked) => {
      area.innerHTML = `<div class="quiz">
        <div class="quiz-head">${back()}<b>${n + 1} / ${L.order.length}</b></div>
        <div class="q-card">
          <h2 class="q" tabindex="-1">${esc(set.title)}</h2>
          <p>${esc(T(set.goal))}</p>
          <ol class="order-list">${items.map((it, idx) => {
            const right = checked && !it.extra && set.steps[idx] && it.text === set.steps[idx].text;
            return `<li class="order-item ${checked ? (right ? 'right' : 'off') : ''}" data-idx="${idx}">
            <span class="grip" aria-hidden="true" title="끌어서 옮기기">⠿</span>
            <span class="txt">${it.cat ? `<span class="drawer-chip"><i style="background:${it.color || '#5C68A6'}"></i>${esc(it.cat)}</span> ` : ''}${esc(T(it.text))}</span>
            ${checked ? `<span class="ord-mark">${right ? '✓ 맞는 자리' : it.extra ? `✗ ${W(L).unused}` : '✗ 자리 다름'}</span>` : ''}
            <span class="mv"><button type="button" data-up aria-label="${idx + 1}번째 줄 ${esc(T(it.text))} 위로" ${idx === 0 ? 'disabled' : ''}>▲</button><button type="button" data-down aria-label="${idx + 1}번째 줄 ${esc(T(it.text))} 아래로" ${idx === items.length - 1 ? 'disabled' : ''}>▼</button>${extras.length ? `<button type="button" class="ord-out" data-out aria-label="${esc(T(it.text))} 빼기">빼기</button>` : ''}</span></li>`;
          }).join('')}</ol>
          ${extras.length ? `<div class="order-outs"><p class="fine">${W(L).unused} ${extras.length}개를 [빼기]로 여기에 둬요.</p><ul>${outs.map((it, j) => `<li class="order-out-item"><span class="txt">${it.cat ? `<span class="drawer-chip"><i style="background:${it.color || '#5C68A6'}"></i>${esc(it.cat)}</span> ` : ''}${esc(T(it.text))}</span><button type="button" class="btn small ghost" data-in="${j}" aria-label="${esc(T(it.text))} 다시 넣기">다시 넣기</button></li>`).join('') || '<li class="fine order-out-empty">아직 없어요</li>'}</ul></div>` : ''}
          <div class="explain" hidden tabindex="-1"></div>
          <p style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;margin:0"><button class="btn blue" data-check>순서 확인</button><button class="btn primary" data-next hidden>${n + 1 < L.order.length ? W(L).next : '완료'}</button></p>
        </div></div>`;
      bindBack(area);
      const list = $('.order-list', area);
      const move = (from, to, dir) => { [items[from], items[to]] = [items[to], items[from]]; focusAfter = { idx: to, dir }; draw(); };
      list.querySelectorAll('.order-item').forEach((li) => {
        const idx = +li.dataset.idx;
        $('[data-up]', li).addEventListener('click', () => { if (idx > 0) move(idx, idx - 1, 'up'); });
        $('[data-down]', li).addEventListener('click', () => { if (idx < items.length - 1) move(idx, idx + 1, 'down'); });
        const ob = $('[data-out]', li); if (ob) ob.addEventListener('click', () => { const it = items.splice(idx, 1)[0]; outs.push(it); draw(); say(`${T(it.text)}, ${W(L).unused}로 뺐어요`); const f = $('.order-outs [data-in]:last-of-type', area) || $('.order-outs button', area); if (f) f.focus(); });
      });
      $$('.order-outs [data-in]', area).forEach((bt) => bt.addEventListener('click', () => { const it = outs.splice(+bt.dataset.in, 1)[0]; items.push(it); draw(); say(`${T(it.text)}, 다시 넣었어요(맨 아래)`); const rows = $$('.order-item', area); const f = rows.length && $('[data-up]', rows[rows.length - 1]); if (f) f.focus(); }));
      // 끌기는 손잡이(⠿)에서만: 줄 위에서는 손가락으로 페이지를 스크롤할 수 있게(04 P1-3). 마우스·터치·펜 공통(pointer 이벤트)
      list.querySelectorAll('.grip').forEach((g) => g.addEventListener('pointerdown', (e) => {
        if (e.button !== 0) return;
        const li = g.closest('.order-item'); e.preventDefault();
        const pid = e.pointerId;
        li.classList.add('dragging');
        // 줄을 DOM에서 옮기면 포인터 캡처가 풀리므로 문서에서 받는다
        const onMove = (ev) => {
          if (ev.pointerId !== pid) return;
          const over = document.elementFromPoint(ev.clientX, ev.clientY);
          const target = over && over.closest && over.closest('.order-item');
          if (!target || target === li || target.parentNode !== list) return;
          const r = target.getBoundingClientRect();
          list.insertBefore(li, ev.clientY < r.top + r.height / 2 ? target : target.nextSibling);
        };
        const onEnd = (ev) => {
          if (ev.pointerId !== pid) return;
          document.removeEventListener('pointermove', onMove); document.removeEventListener('pointerup', onEnd); document.removeEventListener('pointercancel', onEnd);
          li.classList.remove('dragging');
          const order = $$('.order-item', list).map((x) => +x.dataset.idx);
          if (!order.some((v, k) => v !== k)) return;
          const moved = items[+li.dataset.idx], to = order.indexOf(+li.dataset.idx);
          items = order.map((k) => items[k]);
          draw();
          say(`${moved.text}, ${to + 1}번째로 옮겼어요`);
        };
        document.addEventListener('pointermove', onMove); document.addEventListener('pointerup', onEnd); document.addEventListener('pointercancel', onEnd);
      }));
      if (focusAfter) {
        const row = $(`.order-item[data-idx="${focusAfter.idx}"]`, area);
        const t = row && ($(`[data-${focusAfter.dir}]:not([disabled])`, row) || $('button:not([disabled])', row));
        if (t) t.focus();
        say(`${items[focusAfter.idx].text}, ${focusAfter.idx + 1}번째로 옮겼어요`);
        focusAfter = null;
      }
      $('[data-check]', area).addEventListener('click', () => {
        const ok = items.length === set.steps.length && items.every((it, idx) => !it.extra && it.text === set.steps[idx].text);
        // 시도 수: 처음 완료할 때까지 [순서 확인]을 누른 수(9차 D18). 완료한 뒤 다시 하면 세지 않는다
        if (!(state.order && state.order.done)) { state.order = Object.assign({}, state.order || {}, { done: false, tries: ((state.order && state.order.tries) || 0) + 1 }); save(); }
        draw(true);
        const ex = $('.explain', area); ex.hidden = false;
        if (ok) {
          ex.innerHTML = `<b>정확해요!</b> ${esc(T(set.explain || ''))}`;
          const nx = $('[data-next]', area); nx.hidden = false; $('[data-check]', area).hidden = true;
          nx.focus();
          say(`정확해요! ${T(set.explain || '')}`);
          nx.addEventListener('click', () => {
            if (n + 1 < L.order.length) runOrder(area, L, state, save, n + 1);
            else {
              const was = !!(state.order && state.order.done);
              if (!was) { state.order = Object.assign({}, state.order || {}, { done: true, at: Date.now() }); save(); }
              const led = App().ledPattern();
              const msg = `${W(L).done}${was ? '' : ` ${PWd()} 2칸이 켜졌어요.`}`;
              area.innerHTML = `<div class="quiz"><div class="q-card result">${App().art('win', 'quiz-mascot')}${App().matrixHTML(led.cells, true)}<p class="quiz-led-note">내 LED ${led.lit} / 25칸</p><div class="score" tabindex="-1">완료</div><p>${msg}</p><p class="quiz-actions">${back()} ${meLink()}</p></div></div>`;
              bindBack(area);
              focusEl($('.score', area));
              say(`${W(L).game} 완료! ${msg}`);
            }
          });
        } else {
          const wrongN = items.filter((it, idx) => it.extra || !set.steps[idx] || it.text !== set.steps[idx].text).length;
          const extraIn = items.filter((it) => it.extra).length, stepOut = outs.filter((it) => !it.extra).length;
          const why = extraIn ? ` ${W(L).unused}${W(L).unused.endsWith('드') ? '가' : '이'} ${extraIn}개 들어 있어요. [빼기]로 빼 봐요.` : stepOut ? ` ${W(L).need} ${stepOut}개를 뺐어요. [다시 넣기]로 넣어요.` : '';
          ex.innerHTML = `✗ 표시가 붙은 ${wrongN}줄의 자리가 달라요.${esc(why)} 로봇이 <b>무엇을 먼저 해야 하는지</b> 생각하며 다시 옮겨 보세요.`;
          ex.focus();
          say(`${wrongN}줄의 자리가 달라요.${why} 다시 옮겨 보세요.`);
        }
      });
    };
    draw();
  }

  return { view, bind };
})();
