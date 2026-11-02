/* AI 포니봇 시리즈 기본값(모든 포니봇 차시가 같음) — 설계 02-split-plan.md 3.4, 결정 D3
 * 차시 js/lesson.js(window.LESSON)와 core/js/lesson-load.js가 합친다: 일반 객체는 깊게 합침, 배열·글자·숫자는 차시 값이 이김,
 * 차시 값이 null이면 기본값을 지움, dependencies는 통째로 바꿈. 차시가 더하려면 [...window.PONYBOT_SERIES.x, …]로 직접 펼친다.
 * (S1-5) 3~4차시 lesson.js에 있던 공통 칸을 그대로 옮겼다.
 * (S2-1) 공통 그림은 core/assets/에 있다. 그림 주소 = CORE(코어 폴더의 절대 주소) + 'assets/…'. 차시 데이터가 코어 그림을 쓸 때는 '../core/assets/…'로 적는다. */
// 코어 폴더 주소: 이 파일(core/js/series.js) 위치에서 찾는다(차시 문서 깊이와 상관없음, S2-3)
window.PONYBOT_CORE = new URL('../', document.currentScript.src).href;
window.PONYBOT_SERIES = ((CORE) => ({
  brand: 'AI 포니봇', // 입장 화면 제목·상단 바·결과 카드·교사 대시보드 아래 문구
  createFilePrefix: '포니봇-자유만들기-', // 자유 만들기 [내 코드 내려받기] 파일 이름 앞머리
  // MakeCode 확장 최소 기본값(차시·실습이 dependencies를 쓰면 통째로 바뀜. 3~4차시는 자기 목록을 그대로 적음)
  dependencies: {
    core: '*',
    'ai-ponybot-basic': 'github:boundary-x/ai_ponybot_basic#v1.3.1',
  },
  /* 로봇 실습 공통(D3): 2단계 실행 줄, 처음 2단계 안전 창, [막혔어요] 로봇 점검 목록 */
  robot: {
    runLine: '포니봇을 <b>바닥</b>에 놓고 <b>전원 스위치</b>를 켜요.', // 2단계 둘째 줄(실습의 runNote가 있으면 그것)
    safetyTitle: '로봇을 움직이기 전에 꼭 지켜요',
    safety: [
      { img: CORE + 'assets/img/gen/safe-floor.webp', html: '<b>바닥</b>에서 실습해요. 책상 위에서는 포니봇이 떨어질 수 있어요.' },
      { img: CORE + 'assets/img/gen/safe-power.webp', html: '다운로드하고 <b>USB를 뺀 다음</b> 포니봇 <b>전원 스위치</b>를 켜요. 전원을 켜야 모터가 움직여요.' },
      { img: CORE + 'assets/img/gen/safe-hands.webp', html: '코드를 고칠 때는 전원을 끄고, 바퀴를 손으로 막지 않아요.' },
    ],
    trouble: [
      '<b>전원</b>: 포니봇 전원 스위치가 켜져 있나요?',
      '<b>시작 방법</b>: 버튼 코드는 A나 B 버튼을 눌러야 움직여요. 시작하면 코드는 마이크로비트 뒷면 리셋 버튼을 누르면 다시 시작해요.',
      '<b>다운로드</b>: 보낼 때 마이크로비트 뒷면 노란 불이 깜빡였나요? 안 깜빡였다면 다시 다운로드해요.',
      '<b>회색 블록</b>: 회색 블록은 실행되지 않아요. 맨 위 블록 안에 끼워요.',
      '<b>배터리</b>: 모터 힘이 약하면 배터리를 충전해요.',
      '<b>속도</b>: 이동 블록의 속도가 너무 작으면(대략 30보다 작으면) 모터에서 ‘삐~’ 소리만 나고 움직이지 않아요. 속도를 30 이상으로 올려요.',
      '<b>마이크로비트</b>: 포니봇에 끝까지 꽂혀 있나요? 다시 꽂을 때는 포니봇 전원을 끄고 꽂아요.',
    ],
    // '그래도 안 되면 (선생님과 함께)'. {driveGuide} 자리에 [드라이브로 보내는 방법] 단추(실행 방법 창에 drive 탭이 있을 때만)
    troubleMore: [
      'USB 케이블이 충전 전용이 아닌지 확인해요.',
      '바로 보내기가 안 되면 다운로드한 파일을 MICROBIT 드라이브로 끌어다 놓아요.{driveGuide}',
    ],
  },
  /* 블록 찾기 (planning/block-finder.md §8): 블록 사전. 미션별 필요 블록(missionBlocks)은 차시 lesson.js, 차시가 쓰는 새 블록은 차시 blockDict에 더함(깊게 합침).
   * drawer/group 은 MakeCode 연결 전 고정 안내(실행 중에는 도구상자 색인으로 덮어씀). far: 서랍을 아래로 내려야 보임 */
  blockDict: {
    'pxt-on-start': { label: '시작하면', drawer: '기본', search: '시작하면', hat: true },
    device_forever: { label: '무한반복', drawer: '기본', search: '무한반복', hat: true },
    device_pause: { label: '일시중지 (ms)', drawer: '기본', search: '일시중지' },
    device_button_event: { label: 'A 버튼 누를 때', drawer: '입력', search: '버튼', hat: true },
    aiponybot_motor_runNormal: { label: '포니봇 ↑ 방향 0 속도로 이동', drawer: 'AI ponybot', group: '모터 제어(기초)', search: '포니봇' },
    aiponybot_motor_stopAllMotors: { label: '모든 모터 정지', drawer: 'AI ponybot', group: '모터 제어(기초)', search: '모든 모터 정지' },
    aiponybot_motor_runMecanum: { label: '메카넘 ↖ 방향 0 속도로 이동', drawer: 'AI ponybot', group: '모터 제어(기초)', search: '메카넘' },
    aiponybot_motor_runMotor: { label: '모터 1 모터 정회전 방향 0 속도로 회전', drawer: 'AI ponybot', group: '모터 제어(심화)', search: '모터' },
    aiPonybot_printNumber: { label: '숫자 출력 - 내용, 줄바꿈', drawer: 'AI ponybot', group: '디스플레이 제어(데이터)', search: '줄바꿈', far: true },
    aiPonybot_showNumber: { label: '숫자 출력 - 내용, 위치, 색상', drawer: 'AI ponybot', group: '디스플레이 제어(데이터)', search: '숫자 출력', far: true },
    aiPonybot_showString: { label: '문장 출력 - 내용, 위치, 색상', drawer: 'AI ponybot', group: '디스플레이 제어(데이터)', search: '문장 출력', far: true },
    aiPonybot_rectangle: { label: '사각형 출력', drawer: 'AI ponybot', group: '디스플레이 제어(도형)', search: '사각형', far: true },
    aiPonybot_horizontalLine: { label: '수평선 출력', drawer: 'AI ponybot', group: '디스플레이 제어(도형)', search: '수평선', far: true },
    aiPonybot_verticalLine: { label: '수직선 출력', drawer: 'AI ponybot', group: '디스플레이 제어(도형)', search: '수직선', far: true },
    aiPonybot_clear: { label: '디스플레이 지우기', drawer: 'AI ponybot', group: '디스플레이 제어', search: '디스플레이 지우기', far: true },
  },

  /* 교사 대시보드 공통 안내: 학교망 허용 주소(실습 화면 막힘 안내도 같은 목록), 기록 보관, 바이브코딩, 투사 */
  teacherGuide: {
    /* 수행평가 안내(P12·8): 빈 기본값. 차시가 글(HTML 한 줄씩)로 채운다 — 교사 대시보드 '수행평가에 쓰려면' 카드(비면 카드째 숨김).
     * 권장 칸: ① 관찰(시연 + 질문 1~2개, 예: "기준값을 왜 그 값으로 했나요?") ② 산출물(측정 기록표 + 코드 + 설명 1문장)
     * ③ 상·중·하 채점 기준 예시 ④ 결과 카드 활용(통과 방식·열어 본 힌트 단계·측정 기록은 참고 자료, 단독 근거 아님) */
    assess: [],
    network: {
      intro: '수업 전에 학교망에서 아래 주소가 열려야 해요. "꼭" 표시는 막히면 실습을 할 수 없는 주소예요. 목록을 복사해 정보부·교육청에 허용을 요청하고(며칠 걸릴 수 있어요), 학생 PC에서 접속 점검으로 확인해요. MakeCode 주소는 micro:bit 공식 지원 문서의 허용 목록을 따랐고, 공식 점검 페이지에서도 확인할 수 있어요.',
      hosts: [
        { host: 'makecode.microbit.org', use: '코딩 화면(MakeCode)', must: true, probe: 'https://makecode.microbit.org/favicon.ico' },
        { host: 'makecode.com', use: 'MakeCode', must: true, probe: 'https://makecode.com/favicon.ico' },
        { host: 'pxt.azureedge.net', use: 'MakeCode 파일', must: true, probe: 'https://pxt.azureedge.net/favicon.ico' },
        { host: 'cdn.makecode.com', use: 'MakeCode 파일', must: true, probe: 'https://cdn.makecode.com/favicon.ico' },
        { host: 'trg-microbit.userpxt.io', use: 'MakeCode 실행', must: true, probe: 'https://trg-microbit.userpxt.io/favicon.ico' },
        { host: 'www.pxt.io', use: 'MakeCode', must: true, probe: 'https://www.pxt.io/favicon.ico' },
        { host: 'pxt.microbit.org', use: 'MakeCode(옛 주소 · https로는 점검할 수 없어 점검 생략)', must: true, probe: null },
        { host: 'api.github.com', use: '포니봇 확장 블록', must: true, probe: 'https://api.github.com/favicon.ico' },
        { host: 'github.com', use: '확장 블록 원본', must: true, probe: 'https://github.com/favicon.ico' },
        { host: 'cdn.jsdelivr.net', use: '글꼴(선택)', must: false, probe: 'https://cdn.jsdelivr.net/favicon.ico' },
        { host: 'cdnjs.cloudflare.com', use: '원리 보기 애니메이션(선택)', must: false, probe: 'https://cdnjs.cloudflare.com/favicon.ico' },
        { host: 'www.youtube-nocookie.com', use: '사례 영상(선택)', must: false, probe: 'https://www.youtube-nocookie.com/favicon.ico' },
        { host: 'vibe-coding-proxy-750635720830.asia-northeast3.run.app', use: '바이브코딩(쓸 때만)', must: false, probe: 'https://vibe-coding-proxy-750635720830.asia-northeast3.run.app/favicon.ico' },
      ],
      testPage: 'https://makecode.microbit.org/domains',
      // {hosts} 자리에 호스트 목록(한 줄에 하나)을 넣는다
      copyText: '안녕하세요. 정보·로봇 수업(AI 포니봇·마이크로비트)에서 학생 PC의 크롬·엣지 브라우저로 쓰는 아래 주소의 접속(https) 허용을 요청드립니다.\n\n{hosts}\n\n"꼭" 표시는 막히면 수업을 할 수 없는 주소입니다. MakeCode 주소는 micro:bit 공식 지원 문서(support.microbit.org)의 허용 목록을 따랐고, https://makecode.microbit.org/domains 에서 접속 여부를 확인할 수 있습니다.',
    },
    records: [
      '진행 기록은 학생 기기의 브라우저에만 저장돼요. 기기나 브라우저를 바꾸면 처음부터 시작해요.',
      '30일 넘게 쓰지 않은 기록은 앱이 열릴 때 그 기기에서 지워져요. 방학·시험 기간 전에 결과 카드를 인쇄해 두세요.',
      '복원 프로그램이 있는 컴퓨터실 PC는 다시 켜면 기록이 지워질 수 있어요. 같은 날 이어서 하거나, 차시 끝에 결과 카드를 인쇄·사진으로 남겨요.',
      '크롬북 게스트 모드나 시크릿 창은 창을 닫으면 기록이 남지 않아요.',
      '공용 기기는 수업 끝에 [나가기]를 눌러요. 기록을 지우려면 결과 카드의 [이 기기에서 내 기록 지우기]를 눌러요.',
    ],
    vibe: [
      '만 14세 미만 학생은 학교·교육청의 생성형 AI 지침과 보호자 동의를 먼저 확인해요. 초등은 교사 시연을 권장해요.',
      '처음 한 번은 교사가 시연하며 "예측 → 요청 → 설명 → 값 바꾸기" 순서를 보여 줘요.',
      '요청 한 번에 동작 하나만 부탁하게 해요(예: "A 버튼을 누르면 오른쪽 옆으로 1초").',
      '받은 코드를 짝에게 설명하지 못하면 다운로드 전에 멈추고 [설명]으로 함께 읽어요.',
      '학교망에서 바이브코딩 주소(허용 주소 목록의 마지막 줄)가 막혀 있으면 스튜디오가 응답하지 않아요.',
    ],
    present: '화면 배치는 그대로 두고, 화면 폭에 맞춰 전체를 키워(1.1~1.5배) 전자칠판에 띄워요. 1366 노트북을 미러링해 글씨가 작으면 브라우저 확대(Ctrl +)를 한두 번 눌러요. 정답과 교사 메모는 숨겨져 있다가 위쪽 [정답 보이기]를 누르면 보이고, 페이지를 넘기면 다시 숨겨져요. 클리커(PageDown·PageUp)나 키보드 ← →로 넘겨요.',
  },

  /* 9차 D2: 학생 "로봇에서 실행하는 방법" 창 — 확인되지 않은 하드웨어 사항(전원 스위치 방향 등)은 넣지 않음 */
  runGuide: {
    title: '로봇에서 실행하는 방법',
    tabs: [
      {
        id: 'first', label: '처음 한 번: 연결하기',
        steps: [
          '포니봇 <b>전원 스위치</b>를 꺼 둬요.',
          'USB 케이블로 컴퓨터와 <b>마이크로비트 뒷면 위쪽 가운데</b> 단자를 이어요. 충전 전용이 아닌 데이터 케이블이어야 해요.',
          '아래 보라색 <b>[다운로드]</b>를 눌러요.',
          '"연결" 창이 뜨면 목록에서 <b>BBC micro:bit</b>을 골라 [연결]을 눌러요. 한 번 연결하면 다음부터는 보통 바로 보내져요.',
          '마이크로비트 뒷면 <b>노란 불</b>이 깜빡이다 멈출 때까지 기다려요.',
          'USB 케이블을 빼요.',
          '포니봇을 <b>바닥</b>에 내려놓고 전원 스위치를 켜요.',
        ],
        img: CORE + 'assets/img/infographics/ig-09-p.webp',
        alt: '다운로드, 바닥에 놓고 전원 켜기(포니봇 뒤쪽 마이크로비트 아래의 전원 스위치), 버튼 누르기의 3단계와 안전 주의 2가지를 보여 주는 세로 그림',
      },
      {
        id: 'usb', label: '크롬·엣지 (바로 보내기)',
        steps: [
          '한 번 연결한 뒤에는 USB를 꽂고 <b>[다운로드]</b>만 누르면 바로 보내져요.',
          '노란 불 깜빡임이 끝나면 USB를 빼요.',
          '포니봇을 바닥에 놓고 전원 스위치를 켜요. 버튼 코드는 A·B 버튼을 눌러요.',
          '바로 보내기가 안 되면 "윈도우·크롬북 (드라이브로)" 방법을 써요.',
        ],
      },
      {
        id: 'drive', label: '윈도우·크롬북 (드라이브로)',
        steps: [
          '<b>[다운로드]</b>를 눌러 .hex 파일을 내려받아요. 파일은 보통 "다운로드" 폴더에 저장돼요.',
          '파일 탐색기(크롬북은 "파일" 앱)를 열고 "다운로드" 폴더로 가요.',
          '같은 이름의 파일이 여러 개면(이름 뒤 (1), (2)) <b>가장 최근</b>에 받은 파일을 골라요.',
          '그 파일을 <b>MICROBIT</b> 드라이브로 끌어다 놓아요.',
          '노란 불이 깜빡이다 멈추면 끝이에요. 드라이브가 잠깐 사라졌다 다시 보여도 괜찮아요.',
          'USB를 빼고, 포니봇을 바닥에 놓고 전원 스위치를 켜요.',
        ],
      },
      {
        id: 'mac', label: '맥(사파리)',
        steps: [
          '사파리는 바로 보내기를 못 해요. 크롬이나 엣지를 쓸 수 있으면 그쪽이 편해요.',
          '노트북 단자가 USB-C뿐이면 USB-C ↔ 마이크로 USB <b>데이터</b> 케이블(또는 어댑터)이 필요해요.',
          '<b>[다운로드]</b>를 눌러 .hex 파일을 내려받아요("다운로드" 폴더).',
          'Finder를 열고, 그 파일을 왼쪽 목록의 <b>MICROBIT</b>로 끌어다 놓아요.',
          '노란 불이 깜빡이다 멈추면 끝이에요. "디스크를 올바르게 추출하지 않음" 알림이 떠도 괜찮아요.',
          'USB를 빼고, 포니봇을 바닥에 놓고 전원 스위치를 켜요.',
        ],
      },
      {
        id: 'tablet', label: '아이패드·태블릿',
        steps: [
          '아이패드·태블릿 브라우저는 마이크로비트로 <b>바로 보내지 못해요</b>(사파리·크롬 모두).',
          '코드 만들기와 코드 확인(코드를 바꿀 때마다 저절로 확인돼요)은 태블릿에서 해요.',
          '로봇에서 실행할 차례가 되면 선생님이 정한 <b>보내기 자리</b>(크롬·엣지가 있는 노트북·크롬북)로 가요.',
          '코드를 보내기 자리로 옮기는 방법은 선생님 안내를 따라요. 그 자리에서 [다운로드]하고, 노란 불이 멈추면 USB를 빼요.',
          '포니봇을 바닥에 놓고 전원 스위치를 켜요.',
        ],
      },
    ],
    note: '다운로드하는 동안(노란 불이 깜빡이는 동안)에는 USB를 빼지 않아요. 안 움직이면 [막혔어요] → "로봇이 안 움직여요"에서 하나씩 점검해요.',
  },
  /* 9차 D16: 실습 목표 안 — "엔트리를 해 봤다면" 3줄, JavaScript 풀이 안내 */
  entryTips: [
    '엔트리는 ▶로 화면에서 실행하지만, 여기서는 <b>[다운로드]</b>해서 로봇에 보내야 움직여요.',
    '시간은 초가 아니라 <b>ms(밀리초)</b>로 적어요. 1000ms = 1초, 5초는 5000이에요.',
    '"시작하면"은 마이크로비트 <b>전원이 켜질 때</b>(또는 뒷면 리셋 버튼을 누를 때) 한 번 실행돼요.',
  ],
  textCodeNote: '<b>JavaScript</b> 탭으로 풀어도 코드 확인이 저절로 돼요. 블록 탭으로 돌아가면 같은 코드가 블록으로 보여요(MakeCode의 JavaScript는 TypeScript예요).',
  /* 9차 D11: 자유 만들기 [안내] — AI와 만들 때 약속, 만들 거리, 'AI와 만든 기록' 칸 이름 */
  createGuide: {
    rules: [
      'AI에게 부탁하기 전에 어떤 블록이 어떤 순서로 필요할지 먼저 적어요.',
      '받은 코드는 [설명]으로 읽고, 짝에게 한 줄로 설명할 수 있을 때 다운로드해요.',
      '속도·시간 같은 값 하나는 내 손으로 바꿔 실행하고 결과를 비교해요.',
    ],
    ideas: [
      '춤추는 포니봇: 메카넘 방향과 일시중지로 8박자 춤 만들기',
      '지그재그 순찰: 대각선 ↗ ↘를 번갈아 써서 복도를 순찰하기',
      '버튼 리모컨: A는 왼쪽 옆, B는 오른쪽 옆, A+B는 정지',
      'OLED 계기판: 달릴 때는 GO, 멈추면 STOP을 화면에 띄우기',
      '라디오 리모컨: 마이크로비트가 하나 더 있으면 라디오 서랍으로 버튼을 눌러 포니봇 조종하기',
    ],
    log: ['내가 AI에게 요청한 것', 'AI 코드에서 이해한 블록', '내가 직접 고친 것'],
  },
  /* 9차 D4: 3명 이상일 때 셋째 역할 */
  roles: { check: '검사', checkDo: '할 일 목록을 소리 내어 읽고 예측을 적어요', robotStep1: '할 일 목록을 읽어 주고 [블록 찾기]를 맡아요' },
}))(window.PONYBOT_CORE);
