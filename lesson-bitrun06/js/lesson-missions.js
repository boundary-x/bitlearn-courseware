'use strict';
/* 비트런 6화 미션 채점 규칙 v2. 키 = 미션 id, 라벨·순서 = js/lesson.js checks.
 * 엔진(2026-11-01, planning/bitrun/45-engine-impl.md)이 서보·로고 터치·사용자 함수 호출을 안다:
 *   시나리오 expect.servos(핀별 속도 부호·돈 적·멈춤·함수 안에서 돌렸나 inFn), expect.calls(함수를 만들었나·어느 버튼에서 불렀나), run.press 'logo'.
 *   규칙 defined(함수 정의 개수)·표식 CALL(함수 부르기 블록, has에서).
 * 왼쪽 다리는 P1(예전 배선 P0도 받음, pins). 함수 이름은 모둠이 지은 이름 무엇이든('*').
 * 흔한 오답: 부호가 반대(앞으로 걸음) → spin 시나리오, 일시중지만·정지 없음·일시중지가 회전 앞 → turn90, 함수 없이 버튼에 바로·호출 없음 → fwdA/turnB, 로고 멈춤 없음·로고에 함수 호출 → logo. */
(function (M) {
  if (typeof module === 'object' && module.exports) module.exports = M;
  else window.PB_MISSIONS = Object.assign(window.PB_MISSIONS || {}, M);
})((() => {
  const L = { pins: ['P0', 'P1'], label: '왼쪽 다리' }, R = { label: '오른쪽 다리(P2)' };
  const leg = (l, r) => ({ left: Object.assign({}, L, l), P2: Object.assign({}, R, r) });
  const press = (btn) => [{ btn, at: 100 }];
  const spinA = { name: 'spinA', label: 'A: 제자리 오른쪽', run: { ms: 1500, press: press('A') }, expect: { servos: leg({ sign: '+' }, { sign: '+' }) },
    msg: 'A를 누르면 두 다리가 모두 + 속도로 돌아야 제자리에서 돌아요(지금 {servos}). 부호가 반대면 앞으로 걸어요.' };
  const spinB = { name: 'spinB', label: 'B: 제자리 왼쪽', run: { ms: 1500, press: press('B') }, expect: { servos: leg({ sign: '-' }, { sign: '-' }) },
    msg: 'B를 누르면 두 다리가 모두 − 속도로 돌아야 해요(지금 {servos}).' };
  // 걷는(도는) 중에 로고 → 200ms 뒤 모두 멈춤. 함수의 일시중지가 0.5초보다 길면 로고 없이는 아직 돌고 있음
  const logo = (btn, at = 1000) => ({ name: 'logo', label: '로고: 모두 멈춤', run: { ms: at + 300, press: [{ btn, at: 100 }, { btn: 'logo', at }] },
    timeline: [{ at: at + 200, expect: { servos: { all: { stopped: true } } } }],
    msg: '도는 중에 로고를 터치하면 두 다리가 모두 바로 멈춰야 해요. "로고를 터치하면" 안의 두 "서보 정지"는 그대로 둬요.' });
  // 90도: 회전 → 일시중지 → 정지. 0.9초에는 돌고 있고(일시중지가 회전보다 앞이면 걸림) 끝(4.5초)에는 멈춤(정지가 없으면 걸림). 일시중지 1600~3000ms 모두 통과
  const turn90 = { name: 'turn90', label: 'A: 정한 시간만큼 돌고 멈춤', run: { ms: 4500, press: press('A') },
    timeline: [{ at: 900, expect: { servos: leg({ sign: '+' }, { sign: '+' }) } }],
    expect: { servos: leg({ ran: '+', stopped: true }, { ran: '+', stopped: true }) },
    msg: 'A를 누르면 두 다리가 + 속도로 돌다가, 일시중지 시간이 지나면 두 다리가 모두 멈춰야 해요(지금 끝에 {servos}). 순서: 회전 → 일시중지 → 정지.' };
  const fwdA = { name: 'fwdA', label: 'A: 앞으로 함수', run: { ms: 4000, press: press('A') },
    expect: { calls: { '*': { calledFrom: 'A' } }, servos: leg({ ran: '+', inFn: true }, { ran: '-', inFn: true }) },
    msg: 'A를 누르면 앞으로 함수를 불러야 해요(지금 부른 함수: {calls}). 서보 블록은 함수 안에 두고, 버튼에는 함수 부르기 블록만 넣어요. 앞으로는 왼쪽 +, 오른쪽 −.' };
  const turnB = { name: 'turnB', label: 'B: 오른쪽돌기 함수', run: { ms: 4500, press: press('B') },
    expect: { calls: { '*': { calledFrom: 'B' } }, servos: leg({ ran: '+', inFn: true }, { ran: '+', inFn: true }) },
    msg: 'B를 누르면 오른쪽돌기 함수를 불러야 해요(지금 부른 함수: {calls}). 오른쪽돌기 함수 안에서 두 다리는 모두 + 속도예요.' };
  const logoNoFn = Object.assign(logo('A'), { expect: { calls: { '*': { calledFrom: 'logo', called: false } } },
    msg: '도는 중에 로고를 터치하면 바로 멈춰야 해요. 로고는 5화부터 멈춤 스위치예요 — 함수를 부르지 말고 두 "서보 정지"를 그대로 둬요.' });
  const logoCheck = { label: '로고 멈춤 스위치 그대로 두기', rule: { scenario: 'logo' } };
  return {
    'turn-1': { checks: [
      { label: 'A를 누르면 두 서보 모두 + 속도', rule: { scenario: 'spinA' } },
      { label: 'B를 누르면 두 서보 모두 − 속도', rule: { scenario: 'spinB' } },
      logoCheck,
    ], scenarios: [spinA, spinB, logo('A')] },
    'turn-2': { checks: [
      { label: 'A: 두 서보 + 속도 뒤 일시중지', rule: { in: 'A', order: ['SERVO:run', 'WAIT'] } },
      { label: 'A: 일시중지 뒤 두 서보 정지', rule: { scenario: 'turn90' } },
      logoCheck,
    ], scenarios: [turn90, spinB, logo('A')] },
    'turn-3': { checks: [
      { label: '함수 2개 만들기(첫 줄에 체크 표정)', rule: { defined: '>=2' } },
      { label: 'A를 누르면 앞으로 함수 부르기', rule: { scenario: 'fwdA' } },
      { label: 'B를 누르면 오른쪽돌기 함수 부르기', rule: { scenario: 'turnB' } },
      logoCheck,
    ], scenarios: [fwdA, turnB, logoNoFn] },
  };
})());
