"use strict";
const t = require("node:test");
const assert = require("node:assert/strict");
const S = require("../js/spend.js");

const P = [
  { pricePaid: 320, newRef: 1450, dateISO: "2026-09-10T00:00:00Z", category: "computers" },
  { pricePaid: 210, newRef: 449, dateISO: "2026-10-02T00:00:00Z", category: "phones" },
  { pricePaid: 95, newRef: 350, dateISO: "2026-10-12T00:00:00Z", category: "furniture" }
];

t("bucketByMonth", () => {
  assert.deepEqual(S.bucketByMonth(P), { "2026-09": 320, "2026-10": 305 });
});

t("monthRange", () => {
  assert.equal(S.monthRange(S.bucketByMonth(P)), 2);
  assert.equal(S.monthRange({}), 0);
});

t("availableRanges: dynamic", () => {
  assert.deepEqual(S.availableRanges({}), ["MAX"]);
  const b6 = {}; for (let i = 0; i < 6; i++) b6["2026-0" + (i + 1)] = 10;
  assert.deepEqual(S.availableRanges(b6), ["6M", "MAX"]);
  const b12 = {}; for (let i = 0; i < 12; i++) b12["2025-" + String(i + 1).padStart(2, "0")] = 10;
  assert.deepEqual(S.availableRanges(b12), ["6M", "1Y", "MAX"]);
});

t("filterByRange keeps window", () => {
  const b = { "2026-01": 10, "2026-06": 20, "2026-10": 30 };
  assert.deepEqual(Object.keys(S.filterByRange(b, "6M")), ["2026-06", "2026-10"]);
  assert.deepEqual(Object.keys(S.filterByRange(b, "MAX")).length, 3);
});

t("last30Days", () => {
  assert.equal(S.last30Days(P, "2026-10-14T00:00:00Z"), 305);
  assert.equal(S.last30Days(P, "2026-08-01T00:00:00Z"), 0);
});

t("totalSaved vs new", () => {
  assert.equal(S.totalSaved(P), (1450 - 320) + (449 - 210) + (350 - 95));
});

t("byCategory", () => {
  assert.deepEqual(S.byCategory(P), { computers: 320, phones: 210, furniture: 95 });
});

t("fmtCompact", () => {
  assert.equal(S.fmtCompact(950), "$950");
  assert.equal(S.fmtCompact(2400), "$2.4K");
  assert.equal(S.fmtCompact(1500000), "$1.5M");
});
