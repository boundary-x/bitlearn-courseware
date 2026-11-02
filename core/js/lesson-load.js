/* 시리즈 기본값 층 합치기(설계 02-split-plan.md 3.4): window.PONYBOT_SERIES(js/series.js) + window.LESSON(js/lesson.js) → window.LESSON
 * 규칙 ① 일반 객체는 깊게 합친다 ② 배열·문자열·숫자는 차시 값이 이긴다 ③ 차시 값이 null이면 기본값을 지운다
 *      ④ REPLACE_KEYS(dependencies)는 차시든 실습이든 통째로 바꾼다(bluetooth와 radio는 함께 못 씀) ⑤ 더하기는 차시가 [...PONYBOT_SERIES.x, …]로 직접 펼친다
 * 시리즈 기본값은 복사해서 쓴다(차시가 바꿔도 PONYBOT_SERIES는 그대로). 차시에만 있는 칸은 차시 순서 그대로, 기본값에만 있는 칸은 그 뒤에 붙는다.
 * ★시리즈 프리셋(비트런, planning/bitrun/41-core-impl.md): 차시에 series: '<이름>'이 있으면 window.SERIES_PRESETS[이름](core/js/series-<이름>.js)을
 *   PONYBOT_SERIES 위에 같은 규칙으로 먼저 합치고, 그 위에 차시를 합친다. series가 없는 차시(포니봇)는 예전과 똑같다. */
(() => {
  const S0 = window.PONYBOT_SERIES || {}, L = window.LESSON;
  if (!L) return;
  const REPLACE_KEYS = ['dependencies'];
  const plain = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
  const clone = (v) => (Array.isArray(v) ? v.map(clone) : plain(v) ? Object.keys(v).reduce((o, k) => { o[k] = clone(v[k]); return o; }, {}) : v);
  function merge(base, over, key) {
    if (over === undefined) return clone(base);
    if (over === null) return base === undefined ? null : undefined; // 기본값이 있으면 지운다
    if (REPLACE_KEYS.includes(key) || !plain(base) || !plain(over)) return over;
    const out = {};
    Object.keys(over).forEach((k) => { const v = merge(base[k], over[k], k); if (v !== undefined) out[k] = v; });
    Object.keys(base).forEach((k) => { if (!(k in over)) out[k] = clone(base[k]); });
    return out;
  }
  const P = L.series != null ? (window.SERIES_PRESETS || {})[L.series] : null;
  const S = P ? merge(S0, P, '') : S0;
  window.LESSON = merge(S, L, '');
})();
