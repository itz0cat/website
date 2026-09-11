import { Router } from 'express';
import { 
  DISCORD_CLIENT_ID, 
  getRedirectUri, 
  exchangeCodeForDiscordUser, 
  signToken, 
  getUserFromReq 
} from '../modules/auth.js';

export const authRouter = Router();

// GET /api/auth/login - Initiate Discord OAuth
authRouter.get('/login', (req, res) => {
  const redirectUri = getRedirectUri(req);
  const returnTo = req.query.returnTo || '/';
  const state = Buffer.from(JSON.stringify({ returnTo })).toString('base64url');
  const discordUrl = `https://discord.com/oauth2/authorize?client_id=${DISCORD_CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&scope=identify%20email%20guilds.join&state=${state}`;
  res.redirect(discordUrl);
});

// GET /api/auth/discord/callback - OAuth Callback
authRouter.get('/discord/callback', async (req, res) => {
  const code = req.query.code;
  let returnTo = '/';

  if (req.query.state) {
    try {
      const decoded = JSON.parse(Buffer.from(req.query.state, 'base64url').toString('utf8'));
      if (decoded.returnTo && typeof decoded.returnTo === 'string' && decoded.returnTo.startsWith('/')) {
        returnTo = decoded.returnTo;
      }
    } catch {
      // ignore state parse errors
    }
  }

  if (!code) {
    return res.redirect(`${returnTo}${returnTo.includes('?') ? '&' : '?'}auth_error=missing_code`);
  }

  try {
    const redirectUri = getRedirectUri(req);
    const user = await exchangeCodeForDiscordUser(code, redirectUri);

    // Create signed token with 7-day expiration
    const token = signToken({
      id: user.id,
      username: user.username,
      global_name: user.global_name,
      avatarUrl: user.avatarUrl,
      isAdmin: user.isAdmin,
      exp: Date.now() + (7 * 24 * 60 * 60 * 1000)
    });

    const isSecure = req.protocol === 'https' || req.get('x-forwarded-proto') === 'https';

    res.cookie('itz0cat_session', token, {
      httpOnly: true,
      secure: isSecure,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    if (user.isAdmin) {
      res.redirect(returnTo === '/' ? '/tools' : returnTo);
    } else {
      res.redirect(returnTo === '/' ? '/community' : returnTo);
    }
  } catch (err) {
    console.error('[Auth] OAuth error:', err.message);
    res.redirect(`${returnTo}${returnTo.includes('?') ? '&' : '?'}auth_error=${encodeURIComponent(err.message)}`);
  }
});

// GET /api/auth/me - Check current authentication state
authRouter.get('/me', (req, res) => {
  const user = getUserFromReq(req);
  if (!user) {
    return res.json({ loggedIn: false, user: null, isAdmin: false });
  }
  res.json({
    loggedIn: true,
    user: {
      id: user.id,
      username: user.username,
      global_name: user.global_name,
      avatarUrl: user.avatarUrl
    },
    isAdmin: !!user.isAdmin
  });
});

// POST /api/auth/logout - Sign out
authRouter.post('/logout', (req, res) => {
  res.clearCookie('itz0cat_session');
  res.json({ message: 'Logged out successfully' });
});
