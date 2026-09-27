# Weather Dashboard

A dynamic, data-rich weather dashboard built with plain HTML/CSS/JavaScript and Chart.js. No API key required — powered by [Open-Meteo](https://open-meteo.com/), a free and open-source weather API.

![Static Site](https://img.shields.io/badge/type-static%20site-blue) ![No API Key](https://img.shields.io/badge/API%20key-not%20required-brightgreen) ![License](https://img.shields.io/badge/license-MIT-lightgrey)

## Features

- **Geolocation** — auto-detects the user's city via `navigator.geolocation`, with reverse geocoding and a graceful fallback if permission is denied
- **Search + history** — search any city worldwide; last 6 searches are saved in `localStorage` for one-click reload
- **Current conditions** — temperature, "feels like," humidity, wind, UV index, with a dynamic weather icon
- **5-day forecast** — card layout with per-day high/low and conditions
- **24-hour temperature trend** — Chart.js line/area chart starting from the current hour
- **Radial gauges** — SVG gauges for humidity, UV index, wind speed, and air quality (US AQI)
- **Unit toggle** — switch between °C/km/h and °F/mph instantly, no refetch needed
- **Dynamic theming** — background gradient shifts with weather condition and day/night
- **Loading states** — shimmer skeleton loaders while data fetches
- **Resilient fetching** — current weather, forecast, and air quality are fetched in parallel with `Promise.all`, with error handling for failed requests or unknown cities

## Project structure

```
weather-dashboard/
├── index.html          # Markup + layout
├── css/
│   └── style.css       # All styling, theming, skeletons, responsive rules
├── js/
│   └── app.js           # Fetch logic, rendering, event handling
├── package.json         # Dev server + deploy scripts (no build step needed)
├── netlify.toml         # Netlify deployment config
├── vercel.json           # Vercel deployment config
├── .gitignore
└── README.md
```

This is a **static site** — no build step, no bundler, no backend. Every file is served as-is.

## Running locally

You need Node.js only for the optional local dev server (`serve`); the app itself doesn't require Node at runtime.

```bash
npm install
npm run dev
```

Then open **http://localhost:5173**.

Alternatively, skip Node entirely and open `index.html` directly in a browser, or serve the folder with any static file server (e.g. `python3 -m http.server`).

> **Note:** Geolocation (`navigator.geolocation`) requires a secure context. It works on `localhost` and any HTTPS deployment, but will be blocked on a plain `file://` URL or non-HTTPS host.

## Deployment

This project deploys to any static host with zero configuration.

### Netlify

```bash
npm run deploy:netlify
```
Or connect the repo in the Netlify dashboard — `netlify.toml` already sets the publish directory to `.` with no build command.

### Vercel

```bash
npm run deploy:vercel
```
Or import the repo in the Vercel dashboard — `vercel.json` marks it as a static deployment.

### GitHub Pages

1. Push this repo to GitHub.
2. In **Settings → Pages**, set the source to the `main` branch, root directory.
3. Your site will be live at `https://<username>.github.io/<repo-name>/`.

### Any other static host

Upload the contents of this folder (`index.html`, `css/`, `js/`) to S3, Cloudflare Pages, Firebase Hosting, or any static file server. There's nothing to build.

## APIs used

All calls go directly to Open-Meteo's free, keyless REST APIs:

| Purpose | Endpoint |
|---|---|
| Geocoding (search) | `geocoding-api.open-meteo.com/v1/search` |
| Reverse geocoding (locate me) | `geocoding-api.open-meteo.com/v1/reverse` |
| Weather (current + hourly + daily) | `api.open-meteo.com/v1/forecast` |
| Air quality (AQI) | `air-quality-api.open-meteo.com/v1/air-quality` |

No signup, no rate-limit headaches for typical personal/portfolio use, and no secrets to store — which also means there's no `.env` file in this project.

### Swapping in a different provider

If you'd rather use OpenWeatherMap, WeatherAPI.com, or Visual Crossing (e.g. for their icon sets or sports/astronomy data), replace the fetch calls in `js/app.js` (`fetchWeatherBundle`, `geocodeCity`, `reverseGeocode`) with the equivalent endpoints, and store your API key as an environment variable injected at build/deploy time rather than hardcoding it client-side — those providers' free tiers are keyed and rate-limited per key.

## Browser support

Modern evergreen browsers (Chrome, Firefox, Safari, Edge). Uses `fetch`, `Promise.all`, CSS custom properties, and `navigator.geolocation` — no polyfills included.

## License

MIT — see [LICENSE](./LICENSE).
