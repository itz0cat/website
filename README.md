# 🐾 Cat Game — Mod Key Store & Landing Page

Official Material Design 3 storefront and key management portal for **Cat Game**, the high-performance Fabric mod (1.21.x) for Minecraft chat games.

## 🚀 Features

- **Strict Material Design 3 (M3)** with dynamic Material You accent palettes matching user customizations.
- **Dynamic Accent Color Picker**: Built-in 8-swatch Material palette + custom HTML5 color picker with persistent state via localStorage.
- **Tier-Wise Licensing Showcase**:
  - 🥉 **Iron Tier**: ₹80 / $4.99 (Lifetime Permanent, 4.0s safe human delay, 1 device).
  - 🥇 **Gold Tier**: ₹20 / Week or ₹70 / Month (2.5s speed, down to 2.0s via `/cat delay`, 2 devices, high priority cloud queue).
  - 💎 **Diamond Tier**: ₹40 / Week or ₹140 / Month (0.8s near-instant, down to 0.1s, 5 devices, VIP zero-delay queue, 24/7 custom trivia).
- **Direct Discord Checkout**: Seamless redirect to Discord ticket channel (`https://discord.gg/Ga6y7rzd5u`) for instant key generation and delivery.
- **Multi-Page Architecture**:
  - `/` → Redirects automatically to `/store`
  - `/store` → Official Storefront & Feature Showcase
  - `/terms` → Terms of Service & EULA compliance
  - `/refunds` → Digital goods refund & replacement policy
- **1-Click Command Copier**: In-game setup (`/cat key <key>`, `/cat delay <seconds>`, `/cat status`).

## 🌐 Deployment (Vercel)

Configured with `vercel.json` for instant Vercel deployment with clean URLs and root-to-store redirection.

```bash
vercel --prod
```

© 2026 Cat Game. All rights reserved.
