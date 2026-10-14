"use strict";
const t = require("node:test");
const assert = require("node:assert/strict");
const G = require("../js/sources/google.js");
const D = require("../js/sources/deeplinks.js");

t("buildSearchUrl carries key, cx, query", () => {
  const u = G.buildSearchUrl("thinkpad t480", { apiKey: "K", engineId: "CX" });
  assert.ok(u.includes("key=K") && u.includes("cx=CX"), u);
  assert.ok(u.includes("q=thinkpad%20t480"), u);
  assert.ok(u.includes("gl=ca"), u);
});

t("sourceLabelFromUrl maps marketplace domains", () => {
  assert.equal(G.sourceLabelFromUrl("https://www.kijiji.ca/b-x/123"), "Kijiji");
  assert.equal(G.sourceLabelFromUrl("https://sudbury.craigslist.org/search/sss"), "Craigslist");
  assert.equal(G.sourceLabelFromUrl("https://www.facebook.com/marketplace/x"), "Facebook");
  assert.equal(G.sourceLabelFromUrl("https://offerup.com/explore/sck/wa/x"), "OfferUp");
  assert.equal(G.sourceLabelFromUrl("https://www.gumtree.com/search?q=x"), "Gumtree");
  assert.equal(G.sourceLabelFromUrl("https://www.mercari.com/search/?keyword=x"), "Mercari");
  assert.equal(G.sourceLabelFromUrl("https://www.depop.com/search/?q=x"), "Depop");
  assert.equal(G.sourceLabelFromUrl("https://poshmark.com/search?query=x"), "Poshmark");
  assert.equal(G.sourceLabelFromUrl("https://www.varagesale.com/search?q=x"), "VarageSale");
  assert.equal(G.sourceLabelFromUrl("https://example-shop.ca/item"), "example-shop.ca");
});

t("groupByMarketplace: groups under the right header, count-desc, empty hides", () => {
  const items = [
    { sourceLabel: "Kijiji", url: "a" }, { sourceLabel: "Kijiji", url: "b" }, { sourceLabel: "Kijiji", url: "c" },
    { sourceLabel: "Depop", url: "d" },
    { sourceLabel: "Craigslist", url: "e" }, { sourceLabel: "Craigslist", url: "f" }
  ];
  const g = G.groupByMarketplace(items);
  assert.deepEqual(g.map(x => x.label), ["Kijiji", "Craigslist", "Depop"]);
  assert.deepEqual(g.map(x => x.items.length), [3, 2, 1]);
  assert.equal(g[0].items[0].url, "a");
  // falls back to URL-derived labels when sourceLabel is absent
  const g2 = G.groupByMarketplace([{ url: "https://www.varagesale.com/search?q=x" }]);
  assert.equal(g2[0].label, "VarageSale");
  // empty → no groups (zone hides gracefully)
  assert.deepEqual(G.groupByMarketplace([]), []);
  assert.deepEqual(G.groupByMarketplace(null), []);
});

t("demoResults: samples the expanded nine-marketplace set", () => {
  const labels = new Set();
  ["thinkpad t480", "bike", "couch", "guitar", "camera", "ps5", "dresser", "iphone"].forEach(q =>
    G.demoResults(q).forEach(x => labels.add(x.sourceLabel)));
  assert.ok(labels.size >= 6, "too few marketplaces sampled: " + [...labels].join(","));
  assert.ok(labels.has("Gumtree") || labels.has("Mercari") || labels.has("VarageSale"),
    "new marketplaces never sampled: " + [...labels].join(","));
});

t("extractPrice sniffs $NNN, null otherwise", () => {
  assert.equal(G.extractPrice("ThinkPad T480 — Like new — $320"), 320);
  assert.equal(G.extractPrice("$1,299.99 laptop"), 1300); // rounded to whole dollars
  assert.equal(G.extractPrice("great laptop, no price here"), null);
});

t("normalizeItem shape", () => {
  const n = G.normalizeItem({
    title: "ThinkPad T480 $300", link: "https://www.kijiji.ca/b-x/1",
    snippet: "Used ThinkPad for $300", pagemap: { cse_thumbnail: [{ src: "http://x/t.jpg" }] }
  }, 0);
  assert.equal(n.source, "web");
  assert.equal(n.sourceLabel, "Kijiji");
  assert.equal(n.price, 300);
  assert.equal(n.condition, null);
  assert.equal(n.distanceKm, null);
  assert.equal(n.url, "https://www.kijiji.ca/b-x/1");
});

t("demoResults: deterministic, labeled, never empty", () => {
  const a = G.demoResults("thinkpad t480");
  const b = G.demoResults("thinkpad t480");
  assert.deepEqual(a.map(x => x.id), b.map(x => x.id));
  assert.ok(a.length >= 4);
  assert.ok(a.every(x => x.demo === true && x.source === "web" && x.url));
  assert.ok(a.every(x => x.sourceLabel && x.price > 0));
});

t("search() with no keys resolves demo mode (never rejects)", () => {
  return G.search("bike").then(r => {
    assert.equal(r.mode, "demo");
    assert.equal(r.quota, false);
    assert.ok(r.items.length >= 4);
  });
});

t("key storage round-trips in memory-less env (no localStorage) without throwing", () => {
  assert.equal(G.hasKeys(), false);
  G.saveKeys("K", "CX"); // no-ops without localStorage
  assert.equal(G.hasKeys(), false);
});

t("deeplinks: nine platforms, verified URL shapes", () => {
  const ls = D.links("thinkpad t480");
  assert.equal(ls.length, 9);
  const byId = {};
  ls.forEach(l => { byId[l.id] = l; });
  assert.ok(byId.kijiji.url.includes("kijiji.ca/b-buy-sell/sudbury/thinkpad-t480/k0c10l1700245"), byId.kijiji.url);
  assert.ok(byId.facebook.url.includes("facebook.com/marketplace/sudbury/search/?query=thinkpad%20t480"), byId.facebook.url);
  assert.ok(byId.craigslist.url.includes("sudbury.craigslist.org/search/sss?query=thinkpad%20t480"), byId.craigslist.url);
  assert.ok(byId.offerup.url.startsWith("https://offerup.com"), byId.offerup.url);
  assert.ok(byId.gumtree.url.includes("gumtree.com/search?q=thinkpad%20t480"), byId.gumtree.url);
  assert.ok(byId.mercari.url.includes("mercari.com/search/?keyword=thinkpad%20t480"), byId.mercari.url);
  assert.ok(byId.depop.url.includes("depop.com/search/?q=thinkpad%20t480"), byId.depop.url);
  assert.ok(byId.poshmark.url.includes("poshmark.com/search?query=thinkpad%20t480"), byId.poshmark.url);
  assert.ok(byId.varagesale.url.includes("varagesale.com/search?q=thinkpad%20t480"), byId.varagesale.url);
  assert.ok(ls.every(l => l.label && l.note));
});

t("deeplinks: every query-carrying link contains the encoded multi-word query", () => {
  const q = "ThinkPad T480";
  const enc = encodeURIComponent(q);
  D.links(q).forEach(l => {
    if (l.id === "offerup") { assert.ok(/^https:\/\/offerup\.com\/?$/.test(l.url), "offerup honest homepage: " + l.url); return; }
    const slug = "thinkpad-t480";
    assert.ok(l.url.includes(enc) || l.url.includes(slug),
      l.id + " missing query: " + l.url);
  });
});

t("deeplinks: empty query still returns usable homepages", () => {
  const ls = D.links("");
  assert.ok(ls.every(l => /^https:\/\//.test(l.url)));
});

t("deeplinks: honest note mentions no public APIs", () => {
  assert.ok(/public API/.test(D.HONEST_NOTE));
});

t("demoResults: link-outs are site-restricted searches for the query, not domain homepages", () => {
  const items = G.demoResults("ThinkPad T480");
  assert.ok(items.length > 0);
  items.forEach(x => {
    assert.ok(x.url.startsWith("https://www.google.com/search?q="), x.url);
    const decoded = decodeURIComponent(x.url.slice("https://www.google.com/search?q=".length));
    assert.ok(decoded.includes("site:"), x.url);
    assert.ok(/thinkpad t480/i.test(decoded), "query present: " + decoded);
    assert.ok(!/^https:\/\/[^/]+\/$/.test(x.url), "not a bare homepage: " + x.url);
  });
});
