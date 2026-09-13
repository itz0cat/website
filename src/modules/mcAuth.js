/**
 * Modular Mineflayer Authentication Plugin (ESM)
 * Compatible with SimpleLogin, AuthMe, and standard offline-mode servers.
 *
 * Supported syntax:
 *   - /register <password> <password> (SimpleLogin default)
 *   - /register <password>            (single parameter fallback)
 *   - /login <password>               (standard login)
 *
 * Usage:
 *   import { createAuthPlugin } from './mcAuth.js';
 *   bot.loadPlugin(createAuthPlugin({ password: 'proboyz' }));
 */

export function createAuthPlugin(options = {}) {
  const password = options.password || process.env.MC_AFK_PASSWORD || 'proboyz';
  const delayMs = options.delayMs || 1200;
  const logger = options.logger || console.log;

  return function authPlugin(bot) {
    let lastAuthTime = 0;

    function executeAuth(trigger = 'manual') {
      const now = Date.now();
      if (now - lastAuthTime < 4000) return;
      lastAuthTime = now;

      logger(`[mcAuth] Dispatched auth sequence (trigger: ${trigger})...`);
      try {
        // 1. SimpleLogin standard double-password format
        bot.chat(`/register ${password} ${password}`);

        // 2. Single-argument fallback
        setTimeout(() => {
          try { bot.chat(`/register ${password}`); } catch {}
        }, 400);

        // 3. Login command
        setTimeout(() => {
          try { bot.chat(`/login ${password}`); } catch {}
        }, 800);
      } catch (err) {
        logger(`[mcAuth] Error sending auth packets: ${err.message}`);
      }
    }

    // Expose manual trigger directly on bot instance
    bot.executeAuth = executeAuth;

    // Auto-auth on world spawn
    bot.on('spawn', () => {
      setTimeout(() => executeAuth('spawn'), delayMs);
    });

    // Reactive trigger if server prompts in chat or actionbar
    bot.on('message', (jsonMsg) => {
      const text = jsonMsg.toString().toLowerCase();
      if ((text.includes('register') || text.includes('login')) && Date.now() - lastAuthTime > 5000) {
        executeAuth('server-prompt');
      }
    });
  };
}
