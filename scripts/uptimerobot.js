#!/usr/bin/env node

/**
 * UptimeRobot CLI Controller & Backend Keepalive Helper
 * Manage UptimeRobot monitors directly from your terminal.
 */

const UPTIMEROBOT_API = 'https://api.uptimerobot.com/v2';

const [,, command, ...args] = process.argv;

async function listMonitors(apiKey) {
  if (!apiKey) {
    console.error('Usage: uptimerobot list <API_KEY>');
    process.exit(1);
  }
  console.log('Fetching monitors from UptimeRobot...');
  try {
    const res = await fetch(`${UPTIMEROBOT_API}/getMonitors`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ api_key: apiKey, format: 'json' })
    });
    const data = await res.json();
    if (data.stat !== 'ok') {
      console.error('Error from UptimeRobot:', data.error);
      return;
    }
    console.log(`\nFound ${data.monitors.length} monitor(s):`);
    console.log('------------------------------------------------------------');
    data.monitors.forEach(m => {
      const statusMap = { 0: 'Paused', 1: 'Not checked yet', 2: 'UP', 8: 'Seems down', 9: 'DOWN' };
      console.log(`• ID: ${m.id} | Name: "${m.friendly_name}"`);
      console.log(`  URL: ${m.url}`);
      console.log(`  Status: ${statusMap[m.status] || m.status} | Interval: ${m.interval / 60} minutes`);
      console.log('------------------------------------------------------------');
    });
  } catch (err) {
    console.error('Request failed:', err.message);
  }
}

async function addMonitor(apiKey, friendlyName, url, intervalMinutes = 30) {
  if (!apiKey || !friendlyName || !url) {
    console.error('Usage: uptimerobot add <API_KEY> <FriendlyName> <URL> [intervalMinutes=30]');
    console.error('Example: uptimerobot add u12345-abcdef "Random Backend" "https://random-api.onrender.com/health" 30');
    process.exit(1);
  }
  const intervalSeconds = Math.max(300, parseInt(intervalMinutes, 10) * 60);
  console.log(`Creating monitor "${friendlyName}" for ${url} (interval: ${intervalSeconds / 60} mins)...`);

  try {
    const res = await fetch(`${UPTIMEROBOT_API}/newMonitor`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        api_key: apiKey,
        format: 'json',
        type: '1', // HTTP(s)
        friendly_name: friendlyName,
        url: url,
        interval: intervalSeconds.toString()
      })
    });
    const data = await res.json();
    if (data.stat !== 'ok') {
      console.error('Failed to create monitor:', data.error);
      return;
    }
    console.log(`Monitor created successfully! Monitor ID: ${data.monitor.id}`);
  } catch (err) {
    console.error('Request failed:', err.message);
  }
}

async function deleteMonitor(apiKey, monitorId) {
  if (!apiKey || !monitorId) {
    console.error('Usage: uptimerobot delete <API_KEY> <MonitorID>');
    process.exit(1);
  }
  console.log(`Deleting monitor ID ${monitorId}...`);
  try {
    const res = await fetch(`${UPTIMEROBOT_API}/deleteMonitor`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ api_key: apiKey, format: 'json', id: monitorId })
    });
    const data = await res.json();
    if (data.stat !== 'ok') {
      console.error('Failed to delete monitor:', data.error);
      return;
    }
    console.log('Monitor deleted successfully.');
  } catch (err) {
    console.error('Request failed:', err.message);
  }
}

async function testPing(targetUrl) {
  const url = targetUrl || 'http://localhost:3000/health';
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
UptimeRobot & Keepalive CLI Controller
======================================
Usage:
  uptimerobot list <API_KEY>                       List all existing monitors
  uptimerobot add <API_KEY> <Name> <URL> [mins=30] Create a new HTTP monitor
  uptimerobot delete <API_KEY> <MonitorID>         Delete a monitor
  uptimerobot ping [URL]                           Test ping a URL
`);
}

switch (command) {
  case 'list':
    listMonitors(args[0]);
    break;
  case 'add':
    addMonitor(args[0], args[1], args[2], args[3] || 30);
    break;
  case 'delete':
    deleteMonitor(args[0], args[1]);
    break;
  case 'ping':
  case 'test':
    testPing(args[0]);
    break;
  default:
    showHelp();
}
