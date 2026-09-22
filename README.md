# KIMMYNAILS website

Framework-free website for Kimmy Nails with a Node.js/SQLite appointment booking service.

## Files

- `index.html` — complete one-page salon website
- `styles.css` — all responsive styling and animation
- `script.js` — framework-free interactions and the customer booking flow
- `server.js` — static web server and booking/admin APIs
- `lib/booking-store.js` — database schema, availability and atomic capacity checks
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

Bookings are stored in `data/bookings.db`. This file is created automatically and is ignored by Git. Existing booking rows are never removed when a customer or admin cancels; their status changes to `cancelled`.

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
