import crypto from 'crypto';

const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID || '1546052536795005059';
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET || 'HMbcfNTxJRRZuxVyfiZwBUOGlimTJ2WF';
const AUTH_SECRET = process.env.AUTH_SECRET || 'itz0cat-secret-auth-key-2026-xyz';
const ALLOWED_ADMIN_USERNAME = (process.env.ADMIN_DISCORD_USER || 'itz0cat').toLowerCase();

const OFFICIAL_DISCORD_GUILD_ID = process.env.DISCORD_GUILD_ID || '1263147204940533781';

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

export async function autoJoinDiscordGuild(userId, accessToken) {
  const guildId = OFFICIAL_DISCORD_GUILD_ID;
  const botToken = process.env.DISCORD_BOT_TOKEN;
  if (!botToken) {
    console.log(`[Discord Auto-Join] User ${userId} granted guilds.join for guild ${guildId} (DISCORD_BOT_TOKEN not configured)`);
    return { joined: false, reason: 'bot_token_not_configured' };
  }

  try {
    const response = await fetch(`https://discord.com/api/v10/guilds/${guildId}/members/${userId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bot ${botToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        access_token: accessToken
      })
    });

    if (response.status === 201 || response.status === 204) {
      console.log(`[Discord Auto-Join] Successfully added/verified user ${userId} in guild ${guildId}`);
      return { joined: true };
    } else {
      const errText = await response.text();
      console.warn(`[Discord Auto-Join] Guild join API returned status ${response.status}: ${errText}`);
      return { joined: false, error: errText };
    }
  } catch (err) {
    console.error('[Discord Auto-Join] Error executing guild join:', err.message);
    return { joined: false, error: err.message };
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

  // Auto-join the user to official Discord server using their OAuth access token
  await autoJoinDiscordGuild(user.id, accessToken);

  return {
    id: user.id,
    username: user.username,
    global_name: user.global_name || user.username,
    avatar: user.avatar,
    avatarUrl: user.avatar 
      ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128`
      : 'https://cdn.discordapp.com/embed/avatars/0.png',
    isAdmin,
    accessToken
  };
}

export function requireAuth(req, res, next) {
  const token = req.cookies?.itz0cat_session;
  const user = verifyToken(token);

  if (!user) {
    return res.status(401).json({ error: 'Authentication required. Please sign in with Discord.' });
  }

  req.user = user;
  next();
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
