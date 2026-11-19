// Avatar options shared by the server (validation), the 2D portraits and the 3D models.
// An avatar is [skin, hair, hair colour, extra, eyes, mouth, outfit, detail] plus the outfit colour.
// Only append to these lists: saved avatars store indexes.
export const SKINS = ['#ffe3c8', '#f6c9a0', '#dba577', '#a9714a', '#7d4f30', '#5a3a22'];
export const HAIR_COLS = ['#3b2219', '#7a4a2b', '#e8b84a', '#d9534a', '#f1ede6', '#6fb7e8', '#ff8fab', '#9b6fd6', '#5cb85c', '#ff8c42'];
export const HAIRS = ['Bun', 'Short', 'Pigtails', 'Spiky', 'Long', 'None', 'Bob', 'Ponytail', 'Curly', 'Mohawk'];
export const EXTRAS = ['None', 'Chef hat', 'Glasses', 'Bow', 'Cat ears', 'Crown', 'Flower', 'Headphones', 'Sunglasses'];
export const EYES = ['Round', 'Happy', 'Sleepy', 'Sparkle', 'Wink'];
export const MOUTHS = ['Smile', 'Open', 'Cat', 'Tiny', 'Tongue'];
export const OUTFITS = ['Plain', 'Apron', 'Scarf', 'Stripes', 'Bow tie'];
export const DETAILS = ['None', 'Freckles', 'Mustache', 'Beard'];
export const AV_MAX = [SKINS, HAIRS, HAIR_COLS, EXTRAS, EYES, MOUTHS, OUTFITS, DETAILS].map(l => l.length - 1);

export const cleanAv = a => AV_MAX.map((m, i) => {
  const v = Array.isArray(a) ? +a[i] : 0;
  return Number.isFinite(v) ? Math.max(0, Math.min(m, Math.floor(v))) : 0;
});
export const randomAv = () => AV_MAX.map((m, i) => i === 7 && Math.random() < .6 ? 0 : Math.random() * (m + 1) | 0);

const INK = '#3b2219';
const safeCol = c => /^#[0-9a-f]{6}$/i.test(c) ? c : '#ff8fab';

// Head-and-shoulders portrait, 100x100. The wrapper clips it to a circle.
export function avatarSvg(color, av) {
  const [sk, hair, hc, acc, ey, mo, fit, det] = cleanAv(av);
  const c = safeCol(color), skin = SKINS[sk], h = HAIR_COLS[hc];
  const s = `stroke="${INK}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"`;
  const eye = sk >= 3 ? '#1c0f0a' : '#2a1712';
  const line = `fill="none" stroke="${eye}" stroke-width="2.6" stroke-linecap="round"`;
  const hat = acc === 1 || acc === 5;
  let o = '';
  // behind the head
  if (hair === 4) o += `<path d="M21 46c0-22 12-32 29-32s29 10 29 32v38H21z" fill="${h}" ${s}/>`;
  if (hair === 6) o += `<path d="M19 46c0-22 13-32 31-32s31 10 31 32v14c0 6-4 9-9 9H28c-5 0-9-3-9-9z" fill="${h}" ${s}/>`;
  if (hair === 7) o += `<path d="M70 26c16-2 22 14 16 32-3 8-9 11-13 8 5-9 3-20-5-28z" fill="${h}" ${s}/>`;
  if (hair === 2) o += `<circle cx="19" cy="50" r="11" fill="${h}" ${s}/><circle cx="81" cy="50" r="11" fill="${h}" ${s}/>`;
  if (acc === 4) {
    const ec = hair === 5 ? c : h;
    o += `<path d="M24 34l2-24 20 12z" fill="${ec}" ${s}/><path d="M76 34l-2-24-20 12z" fill="${ec}" ${s}/>
      <path d="M29 26l1-9 8 5z" fill="#ffb3c4"/><path d="M71 26l-1-9-8 5z" fill="#ffb3c4"/>`;
  }
  // body + outfit
  o += `<path d="M12 106c0-24 18-33 38-33s38 9 38 33z" fill="${c}" ${s}/>`;
  if (fit === 1) o += `<path d="M37 108V86c0-4 3-7 7-7h12c4 0 7 3 7 7v22z" fill="#fff" ${s}/>`;
  if (fit === 2) o += `<path d="M58 80l9 3-2 15-9-3z" fill="#fff4e2" ${s}/><path d="M30 73c8 7 32 7 40 0l2 8c-10 8-34 8-44 0z" fill="#fff4e2" ${s}/>`;
  if (fit === 3) o += `<path d="M27 86h46M19 95h62" fill="none" stroke="#fff" stroke-opacity=".8" stroke-width="4" stroke-linecap="round"/>`;
  if (fit === 4) o += `<path d="M50 81l-10-6v12z" fill="#e5543b" ${s}/><path d="M50 81l10-6v12z" fill="#e5543b" ${s}/><circle cx="50" cy="81" r="3" fill="#ffb547" stroke="${INK}" stroke-width="2"/>`;
  // head
  o += `<circle cx="50" cy="46" r="27" fill="${skin}" ${s}/>`;
  if (det === 3) o += `<path d="M24.500 52c2 20 14 23 25.500 23s23.500-3 25.500-23c-6 8-14 10-25.500 10s-19.500-2-25.500-10z" fill="${h}" ${s}/>`;
  // hair on top
  const cap = `<path d="M23 45c0-23 14-30 27-30s27 7 27 30c-8-9-17-13-27-13s-19 4-27 13z" fill="${h}" ${s}/>`;
  if (hair === 3) o += `<path d="M24 41l3-23 10 10 5-18 8 16 8-16 5 18 10-10 3 23c-9-7-17-9-26-9s-17 2-26 9z" fill="${h}" ${s}/>`;
  else if (hair === 9) o += `<path d="M43 30c-3-14 2-24 7-24s10 10 7 24z" fill="${h}" ${s}/>`;
  else if (hair === 8) {
    o += cap;
    for (let d = 200; d <= 340; d += 20) o += `<circle cx="${(50 + 26 * Math.cos(d * Math.PI / 180)).toFixed(1)}" cy="${(46 + 26 * Math.sin(d * Math.PI / 180)).toFixed(1)}" r="8.500" fill="${h}" ${s}/>`;
  } else if (hair !== 5) o += cap;
  if (hair === 0 && !hat) o += `<circle cx="50" cy="13" r="9" fill="${h}" ${s}/>`;
  // face
  o += `<ellipse cx="33" cy="57" rx="5" ry="3" fill="#ff7a8a" opacity=".55"/><ellipse cx="67" cy="57" rx="5" ry="3" fill="#ff7a8a" opacity=".55"/>`;
  if (det === 1) for (const [x, y] of [[30, 54], [34.500, 56.500], [29, 58.500], [70, 54], [65.500, 56.500], [71, 58.500]]) o += `<circle cx="${x}" cy="${y}" r="1.100" fill="#9c5a3c"/>`;
  const round = x => `<ellipse cx="${x}" cy="51" rx="3.200" ry="4" fill="${eye}"/><circle cx="${x + 1.2}" cy="49.400" r="1.200" fill="#fff"/>`;
  const arc = x => `<path d="M${x - 4} 52.500q4-6 8 0" ${line}/>`;
  const eyeFn = [round, arc, x => `<path d="M${x - 4} 50q4 4.500 8 0" ${line}/>`,
    x => `<ellipse cx="${x}" cy="51" rx="4.300" ry="5.300" fill="${eye}"/><circle cx="${x + 1.5}" cy="49" r="1.700" fill="#fff"/><circle cx="${x - 1.4}" cy="53.200" r=".9" fill="#fff"/>`, round][ey];
  o += eyeFn(40) + (ey === 4 ? arc(60) : eyeFn(60));
  const smile = `<path d="M46 58q4 4.500 8 0" fill="none" stroke="${eye}" stroke-width="2.200" stroke-linecap="round"/>`;
  o += [smile,
    `<path d="M45 57.500h10c0 8-10 8-10 0z" fill="#8a2f2f" stroke="${eye}" stroke-width="2" stroke-linejoin="round"/>`,
    `<path d="M44 57.500q3 4 6 0q3 4 6 0" fill="none" stroke="${eye}" stroke-width="2.200" stroke-linecap="round" stroke-linejoin="round"/>`,
    `<circle cx="50" cy="59.500" r="2.400" fill="#8a2f2f" stroke="${eye}" stroke-width="1.800"/>`,
    smile + `<path d="M47.600 60.300q2.400 6 4.800 0z" fill="#ff7a8a" stroke="${eye}" stroke-width="1.500" stroke-linejoin="round"/>`][mo];
  if (det === 2) o += `<path d="M50 55.500c-3-2.500-8-1.500-9.500 2 3.500 1.500 7.500 1 9.500-1 2 2 6 2.500 9.500 1-1.500-3.500-6.500-4.500-9.500-2z" fill="${h}" stroke="${INK}" stroke-width="1.800" stroke-linejoin="round"/>`;
  // extras
  if (acc === 2) o += `<circle cx="40" cy="51" r="8.500" fill="#fff" fill-opacity=".3" stroke="${INK}" stroke-width="2.600"/><circle cx="60" cy="51" r="8.500" fill="#fff" fill-opacity=".3" stroke="${INK}" stroke-width="2.600"/><path d="M48.500 50h3" stroke="${INK}" stroke-width="2.600"/>`;
  if (acc === 8) o += `<rect x="30.500" y="44.500" width="17" height="12.500" rx="5" fill="${INK}"/><rect x="52.500" y="44.500" width="17" height="12.500" rx="5" fill="${INK}"/><path d="M47 49h6M23.500 47l7 2M76.500 47l-7 2" stroke="${INK}" stroke-width="2.600" stroke-linecap="round"/><path d="M34 48l4-1.500M56 48l4-1.500" stroke="#fff" stroke-opacity=".6" stroke-width="1.800" stroke-linecap="round"/>`;
  if (acc === 1) o += `<path d="M31 25c-11-2-11-17 1-17 2-9 15-10 19-3 9-6 22 4 15 17z" fill="#fff" ${s}/><rect x="30" y="22" width="40" height="9" rx="3" fill="#fff" ${s}/>`;
  if (acc === 3) o += `<path d="M66 20l-13-8v15z" fill="#ff5d8f" ${s}/><path d="M66 20l13-8v15z" fill="#ff5d8f" ${s}/><circle cx="66" cy="20" r="4.500" fill="#ff8fab" ${s}/>`;
  if (acc === 5) o += `<path d="M31 29l-3-19 11 9 11-14 11 14 11-9-3 19z" fill="#ffc93c" ${s}/><circle cx="50" cy="22" r="2.600" fill="#e5543b"/><circle cx="38" cy="24" r="2" fill="#7ed3b2"/><circle cx="62" cy="24" r="2" fill="#7ed3b2"/>`;
  if (acc === 6) {
    for (let i = 0; i < 5; i++) o += `<circle cx="${(70 + 6.5 * Math.cos(i * 1.257 - 1.57)).toFixed(1)}" cy="${(23 + 6.5 * Math.sin(i * 1.257 - 1.57)).toFixed(1)}" r="5" fill="#ff8fab" stroke="${INK}" stroke-width="2"/>`;
    o += `<circle cx="70" cy="23" r="4" fill="#ffc93c" stroke="${INK}" stroke-width="2"/>`;
  }
  if (acc === 7) o += `<path d="M20 48c0-42 60-42 60 0" fill="none" stroke="${INK}" stroke-width="6.500" stroke-linecap="round"/><rect x="13" y="39" width="12" height="21" rx="5.500" fill="${c}" ${s}/><rect x="75" y="39" width="12" height="21" rx="5.500" fill="${c}" ${s}/>`;
  return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${o.replace(/(\d)\.(\d)00\b/g, '$1.$2')}</svg>`;
}

export const avatarHtml = (color, av, size = 52, cls = '') =>
  `<span class="avatar ${cls}" style="--c:${safeCol(color)};--s:${size}px">${avatarSvg(color, av)}</span>`;
