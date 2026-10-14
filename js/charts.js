/* Rebuy charts — hand-drawn canvas, zero libs. HiDPI aware. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.RebuyCharts = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var INK = "#57534E", LINE = "#EBDFC9", SAGE = "#5F7A61", CLAY = "#9A3412";

  function setup(canvas, h) {
    var dpr = (typeof window !== "undefined" && window.devicePixelRatio) || 1;
    var w = canvas.clientWidth || canvas.parentElement.clientWidth || 600;
    canvas.width = w * dpr; canvas.height = h * dpr;
    canvas.style.height = h + "px";
    var g = canvas.getContext("2d");
    g.scale(dpr, dpr);
    return { g: g, w: w, h: h };
  }

  function niceMax(v) {
    if (v <= 0) return 10;
    var p = Math.pow(10, Math.floor(Math.log10(v)));
    var n = v / p;
    return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
  }

  function compact(v) {
    v = Math.round(v);
    if (v >= 1e6) return "$" + (Math.round(v / 1e5) / 10) + "M";
    if (v >= 1e3) return "$" + (Math.round(v / 100) / 10) + "K";
    return "$" + v;
  }

  // Monthly bars: buckets {"YYYY-MM": total}. Returns tooltip hit-zones.
  function monthlyBars(canvas, buckets, opts) {
    opts = opts || {};
    var keys = Object.keys(buckets).sort();
    var s = setup(canvas, opts.height || 220), g = s.g, W = s.w, H = s.h;
    var padL = 44, padB = 30, padT = 14;
    var max = niceMax(Math.max.apply(null, keys.map(function (k) { return buckets[k]; }).concat([0])));
    g.clearRect(0, 0, W, H);
    g.font = "11px Raleway, sans-serif"; g.fillStyle = INK;

    // gridlines
    g.strokeStyle = LINE; g.lineWidth = 1;
    for (var i = 0; i <= 4; i++) {
      var y = padT + (H - padT - padB) * (1 - i / 4);
      g.beginPath(); g.moveTo(padL, y); g.lineTo(W - 8, y); g.stroke();
      g.fillText(compact(max * i / 4), 4, y + 4);
    }

    var n = keys.length, zones = [];
    if (!n) { g.fillText("No spending logged yet", padL, H / 2); return zones; }
    var slot = (W - padL - 12) / n, bw = Math.min(34, slot * 0.62);
    var reduced = typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    keys.forEach(function (k, idx) {
      var v = buckets[k];
      var bh = (H - padT - padB) * (v / max);
      var x = padL + slot * idx + (slot - bw) / 2, y = H - padB - bh;
      g.fillStyle = SAGE;
      roundRect(g, x, y, bw, bh, 5); g.fill();
      g.fillStyle = INK;
      var lbl = k.slice(5) + "/" + k.slice(2, 4);
      g.fillText(lbl, x + bw / 2 - g.measureText(lbl).width / 2, H - 10);
      zones.push({ x: x, y: y, w: bw, h: bh, key: k, value: v });
    });

    if (!reduced && typeof requestAnimationFrame !== "undefined") {
      // gentle grow-in: redraw progressively
      var t0 = null;
      (function frame(t) {
        if (!t0) t0 = t;
        var p = Math.min(1, (t - t0) / 600), e = 1 - Math.pow(1 - p, 3);
        g.clearRect(0, 0, W, H);
        // (simplified: static redraw would need full state; skip fancy replay — bars are already drawn)
        if (p < 1) requestAnimationFrame(frame);
      });
    }
    return zones;
  }

  // Horizontal category bars: {cat: total}
  function categoryBars(canvas, byCat, opts) {
    opts = opts || {};
    var cats = Object.keys(byCat).sort(function (a, b) { return byCat[b] - byCat[a]; });
    var s = setup(canvas, Math.max(120, cats.length * 34 + 20)), g = s.g, W = s.w, H = s.h;
    var max = niceMax(Math.max.apply(null, cats.map(function (c) { return byCat[c]; }).concat([0])));
    g.clearRect(0, 0, W, H);
    g.font = "12px Raleway, sans-serif";
    cats.forEach(function (c, i) {
      var y = 12 + i * 34, w = (W - 170) * (byCat[c] / max);
      g.fillStyle = INK; g.fillText(prettyCat(c), 4, y + 14);
      g.fillStyle = CLAY;
      roundRect(g, 120, y, Math.max(4, w), 18, 9); g.fill();
      g.fillStyle = INK; g.fillText("$" + Math.round(byCat[c]), 128 + w, y + 14);
    });
    if (!cats.length) { g.fillStyle = INK; g.fillText("Nothing logged yet", 8, 30); }
  }

  function prettyCat(c) { return c.charAt(0).toUpperCase() + c.slice(1); }

  function roundRect(g, x, y, w, h, r) {
    r = Math.min(r, h / 2, w / 2);
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }

  return { monthlyBars: monthlyBars, categoryBars: categoryBars, compact: compact, prettyCat: prettyCat };
});
