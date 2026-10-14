/* Rebuy geo — geolocation + Haversine + beta radius filter. Pure, UMD. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.RebuyGeo = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var SUDBURY = { lat: 46.4917, lng: -80.9930, label: "Sudbury, ON" };
  var BETA_KM = 25;
  var EPS = 0.05;

  function toRad(d) { return d * Math.PI / 180; }

  function haversineKm(aLat, aLng, bLat, bLng) {
    var R = 6371;
    var dLat = toRad(bLat - aLat), dLng = toRad(bLng - aLng);
    var s = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * R * Math.asin(Math.sqrt(s));
  }

  function withinRadius(itemLat, itemLng, cLat, cLng, km) {
    return haversineKm(cLat, cLng, itemLat, itemLng) <= (km == null ? BETA_KM : km) + EPS;
  }

  function withDistances(listings, cLat, cLng) {
    return listings.map(function (l) {
      var d = haversineKm(cLat, cLng, l.lat, l.lng);
      var copy = {}; for (var k in l) copy[k] = l[k];
      copy._km = Math.round(d * 10) / 10;
      return copy;
    });
  }

  function inBetaZone(listings, cLat, cLng, km) {
    var r = km == null ? BETA_KM : km;
    return withDistances(listings, cLat, cLng).filter(function (l) { return l._km <= r + EPS; });
  }

  // Browser geolocation with timeout + fallback. Calls cb({lat,lng,label,source}).
  function locate(cb, timeoutMs) {
    var done = false;
    function finish(v) { if (!done) { done = true; cb(v); } }
    try {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          function (p) { finish({ lat: p.coords.latitude, lng: p.coords.longitude, label: "Your location", source: "gps" }); },
          function () { finish({ lat: SUDBURY.lat, lng: SUDBURY.lng, label: SUDBURY.label + " (default)", source: "fallback" }); },
          { timeout: timeoutMs || 8000, maximumAge: 600000 }
        );
        setTimeout(function () { finish({ lat: SUDBURY.lat, lng: SUDBURY.lng, label: SUDBURY.label + " (default)", source: "fallback" }); }, (timeoutMs || 8000) + 500);
        return;
      }
    } catch (e) { /* fall through */ }
    finish({ lat: SUDBURY.lat, lng: SUDBURY.lng, label: SUDBURY.label + " (default)", source: "fallback" });
  }

  return {
    SUDBURY: SUDBURY, BETA_KM: BETA_KM,
    haversineKm: haversineKm, withinRadius: withinRadius,
    withDistances: withDistances, inBetaZone: inBetaZone, locate: locate
  };
});
