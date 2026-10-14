# Rebuy — PLAN

*Used-goods AGGREGATOR + comparison engine ("Kayak for used goods"). Vanilla HTML/CSS/JS, zero dependencies, zero build step, GitHub Pages direct. Written 2026-10-14; aggregator pivot same day.*

## 0. Product model (post-pivot)

Rebuy is a **comparison engine over multiple used-goods sources**, not primarily a list-it-yourself marketplace. Core experience: search "ThinkPad T480" → normalized results from all sources with source badges, ranked/sorted, Deal Scores computed cross-source → select 2–4 → side-by-side **Compare view** (price, condition, deal score, distance, source, link-out). "Sell on Rebuy" remains as a secondary tab; native listings appear in aggregated results with a Rebuy badge.

**Data-source reality (verified 2026-10-14):** 9 of 10 major used marketplaces offer NO public listing-search API (Facebook Marketplace, Kijiji, Craigslist, OfferUp, OLX, Gumtree, Mercari, Depop, Poshmark). Only **eBay** has a real free API (Developers Program → Browse API, client-credentials OAuth, no card). Architecture reflects this: one real adapter (eBay), one native adapter (Rebuy), honest coming-soon slots for the rest.

## 0b. Refined UX spec (2026-10-14, supersedes earlier layout notes)

**Homepage — one action, Google-like calm.** A single centered search bar is the whole page. Above it, the brand statement: wordmark **"Rebuy"** with the tagline **"Compare every used listing, everywhere."** The word *"Compare"* is the product's identity — comparison is the promise, not listing. Minimal chrome: quiet nav (Spend · Sell · Alerts · Settings), location pill ("Within 25 km of Sudbury, ON"), muted footer. No hero carousel, no category tiles screaming for attention — the search bar IS the homepage.

**Results page — two zones:**
1. **Main column — "On Rebuy":** native listings (Rebuy adapter / local listings). Full cards: photo, price, condition, Deal Score hang-tag badge, distance, seller card with verification + rating, **Make Offer**, **Message seller**. Zero-commission note sits beside purchase actions: *"Rebuy never takes a cut — you pay the seller in person."*
2. **Side panel — "Also listed on":** the same (or similar) product found on external platforms, for price/condition comparison. Contents in priority order:
   - **(a) eBay** via Browse API adapter — real price/condition/image/link-out in live mode; clearly-labeled demo results when no key. Never errors.
   - **(b) Google Programmable Search** (optional second key) — Custom Search JSON API results (free 100 queries/day) from a marketplace-scoped search engine. Title/snippet/link with source label. Quota-exceeded (429) degrades **silently** to (c) with a small note: *"External results paused — quota."* Demo mode when no key.
   - **(c) Smart deep links** — always available, no key: "Search this on Kijiji →", "→ Facebook Marketplace", "→ Craigslist", "→ OfferUp". Each opens that platform's own search URL with the query pre-filled in a new tab. Honest microcopy: *"Some marketplaces don't offer public APIs, so we send you to their search instead of pretending."*
   - The panel header shows which tier is live ("Live eBay results" / "Demo results — add your free eBay key in Settings for live listings").

**Compare view — the signature interaction.** Checkboxes on cards in EITHER zone → Compare tray (bottom, slides up gently) → side-by-side table: price, condition, deal score, distance, source, link-out / contact seller. Calm, delightful: 250ms ease, no confetti. Selected rows highlight with a soft sage ring.

**Transaction model (locked):** Rebuy takes **ZERO commission**. Buying on Rebuy = contact / make-offer / message the seller in-app → arrange an in-person meetup → pay the seller in person (cash / e-transfer). Stated plainly near every purchase action. No payments integration, ever. The business is **price comparison + engagement**.

**Settings page:** two optional free-key slots —
- *"eBay API key (App ID + Secret)"* — where: eBay Developers Program, free, no card → unlocks live eBay results in "Also listed on".
- *"Google Search API key + Search Engine ID"* — where: Google Cloud Console (Custom Search API, free 100/day) + Programmable Search Engine restricted to marketplace domains → unlocks cross-marketplace snippets.
Everything works in demo mode without either key. Keys live in localStorage on the user's own device, sent only to api.ebay.com / googleapis.com.

**Source filter chips** on results: All / eBay / Rebuy / Kijiji / Facebook / Craigslist / OfferUp — the last four rendered disabled with tooltip *"No public API yet"* (honest coming-soon slots; adding a real adapter later is one file + one `register()` call).

## 1. What it is

A calming, hyperlocal (25 km beta radius) used-goods marketplace for Sudbury ON. Three pillars:

1. **Market research built in** — every listing carries a Deal Score (Great deal / Fair / Overpriced) computed from new-retail reference price + depreciation + condition + local sold comps.
2. **Spend tab** — log purchases; see last-30-days spend (animated), monthly history chart, per-category breakdown, and "Saved vs. new" hero.
3. **Haggle Engine** — data-backed offer suggestions for buyers ("offer $X"), list-price guidance for sellers, structured offers with counter-offers and eBay-style auto accept/decline thresholds.

## 2. Aesthetic direction (frontend-design skill)

**Subject grounding:** pre-loved goods, secondhand treasures, neighborhood exchange. The governing motif is the **humble price hang-tag** — kraft-paper tags tied with string, the way good thrift shops do it. Copy framing: every item gets "a second story."

**The one memorable thing:** the Deal Score rendered as a little hang-tag badge (tag silhouette with punched hole + string), stamped Great deal / Fair / Overpriced. Everything else stays quiet and disciplined.

**Anti-tell review:** the brief pins warm/cream/terracotta/sage, so we follow it — but we avoid the generic cluster (no ALL-CAPS eyebrow labels, no "WORD — fragment" labels, no single-word accent italics, no gradient washes, no identical SaaS cards). Distinctiveness comes from the hang-tag motif, Lora's organic curves, and hand-drawn-feeling details (dashed "string" dividers, stamped badges).

**Design tokens:**
```
--cream:      #FFFBEB  (paper background)
--card:       #FFFFFF
--ink:        #292524  (warm stone)
--ink-soft:   #57534E
--clay:       #9A3412  (deep terracotta — primary; deliberately deeper than the #D97757 tell)
--clay-deep:  #7C2D12
--sage:       #5F7A61  (deal/savings green)
--sage-soft:  #E9EFE4
--amber:      #B45309  (fair/warning)
--amber-soft: #FBF3E4
--blush:      #F8F2EF  (muted surfaces)
--line:       #EBDFC9  (borders)
--radius:     18px cards / 999px pills
--shadow:     0 10px 30px rgba(154,52,18,.08)
```
**Type:** Lora (display/headings, 500/600) + Raleway (body/UI, 400/500/600/700) via Google Fonts. Left-aligned, generous whitespace, line length < 72ch.

## 3. Motion (emilkowalski-motion, calming)

Decision order per animation: should it animate → purpose → properties → curve/duration → interruption → exit.
- **One** orchestrated page-load moment: hero fades + rises gently (opacity + 12px translateY, 500ms ease-out). Nothing else auto-animates.
- Cards: hover lift only — translateY(-3px) + shadow deepen, 200ms ease-out. No bounce, no overshoot (calming ≠ playful).
- Buttons: 150ms background deepen; press scale 0.98.
- Modals (listing detail is a page; offer dialog is a modal): fade + scale 0.97→1, 250ms ease-out, origin-aware from the trigger where cheap.
- Chart: bars grow on first view (600ms ease-out, staggered 30ms — the one place stagger is earned).
- Counter: 650ms ease-in-out count-up, trunc rounding.
- `prefers-reduced-motion`: all of the above collapse to instant.

## 4. Sound (ui-sound-design, calming tunings)

Synthesized Web Audio, singleton context, persisted mute toggle in header.
- `click` — soft: bandpass 1200Hz, Q1, 0.06s, vol 0.15 (buttons, tabs)
- `toggle` — minimal: sine 550→650Hz, 0.08s, vol 0.12 (filters, mute)
- `success` — gentle: triangle two-tone major third, 0.18s notes, vol 0.15 (offer sent, listing posted, purchase logged)
- `notify` — soft bell: 660Hz, modRatio 1.2, modDepth 500, 0.6s, vol 0.15 (saved-search alert)
- `error` — gentle: sine 350→250Hz, 0.2s, vol 0.15 (form validation)
- No hover sounds, no whoosh/pop. Master volume capped 0.8; rules: context-singleton, gain-no-zero-target, set-before-ramp, stop-after-envelope.

## 5. Architecture

```
index.html        — shell: header/nav, view root, modals, toast region, footer (VN)
styles.css        — tokens + components
js/store.js       — data layer: versioned localStorage (KEY 'rebuy:v1'), seed on first run,
                    CRUD for listings/purchases/offers/alerts; backend-swappable interface
js/seed.js        — 24 listings around Sudbury ON (lat/lng), sellers, sold comps, meetup spots
js/deals.js       — deal-score engine: absolute (newPrice ref) + relative (vs result-set median) paths
js/geo.js         — geolocation + Haversine + 25km filter (pure, UMD)
js/offers.js      — offer math: suggestion, auto-thresholds, counter logic (pure, UMD)
js/spend.js       — purchase aggregation: buckets, ranges, savings (pure, UMD)
js/charts.js      — hand-drawn canvas charts (monthly bars, category bars)
js/sound.js       — WebAudio SFX library + persisted mute
js/sources/
  adapter.js      — SourceAdapter interface + registry: search(query, filters) → normalized[]
  ebay.js         — eBay Browse API adapter: live mode (client-credentials OAuth, token cache)
                    + clearly-labeled demo mode (seeded mock results, no key needed)
  rebuy.js        — native listings adapter (store/seed → normalized)
js/ui.js          — hash router + view renderers + interactions (search hero, chips, compare tray/table)
js/app.js         — bootstrap
assets/           — SVG placeholder art per category (data URIs in seed), screenshot.png (mockup)
test/             — node --test suites for deals/geo/offers/spend/sources
```

Views (hash routing): `#/search` (home) `#/compare` `#/sell` (secondary) `#/spend` `#/alerts` `#/offers` `#/settings`.

## 5b. eBay Browse API integration design

**Why eBay:** the only major used marketplace with a free public listing-search API. eBay Developers Program → create app → get App ID (client ID) + Cert ID (client secret). No card required.

**Auth (client-credentials grant, all client-side):**
```
POST https://api.ebay.com/identity/v1/oauth2/token
Authorization: Basic base64(clientId:clientSecret)
Content-Type: application/x-www-form-urlencoded
Body: grant_type=client_credentials&scope=https://api.ebay.com/oauth/api_scope/buy.browse
→ { access_token, expires_in: 7200, token_type: "Application Access Token" }
```
Token cached in localStorage `rebuy:ebay_token` as {token, expiresAt: Date.now()+expires_in*1000−60000}. Reused until expiry; refreshed silently on next search.

**Search:**
```
GET https://api.ebay.com/buy/browse/v1/item_summary/search
  ?q={query}&limit=50&filter=price:[{min}..{max}],priceCurrency:CAD,conditions:{NEW,USED,...}
Headers: Authorization: Bearer {token}
         X-EBAY-C-MARKETPLACE-ID: EBAY_CA   (user picks CA/US in Settings)
→ { itemSummaries: [{ itemId, title, price{value,currency}, condition,
     image{imageUrl}, itemWebUrl, itemLocation{city,country},
     seller{username,feedbackScore,feedbackPercentage}, itemCreationDate }] }
```

**Normalization (adapter.js contract):**
```
{ id, source:'ebay'|'rebuy', title, price, currency, condition: like-new|good|fair|parts,
  image, url, location:{label, lat?, lng?}, distanceKm?, listedAt,
  seller:{name, rating?, verified?}, newPrice?, year?, category? }
```
eBay condition map: "New"/"Open box"→like-new; "Certified - Refurbished"/"Excellent - Refurbished"→like-new; "Used"/"Good - Refurbished"→good; "For parts or not working"→parts; default good. eBay location usually city-only → distanceKm null → "distance n/a" (never filtered out by radius).

**Demo mode (no key):** `demoResults(query)` — seeded PRNG from query string → 6–10 plausible listings (query-derived titles, varied prices/conditions, Canadian cities, SVG art). Results carry `demo:true`; UI banner: "Demo results — add your free eBay key in Settings for live listings." Never errors, never empty.

**Rate-limit respect:** debounce search input 400ms; cache results per normalized query 10 min (memory); single token for the session.

## 5d. Google Programmable Search adapter design (external tier 2)

**Why:** eBay alone doesn't cover Kijiji/FB/Craigslist/OfferUp (no public APIs). The Google Custom Search JSON API (free 100 queries/day, no card) + a user-created Programmable Search Engine (PSE) restricted to marketplace domains (kijiji.ca, craigslist.org, facebook.com/marketplace, offerup.com, gumtree.com…) gives *title + snippet + link* results across those sites. Good enough for the "Also listed on" comparison panel; not structured enough for Deal Scores (no prices) — prices are scraped from snippets opportunistically ("$250" regex), scored only when found, else shown unscored.

**Auth:** plain API key + engine ID in the query string (no OAuth):
```
GET https://www.googleapis.com/customsearch/v1
  ?key={API_KEY}&cx={ENGINE_ID}&q={query}&num=10&gl=ca&lr=lang_en
→ { items: [{ title, link, snippet, pagemap?: { cse_thumbnail?: [{src}] } }] }
```
Keys stored in localStorage `rebuy:gse_keys` {apiKey, engineId}; nothing else is needed.

**Normalization:** source label derived from link domain ("kijiji.ca"→"Kijiji", "facebook.com"→"Facebook", "craigslist.org"→"Craigslist", "offerup.com"→"OfferUp", else domain root). `condition` → null ("not stated"), `price` → snippet price-regex or null, `distanceKm` → null. `url` = item link (opens in new tab).

**Quota handling:** HTTP 429 → throw/flag `{quota:true}`. UI catches it, silently drops to deep links with a small note "External results paused — quota." Also cache results per normalized query in memory for 30 min (CSE's 100/day is tight; debounced input + cache keeps us well under).

**Demo mode (no key):** seeded mock snippets (query-derived titles, domain labels, prices from seeded PRNG), `demo:true`, panel banner: "Demo results — add your free Google key in Settings for live cross-marketplace results." Never errors, never empty.

**New bugs + mitigations (append to §7):**
| Google CSE quota (100/day free) exhausted | 429 → silent deep-link fallback + "external results paused — quota" note; 30-min in-memory cache per query; search input debounced 600ms on this tier |
| CSE snippet price regex misfires ("$250" in prose) | price only used for sorting when regex finds a leading "$NNN" near the title; otherwise null → unscored row, no badge |
| CSE results stale / not local | label says "web results, not distance-checked" — never claim proximity for tier-2 results |
| Deep-link URL formats change per platform | central DEEP_LINKS table, one place to fix; links open in new tab with rel=noopener |

## 5c. Deal score v2 (cross-source)

```
dealInfo(item, ctx):
  if item.newPrice:  absolute path (original formula vs fairPrice)
  else:              relative path — median = median(prices of current result set)
                     score = clamp(0..100, round(75 + 75*(1 − price/median)))
                     label suffix "vs similar listings"
tiers unchanged: ≥85 Great deal (sage) · 60–84 Fair (amber) · <60 Overpriced (clay-deep)
```
Rationale: on aggregated results the moat is *comparability* — a ThinkPad at $280 next to five others at $340+ should score well even without a new-retail reference.

## 6. Deal-score formula

```
ageYears  = max(0, currentYear - year)
deprRate  = { electronics:.25, phones:.25, computers:.25, cameras:.18, consoles:.20,
              bikes:.12, furniture:.15, appliances:.15, instruments:.12, other:.15 }[category]
floorF    = 0.15
fairPrice = newPrice * max(floorF, (1 - deprRate)^ageYears) * condMult
condMult  = { like-new:1.0, good:0.9, fair:0.75, parts:0.4 }[condition]
// local comp adjustment (needs ≥3 sold comps in category):
if comps>=3: fairPrice = 0.7*fairPrice + 0.3*median(comps)
ratio     = price / fairPrice
score     = clamp(0..100, round(75 + 75*(1 - ratio)))
// price==fair → 75 · 20% below → 90 · 20% above → 60 · 50% below → 100 · 50% above → 38
tiers: ≥85 "Great deal" (sage) · 60–84 "Fair" (amber) · <60 "Overpriced" (clay-deep)
```

**Haggle math:**
```
typicalDiscount = { electronics:.12, phones:.12, computers:.12, cameras:.12, consoles:.10,
                    bikes:.10, furniture:.15, appliances:.15, instruments:.12, other:.12 }
suggestedOffer  = round5(price * (1 - typicalDiscount))
sellerGuide     = round5(fairPrice * 1.08)   // "list here; expect to settle near $fairPrice within a week"
// auto thresholds per listing (seeded): autoAcceptAt = round5(fairPrice*0.97), autoDeclineBelow = round5(fairPrice*0.80)
```

**Spend math:** purchases[] {pricePaid, newRef, dateISO, category} → last30d sum; monthly buckets "YYYY-MM"; dynamic ranges (≥6mo→6M, ≥12→1Y, ≥60→5Y, always MAX); savedVsNew = Σ(newRef − pricePaid); K/M axis formatting.

**Geo:** Haversine km; beta radius 25; default center Sudbury ON (46.4917, −80.9930); geolocation with deny-fallback + manual override.

## 7. Likely bugs + mitigations

| Bug | Mitigation |
|---|---|
| localStorage schema drift breaks old saves | Versioned key `rebuy:v1`; migrate-or-reseed on version mismatch |
| Geolocation denied / slow | 8s timeout → Sudbury fallback + persistent notice + manual override control |
| Listings exactly at 25.0 km flicker in/out | Epsilon: include ≤ 25.05 km; distance shown rounded to 0.1 |
| Canvas charts on HiDPI blur | Scale by devicePixelRatio |
| Notification permission denied | Fall back to in-app toast + alerts inbox; never nag |
| Photo file inputs with huge images | Downscale via canvas to ≤1200px, JPEG 0.8, before storing as data URL |
| `$1` placeholder prices gaming sort | Validate: price ≥ $5 on post; flag existing $1 prices in seed (none) |
| XSS via listing titles/descriptions | All user content rendered through escapeHtml; never innerHTML with raw input |
| AudioContext autoplay policy | Create/resume context on first user gesture only |
| Node tests vs browser globals | Engine modules are UMD (module.exports guard); no window/document references |
| eBay API CORS blocked in browser | Try direct fetch; on CORS/network failure fall back to demo mode with honest notice ("Live eBay unreachable from this browser — showing demo results"). Documented, never a dead end |
| eBay token endpoint failure / bad key | Catch, show inline Settings error ("Couldn't reach eBay — check your App ID and secret"), stay in demo mode |
| eBay rate limits (5k calls/day free) | Debounce 400ms, 10-min result cache per query, one token per session |
| eBay items lack year/newPrice | Relative deal-score path (vs result-set median); badge labeled honestly |
| Secrets in localStorage | It's the user's own free eBay key on their own device; documented as such; never transmitted anywhere except api.ebay.com |

## 8. Non-goals (v1)

Real backend, accounts/login, real payments/escrow, in-app chat (offers are structured instead), photo AI (title/desc helpers are template-based), i18n, shipping flow (local meetup only).

## 9. QA plan

`node --check` every JS file; `node --test test/` — suites for deals (score tiers, boundaries, comp blending), geo (Haversine known distances, radius filter, epsilon), offers (suggestion math, auto accept/decline/counter), spend (bucketing, dynamic ranges, 30d sum, savings). Manual: no live browser here — DOM paths code-reviewed; smoke test recommended after Pages deploy.
