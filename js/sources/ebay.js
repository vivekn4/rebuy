/* Rebuy eBay adapter — live Browse API + clearly-labeled demo mode.
   Live mode needs the user's free eBay App ID + Cert ID in Settings (localStorage).
   Demo mode: seeded mock results, never errors, never empty. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.RebuyEbay = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var TOKEN_URL = "https://api.ebay.com/identity/v1/oauth2/token";
  var API = "https://api.ebay.com/buy/browse/v1";
  var SCOPE = "https://api.ebay.com/oauth/api_scope"; // base app scope for the
  // client-credentials grant (verified 2026-10-15: requesting
  // api_scope/buy.browse here returns invalid_scope; the base scope is what
  // authorizes Browse API application tokens)
  var KEY_KEY = "rebuy:ebay_keys";   // {clientId, clientSecret, marketplace}
  var TOKEN_KEY = "rebuy:ebay_token"; // {token, expiresAt}

  // Pre-configured public client ID for the Rebuy production keyset (created
  // 2026-10-15). The App ID / client ID is a public identifier — safe to ship;
  // the Cert ID (client secret) is never stored here and lives only on the
  // user's own device (localStorage) once connected.
  var DEFAULT_CLIENT_ID = "VivekNai-Rebuy-PRD-81d2ad8ad-27635e5b";

  function lsGet(k) { try { return typeof localStorage !== "undefined" ? localStorage.getItem(k) : null; } catch (e) { return null; } }
  function lsSet(k, v) { try { if (typeof localStorage !== "undefined") localStorage.setItem(k, v); } catch (e) {} }
  function lsDel(k) { try { if (typeof localStorage !== "undefined") localStorage.removeItem(k); } catch (e) {} }

  function getKeys() {
    try {
      var k = JSON.parse(lsGet(KEY_KEY) || "null");
      if (k && k.clientId) return k;
    } catch (e) {}
    // App ID pre-configured; Cert ID still needed from the user (one-tap setup
    // link or Settings) before live mode activates.
    return { clientId: DEFAULT_CLIENT_ID, clientSecret: "", marketplace: "EBAY_CA" };
  }
  function saveKeys(clientId, clientSecret, marketplace) {
    lsSet(KEY_KEY, JSON.stringify({ clientId: clientId, clientSecret: clientSecret, marketplace: marketplace || "EBAY_CA" }));
    lsDel(TOKEN_KEY);
  }
  function clearKeys() { lsDel(KEY_KEY); lsDel(TOKEN_KEY); }
  function hasKeys() { var k = getKeys(); return !!(k && k.clientId && k.clientSecret); }
  function marketplace() { var k = getKeys(); return (k && k.marketplace) || "EBAY_CA"; }

  // One-tap setup: a link like <site>/#ebay-setup=<base64url JSON> carries
  // {clientId, clientSecret, marketplace}. On boot we save it to this device's
  // localStorage and strip it from the URL immediately (history.replaceState —
  // the secret never hits the network in the fragment). Returns true when a
  // setup payload was consumed.
  function consumeSetupFragment() {
    try {
      if (typeof location === "undefined" || !location.hash) return false;
      var m = /^#ebay-setup=([A-Za-z0-9\-_]+=*)$/.exec(location.hash);
      if (!m) return false;
      var b64 = m[1].replace(/-/g, "+").replace(/_/g, "/");
      while (b64.length % 4) b64 += "="; // atob throws on unpadded input in some browsers
      var json = (typeof atob !== "undefined" ? atob : function (s) { return Buffer.from(s, "base64").toString("utf8"); })(b64);
      var o = JSON.parse(json);
      if (o && o.clientId && o.clientSecret) {
        saveKeys(o.clientId, o.clientSecret, o.marketplace || "EBAY_CA");
        if (history && history.replaceState) history.replaceState(null, "", location.pathname + location.search);
        return true;
      }
    } catch (e) {}
    return false;
  }

  function isTokenFresh(cached, nowMs) {
    return !!(cached && cached.token && cached.expiresAt && cached.expiresAt > (nowMs || Date.now()));
  }

  function getCachedToken() {
    try { return JSON.parse(lsGet(TOKEN_KEY) || "null"); } catch (e) { return null; }
  }

  function fetchToken(clientId, clientSecret) {
    var creds = (typeof btoa !== "undefined" ? btoa : function (s) { return Buffer.from(s).toString("base64"); })(clientId + ":" + clientSecret);
    return fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Authorization": "Basic " + creds, "Content-Type": "application/x-www-form-urlencoded" },
      body: "grant_type=client_credentials&scope=" + encodeURIComponent(SCOPE)
    }).then(function (r) {
      if (!r.ok) throw new Error("eBay auth failed (HTTP " + r.status + ")");
      return r.json();
    }).then(function (j) {
      var rec = { token: j.access_token, expiresAt: Date.now() + (j.expires_in * 1000) - 60000 };
      lsSet(TOKEN_KEY, JSON.stringify(rec));
      return rec.token;
    });
  }

  function ensureToken() {
    var keys = getKeys();
    if (!keys) return Promise.reject(new Error("no-keys"));
    var cached = getCachedToken();
    if (isTokenFresh(cached)) return Promise.resolve(cached.token);
    return fetchToken(keys.clientId, keys.clientSecret);
  }

  function buildSearchUrl(query, filters) {
    filters = filters || {};
    var p = ["q=" + encodeURIComponent(query), "limit=50"];
    var f = [];
    if (filters.minPrice != null || filters.maxPrice != null)
      f.push("price:[" + (filters.minPrice || 0) + ".." + (filters.maxPrice || 100000) + "]");
    f.push("priceCurrency:" + (filters.currency || "CAD"));
    if (filters.condition && filters.condition !== "any") {
      var map = { "like-new": "NEW,OPEN_BOX", "good": "USED", "fair": "USED", "parts": "FOR_PARTS" };
      f.push("conditions:{" + (map[filters.condition] || "USED") + "}");
    }
    if (f.length) p.push("filter=" + encodeURIComponent(f.join(",")));
    return API + "/item_summary/search?" + p.join("&");
  }

  // Greater Sudbury forward sortation areas (P3A..P3Y). eBay itemLocation
  // carries a masked postal code ("P3A***") but no city, so the FSA prefix is
  // the reliable Sudbury signal.
  function isSudburyArea(it) {
    var p = (it && it.postal) || "";
    return p.indexOf("P3") === 0;
  }

  var COND_MAP = [
    [/new|open box/i, "like-new"],
    [/certified.*refurbished|excellent.*refurbished/i, "like-new"],
    [/for parts|not working/i, "parts"],
    [/used|refurbished/i, "good"]
  ];
  function mapCondition(s) {
    s = s || "";
    for (var i = 0; i < COND_MAP.length; i++) if (COND_MAP[i][0].test(s)) return COND_MAP[i][1];
    return "good";
  }

  function normalizeItem(it) {
    var price = it.price || {};
    return {
      id: "ebay_" + (it.itemId || Math.random().toString(36).slice(2)),
      source: "ebay",
      title: it.title || "Untitled listing",
      price: parseFloat(price.value) || 0,
      currency: price.currency || "CAD",
      condition: mapCondition(it.condition),
      image: (it.image && it.image.imageUrl) || "",
      url: it.itemWebUrl || "",
      location: { label: ((it.itemLocation && it.itemLocation.city) || "") + (((it.itemLocation && it.itemLocation.city) && (it.itemLocation.country)) ? ", " : "") + ((it.itemLocation && it.itemLocation.country) || "eBay") },
      postal: ((it.itemLocation && it.itemLocation.postalCode) || "").toUpperCase().replace(/\*+$/, ""),
      distanceKm: null,
      listedAt: it.itemCreationDate || null,
      seller: {
        name: (it.seller && it.seller.username) || "eBay seller",
        rating: (it.seller && it.seller.feedbackPercentage) ? parseFloat(it.seller.feedbackPercentage) : null,
        verified: false
      }
    };
  }

  // --- Demo mode: seeded, deterministic mock results ---------------------------------
  function hashStr(s) {
    var h = 2166136261;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function mulberry(seed) {
    var a = seed;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  var DEMO_CITIES = ["Sudbury, ON", "North Bay, ON", "Timmins, ON", "Sault Ste. Marie, ON", "Toronto, ON", "Ottawa, ON"];
  var DEMO_CONDS = [["like-new", "Open box"], ["good", "Used"], ["good", "Used"], ["fair", "Used"], ["parts", "For parts or not working"]];
  var DEMO_SELLERS = ["northbay_deals", "lakesidefinds", "ontario_resale", "nickelcitytech", "greatwhitegoods"];

  function demoArt(i) {
    var hues = [16, 95, 200, 280, 330];
    var h = hues[i % hues.length];
    var svg = "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 84'><rect width='100' height='84' rx='14' fill='hsl(" + h + ",30%,94%)'/><g fill='none' stroke='hsl(" + h + ",45%,45%)' stroke-width='3.5' stroke-linecap='round'><rect x='28' y='26' width='44' height='32' rx='6'/><circle cx='50' cy='42' r='6'/></g><text x='50' y='76' text-anchor='middle' font-size='9' fill='hsl(" + h + ",30%,45%)' font-family='sans-serif'>eBay demo</text></svg>";
    return "data:image/svg+xml," + encodeURIComponent(svg);
  }

  // Demo link-out: a real eBay search for the queried product, sorted by
  // price (lowest first). Honest link-outs even in demo mode.
  function demoSearchUrl(query) {
    var q = (query || "").trim();
    return "https://www.ebay.ca/sch/i.html?_nkw=" + encodeURIComponent(q) + "&_sop=15";
  }

  function demoResults(query, filters) {
    filters = filters || {};
    var rnd = mulberry(hashStr("rebuy-demo:" + (query || "").toLowerCase().trim()));
    var n = 6 + Math.floor(rnd() * 5);
    var base = 80 + Math.floor(rnd() * 700);
    var linkUrl = demoSearchUrl(query);
    var out = [];
    for (var i = 0; i < n; i++) {
      var c = DEMO_CONDS[Math.floor(rnd() * DEMO_CONDS.length)];
      var price = Math.max(15, Math.round(base * (0.55 + rnd() * 0.9)));
      if (filters.maxPrice != null && price > filters.maxPrice) continue;
      if (filters.minPrice != null && price < filters.minPrice) continue;
      out.push({
        id: "ebay_demo_" + i + "_" + hashStr(query + i).toString(36),
        source: "ebay", demo: true,
        title: capQuery(query) + " — " + c[1].toLowerCase() + pick(["", " (local pickup)", " + free shipping", " — tested & working"], rnd),
        price: price, currency: "CAD", condition: c[0],
        image: demoArt(i), url: linkUrl,
        location: { label: DEMO_CITIES[Math.floor(rnd() * DEMO_CITIES.length)] },
        distanceKm: null,
        listedAt: new Date(Date.now() - Math.floor(rnd() * 20) * 864e5).toISOString(),
        seller: { name: DEMO_SELLERS[Math.floor(rnd() * DEMO_SELLERS.length)], rating: 95 + Math.floor(rnd() * 5), verified: false }
      });
    }
    return out;
  }
  function capQuery(q) {
    q = (q || "item").trim();
    return q.charAt(0).toUpperCase() + q.slice(1);
  }
  function pick(arr, rnd) { return arr[Math.floor(rnd() * arr.length)]; }

  // --- Public search -----------------------------------------------------------------
  // Resolves { mode: 'live'|'demo', items } — never rejects with no-keys; only rejects
  // on unexpected programming errors. Live failures degrade to demo with a notice flag.
  function search(query, filters) {
    filters = filters || {};
    if (!hasKeys()) return Promise.resolve({ mode: "demo", items: demoResults(query, filters), notice: null });
    // Never throw synchronously (e.g. no fetch in the environment) — the UI
    // always gets a promise that degrades to demo.
    return Promise.resolve().then(function () { return ensureToken(); }).then(function (tok) {
      return fetch(buildSearchUrl(query, filters), {
        headers: { "Authorization": "Bearer " + tok, "X-EBAY-C-MARKETPLACE-ID": marketplace() }
      });
    }).then(function (r) {
      if (!r.ok) throw new Error("eBay search failed (HTTP " + r.status + ")");
      return r.json();
    }).then(function (j) {
      var items = ((j && j.itemSummaries) || []).map(normalizeItem);
      return { mode: "live", items: items, notice: null };
    }).catch(function (err) {
      // CORS or network or auth failure → honest demo fallback, never a dead end.
      return { mode: "demo", items: demoResults(query, filters), notice: "Live eBay unreachable (" + (err && err.message ? err.message : "network") + ") — showing demo results." };
    });
  }

  var adapter = {
    id: "ebay", label: "eBay", enabled: true,
    search: function (query, filters) {
      return search(query, filters).then(function (r) { return r.items; });
    },
    searchVerbose: search // {mode, items, notice} for UI banners
  };

  return {
    adapter: adapter, search: search, searchVerbose: search,
    normalizeItem: normalizeItem, mapCondition: mapCondition,
    demoResults: demoResults, demoSearchUrl: demoSearchUrl, buildSearchUrl: buildSearchUrl,
    isTokenFresh: isTokenFresh, getKeys: getKeys, saveKeys: saveKeys,
    clearKeys: clearKeys, hasKeys: hasKeys, marketplace: marketplace, hashStr: hashStr,
    consumeSetupFragment: consumeSetupFragment, defaultClientId: DEFAULT_CLIENT_ID,
    isSudburyArea: isSudburyArea
  };
});
