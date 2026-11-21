// Little sticker icons for the order tickets: ingredients, dishes and the station each one needs.
const o = 'stroke="#3b2219" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"';
const svg = (body, s = 24) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" aria-hidden="true">${body}</svg>`;
const PARTS = {
  tomato: `<circle cx="12" cy="13.5" r="7.5" fill="#e5543b" ${o}/><path d="M9 6.5l3 2 3-2M12 8.5V5" fill="none" stroke="#4a9a45" stroke-width="2.2" stroke-linecap="round"/>`,
  lettuce: `<path d="M4 14c0-5 4-8 8-8s8 3 8 8c-2 3-5 4-8 4s-6-1-8-4z" fill="#7ccc5c" ${o}/><path d="M12 8v8M8.5 11l3.5 3 3.5-3" fill="none" stroke="#4a9a45" stroke-width="1.6" stroke-linecap="round"/>`,
  mushroom: `<path d="M4 12a8 7 0 0 1 16 0z" fill="#b98a5e" ${o}/><path d="M9.5 12h5l.5 7h-6z" fill="#fff4e2" ${o}/><circle cx="9" cy="9" r="1.2" fill="#fff4e2"/><circle cx="14.5" cy="8.5" r="1" fill="#fff4e2"/>`,
  bun: `<path d="M4 13a8 6.5 0 0 1 16 0z" fill="#e8a95b" ${o}/><path d="M4 15.5h16v2.5H4z" fill="#e8a95b" ${o}/><path d="M9 9.5h.5M13 8.5h.5M15.5 11h.5" stroke="#fff4e2" stroke-width="1.8" stroke-linecap="round"/>`,
  patty: `<rect x="4" y="9.5" width="16" height="6" rx="3" fill="#8a4b2a" ${o}/><path d="M8 12.5h2M13 12h3" stroke="#5e2f19" stroke-width="1.6" stroke-linecap="round"/>`,
};
const DISH = {
  salad: `<path d="M3 12h18a9 7 0 0 1-18 0z" fill="#fff4e2" ${o}/><circle cx="8" cy="10.5" r="3" fill="#7ccc5c" ${o}/><circle cx="13" cy="9.5" r="3" fill="#7ccc5c" ${o}/><circle cx="16.5" cy="11" r="2.4" fill="#e5543b" ${o}/>`,
  burger: `<path d="M4 11a8 6 0 0 1 16 0z" fill="#e8a95b" ${o}/><rect x="3.5" y="11" width="17" height="3.5" rx="1.7" fill="#8a4b2a" ${o}/><path d="M4 14.5h16v3H4z" fill="#e8a95b" ${o}/>`,
  deluxe: `<path d="M4 9.5a8 5.5 0 0 1 16 0z" fill="#e8a95b" ${o}/><path d="M3 10.5h18l-1.5 2h-15z" fill="#7ccc5c" ${o}/><rect x="4" y="12.5" width="16" height="2" fill="#e5543b" ${o}/><rect x="3.5" y="14.5" width="17" height="3" rx="1.5" fill="#8a4b2a" ${o}/><path d="M4 17.5h16v2.5H4z" fill="#e8a95b" ${o}/>`,
  tsoup: `<path d="M3 11h18a9 7.5 0 0 1-18 0z" fill="#fff4e2" ${o}/><path d="M5 11.5h14c-.5 2.5-3.5 4.5-7 4.5s-6.5-2-7-4.5z" fill="#e8603f"/><path d="M9 7c0-1.5 1.5-1.5 1.5-3M14 7c0-1.5 1.5-1.5 1.5-3" fill="none" stroke="#3b2219" stroke-width="1.6" stroke-linecap="round" opacity=".5"/>`,
  msoup: `<path d="M3 11h18a9 7.5 0 0 1-18 0z" fill="#fff4e2" ${o}/><path d="M5 11.5h14c-.5 2.5-3.5 4.5-7 4.5s-6.5-2-7-4.5z" fill="#c79a6a"/><path d="M9 7c0-1.5 1.5-1.5 1.5-3M14 7c0-1.5 1.5-1.5 1.5-3" fill="none" stroke="#3b2219" stroke-width="1.6" stroke-linecap="round" opacity=".5"/>`,
};
const TOOL = {
  knife: `<path d="M4 18L15 7l3 1-9 11z" fill="#d9dde3" ${o}/><path d="M15 7l3-3 2 2-2 2z" fill="#5b4636" ${o}/>`,
  pot: `<path d="M5 10h14v7a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3z" fill="#9aa4b0" ${o}/><path d="M3 10h18" ${o}/>`,
  pan: `<ellipse cx="10" cy="13" rx="7" ry="4" fill="#3f3a46" ${o}/><path d="M17 12l5-2" ${o}/>`,
};
export const part = (k, s = 18) => svg(PARTS[k] || '', s);
export const dish = (k, s = 34) => svg(DISH[k] || '', s);
export const tool = (k, s = 14) => svg(TOOL[k] || '', s);
export const PART_NAME = { tomato: 'tomato', lettuce: 'lettuce', mushroom: 'mushroom', bun: 'bun', patty: 'patty' };
