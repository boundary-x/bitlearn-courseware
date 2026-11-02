'use strict';
/* 비트런 8화 미션 채점 규칙 v2(차시 파일): 키 = 미션 id, 라벨·순서 = js/lesson.js checks(check-lesson이 확인).
 * 엔진(2026-11-01, planning/bitrun/45-engine-impl.md)이 서보·로고 터치를 안다: 토큰 SERVO:run·SERVO:stop, 이벤트 'logo', 시나리오 expect.servos·run.press 'logo'.
 * 빛 밝기는 given.lightLevel(0~255). 기준값은 모둠마다 달라(정답 50 = 원본 PPT, 깜깜 = 0) 시나리오는 아주 어두움 5·아주 밝음 250으로 본다.
 * "그리고"(&&)는 토큰으로 가릴 수 없어 lesson.js 미션 order(정규식)도 함께 막고, 동작은 시나리오(허락 없이 어두움·허락하고 밝음 → 멈춤)로 본다.
 * 흔한 오답: 아니면 칸이 비어 있음(밝아져도 걸음) → bright, "또는" → noPermit·brightPermit, 로고에 허락 ← 거짓 없음 → logoStop, 아니면 칸 지우기를 그대로 둠 → heart. */
(function (M) {
  if (typeof module === 'object' && module.exports) module.exports = M;
  else window.PB_MISSIONS = Object.assign(window.PB_MISSIONS || {}, M);
})((() => {
  const L = { pins: ['P0', 'P1'], label: '왼쪽 다리' }, R = { label: '오른쪽 다리(P2)' };
  const fwd = { left: Object.assign({ sign: '+' }, L), P2: Object.assign({ sign: '-' }, R) };
  const allStop = { all: { stopped: true } };
  const measure = { name: 'measure', label: 'A: 빛 밝기 재기', given: { lightLevel: 50 }, run: { ms: 6000, press: [{ btn: 'A', at: 100 }] }, expect: { screen: { has: { number: 50 }, empty: true } },
    msg: '빛 밝기가 {value}일 때 A를 누르면 화면에 빛 밝기 값({value})이 나오고, 잠시 뒤 화면이 지워져야 해요.' };
  const dark = { name: 'dark', label: '어두우면 걷기', given: { lightLevel: 5 }, run: { ms: 2000, press: [{ btn: 'A', at: 200 }] }, expect: { servos: fwd },
    msg: '빛 밝기가 {value}(아주 어두움)이면 앞으로 걸어야 해요(왼쪽 +, 오른쪽 −, 지금 {servos}). 만약 조건이 "밝기 < 기준값"인지 봐요.' };
  const bright = { name: 'bright', label: '밝아지면 멈춤', given: { lightLevel: [5, 5, 5, 5, 5, 250] }, run: { ms: 2000, press: [{ btn: 'A', at: 100 }] }, expect: { servos: allStop },
    msg: '어두워서 걷다가 빛 밝기가 250(아주 밝음)이 되면 두 다리가 멈춰야 해요(지금 {servos}). "아니면" 칸에 두 "서보 정지"가 있는지 봐요.' };
  // 허락(변수) 미션: A = 허락 참, 로고·B = 허락 거짓
  const noPermit = { name: 'noPermit', label: '허락 없으면 그대로', given: { lightLevel: 5 }, run: { ms: 1500 }, expect: { servos: { all: { moved: false } } },
    msg: '어두워도 A로 허락하기 전에는 걸으면 안 돼요. 조건이 "밝기 < 기준값 그리고 허락"인지 봐요("또는"이면 허락 없이도 걸어요).' };
  const permit = { name: 'permit', label: 'A로 허락하면 걷기', given: { lightLevel: 5 }, run: { ms: 1500, press: [{ btn: 'A', at: 200 }] }, expect: { servos: fwd },
    msg: '어두울 때 A를 눌러 허락하면 앞으로 걸어야 해요(지금 {servos}). A 버튼 안에 "허락에 참 저장"이 있는지 봐요.' };
  const brightPermit = { name: 'brightPermit', label: '밝으면 허락해도 그대로', given: { lightLevel: 250 }, run: { ms: 1500, press: [{ btn: 'A', at: 200 }] }, expect: { servos: { all: { moved: false } } },
    msg: '밝을 때는 A로 허락해도 걸으면 안 돼요. 조건이 "그리고"인지 봐요.' };
  // 800ms와 같은 시각에 예약된 반복은 로고 처리보다 먼저 실행될 수 있다. 처리 직후 801ms부터 이동 이력과 이동 시간을 함께 검사한다.
  const logoStop = { name: 'logoStop', label: '로고: 허락 거두고 멈춤', given: { lightLevel: 5 }, run: { ms: 5000, press: [{ btn: 'A', at: 200 }, { btn: 'logo', at: 800 }] }, expect: { servos: { all: { stopped: true, moved: false, runMs: 0, from: 801, to: 5000 } } },
    msg: '걷는 중에 로고를 터치하면 멈추고 계속 멈춰 있어야 해요(지금 {servos}). 로고 안에 "허락에 거짓 저장"과 두 "서보 정지"를 넣어요.' };
  const restart = { name: 'restart', label: '로고 뒤 A로 다시 출발', given: { lightLevel: 5 }, run: { ms: 5000, press: [{ btn: 'A', at: 200 }, { btn: 'logo', at: 800 }, { btn: 'A', at: 3000 }] }, expect: { servos: fwd }, msg: '로고로 멈춘 뒤 A를 다시 눌러야 어두울 때 출발해요.' };
  const heart = { name: 'heart', label: 'B: 멈추고 하트', given: { lightLevel: 5 }, run: { ms: 5000, press: [{ btn: 'A', at: 200 }, { btn: 'B', at: 900 }] }, expect: { servos: allStop, screen: { end: 'Heart' } },
    msg: '걷다가 B를 누르면 멈추고 하트가 계속 보여야 해요(지금 {servos}). "아니면" 칸의 LED 스크린 지우기를 빼야 하트가 남아요.' };
  return {
    'dark-1': {
      checks: [
        { label: 'A를 누르면 빛 밝기를 수 출력으로 띄우기', rule: { in: 'A', all: [{ has: 'SCREEN:number' }, { sensor: 'light' }] } },
        { label: '수 출력 아래에 LED 스크린 지우기', rule: { in: 'A', order: ['SCREEN:number', 'SCREEN:clear'] } },
        { label: '빛을 재는 동안 표정 블록은 넣지 않기', rule: { in: 'A', none: 'SCREEN:icon*|SCREEN:leds*' } },
      ],
      scenarios: [measure],
    },
    'dark-2': {
      checks: [
        { label: '무한반복 안에서 변수 밝기에 빛 밝기 저장하기', rule: { in: 'forever', all: [{ has: 'SET:*' }, { sensor: 'light' }] } },
        { label: '만약 밝기가 기준값보다 작으면 앞으로 가기', rule: { in: 'forever', all: [{ cond: { sensor: 'light', op: '<|<=' } }, { branch: { then: 'SERVO:run' } }, { scenario: 'dark' }] } },
        { label: '아니면 칸에 화면 지우고 두 다리 멈추기', rule: { in: 'forever', all: [{ branch: { else: 'SCREEN:clear' } }, { branch: { else: 'SERVO:stop' } }, { scenario: 'bright' }] } },
        { label: '준비된 안전 스위치: 로고 뒤 멈춤 유지, A로 다시 출발', rule: { all: [{ scenario: 'noPermit' }, { scenario: 'brightPermit' }, { scenario: 'logoStop' }, { scenario: 'restart' }] } },
      ],
      scenarios: [dark, bright, noPermit, brightPermit, logoStop, restart],
    },
    'dark-3': {
      checks: [
        { label: 'A를 누르면 허락에 참 저장하기(빛 재기 블록은 빼기)', rule: { in: 'A', all: [{ has: 'SET:*' }, { none: 'SCREEN:number' }] } },
        { label: '로고를 터치하면 허락에 거짓 저장하고 멈추기', rule: { all: [{ in: 'logo', has: 'SET:*' }, { scenario: 'logoStop' }] } },
        { label: '조건을 "밝기 < 기준값 그리고 허락"으로 바꾸기', rule: { all: [{ in: 'forever', cond: { sensor: 'light', op: '<|<=' } }, { scenario: 'noPermit' }, { scenario: 'permit' }, { scenario: 'brightPermit' }, { scenario: 'bright' }, { scenario: 'restart' }] } },
      ],
      scenarios: [noPermit, permit, brightPermit, bright, logoStop, restart],
    },
    'dark-4': {
      checks: [
        { label: 'B를 누르면 허락에 거짓 저장, 멈추고 하트 표정', rule: { in: 'B', all: [{ has: 'SET:*' }, { has: 'SCREEN:icon:Heart' }, { has: 'SERVO:stop' }] } },
        { label: 'A를 누르면 화면도 지우기', rule: { all: [{ in: 'A', all: [{ has: 'SET:*' }, { has: 'SCREEN:clear' }] }, { scenario: 'noPermit' }, { scenario: 'permit' }, { scenario: 'brightPermit' }, { scenario: 'bright' }, { scenario: 'logoStop' }, { scenario: 'restart' }] } },
        { label: '아니면 칸의 LED 스크린 지우기는 빼기', rule: { all: [{ in: 'forever', none: 'SCREEN:clear' }, { scenario: 'heart' }] } },
      ],
      scenarios: [noPermit, permit, brightPermit, bright, heart, logoStop, restart],
    },
  };
})());
