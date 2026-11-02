/* 바이브코딩 스튜디오(웹앱 탑재판) 호스트
 * - 원본 크롬 확장(바운더리엑스 MakeCode 바이브코딩 브릿지 v0.3.2)의 화면을 core/vibe/index.html로 그대로 띄우고,
 *   원본이 background.js에 보내던 두 메시지(READ_CODE_REQUEST, CODE_READY)를 여기서 실습 화면의 MakeCode(MC)로 처리한다.
 * - iframe은 #view 밖(body 아래)에 한 번만 만들어 둔다. 페이지를 옮겨도 원본 화면의 상태(접속키·대화)가 남는다.
 *   접속키는 원본처럼 그 화면의 메모리에만 있다. 수업을 마치면(로그아웃) reset()으로 iframe째 지운다.
 * - 실습 화면이 아닐 때나 '미션 코드'에 넣으려 할 때는 거절한다(학생 화면에 해답이 생기지 않게: 자유 만들기 공간·교사만).
 * - 초점 순서(7차 R7-07-P0-1): iframe은 DOM 맨 끝이라 Tab이 MakeCode를 다 지나야 닿았다. iframe을 옮기면 다시 로드되어
 *   접속키가 사라지므로 옮기지 않고, 칸(el) 앞뒤에 보이지 않는 초점 받이(.vibe-sentinel)를 둔다.
 *   앞 받이 → 스튜디오 첫 요소, 뒤 받이(MakeCode에서 Shift+Tab) → 스튜디오 마지막 요소.
 *   스튜디오 안 끝에서 Tab/Shift+Tab은 vibe/patch.js가 leave()로 부모에 넘긴다(기본: 다음 = #mcFrame, 이전 = 선택된 탭).
 * - 화면 키보드(R7-06-P1-4): visualViewport가 줄면 독 아래 끝을 보이는 영역 아래 끝에 맞춘다(입력칸이 키보드 밑에 숨지 않게).
 */
window.VibeHost = (() => {
  let dock = null, frame = null, anchor = null, ro = null, cfg = {}, inertWanted = false, sentinels = [], focusT = null;
  // 바이브코딩 화면 주소: 이 스크립트(core/js/vibe-host.js) 위치 기준 → core/vibe/index.html(차시 문서 깊이와 상관없음, S2-2·S2-3)
  const SRC = new URL('../vibe/index.html', document.currentScript.src).href;
  const vv = () => window.visualViewport || null;

  function ensure() {
    if (dock) return;
    dock = document.createElement('div');
    dock.id = 'vibeDock'; dock.className = 'vibe-dock'; dock.hidden = true;
    dock.inert = inertWanted;
    frame = document.createElement('iframe');
    frame.title = '바이브코딩 스튜디오';
    frame.src = SRC;
    frame.setAttribute('allow', 'clipboard-write');
    dock.appendChild(frame);
    document.body.appendChild(dock);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    if (vv()) { vv().addEventListener('resize', place); vv().addEventListener('scroll', place); }
  }
  function place() {
    if (!dock || dock.hidden || !anchor) return;
    if (!anchor.isConnected) { hide(); return; }
    const r = anchor.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) { dock.style.visibility = 'hidden'; return; }
    dock.style.visibility = '';
    let h = r.height;
    // 화면 키보드: 안드로이드 크롬 기본값·아이패드는 레이아웃은 두고 보이는 영역(visualViewport)만 줄인다.
    // 독 아래 끝이 보이는 영역 아래로 내려가면 그만큼 줄여 원본 화면 맨 아래 입력칸이 키보드 위에 남게 한다.
    // 손가락으로 확대한 동안(scale > 1)은 줄이지 않는다(확대해 둘러보는 중에 독이 출렁이지 않게)
    const v = vv();
    if (v && v.scale <= 1.01) {
      const visBottom = v.offsetTop + v.height;
      if (r.top + h > visBottom + 1) h = Math.max(visBottom - r.top, Math.min(r.height, 160));
    }
    Object.assign(dock.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${h}px` });
  }

  // ---------- 초점 순서 ----------
  const TABBABLE = 'a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),iframe,[tabindex]';
  const usable = (el) => el && el.isConnected && el.getClientRects().length > 0 && !el.closest('[inert],[hidden]') && getComputedStyle(el).visibility !== 'hidden';
  // node 바로 앞의 Tab 받는 요소(스튜디오 독·초점 받이 제외)
  function prevTabbable(node) {
    if (!node || !node.isConnected) return null;
    const list = [...document.querySelectorAll(TABBABLE)].filter((el) => el.tabIndex >= 0 && !el.closest('#vibeDock') && !el.classList.contains('vibe-sentinel') && usable(el));
    let found = null;
    for (const el of list) { if (node.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_PRECEDING) found = el; else break; }
    return found;
  }
  const defaultAfter = () => document.getElementById('mcFrame');
  const defaultBefore = () => {
    const tab = document.querySelector('.lab-seg [aria-selected="true"]');
    return usable(tab) ? tab : prevTabbable(sentinels[0]);
  };
  function inside(which) {
    if (!dock || dock.hidden || dock.inert || getComputedStyle(dock).visibility === 'hidden') return false; // 칸이 접혔거나 목차가 덮은 때
    try {
      const w = frame && frame.contentWindow, f = w && w.VibeFocus;
      if (!f || !f[which] || !w.document.getElementById('studio-content')) return false; // 아직 그려지는 중
      // 초점이 다른 출처 iframe(MakeCode) 안에 있으면 안쪽 요소만 focus()해서는 페이지 초점이 안 넘어올 수 있어 틀부터 잡는다
      if (document.activeElement !== frame) frame.focus();
      return !!f[which]();
    } catch (e) { return false; }
  }
  // 앞 받이 → 첫 요소, 뒤 받이(뒤에서 Shift+Tab) → 마지막 요소. 넘기지 못하면(아직 로드 중·칸이 가려짐) 받이에 머물지 않고 건너뛴다
  function onSentinel(e) {
    const end = e.currentTarget.dataset.edge === 'end';
    if (!inside(end ? 'last' : 'first')) leave(end ? 'prev' : 'next');
  }
  function addSentinels(el) {
    removeSentinels();
    sentinels = ['start', 'end'].map((edge) => {
      const s = document.createElement('span');
      s.className = 'vibe-sentinel'; s.tabIndex = inertWanted ? -1 : 0; s.dataset.edge = edge;
      // 화면에는 안 보이고 Tab만 받는다(css를 건드리지 않게 인라인)
      s.style.cssText = 'position:absolute;width:1px;height:1px;margin:-1px;padding:0;border:0;overflow:hidden;clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap';
      s.addEventListener('focus', onSentinel);
      return s;
    });
    el.prepend(sentinels[0]); el.append(sentinels[1]);
  }
  function removeSentinels() { sentinels.forEach((s) => { s.removeEventListener('focus', onSentinel); s.remove(); }); sentinels = []; }
  /** vibe/patch.js가 부른다: 스튜디오 마지막 요소에서 Tab('next'), 첫 요소에서 Shift+Tab('prev') → 부모 화면의 요소로 */
  function leave(dir) {
    const pick = dir === 'prev' ? (cfg.focusBefore || defaultBefore) : (cfg.focusAfter || defaultAfter);
    let el = null;
    try { el = pick(); } catch (e) {}
    if (!usable(el)) el = dir === 'prev' ? defaultBefore() : defaultAfter();
    if (!usable(el)) return false;
    el.focus();
    return document.activeElement === el;
  }
  /** 스튜디오 첫 요소로 초점. 화면이 아직 그려지는 중이면 최대 8초 기다린다(그 사이 사용자가 초점을 옮기면 그만둔다) */
  function focusFirst() {
    if (focusT) { clearInterval(focusT); focusT = null; }
    if (inside('first')) return Promise.resolve(true);
    if (!dock || dock.hidden) return Promise.resolve(false);
    const from = document.activeElement;
    return new Promise((resolve) => {
      let n = 0;
      focusT = setInterval(() => {
        const a = document.activeElement, moved = a !== from && a !== document.body && a !== frame;
        const done = !moved && inside('first');
        if (done || moved || ++n > 80 || !dock || dock.hidden) { clearInterval(focusT); focusT = null; resolve(done); }
      }, 100);
    });
  }
  /** 창(모달)·목차가 열린 동안 잠금: 앱의 syncRail이 부른다. 독이 아직 없으면 기억만 해 두고 만들 때 건다 */
  function setInert(on) {
    inertWanted = !!on;
    if (dock) dock.inert = inertWanted;
    sentinels.forEach((s) => { s.tabIndex = inertWanted ? -1 : 0; }); // 잠긴 동안 받이도 Tab에서 뺀다
  }
  // 원본은 창에 포커스가 오면 코드를 다시 읽어 입력창 안내(새로 만들기/고치기)를 바꾼다.
  // 웹앱에서는 스튜디오와 MakeCode가 함께 열리므로, 스튜디오를 다시 띄우거나 MakeCode가 준비되면 같은 신호를 보낸다
  let waitT = null;
  function poke() { try { frame && frame.contentWindow && frame.contentWindow.dispatchEvent(new Event('focus')); } catch (e) {} }
  function pokeWhenReady() {
    if (waitT) return;
    let n = 0;
    waitT = setInterval(() => {
      if (++n > 120 || !frame) { clearInterval(waitT); waitT = null; return; }
      if (anchor && MC() && MC().ready()) { clearInterval(waitT); waitT = null; poke(); }
    }, 1000);
  }

  /** 실습 화면의 칸(el) 위에 스튜디오를 띄운다.
   *  options: projectKey·canWrite·onBusy·onApplied·onConversionFailed,
   *  focusBefore()·focusAfter() — 스튜디오 첫 요소에서 Shift+Tab / 마지막 요소에서 Tab으로 갈 요소를 돌려주는 함수(없으면 선택된 탭 / #mcFrame) */
  function show(el, options) {
    ensure(); cfg = options || cfg; anchor = el;
    dock.hidden = false; place();
    if (ro) ro.disconnect();
    ro = new ResizeObserver(place); ro.observe(el);
    addSentinels(el);
    poke();
  }
  function hide() {
    if (ro) { ro.disconnect(); ro = null; }
    if (focusT) { clearInterval(focusT); focusT = null; }
    removeSentinels();
    anchor = null;
    if (dock) dock.hidden = true;
  }
  /** 수업 마침·역할 바꿈: 화면째 지워 접속키·대화를 남기지 않는다 */
  function reset() {
    hide();
    if (waitT) { clearInterval(waitT); waitT = null; }
    if (dock) { dock.remove(); dock = null; frame = null; }
    window.removeEventListener('resize', place);
    window.removeEventListener('scroll', place, true);
    if (vv()) { vv().removeEventListener('resize', place); vv().removeEventListener('scroll', place); }
  }

  const MC = () => window.MC;
  const fail = (message, reason) => ({ ok: false, reason, message });
  // 원본은 monaco 컴파일 오류 표시를 넘겼다. 컨트롤러 모드에는 그 정보가 없어 웹앱 엔진의 '문법 오류'만 넘긴다
  // (엔진의 수업 범위 검사는 맞는 블록도 오류로 볼 수 있어 넘기지 않는다)
  function markers(ts) {
    try {
      const v = window.PB && window.PB.validate && window.PB.validate.validateCode(ts, { lessonOnly: false });
      return ((v && v.errors) || []).filter((e) => e.code === 'SYNTAX').map((e) => ({ message: e.msg, startLineNumber: e.line || 1, severity: 8 }));
    } catch (e) { return []; }
  }
  const modelUri = () => `webapp:${(cfg.projectKey && cfg.projectKey()) || ''}`;

  async function read() {
    if (!anchor || !MC() || !MC().ready()) { if (anchor) pokeWhenReady(); return fail('실습 화면의 MakeCode가 아직 열리지 않았어요. 잠시 뒤 다시 시도해 주세요.', 'NO_TAB'); }
    const c = await MC().getCode();
    if (!c || typeof c.ts !== 'string') return fail('지금 MakeCode에 작성된 코드를 불러오지 못했어요.', 'NO_RESPONSE');
    return { ok: true, code: c.ts, modelUri: modelUri(), markers: markers(c.ts), keptJavaScript: !(c.blocks || '').trim(), tabId: 'webapp' };
  }

  async function apply(msg) {
    if (!anchor || !MC() || !MC().ready()) return fail('실습 화면의 MakeCode가 열려 있지 않아요.', 'NO_TAB');
    if (cfg.canWrite && !cfg.canWrite()) return fail('미션 코드에는 AI 코드를 넣지 않아요. 미션을 마친 뒤 자유 만들기 공간에서 써요.', 'NOT_ALLOWED');
    if (typeof msg.code !== 'string' || !msg.code.trim()) return fail('반영할 코드가 비어 있습니다.');
    const now = await MC().getCode();
    if (!now || now.ts !== msg.expectedCode || (msg.modelUri && msg.modelUri !== modelUri())) {
      return fail('AI 생성 중 MakeCode 코드나 프로젝트가 변경되었습니다. 현재 코드를 보호하기 위해 반영을 중단했습니다. 다시 요청해주세요.');
    }
    cfg.onBusy && cfg.onBusy(true);
    try {
      const r = await MC().loadVerified(msg.code);
      if (r && r.ok) { cfg.onApplied && cfg.onApplied(); return { ok: true }; }
      // 블록 변환 실패: 원본처럼 코드를 자바스크립트 화면에 남긴다. MakeCode가 띄운 안내 창의 [자바스크립트 유지]는
      // 웹앱이 대신 누를 수 없어(다른 출처) 학생이 누르도록 알린다
      cfg.onConversionFailed && cfg.onConversionFailed();
      return { ok: false, injected: true, keptJavaScript: true, reason: 'BLOCK_CONVERSION_FAILED', markers: markers(msg.code),
        message: '블록으로 변환하지 못해 코드를 자바스크립트 화면에 남겼어요. MakeCode 창의 ‘자바스크립트 유지’를 누른 뒤 ‘오류 자동 수정하기’를 눌러 주세요.' };
    } finally { cfg.onBusy && cfg.onBusy(false); }
  }

  /** vibe/bridge.js가 부른다(원본 chrome.runtime.sendMessage 자리) */
  async function handle(msg) {
    if (!msg || typeof msg !== 'object') return fail('알 수 없는 요청이에요.');
    if (msg.type === 'READ_CODE_REQUEST') return read();
    if (msg.type === 'CODE_READY') return apply(msg);
    return fail('알 수 없는 요청이에요.');
  }

  return { show, hide, reset, handle, focusFirst, setInert, leave, isOpen: () => !!(dock && !dock.hidden) };
})();
