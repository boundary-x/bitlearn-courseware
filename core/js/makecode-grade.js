/* MakeCode 미션 정규식 채점 — 코어 MakeCode 구역(설계 02-split-plan.md 1.1, S1-6에서 app.js에서 분리)
 *   미션 checks[]: { scope, re | any | all | not | count{re,min} | distinct{re,min} | distinctSpeeds | record(+gt·lt·between) }, 미션 order{ scope, seq }
 *   scope: start(이벤트 블록 밖 최상위 코드) · forever · A · B · on:radio·on:radioString·on:uart·on:btConnect·on:btDisconnect(11~12차시 수신·블루투스) · 그 밖(전체 코드)
 *   B형 증상(S3-5): B_SYMPTOMS·lightSymptom(sym, ts)·lightCompares(ts) — 조도·LED 막힘 질문(engine/t_scenario.js가 시험)
 *   distinctSpeeds·stopIsLast는 AI 포니봇 이동 블록(aiPonybot.run…·stop…) 기준
 * 브라우저: window.PBGrade / Node: require(engine/t_regex.js) */
(function (root, factory) {
  const M = factory();
  if (typeof module === 'object' && module.exports) module.exports = M; else root.PBGrade = M;
})(typeof window !== 'undefined' ? window : this, () => {
  'use strict';
  function blockBody(ts, startRe) {
    const m = new RegExp(startRe).exec(ts); if (!m) return null;
    let i = ts.indexOf('{', m.index + m[0].length - 1); if (i < 0) return null;
    let depth = 0; const s = i;
    for (; i < ts.length; i++) { if (ts[i] === '{') depth++; else if (ts[i] === '}') { depth--; if (depth === 0) return ts.slice(s + 1, i); } }
    return ts.slice(s + 1);
  }
  /* 채점 전 코드 정리(P3): 손으로 친 JavaScript의 띄어쓰기·세미콜론·화살표 함수를 MakeCode가 만든 꼴로 맞춘다(문자열 안은 그대로).
   * MakeCode가 만든 코드에는 아무것도 바뀌지 않는다(3~4 채점 그대로). 예) if(a<40){x=0;} → if (a < 40) { x = 0 } */
  function tidy(ts) {
    return String(ts || '').split(/("(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`)/).map((part, i) => (i % 2 ? part : part
      .replace(/;[ \t]*(?=\r?\n|$|\})/g, '')
      .replace(/\b(if|for|while)\(/g, '$1 (')
      .replace(/\(\s*\)\s*=>\s*\{/g, 'function () {')
      .replace(/function\s*\(\s*\)\s*\{/g, 'function () {')
      .replace(/\)[ \t]*\{/g, ') {')
      .replace(/\}[ \t]*else[ \t]*\{/g, '} else {').replace(/\}[ \t]*else[ \t]+if[ \t]*\(/g, '} else if (')
      .replace(/([\w)\]가-힣])[ \t]*(===|!==|==|!=|<=|>=|\+=|-=|\*=|\/=)[ \t]*/g, '$1 $2 ')
      .replace(/([\w)\]가-힣])[ \t]*([<>])[ \t]*(?=[\w(가-힣-])/g, '$1 $2 ')
      .replace(/([\w\]가-힣])[ \t]*=[ \t]*(?=[^=>\s])/g, '$1 = '))).join('');
  }
  // 11~12차시 이벤트 범위(on:…): 라디오 수신(인자 이름은 receivedNumber·receivedString·name, value), 블루투스 데이터 수신·연결·해제
  const ON_RE = {
    'on:radio': 'radio\\.onReceivedNumber\\(function\\s*\\([\\w\\s]*\\)\\s*\\{', 'on:radioString': 'radio\\.onReceivedString\\(function\\s*\\([\\w\\s]*\\)\\s*\\{',
    'on:radioValue': 'radio\\.onReceivedValue\\(function\\s*\\([\\w\\s,]*\\)\\s*\\{', 'on:uart': 'bluetooth\\.onUartDataReceived\\(.*?function\\s*\\(\\)\\s*\\{',
    'on:btConnect': 'bluetooth\\.onBluetoothConnected\\(function\\s*\\(\\)\\s*\\{', 'on:btDisconnect': 'bluetooth\\.onBluetoothDisconnected\\(function\\s*\\(\\)\\s*\\{',
  };
  function scopeOf(ts0, scope) {
    const ts = tidy(ts0);
    if (scope === 'A') return blockBody(ts, 'input\\.onButtonPressed\\(Button\\.A,\\s*function\\s*\\(\\)\\s*\\{') || '';
    if (scope === 'B') return blockBody(ts, 'input\\.onButtonPressed\\(Button\\.B,\\s*function\\s*\\(\\)\\s*\\{') || '';
    if (scope === 'forever') return blockBody(ts, 'basic\\.forever\\(function\\s*\\(\\)\\s*\\{') || '';
    if (ON_RE[scope]) return blockBody(ts, ON_RE[scope]) || '';
    if (scope === 'start') {
      // 이벤트 블록(…(function () {…}))을 모두 빼고 남은 최상위 코드
      let out = ts; let guard = 0;
      for (;;) {
        const m = /[\w.]+\((?:[^()]|\((?:[^()]|\([^()]*\))*\))*?function\s*\([\w\s,]*\)\s*\{/.exec(out); if (!m || guard++ > 50) break; // 11~12: function (receivedNumber)·구분자 인자(serial.delimiters(…))도
        let i = out.indexOf('{', m.index + m[0].length - 1), depth = 0, j = i;
        for (; j < out.length; j++) { if (out[j] === '{') depth++; else if (out[j] === '}') { depth--; if (depth === 0) break; } }
        const end = out.indexOf(')', j); out = out.slice(0, m.index) + out.slice(end + 1);
      }
      return out;
    }
    return ts;
  }
  // 측정 기록 체크(S3-6): { record:'dark' }(채움) · { record:'bright', gt:'dark' } · { record:'threshold', between:['dark', 'bright'] } — ctx.records = 그 미션 기록
  // ★7~8 페르소나 2회차 #4: gt·lt·between 자리에 수 상수도(문자열 = 칸 key, 수 = 그 값), range:[6, 14](같아도 통과 — 칸 값이 범위 안)
  const recNum = (rec, k) => { if (typeof k === 'number') return isFinite(k) ? k : null; const v = (rec || {})[k]; return v === '' || v == null || !isFinite(+v) ? null : +v; };
  function recordOk(c, rec) {
    const v = recNum(rec, c.record); if (v == null) return false;
    if (c.gt != null && !(recNum(rec, c.gt) != null && v > recNum(rec, c.gt))) return false;
    if (c.lt != null && !(recNum(rec, c.lt) != null && v < recNum(rec, c.lt))) return false;
    if (c.between) { const [a, b] = c.between.map((k) => recNum(rec, k)); if (a == null || b == null || !(v > Math.min(a, b) && v < Math.max(a, b))) return false; }
    if (Array.isArray(c.range) && !(v >= Math.min(c.range[0], c.range[1]) && v <= Math.max(c.range[0], c.range[1]))) return false;
    return true;
  }
  function runCheck(c, ts, ctx) {
    if (c.record != null) return recordOk(c, ctx && ctx.records);
    const flat = scopeOf(ts, c.scope).replace(/\s+/g, ' ');
    // distinct{ re, min }: re의 첫 괄호 값이 서로 다른 것이 min개 이상(distinctSpeeds를 일반화, S3-5)
    if (c.distinct) { const set = new Set(), re = new RegExp(c.distinct.re, 'g'); let m; while ((m = re.exec(flat))) { set.add(m[1] != null ? m[1] : m[0]); if (!m[0]) re.lastIndex++; } return set.size >= c.distinct.min; }
    if (c.not) return !new RegExp(c.not).test(flat);
    if (c.all) return c.all.every((re) => new RegExp(re).test(flat));
    if (c.any) return c.any.some((re) => new RegExp(re).test(flat));
    if (c.count) return (flat.match(new RegExp(c.count.re, 'g')) || []).length >= c.count.min;
    if (c.distinctSpeeds) {
      const speeds = new Set(); const re = /aiPonybot\.run(?:Normal|Mecanum|Motor)\([^)]*?,\s*(\d+)\s*\)/g; let mm;
      while ((mm = re.exec(flat))) speeds.add(mm[1]);
      return speeds.size >= c.distinctSpeeds;
    }
    return new RegExp(c.re).test(flat);
  }
  // 정지 블록이 그 묶음의 마지막 문장인지(E1-04 안내용, 채점에는 쓰지 않음)
  function stopIsLast(ts, scope) {
    const lines = scopeOf(ts, scope || 'start').split('\n').map((x) => x.trim()).filter((x) => x && !/^[})\]\s;]+$/.test(x) && !x.startsWith('//'));
    return /aiPonybot\.(stopAllMotors|stopMotor)\(/.test(lines[lines.length - 1] || '');
  }
  function inOrder(src, seq) {
    let pos = 0;
    for (const re of seq) { const r = new RegExp(re, 'g'); r.lastIndex = pos; const m = r.exec(src); if (!m) return false; pos = m.index + m[0].length; }
    return true;
  }

  /* ---------- B형 증상(S3-5): 조도·LED. 막혔어요 › 증상 고르기에서 app.js diagnose가 부른다 ----------
   * 코드(MakeCode가 만든 main.ts)를 글자로 읽어 원인을 묻는 질문 하나를 돌려준다(정답을 말하지 않음).
   * 블록 글자는 ai_ponybot_light v1.0.0 그대로: "라이트를 모두 ~으로 켜기", "라이트 모두 끄기", "~번째 라이트 색상을 ~으로 설정하기", "라이트를 설정한대로 켜기" */
  const B_SYMPTOMS = [['ledOff', 'LED가 켜지지 않아요'], ['dark', '어두운데도 LED가 꺼져 있어요'], ['bright', '밝은데도 LED가 켜져 있어요']];
  const FLIP = { '<': '>', '>': '<', '<=': '>=', '>=': '<=', '==': '==', '!=': '!=' };
  /** 조도 비교 찾기: [{ op, value, on }] — 조도 값을 왼쪽으로 맞춤(40 > 조도 → 조도 < 40). on = 참일 때 칸에서 LED를 켜는지(끄기만 있으면 false) */
  function lightCompares(ts) {
    const out = []; const s = String(ts || '');
    const re = /if\s*\(\s*(?:input\.lightLevel\(\)\s*(<=|>=|<|>|===?|!==?)\s*(-?\d+)|(-?\d+)\s*(<=|>=|<|>|===?|!==?)\s*input\.lightLevel\(\))\s*\)\s*\{/g;
    let m;
    const norm = (o) => o.replace(/^(==|!=)=$/, '$1');
    while ((m = re.exec(s))) {
      const op = m[1] ? norm(m[1]) : FLIP[norm(m[4])], value = +(m[2] != null ? m[2] : m[3]);
      const body = blockBody(s.slice(m.index), 'if\\s*\\(') || '';
      out.push({ op, value, on: /\.(showColor|show|showRainbow|showBarGraph)\(/.test(body) && !/^\s*\w+\.clear\(\)\s*$/.test(body.trim()) });
    }
    return out;
  }
  const ieyo = (n) => `${n}${/[013678]$/.test(String(n)) ? '이에요' : '예요'}`; // 40이에요 · 25예요(숫자 끝 받침)
  const hasElseClear = (ts) => /\}\s*else\s*\{[^{}]*\.clear\(\)/.test(String(ts || ''));
  function lightSymptom(sym, ts) {
    const s = String(ts || '');
    const create = /neopixel\.create\(/.test(s), shows = /\.(showColor|showRainbow|showBarGraph|show)\(/.test(s);
    const cmp = lightCompares(s)[0];
    if (sym === 'ledOff') {
      if (!create) return '맨 처음에 "P8에 연결된 4개의 RGB 타입 라이트"(라이트 설정) 블록이 시작하면 안에 있나요? 이 블록이 있어야 포니봇 LED를 쓸 수 있어요.';
      if (/\.setPixelColor\(/.test(s) && !/\.show\(\)/.test(s) && !/\.showColor\(/.test(s)) return '"~번째 라이트 색상을 ~으로 설정하기"는 색을 정해 두기만 해요. LED로 보내는 "라이트를 설정한대로 켜기" 블록이 있나요?';
      if (!shows) return 'LED를 켜는 블록이 있나요? ponybot light 서랍의 "라이트를 모두 ~으로 켜기" 블록이에요.';
      if (/\.setBrightness\(0\)/.test(s) && !/\.setBrightness\((?!0\))/.test(s)) return '밝기를 0으로 바꾸면 켜도 꺼진 것처럼 보여요. 밝기 값을 확인해 봐요.';
      if (cmp) return '"만약" 조건이 참일 때만 켜져요. 마이크로비트를 손으로 가려 어둡게 해 봐요. 그래도 안 켜지면 기준값을 살펴봐요.';
      return '포니봇 전원 스위치를 켰나요? 마이크로비트가 포니봇에 끝까지 꽂혀 있는지도 확인해 봐요.';
    }
    if (sym === 'dark' || sym === 'bright') {
      if (!/input\.lightLevel\(\)/.test(s)) return '빛 센서 값(조도) 블록이 코드에 있나요? "만약" 블록의 비교 칸에 넣어요.';
      if (!cmp) return '조도 값을 기준값과 비교하는 "만약" 블록이 있나요? 비교 블록 왼쪽에 조도 값, 오른쪽에 기준값을 넣어요.';
      if (sym === 'dark' && /^>/.test(cmp.op) && cmp.on) return `비교 연산자가 "${cmp.op}"예요. 어두우면 조도 값이 작아져요. 어두울 때 켜려면 어떤 연산자가 맞을까요?`;
      if (/^</.test(cmp.op) && !cmp.on) return `조도 값이 기준값 ${cmp.value}보다 작으면(어두우면) 어떤 블록이 실행되나요? 켜는 블록과 끄는 블록의 자리를 확인해 봐요.`;
      if (sym === 'bright' && !hasElseClear(s)) return '"아니면" 칸에 "라이트 모두 끄기"가 있나요? 한 번 켜진 LED는 끄는 블록이 있어야 꺼져요.';
      return sym === 'dark'
        ? `기준값이 ${ieyo(cmp.value)}. 손으로 가렸을 때 화면에 나온 조도 값보다 기준값이 커야 켜져요. 어두울 때 값과 밝을 때 값 사이로 기준값을 바꿔 보세요.`
        : `기준값이 ${ieyo(cmp.value)}. 밝을 때 화면에 나온 조도 값보다 기준값이 작아야 꺼져요. 어두울 때 값과 밝을 때 값 사이로 기준값을 바꿔 보세요.`;
    }
    return '';
  }
  return { blockBody, scopeOf, runCheck, recordOk, stopIsLast, inOrder, tidy, B_SYMPTOMS, lightCompares, lightSymptom };
});
