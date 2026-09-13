import { Router } from 'express';
import crypto from 'crypto';
import { requireAuth } from '../modules/auth.js';

export const toolsRouter = Router();

// Gated to any authenticated Discord user
toolsRouter.use(requireAuth);

// Helper to compute Minecraft Offline UUID (RFC 4122 v3 MD5)
function computeOfflineUuid(username) {
  const hash = crypto.createHash('md5').update(`OfflinePlayer:${username}`).digest();
  hash[6] = (hash[6] & 0x0f) | 0x30; // Version 3
  hash[8] = (hash[8] & 0x3f) | 0x80; // Variant 1
  const hex = hash.toString('hex');
  const dashed = [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20)
  ].join('-');
  return { hex, dashed };
}

// 1. GET /api/tools/player/:query - Player Skin, UUID & Profile Inspector
toolsRouter.get('/player/:query', async (req, res) => {
  const query = (req.params.query || '').trim();
  if (!query) {
    return res.status(400).json({ error: 'Player username or UUID is required' });
  }

  try {
    const playerDbRes = await fetch(`https://playerdb.co/api/player/minecraft/${encodeURIComponent(query)}`, {
      headers: { 'User-Agent': 'itz0cat-Utility-Hub/1.0' },
      signal: AbortSignal.timeout(6000)
    });

    if (playerDbRes.ok) {
      const data = await playerDbRes.json();
      if (data.success && data.data?.player) {
        const p = data.data.player;
        return res.json({
          success: true,
          type: 'mojang_verified',
          username: p.username,
          uuidDashed: p.id,
          uuidTrimmed: p.raw_id,
          avatarUrl: `https://mc-heads.net/avatar/${p.raw_id}/128`,
          headUrl: `https://mc-heads.net/head/${p.raw_id}/64`,
          body3dUrl: `https://mc-heads.net/body/${p.raw_id}/right`,
          skinTextureUrl: p.skin_texture || `https://mc-heads.net/skin/${p.raw_id}`,
          checkedAt: new Date().toISOString()
        });
      }
    }

    // Fallback: Calculate offline player credentials
    const offline = computeOfflineUuid(query);
    res.json({
      success: true,
      type: 'offline_or_custom',
      username: query,
      uuidDashed: offline.dashed,
      uuidTrimmed: offline.hex,
      avatarUrl: `https://mc-heads.net/avatar/${query}/128`,
      headUrl: `https://mc-heads.net/head/${query}/64`,
      body3dUrl: `https://mc-heads.net/body/${query}/right`,
      skinTextureUrl: `https://mc-heads.net/skin/${query}`,
      checkedAt: new Date().toISOString()
    });
  } catch (err) {
    res.status(502).json({ error: `Player inspection failed: ${err.message}` });
  }
});

// 2. GET /api/tools/server/:address - Live Server Ping & MOTD Checker
toolsRouter.get('/server/:address', async (req, res) => {
  const address = (req.params.address || '').trim();
  if (!address) {
    return res.status(400).json({ error: 'Server address is required' });
  }

  try {
    const cleanHost = address.replace(/^https?:\/\//, '').split('/')[0];
    const mcStatusRes = await fetch(`https://api.mcstatus.io/v2/status/java/${encodeURIComponent(cleanHost)}`, {
      headers: { 'User-Agent': 'itz0cat-Utility-Hub/1.0' },
      signal: AbortSignal.timeout(8000)
    });

    if (!mcStatusRes.ok) {
      return res.status(502).json({ error: `Server status query returned HTTP ${mcStatusRes.status}` });
    }

    const data = await mcStatusRes.json();
    res.json({
      online: !!data.online,
      host: data.host || cleanHost,
      port: data.port || 25565,
      ip: data.ip_address || null,
      version: data.version?.name_clean || data.version?.name_raw || 'Unknown',
      protocol: data.version?.protocol || null,
      players: {
        online: data.players?.online || 0,
        max: data.players?.max || 0,
        list: data.players?.list || []
      },
      motd: {
        clean: data.motd?.clean || 'A Minecraft Server',
        html: data.motd?.html || null
      },
      icon: data.icon || null,
      checkedAt: new Date().toISOString()
    });
  } catch (err) {
    res.status(502).json({ error: `Server ping error: ${err.message}` });
  }
});

// 3. POST /api/tools/format - Minecraft Color & Text Formatter
toolsRouter.post('/format', (req, res) => {
  const { text } = req.body || {};
  const input = String(text || '');

  // Minecraft color palette
  const COLOR_MAP = {
    '0': { name: 'black', hex: '#000000' },
    '1': { name: 'dark_blue', hex: '#0000aa' },
    '2': { name: 'dark_green', hex: '#00aa00' },
    '3': { name: 'dark_aqua', hex: '#00aaaa' },
    '4': { name: 'dark_red', hex: '#aa0000' },
    '5': { name: 'dark_purple', hex: '#aa00aa' },
    '6': { name: 'gold', hex: '#ffaa00' },
    '7': { name: 'gray', hex: '#aaaaaa' },
    '8': { name: 'dark_gray', hex: '#555555' },
    '9': { name: 'blue', hex: '#5555ff' },
    'a': { name: 'green', hex: '#55ff55' },
    'b': { name: 'aqua', hex: '#55ffff' },
    'c': { name: 'red', hex: '#ff5555' },
    'd': { name: 'light_purple', hex: '#ff55ff' },
    'e': { name: 'yellow', hex: '#ffff55' },
    'f': { name: 'white', hex: '#ffffff' }
  };

  const FORMAT_MAP = {
    'k': 'obfuscated',
    'l': 'bold',
    'm': 'strikethrough',
    'n': 'underline',
    'o': 'italic',
    'r': 'reset'
  };

  // Convert all '&' to '§'
  const normalized = input.replace(/&([0-9a-fk-or])/gi, '§$1');
  const ampersand = input.replace(/§([0-9a-fk-or])/gi, '&$1');
  const clean = normalized.replace(/§[0-9a-fk-or]/gi, '');

  // Generate HTML preview
  let html = '';
  let currentColor = '#ffffff';
  let currentFormats = new Set();
  const parts = normalized.split(/(§[0-9a-fk-or])/gi);

  for (const part of parts) {
    if (part.startsWith('§')) {
      const code = part[1].toLowerCase();
      if (COLOR_MAP[code]) {
        currentColor = COLOR_MAP[code].hex;
        currentFormats.clear();
      } else if (code === 'r') {
        currentColor = '#ffffff';
        currentFormats.clear();
      } else if (FORMAT_MAP[code]) {
        currentFormats.add(FORMAT_MAP[code]);
      }
    } else if (part) {
      let styles = [`color: ${currentColor}`];
      if (currentFormats.has('bold')) styles.push('font-weight: bold');
      if (currentFormats.has('italic')) styles.push('font-style: italic');
      if (currentFormats.has('underline')) styles.push('text-decoration: underline');
      if (currentFormats.has('strikethrough')) styles.push('text-decoration: line-through');
      
      const escaped = part
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

      html += `<span style="${styles.join('; ')}">${escaped}</span>`;
    }
  }

  // Generate Minecraft Chat JSON Component
  const jsonComponent = {
    text: '',
    extra: [
      {
        text: clean
      }
    ]
  };

  res.json({
    clean,
    section: normalized,
    ampersand,
    html: html || `<span>${clean}</span>`,
    json: JSON.stringify(jsonComponent, null, 2)
  });
});

// 4. GET /api/tools/uuid/:query - UUID Converter & Validator
toolsRouter.get('/uuid/:query', (req, res) => {
  const query = (req.params.query || '').trim();
  const hexOnly = query.replace(/[^0-9a-fA-F]/g, '');

  if (hexOnly.length === 32) {
    const dashed = [
      hexOnly.slice(0, 8),
      hexOnly.slice(8, 12),
      hexOnly.slice(12, 16),
      hexOnly.slice(16, 20),
      hexOnly.slice(20)
    ].join('-').toLowerCase();

    return res.json({
      valid: true,
      input: query,
      trimmed: hexOnly.toLowerCase(),
      dashed,
      offlineComputed: null
    });
  }

  // If query is a username, compute its offline UUID
  const offline = computeOfflineUuid(query);
  res.json({
    valid: false,
    input: query,
    note: 'Input was treated as a username because it did not match 32-hex UUID length.',
    offlineComputed: {
      username: query,
      trimmed: offline.hex,
      dashed: offline.dashed
    }
  });
});

// 5. GET /api/tools/proxy-pinger - FastClient 24/7 Proxy Pinger Live Telemetry
toolsRouter.get('/proxy-pinger', async (req, res) => {
  const { proxyPingerService } = await import('../modules/proxyPinger.js');
  res.json({
    success: true,
    telemetry: proxyPingerService.getStatus()
  });
});

// 6. GET /api/tools/afkbot - 24/7 Minecraft AFK Bot Live Telemetry
toolsRouter.get('/afkbot', async (req, res) => {
  const { afkBotService } = await import('../modules/afkbot.js');
  res.json({
    success: true,
    telemetry: afkBotService.getStatus()
  });
});


