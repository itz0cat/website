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
      switchView('tools', 'Developer Tools — itz0cat');
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
  // Update document title
  if (title) document.title = title;

  // Toggle active view container
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

  // Reset scroll position to top
  window.scrollTo(0, 0);

  // Trigger terminal animation on home
  if (viewId === 'home' && !terminalExecuted) {
    runTerminal();
  }
}

// 3. Dev Tools Access Gating
function handleToolsAccess() {
  const lockedView = document.getElementById('dev-locked-view');
  const unlockedView = document.getElementById('dev-unlocked-view');
  const lockedMsg = document.getElementById('locked-message');
  const lockedBtn = document.getElementById('locked-login-btn');

  if (!currentUser || !currentUser.loggedIn) {
    // Visitor is unauthenticated
    if (lockedView) lockedView.style.display = 'block';
    if (unlockedView) unlockedView.style.display = 'none';
    if (lockedMsg) {
      lockedMsg.innerHTML = 'This operations panel contains FastClient player intelligence tools, active manifest inspection, and remote cloud keepalive controls. Access is strictly gated to the verified administrator: <strong>@itz0cat</strong>.';
    }
    if (lockedBtn) {
      lockedBtn.href = '/api/auth/login?returnTo=/tools';
      lockedBtn.style.display = 'inline-flex';
      lockedBtn.querySelector('span').textContent = 'Sign in with Discord as @itz0cat';
    }
  } else if (!currentUser.isAdmin) {
    // Visitor is authenticated as another user (not itz0cat)
    if (lockedView) lockedView.style.display = 'block';
    if (unlockedView) unlockedView.style.display = 'none';
    if (lockedMsg) {
      lockedMsg.innerHTML = `Access Denied. You are signed in with Discord as <strong>@${currentUser.user.username}</strong>.<br>This developer control center is strictly restricted to administrator <strong>@itz0cat</strong>.`;
    }
    if (lockedBtn) {
      lockedBtn.href = '#';
      lockedBtn.style.display = 'inline-flex';
      lockedBtn.querySelector('span').textContent = 'Sign Out to Switch Accounts';
      lockedBtn.onclick = async (e) => {
        e.preventDefault();
        await fetch('/api/auth/logout', { method: 'POST' });
        window.location.reload();
      };
    }
  } else {
    // Visitor IS @itz0cat!
    if (lockedView) lockedView.style.display = 'none';
    if (unlockedView) unlockedView.style.display = 'block';
    loadAdminTelemetry();
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
      // User is authenticated
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
        navDevBadge.textContent = data.isAdmin ? '⚡' : '🔒';
      }

      // Community card status
      if (commLoggedOut) commLoggedOut.style.display = 'none';
      if (commLoggedIn) {
        commLoggedIn.style.display = 'block';
        if (commAvatar) commAvatar.src = data.user.avatarUrl;
        if (commUsername) commUsername.textContent = `${data.user.global_name || data.user.username} (@${data.user.username})`;
      }
    } else {
      // Unauthenticated visitor
      if (loginBtn) loginBtn.style.display = 'inline-flex';
      if (userPill) userPill.style.display = 'none';
      if (navDevBadge) navDevBadge.textContent = '🔒';

      if (commLoggedOut) commLoggedOut.style.display = 'block';
      if (commLoggedIn) commLoggedIn.style.display = 'none';
    }

    // If currently on tools page, re-evaluate access
    const currentPath = window.location.pathname;
    if (currentPath === '/tools') {
      handleToolsAccess();
    }
  } catch (err) {
    console.error('Auth verification failed:', err);
  }
}

// 5. FastClient Player Lookup (Dev Only)
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

// 6. Admin Telemetry & Cloud Pinger Controls
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
  } catch (err) {
    console.error('Admin telemetry fetch error:', err);
  }
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

// 7. Logout Handler
const logoutBtn = document.getElementById('logout-btn');
if (logoutBtn) {
  logoutBtn.addEventListener('click', async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.reload();
  });
}

// 8. Mobile Navigation Toggle
const navToggle = document.getElementById('nav-toggle');
const navLinks = document.getElementById('nav-links');

if (navToggle && navLinks) {
  navToggle.addEventListener('click', () => {
    const isOpen = navLinks.classList.toggle('open');
    navToggle.setAttribute('aria-expanded', String(isOpen));
  });
}

// 9. Hero Terminal Pipeline Animation
const terminalBody = document.getElementById('terminal-body');
const terminalScript = [
  { type: 'prompt', text: '$ ./gradlew build --no-daemon' },
  { type: 'out', text: '> Task :compileJava [Java 21 Intermediary]' },
  { type: 'out', text: '> Task :remapJar [Fabric 1.21.11]' },
  { type: 'success', text: 'BUILD SUCCESSFUL (1m 14s)' },
  { type: 'prompt', text: '$ npm start' },
  { type: 'out', text: '[itz0cat] Backend online at https://itz0cat.onrender.com' },
  { type: 'out', text: '[FastClient] Heartbeat active for "Itz0Cat__"' },
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

// 10. Bootstrap Application on DOM Ready
window.addEventListener('DOMContentLoaded', () => {
  // Update footer copyright year
  const yearEl = document.getElementById('footer-year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // Initialize Navigo routing
  initRouter();

  // Check auth state
  checkAuth();
});
