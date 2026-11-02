/* 코어 장면 라이브러리(원리 보기, 설계 02-split-plan.md 3.6·3.7): 여러 차시가 opts만 바꿔 쓰는 장면
 *   branch  — 만약 ~ 아니면 갈림길(선택 구조)
 *     opts: sensor('빛 밝기'), unit(''), threshold(40), op('<' · ≤ ≥ = ≠ 도 됨), values([첫 값, 다시 잰 값] = [150, 12]),
 *           yes('포니봇 불빛 켜기' = 만약 칸 블록 글), no('포니봇 불빛 끄기' = 아니면 칸), loop(true = 무한반복 안), lamp(true = 만약 칸이 실행되면 등불 켜짐)
 *     장면 key: read(값 읽기) · ask(조건 묻기) · <첫 값의 결과: true|false> · loop(다시 재기) · <다시 잰 값의 결과: true|false>
 *       (두 값의 결과가 같으면 두 번째는 true2|false2). 기본값 [150, 12]이면 read · ask · false · loop · true
 *   var-box — 변수 상자와 반복: 값이 step씩 바뀌며 LED 밝기가 따라 바뀜
 *     opts: name('밝기'), start(0), step(1), times(255), pause(5, 일시중지 ms — 블록 글에만), color('Orange' | '#FFA500'), down(false = 다시 어두워지는 장면 더함)
 *     장면 key: box · set · use · change · repeat (+ down)
 *   echo — 초음파 거리 재기(7~8차시): 소리가 나가 물체에 부딪혀 돌아오는 왕복 → 걸린 시간 → 거리(÷2)
 *     opts: distance(30, cm), object('벽'), unit('cm'), sensor('초음파 센서'), showMath(true = µs ÷ 58 식)
 *     장면 key: send · travel · bounce · time · half
 *   data-flow — 기기 → 블루투스|라디오 → 마이크로비트 → 모터(11~12차시, 14~17차시 블루투스 공통)
 *     opts: via('bluetooth'|'radio'), from, device, msg, act, move, varName, group, press · 장면 key: press · send · receive · decide · move
 *   line-trace — 라인 센서 2개로 선 따라가기(9~10차시): opts title·todo{OffOff,OffOn,OnOff,OnOn}·block, 장면 key straight · right · straight2 · left · straight3 · cross
 * 쓰는 법(차시 lesson.js 이론 쪽): motion: 'branch', motionOpts: { sensor: '거리', unit: 'cm', threshold: 10, op: '<', values: [30, 5], yes: '멈추기', no: '달리기', lamp: false }
 * 그리기 도구는 Motion.kit. 글자는 모두 opts·데이터에서. 차시가 같은 id를 다시 등록하면 오류(D11) */
(() => {
  'use strict';
  const { C, r1, T, arrow, drawPath, block, tape, pill, X } = window.Motion.kit;
  const LED_HEX = { Red: '#FF0000', Orange: '#FFA500', Yellow: '#FFFF00', Green: '#00FF00', Blue: '#0000FF', Indigo: '#000080', Violet: '#8A2BE2', White: '#FFFFFF' };
  const LED_KO = { Red: '빨간색', Orange: '주황색', Yellow: '노란색', Green: '초록색', Blue: '파란색', Indigo: '남색', Violet: '보라색', White: '흰색' };
  // 블록 글에 보이는 색 이름은 확장(ai_ponybot_light v1.0.0 NeoPixelColors) 글자 그대로 '주황색(orange)', 학생 설명 글은 우리말만 '주황색'
  const ledKey = (c) => Object.keys(LED_HEX).find((k) => k.toLowerCase() === String(c).toLowerCase() || LED_HEX[k].toLowerCase() === String(c).toLowerCase()); // 'Orange'·'orange'·'#FFA500'
  const OPN = { '≤': '<=', '≥': '>=', '=': '==', '≠': '!=' }, OPS = { '<': '<', '>': '>', '<=': '≤', '>=': '≥', '==': '=', '!=': '≠' };
  const test = (v, op, t) => ({ '<': v < t, '>': v > t, '<=': v <= t, '>=': v >= t, '==': v === t, '!=': v !== t }[op]);
  const iga = (n) => `${n}${/[2459]$/.test(String(n)) ? '가' : '이'}`; // 숫자 + 이/가(받침)
  const ieyo = (n) => `${n}${/[2459]$/.test(String(n)) ? '예요' : '이에요'}`;
  const polyLen = (pts) => pts.slice(1).reduce((a, p, i) => a + Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]), 0);
  const polyD = (pts) => 'M' + pts.map((p) => `${r1(p[0])},${r1(p[1])}`).join(' L');
  const head = (x, y, dir, c) => { // 화살촉(dir: l·r·d)
    const P = { l: [[x, y], [x + 22, y - 13], [x + 22, y + 13]], r: [[x, y], [x - 22, y - 13], [x - 22, y + 13]], d: [[x, y], [x - 13, y - 22], [x + 13, y - 22]] }[dir];
    return `<polygon class="hd" points="${P.map((p) => p.join(',')).join(' ')}" fill="${c}" stroke="${c}" stroke-width="2" stroke-linejoin="round"/>`;
  };
  // 등불: 꺼진 바탕(늘 보임) + 켜진 층(id, 처음엔 숨김)
  const lamp = (cx, cy, id) => `<circle cx="${cx}" cy="${cy}" r="26" fill="#2A2F4D"/>${id ? `<g id="${id}" data-f="0"><circle cx="${cx}" cy="${cy}" r="38" fill="#FFF3B0" opacity=".45"/><circle cx="${cx}" cy="${cy}" r="26" fill="#FFF7CC" stroke="#F59E0B" stroke-width="3"/></g>` : ''}`;
  /** 긴 블록 글은 두 줄로(가운데 가까운 띄어쓰기에서) */
  const lines2 = (s, max) => {
    if (s.length <= max) return [s];
    const mid = s.length / 2; let best = -1;
    for (let i = 0; i < s.length; i++) if (s[i] === ' ' && (best < 0 || Math.abs(i - mid) < Math.abs(best - mid))) best = i;
    return best < 0 ? [s] : [s.slice(0, best), s.slice(best + 1)];
  };

  /* ==========================================================================
     branch — 만약 ~ 아니면 갈림길
     ========================================================================== */
  window.Motion.register('branch', (K, opts) => {
    const o = Object.assign({ sensor: '빛 밝기', unit: '', threshold: 40, op: '<', values: [150, 12], yes: '포니봇 불빛 켜기', no: '포니봇 불빛 끄기', loop: true, lamp: true }, opts);
    const op = OPN[o.op] || o.op, opS = OPS[op] || op;
    const [v1, v2] = o.values, u = o.unit ? ` ${o.unit}` : '';
    const t1 = !!test(v1, op, o.threshold), t2 = !!test(v2, op, o.threshold);
    const tf = (b) => (b ? '참' : '거짓'), side = (b) => (b ? o.yes : o.no), cell = (b) => (b ? '만약 칸' : '아니면 칸'); // 용어(5~6 본문·검증단 K10): 만약 칸·아니면 칸
    const k1 = t1 ? 'true' : 'false', k2 = (t2 ? 'true' : 'false') + (t1 === t2 ? '2' : '');
    const cond = `${o.sensor} ${opS} ${o.threshold}`;
    return {
      title: `선택 구조: 만약 ${cond} 이면 ${o.yes}, 아니면 ${o.no}`, duration: 24,
      scenes: [
        { key: 'read', t: 0, chip: '값 읽기', cap: `${o.loop ? '무한반복 안에서 ' : ''}${o.sensor} 값을 재요: ${v1}${u}`, alt: `${o.loop ? '무한반복 블록 안에서 ' : ''}${o.sensor} 값을 읽어요. 지금 값은 ${v1}${u}이에요.` },
        { key: 'ask', t: 4, chip: '조건 묻기', cap: `조건 묻기: ${cond}일까요? ${v1} ${opS} ${o.threshold} → ${tf(t1)}`, alt: `마름모(조건)에서 "${cond}"인지 물어요. 읽은 값 ${v1}${/[2459]$/.test(String(v1)) ? "를" : "을"} 넣으면 ${v1} ${opS} ${o.threshold}는 ${tf(t1)}이에요.` },
        { key: k1, t: 8, chip: `${tf(t1)}이면`, cap: `${tf(t1)}이면 ${cell(t1)}만 실행해요 → ${side(t1)}`, alt: `조건이 ${tf(t1)}이라 ${t1 ? '왼쪽' : '오른쪽'} ${cell(t1)}의 블록만 실행해요: ${side(t1)}. 다른 칸은 실행하지 않아요.` },
        { key: 'loop', t: 13, chip: '다시 재기', cap: o.loop ? `무한반복이라 다시 재요: 이번엔 ${v2}${u}` : `값이 ${v2}${u}일 때는?`, alt: o.loop ? `한쪽 칸을 실행하면 무한반복의 처음으로 돌아가 ${o.sensor} 값을 다시 읽어요. 이번 값은 ${v2}${u}이에요.` : `${o.sensor} 값이 ${v2}${u}일 때를 생각해 봐요.` },
        { key: k2, t: 17.5, chip: `${tf(t2)}이면`, cap: `${v2} ${opS} ${o.threshold} → ${tf(t2)}: ${cell(t2)} → ${side(t2)}`, alt: `${v2} ${opS} ${o.threshold}는 ${tf(t2)}이에요. 이번에는 ${cell(t2)}의 블록(${side(t2)})을 실행해요.` },
      ],
      svg() {
        let s = '';
        // 무한반복 → 값 읽기
        s += `<g id="br-top">${o.loop ? block(380, 20, 200, 52, '무한반복', C.basic, 26) : ''}</g>`;
        s += arrow(480, o.loop ? 74 : 40, 480, 104, { id: 'br-a0', c: C.muted, w: 6, head: 18, halo: false });
        s += `<g id="br-read">${block(290, 106, 380, 56, `${o.sensor} 재기`, '#E9B8F2', 26)}</g>`;
        const chip = (id, v, f) => `<g id="${id}"${f ? ' data-f="0"' : ''}>${pill(690, 110, 230, 48, `${o.sensor} = ${v}${u}`, { bg: '#fff', line: C.force, c: C.moveInk, fs: 24 })}</g>`;
        s += chip('br-v1', v1) + chip('br-v2', v2, 1);
        s += arrow(480, 164, 480, 194, { id: 'br-a1', c: C.muted, w: 6, head: 18, halo: false });
        // 조건 마름모
        s += `<g id="br-ask"><polygon points="480,198 690,270 480,342 270,270" fill="#fff" stroke="${C.force}" stroke-width="5" stroke-linejoin="round"/>${T(480, 262, `만약 ${cond}`, { fs: cond.length > 12 ? 24 : 28, fw: 800, a: 'middle' })}</g>`;
        s += T(480, 306, `${v1} ${opS} ${o.threshold} → ${tf(t1)}`, { fs: 24, fw: 800, a: 'middle', c: t1 ? C.fwdInk : C.backInk, id: 'br-e1' });
        s += T(480, 306, `${v2} ${opS} ${o.threshold} → ${tf(t2)}`, { fs: 24, fw: 800, a: 'middle', c: t2 ? C.fwdInk : C.backInk, id: 'br-e2', f: 0 });
        // 두 갈래: 왼쪽 = 참(만약 칸), 오른쪽 = 거짓(아니면 칸)
        const L1 = [[270, 270], [225, 270], [225, 404]], R1 = [[690, 270], [735, 270], [735, 404]];
        s += `<g id="br-l" data-f="0">${drawPath(polyD(L1), polyLen(L1), { c: C.fwd, w: 8 })}${head(225, 420, 'd', C.fwd)}${T(200, 248, '참이면', { fs: 24, fw: 800, c: C.fwdInk, a: 'middle' })}</g>`;
        s += `<g id="br-r" data-f="0">${drawPath(polyD(R1), polyLen(R1), { c: C.back, w: 8 })}${head(735, 420, 'd', C.back)}${T(760, 248, '아니면', { fs: 24, fw: 800, c: C.backInk, a: 'middle' })}</g>`;
        const box = (x, id, label, ring, withLamp) => {
          const tx = x + (withLamp ? 92 : 22), ls = lines2(label, 14), fs = ls.length > 1 ? 22 : label.length > 11 ? 24 : 28;
          const txt = ls.map((ln, i) => T(tx, 470 + (ls.length > 1 ? (i - 0.5) * 30 : 0) + fs * 0.35, ln, { fs, fw: 800 })).join('');
          return `<g id="${id}"><rect x="${x}" y="424" width="410" height="92" rx="18" fill="#fff" stroke="rgba(20,26,51,.16)" stroke-width="3"/>${txt}<rect id="${ring}" x="${x - 6}" y="418" width="422" height="104" rx="22" fill="none" stroke="${C.hl}" stroke-width="6" data-f="0"/></g>`;
        };
        s += box(20, 'br-yes', o.yes, 'br-ry', o.lamp) + (o.lamp ? lamp(62, 470, 'br-lon') : '');
        s += box(530, 'br-no', o.no, 'br-rn', o.lamp) + (o.lamp ? lamp(572, 470, null) : '');
        // 다시 처음으로(무한반복)
        const J = [[225, 516], [225, 552], [480, 552]], J2 = [[735, 516], [735, 552], [480, 552]], LP = [[480, 552], [948, 552], [948, 46], [600, 46]];
        if (o.loop) s += `<g id="br-loop" data-f="0">${drawPath(polyD(J), polyLen(J), { c: C.muted, w: 6 })}${drawPath(polyD(J2), polyLen(J2), { c: C.muted, w: 6 })}${drawPath(polyD(LP), polyLen(LP), { c: C.force, w: 7 })}${head(584, 46, 'l', C.force)}${pill(690, 562, 200, 40, '다시 처음부터', { bg: '#EEF0FF', line: C.force, c: C.moveInk, fs: 22 })}</g>`;
        return s;
      },
      build(tl, $) {
        const top = $('#br-top'), read = $('#br-read'), v1e = $('#br-v1'), v2e = $('#br-v2'), ask = $('#br-ask'), e1 = $('#br-e1'), e2 = $('#br-e2');
        const left = $('#br-l'), right = $('#br-r'), loop = $('#br-loop'), ry = $('#br-ry'), rn = $('#br-rn'), on = $('#br-lon');
        const a0 = $('#br-a0'), a1 = $('#br-a1');
        const go1 = t1 ? left : right, go2 = t2 ? left : right, ring1 = t1 ? ry : rn, ring2 = t2 ? ry : rn;
        X.set(tl, [top, a0, read, v1e, v2e, a1, ask, e1, e2, left, right, ry, rn, on, loop].filter(Boolean), { opacity: 0 });
        [left, right, loop].filter(Boolean).forEach((g) => X.drawInit(tl, g));
        // 1 값 읽기
        X.show(tl, [top, a0].filter(Boolean), 0.2, 0.4); X.show(tl, read, 0.8, 0.4); X.show(tl, v1e, 1.6, 0.4);
        // 2 조건 묻기
        X.show(tl, a1, 4.1, 0.3); X.show(tl, ask, 4.3, 0.4); X.show(tl, e1, 5.4, 0.4);
        // 3 첫 값의 갈래
        X.show(tl, go1, 8.1, 0.1); X.draw(tl, go1, 8.2, 0.9);
        X.show(tl, ring1, 9.3, 0.3); if (t1 && on) X.show(tl, on, 9.6, 0.4);
        // 4 다시 재기(무한반복)
        if (loop) { X.show(tl, loop, 13.1, 0.1); X.draw(tl, loop, 13.2, 1.4); X.to(tl, top, { opacity: 0.35, duration: 0.25, yoyo: true, repeat: 3 }, 14.7); X.to(tl, top, { opacity: 1, duration: 0.2 }, 15.8); }
        X.hide(tl, [ring1, v1e, e1], 15.0, 0.3); if (t1 && on) X.hide(tl, on, 15.0, 0.3);
        if (go2 !== go1) X.hide(tl, go1, 15.0, 0.3);
        X.show(tl, v2e, 15.4, 0.4);
        // 5 다시 잰 값의 갈래
        if (loop) X.hide(tl, loop, 17.5, 0.3);
        X.show(tl, e2, 17.7, 0.4);
        if (go2 !== go1) { X.show(tl, go2, 18.4, 0.1); X.draw(tl, go2, 18.5, 0.9); }
        X.show(tl, ring2, 19.6, 0.3); if (t2 && on) X.show(tl, on, 19.9, 0.4);
      },
    };
  });

  /* ==========================================================================
     var-box — 변수 상자와 반복: 값이 바뀌며 LED가 점점 밝아짐(down이면 다시 어두워짐)
     ========================================================================== */
  window.Motion.register('var-box', (K, opts) => {
    const o = Object.assign({ name: '밝기', start: 0, step: 1, times: 255, pause: 5, color: 'Orange', down: false }, opts);
    const hex = LED_HEX[o.color] || o.color, key = ledKey(o.color), ko = key ? LED_KO[key] : '정한 색';
    const bk = key ? `${LED_KO[key]}(${key.toLowerCase()})` : ko; // 블록 글 색 이름(주황색(orange))
    const end = o.start + o.step * o.times;
    const items = [o.start, o.start + o.step, o.start + 2 * o.step, o.start + 3 * o.step, '…', end].map(String);
    const LH = 100, D = o.down ? 6 : 0;
    const scenes = [
      { key: 'box', t: 0, chip: '변수 상자', cap: `변수는 값을 넣어 두는 이름 붙은 상자예요: "${o.name}"`, alt: `"${o.name}"라는 이름표가 붙은 상자가 나타나요. 변수는 값을 넣어 두었다가 꺼내 쓰는 상자예요.` },
      { key: 'set', t: 4, chip: '값 넣기', cap: `"${o.name}에 ${o.start} 저장" → 상자에 ${iga(o.start)} 들어가요`, alt: `"${o.name}에 ${o.start} 저장" 블록이 실행되면 상자 안 값이 ${iga(o.start)} 돼요.` },
      { key: 'use', t: 8.5, chip: '값 쓰기', cap: `상자 속 값으로 밝기를 바꾸고 켜요(지금 ${o.start})`, alt: `"라이트의 밝기를 (${o.name})로 변경하기" 블록은 상자 안 값을 꺼내 밝기로 써요. 지금 값은 ${ieyo(o.start)}. 그다음 "라이트를 모두 ${bk}으로 켜기"로 켜요.` },
      { key: 'change', t: 13, chip: `${o.step}씩 바꾸기`, cap: `"${o.name} 값 ${o.step} 증가" → ${items.slice(0, 4).join(', ')} … 한 칸씩 바뀌어요`, alt: `"${o.name} 값 ${o.step} 증가" 블록이 실행될 때마다 상자 값이 ${o.step}씩 바뀌어요: ${items.slice(0, 4).join(', ')}. 밝기도 조금씩 바뀌어요.` },
      { key: 'repeat', t: 18, chip: `${o.times}번 반복`, cap: `${o.times}번 되풀이하면 상자에는 ${iga(end)} 들어 있어요. 불빛은 점점 밝아져요`, alt: `이 블록들을 ${o.times}번 반복하면 상자 값이 ${o.start}에서 ${end}까지 바뀌고, 포니봇 불빛은 ${ko}으로 점점 밝아져요. 같은 블록을 ${o.times}번 쓰지 않아도 돼요.` },
    ];
    if (o.down) scenes.push({ key: 'down', t: 24, chip: '다시 어둡게', cap: `"${o.name}에 ${end} 저장" → ${-o.step}씩 바꾸며 다시 ${o.times}번: 점점 어두워져요`, alt: `상자에 ${end}${/[2459]$/.test(String(end)) ? "를" : "을"} 넣고 이번에는 값 ${-o.step} 증가를 ${o.times}번 반복해요. 상자 값이 ${end}에서 ${o.start}까지 줄면서 포니봇 불빛이 점점 어두워져요.` });
    return {
      title: `변수와 반복: ${o.name} 값이 ${o.step}씩 바뀌며 LED 밝기가 바뀌어요`, duration: 24 + D,
      scenes,
      svg() {
        let s = '';
        // 변수 상자
        s += `<g id="vb-box"><rect x="50" y="96" width="150" height="44" rx="12" fill="#DC143C"/>${T(125, 127, `변수 ${o.name}`, { fs: 24, fw: 800, c: '#fff', a: 'middle' })}
          <rect x="50" y="140" width="260" height="170" rx="20" fill="#FFF7E6" stroke="#F59E0B" stroke-width="4"/>
          <rect x="80" y="175" width="200" height="${LH}" rx="14" fill="#fff" stroke="rgba(20,26,51,.14)" stroke-width="2"/></g>`;
        s += `<g id="vb-num">${tape('vb-tape', 80, 175, 200, LH, items, { fs: 64, c: C.ink })}</g>`;
        // 블록(코드)
        const VAR = '#F4A5B5', LOOP = '#86D686', LIGHT = '#A9D2FB', BASIC = '#8EC5FF';
        const ring = (id, x, y, w) => `<rect id="${id}" x="${x - 6}" y="${y - 6}" width="${w + 12}" height="60" rx="14" fill="none" stroke="${C.hl}" stroke-width="6" data-f="0"/>`;
        s += `<g id="vb-b1">${block(350, 96, 330, 48, `${o.name}에 ${o.start} 저장`, VAR, 23)}${ring('vb-r1', 350, 96, 330)}</g>`;
        s += `<g id="vb-b2"><rect x="350" y="158" width="24" height="270" fill="${LOOP}"/><rect x="350" y="424" width="200" height="22" rx="8" fill="${LOOP}"/>${block(350, 158, 260, 48, `${o.times}번 반복`, LOOP, 23)}${ring('vb-r2', 350, 158, 260)}</g>`;
        s += `<g id="vb-b3">${block(378, 212, 540, 48, `라이트의 밝기를 ( ${o.name} )로 변경하기`, LIGHT, 22)}${ring('vb-r3', 378, 212, 540)}</g>`;
        s += `<g id="vb-b4">${block(378, 264, 520, 48, `라이트를 모두 ${bk}으로 켜기`, LIGHT, 22)}</g>`;
        s += `<g id="vb-b6">${block(378, 316, 260, 48, `일시중지 ${o.pause} ms`, BASIC, 22)}</g>`;
        s += `<g id="vb-b5">${block(378, 368, 330, 48, `${o.name} 값 ${o.step} 증가`, VAR, 22)}${ring('vb-r5', 378, 368, 330)}</g>`;
        s += `<g id="vb-arw" data-f="0">${arrow(312, 225, 600, 236, { c: C.force, w: 7, head: 22, draw: true })}</g>`;
        // LED 4개(L1~L4)
        s += T(50, 362, '포니봇 불빛', { fs: 22, c: C.muted });
        const xs = [80, 150, 220, 290];
        xs.forEach((x, i) => { s += `<circle cx="${x}" cy="410" r="26" fill="#2A2F4D"/>${T(x, 464, `L${i + 1}`, { fs: 20, c: C.muted, a: 'middle' })}`; });
        s += `<g id="vb-glow" opacity=".05">${xs.map((x) => `<circle cx="${x}" cy="410" r="36" fill="${hex}" opacity=".35"/><circle cx="${x}" cy="410" r="26" fill="${hex}"/>`).join('')}</g>`;
        // 밝기 막대(0 → 255)
        s += `<rect x="50" y="496" width="260" height="18" rx="9" fill="#E9EDF7"/><g transform="translate(50,496)"><g id="vb-bar" data-f="0"><rect width="260" height="18" rx="9" fill="${hex}" stroke="rgba(20,26,51,.18)"/></g></g>`;
        s += T(50, 544, `밝기 ${o.start}`, { fs: 20, c: C.muted }) + T(310, 544, String(Math.min(255, Math.max(0, end))), { fs: 20, c: C.muted, a: 'end' });
        s += `<g id="vb-count" data-f="0">${pill(624, 160, 170, 44, `반복 ${o.times}번`, { bg: '#ECFDF3', line: '#16A34A', c: '#14532D', fs: 22 })}</g>`;
        if (o.down) s += `<g id="vb-down" data-f="0">${pill(560, 470, 360, 48, `${o.name}에 ${end} 저장 → 값 ${-o.step} 증가`, { bg: '#FFF1F2', line: '#E11D48', c: '#9F1239', fs: 22 })}</g>`;
        return s;
      },
      build(tl, $) {
        const box = $('#vb-box'), num = $('#vb-num'), tp = $('#vb-tape'), glow = $('#vb-glow'), bar = $('#vb-bar'), arw = $('#vb-arw'), cnt = $('#vb-count'), dn = $('#vb-down');
        const b = [1, 2, 3, 4, 5, 6].map((i) => $(`#vb-b${i}`)), r = { 1: $('#vb-r1'), 2: $('#vb-r2'), 3: $('#vb-r3'), 5: $('#vb-r5') };
        const lit = (k) => (k >= 5 ? 1 : 0.05 + 0.05 * k); // 상자 값 칸 k(0~5) → LED 불투명도
        const barAt = (k) => (k >= 5 ? 1 : 0.004 * k);
        X.set(tl, [box, num, ...b, arw, cnt, dn, ...Object.values(r)].filter(Boolean), { opacity: 0 });
        X.set(tl, glow, { opacity: lit(0) }); X.set(tl, bar, { scaleX: 0, svgOrigin: '0 0' });
        X.drawInit(tl, arw);
        // 1 상자
        X.show(tl, box, 0.3, 0.5);
        // 2 값 넣기
        X.show(tl, b[0], 4.1, 0.4); X.show(tl, r[1], 4.6, 0.25); X.show(tl, num, 5.2, 0.4);
        // 3 값 쓰기: 상자 → 밝기 블록
        X.hide(tl, r[1], 8.5, 0.2); X.show(tl, b.slice(1), 8.6, 0.4); X.show(tl, r[3], 9.2, 0.25);
        X.show(tl, arw, 9.6, 0.1); X.draw(tl, arw, 9.7, 0.8);
        // 4 바꾸기: 0 → 1 → 2 → 3
        X.hide(tl, [r[3], arw], 13.0, 0.2); X.show(tl, r[5], 13.2, 0.25);
        [1, 2, 3].forEach((k, i) => { const t = 13.8 + i * 1.1; X.to(tl, tp, { y: -LH * k, duration: 0.35, ease: 'power2.out' }, t); X.to(tl, glow, { opacity: lit(k), duration: 0.3 }, t); X.to(tl, bar, { scaleX: barAt(k), svgOrigin: '0 0', duration: 0.3 }, t); });
        // 5 반복: 끝값까지 빠르게
        X.hide(tl, r[5], 18.0, 0.2); X.show(tl, [r[2], cnt], 18.2, 0.3);
        X.to(tl, tp, { y: -LH * 4, duration: 0.4, ease: 'power2.out' }, 18.8);
        X.to(tl, glow, { opacity: 1, duration: 2.6, ease: 'none' }, 18.8); X.to(tl, bar, { scaleX: 1, svgOrigin: '0 0', duration: 2.6, ease: 'none' }, 18.8);
        X.to(tl, tp, { y: -LH * 5, duration: 0.4, ease: 'power2.out' }, 21.3);
        // 6 (down) 다시 어둡게
        if (o.down) {
          X.hide(tl, [r[2], cnt], 24.0, 0.2); X.show(tl, dn, 24.2, 0.35);
          X.to(tl, tp, { y: -LH * 4, duration: 0.4, ease: 'power2.out' }, 24.9);
          X.to(tl, glow, { opacity: lit(0), duration: 2.6, ease: 'none' }, 24.9); X.to(tl, bar, { scaleX: 0, svgOrigin: '0 0', duration: 2.6, ease: 'none' }, 24.9);
          X.to(tl, tp, { y: 0, duration: 0.4, ease: 'power2.out' }, 27.4);
        }
      },
    };
  });
  /* ==========================================================================
     echo — 초음파 거리 재기: 소리가 나가서 물체에 부딪혀 돌아오는 왕복 → 걸린 시간 → 거리(÷2)
     opts: distance(30, cm), object('벽'), unit('cm'), sensor('초음파 센서'), showMath(true = µs ÷ 58 블록 식까지)
     근거: ai_ponybot_basic v1.0.2 ping — 에코 High 시간(µs)을 58로 나눠 cm(왕복이라 소리 빠르기 약 343m/s로 1cm에 약 29µs × 2)
     장면 key: send · travel · bounce · time · half
     ========================================================================== */
  window.Motion.register('echo', (K, opts) => {
    const o = Object.assign({ distance: 30, object: '벽', unit: 'cm', sensor: '초음파 센서', showMath: true }, opts);
    const d = Math.max(1, +o.distance || 30), us = Math.round(d * 58), oneWay = Math.round(d * 29), u = o.unit;
    const X0 = 214, X1 = 214 + Math.round(560 * Math.min(1, Math.max(0.15, d / 100))); // 물체 위치(그림 비율, 100cm 이상은 끝)
    const Y = 260; // 아래쪽 자막 띠(약 600 아래)에 가리지 않게 위로
    const arcs = (dir) => [0, 1, 2].map((i) => `<path d="M${dir > 0 ? -i * 18 : i * 18},-34 Q${dir > 0 ? 22 - i * 18 : -22 + i * 18},0 ${dir > 0 ? -i * 18 : i * 18},34" fill="none" stroke="${dir > 0 ? C.force : C.fwd}" stroke-width="6" stroke-linecap="round" opacity="${1 - i * 0.28}"/>`).join('');
    return {
      title: `초음파로 거리 재기: 왕복 시간 ${us}µs → 거리 ${d}${u}`, duration: 22,
      scenes: [
        { key: 'send', t: 0, chip: '소리 보내기', cap: `${o.sensor}가 사람 귀에 안 들리는 높은 소리(초음파)를 앞으로 보내요`, alt: `왼쪽 ${o.sensor}의 한쪽 눈(보내는 쪽)에서 초음파가 오른쪽으로 나가요. 사람 귀에는 들리지 않는 높은 소리예요.` },
        { key: 'travel', t: 4, chip: '나아가기', cap: `소리가 ${o.object}까지 ${d}${u}를 가요`, alt: `초음파가 공기 속을 지나 ${d}${u} 떨어진 ${o.object}까지 가요.` },
        { key: 'bounce', t: 8, chip: '부딪혀 돌아오기', cap: `${o.object}에 부딪힌 소리가 되돌아와요(메아리)`, alt: `초음파가 ${o.object}에 부딪혀 반사되고, 다시 ${o.sensor}의 다른 쪽 눈(받는 쪽)으로 돌아와요. 산에서 듣는 메아리와 같아요.` },
        { key: 'time', t: 12, chip: '시간 재기', cap: `보내고 받을 때까지 걸린 시간: 약 ${us}µs(마이크로초) = 갔다 온 시간`, alt: `${o.sensor}는 보낸 때부터 돌아온 때까지의 시간을 재요. 약 ${us}마이크로초예요. 이 시간은 갔다가 돌아온 왕복 시간이에요.` },
        { key: 'half', t: 16, chip: '반으로 나누기', cap: o.showMath ? `왕복이라 반만 쓰면 거리: ${us}µs ÷ 58 = ${d}${u}` : `왕복이라 반만 쓰면 ${o.object}까지 거리 ${d}${u}`, alt: o.showMath ? `소리는 ${o.object}까지 갔다가 돌아왔으니 거리는 왕복의 절반이에요. 확장 블록은 걸린 시간(마이크로초)을 58로 나눠 센티미터로 바꿔요: ${us} ÷ 58 = ${d}.` : `소리는 ${o.object}까지 갔다가 돌아왔으니, ${o.object}까지의 거리는 소리가 간 길의 절반인 ${d}${u}예요.` },
      ],
      svg() {
        let s = '';
        // 바닥·거리 자
        s += `<line x1="60" y1="${Y + 110}" x2="900" y2="${Y + 110}" stroke="rgba(20,26,51,.18)" stroke-width="4"/>`;
        // 초음파 센서(두 눈: 보내는 쪽 T, 받는 쪽 R)
        s += `<g id="ec-sensor"><rect x="70" y="${Y - 90}" width="140" height="180" rx="20" fill="#1E3A8A"/><circle cx="140" cy="${Y - 40}" r="32" fill="#CBD5E1" stroke="#0B1F3A" stroke-width="5"/><circle cx="140" cy="${Y + 40}" r="32" fill="#CBD5E1" stroke="#0B1F3A" stroke-width="5"/>
          ${T(140, Y - 32, '보냄', { fs: 18, fw: 800, a: 'middle', c: C.ink })}${T(140, Y + 48, '받음', { fs: 18, fw: 800, a: 'middle', c: C.ink })}${T(140, Y - 108, o.sensor, { fs: 24, fw: 800, a: 'middle' })}</g>`;
        // 물체
        s += `<g id="ec-obj"><rect x="${X1}" y="${Y - 130}" width="46" height="250" rx="8" fill="#E2E8F0" stroke="#64748B" stroke-width="4"/>${T(X1 + 23, Y - 146, o.object, { fs: 26, fw: 800, a: 'middle' })}</g>`;
        // 나가는 소리·돌아오는 소리
        // 움직이는 층(id)은 안쪽 g — 바깥 g가 자리(translate)를 잡아서 GSAP x가 자리를 덮어쓰지 않게
        s += `<g transform="translate(${X0},${Y - 40})"><g id="ec-out">${arcs(1)}</g></g>`;
        s += `<g transform="translate(${X1 - 6},${Y + 40})"><g id="ec-back">${arcs(-1)}</g></g>`;
        // 길(그려지는 화살표)
        s += `<g id="ec-p1" data-f="0">${arrow(X0, Y - 40, X1 - 10, Y - 40, { c: C.force, w: 6, head: 18, draw: true })}</g>`;
        s += `<g id="ec-p2" data-f="0">${arrow(X1 - 10, Y + 40, X0 + 8, Y + 40, { c: C.fwd, w: 6, head: 18, draw: true })}</g>`;
        // 거리 자
        s += `<g id="ec-ruler" data-f="0"><line x1="${X0}" y1="${Y + 140}" x2="${X1}" y2="${Y + 140}" stroke="${C.ink}" stroke-width="3"/><line x1="${X0}" y1="${Y + 128}" x2="${X0}" y2="${Y + 152}" stroke="${C.ink}" stroke-width="3"/><line x1="${X1}" y1="${Y + 128}" x2="${X1}" y2="${Y + 152}" stroke="${C.ink}" stroke-width="3"/>${T((X0 + X1) / 2, Y + 180, `${d}${u}`, { fs: 28, fw: 800, a: 'middle' })}</g>`;
        // 시간·식
        s += `<g id="ec-time" data-f="0">${pill(250, 40, 460, 56, `왕복 시간 약 ${us}µs`, { bg: '#EEF0FF', line: C.force, c: C.moveInk, fs: 26 })}</g>`;
        s += `<g id="ec-half" data-f="0">${pill(150, 470, 660, 60, o.showMath ? `거리 = ${us}µs ÷ 58 = ${d}${u}` : `거리 = 왕복의 절반 = ${d}${u}`, { bg: '#ECFDF3', line: '#16A34A', c: '#14532D', fs: 28 })}${T(480, 556, `(한 번 가는 시간 약 ${oneWay}µs)`, { fs: 20, c: C.muted, a: 'middle' })}</g>`;
        return s;
      },
      build(tl, $) {
        const out = $('#ec-out'), back = $('#ec-back'), p1 = $('#ec-p1'), p2 = $('#ec-p2'), ruler = $('#ec-ruler'), time = $('#ec-time'), half = $('#ec-half'), obj = $('#ec-obj');
        X.set(tl, [out, back, p1, p2, ruler, time, half], { opacity: 0 });
        X.drawInit(tl, p1); X.drawInit(tl, p2);
        // 1 보내기
        X.show(tl, out, 0.6, 0.3);
        // 2 나아가기
        X.show(tl, p1, 4.0, 0.1); X.draw(tl, p1, 4.1, 2.6, 'none');
        X.to(tl, out, { x: X1 - 10 - X0, duration: 2.6, ease: 'none' }, 4.1);
        // 3 부딪혀 돌아오기
        X.hide(tl, out, 8.0, 0.2); X.to(tl, obj, { x: 4, duration: 0.1, yoyo: true, repeat: 3 }, 8.0);
        X.show(tl, back, 8.2, 0.2); X.show(tl, p2, 8.2, 0.1); X.draw(tl, p2, 8.3, 2.6, 'none');
        X.to(tl, back, { x: -(X1 - X0 - 20), duration: 2.6, ease: 'none' }, 8.3);
        // 4 시간
        X.hide(tl, back, 11.2, 0.3); X.show(tl, time, 12.2, 0.4);
        // 5 반으로
        X.to(tl, p2, { opacity: 0.25, duration: 0.4 }, 16.0); X.show(tl, ruler, 16.4, 0.4); X.show(tl, half, 17.2, 0.4);
      },
    };
  });
  /* data-flow — 기기 → (블루투스 | 라디오) → 마이크로비트 → 모터(11~12차시, 14~17차시 블루투스 공통 흐름)
   *   opts: via('bluetooth' | 'radio'), from('폰 게임패드'), device('제어용 마이크로비트'), msg('U'), act('전진'), move('↑' | '↓' | '←' | '→' | '↶' | '↷'),
   *         varName('데이터'), group(라디오 그룹 번호 — via radio일 때 그림에 표시), press('U 버튼 누르기' = 첫 장면 글)
   *   장면 key: press(누르기) · send(무선으로 날아감) · receive(받아서 변수에 저장) · decide(만약 비교) · move(모터가 돌아 움직임) */
  window.Motion.register('data-flow', (K, opts) => {
    const radio = (opts || {}).via === 'radio';
    const o = Object.assign({ from: radio ? '조종용 마이크로비트' : '폰 게임패드', device: radio ? '제어용 포니봇' : '포니봇 마이크로비트', msg: radio ? '3' : 'U', act: '전진', move: '↑', varName: radio ? 'receivedNumber' : '데이터', group: 1 }, opts);
    const via = radio ? `라디오(그룹 ${o.group})` : '블루투스', q = radio ? String(o.msg) : `"${o.msg}"`;
    const press = o.press || (radio ? `조종기를 기울이면 ${o.msg}을(를) 보내요` : `${o.msg} 버튼을 눌러요`);
    const scenes = [
      { key: 'press', t: 0, chip: '보내기', cap: `${o.from}: ${press}`, alt: `왼쪽 ${o.from}에서 ${press}. 보낼 값 ${o.msg}이(가) 나타나요.` },
      { key: 'send', t: 3.5, chip: '무선 전송', cap: `값 ${o.msg}이(가) ${via} 전파에 실려 퍼져 나가요(선 없이)`, alt: `'${o.msg}' 값이 적힌 작은 꼬리표가 ${via} 전파에 실려 오른쪽 마이크로비트에 닿아요.` },
      { key: 'receive', t: 7, chip: '받아서 저장', cap: `${o.device}에서 받아 변수 ${o.varName}에 넣어요`, alt: `마이크로비트가 값을 받아 "${o.varName}" 상자에 ${o.msg}을(를) 넣어요.` },
      { key: 'decide', t: 10.5, chip: '비교', cap: `만약 ${o.varName} = ${q} 이면 → ${o.act}`, alt: `"만약 ${o.varName} = ${q} 이면" 블록이 참이 되어 ${o.act} 블록이 실행돼요.` },
      { key: 'move', t: 14, chip: '모터', cap: `모터가 돌아 포니봇이 ${o.act}해요`, alt: `아래 포니봇의 바퀴 4개가 ${o.move}에 맞는 쪽으로 돌고(회전·옆으로 갈 때는 한쪽은 앞, 한쪽은 뒤로) 포니봇이 ${o.act}해요.` },
    ];
    const DIRV = { '↑': [0, -1], '↓': [0, 1], '←': [-1, 0], '→': [1, 0] };
    // 바퀴 FL·FR·RL·RR: 1 앞으로(초록) · -1 뒤로(빨강) — 위젯 MOVES와 같은 규칙(회전은 한쪽 앞·한쪽 뒤, 메카넘 옆은 대각선끼리)
    const WSPIN = { '↑': [1, 1, 1, 1], '↓': [-1, -1, -1, -1], '↶': [-1, 1, -1, 1], '↷': [1, -1, 1, -1], '←': [-1, 1, 1, -1], '→': [1, -1, -1, 1] }[o.move] || [1, 1, 1, 1];
    return {
      title: `${via}로 보낸 값이 포니봇을 움직이기까지`, duration: 18, scenes,
      svg() {
        let s = '';
        // 1) 보내는 기기
        s += `<g id="df-from"><rect x="40" y="120" width="200" height="150" rx="22" fill="#fff" stroke="rgba(20,26,51,.16)" stroke-width="3"/>${T(140, 300, o.from, { fs: 22, c: C.muted, a: 'middle' })}`;
        s += radio ? `<rect x="85" y="150" width="110" height="90" rx="12" fill="#1E2547"/>${[0, 1, 2, 3, 4].map((i) => `<circle cx="${103 + i * 18.5}" cy="195" r="5" fill="#FF3B3B" opacity="${i === 2 ? 1 : 0.25}"/>`).join('')}`
          : `<rect x="70" y="150" width="140" height="90" rx="14" fill="#1E2547"/>${[['U', 140, 170], ['L', 110, 198], ['R', 170, 198], ['D', 140, 226]].map(([t, x, y]) => `<circle cx="${x}" cy="${y}" r="13" fill="${t === o.msg ? C.hl : '#3A4270'}"/>${T(x, y + 6, t, { fs: 16, c: t === o.msg ? C.ink : '#fff', a: 'middle' })}`).join('')}`;
        s += `</g><g id="df-hl" data-f="0"><rect x="34" y="114" width="212" height="162" rx="26" fill="none" stroke="${C.hl}" stroke-width="6"/></g>`;
        // 2) 무선 물결
        s += `<g id="df-wave">${[0, 1, 2].map((i) => `<path d="M${300 + i * 34},150 q 24,45 0,90" fill="none" stroke="${C.move}" stroke-width="6" stroke-linecap="round" opacity="${0.9 - i * 0.25}"/>`).join('')}${T(355, 300, via, { fs: 22, c: C.moveInk, a: 'middle', fw: 800 })}</g>`;
        // 3) 받는 마이크로비트 + 변수 상자
        s += `<g id="df-mb"><rect x="470" y="120" width="200" height="150" rx="22" fill="#fff" stroke="rgba(20,26,51,.16)" stroke-width="3"/><rect x="510" y="150" width="120" height="90" rx="12" fill="#1E2547"/>${T(570, 202, 'micro:bit', { fs: 18, c: '#fff', a: 'middle' })}${T(570, 300, o.device, { fs: 22, c: C.muted, a: 'middle' })}</g>`;
        s += `<g id="df-box" data-f="0"><rect x="700" y="130" width="220" height="44" rx="12" fill="#DC143C"/>${T(810, 160, `변수 ${o.varName}`, { fs: 21, fw: 800, c: '#fff', a: 'middle' })}<rect x="700" y="174" width="220" height="80" rx="14" fill="#FFF7E6" stroke="#F59E0B" stroke-width="4"/>${T(810, 228, String(o.msg), { fs: 44, c: C.ink, a: 'middle', fw: 800 })}</g>`;
        // 4) 만약 블록
        s += `<g id="df-if" data-f="0">${block(470, 350, 450, 52, `만약 ${o.varName} = ${q} 이면`, '#5CB1D6', 22)}${block(500, 404, 420, 50, `${o.act} (${o.move})`, C.robility, 22)}<rect id="df-ring" x="464" y="344" width="462" height="116" rx="16" fill="none" stroke="${C.hl}" stroke-width="6"/></g>`;
        // 5) 포니봇(위에서 본 모습)
        s += `<g id="df-botw"><g id="df-bot"><rect x="160" y="420" width="120" height="170" rx="24" fill="${C.body}"/>${[[150, 445], [270, 445], [150, 545], [270, 545]].map(([x, y]) => `<rect x="${x}" y="${y}" width="20" height="44" rx="6" fill="${C.stop}" class="df-wh"/>`).join('')}<circle cx="220" cy="440" r="10" fill="#6ABBFC"/>${T(220, 520, '포니봇', { fs: 20, c: '#fff', a: 'middle' })}</g></g>`;
        s += `<g id="df-arw" data-f="0">${arrow(220, 400, 220 + (DIRV[o.move] || [0, -1])[0] * 90, 400 + Math.min(0, (DIRV[o.move] || [0, -1])[1]) * 70 + Math.max(0, (DIRV[o.move] || [0, 0])[1]) * 260, { c: C.fwd, w: 8, head: 22 })}</g>`;
        s += `<g id="df-pkt" data-f="0">${pill(250, 170, 76, 48, String(o.msg), { bg: C.hl, line: '#CA8A04', c: C.ink, fs: 26 })}</g>`;
        return s;
      },
      build(tl, $, $$) {
        const hl = $('#df-hl'), pkt = $('#df-pkt'), box = $('#df-box'), iff = $('#df-if'), ring = $('#df-ring'), bot = $('#df-bot'), arw = $('#df-arw'), whs = $$('.df-wh');
        X.set(tl, [hl, pkt, box, iff, arw], { opacity: 0 }); X.set(tl, ring, { opacity: 0 });
        X.show(tl, hl, 0.4, 0.3); X.show(tl, pkt, 1.0, 0.3);
        X.to(tl, pkt, { x: 160, duration: 1.4, ease: 'power1.inOut' }, 3.7); X.to(tl, pkt, { x: 300, duration: 1.0, ease: 'power1.inOut' }, 5.2);
        X.hide(tl, hl, 4.0, 0.3);
        X.hide(tl, pkt, 7.1, 0.2); X.show(tl, box, 7.2, 0.4);
        X.show(tl, iff, 10.6, 0.4); X.show(tl, ring, 11.4, 0.3);
        whs.forEach((w, i) => X.to(tl, w, { fill: WSPIN[i] < 0 ? C.back : C.fwd, duration: 0.3 }, 14.1)); X.show(tl, arw, 14.3, 0.3);
        const d = DIRV[o.move]; if (d) X.to(tl, bot, { x: d[0] * 60, y: d[1] * 60, duration: 2.2, ease: 'power1.inOut' }, 14.6);
        else X.to(tl, bot, { rotation: o.move === '↷' ? 60 : -60, svgOrigin: '220 505', duration: 2.2, ease: 'power1.inOut' }, 14.6);
      },
    };
  });


  /* ==========================================================================
     line-trace — 라인 센서 2개로 선 따라가기(9~10차시): 위에서 본 매트, 포니봇이 지그재그로 선을 따라감
     두 센서가 선을 사이에 두고 달려요. ◌◌ 앞으로 · ◌● 오른쪽으로 돌기(↷) · ●◌ 왼쪽으로 돌기(↶) · ●● 가로선에서 멈춤
     (ai_ponybot_basic v1.3.1: 1 = 선을 봄 ●, 0 = 못 봄 ◌. Clockwise 블록 ↶ = 왼쪽으로, CounterClockwise ↷ = 오른쪽으로)
     opts: title, todo: { OffOff, OffOn, OnOff, OnOn }(할 일 글), block(true = 블록 글 '두 라인 센서의 값이 ◌ ●' 보이기)
     장면 key: straight · right · straight2 · left · straight3 · cross(자막 = 오른쪽 판 같게)
     ========================================================================== */
  window.Motion.register('line-trace', (K, opts) => {
    const o = Object.assign({ block: true }, opts);
    const TODO = Object.assign({ OffOff: '앞으로 가기 ↑', OffOn: '오른쪽으로 돌기 ↷', OnOff: '왼쪽으로 돌기 ↶', OnOn: '멈추기' }, o.todo || {});
    const ST = [['OffOff', 0, 0], ['OffOn', 0, 1], ['OnOff', 1, 0], ['OnOn', 1, 1]];
    const dot = (v) => (v ? '●' : '◌');
    // 장면마다 자막 = 오른쪽 판(센서 값·할 일)이 같게: 돈 뒤 다시 ◌◌로 달리는 때도 장면으로 둔다(straight2·straight3)
    return {
      title: o.title || '선 따라가기: 두 라인 센서가 본 것에 따라 4가지로 움직여요', duration: 17,
      scenes: [
        { key: 'straight', t: 0, chip: '◌ ◌ 앞으로', cap: `두 센서가 모두 흰 바탕을 봐요(◌ ◌) → ${TODO.OffOff}`, alt: '위에서 본 주행 매트. 검은 선이 포니봇의 두 라인 센서 사이에 있어요. 두 센서 값이 모두 0(◌)이라 포니봇이 앞으로 가요.' },
        { key: 'right', t: 4, chip: '◌ ● 오른쪽으로', cap: `선이 오른쪽으로 휘어 오른쪽 센서가 선을 밟았어요(◌ ●) → ${TODO.OffOn}`, alt: '선이 오른쪽으로 휘자 오른쪽 센서가 검은 선 위에 놓였어요. 왼쪽 0, 오른쪽 1이라 포니봇이 제자리에서 오른쪽으로 돌아요.' },
        { key: 'straight2', t: 6.5, chip: '◌ ◌ 다시 앞으로', cap: `다시 두 센서가 모두 흰 바탕(◌ ◌) → ${TODO.OffOff}`, alt: '돌고 나니 선이 다시 두 센서 사이에 있어요. 포니봇이 앞으로 가요.' },
        { key: 'left', t: 9, chip: '● ◌ 왼쪽으로', cap: `이번엔 왼쪽 센서가 선을 밟았어요(● ◌) → ${TODO.OnOff}`, alt: '선이 다시 왼쪽으로 휘자 왼쪽 센서가 검은 선 위에 놓였어요. 왼쪽 1, 오른쪽 0이라 포니봇이 왼쪽으로 돌아요. 이렇게 지그재그로 선을 따라가요.' },
        { key: 'straight3', t: 11.5, chip: '◌ ◌ 다시 앞으로', cap: `또 두 센서가 모두 흰 바탕(◌ ◌) → ${TODO.OffOff}`, alt: '선이 다시 두 센서 사이에 와서 포니봇이 앞으로 가요.' },
        { key: 'cross', t: 14, chip: '● ● 멈춤', cap: `두 센서가 모두 가로선을 밟았어요(● ●) → ${TODO.OnOn}`, alt: '포니봇이 가로선에 닿아 두 센서가 모두 1(●)이 됐어요. 포니봇이 멈춰요.' },
      ],
      svg() {
        let s = '';
        // 매트(흰 바탕)와 검은 선·가로선
        s += `<rect x="40" y="40" width="420" height="650" rx="22" fill="#fff" stroke="rgba(20,26,51,.22)" stroke-width="3"/>`;
        s += `<path d="M250 690 L250 520 C250 450 330 440 330 370 C330 300 205 285 205 215 L205 110" fill="none" stroke="#15181F" stroke-width="22" stroke-linecap="butt" stroke-linejoin="round"/>`;
        s += `<rect x="110" y="98" width="200" height="22" fill="#15181F"/>`;
        s += T(250, 76, '▲ 앞', { fs: 22, fw: 900, c: '#016FE7', a: 'middle' });
        // 포니봇(위에서 본 모양, 가운데가 원점, 앞 = 위쪽 -y) — 바닥 앞쪽 센서 2개, 화살표 = 머리 방향(돌면 함께 돎)
        const sen = (x, id) => `<circle cx="${x}" cy="-38" r="10" fill="#fff" stroke="#0B1F3A" stroke-width="3"/><circle id="${id}" cx="${x}" cy="-38" r="10" fill="#0B1F3A" data-f="0"/>`;
        s += `<g id="lt-bot"><g id="lt-body"><rect x="-46" y="-46" width="92" height="92" rx="16" fill="#F4F6FB" stroke="#5B6478" stroke-width="3" opacity=".92"/>
          <rect x="-56" y="-34" width="10" height="28" rx="4" fill="#5B6478"/><rect x="46" y="-34" width="10" height="28" rx="4" fill="#5B6478"/><rect x="-56" y="10" width="10" height="28" rx="4" fill="#5B6478"/><rect x="46" y="10" width="10" height="28" rx="4" fill="#5B6478"/>
          <path d="M0 -22 L13 4 L0 -3 L-13 4 Z" fill="#0472CA"/>${sen(-26, 'lt-lon')}${sen(26, 'lt-ron')}</g></g>`;
        // 오른쪽 판: 제목 · 범례(1·0) · 두 센서 값 → 블록 → 할 일 (자막 띠가 덮지 않게 위쪽에 모음)
        s += T(520, 84, '두 라인 센서가 본 것', { fs: 28, fw: 800 });
        s += T(520, 122, '1 = 선을 봤어요(●) · 0 = 못 봤어요(◌)', { fs: 22, fw: 700, c: C.muted });
        ST.forEach(([k, L, R], i) => {
          s += `<g id="lt-st${i}" data-f="0">`;
          s += T(560, 246, dot(L), { fs: 96, fw: 400, a: 'middle', c: C.ink }) + T(700, 246, dot(R), { fs: 96, fw: 400, a: 'middle', c: C.ink });
          s += T(560, 292, `왼쪽 ${L}`, { fs: 26, fw: 800, a: 'middle', c: C.muted }) + T(700, 292, `오른쪽 ${R}`, { fs: 26, fw: 800, a: 'middle', c: C.muted });
          if (o.block) s += block(500, 324, 420, 56, `두 라인 센서의 값이 ${dot(L)} ${dot(R)}`, '#7FB2E5', 24);
          s += pill(500, 404, 420, 64, TODO[k], { bg: k === 'OnOn' ? '#F1F3F7' : '#ECFDF3', line: k === 'OnOn' ? C.stop : '#16A34A', c: k === 'OnOn' ? C.ink : '#14532D', fs: 30 });
          s += '</g>';
        });
        return s;
      },
      build(tl, $) {
        // 위치(x·y)는 바깥 g, 돌기(rotation)는 안쪽 g — 돌 때 화살표·센서가 몸과 함께 오른쪽(시계 방향 +)·왼쪽으로 돈다
        const bot = $('#lt-bot'), body = $('#lt-body'), lon = $('#lt-lon'), ron = $('#lt-ron'), st = [0, 1, 2, 3].map((i) => $(`#lt-st${i}`));
        X.set(tl, bot, { x: 250, y: 620 });
        X.set(tl, body, { rotation: 0, svgOrigin: '0 0' });
        X.set(tl, [lon, ron, ...st], { opacity: 0 });
        // 1 ◌◌ 앞으로
        X.show(tl, st[0], 0.2, 0.3);
        X.to(tl, bot, { y: 492, duration: 3.6, ease: 'none' }, 0.3);
        // 2 ◌● 오른쪽으로 돌기(↷)
        X.hide(tl, st[0], 4.0, 0.2); X.show(tl, [st[1], ron], 4.1, 0.25);
        X.to(tl, body, { rotation: 32, svgOrigin: '0 0', duration: 1.6, ease: 'power1.inOut' }, 4.4);
        // 3 ◌◌ 다시 앞으로(머리 방향대로)
        X.hide(tl, [st[1], ron], 6.5, 0.2); X.show(tl, st[0], 6.6, 0.2);
        X.to(tl, bot, { x: 318, y: 392, duration: 2.2, ease: 'none' }, 6.6);
        // 4 ●◌ 왼쪽으로 돌기(↶)
        X.hide(tl, st[0], 9.0, 0.2); X.show(tl, [st[2], lon], 9.1, 0.25);
        X.to(tl, body, { rotation: -24, svgOrigin: '0 0', duration: 1.6, ease: 'power1.inOut' }, 9.4);
        // 5 ◌◌ 다시 앞으로 → 가로선 쪽
        X.hide(tl, [st[2], lon], 11.5, 0.2); X.show(tl, st[0], 11.6, 0.2);
        X.to(tl, bot, { x: 222, y: 236, duration: 1.4, ease: 'none' }, 11.6);
        X.to(tl, body, { rotation: 0, svgOrigin: '0 0', duration: 0.5, ease: 'power1.out' }, 13.0);
        X.to(tl, bot, { x: 205, y: 205, duration: 0.5, ease: 'power1.out' }, 13.0);
        X.to(tl, bot, { y: 150, duration: 0.45, ease: 'power1.out' }, 13.5);
        // 6 ●● 가로선에서 멈춤
        X.hide(tl, st[0], 14.0, 0.2); X.show(tl, [st[3], lon, ron], 14.1, 0.25);
      },
    };
  });
})();
