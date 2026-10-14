/* Rebuy seed — 24 demo listings around Sudbury ON + sellers + comps + meetup spots. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.RebuySeed = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // Simple, honest placeholder art: warm line-art glyph per category (SVG data URI).
  var GLYPHS = {
    computers: '<rect x="28" y="22" width="44" height="30" rx="4"/><rect x="22" y="54" width="56" height="6" rx="3"/><circle cx="50" cy="37" r="6"/>',
    phones: '<rect x="36" y="16" width="28" height="52" rx="7"/><circle cx="50" cy="60" r="3"/><rect x="44" y="22" width="12" height="3" rx="1.5"/>',
    bikes: '<circle cx="30" cy="62" r="12"/><circle cx="70" cy="62" r="12"/><path d="M30 62 L46 40 L62 40 L70 62 M46 40 L42 28 L54 28"/>',
    furniture: '<rect x="20" y="38" width="60" height="24" rx="6"/><rect x="20" y="28" width="14" height="18" rx="5"/><rect x="66" y="28" width="14" height="18" rx="5"/><rect x="26" y="62" width="6" height="10"/><rect x="68" y="62" width="6" height="10"/>',
    cameras: '<rect x="24" y="34" width="52" height="32" rx="6"/><circle cx="50" cy="50" r="11"/><circle cx="50" cy="50" r="5"/><rect x="40" y="28" width="20" height="8" rx="3"/>',
    consoles: '<rect x="30" y="30" width="40" height="26" rx="8"/><circle cx="50" cy="43" r="6"/><rect x="38" y="62" width="24" height="5" rx="2.5"/>',
    appliances: '<rect x="34" y="26" width="32" height="40" rx="8"/><circle cx="50" cy="42" r="8"/><rect x="44" y="58" width="12" height="4" rx="2"/>',
    instruments: '<circle cx="50" cy="58" r="14"/><rect x="46" y="18" width="8" height="32" rx="3"/><circle cx="50" cy="58" r="5"/>',
    other: '<rect x="30" y="34" width="40" height="32" rx="6"/><path d="M30 44 L70 44"/><circle cx="50" cy="56" r="5"/>'
  };
  function art(cat) {
    var g = GLYPHS[cat] || GLYPHS.other;
    var svg = "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 84'>" +
      "<rect width='100' height='84' rx='14' fill='#F8F2EF'/>" +
      "<g fill='none' stroke='#9A3412' stroke-width='3.5' stroke-linecap='round' stroke-linejoin='round'>" + g + "</g></svg>";
    return "data:image/svg+xml," + encodeURIComponent(svg);
  }

  var SELLERS = [
    { name: "Marc T.", verified: true, rating: 4.9, trades: 34 },
    { name: "Priya S.", verified: true, rating: 5.0, trades: 21 },
    { name: "Joanne L.", verified: false, rating: 4.7, trades: 12 },
    { name: "Devon K.", verified: true, rating: 4.8, trades: 47 },
    { name: "Aisha R.", verified: true, rating: 4.9, trades: 18 },
    { name: "Tom B.", verified: false, rating: 4.5, trades: 7 },
    { name: "Nadia F.", verified: true, rating: 5.0, trades: 29 },
    { name: "Chris P.", verified: false, rating: 4.6, trades: 9 }
  ];

  // [title, category, price, newPrice, condition, year, lat, lng, sellerIdx, daysAgo, blurb, reduced?]
  var RAW = [
    ["ThinkPad T480 — i5, 16GB, 512GB SSD", "computers", 320, 1450, "good", 2018, 46.5201, -80.9612, 0, 1, "Business-grade tank. Fresh thermal paste, new battery holds 6+ hours. Includes charger.", false],
    ["ThinkPad X1 Carbon Gen 7", "computers", 540, 2100, "like-new", 2019, 46.4892, -80.9910, 1, 2, "Barely used, always in a sleeve. i7, 16GB, 512GB. Gorgeous carbon chassis.", false],
    ["MacBook Air M1 (2020), 8GB/256GB", "computers", 620, 1299, "like-new", 2020, 46.4510, -81.0090, 3, 1, "Battery at 94% health, 87 cycles. Comes with original box and charger.", false],
    ["Dell XPS 13 9310", "computers", 480, 1600, "good", 2021, 46.5105, -80.9405, 2, 4, "i7 11th gen, 16GB. Tiny mark on the lid, screen flawless.", true],
    ["iPhone 12, 128GB, unlocked", "phones", 340, 979, "good", 2020, 46.4955, -81.0040, 4, 1, "Battery 89%. No cracks, always had a case. Factory unlocked.", false],
    ["Pixel 6a", "phones", 210, 449, "like-new", 2022, 46.4705, -81.0210, 5, 3, "Mint. Used 6 months then upgraded. Box included.", false],
    ["Samsung Galaxy S21 5G", "phones", 260, 999, "fair", 2021, 46.5702, -80.8705, 6, 5, "Works perfectly, some wear on the frame. Great camera phone for the price.", false],
    ["Trek Marlin 5 mountain bike (M)", "bikes", 450, 850, "good", 2022, 46.5210, -80.9580, 3, 2, "Tuned last spring, new chain. Ridden on rail trails only.", false],
    ["Giant Contend road bike (ML)", "bikes", 520, 1100, "like-new", 2023, 46.4310, -81.1980, 0, 6, "Under 500 km. Selling because of a knee injury. Includes lock and lights.", false],
    ["IKEA KALLAX 4x4 shelf, white", "furniture", 45, 120, "good", 2021, 46.4880, -80.9930, 2, 1, "Sturdy, no wobble. From a smoke-free home.", false],
    ["3-seat fabric sofa, charcoal", "furniture", 180, 899, "good", 2020, 46.4520, -81.0120, 7, 3, "Comfy, no stains or pet damage. You haul — I can help load.", true],
    ["Solid oak dining table + 4 chairs", "furniture", 220, 750, "good", 2019, 46.6205, -80.9810, 1, 7, "Real wood, built to last. A few honest marks, priced to move.", false],
    ["Ergonomic office chair", "furniture", 95, 350, "fair", 2021, 46.5100, -80.9420, 5, 2, "Mesh back, adjustable everything. Armrest has a scuff.", false],
    ["Canon EOS R50 + 18-45mm kit", "cameras", 680, 1000, "like-new", 2023, 46.4905, -80.9890, 4, 1, "Shutter count under 2k. Perfect starter mirrorless kit.", false],
    ["Sony A6400 body only", "cameras", 590, 1100, "good", 2020, 46.5710, -80.8690, 3, 4, "Low shutter count, sensor clean. Amazing autofocus.", false],
    ["PS5 disc edition + 2 controllers", "consoles", 480, 650, "like-new", 2023, 46.5190, -80.9630, 0, 1, "Adult owned, dust-free. Includes 3 games.", false],
    ["Nintendo Switch OLED", "consoles", 300, 450, "good", 2022, 46.4710, -81.0190, 6, 2, "Screen perfect, joy-cons drift-free. Case included.", false],
    ["Xbox Series S 512GB", "consoles", 230, 380, "good", 2021, 46.6505, -80.9510, 2, 5, "Quiet, fast. Controller thumbsticks perfect.", true],
    ["Dyson V11 cordless vacuum", "appliances", 280, 750, "good", 2021, 46.4505, -81.0080, 1, 3, "New filter and brush head last year. Strong suction.", false],
    ["KitchenAid Artisan mixer, red", "appliances", 240, 600, "like-new", 2022, 46.4960, -81.0060, 4, 2, "Used maybe ten times. All attachments included.", false],
    ["Ninja dual-zone air fryer", "appliances", 90, 230, "good", 2023, 46.5108, -80.9390, 7, 1, "Works great, just upgraded to a bigger one.", false],
    ["Fender CD-60S acoustic guitar", "instruments", 130, 280, "good", 2021, 46.5890, -81.1990, 5, 6, "Warm tone, low action, fresh strings. Soft case included.", false],
    ["Burton snowboard + bindings, 154", "other", 160, 450, "good", 2022, 46.4305, -81.2010, 3, 8, "Ridden two seasons, base in great shape. Ready for Searchmont.", false],
    ["Uppababy Vista stroller", "other", 420, 1300, "like-new", 2023, 46.5205, -80.9595, 6, 2, "Gently used for one child. All accessories, rain cover included.", false]
  ];

  var COMPS = {
    computers: [300, 340, 380, 420, 520, 560],
    phones: [200, 240, 280, 320, 360],
    bikes: [420, 480, 520, 550],
    furniture: [80, 120, 160, 200],
    cameras: [550, 620, 680],
    consoles: [220, 280, 300, 460],
    appliances: [80, 120, 240, 260],
    instruments: [110, 130, 150],
    other: [150, 180, 400]
  };

  var MEETUPS = [
    { name: "Greater Sudbury Police HQ lobby", addr: "190 Brady St, Sudbury", note: "Well-lit, cameras, staffed daytime" },
    { name: "New Sudbury Centre — food court", addr: "1349 Lasalle Blvd", note: "Busy public indoor spot" },
    { name: "South End Library branch", addr: "1991 Regent St", note: "Quiet, public, daytime hours" }
  ];

  function build() {
    var now = Date.now();
    var listings = RAW.map(function (r, i) {
      var seller = SELLERS[r[8]];
      return {
        id: "l" + (i + 1),
        title: r[0], category: r[1], price: r[2], newPrice: r[3],
        condition: r[4], year: r[5], lat: r[6], lng: r[7],
        seller: { name: seller.name, verified: seller.verified, rating: seller.rating, trades: seller.trades },
        postedAt: new Date(now - r[9] * 864e5).toISOString(),
        description: r[10], reduced: !!r[11],
        photo: art(r[1]),
        soldComps: COMPS[r[1]] || COMPS.other,
        auto: null // computed on the fly from deal engine
      };
    });
    return { listings: listings, meetups: MEETUPS, seededAt: new Date().toISOString() };
  }

  return { build: build, art: art, MEETUPS: MEETUPS };
});
