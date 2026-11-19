// Avatar options shared by the server (validation), the 2D portraits and the 3D models.
// An avatar is [skin, hair style, hair colour, extra] plus the player's outfit colour.
export const SKINS = ['#ffe3c8', '#f6c9a0', '#dba577', '#a9714a', '#7d4f30'];
export const HAIR_COLS = ['#3b2219', '#7a4a2b', '#e8b84a', '#d9534a', '#f1ede6', '#6fb7e8', '#ff8fab'];
export const HAIRS = ['Bun', 'Short', 'Pigtails', 'Spiky', 'Long', 'None'];
export const EXTRAS = ['None', 'Chef hat', 'Glasses', 'Bow', 'Cat ears'];
export const AV_MAX = [SKINS.length - 1, HAIRS.length - 1, HAIR_COLS.length - 1, EXTRAS.length - 1];

export const cleanAv = a => Array.isArray(a) && a.length === 4
  ? a.map((v, i) => Math.max(0, Math.min(AV_MAX[i], Number.isFinite(+v) ? Math.floor(+v) : 0)))
  : [0, 0, 0, 0];
export const randomAv = () => AV_MAX.map(m => Math.random() * (m + 1) | 0);

const INK = '#3b2219';
const safeCol = c => /^#[0-9a-f]{6}$/i.test(c) ? c : '#ff8fab';

// Head-and-shoulders portrait, 100x100. The wrapper clips it to a circle.
export function avatarSvg(color, av) {
  const [sk, hair, hc, acc] = cleanAv(av);
  const c = safeCol(color), skin = SKINS[sk], h = HAIR_COLS[hc];
  const s = `stroke="${INK}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"`;
  const eye = sk >= 3 ? '#1c0f0a' : '#2a1712';
  let o = '';
  if (hair === 4) o += `<path d="M21 46c0-22 12-32 29-32s29 10 29 32v38H21z" fill="${h}" ${s}/>`;
  if (hair === 2) o += `<circle cx="19" cy="50" r="11" fill="${h}" ${s}/><circle cx="81" cy="50" r="11" fill="${h}" ${s}/>`;
  if (acc === 4) {
    const ec = hair === 5 ? c : h;
    o += `<path d="M24 34l2-24 20 12z" fill="${ec}" ${s}/><path d="M76 34l-2-24-20 12z" fill="${ec}" ${s}/>
      <path d="M29 26l1-9 8 5z" fill="#ffb3c4"/><path d="M71 26l-1-9-8 5z" fill="#ffb3c4"/>`;
  }
  o += `<path d="M12 106c0-24 18-33 38-33s38 9 38 33z" fill="${c}" ${s}/>`;
  o += `<circle cx="50" cy="46" r="27" fill="${skin}" ${s}/>`;
  if (hair === 3) o += `<path d="M24 41l3-23 10 10 5-18 8 16 8-16 5 18 10-10 3 23c-9-7-17-9-26-9s-17 2-26 9z" fill="${h}" ${s}/>`;
  else if (hair !== 5) o += `<path d="M23 45c0-23 14-30 27-30s27 7 27 30c-8-9-17-13-27-13s-19 4-27 13z" fill="${h}" ${s}/>`;
  if (hair === 0 && acc !== 1) o += `<circle cx="50" cy="13" r="9" fill="${h}" ${s}/>`;
  o += `<ellipse cx="33" cy="57" rx="5" ry="3" fill="#ff7a8a" opacity=".55"/><ellipse cx="67" cy="57" rx="5" ry="3" fill="#ff7a8a" opacity=".55"/>
    <ellipse cx="40" cy="51" rx="3.2" ry="4" fill="${eye}"/><ellipse cx="60" cy="51" rx="3.2" ry="4" fill="${eye}"/>
    <circle cx="41.2" cy="49.4" r="1.2" fill="#fff"/><circle cx="61.2" cy="49.4" r="1.2" fill="#fff"/>
    <path d="M46 58q4 4.5 8 0" fill="none" stroke="${eye}" stroke-width="2.2" stroke-linecap="round"/>`;
  if (acc === 2) o += `<circle cx="40" cy="51" r="8.5" fill="#fff" fill-opacity=".3" stroke="${INK}" stroke-width="2.6"/><circle cx="60" cy="51" r="8.5" fill="#fff" fill-opacity=".3" stroke="${INK}" stroke-width="2.6"/><path d="M48.5 50h3" stroke="${INK}" stroke-width="2.6"/>`;
  if (acc === 1) o += `<path d="M31 25c-11-2-11-17 1-17 2-9 15-10 19-3 9-6 22 4 15 17z" fill="#fff" ${s}/><rect x="30" y="22" width="40" height="9" rx="3" fill="#fff" ${s}/>`;
  if (acc === 3) o += `<path d="M66 20l-13-8v15z" fill="#ff5d8f" ${s}/><path d="M66 20l13-8v15z" fill="#ff5d8f" ${s}/><circle cx="66" cy="20" r="4.5" fill="#ff8fab" ${s}/>`;
  return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${o}</svg>`;
}

export const avatarHtml = (color, av, size = 52, cls = '') =>
  `<span class="avatar ${cls}" style="--c:${safeCol(color)};--s:${size}px">${avatarSvg(color, av)}</span>`;
