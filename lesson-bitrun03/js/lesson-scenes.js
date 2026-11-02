/* 비트런 3화 전용 원리 보기 장면: Motion.register('id', (K, opts) => ({ title, duration, scenes, svg(), build(tl, $, $$) })). K = Motion.kit
 * 코어 라이브러리(../core/js/motion.js·scenes-lib.js)에 있는 id는 다시 등록하지 않는다(D11). 두 번째 차시가 쓰면 같은 id 그대로 코어로 올린다.
 * 쪽에서 고르기: page.motion = 'id', page.motionOpts = {…}. 본문 data-scene 낱말은 그 장면의 scene key여야 한다(check-lesson이 확인). */
