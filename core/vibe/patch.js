/* 웹앱판 덧대기(원본 파일은 고치지 않는다): tour.js 다음, app.js 앞에서 실행.
 * 1) 사용법 안내 문구를 '크롬 사이드패널'에서 '수업 웹앱 실습 화면'으로 바꾸고, 숨긴 제품 탭 단계를 뺀다.
 *    7차 R7-08-P2-2: 작성 방식·요청 보내기·코드 도구 단계도 해요체·쉬운 말로(원본 환영 문장은 그대로).
 * 2) 머리 로고를 외부(GitHub) 그림 대신 웹앱 안의 흰 로고로(학교망에서 GitHub가 막혀도 보이게, 검은 바탕이라 흰 로고).
 * 3) 7차 R7-07-P1-5(사용자 결정 12): 수업 밖으로 나가는 링크를 뗀다. 로고는 보이되 누를 수 없게(href 제거),
 *    "제품 정보" 링크는 index.html의 style이 숨기고 여기서 href도 떼어 Tab에서 뺀다. ⚙ 버튼에 이름("접속키 설정")을 붙인다.
 * 4) 7차 R7-07-P0-1: 초점 순서. 부모(VibeHost)가 부르는 VibeFocus.first()/last()를 두고,
 *    마지막 조작 요소에서 Tab → 부모의 다음 요소(기본 MakeCode), 첫 요소에서 Shift+Tab → 부모의 이전 요소(기본 선택된 탭).
 *    사용법 안내 창이 열린 동안은 원본(tour.js)이 Tab을 창 안에 가두므로 건드리지 않는다. */
(function () {
  if (typeof STUDIO_TOUR_STEPS !== 'undefined') {
    const byTarget = (t) => STUDIO_TOUR_STEPS.find((s) => s.target === t);
    const set = (t, title, body) => { const s = byTarget(t); if (!s) return; if (title) s.title = title; s.body = body; };
    set('studio-header', '실습 화면과 함께 쓰기',
      '이 창은 수업 웹앱의 실습 화면(자유 만들기 공간) 옆에 열려요. 요청을 보내면 만든 코드가 바로 옆 MakeCode에 블록으로 반영돼요. 미션 코드는 바뀌지 않아요.');
    set('access-settings', null,
      '오른쪽 위 ⚙ 접속키 버튼을 누르고, 선생님께 받은 접속키를 넣은 뒤 “확인 및 닫기”를 눌러요. 웹앱을 새로 고치거나 수업을 마치면 접속키를 다시 넣어야 해요.');
    set('code-context', '코드 작성 방식 고르기',
      '입력칸 위 목록에서 AI가 코드를 어떻게 만들지 골라요. 처음에는 “자동 — 현재 코드에 맞춰 작성”이에요. 코드가 비어 있으면 새로 만들고, 코드가 있으면 거기에 더하거나 고쳐요. 지금 코드를 지우고 다시 만들려면 “처음부터 새로 만들기”, 로봇이 생각대로 움직이지 않으면 “동작 문제 해결하기”를 골라요. “처음부터 새로 만들기”는 바로 다음 요청 한 번에만 쓰여요.');
    set('prompt-composer', '요청 쓰고 보내기',
      '입력칸에 “A 버튼을 누르면 앞으로 가 줘”처럼 언제(조건)와 무엇을(동작) 함께 써요. 종이비행기 버튼이나 Enter를 누르면 보내져요. 줄을 바꾸려면 Shift+Enter를 눌러요. 만든 코드는 옆 MakeCode에서 블록으로 확인해요.');
    set('chat-history', null,
      '블록으로 바꾸지 못하면 MakeCode에 안내 창이 떠요. 먼저 MakeCode 창의 “자바스크립트 유지”를 누른 뒤, 여기서 “오류 자동 수정하기”를 누르면 입력 없이 고쳐 달라고 요청해요. 동작 문제를 설명하려면 “문제 설명하고 수정하기”를 누르고, 원하는 동작과 실제 동작이 어떻게 다른지 써요.');
    set('code-tools', '코드 설명과 도움 버튼',
      '“설명”을 누르면 지금 MakeCode 코드가 무슨 뜻인지 알려 줘요. 만든 코드가 MakeCode에 들어가지 않았을 때는 “생성 코드 복사”로 복사할 수 있어요. 휴지통 버튼은 대화만 지우고, MakeCode 코드는 그대로 둬요.');
    const i = STUDIO_TOUR_STEPS.findIndex((s) => s.target === 'product-tabs');
    if (i >= 0) STUDIO_TOUR_STEPS.splice(i, 1);
  }

  // ---------- 머리 덧대기: 로고 그림·바깥 링크·⚙ 이름 ----------
  const LOGO = '../assets/brand/boundaryx-logo-white.png';
  const OUTSIDE = /^https?:\/\/(www\.)?boundaryx\.io/i;
  function tidy(root) {
    if (!root.querySelectorAll) return;
    root.querySelectorAll('img[src*="raw.githubusercontent.com"]').forEach((img) => { img.src = LOGO; });
    // 원본 머리의 로고 링크(boundaryx.io)·제품 정보 링크(boundaryx.io/shop): href를 떼면 Tab·클릭이 모두 빠진다.
    // React는 바뀌지 않은 속성을 다시 쓰지 않아 뗀 채로 남는다(머리가 새로 그려지면 이 관찰자가 다시 뗀다)
    root.querySelectorAll('a[href]').forEach((a) => {
      if (!OUTSIDE.test(a.getAttribute('href') || '')) return;
      a.removeAttribute('href'); a.removeAttribute('target'); a.removeAttribute('rel');
      if (a.getAttribute('title') === '제품 정보') a.hidden = true;
    });
    root.querySelectorAll('[data-tour="access-settings"]:not([aria-label])').forEach((b) => b.setAttribute('aria-label', '접속키 설정'));
  }
  new MutationObserver((list) => list.forEach((m) => m.addedNodes.forEach((n) => { if (n.nodeType === 1) { if (n.matches && n.matches('img[src*="raw.githubusercontent.com"]')) n.src = LOGO; tidy(n); } })))
    .observe(document.documentElement, { childList: true, subtree: true });

  // ---------- 초점 순서 ----------
  const SEL = 'a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),[tabindex]';
  const tabbables = () => [...document.querySelectorAll(SEL)]
    .filter((el) => el.tabIndex >= 0 && el.getClientRects().length > 0 && !el.closest('[inert]') && getComputedStyle(el).visibility !== 'hidden');
  const focusAt = (i) => {
    const l = tabbables(); const el = l[i < 0 ? l.length + i : i];
    if (!el) return false;
    el.focus({ preventScroll: false });
    return document.activeElement === el;
  };
  window.VibeFocus = { first: () => focusAt(0), last: () => focusAt(-1) };
  const host = () => { try { return window.parent !== window ? window.parent.VibeHost : null; } catch (e) { return null; } };
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab' || e.altKey || e.ctrlKey || e.metaKey || e.isComposing || e.defaultPrevented) return;
    if (document.querySelector('.studio-tour')) return; // 사용법 안내 창: 원본이 Tab을 창 안에 가둔다
    const h = host(); if (!h || typeof h.leave !== 'function') return; // 웹앱 밖에서 직접 연 때는 브라우저 기본 동작
    const l = tabbables(); if (!l.length) return;
    const a = document.activeElement;
    const edge = e.shiftKey ? (a === l[0] || a === document.body || !a) : a === l[l.length - 1];
    if (edge && h.leave(e.shiftKey ? 'prev' : 'next')) e.preventDefault();
  }, true);
})();
