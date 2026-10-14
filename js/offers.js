/* Rebuy offers — structured offer flow math. Pure, UMD. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.RebuyOffers = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // An offer: {id, listingId, amount, from, status, createdAt, history[]}
  // status: pending | accepted | declined | countered | expired

  function newOffer(listingId, amount, from) {
    return {
      id: "of_" + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36),
      listingId: listingId, amount: Math.round(amount), from: from || "you",
      status: "pending", createdAt: new Date().toISOString(), history: []
    };
  }

  // eBay-style auto rules: acceptAt / declineBelow thresholds on the listing.
  // Returns {status, counterTo} — counterTo set when the seller counters.
  function autoRespond(offer, listing) {
    var t = listing.auto || {};
    if (t.acceptAt != null && offer.amount >= t.acceptAt)
      return { status: "accepted", counterTo: null };
    if (t.declineBelow != null && offer.amount < t.declineBelow)
      return { status: "countered", counterTo: t.acceptAt != null ? t.acceptAt : listing.price };
    return { status: "pending", counterTo: null };
  }

  function applyResponse(offer, resp) {
    offer.status = resp.status;
    offer.history.push({
      at: new Date().toISOString(),
      status: resp.status,
      counterTo: resp.counterTo != null ? resp.counterTo : undefined
    });
    if (resp.status === "countered" && resp.counterTo != null) offer.counterTo = resp.counterTo;
    return offer;
  }

  function statusLabel(status) {
    return { pending: "Waiting for seller", accepted: "Accepted", declined: "Declined", countered: "Countered", expired: "Expired" }[status] || status;
  }

  return { newOffer: newOffer, autoRespond: autoRespond, applyResponse: applyResponse, statusLabel: statusLabel };
});
