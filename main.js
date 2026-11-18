import * as THREE from 'three';
import { init as initExtras } from './extras.js';
import { build as buildWorld } from './mundo.js';

const $ = id => document.getElementById(id);
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

// ---------- mundo ----------
const LAKES = [{ x: 80, z: -60, r: 22 }, { x: -90, z: 70, r: 25 }, { x: -60, z: -110, r: 20 }];
const WATER = -0.8, LIM = 185;
const MINE = { x: 120, z: -125 };
const TOWNS = [
  { name: 'Poeira Seca', x: 0, z: 0, r: 32 }, { name: 'Vila Ferradura', x: 130, z: 100, r: 32 },
  { name: 'Forte Cinzento', x: -125, z: 120, r: 32 }, { name: 'Pântano Negro', x: -140, z: -135, r: 32, swamp: true }];
const RAIL = [{ x: 0, z: 50 }, { x: 130, z: 100 }, { x: -125, z: 165 }, { x: -180, z: 130 }, { x: -140, z: -100 }];
const SW = TOWNS[3];
const near = (x, z, d) => TOWNS.some(t => Math.hypot(x - t.x, z - t.z) < d + 10) || Math.hypot(x - MINE.x, z - MINE.z) < d + 10;

function height(x, z) {
  let b = (Math.sin(x * 0.03) * Math.cos(z * 0.025) * 4 + Math.sin(x * 0.011 + z * 0.017) * 6 +
           Math.cos(z * 0.05) * Math.sin(x * 0.04) * 1.5) * 0.5 + 3;
  let fl = 1;
  for (const t of TOWNS) fl = Math.min(fl, smooth(t.r, t.r * 2, Math.hypot(x - t.x, z - t.z)));
  b = Math.max(b, 0.5) * fl;
  { const f = smooth(52, 34, Math.hypot(x - MINE.x, z - MINE.z)); b = b * (1 - f) + f; }
  { const d = Math.hypot(x - SW.x, z - SW.z), f = smooth(64, 34, d), g = smooth(32, 20, d);
    b = b * (1 - f) + (-0.5 + Math.sin(x * 0.21) * Math.cos(z * 0.19) * 0.9) * f; b = b * (1 - g) + 0.2 * g; }
  for (const l of LAKES) {
    const f = smooth(l.r * 1.3, l.r * 0.6, Math.hypot(x - l.x, z - l.z));
    b = b * (1 - f) - 2.5 * f;
  }
  return b;
}

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
document.body.prepend(renderer.domElement);
const scene = new THREE.Scene();
const skyCol = new THREE.Color('#8cc0e8');
scene.background = skyCol;
scene.fog = new THREE.Fog(skyCol, 50, 190);
const camera = new THREE.PerspectiveCamera(65, innerWidth / innerHeight, 0.1, 700);
const hemi = new THREE.HemisphereLight(0xffffff, 0x8a6a40, 0.8); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff0cc, 1.2); scene.add(sun);
addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
});

const mats = {};
const M = c => mats[c] || (mats[c] = new THREE.MeshLambertMaterial({ color: c, flatShading: true }));
function box(w, h, d, c, x, y, z, p) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), M(c));
  m.position.set(x, y, z); if (p) p.add(m); return m;
}
function legs(p, pts, hip, len, w, c) {
  return pts.map(([x, z]) => {
    const g = new THREE.Group(); g.position.set(x, hip, z);
    box(w, len, w, c, 0, -len / 2, 0, g); p.add(g); return g;
  });
}

// terreno
{
  const geo = new THREE.PlaneGeometry(400, 400, 120, 120); geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position, cols = [], c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i), y = height(x, z);
    pos.setY(i, y);
    if (y < WATER + 0.4) c.set('#7a6a48'); else if (y < WATER + 1.5) c.set('#7d8a45');
    else if (y < 2.2) c.set('#c9a66b'); else if (y < 4) c.set('#b8864b'); else c.set('#9a6a3c');
    if (Math.hypot(x - SW.x, z - SW.z) < 60 && y >= WATER + 0.4) c.set('#5f6b3a');
    if (Math.hypot(x - MINE.x, z - MINE.z) < 34) c.set('#6a655e');
    c.offsetHSL(0, 0, Math.sin(x * 0.7) * Math.cos(z * 0.9) * 0.04);
    cols.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  geo.computeVertexNormals();
  scene.add(new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true })));
  const water = new THREE.Mesh(new THREE.PlaneGeometry(400, 400),
    new THREE.MeshLambertMaterial({ color: 0x2d6f8f, transparent: true, opacity: 0.75 }));
  water.rotation.x = -Math.PI / 2; water.position.y = WATER; scene.add(water);
}

// cidades, mina e ferrovia (mundo.js)
const rects = [], NPCS = [];
const blocked = (x, z) => rects.some(r => Math.abs(x - r.x) < r.w / 2 + 0.7 && Math.abs(z - r.z) < r.d / 2 + 0.7);

function place(fn, n, minD) {
  for (let k = 0, tries = 0; k < n && tries < n * 20; tries++) {
    const x = rand(-LIM, LIM), z = rand(-LIM, LIM), y = height(x, z);
    if (y < WATER + 0.8 || near(x, z, minD)) continue;
    fn(x, y, z); k++;
  }
}
place((x, y, z) => {                       // cactos
  const g = new THREE.Group(), s = rand(0.8, 1.5), c = '#3f7a3a';
  box(0.6, 3 * s, 0.6, c, 0, 1.5 * s, 0, g);
  box(1, 0.4, 0.4, c, 0.6, 1.4 * s, 0, g); box(0.4, 1.2, 0.4, c, 1, 1.9 * s, 0, g);
  g.position.set(x, y, z); g.rotation.y = rand(0, 6.28); scene.add(g);
}, 90, 45);
place((x, y, z) => {                       // pedras
  const m = new THREE.Mesh(new THREE.DodecahedronGeometry(rand(0.6, 2)), M('#8a7560'));
  m.scale.y = 0.7; m.position.set(x, y + 0.2, z); m.rotation.y = rand(0, 6); scene.add(m);
}, 70, 40);

// céu: sol e estrelas
const sunMesh = new THREE.Mesh(new THREE.SphereGeometry(14, 12, 12), new THREE.MeshBasicMaterial({ color: 0xfff2b0, fog: false }));
scene.add(sunMesh);
const starPos = [];
for (let i = 0; i < 500; i++) {
  const v = new THREE.Vector3(rand(-1, 1), rand(0.05, 1), rand(-1, 1)).normalize().multiplyScalar(450);
  starPos.push(v.x, v.y, v.z);
}
const starGeo = new THREE.BufferGeometry();
starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
const starMat = new THREE.PointsMaterial({ size: 2, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, color: 0xffffff });
const stars = new THREE.Points(starGeo, starMat); scene.add(stars);

// ---------- jogador e cavalo ----------
const player = { x: 0, z: 3, y: 0, yaw: 0, pitch: 0.25, hp: 100, ammo: 6, reload: 0, mounted: false, face: 0,
                 score: { buffalo: 0, gator: 0, coyote: 0 } };
const pm = new THREE.Group();
box(0.25, 0.7, 0.25, '#2a2a3a', -0.15, 0.35, 0, pm); box(0.25, 0.7, 0.25, '#2a2a3a', 0.15, 0.35, 0, pm);
box(0.6, 0.9, 0.35, '#3b5f8a', 0, 1.15, 0, pm); box(0.36, 0.12, 0.05, '#b3321f', 0, 1.62, 0.2, pm);
box(0.35, 0.35, 0.35, '#e0b48a', 0, 1.8, 0, pm);
box(0.9, 0.06, 0.9, '#2b1a10', 0, 2.0, 0, pm); box(0.45, 0.25, 0.45, '#2b1a10', 0, 2.15, 0, pm);
scene.add(pm);

const H = { x: 12, z: 2, dir: 0, phase: 0 };
const horse = new THREE.Group();
box(2.2, 0.9, 0.8, '#6b4423', 0, 1.5, 0, horse); box(0.5, 1.1, 0.5, '#6b4423', 1.2, 2.0, 0, horse).rotation.z = -0.5;
box(0.9, 0.4, 0.45, '#5a3a1e', 1.75, 2.45, 0, horse); box(0.3, 0.8, 0.12, '#2b1a10', 0.95, 2.3, 0, horse);
box(0.2, 0.9, 0.2, '#2b1a10', -1.25, 1.4, 0, horse).rotation.z = 0.4;
box(0.9, 0.2, 0.7, '#3a2416', 0, 2.0, 0, horse);
const horseLegs = legs(horse, [[0.8, 0.28], [0.8, -0.28], [-0.8, 0.28], [-0.8, -0.28]], 1.05, 1.05, 0.2, '#5a3a1e');
scene.add(horse);

// ---------- animais ----------
function wrap() { const g = new THREE.Group(), b = new THREE.Group(); g.add(b); g.userData.b = b; return [g, b]; }
function makeBuffalo() {
  const [g, b] = wrap();
  box(2.6, 1.5, 1.4, '#4a2f1d', 0, 1.7, 0, b); box(1.2, 1, 1.5, '#3a2316', 0.4, 2.4, 0, b);
  box(0.9, 0.9, 0.9, '#2f1c12', 1.7, 1.6, 0, b);
  box(0.2, 0.2, 0.5, '#e8dcc0', 1.7, 2.15, 0.55, b); box(0.2, 0.2, 0.5, '#e8dcc0', 1.7, 2.15, -0.55, b);
  g.userData.legs = legs(b, [[0.9, 0.5], [0.9, -0.5], [-0.9, 0.5], [-0.9, -0.5]], 1, 1, 0.3, '#2f1c12');
  return g;
}
function makeGator() {
  const [g, b] = wrap();
  box(3, 0.5, 1, '#3d5a2e', 0, 0.45, 0, b); box(1.3, 0.3, 0.6, '#46663a', 2, 0.4, 0, b);
  box(2.2, 0.3, 0.6, '#37522a', -2.5, 0.4, 0, b); box(1.2, 0.2, 0.4, '#2f4824', -4, 0.38, 0, b);
  g.userData.legs = legs(b, [[1, 0.55], [1, -0.55], [-1, 0.55], [-1, -0.55]], 0.35, 0.35, 0.2, '#2f4824');
  return g;
}
function makeCoyote() {
  const [g, b] = wrap();
  box(1, 0.5, 0.4, '#b08a55', 0, 0.8, 0, b); box(0.4, 0.35, 0.35, '#b08a55', 0.7, 1, 0, b);
  box(0.3, 0.15, 0.2, '#8a6a3c', 1, 0.95, 0, b);
  box(0.1, 0.2, 0.1, '#8a6a3c', 0.65, 1.28, 0.12, b); box(0.1, 0.2, 0.1, '#8a6a3c', 0.65, 1.28, -0.12, b);
  box(0.6, 0.15, 0.15, '#8a6a3c', -0.8, 0.85, 0, b).rotation.z = 0.5;
  g.userData.legs = legs(b, [[0.35, 0.14], [0.35, -0.14], [-0.35, 0.14], [-0.35, -0.14]], 0.58, 0.58, 0.12, '#8a6a3c');
  return g;
}
const CFG = {
  buffalo: { make: makeBuffalo, hp: 3, speed: 2.2, run: 9, r: 1.7, name: 'búfalo' },
  gator: { make: makeGator, hp: 4, speed: 1.2, run: 5, r: 1.5, name: 'jacaré' },
  coyote: { make: makeCoyote, hp: 1, speed: 2.5, run: 10, r: 0.9, name: 'coiote' }
};
let animals = [];
function spawn(type, x, z, home, range) {
  const cfg = CFG[type], mesh = cfg.make(); scene.add(mesh);
  animals.push({ type, cfg, mesh, hp: cfg.hp, x, z, y: 0, dir: rand(0, 6.28), timer: 0, idle: false,
                 dead: 0, cool: 0, scared: 0, phase: 0, home, range });
}
function spawnGroup(type, cx, cz, n, range) {
  for (let k = 0, tries = 0; k < n && tries < 80; tries++) {
    const x = cx + rand(-12, 12), z = cz + rand(-12, 12);
    if (height(x, z) < 1) continue;
    spawn(type, x, z, { x: cx, z: cz }, range); k++;
  }
}
function populate() {
  animals.forEach(a => scene.remove(a.mesh)); animals = [];
  spawnGroup('buffalo', -100, -20, 6, 30); spawnGroup('buffalo', 50, 100, 6, 30);
  spawnGroup('coyote', 120, 40, 3, 25); spawnGroup('coyote', -30, 140, 3, 25); spawnGroup('coyote', 40, -150, 3, 25);
  for (const l of LAKES) for (let k = 0; k < 3; k++) {
    const a = rand(0, 6.28), d = rand(0, l.r * 0.8);
    spawn('gator', l.x + Math.cos(a) * d, l.z + Math.sin(a) * d, { x: l.x, z: l.z }, l.r * 1.3);
  }
  for (let k = 0; k < 4; k++) {
    const a = rand(0, 6.28), d = rand(24, 40);
    spawn('gator', SW.x + Math.cos(a) * d, SW.z + Math.sin(a) * d, { x: SW.x, z: SW.z }, 42);
  }
}
populate();
const W = buildWorld({ THREE, scene, box, M, height, rects, NPCS, TOWNS, RAIL, MINE, WATER, hemi, sun, toast });

// ---------- estado ----------
Object.assign(player, { money: 0, bag: {}, weapon: 'none', pick: 0, moving: false, rifle: false, ammoR: 5 });
let tod = 0.18, sunY = 1, night = false;
let kick = 0, hurtFlash = 0, toastT = 0;
const keys = {};
const dir = new THREE.Vector3(), tmp = new THREE.Vector3();

function toast(t) {
  const el = $('aviso'); el.textContent = t; el.style.opacity = 1;
  clearTimeout(toastT); toastT = setTimeout(() => { el.style.opacity = 0; }, 1800);
}
function hurt(n) {
  if (player.hp <= 0) return;
  player.hp = Math.max(0, player.hp - n); hurtFlash = 0.35; X.thud();
  if (player.hp <= 0) X.die();
}
function respawn() {
  Object.assign(player, { x: 0, z: 3, hp: 100, ammo: 6, ammoR: 5, reload: 0, mounted: false });
  H.x = 12; H.z = 2; populate();
}
const PAY = { buffalo: 40, gator: 90, coyote: 15 };
function fireRay(dmg = 1, range = 100) {
  kick = 0.05;
  camera.getWorldDirection(dir);
  let best = null;
  for (const a of animals) {
    if (a.dead) continue;
    tmp.set(a.x, a.y + 0.9, a.z).sub(camera.position);
    const t = tmp.dot(dir);
    if (t < 1 || t > range) continue;
    if (tmp.addScaledVector(dir, -t).length() < a.cfg.r && (!best || t < best.t)) best = { a, t };
  }
  if (!best) return;
  const a = best.a; a.hp -= dmg;
  if (a.hp <= 0) { a.dead = 0.001; player.score[a.type]++; player.money += PAY[a.type]; toast('Abateu um ' + a.cfg.name + ' +$' + PAY[a.type]); }
  else { a.scared = 6; toast('Acertou!'); }
}

// ---------- entrada ----------
const X = initExtras({ THREE, scene, camera, renderer, player, pm, H, height, box, M, rects, toast, MINE, WATER,
                       fireRay, respawn, NPCS, TOWNS, RAIL, W, getTod: () => tod });
addEventListener('keydown', e => { keys[e.code] = true; X.key(e); });
addEventListener('keyup', e => { keys[e.code] = false; X.keyup(e); });
addEventListener('mousemove', e => {
  if (!X.locked || X.move(e)) return;
  player.yaw -= e.movementX * 0.0025;
  player.pitch = clamp(player.pitch + e.movementY * 0.0025, -0.2, 1.1);
});
addEventListener('mousedown', e => { if (X.locked && e.button === 0) X.click(); });

// ---------- atualização ----------
function updateAnimal(a, dt) {
  const m = a.mesh, b = m.userData.b;
  if (a.dead) {
    a.dead += dt; b.rotation.x = Math.min(1.5, a.dead * 4);
    if (a.dead > 25) { scene.remove(m); a.gone = true; }
    return;
  }
  const dx = player.x - a.x, dz = player.z - a.z, dist = Math.hypot(dx, dz) || 1, t = a.type;
  a.scared -= dt; a.cool -= dt; a.timer -= dt;
  let mode = 'wander';
  if (player.hp > 0) {
    if (t === 'buffalo' && (dist < 16 || a.scared > 0)) mode = 'flee';
    else if (t === 'coyote') { if (night && dist < 40) mode = 'chase'; else if (dist < 14 || a.scared > 0) mode = 'flee'; }
    else if (t === 'gator' && dist < 11) mode = 'chase';
  }
  let speed = 0;
  if (mode === 'flee') { a.dir = Math.atan2(-dz, -dx); speed = a.cfg.run; }
  else if (mode === 'chase') {
    a.dir = Math.atan2(dz, dx);
    if (dist > 2) speed = t === 'gator' ? 5 : a.cfg.run;
    else if (a.cool <= 0) { hurt(t === 'gator' ? 20 : 6); a.cool = 1.2; }
  } else if (a.timer <= 0) {
    a.timer = rand(2, 5); a.idle = Math.random() < 0.35;
    a.dir = Math.hypot(a.x - a.home.x, a.z - a.home.z) > a.range * 0.8
      ? Math.atan2(a.home.z - a.z, a.home.x - a.x) : rand(0, 6.28);
  }
  if (mode === 'wander' && !a.idle) speed = a.cfg.speed;
  if (speed > 0) {
    const nx = a.x + Math.cos(a.dir) * speed * dt, nz = a.z + Math.sin(a.dir) * speed * dt;
    const ok = t === 'gator'
      ? Math.hypot(nx - a.home.x, nz - a.home.z) < a.range
      : height(nx, nz) >= WATER - 0.2 && !blocked(nx, nz) && Math.abs(nx) < LIM && Math.abs(nz) < LIM;
    if (ok) { a.x = nx; a.z = nz; } else a.timer = 0;
  }
  const y = height(a.x, a.z);
  a.y = t === 'gator' ? Math.max(y, WATER - 0.15) : y;
  m.position.set(a.x, a.y, a.z); m.rotation.y = -a.dir;
  a.phase += dt * speed * 1.5;
  m.userData.legs.forEach((l, i) => { l.rotation.z = speed > 0 ? Math.sin(a.phase) * 0.6 * (i % 2 ? -1 : 1) : 0; });
}

const cDay = new THREE.Color('#8cc0e8'), cDusk = new THREE.Color('#e8773a'), cNight = new THREE.Color('#0a0f2a');
function updateSky(dt) {
  tod = (tod + dt / (X.dayMin * 60)) % 1;
  const ang = tod * Math.PI * 2; sunY = Math.sin(ang); night = sunY < 0.05;
  if (sunY > 0.25) skyCol.copy(cDay);
  else if (sunY > 0) skyCol.lerpColors(cDusk, cDay, sunY / 0.25);
  else skyCol.lerpColors(cDusk, cNight, clamp(-sunY / 0.25, 0, 1));
  scene.fog.color.copy(skyCol);
  sun.position.set(Math.cos(ang) * 200, Math.sin(ang) * 200 + 20, 60);
  sun.intensity = clamp(sunY * 2 + 0.2, 0, 1.2);
  sun.color.setHSL(0.1, 0.8, clamp(0.55 + sunY * 0.4, 0.55, 0.95));
  hemi.intensity = 0.28 + clamp(sunY, 0, 1) * 0.55;
  starMat.opacity = clamp(-sunY * 3, 0, 1);
}

function update(dt) {
  X.update(dt);
  updateSky(dt);
  const p = player;
  if (p.hp > 0) {
    const f = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0), s = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0);
    let vx = 0, vz = 0, moving = false;
    if (f || s) {
      vx = -Math.sin(p.yaw) * f + Math.cos(p.yaw) * s; vz = -Math.cos(p.yaw) * f - Math.sin(p.yaw) * s;
      const l = Math.hypot(vx, vz); vx /= l; vz /= l; moving = true;
    }
    const run = keys.ShiftLeft || keys.ShiftRight;
    let sp = p.mounted ? (run ? 22 : 14) : (run ? 9 : 5);
    if (!p.mounted && height(p.x, p.z) < WATER) sp *= 0.5;
    if (moving) {
      const nx = clamp(p.x + vx * sp * dt, -LIM, LIM), nz = clamp(p.z + vz * sp * dt, -LIM, LIM);
      const wet = p.mounted && height(nx, nz) < WATER;
      if (!blocked(nx, p.z) && !wet) p.x = nx;
      if (!blocked(p.x, nz) && !wet) p.z = nz;
      p.face = Math.atan2(vz, vx);
    }
    if (p.weapon !== 'none' && !p.mounted) p.face = Math.atan2(-Math.cos(p.yaw), -Math.sin(p.yaw));
    p.moving = moving;
    p.y = Math.max(height(p.x, p.z), WATER - 1.2);
    pm.position.set(p.x, p.y + (p.mounted ? 1.3 : (moving ? Math.abs(Math.sin(performance.now() / 120)) * 0.08 : 0)), p.z);
    pm.rotation.y = Math.PI / 2 - p.face;
    if (p.mounted) { H.x = p.x; H.z = p.z; H.dir = p.face; H.phase += dt * sp * 0.9; }
    horseLegs.forEach((l, i) => { l.rotation.z = p.mounted && moving ? Math.sin(H.phase) * 0.7 * (i % 2 ? -1 : 1) : 0; });
    if (p.reload > 0) { p.reload -= dt; if (p.reload <= 0) { p.reload = 0; p.ammo = 6; } }
  }
  horse.position.set(H.x, height(H.x, H.z), H.z); horse.rotation.y = -H.dir;
  animals.forEach(a => updateAnimal(a, dt));
  animals = animals.filter(a => !a.gone);

  W.update(p);
  const ins = W.inside, d = ins ? 2.8 : p.mounted ? 9 : 6.5, cp = Math.cos(p.pitch), top = p.mounted ? 2.6 : 1.8;
  let cx = p.x + Math.sin(p.yaw) * cp * d, cz = p.z + Math.cos(p.yaw) * cp * d;
  if (ins) { cx = clamp(cx, ins.x0, ins.x1); cz = clamp(cz, ins.z0, ins.z1); }
  let cy = Math.max(p.y + top + Math.sin(p.pitch) * d, height(cx, cz) + 0.6);
  if (ins) cy = Math.min(cy, p.y + 3.8);
  kick = Math.max(0, kick - dt * 0.4);
  camera.position.set(cx, cy + kick * 8, cz);
  camera.lookAt(p.x, p.y + (p.mounted ? 2.4 : 1.7), p.z);
  sunMesh.position.copy(camera.position).add(tmp.set(Math.cos(tod * 6.2832), Math.sin(tod * 6.2832), 0.3).multiplyScalar(420));
  stars.position.copy(camera.position);

  hurtFlash = Math.max(0, hurtFlash - dt);
  $('dano').style.opacity = hurtFlash * 1.2;
  $('barra').firstChild.style.width = p.hp + '%';
  X.hud();
}

let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (X.locked) update(dt * X.timeScale);
  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}
update(0.001);
requestAnimationFrame(loop);
