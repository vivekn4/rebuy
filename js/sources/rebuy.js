/* Rebuy native adapter — local listings (store/seed) → normalized shape. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.RebuyNative = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  function normalize(l) {
    return {
      id: l.id, source: "rebuy",
      title: l.title, price: l.price, currency: "CAD",
      condition: l.condition, image: l.photo || "",
      url: "#/listing/" + l.id,
      location: { label: l.area || "Sudbury, ON", lat: l.lat, lng: l.lng },
      distanceKm: l._km != null ? l._km : null,
      listedAt: l.postedAt,
      seller: { name: (l.seller || {}).name || "Rebuy seller", rating: (l.seller || {}).rating, verified: !!(l.seller || {}).verified },
      newPrice: l.newPrice, year: l.year, category: l.category,
      soldComps: l.soldComps || [],
      _native: l
    };
  }

  // Everyday words → categories, so "laptop" finds computers and "bike" finds bikes.
  var CAT_ALIASES = {
    laptop: "computers", laptops: "computers", notebook: "computers", notebooks: "computers",
    pc: "computers", desktop: "computers",
    phone: "phones", phones: "phones", mobile: "phones", smartphone: "phones", iphone: "phones",
    bike: "bikes", bikes: "bikes", bicycle: "bikes",
    tv: "electronics", television: "electronics", monitor: "electronics", headphones: "electronics",
    camera: "cameras", lens: "cameras",
    console: "consoles", ps5: "consoles", xbox: "consoles", switch: "consoles",
    sofa: "furniture", couch: "furniture", desk: "furniture", chair: "furniture", table: "furniture",
    fridge: "appliances", washer: "appliances", microwave: "appliances",
    guitar: "instruments", piano: "instruments", keyboard: "instruments", drums: "instruments"
  };

  function matches(l, query, filters) {
    filters = filters || {};
    var q = (query || "").trim().toLowerCase();
    if (q) {
      var hay = (l.title + " " + (l.description || "") + " " + (l.category || "")).toLowerCase();
      // model-aware: every query word must appear (so "ThinkPad T480" narrows properly);
      // everyday words also match their category ("laptop" → computers)
      var words = q.split(/\s+/);
      for (var i = 0; i < words.length; i++) {
        var w = words[i];
        if (hay.indexOf(w) >= 0) continue;
        var cat = CAT_ALIASES[w];
        if (!cat || hay.indexOf(cat) < 0) return false;
      }
    }
    if (filters.maxPrice != null && l.price > filters.maxPrice) return false;
    if (filters.minPrice != null && l.price < filters.minPrice) return false;
    if (filters.condition && filters.condition !== "any" && l.condition !== filters.condition) return false;
    if (filters.category && filters.category !== "any" && l.category !== filters.category) return false;
    return true;
  }

  // store: RebuyStore-like {listings()}, geo: RebuyGeo-like, center {lat,lng}|null
  function makeAdapter(store, geo) {
    return {
      id: "rebuy", label: "Rebuy", enabled: true,
      search: function (query, filters) {
        filters = filters || {};
        var listings = store.listings().filter(function (l) { return matches(l, query, filters); });
        var center = filters.center;
        var items = listings.map(function (l) {
          var n = normalize(l);
          if (center && l.lat != null) n.distanceKm = Math.round(geo.haversineKm(center.lat, center.lng, l.lat, l.lng) * 10) / 10;
          return n;
        });
        // beta radius applies to geo-tagged native listings
        if (center && filters.radiusKm != null) {
          items = items.filter(function (it) { return it.distanceKm == null || it.distanceKm <= filters.radiusKm + 0.05; });
        }
        return Promise.resolve(items);
      }
    };
  }

  return { makeAdapter: makeAdapter, normalize: normalize, matches: matches };
});
