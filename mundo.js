// Cidades, casas com interior, ferrovia e a mina em forma de túnel
export function build(c) {
  const { THREE, scene, box, M, height, rects, NPCS, TOWNS, RAIL, MINE, WATER, hemi, sun, toast } = c;
  const rand = (a, b) => a + Math.random() * (b - a), shuffle = a => a.sort(() => Math.random() - .5);
  const W = { inside: null, slots: [] }, HS = [];

  function npc(g, x, z, hat, shirt) {
    box(.5, .8, .3, '#2a2a3a', x, .4, z, g); box(.6, .9, .35, shirt, x, 1.25, z, g); box(.35, .35, .35, '#e0b48a', x, 1.9, z, g);
    box(.9, .06, .9, hat, x, 2.1, z, g); box(.45, .25, .45, hat, x, 2.25, z, g);
  }
  // casa com porta, interior e teto que some quando você entra
  function house(x, z, w, d, h, col, o = {}) {
    const f = o.f ?? 1, g = new THREE.Group(), t = .5, dw = 4.4, y = height(x, z);
    g.position.set(x, y, z); scene.add(g);
    const wall = (cx, cz, ww, dd) => { box(ww, h, dd, col, cx, h / 2, cz, g); rects.push({ x: x + cx, z: z + cz, w: ww, d: dd }); };
    box(w, .2, d, o.floor || '#6b4a2b', 0, .1, 0, g);
    wall(0, -f * (d / 2 - t / 2), w, t); wall(-(w / 2 - t / 2), 0, t, d); wall(w / 2 - t / 2, 0, t, d);
    const sw = (w - dw) / 2;
    wall(-(dw / 2 + sw / 2), f * (d / 2 - t / 2), sw, t); wall(dw / 2 + sw / 2, f * (d / 2 - t / 2), sw, t);
    box(dw, h - 3, t, col, 0, 3 + (h - 3) / 2, f * (d / 2 - t / 2), g);
    if (o.sign) box(3.6, .9, .2, o.sign, 0, h - .9, f * (d / 2 + .2), g);
    const roof = new THREE.Group(); box(w + 1, .6, d + 1, o.roof || '#4a2c1a', 0, h + .3, 0, roof); g.add(roof);
    HS.push({ x, z, w, d, roof });
    const prop = (px, pz, pw, pd, ph, pc) => { box(pw, ph, pd, pc, px, ph / 2, pz, g); rects.push({ x: x + px, z: z + pz, w: pw, d: pd }); };
    if (o.type === 'bar' || o.type === 'arm') {
      const cz = -f * (d / 2 - 3.4);
      prop(0, cz, w - 8, 1, 1.2, '#4a2c1a');
      npc(g, 0, cz - f * 1.6, o.type === 'bar' ? '#2b1a10' : '#6b4423', o.type === 'bar' ? '#b3321f' : '#3b6a3b');
      NPCS.push({ x, z: z + cz - f * 1.6, type: o.type });
      if (o.type === 'arm') for (let k = -2; k <= 2; k++) box(1.6, .15, .15, '#2b2b2b', k * 1.9, 2.2 + (k & 1) * .5, -f * (d / 2 - .8), g);
      else { prop(-3, f * 1.5, 1.6, 1.6, .9, '#6b4423'); prop(3, f * 1.5, 1.6, 1.6, .9, '#6b4423'); }
    } else { prop(0, -f * (d / 2 - 1.5), 2, 1.2, .9, '#6b4423'); box(.5, .5, .5, '#4a2c1a', 1.8, .25, -f * (d / 2 - 1.5), g); }
    return g;
  }
  const wallBox = (x, z, w, d, h, col) => { box(w, h, d, col, x, height(x, z) + h / 2, z, scene); rects.push({ x, z, w, d }); };

  // --- Poeira Seca: rua principal, saloon e armaria ---
  house(0, -14, 16, 10, 6.5, '#8a5a33', { type: 'bar', sign: '#e0b030' });
  house(-17, -13, 9, 8, 5, '#a06a3c', { type: 'arm', sign: '#8a1f1f' });
  house(17, -13, 9, 8, 5, '#7a4b2a');
  [[-22, 8], [-8, 7], [8, 8], [22, 7]].forEach(([x, w], i) => house(x, 14, w, 7, 4.5, i % 2 ? '#a06a3c' : '#7a4b2a', { f: -1 }));

  // --- Vila Ferradura: estação, celeiro, caixa d'água e trem parado ---
  const V = TOWNS[1];
  house(V.x, V.z - 14, 18, 8, 6, '#a8322a', { sign: '#f1d9a8', roof: '#2b2b2b' });
  house(V.x - 18, V.z + 16, 12, 10, 6, '#8a2a22', { f: -1 });
  house(V.x + 20, V.z + 12, 8, 7, 4.5, '#c9a66b', { f: -1 }); house(V.x + 20, V.z - 14, 8, 7, 4.5, '#7a4b2a');
  for (const [dx, dz] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) box(.5, 8, .5, '#4a2c1a', V.x - 20 + dx, 4, V.z - 14 + dz, scene);
  box(6, 4, 6, '#6b4423', V.x - 20, 10, V.z - 14, scene); rects.push({ x: V.x - 20, z: V.z - 14, w: 5, d: 5 });
  { const n = RAIL[2], dx = n.x - RAIL[1].x, dz = n.z - RAIL[1].z, l = Math.hypot(dx, dz), ux = dx / l, uz = dz / l, ang = Math.atan2(-dz, dx);
    [['#1a1a1a', 6], ['#7a2e1f', 7], ['#7a2e1f', 7]].forEach(([col, len], i) => {
      const px = RAIL[1].x + ux * (8 + i * 8), pz = RAIL[1].z + uz * (8 + i * 8), m = box(len, 2.4, 2.4, col, px, height(px, pz) + 1.5, pz, scene);
      m.rotation.y = ang; if (!i) { const ch = box(.9, 1.8, .9, '#1a1a1a', px + ux * 2, height(px, pz) + 3.3, pz + uz * 2, scene); }
    }); }

  // --- Forte Cinzento: muralha de pedra com portão ao sul ---
  const F = TOWNS[2], S = '#6f6a64';
  wallBox(F.x, F.z - 22, 46, 2, 5, S); wallBox(F.x - 22, F.z, 2, 46, 5, S); wallBox(F.x + 22, F.z, 2, 46, 5, S);
  wallBox(F.x - 14, F.z + 22, 18, 2, 5, S); wallBox(F.x + 14, F.z + 22, 18, 2, 5, S);
  for (const [dx, dz] of [[-22, -22], [22, -22], [-22, 22], [22, 22]]) wallBox(F.x + dx, F.z + dz, 5, 5, 9, '#5a554f');
  house(F.x - 9, F.z - 12, 9, 8, 5, S, { sign: '#3b5a8a', roof: '#3a3733' }); house(F.x + 9, F.z - 12, 9, 8, 5, S, { roof: '#3a3733' });
  house(F.x - 9, F.z + 10, 9, 8, 5, S, { f: -1, roof: '#3a3733' }); house(F.x + 9, F.z + 10, 9, 8, 5, S, { f: -1, roof: '#3a3733' });

  // --- Pântano Negro: cabanas sobre a lama, passarelas e árvores mortas ---
  const P = TOWNS[3];
  [[-10, 10], [10, 6], [-8, -12], [12, -10]].forEach(([dx, dz], i) => house(P.x + dx, P.z + dz, 8, 7, 4.5, i % 2 ? '#3f4a2c' : '#4a3b28', { f: dz > 0 ? -1 : 1, roof: '#2c3a22', floor: '#3a2c1c' }));
  box(34, .25, 2.4, '#4a3a22', P.x, height(P.x, P.z) + .3, P.z, scene); box(2.4, .25, 34, '#4a3a22', P.x, height(P.x, P.z) + .3, P.z, scene);
  for (let k = 0, tr = 0; k < 40 && tr < 400; tr++) {
    const a = rand(0, 6.28), d = rand(24, 62), x = P.x + Math.cos(a) * d, z = P.z + Math.sin(a) * d, y = height(x, z);
    if (y < WATER + .3) continue; k++;
    const t = new THREE.Group(); box(.5, 5, .5, '#3a2c1c', 0, 2.5, 0, t);
    box(.3, 2.2, .3, '#3a2c1c', .9, 4, 0, t).rotation.z = -.8; box(.3, 1.8, .3, '#3a2c1c', -.8, 3.4, 0, t).rotation.z = .8;
    t.position.set(x, y, z); scene.add(t);
  }
  for (let k = 0, tr = 0; k < 90 && tr < 600; tr++) {
    const a = rand(0, 6.28), d = rand(22, 62), x = P.x + Math.cos(a) * d, z = P.z + Math.sin(a) * d, y = height(x, z);
    if (y > WATER + 1.2) continue; k++; box(.1, 1.4, .1, '#6f8a3a', x, y + .7, z, scene);
  }

  // --- trilhos ligando as cidades ---
  const segs = [];
  RAIL.forEach((a, i) => {
    const b = RAIL[(i + 1) % RAIL.length], dx = b.x - a.x, dz = b.z - a.z, n = Math.floor(Math.hypot(dx, dz) / 3);
    for (let k = 0; k < n; k++) segs.push([a.x + dx * k / n, a.z + dz * k / n, Math.atan2(-dz, dx), dx, dz]);
  });
  const mk = (geo, col, cnt) => { const m = new THREE.InstancedMesh(geo, M(col), cnt); scene.add(m); return m; };
  const sl = mk(new THREE.BoxGeometry(.5, .2, 2.4), '#4a2c1a', segs.length);
  const r1 = mk(new THREE.BoxGeometry(3.1, .25, .18), '#8a8a8a', segs.length), r2 = mk(new THREE.BoxGeometry(3.1, .25, .18), '#8a8a8a', segs.length);
  const o = new THREE.Object3D();
  segs.forEach(([x, z, ang, dx, dz], i) => {
    const l = Math.hypot(dx, dz), px = -dz / l * .7, pz = dx / l * .7, y = Math.max(height(x, z), WATER + .05);
    [[sl, 0, .1], [r1, 1, .25], [r2, -1, .25]].forEach(([m, s, dy]) => {
      o.position.set(x + px * s, y + dy, z + pz * s); o.rotation.set(0, ang, 0); o.updateMatrix(); m.setMatrixAt(i, o.matrix);
    });
  });
  [sl, r1, r2].forEach(m => { m.instanceMatrix.needsUpdate = true; });

  // --- mina: labirinto de túneis com paredes de pedra ---
  const CW = 6, CH = 5, CS = 8, WT = 1.2, WH = 5, EC = 2;
  const ox = MINE.x - CW * CS / 2, oz = MINE.z - CH * CS / 2, my = height(MINE.x, MINE.z);
  const hO = Array.from({ length: CH + 1 }, () => Array(CW).fill(false)), vO = Array.from({ length: CH }, () => Array(CW + 1).fill(false));
  const seen = Array.from({ length: CH }, () => Array(CW).fill(false));
  (function carve(cc, r) {
    seen[r][cc] = true;
    for (const [dc, dr] of shuffle([[1, 0], [-1, 0], [0, 1], [0, -1]])) {
      const nc = cc + dc, nr = r + dr; if (nc < 0 || nr < 0 || nc >= CW || nr >= CH || seen[nr][nc]) continue;
      if (dc) vO[r][Math.max(cc, nc)] = true; else hO[Math.max(r, nr)][cc] = true; carve(nc, nr);
    }
  })(EC, CH - 1);
  for (let k = 0; k < 6; k++) { if (k & 1) vO[Math.floor(rand(0, CH))][1 + Math.floor(rand(0, CW - 1))] = true; else hO[1 + Math.floor(rand(0, CH - 1))][Math.floor(rand(0, CW))] = true; }
  hO[CH][EC] = true;                                  // entrada ao sul
  const stone = ['#5d5750', '#665f57', '#524d47'];
  const rock = (x, z, w, d) => { box(w, WH, d, stone[Math.floor(rand(0, 3))], x, my + WH / 2, z, scene); rects.push({ x, z, w, d }); };
  for (let r = 0; r <= CH; r++) for (let cc = 0; cc < CW; cc++) if (!hO[r][cc]) rock(ox + (cc + .5) * CS, oz + r * CS, CS + WT, WT);
  for (let r = 0; r < CH; r++) for (let cc = 0; cc <= CW; cc++) if (!vO[r][cc]) rock(ox + cc * CS, oz + (r + .5) * CS, WT, CS + WT);
  box(CW * CS + 2, .6, CH * CS + 2, '#3b3733', MINE.x, my + WH + .3, MINE.z, scene);
  const gx = ox + (EC + .5) * CS, gz = oz + CH * CS;
  box(.7, WH, .7, '#4a2c1a', gx - 3.6, my + WH / 2, gz + .4, scene); box(.7, WH, .7, '#4a2c1a', gx + 3.6, my + WH / 2, gz + .4, scene);
  box(8, .7, .9, '#4a2c1a', gx, my + WH - .3, gz + .4, scene);
  // distância de cada cela até a entrada (quanto mais fundo, melhores os minérios)
  const dist = Array.from({ length: CH }, () => Array(CW).fill(-1)), q = [[EC, CH - 1]]; dist[CH - 1][EC] = 0;
  while (q.length) {
    const [cc, r] = q.shift(), d0 = dist[r][cc];
    [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dc, dr]) => {
      const nc = cc + dc, nr = r + dr; if (nc < 0 || nr < 0 || nc >= CW || nr >= CH || dist[nr][nc] >= 0) return;
      const ok = dc ? vO[r][Math.max(cc, nc)] : hO[Math.max(r, nr)][cc]; if (ok) { dist[nr][nc] = d0 + 1; q.push([nc, nr]); }
    });
  }
  const mx = Math.max(...dist.flat());
  for (let r = 0; r < CH; r++) for (let cc = 0; cc < CW; cc++) if (!(cc === EC && r === CH - 1)) W.slots.push({ x: ox + (cc + .5) * CS, z: oz + (r + .5) * CS, d: dist[r][cc] / mx });
  // barraca do minerador, fora da entrada
  const tx = gx + 13, tz = gz + 7, tent = new THREE.Group(), th = height(tx, tz);
  box(4.6, .25, 6.4, '#c9a66b', -1.7, 2.1, 0, tent).rotation.z = .75; box(4.6, .25, 6.4, '#b8935a', 1.7, 2.1, 0, tent).rotation.z = -.75;
  box(6, 3.2, .2, '#8a6a3c', 0, 1.6, -3.1, tent); box(3, 1, .8, '#6b4423', 0, .5, 1.2, tent); npc(tent, 0, -.2, '#6b4423', '#7a6a2a');
  tent.position.set(tx, th, tz); scene.add(tent); NPCS.push({ x: tx, z: tz - .2, type: 'mina' });

  const lamp = new THREE.PointLight(0xffaa55, 1.6, 24); lamp.visible = false; scene.add(lamp);
  let cur = null;
  W.update = p => {
    let ins = null;
    for (const h of HS) {
      const i = Math.abs(p.x - h.x) < h.w / 2 - .3 && Math.abs(p.z - h.z) < h.d / 2 - .3; h.roof.visible = !i;
      if (i) ins = { x0: h.x - h.w / 2 + .5, x1: h.x + h.w / 2 - .5, z0: h.z - h.d / 2 + .5, z1: h.z + h.d / 2 - .5 };
    }
    const inMine = Math.abs(p.x - MINE.x) < CW * CS / 2 && Math.abs(p.z - MINE.z) < CH * CS / 2;
    if (inMine) ins = { x0: ox + .5, x1: ox + CW * CS - .5, z0: oz + .5, z1: oz + CH * CS - .5 };
    lamp.visible = inMine;
    if (inMine) { lamp.position.set(p.x, p.y + 2.6, p.z); hemi.intensity = .22; sun.intensity = 0; }
    W.inside = ins;
    const t = TOWNS.find(t => Math.hypot(p.x - t.x, p.z - t.z) < 42);
    if (t !== cur) { cur = t; if (t) toast('Cidade: ' + t.name); }
  };
  return W;
}
