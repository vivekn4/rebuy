# Rebuy — Team Pass PLAN

*Pass date: 2026-10-15. Scope: the live site at https://vivekn4.github.io/rebuy/ (repo `vivekn4/rebuy`).*
*North star: `workspace/.jarvis/workflow-runs/workflow-run-f59045dac9b74e08afb13be86a1a57bf/work/VISION.md` — the bar every team signs off against.*
*This plan supersedes the 2026-10-14 build plan (preserved in git history). This pass adds things; it does not rebuild the app.*

---

## 1. User story

Maya in Sudbury wants a used bike for her kid before winter. She opens Rebuy on her phone, taps the search bar, types "bike". Within seconds she sees real eBay listings with actual product photos, Rebuy listings near her, a single "Best value" pick at the top with a plain reason ("$120 below the going rate"), and a location pill that says "Within 25 km of Sudbury, ON". She taps a listing, messages the seller, and sees a calm note: *Rebuy never takes a cut — you pay the seller in person.*

She has a question — "Is it really free?" — so she taps the small chat bubble in the corner. The answer appears instantly, plain and short. She taps "Save this search as an alert" so she gets pinged when a cheaper bike shows up. She comes back because Rebuy found her something good and tells her when something better appears.

That's the whole pass: make that story true, every screen, every label, no fakery.

---

## 2. Scope limits

**IN for this pass:**
1. FAQ chatbot widget: local knowledge base answers instantly (works offline), free Pollinations text API as fallback with a Rebuy-scoped system prompt. No keys in the repo, no paid anything.
2. Location model: 25 km default radius around the user's location/Sudbury, a radius selector (10 / 25 / 50 / 100 km), honest location pill that reflects the actual filter. Sudbury-only beta — never pretend to cover other cities.
3. Verify the three just-shipped improvements on the live site: real eBay thumbnails after the one-tap `#ebay-setup` flow, the Best Value spotlight hero, the Sudbury-area filter toggle with its graceful empty state.
4. Delete `frag-test.html` from the repo root (temporary diagnostic page — must not ship).
5. Full QC loop and verified pushes to the live site (one file per push, each verified).

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

## 3. Per-team deliverables

### 3.1 UI/UX team (Design Lead, UX Designer, Visual Designer)

**Chatbot widget:**
- Small bottom-right bubble (terracotta, Lora or quiet glyph — never an emoji), ≥44px tap target.
- Expands to a calm cream panel (~340px, bottom-sheet on phone) with: header ("Rebuy help"), message list, quick-answer chips ("How does Rebuy work?", "Is it free?", "Safe meetup tips", "Turn on live eBay"), text input + send.
- Does NOT cover purchase actions or the Compare tray on a 360px screen. z-index below modals is wrong; above content but tucked. Test at 360×740.
- Typing indicator: minimal, no sound. Offline state: plain text — *"I'm offline right now — here are quick answers"* with the quick chips still tappable.
- All copy human-made: short, neighborly, zero AI-tell vocabulary.

**Radius selector + location pill:**
- Selector near the search bar or in the location pill itself: 10 / 25 / 50 / 100 km, default 25.
- Pill copy always reflects reality: *"Within 25 km of Sudbury, ON"* — updates when the user changes the radius or when geolocation falls back (*"Rebuy is in beta around Sudbury, ON — showing Sudbury-area listings"* for off-Sudbury users).
- Changing the radius re-runs the current search. The "Beta: showing items within 25 km" badge must use the live value, not a hardcoded string.

**Retention UX (with the retention team):**
- One-tap "Alert me" on every results page (saved search → in-app alert). This is the #1 retention driver; it must be impossible to miss and trivial to tap.
- Chatbot quick chips double as discovery: "Turn on live eBay" leads to Settings `#ebay-setup`.

### 3.2 Dev team (Tech Lead, Frontend Dev, Integrations Engineer)

**Chatbot (`js/chatbot.js`, new):**
- Tier 1 — local KB: ~12 FAQs as plain string-matched Q&A (normalizer: lowercase, strip punctuation, keyword scoring). Answers for: how Rebuy works, zero commission, is it free, safe in-person meetups (reference the seeded meetup spots: Greater Sudbury Police HQ lobby, New Sudbury Centre food court), turning on live eBay (`#/settings`, `#ebay-setup` link), alerts, selling on Rebuy, search radius, what Rebuy covers (Sudbury only). Instant, synchronous, works offline.
- Tier 2 — Pollinations fallback: `POST https://text.pollinations.ai/` with a system prompt constraining it to Rebuy help topics; instructions: never invent listings, prices, features, or locations; never claim coverage beyond Sudbury; defer to the seller or Settings when unsure; off-topic questions get one polite redirect sentence. Timeout 12s; on failure, say so plainly and offer the quick chips. No retries that hang a spinner.
- Sanitize every rendered answer (escapeHtml path — same rule as listing titles). No raw innerHTML from model output.
- Widget mounted from `app.js` on all views. Respect `prefers-reduced-motion` (instant panel, no slide).

**Location (touch `js/geo.js`, `js/ui.js`):**
- Expose `setRadiusKm()` in geo/store; persist to localStorage (`rebuy:v1` settings).
- Radius selector UI wired to it; changing re-runs the current search with the new radius.
- The location pill and "Beta" badge read the live radius value.
- Keep the existing geolocation flow: 8s timeout → Sudbury fallback with an honest notice; manual override stays.

**Fixes from the review (already confirmed in code, verify + tighten):**
- Best Value hero: add a plain-language reason line ("$120 below the going rate for this condition") next to the badge; keep it honestly labeled when all results are demo (it must not look like a live pick).
- Sudbury-area eBay filter: toggle present, empty state present ("No Sudbury-area eBay listings for this search" + "Show all Canadian results"). Verify on live: real thumbnails after `#ebay-setup`, secret stripped from the URL bar, keys only in localStorage.
- `frag-test.html`: delete from repo root, push, confirm the live URL 404s.

### 3.3 QC team (QA Lead, QA Engineer, Compatibility Tester)

- `node --check` every JS file; `node --test test/` must stay green.
- Extend `test-harness/journeys.js`: chatbot open → ask Tier-1 question → assert instant local answer (no network); ask unknown question → assert Pollinations fallback path or graceful offline message; change radius 25→50→10 → assert pill text and result counts change; Sudbury toggle on/off → assert filter + empty state; Best Value hero renders with a reason line above results.
- Live-site verification (the actual bar): homepage, results, compare, settings, chatbot open/ask/close — all with zero console errors at https://vivekn4.github.io/rebuy/.
- Mobile checks: 360px wide, Android-relevant: widget doesn't cover actions, radius selector tappable, compare tray slides under the widget correctly.
- `frag-test.html` gone from repo AND live 404.
- axe-core pass in a real browser (flagged earlier as hand-to-parent — do it now via the browser route).
- html-validate clean after the new DOM.

### 3.4 Retention team (Retention Lead, Lifecycle Marketer, Community Writer)

- Ranked drivers: (1) alerts/saved searches, (2) trust (honest labels), (3) deal scores that were right, (4) Spend tab ("you saved $340 vs. buying new"), (5) chatbot (a 2-second answer saves a session).
- Deliverable: the one-tap "Alert me" interaction copy + empty-state copy ("Nothing here yet — we'll ping you when a $150 bike lands in your radius") and the alert notification microcopy. Quiet, rare, useful — no streaks, no badges, no guilt.
- Chatbot content: write the 12 Tier-1 FAQ answers in the human-made voice (short sentences, no AI tells, reads like a helpful neighbor). Own the system prompt's honesty rules.
- Post-ship: note which retention driver each change serves in the ship report.

### 3.5 Specialists (Marketplace Analyst, Trust & Safety)

- Marketplace Analyst: confirm the deep-link table (`js/sources/deeplinks.js`) is still accurate; verify the eBay demo/live labeling logic; spot-check that demo cards carry the "Demo" pill and live cards don't.
- Trust & Safety: review seller-messaging copy and meetup safety content (Police HQ lobby / New Sudbury Centre suggestions), confirm zero-commission wording sits beside purchase actions, confirm no key material is anywhere in the repo or commits (`git grep` for cert/app-id patterns), confirm the chatbot cannot be tricked into giving meetup advice beyond public safety basics.

### 3.6 Integrator + Release Manager

- Integrator merges all team branches into one coherent tree; resolves conflicts in `ui.js` (router) and `styles.css` (tokens only — palette is locked).
- Release Manager pushes via the GitHub connector `push_files`, ONE file per call (multi-file payloads hang — verified lesson), verifies each with `get_file_contents`, then confirms the live site reflects the change. Final live-site smoke: search "bike" end-to-end on a phone-width viewport, chatbot ask, radius change, `#ebay-setup` present and functional.

---

## 4. Likely bugs + mitigations

| Bug | Mitigation |
|---|---|
| Chatbot panel covers the Compare tray / purchase buttons on 360px screens | Panel is a bottom sheet that sits above content but below modal layer; explicit overlap test in journeys; manual check at 360×740 |
| Pollinations slow or unreachable → spinner hangs | 12s timeout; Tier 1 always works offline; failure message is plain text + quick chips, never an endless spinner |
| Radius change doesn't re-run the search (stale results, wrong pill) | Selector dispatches through the same search path as typing; pill reads the live radius value; journey asserts pill text changes 25→50→10 |
| Radius below 25 shows hardcoded "Beta: showing items within 25 km" | Badge text uses the live radius variable; grep after build for the hardcoded string |
| Best Value hero picks a demo listing and reads like a live recommendation | Hero carries the same tier label as its source (Demo pill / "live" note) + plain-language reason; never shown above live results without the label |
| Geolocation denied → app silently shows Sudbury as "near you" | Fallback keeps the honest label: "showing Sudbury-area listings", not "near you" |
| Chatbot invents a listing, price, or city | System prompt forbids it; Tier-1 KB has no prices; model output is escaped and reviewed in QC; honesty rule: "I don't know — ask the seller / check Settings" |
| Off-topic question gets a full AI answer (scope creep) | System prompt: one polite redirect sentence, no full conversations |
| XSS via chatbot answers (model output rendered as HTML) | All answers through the escapeHtml path; never innerHTML with model text |
| `frag-test.html` still reachable after removal | Delete from repo root, push, curl the live URL and confirm 404 before sign-off |
| One-file pushes raced / a file didn't land | Verify every push with `get_file_contents`; Release Manager re-fetches the live page for the final smoke |
| eBay secret lingers in the URL after `#ebay-setup` | Existing strip logic re-verified on live: after saving, the hash is removed from the address bar; keys only in localStorage |
| Chatbot widget re-triggers sound.js | Sound stays off by default; chatbot has no audio, no exceptions |

---

## 5. Timeline

| Phase | What | Owner |
|---|---|---|
| 1 — Plan sign-off | This PLAN.md accepted; vision bar confirmed | Producer → all teams |
| 2 — Build | Chatbot (`js/chatbot.js` + KB copy), radius selector + pill, hero reason line, `frag-test.html` deletion | UI/UX, Dev, Retention (copy) |
| 3 — Integrate | Merge into one tree; token/palette check; conflict resolution in `ui.js`/`styles.css` | Integrator |
| 4 — QC | Unit tests green, journeys extended and green, html-validate clean, axe-core in real browser, 360px manual pass | QC team |
| 5 — Ship | One-file pushes, each verified; live smoke (search, chatbot, radius, `#ebay-setup`, zero console errors) | Release Manager |
| 6 — Greenlight | Every team votes against the 9-point gate (§7 of VISION.md); unanimous or it doesn't ship | All |

**Standing rules for the pass:** one-file pushes via the GitHub connector; human-made copy everywhere (read it aloud — if it sounds like a model, rewrite); nothing is shown to the user until every crew member gives their green light.
