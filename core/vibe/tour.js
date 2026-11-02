const STUDIO_TOUR_STEPS = [
  { target: 'studio-header', title: 'MakeCode 프로젝트 열기', body: '먼저 Chrome에서 MakeCode for micro:bit 프로젝트를 여세요. 새 프로젝트와 기존 프로젝트 모두 사용할 수 있습니다. 이 사이드패널에서 요청을 보내면 생성한 코드가 해당 프로젝트에 반영됩니다.' },
  { target: 'product-tabs', title: '사용할 제품 선택하기', body: '위 탭에서 실제 사용하는 제품을 선택하세요. MakeCode 프로젝트에도 해당 제품의 확장 블록을 추가하세요. 선택한 제품을 기준으로 코드가 생성됩니다.' },
  { target: 'access-settings', title: '접속키 입력하기', body: '오른쪽 위 설정 버튼을 누르고 안내받은 접속키를 입력한 뒤 “확인 및 닫기”를 누르세요. 사이드패널이 다시 로드되면 접속키를 다시 입력해야 합니다.' },
  { target: 'code-context', title: '코드 작성 방식 선택하기', body: '입력창 위 드롭다운의 기본값은 “자동 — 현재 코드에 맞춰 작성”입니다. 빈 프로젝트는 새로 만들고, 코드가 있으면 추가·수정합니다. 기존 코드를 교체하려면 “처음부터 새로 만들기”, 동작 문제를 설명하려면 “동작 문제 해결하기”를 선택하세요. 새로 만들기는 다음 요청 한 번에만 적용됩니다.' },
  { target: 'prompt-composer', title: '요청 입력하고 전송하기', body: '입력창에 “A 버튼을 누르면 전진해줘”처럼 동작 조건과 수행할 동작을 적으세요. 전송 버튼이나 Enter를 누르면 요청을 보냅니다. 줄바꿈은 Shift+Enter를 사용하세요. 반영 결과는 MakeCode에서 확인하세요.' },
  { target: 'chat-history', title: '오류 수정 방법 선택하기', body: '블록 변환 실패 안내가 나타나면 “오류 자동 수정하기”를 눌러 입력 없이 수정을 요청하세요. 동작 문제를 설명하려면 “문제 설명하고 수정하기”를 누른 뒤 원하는 동작과 실제 동작의 차이를 입력하세요.' },
  { target: 'code-tools', title: '코드 설명 및 보조 기능 사용하기', body: '현재 MakeCode 코드의 설명을 보려면 “설명”을 누르세요. 자동 반영에 실패했을 때는 “생성 코드 복사”로 생성 결과를 복사할 수 있습니다. 휴지통 버튼은 대화를 초기화하며, MakeCode 코드는 삭제하지 않습니다.' }
];

function StudioTour({ onClose }) {
  const [step, setStep] = React.useState(0);
  const [layout, setLayout] = React.useState(null);
  const cardRef = React.useRef(null);
  const closeRef = React.useRef(null);
  React.useEffect(() => {
    const previous = document.activeElement;
    const app = document.getElementById('studio-content');
    if (app) app.inert = true;
    closeRef.current?.focus();
    const onKey = event => {
      if (event.key === 'Escape') { event.preventDefault(); onClose(); }
      if (event.key === 'Tab') {
        const buttons = [...cardRef.current.querySelectorAll('button:not(:disabled)')];
        const index = buttons.indexOf(document.activeElement);
        event.preventDefault();
        buttons[(index + (event.shiftKey ? -1 : 1) + buttons.length) % buttons.length]?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); if (app) app.inert = false; previous?.focus(); };
  }, []);
  React.useEffect(() => {
    const measure = () => {
      const target = document.querySelector('[data-tour="' + STUDIO_TOUR_STEPS[step].target + '"]');
      const r = target?.getBoundingClientRect();
      const width = Math.max(180, Math.min(360, window.innerWidth - 24));
      const height = cardRef.current?.offsetHeight || 250;
      const rect = r ? { left: Math.max(4, r.left - 4), top: Math.max(4, r.top - 4), width: Math.min(r.width + 8, window.innerWidth - 8), height: Math.min(r.height + 8, window.innerHeight - 8) } : null;
      let top = r && r.bottom + height + 20 < window.innerHeight ? r.bottom + 12 : (r ? r.top - height - 12 : 16);
      top = Math.max(12, Math.min(top, window.innerHeight - height - 12));
      setLayout({ rect, card: { left: (window.innerWidth - width) / 2, top, width } });
    };
    measure();
    const observer = new ResizeObserver(measure);
    if (cardRef.current) observer.observe(cardRef.current);
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => { observer.disconnect(); window.removeEventListener('resize', measure); window.removeEventListener('scroll', measure, true); };
  }, [step]);
  const item = STUDIO_TOUR_STEPS[step];
  return React.createElement('div', { className: 'studio-tour' },
    React.createElement('div', { className: 'tour-backdrop', 'aria-hidden': true }),
    layout?.rect && React.createElement('div', { className: 'tour-highlight', style: layout.rect, 'data-target': item.target, 'aria-hidden': true }),
    React.createElement('section', { className: 'tour-card', ref: cardRef, style: layout?.card, role: 'dialog', 'aria-modal': true, 'aria-labelledby': 'tour-title', 'aria-describedby': 'tour-body' },
      React.createElement('div', { className: 'tour-topline' }, React.createElement('span', null, '사용법 알아보기 · ' + (step + 1) + ' / ' + STUDIO_TOUR_STEPS.length), React.createElement('button', { type: 'button', ref: closeRef, onClick: onClose, 'aria-label': '사용법 안내 닫기' }, '닫기 ×')),
      React.createElement('div', { 'aria-live': 'polite' }, React.createElement('h2', { id: 'tour-title' }, item.title), React.createElement('p', { id: 'tour-body' }, item.body)),
      React.createElement('div', { className: 'tour-actions' },
        React.createElement('button', { type: 'button', disabled: step === 0, onClick: () => setStep(step - 1) }, '이전'),
        React.createElement('button', { type: 'button', className: 'tour-next', onClick: () => step === STUDIO_TOUR_STEPS.length - 1 ? onClose() : setStep(step + 1) }, step === STUDIO_TOUR_STEPS.length - 1 ? '시작하기' : '다음'))));
}
