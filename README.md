# Cat Game site

Pages: `/` home, `/store`, `/custom`, `/redeem`, `/trial`, `/legal`. Shared code in `assets/`, serverless API in `api/`.

## 1. Payments
Edit `CONFIG` at the top of `assets/site.js` (UPI ID now, crypto addresses later).
Paid orders are posted to your private admin channel with the buyer's UTR. You verify the payment, then deliver the key.

## 2. Discord login + free trial
1. Discord Developer Portal > your app > OAuth2 > add redirect `https://YOUR-SITE/api/auth/callback`.
2. The bot must be in your server with the "Create Invite" permission (needed to add members).
3. Add every variable from `.env.example` in Vercel, then redeploy.
4. `createKey()` in `api/_lib.js` already calls catcore's `/admin/create-key` and `/admin/set-key-expiry`.

Login adds the user to your server, then the bot DMs the 2-hour key. If their DMs are closed, the key is shown on the page instead.

Deploy: `vercel --prod`
