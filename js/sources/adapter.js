/* Rebuy source adapters — common interface + registry.
   Normalized listing:
   { id, source:'ebay'|'rebuy', title, price, currency, condition: like-new|good|fair|parts,
     image, url, location:{label, lat?, lng?}, distanceKm?, listedAt,
     seller:{name, rating?, verified?}, newPrice?, year?, category?, demo? }
   Adapter contract: { id, label, enabled, search(query, filters) -> Promise<normalized[]> }
   filters: { maxPrice?, minPrice?, condition?, sort?, center:{lat,lng}?, radiusKm? }
*/
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.RebuySources = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var registry = [];

  function register(adapter) { registry.push(adapter); return adapter; }
  function all() { return registry.slice(); }
  function enabled() { return registry.filter(function (a) { return a.enabled; }); }
  function get(id) { return registry.find(function (a) { return a.id === id; }) || null; }

  // Run enabled adapters in parallel; never let one failure kill the rest.
  function searchAll(query, filters) {
    var jobs = enabled().map(function (a) {
      return a.search(query, filters).then(function (items) {
        return { source: a.id, ok: true, items: items || [] };
      }).catch(function (err) {
        return { source: a.id, ok: false, error: String((err && err.message) || err), items: [] };
      });
    });
    return Promise.all(jobs);
  }

  function flatten(results) {
    var out = [];
    results.forEach(function (r) { (r.items || []).forEach(function (it) { out.push(it); }); });
    return out;
  }

  function sortListings(items, sort, medianPrice) {
    var arr = items.slice();
    switch (sort) {
      case "price-asc": arr.sort(function (a, b) { return a.price - b.price; }); break;
      case "price-desc": arr.sort(function (a, b) { return b.price - a.price; }); break;
      case "newest": arr.sort(function (a, b) { return (b.listedAt || "") < (a.listedAt || "") ? -1 : 1; }); break;
      case "distance": arr.sort(function (a, b) { return (a.distanceKm == null ? 1e9 : a.distanceKm) - (b.distanceKm == null ? 1e9 : b.distanceKm); }); break;
      case "deal":
      default:
        arr.sort(function (a, b) { return (b._score || 0) - (a._score || 0); });
    }
    return arr;
  }

  return {
    register: register, all: all, enabled: enabled, get: get,
    searchAll: searchAll, flatten: flatten, sortListings: sortListings
  };
});
