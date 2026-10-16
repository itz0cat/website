const { session } = require('./_lib');
module.exports = (req, res) => {
  const s = session(req);
  res.setHeader('Cache-Control', 'no-store');
  res.json({ user: s ? { id: s.id, name: s.name, avatar: s.avatar } : null });
};
