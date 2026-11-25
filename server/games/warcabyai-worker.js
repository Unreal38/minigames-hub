// Runs the warcaby bot's thinking on its own thread, so a strong bot never stalls the other tables.
import { parentPort } from 'node:worker_threads';
import { fromBoard, legal } from '../../public/games/warcaby/rules.js';
import { think, LEVELS } from './warcabyai.js';

parentPort.on('message', ({ id, b, turn, quiet, eg, level, ms, history }) => {
  let path = null;
  try {
    const pos = fromBoard(b, turn, quiet, eg), lv = LEVELS[level] || LEVELS.easy;
    const m = think(pos, { ...lv, ms: Math.max(30, Math.min(lv.ms, ms || lv.ms)), history }) || legal(pos)[0];
    path = m ? m.path : null;
  } catch (e) { path = null; }
  parentPort.postMessage({ id, path });
});
