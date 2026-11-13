# Dhoop Project Desk

Solar project delivery desk for residential, commercial and industrial installs in Pakistan:
pipeline (lead to handover), team tasks, payment milestones, margin tracking, quick quote,
and WhatsApp client updates in English and Roman Urdu.

It is a single static page (`index.html`) with no build step and no server.

## Deploy

**Netlify (easiest):** open https://app.netlify.com/drop and drag this whole folder onto the page.
You get a live `https://<name>.netlify.app` link in seconds. `_headers` sets security headers.

**Vercel:** log in at vercel.com → Add New → Project → upload this folder (or `vercel deploy`
from this folder if the Vercel CLI is installed). `vercel.json` sets security headers.

**Cloudflare Pages:** Workers & Pages → Create → Pages → Upload assets → upload this folder.

**Any web host / cPanel:** upload `index.html` to `public_html`.

Custom domain (e.g. `desk.yourcompany.com`): add it in the host's Domains settings and create
the CNAME record it shows at your domain registrar. HTTPS is issued automatically.

## Data storage (read this)

On a normal web host the app saves data **in each user's browser only** (localStorage).
Each staff member and each device has its own copy, and clearing browser data deletes it.

- Use **Backup** (top bar) regularly to download a `.json` file, and **Restore** to load one.
- For a shared, multi-user team desk with logins, the next step is a hosted database
  (e.g. Supabase or Firebase) wired into `save()` / `initDb()` in `index.html`.

## Quick quote engineering model

| Item | Method |
|---|---|
| Array kWp | monthly units ÷ units-per-kW (default 120, about 1,440 kWh/kWp/yr); off-grid × 1.3 |
| Inverter | smallest standard rating with DC/AC ≤ 1.2; above 300 kWp, multiple 125 kW string inverters |
| Battery (LiFePO4, 90% DoD) | hybrid: 35% of daily units; off-grid: one day of autonomy; rounded up to 2.5 kWh |
| Roof area | module area (about 21.5% efficiency) × 1.5 for row spacing and walkways on flat roofs |
| Savings | self-used units × retail tariff + exported units × buyback rate (net billing) |
| Self-use | residential 45%, commercial 75%, industrial 85%; +25 points for hybrid; off-grid 100% |

All prices, the tariff and the buyback rate are editable placeholders. Confirm the current
NEPRA / DISCO net metering rules and buyback rate before quoting savings to a client.
