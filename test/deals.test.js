"use strict";
const t = require("node:test");
const assert = require("node:assert/strict");
const D = require("../js/deals.js");

const laptop = { price: 320, newPrice: 1450, category: "computers", condition: "good", year: 2018 };

t("fairPrice: depreciation + condition", () => {
  const f = D.fairPrice(laptop, 2026);
  // 8yr old: 0.75^8=0.100 < FLOOR 0.15 → 1450*0.15*0.9 ≈ 196
  assert.ok(f > 180 && f < 210, "fair=" + f);
});

t("dealScore: price==fair → 75", () => {
  const f = D.fairPrice(laptop, 2026);
  assert.equal(D.dealScore({ ...laptop, price: f }, 2026), 75);
});

t("dealScore: 20% below fair → 90", () => {
  const f = D.fairPrice(laptop, 2026);
  assert.equal(D.dealScore({ ...laptop, price: Math.round(f * 0.8) }, 2026), 90);
});

t("dealScore: 20% above fair → 60", () => {
  const f = D.fairPrice(laptop, 2026);
  assert.equal(D.dealScore({ ...laptop, price: Math.round(f * 1.2) }, 2026), 60);
});

t("tiers", () => {
  assert.equal(D.dealTier(90).key, "great");
  assert.equal(D.dealTier(70).key, "fair");
  assert.equal(D.dealTier(40).key, "over");
});

t("sold comps blend toward median", () => {
  const noComps = D.fairPrice(laptop, 2026);
  const withComps = D.fairPrice({ ...laptop, soldComps: [400, 420, 440] }, 2026);
  assert.ok(withComps > noComps, `${withComps} > ${noComps}`);
  assert.ok(withComps < 420, "blended below comp median");
});

t("condition multiplier ordering", () => {
  const f = (c) => D.fairPrice({ ...laptop, condition: c }, 2026);
  assert.ok(f("like-new") > f("good") && f("good") > f("fair") && f("fair") > f("parts"));
});

t("suggestedOffer below price, sane", () => {
  const o = D.suggestedOffer(laptop, 2026);
  assert.ok(o < laptop.price && o % 5 === 0, "offer=" + o);
});

t("sellerGuidePrice above fair", () => {
  const g = D.sellerGuidePrice(laptop, 2026), f = D.fairPrice(laptop, 2026);
  assert.ok(g >= f && g % 5 === 0, `guide=${g} fair=${f}`);
});

t("autoThresholds ordering", () => {
  const th = D.autoThresholds(laptop, 2026);
  assert.ok(th.acceptAt > th.declineBelow, JSON.stringify(th));
});

t("relativeDealScore: below median scores high", () => {
  assert.equal(D.relativeDealScore(280, 350), 90);
  assert.equal(D.relativeDealScore(350, 350), 75);
  assert.equal(D.relativeDealScore(420, 350), 60);
});

t("median: odd/even/empty", () => {
  assert.equal(D.median([3, 1, 2]), 2);
  assert.equal(D.median([4, 1, 3, 2]), 2.5);
  assert.equal(D.median([]), 0);
});

t("dealInfoX: absolute when newPrice, relative otherwise", () => {
  const abs = D.dealInfoX(laptop, { medianPrice: 999 }, 2026);
  assert.equal(abs.basis, "absolute");
  const rel = D.dealInfoX({ price: 280 }, { medianPrice: 350 }, 2026);
  assert.equal(rel.basis, "relative");
  assert.equal(rel.score, 90);
});
