/* 게임 위젯(비트런 시리즈 C3~C5 — planning/bitrun/40-core-brief.md, 칸 규격 41-core-impl.md): 이론·스토리 쪽 어디서나 page.widget으로 쓴다
 *   escape-lock  방탈출 자물쇠: 단서 카드를 풀면 자물쇠 칸에 기호가 하나씩 채워지고, 학생이 다이얼을 맞춰 [열기]. 틀리면 흔들림 + 힌트 단계
 *   path-code    길 찾기 코딩 퍼즐: 격자 지도 위 로봇을 명령 카드(앞으로·돌기·반복·함수)로 움직임. 벽에 부딪치면 그 카드 빨간 표시, 카드 수 별
 *   dilemma      생각 나누기·윤리 딜레마: 고르고 까닭 적기 → 고른 보기의 '이렇게 생각해 볼 수도 있어요'(정답 없음)
 * 셋 다 끝내면 ctx.done()(쪽 완료 = 진행 칸, 확인 문제 대신)과 ctx.setData()(결과 카드에 남길 시도·힌트·선택)를 부른다.
 * ctx(app.js bindTheory·스토리 쪽): { done() → 처음 완료면 true, isDone, announce(글), say('화면 점이'), teacher, data() → 저장된 값, setData(객체) → 합쳐 저장 }
 * 파일 맨 위에서는 DOM을 만지지 않는다(check-lesson이 vm에서 실행해 등록 id와 GameWidgets.pathShortest를 읽음). 새 자물쇠 종류는 LOCKS에, 새 칸 글자는 TILES·CARDS에 더한다. */
(() => {
  const W = window.Widgets; if (!W) return;
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const reduce = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const toks = (s) => Array.from(String(s ?? ''));
  const jong = (w) => { const c = String(w).charCodeAt(String(w).length - 1); return c >= 0xAC00 && c <= 0xD7A3 && (c - 0xAC00) % 28 !== 0; };
  const iga = (w) => (jong(w) ? '이' : '가'), eul = (w) => (jong(w) ? '을' : '를');
  let gN = 0;
  const ctxOf = (ctx) => Object.assign({ data: () => ({}), setData: () => {}, done: () => false, announce: () => {} }, ctx || {});
  const shake = (el) => { if (!el) return; el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); };
  // K9 열쇠 조각(escape-lock·path-code 공용): o.success.key 번호 + 프리셋 notebook.keys의 이름·그림
  const keyNum = (o) => (o && o.success && o.success.key != null ? o.success.key : null);
  const keyGotHTML = (o, ctx) => {
    const kn = keyNum(o); if (kn == null) return '';
    const kk = (((ctx || {}).notebook || {}).keys || []).find((x) => +x.n === +kn) || { n: kn };
    return `<p class="xl-key-got">${kk.img ? `<img src="${esc(kk.img)}" alt="" aria-hidden="true">` : `<span class="xl-keyic" aria-hidden="true">${esc(kn)}</span>`}<span>열쇠 조각 ${esc(kn)}${kk.name ? ` · ${esc(kk.name)}` : ''}을 얻었어요</span></p>`;
  };

  /* ================= C3. 방탈출 자물쇠 escape-lock (+ 게임 회의 K1~K9·K13·K17·K22·K23) =================
   * opts: { title, story, lock: 'digits'|'arrows'|'colors'|'symbols'|'word', length?, values?, colors?[{id,label,hex}], symbols?[문자 | { id, img, alt, label? }](K3), letters?,
   *         clues: [{ room, who?(K13 역할 이름표), q, figure?(K5 그림판), img?, alt?,
   *                   type?: 'choice'(기본, options+answer) | 'multi'(K6, answer: [번호…]) | 'path'(K17, path: { path-code opts }),
   *                   options?: [글 | { label, img?, alt?, why? }](K2 그림 보기·K4 보기별 오답 반응), answer, input?: 'number'|'text', accept?[],
   *                   give, explain?, hints?: { look, page?, drop?, together? }(K1 도움 3단계, 옛 hint 한 줄은 ①로) }],
   *         code?(= give 이음), autoOpen?(K7 다이얼 없이 열림), confirm?: { label, img?, alt?, done? }(K8), hint?(자물쇠 2번째 틀림부터),
   *         success: { text, img?, alt?, key?(K9 열쇠 조각 번호) }, fail? }
   * 규칙(20-gamification 3절): 도움은 학생이 누를 때만(R1), 타이머·감점 없음(R2), 틀리면 조용히 흔들고 "다시 해 봐요" + 주황 점(R3, 빨강·X 없음),
   *   정답은 풀기 전 화면에 없음(R4), 결과는 조용하게 — 학생에게는 "스스로 열었어요 / 도움 받아 열었어요"만, 횟수는 교사 화면에만(R8·K23), 단서 카드는 하나씩 펼침(R9).
   * 소리(K22): 앱의 [소리 켜기](기본 꺼짐)를 따라 App.beep — 맞음·열림 = 초록 ✓·문 열림, 막힘 = 주황 점·흔들림과 늘 짝.
   * 저장(ctx.setData): { solved: [단서 번호…], tries, wrong, help: { 1, 2, 3 }(도움 단계별 연 수), hints(도움 합), clueWrong, helped(도움을 하나라도 봄), opened, key } */
  const COLORS = [
    { id: 'R', label: '빨강', hex: '#E5484D' }, { id: 'O', label: '주황', hex: '#F08C00' }, { id: 'Y', label: '노랑', hex: '#F2C200' },
    { id: 'G', label: '초록', hex: '#2FB78A' }, { id: 'B', label: '파랑', hex: '#0472CA' }, { id: 'P', label: '보라', hex: '#6C4DD6' },
  ];
  const ARROW_KO = { '↑': '위', '→': '오른쪽', '↓': '아래', '←': '왼쪽' };
  const symList = (o) => (Array.isArray(o.symbols) && o.symbols.length ? o.symbols.map((s) => (s && typeof s === 'object' ? s : { id: String(s) })) : null);
  const LOCKS = {
    digits: { name: '숫자 자물쇠', values: () => '0123456789'.split('') },
    arrows: { name: '화살표 자물쇠', values: () => ['↑', '→', '↓', '←'], say: (v) => ARROW_KO[v] || v },
    colors: { name: '색 자물쇠', values: (o) => (o.colors || COLORS).map((c) => String(c.id)), say: (v, o) => ((o.colors || COLORS).find((c) => String(c.id) === v) || {}).label || v },
    symbols: { name: '기호 자물쇠', values: (o) => (symList(o) ? symList(o).map((s) => String(s.id)) : ['★', '●', '▲', '■', '♥', '◆']), say: (v, o) => { const s = (symList(o) || []).find((x) => String(x.id) === v); return s ? s.label || s.alt || v : v; } },
    word: { name: '글자 자물쇠', values: (o, code) => { const base = o.letters ? toks(o.letters) : toks(code); const extra = toks('가나다라마바사아자차카타파하'); const out = [...new Set(base)]; for (const c of extra) { if (out.length >= Math.max(6, base.length + 3)) break; if (!out.includes(c)) out.push(c); } return out; } },
  };
  // 그림 기호 자물쇠(K3)는 give·code를 id로 적는다: id가 여러 글자면 '|'로 잇거나 give 하나 = 칸 하나
  const giveToks = (o, g) => (o.lock === 'symbols' && symList(o) ? (Array.isArray(g) ? g.map(String) : String(g ?? '').includes('|') ? String(g).split('|') : symList(o).some((s) => String(s.id) === String(g)) ? [String(g)] : toks(g)) : toks(Array.isArray(g) ? g.join('') : g));
  function lockValues(o, code) {
    if (Array.isArray(o.values) && o.values.length) return o.values.map(String);
    const L = LOCKS[o.lock] || LOCKS.digits; const v = L.values(o, Array.isArray(code) ? code.join('') : code);
    (Array.isArray(code) ? code : toks(code)).forEach((c) => { if (!v.includes(c)) v.push(c); }); // 정답 기호가 목록에 없으면 더함(다이얼로 맞출 수 있게)
    return v;
  }
  const valSay = (o, v) => { const L = LOCKS[o.lock] || LOCKS.digits; return L.say ? L.say(v, o) : v; };
  const optOf = (x) => (x && typeof x === 'object' ? { label: String(x.label ?? ''), img: x.img, alt: x.alt, why: x.why } : { label: String(x ?? '') });
  const beep = (k) => { try { if (window.App && window.App.beep) window.App.beep(k); } catch (e) { /* 소리 없음 */ } };
  // K5 단서 그림판: 그림 · 번호 카드 · 막대 · 표
  function figureHTML(f) {
    if (!f || typeof f !== 'object') return '';
    if (f.kind === 'img') return `<figure class="xl-fig"><img src="${esc(f.img)}" alt="${esc(f.alt || '')}" loading="lazy">${f.cap ? `<figcaption>${esc(f.cap)}</figcaption>` : ''}</figure>`;
    if (f.kind === 'cards') return `<div class="xl-fig xl-figcards">${(f.items || []).map((it) => `<div class="xl-fcard">${it.n != null ? `<b class="xl-fn">${esc(it.n)}</b>` : ''}${it.img ? `<img src="${esc(it.img)}" alt="${esc(it.alt || it.label || '')}" loading="lazy">` : ''}${it.label ? `<span class="xl-flabel">${esc(it.label)}</span>` : ''}${(it.lines || []).length ? `<code>${it.lines.map(esc).join('<br>')}</code>` : ''}</div>`).join('')}</div>`;
    if (f.kind === 'bar') { const max = +f.max || 100, v = Math.max(0, Math.min(max, +f.value || 0)), ln = f.line != null ? Math.max(0, Math.min(max, +f.line)) : null; return `<div class="xl-fig xl-bar" role="img" aria-label="${esc(f.label || '값')} ${v}${ln != null ? `, 기준 ${ln}` : ''} (최대 ${max})"><span class="xl-bar-l">${esc(f.label || '')}</span><span class="xl-bar-t"><i style="width:${(v / max) * 100}%"></i>${ln != null ? `<em style="left:${(ln / max) * 100}%"><span>기준 ${ln}</span></em>` : ''}</span><b>${v}</b></div>`; }
    if (f.kind === 'table') return `<div class="xl-fig"><table class="xl-tbl">${f.head ? `<thead><tr>${f.head.map((x) => `<th scope="col">${esc(x)}</th>`).join('')}</tr></thead>` : ''}<tbody>${(f.rows || []).map((r) => `<tr>${r.map((x, k) => (k === 0 ? `<th scope="row">${esc(x)}</th>` : `<td>${esc(x)}</td>`)).join('')}</tr>`).join('')}</tbody></table></div>`;
    return '';
  }
  function escapeLock(el, o = {}, ctx0 = {}) {
    const ctx = ctxOf(ctx0), id = `xl${++gN}`;
    const clues = (o.clues || []).filter(Boolean);
    const auto = !!o.autoOpen;
    const code = auto ? [] : o.code != null ? giveToks(o, o.code) : clues.flatMap((c) => giveToks(o, c.give));
    const len = code.length;
    const vals = auto ? [] : lockValues(o, code);
    const slotsOf = []; let at = 0; clues.forEach((c, i) => { const n = auto ? 0 : giveToks(o, c.give).length; slotsOf[i] = Array.from({ length: n }, (_, k) => at + k); at += n; });
    const slotClue = []; slotsOf.forEach((ss, i) => ss.forEach((s) => { slotClue[s] = i; }));
    const saved = ctx.data() || {};
    const S = { solved: new Set((saved.solved || []).filter((i) => i < clues.length)), tries: saved.tries || 0, wrong: saved.wrong || 0, help: Object.assign({ 1: 0, 2: 0, 3: 0 }, saved.help || {}), clueWrong: saved.clueWrong || 0, opened: saved.opened || 0,
      dial: Array(len).fill(0), lockWrong: 0, lvl: {}, tried: {}, pick: {}, open: null, confirmed: !o.confirm || !!saved.opened, helped: !!saved.helped };
    const firstOpen = () => { const k = clues.findIndex((_, i) => !S.solved.has(i)); return k < 0 ? null : k; };
    S.open = firstOpen();
    const helpsTotal = () => S.help[1] + S.help[2] + S.help[3];
    const store = () => ctx.setData({ solved: [...S.solved], tries: S.tries, wrong: S.wrong, help: S.help, hints: helpsTotal(), clueWrong: S.clueWrong, helped: S.helped, opened: S.opened || null, key: o.success && o.success.key != null ? o.success.key : null });
    const isColor = o.lock === 'colors', colorOf = (v) => ((o.colors || COLORS).find((c) => String(c.id) === v) || {}).hex;
    const symOf = (v) => (o.lock === 'symbols' ? (symList(o) || []).find((s) => String(s.id) === v) : null);
    const tokHTML = (v, cls = '') => { const sy = symOf(v); return sy && sy.img ? `<span class="xl-tok xl-pic ${cls}"><img src="${esc(sy.img)}" alt="${esc(sy.alt || sy.label || v)}"></span>` : isColor && colorOf(v) ? `<span class="xl-tok xl-color ${cls}" style="--c:${esc(colorOf(v))}"><span class="sr">${esc(valSay(o, v))}</span></span>` : `<span class="xl-tok ${cls}">${esc(v)}</span>`; };
    const say = (t) => { const s = el.querySelector('[data-say]'); if (s) s.innerHTML = t; ctx.announce(String(t).replace(/<[^>]+>/g, '')); };
    const kind = (c) => (c.type === 'multi' ? 'multi' : c.type === 'path' ? 'path' : Array.isArray(c.options) && c.options.length ? 'choice' : 'input');
    const H = (c) => { const h = c.hints || {}; return { look: h.look || c.hint || '', page: h.page, drop: h.drop, together: h.together }; };
    const wrongIdx = (c) => { const ans = [].concat(c.answer); return (c.options || []).map((_, k) => k).filter((k) => !ans.includes(k)); };
    // 도움 단계 목록(① 어디를 볼지 · ② 보기 하나 지우기 · ③ 같이 풀기). ②는 보기가 3개 이상이고 drop !== false일 때만
    const steps = (c) => { const h = H(c), out = []; if (h.look || h.page) out.push(1); if (['choice', 'multi'].includes(kind(c)) && (c.options || []).length > 2 && h.drop !== false && wrongIdx(c).length) out.push(2); out.push(3); return out; };
    const dropped = (c, i) => {
      const lv = S.lvl[i] || 0, h = H(c), w = wrongIdx(c), out = new Set();
      if (lv >= 2 && steps(c).includes(2)) out.add(Number.isInteger(h.drop) && w.includes(h.drop) ? h.drop : w[0]);
      if (lv >= 3 && ['choice', 'multi'].includes(kind(c))) { const keep = [].concat(c.answer).length + 1; w.filter((k) => !out.has(k)).slice(0, Math.max(0, (c.options || []).length - keep - out.size)).forEach((k) => out.add(k)); }
      return out;
    };
    const helpHTML = (c, i) => {
      const lv = S.lvl[i] || 0, st = steps(c), h = H(c), shown = st.filter((s) => s <= lv || (s === 2 && lv >= 2) || (s === 3 && lv >= 3));
      const next = st.find((s) => s > lv);
      const txt = { 1: () => `${h.look ? esc(h.look) : '문제를 다시 천천히 읽어요.'}${h.page && ctx.pageHref && ctx.pageHref(h.page) ? ` <a class="xl-look" href="${esc(ctx.pageHref(h.page))}">그 쪽 다시 보기</a>` : ''}`,
        2: () => '보기 하나를 지웠어요. 남은 보기에서 골라 봐요.',
        3: () => { const tg = [].concat(h.together || ['문제를 소리 내어 같이 읽어요.', '아는 낱말에 밑줄을 그어요.', ['choice', 'multi'].includes(kind(c)) ? '남은 보기를 하나씩 문제에 넣어 읽어 봐요.' : '답을 적고 다시 문제에 넣어 읽어 봐요.']); return `<ol class="xl-tog">${tg.map((t) => `<li>${esc(t)}</li>`).join('')}</ol>`; } };
      return `<div class="xl-helpbox">${shown.map((s) => `<p class="xl-h${s}"><b class="xl-hn">도움 ${'①②③'[s - 1]}</b> ${txt[s]()}</p>`).join('')}
        ${next ? `<button type="button" class="btn small ghost xl-helpbtn" data-help="${i}">도움 ${'①②③'[next - 1]} ${next === 1 ? '어디를 볼까요?' : next === 2 ? '보기 하나 지우기' : '같이 풀기'}</button>` : ''}</div>`;
    };
    const optHTML = (c, i, k, multi) => {
      const x = optOf(c.options[k]), dr = dropped(c, i).has(k), tr = (S.tried[i] || {})[k], pk = multi && (S.pick[i] || []).includes(k);
      return `<button type="button" class="xl-opt${x.img ? ' has-img' : ''}${dr ? ' dropped' : ''}${tr ? ' tried' : ''}" data-clue="${i}" data-k="${k}"${multi ? ` aria-pressed="${!!pk}"` : ''}${dr ? ' aria-disabled="true"' : ''}>${x.img ? `<img src="${esc(x.img)}" alt="${esc(x.alt || '')}" loading="lazy" draggable="false">` : ''}<span>${esc(x.label)}</span>${dr ? '<span class="sr"> (지운 보기)</span>' : tr ? '<span class="xl-dot" aria-hidden="true"></span><span class="sr"> (골라 봤어요)</span>' : ''}</button>`;
    };
    const pathEls = {};
    const clueHTML = (c, i) => {
      const done = S.solved.has(i), gv = auto ? [] : giveToks(o, c.give), k = kind(c), openNow = S.open === i, hasImg = (c.options || []).some((x) => x && typeof x === 'object' && x.img);
      const head = `<button type="button" class="xl-clue-h" data-toggle="${i}" aria-expanded="${openNow}"><span class="xl-room">${done ? '<span class="xl-ok" aria-hidden="true">✓</span>' : ''}${esc(c.room || `단서 ${i + 1}`)}${done ? '<span class="sr"> 풀었어요</span>' : ''}</span>${c.who ? `<span class="xl-who">${esc(c.who)} 담당이 읽어요</span>` : ''}<span class="xl-gets" aria-label="${done ? `받은 기호 ${gv.map((v) => valSay(o, v)).join(' ')}` : '아직 못 받은 기호'}">${done ? gv.map((v) => tokHTML(v, 'pop')).join('') : gv.map(() => '<span class="xl-tok q">?</span>').join('')}</span><span class="xl-chev" aria-hidden="true">▾</span></button>`;
      if (!openNow) return `<li class="xl-clue folded${done ? ' solved' : ''}" data-ci="${i}">${head}</li>`;
      let body;
      if (done) body = `<p class="xl-explain"><b>풀었어요!</b> ${c.explain ? esc(c.explain) : ''}</p>`;
      else if (k === 'choice' || k === 'multi') body = `<div class="xl-opts${hasImg ? ' pics' : ''}" role="group" aria-label="${esc(c.room || `단서 ${i + 1}`)} 보기${k === 'multi' ? ` — ${[].concat(c.answer).length}개를 골라요` : ''}">${c.options.map((_, kk) => optHTML(c, i, kk, k === 'multi')).join('')}</div>${k === 'multi' ? `<p class="xl-multi"><button type="button" class="btn small" data-multi="${i}" aria-disabled="${(S.pick[i] || []).length !== [].concat(c.answer).length}">확인</button><span class="fine"> ${[].concat(c.answer).length}개를 골라요 (지금 ${(S.pick[i] || []).length}개)</span></p>` : ''}`;
      else if (k === 'path') body = `<div class="xl-path" data-path="${i}"></div>`;
      else body = `<form class="xl-in" data-clue-form="${i}"><label><span class="sr">${esc(c.room || `단서 ${i + 1}`)} 답</span><input ${c.input === 'number' ? 'inputmode="numeric"' : ''} autocomplete="off" maxlength="20" placeholder="답 적기"></label><button class="btn small" type="submit">확인</button></form>`;
      return `<li class="xl-clue${done ? ' solved' : ''}" data-ci="${i}">${head}<div class="xl-clue-b">
        ${figureHTML(c.figure)}${c.img ? `<img class="xl-img" src="${esc(c.img)}" alt="${esc(c.alt || '')}" loading="lazy">` : ''}
        <p class="xl-q">${esc(c.q)}</p>${body}<p class="xl-fb" data-fb="${i}" aria-live="polite"></p>${done ? '' : helpHTML(c, i)}</div></li>`;
    };
    const resultLine = () => (S.helped ? '도움 받아 열었어요' : '스스로 열었어요');
    const keyHTML = () => keyGotHTML(o, ctx);
    function draw() {
      const all = S.solved.size === clues.length;
      el.innerHTML = `<div class="widget xlock${S.opened ? ' is-open' : ''}${auto ? ' auto' : ''}" id="${id}">
        <div class="xl-top"><p class="xl-title"><svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><rect x="4" y="10" width="16" height="11" rx="3" fill="currentColor"/><path d="M8 10V7a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" stroke-width="2.4"/></svg>${esc(o.title || (LOCKS[o.lock || 'digits'] || LOCKS.digits).name)}</p>${o.story ? `<p class="xl-story">${esc(o.story)}</p>` : ''}</div>
        <ol class="xl-clues">${clues.map(clueHTML).join('')}</ol>
        <section class="xl-lock" aria-label="자물쇠">
          <div class="xl-lock-h"><b>자물쇠</b><span class="xl-count">단서 ${S.solved.size} / ${clues.length}</span></div>
          ${auto ? `<p class="fine xl-autonote">${S.opened ? '' : '단서를 모두 풀면 문이 열려요.'}</p>` : `<div class="xl-keys" aria-label="모은 기호">${code.map((v, s) => `<span class="xl-key">${S.solved.has(slotClue[s]) ? tokHTML(v, 'pop') : '<span class="xl-tok q">?</span>'}<small>${esc((clues[slotClue[s]] || {}).room || '')}</small></span>`).join('')}</div>
          <div class="xl-dials" role="group" aria-label="다이얼 ${len}개">${code.map((_, s) => `<div class="xl-dial" data-pos="${s}">
            <button type="button" class="xl-up" data-turn="${s}" data-d="-1" aria-label="${s + 1}번째 다이얼 앞 값">▲</button>
            <span class="xl-val" role="spinbutton" tabindex="0" data-dial="${s}" aria-label="${s + 1}번째 다이얼" aria-valuemin="0" aria-valuemax="${vals.length - 1}" aria-valuenow="${S.dial[s]}" aria-valuetext="${esc(valSay(o, vals[S.dial[s]]))}">${tokHTML(vals[S.dial[s]])}</span>
            <button type="button" class="xl-down" data-turn="${s}" data-d="1" aria-label="${s + 1}번째 다이얼 다음 값">▼</button></div>`).join('')}</div>`}
          ${o.confirm && all && !S.opened ? `<p class="xl-confirm">${o.confirm.img ? `<img src="${esc(o.confirm.img)}" alt="${esc(o.confirm.alt || '')}">` : ''}<button type="button" class="btn${S.confirmed ? '' : ' primary'}" data-confirm aria-pressed="${S.confirmed}">${S.confirmed ? `✓ ${esc(o.confirm.done || '했어요')}` : esc(o.confirm.label || '확인')}</button></p>` : ''}
          ${auto ? '' : `<p class="xl-act"><button type="button" class="btn primary" data-open${S.opened ? ' disabled' : ''}>열기</button>${all || S.opened ? '' : '<span class="fine"> 단서를 모두 풀면 기호가 다 모여요.</span>'}</p>`}
          <div class="xl-help" data-lockhelp hidden></div>
        </section>
        <p class="xl-say" data-say aria-live="polite">${S.opened ? '' : ctx.isDone ? '이미 연 자물쇠예요. 다시 해 봐도 돼요.' : ''}</p>
        <div class="xl-win" data-win ${S.opened ? '' : 'hidden'}>
          <div class="xl-door">${o.success && o.success.img ? `<img src="${esc(o.success.img)}" alt="${esc(o.success.alt || '')}" loading="lazy">` : '<svg viewBox="0 0 48 48" width="64" height="64" aria-hidden="true"><circle cx="24" cy="24" r="20" fill="var(--series-accent, #2FB78A)"/><path d="M14 25l7 7 13-15" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></svg>'}<i aria-hidden="true"></i><i aria-hidden="true"></i></div>
          <div class="xl-win-body"><p><b>${esc((o.success && o.success.text) || '잠금이 풀렸어요.')}</b></p>${keyHTML()}
            <p class="xl-self">${resultLine()}</p>${auto ? '' : '<button type="button" class="btn small ghost" data-again>다시 해 보기</button>'}</div>
        </div>
        ${ctx.teacher ? `<p class="teacher-only xl-teach">${auto ? '' : '<button type="button" class="btn ghost small" data-reveal>정답 보기(교사)</button>'}<span data-code hidden> 비밀번호: ${code.map((v) => `${esc(v)}${valSay(o, v) !== v ? `(${esc(valSay(o, v))})` : ''}`).join(' ')}</span><span class="fine xl-tstat"> 교사 참고: 열기 ${S.tries}번 · 단서 다시 ${S.clueWrong}번 · 도움 ①${S.help[1]} ②${S.help[2]} ③${S.help[3]}</span></p>` : ''}
      </div>`;
      // K17: 자물쇠 안 퍼즐 — 한 번 만든 퍼즐은 다시 그려도 그대로(진행 중인 카드가 지워지지 않게)
      el.querySelectorAll('[data-path]').forEach((slot) => {
        const i = +slot.dataset.path, c = clues[i];
        if (!pathEls[i]) {
          pathEls[i] = document.createElement('div');
          pathCode(pathEls[i], Object.assign({}, c.path || {}), { teacher: ctx.teacher, announce: ctx.announce, say: '', data: () => ({}), setData: () => {},
            done: () => { if (!S.solved.has(i)) setTimeout(() => solve(i), 400); return false; } });
        }
        slot.replaceWith(pathEls[i]); pathEls[i].classList.add('xl-path');
      });
      bind();
    }
    const focusClue = (i) => { const f = el.querySelector(`.xl-clue[data-ci="${i}"] .xl-clue-h`); if (f) f.focus({ preventScroll: false }); };
    const solve = (i) => {
      S.solved.add(i); store(); beep('led');
      const c = clues[i], gv = auto ? [] : giveToks(o, c.give);
      const allNow = S.solved.size === clues.length;
      S.open = i; draw();
      const nx = firstOpen();
      say(`<span class="xl-okmark" aria-hidden="true">✓</span> <b>${esc(c.room || `단서 ${i + 1}`)}</b> 풀었어요!${gv.length ? ` 자물쇠 칸에 <b>${gv.map((v) => esc(valSay(o, v))).join(' ')}</b>${iga(gv.map((v) => valSay(o, v)).join(''))} 채워졌어요.` : ''}${allNow ? (auto ? '' : ' 기호를 다 모았어요. 다이얼을 맞추고 [열기]를 눌러요.') : ' 다음 단서를 펼쳐요.'}`);
      if (allNow && auto && (!o.confirm || S.confirmed)) { setTimeout(() => openNow(), reduce() ? 0 : 500); return; }
      if (!allNow && nx != null) { S.open = nx; setTimeout(() => { draw(); focusClue(nx); }, reduce() ? 0 : 700); return; }
      const f = allNow && !auto ? el.querySelector('.xl-val') : el.querySelector('[data-confirm]') || el.querySelector(`.xl-clue[data-ci="${i}"] .xl-clue-h`); if (f) f.focus({ preventScroll: false });
    };
    // 틀림(R3): 조용히 흔들고 주황 점, "다시 해 봐요". 보기별 반응(K4)은 그 보기의 why
    const clueWrong = (i, k) => {
      S.clueWrong++; store(); beep('no');
      const c = clues[i], fb = el.querySelector(`[data-fb="${i}"]`);
      const why = k != null && c.options ? optOf(c.options[k]).why : null;
      if (k != null) { S.tried[i] = Object.assign({}, S.tried[i], { [k]: true }); const b = el.querySelector(`.xl-opt[data-clue="${i}"][data-k="${k}"]`); if (b && !b.classList.contains('tried')) { b.classList.add('tried'); b.insertAdjacentHTML('beforeend', '<span class="xl-dot" aria-hidden="true"></span><span class="sr"> (골라 봤어요)</span>'); } }
      if (fb) fb.innerHTML = `<span class="xl-dot" aria-hidden="true"></span> ${why ? `${esc(why)} ` : ''}다시 해 봐요.`;
      shake(el.querySelector(`.xl-clue[data-ci="${i}"]`));
      ctx.announce(`${why ? `${why} ` : ''}다시 해 봐요.`);
    };
    function openNow() {
      S.opened = Date.now(); S.tries++; store(); beep('win');
      const first = ctx.done();
      draw();
      const win = el.querySelector('[data-win]'); if (win) { win.classList.add('opening'); if (!win.hasAttribute('tabindex')) win.tabIndex = -1; win.focus({ preventScroll: false }); }
      if (ctx.onKey && o.success && o.success.key != null) ctx.onKey(o.success.key);
      say(`<b>${esc((o.success && o.success.text) || '잠금이 풀렸어요.')}</b> ${resultLine()}.${first && ctx.say ? ` ${esc(ctx.say)} 켜졌어요.` : ''}`);
    }
    const turn = (s, d) => {
      S.dial[s] = (S.dial[s] + d + vals.length) % vals.length;
      const v = el.querySelector(`[data-dial="${s}"]`); if (!v) return;
      v.innerHTML = tokHTML(vals[S.dial[s]]); v.setAttribute('aria-valuenow', S.dial[s]); v.setAttribute('aria-valuetext', valSay(o, vals[S.dial[s]]));
      el.querySelectorAll('.xl-dial').forEach((x) => x.classList.remove('ok', 'no'));
    };
    const open = () => {
      if (S.opened) return;
      if (o.confirm && !S.confirmed) { say(`먼저 [${esc(o.confirm.label || '확인')}]을 눌러요.`); const cb = el.querySelector('[data-confirm]'); if (cb) cb.focus(); return; }
      const got = S.dial.map((k) => vals[k]);
      if (got.every((v, s) => v === code[s])) { openNow(); return; }
      S.tries++; S.wrong++; S.lockWrong++; beep('no');
      const help = el.querySelector('[data-lockhelp]');
      shake(el.querySelector('.xl-lock'));
      if (S.lockWrong === 1) {
        help.hidden = false;
        help.innerHTML = `<p><b>단서 다시 보기</b> 자물쇠 칸 아래 이름표 차례대로 기호를 맞춰요.</p><ol>${clues.map((c, i) => `<li>${esc(c.room || `단서 ${i + 1}`)}: ${S.solved.has(i) ? giveToks(o, c.give).map((v) => tokHTML(v)).join(' ') : '<span class="fine">아직 안 풀었어요</span>'}</li>`).join('')}</ol>`;
        say(`<span class="xl-dot" aria-hidden="true"></span> ${esc(o.fail || '문이 아직 안 열려요.')} 다시 해 봐요. 단서를 다시 보고 다이얼을 맞춰요.`);
      } else {
        el.querySelectorAll('.xl-dial').forEach((x, s) => { const okv = got[s] === code[s]; x.classList.toggle('ok', okv); x.classList.toggle('no', !okv); x.querySelector('.xl-val').setAttribute('aria-label', `${s + 1}번째 다이얼${okv ? ', 맞음' : ', 다시 맞춰요'}`); });
        const right = got.filter((v, s) => v === code[s]).length;
        help.hidden = false;
        help.innerHTML = `<p><b>힌트</b> ${esc(o.hint || '✓ 표시 다이얼은 맞았어요. 주황 점 다이얼만 다시 돌려 봐요.')}</p><p class="fine">${len}칸 중 ${right}칸이 맞아요.</p>`;
        say(`<span class="xl-dot" aria-hidden="true"></span> ${esc(o.fail || '문이 아직 안 열려요.')} 다시 해 봐요. ${len}칸 중 ${right}칸이 맞아요.`);
      }
      store();
    };
    function bind() {
      const root = el.querySelector('.xlock');
      root.querySelectorAll('[data-toggle]').forEach((b) => b.addEventListener('click', () => { const i = +b.dataset.toggle; S.open = S.open === i ? null : i; draw(); focusClue(i); }));
      root.querySelectorAll('.xl-opt').forEach((b) => b.addEventListener('click', () => {
        if (b.getAttribute('aria-disabled') === 'true') return;
        const i = +b.dataset.clue, k = +b.dataset.k, c = clues[i];
        if (kind(c) === 'multi') {
          const p = new Set(S.pick[i] || []); if (p.has(k)) p.delete(k); else p.add(k); S.pick[i] = [...p];
          b.setAttribute('aria-pressed', String(p.has(k)));
          const n = [].concat(c.answer).length, mb = root.querySelector(`[data-multi="${i}"]`); if (mb) { mb.setAttribute('aria-disabled', String(p.size !== n)); mb.nextElementSibling.textContent = ` ${n}개를 골라요 (지금 ${p.size}개)`; }
          return;
        }
        if (k === +c.answer) solve(i); else clueWrong(i, k);
      }));
      root.querySelectorAll('[data-multi]').forEach((b) => b.addEventListener('click', () => {
        const i = +b.dataset.multi, c = clues[i], ans = [].concat(c.answer).map(Number), p = S.pick[i] || [];
        if (p.length !== ans.length) { const fb = el.querySelector(`[data-fb="${i}"]`); if (fb) fb.textContent = `${ans.length}개를 골라요.`; return; }
        if (p.every((k) => ans.includes(k))) { solve(i); return; }
        // 틀린 카드 중 why가 있는 것만 반응(K6)
        const bad = p.filter((k) => !ans.includes(k)), w = bad.map((k) => optOf(c.options[k]).why).find(Boolean);
        S.clueWrong++; store(); beep('no'); bad.forEach((k) => { S.tried[i] = Object.assign({}, S.tried[i], { [k]: true }); });
        S.pick[i] = []; draw();
        const fb = el.querySelector(`[data-fb="${i}"]`); if (fb) fb.innerHTML = `<span class="xl-dot" aria-hidden="true"></span> ${w ? `${esc(w)} ` : ''}다시 해 봐요.`;
        shake(el.querySelector(`.xl-clue[data-ci="${i}"]`)); ctx.announce(`${w ? `${w} ` : ''}다시 해 봐요.`);
      }));
      root.querySelectorAll('[data-help]').forEach((b) => b.addEventListener('click', () => {
        const i = +b.dataset.help, c = clues[i], st = steps(c), nx = st.find((s) => s > (S.lvl[i] || 0)); if (!nx) return;
        S.lvl[i] = nx; S.help[nx]++; S.helped = true; store(); draw();
        ctx.announce(`도움 ${nx}번을 열었어요.`);
        const nb = el.querySelector(`[data-help="${i}"]`) || el.querySelector(`.xl-clue[data-ci="${i}"] .xl-h${nx}`); if (nb) { if (!nb.hasAttribute('tabindex') && nb.tagName !== 'BUTTON') nb.tabIndex = -1; nb.focus({ preventScroll: true }); }
      }));
      root.querySelectorAll('[data-clue-form]').forEach((f) => f.addEventListener('submit', (e) => {
        e.preventDefault();
        const i = +f.dataset.clueForm, c = clues[i], v = f.querySelector('input').value.trim();
        if (!v) { const fb = el.querySelector(`[data-fb="${i}"]`); if (fb) fb.textContent = '답을 적고 [확인]을 눌러요.'; return; }
        const norm = (x) => String(x).replace(/\s+/g, '').toLowerCase();
        const okv = c.input === 'number' ? [c.answer, ...(c.accept || [])].some((a) => Number(v) === Number(a)) : [c.answer, ...(c.accept || [])].some((a) => norm(a) === norm(v));
        if (okv) solve(i); else clueWrong(i, null);
      }));
      root.querySelectorAll('[data-turn]').forEach((b) => b.addEventListener('click', () => { if (!S.opened) turn(+b.dataset.turn, +b.dataset.d); }));
      root.querySelectorAll('[data-dial]').forEach((v) => v.addEventListener('keydown', (e) => {
        if (S.opened) return;
        const s = +v.dataset.dial;
        if (e.key === 'ArrowUp') { e.preventDefault(); turn(s, -1); } else if (e.key === 'ArrowDown') { e.preventDefault(); turn(s, 1); }
        else if (e.key === 'Enter') { e.preventDefault(); open(); }
      }));
      const cf = root.querySelector('[data-confirm]'); if (cf) cf.addEventListener('click', () => { if (S.confirmed) return; S.confirmed = true; if (auto) { openNow(); return; } draw(); say(`✓ ${esc(o.confirm.done || '했어요')}. 이제 열 수 있어요.`); const f = el.querySelector('.xl-val') || el.querySelector('[data-open]'); if (f) f.focus(); });
      const ob = root.querySelector('[data-open]'); if (ob) ob.addEventListener('click', open);
      const ag = root.querySelector('[data-again]'); if (ag) ag.addEventListener('click', () => { S.opened = 0; S.lockWrong = 0; S.dial = Array(len).fill(0); draw(); say('다이얼을 처음으로 돌렸어요. 다시 맞춰 봐요.'); const f = el.querySelector('.xl-val'); if (f) f.focus(); });
      const rv = root.querySelector('[data-reveal]'); if (rv) rv.addEventListener('click', () => { const c = root.querySelector('[data-code]'); c.hidden = !c.hidden; rv.textContent = c.hidden ? '정답 보기(교사)' : '정답 숨기기'; });
    }
    draw();
  }

  /* ================= C4. 길 찾기 코딩 퍼즐 path-code =================
   * opts: { grid: ['#####', '#S..#', …] (S 출발 · E 출구 · # 벽 · L 레이저: 불이 켜져 있으면 못 지나감 · . 길), dir: 'E'|'N'|'S'|'W'(또는 right·up·down·left, 기본 E),
   *         cards: ['forward','left','right','repeat','fn','lightoff'], maxCards: 8, repeatMax: 5, fn: { name, body: ['right','forward','forward'] } | null,
   *         best?(★★★ 카드 수, 없으면 반복·함수 없이 가장 짧은 길의 카드 수), goal, explain, robotImg?, robotAlt?, title? }
   *         ★coords: true(K16 격자 좌표 — 위 A·B·C…, 왼쪽 1·2·3…, 칸 이름 'C4'), cardLabels: { forward: '앞으로', … }(K19 카드 이름 바꾸기),
   *         ★mode: 'trace'(K15 추적 모드) + program: ['forward', 'right', { repeat: 2, body: ['forward'] }, 'fn', …] + defs?: [{ name, body }] — 학생이 멈출 칸을 먼저 누르고(R12) [실행해 보기].
   *           답은 코어가 program을 돌려 계산(데이터에 답 칸 없음). 틀리면 "다시 해 봐요" + [한 줄씩 보기](줄마다 강조). 맞히면 쪽 완료
   *         ★success?: { key }(K9 열쇠 조각 번호 — 일반·추적 모드 모두. 처음 풀면 승리 칸에 "열쇠 조각 n을 얻었어요", app.js 수첩 openedKeys가 solved로 셈. 70-gap-meeting 1)
   * 저장(ctx.setData): { solved: 시각, cards: 가장 적게 쓴 카드 수, stars: 가장 높은 별, runs: 실행 수, key } (추적 모드: { solved, runs, key }) */
  const coordName = (x, y) => `${String.fromCharCode(65 + x)}${y + 1}`;
  const DIRS = { N: 0, E: 1, S: 2, W: 3, up: 0, right: 1, down: 2, left: 3 };
  const DX = [0, 1, 0, -1], DY = [-1, 0, 1, 0], DIR_KO = ['위쪽', '오른쪽', '아래쪽', '왼쪽'];
  const CARDS = {
    forward: { label: '앞으로 한 칸', ic: '↑' },
    left: { label: '왼쪽으로 돌기', ic: '↶' },
    right: { label: '오른쪽으로 돌기', ic: '↷' },
    repeat: { label: '반복', ic: '⟳' },
    fn: { label: '함수', ic: 'ƒ' },
    lightoff: { label: '불 끄기', ic: '◐' },
  };
  function pathParse(o) {
    const rows = (o.grid || []).map((r) => String(r)); const H = rows.length, Wd = Math.max(0, ...rows.map((r) => r.length));
    let S = null, E = null; const cells = [];
    rows.forEach((r, y) => { for (let x = 0; x < Wd; x++) { const ch = r[x] || '#'; cells.push(ch); if (ch === 'S') S = { x, y }; if (ch === 'E') E = { x, y }; } });
    const at = (x, y) => (x < 0 || y < 0 || x >= Wd || y >= H ? '#' : cells[y * Wd + x]);
    return { rows, H, W: Wd, S, E, at, dir: DIRS[o.dir] != null ? DIRS[o.dir] : 1 };
  }
  // 반복·함수 없이 가장 짧은 카드 수(앞으로·왼쪽·오른쪽, lightoff 카드가 있으면 불 끄기도). 못 가면 null
  function pathShortest(o) {
    const P = pathParse(o); if (!P.S || !P.E) return null;
    const canOff = (o.cards || []).includes('lightoff') || (o.fn && (o.fn.body || []).includes('lightoff'));
    const key = (x, y, d, l) => `${x},${y},${d},${l}`;
    const q = [[P.S.x, P.S.y, P.dir, 1, 0]], seen = new Set([key(P.S.x, P.S.y, P.dir, 1)]);
    while (q.length) {
      const [x, y, d, l, n] = q.shift();
      const nx = [];
      const fx = x + DX[d], fy = y + DY[d], t = P.at(fx, fy);
      if (t !== '#' && !(t === 'L' && l)) { if (fx === P.E.x && fy === P.E.y) return n + 1; nx.push([fx, fy, d, l]); }
      nx.push([x, y, (d + 3) % 4, l], [x, y, (d + 1) % 4, l]);
      if (canOff && l) nx.push([x, y, d, 0]);
      nx.forEach(([a, b, c, e]) => { const k = key(a, b, c, e); if (!seen.has(k) && n < 200) { seen.add(k); q.push([a, b, c, e, n + 1]); } });
    }
    return null;
  }
  // K15 추적 모드: program을 줄 번호 붙은 나무로(반복 = { rep, body }, 그 밖 = { t }) — 화면 줄과 실행 기록이 같은 번호를 쓴다
  function traceTree(prog) { let n = 0; const walk = (list) => (list || []).map((it) => (it && typeof it === 'object' && it.repeat != null ? { id: n++, rep: Math.max(1, Math.round(+it.repeat) || 1), body: walk(it.body) } : { id: n++, t: String(it) })); return walk(prog); }
  // program을 돌려 한 걸음씩 기록 { tree, steps: [{ line, x, y, d, laser, hit? }], end, hit } — 벽·켜진 레이저 앞에서는 그 자리에 멈춤
  function pathTrace(o) {
    const P = pathParse(o); if (!P.S) return null;
    const tree = traceTree(o.program), steps = []; let p = { x: P.S.x, y: P.S.y, d: P.dir }, laser = 1, hit = null;
    const run = (list) => {
      for (const it of list) {
        if (hit || steps.length > 300) return;
        if (it.rep) { for (let k = 0; k < it.rep && !hit; k++) run(it.body); continue; }
        for (const c of it.t === 'fn' ? ((o.fn && o.fn.body) || []) : [it.t]) {
          if (hit) return;
          if (c === 'left') p = { ...p, d: (p.d + 3) % 4 }; else if (c === 'right') p = { ...p, d: (p.d + 1) % 4 }; else if (c === 'lightoff') laser = 0;
          else if (c === 'forward') { const nx = p.x + DX[p.d], ny = p.y + DY[p.d], tt = P.at(nx, ny); if (tt === '#' || (tt === 'L' && laser)) { hit = { line: it.id, x: nx, y: ny }; steps.push({ line: it.id, ...p, laser, hit: true }); return; } p = { x: nx, y: ny, d: p.d }; }
          steps.push({ line: it.id, ...p, laser });
        }
      }
    };
    run(tree);
    return { tree, steps, end: { x: p.x, y: p.y, d: p.d }, hit };
  }
  function pathCode(el, o = {}, ctx0 = {}) {
    const ctx = ctxOf(ctx0), id = `pc${++gN}`;
    const P = pathParse(o);
    const avail = (o.cards || ['forward', 'left', 'right']).filter((c) => CARDS[c] && (c !== 'fn' || (o.fn && (o.fn.body || []).length)));
    const maxCards = Math.max(1, o.maxCards || 10), repeatMax = Math.max(2, o.repeatMax || 5);
    const best = o.best || pathShortest(o) || maxCards;
    const fnName = (o.fn && o.fn.name) || '함수';
    const saved = ctx.data() || {};
    const R = { prog: [], target: null, uid: 0, running: false, timer: 0, pos: null, runs: saved.runs || 0, bestCards: saved.cards || 0, stars: saved.stars || 0, solved: saved.solved || 0 };
    const lab = (t) => ((o.cardLabels || {})[t] || (CARDS[t] || { label: t }).label);
    const cardName = (t) => (t === 'fn' ? fnName : lab(t));
    const count = (list) => list.reduce((a, it) => a + 1 + (it.t === 'repeat' ? count(it.body) : 0), 0);
    const findItem = (u, list = R.prog) => { for (const it of list) { if (it.u === u) return it; if (it.t === 'repeat') { const f = findItem(u, it.body); if (f) return f; } } return null; };
    const removeItem = (u, list = R.prog) => { const i = list.findIndex((it) => it.u === u); if (i >= 0) { list.splice(i, 1); return true; } return list.some((it) => it.t === 'repeat' && removeItem(u, it.body)); };
    const say = (t) => { const s = el.querySelector('[data-say]'); if (s) s.innerHTML = t; ctx.announce(String(t).replace(/<[^>]+>/g, '')); };
    const starStr = (n) => '★'.repeat(n) + '☆'.repeat(3 - n);
    const robotHTML = () => (o.robotImg ? `<img src="${esc(o.robotImg)}" alt="" draggable="false"><span class="pc-arrow" aria-hidden="true">▲</span>`
      : '<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="22" r="15" fill="var(--series-accent, #2FB78A)"/><circle cx="14.5" cy="22" r="3" fill="#fff"/><circle cx="25.5" cy="22" r="3" fill="#fff"/><path d="M20 1l7 9H13z" fill="var(--ink, #141A33)"/></svg>');
    const itemHTML = (it, depth) => {
      const base = `<span class="pc-ic" aria-hidden="true">${CARDS[it.t].ic}</span><span class="pc-lb">${esc(cardName(it.t))}</span>`;
      if (it.t !== 'repeat') return `<li class="pc-item" data-u="${it.u}">${base}<button type="button" class="pc-x" data-del="${it.u}" aria-label="${esc(cardName(it.t))} 카드 빼기">×</button></li>`;
      const sel = R.target === it.u;
      return `<li class="pc-item pc-rep${sel ? ' target' : ''}" data-u="${it.u}"><div class="pc-rep-h">${base}
        <span class="pc-n"><button type="button" data-n="${it.u}" data-d="-1" aria-label="반복 횟수 줄이기">−</button><b aria-live="polite">${it.n}번</b><button type="button" data-n="${it.u}" data-d="1" aria-label="반복 횟수 늘리기">+</button></span>
        <button type="button" class="btn small ghost pc-into" data-into="${it.u}" aria-pressed="${sel}">${sel ? '여기에 넣는 중' : '안에 넣기'}</button><button type="button" class="pc-x" data-del="${it.u}" aria-label="반복 카드와 안의 카드 빼기">×</button></div>
        <ol class="pc-body pc-drop" data-drop="${it.u}" aria-label="반복 안 카드">${it.body.map((x) => itemHTML(x, depth + 1)).join('') || '<li class="pc-empty">카드를 여기에 넣어요</li>'}</ol></li>`;
    };
    function mapHTML(pick) {
      const cell = (x, y) => { const t = P.at(x, y), cls = `pc-c ${t === '#' ? 'wall' : t === 'L' ? 'laser' : t === 'E' ? 'exit' : t === 'S' ? 'start' : ''}`, inner = t === 'E' ? '<span>출구</span>' : t === 'L' ? '<span>레이저</span>' : '', nm = coordName(x, y);
        return pick && t !== '#' ? `<button type="button" class="${cls} pc-pick" data-cell="${x},${y}" aria-label="${nm}${t === 'S' ? ' 출발' : t === 'E' ? ' 출구' : ''}" aria-pressed="false">${inner}</button>` : `<i class="${cls}"${o.coords ? ` title="${nm}"` : ''}>${inner}</i>`; };
      const map = `<div class="pc-map" ${pick ? 'role="group" aria-label="지도: 로봇이 멈출 칸을 눌러요"' : `role="img" aria-label="지도 ${P.W}×${P.H}칸. 출발${o.coords && P.S ? ` ${coordName(P.S.x, P.S.y)}` : ''}에서 ${DIR_KO[P.dir]}을 보고 있어요.${P.E ? ` 출구${o.coords ? ` ${coordName(P.E.x, P.E.y)}` : ''}까지 가요.` : ''}"`} style="--cols:${P.W};--rows:${P.H}">
            ${P.rows.map((r, y) => Array.from({ length: P.W }, (_, x) => cell(x, y)).join('')).join('')}
            <div class="pc-bot" data-bot>${robotHTML()}</div>
          </div>`;
      if (!o.coords) return map;
      return `<div class="pc-cw" style="--cols:${P.W};--rows:${P.H}"><span></span><div class="pc-cx" aria-hidden="true">${Array.from({ length: P.W }, (_, x) => `<b>${String.fromCharCode(65 + x)}</b>`).join('')}</div><div class="pc-cy" aria-hidden="true">${Array.from({ length: P.H }, (_, y) => `<b>${y + 1}</b>`).join('')}</div>${map}</div>`;
    }
    function draw() {
      const n = count(R.prog);
      el.innerHTML = `<div class="widget pcode" id="${id}">
        ${o.title ? `<p class="pc-title">${esc(o.title)}</p>` : ''}${o.goal ? `<p class="pc-goal"><b>목표</b> ${esc(o.goal)}</p>` : ''}
        <div class="pc-row">
          ${mapHTML(false)}
          <div class="pc-side">
            <p class="pc-h">명령 카드 <small>눌러서 넣기${'ontouchstart' in window ? '' : ' · 끌어 넣기'}</small></p>
            <div class="pc-palette" role="group" aria-label="명령 카드">${avail.map((t) => `<button type="button" class="pc-card" data-add="${t}"><span class="pc-ic" aria-hidden="true">${CARDS[t].ic}</span>${esc(cardName(t))}</button>`).join('')}</div>
            ${o.fn && avail.includes('fn') ? `<details class="pc-fn" open><summary>함수 「${esc(fnName)}」 안</summary><ol>${(o.fn.body || []).map((t) => `<li>${esc(lab(t))}</li>`).join('')}</ol></details>` : ''}
            <p class="pc-h">내 코드 <small class="pc-cnt">${n} / ${maxCards}장</small></p>
            <ol class="pc-prog pc-drop${R.target == null ? ' target' : ''}" data-drop="main" aria-label="내 코드">${R.prog.map((it) => itemHTML(it, 0)).join('') || '<li class="pc-empty">카드를 눌러 여기에 넣어요</li>'}</ol>
            ${R.target != null ? '<p class="fine pc-tgt">새 카드는 고른 반복 안에 들어가요. <button type="button" class="link-btn" data-into="main">밖에 넣기</button></p>' : ''}
            <p class="pc-act"><button type="button" class="btn primary" data-run${n ? '' : ' disabled'}>실행</button><button type="button" class="btn small" data-home>처음 자리로</button><button type="button" class="btn small ghost" data-clear${n ? '' : ' disabled'}>모두 지우기</button></p>
          </div>
        </div>
        <p class="pc-say" data-say aria-live="polite">${R.solved ? `해낸 퍼즐이에요 · ${starStr(R.stars)} 카드 ${R.bestCards}장. 더 적은 카드로 도전해 봐요.` : ''}</p>
        <div class="pc-win" data-win hidden></div>
        ${ctx.teacher ? `<p class="teacher-only fine">교사 참고: 반복·함수 없이 가장 짧은 길 ${pathShortest(o) || '없음'}장 · ★★★ 기준 ${best}장 이하</p>` : ''}
      </div>`;
      place(R.pos || { x: P.S ? P.S.x : 0, y: P.S ? P.S.y : 0, d: P.dir }, true);
      bind();
    }
    function place(p, instant) {
      R.pos = p;
      const b = el.querySelector('[data-bot]'); if (!b) return;
      if (instant || reduce()) b.style.transition = 'none'; else b.style.transition = '';
      b.style.left = `${(p.x / P.W) * 100}%`; b.style.top = `${(p.y / P.H) * 100}%`;
      const rot = o.robotImg ? b.querySelector('.pc-arrow') : b.querySelector('svg');
      if (rot) rot.style.transform = `rotate(${p.d * 90}deg)`;
      if (instant) { void b.offsetWidth; b.style.transition = ''; }
    }
    const add = (t, where) => {
      if (R.running) return;
      if (count(R.prog) >= maxCards) { say(`카드는 ${maxCards}장까지 쓸 수 있어요. 반복이나 함수로 줄여 봐요.`); return; }
      const into = where != null ? where : R.target;
      const host = into != null && into !== 'main' ? findItem(+into) : null;
      if (host && t === 'repeat') { say('반복 안에 반복은 넣을 수 없어요.'); return; }
      const it = t === 'repeat' ? { t, u: ++R.uid, n: 2, body: [] } : { t, u: ++R.uid };
      (host ? host.body : R.prog).push(it);
      if (t === 'repeat') R.target = it.u;
      clearMarks(); draw();
      say(`${esc(cardName(t))} 카드를 ${host ? '반복 안에' : '내 코드에'} 넣었어요. ${count(R.prog)} / ${maxCards}장.${t === 'repeat' ? ' 이제 넣는 카드는 이 반복 안에 들어가요.' : ''}`);
    };
    const clearMarks = () => el.querySelectorAll('.pc-item.bad, .pc-item.running').forEach((x) => x.classList.remove('bad', 'running'));
    // 실행할 차례 펼치기: [{ t, u }] (반복은 n번, 함수는 몸통). 너무 길면 300에서 자름
    const flat = (list, out = [], via = null) => {
      for (const it of list) {
        if (out.length > 300) break;
        if (it.t === 'repeat') for (let k = 0; k < it.n; k++) flat(it.body, out, via);
        else if (it.t === 'fn') (o.fn.body || []).forEach((t) => out.push({ t, u: via != null ? via : it.u }));
        else out.push({ t: it.t, u: via != null ? via : it.u });
      }
      return out;
    };
    const stop = () => { clearTimeout(R.timer); R.running = false; el.querySelectorAll('[data-run], [data-home], [data-clear], .pc-card, .pc-x, [data-n], [data-into]').forEach((b) => { b.disabled = false; }); const rb = el.querySelector('[data-run]'); if (rb && !count(R.prog)) rb.disabled = true; };
    function run() {
      if (R.running || !R.prog.length) return;
      clearMarks(); R.runs++;
      const steps = flat(R.prog); let k = 0, laser = 1;
      let p = { x: P.S.x, y: P.S.y, d: P.dir }; place(p, true);
      R.running = true;
      el.querySelectorAll('[data-run], [data-home], [data-clear], .pc-card, .pc-x, [data-n], [data-into]').forEach((b) => { b.disabled = true; });
      const win = el.querySelector('[data-win]'); win.hidden = true;
      say('실행 중이에요…');
      const mark = (u, cls) => { const li = el.querySelector(`.pc-item[data-u="${u}"]`); if (li) li.classList.add(cls); return li; };
      const tick = () => {
        el.querySelectorAll('.pc-item.running').forEach((x) => x.classList.remove('running'));
        if (k >= steps.length) { stop(); ctx.setData({ runs: R.runs }); say(`출구까지 가지 못했어요. 로봇이 멈춘 곳(${DIR_KO[p.d]}을 봄)을 보고 카드를 더하거나 고쳐요.`); return; }
        const s = steps[k++]; mark(s.u, 'running');
        if (s.t === 'left') p = { ...p, d: (p.d + 3) % 4 };
        else if (s.t === 'right') p = { ...p, d: (p.d + 1) % 4 };
        else if (s.t === 'lightoff') { laser = 0; el.querySelector('.pc-map').classList.add('dark'); }
        else if (s.t === 'forward') {
          const nx = p.x + DX[p.d], ny = p.y + DY[p.d], t = P.at(nx, ny);
          if (t === '#' || (t === 'L' && laser)) {
            stop(); const li = mark(s.u, 'bad'); const b = el.querySelector('[data-bot]'); shake(b);
            const pos = [...el.querySelectorAll('.pc-item:not(.pc-rep)')].indexOf(li) + 1;
            ctx.setData({ runs: R.runs });
            say(`<span class="xl-dot" aria-hidden="true"></span> <b>${t === 'L' ? '레이저' : '벽'}에 부딪혔어요.</b> 주황 점 카드${pos > 0 ? `(${pos}번째)` : ''}에서 멈췄어요. 그 앞에서 방향을 바꿔 다시 해 봐요.`);
            if (li) { li.tabIndex = -1; li.focus({ preventScroll: true }); }
            return;
          }
          p = { x: nx, y: ny, d: p.d };
        }
        place(p);
        if (P.E && p.x === P.E.x && p.y === P.E.y) { stop(); success(); return; }
        R.timer = setTimeout(tick, reduce() ? 120 : 420);
      };
      R.timer = setTimeout(tick, reduce() ? 60 : 250);
    }
    function success() {
      const n = count(R.prog), stars = n <= best ? 3 : n <= best + 2 ? 2 : 1;
      const first = !R.solved;
      R.solved = R.solved || Date.now(); R.stars = Math.max(R.stars, stars); R.bestCards = R.bestCards ? Math.min(R.bestCards, n) : n;
      ctx.setData({ solved: R.solved, cards: R.bestCards, stars: R.stars, runs: R.runs, key: keyNum(o) });
      const lit = first ? ctx.done() : false;
      if (ctx.onKey && keyNum(o) != null) ctx.onKey(keyNum(o));
      const win = el.querySelector('[data-win]');
      win.hidden = false;
      win.innerHTML = `<p class="pc-stars" aria-label="별 ${stars}개">${starStr(stars)}</p><p><b>출구 도착!</b> 카드 ${n}장${stars < 3 ? ` · ${best}장 이하로 줄이면 ★★★` : ' · 가장 짧은 코드예요'}</p>${o.explain ? `<p class="fine">${esc(o.explain)}</p>` : ''}${keyGotHTML(o, ctx)}`;
      say(`<b>출구 도착!</b> 별 ${stars}개, 카드 ${n}장.${lit && ctx.say ? ` ${esc(ctx.say)} 켜졌어요.` : ''}`);
      win.tabIndex = -1; win.focus({ preventScroll: false });
    }
    function bind() {
      const root = el.querySelector('.pcode');
      root.querySelectorAll('[data-add]').forEach((b) => {
        b.addEventListener('click', () => { if (b._dragged) { b._dragged = false; return; } add(b.dataset.add); });
        b.addEventListener('pointerdown', (e) => { // 마우스·펜 끌어 넣기(터치는 누르기만)
          if (e.pointerType === 'touch' || e.button !== 0) return;
          const sx = e.clientX, sy = e.clientY; let ghost = null;
          const over = (ev) => { const t = document.elementFromPoint(ev.clientX, ev.clientY); return t && t.closest && t.closest('.pc-drop'); };
          const move = (ev) => {
            if (!ghost && Math.hypot(ev.clientX - sx, ev.clientY - sy) < 6) return;
            if (!ghost) { ghost = b.cloneNode(true); ghost.classList.add('pc-ghost'); ghost.setAttribute('aria-hidden', 'true'); document.body.appendChild(ghost); }
            ghost.style.left = `${ev.clientX}px`; ghost.style.top = `${ev.clientY}px`;
            const d = over(ev); root.querySelectorAll('.pc-drop').forEach((x) => x.classList.toggle('over', x === d));
          };
          const up = (ev) => {
            document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', up);
            if (!ghost) return;
            ghost.remove(); b._dragged = true; setTimeout(() => { b._dragged = false; }, 0);
            root.querySelectorAll('.pc-drop.over').forEach((x) => x.classList.remove('over'));
            const d = over(ev); if (d && root.contains(d)) add(b.dataset.add, d.dataset.drop);
          };
          document.addEventListener('pointermove', move); document.addEventListener('pointerup', up);
        });
      });
      root.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', () => { const u = +b.dataset.del, it = findItem(u); removeItem(u); if (R.target === u) R.target = null; clearMarks(); draw(); say(`${it ? esc(cardName(it.t)) : ''} 카드를 뺐어요. ${count(R.prog)} / ${maxCards}장.`); const f = el.querySelector('.pc-card'); if (f) f.focus({ preventScroll: true }); }));
      root.querySelectorAll('[data-n]').forEach((b) => b.addEventListener('click', () => { const it = findItem(+b.dataset.n); if (!it) return; it.n = Math.min(repeatMax, Math.max(2, it.n + +b.dataset.d)); draw(); say(`반복 ${it.n}번.`); const nb = el.querySelector(`[data-n="${it.u}"][data-d="${b.dataset.d}"]`); if (nb) nb.focus(); }));
      root.querySelectorAll('[data-into]').forEach((b) => b.addEventListener('click', () => { const v = b.dataset.into; R.target = v === 'main' || R.target === +v ? null : +v; draw(); say(R.target == null ? '새 카드는 내 코드 맨 아래에 들어가요.' : '새 카드는 고른 반복 안에 들어가요.'); const f = el.querySelector('.pc-card'); if (f) f.focus({ preventScroll: true }); }));
      const rb = root.querySelector('[data-run]'); if (rb) rb.addEventListener('click', run);
      root.querySelector('[data-home]').addEventListener('click', () => { clearMarks(); el.querySelector('.pc-map').classList.remove('dark'); place({ x: P.S.x, y: P.S.y, d: P.dir }, true); say('로봇을 출발 자리로 옮겼어요.'); });
      const cb = root.querySelector('[data-clear]'); if (cb) cb.addEventListener('click', () => { R.prog = []; R.target = null; draw(); place({ x: P.S.x, y: P.S.y, d: P.dir }, true); say('카드를 모두 지웠어요.'); });
    }
    if (o.mode === 'trace') { if (!P.S) { el.innerHTML = '<div class="widget pcode"><p class="fine">지도에 출발(S)이 있어야 해요.</p></div>'; return; } traceMode(); return; }
    if (!P.S || !P.E) { el.innerHTML = '<div class="widget pcode"><p class="fine">지도에 출발(S)과 출구(E)가 있어야 해요.</p></div>'; return; }
    draw();
    // K15 추적 모드: 코드를 읽고 로봇이 멈출 칸을 먼저 고른 뒤 [실행해 보기]
    function traceMode() {
      const T = pathTrace(o); let pick = null, timer = 0, stepI = -1, runs = (ctx.data() || {}).runs || 0;
      const lineHTML = (it) => (it.rep ? `<li class="pc-tl pc-trep" data-line="${it.id}"><span><span class="pc-ic" aria-hidden="true">${CARDS.repeat.ic}</span>${esc(lab('repeat'))} ${it.rep}번</span><ol>${it.body.map(lineHTML).join('')}</ol></li>`
        : `<li class="pc-tl" data-line="${it.id}"><span><span class="pc-ic" aria-hidden="true">${(CARDS[it.t] || { ic: '·' }).ic}</span>${esc(it.t === 'fn' ? fnName : lab(it.t))}</span></li>`);
      el.innerHTML = `<div class="widget pcode trace" id="${id}">
        ${o.title ? `<p class="pc-title">${esc(o.title)}</p>` : ''}${o.goal ? `<p class="pc-goal"><b>목표</b> ${esc(o.goal)}</p>` : ''}
        <div class="pc-row">${mapHTML(true)}
          <div class="pc-side">
            ${(o.defs || []).length ? `<p class="pc-h">명령 뜻</p><dl class="pc-defs">${o.defs.map((d) => `<div><dt>${esc(d.name)}</dt><dd>${esc(d.body)}</dd></div>`).join('')}</dl>` : ''}
            ${o.fn && (o.program || []).includes('fn') ? `<details class="pc-fn" open><summary>함수 「${esc(fnName)}」 안</summary><ol>${(o.fn.body || []).map((t) => `<li>${esc(lab(t))}</li>`).join('')}</ol></details>` : ''}
            <p class="pc-h">코드 <small>위에서부터 차례로</small></p>
            <ol class="pc-tprog" aria-label="읽을 코드">${(T ? T.tree : []).map(lineHTML).join('')}</ol>
            <p class="pc-h">로봇이 멈출 칸 <small data-pickname>지도에서 칸을 눌러 골라요</small></p>
            <p class="pc-act"><button type="button" class="btn primary" data-trun aria-disabled="true">실행해 보기</button><button type="button" class="btn small" data-tstep hidden>한 줄씩 보기</button><button type="button" class="btn small ghost" data-thome>처음 자리로</button></p>
          </div>
        </div>
        <p class="pc-say" data-say aria-live="polite">${ctx.isDone ? '맞힌 퍼즐이에요. 다시 해 봐도 돼요.' : ''}</p>
        <div class="pc-win" data-win hidden></div>
        ${ctx.teacher && T ? `<p class="teacher-only fine">교사 참고: 로봇은 ${coordName(T.end.x, T.end.y)}에서 멈춰요${T.hit ? '(벽 앞)' : ''}.</p>` : ''}
      </div>`;
      const home = () => { clearTimeout(timer); stepI = -1; el.querySelectorAll('.pc-tl.running').forEach((x) => x.classList.remove('running')); el.querySelector('.pc-map').classList.remove('dark'); place({ x: P.S.x, y: P.S.y, d: P.dir }, true); };
      home();
      const mark = (s) => { el.querySelectorAll('.pc-tl.running').forEach((x) => x.classList.remove('running')); const li = s && el.querySelector(`.pc-tl[data-line="${s.line}"]`); if (li) li.classList.add('running'); if (s && !s.laser) el.querySelector('.pc-map').classList.add('dark'); if (s) place(s); };
      const runBtn = el.querySelector('[data-trun]'), stepBtn = el.querySelector('[data-tstep]');
      el.querySelectorAll('[data-cell]').forEach((b) => b.addEventListener('click', () => {
        const [x, y] = b.dataset.cell.split(',').map(Number); pick = { x, y };
        el.querySelectorAll('[data-cell]').forEach((c) => { const on = c === b; c.setAttribute('aria-pressed', String(on)); c.classList.toggle('picked', on); });
        el.querySelector('[data-pickname]').textContent = `${coordName(x, y)}${/[2459]$/.test(coordName(x, y)) ? '를' : '을'} 골랐어요`;
        runBtn.setAttribute('aria-disabled', 'false');
        say(`${coordName(x, y)}${/[2459]$/.test(coordName(x, y)) ? '를' : '을'} 골랐어요. [실행해 보기]를 눌러요.`);
      }));
      runBtn.addEventListener('click', () => {
        if (!T) return;
        if (!pick) { say('먼저 지도에서 로봇이 멈출 칸을 눌러요.'); const c = el.querySelector('[data-cell]'); if (c) c.focus(); return; }
        home(); runs++; stepBtn.hidden = true; el.querySelector('[data-win]').hidden = true;
        let k = 0;
        const tick = () => {
          if (k >= T.steps.length) {
            mark(null);
            const okv = pick.x === T.end.x && pick.y === T.end.y;
            if (okv) {
              const lit = ctx.done(); ctx.setData({ solved: Date.now(), runs, key: keyNum(o) }); beep('win');
              if (ctx.onKey && keyNum(o) != null) ctx.onKey(keyNum(o));
              const w = el.querySelector('[data-win]'); w.hidden = false; w.innerHTML = `<p><span class="xl-okmark" aria-hidden="true">✓</span> <b>맞았어요!</b> 로봇은 ${coordName(T.end.x, T.end.y)}에서 멈춰요.</p>${o.explain ? `<p class="fine">${esc(o.explain)}</p>` : ''}${keyGotHTML(o, ctx)}`;
              say(`<b>맞았어요!</b>${lit && ctx.say ? ` ${esc(ctx.say)} 켜졌어요.` : ''}`); w.tabIndex = -1; w.focus({ preventScroll: false });
            } else {
              ctx.setData({ runs }); beep('no'); shake(el.querySelector(`[data-cell="${pick.x},${pick.y}"]`));
              stepBtn.hidden = false;
              say('<span class="xl-dot" aria-hidden="true"></span> 다시 해 봐요. [한 줄씩 보기]로 코드를 한 줄씩 따라가 봐요.');
              stepBtn.focus();
            }
            return;
          }
          mark(T.steps[k++]); timer = setTimeout(tick, reduce() ? 120 : 450);
        };
        timer = setTimeout(tick, reduce() ? 60 : 250);
      });
      stepBtn.addEventListener('click', () => {
        if (stepI < 0) home();
        stepI++;
        if (stepI >= T.steps.length) { mark(null); say('코드 끝까지 왔어요. 멈출 칸을 다시 골라 [실행해 보기]를 눌러요.'); stepI = -1; return; }
        const s = T.steps[stepI]; mark(s);
        const li = el.querySelector(`.pc-tl[data-line="${s.line}"] > span`);
        say(`${stepI + 1}번째: ${li ? li.textContent : ''}${s.hit ? ' — 벽이라 그 자리에 멈춰요' : ''}`);
      });
      el.querySelector('[data-thome]').addEventListener('click', () => { home(); say('로봇을 출발 자리로 옮겼어요.'); });
    }

  }

  /* ================= C5. 생각 나누기·윤리 딜레마 dilemma =================
   * opts: { title?, situation(HTML 한두 문장), img?, alt?, q, options: [{ text, think }], reasonPh?, minReason: 5, note?(정답 없음 안내) }
   * 저장(ctx.setData): { choice: 보기 번호, reason: 까닭, at: 시각 } */
  function dilemma(el, o = {}, ctx0 = {}) {
    const ctx = ctxOf(ctx0), id = `dl${++gN}`;
    const opts = (o.options || []).filter((x) => x && x.text);
    const min = o.minReason != null ? +o.minReason : 5;
    const saved = ctx.data() || {};
    let pick = saved.choice != null && saved.choice < opts.length ? +saved.choice : null;
    const say = (t) => { const s = el.querySelector('[data-say]'); if (s) s.innerHTML = t; ctx.announce(String(t).replace(/<[^>]+>/g, '')); };
    el.innerHTML = `<div class="widget dilemma" id="${id}">
      ${o.title ? `<p class="dl-title">${esc(o.title)}</p>` : ''}
      ${o.situation || o.img ? `<div class="dl-sit">${o.img ? `<img src="${esc(o.img)}" alt="${esc(o.alt || '')}" loading="lazy">` : ''}${o.situation ? `<p>${o.situation}</p>` : ''}</div>` : ''}
      <p class="dl-q" id="${id}-q">${esc(o.q)}</p>
      <div class="dl-opts" role="radiogroup" aria-labelledby="${id}-q">${opts.map((x, k) => `<button type="button" class="dl-opt" role="radio" data-k="${k}" aria-checked="${pick === k}" tabindex="${(pick == null ? k === 0 : pick === k) ? 0 : -1}"><span class="dl-mark" aria-hidden="true">${String.fromCharCode(65 + k)}</span>${esc(x.text)}</button>`).join('')}</div>
      <label class="field dl-why"><span>왜 그렇게 생각했나요?</span><textarea rows="3" maxlength="300" placeholder="${esc(o.reasonPh || '내 생각의 까닭을 한두 문장으로 적어요.')}">${esc(saved.reason || '')}</textarea></label>
      <p class="dl-act"><button type="button" class="btn primary" data-save>내 생각 정하기</button><span class="fine" data-need></span></p>
      <p class="dl-say" data-say aria-live="polite"></p>
      <div class="dl-think" data-think hidden></div>
    </div>`;
    const root = el.querySelector('.dilemma'), ta = root.querySelector('textarea'), btn = root.querySelector('[data-save]'), need = root.querySelector('[data-need]');
    const sync = () => {
      const len = ta.value.trim().length, okv = pick != null && len >= min;
      btn.setAttribute('aria-disabled', String(!okv));
      need.textContent = pick == null ? ' 먼저 하나를 골라요.' : len < min ? ` 까닭을 ${min}자 이상 적어요(지금 ${len}자).` : '';
    };
    const choose = (k, focus) => {
      pick = k;
      root.querySelectorAll('.dl-opt').forEach((b) => { const on = +b.dataset.k === k; b.setAttribute('aria-checked', String(on)); b.tabIndex = on ? 0 : -1; if (on && focus) b.focus(); });
      sync();
    };
    const showThink = () => {
      const th = root.querySelector('[data-think]'), x = opts[pick];
      th.hidden = false;
      const others = opts.map((y, k) => (k === pick || !y.think ? '' : `<li><b>${String.fromCharCode(65 + k)}. ${esc(y.text)}</b> ${esc(y.think)}</li>`)).join('');
      th.innerHTML = `<h4>이렇게 생각해 볼 수도 있어요</h4><p>${esc(x.think || '')}</p>${others ? `<details><summary>다른 보기를 고른 친구의 생각도 보기</summary><ul>${others}</ul></details>` : ''}<p class="fine">${esc(o.note || '정답은 없어요. 친구와 서로의 까닭을 이야기해 봐요.')}</p>`;
    };
    root.querySelectorAll('.dl-opt').forEach((b) => {
      b.addEventListener('click', () => choose(+b.dataset.k));
      b.addEventListener('keydown', (e) => {
        const d = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? -1 : 0; if (!d) return;
        e.preventDefault(); choose(((pick == null ? +b.dataset.k : pick) + d + opts.length) % opts.length, true);
      });
    });
    ta.addEventListener('input', sync);
    btn.addEventListener('click', () => {
      if (btn.getAttribute('aria-disabled') === 'true') { say(pick == null ? '먼저 하나를 골라요.' : `까닭을 ${min}자 이상 적어요.`); (pick == null ? root.querySelector('.dl-opt') : ta).focus(); return; }
      ctx.setData({ choice: pick, reason: ta.value.trim(), at: Date.now() });
      const lit = ctx.done();
      showThink();
      say(`<b>${String.fromCharCode(65 + pick)}</b>를 골랐어요. 내 생각을 저장했어요.${lit && ctx.say ? ` ${esc(ctx.say)} 켜졌어요.` : ''}`);
      const th = root.querySelector('[data-think]'); th.tabIndex = -1; th.focus({ preventScroll: false });
    });
    sync();
    if (saved.at && pick != null) showThink();
  }

  W.register('escape-lock', escapeLock);
  W.register('path-code', pathCode);
  W.register('dilemma', dilemma);
  window.GameWidgets = { pathParse, pathShortest, pathTrace, lockValues, giveToks, LOCKS: Object.keys(LOCKS), CARDS: Object.keys(CARDS), toks }; // check-lesson·시험용
})();
