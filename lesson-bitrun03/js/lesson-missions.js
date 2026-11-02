'use strict';
/* 비트런 3화 미션 채점 규칙 v2: 키 = 미션 id, 라벨·순서는 js/lesson.js checks 그대로(check-lesson이 확인).
 * 원칙: 구조는 너그럽게(표정 종류·LED 출력도 인정), 맞는지는 시나리오(LED 화면 5×5, engine/matrix.js).
 * touch-1: 엔진(2026-11-01, planning/bitrun/45-engine-impl.md)이 로고 터치를 안다 — 이벤트 'logo'(블록 input_logo_event·TS input.onLogoEvent 둘 다), 시나리오 run.press 'logo'.
 *   시나리오 touch: 무작위 수를 'min'(범위의 가장 작은 값)으로 정해 로고를 터치 → 화면에 1이 나와야 함(원본 randint(75, 100)이면 75라 걸림), 소리 효과도 나와야 함.
 * 브라우저: window.PB_MISSIONS에 더한다 / Node: require */
(function (M) {
  if (typeof module === 'object' && module.exports) module.exports = M;
  else window.PB_MISSIONS = Object.assign(window.PB_MISSIONS || {}, M);
})({
  'face-1': {
    checks: [
      { label: '"시작하면" 안에 아이콘 출력(또는 LED 출력) 5개 넣기', rule: { in: 'start', has: 'SCREEN:PIC', min: 5 } },
      { label: '서로 다른 표정 5가지로 바꾸기', rule: { scenario: 'faces' } },
    ],
    scenarios: [
      // 쉬기 없이도(아이콘 0.6초씩) 쉬기를 넣어도(약 7초) 다 보이게 9초
      { name: 'faces', label: '표정 5가지', run: { ms: 9000 }, expect: { screen: { distinct: 5 } },
        msg: 'LED 화면에 서로 다른 표정이 5가지 나와야 해요. 모양 칸에서 표정을 서로 다르게 골라요.' },
    ],
  },
  'face-2': {
    checks: [
      { label: '표정 바로 아래마다 일시중지 넣기(4곳 이상)', rule: { in: 'start', pairs: { a: 'SCREEN:PIC', b: 'WAIT', min: 4 } } },
      { label: '쉬는 시간을 1초(1000ms)쯤으로 정하기', rule: { in: 'start', has: 'WAIT', value: '>=500', min: 4 } },
    ],
    scenarios: [
      { name: 'faces', label: '표정 5가지', run: { ms: 9000 }, expect: { screen: { distinct: 5 } },
        msg: '쉬는 시간을 넣은 뒤에도 서로 다른 표정 5가지가 차례로 나와야 해요.' },
    ],
  },
  'touch-1': {
    checks: [
      { label: '"로고 터치되면 실행" 블록 꺼내기', rule: { event: 'logo' } },
      { label: '그 안에 소리 재생 블록 넣기', rule: { in: 'logo', has: 'SOUND*' } },
      { label: '그 안에 숫자 출력 + 1~100 무작위 수 넣기', rule: { all: [{ in: 'logo', has: 'SCREEN:number' }, { scenario: 'touch' }] } },
    ],
    scenarios: [
      { name: 'touch', label: '로고: 소리와 1~100 수', given: { random: 'min' }, run: { ms: 4000, press: [{ btn: 'logo', at: 100 }] }, expect: { screen: { has: { number: 1 } }, sound: { played: true } },
        msg: '로고를 터치하면 소리가 나고 1~100 사이 무작위 수가 화면에 나와야 해요. 무작위 수 범위가 1부터 100까지인지 봐요.' },
    ],
  },
});
