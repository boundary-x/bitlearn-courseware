'use strict';
/* 비트런 7화 미션 채점 규칙 v2(차시 파일): 키 = 미션 id, 라벨·순서 = js/lesson.js checks(check-lesson이 확인).
 * 엔진(2026-11-01, planning/bitrun/45-engine-impl.md)이 서보·로고·사용자 함수 호출을 안다:
 *   표식 CALL(함수 부르기 블록 — 버튼 안에서 부른 횟수, 반복 12번 이하는 펼쳐 셈), 시나리오 expect.calls.seq(버튼이 부른 함수 차례)·expect.servos.
 * 함수 이름은 6화에서 만든 시작 코드 이름(앞으로·왼쪽돌기·오른쪽돌기·천천히_앞으로)을 쓴다. 반복 블록을 썼는지·반복 횟수는 lesson.js 미션 order(정규식)가 계속 막는다.
 * 흔한 오답: 오른쪽돌기를 반복 밖에 둠·원본 L7-2(왼쪽만) → zigzag, 천천히 함수의 부호까지 바꿈·빠르기 그대로 → slow, 로고 멈춤 블록을 지움 → logo. */
(function (M) {
  if (typeof module === 'object' && module.exports) module.exports = M;
  else window.PB_MISSIONS = Object.assign(window.PB_MISSIONS || {}, M);
})((() => {
  const L = { pins: ['P0', 'P1'], label: '왼쪽 다리' }, R = { label: '오른쪽 다리(P2)' };
  const leg = (l, r) => ({ left: Object.assign({}, L, l), P2: Object.assign({}, R, r) });
  // 3층 길: 두 길 모두 정답(바이블 7화 ★ 길 고르기 — answers accept)
  const path = { name: 'path', label: 'A: 비상구까지', run: { ms: 20000, press: [{ btn: 'A', at: 100 }] },
    expect: { calls: { '*': { calledFrom: 'A', seq: [['왼쪽돌기', '앞으로', '앞으로', '오른쪽돌기', '앞으로'], ['앞으로', '앞으로', '왼쪽돌기', '앞으로', '앞으로', '왼쪽돌기', '앞으로']] } } },
    msg: '지도판 길대로 함수를 불러야 해요(지금: {calls}). 선반을 비켜 가는 길은 왼쪽돌기 → 앞으로 → 앞으로 → 오른쪽돌기 → 앞으로예요.' };
  // 걷는 중 로고 → 0.3초 뒤 모두 멈춤(함수 안 일시중지 2초 동안)
  const logo = { name: 'logo', label: '로고: 모두 멈춤', run: { ms: 1900, press: [{ btn: 'A', at: 100 }, { btn: 'logo', at: 1500 }] },
    timeline: [{ at: 1800, expect: { servos: { all: { stopped: true } } } }],
    msg: '걷는 중에 로고를 터치하면 두 다리가 바로 멈춰야 해요. "로고를 터치하면" 블록과 그 안의 두 "서보 정지"는 그대로 둬요.' };
  const zig = { name: 'zigzag', label: 'B: 지그재그 3번', run: { ms: 34000, press: [{ btn: 'B', at: 100 }] },
    expect: { calls: { '*': { calledFrom: 'B', seq: [['앞으로', '왼쪽돌기', '앞으로', '오른쪽돌기'], ['앞으로', '오른쪽돌기', '앞으로', '왼쪽돌기']], repeat: 3 } } },
    msg: 'B를 누르면 [앞으로 → 왼쪽돌기 → 앞으로 → 오른쪽돌기]가 3번 되풀이되어야 해요(지금: {calls}). 네 함수가 모두 반복 안에 있는지 봐요.' };
  const slow = { name: 'slow', label: 'A+B: 천천히 4번', run: { ms: 12000, press: [{ btn: 'AB', at: 100 }] },
    expect: { calls: { '*': { calledFrom: 'AB', called: '>=4' } }, servos: leg({ ran: '+', runSpeed: '<100', inFn: true }, { ran: '-', runSpeed: '<100', inFn: true }) },
    msg: 'A+B를 누르면 천천히_앞으로 함수를 4번 불러, 두 다리가 앞으로(왼쪽 +, 오른쪽 −) 100보다 느리게 걸어야 해요(지금 부른 함수: {calls}). 빠르기 숫자만 줄이고 부호는 그대로 둬요.' };
  return {
    'maze-1': {
      checks: [
        { label: 'A 버튼을 누르면 안에 함수 부르기 5개 이상 넣기', rule: { in: 'A', has: 'CALL', min: 5 } },
        { label: '로고 멈춤 스위치는 그대로 두기', rule: { scenario: 'logo' } },
      ],
      scenarios: [path, logo],
    },
    'maze-2': {
      checks: [
        { label: 'B 버튼을 누르면 안에 [3번 반복] 넣기', rule: { in: 'B', has: 'CALL', min: 12 } },
        { label: '반복 안에 앞으로·왼쪽돌기·앞으로·오른쪽돌기 차례로 넣기', rule: { scenario: 'zigzag' } },
      ],
      scenarios: [zig],
    },
    'maze-3': {
      checks: [
        { label: '천천히_앞으로 함수 만들기(빠르기만 줄이기)', rule: { scenario: 'slow' } },
        { label: 'A+B 버튼을 누르면 [4번 반복] 안에서 천천히_앞으로 부르기', rule: { in: 'AB', has: 'CALL', min: 4 } },
      ],
      scenarios: [slow],
    },
  };
})());
