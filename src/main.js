import * as THREE from 'three';
import { SnakeGame, DIRECTIONS } from './game.js';

// --- Sound Synthesizer (Web Audio API, no external assets needed) ---
class SoundEffects {
  constructor() {
    this.ctx = null;
  }
  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
  }
  playEat() {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(320, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(700, this.ctx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.12);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.12);
  }
  playGameOver() {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(50, this.ctx.currentTime + 0.35);
    gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.35);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.35);
  }
}

// --- Main Application ---
const GRID_SIZE = 20;
const CELL_SIZE = 1.0;
const HALF_GRID = (GRID_SIZE * CELL_SIZE) / 2;

const game = new SnakeGame(GRID_SIZE, '1p');
const sfx = new SoundEffects();

// DOM elements
const container = document.getElementById('game-container');
const mode1pBtn = document.getElementById('mode-1p-btn');
const mode2pBtn = document.getElementById('mode-2p-btn');
const scoreCard1p = document.getElementById('score-card-1p');
const scoreCardP1 = document.getElementById('score-card-p1');
const scoreCardP2 = document.getElementById('score-card-p2');
const scoreCardBest = document.getElementById('score-card-best');
const scoreEl = document.getElementById('current-score');
const p1ScoreEl = document.getElementById('p1-score');
const p2ScoreEl = document.getElementById('p2-score');
const speedEl = document.getElementById('current-speed');
const bestScoreEl = document.getElementById('best-score');
const camToggleBtn = document.getElementById('cam-toggle-btn');
const hintEl = document.querySelector('.controls-hint');
const modal = document.getElementById('game-over-modal');
const modalTitle = document.getElementById('modal-title');
const modalSubtitle = document.getElementById('modal-subtitle');
const modalScore = document.getElementById('modal-score');
const restartBtn = document.getElementById('restart-btn');
const pauseOverlay = document.getElementById('pause-overlay');

function togglePause() {
  if (game.gameOver) return;
  const isPaused = game.togglePause();
  if (pauseOverlay) {
    if (isPaused) pauseOverlay.classList.add('visible');
    else pauseOverlay.classList.remove('visible');
  }
}

let bestScore = parseInt(localStorage.getItem('snake3d_best') || '0', 10);
bestScoreEl.textContent = bestScore;

// --- Speed & Timing ---
const BASE_TICK_MS = 145;
const MIN_TICK_MS = 45;
const MS_PER_APPLE = 2.5;

function getTickInterval() {
  const totalScore = game.mode === '2p' ? (game.scores[0] + game.scores[1]) : game.scores[0];
  const applesEaten = Math.floor(totalScore / 10);
  return Math.max(MIN_TICK_MS, BASE_TICK_MS - applesEaten * MS_PER_APPLE);
}

function updateSpeedDisplay() {
  if (!speedEl) return;
  const currentInterval = getTickInterval();
  const mult = (BASE_TICK_MS / currentInterval).toFixed(1);
  speedEl.textContent = `${mult}x`;
}

// --- Mode Switching ---
function updateHints() {
  if (!hintEl) return;
  if (game.mode === '2p') {
    hintEl.innerHTML = '<strong>Игрок 1</strong>: WASD &bull; <strong>Игрок 2</strong>: Стрелки &bull; <strong>Пробел</strong>: Пауза &bull; <strong>R</strong>: Заново';
  } else if (cameraMode === 'fps') {
    hintEl.innerHTML = '<strong>A / ◀</strong>: Повернуть налево &bull; <strong>D / ▶</strong>: Повернуть направо &bull; <strong>Пробел</strong>: Пауза &bull; <strong>C</strong>: Сменить вид &bull; <strong>R</strong>: Заново';
  } else {
    hintEl.innerHTML = '<strong>WASD / Стрелки</strong>: Поворот &bull; <strong>Пробел</strong>: Пауза &bull; <strong>C</strong>: Сменить вид (3D / Сверху / FPS) &bull; <strong>R</strong>: Заново';
  }
}

function switchMode(newMode) {
  sfx.init();
  game.setMode(newMode);
  if (newMode === '2p') {
    mode1pBtn.classList.remove('active');
    mode2pBtn.classList.add('active');
    scoreCard1p.style.display = 'none';
    scoreCardBest.style.display = 'none';
    scoreCardP1.style.display = 'block';
    scoreCardP2.style.display = 'block';
    if (cameraMode === 'fps') {
      setCameraMode('3d');
    }
    camToggleBtn.style.display = 'none';
  } else {
    mode2pBtn.classList.remove('active');
    mode1pBtn.classList.add('active');
    scoreCard1p.style.display = 'block';
    scoreCardBest.style.display = 'block';
    scoreCardP1.style.display = 'none';
    scoreCardP2.style.display = 'none';
    camToggleBtn.style.display = 'inline-block';
  }
  restartGame();
}

mode1pBtn.addEventListener('click', (e) => { e.currentTarget.blur(); switchMode('1p'); });
mode2pBtn.addEventListener('click', (e) => { e.currentTarget.blur(); switchMode('2p'); });

// --- Camera Modes ---
const CAMERA_MODES = ['3d', 'top', 'fps'];
const CAMERA_LABELS = {
  '3d': '📷 3D (C)',
  'top': '📷 Сверху (C)',
  'fps': '📷 1-е лицо (C)'
};
let cameraModeIndex = 0;
let cameraMode = CAMERA_MODES[0];

const fpsCamPos = new THREE.Vector3();
const fpsLookAt = new THREE.Vector3();
let fpsInitialized = false;

function setCameraMode(mode) {
  cameraMode = mode;
  cameraModeIndex = CAMERA_MODES.indexOf(mode);
  if (camToggleBtn) {
    camToggleBtn.textContent = CAMERA_LABELS[mode];
  }
  updateHints();
  camera.fov = mode === 'fps' ? 70 : 45;
  camera.near = 0.05;
  camera.updateProjectionMatrix();
  fpsInitialized = false;
}

if (camToggleBtn) {
  camToggleBtn.addEventListener('click', (e) => {
    e.currentTarget.blur();
    sfx.init();
    cameraModeIndex = (cameraModeIndex + 1) % CAMERA_MODES.length;
    setCameraMode(CAMERA_MODES[cameraModeIndex]);
  });
}

// --- Three.js Setup ---
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x070913, 0.02);

const camera = new THREE.PerspectiveCamera(
  45,
  window.innerWidth / window.innerHeight,
  0.05,
  1000
);
const defaultCameraPos = new THREE.Vector3(0, 21, 19);
camera.position.copy(defaultCameraPos);
camera.lookAt(0, 0, 1);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
container.appendChild(renderer.domElement);

// Lights
const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xa5b4fc, 1.4);
dirLight.position.set(15, 25, 10);
dirLight.castShadow = true;
dirLight.shadow.mapSize.width = 1024;
dirLight.shadow.mapSize.height = 1024;
scene.add(dirLight);

// --- Board & Environment ---
const starsGeo = new THREE.BufferGeometry();
const starCoords = [];
for (let i = 0; i < 400; i++) {
  starCoords.push(
    (Math.random() - 0.5) * 120,
    (Math.random() - 0.2) * 60,
    (Math.random() - 0.5) * 120
  );
}
starsGeo.setAttribute('position', new THREE.Float32BufferAttribute(starCoords, 3));
const starsMat = new THREE.PointsMaterial({ color: 0x64748b, size: 0.6, transparent: true, opacity: 0.8 });
scene.add(new THREE.Points(starsGeo, starsMat));

// Arena floor
const floorGeo = new THREE.PlaneGeometry(GRID_SIZE * CELL_SIZE, GRID_SIZE * CELL_SIZE);
const floorMat = new THREE.MeshStandardMaterial({
  color: 0x0c1222,
  roughness: 0.4,
  metalness: 0.2
});
const floor = new THREE.Mesh(floorGeo, floorMat);
floor.rotation.x = -Math.PI / 2;
floor.position.y = -0.01;
floor.receiveShadow = true;
scene.add(floor);

// Grid lines
const gridHelper = new THREE.GridHelper(GRID_SIZE * CELL_SIZE, GRID_SIZE, 0x00f0ff, 0x1e293b);
gridHelper.position.y = 0.01;
scene.add(gridHelper);

// Glowing Border Wall
const wallHeight = 0.5;
const wallMat = new THREE.MeshStandardMaterial({
  color: 0x00f0ff,
  emissive: 0x00f0ff,
  emissiveIntensity: 0.35,
  roughness: 0.3,
  metalness: 0.8,
  transparent: true,
  opacity: 0.8
});

function createWall(x, z, w, d) {
  const geo = new THREE.BoxGeometry(w, wallHeight, d);
  const mesh = new THREE.Mesh(geo, wallMat);
  mesh.position.set(x, wallHeight / 2, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
}
const t = 0.2;
const fullSpan = GRID_SIZE * CELL_SIZE;
createWall(0, -HALF_GRID - t / 2, fullSpan + t * 2, t);
createWall(0, HALF_GRID + t / 2, fullSpan + t * 2, t);
createWall(-HALF_GRID - t / 2, 0, t, fullSpan);
createWall(HALF_GRID + t / 2, 0, t, fullSpan);

function gridToWorld(x, z) {
  return {
    x: (x + 0.5) * CELL_SIZE - HALF_GRID,
    z: (z + 0.5) * CELL_SIZE - HALF_GRID
  };
}

// --- Player 1 Meshes (Green / Cyan) ---
const p1HeadMat = new THREE.MeshStandardMaterial({
  color: 0x10b981,
  emissive: 0x059669,
  emissiveIntensity: 0.35,
  roughness: 0.2,
  metalness: 0.4
});
const p1BodyMat = new THREE.MeshStandardMaterial({ color: 0x047857, roughness: 0.3, metalness: 0.2 });
const p1EyeMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.8 });

const p1HeadGroup = new THREE.Group();
const p1HeadMesh = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.88, 0.88), p1HeadMat);
p1HeadMesh.castShadow = true;
p1HeadMesh.receiveShadow = true;
p1HeadGroup.add(p1HeadMesh);

const eyeGeo = new THREE.SphereGeometry(0.1, 8, 8);
const p1LeftEye = new THREE.Mesh(eyeGeo, p1EyeMat);
p1LeftEye.position.set(-0.25, 0.25, -0.42);
const p1RightEye = new THREE.Mesh(eyeGeo, p1EyeMat);
p1RightEye.position.set(0.25, 0.25, -0.42);
p1HeadGroup.add(p1LeftEye, p1RightEye);
scene.add(p1HeadGroup);

const p1BodyMeshes = [];
const segmentGeo = new THREE.BoxGeometry(0.82, 0.82, 0.82);

function getP1BodyMesh(index) {
  if (index < p1BodyMeshes.length) {
    p1BodyMeshes[index].visible = true;
    return p1BodyMeshes[index];
  }
  const mesh = new THREE.Mesh(segmentGeo, p1BodyMat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  p1BodyMeshes.push(mesh);
  return mesh;
}

// --- Player 2 Meshes (Orange / Cyber Amber) ---
const p2HeadMat = new THREE.MeshStandardMaterial({
  color: 0xf97316,
  emissive: 0xea580c,
  emissiveIntensity: 0.35,
  roughness: 0.2,
  metalness: 0.4
});
const p2BodyMat = new THREE.MeshStandardMaterial({ color: 0xc2410c, roughness: 0.3, metalness: 0.2 });
const p2EyeMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffedd5, emissiveIntensity: 0.8 });

const p2HeadGroup = new THREE.Group();
const p2HeadMesh = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.88, 0.88), p2HeadMat);
p2HeadMesh.castShadow = true;
p2HeadMesh.receiveShadow = true;
p2HeadGroup.add(p2HeadMesh);

const p2LeftEye = new THREE.Mesh(eyeGeo, p2EyeMat);
p2LeftEye.position.set(-0.25, 0.25, -0.42);
const p2RightEye = new THREE.Mesh(eyeGeo, p2EyeMat);
p2RightEye.position.set(0.25, 0.25, -0.42);
p2HeadGroup.add(p2LeftEye, p2RightEye);
scene.add(p2HeadGroup);

const p2BodyMeshes = [];
function getP2BodyMesh(index) {
  if (index < p2BodyMeshes.length) {
    p2BodyMeshes[index].visible = true;
    return p2BodyMeshes[index];
  }
  const mesh = new THREE.Mesh(segmentGeo, p2BodyMat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  p2BodyMeshes.push(mesh);
  return mesh;
}

// --- Foods (Supports up to 2 simultaneous foods) ---
const foodGeo = new THREE.IcosahedronGeometry(0.42, 1);
const foodMat = new THREE.MeshStandardMaterial({
  color: 0xff0055,
  emissive: 0xff0055,
  emissiveIntensity: 0.6,
  roughness: 0.15,
  metalness: 0.5
});

const foodGroups = [];
function getFoodGroup(index) {
  if (index < foodGroups.length) {
    foodGroups[index].visible = true;
    return foodGroups[index];
  }
  const group = new THREE.Group();
  const mesh = new THREE.Mesh(foodGeo, foodMat);
  mesh.castShadow = true;
  group.add(mesh);
  const pLight = new THREE.PointLight(0xff0055, 3.5, 8);
  group.add(pLight);
  scene.add(group);
  foodGroups.push(group);
  return group;
}

// Particle System
const MAX_PARTICLES = 50;
const particleGeo = new THREE.SphereGeometry(0.08, 6, 6);
const particleMat = new THREE.MeshBasicMaterial({ color: 0xff0077 });
const particles = [];

for (let i = 0; i < MAX_PARTICLES; i++) {
  const p = new THREE.Mesh(particleGeo, particleMat);
  p.visible = false;
  scene.add(p);
  particles.push({ mesh: p, vel: new THREE.Vector3(), life: 0 });
}

function triggerEatParticles(x, z) {
  let activated = 0;
  for (const p of particles) {
    if (activated >= 18) break;
    if (p.life <= 0) {
      p.mesh.position.set(x, 0.5, z);
      p.mesh.visible = true;
      p.life = 1.0;
      p.vel.set(
        (Math.random() - 0.5) * 6,
        Math.random() * 4 + 2,
        (Math.random() - 0.5) * 6
      );
      activated++;
    }
  }
}

// --- Positions Tracking & Interpolation ---
let targetPositions = game.snakes.map(s => s.map(seg => gridToWorld(seg.x, seg.z)));
let currentPositions = targetPositions.map(s => s.map(p => ({ ...p })));
let progress = 1.0;

let lastTickTime = performance.now();

function onGameOver() {
  sfx.playGameOver();
  if (game.mode === '2p') {
    if (game.winner === 'p1') {
      modalTitle.textContent = 'Игрок 1 победил! 🏆';
      modalTitle.style.color = '#10b981';
      modalSubtitle.textContent = 'Зелёная змейка одержала победу в дуэли!';
    } else if (game.winner === 'p2') {
      modalTitle.textContent = 'Игрок 2 победил! 🏆';
      modalTitle.style.color = '#f97316';
      modalSubtitle.textContent = 'Оранжевая змейка одержала победу в дуэли!';
    } else {
      modalTitle.textContent = 'Ничья! 💥';
      modalTitle.style.color = '#38bdf8';
      modalSubtitle.textContent = 'Оба игрока врезались одновременно!';
    }
    modalScore.textContent = `P1: ${game.scores[0]} | P2: ${game.scores[1]}`;
  } else {
    modalTitle.textContent = 'Game Over';
    modalTitle.style.color = '#ff3366';
    modalSubtitle.textContent = 'Вы врезались в стену или себя!';
    if (game.score > bestScore) {
      bestScore = game.score;
      localStorage.setItem('snake3d_best', bestScore.toString());
      bestScoreEl.textContent = bestScore;
    }
    modalScore.textContent = game.score;
  }
  modal.classList.add('visible');
}

function stepGame() {
  const prevTargets = targetPositions.map(s => s.map(p => ({ ...p })));
  const result = game.step();

  if (game.mode === '2p') {
    if (result) {
      if (result.p1 === 'eat') {
        sfx.playEat();
        const hW = gridToWorld(result.p1Head.x, result.p1Head.z);
        triggerEatParticles(hW.x, hW.z);
      }
      if (result.p2 === 'eat') {
        sfx.playEat();
        const hW = gridToWorld(result.p2Head.x, result.p2Head.z);
        triggerEatParticles(hW.x, hW.z);
      }
      p1ScoreEl.textContent = game.scores[0];
      p2ScoreEl.textContent = game.scores[1];
      updateSpeedDisplay();
    }
  } else {
    if (result === 'eat') {
      sfx.playEat();
      const headW = gridToWorld(game.snake[0].x, game.snake[0].z);
      triggerEatParticles(headW.x, headW.z);
      scoreEl.textContent = game.score;
      updateSpeedDisplay();
    }
  }

  if (game.gameOver) {
    onGameOver();
  }

  targetPositions = game.snakes.map(s => s.map(seg => gridToWorld(seg.x, seg.z)));

  // Smooth interpolation without freezing
  currentPositions = [];
  for (let p = 0; p < game.snakes.length; p++) {
    const prev = prevTargets[p] || targetPositions[p];
    const ate = game.mode === '2p' ? (result && result[`p${p + 1}`] === 'eat') : (result === 'eat');
    if (ate && prev.length > 0) {
      const prevTail = prev[prev.length - 1];
      currentPositions.push([...prev, { ...prevTail }]);
    } else {
      currentPositions.push(prev);
    }
  }

  progress = 0;
}

// --- Input Handling ---
window.addEventListener('keydown', (e) => {
  sfx.init();

  // Prevent browser default Space scroll / button-activation & arrow page scrolling
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
    e.preventDefault();
  }

  // Remove focus from any HTML button to prevent Enter/Space triggering clicks
  if (document.activeElement && document.activeElement.tagName === 'BUTTON') {
    document.activeElement.blur();
  }

  if (e.code === 'Space') {
    togglePause();
    return;
  }

  if (e.code === 'KeyR') {
    restartGame();
    return;
  }

  if (e.code === 'KeyC' || e.code === 'KeyV') {
    if (game.mode === '1p') {
      cameraModeIndex = (cameraModeIndex + 1) % CAMERA_MODES.length;
      setCameraMode(CAMERA_MODES[cameraModeIndex]);
    }
    return;
  }

  if (game.mode === '2p') {
    // 2-Player controls: Player 1 = WASD, Player 2 = Arrows
    switch (e.code) {
      case 'KeyW':
        game.setDirection(DIRECTIONS.UP, 0);
        break;
      case 'KeyS':
        game.setDirection(DIRECTIONS.DOWN, 0);
        break;
      case 'KeyA':
        game.setDirection(DIRECTIONS.LEFT, 0);
        break;
      case 'KeyD':
        game.setDirection(DIRECTIONS.RIGHT, 0);
        break;
      case 'ArrowUp':
        game.setDirection(DIRECTIONS.UP, 1);
        break;
      case 'ArrowDown':
        game.setDirection(DIRECTIONS.DOWN, 1);
        break;
      case 'ArrowLeft':
        game.setDirection(DIRECTIONS.LEFT, 1);
        break;
      case 'ArrowRight':
        game.setDirection(DIRECTIONS.RIGHT, 1);
        break;
    }
  } else {
    // 1-Player controls
    if (cameraMode === 'fps') {
      switch (e.code) {
        case 'ArrowLeft':
        case 'KeyA':
          game.turnLeft();
          break;
        case 'ArrowRight':
        case 'KeyD':
          game.turnRight();
          break;
      }
    } else {
      switch (e.code) {
        case 'ArrowUp':
        case 'KeyW':
          game.setDirection(DIRECTIONS.UP);
          break;
        case 'ArrowDown':
        case 'KeyS':
          game.setDirection(DIRECTIONS.DOWN);
          break;
        case 'ArrowLeft':
        case 'KeyA':
          game.setDirection(DIRECTIONS.LEFT);
          break;
        case 'ArrowRight':
        case 'KeyD':
          game.setDirection(DIRECTIONS.RIGHT);
          break;
      }
    }
  }
});

// Mobile button listeners (for 1P mode)
document.getElementById('btn-up').addEventListener('click', () => {
  sfx.init();
  if (game.mode === '2p') game.setDirection(DIRECTIONS.UP, 0);
  else if (cameraMode !== 'fps') game.setDirection(DIRECTIONS.UP);
});
document.getElementById('btn-down').addEventListener('click', () => {
  sfx.init();
  if (game.mode === '2p') game.setDirection(DIRECTIONS.DOWN, 0);
  else if (cameraMode !== 'fps') game.setDirection(DIRECTIONS.DOWN);
});
document.getElementById('btn-left').addEventListener('click', () => {
  sfx.init();
  if (game.mode === '2p') game.setDirection(DIRECTIONS.LEFT, 0);
  else if (cameraMode === 'fps') game.turnLeft();
  else game.setDirection(DIRECTIONS.LEFT);
});
document.getElementById('btn-right').addEventListener('click', () => {
  sfx.init();
  if (game.mode === '2p') game.setDirection(DIRECTIONS.RIGHT, 0);
  else if (cameraMode === 'fps') game.turnRight();
  else game.setDirection(DIRECTIONS.RIGHT);
});

restartBtn.addEventListener('click', (e) => {
  e.currentTarget.blur();
  sfx.init();
  restartGame();
});

function restartGame() {
  modal.classList.remove('visible');
  if (pauseOverlay) pauseOverlay.classList.remove('visible');
  if (document.activeElement && document.activeElement.blur) {
    document.activeElement.blur();
  }
  game.reset();
  scoreEl.textContent = '0';
  p1ScoreEl.textContent = '0';
  p2ScoreEl.textContent = '0';
  updateSpeedDisplay();
  updateHints();

  targetPositions = game.snakes.map(s => s.map(seg => gridToWorld(seg.x, seg.z)));
  currentPositions = targetPositions.map(s => s.map(p => ({ ...p })));
  progress = 1.0;
  lastTickTime = performance.now();
  fpsInitialized = false;
}

// Mouse drag orbit
let isDragging = false;
let prevMouseX = 0;
let cameraYaw = 0;

window.addEventListener('mousedown', (e) => {
  if (e.target.closest('#ui-layer') && (e.target.tagName === 'BUTTON' || e.target.classList.contains('cam-btn') || e.target.classList.contains('mode-btn'))) return;
  isDragging = true;
  prevMouseX = e.clientX;
});

window.addEventListener('mousemove', (e) => {
  if (!isDragging || cameraMode !== '3d') return;
  const deltaX = e.clientX - prevMouseX;
  cameraYaw += deltaX * 0.005;
  prevMouseX = e.clientX;
});

window.addEventListener('mouseup', () => { isDragging = false; });

// --- Render Loop ---
let lastFrameTime = performance.now();

function animate(now) {
  requestAnimationFrame(animate);
  const dt = Math.min((now - lastFrameTime) / 1000, 0.1);
  lastFrameTime = now;

  // Tick logic
  if (!game.gameOver && !game.isPaused) {
    const tickInterval = getTickInterval();
    if (now - lastTickTime >= tickInterval) {
      stepGame();
      lastTickTime = now;
    }
    progress = Math.min(1.0, (now - lastTickTime) / tickInterval);
  }

  // Foods animation
  for (let idx = 0; idx < game.foods.length; idx++) {
    const food = game.foods[idx];
    const fg = getFoodGroup(idx);
    const fw = gridToWorld(food.x, food.z);
    const floatOffset = Math.sin(now * 0.005 + idx) * 0.15;
    fg.position.set(fw.x, 0.6 + floatOffset, fw.z);
    fg.children[0].rotation.y += dt * 2.0;
    fg.children[0].rotation.x += dt * 1.0;
  }
  for (let idx = game.foods.length; idx < foodGroups.length; idx++) {
    foodGroups[idx].visible = false;
  }

  // --- Render Player 1 ---
  if (currentPositions[0] && targetPositions[0]) {
    const dir = game.directions[0];
    if (dir === DIRECTIONS.UP) p1HeadGroup.rotation.y = 0;
    else if (dir === DIRECTIONS.DOWN) p1HeadGroup.rotation.y = Math.PI;
    else if (dir === DIRECTIONS.LEFT) p1HeadGroup.rotation.y = Math.PI / 2;
    else if (dir === DIRECTIONS.RIGHT) p1HeadGroup.rotation.y = -Math.PI / 2;

    const hCur = currentPositions[0][0] || targetPositions[0][0];
    const hTgt = targetPositions[0][0];
    const hX = THREE.MathUtils.lerp(hCur.x, hTgt.x, progress);
    const hZ = THREE.MathUtils.lerp(hCur.z, hTgt.z, progress);
    p1HeadGroup.position.set(hX, 0.44, hZ);

    for (let i = 1; i < targetPositions[0].length; i++) {
      const bCur = currentPositions[0][i] || targetPositions[0][i];
      const bTgt = targetPositions[0][i];
      const bX = THREE.MathUtils.lerp(bCur.x, bTgt.x, progress);
      const bZ = THREE.MathUtils.lerp(bCur.z, bTgt.z, progress);
      const mesh = getP1BodyMesh(i - 1);
      mesh.position.set(bX, 0.41, bZ);
    }
    for (let i = targetPositions[0].length - 1; i < p1BodyMeshes.length; i++) {
      p1BodyMeshes[i].visible = false;
    }
  }

  // --- Render Player 2 (in 2P mode) ---
  if (game.mode === '2p' && currentPositions[1] && targetPositions[1]) {
    p2HeadGroup.visible = true;
    const dir2 = game.directions[1];
    if (dir2 === DIRECTIONS.UP) p2HeadGroup.rotation.y = 0;
    else if (dir2 === DIRECTIONS.DOWN) p2HeadGroup.rotation.y = Math.PI;
    else if (dir2 === DIRECTIONS.LEFT) p2HeadGroup.rotation.y = Math.PI / 2;
    else if (dir2 === DIRECTIONS.RIGHT) p2HeadGroup.rotation.y = -Math.PI / 2;

    const hCur2 = currentPositions[1][0] || targetPositions[1][0];
    const hTgt2 = targetPositions[1][0];
    const hX2 = THREE.MathUtils.lerp(hCur2.x, hTgt2.x, progress);
    const hZ2 = THREE.MathUtils.lerp(hCur2.z, hTgt2.z, progress);
    p2HeadGroup.position.set(hX2, 0.44, hZ2);

    for (let i = 1; i < targetPositions[1].length; i++) {
      const bCur = currentPositions[1][i] || targetPositions[1][i];
      const bTgt = targetPositions[1][i];
      const bX = THREE.MathUtils.lerp(bCur.x, bTgt.x, progress);
      const bZ = THREE.MathUtils.lerp(bCur.z, bTgt.z, progress);
      const mesh = getP2BodyMesh(i - 1);
      mesh.position.set(bX, 0.41, bZ);
    }
    for (let i = targetPositions[1].length - 1; i < p2BodyMeshes.length; i++) {
      p2BodyMeshes[i].visible = false;
    }
  } else {
    p2HeadGroup.visible = false;
    for (const m of p2BodyMeshes) m.visible = false;
  }

  // Particles
  for (const p of particles) {
    if (p.life > 0) {
      p.life -= dt * 2.5;
      p.mesh.position.addScaledVector(p.vel, dt);
      p.vel.y -= 9.8 * dt;
      const scale = Math.max(0.01, p.life);
      p.mesh.scale.set(scale, scale, scale);
      if (p.life <= 0) p.mesh.visible = false;
    }
  }

  // Camera handling
  if (cameraMode === 'fps' && game.mode === '1p') {
    p1HeadGroup.visible = false;
    camera.up.set(0, 1, 0);

    const hCur = currentPositions[0][0] || targetPositions[0][0];
    const hTgt = targetPositions[0][0];
    const hX = THREE.MathUtils.lerp(hCur.x, hTgt.x, progress);
    const hZ = THREE.MathUtils.lerp(hCur.z, hTgt.z, progress);

    const dir = game.directions[0];
    const targetCamPos = new THREE.Vector3(hX + dir.x * 0.35, 0.60, hZ + dir.z * 0.35);
    const targetLookAt = new THREE.Vector3(hX + dir.x * 8, 0.60, hZ + dir.z * 8);

    if (!fpsInitialized) {
      fpsCamPos.copy(targetCamPos);
      fpsLookAt.copy(targetLookAt);
      fpsInitialized = true;
    } else {
      fpsCamPos.lerp(targetCamPos, 0.35);
      fpsLookAt.lerp(targetLookAt, 0.35);
    }

    camera.position.copy(fpsCamPos);
    camera.lookAt(fpsLookAt);
  } else if (cameraMode === 'top') {
    p1HeadGroup.visible = true;
    camera.up.set(0, 0, -1);
    camera.position.set(0, 27, 0.001);
    camera.lookAt(0, 0, 0);
  } else {
    p1HeadGroup.visible = true;
    camera.up.set(0, 1, 0);
    cameraYaw = THREE.MathUtils.lerp(cameraYaw, 0, dt * 1.5);
    const radius = Math.sqrt(defaultCameraPos.x ** 2 + defaultCameraPos.z ** 2);
    const baseAngle = Math.atan2(defaultCameraPos.x, defaultCameraPos.z);
    const angle = baseAngle + cameraYaw;
    camera.position.x = Math.sin(angle) * radius;
    camera.position.y = defaultCameraPos.y;
    camera.position.z = Math.cos(angle) * radius;
    camera.lookAt(0, 0, 1);
  }

  renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});

updateHints();
animate(performance.now());
