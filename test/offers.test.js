"use strict";
const t = require("node:test");
const assert = require("node:assert/strict");
const O = require("../js/offers.js");

const listing = { id: "l1", price: 320, auto: { acceptAt: 300, declineBelow: 240 } };

t("autoRespond: at/above accept → accepted", () => {
  assert.equal(O.autoRespond(O.newOffer("l1", 310), listing).status, "accepted");
  assert.equal(O.autoRespond(O.newOffer("l1", 300), listing).status, "accepted");
});

t("autoRespond: below decline floor → countered at acceptAt", () => {
  const r = O.autoRespond(O.newOffer("l1", 200), listing);
  assert.equal(r.status, "countered");
  assert.equal(r.counterTo, 300);
});

t("autoRespond: middle → pending", () => {
  assert.equal(O.autoRespond(O.newOffer("l1", 270), listing).status, "pending");
});

t("autoRespond: no thresholds → pending", () => {
  assert.equal(O.autoRespond(O.newOffer("l1", 1), { id: "x", price: 100 }).status, "pending");
});

t("applyResponse records history", () => {
  const o = O.newOffer("l1", 200);
  O.applyResponse(o, { status: "countered", counterTo: 300 });
  assert.equal(o.status, "countered");
  assert.equal(o.counterTo, 300);
  assert.equal(o.history.length, 1);
});

t("newOffer shape", () => {
  const o = O.newOffer("l9", 150, "buyer");
  assert.ok(o.id.startsWith("of_") && o.status === "pending" && o.amount === 150);
});
