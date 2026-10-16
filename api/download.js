const { session, entitled, DOWNLOADS, jarPath, fs, checkBanned } = require('./_lib');
module.exports = async (req, res) => {
  if (checkBanned(req, res)) return;
  res.setHeader('Cache-Control', 'private, no-store');
  const s = session(req), d = DOWNLOADS[String(req.query.p || '')];
  if (!s) return res.redirect(302, '/download');
  if (!d) return res.status(404).end('Not found');
  if (req.query.agree !== '1') return res.status(400).end('You must confirm you are 12+ and agree to the Terms of Service & Privacy Policy before downloading.');
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
