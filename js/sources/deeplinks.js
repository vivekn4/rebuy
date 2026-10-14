/* Rebuy smart deep links — tier-3 external results. Always available, no keys.
   Each opens the platform's own search with the query pre-filled (new tab).
   URL patterns verified 2026-10-14:
   - Kijiji:    /b-buy-sell/sudbury/{query-slug}/k0c10l1700245 (l1700245 = Sudbury, verified live)
   - Facebook:  /marketplace/sudbury/search/?query= (verified pattern)
   - Craigslist: sudbury.craigslist.org/search/sss?query= (subdomain verified live)
   - OfferUp:   homepage only — explore/sck paths are US-cities-only, no Canadian
                coverage; the homepage search box is the honest entry point.
   Added 2026-10-14 (verified live with a "thinkpad" test query):
   - Gumtree:   /search?q= → 200, query echoed on page, "search results" markers.
   - Mercari:   /search/?keyword= is Mercari's genuine search URL (works in a real
                browser); automated fetches hit their bot-wall captcha, so the 200
                could not be confirmed by curl — pattern shipped as documented.
   - Depop:     /search/?q= → 200, query echoed, "search results" markers.
   - Poshmark:  /search?query= → 200, query echoed on page.
   - VarageSale: /search?q= → 200; the server render is an app shell whose JS reads
                the q param client-side. Community-specific search needs sign-in,
                so we link the global search route honestly instead. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.RebuyDeepLinks = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  function slugify(q) {
    return encodeURIComponent(
      String(q || "").trim().toLowerCase().replace(/['"]/g, "").replace(/\s+/g, "-")
    );
  }
  function enc(q) { return encodeURIComponent(String(q || "").trim()); }

  var LINKS = [
    {
      id: "kijiji", label: "Kijiji",
      url: function (q) { return "https://www.kijiji.ca/b-buy-sell/sudbury/" + slugify(q) + "/k0c10l1700245"; },
      note: "Sudbury buy & sell"
    },
    {
      id: "facebook", label: "Facebook Marketplace",
      url: function (q) { return "https://www.facebook.com/marketplace/sudbury/search/?query=" + enc(q); },
      note: "Opens in Facebook"
    },
    {
      id: "craigslist", label: "Craigslist",
      url: function (q) { return "https://sudbury.craigslist.org/search/sss?query=" + enc(q); },
      note: "Sudbury listings"
    },
    {
      id: "offerup", label: "OfferUp",
      url: function () { return "https://offerup.com/"; },
      note: "Search on their site"
    },
    {
      id: "gumtree", label: "Gumtree",
      url: function (q) { return "https://www.gumtree.com/search?q=" + enc(q); },
      note: "UK & beyond"
    },
    {
      id: "mercari", label: "Mercari",
      url: function (q) { return "https://www.mercari.com/search/?keyword=" + enc(q); },
      note: "US marketplace"
    },
    {
      id: "depop", label: "Depop",
      url: function (q) { return "https://www.depop.com/search/?q=" + enc(q); },
      note: "Fashion & more"
    },
    {
      id: "poshmark", label: "Poshmark",
      url: function (q) { return "https://poshmark.com/search?query=" + enc(q); },
      note: "Fashion resale"
    },
    {
      id: "varagesale", label: "VarageSale",
      url: function (q) { return "https://www.varagesale.com/search?q=" + enc(q); },
      note: "Local garage sales"
    }
  ];

  // query -> [{id, label, url, note}] — empty query returns plain homepages.
  function links(query) {
    return LINKS.map(function (l) {
      return { id: l.id, label: l.label, url: l.url(query), note: l.note };
    });
  }

  var HONEST_NOTE = "Some marketplaces don't offer public APIs, so we send you to their own search instead of pretending.";

  return { links: links, slugify: slugify, HONEST_NOTE: HONEST_NOTE, LINKS: LINKS };
});
