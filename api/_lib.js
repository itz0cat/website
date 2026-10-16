// Shared helpers for the API routes. Secrets come from Vercel environment variables only.
const crypto = require('crypto');
const E = process.env;
const DAPI = 'https://discord.com/api/v10';

/* ---- signed cookies (stateless sessions) ---- */
const b64 = s => Buffer.from(s).toString('base64url');
const mac = body => crypto.createHmac('sha256', E.SESSION_SECRET || '').update(body).digest('base64url');
function sign(obj, ttlSec) {
  const body = b64(JSON.stringify({ ...obj, exp: Math.floor(Date.now() / 1000) + ttlSec }));
  return body + '.' + mac(body);
}
function verify(tok) {
  if (!tok || !E.SESSION_SECRET) return null;
  const [body, m] = tok.split('.');
  if (!body || !m) return null;
  const good = mac(body);
  if (m.length !== good.length || !crypto.timingSafeEqual(Buffer.from(m), Buffer.from(good))) return null;
  try { const o = JSON.parse(Buffer.from(body, 'base64url').toString()); return o.exp > Date.now() / 1000 ? o : null; } catch { return null; }
}
const cookies = req => Object.fromEntries((req.headers.cookie || '').split(/;\s*/).filter(Boolean).map(c => { const i = c.indexOf('='); return [c.slice(0, i), c.slice(i + 1)]; }));
function setCookie(res, name, val, maxAge) {
  const prev = res.getHeader('Set-Cookie') || [];
  res.setHeader('Set-Cookie', [].concat(prev, `${name}=${val}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`));
}
const session = req => verify(cookies(req).cg_session);
const siteUrl = req => (E.SITE_URL || `https://${req.headers['x-forwarded-host'] || req.headers.host}`).replace(/\/$/, '');

/* ---- Upstash Redis (REST) for one-trial-per-user and duplicate-payment checks ---- */
async function redis(...cmd) {
  if (!E.UPSTASH_REDIS_REST_URL) throw new Error('redis_not_configured');
  const r = await fetch(E.UPSTASH_REDIS_REST_URL, { method: 'POST', headers: { Authorization: 'Bearer ' + E.UPSTASH_REDIS_REST_TOKEN }, body: JSON.stringify(cmd) });
  const j = await r.json();
  if (j.error) throw new Error(j.error);
  return j.result;
}

/* ---- Discord bot ---- */
const bot = (path, method = 'GET', body) => fetch(DAPI + path, { method, headers: { Authorization: 'Bot ' + E.DISCORD_BOT_TOKEN, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
async function dm(userId, payload) {
  try {
    const c = await bot('/users/@me/channels', 'POST', { recipient_id: userId });
    if (!c.ok) return false;
    const ch = await c.json();
    return (await bot(`/channels/${ch.id}/messages`, 'POST', payload)).ok;
  } catch { return false; }
}

/* ---- KEY CREATION: wired to catcore POST /api/v1/admin/create-key ----
   CATCORE_API_URL   = https://catcore-backend.onrender.com/api/v1/admin
   CATCORE_ADMIN_TOKEN = the ADMIN_SECRET from catcore's .env */
async function createKey({ product, tier, hours, days, discordId, name, note }) {
  if (!E.CATCORE_API_URL) throw new Error('backend_not_configured');
  const call = (path, body) => fetch(E.CATCORE_API_URL.replace(/\/$/, '') + path, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Admin-Secret': E.CATCORE_ADMIN_TOKEN }, body: JSON.stringify(body)
  });
  const r = await call('/create-key', {
    tier: String(tier).toUpperCase(), products: [product.toUpperCase()], owner: '@' + (name || discordId),
    discordUser: name || null, discordId, durationDays: hours ? 1 : (days || 7)
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.key) throw new Error('backend_' + r.status);
  if (hours) {
    // create-key only takes whole days, so set the exact short expiry right after
    const x = await call('/set-key-expiry', { key: j.key, expiresAt: new Date(Date.now() + hours * 3600e3).toISOString() });
    if (!x.ok) { await call('/delete-key', { key: j.key }).catch(() => {}); throw new Error('backend_expiry'); }
  }
  return j.key;
}

module.exports = { E, DAPI, sign, verify, cookies, setCookie, session, siteUrl, redis, bot, dm, createKey };
