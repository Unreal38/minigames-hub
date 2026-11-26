// The game pages (server/gamepages.js): the day or night look, the same pick as the hub (ct_theme), else the system's.
try {
  const t = localStorage.getItem('ct_theme');
  if (t ? t === 'night' : matchMedia('(prefers-color-scheme: dark)').matches) document.documentElement.classList.add('night');
} catch {}
