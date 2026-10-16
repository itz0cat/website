const { E, session, redis, bot, dm } = require('./_lib');
const clean = (v, n = 120) => String(v || '').replace(/[`@\n\r]/g, ' ').trim().slice(0, n);
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method' });
  if (!E.ADMIN_CHANNEL_ID) return res.status(500).json({ error: 'not_configured' });
  const b = req.body || {}, s = session(req);
  const o = { oid: clean(b.oid, 20), order: clean(b.order), amount: clean(b.amount, 40), method: clean(b.method, 30), txn: clean(b.txn, 80), discord: clean(b.discord, 40) };
  if (o.txn.length < 6 || !o.order) return res.status(400).json({ error: 'invalid' });
  try { if ((await redis('SET', 'txn:' + o.txn.toLowerCase(), o.oid, 'NX')) !== 'OK') return res.status(409).json({ error: 'txn_used' }); } catch {}
  const buyer = s ? `<@${s.id}> (${clean(s.name, 40)})` : `${o.discord} (not logged in)`;
  const r = await bot(`/channels/${E.ADMIN_CHANNEL_ID}/messages`, 'POST', {
    allowed_mentions: { parse: [] },
    embeds: [{ title: `Order ${o.oid}`, color: 0x6ba4e8, fields: [
      { name: 'Item', value: o.order }, { name: 'Amount', value: o.amount, inline: true },
      { name: 'Method', value: o.method, inline: true }, { name: 'Transaction ID', value: '`' + o.txn + '`' }, { name: 'Buyer', value: buyer }] }] });
  if (!r.ok) return res.status(502).json({ error: 'discord' });
  if (s) await dm(s.id, { embeds: [{ title: 'Order received', color: 0x6ba4e8, description: `We got order **${o.oid}** (${o.order}). Once the payment is verified your key will be sent here.` }] });
  res.json({ ok: true });
};
