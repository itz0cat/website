const { E, session, redis, createKey, dm, bot, siteUrl, getActiveUserKey, checkBanned } = require('./_lib');
const HOURS = 2;

const PRODUCTS = {
  catgame: { name: 'CatGame', cmd: k => `/cat key ${k}`, tier: E.TRIAL_TIER || 'gold' },
  catflip: { name: 'CatFlip', cmd: k => `/catflip license ${k}`, tier: E.TRIAL_TIER || 'gold' },
  catsell: { name: 'CatSell', cmd: k => `/catsell key ${k}`, tier: 'STANDARD' },
  catorder: { name: 'CatOrder', cmd: k => `/catorder key ${k}`, tier: 'STANDARD' },
  catdrop: { name: 'CatDrop', cmd: k => `/catdrop key ${k}`, tier: 'STANDARD' }
};

module.exports = async (req, res) => {
  if (checkBanned(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'method' });
  const s = session(req);
  if (!s) return res.status(401).json({ error: 'login' });
  const product = req.body && String(req.body.product).toLowerCase();
  const prodConfig = PRODUCTS[product];
  if (!prodConfig) return res.status(400).json({ error: 'product' });

  const flag = `trial:${product}:${s.id}`;
  try {
    if ((await redis('SET', flag, Date.now(), 'NX')) !== 'OK') {
      const existingKey = await getActiveUserKey(s.id, product);
      if (existingKey) {
        const cmd = prodConfig.cmd(existingKey);
        return res.json({ ok: true, dm: false, key: existingKey, cmd, existing: true });
      }
      return res.status(409).json({ error: 'used' });
    }
  } catch { return res.status(500).json({ error: 'storage' }); }

  let key;
  try { key = await createKey({ product, tier: prodConfig.tier, hours: HOURS, discordId: s.id, name: s.name, note: 'website trial' }); }
  catch { await redis('DEL', flag).catch(() => {}); return res.status(502).json({ error: 'backend' }); }

  const name = prodConfig.name;
  const cmd = prodConfig.cmd(key);
  const sent = await dm(s.id, { embeds: [{ title: `Your ${name} trial key`, color: 0x6ba4e8,
    description: `This key lasts ${HOURS} hours.\n\`${key}\`\n\nIn game, run:\n\`${cmd}\`\n\nDownload the mod: ${siteUrl(req)}/download\n\nLike it? Visit the store to get a license.` }] });

  if (E.ADMIN_CHANNEL_ID) {
    await bot(`/channels/${E.ADMIN_CHANNEL_ID}/messages`, 'POST', {
      allowed_mentions: { parse: [] },
      embeds: [{
        title: `Trial Claimed: ${name}`,
        color: 0x12805c,
        fields: [
          { name: 'Product', value: name, inline: true },
          { name: 'Tier', value: String(prodConfig.tier).toUpperCase(), inline: true },
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
