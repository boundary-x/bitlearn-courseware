'use strict';
/* 비트런 5화 미션 채점 규칙 v2. 키 = 미션 id, 라벨·순서 = js/lesson.js checks.
 * 엔진(2026-11-01 채점 엔진 담당, planning/bitrun/45-engine-impl.md)이 서보·로고 터치를 안다:
 *   토큰 SERVO:run:P1·SERVO:stop:P2(블록 servoservorun·TS servos.P1.run 둘 다), 이벤트 'logo'(로고를 터치하면), 시나리오 expect.servos·run.logo.
 * 방향(부호)은 시나리오로 본다: 왼쪽 다리는 P1(예전 배선 P0도 받음, pins), 오른쪽 다리는 P2.
 * 흔한 오답: 부호가 같음(제자리 회전) → walk/back 시나리오, 로고 블록에 정지 하나만·로고 블록 없음 → logo 시나리오. */
(function (M) {
  if (typeof module === 'object' && module.exports) module.exports = M;
  else window.PB_MISSIONS = Object.assign(window.PB_MISSIONS || {}, M);
})((() => {
  const L = { pins: ['P0', 'P1'], label: '왼쪽 다리' }, R = { label: '오른쪽 다리(P2)' };
  const leg = (l, r) => ({ left: Object.assign({}, L, l), P2: Object.assign({}, R, r) });
  const walk = { name: 'walk', label: 'A: 앞으로', run: { ms: 1500, press: [{ btn: 'A', at: 100 }] }, expect: { servos: leg({ sign: '+' }, { sign: '-' }) },
    msg: 'A를 누르면 왼쪽 다리는 + 속도, 오른쪽 다리(P2)는 − 속도로 돌아야 해요(지금 {servos}). 두 다리는 거울처럼 달려 있어 부호가 반대예요.' };
  const back = { name: 'back', label: 'B: 뒤로', run: { ms: 1500, press: [{ btn: 'B', at: 100 }] }, expect: { servos: leg({ sign: '-' }, { sign: '+' }) },
    msg: 'B를 누르면 왼쪽 다리는 − 속도, 오른쪽 다리(P2)는 + 속도로 돌아야 해요(지금 {servos}). 앞으로 코드에서 부호를 둘 다 바꿔요.' };
  // 걷는 중에 로고를 터치하면 걷던 다리가 모두 멈춰야 함(all = 회전 명령을 받은 모든 핀)
  const logo = { name: 'logo', label: '로고: 모두 멈춤', run: { ms: 1500, press: [{ btn: 'A', at: 100 }, { btn: 'logo', at: 900 }] }, expect: { servos: { all: { stopped: true } } },
    msg: '걷는 중에 로고를 터치하면 두 다리가 모두 멈춰야 해요(지금 {servos}). "로고를 터치하면" 안에 걷는 다리 핀의 "서보 정지"를 두 개 넣어요.' };
  const logoCheck = (label) => ({ label, rule: { scenario: 'logo' } });
  return {
    'walk-1': { checks: [
      { label: '로고를 터치하면 두 다리 멈추고 X 표정', rule: { all: [{ in: 'logo', has: 'SCREEN:PIC' }, { scenario: 'logo' }] } },
      { label: 'A를 누르면 체크 표정 보이기', rule: { in: 'A', has: 'SCREEN:PIC' } },
      { label: 'A를 누르면 왼쪽 +, 오른쪽 − 속도로 돌리기', rule: { scenario: 'walk' } },
    ], scenarios: [walk, logo] },
    'walk-2': { checks: [
      { label: 'A를 누르면 왼쪽 +, 오른쪽 − 그대로', rule: { scenario: 'walk' } },
      logoCheck('로고 멈춤 스위치 그대로 두기'),
    ], scenarios: [walk, logo] },
    'walk-3': { checks: [
      { label: 'B를 누르면 표정 보이기', rule: { in: 'B', has: 'SCREEN:PIC' } },
      { label: 'B를 누르면 왼쪽 −, 오른쪽 + 속도로 돌리기', rule: { scenario: 'back' } },
      logoCheck('로고 멈춤 스위치 그대로 두기'),
    ], scenarios: [walk, back, logo] },
  };
})());
