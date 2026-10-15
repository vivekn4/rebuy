"use strict";
const t = require("node:test");
const assert = require("node:assert/strict");
// node has no localStorage — stub it so radius persistence is testable.
const _mem = {};
global.localStorage = {
  getItem: (k) => (k in _mem ? _mem[k] : null),
  setItem: (k, v) => { _mem[k] = String(v); },
  removeItem: (k) => { delete _mem[k]; }
};
const G = require("../js/geo.js");

t("radius: defaults to 25km", () => {
  assert.equal(G.getRadiusKm(), 25);
});

t("radius: setRadiusKm persists valid radii only", () => {
  assert.equal(G.setRadiusKm(50), 50);
  assert.equal(G.getRadiusKm(), 50);
  assert.equal(G.setRadiusKm(10), 10);
  assert.equal(G.setRadiusKm(100), 100);
  assert.equal(G.setRadiusKm(999), 25); // invalid → default
  assert.equal(G.setRadiusKm(50), 50);  // restore for other tests
});

t("radius: RADII exposes the selector options", () => {
  assert.deepEqual(G.RADII, [10, 25, 50, 100]);
});

t("radius: withinRadius honors an explicit km", () => {
  // ~30km north of Sudbury: inside 50, outside 25
  const lat = 46.4917 + 30.0 / 111.19;
  assert.ok(!G.withinRadius(lat, -80.9930, 46.4917, -80.9930, 25));
  assert.ok(G.withinRadius(lat, -80.9930, 46.4917, -80.9930, 50));
});

t("radius: far-from-Sudbury honesty threshold (150km)", () => {
  const toronto = G.haversineKm(43.6532, -79.3832, G.SUDBURY.lat, G.SUDBURY.lng);
  assert.ok(toronto > 150, "Toronto should trip the honesty check, d=" + toronto);
  const northBay = G.haversineKm(46.3091, -79.4608, G.SUDBURY.lat, G.SUDBURY.lng);
  assert.ok(northBay < 150, "North Bay should keep GPS, d=" + northBay);
});
