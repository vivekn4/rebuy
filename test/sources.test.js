"use strict";
const t = require("node:test");
const assert = require("node:assert/strict");
const E = require("../js/sources/ebay.js");
const R = require("../js/sources/rebuy.js");
const A = require("../js/sources/adapter.js");

t("mapCondition", () => {
  assert.equal(E.mapCondition("Used"), "good");
  assert.equal(E.mapCondition("Certified - Refurbished"), "like-new");
  assert.equal(E.mapCondition("For parts or not working"), "parts");
  assert.equal(E.mapCondition(""), "good");
});

t("normalizeItem shape", () => {
  const n = E.normalizeItem({
    itemId: "123", title: "ThinkPad T480", price: { value: "299.99", currency: "CAD" },
    condition: "Used", image: { imageUrl: "http://x/y.jpg" }, itemWebUrl: "http://ebay/x",
    itemLocation: { city: "Toronto", country: "CA" },
    seller: { username: "joe", feedbackPercentage: "98.2" }, itemCreationDate: "2026-10-01T00:00:00Z"
  });
  assert.equal(n.source, "ebay");
  assert.equal(n.price, 299.99);
  assert.equal(n.condition, "good");
  assert.equal(n.seller.rating, 98.2);
  assert.equal(n.distanceKm, null);
});

t("demoResults: deterministic per query", () => {
  const a = E.demoResults("thinkpad t480");
  const b = E.demoResults("thinkpad t480");
  assert.deepEqual(a.map(x => x.id), b.map(x => x.id));
  assert.ok(a.length >= 6, "n=" + a.length);
  assert.ok(a.every(x => x.demo === true && x.source === "ebay"));
  assert.ok(a.some(x => /thinkpad/i.test(x.title)));
});

t("demoResults: respects maxPrice", () => {
  const a = E.demoResults("bike", { maxPrice: 200 });
  assert.ok(a.every(x => x.price <= 200));
});

t("isTokenFresh", () => {
  const now = Date.now();
  assert.ok(E.isTokenFresh({ token: "t", expiresAt: now + 60000 }, now));
  assert.ok(!E.isTokenFresh({ token: "t", expiresAt: now - 1 }, now));
  assert.ok(!E.isTokenFresh(null, now));
});

t("buildSearchUrl encodes query + filters", () => {
  const u = E.buildSearchUrl("thinkpad t480", { maxPrice: 400, currency: "CAD" });
  assert.ok(u.includes("q=thinkpad%20t480") && u.includes("priceCurrency%3ACAD") === false || u.includes("priceCurrency"));
  assert.ok(u.includes("400"), u);
});

t("rebuy adapter: model-aware matching", () => {
  const store = { listings: () => [
    { id: "1", title: "ThinkPad T480 i5", description: "", category: "computers", price: 300 },
    { id: "2", title: "Dell XPS 13", description: "", category: "computers", price: 400 }
  ]};
  const geo = { haversineKm: () => 5 };
  return R.makeAdapter(store, geo).search("thinkpad t480", {}).then(items => {
    assert.equal(items.length, 1);
    assert.equal(items[0].id, "1");
    assert.equal(items[0].source, "rebuy");
  });
});

t("rebuy adapter: radius filters geo-tagged", () => {
  const store = { listings: () => [{ id: "1", title: "Bike", description: "", category: "bikes", price: 100, lat: 46.52, lng: -80.96 }] };
  const geo = { haversineKm: (a, b, c, d) => Math.abs(c - a) * 111 };
  return R.makeAdapter(store, geo).search("", { center: { lat: 46.49, lng: -80.99 }, radiusKm: 25 }).then(items => {
    assert.equal(items.length, 1);
    assert.ok(items[0].distanceKm < 25);
  });
});

t("adapter registry + sortListings", () => {
  A.register({ id: "t1", label: "T1", enabled: true, search: () => Promise.resolve([]) });
  assert.ok(A.get("t1").label === "T1");
  const items = [{ price: 300, _score: 60 }, { price: 200, _score: 90 }];
  assert.equal(A.sortListings(items, "deal")[0].price, 200);
  assert.equal(A.sortListings(items, "price-asc")[0].price, 200);
});
