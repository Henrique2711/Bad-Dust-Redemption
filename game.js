const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const W = canvas.width, H = canvas.height;
const SPOTS = [100, 250, 400, 550, 700];
const BASE = 390;          // topo da linha de caixotes
const MAX_AMMO = 6;
const FIG_H = 110;

let state = 'menu';        // menu | play | over
let score = 0, lives = 3, ammo = MAX_AMMO, reloading = 0;
let targets = [], spawnTimer = 0, flash = 0, popups = [];
let best = 0;
try { best = Number(localStorage.getItem('pdr-best')) || 0; } catch (e) {}

function start() {
  score = 0; lives = 3; ammo = MAX_AMMO; reloading = 0;
  targets = []; popups = []; spawnTimer = 600; flash = 0;
  state = 'play';
}

function gameOver() {
  state = 'over';
  if (score > best) {
    best = score;
    try { localStorage.setItem('pdr-best', String(best)); } catch (e) {}
  }
}

function hurt() {
  lives--; flash = 300;
  if (lives <= 0) gameOver();
}

function spawn() {
  const used = targets.map(t => t.i);
  const free = SPOTS.map((_, i) => i).filter(i => !used.includes(i));
  if (!free.length) return;
  const i = free[Math.floor(Math.random() * free.length)];
  targets.push({
    i,
    type: Math.random() < 0.25 ? 'civil' : 'bandit',
    age: 0,
    life: Math.max(700, 1800 - score * 12)
  });
}

function reload() {
  if (reloading > 0 || ammo === MAX_AMMO || state !== 'play') return;
  reloading = 800;
}

function figureY(t) {
  const rise = Math.min(1, t.age / 200);
  return BASE - 100 + FIG_H * (1 - rise);
}

function shoot(px, py) {
  if (state !== 'play' || reloading > 0) return;
  if (ammo <= 0) { reload(); return; }
  ammo--;
  for (let k = targets.length - 1; k >= 0; k--) {
    const t = targets[k], x = SPOTS[t.i], fy = figureY(t);
    if (Math.abs(px - x) < 28 && py >= fy && py <= BASE - 35) {
      if (t.type === 'bandit') {
        score += 10;
        popups.push({ x, y: fy, text: '+10', age: 0 });
      } else {
        popups.push({ x, y: fy, text: 'Morador!', age: 0 });
        hurt();
      }
      targets.splice(k, 1);
      return;
    }
  }
}

function update(dt) {
  if (state !== 'play') return;
  spawnTimer -= dt;
  if (spawnTimer <= 0) {
    spawn();
    spawnTimer = Math.max(450, 1100 - score * 6);
  }
  if (reloading > 0) {
    reloading -= dt;
    if (reloading <= 0) { reloading = 0; ammo = MAX_AMMO; }
  }
  targets = targets.filter(t => {
    t.age += dt;
    if (t.age >= t.life) {
      if (t.type === 'bandit') hurt();
      return false;
    }
    return true;
  });
  popups = popups.filter(p => (p.age += dt) < 700);
  if (flash > 0) flash -= dt;
}

function drawFigure(t) {
  const x = SPOTS[t.i], fy = figureY(t);
  const bandit = t.type === 'bandit';
  ctx.fillStyle = bandit ? '#7a1f1f' : '#2f6fa3';
  ctx.fillRect(x - 20, fy + 36, 40, 74);                  // corpo
  ctx.fillStyle = '#e0b48a';
  ctx.beginPath(); ctx.arc(x, fy + 22, 14, 0, Math.PI * 2); ctx.fill(); // rosto
  if (bandit) {
    ctx.fillStyle = '#c0392b';
    ctx.fillRect(x - 14, fy + 26, 28, 9);                 // lenço
  }
  ctx.fillStyle = bandit ? '#2b1a10' : '#f0e6d2';
  ctx.fillRect(x - 26, fy + 8, 52, 5);                    // aba
  ctx.fillRect(x - 14, fy - 6, 28, 15);                   // copa
}

function drawScene() {
  const sky = ctx.createLinearGradient(0, 0, 0, 300);
  sky.addColorStop(0, '#7a2e3a');
  sky.addColorStop(0.6, '#e0763a');
  sky.addColorStop(1, '#f6c26b');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, 300);
  ctx.fillStyle = '#fbe7a1';
  ctx.beginPath(); ctx.arc(620, 250, 46, 0, Math.PI * 2); ctx.fill();   // sol

  ctx.fillStyle = '#4a2a22';                                              // casas ao fundo
  [[40, 210, 120], [190, 240, 90], [330, 200, 130], [500, 230, 100], [660, 205, 120]]
    .forEach(([x, y, w]) => ctx.fillRect(x, y, w, 300 - y));
  ctx.fillStyle = '#3a2018';
  [[60, 180, 40], [350, 170, 50], [690, 175, 50]]
    .forEach(([x, y, w]) => ctx.fillRect(x, y, w, 40));

  ctx.fillStyle = '#b5833f'; ctx.fillRect(0, 300, W, H - 300);            // chão
  ctx.fillStyle = '#9c6d30'; ctx.fillRect(0, BASE + 25, W, H - BASE - 25);
}

function drawCrates() {
  SPOTS.forEach(x => {
    ctx.fillStyle = '#6b4423'; ctx.fillRect(x - 38, BASE - 35, 76, 60);
    ctx.strokeStyle = '#3a2416'; ctx.lineWidth = 3;
    ctx.strokeRect(x - 38, BASE - 35, 76, 60);
    ctx.beginPath();
    ctx.moveTo(x - 38, BASE - 35); ctx.lineTo(x + 38, BASE + 25);
    ctx.moveTo(x + 38, BASE - 35); ctx.lineTo(x - 38, BASE + 25);
    ctx.stroke();
  });
}

function drawHud() {
  ctx.fillStyle = '#1e120c'; ctx.fillRect(0, 0, W, 44);
  ctx.fillStyle = '#f1d9a8'; ctx.font = 'bold 20px Georgia, serif'; ctx.textAlign = 'left';
  ctx.fillText('Pontos: ' + score, 14, 29);
  ctx.textAlign = 'center';
  ctx.fillText('Recorde: ' + best, W / 2, 29);
  ctx.textAlign = 'right';
  ctx.fillStyle = '#e24a33';
  ctx.fillText('♥'.repeat(Math.max(0, lives)), W - 14, 29);

  for (let k = 0; k < MAX_AMMO; k++) {                                    // munição
    ctx.fillStyle = k < ammo ? '#f6c26b' : '#4a2a22';
    ctx.fillRect(14 + k * 16, H - 34, 10, 22);
  }
  if (reloading > 0) {
    ctx.fillStyle = '#f1d9a8'; ctx.textAlign = 'left';
    ctx.fillText('Recarregando...', 120, H - 16);
  } else if (ammo === 0) {
    ctx.fillStyle = '#f1d9a8'; ctx.textAlign = 'left';
    ctx.fillText('Sem munição! Aperte R', 120, H - 16);
  }
}

function drawOverlay(title, lines) {
  ctx.fillStyle = 'rgba(30,18,12,0.82)'; ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#d98a3d'; ctx.font = 'bold 44px Georgia, serif';
  ctx.fillText(title, W / 2, 190);
  ctx.fillStyle = '#f1d9a8'; ctx.font = '20px Georgia, serif';
  lines.forEach((l, k) => ctx.fillText(l, W / 2, 240 + k * 32));
}

function draw() {
  drawScene();
  ctx.save();
  ctx.beginPath(); ctx.rect(0, 0, W, BASE + 25); ctx.clip();
  targets.forEach(drawFigure);
  ctx.restore();
  drawCrates();
  popups.forEach(p => {
    ctx.fillStyle = '#fff3c4'; ctx.font = 'bold 22px Georgia, serif'; ctx.textAlign = 'center';
    ctx.fillText(p.text, p.x, p.y - p.age / 20);
  });
  if (flash > 0) {
    ctx.fillStyle = 'rgba(179,50,31,' + (flash / 600) + ')'; ctx.fillRect(0, 0, W, H);
  }
  drawHud();
  if (state === 'menu') {
    drawOverlay('Poeira Maldita: Redenção',
      ['Acerte os bandidos de lenço vermelho.', 'Não atire nos moradores.', 'Clique para começar.']);
  } else if (state === 'over') {
    drawOverlay('Fim de jogo',
      ['Você fez ' + score + ' pontos.', 'Recorde: ' + best, 'Clique para jogar de novo.']);
  }
}

let last = performance.now();
function loop(now) {
  const dt = Math.min(50, now - last);
  last = now;
  update(dt); draw();
  requestAnimationFrame(loop);
}

canvas.addEventListener('pointerdown', e => {
  const r = canvas.getBoundingClientRect();
  const x = (e.clientX - r.left) * W / r.width;
  const y = (e.clientY - r.top) * H / r.height;
  if (state === 'play') shoot(x, y); else start();
});
document.addEventListener('keydown', e => { if (e.key.toLowerCase() === 'r') reload(); });
document.getElementById('reload').addEventListener('click', reload);

requestAnimationFrame(loop);
