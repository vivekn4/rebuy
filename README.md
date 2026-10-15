<!-- Kayak for used goods — calm comparison engine for secondhand listings. -->
# Rebuy

**Compare every used listing, right here in Sudbury.** Rebuy is a calm, hyperlocal comparison engine for used goods: search once ("ThinkPad T480"), and it lines up listings from Rebuy sellers, eBay and the second-hand web side by side — normalized, deal-scored, and ready to compare. Sudbury, Ontario only for now — the site never pretends to cover other cities.

Live at **vivekn4.github.io/rebuy** · Vanilla HTML/CSS/JS · Zero dependencies · Zero build step · Zero budget

## Screenshot

![Rebuy homepage — centered search with the "Compare every used listing, right here in Sudbury" brand statement](assets/screenshot.png)
*Mockup generated for this README — the live app follows the same calm design system (cream, terracotta, sage).*

## What it does

- **Google-like homepage** — one centered search bar, one action. The word *Compare* is the brand.
- **Two-zone results** — main column **"On Rebuy"** (native listings within the 25 km Sudbury beta radius), side panel **"Also listed on"** with three honest external tiers:
  1. **eBay** via the real Browse API (live with your free key, clearly-labeled demo mode without),
  2. **Google Programmable Search** across marketplace domains (free 100 queries/day key; graceful quota fallback),
  3. **Smart deep links** to Kijiji, Facebook Marketplace, Craigslist, and OfferUp with the query pre-filled — because those platforms offer no public API, and we say so.
- **Compare view** — tick listings from *either* zone → compare tray → side-by-side table (price, deal score, condition, distance, source, link-out). Best price and best deal highlighted.
- **Deal Score engine** — every listing gets a hang-tag badge (Great deal / Fair / Overpriced), computed from new-retail reference + depreciation curve + condition + local sold comps, or vs. the result-set median for cross-source items. Formula documented in [PLAN.md](PLAN.md).
- **Haggle Engine** — "What should I offer?" on any listing; "list at $X to sell within a week" while selling; structured offers with eBay-style auto accept/decline/counter.
- **Spend tab** — log purchases ("I bought this"), animated last-30-days counter, monthly chart with dynamic 6M/1Y/5Y/MAX ranges, per-category breakdown, and a **"Saved vs. new"** hero.
- **Saved-search alerts** — in-app + Notification API pings when a matching listing appears.
- **Zero commission, forever** — Rebuy never takes a cut. You pay the seller in person (cash/e-transfer at a public meetup). Stated plainly next to every purchase action. No payments integration, ever.
- **Calm by design** — cream/terracotta/sage palette, Lora + Raleway, one gentle motion moment per view, soft Web Audio chimes with a persisted mute toggle. Restraint is the aesthetic.

## Data sources, honestly

| Source | How | Without a key |
|---|---|---|
| Rebuy native | Local listings (seeded + yours) | Always works |
| eBay | Browse API, client-credentials OAuth, token cached with expiry | Labeled demo results |
| Web (Kijiji, Craigslist, FB…) | Google Programmable Search JSON API (your free key + engine) | Labeled demo results |
| Kijiji / FB / Craigslist / OfferUp | Deep links with query pre-filled (verified URL patterns) | Always works |

Keys live in `localStorage` on *your* device and are sent only to `api.ebay.com` / `googleapis.com`. Coming-soon source slots (Kijiji, Facebook, Craigslist, OfferUp) render as disabled chips — adding a real adapter later is one file plus one `register()` call.

## Run it

No build step. Serve the folder any static way and open `index.html`:

```bash
cd rebuy && python3 -m http.server 8080
# → http://localhost:8080
```

Or drop the folder on GitHub Pages as-is.

## Project layout

```
index.html          shell: header, nav, compare tray, modal, toasts, footer (VN)
styles.css          calm design system (tokens, hang-tag badges, responsive, reduced-motion)
js/app.js           bootstrap
js/ui.js            hash router + all views (home, search, listing, compare, sell, spend, alerts, offers, settings)
js/store.js         data layer — versioned localStorage, backend-swappable interface
js/seed.js          24 demo listings around Sudbury ON + sellers + sold comps + meetup spots
js/deals.js         deal-score engine + haggle math (pure, tested)
js/geo.js           geolocation + Haversine + 25 km beta filter (pure, tested)
js/offers.js        structured offer flow math (pure, tested)
js/spend.js         purchase aggregation (pure, tested)
js/charts.js        hand-drawn canvas charts (HiDPI aware)
js/sound.js         soft Web Audio chimes + persisted mute
js/sources/         adapter interface + registry (adapter.js), eBay (ebay.js),
                    Google CSE (google.js), smart deep links (deeplinks.js), native (rebuy.js)
test/               node --test suites: 51 tests, all passing
PLAN.md             architecture, deal-score formula, eBay/CSE integration design, bug table
```

## QA

```bash
node --check js/ui.js js/app.js js/sources/*.js   # syntax
node --test test/*.test.js                        # 51/51 passing
```

Plus a jsdom smoke harness that boots the real app and walks every route (37/37 checks). Not verified: real-browser rendering, live eBay/Google keys, on-device geolocation — a 5-minute live smoke test after Pages deploy is recommended.

## License

MIT — do good things with it.

<p align="center"><sub>Crafted with care · <strong>VN</strong></sub></p>
