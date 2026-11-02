/* 시리즈 프리셋: AI 비트런(이족보행 로봇, 「연구소 탈출 작전」) — planning/bitrun/40-core-brief.md C1, 기록 41-core-impl.md
 * 차시 js/lesson.js에 series: 'bitrun'을 적으면 core/js/lesson-load.js가 PONYBOT_SERIES(series.js) 위에 이 프리셋을 먼저 합치고, 그 위에 차시를 합친다.
 * 합치기 규칙은 series.js와 같다: 일반 객체는 깊게, 배열·글·수는 위층이 이김, null이면 아래층 값을 지움, dependencies는 통째로.
 * series를 적지 않은 차시(포니봇 lesson01~12)는 이 파일의 영향을 받지 않는다(SERIES_PRESETS에 등록만 함).
 * 내용은 초안이다 — 하드웨어 사실(링비트 쉴드·서보 확장 이름 등)은 차시 담당이 확인해 고친다. 그림은 아직 없어 글만 쓴다(img 없는 safety). */
window.SERIES_PRESETS = Object.assign(window.SERIES_PRESETS || {}, {
  bitrun: ((CORE, S) => {
    // 포니봇 기본 글에서 '포니봇'만 '비트런'으로 바꿔 쓰는 칸(실행 방법 창·학교망 안내). 포니봇 사진이 든 그림은 뺀다
    const swap = (v) => (typeof v === 'string' ? v.replace(/포니봇/g, '비트런') : Array.isArray(v) ? v.map(swap) : v && typeof v === 'object' ? Object.keys(v).reduce((o, k) => { o[k] = swap(v[k]); return o; }, {}) : v);
    const run = swap(S.runGuide || {});
    (run.tabs || []).forEach((t) => { delete t.img; delete t.alt; });
    const net = swap((S.teacherGuide || {}).network || {});
    return {
      brand: 'AI 비트런', // 입장 화면 제목·상단 바·결과 카드·교사 대시보드 아래 문구
      createFilePrefix: '비트런-자유만들기-',
      dependencies: { core: '*' }, // 확장(링비트 쉴드·서보 등)은 차시 담당이 정해 차시·실습 dependencies로 적는다
      theme: { accent: '#2FB78A' }, // 시리즈 강조색(민트, 흰 바탕 글자 대비 3:1 이상). 새 칸(화 지도·스토리 이름표·자물쇠)에만 쓰인다 — 포니봇 화면 색은 그대로
      // 포니봇 전용 코어 그림 키를 시리즈 그림으로 바꿈(app.js ART). 비트런 그림이 생기면 차시·프리셋에서 주소만 바꾼다
      seriesArt: {
        pbDrive: CORE + 'assets/brand/char/boundy-charge.webp', // 안전 약속 창
        pbMaze: CORE + 'assets/brand/char/boundy-find.webp', // 수업 소개 그림(heroArt 기본)
        pbFixPath: CORE + 'assets/brand/char/boundy-fix.webp', // 막혔어요 창
        pbWin: CORE + 'assets/brand/char/boundy-win.webp', // 실습 완주
      },
      gateArt: 'hello', // 입장 화면 캐릭터(ART 키)
      progressWord: '화면 점',
      // 이야기 등장인물(스토리 쪽 말풍선 이름표·색). 차시가 avatar(작은 얼굴 그림)를 더하거나 인물을 더한다
      // 이야기 등장인물(10-story-bible·50-lesson-brief, 메인 2026-11-01): color = 말풍선 테두리·이름표 점 색(이름 글자는 늘 진한 잉크색 — 흰 바탕 대비 4.5:1),
      // avatar = 얼굴 그림(core/assets/brand/bitrun/char/<id>.webp, 없으면 색 원 + 첫 글자). narr = 내레이션 말풍선(이름표 없음). 차시는 같은 키로 덮거나 인물을 더한다
      characters: {
        argo: { name: '아르고', color: '#5BB8F5', avatar: CORE + 'assets/brand/bitrun/char/argo.webp' },
        dr: { name: '박사 안내 AI', color: '#2BB3A3', avatar: CORE + 'assets/brand/bitrun/char/dr.webp' },
        drk: { name: '권현중 박사', color: '#8A6A4F' },
        seoa: { name: '한서아', color: '#F4C430', avatar: CORE + 'assets/brand/bitrun/char/seoa.webp' },
        doyun: { name: '강도윤', color: '#6ABBFC', avatar: CORE + 'assets/brand/bitrun/char/doyun.webp' },
        harin: { name: '윤하린', color: '#FF7F6B', avatar: CORE + 'assets/brand/bitrun/char/harin.webp' },
        junho: { name: '박준호', color: '#3CCB9A', avatar: CORE + 'assets/brand/bitrun/char/junho.webp' },
        captain: { name: '구조대장', color: '#F28C28' },
        bitrun: { name: '비트런', color: '#2FB78A' },
        me: { name: '{이름}', color: '#0472CA' },
        narr: { name: '', narr: true, color: '#5B6578' },
      },
      // 모둠 역할(20-gamification R7·K13·K14): 단서 카드 who 이름표, 수업 소개 '이번 화 역할' 줄(화마다 한 칸 밀림). series.js roles(짝 역할)와 다른 칸
      crew: ['질문', '기록', '행동', '조립'],
      // 탐험대 수첩(K10, 10-story-bible 3절 부품표·화별 '답 한 조각'). 차시 episodeMap.notebook: true일 때 수업 소개·결과 카드에 그림. 저장 없음(current로만)
      notebook: {
        keys: [{ n: 1, name: '목표' }, { n: 2, name: '몸' }, { n: 3, name: '표정' }, { n: 4, name: '목소리' }, { n: 5, name: '멈춤' }, { n: 6, name: '이름표' }, { n: 7, name: '반복' }, { n: 8, name: '규칙' }],
        parts: [
          { name: '두뇌(명령 처리하기)', steps: [[2, 'micro:bit V2']] },
          { name: '움직이는 장치(구동기)', steps: [[2, '연속회전 서보 2개'], [5, '연속회전 서보 2개 + 캠과 다리']] },
          { name: '연결판', steps: [[2, '링비트 쉴드']] },
          { name: '출력(알리기)', steps: [[3, 'LED 25개로 이루어진 화면'], [4, 'LED 25개로 이루어진 화면 + 스피커']] },
          { name: '센서(느끼기)', steps: [[3, '터치 로고'], [4, '터치 로고 · 마이크'], [8, '터치 로고 · 마이크 · 빛(LED 화면)']] },
          { name: '입력(누르기)', steps: [[4, '버튼 A·B'], [5, '버튼 A·B · 로고 = 멈춤 스위치']] },
          { name: '할 수 있는 동작', steps: [[6, '앞으로·뒤로·왼쪽돌기·오른쪽돌기 함수'], [7, '함수 + 천천히 앞으로']] },
          { name: '전원(에너지)', steps: [[2, '뒷면 건전지 자리'], [7, '뒷면 건전지(약하면 느려짐)']] },
        ],
        pieces: [
          'AI는 사람이 준 목표대로 움직여요. 목표를 잘 정해야 해요.',
          '로봇은 부품마다 맡은 일이 있고, AI는 자기가 AI라고 밝혀야 해요.',
          '명령은 순서가 중요하고, 상태를 신호로 알려야 사람이 안심해요.',
          '조건에 따라 다르게 행동하고, 어려울 땐 사람에게 알려요.',
          '로고를 터치하면 멈추도록 먼저 코딩해요. 움직임을 시험하며 코드를 고쳐요.',
          '동작에 필요한 명령을 함수로 묶어요. 함수 이름만 보아도 어떤 동작인지 알 수 있게 지어요.',
          '반복은 편하지만 틀린 규칙도 반복되니 사람이 살펴야 해요.',
          '센서로 알아낸 값에 따라 움직이되, 사람이 허락했는지도 확인해요. 문제가 생기면 목표·자료·규칙을 함께 살펴봐요.',
        ],
      },
      robot: {
        runLine: '비트런을 <b>평평한 바닥이나 책상 가운데</b>에 세우고 <b>전원 스위치</b>를 켜요.',
        safetyTitle: '비트런을 움직이기 전에 꼭 지켜요',
        safety: [
          { html: '<b>평평한 곳 가운데</b>에서 실습해요. 책상 끝에서는 비트런이 넘어지거나 떨어질 수 있어요.' },
          { html: '다운로드하고 <b>USB를 뺀 다음</b> 비트런 <b>전원 스위치</b>를 켜요.' },
          { html: '코드를 고칠 때는 전원을 끄고, 움직이는 다리를 손으로 잡지 않아요.' },
        ],
        trouble: [
          '<b>전원·배터리</b>: 비트런 전원 스위치가 켜져 있나요? 배터리가 약하면 다리가 힘없이 움직여요.',
          '<b>서보 선</b>: 서보모터 선이 쉴드의 맞는 번호 핀에, 색 순서에 맞게 꽂혀 있나요? 거꾸로 꽂으면 움직이지 않아요.',
          '<b>다운로드</b>: 보낼 때 마이크로비트 뒷면 노란 불이 깜빡였나요? 안 깜빡였다면 다시 다운로드해요.',
          '<b>회색 블록</b>: 회색 블록은 실행되지 않아요. 맨 위 블록 안에 끼워요.',
          '<b>마이크로비트 V2</b>: 터치 로고·마이크·스피커는 V2에만 있어요. 뒷면에 스피커 그림이 있는지 확인해요.',
        ],
        troubleMore: [
          'USB 케이블이 충전 전용이 아닌지 확인해요.',
          '바로 보내기가 안 되면 다운로드한 파일을 MICROBIT 드라이브로 끌어다 놓아요.{driveGuide}',
        ],
      },
      // 블록 사전: 포니봇 블록은 지우고(null), 기본 + LED 화면 + 입력(로고 터치·빛 밝기·소리 크기) 블록. input_logo_event id는 [확인 필요](MakeCode 도구상자 색인으로 덮어씀)
      blockDict: Object.assign(
        Object.keys(S.blockDict || {}).filter((k) => /^aipony[bB]ot_|^aiPonybot_/.test(k)).reduce((o, k) => { o[k] = null; return o; }, {}),
        {
          basic_show_icon: { label: '아이콘 출력', drawer: '기본', search: '아이콘' },
          device_show_leds: { label: 'LED 출력', drawer: '기본', search: 'LED 출력' },
          device_print_message: { label: '문자열 출력', drawer: '기본', search: '문자열' },
          device_show_number: { label: '수 출력', drawer: '기본', search: '수 출력' },
          device_clear_display: { label: 'LED 스크린 지우기', drawer: '기본', search: '지우기' },
          input_logo_event: { label: '로고를 터치하면 실행', drawer: '입력', search: '로고', hat: true },
          device_get_light_level: { label: '빛 밝기', drawer: '입력', search: '빛 밝기' },
          device_get_sound_level: { label: '소리 크기', drawer: '입력', search: '소리 크기' },
        },
      ),
      runGuide: run,
      teacherGuide: { network: net },
      createGuide: {
        ideas: [
          '표정 로봇: 로고를 터치할 때마다 비트런 표정이 바뀌게 하기',
          '소리 경비원: 소리가 크면 경고 아이콘을 보여 주기',
          '춤추는 비트런: 함수로 춤 동작을 만들고 반복하기',
        ],
      },
    };
  })(window.PONYBOT_CORE, window.PONYBOT_SERIES || {}),
});
