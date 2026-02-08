/**
 * Nuestra carretera — Mini-juego romántico
 * Canvas: coche en carretera infinita, eventos por distancia, historia desde story.json
 */

(function () {
  'use strict';

  // ========== CONSTANTES ==========
  const STORY_URL = 'story.json';
  const BASE_SPEED = 2.2;
  const BOOST_SPEED = 5;
  const ROAD_TOP_RATIO = 0.52;         // inicio de la carretera (horizontal, abajo)
  const LANE_LINE_SPACING = 70;
  const LANE_LINE_LENGTH = 32;
  const LANE_LINE_WIDTH = 5;
  const PARALLAX_MOUNTAINS = 0.12;
  const PARALLAX_HILLS = 0.35;
  const PARALLAX_GROUND = 0.5;
  const MOUNTAIN_SEGMENT_W = 900;
  const HILL_SEGMENT_W = 500;
  const CAR_VERTICAL_SPEED = 3.2;   // unidades por frame (60fps)
  const CAR_VERTICAL_MARGIN = 28;   // margen desde el borde de la carretera
  const HEART_SPAWN_INTERVAL = 400; // distancia entre corazones
  const HEART_SPAWN_AHEAD = 380;    // distancia por delante al generar (aparecen antes)
  const HEART_COLLISION_X = 58;    // si el corazón entra en esta zona del coche = colisión (muy permisivo)
  const HEART_COLLISION_Y = 34;    // cubre toda la silueta del coche

  // Imágenes que se muestran al recoger un corazón (añade las rutas que quieras)
  const HEART_IMAGES = [
    'assets/images/heart1.jpg',
    'assets/images/heart2.jpg',
    'assets/images/heart3.jpg',
    'assets/images/heart4.jpg',
    'assets/images/heart5.jpg',
    'assets/images/heart6.jpg',
    'assets/images/heart7.jpg',
    'assets/images/heart8.jpg',
    'assets/images/heart9.jpg',
  ];

  // ========== ESTADO DEL JUEGO ==========
  const state = {
    canvas: null,
    ctx: null,
    width: 0,
    height: 0,
    distance: 0,
    speed: BASE_SPEED,
    accelerating: false,
    carOffsetY: 0,      // desplazamiento vertical del coche (0 = centro del carril)
    moveUp: false,
    moveDown: false,
    story: { events: [] },
    nextEventIndex: 0,
    paused: false,
    animationId: null,
    hearts: [],              // { distance, offsetY } en la carretera
    lastHeartSpawnDistance: -HEART_SPAWN_AHEAD, // primer corazón visible desde el inicio, un poco por delante
    heartPopupVisible: false,
  };

  // ========== DOM ==========
  const dom = {
    overlay: null,
    card: null,
    title: null,
    text: null,
    mediaWrap: null,
    image: null,
    video: null,
    videoPlayBtn: null,
    btnContinue: null,
    hint: null,
    heartOverlay: null,
    heartPopupImage: null,
    heartPopupClose: null,
  };

  const AUTOPLAY_DELAY_MS = 2000;
  let autoplayTimeoutId = null;

  // ========== INICIALIZACIÓN ==========

  function init() {
    state.canvas = document.getElementById('game-canvas');
    if (!state.canvas) return;

    state.ctx = state.canvas.getContext('2d');
    dom.overlay = document.getElementById('story-overlay');
    dom.card = document.getElementById('story-card');
    dom.title = document.getElementById('story-title');
    dom.text = document.getElementById('story-text');
    dom.mediaWrap = document.getElementById('story-media-wrap');
    dom.image = document.getElementById('story-image');
    dom.video = document.getElementById('story-video');
    dom.videoPlayBtn = document.getElementById('story-video-play');
    dom.btnContinue = document.getElementById('story-continue');
    dom.hint = document.getElementById('hint');
    dom.heartOverlay = document.getElementById('heart-popup-overlay');
    dom.heartPopupImage = document.getElementById('heart-popup-image');
    dom.heartPopupClose = document.getElementById('heart-popup-close');

    if (dom.heartPopupClose) dom.heartPopupClose.addEventListener('click', onHeartPopupClose);
    if (dom.videoPlayBtn) dom.videoPlayBtn.addEventListener('click', onVideoPlayClick);
    if (dom.video) {
      dom.video.addEventListener('play', onVideoPlay);
      dom.video.addEventListener('pause', onVideoPause);
    }

    resize();
    window.addEventListener('resize', resize);

    // Controles: Espacio = acelerar; W/↑ = subir; S/↓ = bajar
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    if (dom.btnContinue) dom.btnContinue.addEventListener('click', onContinue);

    loadStory().then(() => {
      sortEvents();
      gameLoop();
    }).catch(console.error);
  }

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    state.width = state.canvas.clientWidth;
    state.height = state.canvas.clientHeight;
    state.canvas.width = state.width * dpr;
    state.canvas.height = state.height * dpr;
    state.ctx.scale(dpr, dpr);
  }

  // ========== STORY ==========

  function loadStory() {
    return fetch(STORY_URL)
      .then(r => r.json())
      .then(data => {
        state.story = data;
        return data;
      });
  }

  function sortEvents() {
    state.story.events.sort((a, b) => a.distance - b.distance);
  }

  function getNextEvent() {
    const events = state.story.events;
    if (state.nextEventIndex >= events.length) return null;
    return events[state.nextEventIndex];
  }

  function triggerEvent(event) {
    state.paused = true;
    cancelAutoplay();

    if (dom.title) dom.title.textContent = event.title;
    if (dom.text) dom.text.textContent = event.text;

    if (dom.image) dom.image.classList.remove('active');
    if (dom.video) {
      dom.video.classList.remove('active');
      dom.video.pause();
      dom.video.removeAttribute('src');
      dom.video.load();
      if (dom.videoPlayBtn) dom.videoPlayBtn.classList.add('hidden');
    }

    if (event.video) {
      dom.mediaWrap.classList.remove('hidden');
      dom.video.classList.add('active');
      dom.video.src = event.video;
      dom.video.muted = false;
      dom.video.setAttribute('playsinline', '');
      if (dom.card) dom.card.classList.add('has-image');
      scheduleVideoAutoplay();
    } else if (event.image) {
      dom.mediaWrap.classList.remove('hidden');
      dom.image.classList.add('active');
      dom.image.src = event.image;
      dom.image.alt = event.title;
      if (dom.card) dom.card.classList.add('has-image');
    } else {
      dom.mediaWrap.classList.add('hidden');
      dom.image.src = '';
      if (dom.card) dom.card.classList.remove('has-image');
    }

    const isLastEvent = state.nextEventIndex === state.story.events.length - 1;
    if (dom.overlay) {
      if (isLastEvent) dom.overlay.classList.add('final-event');
      else dom.overlay.classList.remove('final-event');
    }

    dom.overlay.classList.remove('hidden');
    dom.overlay.classList.add('visible');
    document.body.classList.add('overlay-visible');

    requestAnimationFrame(() => requestAnimationFrame(() => {}));
  }

  function scheduleVideoAutoplay() {
    cancelAutoplay();
    autoplayTimeoutId = setTimeout(() => {
      autoplayTimeoutId = null;
      if (!dom.video || !dom.mediaWrap || dom.mediaWrap.classList.contains('hidden')) return;
      dom.video.play().catch(() => {
        if (dom.videoPlayBtn) dom.videoPlayBtn.classList.remove('hidden');
      });
    }, AUTOPLAY_DELAY_MS);
  }

  function cancelAutoplay() {
    if (autoplayTimeoutId) {
      clearTimeout(autoplayTimeoutId);
      autoplayTimeoutId = null;
    }
  }

  function onVideoPlayClick() {
    if (!dom.video) return;
    dom.video.play().catch(() => {});
    if (dom.videoPlayBtn) dom.videoPlayBtn.classList.add('hidden');
  }

  function onVideoPlay() {
    if (dom.videoPlayBtn) dom.videoPlayBtn.classList.add('hidden');
  }

  function onVideoPause() {
    // Solo mostrar botón si el overlay sigue visible y el video no ha terminado por cierre
    if (state.paused && dom.overlay && dom.overlay.classList.contains('visible') && dom.video && !dom.video.ended) {
      if (dom.videoPlayBtn) dom.videoPlayBtn.classList.remove('hidden');
    }
  }

  function onHeartPopupClose() {
    if (dom.heartOverlay) {
      dom.heartOverlay.classList.remove('visible');
      dom.heartOverlay.classList.add('hidden');
    }
    document.body.classList.remove('overlay-visible');
    state.heartPopupVisible = false;
    state.paused = false;
  }

  function onContinue() {
    cancelAutoplay();
    if (dom.video) {
      dom.video.pause();
      dom.video.removeAttribute('src');
      dom.video.load();
      if (dom.videoPlayBtn) dom.videoPlayBtn.classList.add('hidden');
    }
    dom.overlay.classList.remove('visible', 'final-event');
    dom.overlay.classList.add('hidden');
    document.body.classList.remove('overlay-visible');
    state.nextEventIndex += 1;
    state.paused = false;
  }

  // ========== INPUT ==========

  function onKeyDown(e) {
    if (e.code === 'Space') {
      e.preventDefault();
      state.accelerating = true;
      return;
    }
    if (e.code === 'KeyW' || e.code === 'ArrowUp') {
      e.preventDefault();
      state.moveUp = true;
      return;
    }
    if (e.code === 'KeyS' || e.code === 'ArrowDown') {
      e.preventDefault();
      state.moveDown = true;
    }
  }

  function onKeyUp(e) {
    if (e.code === 'Space') {
      e.preventDefault();
      state.accelerating = false;
      return;
    }
    if (e.code === 'KeyW' || e.code === 'ArrowUp') {
      e.preventDefault();
      state.moveUp = false;
      return;
    }
    if (e.code === 'KeyS' || e.code === 'ArrowDown') {
      e.preventDefault();
      state.moveDown = false;
    }
  }

  // ========== UPDATE ==========

  function update(dt) {
    if (state.paused) return;

    const speed = state.accelerating ? BOOST_SPEED : BASE_SPEED;
    state.speed = speed;
    state.distance += speed * (dt / 16);

    // Movimiento vertical del coche en la carretera (W/↑ arriba, S/↓ abajo)
    const roadTop = state.height * ROAD_TOP_RATIO;
    const roadHeight = state.height - roadTop;
    const maxOffset = Math.max(0, roadHeight / 2 - CAR_VERTICAL_MARGIN);
    if (state.moveUp) state.carOffsetY -= CAR_VERTICAL_SPEED * (dt / 16);
    if (state.moveDown) state.carOffsetY += CAR_VERTICAL_SPEED * (dt / 16);
    state.carOffsetY = Math.max(-maxOffset, Math.min(maxOffset, state.carOffsetY));

    const next = getNextEvent();
    if (next && state.distance >= next.distance) {
      triggerEvent(next);
      return;
    }

    // Corazones: generar, eliminar los pasados y comprobar colisión
    while (state.distance - state.lastHeartSpawnDistance >= HEART_SPAWN_INTERVAL) {
      state.lastHeartSpawnDistance += HEART_SPAWN_INTERVAL;
      const spawnDistance = state.lastHeartSpawnDistance + HEART_SPAWN_AHEAD;
      state.hearts.push({
        distance: spawnDistance,
        offsetY: (Math.random() * 2 - 1) * maxOffset * 0.85,
      });
    }
    state.hearts = state.hearts.filter((h) => h.distance > state.distance - 80);

    const carX = state.width * 0.28;
    const carY = roadTop + roadHeight / 2 + state.carOffsetY;
    for (let i = state.hearts.length - 1; i >= 0; i--) {
      const h = state.hearts[i];
      const hx = carX + (h.distance - state.distance);
      const hy = roadTop + roadHeight / 2 + h.offsetY;
      if (Math.abs(hx - carX) < HEART_COLLISION_X && Math.abs(hy - carY) < HEART_COLLISION_Y) {
        state.hearts.splice(i, 1);
        if (HEART_IMAGES.length > 0) {
          state.paused = true;
          state.heartPopupVisible = true;
          const src = HEART_IMAGES[Math.floor(Math.random() * HEART_IMAGES.length)];
          if (dom.heartPopupImage) dom.heartPopupImage.src = src;
          if (dom.heartOverlay) {
            dom.heartOverlay.classList.remove('hidden');
            dom.heartOverlay.classList.add('visible');
          }
          document.body.classList.add('overlay-visible');
        }
        break;
      }
    }
  }

  // ========== RENDER (separación clara) ==========

  function render() {
    const { ctx, width, height, distance } = state;
    if (!ctx || width <= 0 || height <= 0) return;

    const roadTop = height * ROAD_TOP_RATIO;
    const roadHeight = height - roadTop;

    // 1. Cielo (gradiente horizontal suave, atardecer/amanecer)
    drawSky(ctx, width, height);

    // 2. Montañas lejanas (parallax lento)
    drawMountains(ctx, width, height, roadTop, distance * PARALLAX_MOUNTAINS);

    // 3. Colinas y terreno medio (parallax medio)
    drawHills(ctx, width, height, roadTop, distance * PARALLAX_HILLS);

    // 4. Franja de suelo junto a la carretera (parallax)
    drawGroundStrip(ctx, width, height, roadTop, distance * PARALLAX_GROUND);

    // 5. Carretera horizontal (banda abajo)
    drawRoad(ctx, width, height, roadTop, roadHeight);

    // 6. Líneas de carril (rayas verticales que se mueven)
    drawLaneLines(ctx, width, height, roadTop, roadHeight);

    // 6.5 Corazones en la carretera
    drawHearts(ctx, width, height, roadTop, roadHeight);

    // 7. Coche (vista lateral, fijo en X)
    drawCar(ctx, width, height, roadTop, roadHeight);
  }

  function drawHearts(ctx, width, height, roadTop, roadHeight) {
    const carX = width * 0.28;
    const centerY = roadTop + roadHeight / 2;
    const scale = Math.min(width, height) / 420;
    const heartSize = 14;

    state.hearts.forEach((h) => {
      const hx = carX + (h.distance - state.distance);
      const hy = centerY + h.offsetY;
      if (hx < -30 || hx > width + 30) return;

      ctx.save();
      ctx.translate(hx, hy);
      ctx.scale(scale, scale);
      ctx.font = `${heartSize}px serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#ff6b9d';
      ctx.strokeStyle = '#e5558a';
      ctx.lineWidth = 2;
      ctx.strokeText('♥', 0, 0);
      ctx.fillText('♥', 0, 0);
      ctx.restore();
    });
  }

  function drawSky(ctx, width, height) {
    const g = ctx.createLinearGradient(0, 0, 0, height);
    g.addColorStop(0, '#87CEEB');
    g.addColorStop(0.4, '#b8d4e8');
    g.addColorStop(0.7, '#e8d4c4');
    g.addColorStop(1, '#c9b8a8');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, width, height);

    // Nubes suaves (parallax muy lento)
    const cloudOffset = (state.distance * 0.05) % (width + 200);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
    drawCloud(ctx, -cloudOffset + 50, height * 0.18, 50);
    drawCloud(ctx, -cloudOffset + width * 0.4, height * 0.12, 40);
    drawCloud(ctx, -cloudOffset + width * 0.75, height * 0.22, 45);
    drawCloud(ctx, -cloudOffset + width + 100, height * 0.15, 38);
  }

  function drawCloud(ctx, x, y, size) {
    ctx.beginPath();
    ctx.arc(x, y, size * 0.5, 0, Math.PI * 2);
    ctx.arc(x + size * 0.5, y - size * 0.1, size * 0.45, 0, Math.PI * 2);
    ctx.arc(x + size * 0.9, y, size * 0.5, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawMountains(ctx, width, height, roadTop, offset) {
    const segW = MOUNTAIN_SEGMENT_W;
    const baseY = roadTop + 30;
    const o = offset % segW;

    // Capa lejana (más oscura, atrás)
    ctx.fillStyle = '#8b9ba8';
    for (let i = -1; i <= Math.ceil(width / segW) + 1; i++) {
      const x0 = i * segW - o;
      ctx.beginPath();
      ctx.moveTo(x0, height + 20);
      ctx.lineTo(x0 + 120, baseY + 80);
      ctx.lineTo(x0 + 280, baseY + 40);
      ctx.lineTo(x0 + 400, baseY + 100);
      ctx.lineTo(x0 + 550, baseY + 30);
      ctx.lineTo(x0 + segW + 50, height + 20);
      ctx.closePath();
      ctx.fill();
    }

    // Capa delantera (un poco más clara)
    ctx.fillStyle = '#9aaab8';
    for (let i = -1; i <= Math.ceil(width / segW) + 1; i++) {
      const x0 = i * segW - o + 80;
      ctx.beginPath();
      ctx.moveTo(x0, height + 20);
      ctx.lineTo(x0 + 100, baseY + 120);
      ctx.lineTo(x0 + 220, baseY + 60);
      ctx.lineTo(x0 + 380, baseY + 90);
      ctx.lineTo(x0 + 500, baseY + 50);
      ctx.lineTo(x0 + segW, height + 20);
      ctx.closePath();
      ctx.fill();
    }
  }

  function drawHills(ctx, width, height, roadTop, offset) {
    const segW = HILL_SEGMENT_W;
    const baseY = roadTop + 10;
    const o = offset % segW;

    // Colinas verdes (más cercanas, tono pastel)
    ctx.fillStyle = '#a8c4a0';
    for (let i = -1; i <= Math.ceil(width / segW) + 1; i++) {
      const x0 = i * segW - o;
      ctx.beginPath();
      ctx.moveTo(x0 - 20, height + 20);
      ctx.lineTo(x0 + 80, baseY + 60);
      ctx.lineTo(x0 + 200, baseY + 25);
      ctx.lineTo(x0 + 320, baseY + 55);
      ctx.lineTo(x0 + segW + 40, height + 20);
      ctx.closePath();
      ctx.fill();
    }

    ctx.fillStyle = '#b5d0ac';
    for (let i = -1; i <= Math.ceil(width / segW) + 1; i++) {
      const x0 = i * segW - o + 150;
      ctx.beginPath();
      ctx.moveTo(x0, height + 20);
      ctx.lineTo(x0 + 120, baseY + 45);
      ctx.lineTo(x0 + 280, baseY + 70);
      ctx.lineTo(x0 + segW + 50, height + 20);
      ctx.closePath();
      ctx.fill();
    }
  }

  function drawGroundStrip(ctx, width, height, roadTop, offset) {
    const stripHeight = 36;
    const stripY = roadTop - stripHeight;
    const o = (offset * 0.5) % 100;
    ctx.fillStyle = '#b8a878';
    for (let x = -o; x < width + 100; x += 100) {
      ctx.fillRect(x, stripY, 50, stripHeight);
    }
    ctx.fillStyle = '#c9b896';
    for (let x = -o + 50; x < width + 100; x += 100) {
      ctx.fillRect(x, stripY, 50, stripHeight);
    }
  }

  function drawRoad(ctx, width, height, roadTop, roadHeight) {
    // Sombra sutil bajo el borde
    ctx.fillStyle = 'rgba(0, 0, 0, 0.06)';
    ctx.fillRect(0, roadTop - 2, width, roadHeight + 4);

    // Asfalto (gradiente vertical para dar volumen)
    const g = ctx.createLinearGradient(0, roadTop, 0, height);
    g.addColorStop(0, '#7a8594');
    g.addColorStop(0.3, '#8b96a5');
    g.addColorStop(0.7, '#7a8594');
    g.addColorStop(1, '#6a7584');
    ctx.fillStyle = g;
    ctx.fillRect(0, roadTop, width, roadHeight);

    // Bordes blancos (línea continua arriba, abajo)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(0, roadTop);
    ctx.lineTo(width, roadTop);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, height);
    ctx.lineTo(width, height);
    ctx.stroke();
  }

  function drawLaneLines(ctx, width, height, roadTop, roadHeight) {
    const centerY = roadTop + roadHeight / 2;
    const offset = state.distance % LANE_LINE_SPACING;

    ctx.strokeStyle = '#f5e6a8';
    ctx.lineWidth = LANE_LINE_WIDTH;
    ctx.lineCap = 'round';

    for (let x = -offset; x < width + LANE_LINE_SPACING; x += LANE_LINE_SPACING) {
      ctx.beginPath();
      ctx.moveTo(x, centerY - LANE_LINE_LENGTH / 2);
      ctx.lineTo(x, centerY + LANE_LINE_LENGTH / 2);
      ctx.stroke();
    }
  }

  function drawCar(ctx, width, height, roadTop, roadHeight) {
    const carX = width * 0.28;
    const carY = roadTop + roadHeight * 0.5 + state.carOffsetY;
    const scale = Math.min(width, height) / 420;

    ctx.save();
    ctx.translate(carX, carY);
    ctx.scale(scale, scale);

    const bounce = state.accelerating ? Math.sin(Date.now() / 70) * 1.2 : 0;
    ctx.translate(0, bounce);

    // Vista lateral tipo Lamborghini / deportivo: bajo, cuña, angular
    const strokeW = 2;
    const pink = '#ff9ebb';
    const pinkDark = '#ff6b9d';
    const pinkLight = '#ffb3cc';
    const windowC = '#c4e4f0';
    const wheelC = '#2d3748';
    const rimC = '#6b7280';

    // 1. Cuerpo inferior (cuña: nariz baja, línea de techo atrás)
    ctx.fillStyle = pink;
    ctx.strokeStyle = pinkDark;
    ctx.lineWidth = strokeW;
    ctx.beginPath();
    ctx.moveTo(-42, 10);
    ctx.lineTo(-38, 14);
    ctx.lineTo(38, 14);
    ctx.lineTo(42, 10);
    ctx.lineTo(40, 6);
    ctx.lineTo(28, 4);
    ctx.lineTo(-20, 4);
    ctx.lineTo(-28, 8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 2. Cabina (techo bajo y angular, tipo superdeportivo)
    ctx.fillStyle = pinkLight;
    ctx.beginPath();
    ctx.moveTo(18, 4);
    ctx.lineTo(22, -14);
    ctx.lineTo(-8, -18);
    ctx.lineTo(-28, -8);
    ctx.lineTo(-28, 4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 3. Parabrisas
    ctx.fillStyle = windowC;
    ctx.strokeStyle = '#8b9cb5';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(16, 4);
    ctx.lineTo(20, -12);
    ctx.lineTo(-6, -16);
    ctx.lineTo(-24, 4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 4. Ventanilla lateral
    ctx.beginPath();
    ctx.moveTo(-24, 4);
    ctx.lineTo(-6, -16);
    ctx.lineTo(-22, -6);
    ctx.lineTo(-26, 4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 5. Ruedas (grandes, deportivas)
    const wheelY = 14;
    const wheelR = 12;
    const rimR = 5;
    [-26, 26].forEach((wx) => {
      ctx.fillStyle = wheelC;
      ctx.strokeStyle = '#1a202c';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(wx, wheelY, wheelR, wheelR * 1.1, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = rimC;
      ctx.beginPath();
      ctx.ellipse(wx, wheelY, rimR, rimR * 1.1, 0, 0, Math.PI * 2);
      ctx.fill();
    });

    // 6. Detalle frontal (rejilla / faro)
    ctx.fillStyle = '#1a202c';
    ctx.beginPath();
    ctx.moveTo(38, 8);
    ctx.lineTo(42, 10);
    ctx.lineTo(42, 12);
    ctx.lineTo(38, 10);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = pinkDark;
    ctx.stroke();

    ctx.fillStyle = '#fff8dc';
    ctx.beginPath();
    ctx.ellipse(40, 9, 4, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // 7. Pequeño alerón trasero (opcional, estilo deportivo)
    ctx.fillStyle = pinkDark;
    ctx.strokeStyle = '#e5558a';
    ctx.beginPath();
    ctx.moveTo(-42, 6);
    ctx.lineTo(-46, 2);
    ctx.lineTo(-38, 2);
    ctx.lineTo(-38, 8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.restore();
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  // ========== GAME LOOP ==========

  let lastTime = 0;

  function gameLoop(now = 0) {
    const dt = Math.min(now - lastTime, 64);
    lastTime = now;
    update(dt);
    render();
    state.animationId = requestAnimationFrame(gameLoop);
  }

  // Arrancar cuando el DOM está listo
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
