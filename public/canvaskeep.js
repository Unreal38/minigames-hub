// Keeps the pictures we paint for 3D scenes (avatar faces, hair, well walls, cards, labels...) when a phone puts the
// page in the background. Chrome on Android keeps 2D canvases on the GPU and may throw their pixels away while the
// tab is hidden; when the 3D view comes back it uploads those canvases again and gets blank ones, so faces, hair and
// textured walls turn solid black. A canvas kept in ordinary memory (willReadFrequently) is never thrown away.
// So every 2D canvas painted while it is not on the page (the ones made to become textures) is kept in memory.
// Canvases already on the page are left alone, and a caller can still choose by passing willReadFrequently itself.
// Loaded as a plain script before any module, so it covers every canvas the site makes.
(function () {
  if (typeof HTMLCanvasElement === 'undefined') return;
  const P = HTMLCanvasElement.prototype, get = P.getContext;
  if (get.__keep) return;
  const keep = function (kind, opts) {
    if (kind === '2d' && !this.isConnected && !(opts && 'willReadFrequently' in opts)) opts = Object.assign({}, opts, { willReadFrequently: true });
    return get.call(this, kind, opts);
  };
  keep.__keep = true;
  P.getContext = keep;
})();
