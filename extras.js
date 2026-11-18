// Menu, roda de armas, mina, loja, dinheiro, mapa e sons
import * as A from './audio.js';
const TAU = Math.PI * 2, clamp = (v, a, b) => Math.min(b, Math.max(a, v)), rand = (a, b) => a + Math.random() * (b - a);
const ORES = [
  { n: 'Carvão', c: '#161616', v: 2, hp: 2, w: 30 }, { n: 'Cobre', c: '#d2783c', v: 6, hp: 3, w: 22 },
  { n: 'Ferro', c: '#b08a7a', v: 12, hp: 4, w: 18 }, { n: 'Prata', c: '#dfe6ea', v: 30, hp: 6, w: 12 },
  { n: 'Ouro', c: '#f4c430', v: 75, hp: 8, w: 8 }, { n: 'Esmeralda', c: '#2ecc71', v: 180, hp: 10, w: 5 },
  { n: 'Diamante', c: '#7be7ff', v: 450, hp: 14, w: 3 }];
const PICKS = [null, { n: 'Picareta de madeira', price: 0, dmg: 1, cd: .8 }, { n: 'Picareta de ferro', price: 150, dmg: 2, cd: .6 },
  { n: 'Picareta de ouro', price: 600, dmg: 3, cd: .5 }, { n: 'Picareta de diamante', price: 2500, dmg: 5, cd: .4 }];
const OPT = ['none', 'revolver', 'rifle', 'pick'];

export function init(c) {
  const { THREE, scene, camera, renderer, player: p, pm, H, height, box, M, toast, MINE, WATER, fireRay, NPCS, TOWNS, RAIL, W } = c;
  const $ = id => document.getElementById(id);
  const X = { locked: false, timeScale: 1, panel: 'start', dayMin: 20, thud: A.thud };
  const S = { master: .8, music: .5, sfx: .8, fov: 70, day: 20, gfx: 1 };
  try { Object.assign(S, JSON.parse(localStorage.getItem('pdr3d-s'))); Object.assign(p, JSON.parse(localStorage.getItem('pdr3d-p'))); } catch (e) {}
  const store = () => { try { localStorage.setItem('pdr3d-s', JSON.stringify(S)); localStorage.setItem('pdr3d-p', JSON.stringify({ money: p.money, bag: p.bag, pick: p.pick, rifle: p.rifle })); } catch (e) {} };
  let rl = 0, cd = 0, swing = 0, flash = 0, wheelOn = false, mapOn = false, wx = 0, wy = 0, sel = 0, gal = 0;
  const bagVal = () => Object.entries(p.bag).reduce((s, [i, n]) => s + n * ORES[i].v, 0);
  const bagN = () => Object.values(p.bag).reduce((s, n) => s + n, 0);

  // ----- configurações -----
  ['master', 'music', 'sfx'].forEach(k => {
    const el = $('s-' + k); el.value = S[k] * 100; A.vol[k] = S[k];
    el.oninput = () => { S[k] = el.value / 100; A.vol[k] = S[k]; A.setVol(); store(); };
  });
  const applyGfx = () => {
    renderer.setPixelRatio([.6, 1, Math.min(devicePixelRatio, 2)][S.gfx]); renderer.setSize(innerWidth, innerHeight);
    scene.fog.far = [120, 190, 230][S.gfx];
  };
  const applyView = () => { camera.fov = S.fov; camera.updateProjectionMatrix(); X.dayMin = S.day; $('v-fov').textContent = S.fov; $('v-day').textContent = S.day; };
  $('s-fov').value = S.fov; $('s-day').value = S.day; $('s-gfx').value = S.gfx;
  $('s-fov').oninput = () => { S.fov = +$('s-fov').value; applyView(); store(); };
  $('s-day').oninput = () => { S.day = +$('s-day').value; applyView(); store(); };
  $('s-gfx').onchange = () => { S.gfx = +$('s-gfx').value; applyGfx(); store(); };
  applyGfx(); applyView();

  // ----- painéis -----
  function show(n) {
    X.panel = n;
    $('tela').style.display = ['start', 'pause', 'dead'].includes(n) ? 'flex' : 'none';
    $('loja').style.display = n === 'shop' ? 'block' : 'none';
    const T = { start: ['Poeira Maldita: Mundo Aberto', 'Jogar'], pause: ['Pausado', 'Continuar'], dead: ['Você morreu', 'Tentar de novo'] }[n];
    if (T) { $('titulo').textContent = T[0]; $('btn').textContent = T[1]; store(); }
    if (n === 'shop') renderShop();
  }
  X.die = () => { document.exitPointerLock(); show('dead'); };
  $('btn').onclick = () => { if (p.hp <= 0) c.respawn(); A.init(); A.setVol(); renderer.domElement.requestPointerLock(); };
  document.addEventListener('pointerlockchange', () => {
    X.locked = document.pointerLockElement === renderer.domElement;
    if (X.locked) show(null);
    else { wheelOn = mapOn = false; $('roda').style.display = $('mapa').style.display = 'none'; X.timeScale = 1; if (X.panel === null && p.hp > 0) show('pause'); }
  });

  // ----- lojas (vendedores NPC) -----
  let shopT = 'mina';
  const SH = {
    mina: { nome: 'Zeca, o Minerador', fala: 'Fala, forasteiro! Traz os minérios que eu pago bem. A primeira picareta é por minha conta.' },
    arm: { nome: 'Dona Berta, Armeira', fala: 'Aqui só tem coisa boa. Cano longo, tiro certeiro.' },
    bar: { nome: 'Tião, Barman', fala: 'Senta aí, forasteiro. Uma dose e você sai novo.' }
  };
  const btn = (a, t, off) => `<button data-a="${a}" ${off ? 'disabled' : ''}>${t}</button>`;
  function renderShop() {
    const s = SH[shopT], v = bagVal();
    let h = `<div class="ret"></div><h2>${s.nome}</h2><p><i>“${s.fala}”</i></p><p>Dinheiro: $${p.money}</p>`;
    if (shopT === 'mina') {
      h += `<p>Mochila: ${ORES.map((o, i) => p.bag[i] ? p.bag[i] + 'x ' + o.n : '').filter(Boolean).join(', ') || 'vazia'}</p>` + btn('sell', `Vender tudo (+$${v})`, !v) + '<hr>';
      PICKS.forEach((k, i) => {
        if (!k) return;
        const own = p.pick >= i, can = p.pick === i - 1 && p.money >= k.price;
        h += btn('b' + i, `${k.n} ${own ? '(sua)' : k.price ? '$' + k.price : '(grátis)'}`, own || !can);
      });
    } else if (shopT === 'arm') h += btn('rifle', 'Rifle ' + (p.rifle ? '(seu)' : '$350'), p.rifle || p.money < 350);
    else h += btn('heal', 'Curar toda a vida $20', p.hp >= 100 || p.money < 20);
    $('loja').innerHTML = h + '<hr><button data-a="x">Fechar</button>';
  }
  $('loja').onclick = e => {
    const a = e.target.dataset.a; if (!a) return;
    if (a === 'sell') { p.money += bagVal(); p.bag = {}; A.coin(); }
    else if (a === 'rifle') { p.money -= 350; p.rifle = true; A.coin(); toast('Rifle comprado'); }
    else if (a === 'heal') { p.money -= 20; p.hp = 100; A.coin(); }
    else if (a[0] === 'b') { const i = +a.slice(1); p.money -= PICKS[i].price; p.pick = i; A.coin(); toast(PICKS[i].n + ' pronta'); }
    else { show(null); renderer.domElement.requestPointerLock(); setTimeout(() => { if (!X.locked && X.panel === null) show('pause'); }, 400); return; }
    store(); renderShop();
  };

  // ----- mina: minérios espalhados pelo túnel -----
  const dir = new THREE.Vector3(), v = new THREE.Vector3(), nodes = []; let left = 0;
  const pickOre = d => { let b = 0; for (let k = 0; k < 1 + Math.floor(d * 3); k++) { let r = Math.random() * 98, i = 0; while (i < 6 && r > ORES[i].w) r -= ORES[i++].w; b = Math.max(b, i); } return b; };
  function mkNode(x, z, ty) {
    const o = ORES[ty], g = new THREE.Group(), y = height(x, z);
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(1.1), M('#6b6560')); rock.scale.y = .8; rock.position.y = .7; g.add(rock);
    const mat = new THREE.MeshLambertMaterial({ color: o.c, emissive: o.c, emissiveIntensity: ty > 3 ? .5 : ty > 1 ? .15 : 0 });
    for (let j = 0; j < 4; j++) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(.45, .45, .45), mat), aa = j * 1.6 + rand(0, 1);
      m.position.set(Math.cos(aa) * .8, .8 + rand(0, .5), Math.sin(aa) * .8); m.rotation.set(rand(0, 3), rand(0, 3), 0); g.add(m);
    }
    g.position.set(x, y, z); g.rotation.y = rand(0, 6); scene.add(g);
    return { g, ty, hp: o.hp, x, z, y, alive: true };
  }
  function layout() {                      // sorteia de novo onde ficam os minérios
    nodes.forEach(n => scene.remove(n.g)); nodes.length = 0;
    [...W.slots].sort(() => Math.random() - .5).slice(0, 22).forEach(s => nodes.push(mkNode(s.x + rand(-2, 2), s.z + rand(-2, 2), pickOre(s.d))));
    left = nodes.length;
  }
  layout();
  function mine() {
    if (cd > 0) return; const pk = PICKS[p.pick]; cd = pk.cd; swing = .3;
    camera.getWorldDirection(dir); let best = null;
    for (const n of nodes) {
      if (!n.alive || Math.hypot(n.x - p.x, n.z - p.z) > 5) continue;
      v.set(n.x, n.y + .8, n.z).sub(camera.position); const t = v.dot(dir);
      if (t > 0 && v.addScaledVector(dir, -t).length() < 1.8 && (!best || t < best.t)) best = { n, t };
    }
    if (!best) { A.hit(); return; }
    const n = best.n; n.hp -= pk.dmg; A.hit(n.ty > 3);
    if (n.hp <= 0) {
      p.bag[n.ty] = (p.bag[n.ty] || 0) + 1; toast('+1 ' + ORES[n.ty].n); A.coin(); n.g.visible = false; n.alive = false; store();
      if (--left === 0) setTimeout(() => { toast('A mina foi reabastecida! Os minérios mudaram de lugar'); layout(); }, 2200);
    }
  }

  // ----- armas na mão -----
  const WC = { revolver: { max: 6, cd: .35, rl: 1.5, dmg: 1, range: 100, key: 'ammo' }, rifle: { max: 5, cd: .9, rl: 2.2, dmg: 2, range: 160, key: 'ammoR' } };
  let rlW = 'revolver';
  const held = new THREE.Group(); held.position.set(.42, 1.2, .25); pm.add(held);
  const gun = new THREE.Group(); box(.1, .18, .5, '#2b2b2b', 0, 0, .25, gun); box(.08, .22, .1, '#5a3a1e', 0, -.18, .05, gun);
  const rif = new THREE.Group(); box(.08, .12, 1.1, '#3a2a1a', 0, 0, .5, rif); box(.05, .05, .7, '#2b2b2b', 0, .04, 1.2, rif);
  const fl = new THREE.Mesh(new THREE.SphereGeometry(.14, 6, 6), new THREE.MeshBasicMaterial({ color: 0xffd060 })); fl.visible = false; held.add(fl);
  const pkG = new THREE.Group(); box(.06, 1.1, .06, '#6b4423', 0, .1, .1, pkG); box(.7, .12, .12, '#9a9a9a', 0, .65, .1, pkG);
  held.add(gun, rif, pkG);
  const equip = w => {
    if (w === 'pick' && !p.pick) { toast('Fale com o Zeca, na barraca da mina, para pegar a picareta'); return; }
    if (w === 'rifle' && !p.rifle) { toast('Compre o rifle na armaria da cidade'); return; }
    p.weapon = w; A.click();
  };
  function reload() { const k = WC[p.weapon]; if (k && rl <= 0 && p[k.key] < k.max) { rl = k.rl; rlW = p.weapon; A.reload(); } }
  function fire() {
    const w = p.weapon, k = WC[w];
    if (rl > 0 || cd > 0) return;
    if (p[k.key] <= 0) { A.click(); reload(); return; }
    p[k.key]--; cd = k.cd; flash = .06; A.shot(w === 'rifle'); fireRay(k.dmg, k.range);
  }

  // ----- roda de armas -----
  const wEl = [0, 1, 2, 3].map(i => $('w' + i));
  function paint() {
    wEl.forEach((el, i) => el.classList.toggle('on', i === sel));
    wEl[0].textContent = 'Guardar arma'; wEl[1].textContent = 'Revólver .38 (' + p.ammo + '/6)';
    wEl[2].textContent = p.rifle ? 'Rifle (' + p.ammoR + '/5)' : 'Rifle (armaria)'; wEl[3].textContent = p.pick ? PICKS[p.pick].n : 'Picareta (mina)';
  }
  X.key = e => {
    if (e.repeat) return; const k = e.code;
    if (k === 'Escape' && X.panel === 'shop') { show('pause'); return; }
    if (!X.locked) return;
    if (k === 'KeyQ') { wheelOn = true; wx = wy = 0; sel = OPT.indexOf(p.weapon); $('roda').style.display = 'block'; paint(); X.timeScale = .2; }
    else if (k === 'KeyR') reload();
    else if (k === 'KeyE') {
      const n = NPCS.find(n => Math.hypot(p.x - n.x, p.z - n.z) < 4.5);
      if (n) { shopT = n.type; show('shop'); document.exitPointerLock(); }
      else if (p.mounted) { p.mounted = false; p.x += 2; }
      else if (Math.hypot(p.x - H.x, p.z - H.z) < 5) { p.mounted = true; toast('Montado no cavalo'); }
    }
    else if (k === 'KeyM') { mapOn = !mapOn; $('mapa').style.display = mapOn ? 'flex' : 'none'; X.timeScale = mapOn ? 0 : 1; }
    else if (k.startsWith('Digit') && +k[5] >= 1 && +k[5] <= 4) equip(OPT[+k[5] - 1]);
  };
  X.keyup = e => {
    if (e.code === 'KeyQ' && wheelOn) { wheelOn = false; $('roda').style.display = 'none'; X.timeScale = mapOn ? 0 : 1; equip(OPT[sel]); }
  };
  X.move = e => {
    if (!wheelOn) return mapOn;
    wx = clamp(wx + e.movementX, -90, 90); wy = clamp(wy + e.movementY, -90, 90);
    if (Math.hypot(wx, wy) > 30) sel = Math.floor((((Math.atan2(wx, -wy) + Math.PI / 4) % TAU) + TAU) % TAU / (TAU / 4));
    paint(); return true;
  };
  X.click = () => { if (wheelOn || mapOn) return; if (WC[p.weapon]) fire(); else if (p.weapon === 'pick') mine(); };

  // ----- mapa -----
  const base = document.createElement('canvas'); base.width = base.height = 200;
  { const g = base.getContext('2d');
    for (let y = 0; y < 200; y++) for (let x = 0; x < 200; x++) {
      const wx2 = (x - 100) * 2, wz = (y - 100) * 2, h = height(wx2, wz);
      g.fillStyle = h < WATER ? '#2d6f8f' : Math.hypot(wx2 - MINE.x, wz - MINE.z) < 20 ? '#8a8580' : h < 1.5 ? '#c9a66b' : '#a8793f';
      g.fillRect(x, y, 1, 1);
    } }
  function drawMap(cv, full) {
    const g = cv.getContext('2d'), s = cv.width, span = full ? 400 : 120, k = s / span;
    const ox = full ? -200 : p.x - 60, oz = full ? -200 : p.z - 60;
    g.fillStyle = '#2d6f8f'; g.fillRect(0, 0, s, s);
    g.drawImage(base, (ox + 200) / 2, (oz + 200) / 2, span / 2, span / 2, 0, 0, s, s);
    const dot = (x, z, col, r, label, edge) => {
      let px = (x - ox) * k, pz = (z - oz) * k;
      if (edge) { px = clamp(px, 8, s - 8); pz = clamp(pz, 8, s - 8); }
      g.fillStyle = col; g.beginPath(); g.arc(px, pz, r, 0, TAU); g.fill();
      if (label) { g.fillStyle = '#1e120c'; g.font = 'bold 14px Georgia'; g.fillText(label, px + r + 3, pz + 5); }
    };
    g.strokeStyle = '#2a2a2a'; g.lineWidth = full ? 3 : 2; g.beginPath();
    RAIL.forEach((r, i) => { const px = (r.x - ox) * k, pz = (r.z - oz) * k; if (i) g.lineTo(px, pz); else g.moveTo(px, pz); });
    g.closePath(); g.stroke();
    TOWNS.forEach(t => dot(t.x, t.z, '#6b4423', full ? 7 : 4, full ? t.name : ''));
    dot(MINE.x, MINE.z, '#ff8a00', full ? 8 : 5, full ? 'Mina' : '', !full);
    dot(H.x, H.z, '#fff', 4, full ? 'Cavalo' : '');
    g.save(); g.translate((p.x - ox) * k, (p.z - oz) * k); g.rotate(p.face + Math.PI / 2);
    g.fillStyle = '#e24a33'; g.strokeStyle = '#fff'; g.beginPath(); g.moveTo(0, -8); g.lineTo(6, 7); g.lineTo(-6, 7); g.closePath(); g.fill(); g.stroke(); g.restore();
  }

  // ----- atualização -----
  X.update = dt => {
    cd -= dt; swing = Math.max(0, swing - dt); flash = Math.max(0, flash - dt);
    if (rl > 0) { rl -= dt; if (rl <= 0) p[WC[rlW].key] = WC[rlW].max; }
    gun.visible = p.weapon === 'revolver'; rif.visible = p.weapon === 'rifle'; pkG.visible = p.weapon === 'pick'; held.visible = p.weapon !== 'none';
    fl.visible = flash > 0; fl.position.z = p.weapon === 'rifle' ? 1.6 : .6; pkG.rotation.x = swing > 0 ? -1.2 + (1 - swing / .3) * 2.2 : -.3;
    if (p.mounted && dt > 0 && (gal -= dt) <= 0) { gal = .25; if (p.moving) A.thud(); }
    drawMap($('mm'), false); if (mapOn) drawMap($('mapc'), true);
  };
  X.hud = () => {
    const w = p.weapon, hr = (c.getTod() * 24 + 6) % 24, n = bagN(), k = WC[w], np = NPCS.find(n => Math.hypot(p.x - n.x, p.z - n.z) < 4.5);
    $('din').textContent = '$ ' + p.money;
    $('bala').textContent = k ? (rl > 0 ? 'Recarregando...' : (w === 'rifle' ? 'Rifle ' : 'Revólver .38  ') + p[k.key] + '/' + k.max + (p[k.key] ? '' : ' (aperte R)')) : w === 'pick' ? PICKS[p.pick].n : 'Armas guardadas (segure Q)';
    $('hora').textContent = String(Math.floor(hr)).padStart(2, '0') + ':' + String(Math.floor((hr % 1) * 60)).padStart(2, '0');
    $('caca').innerHTML = 'Búfalos: ' + p.score.buffalo + '<br>Jacarés: ' + p.score.gator + '<br>Coiotes: ' + p.score.coyote + (n ? '<br>Mochila: ' + n + ' minérios ($' + bagVal() + ')' : '');
    $('dica').textContent = np ? 'E: falar com ' + SH[np.type].nome.split(',')[0] : p.mounted ? 'E: descer do cavalo'
      : Math.hypot(p.x - H.x, p.z - H.z) < 5 ? 'E: montar no cavalo' : '';
  };
  show('start');
  return X;
}
