// Blocky rank emblems (SVG strings), one per rank in ranks.js, drawn like the Today tiles' emblems: flat facets
// and a thick ink line. Kept apart from ranks.js because the server imports that file and never draws.
const INK = '#3b2219';
const f = n => +n.toFixed(1);
const pts = a => a.map(([x, y]) => `${f(x)} ${f(y)}`).join(' ');
const poly = (a, fill, extra = '') => `<path d="M${pts(a)}z" fill="${fill}" ${extra}/>`;
const ring = (cx, cy, r, n, a0 = 0) => Array.from({ length: n }, (_, i) => { const a = a0 + i / n * Math.PI * 2; return [cx + Math.cos(a) * r, cy + Math.sin(a) * r]; });
const wrap = (body, sw = 5) => `<svg class="rkic" viewBox="0 0 120 120" aria-hidden="true"><g stroke="${INK}" stroke-width="${sw}" stroke-linejoin="round" stroke-linecap="round">${body}</g></svg>`;
const thin = 'stroke-width="2.5"';

function star() {
  const o = ring(60, 64, 54, 5, -Math.PI / 2), i = ring(60, 64, 23, 5, -Math.PI / 2 + Math.PI / 5), c = [60, 64];
  let s = '';
  for (let k = 0; k < 5; k++) s += poly([c, o[k], i[k]], '#ffe27a', thin) + poly([c, i[k], o[(k + 1) % 5]], '#f5a623', thin);
  const out = []; for (let k = 0; k < 5; k++) out.push(o[k], i[k]);
  return s + poly(out, 'none');
}
function sun() {
  const core = ring(60, 60, 30, 8, Math.PI / 8), tip = ring(60, 60, 56, 8, 0);
  let s = '';
  for (let k = 0; k < 8; k++) s += poly([core[(k + 7) % 8], tip[k], core[k]], k % 2 ? '#ffd24a' : '#ffb547');
  return s + poly(core, '#ff9a3d') + poly([core[4], core[5], core[6], core[7], [60, 60]], '#ffc15a', thin) + poly(core, 'none');
}
function rainbow() {
  const band = (ro, ri, fill) => { const a = k => Math.PI + k / 4 * Math.PI, P = (r, k) => [60 + Math.cos(a(k)) * r, 88 + Math.sin(a(k)) * r];
    return poly([...[0, 1, 2, 3, 4].map(k => P(ro, k)), ...[4, 3, 2, 1, 0].map(k => P(ri, k))], fill); };
  return band(56, 42, '#e5543b') + band(42, 29, '#ffd24a') + band(29, 16, '#6fbdf2')
    + poly([[4, 88], [10, 76], [24, 72], [36, 80], [38, 96], [8, 98]], '#fff') + poly([[84, 96], [84, 80], [96, 72], [110, 76], [116, 88], [112, 98]], '#fff');
}

export const RANK_ICONS = {
  seed: wrap(`<path d="M60 86V52" fill="none" stroke-width="7"/><path d="M20 104 36 84h48l16 20z" fill="#a8703f"/>
    <path d="M60 60 30 54 22 26 50 32z" fill="#6fc266"/><path d="M60 52 72 18 102 20 92 46z" fill="#8fd973"/>
    <path d="M60 60 22 26M60 52 102 20" fill="none" ${thin}/>`),
  chick: wrap(`<path d="M52 36 48 18l12 9 6-13 6 22z" fill="#ffd24a"/><path d="M92 50l22 10-22 10z" fill="#ff9a3d"/>
    <path d="M26 62 42 34h38l16 26-10 38H38z" fill="#ffd24a"/><path d="M26 62 38 98h48l4-14H44z" fill="#f5b52e" ${thin}/>
    <path d="M36 60h26l-8 22H42z" fill="#f5a623"/><circle cx="76" cy="52" r="5" fill="${INK}" stroke="none"/>
    <path d="M50 98v12M72 98v12" fill="none"/>`),
  kite: wrap(`<path d="M52 88c-12 8 2 14-10 20s-12 4-22 8" fill="none"/><path d="M36 100l-8-8v14zM36 100l10 2-6 10z" fill="#6fbdf2" stroke-width="3.5"/>
    <path d="M66 8 30 38 62 44z" fill="#ff8fab"/><path d="M66 8 98 44H62z" fill="#e5543b"/><path d="M30 38 52 88 62 44z" fill="#ffd24a"/><path d="M98 44 52 88 62 44z" fill="#ff9a3d"/>`),
  cloud: wrap(`<path d="M16 88 8 68 22 54 28 34 50 24 68 32 86 28 102 44 100 58 112 72 104 88z" fill="#fff"/>
    <path d="M10 72h101l-7 16H16z" fill="#c5e2f6" ${thin}/><path d="M16 88 8 68 22 54 28 34 50 24 68 32 86 28 102 44 100 58 112 72 104 88z" fill="none"/>`),
  plane: wrap(`<path d="M110 20 10 52 46 68z" fill="#fff4e2"/><path d="M110 20 46 68 52 102z" fill="#9fd0ee"/><path d="M110 20 52 102 70 76z" fill="#6fbdf2"/>
    <path d="M8 96h18M20 108h14" fill="none" stroke="#fff" stroke-width="5"/>`),
  isle: wrap(`<path d="M28 60h64L76 86 62 110 44 88z" fill="#c98a5a"/><path d="M62 60h30L76 86 62 110z" fill="#a8703f" ${thin}/>
    <path d="M12 52 32 38h56l20 14-16 12H28z" fill="#7cc35a"/><path d="M56 40h8v10h-8z" fill="#8a4a3a"/><path d="M60 8 44 40h32z" fill="#3f9d57"/>`),
  balloon: wrap(`<path d="M44 76 50 94M76 76 70 94" fill="none" stroke-width="3.5"/><path d="M48 94h24v16H48z" fill="#c98a5a"/>
    <path d="M60 8 90 18 102 44 86 72 60 82 34 72 18 44 30 18z" fill="#e5543b"/><path d="M60 8 74 13 80 44 72 77 60 82 48 77 40 44 46 13z" fill="#ffd24a" ${thin}/>
    <path d="M60 8 90 18 102 44 86 72 60 82 34 72 18 44 30 18z" fill="none"/>`),
  compass: wrap(`<path d="M50 4h20v16H50z" fill="#f5a623"/><path d="M104 82 78 108H42L16 82V46L42 20h36l26 26z" fill="#ffb547"/>
    <path d="M91 77 73 95H47L29 77V51l18-18h26l18 18z" fill="#fff4e2" stroke-width="3.5"/>
    <path d="M78 42 68 72 52 56z" fill="#e5543b" stroke-width="3"/><path d="M42 86 68 72 52 56z" fill="#9fd0ee" stroke-width="3"/>`),
  ship: wrap(`<path d="M46 72 52 86M76 72 72 86" fill="none" stroke-width="3.5"/><path d="M44 86h36l-6 18H50z" fill="#c98a5a"/>
    <path d="M22 50 4 28l26 6zM22 50 4 72l26-6z" fill="#ffb547"/><path d="M12 50 34 26h50l28 24-28 24H34z" fill="#e5543b"/>
    <path d="M12 50h100L84 74H34z" fill="#c23f2c" ${thin}/><path d="M12 50 34 26h50l28 24-28 24H34z" fill="none"/><path d="M62 38h14v10H62z" fill="#bfe6ff" stroke-width="3"/>`),
  bolt: wrap(`<path d="M72 4 24 66h28l-8 50 54-68H66z" fill="#ffe27a"/><path d="M66 48 52 66 44 116 98 48z" fill="#f5a623" ${thin}/><path d="M72 4 24 66h28l-8 50 54-68H66z" fill="none"/>`),
  rainbow: wrap(rainbow()),
  moon: wrap(`<path d="M76 10 44 14 20 38 14 70 32 98 64 110 98 100 70 88 54 64 58 34z" fill="#ffe08a"/><path d="M14 70 32 98 64 110 98 100 70 88 40 78z" fill="#f5bd42" ${thin}/>
    <path d="M76 10 44 14 20 38 14 70 32 98 64 110 98 100 70 88 54 64 58 34z" fill="none"/><path d="M92 26l5 10 10 5-10 5-5 10-5-10-10-5 10-5z" fill="#fff" stroke-width="3.5"/>`),
  star: wrap(star()),
  comet: wrap(`<path d="M30 50 114 6 72 92z" fill="#6fbdf2"/><path d="M44 62 114 6 62 80z" fill="#bfe6ff" ${thin}/>
    ${poly(ring(40, 80, 28, 6, 0), '#fff4e2')}<path d="M12 80h56L54 104.2H26z" fill="#ffd24a" ${thin}/>${poly(ring(40, 80, 28, 6, 0), 'none')}`),
  sun: wrap(sun(), 4.5),
  crown: wrap(`<path d="M16 90 8 34l28 24 24-42 24 42 28-24-8 56z" fill="#ffd24a"/><path d="M60 16 84 58 112 34 104 90H60z" fill="#f5b52e" ${thin}/>
    <path d="M16 90 8 34l28 24 24-42 24 42 28-24-8 56z" fill="none"/><path d="M14 90h92v18H14z" fill="#f5a623"/>
    <path d="M60 60l10 12-10 12-10-12z" fill="#e5543b" stroke-width="3.5"/><path d="M30 99h0M60 99h0M90 99h0" stroke="#fff4e2" stroke-width="7"/>`),
};
export const rankIcon = k => RANK_ICONS[k] || RANK_ICONS.seed;
