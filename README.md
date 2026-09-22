# KIMMYNAILS website

Framework-free website for Kimmy Nails with appointment booking, Supabase/PostgreSQL support on Vercel, cancellation links and WhatsApp handoff.

## Files

- `index.html` — complete one-page salon website
- `styles.css` — all responsive styling and animation
- `script.js` — framework-free interactions and the customer booking flow
- `server.js` — static web server and booking/admin APIs
- `lib/booking-store.js` — database schema, availability and atomic capacity checks
- `api/` — Vercel Functions backed by Supabase PostgreSQL
- `supabase/schema.sql` — Supabase schema and database-level capacity protection
- `cancel.html`, `cancel.js` — token-protected customer cancellation page
- `admin.html`, `admin.js` — booking management page
- `impressum.html`, `datenschutz.html`, `agb.html` — legal pages
- `public/` — local images, fonts and icons

## Run locally

Node.js 22.5 or newer is required (the project uses Node's built-in SQLite driver). Start the website with:

```bash
npm start
```

Then open `http://localhost:4173`.

For local `npm start` development, bookings are stored in `data/bookings.db`. This file is created automatically and ignored by Git. Vercel deployments use Supabase PostgreSQL through the functions in `api/`. Existing booking rows are never removed when a customer or admin cancels; their status changes to `cancelled`.

## Deploy on Vercel with Supabase

1. Run `supabase/schema.sql` in the Supabase SQL Editor.
2. Add the Supabase Transaction Pooler connection string as the sensitive Vercel environment variable `DATABASE_URL`.
3. Add `ADMIN_KEY` for the admin page.
4. Optionally set `WHATSAPP_NUMBER` in international format without `+`, spaces or dashes. It defaults to `4982144917851`.
5. Redeploy without the previous build cache.

The Vercel API stores the booking first. Only after a successful insert does the browser open a prefilled WhatsApp message containing the booking details and cancellation link.

The admin page is available at `http://localhost:4173/admin/bookings`. In production, set an admin key before starting the server:

```powershell
$env:ADMIN_KEY = 'replace-with-a-long-secret'
npm start
```

Enter the same key in the admin page. When `ADMIN_KEY` is not set, the admin API is intentionally left open for local development.

Run the capacity and cancellation tests with:

```bash
npm test
```
