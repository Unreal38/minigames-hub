// Hosts only: look at the game islands in another season (season3d.js). It changes only this browser's view, and
// only while the server says this account is a host (me.admin), so players can't switch it. Kept apart from
// season3d.js so the hub menu can use it without loading three.js.
export const PEEKS = ['winter', 'spring', 'summer', 'autumn', 'halloween'];
const KEY = 'ct_season_peek';
const get = () => { try { return localStorage.getItem(KEY); } catch { return null; } };
let host = false;
export const setPeekHost = on => { host = !!on; };                       // app.js, from each me message
export const peekPick = () => { const v = get(); return PEEKS.includes(v) ? v : 'auto'; };
export const peekSeason = () => host ? (peekPick() === 'auto' ? null : peekPick()) : null;
export const setPeek = v => { try { PEEKS.includes(v) ? localStorage.setItem(KEY, v) : localStorage.removeItem(KEY); } catch {} };

// Hosts only, the same way: look at the world weather (weather.js) as another kind on the hub and in games.
export const WX_PEEKS = ['sunny', 'cloudy', 'rain', 'wind', 'rainbow'];
const WKEY = 'ct_wx_peek';
const wget = () => { try { return localStorage.getItem(WKEY); } catch { return null; } };
export const wxPeekPick = () => { const v = wget(); return WX_PEEKS.includes(v) ? v : 'auto'; };
export const peekWeather = () => host ? (wxPeekPick() === 'auto' ? null : wxPeekPick()) : null;
export const setWxPeek = v => { try { WX_PEEKS.includes(v) ? localStorage.setItem(WKEY, v) : localStorage.removeItem(WKEY); } catch {} };
