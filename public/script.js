// ==========================================================
// itz0cat Client-Side Router & Applications
// Powered by Navigo (HTML5 History API)
// ==========================================================

let currentUser = null;
let router = null;
let terminalExecuted = false;

// 1. Initialize Navigo Router
function initRouter() {
  router = new Navigo('/', { hash: false });

  router
    .on('/', () => switchView('home', 'itz0cat — Systems & Minecraft Mod Engineer'))
    .on('/projects', () => switchView('projects', 'Projects — itz0cat'))
    .on('/about', () => switchView('about', 'Architecture & Stack — itz0cat'))
    .on('/community', () => switchView('community', 'Community & Discord — itz0cat'))
    .on('/tools', () => {
      switchView('tools', 'Minecraft Utilities & Tools — itz0cat');
      handleToolsAccess();
    })
    .notFound(() => switchView('404', '404 Not Found — itz0cat'));

  router.resolve();

  // Intercept internal relative navigation links
  document.addEventListener('click', (e) => {
    const link = e.target.closest('a');
    if (!link) return;

    const href = link.getAttribute('href');
    if (!href) return;

    // Check if this is an internal SPA route
    if (
      href.startsWith('/') &&
      !href.startsWith('/api') &&
      !href.startsWith('/assets') &&
      !href.startsWith('/health') &&
      !href.startsWith('/vendor') &&
      !link.getAttribute('target')
    ) {
      e.preventDefault();
      router.navigate(href);
    }
  });
}

// 2. View Switching Handler
function switchView(viewId, title) {
  if (title) document.title = title;

  document.querySelectorAll('.page-view').forEach((el) => {
    el.classList.remove('active-view');
  });

  const targetView = document.getElementById(`view-${viewId}`) || document.getElementById('view-404');
  if (targetView) {
    targetView.classList.add('active-view');
  }

  // Update navbar link active states
  document.querySelectorAll('.nav-links .nav-item').forEach((item) => {
    if (item.getAttribute('data-page') === viewId) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });

  // Close mobile drawer if open
  const navLinks = document.getElementById('nav-links');
  const navToggle = document.getElementById('nav-toggle');
  if (navLinks && navLinks.classList.contains('open')) {
    navLinks.classList.remove('open');
    if (navToggle) navToggle.setAttribute('aria-expanded', 'false');
  }

  window.scrollTo(0, 0);

  if (viewId === 'home' && !terminalExecuted) {
    runTerminal();
  }
}

// 3. Tools Access & Permission Gating
function handleToolsAccess() {
  const loggedOutView = document.getElementById('tools-logged-out-view');
  const authView = document.getElementById('tools-authenticated-view');
  const tabBtnAdmin = document.getElementById('tab-btn-admin');

  if (!currentUser || !currentUser.loggedIn) {
    if (loggedOutView) loggedOutView.style.display = 'block';
    if (authView) authView.style.display = 'none';
  } else {
    if (loggedOutView) loggedOutView.style.display = 'none';
    if (authView) authView.style.display = 'block';

    if (currentUser.isAdmin) {
      if (tabBtnAdmin) tabBtnAdmin.style.display = 'inline-flex';
      loadAdminTelemetry();
    } else {
      if (tabBtnAdmin) tabBtnAdmin.style.display = 'none';
    }
  }
}

// 4. Discord Authentication Check
async function checkAuth() {
  try {
    const res = await fetch('/api/auth/me');
    const data = await res.json();
    currentUser = data;

    const loginBtn = document.getElementById('login-btn');
    const userPill = document.getElementById('user-pill');
    const userAvatar = document.getElementById('user-avatar');
    const userTag = document.getElementById('user-tag');
    const userRole = document.getElementById('user-role-badge');
    const navDevBadge = document.getElementById('nav-dev-badge');

    // Community view elements
    const commLoggedOut = document.getElementById('community-user-logged-out');
    const commLoggedIn = document.getElementById('community-user-logged-in');
    const commAvatar = document.getElementById('community-avatar');
    const commUsername = document.getElementById('community-username');

    if (data.loggedIn && data.user) {
      if (loginBtn) loginBtn.style.display = 'none';
      if (userPill) {
        userPill.style.display = 'flex';
        if (userAvatar) userAvatar.src = data.user.avatarUrl;
        if (userTag) userTag.textContent = `@${data.user.username}`;
        if (userRole) {
          if (data.isAdmin) {
            userRole.textContent = 'OWNER';
            userRole.className = 'user-role-tag role-owner';
          } else {
            userRole.textContent = 'MEMBER';
            userRole.className = 'user-role-tag';
          }
        }
      }

      if (navDevBadge) {
        navDevBadge.textContent = data.isAdmin ? '⚡' : '🛠️';
      }

      if (commLoggedOut) commLoggedOut.style.display = 'none';
      if (commLoggedIn) {
        commLoggedIn.style.display = 'block';
        if (commAvatar) commAvatar.src = data.user.avatarUrl;
        if (commUsername) commUsername.textContent = `${data.user.global_name || data.user.username} (@${data.user.username})`;
      }
    } else {
      if (loginBtn) loginBtn.style.display = 'inline-flex';
      if (userPill) userPill.style.display = 'none';
      if (navDevBadge) navDevBadge.textContent = '🛠️';

      if (commLoggedOut) commLoggedOut.style.display = 'block';
      if (commLoggedIn) commLoggedIn.style.display = 'none';
    }

    if (window.location.pathname === '/tools') {
      handleToolsAccess();
    }
  } catch (err) {
    console.error('Auth verification failed:', err);
  }
}

// 5. Tools Suite Tab Switching
function initToolTabs() {
  document.querySelectorAll('.tools-nav-tabs .tool-tab').forEach((tabBtn) => {
    tabBtn.addEventListener('click', () => {
      const targetId = tabBtn.getAttribute('data-tab');
      document.querySelectorAll('.tools-nav-tabs .tool-tab').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tool-tab-panel').forEach(p => {
        p.classList.remove('active-panel');
        p.style.display = 'none';
      });

      tabBtn.classList.add('active');
      const targetPanel = document.getElementById(targetId);
      if (targetPanel) {
        targetPanel.classList.add('active-panel');
        targetPanel.style.display = 'block';
      }

      if (afkBotPollTimer) {
        clearInterval(afkBotPollTimer);
        afkBotPollTimer = null;
      }

      if (targetId === 'tab-afkbot') {
        loadAfkBotTelemetry();
        afkBotPollTimer = setInterval(loadAfkBotTelemetry, 4000);
      } else if (targetId === 'tab-admin' && currentUser?.isAdmin) {
        loadAdminTelemetry();
      }
    });
  });
}

// 6. Player Profile & Skin Inspector
function initPlayerInspector() {
  const form = document.getElementById('player-inspector-form');
  const input = document.getElementById('inspector-player-input');
  const btn = document.getElementById('inspector-player-btn');
  const result = document.getElementById('inspector-player-result');
  const statusEl = document.getElementById('insp-player-status');

  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const query = (input.value || '').trim();
    if (!query) return;

    btn.disabled = true;
    btn.textContent = 'Querying...';
    statusEl.textContent = 'Querying Mojang and Skin CDN...';

    try {
      const res = await fetch(`/api/tools/player/${encodeURIComponent(query)}`);
      const data = await res.json();

      if (!res.ok || data.error) {
        statusEl.textContent = `Error: ${data.error || 'Failed to inspect player'}`;
        return;
      }

      document.getElementById('insp-name').textContent = data.username;
      const pill = document.getElementById('insp-type-pill');
      if (data.type === 'mojang_verified') {
        pill.className = 'status-pill active';
        pill.textContent = '● MOJANG VERIFIED';
      } else {
        pill.className = 'status-pill inactive';
        pill.textContent = '○ OFFLINE / CUSTOM';
      }

      document.getElementById('insp-uuid-dashed').textContent = data.uuidDashed;
      document.getElementById('insp-uuid-trimmed').textContent = data.uuidTrimmed;
      document.getElementById('insp-body-img').src = data.body3dUrl;
      document.getElementById('insp-download-skin').href = data.skinTextureUrl;

      result.style.display = 'block';
      statusEl.textContent = `✓ Successfully resolved ${data.username}.`;
    } catch (err) {
      statusEl.textContent = `Inspection error: ${err.message}`;
    } finally {
      btn.disabled = false;
      btn.textContent = 'Inspect Player';
    }
  });
}

// 7. Minecraft Server Status Checker
function initServerChecker() {
  const form = document.getElementById('server-checker-form');
  const input = document.getElementById('checker-server-input');
  const btn = document.getElementById('checker-server-btn');
  const result = document.getElementById('checker-server-result');
  const statusEl = document.getElementById('checker-server-status');

  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const address = (input.value || '').trim();
    if (!address) return;

    btn.disabled = true;
    btn.textContent = 'Pinging...';
    statusEl.textContent = `Querying server ${address}...`;

    try {
      const res = await fetch(`/api/tools/server/${encodeURIComponent(address)}`);
      const data = await res.json();

      if (!res.ok || data.error) {
        statusEl.textContent = `Error: ${data.error || 'Failed to ping server'}`;
        return;
      }

      document.getElementById('srv-host').textContent = data.host;
      const pill = document.getElementById('srv-status-pill');
      pill.className = data.online ? 'status-pill active' : 'status-pill inactive';
      pill.textContent = data.online ? '● ONLINE' : '○ OFFLINE';

      document.getElementById('srv-version').textContent = data.version;
      document.getElementById('srv-players').textContent = `${data.players.online.toLocaleString()} / ${data.players.max.toLocaleString()}`;
      document.getElementById('srv-ip').textContent = `${data.ip || data.host}:${data.port}`;

      const iconImg = document.getElementById('srv-icon');
      if (data.icon) {
        iconImg.src = data.icon;
        iconImg.style.display = 'block';
      } else {
        iconImg.style.display = 'none';
      }

      const motdBox = document.getElementById('srv-motd-html');
      if (data.motd?.html) {
        motdBox.innerHTML = data.motd.html;
      } else {
        motdBox.textContent = data.motd?.clean || 'A Minecraft Server';
      }

      result.style.display = 'block';
      statusEl.textContent = `✓ Received ping response from ${data.host}.`;
    } catch (err) {
      statusEl.textContent = `Ping failed: ${err.message}`;
    } finally {
      btn.disabled = false;
      btn.textContent = 'Ping Server';
    }
  });
}

// 8. Minecraft Color & MOTD Formatter
function initColorFormatter() {
  const textarea = document.getElementById('color-input-text');
  const preview = document.getElementById('color-preview-output');
  const toast = document.getElementById('copy-toast');
  if (!textarea || !preview) return;

  const updatePreview = async () => {
    const text = textarea.value;
    try {
      const res = await fetch('/api/tools/format', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });
      if (res.ok) {
        const data = await res.json();
        preview.innerHTML = data.html;
        textarea.dataset.clean = data.clean;
        textarea.dataset.section = data.section;
        textarea.dataset.ampersand = data.ampersand;
        textarea.dataset.json = data.json;
      }
    } catch {
      preview.textContent = text;
    }
  };

  textarea.addEventListener('input', updatePreview);
  updatePreview();

  // Palette swatch clicks
  document.querySelectorAll('.palette-swatch').forEach((swatch) => {
    swatch.addEventListener('click', () => {
      const code = swatch.getAttribute('data-code');
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const current = textarea.value;
      textarea.value = current.substring(0, start) + code + current.substring(end);
      textarea.focus();
      textarea.selectionStart = textarea.selectionEnd = start + code.length;
      updatePreview();
    });
  });

  // Copy buttons
  const flashToast = (msg) => {
    if (!toast) return;
    toast.textContent = msg;
    setTimeout(() => { toast.textContent = ''; }, 2500);
  };

  const copySection = document.getElementById('copy-section-btn');
  if (copySection) {
    copySection.addEventListener('click', () => {
      const val = textarea.dataset.section || textarea.value.replace(/&/g, '§');
      navigator.clipboard.writeText(val);
      flashToast('✓ Copied § format!');
    });
  }

  const copyAmp = document.getElementById('copy-ampersand-btn');
  if (copyAmp) {
    copyAmp.addEventListener('click', () => {
      const val = textarea.dataset.ampersand || textarea.value;
      navigator.clipboard.writeText(val);
      flashToast('✓ Copied & codes!');
    });
  }

  const copyJson = document.getElementById('copy-json-btn');
  if (copyJson) {
    copyJson.addEventListener('click', () => {
      const val = textarea.dataset.json || JSON.stringify({ text: textarea.value }, null, 2);
      navigator.clipboard.writeText(val);
      flashToast('✓ Copied Chat JSON!');
    });
  }
}

// 9. UUID Converter & Offline Generator
function initUuidTool() {
  const form = document.getElementById('uuid-tool-form');
  const input = document.getElementById('uuid-tool-input');
  const result = document.getElementById('uuid-tool-result');
  const dashedEl = document.getElementById('res-uuid-dashed');
  const trimmedEl = document.getElementById('res-uuid-trimmed');
  const noteRow = document.getElementById('uuid-note-row');
  const noteEl = document.getElementById('res-uuid-note');

  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const query = (input.value || '').trim();
    if (!query) return;

    try {
      const res = await fetch(`/api/tools/uuid/${encodeURIComponent(query)}`);
      const data = await res.json();

      if (data.valid) {
        dashedEl.textContent = data.dashed;
        trimmedEl.textContent = data.trimmed;
        noteRow.style.display = 'none';
      } else if (data.offlineComputed) {
        dashedEl.textContent = data.offlineComputed.dashed;
        trimmedEl.textContent = data.offlineComputed.trimmed;
        noteRow.style.display = 'flex';
        noteEl.textContent = `Offline UUID for "${data.offlineComputed.username}" (RFC 4122 v3 MD5)`;
      }

      result.style.display = 'block';
    } catch (err) {
      alert('UUID conversion error: ' + err.message);
    }
  });
}

// 10. FastClient Player Lookup (Owner @itz0cat Only)
const lookupForm = document.getElementById('lookup-form');
const lookupInput = document.getElementById('lookup-username');
const lookupBtn = document.getElementById('lookup-btn');
const lookupResult = document.getElementById('lookup-result');
const noticeEl = document.getElementById('lookup-notice');

const resAvatar = document.getElementById('res-avatar');
const resName = document.getElementById('res-name');
const resPill = document.getElementById('res-status-pill');
const resUuid = document.getElementById('res-uuid');
const resRank = document.getElementById('res-rank');
const resCapeImg = document.getElementById('res-cape-img');
const resCapeStatus = document.getElementById('res-cape-status');
const resSkinImg = document.getElementById('res-skin-img');
const resSkinStatus = document.getElementById('res-skin-status');
const resTabStatus = document.getElementById('res-tab-status');
const resBadgeStatus = document.getElementById('res-badge-status');

async function doLookup(username) {
  const user = (username || '').trim();
  if (!user) return;

  if (!currentUser || !currentUser.isAdmin) {
    if (noticeEl) noticeEl.textContent = 'Error: Developer authentication required (@itz0cat only).';
    return;
  }

  if (lookupBtn) {
    lookupBtn.disabled = true;
    lookupBtn.textContent = 'Querying...';
  }
  if (noticeEl) noticeEl.textContent = 'Querying FastClient CDN and active manifest...';

  try {
    const res = await fetch(`/api/fastclient/lookup/${encodeURIComponent(user)}`);
    const data = await res.json();

    if (data.error) {
      if (noticeEl) noticeEl.textContent = `Error: ${data.error}`;
      return;
    }

    if (resName) resName.textContent = data.username;
    if (resAvatar) resAvatar.src = data.avatarUrl;

    if (data.active) {
      if (resPill) {
        resPill.className = 'status-pill active';
        resPill.innerHTML = '● ACTIVE FASTCLIENT USER';
      }
      if (resRank) resRank.textContent = `Manifest Rank #${data.rank.toLocaleString()} of ${data.totalUsers.toLocaleString()} active players`;
      if (resTabStatus) {
        resTabStatus.textContent = 'ACTIVE';
        resTabStatus.className = 'cosmetic-status found';
      }
      if (resBadgeStatus) {
        resBadgeStatus.textContent = 'ACTIVE';
        resBadgeStatus.className = 'cosmetic-status found';
      }
    } else {
      if (resPill) {
        resPill.className = 'status-pill inactive';
        resPill.innerHTML = '○ INACTIVE / UNREGISTERED';
      }
      if (resRank) resRank.textContent = `Not currently indexed in FastClient\'s ${data.totalUsers.toLocaleString()} active players`;
      if (resTabStatus) {
        resTabStatus.textContent = 'INACTIVE';
        resTabStatus.className = 'cosmetic-status none';
      }
      if (resBadgeStatus) {
        resBadgeStatus.textContent = 'INACTIVE';
        resBadgeStatus.className = 'cosmetic-status none';
      }
    }

    if (resUuid) {
      if (data.mojang && data.mojang.verified) {
        resUuid.textContent = `UUID: ${data.mojang.id} (Mojang Verified)`;
      } else {
        resUuid.textContent = 'UUID: Offline / Cracked Account';
      }
    }

    // Cape
    if (resCapeImg && resCapeStatus) {
      if (data.cosmetics.cape.exists) {
        resCapeImg.src = data.cosmetics.cape.url;
        resCapeImg.style.display = 'block';
        resCapeStatus.textContent = `FOUND (${data.cosmetics.cape.size || '?'}B)`;
        resCapeStatus.className = 'cosmetic-status found';
      } else {
        resCapeImg.style.display = 'none';
        resCapeStatus.textContent = 'None';
        resCapeStatus.className = 'cosmetic-status none';
      }
    }

    // Skin
    if (resSkinImg && resSkinStatus) {
      if (data.cosmetics.skin.exists) {
        resSkinImg.src = data.cosmetics.skin.url;
        resSkinImg.style.display = 'block';
        resSkinStatus.textContent = `FOUND (${data.cosmetics.skin.size || '?'}B)`;
        resSkinStatus.className = 'cosmetic-status found';
      } else {
        resSkinImg.style.display = 'none';
        resSkinStatus.textContent = 'None';
        resSkinStatus.className = 'cosmetic-status none';
      }
    }

    if (lookupResult) lookupResult.classList.add('visible');
    if (noticeEl) {
      noticeEl.textContent = data.active 
        ? `✓ Verified active FastClient player.` 
        : `Player is not currently registered in active manifest.`;
    }
  } catch (err) {
    if (noticeEl) noticeEl.textContent = `Lookup error: ${err.message}`;
  } finally {
    if (lookupBtn) {
      lookupBtn.disabled = false;
      lookupBtn.textContent = 'Lookup';
    }
  }
}

if (lookupForm) {
  lookupForm.addEventListener('submit', (e) => {
    e.preventDefault();
    if (lookupInput) doLookup(lookupInput.value);
  });
}

// 11. Admin Telemetry & Cloud Pinger Controls (Owner Only)
const adminTargetUser = document.getElementById('admin-target-user');
const adminIntervalSelect = document.getElementById('admin-interval-select');
const adminSaveCfgBtn = document.getElementById('admin-save-cfg-btn');
const adminTogglePingerBtn = document.getElementById('admin-toggle-pinger-btn');
const adminForcePingBtn = document.getElementById('admin-force-ping-btn');
const adminFeedback = document.getElementById('admin-pinger-feedback');

const metricUptime = document.getElementById('metric-uptime');
const metricRss = document.getElementById('metric-rss');
const metricHeap = document.getElementById('metric-heap');
const metricSuccessPings = document.getElementById('metric-success-pings');
const metricFailPings = document.getElementById('metric-fail-pings');
const metricLastStatus = document.getElementById('metric-last-status');

async function loadAdminTelemetry() {
  try {
    const res = await fetch('/api/admin/status');
    if (!res.ok) return;
    const data = await res.json();

    if (adminTargetUser) adminTargetUser.value = data.fastclient.targetUsername;
    if (adminIntervalSelect) adminIntervalSelect.value = String(data.fastclient.intervalSeconds);
    if (adminTogglePingerBtn) {
      adminTogglePingerBtn.textContent = data.fastclient.active ? 'Pause Pinger' : 'Resume Pinger';
    }

    if (metricUptime) {
      const upSec = data.system.uptimeSeconds;
      metricUptime.textContent = `${Math.floor(upSec / 3600)}h ${Math.floor((upSec % 3600) / 60)}m ${upSec % 60}s`;
    }
    if (metricRss) metricRss.textContent = `${data.system.memory.rssMb} MB`;
    if (metricHeap) metricHeap.textContent = `${data.system.memory.heapUsedMb} MB`;
    if (metricSuccessPings) metricSuccessPings.textContent = data.fastclient.stats.successPings;
    if (metricFailPings) metricFailPings.textContent = data.fastclient.stats.failedPings;
    if (metricLastStatus) {
      metricLastStatus.textContent = data.fastclient.stats.lastStatusCode 
        ? `HTTP ${data.fastclient.stats.lastStatusCode}`
        : 'Pending';
    }

    // 24/7 Proxy Pinger Telemetry
    if (data.proxyPinger) {
      const p = data.proxyPinger;
      const elReady = document.getElementById('proxy-metric-ready');
      const elTotal = document.getElementById('proxy-metric-total');
      const elCd = document.getElementById('proxy-metric-cooldown');
      const elSuccess = document.getElementById('proxy-metric-success');
      const el429 = document.getElementById('proxy-metric-429');
      const elIp = document.getElementById('proxy-metric-ip');
      const elStatus = document.getElementById('proxy-status-msg');
      const elBadge = document.getElementById('proxy-badge-status');
      const btnToggle = document.getElementById('btn-toggle-proxy-pinger');

      if (elReady) elReady.textContent = `${p.pool?.ready || 0} ready`;
      if (elTotal) elTotal.textContent = `${p.pool?.total || 0} total`;
      if (elCd) elCd.textContent = `${p.pool?.inCooldown || 0} in cooldown`;
      if (elSuccess) elSuccess.textContent = p.stats?.successfulRequests || 0;
      if (el429) el429.textContent = p.stats?.rateLimitedRequests || 0;
      if (elIp) elIp.textContent = p.stats?.lastProxyMasked || 'NONE';
      if (elStatus) elStatus.textContent = p.stats?.statusMessage || 'Standby';
      if (elBadge) {
        elBadge.textContent = p.running ? 'RUNNING' : 'PAUSED';
        elBadge.className = p.running ? 'tool-badge' : 'tool-badge bg-red';
      }
      if (btnToggle) {
        btnToggle.textContent = p.running ? 'Pause Proxy Pinger' : 'Resume Proxy Pinger';
      }
    }

    if (data.afkBot) {
      loadAfkBotTelemetry();
    }
  } catch (err) {
    console.error('Admin telemetry fetch error:', err);
  }
}

// 24/7 Proxy Pinger Button Handlers
const btnToggleProxy = document.getElementById('btn-toggle-proxy-pinger');
const btnScrapeProxy = document.getElementById('btn-scrape-proxies');
const proxyFeedback = document.getElementById('proxy-pinger-feedback');

if (btnToggleProxy) {
  btnToggleProxy.addEventListener('click', async () => {
    if (proxyFeedback) proxyFeedback.textContent = 'Updating proxy pinger state...';
    try {
      const res = await fetch('/api/admin/proxy-pinger/toggle', { method: 'POST' });
      const json = await res.json();
      if (proxyFeedback) proxyFeedback.textContent = json.message || 'Updated';
      loadAdminTelemetry();
    } catch (e) {
      if (proxyFeedback) proxyFeedback.textContent = `Error: ${e.message}`;
    }
  });
}

if (btnScrapeProxy) {
  btnScrapeProxy.addEventListener('click', async () => {
    if (proxyFeedback) proxyFeedback.textContent = 'Batch harvest started in background...';
    try {
      const res = await fetch('/api/admin/proxy-pinger/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batchSize: 250 })
      });
      const json = await res.json();
      if (proxyFeedback) proxyFeedback.textContent = json.message || 'Scraping started.';
      loadAdminTelemetry();
    } catch (e) {
      if (proxyFeedback) proxyFeedback.textContent = `Error: ${e.message}`;
    }
  });
}

if (adminSaveCfgBtn) {
  adminSaveCfgBtn.addEventListener('click', async () => {
    const username = adminTargetUser.value.trim();
    const intervalSeconds = parseInt(adminIntervalSelect.value, 10);
    if (adminFeedback) adminFeedback.textContent = 'Saving configuration...';

    try {
      const res = await fetch('/api/admin/fastclient/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, intervalSeconds })
      });
      const json = await res.json();
      if (adminFeedback) adminFeedback.textContent = json.message || 'Config saved.';
      loadAdminTelemetry();
    } catch (err) {
      if (adminFeedback) adminFeedback.textContent = `Save failed: ${err.message}`;
    }
  });
}

if (adminTogglePingerBtn) {
  adminTogglePingerBtn.addEventListener('click', async () => {
    if (adminFeedback) adminFeedback.textContent = 'Updating pinger state...';
    try {
      const res = await fetch('/api/admin/fastclient/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const json = await res.json();
      if (adminFeedback) adminFeedback.textContent = json.message || 'Updated.';
      loadAdminTelemetry();
    } catch (err) {
      if (adminFeedback) adminFeedback.textContent = `Toggle error: ${err.message}`;
    }
  });
}

if (adminForcePingBtn) {
  adminForcePingBtn.addEventListener('click', async () => {
    if (adminFeedback) adminFeedback.textContent = 'Dispatching force ping to FastClient...';
    try {
      const res = await fetch('/api/admin/fastclient/ping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: adminTargetUser.value.trim() })
      });
      const json = await res.json();
      if (adminFeedback) {
        adminFeedback.textContent = `✓ Force ping dispatched (HTTP ${json.result?.status || 200})`;
      }
      loadAdminTelemetry();
    } catch (err) {
      if (adminFeedback) adminFeedback.textContent = `Force ping failed: ${err.message}`;
    }
  });
}


// 12. Logout Handler
const logoutBtn = document.getElementById('logout-btn');
if (logoutBtn) {
  logoutBtn.addEventListener('click', async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.reload();
  });
}

// 13. Mobile Navigation Toggle
const navToggle = document.getElementById('nav-toggle');
const navLinks = document.getElementById('nav-links');

if (navToggle && navLinks) {
  navToggle.addEventListener('click', () => {
    const isOpen = navLinks.classList.toggle('open');
    navToggle.setAttribute('aria-expanded', String(isOpen));
  });
}

// 14. Hero Terminal Pipeline Animation
const terminalBody = document.getElementById('terminal-body');
const terminalScript = [
  { type: 'prompt', text: '$ ./gradlew build --no-daemon' },
  { type: 'out', text: '> Task :compileJava [Java 21 Intermediary]' },
  { type: 'out', text: '> Task :remapJar [Fabric 1.21.11]' },
  { type: 'success', text: 'BUILD SUCCESSFUL (1m 14s)' },
  { type: 'prompt', text: '$ npm start' },
  { type: 'out', text: '[itz0cat] Backend online at https://itz0cat.onrender.com' },
  { type: 'out', text: '[FastClient] Registered user "Itz0Cat__"' },
  { type: 'success', text: 'UptimeRobot: 5m Keepalive [UP 200 OK] ✓' }
];

async function typeText(el, text, speed) {
  for (let i = 0; i <= text.length; i++) {
    el.textContent = text.slice(0, i);
    await new Promise((r) => setTimeout(r, speed));
  }
}

async function runTerminal() {
  if (!terminalBody || terminalExecuted) return;
  terminalExecuted = true;
  terminalBody.innerHTML = '';

  for (const line of terminalScript) {
    const span = document.createElement('span');
    span.className = line.type;
    terminalBody.appendChild(span);
    await typeText(span, line.text, line.type === 'prompt' ? 20 : 10);
    terminalBody.appendChild(document.createTextNode('\n'));
    await new Promise((r) => setTimeout(r, line.type === 'prompt' ? 120 : 70));
  }

  const cursor = document.createElement('span');
  cursor.className = 'cursor';
  terminalBody.appendChild(cursor);
}

// 15. 24/7 Minecraft AFK Bot Telemetry & Controls
let afkBotPollTimer = null;

async function loadAfkBotTelemetry() {
  try {
    const res = await fetch('/api/tools/afkbot');
    if (!res.ok) return;
    const json = await res.json();
    const data = json.telemetry || json;

    const elBadge = document.getElementById('afkbot-badge-status');
    const elStatus = document.getElementById('afkbot-val-status');
    const elServer = document.getElementById('afkbot-val-server');
    const elUser = document.getElementById('afkbot-val-username');
    const elVer = document.getElementById('afkbot-val-version');
    const elPos = document.getElementById('afkbot-val-pos');
    const elUptime = document.getElementById('afkbot-val-uptime');
    const elHp = document.getElementById('afkbot-val-hp');
    const elPulses = document.getElementById('afkbot-val-pulses');
    const elRecon = document.getElementById('afkbot-val-reconnects');
    const elLogs = document.getElementById('afkbot-log-console');
    const adminControls = document.getElementById('afkbot-admin-controls');
    const btnToggle = document.getElementById('afkbot-btn-toggle');

    if (currentUser?.isAdmin && adminControls) {
      adminControls.style.display = 'block';
    }

    if (elBadge) {
      const isOnline = data.status === 'online';
      elBadge.textContent = (data.status || 'OFFLINE').toUpperCase();
      elBadge.className = isOnline ? 'tool-badge' : (data.status === 'connecting' ? 'tool-badge' : 'tool-badge bg-red');
    }
    if (elStatus) {
      elStatus.textContent = data.status ? (data.status.charAt(0).toUpperCase() + data.status.slice(1)) : 'Offline';
    }
    if (elServer) elServer.textContent = `${data.host || 'lab.mcsh.io'}:${data.port || 25565}`;
    if (elUser) elUser.textContent = data.username || 'Itz0Cat_AFK';
    if (elVer) elVer.textContent = data.version || '1.21.11';
    if (elPos) {
      elPos.textContent = data.spawnPosition ? `(${data.spawnPosition.x}, ${data.spawnPosition.y}, ${data.spawnPosition.z})` : 'Awaiting spawn';
    }
    if (elUptime) {
      const up = data.uptimeSeconds || 0;
      elUptime.textContent = `${Math.floor(up / 3600)}h ${Math.floor((up % 3600) / 60)}m ${up % 60}s`;
    }
    if (elHp) elHp.textContent = `${data.health ?? 20} / ${data.food ?? 20}`;
    if (elPulses) elPulses.textContent = data.stats?.antiAfkPulses || 0;
    if (elRecon) elRecon.textContent = `${data.stats?.reconnects || 0} / ${data.stats?.kicks || 0}`;

    if (btnToggle) {
      btnToggle.textContent = data.running ? 'Pause Bot' : 'Resume Bot';
    }

    if (elLogs && Array.isArray(data.logs) && data.logs.length > 0) {
      elLogs.innerHTML = '';
      data.logs.forEach((line) => {
        const lineEl = document.createElement('div');
        lineEl.style.padding = '2px 0';
        lineEl.textContent = line;
        elLogs.appendChild(lineEl);
      });
      elLogs.scrollTop = elLogs.scrollHeight;
    }
  } catch (err) {
    console.error('AFK Bot telemetry error:', err);
  }
}

function initAfkBotTool() {
  const btnToggle = document.getElementById('afkbot-btn-toggle');
  const btnReconnect = document.getElementById('afkbot-btn-reconnect');
  const chatForm = document.getElementById('afkbot-chat-form');
  const chatInput = document.getElementById('afkbot-chat-input');
  const feedback = document.getElementById('afkbot-feedback');

  if (btnToggle) {
    btnToggle.addEventListener('click', async () => {
      if (feedback) feedback.textContent = 'Updating bot state...';
      try {
        const res = await fetch('/api/admin/afkbot/toggle', { method: 'POST' });
        const json = await res.json();
        if (feedback) feedback.textContent = json.message || 'Updated';
        loadAfkBotTelemetry();
      } catch (e) {
        if (feedback) feedback.textContent = `Error: ${e.message}`;
      }
    });
  }

  if (btnReconnect) {
    btnReconnect.addEventListener('click', async () => {
      if (feedback) feedback.textContent = 'Reconnecting...';
      try {
        const res = await fetch('/api/admin/afkbot/reconnect', { method: 'POST' });
        const json = await res.json();
        if (feedback) feedback.textContent = json.message || 'Reconnecting...';
        loadAfkBotTelemetry();
      } catch (e) {
        if (feedback) feedback.textContent = `Error: ${e.message}`;
      }
    });
  }

  const btnAuth = document.getElementById('afkbot-btn-auth');
  if (btnAuth) {
    btnAuth.addEventListener('click', async () => {
      if (feedback) feedback.textContent = 'Dispatching auth commands...';
      try {
        const res = await fetch('/api/admin/afkbot/auth', { method: 'POST' });
        const json = await res.json();
        if (feedback) feedback.textContent = json.message || 'Auth dispatched';
        loadAfkBotTelemetry();
      } catch (e) {
        if (feedback) feedback.textContent = `Error: ${e.message}`;
      }
    });
  }

  if (chatForm && chatInput) {
    chatForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const msg = chatInput.value.trim();
      if (!msg) return;
      if (feedback) feedback.textContent = 'Sending message...';
      try {
        const res = await fetch('/api/admin/afkbot/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: msg })
        });
        const json = await res.json();
        if (feedback) feedback.textContent = json.message || (json.success ? 'Message sent!' : 'Failed');
        chatInput.value = '';
        loadAfkBotTelemetry();
      } catch (err) {
        if (feedback) feedback.textContent = `Error: ${err.message}`;
      }
    });
  }
}

// 16. Bootstrap Application on DOM Ready
window.addEventListener('DOMContentLoaded', () => {
  const yearEl = document.getElementById('footer-year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  initRouter();
  initToolTabs();
  initPlayerInspector();
  initServerChecker();
  initColorFormatter();
  initUuidTool();
  initAfkBotTool();
  checkAuth();
});
