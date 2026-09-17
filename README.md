# KIMMYNAILS website

Framework-free recreation of [kimmynail.de](https://kimmynail.de/) using semantic HTML, CSS and a small amount of vanilla JavaScript for the menu, sliders, gallery, booking selector, FAQ and cookie banner.

## Files

- `index.html` — complete one-page salon website
- `styles.css` — all responsive styling and animation
- `script.js` — framework-free interactions
- `impressum.html`, `datenschutz.html`, `agb.html` — legal pages
- `public/` — local images, fonts and icons

## Run locally

No install or build step is required. You can open `index.html` directly, or serve the folder with any static web server:

```bash
python -m http.server 4173
```

Then open `http://localhost:4173`.

Booking buttons open https://kimmynailsq56b.setmore.com in a new tab. The booking section also links to Setmore after service selection; selected services are not automatically transferred. The map remains an external embed. The contact form mirrors the source site's client-side confirmation and does not send data to a backend.
