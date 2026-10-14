"use strict";
const t = require("node:test");
const assert = require("node:assert/strict");
const G = require("../js/geo.js");

t("haversineKm: Sudbury→Toronto ≈ 320km", () => {
  const d = G.haversineKm(46.4917, -80.9930, 43.6532, -79.3832);
  assert.ok(d > 300 && d < 340, "d=" + d);
});

t("haversineKm: same point = 0", () => {
  assert.equal(G.haversineKm(46.5, -81, 46.5, -81), 0);
});

t("withinRadius: inside/outside 25km", () => {
  // ~10km north of Sudbury center
  assert.ok(G.withinRadius(46.58, -80.99, 46.4917, -80.9930, 25));
  assert.ok(!G.withinRadius(43.6532, -79.3832, 46.4917, -80.9930, 25));
});

t("boundary epsilon: exactly 25.0 included", () => {
  // find a point ~25.0km away: 25km north ≈ 0.2248 degrees latitude
  const lat = 46.4917 + 25.0 / 111.19;
  const d = G.haversineKm(46.4917, -80.9930, lat, -80.9930);
  assert.ok(Math.abs(d - 25) < 0.2, "d=" + d);
  assert.ok(G.withinRadius(lat, -80.9930, 46.4917, -80.9930, 25));
});

t("inBetaZone filters + annotates _km", () => {
  const ls = [
    { id: "a", lat: 46.52, lng: -80.96 },
    { id: "b", lat: 43.65, lng: -79.38 }
  ];
  const r = G.inBetaZone(ls, 46.4917, -80.9930, 25);
  assert.equal(r.length, 1);
  assert.equal(r[0].id, "a");
  assert.ok(typeof r[0]._km === "number" && r[0]._km < 25);
});
