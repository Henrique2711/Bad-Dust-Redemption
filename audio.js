// Sons e música gerados no navegador (nenhum arquivo de áudio necessário)
let ac, out, mus, sfx, echo, buf, nextT = 0, step = 0;
export const vol = { master: .8, music: .5, sfx: .8 };
export function setVol() { if (ac) { out.gain.value = vol.master; mus.gain.value = vol.music * .5; sfx.gain.value = vol.sfx; } }
export function init() {
  if (ac) { ac.resume(); return; }
  ac = new (window.AudioContext || window.webkitAudioContext)();
  out = ac.createGain(); out.connect(ac.destination);
  mus = ac.createGain(); mus.connect(out); sfx = ac.createGain(); sfx.connect(out);
  echo = ac.createDelay(); echo.delayTime.value = .21;
  const fb = ac.createGain(); fb.gain.value = .28; echo.connect(fb); fb.connect(echo); echo.connect(sfx);
  buf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
  const d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  setVol(); nextT = ac.currentTime + .1; setInterval(tick, 150);
}
function noise(t, dur, type, f, g, wet) {
  const s = ac.createBufferSource(); s.buffer = buf;
  const fl = ac.createBiquadFilter(); fl.type = type; fl.frequency.value = f;
  const gn = ac.createGain(); gn.gain.setValueAtTime(g, t); gn.gain.exponentialRampToValueAtTime(.001, t + dur);
  s.connect(fl); fl.connect(gn); gn.connect(sfx); if (wet) gn.connect(echo);
  s.start(t); s.stop(t + dur);
}
function tone(t, f0, f1, dur, g, type = 'sine') {
  const o = ac.createOscillator(); o.type = type;
  o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  const gn = ac.createGain(); gn.gain.setValueAtTime(g, t); gn.gain.exponentialRampToValueAtTime(.001, t + dur);
  o.connect(gn); gn.connect(sfx); o.start(t); o.stop(t + dur);
}
const now = () => ac.currentTime;
export const shot = () => { if (!ac) return; const t = now(); noise(t, .4, 'lowpass', 2600, 1, true); tone(t, 180, 35, .25, 1); noise(t, .05, 'highpass', 3000, .6); };
const cl = (t, f) => noise(t, .03, 'highpass', f, .5);
export const click = () => ac && cl(now(), 4000);
// recarregar: abre o tambor, gira o tambor do .38 e fecha
export const reload = () => {
  if (!ac) return; const t = now(); cl(t, 2500);
  for (let i = 0; i < 10; i++) noise(t + .2 + i * (.03 + i * .006), .02, 'bandpass', 3000 + i * 150, .35);
  cl(t + 1.2, 1800); tone(t + 1.2, 200, 90, .1, .4);
};
export const hit = rare => { if (!ac) return; const t = now(); noise(t, .08, 'bandpass', 1500, .8); tone(t, 900, 650, .15, .25, 'triangle'); if (rare) tone(t + .05, 2200, 2600, .3, .12); };
export const coin = () => { if (!ac) return; const t = now(); tone(t, 1318, 1318, .12, .3); tone(t + .08, 1760, 1760, .3, .3); };
export const thud = () => ac && tone(now(), 120, 50, .15, .5);

const CH = [[52, 55, 59], [48, 52, 55], [50, 54, 57], [52, 55, 59]];
const hz = n => 440 * 2 ** ((n - 69) / 12);
function pluck(t, n, g) {
  const o = ac.createOscillator(); o.type = 'triangle'; o.frequency.value = hz(n);
  const fl = ac.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = 1600;
  const gn = ac.createGain(); gn.gain.setValueAtTime(.0001, t); gn.gain.linearRampToValueAtTime(g, t + .01); gn.gain.exponentialRampToValueAtTime(.0001, t + .9);
  o.connect(fl); fl.connect(gn); gn.connect(mus); o.start(t); o.stop(t + 1);
}
function whistle(t, n) {
  const o = ac.createOscillator(), l = ac.createOscillator(), lg = ac.createGain(), gn = ac.createGain();
  o.frequency.value = hz(n); l.frequency.value = 5; lg.gain.value = 5; l.connect(lg); lg.connect(o.frequency);
  gn.gain.setValueAtTime(.0001, t); gn.gain.linearRampToValueAtTime(.09, t + .2); gn.gain.exponentialRampToValueAtTime(.0001, t + 1.3);
  o.connect(gn); gn.connect(mus); o.start(t); l.start(t); o.stop(t + 1.4); l.stop(t + 1.4);
}
function tick() {
  while (nextT < ac.currentTime + .4) {
    const c = CH[(step >> 3) % 4], k = step & 7;
    pluck(nextT, k ? c[[0, 1, 2, 1, 0, 1, 2, 1][k]] : c[0] - 12, k ? .2 : .35);
    if ((k === 0 || k === 4) && Math.random() < .5) whistle(nextT, [64, 67, 69, 71, 74][Math.floor(Math.random() * 5)]);
    nextT += .4167; step++;
  }
}
