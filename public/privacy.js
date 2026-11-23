// The privacy page (privacy.html): shows the language the visitor picked on the site (the same saved pick as the
// hub, ct_lang) and the day or night look (ct_theme). The server already set <html lang> from its own guess.
const root = document.documentElement;
const get = k => { try { return localStorage.getItem(k) || ''; } catch { return ''; } };
const lang = get('ct_lang');
if (lang === 'pl' || lang === 'en') root.lang = lang;
const theme = get('ct_theme');
if (theme ? theme === 'night' : matchMedia('(prefers-color-scheme: dark)').matches) root.classList.add('night');
const pickTitle = () => { document.title = root.lang === 'en' ? 'Privacy · Zatoka Gier' : 'Prywatność · Zatoka Gier'; };
pickTitle();
addEventListener('DOMContentLoaded', () => {
  for (const b of document.querySelectorAll('.langs [data-l]')) b.addEventListener('click', () => {
    root.lang = b.dataset.l; pickTitle();
    try { localStorage.setItem('ct_lang', b.dataset.l); } catch {}
  });
});
