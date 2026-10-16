const { session, entitled, DOWNLOADS, jarPath, fs } = require('./_lib');
module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'private, no-store');
  const s = session(req), d = DOWNLOADS[String(req.query.p || '')];
  if (!s) return res.redirect(302, '/download');
  if (!d) return res.status(404).end('Not found');
  let owned;
  try { owned = await entitled(s.id); } catch { return res.status(502).end('Try again in a minute'); }
  if (!owned.has(String(req.query.p))) return res.status(403).end('No active key for this mod');
  let buf;
  try { buf = fs.readFileSync(jarPath(d.file)); } catch { return res.status(500).end('File missing'); }
  res.setHeader('Content-Type', 'application/java-archive');
  res.setHeader('Content-Disposition', `attachment; filename="${d.name}-${d.ver}+${d.mc}.jar"`);
  res.setHeader('Content-Length', buf.length);
  res.end(buf);
};
