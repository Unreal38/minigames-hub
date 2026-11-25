// Pet Farm: small pictures for materials, food and coins, drawn as inline SVG so they stay sharp at any size.
const K = '#3b2216'; // the outline
const S = `stroke="${K}" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"`;
const ART = {
  wood: `<rect x="2.5" y="7.5" width="19" height="9" rx="4.5" fill="#b07a4f" ${S}/><ellipse cx="17.5" cy="12" rx="3.2" ry="4.5" fill="#edcfa0" ${S}/><circle cx="17.5" cy="12" r="1.1" fill="${K}"/><path d="M6 10.5h5M7 13.5h4" ${S} fill="none"/>`,
  stone: `<path d="M3 16l2.5-7L11 5l7 2 3.5 6-2 5.5H5z" fill="#a9a6b0" ${S}/><path d="M11 5l1.5 6L21.5 13M12.5 11L5 18.5" fill="none" ${S} stroke-width="1.1"/><path d="M5.5 9L11 5l1.5 6z" fill="#cfccd6"/>`,
  fiber: `<path d="M12 21c-5-4-7-9-6-16 4 3 6 8 6 16z" fill="#86cc5a" ${S}/><path d="M12 21c5-4 7-9 6-16-4 3-6 8-6 16z" fill="#5fb04a" ${S}/><path d="M12 21V4" fill="none" ${S}/><rect x="8.5" y="16.5" width="7" height="2.6" rx="1.3" fill="#edcfa0" ${S}/>`,
  shells: `<path d="M12 20l-3-1.5C5 16 3 12.5 3.5 9 5 5.5 8.5 4 12 4s7 1.5 8.5 5c.5 3.5-1.5 7-5.5 9.500z" fill="#ffb6c9" ${S}/><path d="M12 20V4M12 20L6 6.500M12 20l6-13.500M12 20L3.8 10.500M12 20l8.2-9.5" fill="none" ${S} stroke-width="1.1"/>`,
  coal: `<path d="M4 15l2-7 6-3.5 7 3 2 6.5-4 5.500H7z" fill="#4a4550" ${S}/><path d="M8 9.500l4-2 3 1.5-4 1.500z" fill="#8a8494"/>`,
  crystal: `<path d="M12 2.500l6 6.5-6 12.500L6 9z" fill="#8fe3f5" ${S}/><path d="M6 9h12M12 2.500L9.5 9 12 21.5 14.5 9z" fill="none" ${S} stroke-width="1.1"/><path d="M12 2.500L9.5 9H6z" fill="#d6f7fd"/>`,
  berries: `<circle cx="8.5" cy="15" r="5" fill="#d9455f" ${S}/><circle cx="16" cy="13" r="4.5" fill="#e9667c" ${S}/><path d="M11 8c0-3 2-4.5 5-4.5-.5 3-2 4.5-5 4.500z" fill="#5fb04a" ${S}/><circle cx="7" cy="13.5" r="1.1" fill="#fff"/>`,
  sunberry: `<path d="M12 2l2 3.5 4-.5-.5 4 3.5 2-3.5 2 .5 4-4-.5-2 3.5-2-3.5-4 .5.5-4L3 11l3.5-2-.500-4 4 .500z" fill="#ffd95a" ${S}/><circle cx="12" cy="11" r="4.5" fill="#ffb000" ${S}/><circle cx="10.5" cy="9.5" r="1.1" fill="#fff"/>`,
  cookie: `<circle cx="12" cy="12" r="9" fill="#d9a066" ${S}/><circle cx="8.5" cy="9" r="1.5" fill="#d9455f"/><circle cx="14.5" cy="8" r="1.3" fill="${K}"/><circle cx="15.5" cy="14.5" r="1.5" fill="#d9455f"/><circle cx="9.5" cy="15.5" r="1.3" fill="${K}"/><circle cx="12" cy="12" r="1" fill="${K}"/>`,
  cake: `<path d="M3 19V11l9-5 9 5v8z" fill="#ffd98a" ${S}/><path d="M3 11l9-5 9 5-9 3z" fill="#fff6e0" ${S}/><path d="M3 15l9 2.5 9-2.5" fill="none" ${S} stroke-width="1.1"/><circle cx="12" cy="8" r="2" fill="#d9455f" ${S}/>`,
  juice: `<path d="M6 7h12l-1.5 14h-9z" fill="#f4e9ff" ${S}/><path d="M6.7 12h10.600L16.5 21h-9z" fill="#c86bd6" ${S}/><path d="M13 12l3-10" fill="none" ${S}/>`,
  pie: `<path d="M3 14c0-5 4-9 9-9s9 4 9 9z" fill="#f08a3c" ${S}/><path d="M1.5 14h21l-2 5h-17z" fill="#edcfa0" ${S}/><path d="M9 9.500v2.500M12 8.500V12M15 9.500v2.5" fill="none" ${S}/>`,
  tonic: `<path d="M9.5 8V5h5v3l3.5 4v8.500h-12V12z" fill="#eafaff" ${S}/><path d="M6 14h12v6.500H6z" fill="#7fd0e8" ${S}/><rect x="9" y="2" width="6" height="3" rx="1" fill="#b07a4f" ${S}/><path d="M12 15.500v3M10.5 17h3" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/>`,
  pack: `<path d="M8.5 6.5V5a3.5 3.5 0 0 1 7 0v1.5" fill="none" ${S}/><rect x="4.5" y="6.5" width="15" height="15" rx="4.5" fill="#7fa65a" ${S}/><path d="M4.5 11.5c0-3 2-5 4.5-5h6c2.5 0 4.5 2 4.5 5v1H4.5z" fill="#9cc46e" ${S}/><rect x="8" y="14.5" width="8" height="5" rx="1.8" fill="#c99a5e" ${S} stroke-width="1.2"/><circle cx="12" cy="12.5" r="1.2" fill="#ffc94d" ${S} stroke-width="1"/>`,
  coins: `<circle cx="12" cy="12" r="9" fill="#ffc94d" ${S}/><circle cx="12" cy="12" r="5.8" fill="#ffe08a" ${S} stroke-width="1.2"/><path d="M12 8.500l1.1 2.3 2.4.300-1.8 1.7.500 2.5-2.2-1.3-2.2 1.3.500-2.5-1.8-1.7 2.4-.300z" fill="#f0a020"/>`,
};
export const matIcon = (k, size = 20) => `<svg class="mi" viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true">${ART[k] || `<rect x="4" y="4" width="16" height="16" rx="4" fill="#ccc" ${S}/>`}</svg>`;
