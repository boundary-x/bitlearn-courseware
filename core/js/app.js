/* AI 포니봇 교안 웹앱 엔진
 * 데이터: window.LESSON (js/lesson.js) · 편집기: window.MC (js/makecode.js) · 교사 인증: window.Auth (js/auth.js)
 *
 * 역할
 *  - 학생: 이름(또는 별명)으로 입장. 미션은 순서대로 열리고 정답은 볼 수 없다. 되돌리기는 "내가 통과한 코드"로만.
 *          막히면 "선생님 부르기" → 주황 띠로 도움 요청 → 선생님이 그 자리에서 비밀번호 입력해 통과 처리·시작 코드.
 *  - 교사: 비밀번호로 입장(암호화된 정답을 풂). 모든 미션 열림, 정답·교사 메모, 대시보드, 투사 모드.
 */
(() => {
  const L = window.LESSON;
  // 비트런: 기초로 수업을 완료하고 응용은 별도로 기록한다. 포니봇의 기존 완료 기준은 유지한다.
  const BASIC_FIRST = L.series === 'bitrun';
  const requiredMissions = (lab) => BASIC_FIRST ? lab.missions.filter((m) => !m.optional) : lab.missions;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const h = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
  // 코어 그림(시리즈 공통): 바운더리엑스 캐릭터 '바운디'·런모어와 포니봇 3D 아이콘(core/assets/brand). 모두 장식이라 대체 텍스트는 비움
  // 주소 = CORE(코어 폴더의 절대 주소, core/js/series.js가 정함) + 'assets/…'(S2-1)
  // 차시 그림(주제 장면·빈칸 캐릭터)은 차시 데이터 L.art로 더한다. 코어 키는 차시가 덮어쓰지 못한다(설계 3.9)
  // 11차 이후 정리(D15): 쓰지 않던 키 find·code·fix·oops·pbFront·pbRear·pbWheel은 뺐다(실습 아이콘 pb-front·pb-rear는 lesson.js icon이 직접 가리킴)
  const CORE = window.PONYBOT_CORE || '../core/';
  const ART_CORE = {
    hello: CORE + 'assets/brand/char/boundy-hello.webp', win: CORE + 'assets/brand/char/boundy-win.webp',
    listen: CORE + 'assets/brand/char/boundy-listen.webp', charge: CORE + 'assets/brand/char/boundy-charge.webp',
    pbDrive: CORE + 'assets/brand/ponybot/pb-drive.webp',
    // 캐릭터 2차: 런모어·함께(로고 없는 버전) + 포니봇 활동 장면 — planning/characters-round2.md
    pbMaze: CORE + 'assets/brand/char/pb-scene-maze.webp', pbFixPath: CORE + 'assets/brand/char/pb-scene-fixpath.webp', pbWin: CORE + 'assets/brand/char/pb-scene-win.webp',
    duoHighfive: CORE + 'assets/brand/char/duo-highfive.webp', runmoreGuide: CORE + 'assets/brand/char/runmore-guide.webp',
    // 10차: 빈칸 채움 캐릭터(런모어_바운디_캐릭터 세트_최종, 티셔츠 로고 없음 확인) — planning/field-r9/impl-r10.md
    fillTeacher: CORE + 'assets/brand/char/fill-teacher.webp',
  };
  const ART = Object.assign({}, L.art || {}, ART_CORE);
  // ★시리즈 프리셋(비트런 C1): L.seriesArt = { 코어 키: 주소 } — 포니봇 그림이 든 코어 키(pbDrive·pbMaze·pbFixPath·pbWin 등)를 시리즈 그림으로 바꾼다.
  //   차시 art는 여전히 코어 키를 못 덮는다. series가 없는 포니봇 차시는 seriesArt가 없어 그대로
  Object.entries(L.seriesArt || {}).forEach(([k, v]) => { if (v && k in ART_CORE) ART[k] = v; });
  // 시리즈 강조색(L.theme.accent): 새 칸(화 지도·스토리 이름표·게임 위젯)만 --series-accent로 쓴다. 기존 화면 색은 그대로
  if (L.theme && /^#[0-9a-f]{3,8}$/i.test(String(L.theme.accent || ''))) document.documentElement.style.setProperty('--series-accent', L.theme.accent);
  if (L.series) document.documentElement.dataset.series = String(L.series);

  /* ---------- 10차(사용자 피드백): 빈칸 채움 캐릭터 ----------
   * 같은 줄 카드 높이를 맞추면 짧은 카드에 '의미 없는 빈칸'이 생긴다. 그 빈칸이 120px 이상이면 카드 아래쪽에
   * 주제에 맞는 캐릭터를 빈칸 높이에 맞춰(최대 240px) 넣는다. 배치는 바꾸지 않고(절대 위치), 창 크기가 바뀌면 다시 잰다. 인쇄에서는 숨김.
   * 대상: 이론 본문·그림 카드(쪽의 page.fillArt), 교사 대시보드 카드 줄(L.dashFillArt), 결과 카드의 실습 칸 */
  const fillRO = window.ResizeObserver ? new ResizeObserver((ents) => { const hosts = new Set(); ents.forEach((e) => { const h = e.target.classList.contains('fill-host') ? e.target : e.target.parentElement && e.target.parentElement.closest('.fill-host'); if (h) hosts.add(h); }); hosts.forEach(fitFill); }) : null; // 카드 크기 + 안쪽 내용(늦게 뜨는 그림 등) 크기가 바뀌면 다시 잼
  function fitFill(card) {
    const img = card.querySelector(':scope > .fill-art'); if (!img) return;
    const cr = card.getBoundingClientRect(); if (!cr.height) { img.hidden = true; return; }
    const cs = getComputedStyle(card);
    let bottom = cr.top + parseFloat(cs.paddingTop || 0);
    [...card.children].forEach((ch) => { if (ch === img || ch.hidden) return; const r = ch.getBoundingClientRect(); if (r.height) bottom = Math.max(bottom, r.bottom + parseFloat(getComputedStyle(ch).marginBottom || 0)); });
    const free = cr.bottom - parseFloat(cs.paddingBottom || 0) - bottom - 12;
    if (free < 120) { img.hidden = true; return; }
    img.hidden = false; img.style.height = `${Math.round(Math.min(free, 240))}px`;
  }
  function fillArt(root) {
    if (!root) return;
    const cur = stops.find((x) => x.hash === (location.hash || '#/intro'));
    const fk = cur && cur.page && cur.page.fillArt;
    const targets = [];
    if (fk) { const b = root.querySelector('.theory > .body'); if (b && b.textContent.trim()) targets.push([b, fk]); }
    const rot = L.dashFillArt || ['fillTeacher', 'hello', 'win']; // 교사 대시보드 카드 줄 빈칸 그림 순서(차시가 고름)
    root.querySelectorAll('.page.dash .dash-grid > .dash-card').forEach((c, i) => targets.push([c, rot[i % rot.length]]));
    root.querySelectorAll('.result-made > *').forEach((c) => targets.push([c, 'hello']));
    targets.forEach(([card, key]) => {
      if (!ART[key] || card.querySelector(':scope > .fill-art')) return;
      card.classList.add('fill-host');
      const img = document.createElement('img');
      img.className = 'fill-art'; img.src = ART[key]; img.alt = ''; img.setAttribute('aria-hidden', 'true'); img.decoding = 'async'; img.hidden = true;
      img.addEventListener('load', () => fitFill(card));
      card.append(img);
      if (fillRO) { fillRO.observe(card); [...card.children].forEach((ch) => { if (ch !== img) fillRO.observe(ch); }); }
      card.querySelectorAll('img').forEach((im) => { if (im !== img && !im.complete) im.addEventListener('load', () => fitFill(card), { once: true }); });
      requestAnimationFrame(() => fitFill(card));
    });
  }
  // 이론 페이지 본문 끝 장면 그림 = 쪽의 page.sceneArt(ART 키). 10차 빈칸 캐릭터 = 쪽의 page.fillArt(ART 키, 빈칸이 없으면 안 보임)
  const artImg = (k, cls = '') => `<img class="art ${cls}" src="${ART[k]}" alt="" aria-hidden="true" decoding="async">`;
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  // 상단 바 제목 = 시리즈 이름 + 차시 제목(차시 데이터 L.brand·L.title로 채움, S1-6)
  { const bn = $('.topbar .brand-name'); if (bn) bn.innerHTML = `${esc(L.brand)} <small>${esc(L.title)}</small>`; }
  // MakeCode 미션 정규식 채점(scope별 코드 조각 + re·any·all·not·count·distinctSpeeds): js/makecode-grade.js (S1-6에서 분리)
  const { scopeOf, runCheck, stopIsLast, inOrder } = window.PBGrade;

  /* ---------- 알림(토스트) ----------
   * UI/UX 5차(06 P0-1·03 P1-6·04): 한 번에 하나만(대기열), 같은 묶음(opt.group)은 새로 띄우지 않고 내용만 바꿈,
   * 되돌리기 알림은 줄 맨 앞. 실습 화면에서는 툴바 바로 아래(MakeCode 아래 다운로드·되돌리기 막대를 가리지 않게)에 두고
   * 버튼 말고는 클릭이 그대로 통과한다. 라이브 영역(.toast-host)은 한 번만 만든다. */
  let toastHost = null, toastQ = [], toastCur = null;
  function toastPlace() {
    const host = toastHost; host.removeAttribute('style'); host.classList.remove('in-lab', 'at-editor');
    const tb = $('.lab-toolbar');
    if (!tb || !document.body.classList.contains('lab-mode')) return;
    host.classList.add('in-lab');
    host.style.top = `${Math.round(tb.getBoundingClientRect().bottom) + 8}px`;
    const ed = $('.lab-editor'); const er = ed && ed.offsetWidth ? ed.getBoundingClientRect() : null;
    // 넓은 화면: 편집기 칸 오른쪽 위(도구상자·블록이 놓이는 왼쪽을 피함). 좁은 화면: 가운데
    if (er && er.width >= 480 && window.innerWidth >= 900) { host.classList.add('at-editor'); host.style.left = `${Math.round(er.left)}px`; host.style.width = `${Math.round(er.width)}px`; }
  }
  function toast(msg, kind = 'info', opt = {}) {
    if (!toastHost) toastHost = document.body.appendChild(h('<div class="toast-host" aria-live="polite"></div>'));
    if (opt.group && toastCur && toastCur.group === opt.group) { toastCur.update(msg); return; }
    if ((toastCur && toastCur.msg === msg) || toastQ.some((x) => x.msg === msg)) return;
    const it = { msg, kind, opt };
    if (opt.undo) { toastQ.unshift(it); if (toastCur) toastCur.close(); } else toastQ.push(it);
    if (!toastCur) nextToast();
  }
  function nextToast() {
    toastCur = null; const it = toastQ.shift(); if (!it) return;
    toastPlace();
    const t = h(`<div class="toast ${it.kind}"><span class="toast-msg">${it.msg}</span>${it.opt.undo ? '<button class="btn small" type="button" data-undo>되돌리기</button>' : ''}<button class="toast-x" type="button" aria-label="알림 닫기">×</button></div>`);
    toastHost.append(t);
    const life = it.opt.life || (it.opt.undo ? 10000 : Math.min(7000, Math.max(3500, 2500 + 60 * $('.toast-msg', t).textContent.length)));
    let left = life, start = 0, timer = 0, closed = false;
    const run = () => { clearTimeout(timer); start = Date.now(); timer = setTimeout(close, left); };
    const hold = () => { clearTimeout(timer); left = Math.max(1200, left - (Date.now() - start)); };
    function close() { if (closed) return; closed = true; clearTimeout(timer); t.classList.add('out'); setTimeout(() => { t.remove(); if (toastCur === cur) nextToast(); }, 160); }
    t.addEventListener('pointerenter', hold); t.addEventListener('pointerleave', run);
    t.addEventListener('focusin', hold); t.addEventListener('focusout', run);
    $('.toast-x', t).addEventListener('click', close);
    if (it.opt.undo) $('[data-undo]', t).addEventListener('click', () => { it.opt.undo(); close(); });
    const cur = toastCur = {
      group: it.opt.group, msg: it.msg, close,
      update(m) { this.msg = m; $('.toast-msg', t).innerHTML = m; t.classList.remove('bump'); void t.offsetWidth; t.classList.add('bump'); left = life; run(); },
    };
    run();
  }
  let quotaWarned = false;
  const mk = (area) => ({
    get(k) { try { return JSON.parse(area.getItem(k)); } catch (e) { return null; } },
    set(k, v) {
      try { area.setItem(k, JSON.stringify(v)); }
      catch (e) { if (!quotaWarned) { quotaWarned = true; toast('이 기기의 저장 공간이 가득 차서 진행이 저장되지 않아요. 선생님께 알려 주세요.', 'warn'); } }
    },
    del(k) { try { area.removeItem(k); } catch (e) {} },
  });
  const local = mk(window.localStorage), sess = mk(window.sessionStorage);

  const K = {
    prefs: `ponybot:${L.id}:prefs`,
    users: `ponybot:${L.id}:users`,
    session: `ponybot:${L.id}:session`,
    lock: `ponybot:${L.id}:pinlock`,
    prog: (key) => `ponybot:${L.id}:u:${key}`,
    teacher: `ponybot:${L.id}:teacher`,
    // 교사: 마지막으로 본 수업 페이지, 마지막 투사 종료 시각 (탭 단위, UI/UX 5차 08)
    tlast: `ponybot:${L.id}:teacher-last`,
    presentEnd: `ponybot:${L.id}:present-end`,
    // 학생 도움 요청(탭 단위): 페이지를 옮겨도 남는다(UI/UX 7차 05 P0-3)
    help: `ponybot:${L.id}:help`,
  };
  const TEACHER_ID = '__teacher__';
  const TEACHER_IDLE_MIN = 20;
  // 실습 화면(lab-mode)의 교사는 60분: MakeCode 안에서 블록을 만지는 동안은 앱이 조작을 못 느낀다(9차 D17)
  const TEACHER_IDLE_LAB_MIN = 60;
  // 학생 이름 키가 교사 키(__teacher__)와 같은 저장 공간을 쓰지 않게, 밑줄 두 개로 시작·끝나는 이름은 막는다(UI/UX 5차 08 P0-1)
  const reservedKey = (key) => /^__|__$/.test(String(key || ''));

  /* ---------- 세션 · 진행 상태 ---------- */
  let prefs = Object.assign({ sound: false, present: false, tinfo: false }, local.get(K.prefs) || {});
  const savePrefs = () => local.set(K.prefs, prefs);
  let session = sess.get(K.session); // { role: 'student'|'teacher', name, key }
  if (session && session.role === 'teacher' && !window.Auth.answers()) session = null;
  if (session && session.role === 'student' && !session.key) session.key = String(session.name || '').replace(/\s/g, '').toLowerCase();
  if (session && session.role === 'student' && reservedKey(session.key)) session = null;
  const isTeacher = () => !!session && session.role === 'teacher';
  const userId = () => (isTeacher() ? TEACHER_ID : session.key);

  const blank = () => ({ seen: {}, missions: {}, codeOk: {}, checkpoints: {}, bonus: {}, reflect: {}, quiz: null, order: null, safety: false });
  let state = blank();
  const progKey = () => (isTeacher() ? K.teacher : K.prog(session.key));
  // 교사 진행(미리보기)은 탭 단위(sessionStorage) — 다음 반 수업에 교사가 푼 확인 문제·정답이 남지 않게(UI/UX 5차 08 P0-1)
  const store = () => (isTeacher() ? sess : local);
  const loadState = () => { state = Object.assign(blank(), store().get(progKey()) || {}); };
  // 교사 미리보기 지우기: 진행 기록 + 교사 MakeCode 코드(정답 코드 열기로 넣은 코드 포함) + 스튜디오 되돌리기 기록
  function clearTeacherPreview() {
    sess.del(K.teacher); local.del(K.teacher);
    window.MC && window.MC.clearAll(TEACHER_ID);
    try { Object.keys(localStorage).filter((k) => k.startsWith('ponybot:') && k.includes(`:${TEACHER_ID}:`)).forEach((k) => localStorage.removeItem(k)); } catch (e) {}
    Object.keys(state).forEach((k) => delete state[k]); Object.assign(state, blank());
  }
  const users = () => local.get(K.users) || {};
  function touchUser() {
    if (isTeacher()) return;
    const u = users(); u[session.key] = Object.assign(u[session.key] || { created: Date.now() }, { name: session.name, last: Date.now() }); local.set(K.users, u);
  }
  // 같은 이름으로 탭 두 개를 열어도 기록이 덮어써지지 않게, 저장할 때 다른 탭이 남긴 기록과 합친다(학생 테스트 4차)
  // 9차 B: starNote(도전 메모)·star3(★★★)·stats(미션별 실패·힌트·코드 확인 수)·createLog(AI와 만든 기록)
  // S3-6: records(측정 기록표 — state.records[미션 id][칸 key] = 적은 값)
  const MERGE_KEYS = ['seen', 'missions', 'codeOk', 'checkpoints', 'bonus', 'star1', 'reflect', 'predict', 'starNote', 'star3', 'stats', 'createLog', 'records', 'widgets', 'wdata']; // S3-3: widgets(분류 게임 완료) · ★wdata(비트런: 쪽 id → 스토리 결정·자물쇠 시도·퍼즐 별·딜레마 선택)
  function mergeState(disk, mem) {
    if (!disk || typeof disk !== 'object') return mem;
    const out = Object.assign({}, disk, mem);
    MERGE_KEYS.forEach((k) => { if (disk[k] || mem[k]) out[k] = Object.assign({}, disk[k] || {}, mem[k] || {}); });
    if (disk.quiz || mem.quiz) {
      const a = disk.quiz || {}, b = mem.quiz || {};
      out.quiz = Object.assign({}, (b.at || 0) >= (a.at || 0) ? b : a, { best: Math.max(a.best || 0, b.best || 0) });
      // 9차 D18(C): 첫 시도(first·firstAt)는 더 먼저 남은 기록의 것, 판 수(tries)는 큰 쪽
      const firsts = [a, b].filter((q) => q.first != null).sort((x, y) => (x.firstAt || 0) - (y.firstAt || 0));
      if (firsts.length) { out.quiz.first = firsts[0].first; if (firsts[0].firstAt != null) out.quiz.firstAt = firsts[0].firstAt; }
      if (a.tries || b.tries) out.quiz.tries = Math.max(a.tries || 0, b.tries || 0);
    }
    if (disk.order || mem.order) {
      const a = disk.order || {}, b = mem.order || {};
      if (a.done && !b.done) out.order = Object.assign({}, a);
      if (out.order && (a.tries || b.tries)) out.order = Object.assign({}, out.order, { tries: Math.max(a.tries || 0, b.tries || 0) });
    }
    out.safety = !!(disk.safety || mem.safety);
    return out;
  }
  // state 객체는 바꿔 끼우지 않고 제자리에서 합친다 — 복습 게임 등은 같은 객체를 붙들고 있다(UI/UX 5차 10번: 다시 도전 점수 미저장)
  function persist() { Object.assign(state, mergeState(store().get(progKey()), state)); store().set(progKey(), state); touchUser(); }
  function save() { persist(); renderProgress(); }
  // 이름 칸 40자(9차 D4: 반·모둠·5명 이름이 한 칸에 들어가게)
  const cleanName = (s) => String(s || '').replace(/[:<>"'`\\/]/g, '').replace(/\s+/g, ' ').trim().slice(0, 40);
  // 기록 키: 띄어쓰기·대소문자 무시 + 낱말 순서 무시("민준 서연" = "서연 민준", 9차 D4). 옛 키(순서 그대로 붙임)는 legacyNameKey
  const nameKey = (s) => cleanName(s).toLowerCase().split(' ').filter(Boolean).sort().join('');
  const legacyNameKey = (s) => cleanName(s).replace(/\s/g, '').toLowerCase();

  /* ---------- 비밀번호 오입력 잠금 (입장·선생님 도움 공통, 새로 고침해도 유지) ---------- */
  const lockLeft = () => { const l = local.get(K.lock); return l && l.until > Date.now() ? Math.ceil((l.until - Date.now()) / 1000) : 0; };
  // 돌려주는 값: 잠기기 전까지 남은 횟수(0이면 방금 잠김). 5회 잠금 규칙은 그대로
  function pinFail() { const l = local.get(K.lock) || { fails: 0 }; l.fails = (l.fails || 0) + 1; if (l.fails >= 5) { l.until = Date.now() + 60000; l.fails = 0; } local.set(K.lock, l); return l.until > Date.now() ? 0 : 5 - l.fails; }
  const pinOk = () => local.del(K.lock);
  // 비밀번호 오류 문구(입장·선생님 확인·스튜디오 열기 공통, UI/UX 5차 08 P1-8)
  const pinErrMsg = (ex) => {
    if (!ex.wrongPin) return ex.message;
    const left = pinFail();
    return left > 0 ? `${ex.message} ${left}번 더 틀리면 60초 동안 잠겨요.` : '비밀번호를 5번 틀려서 60초 동안 잠겼어요.';
  };

  /* ---------- 소리 (기본 꺼짐) ---------- */
  let actx = null;
  function beep(kind) {
    if (!prefs.sound) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      const notes = kind === 'win' ? [660, 880, 1320] : kind === 'no' ? [300] : [880];
      notes.forEach((f, i) => {
        const o = actx.createOscillator(); const g = actx.createGain();
        o.type = 'square'; o.frequency.value = f; g.gain.value = 0.04;
        o.connect(g); g.connect(actx.destination);
        const t = actx.currentTime + i * 0.09; o.start(t); o.stop(t + 0.08);
      });
    } catch (e) {}
  }

  /* ---------- 노선도 ---------- */
  const stops = [{ key: 'intro', hash: '#/intro', label: '수업 소개', section: '시작' }];
  L.pages.forEach((p, i) => stops.push({ key: p.id, hash: `#/p/${i}`, label: p.title, section: p.section, type: p.type, page: p }));
  const labs = L.pages.filter((p) => p.type === 'lab');
  /* S3-3 실습 없는 차시(2·13차시): 실습 0개면 NOLAB — 도입·진행·결과 카드·교사 화면을 이론 진행(확인한 쪽·분류 게임·복습 게임)으로 그린다.
   * 퀴즈·순서 맞추기는 0개여도 된다. 둘 다 0개면 복습 게임 정거장을 만들지 않는다. 실습이 있는 차시(3~4·5~6)는 예전 그대로 */
  const NOLAB = !labs.length;
  if (!Array.isArray(L.quiz)) L.quiz = [];
  if (!Array.isArray(L.order)) L.order = [];
  const HAS_QUIZ = L.quiz.length > 0, HAS_ORDER = L.order.length > 0, HAS_REVIEW = HAS_QUIZ || HAS_ORDER;
  if (HAS_REVIEW) stops.push({ key: 'review', hash: '#/review', label: '복습 게임', section: '정리' });
  // 진행에 들어가는 위젯(분류 게임 classify): 다 맞히면 state.widgets[쪽 id]에 남고 진행 칸 1개
  const GAME_WIDGETS = ['classify'];
  const isGamePage = (p) => p.type !== 'lab' && GAME_WIDGETS.includes(p.widget);

  const quizPass = (st) => !!(st.quiz && st.quiz.best >= Math.ceil(Math.min(L.quizPerRound, L.quiz.length) * 0.6));
  function stopDone(s) {
    if (s.key === 'review') return (!HAS_QUIZ || quizPass(state)) && (!HAS_ORDER || !!(state.order && state.order.done));
    if (s.type === 'lab') return requiredMissions(s.page).every((m) => state.missions[m.id]);
    return !!state.seen[s.key];
  }

  // LED: 항목마다 고정 칸 → 무엇을 하든 바로 칸이 늘어난다. (이론 쪽마다 1 + 미션마다 1 + 실습 완주마다 1 + 퀴즈 2 + 순서 2. 3~4차시는 9 + 9 + 3 + 2 + 2 = 25)
  function units(st) {
    const u = [];
    L.pages.forEach((p) => {
      if (p.type === 'lab') {
        p.missions.forEach((m) => u.push({ w: BASIC_FIRST && m.optional ? 0 : 1, done: !!st.missions[m.id], mission: true, opt: !!m.optional, via: st.missions[m.id] && st.missions[m.id].via }));
        u.push({ w: 1, done: requiredMissions(p).every((m) => st.missions[m.id]) });
      } else {
        u.push({ w: 1, done: !!st.seen[p.id], theory: true });
        if (isGamePage(p)) u.push({ w: 1, done: !!(st.widgets || {})[p.id], game: true });
      }
    });
    if (HAS_QUIZ) u.push({ w: 2, done: quizPass(st) });
    if (HAS_ORDER) u.push({ w: 2, done: !!(st.order && st.order.done) });
    return u;
  }
  function summary(st) {
    const u = units(st);
    const total = u.reduce((a, x) => a + x.w, 0), got = u.filter((x) => x.done).reduce((a, x) => a + x.w, 0);
    const ms = u.filter((x) => x.mission);
    return {
      u, total, got, pct: Math.round((got / total) * 100),
      missions: ms.filter((x) => x.done).length, missionTotal: ms.length,
      // 선택 미션(m.optional, 페르소나 2회차 #3): 결과 카드 "필수 n개 + 선택 m개". 선택 미션이 없는 차시(3~4)는 opt 0
      opt: ms.filter((x) => x.opt).length, optDone: ms.filter((x) => x.opt && x.done).length,
      theory: u.filter((x) => x.theory && x.done).length, theoryTotal: u.filter((x) => x.theory).length,
      games: u.filter((x) => x.game && x.done).length, gameTotal: u.filter((x) => x.game).length,
      via: ms.reduce((a, x) => { if (x.done) a[x.via || 'check'] = (a[x.via || 'check'] || 0) + 1; return a; }, {}),
    };
  }
  /* 진행 표시 이름(페르소나 2회차 #8): 차시 L.progressWord(기본 'LED'). 5~6은 '화면 점'(포니봇 불빛 LED와 헷갈리지 않게).
   * PW_IGA = 이름 + 이/가("LED가", "화면 점이") */
  const PW = String(L.progressWord || 'LED');
  const PW_IGA = `${PW}${/[가-힣]$/.test(PW) && (PW.charCodeAt(PW.length - 1) - 0xAC00) % 28 ? '이' : '가'}`;
  const HEART = [0,1,0,1,0, 1,1,1,1,1, 1,1,1,1,1, 0,1,1,1,0, 0,0,1,0,0];
  function ledPattern(st = state) {
    const s = summary(st);
    const doneN = s.u.filter((x) => x.done).length;
    if (s.got >= s.total) return { cells: HEART.map(Boolean), done: doneN, total: s.u.length, full: true, lit: 25, s };
    const lit = s.total === 25 ? s.got : (s.got === 0 ? 0 : Math.min(24, Math.max(1, Math.floor((s.got / s.total) * 25))));
    const order = []; for (let r = 4; r >= 0; r--) for (let c = 0; c < 5; c++) order.push(r * 5 + c);
    const cells = Array(25).fill(false); order.slice(0, lit).forEach((i) => (cells[i] = true));
    return { cells, done: doneN, total: s.u.length, lit, s };
  }
  // S3-3 실습 없는 차시의 진행 글: "확인한 쪽 3/8 · 분류 게임 1/1"
  const theoryProgressText = (s) => `확인한 쪽 ${s.theory}/${s.theoryTotal}${s.gameTotal ? ` · 분류 게임 ${s.games}/${s.gameTotal}` : ''}`;
  const matrixHTML = (cells, big) => `<div class="led-matrix${big ? ' big' : ''}" aria-hidden="true">${cells.map((on) => `<i class="${on ? 'on' : ''}"></i>`).join('')}</div>`;

  let lastLit = null;
  function renderProgress() {
    const p = ledPattern();
    const box = $('#topLed');
    box.innerHTML = isTeacher() ? '' : matrixHTML(p.cells);
    // 진행 표시(통과한 미션 수 + LED)는 내 결과 카드로 가는 링크(UI/UX 5차 02 P1-3)
    const missionProgress = BASIC_FIRST ? `기초 완료 ${p.s.missions - p.s.optDone}/${p.s.missionTotal - p.s.opt}${p.s.opt ? ` · 응용 ${p.s.optDone}/${p.s.opt}` : ''}` : `전체 완료 ${p.s.missions}/${p.s.missionTotal}`;
    $('#topLabel').textContent = isTeacher() ? '' : NOLAB ? theoryProgressText(p.s) : missionProgress;
    const link = $('#progressLink');
    if (link) {
      link.hidden = isTeacher();
      link.setAttribute('aria-label', `내 결과 카드 보기. ${NOLAB ? theoryProgressText(p.s) : BASIC_FIRST ? missionProgress : `미션 ${p.s.missions}/${p.s.missionTotal}개 완료`}, ${PW} ${p.lit}/25칸`);
      if ((location.hash || '') === '#/me') link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current');
    }
    $('#userChip').innerHTML = `<span class="role-badge ${session.role}">${isTeacher() ? '교사' : '학생'}</span>${esc(session.name)}`;
    if (!isTeacher() && lastLit !== null && p.lit > lastLit) {
      box.classList.remove('pulse'); void box.offsetWidth; box.classList.add('pulse');
      box.addEventListener('animationend', () => box.classList.remove('pulse'), { once: true });
      beep(p.full ? 'win' : 'led');
      // 새로 켜진 칸만 반짝이고 "+n" 칩을 1.4초 붙인다(UI/UX 5차 10 P1-5). 하트로 바뀌는 순간은 칸 비교가 무의미하므로 칩만
      const prevCells = box._cells || [];
      if (!p.full) $$('.led-matrix i', box).forEach((el, i) => { if (p.cells[i] && !prevCells[i]) el.classList.add('new'); });
      const plus = h(`<span class="led-plus" aria-hidden="true">+${p.lit - lastLit}</span>`); box.append(plus); setTimeout(() => plus.remove(), 1500);
    }
    box._cells = p.cells;
    lastLit = p.lit;
    renderRail();
  }

  function renderRail() {
    const cur = location.hash || '#/intro';
    let html = '';
    if (isTeacher()) html += `<h4>교사</h4><ol class="route"><li><a href="#/teacher" class="${cur === '#/teacher' ? 'current' : ''}"><span class="stop">★</span><span>교사 대시보드</span></a></li></ol>`;
    let sec = null; let n = 0;
    stops.forEach((s) => {
      if (s.section !== sec) { if (sec !== null) html += '</ol>'; html += `<h4>${esc(s.section)}</h4><ol class="route">`; sec = s.section; }
      n++;
      const current = cur === s.hash;
      const done = s.key !== 'intro' && stopDone(s);
      // 실습 칸에는 미션 진행 배지(1/3) — UI/UX 5차 02 P2-10
      const badge = s.type === 'lab' && !isTeacher() ? (() => { const ms = requiredMissions(s.page), d = ms.filter((m) => state.missions[m.id]).length; return `<span class="rail-badge"><span class="sr">${BASIC_FIRST ? '기초' : '미션'} 통과 </span>${d}/${ms.length}</span>`; })() : '';
      html += `<li><a href="${s.hash}" class="${done ? 'done' : ''} ${current ? 'current' : ''} ${s.type === 'lab' ? 'is-lab' : ''}" ${current ? 'aria-current="page"' : ''}><span class="stop">${done ? '✓' : n}</span><span>${esc(s.label)}</span>${badge}</a></li>`;
    });
    html += '</ol>';
    if (!isTeacher()) html += `<ol class="route"><li><a href="#/me" class="${cur === '#/me' ? 'current' : ''}"><span class="stop">♥</span><span>내 결과 카드</span></a></li></ol>`;
    html += '<div class="rail-tools">';
    if (isTeacher()) {
      html += `<button class="btn small" data-tool="present">${prefs.present ? '투사 모드 끄기' : '투사 모드'}</button>`;
      if (prefs.present) html += `<button class="btn small" data-tool="tinfo">${prefs.tinfo ? '정답·메모 숨기기' : '정답·메모 보이기'}</button>`;
      html += `<button class="btn small" data-tool="deep" title="이론 페이지의 '더 자세히 알아보기' 카드를 처음부터 펼쳐 보여 줘요(교사 화면에만)">${prefs.deepOpen ? '더 자세히 알아보기 접어 두기' : '더 자세히 알아보기 펼쳐 두기'}</button>`;
    }
    html += `<button class="btn small" data-tool="sound">${prefs.sound ? '소리 끄기' : '소리 켜기'}</button>
      <button class="btn small" data-tool="credits">이미지 출처</button>
      <button class="btn small" data-tool="logout">나가기</button></div>`;
    // 다시 그려도 목차 스크롤 위치를 지키고, 현재 칸이 보이게(UI/UX 5차 02 P1-4)
    const rail = $('#rail'), keep = rail.scrollTop, focusTool = rail.contains(document.activeElement) && document.activeElement.dataset.tool;
    rail.innerHTML = html; rail.scrollTop = keep;
    $$('[data-tool]', rail).forEach((b) => b.addEventListener('click', () => tool(b.dataset.tool)));
    if (focusTool) { const fb = $(`[data-tool="${focusTool}"]`, rail); if (fb) fb.focus({ preventScroll: true }); }
    revealCurrent();
  }
  // 현재 칸이 목차 화면 밖이면 목차 안에서만 스크롤(문서는 움직이지 않음)
  function revealCurrent() {
    const r = $('#rail'), cur = $('a.current', r); if (!cur || !r.clientHeight) return;
    const rr = r.getBoundingClientRect(), cr = cur.getBoundingClientRect();
    if (cr.top < rr.top + 8 || cr.bottom > rr.bottom - 8) r.scrollTop += (cr.top - rr.top) - r.clientHeight / 3;
  }

  /* ---------- 화면 낭독기 알림: 늘 있는 라이브 영역 #live 하나 (UI/UX 5차 05 P0-2, window.App.announce) ---------- */
  let liveTimer = 0;
  function announce(text) {
    let l = $('#live');
    if (!l) { l = h('<div id="live" class="sr" aria-live="polite" aria-atomic="true"></div>'); document.body.append(l); }
    l.textContent = ''; clearTimeout(liveTimer);
    liveTimer = setTimeout(() => { l.textContent = String(text || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim(); }, 60);
  }

  /* ---------- 모달 (UI/UX 5차 06 P1-7: 열기 200ms·닫기 150ms, 교체는 내용만, Tab 가두기, 닫으면 연 버튼으로 초점) ---------- */
  let modalOpener = null, modalClosedAt = 0;
  const FOCUSABLE = 'button, [href], input, textarea, select, summary, [tabindex]:not([tabindex="-1"])';
  function modal(html, { dismiss = true } = {}) {
    const live = $('.modal-wrap:not(.out)');
    // 방금(같은 동작 안에서) 닫은 창을 바로 다른 창으로 바꾸는 경우도 교체로 본다 → 배경이 깜빡이지 않음
    const swap = !!live || (!!$('.modal-wrap.out') && performance.now() - modalClosedAt < 80);
    if (!live) modalOpener = document.activeElement && document.activeElement !== document.body ? document.activeElement : modalOpener;
    $$('.modal-wrap').forEach((x) => x.remove());
    const m = h(`<div class="modal-wrap${swap ? ' swap' : ''}" role="dialog" aria-modal="true"><div class="modal">${html}</div></div>`);
    // 창 이름: 첫 제목(h2), 없으면 그림 크게 보기 (05 P1-3)
    const title = $('h2', m);
    if (title) { title.id = title.id || `mt${Date.now().toString(36)}`; title.tabIndex = -1; m.setAttribute('aria-labelledby', title.id); } else m.setAttribute('aria-label', '그림 크게 보기');
    document.body.append(m);
    syncRail(); // 뒤 화면(상단 바·목차·본문)은 창이 열린 동안 inert
    if (dismiss) m.addEventListener('click', (e) => { if (e.target === m) closeModal(); });
    $$('[data-close]', m).forEach((b) => b.addEventListener('click', closeModal));
    m.addEventListener('keydown', (e) => {
      if (e.key !== 'Tab') return;
      const f = $$(FOCUSABLE, m).filter((x) => !x.disabled && x.offsetParent !== null);
      if (!f.length) return;
      const a = f[0], z = f[f.length - 1];
      if (e.shiftKey && (document.activeElement === a || !m.contains(document.activeElement))) { e.preventDefault(); z.focus(); }
      else if (!e.shiftKey && (document.activeElement === z || !m.contains(document.activeElement))) { e.preventDefault(); a.focus(); }
    });
    // 첫 초점: 입력 칸이 있으면 입력 칸, 없으면 제목(긴 표가 있는 출처 창에서 초점이 화면 밖으로 가지 않게), 그다음 버튼
    const f = m.querySelector('input') || title || m.querySelector('button'); f && f.focus({ preventScroll: true });
    return m;
  }
  // instant: 화면을 통째로 바꿀 때(페이지 이동·나가기)는 퇴장 없이 바로 지운다
  function closeModal(opt) {
    const instant = !!(opt && opt.instant === true);
    const open = $$('.modal-wrap:not(.out)');
    $$('.modal-wrap').forEach((m) => {
      if (instant) { m.remove(); return; }
      if (m.classList.contains('out')) return;
      m.classList.add('out'); setTimeout(() => m.remove(), 150);
    });
    if (!open.length) return;
    syncRail();
    modalClosedAt = performance.now();
    const o = modalOpener; modalOpener = null;
    if (instant) return;
    // 연 버튼으로 초점 복귀. 연 버튼이 없으면(페이지가 열면서 띄운 안전 창 등) 열린 미션 머리나 제목으로
    const back = o && o.isConnected && o !== document.body && !o.closest('.modal-wrap') ? o : ($('.mission.open > header') || $('#view h1'));
    if (back && typeof back.focus === 'function') { if (back.matches('h1') && !back.hasAttribute('tabindex')) back.tabIndex = -1; back.focus({ preventScroll: true }); }
  }
  // 그림 눌러 크게 보기 (목표·힌트·도전·실습 그림, 이론 본문 그림)
  const ZOOMABLE = 'img[data-zoom], .theory .figure img, .theory .body img:not(.art), .deep-body img:not(.art), .ig-row img, .callout .figure img, .q-card img';
  // 크게 보기 단계(09 P0-1): 전체 → 2배 → 원래 크기. 2배는 원본이 화면의 2.4배 이상일 때만(데스크톱에서는 전체 ↔ 원래 크기 두 단계)
  const ZOOM_STEPS = [['fit', '전체 보기'], ['x2', '2배로 보기'], ['actual', '원래 크기로 보기']];
  function zoomImage(img, opener) {
    const back = opener || img;
    // 캡션 글자에서 [크게 보기] 버튼 글자는 뺀다
    const capEl = img.closest('figure')?.querySelector('figcaption');
    let cap = img.alt || '';
    if (capEl) { const c = capEl.cloneNode(true); c.querySelectorAll('.zoom-btn').forEach((b) => b.remove()); cap = c.textContent.trim() || cap; }
    const m = modal(`<figure class="zoom-fig" data-zoom="fit"><div class="zoom-scroll"><img src="${esc(img.currentSrc || img.getAttribute('src'))}" alt="${esc(img.alt)}"></div><p class="zoom-hint">옆으로·아래로 밀어서 봐요</p>${cap ? `<figcaption>${esc(cap)}</figcaption>` : ''}</figure><div class="modal-actions"><button class="btn" data-actual aria-pressed="false">원래 크기로 보기</button><button class="btn primary" data-close>닫기</button></div>`);
    m.classList.add('zoom');
    const fig = $('.zoom-fig', m), tgl = $('[data-actual]', m), sc = $('.zoom-scroll', m), big = $('.zoom-scroll img', m);
    let steps = [ZOOM_STEPS[0], ZOOM_STEPS[2]], k = 0;
    const apply = () => {
      fig.dataset.zoom = steps[k][0]; fig.classList.toggle('actual', steps[k][0] === 'actual');
      tgl.textContent = steps[(k + 1) % steps.length][1]; tgl.setAttribute('aria-pressed', String(k > 0));
      requestAnimationFrame(() => { sc.scrollLeft = Math.max(0, (sc.scrollWidth - sc.clientWidth) / 2); sc.scrollTop = 0; }); // 키운 그림은 가운데부터
    };
    const setup = () => {
      const cw = sc.clientWidth || window.innerWidth, nw = big.naturalWidth || img.naturalWidth || 0;
      steps = ZOOM_STEPS.filter(([id]) => id === 'fit' || (id === 'x2' && nw >= cw * 2.4) || (id === 'actual' && nw > cw * 1.1));
      const x2 = steps.findIndex(([id]) => id === 'x2');
      k = x2 > 0 && window.matchMedia('(max-width: 700px)').matches ? x2 : 0; // 휴대폰은 2배로 시작(전체 보기에서는 그림 속 글자가 4px 정도)
      tgl.hidden = steps.length < 2; apply();
    };
    tgl.addEventListener('click', () => { k = (k + 1) % steps.length; apply(); });
    if (big.complete && big.naturalWidth) setup(); else big.addEventListener('load', setup, { once: true });
    new MutationObserver((_, o) => { if (!m.isConnected) { o.disconnect(); back.focus && back.focus(); } }).observe(document.body, { childList: true });
  }
  document.addEventListener('click', (e) => { const img = e.target.closest && e.target.closest(ZOOMABLE); if (img && !img.closest('.modal-wrap')) zoomImage(img); });
  // 크게 볼 수 있는 그림은 키보드(Tab → Enter)로도 열 수 있게
  const ZOOM_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><circle cx="10" cy="10" r="6"/><path d="M15 15l6 6"/></svg>';
  function armZoom(root) {
    $$(ZOOMABLE, root).forEach((img) => { if (img.closest('.modal-wrap') || img.hasAttribute('data-zoom')) return; img.tabIndex = 0; img.setAttribute('role', 'button'); img.setAttribute('data-zoom', ''); });
    // 인포그래픽·목표 그림: 그림 위를 덮던 장식 배지 대신 캡션 줄 오른쪽에 진짜 [크게 보기] 버튼(09 P1-5)
    $$('.figure.ig, .goal-img', root).forEach((f) => {
      const im = $('img', f); if (!im || f.closest('.modal-wrap') || $('.zoom-btn', f)) return;
      let cap = $('figcaption', f); if (!cap) { cap = document.createElement('figcaption'); f.append(cap); }
      const b = h(`<button type="button" class="zoom-btn">${ZOOM_ICON}크게 보기</button>`);
      b.addEventListener('click', () => zoomImage(im, b));
      cap.append(b);
    });
  }
  document.addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('img[data-zoom]')) { e.preventDefault(); zoomImage(e.target); } });

  /* ---------- 짧은 영상(S3-2): mission.goalVideo · lab.figure.video · page.images[].video = { src(mp4), webm?, poster, cap, desc, credit? } ----------
   * 소리 없는 짧은 반복 클립. 포스터가 먼저 보이고(preload none) 눌러야 재생(자동재생 없음). muted·loop·playsinline.
   * 움직임 줄이기면 한 번만 재생(반복 없음). [크게 보기] 창은 재생 단추(controls)와 동작 설명(desc)을 함께. desc는 화면 낭독용 설명 */
  const reduceMo = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const vidType = (u) => (/\.webm(\?|$)/i.test(u) ? 'video/webm' : 'video/mp4');
  const vidSources = (v) => [v.webm && `<source src="${esc(v.webm)}" type="video/webm">`, v.src && `<source src="${esc(v.src)}" type="${vidType(v.src)}">`].filter(Boolean).join('');
  let clipN = 0;
  function clipHTML(v, o = {}) {
    if (!v || !(v.src || v.webm)) return '';
    const id = `clip${++clipN}`, cap = o.cap != null ? o.cap : v.cap || '', desc = v.desc || o.desc || cap;
    return `<figure class="figure clip${o.cls ? ` ${o.cls}` : ''}" data-clip>
      <div class="clip-box"><video muted loop playsinline preload="none"${v.poster ? ` poster="${esc(v.poster)}"` : ''} aria-describedby="${id}-d" data-clip-v>${vidSources(v)}</video>
        <button type="button" class="clip-play" data-clip-play aria-label="${esc(o.playLabel || '영상 재생')}"><span class="clip-ic" aria-hidden="true">▶</span><span class="clip-t">재생</span></button></div>
      <figcaption>${o.tag ? `<b class="goal-tag">${esc(o.tag)}</b> ` : ''}${esc(cap)}${creditHTML(v)}<button type="button" class="zoom-btn" data-clip-zoom>${ZOOM_ICON}크게 보기</button></figcaption>
      <p class="sr" id="${id}-d">${esc(desc)}</p></figure>`;
  }
  function clipToggle(btn) {
    const fig = btn.closest('[data-clip]'), vd = fig && $('[data-clip-v]', fig); if (!vd) return;
    const setBtn = (playing) => { $('.clip-t', btn).textContent = playing ? '일시정지' : '재생'; $('.clip-ic', btn).textContent = playing ? '❚❚' : '▶'; btn.setAttribute('aria-label', playing ? '영상 일시정지' : '영상 재생'); fig.classList.toggle('playing', playing); };
    if (vd.paused) {
      vd.loop = !reduceMo(); // 움직임 줄이기: 한 번만
      vd.onended = () => setBtn(false);
      const pr = vd.play(); if (pr && pr.catch) pr.catch(() => setBtn(false));
      setBtn(true);
    } else { vd.pause(); setBtn(false); }
  }
  function clipZoom(fig, opener) {
    const vd = $('[data-clip-v]', fig); if (!vd) return;
    if (!vd.paused) vd.pause();
    const cap = (() => { const c = $('figcaption', fig).cloneNode(true); c.querySelectorAll('.zoom-btn').forEach((b) => b.remove()); return c.textContent.trim(); })();
    const desc = ($('.sr', fig) || {}).textContent || '';
    const m = modal(`<figure class="zoom-fig clip-zoom"><video controls muted playsinline preload="metadata"${vd.getAttribute('poster') ? ` poster="${esc(vd.getAttribute('poster'))}"` : ''}${reduceMo() ? '' : ' loop'}>${vd.innerHTML}</video>${cap ? `<figcaption>${esc(cap)}</figcaption>` : ''}${desc ? `<p class="clip-desc"><b>영상 설명</b> ${esc(desc)}</p>` : ''}</figure><div class="modal-actions"><button class="btn primary" data-close>닫기</button></div>`);
    m.classList.add('zoom');
    const back = opener || $('[data-clip-play]', fig);
    new MutationObserver((_, o) => { if (!m.isConnected) { o.disconnect(); if (back && back.focus) back.focus(); } }).observe(document.body, { childList: true });
  }
  document.addEventListener('click', (e) => {
    const t = e.target.closest && e.target.closest('[data-clip-play], [data-clip-zoom], [data-goal-video]');
    if (!t) return;
    if (t.hasAttribute('data-clip-play')) clipToggle(t);
    else if (t.hasAttribute('data-clip-zoom')) clipZoom(t.closest('[data-clip]'), t);
    else { const m = labCtx && labCtx.lab.missions[+t.dataset.goalVideo]; if (m && m.goalVideo) clipZoom(h(clipHTML(m.goalVideo, { cap: m.goalVideo.cap })), t); } // 2단계 [목표 영상 보기]
  });
  // Esc = 창의 [닫기]/[취소]를 누른 것과 같게(버튼에 걸린 정리 동작도 함께 실행)
  document.addEventListener('keydown', (e) => { if (e.key !== 'Escape') return; const c = $('.modal-wrap:not(.out) [data-close]'); if (c) { e.preventDefault(); c.click(); } });

  // 비밀번호 칸: 값을 읽자마자 비워서 브라우저가 저장을 제안하지 않게 한다
  const takePin = (inp) => { const v = inp.value; inp.value = ''; return v; };

  /* ---------- 입장 화면 (학생 이름 / 교사 비밀번호) ---------- */
  function showGate(notice) {
    document.body.classList.add('gated');
    document.body.classList.remove('student', 'teacher', 'present', 'lab-mode', 'rail-open', 'help-req', 'show-tinfo');
    window.MC && window.MC.unmount();
    $('#view').innerHTML = ''; $('#rail').innerHTML = '';
    let role = 'student';
    const g = $('#gate');
    const draw = (inner) => {
      g.innerHTML = `<div class="gate"><div class="gate-card">
        <div class="gate-lockup"><img class="bx-logo" src="${CORE}assets/brand/boundaryx-logo.png" alt="boundaryX" height="26"></div>${artImg(ART[L.gateArt] ? L.gateArt : 'hello', 'gate-mascot')}
        <div class="gate-brand">${matrixHTML(HEART.map(Boolean))}<div><h1>${esc(L.brand)}</h1><p>${esc(L.title)}  ${esc(L.course.replace(`${L.brand} `, ''))}</p></div></div>
        ${notice ? `<p class="gate-note gate-notice">${esc(notice)}</p>` : ''}
        <div class="role-pick" role="radiogroup" aria-label="누구인가요?">
          <button type="button" class="role-btn ${role === 'student' ? 'on' : ''}" data-role="student" role="radio" aria-checked="${role === 'student'}"><b>학생</b><span>내 이름으로 수업 시작</span></button>
          <button type="button" class="role-btn ${role === 'teacher' ? 'on' : ''}" data-role="teacher" role="radio" aria-checked="${role === 'teacher'}"><b>선생님</b><span>수업 안내, 투사 모드 (선생님 전용)</span></button>
        </div>
        <div class="gate-form">${inner || formHTML()}</div>
      </div></div>`;
      $$('.role-btn', g).forEach((b) => b.addEventListener('click', () => { role = b.dataset.role; notice = null; draw(); }));
      bindForm();
    };
    const formHTML = () => role === 'student' ? `
      <form id="gateForm" novalidate>
        <label class="field">이름 또는 별명<input id="gateName" maxlength="40" autocomplete="off" placeholder="예) 3반 김민준 · 짝이면 민준 서연" required aria-describedby="pairPreview"></label>
        <p class="pair-preview" id="pairPreview" aria-live="polite"></p>
        <p class="gate-error" id="gateErr" role="alert"></p>
        <button class="btn primary gradient" type="submit">수업 시작하기</button>
        <p class="gate-note">진행 기록은 이 기기에만 저장되고, 같은 이름으로 들어오면 이어서 할 수 있어요.</p>
      </form>` : `
      <form id="gateForm" novalidate autocomplete="off">
        <label class="field">교사 비밀번호<input id="gatePin" type="password" autocomplete="off" data-lpignore="true" required></label>
        <p class="gate-error" id="gateErr" role="alert"></p>
        <button class="btn primary gradient" type="submit">교사로 입장</button>
        <p class="gate-note">바운더리엑스에서 안내받은 교사용 비밀번호를 입력하세요. 학생 기기에서 도와줄 때는 학생 화면의 "선생님 부르기"를 쓰면 학생 기록이 그대로 유지돼요.</p>
      </form>`;
    function bindForm() {
      const form = $('#gateForm', g); if (!form) return;
      const err = (t) => { $('#gateErr', g).textContent = t; const inp = $('input', form); if (inp) { inp.setAttribute('aria-invalid', t ? 'true' : 'false'); inp.setAttribute('aria-describedby', 'gateErr'); } };
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (role === 'student') {
          const name = cleanName($('#gateName', g).value), key0 = nameKey(name);
          if (key0.length < 2) return err('이름을 두 글자 이상 적어 주세요.');
          if (reservedKey(key0) || reservedKey(legacyNameKey(name))) return err('이 이름은 쓸 수 없어요. 다른 이름을 적어 주세요.');
          // 기록 찾기(9차 D4): 새 키(낱말 순서 무시) → 옛 키(순서 그대로) → 저장된 이름의 낱말이 같은 기록
          const hasRec = (k) => !!(users()[k] && local.get(K.prog(k)));
          const key = hasRec(key0) ? key0 : hasRec(legacyNameKey(name)) ? legacyNameKey(name)
            : (Object.keys(users()).find((k) => !reservedKey(k) && hasRec(k) && nameKey(users()[k].name || '') === key0) || key0);
          if (!hasRec(key)) { freshEntry = true; return enterStudent(name, key); }
          const known = users()[key].name || name;
          const rec = local.get(K.prog(key)) || {};
          const lastLabel = stopLabel(rec.last);
          const doneN = labs.flatMap((lb) => lb.missions).filter((m) => (rec.missions || {})[m.id]).length;
          const lastAt = users()[key].last;
          draw(`<p class="gate-resume"><b>${esc(known)}</b> 학생의 기록이 이 기기에 있어요.${lastAt ? `<br>지난번 <b>${esc(whenLabel(lastAt))}</b> · ${NOLAB ? `확인한 쪽 ${L.pages.filter((pg) => (rec.seen || {})[pg.id]).length}개` : `미션 ${doneN}개 완료`}` : ''}${lastLabel ? `${lastAt ? ' · ' : '<br>지난번에 '}<b>${esc(lastLabel)}</b>까지 했어요.` : ''}</p>
            <div class="modal-actions"><button class="btn primary gradient" data-resume>이어서 하기</button><button class="btn ghost" data-back>이름 다시 쓰기</button></div>
            <p class="gate-note">내 기록이 아니라면 이름을 다르게 적어 주세요. 예) 3반 김민준 · 짝이면 민준 서연<br>기록을 지우고 처음부터 하려면 들어간 뒤 내 결과 카드에서 [이 기기에서 내 기록 지우기]를 눌러요.</p>`);
          $('[data-resume]', g).addEventListener('click', () => enterStudent(known, key));
          $('[data-back]', g).addEventListener('click', () => draw());
        } else {
          const left = lockLeft();
          if (left) return err(`비밀번호를 여러 번 틀렸어요. ${left}초 뒤에 다시 시도해 주세요.`);
          const pin = takePin($('#gatePin', g));
          const btn = $('button[type=submit]', g); btn.disabled = true; btn.textContent = '확인 중…';
          try { await window.Auth.login(pin); pinOk(); enterTeacher(); }
          catch (ex) {
            btn.disabled = false; btn.textContent = '교사로 입장';
            err(pinErrMsg(ex)); beep('no'); $('#gatePin', g).focus();
          }
        }
      });
      // 짝 이름 미리보기: 두 사람이면 미션마다 역할을 바꾼다는 것을 입력할 때 바로 알려 준다(UI/UX 5차 10 P1-7)
      const nameInp = $('#gateName', form), pv = $('#pairPreview', form);
      if (nameInp && pv) nameInp.addEventListener('input', () => {
        const names = splitNames(cleanName(nameInp.value));
        pv.classList.toggle('solo', names.length === 1);
        // 9차 D4: 미리보기에 모든 이름, 3명 이상이면 코딩·로봇·검사 3역할(4명부터 나머지는 다음 차례)
        const all = names.map((x) => `<b>${esc(x)}</b>`).join(' · ');
        pv.innerHTML = names.length >= 3 ? `✓ ${names.length}명 ${all} — 미션마다 코딩·로봇·${esc(roleText().check)} 담당을 돌아가며 맡아요${names.length >= 4 ? '. 나머지는 다음 차례예요' : ''}`
          : names.length === 2 ? `✓ 짝 ${all} — 미션마다 코딩과 로봇 담당을 번갈아 해요`
          : names.length === 1 && nameKey(nameInp.value).length >= 2 ? '혼자 하나요? 짝이 있으면 이름을 띄어 함께 써요. 예) 민준 서연' : '';
      });
      const first = $('input', form); first && first.focus();
    }
    draw();
  }
  const splitNames = (s) => String(s || '').split(/\s+/).filter((t) => t && !NOT_NAME.test(t));
  // 이어서 하기: 저장된 마지막 위치가 지금 수업 순서에 있는 주소인지(UI/UX 5차 02 P1-8)
  const validHash = (hh) => !!hh && (hh === '#/me' || stops.some((s) => s.hash === hh));
  const stopLabel = (hh) => (hh === '#/me' ? '내 결과 카드' : validHash(hh) && hh !== '#/intro' ? stops.find((s) => s.hash === hh).label : '');
  // 9차 D4: "10월 12일(월) 15:40" (재입장 안내·결과 카드)
  const pad2 = (n) => String(n).padStart(2, '0');
  const whenLabel = (t) => { const d = new Date(t); return `${d.getMonth() + 1}월 ${d.getDate()}일(${'일월화수목금토'[d.getDay()]}) ${pad2(d.getHours())}:${pad2(d.getMinutes())}`; };
  // 이 기기에 기록이 없던 이름으로 처음 들어왔는지(입장 뒤 수업 소개에 한 번 안내, 9차 D4·E3-05)
  let freshEntry = false;

  function enterStudent(name, key) {
    session = { role: 'student', name, key };
    sess.set(K.session, session);
    touchUser();
    startApp('#/intro');
  }
  function enterTeacher() {
    session = { role: 'teacher', name: '선생님', key: TEACHER_ID };
    sess.set(K.session, session);
    // 새로 들어온 교사는 깨끗한 미리보기로 시작(지난 수업에서 탭만 닫고 나간 경우 남은 교사 코드도 지움)
    clearTeacherPreview(); sess.del(K.tlast); sess.del(K.presentEnd);
    startApp('#/teacher');
  }
  function startApp(hash) {
    $('#gate').innerHTML = '';
    document.body.classList.remove('gated');
    loadState(); lastLit = null; applyModes(); idleReset();
    // 다시 들어온 학생은 마지막으로 있던 곳으로(UI/UX 5차 02 P1-8)
    const target = hash === '#/intro' && !isTeacher() && validHash(state.last) ? state.last : hash;
    if (location.hash === target) route(); else location.hash = target;
  }
  function endSession(notice) {
    if (isTeacher()) {
      window.Auth.logout();
      window.MC && window.MC.unmount();
      clearTeacherPreview(); sess.del(K.tlast); sess.del(K.presentEnd); // 교사 코드·미리보기 기록을 기기에 남기지 않음(UI/UX 5차 08 P0-1)
    }
    sess.del(K.session); sess.del(K.help); session = null; prefs.present = false; prefs.tinfo = false; savePrefs();
    if (window.VibeHost) window.VibeHost.reset(); // 바이브코딩 화면째 지워 접속키·대화를 다음 사람에게 남기지 않는다
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    history.replaceState(null, '', location.pathname);
    closeModal({ instant: true });
    showGate(notice);
  }
  async function logout() {
    const yes = isTeacher()
      ? await ask({ title: '교사 모드를 끝낼까요?', body: '이 탭에서 열어 둔 정답이 지워져요.', ok: '끝내기', cancel: '계속하기' })
      : await ask({ title: `${session.name} 학생, 수업을 마칠까요?`, body: '기록은 이 기기에 저장돼 있어요. 같은 이름으로 들어오면 이어서 할 수 있어요.', ok: '수업 마치기', cancel: '계속하기' });
    if (!yes || !session) return;
    endSession();
  }
  // 확인 창. 브라우저의 confirm()은 앱 안에 띄운 브라우저·키오스크·일부 학교 브라우저에서 창 없이 '취소'로 돌아와 나가기가 먹통이 됐다 → 앱 창으로 묻는다
  function ask({ title, body, ok = '확인', cancel = '취소', danger = false }) {
    return new Promise((resolve) => {
      let done = false;
      const fin = (v) => { if (done) return; done = true; ob.disconnect(); resolve(v); };
      const m = modal(`<h2>${esc(title)}</h2>${body ? `<p>${esc(body)}</p>` : ''}
        <div class="modal-actions"><button class="btn ghost" type="button" data-close>${esc(cancel)}</button><button class="btn ${danger ? 'danger' : 'primary'}" type="button" data-ok>${esc(ok)}</button></div>`);
      $('[data-ok]', m).addEventListener('click', () => { fin(true); closeModal(); });
      // 취소·Esc·가림막·다른 창으로 교체 → 창이 닫히거나 사라지면 '아니오'
      const ob = new MutationObserver(() => { if (!m.isConnected || m.classList.contains('out')) fin(false); });
      ob.observe(m, { attributes: true, attributeFilter: ['class'] }); ob.observe(document.body, { childList: true });
    });
  }

  // 교사 모드 무조작 자동 나가기 (학생 기기에 교사 화면이 남지 않도록). 투사 중에는 제외.
  let lastAct = Date.now();
  const idleReset = () => { lastAct = Date.now(); };
  ['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach((ev) => document.addEventListener(ev, idleReset, { passive: true }));
  setInterval(() => {
    const min = document.body.classList.contains('lab-mode') ? TEACHER_IDLE_LAB_MIN : TEACHER_IDLE_MIN;
    if (isTeacher() && !prefs.present && Date.now() - lastAct > min * 60000) endSession(`${min}분 동안 사용하지 않아 교사 모드를 안전하게 끝냈어요.`);
  }, 30000);

  function tool(name) {
    if (name === 'logout') logout();
    if (name === 'credits') creditsModal();
    if (name === 'sound') { prefs.sound = !prefs.sound; savePrefs(); renderRail(); if (prefs.sound) beep('led'); }
    if (name === 'tinfo' && isTeacher()) { prefs.tinfo = !prefs.tinfo; savePrefs(); applyModes(); renderRail(); }
    // 교사 설정: 이론 페이지의 '더 자세히 알아보기' 카드를 펼쳐 둔 채로 보여 주기(9차 D13, 투사에서 원리 설명용, 10차 이름 바꿈)
    if (name === 'deep' && isTeacher()) {
      prefs.deepOpen = !prefs.deepOpen; savePrefs(); renderRail(); applyDeep($('#view'), true);
      announce(prefs.deepOpen ? '이론 페이지의 더 자세히 알아보기를 펼쳐 둬요.' : '더 자세히 알아보기를 접어 둬요.');
    }
    if (name === 'present' && isTeacher()) {
      prefs.present = !prefs.present; prefs.tinfo = false; savePrefs();
      let reroute = false;
      if (prefs.present) {
        // 투사 시작 = 새 수업 시작: 교사가 미리 풀어 본 확인 문제·정답 코드를 비운다.
        // 같은 수업 중에 껐다 켜는 경우를 위해 마지막 투사 종료 뒤 30분이 지났을 때만(UI/UX 5차 08 P0-1)
        if (Date.now() - (sess.get(K.presentEnd) || 0) > 30 * 60000) { window.MC && window.MC.unmount(); clearTeacherPreview(); reroute = (location.hash || '#/intro') !== '#/teacher'; }
      } else sess.set(K.presentEnd, Date.now());
      applyModes();
      if (prefs.present && document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => {});
      if (!prefs.present && document.fullscreenElement) document.exitFullscreen().catch(() => {});
      renderRail();
      if (reroute) route();
    }
  }
  // Esc로 전체 화면만 풀린 경우 투사 모드가 아직 켜져 있음을 알려 준다(08 P2-10)
  document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement && isTeacher() && prefs.present) toast('전체 화면만 끝났어요. 투사 모드는 켜져 있어요. 위쪽 [투사 끄기]로 끌 수 있어요.'); });
  // 이미지·영상 출처 모음: lesson.js의 credit 필드와 본문 그림의 출처 표기를 모아 보여 준다
  function creditsModal() {
    const rows = []; const seen = new Set();
    const add = (where, what, src, credit) => { const k = src + '|' + credit; if (!credit || seen.has(k)) return; seen.add(k); rows.push({ where, what, credit }); };
    const strip = (t) => String(t || '').replace(/<[^>]+>/g, '').trim();
    const fromHtml = (where, html) => { for (const m of String(html || '').matchAll(/<figure[^>]*>([\s\S]*?)<\/figure>/g)) { const c = m[1].match(/<small class="credit">출처: ([^<]+)<\/small>/); if (!c) continue; const src = (m[1].match(/src="([^"]+)"/) || [])[1] || ''; const cap = strip((m[1].match(/<figcaption><b>([^<]+)<\/b>/) || [])[1]) || strip((m[1].match(/<figcaption>([\s\S]*?)<small/) || [])[1]) || strip((m[1].match(/alt="([^"]*)"/) || [])[1]); add(where, cap, src, c[1]); } };
    L.pages.forEach((p) => {
      (p.trio || []).forEach((t) => add(p.title, `${t.name} 사진`, t.img, t.credit));
      (p.images || []).forEach((im) => add(p.title, im.cap || im.alt, im.src, im.credit));
      fromHtml(p.title, p.body); fromHtml(p.title, p.deep);
      if (p.video && p.videoCredit) add(p.title, p.videoCap || '영상', p.video, p.videoCredit);
      if (p.videoCard && p.videoCard.credit) add(p.title, p.videoCard.cap || p.videoCard.title || '영상', vcUrl(p.videoCard), p.videoCard.credit); // 영상 카드(1차시)
      (p.missions || []).forEach((m) => { if (m.goalImg) add(p.title, m.goalImg.cap, m.goalImg.src, m.goalImg.credit); if (m.goalVideo) add(p.title, m.goalVideo.cap || `${m.title} 목표 영상`, m.goalVideo.src || m.goalVideo.webm, m.goalVideo.credit); (m.hints || []).forEach((hh) => hh.img && add(p.title, `${m.title} 힌트 그림`, hh.img, hh.credit)); });
      if (p.figure && p.figure.video) add(p.title, p.figure.cap || '영상', p.figure.video.src || p.figure.video.webm, p.figure.video.credit || p.figure.credit); // S3-2 짧은 영상
    });
    (L.quiz || []).forEach((q) => q.img && add('복습 퀴즈', `「${q.q}」 그림`, q.img, q.credit));
    const m = modal(`<h2>이미지·영상 출처</h2><p class="fine">${esc(L.creditsNote || '교육용으로 출처를 밝혀 사용했어요. 블록과 편집기 화면은 Microsoft MakeCode for micro:bit, 그 밖의 포니봇 그림·사진과 인포그래픽은 바운더리엑스가 만들었어요.')}</p>`
      + `<table class="credit-table"><thead><tr><th>위치</th><th>자료</th><th>출처</th></tr></thead><tbody>${rows.map((r) => `<tr><td>${esc(r.where)}</td><td>${esc(r.what)}</td><td>${esc(r.credit)}</td></tr>`).join('')}</tbody></table>`
      + '<div class="modal-actions"><button class="btn primary" data-close>닫기</button></div>');
    m.classList.add('wide'); $('.modal', m).scrollTop = 0; // 닫기 버튼에 초점이 가며 아래로 내려간 스크롤을 맨 위로
  }
  function applyModes() {
    document.body.classList.toggle('teacher', isTeacher());
    document.body.classList.toggle('student', !!session && !isTeacher());
    document.body.classList.toggle('present', isTeacher() && !!prefs.present);
    document.body.classList.toggle('show-tinfo', isTeacher() && !!prefs.present && !!prefs.tinfo);
    // 투사 중 상단 바 도구: [정답 보이기](켜지면 빨강 "정답 보이는 중") · [투사 끄기] (UI/UX 5차 08 P0-2)
    const pt = $('#presentTools');
    if (pt) {
      const on = isTeacher() && !!prefs.present;
      const had = pt.contains(document.activeElement) ? document.activeElement.dataset.tool : null;
      pt.hidden = !on;
      pt.innerHTML = on ? `<button class="btn small pt-answer" type="button" data-tool="tinfo" aria-pressed="${!!prefs.tinfo}" title="${prefs.tinfo ? '누르면 정답과 교사 메모를 숨겨요' : '이 페이지에서만 정답과 교사 메모를 보여 줘요'}">${prefs.tinfo ? '정답 보이는 중' : '정답 보이기'}</button><button class="btn small ghost" type="button" data-tool="present">투사 끄기</button>` : '';
      if (had) { const b = $(`[data-tool="${had}"]`, pt); if (b) b.focus(); }
    }
  }
  $('#presentTools') && $('#presentTools').addEventListener('click', (e) => { const b = e.target.closest('[data-tool]'); if (b) tool(b.dataset.tool); });

  /* ---------- 하단 페이저 ---------- */
  function pager(idx) {
    const prev = stops[idx - 1];
    // 마지막 정거장(복습 게임) 다음은 학생의 내 결과 카드(UI/UX 5차 02 P1-7)
    const next = stops[idx + 1] || (idx === stops.length - 1 && !isTeacher() ? { hash: '#/me', label: '내 결과 카드' } : null);
    return `<nav class="pager" aria-label="페이지 이동">
      ${prev ? `<a class="btn" href="${prev.hash}" data-nav="prev" aria-label="이전: ${esc(prev.label)}">이전</a>` : '<span></span>'}
      <div class="where">${esc(stops[idx].section)}  ${idx + 1} / ${stops.length}</div>
      ${next ? `<a class="btn primary" href="${next.hash}" data-nav="next">다음: ${esc(next.label)}</a>` : '<span></span>'}
    </nav>`;
  }
  // 페이지 위쪽 위치 표시: 섹션 태그 옆 "5 / 14" (UI/UX 5차 02 P1-5)
  const whereTop = (idx, section) => `<p class="where-top"><span class="section-tag">${esc(section)}</span><span class="step-count" aria-hidden="true">${idx + 1} / ${stops.length}</span><span class="sr">${stops.length}단계 중 ${idx + 1}번째</span></p>`;

  /* 수업 흐름 칸(S3-3 flow n칸): 4칸은 예전 그대로(4열), 1~3칸은 그 수만큼, 5~6칸은 3열, 7칸 이상은 4열로 줄바꿈. 좁은 화면 규칙(2열·1열)은 CSS 그대로 */
  function flowHTML() {
    const fl = L.flow || [], n = fl.length; if (!n) return '';
    const cols = n <= 4 ? n : n <= 6 ? 3 : 4;
    return `<div class="flow"${cols !== 4 ? ` style="--flow-n:${cols}"` : ''}>${fl.map((f, i) => `<div class="t${i + 1}"><b>${esc(f.t)}</b><span>${esc(f.d)}</span></div>`).join('')}</div>`;
  }
  /* ★탈출 진행판(화 지도, 비트런 C6): 차시 맨 위 칸 episodeMap = { total, current, title?, labels?[], img?, alt? } → 수업 소개 맨 위 n칸 지도.
   * 차시끼리 저장소를 나누지 않으므로 current 값으로만 그린다(지난 화 ✓, 이번 화 강조, 다음 화 흐리게). 없으면 아무것도 그리지 않음(포니봇 차시 그대로) */
  function episodeMapHTML(m) {
    if (!m || !(+m.total > 0)) return '';
    const n = Math.min(12, Math.max(1, Math.round(+m.total))), c = Math.min(n, Math.max(1, Math.round(+m.current || 1)));
    const labels = Array.isArray(m.labels) ? m.labels : [];
    return `<section class="episode-map${m.img ? ' has-img' : ''}" aria-label="${esc(m.title || '이야기 지도')}">
      ${m.img ? `<img class="em-img" src="${esc(m.img)}" alt="${esc(m.alt || '')}" loading="lazy" decoding="async">` : ''}
      <div class="em-body"><h2 class="em-title">${esc(m.title || '이야기 지도')} <small>${n}화 중 ${c}화</small></h2>
      <ol class="em-steps" style="--em-n:${n}">${Array.from({ length: n }, (_, i) => {
        const k = i + 1, st = k < c ? 'past' : k === c ? 'now' : 'next';
        return `<li class="em-step ${st}"${st === 'now' ? ' aria-current="step"' : ''}><span class="em-dot" aria-hidden="true">${st === 'past' ? '✓' : k}</span><span class="em-label">${esc(labels[i] || `${k}화`)}</span><span class="sr">${st === 'past' ? ' (지난 화)' : st === 'now' ? ' (이번 화)' : ''}</span>${st === 'now' ? '<em class="em-now" aria-hidden="true">이번 화</em>' : ''}</li>`;
      }).join('')}</ol>${crewHTML(c)}${m.notebook ? notebookHTML(m, false) : ''}</div></section>`;
  }
  /* ★K14 역할 차례 한 줄(L.crew = ['질문', '기록', '행동', '조립']): 화마다 한 칸씩 밀림. episodeMap.crew === false면 안 그림 */
  function crewHTML(c) {
    const cr = Array.isArray(L.crew) ? L.crew.filter(Boolean) : []; if (!cr.length || (L.episodeMap || {}).crew === false) return '';
    const n = cr.length, sh = ((c - 1) % n + n) % n;
    return `<p class="em-crew"><b>이번 화 역할</b> ${cr.map((_, i) => `<span>${i + 1}번 자리 = ${esc(cr[(i + sh) % n])}</span>`).join('')}</p>`;
  }
  /* ★K10 탐험대 수첩(episodeMap.notebook: true + L.notebook): 열쇠 조각·부품표·답 한 조각을 current 값으로만 그린다(저장 없음).
   *   열쇠: 지난 화 = 채움, 이번 화 = 테두리(이 차시에서 success.key가 그 번호인 자물쇠를 열거나 path-code를 풀면 채움), 다음 화 = 실루엣. 부품표: 칸마다 steps[[화, 값]] 중 current 이하 마지막 값.
   *   답 한 조각: 지난 화까지. finale: true(마지막 화)면 열쇠가 다 모였을 때 홈에 끼워지는 연출. 결과 카드에도 펼친 채로 나온다(open) */
  function notebookHTML(m, open) {
    const nb = L.notebook || {}, c = Math.max(1, Math.round(+m.current || 1)), total = Math.round(+m.total || 8);
    const openedKeys = new Set(L.pages.filter((pg) => (pg.widget === 'escape-lock' || pg.widget === 'path-code') && (pg.widgetOpts || {}).success && pg.widgetOpts.success.key != null && ((wd) => (pg.widget === 'escape-lock' ? wd.opened : wd.solved))((state.wdata || {})[pg.id] || {})).map((pg) => +pg.widgetOpts.success.key));
    const keys = (nb.keys || []).slice(0, total);
    const kState = (k) => (+k.n < c || openedKeys.has(+k.n) ? 'got' : +k.n === c ? 'now' : 'next');
    const keyHTML = (k) => { const s = kState(k); return `<li class="nb-key ${s}">${k.img ? `<img src="${esc(k.img)}" alt="" aria-hidden="true">` : `<span class="nb-kn" aria-hidden="true">${esc(k.n)}</span>`}<span>${esc(k.name || `${k.n}번`)}</span><span class="sr">${s === 'got' ? ' (모음)' : s === 'now' ? ' (이번 화에 모을 조각)' : ' (아직)'}</span></li>`; };
    const partVal = (p) => { const st = (p.steps || [[p.ep || 1, p.value]]).filter((x) => +x[0] <= c); return st.length ? st[st.length - 1][1] : ''; };
    const pieces = (nb.pieces || []).slice(0, Math.max(0, c - 1));
    const all = keys.length && keys.every((k) => kState(k) === 'got');
    return `<details class="em-notebook"${open ? ' open' : ''}><summary><span>탐험대 수첩</span><span class="nb-sum">열쇠 조각 ${keys.filter((k) => kState(k) === 'got').length} / ${keys.length}</span><span class="deep-chev" aria-hidden="true">▾</span></summary>
      <div class="nb-body">
        ${keys.length ? `<section class="nb-sec"><h3>열쇠 조각</h3><ol class="nb-keys">${keys.map(keyHTML).join('')}</ol>${m.finale && all ? `<div class="nb-finale" role="img" aria-label="열쇠 조각 ${keys.length}개가 마지막 문 홈에 끼워졌어요"><span class="nb-door">${keys.map((k, i) => `<i style="--i:${i}">${k.img ? `<img src="${esc(k.img)}" alt="">` : esc(k.n)}</i>`).join('')}</span></div>` : ''}</section>` : ''}
        ${(nb.parts || []).length ? `<section class="nb-sec"><h3>비트런 부품표</h3><table class="nb-parts"><tbody>${nb.parts.map((p) => { const v = partVal(p); return `<tr><th scope="row">${esc(p.name)}</th><td>${v ? esc(v) : '<span class="fine">아직 몰라요</span>'}</td></tr>`; }).join('')}</tbody></table></section>` : ''}
        ${pieces.length ? `<section class="nb-sec"><h3>답 한 조각</h3><ol class="nb-pieces">${pieces.map((t, i) => `<li><b>${i + 1}화</b> ${esc(t)}</li>`).join('')}</ol></section>` : ''}
      </div></details>`;
  }
  /* ---------- 도입 ---------- */
  function viewIntro() {
    const p = ledPattern();
    const firstLab = stops.findIndex((s) => s.type === 'lab');
    // 진행 기록이 있으면 "이어서 하기"가 주 버튼(UI/UX 5차 02 P1-8)
    const resume = !isTeacher() && stopLabel(state.last) ? state.last : null;
    const cta = resume
      ? `<a class="btn primary" href="${resume}">이어서 하기: ${esc(stopLabel(resume))}</a> <a class="btn" href="${stops[1].hash}">처음부터 보기</a>`
      : `<a class="btn primary" href="${stops[1].hash}">수업 시작하기</a>${firstLab >= 0 ? ` <a class="btn" href="${stops[firstLab].hash}">바로 실습하기</a>` : HAS_REVIEW ? ' <a class="btn" href="#/review">바로 복습 게임</a>' : ''}`;
    // S3-3 실습 없는 차시: '오늘 배울 것' = 노선도 묶음(section)마다 카드 하나(그 묶음 첫 쪽으로), 확인한 쪽 수
    const learnCards = () => {
      const secs = []; L.pages.forEach((pg, i) => { let sc = secs.find((x) => x.name === pg.section); if (!sc) secs.push(sc = { name: pg.section, pages: [], first: i }); sc.pages.push(pg); });
      return `<div class="make-cards learn-cards">${secs.map((sc) => {
        const n = sc.pages.length, d = sc.pages.filter((pg) => state.seen[pg.id]).length;
        return `<a class="make-card${d === n ? ' done' : ''}" href="#/p/${sc.first}"><b>${esc(sc.name)}</b><span>${sc.pages.map((pg) => esc(pg.title)).join(' · ')}</span>${isTeacher() ? `<em>${n}쪽</em>` : `<em>${d === n ? '✓ 다 확인함' : `확인 ${d}/${n}`}</em>`}</a>`;
      }).join('')}</div>`;
    };
    const ledWhat = NOLAB ? `${[L.pages.some((pg) => pg.type === 'story') ? '이야기 보기' : '', L.pages.some((pg) => pg.check) || !L.pages.some((pg) => pg.type === 'story') ? '확인 문제' : '', L.pages.some(isGamePage) ? '분류 게임' : '', L.pages.some((pg) => ['escape-lock', 'path-code', 'dilemma'].includes(pg.widget)) ? '미션 게임' : '', HAS_REVIEW ? '복습 게임' : ''].filter(Boolean).join('·')}을 해낼 때마다` : '확인 문제를 맞히고 미션을 통과할 때마다';
    // 오늘 만들 것: 실습 3개 카드 + 미션 진행(UI/UX 5차 10 P1-7)
    const makeCards = NOLAB ? learnCards() : `<div class="make-cards">${labs.map((lab) => {
      const st = stops.find((s) => s.key === lab.id), d = lab.missions.filter((m) => state.missions[m.id]).length, n = lab.missions.length;
      return `<a class="make-card${d === n ? ' done' : ''}${lab.card ? ' has-scene' : ''}" href="${st.hash}">${lab.card ? `<img class="make-scene" src="${esc(lab.card)}" alt="" aria-hidden="true" width="800" height="600" loading="lazy">` : lab.icon ? `<img src="${esc(lab.icon)}" alt="" aria-hidden="true">` : ''}<b>${esc(lab.title)}</b><span>${esc(lab.kidGoal || lab.goal)}</span>${isTeacher() ? `<em>미션 ${n}개</em>` : `<em>${d === n ? '✓ 완주' : `미션 ${d}/${n}`}</em>`}</a>`;
    }).join('')}</div>`;
    return `<div class="page">${episodeMapHTML(L.episodeMap)}
      <section class="hero">
        <div>
          ${whereTop(0, L.course)}
          <h1>${esc(L.title)}</h1>
          <p class="lead">${isTeacher() ? '' : `${esc(session.name)}${/학생$/.test(session.name) ? '' : ' 학생'}, 반가워요. `}${esc(L.subtitle)}</p>
          ${!isTeacher() && freshEntry ? (freshEntry = false, '<p class="fresh-note" role="note"><b>처음 들어왔어요.</b> 기록은 이 기기에만 저장돼요. 다른 기기의 기록과는 이어지지 않아요.</p>') : ''}
          <p class="hero-cta">${cta}</p>
        </div>
        <div class="hero-visual">
          <div class="hero-art">${artImg(L.heroArt || 'pbMaze', 'hero-scene')}</div>
          ${matrixHTML(p.cells, true)}
          <p>${ledWhat} ${esc(PW_IGA)} 켜져요.<br>모두 켜면 마이크로비트가 하트를 보여 줘요.</p>
        </div>
      </section>
      <h2>${NOLAB ? '오늘 배울 것' : '오늘 만들 것'}</h2>
      ${makeCards}
      <details class="goal-formal"${isTeacher() ? ' open' : ''}><summary>학습 목표 (선생님·보호자용)</summary><ul class="goals">${L.goals.map((g) => `<li>${esc(g)}</li>`).join('')}</ul></details>
      <h2>수업 흐름</h2>
      ${flowHTML()}
      <h2>준비</h2><div class="callout tip">${L.prepare}</div>
    </div>${pager(0)}`;
  }

  const creditHTML = (o) => (o && o.credit ? `<small class="credit">출처: ${esc(o.credit)}</small>` : '');
  /* ---------- 이론 ---------- */
  function viewTheory(p, idx) {
    // 그림 칸에는 첫 그림만, 나머지 사진(생활 속 예)은 인포그래픽 아래 '사진 띠'로 — 핵심 인포그래픽이 첫 화면 가까이 오게(09 P1-4)
    const figHTML = (im, zoom) => im.video ? clipHTML(Object.assign({ credit: im.credit }, im.video), { cap: im.cap || '', desc: im.alt }) : `<figure class="figure"><img src="${esc(im.src)}" alt="${esc(im.alt || im.cap || p.title)}" loading="lazy"${zoom ? ' data-zoom tabindex="0" role="button"' : ''}>${im.cap || im.credit ? `<figcaption>${esc(im.cap || '')}${creditHTML(im)}</figcaption>` : ''}</figure>`;
    const [leadIm, ...restIm] = p.images || [];
    const figs = leadIm ? figHTML(leadIm) : '';
    const strip = restIm.length ? `<div class="photo-strip" role="group" aria-label="생활 속 예">${restIm.map((im) => figHTML(im, true)).join('')}</div>` : '';
    // 모션(원리 보기)과 위젯(직접 해 보기)이 둘 다 있으면 탭으로 나눈다. 기본은 원리 보기(자동재생 안 함), 선택은 페이지별로 기억.
    const tabPref = (prefs.mediaTab || {})[p.id] || 'motion';
    const side = p.motion && p.widget ? `<div class="media-tabs" role="tablist" aria-label="그림 보기 방식">
        <button role="tab" data-media="motion" aria-selected="${tabPref === 'motion'}">원리 보기</button>
        <button role="tab" data-media="widget" aria-selected="${tabPref === 'widget'}">직접 해 보기</button></div>
      <div class="media-panel" data-panel="motion" ${tabPref === 'motion' ? '' : 'hidden'}><div class="motion-slot" data-motion="${esc(p.motion)}"></div></div>
      <div class="media-panel" data-panel="widget" ${tabPref === 'widget' ? '' : 'hidden'}><div class="widget-slot" data-widget="${p.widget}"></div></div>`
      : p.motion ? `<div class="motion-slot" data-motion="${esc(p.motion)}"></div>`
      : p.widget ? `<div class="widget-slot" data-widget="${p.widget}"></div>` : p.video ? videoHTML(p) : figs;
    const trio = p.trio ? `<div class="trio">${p.trio.map((t) => `<article><img src="${esc(t.img)}" alt="${esc(t.alt || t.name)}" loading="lazy"><h3>${esc(t.name)} <small>${esc(t.like)}</small></h3><p>${esc(t.text)}</p><p class="ex">${esc(t.ex)}</p>${t.credit ? `<p class="credit">사진 출처: ${esc(t.credit)}</p>` : ''}</article>`).join('')}</div>` : '';
    const note = isTeacher() && window.Auth.answers().notes[p.id];
    const done = !!state.seen[p.id];
    // 본문의 인포그래픽은 두 칸(본문|그림) 아래 전체 폭 줄로 뺀다 — 좁은 본문 칸에서는 그림 속 글자가 4~7px로 작아짐(그룹 검증 3차)
    // 정해진 규칙: class가 꼭 "figure ig"인 것만 옮긴다. 상자 안에 남길 인포그래픽은 "figure ig in-box"(예: 설명 상자 callout 안 한 줄 요약 그림, 2차시) — 옮기지 않고 그 자리에 둔다
    const IG_RE = /<figure class="figure ig">[\s\S]*?<\/figure>/g;
    const bodyIgs = ((p.body || '').match(IG_RE) || []).join('');
    const bodyHtml = (p.body || '').replace(IG_RE, '');
    // S3-7 가이드 쪽(type:'guide', 블루투스 연결 등): 본문 아래 전체 폭 단계 카드(core/js/guides.js). 본문이 없으면 본문 줄을 그리지 않는다
    const guideSlot = p.guide ? `<div class="guide-slot" data-guide="${esc(p.guide)}"></div>` : '';
    // 10차 T: 본문 줄(본문 카드 | 그림·모션·위젯 카드, 1:1·같은 높이) 바로 아래에 '더 자세히 알아보기' 전체 폭 카드(머리 전체가 여닫는 단추, 오른쪽 ▾),
    // 그 아래 교사 메모 카드(교사만). 둘 다 본문 카드 밖. applyDeep(교사 설정 '펼쳐 두기')은 details.deep을 그대로 연다
    // 페르소나 2회차 #1: 본문에서 뺀 그림 줄(인포그래픽·사진 띠·3요소)은 '더 자세히' 카드 **위**에 둔다 — 닫힌 '더 자세히' 아래에 본문 그림이 오면 그 안에 든 것처럼 보였다
    const deepCard = p.deep ? `<details class="deep deep-card"><summary><span class="deep-title">더 자세히 알아보기</span><span class="deep-hint" aria-hidden="true"><span class="when-closed">펼쳐 보기</span><span class="when-open">접기</span></span><span class="deep-chev" aria-hidden="true">▾</span></summary><div class="deep-body">${p.deep}</div></details>` : '';
    return `<div class="page">
      ${whereTop(idx, p.section)}
      <h1>${esc(p.title)}</h1>
      ${p.asOf ? `<p class="as-of">${esc(p.asOf)}</p>` : ''}
      ${bodyHtml || side || !guideSlot ? `<div class="theory ${side ? '' : 'text-only'}${side && p.layout === 'stack' ? ' stack' : ''}">
        <div class="body">
          ${bodyHtml}${p.sceneArt ? artImg(p.sceneArt, 'theory-art') : ''}
        </div>
        ${side ? `<div class="side">${side}</div>` : ''}
      </div>` : ''}
      ${guideSlot}
      ${bodyIgs ? `<div class="ig-row">${bodyIgs}</div>` : ''}
      ${p.videoCard ? videoCardHTML(p.videoCard) : ''}
      ${side === figs ? strip : ''}
      ${trio}
      ${deepCard}
      ${note ? teacherNoteHTML(note, 'card') : ''}
      ${p.check ? checkQ(p, done) : ''}
      ${p.reflect ? `<div class="check-q"><h3>내 생각 적기${p.reflectOptional ? ' <small class="opt-tag">(선택)</small>' : ''}</h3><label class="field"><span class="sr">${esc(p.reflect)}</span><textarea id="reflect" rows="3" placeholder="${esc(p.reflect)}">${esc(state.reflect[p.id] || '')}</textarea></label><p class="fine" id="reflectNote">${done ? `저장했어요. ${esc(PW_IGA)} 켜졌어요.` : `한 문장 이상 적으면 ${esc(PW_IGA)} 켜져요.`}</p></div>` : ''}
      ${careersHTML(p)}
    </div>${pager(idx)}`;
  }
  /* 9차 B(D14): 영상 자리 — page.poster가 있으면 그림(+3줄)과 [영상 보기]를 먼저, 누르면 그때 영상을 불러온다(학교망에서 막혀도 빈 상자가 아님).
   * 그림 파일이 아직 없으면(불러오기 실패) 그림만 빼고 3줄과 단추를 보인다. 영상 캡션·막힘 안내·출처는 그대로 */
  /* 영상 카드 page.videoCard(1차시 피드백): 그림 칸(사진·위젯)과 따로, 본문 줄 아래 전체 폭 가로형 카드 — 포스터 그림 | 제목·설명 줄·[영상 보기]·캡션·막힘 안내·출처.
   * 누르면 그때 YouTube를 불러온다(학교망에서 막혀도 빈 상자가 아님). opts: { id(YouTube id) | url(embed 주소), title?, poster: { img, alt }, lines[], cap, credit }. 기존 page.video(그림 칸 영상)는 그대로 */
  const vcUrl = (v) => (v.url ? String(v.url) : v.id ? `https://www.youtube-nocookie.com/embed/${encodeURIComponent(v.id)}` : '');
  function videoCardHTML(v) {
    const po = v.poster || {}, lines = (v.lines || []).filter(Boolean), title = v.title || v.cap || '영상';
    return `<section class="video-card" aria-label="${esc(title)}" data-vc>
      <div class="vc-media" data-vc-media>${po.img ? `<img class="vc-poster" src="${esc(po.img)}" alt="${esc(po.alt || '')}" loading="lazy" decoding="async" data-vc-img>` : ''}</div>
      <div class="vc-text">
        ${v.title ? `<h3 class="vc-title">${esc(v.title)}</h3>` : ''}
        ${lines.length ? `<ul class="vc-lines">${lines.map((t) => `<li>${t}</li>`).join('')}</ul>` : ''}
        <p class="vc-play"><button class="btn primary" type="button" data-vc-play>영상 보기</button></p>
        <p class="vc-cap">${v.cap ? `${esc(v.cap)} ` : ''}<span class="video-alt">영상이 안 보이면 학교 인터넷에서 막혔을 수 있어요. 선생님 화면으로 함께 봐요.</span>${v.credit ? `<small class="credit">영상 출처: ${esc(v.credit)}</small>` : ''}</p>
      </div></section>`;
  }
  function videoHTML(p) {
    const cap = `<figcaption>${esc(p.videoCap || '')}<span class="video-alt">영상이 안 보이면 학교 인터넷에서 막혔을 수 있어요. 선생님 화면으로 함께 봐요.</span>${p.videoCredit ? `<small class="credit">영상 출처: ${esc(p.videoCredit)}</small>` : ''}</figcaption>`;
    const iframe = `<iframe src="${esc(p.video)}" title="${esc(p.videoCap || '영상')}" allow="encrypted-media; picture-in-picture" allowfullscreen loading="lazy"></iframe>`;
    const po = p.poster;
    if (!po) return `<figure class="figure video"><div class="video-box">${iframe}</div>${cap}</figure>`;
    const lines = (po.lines || []).filter(Boolean);
    return `<figure class="figure video has-poster"><div class="video-poster" data-video-wrap>
        ${po.img ? `<img class="poster-img" src="${esc(po.img)}" alt="${esc(po.alt || '')}" decoding="async" data-poster-img>` : ''}
        ${lines.length ? `<ul class="poster-lines">${lines.map((t) => `<li>${t}</li>`).join('')}</ul>` : ''}
        <p class="poster-play"><button class="btn primary" type="button" data-video-play>영상 보기</button></p>
      </div>${cap}</figure>`;
  }
  // 9차 B(D15): 진로 카드 "이 기술을 다루는 사람들"(직업·하는 일·공부할 것) + 생각 한 줄(state.reflect[`${p.id}:career`])
  // 10차 T: 직업 칸마다 맨 위에 캐릭터 그림(items[].img·alt, 장식 아님 → 대체 글 있는 진짜 그림). 그림 자리 높이를 고정해 네 칸 높이를 맞춘다
  function careersHTML(p) {
    const c = p.careers; if (!c || !(c.items || []).length) return '';
    const rk = `${p.id}:career`;
    // 페르소나 2회차 #32: 차시 L.careersCollapse가 true면 '하는 일' 한 줄만 보이고 나머지(오늘 한 일·과목·공부)는 접어 둠(내용은 그대로). 3~4는 끔
    const foldMore = (html) => (L.careersCollapse && html ? `<details class="career-more"><summary>더 보기</summary>${html}</details>` : html);
    return `<section class="careers" aria-label="${esc(c.title || '이 기술을 다루는 사람들')}"><h3>${esc(c.title || '이 기술을 다루는 사람들')}</h3>
      ${c.img ? `<figure class="figure ig career-fig"><img src="${esc(c.img)}" alt="${esc(c.alt || '')}" loading="lazy" data-zoom tabindex="0" role="button" data-career-img></figure>` : ''}
      <div class="career-cards">${c.items.map((it) => `<article class="career-card">${it.img ? `<div class="career-pic"><img class="career-img" src="${esc(it.img)}" alt="${esc(it.alt || '')}" loading="lazy" decoding="async"></div>` : ''}<h4>${esc(it.job)}</h4>${it.does ? `<p><span class="career-k">하는 일</span>${esc(it.does)}</p>` : ''}${foldMore(`${it.today ? `<p class="career-today"><span class="career-k">오늘 한 일과 연결</span>${esc(it.today)}</p>` : ''}${it.hs ? `<p><span class="career-k">고등학교에서 들을 과목</span>${esc(it.hs)}</p>` : ''}${it.study ? `<p><span class="career-k">${it.hs ? '대학에서 공부할 것' : '공부할 것'}</span>${esc(it.study)}</p>` : ''}`)}</article>`).join('')}</div>
      ${c.prompt ? `<label class="field career-think"><span>${esc(c.prompt)}</span><input data-career="${esc(rk)}" maxlength="120" autocomplete="off" value="${esc((state.reflect || {})[rk] || '')}"></label>` : ''}
    </section>`;
  }

  /* 확인 문제 보기 섞기(페르소나 2회차 #4): 차시 L.shuffleChecks가 true일 때만. 보기 순서는 학생(세션 키)·쪽마다 고정(다시 와도 같은 순서).
   * 단추의 data-k는 원래 번호 그대로라 정답 판정(c.answer)은 바뀌지 않는다 */
  function checkOrder(p) {
    const n = p.check.options.length, idx = [...Array(n).keys()];
    if (!L.shuffleChecks || n < 2) return idx;
    let s = 2166136261; for (const ch of `${userId()}|${p.id}`) { s ^= ch.charCodeAt(0); s = Math.imul(s, 16777619) >>> 0; }
    const rnd = () => { s = (Math.imul(s ^ (s >>> 15), 2246822507) + 0x9E3779B9) >>> 0; s ^= s >>> 13; return (s >>> 0) / 4294967296; };
    for (let i = n - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
    return idx;
  }
  function checkQ(p, done) {
    const c = p.check;
    return `<div class="check-q ${done ? 'solved' : ''}" data-check="${esc(p.id)}">
      <h3>${done ? '확인 문제 · 맞혔어요' : '잠깐 확인'}<span class="fine"> 맞히면 ${esc(PW_IGA)} 켜져요</span></h3><p class="q">${esc(c.q)}</p>
      <div class="options">${checkOrder(p).map((k) => [c.options[k], k]).map(([o, k]) => `<button class="option ${done && k === c.answer ? 'correct' : ''}" data-k="${k}" ${done ? 'aria-disabled="true"' : ''}>${esc(o)}${done && k === c.answer ? '<span class="sr"> (정답)</span>' : ''}</button>`).join('')}</div>
      ${isTeacher() && !done ? '<p class="teacher-only"><button class="btn ghost small" data-reveal>정답 공개</button></p>' : ''}
      <div class="explain" ${done ? '' : 'hidden'}>${done ? esc(c.explain) : ''}</div></div>`;
  }
  // 보기 옆 화면 낭독기용 글자(정답·오답을 색으로만 알리지 않게, UI/UX 5차 05 P0-1)
  const markOpt = (btn, t) => { if (!$('.sr', btn)) btn.insertAdjacentHTML('beforeend', `<span class="sr"> (${t})</span>`); };
  function bindTheory(root, p) {
    // 위젯 넷째 값 ctx(S3-3 분류 게임 등): done() = 이 쪽 위젯 완료를 진행 기록(state.widgets)에 남김, isDone = 이미 끝냈는지, announce = 화면 낭독 알림
    const wctx = { isDone: !!(state.widgets || {})[p.id], teacher: isTeacher(), announce: (t) => announce(t), say: PW_IGA,
      done: () => { if ((state.widgets || {})[p.id]) return false; state.widgets = Object.assign({}, state.widgets, { [p.id]: Date.now() }); if (!p.check && !p.reflect && !state.seen[p.id]) state.seen[p.id] = Date.now(); save(); return true; },
      // ★비트런 게임 위젯(escape-lock·path-code·dilemma): 결과 카드에 남길 값(시도·힌트·별·선택)
      data: () => pageData(p.id), setData: (o) => setPageData(p.id, o), pageHref, notebook: L.notebook || null };
    const slot = $('[data-widget]', root); if (slot) window.Widgets.mount(slot, slot.dataset.widget, ['escape-lock', 'path-code', 'dilemma'].includes(slot.dataset.widget) ? fillName(recOpts(p.widgetOpts)) : recOpts(p.widgetOpts), wctx);
    // S3-7 가이드 쪽: 단계 [했어요]·적는 칸은 state.guides[쪽 id]에 남고, 필수 단계를 다 하면 '확인한 쪽'(확인 문제·생각 적기가 없을 때)
    const gslot = $('[data-guide]', root);
    if (gslot && window.Guides) {
      const gopts = Object.assign({}, recOpts(p.guideOpts || {}), p.steps ? { steps: p.steps } : {}, p.trouble ? { trouble: p.trouble } : {});
      window.Guides.mount(gslot, gslot.dataset.guide, gopts, { teacher: isTeacher(), say: PW_IGA, announce: (t) => announce(t), get: () => (state.guides || {})[p.id] || {},
        set: (g) => { state.guides = Object.assign({}, state.guides, { [p.id]: g }); let lit = false; if (g.done && !p.check && !p.reflect && !state.seen[p.id]) { state.seen[p.id] = Date.now(); lit = true; } save(); return lit; } });
    }
    const mslot = $('[data-motion]', root);
    if (mslot && window.Motion) window.Motion.mount(mslot, mslot.dataset.motion, { present: !!prefs.present, onTry: () => switchMedia('widget'), opts: recOpts(p.motionOpts) });
    function switchMedia(which) {
      $$('[data-media]', root).forEach((b) => b.setAttribute('aria-selected', String(b.dataset.media === which)));
      $$('[data-panel]', root).forEach((pn) => { pn.hidden = pn.dataset.panel !== which; });
      if (which === 'widget' && window.Motion) window.Motion.pauseAll();
      prefs.mediaTab = Object.assign({}, prefs.mediaTab, { [p.id]: which }); savePrefs();
    }
    $$('[data-media]', root).forEach((b) => b.addEventListener('click', () => switchMedia(b.dataset.media)));
    const box = $('.check-q[data-check]', root);
    if (box) {
      const c = p.check;
      // disabled 대신 aria-disabled: 누른 보기에 초점이 남고, 결과는 라이브 영역으로 알린다(UI/UX 5차 05 P0-2)
      const solve = (b) => {
        const ex = $('.explain', box); ex.hidden = false;
        $$('.option', box).forEach((x) => { x.setAttribute('aria-disabled', 'true'); x.classList.remove('wrong'); if (+x.dataset.k === c.answer) { x.classList.add('correct'); markOpt(x, '정답'); } });
        ex.innerHTML = `<b>정답!</b> ${esc(c.explain)}`;
        box.classList.add('solved'); $('h3', box).firstChild.textContent = '확인 문제 · 맞혔어요';
        const rv = $('[data-reveal]', box); if (rv) rv.remove();
        if (b && !state.seen[p.id]) { state.seen[p.id] = Date.now(); save(); }
        announce(`정답! ${c.explain}${b && !isTeacher() ? ` ${PW_IGA} 켜졌어요.` : ''}`);
        if (!b) { const cx = $('.option.correct', box); if (cx) cx.focus(); }
      };
      $$('.option', box).forEach((b) => b.addEventListener('click', () => {
        if (b.getAttribute('aria-disabled') === 'true') return;
        const k = +b.dataset.k;
        if (k === c.answer) return solve(b);
        const ex = $('.explain', box); ex.hidden = false;
        b.classList.add('wrong'); b.setAttribute('aria-disabled', 'true'); markOpt(b, '내가 고른 답, 틀렸어요'); beep('no');
        ex.innerHTML = '아직 아니에요. 위 내용을 다시 읽고 다른 답을 골라 봐요.';
        announce('아직 아니에요. 다른 답을 골라 봐요.');
      }));
      const rv = $('[data-reveal]', box); if (rv) rv.addEventListener('click', () => solve(null));
    }
    const ta = $('#reflect', root);
    if (ta) ta.addEventListener('input', () => {
      state.reflect[p.id] = ta.value;
      if (ta.value.trim().length >= 5 && !state.seen[p.id]) { state.seen[p.id] = Date.now(); $('#reflectNote').textContent = `저장했어요. ${PW_IGA} 켜졌어요.`; }
      save();
    });
    // 9차 B: 영상 포스터 → [영상 보기]를 눌러야 영상을 불러온다. 포스터 그림이 아직 없으면 그림만 뺀다
    const pimg = $('[data-poster-img]', root);
    if (pimg) { const drop = () => { const f = pimg.closest('[data-video-wrap]'); pimg.remove(); if (f) f.classList.add('no-img'); }; if (pimg.complete && !pimg.naturalWidth) drop(); else pimg.addEventListener('error', drop); }
    const vplay = $('[data-video-play]', root);
    if (vplay) vplay.addEventListener('click', () => {
      const wrap = vplay.closest('[data-video-wrap]');
      wrap.outerHTML = `<div class="video-box"><iframe src="${esc(p.video)}" title="${esc(p.videoCap || '영상')}" allow="encrypted-media; picture-in-picture" allowfullscreen></iframe></div>`;
      const fr = $('.figure.video iframe', root); if (fr) fr.focus({ preventScroll: true });
      announce('영상을 불러왔어요. 안 보이면 학교 인터넷에서 막혔을 수 있어요.');
    });
    // 영상 카드: 포스터가 없으면(불러오기 실패) 그림 칸을 빼고, [영상 보기]를 누르면 그림 칸에 영상을 불러온다
    const vc = $('[data-vc]', root);
    if (vc && p.videoCard) {
      const vimg = $('[data-vc-img]', vc), media = $('[data-vc-media]', vc);
      const dropV = () => { if (vimg) vimg.remove(); if (media && !media.children.length) vc.classList.add('no-img'); };
      if (!vimg) dropV(); else if (vimg.complete && !vimg.naturalWidth && vimg.currentSrc) dropV(); else vimg.addEventListener('error', dropV);
      const vb = $('[data-vc-play]', vc);
      vb.addEventListener('click', () => {
        const v = p.videoCard;
        vc.classList.remove('no-img'); vc.classList.add('playing');
        media.innerHTML = `<div class="video-box"><iframe src="${esc(vcUrl(v))}" title="${esc(v.title || v.cap || '영상')}" allow="encrypted-media; picture-in-picture" allowfullscreen></iframe></div>`;
        vb.closest('.vc-play').remove();
        const fr = $('iframe', media); if (fr) fr.focus({ preventScroll: true });
        announce('영상을 불러왔어요. 안 보이면 학교 인터넷에서 막혔을 수 있어요.');
      });
    }
    // 진로 그림이 아직 없으면(불러오기 실패) 그림 칸째 뺀다
    const cimg = $('[data-career-img]', root);
    if (cimg) { const dropC = () => { const f = cimg.closest('figure'); if (f) f.remove(); }; if (cimg.complete && cimg.naturalWidth === 0 && cimg.currentSrc) dropC(); else cimg.addEventListener('error', dropC); }
    // 진로 카드 생각 한 줄
    const ci = $('[data-career]', root);
    if (ci) ci.addEventListener('input', () => { state.reflect[ci.dataset.career] = ci.value; persist(); });
  }

  /* ---------- ★스토리 컷 쪽 type: 'story' (비트런 C2, core/js/story.js) ----------
   * 쪽 완료 = 마지막 컷까지 봄(+ ending choice·vote 답함) + (쪽에 게임 위젯이 있으면) 그 위젯도 끝냄 → state.seen[쪽 id] = 진행 칸 1칸.
   * 위젯은 컷 아래 전체 폭 카드로(이야기 → 자물쇠·퍼즐·딜레마). 교사 메모·'더 자세히'는 이론 쪽과 같은 별도 카드 */
  // ★{이름}: 스토리 말풍선·내레이션·인물 이름·게임 위젯 글의 {이름}을 학생이 입장할 때 쓴 이름으로(짝이면 '민준·서연', 교사·없으면 '대장')
  const playerName = () => { if (!session || isTeacher()) return '대장'; const n = splitNames(session.name); return String(n.length ? n.join('·') : session.name || '').replace(/[&<>"]/g, '').trim() || '대장'; };
  const fillName = (v) => (typeof v === 'string' ? (v.includes('{이름}') ? v.split('{이름}').join(playerName()) : v) : Array.isArray(v) ? v.map(fillName) : v && typeof v === 'object' ? Object.keys(v).reduce((o, k) => { o[k] = fillName(v[k]); return o; }, {}) : v);
  const pageHref = (id) => { const i = L.pages.findIndex((pg) => pg.id === id); return i >= 0 ? `#/p/${i}` : null; };
  const pageData = (id) => Object.assign({}, (state.wdata || {})[id] || {});
  // ★K11 나의 결정 다시 보기(70-gap-meeting 3): 다른 차시(같은 기기·같은 학생 이름) 저장분의 쪽 기록을 읽기만 한다. lessonId 없거나 이 차시면 지금 기록.
  //   교사·미로그인·못 찾음 → null(화면은 조용히 넘어감). 쓰지 않으므로 다른 차시 저장 형식과 부딪치지 않는다
  function recallData(lessonId, pageId) {
    if (!session || isTeacher() || !pageId) return null;
    try {
      const st = !lessonId || lessonId === L.id ? state : local.get(`ponybot:${lessonId}:u:${session.key}`);
      const d = st && st.wdata && st.wdata[pageId];
      return d && typeof d === 'object' ? Object.assign({}, d) : null;
    } catch (e) { return null; }
  }
  function setPageData(id, o) { state.wdata =Object.assign({}, state.wdata, { [id]: Object.assign({}, (state.wdata || {})[id] || {}, o) }); persist(); }
  function viewStory(p, idx) {
    const note = isTeacher() && (window.Auth.answers() || { notes: {} }).notes[p.id];
    const deepCard = p.deep ? `<details class="deep deep-card"><summary><span class="deep-title">더 자세히 알아보기</span><span class="deep-hint" aria-hidden="true"><span class="when-closed">펼쳐 보기</span><span class="when-open">접기</span></span><span class="deep-chev" aria-hidden="true">▾</span></summary><div class="deep-body">${p.deep}</div></details>` : '';
    return `<div class="page story-page">
      ${whereTop(idx, p.section)}
      <h1>${esc(p.title)}</h1>
      ${p.intro ? `<p class="lead st-intro">${fillName(p.intro)}</p>` : ''}
      <div class="story-slot" data-story></div>
      ${p.widget ? `<section class="story-game" aria-label="${esc((p.widgetOpts || {}).title || '이야기 속 미션')}"><div class="widget-slot" data-widget="${esc(p.widget)}"></div></section>` : ''}
      ${deepCard}
      ${note ? teacherNoteHTML(note, 'card') : ''}
    </div>${pager(idx)}`;
  }
  function bindStory(root, p) {
    const gameDone = () => !p.widget || !!(state.widgets || {})[p.id];
    const storyDone = () => !!pageData(p.id).storyAt;
    const lightIf = () => { if (!state.seen[p.id] && storyDone() && gameDone()) { state.seen[p.id] = Date.now(); save(); return true; } return false; };
    const slot = $('[data-story]', root);
    if (slot && window.Story) window.Story.mount(slot, fillName(p), {
      characters: fillName(L.characters || {}), isDone: !!state.seen[p.id] || storyDone(), teacher: isTeacher(), present: !!prefs.present, say: PW_IGA, announce: (t) => announce(t),
      data: () => pageData(p.id), setData: (o) => setPageData(p.id, o), pageHref, notebook: L.notebook || null, recall: recallData,
      finish: () => { if (!storyDone()) setPageData(p.id, { storyAt: Date.now() }); const lit = lightIf(); if (!lit && !gameDone() && !state.seen[p.id]) announce('이야기를 끝까지 봤어요. 아래 미션을 해내면 이 쪽이 끝나요.'); return lit; },
    });
    const ws = $('[data-widget]', root);
    if (ws) window.Widgets.mount(ws, ws.dataset.widget, fillName(recOpts(p.widgetOpts)), { isDone: !!(state.widgets || {})[p.id], teacher: isTeacher(), announce: (t) => announce(t), say: PW_IGA,
      data: () => pageData(p.id), setData: (o) => setPageData(p.id, o), pageHref, notebook: L.notebook || null,
      done: () => { if ((state.widgets || {})[p.id]) return false; state.widgets = Object.assign({}, state.widgets, { [p.id]: Date.now() }); persist(); const lit = lightIf(); if (!lit) renderProgress(); return lit; } });
  }

  /* ---------- 실습 ---------- */
  let labCtx = null, helpReq = null;
  const supportsUSB = () => 'usb' in navigator;
  // MakeCode 새 프로젝트와 같은 시작 화면: '시작하면' + '무한반복'
  const EMPTY = {
    ts: 'basic.forever(function () {\n})\n',
    blocks: '<xml xmlns="http://www.w3.org/1999/xhtml"><block type="pxt-on-start" x="0" y="0"></block><block type="device_forever" x="0" y="260"></block></xml>',
  };

  function missionState(lab, k) { // 카드 class용: 잠김 · 열림 · 완료
    const m = lab.missions[k];
    if (state.missions[m.id]) return 'done';
    if (isTeacher() || k === 0) return 'active';
    // S3-8 두 프로젝트 실습: 같은 프로젝트의 앞 미션만 본다(기기 두 대로 조종용·제어용을 동시에 — 페르소나 2회차 11~12)
    if (lab.projects && lab.projects.length) { const p = projOf(lab, m); for (let j = k - 1; j >= 0; j--) if (projOf(lab, lab.missions[j]) === p) return state.missions[lab.missions[j].id] ? 'active' : 'locked'; return 'active'; }
    return state.missions[lab.missions[k - 1].id] ? 'active' : 'locked';
  }
  /* 미션 상태 4개(UI/UX 7차 03 P0-1): locked · make(1단계 코드 만들기) · robot(2단계 로봇에서 실행) · done.
   * 미션 머리 번호, 진행 점, 툴바 위치 칸, 패널 아래 주 버튼이 모두 이 값 하나로 그려진다(syncLabUI) */
  function mstate(lab, k) {
    const st = missionState(lab, k);
    return st !== 'active' ? st : state.codeOk[lab.missions[k].id] ? 'robot' : 'make';
  }
  // 지금 미션: 학생은 아직 안 끝낸 첫 미션(다 끝냈으면 -1 = 실습 완료 화면), 교사는 펼친 미션
  const curK = (lab) => (isTeacher() ? Math.min(lab.missions.length - 1, labUI.open[lab.id] ?? 0) : lab.missions.findIndex((m) => !state.missions[m.id]));
  // 패널에 펼친 미션: 진행 점으로 지난 미션을 볼 때만 지금 미션과 다르다
  const openK = (lab) => (labUI.open[lab.id] == null ? curK(lab) : labUI.open[lab.id]);
  const labShort = (lab) => String(lab.title).split('.')[0].trim();
  const goalOf = (m) => m.goal || String((m.goalImg && m.goalImg.cap) || '').replace(/^목표:\s*/, '');
  // 학생 되돌리기: 앞 미션을 통과할 때 저장한 "내 코드". 첫 미션은 빈 시작 화면.
  // S3-8 두 프로젝트 실습: 같은 프로젝트의 앞 미션 코드(없으면 빈 시작 화면)
  const checkpointFor = (lab, k) => {
    if (lab.projects && lab.projects.length) {
      const p = projOf(lab, lab.missions[k]);
      for (let j = k - 1; j >= 0; j--) if (projOf(lab, lab.missions[j]) === p) return state.checkpoints[lab.missions[j].id] || null;
      return EMPTY;
    }
    return k === 0 ? EMPTY : state.checkpoints[lab.missions[k - 1].id] || null;
  };
  // 실습 화면 아이콘(7차 10 P1-5: 글자 기호 대신 선 아이콘)
  const ICON = {
    check: '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    lock: '<svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2" fill="currentColor"/><path d="M8.5 11V8.5a3.5 3.5 0 0 1 7 0V11" fill="none" stroke="currentColor" stroke-width="2.4"/></svg>',
    help: '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M9.6 9.4a2.5 2.5 0 1 1 3.5 2.3c-.8.4-1.1.9-1.1 1.7v.3" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><circle cx="12" cy="17" r="1.3" fill="currentColor"/></svg>',
  };

  /* ---------- 측정 기록표(S3-6 + 설계 개정 2) ----------
   * 학생이 로봇에서 잰 값을 적는다 → state.records[미션 id][key]. 결과 카드·선생님 확인 창에 보이고, 체크(record·rec·gt·between)와 시나리오($rec.key)가 쓴다.
   * 형식 두 가지(recSpec이 하나로 맞춤):
   *  ① 객체(설계 개정 2, 권장) mission.record = { step: 2(기본, 2단계 '로봇에서 실행') | 1(1단계 위),
   *       fields: [{ key, label, short?, type:'number'|'text', min, max, hint?, optional? }],
   *       check: { rec, between:[a, b] | gt | lt | range:[min, max], msg? } (또는 배열) — 통과 = optional이 아닌 칸 모두 + check + [목표대로 됐어요],
   *         ★(7~8 페르소나 2회차 #4) gt·lt·between 자리에 수 상수도(문자열 = 칸 key, 수 = 그 값), range:[6, 14] = 칸 값이 6 이상 14 이하(벗어나면 msg),
   *       helper: 'mid'(학생이 먼저 가운데를 계산 → 맞았어요/다시 계산), preview: 'numberline' | { on:'below'|'above', min, max },
   *       optional: [{ key, label, type:'list', item:{ place:'text', value:'number' }, rows? } | { key, label, type:'numbers', count, labels?, helper? }],
   *       compare?: '미션id'(결과 카드 "코드에 쓴 기준값"을 볼 미션. 없으면 이 기록을 시나리오에 쓰는 뒤 미션을 찾음), note? }
   *  ② 배열(S3-6) mission.record = [필드…] + recordAt·recordPass·recordMid·recordLine·recordCompare·recordNote */
  const recOf = (mid) => ((state.records || {})[mid]) || {};
  const recFilled = (v) => (Array.isArray(v) ? v.some((x) => (x && typeof x === 'object' ? Object.values(x).some(recFilled) : recFilled(x))) : v !== undefined && v !== null && String(v).trim() !== '');
  const allMissions = () => labs.flatMap((lb) => lb.missions);
  // 미션 시나리오·체크가 쓰는 기록 키($rec.키, { rec: '키' })
  function recKeysUsed(mid) {
    const v2 = window.PB && window.PB.missionsV2 && window.PB.missionsV2[mid]; if (!v2) return new Set();
    const s = JSON.stringify([v2.scenarios || [], v2.checks || []]), out = new Set(); let mm;
    const re = /\$rec\.([\w가-힣-]+)|"rec":"([^"]+)"/g; while ((mm = re.exec(s))) out.add(mm[1] || mm[2]);
    return out;
  }
  const recSpecs = new WeakMap();
  function recSpec(m) {
    const r = m && m.record; if (!r || (Array.isArray(r) ? !r.length : !Array.isArray(r.fields) || !r.fields.length)) return null;
    const hit = recSpecs.get(m); if (hit && hit.src === r) return hit;
    let sp;
    if (Array.isArray(r)) sp = { fields: r, optional: [], at: m.recordAt === 'code' ? 'code' : 'robot', pass: Array.isArray(m.recordPass) ? m.recordPass : r.map((f) => ({ record: f.key })), mid: Array.isArray(m.recordMid) ? m.recordMid : null, line: m.recordLine || null, compare: m.recordCompare || null, note: m.recordNote };
    else {
      const fields = r.fields, checks = [].concat(r.check || []).map((c) => Object.assign({}, c, { record: c.record != null ? c.record : c.rec }));
      const bw = checks.find((c) => Array.isArray(c.between) && c.between.every((x) => typeof x === 'string')), thKey = bw ? bw.record : null, thF = fields.find((f) => f.key === thKey) || {};
      const pv = r.preview;
      let compare = r.compare ? (typeof r.compare === 'string' ? { key: thKey, mission: r.compare } : r.compare) : null;
      if (!compare && thKey) { const keys = new Set(fields.map((f) => f.key)), list = allMissions(), i = list.indexOf(m); const later = list.slice(i + 1).find((x) => [...recKeysUsed(x.id)].some((k) => keys.has(k))); if (later) compare = { key: thKey, mission: later.id }; }
      sp = {
        fields, optional: Array.isArray(r.optional) ? r.optional : [], at: r.step === 1 || r.step === 'code' ? 'code' : 'robot',
        pass: fields.filter((f) => !f.optional).map((f) => ({ record: f.key })).concat(checks), mid: r.helper === 'mid' && bw ? [bw.between[0], bw.between[1], thKey] : Array.isArray(r.helper) ? r.helper : null,
        line: pv && bw ? Object.assign({ min: thF.min != null ? thF.min : 0, max: thF.max != null ? thF.max : 255, points: bw.between, threshold: thKey, on: 'below' }, typeof pv === 'object' ? pv : {}) : null,
        compare, note: r.note, optTitle: typeof r.optionalTitle === 'string' && r.optionalTitle.trim() ? r.optionalTitle.trim() : null, // 페르소나 2회차 #23: 선택 칸 접힌 제목(기본 "더 해 보기 (선택)")
      };
    }
    sp.src = r; recSpecs.set(m, sp); return sp;
  }
  // 어떤 미션의 기록을 다른 미션이 쓰는지: 이 미션 시나리오가 쓰는 키를 가진 기록표 미션(같은 실습 안, [기록 다시 재기])
  function recMissionFor(lab, m) {
    const used = recKeysUsed(m.id); if (!used.size) return -1;
    return lab.missions.findIndex((x) => x !== m && recSpec(x) && recSpec(x).fields.some((f) => used.has(f.key)));
  }
  // 차시 전체 기록(숫자 칸은 숫자로): '$rec.키'·'{rec.키|기본}'용
  function recAll() {
    const all = {}; allMissions().forEach((x) => Object.entries(recOf(x.id)).forEach(([k, v]) => { if (!Array.isArray(v) && recFilled(v) && isFinite(+v)) { all[k] = +v; all[`${x.id}.${k}`] = +v; } }));
    return all;
  }
  /* 글 안 '{rec.키|기본}'(설계 개정 2: missionBlocks xml·순서 맞추기 글): 기록 값, 없으면 기본(없으면 빈칸) */
  function recText(s) {
    if (typeof s !== 'string' || !s.includes('{rec.')) return s;
    const all = recAll();
    return s.replace(/\{rec\.([\w가-힣.-]+?)(?:\|([^}]*))?\}/g, (x, k, d) => (all[k] != null ? String(all[k]) : d != null ? d : ''));
  }
  // 채점에 넘기는 기록: 차시의 모든 미션 기록을 차례로 합치고(앞 미션에서 잰 값을 뒤 미션 시나리오가 씀) 이 미션 기록을 맨 위에. '미션id.key'로도 찾을 수 있게
  function recordsFor(m) {
    const out = {};
    labs.flatMap((lb) => lb.missions).forEach((x) => { const r = recOf(x.id); Object.entries(r).forEach(([k, v]) => { if (!Array.isArray(v) && recFilled(v)) { out[k] = v; out[`${x.id}.${k}`] = v; } }); });
    Object.entries(recOf(m.id)).forEach(([k, v]) => { if (!Array.isArray(v) && recFilled(v)) out[k] = v; }); // 선택 칸(목록·숫자 여러 개)은 채점에 넘기지 않음
    return out;
  }
  /* 위젯·장면 opts의 '$rec.키|기본값'(P5): 학생 측정 기록(차시 전체, 미션id.키도 됨)으로 바꾼다. 기록이 없으면 기본값(없으면 그 칸을 뺌 → 위젯 기본값).
   * 예) widgetOpts: { threshold: { value: '$rec.threshold|60' } } — '$rec'가 없는 opts는 그대로 돌려준다(3~4 그대로) */
  /* 위젯·장면 opts의 '$rec.키|기본값'(P5) 또는 '$rec.키' + 같은 칸의 fallback(설계 개정 2: { value: '$rec.threshold', fallback: 60 }, motionOpts 바로 아래 fallback)
   * 학생 측정 기록(차시 전체, 미션id.키도 됨)으로 바꾼다. 기록도 기본값도 없으면 그 칸을 뺌 → 위젯 기본값. '$rec'가 없는 opts는 그대로(3~4 그대로) */
  function recOpts(o) {
    if (!o || !/"\$rec\./.test(JSON.stringify(o))) return o;
    const all = recAll();
    const walk = (v, fb) => {
      if (typeof v === 'string') { const m = /^\$rec\.([\w가-힣.-]+?)(?:\|(-?\d+(?:\.\d+)?))?$/.exec(v); return m ? (all[m[1]] != null ? all[m[1]] : m[2] != null ? +m[2] : typeof fb === 'number' ? fb : undefined) : v; }
      if (Array.isArray(v)) return v.map((x, i) => walk(x, Array.isArray(fb) ? fb[i] : fb));
      if (v && typeof v === 'object') { const f = v.fallback != null ? v.fallback : fb, out = {}; Object.entries(v).forEach(([k, x]) => { const y = walk(x, f); if (y !== undefined) out[k] = y; }); return out; }
      return v;
    };
    return walk(o);
  }
  const recShort = (r) => r.short || String(r.label || r.key || '').replace(/\s*\(.*$/, '') || r.label; // 짧은 이름: short, 없으면 칸 이름의 괄호 앞('어두울 때(손으로…) 빛 밝기' → '어두울 때')
  const recFields = (m) => { const sp = recSpec(m); return sp ? sp.fields.concat(sp.optional) : []; };
  // 선택 칸(목록·숫자 여러 개) 한 줄로: '종이컵 안 3, 창가 200' / '4, 5, 3'
  const recVal = (r, v) => (Array.isArray(v) ? (r.type === 'list' ? v.filter((x) => x && Object.values(x).some(recFilled)).map((x) => Object.values(x).filter(recFilled).join(' ')).join(', ') : v.filter(recFilled).join(', ')) : String(v));
  const recLine = (m) => recFields(m).filter((r) => recFilled(recOf(m.id)[r.key])).map((r) => `${recShort(r)} ${recVal(r, recOf(m.id)[r.key])}${r.unit ? ` ${r.unit}` : ''}`).join(' · ');
  const recN = (m, k) => { const v = recOf(m.id)[k]; return !Array.isArray(v) && recFilled(v) && isFinite(+v) ? +v : null; };
  const recLabel = (m, k) => recShort(recFields(m).find((r) => r.key === k) || { label: k });
  // 조사: 한글 끝 받침·숫자 끝(일·삼·육·칠·팔·영/십/백/천은 받침) — w + 조사
  const jo = (w, a, b) => { const s = String(w).trim(), ch = s.slice(-1); return s + (/[0-9]/.test(ch) ? (/[013678]/.test(ch) ? a : b) : josaOf(s, a, b)); };
  // 계산 도우미(helper 'mid' = [어두움 key, 밝음 key, 기준값 key]): 학생이 먼저 계산해 적으면 확인만 한다(P4·설계 개정 2: 가운데 값은 맞힌 뒤에만 보여 줌)
  function recordMidText(m) {
    const sp = recSpec(m); if (!sp || !Array.isArray(sp.mid) || sp.mid.length < 2) return '';
    const [ka, kb, kt] = sp.mid, A = recN(m, ka), B = recN(m, kb), Tv = kt ? recN(m, kt) : null;
    if (A == null || B == null) return `${jo(recLabel(m, ka), '과', '와')} ${jo(recLabel(m, kb), '을', '를')} 먼저 적어요. 그다음 두 값의 가운데를 직접 계산해 봐요: (${recLabel(m, ka)} + ${recLabel(m, kb)}) ÷ 2`;
    const sum = `(${A} + ${B}) ÷ 2`;
    if (!kt) return `가운데 = ${sum} = ${Math.round((A + B) / 2)}`;
    if (Tv == null) return `두 값을 적었어요. 가운데를 직접 계산해 "${recLabel(m, kt)}" 칸에 적어 봐요: ${sum} = ?`;
    const inside = Tv > Math.min(A, B) && Tv < Math.max(A, B), right = Math.abs(Tv - (A + B) / 2) <= 0.5;
    if (right) return `${sum} = ${Tv} — 맞았어요! ✓ ${jo(Tv, '은', '는')} ${jo(A, '과', '와')} ${B} 사이예요.`;
    return inside ? `${jo(Tv, '은', '는')} ${jo(A, '과', '와')} ${B} 사이라서 쓸 수 있어요. 가운데로 하려면 다시 계산해 봐요: ${sum} = ?` : `${jo(Tv, '은', '는')} ${jo(A, '과', '와')} ${B} 사이가 아니에요. 다시 계산해 봐요: ${sum} = ?`;
  }
  // 수직선 미리 보기(preview 'numberline' = { min, max, points:[key…], threshold:key, on:'below'|'above' }): 내 점과 기준값 화살표, 켜지는 쪽 색칠(P4)
  function recordLineHTML(m) {
    const sp = recSpec(m), o = sp && sp.line; if (!o) return '';
    const min = o.min != null ? o.min : 0, max = o.max != null ? o.max : 255, pc = (v) => Math.max(0, Math.min(100, ((v - min) / (max - min || 1)) * 100));
    const T = o.threshold ? recN(m, o.threshold) : null;
    const zone = T == null ? '' : o.on === 'above' ? `left:${pc(T)}%;right:0` : `left:0;width:${pc(T)}%`;
    const pts = (o.points || []).map((k) => [k, recN(m, k)]).filter(([, v]) => v != null);
    // 페르소나 2회차 #22: 아직 아무 값도 없으면 preview.example(흐린 예시 점·기준값) + preview.empty(안내 한 줄). 값을 하나라도 적으면 내 점만
    if (T == null && !pts.length && (o.example || o.empty)) {
      const ex = o.example && typeof o.example === 'object' ? o.example : {}, num = (v) => (typeof v === 'number' && isFinite(v) ? v : null);
      const ET = o.threshold ? num(ex[o.threshold]) : null, eps = (o.points || []).map((k) => [k, num(ex[k])]).filter(([, v]) => v != null);
      const ez = ET == null ? '' : o.on === 'above' ? `left:${pc(ET)}%;right:0` : `left:0;width:${pc(ET)}%`;
      return `<div class="rec-line ghost" aria-hidden="true"><span class="rl-track">${ET != null ? `<span class="rl-zone" style="${ez}"></span><span class="rl-th" style="left:${pc(ET)}%"><em>예시 ${ET}</em></span>` : ''}${eps.map(([k, v]) => `<span class="rl-pt" style="left:${pc(v)}%"><i></i><em>${esc(recLabel(m, k))} ${v}</em></span>`).join('')}</span><span class="rl-ends"><span>${min}</span><span>${max}</span></span></div>${o.empty ? `<p class="fine rl-empty">${esc(o.empty)}</p>` : ''}`;
    }
    return `<div class="rec-line" aria-hidden="true"><span class="rl-track">${T != null ? `<span class="rl-zone" style="${zone}"></span><span class="rl-th" style="left:${pc(T)}%"><em>${esc(recLabel(m, o.threshold))} ${T}</em></span>` : ''}${pts.map(([k, v]) => `<span class="rl-pt" style="left:${pc(v)}%"><i></i><em>${esc(recLabel(m, k))} ${v}</em></span>`).join('')}</span><span class="rl-ends"><span>${min}</span><span>${max}</span></span></div>
      ${T != null ? `<p class="fine rl-say">${esc(o.on === 'above' ? `${recLabel(m, o.threshold)} ${T}보다 크면 켜져요.` : `${recLabel(m, o.threshold)} ${T}보다 작으면 켜져요.`)}${pts.length ? ' ' + pts.map(([k, v]) => `${recLabel(m, k)}(${v}) → ${(o.on === 'above' ? v > T : v < T) ? '켜짐' : '꺼짐'}`).join(', ') : ''}</p>` : ''}`;
  }
  /** [목표대로 됐어요] 전에 채울 기록 조건. 맞으면 '' / 아니면 학생 문장. 규칙 = { record|rec, gt?, lt?, between?, msg? } (객체 형식은 칸 모두 + check) */
  function recordPassMsg(m) {
    const sp = recSpec(m); if (!sp || sp.at === 'code') return '';
    for (const r of sp.pass) {
      const v = recN(m, r.record), raw = recOf(m.id)[r.record];
      if (!recFilled(raw)) return (r.between || r.gt || r.lt || r.range ? '' : r.msg) || `측정 기록표의 "${recLabel(m, r.record)}" 칸을 먼저 채워요.`;
      if (!window.PBGrade.recordOk(r, Object.fromEntries(sp.fields.map((x) => [x.key, recOf(m.id)[x.key]])))) {
        if (r.msg) return r.msg;
        // ★range(수 상수 범위, 7~8 페르소나 2회차 #4): 기본 문장. 차시는 msg로 바꾼다(예 '자로 잰 값과 많이 달라요. 다시 재요.')
        if (Array.isArray(r.range) && v != null && (v < Math.min(r.range[0], r.range[1]) || v > Math.max(r.range[0], r.range[1]))) return `${jo(recLabel(m, r.record), '이', '가')} ${Math.min(r.range[0], r.range[1])}~${Math.max(r.range[0], r.range[1])} 사이가 아니에요(지금 ${v}). 다시 재 봐요.`;
        if (r.between) return `${jo(recLabel(m, r.record), '은', '는')} ${jo(recLabel(m, r.between[0]), '과', '와')} ${recLabel(m, r.between[1])} 사이여야 해요(같으면 안 돼요). 지금 ${v}.`;
        if (r.gt) return `${jo(recLabel(m, r.record), '이', '가')} ${recLabel(m, r.gt)}보다 커야 해요. 다시 재 봐요.`;
        if (r.lt) return `${jo(recLabel(m, r.record), '이', '가')} ${recLabel(m, r.lt)}보다 작아야 해요. 다시 재 봐요.`;
        return `"${recLabel(m, r.record)}" 칸을 확인해 봐요.`;
      }
    }
    return '';
  }
  // 결과 카드: 기록한 기준값 vs 코드에 쓴 기준값(compare: { key:'threshold', mission:'light-3' } — 그 미션 통과 코드의 '빛 밝기 비교' 기준값)
  function recordCompareLine(m) {
    const sp = recSpec(m), o = sp && sp.compare; if (!o || !o.key) return '';
    const rec = recN(m, o.key);
    const cp = (state.checkpoints || {})[o.mission || m.id];
    const c = cp && cp.ts && window.PBGrade && window.PBGrade.lightCompares ? window.PBGrade.lightCompares(cp.ts)[0] : null;
    if (rec == null && !c) return '';
    return `기록한 ${recLabel(m, o.key)} ${rec == null ? '없음' : rec} · 코드에 쓴 ${recLabel(m, o.key)} ${c ? c.value : '아직 없음'}${rec != null && c && rec !== c.value ? ' (서로 달라요)' : ''}`;
  }
  const recReq = (sp) => sp.fields.filter((f) => !f.optional);
  const recSumText = (m) => { const sp = recSpec(m), req = recReq(sp); return `${req.filter((r) => recFilled(recOf(m.id)[r.key])).length}/${req.length}칸`; };
  // 칸 하나(숫자·글): 칸 이름 + 입력. 선택 칸(optional:true)은 이름 뒤에 '(선택)'
  function recRowHTML(m, r, rec) {
    const num = (r.type || 'number') === 'number', hid = `rh-${esc(m.id)}-${esc(r.key)}`;
    return `<label class="rec-row${num ? '' : ' txt'}${r.optional ? ' opt' : ''}"><span class="rec-label">${esc(r.label)}</span><input type="${num ? 'number' : 'text'}"${num ? ` inputmode="numeric" step="any"${r.min != null ? ` min="${r.min}"` : ''}${r.max != null ? ` max="${r.max}"` : ''}` : ` maxlength="${r.maxlength || 60}"`} data-rec="${esc(m.id)}" data-key="${esc(r.key)}" value="${esc(rec[r.key] != null && !Array.isArray(rec[r.key]) ? rec[r.key] : '')}" autocomplete="off"${r.hint ? ` aria-describedby="${hid}"` : ''}>${r.hint ? `<small id="${hid}">${esc(r.hint)}</small>` : ''}</label>`;
  }
  // 선택 칸(설계 개정 2 optional): list = 줄마다 { place:'text', value:'number' } 칸 / numbers = 숫자 count칸
  const ITEM_KO = { place: '곳', value: '값', name: '이름', note: '메모', time: '시각' };
  function recOptHTML(m, r, rec) {
    const v = Array.isArray(rec[r.key]) ? rec[r.key] : [];
    const attrs = (extra) => `data-rec="${esc(m.id)}" data-key="${esc(r.key)}" ${extra} autocomplete="off"`;
    let body = '';
    if (r.type === 'list') {
      const item = r.item || { place: 'text', value: 'number' }, keys = Object.keys(item), n = Math.max(1, Math.min(10, r.rows || 4));
      body = `<div class="rec-list" role="group" aria-label="${esc(r.label)}">${Array.from({ length: n }, (_, i) => `<div class="rl-row"><span class="rl-n">${i + 1}</span>${keys.map((k) => { const t = typeof item[k] === 'object' ? item[k] : { type: item[k] }, lb = t.label || ITEM_KO[k] || k, num = t.type === 'number'; return `<input type="${num ? 'number' : 'text'}"${num ? ' inputmode="numeric" step="any"' : ' maxlength="30"'} placeholder="${esc(lb)}" aria-label="${i + 1}번째 ${esc(lb)}" ${attrs(`data-li="${i}" data-sub="${esc(k)}"`)} value="${esc(v[i] && v[i][k] != null ? v[i][k] : '')}">`; }).join('')}</div>`).join('')}</div>`;
    } else if (r.type === 'numbers') {
      const n = Math.max(1, Math.min(12, r.count || 3));
      body = `<div class="rec-nums" role="group" aria-label="${esc(r.label)}">${Array.from({ length: n }, (_, i) => `<input type="number" inputmode="numeric" step="any" aria-label="${esc((r.labels || [])[i] || `${i + 1}번째`)}" placeholder="${esc((r.labels || [])[i] || String(i + 1))}" ${attrs(`data-ni="${i}"`)} value="${esc(v[i] != null ? v[i] : '')}">`).join('')}</div>`;
    } else return recRowHTML(m, Object.assign({ optional: true }, r), rec);
    return `<div class="rec-opt-item"><p class="rec-label">${esc(r.label)}</p>${body}${r.helper ? `<small>${esc(r.helper)}</small>` : ''}</div>`;
  }
  function recordHTML(m) {
    const sp = recSpec(m); if (!sp) return '';
    const rec = recOf(m.id);
    return `<section class="lcard record-card" aria-labelledby="lcRec${esc(m.id)}">
      <div class="lcard-head"><span class="lc-title" role="heading" aria-level="4" id="lcRec${esc(m.id)}">측정 기록표</span><span class="lc-sum" data-rec-sum>${recSumText(m)}</span></div>
      <div class="lcard-body"><p class="fine">${esc(sp.note || '로봇에서 잰 값을 적어요. 모둠 값 하나만 적어요. 이 기기에 저장되고 내 결과 카드에 보여요.')}</p>
        ${sp.fields.map((r) => recRowHTML(m, r, rec)).join('')}
        ${sp.mid ? `<p class="rec-mid" data-rec-mid>${esc(recordMidText(m))}</p>` : ''}
        ${sp.line ? `<div data-rec-line>${recordLineHTML(m)}</div>` : ''}
        <p class="rec-warn" data-rec-warn aria-live="polite"></p>
        ${sp.optional.length ? `<details class="rec-opt"${sp.optional.some((r) => recFilled(rec[r.key])) ? ' open' : ''}><summary>${esc(sp.optTitle || '더 해 보기 (선택)')}</summary>${sp.optional.map((r) => recOptHTML(m, r, rec)).join('')}</details>` : ''}
      </div></section>`;
  }

  // (P7) 정답 원본의 accept(인정하는 다른 풀이)·reject(흔한 오답과 까닭): 항목 = '글' | { text, why?, ts? } — 교사 화면에만(정답 봉투 안)
  const altList = (title, list) => (Array.isArray(list) && list.length ? `<details class="t-alt"><summary>${esc(title)} ${list.length}</summary><ul>${list.map((x) => { const o = typeof x === 'string' ? { text: x } : x || {}; return `<li>${esc(o.text || '')}${o.why ? ` <small>— ${esc(o.why)}</small>` : ''}${o.ts ? `<pre>${esc(o.ts)}</pre>` : ''}</li>`; }).join('')}</ul></details>` : '');
  function teacherBox(m) {
    const a = isTeacher() && window.Auth.answers().missions[m.id];
    if (!a) return '';
    return `<div class="teacher-only answer">
      <b>교사용 정답</b>
      ${a.answerImg ? `<img src="${a.answerImg}" alt="정답 블록 그림">` : ''}
      <pre>${esc(a.answerTs)}</pre>
      ${altList('인정하는 다른 풀이', a.accept)}${altList('흔한 오답과 까닭', a.reject)}
      <div class="mission-actions"><button class="btn small" data-act="t-answer">정답 코드 열기</button><button class="btn small" data-act="t-starter">시작 코드 불러오기</button></div>
    </div>`;
  }

  // 짝 역할(이름 2개 이상): 미션마다 코딩·로봇 담당을 교대. 9차 D4: 3명 이상이면 코딩·로봇·검사 3역할을 돌리고, 4명부터 나머지는 '다음 차례'
  function pairRoles(m) {
    const pn = pairNames(); if (pn.length < 2 || !m) return null;
    const gi = Math.max(0, labs.flatMap((lb) => lb.missions).findIndex((x) => x.id === m.id)), n = pn.length;
    const at = (d) => pn[(gi + d) % n];
    return { coder: at(0), robot: at(1), check: n >= 3 ? at(2) : null, rest: n >= 4 ? Array.from({ length: n - 3 }, (_, i) => at(3 + i)) : [] };
  }
  // 역할 글(C의 L.roles, 없으면 기본 글)
  function roleText() {
    return Object.assign({ check: '검사', checkDo: '할 일 목록을 소리 내어 읽고 예측을 적어요', robotStep1: '할 일 목록을 읽어 주고 [블록 찾기]를 맡아요' }, L.roles || {});
  }
  // "코딩은 A · 로봇은 B · 검사는 C · 다음 차례 D" (미션 역할 줄·성공 띠 공통)
  function rolesLine(r, sep = ' · ') {
    const ck = roleText().check;
    return [`코딩은 <b>${esc(r.coder)}</b>`, `로봇은 <b>${esc(r.robot)}</b>`, r.check ? `${esc(ck)}${josaOf(ck, '은', '는')} <b>${esc(r.check)}</b>` : '', r.rest.length ? `다음 차례 <b>${r.rest.map(esc).join(', ')}</b>` : ''].filter(Boolean).join(sep);
  }

  /* ---------- 9차 B(D2): 로봇에서 실행하는 방법 — 기기별 탭(L.runGuide) ---------- */
  // 기기 감지: WebUSB 없음 + 아이패드·아이폰·안드로이드 → tablet, WebUSB 없음 + 맥 → mac, 그 밖에 WebUSB 없음 → drive, WebUSB 있음 → usb
  function deviceKind() {
    const ua = navigator.userAgent || '';
    const ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    if (supportsUSB()) return 'usb';
    if (ios || /Android/i.test(ua)) return 'tablet';
    if (/Macintosh|Mac OS X/.test(ua)) return 'mac';
    return 'drive';
  }
  const runTabs = () => ((L.runGuide && L.runGuide.tabs) || []).filter((t) => t && t.id);
  // 처음 보일 탭: 지정한 탭 → 기기에 맞는 탭(바로 보내기가 되는 기기에서 실습 1 미션 1을 아직 안 끝냈으면 '처음 한 번: 연결하기')
  function runTabFor(tabId) {
    const tabs = runTabs(); if (!tabs.length) return null;
    const kind = deviceKind();
    const firstM = labs[0] && labs[0].missions[0];
    const want = tabId || (kind === 'usb' ? (firstM && !state.missions[firstM.id] ? 'first' : 'usb') : kind);
    return tabs.find((t) => t.id === want) || tabs.find((t) => t.id === kind) || tabs[0];
  }
  const runStepsHTML = (t, withImg = true) => `<ol class="run-steps">${(t.steps || []).map((s) => `<li>${s}</li>`).join('')}</ol>${withImg && t.img ? `<img class="run-img" src="${esc(t.img)}" alt="${esc(t.alt || '')}" loading="lazy" data-zoom tabindex="0" role="button">` : ''}`;
  function runGuideModal(tabId) {
    const g = L.runGuide, tabs = runTabs(); if (!g || !tabs.length) return;
    let cur = runTabFor(tabId);
    const kind = deviceKind();
    const m = modal(`<h2>${esc(g.title || '로봇에서 실행하는 방법')}</h2>
      <div class="run-tabs" role="tablist" aria-label="기기 고르기">${tabs.map((t) => `<button type="button" role="tab" data-run-tab="${esc(t.id)}" aria-selected="${t === cur}" tabindex="${t === cur ? 0 : -1}">${esc(t.label || t.id)}${t.id === kind ? '<span class="run-mine"> · 이 기기</span>' : ''}</button>`).join('')}</div>
      <div class="run-panel" role="tabpanel"></div>
      ${g.note ? `<p class="fine run-note">${g.note}</p>` : ''}
      <div class="modal-actions"><button class="btn primary" type="button" data-close>닫기</button></div>`);
    m.classList.add('wide', 'run-guide');
    const panel = $('.run-panel', m);
    const show = (t, focus) => {
      cur = t;
      $$('[data-run-tab]', m).forEach((b) => { const on = b.dataset.runTab === t.id; b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1; if (on && focus) b.focus(); });
      panel.innerHTML = runStepsHTML(t); panel.setAttribute('aria-label', t.label || t.id); armZoom(panel);
    };
    $$('[data-run-tab]', m).forEach((b) => b.addEventListener('click', () => show(tabs.find((t) => t.id === b.dataset.runTab))));
    $('.run-tabs', m).addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      e.preventDefault(); e.stopPropagation();
      const i = tabs.indexOf(cur); show(tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length], true);
    });
    show(cur);
    return m;
  }
  // [보내는 방법]·[로봇에서 실행하는 방법] 단추는 어디에 있든(2단계·막혔어요 점검·편집기 위 안내·교사 툴바) 이 한 곳에서 연다
  document.addEventListener('click', (e) => { const b = e.target.closest && e.target.closest('[data-run-guide]'); if (b && session) { e.preventDefault(); runGuideModal(b.dataset.runGuide || undefined); } });
  // 편집기 위 안내(기기별, E3-01: 아이패드에 "크롬·엣지에서 열어요" 같은 틀린 안내를 하지 않는다)
  function usbNoteHTML() {
    const kind = deviceKind(); if (kind === 'usb') return '';
    const btn = runTabs().length ? ` <button class="link-btn" type="button" data-run-guide="${kind}">보내는 방법</button>` : '';
    const t = kind === 'tablet' ? '이 기기(아이패드·태블릿)는 마이크로비트로 바로 보낼 수 없어요. 코드는 여기서 만들고, 보내기는 노트북·크롬북에서 해요.'
      : kind === 'mac' ? '맥 사파리는 바로 보내기가 안 돼요. 다운로드한 파일을 Finder의 MICROBIT 드라이브로 끌어다 놓아요.'
      : '이 브라우저는 바로 보내기가 안 돼요. 다운로드한 파일을 MICROBIT 드라이브로 끌어다 놓아요.';
    return `<div class="usb-note">${t}${btn}</div>`;
  }
  // 학교망 허용 주소(9차 D1): 대시보드와 같은 목록 L.teacherGuide.network.hosts, 없으면 기본 4개
  const netHosts = () => {
    const hs = ((((L.teacherGuide || {}).network || {}).hosts) || []).map((x) => (typeof x === 'string' ? x : x && x.host)).filter(Boolean);
    return hs.length ? hs : ['makecode.microbit.org', 'makecode.com', 'cdn.makecode.com', 'github.com'];
  };
  // 2단계 첫 줄(기기별): 바로 보내기 / 드라이브로 끌어 놓기 / 이 기기에서는 못 보냄
  function sendLineHTML() {
    const kind = deviceKind();
    if (kind === 'tablet') return '이 기기는 바로 못 보내요. <b>[보내는 방법]</b>을 보고 노트북·크롬북에서 보내요.';
    if (kind === 'mac' || kind === 'drive') return `아래 보라색 <b class="dl-full">[다운로드]</b><b class="dl-mini">⬇ 버튼</b>으로 파일을 받아 <b>MICROBIT 드라이브</b>로 끌어다 놓아요.`;
    return '아래 보라색 <b class="dl-full">[다운로드]</b><span class="dl-full">를</span><b class="dl-mini">⬇ 버튼</b><span class="dl-mini">을</span> 눌러 마이크로비트로 보내요.';
  }
  // 실습 1 미션 1의 2단계: '처음 한 번: 연결하기'(기기에 맞는 탭)를 펼친 칸으로. 미션을 끝내면 접힌다
  function firstRunHTML(lab, m, k) {
    if (lab !== labs[0] || k !== 0) return '';
    const t = runTabFor(deviceKind() === 'usb' ? 'first' : deviceKind()); if (!t) return '';
    return `<details class="run-first"${state.missions[m.id] ? '' : ' open'}><summary>${esc(t.label || '처음 한 번: 연결하기')}</summary>${runStepsHTML(t, false)}</details>`; // 그림은 아래 [그림으로 보기]·창에서(세로 그림이 2단계를 길게 늘이지 않게)
  }
  // 1단계 역할 줄 아래: 로봇·검사 담당이 1단계 동안 할 일 한 줄(9차 D4, E2-07)
  function rolesDoHTML(r) {
    const R = roleText();
    return `<p class="roles-do">로봇 담당 ${esc(r.robot)}: ${esc(R.robotStep1)}${r.check ? ` · ${esc(R.check)} 담당 ${esc(r.check)}: ${esc(R.checkDo)}` : ''}</p>`;
  }
  // 실습 화면 스크롤: 동작 줄이기 설정이면 즉시 이동(UI/UX 5차 06 P1-8, 실습 함수 안에서만 씀)
  const labSmooth = () => (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth');
  // 눌렀지만 지금은 할 수 없는 것(잠긴 미션, 코드 확인 전 로봇 확인, 연결 전)에 이유 한 줄을 2.5초 보여 준다(06 P1-6)
  function whyNote(anchor, text) {
    let n = anchor.nextElementSibling;
    if (!n || !n.classList.contains('why')) { n = h('<p class="why"></p>'); anchor.after(n); }
    n.textContent = text; n.classList.remove('fb-new'); void n.offsetWidth; n.classList.add('fb-new');
    clearTimeout(n._t); n._t = setTimeout(() => n.remove(), 2500);
    labSay(text);
  }
  // 화면 낭독기 알림(05 P0-2): 새로 끼워 넣는 요소(이유 한 줄, 성공 띠)는 공통 라이브 영역 announce()로 읽는다.
  // 늘 있는 결과 상자(.feedback role="status")는 내용이 바뀌면 스스로 읽히므로 따로 부르지 않는다(두 번 읽힘 방지)
  const labSay = (t) => { if (t) announce(t); };
  // 미션 펼침(7차: 패널에는 펼친 미션 한 장만 보인다)
  function setOpen(li, on) { if (li) li.classList.toggle('open', !!on); }
  // 체크리스트 한 줄: ✓ 그림 + 숨김 글자 "완료:"/"아직:"(05 P1-7)
  function setCheck(x, on) { x.classList.toggle('ok', !!on); let s = $('.ck', x); if (!s) { s = h('<span class="sr ck"></span>'); x.prepend(s); } s.textContent = on ? '완료: ' : '아직: '; }
  // 힌트 접기/펼치기(03 P1-7)
  function setHintFold(el, fold) { el.classList.toggle('folded', fold); const hd = $('.hint-head', el); if (hd) hd.setAttribute('aria-expanded', String(!fold)); }
  // 패널 안에서만 스크롤(scrollIntoView는 문서까지 밀어 실습 툴바를 화면 밖으로 내보낸다). 패널이 스크롤 칸이 아니면(400% 확대 등) 문서 스크롤
  function panelReveal(el, block = 'nearest', instant = false) {
    if (!el || !el.offsetHeight) return;
    const pane = el.closest('.lab-panel');
    const behavior = instant ? 'auto' : labSmooth();
    if (!pane || pane.scrollHeight <= pane.clientHeight + 1 || !/(auto|scroll)/.test(getComputedStyle(pane).overflowY)) { el.scrollIntoView({ block, behavior }); return; }
    const bar = $('.lab-act', pane); const barH = bar && bar.offsetHeight ? bar.offsetHeight : 0; // 아래 주 버튼 막대에 가리지 않게
    const pr = pane.getBoundingClientRect(), r = el.getBoundingClientRect();
    const bottom = pr.bottom - barH;
    let d = 0;
    if (block === 'start') d = r.top - pr.top - 8;
    else if (r.top < pr.top + 8) d = r.top - pr.top - 8;
    else if (r.bottom > bottom - 8) d = Math.min(r.bottom - bottom + 8, r.top - pr.top - 8);
    if (Math.abs(d) > 1) pane.scrollBy({ top: d, behavior });
  }
  // 결과가 나오면 체크리스트 위부터 결과 아래까지 한 화면에 보이게(03 P0-2). 다 안 들어가면 결과만 보이게
  function revealFeedback(li, fb, cls) {
    const pane = $('#labPanel');
    if (!pane || !pane.offsetHeight || !fb.offsetHeight) { if (fb.offsetHeight) panelReveal(fb); return; }
    const bar = $('.lab-act', pane); const barH = bar && bar.offsetHeight ? bar.offsetHeight : 0;
    const pr = pane.getBoundingClientRect(), fr = fb.getBoundingClientRect(), bottom = pr.bottom - barH;
    const cl = $('.checklist', li); const cr = cl && cls !== 'info' ? cl.getBoundingClientRect() : fr;
    if (fr.bottom - cr.top <= pane.clientHeight - barH - 16) {
      let d = 0;
      if (fr.bottom > bottom - 8) d = fr.bottom - bottom + 8;
      if (cr.top - d < pr.top + 8) d = cr.top - pr.top - 8;
      if (Math.abs(d) > 1) pane.scrollBy({ top: d, behavior: labSmooth() });
    } else if (fr.top < pr.top || fr.bottom > bottom) panelReveal(fb);
  }

  /* 미션 카드(UI/UX 7차 01·02·03·05·08·10): 패널에는 펼친 미션 한 장만 보인다.
   * 순서: 목표 그림+목표 한 문장 → '이번엔' 한 문장 → 짝 역할 한 줄 → 1단계 코드 만들기(할 일·보조 버튼·결과·힌트·블록 찾기)
   *       → 2단계 로봇에서 실행(통과 뒤 펼침: 예측·실행 3줄).
   * 10차(DESIGN.md 10차 5): 1단계는 카드 3장 — 코드 확인(늘 펼침, 저장마다 자동 확인: 체크리스트·결과 글·상태 한 줄) → 블록 찾기(접힘) → 힌트(접힘).
   *   [코드 확인] 버튼은 없다(liveCheck). 2단계 [목표대로 됐어요][로봇이 안 움직여요]는 그대로. 끝난 단계는 한 줄로 접힌다.
   *   .drawer-live: 세로 태블릿 [코딩] 탭 서랍에서만 보이는 상태 한 줄(카드 머리와 같은 말).
   * 화면 속 포니봇(시뮬레이터) 기능은 8차에 뺐다(사용자 지시).
   * [되돌리기]·[선생님 부르기]는 [막혔어요] 창으로 옮겼다(7차 결정 8) */
  /* 코드 확인 카드 아래 늘 보이는 한 줄(페르소나 2회차 #19): 차시 L.textCodeLine: true일 때 L.textCodeNote("JavaScript·Python 탭에서 고쳐도 코드 확인이 돼요").
   * 3~4는 켜지 않음(실습 목표 안의 같은 글은 그대로) */
  const textCodeLineOn = () => L.textCodeLine === true && !!L.textCodeNote;
  function missionHTML(lab, m, k) {
    const st = missionState(lab, k), ms = mstate(lab, k);
    const roles = pairRoles(m), goal = goalOf(m);
    const fe = (L.missionBlocks || {})[m.id] || [];
    const s1 = ms === 'make' ? 'now' : ms === 'locked' ? 'wait' : 'passed';
    const s2 = ms === 'done' ? 'passed' : ms === 'robot' ? 'now' : 'wait';
    return `<li class="mission ${st}" data-m="${k}" data-ms="${ms}">
      <header class="mhead"><span class="num" aria-hidden="true">${ms === 'done' ? ICON.check : ms === 'locked' ? ICON.lock : k + 1}</span><h2 class="name"><span class="sr">미션 ${k + 1}: </span>${esc(m.title)}${m.optional ? ' <small class="opt-tag">선택</small>' : ''}${projOf(lab, m) ? ` <small class="proj-tag">${esc(projOf(lab, m).short || projOf(lab, m).name)}</small>` : ''}</h2></header>
      <div class="mbody">
        ${myThHTML(lab, k)}
        ${m.goalImg ? `<figure class="goal-img"><img src="${esc(m.goalImg.src)}" alt="${esc(m.goalImg.alt || '')}" loading="lazy" data-zoom tabindex="0" role="button"><figcaption><b class="goal-tag">목표</b> ${esc(goal)}${creditHTML(m.goalImg)}</figcaption></figure>` : m.goalVideo ? clipHTML(m.goalVideo, { cls: 'goal-clip', tag: '목표', cap: m.goalVideo.cap ? String(m.goalVideo.cap).replace(/^목표:\s*/, '') : goal, playLabel: '목표 동작 영상 재생' }) : goal ? `<p class="goal-line"><b class="goal-tag">목표</b> ${esc(goal)}</p>` : ''}
        ${m.story ? `<p class="story">${m.story}</p>` : ''}
        ${roles ? `<p class="roles"><span class="sr">${roles.check ? '모둠' : '짝'} 역할: </span>${rolesLine(roles)}</p>${rolesDoHTML(roles)}` : ''}
        <p class="drawer-live" data-drawer-live>${esc(drawerLiveText(ms, liveSumText(lab, k, ms)))}</p>
        ${recSpec(m) && recSpec(m).at === 'code' ? recordHTML(m) : ''}
        <section class="step s1 ${s1}" data-step="1" aria-label="1단계 코드 만들기">
          <h3 class="step-head"><span class="sn" aria-hidden="true">1</span>코드 만들기<em class="step-pass">통과</em><button type="button" class="step-more" aria-expanded="false">다시 보기</button></h3>
          <div class="step-body lcards">
            <section class="lcard check-card${ms === 'make' || ms === 'locked' ? '' : ' pass'}" aria-labelledby="lcCk${k}">
              <div class="lcard-head"><span class="lc-title" role="heading" aria-level="4" id="lcCk${k}">코드 확인</span><span class="lc-sum" data-live-sum>${esc(liveSumText(lab, k, ms))}</span></div>
              <div class="lcard-body">
                <ul class="checklist">${m.checks.map((c, j) => `<li data-j="${j}" class="${ms === 'make' || ms === 'locked' ? '' : 'ok'}"><span class="sr ck">${ms === 'make' || ms === 'locked' ? '아직: ' : '완료: '}</span>${esc(c.label)}</li>`).join('')}</ul>
                <div class="feedback"></div>
              </div>
            </section>
            ${textCodeLineOn() ? `<p class="fine text-code-line">${L.textCodeNote}</p>` : ''}
            ${fe.length ? `<section class="lcard fold finder-card">
              <div class="lc-h" role="heading" aria-level="4"><button type="button" class="lcard-head" data-act="find" aria-expanded="false" aria-controls="lcFd${k}" title="블록 찾기와 힌트는 기록에 영향 없어요"><span class="lc-title">블록 찾기</span><span class="lc-sum" data-find-sum>블록 ${fe.length}개</span><span class="lc-caret" aria-hidden="true"></span></button></div>
              <div class="lcard-body finder" id="lcFd${k}" hidden></div>
            </section>` : ''}
            ${m.hints?.length ? `<section class="lcard fold hint-card">
              <div class="lc-h" role="heading" aria-level="4"><button type="button" class="lcard-head" data-act="hints" aria-expanded="false" aria-controls="lcHt${k}" title="힌트와 블록 찾기는 기록에 영향 없어요"><span class="lc-title">힌트</span><span class="lc-sum" data-hint-sum>힌트 0/${m.hints.length}</span><span class="lc-caret" aria-hidden="true"></span></button></div>
              <div class="lcard-body" id="lcHt${k}" hidden><div class="hints" data-shown="0"></div><p class="hint-more"><button class="btn small" type="button" data-act="hint">다음 힌트</button></p></div>
            </section>` : ''}
            ${starterOn(m) && ms !== 'done' && !isTeacher() ? `<p class="starter-line"><button type="button" class="link-btn" data-starter-open="${k}">이 미션 시작 코드로 시작</button> <small>늦게 시작했거나 기기가 바뀌었을 때 · 시작 코드 번호가 필요해요</small></p>` : ''}
          </div>
        </section>
        <section class="step s2 ${s2}" data-step="2" aria-label="2단계 로봇에서 실행">
          <h3 class="step-head"><span class="sn" aria-hidden="true">2</span>로봇에서 실행<em class="wait-note">코드 확인을 통과하면 열려요</em><em class="step-pass">완료</em><button type="button" class="step-more" aria-expanded="false">다시 보기</button></h3>
          <div class="step-body">
            <div class="robot-intro"></div>
            <label class="predict"><span>${roles ? (roles.check ? `로봇 담당 ${esc(roles.robot)}${josaOf(roles.robot, '이', '가')} 먼저 예측하고, ${esc(roleText().check)} 담당 ${esc(roles.check)}${josaOf(roles.check, '이', '가')} 적어요: 어떻게 움직일까요?` : `로봇 담당 ${esc(roles.robot)}${josaOf(roles.robot, '이', '가')} 먼저 적어요: 어떻게 움직일까요?`) : '어떻게 움직일지 먼저 적어 봐요'}</span><input data-predict="${esc(m.id)}" maxlength="60" placeholder="${esc(m.predictEx || '예) 한 줄로 적어요')}" value="${esc((state.predict || {})[m.id] || '')}"></label>${Array.isArray(m.predictChoices) && m.predictChoices.length ? `<div class="predict-pick" role="group" aria-label="예측 고르기(골라도 되고 직접 적어도 돼요)">${m.predictChoices.map((c) => `<button type="button" class="pick-chip" data-predict-pick="${esc(m.id)}" aria-pressed="${(state.predict || {})[m.id] === c}">${esc(c)}</button>`).join('')}</div>` : ''}
            ${firstRunHTML(lab, m, k)}
            <ol class="robot-steps"><li>${sendLineHTML()}</li><li>${(projOf(lab, m) || {}).runNote || lab.runNote || (L.robot || {}).runLine || ''}</li><li>목표와 같은지 봐요: ${esc(goal)}${m.goalVideo ? ` <button type="button" class="link-btn" data-goal-video="${k}">목표 영상 보기</button>` : ''}</li></ol>
            ${recSpec(m) && recSpec(m).at === 'code' ? '' : recordHTML(m)}
            ${k === 0 ? '<details class="ig-steps"><summary>그림으로 보기</summary><img src="' + CORE + 'assets/img/infographics/ig-09-p.webp" alt="다운로드, 바닥에 놓고 전원 켜기(포니봇 뒤쪽 마이크로비트 아래의 전원 스위치), 버튼 누르기의 3단계와 안전 주의 2가지를 보여 주는 세로 그림" width="900" height="1350" loading="lazy" data-zoom tabindex="0" role="button"></details>' : ''}
            <div class="mission-actions step-acts">${ms === 'done' ? '<button class="btn small robot-ok" type="button" data-act="robot" disabled>✓ 목표대로 됐어요</button>' : '<button class="btn primary small" type="button" data-act="robot">목표대로 됐어요</button>'}<button class="btn ghost small" type="button" data-act="help">로봇이 안 움직여요</button></div>
            ${runTabs().length ? '<p class="run-how"><button class="link-btn" type="button" data-run-guide="">보내는 방법</button></p>' : ''}
          </div>
        </section>
        ${ms === 'done' && k === lastReqK(lab) ? chGoHTML(lab) : ''}
        ${teacherBox(m)}
      </div></li>`;
  }

  // 실습 화면 상태(탭 동안만 유지): 보조 패널 보기, 작업 공간(미션 / 자유 만들기), 진행 점으로 펼친 미션
  const labUI = { view: {}, ws: {}, open: {}, proj: {} };
  // 자유 만들기는 자동 검사나 선생님이 통과시킨 실습에서만 열린다(스스로 통과는 제외 — 그룹 리뷰)
  const passedForCreate = (m) => { const r = state.missions[m.id]; return !!r && !(typeof r === 'object' && r.via === 'self'); };
  const canCreate = (lab) => lab.missions.every(passedForCreate);
  const vibeEnabled = () => (window.PONYBOT_CONFIG || {}).vibe !== false && !!window.VibeHost;
  const AI_ICON = '<svg class="ai-ic" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M11 2.5l1.9 5.1 5.1 1.9-5.1 1.9L11 16.5l-1.9-5.1L4 9.5l5.1-1.9zM18.5 13l1 2.5 2.5 1-2.5 1-1 2.5-1-2.5-2.5-1 2.5-1z"/></svg>';
  // 짝 이름 두 개("민준 서연")면 미션마다 코딩·로봇 담당을 교대
  // 9차 D4(E2-06·H3-11): '학생·동아리·클럽·반장'·'월요일반' 같은 낱말은 사람 이름이 아니다
  const NOT_NAME = /\d|^(방과후|학년|반|번|조|모둠|팀|초|중|고|학생|동아리|클럽|반장|부반장|조장|모둠장|팀장|짝|영재|영재반|영재학급|학급)$|(요일|방과후|영재|동아리|코딩|로봇)반$|.(동아리|클럽)$/;
  const pairNames = () => (session && !isTeacher() ? session.name.split(/\s+/).filter((t) => t && !NOT_NAME.test(t)) : []);
  /* S3-8 두 프로젝트 실습(11~12 조종용·제어용): lab.projects[{ key, name, short, dependencies, runNote }] + mission.project(없으면 첫 프로젝트).
   * 프로젝트마다 MakeCode 프로젝트(저장 키 …:<실습>:<key>)를 따로 두고, 펼친 미션의 프로젝트로 편집기를 바꾼다(syncLabUI → remountEditor).
   * 완료 화면·자유 만들기는 마지막에 고른 프로젝트(툴바 [조종용 | 제어용]). projects가 없는 실습(3~4·5~6)은 예전 그대로 */
  const projOf = (lab, m) => (lab.projects && lab.projects.length ? lab.projects.find((p) => p.key === (m && m.project)) || lab.projects[0] : null);
  const edProj = (lab) => {
    if (!lab.projects || !lab.projects.length) return null;
    const pick = labUI.proj[lab.id] && lab.projects.find((p) => p.key === labUI.proj[lab.id]);
    const last = projOf(lab, lab.missions[lab.missions.length - 1]);
    if (labUI.ws[lab.id] === 'create') return pick || last;
    const k = openK(lab); return k >= 0 ? projOf(lab, lab.missions[k]) : pick || last;
  };
  const projectKeyFor = (lab) => { const pj = edProj(lab); return `${L.id}:${userId()}:${lab.id}${pj ? ':' + pj.key : ''}${labUI.ws[lab.id] === 'create' ? ':create' : ''}`; };

  // 도전 카드(★ 변형 · ★★ 응용): 실습을 다 끝낸 뒤 완료 화면·자유 만들기 안내에서만 보인다(7차 01 P0-4)
  // 9차 D10: ★★★ 심화(lab.star3) 추가, 모든 별 카드에 "어떻게 했나요?" 한 줄(state.starNote['labId:n'], 입력 즉시 저장). [해냈어요]는 그대로 자기 표시
  const STAR_DEFS = [
    { n: 1, key: 'star1', level: '★ 변형', cls: '' }, { n: 2, key: 'bonus', level: '★★ 응용', cls: 'bonus' }, { n: 3, key: 'star3', level: '★★★ 심화', cls: 'star3' },
  ];
  const starDone = (lab, d) => (d.key === 'bonus' ? !!state.bonus[lab.id] : !!(state[d.key] && state[d.key][lab.id]));
  const starCount = (lab) => STAR_DEFS.filter((d) => lab[d.key]).length;
  // ★7~8 페르소나 2회차 #6: 마지막 필수 미션(optional 아님)을 통과하면 미션 칸에 [★ 도전 카드로 가기](도전 카드가 있는 실습만) → 도전 카드를 펼치고 그곳으로
  const lastReqK = (lab) => { for (let i = lab.missions.length - 1; i >= 0; i--) if (!lab.missions[i].optional) return i; return -1; };
  const reqDone = (lab) => lab.missions.every((x) => x.optional || state.missions[x.id]);
  function basicStatusHTML(lab) {
    if (!BASIC_FIRST) return '';
    const base = lab.missions.filter((m) => !m.optional), extra = lab.missions.filter((m) => m.optional);
    const done = base.filter((m) => state.missions[m.id]).length;
    return `<b>${done === base.length ? '✓ 기초 실습 완료' : `기초 실습 ${done}/${base.length}`}</b><p class="fine">${extra.length ? `응용 미션 ${extra.length}개는 선택이에요. 기초를 마치면 아래 [다음]으로 가도 돼요. 더 해 보고 싶으면 응용 미션을 이어서 해요.` : starCount(lab) ? '기초를 함께 익혀요. 먼저 끝났다면 도전 카드에서 더 해 봐요.' : '기초를 함께 익혀요. 마치면 아래 [다음]으로 가요.'}</p>`;
  }
  const chGoHTML = (lab) => (starCount(lab) ? '<p class="ch-go"><button class="btn small ch-go-btn" type="button" data-ch-jump>★ 도전 카드로 가기</button></p>' : '');
  // 학생: 필수 미션은 다 했는데 선택 미션이 남았을 때 도전 카드 칸(완료 화면은 모든 미션을 끝낸 뒤라서)
  const labChHTML = (lab) => (!isTeacher() && starCount(lab) && reqDone(lab) && !lab.missions.every((x) => state.missions[x.id]) ? `<section class="lab-ch">${challengesHTML(lab, false)}</section>` : '');
  // 별 기록: true(스스로 [해냈어요], 3~4 그대로) | { via: 'check'(자동 확인) | 'teacher'(선생님 도장), at } — 설계 개정 2 도전 카드 check
  const starVia = (lab, d) => { const v = d.key === 'bonus' ? state.bonus[lab.id] : (state[d.key] || {})[lab.id]; return v && typeof v === 'object' ? v.via : v ? 'self' : ''; };
  const STAR_VIA = { check: '자동 확인', teacher: '선생님 확인' };
  const starBtnHTML = (lab, d, c) => {
    const done = starDone(lab, d), stars = d.level.split(' ')[0], via = starVia(lab, d);
    if (!c.check) return `<button class="btn small" type="button" data-star="${d.key}" data-stars="${stars}">${done ? `${stars} 해냈어요` : '해냈어요'}</button>`;
    // check가 있는 카드: [확인하고 별 받기] → 지금 코드로 자동 확인, 안 되면 [선생님 확인](도움 번호)
    return done ? `<p class="ch-ok">✓ ${stars} ${esc(STAR_VIA[via] || '해냈어요')}</p>` : `<button class="btn small" type="button" data-star-check="${d.key}" data-stars="${stars}">확인하고 별 받기</button><p class="ch-msg" aria-live="polite"></p>`;
  };
  function challengesHTML(lab, open) {
    const n = starCount(lab); if (!n) return '';
    const ba = isTeacher() && window.Auth.answers().bonus[lab.id];
    const card = (d) => {
      const c = lab[d.key]; if (!c) return '';
      const done = starDone(lab, d), nk = `${lab.id}:${d.n}`;
      return `<article class="challenge ${d.cls} ${done ? 'done' : ''}"${c.check ? ` data-ch="${d.key}"` : ''}><span class="ch-level">${d.level}</span><h4>${esc(c.title)}</h4><p>${c.text}</p>${c.img ? `<details><summary>참고 그림 보기</summary><img src="${esc(c.img)}" alt="${esc(c.alt || '참고 그림')}" loading="lazy" data-zoom tabindex="0" role="button"></details>` : ''}
        ${c.how ? `<details class="ch-how"><summary>어떻게 할까요? (힌트)</summary><p>${c.how}</p></details>` : ''}
        <label class="ch-note"><span>어떻게 했나요?</span><input data-star-note="${esc(nk)}" maxlength="80" autocomplete="off" placeholder="${esc(c.notePh || L.starNotePlaceholder || '예) 내가 바꾼 값과 그 까닭')}" value="${esc((state.starNote || {})[nk] || '')}"></label>
        ${starBtnHTML(lab, d, c)}
        ${d.key === 'bonus' && ba && (ba.img || ba.answerTs) ? `<div class="teacher-only answer"><b>교사용 예시 답</b>${ba.img ? `<img src="${ba.img}" alt="보너스 예시 답">` : ''}${ba.answerTs ? `<pre>${esc(ba.answerTs)}</pre>` : ''}</div>` : ''}</article>`;
    };
    return `<details class="challenges" ${open ? 'open' : ''}><summary class="ch-title">★ 도전 카드 ${n}개</summary><div class="ch-body"><p class="fine">빨리 끝낸 조를 위한 선택 도전이에요. 해내면 별을 받아요.</p>
      ${STAR_DEFS.map(card).join('')}
    </div></details>`;
  }
  // 실습 목표 안 '도전 미리 보기'(실습 전에도, 해답·버튼 없음, 9차 D10)
  function challengePreviewHTML(lab) {
    const defs = STAR_DEFS.filter((d) => lab[d.key]); if (!defs.length) return '';
    return `<details class="ch-preview"><summary>도전 미리 보기 (${defs.length}개)</summary><ul>${defs.map((d) => `<li><span class="ch-level">${d.level}</span> <b>${esc(lab[d.key].title)}</b><span class="ch-pv-text">${lab[d.key].text}</span></li>`).join('')}</ul><p class="fine">미션을 모두 끝내면 도전 카드에서 [해냈어요]를 누를 수 있어요.</p></details>`;
  }
  // 실습 완료 화면(7차 03 P0-5): 완료 요약 → (방금 끝냈으면 축하 카드) → 자유 만들기 → 도전 카드.
  // 10차: [다음: …]은 패널 아래 막대(labPagerHTML) 하나로 — 완료 화면 안의 [다음] 단추는 뺐다(같은 단추 두 개). 도전 카드는 접힌 채
  //   (머리의 [★ 도전 n개 ↓]가 펼침) → 완료 요약·자유 만들기·아래 막대가 한 화면에
  function labDoneHTML(lab) {
    const can = canCreate(lab) || isTeacher();
    const self = lab.missions.filter((m) => !passedForCreate(m)).length;
    const chN = starCount(lab);
    return `<div class="lab-done-head"><span class="num" aria-hidden="true">${ICON.check}</span><div><h2>${esc(labShort(lab))} 완료</h2>${chN ? `<button class="link-btn ch-jump" type="button" data-ch-jump>★ 도전 ${chN}개 ↓</button>` : ''}${lab.goal ? `<p>${esc(lab.goal)}</p>` : ''}</div></div>
      <div class="lab-win-slot"></div>
      ${can ? `<section class="create-card"><h3>자유 만들기</h3><p>내 미션 코드에서 출발해 나만의 동작을 만들어요.${vibeEnabled() ? ' 바이브코딩(AI)과 함께 만들 수 있어요.' : ''} 미션 코드는 그대로 남아요.</p><button class="btn primary" type="button" data-ws="create">자유 만들기 열기</button></section>`
        : `<section class="create-card pending"><h3>자유 만들기</h3><p>스스로 통과한 미션 ${self}개를 선생님이 보면 열려요.</p><button class="btn small" type="button" data-act-global="call-teacher">선생님 부르기</button></section>`}
      ${challengesHTML(lab, false)}`; // 10차: 도전 카드는 접어 두고(머리의 [★ 도전 n개 ↓]로 펼침) 아래 막대 [다음: …]이 한 화면에 보이게
  }  // 자유 만들기 공간의 [안내] 칸
  // 9차 D11: 학생 기본 탭. AI와 만들 때 약속 3가지 · 만들 거리 5개 · 'AI와 만든 기록' 3칸(state.createLog, 입력 즉시 저장) · [내 코드 내려받기]
  const CREATE_LOG_KEYS = ['ask', 'understood', 'changed'];
  function createGuideHTML(lab) {
    const G = L.createGuide || {}, log = state.createLog || {};
    const rules = vibeEnabled() ? (G.rules || []).filter(Boolean) : [], ideas = (G.ideas || []).filter(Boolean);
    const labels = vibeEnabled() && (G.log || []).length ? G.log : null;
    return `<section class="create-guide"><h2>✦ 자유 만들기</h2><p>미션 코드는 그대로 저장돼 있어요. 여기서는 마음껏 바꿔 봐요.</p>${vibeEnabled() ? '<p>[바이브코딩] 탭에 하고 싶은 동작을 쓰면 AI가 블록을 만들어 줘요.</p>' : ''}<p>다 만들면 아래 보라색 [다운로드]로 보내고 로봇에서 실행해 봐요.</p></section>
      ${rules.length ? `<section class="create-box create-rules"><h3>AI와 만들 때 약속 ${rules.length}가지</h3><ol>${rules.map((t) => `<li>${t}</li>`).join('')}</ol></section>` : ''}
      ${ideas.length ? `<section class="create-box create-ideas"><h3>이런 것도 만들 수 있어요</h3><ul>${ideas.map((t) => `<li>${t}</li>`).join('')}</ul></section>` : ''}
      ${labels ? `<section class="create-box create-log"><h3>AI와 만든 기록</h3><p class="fine">이 기기에 저장되고 내 결과 카드에 보여요.</p>${CREATE_LOG_KEYS.map((k, i) => labels[i] ? `<label class="field"><span>${esc(labels[i])}</span><textarea data-create-log="${k}" rows="2" maxlength="200">${esc(log[k] || '')}</textarea></label>` : '').join('')}</section>` : ''}
      <section class="create-box create-save"><h3>내 코드 저장</h3><p class="fine">코드를 글(.ts) 파일로 내려받아요. 다른 기기에서는 MakeCode의 JavaScript 탭에 붙여 넣으면 이어서 만들 수 있어요.</p><button class="btn small" type="button" data-create-dl>내 코드 내려받기</button></section>
      ${challengesHTML(lab, true)}`;
  }

  /* 10차(DESIGN.md 10차 4): 실습 패널 아래 막대 = 이론 페이지 아래 막대(pager)와 같은 모양 [이전] 위치 [다음: …].
   * data-nav 대신 data-lab-nav — 전역 ←/→ 넘기기는 [data-nav]를 찾으므로, 실습에서는 투사 모드가 아니면 화살표로 나가지 않는다(MakeCode가 다시 열리지 않게).
   * 패널 폭(약 400px)에서는 위치 글자를 숨기고(CSS) [다음: …] 글자는 말줄임 */
  function labPagerHTML(idx) {
    const prev = stops[idx - 1], next = stops[idx + 1];
    return `<nav class="pager lab-pager" aria-label="페이지 이동">
      ${prev ? `<a class="btn" href="${prev.hash}" data-lab-nav="prev" aria-label="이전: ${esc(prev.label)}" title="이전: ${esc(prev.label)}">이전</a>` : '<span></span>'}
      <div class="where">${esc(stops[idx].section)}  ${idx + 1} / ${stops.length}</div>
      ${next ? `<a class="btn primary" href="${next.hash}" data-lab-nav="next" title="다음: ${esc(next.label)}"><span class="lp-t">다음: ${esc(next.label)}</span></a>` : '<span></span>'}
    </nav>`;
  }
  // 11~12(S3-7): 가이드 쪽(bt-connect)에 적은 장치 이름을 블루투스 실습 머리에 — 실습과 연결 쪽을 오가며 이름을 다시 찾지 않게(페르소나 2회차)
  function devNameHTML(lab) {
    const deps = [lab.dependencies, ...(lab.projects || []).map((p) => p.dependencies)].filter(Boolean);
    if (!deps.some((d) => 'bluetooth' in d)) return '';
    const g = Object.values(state.guides || {}).find((x) => x && x.deviceName);
    const gi = L.pages.findIndex((p) => p.type === 'guide');
    return `<p class="lab-devname">${g ? `내 장치 이름 <b>${esc(g.deviceName)}</b>` : '장치 이름을 아직 안 적었어요'}${gi >= 0 ? ` · <a href="#/p/${gi}">${g ? '연결 단계 보기' : '연결 쪽에서 적기'}</a>` : ''}</p>`;
  }
  function viewLab(lab, idx) {
    const ws = labUI.ws[lab.id] || 'mission', create = ws === 'create';
    // 바이브코딩 스튜디오(원본 크롬 확장 화면을 웹앱에 탑재): 자유 만들기 공간에서만 연다(교사도, 7차 결정 5).
    // 미션 코드에서는 열지 않는다 — 학생 화면·칠판에서 AI가 미션 해답을 만들어 넣지 않게(사용자 지시)
    const vibeHere = vibeEnabled() && create;
    // 학생 자유 만들기의 기본 탭은 [안내](9차 D11, E2-11). 교사는 지금처럼 바이브코딩
    let view = labUI.view[lab.id] || (vibeHere && isTeacher() ? 'studio' : 'mission');
    if ((view === 'studio' && !vibeHere) || view === 'sim') view = 'mission';
    labUI.view[lab.id] = view;
    const allDone = lab.missions.every((m) => state.missions[m.id]);
    // 넓은 화면 미션 공간에는 탭이 없다(7차 04 안 B). 좁은 화면은 [미션 | 코딩]
    return `<div class="page wide"><div class="lab" data-view="${view}" data-tab="${view}" data-ws="${ws}">
      <div class="help-banner" id="helpBanner" hidden role="status"></div>
      <div class="lab-toolbar" aria-label="실습 도구">
        <button class="panel-handle" type="button" id="panelHandle" aria-controls="labPanel" aria-expanded="true" title="패널 접기"><span aria-hidden="true">‹</span><span class="sr">패널 접기</span></button>
        <div class="lab-seg ${vibeHere ? '' : 'only-narrow'}" role="tablist" aria-label="보조 패널">
          ${vibeHere ? `<button role="tab" type="button" data-view="studio" aria-selected="${view === 'studio'}" title="바이브코딩 스튜디오 (Alt+/)">${AI_ICON}<span>바이브코딩</span></button>` : ''}
          <button role="tab" type="button" data-view="mission" aria-selected="${view === 'mission'}">${create ? '안내' : '미션'}</button>
          <button role="tab" type="button" data-view="code" class="only-narrow" aria-selected="false">코딩</button>
        </div>
        ${lab.projects && lab.projects.length > 1 ? `<div class="proj-seg" role="group" aria-label="MakeCode 프로젝트 바꾸기">${lab.projects.map((p) => `<button type="button" class="btn small" data-proj="${esc(p.key)}" aria-pressed="${!!edProj(lab) && edProj(lab).key === p.key}" title="${esc(p.name || p.short)} 코드">${esc(p.short || p.name)}</button>`).join('')}</div>` : ''}
        <p class="tb-loc" id="tbLoc"></p>
        <span class="tb-act" id="tbAct"></span>
        <span class="tb-status" role="status"><span class="dot" id="mcDot"></span><span id="mcStatus">코딩 화면 여는 중…</span></span>
        ${isTeacher() ? `<button class="btn small" type="button" data-ws="${create ? 'mission' : 'create'}">${create ? '미션으로 돌아가기' : vibeEnabled() ? `${AI_ICON}<span>바이브코딩</span>` : '자유 만들기'}</button><a class="btn ghost small tb-pop" id="mcPop" target="_blank" rel="noopener" title="포니봇 확장과 학생 코드가 없는 새 MakeCode예요">MakeCode 새 탭</a>` : ''}
        ${isTeacher() && runTabs().length ? '<button class="btn small tb-run" type="button" data-run-guide="" title="2단계가 잠겨 있어도 다운로드·연결 방법을 칠판에 보여 줘요">로봇에서 실행하는 방법</button>' : ''}
        <button class="btn small tb-stuck" type="button" data-act-global="stuck">${ICON.help}막혔어요</button>
      </div>
      <div class="lab-main">
        <aside class="lab-panel" id="labPanel">
          <div class="lab-view" data-pane="mission" ${view === 'mission' ? '' : 'hidden'}>
            <div class="lab-head"><h1 class="lab-title">${esc(lab.title)}</h1>${devNameHTML(lab)}</div>
            ${create ? createGuideHTML(lab) : `
            <details class="lab-about"><summary>실습 목표</summary>
              <p class="lab-goal">${esc(lab.goal)}</p>
              ${lab.figure && lab.figure.video ? clipHTML(Object.assign({ credit: lab.figure.credit }, lab.figure.video), { cap: lab.figure.cap || '', desc: lab.figure.alt }) : lab.figure ? `<figure class="figure"><img src="${esc(lab.figure.src)}" alt="${esc(lab.figure.alt || lab.figure.cap || lab.title)}" data-zoom tabindex="0" role="button"><figcaption>${esc(lab.figure.cap || '')}${creditHTML(lab.figure)}</figcaption></figure>` : ''}
              ${idx === stops.findIndex((s) => s.key === labs[0].id) ? '<details class="onb"><summary>블록 코딩이 처음이에요</summary><img src="' + CORE + 'assets/img/gen/onb-makecode.webp" alt="블록 코딩 3단계 그림: 1 왼쪽 서랍을 눌러 블록 꺼내기, 2 오른쪽 블록 묶음에 끌어다 끼우기(따로 떨어진 회색 블록은 안 끼워진 것), 3 아래 보라색 다운로드 버튼으로 마이크로비트에 보내기" width="1600" height="600" loading="lazy"><ol class="onb-steps"><li>왼쪽 <b>서랍</b>을 눌러 블록을 꺼내요.</li><li>오른쪽 블록 묶음에 끌어다 <b>딱 끼워요</b>. 따로 떨어진 회색 블록은 실행되지 않아요.</li><li>아래 보라색 <b>다운로드</b>를 눌러 마이크로비트로 보내요.</li></ol></details>' : ''}
              ${lab === labs[0] && (L.entryTips || []).length ? `<details class="onb entry-tips"><summary>엔트리를 해 봤다면</summary><ul class="onb-steps">${L.entryTips.map((t) => `<li>${t}</li>`).join('')}</ul></details>` : ''}
              ${lab === labs[0] && L.textCodeNote ? `<p class="fine text-code-note">${L.textCodeNote}</p>` : ''}
              ${challengePreviewHTML(lab)}
            </details>
            <nav class="mstep" aria-label="미션 진행"><ol>${lab.missions.map((m, k) => `<li${m.optional ? ' class="opt"' : ''}><button type="button" data-k="${k}"></button>${m.optional ? '<small class="ms-opt" aria-hidden="true">선택</small>' : ''}</li>`).join('')}</ol><span class="mstep-n" id="mstepN"></span></nav>
            ${BASIC_FIRST ? `<section class="lab-about" id="basicStatus" aria-label="기초 실습 진행" aria-live="polite">${basicStatusHTML(lab)}</section>` : ''}
            <p class="lab-note" id="labNote" hidden></p>
            <ol class="missions">${lab.missions.map((m, k) => missionHTML(lab, m, k)).join('')}</ol>
            <section class="lab-done" ${allDone ? '' : 'hidden'}>${allDone ? labDoneHTML(lab) : ''}</section>${labChHTML(lab)}${isTeacher() ? challengesHTML(lab, false) : ''}`}
            <div class="lab-foot">${labPagerHTML(idx)}</div>
          </div>
          ${vibeHere ? `<div class="lab-view vibe-pane" data-pane="studio" ${view === 'studio' ? '' : 'hidden'}><p class="vibe-loading">바이브코딩 스튜디오를 여는 중…</p></div>` : ''}
        </aside>
        <section class="lab-editor">
          ${usbNoteHTML()}
          <div class="frame-wrap"><iframe class="editor-frame" id="mcFrame" title="MakeCode 블록 코딩 편집기" allow="usb; bluetooth; clipboard-read; clipboard-write" allowfullscreen></iframe>
            <div class="editor-overlay" id="mcOverlay" hidden><div class="ov-box"><span></span></div></div>
            <div class="frame-fallback" id="mcFallback" hidden><h3>코딩 화면이 열리지 않아요</h3><p>학교 인터넷에서 MakeCode(makecode.microbit.org)가 막혔을 수 있어요.</p><ol><li>새로 고침을 한 번 해 봐요.</li><li>그래도 안 되면 손을 들어 선생님께 알려요.</li></ol>${isTeacher() ? `<p class="fine">선생님께: 학교 인터넷에서 ${esc(netHosts().join(', '))}이 허용되어야 해요. 연결을 확인하려면 <a id="mcPop2" target="_blank" rel="noopener">MakeCode 새 탭</a>을 열어 봐요(포니봇 확장과 학생 코드는 없어요).</p>` : ''}</div>
          </div>
        </section>
      </div>
    </div></div>`;
  }

  /* 한곳에서 그리기(7차 03 P0-1): 펼친 미션, 진행 점, 지난 미션 안내 줄, 툴바 위치 칸, 툴바 거울 버튼(#tbAct).
   * 주 버튼은 단계 안에 있다(8차): 2단계 [목표대로 됐어요]. 1단계는 버튼 없이 자동 확인(10차). 실습을 다 끝내면 완료 화면의 [자유 만들기 열기], 아래 막대 [다음: …].
   * 툴바 거울(#tbAct)은 미션 카드가 안 보일 때(패널 접힘, 좁은 화면 [코딩] 탭)에만 CSS로 보인다(04 P0-3): 1단계 = 자동 확인 상태 글, 2단계 = [목표대로 됐어요] */
  function syncLabUI() {
    if (!labCtx) return;
    const lab = labCtx.lab, root = $('.lab'); if (!root) return;
    const basicStatus = $('#basicStatus', root); if (basicStatus) basicStatus.innerHTML = basicStatusHTML(lab);
    const ws = labUI.ws[lab.id] || 'mission';
    const loc = $('#tbLoc'), act = $('#tbAct'), note = $('#labNote');
    const short = labShort(lab);
    // S3-8: 펼친 미션의 프로젝트가 편집기와 다르면 그 프로젝트로 다시 연다(처음 열 때는 mountEditor가 정함)
    const pj = edProj(lab);
    if (pj && labCtx.proj !== undefined && labCtx.proj !== pj.key) remountEditor(lab, root);
    $$('[data-proj]', root).forEach((b) => b.setAttribute('aria-pressed', String(!!pj && b.dataset.proj === pj.key)));
    if (ws === 'create') {
      loc.innerHTML = `<b>✦ 자유 만들기</b> · ${esc(short)}`;
      act.className = 'tb-act fixed';
      act.innerHTML = isTeacher() ? '' : '<button class="btn small" type="button" data-ws="mission">미션으로 돌아가기</button>';
      return;
    }
    const n = lab.missions.length, cur = curK(lab), open = openK(lab);
    $$('.mission', root).forEach((li) => setOpen(li, +li.dataset.m === open));
    const done = $('.lab-done', root);
    if (done) { if (open === -1 && !done.innerHTML.trim()) done.innerHTML = labDoneHTML(lab); done.hidden = open !== -1; }
    $$('.mstep button', root).forEach((b) => {
      const k = +b.dataset.k, ms = mstate(lab, k), m = lab.missions[k];
      b.className = `ms-${ms}`;
      b.innerHTML = ms === 'done' ? ICON.check : ms === 'locked' ? ICON.lock : String(k + 1);
      b.setAttribute('aria-label', `미션 ${k + 1}${m.optional ? '(선택)' : ''} ${m.title}, ${ms === 'done' ? '완료' : ms === 'locked' ? '잠김' : '지금'}`);
      if (k === open) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current');
      b.setAttribute('aria-disabled', String(ms === 'locked'));
    });
    const sn = $('#mstepN'); if (sn) sn.textContent = open >= 0 ? `미션 ${open + 1}/${n}` : '모두 완료';
    const ms = open >= 0 ? mstate(lab, open) : null;
    // 진행 점으로 지난 미션을 보는 중이면 위에 한 줄 + [지금 미션으로]
    const past = open >= 0 && ms === 'done' && !isTeacher();
    if (note) {
      note.hidden = !past;
      note.innerHTML = past ? `<span>완료한 미션을 보고 있어요.</span>${cur >= 0 ? `<button class="btn small" type="button" data-bar="cur">지금 미션으로 (미션 ${cur + 1})</button>` : '<button class="btn small" type="button" data-bar="done">완료 화면으로</button>'}` : '';
    }
    let where, mirror = '';
    if (open === -1) where = '모든 미션 완료';
    else if (past) where = `미션 ${open + 1}/${n} · 완료한 미션`;
    else if (ms === 'robot') { where = `미션 ${open + 1}/${n} · 2단계 로봇에서 실행`; mirror = '<button class="btn small" type="button" data-act="robot">목표대로 됐어요</button>'; }
    else { where = `미션 ${open + 1}/${n} · 1단계 코드 만들기`; mirror = `<span class="tb-live">${esc(liveShort(liveSumText(lab, open, ms)))}</span>`; }
    loc.innerHTML = `<b>${esc(short)}</b> › ${where}`;
    act.className = 'tb-act mirror'; act.innerHTML = mirror;
    syncLiveUI();
    if (helpReq) setHelpBanner();
  }  // 진행 점·완료 화면 이동 뒤: 패널 맨 위에서 펼친 미션 제목으로 초점
  function focusMission() {
    if (!labCtx) return;
    const k = openK(labCtx.lab);
    const t = k >= 0 ? $(`.mission[data-m="${k}"] .mhead h2`) : $('.lab-done h2');
    const pane = $('#labPanel'); if (pane) pane.scrollTop = 0;
    if (t) { t.tabIndex = -1; t.focus({ preventScroll: true }); }
  }
  const openLi = () => (labCtx ? $(`.mission[data-m="${openK(labCtx.lab)}"]`) : null);

  function bindLab(root, lab) {
    const labEl = $('.lab', root);
    labCtx = { lab, fails: {}, results: {}, sim: null };
    // 페르소나 2회차(1차시 #12): 좁은 화면(미션 | 코딩 탭)에서만 미션 머리 아래 한 줄 — [코딩] 탭을 눌러야 MakeCode가 보이고, 다운로드·USB는 컴퓨터에서.
    // 넓은 화면 HTML은 그대로(3~4 화면 지문), 그릴 때 화면 폭으로 넣는다
    if (window.matchMedia && window.matchMedia('(max-width: 820px)').matches) { const hd = $('.lab-view[data-pane="mission"] .lab-head', root); if (hd) hd.insertAdjacentHTML('afterend', '<p class="lab-tabhint fine" role="note">코딩 화면은 위 <b>[코딩]</b> 탭을 눌러야 보여요. 다운로드·USB 연결은 컴퓨터(크롬북·노트북)에서 해요.</p>'); }
    // 9차 D16(E3-04): 페이지를 오가도 선생님 확인 상태 줄(실패 n번 · 힌트 n/3 · 빠진 것)이 남게 state.stats에서 되살린다
    lab.missions.forEach((m) => { const s = (state.stats || {})[m.id]; if (!s) return; if (s.fails) labCtx.fails[m.id] = s.fails; if (Array.isArray(s.res)) labCtx.results[m.id] = s.res.slice(); });
    document.body.classList.add('lab-mode');
    const narrow = window.matchMedia('(max-width: 899px)');
    const handle = $('#panelHandle', root);
    function syncHandle() {
      const c = labEl.classList.contains('collapsed'), t = c ? '패널 펴기' : '패널 접기';
      handle.setAttribute('aria-expanded', String(!c)); handle.title = t;
      $('.sr', handle).textContent = t; $('[aria-hidden]', handle).textContent = c ? '›' : '‹';
    }
    // 보조 패널 보기: mission(미션·안내) | sim(화면 속 포니봇: 카드 [화면에서 실행]으로만) | studio(바이브코딩) | code(좁은 화면 탭).
    // 같은 탭을 다시 눌러도 접히지 않는다(7차 04 P0-1). 접기는 패널 경계 손잡이로
    function setView(v) {
      if (labEl.classList.contains('collapsed')) { labEl.classList.remove('collapsed'); syncHandle(); }
      labEl.dataset.view = v; labEl.dataset.tab = v === 'sim' ? 'mission' : v;
      if (v !== 'code') {
        labUI.view[lab.id] = v === 'sim' ? 'mission' : v;
        $$('[data-pane]', root).forEach((p) => { p.hidden = p.dataset.pane !== v; });
      }
      if (v === 'studio') showVibe(); else if (window.VibeHost) window.VibeHost.hide();
      syncSeg();
    }
    function syncSeg() { const t = labEl.dataset.tab; $$('.lab-seg [data-view]', root).forEach((b) => b.setAttribute('aria-selected', String(b.dataset.view === t))); }
    // [바이브코딩] 탭을 누르면 스튜디오 첫 칸으로 초점(스튜디오는 DOM 맨 끝이라 Tab으로는 멀다, 7차 07 P0-1)
    $$('.lab-seg [data-view]', root).forEach((b) => b.addEventListener('click', () => { setView(b.dataset.view); if (b.dataset.view === 'studio' && window.VibeHost && window.VibeHost.focusFirst) window.VibeHost.focusFirst(); }));
    labCtx.setView = setView;
    handle.addEventListener('click', () => { labEl.classList.toggle('collapsed'); syncHandle(); });
    // 화면 회전·폭 변경: 넓은 화면에는 [코딩] 탭이 없고, 좁은 화면에는 '접힘'이 없다(04 P2-4)
    const onMq = (e) => {
      if (!labEl.isConnected) { narrow.removeEventListener('change', onMq); return; }
      if (e.matches && labEl.classList.contains('collapsed')) { labEl.classList.remove('collapsed'); syncHandle(); }
      if (!e.matches && labEl.dataset.view === 'code') setView(labUI.view[lab.id] || 'mission');
    };
    narrow.addEventListener('change', onMq);
    // MakeCode 칸 폭이 992px보다 좁으면 MakeCode가 태블릿 모습(서랍 이름·검색 칸·[다운로드] 글자 없음)이 된다 → 안내 문구를 맞춘다(7차 06 P0-2)
    const fr = $('#mcFrame', root);
    // 편집기가 숨어 폭이 0일 때(세로 태블릿 [미션] 탭)는 판정을 바꾸지 않는다 — 마지막으로 잰 폭을 따른다(9차 E3-03)
    // 처음부터 숨어 있으면(한 번도 재지 못함) 화면 폭으로 짐작한다(좁은 화면 [코딩] 탭의 편집기 ≈ 화면 폭)
    if (fr && window.ResizeObserver) {
      labCtx.ro = new ResizeObserver(() => {
        const w = fr.clientWidth;
        if (w > 0) { labEl.dataset.mcw = String(w); labEl.classList.toggle('mc-compact', w < 992); }
        else if (!labEl.dataset.mcw) labEl.classList.toggle('mc-compact', window.innerWidth - 24 < 992);
      });
      labCtx.ro.observe(fr);
    }

    // 진행 점: 지난 미션 다시 보기, 잠긴 미션은 이유 한 줄
    function stepTo(k) {
      if (mstate(lab, k) === 'locked') { whyNote($('.mstep', root), `미션 ${k} 완료 뒤에 열려요.`); return; }
      labUI.open[lab.id] = isTeacher() || k !== curK(lab) ? k : null;
      syncLabUI(); focusMission();
      liveKick(); // 펼친 미션이 바뀌면 지금 코드로 조용히 한 번(10차)
    }
    // [기록 다시 재기](설계 개정 2): 기록표가 있는 미션을 펼치고, 끝난 단계면 다시 펼쳐 기록표로 간다
    function goRecord(j) {
      if (!(j >= 0 && lab.missions[j])) return;
      stepTo(j);
      const li2 = $(`.mission[data-m="${j}"]`, root), rc = li2 && $('.record-card', li2); if (!rc) return;
      const st = rc.closest('.step');
      if (st && !st.classList.contains('now') && !st.classList.contains('unfold')) { const b = $('.step-more', st); if (b) b.click(); }
      panelReveal(rc, 'start'); rc.classList.remove('flash'); void rc.offsetWidth; rc.classList.add('flash');
      const inp = $('input', rc); if (inp) inp.focus({ preventScroll: true });
      labSay('측정 기록표예요. 다시 재서 고쳐 적어요.');
    }
    // 한곳에서 받는 클릭: 미션 카드 안 버튼, 아래 주 버튼 막대, 툴바, 진행 점, 완료 화면
    root.addEventListener('click', (e) => {
      const t = e.target.closest('button, a'); if (!t || !root.contains(t)) return;
      if (t.dataset.act) {
        const li = t.closest('.mission') || openLi(); if (!li) return;
        // 400ms 안에 같은 버튼을 또 누르면 무시(힌트 두 번 탭 = 힌트 2개 방지, 카드 머리 두 번 탭 = 열렸다 닫힘 방지)
        if (t._t && Date.now() - t._t < 400) return; t._t = Date.now();
        missionAction(li, +li.dataset.m, t.dataset.act); return;
      }
      if (t.dataset.ws) { switchWorkspace(lab, t.dataset.ws); return; }
      if (t.dataset.proj) { // S3-8 [조종용 | 제어용]: 그 프로젝트의 지금(또는 마지막으로 끝낸) 미션을 펼친다
        const key = t.dataset.proj, pj = edProj(lab); if (pj && pj.key === key) return;
        labUI.proj[lab.id] = key;
        if ((labUI.ws[lab.id] || 'mission') === 'create' || openK(lab) < 0) { syncLabUI(); labSay(`${t.textContent} 코드로 바꿨어요.`); return; }
        const ks = lab.missions.map((m, j) => j).filter((j) => (projOf(lab, lab.missions[j]) || {}).key === key);
        const j = ks.find((x) => mstate(lab, x) !== 'locked' && !state.missions[lab.missions[x].id]) ?? [...ks].reverse().find((x) => mstate(lab, x) === 'done');
        if (j == null) { whyNote(t, `${t.textContent} 미션은 앞 미션을 마치면 열려요.`); labUI.proj[lab.id] = pj && pj.key; return; }
        stepTo(j); labSay(`${t.textContent} 코드로 바꿨어요.`); return;
      }
      if (t.dataset.bar === 'cur') { labUI.open[lab.id] = null; syncLabUI(); focusMission(); return; }
      if (t.dataset.bar === 'done') { labUI.open[lab.id] = -1; syncLabUI(); focusMission(); return; }
      if (t.dataset.k != null && t.closest('.mstep')) { stepTo(+t.dataset.k); return; }
      if (t.classList.contains('step-more')) {
        const s = t.closest('.step'), on = !s.classList.contains('unfold');
        s.classList.toggle('unfold', on); t.setAttribute('aria-expanded', String(on)); t.textContent = on ? '접기' : '다시 보기'; return;
      }
      if (t.matches('[data-act-global="stuck"]')) { stuckModal(); return; }
      if (t.matches('[data-act-global="call-teacher"]')) { const k = lab.missions.findIndex((m) => !passedForCreate(m)); const li = $(`.mission[data-m="${k}"]`, root); if (li) missionAction(li, k, 'call'); return; }
      // 도전 [해냈어요](★ star1 · ★★ bonus · ★★★ star3): 자기 표시 토글
      if (t.dataset.star) {
        const key = t.dataset.star; state[key] = state[key] || {}; state[key][lab.id] = !state[key][lab.id]; save();
        const on = !!state[key][lab.id];
        t.textContent = on ? `${t.dataset.stars} 해냈어요` : '해냈어요'; t.closest('.challenge').classList.toggle('done', on); if (on) beep('win'); return;
      }
      // 설계 개정 2: 도전 [확인하고 별 받기](check) · [선생님 확인](도움 번호) · [기록 다시 재기]·내 기준값 배지 · [이 미션 시작 코드로 시작](도움 번호)
      if (t.dataset.starCheck) { starCheck(lab, t); return; }
      if (t.dataset.starTeacher) { const d = STAR_DEFS.find((x) => x.key === t.dataset.starTeacher); teacherPinModal('선생님 확인: 도전', `${d.level} ${lab[d.key].title}`, () => starSet(lab, d, 'teacher', root)); return; }
      if (t.dataset.remeasure != null) { goRecord(+t.dataset.remeasure); return; }
      if (t.dataset.starterOpen != null) { starterOpen(lab, +t.dataset.starterOpen); return; }
      if (t.dataset.predictPick) { // 고르기형 예측(predictChoices): 고른 글을 예측 칸에 넣고 저장
        const id = t.dataset.predictPick, v = t.textContent.trim(), inp = $(`[data-predict="${id}"]`, root);
        if (inp) inp.value = v; state.predict = Object.assign({}, state.predict, { [id]: v }); save();
        $$(`[data-predict-pick="${id}"]`, root).forEach((x) => x.setAttribute('aria-pressed', String(x === t))); return;
      }
      if (t.hasAttribute('data-ch-jump')) { const ch = $$('.challenges', root).find((x) => !x.closest('[hidden]')); if (ch) { ch.open = true; panelReveal(ch, 'start'); const s = $('summary', ch); if (s) s.focus({ preventScroll: true }); } return; }
      if (t.hasAttribute('data-create-dl')) { downloadCreateCode(t); return; }
    });
    $$('[data-predict]', root).forEach((inp) => inp.addEventListener('change', () => { state.predict = Object.assign({}, state.predict, { [inp.dataset.predict]: inp.value.trim() }); save(); }));
    // 입력 즉시 저장: 도전 메모(state.starNote), AI와 만든 기록(state.createLog)
    root.addEventListener('input', (e) => {
      const el = e.target;
      if (el.matches('[data-star-note]')) { state.starNote = Object.assign({}, state.starNote, { [el.dataset.starNote]: el.value.slice(0, 80) }); persist(); }
      else if (el.matches('[data-create-log]')) { state.createLog = Object.assign({}, state.createLog, { [el.dataset.createLog]: el.value, at: Date.now() }); persist(); }
      else if (el.matches('[data-rec]')) onRecordInput(el, root);
    });
    restoreStats(lab, root);

    // Alt+/ 로 스튜디오 열고 닫기 (포커스가 MakeCode 안에 있으면 전달되지 않음 → 보조 수단)
    labCtx.keyHandler = (e) => { if (e.altKey && e.code === 'Slash' && $('.lab-seg [data-view="studio"]', root)) { e.preventDefault(); setView(labEl.dataset.view === 'studio' ? 'mission' : 'studio'); } };
    document.addEventListener('keydown', labCtx.keyHandler);

    mountEditor(lab, root);
    liveStart(); // 10차: 저장마다 자동 코드 확인(MC.mount가 저장 듣기를 비우므로 mount 뒤에)
    restoreHelp(lab);
    syncLabUI(); syncHandle();
    if (labUI.view[lab.id] === 'studio') showVibe();
    maybeSafety();
  }

  function mountEditor(lab, root) {
    const pj = edProj(lab); // S3-8: 두 프로젝트 실습이면 이 편집기의 프로젝트
    const inPj = (m) => !pj || projOf(lab, m) === pj;
    let k = Math.max(0, lab.missions.findIndex((m) => !state.missions[m.id]));
    if (pj && !inPj(lab.missions[k])) { const j = lab.missions.findIndex((m) => inPj(m) && !state.missions[m.id]); k = j >= 0 ? j : -1; }
    const create = labUI.ws[lab.id] === 'create';
    // 자유 만들기 시작 코드: 그 실습(두 프로젝트면 그 프로젝트) 마지막 미션을 통과한 내 코드
    const lastCp = [...lab.missions].reverse().filter(inPj).map((m) => state.checkpoints[m.id]).find(Boolean);
    const starter = create || k < 0 ? (lastCp || EMPTY) : (checkpointFor(lab, k) || EMPTY);
    if (labCtx) labCtx.proj = pj ? pj.key : null;
    if (pj) labUI.proj[lab.id] = pj.key;
    // 20초가 지나도 안 열리면 대체 안내 + 툴바 상태 "코딩 화면이 열리지 않아요"(9차 D1: 같은 말로)
    const fallbackTimer = setTimeout(() => {
      const fb = $('#mcFallback'); if (!fb || window.MC.ready()) return;
      fb.hidden = false; if (labCtx) labCtx.mcFail = true;
      const s = $('#mcStatus'); if (s) { s.textContent = '코딩 화면이 열리지 않아요'; s.title = s.textContent; }
      const lw2 = $('.lab'); if (lw2) lw2.classList.add('mc-fail');
      syncLiveUI(); // 코드 확인 카드 상태 줄: "코딩 화면이 열리지 않았어요. 선생님께 알려요"
    }, 20000);
    window.MC.mount($('#mcFrame', root), {
      projectKey: projectKeyFor(lab),
      name: `${lab.projectName || lab.title}${pj ? ' ' + (pj.short || pj.name) : ''}${create ? ' 자유 만들기' : ''}`, // 학생 실명은 프로젝트·파일 이름에 넣지 않는다
      dependencies: (pj && pj.dependencies) || lab.dependencies || L.dependencies, // 실습 단위 확장 목록(S3-1): 프로젝트(S3-8) → 실습 → 차시 목록, 통째로
      starter,
      onStatus: (txt, live) => {
        const s = $('#mcStatus'); if (!s) return; s.textContent = live ? '준비됨' : txt; s.title = txt; $('#mcDot').classList.toggle('live', !!live);
        // 연결 전: 상태 점 깜빡임(06 P1-3), 코드 확인 카드는 "코딩 화면이 열리면 자동으로 확인해요". 연결되면 상태 칸은 숨긴다(7차 04 P0-5)
        const labEl = $('.lab'); if (labEl) { labEl.classList.toggle('mc-wait', !live); labEl.classList.toggle('mc-live', !!live); labEl.setAttribute('aria-busy', String(!live)); }
        if (live) {
          clearTimeout(fallbackTimer); $('#mcFallback').hidden = true;
          if (labEl) labEl.classList.remove('mc-fail');
          if (labCtx) {
            labCtx.mcFail = false;
            // 교사가 준비 전에 누른 [정답 코드 열기]·[시작 코드 불러오기]는 지금 넣는다(M1-16: 거짓 성공 없이)
            const pd = labCtx.pendingLoad; labCtx.pendingLoad = null;
            if (pd) window.MC.load(pd.code).then((ok) => { if (ok) toast(pd.done); });
            // 10차: 열리자마자 지금 코드로 한 번(조용히) — 저장을 기다리지 않고 체크리스트·상태 줄을 채운다
            syncLiveUI(); liveKick(true);
          }
        }
      },
    });
    const lw = $('.lab', root); if (lw) lw.classList.add('mc-wait');
    // 학생 툴바에는 [새 창]이 없다(02 P1-9). MakeCode가 안 열릴 때 안내(#mcFallback)와 교사 툴바에만
    $$('#mcPop, #mcPop2', root).forEach((a) => { a.href = window.MC.popupUrl(); });
  }

  // S3-8: 편집기를 다른 프로젝트로 다시 열기 — 같은 iframe 주소를 다시 넣어도 새로 열리게 iframe을 바꿔 끼운다
  function remountEditor(lab, root) {
    if (labCtx.unLive) { try { labCtx.unLive(); } catch (e) {} labCtx.unLive = null; }
    const old = $('#mcFrame', root); if (!old) return;
    const fresh = old.cloneNode(false); fresh.removeAttribute('src'); old.replaceWith(fresh);
    if (labCtx.ro) { labCtx.ro.disconnect(); labCtx.ro.observe(fresh); }
    mountEditor(lab, root); liveStart();
  }

  // 공간 바꾸기: 지우는 동작이 아니라서 확인 창 없이 바로(7차 04 P1-4), 바꾼 뒤 초점과 한 줄 낭독(07 P0-2)
  function switchWorkspace(lab, to) {
    if ((labUI.ws[lab.id] || 'mission') === to) return;
    if (to === 'create') {
      if (!canCreate(lab) && !isTeacher()) return toast('자유 만들기 공간은 이 실습 미션을 모두 마치면 열려요.');
      // 학생은 [안내](약속·만들 거리·기록)부터, 교사는 바이브코딩부터(9차 D11)
      labUI.view[lab.id] = vibeEnabled() && isTeacher() ? 'studio' : 'mission';
    } else labUI.view[lab.id] = 'mission';
    labUI.ws[lab.id] = to;
    route();
    const tab = $('.lab-seg [aria-selected="true"]');
    if (to === 'create' && tab && tab.offsetParent !== null) tab.focus(); else focusMission();
    announce(to === 'create' ? '자유 만들기 공간이에요. 미션 코드는 그대로 저장돼 있어요.' : '미션으로 돌아왔어요.');
  }

  function editorOverlay(on, text) { const o = $('#mcOverlay'); if (!o) return; o.hidden = !on; if (text) $('span', o).textContent = text; }

  /* 9차 B(D16): 미션별 기록 state.stats[missionId] = { fails, hints, checks, res } — 선생님 확인 상태 줄·힌트 펼침·힌트 3 잠금에 쓴다
   * 10차(실시간 확인): fails = 맞은 줄이 늘지 않은 실패한 코드 변경 수, checks = 학생이 코드를 바꿔 나온 자동 확인 수(조용한 확인 제외),
   *   stall = 맞은 줄이 늘지 않은 채 연달아 바뀐 수, gate = 할 일은 다 맞았는데 동작 검사(gate)에 걸린 수, best = 지금까지 가장 많이 맞은 줄 수 */
  function bumpStats(id, patch) {
    state.stats = state.stats || {};
    state.stats[id] = Object.assign({ fails: 0, hints: 0, checks: 0 }, state.stats[id], patch);
    persist();
  }
  // 힌트 한 장 그리기(새로 열 때·다시 그릴 때 공통). fold면 머리줄만
  function renderHint(box, m, n, fold) {
    const hint = m.hints[n];
    const el = h(`<div class="hint"><b class="hint-head" role="button" tabindex="0" aria-expanded="true">힌트 ${n + 1} / ${m.hints.length}</b><div class="hint-body">${hint.text}${hint.img ? `<img src="${esc(hint.img)}" alt="${esc(hint.alt || '힌트 그림')}" data-zoom tabindex="0" role="button">${creditHTML(hint)}` : ''}</div></div>`);
    const head = $('.hint-head', el);
    head.addEventListener('click', () => setHintFold(el, !el.classList.contains('folded')));
    head.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setHintFold(el, !el.classList.contains('folded')); } });
    armZoom(el);
    box.append(el); box.dataset.shown = n + 1;
    if (fold) setHintFold(el, true);
    return el;
  }
  // 실습 화면을 다시 그릴 때: 본 힌트는 본 개수만큼 힌트 카드 안에(마지막 것만 펼침, 카드는 접힌 채), 요약 "힌트 n/3"·[다음 힌트] 상태
  // 측정 기록표 입력(S3-6): 바로 저장 → 칸 수·계산 도우미·범위 안내 갱신 → 코드 확인을 조용히 다시(기록 체크·$rec 시나리오가 바뀌므로)
  let recTimer = 0;
  function onRecordInput(el, root) {
    const mid = el.dataset.rec, key = el.dataset.key;
    const m = labs.flatMap((lb) => lb.missions).find((x) => x.id === mid); if (!m || !recSpec(m)) return;
    const r = recFields(m).find((x) => x.key === key) || {};
    const v = String(el.value).slice(0, r.type === 'text' ? (r.maxlength || 60) : 40);
    let val = v;
    // 선택 칸: 목록(data-li·data-sub)·숫자 여러 개(data-ni)는 배열로
    if (el.dataset.li != null) { const arr = (Array.isArray(recOf(mid)[key]) ? recOf(mid)[key] : []).slice(); const i = +el.dataset.li; arr[i] = Object.assign({}, arr[i], { [el.dataset.sub]: v }); for (let j = 0; j < arr.length; j++) if (!arr[j]) arr[j] = {}; val = arr; }
    else if (el.dataset.ni != null) { const arr = (Array.isArray(recOf(mid)[key]) ? recOf(mid)[key] : []).slice(); arr[+el.dataset.ni] = v; for (let j = 0; j < arr.length; j++) if (arr[j] == null) arr[j] = ''; val = arr; }
    state.records = Object.assign({}, state.records, { [mid]: Object.assign({}, recOf(mid), { [key]: val }) });
    persist();
    const card = el.closest('.record-card');
    if (card) {
      const sum = $('[data-rec-sum]', card); if (sum) sum.textContent = recSumText(m);
      const mi = $('[data-rec-mid]', card); if (mi) mi.textContent = recordMidText(m);
      const w = $('[data-rec-warn]', card), n = +v;
      if (w && val === v) w.textContent = recFilled(v) && (r.type || 'number') === 'number' && (!isFinite(n) || (r.min != null && n < r.min) || (r.max != null && n > r.max)) ? `${jo(recShort(r), '은', '는')} ${r.min != null ? r.min : ''}~${r.max != null ? r.max : ''} 사이 숫자로 적어요.` : '';
      const ln = $('[data-rec-line]', card); if (ln) ln.innerHTML = recordLineHTML(m);
    }
    syncMyTh(); // 머리 '내 기준값' 배지
    clearTimeout(recTimer); recTimer = setTimeout(() => { if (labCtx && labCtx.live) liveKick(); }, 300);
  }
  function restoreStats(lab, root) {
    lab.missions.forEach((m, k) => {
      const li = $(`.mission[data-m="${k}"]`, root); const box = li && $('.hints', li); if (!box) return;
      const s = (state.stats || {})[m.id];
      if (s && s.hints && (m.hints || []).length && !state.missions[m.id] && !+box.dataset.shown) {
        const n = Math.min(s.hints, m.hints.length);
        for (let i = 0; i < n; i++) renderHint(box, m, i, i < n - 1);
      }
      syncHintUI(li, m);
    });
  }
  // 힌트 카드 머리 요약 "힌트 n/3"과 카드 안 [다음 힌트](다 봤으면 "힌트 모두 봤어요")
  function syncHintUI(li, m) {
    const box = li && $('.hints', li); if (!box) return;
    const n = +box.dataset.shown || 0, len = (m.hints || []).length;
    const s = $('[data-hint-sum]', li); if (s) s.textContent = `힌트 ${n}/${len}`;
    const hb = $('.hint-card [data-act="hint"]', li);
    if (hb) { const all = n >= len; hb.disabled = all; hb.textContent = all ? '힌트 모두 봤어요' : '다음 힌트'; }
  }
  // 여닫는 카드(블록 찾기·힌트): 머리 전체가 단추(aria-expanded, ▾), 몸은 hidden
  function setCardOpen(card, on) {
    if (!card) return;
    card.classList.toggle('open', !!on);
    const hd = $('.lcard-head', card), body = $(':scope > .lcard-body', card);
    if (hd) hd.setAttribute('aria-expanded', String(!!on));
    if (body) body.hidden = !on;
  }
  // 자유 만들기 [내 코드 내려받기]: MakeCode의 TypeScript를 글 파일로(9차 D11, H3-03)
  async function downloadCreateCode(btn) {
    const code = window.MC.ready() ? await window.MC.getCode() : null;
    if (!code || !code.ts) { whyNote(btn, '코딩 화면이 열린 뒤에 내려받을 수 있어요.'); return; }
    const d = new Date(), ymd = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
    const who = String(isTeacher() ? '선생님' : session.name).replace(/[\\/:*?"<>|]+/g, '').trim().replace(/\s+/g, '_') || '학생';
    const name = `${L.createFilePrefix}${who}-${ymd}.ts`;
    const url = URL.createObjectURL(new Blob([code.ts], { type: 'text/plain;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = name; a.hidden = true; document.body.append(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1500);
    state.createLog = Object.assign({}, state.createLog, { savedAt: Date.now() }); persist();
    toast(`<b>${esc(name)}</b> 파일로 내려받았어요.`, 'ok');
  }

  // 바이브코딩 스튜디오: 원본 크롬 확장 화면(vibe/index.html)을 이 칸 위에 띄운다(js/vibe-host.js).
  // 화면은 body 아래에 한 번만 만들어 두므로 페이지를 옮겨도 접속키·대화가 남는다. 미션 코드에는 넣지 않는다
  function showVibe() {
    const pane = $('[data-pane="studio"]');
    if (!pane || !labCtx || !vibeEnabled()) return;
    const lab = labCtx.lab;
    window.VibeHost.show(pane, {
      projectKey: () => projectKeyFor(lab),
      canWrite: () => (labUI.ws[lab.id] || 'mission') === 'create',
      onBusy: (v) => { const b = $('.lab-seg [data-view="studio"]'); if (b) b.classList.toggle('busy', v); editorOverlay(v, 'AI가 만든 코드를 블록으로 바꾸는 중…'); },
      onApplied: () => { if (window.matchMedia('(max-width: 899px)').matches && labCtx) labCtx.setView('code'); },
      onConversionFailed: () => toast('블록으로 바꾸지 못했어요. MakeCode 창의 [자바스크립트 유지]를 누른 뒤, 바이브코딩의 [오류 자동 수정하기]를 눌러요.', 'warn'),
    });
  }

  // 안전 확인: 입장할 때가 아니라 처음 2단계(로봇에서 실행)가 열릴 때(7차 결정 9). 휴대폰이면 코딩 기기 안내 한 줄(06 P2-1)
  function maybeSafety() {
    if (isTeacher() || state.safety || !labCtx || $('.modal-wrap:not(.out)')) return;
    const k = openK(labCtx.lab);
    if (k >= 0 && mstate(labCtx.lab, k) === 'robot') safetyModal();
  }
  function safetyModal() {
    // 안전 약속(시리즈 기본값 L.robot.safety: 그림 + 한 줄 HTML)
    const R = L.robot || {};
    const m = modal(`<div class="modal-hero">${artImg('pbDrive', 'modal-pb')}<h2>${esc(R.safetyTitle || '')}</h2></div>
      <ul class="safety safety-ic">
        ${(R.safety || []).map((s) => `<li${s.img ? '' : ' class="no-img"'}>${s.img ? `<img src="${esc(s.img)}" alt="" aria-hidden="true">` : ''}<span>${s.html}</span></li>`).join('\n        ')}
      </ul>
      ${window.innerWidth < 600 ? '<p class="fine">블록 만들기는 크롬북이나 태블릿이 편해요. 휴대폰은 미션을 읽고 로봇에서 실행할 때 써요.</p>' : ''}
      <div class="modal-actions"><button class="btn primary" data-ok>알겠어요</button></div>`, { dismiss: false });
    $('[data-ok]', m).addEventListener('click', () => { state.safety = true; save(); closeModal(); announce('안전 약속을 확인했어요. 이제 로봇에서 실행해 봐요.'); });
  }

  // 로봇 점검 목록(막혔어요 창 '로봇이 안 움직여요' 칸에 그린다). 문구는 시리즈 기본값 L.robot.trouble·troubleMore
  function troubleHTML() {
    const R = L.robot || {};
    const drive = runTabs().some((t) => t.id === 'drive') ? ' <button class="link-btn" type="button" data-run-guide="drive">드라이브로 보내는 방법</button>' : '';
    return `<ol class="trouble">
        ${(R.trouble || []).map((t) => `<li>${t}</li>`).join('\n        ')}
      </ol>
      <details class="trouble-more"><summary>그래도 안 되면 (선생님과 함께)</summary>
        <ul>${(R.troubleMore || []).map((t) => `<li>${String(t).replace('{driveGuide}', drive)}</li>`).join('')}</ul></details>
      ${troubleDeviceLine()}`;
  }
  // 점검 목록 끝 한 줄(기기별, E3-01: 아이패드에서 "크롬·엣지에서 열어요"는 틀린 안내)
  function troubleDeviceLine() {
    const kind = deviceKind(), btn = runTabs().length ? ` <button class="link-btn" type="button" data-run-guide="${kind === 'usb' ? 'first' : kind}">보내는 방법</button>` : '';
    if (kind === 'usb') return `<p class="fine">처음 다운로드할 때 "연결" 창이 뜨면 BBC micro:bit을 골라 주세요.${btn}</p>`;
    if (kind === 'tablet') return `<p class="fine">이 기기(아이패드·태블릿)는 바로 보낼 수 없어요. 노트북·크롬북의 크롬·엣지에서 보내요.${btn}</p>`;
    if (kind === 'mac') return `<p class="fine">맥 사파리는 바로 보내기가 안 돼요. 파일을 MICROBIT 드라이브로 끌어다 놓거나, 크롬을 쓰면 바로 보낼 수 있어요.${btn}</p>`;
    return `<p class="fine">이 브라우저는 바로 보내기를 못 해요. 파일을 MICROBIT 드라이브로 끌어다 놓거나 크롬·엣지에서 열어요.${btn}</p>`;
  }

  /* 블록 찾기 (planning/block-finder.md, 그룹 검증 planning/group-verify-round3.md)
   * ① 카드: 블록 그림 + 서랍 이름·색·왼쪽 줄 순서 + 묶음·순번 + 검색어 (MakeCode 상태 변화 없음)
   * ② 학생이 그 블록을 코드에 넣으면(저장될 때마다 확인) 카드에 자동으로 ✓ + "찾았어요!"
   *   (도구상자에 그 블록만 남기던 찾기 모드는 MakeCode 비공식 동작이라 2026-10-18 제거)
   * missionBlocks 항목은 '블록id' 또는 { id, label, check(TS 정규식으로 ✓ 판정), xml(변형 블록 그림), after(꺼낸 뒤 할 일) } */
  // 설계 개정 2: xml·label 안 '{rec.키|기본}'은 학생 측정 기록으로(예: 비교 블록 그림에 내 기준값, 없으면 60)
  const finderEntry = (e) => { const o0 = typeof e === 'string' ? { id: e } : e; const o = o0.xml || o0.label ? Object.assign({}, o0, o0.xml ? { xml: recText(o0.xml) } : {}, o0.label ? { label: recText(o0.label) } : {}) : o0; return Object.assign({ label: o.id, drawer: '' }, (L.blockDict || {})[o.id], o); };
  const blockInfo = (id) => finderEntry(id);
  const baseLabel = (e) => ((L.blockDict || {})[e.id] || {}).label || e.label; // 도구상자에 실제로 보이는 이름
  const josaOf = (w, a, b) => { const c = String(w).trim().slice(-1).charCodeAt(0); return c >= 0xAC00 && c <= 0xD7A3 && (c - 0xAC00) % 28 ? a : b; };
  const chipHTML = (name, color) => `<span class="drawer-chip"><i style="background:${esc(color || '#8A94A6')}"></i>${esc(name)}</span>`;
  const HAT_ROOTS = [...new Set(['pxt-on-start', 'device_forever', 'device_button_event', 'device_gesture_event', 'device_pin_event'].concat(Object.keys(L.blockDict || {}).filter((k) => L.blockDict[k].hat)))];
  const entryUsed = (e) => { if (e.check) { const s = window.MC.peek(); return !!(s && new RegExp(e.check).test(s.ts)); } return window.MC.usedBlockTypes(HAT_ROOTS).has(e.id); };
  const markUsed = (card) => { card.classList.add('used'); const b = $('.fcard-body b', card); if (b && !$('.fcard-ok', card)) b.insertAdjacentHTML('afterend', '<span class="fcard-ok">✓ 코드에 있어요</span>'); };
  // 블록 찾기 카드 머리 요약: "블록 4개 중 2개 찾음"(코딩 화면이 열리기 전에는 "블록 4개") — 저장마다(liveSnap)·카드를 열 때
  function syncFinderSum(li, m) {
    const s = li && m && $('[data-find-sum]', li); if (!s) return;
    const es = ((L.missionBlocks || {})[m.id] || []).map(finderEntry);
    const t = window.MC.ready() && window.MC.peek() ? `블록 ${es.length}개 중 ${es.filter(entryUsed).length}개 찾음` : `블록 ${es.length}개`;
    if (s.textContent !== t) s.textContent = t;
  }
  // 10차: 블록 찾기 = 1단계의 접는 카드. 머리([data-act="find"])를 누르면 열고 닫는다. force로 열기/닫기만
  async function toggleFinder(li, k, force) {
    const box = $('.finder', li); if (!box) return;
    const card = box.closest('.lcard'), btn = $('[data-act="find"]', li);
    const on = force == null ? box.hidden : !!force;
    if (!on) { setCardOpen(card, false); return; }
    if (!box.hidden) return;
    setCardOpen(card, true); if (btn) btn.classList.remove('nudge');
    const m = labCtx.lab.missions[k];
    syncFinderSum(li, m);
    const entries = (L.missionBlocks[m.id] || []).map(finderEntry);
    box._entries = entries;
    // 검색 안내는 묶음 위에 한 번만, 카드에는 검색어 칩 하나만(03 P1-5). 블록 그림 자리는 처음부터 72px 확보(06 P1-3: 그림이 들어올 때 밀림 0)
    box.innerHTML = `<p class="finder-title"><span>이 미션에 필요한 블록 ${entries.length}개</span></p><p class="finder-search">못 찾으면 서랍 목록 맨 위 '검색하기…' 칸에 <kbd>검색어</kbd>를 써요.</p>` + entries.map((e, i) => {
      const used = entryUsed(e); const word = e.search || baseLabel(e);
      return `<article class="fcard ${used ? 'used' : ''}" data-i="${i}" data-block="${esc(e.id)}">
        <div class="fcard-img loading"><span class="fcard-wait">블록 그림 불러오는 중…</span></div>
        <div class="fcard-body"><b>${esc(e.label)}</b>${used ? '<span class="fcard-ok">✓ 코드에 있어요</span>' : ''}
          <p class="fcard-where">${chipHTML(e.drawer)} 서랍${e.group ? ` › ${esc(e.group)}` : ''}</p>
          ${e.far ? '<p class="fcard-far">서랍을 연 뒤 한참 아래로 내려야 보여요. 묶음 이름을 찾아요.</p>' : ''}
          ${e.after ? `<p class="fcard-after">${esc(e.after)}</p>` : ''}
          <p class="fcard-search">검색어 <kbd>${esc(word)}</kbd></p>${e.code ? `<details class="fcard-code"><summary>코드로 보면</summary><code>${esc(e.code)}</code></details>` : ''}</div></article>`; // #20: 차시 blockDict[id].code(블록 하나의 JS 이름, 정답 조합 아님)
    }).join('');
    watchFinder(box);
    labSay(`이 미션에 필요한 블록 ${entries.length}개를 보여 줘요.`);
    // 실제 도구상자 색인으로 서랍 색·왼쪽 줄 순서·묶음 순번 보강, 블록 그림은 차례로
    const idx = await window.MC.toolboxIndex();
    for (const [i, e] of entries.entries()) {
      const card = $(`.fcard[data-i="${i}"]`, box); if (!card) continue;
      const rec = idx && idx[e.id];
      if (rec) {
        // 좁은 화면의 MakeCode 도구상자는 서랍 이름 없이 아이콘만 보이므로 '왼쪽 줄 몇 번째 칸'도 함께 알려 준다
        $('.fcard-where', card).innerHTML = `${rec.advanced ? '<b>고급</b>을 펼친 뒤 ' : ''}${chipHTML(rec.drawer, rec.color)} 서랍${rec.rowPos ? ` <span class="row-pos">(왼쪽 줄 위에서 ${rec.rowPos}번째 칸)</span>` : ''}${rec.group ? ` › ${esc(rec.group)} 묶음의 ${rec.posInGroup}번째` : ` › 위에서 ${rec.posInDrawer}번째`}`;
        // 같은 색 서랍이 둘이면(AI ponybot · ponybot light, E2-08) 위쪽·아래쪽으로 구분
        const twin = rec.rowPos && rec.color && Object.values(idx).find((r) => r.rowPos && r.drawer !== rec.drawer && String(r.color || '').toLowerCase() === String(rec.color).toLowerCase());
        if (twin && !$('.fcard-twin', card)) $('.fcard-where', card).insertAdjacentHTML('afterend', `<p class="fcard-twin">같은 색 서랍이 둘이에요. <b>${twin.rowPos > rec.rowPos ? '위쪽' : '아래쪽'}</b> ${esc(rec.drawer)} 서랍이에요(${esc(twin.drawer)} 아님).</p>`);
      }
      const png = await window.MC.renderBlock(e.id, e.xml ? { xml: e.xml, key: `${e.id}:${e.label}` } : undefined);
      const imgBox = $('.fcard-img', card); if (!imgBox) continue;
      imgBox.classList.remove('loading');
      imgBox.innerHTML = png ? `<img src="${png}" alt="${esc(e.label)} 블록 그림">` : '<span class="fine">코딩 화면이 준비되면 그림이 보여요</span>';
    }
  }
  /* 저장될 때마다 열린 카드의 ✓를 다시 판정(06 P0-1·10 P1-4).
   * 한 번 저장에서 새로 들어온 블록은 모아서 알림 하나로(같은 묶음이면 내용만 바뀜), 카드에도 "✓ 찾았어요" 반짝임.
   * 코드를 통째로 넣은 직후(되돌리기·시작 코드·체크포인트·AI 넣기)에는 ✓만 조용히 바꾸고 알리지 않는다(가짜 축하 방지) */
  function watchFinder(box) {
    if (box._unwatch) box._unwatch();
    const loadAt = () => (window.MC.lastLoadAt && window.MC.lastLoadAt()) || 0;
    box._loadSeen = loadAt();
    box._unwatch = window.MC.onSave(() => {
      if (!box.isConnected) { box._unwatch(); return; }
      // 넣는 중, 넣은 뒤 4초 안, 또는 넣은 뒤 첫 저장(편집기가 늦게 저장해도)이면 조용히
      const la = loadAt();
      const quiet = window.MC.isLocked() || Date.now() - la < 4000 || box._loadSeen !== la;
      box._loadSeen = la;
      const found = [];
      (box._entries || []).forEach((e, i) => {
        const c = $(`.fcard[data-i="${i}"]`, box); if (!c) return;
        if (entryUsed(e)) {
          if (!c.classList.contains('used')) {
            markUsed(c);
            if (!quiet) { found.push(e.label); c.classList.remove('found-pop'); void c.offsetWidth; c.classList.add('found-pop'); }
          }
        } else if (c.classList.contains('used')) { c.classList.remove('used', 'found-pop'); const ok = $('.fcard-ok', c); if (ok) ok.remove(); }
      });
      if (found.length && !box.hidden) { toast(`찾았어요! <b>${found.map(esc).join(', ')}</b> 블록이 코드에 들어갔어요.`, 'ok', { group: 'found' }); beep('led'); }
    });
  }

  /* 막혔어요(UI/UX 7차 05 P0-2): 지금 단계에 맞춘 도움 사다리 하나.
   *   1단계: 다음 할 일 → 블록 찾기 → 힌트 → 짝에게 설명 / 2단계: 로봇 점검 → 증상 고르기(원인을 묻는 질문)
   *   맨 아래: 되돌리기(7차 결정 8), [선생님 부르기](학생만). 정답 대신 질문 */
  // 자주 생기는 순서(버튼 코드인데 버튼을 안 누름이 가장 흔함 — UX 라이팅 5차 P1-6). 화면(OLED) 증상은 화면을 쓰는 실습에서만(7차 08)
  // B형(S3-5): LED·조도 증상(ledOff·dark·bright)은 makecode-grade.js B_SYMPTOMS — LED를 채점하는 실습에서만 보인다(labSymptoms)
  const SYMPTOMS = [['button', '버튼을 눌러도 그대로예요'], ['stops', '출발하자마자 멈춰요'], ['never', '멈추지 않고 계속 가요'], ['turn', '너무 많이 또는 적게 돌아요'], ['dir', '엉뚱한 방향으로 가요'], ...((window.PBGrade && window.PBGrade.B_SYMPTOMS) || []), ['oled', '화면에 아무것도 안 나와요']];
  const MOTOR_SYMS = ['stops', 'never', 'turn', 'dir'], LED_SYMS = ['ledOff'], LIGHT_SYMS = ['dark', 'bright'];
  // 실습에 맞는 증상: lab.symptoms(키 목록)가 있으면 그대로. 없으면 미션 규칙(v2)을 보고 고른다 — 3~4차시(LED 규칙 없음)는 예전 목록 그대로
  function labSymptoms(lab, ws) {
    if (Array.isArray(lab.symptoms)) return SYMPTOMS.filter(([key]) => lab.symptoms.includes(key));
    const v2s = lab.missions.map((x) => window.PB.missionsV2[x.id] || {}), j = JSON.stringify(v2s);
    const ledLab = /"leds"|[^O]LED:/.test(j), lightLab = /lightLevel/.test(j); // OLED: 토큰은 LED가 아님
    const motorLab = !ledLab || v2s.some((v) => v.behavior || /MOVE:|STOP|MOTOR|"motors"/.test(JSON.stringify(v.checks || []) + JSON.stringify(v.scenarios || [])));
    const screenLab = ws === 'create' || v2s.some((v) => v.screen) || ((ledLab || lightLab) && /OLED:|"oled"/.test(j));
    return SYMPTOMS.filter(([key]) => (key !== 'oled' || screenLab) && (!MOTOR_SYMS.includes(key) || motorLab) && (!LED_SYMS.includes(key) || ledLab) && (!LIGHT_SYMS.includes(key) || (ledLab && lightLab)));
  }
  function diagnose(sym, code, m) {
    if ([...LED_SYMS, ...LIGHT_SYMS].includes(sym)) return window.PBGrade.lightSymptom(sym, code.ts || '');
    const PB = window.PB; let ir;
    try { ir = PB.ir.buildIR(code); } catch (e) { return '코드를 읽지 못했어요. 블록이 모두 끼워져 있는지 확인해 봐요.'; }
    const v2 = (m && PB.missionsV2[m.id]) || {}; const scope = (v2.spec && v2.spec.in) || null;
    const script = scope ? ir.scripts.find((s) => s.event === scope) : ir.scripts.find((s) => s.ops && s.ops.length);
    const ops = script ? PB.ir.normalize(script.ops, ir.userFns) : [];
    const toks = ops.map(PB.ir.token);
    const floating = PB.grader.structureReport(ir).find((s) => s.kind === 'floating');
    if (floating && sym !== 'oled') return floating.msg;
    if (sym === 'stops') {
      if (toks.some((t, j) => t.startsWith('MOVE:') && toks[j + 1] === 'STOP')) return '이동 블록 바로 다음에 정지 블록이 있어요. 포니봇이 달릴 시간은 어떤 블록이 만들어 줄까요?';
      // 일시중지가 아예 없으면 '짧지 않나요?'가 아니라 '없어요'(7차 05: 엉뚱한 진단)
      if (!toks.includes('WAIT')) return '일시중지 블록이 보이지 않아요. 포니봇이 달릴 시간은 일시중지가 만들어요. 1000ms가 1초예요.';
      return '일시중지 시간이 너무 짧지 않나요? 1000ms가 1초예요.';
    }
    if (sym === 'never') return toks[toks.length - 1] === 'STOP' ? '맨 아래에 정지 블록이 있어요. 다른 버튼이나 무한반복 안에 이동 블록이 또 있나요?' : '맨 아래에 포니봇에게 "멈춰"라고 알려 주는 블록이 있나요?';
    if (sym === 'dir') { const d = [...new Set(toks.filter((t) => t.startsWith('MOVE:')).map((t) => t.slice(5)))]; return d.length ? `지금 코드에 있는 방향: ${d.join(' ')}. 화살표를 하나씩 손가락으로 따라가 봐요.${d.some((x) => x === '↶' || x === '↷') ? ' ↶는 제자리 좌회전, ↷는 제자리 우회전이에요.' : ''}` : '이동 블록의 방향 칸을 확인해 봐요.'; }
    if (sym === 'turn') { const i = toks.findIndex((t) => t === 'MOVE:↷' || t === 'MOVE:↶'); const w = i >= 0 && ops[i + 1] && ops[i + 1].k === 'wait' ? ops[i + 1].ms : null; return w != null ? `회전 뒤 일시중지가 ${w}ms예요. 시간이 길수록 더 많이 돌아요. 조금씩 바꿔 가며 로봇에서 실행해 비교해 봐요.` : '회전 블록 다음에 돌 시간을 정하는 일시중지가 있나요?'; }
    if (sym === 'button') {
      // 맨 위 블록 이름은 한국어로('start' 같은 내부 이름이 보이지 않게)
      const EV = { start: '시작하면', forever: '무한반복', A: 'A 버튼 누를 때', B: 'B 버튼 누를 때', AB: 'A+B 버튼 누를 때' };
      if (scope && !script) return `'${EV[scope] || '버튼 누를 때'}' 블록이 코딩 화면에 있나요?`;
      if (script && !script.ops.length) return `'${EV[scope] || '버튼 누를 때'}' 블록 안이 비어 있어요.`;
      if (scope === 'start') return '시작하면 코드는 버튼을 누르지 않아도 전원을 켜면 바로 움직여요. 다시 보려면 마이크로비트 뒷면 리셋 버튼을 눌러요.';
      return scope === 'A' || scope === 'B' ? `다운로드한 뒤 마이크로비트의 ${scope} 버튼을 눌렀나요? 포니봇 전원 스위치도 확인해 봐요.` : '다운로드한 뒤 코드에 쓴 버튼을 눌렀나요? 포니봇 전원 스위치도 확인해 봐요.';
    }
    if (sym === 'oled') {
      const all = ir.scripts.flatMap((s) => (PB.ir.deepOps || PB.ir.normalize)(s.ops, ir.userFns).map(PB.ir.token)); // 만약·반복 안의 출력 블록도(S3-5)
      if (!all.some((t) => t.startsWith('OLED:'))) return '화면에 출력하는 블록이 있나요? AI ponybot 서랍의 "디스플레이 제어" 제목 아래에 있어요.';
      if (/[가-힣]/.test((code.ts.match(/"[^"]*"/g) || []).join(''))) return 'OLED는 한글을 보여 주지 못해요. 영어와 숫자로 바꿔 봐요.';
      return '색상 칸이 1(흰색)인가요? 0이면 검은색이라 보이지 않아요.';
    }
    return '';
  }
  function stuckModal(opt = {}) {
    if (!labCtx) return;
    const lab = labCtx.lab, ws = labUI.ws[lab.id] || 'mission';
    const k = ws === 'create' ? -1 : openK(lab);
    const li = k >= 0 ? $(`.mission[data-m="${k}"]`) : null, m = k >= 0 ? lab.missions[k] : null;
    const ms = m ? mstate(lab, k) : null;
    const roles = m ? pairRoles(m) : null;
    const row = (key, text, btn) => `<li><span>${text}</span><button class="btn small" type="button" data-lad="${key}">${btn}</button></li>`;
    const rows = [];
    if (ms === 'make') {
      const res = labCtx.results[m.id];
      const miss = m.checks.find((c, j) => (res ? !res[j] : !($(`.checklist li[data-j="${j}"]`, li) || {}).classList?.contains('ok')));
      if (miss) rows.push(`<li class="lad-next"><span>다음 할 일: <b>${esc(miss.label)}</b>${miss.nudge ? `<small>${miss.nudge}</small>` : ''}</span></li>`);
      if ((L.missionBlocks || {})[m.id]) rows.push(row('find', '블록이 어디 있는지 모르겠어요', '블록 찾기'));
      const shown = +$('.hints', li).dataset.shown || 0;
      if (m.hints && shown < m.hints.length) rows.push(row('hint', '무엇을 넣을지 모르겠어요', `힌트 ${shown + 1}/${m.hints.length}`));
    } else {
      rows.push(row('nomove', '로봇이 안 움직여요', '하나씩 점검'));
      rows.push(row('odd', '로봇이 이상하게 움직여요', '증상 고르기'));
      // 9차 D2: 보내는 방법(기기에 맞는 탭부터)
      if (runTabs().length) rows.push('<li><span>로봇으로 보내는 방법을 모르겠어요</span><button class="btn small" type="button" data-run-guide="">보내는 방법</button></li>');
    }
    if (roles) rows.push(`<li><span>로봇 담당 <b>${esc(roles.robot)}</b>에게 내 코드를 설명해 봐요. 말하다 보면 찾을 때가 많아요.</span></li>`);
    if (li && !isTeacher() && ms !== 'done') rows.push(row('restore', k === 0 ? '처음부터 다시 할래요' : `미션 ${k} 코드로 되돌릴래요`, '되돌리기'));
    const where = m ? `미션 ${k + 1} · ${ms === 'make' ? '1단계 코드 만들기' : ms === 'robot' ? '2단계 로봇에서 실행' : '완료한 미션'}` : ws === 'create' ? '자유 만들기' : '어떤 상황인가요?';
    // 교사 화면에는 [선생님 부르기]가 없다(칠판에 "선생님을 기다려 주세요" 띠가 뜨지 않게, 7차 09 P0-3)
    const mm = modal(`<div class="modal-hero">${artImg('pbFixPath', 'modal-scene')}<div><h2>막혔어요</h2><p>${esc(where)} · 위에서부터 해 봐요.</p></div></div>
      <ol class="ladder">${rows.join('')}</ol>
      <div class="stuck-body" aria-live="polite"></div>
      <div class="modal-actions">${isTeacher() ? '' : '<button class="btn" type="button" data-lad="call">선생님 부르기</button>'}<button class="btn ghost" type="button" data-close>닫기</button></div>`);
    const body = $('.stuck-body', mm);
    const go = (fn) => { closeModal(); fn(); };
    const showOdd = () => {
      const syms = labSymptoms(lab, ws);
      body.innerHTML = `<p class="fine">가장 비슷한 것을 골라요.</p><div class="stuck-syms">${syms.map(([key, t]) => `<button class="btn small" type="button" data-sym="${key}">${t}</button>`).join('')}</div><div class="stuck-answer"></div>`;
      $$('[data-sym]', body).forEach((b) => b.addEventListener('click', async () => {
        const ans = $('.stuck-answer', body); ans.textContent = '코드를 살펴보는 중…';
        const code = await window.MC.getCode();
        const q = code ? diagnose(b.dataset.sym, code, m) : '코딩 화면을 불러오는 중이에요. 몇 초 뒤 다시 골라 주세요.';
        ans.innerHTML = `<div class="callout"><b>생각해 봐요</b> ${esc(q)}</div>`;
      }));
    };
    $$('[data-lad]', mm).forEach((b) => b.addEventListener('click', () => {
      const a = b.dataset.lad;
      if (a === 'find') go(() => { const box = $('.finder', li); if (box && !box.hidden) panelReveal(box); else missionAction(li, k, 'find').then(() => panelReveal($('.finder', li))); });
      else if (a === 'hint') go(() => missionAction(li, k, a));
      else if (a === 'nomove') body.innerHTML = troubleHTML();
      else if (a === 'odd') showOdd();
      else if (a === 'call') go(() => missionAction(li, k, 'call'));
      else if (a === 'restore') {
        const cp = checkpointFor(lab, k);
        if (!cp) { body.innerHTML = `<div class="callout">미션 ${k}까지 통과한 내 코드가 이 기기에 없어요. 선생님을 불러 주세요.</div>`; return; }
        // 브라우저 확인 창 대신 창 안에서 한 번 더 묻는다(7차 03 P1-8)
        body.innerHTML = `<div class="callout"><b>지금 코드를 지울까요?</b> ${k === 0 ? '빈 화면에서 다시 시작해요.' : `미션 ${k}까지 통과한 내 코드로 돌아가요.`} 블록 하나만 취소하려면 코딩 화면 오른쪽 아래 되돌리기 화살표를 써요.</div><p class="stuck-next"><button class="btn small" type="button" data-restore-ok>되돌리기</button><button class="btn ghost small" type="button" data-restore-no>그만두기</button></p>`;
        $('[data-restore-ok]', body).addEventListener('click', () => go(() => { window.MC.load(cp); toast('코드를 되돌렸어요. 코딩 화면을 확인해 보세요.'); }));
        $('[data-restore-no]', body).addEventListener('click', () => { body.innerHTML = ''; });
        const ok = $('[data-restore-ok]', body); if (ok) ok.focus();
      }
    }));
    if (opt.open === 'nomove') body.innerHTML = troubleHTML();
  }

  /* 선생님 부르기: 주황 띠로 멀리서도 보이게 → 선생님이 오면 비밀번호 입력.
   * 요청은 탭 동안 남는다(7차 05 P0-3): 다른 쪽에 다녀와도 상단 바는 주황, 실습으로 돌아오면 띠가 다시 보인다 */
  function setHelp(req) {
    helpReq = req;
    if (req && labCtx) sess.set(K.help, { lab: labCtx.lab.id, k: req.k }); else sess.del(K.help);
    setHelpBanner();
  }
  function restoreHelp(lab) {
    const r = !isTeacher() && sess.get(K.help);
    if (!r || r.lab !== lab.id) return;
    helpReq = { li: r.k >= 0 ? $(`.mission[data-m="${r.k}"]`) : null, k: r.k };
    setHelpBanner();
  }
  function setHelpBanner() {
    const b = $('#helpBanner');
    document.body.classList.toggle('help-req', !!helpReq || (!isTeacher() && !!sess.get(K.help)));
    if (!b) return;
    if (!helpReq) { b.hidden = true; b.innerHTML = ''; return; }
    const m = labCtx && helpReq.k >= 0 ? labCtx.lab.missions[helpReq.k] : null;
    b.hidden = false;
    b.innerHTML = `<b>선생님을 불렀어요</b><span>${m ? `미션 ${helpReq.k + 1}. ${esc(m.title)}` : '자유 만들기'} · 손 들고 기다려요.</span>
      <button class="btn small" type="button" data-help-open>선생님용</button><button class="btn ghost small" type="button" data-help-cancel>부르기 취소</button>`;
    $('[data-help-open]', b).addEventListener('click', () => {
      if (helpReq.k >= 0) { assistModal(helpReq.li || $(`.mission[data-m="${helpReq.k}"]`), helpReq.k); return; }
      // 자유 만들기: 통과할 미션이 없으니 비밀번호 없이 "도움 끝" 확인 한 줄(9차 D11, H3-10 — 지금 동작을 글로 보이게)
      ask({ title: '선생님 확인 · 자유 만들기', body: '자유 만들기 도움 요청이에요. 도움이 끝났으면 [도움 끝]을 눌러 요청을 꺼요.', ok: '도움 끝', cancel: '요청 유지' })
        .then((yes) => { if (yes) { setHelp(null); announce('도움 요청을 껐어요.'); } });
    });
    $('[data-help-cancel]', b).addEventListener('click', () => setHelp(null));
  }

  /* 도움 번호 창(설계 개정 2): 선생님이 도움 번호(또는 교사 비밀번호)를 넣으면 onOk(Auth.assist 결과). 도전 별 도장·미션 시작 코드에 쓴다 */
  // opt.starter(페르소나 2회차 #5): 시작 코드 창 — 시작 코드 번호(Auth.starter)도 받는다. 통과 처리·별 도장 창은 도움 번호·교사 비밀번호만
  function teacherPinModal(title, line, onOk, opt = {}) {
    const fieldLabel = opt.starter ? '시작 코드 번호 또는 도움 번호' : '도움 번호 또는 교사 비밀번호';
    const m1 = modal(`<div class="modal-hero">${artImg('listen', 'modal-mascot')}<h2>${esc(title)}</h2></div><p class="assist-lead">아래 칸은 <b>선생님이</b> 입력하거나, 선생님이 알려 준 ${opt.starter ? '시작 코드 번호' : '도움 번호'}를 적어요.</p>
      <p class="fine">${esc(line)}</p>
      <form id="tpinForm" autocomplete="off"><label class="field">${fieldLabel}<input id="tpin" type="password" autocomplete="off" data-lpignore="true" required></label>
      <p class="gate-error" id="tpinErr" role="alert"></p>
      <div class="modal-actions"><button class="btn primary" type="submit">확인</button><button class="btn ghost" type="button" data-close>취소</button></div></form>`, { dismiss: false });
    $('#tpinForm', m1).addEventListener('submit', async (e) => {
      e.preventDefault();
      const errEl = $('#tpinErr', m1), left = lockLeft();
      if (left) { errEl.textContent = `여러 번 틀렸어요. ${left}초 뒤에 다시 시도해 주세요.`; return; }
      const pin = takePin($('#tpin', m1)), btn = $('button[type=submit]', m1); btn.disabled = true; btn.textContent = '확인 중…';
      let ar = null;
      try { ar = await (opt.starter && window.Auth.starter ? window.Auth.starter(pin) : window.Auth.assist(pin)); pinOk(); } catch (ex) { btn.disabled = false; btn.textContent = '확인'; errEl.textContent = pinErrMsg(ex); beep('no'); $('#tpin', m1).focus(); return; }
      closeModal(); onOk(ar);
    });
  }
  // 도전 [확인하고 별 받기]: 지금 코딩 화면의 코드로 check(규칙·시나리오)를 돌린다(PB.grader.checkCard). 안 되면 까닭 + [선생님 확인]
  async function starCheck(lab, t) {
    const key = t.dataset.starCheck, d = STAR_DEFS.find((x) => x.key === key), c = lab[key], art = t.closest('.challenge'), msg = art && $('.ch-msg', art);
    if (!d || !c || !msg) return;
    const teacherBtn = `<button type="button" class="link-btn" data-star-teacher="${esc(key)}">선생님 확인 받기</button>`;
    if (!window.MC.ready() || !window.PB || !window.PB.grader.checkCard) { msg.innerHTML = `코딩 화면이 열린 뒤 다시 눌러요. 로봇에서 보여 줄 수 있으면 ${teacherBtn}`; return; }
    t.disabled = true;
    let code = null; try { code = await window.MC.getCode(); } catch (e) { code = null; }
    code = code || window.MC.peek(); t.disabled = false;
    let res; try { res = window.PB.grader.checkCard(code && textEditor(code) ? { ts: code.ts || '', blocks: '' } : code || { ts: '', blocks: '' }, c.check, { records: recAll() }); } catch (e) { res = { ok: null, msgs: [] }; }
    if (res.ok === true) { starSet(lab, d, 'check'); return; }
    msg.innerHTML = `${esc(res.ok === false ? (res.msgs[0] || '아직 도전 조건과 달라요.') : '이 코드는 자동 확인이 어려워요.')} ${teacherBtn}`;
    labSay(res.ok === false ? '아직 도전 조건과 달라요.' : '자동 확인이 어려워요. 선생님 확인을 받아요.');
  }
  function starSet(lab, d, via) {
    state[d.key] = Object.assign({}, state[d.key], { [lab.id]: { via, at: Date.now() } }); save(); beep('win');
    const stars = d.level.split(' ')[0];
    $$(`.challenge[data-ch="${d.key}"]`).forEach((art) => {
      art.classList.add('done');
      $$('[data-star-check], .ch-msg', art).forEach((x) => x.remove());
      if (!$('.ch-ok', art)) art.insertAdjacentHTML('beforeend', `<p class="ch-ok">✓ ${stars} ${esc(STAR_VIA[via])}</p>`);
    });
    announce(`${stars} ${STAR_VIA[via]}! 별을 받았어요.`);
  }
  // [이 미션 시작 코드로 시작](설계 개정 2·P9): 학생 기기에서 도움 번호로 정답 원본의 starterTs를 연다(늦은 모둠·기기가 바뀐 모둠)
  const starterOn = (m) => { const a = L.assistStarter; return !!a && (a === true || (Array.isArray(a) && a.includes(m.id))); };
  function starterOpen(lab, k) {
    const m = lab.missions[k]; if (!m) return;
    teacherPinModal('이 미션 시작 코드로 시작', `미션 ${k + 1}. ${m.title}`, async (ar) => {
      const ts = ar && ar.starters && ar.starters[m.id];
      if (!ts) { toast('이 미션에는 시작 코드가 없어요. 선생님께 여쭤봐요.'); return; }
      const yes = await ask({ title: '시작 코드로 바꿀까요?', body: '지금 코딩 화면의 코드는 지워지고, 이 미션 시작 코드가 들어가요.', ok: '시작 코드로 시작', cancel: '취소' });
      if (!yes) return;
      const okLoad = window.MC.ready() ? await window.MC.load({ ts, blocks: '' }) : false;
      toast(okLoad ? '이 미션 시작 코드를 넣었어요. 코딩 화면을 확인해요.' : '코딩 화면이 아직 열리지 않았어요. 열린 뒤 다시 눌러요.', okLoad ? 'ok' : undefined);
    }, { starter: true });
  }
  /* '내 기준값' 배지(설계 개정 2 lab.myThreshold: true | '키' | { key, label }): 기록표 미션 뒤 미션 머리에 "내 기준값 62"(없으면 "아직 없어요 → 미션 N에서 재요") */
  const myThOpt = (lab) => { const o = lab && lab.myThreshold; if (!o) return null; return Object.assign({ key: 'threshold', label: '내 기준값' }, typeof o === 'object' ? o : typeof o === 'string' ? { key: o } : {}); };
  const myThRec = (lab, o) => lab.missions.findIndex((x) => recSpec(x) && recSpec(x).fields.some((f) => f.key === o.key));
  const myThInner = (o, ri) => { const v = recAll()[o.key]; return v != null ? `<b>${esc(o.label)}</b> <span class="my-th-v">${v}</span>` : `<b>${esc(o.label)}</b> 아직 없어요 → <button type="button" class="link-btn" data-remeasure="${ri}">미션 ${ri + 1}에서 재요</button>`; };
  function myThHTML(lab, k) {
    const o = myThOpt(lab); if (!o) return '';
    const ri = myThRec(lab, o); if (ri < 0 || k <= ri) return '';
    return `<p class="my-th" data-my-th>${myThInner(o, ri)}</p>`;
  }
  function syncMyTh() {
    if (!labCtx) return; const lab = labCtx.lab, o = myThOpt(lab); if (!o) return;
    const ri = myThRec(lab, o), html = myThInner(o, ri);
    $$('[data-my-th]').forEach((el) => { if (el.innerHTML !== html) el.innerHTML = html; });
  }

  /* 선생님이 학생 기기에서 그 미션만 도와주기 (학생 세션 유지, 학생 기기에는 정답·시작 코드를 그리지 않음 — 8차)
   * 9차 D6: 칸은 '도움 번호 또는 교사 비밀번호'(Auth.assist — 도움 번호 봉투만 열고 정답 봉투는 열지 않음).
   * 통과 버튼 2개: [로봇까지 확인했어요 → 통과](미션 완료, why 'robot') / [코드만 통과 → 로봇 실행은 학생이](2단계를 엶, why 'code') */
  function assistModal(li, k) {
    const lab = labCtx.lab; const m = lab.missions[k];
    const m1 = modal(`<div class="modal-hero">${artImg('listen', 'modal-mascot')}<h2>선생님 확인</h2></div><p class="assist-lead">아래 칸은 <b>선생님이</b> 입력해요. 학생은 기기를 선생님 쪽으로 돌리고 기다려 주세요.</p>
      <p class="fine">미션 ${k + 1}. ${esc(m.title)}</p>
      <form id="assistForm" autocomplete="off"><label class="field">도움 번호 또는 교사 비밀번호<input id="assistPin" type="password" autocomplete="off" data-lpignore="true" required></label>
      <p class="gate-error" id="assistErr" role="alert"></p>
      <div class="modal-actions"><button class="btn primary" type="submit">확인</button><button class="btn ghost" type="button" data-close>취소</button></div></form>`, { dismiss: false }); // 태블릿에서 비밀번호를 치다 바깥을 스쳐도 닫히지 않게(08 P1-8)
    $('#assistForm', m1).addEventListener('submit', async (e) => {
      e.preventDefault();
      const errEl = $('#assistErr', m1);
      const left = lockLeft();
      if (left) { errEl.textContent = `여러 번 틀렸어요. ${left}초 뒤에 다시 시도해 주세요.`; return; }
      const pin = takePin($('#assistPin', m1));
      const btn = $('button[type=submit]', m1); btn.disabled = true; btn.textContent = '확인 중…';
      // 통과 처리 권한만 확인한다: 도움 번호 봉투(assist.enc.js)를 열고, 그 파일이 없으면 교사 비밀번호로 정답 봉투를 열어 확인만(풀린 내용은 버림)
      let ar = null;
      try { ar = await window.Auth.assist(pin); pinOk(); }
      catch (ex) {
        btn.disabled = false; btn.textContent = '확인';
        errEl.textContent = pinErrMsg(ex); beep('no'); $('#assistPin', m1).focus(); return;
      }
      // 학생 상황 한 줄: 코드 확인 실패 횟수·본 힌트·빠진 체크 이름(정답 내용은 넣지 않음, 08 P1-8)
      const res = (labCtx.results || {})[m.id] || [];
      const miss = res.length ? m.checks.filter((c, j) => !res[j]).map((c) => c.label) : [];
      const hintsBox = $('.hints', li), shown = hintsBox ? +hintsBox.dataset.shown || 0 : 0;
      const info = [
        `맞은 줄이 늘지 않은 수정 ${(labCtx.fails || {})[m.id] || 0}번`, // 10차 L: 자동 확인이라 '실패'는 진전 없는 코드 변경 수
        `힌트 ${shown}/${(m.hints || []).length}개 봄`,
        res.length ? (miss.length ? `빠진 것: ${miss.slice(0, 2).join(', ')}${miss.length > 2 ? ` 외 ${miss.length - 2}개` : ''}` : '할 일 목록은 모두 맞음') : '아직 자동 확인 결과 없음',
        state.codeOk[m.id] === 'self' ? '"스스로 통과"로 표시함' : state.codeOk[m.id] === 'teacher' ? '선생님이 코드를 통과시킴' : '',
        recLine(m) ? `측정 기록: ${recLine(m)}` : '', // S3-6
      ].filter(Boolean).join(' · ');
      // 코드만 통과는 아직 1단계(코드 만들기)일 때만 — 2단계가 이미 열렸으면 로봇 확인 통과 하나
      const codeStep = !state.codeOk[m.id] && !state.missions[m.id];
      const starterOk = starterOn(m) && !state.missions[m.id] && ar && ar.starters && ar.starters[m.id]; // P9: 차시가 켠 경우만(L.assistStarter)
      const m2 = modal(`<div class="modal-hero">${artImg('listen', 'modal-mascot')}<h2>선생님 확인: 미션 ${k + 1}</h2></div><p class="fine">${esc(m.title)}</p>
        <p class="assist-status">${esc(info)}</p>
        <div class="modal-actions assist-pass"><button class="btn primary" type="button" data-pass>로봇까지 확인했어요 → 통과</button>${codeStep ? '<button class="btn" type="button" data-pass-code>코드만 통과 → 로봇 실행은 학생이</button>' : ''}</div>
        <p class="fine">${codeStep ? '로봇 동작을 봤으면 [로봇까지 확인]으로 미션을 끝내요. 코드만 봤으면 [코드만 통과]로 2단계(로봇에서 실행)를 열어 줘요. ' : ''}결과 카드에 '선생님 통과'와 확인한 것이 함께 남아요. 학생 기기에서는 정답·시작 코드를 열지 않아요(학생 화면에 해답 0).</p>
        ${starterOk ? `<div class="assist-starter"><p class="fine">늦게 시작한 모둠은 이 미션의 시작 코드(앞 미션까지 된 코드)로 바로 시작할 수 있어요. 지금 코딩 화면의 코드는 지워져요.</p><button class="btn" type="button" data-starter>이 미션 시작 코드로 시작</button></div>` : ''}
        <div class="modal-actions"><button class="btn ghost" type="button" data-close>요청은 남겨 두고 닫기</button><button class="btn" type="button" data-done>도움 끝 (요청 끄기)</button></div>`, { dismiss: false });
      $('[data-done]', m2).addEventListener('click', () => { closeModal(); setHelp(null); announce('도움 요청을 껐어요.'); });
      // (P9) 이 미션 시작 코드로 시작: 정답 원본의 starterTs(도움 번호 봉투에 들어 있음) → MakeCode에 넣음(페어링 필요 없음 설정은 MC가 붙임)
      const sb = $('[data-starter]', m2);
      if (sb) sb.addEventListener('click', async () => {
        sb.disabled = true;
        const okLoad = window.MC.ready() ? await window.MC.load({ ts: starterOk, blocks: '' }) : false;
        closeModal(); setHelp(null);
        toast(okLoad ? '이 미션 시작 코드를 넣었어요. 코딩 화면을 확인해요.' : '코딩 화면이 아직 열리지 않았어요. 열린 뒤 다시 선생님을 불러 주세요.', okLoad ? 'ok' : undefined);
      });
      // 로봇까지 확인: 미션 완료(via 'teacher', why 'robot')
      $('[data-pass]', m2).addEventListener('click', async () => {
        state.codeOk[m.id] = true; closeModal(); setHelp(null);
        await passMission(li && li.isConnected ? li : $(`.mission[data-m="${k}"]`), k, 'teacher', { why: 'robot' });
        const r = state.missions[m.id];
        if (r && typeof r === 'object' && r.via === 'teacher' && r.why !== 'robot') { r.why = 'robot'; persist(); }
      });
      // 코드만 통과: 코드 확인 통과처럼 2단계를 연다. 학생이 로봇에서 [목표대로 됐어요]를 누르면 '선생님 · 코드 확인'(why 'code')으로 끝난다(passMission)
      const pc = $('[data-pass-code]', m2);
      if (pc) pc.addEventListener('click', () => {
        state.codeOk[m.id] = 'teacher'; save(); closeModal(); setHelp(null);
        const el = li && li.isConnected ? li : $(`.mission[data-m="${k}"]`);
        if (el) unlockRobotStep(el, '<b>선생님이 코드를 확인했어요.</b> 이제 다운로드해서 로봇에서 실행해요. 목표대로 움직이면 [목표대로 됐어요]를 눌러요.');
        announce('선생님이 코드를 통과시켰어요. 2단계, 로봇에서 실행해요.');
      });
    });
  }

  // 채점기는 블록 구조만 본다 → 엔진으로 실제로 돌려 본 동작(방향·회전량·복귀·OLED 화면)이 목표와 다르면 참고 문장으로(sim-evaluation.md P0-3)
  function simBehaviorNotes(code, v2) {
    const out = []; if (!window.PB) return out;
    const moves = /aiPonybot\.(runNormal|runMecanum|runMotor)\(/.test(code.ts || '');
    try {
      const b = v2.behavior;
      if (b) {
        const r = window.PB.grader.behavior(code.ts, b); const p = r.pose; const home = Math.hypot(p.x, p.y);
        if (b.expectStop && r.sim.robot.moving()) out.push('동작이 끝난 뒤에도 바퀴가 계속 돌아요. 마지막에 "모든 모터 정지"가 있나요?');
        if (moves && p.dist < 1) out.push('거의 움직이지 않아요. 일시중지는 ms 단위라 1000ms가 1초예요.');
        else if (b.turnedDeg != null && Math.abs(p.turnedDeg) >= 45 && Math.sign(p.turnedDeg) !== Math.sign(b.turnedDeg)) out.push(`목표와 반대쪽으로 돌아요. 목표는 ${b.turnedDeg < 0 ? '오른쪽(시계 방향)' : '왼쪽(시계 반대 방향)'}으로 도는 길이에요.`);
        else if (b.turnedDeg != null && p.dist >= 1 && Math.abs(Math.abs(p.turnedDeg) - Math.abs(b.turnedDeg)) > 45) out.push(`모두 약 ${Math.abs(p.turnedDeg).toFixed(0)}° 돌아요(목표 약 ${Math.abs(b.turnedDeg)}°). 회전 뒤 일시중지 시간을 살펴봐요.`);
        if (b.returnsHome != null && p.dist >= 1 && home > b.returnsHome + 5) out.push(`출발점에서 약 ${home.toFixed(0)}cm 떨어진 곳에서 끝나요. 목표는 출발점으로 돌아오기예요.`);
      }
      if (v2.screen) {
        const sim = new window.PB.Sim(code.ts); sim.runUntil(1500);
        out.push(...window.PB.grader.oledFeedback(window.PB.grader.oledProbes(sim.oled), v2.screen));
        const n = new Set(sim.state().notices);
        if (n.has('OLED_ROW_RANGE')) out.push('글자 위치의 행은 0~7까지예요. 그 밖이면 화면에 안 나와요.');
        if (n.has('OLED_TEXT_OVERFLOW')) out.push('글자가 오른쪽 끝을 넘어요. 열은 0~120 사이로 넣어요.');
        if (n.has('OLED_NON_ASCII')) out.push('OLED는 한글을 보여 주지 못해요. 영어와 숫자를 써요.');
      }
    } catch (e) {}
    return [...new Set(out)].slice(0, 3);
  }
  async function missionAction(li, k, act) {
    // 선생님 부르기: 교사 화면에는 없다(7차 09 P0-3). 미션 밖(자유 만들기)에서도 부를 수 있다
    if (act === 'call') { if (!isTeacher()) setHelp({ li, k }); return; }
    if (act === 'stuck') return stuckModal();
    if (act === 'help') return stuckModal({ open: 'nomove' });
    if (!li) return;
    const lab = labCtx.lab; const m = lab.missions[k];
    const fb = $('.feedback', li);
    // 안내 글(교사 [정답 코드 열기] 등): 코드 확인 카드의 결과 상자에. 다음 자동 확인 때 결과 글로 바뀐다
    const show = (cls, html) => {
      fb._html = '';
      fb.className = `feedback show ${cls}`; void fb.offsetWidth; fb.classList.add('fb-new');
      fb.innerHTML = html;
      revealFeedback(li, fb, cls);
    };
    const ta = isTeacher() && window.Auth.answers().missions[m.id];
    if (act === 'find') return toggleFinder(li, k);
    if (act === 'hints') { // 힌트 카드 머리: 열고 닫기. 처음 열면 힌트 1
      const card = $('.hint-card', li); if (!card) return;
      if (card.classList.contains('open')) { setCardOpen(card, false); return; }
      setCardOpen(card, true);
      const box = $('.hints', li);
      if (!+box.dataset.shown) return missionAction(li, k, 'hint');
      panelReveal(box.lastElementChild || card);
      return;
    }
    if (act === 'hint') {
      // 다음 힌트(카드 안 [다음 힌트]·막혔어요·결과 상자의 [힌트 n 보기]): 카드를 열고 최신 하나만 펼친다. 앞 힌트는 머리줄만(03 P1-7)
      const box = $('.hints', li); if (!box) return;
      setCardOpen($('.hint-card', li), true);
      const n = +box.dataset.shown;
      if (n >= m.hints.length) { const last = box.lastElementChild; if (last) { setHintFold(last, false); panelReveal(last); } return; }
      // 9차 D16(E2-09) → 10차: 마지막 힌트(3)는 자동 확인 결과가 한 번 이상 나온 뒤(블록을 하나 이상 놓아 본 뒤) 열린다
      // (거의 답이라 시도 없이 열면 '따라 하기'가 됨). stats.checks = 학생이 코드를 바꿔 나온 확인 수. 교사 미리보기는 제외
      const tried = ((state.stats || {})[m.id] || {}).checks > 0;
      if (!isTeacher() && m.hints.length >= 3 && n === m.hints.length - 1 && !tried) {
        whyNote($('.hint-card .hint-more', li) || box, `힌트 ${n + 1}은 블록을 하나 이상 놓아 본 뒤에 열려요.`);
        return;
      }
      $$('.hint', box).forEach((x) => setHintFold(x, true));
      const el = renderHint(box, m, n, false);
      if (!isTeacher()) bumpStats(m.id, { hints: n + 1 });
      syncHintUI(li, m);
      panelReveal(el);
      labSay(`힌트 ${n + 1}을 열었어요.`); // 힌트를 열어도 침묵하던 것(7차 07)
      const fh = $('[data-fb="hint"]', fb); if (fh) { fh.remove(); fb._html = ''; }
      return;
    }
    // 9차 D1(M1-16): 코딩 화면이 준비 전이면 "열었어요"라고 거짓으로 알리지 않고, 열리면 넣는다
    if ((act === 't-answer' || act === 't-starter') && ta) {
      const code = act === 't-answer' ? { ts: ta.answerTs } : (ta.starterTs ? { ts: ta.starterTs } : EMPTY);
      const done = act === 't-answer' ? '정답 코드를 편집기에 열었어요. (교사 미리보기 기록에만 저장돼요)' : '시작 코드를 불러왔어요.';
      if (!window.MC.ready()) { labCtx.pendingLoad = { code, done }; return show('info', labCtx.mcFail ? '코딩 화면이 열리지 않았어요. 코딩 화면이 열리면 넣을게요.' : '코딩 화면이 열리면 넣을게요.'); }
      const ok = await window.MC.load(code);
      return show('info', ok ? done : '코드를 넣지 못했어요. 새로 고침 뒤 다시 눌러 주세요.');
    }
    if (act === 'robot') {
      if (state.missions[m.id]) return; // 두 번 눌러도 한 번만
      // S3-6: 측정 기록표가 2단계에 있으면 기록 조건(recordPass, 없으면 모든 칸)을 채워야 [목표대로 됐어요]가 된다(교사 미리보기는 그대로 통과)
      const rp = !isTeacher() && recordPassMsg(m);
      if (rp) { const row = $('[data-act="robot"]', li).closest('.mission-actions'); whyNote(row, rp); const rc = $('.record-card', li); if (rc) { rc.classList.remove('flash'); void rc.offsetWidth; rc.classList.add('flash'); } return; }
      if (state.codeOk[m.id] || isTeacher()) { passMission(li, k, state.codeOk[m.id] === 'self' ? 'self' : 'check'); return; }
      // 코드 확인 전(교사 미리보기 등): 이유 한 줄 + 1단계 강조(06 P1-6)
      const row = $('[data-act="robot"]', li).closest('.mission-actions'); whyNote(row, '먼저 1단계 코드 확인을 통과해요. 할 일을 모두 만들면 저절로 열려요.');
      const s1 = $('.step', li); s1.classList.remove('flash'); void s1.offsetWidth; s1.classList.add('flash');
      return;
    }
    if (act === 'self') { state.codeOk[m.id] = 'self'; save(); unlockRobotStep(li, '좋아요. 2단계에서 로봇이 목표대로 움직이는지 꼭 봐요. (내 결과 카드에 "스스로 통과"로 표시돼요)'); return; }
  }

  // 1단계 통과: 1단계를 한 줄로 접고(결과·힌트·블록 찾기 걷기, 05 P0-4), 2단계를 펼친 뒤 그 제목으로 초점(07 P0-4).
  // 10차: 자동 확인으로 통과했는데 학생이 코딩 화면(MakeCode) 안에 있으면 초점을 빼앗지 않는다(focus: false)
  function unlockRobotStep(li, intro, { focus = true } = {}) {
    const [s1, s2] = $$('.step', li);
    s1.classList.remove('now', 'unfold'); s1.classList.add('passed');
    const more = $('.step-more', s1); if (more) { more.setAttribute('aria-expanded', 'false'); more.textContent = '다시 보기'; }
    s2.classList.remove('wait'); s2.classList.add('now');
    li.dataset.ms = 'robot';
    const fb = $('.feedback', s1); fb.className = 'feedback'; fb.innerHTML = ''; fb._html = '';
    $$('.hint', s1).forEach((x) => setHintFold(x, true));
    $$('.lcard.fold', s1).forEach((c) => setCardOpen(c, false));
    const ri = $('.robot-intro', s2); if (ri) { ri.innerHTML = intro || ''; ri.classList.toggle('show', !!intro); }
    syncLabUI();
    const hd = $('.step-head', s2); hd.tabIndex = -1;
    panelReveal(s2, 'start'); if (focus) hd.focus({ preventScroll: true });
    labSay('1단계 통과! 이제 2단계, 로봇에서 실행해요.');
    maybeSafety();
  }
  // 2단계에서 코드가 바뀌어 목표와 달라지면(자동 확인) 1단계로 돌아간다
  function relockRobotStep(li) {
    const [s1, s2] = $$('.step', li);
    s1.classList.remove('passed', 'unfold'); s1.classList.add('now');
    s2.classList.remove('now'); s2.classList.add('wait');
    const ri = $('.robot-intro', s2); if (ri) { ri.innerHTML = ''; ri.classList.remove('show'); }
    li.dataset.ms = 'make';
    syncLabUI();
  }

  /* ---------- 10차 L: 실시간 코드 확인 (DESIGN.md 10차 5) ----------
   * [코드 확인] 버튼 없이, MakeCode가 저장할 때마다(MC.onSave) 펼친 미션의 코드를 확인한다.
   *  - 디바운스 LIVE_MS(700ms): 연달아 저장되면 마지막 것만 확인(채점은 동기라 확인끼리 겹치지 않는다)
   *  - 조용한 확인(quiet): 'first' = 화면을 연 뒤·펼친 미션이 바뀐 뒤 첫 확인, 'load' = 코드를 통째로 넣은 직후(되돌리기·체크포인트·
   *    시작 코드·정답 코드·AI 넣기: MC.isLocked()·MC.lastLoadAt() 4초·넣은 뒤 첫 저장 — watchFinder와 같은 규칙).
   *    ✓와 글은 바꾸되 실패·확인 수를 세지 않고 알리지 않는다('load'는 새 출발점이라 정체 수를 0으로)
   *  - 실패: 소리 없이 카드 글만 조용히 바뀐다(같은 글이면 그리지 않음). 통과: 소리 1번 + 1단계 접힘 + 2단계 열림
   *  - 정체 기준(옛 '3번째 실패'): 맞은 줄 수가 늘지 않은 채 코드가 4번 바뀜(stall ≥ 4) 또는 할 일은 다 맞았는데 gate 문장 3번(gate ≥ 3)
   *    → [선생님 부르기][다른 방법으로 풀었어요]. 다음 칸 버튼([블록 찾기]/[힌트 n 보기])은 stall ≥ 2
   *  - 2단계(robot): 자동 통과(codeOk === true)한 코드가 실제로 바뀌어(체크포인트와 다름) 목표와 달라지면 1단계로 다시 잠근다.
   *    선생님·스스로 통과('teacher'·'self')는 다른 방법으로 풀었을 수 있어 잠그지 않는다 */
  const LIVE_MS = 700;
  const normTs = (s) => String(s || '').replace(/\s+/g, ' ').trim();
  function liveStart() {
    if (!labCtx) return;
    labCtx.live = { t: 0, snap: null, quiet: '', first: true, loadSeen: (window.MC.lastLoadAt && window.MC.lastLoadAt()) || 0, lastTs: {}, lastOk: {}, said: {} };
    labCtx.unLive = window.MC.onSave((snap) => liveSnap(snap));
  }
  // 저장 하나 받기: 조용한 이유를 정하고, 블록 찾기 요약은 바로, 확인은 디바운스 뒤
  function liveSnap(snap, why) {
    const lv = labCtx && labCtx.live; if (!lv || !snap) return;
    const la = (window.MC.lastLoadAt && window.MC.lastLoadAt()) || 0;
    const q = why || (window.MC.isLocked() || Date.now() - la < 4000 || lv.loadSeen !== la ? 'load' : lv.first ? 'first' : '');
    lv.loadSeen = la; lv.first = false;
    const rank = { '': 0, first: 1, load: 2 }; // 디바운스 동안 온 저장 중 가장 '조용한' 이유를 따른다
    lv.quiet = lv.t && rank[lv.quiet] > rank[q] ? lv.quiet : q;
    lv.snap = snap;
    const li = openLi(); if (li) syncFinderSum(li, labCtx.lab.missions[+li.dataset.m]);
    clearTimeout(lv.t);
    lv.t = setTimeout(() => { lv.t = 0; if (!labCtx || labCtx.live !== lv) return; const s = lv.snap, qq = lv.quiet; lv.quiet = ''; liveCheck(s, qq); }, LIVE_MS);
  }
  // 지금 코드로 한 번(조용히): 코딩 화면이 열렸을 때(fresh: 저장을 부탁해 최신으로)·펼친 미션이 바뀌었을 때
  function liveKick(fresh) {
    if (!labCtx || !labCtx.live || !window.MC.ready()) return;
    if (fresh) { const lv = labCtx.live; window.MC.getCode().then((s) => { if (s && labCtx && labCtx.live === lv) liveSnap(s, 'first'); }); return; }
    const s = window.MC.peek(); if (s) liveSnap(s, 'first');
  }
  // 글 편집기(JavaScript 'tsprj'·Python 'pyprj')로 고친 코드는 main.ts로 채점한다(진짜 MakeCode 확인 2026-10-21: Python에서 고치면 저장의 main.ts도 바뀜, main.blocks는 블록 화면용)
  const textEditor = (code) => !!(code && code.editor && code.editor !== 'blocksprj');
  // 채점(옛 'check' 분기): 채점 v2(블록 트리, js/engine.js) — 실패하면 정규식 채점. 체크리스트는 맞아도 동작하지 않는 코드는 gate로 막는다
  function gradeMission(m, code, li) {
    const ts = code.ts || '';
    let results, pass, extra = [], nearMsg = '', g = null;
    const v2 = window.PB && window.PB.missionsV2[m.id];
    const records = recordsFor(m); // S3-6: 측정 기록(체크 record·시나리오 $rec)
    if (v2) { try { const hb = li && $('.hints', li); const lvl = Math.min(3, 1 + (hb ? +hb.dataset.shown || 0 : 0)); g = window.PB.grader.grade(textEditor(code) ? { ts, blocks: '' } : code, Object.assign({ id: m.id }, v2), { level: lvl, records }); } catch (e) { g = null; } }
    if (g) {
      results = g.results.map((r) => !!r.ok); pass = g.pass;
      extra = g.struct.filter((s) => ['floating', 'duplicate', 'partial', 'disabled', 'mismatch'].includes(s.kind)).map((s) => s.msg).concat(g.scenMsgs || []); // B형: 틀린 시나리오의 학생 문장(쓴 값·예시값 포함)
      nearMsg = g.near && !g.near.ok && g.near.msg ? g.near.msg : '';
      if (v2.screen) { try { const sim = new window.PB.Sim(ts); sim.runUntil(1500); extra = extra.concat(window.PB.grader.oledFeedback(window.PB.grader.oledProbes(sim.oled), v2.screen)); } catch (e) {} }
    } else {
      results = m.checks.map((c) => runCheck(c, ts, { records: recOf(m.id) }));
      pass = results.every(Boolean) && (!m.order || inOrder(scopeOf(ts, m.order.scope), m.order.seq));
    }
    // 미션 순서 규칙 + 보정값과 무관한 동작 검사(gate, 학생 테스트 4차)
    let gateMsgs = [];
    if (pass && m.order && !inOrder(scopeOf(ts, m.order.scope), m.order.seq)) { pass = false; gateMsgs.push(m.order.msg); }
    if (pass && v2 && window.PB.grader.gate) { gateMsgs = gateMsgs.concat(window.PB.grader.gate(ts, v2, { records })); if (gateMsgs.length) pass = false; }
    return { results, pass, extra, nearMsg, gateMsgs, g, v2 };
  }
  // 통과해도 실제 동작이 목표와 다를 수 있는 부분(엔진으로 따라가 본 참고 문장)
  const simNotesHTML = (code, r) => { const sn = r.g && r.v2 ? simBehaviorNotes(code, r.v2) : []; return sn.length ? `<div class="fb-sim"><b>코드를 따라가 보니</b><ul>${sn.map((t) => `<li>${esc(t)}</li>`).join('')}</ul><span class="fine">통과는 그대로예요. 로봇에서 실행할 때 이 부분을 잘 봐요.</span></div>` : ''; };
  function liveCheck(snap, quiet) {
    if (!labCtx || !labCtx.live || !snap) return;
    const lab = labCtx.lab; if ((labUI.ws[lab.id] || 'mission') === 'create') return;
    const k = openK(lab); if (k < 0) return;
    const ms = mstate(lab, k); if (ms !== 'make' && ms !== 'robot') return;
    const li = $(`.mission[data-m="${k}"]`); if (!li) return;
    const m = lab.missions[k], lv = labCtx.live, ts = snap.ts || '';
    const prevTs = lv.lastTs[m.id]; lv.lastTs[m.id] = ts;
    const changed = prevTs != null && normTs(prevTs) !== normTs(ts);
    if (ms === 'robot') {
      if (state.codeOk[m.id] !== true) return;
      const base = (state.checkpoints[m.id] || {}).ts;
      if (base != null ? normTs(base) === normTs(ts) : !changed) return; // 통과한 코드 그대로
      const r = gradeMission(m, snap, li);
      if (r.pass) { // 바꿨지만 여전히 맞음: 2단계 그대로, 안내만 조용히
        state.checkpoints[m.id] = { ts, blocks: snap.blocks || '' }; persist();
        const ri = $('.robot-intro', li); if (ri) { ri.innerHTML = `<b>${quiet ? '' : '코드를 바꿨어요. '}코드 확인 통과!</b> 그대로 로봇에서 실행해요.${simNotesHTML(snap, r)}`; ri.classList.add('show'); }
        return;
      }
      state.codeOk[m.id] = false; save(); relockRobotStep(li);
      labSay('코드가 바뀌어 목표와 달라졌어요. 1단계에서 다시 확인해요.');
      return liveMake(li, k, m, snap, r, quiet, true);
    }
    liveMake(li, k, m, snap, gradeMission(m, snap, li), quiet, changed);
  }
  function liveMake(li, k, m, snap, r, quiet, changed) {
    const lv = labCtx.live, n = m.checks.length;
    const okN = r.results.filter(Boolean).length;
    const counted = !quiet && changed; // 학생이 코드를 실제로 바꾼 확인만 센다
    const prevRes = labCtx.results[m.id]; labCtx.results[m.id] = r.results;
    const prevOk = lv.lastOk[m.id]; lv.lastOk[m.id] = okN;
    // 체크리스트 ✓ + 화면 낭독용 "완료/아직"(05 P1-7). 새로 맞은 줄은 한 번 반짝(학생이 고친 확인에서만)
    $$('.checklist li', li).forEach((x, j) => { setCheck(x, r.results[j]); if (counted && prevRes && r.results[j] && !prevRes[j]) { x.classList.remove('just-ok'); void x.offsetWidth; x.classList.add('just-ok'); } });
    const s0 = (state.stats || {})[m.id] || {};
    const S = { checks: s0.checks || 0, fails: s0.fails || 0, stall: s0.stall || 0, gate: s0.gate || 0, best: s0.best == null ? null : s0.best };
    if (quiet === 'load') { S.best = okN; S.stall = 0; } // 통째로 넣은 코드 = 새 출발점
    else if (quiet) { if (S.best == null) S.best = okN; }
    else if (counted) {
      S.checks++;
      const strip = $('.win-strip', li); if (strip) strip.remove(); // 앞 미션 성공 띠는 학생이 코드를 고치기 시작할 때까지(7차 03 P0-4)
      if (r.pass || S.best == null || okN > S.best) { S.best = okN; S.stall = 0; } else { S.stall++; S.fails++; }
      if (!r.pass && okN === n && r.gateMsgs.length) S.gate++;
    }
    labCtx.fails[m.id] = S.fails;
    const res = r.results.map(Boolean);
    if (['checks', 'fails', 'stall', 'gate', 'best'].some((x) => (s0[x] == null ? null : s0[x]) !== S[x]) || JSON.stringify(s0.res || null) !== JSON.stringify(res)) bumpStats(m.id, Object.assign({}, S, { res }));
    if (r.pass) return livePass(li, m, snap, r);
    liveFail(li, k, m, r, { okN, prevOk, counted, S });
    syncLiveUI();
  }
  function livePass(li, m, snap, r) {
    state.codeOk[m.id] = true;
    state.checkpoints[m.id] = { ts: snap.ts || '', blocks: snap.blocks || '' };
    save(); beep('led');
    // 코드 통과 = 작은 축하. 1단계는 한 줄로 접히고 2단계가 펼쳐진다(7차 03 P0-2). 큰 축하는 로봇 확인 뒤(10 P0-1)
    const ae = document.activeElement, inEditor = !!(ae && (ae.id === 'mcFrame' || (ae.closest && ae.closest('.lab-editor, #vibeDock'))));
    unlockRobotStep(li, `<b>1단계 통과!</b> 이제 다운로드해서 로봇에서 실행해요.${simNotesHTML(snap, r)}`, { focus: !inEditor });
    if (!li.offsetHeight) toast('1단계 통과! 이제 다운로드해서 로봇에서 실행해요.', 'ok'); // 패널이 안 보일 때(접힘·좁은 화면 [코딩] 탭)
  }
  // 실패(7차 05 P0-1): 칭찬 한 줄 + "다음 할 일" 한 문장 + 다음 칸 버튼 하나. 소리·반짝임·마스코트 없이 글만
  function liveFail(li, k, m, r, { okN, prevOk, counted, S }) {
    const fb = $('.feedback', li); if (!fb) return;
    const n = m.checks.length, ts = (labCtx.live.lastTs[m.id]) || '';
    const miss = m.checks.find((c, j) => !r.results[j]);
    const up = counted && prevOk != null && okN > prevOk;
    const praise = up ? `<b class="fb-up">좋아요! ${okN - prevOk}개 더 맞았어요 (${okN}/${n}).</b> ` : '';
    // 9차 D9·D16(E1-04): 빠진 줄의 블록이 코드에 '있는데' 실패하면(자리·순서 문제) "없으면…" 대신 "있어요. 옮겨요"
    const present = miss && !miss.not && (() => { try { return runCheck(miss, ts); } catch (e) { return false; } })();
    const placeMsg = present ? (/정지/.test(miss.label) && /맨 아래/.test(miss.label) && !stopIsLast(ts, miss.scope)
      ? '<b>정지 블록은 있어요.</b> 그런데 맨 아래가 아니에요. 정지 블록을 끌어서 맨 아래로 옮겨요.'
      : `<b>${esc(miss.label)}</b>: 블록은 코드에 있어요. 들어간 자리와 순서, 개수를 다시 봐요.`) : '';
    // B형: 빠진 줄이 시나리오(동작) 체크면 그 시나리오의 학생 문장(쓴 값·예시값 포함)을 먼저(P5)
    // ★7~8 페르소나 2회차 #9: 시나리오 실패 문장("…를 넣었는데 …가 나오지 않았어요")은 학생이 코드를 바꿔 확인이 한 번 돈 뒤에만(stats.checks > 0).
    //   시작 전(빈 코드·시작 코드 그대로·불러온 코드)에는 숨기고 체크 줄의 '다음 할 일'(nudge)만
    const touched = S.checks > 0, scenAll = touched || !r.g ? [] : r.g.scenMsgs || [];
    const scenMsg = touched && miss && r.g && r.g.scenByCheck ? r.g.scenByCheck[m.checks.indexOf(miss)] : '';
    const msg = (scenMsg ? `<b>${esc(miss.label)}</b>: ${esc(scenMsg)}` : '') || placeMsg || (miss ? `다음 할 일: <b>${esc(miss.label)}</b>. ${miss.nudge || ''}` : '') || (r.gateMsgs.length ? `블록은 다 있어요. 그런데 <b>이대로라면 목표대로 움직이지 않아요.</b> ${esc(r.gateMsgs[0])}` : (r.nearMsg ? esc(r.nearMsg) : (m.order ? m.order.msg : '블록 순서를 다시 확인해 봐요.')));
    // 같은 블록 안내를 두 번 하지 않는다(7차 08 P0-2): 빠진 줄이 있으면 엔진의 '가장 가까운 정답' 문장은 빼고, 구조 문제(떠 있는 블록 등) 하나만
    const more = (miss ? r.extra : [...r.gateMsgs.slice(1), ...r.extra]).filter((t) => t && t !== scenMsg && !scenAll.includes(t)).slice(0, 1);
    const fcard = $('.finder-card', li), hcard = $('.hint-card', li), hbox = $('.hints', li);
    const shown = hbox ? +hbox.dataset.shown || 0 : 0;
    const next = S.stall < 2 ? '' : miss && fcard && !fcard.classList.contains('open') ? '<button class="btn small" type="button" data-fb="find">블록 찾기</button>'
      : hcard && shown < m.hints.length ? `<button class="btn small" type="button" data-fb="hint">힌트 ${shown + 1} 보기</button>` : '';
    const stuck = S.stall >= 4 || S.gate >= 3;
    const call = stuck ? `${isTeacher() ? '' : '<button class="btn small" type="button" data-fb="call">선생님 부르기</button>'}<button class="btn ghost small" type="button" data-self>다른 방법으로 풀었어요</button>` : '';
    // 설계 개정 2: 측정 기록을 쓰는 시나리오가 틀렸으면 [기록 다시 재기](기록표 미션의 기록표로)
    const scenFail = !!scenMsg || (!miss && r.gateMsgs.length > 0 && !!(r.v2 && r.v2.scenarios && r.v2.scenarios.length));
    const remK = scenFail ? recMissionFor(labCtx.lab, m) : -1;
    const reBtn = remK >= 0 ? `<button class="btn ghost small" type="button" data-remeasure="${remK}">기록 다시 재기</button>` : '';
    const html = `${praise}${msg}${more.length ? `<ul class="fb-more">${more.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}${next || call || reBtn ? `<div class="fb-next">${reBtn}${next}${call}</div>` : ''}`;
    if (fb._html !== html) {
      fb._html = html; fb.className = 'feedback show no live'; fb.innerHTML = html;
      const sb = $('[data-self]', fb); if (sb) sb.addEventListener('click', () => missionAction(li, k, 'self'));
      $$('[data-fb]', fb).forEach((b) => b.addEventListener('click', () => {
        const a = b.dataset.fb;
        if (a === 'find') { const box = $('.finder', li); if (box && !box.hidden) panelReveal(box); else missionAction(li, k, 'find').then(() => panelReveal($('.finder', li))); }
        else missionAction(li, k, a);
      }));
    }
    const lv = labCtx.live;
    if (up) labSay(`좋아요! ${okN - prevOk}개 더 맞았어요.`);
    if (stuck && counted && !lv.said[m.id]) { lv.said[m.id] = true; labSay('막혔다면 선생님을 부르거나, 다른 방법으로 풀었다고 알려요.'); }
    if (!stuck) lv.said[m.id] = false;
  }
  // 코드 확인 카드 머리의 상태 한 줄(툴바 거울·세로 태블릿 서랍도 같은 말)
  function liveSumText(lab, k, ms = mstate(lab, k)) {
    const m = lab.missions[k];
    if (ms === 'done') return '통과!';
    if (ms === 'robot') return state.codeOk[m.id] === 'teacher' ? '선생님이 코드를 확인했어요' : state.codeOk[m.id] === 'self' ? '스스로 통과로 표시했어요' : '통과!';
    if (ms === 'locked') return '앞 미션을 끝내면 열려요';
    if (labCtx && labCtx.mcFail) return '코딩 화면이 열리지 않았어요. 선생님께 알려요';
    if (!labCtx || !window.MC.ready()) return '코딩 화면이 열리면 자동으로 확인해요';
    const res = labCtx.live && labCtx.live.lastOk[m.id] != null ? labCtx.results[m.id] : null;
    if (!res) return '자동으로 확인 중';
    const okN = res.filter(Boolean).length, n = m.checks.length;
    return `자동으로 확인 중 · ${okN === n ? '할 일은 모두 맞음' : `${n}개 중 ${okN}개 맞음`}`;
  }
  const liveShort = (t) => (/^자동으로 확인 중 · /.test(t) ? t.replace('자동으로 확인 중 · ', '자동 확인 · ') : /^(자동으로 확인 중|코딩 화면이 열리면)/.test(t) ? '자동 확인 대기' : /^코딩 화면이 열리지/.test(t) ? '코딩 화면이 열리지 않았어요' : `코드 확인 ${t}`);
  const drawerLiveText = (ms, t) => (ms === 'robot' || ms === 'done' ? `${t === '통과!' ? '코드 확인 통과!' : t} 이제 로봇에서 실행해요` : `코드 확인: ${t}`);
  // 펼친 미션의 상태 한 줄을 지금 값으로(카드 머리·서랍·툴바 거울)
  function syncLiveUI() {
    if (!labCtx) return;
    const lab = labCtx.lab, k = openK(lab); if (k < 0 || (labUI.ws[lab.id] || 'mission') === 'create') return;
    const li = $(`.mission[data-m="${k}"]`); if (!li) return;
    const ms = mstate(lab, k), t = liveSumText(lab, k, ms);
    const sum = $('[data-live-sum]', li); if (sum && sum.textContent !== t) sum.textContent = t;
    const dl = $('[data-drawer-live]', li), dt = drawerLiveText(ms, t); if (dl && dl.textContent !== dt) dl.textContent = dt;
    const cc = $('.check-card', li); if (cc) cc.classList.toggle('pass', ms === 'robot' || ms === 'done');
    const tl = $('#tbAct .tb-live'), st = liveShort(t); if (tl && tl.textContent !== st) tl.textContent = st;
  }

  /* 미션 성공(UI/UX 7차 03 P0-4·결정 2): [목표대로 됐어요]를 누르면 바로 다음 미션이 펼쳐지고, 그 맨 위에 성공 띠가 생긴다.
   * 띠: 미션 n 완료! · 배운 점 · LED +n · 짝 역할 교대. 학생이 다음 미션 코드를 고치기 시작할 때(첫 자동 확인)까지 남는다(5차 10 P0-1 '성공을 오래 보이기'를 띠로 지킴).
   * 실습 완주: 완료 화면 맨 위에 축하 카드, 고르기는 아래 막대의 [자유 만들기 열기]·[다음 실습] 2개 */
  function celebrate(li, k, { via, gain, nextLi, allDone }) {
    const lab = labCtx.lab; const m = lab.missions[k]; const nm = lab.missions[k + 1];
    const roles = nextLi && !allDone ? pairRoles(nm) : null;
    const viaLine = via === 'teacher' ? '선생님과 함께 해결했어요. 도움을 요청한 것도 좋은 방법이에요.'
      : via === 'self' ? '스스로 통과했어요. 선생님이 로봇을 한 번 봐 주실 거예요.' : '';
    const chGo = k === lastReqK(lab) ? chGoHTML(lab) : ''; // ★페르소나 2회차 #6
    const led = !isTeacher() && gain > 0 ? `<span class="win-led"><span class="led-gain" aria-hidden="true"><i></i></span>${esc(PW)} +${gain}칸</span>` : '';
    if (allDone && !isTeacher()) {
      const slot = $('.lab-done .lab-win-slot');
      if (slot) slot.innerHTML = `<div class="robot-done lab-win">${artImg('pbWin', 'win-art')}<div class="win-body">
        <p class="win-kicker">실습 완주! ${led}</p>
        ${viaLine ? `<p class="win-via">${viaLine}</p>` : ''}
        ${m.learn ? `<p class="win-why"><b>배운 점</b> ${esc(m.learn)}</p>` : ''}
        <p class="win-pick">아래에서 다음에 할 일을 골라요.</p>${chGo}</div></div>`;
      focusMission();
      const p = $('.lab-done [data-ws="create"]') || $('.lab-pager [data-lab-nav="next"]'); if (p) p.focus({ preventScroll: true });
      labSay(`실습 완주!${gain > 0 ? ` ${PW} ${gain}칸이 켜졌어요.` : ''} 자유 만들기를 열거나 다음 실습으로 가요.`);
      return;
    }
    if (!nextLi) { labSay(`미션 ${k + 1} 완료!`); return; }
    const strip = h(`<div class="win-strip">${artImg('win', 'win-art')}<div class="win-body">
      <p class="win-kicker">미션 ${k + 1} 완료! ${led}</p>
      ${m.learn ? `<p class="win-why">${esc(m.learn)}</p>` : ''}
      ${viaLine ? `<p class="win-via">${viaLine}</p>` : ''}
      ${roles ? `<p class="win-pair">이제 ${rolesLine(roles, ', ')}. 자리를 바꿔요.</p>` : ''}${chGo}</div></div>`);
    const old = $('.win-strip', nextLi); if (old) old.remove();
    $('.mbody', nextLi).prepend(strip);
    if (BASIC_FIRST && !isTeacher() && k === lastReqK(lab) && nm.optional) {
      const status = $('#basicStatus');
      if (status) { status.tabIndex = -1; status.focus(); status.scrollIntoView({ block: 'nearest' }); }
      labSay('기초 실습 완료! 다음으로 가도 돼요. 더 해 보고 싶으면 응용 미션을 골라요.');
    } else {
      focusMission();
      labSay(`미션 ${k + 1} 완료!${gain > 0 && !isTeacher() ? ` ${PW} ${gain}칸이 켜졌어요.` : ''} 이제 미션 ${k + 2}, ${nm.title}.${roles ? ` 코딩 ${roles.coder}, 로봇 ${roles.robot}${roles.check ? `, ${roleText().check} ${roles.check}` : ''}.` : ''}`);
    }
  }

  // via: check(자동 검사) | self(스스로 통과) | teacher(선생님 통과). extra: 기록에 덧붙일 값(예: A 선생님 확인의 { why: 'robot'|'code' })
  async function passMission(li, k, via = 'check', extra = null) {
    const lab = labCtx.lab; const m = lab.missions[k];
    const litBefore = ledPattern().lit;
    // 선생님 확인 [코드만 통과](A, 9차 D6) 뒤 학생이 로봇에서 확인하면: 선생님 통과 · 사유 'code'
    const teacherCode = via === 'check' && state.codeOk[m.id] === 'teacher'; if (teacherCode) via = 'teacher';
    // 선생님 통과는 앞서 "스스로 통과"로 끝낸 기록도 덮어쓴다(그래야 자유 만들기가 열림 — 그룹 검증 3번)
    const prev = state.missions[m.id];
    if (!prev || (via === 'teacher' && typeof prev === 'object' && prev.via === 'self')) state.missions[m.id] = { at: Date.now(), via };
    if (teacherCode && state.missions[m.id] && typeof state.missions[m.id] === 'object') state.missions[m.id].why = 'code';
    // 9차 B(D5): 통과 순간의 역할(state.missions[id].roles = { code, robot, check? })과 덧붙일 값을 새 기록에 남긴다
    const rec = state.missions[m.id];
    if (rec && typeof rec === 'object' && rec !== prev) {
      const r = pairRoles(m); if (r && !rec.roles) rec.roles = Object.assign({ code: r.coder, robot: r.robot }, r.check ? { check: r.check } : {});
      if (extra && typeof extra === 'object') Object.assign(rec, extra);
    }
    // 어떤 방식으로 통과하든 지금 코드를 "내 코드"로 저장 → 다음 미션 되돌리기에 쓴다
    if (!state.checkpoints[m.id]) { const code = await window.MC.getCode(); if (code && code.ts) state.checkpoints[m.id] = { ts: code.ts, blocks: code.blocks || '' }; }
    save();
    const gain = Math.max(0, ledPattern().lit - litBefore);
    li.classList.remove('active'); li.classList.add('done'); li.dataset.ms = 'done';
    $('.num', li).innerHTML = ICON.check;
    li.classList.remove('just-done'); void li.offsetWidth; li.classList.add('just-done');
    $$('.step', li).forEach((s) => { s.classList.remove('now', 'wait', 'unfold'); s.classList.add('passed'); });
    $$('.checklist li', li).forEach((x) => setCheck(x, true));
    const fb = $('.feedback', li); fb.className = 'feedback'; fb.innerHTML = ''; fb._html = '';
    const cc = $('.check-card', li); if (cc) { cc.classList.add('pass'); const s = $('[data-live-sum]', cc); if (s) s.textContent = '통과!'; }
    $$('.lcard.fold', li).forEach((c) => setCardOpen(c, false));
    const rb = $('[data-act="robot"]', li); if (rb) { rb.disabled = true; rb.className = 'btn small robot-ok'; rb.textContent = '✓ 목표대로 됐어요'; }
    if (helpReq && helpReq.k === k) setHelp(null);
    const nextLi = li.nextElementSibling && li.nextElementSibling.classList.contains('mission') ? li.nextElementSibling : null;
    // 잠금을 풀 미션: 다음 미션(두 프로젝트 실습이면 같은 프로젝트의 다음 미션)
    const uk = lab.projects && lab.projects.length ? lab.missions.findIndex((x, j) => j > k && projOf(lab, x) === projOf(lab, m)) : k + 1;
    const unLi = uk > k ? $(`.mission[data-m="${uk}"]`) : null;
    if (unLi && unLi.classList.contains('locked')) {
      unLi.classList.remove('locked'); unLi.classList.add('active'); unLi.dataset.ms = mstate(lab, uk);
      $('.num', unLi).textContent = String(uk + 1);
      $$('.step.s1', unLi).forEach((s) => { s.classList.remove('wait'); s.classList.add('now'); });
    }
    const allDone = lab.missions.every((x) => state.missions[x.id]);
    // 펼칠 곳: 학생은 지금 미션(다음 미션, 다 끝냈으면 완료 화면), 교사는 다음 미션
    if (isTeacher()) labUI.open[lab.id] = nextLi ? k + 1 : k; else labUI.open[lab.id] = null;
    if (allDone) { const d = $('.lab-done'); if (d) d.innerHTML = labDoneHTML(lab); }
    if (k === lastReqK(lab) && !$('.ch-go', li)) { const s2 = $('.step.s2', li), g = chGoHTML(lab); if (s2 && g) s2.insertAdjacentHTML('afterend', g); }
    if (!$('.lab-ch')) { const d = $('.lab-done'), c = labChHTML(lab); if (d && c) d.insertAdjacentHTML('afterend', c); } else if (allDone) $('.lab-ch').remove();
    syncLabUI();
    celebrate(li, k, { via, gain, nextLi: nextLi && lab.missions[k + 1] ? nextLi : null, allDone });
    liveKick(); // 10차: 다음 미션을 지금 코드로 조용히 한 번(이미 맞은 줄 ✓)
  }

  /* 공용(9차 접점): 미션 id로 통과 처리. A의 선생님 확인이 부른다 — markPass(id, 'teacher', { why: 'robot' }).
   * 실습 화면에 그 미션이 있으면 화면까지(passMission: 성공 띠·다음 미션·역할 기록), 없으면 기록만 남긴다 */
  async function markPass(id, via = 'check', extra = null) {
    if (via === 'teacher' && !state.codeOk[id]) state.codeOk[id] = true;
    if (labCtx) {
      const k = labCtx.lab.missions.findIndex((x) => x.id === id), li = k >= 0 ? $(`.mission[data-m="${k}"]`) : null;
      if (li) return passMission(li, k, via, extra);
    }
    const m = labs.flatMap((lb) => lb.missions).find((x) => x.id === id); if (!m) return;
    const prev = state.missions[id];
    if (!prev || (via === 'teacher' && typeof prev === 'object' && prev.via === 'self')) {
      const r = pairRoles(m);
      state.missions[id] = Object.assign({ at: Date.now(), via }, r ? { roles: Object.assign({ code: r.coder, robot: r.robot }, r.check ? { check: r.check } : {}) } : {}, extra || {});
    }
    save();
  }

  /* ---------- 내 결과 카드 (학생) ---------- */
  // 통과 방식 범례(페르소나 2회차 #31): 긴 설명 줄 → 아이콘 + 단어 3개(자동 확인 · 스스로 · 선생님). 뜻은 title(마우스)·화면 낭독 글로
  const LG_IC = {
    check: '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    self: '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M4 20l1-4L16 5l3 3L8 19z" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"/></svg>',
    teacher: '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><circle cx="12" cy="8" r="4" fill="currentColor"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7z" fill="currentColor"/></svg>',
  };
  const LEGEND_HTML = `<p class="result-legend"><span class="lg-k">통과 방식</span><span class="lg" title="코드를 바꿀 때마다 앱이 저절로 확인함">${LG_IC.check}자동 확인</span><span class="lg" title="학생이 표시함">${LG_IC.self}스스로</span><span class="lg" title="선생님이 확인함(로봇 확인 / 코드만)">${LG_IC.teacher}선생님</span></p>`;
  // 결과 카드: 성적표 대신 "우리가 만든 것" 중심, "-"·0 칸은 그리지 않음, 교사용 정보는 맨 아래 작은 줄(UI/UX 5차 10 P1-6, 07 P2-11)
  function viewMe() {
    const p = ledPattern(); const s = p.s;
    const pn = splitNames(session.name);
    const left = s.missionTotal - s.missions;
    const req = s.missionTotal - s.opt, reqLeft = req - (s.missions - s.optDone);
    const headline = p.full ? `하트 완성! ${esc(PW)} 25칸을 모두 채웠어요.`
      : NOLAB ? (s.theory >= s.theoryTotal ? `이론 ${s.theoryTotal}쪽을 모두 확인했어요!${s.gameTotal && s.games < s.gameTotal ? ` 분류 게임이 ${s.gameTotal - s.games}개 남았어요.` : ''}` : s.theory ? `이론 ${s.theoryTotal}쪽 중 ${s.theory}쪽을 확인했어요!` : `오늘 이론 ${s.theoryTotal}쪽이 기다리고 있어요.`)
      : s.opt && !left ? `미션 ${s.missionTotal}개(필수 ${req}개 + 선택 ${s.opt}개)를 모두 해냈어요!`
      : s.opt && !reqLeft ? `필수 미션 ${req}개를 모두 해냈어요! 선택 미션은 ${s.opt - s.optDone}개 남았어요.`
      : s.opt && s.missions ? `미션 ${s.missions}개 성공! 필수 ${reqLeft}개가 남았어요(선택 ${s.optDone}/${s.opt}개).`
      : s.opt ? `오늘 미션: 필수 ${req}개 + 선택 ${s.opt}개가 기다리고 있어요.`
      : !left ? `미션 ${s.missionTotal}개를 모두 해냈어요!`
      : s.missions ? `미션 ${s.missions}개 성공! ${left}개 남았어요.` : `오늘 미션 ${s.missionTotal}개가 기다리고 있어요.`;
    // 9차 D5: 결과 카드 = 평가판(미션마다 통과 방식·시각·그때 역할, 도전 메모, 내 생각·예측, 퀴즈 첫 시도·최고·횟수, 자유 만들기)
    const note = (id, n) => { const t = (state.starNote || {})[`${id}:${n}`]; return t ? ` — ${t}` : ''; };
    const clip = (t, n = 120) => { const x = String(t || '').replace(/\s+/g, ' ').trim(); return x.length > n ? `${x.slice(0, n - 1)}…` : x; };
    const VIA = { check: '자동 확인', self: '스스로', teacher: '선생님' }, WHY = { robot: '로봇 확인', code: '코드만' };
    const tm = (t) => { if (!t || t < 1e11) return ''; const d = new Date(t); const hm = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`; return d.toDateString() === new Date().toDateString() ? hm : `${d.getMonth() + 1}. ${d.getDate()}. ${hm}`; };
    const meta = (m) => {
      const r = state.missions[m.id];
      if (!r) { const h0 = ((state.stats || {})[m.id] || {}).hints || 0; return h0 ? `<span class="made-meta">${esc(`힌트 ${h0}/${(m.hints || []).length}단계까지 봄`)}</span>` : ''; }
      const o = typeof r === 'object' ? r : {};
      const via = (VIA[o.via] || VIA.check) + (o.via === 'teacher' && WHY[o.why] ? `(${WHY[o.why]})` : '');
      const ro = o.roles ? [o.roles.code && `코딩 ${o.roles.code}`, o.roles.robot && `로봇 ${o.roles.robot}`, o.roles.check && `${roleText().check} ${o.roles.check}`].filter(Boolean).join(' · ') : '';
      // 열어 본 힌트 단계(P1): 미션별 힌트 수(state.stats[미션].hints) — 0이면 적지 않음
      const hs = ((state.stats || {})[m.id] || {}).hints || 0, hl = hs ? `힌트 ${hs}/${(m.hints || []).length}단계까지 봄` : '';
      return `<span class="made-meta">${[via, tm(o.at), ro, hl].filter(Boolean).map(esc).join(' · ')}</span>`;
    };
    // S3-3 실습 없는 차시: '우리가 한 것' = 묶음(section)마다 쪽 목록(확인함 ✓, 분류 게임 완료)
    const madeTheory = () => {
      const secs = []; L.pages.forEach((pg) => { let sc = secs.find((x) => x.name === pg.section); if (!sc) secs.push(sc = { name: pg.section, pages: [] }); sc.pages.push(pg); });
      return secs.map((sc) => { const all = sc.pages.every((pg) => state.seen[pg.id]); return `<article class="made-card${all ? ' done' : ''}"><h3><span>${esc(sc.name)}</span></h3>
        <ul class="made-list">${sc.pages.map((pg) => { const ok = !!state.seen[pg.id], gd = isGamePage(pg) && (state.widgets || {})[pg.id]; return `<li class="${ok ? 'ok' : ''}"><span class="sr">${ok ? '확인함: ' : '아직: '}</span>${esc(pg.title)}${isGamePage(pg) ? `<span class="made-meta">${gd ? '분류 게임 완료' : '분류 게임 아직'}</span>` : ''}${pg.type === 'story' ? `<span class="made-meta">${ok ? '이야기 다 봄' : '이야기 아직'}</span>` : ''}</li>`; }).join('')}</ul></article>`; }).join('');
    };
    const made = NOLAB ? madeTheory() : labs.map((lab) => {
      const ms = lab.missions, d = ms.filter((m) => state.missions[m.id]).length;
      const stars = STAR_DEFS.filter((sd) => lab[sd.key] && starDone(lab, sd)).map((sd) => `${sd.level} 도전 · ${lab[sd.key].title}${STAR_VIA[starVia(lab, sd)] ? ` (${STAR_VIA[starVia(lab, sd)]})` : ''}${note(lab.id, sd.n)}`); // 설계 개정 2: 자동 확인·선생님 확인 표시(스스로 [해냈어요]는 예전 그대로)
      // 실습을 완주하면 그 실습의 완주 배지(ChatGPT 제작), 아니면 포니봇 아이콘
      const done = d === ms.length;
      return `<article class="made-card${done ? ' done' : ''}"><h3>${done && lab.badge ? `<img class="made-badge" src="${esc(lab.badge)}" alt="완주 배지">` : lab.icon ? `<img src="${esc(lab.icon)}" alt="" aria-hidden="true">` : ''}<span>${esc(lab.title)}</span></h3>
        <ul class="made-list">${ms.map((m) => `<li class="${state.missions[m.id] ? 'ok' : ''}"><span class="sr">${state.missions[m.id] ? '완료: ' : '아직: '}</span>${esc(m.title)}${m.optional ? ' <small class="opt-tag">(선택)</small>' : ''}${meta(m)}${recLine(m) ? `<span class="made-rec"><b>측정 기록</b> ${esc(recLine(m))}</span>` : ''}${recordCompareLine(m) ? `<span class="made-rec">${esc(recordCompareLine(m))}</span>` : ''}</li>`).join('')}</ul>
        ${stars.length ? `<p class="made-stars">${stars.map((t) => `<span>${esc(t)}</span>`).join('')}</p>` : ''}</article>`;
    }).join('');
    const N = Math.min(L.quizPerRound || 10, L.quiz.length);
    const rev = [];
    if (state.quiz) { const q = state.quiz; rev.push(`<li class="${quizPass(state) ? 'ok' : ''}">${esc(L.quizTitle || '복습 퀴즈')} ${[q.first != null ? `첫 시도 ${q.first} / ${N}` : '', `최고 ${q.best} / ${N}`, q.tries ? `${q.tries}회` : ''].filter(Boolean).join(' · ')}${quizPass(state) ? ' · ✓ 통과' : ''}</li>`); }
    if (state.order && state.order.done) rev.push(`<li class="ok">${NOLAB ? '차례 맞추기' : '코드 순서 맞추기'} ✓ 완료</li>`);
    if (s.theory) rev.push(`<li>확인 문제·생각 적기 ${s.theory} / ${s.theoryTotal}</li>`);
    // 내 생각: 생각 적기 원문(길면 줄임) + 진로 생각 + 최근 예측 한 줄
    const thoughts = [];
    L.pages.forEach((pg) => {
      const t = (state.reflect || {})[pg.id]; if (pg.reflect && t && t.trim()) thoughts.push(`<li><b>${esc(pg.title)}</b> ${esc(clip(t))}</li>`);
      const c = (state.reflect || {})[`${pg.id}:career`]; if (pg.careers && c && c.trim()) thoughts.push(`<li><b>${esc(pg.careers.prompt || '진로 생각')}</b> ${esc(clip(c))}</li>`);
    });
    // ★비트런(C2~C5): 스토리 결정·투표, 딜레마 선택 → 내 생각 / 방탈출 자물쇠·길 찾기 퍼즐 → 복습 줄(시도·힌트·별)
    const gx = { tries: 0, h1: 0, h2: 0, h3: 0, n: 0 };
    L.pages.forEach((pg) => {
      const d = (state.wdata || {})[pg.id] || {}, wo = pg.widgetOpts || {};
      if (pg.type === 'story' && pg.ending && d.choice != null && (pg.ending.options || [])[d.choice] != null) thoughts.push(`<li><b>${esc(pg.ending.kind === 'vote' ? '투표' : '내 결정')} · ${esc(clip(pg.ending.q || pg.title, 60))}</b> ${esc(pg.ending.options[d.choice])}${d.reason ? ` — ${esc(clip(d.reason, 80))}` : ''}</li>`);
      if (pg.type === 'story' && pg.ending && pg.ending.kind === 'slots' && Array.isArray(d.slots)) thoughts.push(`<li><b>내 결정 · ${esc(clip(fillName(pg.ending.q || pg.title), 60))}</b> ${d.slots.map((v, si) => `${esc(((pg.ending.slots || [])[si] || {}).label || '')} ${esc((v && (v.text || v.label)) || '')}`).join(' · ')}${d.reason ? ` — ${esc(clip(d.reason, 80))}` : ''}</li>`);
      if (pg.widget === 'dilemma' && d.choice != null && (wo.options || [])[d.choice]) thoughts.push(`<li><b>${esc(clip(wo.q || pg.title, 60))}</b> ${esc(wo.options[d.choice].text)}${d.reason ? ` — ${esc(clip(d.reason, 80))}` : ''}</li>`);
      if ((pg.widget === 'escape-lock' || (pg.type === 'story' && pg.widget === 'escape-lock')) && (d.opened || d.tries)) { const hp = d.help || {}; gx.n++; gx.tries += d.tries || 0; gx.h1 += hp[1] || 0; gx.h2 += hp[2] || 0; gx.h3 += hp[3] || 0; rev.push(`<li class="${d.opened ? 'ok' : ''}">방탈출 「${esc(wo.title || pg.title)}」 ${d.opened ? `✓ ${d.helped ? '도움 받아 열었어요' : '스스로 열었어요'}` : '아직 열지 않았어요'}</li>`); }
      if (pg.widget === 'path-code' && (d.solved || d.runs)) rev.push(`<li class="${d.solved ? 'ok' : ''}">길 찾기 「${esc(wo.title || wo.goal || pg.title)}」 ${d.solved ? `${'★'.repeat(d.stars || 1)}${'☆'.repeat(3 - (d.stars || 1))} · 카드 ${d.cards}장` : '아직'} · 실행 ${d.runs || 0}번</li>`);
    });
    const lastPred = labs.flatMap((lb) => lb.missions).reverse().find((m) => String((state.predict || {})[m.id] || '').trim());
    if (lastPred) thoughts.push(`<li><b>최근 예측</b> ${esc(clip(state.predict[lastPred.id], 80))} <small>(${esc(lastPred.title)})</small></li>`);
    // 자유 만들기 한 줄: 코드가 있는 실습 + AI와 만든 기록
    const cl = state.createLog || {};
    const codeLabs = labs.filter((lb) => local.get(`ponybot:mc:${L.id}:${userId()}:${lb.id}:create`));
    const logBits = [['ask', '요청'], ['understood', '이해한 블록'], ['changed', '직접 고친 것']].filter(([k]) => String(cl[k] || '').trim()).map(([k, lb]) => `${lb}: ${esc(clip(cl[k], 50))}`);
    const createLine = codeLabs.length || logBits.length ? `<p class="result-create"><b>자유 만들기</b> ${codeLabs.length ? `${codeLabs.map((lb) => esc(labShort(lb))).join('·')} 코드 있음` : '코드 없음'}${logBits.length ? ` · ${logBits.join(' · ')}` : ''}</p>` : '';
    // 날짜 줄: 오늘 + (기록이 있으면) 첫 통과 ~ 마지막 통과
    const ats = Object.values(state.missions || {}).map((r) => (r && typeof r === 'object' ? r.at : 0)).filter((t) => t > 1e11).sort((a, b) => a - b);
    const md = (t) => { const d = new Date(t); return `${d.getMonth() + 1}. ${d.getDate()}.`; };
    const span = ats.length ? ` · 첫 통과 ${md(ats[0])}${md(ats[0]) !== md(ats[ats.length - 1]) ? ` ~ 마지막 ${md(ats[ats.length - 1])}` : ''}` : '';
    const nextStop = stops.find((x) => x.key !== 'intro' && !stopDone(x));
    const predicted = Object.values(state.predict || {}).filter(Boolean).length;
    const hintsN = Object.values(state.stats || {}).reduce((a, x) => a + ((x && x.hints) || 0), 0);
    const starN = labs.reduce((a, lb) => a + STAR_DEFS.filter((sd) => lb[sd.key] && starDone(lb, sd)).length, 0);
    const teacherLine = NOLAB ? [`확인한 쪽 ${s.theory}/${s.theoryTotal}`, s.gameTotal ? `분류 게임 ${s.games}/${s.gameTotal}` : '', HAS_QUIZ ? `퀴즈 ${quizPass(state) ? '통과' : '아직'}` : '', HAS_ORDER ? `순서 ${state.order && state.order.done ? '완료' : '아직'}` : ''].filter(Boolean).join(' · ')
      : [`자동 확인 ${s.via.check || 0}`, `스스로 ${s.via.self || 0}`, `선생님 ${s.via.teacher || 0}`, `예측 ${predicted}`, `힌트 ${hintsN}`, `★ ${starN}`].join(' · ');
    const teacherLine2 = gx.n ? ` · 방탈출 열기 시도 ${gx.tries}번 · 도움 ①${gx.h1} ②${gx.h2} ③${gx.h3}` : '';
    const prevStop = HAS_REVIEW ? { hash: '#/review', label: '복습 게임' } : stops[stops.length - 1];
    const home = `${location.origin}${location.pathname}`;
    return `<div class="page"><section class="result-card">
      <div class="result-led">${matrixHTML(p.cells, true)}${!(s.opt ? reqLeft : left) ? artImg('duoHighfive', 'result-mascot result-duo') : artImg('charge', 'result-mascot')}</div>
      <div class="result-body">
        <span class="section-tag">${esc(L.course)}</span>
        <h1>${esc(session.name)}의 결과 카드</h1>
        <p class="result-headline">${headline}</p>
        ${pn.length >= 2 ? `<p class="result-pair">함께한 짝 · ${pn.map(esc).join(' · ')}</p>` : ''}
        <p class="fine">${new Date().toLocaleDateString('ko-KR')}  ${esc(L.title)} · ${esc(PW)} ${p.lit} / 25칸${span}</p>
        <h2 class="sr">우리가 만든 것</h2>
        <div class="result-made">${made}</div>
        ${NOLAB ? '' : LEGEND_HTML}
        ${rev.length ? `<ul class="result-review">${rev.join('')}</ul>` : ''}
        ${thoughts.length ? `<section class="result-thoughts"><h2>내 생각</h2><ul>${thoughts.join('')}</ul></section>` : ''}
        ${createLine}${L.episodeMap && L.episodeMap.notebook && L.notebook ? notebookHTML(L.episodeMap, true) : ''}
        ${HAS_REVIEW && !state.quiz && !(state.order && state.order.done) ? '<p class="result-next"><a href="#/review">복습 게임 해 보기</a></p>' : ''}
        ${nextStop ? `<p class="result-next">다음에 이어서: <a href="${nextStop.hash}">${esc(nextStop.label)}</a></p>` : `<p class="result-next">${NOLAB ? '오늘 수업을 모두 마쳤어요.' : '오늘 수업을 모두 마쳤어요. 선생님과 로봇으로 확인해요.'}</p>`}
        <div class="result-actions"><button class="btn ghost small" type="button" data-me-print>결과 카드 인쇄</button><button class="btn ghost small" type="button" data-me-erase>이 기기에서 내 기록 지우기</button></div>
        <div class="print-only result-sign" aria-hidden="true"><p>선생님 확인 ☐ 로봇 시연 봄 ☐ 설명 들음 · 날짜 ________ · 서명 ________</p><p>집에서 복습: ${esc(home)} · 이론·복습 게임 · 기록은 기기마다 따로</p></div>
        <p class="result-teacher">선생님 참고용 · 이 기기 기록 · ${teacherLine}${teacherLine2}</p>
        <p class="result-store">이 기기에만 저장 · 30일 쓰지 않으면 지워져요</p>
        <p class="result-brand"><img class="bx-logo" src="${CORE}assets/brand/boundaryx-logo.png" alt="boundaryX" height="18"><span>${esc(L.brand)} 교육</span></p>
      </div></section></div>
      <nav class="pager" aria-label="페이지 이동"><a class="btn" href="${prevStop.hash}" data-nav="prev" aria-label="이전: ${esc(prevStop.label)}">이전</a><div class="where">내 결과 카드</div><button class="btn primary" type="button" data-me-exit>수업 마치기</button></nav>`;
  }

  /* ---------- 교사 대시보드 ---------- */
  const ago = (t) => { if (!t) return '-'; const s = Math.round((Date.now() - t) / 1000); if (s < 60) return '방금'; if (s < 3600) return `${Math.floor(s / 60)}분 전`; if (s < 86400) return `${Math.floor(s / 3600)}시간 전`; return new Date(t).toLocaleDateString('ko-KR'); };
  function deleteStudent(key) { local.del(K.prog(key)); window.MC.clearAll(key); const u = users(); delete u[key]; local.set(K.users, u); }
  // 30일 넘게 쓰지 않은 이 기기의 학생 기록은 앱이 열릴 때 조용히 지운다(공용 PC에 실명이 쌓이지 않게, 8차). 지금 들어와 있는 학생은 빼고
  function autoCleanOld() { try { const cut = Date.now() - 30 * 86400000; Object.entries(users()).filter(([k, u]) => k !== (session && session.key) && (u.last || u.created || 0) < cut).forEach(([k]) => deleteStudent(k)); } catch (e) {} }
  /* ---------- 9차 A: 교사 화면 도우미 ---------- */
  // 교사 자료(암호화된 교사 메모, lesson.js 교사 안내)는 우리가 쓴 HTML이지만 <script>·on* 속성·javascript: 주소는 걸러 낸다
  function safeHTML(s) {
    const t = document.createElement('template'); t.innerHTML = String(s ?? '');
    t.content.querySelectorAll('script, style, iframe, frame, object, embed, link, meta, base, form').forEach((e) => e.remove());
    t.content.querySelectorAll('*').forEach((el) => [...el.attributes].forEach((at) => {
      const n = at.name.toLowerCase();
      if (n.startsWith('on') || n === 'srcdoc' || (/^(href|src|xlink:href|action|formaction)$/.test(n) && /^\s*(javascript|vbscript|data:text\/html)/i.test(at.value))) el.removeAttribute(at.name);
    }));
    return t.innerHTML;
  }
  const plainText = (s) => String(s ?? '').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();
  // 교사 메모(9차 D7): 옛 형식 문자열 또는 { ask, miscon, qa, terms, hw } → '교사용' 칸 안에 작은 제목 + 내용(값은 HTML 또는 줄 목록)
  const NOTE_PARTS = [['ask', '핵심 발문'], ['miscon', '흔한 오개념'], ['qa', '예상 질문'], ['terms', '교과 용어'], ['hw', '하드웨어 보충']];
  // kind = 'card'(10차 T): 이론 페이지에서 본문 카드 밖의 별도 전체 폭 카드(.tnote-card, 교사만). 그 밖(대시보드 실습 메모)은 예전 '교사용' 칸
  function teacherNoteHTML(note, kind) {
    if (!note) return '';
    const card = kind === 'card';
    const cls = card ? 'tnote-card teacher-only tnote' : 'callout teacher-only tnote';
    const title = card ? '<b class="tnote-title">교사 메모 <small>교사 화면에만 보여요</small></b>' : '<b class="tnote-title">교사용</b>';
    const val = (v) => (Array.isArray(v) ? `<ul>${v.map((x) => `<li>${safeHTML(x)}</li>`).join('')}</ul>` : safeHTML(v));
    if (typeof note !== 'object' || Array.isArray(note)) return `<div class="${cls}">${card ? `${title}<div class="tnote-body">${val(note)}</div>` : `<b>교사용</b> ${val(note)}`}</div>`;
    const parts = NOTE_PARTS.filter(([key]) => note[key] && String(note[key]).trim()).map(([key, t]) => `<div class="tnote-part tnote-${key}"><h4>${t}</h4><div class="tnote-body">${val(note[key])}</div></div>`).join('');
    return parts ? `<div class="${cls} has-parts">${title}${parts}</div>` : '';
  }
  // 교사 설정 '더 자세히 알아보기 펼쳐 두기'(9차 D13): 화면을 그린 뒤 DOM에서만 연다(이론 출력 문자열은 그대로). force = 설정을 바꾼 그 자리(끄면 접기)
  // 10차 T: 대상은 본문 줄 아래의 '더 자세히 알아보기' 카드(details.deep.deep-card)
  function applyDeep(root, force) {
    if (!root || !session || !isTeacher() || (!prefs.deepOpen && !force)) return;
    $$('details.deep', root).forEach((d) => { d.open = !!prefs.deepOpen; });
  }

  /* 수업 계획(9차 D3): teacherGuide.plans가 있으면 고르기(라디오 묶음, 고른 것은 prefs.planId) + 필수/선택·끊는 줄·빠른 모둠 도전.
   * 없으면 예전 80분 표(40분 1교시 끝 줄). 줄마다 [여기서 투사] */
  // 줄의 페이지 주소: hash가 있으면 그것(교사가 열 수 없는 #/me는 빼고). strict(계획 데이터가 hash를 주는 경우)면 hash 없는 줄은 링크 없음, 아니면 페이지 이름으로 찾기(옛 80분 표)
  function planHash(r, strict) {
    if (r.hash) return validHash(r.hash) && r.hash !== '#/me' ? r.hash : '';
    if (strict) return '';
    const t = plainText(r.pages); if (!t) return '';
    if (/^수업 소개/.test(t)) return '#/intro';
    const exact = stops.find((s) => s.section === t || s.label === t); if (exact) return exact.hash;
    const sec = stops.find((s) => s.key !== 'intro' && s.section && t.startsWith(s.section)); if (sec) return sec.hash;
    const lb = t.match(/실습\s*(\d)/); if (lb && labs[+lb[1] - 1]) return stops.find((s) => s.key === labs[+lb[1] - 1].id).hash;
    if (/복습/.test(t)) return '#/review';
    const any = stops.find((s) => s.key !== 'intro' && t.includes(s.label)); return any ? any.hash : '';
  }
  const presentAtBtn = (hh) => (hh ? `<button class="btn small ghost" type="button" data-present-at="${esc(hh)}">여기서 투사</button>` : '');
  // 설계 개정 2: 계획 줄의 look(볼 곳) — 줄 하나라도 있으면 '볼 곳' 칸을 더한다(없으면 예전 표 그대로)
  const lookOf = (r) => { const t = plainText(r && r.look); return t && !/^[-–—]$/.test(t) ? r.look : ''; };
  const planTable = (rows, look) => `<div class="tbl-wrap"><table class="tbl plan-tbl${look ? ' has-look' : ''}"><thead><tr><th>시간(분)</th><th>활동</th><th>페이지</th>${look ? '<th>볼 곳</th>' : ''}<th><span class="sr">투사</span></th></tr></thead><tbody>${rows}</tbody></table></div>`;
  const planRow = (r, tag = '', strict = false, look = false) => { const hh = planHash(r, strict); return `<tr class="${r.opt ? 'plan-opt' : ''}"><td>${esc(r.min)}</td><td>${tag}${safeHTML(noVibeText(r.act))}</td><td>${r.pages ? (hh ? `<a href="${esc(hh)}">${esc(plainText(r.pages))}</a>` : esc(plainText(r.pages))) : ''}</td>${look ? `<td class="plan-look">${lookOf(r) ? safeHTML(r.look) : ''}</td>` : ''}<td>${presentAtBtn(hh)}</td></tr>`; };
  /* '오늘 볼 곳' 띠(설계 7.7): 교사 화면에서 고른 계획의 줄 중 이 쪽(hash)으로 가는 줄의 look을 쪽 위에. 교사로 들어왔을 때만(투사 화면) */
  function lookBandHTML(hash) {
    if (!isTeacher()) return '';
    const plans = planList(); if (!plans.length) return '';
    const cur = curPlan(plans), strict = cur.rows.some((r) => r.hash);
    const rows = cur.rows.filter((r) => lookOf(r) && planHash(r, strict) === hash); if (!rows.length) return '';
    return `<aside class="look-band" aria-label="오늘 볼 곳"><b class="lb-title">오늘 볼 곳</b><ul>${rows.map((r) => `<li><span class="lb-min">${esc(r.min)}분</span> ${safeHTML(r.look)}</li>`).join('')}</ul><span class="lb-plan">${esc(plainText(cur.label || cur.id))}</span></aside>`;
  }
  const planList = () => { const g = L.teacherGuide || {}; return Array.isArray(g.plans) ? g.plans.filter((p) => p && p.id && Array.isArray(p.rows) && p.rows.length) : []; };
  const curPlan = (plans) => plans.find((p) => p.id === prefs.planId) || plans.find((p) => p.id === (L.teacherGuide || {}).defaultPlan) || plans[0];
  function legacyPlanRows(plan) {
    const range = (r) => String(r.min).split(/[–~-]/).map((x) => +x);
    let breakDone = false;
    return (plan || []).map((r) => {
      const [a, b] = range(r);
      let row = planRow(r);
      if (!breakDone && !r.break && b >= 40) {
        breakDone = true;
        row += `<tr class="plan-break"><td colspan="4">40분 · 1교시 끝, 쉬는 시간${a < 40 && b > 40 ? ' (위 활동 중간에 끊어요)' : ''} — 학생은 같은 기기·같은 브라우저로 들어오면 이어서 해요</td></tr>`;
      }
      return row;
    }).join('');
  }
  // 바이브코딩을 끈 배포(--no-vibe)에서는 계획 글의 '(바이브코딩…)' 괄호를 지운다
  const noVibeText = (t) => (vibeEnabled() ? t : String(t || '').replace(/\s*\([^()]*바이브코딩[^()]*\)/g, ''));
  function planBodyHTML(plan) {
    const cuts = Array.isArray(plan.cuts) ? plan.cuts : [];
    const look = plan.rows.some(lookOf);
    const cut = (c) => `<tr class="plan-break"><td colspan="${look ? 5 : 4}">${safeHTML(c.text)}</td></tr>`;
    const tag = (r) => (r.opt ? '<span class="plan-tag opt">선택</span>' : '<span class="plan-tag must">필수</span>');
    const strict = plan.rows.some((r) => r.hash); // 계획 데이터가 줄마다 hash를 주면 그것만 믿는다
    const rows = plan.rows.map((r, i) => cuts.filter((c) => +c.before === i).map(cut).join('') + planRow(r, tag(r), strict, look)).join('')
      + cuts.filter((c) => !(+c.before >= 0 && +c.before < plan.rows.length)).map(cut).join('');
    return `<p class="plan-who"><b>${esc(plan.label || plan.id)}</b>${plan.who ? ` · ${esc(plan.who)}` : ''}</p>
      ${planTable(rows, look)}
      <p class="fine plan-legend"><span class="plan-tag must">필수</span> 꼭 하는 활동 · <span class="plan-tag opt">선택</span> 시간이 남으면 하는 활동 · 색칠한 줄은 끊는 지점</p>
      ${plan.fast ? `<p class="plan-fast">${safeHTML(noVibeText(plan.fast))}</p>` : ''}
      ${plan.note ? `<p class="fine plan-note">${safeHTML(noVibeText(plan.note))}</p>` : ''}`;
  }
  /* 시작 코드 번호(페르소나 2회차 #5): 차시가 assistStarter를 켰고 정답 봉투에 starterPins(build.js --starter-pin)가 있으면
   * 수업 계획 제목 옆에 "시작 코드 번호: ****"(교사 화면만, 눌러서 보기). 칠판에 적어 두면 모둠이 선생님 줄을 서지 않고 시작 코드를 연다(통과 처리는 도움 번호만) */
  function starterPinChipHTML() {
    const pins = L.assistStarter && ((window.Auth.answers() || {}).starterPins || []);
    if (!isTeacher() || !pins || !pins.length) return '';
    return `<span class="starter-pin" title="학생 기기의 [이 미션 시작 코드로 시작]에서만 쓰는 번호예요. 통과 처리는 도움 번호로만 돼요">시작 코드 번호: <button type="button" class="link-btn" data-starter-pin="${esc(pins.join(', '))}" aria-pressed="false" aria-label="시작 코드 번호 보기">${'*'.repeat(4)}</button></span>`;
  }
  function planCardHTML(g) {
    const plans = planList();
    if (!plans.length) return `<section class="dash-card wide dash-plan" id="dashPlan"><h3>80분 수업 계획${starterPinChipHTML()}</h3>${planTable(legacyPlanRows(g.plan))}</section>`;
    const cur = curPlan(plans);
    return `<section class="dash-card wide dash-plan" id="dashPlan"><h3>수업 계획${starterPinChipHTML()}</h3>
      <p class="fine">우리 학교 시간표에 맞는 계획을 골라요. 고른 계획은 이 기기에 기억돼요.</p>
      <div class="plan-pick" role="radiogroup" aria-label="수업 계획 고르기">${plans.map((p) => `<button type="button" role="radio" class="plan-choice" data-plan="${esc(p.id)}" aria-checked="${p === cur}" tabindex="${p === cur ? 0 : -1}">${esc(p.label || p.id)}</button>`).join('')}</div>
      <div class="plan-body" id="planBody">${planBodyHTML(cur)}</div>
    </section>`;
  }
  function selectPlan(dash, id, focus) {
    const p = planList().find((x) => x.id === id); if (!p) return;
    prefs.planId = id; savePrefs();
    $$('[data-plan]', dash).forEach((b) => { const on = b.dataset.plan === id; b.setAttribute('aria-checked', String(on)); b.tabIndex = on ? 0 : -1; if (on && focus) b.focus(); });
    const body = $('#planBody', dash); if (body) body.innerHTML = planBodyHTML(p);
    announce(`${plainText(p.label || p.id)} 계획을 보여 줘요.`);
  }

  /* 학교망 준비(9차 D1): 허용 주소 목록(teacherGuide.network) 표 + [목록 복사] + [학교망 접속 점검](주소마다 no-cors 요청, 6초) + MakeCode 점검 페이지 */
  const netHostList = () => { const n = (L.teacherGuide || {}).network; return n && Array.isArray(n.hosts) ? n.hosts.filter((x) => x && x.host && (vibeEnabled() || !/vibe-coding-proxy/.test(x.host))) : []; }; // 대시보드용(바이브코딩을 끄면 그 주소는 뺌) {host, use, must, probe} (B의 netHosts()는 주소 글자만)
  function netCardHTML(g) {
    const net = g.network, hosts = netHostList(); if (!hosts.length) return '';
    const test = net.testPage && /^https?:\/\//.test(net.testPage) ? net.testPage : '';
    return `<section class="dash-card wide dash-net" id="dashNet"><h3>학교망 준비</h3>
      ${net.intro ? `<p>${safeHTML(net.intro)}</p>` : ''}
      <div class="tbl-wrap"><table class="tbl net-tbl"><thead><tr><th>주소</th><th>쓰임</th><th>꼭/선택</th><th>접속 점검</th></tr></thead><tbody>
      ${hosts.map((x, i) => `<tr data-host="${i}"><td><code>${esc(x.host)}</code></td><td>${safeHTML(x.use || '')}</td><td>${x.must ? '<span class="plan-tag must">꼭</span>' : '<span class="plan-tag opt">선택</span>'}</td><td class="net-res" data-res="idle"><span class="fine">아직 안 함</span></td></tr>`).join('')}
      </tbody></table></div>
      <div class="dash-actions"><button class="btn" type="button" data-net="copy">목록 복사</button><button class="btn primary" type="button" data-net="probe">학교망 접속 점검</button>${test ? `<a class="btn ghost" href="${esc(test)}" target="_blank" rel="noopener">MakeCode 점검 페이지 (새 탭)</a>` : ''}</div>
      <p class="net-sum" id="netSum" role="status"></p>
      <p class="fine">✓는 주소가 응답했다는 뜻이에요(학교 필터의 차단 안내 페이지도 응답할 수 있어요). 마지막 확인은 MakeCode 점검 페이지를 학생 계정 PC에서 열어 봐요.</p>
      <p class="fine">학생 PC에서 해 보려면 그 PC에서 교사로 들어가 이 단추를 누르세요. 끝나면 [나가기]를 눌러요.</p>
    </section>`;
  }
  // 정보부·교육청에 보낼 글: copyText 앞뒤 글 + 주소 줄. copyText는 문자열('{hosts}' 자리 표시 가능)·[앞, 뒤]·{ before, after }
  function netCopyText() {
    const net = (L.teacherGuide || {}).network || {}, c = net.copyText;
    const lines = netHostList().map((x) => `- ${x.host}${x.use ? ` : ${plainText(x.use)}` : ''}${x.must ? ' (꼭)' : ' (선택)'}`).join('\n');
    if (Array.isArray(c)) return [plainText(c[0]), lines, plainText(c[1])].filter(Boolean).join('\n\n');
    if (c && typeof c === 'object') return [plainText(c.before || c.head), lines, plainText(c.after || c.tail)].filter(Boolean).join('\n\n');
    if (typeof c === 'string' && c.includes('{hosts}')) return plainText(c).split('{hosts}').join(lines);
    return [plainText(c), lines].filter(Boolean).join('\n\n');
  }
  async function copyPlain(text) {
    try { if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(text); return true; } } catch (e) {}
    try { const ta = h('<textarea readonly style="position:fixed;left:-9999px;top:0"></textarea>'); ta.value = text; document.body.append(ta); ta.select(); const ok = document.execCommand('copy'); ta.remove(); return ok; } catch (e) { return false; }
  }
  async function netCopy() {
    const text = netCopyText();
    if (await copyPlain(text)) { toast('허용 주소 목록을 복사했어요. 정보부·교육청에 보낼 글에 붙여 넣어요.', 'ok'); return; }
    // 복사가 막힌 브라우저: 글을 보여 주고 직접 복사
    const m = modal(`<h2>목록 복사</h2><p class="fine">자동 복사가 막혔어요. 아래 글을 모두 골라 복사해요(Ctrl + A, Ctrl + C).</p><textarea class="net-copy" rows="12" readonly>${esc(text)}</textarea><div class="modal-actions"><button class="btn primary" type="button" data-close>닫기</button></div>`);
    const ta = $('textarea', m); if (ta) { ta.focus(); ta.select(); }
  }
  const NET_TIMEOUT = 6000;
  function probeHost(x) {
    // probe: null(또는 빈 값)이면 점검하지 않는다(https로 못 여는 주소 등). probe가 아예 없으면 https://주소/favicon.ico
    const url = 'probe' in x ? x.probe : /^[a-z0-9.-]+$/i.test(x.host) ? `https://${x.host}/favicon.ico` : '';
    if (!url) return Promise.resolve('skip');
    const ac = window.AbortController ? new AbortController() : null;
    let timer = 0;
    const timeout = new Promise((res) => { timer = setTimeout(() => { if (ac) ac.abort(); res('timeout'); }, NET_TIMEOUT); });
    // no-cors: 내용은 못 읽지만, 응답이 오면 성공·막히면(차단·주소 못 찾음) 실패로 끝난다
    const req = fetch(url, { mode: 'no-cors', cache: 'no-store', credentials: 'omit', signal: ac ? ac.signal : undefined }).then(() => 'ok', () => 'fail');
    return Promise.race([req, timeout]).finally(() => clearTimeout(timer));
  }
  const NET_RES = {
    wait: '<span class="net-wait">확인 중…</span>',
    ok: '<span class="net-ok">✓ 응답</span>',
    fail: '<span class="net-bad">✗ 막힘<span class="sr"> (응답 없음)</span></span>',
    timeout: '<span class="net-bad">✗ 6초 동안 응답 없음</span>',
    skip: '<span class="fine">점검 안 함<span class="sr"> (MakeCode 점검 페이지에서 확인)</span></span>',
  };
  async function netProbe(dash, btn) {
    if (btn.disabled) return;
    const hosts = netHostList(), sum = $('#netSum', dash);
    btn.disabled = true; btn.textContent = '점검 중…';
    const cell = (i) => $(`tr[data-host="${i}"] .net-res`, dash);
    const setRes = (i, r) => { const c = cell(i); if (c) { c.dataset.res = r; c.innerHTML = NET_RES[r] || ''; } };
    hosts.forEach((x, i) => setRes(i, 'wait'));
    if (sum) sum.textContent = `주소 ${hosts.length}개를 점검하는 중이에요(주소마다 최대 6초).`;
    const res = await Promise.all(hosts.map((x, i) => probeHost(x).then((r) => { setRes(i, r); return r; })));
    if (!dash.isConnected) return;
    btn.disabled = false; btn.textContent = '다시 점검';
    const count = (must) => { const idx = hosts.map((x, i) => i).filter((i) => !!hosts[i].must === must && res[i] !== 'skip'); return [idx.filter((i) => res[i] === 'ok').length, idx.length]; };
    const [mOk, mN] = count(true), [oOk, oN] = count(false);
    const bad = hosts.filter((x, i) => x.must && (res[i] === 'fail' || res[i] === 'timeout'));
    const head = `${new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })} 점검: 꼭 필요한 주소 ${mOk}/${mN}개 ✓${oN ? ` · 선택 주소 ${oOk}/${oN}개 ✓` : ''}`;
    const tail = bad.length ? ` — ✗ 주소(${bad.map((x) => x.host).join(', ')})는 정보부(전산 담당)에 허용을 요청하세요. [목록 복사]로 보낼 글을 만들 수 있어요.`
      : ' — 이 PC에서는 꼭 필요한 주소가 모두 응답했어요. 학생 계정 PC에서도 한 번 더 확인해 봐요.';
    if (sum) { sum.textContent = head + tail; sum.classList.toggle('bad', !!bad.length); }
  }

  // 목록 카드: 4줄까지 보이고 나머지는 '더 보기'로 접는다(대시보드가 길어지지 않게)
  function listCard(title, items, opt = {}) {
    const arr = (Array.isArray(items) ? items : items ? [items] : []).filter(Boolean);
    if (!arr.length && !opt.always) return ''; // 데이터가 없으면 카드째 그리지 않는다
    const max = opt.max || 4, head = arr.slice(0, max), rest = arr.slice(max), li = (t) => `<li>${safeHTML(t)}</li>`;
    return `<section class="dash-card${opt.cls ? ` ${opt.cls}` : ''}"><h3>${title}</h3>${opt.body || ''}${head.length ? `<ul>${head.map(li).join('')}</ul>` : ''}${rest.length ? `<details class="dash-more"><summary>${rest.length}개 더 보기</summary><ul>${rest.map(li).join('')}</ul></details>` : ''}${opt.foot || ''}</section>`;
  }
  function curriculumHTML(g) {
    const c = g.curriculum, rows = c && Array.isArray(c.rows) ? c.rows : [];
    if (!rows.length) return '';
    return `<section class="dash-card wide dash-cur"><h3>교과별 영역·개념</h3>
      <div class="tbl-wrap"><table class="tbl cur-tbl"><thead><tr><th>학교급·교과</th><th>영역</th><th>개념</th><th>이 수업의 페이지</th></tr></thead><tbody>
      ${rows.map((r) => `<tr><td>${esc(plainText(r.level))}</td><td>${safeHTML(r.area)}</td><td>${safeHTML(r.concepts)}</td><td>${safeHTML(r.pages)}</td></tr>`).join('')}</tbody></table></div>
      ${c.note ? `<p class="fine">${safeHTML(c.note)}</p>` : ''}</section>`;
  }
  // 정답 모음 A4 인쇄(9차 D17·M2-13): 정답 모음만 남기고 모든 미션을 펼쳐 인쇄, 끝나면 원래대로
  // 11~12: 카드 하나만 인쇄(body 클래스 → CSS @media print). printAnswers와 같은 끝내기 규칙
  function printOnly(cls) {
    let done = false;
    const end = () => { if (done) return; done = true; document.body.classList.remove(cls); window.removeEventListener('afterprint', end); document.removeEventListener('pointerdown', end, true); document.removeEventListener('keydown', end, true); };
    document.body.classList.add(cls); window.addEventListener('afterprint', end);
    try { window.print(); } catch (e) { end(); }
    setTimeout(() => { if (!done) { document.addEventListener('pointerdown', end, true); document.addEventListener('keydown', end, true); } }, 0);
  }
  function printAnswers(dash) {
    const box = $('.dash-answers', dash); if (!box) return;
    const ds = $$('details', box), was = ds.map((d) => d.open);
    let done = false;
    const end = () => {
      if (done) return; done = true; document.body.classList.remove('print-answers'); ds.forEach((d, i) => { d.open = was[i]; });
      window.removeEventListener('afterprint', end); document.removeEventListener('pointerdown', end, true); document.removeEventListener('keydown', end, true);
    };
    ds.forEach((d) => { d.open = true; });
    document.body.classList.add('print-answers');
    window.addEventListener('afterprint', end);
    try { window.print(); } catch (e) { end(); }
    // afterprint가 오지 않는 브라우저(앱 안 브라우저 등): 인쇄 창이 닫힌 뒤 화면을 처음 누르거나 키를 칠 때 원래대로(인쇄 전용 규칙이라 화면 모양은 그대로)
    setTimeout(() => { if (!done) { document.addEventListener('pointerdown', end, true); document.addEventListener('keydown', end, true); } }, 0);
  }

  /* 교사 대시보드(9차 정보 구조): 수업 시작(투사·계획) → 수업 전 준비(망·기기·안전) → 수업 중(모둠·지도 팁·바이브코딩) → 평가·기록 → 교과 연결 → 정답 모음.
   * 깔끔한 흰 카드(위 색 줄·그라데이션 테두리 없음), 긴 목록은 '더 보기'로 접는다. C의 새 데이터가 없으면 그 칸은 그리지 않는다 */
  function viewTeacher() {
    const g = L.teacherGuide || {}; const A = window.Auth.answers() || { missions: {}, notes: {} };
    const totalM = labs.reduce((a, l) => a + l.missions.length, 0);
    // 수업 시작 줄: 투사 시작(이어서 볼 페이지로 바로 이동) · 미션 구성 (UI/UX 5차 08 P1-6)
    const resumeHash = validHash(sess.get(K.tlast)) ? sess.get(K.tlast) : '#/intro';
    const resumeLabel = stopLabel(resumeHash) || '수업 소개';
    const presentTxt = g.present
      ? [].concat(g.present).map((t, i) => `<p${i ? ' class="fine"' : ''}>${safeHTML(t)}</p>`).join('')
      : `<p>글씨와 화면을 함께 키워 전자칠판에 띄워요. 화면 배치(목차·본문)는 일반 화면과 같아요. 정답과 교사 메모는 숨겨지고, 보여 줄 때는 위쪽 [정답 보이기]를 눌러요(페이지를 넘기면 다시 숨겨져요).</p>
        <p class="fine">클리커(PageDown·PageUp)나 키보드 ← →로 넘겨요. 확인 문제 보기나 [정답 공개]를 누른 뒤에도 ← →로 넘어가요. 투사를 켜면 정답 모음은 이 화면에서 숨겨져요.</p>`;
    const ctrlLine = /Ctrl/.test([].concat(g.present || '').join(' ')) ? '' : '<p class="fine">1366 노트북을 미러링하는 교실이면 Ctrl + 로 더 키워요(배치는 그대로).</p>';
    const start = `<div class="dash-grid dash-start">
        <section class="dash-card"><h3>투사 모드</h3>${presentTxt}${ctrlLine}
          <p class="fine">원리 설명 때 '더 자세히 알아보기' 카드를 펼친 채로 보여 주려면 목차 아래 [더 자세히 알아보기 펼쳐 두기]를 눌러요.</p>
          <div class="dash-actions"><button class="btn gradient" type="button" data-dash="present">${prefs.present ? '투사 화면으로' : '투사 시작'}: ${esc(resumeLabel)}</button></div></section>
        ${NOLAB ? `<section class="dash-card"><h3>수업 구성</h3><div class="dash-stat"><b>${L.pages.length}</b><span>${L.pages.some((pg) => pg.type === 'story') ? `쪽(이야기 ${L.pages.filter((pg) => pg.type === 'story').length} · 이론 ${L.pages.filter((pg) => pg.type !== 'story').length})` : '쪽 이론'} · ${[`확인 문제 ${L.pages.filter((pg) => pg.check).length}개`, L.pages.some(isGamePage) ? `분류 게임 ${L.pages.filter(isGamePage).length}개` : '', L.pages.some((pg) => ['escape-lock', 'path-code', 'dilemma'].includes(pg.widget)) ? `미션 게임 ${L.pages.filter((pg) => ['escape-lock', 'path-code', 'dilemma'].includes(pg.widget)).length}개` : '', HAS_QUIZ ? `퀴즈 ${L.quiz.length}문항` : '', HAS_ORDER ? `순서 맞추기 ${L.order.length}개` : ''].filter(Boolean).join(' · ')}</span></div><p class="fine">실습이 없는 이론 차시예요. 학생 진행은 확인 문제·분류 게임·복습 게임으로 쌓여요.</p></section>`
          : `<section class="dash-card"><h3>미션 구성</h3><div class="dash-stat"><b>${totalM}</b><span>개 미션 · 실습 ${labs.length}개</span></div><p class="fine">각 실습 화면에서 정답 코드 열기, 시작 코드 불러오기를 할 수 있어요.</p></section>`}
      </div>${planCardHTML(g)}`;
    // 11~12차시: 실물 준비물(teacherGuide.materials, 마이크로비트 2개·블루투스 기기 등)·모둠별 라디오 그룹 번호표(teacherGuide.groupNumbers). 없는 차시는 그리지 않음
    const prepCards = [listCard('준비물·기기', g.prepare), listCard('실물 준비물 (모둠마다)', g.materials, { max: 8 }), listCard('교사 10분 체험·로봇 점검', g.firstRun), listCard('안전 (교사용)', g.safety)].join('');
    const gn = g.groupNumbers, gnN = gn ? Math.max(1, Math.min(40, gn.count | 0 || 15)) : 0, gn0 = gn && gn.start != null ? gn.start | 0 : 1;
    const groupCard = gn ? `<section class="dash-card wide group-numbers"><div class="dash-card-head"><h3>${esc(gn.title || '모둠별 라디오 그룹 번호표')}</h3><button class="btn small ghost" type="button" data-print-groups>번호표 인쇄 (A4)</button></div>${gn.note ? `<p class="fine">${safeHTML(gn.note)}</p>` : ''}<table class="gn-table"><thead><tr><th scope="col">모둠</th><th scope="col">라디오 그룹 번호</th><th scope="col">조종용·제어용 둘 다</th></tr></thead><tbody>${Array.from({ length: gnN }, (_, i) => `<tr><td>${i + 1}모둠</td><td><b>${gn0 + i}</b></td><td>radio.setGroup(${gn0 + i})</td></tr>`).join('')}</tbody></table></section>` : '';
    const prep = netCardHTML(g) + (prepCards ? `<div class="dash-grid">${prepCards}</div>` : '') + groupCard;
    const vibe = vibeEnabled() && !NOLAB ? listCard('바이브코딩 스튜디오', g.vibe, { max: 4, always: true, body:`<p>한국어로 원하는 동작을 쓰면 AI가 MakeCode 블록을 만들어 줘요. 실습 미션을 모두 마친 학생의 <b>자유 만들기</b> 공간에서만 열려요(교사는 실습 화면 툴바의 [자유 만들기]). 미션 코드에는 쓸 수 없어요.</p>
          <p class="fine">스튜디오 오른쪽 위 설정(⚙)에 바운더리엑스에서 안내받은 접속키를 넣어요. 접속키는 그 화면에만 있고 기기에 저장되지 않아서, 새로 고치거나 수업을 마치면 다시 넣어야 해요.</p>` }) : '';
    const during = [listCard('모둠·짝 운영', g.groups), listCard('지도 팁', g.tips), vibe].join('');
    const evalRec = [listCard('수행평가에 쓰려면', g.assess, { body: '<p class="fine">서버 없이 쓰는 방법이에요. 기록은 학생 기기에만 있어요.</p>' }), listCard('기록 보관', g.records)].join('');
    const answers = NOLAB ? '' : `<section class="dash-card wide dash-answers"><div class="dash-card-head"><h3>미션 정답 (블록 그림·코드)</h3><button class="btn small ghost" type="button" data-print-answers>정답 모음 인쇄 (A4)</button></div>
        <p class="fine">모둠을 돌 때 들고 다닐 종이 정답이에요. 인쇄하면 모든 미션이 펼쳐져 나와요.</p>
        <div class="answer-key">${labs.map((lab) => {
          const ln = (A.notes || {})[lab.id];
          return `<h4>${esc(lab.title)}</h4>${ln ? `<details class="tnote-lab"><summary>교사 메모 · ${esc(labShort(lab))}</summary>${teacherNoteHTML(ln)}</details>` : ''}${lab.missions.map((m, i) => { const a = (A.missions || {})[m.id]; return `<details class="ans"><summary>미션 ${i + 1}. ${esc(m.title)}</summary>${a ? `${a.answerImg ? `<img src="${a.answerImg}" alt="미션 ${i + 1} 정답 블록 그림" loading="lazy">` : ''}<pre>${esc(a.answerTs)}</pre>` : '<p class="fine">정답 자료가 없어요.</p>'}</details>`; }).join('')}`;
        }).join('')}</div>
      </section>`;
    const secs = [
      ['dashStart', '수업 시작', start],
      ['dashPrep', '수업 전 준비', prep],
      ['dashClass', '수업 중', during ? `<div class="dash-grid">${during}</div>` : ''],
      ['dashEval', '평가·기록', evalRec ? `<div class="dash-grid">${evalRec}</div>` : ''],
      ['dashCur', '교과 연결', curriculumHTML(g)],
      ['dashAns', '정답 모음', answers, 'dash-answers-sec'], // 투사 중에는 차례 단추와 함께 숨김
    ].filter(([, , body]) => body);
    return `<div class="page dash">
      ${artImg('runmoreGuide', 'dash-guide')}<span class="section-tag">교사 모드</span>
      <h1>교사 대시보드</h1>
      <p class="lead">정답과 수업 운영 도구는 교사 모드에서만 보여요. 정답은 암호화되어 있어 교사 비밀번호로만 열려요.</p>
      <nav class="dash-toc" aria-label="대시보드 차례">${secs.map(([id, t, , cls]) => `<button type="button" class="btn small ghost${cls ? ' dash-hide-present' : ''}" data-jump="${id}">${t}</button>`).join('')}</nav>
      ${secs.map(([id, t, body, cls]) => `<section class="dash-sec${cls ? ` ${cls} dash-hide-present` : ''}" aria-labelledby="${id}"><h2 id="${id}" tabindex="-1">${t}</h2>${body}</section>`).join('')}
      <div class="dash-grid dash-foot">
        <section class="dash-card dash-support"><div class="bx-lockup"><img class="bx-logo" src="${CORE}assets/brand/boundaryx-logo.png" alt="boundaryX" height="24"></div>
          <p>${esc(L.brand)} 교육 콘텐츠 · ${esc(L.course)}</p>
          <p class="fine">교구·수업 문의는 바운더리엑스로 연락해 주세요.</p></section>
      </div>
    </div>`;
  }
  // 투사를 켜면 대시보드(학생 이름·정답)를 칠판에 남기지 않고 수업 화면으로 간다(08 P1-6)
  function presentGo(to) {
    if (!prefs.present) tool('present');
    const target = validHash(to) ? to : '#/intro';
    if (location.hash === target) route(); else location.hash = target;
  }
  function bindTeacher(root) {
    const dash = $('.page.dash', root); if (!dash) return; // 매번 새로 그려지는 대시보드에만 건다(#view에 걸면 들어올 때마다 쌓임)
    dash.addEventListener('click', (e) => {
      const t = e.target.closest('button'); if (!t || !dash.contains(t)) return;
      if (t.dataset.dash === 'present') presentGo(sess.get(K.tlast) || '#/intro');
      else if (t.dataset.presentAt) presentGo(t.dataset.presentAt);
      else if (t.dataset.plan) selectPlan(dash, t.dataset.plan);
      else if (t.dataset.starterPin != null) { const on = t.getAttribute('aria-pressed') !== 'true'; t.setAttribute('aria-pressed', String(on)); t.textContent = on ? t.dataset.starterPin : '****'; t.setAttribute('aria-label', on ? `시작 코드 번호 ${t.dataset.starterPin}, 눌러서 가리기` : '시작 코드 번호 보기'); }
      else if (t.dataset.net === 'copy') netCopy();
      else if (t.dataset.net === 'probe') netProbe(dash, t);
      else if (t.hasAttribute('data-print-answers')) printAnswers(dash);
      else if (t.hasAttribute('data-print-groups')) printOnly('print-groups');
      else if (t.dataset.jump) { const hd = document.getElementById(t.dataset.jump); if (hd) { hd.scrollIntoView({ block: 'start', behavior: labSmooth() }); hd.focus({ preventScroll: true }); } }
    });
    // 수업 계획 고르기: 라디오 묶음 키보드(←↑ 이전 · →↓ 다음 · Home · End, 고르면 바로 표가 바뀜)
    const pick = $('.plan-pick', dash);
    if (pick) pick.addEventListener('keydown', (e) => {
      const btns = $$('[data-plan]', pick), i = btns.indexOf(document.activeElement); if (i < 0) return;
      const j = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? (i + 1) % btns.length : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? (i - 1 + btns.length) % btns.length
        : e.key === 'Home' ? 0 : e.key === 'End' ? btns.length - 1 : -1;
      if (j < 0) return;
      e.preventDefault(); selectPlan(dash, btns[j].dataset.plan, true);
    });
  }

  /* ---------- 라우터 ---------- */
  function route(opts) {
    if (!session) return showGate();
    const hash = location.hash || '#/intro';
    const [, view, a] = hash.split('/');
    const main = $('#view');
    if (labCtx) { if (labCtx.keyHandler) document.removeEventListener('keydown', labCtx.keyHandler); labCtx.sim && labCtx.sim.destroy(); labCtx.ro && labCtx.ro.disconnect(); labCtx = null; }
    if (window.VibeHost) window.VibeHost.hide(); // 화면만 숨김(접속키·대화는 실습 화면으로 돌아오면 그대로)
    window.MC && window.MC.unmount();
    window.Motion && window.Motion.unmountAll();
    closeModal({ instant: true }); helpReq = null;
    // 정답 보이기는 한 페이지에서만: 페이지를 옮기면 자동으로 끈다(다음 실습 정답이 칠판에 뜨지 않게, 08 P0-2)
    if (prefs.tinfo) { prefs.tinfo = false; savePrefs(); applyModes(); }
    document.body.classList.remove('lab-mode', 'rail-open', 'help-req');
    let idx = 0, html;
    if (view === 'teacher' && isTeacher()) html = viewTeacher();
    else if (view === 'me' && !isTeacher()) html = viewMe();
    else if (view === 'p' && L.pages[+a]) {
      const p = L.pages[+a]; idx = +a + 1;
      html = p.type === 'lab' ? viewLab(p, idx) : p.type === 'story' ? viewStory(p, idx) : viewTheory(p, idx);
    } else if (view === 'review' && HAS_REVIEW) { idx = stops.length - 1; html = window.Review.view(L, state, { where: whereTop(idx, '정리') }) + pager(idx); }
    else html = viewIntro();
    main.innerHTML = html;
    // 설계 개정 2(7.7): 교사 화면에서 고른 수업 계획의 '볼 곳'을 그 쪽 위 띠로(계획에 look이 없으면 그대로)
    if (isTeacher() && view !== 'teacher') { const band = lookBandHTML(view === 'p' || view === 'review' ? hash : '#/intro'); const host = band && ($('.lab-panel', main) || $('.page', main)); if (host) host.insertAdjacentHTML('afterbegin', band); }
    armZoom(main);
    if (view === 'teacher' && isTeacher()) bindTeacher(main);
    if (view === 'p' && L.pages[+a]) { const p = L.pages[+a]; p.type === 'lab' ? bindLab(main, p) : p.type === 'story' ? bindStory(main, p) : bindTheory(main, p); }
    applyDeep(main); // 교사 설정 '더 자세히 알아보기 펼쳐 두기'(A, 9차 D13): 그린 뒤 DOM에서만 연다
    fillArt(main); // 10차: 같은 줄 카드의 빈칸에 캐릭터
    if (view === 'review' && HAS_REVIEW) window.Review.bind(main, L, state, save);
    if (view === 'me' && !isTeacher()) {
      const ex = $('[data-me-exit]', main); if (ex) ex.addEventListener('click', () => tool('logout'));
      const pr = $('[data-me-print]', main); if (pr) pr.addEventListener('click', () => window.print());
      // 공용 PC: 이 기기에서 내 기록 지우기(진행·MakeCode 코드·이름 목록). 교사 대시보드의 '이 기기 학생 기록' 표를 뺀 대신(8차, 공개 정적 배포)
      const er = $('[data-me-erase]', main); if (er) er.addEventListener('click', async () => {
        const yes = await ask({ title: '이 기기에서 내 기록을 지울까요?', body: `${session.name}의 진행 기록과 만든 코드가 모두 지워지고 되돌릴 수 없어요.`, ok: '기록 지우기', cancel: '취소', danger: true });
        if (!yes || !session) return;
        deleteStudent(session.key); endSession('이 기기에서 기록을 지웠어요.');
      });
    }
    // 마지막 위치: 학생은 다시 들어올 때 여기로(02 P1-8), 교사는 [투사 시작]이 여기로(08 P1-6)
    if (!isTeacher() && hash !== '#/intro' && validHash(hash) && state.last !== hash) { state.last = hash; persist(); }
    if (isTeacher() && view !== 'teacher' && validHash(hash)) sess.set(K.tlast, hash);
    // 선생님을 부른 상태는 다른 쪽에서도 상단 바를 주황으로(실습으로 돌아오면 띠가 다시 보임)
    if (!isTeacher() && sess.get(K.help)) document.body.classList.add('help-req');
    renderProgress(); syncRail();
    window.scrollTo(0, 0);
    const title = $('h1', main); document.title = `${title ? title.textContent + ' | ' : ''}${L.shortTitle}`;
    syncMore(); setTimeout(syncMore, 900);
    // 페이지를 넘긴 뒤 초점은 새 페이지 제목으로(첫 로드 제외, 창이 열려 있으면 창 우선 — 02 P1-5, 05 P1-8)
    if (opts && opts.focus === true && !$('.modal-wrap:not(.out)') && title && title.offsetParent !== null) { title.tabIndex = -1; title.focus({ preventScroll: true }); }
  }

  // 투사 모드 "빌드" 확장: 모션 장면 → 페이지 안의 다음 블록(확인 문제·그림 줄 등) → 다음 페이지 (08 P0-3)
  const PRESENT_BLOCKS = '.theory, .ig-row, .trio, .check-q, .page > h2, .goals, .goal-formal, .make-cards, .flow, .callout.tip, .review-pick, .result-card, .story-view, .story-game, .episode-map';
  function presentScroll(dir) {
    const topH = ($('.topbar') || { offsetHeight: 0 }).offsetHeight, pg = $('.pager'), pagerH = pg && getComputedStyle(pg).position === 'fixed' ? pg.offsetHeight : 0;
    const maxY = document.documentElement.scrollHeight - innerHeight;
    const step = (innerHeight - topH - pagerH) * 0.85;
    const els = $$(PRESENT_BLOCKS, $('#view')).filter((el) => el.offsetHeight);
    const yOf = (el) => el.getBoundingClientRect().top + scrollY - topH - 20;
    const behavior = matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
    if (dir > 0) {
      if (scrollY >= maxY - 4) return false;
      const next = els.find((el) => { const r = el.getBoundingClientRect(); return r.top > topH + 24 && r.bottom > innerHeight - pagerH - 8; });
      scrollTo({ top: Math.min(next ? Math.max(yOf(next), scrollY + 40) : Infinity, scrollY + step, maxY), behavior });
      return true;
    }
    if (scrollY <= 4) return false;
    const prev = [...els].reverse().find((el) => el.getBoundingClientRect().top < topH - 8);
    scrollTo({ top: Math.max(0, prev ? Math.max(yOf(prev), scrollY - step) : 0), behavior });
    return true;
  }
  // 투사 중 페이지 아래에 내용이 남아 있으면 페이저에 "▼ 아래에 더 있어요"
  function syncMore() {
    const w = $('.pager .where'); if (!w) return;
    const more = document.body.classList.contains('present') && !document.body.classList.contains('lab-mode') && scrollY < document.documentElement.scrollHeight - innerHeight - 4;
    if (w.dataset.more !== String(more)) w.dataset.more = String(more);
  }
  window.addEventListener('scroll', syncMore, { passive: true }); window.addEventListener('resize', syncMore);

  // 키보드 넘기기 (입력 중이 아닐 때)
  document.addEventListener('keydown', (e) => {
    if (!session || e.defaultPrevented || $('.modal-wrap:not(.out)') || !e.target.closest) return;
    const t = e.target, present = document.body.classList.contains('present');
    const fwd = ['ArrowRight', 'PageDown'].includes(e.key), back = ['ArrowLeft', 'PageUp'].includes(e.key);
    if (!fwd && !back) return;
    // 투사 중 클리커(PageUp/PageDown)는 생각 적기 칸·확인 문제 보기에서도 넘긴다(08 P2-10). 퀴즈 안은 제외
    const clicker = present && /^Page(Up|Down)$/.test(e.key);
    if (t.closest('.quiz')) return;
    const inField = t.closest('input, textarea, select, [contenteditable]');
    // 투사 중(9차 D13)에는 확인 문제 보기·[정답 공개]를 누른 뒤에도 ←/→로 넘긴다(칠판 앞에서 → 키가 먹통처럼 보이던 것). 투사가 아니면 그대로
    if (inField || (!present && t.closest('.check-q'))) { if (!clicker) return; if (inField) t.blur(); }
    // 이론 [원리 보기 | 직접 해 보기] 탭에 포커스가 있으면 ←/→는 탭 전환
    const tab = t.closest('.media-tabs [data-media]');
    if (tab && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
      const tabs = $$('.media-tabs [data-media]'); const i = tabs.indexOf(tab);
      const nextTab = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
      e.preventDefault(); nextTab.click(); nextTab.focus(); return;
    }
    // 위젯·모션·탭·도구 막대·코딩 화면 안의 화살표는 그 안에서 쓰는 키: 페이지를 넘기지 않는다(05 P1-8, 클리커 Page 키는 예외).
    // 투사 중에는 위젯 단추에 초점이 있어도 넘기고, 탭·라디오 묶음·도구 막대·코딩 화면·모션 플레이어 안만 예외(9차 D13)
    const own = present ? '[role="tablist"], [role="radiogroup"], [role="toolbar"], .lab-editor, .mo-player'
      : '.widget, .widget-slot, .motion-slot, .mo-player, [role="tablist"], [role="radiogroup"], [role="toolbar"], .lab-editor';
    if (!clicker && t.closest(own)) return;
    // 투사 모드 "빌드" 규칙: 화면에 보이는 모션이 장면마다 멈춤 상태면 클리커가 먼저 다음 장면을 재생
    // ★스토리 쪽(비트런 C2): 넘길 컷이 남았으면 컷부터(투사 클리커도 같음)
    if (window.Story && window.Story.handleNav(fwd ? 1 : -1)) { e.preventDefault(); return; }
    if (window.Motion && window.Motion.handleNav(fwd ? 1 : -1)) { e.preventDefault(); return; }
    // 그다음 페이지 안의 다음 블록으로(투사 이론·소개·복습)
    if (present && !document.body.classList.contains('lab-mode') && presentScroll(fwd ? 1 : -1)) { e.preventDefault(); return; }
    // 실습 화면에는 페이저가 없다 → 투사 모드(교사)에서만 차례대로 넘긴다(학생이 실습 중 화살표로 실수로 나가 MakeCode가 다시 열리지 않게)
    const navTo = (dir) => { const a = $(`[data-nav="${dir}"]`); if (a) return a.getAttribute('href'); if (!present) return null; const i = stops.findIndex((s) => s.hash === (location.hash || '#/intro')); const s = i >= 0 ? stops[i + (dir === 'next' ? 1 : -1)] : null; return s ? s.hash : null; };
    const href = navTo(fwd ? 'next' : 'prev'); if (href) { e.preventDefault(); location.hash = href; }
  });

  window.App = { esc, h, matrixHTML, ledPattern: () => ledPattern(), beep, art: artImg, announce, whereTop, recText };
  // 목차·창이 겹쳐 열린 동안 뒤 화면은 inert(Tab이 가림막 뒤로 새지 않게), 화면 밖으로 숨은 목차도 Tab에서 뺀다(05 P1-3·P1-7, 02 P1-6)
  function syncRail() {
    const r = $('#rail'); if (!r) return; const bc = document.body.classList;
    const modalOn = !!$('.modal-wrap:not(.out)');
    const overlay = bc.contains('lab-mode') || window.matchMedia('(max-width: 900px)').matches; // 투사 모드도 일반 모드처럼 목차가 늘 보인다(9차)
    const open = bc.contains('rail-open');
    r.inert = modalOn || (!open && overlay);
    const v = $('#view'); if (v) v.inert = modalOn || (open && overlay);
    const tb = $('.topbar'); if (tb) tb.inert = modalOn;
    if (window.VibeHost && window.VibeHost.setInert) window.VibeHost.setInert(modalOn || (open && overlay));
    const mb = $('#menuBtn'); if (mb) mb.setAttribute('aria-expanded', String(open));
  }
  new MutationObserver(syncRail).observe(document.body, { attributes: true, attributeFilter: ['class'] });
  // 목차 버튼: 열면 현재 칸으로 초점, Esc·가림막·버튼으로 닫으면 목차 버튼으로 초점 복귀(02 P1-6)
  function setRail(open) {
    document.body.classList.toggle('rail-open', open); syncRail();
    if (open) { revealCurrent(); const c = $('#rail a.current') || $('#rail a, #rail button'); if (c) c.focus({ preventScroll: true }); }
    else { const mb = $('#menuBtn'); if (mb && mb.offsetParent !== null) mb.focus(); }
  }
  $('#menuBtn').addEventListener('click', () => setRail(!document.body.classList.contains('rail-open')));
  $('#scrim').addEventListener('click', () => setRail(false));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !e.defaultPrevented && document.body.classList.contains('rail-open') && !$('.modal-wrap')) { e.preventDefault(); setRail(false); } });
  // 본문으로 건너뛰기: 주소(#)는 바꾸지 않고 제목으로 초점만 옮긴다(05 P1-8)
  const skip = $('#skipLink');
  if (skip) skip.addEventListener('click', (e) => {
    e.preventDefault();
    const lab = $('.lab');
    if (lab && lab.dataset.view === 'studio' && window.VibeHost && window.VibeHost.focusFirst) { window.VibeHost.focusFirst(); return; }
    const t = $$('#view h1, #view h2').find((x) => x.offsetParent !== null) || $('#view');
    if (t) { if (!t.hasAttribute('tabindex')) t.tabIndex = -1; t.focus(); }
  });
  window.addEventListener('resize', syncRail); window.addEventListener('hashchange', syncRail); syncRail();
  window.addEventListener('hashchange', () => route({ focus: true }));
  autoCleanOld();
  if (session) { loadState(); applyModes(); route(); } else showGate();
})();
