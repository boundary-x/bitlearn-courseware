/* MakeCode(micro:bit) 컨트롤러 모드 연결 — 근거: content/makecode-integration.md, planning/algorithm.md 1.4
 * - iframe ?controller=1 : 호스트가 workspacesync에 응답해 프로젝트를 넣고, workspacesave로 학생 코드를 받는다.
 * - 학생 코드는 workspacesave마다 localStorage에 자동 저장 → 새로 고침/절전 후에도 이어서 작업.
 * - 저장마다 seq를 올려, "넣은 뒤 블록으로 바뀌었는지"를 저장 순서로 판정한다(loadVerified).
 * - 프로젝트 넣기(importproject)는 겹치면 MakeCode가 앞 요청을 거부하므로 큐로 한 번에 하나씩 처리한다.
 * - 다운로드는 MakeCode 자체 버튼(WebUSB, iframe allow="usb") 또는 .hex 파일.
 */
window.MC = (() => {
  const ORIGIN = 'https://makecode.microbit.org';
  const SAVE_PREFIX = 'ponybot:mc:';
  let frame = null, opts = null, isReady = false, nextId = 1, latest = null, seq = 0, locked = false;
  // 마지막으로 코드를 통째로 넣은 시각(되돌리기·시작 코드·AI 넣기) — 그 직후의 저장으로 "찾았어요!"가 뜨지 않게(UI/UX 5차 06 P0-1)
  let loadAt = 0;
  // 블록 찾기 카드용 도구상자 색인(MakeCode 상태는 바꾸지 않는다), 마지막 저장의 편집기 종류('blocksprj' | 'tsprj')
  let tbIndex = null, latestEditor = null;
  const pending = new Map();
  let saveWaiters = [];
  const saveListeners = new Set();
  let readyResolve; let readyP = new Promise((r) => (readyResolve = r));
  let importChain = Promise.resolve();

  const store = {
    get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
  };

  // 모든 예제·실습 프로젝트의 프로젝트 설정 = "페어링이 필요하지 않습니다: 누구나 블루투스를 통해 연결할 수 있습니다"
  // (사용자 규칙 2026-10-21. 값은 pxt-microbit libs/core/pxt.json userConfigs의 "No Pairing Required"와 같음)
  const NO_PAIRING = { open: 1, whitelist: 0, security_level: null };
  function withProjectSettings(text) {
    let cfg = {};
    try { cfg = JSON.parse(text['pxt.json'] || '{}'); } catch (e) { return text; }
    const yotta = cfg.yotta || (cfg.yotta = {}); const conf = yotta.config || (yotta.config = {});
    const dal = conf['microbit-dal'] || (conf['microbit-dal'] = {});
    dal.bluetooth = Object.assign({}, dal.bluetooth, NO_PAIRING);
    return Object.assign({}, text, { 'pxt.json': JSON.stringify(cfg, null, 4) });
  }

  /* 결정 D17(사용자 2026-10-22 '충돌만 고침'): 기기에 저장된 옛 프로젝트를 되살릴 때 확장 목록은 저장본을 그대로 쓰되
   * ① 실습 목록에 있는 확장이 빠졌으면 더하고(판은 실습 목록 값으로 맞춤) ② 실습 목록과 함께 못 쓰는 확장(radio·radio-broadcast ↔ bluetooth)은 뺀다.
   * 학생이 자유 만들기에서 직접 더한 다른 확장은 지킨다. 바뀔 것이 없으면 저장본을 그대로 돌려준다(3~4·5~6 동작 같음) */
  const RADIO = ['radio', 'radio-broadcast'];
  function withLabDeps(text) {
    const want = opts && opts.dependencies; if (!want) return text;
    let cfg; try { cfg = JSON.parse(text['pxt.json'] || '{}'); } catch (e) { return text; }
    const have = Object.assign({}, cfg.dependencies || {}), names = Object.keys(want);
    const drop = names.includes('bluetooth') ? RADIO : names.some((n) => RADIO.includes(n)) ? ['bluetooth'] : [];
    let changed = false;
    drop.forEach((n) => { if (n in have) { delete have[n]; changed = true; } });
    names.forEach((n) => { if (have[n] !== want[n]) { have[n] = want[n]; changed = true; } });
    if (!changed) return text;
    cfg.dependencies = have;
    return Object.assign({}, text, { 'pxt.json': JSON.stringify(cfg, null, 4) });
  }

  function makeProject(ts, blocks = '') {
    return {
      text: withProjectSettings({
        'main.blocks': blocks,
        'main.ts': ts,
        'README.md': ' ',
        'pxt.json': JSON.stringify({
          name: opts.name, description: '', dependencies: opts.dependencies,
          files: ['main.blocks', 'main.ts', 'README.md'], preferredEditor: 'blocksprj',
        }, null, 4),
      }),
    };
  }

  const post = (msg) => frame && frame.contentWindow && frame.contentWindow.postMessage(msg, ORIGIN);

  function request(action, payload = {}, timeout = 15000) {
    return readyP.then(() => new Promise((resolve, reject) => {
      const id = `bx-${nextId++}`;
      const t = setTimeout(() => { pending.delete(id); reject(new Error('timeout ' + action)); }, timeout);
      pending.set(id, { resolve: (v) => { clearTimeout(t); resolve(v); }, reject: (e) => { clearTimeout(t); reject(e); } });
      post({ type: 'pxteditor', id, action, response: true, ...payload });
    }));
  }

  function onMessage(ev) {
    if (!frame || ev.origin !== ORIGIN || ev.source !== frame.contentWindow) return;
    const msg = ev.data; if (!msg || typeof msg !== 'object') return;
    if (msg.type === 'pxthost') {
      switch (msg.action) {
        case 'workspacesync': {
          const saved = store.get(SAVE_PREFIX + opts.projectKey);
          // 예전에 저장된 코드도 프로젝트 설정(페어링 필요 없음)과 실습 확장 목록(D17: 충돌만 고침)을 맞춰서 되살린다
          const project = saved && saved.text ? { text: withProjectSettings(withLabDeps(saved.text)) } : makeProject(opts.starter.ts, opts.starter.blocks || '');
          post({ type: 'pxthost', id: msg.id, success: true, projects: [project], controllerId: 'boundaryx-ponybot' });
          status('코딩 화면 여는 중…');
          return;
        }
        case 'workspaceevent':
          return;
        case 'workspaceloaded':
        case 'workspacereset':
          if (msg.response) post({ type: 'pxthost', id: msg.id, success: true });
          return;
        case 'workspacesave':
          if (msg.project && msg.project.text) {
            latest = msg.project.text; seq++;
            if (msg.project.header && msg.project.header.editor) latestEditor = msg.project.header.editor;
            store.set(SAVE_PREFIX + opts.projectKey, { text: latest, at: Date.now() });
            const snap = { ts: latest['main.ts'] || '', blocks: latest['main.blocks'] || '', seq, editor: latestEditor };
            const w = saveWaiters; saveWaiters = []; w.forEach((fn) => fn(snap));
            saveListeners.forEach((fn) => { try { fn(snap); } catch (e) {} });
          }
          return;
        case 'editorcontentloaded':
          onLoaded();
          return;
      }
      return;
    }
    if (msg.type === 'pxteditor') {
      if (msg.action === 'editorcontentloaded') { onLoaded(); return; }
      if (msg.id && pending.has(msg.id)) {
        const p = pending.get(msg.id); pending.delete(msg.id);
        msg.success ? p.resolve(msg.resp) : p.reject(msg.error || new Error('MakeCode 요청 실패'));
      }
    }
  }

  let switching = false, simHidden = false;
  async function onLoaded() {
    if (!isReady) { isReady = true; readyResolve(); }
    status('코딩 화면 준비됨 · 자동 저장 중', true);
    // MakeCode 마이크로비트 시뮬레이터는 처음에 접는다(UI/UX 5차 03 P0-3). 포니봇 모터·OLED가 나오지 않아 "안 된다"는 오해를 만들고,
    // 블록 찾기 카드가 가리키는 도구상자를 패널에서 멀어지게 한다. 실측 1366: 작업 공간 684→983px, [다운로드] 글자 유지.
    // 학생·교사가 원하면 MakeCode 왼쪽 끝 ▸ 손잡이로 다시 연다. 한 번 연결될 때 한 번만 보낸다.
    if (!simHidden) { simHidden = true; request('hidesimulator', {}, 5000).catch(() => {}); }
    // main.blocks가 비어 있으면 JS 화면으로 열리므로 블록 화면으로 전환.
    // 바이브코딩이 코드를 넣는 중(locked)에는 loadVerified가 직접 전환하므로 건너뛴다(같은 '변환 문제' 창이 두 번 뜨지 않게)
    if (!switching && !locked && (latest == null || !latest['main.blocks'])) {
      switching = true;
      try { await request('switchblocks'); } catch (e) {} finally { switching = false; }
    }
  }

  function status(t, live) { opts && opts.onStatus && opts.onStatus(t, live); }

  /** 다음 저장(조건을 만족하는)을 기다린다. 시간이 지나면 마지막 상태(또는 null) */
  function waitSave(pred, ms) {
    return new Promise((resolve) => {
      // s가 null이면 편집기를 내린 것(unmount): 기다림을 끝낸다
      const fn = (s) => { if (s == null || !pred || pred(s)) { clearTimeout(t); resolve(s); } else saveWaiters.push(fn); };
      const t = setTimeout(() => { saveWaiters = saveWaiters.filter((f) => f !== fn); resolve(null); }, ms);
      saveWaiters.push(fn);
    });
  }
  const snapshot = () => (latest ? { ts: latest['main.ts'] || '', blocks: latest['main.blocks'] || '', seq, editor: latestEditor } : null);

  // 프로젝트 넣기는 한 번에 하나씩
  function queueImport(fn) { const p = importChain.then(fn, fn); importChain = p.catch(() => {}); return p; }

  /* ---------- 블록 찾기 카드: 도구상자 색인·블록 그림 (MakeCode 상태는 바꾸지 않는다) ---------- */
  // 도구상자 색인: MakeCode의 서랍 안 정렬 규칙(toolboxeditor getBlockGroups + showFlyoutBlocks)을 재현
  function flyoutOrder(cat) {
    const blocks = cat.blocks || [];
    const groups = (cat.groups || []).slice();
    blocks.forEach((b) => { const g = (b.attributes && b.attributes.group) || 'other'; if (groups.indexOf(g) < 0) groups.push(g); });
    const out = [];
    groups.forEach((g) => {
      const gb = blocks.filter((b) => ((b.attributes && b.attributes.group) || 'other') === g)
        .sort((f1, f2) => { const w2 = (f2.attributes.weight || 50) + (f2.attributes.advanced ? 0 : 1000); const w1 = (f1.attributes.weight || 50) + (f1.attributes.advanced ? 0 : 1000); return w2 > w1 ? 1 : -1; })
        .sort((f1, f2) => (f2.attributes.weight != undefined ? f2.attributes.weight : 50) - (f1.attributes.weight != undefined ? f1.attributes.weight : 50));
      if (gb.length) out.push({ group: g, blocks: gb });
    });
    return out;
  }
  async function toolboxIndex() {
    if (tbIndex) return tbIndex;
    if (!isReady) return null;
    const idx = {};
    let row = 0;
    const addCat = (c, advanced, parent) => {
      if (!parent && !advanced) row++;
      const rowPos = parent || advanced ? null : row;
      const flat = [];
      flyoutOrder(c).forEach((g) => g.blocks.forEach((b, i) => flat.push({ b, group: g.group, posInGroup: i + 1, groupCount: g.blocks.length })));
      const name = parent ? `${parent.name} › ${c.name}` : c.name;
      flat.forEach((f, i) => {
        const id = (f.b.attributes && f.b.attributes.blockId) || f.b.blockId;
        if (id && !idx[id]) idx[id] = { blockId: id, drawer: name, color: c.color, advanced, rowPos: parent ? null : rowPos, group: f.group === 'other' ? null : f.group, posInGroup: f.posInGroup, groupCount: f.groupCount, posInDrawer: i + 1, drawerCount: flat.length };
      });
      (c.subcategories || []).forEach((s) => addCat(s, advanced, c));
    };
    try {
      const basic = await request('gettoolboxcategories', { advanced: false }, 8000);
      (basic.categories || []).forEach((c) => addCat(c, false));
      const adv = await request('gettoolboxcategories', { advanced: true }, 8000);
      (adv.categories || []).forEach((c) => addCat(c, true));
      tbIndex = idx;
    } catch (e) { return null; }
    return tbIndex;
  }
  // 블록 그림: renderbyblockid(SVG 약 1.9MB) → canvas PNG(8~37KB). '시작하면' 같은 비함수 블록은 renderxml. 탭 동안 캐시
  const RENDER_CACHE = 'ponybot:blockpng2:';
  let renderChain = Promise.resolve();
  // 편집기 문서는 lang="en"이라 한글이 그 대체 글꼴로 측정된다. 그림에도 같은 lang을 줘야 글자가 블록 밖으로 넘치지 않는다
  function matchEditorLang(uri) {
    try {
      const B64 = 'data:image/svg+xml;base64,';
      if (!uri.startsWith(B64)) return uri;
      const svg = new TextDecoder().decode(Uint8Array.from(atob(uri.slice(B64.length)), (ch) => ch.charCodeAt(0))).replace('<svg ', '<svg xml:lang="en" lang="en" ');
      const u8 = new TextEncoder().encode(svg); let bin = '';
      for (let i = 0; i < u8.length; i += 0x8000) bin += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
      return B64 + btoa(bin);
    } catch (e) { return uri; }
  }
  function svgToPng(uri, scale = 2) {
    uri = matchEditorLang(uri);
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => { try { const c = document.createElement('canvas'); c.width = Math.ceil(img.naturalWidth * scale); c.height = Math.ceil(img.naturalHeight * scale); const g = c.getContext('2d'); g.scale(scale, scale); g.drawImage(img, 0, 0); resolve(c.toDataURL('image/png')); } catch (e) { reject(e); } };
      img.onerror = () => reject(new Error('img'));
      img.src = uri;
    });
  }
  function renderBlock(blockId, { xml = null, key = blockId } = {}) {
    try { const hit = sessionStorage.getItem(RENDER_CACHE + key); if (hit) return Promise.resolve(hit); } catch (e) {}
    if (!isReady) return Promise.resolve(null);
    const job = renderChain.then(async () => {
      let uri = null;
      const byXml = () => request('renderxml', { xml: xml || `<xml xmlns="https://developers.google.com/blockly/xml"><block type="${blockId}"></block></xml>` }, 8000);
      try { uri = xml ? await byXml() : await request('renderbyblockid', { blockId }, 8000); }
      catch (e) { try { uri = await byXml(); } catch (e2) { uri = null; } }
      if (!uri) return null;
      let png = null; try { png = await svgToPng(uri, 2); } catch (e) { png = null; }
      if (png) { try { sessionStorage.setItem(RENDER_CACHE + key, png); } catch (e) {} }
      return png;
    });
    renderChain = job.catch(() => {});
    return job;
  }

  return {
    mount(iframe, o) {
      this.unmount();
      frame = iframe; opts = o; isReady = false; latest = null; seq = 0; locked = false; simHidden = false;
      tbIndex = null;
      readyP = new Promise((r) => (readyResolve = r));
      window.addEventListener('message', onMessage);
      const u = new URL(ORIGIN + '/');
      u.searchParams.set('controller', '1');
      u.searchParams.set('lang', 'ko');
      u.searchParams.set('nocookiebanner', '1');
      frame.src = u.toString();
    },
    unmount() {
      window.removeEventListener('message', onMessage);
      pending.forEach((p) => p.reject(new Error('unmounted'))); pending.clear();
      saveWaiters.forEach((fn) => fn(null)); saveWaiters = [];
      saveListeners.clear();
      frame = null; isReady = false;
    },
    ready: () => isReady,
    seq: () => seq,
    isLocked: () => locked,
    /** 마지막으로 코드를 통째로 넣은 시각(ms). 넣는 중에는 끝날 때까지 계속 갱신 */
    lastLoadAt: () => loadAt,
    /** 저장될 때마다 {ts, blocks, seq} */
    onSave(fn) { saveListeners.add(fn); return () => saveListeners.delete(fn); },
    /** 현재 학생 코드 {ts, blocks, seq}. 저장을 강제해 최신 상태를 읽는다. 편집기와 연결되지 않았으면 null */
    async getCode() {
      if (!isReady) return null;
      const s0 = seq;
      const p = waitSave((s) => s.seq > s0, 3000);
      request('saveproject', {}, 4000).catch(() => {});
      const s = await p;
      return s || snapshot();
    },
    /** 코드 교체(시작 코드·체크포인트·되돌리기). blocks가 있으면 블록 배치까지 그대로 */
    load(starter) {
      if (!isReady) return Promise.resolve(false);
      loadAt = Date.now();
      return queueImport(async () => {
        loadAt = Date.now();
        try {
          await request('importproject', { project: makeProject(starter.ts, starter.blocks || '') }, 30000);
          if (!starter.blocks) await request('switchblocks');
          return true;
        } catch (e) { status('코드를 불러오지 못했어요. 새로 고침 후 다시 시도해 주세요.'); return false; }
        finally { loadAt = Date.now(); }
      });
    },
    /** AI 코드 넣기: TS만 넣고 블록 화면으로 바꾼 뒤, 블록 XML이 채워진 저장이 오는지 확인 (algorithm.md 1.4) */
    loadVerified(ts, waitMs = 8000) {
      if (!isReady) return Promise.resolve({ ok: false, reason: 'NOT_READY' });
      loadAt = Date.now();
      return queueImport(async () => {
        locked = true; loadAt = Date.now();
        try {
          await request('importproject', { project: makeProject(ts, '') }, 30000);
          const s0 = seq;
          const saved = waitSave((s) => s.seq > s0 && s.blocks && s.blocks.trim().length > 0, waitMs);
          try { await request('switchblocks', {}, waitMs); } catch (e) { /* 변환 실패 시 거부될 수 있음 */ }
          request('saveproject', {}, 4000).catch(() => {});
          const after = await saved;
          return after ? { ok: true, after } : { ok: false, reason: 'NO_BLOCKS' };
        } catch (e) { return { ok: false, reason: 'IMPORT_FAILED', detail: String(e && e.message || e) }; }
        finally { locked = false; loadAt = Date.now(); }
      });
    },
    /* 블록 찾기 */
    toolboxIndex, renderBlock,
    /** 마지막 저장 main.blocks에 쓰인 블록 타입(✓ 표시용) */
    /** 저장을 강제하지 않고 마지막 저장본 {ts, blocks, seq} */
    peek: () => snapshot(),
    /** 마지막 저장 main.blocks에 쓰인 블록 타입(✓ 표시용). roots를 주면 그 타입의 맨 바깥 블록(시작하면·버튼 등) 아래에 끼워진 것만 센다 — 떠 있는 회색 블록 제외 */
    usedBlockTypes(roots) {
      const set = new Set(); const xml = latest && latest['main.blocks']; if (!xml) return set;
      if (!roots) { const re = /<block[^>]*\stype="([^"]+)"/g; let m; while ((m = re.exec(xml))) set.add(m[1]); return set; }
      try {
        const doc = new DOMParser().parseFromString(xml, 'text/xml');
        [...doc.documentElement.children].filter((b) => b.nodeName === 'block' && roots.includes(b.getAttribute('type'))).forEach((r) => { set.add(r.getAttribute('type')); [...r.getElementsByTagName('block')].forEach((b) => set.add(b.getAttribute('type'))); });
      } catch (e) {}
      return set;
    },
    popupUrl: () => `${ORIGIN}/?lang=ko`,
    /** 학생(키)의 저장된 코드 모두 삭제 */
    clearAll(key) {
      try {
        // 이 차시 코드만(같은 사이트에 차시가 여럿이어도 다른 차시 코드를 지우지 않게, 8차)
        const pre = `${SAVE_PREFIX}${(window.LESSON && window.LESSON.id) || ''}:${key}:`;
        Object.keys(localStorage).filter((k) => k.startsWith(pre)).forEach((k) => localStorage.removeItem(k));
      } catch (e) {}
    },
  };
})();
