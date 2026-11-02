/* 웹앱판 다리: 원본(크롬 확장)의 chrome.runtime.sendMessage 두 곳(코드 읽기·코드 반영)을
 * 같은 출처의 부모 창(수업 웹앱)의 VibeHost로 보낸다. VibeHost가 실습 화면의 MakeCode에서 읽고 넣는다.
 * 원본 app.js는 고치지 않는다. 응답 모양은 원본 background.js와 같다:
 *   READ_CODE_REQUEST → { ok, code, modelUri, markers, keptJavaScript, tabId } | { ok:false, reason, message }
 *   CODE_READY        → { ok:true } | { ok:false, reason:'BLOCK_CONVERSION_FAILED', keptJavaScript:true, markers, message } | { ok:false, message } */
(function () {
  function host() {
    try { return window.parent && window.parent !== window && window.parent.VibeHost; } catch (e) { return null; }
  }
  window.chrome = window.chrome || {};
  window.chrome.runtime = {
    sendMessage(message) {
      const h = host();
      if (!h || typeof h.handle !== 'function') {
        return Promise.resolve({ ok: false, reason: 'NO_TAB', message: '수업 웹앱의 실습 화면에서 열어 주세요.' });
      }
      return Promise.resolve(h.handle(message)).catch((e) => ({ ok: false, message: (e && e.message) || '웹앱에서 응답을 받지 못했어요.' }));
    },
  };
})();
