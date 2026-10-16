# Cat Game site

```
public/     everything served to visitors (pages + assets). Logo: public/assets/logo.png
api/        serverless functions (Discord login, trial, orders, private downloads)
private/    mod jars. NOT served. Only api/download.js can read them, after login + key check
```

Pages: `/` `/store` `/store/<mod>` `/custom` `/redeem` `/trial` `/legal`.
`/download` is not linked anywhere on the site. It is only given to buyers (order screen, DMs, trial, redeem).

## Rules the code enforces
- Buying and the trial both require Discord login (the bot needs to DM the key).
- A download needs: logged in + an ACTIVE, unexpired catcore key for that mod whose `discordId` equals the logged-in user.
  When you deliver a paid key, set its Discord ID (shown in the order message) with catcore `set-key-discord`, or create it with `discordId`.

## Updating a mod
Replace `private/jars/catgame-latest.jar` / `catflip-latest.jar` and update `ver` in `DOWNLOADS` (api/_lib.js).

## Env vars
See `.env.example`. Set them in Vercel, never in files.

## Logo
Replace `public/assets/logo.png` (header + favicon). Product logos: `catgame.png`, `catflip.png`, `catpay.svg` (CatPay's is a placeholder tile).
