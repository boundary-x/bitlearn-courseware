'use strict';
/* 비트런 4화 미션 채점 규칙 v2: 키 = 미션 id, 라벨·순서는 js/lesson.js checks 그대로(check-lesson이 확인).
 * 소리 크기(input.soundLevel, given.soundLevel 0~255)·버튼·음 연주·LED 화면은 엔진이 안다 → 시나리오로 판정.
 * 녹음(record.*, audio-recording 확장): 엔진(2026-11-01, planning/bitrun/45-engine-impl.md)이 호출을 기록한다 — 토큰 REC:start·REC:play(블록·TS 둘 다), 시나리오 expect.record { started, played, playAt }.
 *   흔한 오답: 비교 기호 > → quiet, 아니면 칸에 녹음 시작 → loudRec, 녹음 재생을 SOS보다 위에 둠 → sos(playAt).
 * 기준값 128은 체크에 묶지 않는다(조건 모양은 '소리 크기 <'만). 시나리오 값 40(조용)·200(시끄러움)은 기준 30~190 어디든 같은 답.
 * 브라우저: window.PB_MISSIONS에 더한다 / Node: require */
(function (M) {
  if (typeof module === 'object' && module.exports) module.exports = M;
  else window.PB_MISSIONS = Object.assign(window.PB_MISSIONS || {}, M);
})((() => {
  const REC = 'REC:start';
  const PLAY = 'REC:play';
  const quiet = { name: 'quiet', label: '조용할 때 체크', given: { soundLevel: 40 }, run: { ms: 2500, press: [{ btn: 'A', at: 100 }] }, expect: { screen: { has: 'Yes' } },
    msg: '소리 크기가 {value}(조용함)일 때 A를 누르면 "만약" 칸으로 가서 체크(맞음)가 보여야 해요. 비교 기호가 < 인지 봐요.' };
  const loud = { name: 'loud', label: '시끄러울 때 표시', given: { soundLevel: 200 }, run: { ms: 2500, press: [{ btn: 'A', at: 100 }] }, expect: { screen: { empty: false } },
    msg: '소리 크기가 {value}(시끄러움)일 때 A를 누르면 "아니면" 칸의 \'조용히!\' 표정이 보여야 해요.' };
  const quietRec = { name: 'quietRec', label: '조용할 때 녹음', given: { soundLevel: 40 }, run: { ms: 2500, press: [{ btn: 'A', at: 100 }] }, expect: { record: { started: true } },
    msg: '소리 크기가 {value}(조용함)일 때 A를 누르면 "만약" 칸의 녹음 시작이 실행되어야 해요.' };
  const loudRec = { name: 'loudRec', label: '시끄러우면 녹음 안 함', given: { soundLevel: 200 }, run: { ms: 2500, press: [{ btn: 'A', at: 100 }] }, expect: { record: { started: false } },
    msg: '소리 크기가 {value}(시끄러움)일 때는 녹음하지 않아요. 녹음 시작은 "만약" 칸에만 두고, "아니면" 칸에는 알림 표정만 넣어요.' };
  return {
    'snd-1': {
      checks: [
        { label: '"A 버튼 누를 때" 블록 꺼내기', rule: { event: 'A' } },
        { label: '그 안에 음 연주 블록 3개 이상 넣기', rule: { in: 'A', has: 'SOUND*', min: 3 } },
      ],
      scenarios: [
        { name: 'callA', label: 'A를 누르면 음 3개 이상', run: { ms: 6000, press: [{ btn: 'A', at: 100 }] }, expect: { sound: { beeps: '>=3' } },
          msg: 'A를 누르면 음이 3번 이상 울려야 해요(지금 {beeps}번). 음 높이를 서로 다르게 골라 봐요.' },
      ],
    },
    'sos-1': {
      checks: [
        { label: '"A 버튼 누를 때" 안에 만약 ~ 이면 넣기', rule: { in: 'A', has: 'IF' } },
        { label: '조건: 소리 크기 < 기준값', rule: { in: 'A', cond: { sensor: 'sound', op: '<|<=' } } },
        { label: '"만약" 칸에 체크 표시와 녹음 시작 넣기', rule: { in: 'A', all: [{ branch: { then: REC } }, { branch: { then: 'SCREEN:PIC' } }] } },
        { label: '조용할 때(소리 크기 40) 체크가 보여요', rule: { scenario: 'quiet' } },
      ],
      scenarios: [quiet, quietRec, loudRec],
    },
    'sos-2': {
      checks: [
        { label: '"만약" 블록에 "아니면" 칸 열기', rule: { in: 'A', has: 'ELSE' } },
        { label: '"아니면" 칸에 \'조용히!\' 표정 넣기', rule: { in: 'A', branch: { else: 'SCREEN:PIC' } } },
        { label: '시끄러울 때(소리 크기 200) 화면에 표시가 나와요', rule: { scenario: 'loud' } },
      ],
      scenarios: [quiet, loud, quietRec, loudRec],
    },
    'sos-3': {
      checks: [
        { label: '"B 버튼 누를 때" 안에 문자열 출력 "SOS" 넣기', rule: { in: 'B', has: 'SCREEN:string' } },
        { label: '사이렌 음 2개 이상 넣기', rule: { in: 'B', has: 'SOUND*', min: 2 } },
        { label: '녹음 재생 블록 넣기', rule: { in: 'B', has: PLAY } },
      ],
      scenarios: [
        quiet, loud, quietRec, loudRec,
        // 녹음 재생은 SOS 글자·사이렌 뒤(호출음이 먼저 — 이야기). 재생이 1초 안에 시작하면 맨 위에 둔 것
        { name: 'sos', label: 'B: SOS와 사이렌, 그 뒤 녹음 재생', run: { ms: 9000, press: [{ btn: 'B', at: 100 }] }, expect: { screen: { has: { text: 'SOS' } }, sound: { beeps: '>=2' }, record: { played: true, playAt: '>=1000' } },
          msg: 'B를 누르면 화면에 SOS가 흐르고 사이렌이 2번 이상 울린 뒤 녹음이 재생되어야 해요(지금 {beeps}번). 녹음 재생은 맨 아래에 둬요.' },
      ],
    },
  };
})());
