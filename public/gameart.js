// The pictures on the hub's game cards (SVG strings), all built from one small kit so they match:
// a 320x150 sky, one floating island in the same place, and one or two chunky game pieces standing on it.
// Rules of the kit: every outline is 3 wide in the ink colour, boxes have a light top and a dark side,
// corners stay sharp (blocky, low-poly), and nothing important sits in the top right corner (the "?" button lives there).
// Sky, clouds, island and outline colours come from CSS variables (--art-*, --ink) so day and night are set in style.css.

const INK = 'var(--ink, #3b2219)';
const O = `stroke="${INK}" stroke-width="3" stroke-linejoin="round"`;
const C = { red: '#e5543b', orange: '#ffb547', yellow: '#ffd95a', mint: '#7ed3b2', pink: '#ff8fab', blue: '#6fa8ff', violet: '#9aa8ff', cream: '#fff4e2', wood: '#c98a5a', bark: '#8a5a3c', grey: '#a9a6b0', steel: '#7d8597', green: '#6fc45a', leaf: '#4fa64a', night: '#2f3566' };
const TICK = 'var(--art-tick, #3b2219)';
const LIGHT = 'fill="#fff" fill-opacity=".4" stroke="none"', DARK = 'fill="#1d1030" fill-opacity=".24" stroke="none"';

// A box seen from the front, a little from above and from the left: (x, y) is the top left of the front face, d is the depth.
function box(x, y, w, h, c, d = 8) {
  const k = d * .6;
  return `<g ${O}><path d="M${x} ${y + h}V${y}l${d} ${-k}h${w}v${h}l${-d} ${k}z" fill="${c}"/>`
    + `<path d="M${x} ${y}l${d} ${-k}h${w}l${-d} ${k}z" ${LIGHT}/><path d="M${x + w} ${y}l${d} ${-k}v${h}l${-d} ${k}z" ${DARK}/>`
    + `<path d="M${x} ${y}h${w}l${d} ${-k}M${x + w} ${y}v${h}" fill="none"/></g>`;
}
// A thick line with the same 3 wide outline as everything else.
const rod = (d, c, w = 5, cap = 'square') => `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${w + 6}" stroke-linecap="${cap}" stroke-linejoin="miter"/><path d="${d}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="${cap}" stroke-linejoin="miter"/>`;
// Square pips on the front face of a die of size s whose front face starts at (x, y).
const PIPS = { 1: [[1, 1]], 2: [[0, 0], [2, 2]], 3: [[0, 0], [1, 1], [2, 2]], 4: [[0, 0], [2, 0], [0, 2], [2, 2]], 5: [[0, 0], [2, 0], [1, 1], [0, 2], [2, 2]], 6: [[0, 0], [2, 0], [0, 1], [2, 1], [0, 2], [2, 2]] };
function die(x, y, s, n, c = C.cream, pip = INK, rot = 0, cls = '', delay = 0) {
  const p = s * .17, g = (s - 3 * p) / 4;
  const pips = PIPS[n].map(([i, j]) => `<rect x="${x + g + i * (p + g)}" y="${y + g + j * (p + g)}" width="${p}" height="${p}" fill="${pip}"/>`).join('');
  return `<g class="${cls}" style="--d:${delay}s"><g transform="rotate(${rot} ${x + s / 2} ${y + s / 2})">${box(x, y, s, s, c, s * .26)}${pips}</g></g>`;
}
// Low-poly suit marks, centred on (0, 0), about 28 wide.
const SUIT = {
  h: 'M0-7l5-6h5l5 6v5L0 14-15-2v-5l5-6h5z', s: 'M0-15l14 14v5l-5 5h-4l-3-3 3 9H-5l3-9-3 3h-4l-5-5v-5z',
  d: 'M0-15l11 15L0 15-11 0z', c: 'M-5-14H5v8h9V4H4l3 10H-7L-4 4h-10V-6h9z',
};
// A playing card: a cream slab with a rank and one big suit. (cx, cy) is its middle.
function card(cx, cy, rot, rank, suit, { w = 40, h = 56, cls = '', delay = 0, face = C.cream, back = '' } = {}) {
  const col = suit === 'h' || suit === 'd' ? C.red : '#2b2230', x = -w / 2, y = -h / 2;
  const inner = back
    ? `<rect x="${x + 5}" y="${y + 5}" width="${w - 10}" height="${h - 10}" fill="${back}"/><path d="M0 ${-h / 4}l${w / 4} ${h / 4}-${w / 4} ${h / 4}-${w / 4}-${h / 4}z" fill="#fff" fill-opacity=".55"/>`
    : `<text x="${x + 5}" y="${y + 16}" font-family="Rubik, sans-serif" font-weight="700" font-size="15" fill="${col}">${rank}</text><path d="${SUIT[suit]}" transform="translate(${rank.length > 1 ? 2 : 3} 8) scale(.92)" fill="${col}"/>`;
  return `<g class="${cls}" style="--d:${delay}s"><g transform="translate(${cx} ${cy}) rotate(${rot})"><rect x="${x + 3}" y="${y + 3}" width="${w}" height="${h}" rx="3" fill="${INK}"/><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3" fill="${face}" ${O}/>${inner}</g></g>`;
}
// A stack of n poker chips; (x, y) is the bottom left of the stack.
function chips(x, y, n, c) {
  let s = '';
  for (let i = 0; i < n; i++) { const yy = y - 7 - i * 7; s += box(x, yy, 26, 7, i % 2 ? C.cream : c, 7) + `<path d="M${x + 6} ${yy}v7M${x + 13} ${yy}v7M${x + 20} ${yy}v7" stroke="${INK}" stroke-width="2" opacity=".35"/>`; }
  return s;
}
// A board game pawn standing on (x, y) (the middle of its base).
const pawn = (x, y, c, k = 1) => `<g transform="translate(${x} ${y}) scale(${k})" ${O}><path d="M-12 0h24v-6h-24z" fill="${c}"/><path d="M-8-6l4-20h8l4 20z" fill="${c}"/><path d="M0-42l9 6v8l-9 6-9-6v-8z" fill="${c}"/><path d="M0-42l9 6v8l-9 6z M4-26l4 20h4v6H2z" ${DARK}/><path d="M-4-37l4-3v5z" fill="#fff" fill-opacity=".6" stroke="none"/></g>`;
// A low-poly ball (marbles, golf balls): an octagon with a light facet.
function ball(x, y, r, c, cls = '', delay = 0) {
  const a = r * .414;
  return `<g class="${cls}" style="--d:${delay}s"><path d="M${x - a} ${y - r}h${2 * a}l${r - a} ${r - a}v${2 * a}l${a - r} ${r - a}h${-2 * a}l${a - r} ${a - r}v${-2 * a}z" fill="${c}" ${O}/>`
    + `<path d="M${x - a} ${y - r}h${2 * a}L${x} ${y}l${-r} ${-a}z" ${LIGHT}/><path d="M${x + r} ${y + a}l${a - r} ${r - a}h${-2 * a}L${x} ${y}z" ${DARK}/></g>`;
}
// A little blocky pet head (ears: 'cat' triangles or 'bun' tall boxes), centred on (x, y), about 26 wide.
function pet(x, y, c, ears = 'cat', eye = INK, k = 1) {
  const e = ears === 'bun' ? `<path d="M-10-10v-16h7v16zM3-10v-16h7v16z" fill="${c}"/>` : `<path d="M-13-9v-12l10 9zM13-9v-12l-10 9z" fill="${c}"/>`;
  return `<g transform="translate(${x} ${y}) scale(${k})" ${O}>${e}<path d="M-13-10h26v20h-26z" fill="${c}"/><path d="M-7-3h4v5h-4zM3-3h4v5h-4z" fill="${eye}" stroke="none"/><path d="M-2 4h4l-2 3z" fill="${C.pink}" stroke-width="1.5"/></g>`;
}

const STARS = [[30, 22, 2], [96, 14, 1.5], [150, 30, 1.2], [204, 18, 1.6], [258, 86, 1.5], [296, 118, 1.2], [14, 92, 1.4], [70, 60, 1.1]];
// The shared frame: sky, stars (night only), two blocky clouds, the island. `top` recolours the island's top face.
function scene(label, body, { top = 'var(--art-grass, #8fd16a)', onTop = '' } = {}) {
  return `<svg viewBox="0 0 320 150" preserveAspectRatio="xMidYMid slice" role="img" aria-label="${label}">
  <rect class="artsky" width="320" height="150" fill="var(--art-sky, #bfe8ff)"/>
  <g class="artstars" fill="var(--art-star, #fff6d8)">${STARS.map(([x, y, r]) => `<rect x="${x}" y="${y}" width="${r * 2}" height="${r * 2}"/>`).join('')}</g>
  <path class="artcloud" d="M10 46v-9h10v-8h24v6h12v11zM262 100v-8h12v-7h20v7h10v8z" fill="var(--art-cloud, #fff)"/>
  <g ${O}><path d="M40 108l14 20 34 10 30 18 34-10 32 12 34-18 30-8 26-24z" fill="var(--art-rock, #857a72)"/>
  <path d="M152 146l32 12 34-18 30-8 26-24-38 14h-80z" ${DARK}/>
  <path d="M40 108l38 14h158l38-14v9l-38 13H78l-38-13z" fill="var(--art-earth, #c98a5a)"/>
  <path d="M40 108l38-14h158l38 14-38 14H78z" fill="${top}"/></g>
  ${onTop}${body}</svg>`;
}

export function hotpotArt() {
  const pot = `${box(128, 108, 56, 7, '#5b5560', 8)}
    <g ${O}><path d="M88 70h124l-12 38h-100z" fill="${C.red}"/><path d="M168 70h44l-12 38h-28z" ${DARK}/>
    <path d="M70 62h18v10H70zM212 62h18v10h-18z" fill="${C.orange}"/>
    <path d="M82 66l18-12h100l18 12-18 10H100z" fill="${C.orange}"/>
    <path d="M96 66l10-7h44l-8 13h-36z" fill="#ff7a59"/><path d="M150 59h44l10 7-10 6h-52z" fill="#fff0c9"/></g>
    <path d="M150 59l-8 13" stroke="${INK}" stroke-width="3"/>
    <rect x="112" y="63" width="7" height="5" fill="${C.red}"/><rect x="126" y="65" width="5" height="4" fill="${C.yellow}"/><rect x="164" y="63" width="8" height="5" fill="${C.leaf}"/><rect x="180" y="65" width="6" height="4" fill="#fff"/>`;
  const sticks = `<g class="abob">${rod('M70 16L118 44', C.wood, 4)}${rod('M82 12L122 40', C.wood, 4)}
    <g ${O}><path d="M112 40h22l5 9h-32z" fill="#8a5a3c"/><path d="M118 49h10v10h-10z" fill="${C.cream}"/><path d="M112 40h22l5 9h-10z" ${DARK}/></g></g>`;
  return scene('A red hot pot with two broths and chopsticks holding a mushroom over it', pot + sticks);
}

export function marbleArt() {
  const plank = (x1, y1, x2, y2) => `<g ${O}><path d="M${x1} ${y1}L${x2} ${y2}v10L${x1} ${y1 + 10}z" fill="${C.wood}"/><path d="M${x1} ${y1}L${x2} ${y2}l8-5L${x1 + 8} ${y1 - 5}z" fill="${C.orange}"/></g>`;
  return scene('Three marbles rolling down a zigzag wooden track', `
    ${box(84, 96, 10, 18, C.bark, 6)}${plank(212, 87, 84, 104)}${box(206, 62, 10, 52, C.bark, 6)}
    ${plank(70, 40, 216, 62)}
    <g ${O}><path d="M216 56v16h10V52z" fill="${C.red}"/><path d="M74 86v18h10V84z" fill="${C.red}"/></g>
    ${ball(98, 28, 15, C.pink, 'abob', 0)}${ball(160, 40, 13, C.orange, 'abob', .3)}${ball(176, 76, 15, C.violet, 'abob', .6)}`);
}

export function laddersArt() {
  const cols = ['#ffd9a0', '#bfe6c8', '#ffc6d3', '#cfe0ff'];
  let cells = '';
  for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) cells += `<rect x="${98 + c * 28}" y="${30 + r * 28}" width="28" height="28" fill="${cols[(r * 3 + c) % 4]}"/>`;
  let rungs = '';
  for (let i = 1; i < 6; i++) rungs += `M${106 + i * 5.2} ${108 - i * 12.4}h20`;
  return scene('A game board with a ladder leaning on it and a green snake', `
    ${box(96, 28, 116, 88, C.cream, 8)}${cells}<path d="M98 30h112v84H98zM126 30v84M154 30v84M182 30v84M98 58h112M98 86h112" fill="none" stroke="${INK}" stroke-width="2" opacity=".5"/>
    <path d="${rungs}" stroke="${INK}" stroke-width="7"/><path d="M106 108l31-74M126 108l31-74" stroke="${INK}" stroke-width="9" stroke-linecap="square"/>
    <path d="${rungs}" stroke="${C.orange}" stroke-width="3"/><path d="M106 108l31-74M126 108l31-74" stroke="${C.orange}" stroke-width="3.5" stroke-linecap="square"/>
    ${rod('M196 50v24h-24v26h34', C.green, 9, 'butt')}
    <g ${O}><path d="M186 34h20v18h-20z" fill="${C.green}"/><path d="M196 52v7" stroke="${C.red}" fill="none"/></g>
    <path d="M190 39h4v5h-4zM198 39h4v5h-4z" fill="${INK}"/><path d="M206 100l10-4v8z" fill="${C.green}" ${O}/>`);
}

export function pokerArt() {
  return scene('An ace and a king with stacks of poker chips', `
    ${chips(60, 118, 2, C.mint)}
    ${card(118, 72, -10, 'A', 's', { w: 46, h: 64, cls: 'abob' })}${card(158, 72, 9, 'K', 'h', { w: 46, h: 64, cls: 'abob', delay: .4 })}
    ${chips(198, 114, 4, C.red)}${chips(222, 122, 2, C.violet)}`, { top: '#3f9a78' });
}

export function ludoArt() {
  const yard = (x, y, c) => `<rect x="${x}" y="${y}" width="34" height="34" fill="${c}" ${O}/><rect x="${x + 9}" y="${y + 9}" width="16" height="16" fill="${C.cream}" stroke="${INK}" stroke-width="2"/>`;
  return scene('A ludo board with four coloured yards, two pawns and a die', `
    ${box(104, 24, 92, 92, C.cream, 8)}
    ${yard(106, 26, C.red)}${yard(160, 26, C.blue)}${yard(106, 80, C.green)}${yard(160, 80, C.yellow)}
    <path d="M140 60h20v20h-20z" fill="${C.cream}" ${O}/><path d="M140 60l10 10-10 10z" fill="${C.red}"/><path d="M160 60l-10 10 10 10z" fill="${C.yellow}"/><path d="M140 60l10 10 10-10z" fill="${C.blue}"/><path d="M140 80l10-10 10 10z" fill="${C.green}"/><path d="M140 60h20v20h-20z" fill="none" ${O}/>
    ${pawn(72, 118, C.red)}${pawn(228, 120, C.blue, .82)}${die(214, 60, 22, 6, C.cream, INK, 10, 'abob')}`);
}

export function stackArt() {
  const cols = [C.grey, C.pink, C.orange, C.mint, C.violet], off = [0, 6, -4, 8, 2];
  return scene('A wobbly tower of blocks with one more block coming down on a rope', `
    ${off.map((d, i) => box(120 + d, 100 - i * 16, 58, 16, cols[i], 8)).join('')}
    <g class="asway" style="transform-origin:86px -20px">${rod('M70 -10V38M102 -10V38', C.bark, 2, 'butt')}${box(58, 38, 54, 16, C.red, 8)}</g>
    <path d="M206 44l10-4M208 60l12 0M204 76l10 5" stroke="${TICK}" stroke-width="3" stroke-linecap="square"/>`);
}

export function golfArt() {
  return scene('A mini golf green with a flag, a windmill and a ball rolling to the hole', `
    <path d="M118 108c20 8 44 8 60 2" fill="none" stroke="#fff" stroke-width="3" stroke-dasharray="3 7"/>
    <path d="M92 104h18l5 4-5 4H92l-5-4z" fill="#2a1422"/>
    ${rod('M101 108V40', C.cream, 3, 'butt')}<path d="M104 40l30 11-30 11z" fill="${C.red}" ${O}/>
    <g ${O}><path d="M176 108l8-46h24l8 46z" fill="${C.cream}"/><path d="M200 62h8l8 46h-10z" ${DARK}/><path d="M190 108V92h12v16z" fill="${C.bark}"/><path d="M178 62l18-18 18 18z" fill="${C.red}"/></g>
    <g class="aspin" style="transform-origin:196px 62px"><path d="M192 62h8V28h-8zM192 62h8v34h-8zM196 58v8h34v-8zM196 58v8h-34v-8z" fill="${C.orange}" ${O} transform="rotate(24 196 62)"/></g><rect x="192" y="58" width="8" height="8" fill="${INK}"/>
    ${ball(146, 112, 8, C.pink)}`, { top: '#6fcf5c', onTop: `<path d="M52 108l30-11h150l30 11-30 11H82z" fill="none" stroke="${C.cream}" stroke-width="4" stroke-linejoin="round"/><path d="M90 98l-22 20M130 97l-10 22M170 97v22M210 97l12 21" stroke="#fff" stroke-opacity=".28" stroke-width="12"/>` });
}

export function diceArt() {
  return scene('A dice cup tipped over with two dice tumbling out', `
    <g class="asway" style="transform-origin:104px 100px"><g transform="rotate(-24 104 100)" ${O}><path d="M88 34h40l14 62H74z" fill="${C.red}"/><path d="M114 34h14l14 62h-18z" ${DARK}/><path d="M74 96l12-7h44l12 7-12 7H86z" fill="#5a1f24"/><path d="M82 62l-3 12h58l-3-12z" fill="${C.orange}"/><path d="M88 34h40l14 62H74z" fill="none"/></g></g>
    ${die(160, 80, 28, 5, C.cream, INK, 12, 'abob')}${die(208, 92, 22, 2, C.yellow, INK, -14, 'abob', .5)}
    <path d="M150 52l6 10M172 44v12M194 52l-6 10" stroke="${TICK}" stroke-width="3" stroke-linecap="square"/>`, { top: '#3f9a78' });
}

export function tysArt() {
  return scene('A king and queen of hearts beside a wooden sign that says 1000', `
    ${box(202, 84, 8, 30, C.bark, 5)}
    ${card(96, 72, -10, 'K', 'h', { w: 46, h: 64, cls: 'abob' })}${card(136, 72, 8, 'Q', 'h', { w: 46, h: 64, cls: 'abob', delay: .4 })}
    ${box(170, 62, 74, 30, C.bark, 7)}<text x="207" y="85" text-anchor="middle" font-family="Rubik, sans-serif" font-weight="800" font-size="22" fill="${C.orange}">1000</text>`);
}

export function pawArt() {
  return scene('A little pet shop with a paw sign, a bunny and a gold coin', `
    ${box(116, 66, 80, 48, C.cream, 12)}
    <g ${O}><path d="M108 68l48-34 48 34z" fill="${C.red}"/><path d="M156 34l12-7 48 34-12 7z" fill="${C.red}"/><path d="M156 34l12-7 48 34-12 7z" ${DARK}/>
    <path d="M146 114V88h20v26z" fill="${C.bark}"/><path d="M172 80h16v14h-16zM124 80h16v14h-16z" fill="#bfe6fb"/></g>
    <g fill="${C.cream}"><rect x="151" y="54" width="10" height="8"/><rect x="146" y="48" width="5" height="5"/><rect x="153.500" y="45" width="5" height="5"/><rect x="161" y="48" width="5" height="5"/></g>
    <g class="abob">${box(60, 98, 26, 18, '#fff', 6)}${pet(73, 86, '#fff', 'bun')}</g>
    <g class="abob" style="--d:.5s">${ball(232, 100, 15, C.yellow)}<path d="M226 100h12v8h-12zM223 93h4v5h-4zM230 90h4v5h-4zM237 93h4v5h-4z" fill="${C.bark}"/></g>`);
}

export function kartArt() {
  const wheel = (x, y) => `<path d="M${x - 4} ${y - 9}h8l5 5v8l-5 5h-8l-5-5v-8z" fill="#2b2230" ${O}/><rect x="${x - 3}" y="${y - 3}" width="6" height="6" fill="${C.grey}"/>`;
  return scene('A blocky kart racing along an island road towards an item box', `
    <path d="M58 60h12M48 74h16M60 88h10" stroke="${TICK}" stroke-width="3" stroke-linecap="square" transform="translate(190 4)"/>
    <g class="abob" style="--d:.2s">${box(52, 44, 26, 26, C.yellow, 8)}<text x="65" y="65" text-anchor="middle" font-family="Rubik, sans-serif" font-weight="800" font-size="21" fill="${INK}">?</text></g>
    <g class="ajig">${box(150, 60, 22, 20, '#f2c9a0', 6)}${box(148, 54, 26, 10, C.blue, 6)}<path d="M154 68h4v5h-4z" fill="${INK}"/>
    ${box(112, 82, 96, 20, C.red, 10)}<g ${O}><path d="M112 82l22-10h12v10z" fill="${C.red}"/><path d="M112 82l22-10h12v10z" ${LIGHT}/><path d="M182 82V66h22l8 16z" fill="${C.cream}"/></g>
    <path d="M118 92h84" stroke="${C.cream}" stroke-width="4"/>${wheel(132, 106)}${wheel(190, 106)}</g>`,
  { top: '#8e8a99', onTop: `<path d="M64 108h186" stroke="#fff" stroke-width="3" stroke-dasharray="14 10"/><path d="M40 108l38-14h14l-38 14 38 14H78zM274 108l-38-14h-14l38 14-38 14h14z" fill="var(--art-grass, #8fd16a)" ${O}/>` });
}

export function kitchenArt() {
  return scene('A kitchen counter with a steaming pot and a burger', `
    ${box(84, 84, 150, 30, C.cream, 12)}<path d="M96 94h34v12H96zM140 94h34v12h-34zM184 94h38v12h-38z" fill="none" stroke="${INK}" stroke-width="2.5" opacity=".55"/><path d="M84 84h150" stroke="${C.wood}" stroke-width="5"/><path d="M84 81.500h150M84 86.500h150" stroke="${INK}" stroke-width="2"/>
    ${box(104, 56, 42, 22, C.steel, 8)}<path d="M96 60h8v6h-8zM154 56h8v6h-8z" fill="${C.steel}" ${O}/><path d="M104 56h42" stroke="${C.cream}" stroke-width="4"/>
    <g class="abob" fill="var(--art-cloud, #fff)" ${O}><path d="M116 36h12v10h-12zM126 22h9v9h-9zM118 10h7v7h-7z"/></g>
    <g class="abob" style="--d:.6s" ${O}><path d="M176 62l8-12h30l8 12z" fill="${C.orange}"/><path d="M172 62h54v6h-54z" fill="${C.leaf}"/><path d="M176 68h46v7h-46z" fill="#7a4a2e"/><path d="M176 75h46l-4 7h-38z" fill="${C.orange}"/><path d="M188 54h4M200 53h4" stroke-width="2.5" stroke="${C.cream}"/></g>`);
}

export function digArt() {
  return scene('A treasure chest dug out of a grass field with a gem above it and a shovel', `
    ${box(124, 84, 60, 28, C.wood, 12)}<g ${O}><path d="M124 84l6-22h60l-6 22z" fill="${C.bark}"/><path d="M190 62l12-7-6 22-12 7z" fill="${C.bark}"/><path d="M190 62l12-7-6 22-12 7z" ${DARK}/><path d="M128 84h52" stroke="${C.yellow}" stroke-width="6"/><path d="M148 90h12v12h-12z" fill="${C.yellow}"/><path d="M136 84V112M172 84V112" stroke-width="2" opacity=".5"/></g>
    <g class="abob" ${O}><path d="M140 34h28l10 12-24 22-24-22z" fill="${C.pink}"/><path d="M140 34h28l-14 12z" ${LIGHT}/><path d="M154 46l24 0-24 22z" ${DARK}/></g>
    <path d="M118 30l-8 4M190 30l8 4M154 18v-8" stroke="${TICK}" stroke-width="3" stroke-linecap="square"/>
    ${rod('M82 60L70 100', C.wood, 4, 'butt')}<g ${O}><path d="M76 54h14v8H76z" fill="${C.bark}"/><path d="M58 98h22l-4 20h-10z" fill="${C.grey}" transform="rotate(16 69 100)"/></g>
    ${rod('M226 112V72', C.cream, 3, 'butt')}<path d="M229 72l22 8-22 8z" fill="${C.red}" ${O}/>`,
  { onTop: `<path d="M78 94l-19 14 19 14M118 94l-10 28M158 94v28M198 94l10 28M236 94l19 14-19 14M59 101h202M50 113h220" fill="none" stroke="${INK}" stroke-opacity=".28" stroke-width="2"/><path d="M92 114h24l5 5H86zM196 112h24l4 6h-32z" fill="#7a4a2e" ${O}/>` });
}

export function bricksArt() {
  const cols = [C.red, C.orange, C.mint, C.violet, C.pink, C.yellow, C.blue], s = 12, x0 = 112, y0 = 26;
  const rows = ['........', '........', '.....0..', '1....00.', '11.2.30.', '14223366', '44523556'];
  let cells = '';
  rows.forEach((r, j) => [...r].forEach((ch, i) => { if (ch !== '.') cells += `<rect x="${x0 + i * s}" y="${y0 + j * s}" width="${s}" height="${s}" fill="${cols[+ch]}" stroke="${INK}" stroke-width="1.5"/>`; }));
  const piece = [[1, 0], [0, 1], [1, 1], [2, 1]].map(([i, j]) => `<rect x="${x0 + 24 + i * s}" y="${y0 + 6 + j * s}" width="${s}" height="${s}" fill="${C.yellow}" stroke="${INK}" stroke-width="2"/>`).join('');
  return scene('A well of stacked coloured bricks with a piece falling in and a stone block on its way', `
    ${box(104, 20, 112, 94, C.steel, 8)}<rect x="${x0}" y="${y0}" width="96" height="84" fill="${C.night}" ${O}/>${cells}<g class="astep">${piece}</g>
    <rect x="${x0}" y="${y0}" width="96" height="84" fill="none" ${O}/>
    <g class="abob" style="--d:.4s">${box(54, 62, 28, 22, C.grey, 8)}<path d="M60 70h8M66 78h10" stroke="${INK}" stroke-width="2.5" opacity=".5"/></g>
    <path d="M90 66l8-3M92 76h8" stroke="${TICK}" stroke-width="3" stroke-linecap="square"/>`);
}

export function beanArt() {
  const leaf = (x, y, dir, c = C.green) => `<g transform="translate(${x} ${y}) scale(${dir} 1)" ${O}><path d="M0 0l10-8h34l12 8-12 7H10z" fill="${c}"/><path d="M0 0l10 7h34l12-7v5l-12 7H10L0 5z" fill="${C.leaf}"/></g>`;
  return scene('A climber hopping between the leaves of a giant beanstalk', `
    ${rod('M152 116L140 88l20-30-14-30 8-36', C.leaf, 15, 'butt')}
    ${leaf(142, 92, -1)}${leaf(158, 70, 1)}${leaf(144, 32, -1, '#8fd96a')}
    <g class="ahop"><g transform="translate(196 44) scale(1.35) translate(-194 -40)">${box(184, 22, 20, 18, '#f2c9a0', 5)}${box(182, 16, 24, 8, C.bark, 5)}<path d="M189 29h3v5h-3zM197 29h3v5h-3z" fill="${INK}"/>
    <g ${O}><path d="M186 40h18v14h-18z" fill="${C.pink}"/><path d="M186 42l-10-6v6l10 6zM204 42l10-8v6l-10 8z" fill="${C.pink}"/><path d="M187 54h7v8h-7zM196 54h7v6h-7z" fill="${C.blue}"/></g></g></g>
    <path d="M182 82l-4 6M197 84v7M212 82l4 6" stroke="${TICK}" stroke-width="3" stroke-linecap="square"/>`);
}

export function panArt() {
  return scene('The nine of hearts in front of a hand of cards, next to the deck', `
    ${card(100, 74, -18, '', 's', { w: 44, h: 62, back: C.blue })}${card(124, 70, -4, '', 's', { w: 44, h: 62, back: C.blue })}
    ${card(154, 72, 9, '9', 'h', { w: 48, h: 66, cls: 'abob' })}
    ${box(200, 100, 36, 5, C.cream, 12)}${box(200, 95, 36, 5, C.cream, 12)}${box(200, 90, 36, 5, C.blue, 12)}`);
}

export function piotrArt() {
  const pc = (cx, cy, rot, bg, inner, o = {}) => card(cx, cy, rot, '', 's', { w: 42, h: 60, back: bg, ...o }).replace(/<path d="M0[^>]*fill-opacity="\.55"\/>/, inner);
  return scene('Three pet cards, with the black cat Piotruś card pulled up in the middle', `
    ${pc(104, 78, -14, '#bfe6c8', pet(0, 2, '#fff', 'bun'))}${pc(204, 78, 14, '#ffd9a0', pet(0, 2, C.orange, 'cat'))}
    ${pc(154, 62, 0, '#3b3a78', pet(0, 2, '#1d1b33', 'cat', C.yellow, 1.1), { cls: 'abob', w: 46, h: 64 })}
    <path d="M124 26l-6-8M154 18v-9M184 26l6-8" stroke="${TICK}" stroke-width="3" stroke-linecap="square"/>`);
}

export function pipsArt() {
  return scene('Three dice next to a score sheet with a pencil', `
    <g transform="rotate(-8 80 80)" ${O}><path d="M62 50h40v62H62z" fill="${C.cream}"/><path d="M62 50h40v12H62z" fill="${C.pink}"/><path d="M68 72h16M68 82h16M68 92h16M68 102h16" stroke-width="2.5" opacity=".45"/><path d="M89 70l3 4 6-7M89 90l3 4 6-7" fill="none" stroke="${C.leaf}"/></g>
    ${die(120, 84, 28, 6, C.yellow, INK, 0, 'abob')}${die(162, 78, 30, 6, C.yellow, INK, -8, 'abob', .3)}${die(208, 88, 26, 3, C.cream, INK, 10, 'abob', .6)}
    <path d="M140 60l-4-8M178 52v-9M214 62l4-8" stroke="${TICK}" stroke-width="3" stroke-linecap="square"/>`, { top: '#e77fa0' });
}

export function dartsArt() {
  let wedges = '';
  for (let i = 0; i < 8; i++) wedges += `<path d="M0 0L-14.500-35h29z" transform="rotate(${i * 45})" fill="${i % 2 ? C.cream : '#2b2230'}"/>`;
  const oct = r => { const a = r * .414; return `M${-a} ${-r}h${2 * a}l${r - a} ${r - a}v${2 * a}l${a - r} ${r - a}h${-2 * a}l${a - r} ${a - r}v${-2 * a}z`; };
  return scene('A dartboard on a wooden stand with a dart flying into the bullseye', `
    ${rod('M132 96l-14 20M176 96l14 20', C.bark, 5)}
    ${box(108, 22, 92, 82, C.wood, 8)}
    <g transform="translate(154 63)"><path d="${oct(37)}" fill="#2b2230" ${O}/>${wedges}
    <path d="${oct(22)}" fill="none" stroke="${C.red}" stroke-width="5"/><path d="${oct(22)}" fill="none" stroke="${INK}" stroke-width="1.5" transform="scale(1.12)"/><path d="${oct(22)}" fill="none" stroke="${INK}" stroke-width="1.5" transform="scale(.88)"/>
    <path d="${oct(9)}" fill="${C.leaf}" ${O}/><path d="${oct(4)}" fill="${C.red}"/><path d="${oct(37)}" fill="none" ${O}/></g>
    <g class="adart">${rod('M96 44L150 62', C.grey, 2, 'butt')}<path d="M100 34l-22-2 10 10-4 14 20-10z" fill="${C.red}" ${O}/></g>
    <path d="M52 30h18M44 44h22M56 58h14" stroke="${TICK}" stroke-width="3" stroke-linecap="square"/>`);
}

export function tttArt() {
  const X = (x, y, s = 9) => rod(`M${x - s} ${y - s}l${2 * s} ${2 * s}M${x + s} ${y - s}l${-2 * s} ${2 * s}`, C.red, 5, 'butt');
  const Oh = (x, y, r = 9) => `<path d="M${x - r * .5} ${y - r}h${r}l${r * .5} ${r * .5}v${r}l${-r * .5} ${r * .5}h${-r}l${-r * .5}-${r * .5}v${-r}z" fill="none" stroke="${INK}" stroke-width="11" stroke-linejoin="miter"/><path d="M${x - r * .5} ${y - r}h${r}l${r * .5} ${r * .5}v${r}l${-r * .5} ${r * .5}h${-r}l${-r * .5}-${r * .5}v${-r}z" fill="none" stroke="${C.blue}" stroke-width="5" stroke-linejoin="miter"/>`;
  let cells = '';
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) cells += `<rect x="${110 + c * 29}" y="${30 + r * 29}" width="26" height="26" fill="${C.cream}" stroke="${INK}" stroke-width="2"/>`;
  const at = (c, r) => [123 + c * 29, 43 + r * 29];
  return scene('A noughts and crosses board with three crosses in a row', `
    ${box(104, 24, 96, 92, C.wood, 8)}${cells}
    ${Oh(...at(0, 0))}${Oh(...at(2, 1))}${Oh(...at(1, 2))}${X(...at(2, 0))}${X(...at(1, 1))}${X(...at(0, 2))}
    <path d="M100 124L204 20" stroke="${C.yellow}" stroke-width="4" stroke-linecap="square" opacity=".9"/>
    <g class="abob">${X(70, 92, 12)}</g><g class="abob" style="--d:.5s">${Oh(234, 96, 11)}</g>`);
}

// Small square icons for the Today tiles (Mystery Pet, Hay Hunch, Pet Pop, Pet Farm): the same kit at 120x120 with a 5 wide outline.
const O5 = `stroke="${INK}" stroke-width="5" stroke-linejoin="round"`;
export const TODAY_ICONS = {
  mystery: `<svg viewBox="0 0 120 120"><g ${O5}><path d="M26 44V12l26 22zM94 44V12L68 34z" fill="#3b2f55"/><path d="M22 36h76v64H22z" fill="#3b2f55"/></g><path d="M68 36h30v64H80z" fill="#1d1030" fill-opacity=".3"/><text x="60" y="90" text-anchor="middle" font-family="Rubik, sans-serif" font-weight="800" font-size="56" fill="${C.yellow}">?</text></svg>`,
  hay: `<svg viewBox="0 0 120 120"><g ${O5}><path d="M70 50l6-26h14l6 26z" fill="#ff8a3c"/><path d="M76 24l-6-12M83 24V8M90 24l6-12" fill="none" stroke="${C.leaf}" stroke-linecap="square"/>
    <path d="M12 104V58l14-12h82v46L94 104z" fill="#e8c25a"/><path d="M12 58l14-12h82L94 58z" fill="#fff" fill-opacity=".4"/><path d="M94 58l14-12v46l-14 12z" fill="#1d1030" fill-opacity=".24"/><path d="M12 58h82l14-12M94 58v46" fill="none"/>
    <path d="M34 58v46M72 58v46" stroke="#a8742f"/></g></svg>`,
  pop: `<svg viewBox="0 0 120 120"><g ${O5}><path d="M32 52V26l20 16zM88 52V26L68 42z" fill="${C.orange}"/><path d="M28 46h64v52H28z" fill="${C.orange}"/></g><path d="M70 46h22v52H78z" fill="#1d1030" fill-opacity=".2"/><path d="M42 62h9v12h-9zM69 62h9v12h-9z" fill="${INK}"/><path d="M54 78h12l-6 7z" fill="${C.pink}" stroke="${INK}" stroke-width="3"/><path d="M60 20V6M16 40L6 32M104 40l10-8M14 76H4M106 76h10" stroke="${INK}" stroke-width="6" stroke-linecap="square"/></svg>`,
  farm: `<svg viewBox="0 0 120 120"><g ${O5}><path d="M20 104V56h72v48z" fill="${C.red}"/><path d="M92 56l12-8v48l-12 8z" fill="#b8402c"/><path d="M10 58l22-32h48l22 32z" fill="${C.bark}"/><path d="M80 26l12-8 22 32-12 8z" fill="#6e4530"/><path d="M42 104V72h28v32z" fill="${C.cream}"/><path d="M42 72l28 32M70 72l-28 32" fill="none" stroke-width="4"/></g><path d="M50 44h12v9H50zM45 36h6v6h-6zM53 32h6v6h-6zM61 36h6v6h-6z" fill="${C.cream}"/></svg>`,
};
