/* ===== EDIT THESE BEFORE GOING LIVE ===== */
const CONFIG = {
  discord: 'https://discord.gg/Ga6y7rzd5u',
  upi: { id: '9470726690@fam', name: 'Cat Game' },
  crypto: [], // later, e.g. { name: 'USDT (TRC20)', addr: 'T...' }
  redeemApi: '' // optional: POST {code} -> {ok, product, tier, expires}
};
/* prices: [INR, USD] */
const P = {
  catgame: { logo: '/assets/catgame.png', name: 'CatGame', chip: 'Key · weekly or monthly', blurb: 'Solves SMP chat games with human-like delays: math, anagrams, fill-in-the-blank and trivia.',
    pts: ['2,466 item and block names built in', 'Cooldown radar warns you 20s ahead', 'HWID-bound keys'],
    tiers: [
      { n: 'Iron', w: [20, .25], m: [70, .85], d: '4.0s safe delay, 1 device, 5 solvers.' },
      { n: 'Gold', w: [40, .49], m: [140, 1.69], d: '2.5s delay (down to 2.0s with /cat delay), 2 devices, priority queue.' },
      { n: 'Diamond', w: [70, .85], m: [250, 2.99], d: '0.8s delay (down to 0.1s), 5 devices, AI trivia solver, unlimited HWID resets.' }] },
  catflip: { logo: '/assets/catflip.png', name: 'CatFlip', chip: 'Key · weekly or monthly', blurb: 'Coinflip bankroll manager for DeluxeCoinflip servers. Plays only from a vault you set.',
    pts: ['Isolated vault, never touches your balance', 'Stops after 5 losses or a 50% drawdown', 'Live HUD with profit and win rate'],
    tiers: [
      { n: 'Iron', w: [20, .25], m: [70, .85], d: 'Conservative math engine, vault and loss cutoff, 1 device.' },
      { n: 'Gold', w: [40, .49], m: [140, 1.69], d: 'Adds aggressive mode, custom max bet (25–90%), 2 devices.' },
      { n: 'Diamond', w: [70, .85], m: [250, 2.99], d: 'Adds 5 devices, CatGame included, custom server rule presets.' }] },
  catsell: { logo: '/assets/catsell-icon.png', name: 'CatSell', chip: 'Key · monthly', blurb: 'Autonomous chest unloader & auto-seller for Fabric 1.21.11. Rotation-locking, smart scanning, and automatic /sellgui integration.',
    pts: ['Rotation lock keeps you locked on target chest', 'Scans slots until chest is 100% full before looting', 'Hands-free /sellgui and /sell automation loop'],
    noTiers: true,
    tiers: [
      { n: 'Standard', m: [39, .49], d: 'Monthly license: full mod features, rotation-lock, auto-seller, HWID-bound key.' }] },
  catorder: { logo: '/assets/catorder-icon.png', name: 'CatOrder', chip: 'Key · monthly', blurb: 'Autonomous bone shop buyer & order delivery macro for Fabric 1.21.11. Smart /bal tracker, automatic /order search, and instant kill switch.',
    pts: ['Auto-buys bones from /shop in bulk (up to 2,304 bones)', 'Sign packet interceptor searches orders & picks highest profit', 'Safe delivery loop with instant emergency kill switch [L]'],
    noTiers: true,
    tiers: [
      { n: 'Standard', m: [45, .55], d: 'Monthly license: full macro routine, /bal profit tracking, sign interceptor, HWID-bound key.' }] },
  catdrop: { logo: '/assets/catdrop-icon.png', name: 'CatDrop', chip: 'Key · monthly', blurb: 'Autonomous bone buyer & auto-drop macro for Fabric 1.21.11. Bulk /shop buyer, smart inventory scanner, and automated slot throw loop.',
    pts: ['Auto-buys bones from /shop in bulk (36x stacks)', 'Automated inventory throwing loop (slots 9-44)', 'Configurable tick delay and emergency kill switch [I]'],
    noTiers: true,
    tiers: [
      { n: 'Standard', m: [39, .49], d: 'Monthly license: full macro routine, bulk buyer, auto-drop engine, HWID-bound key.' }] },
  catpay: { logo: '/assets/catpay.svg', name: 'CatPay', chip: 'One-time · no key', blurb: 'Client-side /pay simulator that matches a server\'s currency glyph and colors, for tutorials and video content.',
    pts: ['Works offline, no key or HWID', 'Reads MiniMessage and hex colors', 'Parses 10m, 1.5b and similar'],
    tiers: [
      { n: 'Standard', o: [50, .59], d: 'Lifetime license, all features, future updates.' },
      { n: 'VIP', o: [80, .99], d: 'Standard plus a custom server profile and early beta builds.' }] }
};

/* ---------- helpers ---------- */
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const copy = t => (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).catch(() => {});
const post = (url, body) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
document.querySelectorAll('[data-dc]').forEach(a => { a.href = CONFIG.discord; a.target = '_blank'; a.rel = 'noopener'; });

/* ---------- shared feedback: spinner, tick/cross, confetti ---------- */
const reduce = matchMedia('(prefers-reduced-motion:reduce)').matches;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const buzz = p => { try { navigator.vibrate && navigator.vibrate(p); } catch (_) {} };
const spinHTML = (title, sub = '') => `<div class="state"><div class="spin"></div><h3>${title}</h3>${sub ? `<p class="tier-d">${sub}</p>` : ''}</div>`;
const tickHTML = ok => `<div class="tickwrap">${ok ? '<div class="burst"></div>' : ''}<svg class="tick" viewBox="0 0 52 52" aria-hidden="true"><circle class="tc" cx="26" cy="26" r="24"/><path class="tp" d="${ok ? 'M14 27l8 8 16-17' : 'M17 17l18 18M35 17L17 35'}"/></svg></div>`;
function confetti(box) {
  if (!box || reduce) return;
  const cols = ['#2f5bff', '#6ba4e8', '#141a2e', '#ffffff', '#12805c'];
  for (let i = 0; i < 30; i++) {
    const el = document.createElement('i'), a = Math.random() * Math.PI * 2, r = 90 + Math.random() * 90;
    el.style.cssText = `--x:${Math.cos(a) * r}px;--y:${Math.sin(a) * r - 30}px;--r:${Math.random() * 540 - 270}deg;background:${cols[i % cols.length]};animation-delay:${Math.random() * .15}s`;
    box.appendChild(el);
  }
}
const celebrate = view => { confetti(view && view.querySelector('.burst')); buzz([30, 40, 30]); return view; };
/* swap a box's contents for a status view, and put the original nodes back later */
function takeover(box) {
  const kids = [...box.childNodes]; box.replaceChildren();
  const view = document.createElement('div'); box.appendChild(view);
  return { show: html => { view.innerHTML = html; return view; }, restore: () => box.replaceChildren(...kids) };
}
const shake = el => { el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); };
function reveal() {
  if (reduce || !('IntersectionObserver' in window)) return;
  const io = reveal.io || (reveal.io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); e.target.addEventListener('transitionend', () => { e.target.classList.remove('rv', 'in'); e.target.style.transitionDelay = ''; }, { once: true }); } }), { rootMargin: '0px 0px -6% 0px' }));
  document.querySelectorAll('main h2, main .lead, .card, .box, .split>*, .hero>*, .legal h3').forEach((el, i) => {
    if (el.dataset.rv) return; el.dataset.rv = 1; el.classList.add('rv'); el.style.transitionDelay = (i % 4) * 60 + 'ms'; io.observe(el);
  });
}

/* ---------- Discord login state ---------- */
let ME = null;
function paintMe() {
  const next = encodeURIComponent(location.pathname);
  const acct = $('#acct');
  if (acct) acct.innerHTML = ME
    ? `<span class="av">${ME.avatar ? `<img src="https://cdn.discordapp.com/avatars/${ME.id}/${ME.avatar}.png?size=64" alt="">` : esc(ME.name[0] || '?')}</span><span class="nm">${esc(ME.name)}</span><a href="/api/logout">Log out</a>`
    : `<a class="btn sm" href="/api/auth/login?next=${next}">Log in</a>`;
  document.querySelectorAll('[data-login]').forEach(a => a.href = '/api/auth/login?next=' + next);
  document.querySelectorAll('[data-in]').forEach(e => e.hidden = !ME);
  document.querySelectorAll('[data-out]').forEach(e => e.hidden = !!ME);
  document.dispatchEvent(new Event('me'));
}
async function refreshMe() {
  try { ME = (await (await fetch('/api/me', { credentials: 'same-origin' })).json()).user || null; } catch (_) { ME = null; }
  paintMe();
}
const ready = refreshMe();
window.CAT = { refreshMe, ready };

/* ---------- hero chat demo ---------- */
if ($('#chat')) {
  const el = $('#chat');
  ['<s>[Chat]</s> <b>ChatGame</b> Unscramble this: <b>Onraeg loWo</b>', '<s>[Chat]</s> <b>You</b> Orange Wool',
    '<i>CatGame solved it in 0.8s</i>', '<s>[Chat]</s> <b>ChatGame</b> You won $50,000'].forEach(h => { const d = document.createElement('div'); d.innerHTML = h; el.appendChild(d); });
  const rows = [...el.children];
  if (matchMedia('(prefers-reduced-motion:reduce)').matches) rows.forEach(r => r.classList.add('on'));
  else rows.forEach((r, i) => setTimeout(() => r.classList.add('on'), 600 + i * (i === 1 ? 1100 : 750)));
}

/* ---------- store + checkout ---------- */
if ($('#pay')) {
  const dlg = $('#pay'), S = {};
  const amount = () => { const t = P[S.p].tiers[S.t]; return t.o || t[S.per] || t.m || t.w; };
  const wait = ms => new Promise(r => setTimeout(r, ms));

  if ($('#products')) {
    $('#products').innerHTML = Object.entries(P).map(([k, p]) => {
      const t = p.tiers[0], first = t.o || (t.w ? t.w : t.m);
      const unit = t.o ? '' : (t.w ? ' <small>/ week</small>' : ' <small>/ month</small>');
      return `<article class="card">
        <div class="chead"><img class="plogo" src="${p.logo}" alt=""><div><h3>${p.name}</h3><span class="chip">${p.chip}</span></div></div>
        <p>${p.blurb}</p>
        <ul>${p.pts.map(x => `<li>${x}</li>`).join('')}</ul>
        <div class="price">${p.tiers.length > 1 ? '<small>from</small> ' : ''}₹${first[0]}${unit}</div>
        <div class="btnrow"><button class="btn" data-buy="${k}">Buy ${p.name}</button><a href="/store/${k}" class="btn alt sm">Details</a></div>
      </article>`;
    }).join('');
  }

  /* login is required before buying, so the bot can DM the key */
  async function startBuy(key, tier = 0) { await ready; ME ? openPay(key, tier) : promptLogin(key, tier); }
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-buy]');
    if (b) startBuy(b.dataset.buy, b.dataset.tier !== undefined ? +b.dataset.tier : 0);
  });
  const qs = new URLSearchParams(location.search), want = qs.get('buy');
  if (want && P[want]) { history.replaceState(null, '', location.pathname); startBuy(want, +(qs.get('tier') || 0)); }

  function promptLogin(key, tier = 0) {
    const next = encodeURIComponent(`${location.pathname}?buy=${key}&tier=${tier}`);
    $('#pBody').innerHTML = `
      <h3 id="pTitle">Log in to order<button class="btn alt sm" data-x aria-label="Close">Close</button></h3>
      <div class="state">
        <img class="plogo big" src="/assets/logo.png" alt="">
        <p class="tier-d">Log in with Discord first. It adds you to our server so the bot can DM your key and your private download link.</p>
        <a class="btn" href="/api/auth/login?next=${next}">Log in with Discord</a>
      </div>`;
    if (!dlg.open) dlg.showModal();
  }

  function openPay(key, tier = 0) {
    const p = P[key], t = p.tiers[Math.min(tier, p.tiers.length - 1)];
    const defPer = (t.m && !t.w) ? 'm' : 'w';
    Object.assign(S, { p: key, t: Math.min(tier, P[key].tiers.length - 1), per: defPer, method: 'upi', crypto: 0, tx: '', busy: false,
      oid: 'CG' + Date.now().toString(36).toUpperCase().slice(-6) });
    renderPay(); if (!dlg.open) dlg.showModal();
  }

  function renderPay() {
    const p = P[S.p], t = p.tiers[S.t], [inr, usd] = amount(), once = !!t.o, hasCrypto = CONFIG.crypto.length > 0;
    const hasBothPeriods = !once && t.w && t.m;
    const order = `${p.name}${p.noTiers || p.tiers.length === 1 ? '' : ' ' + t.n}${once ? '' : S.per === 'm' ? ' (month)' : ' (week)'}`;
    const on = v => `aria-pressed="${v}"`;
    const upiLink = `upi://pay?pa=${encodeURIComponent(CONFIG.upi.id)}&pn=${encodeURIComponent(CONFIG.upi.name)}&am=${inr}&cu=INR&tn=${encodeURIComponent(S.oid)}`;
    const c = CONFIG.crypto[S.crypto];
    $('#pBody').innerHTML = `
    <h3 id="pTitle"><span class="chead"><img class="plogo sm" src="${p.logo}" alt="">${p.name}</span><button class="btn alt sm" data-x aria-label="Close">Close</button></h3>
    ${p.noTiers || p.tiers.length <= 1 ? '' : `<div class="seg" role="group" aria-label="Tier">${p.tiers.map((x, i) => `<button ${on(i === S.t)} data-t="${i}">${x.n}</button>`).join('')}</div>`}
    <div class="tier-d">${t.d}</div>
    ${hasBothPeriods ? `<div class="seg" role="group" aria-label="Period"><button ${on(S.per === 'w')} data-per="w">Weekly</button><button ${on(S.per === 'm')} data-per="m">Monthly</button></div>` : (!once ? `<div class="tier-d" style="font-weight:600">${S.per === 'm' ? 'Monthly license (30 days)' : 'Weekly license (7 days)'}</div>` : '')}
    <div class="total">₹${inr} <small>or $${usd}</small></div>
    <div class="seg" role="group" aria-label="Payment method"><button ${on(S.method === 'upi')} data-m="upi">UPI</button>${hasCrypto ? `<button ${on(S.method === 'crypto')} data-m="crypto">Crypto</button>` : '<button disabled>Crypto soon</button>'}</div>
    <div class="pane">${S.method === 'upi' ? `
      <a class="btn" href="${upiLink}">Pay ₹${inr} in your UPI app</a>
      <div>UPI ID <code>${CONFIG.upi.id}</code> <button class="btn alt sm" data-c="${CONFIG.upi.id}">Copy</button></div>
      <div class="qr" id="qr"></div><div class="tier-d qrnote">Or scan this from another device.</div>` : `
      <div class="seg">${CONFIG.crypto.map((x, i) => `<button ${on(i === S.crypto)} data-cr="${i}">${x.name}</button>`).join('')}</div>
      <div>Send <b>$${usd}</b> worth of ${c.name} to:</div>
      <div><code>${c.addr}</code> <button class="btn alt sm" data-c="${c.addr}">Copy</button></div>
      <div class="tier-d">Network fees are on you. Send on the exact network shown, or the payment is lost.</div>`}</div>
    <label>Transaction ID (UTR or hash)<input id="pTx" autocomplete="off" inputmode="text" value="${esc(S.tx || '')}"></label>
    <div class="tier-d">Logged in as <b>${esc(ME.name)}</b>. Your key is sent to you by DM.</div>
    <button class="btn" id="pGo">I've paid, send my order</button>
    <div class="out" id="pOut" role="status"></div>`;
    if (S.method === 'upi' && window.QRCode) new QRCode($('#qr'), { text: upiLink, width: 160, height: 160 });
    S.order = order; S.amt = `₹${inr} / $${usd}`; S.inr = inr;
  }

  dlg.addEventListener('cancel', e => { if (S.busy) e.preventDefault(); });
  dlg.addEventListener('click', e => {
    if (S.busy) return;
    if (e.target === dlg) return dlg.close();
    const b = e.target.closest('button'); if (!b) return;
    const d = b.dataset;
    if ('x' in d) return dlg.close();
    if (d.c) { copy(d.c); b.textContent = 'Copied'; return; }
    if ('retry' in d) return renderPay();
    if ('copyorder' in d) { copy(`Order ${S.oid}\n${S.order}: ${S.amt}\nTxn: ${S.tx}\nDiscord: ${ME.name}`); b.textContent = 'Copied'; return; }
    if (b.id === 'pGo') return submitPay();
    if (d.t) S.t = +d.t; else if (d.per) S.per = d.per; else if (d.m) S.method = d.m; else if (d.cr) S.crypto = +d.cr; else return;
    S.tx = ($('#pTx') || {}).value || S.tx; renderPay();
  });

  const show = html => { $('#pBody').innerHTML = html; };

  async function submitPay() {
    const inp = $('#pTx'), out = $('#pOut'), tx = inp.value.trim();
    if (tx.length < 6) {
      inp.classList.remove('shake'); void inp.offsetWidth; inp.classList.add('shake'); inp.focus();
      out.style.color = '#b3261e'; out.textContent = 'Enter the transaction ID (UTR) from your payment app.'; return;
    }
    S.tx = tx; S.busy = true;
    const method = S.method === 'upi' ? 'UPI' : CONFIG.crypto[S.crypto].name;
    show(`<div class="state"><div class="spin"></div><h3>Sending your order</h3><p class="tier-d">Please wait, don't close this.</p></div>`);
    const t0 = Date.now(); let st = 0;
    try { st = (await post('/api/order', { oid: S.oid, order: S.order, amount: S.amt, method, txn: tx })).status; } catch (_) {}
    await wait(Math.max(0, 1200 - (Date.now() - t0)));
    S.busy = false;
    if (st === 200) {
      show(`<div class="state ok"><div class="tickwrap"><div id="burst" class="burst"></div><svg class="tick" viewBox="0 0 52 52" aria-hidden="true"><circle class="tc" cx="26" cy="26" r="24"/><path class="tp" d="M14 27l8 8 16-17"/></svg></div>
        <h3>Order sent</h3><div class="amt">₹${S.inr}</div>
        <div class="sum"><div><span>Item</span><b>${esc(S.order)}</b></div><div><span>Order ID</span><b>${S.oid}</b></div><div><span>Paid via</span><b>${method}</b></div><div><span>Transaction</span><b>${esc(tx)}</b></div></div>
        <ol class="next"><li>We check your payment by hand.</li><li>Your key arrives in your Discord DMs.</li><li>Download the mod from your private download page.</li></ol>
        <a class="btn" href="/download">Open download page</a><button class="btn alt" data-x>Done</button></div>`);
      celebrate($('#pBody'));
    } else if (st === 401) { promptLogin(S.p, S.t); }
    else {
      const msg = st === 409 ? 'That transaction ID was already used on another order.' : st === 0 ? 'No connection. Check your internet and try again.' : 'We could not send the order. Try again, or send the details in a Discord ticket.';
      show(`<div class="state bad"><div class="tickwrap"><svg class="tick" viewBox="0 0 52 52" aria-hidden="true"><circle class="tc" cx="26" cy="26" r="24"/><path class="tp" d="M17 17l18 18M35 17L17 35"/></svg></div>
        <h3>Order not sent</h3><p class="tier-d">${msg}</p>
        <button class="btn" data-retry>Try again</button><button class="btn alt" data-copyorder>Copy order details</button></div>`);
      buzz(120);
    }
  }
}

/* ---------- free trial ---------- */
if ($('#tBtn')) {
  const btn = $('#tBtn'), box = btn.closest('.box'), out = $('#tOut');
  if (/error=auth/.test(location.search)) { out.style.color = '#b3261e'; out.textContent = 'Discord login did not finish. Try again.'; }
  btn.onclick = async () => {
    const product = $('#tProd').value, t = takeover(box);
    t.show(spinHTML('Creating your key', 'This takes a few seconds.'));
    const t0 = Date.now(); let r = null, j = {};
    try { r = await post('/api/trial', { product }); j = await r.json().catch(() => ({})); } catch (_) {}
    await sleep(Math.max(0, 1100 - (Date.now() - t0)));
    if (r && r.ok && j.ok) {
      celebrate(t.show(`<div class="state ok">${tickHTML(true)}<h3>Trial started</h3>` + (j.dm
        ? '<p class="tier-d">Check your Discord DMs from the Cat Game bot. The key lasts 2 hours.</p>'
        : `<p class="tier-d">We could not DM you, so here is your 2-hour key. Save it now.</p><div class="cmd"><code>${esc(j.key)}</code></div><div class="cmd"><code>${esc(j.cmd)}</code><button class="btn alt sm" data-c="${esc(j.cmd)}">Copy</button></div>`)
        + '<a class="btn" href="/download">Open download page</a></div>'));
      return;
    }
    const m = { used: 'You already used the trial for this mod. Pick a plan in the store to keep going.', login: 'Log in with Discord first.' }[j.error] || 'Could not create the key right now. Try again in a minute or open a ticket on Discord.';
    const v = t.show(`<div class="state bad">${tickHTML(false)}<h3>No trial key</h3><p class="tier-d">${m}</p><button class="btn" data-back>Back</button></div>`);
    v.querySelector('[data-back]').onclick = t.restore; buzz(120);
  };
}

/* ---------- custom mod ---------- */
if ($('#cSend')) {
  const send = $('#cSend'), box = send.closest('.box');
  send.onclick = async () => {
    const b = $('#cBrief'), o = $('#cOut'), text = b.value.trim();
    if (!text) { shake(b); b.focus(); o.style.color = '#b3261e'; o.textContent = 'Describe what the mod should do first.'; buzz(80); return; }
    copy(`Custom mod request\nType: ${$('#cType').value}\nVersion: ${$('#cVer').value}\nBudget: ${$('#cBudget').value || 'not set'}\n\n${text}`);
    const t = takeover(box); t.show(spinHTML('Preparing your request')); await sleep(900);
    const v = t.show(`<div class="state ok">${tickHTML(true)}<h3>Request copied</h3><p class="tier-d">Open a ticket on Discord and paste it. You get a fixed quote there before you pay anything.</p><a class="btn" data-dc href="#">Open Discord</a><button class="btn alt" data-back>Edit request</button></div>`);
    v.querySelectorAll('[data-dc]').forEach(a => { a.href = CONFIG.discord; a.target = '_blank'; a.rel = 'noopener'; });
    celebrate(v); v.querySelector('[data-back]').onclick = t.restore;
  };
}

/* ---------- redeem ---------- */
if ($('#rBtn')) {
  const rc = $('#rCode'), box = $('#rBtn').closest('.box');
  rc.addEventListener('input', () => {
    const v = rc.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 19), out = []; let i = 0;
    for (const n of [3, 4, 4, 4, 4]) if (v.length > i) { out.push(v.slice(i, i + n)); i += n; }
    rc.value = out.join('-');
  });
  const cmd = (c, label) => `<div class="cmd"><span>${label}</span><code>${c}</code><button class="btn alt sm" data-c="${c}">Copy</button></div>`;
  $('#rBtn').onclick = async () => {
    const code = rc.value, o = $('#rOut');
    if (!/^CAT-[A-Z0-9]{4}(-[A-Z0-9]{4}){3}$/.test(code)) { shake(rc); o.innerHTML = '<div class="out" style="color:#b3261e">That key is not complete. It looks like CAT-XXXX-XXXX-XXXX-XXXX.</div>'; buzz(80); return; }
    o.innerHTML = ''; const t = takeover(box); t.show(spinHTML('Checking your key'));
    const t0 = Date.now(); let info = '', bad = '', verified = false;
    if (CONFIG.redeemApi) {
      try {
        const j = await (await post(CONFIG.redeemApi, { code })).json();
        if (!j.ok) bad = 'This key was not found or has expired. Open a ticket on Discord if you think that is wrong.';
        else { verified = true; info = `${esc(j.product)} ${esc(j.tier)} is active${j.expires ? ' until ' + esc(j.expires) : ''}.`; }
      } catch (_) { info = 'Could not reach the key server, so the key was not checked.'; }
    }
    await sleep(Math.max(0, 900 - (Date.now() - t0)));
    if (bad) { const v = t.show(`<div class="state bad">${tickHTML(false)}<h3>Key not valid</h3><p class="tier-d">${bad}</p><button class="btn" data-back>Try again</button></div>`); v.querySelector('[data-back]').onclick = t.restore; buzz(120); return; }
    const v = t.show(`<div class="state ok">${tickHTML(true)}<h3>${verified ? 'Key is active' : 'Ready to activate'}</h3>${info ? `<p class="tier-d">${info}</p>` : ''}
      <p class="tier-d">Put the mod in <code>.minecraft/mods</code> with Fabric API and Cloth Config, start the game, then run:</p>${cmd(`/cat key ${code}`, 'CatGame')}${cmd(`/catflip license ${code}`, 'CatFlip')}${cmd(`/catsell key ${code}`, 'CatSell')}${cmd(`/catorder key ${code}`, 'CatOrder')}${cmd(`/catdrop key ${code}`, 'CatDrop')}
      <a class="btn" href="/download">Get the mod file</a><button class="btn alt" data-back>Redeem another</button><p class="tier-d">Need help or a device reset? Ask in a Discord ticket.</p></div>`);
    celebrate(v); v.querySelector('[data-back]').onclick = () => { t.restore(); rc.value = ''; };
  };
}

/* ---------- private download page ---------- */
if ($('#dlBox')) {
  const box = $('#dlBox');
  const loadDl = async () => {
    if (!ME) { box.innerHTML = '<p class="tier-d">Log in with the Discord account you bought with.</p><a class="btn" href="/api/auth/login?next=/download">Log in with Discord</a>'; return; }
    box.innerHTML = '<div class="spin"></div>';
    let j; try { j = await (await fetch('/api/downloads')).json(); } catch (_) { j = null; }
    if (!j || !j.items) { box.innerHTML = '<p class="out" style="color:#b3261e">Could not load your downloads. Try again in a minute.</p>'; return; }
    if (!j.items.length) { box.innerHTML = `<p>No active key on <b>${esc(ME.name)}</b> yet.</p><p class="tier-d">Downloads unlock when your key is delivered. Payments are checked by hand, so new orders can take a little while.</p><a class="btn alt" href="/store">Go to the store</a>`; return; }

    const consentHtml = `
      <div class="consent-box">
        <label class="consent-item">
          <input type="checkbox" id="ageCheck">
          <span>I confirm that I am <strong>12 years of age or older</strong>.</span>
        </label>
        <label class="consent-item">
          <input type="checkbox" id="tosCheck">
          <span>I have read and agree to the <a href="/legal#terms" target="_blank" rel="noopener">Terms of Service</a> and <a href="/legal#privacy" target="_blank" rel="noopener">Privacy Policy</a> (including strict anti-decompilation rules and trade secret protections).</span>
        </label>
      </div>`;

    const itemsHtml = j.items.map(i => `
      <article class="dl">
        <img class="plogo" src="${esc(i.logo)}" alt="">
        <div>
          <h3>${esc(i.name)}</h3>
          <div class="tier-d">v${esc(i.ver)} · Fabric ${esc(i.mc)} · ${esc(i.size)}</div>
          <div class="tier-d">${esc(i.extra)}</div>
        </div>
        <button class="btn dl-btn" data-dl="${encodeURIComponent(i.id)}" disabled>Download</button>
      </article>`).join('');

    box.innerHTML = consentHtml + itemsHtml
      + '<p class="tier-d" style="margin-top:12px">You must check both confirmation boxes above before downloading. Then activate in-game with your key. Do not share or decompile these files.</p>';

    const ageCheck = $('#ageCheck');
    const tosCheck = $('#tosCheck');
    const updateButtons = () => {
      const allowed = ageCheck && ageCheck.checked && tosCheck && tosCheck.checked;
      box.querySelectorAll('.dl-btn').forEach(btn => {
        btn.disabled = !allowed;
      });
    };

    if (ageCheck) ageCheck.addEventListener('change', updateButtons);
    if (tosCheck) tosCheck.addEventListener('change', updateButtons);

    box.addEventListener('click', e => {
      const b = e.target.closest('.dl-btn');
      if (b && !b.disabled) {
        if (!ageCheck.checked || !tosCheck.checked) {
          alert('You must confirm you are 12+ and agree to the Terms of Service & Privacy Policy.');
          return;
        }
        b.classList.add('busy');
        setTimeout(() => b.classList.remove('busy'), 2500);
        window.location.href = `/api/download?p=${b.dataset.dl}&agree=1`;
      }
    });
  };
  document.addEventListener('me', loadDl);
}

/* ---------- small effects everywhere ---------- */
document.addEventListener('click', e => {
  const c = e.target.closest('[data-c]');
  if (c) { copy(c.dataset.c); c.dataset.old = c.dataset.old || c.textContent; c.textContent = 'Copied'; c.classList.remove('flash'); void c.offsetWidth; c.classList.add('flash'); clearTimeout(c._t); c._t = setTimeout(() => { c.textContent = c.dataset.old; c.classList.remove('flash'); }, 1500); buzz(20); }
  const a = e.target.closest('a[href^="/api/auth/login"],a[href^="/api/download"]');
  if (a && !a.classList.contains('busy')) { a.classList.add('busy'); if (a.getAttribute('href').startsWith('/api/download')) setTimeout(() => a.classList.remove('busy'), 2500); }
}, true);
reveal();
