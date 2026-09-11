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
  const discordUrl = `https://discord.com/oauth2/authorize?client_id=${DISCORD_CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&scope=identify`;
  res.redirect(discordUrl);
});

// GET /api/auth/discord/callback - OAuth Callback
authRouter.get('/discord/callback', async (req, res) => {
  const code = req.query.code;
  if (!code) {
    return res.redirect('/?auth_error=missing_code');
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
      res.redirect('/#admin');
    } else {
      res.redirect('/?user=' + encodeURIComponent(user.username));
    }
  } catch (err) {
    console.error('[Auth] OAuth error:', err.message);
    res.redirect('/?auth_error=' + encodeURIComponent(err.message));
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
