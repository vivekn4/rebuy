# Rebuy — VISION.md

**North-star for this crew pass · 2026-10-15 · Vision Director**

Rebuy is a "Kayak for used goods" for Sudbury, Ontario. One search, every
used listing compared side by side, the true deal made obvious. In-person,
zero commission, honest about what it shows.

---

## 1. What success looks like for a Sudbury second-hand shopper

A Sudbury shopper opens Rebuy looking for a used bike, a snowblower, a couch.
Within a minute she should be able to answer three questions:

1. **What is near me, right now?** — live deals within her radius (default
   25 km), distances shown honestly, Sudbury-only for now, never implying
   coverage anywhere else.
2. **Is it a good deal?** — every listing carries a deal score that a normal
   person can understand ("$120 below the going rate"), and the single best
   value-for-money pick sits at the top of the results with its reasoning in
   plain language.
3. **Can I trust this?** — demo listings are clearly labeled Demo, live
   listings are labeled Live with real photos, link-outs say exactly where
   they go, and the price, condition, and seller details come from the real
   marketplace page — never invented by Rebuy.

Success is the shopper closing the tab knowing exactly which listing to chase
and where to meet the seller — and trusting Rebuy enough to come back the
next time she wants something used.

## 2. Why she comes back (retention is a feature)

- **Saved-search alerts.** She saves a search once; Rebuy watches and pings
  her gently when a matching listing lands. No spam, ever. This is the #1
  reason to return.
- **The chatbot is a concierge, not a toy.** Quick help when she's stuck —
  how to set up live eBay, whether Rebuy takes a cut, where to meet safely
  in Sudbury — instant answers offline, a free AI fallback online, never a
  hallucinated price or listing.
- **Her radius, her choice.** Default 25 km; a simple selector (10/25/50/100)
  to widen when she wants. The site always says what radius and area it is
  showing.
- **Selling is easy and free.** A photo, a fair price suggestion, live in
  seconds for Sudbury shoppers. Zero commission, so sellers keep everything.

## 3. The bar every team must clear (acceptance criteria)

- **Calm, human-made design.** Cream/sage/terracotta, quiet interactions,
  mobile-first (Android). No maximalist SFX/VFX. Copy reads like a helpful
  neighbour wrote it — no AI-tell vocabulary in UI, docs, or chat answers.
- **Honest data, always.** Demo vs live is labeled everywhere, never faked.
  Real listings labeled; link-outs honest. If a feature is a sample, the
  page says so.
- **Sudbury-first, stated.** 25 km beta radius around Sudbury, ON. Every
  location pill, hero note, and empty state says exactly what area is shown.
  A GPS fix far from Sudbury falls back to honest "Sudbury-area listings"
  copy — never a fake "near you".
- **Zero commission, in-person only.** Never touch money flows. No delivery
  or shipping claims anywhere (chat, KB, copy, empty states).
- **Free only.** No paid APIs or keys. User keys (eBay, Google) live on the
  user's device only — never in the repo, chat, or commits. The chatbot's
  free-AI tier uses the keyless Pollinations text API (`private=true`),
  12 s timeout, and degrades to an honest offline message — never a silent
  stall.
- **Stack discipline.** Vanilla JS, no build step, GitHub Pages. Pushes via
  the GitHub connector, one file per call, each verified.

## 4. This pass — required outcomes

1. **FAQ chatbot widget** — calm, on-brand, mounted on every view. Tier 1:
   instant local KB answers (works offline). Tier 2: keyless Pollinations
   text API with a Rebuy-scoped system prompt for anything else. Quick-topic
   chips, one-tap link to Settings, clear privacy note.
2. **Location done right** — 25 km default from the user's location, radius
   selector, Sudbury-only labeling everywhere, honest empty states.
3. **Three shipped improvements verified live** — live eBay thumbnails via
   the one-tap `#ebay-setup` link (real product photos), the Best Value
   spotlight hero at the top of results, and the Sudbury-area-only eBay
   filter toggle with its graceful widen-out empty state.
4. **Repo hygiene** — no diagnostic/temporary pages (`frag-test.html`
   removed), full test suite + zero-console-errors gate green, fixes pushed
   and verified on the live site.

## 5. Explicitly OUT of scope

- Anything outside Sudbury for now — no multi-city coverage, no "near you"
  claims beyond the honest beta radius.
- Accounts, payments, shipping, escrow — in-person cash/e-transfer only.
- Listing guarantees: Rebuy never vouches for a seller's honesty, item
  condition, or availability beyond what the marketplace page shows.
- The chatbot never invents listings, prices, features, or locations, and
  answers non-Rebuy topics with one polite redirect.
- No paid services, no API keys in the repo, no build tooling.
- No reviving scrapped projects or touching other channels — Rebuy only.

---

**Verdict line for this pass:** a Sudbury shopper searches, trusts what she
sees, finds the best deal fast, and comes back because Rebuy watched the
search for her. Everything else is polish.
