const crypto = require('crypto');
const { E, sign, setCookie, siteUrl } = require('../_lib');
module.exports = (req, res) => {
  const state = crypto.randomBytes(16).toString('hex');
  const next = String(req.query.next || '/trial');
  const safe = next.startsWith('/') && !next.startsWith('//') ? next : '/trial';
  setCookie(res, 'cg_state', sign({ state, next: safe }, 600), 600);
  const q = new URLSearchParams({
    client_id: E.DISCORD_CLIENT_ID, redirect_uri: siteUrl(req) + '/api/auth/callback',
    response_type: 'code', scope: 'identify guilds.join', state, prompt: 'none'
  });
  res.redirect(302, 'https://discord.com/api/oauth2/authorize?' + q);
};
