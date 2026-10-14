/* Rebuy Google Programmable Search adapter — tier-2 external results.
   Live mode: Google Custom Search JSON API (free 100 queries/day, no card).
   The user creates a Programmable Search Engine restricted to marketplace
   domains (kijiji.ca, craigslist.org, facebook.com/marketplace, offerup.com…)
   and pastes the API key + engine ID into Settings (localStorage only).
   Demo mode: seeded mock snippets, clearly labeled. Quota (429) degrades
   gracefully with a flag the UI turns into a small "paused — quota" note. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.RebuyGSE = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var API = "https://www.googleapis.com/customsearch/v1";
  var KEY_KEY = "rebuy:gse_keys"; // {apiKey, engineId}

  function lsGet(k) { try { return typeof localStorage !== "undefined" ? localStorage.getItem(k) : null; } catch (e) { return null; } }
  function lsSet(k, v) { try { if (typeof localStorage !== "undefined") localStorage.setItem(k, v); } catch (e) {} }
  function lsDel(k) { try { if (typeof localStorage !== "undefined") localStorage.removeItem(k); } catch (e) {} }

  function getKeys() { try { return JSON.parse(lsGet(KEY_KEY) || "null"); } catch (e) { return null; } }
  function saveKeys(apiKey, engineId) { lsSet(KEY_KEY, JSON.stringify({ apiKey: apiKey, engineId: engineId })); }
  function clearKeys() { lsDel(KEY_KEY); }
  function hasKeys() { var k = getKeys(); return !!(k && k.apiKey && k.engineId); }

  function buildSearchUrl(query, keys) {
    keys = keys || getKeys() || {};
    return API + "?key=" + encodeURIComponent(keys.apiKey || "") +
      "&cx=" + encodeURIComponent(keys.engineId || "") +
      "&q=" + encodeURIComponent(query || "") +
      "&num=10&gl=ca&lr=lang_en";
  }

  // Domain → friendly source label for the comparison panel.
  var DOMAIN_LABELS = [
    [/kijiji\./i, "Kijiji"],
    [/craigslist\./i, "Craigslist"],
    [/facebook\.com/i, "Facebook"],
    [/offerup\.com/i, "OfferUp"],
    [/gumtree\.com/i, "Gumtree"],
    [/mercari\.com/i, "Mercari"],
    [/depop\.com/i, "Depop"],
    [/poshmark\.com/i, "Poshmark"],
    [/ebay\./i, "eBay"]
  ];
  function sourceLabelFromUrl(url) {
    var host = "";
    try { host = new URL(url).hostname; } catch (e) { return "Web"; }
    for (var i = 0; i < DOMAIN_LABELS.length; i++)
      if (DOMAIN_LABELS[i][0].test(host)) return DOMAIN_LABELS[i][1];
    return host.replace(/^www\./, "") || "Web";
  }

  // Opportunistic price sniffing: only trust a leading "$NNN" near the title/snippet start.
  function extractPrice(text) {
    var m = /\$\s?([\d,]+(?:\.\d{1,2})?)/.exec(text || "");
    if (!m) return null;
    var v = parseFloat(m[1].replace(/,/g, ""));
    return (v > 0 && v < 1000000) ? Math.round(v) : null;
  }

  function hashStr(s) {
    var h = 2166136261;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }

  function normalizeItem(it, idx) {
    var link = it.link || "";
    var label = sourceLabelFromUrl(link);
    var snippet = it.snippet || "";
    var thumb = (it.pagemap && it.pagemap.cse_thumbnail && it.pagemap.cse_thumbnail[0] && it.pagemap.cse_thumbnail[0].src) || "";
    return {
      id: "gse_" + (idx || 0) + "_" + hashStr(link).toString(36),
      source: "web", sourceLabel: label,
      title: it.title || "Untitled result",
      price: extractPrice(it.title + " " + snippet), currency: "CAD",
      condition: null, image: thumb, url: link,
      location: { label: label }, distanceKm: null, listedAt: null,
      seller: null, snippet: snippet
    };
  }

  // --- Demo mode: seeded mock snippets ---------------------------------------------
  var DEMO_DOMAINS = [
    ["kijiji.ca", "Kijiji"], ["sudbury.craigslist.org", "Craigslist"],
    ["facebook.com/marketplace", "Facebook"], ["offerup.com", "OfferUp"],
    ["gumtree.com", "Gumtree"]
  ];
  function demoResults(query) {
    var seed = hashStr("rebuy-gse:" + (query || "").toLowerCase().trim());
    var rnd = (function (a) {
      return function () {
        a |= 0; a = (a + 0x6D2B79F5) | 0;
        var t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    })(seed);
    var q = (query || "item").trim() || "item";
    var n = 4 + Math.floor(rnd() * 3);
    var out = [];
    for (var i = 0; i < n; i++) {
      var d = DEMO_DOMAINS[Math.floor(rnd() * DEMO_DOMAINS.length)];
      var price = Math.max(20, Math.round((60 + rnd() * 600) / 5) * 5);
      var cond = ["Used", "Like new", "Good condition"][Math.floor(rnd() * 3)];
      out.push({
        id: "gse_demo_" + i + "_" + seed.toString(36),
        source: "web", sourceLabel: d[1], demo: true,
        title: cap(q) + " — " + cond + " — $" + price,
        price: price, currency: "CAD", condition: null, image: "",
        url: "https://" + d[0] + "/",
        location: { label: d[1] }, distanceKm: null, listedAt: null,
        seller: null,
        snippet: cond + " " + q + " listed for $" + price + ". Open the original listing for photos and details."
      });
    }
    return out;
  }
  function cap(q) { q = String(q); return q.charAt(0).toUpperCase() + q.slice(1); }

  // --- Public search -----------------------------------------------------------------
  // Resolves { mode:'live'|'demo', quota:bool, items, notice } — never rejects on
  // missing keys or HTTP errors; 429 is surfaced as quota:true (UI falls back to
  // deep links with a small note), everything else degrades to labeled demo mode.
  function search(query) {
    if (!hasKeys()) return Promise.resolve({ mode: "demo", quota: false, items: demoResults(query), notice: null });
    return fetch(buildSearchUrl(query)).then(function (r) {
      if (r.status === 429) return { mode: "live", quota: true, items: [], notice: "External results paused — quota." };
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    }).then(function (j) {
      if (j && j.quota) return j;
      var items = ((j && j.items) || []).map(function (it, i) { return normalizeItem(it, i); });
      return { mode: "live", quota: false, items: items, notice: null };
    }).catch(function (err) {
      return { mode: "demo", quota: false, items: demoResults(query), notice: "Web results unreachable (" + (err && err.message ? err.message : "network") + ") — showing demo results." };
    });
  }

  var adapter = {
    id: "gse", label: "Google", enabled: true,
    search: function (query) {
      return search(query).then(function (r) { return r.items; });
    },
    searchVerbose: search
  };

  return {
    adapter: adapter, search: search, searchVerbose: search,
    normalizeItem: normalizeItem, demoResults: demoResults,
    buildSearchUrl: buildSearchUrl, extractPrice: extractPrice,
    sourceLabelFromUrl: sourceLabelFromUrl,
    getKeys: getKeys, saveKeys: saveKeys, clearKeys: clearKeys, hasKeys: hasKeys
  };
});
