# Dhoop Project Desk

Solar project delivery desk for residential, commercial and industrial installs in Pakistan:
pipeline (lead to handover), team tasks, payment milestones, margin tracking, quick quote,
and WhatsApp client updates in English and Roman Urdu.

The interface is a single static page (`index.html`). A Netlify Function stores the shared
application state in MongoDB, while `localStorage` keeps an offline browser copy.

## Deploy

The production site is https://dhoop-project.netlify.app.

Netlify deploys the static page and the function using `netlify.toml`. Connect this repository
to the Netlify site and set the environment variables described below. `_headers` sets security
headers for the browser app.

## MongoDB setup

1. Create a MongoDB Atlas cluster and database user.
2. In Atlas Network Access, allow connections from Netlify's functions. Atlas' serverless-safe
   option is `0.0.0.0/0`; use a strong database password because this permits connections from
   any IP address.
3. In Netlify, open **Site configuration → Environment variables** and add:
   - `MONGODB_URI`: the Atlas connection string
   - `MONGODB_DB`: database name (optional; defaults to `dhoop`)
   - `DHOOP_ACCESS_KEY`: a long random password shared only with authorized staff
4. Trigger a new Netlify deploy.
5. Open the site, click the database status at the top, and enter `DHOOP_ACCESS_KEY`.

The function writes one document (`_id: "primary"`) to the `app_state` collection and polls for
updates every five seconds. The access key is checked by the server function; MongoDB credentials
never reach the browser. The local copy remains available if the database is temporarily offline.

Use **Backup** regularly to download a JSON recovery file and **Restore** to replace the current
shared data from a backup.

For local development, copy `.env.example` to `.env`, fill in the values, run `npm install`, then
run `npx netlify dev`.

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
