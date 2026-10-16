const { E, session, redis, createKey, dm, bot, siteUrl, getActiveUserKey, checkBanned } = require('./_lib');
const HOURS = 2;
module.exports = async (req, res) => {
  if (checkBanned(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'method' });
  const s = session(req);
  if (!s) return res.status(401).json({ error: 'login' });
  const product = req.body && req.body.product;
  if (!['catgame', 'catflip'].includes(product)) return res.status(400).json({ error: 'product' });

  const flag = `trial:${product}:${s.id}`;
  try {
    if ((await redis('SET', flag, Date.now(), 'NX')) !== 'OK') {
      const existingKey = await getActiveUserKey(s.id, product);
      if (existingKey) {
        const name = product === 'catgame' ? 'CatGame' : 'CatFlip';
        const cmd = product === 'catgame' ? `/cat key ${existingKey}` : `/catflip license ${existingKey}`;
        return res.json({ ok: true, dm: false, key: existingKey, cmd, existing: true });
      }
      return res.status(409).json({ error: 'used' });
    }
  } catch { return res.status(500).json({ error: 'storage' }); }

  let key;
  try { key = await createKey({ product, tier: E.TRIAL_TIER || 'gold', hours: HOURS, discordId: s.id, name: s.name, note: 'website trial' }); }
  catch { await redis('DEL', flag).catch(() => {}); return res.status(502).json({ error: 'backend' }); }

  const name = product === 'catgame' ? 'CatGame' : 'CatFlip';
  const cmd = product === 'catgame' ? `/cat key ${key}` : `/catflip license ${key}`;
  const sent = await dm(s.id, { embeds: [{ title: `Your ${name} trial key`, color: 0x6ba4e8,
    description: `This key lasts ${HOURS} hours.\n\`${key}\`\n\nIn game, run:\n\`${cmd}\`\n\nDownload the mod: ${siteUrl(req)}/download\n\nLike it? Plans start at ₹20 a week in the store.` }] });

  if (E.ADMIN_CHANNEL_ID) {
    await bot(`/channels/${E.ADMIN_CHANNEL_ID}/messages`, 'POST', {
      allowed_mentions: { parse: [] },
      embeds: [{
        title: `Trial Claimed: ${name}`,
        color: 0x12805c,
        fields: [
          { name: 'Product', value: name, inline: true },
          { name: 'Tier', value: (E.TRIAL_TIER || 'gold').toUpperCase(), inline: true },
          { name: 'Duration', value: `${HOURS} Hours`, inline: true },
          { name: 'User', value: `<@${s.id}> (${s.name})`, inline: true },
          { name: 'Key', value: '`' + key + '`', inline: false }
        ],
        timestamp: new Date().toISOString()
      }]
    }).catch(() => {});
  }

  res.json({ ok: true, dm: sent, ...(sent ? {} : { key, cmd }) });
};
