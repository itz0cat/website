# Random Backend 🎲

A lightweight, modular Node.js/Express backend designed to host miscellaneous microservices, background pingers, keepalive tasks, and utilities.

## Included Modules

### 1. FastClient Heartbeat & Pinger (`src/modules/fastclient.js`)
- Emulates the FastClient client telemetry heartbeat.
- Automatically sends periodic `POST https://api.fastclient.net/api/fastclient/ping` with `{"username": "Itz0Cat__"}` every 2 minutes.
- Ensures FastClient's global user manifest (`https://files.fastclient.net/fastclient/active-users.txt`) recognizes `"Itz0Cat__"` as an active FastClient player with in-game badge, Tab list icon, and custom cape support.

### 2. Keepalive Monitoring & CLI Controller
- Built-in terminal CLI: `uptimerobot`
  - `uptimerobot list <API_KEY>`: List all active monitors.
  - `uptimerobot add <API_KEY> <Name> <URL> [interval=30]`: Add a 30-minute HTTP ping monitor directly from terminal.
  - `uptimerobot ping <URL>`: Direct CLI ping.
- Cloud Keepalive: `.github/workflows/keepalive.yml` runs a 30-minute cron ping on GitHub Actions cloud to keep Render free-tier instances awake 24/7.

## Endpoints

- `GET /` - Service directory and active microservice stats.
- `GET /health` - Health check (uptime, memory, status).
- `GET /api/fastclient` - FastClient pinger telemetry, stats, and last response.
- `POST /api/fastclient/ping` - Trigger an immediate manual ping (can accept optional `{ "username": "..." }`).
- `POST /api/fastclient/toggle` - Enable or disable background pinging.
- `GET /api/fastclient/check?username=Itz0Cat__` - Check if the username is present in FastClient's public `active-users.txt`.
