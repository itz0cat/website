const { session, entitled, DOWNLOADS, fileSize, checkBanned } = require('./_lib');
module.exports = async (req, res) => {
  if (checkBanned(req, res)) return;
  res.setHeader('Cache-Control', 'no-store');
  const s = session(req);
  if (!s) return res.status(401).json({ error: 'login' });
  let owned;
  try { owned = await entitled(s.id); } catch { return res.status(502).json({ error: 'backend' }); }
  res.json({ items: Object.entries(DOWNLOADS).filter(([id]) => owned.has(id)).map(([id, d]) => ({ id, name: d.name, ver: d.ver, mc: d.mc, logo: d.logo, extra: d.extra, size: fileSize(d.file) })) });
};
