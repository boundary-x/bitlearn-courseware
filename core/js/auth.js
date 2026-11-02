/* 교사 인증: 암호화된 정답(js/answers.enc.js)을 교사 비밀번호로 푼다. 선생님 확인(통과 처리만)은 도움 번호 봉투(js/assist.enc.js, 9차).
 * - 봉투 암호화: 정답은 무작위 데이터 키로 암호화되고, 그 키를 학교별 비밀번호 각각으로 감싼다.
 *   한 비밀번호가 새면 그 비밀번호만 빼고 다시 빌드하면 된다.
 * - 비밀번호 자체는 어디에도 저장하지 않는다. 풀린 정답만 이 탭의 sessionStorage에 둔다(탭을 닫으면 사라짐).
 * - answers.enc.js는 교사 비밀번호를 입력할 때만 내려받는다(학생 기기 트래픽 절약).
 */
window.Auth = (() => {
  const SESSION_KEY = `ponybot:${(window.LESSON && window.LESSON.id) || 'lesson'}:teacher-answers`;
  let cache = null;

  function loadScript(file, globalName, missingMsg) {
    if (window[globalName]) return Promise.resolve(window[globalName]);
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = `js/${file}?v=${Date.now()}`;
      s.onload = () => (window[globalName] ? resolve(window[globalName]) : reject(new Error(missingMsg)));
      s.onerror = () => reject(new Error(missingMsg));
      document.head.append(s);
    });
  }
  const loadEnc = () => loadScript('answers.enc.js', 'ANSWERS_ENC', '정답 파일을 불러오지 못했어요. 인터넷 연결을 확인해 주세요.');
  const b64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

  async function kek(pin, salt, iter) {
    const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: b64(salt), iterations: iter, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
  }

  async function unlock(pin) { return openEnvelope(await loadEnc(), pin, 'ponybot-teacher'); }

  /* (9차 D6) 선생님 확인(학생 기기에서 통과 처리만): 도움 번호 봉투(js/assist.enc.js)를 연다.
   * - 봉투 안에는 정답이 없다({check:'ponybot-assist'}). 도움 번호들과 교사 비밀번호들로 각각 감싸 있어 둘 다 통과한다.
   * - 학생 기기에서 정답 암호문(answers.enc.js)을 풀지 않는다. 정답은 교사 비밀번호로 교사 기기에서만.
   * - assist.enc.js가 없으면(옛 빌드·개발 중) 예전처럼 교사 비밀번호로 정답 봉투를 열어 확인만 한다(풀린 내용은 버림). */
  let assistMissing = false;
  async function assist(pin) {
    let enc = null;
    if (!assistMissing) {
      try { enc = await loadScript('assist.enc.js', 'ASSIST_ENC', 'no-assist'); } catch (e) { assistMissing = true; }
    }
    try {
      // starters: 미션별 시작 코드(P9 — 교사가 허락하면 학생 기기에서 '이 미션 시작 코드로 시작'). 정답 코드는 넣지 않는다
      if (!enc) { const a = await unlock(pin); const st = {}; Object.entries(a.missions || {}).forEach(([k, x]) => { if (x.starterTs) st[k] = x.starterTs; }); return { ok: true, by: 'teacher', starters: st }; }
      const d = await openEnvelope(enc, pin, 'ponybot-assist');
      return { ok: true, by: 'assist', starters: d.starters || {} };
    } catch (ex) {
      if (ex.wrongPin) ex.message = pin ? (enc ? '도움 번호나 교사 비밀번호가 달라요.' : '비밀번호가 달라요.') : '번호를 입력해 주세요.';
      throw ex;
    }
  }

  /* (페르소나 2회차 #5) 시작 코드 번호: 시작 코드 봉투(js/starter.enc.js — 미션별 starterTs만, 정답·통과 처리 없음)를 연다.
   * 봉투는 시작 코드 번호들 + 도움 번호들 + 교사 비밀번호들로 각각 감싼다 → 이 창은 셋 다 받는다.
   * 시작 코드 번호는 도움 번호 봉투(assist.enc.js)를 열지 못한다 → 통과 처리·별 도장은 도움 번호(또는 교사 비밀번호)만.
   * starter.enc.js가 없으면(옛 빌드·config.starter 없음) 예전처럼 도움 번호 봉투(assist)로 시작 코드를 연다. */
  let starterMissing = false;
  async function starter(pin) {
    let enc = null;
    if (!(window.PONYBOT_CONFIG || {}).starter) starterMissing = true; // build.js가 starter.enc.js를 만들 때만 config.starter = true(없는 파일을 불러 404를 내지 않음)
    if (!starterMissing) { try { enc = await loadScript('starter.enc.js', 'STARTER_ENC', 'no-starter'); } catch (e) { starterMissing = true; } }
    if (!enc) return assist(pin);
    try {
      const d = await openEnvelope(enc, pin, 'ponybot-starter');
      return { ok: true, by: 'starter', starters: d.starters || {} };
    } catch (ex) {
      if (ex.wrongPin) ex.message = pin ? '시작 코드 번호나 도움 번호가 달라요.' : '번호를 입력해 주세요.';
      throw ex;
    }
  }

  // 봉투 암호문 열기: 비밀번호(또는 스튜디오 코드)마다 감싼 데이터 키 중 하나가 풀리면 본문을 복호화
  async function openEnvelope(enc, pin, check) {
    if (!window.crypto || !crypto.subtle) throw new Error('이 브라우저(또는 http 주소)에서는 쓸 수 없어요. https 주소로 접속해 주세요.');
    if (!pin) { const e = new Error('비밀번호를 입력해 주세요.'); e.wrongPin = true; throw e; }
    let dataKey = null;
    for (const k of enc.keys) {
      try {
        const raw = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64(k.iv) }, await kek(pin, k.salt, enc.iter), b64(k.wrapped));
        dataKey = await crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['decrypt']);
        break;
      } catch (e) { /* 다른 학교 비밀번호로 감싼 키 */ }
    }
    if (!dataKey) { const err = new Error('비밀번호가 달라요.'); err.wrongPin = true; throw err; }
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64(enc.iv) }, dataKey, b64(enc.data));
    const data = JSON.parse(new TextDecoder().decode(plain));
    if (data.check !== check) throw new Error('암호 파일이 올바르지 않아요.');
    return data;
  }

  // (6차) 바이브코딩 접속키는 웹앱이 다루지 않는다: 스튜디오 화면(vibe/)에서 사용자가 직접 넣고 그 화면 메모리에만 둔다
  return {
    unlock,
    /** 선생님 확인(통과 처리 권한만): 도움 번호 또는 교사 비밀번호. 정답은 돌려주지 않는다 */
    assist,
    /** 시작 코드 번호(또는 도움 번호·교사 비밀번호)로 미션별 시작 코드만 연다. 통과 처리 권한은 없다 */
    starter,
    /** 교사 세션 시작: 정답을 탭 세션에 보관 */
    async login(pin) { cache = await unlock(pin); try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(cache)); } catch (e) {} return cache; },
    answers() {
      if (cache) return cache;
      try { cache = JSON.parse(sessionStorage.getItem(SESSION_KEY)); } catch (e) { cache = null; }
      return cache;
    },
    logout() { cache = null; try { sessionStorage.removeItem(SESSION_KEY); } catch (e) {} },
  };
})();
