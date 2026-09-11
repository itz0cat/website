import crypto from 'crypto';

const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID || '1546052536795005059';
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET || 'HMbcfNTxJRRZuxVyfiZwBUOGlimTJ2WF';
const AUTH_SECRET = process.env.AUTH_SECRET || 'itz0cat-secret-auth-key-2026-xyz';
const ALLOWED_ADMIN_USERNAME = (process.env.ADMIN_DISCORD_USER || 'itz0cat').toLowerCase();

export function getRedirectUri(req) {
  // If explicitly configured, use it (e.g. https://itz0cat.onrender.com)
  if (process.env.PUBLIC_URL) {
    return `${process.env.PUBLIC_URL}/api/auth/discord/callback`;
  }
  const host = req.get('host');
  const protocol = req.get('x-forwarded-proto') || req.protocol || 'https';
  return `${protocol}://${host}/api/auth/discord/callback`;
}

export function signToken(payload) {
  const jsonStr = JSON.stringify(payload);
  const dataB64 = Buffer.from(jsonStr).toString('base64url');
  const sig = crypto.createHmac('sha256', AUTH_SECRET).update(dataB64).digest('base64url');
  return `${dataB64}.${sig}`;
}

export function verifyToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [dataB64, sig] = parts;
  const expectedSig = crypto.createHmac('sha256', AUTH_SECRET).update(dataB64).digest('base64url');
  if (sig !== expectedSig) return null;

  try {
    const payload = JSON.parse(Buffer.from(dataB64, 'base64url').toString('utf8'));
    if (payload.exp && Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function exchangeCodeForDiscordUser(code, redirectUri) {
  const body = new URLSearchParams({
    client_id: DISCORD_CLIENT_ID,
    client_secret: DISCORD_CLIENT_SECRET,
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri
  });

  const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString()
  });

  if (!tokenRes.ok) {
    const errText = await tokenRes.text();
    throw new Error(`Discord token exchange failed (HTTP ${tokenRes.status}): ${errText}`);
  }

  const tokenData = await tokenRes.json();
  const accessToken = tokenData.access_token;

  const userRes = await fetch('https://discord.com/api/users/@me', {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!userRes.ok) {
    throw new Error(`Failed to fetch Discord user (HTTP ${userRes.status})`);
  }

  const user = await userRes.json();
  const username = (user.username || '').toLowerCase();
  const isAdmin = username === ALLOWED_ADMIN_USERNAME;

  return {
    id: user.id,
    username: user.username,
    global_name: user.global_name || user.username,
    avatar: user.avatar,
    avatarUrl: user.avatar 
      ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128`
      : 'https://cdn.discordapp.com/embed/avatars/0.png',
    isAdmin
  };
}

export function requireAdmin(req, res, next) {
  const token = req.cookies?.itz0cat_session;
  const user = verifyToken(token);

  if (!user) {
    return res.status(401).json({ error: 'Authentication required. Please login with Discord.' });
  }

  if (!user.isAdmin) {
    return res.status(403).json({
      error: `Access Denied: Only Discord user @${ALLOWED_ADMIN_USERNAME} is authorized for dev tools. (You are logged in as @${user.username})`
    });
  }

  req.user = user;
  next();
}

export function getUserFromReq(req) {
  const token = req.cookies?.itz0cat_session;
  return verifyToken(token);
}

export { DISCORD_CLIENT_ID, ALLOWED_ADMIN_USERNAME };
