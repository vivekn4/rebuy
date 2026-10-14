/* Rebuy spend aggregation — pure, UMD. Purchases: {pricePaid, newRef, dateISO, category}. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.RebuySpend = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  function monthKey(dateISO) { return dateISO.slice(0, 7); } // "YYYY-MM"

  function bucketByMonth(purchases) {
    var out = {};
    purchases.forEach(function (p) {
      var k = monthKey(p.dateISO);
      out[k] = (out[k] || 0) + p.pricePaid;
    });
    return out;
  }

  function monthRange(buckets) {
    var keys = Object.keys(buckets).sort();
    if (!keys.length) return 0;
    var a = keys[0].split("-"), b = keys[keys.length - 1].split("-");
    return (parseInt(b[0], 10) - parseInt(a[0], 10)) * 12 + (parseInt(b[1], 10) - parseInt(a[1], 10)) + 1;
  }

  // Dynamic ranges: 6M needs ≥6 months of span, 1Y ≥12, 5Y ≥60; MAX always.
  function availableRanges(buckets) {
    var span = monthRange(buckets), r = [];
    if (span >= 6) r.push("6M");
    if (span >= 12) r.push("1Y");
    if (span >= 60) r.push("5Y");
    r.push("MAX");
    return r;
  }

  function filterByRange(buckets, range) {
    var keys = Object.keys(buckets).sort();
    if (!keys.length) return {};
    var months = { "6M": 6, "1Y": 12, "5Y": 60 }[range];
    if (months == null) return buckets; // MAX
    var last = keys[keys.length - 1];
    var cutoff = addMonths(last, -(months - 1));
    var out = {};
    keys.forEach(function (k) { if (k >= cutoff) out[k] = buckets[k]; });
    return out;
  }

  function addMonths(key, n) {
    var p = key.split("-"), y = parseInt(p[0], 10), m = parseInt(p[1], 10) - 1 + n;
    y += Math.floor(m / 12); m = ((m % 12) + 12) % 12;
    return y + "-" + ("0" + (m + 1)).slice(-2);
  }

  function last30Days(purchases, nowISO) {
    var now = nowISO ? new Date(nowISO) : new Date();
    var nowMs = now.getTime(), cutoff = nowMs - 30 * 864e5;
    return purchases
      .filter(function (p) { var t = new Date(p.dateISO).getTime(); return t >= cutoff && t <= nowMs; })
      .reduce(function (s, p) { return s + p.pricePaid; }, 0);
  }

  function totalSaved(purchases) {
    return purchases.reduce(function (s, p) {
      return s + Math.max(0, (p.newRef || 0) - p.pricePaid);
    }, 0);
  }

  function byCategory(purchases) {
    var out = {};
    purchases.forEach(function (p) {
      out[p.category] = (out[p.category] || 0) + p.pricePaid;
    });
    return out;
  }

  // Compact currency: 950 → "$950", 2400 → "$2.4K", 1500000 → "$1.5M"
  function fmtCompact(v, symbol) {
    var s = symbol || "$";
    var n = Math.round(v);
    if (n >= 1e6) return s + (trimNum(n / 1e6)) + "M";
    if (n >= 1e3) return s + (trimNum(n / 1e3)) + "K";
    return s + n;
  }
  function trimNum(v) {
    var r = Math.round(v * 10) / 10;
    return (r % 1 === 0) ? String(r | 0) : String(r);
  }

  function fmtMoney(v, symbol) {
    var s = symbol || "$";
    return s + Math.round(v).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }

  return {
    monthKey: monthKey, bucketByMonth: bucketByMonth, monthRange: monthRange,
    availableRanges: availableRanges, filterByRange: filterByRange, addMonths: addMonths,
    last30Days: last30Days, totalSaved: totalSaved, byCategory: byCategory,
    fmtCompact: fmtCompact, fmtMoney: fmtMoney
  };
});
