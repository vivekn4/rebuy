/* Rebuy deal-score engine — pure functions, no DOM. UMD for node tests. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.RebuyDeals = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var DEPR = {
    computers: 0.25, phones: 0.25, electronics: 0.25,
    cameras: 0.18, consoles: 0.20,
    bikes: 0.12, instruments: 0.12,
    furniture: 0.15, appliances: 0.15, other: 0.15
  };
  var COND = { "like-new": 1.0, good: 0.9, fair: 0.75, parts: 0.4 };
  var TYPICAL_DISCOUNT = {
    computers: 0.12, phones: 0.12, electronics: 0.12, cameras: 0.12,
    consoles: 0.10, bikes: 0.10, furniture: 0.15, appliances: 0.15,
    instruments: 0.12, other: 0.12
  };
  var FLOOR = 0.15;

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function round5(v) { return Math.max(5, Math.round(v / 5) * 5); }

  function ageYears(year, nowYear) {
    var ny = nowYear || new Date().getFullYear();
    return Math.max(0, ny - (year | 0));
  }

  function depreciationFactor(category, age) {
    var r = DEPR[category] != null ? DEPR[category] : DEPR.other;
    return Math.max(FLOOR, Math.pow(1 - r, age));
  }

  function conditionMult(condition) {
    return COND[condition] != null ? COND[condition] : COND.good;
  }

  // Fair market price for a used item.
  function fairPrice(item, nowYear) {
    var base = item.newPrice * depreciationFactor(item.category, ageYears(item.year, nowYear))
      * conditionMult(item.condition);
    var comps = item.soldComps || [];
    if (comps.length >= 3) {
      var s = comps.slice().sort(function (a, b) { return a - b; });
      var median = s[Math.floor(s.length / 2)];
      base = 0.7 * base + 0.3 * median;
    }
    return Math.round(base);
  }

  // 0..100 — price==fair → 75 · 20% below → 90 · 20% above → 60
  function dealScore(item, nowYear) {
    var fair = fairPrice(item, nowYear);
    if (!fair || fair <= 0) return 50;
    var ratio = item.price / fair;
    return clamp(Math.round(75 + 75 * (1 - ratio)), 0, 100);
  }

  function dealTier(score) {
    if (score >= 85) return { key: "great", label: "Great deal" };
    if (score >= 60) return { key: "fair", label: "Fair" };
    return { key: "over", label: "Overpriced" };
  }

  function dealInfo(item, nowYear) {
    var fair = fairPrice(item, nowYear);
    var score = dealScore(item, nowYear);
    return { fair: fair, score: score, tier: dealTier(score), basis: "absolute" };
  }

  // Relative path for aggregated results without a newPrice reference:
  // score vs the median price of the current result set.
  function median(values) {
    if (!values || !values.length) return 0;
    var s = values.slice().sort(function (a, b) { return a - b; });
    var m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  }

  function relativeDealScore(price, medianPrice) {
    if (!medianPrice || medianPrice <= 0 || !price || price <= 0) return 50;
    var ratio = price / medianPrice;
    return clamp(Math.round(75 + 75 * (1 - ratio)), 0, 100);
  }

  // Cross-source entry point: absolute when newPrice exists, relative otherwise.
  // ctx: { medianPrice } — median of the current result set's prices.
  function dealInfoX(item, ctx, nowYear) {
    if (item.newPrice && item.newPrice > 0) return dealInfo(item, nowYear);
    var med = ctx && ctx.medianPrice;
    var score = relativeDealScore(item.price, med);
    var info = { fair: null, score: score, tier: dealTier(score), basis: "relative" };
    return info;
  }

  // Haggle engine
  function suggestedOffer(item, nowYear) {
    var d = TYPICAL_DISCOUNT[item.category] != null ? TYPICAL_DISCOUNT[item.category] : TYPICAL_DISCOUNT.other;
    var fair = fairPrice(item, nowYear);
    var offer = round5(item.price * (1 - d));
    return Math.max(round5(fair * 0.85), offer);
  }

  function offerRange(item, nowYear) {
    var fair = fairPrice(item, nowYear);
    return { low: round5(fair * 0.85), high: round5(fair * 1.1) };
  }

  // Seller guidance: list slightly above fair to leave haggle room.
  function sellerGuidePrice(item, nowYear) {
    return round5(fairPrice(item, nowYear) * 1.08);
  }

  // eBay-style auto thresholds (seeded per listing; sellers could edit later).
  function autoThresholds(item, nowYear) {
    var fair = fairPrice(item, nowYear);
    return { acceptAt: round5(fair * 0.97), declineBelow: round5(fair * 0.80) };
  }

  return {
    fairPrice: fairPrice, dealScore: dealScore, dealTier: dealTier, dealInfo: dealInfo,
    median: median, relativeDealScore: relativeDealScore, dealInfoX: dealInfoX,
    suggestedOffer: suggestedOffer, offerRange: offerRange,
    sellerGuidePrice: sellerGuidePrice, autoThresholds: autoThresholds,
    round5: round5, clamp: clamp, ageYears: ageYears,
    depreciationFactor: depreciationFactor, conditionMult: conditionMult
  };
});
