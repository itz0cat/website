/* ===== EDIT THESE BEFORE GOING LIVE ===== */
const CONFIG = {
  discord: 'https://discord.gg/Ga6y7rzd5u',
  upi: { id: '9470726690@fam', name: 'Cat Game' },
  crypto: [], // later, e.g. { name: 'USDT (TRC20)', addr: 'T...' }
  redeemApi: '' // optional: POST {code} -> {ok, product, tier, expires}
};
/* prices: [INR, USD] */
const P = {
  catgame: { name: 'CatGame', chip: 'Key · weekly or monthly', blurb: 'Solves SMP chat games with human-like delays: math, anagrams, fill-in-the-blank and trivia.',
    pts: ['2,466 item and block names built in', 'Cooldown radar warns you 20s ahead', 'HWID-bound keys'],
    tiers: [
      { n: 'Iron', w: [20, .25], m: [70, .85], d: '4.0s safe delay, 1 device, 5 solvers.' },
      { n: 'Gold', w: [40, .49], m: [140, 1.69], d: '2.5s delay (down to 2.0s with /cat delay), 2 devices, priority queue.' },
      { n: 'Diamond', w: [70, .85], m: [250, 2.99], d: '0.8s delay (down to 0.1s), 5 devices, AI trivia solver, unlimited HWID resets.' }] },
  catflip: { name: 'CatFlip', chip: 'Key · weekly or monthly', blurb: 'Coinflip bankroll manager for DeluxeCoinflip servers. Plays only from a vault you set.',
    pts: ['Isolated vault, never touches your balance', 'Stops after 5 losses or a 50% drawdown', 'Live HUD with profit and win rate'],
    tiers: [
      { n: 'Iron', w: [20, .25], m: [70, .85], d: 'Conservative math engine, vault and loss cutoff, 1 device.' },
      { n: 'Gold', w: [40, .49], m: [140, 1.69], d: 'Adds aggressive mode, custom max bet (25–90%), 2 devices.' },
      { n: 'Diamond', w: [70, .85], m: [250, 2.99], d: 'Adds 5 devices, CatGame included, custom server rule presets.' }] },
  catpay: { name: 'CatPay', chip: 'One-time · no key', blurb: 'Client-side /pay simulator that matches a server\'s currency glyph and colors, for tutorials and video content.',
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
window.CAT = { refreshMe };
refreshMe();

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
if ($('#products')) {
  $('#products').innerHTML = Object.entries(P).map(([k, p]) => {
    const t = p.tiers[0], first = t.o || t.w;
    return `<article class="card"><span class="chip">${p.chip}</span><h3>${p.name}</h3><p>${p.blurb}</p>
    <ul>${p.pts.map(x => `<li>${x}</li>`).join('')}</ul>
    <div class="price"><small>from</small> ₹${first[0]}${t.o ? '' : ' <small>/ week</small>'}</div>
    <button class="btn" data-buy="${k}">Buy ${p.name}</button></article>`;
  }).join('');
  document.addEventListener('click', e => { const b = e.target.closest('[data-buy]'); if (b) openPay(b.dataset.buy); });

  const S = {}, dlg = $('#pay');
  const amount = () => { const t = P[S.p].tiers[S.t]; return t.o || t[S.per]; };
  function openPay(key) { Object.assign(S, { p: key, t: 0, per: 'w', method: 'upi', crypto: 0, oid: 'CG' + Date.now().toString(36).toUpperCase().slice(-6) }); renderPay(); dlg.showModal(); }
  function renderPay() {
    const p = P[S.p], t = p.tiers[S.t], [inr, usd] = amount(), once = !!t.o, hasCrypto = CONFIG.crypto.length > 0;
    const order = `${p.name} ${t.n}${once ? '' : S.per === 'w' ? ' (week)' : ' (month)'}`;
    const on = v => `aria-pressed="${v}"`;
    const upiLink = `upi://pay?pa=${encodeURIComponent(CONFIG.upi.id)}&pn=${encodeURIComponent(CONFIG.upi.name)}&am=${inr}&cu=INR&tn=${encodeURIComponent(S.oid)}`;
    const c = CONFIG.crypto[S.crypto];
    $('#pBody').innerHTML = `
    <h3 id="pTitle">${p.name}<button class="btn alt sm" data-x aria-label="Close">Close</button></h3>
    <div class="seg" role="group" aria-label="Tier">${p.tiers.map((x, i) => `<button ${on(i === S.t)} data-t="${i}">${x.n}</button>`).join('')}</div>
    <div class="tier-d">${t.d}</div>
    ${once ? '' : `<div class="seg" role="group" aria-label="Period"><button ${on(S.per === 'w')} data-per="w">Weekly</button><button ${on(S.per === 'm')} data-per="m">Monthly</button></div>`}
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
    <label>Transaction ID (UTR or hash)<input id="pTx" autocomplete="off" inputmode="text"></label>
    ${ME ? `<div class="tier-d">Logged in as <b>${esc(ME.name)}</b>. Your key will be sent to you by DM.</div>`
         : `<label>Your Discord username<input id="pDc" autocomplete="off"></label><div class="tier-d"><a data-login href="#">Log in with Discord</a> to get your key by DM automatically.</div>`}
    <button class="btn" id="pGo">I've paid, send my order</button>
    <div class="out" id="pOut" role="status"></div>`;
    if (S.method === 'upi' && window.QRCode) new QRCode($('#qr'), { text: upiLink, width: 160, height: 160 });
    document.querySelectorAll('#pBody [data-login]').forEach(a => a.href = '/api/auth/login?next=' + encodeURIComponent(location.pathname));
    S.order = order; S.amt = `₹${inr} / $${usd}`;
  }
  dlg.addEventListener('click', e => {
    if (e.target === dlg) return dlg.close();
    const b = e.target.closest('button'); if (!b) return;
    const d = b.dataset;
    if ('x' in d) return dlg.close();
    if (d.c) { copy(d.c); b.textContent = 'Copied'; return; }
    if (b.id === 'pGo') return submitPay(b);
    if (d.t) S.t = +d.t; else if (d.per) S.per = d.per; else if (d.m) S.method = d.m; else if (d.cr) S.crypto = +d.cr; else return;
    renderPay();
  });
  async function submitPay(btn) {
    const tx = $('#pTx').value.trim(), dc = ME ? ME.name : ($('#pDc') ? $('#pDc').value.trim() : ''), out = $('#pOut');
    const fail = m => { out.style.color = '#b3261e'; out.textContent = m; };
    if (!tx || !dc) return fail('Enter the transaction ID' + (ME ? '.' : ' and your Discord username.'));
    const method = S.method === 'upi' ? 'UPI' : CONFIG.crypto[S.crypto].name;
    btn.disabled = true; btn.textContent = 'Sending…'; out.textContent = '';
    try {
      const r = await post('/api/order', { oid: S.oid, order: S.order, amount: S.amt, method, txn: tx, discord: dc });
      if (r.ok) { out.style.color = ''; out.textContent = 'Order sent. We check the payment by hand, then your key arrives on Discord.'; btn.textContent = 'Order sent'; return; }
      if (r.status === 409) { fail('That transaction ID was already used on another order.'); }
      else throw new Error('api');
    } catch (_) {
      copy(`Order ${S.oid}\n${S.order}: ${S.amt}\nMethod: ${method}\nTxn: ${tx}\nDiscord: ${dc}`);
      window.open(CONFIG.discord, '_blank', 'noopener');
      out.style.color = ''; out.textContent = 'Could not reach the order system, so your order was copied. Paste it in a Discord ticket.';
    }
    btn.disabled = false; btn.textContent = "I've paid, send my order";
  }
}

/* ---------- free trial ---------- */
if ($('#tBtn')) {
  const out = $('#tOut'), btn = $('#tBtn');
  if (/error=auth/.test(location.search)) { out.style.color = '#b3261e'; out.textContent = 'Discord login did not finish. Try again.'; }
  btn.onclick = async () => {
    const product = $('#tProd').value;
    btn.disabled = true; btn.textContent = 'Creating your key…'; out.style.color = ''; out.textContent = '';
    try {
      const r = await post('/api/trial', { product }), j = await r.json().catch(() => ({}));
      if (r.ok && j.ok) {
        out.innerHTML = j.dm ? '<div class="out">Sent. Check your Discord DMs from the Cat Game bot. The key lasts 2 hours.</div>'
          : `<div class="out">We could not DM you (your DMs may be closed), so here is your 2-hour key. Save it now.</div><div class="cmd"><code>${esc(j.key)}</code></div><div class="cmd"><code>${esc(j.cmd)}</code><button class="btn alt sm" data-c="${esc(j.cmd)}">Copy</button></div>`;
        btn.textContent = 'Trial started'; return;
      }
      const m = { used: 'You already used the trial for this mod. Pick a plan in the store to keep going.', login: 'Log in with Discord first.' }[j.error] || 'Could not create the key right now. Try again in a minute or open a ticket on Discord.';
      out.style.color = '#b3261e'; out.textContent = m;
    } catch (_) { out.style.color = '#b3261e'; out.textContent = 'Could not reach the server. Try again.'; }
    btn.disabled = false; btn.textContent = 'Get my trial key';
  };
  out.addEventListener('click', e => { const b = e.target.closest('[data-c]'); if (b) { copy(b.dataset.c); b.textContent = 'Copied'; } });
}

/* ---------- custom mod ---------- */
if ($('#cSend')) $('#cSend').onclick = () => {
  const b = $('#cBrief').value.trim(), o = $('#cOut');
  if (!b) { o.style.color = '#b3261e'; o.textContent = 'Describe what the mod should do first.'; return; }
  copy(`Custom mod request\nType: ${$('#cType').value}\nVersion: ${$('#cVer').value}\nBudget: ${$('#cBudget').value || 'not set'}\n\n${b}`);
  window.open(CONFIG.discord, '_blank', 'noopener');
  o.style.color = ''; o.textContent = 'Request copied. Paste it in a ticket on Discord and you will get a quote there.';
};

/* ---------- redeem ---------- */
if ($('#rBtn')) {
  const rc = $('#rCode');
  rc.addEventListener('input', () => {
    const v = rc.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 19), out = []; let i = 0;
    for (const n of [3, 4, 4, 4, 4]) if (v.length > i) { out.push(v.slice(i, i + n)); i += n; }
    rc.value = out.join('-');
  });
  const cmd = (c, label) => `<div class="cmd"><span>${label}</span><code>${c}</code><button class="btn alt sm" data-c="${c}">Copy</button></div>`;
  $('#rOut').addEventListener('click', e => { const b = e.target.closest('[data-c]'); if (b) { copy(b.dataset.c); b.textContent = 'Copied'; } });
  $('#rBtn').onclick = async () => {
    const code = rc.value, o = $('#rOut');
    if (!/^CAT-[A-Z0-9]{4}(-[A-Z0-9]{4}){3}$/.test(code)) { o.innerHTML = '<div class="out" style="color:#b3261e">That key is not complete. It looks like CAT-XXXX-XXXX-XXXX-XXXX.</div>'; return; }
    let info = '';
    if (CONFIG.redeemApi) {
      try {
        const j = await (await post(CONFIG.redeemApi, { code })).json();
        if (!j.ok) { o.innerHTML = '<div class="out" style="color:#b3261e">This key was not found or has expired. Open a ticket on Discord if you think that is wrong.</div>'; return; }
        info = `<div class="out">${esc(j.product)} ${esc(j.tier)} is active${j.expires ? ' until ' + esc(j.expires) : ''}.</div>`;
      } catch (_) { info = '<div class="tier-d">Could not reach the key server, so the key was not checked.</div>'; }
    }
    o.innerHTML = info + '<p style="margin-top:8px">Put the mod in <code>.minecraft/mods</code> with Fabric API and Cloth Config, start the game, then run:</p>'
      + cmd(`/cat key ${code}`, 'CatGame') + cmd(`/catflip license ${code}`, 'CatFlip')
      + '<p style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap"><a href="/downloads/catgame-latest.jar" class="btn sm" download>Download CatGame</a><a href="/downloads/catflip-latest.jar" class="btn sm alt" download>Download CatFlip</a></p>'
      + '<p class="tier-d" style="margin-top:8px">Need help or a device reset? Ask in a Discord ticket.</p>';
  };
}
