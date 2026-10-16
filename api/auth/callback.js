const { E, DAPI, verify, cookies, sign, setCookie, siteUrl, bot } = require('../_lib');
module.exports = async (req, res) => {
  const { code, state } = req.query;
  const st = verify(cookies(req).cg_state);
  if (!code || !st || st.state !== state) return res.redirect(302, '/trial?error=auth');
  try {
    const tr = await fetch(DAPI + '/oauth2/token', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: E.DISCORD_CLIENT_ID, client_secret: E.DISCORD_CLIENT_SECRET, grant_type: 'authorization_code', code, redirect_uri: siteUrl(req) + '/api/auth/callback' })
    });
    if (!tr.ok) throw new Error('token');
    const tok = await tr.json();
    const u = await (await fetch(DAPI + '/users/@me', { headers: { Authorization: 'Bearer ' + tok.access_token } })).json();
    if (!u.id) throw new Error('user');
    // Add the user to your server so the bot can DM them (needs the guilds.join scope they just approved).
    await bot(`/guilds/${E.DISCORD_GUILD_ID}/members/${u.id}`, 'PUT', { access_token: tok.access_token }).catch(() => {});
    const week = 60 * 60 * 24 * 7;
    setCookie(res, 'cg_session', sign({ id: u.id, name: u.global_name || u.username, avatar: u.avatar }, week), week);
    setCookie(res, 'cg_state', '', 0);
    res.redirect(302, st.next);
  } catch { res.redirect(302, '/trial?error=auth'); }
};
