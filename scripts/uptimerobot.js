#!/usr/bin/env node

/**
 * UptimeRobot CLI Controller (v3 API)
 * Manage UptimeRobot monitors directly from your terminal.
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const UPTIMEROBOT_V3 = 'https://api.uptimerobot.com/v3';
const DEFAULT_KEY = process.env.UPTIMEROBOT_API_KEY || 'u2645836-d0c16ea20081b5f1f26e3831';

const [,, command, ...args] = process.argv;

function resolveKey(potentialKey) {
  if (potentialKey && potentialKey.startsWith('u')) {
    return potentialKey;
  }
  return DEFAULT_KEY;
}

const COMMON_HEADERS = (apiKey) => ({
  'Authorization': `Bearer ${apiKey}`,
  'Content-Type': 'application/json',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
});

async function listMonitors(apiKeyArg) {
  const apiKey = resolveKey(apiKeyArg);
  console.log('Fetching monitors from UptimeRobot (v3 API)...');
  try {
    const res = await fetch(`${UPTIMEROBOT_V3}/monitors`, {
      headers: COMMON_HEADERS(apiKey)
    });
    const json = await res.json();
    const monitors = json.data || [];
    console.log(`\nFound ${monitors.length} active monitor(s):`);
    console.log('================================================================');
    monitors.forEach(m => {
      console.log(`• ID: ${m.id} | Name: "${m.friendlyName}"`);
      console.log(`  URL:      ${m.url}`);
      console.log(`  Status:   [${m.status}] | Interval: ${m.interval / 60}m | Method: ${m.httpMethodType}`);
      console.log('----------------------------------------------------------------');
    });
  } catch (err) {
    console.error('Request failed:', err.message);
  }
}

async function addMonitor(nameArg, urlArg, intervalMinsArg) {
  let apiKey = DEFAULT_KEY;
  let friendlyName = nameArg;
  let url = urlArg;
  let interval = intervalMinsArg || 5;

  // Handle if user passes apiKey first
  if (nameArg && nameArg.startsWith('u264')) {
    apiKey = nameArg;
    friendlyName = urlArg;
    url = intervalMinsArg;
    interval = args[3] || 5;
  }

  if (!friendlyName || !url) {
    console.error('Usage: uptimerobot add <FriendlyName> <URL> [intervalMinutes=5]');
    console.error('Example: uptimerobot add "My Service" "https://my-app.onrender.com/health" 5');
    process.exit(1);
  }

  const intervalSeconds = parseInt(interval, 10) * 60;
  console.log(`Creating monitor "${friendlyName}" -> ${url} (${intervalSeconds / 60} min interval)...`);

  try {
    const res = await fetch(`${UPTIMEROBOT_V3}/monitors`, {
      method: 'POST',
      headers: COMMON_HEADERS(apiKey),
      body: JSON.stringify({
        type: 'HTTP',
        friendlyName,
        url,
        interval: intervalSeconds,
        timeout: 30,
        httpMethodType: 'GET',
        assignedAlertContacts: [{ alertContactId: 6567908, threshold: 0, recurrence: 0 }]
      })
    });
    const data = await res.json();
    if (data.id) {
      console.log(`✓ Monitor created successfully! ID: ${data.id} (Status: ${data.status})`);
    } else {
      console.error('Failed to create monitor:', data);
    }
  } catch (err) {
    console.error('Request failed:', err.message);
  }
}

async function deleteMonitor(monitorIdArg) {
  const apiKey = DEFAULT_KEY;
  if (!monitorIdArg) {
    console.error('Usage: uptimerobot delete <MonitorID>');
    process.exit(1);
  }
  console.log(`Deleting monitor ID ${monitorIdArg}...`);
  try {
    const res = await fetch(`${UPTIMEROBOT_V3}/monitors/${monitorIdArg}`, {
      method: 'DELETE',
      headers: COMMON_HEADERS(apiKey)
    });
    if (res.ok || res.status === 204) {
      console.log('✓ Monitor deleted successfully.');
    } else {
      const data = await res.json().catch(() => ({}));
      console.error(`Failed to delete monitor (HTTP ${res.status}):`, data);
    }
  } catch (err) {
    console.error('Request failed:', err.message);
  }
}

async function testPing(targetUrl) {
  const url = targetUrl || process.env.BACKEND_URL || 'https://random-itz0cat.onrender.com/health';
  console.log(`Pinging ${url}...`);
  const start = Date.now();
  try {
    const res = await fetch(url);
    const ms = Date.now() - start;
    console.log(`Response: HTTP ${res.status} (${ms}ms)`);
    const text = await res.text();
    try {
      console.log(JSON.stringify(JSON.parse(text), null, 2));
    } catch {
      console.log(text.slice(0, 200));
    }
  } catch (err) {
    console.error('Ping failed:', err.message);
  }
}

function showHelp() {
  console.log(`
UptimeRobot CLI Controller (v3 API)
===================================
Default API Key is automatically loaded from .env!

Commands:
  uptimerobot list                       List all active monitors
  uptimerobot add <Name> <URL> [mins=5]  Create a new HTTP monitor (5m default)
  uptimerobot delete <MonitorID>         Delete a monitor by ID
  uptimerobot ping [URL]                 Test ping your Render backend
`);
}

switch (command) {
  case 'list':
  case 'ls':
    listMonitors(args[0]);
    break;
  case 'add':
  case 'create':
    addMonitor(args[0], args[1], args[2]);
    break;
  case 'delete':
  case 'rm':
    deleteMonitor(args[0]);
    break;
  case 'ping':
  case 'test':
    testPing(args[0]);
    break;
  default:
    showHelp();
}
