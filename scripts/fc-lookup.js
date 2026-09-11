#!/usr/bin/env node

/**
 * FastClient User Intelligence & Lookup Tool
 * Single-file standalone CLI to inspect FastClient players, cosmetics, and CDN assets.
 */

const MANIFEST_URL = 'https://files.fastclient.net/fastclient/active-users.txt';
const MD5_URL = 'https://files.fastclient.net/fastclient/players.md5';
const PING_URL = 'https://api.fastclient.net/api/fastclient/ping';
const CDN_ROOT = 'https://files.fastclient.net/textures';
const MOJANG_API = 'https://api.mojang.com/users/profiles/minecraft';

const args = process.argv.slice(2);

// Colors for terminal output
const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  gray: '\x1b[90m',
  white: '\x1b[37m'
};

async function fetchManifest() {
  const res = await fetch(MANIFEST_URL, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`Failed to fetch manifest: HTTP ${res.status}`);
  const text = await res.text();
  return text.split('\n').map(l => l.trim()).filter(Boolean);
}

async function checkAsset(url) {
  try {
    const res = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(5000) });
    if (res.ok) {
      const len = res.headers.get('content-length') || 'unknown';
      return { exists: true, size: len, url };
    }
  } catch {}
  return { exists: false, url };
}

async function getMojangProfile(username) {
  try {
    const res = await fetch(`${MOJANG_API}/${encodeURIComponent(username)}`, {
      signal: AbortSignal.timeout(5000)
    });
    if (res.ok) {
      return await res.json();
    }
  } catch {}
  return null;
}

async function lookupUser(targetUser) {
  console.log(`\n${c.cyan}${c.bold}⚡ Inspecting FastClient Status for: ${c.white}${targetUser}${c.reset}\n`);

  const [users, mojang, cape, skin, slimSkin] = await Promise.all([
    fetchManifest().catch(() => []),
    getMojangProfile(targetUser),
    checkAsset(`${CDN_ROOT}/capes/${targetUser}.png`),
    checkAsset(`${CDN_ROOT}/skins/${targetUser}.png`),
    checkAsset(`${CDN_ROOT}/skins/${targetUser}-slim.png`)
  ]);

  const targetLower = targetUser.toLowerCase();
  const index = users.findIndex(u => u.toLowerCase() === targetLower);
  const isActive = index !== -1;
  const exactCasedName = isActive ? users[index] : targetUser;

  console.log(`${c.bold}================ FastClient Player Report ================${c.reset}`);
  console.log(`${c.bold}Target Username:${c.reset}  ${exactCasedName}`);
  
  if (mojang) {
    console.log(`${c.bold}Mojang Account:${c.reset}   ${c.green}Verified${c.reset} (UUID: ${c.gray}${mojang.id}${c.reset})`);
  } else {
    console.log(`${c.bold}Mojang Account:${c.reset}   ${c.yellow}Unverified / Offline Name${c.reset}`);
  }

  if (isActive) {
    console.log(`${c.bold}FastClient State:${c.reset} ${c.green}${c.bold}● ACTIVE USER${c.reset} (Rank #${index + 1} of ${users.length})`);
    console.log(`${c.bold}Tablist Icon:${c.reset}     ${c.green}Enabled${c.reset} (Visible to all FastClient players)`);
    console.log(`${c.bold}Nametag Badge:${c.reset}    ${c.green}Enabled${c.reset} (Floating badge rendered)`);
  } else {
    console.log(`${c.bold}FastClient State:${c.reset} ${c.red}○ NOT ACTIVE${c.reset} (Not found in manifest)`);
    console.log(`${c.gray}Tip: Run "fc-lookup --ping ${targetUser}" to register this player.${c.reset}`);
  }

  console.log(`\n${c.bold}Cosmetics & CDN Assets:${c.reset}`);
  if (cape.exists) {
    console.log(`  • ${c.magenta}Custom Cape:${c.reset}  ${c.green}FOUND${c.reset} (${cape.size} bytes) -> ${c.cyan}${cape.url}${c.reset}`);
  } else {
    console.log(`  • ${c.magenta}Custom Cape:${c.reset}  ${c.gray}None${c.reset}`);
  }

  if (skin.exists) {
    console.log(`  • ${c.magenta}Classic Skin:${c.reset} ${c.green}FOUND${c.reset} (${skin.size} bytes) -> ${c.cyan}${skin.url}${c.reset}`);
  } else {
    console.log(`  • ${c.magenta}Classic Skin:${c.reset} ${c.gray}None${c.reset}`);
  }

  if (slimSkin.exists) {
    console.log(`  • ${c.magenta}Slim Skin:${c.reset}    ${c.green}FOUND${c.reset} (${slimSkin.size} bytes) -> ${c.cyan}${slimSkin.url}${c.reset}`);
  } else {
    console.log(`  • ${c.magenta}Slim Skin:${c.reset}    ${c.gray}None${c.reset}`);
  }

  console.log(`${c.bold}==========================================================${c.reset}\n`);
}

async function searchUsers(query) {
  console.log(`\nSearching FastClient active users for "${query}"...`);
  const users = await fetchManifest();
  const q = query.toLowerCase();
  const matches = users.filter(u => u.toLowerCase().includes(q));

  console.log(`\nFound ${matches.length} matching player(s) out of ${users.length} total:`);
  console.log('----------------------------------------------------------');
  matches.slice(0, 50).forEach((u, i) => {
    console.log(` ${c.cyan}${(i + 1).toString().padStart(2, ' ')}.${c.reset} ${u}`);
  });
  if (matches.length > 50) {
    console.log(`${c.gray}...and ${matches.length - 50} more players.${c.reset}`);
  }
  console.log('----------------------------------------------------------\n');
}

async function pingUser(username) {
  console.log(`\nSending FastClient registration ping for "${username}"...`);
  try {
    const res = await fetch(PING_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) FastClient/1.21.11'
      },
      body: JSON.stringify({ username })
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok) {
      console.log(`${c.green}${c.bold}✓ Success!${c.reset} FastClient accepted heartbeat for "${username}".`);
      console.log(`Response:`, json);
      console.log(`${c.gray}Note: Manifest updates on CDN every 60-120 seconds.${c.reset}\n`);
    } else {
      console.error(`${c.red}✗ Failed with HTTP ${res.status}:${c.reset}`, json);
    }
  } catch (err) {
    console.error(`${c.red}Request error:${c.reset}`, err.message);
  }
}

async function showStats() {
  console.log('\nFetching FastClient network stats...');
  const [users, md5] = await Promise.all([
    fetchManifest().catch(() => []),
    fetch(MD5_URL).then(r => r.text()).catch(() => 'unknown')
  ]);

  console.log(`\n${c.bold}FastClient Network Overview:${c.reset}`);
  console.log(`• Total Active Players: ${c.green}${c.bold}${users.length.toLocaleString()}${c.reset}`);
  console.log(`• Manifest MD5 Hash:    ${c.cyan}${md5.trim()}${c.reset}`);
  console.log(`• CDN Root:             ${CDN_ROOT}\n`);
}

function showHelp() {
  console.log(`
${c.bold}FastClient User Lookup Tool${c.reset}
Usage:
  fc-lookup <username>           Inspect a specific Minecraft player
  fc-lookup -s, --search <query> Search player names in active users
  fc-lookup -p, --ping <user>    Register/ping a username to FastClient
  fc-lookup --stats              View total network user stats
  fc-lookup -h, --help           Show this help manual

Examples:
  fc-lookup Itz0Cat__
  fc-lookup -s "cat"
  fc-lookup --ping Steve
`);
}

async function main() {
  if (args.length === 0 || args[0] === '-h' || args[0] === '--help') {
    showHelp();
    return;
  }

  if (args[0] === '-s' || args[0] === '--search') {
    if (!args[1]) {
      console.error('Please specify a search query.');
      process.exit(1);
    }
    await searchUsers(args[1]);
    return;
  }

  if (args[0] === '-p' || args[0] === '--ping') {
    if (!args[1]) {
      console.error('Please specify a username to ping.');
      process.exit(1);
    }
    await pingUser(args[1]);
    return;
  }

  if (args[0] === '--stats') {
    await showStats();
    return;
  }

  await lookupUser(args[0]);
}

main().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
