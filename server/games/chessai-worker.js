// Runs the chess bot's thinking on its own thread, so a strong bot never stalls the other tables.
import { parentPort } from 'node:worker_threads';
import { fromFen, legal } from '../../public/games/chess/rules.js';
import { think, LEVELS } from './chessai.js';

parentPort.on('message', ({ id, fen, level, ms, history }) => {
  let m = 0;
  try {
    const pos = fromFen(fen), lv = LEVELS[level] || LEVELS.easy;
    m = think(pos, { ...lv, ms: Math.max(30, Math.min(lv.ms, ms || lv.ms)), history });
    if (!m) m = legal(pos)[0] || 0;
  } catch (e) { m = 0; }
  parentPort.postMessage({ id, m });
});
