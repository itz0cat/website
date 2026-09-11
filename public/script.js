// ============================================================
// Mobile nav toggle
// ============================================================
const navToggle = document.getElementById("nav-toggle");
const navLinks = document.getElementById("nav-links");

if (navToggle && navLinks) {
  navToggle.addEventListener("click", () => {
    const isOpen = navLinks.classList.toggle("open");
    navToggle.setAttribute("aria-expanded", String(isOpen));
  });

  navLinks.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      navLinks.classList.remove("open");
      navToggle.setAttribute("aria-expanded", "false");
    });
  });
}

// ============================================================
// Footer year
// ============================================================
const footerYear = document.getElementById("footer-year");
if (footerYear) {
  footerYear.textContent = new Date().getFullYear();
}

// ============================================================
// Hero Terminal — Realistic Engineering Build & Launch
// ============================================================
const terminalBody = document.getElementById("terminal-body");

const terminalScript = [
  { type: "prompt", text: "$ ./gradlew build --no-daemon" },
  { type: "out", text: "> Task :compileJava [Java 21 Intermediary]" },
  { type: "out", text: "> Task :remapJar [Fabric 1.21.11]" },
  { type: "out", text: "BUILD SUCCESSFUL (1m 17s)" },
  { type: "prompt", text: "$ npm start" },
  { type: "out", text: "[itz0cat] Backend online at https://itz0cat.onrender.com" },
  { type: "out", text: "[FastClient] Cloud heartbeat active for \"Itz0Cat__\"" },
  { type: "out", text: "UptimeRobot: 5m Keepalive [UP 200 OK] ✓" },
];

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function renderStatic() {
  if (!terminalBody) return;
  terminalBody.innerHTML = terminalScript
    .map((line) => `<span class="${line.type}">${line.text}</span>`)
    .join("\n");
}

async function typeLine(el, text, speed) {
  for (let i = 0; i <= text.length; i++) {
    el.textContent = text.slice(0, i);
    await new Promise((r) => setTimeout(r, speed));
  }
}

async function runTerminal() {
  if (!terminalBody) return;
  if (reduceMotion) {
    renderStatic();
    return;
  }

  terminalBody.innerHTML = "";

  for (const line of terminalScript) {
    const span = document.createElement("span");
    span.className = line.type;
    terminalBody.appendChild(span);
    await typeLine(span, line.text, line.type === "prompt" ? 22 : 12);
    terminalBody.appendChild(document.createTextNode("\n"));
    await new Promise((r) => setTimeout(r, line.type === "out" ? 180 : 100));
  }

  const cursor = document.createElement("span");
  cursor.className = "cursor";
  terminalBody.appendChild(cursor);
}

if (terminalBody) {
  const observer = new IntersectionObserver(
    (entries, obs) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          runTerminal();
          obs.disconnect();
        }
      });
    },
    { threshold: 0.3 }
  );
  observer.observe(terminalBody);
}

// ============================================================
// Interactive FastClient Intelligence & Lookup Tool
// ============================================================
const lookupForm = document.getElementById("lookup-form");
const lookupInput = document.getElementById("lookup-username");
const lookupBtn = document.getElementById("lookup-btn");
const pingBtn = document.getElementById("ping-btn");
const lookupResult = document.getElementById("lookup-result");
const noticeEl = document.getElementById("lookup-notice");

// Result elements
const resAvatar = document.getElementById("res-avatar");
const resName = document.getElementById("res-name");
const resPill = document.getElementById("res-status-pill");
const resUuid = document.getElementById("res-uuid");
const resRank = document.getElementById("res-rank");
const resCapeImg = document.getElementById("res-cape-img");
const resCapeStatus = document.getElementById("res-cape-status");
const resSkinImg = document.getElementById("res-skin-img");
const resSkinStatus = document.getElementById("res-skin-status");
const resTabStatus = document.getElementById("res-tab-status");
const resBadgeStatus = document.getElementById("res-badge-status");

async function doLookup(username) {
  const user = (username || "").trim();
  if (!user) return;

  lookupBtn.disabled = true;
  lookupBtn.textContent = "Querying...";
  noticeEl.textContent = "Inspecting FastClient CDN and live manifest...";

  try {
    const res = await fetch(`/api/fastclient/lookup/${encodeURIComponent(user)}`);
    const data = await res.json();

    if (data.error) {
      noticeEl.textContent = `Error: ${data.error}`;
      lookupBtn.disabled = false;
      lookupBtn.textContent = "Lookup Player";
      return;
    }

    resName.textContent = data.username;
    resAvatar.src = data.avatarUrl;

    if (data.active) {
      resPill.className = "status-pill active";
      resPill.innerHTML = "● ACTIVE FASTCLIENT USER";
      resRank.textContent = `Manifest Rank #${data.rank.toLocaleString()} of ${data.totalUsers.toLocaleString()} active players`;
      resTabStatus.textContent = "ACTIVE";
      resTabStatus.className = "cosmetic-status found";
      resBadgeStatus.textContent = "ACTIVE";
      resBadgeStatus.className = "cosmetic-status found";
    } else {
      resPill.className = "status-pill inactive";
      resPill.innerHTML = "○ INACTIVE / UNREGISTERED";
      resRank.textContent = `Not currently indexed in FastClient's ${data.totalUsers.toLocaleString()} active players`;
      resTabStatus.textContent = "INACTIVE";
      resTabStatus.className = "cosmetic-status none";
      resBadgeStatus.textContent = "INACTIVE";
      resBadgeStatus.className = "cosmetic-status none";
    }

    if (data.mojang && data.mojang.verified) {
      resUuid.textContent = `UUID: ${data.mojang.id} (Mojang Verified)`;
    } else {
      resUuid.textContent = "UUID: Offline / Cracked Account";
    }

    // Cape
    if (data.cosmetics.cape.exists) {
      resCapeImg.src = data.cosmetics.cape.url;
      resCapeImg.style.display = "block";
      resCapeStatus.textContent = `FOUND (${data.cosmetics.cape.size || "?"}B)`;
      resCapeStatus.className = "cosmetic-status found";
    } else {
      resCapeImg.style.display = "none";
      resCapeStatus.textContent = "None";
      resCapeStatus.className = "cosmetic-status none";
    }

    // Skin
    if (data.cosmetics.skin.exists) {
      resSkinImg.src = data.cosmetics.skin.url;
      resSkinImg.style.display = "block";
      resSkinStatus.textContent = `FOUND (${data.cosmetics.skin.size || "?"}B)`;
      resSkinStatus.className = "cosmetic-status found";
    } else {
      resSkinImg.style.display = "none";
      resSkinStatus.textContent = "None";
      resSkinStatus.className = "cosmetic-status none";
    }

    lookupResult.classList.add("visible");
    noticeEl.textContent = data.active 
      ? `✓ Player is active on FastClient.` 
      : `Player is not yet registered. Click "Register Heartbeat" to ping now.`;

  } catch (err) {
    noticeEl.textContent = `Lookup failed: ${err.message}`;
  } finally {
    lookupBtn.disabled = false;
    lookupBtn.textContent = "Lookup Player";
  }
}

if (lookupForm) {
  lookupForm.addEventListener("submit", (e) => {
    e.preventDefault();
    doLookup(lookupInput.value);
  });
}

if (pingBtn) {
  pingBtn.addEventListener("click", async () => {
    const user = lookupInput.value.trim() || "Itz0Cat__";
    pingBtn.disabled = true;
    pingBtn.textContent = "Pinging...";
    noticeEl.textContent = `Dispatching heartbeat for "${user}"...`;

    try {
      const res = await fetch("/api/fastclient/ping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: user })
      });
      const data = await res.json();

      if (res.ok) {
        noticeEl.textContent = `✓ FastClient accepted heartbeat for "${user}". Manifest updates in ~60-120s!`;
        setTimeout(() => doLookup(user), 2500);
      } else {
        noticeEl.textContent = `Ping rejected: ${JSON.stringify(data)}`;
      }
    } catch (err) {
      noticeEl.textContent = `Ping error: ${err.message}`;
    } finally {
      pingBtn.disabled = false;
      pingBtn.textContent = "Register Heartbeat";
    }
  });
}

// ============================================================
// Discord Authentication & Admin Control Center
// ============================================================
const loginBtn = document.getElementById("login-btn");
const userPill = document.getElementById("user-pill");
const userAvatar = document.getElementById("user-avatar");
const userTag = document.getElementById("user-tag");
const logoutBtn = document.getElementById("logout-btn");
const adminSection = document.getElementById("admin");
const navAdminLink = document.getElementById("nav-admin-link");

// Admin inputs & metrics
const adminTargetUser = document.getElementById("admin-target-user");
const adminIntervalSelect = document.getElementById("admin-interval-select");
const adminSaveCfgBtn = document.getElementById("admin-save-cfg-btn");
const adminTogglePingerBtn = document.getElementById("admin-toggle-pinger-btn");
const adminForcePingBtn = document.getElementById("admin-force-ping-btn");
const adminFeedback = document.getElementById("admin-pinger-feedback");

const metricUptime = document.getElementById("metric-uptime");
const metricRss = document.getElementById("metric-rss");
const metricHeap = document.getElementById("metric-heap");
const metricSuccessPings = document.getElementById("metric-success-pings");
const metricFailPings = document.getElementById("metric-fail-pings");
const metricLastStatus = document.getElementById("metric-last-status");

async function checkAuth() {
  try {
    const res = await fetch("/api/auth/me");
    const data = await res.json();

    if (data.loggedIn && data.user) {
      if (loginBtn) loginBtn.style.display = "none";
      if (userPill) {
        userPill.style.display = "inline-flex";
        userAvatar.src = data.user.avatarUrl;
        userTag.textContent = `@${data.user.username}`;
      }

      if (data.isAdmin) {
        if (adminSection) adminSection.classList.add("visible");
        if (navAdminLink) navAdminLink.style.display = "inline";
        loadAdminTelemetry();
      }
    } else {
      if (loginBtn) loginBtn.style.display = "inline-flex";
      if (userPill) userPill.style.display = "none";
      if (adminSection) adminSection.classList.remove("visible");
      if (navAdminLink) navAdminLink.style.display = "none";
    }
  } catch (err) {
    console.error("Auth check failed:", err);
  }
}

async function loadAdminTelemetry() {
  try {
    const res = await fetch("/api/admin/status");
    if (!res.ok) return;
    const data = await res.json();

    if (adminTargetUser) adminTargetUser.value = data.fastclient.targetUsername;
    if (adminIntervalSelect) adminIntervalSelect.value = String(data.fastclient.intervalSeconds);
    if (adminTogglePingerBtn) {
      adminTogglePingerBtn.textContent = data.fastclient.active ? "Pause Pinger" : "Resume Pinger";
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
        : "Pending";
    }
  } catch (err) {
    console.error("Admin telemetry fetch error:", err);
  }
}

if (adminSaveCfgBtn) {
  adminSaveCfgBtn.addEventListener("click", async () => {
    const username = adminTargetUser.value.trim();
    const intervalSeconds = parseInt(adminIntervalSelect.value, 10);
    adminFeedback.textContent = "Saving configuration...";

    try {
      const res = await fetch("/api/admin/fastclient/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, intervalSeconds })
      });
      const json = await res.json();
      adminFeedback.textContent = json.message || "Saved!";
      loadAdminTelemetry();
    } catch (err) {
      adminFeedback.textContent = "Failed to save: " + err.message;
    }
  });
}

if (adminTogglePingerBtn) {
  adminTogglePingerBtn.addEventListener("click", async () => {
    adminFeedback.textContent = "Updating pinger state...";
    try {
      const res = await fetch("/api/admin/fastclient/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
      const json = await res.json();
      adminFeedback.textContent = json.message || "Toggled!";
      loadAdminTelemetry();
    } catch (err) {
      adminFeedback.textContent = "Toggle error: " + err.message;
    }
  });
}

if (adminForcePingBtn) {
  adminForcePingBtn.addEventListener("click", async () => {
    adminFeedback.textContent = "Sending force cloud ping...";
    try {
      const res = await fetch("/api/admin/fastclient/ping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: adminTargetUser.value.trim() })
      });
      const json = await res.json();
      adminFeedback.textContent = `✓ Force ping dispatched (HTTP ${json.result?.status || 200})`;
      loadAdminTelemetry();
    } catch (err) {
      adminFeedback.textContent = "Force ping failed: " + err.message;
    }
  });
}

if (logoutBtn) {
  logoutBtn.addEventListener("click", async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.reload();
  });
}

// Initial visit setup
window.addEventListener("DOMContentLoaded", () => {
  if (lookupInput) {
    lookupInput.value = "Itz0Cat__";
    doLookup("Itz0Cat__");
  }
  checkAuth();
});
