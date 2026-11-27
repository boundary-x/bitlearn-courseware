// Bitrun's own SketchUp mesh, rendered only while its activity is visible.
// The activity owns educational state; this module owns WebGL and camera state.
import * as THREE from '../assets/vendor/three/three.module.js';

import * as CANNON from '../assets/vendor/cannon-es/cannon-es.js';
import { createBitrunModel } from '../assets/brand/bitrun/module/bitrun-model.mjs';
import { createBitrunModules } from '../assets/brand/bitrun/module/bitrun-modules.mjs';
import { createBitrunPhysics } from '../assets/brand/bitrun/module/bitrun-physics.mjs';
import { createCartoonRenderer } from '../assets/brand/bitrun/module/cartoon-renderer.mjs';
const MODEL_URL = new URL('../assets/brand/bitrun/module/model.json', import.meta.url);
const MODULE_IDS = { microbit: 'microbit.main', 'servo-left': 'servo.left', 'servo-right': 'servo.right', line: 'line.front' };

export async function createView(container, options = {}) {
  if (!container || !container.isConnected) throw new Error('활동 화면이 닫혔어요.');
  const controller = new AbortController();
  let disposed = false, raf = 0, renderer = null, resizeObserver = null, intersectionObserver = null;
  let inViewport = true, contextLost = false;
  let scene = null, camera = null, robot = null, stageRobot = null, surfaceTemplate = null;
  let cartoon = null, moduleApi = null, sim = null, visuals = null, accumulator = 0;
  let moving = false, previousTime = 0;
  let yaw = .45, elevation = .31, pointer = null, gateOpen = false;
  const mode = options.mode === 'corridor' ? 'corridor' : 'parts';
  const reduceQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  const reduced = () => !!options.reducedMotion || reduceQuery.matches;
  const resources = new Set(), meshes = [], listeners = [];
  const lasers = [], gatePieces = [], doorPanels = [];
  const target = new THREE.Vector3();
  let robotSize = new THREE.Vector3(1.8, 1, 1), robotCenter = new THREE.Vector3(0, .5, 0);
  const observeRemoval = new MutationObserver(() => { if (!container.isConnected) dispose(); });
  observeRemoval.observe(document.documentElement, { childList: true, subtree: true });

  function listen(element, event, handler, config) {
    element.addEventListener(event, handler, config);
    listeners.push(() => element.removeEventListener(event, handler, config));
  }
  function keep(resource) { resources.add(resource); return resource; }
  function cancelFrame() { if (raf) cancelAnimationFrame(raf); raf = 0; previousTime = 0; }
  function requestRender() {
    if (!disposed && !document.hidden && inViewport && !contextLost && container.isConnected && !raf && renderer) raf = requestAnimationFrame(render);
  }
  function render(time) {
    raf = 0;
    if (disposed || !container.isConnected) { dispose(); return; }
    if (document.hidden || !inViewport || contextLost) { previousTime = 0; return; }
    if (mode === 'corridor' && moving && !reduced()) {
      const dt = previousTime ? Math.min((time - previousTime) / 1000, .05) : 0;
      accumulator += dt;
      while (accumulator >= 1 / 240) { sim.step(1 / 240); accumulator -= 1 / 240; }
      syncModel();
    }
    previousTime = time;
    renderer.setScissorTest(false); renderer.setViewport(0, 0, container.clientWidth, container.clientHeight);
    renderer.setClearColor(mode === 'corridor' ? '#f2ece3' : '#f2f6fc', 1); renderer.clear();
    // One depth buffer and one ink pass: robot and scenery share occlusion and outlines.
    cartoon.render(scene, camera, {width: container.clientWidth, height: container.clientHeight});
    if (mode === 'corridor' && moving && !reduced()) requestRender();
  }
  function updateCamera() {
    if (!renderer || disposed) return;
    const width = Math.max(1, container.clientWidth);
    const height = Math.max(1, container.clientHeight || 360);
    const aspect = width / height;
    if (mode === 'parts') {
      const extentX = robotSize.x;
      const extentY = robotSize.y;
      const half = Math.max(extentY * .75, extentX / aspect * .62, .85);
      camera.left = -half * aspect; camera.right = half * aspect;
      camera.top = half; camera.bottom = -half;
      target.copy(robotCenter);
      camera.position.set(Math.sin(yaw) * Math.cos(elevation) * 7, target.y + Math.sin(elevation) * 7, Math.cos(yaw) * Math.cos(elevation) * 7);
    } else {
      const half = Math.max(2.95, 2.55 / aspect);
      camera.left = -half * aspect; camera.right = half * aspect;
      camera.top = half; camera.bottom = -half;
      target.set(0, .2, -1.9);
      camera.position.set(3.8, 5.6, 4.3);
    }
    camera.left *= 100; camera.right *= 100; camera.top *= 100; camera.bottom *= 100;
    camera.position.multiplyScalar(100); camera.lookAt(target.clone().multiplyScalar(100)); camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
    requestRender();
  }
  function painted(color) {
    // Clone the supplied robot shader, replacing only its per-vertex pigment input.
    // Lighting, saturation, ink-like shading and colour conversion remain identical.
    const material = keep(surfaceTemplate.clone());
    material.vertexColors = false;
    material.vertexShader = 'uniform vec3 objectPigment;\n' + material.vertexShader.replace('pigment=color;', 'pigment=objectPigment;');
    material.uniforms.objectPigment = { value: new THREE.Color(color) };
    return material;
  }
  function box(width, height, depth, color, x, y, z, parent = scene) {
    const mesh = new THREE.Mesh(keep(new THREE.BoxGeometry(width, height, depth)), painted(color));
    mesh.position.set(x, y, z); mesh.receiveShadow = true; parent.add(mesh); return mesh;
  }
  function setSelection(category) {
    if (disposed || !moduleApi) return;
    moduleApi.select(MODULE_IDS[category] || null);
    requestRender();
  }
  function setExploded() {
    // The supplied body has merged meshes; keep its mechanical structure intact.
  }
  function stopLegMotion() {
    accumulator = 0;
  }
  function syncModel() {
    if (!visuals) return;
    const sync = (mesh, body) => {
      mesh.position.set(body.position.x * 1000, body.position.y * 1000 - 30, body.position.z * 1000);
      mesh.quaternion.set(body.quaternion.x, body.quaternion.y, body.quaternion.z, body.quaternion.w);
    };
    sync(visuals.chassisVisual, sim.chassis);
    sim.feet.forEach((f, i) => sync(visuals.footVisuals[i], f.body));
    sim.motors.forEach((m, i) => sync(visuals.rotorVisuals[i], m.rotor));
  }
  function setRobot(state = {}) {
    if (!stageRobot || disposed || mode !== 'corridor') return;
    if (Number.isFinite(state.x)) stageRobot.position.x = state.x;
    if (Number.isFinite(state.z)) stageRobot.position.z = state.z;
    // Heading 0 points down the lane (-Z); positive angles turn left in world space.
    if (Number.isFinite(state.heading)) stageRobot.rotation.y = Math.PI + state.heading;
    if (typeof state.moving === 'boolean') moving = state.moving;
    if (!moving || reduced()) stopLegMotion();
    requestRender();
  }
  function setGate(value) {
    gateOpen = !!value;
    for (const item of lasers) item.visible = !gateOpen;
    for (const item of gatePieces) item.material.uniforms.objectPigment.value.set(gateOpen ? '#54d69d' : '#d99a42');
    for (const [i, panel] of doorPanels.entries()) panel.position.x = (i ? 1 : -1) * (gateOpen ? .88 : .4);
    requestRender();
  }
  function dispose() {
    if (disposed) return;
    disposed = true; controller.abort(); cancelFrame(); observeRemoval.disconnect();
    if (resizeObserver) resizeObserver.disconnect();
    if (intersectionObserver) intersectionObserver.disconnect();
    for (const remove of listeners) remove();
    if (moduleApi) moduleApi.dispose();
    if (cartoon) cartoon.dispose();
    for (const resource of resources) resource.dispose();
    if (scene) scene.clear();
    if (renderer) { renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove(); }
    delete container.dataset.threeReady;
  }

  try {
    const response = await fetch(MODEL_URL, { signal: controller.signal });
    if (!response.ok) throw new Error('비트런 모형을 불러오지 못했어요.');
    const data = await response.json();
    if (disposed || !container.isConnected) throw new Error('활동 화면이 닫혔어요.');
    if (!data.meta || !data.bytes) throw new Error('비트런 모형 자료를 확인해 주세요.');
    scene = new THREE.Scene();
    camera = new THREE.OrthographicCamera(-200, 200, 200, -200, 5, 6000);
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'low-power' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NoToneMapping; renderer.autoClear = false;
    cartoon = createCartoonRenderer(THREE, renderer, {outlinePx: .78});
    const canvas = renderer.domElement;
    canvas.style.cssText = 'display:block;width:100%;height:100%;border-radius:inherit;touch-action:pan-y;';
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', mode === 'parts' ? '돌려 보고 부품을 선택할 수 있는 비트런 3D 모형. 아래 단추로도 조작할 수 있어요.' : '비트런이 발판으로 이동하는 복도. 움직임은 아래 조작 단추로 정해요.');
    canvas.dataset.renderer = 'threejs';
    container.appendChild(canvas);
    stageRobot = new THREE.Group(); robot = new THREE.Group(); robot.scale.setScalar(.01);
    stageRobot.add(robot); scene.add(stageRobot);
    sim = createBitrunPhysics(CANNON, {supported: true, rpm: 20});
    visuals = await createBitrunModel(THREE, data, sim);
    surfaceTemplate = visuals.chassisVisual.children.find(mesh => mesh.material?.isShaderMaterial && !mesh.material.transparent).material;
    robot.add(visuals.chassisVisual, ...visuals.footVisuals, ...visuals.rotorVisuals);
    robot.traverse(object => {
      if (!object.isMesh) return;
      meshes.push(object); resources.add(object.geometry);
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) resources.add(material);
    });
    if (disposed || !container.isConnected) {
      for (const resource of resources) resource.dispose();
      throw new Error('활동 화면이 닫혔어요.');
    }
    syncModel();
    if (mode === 'parts') visuals.chassisVisual.getObjectByName('microbit.ledMatrix.smile').visible = false;
    moduleApi = createBitrunModules({THREE, parent: visuals.chassisVisual, onChange: requestRender});
    const bounds = new THREE.Box3().setFromObject(robot);
    robotSize = bounds.getSize(new THREE.Vector3()); robotCenter = bounds.getCenter(new THREE.Vector3());
    // Keep the provided outline renderer's depth thresholds in original millimetres.
    scene.scale.setScalar(100);
    if (mode === 'parts') {
      const floor = new THREE.Mesh(keep(new THREE.CircleGeometry(4, 64)), painted('#e8eef7'));
      floor.rotation.x = -Math.PI / 2; floor.position.y = -.025; floor.receiveShadow = true; scene.add(floor);
      const ray = new THREE.Raycaster(), point = new THREE.Vector2();
      listen(canvas, 'pointerdown', e => {
        if (e.button !== 0 || pointer) return;
        pointer = { id: e.pointerId, x: e.clientX, y: e.clientY, startX: e.clientX, startY: e.clientY, dragged: false };
        canvas.setPointerCapture(e.pointerId);
      });
      listen(canvas, 'pointermove', e => {
        if (!pointer || pointer.id !== e.pointerId) return;
        const dx = e.clientX - pointer.x, dy = e.clientY - pointer.y;
        if (Math.hypot(e.clientX - pointer.startX, e.clientY - pointer.startY) > 6) pointer.dragged = true;
        if (pointer.dragged) { yaw -= dx * .008; elevation = THREE.MathUtils.clamp(elevation + dy * .004, .08, 1.2); updateCamera(); }
        pointer.x = e.clientX; pointer.y = e.clientY;
      });
      listen(canvas, 'pointerup', e => {
        if (!pointer || pointer.id !== e.pointerId) return;
        const clicked = !pointer.dragged; pointer = null;
        if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
        if (!clicked) return;
        const r = canvas.getBoundingClientRect();
        point.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1);
        ray.setFromCamera(point, camera);
        const picked = moduleApi.pick(ray);
        const hit = ray.intersectObjects(meshes, false)[0];
        let category = picked && Object.keys(MODULE_IDS).find(key => MODULE_IDS[key] === picked.id);
        if (!category && hit) {
          const name = hit.object.name;
          category = name.startsWith('foot.left') ? 'leg-right' : name.startsWith('foot.right') ? 'leg-left' : 'body';
        }
        if (category) { setSelection(category); if (options.onPart) options.onPart(category); }
      });
      listen(canvas, 'pointercancel', () => { pointer = null; });
    } else {
      stageRobot.scale.setScalar(.55); stageRobot.rotation.y = Math.PI;
      // A cutaway laboratory corridor: warm story colours, clear walking lane.
      box(3, .14, 5.8, '#485363', 0, -.1, -1.9);
      for (let z = .5; z > -4.7; z -= .65) box(2.65, .035, .62, '#ab7656', 0, -.012, z);
      box(1.35, .025, 5.1, '#d9a777', 0, .018, -1.9);
      for (const x of [-.7, .7]) box(.035, .018, 5.1, '#ffe1a1', x, .045, -1.9);
      for (const x of [-1.43, 1.43]) {
        const wallHeight = x < 0 ? 1.05 : .18;
        box(.12, wallHeight, 5.8, '#596476', x, wallHeight / 2, -1.9);
        for (let z = .35; z > -4.6; z -= .95) {
          box(.16, wallHeight + .06, .09, '#374454', x, wallHeight / 2, z);
          if (x < 0) box(.025, .34, .08, '#ffbb62', x + .08, .65, z + .28);
        }
      }
      const pad = new THREE.Mesh(keep(new THREE.CylinderGeometry(.44, .48, .045, 40)), painted('#d99a42'));
      pad.position.set(0, .065, -4); scene.add(pad);
      gatePieces.push(pad);
      for (const x of [-1.1, 1.1]) {
        box(.18, 1.4, .2, '#384759', x, .7, -4.6);
        gatePieces.push(box(.045, .9, .025, '#d99a42', x, .75, -4.48));
        for (const z of [-.95, -2.5]) {
          box(.12, 1.05, .12, '#526170', x, .52, z);
          box(.18, .12, .18, '#d99a42', x, .88, z);
        }
      }
      for (const z of [-.95, -2.5]) {
        const beam = new THREE.Mesh(keep(new THREE.CylinderGeometry(.016, .016, 2.2, 8)), painted('#ffbe4f'));
        beam.rotation.z = Math.PI / 2; beam.position.set(0, .88, z); scene.add(beam); lasers.push(beam);
      }
      box(2.34, .14, .2, '#384759', 0, 1.4, -4.6);
      for (const side of [-1, 1]) doorPanels.push(box(.79, 1.24, .08, '#84928d', side * .4, .65, -4.62));
    }
    resizeObserver = new ResizeObserver(updateCamera); resizeObserver.observe(container);
    if (window.IntersectionObserver) {
      intersectionObserver = new IntersectionObserver(entries => {
        inViewport = entries.some(entry => entry.isIntersecting);
        if (inViewport) requestRender(); else cancelFrame();
      });
      intersectionObserver.observe(container);
    }
    listen(document, 'visibilitychange', () => { if (document.hidden) cancelFrame(); else requestRender(); });
    listen(reduceQuery, 'change', () => { if (reduced()) stopLegMotion(); requestRender(); });
    listen(canvas, 'webglcontextlost', event => { event.preventDefault(); contextLost = true; cancelFrame(); });
    listen(canvas, 'webglcontextrestored', () => { contextLost = false; requestRender(); });
    container.dataset.threeReady = mode;
    updateCamera();
    return {
      selectPart: setSelection, explode: setExploded,
      rotate(deltaRadians) { if (!disposed && mode === 'parts' && Number.isFinite(deltaRadians)) { yaw += deltaRadians; updateCamera(); } },
      resetCamera() { if (!disposed) { yaw = .45; elevation = .31; updateCamera(); } },
      setRobot, setGate, dispose,
    };
  } catch (error) { dispose(); throw error; }
}
