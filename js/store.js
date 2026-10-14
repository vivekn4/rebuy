/* Rebuy Store — data layer. Versioned localStorage; backend-swappable interface.
   Swap note: replace _read/_write with fetch() calls; the public API stays identical. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.RebuyStore = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var KEY = "rebuy:v1";
  var VERSION = 1;

  function blank() {
    return { version: VERSION, listings: [], purchases: [], offers: [], alerts: [], seededAt: null };
  }

  function _read() {
    try {
      var raw = (typeof localStorage !== "undefined") ? localStorage.getItem(KEY) : null;
      if (!raw) return blank();
      var d = JSON.parse(raw);
      if (!d || d.version !== VERSION) return blank();
      d.listings = d.listings || []; d.purchases = d.purchases || [];
      d.offers = d.offers || []; d.alerts = d.alerts || [];
      return d;
    } catch (e) { return blank(); }
  }

  function _write(d) {
    try { if (typeof localStorage !== "undefined") localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) { /* quota */ }
    return d;
  }

  var _mem = null;
  function data() { if (!_mem) _mem = _read(); return _mem; }
  function save() { _write(data()); return data(); }
  function reset(seedFn) { _mem = blank(); if (seedFn) seedFn(_mem); return save(); }

  function uid(p) { return (p || "id") + "_" + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36); }

  var Store = {
    KEY: KEY,
    all: function () { return data(); },

    listings: function () { return data().listings; },
    getListing: function (id) { return data().listings.find(function (l) { return l.id === id; }) || null; },
    addListing: function (l) { l.id = l.id || uid("l"); l.postedAt = l.postedAt || new Date().toISOString(); data().listings.unshift(l); return save(), l; },
    updateListing: function (id, patch) {
      var l = this.getListing(id); if (!l) return null;
      for (var k in patch) l[k] = patch[k];
      return save(), l;
    },

    purchases: function () { return data().purchases; },
    addPurchase: function (p) { p.id = p.id || uid("p"); data().purchases.push(p); return save(), p; },

    offers: function () { return data().offers; },
    offersFor: function (listingId) { return data().offers.filter(function (o) { return o.listingId === listingId; }); },
    addOffer: function (o) { data().offers.push(o); return save(), o; },
    updateOffer: function (id, patch) {
      var o = data().offers.find(function (x) { return x.id === id; }); if (!o) return null;
      for (var k in patch) o[k] = patch[k];
      return save(), o;
    },

    alerts: function () { return data().alerts; },
    addAlert: function (a) { a.id = a.id || uid("a"); a.createdAt = new Date().toISOString(); data().alerts.push(a); return save(), a; },
    removeAlert: function (id) { var d = data(); d.alerts = d.alerts.filter(function (a) { return a.id !== id; }); return save(); },

    reset: reset
  };

  return Store;
});
