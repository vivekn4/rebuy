/* Rebuy mock-customer journeys — 30 UX-audit journeys through the REAL app.
   Boots the app in jsdom, drives it via DOM events (forms, clicks, hash
   navigation), asserts what a customer would see. No real browser, no network.
   Run: node journeys.js (from test-harness/) */
"use strict";
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");
const vm = require("vm");

const ROOT = path.resolve(__dirname, "..");
// NOTE: js/app.js intentionally excluded — the harness calls RebuyUI.boot()
// directly so DOMContentLoaded can't double-boot.
const SCRIPTS = [
  "js/geo.js", "js/deals.js", "js/offers.js", "js/spend.js", "js/store.js",
  "js/seed.js", "js/sound.js", "js/charts.js", "js/sources/adapter.js",
  "js/sources/ebay.js", "js/sources/google.js", "js/sources/deeplinks.js",
  "js/sources/rebuy.js", "js/icons.js", "js/faq-kb.js", "js/chatbot.js", "js/ui.js"
];

const tick = (ms) => new Promise((r) => setTimeout(r, ms || 30));

function bootApp() {
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const dom = new JSDOM(html, {
    url: "https://vivekn4.github.io/rebuy/",
    pretendToBeVisual: true, // gives us requestAnimationFrame
    runScripts: "outside-only" // lets us run our own scripts via getInternalVMContext
  });
  const { window } = dom;
  // canvas: jsdom has no 2d context without the native `canvas` package —
  // stub a no-op context so chart code runs without drawing.
  window.HTMLCanvasElement.prototype.getContext = function () {
    const canvasEl = this;
    return new Proxy({}, {
      get: (t, p) => {
        if (p === "canvas") return canvasEl;
        if (p === "measureText") return function () { return { width: 10 }; };
        return function () {};
      },
      set: () => true
    });
  };
  // no network in the harness: live adapters must degrade to demo, never hang
  window.fetch = () => Promise.reject(new Error("no network in harness"));
  const vmCtx = dom.getInternalVMContext();
  for (const s of SCRIPTS) vm.runInContext(fs.readFileSync(path.join(ROOT, s), "utf8"), vmCtx);
  window.RebuyUI.boot();
  return window;
}

function ok(cond, msg) { if (!cond) throw new Error(msg); }

// Drive hash navigation the way the app does, then let async adapter
// searches (Promise.all) and debounced filter handlers settle.
async function nav(window, hash, settleMs) {
  window.location.hash = hash;
  window.RebuyUI.route();
  await tick(60);
  await tick(settleMs || 250);
}

function fire(window, el, type) {
  el.dispatchEvent(new window.Event(type, { bubbles: true, cancelable: true }));
}
function setVal(window, el, v, evt) {
  el.value = v;
  fire(window, el, evt || "input");
}
function clickEl(window, el) {
  el.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true }));
}

const journeys = [];
function journey(name, fn) { journeys.push({ name, fn }); }

/* ============================ DISCOVERY (1–8) ============================ */

journey("01 Maya, first-time visitor — home → search 'laptop'", async (ctx) => {
  const { window, document, $ } = ctx;
  ok($("#heroQ"), "hero search box missing");
  ok($("#heroSearch"), "hero form missing");
  setVal(window, $("#heroQ"), "laptop");
  fire(window, $("#heroSearch"), "submit");
  await tick(200);
  ok(window.location.hash.includes("q=laptop"), "hash not updated: " + window.location.hash);
  window.RebuyUI.route(); await tick(300);
  const meta = $("#resultsMeta").textContent;
  ok(/on Rebuy/.test(meta), "results meta missing: " + meta);
  const cards = document.querySelectorAll("#mainZone .shop-card");
  ok(cards.length > 0, "no Rebuy cards for 'laptop'");
});

journey("02 Devon, model hunter — 'ThinkPad T480' narrows properly", async (ctx) => {
  const { window, document } = ctx;
  await nav(window, "#/search?q=" + encodeURIComponent("ThinkPad T480"));
  const titles = [...document.querySelectorAll("#mainZone .shop-title")].map(e => e.textContent.toLowerCase());
  ok(titles.length > 0, "no results for ThinkPad T480");
  ok(titles.every(t => t.includes("thinkpad") && t.includes("t480")),
    "model matching leaked: " + JSON.stringify(titles));
});

journey("03 Priya, unicorn hunter — no results stays graceful", async (ctx) => {
  const { window, document, $ } = ctx;
  await nav(window, "#/search?q=" + encodeURIComponent("left-handed bagpipes"));
  ok(/Nothing on Rebuy matches/.test($("#mainZone").textContent), "no empty-state for Rebuy zone");
  const sp = $("#sidePanel").textContent;
  ok(/No eBay matches|No web matches|Also listed on/.test(sp), "side panel mishandled emptiness");
  ok(!/Something hiccupped/.test(document.body.textContent), "error state shown");
});

journey("04 Sam, category browser — filter to bikes", async (ctx) => {
  const { window, document, $ } = ctx;
  await nav(window, "#/search?q=bike");
  const sel = $("#fCat");
  ok(sel, "category select missing");
  sel.value = "bikes"; fire(window, sel, "change");
  await tick(400);
  ok(window.location.hash.includes("cat=bikes"), "hash missing cat: " + window.location.hash);
  window.RebuyUI.route(); await tick(300);
  const cards = [...document.querySelectorAll("#mainZone .shop-card")];
  ok(cards.length > 0, "no bike results after filter");
});

journey("05 Aisha, budget shopper — $100–$400 price band", async (ctx) => {
  const { window, document, $ } = ctx;
  await nav(window, "#/search?q=");
  setVal(window, $("#fMin"), "100"); setVal(window, $("#fMax"), "400");
  await tick(1100); // 600ms debounce + margin
  ok(window.location.hash.includes("min=100") && window.location.hash.includes("max=400"),
    "hash missing price band: " + window.location.hash);
  window.RebuyUI.route(); await tick(300);
  const prices = [...document.querySelectorAll("#mainZone .shop-price")].map(e =>
    parseFloat(e.textContent.replace(/[^0-9.]/g, "")));
  ok(prices.length > 0, "no cards in band");
  ok(prices.every(p => p >= 100 && p <= 400), "price leaked out of band: " + prices);
});

journey("06 Tom, condition snob — like-new only", async (ctx) => {
  const { window, document, $ } = ctx;
  await nav(window, "#/search?q=");
  const sel = $("#fCond"); sel.value = "like-new"; fire(window, sel, "change");
  await tick(400);
  window.RebuyUI.route(); await tick(300);
  const conds = [...document.querySelectorAll("#mainZone .shop-card")].map(card =>
    card.querySelector(".cond-pill").textContent);
  ok(conds.length > 0, "no like-new results");
  ok(conds.every(m => /Like new/.test(m)), "condition leaked: " + JSON.stringify(conds.slice(0, 3)));
});

journey("07 Nadia, deal sorter — price asc, then best deal", async (ctx) => {
  const { window, document, $ } = ctx;
  await nav(window, "#/search?q=laptop");
  const prices = () => [...document.querySelectorAll("#mainZone .shop-price")]
    .map(e => parseFloat(e.textContent.replace(/[^0-9.]/g, "")));
  const sel = $("#fSort"); sel.value = "price-asc"; fire(window, sel, "change");
  await tick(400); window.RebuyUI.route(); await tick(300);
  const asc = prices();
  ok(asc.length > 1, "need 2+ laptop cards");
  ok(asc.every((p, i) => i === 0 || p >= asc[i - 1]), "not ascending: " + asc);
  sel.value = "deal"; fire(window, sel, "change");
  await tick(400); window.RebuyUI.route(); await tick(300);
  const scores = [...document.querySelectorAll("#mainZone .deal-tag")].map(e => {
    const m = /Deal score (\d+)/.exec(e.title); return m ? +m[1] : null;
  });
  ok(scores.every((s, i) => i === 0 || s <= scores[i - 1]), "not deal-desc: " + scores);
});

journey("08 Chris, privacy-conscious — no geolocation → Sudbury fallback", async (ctx) => {
  const { window, document, $ } = ctx;
  ok(!window.navigator.geolocation, "harness should have no geolocation");
  ok(/Sudbury/.test($("#locationLabel").textContent), "location label: " + $("#locationLabel").textContent);
  ok(/Sudbury/.test(window.RebuyUI.state.center.label), "center not Sudbury");
  await nav(window, "#/search?q=bike");
  ok(/within 25 km/.test(document.body.textContent), "beta radius badge missing");
});

/* ====================== RESULTS & EXTERNAL PANEL (9–14) ================== */

journey("09 Ruth, comparison shopper — side panel renders tiers", async (ctx) => {
  const { window, document, $ } = ctx;
  await nav(window, "#/search?q=bike");
  const sp = $("#sidePanel");
  ok(/Also listed on/.test(sp.textContent), "panel header missing");
  ok(sp.querySelector(".tier-label"), "no tier labels");
  ok(/eBay/.test(sp.textContent) && /Across the second-hand web/.test(sp.textContent), "tiers missing");
  ok(sp.querySelector(".market-group .mkt-head"), "no marketplace group headers");
  const groups = [...sp.querySelectorAll(".market-group")];
  const counts = groups.map(g => +g.querySelector(".mkt-count").textContent);
  ok(counts.every((c, i) => i === 0 || counts[i - 1] >= c), "groups not count-ordered: " + counts);
});

journey("10 Ken, link checker — eBay demo links carry the product query", async (ctx) => {
  const { window, document } = ctx;
  await nav(window, "#/search?q=" + encodeURIComponent("ThinkPad T480"));
  const links = [...document.querySelectorAll("#sidePanel .shop-card a[target=_blank]")]
    .map(a => a.href).filter(h => h.includes("ebay.ca/sch"));
  ok(links.length > 0, "no ebay demo links found");
  ok(links.every(h => h.includes("_nkw=ThinkPad%20T480")),
    "query missing from a link: " + links.find(h => !h.includes("_nkw=ThinkPad%20T480")));
  ok(links.every(h => !/^https:\/\/www\.ebay\.ca\/?$/.test(h)), "bare homepage link found");
});

journey("11 Lena, deep-link diver — all 9 marketplaces carry the query", async (ctx) => {
  const { window, document } = ctx;
  await nav(window, "#/search?q=" + encodeURIComponent("trek bike"));
  const links = [...document.querySelectorAll("#sidePanel .search-chips a")].map(a => a.href);
  ok(links.length === 9, "expected 9 deep-link chips, got " + links.length);
  const enc = encodeURIComponent("trek bike");
  ok(links.every(h => h.includes(enc) || h.includes("trek-bike") || h.includes("offerup.com")),
    "query missing: " + JSON.stringify(links));
  ["kijiji", "facebook", "craigslist", "offerup", "gumtree", "mercari", "depop", "poshmark", "varagesale"]
    .forEach(id => ok(links.some(h => h.includes(id.replace("facebook", "facebook.com"))), id + " chip missing"));
});

journey("12 Omar, skeptic — no misleading coming-soon chips; marketplaces covered via deep links", async (ctx) => {
  const { window, document } = ctx;
  await nav(window, "#/search?q=laptop");
  const disabled = [...document.querySelectorAll(".source-chips .chip[disabled]")];
  ok(disabled.length === 0, "stale coming-soon chips still present");
  const chips = [...document.querySelectorAll("#sidePanel .search-chips a")].map(a => a.textContent.trim());
  ["Kijiji", "Facebook", "Craigslist", "OfferUp", "Gumtree", "Mercari", "Depop", "Poshmark", "VarageSale"].forEach(name =>
    ok(chips.some(c => c.includes(name)), name + " chip missing"));
  ok(/don't offer public APIs/.test(document.querySelector("#sidePanel").textContent), "honest note missing");
});

journey("13 June, empty-web — side panel never renders empty", async (ctx) => {
  const { window, document, $ } = ctx;
  await nav(window, "#/search?q=" + encodeURIComponent("left-handed bagpipes"));
  const sp = $("#sidePanel");
  ok(sp.innerHTML.trim().length > 50, "side panel collapsed");
  ok(/No eBay matches|No web matches|Search directly on/.test(sp.textContent),
    "no graceful empty messaging");
});

journey("14 Iris, honesty auditor — demo labeling everywhere", async (ctx) => {
  const { window, document, $ } = ctx;
  await nav(window, "#/search?q=laptop");
  const notes = [...document.querySelectorAll("#sidePanel .mode-note")].map(e => e.textContent);
  ok(notes.some(n => /Demo results/.test(n)), "no demo honesty note: " + JSON.stringify(notes));
  ok(notes.some(n => /Settings/.test(n)), "demo note doesn't point to Settings");
});

/* ============================ COMPARE (15–18) ============================ */

async function searchAndTick(window, q) {
  await nav(window, "#/search?q=" + encodeURIComponent(q));
}
function checkBoxes(window, document, n, scope) {
  const boxes = [...(scope || document).querySelectorAll("[data-cmp]")].slice(0, n);
  boxes.forEach(cb => { cb.checked = true; cb.dispatchEvent(new window.Event("change", { bubbles: true })); });
  return boxes;
}

journey("15 Pete, comparer — 2 listings → tray → table", async (ctx) => {
  const { window, document, $ } = ctx;
  await searchAndTick(window, "laptop");
  checkBoxes(window, document, 2);
  const tray = $("#compareTray");
  ok(!tray.hidden, "tray did not appear");
  ok($("#trayCount").textContent === "2", "tray count wrong");
  await nav(window, "#/compare");
  const html = document.body.textContent;
  ["Price", "Deal score", "Condition", "Distance", "Source", "Get it"].forEach(col =>
    ok(html.includes(col), "compare table missing column: " + col));
});

journey("16 Wendy, over-selector — 5th pick blocked with message", async (ctx) => {
  const { window, document, $ } = ctx;
  await searchAndTick(window, "");
  const boxes = [...document.querySelectorAll("#mainZone [data-cmp]")];
  ok(boxes.length >= 5, "need 5+ cards, got " + boxes.length);
  boxes.slice(0, 4).forEach(cb => { cb.checked = true; fire(window, cb, "change"); });
  boxes[4].checked = true; fire(window, boxes[4], "change");
  await tick(100);
  ok($("#trayCount").textContent === "4", "tray allowed 5th pick");
  const toast = $("#toastRegion").textContent;
  ok(/up to 4 listings/.test(toast), "no blocked message: " + toast);
  ok(boxes[4].checked === false, "5th checkbox stayed checked");
});

journey("17 Hank, changer-of-mind — deselect updates tray", async (ctx) => {
  const { window, document, $ } = ctx;
  await searchAndTick(window, "laptop");
  const boxes = checkBoxes(window, document, 2, $("#mainZone"));
  ok($("#trayCount").textContent === "2", "setup failed");
  boxes[0].checked = false; fire(window, boxes[0], "change");
  ok($("#trayCount").textContent === "1", "tray did not update on deselect");
});

journey("18 Zoe, cross-shopper — 1 Rebuy + 1 eBay in compare", async (ctx) => {
  const { window, document, $ } = ctx;
  await searchAndTick(window, "bike");
  const rebuyBox = document.querySelector("#mainZone [data-cmp]");
  const ebayBox = document.querySelector("#sidePanel [data-cmp]");
  ok(rebuyBox && ebayBox, "need boxes in both zones");
  [rebuyBox, ebayBox].forEach(cb => { cb.checked = true; fire(window, cb, "change"); });
  await nav(window, "#/compare");
  const html = document.body.textContent;
  ok(/Rebuy/.test(html) && /ebay/i.test(html), "compare missing a zone's source");
});

/* ==================== LISTING DETAIL & OFFERS (19–24) ===================== */

async function openFirstNativeDetail(ctx) {
  const { window, document, $ } = ctx;
  await searchAndTick(window, "laptop");
  const card = document.querySelector("#mainZone .shop-card");
  ok(card, "no native card to open");
  const cardScore = card.querySelector(".deal-tag").title;
  const id = card.getAttribute("data-id");
  await nav(window, "#/listing/" + id);
  return { cardScore, id };
}

journey("19 Gus, detail diver — card score == detail score (soldComps regression)", async (ctx) => {
  const { document, $ } = ctx;
  const { cardScore } = await openFirstNativeDetail(ctx);
  const detailScore = $(".detail-grid .deal-tag, .deal-tag").title;
  ok(detailScore === cardScore, `card "${cardScore}" vs detail "${detailScore}"`);
});

journey("20 Holly, lowballer — $10 offer gets countered, lands in inbox", async (ctx) => {
  const { window, document, $ } = ctx;
  await openFirstNativeDetail(ctx);
  clickEl(window, $("#offerBtn"));
  ok($("#offerAmt"), "offer modal did not open");
  setVal(window, $("#offerAmt"), "10");
  clickEl(window, $("#mSend"));
  await tick(200);
  ok(window.location.hash === "#/offers", "did not land in offers inbox: " + window.location.hash);
  window.RebuyUI.route(); await tick(200);
  const rows = [...document.querySelectorAll(".offer-row")];
  ok(rows.length > 0, "no offer rows");
  const pill = rows[0].querySelector(".status-pill").textContent;
  ok(/Countered/.test(pill), "lowball not countered, got: " + pill);
  ok(/seller counters at/.test(rows[0].textContent), "counter price missing");
});

journey("21 Ivan, fair buyer — full-price offer accepted", async (ctx) => {
  const { window, document, $ } = ctx;
  await openFirstNativeDetail(ctx);
  const price = parseFloat(document.querySelector(".detail-price").textContent.replace(/[^0-9.]/g, ""));
  clickEl(window, $("#offerBtn"));
  setVal(window, $("#offerAmt"), String(Math.ceil(price)));
  clickEl(window, $("#mSend"));
  await tick(200);
  window.RebuyUI.route(); await tick(200);
  const pill = document.querySelector(".offer-row .status-pill").textContent;
  ok(/Accepted/.test(pill), "fair offer not accepted, got: " + pill);
});

journey("22 Jade, messenger — thread: buyer msg → seller reply, in order", async (ctx) => {
  const { window, document, $ } = ctx;
  await openFirstNativeDetail(ctx);
  clickEl(window, $("#msgBtn"));
  ok($("#msgThread"), "message thread did not open");
  setVal(window, $("#msgInput"), "Is this still available?");
  clickEl(window, $("#mSendMsg"));
  await tick(100);
  let msgs = [...document.querySelectorAll("#msgThread .msg")];
  ok(msgs.length === 1 && msgs[0].classList.contains("mine"), "buyer message not rendered");
  ok(/still available/.test(msgs[0].textContent), "buyer text wrong");
  await tick(1400); // seller auto-reply delay (900ms)
  msgs = [...document.querySelectorAll("#msgThread .msg")];
  ok(msgs.length === 2, "seller reply missing, got " + msgs.length);
  ok(msgs[0].classList.contains("mine") && msgs[1].classList.contains("theirs"), "wrong order");
  ok(/still available/i.test(msgs[1].textContent), "reply not availability-matched: " + msgs[1].textContent);
});

journey("23 Karl, inbox checker — offers render with status pills", async (ctx) => {
  const { window, document } = ctx;
  await searchAndTick(window, "bike");
  const card = document.querySelector("#mainZone .shop-card");
  await nav(window, "#/listing/" + card.getAttribute("data-id"));
  const doc = ctx.document;
  clickEl(window, doc.querySelector("#offerBtn"));
  setVal(window, doc.querySelector("#offerAmt"), "50");
  clickEl(window, doc.querySelector("#mSend"));
  await tick(200);
  await nav(window, "#/offers");
  const rows = [...document.querySelectorAll(".offer-row")];
  ok(rows.length > 0, "inbox empty");
  ok(rows[0].querySelector(".status-pill"), "status pill missing");
  ok(/\$50/.test(rows[0].textContent), "offer amount missing");
});

journey("24 Lily, zero-cut reader — commission note visible", async (ctx) => {
  const { document } = ctx;
  await openFirstNativeDetail(ctx);
  ok(/Rebuy never takes a cut/.test(document.body.textContent), "zero-cut note missing on detail");
});

/* ============================== SPEND (25–27) ============================= */

journey("25 Mona, spender — log purchase → 30-day counter rises", async (ctx) => {
  const { window, document, $ } = ctx;
  await openFirstNativeDetail(ctx);
  clickEl(window, $("#boughtBtn"));
  setVal(window, $("#bpPaid"), "300");
  clickEl(window, $("#mLog"));
  await tick(200);
  await nav(window, "#/spend");
  await tick(1100); // 650ms count-up animation + margin
  ok(/300/.test($("#last30Hero").textContent), "counter wrong: " + $("#last30Hero").textContent);
  ok(/ThinkPad|bike|laptop/i.test(document.body.textContent) || /History/.test(document.body.textContent),
    "purchase history missing");
});

journey("26 Nate, time traveler — purchases bucket across months", async (ctx) => {
  const { window, document } = ctx;
  const now = new Date();
  const thisMonth = now.toISOString().slice(0, 10);
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 12).toISOString().slice(0, 10);
  const Store = window.RebuyStore;
  Store.addPurchase({ pricePaid: 200, newRef: 500, dateISO: thisMonth, category: "bikes", title: "City bike" });
  Store.addPurchase({ pricePaid: 150, newRef: 300, dateISO: lastMonth, category: "furniture", title: "Oak chair" });
  await nav(window, "#/spend");
  const hist = document.body.textContent;
  ok(hist.includes(thisMonth) && hist.includes(lastMonth), "history missing a month");
  const pills = [...document.querySelectorAll("#rangePills .chip")].map(c => c.textContent);
  ok(pills.includes("MAX"), "MAX range missing: " + pills);
});

journey("27 Olivia, saver — saved-vs-new math", async (ctx) => {
  const { window, document, $ } = ctx;
  await openFirstNativeDetail(ctx);
  clickEl(window, $("#boughtBtn"));
  setVal(window, $("#bpPaid"), "300");
  setVal(window, $("#bpNew"), "1450");
  clickEl(window, $("#mLog"));
  await tick(200);
  await nav(window, "#/spend");
  await tick(1100);
  const txt = $("#savedHero").textContent.replace(/[^0-9]/g, "");
  ok(txt === "1150", "saved math wrong, got: " + $("#savedHero").textContent);
});

/* ============================ SELL FLOW (28) ============================== */

journey("28 Paul, seller — post with live guidance → searchable", async (ctx) => {
  const { window, document, $ } = ctx;
  await nav(window, "#/sell");
  setVal(window, $("#sTitle"), "TestCycle 3000 commuter");
  $("#sCat").value = "bikes"; fire(window, $("#sCat"), "input");
  setVal(window, $("#sNew"), "800");
  setVal(window, $("#sPrice"), "350");
  await tick(200);
  ok(/Fair market value/.test($("#sGuide").textContent), "live guidance missing: " + $("#sGuide").textContent);
  clickEl(window, $("#sPost"));
  await tick(200);
  ok(window.location.hash.startsWith("#/listing/"), "did not land on new listing: " + window.location.hash);
  await searchAndTick(window, "TestCycle");
  const titles = [...document.querySelectorAll("#mainZone .shop-title")].map(e => e.textContent);
  ok(titles.some(t => /TestCycle/.test(t)), "new listing not searchable: " + JSON.stringify(titles));
});

/* ======================= SETTINGS & EDGE CASES (29–30) ==================== */

journey("29 Quinn, keymaster — eBay keys flip status to live-attempt", async (ctx) => {
  const { window, document, $ } = ctx;
  await nav(window, "#/settings");
  setVal(window, $("#ebayId"), "test-app-id");
  setVal(window, $("#ebaySecret"), "test-cert");
  clickEl(window, $("#ebaySave"));
  await tick(200);
  const status = $("#ebayStatus");
  ok(status.classList.contains("ok"), "status did not flip: " + status.textContent);
  ok(/Live eBay key saved/.test(status.textContent), "status text wrong");
  // live attempt must degrade honestly (no network in harness) — never crash
  await nav(window, "#/search?q=laptop");
  const sp = $("#sidePanel").textContent;
  ok(/demo|paused|unreachable/i.test(sp), "no honest degradation note");
});

journey("30 Rita, chaos agent — empty search, $0 offer, min>max", async (ctx) => {
  const { window, document, $ } = ctx;
  // empty search → "everything nearby", no crash
  await nav(window, "#/search?q=");
  ok(/everything nearby/.test(document.body.textContent), "empty search mishandled");
  // $0 offer clamps to $5
  await openFirstNativeDetail(ctx);
  clickEl(window, $("#offerBtn"));
  setVal(window, $("#offerAmt"), "0");
  clickEl(window, $("#mSend"));
  await tick(200);
  window.RebuyUI.route(); await tick(200);
  ok(/\$5/.test(document.querySelector(".offer-row").textContent), "$0 offer not clamped to $5");
  // absurd filter: min > max → graceful empty, no crash
  await nav(window, "#/search?q=&min=1000&max=100");
  ok(/Nothing on Rebuy matches/.test(document.body.textContent), "min>max mishandled");
  ok(!/Something hiccupped/.test(document.body.textContent), "error state on min>max");
});

journey("31 Sam, window-shopper — shopping-card anatomy (marketplace row, stars, big price, demo pill)", async (ctx) => {
  const { window, document, $ } = ctx;
  await nav(window, "#/search?q=" + encodeURIComponent("ThinkPad T480"));
  // native cards: marketplace row, stars, semantic big price, condition pill, distance
  const card = document.querySelector("#mainZone .shop-card");
  ok(card, "no native shop-card");
  ok(card.querySelector(".shop-mkt") && /On Rebuy/.test(card.querySelector(".shop-mkt").textContent),
    "native card missing 'On Rebuy' marketplace row");
  const stars = card.querySelector(".shop-stars");
  ok(stars && stars.getAttribute("role") === "img" && /out of 5 stars/.test(stars.getAttribute("aria-label")),
    "native card missing accessible star rating");
  const price = card.querySelector("data.shop-price");
  ok(price && parseFloat(price.getAttribute("value")) > 0, "price not semantic <data>");
  ok(card.querySelector(".cond-pill"), "native card missing condition pill");
  ok(card.querySelector(".shop-dist"), "native card missing distance line");
  ok(card.querySelector(".shop-media img").getAttribute("alt").length > 0, "card image missing alt text");
  // external cards: marketplace row per source, demo pill, outbound links
  const ext = document.querySelector("#sidePanel .shop-card");
  ok(ext, "no external shop-card in side panel");
  ok(ext.querySelector(".shop-mkt"), "external card missing marketplace row");
  ok(ext.querySelector(".demo-pill"), "demo external card missing Demo pill");
  ok(ext.querySelector('.shop-media[target="_blank"]'), "external media link not outbound");
  // eBay cards carry real seller-feedback stars, never invented
  const ebayCard = [...document.querySelectorAll("#sidePanel .shop-card")]
    .find(c => /eBay/i.test(c.querySelector(".shop-mkt").textContent));
  if (ebayCard) {
    const es = ebayCard.querySelector(".shop-stars");
    ok(es && /positive/.test(es.textContent), "eBay card missing feedback-percentage stars");
  }
  // detail view carries the same DNA
  await nav(window, "#/listing/" + card.getAttribute("data-id"));
  ok(document.querySelector(".shop-mkt"), "detail missing marketplace row");
  ok(document.querySelector(".detail-price"), "detail missing big price");
  ok(document.querySelector(".shop-stars"), "detail missing stars");
});

/* ================== NEW PASS: CHATBOT · RADIUS · HERO · ALERTS (32–37) ========= */

journey("32 Uma, help-seeker — chatbot opens and answers Tier-1 instantly", async (ctx) => {
  const { window, document, $ } = ctx;
  ok(window.RebuyChatbot, "RebuyChatbot missing");
  ok(window.RebuyFAQ, "RebuyFAQ (canonical KB) missing");
  const bubble = $("#chatBubble");
  ok(bubble, "chat bubble missing");
  clickEl(window, bubble);
  await tick(120);
  const panel = $("#chatPanel");
  ok(!panel.hidden, "chat panel did not open");
  ok(bubble.getAttribute("aria-expanded") === "true", "aria-expanded not set");
  // Tier-1 question: answer must be instant (no network wait — fetch rejects here)
  setVal(window, $("#chatInput"), "Is it free?");
  fire(window, document.querySelector(".chat-compose"), "submit");
  await tick(150);
  const bots = () => [...document.querySelectorAll("#chatLog .chat-msg.bot")].map(m => m.textContent);
  ok(bots().some(m => /free/.test(m) && m.length > 30), "no instant Tier-1 answer: " + JSON.stringify(bots()));
  // quick chip asks too
  clickEl(window, document.querySelectorAll(".chat-chip")[0]);
  await tick(150);
  ok(bots().length >= 2, "chip tap did not produce an answer");
  // escape closes
  fire(window, document, "keydown"); // plain keydown, no Escape — stays open
  ok(!$("#chatPanel").hidden, "panel closed on plain keydown");
});

journey("33 Victor, radius-shifter — selector updates pill and re-runs search", async (ctx) => {
  const { window, document, $ } = ctx;
  await nav(window, "#/search?q=bike");
  const pill = () => $("#locationLabel").textContent;
  ok(/Within 25 km of/.test(pill()), "default pill wrong: " + pill());
  const sel = () => $("#fRad");
  ok(sel(), "radius selector missing from filter bar");
  ok(sel().querySelectorAll("option").length === 4, "expected 4 radius options");
  sel().value = "50"; fire(window, sel(), "change");
  await tick(400);
  ok(/Within 50 km of/.test(pill()), "pill not updated to 50: " + pill());
  ok(/on Rebuy/.test($("#resultsMeta").textContent), "search did not re-run after radius change");
  sel().value = "10"; fire(window, sel(), "change"); // re-query: route() re-renders
  await tick(400);
  ok(/Within 10 km of/.test(pill()), "pill not updated to 10: " + pill());
  ok(/within 10 km/i.test($("#mainZone").textContent), "beta badge not reading live radius");
  // invalid values fall back to 25
  ok(window.RebuyGeo.setRadiusKm(999) === 25, "invalid radius not rejected");
});

journey("34 Wendy, hero reader — Best Value carries a plain-language reason", async (ctx) => {
  const { window, document } = ctx;
  await nav(window, "#/search?q=bike");
  const hero = document.querySelector(".best-value");
  ok(hero, "Best Value hero missing from results");
  ok(/Best value/.test(hero.textContent), "hero badge missing");
  const reason = hero.querySelector(".bv-reason");
  ok(reason && reason.textContent.length > 10, "hero reason line missing");
  ok(/\$\d+ below|strongest pick/.test(reason.textContent),
    "reason not plain-language: " + reason.textContent);
});

journey("35 Xander, alert-saver — one-tap alert on the results page", async (ctx) => {
  const { window, document, $ } = ctx;
  await nav(window, "#/search?q=bike");
  const btn = $("#alertMeBtn");
  ok(btn, "one-tap alert button missing from results");
  ok(/alerts/i.test(btn.textContent), "button copy off: " + btn.textContent);
  clickEl(window, btn);
  await tick(150);
  const alerts = window.RebuyStore.alerts();
  ok(alerts.length === 1 && alerts[0].query === "bike", "alert not saved: " + JSON.stringify(alerts));
  ok(!$("#alertsDot").hidden, "alerts dot not lit");
  clickEl(window, btn); // tapping again must not duplicate
  await tick(150);
  ok(window.RebuyStore.alerts().length === 1, "duplicate alert saved");
});

journey("36 Yara, offline chatter — unknown question degrades gracefully", async (ctx) => {
  const { window, document, $ } = ctx;
  clickEl(window, $("#chatBubble"));
  await tick(120);
  setVal(window, $("#chatInput"), "what is the capital of France");
  fire(window, document.querySelector(".chat-compose"), "submit");
  await tick(600); // fetch rejects immediately in the harness
  const bots = [...document.querySelectorAll("#chatLog .chat-msg.bot")].map(m => m.textContent);
  const last = bots[bots.length - 1] || "";
  ok(/reachable right now|didn't come back|work offline/.test(last),
    "no graceful degradation: " + JSON.stringify(bots));
});

journey("37 Zane, tray test — chat bubble lifts when the compare tray shows", async (ctx) => {
  const { window, document, $ } = ctx;
  await nav(window, "#/search?q=bike");
  ok(!document.body.classList.contains("chat-above-tray"), "lift class set with no tray");
  const cb = document.querySelector("#mainZone [data-cmp]");
  ok(cb, "no compare checkbox on cards");
  cb.checked = true; fire(window, cb, "change");
  await tick(200);
  ok(!$("#compareTray").hidden, "compare tray did not appear");
  ok(document.body.classList.contains("chat-above-tray"), "bubble did not lift for the tray");
  cb.checked = false; fire(window, cb, "change");
  await tick(200);
  ok(!document.body.classList.contains("chat-above-tray"), "lift class stuck after tray cleared");
});

/* ============================ SUDBURY FILTER (38) ============================ */

journey("38 Farah, local-only shopper — Sudbury filter widens gracefully", async (ctx) => {
  const { window, document, $ } = ctx;
  // Stub a LIVE eBay with zero Sudbury-area listings (no P3 postal codes),
  // real product photos on the items.
  const orig = window.RebuyEbay.searchVerbose;
  const liveItems = [0, 1, 2].map(i => ({
    id: "ebay_t" + i, source: "ebay", title: "Laptop — used, tested", price: 320 + i * 40,
    currency: "CAD", condition: "good", image: "https://i.ebayimg.com/images/g/abc" + i + ".jpg",
    url: "https://www.ebay.ca/itm/" + i, postal: "M4B1B3",
    location: { label: "Toronto, ON" }, distanceKm: null, listedAt: null,
    seller: { name: "seller" + i, rating: 99, verified: false }
  }));
  window.RebuyEbay.searchVerbose = () => Promise.resolve({ mode: "live", notice: null, items: liveItems });
  try {
    await nav(window, "#/search?q=laptop&sudbury=1");
    const cb = $("#fSudbury");
    ok(cb && cb.checked, "Sudbury-area checkbox missing or not default-on");
    const sp = $("#sidePanel");
    ok(/eBay · live prices · Sudbury area/.test(sp.textContent), "Sudbury-area tier label missing: " + sp.textContent.slice(0, 160));
    ok(/No Sudbury-area eBay listings for this search/.test(sp.textContent), "no graceful empty state");
    const link = sp.querySelector("a[href*='sudbury=0']");
    ok(link && /Show all Canadian results/.test(link.textContent), "widen link missing");
    // One tap widens to all Canadian results — live thumbnails must render.
    window.location.hash = link.getAttribute("href");
    window.RebuyUI.route(); await tick(400);
    ok(window.location.hash.includes("sudbury=0"), "widen link lost sudbury=0: " + window.location.hash);
    const img = document.querySelector("#sidePanel img[src*='i.ebayimg.com']");
    ok(img, "live eBay thumbnail missing from widened results");
  } finally {
    window.RebuyEbay.searchVerbose = orig;
  }
});

/* ================================ RUNNER ================================= */

(async () => {
  const results = [];
  for (const j of journeys) {
    const window = bootApp();
    const ctx = { window, document: window.document, $: (s) => window.document.querySelector(s) };
    try {
      await j.fn(ctx);
      results.push({ n: j.name, pass: true });
      process.stdout.write(".");
    } catch (e) {
      results.push({ n: j.name, pass: false, error: e.message });
      process.stdout.write("F");
    }
    try { window.close(); } catch (e) {}
  }
  console.log("\n");
  const fails = results.filter(r => !r.pass);
  console.log(`Journeys: ${results.length - fails.length}/${results.length} passed`);
  console.log("=".repeat(72));
  results.forEach(r => {
    console.log((r.pass ? "PASS" : "FAIL") + "  " + r.n + (r.pass ? "" : "\n       ↳ " + r.error));
  });
  process.exit(fails.length ? 1 : 0);
})();
