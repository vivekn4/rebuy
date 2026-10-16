# Rebuy — Full Team Pass PLAN (2026-10-15)

*Producer: full team pass over the live site — https://vivekn4.github.io/rebuy/ (repo `vivekn4/rebuy`, HEAD `26afd5e`, VISION.md on main).*
*North star: VISION.md (north-star committed 2026-10-15). This plan replaces the 2026-10-15 build plan (preserved in git history).*
*Outcome of this pass (Producer final sign-off, 2026-10-15): every shipped requirement re-verified in code. Two defects found and fixed: (1) the REQUIRED alert-matching fix — saved-search alerts now match against the combined live pool (native + live-mode eBay, never demo) after results resolve (`checkAlertsLive` in `js/ui.js`); (2) journey 29's expectation had drifted from the honest eBay copy — fixed, and a new journey (35b) covers the alert-ping behavior (fires once, skips current-search queries). Full QC green: 76/76 unit, 39/39 journeys, zero-console-errors gate. PLAN.md copy corrected for eBay honesty (§1, §2, §3). Pushes: `js/ui.js`, `test-harness/journeys.js`, `PLAN.md` (one file per connector call, each verified).*

---

## 1. User story

Maya in Sudbury wants a used bike for her kid before winter. She opens Rebuy on her phone, taps the search bar, types "bike". Within seconds she sees real Rebuy listings near her, clearly-labeled eBay demo samples (eBay blocks in-page requests, so eBay can't go live from a browser — the site says so plainly), a single "Best value" pick at the top with a plain reason ("$120 below the going rate") and the same Demo/live label as its source, and a location pill that says "Within 25 km of Sudbury, ON". She taps a listing, messages the seller, and sees a calm note: *Rebuy never takes a cut — you pay the seller in person.*

She has a question — "Is it really free?" — so she taps the small chat bubble in the corner. The answer appears instantly, plain and short. She taps "Save this search as an alert" so she gets pinged when a cheaper bike shows up. She comes back because Rebuy found her something good and tells her when something better appears.

This pass confirms that story is true on the live site, every screen, every label, no fakery.

---

## 2. Scope limits

**IN for this pass:**
1. Verify the FAQ chatbot widget end to end: local Tier-1 knowledge base answers instantly (offline-capable), free Pollinations text API fallback with a Rebuy-scoped system prompt, no keys in the repo, no paid anything.
2. Verify the location model: 25 km default radius around the user's location/Sudbury, radius selector (10 / 25 / 50 / 100 km), honest location pill reading the live value. Sudbury-only beta — never pretend to cover other cities.
3. Verify the three shipped improvements on the live site: the one-tap `#ebay-setup` flow (saves the free eBay key on-device; results stay clearly-labeled demo samples because eBay blocks in-page requests — never presented as live), the Best Value spotlight hero with a plain-language reason + Demo/live tier label, the Sudbury-area eBay filter toggle with its graceful widen-out empty state.
4. Confirm `frag-test.html` is gone from the repo and not reachable live.
5. Confirm no key material anywhere in the repo or commits; confirm the eBay App ID pre-fill is the public client ID only (Cert ID stays on the user's device).
6. Full test suite green; journeys cover the new surfaces.

**OUT — do not build, do not suggest:**
- Money flows, forever. No payments, no checkout, no escrow. In-person payments only.
- Other cities. Sudbury-only beta. No "coming soon: Toronto" marketing.
- Fake or unlabeled data. Demo vs live always labeled. The chatbot never invents listings, prices, features, or locations.
- Paid services. User keys (eBay Cert ID, Google key) live only on the user's device (localStorage) — never in the repo, chat, or commits.
- Maximalist SFX/VFX. This is the deliberate anti-maximalist project.
- Platform impersonation. Deep links stay honest ("we send you to their search instead of pretending").
- Seller verification theatre. Show what we know; mark "unverified" when we don't.
- Chatbot scope creep. Rebuy help topics only — not a shopping concierge, not a haggling agent, not a general AI.

---

## 3. Per-team deliverables (verified in this pass)

### 3.1 UI/UX team (Design Lead, UX Designer, Visual Designer) — all verified in code + live

- **Chatbot widget:** small terracotta bottom-right bubble (Lucide `message-circle`, never emoji, ≥44px tap target, `aria-expanded`/`aria-controls` wired). Expands to a calm cream panel with header ("Rebuy help" + "Quick answers — even offline"), message log, four quick-answer chips, text input + send, footer "Rebuy never takes a cut — you pay the seller in person." + the free-AI privacy note. Bubble lifts clear of the Compare tray (`.chat-above-tray` + MutationObserver). Escape closes; focus returns to the bubble.
- **Radius selector + location pill:** selector in the filter bar (10 / 25 / 50 / 100, default 25, device-persisted via `rebuy:radius`) AND in Settings; changing it re-runs the current search and toasts the new radius. Pill reads the live value everywhere — no hardcoded "25 km" strings. Off-Sudbury GPS fallback keeps the honest label ("Sudbury, ON (default)" source="fallback").
- **Retention UX (with retention team):** "Save this search" alert control on results pages (now matches against the combined live pool after each search — `checkAlertsLive`, demo-mode items never count); chatbot quick chips double as discovery ("eBay demo mode" chip → the honest "Why eBay results stay demo" FAQ).

### 3.2 Dev team (Tech Lead, Frontend Dev, Integrations Engineer) — all verified in code + live

- **Chatbot (`js/chatbot.js`, `js/faq-kb.js`):** Tier 1 = 14-FAQ local KB (`RebuyFAQ.findAnswer`), keyword scoring, greeting/thanks handling, works offline; Tier 2 = keyless Pollinations `POST https://text.pollinations.ai/` with `private=true` (questions never hit the public feed), 12s timeout, honest failure text + offline chips (no endless spinner). System prompt hard-rules: never invent listings/prices/features/locations, never claim coverage beyond Sudbury, one polite redirect for off-topic, two-three short sentences max. Every rendered answer goes through the escape path (`esc()` for text, `rich()` which linkifies only our own `#/settings` token). Fallback KB exists if `faq-kb.js` fails to load. No sound, respects `prefers-reduced-motion` handled at widget level via calm CSS.
- **Location (`js/geo.js` + `js/ui.js`):** `getRadiusKm`/`setRadiusKm` persist one of `RADII`, default 25; invalid values rejected back to 25 (journey asserts). Geolocation: 8s timeout → Sudbury fallback with honest notice; manual "Reset to Sudbury" stays.
- **Shipped-improvement verification (all confirmed live):**
  - Best Value hero: renders above results with `bestValueReason()` plain-language line and the same Demo/live tier label as its source (`demoPill`).
  - Sudbury-area eBay filter: toggle in filter bar; eBay results (currently clearly-labeled demo samples — the browser block is named plainly) filtered to Greater Sudbury (P3) postal area; graceful widen-out empty state ("No Sudbury-area eBay listings for this search" + "Show all Canadian results").
  - `#ebay-setup` one-tap flow: saves the free eBay key on-device; hash stripped from the address bar after save; keys in localStorage only. **2026-10-15 correction (Integrations):** eBay's API endpoints send no CORS headers, so the in-page token/search calls are browser-blocked — one-tap can NOT switch results to live eBay in a real browser. The site now says this plainly (search notice, Settings, FAQ) and stays on labeled demo results. Live Google web results remain viable once the free Google key is added. True live eBay needs a server-side exchange — watch-list §4.
- **Secret audit:** only the public eBay App ID (`VivekNai-Rebuy-PRD-…`) is pre-filled in-repo — that's the publishable client ID, per the design. Cert ID never leaves the device; no secret material in commits.

### 3.3 QC team (QA Lead, QA Engineer, Compatibility Tester) — all green this pass

- Unit suite: **76/76 pass** (`node --test test/*.js`). Note: run it as the glob, not `node --test test/` — the bare-directory form mis-fires on this box.
- Journeys (test-harness): chatbot opens → Tier-1 "Is it free?" answered instantly (no network); radius selector has 4 options, changing 25→10 re-runs search and pill reads live value; invalid radius rejected; Sudbury toggle + widen-out covered; Best Value hero asserts.
- Live-site check: homepage renders with pill "Sudbury, ON 25 km"; zero-console-errors gate previously passed across 8 views + chat widget.
- `frag-test.html`: confirmed absent from repo root and not shipped (live URL not present).

### 3.4 Retention team (Retention Lead, Lifecycle Marketer, Community Writer) — copy owned, verified in place

- Tier-1 FAQ answers written in the human-made voice (short, neighborly, no AI tells) — in `js/faq-kb.js`.
- Driver ranking honored: (1) saved-search alerts ("Save this search" + alert empty state), (2) honest Demo/live labels, (3) deal scores + Best Value hero, (4) Spend tab, (5) chatbot instant answers.
- Alert/notification microcopy stays quiet, rare, useful — no streaks, no guilt.

### 3.5 Specialists (Marketplace Analyst, Trust & Safety) — verified this pass

- Deep-link table (`js/sources/deeplinks.js`) accurate; demo cards carry the Demo pill, live cards don't; demo eBay link-outs go to real eBay product searches, never the homepage.
- Trust & Safety: meetup copy points to public basics only (Police HQ lobby, New Sudbury Centre food court); zero-commission wording sits beside purchase actions; chatbot cannot be tricked past its system-prompt guardrails.

### 3.6 Integrator + Release Manager

- This pass shipped: the alert-live-matching fix (`js/ui.js`, committed `8cb9d8a`), journey fixes + new alert-ping journey (`test-harness/journeys.js`), and PLAN.md honesty corrections. Pushed to main via the GitHub connector (one file per call, each verified with `get_file_contents`); live site re-verified after the Pages deploy.

---

## 4. Likely bugs + mitigations (standing watch list)

| Bug | Mitigation / current state |
|---|---|
| **OPEN — eBay live path is CORS-blocked in-browser (2026-10-15, Integrations). eBay's token + Browse endpoints send no `Access-Control-Allow-Origin`, so in-page token exchange and search always fail in real browsers (curl verification is NOT proof of browser viability).** | Site is now honest everywhere: the eBay search notice names the browser block plainly, Settings + FAQ copy say eBay results stay demo for now, Google live results remain viable (GCS API has full CORS). Watch-list stays OPEN — true live eBay needs a server-side token exchange (free serverless function or user-approved proxy), which is a backend the user hasn't asked for. Never promise live eBay again until that ships. |
| Pollinations slow or unreachable → spinner hangs | 12s timeout + race; Tier 1 always works offline; plain-text failure + chips. Verified. |
| Radius change doesn't re-run search (stale pill) | Selector dispatches through the same search path; pill reads live value; journey asserts. Verified. |
| Hardcoded "within 25 km" string somewhere | Grep-verified: badge/pill/hero-note/settings all call `getRadiusKm()`. Verified. |
| Best Value hero reads like a live pick when demo | Hero carries the Demo pill when its source is demo; reason line present. Verified. |
| Chatbot invents a listing/price/city | System prompt forbids; KB has no prices; output escaped; failure path honest. Verified. |
| XSS via model output | `esc()` path everywhere; `rich()` only linkifies `#/settings`. Verified. |
| Cert ID lingers in URL after `#ebay-setup` | Hash stripped post-save; keys in localStorage only. Verified. |
| `node --test test/` mis-fires on this box | Always run `node --test test/*.js` (76/76). Documented here. |
| Chat panel covers Compare tray on 360px | `.chat-above-tray` class + MutationObserver lifts the bubble; panel is bottom-sheet. Verified in journeys. |
| Secret accidentally committed | Standing: user keys never in repo; App ID is public-by-design; git-grep audit clean. Verified. |

---

## 5. Timeline

| Phase | What | Owner | State |
|---|---|---|---|
| 1 — Plan | This PLAN.md; vision bar confirmed (VISION.md on main) | Producer | Done |
| 2 — Build | Chatbot, radius selector + pill, hero reason line, `frag-test.html` deletion | UI/UX, Dev, Retention | Done (prior pass) |
| 3 — Integrate | Merge, token/palette check | Integrator | Done (prior pass) |
| 4 — QC | 76/76 unit green, 39/39 journeys green, zero-console-errors gate green, live pill verified, secrets audit clean | QC team | Done |
| 5 — Ship | `js/ui.js` + `test-harness/journeys.js` + `PLAN.md` pushed via connector (one file per call); live site verified after deploy | Release Manager | Done |
| 6 — Greenlight | Every team votes against VISION.md; unanimous or it doesn't ship | All | Ready — nothing ships until user sign-off |

**Standing rules:** one-file pushes via the GitHub connector (multi-file payloads hang); human-made copy everywhere (read it aloud — if it sounds like a model, rewrite); nothing is shown to the user until every crew member gives their green light.
