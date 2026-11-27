// Optional activities: stored separately from story position and quiz answers.
const asset = path => new URL('../assets/' + path, import.meta.url).href;
const photo = asset('brand/bitrun/photo/br-front34-l.png');
const parts = {
  microbit: ['micro:bit', '코드를 받아 비트런이 할 일을 정해요.'],
  battery: ['건전지 자리', '건전지를 넣어 모터를 움직일 전기를 공급해요.'],
  'servo-left': ['왼쪽 서보모터', '축을 돌려 왼쪽 다리를 움직여요.'],
  'servo-right': ['오른쪽 서보모터', '축을 돌려 오른쪽 다리를 움직여요.'],
  'leg-left': ['왼쪽 다리', '서보모터의 움직임을 받아 바닥을 디뎌요.'],
  'leg-right': ['오른쪽 다리', '다른 쪽 다리와 함께 몸을 받쳐요.'],
  body: ['몸체', '여러 부품을 제자리에 고정해요.'],
};
function shell(el, title, intro) {
  if (!document.querySelector('link[data-bitrun-interactive]')) {
    const link = document.createElement('link'); link.rel = 'stylesheet'; link.dataset.bitrunInteractive = '';
    link.href = new URL('../css/bitrun-interactive.css', import.meta.url).href; document.head.append(link);
  }
  el.innerHTML = `<section class="br-interactive"><h3>${title}</h3><p>${intro}</p><div class="br-stage"><div class="br-fallback"></div><div class="br-scene" hidden></div></div><div class="br-controls"><button type="button" data-action="load">3D로 살펴보기</button></div><p class="br-load-note" role="status"></p><div class="br-activity"></div></section>`;
  const root = el.firstElementChild, scene = root.querySelector('.br-scene');
  const fallback = root.querySelector('.br-fallback');
  let view, disposed = false, onDispose = () => {};
  const observer = new MutationObserver(() => { if (!el.isConnected) dispose(); });
  observer.observe(document.body, { childList: true, subtree: true });
  function dispose() { if (disposed) return; disposed = true; observer.disconnect(); view?.dispose(); onDispose(); }
  async function load(mode, onPart, ready) {
    const button = root.querySelector('[data-action="load"]'), note = root.querySelector('.br-load-note');
    button.disabled = true; note.textContent = '3D 비트런을 불러오고 있어요…';
    try {
      const { createView } = await import('./bitrun-three-view.js');
      if (disposed) return;
      scene.hidden = false;
      view = await createView(scene, { mode, onPart });
      if (disposed) { view.dispose(); return; }
      fallback.hidden = true; button.hidden = true; note.textContent = '제공된 비트런 모듈의 모습이에요. 앞쪽의 추가 센서는 이번 기본 조립 활동에서 사용하지 않아요.';
      scene.querySelector('canvas')?.addEventListener('webglcontextlost', () => {
        scene.hidden = true; fallback.hidden = false; note.textContent = '그림 화면으로 바꿨어요. 아래 단추로 계속 체험할 수 있어요.';
      });
      ready?.(view);
    } catch {
      scene.hidden = true; fallback.hidden = false; button.disabled = false;
      note.textContent = '이 기기에서는 3D를 열지 못했어요. 그림과 아래 단추로 계속 체험해요.';
    }
  }
  return { root, fallback, load, get view() { return view; }, cleanup(fn) { onDispose = fn; } };
}
export function mountParts(el, opts, ctx) {
  const ui = shell(el, '비트런을 돌려 보며 살펴봐요', '부품 이름을 눌러 하는 일을 알아봐요. 3D 화면에서는 로봇을 끌어서 돌리거나 부품을 직접 누를 수 있어요.');
  ui.fallback.innerHTML = `<img src="${photo}" alt="실제 비트런 로봇">`;
  const saved = ctx.data?.().bitrunParts || {}, seen = new Set(saved.seen || []);
  ui.root.querySelector('.br-activity').innerHTML = `<div class="br-controls">${Object.entries(parts).map(([id, p]) => `<button type="button" data-part="${id}" aria-pressed="false">${p[0]}</button>`).join('')}</div><p data-status role="status">살펴보고 싶은 부품을 골라요.</p><div class="br-controls"><button type="button" data-action="left">왼쪽으로 돌리기</button><button type="button" data-action="right">오른쪽으로 돌리기</button><button type="button" data-action="reset">처음 모습</button></div><small>로봇을 돌려 가려진 부품도 살펴봐요. 조립 순서는 다음 설명을 따라요.</small>`;
  function select(id) {
    if (id.startsWith('cam-')) id = id.replace('cam-', 'leg-');
    if (!parts[id]) id = 'body';
    seen.add(id); ui.view?.selectPart(id);
    for (const b of ui.root.querySelectorAll('[data-part]')) b.setAttribute('aria-pressed', String(b.dataset.part === id));
    ui.root.querySelector('[data-status]').textContent = `${parts[id][0]}: ${parts[id][1]} (${seen.size}/${Object.keys(parts).length}개 살펴봤어요)`;
    ctx.setData?.({ bitrunParts: { seen: [...seen], selected: id } });
  }
  const viewButtons = [...ui.root.querySelectorAll('[data-action="left"], [data-action="right"], [data-action="reset"]')];
  viewButtons.forEach(b => { b.disabled = true; });
  ui.root.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.part) select(b.dataset.part);
    const action = b.dataset.action;
    if (action === 'load') ui.load('parts', select, () => { viewButtons.forEach(b => { b.disabled = false; }); if (saved.selected) select(saved.selected); });
    if (action === 'left') ui.view?.rotate(-.4);
    if (action === 'right') ui.view?.rotate(.4);
    if (action === 'reset') ui.view?.resetCamera();
  });
  if (saved.selected) select(saved.selected);
}
export function mountCorridor(el, opts, ctx) {
  const ui = shell(el, '다시 해 보기 · 우리도 발판까지 보내 볼까요?', '도윤: 비트런이 발판 위에서 멈추도록 도와줘! 먼저 한 걸음씩 움직이며 거리를 살펴보자.');
  ui.root.querySelector('[data-action="load"]').textContent = '복도를 3D로 보기';
  ui.fallback.innerHTML = `<div class="br-lane" aria-label="비트런이 출발점에서 발판으로 가는 길"><span class="br-pad">발판</span><span class="br-beam"></span><img src="${photo}" alt="비트런의 현재 위치" class="br-runner"><span class="br-start">출발</span></div>`;
  ui.root.querySelector('.br-activity').innerHTML = `<div class="br-controls"><button type="button" data-action="step">한 걸음</button><button type="button" data-action="walk">계속 걷기</button><button type="button" data-action="stop" class="br-stop">로고: 멈춤</button><button type="button" data-action="reset">처음부터</button></div><p data-status role="status"></p><p class="br-hint">한 걸음씩 움직이면 매번 멈춰요. 계속 걷기에서는 발판에 도착했을 때 ‘로고: 멈춤’을 눌러요. 화면의 움직임은 관찰용이에요. 실제 로봇은 바닥과 건전지 상태에 따라 다르게 움직일 수 있어요.</p><button type="button" data-action="skip">체험을 건너뛰고 이야기 계속하기</button>`;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  let distance = 0, moving = false, raf = 0, last = 0, success = ctx.data?.().bitrunCorridor?.status === 'success';
  if (success) distance = 4;
  const status = ui.root.querySelector('[data-status]');
  const message = text => { status.textContent = text; };
  const save = state => ctx.setData?.({ bitrunCorridor: { status: state } });
  function draw() {
    ui.root.dataset.distance = distance.toFixed(2); ui.root.dataset.success = String(success);
    ui.root.querySelector('.br-runner').style.bottom = `${8 + distance / 4.8 * 72}%`;
    ui.root.querySelector('.br-beam').hidden = success;
    ui.view?.setRobot({ x: 0, z: -distance, heading: 0, moving }); ui.view?.setGate(success);
  }
  function pause() { moving = false; cancelAnimationFrame(raf); raf = 0; last = 0; draw(); }
  function stop() {
    pause();
    if (distance >= 3.8 && distance <= 4.2) {
      success = true; save('success'); ctx.done?.(); draw(); message('도윤: 발판 위에서 멈췄어! 레이저가 꺼졌어.');
    } else message(distance > 4.2 ? '발판을 지나쳤어요. 처음부터 다시 움직여 볼까요?' : '비트런이 멈췄어요. 발판까지 얼마나 남았는지 살펴봐요.');
  }
  function tick(now) {
    if (!moving) return;
    if (last) distance = Math.min(4.8, distance + Math.min((now - last) / 1000, .1) * .5);
    last = now; draw();
    if (distance >= 4.8) { pause(); message('발판을 지나쳤어요. 처음부터 다시 도전해요.'); return; }
    raf = requestAnimationFrame(tick);
  }
  ui.root.addEventListener('click', e => {
    const action = e.target.closest('button')?.dataset.action;
    if (action === 'load') ui.load('corridor', null, draw);
    if (action === 'step' && !success) { pause(); distance = Math.min(4.8, distance + .4); stop(); }
    if (action === 'walk' && !success && !moving && !reduce.matches && distance < 4.8) { moving = true; message('비트런이 걷고 있어요. 발판에서 로고로 멈춰요.'); raf = requestAnimationFrame(tick); }
    if (action === 'stop') stop();
    if (action === 'reset') { pause(); distance = 0; success = false; draw(); message('출발점으로 돌아왔어요. 다시 해 봐요.'); }
    if (action === 'skip') { pause(); if (!success) save('skipped'); ctx.done?.(); message('체험은 나중에 다시 해도 좋아요. 다음 이야기로 계속해요.'); }
  });
  const visibility = () => { if (document.hidden) { pause(); message('화면을 벗어나 비트런을 멈췄어요.'); } };
  const motion = () => { pause(); ui.root.querySelector('[data-action="walk"]').disabled = reduce.matches; if (reduce.matches) message('움직임 줄이기가 켜져 있어요. 한 걸음씩 체험해요.'); };
  document.addEventListener('visibilitychange', visibility); reduce.addEventListener('change', motion);
  ui.cleanup(() => { pause(); document.removeEventListener('visibilitychange', visibility); reduce.removeEventListener('change', motion); });
  motion(); draw(); if (success) message('발판에 도착했던 체험이에요. 처음부터 다시 해 볼 수도 있어요.');
  else if (!reduce.matches) message('한 걸음을 눌러 비트런을 움직여 봐요.');
}
