/* 자동 생성: node tools/bundle-engine.js — 원본은 webapp/engine/ (테스트: node engine/test.js) */
(function () {
  'use strict';
  const defs = {}, cache = {};
  function req(name) {
    const key = name.replace(/^\.\//, '').replace(/\.js$/, '');
    if (cache[key]) return cache[key].exports;
    if (!defs[key]) throw new Error('engine module not found: ' + key);
    const module = { exports: {} }; cache[key] = module;
    defs[key](module, module.exports, req);
    return module.exports;
  }
  defs["tslite"] = function (module, exports, require) {
/* tslite: MakeCode TypeScript 부분집합 토크나이저 + 재귀하강(Pratt) 파서. eval/Function 사용 안 함.
 * 지원: let/const/var, function 선언, if/else, while, for(;;), for..of, return/break/continue,
 *       함수식 function(){} / 화살표 () => {}, 호출, 멤버, 인덱스, 배열 리터럴, 이항/논리/단항/증감/대입/삼항.
 * 거부: class, new, import/export, namespace, declare, async/await, this, 템플릿 ${} 등 → ParseError(line, col)
 */
class ParseError extends Error {
  constructor(msg, line, col) { super(`${line}:${col} ${msg}`); this.line = line; this.col = col; this.code = 'PARSE'; }
}

const PUNCT = ['===', '!==', '=>', '==', '!=', '<=', '>=', '&&', '||', '++', '--', '+=', '-=', '*=', '/=', '%=',
  '(', ')', '{', '}', '[', ']', ',', ';', '.', ':', '?', '+', '-', '*', '/', '%', '<', '>', '!', '='];
const KEYWORDS = new Set(['let', 'const', 'var', 'function', 'if', 'else', 'while', 'for', 'of', 'return', 'break', 'continue', 'true', 'false', 'null', 'undefined']);
const BANNED = new Set(['class', 'new', 'import', 'export', 'namespace', 'declare', 'async', 'await', 'yield', 'this', 'delete',
  'eval', 'with', 'try', 'catch', 'throw', 'switch', 'do', 'typeof', 'instanceof', 'in', 'enum', 'interface', 'type',
  '__proto__', 'prototype', 'constructor', 'Function', 'globalThis', 'window', 'document']);

function tokenize(src) {
  const toks = []; let i = 0, line = 1, col = 1;
  const adv = (n) => { for (let k = 0; k < n; k++) { if (src[i] === '\n') { line++; col = 1; } else col++; i++; } };
  while (i < src.length) {
    const c = src[i];
    if (c === ' ' || c === '\t' || c === '\r' || c === '\n' || c === '﻿') { adv(1); continue; }
    if (src.startsWith('//', i)) { while (i < src.length && src[i] !== '\n') adv(1); continue; }
    if (src.startsWith('/*', i)) { const e = src.indexOf('*/', i + 2); if (e < 0) throw new ParseError('주석이 닫히지 않았어요', line, col); adv(e + 2 - i); continue; }
    const L = line, C = col;
    if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(src[i + 1] || ''))) {
      const m = /^(0[xX][0-9a-fA-F]+|\d*\.?\d+(?:[eE][+-]?\d+)?)/.exec(src.slice(i));
      toks.push({ t: 'num', v: Number(m[1]), line: L, col: C }); adv(m[1].length); continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      let j = i + 1, s = '';
      while (j < src.length && src[j] !== c) {
        if (src[j] === '\n' && c !== '`') throw new ParseError('문자열이 닫히지 않았어요', L, C);
        if (c === '`' && src[j] === '$' && src[j + 1] === '{') throw new ParseError('템플릿 문자열 ${}은 지원하지 않아요', L, C);
        if (src[j] === '\\') { const n = src[j + 1]; s += n === 'n' ? '\n' : n === 't' ? '\t' : n; j += 2; continue; }
        s += src[j++];
      }
      if (j >= src.length) throw new ParseError('문자열이 닫히지 않았어요', L, C);
      toks.push({ t: 'str', v: s, line: L, col: C }); adv(j + 1 - i); continue;
    }
    const idm = /^[\p{L}_$][\p{L}\p{N}_$]*/u.exec(src.slice(i, i + 64));
    if (idm) {
      const w = idm[0];
      if (BANNED.has(w)) throw new ParseError(`'${w}'는 MakeCode 블록 코드에서 쓰지 않는 문법이에요`, L, C);
      toks.push({ t: KEYWORDS.has(w) ? 'kw' : 'id', v: w, line: L, col: C }); adv(w.length); continue;
    }
    const p = PUNCT.find((q) => src.startsWith(q, i));
    if (!p) throw new ParseError(`알 수 없는 문자 '${c}'`, L, C);
    toks.push({ t: 'p', v: p, line: L, col: C }); adv(p.length);
  }
  toks.push({ t: 'eof', v: '', line, col });
  return toks;
}

function parse(src) {
  const toks = tokenize(src); let k = 0;
  const peek = (o = 0) => toks[k + o];
  const is = (v, o = 0) => { const t = toks[k + o]; return (t.t === 'p' || t.t === 'kw') && t.v === v; };
  const next = () => toks[k++];
  const fail = (msg, t = peek()) => { throw new ParseError(msg, t.line, t.col); };
  const expect = (v) => { if (!is(v)) fail(`'${v}'가 필요해요 (지금: '${peek().v || '끝'}')`); return next(); };
  const ident = () => { const t = peek(); if (t.t !== 'id') fail(`이름이 필요해요 (지금: '${t.v}')`); return next().v; };
  const semi = () => { if (is(';')) next(); };
  // 간단한 타입 표기(: number, : string[], : neopixel.Strip 등)는 읽고 버린다 — MakeCode는 이벤트 안에서 처음 넣는 변수를 `let strip: neopixel.Strip = null`로 맨 위에 적는다(S3-5)
  const skipType = () => { if (!is(':')) return; next(); ident(); while (is('.') && peek(1).t === 'id') { next(); next(); } while (is('[') && is(']', 1)) { next(); next(); } };

  function program() { const body = []; while (peek().t !== 'eof') body.push(statement()); return { type: 'Program', body }; }
  function block() { const t = expect('{'); const body = []; while (!is('}')) { if (peek().t === 'eof') fail("'}'가 빠졌어요", t); body.push(statement()); } next(); return { type: 'Block', body, line: t.line }; }
  function statement() {
    const t = peek();
    if (is('{')) return block();
    if (is(';')) { next(); return { type: 'Empty', line: t.line }; }
    if (is('let') || is('const') || is('var')) { const kind = next().v; const name = ident(); skipType(); let init = null; if (is('=')) { next(); init = expr(); } semi(); return { type: 'VarDecl', kind, name, init, line: t.line }; }
    if (is('function')) { next(); const name = ident(); const params = paramList(); skipType(); const body = block(); return { type: 'FuncDecl', name, params, body, line: t.line }; }
    if (is('if')) { next(); expect('('); const test = expr(); expect(')'); const cons = statement(); let alt = null; if (is('else')) { next(); alt = statement(); } return { type: 'If', test, cons, alt, line: t.line }; }
    if (is('while')) { next(); expect('('); const test = expr(); expect(')'); return { type: 'While', test, body: statement(), line: t.line }; }
    if (is('for')) {
      next(); expect('(');
      if ((is('let') || is('const')) && peek(1).t === 'id' && is('of', 2)) { next(); const name = ident(); next(); const iter = expr(); expect(')'); return { type: 'ForOf', name, iter, body: statement(), line: t.line }; }
      let init = null; if (!is(';')) init = (is('let') || is('var') || is('const')) ? (() => { const kind = next().v; const name = ident(); skipType(); expect('='); return { type: 'VarDecl', kind, name, init: expr(), line: t.line }; })() : { type: 'ExprStmt', expr: expr(), line: t.line };
      expect(';'); const test = is(';') ? null : expr(); expect(';'); const update = is(')') ? null : expr(); expect(')');
      return { type: 'For', init, test, update, body: statement(), line: t.line };
    }
    if (is('return')) { next(); let arg = null; if (!is(';') && !is('}')) arg = expr(); semi(); return { type: 'Return', arg, line: t.line }; }
    if (is('break')) { next(); semi(); return { type: 'Break', line: t.line }; }
    if (is('continue')) { next(); semi(); return { type: 'Continue', line: t.line }; }
    const e = expr(); semi(); return { type: 'ExprStmt', expr: e, line: t.line };
  }
  function paramList() { expect('('); const ps = []; while (!is(')')) { ps.push(ident()); skipType(); if (!is(')')) expect(','); } next(); return ps; }

  const BIN = { '||': 1, '&&': 2, '==': 3, '!=': 3, '===': 3, '!==': 3, '<': 4, '>': 4, '<=': 4, '>=': 4, '+': 5, '-': 5, '*': 6, '/': 6, '%': 6 };
  function expr() { return assign(); }
  function assign() {
    const left = cond();
    const t = peek();
    if (t.t === 'p' && ['=', '+=', '-=', '*=', '/=', '%='].includes(t.v)) {
      if (left.type !== 'Ident' && left.type !== 'Index') fail('대입할 수 없는 곳이에요', t);
      next(); return { type: 'Assign', op: t.v, target: left, value: assign(), line: t.line };
    }
    return left;
  }
  function cond() { const test = binary(1); if (is('?')) { const t = next(); const cons = assign(); expect(':'); const alt = assign(); return { type: 'Cond', test, cons, alt, line: t.line }; } return test; }
  function binary(minP) {
    let left = unary();
    for (;;) {
      const t = peek(); const p = t.t === 'p' ? BIN[t.v] : undefined;
      if (!p || p < minP) return left;
      next(); const right = binary(p + 1);
      left = { type: (t.v === '&&' || t.v === '||') ? 'Logical' : 'Bin', op: t.v, l: left, r: right, line: t.line };
    }
  }
  function unary() {
    const t = peek();
    if (t.t === 'p' && (t.v === '!' || t.v === '-' || t.v === '+')) { next(); return { type: 'Unary', op: t.v, arg: unary(), line: t.line }; }
    if (t.t === 'p' && (t.v === '++' || t.v === '--')) { next(); const arg = unary(); return { type: 'Update', op: t.v, prefix: true, arg, line: t.line }; }
    return postfix();
  }
  function postfix() {
    let e = primary();
    for (;;) {
      const t = peek();
      if (is('.')) { next(); const name = peek(); if (name.t !== 'id' && name.t !== 'kw') fail('속성 이름이 필요해요'); next(); if (BANNED.has(name.v)) fail(`'${name.v}' 속성은 쓸 수 없어요`, name); e = { type: 'Member', obj: e, prop: name.v, line: t.line }; }
      else if (is('(')) { next(); const args = []; while (!is(')')) { args.push(expr()); if (!is(')')) expect(','); } next(); e = { type: 'Call', callee: e, args, line: t.line }; }
      else if (is('[')) { next(); const index = expr(); expect(']'); e = { type: 'Index', obj: e, index, line: t.line }; }
      else if (is('++') || is('--')) { next(); e = { type: 'Update', op: t.v, prefix: false, arg: e, line: t.line }; }
      else return e;
    }
  }
  function arrowAhead() { // '(' ... ')' '=>' 인지 확인
    let d = 0;
    for (let j = k; j < toks.length; j++) { const t = toks[j]; if (t.t === 'p' && t.v === '(') d++; else if (t.t === 'p' && t.v === ')') { d--; if (d === 0) return toks[j + 1].t === 'p' && toks[j + 1].v === '=>'; } else if (t.t === 'eof') return false; }
    return false;
  }
  function primary() {
    const t = peek();
    if (t.t === 'num') { next(); return { type: 'Num', value: t.v, line: t.line }; }
    if (t.t === 'str') { next(); return { type: 'Str', value: t.v, line: t.line }; }
    if (is('true') || is('false')) { next(); return { type: 'Bool', value: t.v === 'true', line: t.line }; }
    if (is('null') || is('undefined')) { next(); return { type: 'Null', line: t.line }; }
    if (is('function')) { next(); if (peek().t === 'id') next(); const params = paramList(); skipType(); return { type: 'Func', params, body: block(), line: t.line }; }
    if (is('(') && arrowAhead()) { const params = paramList(); expect('=>'); return { type: 'Func', params, body: is('{') ? block() : expr(), line: t.line }; }
    if (t.t === 'id' && is('=>', 1)) { next(); next(); return { type: 'Func', params: [t.v], body: is('{') ? block() : expr(), line: t.line }; }
    if (is('(')) { next(); const e = expr(); expect(')'); return e; }
    if (is('[')) { next(); const items = []; while (!is(']')) { items.push(expr()); if (!is(']')) expect(','); } next(); return { type: 'Arr', items, line: t.line }; }
    if (t.t === 'id') { next(); return { type: 'Ident', name: t.v, line: t.line }; }
    fail(`여기에 '${t.v || '끝'}'가 올 수 없어요`);
  }
  return program();
}

/** a.b.c 형태 멤버 체인을 'a.b.c' 문자열로. 아니면 null */
function memberPath(n) {
  if (n.type === 'Ident') return n.name;
  if (n.type === 'Member') { const p = memberPath(n.obj); return p ? `${p}.${n.prop}` : null; }
  return null;
}

module.exports = { tokenize, parse, ParseError, memberPath };

  };
  defs["font5x7"] = function (module, exports, require) {
// FONT_5X7 from boundary-x/ai_ponybot_basic v1.0.2 (main.ts). 5 bytes/char, ASCII 32..126, column-major, LSB=top
module.exports = "000000000000005F00000007000700147F147F14242A072A12231308646237495522500005030000001C2241000041221C00082A1C2A0808083E080800503000000808080808006060000020100804023E5149453E00427F400042615149462141454B311814127F1027454545393C4A49493001710905033649494936064949291E003636000000563600000008142241141414141441221408000201510906324979413E7E1111117E7F494949363E414141227F4141221C7F494949417F090901013E414151327F0808087F00417F41002040413F017F081422417F404040407F0204027F7F0408107F3E4141413E7F090909063E4151215E7F09192946464949493101017F01013F4040403F1F2040201F7F2018207F63140814630304780403615149454300007F4141020408102041417F000004020102044040404040000102040020545454787F484444383844444420384444487F3854545418087E090102081454543C7F0804047800447D40002040443D00007F10284400417F40007C041804787C0804047838444444387C14141408081414187C7C080404084854545420043F4440203C4040207C1C2040201C3C4030403C44281028440C5050503C4464544C44000836410000007F000000413608000201020402";

  };
  defs["sensors"] = function (module, exports, require) {
/* 가짜 센서(B형 시나리오 채점, 설계 02-split-plan.md 4장): 센서 이름 → 값.
 *   new Sensors({ lightLevel: 20 }) → sim이 input.lightLevel()을 부르면 20을 돌려준다.
 *   채점은 화면 없이 시나리오(given)로 값을 넣는다. 학생 화면에는 가짜 센서 슬라이더를 두지 않는다(결정 D18).
 * SENSORS 표: name → { api(TS 경로), block(블록 type), label(학생용 이름), min, max, def(기본값), ready }
 *   ready: true  = sim이 실제로 값을 돌려줌(lightLevel 5~6차시, distance·soundLevel·acceleration 7~8차시)
 *   ready: false = 자리만(이름·범위만 정해 둠). sim은 아직 이 API를 모르므로 지금처럼 '모르는 블록'(통과를 막지 않음)
 *   API·블록 이름은 확장 소스에서 확인한 것만 적는다: micro:bit core input.*, ai_ponybot_basic v1.0.2 main.ts(aiPonybot.ping·readLineSensor·getRed…)
 */
const SENSORS = {
  lightLevel: { api: 'input.lightLevel', block: 'device_get_light_level', label: '빛 센서(조도) 값', min: 0, max: 255, def: 128, ready: true },
  // 7~8차시: 초음파 거리(cm, 실제 거리 — 값은 sim.ping이 단위로 바꿈. 'none' 또는 500 이상 = 못 잼), 소리 크기(V2), 가속도 세기(mg)
  distance: { api: 'aiPonybot.ping', block: 'aiponybot_sonar_ping', label: '초음파 거리', unit: 'cm', min: 0, max: 500, def: 100, none: 500, ready: true },
  soundLevel: { api: 'input.soundLevel', block: 'device_get_sound_level', label: '소리 크기', min: 0, max: 255, def: 0, ready: true },
  acceleration: { api: 'input.acceleration', block: 'device_acceleration', label: '가속도 세기', unit: 'mg', min: -8192, max: 8192, def: 1024, ready: true },
  // 9~10차시(linecolor.js): lineLeft·lineRight·colorR·colorG·colorB·colorLight. 나머지는 자리만(다음 차시에서 sim에 연결)
  // block을 비운 것은 아직 블록 type을 확인하지 않음(sim에 연결할 때 확장·MakeCode 블록 XML로 확인해서 채움)
  temperature: { api: 'input.temperature', label: '온도', min: -5, max: 50, def: 21, ready: false },
  lineLeft: { api: 'aiPonybot.readLineSensor', block: 'readLineSensor', label: '왼쪽 라인 센서', min: 0, max: 1, def: 0, ready: true },
  lineRight: { api: 'aiPonybot.readLineSensor', block: 'readLineSensor', label: '오른쪽 라인 센서', min: 0, max: 1, def: 0, ready: true },
  colorR: { api: 'aiPonybot.getRed', block: 'aiponybot_color_tcs34725_get_red', label: '빨간색(R) 값', min: 0, max: 255, def: 0, ready: true },
  colorG: { api: 'aiPonybot.getGreen', block: 'aiponybot_color_tcs34725_get_green', label: '초록색(G) 값', min: 0, max: 255, def: 0, ready: true },
  colorB: { api: 'aiPonybot.getBlue', block: 'aiponybot_color_tcs34725_get_blue', label: '파란색(B) 값', min: 0, max: 255, def: 0, ready: true },
  colorLight: { api: 'aiPonybot.getLight', block: 'aiponybot_color_tcs34725_get_light', label: '색상 센서 밝기(B) 값', min: 0, max: 255, def: 0, ready: true },
};
// 토큰·규칙에 쓰는 짧은 이름(IR 토큰 SENSE:<짧은 이름>, 콘텐츠 초안 'SENSE:light'와 같음)
const SHORT = { lightLevel: 'light', temperature: 'temp', soundLevel: 'sound', distance: 'distance', acceleration: 'accel', lineLeft: 'lineL', lineRight: 'lineR', colorR: 'R', colorG: 'G', colorB: 'B', colorLight: 'colorLight' };
for (const [n, s] of Object.entries(SHORT)) SENSORS[n].tok = s;
/** 센서 이름 맞추기: 'lightLevel' | 'light' | 'SENSE:light' → 'lightLevel' (모르면 그대로) */
const sensorName = (x) => { const s = String(x || '').replace(/^SENSE:/, ''); if (SENSORS[s]) return s; const k = Object.keys(SHORT).find((n) => SHORT[n] === s); return k || s; };
/** TS 경로(input.lightLevel) → 센서 이름 (ready인 것만) */
const BY_API = Object.fromEntries(Object.entries(SENSORS).filter(([, s]) => s.ready).map(([n, s]) => [s.api, n]));
/** 블록 type(device_get_light_level) → 센서 이름 (ready인 것만) */
const BY_BLOCK = Object.fromEntries(Object.entries(SENSORS).filter(([, s]) => s.ready && s.block).map(([n, s]) => [s.block, n]));

class Sensors {
  constructor(values = {}) {
    this.v = Object.create(null); this.reads = Object.create(null);
    for (const [n, s] of Object.entries(SENSORS)) this.v[n] = s.def;
    this.set(values);
  }
  /** 값 넣기({ lightLevel: 20 }). 모르는 이름은 오류(시나리오 오타를 바로 알게) */
  set(values = {}) {
    for (const [n0, val] of Object.entries(values)) {
      const n = sensorName(n0), s = SENSORS[n]; if (!s) throw new Error(`모르는 센서 이름: ${n0} (알려진 이름: ${Object.keys(SENSORS).join(', ')})`);
      if (val === 'none' && s.none != null) { this.v[n] = s.none; continue; } // 초음파 '못 잼'(에코 없음)
      if (typeof val !== 'number' || !isFinite(val)) throw new Error(`센서 ${n} 값은 숫자여야 해요: ${val}`);
      this.v[n] = Math.max(s.min, Math.min(s.max, val));
    }
    return this;
  }
  /** 코드가 읽은 값(읽은 횟수를 셈: 시나리오가 '센서를 읽었는지' 볼 때) */
  read(n) { this.reads[n] = (this.reads[n] || 0) + 1; return this.v[n]; }
  get(n) { return this.v[n]; }
}

module.exports = { Sensors, SENSORS, BY_API, BY_BLOCK, sensorName };

  };
  defs["leds"] = function (module, exports, require) {
/* 포니봇 RGB LED 4개 모델 — ai_ponybot_light v1.0.0 main.ts(namespace neopixel, 블록 이름 "ponybot light")의 동작을 그대로 따른다.
 * 확인한 API(확장 소스):
 *   neopixel.create(pin, numLeds, mode) → Strip(밝기 기본 128)  블록 neopixel_create "%pin에 연결된 %numLeds개의 %mode타입 라이트"(P8·4개)
 *   Strip.showColor(rgb)          neopixel_set_strip_color  "라이트를 모두 %rgb으로 켜기"      — 버퍼 전체 + 바로 show
 *   Strip.clear()                 neopixel_clear            "라이트 모두 끄기"                 — 버퍼 0 + 바로 show
 *   Strip.setBrightness(b)        neopixel_set_brightness   "라이트의 밝기를 %brightness로 변경하기" — 값만 기억(b & 0xff, 확장 주석 "only applies to future operation")
 *   Strip.setPixelColor(i, rgb)   neopixel_set_pixel_color  "%pixelOffset번째 라이트 색상을 %rgb으로 설정하기" — 그때 밝기를 곱해 버퍼에만(0번부터)
 *   Strip.show()                  neopixel_show             "라이트를 설정한대로 켜기"           — 버퍼를 그대로 LED로 보냄(밝기 계산 없음)
 *   Strip.showRainbow(s, e)       neopixel_set_strip_rainbow, Strip.showBarGraph(v, high) neopixel_show_bar_graph
 *   Strip.createRange(start, n)   neopixel_range, Strip.getLength() neopixel_length
 *   neopixel.getColors(NeoPixelColors.X) neopixel_colors, neopixel.rgb(r, g, b) neopixel_rgb, neopixel.hsl(h, s, l) neopixelHSL,
 *   neopixel.pickColorPackRGB(c) pick_color_packrgb
 * 밝기: 색을 버퍼에 쓸 때 밝기 < 255면 채널마다 (값 × 밝기) >> 8 (setAllRGB·setPixelRGB). 255면 그대로.
 *   그래서 '밝기 → 모두 켜기'·'밝기 → 색상 설정 → 설정한대로 켜기'는 새 밝기로 보이고, '색상 설정 → 밝기 → 설정한대로 켜기'는 그대로(밝기는 다음에 색을 쓸 때부터).
 *   clear(): 버퍼(그 범위)를 0으로 채우고 바로 show. (시험: engine/t_scenario.js '밝기 모델')
 * 상태(채점용): LED마다 { color(블록에 넣은 색 0xRRGGBB), brightness(그때 밝기), out:[r,g,b](실제 출력) } — 'shown'은 마지막 show 때 LED에 나간 것.
 * 기록: shows[{ t, leds }] (show할 때마다. t = 가상 시각 ms) — 시나리오의 '본 색 차례'·'밝기가 오름' 판정에 쓴다.
 */
const COLORS = { Red: 0xFF0000, Orange: 0xFFA500, Yellow: 0xFFFF00, Green: 0x00FF00, Blue: 0x0000FF, Indigo: 0x000080, Violet: 0x8a2be2, White: 0xFFFFFF, Black: 0x000000 };
const MODES = { RGB: 1, RGBW: 2, RGB_RGB: 3 };
const COLOR_KO = { Red: '빨간색', Orange: '주황색', Yellow: '노란색', Green: '초록색', Blue: '파란색', Indigo: '남색', Violet: '보라색', White: '흰색', Black: '끄기' };
const packRGB = (r, g, b) => ((r & 0xFF) << 16) | ((g & 0xFF) << 8) | (b & 0xFF);
const unpack = (c) => [(c >> 16) & 0xFF, (c >> 8) & 0xFF, c & 0xFF];
const idiv = (a, b) => Math.trunc(a / b);
const clamp = (lo, hi, v) => Math.max(lo, Math.min(hi, v));
function hsl(h, s, l) { // 확장 hsl() 그대로(정수 연산)
  h = Math.round(h); s = Math.round(s); l = Math.round(l);
  h = h % 360; s = clamp(0, 99, s); l = clamp(0, 99, l);
  const chroma = idiv((((100 - Math.abs(2 * l - 100)) * s) << 8), 10000);
  const seg = idiv(h, 60), rem = idiv((h - seg * 60) * 256, 60);
  const temp = Math.abs((((seg % 2) << 8) + rem) - 256);
  const sec = (chroma * (256 - temp)) >> 8;
  let r = 0, g = 0, b = 0;
  if (seg === 0) { r = chroma; g = sec; } else if (seg === 1) { r = sec; g = chroma; } else if (seg === 2) { g = chroma; b = sec; }
  else if (seg === 3) { g = sec; b = chroma; } else if (seg === 4) { r = sec; b = chroma; } else if (seg === 5) { r = chroma; b = sec; }
  const m = idiv((idiv((l * 2 << 8), 100) - chroma), 2);
  return packRGB(r + m, g + m, b + m);
}
/** 색 값(0xRRGGBB) → 이름(정확히 같을 때만), 없으면 '#RRGGBB' */
const colorName = (c) => { const k = Object.keys(COLORS).find((n) => COLORS[n] === c); return k || '#' + (c >>> 0).toString(16).padStart(6, '0').toUpperCase(); };

class Leds {
  constructor(n = 4) {
    this.n = n;
    this.buf = Array.from({ length: n }, () => ({ color: 0, brightness: 128, out: [0, 0, 0] })); // 버퍼(아직 안 보냄)
    this.shown = this.buf.map((x) => Object.assign({}, x, { out: x.out.slice() }));             // LED에 나간 것
    this.shows = []; this.created = 0; this.warnings = new Set(); this.now = () => 0;
  }
  _write(i, rgb, bright) {
    if (i < 0 || i >= this.n) return;
    let [r, g, b] = unpack(rgb >> 0);
    if (bright < 255) { r = (r * bright) >> 8; g = (g * bright) >> 8; b = (b * bright) >> 8; }
    this.buf[i] = { color: rgb >> 0 & 0xFFFFFF, brightness: bright, out: [r, g, b] };
  }
  _send() {
    this.shown = this.buf.map((x) => ({ color: x.color, brightness: x.brightness, out: x.out.slice() }));
    this.shows.push({ t: this.now(), leds: this.shown });
  }
  /** neopixel.create(pin, numLeds, mode) → Strip 객체(sim이 메서드를 이름공간처럼 감쌈) */
  create(pin, numLeds, mode) {
    this.created++;
    if (numLeds !== this.n) this.warnings.add('LED_COUNT'); // 포니봇 LED는 4개(P8)
    if (pin !== 'P8') this.warnings.add('LED_PIN');
    const strip = { start: 0, length: Math.max(0, Math.min(this.n, numLeds >> 0)), brightness: 128, mode: mode || MODES.RGB };
    return this._strip(strip);
  }
  _strip(st) {
    const L = this, end = () => st.start + st.length;
    const clearRange = () => { for (let i = st.start; i < end(); i++) L.buf[i] = { color: 0, brightness: L.buf[i].brightness, out: [0, 0, 0] }; };
    return {
      _st: st,
      showColor(rgb) { for (let i = st.start; i < end(); i++) L._write(i, rgb, st.brightness); L._send(); },
      clear() { clearRange(); L._send(); },
      setBrightness(b) { st.brightness = (b >> 0) & 0xff; },
      setPixelColor(i, rgb) { i = i >> 0; if (i < 0 || i >= st.length) return; L._write(i + st.start, rgb, st.brightness); },
      show() { L._send(); },
      getLength() { return st.length; },
      createRange(start, length) {
        start = start >> 0; length = length >> 0;
        const s2 = { start: st.start + clamp(0, st.length - 1, start), brightness: st.brightness, mode: st.mode };
        s2.length = clamp(0, st.length - (s2.start - st.start), length);
        return L._strip(s2);
      },
      showRainbow(startHue = 1, endHue = 360) { // 확장 그대로(시계 방향, 채도 100·명도 50)
        const steps = st.length; if (steps <= 0) return;
        startHue = startHue >> 0; endHue = endHue >> 0;
        const hueStep = idiv((((endHue + 360) - startHue) % 360) * 100, steps);
        const px = (i, c) => L._write(st.start + i, c, st.brightness);
        if (steps === 1) px(0, hsl(startHue + hueStep, 100, 50));
        else {
          px(0, hsl(startHue, 100, 50));
          for (let i = 1; i < steps - 1; i++) px(i, hsl(idiv(startHue * 100 + i * hueStep, 100) + 360, 100, 50));
          px(steps - 1, hsl(endHue, 100, 50));
        }
        L._send();
      },
      showBarGraph(value, high) { // 확장 그대로
        const n = st.length, px = (i, c) => L._write(st.start + i, c, st.brightness);
        if (high <= 0) { clearRange(); L._send(); px(0, COLORS.Yellow); L._send(); return; }
        value = Math.abs(value); const v = idiv(value * n, high);
        if (v === 0) { px(0, 0x666600); for (let i = 1; i < n; i++) px(i, 0); }
        else for (let i = 0; i < n; i++) { if (i <= v) { const b = idiv(i * 255, n - 1); px(i, packRGB(b, 0, 255 - b)); } else px(i, 0); }
        L._send();
      },
    };
  }
  /** 지금 LED에 보이는 상태 */
  state() { return this.shown.map((x, i) => ({ i, name: `L${i + 1}`, color: x.color, colorName: colorName(x.color), brightness: x.brightness, out: x.out.slice(), lit: x.out.some((v) => v > 0) })); }
  litCount() { return this.shown.filter((x) => x.out.some((v) => v > 0)).length; }
}

module.exports = { Leds, COLORS, MODES, COLOR_KO, colorName, hsl, packRGB, unpack };

  };
  defs["matrix"] = function (module, exports, require) {
/* 마이크로비트 LED 화면 5×5(basic 서랍) — 1차시 '첫 코딩' 채점·미리보기용(S3 LED)
 * 모양 표: microsoft/pxt-microbit libs/core/icons.ts(master f71ff57, 2026-10-22 받음) images.iconImage·arrowImage 그대로(41개 IconNames + 8개 ArrowNames).
 *   '1' = 켜짐, 줄마다 5칸씩 위에서 아래(25자). 한국어 이름은 MakeCode 번역(libs/core core-strings ko, 블록 드롭다운 글자 그대로).
 * 시간(같은 소스 basic.cpp·basic.ts·icons.ts):
 *   showIcon(icon, interval = 600) / showArrow(dir, 600) = 그리고 interval 동안 기다림(fiber_sleep — 다른 파이버는 돈다)
 *   showLeds(leds, interval = 400) = 그리고 400 기다림 · clearScreen() = 끄기만(기다림 없음)
 *   showString(text, interval = 150): 0자 = 끄고 5×interval, 1자 = 그 글자를 5×interval, 2자 이상 = 흘려 보내기(약 (6×글자 수 + 5)×interval, 끝나면 빈 화면 — 근사)
 *   showNumber(n) = showString(소수 둘째 자리까지 반올림한 글자)
 *   글자 모양(글꼴)은 넣지 않는다: 글자·숫자 프레임은 cells 대신 text로 남긴다(채점은 글자로).
 * frames: [{ t(ms), kind: 'icon'|'arrow'|'leds'|'text'|'clear'|'scroll-end', cells: '0101…'(25자) | null, icon?, arrow?, text? }] — 화면이 바뀔 때마다 하나 */
const ICONS = {
  Heart: '0101011111111110111000100',
  SmallHeart: '0000001010011100010000000',
  Happy: '0000001010000001000101110',
  Sad: '0000001010000000111010001',
  Confused: '0000001010000000101010101',
  Angry: '1000101010000001111110101',
  Asleep: '0000011011000000111000000',
  Surprised: '0101000000001000101000100',
  Silly: '1000100000111110001100011',
  Fabulous: '1111111011000000101001110',
  Meh: '1101100000000100010001000',
  Yes: '0000000001000101010001000',
  No: '1000101010001000101010001',
  Triangle: '0000000100010101111100000',
  LeftTriangle: '1000011000101001001011111',
  Chessboard: '0101010101010101010101010',
  Diamond: '0010001010100010101000100',
  SmallDiamond: '0000000100010100010000000',
  Square: '1111110001100011000111111',
  SmallSquare: '0000001110010100111000000',
  Scissors: '1100111010001001101011001',
  TShirt: '1101111111011100111001110',
  Rollerskate: '0001100011111111111101010',
  Duck: '0110011100011110111000000',
  House: '0010001110111110111001010',
  Tortoise: '0000001110111110101000000',
  Butterfly: '1101111111001001111111011',
  StickFigure: '0010011111001000101010001',
  Ghost: '0111010101111111111110101',
  Sword: '0010000100001000111000100',
  Giraffe: '1100001000010000111001010',
  Skull: '0111010101111110111001110',
  Umbrella: '0111011111001001010011100',
  Snake: '1100011011010100111000000',
  Rabbit: '1010010100111101101011110',
  Cow: '1000110001111110111000100',
  QuarterNote: '0010000100001001110011100',
  EighthNote: '0010000110001011110011100',
  EigthNote: '0010000110001011110011100',
  Pitchfork: '1010110101111110010000100',
  Target: '0010001110110110111000100',
};
const ARROWS = {
  North: '0010001110101010010000100',
  NorthEast: '0011100011001010100010000',
  East: '0010000010111110001000100',
  SouthEast: '1000001000001010001100111',
  South: '0010000100101010111000100',
  SouthWest: '0000100010101001100011100',
  West: '0010001000111110100000100',
  NorthWest: '1110011000101000001000001',
};
const ICON_KO = {
  Heart: '하트',
  SmallHeart: '작은 하트',
  Happy: '행복함',
  Sad: '슬픔',
  Confused: '당황',
  Angry: '화남',
  Asleep: '잠듦',
  Surprised: '놀람',
  Silly: '바보',
  Fabulous: '놀라움',
  Meh: '지루함',
  Yes: '맞음',
  No: '틀림',
  Triangle: '삼각형',
  LeftTriangle: '왼쪽 방향 삼각형',
  Chessboard: '체스판',
  Diamond: '다이아몬드',
  SmallDiamond: '작은 다이아몬드',
  Square: '사각형',
  SmallSquare: '작은 사각형',
  Scissors: '가위',
  TShirt: '티셔츠',
  Rollerskate: '롤러 스케이트',
  Duck: '오리',
  House: '집',
  Tortoise: '거북이',
  Butterfly: '나비',
  StickFigure: '막대기 사람',
  Ghost: '유령',
  Sword: '칼',
  Giraffe: '기린',
  Skull: '해골',
  Umbrella: '우산',
  Snake: '뱀',
  Rabbit: '토끼',
  Cow: '젖소',
  QuarterNote: '4분 음표',
  EighthNote: '8분 음표',
  EigthNote: '8분 음표',
  Pitchfork: '쇠스랑',
  Target: '과녁',
};
const ARROW_KO = {
  North: '북쪽',
  NorthEast: '북동쪽',
  East: '동쪽',
  SouthEast: '남동쪽',
  South: '남쪽',
  SouthWest: '남서쪽',
  West: '서쪽',
  NorthWest: '북서쪽',
};
const BLANK = '0'.repeat(25);
/** showLeds 글자(`# . # . #` …)·'10101…'·배열 → 25자 '0/1'. 읽을 수 없으면 null */
function parseLeds(x) {
  if (Array.isArray(x)) x = x.join('');
  const s = String(x == null ? '' : x).replace(/[\s`,|]/g, '');
  if (/^[#.]{25}$/.test(s)) return s.replace(/#/g, '1').replace(/\./g, '0');
  if (/^[01]{25}$/.test(s)) return s;
  return null;
}
/** 25자 → 아이콘 이름(같은 모양이 여럿이면 첫 이름, EigthNote = EighthNote) 또는 null */
function iconOf(cells) { const k = Object.keys(ICONS).find((n) => ICONS[n] === cells); return k || null; }
const iconName = (v) => { const s = String(v == null ? '' : v).replace(/^IconNames\./, ''); return ICONS[s] ? s : null; };
const ARROW_LIST = Object.keys(ARROWS); // ArrowNames 값 0~7 차례(North = 0 …)
const arrowName = (v) => (typeof v === 'number' ? ARROW_LIST[v] || null : ARROWS[String(v).replace(/^ArrowNames\./, '')] ? String(v).replace(/^ArrowNames\./, '') : null);
/** MakeCode Math.roundWithPrecision(n, 2).toString() 근사 */
const numText = (n) => (typeof n !== 'number' || isNaN(n) ? '?' : String(Math.round(n * 100) / 100));

class Matrix {
  constructor() { this.cells = BLANK; this.frames = []; this.now = () => 0; }
  _push(f) {
    const last = this.frames[this.frames.length - 1];
    if (last && last.t === f.t && last.kind === f.kind && last.cells === f.cells && last.text === f.text) return;
    this.frames.push(Object.assign({ t: this.now() }, f));
  }
  /** 그림 프레임(아이콘·화살표·LED 출력) */
  image(cells, meta = {}) { this.cells = cells; this._push(Object.assign({ t: this.now(), cells }, meta)); }
  clear() { this.cells = BLANK; this._push({ t: this.now(), kind: 'clear', cells: BLANK }); }
  /** 글자 프레임. 1자는 남아 있고(cells는 알 수 없음 → null), 2자 이상은 흘러가 끝나면 빈 화면(scrollMs 뒤) */
  text(text, scrollMs) {
    this.cells = null; this._push({ t: this.now(), kind: 'text', cells: null, text: String(text) });
    if (scrollMs != null) this._pendingEnd = this.now() + scrollMs;
  }
  /** 흘려 보내기가 끝난 시각에 빈 화면 프레임(시뮬레이터가 기다림이 끝날 때 부름) */
  settle(t) { if (this._pendingEnd != null && t >= this._pendingEnd) { const at = this._pendingEnd; this._pendingEnd = null; this.cells = BLANK; this.frames.push({ t: at, kind: 'scroll-end', cells: BLANK }); } }
  state() { return { cells: this.cells, frames: this.frames.slice() }; }
  litCount() { return this.cells == null ? null : [...this.cells].filter((c) => c === '1').length; }
}

module.exports = { ICONS, ARROWS, ICON_KO, ARROW_KO, BLANK, Matrix, parseLeds, iconOf, iconName, arrowName, numText, ARROW_LIST };

  };
  defs["music"] = function (module, exports, require) {
/* 소리 출력 기록(7~8차시 '후방 주차 경보'·'쉐이크잇'): sim이 music.* 를 부르면 시간축에 울림 구간을 적는다.
 * 근거(pxt-microbit v7.0.61 libs/core/music.ts·playable.ts·melodies.ts, pins.cpp analogPitch — lesson07-08/content/blocks.md 4-1):
 *   playTone(f, ms>0) = 울리고 ms 기다린 뒤 끔(기다림) · playTone(f, 0) = ringTone(f) = 계속 울림(안 기다림) · rest(ms) = 끄고 ms 기다림
 *   stopAllSounds = 바로 끔(배경 멜로디도) · beat(BeatFraction.X) = 60000/템포(기본 120) → Whole 500 · Half 250 · Quarter 125 · Eighth 62 · Sixteenth 31 · Double 1000 · Breve 2000
 *   play(tonePlayable(f, ms), UntilDone) = playTone(f, ms) · InBackground = 안 기다리고 울림 · 내장 멜로디 = 음 하나가 (60000/템포 >> 2) × 길이 칸
 *   setVolume·setTempo는 기록만(소리 크기는 채점하지 않음)
 * 구간 seg = { t(시작 ms), end(끝 ms, 아직 울리면 null), freq(Hz), src('tone'|'ring'|'play'|'melody:PowerDown'|'bg…') } */
const NOTE = { C: 262, CSharp: 277, D: 294, Eb: 311, E: 330, F: 349, FSharp: 370, G: 392, GSharp: 415, A: 440, Bb: 466, B: 494,
  C3: 131, CSharp3: 139, D3: 147, Eb3: 156, E3: 165, F3: 175, FSharp3: 185, G3: 196, GSharp3: 208, A3: 220, Bb3: 233, B3: 247,
  C4: 262, CSharp4: 277, D4: 294, Eb4: 311, E4: 330, F4: 349, FSharp4: 370, G4: 392, GSharp4: 415, A4: 440, Bb4: 466, B4: 494,
  C5: 523, CSharp5: 555, D5: 587, Eb5: 622, E5: 659, F5: 698, FSharp5: 740, G5: 784, GSharp5: 831, A5: 880, Bb5: 932, B5: 988 };
const BEAT = { Whole: 1, Half: 2, Quarter: 4, Eighth: 8, Sixteenth: 16, Double: 32, Breve: 64 };
// 내장 멜로디(melodies.ts _getMelodyBuffer): 2바이트씩 [미디 음 번호(0 = 쉼), 길이(1/4박 칸)]
const MELODY_HEX = {
  Dadadadum: '00024f024f024f024b0800024d024d024d024a08', Entertainer: '4a014b014c0154024c0154024c0154035401560157015801540156015802530156025404',
  Ode: '4c044c044d044f044f044d044c044a04480448044a044c044c064a024a084c044c044d044f044f044d044c044a04480448044a044c044a0648024808',
  Ringtone: '48014a014c024f024a014c014d0251024c014d014f0253025404', Funk: '300230023302300135023001350236023702300230023702300136023001360235023302',
  Birthday: '480348014a0448044d044c08480348014a0448044f044d0848034801540451044d044c044a045203520151044d044f044d08',
  Wedding: '48044d034d014d0848044f034c014d0848044d035101540451034d014d044c034d014f08', Funeral: '3c043c033c013c043f033e013e033c013c033b013c04',
  Punchline: '480343014201430144034303000347034803', Baddy: '3c0300033e023f0200023c0200024208', BaDing: '5f016403', Wawawawaa: '400300013f0300013e0400013d08',
  JumpUp: '54015601580159015b01', JumpDown: '5b015901580156015401', PowerUp: '4f01540158015b0258015b03', PowerDown: '5b01570154014f0253015403',
};
const MELODIES = ['Dadadadum', 'Entertainer', 'Prelude', 'Ode', 'Nyan', 'Ringtone', 'Funk', 'Blues', 'Birthday', 'Wedding', 'Funeral', 'Punchline', 'Baddy', 'Chase', 'BaDing', 'Wawawawaa', 'JumpUp', 'JumpDown', 'PowerUp', 'PowerDown'];
const MELODY_KO = { PowerDown: '전원 끄는 멜로디', PowerUp: '전원 켜는 멜로디', BaDing: '바딩', JumpUp: '점프 업', JumpDown: '점프 다운', Birthday: '생일 축하', Ringtone: '벨소리' };
const midiHz = (n) => Math.round(440 * Math.pow(2, (n - 69) / 12));
/** 멜로디 → [{ freq(0 = 쉼), q(1/4박 칸) }] (Prelude·Nyan·Blues·Chase처럼 표에 없는 것은 null) */
function melodyNotes(name) {
  const h = MELODY_HEX[name]; if (!h) return null;
  const out = []; for (let i = 0; i + 3 < h.length; i += 4) { const n = parseInt(h.slice(i, i + 2), 16), q = parseInt(h.slice(i + 2, i + 4), 16); out.push({ freq: n ? midiHz(n) : 0, q }); }
  return out;
}
/** 멜로디 글자("C D E F G A B C5", 한 음 = 1박, '-' = 쉼) → [{ freq, q }] (music.stringPlayable) */
const LETTER = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
function stringNotes(s) {
  return String(s || '').split(/\s+/).filter(Boolean).map((t) => {
    if (t === '-' || /^r/i.test(t)) return { freq: 0, q: 4 };
    const m = /^([A-Ga-g])(#|b)?(\d)?/.exec(t); if (!m) return { freq: 0, q: 4 };
    const oct = m[3] != null ? +m[3] : 4, n = 12 * (oct + 1) + LETTER[m[1].toUpperCase()] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
    return { freq: midiHz(n), q: 4 };
  });
}

class Music {
  constructor() { this.segs = []; this.tempo = 120; this.volume = 128; this.calls = []; this.now = () => 0; }
  beat(fr) { const b = Math.trunc(60000 / this.tempo), f = fr == null ? 1 : fr; return f === 2 ? b >> 1 : f === 4 ? b >> 2 : f === 8 ? b >> 3 : f === 16 ? b >> 4 : f === 32 ? b << 1 : f === 64 ? b << 2 : b; }
  /** 지금 울리는(또는 앞으로 울릴 배경) 소리를 t에서 끊는다 */
  cut(t = this.now()) {
    this.segs = this.segs.filter((s) => s.t < t || (s.t === t && s.end === t));
    for (const s of this.segs) if (s.end == null || s.end > t) s.end = t;
    this.segs = this.segs.filter((s) => s.end > s.t);
  }
  /** 울림 시작(ms > 0이면 그 길이, 아니면 계속). 돌려주는 값 = 기다릴 시간 */
  tone(freq, ms, src = 'tone', at = this.now()) {
    this.cut(at);
    if (freq > 0) this.segs.push({ t: at, end: ms > 0 ? at + ms : null, freq: Math.round(freq), src });
    return ms > 0 ? ms : 0;
  }
  rest(ms, at = this.now()) { this.cut(at); return Math.max(0, ms); }
  stop(at = this.now()) { this.cut(at); }
  /** 음 목록을 차례로: until = 기다림(합계 시간을 돌려줌), 아니면 배경(안 기다림 → 0) */
  notes(list, src, until) {
    const t0 = this.now(), q = Math.trunc(60000 / this.tempo) >> 2; let t = t0;
    this.cut(t0);
    for (const n of list) { const d = n.q * q; if (n.freq > 0) this.segs.push({ t, end: t + d, freq: n.freq, src }); t += d; }
    return until ? t - t0 : 0;
  }
  /** 끝 시각 tEnd 기준 울림 목록: 붙어 있는 같은 높이 구간은 하나로(무한반복 안 ringTone 되풀이), 아직 울리면 end = tEnd(cut: true) */
  beeps(tEnd) {
    const out = [];
    for (const s of this.segs.slice().sort((a, b) => a.t - b.t)) {
      if (s.t >= tEnd) continue;
      const end = s.end == null || s.end > tEnd ? tEnd : s.end, open = s.end == null || s.end > tEnd, last = out[out.length - 1];
      if (last && last.freq === s.freq && Math.abs(last.end - s.t) < 0.5) { last.end = end; last.open = open; continue; }
      out.push({ t: s.t, end, ms: end - s.t, freq: s.freq, src: s.src, open });
    }
    out.forEach((b) => { b.ms = b.end - b.t; });
    return out;
  }
  soundingAt(t) { return this.segs.some((s) => s.t <= t && (s.end == null || s.end > t)); }
}

module.exports = { Music, NOTE, BEAT, MELODIES, MELODY_KO, melodyNotes, stringNotes, midiHz };

  };
  defs["ir"] = function (module, exports, require) {
/* 채점용 중간 표현(IR): main.blocks XML 또는 main.ts → 같은 모양의 IR
 * Program = { from, scripts:[{event, ops, src}], floating:[], disabled:[], duplicates:[], partial:[], userFns }
 * op = {k:'move', via, dir, speed} | {k:'stop', via} | {k:'motor', m, dir, speed} | {k:'wait', ms}
 *    | {k:'oled', fn, args} | {k:'repeat', n, body} | {k:'call', name} | {k:'other', label, bodies?}
 *    (B형, S3-5) | {k:'if', conds:[cond], bodies:[ops…], hasElse}  | {k:'set', name, value} | {k:'change', name, by}
 *    | {k:'led', fn, color?, index?, value?, var?}   (포니봇 LED: ai_ponybot_light v1.0.0 neopixel.* — leds.js 머리 주석의 블록 표)
 *    | {k:'sound', fn:'ring'|'tone'|'rest'|'stop'|'play'|'melody', freq?, melody?}   (music 서랍, 7~8차시 — music.js) → 토큰 SOUND:<fn>
 *    | {k:'radio', fn:'group'|'send'|'sendString'|'sendValue', value?} | {k:'bt', fn:'uart'|'write'}   (11~12차시 라디오·블루투스) → 토큰 RADIO:<fn> · BT:<fn>
 *    이벤트(11~12): 'radio:number'·'radio:string'·'radio:value'(라디오 수신) · 'uart'(블루투스 데이터 수신) · 'bt:connect'·'bt:disconnect'
 *    | {k:'screen', fn:'icon'|'leds'|'arrow'|'number'|'string'|'clear', icon?, arrow?, cells?, value?}   (마이크로비트 LED 화면 5×5, basic 서랍 — matrix.js) → 토큰 SCREEN:<fn>[:아이콘·화살표 이름]
 *    | {k:'color', fn:'init', ver:'V1'|'V2'} (컬러센서 초기화, 9~10차시) → 토큰 COLOR:init:<버전>
 *    | {k:'sound', fn:'effect', effect:'twinkle'} (소리 효과 재생, 9~10차시) → 토큰 SOUND:effect
 * ★9~10차시 표식(op.marks, deepOps marks에서만): LINE:two:<OffOff|OnOn|OnOff|OffOn> · LINE:one:<Left|Right>:<On|Off> · LINE:read:<Left|Right>
 *   · COLOR:R|G|B|light(값 읽기) · COLOR:is:<Red|Green|Blue|Yellow> · COLOR:range — 블록 안(값·조건 칸)에서 그 블록을 쓰면 붙는다
 * cond = {l, op, r, sensor?, value?} 비교(센서는 왼쪽으로 돌려 맞춤: 40 > 조도 → 조도 < 40) | {logic:'&&'|'||', parts} | {not} | {other:true}
 *   l·r = {sensor:'lightLevel'} | {var:'밝기'} | {lit:40} | {dyn}
 * ★비트런(2026-11-01): {k:'servo', fn:'run'|'stop'|'pulse'|'angle', pin:'P0'|'P1'|'P2', value(속도·µs·도)} → 토큰 SERVO:<fn>:<핀> (pxt-servo, XML servoservorun 등)
 *   | {k:'rec', fn:'start'|'play'|'stop'|'erase'} → 토큰 REC:<fn> (audio-recording 녹음 시작·재생 — TS record.*·XML record_*)
 *   이벤트 'logo'(로고를 터치하면 = input.onLogoEvent(TouchButtonEvent.Pressed)·XML input_logo_event), 그 밖의 터치 종류는 'logo:Touched' 등
 *   표식 CALL:<함수 이름>(deepOps marks에서만): 사용자 함수를 부른 자리(펼친 몸통 바로 앞). 이름의 띄어쓰기는 TS처럼 _
 * 토큰: IF[:<센서|변수><연산자>] · SET:<변수> · CHANGE:<변수> · LED:<fn>[:<색 이름>] · REPEAT:<횟수>(12번 이하는 펼쳐서 토큰이 없음)
 *   (예: IF:lightLevel< · LED:showColor:White · LED:create · REPEAT:255). '만약'·반복 안의 블록은 deepOps로 펼쳐 본다
 */
const { parse, memberPath } = require('./tslite');
const { BY_API: SENSOR_BY_API, BY_BLOCK: SENSOR_BY_BLOCK, SENSORS: SENSORS_ALL } = require('./sensors');
const { COLORS: LED_COLORS, colorName: ledColorName, packRGB, hsl: ledHsl } = require('./leds');
const MX = require('./matrix');
/* LED 화면 블록(basic 서랍). XML 블록 이름 = pxt-microbit blockId, 필드 이름은 MakeCode 꼴(i·LEDS·number·text)로 보되 값 모양으로도 찾는다 */
const SCREEN_TS = { 'basic.showIcon': 'icon', 'basic.showLeds': 'leds', 'basic.showArrow': 'arrow', 'basic.showNumber': 'number', 'basic.showString': 'string', 'basic.clearScreen': 'clear' };
const SCREEN_XML = { basic_show_icon: 'icon', device_show_leds: 'leds', basic_show_arrow: 'arrow', device_show_number: 'number', device_print_message: 'string', device_clear_display: 'clear' };

/* ---------- 9~10차시: 라인·컬러 블록(ai_ponybot_basic v1.3.1) ---------- */
// 라인 센서 읽기는 왼쪽·오른쪽이 같은 API·블록이라 채널 인자로 가른다
const LINE_CH = { Left: 'lineLeft', Right: 'lineRight' };
const COLOR_GET = { 'aiPonybot.getRed': 'R', 'aiPonybot.getGreen': 'G', 'aiPonybot.getBlue': 'B', 'aiPonybot.getLight': 'light',
  aiponybot_color_tcs34725_get_red: 'R', aiponybot_color_tcs34725_get_green: 'G', aiponybot_color_tcs34725_get_blue: 'B', aiponybot_color_tcs34725_get_light: 'light' };
/** 블록 하나(API 이름 또는 XML type + 고른 값)가 읽는 센서들과 표식 토큰. f(이름) = 그 칸의 고른 값(enum 마지막 이름) */
function lineColorOf(name, f) {
  const ch = f('channel'), st = f('state');
  if (name === 'aiPonybot.readLineSensor' || name === 'readLineSensor') return { reads: [LINE_CH[ch] || 'lineRight'], marks: ['LINE:read:' + (ch === 'Left' ? 'Left' : 'Right')] };
  if (name === 'aiPonybot.checkTwoLineState' || name === 'checkTwoLineState') return { reads: ['lineLeft', 'lineRight'], marks: ['LINE:two:' + (st || '?')] };
  if (name === 'aiPonybot.checkSingleLineSensor' || name === 'checkSingleLineSensor') return { reads: [LINE_CH[ch] || 'lineRight'], marks: ['LINE:one:' + (ch === 'Left' ? 'Left' : 'Right') + ':' + (st || '?')] };
  if (COLOR_GET[name]) return { reads: [{ R: 'colorR', G: 'colorG', B: 'colorB', light: 'colorLight' }[COLOR_GET[name]]], marks: ['COLOR:' + COLOR_GET[name]] };
  if (name === 'aiPonybot.isColorAdvanced' || name === 'aiponybot_color_sensor_is_color_advanced') return { reads: ['colorR', 'colorG', 'colorB'], marks: ['COLOR:is:' + (f('color') || '?')] };
  if (name === 'aiPonybot.isColorInRange' || name === 'aiponybot_color_sensor_is_in_range') return { reads: ['colorR', 'colorG', 'colorB'], marks: ['COLOR:range'] };
  return null;
}
const TS_ARG = { 'aiPonybot.readLineSensor': ['channel'], 'aiPonybot.checkTwoLineState': ['state'], 'aiPonybot.checkSingleLineSensor': ['channel', 'state'], 'aiPonybot.isColorAdvanced': ['color'] };
/** TS 호출 → lineColorOf */
function tLineColor(n) {
  const p = memberPath(n.callee) || '', names = TS_ARG[p] || [];
  return lineColorOf(p, (k) => { const i = names.indexOf(k); return i < 0 ? null : lastSeg(memberPath(n.args[i] || {}) || ''); });
}
/** XML 블록 → lineColorOf */
const xLineColor = (b) => lineColorOf(b.type, (k) => (b.fields[k] != null ? lastSeg(b.fields[k]) : null));
/** XML 블록 값 칸 안의 표식(9~10차시) */
function xMarks(b, out = []) {
  if (!b) return out;
  const lc = xLineColor(b); if (lc) out.push(...lc.marks);
  Object.values(b.values).forEach((v) => xMarks(v, out));
  return out;
}
/** TS 식 안의 표식(9~10차시). 함수 몸통·만약 칸은 빼고, 만약은 모든 조건(아니면 만약 포함) */
function tMarks(n, out = []) {
  if (!n || typeof n !== 'object') return out;
  if (Array.isArray(n)) { n.forEach((x) => tMarks(x, out)); return out; }
  if (n.type === 'If') { for (let c = n; c && c.type === 'If'; c = c.alt) tMarks(c.test, out); return out; }
  if (n.type === 'Call') { const lc = tLineColor(n); if (lc) out.push(...lc.marks); }
  if (n.type === 'Func') return out;
  for (const k of Object.keys(n)) if (k !== 'line' && k !== 'cons' && k !== 'alt' && k !== 'body') tMarks(n[k], out);
  return out;
}
const NORMAL_SYM = { Forward: '↑', Backward: '↓', Clockwise: '↶', CounterClockwise: '↷' };
const MEC_SYM = { LeftForward: '↖', Forward: '↑', RightForward: '↗', Left: '←', Stop: 's', Right: '→', LeftBackward: '↙', Backward: '↓', RightBackward: '↘' };
const OLED_FNS = ['clear', 'pixel', 'showString', 'showNumber', 'printString', 'printNumber', 'horizontalLine', 'verticalLine', 'rectangle'];
const HATS = new Set(['pxt-on-start', 'device_forever', 'device_button_event', 'function_definition', 'procedures_defnoreturn', 'input_on_sound']); // input_on_sound(V2 '소리 감지 시', 7~8차시)
// 소리 블록(7~8차시): TS music.* ↔ XML 블록 type → fn. play(tonePlayable) = 'play', 멜로디(내장·글자) = 'melody'
const SOUND_TS = { 'music.ringTone': 'ring', 'music.playTone': 'tone', 'music.rest': 'rest', 'music.stopAllSounds': 'stop', 'music.stopMelody': 'stop', 'music.startMelody': 'melody' };
const SOUND_XML = { device_ring: 'ring', device_play_note: 'tone', device_rest: 'rest', music_stop_all_sounds: 'stop', device_stop_melody: 'stop', device_start_melody: 'melody' };
const SOUND_PLAY_TS = ['music.play', 'music._playDefaultBackground'], SOUND_PLAY_XML = ['music_playable_play', 'music_playable_play_default_bkg'];
// 11~12차시: 라디오 수신(MakeCode 블록 radio_on_number_drag 등, 확인: PPT 11~12 코드 main.blocks)·블루투스 이벤트 → 이벤트 이름
const EVENT_XML = { radio_on_number_drag: 'radio:number', radio_on_number: 'radio:number', radio_on_string_drag: 'radio:string', radio_on_string: 'radio:string', radio_on_value_drag: 'radio:value', radio_on_value: 'radio:value',
  bluetooth_on_data_received: 'uart', bluetooth_on_connected: 'bt:connect', bluetooth_on_disconnected: 'bt:disconnect' };
const EVENT_TS = { 'radio.onReceivedNumber': 'radio:number', 'radio.onReceivedString': 'radio:string', 'radio.onReceivedValue': 'radio:value', 'bluetooth.onUartDataReceived': 'uart', 'bluetooth.onBluetoothConnected': 'bt:connect', 'bluetooth.onBluetoothDisconnected': 'bt:disconnect' };
const RADIO_TS = { 'radio.setGroup': 'group', 'radio.sendNumber': 'send', 'radio.sendString': 'sendString', 'radio.sendValue': 'sendValue' };
const RADIO_XML = { radio_set_group: 'group', radio_datagram_send: 'send', radio_datagram_send_string: 'sendString', radio_datagram_send_value: 'sendValue' };
const BT_TS = { 'bluetooth.startUartService': 'uart', 'bluetooth.uartWriteString': 'write', 'bluetooth.uartWriteLine': 'write', 'bluetooth.uartWriteNumber': 'write', 'bluetooth.uartWriteValue': 'write' };
const BT_XML = { bluetooth_start_uart_service: 'uart', bluetooth_uart_write: 'write', bluetooth_uart_writestring: 'write', bluetooth_uart_writenumber: 'write', bluetooth_uart_writevalue: 'write', bluetooth_uart_write_line: 'write' };
const isHat = (t) => HATS.has(t) || /_event$/.test(t) || !!EVENT_XML[t];
/* 학생에게 보여 줄 블록 이름표(블록 type 이름 대신). 따옴표 안은 도구상자 이름 그대로, 줄임말은 이동·메카넘·일시중지·정지 블록만(UX 라이팅 5차 용어표) */
const BLOCK_KO = {
  aiponybot_motor_runNormal: '이동 블록', aiponybot_motor_runMecanum: '메카넘 블록',
  aiponybot_motor_runMotor: '모터 하나를 돌리는 블록', aiponybot_motor_stopMotor: '모터 하나를 멈추는 블록',
  aiponybot_motor_stopAllMotors: '"모든 모터 정지" 블록', device_pause: '일시중지 블록', controls_repeat_ext: '반복 블록',
  aiPonybot_printNumber: '"숫자 출력 - 내용, 줄바꿈" 블록', aiPonybot_printString: '"문장 출력 - 내용, 줄바꿈" 블록',
  aiPonybot_showNumber: '"숫자 출력 - 내용, 위치, 색상" 블록', aiPonybot_showString: '"문장 출력 - 내용, 위치, 색상" 블록',
  aiPonybot_rectangle: '"사각형 출력" 블록', aiPonybot_horizontalLine: '"수평선 출력" 블록', aiPonybot_verticalLine: '"수직선 출력" 블록',
  aiPonybot_pixel: '"픽셀 출력" 블록', aiPonybot_clear: '"디스플레이 지우기" 블록',
  // LED 화면(basic 서랍, 한국어 MakeCode 블록 글자)
  basic_show_icon: '"아이콘 출력" 블록', device_show_leds: '"LED 출력" 블록', basic_show_arrow: '"화살표 출력" 블록', device_show_number: '"숫자 출력" 블록', device_print_message: '"문자열 출력" 블록', device_clear_display: '"LED 스크린 지우기" 블록',
  'pxt-on-start': '"시작하면" 블록', device_forever: '"무한반복" 블록', device_button_event: '버튼 누를 때 블록',
  // 7~8차시: 초음파·소리(블록 글자는 lesson07-08/content/blocks.md — 확장 소스·PPT 화면)
  aiponybot_sonar_ping: '"단위로 측정한 거리" 블록', device_ring: '"소리 내기(Hz)" 블록', music_stop_all_sounds: '"모든 소리 끄기" 블록',
  music_playable_play: '"재생" 블록', music_playable_play_default_bkg: '"멜로디 출력" 블록', input_on_sound: '"소리 감지 시" 블록',
  typescript_statement: '글자로 된 회색 블록', typescript_expression: '글자로 된 회색 블록',
  // B형(S3-5): 포니봇 LED(ponybot light 서랍, 블록 글자는 확장 소스 그대로)·만약·변수
  neopixel_create: '"라이트 설정(P8에 연결된 4개의 라이트)" 블록', neopixel_set_strip_color: '"라이트를 모두 ~으로 켜기" 블록', neopixel_clear: '"라이트 모두 끄기" 블록',
  neopixel_set_brightness: '"라이트의 밝기를 ~로 변경하기" 블록', neopixel_set_pixel_color: '"~번째 라이트 색상을 ~으로 설정하기" 블록', neopixel_show: '"라이트를 설정한대로 켜기" 블록',
  neopixel_set_strip_rainbow: '"라이트 무지개 효과" 블록', neopixel_show_bar_graph: '"라이트 그래프 효과" 블록',
  controls_if: '"만약" 블록', variables_set: '변수에 값을 넣는 블록', variables_change: '변수 값을 바꾸는 블록',
  // 비트런: 서보(pxt-servo)·녹음(audio-recording)·로고 터치 — 블록 글자는 planning/bitrun/content/blocks.md
  servoservorun: '"연속 서보 … 속도로 회전" 블록', servoservostop: '"서보 정지" 블록', servoservosetpulse: '"서보 펄스를 … μs로 설정" 블록', servoservosetangle: '"서보 각도" 블록',
  record_startRecording: '"녹음 시작" 블록', record_playAudio: '"녹음 재생" 블록', input_logo_event: '"로고를 터치하면" 블록',
};
const SERVO_XML = { servoservorun: 'run', servoservostop: 'stop', servoservosetpulse: 'pulse', servoservosetangle: 'angle' };
const SERVO_TS = { run: 'run', stop: 'stop', setPulse: 'pulse', setAngle: 'angle' };
const REC_TS = { 'record.startRecording': 'start', 'record.playAudio': 'play', 'record.stopAudio': 'stop', 'record.eraseRecording': 'erase' };
const REC_XML = { record_startRecording: 'start', record_playAudio: 'play', record_stopAudio: 'stop', record_eraseRecording: 'erase' };
/** 함수 이름(XML은 띄어쓰기, TS는 _) → 토큰용 이름 */
const fnTokName = (n) => String(n || '').trim().replace(/\s+/g, '_');
const CMP_XML = { EQ: '==', NEQ: '!=', LT: '<', LTE: '<=', GT: '>', GTE: '>=' };
const CMP_FLIP = { '<': '>', '>': '<', '<=': '>=', '>=': '<=', '==': '==', '!=': '!=' };
const STRIP_FNS = ['showColor', 'clear', 'setBrightness', 'setPixelColor', 'show', 'showRainbow', 'showBarGraph'];
const LED_XML = { neopixel_set_strip_color: 'showColor', neopixel_clear: 'clear', neopixel_set_brightness: 'setBrightness', neopixel_set_pixel_color: 'setPixelColor', neopixel_show: 'show', neopixel_set_strip_rainbow: 'showRainbow', neopixel_show_bar_graph: 'showBarGraph' };
const NOT_STRIP = new Set(['aiPonybot', 'basic', 'input', 'music', 'led', 'radio', 'bluetooth', 'pins', 'serial', 'control', 'game', 'images', 'Math', 'neopixel']);
/** 비교 하나를 센서(또는 변수)가 왼쪽에 오게 맞춤 */
function cmpCond(l, op, r) {
  if ((!l.sensor && r.sensor) || (l.lit !== undefined && r.lit === undefined)) { [l, r] = [r, l]; op = CMP_FLIP[op] || op; }
  return { l, op, r, sensor: l.sensor || null, value: typeof r.lit === 'number' ? r.lit : null };
}
/** 조건 → 토큰 꼬리(IF:lightLevel< · IF:밝기> · IF) */
const condTag = (c) => (c && c.op ? `:${c.sensor || (c.l && c.l.var) || '?'}${c.op}` : '');
/** 블록 type → 학생용 이름('… 블록'으로 끝남). 모르는 블록은 빈 문자열 */
const blockName = (type) => BLOCK_KO[type] || '';

/* ---------- 1) 아주 작은 XML 파서 (Blockly XML 전용, DOM 불필요 → Worker/Node에서도 동작) ---------- */
function parseXml(xml) {
  const root = { name: '#root', attrs: {}, children: [], text: '' }; const stack = [root];
  const ent = (s) => s.replace(/&(lt|gt|amp|quot|apos|#\d+|#x[0-9a-f]+);/gi, (m, e) => ({ lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" }[e] || (e[1] === 'x' || e[1] === 'X' ? String.fromCodePoint(parseInt(e.slice(2), 16)) : String.fromCodePoint(+e.slice(1)))));
  const re = /<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<!\[CDATA\[([\s\S]*?)\]\]>|<\/([\w:.-]+)\s*>|<([\w:.-]+)((?:\s+[\w:.-]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>|([^<]+)/g;
  let m;
  while ((m = re.exec(xml))) {
    const top = stack[stack.length - 1];
    if (m[1] !== undefined) top.text += m[1];
    else if (m[2]) { if (stack.length < 2 || top.name !== m[2]) throw new Error('XML 태그 짝이 맞지 않아요: ' + m[2]); stack.pop(); }
    else if (m[3]) {
      const el = { name: m[3], attrs: {}, children: [], text: '' };
      m[4].replace(/([\w:.-]+)\s*=\s*("([^"]*)"|'([^']*)')/g, (_, k, __, a, b) => { el.attrs[k] = ent(a !== undefined ? a : b); });
      top.children.push(el); if (!m[5]) stack.push(el);
    } else if (m[6] && m[6].trim()) top.text += ent(m[6]);
  }
  if (stack.length !== 1) throw new Error('XML이 닫히지 않았어요');
  return root;
}
const kids = (el, name) => el.children.filter((c) => c.name === name);
const kid = (el, name, attrName) => el.children.find((c) => c.name === name && (attrName === undefined || c.attrs.name === attrName));

/** <block>/<shadow> 요소 → Block {type,id,disabled,fields,values,statements,next,mutation} */
function toBlock(el) {
  if (!el) return null;
  const b = { type: el.attrs.type, id: el.attrs.id, x: +el.attrs.x || 0, y: +el.attrs.y || 0, disabled: el.attrs.disabled === 'true', shadow: el.name === 'shadow', fields: {}, values: {}, statements: {}, next: null, mutation: null };
  for (const c of el.children) {
    if (c.name === 'field') b.fields[c.attrs.name] = c.attrs.name === 'VAR' && c.text ? c.text.replace(/\s/g, '_') : c.text; // 변수 이름의 띄어쓰기는 TS에서 _ (MakeCode: '센서 값' → 센서_값)
    else if (c.name === 'value') { const real = kid(c, 'block'), sh = kid(c, 'shadow'); b.values[c.attrs.name] = toBlock(real || sh); }
    else if (c.name === 'statement') b.statements[c.attrs.name] = toBlock(kid(c, 'block'));
    else if (c.name === 'next') b.next = toBlock(kid(c, 'block'));
    else if (c.name === 'mutation') b.mutation = c.attrs;
  }
  return b;
}
const chain = (b) => { const out = []; for (let x = b; x; x = x.next) out.push(x); return out; };
function countBlocks(b) { if (!b) return 0; let n = b.shadow ? 0 : 1; for (const v of Object.values(b.values)) n += countBlocks(v); for (const s of Object.values(b.statements)) n += chain(s).reduce((a, x) => a + countBlocks(x), 0); return n + (b.next ? countBlocks(b.next) : 0); }

function literal(b) {
  if (!b) return null;
  switch (b.type) {
    case 'math_number': case 'math_whole_number': case 'math_integer': return +b.fields.NUM;
    case 'math_number_minmax': return +b.fields.SLIDER;
    case 'timePicker': return +b.fields.ms;
    case 'text': return b.fields.TEXT;
    case 'logic_boolean': return b.fields.BOOL === 'TRUE';
    default: return { dyn: b.type };
  }
}
/** XML 블록의 값 칸 안에서 읽는 센서 이름들(문장·다음 블록은 빼고) */
function xReads(b, out = new Set()) {
  if (!b) return out;
  const lc = xLineColor(b);
  if (lc) lc.reads.forEach((r) => out.add(r)); else if (SENSOR_BY_BLOCK[b.type]) out.add(SENSOR_BY_BLOCK[b.type]);
  Object.values(b.values).forEach((v) => xReads(v, out));
  return out;
}
const lastSeg = (s) => String(s || '').split('.').pop();
const xVar = (b) => (b && /^variables_get/.test(b.type) ? b.fields.VAR : null); // 값 칸에 끼운 변수 이름(설계 개정 2: arg 'loopvar')
/** XML 값 블록 → 비교 피연산자 */
function xOperand(b) {
  if (!b) return { dyn: 'none' };
  const v = literal(b);
  if (typeof v === 'number') return { lit: v };
  { const lc = xLineColor(b); if (lc && lc.reads.length === 1) return { sensor: lc.reads[0] }; }
  if (SENSOR_BY_BLOCK[b.type]) return { sensor: SENSOR_BY_BLOCK[b.type] };
  if (b.type === 'variables_get') return { var: b.fields.VAR };
  if (/^argument_reporter_/.test(b.type)) return { var: b.fields.VALUE }; // 11~12: 라디오 수신 블록의 receivedNumber 등(끌어 쓰는 값)
  return { dyn: b.type };
}
function xCond(b) {
  if (!b) return { other: true };
  if (b.type === 'logic_compare' && CMP_XML[b.fields.OP]) return cmpCond(xOperand(b.values.A), CMP_XML[b.fields.OP], xOperand(b.values.B));
  if (b.type === 'logic_operation') return { logic: b.fields.OP === 'OR' ? '||' : '&&', parts: [xCond(b.values.A), xCond(b.values.B)] };
  if (b.type === 'logic_negate') return { not: xCond(b.values.BOOL) };
  return { other: true, dyn: b.type };
}
/** XML 색 값 블록 → 색 이름(Red…)·'rgb'·'hsl'·'#RRGGBB'·'?' */
// 색 블록 값이 모두 숫자면 실제 색으로(P3: RGB·16진수·색조 색도 '서로 다른 색'으로 셈). 이름 색과 같으면 이름(Red…), 아니면 '#RRGGBB'
function xColor(b) {
  if (!b) return '?';
  if (b.type === 'neopixel_colors') return lastSeg(b.fields.color) || '?';
  const nums = (...ks) => ks.map((k) => literal(b.values[k]));
  if (b.type === 'neopixel_rgb') { const [r, g, bl] = nums('red', 'green', 'blue'); return [r, g, bl].every((x) => typeof x === 'number') ? ledColorName(packRGB(r, g, bl)) : 'rgb'; }
  if (b.type === 'neopixelHSL') { const [hh, s, l] = nums('hue', 'saturation', 'luminance'); return [hh, s, l].every((x) => typeof x === 'number') ? ledColorName(ledHsl(hh, s, l)) : 'hsl'; }
  if (b.type === 'pick_color_packrgb') { const v = b.values.color; const f = v && Object.values(v.fields).find((x) => /^(0x|#)?[0-9a-f]{6}$/i.test(String(x))); return f ? ledColorName(parseInt(String(f).replace(/^(0x|#)/i, ''), 16)) : 'pick'; }
  if (b.type === 'math_number' && typeof literal(b) === 'number') return ledColorName(literal(b));
  return '?';
}

function blockToOps(b, sink) {
  const ops = [];
  for (const x of chain(b)) {
    const src = { blockId: x.id, type: x.type };
    if (x.disabled) { sink.disabled.push(src); continue; }
    const v = (n) => literal(x.values[n]);
    switch (x.type) {
      case 'aiponybot_motor_runNormal': ops.push({ k: 'move', via: 'normal', dir: NORMAL_SYM[lastSeg(x.fields.direction)] || '?', speed: v('speed'), src }); break;
      case 'aiponybot_motor_runMecanum': ops.push({ k: 'move', via: 'mecanum', dir: MEC_SYM[lastSeg(x.fields.direction)] || '?', speed: v('speed'), src }); break;
      case 'aiponybot_motor_runMotor': ops.push({ k: 'motor', m: +lastSeg(x.fields.index).replace('Motor', ''), dir: lastSeg(x.fields.direction) === 'CounterClockwise' ? -1 : 1, speed: v('speed'), src }); break; // 필드 이름은 추정(index/direction)
      case 'aiponybot_motor_stopMotor': ops.push({ k: 'stopMotor', m: +lastSeg(x.fields.index).replace('Motor', ''), src }); break;
      case 'aiponybot_motor_stopAllMotors': ops.push({ k: 'stop', via: 'all', src }); break;
      case 'device_pause': ops.push({ k: 'wait', ms: v('pause'), src }); break;
      // 비트런: 서보(필드 servo = 'servos.P1', 속도는 speedPicker 그림자의 speed 필드)·녹음
      case 'servoservorun': case 'servoservostop': case 'servoservosetpulse': case 'servoservosetangle': {
        const fn = SERVO_XML[x.type], vb = Object.values(x.values)[0], op = { k: 'servo', fn, pin: lastSeg(x.fields.servo) || '?', src };
        if (fn !== 'stop') op.value = vb && vb.type === 'speedPicker' ? +vb.fields.speed : vb && vb.type === 'protractorPicker' ? +vb.fields.angle : literal(vb);
        ops.push(op); break;
      }
      case 'record_startRecording': case 'record_playAudio': case 'record_stopAudio': case 'record_eraseRecording': ops.push({ k: 'rec', fn: REC_XML[x.type], src }); break;
      case 'radio_set_group': case 'radio_datagram_send': case 'radio_datagram_send_string': case 'radio_datagram_send_value': { // 11~12차시(값 칸 이름은 판마다 달라 마지막 값 칸을 읽음)
        const vs = Object.values(x.values); ops.push({ k: 'radio', fn: RADIO_XML[x.type], value: literal(vs[vs.length - 1]), src }); break;
      }
      case 'bluetooth_start_uart_service': case 'bluetooth_uart_write': case 'bluetooth_uart_writestring': case 'bluetooth_uart_writenumber': case 'bluetooth_uart_writevalue': case 'bluetooth_uart_write_line':
        ops.push({ k: 'bt', fn: BT_XML[x.type], src }); break;
      case 'device_ring': case 'device_play_note': case 'device_rest': case 'music_stop_all_sounds': case 'device_stop_melody': case 'device_start_melody': {
        const op = { k: 'sound', fn: SOUND_XML[x.type], src }; const nb = x.values.note || x.values.frequency;
        if (nb) { const f = nb.fields && (nb.fields.name || nb.fields.note); op.freq = f != null && isFinite(+f) ? +f : literal(nb); }
        ops.push(op); break;
      }
      case 'music_playable_play': case 'music_playable_play_default_bkg': {
        const pb = x.values.toPlay || Object.values(x.values)[0];
        if (pb && pb.type === 'soundExpression_builtinPlayableSoundEffect') { ops.push({ k: 'sound', fn: 'effect', effect: lastSeg(Object.values(pb.fields || {})[0] || ''), src }); break; } // 9~10차시 소리 효과
        const op = { k: 'sound', fn: pb && pb.type === 'music_tone_playable' ? 'play' : 'melody', src };
        if (pb && pb.type === 'device_builtin_melody_playable') op.melody = lastSeg(Object.values(pb.fields || {})[0] || '');
        ops.push(op); break;
      }
      case 'controls_repeat_ext': ops.push({ k: 'repeat', n: v('TIMES'), body: blockToOps(x.statements.DO, sink), src }); break;
      case 'pxt_controls_for': case 'controls_for': { // '변수 index를 0부터 N까지 반복' — TS는 for (let index = 0; index <= N; index++) → 반복 N+1번(TS 쪽과 같은 모양)
        const vn = xVar(x.values.VAR) || x.fields.VAR || 'index', to = v('TO'), from = x.values.FROM ? v('FROM') : 0;
        ops.push({ k: 'repeat', n: typeof to === 'number' && typeof from === 'number' ? to - from + 1 : '?', v: vn, body: markLoopVar(blockToOps(x.statements.DO, sink), vn), src }); break;
      }
      case 'function_call': case 'procedures_callnoreturn': ops.push({ k: 'call', name: x.fields.function_name || (x.mutation && x.mutation.name) || x.fields.NAME, src }); break;
      case 'typescript_statement': case 'typescript_expression': sink.partial.push(src); ops.push({ k: 'other', label: 'grey-js', src }); break;
      // B형(S3-5): 만약·변수·포니봇 LED
      case 'controls_if': {
        const n = +((x.mutation && x.mutation.elseif) || 0), hasElse = !!(x.mutation && +x.mutation.else);
        const conds = [], bodies = [];
        for (let i = 0; i <= n; i++) { conds.push(xCond(x.values['IF' + i])); bodies.push(blockToOps(x.statements['DO' + i], sink)); }
        if (hasElse) bodies.push(blockToOps(x.statements.ELSE, sink));
        ops.push({ k: 'if', conds, bodies, hasElse, src }); break;
      }
      case 'variables_set': {
        const vb = x.values.VALUE;
        if (vb && vb.type === 'neopixel_create') { ops.push({ k: 'led', fn: 'create', var: x.fields.VAR, n: literal(vb.values.numLeds), pin: lastSeg(vb.fields.pin), src }); break; }
        ops.push({ k: 'set', name: x.fields.VAR, value: literal(vb), src }); break;
      }
      case 'variables_change': ops.push({ k: 'change', name: x.fields.VAR, by: literal(x.values.VALUE), src }); break;
      case 'neopixel_set_strip_color': case 'neopixel_clear': case 'neopixel_set_brightness': case 'neopixel_set_pixel_color':
      case 'neopixel_show': case 'neopixel_set_strip_rainbow': case 'neopixel_show_bar_graph': {
        const op = { k: 'led', fn: LED_XML[x.type], src };
        if (op.fn === 'showColor' || op.fn === 'setPixelColor') op.color = xColor(x.values.rgb);
        if (op.fn === 'setPixelColor') { op.index = literal(x.values.pixelOffset); if (xVar(x.values.pixelOffset)) op.argVar = xVar(x.values.pixelOffset); }
        if (op.fn === 'setBrightness') { op.value = literal(x.values.brightness); if (xVar(x.values.brightness)) op.argVar = xVar(x.values.brightness); }
        ops.push(op); break;
      }
      case 'aiponybot_color_init_version': ops.push({ k: 'color', fn: 'init', ver: lastSeg(x.fields.version) || '?', src }); break; // 9~10차시
      case 'basic_show_icon': case 'device_show_leds': case 'basic_show_arrow': case 'device_show_number': case 'device_print_message': case 'device_clear_display': {
        const fn = SCREEN_XML[x.type], op = { k: 'screen', fn, src }, fv = Object.values(x.fields || {});
        if (fn === 'icon') op.icon = MX.iconName(lastSeg(x.fields.i || fv.find((s) => /IconNames\./.test(s)) || ''));
        if (fn === 'leds') {
          const grid = Object.keys(x.fields).filter((k) => /^LED\d\d$/.test(k)); // 옛 꼴: LED00~LED44(열·행) TRUE/FALSE
          op.cells = MX.parseLeds(x.fields.LEDS || fv.find((s) => MX.parseLeds(s)) || '') || (grid.length === 25 ? [0, 1, 2, 3, 4].map((r) => [0, 1, 2, 3, 4].map((c) => (x.fields['LED' + c + r] === 'TRUE' ? '1' : '0')).join('')).join('') : null);
          if (op.cells) { const ic = MX.iconOf(op.cells); if (ic) op.icon = ic; }
        }
        if (fn === 'arrow') { const a = x.values.i || Object.values(x.values)[0]; op.arrow = a && a.fields ? MX.arrowName(lastSeg(Object.values(a.fields)[0])) : null; }
        if (fn === 'number' || fn === 'string') op.value = literal(x.values.number || x.values.text || Object.values(x.values)[0]);
        ops.push(op); break;
      }
      default: {
        const fn = /^aiPonybot_(\w+)$/.exec(x.type);
        if (fn && OLED_FNS.includes(fn[1])) { ops.push({ k: 'oled', fn: fn[1], args: Object.keys(x.values).map((n) => literal(x.values[n])), src }); break; }
        const bodies = Object.values(x.statements).map((s) => blockToOps(s, sink));
        ops.push({ k: 'other', label: x.type, bodies, src });
      }
    }
    const last = ops[ops.length - 1];
    if (last && last.src === src) { const r = [...xReads(x)]; if (r.length) last.reads = r; const mk = xMarks(x); if (mk.length) last.marks = mk; } // B형: 이 블록이 읽는 센서, 9~10차시 표식
  }
  return ops;
}

function irFromXml(xml) {
  const root = parseXml(xml);
  const top = root.children.find((c) => c.name === 'xml') || root;
  const ir = { from: 'xml', scripts: [], floating: [], disabled: [], duplicates: [], partial: [], userFns: {} };
  const seen = new Map();
  for (const el of kids(top, 'block')) {
    const b = toBlock(el);
    if (!isHat(b.type)) { ir.floating.push({ type: b.type, blockId: b.id, count: countBlocks(b), x: b.x, y: b.y }); continue; }
    if (b.disabled) { ir.disabled.push({ blockId: b.id, type: b.type, hat: true }); continue; }
    let event = null;
    if (b.type === 'pxt-on-start') event = 'start';
    else if (b.type === 'device_forever') event = 'forever';
    else if (b.type === 'device_button_event') event = lastSeg(b.fields.NAME);
    else if (b.type === 'device_gesture_event') event = 'gesture:' + lastSeg(b.fields.NAME); // 7~8차시: 흔들림 감지(TS input.onGesture와 같은 이름)
    else if (b.type === 'input_on_sound') event = 'sound:' + lastSeg(b.fields.sound);       // 7~8차시: 큰 소리 감지(V2)
    else if (EVENT_XML[b.type]) event = EVENT_XML[b.type];                                       // 11~12차시: 라디오 수신·블루투스
    else if (b.type === 'input_logo_event') { const k = lastSeg(b.fields.action || 'Pressed'); event = k === 'Pressed' ? 'logo' : 'logo:' + k; } // 비트런: 로고를 터치하면(V2)
    else if (b.type === 'function_definition' || b.type === 'procedures_defnoreturn') { ir.userFns[b.fields.function_name || b.fields.NAME] = blockToOps(b.statements.STACK || b.statements.HANDLER || Object.values(b.statements)[0], ir); continue; }
    else event = b.type + ':' + JSON.stringify(b.fields);
    const ops = blockToOps(b.statements.HANDLER || Object.values(b.statements)[0], ir);
    if (seen.has(event)) { ir.duplicates.push({ event, blockId: b.id }); continue; } // MakeCode는 중복 이벤트를 회색 처리
    seen.set(event, true);
    ir.scripts.push({ event, ops, src: { blockId: b.id } });
  }
  return ir;
}

/* ---------- 2) main.ts → IR ---------- */
function irFromTs(ts) {
  const ast = parse(ts);
  const ir = { from: 'ts', scripts: [], floating: [], disabled: [], duplicates: [], partial: [], userFns: {} };
  const start = [];
  const fnBody = (f) => (f && f.type === 'Func' ? (f.body.type === 'Block' ? f.body.body : [{ type: 'ExprStmt', expr: f.body, line: f.line }]) : []);
  for (const s of ast.body) {
    if (s.type === 'FuncDecl') { ir.userFns[s.name] = stmtsToOps(s.body.body); continue; }
    const call = s.type === 'ExprStmt' && s.expr.type === 'Call' ? s.expr : null;
    const p = call && memberPath(call.callee);
    if (p === 'basic.forever') { pushScript('forever', stmtsToOps(fnBody(call.args[0])), s.line); continue; }
    if (p === 'input.onButtonPressed') { const btn = lastSeg(memberPath(call.args[0]) || '?'); pushScript(btn, stmtsToOps(fnBody(call.args[1])), s.line); continue; }
    if (p === 'input.onGesture') { pushScript('gesture:' + lastSeg(memberPath(call.args[0]) || '?'), stmtsToOps(fnBody(call.args[1])), s.line); continue; }
    if (p === 'input.onSound') { pushScript('sound:' + lastSeg(memberPath(call.args[0]) || '?'), stmtsToOps(fnBody(call.args[1])), s.line); continue; }
    if (p === 'input.onLogoEvent') { const k = lastSeg(memberPath(call.args[0]) || 'Pressed'); pushScript(k === 'Pressed' ? 'logo' : 'logo:' + k, stmtsToOps(fnBody(call.args[1])), s.line); continue; } // 비트런: 로고를 터치하면
    if (EVENT_TS[p]) { const fa = call.args.find((a) => a && a.type === 'Func'); pushScript(EVENT_TS[p], stmtsToOps(fnBody(fa)), s.line); continue; } // 11~12: 함수 인자는 마지막(UART는 구분자 다음)
    start.push(s);
  }
  if (start.length) ir.scripts.unshift({ event: 'start', ops: stmtsToOps(start), src: { line: start[0].line } });
  return ir;
  function pushScript(event, ops, line) {
    if (ir.scripts.some((x) => x.event === event)) ir.duplicates.push({ event, line }); // 실행 시에는 마지막 등록이 이김
    ir.scripts.push({ event, ops, src: { line } });
  }
}
function lit(n) {
  if (!n) return null;
  if (n.type === 'Num' || n.type === 'Str' || n.type === 'Bool') return n.value;
  if (n.type === 'Unary' && n.op === '-' && n.arg.type === 'Num') return -n.arg.value;
  return { dyn: n.type };
}
/** TS 식 안에서 읽는 센서 이름들(B형 'sensor' 규칙용. 3~4 값 해석(lit)은 그대로 둔다) */
function tReads(n, out = new Set()) {
  if (!n || typeof n !== 'object') return out;
  if (Array.isArray(n)) { n.forEach((x) => tReads(x, out)); return out; }
  if (n.type === 'Call') { const lc = tLineColor(n); if (lc) lc.reads.forEach((r) => out.add(r)); else if (SENSOR_BY_API[memberPath(n.callee) || '']) out.add(SENSOR_BY_API[memberPath(n.callee)]); }
  if (n.type === 'Func') return out; // 이벤트 안 함수 몸통은 따로
  for (const k of Object.keys(n)) if (k !== 'line' && k !== 'cons' && k !== 'alt' && k !== 'body') tReads(n[k], out);
  return out;
}
/** TS 식 → 비교 피연산자 / 조건 */
function tOperand(n) {
  const v = lit(n);
  if (typeof v === 'number') return { lit: v };
  if (n && n.type === 'Call') { const lc = tLineColor(n); if (lc && lc.reads.length === 1) return { sensor: lc.reads[0] }; }
  if (n && n.type === 'Call' && SENSOR_BY_API[memberPath(n.callee) || '']) return { sensor: SENSOR_BY_API[memberPath(n.callee)] };
  if (n && n.type === 'Ident') return { var: n.name };
  return { dyn: n ? n.type : 'none' };
}
function tCond(e) {
  if (!e) return { other: true };
  if (e.type === 'Bin' && ['<', '>', '<=', '>=', '==', '===', '!=', '!=='].includes(e.op)) return cmpCond(tOperand(e.l), e.op.replace(/^(==|!=)=$/, '$1'), tOperand(e.r));
  if (e.type === 'Logical') return { logic: e.op, parts: [tCond(e.l), tCond(e.r)] };
  if (e.type === 'Unary' && e.op === '!') return { not: tCond(e.arg) };
  return { other: true, dyn: e.type };
}
/** TS 색 인자 → 색 이름(Red…)·'rgb'·'hsl'·'#RRGGBB'·'?' */
function tColor(n) {
  if (!n) return '?';
  if (n.type === 'Num') return ledColorName(n.value);
  const p = memberPath(n.type === 'Call' ? n.callee : n) || '';
  if (n.type === 'Call' && p === 'neopixel.getColors') return tColor(n.args[0]);
  const allNum = n.type === 'Call' && n.args.length && n.args.every((a) => typeof lit(a) === 'number');
  if (n.type === 'Call' && p === 'neopixel.rgb') return allNum && n.args.length === 3 ? ledColorName(packRGB(...n.args.map(lit))) : 'rgb';
  if (n.type === 'Call' && p === 'neopixel.hsl') return allNum && n.args.length === 3 ? ledColorName(ledHsl(...n.args.map(lit))) : 'hsl';
  if (n.type === 'Call' && p === 'neopixel.pickColorPackRGB') return allNum ? ledColorName(lit(n.args[0]) & 0xFFFFFF) : 'pick';
  if (n.type !== 'Call' && /^NeoPixelColors\.\w+$/.test(p) && LED_COLORS[lastSeg(p)] !== undefined) return lastSeg(p);
  return '?';
}
const tVar = (n) => (n && n.type === 'Ident' ? n.name : null); // 값 칸에 끼운 변수 이름(설계 개정 2: arg 'loopvar'). lit()는 그대로(3~4 결과 보존)
/** 반복 변수(for index …): 몸통 안 블록마다 op.loopVars에 이름을 더한다(펼친 반복에서도 남게 만들 때 표시) */
function markLoopVar(ops, name) {
  if (!name) return ops;
  for (const o of ops || []) { o.loopVars = (o.loopVars || []).concat(name); if (o.body) markLoopVar(o.body, name); (o.bodies || []).forEach((b) => markLoopVar(b, name)); }
  return ops;
}
const isLedCreate = (n) => n && n.type === 'Call' && memberPath(n.callee) === 'neopixel.create';
function stmtsToOps(stmts) {
  const ops = [];
  for (const s of stmts) {
    const n0 = ops.length;
    stmtToOps(s, ops);
    const r = ops.length > n0 ? [...tReads(s)] : []; // B형: 이 문장이 읽는 센서
    if (r.length) for (let i = n0; i < ops.length; i++) if (ops[i].src && ops[i].src.line === s.line) ops[i].reads = r;
    const mk = ops.length > n0 ? tMarks(s) : []; // 9~10차시 표식
    if (mk.length) for (let i = n0; i < ops.length; i++) if (ops[i].src && ops[i].src.line === s.line) ops[i].marks = mk;
  }
  return ops;
}
function stmtToOps(s, ops) {
  {
    const src = { line: s.line };
    // B형(S3-5): 변수 만들기·값 넣기·바꾸기, 포니봇 LED(strip.○○), 만약
    if (s.type === 'VarDecl') {
      if (isLedCreate(s.init)) ops.push({ k: 'led', fn: 'create', var: s.name, n: lit(s.init.args[1]), pin: lastSeg(memberPath(s.init.args[0]) || ''), src });
      else if (s.init && s.init.type !== 'Null') ops.push({ k: 'set', name: s.name, value: lit(s.init), decl: true, src }); // `let x: T = null`은 블록이 아닌 선언
      return;
    }
    if (s.type === 'ExprStmt' && (s.expr.type === 'Assign' || s.expr.type === 'Update') && (s.expr.target || s.expr.arg || {}).type === 'Ident') {
      const e = s.expr, name = (e.target || e.arg).name;
      if (e.type === 'Update') ops.push({ k: 'change', name, by: e.op === '++' ? 1 : -1, src });
      else if (e.op === '=' && isLedCreate(e.value)) ops.push({ k: 'led', fn: 'create', var: name, n: lit(e.value.args[1]), pin: lastSeg(memberPath(e.value.args[0]) || ''), src });
      else if (e.op === '=') ops.push({ k: 'set', name, value: lit(e.value), src });
      else if (e.op === '+=' || e.op === '-=') { const v = lit(e.value); ops.push({ k: 'change', name, by: typeof v === 'number' ? (e.op === '-=' ? -v : v) : v, src }); }
      else ops.push({ k: 'other', label: 'Assign', src });
      return;
    }
    if (s.type === 'ExprStmt' && s.expr.type === 'Call' && s.expr.callee.type === 'Member') {
      const c = s.expr, p = memberPath(c.callee) || '', seg = p.split('.');
      if (seg.length === 2 && !NOT_STRIP.has(seg[0]) && STRIP_FNS.includes(seg[1])) {
        const op = { k: 'led', fn: seg[1], var: seg[0], src };
        if (op.fn === 'showColor') op.color = tColor(c.args[0]);
        if (op.fn === 'setPixelColor') { op.index = lit(c.args[0]); op.color = tColor(c.args[1]); if (tVar(c.args[0])) op.argVar = tVar(c.args[0]); }
        if (op.fn === 'setBrightness') { op.value = lit(c.args[0]); if (tVar(c.args[0])) op.argVar = tVar(c.args[0]); }
        ops.push(op); return;
      }
    }
    if (s.type === 'If') {
      const conds = [], bodies = []; let cur = s;
      for (;;) {
        conds.push(tCond(cur.test)); bodies.push(stmtsToOps(cur.cons.type === 'Block' ? cur.cons.body : [cur.cons]));
        if (cur.alt && cur.alt.type === 'If') { cur = cur.alt; continue; } // else if → 같은 '만약' 블록의 다음 칸
        if (cur.alt) bodies.push(stmtsToOps(cur.alt.type === 'Block' ? cur.alt.body : [cur.alt]));
        break;
      }
      ops.push({ k: 'if', conds, bodies, hasElse: bodies.length > conds.length, src });
      return;
    }
    if (s.type === 'ExprStmt' && s.expr.type === 'Call') {
      const c = s.expr, p = memberPath(c.callee) || '', a = c.args;
      const enumName = (n) => lastSeg(memberPath(n) || '');
      if (p === 'aiPonybot.runNormal') ops.push({ k: 'move', via: 'normal', dir: NORMAL_SYM[enumName(a[0])] || '?', speed: lit(a[1]), src });
      else if (p === 'aiPonybot.runMecanum') ops.push({ k: 'move', via: 'mecanum', dir: MEC_SYM[enumName(a[0])] || '?', speed: lit(a[1]), src });
      else if (p === 'aiPonybot.runMotor') ops.push({ k: 'motor', m: +enumName(a[0]).replace('Motor', ''), dir: enumName(a[1]) === 'CounterClockwise' ? -1 : 1, speed: lit(a[2]), src });
      else if (p === 'aiPonybot.stopMotor') ops.push({ k: 'stopMotor', m: +enumName(a[0]).replace('Motor', ''), src });
      else if (p === 'aiPonybot.stopAllMotors') ops.push({ k: 'stop', via: 'all', src });
      else if (p === 'basic.pause') ops.push({ k: 'wait', ms: lit(a[0]), src });
      else if (p === 'aiPonybot.initColorSensor') ops.push({ k: 'color', fn: 'init', ver: enumName(a[0]) || '?', src }); // 9~10차시
      else if (p === 'music.play' && a[0] && a[0].type === 'Call' && /^music\.builtin(Playable)?SoundEffect$/.test(memberPath(a[0].callee) || '')) ops.push({ k: 'sound', fn: 'effect', effect: enumName(a[0].args[0]), src }); // 9~10차시
      else if (SOUND_TS[p]) { const op = { k: 'sound', fn: SOUND_TS[p], src }; if (op.fn === 'ring' || op.fn === 'tone') { const f = a[0] && a[0].type !== 'Num' ? memberPath(a[0]) : null; op.freq = f && /^Note\./.test(f) ? f : lit(a[0]); } ops.push(op); }
      else if (SOUND_PLAY_TS.includes(p)) {
        const inner = a[0] && a[0].type === 'Call' ? memberPath(a[0].callee) : '', op = { k: 'sound', fn: inner === 'music.tonePlayable' ? 'play' : 'melody', src };
        if (inner === 'music.builtInPlayableMelody' || inner === 'music.builtInMelody') op.melody = lastSeg(memberPath(a[0].args[0]) || '');
        ops.push(op);
      }
      else if (SCREEN_TS[p]) {
        const fn = SCREEN_TS[p], op = { k: 'screen', fn, src };
        if (fn === 'icon') op.icon = MX.iconName(lastSeg(memberPath(a[0] || {}) || ''));
        if (fn === 'leds') { op.cells = a[0] && a[0].type === 'Str' ? MX.parseLeds(a[0].value) : null; if (op.cells) { const ic = MX.iconOf(op.cells); if (ic) op.icon = ic; } }
        if (fn === 'arrow') op.arrow = MX.arrowName(lastSeg(memberPath(a[0] || {}) || ''));
        if (fn === 'number' || fn === 'string') op.value = lit(a[0]);
        ops.push(op);
      }
      else if (p.startsWith('aiPonybot.') && OLED_FNS.includes(p.slice(10))) ops.push({ k: 'oled', fn: p.slice(10), args: a.map(lit), src });
      else if (RADIO_TS[p]) ops.push({ k: 'radio', fn: RADIO_TS[p], value: lit(a[RADIO_TS[p] === 'sendValue' ? 1 : 0]), src });
      else if (BT_TS[p]) ops.push({ k: 'bt', fn: BT_TS[p], src });
      else if (/^servos\.P\d+\.\w+$/.test(p) && SERVO_TS[p.split('.')[2]]) { const fn = SERVO_TS[p.split('.')[2]], op = { k: 'servo', fn, pin: p.split('.')[1], src }; if (fn !== 'stop') op.value = lit(a[0]); ops.push(op); } // 비트런 서보
      else if (REC_TS[p]) ops.push({ k: 'rec', fn: REC_TS[p], src }); // 비트런 녹음
      else if (c.callee.type === 'Ident' && !a.length) ops.push({ k: 'call', name: c.callee.name, src });
      else ops.push({ k: 'other', label: p || 'call', src });
    } else if (s.type === 'For' && isCountedFor(s)) ops.push({ k: 'repeat', n: s.test.r.value + (s.test.op === '<=' ? 1 : 0) - s.init.init.value, v: s.init.name, body: markLoopVar(stmtsToOps(s.body.type === 'Block' ? s.body.body : [s.body]), s.init.name), src });
    else if (s.type === 'While' || s.type === 'For' || s.type === 'ForOf') { const lv = s.type === 'For' && s.init && s.init.type === 'VarDecl' ? s.init.name : null; ops.push(Object.assign({ k: 'other', label: 'loop', bodies: [markLoopVar(stmtsToOps(s.body.type === 'Block' ? s.body.body : [s.body]), lv)], src }, lv ? { v: lv } : {})); }
    else if (s.type === 'Block') ops.push(...stmtsToOps(s.body));
    else ops.push({ k: 'other', label: s.type, src });
  }
}
function isCountedFor(s) {
  return s.init && s.init.type === 'VarDecl' && s.init.init && s.init.init.type === 'Num' && s.test && s.test.type === 'Bin' && (s.test.op === '<' || s.test.op === '<=')
    && s.test.l.type === 'Ident' && s.test.l.name === s.init.name && s.test.r.type === 'Num' && s.update && s.update.type === 'Update' && s.update.op === '++';
}

/* ---------- 3) 정규화: 대체 해법을 같은 모양으로 ---------- */
const QUAD = { '↑': [1, 1, 1, 1], '↓': [-1, -1, -1, -1], '↶': [1, 1, -1, -1], '↷': [-1, -1, 1, 1], '↖': [1, 0, 1, 0], '↗': [0, 1, 0, 1], '←': [1, -1, 1, -1], '→': [-1, 1, -1, 1], '↙': [0, -1, 0, -1], '↘': [-1, 0, -1, 0] }; // [M1,M2,M3,M4]
// opt.calls(비트런, deepOps marks에서만): 사용자 함수를 펼칠 때 그 앞에 표식 CALL:<이름>을 끼운다(함수를 불렀나 / 버튼에 바로 놓았나)
function normalize(ops, userFns = {}, depth = 0, budget = { n: 400 }, opt = null) {
  let out = [];
  for (const op of ops) {
    if (--budget.n < 0) break;
    if (op.k === 'repeat' && typeof op.n === 'number' && op.n >= 0 && op.n <= 12) { for (let i = 0; i < op.n; i++) out.push(...normalize(op.body, userFns, depth, budget, opt)); continue; }
    if (op.k === 'call' && opt && opt.calls) out.push({ k: 'mark', tok: 'CALL:' + fnTokName(op.name), syn: true, call: op.name, src: op.src });
    if (op.k === 'call' && userFns[op.name] && depth < 3) { out.push(...normalize(userFns[op.name], userFns, depth + 1, budget, opt)); continue; }
    if (op.k === 'move' && (op.dir === 's' || op.speed === 0)) { out.push({ k: 'stop', via: op.dir === 's' ? 'mecanum-s' : 'speed0', src: op.src }); continue; }
    if (op.k === 'motor' && op.speed === 0) { out.push({ k: 'stopMotor', m: op.m, src: op.src }); continue; }
    if (op.k === 'wait' && op.ms === 0) continue;
    if (op.k === 'wait' && out.length && out[out.length - 1].k === 'wait' && typeof op.ms === 'number' && typeof out[out.length - 1].ms === 'number') { out[out.length - 1] = Object.assign({}, out[out.length - 1], { ms: out[out.length - 1].ms + op.ms }); continue; }
    out.push(op);
  }
  // 모터 4개 개별 명령(연속) → 같은 바퀴 패턴의 이동/정지로
  const res = [];
  for (let i = 0; i < out.length; i++) {
    const grp = out.slice(i, i + 4);
    if (grp.length === 4 && grp.every((o) => o.k === 'motor' || o.k === 'stopMotor') && new Set(grp.map((o) => o.m)).size === 4) {
      const v = [1, 2, 3, 4].map((m) => { const o = grp.find((g) => g.m === m); return o.k === 'stopMotor' ? 0 : o.dir; });
      const sp = new Set(grp.filter((o) => o.k === 'motor').map((o) => o.speed));
      if (v.every((x) => x === 0)) { res.push({ k: 'stop', via: 'motors', src: grp[0].src }); i += 3; continue; }
      const dir = Object.keys(QUAD).find((d) => QUAD[d].every((x, j) => x === v[j]));
      if (dir && sp.size === 1) { res.push({ k: 'move', via: 'motors', dir, speed: [...sp][0], src: grp[0].src }); i += 3; continue; }
    }
    res.push(out[i]);
  }
  return res;
}
const token = (op) => op.k === 'move' ? 'MOVE:' + op.dir : op.k === 'stop' ? 'STOP' : op.k === 'wait' ? 'WAIT' : op.k === 'oled' ? 'OLED:' + op.fn : op.k === 'motor' ? 'MOTOR' : op.k === 'stopMotor' ? 'STOPM'
  : op.k === 'if' ? 'IF' + condTag(op.conds && op.conds[0]) : op.k === 'set' ? 'SET:' + op.name : op.k === 'change' ? 'CHANGE:' + op.name
  : op.k === 'led' ? 'LED:' + op.fn + (op.color ? ':' + op.color : '')
  : op.k === 'sound' ? 'SOUND:' + op.fn
  : op.k === 'radio' ? 'RADIO:' + op.fn : op.k === 'bt' ? 'BT:' + op.fn
  : op.k === 'screen' ? 'SCREEN:' + op.fn + ((op.fn === 'icon' || op.fn === 'leds') && op.icon ? ':' + op.icon : op.fn === 'arrow' && op.arrow ? ':' + op.arrow : '')
  : op.k === 'color' ? 'COLOR:' + op.fn + (op.ver ? ':' + op.ver : '') : op.k === 'sound' ? 'SOUND:' + op.fn // 9~10차시
  : op.k === 'repeat' ? 'REPEAT:' + (typeof op.n === 'number' ? op.n : '?') // 펼치지 않은 반복(13번 이상·변수 횟수). 횟수 그대로(5~6 '255번 반복')
  : op.k === 'mark' ? op.tok // deepOps 표식(CMP:< · ELSE · SENSE:light · CALL:이름)
  : op.k === 'servo' ? 'SERVO:' + op.fn + ':' + op.pin : op.k === 'rec' ? 'REC:' + op.fn // 비트런
  : 'OTHER:' + (op.label || op.k);
/** 이벤트 안 블록을 '만약'·반복 안쪽까지 펼친 토큰열(B형 규칙 deep·sensor·cond용). 반복(13번 이상)은 몸통을 한 번만
 *  marks = true면 표식(블록이 아닌 토큰)도 끼움: 만약 뒤 CMP:<연산자>(조건마다), 아니면 칸 앞 ELSE, 센서를 읽는 블록 뒤 SENSE:<짧은 이름> */
function deepOps(ops, userFns = {}, depth = 0, out = [], marks = false, inLoop = false) {
  if (typeof depth === 'object') { marks = !!depth.marks; depth = 0; } // deepOps(ops, userFns, { marks: true })
  const cmps = (c, acc = []) => { if (!c) return acc; if (c.op) acc.push(c.op); if (c.parts) c.parts.forEach((p) => cmps(p, acc)); if (c.not) cmps(c.not, acc); return acc; };
  for (const op of normalize(ops, userFns, 0, undefined, marks ? { calls: true } : null)) {
    if (inLoop) op.inLoop = true; // 반복(13번 이상)·while 몸통 안의 블록(P3 'index 반복도 인정' 같은 규칙의 inLoop 칸)
    out.push(op);
    if (marks) {
      (op.reads || []).forEach((n) => out.push({ k: 'mark', tok: 'SENSE:' + ((SENSORS_ALL[n] && SENSORS_ALL[n].tok) || n), syn: true, src: op.src }));
      (op.marks || []).forEach((t) => out.push({ k: 'mark', tok: t, syn: true, src: op.src })); // 9~10차시 LINE:·COLOR:
      if (op.k === 'if') (op.conds || []).forEach((c) => cmps(c).forEach((o) => out.push({ k: 'mark', tok: 'CMP:' + o, syn: true, src: op.src })));
    }
    if (depth > 6) continue;
    if (op.k === 'repeat' && op.body) deepOps(op.body, userFns, depth + 1, out, marks, true);
    (op.bodies || []).forEach((b, i) => {
      if (marks && op.k === 'if' && op.hasElse && i === op.bodies.length - 1) out.push({ k: 'mark', tok: 'ELSE', syn: true, src: op.src });
      deepOps(b, userFns, depth + 1, out, marks, inLoop || (op.k === 'other' && op.label !== 'if' && !/^controls_if$/.test(op.label)));
    });
  }
  return out;
}

/** code = {ts, blocks}: XML이 있으면 XML 우선(떠 있는 블록·회색 블록 정보), 실패 시 TS */
function buildIR(code) {
  let ir = null, xmlErr = null;
  if (code.blocks && code.blocks.trim()) { try { ir = irFromXml(code.blocks); } catch (e) { xmlErr = e.message; } }
  let tsIr = null, tsErr = null;
  try { tsIr = irFromTs(code.ts || ''); } catch (e) { tsErr = e; }
  if (!ir) ir = tsIr || { from: 'none', scripts: [], floating: [], disabled: [], duplicates: [], partial: [], userFns: {} };
  ir.errors = { xml: xmlErr, ts: tsErr && tsErr.message };
  ir.consistent = tsIr && ir.from === 'xml' ? sameShape(ir, tsIr) : null;
  return ir;
}
/** 의미 서명: 이벤트별 정규화 토큰열(블록 위치 무관). lockKey에는 떠 있는/비활성 블록 수까지 포함 */
function signature(ir, withStructure = false) {
  const s = ir.scripts.map((x) => x.event + '=' + normalize(x.ops, ir.userFns).map(token).join(',')).sort().join('|');
  return withStructure ? `${s}#f${ir.floating.length}d${ir.disabled.length}p${ir.partial.length}` : s;
}
// 비어 있는 '시작하면'은 XML에만 있고 TS에는 나오지 않으므로 빈 스크립트는 빼고 비교한다(빈 무한반복도 같은 취급)
// LED '숫자 출력' 같은 기타 블록은 XML 블록 이름과 TS 함수 이름이 달라 'OTHER:' 토큰이 어긋나므로 비교에서 뺀다(교사 테스트 4차)
// 변수 값 넣기(SET:)도 뺀다: MakeCode TS는 쓰는 변수를 맨 위에 `let 밝기 = 0`으로 미리 적어 XML(시작하면 블록 없음)과 어긋나기 때문(S3-5)
function sameShape(a, b) { const sig = (ir) => ir.scripts.map((x) => x.event + '=' + normalize(x.ops || [], ir.userFns).map(token).filter((t) => !t.startsWith('OTHER:') && !t.startsWith('SET:')).map((t) => (t.startsWith('SCREEN:') ? t.split(':').slice(0, 2).join(':') : t)).join(',')).filter((s) => !s.endsWith('=')).sort().join('|'); return sig(a) === sig(b); } // LED 화면은 블록 종류만 맞춤(아이콘 이름은 XML 필드 꼴에 기대지 않게)

/** 반영 전 미리보기용 블록 변화 요약: "메카넘 이동(→) +1, 일시중지 +4" (이벤트 구분 없이 토큰 개수 차이) */
function diffSummary(before, after) {
  const count = (ir) => { const m = new Map(); for (const s of ir.scripts) for (const o of normalize(s.ops, ir.userFns)) { const t = token(o); m.set(t, (m.get(t) || 0) + 1); } return m; };
  const a = count(before), b = count(after), keys = new Set([...a.keys(), ...b.keys()]), out = [];
  for (const k of keys) { const d = (b.get(k) || 0) - (a.get(k) || 0); if (d) out.push({ token: k, delta: d }); }
  const evA = new Set(before.scripts.map((s) => s.event)), evB = new Set(after.scripts.map((s) => s.event));
  return { blocks: out.sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta)), addedEvents: [...evB].filter((e) => !evA.has(e)), removedEvents: [...evA].filter((e) => !evB.has(e)) };
}

/** 코치 입력용 한국어 요약. 문자열 내용은 보내지 않고 길이만(예시 전화번호가 개인정보 거절을 부르지 않게) */
function summarizeKo(ir, maxOps = 40) {
  const EV = { start: '시작하면', forever: '무한반복', A: 'A 버튼', B: 'B 버튼', AB: 'A+B 버튼', logo: '로고 터치' };
  const v = (x) => (x && typeof x === 'object' ? '변수/식' : typeof x === 'string' ? `글자 ${x.length}자${/[^\x20-\x7e]/.test(x) ? '(한글 포함)' : ''}` : x);
  const one = (o) => o.k === 'move' ? `${o.via === 'mecanum' ? '메카넘' : '포니봇'} ${o.dir} 속도 ${v(o.speed)}` : o.k === 'wait' ? `일시중지 ${v(o.ms)}ms` : o.k === 'stop' ? '모든 모터 정지'
    : o.k === 'motor' ? `모터${o.m} ${o.dir > 0 ? '정회전' : '역회전'} ${v(o.speed)}` : o.k === 'stopMotor' ? `모터${o.m} 정지` : o.k === 'oled' ? `${o.fn}(${o.args.map(v).join(', ')})`
    : o.k === 'repeat' ? `반복 ${v(o.n)}회 [${o.body.map(one).join(' → ')}]` : o.k === 'call' ? `함수 ${o.name}`
    : o.k === 'if' ? `만약(${o.conds.map(cs).join(' / ')}) ${o.bodies.map((b) => `[${b.map(one).join(' → ')}]`).join(' 아니면 ')}`
    : o.k === 'set' ? `변수 ${o.name} = ${v(o.value)}` : o.k === 'change' ? `변수 ${o.name} 바꾸기 ${v(o.by)}`
    : o.k === 'led' ? `LED ${o.fn}${o.color ? `(${o.color})` : ''}${o.value != null ? `(${v(o.value)})` : ''}`
    : o.k === 'servo' ? `서보 ${o.pin} ${o.fn === 'run' ? `속도 ${v(o.value)}` : o.fn === 'stop' ? '정지' : o.fn === 'pulse' ? `펄스 ${v(o.value)}` : `각도 ${v(o.value)}`}` : o.k === 'rec' ? `녹음 ${o.fn}` : `기타(${o.label})`;
  const opd = (x) => (!x ? '?' : x.sensor ? x.sensor : x.var ? `변수 ${x.var}` : x.lit !== undefined ? x.lit : '식');
  function cs(c) { return !c ? '?' : c.op ? `${opd(c.l)} ${c.op} ${opd(c.r)}` : c.logic ? c.parts.map(cs).join(` ${c.logic} `) : c.not ? `아님 ${cs(c.not)}` : '조건'; }
  const lines = ir.scripts.map((s) => `${EV[s.event] || s.event}: ${s.ops.slice(0, maxOps).map(one).join(' → ') || '(비어 있음)'}`);
  if (ir.floating.length) lines.push(`연결 안 된 블록 묶음 ${ir.floating.length}개`);
  return lines.join('\n');
}

module.exports = { fnTokName, parseXml, irFromXml, irFromTs, buildIR, normalize, token, deepOps, signature, sameShape, diffSummary, summarizeKo, NORMAL_SYM, MEC_SYM, isHat, blockName };

  };
  defs["robot"] = function (module, exports, require) {
/* 포니봇 차체 모델: 확장 v1.0.2의 바퀴별 PWM 매핑 → 4바퀴 정규화 속도 → X형 메카넘 정기구학 → 자세 적분.
 * 좌표: 월드 x 오른쪽, y 위(cm). heading θ: +x에서 반시계(rad). 시작 θ = 90°(화면 위쪽을 봄).
 * 로봇 좌표: vx 앞, vy 왼쪽, ω 반시계 +.
 *   vx = V·(FL+FR+RL+RR)/4,  vy = V·k_lat·(−FL+FR+RL−RR)/4,  ω = W·(−FL+FR−RL+RR)/4
 * 보정 상수(실측 필요): W = 90°/0.4s (↷ 255에서 400ms ≈ 90°, 슬라이드 19), V = W·(lx+ly).
 */
const DEG = Math.PI / 180;
const DEFAULTS = {
  turnMsPer90: 404.4,   // 속도 255에서 90° 도는 시간(ms): 교안 '↷ 255 → 일시중지 400' + 다음 명령 I2C 4.4ms
  lxly: 11.5,           // 바퀴 중심까지 반축거리 합 lx+ly (cm, 추정) → V = W·(lx+ly)
  lateralEff: 0.85,     // 옆/대각선 이동 효율(롤러 미끄럼, 추정)
  deadband: 20,         // 이 속도 이하에서는 바퀴가 안 돎(추정)
  tau: 0,               // 1차 지연 시정수(ms). 0이면 즉시
  dt: 5,                // 적분 간격(ms)
};
// 바퀴 순서: FL=M4, FR=M1, RL=M3, RR=M2.  +1 앞으로, −1 뒤로, 0 정지  (확장 소스의 setPwm 주석 그대로)
const NORMAL = {
  Forward: { M1: 1, M2: 1, M3: 1, M4: 1 }, Backward: { M1: -1, M2: -1, M3: -1, M4: -1 },
  Clockwise: { M1: 1, M2: 1, M3: -1, M4: -1 },          // 블록 모양 ↶ = 실제 제자리 좌회전
  CounterClockwise: { M1: -1, M2: -1, M3: 1, M4: 1 },   // 블록 모양 ↷ = 실제 제자리 우회전
};
const MECANUM = {
  LeftForward: { M1: 1, M2: 0, M3: 1, M4: 0 }, Forward: { M1: 1, M2: 1, M3: 1, M4: 1 }, RightForward: { M1: 0, M2: 1, M3: 0, M4: 1 },
  Left: { M1: 1, M2: -1, M3: 1, M4: -1 }, Stop: { M1: 0, M2: 0, M3: 0, M4: 0 }, Right: { M1: -1, M2: 1, M3: -1, M4: 1 },
  LeftBackward: { M1: 0, M2: -1, M3: 0, M4: -1 }, Backward: { M1: -1, M2: -1, M3: -1, M4: -1 }, RightBackward: { M1: -1, M2: 0, M3: -1, M4: 0 },
};

class Robot {
  constructor(opts = {}) {
    this.o = Object.assign({}, DEFAULTS, opts);
    this.W = (90 * DEG) / (this.o.turnMsPer90 / 1000);   // rad/s at 255
    this.V = this.W * this.o.lxly;                        // cm/s at 255
    this.reset();
  }
  reset() {
    this.x = 0; this.y = 0; this.th = 90 * DEG; this.t = 0;
    this.cmd = { M1: 0, M2: 0, M3: 0, M4: 0 };   // 명령 PWM(−255..255)
    this.cur = { M1: 0, M2: 0, M3: 0, M4: 0 };   // 실제 정규화 속도(−1..1)
    this.path = [[0, 0, 0, this.th]]; this.turned = 0; this.dist = 0; this.warnings = new Set(); this.events = [];
  }
  _speed(s) { if (typeof s !== 'number' || !isFinite(s)) { this.warnings.add('SPEED_NAN'); return 0; } if (s < 0 || s > 255) this.warnings.add('SPEED_RANGE'); return Math.max(0, Math.min(255, Math.trunc(s))); }
  _apply(map, speed, label) { const s = this._speed(speed); for (const m of ['M1', 'M2', 'M3', 'M4']) this.cmd[m] = map[m] * s; this.events.push([this.t, label, s]); this.last = { label, raw: speed, s }; } // last.raw: 블록에 넣은 속도 그대로(map·constrain 소수, 7~8차시 expect.motors.speed)
  runNormal(dirName, speed) { const map = NORMAL[dirName]; if (!map) throw new Error('알 수 없는 방향 ' + dirName); this._apply(map, speed, 'normal.' + dirName); }
  runMecanum(dirName, speed) { const map = MECANUM[dirName]; if (!map) throw new Error('알 수 없는 메카넘 방향 ' + dirName); this._apply(map, speed, 'mecanum.' + dirName); }
  /** runMotor(Motor1..4, Clockwise=+1 정회전(앞)/CounterClockwise=−1, speed): 확장은 M3·M4 극성을 내부에서 뒤집어 '정회전=앞'으로 맞춘다 */
  runMotor(m, dir, speed) { this.cmd['M' + m] = Math.sign(dir) * this._speed(speed); this.events.push([this.t, `motor.M${m}`, dir * speed]); this.last = { label: 'motor', raw: speed, s: this._speed(speed) }; }
  stopMotor(m) { this.cmd['M' + m] = 0; this.events.push([this.t, `stop.M${m}`, 0]); }
  stopAll() { for (const m of ['M1', 'M2', 'M3', 'M4']) this.cmd[m] = 0; this.events.push([this.t, 'stopAll', 0]); this.last = { label: 'stop', raw: 0, s: 0 }; }
  moving() { return ['M1', 'M2', 'M3', 'M4'].some((m) => this.cmd[m] !== 0); }
  _norm(pwm) { const a = Math.abs(pwm), d = this.o.deadband; return a <= d ? 0 : Math.sign(pwm) * (a - d) / (255 - d); }
  /** 가상 시간 t(ms)까지 적분 */
  advanceTo(t) {
    while (this.t < t - 1e-9) {
      const h = Math.min(this.o.dt, t - this.t);
      for (const m of ['M1', 'M2', 'M3', 'M4']) {
        const target = this._norm(this.cmd[m]);
        this.cur[m] = this.o.tau > 0 ? this.cur[m] + (target - this.cur[m]) * (1 - Math.exp(-h / this.o.tau)) : target;
      }
      const FL = this.cur.M4, FR = this.cur.M1, RL = this.cur.M3, RR = this.cur.M2;
      const vx = this.V * (FL + FR + RL + RR) / 4;
      const vy = this.V * this.o.lateralEff * (-FL + FR + RL - RR) / 4;
      const w = this.W * (-FL + FR - RL + RR) / 4;
      const s = h / 1000, thm = this.th + w * s / 2; // 중점 heading
      const dx = (vx * Math.cos(thm) - vy * Math.sin(thm)) * s, dy = (vx * Math.sin(thm) + vy * Math.cos(thm)) * s;
      this.x += dx; this.y += dy; this.th += w * s; this.turned += w * s; this.dist += Math.hypot(dx, dy); this.t += h;
      const last = this.path[this.path.length - 1];
      if (Math.hypot(this.x - last[1], this.y - last[2]) > 0.5 || Math.abs(this.th - last[3]) > 2 * DEG) this.path.push([this.t, this.x, this.y, this.th]);
    }
  }
  pose() { return { x: +this.x.toFixed(2), y: +this.y.toFixed(2), headingDeg: +((((this.th / DEG) % 360) + 360) % 360).toFixed(1), turnedDeg: +(this.turned / DEG).toFixed(1), dist: +this.dist.toFixed(1) }; }
}

module.exports = { Robot, NORMAL, MECANUM, DEFAULTS };

  };
  defs["drive"] = function (module, exports, require) {
/* 9~10차시: 모터 상태를 시나리오가 읽는 꼴로(expect.motors.dir·speed·min·turned).
 * 방향 이름(학생 말): forward 앞으로(↑) · backward 뒤로(↓) · left 왼쪽으로 돌기(↶) · right 오른쪽으로 돌기(↷) · stop 멈춤.
 *   확장 v1.3.1 runNormal: Clockwise(블록 ↶) = 오른쪽 바퀴 앞·왼쪽 바퀴 뒤 → 왼쪽으로 돎, CounterClockwise(↷) → 오른쪽으로 돎(robot.js NORMAL).
 *   기대값은 forward·Forward·'↑'처럼 블록 이름·화살표도 받는다(7~8 grader DIR_OF와 같은 말 + 9~10 말).
 * 지금 방향 = 차체 모터 명령(robot.cmd)의 모양: 4개 모두 0 = stop, runNormal 4가지 모양이면 그 방향, 메카넘 모양이면 'mecanum:<이름>', 그 밖 'other'.
 * 속도 = 지금 명령의 가장 큰 값(0~255, 정수 — 확장처럼 자름).
 * 지나온 기록(robot.events): turned = 실행 중 runNormal로 돈 방향들(속도 0 제외), minSpeed = 움직이라고 한 명령(속도 > 0)의 가장 작은 값. */
const { NORMAL, MECANUM } = require('./robot');

const DIR_NAME = { Forward: 'forward', Backward: 'backward', Clockwise: 'left', CounterClockwise: 'right' };
const DIR_ALIAS = {
  forward: 'forward', Forward: 'forward', '↑': 'forward', 앞: 'forward', backward: 'backward', Backward: 'backward', '↓': 'backward', 뒤: 'backward',
  left: 'left', Clockwise: 'left', '↶': 'left', 왼쪽: 'left', right: 'right', CounterClockwise: 'right', '↷': 'right', 오른쪽: 'right',
  stop: 'stop', STOP: 'stop', 정지: 'stop', 멈춤: 'stop',
};
const DIR_SAY = { forward: '앞으로 가기(↑)', backward: '뒤로 가기(↓)', left: '왼쪽으로 돌기(↶)', right: '오른쪽으로 돌기(↷)', stop: '멈춤', other: '다른 움직임' };
const M = ['M1', 'M2', 'M3', 'M4'];
const sameShape = (cmd, map) => { const s = cmd[M.find((m) => map[m] !== 0)]; if (!s) return false; const k = Math.abs(s); return M.every((m) => cmd[m] === map[m] * k); };

/** 지금 방향 이름 */
function dirOf(robot) {
  const c = robot.cmd;
  if (M.every((m) => c[m] === 0)) return 'stop';
  for (const [k, map] of Object.entries(NORMAL)) if (sameShape(c, map)) return DIR_NAME[k];
  for (const [k, map] of Object.entries(MECANUM)) if (k !== 'Stop' && sameShape(c, map)) return 'mecanum:' + k;
  return 'other';
}
/** 시나리오가 보는 모터 묶음(viewOf가 그때 찍어 둠) */
function driveView(robot) {
  const turned = new Set(); let minSpeed = null, cmds = 0;
  for (const [, label, s] of robot.events) {
    const sp = Math.abs(s || 0);
    if (/^normal\.(Clockwise|CounterClockwise)$/.test(label) && sp > 0) turned.add(DIR_NAME[label.slice(7)]);
    if (/^(normal|mecanum|motor)\./.test(label) && sp > 0) { cmds++; minSpeed = minSpeed == null ? sp : Math.min(minSpeed, sp); }
  }
  return { dir: dirOf(robot), speed: Math.max(...M.map((m) => Math.abs(robot.cmd[m]))), turned: [...turned], minSpeed, cmds };
}
const normDir = (d) => (d === false || d == null ? d : DIR_ALIAS[d] || DIR_ALIAS[String(d).toLowerCase()] || String(d));

/** expect.motors { dir, speed, min, turned } 판정 → 학생 문장 목록. mustNum·cmp는 grader 것 */
function driveFails(e, d, cmp, mustNum) {
  const fails = [];
  const now = d.dir === 'stop' ? '멈춰 있어요' : `${DIR_SAY[d.dir] || d.dir} 중이에요(속도 ${d.speed})`;
  if (e.dir != null) {
    const want = normDir(e.dir);
    if (want !== d.dir) fails.push(want === 'stop' ? `포니봇이 멈춰야 해요(지금: ${now}).` : `포니봇이 ${DIR_SAY[want] || want}를 해야 해요(지금: ${now}).`);
  }
  if (e.speed != null && d.dir !== 'stop' && !cmp(d.speed, e.speed)) fails.push(`${d.dir === 'left' || d.dir === 'right' ? '회전' : '이동'} 속도가 ${mustNum(e.speed)} 해요(지금: ${d.speed}).`);
  if (e.speed != null && d.dir === 'stop' && !cmp(0, e.speed)) fails.push(`이동 속도가 ${mustNum(e.speed)} 해요(지금: 멈춤).`);
  if (e.min != null && d.minSpeed != null && d.minSpeed < e.min) fails.push(`속도 값이 대략 ${e.min}보다 작으면 '삐~' 소리만 나고 바퀴가 안 돌아요(로봇마다 조금 달라요). ${e.min}보다 넉넉히 크게 해요(가장 작은 속도: ${d.minSpeed}).`);
  if (e.min != null && d.minSpeed == null) fails.push('바퀴를 움직이는 블록이 실행되지 않았어요.');
  if (e.turned != null) {
    const want = e.turned === false ? false : e.turned === true ? true : normDir(e.turned);
    if (want === false && d.turned.length) fails.push(`이때는 돌지 않아야 해요(지금: ${d.turned.map((t) => DIR_SAY[t]).join(', ')}이 있었어요).`);
    else if (want === true && !d.turned.length) fails.push('포니봇이 한 번은 제자리에서 돌아야 해요.');
    else if (typeof want === 'string' && !d.turned.includes(want)) fails.push(`포니봇이 ${DIR_SAY[want] || want}를 해야 해요${d.turned.length ? `(지금: ${d.turned.map((t) => DIR_SAY[t]).join(', ')})` : '(지금: 돌지 않았어요)'}.`);
  }
  return fails;
}

module.exports = { driveView, driveFails, dirOf, normDir, DIR_SAY };

  };
  defs["linecolor"] = function (module, exports, require) {
/* 9~10차시: 라인 센서·컬러 센서·소리 효과(화면 없는 시나리오 채점, 결정 D18).
 * 근거: ai_ponybot_basic v1.3.1 main.ts (라인 405~478줄, 컬러 524~713줄), pxt-microbit music.play·soundExpression.
 *   라인: 디지털 0/1. 왼쪽 P16·오른쪽 P15. TwoLineState OffOff "◌ ◌"·OnOn "● ●"·OnOff "● ◌"(왼쪽 1)·OffOn "◌ ●"(오른쪽 1). LineState Off 0·On 1. LineSensorChannel Left 1·Right 2
 *   컬러: initColorSensor(V1|V2) = 버전별 실측 최소·최대로 0~255 변환(버전만 기록 — 시나리오는 이미 바꾼 R·G·B를 given으로 넣음).
 *         getRed/getGreen/getBlue = 0~255, getLight = 밝기(Clear 채널) 값.
 *         isColorAdvanced(색, 임계값): 임계값은 쓰지 않음. R+G+B < 60이면 거짓. 빨강 r>g·r>b·r>1.5g / 노랑 r>b·g>b·r>g·r≤1.5g / 초록 g>r·g≥b·g>1.4r / 파랑 b>r·b>g
 *         isColorInRange(minR,maxR,minG,maxG,minB,maxB): 엄격 부등호(min < 값 < max)
 *   소리 효과: music.play(music.builtinPlayableSoundEffect(soundExpression.X), PlaybackMode) — UntilDone이면 그 길이만큼 기다림(길이는 근사, 확인 필요).
 *     sim.sounds = [{ t, kind:'effect', name, ms, wait }] 기록. 7~8차시 engine/music.js(Music)와 합칠 때는 그쪽 play가 'effect' playable을 받게 하고 이 기록을 Music 구간으로 옮긴다.
 * 시나리오 given 이름(sensors.js): lineL·lineR(0/1), R·G·B(0~255), colorLight. 배열이면 무한반복 n번째 바퀴 값(grader 규칙 그대로). */

const LINE_ENUMS = {
  TwoLineState: { OffOff: 0, OnOn: 1, OnOff: 2, OffOn: 3 },
  LineState: { Off: 0, On: 1 },
  LineSensorChannel: { Left: 1, Right: 2 },
  DetectedColor: { Red: 0, Green: 1, Blue: 2, Yellow: 3 },
  SensorVersion: { V1: 1, V2: 2 },
};
const TWO_KEY = ['OffOff', 'OnOn', 'OnOff', 'OffOn'];
const COLOR_KEY = ['Red', 'Green', 'Blue', 'Yellow'];
/** 두 라인 센서 상태(왼쪽 L, 오른쪽 R) → TwoLineState 이름 */
const twoState = (L, R) => (L === 0 && R === 0 ? 'OffOff' : L === 1 && R === 1 ? 'OnOn' : L === 1 && R === 0 ? 'OnOff' : L === 0 && R === 1 ? 'OffOn' : null);
/** v1.3.1 isColorAdvanced 그대로(임계값 무시) */
function isColor(color, r, g, b) {
  if (r + g + b < 60) return false;
  switch (color) {
    case 'Red': return r > g && r > b && r > g * 1.5;
    case 'Yellow': return r > b && g > b && r > g && r <= g * 1.5;
    case 'Green': return g > r && g >= b && g > r * 1.4;
    case 'Blue': return b > r && b > g;
    default: return false;
  }
}
/** v1.3.1 isColorInRange 그대로(엄격 부등호) */
const inRange = (r, g, b, a) => r > a[0] && r < a[1] && g > a[2] && g < a[3] && b > a[4] && b < a[5];
// 소리 효과 길이(ms, 근사 — pxt-microbit soundExpression 문자열의 단계 합. 확인 필요). 모르는 이름은 1000
const EFFECT_MS = { giggle: 1300, happy: 1000, hello: 900, mysterious: 1700, sad: 1300, slide: 900, soaring: 1300, spring: 900, twinkle: 1000, yawn: 1900 };

/** sim의 이름공간에 라인·컬러·소리 효과 API를 더한다. native(fn, cost)는 sim의 것 */
function install(sim, ns, native) {
  const P = ns.aiPonybot;
  for (const [k, e] of Object.entries(LINE_ENUMS)) P[k] = Object.assign(Object.create(null), e);
  const S = sim.sensors;
  const line = (ch) => (ch === 1 ? S.read('lineLeft') : S.read('lineRight')); // 확장: Left가 아니면 오른쪽(P15)
  const bit = (v) => (v ? 1 : 0);
  const rgb = () => [S.read('colorR'), S.read('colorG'), S.read('colorB')];
  sim.colorVersion = null; // initColorSensor로 고른 버전('V1'|'V2'), 안 부르면 null(확장 기본 V1 프로파일)
  Object.assign(P, {
    readLineSensor: native(function ([ch]) { return bit(line(ch)); }),
    checkTwoLineState: native(function ([st]) { const L = bit(S.read('lineLeft')), R = bit(S.read('lineRight')); return twoState(L, R) === TWO_KEY[st]; }),
    checkSingleLineSensor: native(function ([ch, st]) { return bit(line(ch)) === st; }),
    initColorSensor: native(function ([v]) { sim.colorVersion = v === 1 ? 'V1' : v === 2 ? 'V2' : String(v); }, 0.5),
    getRed: native(function () { return Math.round(S.read('colorR')); }),
    getGreen: native(function () { return Math.round(S.read('colorG')); }),
    getBlue: native(function () { return Math.round(S.read('colorB')); }),
    getLight: native(function () { return Math.round(S.read('colorLight')); }),
    isColorAdvanced: native(function ([c]) { const [r, g, b] = rgb(); return isColor(COLOR_KEY[c], r, g, b); }),
    isColorInRange: native(function (a) { const [r, g, b] = rgb(); return inRange(r, g, b, a.map(Number)); }),
  });
  // MakeCode convertToText(값) = 글자로
  if (!ns.convertToText) ns.convertToText = native(function ([v]) { return typeof v === 'number' ? (Number.isInteger(v) ? String(v) : String(Math.round(v * 1e6) / 1e6)) : v === true ? 'true' : v === false ? 'false' : v == null ? '' : String(v); });
  // 소리 효과(작게: 7~8 music.js와 합칠 때 그쪽이 ns.music을 만들면 여기서는 효과 두 개만 더함)
  sim.sounds = sim.sounds || [];
  ns.soundExpression = ns.soundExpression || Object.create(null);
  Object.keys(EFFECT_MS).forEach((k) => { ns.soundExpression[k] = k; });
  ns.music = ns.music || Object.create(null);
  // 11~12 세션의 sim이 소리 효과를 이미 알면(멜로디 'effect:이름', 약 1초) 그것을 그대로 쓰고 기록만 더한다
  if (!ns.music.builtinPlayableSoundEffect) ns.music.builtinPlayableSoundEffect = native(function ([name]) { return { playable: 'effect', name: String(name), ms: EFFECT_MS[name] || 1000 }; });
  if (!ns.music.builtinSoundEffect) ns.music.builtinSoundEffect = ns.music.builtinPlayableSoundEffect;
  if (!ns.music.PlaybackMode) ns.music.PlaybackMode = Object.assign(Object.create(null), { UntilDone: 0, InBackground: 1, LoopingInBackground: 2 });
  // music.play: 소리 효과('effect' playable)는 여기서 기록(sim.sounds + 7~8 Music 구간 'effect:이름', 높이는 대표값 880Hz), 그 밖은 7~8 music.play에 넘김
  // wait: 기다릴 ms를 돌려주면 sim이 일시중지처럼 양보(UntilDone). 배경 재생은 기다리지 않음
  const orig = ns.music.play;
  ns.music.play = { wait(args, line) {
    const [p, mode] = args;
    const isFx = p && (p.playable === 'effect' || /^effect:/.test(p.src || ''));
    if (isFx) sim.sounds.push({ t: sim.time + (sim._cur ? sim._cur.debt : 0), kind: 'effect', name: p.name || String(p.src).slice(7), ms: p.ms || 1000, wait: mode == null || mode === 0 });
    if (!p || p.playable !== 'effect') return orig && orig.wait ? orig.wait(args, line) : 0; // 7~8·11~12 music.play(소리 효과 멜로디 포함)
    const until = mode == null || mode === 0, ms = p.ms || 0;
    if (sim.music && sim.music.tone) sim.music.tone(880, ms, 'effect:' + p.name);
    return until ? ms : 0;
  } };
}

module.exports = { install, LINE_ENUMS, twoState, isColor, inRange, EFFECT_MS, TWO_KEY, COLOR_KEY };

  };
  defs["servo"] = function (module, exports, require) {
/* 비트런(마이크로비트 + 연속회전 서보 2개) 엔진 조각 — 2026-11-01 채점 엔진 담당
 * 근거: pxt-servo(MakeCode 'servo' 확장, planning/bitrun/content/blocks.md — 원본 코드 pxt.json·main.blocks)
 *   servos.P0·P1·P2(고정 인스턴스) .run(speed −100~100)·.stop()·.setPulse(µs)·.setAngle(도)·.setStopOnNeutral·.setRange
 *   연속회전 서보: 1500µs = 90도 = 멈춤. 속도 모델 = run 값 그대로(−100~100으로 가둠), setPulse는 (µs − 1500)/10, setAngle은 (도 − 90)/0.9.
 *   stop()은 펄스를 끔(서보가 힘을 빼고 멈춤) → 속도 0.
 * 녹음(audio-recording 확장, V2): record.* 는 호출 기록만(소리 내용·길이는 흉내 내지 않음 — 기다리지도 않음). audioStatus(Stopped)는 늘 참.
 * 시나리오 칸은 grader.js servoFails·callFails·recFails, 규격은 references/lesson-schema.md 8-2. */

const PINS = ['P0', 'P1', 'P2'];
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

class Servos {
  constructor() { this.pins = Object.create(null); this.log = []; this.count = 0; this.now = () => 0; }
  _pin(p) { return this.pins[p] || (this.pins[p] = { speed: 0, on: false }); }
  /** 명령 하나 기록: fn = 'run'|'stop'|'pulse'|'angle', by = 그때 실행 중인 사용자 함수 이름(없으면 null), ev = 그 블록을 실행한 이벤트 */
  cmd(pin, fn, speed, meta = {}) {
    const s = this._pin(pin);
    s.speed = speed; s.on = fn !== 'stop';
    this.count++;
    if (this.log.length < 5000) this.log.push(Object.assign({ t: this.now(), pin, fn, speed }, meta));
  }
  run(pin, v, meta) { this.cmd(pin, 'run', clamp(typeof v === 'number' && isFinite(v) ? v : 0, -100, 100), meta); }
  stop(pin, meta) { this.cmd(pin, 'stop', 0, meta); }
  pulse(pin, us, meta) { this.cmd(pin, 'pulse', clamp(Math.round(((typeof us === 'number' ? us : 1500) - 1500) / 10), -100, 100), Object.assign({ us }, meta)); }
  angle(pin, deg, meta) { this.cmd(pin, 'angle', clamp(Math.round(((typeof deg === 'number' ? deg : 90) - 90) / 0.9), -100, 100), Object.assign({ deg }, meta)); }
  speed(pin) { return this.pins[pin] ? this.pins[pin].speed : 0; }
  /** 지금 상태 사본(시나리오 끝·timeline에서 checkExpect가 읽음) */
  view() { const pins = {}; for (const p of Object.keys(this.pins)) pins[p] = { speed: this.pins[p].speed, on: this.pins[p].on }; return { pins, log: this.log.slice() }; }
}

/** 시뮬레이터에 servos·record 이름공간을 단다(sim.js _buildNamespaces에서 부름). native(fn, cost)는 sim의 함수 */
function install(sim, ns, native) {
  const S = sim.servo;
  const meta = (f) => { const st = (f && f.fnStack) || []; return { by: st.length ? st[st.length - 1] : null, ev: f ? f.ev || null : null }; };
  const servo = (pin) => Object.assign(Object.create(null), {
    run: native(function ([v]) { S.run(pin, v, meta(this)); }),
    stop: native(function () { S.stop(pin, meta(this)); }),
    setPulse: native(function ([us]) { S.pulse(pin, us, meta(this)); }),
    setAngle: native(function ([d]) { S.angle(pin, d, meta(this)); }),
    setStopOnNeutral: native(function () {}), setRange: native(function () {}),
    angle: native(function () { return Math.round(90 + S.speed(pin) * 0.9); }),
  });
  ns.servos = Object.create(null); PINS.forEach((p) => { ns.servos[p] = servo(p); });
  // 녹음(audio-recording): 호출 기록만. V2 전용
  const R = sim.rec, rec = (fn) => native(function () { sim.v2.add('record'); R.log.push({ t: sim.time + (this ? this.debt || 0 : 0), fn, ev: this ? this.ev || null : null, by: meta(this).by }); });
  ns.record = Object.assign(Object.create(null), {
    startRecording: rec('start'), playAudio: rec('play'), stopAudio: rec('stop'), eraseRecording: rec('erase'),
    audioStatus: native(function ([s]) { sim.v2.add('record'); return s === 'Stopped'; }),
    audioIsPlaying: native(function () { return false; }), audioIsRecording: native(function () { return false; }), audioIsStopped: native(function () { return true; }),
    setSampleRate: native(function () {}), setMicGain: native(function () {}),
    BlockingState: Object.assign(Object.create(null), { Blocking: 1, Nonblocking: 0 }),
    AudioStatus: Object.assign(Object.create(null), { Playing: 'Playing', Recording: 'Recording', Stopped: 'Stopped', BufferFull: 'BufferFull' }),
    AudioSampleRateScope: Object.assign(Object.create(null), { Everything: 0, Playback: 1, Recording: 2 }),
    AudioLevels: Object.assign(Object.create(null), { Low: 0, Medium: 1, High: 2 }),
  });
}

module.exports = { Servos, install, PINS };

  };
  defs["oled"] = function (module, exports, require) {
/* SSD1306 128x64 모델 — ai_ponybot_basic v1.0.2 main.ts의 동작을 그대로 따른다.
 * buf: 확장의 screen 버퍼(1025바이트, [0]=0x40 제어바이트, 페이지 형식: index = x + page*128 + 1, bit = y%8)
 * disp: 실제 화면 GDDRAM(1024바이트). draw(1)에서 buf 전체가 복사되고, drawChar는 해당 6바이트를 바로 쓴다.
 * 확장의 특이 동작(시뮬레이터가 그대로 재현):
 *  - pixel()은 버퍼만 바꾸고 화면에 보내지 않는다 → 다음 draw(선/사각형/지우기/스크롤) 때 나타남
 *  - verticalLine에서 x가 범위 밖이면 drawEnabled=0으로 남아 이후 단독 선 그리기가 화면에 안 보임
 *  - 글꼴은 ASCII 32~126(95자). 한글 등은 빈칸(6px)으로 나옴. 글자는 8px 줄(행 0~7)에만 놓임
 */
const FONT_HEX = require('./font5x7');
const FONT = Uint8Array.from(FONT_HEX.match(/../g).map((h) => parseInt(h, 16)));
// 글자 읽기용: 5바이트 모양 → 글자(빈칸 제외, 같은 모양이면 앞 글자)
const GLYPH_OF = {};
for (let c = 33; c <= 126; c++) { const k = Array.from(FONT.subarray((c - 32) * 5, (c - 32) * 5 + 5)).join(','); if (k !== '0,0,0,0,0' && !(k in GLYPH_OF)) GLYPH_OF[k] = String.fromCharCode(c); }

class Oled {
  constructor(cost = {}) {
    this.cost = Object.assign({ charMs: 1.5, flushMs: 93 }, cost); // I2C 100kHz 추정치
    this.buf = new Uint8Array(1025); this.buf[0] = 0x40;
    this.disp = new Uint8Array(1024);
    this.cursorX = 0; this.cursorY = 0; this.drawEnabled = 1;
    this.flushes = 0; this.warnings = new Set(); this.elapsed = 0; // API 호출이 쓴 가상 시간(ms)
  }
  _set(i, v) { if (i >= 0 && i < 1025) this.buf[i] = v & 0xff; } // MakeCode Buffer: 범위 밖 쓰기는 무시
  _get(i) { return i >= 0 && i < 1025 ? this.buf[i] : 0; }
  draw(d) { if (d > 0) { this.disp.set(this.buf.subarray(1, 1025)); this.flushes++; this.elapsed += this.cost.flushMs; } }
  clear() { this.cursorX = this.cursorY = 0; this.buf.fill(0); this.buf[0] = 0x40; this.draw(1); }
  pixel(x, y, color = 1) {
    x = Math.trunc(x); y = Math.trunc(y);
    const page = y >> 3, shift = ((y % 8) + 8) % 8, index = x + page * 128 + 1;
    const b = this._get(index);
    this._set(index, color ? (b | (1 << shift)) : (b & ~(1 << shift)));
  }
  drawChar(ch, column, row, color = 1) {
    const code = Math.min(127, Math.max(ch.charCodeAt(0), 32));
    if (ch.charCodeAt(0) > 126) this.warnings.add('NON_ASCII');
    const pos = (code - 32) * 5;
    const index = column + row * 128 + 1;
    if (row < 0 || row > 7) this.warnings.add('ROW_RANGE');
    if (column + 6 > 128) this.warnings.add('TEXT_OVERFLOW');
    for (let i = 0; i < 5; i++) { const g = pos + i < FONT.length ? FONT[pos + i] : 0; this._set(index + i, color > 0 ? g : g ^ 0xff); }
    this._set(index + 5, color > 0 ? 0 : 0xff);
    for (let i = 0; i < 6; i++) { const j = index + i; if (j >= 1 && j < 1025) this.disp[j - 1] = this.buf[j]; } // 6바이트 직접 전송
    this.elapsed += this.cost.charMs;
  }
  showString(text, column, row, color = 1) { text = String(text); for (let n = 0; n < text.length; n++) { this.drawChar(text.charAt(n), column, row, color); column += 6; } }
  showNumber(num, column, row, color = 1) { this.showString(fmtNum(num), column, row, color); }
  scroll() {
    this.cursorX = 0; this.cursorY += 1;
    if (this.cursorY > 7) { this.cursorY = 7; this.buf.copyWithin(0, 128); this.buf.fill(0, 1025 - 128); this.buf[0] = 0x40; this.draw(1); }
  }
  printString(text, newline = true) {
    text = String(text);
    for (let n = 0; n < text.length; n++) { this.drawChar(text.charAt(n), this.cursorX, this.cursorY, 1); this.cursorX += 6; if (this.cursorX > 120) this.scroll(); }
    if (newline) this.scroll();
  }
  printNumber(num, newline = true) { this.printString(fmtNum(num), newline); }
  horizontalLine(x, y, length, color = 1) {
    const saved = this.drawEnabled;
    if (y < 0 || y > 63) return;
    this.drawEnabled = 0;
    for (let i = x; i < x + length; i++) if (i >= 0 && i <= 127) this.pixel(i, y, color);
    this.drawEnabled = saved; this.draw(this.drawEnabled);
  }
  verticalLine(x, y, length, color = 1) {
    const saved = this.drawEnabled;
    this.drawEnabled = 0;
    if (x < 0 || x > 127) { this.warnings.add('VLINE_STUCK'); return; } // 확장 버그 재현
    for (let i = y; i < y + length; i++) if (i >= 0 && i <= 63) this.pixel(x, i, color);
    this.drawEnabled = saved; this.draw(this.drawEnabled);
  }
  rectangle(x1, y1, x2, y2, color = 1) {
    if (x1 > x2) [x1, x2] = [x2, x1];
    if (y1 > y2) [y1, y2] = [y2, y1];
    this.drawEnabled = 0;
    this.horizontalLine(x1, y1, x2 - x1 + 1, color); this.horizontalLine(x1, y2, x2 - x1 + 1, color);
    this.verticalLine(x1, y1, y2 - y1 + 1, color); this.verticalLine(x2, y1, y2 - y1 + 1, color);
    this.drawEnabled = 1; this.draw(1);
  }
  /** 화면(disp) 픽셀 */
  get(x, y) { return (this.disp[x + (y >> 3) * 128] >> (y % 8)) & 1; }
  litCount() { let n = 0; for (let y = 0; y < 64; y++) for (let x = 0; x < 128; x++) n += this.get(x, y); return n; }
  /** 화면 글자 읽기(B형 시나리오 채점, S3-5): 행(0~7)마다 화면 픽셀에서 확장 글꼴(5바이트 + 빈 1바이트)을 찾아 글자로. 색상 1 글자만, 빈칸 6px 이상은 띄어쓰기 */
  textRows() {
    const rows = [];
    for (let page = 0; page < 8; page++) {
      let s = '', gap = 0;
      for (let x = 0; x < 128;) {
        const key = Array.from(this.disp.subarray(page * 128 + x, page * 128 + x + 5)).join(',');
        const ch = x <= 123 ? GLYPH_OF[key] : undefined;
        if (ch) { if (gap >= 6 && s) s += ' '; s += ch; gap = 0; x += 6; continue; }
        gap = this.disp[page * 128 + x] === 0 ? gap + 1 : 0; x++;
      }
      rows.push(s);
    }
    return rows;
  }
  /** 2x 축소 ASCII (각 문자 = 1x2 픽셀) — 테스트 출력용 */
  toAscii(scaleX = 1) {
    const rows = [];
    for (let y = 0; y < 64; y += 2) {
      let s = '';
      for (let x = 0; x < 128; x += scaleX) { const a = this.get(x, y), b = this.get(x, y + 1); s += a && b ? '█' : a ? '▀' : b ? '▄' : ' '; }
      rows.push('|' + s + '|');
    }
    return rows.join('\n');
  }
}
// MakeCode number.toString(): 정수는 그대로, 실수는 JS와 거의 같음(가장 짧은 표현)
function fmtNum(n) { return Number.isInteger(n) ? String(n) : String(Math.round(n * 1e6) / 1e6); }

module.exports = { Oled };

  };
  defs["sim"] = function (module, exports, require) {
/* 가상 포니봇 인터프리터: tslite AST를 제너레이터 기반 AST 워커로 실행(eval 없음).
 * - 협조형 파이버: 시작하면(main) / basic.forever / input.onButtonPressed 핸들러가 각각 파이버
 * - basic.pause(ms)와 forever 반복 사이 20ms(pxt 런타임과 같음)에서만 양보 → 가상 시간 진행
 * - API 호출은 I2C 전송 시간을 가상 비용으로 더함(양보는 하지 않음, 실제 기기와 같음)
 * - 양보 없이 maxNoYieldSteps를 넘기면 NO_YIELD 오류로 그 파이버만 멈춤(무한 루프 보호)
 * - 같은 버튼 핸들러 실행 중 다시 누르면 큐에 넣음(DAL QUEUE_IF_BUSY 추정), 다른 버튼 핸들러는 동시에 실행
 */
const { parse, memberPath } = require('./tslite');
const { Robot } = require('./robot');
const { Oled } = require('./oled');
const { Sensors } = require('./sensors');
const { Leds, COLORS: LED_COLORS, MODES: LED_MODES, hsl: ledHsl, packRGB, unpack } = require('./leds');
const { Matrix, ICONS, ARROW_LIST, parseLeds, iconName, arrowName, numText } = require('./matrix');
const { Music, NOTE, BEAT, MELODIES, melodyNotes, stringNotes } = require('./music');
/* 7~8차시: opts.music(Music) → music.*(소리 기록, music.js 머리 주석), aiPonybot.ping(초음파, 센서 distance), input.onGesture·onSound·soundLevel·acceleration·buttonIsPressed, randint.
 *   opts.random: 수 | [수…] | 'min'|'max'|'mid'(randint·Math.randomRange가 부를 때마다 차례로, 끝 값 유지, 범위 안으로 가둠) — 없으면 seed로 정해진 값(결정적)
 *   opts.held: { A: true }(버튼을 계속 누르고 있음, input.buttonIsPressed) */
/* 11~12차시(라디오·블루투스): radio.*(sim.radio = { group, sent:[{ t, kind, value, name? }] }), bluetooth.*(sim.bt = { uart, connected, buf, sent }), serial.delimiters, control.deviceName,
 *   기울기 sim.setTilt('flat'|'left'|'right'|'forward'|'back') → input.acceleration(X·Y)·input.isGesture(TiltLeft·TiltRight·LogoUp·LogoDown·ScreenUp).
 *   '앞으로' = 로고(USB) 쪽을 몸 쪽에 두고 핀 쪽을 숙임 → Y < 0(LogoUp, 사용자 실물 답 2026-10-22). 받기는 fire('radio:number', at, [수], { group })·fire('uart', at, ['U'])·fire('bt:connect')
 *   music.builtinPlayableSoundEffect(soundExpression.hello)는 약 1초 울림(근사, 소리 효과 길이는 모름) */
const LINECOLOR = require('./linecolor'); // 9~10차시: 라인·컬러 센서·소리 효과(linecolor.js 머리 주석)
const SERVO = require('./servo'); // 비트런: 연속회전 서보(servos.P0~P2)·녹음(record.*) 기록(servo.js 머리 주석)
/* 비트런(2026-11-01): input.onLogoEvent(TouchButtonEvent.○, …) → 핸들러 'logo'(Pressed)·'logo:Touched'·'logo:Released'·'logo:LongPressed', press('logo')가 일으킴(V2).
 *   사용자 함수(function 이름() {}) 호출을 sim.calls에 [{ name, t, from: 이벤트, by: 부른 사용자 함수 }]로, 정의 이름은 sim.userFns. 서보 명령도 by·ev를 남긴다 */
/* LED 화면 5×5(basic 서랍, 1차시): opts.matrix(Matrix) → basic.showIcon·showLeds·showArrow·showNumber·showString·clearScreen. 기다림은 일시중지처럼 양보(matrix.js 머리 주석) */
/* B형(S3-5): opts.sensors({ lightLevel: 20 } 또는 Sensors) → input.lightLevel(), opts.leds(Leds) → neopixel.*(포니봇 LED 4개)
 * opts.lenient: 모르는 블록(API)을 오류 대신 '아무것도 안 함'으로 넘김(시나리오 채점에서만. 기본은 지금처럼 UNKNOWN 오류) */

class SimError extends Error { constructor(code, msg, line) { super(msg); this.code = code; this.line = line; } }
class ReturnSig { constructor(v) { this.v = v; } }
const BREAK = { sig: 'break' }, CONTINUE = { sig: 'continue' };

const ENUMS = {
  'aiPonybot.DirectionControl': { Forward: 1, Backward: 2, Clockwise: 3, CounterClockwise: 4 },
  'aiPonybot.Mecanum': { LeftForward: 1, Forward: 2, RightForward: 3, Left: 4, Stop: 5, Right: 6, LeftBackward: 7, Backward: 8, RightBackward: 9 },
  'aiPonybot.Motor': { Motor1: 1, Motor2: 2, Motor3: 3, Motor4: 4 },
  'aiPonybot.Direction': { Clockwise: 1, CounterClockwise: -1 },
  'aiPonybot.PingUnit': { MicroSeconds: 0, Centimeters: 1, Inches: 2 }, // ai_ponybot_basic v1.0.2 main.ts 481~487줄
  Button: { A: 'A', B: 'B', AB: 'AB' },
};
const nameOf = (enumPath, v) => Object.keys(ENUMS[enumPath]).find((k) => ENUMS[enumPath][k] === v);

class Env {
  constructor(parent) { this.parent = parent; this.vars = new Map(); }
  lookup(n) { for (let e = this; e; e = e.parent) if (e.vars.has(n)) return e; return null; }
}

class Sim {
  constructor(srcOrAst, opts = {}) {
    this.o = Object.assign({ maxNoYieldSteps: 20000, foreverYieldMs: 20, maxQueue: 4, seed: 1, motorCmdMs: 4.4, motorOneMs: 1.1 }, opts);
    this.ast = typeof srcOrAst === 'string' ? parse(srcOrAst) : srcOrAst;
    this.robot = opts.robot || new Robot(opts.robotOpts);
    this.oled = opts.oled || new Oled(opts.oledCost);
    this.sensors = opts.sensors instanceof Sensors ? opts.sensors : new Sensors(opts.sensors || {});
    this.leds = opts.leds || new Leds(4);
    this.leds.now = () => this.time + (this._cur ? this._cur.debt : 0); // show 기록 시각(가상 ms)
    this.matrix = opts.matrix || new Matrix();
    this.matrix.now = () => this.time + (this._cur ? this._cur.debt : 0);
    this.music = opts.music || new Music();
    this.music.now = () => this.time + (this._cur ? this._cur.debt : 0);
    this.servo = opts.servo || new SERVO.Servos(); this.servo.now = () => this.time + (this._cur ? this._cur.debt : 0); // 비트런
    this.rec = { log: [] }; this.calls = []; this.userFns = (this.ast.body || []).filter((s) => s.type === 'FuncDecl').map((s) => s.name); // 녹음 호출·사용자 함수 호출 기록
    this.v2 = new Set(); this.soundThreshold = { Loud: 128, Quiet: 64 }; this.randCalls = 0; // V2 전용 API를 썼는지, 소리 임계값(기록만), randint 부른 수
    this.unknown = new Set(); // lenient에서 넘긴 모르는 API 경로
    this.radio = { group: null, sent: [], count: 0 }; this.bt = { uart: false, connected: false, buf: [], sent: [] }; this.tiltXY = [0, 0]; this.tiltName = 'flat'; // 11~12차시
    this.time = 0; this.fibers = []; this.seq = 0; this.inputs = []; this.pressLog = []; this.handlers = Object.create(null);
    this.busy = Object.create(null); this.queue = Object.create(null); this.errors = []; this.notices = new Set(); this.totalSteps = 0;
    this.rng = this.o.seed >>> 0 || 1;
    this.globals = new Env(null);
    this.ns = this._buildNamespaces();
    this.started = false;
  }

  /* ---------- 네임스페이스(화이트리스트) ---------- */
  _buildNamespaces() {
    const sim = this, R = this.robot, O = this.oled;
    const native = (fn, cost = 0) => ({ native: fn, cost });
    const num = (v, line) => { if (typeof v !== 'number' || !isFinite(v)) throw new SimError('TYPE', '숫자가 필요해요', line); return v; };
    const oled = (fn) => native(function (args) { const before = O.elapsed; fn(...args); this.debt += O.elapsed - before; });
    const ns = Object.create(null);
    ns.aiPonybot = Object.assign(Object.create(null), {
      runNormal: native(function ([d, s], line) { R.runNormal(nameOf('aiPonybot.DirectionControl', d) || bad(line, d), num(s, line)); }, this.o.motorCmdMs),
      runMecanum: native(function ([d, s], line) { R.runMecanum(nameOf('aiPonybot.Mecanum', d) || bad(line, d), num(s, line)); }, this.o.motorCmdMs),
      runMotor: native(function ([m, d, s], line) { if (![1, 2, 3, 4].includes(m)) bad(line, m); R.runMotor(m, d, num(s, line)); }, this.o.motorOneMs),
      stopMotor: native(function ([m], line) { if (![1, 2, 3, 4].includes(m)) bad(line, m); R.stopMotor(m); }, this.o.motorOneMs),
      stopAllMotors: native(function () { R.stopAll(); }, this.o.motorCmdMs),
      clear: oled(() => O.clear()),
      pixel: oled((x, y, c = 1) => O.pixel(x, y, c)),
      showString: oled((t, c, r, col = 1) => O.showString(t, c, r, col)),
      showNumber: oled((n, c, r, col = 1) => O.showNumber(n, c, r, col)),
      printString: oled((t, nl = true) => O.printString(t, nl)),
      printNumber: oled((n, nl = true) => O.printNumber(n, nl)),
      // 초음파(v1.0.2 main.ts 495~519줄): 센서 distance(cm, 실제 거리) → 왕복 µs = 거리×58. maxCmDistance(기본 500) 이상이면 못 잼 → cm 500 · inch 196 · µs 29000
      ping: native(function ([unit, maxCm = 500]) {
        const d = sim.sensors.read('distance'), max = typeof maxCm === 'number' && maxCm > 0 ? maxCm : 500, none = !(d < max);
        const us = none ? max * 58 : Math.round(Math.max(0, d) * 58);
        this.debt += us / 1000 + 0.05; // pulseIn은 에코가 올 때까지 기다림(바쁜 기다림, 양보 없음)
        if (none) return unit === 1 ? max : unit === 2 ? Math.trunc((max * 100) / 254) : max * 58;
        return unit === 1 ? Math.trunc(us / 58) : unit === 2 ? Math.trunc(us / 148) : us;
      }),
      horizontalLine: oled((x, y, l, c = 1) => O.horizontalLine(x, y, l, c)),
      verticalLine: oled((x, y, l, c = 1) => O.verticalLine(x, y, l, c)),
      rectangle: oled((a, b, c, d, col = 1) => O.rectangle(a, b, c, d, col)),
    });
    for (const [p, e] of Object.entries(ENUMS)) { if (p.startsWith('aiPonybot.')) ns.aiPonybot[p.split('.')[1]] = Object.assign(Object.create(null), e); }
    ns.Button = Object.assign(Object.create(null), ENUMS.Button);
    ns.basic = Object.assign(Object.create(null), {
      pause: { pause: true },
      forever: native(function ([fn], line) { if (!fn || !fn.closure) throw new SimError('TYPE', '무한반복 안에 함수가 필요해요', line); sim._spawn('무한반복', sim._foreverGen(fn), sim.time, { ev: 'forever' }); }),
      // LED 화면 5×5(1차시): 그린 뒤 기다리는 시간(ms)을 돌려주면 _callExpr가 일시중지처럼 양보한다(pxt-microbit basic.cpp·icons.ts 기본값)
      showIcon: { screen([ic, iv = 600], line) { const n = iconName(ic); if (!n) throw new SimError('ENUM', `알 수 없는 아이콘 ${ic}`, line); sim.matrix.image(ICONS[n], { kind: 'icon', icon: n }); return iv; } },
      showArrow: { screen([d, iv = 600], line) { const n = arrowName(d); if (!n) throw new SimError('ENUM', `알 수 없는 화살표 ${d}`, line); sim.matrix.image(require('./matrix').ARROWS[n], { kind: 'arrow', arrow: n }); return iv; } },
      showLeds: { screen([s, iv = 400], line) { const c = parseLeds(s); if (!c) throw new SimError('TYPE', 'LED 출력 그림을 읽지 못했어요', line); const ic = require('./matrix').iconOf(c); sim.matrix.image(c, Object.assign({ kind: 'leds' }, ic ? { icon: ic } : {})); return iv; } },
      showString: { screen([s, iv = 150]) { return sim._showText(s == null ? '' : String(s), iv); } },
      showNumber: { screen([v, iv = 150]) { return sim._showText(numText(v), iv); } },
      clearScreen: { screen() { sim.matrix.clear(); return 0; } },
    });
    ns.IconNames = Object.create(null); Object.keys(ICONS).forEach((k) => { ns.IconNames[k] = k; });
    ns.ArrowNames = Object.create(null); ARROW_LIST.forEach((k, i) => { ns.ArrowNames[k] = i; });
    ns.input = Object.assign(Object.create(null), {
      onButtonPressed: native(function ([btn, fn], line) { if (!fn || !fn.closure) throw new SimError('TYPE', '버튼 블록 안에 함수가 필요해요', line); sim.handlers[btn] = fn; }),
      // B형(S3-5): 가짜 센서 — 값은 시나리오가 넣는다(sensors.js). 나머지 센서는 sensors.js 표에 자리만
      lightLevel: native(function () { return sim.sensors.read('lightLevel'); }),
      // 7~8차시: 흔들기·소리 이벤트(시나리오 run.gesture·run.sound로 일으킴), 소리 크기·가속도 센서
      onGesture: native(function ([g, fn], line) { if (!fn || !fn.closure) throw new SimError('TYPE', '동작 감지 블록 안에 함수가 필요해요', line); sim.handlers['gesture:' + g] = fn; }),
      onSound: native(function ([d, fn], line) { if (!fn || !fn.closure) throw new SimError('TYPE', '소리 감지 블록 안에 함수가 필요해요', line); sim.v2.add('input.onSound'); sim.handlers['sound:' + d] = fn; }),
      setSoundThreshold: native(function ([k, v]) { sim.v2.add('input.setSoundThreshold'); if (typeof v === 'number') sim.soundThreshold[k] = Math.max(0, Math.min(255, v)); }),
      soundLevel: native(function () { sim.v2.add('input.soundLevel'); return sim.sensors.read('soundLevel'); }),
      isGesture: native(function ([g]) { return !!(sim._gesture && sim._gesture.g === g && sim.time - sim._gesture.at < 200) || sim._pose() === g; }),
      // 가속도(mg): 세기(Strength) = 센서 acceleration, X·Y = 기울기(setTilt, 평평하면 0), Z = -1024(평평하게 놓았을 때, input.cpp 주석)
      acceleration: native(function ([dim]) { return dim === 3 ? sim.sensors.read('acceleration') : dim === 2 ? -1024 : dim === 0 ? sim.tiltXY[0] : sim.tiltXY[1]; }),
      buttonIsPressed: native(function ([b]) { return sim._held(b); }),
    });
    ns.Gesture = Object.create(null); ['Shake', 'LogoUp', 'LogoDown', 'ScreenUp', 'ScreenDown', 'TiltLeft', 'TiltRight', 'FreeFall', 'ThreeG', 'SixG', 'EightG'].forEach((k) => { ns.Gesture[k] = k; });
    ns.DetectedSound = Object.assign(Object.create(null), { Loud: 'Loud', Quiet: 'Quiet' });
    ns.SoundThreshold = Object.assign(Object.create(null), { Loud: 'Loud', Quiet: 'Quiet' });
    ns.Dimension = Object.assign(Object.create(null), { X: 0, Y: 1, Z: 2, Strength: 3 });
    // 소리(music.js): wait(args) = 기다릴 ms를 돌려주면 일시중지처럼 양보
    const M = this.music, wait = (fn) => ({ wait: fn }), hz = (f) => (typeof f === 'number' && isFinite(f) ? f : 0);
    const playable = (p, mode) => { // mode 0 = 끝까지(기다림), 1 = 배경, 2 = 배경 되풀이(계속 울림으로 봄)
      if (!p || !p.playable) return 0;
      if (p.playable === 'tone') { if (mode === 2) { M.tone(hz(p.freq), 0, 'loop'); return 0; } const ms = M.tone(hz(p.freq), p.ms, mode === 0 ? 'play' : 'bg'); return mode === 0 ? ms : 0; }
      const notes = p.notes || [{ freq: 440, q: 8 }]; // 표에 없는 멜로디(Prelude·Nyan·Blues·Chase)는 1초쯤으로(근사)
      if (p.tempo) M.tempo = p.tempo;
      return M.notes(notes, p.src, mode === 0);
    };
    ns.music = Object.assign(Object.create(null), {
      playTone: wait(([f, ms]) => M.tone(hz(f), typeof ms === 'number' ? ms : 0, 'tone')),
      ringTone: wait(([f]) => M.tone(hz(f), 0, 'ring')),
      rest: wait(([ms]) => M.rest(typeof ms === 'number' ? ms : 0)),
      stopAllSounds: native(function () { M.stop(); }),
      stopMelody: native(function () { M.stop(); }),
      setVolume: native(function ([v]) { M.volume = v; }), volume: native(function () { return M.volume; }),
      setTempo: native(function ([b]) { if (b > 0) M.tempo = Math.max(1, b); }), changeTempoBy: native(function ([b]) { if (M.tempo + b > 0) M.tempo = Math.max(1, M.tempo + b); }),
      tempo: native(function () { return M.tempo; }),
      beat: native(function ([fr]) { return M.beat(fr); }),
      noteFrequency: native(function ([n]) { return n; }),
      tonePlayable: native(function ([f, ms]) { return { playable: 'tone', freq: f, ms: typeof ms === 'number' ? ms : 0 }; }),
      stringPlayable: native(function ([m, bpm]) { return { playable: 'melody', notes: stringNotes(m), tempo: bpm, src: 'melody' }; }),
      builtInPlayableMelody: native(function ([k]) { return { playable: 'melody', notes: melodyNotes(k), src: 'melody:' + k }; }),
      builtInMelody: native(function ([k]) { return { playable: 'melody', notes: melodyNotes(k), src: 'melody:' + k }; }),
      play: wait(([p, mode]) => playable(p, mode)),
      _playDefaultBackground: wait(([p, mode]) => playable(p, mode)),
      startMelody: native(function ([p]) { playable(p, 1); }), // 옛 블록: 배경에서 시작(기다리지 않음)
      builtinPlayableSoundEffect: native(function ([k]) { return { playable: 'melody', notes: null, src: 'effect:' + k }; }), // 11~12: 소리 효과(hello·sad …) — 길이는 근사
      PlaybackMode: Object.assign(Object.create(null), { UntilDone: 0, InBackground: 1, LoopingInBackground: 2 }),
    });
    ns.soundExpression = Object.create(null); ['giggle', 'happy', 'hello', 'mysterious', 'sad', 'slide', 'soaring', 'spring', 'twinkle', 'yawn'].forEach((k) => { ns.soundExpression[k] = k; });
    ns.Note = Object.assign(Object.create(null), NOTE);
    ns.BeatFraction = Object.assign(Object.create(null), BEAT);
    ns.Melodies = Object.create(null); MELODIES.forEach((k) => { ns.Melodies[k] = k; });
    ns.MelodyOptions = Object.assign(Object.create(null), { Once: 1, Forever: 2, OnceInBackground: 4, ForeverInBackground: 8 });
    ns.MelodyStopOptions = Object.assign(Object.create(null), { All: 5, Foreground: 1, Background: 4 });
    ns.randint = native(([a, b]) => sim._randint(a, b));
    // 11~12차시: 라디오(마이크로비트끼리, 그룹이 같아야 받음)·블루투스 UART(기기 → 마이크로비트). 보내기는 기록만, 받기는 시나리오 run.radio·run.uart가 일으킨다
    const R0 = this.radio, B0 = this.bt, hat = (key, msg) => native(function ([a, b], line) { const fn = b && b.closure ? b : a; if (!fn || !fn.closure) throw new SimError('TYPE', msg, line); sim.handlers[key] = fn; });
    const sent = (kind, value, name) => { R0.count++; if (R0.sent.length < 3000) R0.sent.push(Object.assign({ t: sim.time, kind, value }, name != null ? { name } : {})); };
    ns.radio = Object.assign(Object.create(null), {
      setGroup: native(function ([g]) { R0.group = g; }),
      setTransmitPower: native(function () {}), setFrequencyBand: native(function () {}), setTransmitSerialNumber: native(function () {}),
      sendNumber: native(function ([n]) { sent('number', n); }), sendString: native(function ([t]) { sent('string', t); }), sendValue: native(function ([nm, v]) { sent('value', v, nm); }),
      onReceivedNumber: hat('radio:number', '라디오 수신 블록 안에 함수가 필요해요'), onReceivedString: hat('radio:string', '라디오 수신 블록 안에 함수가 필요해요'), onReceivedValue: hat('radio:value', '라디오 수신 블록 안에 함수가 필요해요'),
    });
    ns.bluetooth = Object.assign(Object.create(null), {
      startUartService: native(function () { B0.uart = true; }),
      onUartDataReceived: hat('uart', '블루투스 데이터 수신 블록 안에 함수가 필요해요'),
      onBluetoothConnected: hat('bt:connect', '블루투스 연결 블록 안에 함수가 필요해요'), onBluetoothDisconnected: hat('bt:disconnect', '블루투스 연결 해제 블록 안에 함수가 필요해요'),
      uartReadUntil: native(function () { return B0.buf.length ? B0.buf.shift() : ''; }),
      uartWriteString: native(function ([t]) { B0.sent.push(String(t)); }), uartWriteLine: native(function ([t]) { B0.sent.push(String(t)); }), uartWriteNumber: native(function ([n]) { B0.sent.push(String(n)); }),
      uartWriteValue: native(function ([nm, v]) { B0.sent.push(nm + ':' + v); }), setTransmitPower: native(function () {}),
    });
    ns.serial = Object.assign(Object.create(null), { delimiters: native(function ([d]) { return d; }) });
    ns.Delimiters = Object.assign(Object.create(null), { NewLine: '\n', Comma: ',', Dollar: '$', Colon: ':', Fullstop: '.', Hash: '#', CarriageReturn: '\r', Space: ' ', Tab: '\t', Pipe: '|', SemiColon: ';' });
    ns.control = Object.assign(Object.create(null), { deviceName: native(function () { return sim.o.deviceName || 'vazog'; }) });
    // 포니봇 LED 4개(ai_ponybot_light v1.0.0 namespace neopixel, leds.js). Strip은 메서드를 이름공간처럼 감싼 객체
    const SHOW_MS = 0.2; // LED 4개 전송(ws2812b) 시간 추정
    const wrapStrip = (st) => Object.assign(Object.create(null), {
      showColor: native(function ([c]) { st.showColor(num(c)); }, SHOW_MS),
      clear: native(function () { st.clear(); }, SHOW_MS),
      setBrightness: native(function ([b], line) { st.setBrightness(num(b, line)); }),
      setPixelColor: native(function ([i, c], line) { st.setPixelColor(num(i, line), num(c, line)); }),
      show: native(function () { st.show(); }, SHOW_MS),
      showRainbow: native(function ([a = 1, b = 360]) { st.showRainbow(a, b); }, SHOW_MS),
      showBarGraph: native(function ([v, h], line) { st.showBarGraph(num(v, line), num(h, line)); }, SHOW_MS),
      getLength: native(function () { return st.getLength(); }),
      createRange: native(function ([s, n], line) { return wrapStrip(st.createRange(num(s, line), num(n, line))); }),
    });
    ns.neopixel = Object.assign(Object.create(null), {
      create: native(function ([pin, n, mode], line) { return wrapStrip(sim.leds.create(pin, num(n, line), mode)); }),
      getColors: native(function ([c]) { return c; }),
      rgb: native(function ([r, g, b]) { return packRGB(r, g, b); }),
      hsl: native(function ([h, s, l]) { return ledHsl(h, s, l); }),
      pickColorPackRGB: native(function ([c]) { const [r, g, b] = unpack(c); return packRGB(r, g, b); }),
    });
    ns.NeoPixelColors = Object.assign(Object.create(null), LED_COLORS);
    ns.NeoPixelMode = Object.assign(Object.create(null), LED_MODES);
    ns.DigitalPin = Object.create(null); for (let i = 0; i <= 20; i++) ns.DigitalPin['P' + i] = 'P' + i;
    ns.Math = Object.assign(Object.create(null), {
      abs: native(([a]) => Math.abs(a)), floor: native(([a]) => Math.floor(a)), round: native(([a]) => Math.round(a)),
      min: native(([a, b]) => Math.min(a, b)), max: native(([a, b]) => Math.max(a, b)), idiv: native(([a, b]) => Math.trunc(a / b)),
      randomRange: native(([a, b]) => sim._randint(a, b)), PI: Math.PI,
      // 페르소나 2회차(5~6 #14, 7~8도 씀): MakeCode Math.map(값, 원래 낮은, 원래 높은, 새 낮은, 새 높은)·Math.constrain(값, 낮은, 높은). map은 반올림하지 않음(MakeCode와 같음)
      map: native(([v, a, b, c, d]) => ((v - a) * (d - c)) / (b - a) + c), constrain: native(([v, lo, hi]) => (v < lo ? lo : v > hi ? hi : v)),
    });
    ns.pins = Object.assign(Object.create(null), { map: ns.Math.map }); // 블록 "map 값 from … to …"(pins.map, 고급 › 핀). 다른 pins.* 는 예전처럼 모르는 블록
    LINECOLOR.install(sim, ns, native); // 9~10차시: aiPonybot 라인·컬러 API, convertToText, music.play(소리 효과)
    SERVO.install(sim, ns, native); // 비트런: servos.P0~P2·record.*
    // 비트런: 로고 터치(V2). Pressed = 핸들러 'logo', 그 밖은 'logo:Touched' 등
    ns.input.onLogoEvent = native(function ([ev, fn], line) { if (!fn || !fn.closure) throw new SimError('TYPE', '로고 터치 블록 안에 함수가 필요해요', line); sim.v2.add('input.onLogoEvent'); sim.handlers[ev === 'Pressed' || ev == null ? 'logo' : 'logo:' + ev] = fn; });
    ns.input.logoIsPressed = native(function () { sim.v2.add('input.logoIsPressed'); return sim._held('logo'); });
    ns.TouchButtonEvent = Object.assign(Object.create(null), { Pressed: 'Pressed', Touched: 'Touched', Released: 'Released', LongPressed: 'LongPressed' });
    function bad(line, v) { throw new SimError('ENUM', `알 수 없는 값 ${v}`, line); }
    return ns;
  }
  /** lenient: 모르는 API 자리표(부르면 아무것도 안 하고 undefined, 속성을 읽으면 또 자리표) */
  _stub(path) { this.unknown.add(path); return { stub: path, native() { return undefined; }, cost: 0 }; }
  /** 글자 출력(basic.cpp showString): 0자 = 끄고 5×간격, 1자 = 5×간격, 2자 이상 = 흘려 보내기(근사 (6×글자 수 + 5)×간격) */
  _showText(s, iv) { if (iv <= 0) iv = 1; const n = [...s].length; if (!n) { this.matrix.clear(); return iv * 5; } if (n === 1) { this.matrix.text(s); return iv * 5; } const ms = (6 * n + 5) * iv; this.matrix.text(s, ms); return ms; }
  /** randint(a, b)·Math.randomRange: 양 끝 포함. opts.random이 있으면 그 값(배열이면 차례로)을 범위 안으로 */
  _randint(a, b) {
    const lo = Math.min(a, b), hi = Math.max(a, b), r = this.o.random, k = this.randCalls++;
    if (r != null) { const v = Array.isArray(r) ? r[Math.min(k, r.length - 1)] : r; const x = v === 'min' ? lo : v === 'max' ? hi : v === 'mid' ? Math.round((lo + hi) / 2) : +v; return Math.max(lo, Math.min(hi, Math.round(x))); }
    return a + Math.floor(this._rand() * (b - a + 1)); // 예전 Math.randomRange와 같은 값(시드 1)
  }
  /** 버튼을 누르고 있는지(input.buttonIsPressed): opts.held({ A: true }) 또는 press 순간부터 hold ms(기본 150) 동안 */
  _held(b) { const h = this.o.held || {}; if (b === 'AB') return this._held('A') && this._held('B'); if (h[b]) return true; return this.pressLog.some((p) => (p.btn === b || p.btn === 'AB') && this.time >= p.at && this.time < p.at + (p.hold || 150)); }
  _rand() { let x = this.rng; x ^= x << 13; x ^= x >>> 17; x ^= x << 5; this.rng = x >>> 0; return this.rng / 4294967296; }

  /* ---------- 스케줄러 ---------- */
  _spawn(name, gen, at, meta = {}) { const f = Object.assign({ id: ++this.seq, name, gen, wakeAt: at, steps: 0, debt: 0 }, meta); this.fibers.push(f); return f; }
  // 무한반복: 첫 번째 무한반복의 바퀴마다 onLoop(k)(시작)·onLoopEnd(k)(끝)를 부른다(B형 시나리오의 loops·바퀴별 센서 값, S3-5). 시간·실행은 그대로
  *_foreverGen(fn) {
    const first = !this._foreverSeen; this._foreverSeen = true;
    for (let k = 0; ; k++) {
      if (first && this.onLoop) this.onLoop(k);
      yield* this._call(fn, [], this._cur, fn.line);
      if (first) { this.loops = k + 1; if (this.onLoopEnd) this.onLoopEnd(k); }
      yield { sleep: this.o.foreverYieldMs };
    }
  }
  start() { if (this.started) return; this.started = true; this._spawn('시작하면', this._program(), 0, { ev: 'start' }); }
  /** 버튼 누르기. btn 'logo' = 로고 터치(비트런): 누른 순간 'logo'(Pressed)·'logo:Touched', hold(기본 150ms) 뒤 'logo:Released' */
  press(btn, at = this.time, hold) {
    if (btn === 'logo') { this.fire('logo', at); this.fire('logo:Touched', at); this.fire('logo:Released', at + (hold || 150)); this.pressLog.push({ at, btn, hold }); return; }
    this.inputs.push({ at, btn }); this.pressLog.push({ at, btn, hold }); this.inputs.sort((a, b) => a.at - b.at);
  }
  /** 이벤트 일으키기(7~8차시): 'gesture:Shake' · 'sound:Loud' 같은 핸들러 이름. 버튼과 같은 줄(같은 핸들러가 도는 중이면 큐) */
  fire(key, at = this.time, args, meta) { this.inputs.push(Object.assign({ at, btn: key }, args ? { args } : {}, meta || {})); this.inputs.sort((a, b) => a.at - b.at); }
  /** 기울기(11~12): 'flat'|'left'|'right'|'forward'|'back' 또는 [x, y](mg). 한 번 정하면 바꿀 때까지 그대로 */
  // 왼·오른쪽은 기울임 판정(±800)을 넘게, 앞·뒤는 가속도 Y로만 보는 PPT 코드에 맞게(약 45°)
  setTilt(t) { const T = { flat: [0, 0], left: [-900, 0], right: [900, 0], forward: [0, -700], back: [0, 700] }; this.tiltXY = Array.isArray(t) ? [+t[0] || 0, +t[1] || 0] : (T[t] || T.flat).slice(); this.tiltName = Array.isArray(t) ? 'xy' : t || 'flat'; }
  /** 지금 자세의 동작 이름(codal-core Accelerometer::instantaneousPosture: 허용 200mg → Y<-800 LogoUp·Y>800 LogoDown·X<-800 TiltLeft·X>800 TiltRight·Z<-800 ScreenUp 차례, 아니면 없음).
   *  Z는 1g 안에서 x·y로 셈(화면이 위). 그래서 30~37°쯤 숙이면 ScreenUp과 Y<-500이 함께 참, 옆으로 37~53°는 어느 동작도 아님(검증단 I 확인) */
  _pose() { const [x, y] = this.tiltXY, z = -Math.sqrt(Math.max(0, 1000 * 1000 - x * x - y * y)); if (y < -800) return 'LogoUp'; if (y > 800) return 'LogoDown'; if (x < -800) return 'TiltLeft'; if (x > 800) return 'TiltRight'; if (z < -800) return 'ScreenUp'; return ''; }
  _deliver(btn, inp = {}) {
    // 11~12: 라디오는 그룹이 다르면 받지 않는다(보낸 쪽 그룹 inp.group을 안 주면 받음), UART 글자는 받는 칸에 쌓고 uartReadUntil이 꺼냄, 연결 상태 기록
    if (/^radio:/.test(btn) && inp.group != null && this.radio.group != null && inp.group !== this.radio.group) { this.notices.add('RADIO_OTHER_GROUP'); return; }
    if (btn === 'uart') this.bt.buf.push(String((inp.args || [''])[0]));
    if (btn === 'bt:connect') this.bt.connected = true;
    if (btn === 'bt:disconnect') this.bt.connected = false;
    const fn = this.handlers[btn]; if (!fn) { this.notices.add('NO_HANDLER_' + btn); return; }
    if (this.busy[btn]) { const q = (this.queue[btn] = this.queue[btn] || []); if (q.length < this.o.maxQueue) q.push(1); return; }
    this.busy[btn] = true;
    const self = this;
    if (/^gesture:/.test(btn)) this._gesture = { g: btn.slice(8), at: this.time };
    const args = btn === 'uart' ? [] : inp.args || [];
    this._spawn(btn === 'logo' ? '로고 터치' : /:/.test(btn) || btn === 'uart' ? btn : `${btn} 버튼`, (function* () { yield* self._call(fn, args, self._cur, fn.line); })(), this.time, { button: btn, ev: btn });
  }
  /** 가상 시간 tEnd(ms)까지 실행 */
  runUntil(tEnd) {
    this.start();
    for (let guard = 0; guard < 1e6; guard++) {
      const nf = this.fibers.reduce((m, f) => (!m || f.wakeAt < m.wakeAt || (f.wakeAt === m.wakeAt && f.id < m.id) ? f : m), null);
      const ni = this.inputs[0];
      const t = Math.min(nf ? nf.wakeAt : Infinity, ni ? ni.at : Infinity);
      if (t > tEnd) break;
      this.robot.advanceTo(t); this.time = Math.max(this.time, t);
      // 같은 시각이면 파이버 먼저(핸들러 등록 후 입력 전달)
      if (ni && ni.at < (nf ? nf.wakeAt : Infinity)) { this.inputs.shift(); this._deliver(ni.btn, ni); continue; }
      this._step(nf);
    }
    if (this.time < tEnd && this.fibers.some((f) => f.wakeAt <= tEnd)) this.errors.push({ code: 'SCHED_GUARD', message: '블록이 너무 빠르게 반복돼요. 일시중지 시간을 늘려 봐요.', at: this.time });
    this.robot.advanceTo(tEnd); this.time = tEnd;
    return this.state();
  }
  _step(f) {
    this._cur = f; f.steps = 0; f.debt = 0;
    let r;
    // 파이버가 양보할 때까지 쓴 CPU/I2C 시간(debt)만큼 전역 시계를 바로 진행: 그동안 다른 파이버는 못 돈다(협조형)
    const busyEnd = () => { this.time += f.debt; f.debt = 0; };
    try { r = f.gen.next(); }
    catch (e) {
      busyEnd(); this._remove(f);
      if (e instanceof SimError) this.errors.push({ code: e.code, message: e.message, line: e.line, fiber: f.name, at: this.time });
      else if (e instanceof ReturnSig) { /* 최상위 return */ }
      else this.errors.push({ code: 'INTERNAL', message: String(e && e.message || e), fiber: f.name, at: this.time });
      return;
    }
    busyEnd();
    if (r.done) { this._remove(f); return; }
    f.wakeAt = this.time + Math.max(1, r.value.sleep); // pause(0)도 1ms 진행(스케줄러 진행 보장)
  }
  _remove(f) {
    this.fibers = this.fibers.filter((x) => x !== f);
    if (f.button) {
      this.busy[f.button] = false;
      const q = this.queue[f.button]; if (q && q.length) { q.shift(); this._deliver(f.button); }
    }
  }
  state() {
    return { time: this.time, pose: this.robot.pose(), moving: this.robot.moving(), fibers: this.fibers.map((f) => f.name), errors: this.errors, notices: [...this.notices, ...[...this.robot.warnings].map((w) => 'ROBOT_' + w), ...[...this.oled.warnings].map((w) => 'OLED_' + w)] };
  }

  /* ---------- AST 워커 ---------- */
  _tick(line) { const f = this._cur; this.totalSteps++; if (++f.steps > this.o.maxNoYieldSteps) throw new SimError('NO_YIELD', '일시중지 없이 계속 도는 반복이 있어요. 마이크로비트가 멈춘 것처럼 보일 수 있어요. 반복 안에 일시중지 블록을 넣어 봐요.', line); }
  *_program() { yield* this._block(this.ast.body, this.globals, true); }
  *_block(stmts, env, hoist) {
    for (const s of stmts) if (s.type === 'FuncDecl') env.vars.set(s.name, { closure: true, params: s.params, body: s.body, env, line: s.line, name: s.name }); // 함수 호이스팅
    for (const s of stmts) { if (s.type !== 'FuncDecl') yield* this._exec(s, env); }
  }
  *_exec(n, env) {
    this._tick(n.line);
    switch (n.type) {
      case 'ExprStmt': yield* this._eval(n.expr, env); return;
      case 'VarDecl': env.vars.set(n.name, n.init ? yield* this._eval(n.init, env) : undefined); return;
      case 'Block': yield* this._block(n.body, new Env(env)); return;
      case 'Empty': return;
      case 'If': if (truthy(yield* this._eval(n.test, env))) yield* this._exec(n.cons, env); else if (n.alt) yield* this._exec(n.alt, env); return;
      case 'While':
        while (truthy(yield* this._eval(n.test, env))) { this._tick(n.line); const s = yield* this._loopBody(n.body, env); if (s === BREAK) break; }
        return;
      case 'For': {
        const e = new Env(env); if (n.init) yield* this._exec(n.init, e);
        while (!n.test || truthy(yield* this._eval(n.test, e))) { this._tick(n.line); const s = yield* this._loopBody(n.body, new Env(e)); if (s === BREAK) break; if (n.update) yield* this._eval(n.update, e); }
        return;
      }
      case 'ForOf': {
        const arr = yield* this._eval(n.iter, env); if (!Array.isArray(arr)) throw new SimError('TYPE', '목록이 필요해요', n.line);
        for (const v of arr.slice()) { this._tick(n.line); const e = new Env(env); e.vars.set(n.name, v); const s = yield* this._loopBody(n.body, e); if (s === BREAK) break; }
        return;
      }
      case 'Return': throw new ReturnSig(n.arg ? yield* this._eval(n.arg, env) : undefined);
      case 'Break': throw BREAK;
      case 'Continue': throw CONTINUE;
      case 'FuncDecl': return;
      default: throw new SimError('SYNTAX', `지원하지 않는 문장 ${n.type}`, n.line);
    }
  }
  *_loopBody(body, env) { try { yield* this._exec(body, env); } catch (e) { if (e === BREAK || e === CONTINUE) return e; throw e; } return null; }
  *_eval(n, env) {
    switch (n.type) {
      case 'Num': return n.value;
      case 'Str': return n.value;
      case 'Bool': return n.value;
      case 'Null': return undefined;
      case 'Arr': { const a = []; for (const it of n.items) a.push(yield* this._eval(it, env)); return a; }
      case 'Func': return { closure: true, params: n.params, body: n.body, env, line: n.line };
      case 'Ident': {
        const e = env.lookup(n.name); if (e) return e.vars.get(n.name);
        if (Object.prototype.hasOwnProperty.call(this.ns, n.name)) return this.ns[n.name];
        throw new SimError('UNKNOWN', `'${n.name}'를 찾을 수 없어요`, n.line);
      }
      case 'Member': {
        // 모르는 확장 이름(예: aiPonybotLight.○○)은 이름 대신 학생용 문장으로(오류 코드는 그대로 UNKNOWN)
        if (n.obj.type === 'Ident' && !env.lookup(n.obj.name) && !Object.prototype.hasOwnProperty.call(this.ns, n.obj.name)) {
          if (this.o.lenient) return this._stub(memberPath(n) || n.prop);
          throw new SimError('UNKNOWN', '아직 모르는 블록이 있어요. 이 블록은 진짜 로봇으로 확인해요.', n.line);
        }
        const o = yield* this._eval(n.obj, env);
        if (o && o.stub) return this._stub(`${o.stub}.${n.prop}`);
        if (typeof o === 'string' || Array.isArray(o)) { if (n.prop === 'length') return o.length; }
        if (o && typeof o === 'object' && !Array.isArray(o) && !o.closure && Object.prototype.hasOwnProperty.call(o, n.prop)) return o[n.prop];
        if (this.o.lenient) return this._stub(memberPath(n) || n.prop);
        throw new SimError('UNKNOWN_API', '아직 모르는 블록이 있어요. 이 블록은 진짜 로봇으로 확인해요.', n.line);
      }
      case 'Index': { const o = yield* this._eval(n.obj, env); const i = yield* this._eval(n.index, env); if (!Array.isArray(o) || typeof i !== 'number') throw new SimError('TYPE', '목록 번호가 잘못됐어요', n.line); return o[i]; }
      case 'Unary': { const v = yield* this._eval(n.arg, env); return n.op === '!' ? !truthy(v) : n.op === '-' ? -v : +v; }
      case 'Bin': {
        const a = yield* this._eval(n.l, env), b = yield* this._eval(n.r, env);
        switch (n.op) {
          case '+': return a + b; case '-': return a - b; case '*': return a * b; case '/': return a / b; case '%': return a % b;
          case '<': return a < b; case '>': return a > b; case '<=': return a <= b; case '>=': return a >= b;
          case '==': case '===': return a === b; case '!=': case '!==': return a !== b;
        }
        break;
      }
      case 'Logical': { const a = yield* this._eval(n.l, env); if (n.op === '&&') return truthy(a) ? yield* this._eval(n.r, env) : a; return truthy(a) ? a : yield* this._eval(n.r, env); }
      case 'Cond': return truthy(yield* this._eval(n.test, env)) ? yield* this._eval(n.cons, env) : yield* this._eval(n.alt, env);
      case 'Assign': case 'Update': return yield* this._assign(n, env);
      case 'Call': return yield* this._callExpr(n, env);
    }
    throw new SimError('SYNTAX', `지원하지 않는 식 ${n.type}`, n.line);
  }
  *_assign(n, env) {
    const target = n.type === 'Assign' ? n.target : n.arg;
    const cur = yield* this._eval(target, env);
    let v;
    if (n.type === 'Update') v = n.op === '++' ? cur + 1 : cur - 1;
    else { const rhs = yield* this._eval(n.value, env); v = n.op === '=' ? rhs : n.op === '+=' ? cur + rhs : n.op === '-=' ? cur - rhs : n.op === '*=' ? cur * rhs : n.op === '/=' ? cur / rhs : cur % rhs; }
    if (target.type === 'Ident') { const e = env.lookup(target.name); if (!e) throw new SimError('UNKNOWN', `'${target.name}' 변수를 먼저 만들어야 해요`, n.line); e.vars.set(target.name, v); }
    else { const o = yield* this._eval(target.obj, env); const i = yield* this._eval(target.index, env); if (!Array.isArray(o)) throw new SimError('TYPE', '목록이 아니에요', n.line); o[i] = v; }
    return n.type === 'Update' && !n.prefix ? cur : v;
  }
  *_callExpr(n, env) {
    const callee = yield* this._eval(n.callee, env);
    const args = []; for (const a of n.args) args.push(yield* this._eval(a, env));
    if (callee && callee.screen) { this._tick(n.line); const ms = callee.screen(args, n.line); if (ms > 0) yield { sleep: ms }; this.matrix.settle(this.time); return undefined; }
    if (callee && callee.wait) { this._tick(n.line); const ms = callee.wait(args, n.line); if (ms > 0) yield { sleep: ms }; return undefined; }
    if (callee && callee.pause) { const ms = typeof args[0] === 'number' ? args[0] : 0; this._tick(n.line); yield { sleep: Math.max(0, ms) }; return undefined; }
    return yield* this._call(callee, args, this._cur, n.line, n);
  }
  *_call(callee, args, f, line, node) {
    if (callee && callee.native) {
      this._tick(line); f = this._cur;
      this.robot.advanceTo(this.time + f.debt); // 앞선 블록들이 쓴 시간까지 차체를 먼저 움직인 뒤 새 명령 적용
      const v = callee.native.call(f, args, line); f.debt += callee.cost || 0; return v;
    }
    if (callee && callee.closure) {
      const fb = this._cur; fb.depth = (fb.depth || 0) + 1;
      if (fb.depth > 40) { fb.depth = 0; throw new SimError('RECURSION', '함수가 자기 자신을 너무 많이 불러요', line); }
      const e = new Env(callee.env); callee.params.forEach((p, i) => e.vars.set(p, args[i]));
      // 비트런: 사용자 함수(function 이름 () {}) 호출 기록 — 어느 이벤트에서(from), 어느 사용자 함수 안에서(by) 불렀나
      const named = !!callee.name; if (named) { const st = (fb.fnStack = fb.fnStack || []); if (this.calls.length < 5000) this.calls.push({ name: callee.name, t: this.time + fb.debt, from: fb.ev || null, by: st.length ? st[st.length - 1] : null }); st.push(callee.name); }
      try {
        if (callee.body.type !== 'Block') return yield* this._eval(callee.body, e);
        try { yield* this._block(callee.body.body, e); } catch (x) { if (x instanceof ReturnSig) return x.v; throw x; }
        return undefined;
      } finally { fb.depth--; if (named) fb.fnStack.pop(); }
    }
    throw new SimError('NOT_CALLABLE', `'${node ? memberPath(node.callee) || '?' : '?'}'는 실행할 수 없어요`, line);
  }
}
const truthy = (v) => !!v;

module.exports = { Sim, SimError, ENUMS };

  };
  defs["grader"] = function (module, exports, require) {
/* 채점 v2: IR(정규화) 위에서 체크리스트 규칙 + 허용 패턴(가장 가까운 정답) + 연결 안 된 블록 리포트 + (선택) 시뮬레이션 동작 확인 */
const { buildIR, normalize, token, deepOps, blockName, fnTokName } = require('./ir');
const { Sim } = require('./sim');
const { COLORS: LED_COLORS, COLOR_KO, packRGB } = require('./leds');
const { SENSORS, sensorName } = require("./sensors");
const { driveView, driveFails } = require('./drive'); // 9~10차시 expect.motors.dir·speed·min·turned
const { NOTE: MUSIC_NOTE, MELODY_KO } = require('./music');

// 학생에게 보이는 토큰 이름: 블록 type·API 이름이 그대로 나가지 않게(UX 라이팅 5차)
const OTHER_KO = { 'grey-js': '글자로 된 회색 블록', if: '만약', controls_if: '만약', loop: '반복', controls_repeat_ext: '반복', device_while: '반복', controls_for: '반복' };
// 포니봇 LED 블록 글자(ai_ponybot_light v1.0.0 블록 글자를 줄임)
const LED_KO = { create: '라이트 설정', showColor: '라이트를 모두 켜기', clear: '라이트 모두 끄기', setBrightness: '라이트 밝기 변경하기', setPixelColor: '번째 라이트 색상 설정하기', show: '라이트를 설정한대로 켜기', showRainbow: '라이트 무지개 효과', showBarGraph: '라이트 그래프 효과' };
const LABEL = (t) => {
  if (/^IF(:|$)/.test(t)) return '만약';
  if (t.startsWith('SET:')) return `변수 ${t.slice(4)}에 값 넣기`;
  if (t.startsWith('CHANGE:')) return `변수 ${t.slice(7)} 값 바꾸기`;
  if (t.startsWith('REPEAT:')) return t.slice(7) === '?' ? '반복' : `${t.slice(7)}번 반복`;
  if (t.startsWith('LED:')) { const [, fn, c] = t.split(':'); const base = LED_KO[fn] || '라이트 블록'; return c && COLOR_KO[c] ? (fn === 'showColor' ? `라이트를 모두 ${c === 'Black' ? '"끄기"로' : COLOR_KO[c] + '으로'} 켜기` : `${base}(${COLOR_KO[c]})`) : base; }
  if (t === 'WAIT') return '일시중지';
  if (t === 'STOP') return '모든 모터 정지';
  if (t === 'MOTOR') return '모터 하나 돌리기';
  if (t === 'STOPM') return '모터 하나 멈추기';
  if (t.startsWith('MOVE:')) return `이동(${t.slice(5)})`;
  if (t.startsWith('SERVO:')) { const [, fn, pin] = t.split(':'); return fn === 'run' ? `연속 서보 ${pin || ''} 회전` : fn === 'stop' ? `서보 ${pin || ''} 정지` : fn === 'pulse' ? `서보 ${pin || ''} 펄스 설정` : '서보 블록'; } // 비트런
  if (t.startsWith('REC:')) return { start: '녹음 시작', play: '녹음 재생', stop: '오디오 정지', erase: '녹음 지우기' }[t.slice(4)] || '녹음 블록';
  if (t.startsWith('CALL:')) return `함수 ${t.slice(5)} 부르기`;
  if (t.startsWith('LINE:') || t.startsWith('COLOR:') || t.startsWith('SOUND:')) return LINE_COLOR_KO(t); // 9~10차시
  if (t.startsWith('OLED:')) return { showString: '문장 출력(위치)', showNumber: '숫자 출력(위치)', printString: '문장 출력(줄바꿈)', printNumber: '숫자 출력(줄바꿈)', rectangle: '사각형 출력', horizontalLine: '수평선 출력', verticalLine: '수직선 출력', clear: '디스플레이 지우기', pixel: '픽셀 출력' }[t.slice(5)] || '화면 출력';
  const o = t.replace(/^OTHER:/, '');
  return OTHER_KO[o] || (blockName(o) ? blockName(o).replace(/^"|" 블록$| 블록$/g, '') : '다른 블록');
};
/* 9~10차시 블록 글자(ai_ponybot_basic v1.3.1 블록 글자, ◌ = 0·● = 1) */
const TWO_SAY = { OffOff: '◌ ◌', OnOn: '● ●', OnOff: '● ◌', OffOn: '◌ ●' }, SIDE_KO = { Left: '왼쪽', Right: '오른쪽' }, DCOLOR_KO = { Red: '빨간색', Green: '초록색', Blue: '파란색', Yellow: '노란색' };
function LINE_COLOR_KO(t) {
  const p = t.split(':');
  if (p[0] === 'LINE' && p[1] === 'two') return `두 라인 센서의 값이 ${TWO_SAY[p[2]] || '…'}`;
  if (p[0] === 'LINE' && p[1] === 'one') return `${SIDE_KO[p[2]] || ''} 라인 센서의 값이 ${p[3] === 'On' ? '●' : p[3] === 'Off' ? '◌' : '…'}`;
  if (p[0] === 'LINE' && p[1] === 'read') return `${SIDE_KO[p[2]] || ''} 라인 센서 값 읽기`;
  if (p[0] === 'COLOR' && p[1] === 'init') return `컬러센서 초기화${p[2] ? ` : ${p[2] === 'V1' ? '검은색 모듈(V1)' : '보라색 모듈(V2)'}` : ''}`;
  if (p[0] === 'COLOR' && p[1] === 'is') return `감지된 색상이 ${DCOLOR_KO[p[2]] || '…'}`;
  if (p[0] === 'COLOR' && p[1] === 'range') return 'R: ~ G: ~ B: ~ 범위';
  if (p[0] === 'COLOR') return { R: '빨간색(R) 색상 값 읽기', G: '초록색(G) 색상 값 읽기', B: '파란색(B) 색상 값 읽기', light: '밝기(B) 값 읽기' }[p[1]] || '색상 감지 센서';
  if (p[0] === 'SOUND' && p[1] === 'effect') return '소리 효과 재생';
  return '소리 블록';
}
/* 받침에 따라 조사 고르기: 한글 끝 글자 또는 숫자(일·칠·팔은 ㄹ 받침, 0으로 끝나면 영·십·백·천 → 받침) */
const DIGIT_JONG = [21, 8, 0, 16, 0, 0, 1, 8, 8, 0];
const josa = (w, a, b) => {
  const h = String(w).replace(/[^가-힣0-9]+$/u, '');
  const c = h.charCodeAt(h.length - 1), d = h.slice(-1);
  const jong = c >= 0xac00 && c <= 0xd7a3 ? (c - 0xac00) % 28 : /[0-9]/.test(d) ? DIGIT_JONG[+d] : 0;
  if (a === '으로') return w + (jong && jong !== 8 ? '으로' : '로');
  return w + (jong ? a : b);
};
const EVENT_NAME = { start: '시작하면', forever: '무한반복', A: 'A 버튼 누를 때', B: 'B 버튼 누를 때', AB: 'A+B 버튼 누를 때', 'gesture:Shake': '흔들림 감지 시', 'sound:Loud': '큰 소리 감지 시', 'sound:Quiet': '작은 소리 감지 시',
  'radio:number': '라디오로 수를 받으면', 'radio:string': '라디오로 문자열을 받으면', 'radio:value': '라디오로 이름과 값을 받으면', uart: '블루투스 데이터 수신 시', 'bt:connect': '블루투스 연결 시', 'bt:disconnect': '블루투스 연결 해제 시',
  logo: '로고를 터치하면', 'logo:Touched': '로고를 만지면', 'logo:Released': '로고에서 손을 떼면', 'logo:LongPressed': '로고를 길게 누르면' }; // 비트런: 로고 터치(V2)
// 규칙 in·event의 짧은 이름(7~8차시): shake = 흔들림 감지 시(input.onGesture(Gesture.Shake)), loud = 큰 소리 감지 시(input.onSound(DetectedSound.Loud), V2)
// 11~12차시: on:radio(라디오로 수를 받으면)·on:radioString·on:radioValue·on:uart(블루투스 데이터 수신 시)·on:btConnect·on:btDisconnect
const EV_ALIAS = { shake: 'gesture:Shake', loud: 'sound:Loud', quiet: 'sound:Quiet', 'on:radio': 'radio:number', 'on:radioString': 'radio:string', 'on:radioValue': 'radio:value', 'on:uart': 'uart', 'on:btConnect': 'bt:connect', 'on:btDisconnect': 'bt:disconnect' };
const evName = (w) => EV_ALIAS[w] || w;

/* ---------- 패턴 미니 문법: "(MOVE:↑ WAIT MOVE:↷|MOVE:↶ WAIT)*4 STOP", 접미사 ? = 선택 ---------- */
function parsePattern(src) {
  const toks = src.replace(/\(/g, ' ( ').replace(/\)\*(\d+)/g, ' )*$1 ').split(/\s+/).filter(Boolean);
  let i = 0;
  function seq(untilClose) {
    const out = [];
    while (i < toks.length) {
      const t = toks[i++];
      if (t === '(') { const inner = seq(true); const rep = /^\)\*(\d+)$/.exec(toks[i - 1]); const n = rep ? +rep[1] : 1; for (let r = 0; r < n; r++) out.push(...inner.map((e) => Object.assign({}, e))); continue; }
      if (/^\)/.test(t)) { if (!untilClose) throw new Error('괄호 오류'); return out; }
      const opt = t.endsWith('?'); const body = opt ? t.slice(0, -1) : t;
      out.push({ alts: body.split('|'), opt });
    }
    return out;
  }
  return seq(false);
}
/* 토큰 별칭(5~6 콘텐츠 초안의 이름도 받음, S3-5): LED:ALL = LED:showColor*, LED:PIX = LED:setPixelColor*, LED:BRIGHT = LED:setBrightness,
 * LED:CREATE = LED:create, LED:SHOW = LED:show, LED:CLEAR = LED:clear, LED:FX = 무지개·그래프, VAR:SET = SET:*, VAR:CHANGE = CHANGE:*, IF = IF*, REPEAT = REPEAT:*
 * LED:OFF = 모두 끄기 또는 '끄기'(검정)로 켜기, LED:ON = 켜는 블록, WHILE = ~인 동안 반복, LOOP = 반복 블록 무엇이든(설계 개정 2)
 * 꼬리를 붙이면 그대로 이어 붙임: LED:ALL:White = LED:showColor:White, VAR:SET:밝기 = SET:밝기 */
const TOK_ALIAS = [['LED:ALL', 'LED:showColor', true], ['LED:PIX', 'LED:setPixelColor', true], ['LED:BRIGHT', 'LED:setBrightness'], ['LED:CREATE', 'LED:create'], ['LED:SHOW', 'LED:show'], ['LED:CLEAR', 'LED:clear'], ['VAR:SET', 'SET', true, ':'], ['VAR:CHANGE', 'CHANGE', true, ':']];
function expandTok(a) {
  if (a === 'IF') return ['IF*'];
  if (a === 'REPEAT') return ['REPEAT:*'];
  if (a === 'LED:FX') return ['LED:showRainbow', 'LED:showBarGraph'];
  // 9~10차시: DRIVE = 포니봇 이동 4방향(runNormal·메카넘 같은 화살표), DRIVE:forward|backward|left|right, DRIVE:stop = 모든 모터 정지
  if (a === 'DRIVE' || a === 'DRIVE:normal') return ['MOVE:↑', 'MOVE:↓', 'MOVE:↶', 'MOVE:↷'];
  if (a === 'DRIVE:turn') return ['MOVE:↶', 'MOVE:↷'];
  { const d = { 'DRIVE:forward': 'MOVE:↑', 'DRIVE:backward': 'MOVE:↓', 'DRIVE:left': 'MOVE:↶', 'DRIVE:right': 'MOVE:↷', 'DRIVE:stop': 'STOP' }[a]; if (d) return [d]; }
  // 9~10차시: LINE = 라인 센서 블록 무엇이든, LINE:two·LINE:one·LINE:read = 그 블록(고른 값 무엇이든), COLOR:RGB = R·G·B 값 읽기, COLOR:is = 감지된 색상이 ~, SOUND = 소리 블록
  if (a === 'LINE' || a === 'LINE:two' || a === 'LINE:one' || a === 'LINE:read' || a === 'COLOR:is' || a === 'COLOR:init' || a === 'SOUND') return [a + ':*'];
  if (a === 'COLOR:RGB') return ['COLOR:R', 'COLOR:G', 'COLOR:B'];
  // 비트런: SERVO = 서보 블록 무엇이든, SERVO:run·stop·pulse = 그 블록(핀 무엇이든), REC = 녹음 블록, CALL = 사용자 함수 부르기(표식, has·none에서)
  if (a === 'SERVO' || a === 'REC' || a === 'CALL') return [a + ':*'];
  if (/^SERVO:(run|stop|pulse|angle)$/.test(a)) return [a + ':*'];
  { const m = /^OTHER:servos\.(P\d+|\*)(?:\.(\w+))?$/.exec(a); if (m) { const fn = { run: 'run', stop: 'stop', setPulse: 'pulse', setAngle: 'angle' }[m[2]]; return [m[1] === '*' ? 'SERVO:*' : fn ? `SERVO:${fn}:${m[1]}` : `SERVO:*`]; } } // 엔진이 서보를 알기 전 토큰(OTHER:servos.P1.run)도 받음
  { const r = { 'OTHER:record.startRecording': 'REC:start', 'OTHER:record_startRecording': 'REC:start', 'OTHER:record.playAudio': 'REC:play', 'OTHER:record_playAudio': 'REC:play' }[a]; if (r) return [r]; }
  if (a === 'OTHER:aiPonybot.initColorSensor' || a === 'OTHER:aiponybot_color_init_version') return ['COLOR:init*']; // 9~10 데이터 초안 이름(엔진이 COLOR:init으로 바꾸기 전)
  if (a === 'SCREEN:SHOW') return ['SCREEN:icon*', 'SCREEN:leds*', 'SCREEN:arrow*', 'SCREEN:number', 'SCREEN:string']; // LED 화면에 무엇이든 보이는 블록(1차시)
  if (a === 'SCREEN:ICON') return ['SCREEN:icon*'];
  if (a === 'SCREEN:PIC') return ['SCREEN:icon*', 'SCREEN:leds*']; // 그림(아이콘 출력 또는 LED 출력)
  if (a === 'LED:OFF') return ['LED:clear', 'LED:showColor:Black']; // 끄기 = '모두 끄기' 또는 '끄기(검정)으로 켜기'(P3)
  if (a === 'LED:ON') return ['LED:showColor*', 'LED:show', 'LED:showRainbow', 'LED:showBarGraph']; // 켜는 블록(끄기 색도 포함 — 꺼짐 판정은 시나리오)
  if (a === 'WHILE') return ['OTHER:loop', 'OTHER:device_while', 'OTHER:controls_whileUntil']; // ~인 동안 반복(TS while·셀 수 없는 for, XML device_while)
  if (a === 'LOOP') return ['REPEAT:*', 'OTHER:loop', 'OTHER:device_while', 'OTHER:controls_whileUntil', 'OTHER:pxt_controls_for_of', 'OTHER:controls_for_of']; // 반복 블록이면 무엇이든
  for (const [al, to, wild, sep] of TOK_ALIAS) {
    if (a === al) return [wild ? `${to}${sep || ''}*` : to];
    if (a.startsWith(al + ':')) return [to + a.slice(al.length)];
  }
  return [a];
}
const matchTok = (alts, t) => alts.some((a0) => expandTok(a0).some((a) => a === t || (a.endsWith('*') && t.startsWith(a.slice(0, -1)))));
const cat = (t) => t.split(':')[0];

/** 학생 토큰열 S와 패턴 P의 최소 편집 정렬 → {cost, edits:[{op:'ok'|'sub'|'del'|'ins', i, j}]} */
function align(S, P) {
  const n = S.length, m = P.length, D = Array.from({ length: n + 1 }, () => new Float64Array(m + 1)), B = Array.from({ length: n + 1 }, () => new Int8Array(m + 1));
  for (let i = 1; i <= n; i++) { D[i][0] = i; B[i][0] = 2; }
  for (let j = 1; j <= m; j++) { D[0][j] = D[0][j - 1] + (P[j - 1].opt ? 0 : 1); B[0][j] = 3; }
  for (let i = 1; i <= n; i++) for (let j = 1; j <= m; j++) {
    const ok = matchTok(P[j - 1].alts, S[i - 1]);
    const sub = D[i - 1][j - 1] + (ok ? 0 : P[j - 1].alts.some((a) => cat(a) === cat(S[i - 1])) ? 0.6 : 1.2);
    const del = D[i - 1][j] + 1, ins = D[i][j - 1] + (P[j - 1].opt ? 0 : 1);
    // 비용이 같으면 '넣기'를 우선 → 역추적 시 빠진 블록이 가능한 한 뒤쪽(정지 바로 앞 등)에 놓인다
    if (ins <= sub && ins <= del) { D[i][j] = ins; B[i][j] = 3; } else if (sub <= del) { D[i][j] = sub; B[i][j] = ok ? 0 : 1; } else { D[i][j] = del; B[i][j] = 2; }
  }
  const edits = []; let i = n, j = m;
  while (i > 0 || j > 0) {
    const b = B[i][j];
    if (b === 0 || b === 1) { edits.push({ op: b === 0 ? 'ok' : 'sub', i: i - 1, j: j - 1 }); i--; j--; }
    else if (b === 2) { edits.push({ op: 'del', i: i - 1, j }); i--; }
    else { if (!P[j - 1].opt) edits.push({ op: 'ins', i, j: j - 1 }); j--; }
  }
  return { cost: D[n][m], edits: edits.reverse() };
}

/** 가장 가까운 허용 패턴과의 차이 → 단계별 피드백(level 1~3) */
function nearest(ir, spec, level = 2) {
  const script = ir.scripts.find((s) => s.event === spec.in);
  const ops = script ? normalize(script.ops, ir.userFns) : [];
  const S = ops.map(token);
  let best = null;
  spec.accept.forEach((src, k) => { const P = parsePattern(src); const a = align(S, P); if (!best || a.cost < best.cost) best = Object.assign(a, { k, P }); });
  const first = best.edits.find((e) => e.op !== 'ok');
  if (!first) return { ok: true, cost: 0, pattern: best.k };
  const where = EVENT_NAME[spec.in] || spec.in;
  // 대안이 여럿이면(예: ↑|→|↓|←) 학생 코드에 아직 없는 것만 말한다
  const exp = (j) => { const alts = best.P[j].alts; const missing = alts.filter((a) => !S.some((t) => matchTok([a], t))); return (missing.length ? missing : alts).map(LABEL).join(' 또는 '); };
  // 같은 블록을 한 곳에서 빼고 다른 곳에 넣는 편집 → '옮기기'
  const del = best.edits.find((e) => e.op === 'del'), insSame = del && best.edits.find((e) => e.op === 'ins' && matchTok(best.P[e.j].alts, S[del.i]));
  if (del && insSame && level >= 2) {
    const to = insSame.i > 0 ? `${insSame.i}번째 블록(${LABEL(S[insSame.i - 1])}) 다음으로` : '맨 처음으로';
    return { ok: false, cost: +best.cost.toFixed(2), pattern: best.k, first: { op: 'move', i: del.i, to: insSame.i, got: S[del.i], src: ops[del.i] && ops[del.i].src }, msg: level === 2 ? `'${where}' 안 ${del.i + 1}번째 블록(${LABEL(S[del.i])})의 자리를 다시 생각해 봐요.` : `'${where}' 안 ${del.i + 1}번째 블록 '${josa(LABEL(S[del.i]) + "'", '을', '를')} ${to} 옮겨 봐요.` };
  }
  const prev = first.i > 0 ? `${first.i}번째 블록(${LABEL(S[first.i - 1])}) 다음에` : '맨 처음에';
  const nMissing = best.edits.filter((e) => e.op === 'ins').length, nExtra = best.edits.filter((e) => e.op === 'del').length, nSub = best.edits.filter((e) => e.op === 'sub').length;
  // 개수 대신 종류만 말한다(“빠진 블록이 7개”처럼 겁주는 숫자 없이)
  const kinds = [nMissing && '빠진 블록', nExtra && '남는 블록', nSub && '바꿀 블록'].filter(Boolean);
  let msg;
  // 맨 위 블록이 없거나 비어 있으면 '그 안을 살펴봐요' 대신 맨 위 블록부터 안내
  if (!script) msg = spec.in === 'start' ? `'${where}' 블록 안이 비어 있어요.` : `'${where}' 블록이 아직 없어요. 이 블록부터 꺼내요.`;
  else if (!S.length) msg = `'${where}' 블록 안이 비어 있어요.`;
  else if (level <= 1) msg = `'${where}' 안에 ${kinds.join(', ')}이 있어요. 힌트를 열어 비교해 봐요.`;
  else if (first.op === 'ins') msg = level === 2 ? `'${where}' 안 ${prev} 블록이 하나 더 필요해요.` : `'${where}' 안 ${prev} '${exp(first.j)}' 블록을 넣어 봐요.`;
  else if (first.op === 'del') msg = level === 2 ? `'${where}' 안 ${first.i + 1}번째 블록(${LABEL(S[first.i])})${josa(LABEL(S[first.i]), '이', '가').slice(LABEL(S[first.i]).length)} 꼭 필요한지 생각해 봐요.` : `'${where}' 안 ${first.i + 1}번째 블록(${LABEL(S[first.i])})${josa(LABEL(S[first.i]), '은', '는').slice(LABEL(S[first.i]).length)} 빼도 돼요.`;
  else msg = level === 2 ? `'${where}' 안 ${first.i + 1}번째 블록(${LABEL(S[first.i])})${josa(LABEL(S[first.i]), '을', '를').slice(LABEL(S[first.i]).length)} 다시 살펴봐요.` : `'${where}' 안 ${first.i + 1}번째 블록 '${josa(LABEL(S[first.i]) + "'", '을', '를')} '${josa(exp(first.j) + "'", '으로')} 바꿔 봐요.`;
  return { ok: false, cost: +best.cost.toFixed(2), pattern: best.k, first: Object.assign({}, first, { got: S[first.i], want: first.j != null && best.P[first.j] ? best.P[first.j].alts : null, src: ops[first.i] && ops[first.i].src }), msg, counts: { missing: nMissing, extra: nExtra, sub: nSub } };
}

/* ---------- 체크리스트 규칙(JSON) ---------- */
function opsIn(ir, where) {
  where = evName(where);
  const pick = where === 'any' ? ir.scripts : ir.scripts.filter((s) => s.event === where);
  return pick.flatMap((s) => normalize(s.ops, ir.userFns));
}
/** '만약'·반복 안쪽까지 펼친 블록(B형). marks면 표식 토큰(CMP:<·ELSE·SENSE:light)도 */
function deepIn(ir, where, marks = false) {
  where = evName(where);
  const pick = where === 'any' ? ir.scripts : ir.scripts.filter((s) => s.event === where);
  return pick.flatMap((s) => deepOps(s.ops, ir.userFns, { marks }));
}
/** 블록 하나가 규칙의 칸 조건에 맞는지(has·none과 함께): index(몇 번째 라이트), value(밝기·저장·증가 값·일시중지 ms, 수 비교 규칙 '<=20'),
 *  arg('var' 변수 | 'loopvar' 반복 변수(for index…의 index) | 'num' 숫자 | 센서 이름 'light'·'SENSE:light'·'lightLevel'), args({ pin:'P8', n:4 } 라이트 설정)
 *  arg가 보는 칸: 번째 라이트 색상 = 번호 칸, 밝기 = 밝기 칸, 증가 = 증가 값, OLED = 첫 칸, 그 밖 = 값 */
const OP_FILTERS = ['index', 'value', 'arg', 'args', 'inLoop'];
const argOf = (op) => (op.k === 'change' ? op.by : op.k === 'oled' ? (op.args || [])[0] : op.k === 'led' && op.fn === 'setPixelColor' ? op.index : op.k === 'wait' ? op.ms : op.value);
function opFilter(op, r) {
  if (r.inLoop != null && !!op.inLoop !== !!r.inLoop) return false; // 반복(13번 이상)·while 안에 있음
  if (r.index != null && op.index !== r.index) return false;
  if (r.value != null) { const v = op.k === 'change' ? op.by : op.k === 'wait' ? op.ms : op.value; if (!cmp(v, r.value)) return false; }
  if (r.arg != null) {
    const v = argOf(op);
    const isVar = v && typeof v === 'object' && (v.dyn === 'Ident' || v.dyn === 'variables_get');
    if (r.arg === 'loopvar') { if (!(isVar && op.argVar && (op.loopVars || []).includes(op.argVar))) return false; }
    else if (r.arg === 'var' ? !isVar : r.arg === 'num' ? typeof v !== 'number' : !(op.reads || []).includes(sensorName(r.arg))) return false;
  }
  if (r.args) for (const [k, want] of Object.entries(r.args)) if (op[k] !== want) return false;
  return true;
}
/** 측정 기록 값(숫자로). ctx.records = { key: 값 } */
const recNum = (ctx, k) => { const v = ((ctx && ctx.records) || {})[k]; return v === '' || v == null || !isFinite(+v) ? null : +v; };
// ★7~8 페르소나 2회차 #4: gt·lt·between 자리에 수 상수도(문자열 = 칸 key, 수 = 그 값). range:[6, 14]·'6~14'(같아도 통과)는 cmp 그대로
const recArg = (ctx, k) => (typeof k === 'number' ? (isFinite(k) ? k : null) : recNum(ctx, k));
function recordRule(r, ctx) {
  const key = r.record || r.rec, v = recNum(ctx, key);
  if (v == null) return false;
  if (r.gt != null && !(recArg(ctx, r.gt) != null && v > recArg(ctx, r.gt))) return false;
  if (r.lt != null && !(recArg(ctx, r.lt) != null && v < recArg(ctx, r.lt))) return false;
  if (r.between) { const [a, b] = r.between.map((k) => recArg(ctx, k)); if (a == null || b == null || !(v > Math.min(a, b) && v < Math.max(a, b))) return false; }
  if (r.range && !cmp(v, r.range)) return false;
  return true;
}
/** 조건 하나(또는 그리고/또는 묶음)가 cond 규칙{ sensor, op, value }에 맞는지.
 *  taint = 그 센서 값을 담은 변수 이름들(P3: '빛 밝기를 변수에 담아 비교'도 인정) */
function condMatch(c, want, taint) {
  if (!c) return false;
  if (c.logic) return c.parts.some((p) => condMatch(p, want, taint));
  if (c.not) return condMatch(c.not, want, taint);
  if (!c.op) return false;
  const ops = want.op ? (Array.isArray(want.op) ? want.op : String(want.op).split('|')) : null;
  if (want.sensor && c.sensor !== sensorName(want.sensor) && !(taint && c.l && c.l.var && taint.has(c.l.var))) return false;
  if (want.var && !(c.l && c.l.var === want.var)) return false;
  if (ops && !ops.includes(c.op)) return false;
  if (want.value != null && !(typeof c.value === 'number' && cmp(c.value, want.value))) return false;
  return true;
}
/** 수 비교 규칙: 40 | '>=100' | '<50' | '20~200' | [20, 200] */
function cmp(v, spec) {
  if (typeof v !== 'number') return false;
  if (Array.isArray(spec)) return v >= spec[0] && v <= spec[1];
  if (typeof spec === 'number') return v === spec;
  const s = String(spec).trim(), m = /^(<=|>=|<|>|==|!=)?\s*(-?\d+(?:\.\d+)?)$/.exec(s), rg = /^(-?\d+(?:\.\d+)?)\s*~\s*(-?\d+(?:\.\d+)?)$/.exec(s);
  if (rg) return v >= +rg[1] && v <= +rg[2];
  if (!m) return false;
  const n = +m[2];
  const t = { '<': v < n, '>': v > n, '<=': v <= n, '>=': v >= n, '!=': v !== n }[m[1]];
  return t === undefined ? v === n : t;
}
/** 비트런: 사용자 함수 정의 조건 — true(하나 이상) | 수 규칙('>=2', 2 — 정의 개수) | '이름' | ['이름'…](모두 있음). 이름 띄어쓰기는 _로 맞춰 비교 */
const isNumRule = (x) => typeof x === 'number' || Array.isArray(x) && x.every((y) => typeof y === 'number') || (typeof x === 'string' && /^(<=|>=|<|>|==|!=)?\s*-?\d+(\.\d+)?(\s*~\s*-?\d+(\.\d+)?)?$/.test(x.trim()));
function definedOk(names, want) {
  const have = new Set(names.map(fnTokName));
  if (want === true) return have.size > 0;
  if (want === false) return have.size === 0;
  if (isNumRule(want)) return cmp(have.size, want);
  return [].concat(want).every((n) => have.has(fnTokName(n)));
}
function runRule(ir, r, ctx = {}) {
  if (r.all) return r.all.every((x) => runRule(ir, Object.assign({ in: r.in }, x), ctx));
  if (r.anyOf) return r.anyOf.some((x) => runRule(ir, Object.assign({ in: r.in }, x), ctx));
  if (r.event) return ir.scripts.some((s) => s.event === evName(r.event));
  if (r.defined != null) return definedOk(Object.keys(ir.userFns || {}), r.defined); // 비트런: 사용자 함수 정의(블록 '함수 만들기')
  // B형(S3-5): 측정 기록 · 시나리오(동작) · 조건 모양 · 센서 읽기 · 만약/아니면 칸 · 짝
  if (r.record != null || r.rec != null) return recordRule(r, ctx);
  if (r.scenario != null) {
    const list = (ctx.mission && ctx.mission.scenarios) || [];
    const sc = typeof r.scenario === 'number' ? list[r.scenario] : list.find((s) => s.name === r.scenario);
    if (!sc) throw new Error('알 수 없는 시나리오 ' + r.scenario);
    const res = runScenario(ctx.ts || '', sc, list.indexOf(sc), ctx.cache, { records: ctx.records });
    return res.ok !== false; // 판단 못 함(모르는 블록)은 통과를 막지 않는다(gate 원칙)
  }
  const alts = (x) => (Array.isArray(x) ? x : String(x).split('|'));
  // 센서 값을 담은 변수(어디서든 '변수 = 센서 값'): 조건에서 그 변수를 비교해도 센서 비교로 본다
  const taintOf = (sn) => new Set(ir.scripts.flatMap((s) => deepOps(s.ops, ir.userFns)).filter((o) => o.k === 'set' && (o.reads || []).includes(sn)).map((o) => o.name));
  if (r.cond) { const tn = r.cond.sensor ? taintOf(sensorName(r.cond.sensor)) : null; return deepIn(ir, r.in || 'any').some((o) => o.k === 'if' && (o.conds || []).some((c) => condMatch(c, r.cond, tn))); }
  if (r.sensor) { const sn = sensorName(r.sensor), tn = taintOf(sn); return deepIn(ir, r.in || 'any').some((o) => (o.reads || []).includes(sn) || (o.k === 'if' && (o.conds || []).some((c) => condMatch(c, { sensor: sn }, tn)))); }
  if (r.branch) { // { then: 'LED:ALL', else: 'LED:CLEAR' } — 만약 칸(첫 칸)과 아니면 칸(마지막 칸)에 그 블록이 있음
    const inBody = (b, want) => deepOps(b, ir.userFns, { marks: true }).some((o) => matchTok(alts(want), token(o)));
    return deepIn(ir, r.in || 'any').some((o) => o.k === 'if' && (r.branch.then == null || inBody(o.bodies[0] || [], r.branch.then)) && (r.branch.else == null || (o.hasElse && inBody(o.bodies[o.bodies.length - 1], r.branch.else))));
  }
  if (r.pairs) { // { a, b, min } — a 바로 다음이 b인 곳이 min번 이상(표식 토큰 빼고, 안쪽까지)
    const t2 = deepIn(ir, r.in || 'any').map(token); let n = 0;
    for (let i = 0; i + 1 < t2.length; i++) if (matchTok(alts(r.pairs.a), t2[i]) && matchTok(alts(r.pairs.b), t2[i + 1])) n++;
    return n >= (r.pairs.min || 1);
  }
  // has·none(·not)은 '만약'·반복·while 안까지 본다(deep 기본, 표식 토큰 CMP:·ELSE·SENSE:도 셈). last·order·distinct는 맨 위 차례만(deep:true면 펼침)
  const none = r.none != null ? r.none : r.not;
  const deepOn = r.deep != null ? !!r.deep : !!(r.has || none);
  const ops = deepOn ? deepIn(ir, r.in || 'any', true) : opsIn(ir, r.in || 'any');
  const filt = OP_FILTERS.some((k) => r[k] != null);
  // arg 'var'·'loopvar': 라이트 묶음 변수(strip)를 밝기·번호 칸에 끼운 것은 변수로 치지 않는다(설계 개정 2 led-4 "strip 말고 밝기")
  const strips = r.arg === 'var' || r.arg === 'loopvar' ? new Set(ir.scripts.flatMap((s) => deepOps(s.ops, ir.userFns)).filter((o) => o.k === 'led' && o.fn === 'create').map((o) => o.var)) : null;
  const hit = (want) => ops.filter((o) => matchTok(alts(want), token(o)) && (!filt || opFilter(o, r)) && !(strips && o.argVar && strips.has(o.argVar)));
  const toks = ops.map(token);
  if (r.has) return hit(r.has).length >= (r.min || 1);
  if (none != null) return !hit(none).length;
  if (r.last) { const t3 = toks.filter((t) => !/^(CMP:|ELSE$|SENSE:|CALL:)/.test(t)); return t3.length > 0 && matchTok(alts(r.last), t3[t3.length - 1]); }
  if (r.order) { let p = 0; for (const want of r.order) { while (p < toks.length && !matchTok(alts(want), toks[p])) p++; if (p++ >= toks.length) return false; } return true; }
  if (r.distinct) { const ds = (r.deep ? deepIn(ir, r.in || 'any') : opsIn(ir, r.in || 'any')).filter((o) => matchTok(alts(r.distinct.tok), token(o))); return new Set(ds.map((o) => JSON.stringify(o[r.distinct.field]))).size >= r.distinct.min; }
  throw new Error('알 수 없는 규칙 ' + JSON.stringify(r));
}

/* ---------- 연결 안 된 블록 · 회색 블록 리포트 ---------- */
function structureReport(ir) {
  const out = [];
  // 블록 type 이름 대신 학생용 이름(ir.blockName), 회색 블록은 다음 행동까지 한 번에 말한다
  for (const f of ir.floating) {
    const nm = blockName(f.type);
    out.push({ kind: 'floating', blockId: f.blockId, msg: `${nm ? `${f.count > 1 ? josa(nm, '과', '와') + ' 그 아래 블록' : nm}이 어디에도 끼워지지 않았어요.` : '어디에도 끼워지지 않은 블록이 있어요.'} 회색 블록은 실행되지 않으니 맨 위 블록 안에 끼워 봐요.` });
  }
  for (const d of ir.disabled) out.push({ kind: 'disabled', blockId: d.blockId, msg: `회색으로 바뀐 ${josa(blockName(d.type) || '블록', '이', '가')} 있어요. 회색 블록은 실행되지 않으니 지우고 새 블록으로 다시 넣어 봐요.` });
  for (const d of ir.duplicates) out.push({ kind: 'duplicate', msg: EVENT_NAME[d.event] ? `'${EVENT_NAME[d.event]}' 블록이 2개 있어요. 하나만 실행되니 하나로 합쳐 봐요.` : '같은 맨 위 블록이 2개 있어요. 하나만 실행되니 하나로 합쳐 봐요.' });
  if (ir.partial.length) out.push({ kind: 'partial', msg: '글자로 된 회색 블록이 있어요. 블록으로 바뀌지 않은 코드예요. 지우고 블록으로 다시 만들어 봐요.' });
  for (const s of ir.scripts) if (!s.ops.length && s.event !== 'forever' && s.event !== 'start') out.push({ kind: 'empty', msg: EVENT_NAME[s.event] ? `'${EVENT_NAME[s.event]}' 블록 안이 비어 있어요.` : '맨 위 블록 안이 비어 있어요.' });
  if (ir.consistent === false) out.push({ kind: 'mismatch', msg: '코딩 화면이 아직 저장 중이에요. 2~3초 뒤 다시 눌러 주세요.' });
  return out;
}

/* ---------- B형 시나리오 채점(S3-5): 화면 없이 센서 값을 넣고 돌려 LED·OLED·모터 상태를 본다(결정 D18) ----------
 * scenario = { name, label?, given, run, expect, timeline?, msg? } — 콘텐츠 담당용 정리는 planning/series/06-impl-s3.md "콘텐츠 담당용 형식"
 *   given   { lightLevel: 20 } — 값: 숫자 | 배열(무한반복 n번째 바퀴마다 n번째 값, 끝 값 유지) | '$rec.dark'(학생 측정 기록, 없으면 given.fallback)
 *           | ['$rec.bright', '$rec.dark'](+ fallback: [150, 10]) | { rec: 'dark', fallback: 10 }. 센서 이름은 lightLevel·light·SENSE:light 모두 됨
 *   run     { ms: 1000(가상 시간, 기본) | loops: n(무한반복 n바퀴를 마칠 때까지), sample: 100(timeline 표본 간격 ms), event: 'forever'|'A'|'B'|'AB'(버튼은 100ms에 누름),
 *             press: 'A'|[{ btn, at }], set: [{ at, lightLevel }](실행 중 값 바꾸기) }
 *   expect  끝 상태(loops면 n바퀴를 마친 순간). timeline: [{ at, expect }] 그 시각 상태
 * expect.leds  { all:색, color:색(켜진 LED가 모두 이 색, 하나 이상 켜짐), pixels|list:[색×4], L1~L4:색, brightness:수, lit:수, distinct:n(지금 켜진 색 가짓수),
 *                seq:[색…](loops: 바퀴마다 끝 상태), seen:[색…](차례로 본 '모두 같은 색'), brightnessSeen:[수…], rises·falls:true|n,
 *                timeline:{ color, distinct, distinctOn, endsOff, brightness:'up'|'down'|['up','down']|수, range:[a, b] }(run.sample마다 본 상태 모음) }
 *   색 = 'red'|'White'|'#FFFFFF'|'off'|'on' (NeoPixelColors 이름, 대소문자 무시. '논리 색' = 블록에서 고른 색. 켜진 LED만 그 색으로 침, 밝기는 따로)
 *   수 = 40 | '>=100' | '<50' | '20~200' | [20, 200]
 * expect.oled  { lastNumber:수(가장 아래 줄의 마지막 숫자), has:'37'|['a','b'], rows:{ 0:'abc' }, lit:수, empty:true }
 * expect.motors { moving, speed:수(마지막 이동 블록에 넣은 속도 — map·constrain 소수 그대로, 멈추면 0), dir:'↑'|'Forward'|'stop' } · expect.reads 'lightLevel' · expect.vars { 밝기:수 }
 * ★7~8차시 given: distance(초음파 cm — 'none' 또는 500 이상 = 못 잼 → cm 500·inch 196·µs 29000), soundLevel, acceleration(가속도 세기 mg, 배열이면 바퀴마다),
 *             random(randint 값: 수 | [수…] 부를 때마다 차례로 | 'min'·'max'·'mid'), seed(정하지 않으면 1 — 늘 같은 값), buttons({ A: true } 계속 누름 = input.buttonIsPressed)
 *   run  press: 'A' | [{ btn, at, times?, every?(ms, 기본 300), hold?(ms, 기본 150) }], shake: n | [{ at, times, every }](흔들림 감지 시), sound: n | [{ at, times, every }](큰 소리 감지 시, V2),
 *        gesture: [{ g:'Shake'|'LogoUp'…, at, times, every }]  — 숫자만 쓰면 100ms부터 every(기본 300)마다 n번
 * expect.sound { beeps:수(울린 횟수 — 붙어 있는 같은 높이는 하나), quiet:true(안 울림), rings:true(한 번 이상), on:true|false(그 순간 울리는 중), freq:수|'C5'(모든 울림 높이 Hz),
 *                notes:[Hz…](처음부터 차례로), interval:수(울림 시작 사이 ms의 가운데 값), length:수(울림 길이 ms의 가운데 값, 끝에 잘린 것 빼고), melody:'PowerDown',
 *                from·to(ms: 이 구간에서 시작한 울림만), phases:[sound 규칙…](run.set 시각으로 나눈 구간마다), trend:'faster'|'slower'(구간마다 interval이 짧아짐/길어짐) }
 * ★11~12차시 given: tilt('flat'|'left'|'right'|'forward'|'back' 또는 [x, y] mg, 배열이면 바퀴마다 — 조종용 마이크로비트를 기울인 자세)
 *   run  radio: [3 | { number: 3 } | { string: 'go' } | { name, value } + at?, group?(보낸 쪽 그룹 — 받는 쪽과 다르면 못 받음)](기본 200ms부터 300ms마다),
 *        uart: ['U' | { text: 'U', at }](기본 2.5초부터 0.4초마다, 그 전에 100ms에 블루투스 연결 — run.connect: false면 연결 안 함), connect: true|{ at }, disconnect: { at }
 *   expect.radio { group:수(설정한 그룹), sent:[수…](모두 한 번 이상 보냄), only:[수…](이것 말고는 안 보냄), notSent:[수…], any:true|false(무엇이든 보냄), from:ms(이 시각 뒤에 보낸 것만) }
 *   expect.bt { uart:true(데이터 받기 시작 블록 실행), connected:true|false }
 *   expect.motors.dir에 '←'·'→'(메카넘 옆으로)도 됨
 * msg 값(★): {value}(첫 센서), {distance}, {beeps}, {interval}, {length}, {freq}, {speed}, {tilt}(기울기 한국어), {sent}(보낸 수 목록)
 * ★9~10차시: given lineL·lineR(0/1)·R·G·B(0~255)·colorLight. expect.motors { dir:'forward'|'backward'|'left'|'right'|'stop'(↑·Forward 같은 이름도), speed:수 규칙(지금 속도),
 *   min:n(움직인 명령 속도가 모두 n 이상), turned:'left'|'right'|true|false(그때까지 runNormal로 돈 적) } — 끝 상태(loops면 n바퀴 끝, 아니면 ms 끝)·timeline 시각 상태 기준(drive.js)
 *   expect.sound { played:true|false, effect?:'twinkle' } · expect.oled.text = has(포함할 글, 여러 조각 배열) · expect.leds.rgb [r, g, b](켜진 LED가 모두 그 색) · expect.colorVersion 'V1'|'V2'
 *   expect 값에 '$rec.키' + 같은 묶음 fallback(수·{키:수}) 또는 { rec, fallback } — 기록이 없으면 예시값(학생 문장 끝에 붙음)
 * 결과 { name, label, ok:true|false|null, fails:[학생용 문장], msg, state } — ok null = 모르는 블록이 있어 판단 못 함(통과를 막지 않음) */
const COLOR_OF = (() => { const m = {}; for (const [k, v] of Object.entries(LED_COLORS)) { m[k.toLowerCase()] = v; } return m; })();
const colorSay = (spec) => { const s = String(spec); if (/^off$/i.test(s)) return '꺼짐'; if (/^on$/i.test(s)) return '켜짐'; const k = Object.keys(LED_COLORS).find((n) => n.toLowerCase() === s.toLowerCase() || '#' + LED_COLORS[n].toString(16).padStart(6, '0').toLowerCase() === s.toLowerCase()); return k ? COLOR_KO[k] : s; };
/** '…이어야 해요' 꼴: 꺼짐 → '꺼져 있어야', 흰색 → '흰색이어야' */
const mustBe = (spec) => { const s = colorSay(spec); return s === '꺼짐' || s === '끄기' ? '꺼져 있어야' : s === '켜짐' ? '켜져 있어야' : `${s}이어야`; };
/** 수 규칙을 말로: 40 → '40이어야', '<100' → '100보다 작아야' */
const mustNum = (spec) => {
  if (Array.isArray(spec)) return `${spec[0]}~${spec[1]} 사이여야`;
  const s = String(spec).trim(), m = /^(<=|>=|<|>|==|!=)?\s*(-?\d+(?:\.\d+)?)$/.exec(s);
  if (!m) return `${s} 사이여야`;
  return { '<': `${m[2]}보다 작아야`, '>': `${m[2]}보다 커야`, '<=': `${m[2]} 이하여야`, '>=': `${m[2]} 이상이어야`, '!=': `${josa(m[2], '이', '가')} 아니어야` }[m[1]] || josa(m[2], '이어야', '여야');
};
const ledSay = (l) => (!l.lit ? '꺼짐' : COLOR_KO[l.colorName] || l.colorName);
function colorOk(l, spec) {
  const s = String(spec).trim();
  if (/^off$/i.test(s)) return !l.lit;
  if (/^on$/i.test(s)) return l.lit;
  const want = s.startsWith('#') ? parseInt(s.slice(1), 16) : COLOR_OF[s.toLowerCase()];
  if (want === undefined) throw new Error('알 수 없는 색 ' + spec);
  if (want === 0) return !l.lit;
  return l.lit && l.color === want;
}
/** 지금(또는 그때) 상태 묶음: checkExpect가 읽음 */
const TILT_KO = { flat: '평평하게', left: '왼쪽으로 기울임', right: '오른쪽으로 기울임', forward: '앞(핀 쪽)으로 숙임', back: '뒤(몸 쪽)로 당김' };
function viewOf(sim) {
  const rl = sim.robot.last || null;
  return { drive: driveView(sim.robot), sounds: (sim.sounds || []).slice(), colorVersion: sim.colorVersion, radio: { group: sim.radio.group, sent: sim.radio.sent.slice() }, bt: { uart: sim.bt.uart, connected: sim.bt.connected }, music: sim.music, t: sim.time, motor: { speed: sim.robot.moving() ? (rl ? rl.raw : null) : 0, dir: sim.robot.moving() && rl ? rl.label : 'stop' }, screen: { frames: sim.matrix.frames.slice(), cells: sim.matrix.cells, end: sim.time }, leds: sim.leds.state(), shows: sim.leds.shows.slice(), rows: sim.oled.textRows(), oledLit: sim.oled.litCount(), moving: sim.robot.moving(), reads: Object.assign({}, sim.sensors.reads), vars: new Map(sim.globals.vars),
    servos: sim.servo ? sim.servo.view() : { pins: {}, log: [] }, calls: (sim.calls || []).slice(), userFns: sim.userFns || [], rec: sim.rec ? sim.rec.log.slice() : [] }; // 비트런
}
const lastNumber = (rows) => { const r = rows.filter(Boolean); const m = r.length ? r[r.length - 1].match(/-?\d+(?:\.\d+)?/g) : null; return m ? +m[m.length - 1] : null; };
/** timeline 표본 모음 판정: samples = [{ t, leds }] */
function timelineFails(e, samples) {
  const fails = [];
  const allSame = (ls) => ls.every((l) => l.lit === ls[0].lit && l.color === ls[0].color);
  const litS = samples.filter((s) => s.leds.some((l) => l.lit));
  if (e.color != null && (!litS.length || !litS.every((s) => s.leds.filter((l) => l.lit).every((l) => colorOk(l, e.color))))) fails.push(`켜질 때는 늘 ${mustBe(e.color)} 해요.`);
  const colorsOn = new Set(litS.filter((s) => allSame(s.leds)).map((s) => s.leds[0].color));
  if (e.distinctOn != null && colorsOn.size < e.distinctOn) fails.push(`LED가 서로 다른 색 ${e.distinctOn}가지로 켜져야 해요(지금 ${colorsOn.size}가지).`);
  const states = new Set(samples.map((s) => s.leds.map((l) => (l.lit ? `${l.color}/${l.brightness}` : 'off')).join(',')));
  if (e.distinct != null && states.size < e.distinct) fails.push(`LED가 서로 다른 모습 ${e.distinct}가지로 바뀌어야 해요(지금 ${states.size}가지).`);
  if (e.endsOff) { const fo = samples.findIndex((s, i) => i > 0 && s.leds.every((l) => !l.lit) && samples.slice(0, i).some((p) => p.leds.some((l) => l.lit))); if (fo < 0) fails.push('켜진 다음에 모두 꺼지는 때가 있어야 해요.'); }
  const br = samples.map((s) => (s.leds[0].lit ? s.leds[0].brightness : 0));
  // 밝아짐(up)·어두워짐(down): 표본 밝기가 2번 이상 잇달아 오르는(내리는) 구간. ['up','down']이면 오른 뒤에 내림
  const firstRun = (dir, from = 0) => { for (let i = Math.max(1, from); i < br.length; i++) if (dir > 0 ? br[i] > br[i - 1] : br[i] < br[i - 1]) { let j = i; while (j + 1 < br.length && (dir > 0 ? br[j + 1] >= br[j] : br[j + 1] <= br[j])) j++; if (j - i >= 1) return j; } return -1; };
  if (e.brightness != null) {
    const want = [].concat(e.brightness);
    if (want.every((w) => w === 'up' || w === 'down')) {
      let at = 0, ok = true;
      for (const w of want) { const j = firstRun(w === 'up' ? 1 : -1, at); if (j < 0) { ok = false; break; } at = j; }
      if (!ok) fails.push(`LED 밝기가 ${want.map((w) => (w === 'up' ? '점점 밝아' : '점점 어두워')).join('졌다가 ')}져야 해요.`);
    } else if (!litS.every((s) => s.leds.filter((l) => l.lit).every((l) => cmp(l.brightness, e.brightness)))) fails.push(`켜질 때 밝기가 ${mustNum(e.brightness)} 해요.`);
  }
  if (e.range) { const lo = Math.min(...br), hi = Math.max(...br), tol = Math.max(15, Math.round((e.range[1] - e.range[0]) * 0.08)); if (!(lo <= e.range[0] + tol && hi >= e.range[1] - tol)) fails.push(`LED 밝기가 ${e.range[0]} 근처부터 ${e.range[1]} 근처까지 바뀌어야 해요(지금 ${lo}~${hi}).`); }
  return fails;
}
/* ---------- 소리(7~8차시): expect.sound ---------- */
const DIR_OF = { '↑': 'Forward', '↓': 'Backward', '↶': 'Clockwise', '↷': 'CounterClockwise', '←': 'Left', '→': 'Right', 정지: 'stop', STOP: 'stop' };
const DIR_KO = { Forward: '앞(↑)', Backward: '뒤(↓)', Clockwise: '↶', CounterClockwise: '↷', Left: '옆으로 왼쪽(←)', Right: '옆으로 오른쪽(→)', stop: '멈춤' };
const roundSay = (x) => (typeof x === 'number' ? String(+x.toFixed(2)) : String(x));
const median = (a) => { if (!a.length) return null; const b = a.slice().sort((x, y) => x - y), m = b.length >> 1; return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2; };
const hzOf = (x) => (typeof x === 'string' && MUSIC_NOTE[x.replace(/^Note\./, '')] != null ? MUSIC_NOTE[x.replace(/^Note\./, '')] : x);
const numSpec = (sp) => (Array.isArray(sp) ? sp.map(hzOf) : hzOf(sp));
/** 울림 요약: 구간 [from, to) 안에서 시작한 울림 */
function soundSum(music, tEnd, from = 0, to = Infinity) {
  const all = music.beeps(tEnd), bs = all.filter((b) => b.t >= from && b.t < to);
  const gaps = bs.slice(1).map((b, i) => b.t - bs[i].t), lens = bs.filter((b) => !b.open).map((b) => b.ms);
  return { bs, n: bs.length, interval: median(gaps), length: median(lens), freqs: bs.map((b) => b.freq) };
}
function soundFails(e, v, ctx = {}, label = '') {
  const fails = [], from = e.from != null ? e.from : 0, to = e.to != null ? e.to : Infinity, S = soundSum(v.music, v.t, from, to), say = (x) => (x == null ? '없음' : `${Math.round(x)}ms`);
  const pre = label ? `${label} ` : '';
  if (e.quiet && S.n) fails.push(`${pre}소리가 나지 않아야 해요(지금 ${S.n}번 울림).`);
  if (e.rings && !S.n) fails.push(`${pre}소리가 울려야 해요(지금 안 울림).`);
  if (e.beeps != null && !cmp(S.n, e.beeps)) fails.push(`${pre}소리가 울린 횟수가 ${mustNum(e.beeps)} 해요(지금 ${S.n}번).`);
  if (e.on != null && v.music.soundingAt(v.t - 1e-6) !== !!e.on) fails.push(e.on ? `${pre}이때 소리가 울리고 있어야 해요.` : `${pre}이때 소리가 꺼져 있어야 해요.`);
  if (e.freq != null && !(S.n && S.freqs.every((f) => cmp(f, numSpec(e.freq))))) fails.push(`${pre}소리 높이가 ${mustNum(numSpec(e.freq))} 해요(지금: ${S.n ? [...new Set(S.freqs)].join(', ') + 'Hz' : '안 울림'}).`);
  if (e.notes) { const want = e.notes.map(hzOf); if (!want.every((f, i) => S.freqs[i] != null && cmp(S.freqs[i], f))) fails.push(`${pre}소리 높이가 ${want.join(' → ')}Hz 차례여야 해요(지금: ${S.freqs.slice(0, 8).join(' → ') || '안 울림'}).`); }
  if (e.interval != null) { if (S.n < 2) fails.push(`${pre}소리가 2번 이상 울려야 간격을 볼 수 있어요(지금 ${S.n}번).`); else if (!cmp(S.interval, e.interval)) fails.push(`${pre}울리는 간격이 ${mustNum(e.interval)} 해요(지금 ${say(S.interval)}).`); }
  if (e.length != null) { if (S.length == null) fails.push(`${pre}끝까지 울린 소리가 없어요.`); else if (!cmp(S.length, e.length)) fails.push(`${pre}한 번 울리는 길이가 ${mustNum(e.length)} 해요(지금 ${say(S.length)}).`); }
  if (e.melody != null && !S.bs.some((b) => b.src === 'melody:' + e.melody)) fails.push(`${pre}${MELODY_KO[e.melody] || e.melody} 소리가 나야 해요.`);
  if (e.phases || e.trend) {
    const cuts = [0, ...(ctx.cuts || []).filter((t) => t > 0 && t < v.t), v.t];
    const ph = cuts.slice(1).map((t, i) => ({ from: cuts[i], to: t }));
    (e.phases || []).forEach((p, i) => { const w = ph[i]; if (!w) { fails.push(`구간 ${i + 1}이 없어요(run.set으로 나눠요).`); return; } fails.push(...soundFails(Object.assign({}, p, { from: w.from, to: w.to, phases: null, trend: null }), v, ctx, `${(w.from / 1000).toFixed(1)}~${(w.to / 1000).toFixed(1)}초:`)); });
    if (e.trend) {
      const iv = ph.map((w) => soundSum(v.music, v.t, w.from, w.to).interval);
      const ok = iv.length >= 2 && iv.every((x) => x != null) && iv.slice(1).every((x, i) => (e.trend === 'faster' ? x < iv[i] : x > iv[i]));
      if (!ok) fails.push(`${e.trend === 'faster' ? '가까워질수록 소리 간격이 짧아져야' : '멀어질수록 소리 간격이 길어져야'} 해요(지금 간격: ${iv.map(say).join(' → ')}).`);
    }
  }
  return fails;
}
function checkExpect(v, exp, ctx = {}) {
  const fails = [];
  if (!exp) return fails;
  const leds = v.leds;
  if (exp.leds) {
    const e = exp.leds;
    if (e.all != null && !leds.every((l) => colorOk(l, e.all))) fails.push(`LED 4개가 모두 ${mustBe(e.all)} 해요(지금: ${leds.map(ledSay).join(', ')}).`);
    if (e.color != null && !(leds.some((l) => l.lit) && leds.filter((l) => l.lit).every((l) => colorOk(l, e.color)))) fails.push(`켜진 LED가 ${mustBe(e.color)} 해요(지금: ${leds.map(ledSay).join(', ')}).`);
    const list = e.pixels || e.list;
    const each = Object.assign({}, list ? Object.fromEntries(list.map((c, i) => [`L${i + 1}`, c])) : {}, Object.fromEntries(Object.entries(e).filter(([k]) => /^(L[1-4]|[0-3])$/.test(k)).map(([k, x]) => [/^\d$/.test(k) ? `L${+k + 1}` : k, x])));
    for (const [k, c] of Object.entries(each)) { const l = leds[+k.slice(1) - 1]; if (c != null && !colorOk(l, c)) fails.push(`${k} LED가 ${mustBe(c)} 해요(지금: ${ledSay(l)}).`); }
    if (e.rgb != null) { const want = packRGB(...e.rgb.map(Number)), hit = leds.filter((l) => l.lit); if (!hit.length || !hit.every((l) => l.color === want)) fails.push(`LED가 R ${e.rgb[0]}·G ${e.rgb[1]}·B ${e.rgb[2]} 색으로 켜져야 해요(지금: ${hit.length ? [...new Set(hit.map((l) => l.colorName))].join(', ') : '꺼짐'}).`); } // 9~10차시: neopixel.rgb(변수…)
    if (e.distinct != null) { const n = new Set(leds.filter((l) => l.lit).map((l) => l.color)).size; if (n < e.distinct) fails.push(`켜진 LED 색이 ${e.distinct}가지 이상이어야 해요(지금 ${n}가지).`); }
    if (e.brightness != null) { const lit = leds.filter((l) => l.lit); if (!lit.length || !lit.every((l) => cmp(l.brightness, e.brightness))) fails.push(`LED 밝기가 ${mustNum(e.brightness)} 해요(지금: ${lit.length ? [...new Set(lit.map((l) => l.brightness))].join(', ') : '꺼짐'}).`); }
    if (e.lit != null && !cmp(leds.filter((l) => l.lit).length, e.lit)) fails.push(`켜진 LED 수가 ${mustNum(e.lit)} 해요(지금: ${leds.filter((l) => l.lit).length}개).`);
    const shows = v.shows;
    if (e.seen) {
      // 차례로: 모든 LED가 같은 색인 순간들 중에서 원하는 색이 순서대로 나와야 함
      let p = 0;
      for (const s of shows) { const st = s.leds.map((x) => ({ color: x.color, lit: x.out.some((y) => y > 0) })); if (p < e.seen.length && st.every((l) => colorOk(l, e.seen[p]))) p++; }
      if (p < e.seen.length) fails.push(`LED 색이 ${e.seen.map(colorSay).join(' → ')} 차례로 바뀌어야 해요.`);
    }
    if (e.brightnessSeen) {
      let p = 0;
      for (const s of shows) { const l = s.leds[0]; if (p < e.brightnessSeen.length && l.out.some((y) => y > 0) === (e.brightnessSeen[p] !== 0) && cmp(l.brightness, e.brightnessSeen[p])) p++; }
      if (p < e.brightnessSeen.length) fails.push(`LED 밝기가 ${e.brightnessSeen.join(' → ')} 차례로 바뀌어야 해요.`);
    }
    for (const dir of ['rises', 'falls']) {
      if (!e[dir]) continue;
      const need = e[dir] === true ? 10 : +e[dir]; let run = 0, best = 0, prev = null;
      for (const s of shows) { const b = s.leds[0].brightness; if (prev != null && (dir === 'rises' ? b > prev : b < prev)) run++; else if (prev == null || b !== prev) run = 0; best = Math.max(best, run); prev = b; }
      if (best < need) fails.push(dir === 'rises' ? 'LED 밝기가 점점 밝아져야 해요.' : 'LED 밝기가 점점 어두워져야 해요.');
    }
    if (e.seq) {
      const loops = ctx.loopViews || [];
      if (!loops.length) fails.push('seq는 run.loops(무한반복 바퀴 수)와 함께 써요.');
      e.seq.forEach((c, i) => { const lv = loops[i]; if (lv && !lv.leds.every((l) => colorOk(l, c))) fails.push(`무한반복 ${i + 1}번째에 LED가 ${mustBe(c)} 해요(지금: ${lv.leds.map(ledSay).join(', ')}).`); else if (!lv && loops.length) fails.push(`무한반복이 ${i + 1}번 돌지 않았어요.`); });
    }
    if (e.timeline) fails.push(...timelineFails(e.timeline, ctx.samples || []));
  }
  if (exp.screen) { try { fails.push(...screenFails(exp.screen, v.screen)); } catch (er) { fails.push('LED 화면 시나리오를 읽지 못했어요(' + er.message + ').'); } }
  if (exp.oled) {
    const e = exp.oled, rows = v.rows, all = rows.join('\n'), now = rows.filter(Boolean).slice(-3).join(' / ') || '빈 화면';
    if (e.lastNumber != null) { const n = lastNumber(rows); if (!cmp(n, e.lastNumber)) fails.push(`OLED 화면 마지막 숫자가 ${mustNum(e.lastNumber)} 해요(지금: ${n == null ? '숫자 없음' : n}).`); }
    [].concat(e.has || [], e.text != null ? e.text : []).forEach((t) => { if (!all.includes(String(t))) /* text = has(9~10차시 이름) */ fails.push(`OLED 화면에 ${josa(String(t), '이', '가')} 보여야 해요(지금: ${now}).`); });
    Object.entries(e.rows || {}).forEach(([r, t]) => { if (!(rows[+r] || '').includes(String(t))) fails.push(`OLED ${r}행에 ${josa(String(t), '이', '가')} 보여야 해요.`); });
    if (e.lit != null && !cmp(v.oledLit, e.lit)) fails.push('OLED 화면에 켜진 점의 수가 목표와 달라요.');
    if (e.empty != null && (v.oledLit === 0) !== !!e.empty) fails.push(e.empty ? 'OLED 화면이 비어 있어야 해요.' : 'OLED 화면에 아무것도 안 나와요.');
  }
  if (exp.motors && exp.motors.moving != null && v.moving !== !!exp.motors.moving) fails.push(exp.motors.moving ? '바퀴가 돌아야 해요.' : '바퀴가 멈춰 있어야 해요.');
  // 모터: speed·dir('↑'·'Forward'·'stop' 등 블록 이름)은 7~8 규칙(마지막 이동 블록의 속도 그대로), dir 'forward'·'backward'·'left'·'right'와 min·turned는 9~10(drive.js)
  const MY_DIR = /^(forward|backward|left|right)$/;
  if (exp.motors && exp.motors.speed != null && !cmp(v.motor.speed, exp.motors.speed)) fails.push(`이동 속도가 ${mustNum(exp.motors.speed)} 해요(지금: ${v.moving ? roundSay(v.motor.speed) : '멈춤'}).`);
  if (exp.motors && exp.motors.dir != null && !MY_DIR.test(exp.motors.dir)) { const want = DIR_OF[exp.motors.dir] || exp.motors.dir, got = v.moving ? String(v.motor.dir).replace(/^(normal|mecanum)\./, '') : 'stop'; if (want !== got) fails.push(want === 'stop' ? '바퀴가 멈춰 있어야 해요.' : `포니봇이 ${DIR_KO[want] || want} 방향으로 움직여야 해요(지금: ${DIR_KO[got] || got}).`); }
  if (exp.motors && v.drive && (MY_DIR.test(exp.motors.dir || '') || exp.motors.min != null || exp.motors.turned != null)) fails.push(...driveFails({ dir: MY_DIR.test(exp.motors.dir || '') ? exp.motors.dir : null, min: exp.motors.min, turned: exp.motors.turned }, v.drive, cmp, mustNum)); // 9~10차시
  if (exp.sound) {
    fails.push(...soundFails(exp.sound, v, ctx));
    // 9~10차시: { played: true|false, effect?: 'twinkle' } — 소리 효과(sim.sounds) 또는 7~8 소리 기록(music)에 울림이 있나
    const e = exp.sound, ps = (v.sounds || []).filter((x) => e.effect == null || x.name === e.effect), any = ps.length > 0 || (e.effect == null && v.music && soundSum(v.music, v.t).n > 0);
    if (e.played === true && !any) fails.push(e.effect ? `소리 효과(${e.effect})가 나와야 해요.` : '소리가 나와야 해요.');
    if (e.played === false && any) fails.push('이때는 소리가 나지 않아야 해요.');
  }
  if (exp.colorVersion != null && v.colorVersion !== exp.colorVersion) fails.push('맨 처음에 컬러센서 초기화 블록으로 내 센서 버전을 골라야 해요.');
  [].concat(exp.reads || []).forEach((n0) => { const n = sensorName(n0); if (!v.reads[n]) fails.push(`${josa((SENSORS[n] && SENSORS[n].label) || n, '을', '를')} 읽는 블록이 실행되지 않았어요.`); });
  if (exp.radio) { // 11~12차시: 라디오 보내기
    const r = exp.radio, all = (v.radio || { sent: [] }).sent.filter((x) => r.from == null || x.t >= r.from), vals = all.map((x) => x.value), say = (a) => [...new Set(a)].join(', ');
    if (r.group != null && v.radio.group !== r.group) fails.push(v.radio.group == null ? '라디오 그룹을 정하는 블록이 실행되지 않았어요.' : `라디오 그룹이 ${r.group}이어야 해요(지금: ${v.radio.group}).`);
    if (r.any === true && !vals.length) fails.push('라디오로 아무것도 보내지 않았어요.');
    if (r.any === false && vals.length) fails.push(`아직 보내면 안 되는데 라디오로 ${say(vals)}을(를) 보냈어요.`);
    [].concat(r.sent || []).forEach((x) => { if (!vals.some((y) => y === x)) fails.push(`라디오로 ${x}을(를) 보내야 해요(보낸 것: ${say(vals) || '없음'}).`); });
    [].concat(r.notSent || []).forEach((x) => { if (vals.some((y) => y === x)) fails.push(`이때는 ${x}을(를) 보내면 안 돼요.`); });
    if (r.only) { const bad = vals.filter((y) => !r.only.includes(y)); if (bad.length) fails.push(`${say(r.only)} 말고 ${say(bad)}도 보냈어요.`); }
  }
  if (exp.bt) {
    if (exp.bt.uart && !(v.bt || {}).uart) fails.push('"블루투스 UART 서비스 시작" 블록이 실행되지 않았어요.');
    if (exp.bt.connected != null && !!(v.bt || {}).connected !== !!exp.bt.connected) fails.push(exp.bt.connected ? '블루투스가 연결된 상태여야 해요.' : '블루투스 연결이 끊긴 상태여야 해요.');
  }
  Object.entries(exp.vars || {}).forEach(([n, want]) => { const x = v.vars.get(n); if (!cmp(x, want)) fails.push(`변수 ${n} 값이 ${mustNum(want)} 해요(지금: ${x === undefined ? '없음' : x}).`); });
  if (exp.servos) fails.push(...servoFails(exp.servos, v)); // 비트런
  if (exp.calls) fails.push(...callFails(exp.calls, v));
  if (exp.record) fails.push(...recFails(exp.record, v));
  return fails;
}
/* ---------- 비트런(2026-11-01): 서보·사용자 함수 호출·녹음 시나리오 칸 (규격 references/lesson-schema.md 8-2) ----------
 * servos = { <핀 'P2'> | <이름 + pins:['P0','P1']> | all: spec }
 *   묶음(pins)은 그 핀들 가운데 '회전' 명령을 받은 핀(없으면 아무 명령이나 받은 핀)만 본다 → 왼쪽 다리 P0·P1 어느 쪽이든. all = 명령을 받은 모든 핀
 *   spec: sign '+'|'-'|'0'(끝 속도 부호) · speed(끝 속도 수 규칙) · stopped(끝에 멈춤) · ran '+'|'-'|true(구간 안에 그 부호로 돈 적이 있음) · moved(구간 안에 돈 적이 있음)
 *         runSpeed(구간 안 회전 명령의 |속도| 모두 수 규칙) · inFn true|'이름'(구간 안 회전 명령이 모두 사용자 함수 안에서) · runMs(구간 안 돈 시간 ms 수 규칙) · from·to(구간 ms) · label(학생 글 이름)
 * calls = { '<함수 이름>' | '*': { defined, called, calledFrom, seq, repeat } } — '*'는 사용자 함수 무엇이든(이름은 모둠마다 다를 때)
 *   defined: true|false|수 규칙('*'이면 정의 개수) · called: true|false|수 규칙(부른 횟수, calledFrom이 있으면 그 이벤트에서) · calledFrom: 'A'|['A','B']|'logo'…
 *   seq: ['앞으로','왼쪽돌기',…] 또는 [[…],[…]](어느 하나) — calledFrom 이벤트가 바로 부른 함수 차례(함수 안에서 부른 것은 빼고), repeat: n번 이어서
 * record = { started, played: true|false, playAt: 수 규칙(첫 재생 시각 ms) } */
const SERVO_SAY = (x) => (!x ? '멈춤' : x > 0 ? `+${roundSay(x)}` : roundSay(x));
const evSay = (e) => EVENT_NAME[evName(e)] || e;
function servoFails(E, v) {
  const sv = v.servos || { pins: {}, log: [] }, out = [], log = sv.log || [], now = v.t;
  const turning = (x) => x.fn !== 'stop' && x.speed !== 0;
  for (const [key, spec0] of Object.entries(E)) {
    const spec = spec0 && typeof spec0 === 'object' ? spec0 : { sign: spec0 };
    const group = key === 'all' ? null : spec.pins ? [].concat(spec.pins).flatMap((p) => String(p).split('|')) : [key];
    const inG = (p) => !group || group.includes(p);
    const ranPins = [...new Set(log.filter((x) => inG(x.pin) && (x.fn === 'run' || x.fn === 'angle')).map((x) => x.pin))];
    const pins = ranPins.length ? ranPins : [...new Set(log.filter((x) => inG(x.pin)).map((x) => x.pin))];
    const nm0 = spec.label || (key === 'all' ? '서보' : group.length > 1 ? `${group.join('·')} 서보` : `${key} 서보`);
    if (!pins.length) { out.push(`${josa(nm0, '이', '가')} 실행되지 않았어요. ${key === 'all' ? '서보 블록' : group.join(' 또는 ') + ' 서보 블록'}이 있는지 봐요.`); continue; }
    for (const p of pins) {
      const nm = spec.label && group && group.length > 1 ? `${spec.label}(${p})` : key === 'all' ? `${p} 서보` : nm0;
      const now0 = sv.pins[p] ? sv.pins[p].speed : 0, from = spec.from || 0, to = spec.to != null ? spec.to : Infinity;
      const runs = log.filter((x) => x.pin === p && x.t >= from && x.t <= to && turning(x));
      const sg = (want, x) => (want === '+' ? x > 0 : want === '-' ? x < 0 : want === '0' || want === 'stop' ? x === 0 : true);
      if (spec.sign != null && !sg(String(spec.sign), now0)) out.push(String(spec.sign) === '0' ? `${josa(nm, '이', '가')} 멈춰 있어야 해요(지금: ${SERVO_SAY(now0)}).` : `${josa(nm, '이', '가')} ${spec.sign} 속도로 돌고 있어야 해요(지금: ${SERVO_SAY(now0)}).`);
      if (spec.speed != null && !cmp(now0, spec.speed)) out.push(`${nm} 속도가 ${mustNum(spec.speed)} 해요(지금: ${SERVO_SAY(now0)}).`);
      if (spec.stopped != null && (now0 === 0) !== !!spec.stopped) out.push(spec.stopped ? `${josa(nm, '이', '가')} 멈춰 있어야 해요(지금: ${SERVO_SAY(now0)}).` : `${josa(nm, '이', '가')} 돌고 있어야 해요(지금: 멈춤).`);
      if (spec.ran != null && !runs.some((x) => sg(spec.ran === true ? '' : String(spec.ran), x.speed))) out.push(spec.ran === true ? `${josa(nm, '이', '가')} 한 번도 돌지 않았어요.` : `${josa(nm, '이', '가')} ${spec.ran} 속도로 돌아야 해요(지금: ${runs.length ? [...new Set(runs.map((x) => SERVO_SAY(x.speed)))].join(', ') : '돌지 않음'}).`);
      if (spec.moved != null && !!runs.length !== !!spec.moved) out.push(spec.moved ? `${josa(nm, '이', '가')} 한 번도 돌지 않았어요.` : `이때는 ${josa(nm, '이', '가')} 돌면 안 돼요(지금: ${[...new Set(runs.map((x) => SERVO_SAY(x.speed)))].join(', ')}).`);
      if (spec.runSpeed != null) { const bad = runs.filter((x) => !cmp(Math.abs(x.speed), spec.runSpeed)); if (!runs.length || bad.length) out.push(`${nm} 빠르기(+·− 떼고)가 ${mustNum(spec.runSpeed)} 해요(지금: ${runs.length ? [...new Set(runs.map((x) => Math.abs(x.speed)))].join(', ') : '돌지 않음'}).`); }
      if (spec.inFn != null && spec.inFn !== false) { const bad = runs.filter((x) => (spec.inFn === true ? !x.by : fnTokName(x.by || '') !== fnTokName(spec.inFn))); if (!runs.length || bad.length) out.push(spec.inFn === true ? `${nm} 회전 블록을 버튼에 바로 두지 말고 함수 안에 넣어 불러요.` : `${nm} 회전 블록은 함수 ${spec.inFn} 안에 있어야 해요.`); }
      if (spec.runMs != null) {
        const all = log.filter((x) => x.pin === p); let ms = 0;
        for (let i = 0; i < all.length; i++) { if (!turning(all[i])) continue; const a = Math.max(all[i].t, from), b = Math.min(i + 1 < all.length ? all[i + 1].t : now, to, now); if (b > a) ms += b - a; }
        if (!cmp(Math.round(ms), spec.runMs)) out.push(`${josa(nm, '이', '가')} 돈 시간이 ${mustNum(spec.runMs)} 해요(지금 약 ${Math.round(ms)}ms).`);
      }
    }
  }
  return out;
}
function callFails(E, v) {
  const calls = v.calls || [], defs = (v.userFns || []).map(fnTokName), out = [];
  for (const [key, spec0] of Object.entries(E)) {
    const spec = spec0 && typeof spec0 === 'object' ? spec0 : { called: spec0 };
    const any = key === '*', nm = any ? '' : fnTokName(key), say = any ? '함수' : `함수 ${key}`;
    const evs = spec.calledFrom != null ? [].concat(spec.calledFrom).map(evName) : null;
    const mine = calls.filter((c) => (any || fnTokName(c.name) === nm) && (!evs || evs.includes(c.from)));
    if (spec.defined != null) {
      const ok = any ? definedOk(defs, spec.defined) : defs.includes(nm) === !!spec.defined;
      if (!ok) out.push(any ? (isNumRule(spec.defined) ? `만든 함수 수가 ${mustNum(spec.defined)} 해요(지금 ${defs.length}개).` : spec.defined ? '함수를 먼저 만들어요(고급 › 함수 › 함수 만들기).' : '이 미션에서는 함수를 만들지 않아요.') : spec.defined ? `${josa(say, '을', '를')} 먼저 만들어요.` : `${josa(say, '은', '는')} 없어야 해요.`);
    }
    if (evs && spec.called == null && !spec.seq && !mine.length) out.push(`${evs.map(evSay).join(' 또는 ')} 안에서 ${josa(say, '을', '를')} 불러야 해요(지금: 부른 함수 없음).`);
    if (spec.called != null) {
      const n = mine.length, ok = spec.called === true ? n > 0 : spec.called === false ? n === 0 : cmp(n, spec.called);
      if (!ok) out.push(spec.called === false ? `이때는 ${josa(say, '을', '를')} 부르면 안 돼요.` : spec.called === true ? `${evs ? evs.map(evSay).join(' 또는 ') + ' 안에서 ' : ''}${josa(say, '을', '를')} 불러야 해요(지금: 부른 함수 없음).` : `${evs ? evs.map(evSay).join(' 또는 ') + ' 안에서 ' : ''}${josa(say, '을', '를')} 부른 횟수가 ${mustNum(spec.called)} 해요(지금 ${n}번).`);
    }
    if (spec.seq) {
      const got = mine.filter((c) => !c.by).map((c) => fnTokName(c.name)), alts = Array.isArray(spec.seq[0]) ? spec.seq : [spec.seq], rep = Math.max(1, spec.repeat | 0 || 1);
      const ok = alts.some((a) => { const want = Array.from({ length: rep }, () => a).flat().map(fnTokName); return want.length === got.length && want.every((x, i) => x === got[i]); });
      if (!ok) out.push(`${evs ? evs.map(evSay).join(' 또는 ') + ' 안에서 ' : ''}함수를 ${alts[0].join(' → ')}${rep > 1 ? ` 차례로 ${rep}번` : ' 차례로'} 불러야 해요(지금: ${got.length ? got.slice(0, 16).join(' → ') + (got.length > 16 ? ' …' : '') : '부른 함수 없음'}).`);
    }
  }
  return out;
}
function recFails(E, v) {
  const log = v.rec || [], out = [], st = log.filter((x) => x.fn === 'start'), pl = log.filter((x) => x.fn === 'play');
  if (E.started != null && !!st.length !== !!E.started) out.push(E.started ? '녹음 시작 블록이 실행되어야 해요.' : '이때는 녹음을 시작하면 안 돼요.');
  if (E.played != null && !!pl.length !== !!E.played) out.push(E.played ? '녹음 재생 블록이 실행되어야 해요.' : '이때는 녹음을 재생하면 안 돼요.');
  if (E.playAt != null && !(pl.length && cmp(pl[0].t, E.playAt))) out.push(pl.length ? `녹음 재생이 너무 일러요. 다른 블록이 끝난 뒤에 재생해요(지금 ${Math.round(pl[0].t)}ms에 재생).` : '녹음 재생 블록이 실행되어야 해요.');
  return out;
}
/* ---------- LED 화면 5×5(basic 서랍, 1차시) 시나리오: expect.screen ----------
 * 화면 그림 = 프레임을 모양이 같으면 하나로 묶은 것(빈 화면 포함), 각 그림이 머문 시간 = 다음 그림까지(마지막은 끝 시각까지).
 * screen = { seq:[그림…](처음부터 이 차례로 — 빈 화면은 seq에 'clear'가 없으면 건너뜀), repeat:n(seq가 n번 이어서), from:'any'(seq가 어디서든),
 *            hold:수 규칙(seq 그림마다 머문 ms, 예 '>=400') · minPause:ms(= hold '>=ms'), has:그림|[그림…], distinct:n(빈 화면 뺀 서로 다른 그림 수),
 *            end:그림(끝 화면), lit:수 규칙(끝에 켜진 점 수), empty:true|false(끝에 빈 화면) }
 * 그림 = 'Happy'(아이콘 이름) | 'clear' | { icon } | { leds:'# . # . # …'(25칸) } | { arrow:'North' } | { number:3 } | { text:'Hi' } + { hold:수 규칙 }(그 그림만) */
const MXG = require('./matrix');
const picSig = (fr) => (fr.cells != null ? fr.cells : 'text:' + fr.text);
function screenPics(scr) {
  const out = [];
  for (const fr of (scr && scr.frames) || []) {
    const s = picSig(fr), last = out[out.length - 1];
    if (last && last.sig === s) continue;
    if (last) last.dur = fr.t - last.t;
    out.push({ sig: s, t: fr.t, cells: fr.cells, text: fr.text });
  }
  if (out.length) out[out.length - 1].dur = Math.max(0, ((scr && scr.end) || 0) - out[out.length - 1].t);
  return out;
}
const blankPic = (p) => p.cells === MXG.BLANK;
function picSpec(sp) {
  const o = typeof sp === 'string' ? (/^(clear|blank|empty)$/i.test(sp) ? { clear: true } : { icon: sp }) : Object.assign({}, sp || {});
  if (o.icon != null && !MXG.ICONS[String(o.icon).replace(/^IconNames\./, '')]) throw new Error('알 수 없는 아이콘 ' + o.icon);
  if (o.arrow != null && !MXG.arrowName(o.arrow)) throw new Error('알 수 없는 화살표 ' + o.arrow);
  if (o.leds != null && !MXG.parseLeds(o.leds)) throw new Error('leds는 # . 25칸이어야 해요');
  return o;
}
const picOk = (p, sp) => {
  const o = picSpec(sp);
  if (o.clear) return blankPic(p);
  if (o.icon != null) return p.cells === MXG.ICONS[String(o.icon).replace(/^IconNames\./, '')];
  if (o.arrow != null) return p.cells === MXG.ARROWS[MXG.arrowName(o.arrow)];
  if (o.leds != null) return p.cells === MXG.parseLeds(o.leds);
  if (o.number != null) return p.text === MXG.numText(+o.number);
  if (o.text != null) return p.text === String(o.text);
  return !blankPic(p);
};
const picSay = (p) => { if (blankPic(p)) return '빈 화면'; if (p.cells == null) return `"${p.text}"`; const ic = MXG.iconOf(p.cells); if (ic) return MXG.ICON_KO[ic] || ic; const ar = Object.keys(MXG.ARROWS).find((k) => MXG.ARROWS[k] === p.cells); return ar ? `${MXG.ARROW_KO[ar] || ar} 화살표` : 'LED 그림'; };
const specSay = (sp) => { const o = picSpec(sp); if (o.clear) return '빈 화면'; if (o.icon != null) { const k = String(o.icon).replace(/^IconNames\./, ''); return MXG.ICON_KO[k] || k; } if (o.arrow != null) { const k = MXG.arrowName(o.arrow); return `${MXG.ARROW_KO[k] || k} 화살표`; } if (o.number != null) return `숫자 ${o.number}`; if (o.text != null) return `"${o.text}"`; return 'LED 그림'; };
function screenFails(e, scr) {
  const fails = [], all = screenPics(scr);
  const seqHasClear = (e.seq || []).some((s) => picSpec(s).clear);
  const pics = seqHasClear ? all : all.filter((p) => !blankPic(p));
  const now = pics.length ? pics.slice(0, 8).map(picSay).join(' → ') + (pics.length > 8 ? ' …' : '') : '아무것도 안 나옴';
  if (e.seq) {
    const seq = e.seq, n = seq.length, rep = Math.max(1, e.repeat | 0 || 1), want = [];
    for (let r = 0; r < rep; r++) want.push(...seq);
    const starts = e.from === 'any' ? pics.map((_, i) => i) : [0];
    const hit = starts.find((s) => want.every((sp, j) => pics[s + j] && picOk(pics[s + j], sp)));
    if (hit == null) fails.push(`LED 화면이 ${seq.map(specSay).join(' → ')}${rep > 1 ? ` 차례를 ${rep}번 되풀이해야` : ' 차례로 바뀌어야'} 해요(지금: ${now}).`);
    else {
      const holdOf = (sp) => (sp && typeof sp === 'object' && sp.hold != null ? sp.hold : e.hold != null ? e.hold : e.minPause != null ? `>=${e.minPause}` : null);
      // 마지막 그림이 끝 시각에 잘렸으면(시나리오가 끝나서) 머문 시간을 따지지 않는다
      const bad = want.map((sp, j) => [sp, pics[hit + j], holdOf(sp)]).filter(([, p, h], j) => h != null && !(j === want.length - 1 && hit + j === pics.length - 1) && !cmp(p.dur, h));
      if (bad.length) { const [sp, p, h] = bad[0]; fails.push(`${josa(specSay(sp), "이", "가")} 화면에 머무는 시간이 ${mustNum(h)} 해요(지금: ${Math.round(p.dur)}ms). 일시중지 블록의 시간을 확인해 봐요.`); }
    }
  }
  [].concat(e.has || []).forEach((sp) => { if (!all.some((p) => picOk(p, sp))) fails.push(`LED 화면에 ${josa(specSay(sp), "이", "가")} 나와야 해요(지금: ${now}).`); });
  if (e.distinct != null) { const d = new Set(all.filter((p) => !blankPic(p)).map((p) => p.sig)).size; if (d < e.distinct) fails.push(`LED 화면에 서로 다른 그림이 ${e.distinct}가지 이상 나와야 해요(지금 ${d}가지).`); }
  const last = all[all.length - 1] || { cells: MXG.BLANK, text: undefined };
  if (e.end != null && !picOk(last, e.end)) fails.push(`끝에 LED 화면이 ${josa(specSay(e.end), "이어야", "여야")} 해요(지금: ${picSay(last)}).`);
  if (e.empty != null && blankPic(last) !== !!e.empty) fails.push(e.empty ? '끝에 LED 화면이 꺼져 있어야 해요.' : 'LED 화면에 아무것도 안 나와요.');
  if (e.lit != null) { const n = last.cells == null ? null : [...last.cells].filter((c) => c === '1').length; if (n == null || !cmp(n, e.lit)) fails.push(`LED 화면에 켜진 점이 ${mustNum(e.lit)} 해요(지금: ${n == null ? '글자' : n + '개'}).`); }
  return fails;
}
/** given 풀기: '$rec.key'·배열·{ rec, fallback } → { sensors(처음 값), perLoop: { 이름: [값…] } }. 기록이 없으면 fallback */
function resolveGiven(given = {}, records = {}) {
  const fb = given.fallback, sensors = {}, perLoop = {}, used = [], fellBack = [];
  const one = (x, f) => {
    if (typeof x === 'number') return x;
    if (x && typeof x === 'object' && !Array.isArray(x) && x.rec != null) return one(`$rec.${x.rec}`, x.fallback != null ? x.fallback : f);
    const m = /^\$rec\.([\w가-힣.-]+)$/.exec(String(x));
    if (m) { const v = records[m[1]]; if (v !== '' && v != null && isFinite(+v)) { used.push(m[1]); return +v; } if (f == null) throw new Error(`측정 기록 ${m[1]}이(가) 없고 fallback도 없어요`); fellBack.push([m[1], f]); return f; }
    return x; // 숫자가 아니면 Sensors.set이 알림
  };
  for (const [n, x] of Object.entries(given)) {
    if (n === 'fallback') continue;
    if (Array.isArray(x)) { const vals = x.map((y, i) => one(y, Array.isArray(fb) ? fb[i] : fb)); perLoop[n] = vals; sensors[n] = vals[0]; }
    else sensors[n] = one(x, Array.isArray(fb) ? fb[0] : fb);
  }
  return { sensors, perLoop, used, fellBack };
}
/** 9~10차시: expect 안의 '$rec.키'(같은 묶음의 fallback) 또는 { rec, fallback }를 수로 바꾼다(motors.speed·leds.rgb 등). fellBack에 예시값 기록 */
// scFb = 시나리오 바로 아래 fallback: 수(모든 $rec에) 또는 { 기록 키: 수 }(배열은 키를 알 수 없어 쓰지 않음)
function resolveExpect(exp, records = {}, fellBack = [], used = [], scFb = null) {
  if (!exp || typeof exp !== 'object') return exp;
  const one = (x, fb) => {
    if (x && typeof x === 'object' && !Array.isArray(x) && x.rec != null) return one('$rec.' + x.rec, x.fallback != null ? x.fallback : fb);
    const m = /^\$rec\.([\w가-힣.-]+)$/.exec(typeof x === 'string' ? x : '');
    if (!m) return x;
    const v = records[m[1]];
    if (v !== '' && v != null && isFinite(+v)) { used.push(m[1]); return +v; }
    if (fb == null && scFb != null && !Array.isArray(scFb)) fb = typeof scFb === 'object' ? scFb[m[1]] : scFb;
    if (fb == null) throw new Error(`측정 기록 ${m[1]}이(가) 없고 fallback도 없어요(expect 안 $rec는 같은 묶음 fallback 또는 시나리오 fallback: { ${m[1]}: 수 })`);
    fellBack.push([m[1], fb]); return fb;
  };
  const walk = (o) => {
    if (Array.isArray(o)) return o.map((x, i) => (typeof x === 'string' || (x && x.rec != null) ? one(x, Array.isArray(o.fallback) ? o.fallback[i] : undefined) : walk(x)));
    if (!o || typeof o !== 'object' || o.rec != null) return o;
    const out = {}, fb = o.fallback;
    for (const [k, x] of Object.entries(o)) {
      if (k === 'fallback') continue;
      if (Array.isArray(x) && x.some((y) => typeof y === 'string' && y.startsWith('$rec.'))) out[k] = x.map((y, i) => one(y, Array.isArray(fb) ? fb[i] : fb && typeof fb === 'object' ? fb[k] : fb));
      else if (typeof x === 'string' && x.startsWith('$rec.') || (x && typeof x === 'object' && x.rec != null)) out[k] = one(x, fb && typeof fb === 'object' && !Array.isArray(fb) ? fb[k] : fb);
      else out[k] = x && typeof x === 'object' ? walk(x) : x;
    }
    return out;
  };
  return walk(exp);
}
const PRESS_EVENTS = ['A', 'B', 'AB'];
/** 시나리오 하나 실행. cache를 주면 같은 코드·시나리오·기록을 다시 돌리지 않는다. opts.records = 학생 측정 기록({ key: 값 }) */
function runScenario(ts, sc, i = 0, cache, opts = {}) {
  const records = opts.records || {};
  const key = cache ? JSON.stringify([ts, sc, records]) : null;
  if (cache && cache.has(key)) return cache.get(key);
  const name = sc.name || `#${i + 1}`, out = { name, label: sc.label || name, ok: false, fails: [], msg: sc.msg || '' };
  const done = (r) => { if (cache) cache.set(key, r); return r; };
  let sim, G;
  // fallback은 given 안({ lightLevel: …, fallback: [150, 10, 150] }) 또는 시나리오 바로 아래(sc.fallback) 둘 다 된다(설계 4.0 꼴)
  const given = sc.fallback != null && (!sc.given || sc.given.fallback == null) ? Object.assign({}, sc.given || {}, { fallback: sc.fallback }) : sc.given || {};
  const gx = Object.assign({}, given), run0 = sc.run || {}; // ★7~8: random·seed·buttons는 센서가 아니라 sim 설정
  const simOpt = { lenient: true, random: gx.random != null ? gx.random : run0.random, seed: gx.seed != null ? gx.seed : run0.seed != null ? run0.seed : 1, held: gx.buttons || run0.buttons };
  const tilt = gx.tilt; // 11~12차시: 기울기는 센서 표가 아니라 sim 자세
  delete gx.random; delete gx.seed; delete gx.buttons; delete gx.tilt;
  try { G = resolveGiven(gx, records); sim = new Sim(ts, Object.assign({ sensors: G.sensors }, simOpt)); } catch (e) { out.fails.push(/센서|기록/.test(e.message) ? e.message : '코드를 읽지 못했어요. 블록이 모두 끼워져 있는지 확인해 봐요.'); out.error = e.message; return done(out); }
  const run = sc.run || {};
  const loops = run.loops != null ? Math.max(1, run.loops | 0) : null;
  // 11~12: 라디오·UART 받기를 넣으면 기본 시간을 마지막 받기 뒤 1초까지(연결 블록의 아이콘·소리 효과가 약 1.6초 걸림 → UART 기본 시각은 2.5초부터)
  const autoConn = run.connect !== false && [].concat(run.uart || []).length > 0, uAt = (o, k) => (o.at != null ? o.at : (autoConn ? 2500 : 300) + k * 400);
  const lastIn = Math.max(0, ...[].concat(run.uart || []).map((u, k) => uAt(typeof u === 'object' ? u : {}, k)), ...[].concat(run.radio || []).map((r, k) => (r && r.at != null ? r.at : 200 + k * 300)));
  const ms = run.ms != null ? run.ms : loops ? 15000 : lastIn ? lastIn + 1000 : 1000; // loops면 ms는 넘지 않는 상한
  const sample = run.sample != null ? Math.max(5, run.sample) : 100;
  const presses = [].concat(run.press || []).map((p) => (typeof p === 'string' ? { btn: p, at: 100 } : p));
  if (run.event && PRESS_EVENTS.includes(run.event) && !presses.length) presses.push({ btn: run.event, at: 100 });
  // 여러 번 누르기(times·every)·이벤트(흔들기·소리) — 숫자만 쓰면 100ms부터 every(기본 300)마다 n번
  const many = (x, key) => [].concat(typeof x === 'number' ? [{ times: x }] : x || []).flatMap((p) => { const n = Math.max(1, p.times | 0 || 1), ev = p.every != null ? p.every : 300, at = p.at != null ? p.at : 100; return Array.from({ length: n }, (_, k) => Object.assign({}, p, { at: at + k * ev, key: key || p.key })); });
  many(presses).forEach((p) => sim.press(p.btn, p.at, p.hold));
  many(run.shake, 'gesture:Shake').forEach((p) => sim.fire(p.key, p.at));
  many(run.sound, 'sound:Loud').forEach((p) => sim.fire(p.key, p.at));
  many(run.gesture).forEach((p) => sim.fire('gesture:' + (p.g || 'Shake'), p.at));
  many(run.logo).forEach((p) => sim.press('logo', p.at, p.hold)); // 비트런: 로고 터치 — run.logo: n | [{ at, times, every, hold }] (press: [{ btn: 'logo', at }]도 됨)
  // 11~12차시: 기울기·라디오 받기·블루투스 연결·UART 받기
  const tiltArr = Array.isArray(tilt) && !(tilt.length === 2 && tilt.every((x) => typeof x === 'number')) ? tilt : null;
  if (tilt != null) sim.setTilt(tiltArr ? tiltArr[0] : tilt);
  [].concat(run.radio || []).forEach((r, k) => { const o = typeof r === 'object' ? r : { number: r }, at = o.at != null ? o.at : 200 + k * 300;
    if (o.name != null) sim.fire('radio:value', at, [o.name, o.value], { group: o.group }); else if (o.string != null) sim.fire('radio:string', at, [o.string], { group: o.group }); else sim.fire('radio:number', at, [o.number], { group: o.group }); });
  const uarts = [].concat(run.uart || []);
  if (run.connect !== false && (uarts.length || run.connect)) sim.fire('bt:connect', run.connect && run.connect.at != null ? run.connect.at : 100);
  uarts.forEach((u, k) => { const o = typeof u === 'object' ? u : { text: u }; sim.fire('uart', uAt(o, k), [String(o.text)]); });
  if (run.disconnect) sim.fire('bt:disconnect', run.disconnect.at != null ? run.disconnect.at : ms - 200);
  // 무한반복 바퀴: k번째 바퀴 시작에 given 배열 값을 넣고, 바퀴가 끝날 때 상태를 찍어 둔다(seq·loops 끝 상태)
  const loopViews = [];
  sim.onLoop = (k) => { const v = {}; for (const [n, arr] of Object.entries(G.perLoop)) v[n] = arr[Math.min(k, arr.length - 1)]; if (Object.keys(v).length) sim.sensors.set(v); if (tiltArr) sim.setTilt(tiltArr[Math.min(k, tiltArr.length - 1)]); };
  sim.onLoopEnd = (k) => { if (loopViews.length < 50) loopViews.push(viewOf(sim)); };
  let EXP, tl0; // 9~10차시: expect의 $rec(예: motors.speed '$rec.speed' + fallback)
  try { EXP = resolveExpect(sc.expect, records, G.fellBack, G.used, sc.fallback); tl0 = (sc.timeline || []).map((x) => Object.assign({}, x, { expect: resolveExpect(x.expect, records, G.fellBack, G.used, sc.fallback) })); }
  catch (e) { out.fails.push(e.message); out.error = e.message; return done(out); }
  const sets = (run.set || []).slice().sort((a, b) => a.at - b.at), tl = tl0.slice().sort((a, b) => a.at - b.at);
  const wantSamples = !!(sc.expect && sc.expect.leds && sc.expect.leds.timeline);
  const sampleTimes = wantSamples ? Array.from({ length: Math.floor(ms / sample) }, (_, k) => Math.round(sample / 2 + k * sample)).filter((t) => t <= ms) : [];
  const times = [...new Set([...sets.map((s) => s.at), ...tl.map((t) => t.at), ...sampleTimes, ms])].filter((t) => t <= ms).sort((a, b) => a - b);
  const samples = [];
  for (const t of times) {
    if (loops && loopViews.length >= loops) break;
    if (loops) { while (sim.time < t && loopViews.length < loops) sim.runUntil(Math.min(t, sim.time + 20)); } else sim.runUntil(t);
    if (sampleTimes.includes(t)) samples.push({ t, leds: sim.leds.state() });
    tl.filter((x) => x.at === t).forEach((x) => checkExpect(viewOf(sim), x.expect, { samples, loopViews, cuts: sets.map((q) => q.at) }).forEach((f) => out.fails.push(`${(t / 1000).toFixed(1)}초: ${f}`)));
    sets.filter((s) => s.at === t).forEach((s) => { const v = Object.assign({}, s); delete v.at; sim.sensors.set(v); });
  }
  if (loops && loopViews.length < loops) out.fails.push(`무한반복이 ${loops}번 돌지 않았어요(${(ms / 1000).toFixed(0)}초 안에 ${loopViews.length}번).`);
  const endView = loops && loopViews.length >= loops ? loopViews[loops - 1] : viewOf(sim);
  out.fails.push(...checkExpect(endView, EXP, { samples, loopViews, cuts: sets.map((q) => q.at) }));
  const errs = sim.errors.filter((e) => e.code !== 'UNKNOWN' && e.code !== 'UNKNOWN_API');
  if (out.fails.length && errs.length) out.fails.push(...errs.slice(0, 2).map((e) => `코드를 따라가다 멈췄어요. ${e.message}`));
  out.ok = out.fails.length === 0;
  out.unknown = [...sim.unknown];
  out.records = G.used;
  // 학생 문장(P5): msg의 {센서 이름}을 쓴 입력값으로 채우고(배열은 '20 → 200'), 기록 대신 예시값(fallback)을 썼으면 그 사실을 덧붙인다
  const shown = {};
  for (const [n, v] of Object.entries(G.sensors)) { const s = G.perLoop[n] ? G.perLoop[n].join(' → ') : v; shown[n] = s; shown[sensorName(n)] = s; const t = SENSORS[sensorName(n)] && SENSORS[sensorName(n)].tok; if (t) shown[t] = s; if (shown.value == null) shown.value = s; } // {value} = 첫 센서 값(설계 개정 2)
  Object.keys(shown).forEach((k) => { if (shown[k] === 'none') shown[k] = '못 잼(500)'; }); // 초음파 '못 잼'
  if (tilt != null) shown.tilt = [].concat(tiltArr || [tilt]).map((t) => TILT_KO[t] || t).join(' → ');
  shown.sent = [...new Set(sim.radio.sent.map((x) => x.value))].join(', ') || '없음';
  { const S = soundSum(endView.music, endView.t); shown.beeps = S.n; if (S.interval != null) shown.interval = Math.round(S.interval); if (S.length != null) shown.length = Math.round(S.length); if (S.n) shown.freq = S.freqs[0]; shown.speed = endView.moving ? roundSay(endView.motor.speed) : 0; }
  { const sp = (endView.servos || {}).pins || {}; shown.servos = Object.keys(sp).sort().map((p) => `${p} ${SERVO_SAY(sp[p].speed)}`).join(' · ') || '서보 없음'; shown.calls = (endView.calls || []).filter((c) => !c.by).map((c) => c.name).join(' → ') || '없음'; } // 비트런 {servos}·{calls}
  // {rec.키} = 학생 측정 기록 값(given·expect의 $rec), 기록이 없어 예시값을 썼으면 그 예시값(9~10)
  for (const [k, v] of Object.entries(records)) if (v !== '' && v != null) shown['rec.' + k] = v;
  for (const [k, fb] of G.fellBack) shown['rec.' + k] = fb;
  out.values = shown;
  out.v2 = [...sim.v2]; // V2 전용 API(소리 감지·소리 크기) — V1 마이크로비트에서는 실행 중 오류(학생 글은 차시 몫)
  const fbVals = [...new Set(G.fellBack.map(([, f]) => String(f)))].join('·');
  out.note = G.fellBack.length ? `기록이 없어 예시값 ${josa(fbVals, '으로')} 확인했어요.` : '';
  out.msg = String(sc.msg || '').replace(/\{([\w가-힣:.]+)\}/g, (all, k) => (shown[k] != null ? shown[k] : all));
  if (out.note && out.msg) out.msg += ` (${out.note})`;
  if (!out.ok && sim.unknown.size) out.ok = null; // 모르는 블록 때문일 수 있음 → 판단하지 않음
  out.state = { leds: endView.leds.map((l) => ({ name: l.name, color: l.colorName, brightness: l.brightness, lit: l.lit })), oled: endView.rows.filter(Boolean), time: sim.time, loops: loopViews.length,
    sound: endView.music.beeps(endView.t).slice(0, 40).map((b) => ({ t: b.t, ms: b.ms, freq: b.freq, src: b.src })), motor: endView.motor,
    servos: Object.assign({}, (endView.servos || {}).pins), calls: (endView.calls || []).slice(0, 40).map((c) => ({ name: c.name, from: c.from, by: c.by })) };
  return done(out);
}
/** grader.scenario(ts, scenarios, { records, cache }): 모두 돌려 { pass, results } — pass는 판단한 시나리오가 모두 맞을 때 */
function scenario(ts, scenarios, opts = {}) {
  const cache = opts.cache || new Map();
  const results = (scenarios || []).map((sc, i) => runScenario(ts, sc, i, cache, opts));
  return { pass: results.every((r) => r.ok !== false), results };
}

/* ---------- (선택) 시뮬레이션 동작 확인: 통과 판정이 아니라 피드백용 ---------- */
function behavior(ts, b) {
  const sim = new Sim(ts);
  // 버튼 미션: '시작하면' 코드가 끝난 뒤 버튼을 누르고, 누른 순간의 위치·방향을 기준으로 잰다
  // (실습 최종 프로젝트처럼 시작하면 + A + B가 함께 있으면 실물에서도 시작 동작이 끝난 다음 버튼을 누르므로 — 학생 테스트 4차)
  let base = { x: 0, y: 0, turnedDeg: 0, dist: 0 };
  if (b.press) {
    for (let t = 100; t <= 10000; t += 100) { const s0 = sim.runUntil(t); if (!s0.fibers.some((f) => f !== '무한반복') && !s0.moving) break; }
    base = sim.robot.pose(); sim.press(b.press, sim.time + 50);
  }
  const raw = sim.runUntil(sim.time + (b.maxMs || 15000));
  const st = Object.assign({}, raw, { pose: { x: raw.pose.x - base.x, y: raw.pose.y - base.y, headingDeg: raw.pose.headingDeg, turnedDeg: +(raw.pose.turnedDeg - base.turnedDeg).toFixed(1), dist: +(raw.pose.dist - base.dist).toFixed(1) } });
  const notes = [];
  if (st.errors.length) notes.push(...st.errors.map((e) => `화면 속 포니봇이 실행하다 멈췄어요. ${e.message}`));
  if (b.expectStop && sim.robot.moving()) notes.push('동작이 끝난 뒤에도 바퀴가 계속 돌아요. 마지막에 "모든 모터 정지"가 필요해요.');
  const home = Math.hypot(st.pose.x, st.pose.y);
  if (b.returnsHome != null) notes.push(home <= b.returnsHome ? `출발점 근처로 돌아왔어요(${home.toFixed(0)}cm).` : `출발점에서 ${home.toFixed(0)}cm 떨어진 곳에서 끝났어요(화면 속 포니봇 기준).`);
  if (b.turnedDeg != null) notes.push(`모두 ${Math.abs(st.pose.turnedDeg).toFixed(0)}° 돌았어요(목표 약 ${Math.abs(b.turnedDeg)}°).`);
  return { pose: st.pose, notes, oledLit: sim.oled.litCount(), sim };
}

/** 통과를 막는 동작 검사: 보정값(회전 속도·거리)과 무관한 논리 오류만. 시뮬레이터의 거리·각도 수치로는 막지 않는다(algorithm.md 2.9 원칙 유지) */
function gate(ts, m, opts = {}) { // opts.records: 학생 측정 기록(시나리오의 $rec.○○)
  const out = [];
  const moves = /aiPonybot\.(runNormal|runMecanum|runMotor)\(/.test(ts || '');
  try {
    if (m.behavior) {
      const r = behavior(ts, m.behavior); const p = r.pose; const want = m.behavior.turnedDeg;
      if (m.behavior.expectStop && r.sim.robot.moving()) out.push('동작이 끝난 뒤에도 바퀴가 계속 돌아요. 마지막에 "모든 모터 정지"가 있어야 해요.');
      else if (moves && p.dist < 1) out.push('포니봇이 거의 움직이지 않아요. 이동 블록 다음에 일시중지가 있나요? 일시중지는 ms 단위라 1000ms가 1초예요.');
      else if (want != null && Math.abs(p.turnedDeg) < Math.abs(want) * 0.25) out.push('포니봇이 거의 돌지 않아요. 회전 블록 다음에 일시중지가 있나요?');
    }
    if (m.screen || /aiPonybot\.(showString|showNumber|printString|printNumber)\(/.test(ts || '')) {
      const sim = new Sim(ts); sim.runUntil(1500); const n = new Set(sim.state().notices);
      if (n.has('OLED_ROW_RANGE')) out.push('글자 위치의 행은 0~7까지예요. 지금은 화면 밖이라 글자가 안 보여요.');
      if (n.has('OLED_TEXT_OVERFLOW')) out.push('글자가 화면 오른쪽 끝을 넘어요. 열은 0~120 사이로 넣어요.');
      if (n.has('OLED_NON_ASCII')) out.push('OLED는 한글을 보여 주지 못해요. 영어와 숫자를 써요.');
    }
    // B형(S3-5): 미션 시나리오가 하나라도 맞지 않으면(판단 못 함은 빼고) 통과를 막는다. 체크리스트가 이미 부른 시나리오는 같은 결과라 다시 나오지 않음
    if (m.scenarios && m.scenarios.length) {
      const sr = scenario(ts || "", m.scenarios, { records: opts.records });
      sr.results.filter((r) => r.ok === false).forEach((r) => out.push(r.msg || (r.fails[0] ? `${r.fails[0]}${r.note ? ` (${r.note})` : ""}` : `${r.label}: 목표 동작과 달라요.`)));
    }
  } catch (e) { /* 실행할 수 없는 코드는 체크리스트·구조 리포트가 다룬다 */ }
  return out;
}

/* ---------- OLED 화면 특징 검사(목표 화면 그림과 비교할 때, 정답 코드 없이) ---------- */
function oledProbes(o) {
  const row = (y, x0, x1) => { let n = 0; for (let x = x0; x <= x1; x++) n += o.get(x, y); return n / (x1 - x0 + 1); };
  const col = (x, y0, y1) => { let n = 0; for (let y = y0; y <= y1; y++) n += o.get(x, y); return n / (y1 - y0 + 1); };
  const band = (y0, y1, x0 = 4, x1 = 123) => { let n = 0; for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) n += o.get(x, y); return n; };
  // 확장의 글자 출력은 8px 줄 전체(6x8 칸)를 덮어써서 그 칸의 선을 지운다 → 선 판정은 60% 이상이면 인정
  const L = 0.6, hmidY = [29, 30, 31, 32, 33].find((y) => row(y, 2, 125) > L);
  return {
    border: row(0, 0, 127) > L && row(63, 0, 127) > L && col(0, 0, 63) > L && col(127, 0, 63) > L,
    hmid: hmidY != null, vmid: [61, 62, 63, 64, 65].some((x) => col(x, 2, 61) > L),
    textTop: band(3, 27) > 20, textBottom: band(36, 60) > 20, lit: o.litCount(),
  };
}
function oledFeedback(p, want) {
  const say = { border: '화면 테두리 사각형', hmid: '가운데 가로선', vmid: '가운데 세로선', textTop: '위 칸 글자', textBottom: '아래 칸 글자' };
  return Object.keys(want).filter((k) => !!p[k] !== !!want[k]).map((k) => (want[k] ? `${josa(say[k], '이', '가')} 보이지 않아요.` : `${josa(say[k], '은', '는')} 목표 화면에 없어요. 빼도 돼요.`));
}

/** 미션 채점 진입점 */
function grade(code, mission, opts = {}) {
  const ir = buildIR(code);
  const ctx = { ts: code.ts || "", mission, cache: new Map(), records: opts.records || {} }; // B형: 체크리스트의 rule.scenario가 쓰는 코드·시나리오
  const results = (mission.checks || []).map((c) => ({ label: c.label, ok: c.rule ? runRule(ir, c.rule, ctx) : null }));
  const struct = structureReport(ir);
  const near = mission.spec ? nearest(ir, mission.spec, opts.level || 2) : null;
  const pass = results.every((r) => r.ok) && !struct.some((s) => s.kind === 'duplicate' || s.kind === 'partial');
  // 체크리스트의 시나리오가 틀렸을 때 학생 문장(입력값·예시값 표시 포함, P5) — 앱이 피드백에 덧붙인다
  const scenMsgs = [], scenByCheck = {};
  (mission.checks || []).forEach((c, j) => { if (results[j].ok === false && c.rule && c.rule.scenario != null) { const list = mission.scenarios || [], sc = typeof c.rule.scenario === 'number' ? list[c.rule.scenario] : list.find((s) => s.name === c.rule.scenario); if (sc) { const r = runScenario(ctx.ts, sc, list.indexOf(sc), ctx.cache, { records: ctx.records }); if (r.ok === false) { const t = r.msg || (r.fails[0] ? `${r.fails[0]}${r.note ? ` (${r.note})` : ''}` : ''); scenMsgs.push(t); scenByCheck[j] = t; } } } });
  return { pass, results, struct, near, ir, scenMsgs: scenMsgs.filter(Boolean), scenByCheck };
}

/** 도전 카드 확인(설계 개정 2: lab.star1·bonus·star3.check = { rule?, scenario?(하나 또는 배열), msg? }) → { ok, msgs }
 *  rule은 체크리스트 v2 규칙과 같은 꼴, scenario는 미션 시나리오와 같은 꼴(이름 대신 그 자리에 씀). ok가 null이면 판단 못 함(모르는 블록) */
function checkCard(code, chk, opts = {}) {
  const ir = buildIR(code), ctx = { ts: code.ts || '', mission: { scenarios: [] }, cache: new Map(), records: opts.records || {} };
  const msgs = []; let ok = true;
  if (chk && chk.rule && !runRule(ir, chk.rule, ctx)) { ok = false; msgs.push(chk.msg || '도전 조건에 맞는 블록이 아직 코드에 안 보여요.'); }
  if (ok && chk && chk.scenario) {
    [].concat(chk.scenario).forEach((sc, i) => {
      const r = runScenario(ctx.ts, sc, i, ctx.cache, { records: ctx.records });
      if (r.ok === false) { ok = false; msgs.push(r.msg || (r.fails[0] ? `${r.fails[0]}${r.note ? ` (${r.note})` : ''}` : '목표 동작과 달라요.')); } else if (r.ok === null && ok === true) ok = null;
    });
  }
  return { ok, msgs };
}

module.exports = { resolveExpect, screenPics, screenFails, grade, runRule, nearest, parsePattern, align, structureReport, behavior, gate, oledProbes, oledFeedback, josa, scenario, runScenario, checkExpect, cmp, condMatch, checkCard };

  };
  defs["validate"] = function (module, exports, require) {
/* AI 응답 검증: (1) 코드 생성 결과 — 문법(tslite 부분집합), API 화이트리스트/금지, 인자 범위, 블록 변환 위험 lint
 *              (2) 코치 모드 결과 — JSON 스키마, 정답 코드 유출 차단 */
const { parse, memberPath } = require('./tslite');

const SIG = { // 이름: [최소 인자, 최대 인자, 인자별 enum 경로 또는 범위]
  'aiPonybot.runNormal': [2, 2, ['aiPonybot.DirectionControl', [0, 255]]],
  'aiPonybot.runMecanum': [2, 2, ['aiPonybot.Mecanum', [0, 255]]],
  'aiPonybot.runMotor': [3, 3, ['aiPonybot.Motor', 'aiPonybot.Direction', [0, 255]]],
  'aiPonybot.stopMotor': [1, 1, ['aiPonybot.Motor']],
  'aiPonybot.stopAllMotors': [0, 0, []],
  'aiPonybot.clear': [0, 0, []],
  'aiPonybot.pixel': [2, 3, [[0, 127], [0, 63], [0, 1]]],
  'aiPonybot.showString': [3, 4, [null, [0, 120], [0, 7], [0, 1]]],
  'aiPonybot.showNumber': [3, 4, [null, [0, 120], [0, 7], [0, 1]]],
  'aiPonybot.printString': [1, 2, []],
  'aiPonybot.printNumber': [1, 2, []],
  'aiPonybot.horizontalLine': [3, 4, [[0, 127], [0, 63], [1, 128], [0, 1]]],
  'aiPonybot.verticalLine': [3, 4, [[0, 127], [0, 63], [1, 128], [0, 1]]],
  'aiPonybot.rectangle': [4, 5, [[0, 127], [0, 63], [0, 127], [0, 63], [0, 1]]],
  'basic.pause': [1, 1, [[0, 60000]]],
  'basic.forever': [1, 1, []],
  'input.onButtonPressed': [2, 2, ['Button']],
};
const ENUM_MEMBERS = {
  'aiPonybot.DirectionControl': ['Forward', 'Backward', 'Clockwise', 'CounterClockwise'],
  'aiPonybot.Mecanum': ['LeftForward', 'Forward', 'RightForward', 'Left', 'Stop', 'Right', 'LeftBackward', 'Backward', 'RightBackward'],
  'aiPonybot.Motor': ['Motor1', 'Motor2', 'Motor3', 'Motor4'],
  'aiPonybot.Direction': ['Clockwise', 'CounterClockwise'],
  Button: ['A', 'B', 'AB'],
};
// 3~4차시 밖이지만 제품/코어에 실제로 있는 API(경고만): 바이브코딩 스튜디오 PONYBOT_EXTENSION 선언과 맞춤
const PRODUCT_OK = /^(aiPonybot\.(servo|ping|readLineSensor|checkTwoLineState|checkSingleLineSensor|initColorSensor|getLight|getRed|getGreen|getBlue|isColorAdvanced|isColorInRange|invert|display|parse\w+Unified)|basic\.(showIcon|showNumber|showString|showLeds|clearScreen|showArrow)|input\.(buttonIsPressed|onGesture|onLogoEvent|temperature|lightLevel|soundLevel)|led\.\w+|music\.\w+|Math\.(abs|floor|round|min|max|idiv|randomRange|sqrt)|neopixel\.\w+|radio\.\w+)$/;
const DENY = [
  [/^control\.(reset|panic|inBackground|runInParallel|waitMicros)$/, '로봇을 재시작하거나 숨은 작업을 만드는 블록은 쓸 수 없어요'],
  [/^pins\.(i2c\w*|spi\w*|setPull|setEvents)$/, '모터·화면이 쓰는 통신선을 직접 건드리는 코드는 쓸 수 없어요'],
  [/^serial\.redirect\w*$/, '시리얼 핀 변경은 쓸 수 없어요'],
];

function validateCode(code, ctx = {}) {
  const errors = [], warnings = [], apis = new Set();
  const lesson = ctx.lessonOnly !== false;
  if (typeof code !== 'string' || !code.trim()) return { ok: false, errors: [{ code: 'EMPTY', msg: '코드가 비어 있어요' }], warnings, apis };
  if (code.length > 8000 || code.split('\n').length > 200) errors.push({ code: 'SIZE', msg: '코드가 너무 길어요(200줄 이하)' });
  let ast;
  try { ast = parse(code); } catch (e) { return { ok: false, errors: [{ code: 'SYNTAX', line: e.line, msg: e.message }], warnings, apis }; }

  const userFns = new Set(ast.body.filter((s) => s.type === 'FuncDecl').map((s) => s.name));
  const declared = new Set();
  walk(ast, { loop: 0, fn: 0, handler: 0, top: true });
  return { ok: errors.length === 0, errors, warnings, apis };

  function walk(n, c) {
    if (!n || typeof n !== 'object') return;
    if (Array.isArray(n)) { n.forEach((x) => walk(x, c)); return; }
    switch (n.type) {
      case 'Program': n.body.forEach((s) => walk(s, c)); return;
      case 'VarDecl': if (!n.init) errors.push({ code: 'NO_INIT', line: n.line, msg: `변수 ${n.name}에 처음 값을 넣어야 해요` }); declared.add(n.name); walk(n.init, c); return;
      case 'FuncDecl': if (!c.top) warnings.push({ code: 'NESTED_FN', line: n.line, msg: '함수 안의 함수는 회색 블록이 될 수 있어요' }); walk(n.body, Object.assign({}, c, { fn: c.fn + 1, top: false })); return;
      case 'While': case 'For': case 'ForOf': case 'If':
        // 초·중 창작 범위 잠금: 3~4차시는 순차구조 → 반복·조건이 나오면 1회 자동 재요청(edtech-planner B-5)
        if (ctx.allowControl === false) errors.push({ code: 'CONTROL_SCOPE', line: n.line, msg: '이번 차시는 순서대로 나열(순차 구조)만 써요' });
        if (n.type === 'If') { walk(n.test, c); walk(n.cons, Object.assign({}, c, { top: false })); walk(n.alt, Object.assign({}, c, { top: false })); return; }
      // fallthrough
      {
        const counted = n.type === 'For' && n.init && n.init.type === 'VarDecl' && n.update && n.update.type === 'Update';
        if (n.type === 'For' && !counted) warnings.push({ code: 'FOR_FORM', line: n.line, msg: 'for 반복은 for (let i = 0; i < N; i++) 모양이어야 블록이 돼요' });
        if (!counted && !hasPause(n.body)) errors.push({ code: 'NO_YIELD_LOOP', line: n.line, msg: '반복 안에 일시중지가 없어 마이크로비트가 멈출 수 있어요' });
        walk(n.test, c); walk(n.init, c); walk(n.update, c); walk(n.iter, c); walk(n.body, Object.assign({}, c, { loop: c.loop + 1, top: false })); return;
      }
      case 'Block': n.body.forEach((s) => walk(s, Object.assign({}, c, { top: false }))); return;
      case 'Cond': warnings.push({ code: 'TERNARY', line: n.line, msg: '조건 ? 값 : 값 모양은 블록으로 바뀌지 않을 수 있어요' }); break;
      case 'Assign': if (!['=', '+=', '-='].includes(n.op)) warnings.push({ code: 'ASSIGN_OP', line: n.line, msg: `${n.op} 대입은 블록이 안 될 수 있어요` }); break;
      case 'Call': {
        const p = memberPath(n.callee);
        if (p) checkCall(p, n, c);
        else warnings.push({ code: 'DYN_CALL', line: n.line, msg: '이름 없는 함수 호출이 있어요' });
        n.args.forEach((a) => walk(a, a.type === 'Func' ? Object.assign({}, c, { handler: c.handler + 1, top: false }) : c));
        if (n.callee.type === 'Member') walk(n.callee.obj, c);
        return;
      }
      case 'Member': { const p = memberPath(n); if (p) checkMember(p, n); else walk(n.obj, c); return; }
      case 'Func': walk(n.body, Object.assign({}, c, { handler: c.handler + 1, top: false })); return;
    }
    for (const k of Object.keys(n)) if (k !== 'line' && typeof n[k] === 'object') walk(n[k], c);
  }
  function checkCall(p, n, c) {
    if (n.callee.type === 'Ident') { if (!userFns.has(p)) errors.push({ code: 'UNKNOWN_FN', line: n.line, msg: `없는 함수 ${p}()` }); return; }
    apis.add(p);
    for (const [re, msg] of DENY) if (re.test(p)) { errors.push({ code: 'DENY', line: n.line, msg: `${p}: ${msg}` }); return; }
    if (/^(input\.on\w+|basic\.forever)$/.test(p) && (c.loop || c.handler || c.fn || !c.top)) errors.push({ code: 'EVENT_NESTED', line: n.line, msg: '이벤트 블록(버튼, 무한반복)은 맨 바깥에 있어야 해요' });
    const sig = SIG[p];
    if (!sig) {
      if (PRODUCT_OK.test(p)) { if (lesson) warnings.push({ code: 'OUT_OF_LESSON', line: n.line, msg: `${p}는 이번 차시에서 배우지 않은 블록이에요` }); }
      else errors.push({ code: 'UNKNOWN_API', line: n.line, msg: `${p}는 없는 블록이에요(AI가 지어낸 이름일 수 있어요)` });
      return;
    }
    const [min, max, spec] = sig;
    if (n.args.length < min || n.args.length > max) errors.push({ code: 'ARITY', line: n.line, msg: `${p} 인자 개수가 맞지 않아요` });
    n.args.forEach((a, i) => {
      const s = spec[i]; if (!s) return;
      if (typeof s === 'string') { const ap = memberPath(a); const ok = ap && ap.startsWith(s + '.') && ENUM_MEMBERS[s].includes(ap.slice(s.length + 1)); if (!ok) errors.push({ code: 'ENUM', line: n.line, msg: `${p}의 ${i + 1}번째 값은 ${s}.○○ 이어야 해요` }); }
      else { const v = a.type === 'Num' ? a.value : a.type === 'Unary' && a.op === '-' && a.arg.type === 'Num' ? -a.arg.value : null; if (v != null && (v < s[0] || v > s[1])) warnings.push({ code: 'RANGE', line: n.line, msg: `${p}의 ${i + 1}번째 값 ${v}는 ${s[0]}~${s[1]} 범위를 벗어나요` }); }
    });
  }
  function checkMember(p, n) {
    const root = p.split('.')[0];
    if (['aiPonybot', 'Button', 'basic', 'input', 'Math', 'led', 'music', 'neopixel', 'radio', 'control', 'pins', 'serial', 'NeoPixelColors', 'NeoPixelMode', 'DigitalPin', 'AnalogPin', 'TouchButtonEvent', 'Gesture', 'IconNames', 'ArrowNames'].includes(root)) {
      const en = Object.keys(ENUM_MEMBERS).find((e) => p.startsWith(e + '.'));
      if (en && !ENUM_MEMBERS[en].includes(p.slice(en.length + 1))) errors.push({ code: 'ENUM', line: n.line, msg: `${p}는 없는 값이에요` });
    } else if (!declared.has(root) && !userFns.has(root)) errors.push({ code: 'UNKNOWN', line: n.line, msg: `${root}를 찾을 수 없어요` });
  }
}
function hasPause(n) {
  let found = false;
  (function w(x) { if (found || !x || typeof x !== 'object') return; if (Array.isArray(x)) return x.forEach(w); if (x.type === 'Call' && memberPath(x.callee) === 'basic.pause') { found = true; return; } if (x.type === 'Func') return; for (const k of Object.keys(x)) if (typeof x[k] === 'object') w(x[k]); })(n);
  return found;
}

/* ---------- 코치 모드 응답 검증 ---------- */
const CODE_LEAK = [/```/, /aiPonybot\s*\.\s*\w+\s*\(/, /basic\s*\.\s*(pause|forever)\s*\(/, /input\s*\.\s*onButtonPressed/, /function\s*\(\s*\)\s*\{/, /=>\s*\{/];
function validateCoach(raw, ctx = {}) {
  let text = String(raw || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  let obj;
  try { obj = JSON.parse(text); } catch (e) { return { ok: false, code: 'JSON', msg: 'JSON 형식이 아니에요' }; }
  if (!obj || typeof obj !== 'object') return { ok: false, code: 'SCHEMA', msg: '객체가 아니에요' };
  if (obj.type === 'refusal') return { ok: true, refusal: true, value: { hint: '수업과 관련된 질문을 해 주세요. 개인정보는 적지 않아요.' } }; // 문구는 앱이 고정
  const need = ['diagnosis', 'hint', 'question'];
  for (const k of need) if (typeof obj[k] !== 'string' || !obj[k].trim()) return { ok: false, code: 'SCHEMA', msg: `${k} 항목이 없어요` };
  const all = [obj.diagnosis, obj.hint, obj.question, ...(Array.isArray(obj.blocks) ? obj.blocks : [])].join('\n');
  if (obj.hint.length > 180 || obj.diagnosis.length > 160 || obj.question.length > 120) return { ok: false, code: 'LONG', msg: '너무 길어요' };
  for (const re of CODE_LEAK) if (re.test(all)) return { ok: false, code: 'LEAK', msg: '코드가 들어 있어요' };
  if ((all.match(/→|->/g) || []).length > (ctx.level >= 3 ? 2 : 1)) return { ok: false, code: 'LEAK_SEQ', msg: '블록 순서를 너무 많이 알려 줘요' };
  const hangul = (all.match(/[가-힣]/g) || []).length, letters = (all.match(/[A-Za-z가-힣]/g) || []).length;
  if (letters && hangul / letters < 0.5) return { ok: false, code: 'LANG', msg: '한국어가 아니에요' };
  if (ctx.answerTokens) { const hit = ctx.answerTokens.filter((t) => all.includes(t)).length; if (hit >= 4) return { ok: false, code: 'LEAK_ANSWER', msg: '정답과 너무 비슷해요' }; }
  return { ok: true, value: { diagnosis: obj.diagnosis.trim(), hint: obj.hint.trim(), question: obj.question.trim(), blocks: Array.isArray(obj.blocks) ? obj.blocks.slice(0, 3).map(String) : [] } };
}

module.exports = { validateCode, validateCoach, SIG, ENUM_MEMBERS };

  };
  defs["stuck"] = function (module, exports, require) {
/* 막힘 감지 + 적응형 힌트 수준 결정 (서버 없음, 미션별 상태, 결정적 규칙)
 * 입력 이벤트: save(tokens) / check(passed,total) / hint() / run() / tick(now, visible)
 * 출력: decide(now) → {action, level, reason}
 *   action: none | glowHint | askWhere | suggestSim | offerCoach | suggestTeacher | offerBonus
 */
const DEF = { expectedMs: 4 * 60000, idleMs: 90000, activeGapMs: 60000, thrashWindowMs: 60000, thrashSaves: 8, nudgeCooldownMs: 60000 };

function lev(a, b) { const m = a.length, n = b.length; let prev = Array.from({ length: n + 1 }, (_, j) => j); for (let i = 1; i <= m; i++) { const cur = [i]; for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); prev = cur; } return prev[n]; }

class StuckMeter {
  constructor(opts = {}, now = 0) {
    this.o = Object.assign({}, DEF, opts);
    this.start = now; this.active = 0; this.lastAct = now; this.lastTick = now; this.lastEdit = now;
    this.fails = 0; this.checks = []; this.saves = []; this.hashes = new Map(); this.hintsSeen = 0; this.runs = 0;
    this.prevTokens = null; this.nudgedAt = -Infinity; this.progress = 0; // 누적 블록 변화량
  }
  tick(now, visible = true) { // 탭이 보이고 최근 60초 안에 조작이 있을 때만 '활동 시간'으로 센다
    if (visible && now - this.lastAct <= this.o.activeGapMs) this.active += now - this.lastTick;
    this.lastTick = now;
  }
  save(now, tokens) {
    this.tick(now); this.lastAct = now;
    const key = tokens.join(',');
    const delta = this.prevTokens ? lev(this.prevTokens, tokens) : tokens.length;
    if (delta > 0) this.lastEdit = now;
    this.progress += delta; this.prevTokens = tokens;
    this.hashes.set(key, (this.hashes.get(key) || 0) + 1);
    this.saves.push({ t: now, delta, key });
  }
  check(now, passed, total) {
    this.tick(now); this.lastAct = now;
    const prev = this.checks.length ? this.checks[this.checks.length - 1].passed : -1;
    this.checks.push({ t: now, passed, total });
    if (passed < total) this.fails++;
    return { improved: passed > prev };
  }
  hint(now) { this.tick(now); this.lastAct = now; this.hintsSeen++; }
  run(now) { this.tick(now); this.lastAct = now; this.runs++; }

  /** 막힘 점수(0~) → 힌트 수준 1~3 */
  score(now) {
    const ratio = this.active / this.o.expectedMs;
    const c = this.checks, stalled = c.length >= 2 && c[c.length - 1].passed <= c[c.length - 2].passed;
    return 0.5 * this.fails + Math.max(0, ratio - 1) * 1.5 + (stalled ? 0.5 : 0) + (now - this.lastEdit > this.o.idleMs ? 0.5 : 0);
  }
  level(now) { return Math.max(1, Math.min(3, 1 + Math.floor(this.score(now)))); }

  decide(now, solved = false) {
    this.tick(now);
    const lvl = this.level(now), ratio = this.active / this.o.expectedMs;
    if (solved) return ratio < 0.5 && this.fails === 0 ? { action: 'offerBonus', level: 0, reason: '빠르게 성공' } : { action: 'none', level: 0, reason: 'solved' };
    if (now - this.nudgedAt < this.o.nudgeCooldownMs) return { action: 'none', level: lvl, reason: 'cooldown' };
    const recent = this.saves.filter((s) => now - s.t <= this.o.thrashWindowMs);
    const revisits = [...this.hashes.values()].filter((n) => n >= 3).length;
    let r = null;
    if (this.fails >= 4 || ratio >= 2.5) r = { action: 'suggestTeacher', reason: `실패 ${this.fails}회 / 예상 시간의 ${ratio.toFixed(1)}배` };
    else if (recent.length >= this.o.thrashSaves && revisits >= 1 && this.runs === 0) r = { action: 'suggestSim', reason: '같은 코드로 여러 번 되돌아감(헤매는 중)' };
    else if (now - this.lastEdit >= this.o.idleMs && now - this.lastAct >= this.o.idleMs) r = { action: 'askWhere', reason: `${Math.round((now - this.lastEdit) / 1000)}초 동안 변화 없음` };
    else if (this.fails >= 2 && this.checks.length >= 2 && this.checks[this.checks.length - 1].passed <= this.checks[this.checks.length - 2].passed) r = { action: lvl >= 2 ? 'offerCoach' : 'glowHint', reason: '확인 2회 이상 실패, 나아지지 않음' };
    else if (ratio >= 1.5) r = { action: 'glowHint', reason: '예상 시간의 1.5배' };
    if (!r) return { action: 'none', level: lvl, reason: '진행 중' };
    this.nudgedAt = now;
    return Object.assign(r, { level: lvl });
  }
}

module.exports = { StuckMeter, lev };

  };
  const ir = req('ir'), sim = req('sim'), grader = req('grader'), validate = req('validate'), stuck = req('stuck');
  window.PB = {
    tslite: req('tslite'), ir, grader, validate,
    Sim: sim.Sim, SimError: sim.SimError, ENUMS: sim.ENUMS,
    Robot: req('robot').Robot, Oled: req('oled').Oled,
    Sensors: req('sensors').Sensors, SENSORS: req('sensors').SENSORS, Leds: req('leds').Leds, // B형(S3-5)
    music: req('music'), // 소리 기록(7~8차시): Music·NOTE·BEAT·melodyNotes
    matrix: req('matrix'), // LED 화면 5×5: ICONS·ARROWS·ICON_KO·Matrix(위젯 led-grid가 모양 표를 씀)
    linecolor: req('linecolor'), // 9~10차시: isColor(v1.3.1 색 판정 — 위젯 rgb-mix sensor가 씀)·twoState
    StuckMeter: stuck.StuckMeter,
    get missionsV2() { return window.PB_MISSIONS || {}; }, // 차시 js/lesson-missions.js
  };
})();
