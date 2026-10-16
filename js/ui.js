/* Rebuy UI — hash router + view renderers. Calm, single-purpose views.
   Depends on: RebuyGeo, RebuyDeals, RebuyOffers, RebuySpend, RebuyStore,
   RebuySeed, RebuySound, RebuyCharts, RebuySources, RebuyEbay, RebuyGSE,
   RebuyDeepLinks, RebuyNative. No framework, no dependencies. */
(function (root) {
  "use strict";

  var G = root.RebuyGeo, D = root.RebuyDeals, OF = root.RebuyOffers,
      SP = root.RebuySpend, Store = root.RebuyStore, Seed = root.RebuySeed,
      Sound = root.RebuySound, Charts = root.RebuyCharts,
      Src = root.RebuySources, Ebay = root.RebuyEbay, GSE = root.RebuyGSE,
      DL = root.RebuyDeepLinks, Native = root.RebuyNative,
      // icons.js is a static script loaded before us; the stub keeps a 404
      // or CDN hiccup from killing the whole UI (icons just go blank).
      IC = root.RebuyIcons || { icon: function () { return ""; } };

  // ---------- state ----------
  var S = {
    center: { lat: G.SUDBURY.lat, lng: G.SUDBURY.lng, label: "Sudbury, ON", source: "fallback" },
    cache: {},        // id -> normalized item (for compare tray)
    compareIds: [],   // selected ids, max 4
    lastSearch: null  // {query, filters} for "save this search"
  };
  try {
    S.compareIds = JSON.parse(localStorage.getItem("rebuy:compare") || "[]");
    if (!Array.isArray(S.compareIds)) S.compareIds = [];
  } catch (e) { S.compareIds = []; }
  function persistCompare() {
    try { localStorage.setItem("rebuy:compare", JSON.stringify(S.compareIds)); } catch (e) {}
  }

  var view = document.getElementById("view");
  var CATS = ["computers", "phones", "bikes", "furniture", "cameras", "consoles", "appliances", "instruments", "other"];
  var CONDS = [["like-new", "Like new"], ["good", "Good"], ["fair", "Fair"], ["parts", "For parts"]];

  // ---------- tiny helpers ----------
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function $(sel, el) { return (el || document).querySelector(sel); }
  function $all(sel, el) { return Array.prototype.slice.call((el || document).querySelectorAll(sel)); }
  function money(v) { return SP.fmtMoney(v == null ? 0 : v); }
  function timeAgo(iso) {
    if (!iso) return "";
    var mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
    if (mins < 60) return mins <= 1 ? "just now" : mins + "m ago";
    var h = Math.round(mins / 60);
    if (h < 24) return h + "h ago";
    var d = Math.round(h / 24);
    return d === 1 ? "yesterday" : d + "d ago";
  }
  function distLabel(km) {
    if (km == null) return "distance n/a";
    return km < 1 ? Math.round(km * 1000) + " m away" : (Math.round(km * 10) / 10) + " km away";
  }
  function condLabel(c) {
    var f = CONDS.find(function (x) { return x[0] === c; });
    return f ? f[1] : (c || "Not stated");
  }
  function reducedMotion() {
    return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  // ---------- toast + modal ----------
  var lastFocus = null;
  function toast(msg, kind) {
    var region = document.getElementById("toastRegion");
    var t = document.createElement("div");
    t.className = "toast" + (kind ? " " + kind : "");
    t.textContent = msg;
    region.appendChild(t);
    setTimeout(function () { t.style.opacity = "0"; t.style.transition = "opacity .4s"; }, 3400);
    setTimeout(function () { t.remove(); }, 3900);
  }
  function openModal(html) {
    var bd = document.getElementById("modalBackdrop"), box = document.getElementById("modalBox");
    lastFocus = document.activeElement;
    box.innerHTML = html;
    bd.hidden = false;
    var first = box.querySelector("input, textarea, select, button");
    if (first) setTimeout(function () { try { first.focus(); } catch (e) {} }, 60);
    bd.onclick = function (e) { if (e.target === bd) closeModal(); };
    document.addEventListener("keydown", modalKey);
    return box;
  }
  function modalKey(e) {
    if (e.key === "Escape") { closeModal(); return; }
    if (e.key !== "Tab") return;
    // Keep tab focus cycling inside the dialog while it's open.
    var box = document.getElementById("modalBox");
    var f = $all("a[href], button:not([disabled]), input, textarea, select, [tabindex]:not([tabindex='-1'])", box)
      .filter(function (el) { return el.offsetParent !== null; });
    if (!f.length) return;
    var first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
  function closeModal() {
    document.getElementById("modalBackdrop").hidden = true;
    document.removeEventListener("keydown", modalKey);
    if (lastFocus && document.body.contains(lastFocus)) {
      try { lastFocus.focus(); } catch (e) {}
    }
    lastFocus = null;
  }

  // ---------- deal badge (hang-tag motif) ----------
  function dealBadge(item) {
    if (!item._tier) return '<span class="hint">no price to score</span>';
    var b = item._basis === "relative" ? ' <span class="basis">vs similar</span>' : "";
    return '<span class="deal-tag ' + item._tier.key + '" title="Deal score ' + item._score + '/100">' +
      esc(item._tier.label) + b + "</span>";
  }
  function sourceBadge(item) {
    if (item.source === "rebuy") return '<span class="source-badge">Rebuy</span>';
    if (item.source === "ebay") return '<span class="source-badge ebay">eBay' + (item.demo ? " · demo" : "") + "</span>";
    return '<span class="source-badge web">' + esc(item.sourceLabel || "Web") + (item.demo ? " · demo" : "") + "</span>";
  }

  // Score a mixed result set: absolute when newPrice exists, else vs median.
  // Items with no price stay unscored (_tier = null) — never invent a badge.
  function scoreItems(items) {
    var prices = items.filter(function (i) { return i.price > 0; }).map(function (i) { return i.price; });
    var med = D.median(prices);
    items.forEach(function (it) {
      if (!it.price || it.price <= 0) {
        it._score = null; it._tier = null; it._basis = null; it._fair = null;
      } else {
        var info = D.dealInfoX(it, { medianPrice: med });
        it._score = info.score; it._tier = info.tier; it._basis = info.basis; it._fair = info.fair;
      }
      S.cache[it.id] = it;
    });
    return items;
  }

  // ---------- compare tray ----------
  function toggleCompare(id, on) {
    var i = S.compareIds.indexOf(id);
    if (on && i < 0) {
      if (S.compareIds.length >= 4) { toast("Compare holds up to 4 listings — remove one first.", "error"); Sound.error(); return false; }
      S.compareIds.push(id);
    } else if (!on && i >= 0) S.compareIds.splice(i, 1);
    persistCompare(); renderTray();
    return true;
  }
  function renderTray() {
    var tray = document.getElementById("compareTray");
    var n = S.compareIds.length;
    tray.hidden = n === 0;
    document.getElementById("trayCount").textContent = n;
    document.getElementById("trayGo").classList.toggle("btn-primary", true);
  }

  // ---------- router ----------
  function parseHash() {
    var h = location.hash || "#/";
    var m = /^#\/([^?]*)(\?(.*))?$/.exec(h);
    var path = (m && m[1]) || "";
    var q = {};
    if (m && m[3]) m[3].split("&").forEach(function (p) {
      var kv = p.split("="); q[decodeURIComponent(kv[0])] = decodeURIComponent(kv[1] || "");
    });
    return { path: path, q: q };
  }
  function route() {
    var r = parseHash();
    $all(".site-nav a, .mobile-tabs a").forEach(function (a) {
      var nav = a.getAttribute("data-nav");
      a.classList.toggle("active",
        (nav === "home" && (r.path === "" || r.path === "search")) || nav === r.path);
    });
    window.scrollTo(0, 0);
    if (r.path === "" ) return renderHome();
    if (r.path === "search") return renderSearch(r.q);
    if (r.path.indexOf("listing/") === 0) return renderListing(r.path.slice(8));
    if (r.path === "compare") return renderCompare();
    if (r.path === "sell") return renderSell();
    if (r.path === "spend") return renderSpend();
    if (r.path === "alerts") return renderAlerts();
    if (r.path === "offers") return renderOffers();
    if (r.path === "settings") return renderSettings();
    return renderHome();
  }

  // ============================================================ HOME
  function renderHome() {
    view.innerHTML =
      '<div class="view-narrow" style="margin:0 auto">' +
      '<section class="hero">' +
      '<span class="hero-eyebrow">Kayak for used goods · Sudbury beta</span>' +
      "<h1><span class=\"word-compare\">Compare</span> every used listing, right here in Sudbury.</h1>" +
      '<p class="tagline">Search once. We line up Rebuy sellers and marketplaces side by side, score the deal, and let you pick the winner.</p>' +
      '<form class="search-hero" id="heroSearch">' +
      '<input type="search" id="heroQ" placeholder="Try &quot;ThinkPad T480&quot;…" aria-label="Search used listings" autocomplete="off" enterkeyhint="search">' +
      '<button class="btn btn-primary" type="submit">Search</button>' +
      "</form>" +
      '<p class="quick-searches">Popular right now: ' +
      ["ThinkPad T480", "iPhone 12", "Trek bike", "PS5", "standing desk"].map(function (q) {
        return '<button type="button" data-q="' + esc(q) + '">' + esc(q) + "</button>";
      }).join(" · ") + "</p>" +
      '<p class="hero-note"><span class="beta-badge">Beta</span><br>Showing items within ' + G.getRadiusKm() + " km of <strong>" + esc(S.center.label) + "</strong>. " +
      "Rebuy never takes a cut — you pay the seller in person.</p>" +
      "</section></div>";

    $("#heroSearch").addEventListener("submit", function (e) {
      e.preventDefault();
      var q = $("#heroQ").value.trim();
      Sound.click();
      location.hash = "#/search?q=" + encodeURIComponent(q);
    });
    $all("[data-q]").forEach(function (b) {
      b.addEventListener("click", function () {
        Sound.click();
        location.hash = "#/search?q=" + encodeURIComponent(b.getAttribute("data-q"));
      });
    });
    // Autofocus only on devices with a fine pointer (desktop). On touch devices,
    // programmatic focus pops the keyboard and triggers password-manager /
    // autofill accessory bars (e.g. 1Password) that render as stray floating
    // bars over the hero. See: white-bar report 2026-10-14.
    setTimeout(function () {
      var fine = window.matchMedia && window.matchMedia("(hover: hover) and (pointer: fine)").matches;
      var i = $("#heroQ");
      if (i && fine) i.focus();
    }, 80);
  }

  // ============================================================ SEARCH / RESULTS
  function filterParams(q) {
    return {
      q: q.q || "",
      cat: q.cat || "any", min: q.min ? +q.min : null, max: q.max ? +q.max : null,
      cond: q.cond || "any", sort: q.sort || "deal", src: q.src || "all",
      sudbury: q.sudbury == null ? true : q.sudbury === "1"
    };
  }
  function filtersForAdapters(f) {
    return {
      maxPrice: f.max, minPrice: f.min,
      condition: f.cond, sort: f.sort,
      category: f.cat, currency: "CAD",
      center: S.center, radiusKm: G.getRadiusKm()
    };
  }

  // Honest location pill: always reads "Within {km} km of {label}" from live
  // state — never a hardcoded string. The compact span feeds narrow phones
  // (≤560px), where the full label would truncate mid-word.
  function paintPill() {
    var km = G.getRadiusKm(), label = S.center.label;
    var full = document.getElementById("locationLabel");
    if (full) full.textContent = "Within " + km + " km of " + label;
    var short = document.getElementById("locationLabelShort");
    if (short) short.textContent = km + " km · " + label;
  }

  // ---------- shopping cards (Google-Shopping pattern, calm theme) ----------
  // Stars from a 0–5 rating. Lucide star SVGs (filled vs outline) — crisp at
  // every size, never emoji. Only ever called with real data — never fake stars.
  function starsHTML(rating5, sub) {
    var r = Math.max(0, Math.min(5, +rating5 || 0));
    var full = Math.round(r), s = "", i;
    for (i = 0; i < 5; i++)
      s += '<span class="st' + (i < full ? " on" : "") + '" aria-hidden="true">' + IC.icon("star", 15, i < full) + "</span>";
    return '<div class="shop-stars" role="img" aria-label="' + r.toFixed(1) + ' out of 5 stars">' +
      '<span class="stars-row">' + s + "</span>" +
      (sub ? '<span class="pct">' + esc(sub) + "</span>" : "") + "</div>";
  }
  // eBay feedback percentage (0–100) → stars.
  function ebayStars(pct) {
    if (pct == null || isNaN(+pct)) return "";
    return starsHTML(+pct / 20, Math.round(+pct) + "% positive");
  }
  // Marketplace row: calm dot + name.
  function mktRowHTML(label, hue) {
    var h = (hue == null ? mktHue(label) : hue);
    return '<div class="shop-mkt"><span class="mkt-dot" style="background:hsl(' + h +
      ',42%,52%)" aria-hidden="true"></span><span>' + esc(label) + "</span></div>";
  }
  function demoPill(it) {
    return it.demo ? '<span class="demo-pill">Demo</span>' : "";
  }
  // Shared media block: a calm placeholder letter sits behind the photo; a
  // broken photo removes itself to reveal it.
  function shopMediaHTML(it, href, newTab, initial) {
    var t = newTab ? ' target="_blank" rel="noopener"' : "";
    return '<a class="shop-media" href="' + href + '"' + t + ">" +
      '<span class="shop-noimg" aria-hidden="true">' + esc(initial) + "</span>" +
      (it.image ? '<img src="' + esc(it.image) + '" alt="' + esc(it.title) + '" loading="lazy" onerror="this.remove()">' : "") +
      demoPill(it) + "</a>";
  }
  function condPillHTML(it) {
    return it.condition ? '<span class="cond-pill">' + esc(condLabel(it.condition)) + "</span>" : "";
  }
  function priceRowHTML(it) {
    if (!it.price) return '<div class="shop-dist">Price on site</div>';
    return '<div class="shop-price-row"><data class="shop-price" value="' + it.price + '">' + money(it.price) +
      "</data>" + condPillHTML(it) + "</div>";
  }
  // Skeleton shimmer cards while results gather — same grid rhythm as real cards.
  function skelCards(n) {
    var s = "";
    for (var i = 0; i < (n || 4); i++)
      s += '<div class="shop-card" aria-hidden="true"><div class="skel" style="aspect-ratio:4/3"></div>' +
        '<div class="shop-body"><div class="skel" style="height:.8em;width:38%"></div>' +
        '<div class="skel" style="height:1em"></div><div class="skel" style="height:1em;width:75%"></div>' +
        '<div class="skel" style="height:1.9em;width:52%"></div></div></div>';
    return s;
  }
  function compareCheckHTML(it) {
    var checked = S.compareIds.indexOf(it.id) >= 0;
    return '<label class="compare-check' + (checked ? " on" : "") + '"><input type="checkbox" data-cmp="' +
      esc(it.id) + '"' + (checked ? " checked" : "") + "> Compare</label>";
  }

  // Native Rebuy listing card.
  function cardHTML(it) {
    var detailUrl = "#/listing/" + esc(it.id);
    var stars = (it.seller && it.seller.rating != null) ? starsHTML(it.seller.rating, (+it.seller.rating).toFixed(1)) : "";
    return '<article class="shop-card" data-id="' + esc(it.id) + '">' +
      shopMediaHTML(it, detailUrl, false, "R") +
      '<div class="shop-body">' +
      mktRowHTML("On Rebuy", 115) +
      '<h3 class="shop-title"><a href="' + detailUrl + '">' + esc(it.title) + "</a>" +
      (it._native && it._native.reduced ? '<span class="reduced-flag">Reduced</span>' : "") + "</h3>" +
      stars +
      priceRowHTML(it) +
      (it._tier ? '<div class="shop-badges">' + dealBadge(it) + "</div>" : "") +
      (it.distanceKm != null ? '<div class="shop-dist">' + esc(distLabel(it.distanceKm)) + "</div>" : "") +
      (it.seller && it.seller.name ? '<div class="shop-seller">Seller: ' + esc(it.seller.name) +
        (it.seller.verified ? ' <span class="verified">' + IC.icon("badge-check", 14) + ' verified</span>' : "") + "</div>" : "") +
      '<div class="shop-actions"><a class="btn btn-primary btn-sm" href="' + detailUrl + '">View</a>' +
      compareCheckHTML(it) + "</div></div></article>";
  }

  // External marketplace card (eBay / second-hand web). Card leads out.
  function extCardHTML(it) {
    var label = it.sourceLabel || (it.source === "ebay" ? "eBay" : it.source) || "Web";
    var url = it.url || "#";
    var stars = (it.source === "ebay" && it.seller && it.seller.rating != null) ? ebayStars(it.seller.rating) : "";
    return '<article class="shop-card" data-id="' + esc(it.id) + '">' +
      shopMediaHTML(it, url, true, label.charAt(0).toUpperCase()) +
      '<div class="shop-body">' +
      mktRowHTML(label) +
      '<h3 class="shop-title"><a href="' + esc(url) + '" target="_blank" rel="noopener">' + esc(it.title) + "</a></h3>" +
      stars +
      priceRowHTML(it) +
      (it._tier ? '<div class="shop-badges">' + dealBadge(it) + "</div>" : "") +
      (it.snippet ? '<p class="shop-snippet">' + esc(it.snippet.slice(0, 110)) + "…</p>" : "") +
      '<div class="shop-actions"><a class="btn btn-ghost btn-sm" href="' + esc(url) +
      '" target="_blank" rel="noopener">View listing</a>' + compareCheckHTML(it) + "</div></div></article>";
  }

  function wireCompareBoxes(scope) {
    $all("[data-cmp]", scope).forEach(function (cb) {
      cb.addEventListener("change", function () {
        var ok = toggleCompare(cb.getAttribute("data-cmp"), cb.checked);
        if (!ok) { cb.checked = false; return; }
        cb.closest(".compare-check").classList.toggle("on", cb.checked);
        Sound.toggle(cb.checked);
      });
    });
  }

  function renderSearch(q) {
    var f = filterParams(q);
    S.lastSearch = { query: f.q, filters: f };
    var chips = [["all", "All"], ["rebuy", "On Rebuy"], ["ebay", "eBay"], ["web", "Second-hand web"]];
    view.innerHTML =
      '<section class="results-head"><h1 class="serif">Results for “' + esc(f.q || "everything nearby") + "”</h1>" +
      '<p class="results-meta" id="resultsMeta">Gathering listings…</p>' +
      '<p><button class="btn btn-soft btn-sm" id="alertMeBtn" type="button">Get alerts for this search</button></p></section>' +
      '<div class="filter-bar" id="filterBar">' +
      '<div class="f"><label for="fRad">Radius</label><select id="fRad">' +
      G.RADII.map(function (r) {
        return '<option value="' + r + '"' + (G.getRadiusKm() === r ? " selected" : "") + ">" + r + " km</option>";
      }).join("") + "</select></div>" +
      '<div class="f"><label for="fCat">Category</label><select id="fCat"><option value="any">All</option>' +
      CATS.map(function (c) { return '<option value="' + c + '"' + (f.cat === c ? " selected" : "") + ">" + esc(c) + "</option>"; }).join("") + "</select></div>" +
      '<div class="f f-narrow"><label for="fMin">Min $</label><input type="number" id="fMin" min="0" value="' + (f.min == null ? "" : f.min) + '" placeholder="0"></div>' +
      '<div class="f f-narrow"><label for="fMax">Max $</label><input type="number" id="fMax" min="0" value="' + (f.max == null ? "" : f.max) + '" placeholder="Any"></div>' +
      '<div class="f"><label for="fCond">Condition</label><select id="fCond"><option value="any">Any</option>' +
      CONDS.map(function (c) { return '<option value="' + c[0] + '"' + (f.cond === c[0] ? " selected" : "") + ">" + c[1] + "</option>"; }).join("") + "</select></div>" +
      '<div class="f"><label for="fSort">Sort</label><select id="fSort">' +
      [["deal", "Best deal"], ["price-asc", "Price: low to high"], ["price-desc", "Price: high to low"], ["newest", "Newest"], ["distance", "Nearest"]].map(function (o) {
        return '<option value="' + o[0] + '"' + (f.sort === o[0] ? " selected" : "") + ">" + o[1] + "</option>";
      }).join("") + "</select></div>" +
      '<div class="f f-check"><label class="check-label" for="fSudbury"><input type="checkbox" id="fSudbury"' + (f.sudbury ? " checked" : "") + "> Sudbury area only</label></div>" +
      "</div>" +
      '<div class="source-chips" role="group" aria-label="Source filter">' +
      chips.map(function (c) {
        return '<button type="button" class="chip" data-src="' + c[0] + '" aria-pressed="' + (f.src === c[0]) + '">' + c[1] + "</button>";
      }).join("") + "</div>" +
      '<div class="results-grid"><div id="mainZone"></div><aside class="side-panel" id="sidePanel" aria-label="Also listed on"></aside></div>';

    // filter events → update hash (debounced for numbers)
    function pushHash() {
      var p = "q=" + encodeURIComponent(f.q) +
        "&cat=" + $("#fCat").value + "&cond=" + $("#fCond").value + "&sort=" + $("#fSort").value +
        "&src=" + f.src + "&sudbury=" + ($("#fSudbury").checked ? "1" : "0") +
        ($("#fMin").value ? "&min=" + $("#fMin").value : "") +
        ($("#fMax").value ? "&max=" + $("#fMax").value : "");
      Sound.toggle(true);
      location.hash = "#/search?" + p;
    }
    var deb = null;
    ["fCat", "fCond", "fSort"].forEach(function (id) {
      $("#" + id).addEventListener("change", function () { f.cat = $("#fCat").value; f.cond = $("#fCond").value; f.sort = $("#fSort").value; pushHash(); });
    });
    $("#fSudbury").addEventListener("change", function () { f.sudbury = $("#fSudbury").checked; pushHash(); });
    // Radius is global device state: changing it updates the pill and re-runs
    // the current search with the new radius.
    $("#fRad").addEventListener("change", function () {
      G.setRadiusKm(+$("#fRad").value);
      paintPill();
      Sound.toggle(true);
      toast("Searching within " + G.getRadiusKm() + " km of " + S.center.label + ".", "");
      route();
    });
    // One-tap alert: the #1 retention driver, impossible to miss.
    $("#alertMeBtn").addEventListener("click", function () {
      var dup = Store.alerts().some(function (a) {
        return (a.query || "") === (f.q || "") && JSON.stringify(a.filters || {}) === JSON.stringify(f);
      });
      if (!dup) Store.addAlert({ query: f.q, filters: f });
      var dot = document.getElementById("alertsDot");
      if (dot) dot.hidden = false;
      Sound.success();
      toast(dup ? "Already watching this search." : "Alert saved — we'll ping you when it shows up.", "success");
    });
    ["fMin", "fMax"].forEach(function (id) {
      $("#" + id).addEventListener("input", function () {
        clearTimeout(deb);
        deb = setTimeout(function () { f.min = $("#fMin").value ? +$("#fMin").value : null; f.max = $("#fMax").value ? +$("#fMax").value : null; pushHash(); }, 600);
      });
    });
    $all("[data-src]").forEach(function (b) {
      b.addEventListener("click", function () { f.src = b.getAttribute("data-src"); Sound.click(); pushHash(); });
    });

    // loading skeletons (same grid as results — no layout shift when they land)
    $("#mainZone").innerHTML = '<div class="zone-title"><h2 class="serif">On Rebuy</h2></div><div class="cards" aria-label="Loading listings">' + skelCards(4) + "</div>";
    $("#sidePanel").innerHTML = '<h2 class="serif">Also listed on</h2><div class="cards" aria-label="Loading external listings">' + skelCards(2) + "</div>";

    var af = filtersForAdapters(f);
    var nativeAdapter = Native.makeAdapter(Store, G);
    Promise.all([
      nativeAdapter.search(f.q, af),
      Ebay.searchVerbose(f.q, af),
      GSE.searchVerbose(f.q)
    ]).then(function (res) {
      var native = res[0], ebay = res[1], gse = res[2];
      // One true cross-source median: score every priced item against it.
      var combo = native.concat(ebay.items || [], gse.items || []);
      var med = D.median(combo.filter(function (i) { return i.price > 0; }).map(function (i) { return i.price; }));
      combo.forEach(function (it) {
        if (!it.price || it.price <= 0) {
          it._score = null; it._tier = null; it._basis = null; it._fair = null;
        } else {
          var info = D.dealInfoX(it, { medianPrice: med });
          it._score = info.score; it._tier = info.tier; it._basis = info.basis; it._fair = info.fair;
        }
        S.cache[it.id] = it;
      });
      var ebayItems = ebay.items || [], gseItems = gse.items || [];
      // Adapters filter prices unevenly (web results ignore the band), so
      // enforce the user's price band here — the Best Value hero must never
      // violate an explicit filter. Priceless items ("Price on site") stay:
      // we can't prove they're out of band.
      var priceOK = function (it) {
        if (f.min != null && it.price > 0 && it.price < f.min) return false;
        if (f.max != null && it.price > 0 && it.price > f.max) return false;
        return true;
      };
      native = native.filter(priceOK);
      ebayItems = ebayItems.filter(priceOK);
      gseItems = gseItems.filter(priceOK);
      // Sudbury-area only: keep eBay listings with a Greater Sudbury (P3) postal
      // code. Native Rebuy listings are already 25 km-filtered around the center.
      var ebayWidened = false, ebayHad = ebayItems.length;
      if (f.sudbury && ebay.mode === "live") {
        ebayItems = ebayItems.filter(function (it) { return Ebay.isSudburyArea(it); });
        ebayWidened = ebayHad > 0 && ebayItems.length === 0;
      }
      var sortFn = function (a, b) { return 0; };
      if (f.sort === "price-asc") sortFn = function (a, b) { return a.price - b.price; };
      else if (f.sort === "price-desc") sortFn = function (a, b) { return b.price - a.price; };
      else if (f.sort === "newest") sortFn = function (a, b) { return (b.listedAt || "") < (a.listedAt || "") ? -1 : 1; };
      else if (f.sort === "distance") sortFn = function (a, b) { return (a.distanceKm == null ? 1e9 : a.distanceKm) - (b.distanceKm == null ? 1e9 : b.distanceKm); };
      else sortFn = function (a, b) { return (b._score || 0) - (a._score || 0); };
      native.sort(sortFn); ebayItems.sort(sortFn); gseItems.sort(sortFn);

      // Best value spotlight: top deal score across every visible source
      // (respects the Sudbury filter above).
      var best = null;
      [native, ebayItems, gseItems].forEach(function (arr) {
        arr.forEach(function (it) {
          if (it._score != null && (!best || it._score > best._score)) best = it;
        });
      });
      if (best) {
        var drop = function (arr) { return arr.filter(function (it) { return it.id !== best.id; }); };
        native = drop(native); ebayItems = drop(ebayItems); gseItems = drop(gseItems);
      }

      var meta = native.length + " on Rebuy · " + ebayItems.length + " on eBay" +
        (ebay.mode === "demo" ? " (demo)" : " (live)") + " · " + gseItems.length + " web results" +
        (gse.quota ? " (paused — quota)" : gse.mode === "demo" ? " (demo)" : " (live)");
      $("#resultsMeta").textContent = meta;

      renderMainZone(f, native, best, med);
      renderSidePanel(f, { ebay: ebay, ebayItems: ebayItems, gse: gse, gseItems: gseItems, ebayWidened: ebayWidened, sudbury: f.sudbury, best: best, med: med });
      wireCompareBoxes(view);
      renderTray();
    }).catch(function (err) {
      $("#mainZone").innerHTML = '<div class="empty"><p class="serif">Something hiccupped.</p><p>' + esc(String((err && err.message) || err)) + "</p></div>";
    });
  }

  // Featured "Best value" hero: the single best deal score across all sources.
  // Carries a plain-language reason line and honest source/demo labeling.
  function bestValueHTML(it, ref) {
    var isNative = it.source === "rebuy";
    var url = isNative ? "#/listing/" + esc(it.id) : (it.url || "#");
    var label = isNative ? "On Rebuy" : (it.source === "ebay" ? "eBay" : (it.sourceLabel || "Web"));
    var tab = isNative ? "" : ' target="_blank" rel="noopener"';
    var reason = bestValueReason(it, ref);
    return '<section class="best-value" aria-label="Best value pick">' +
      '<div class="bv-badge">' + IC.icon("badge-check", 15) + " Best value" + demoPill(it) + "</div>" +
      shopMediaHTML(it, url, !isNative, label.charAt(0).toUpperCase()) +
      '<div class="shop-body">' +
      mktRowHTML(label) +
      '<h3 class="shop-title"><a href="' + url + '"' + tab + ">" + esc(it.title) + "</a></h3>" +
      priceRowHTML(it) +
      (it._tier ? '<div class="shop-badges">' + dealBadge(it) + "</div>" : "") +
      (reason ? '<p class="bv-reason">' + esc(reason) + "</p>" : "") +
      '<div class="shop-actions"><a class="btn btn-primary btn-sm" href="' + url + '"' + tab + ">" +
      (isNative ? "View listing" : "View on " + esc(label)) + "</a>" +
      compareCheckHTML(it) + "</div></div></section>";
  }
  // Plain-language "why this pick" — derived from real numbers only. Never
  // claims a saving it can't compute (price missing, no reference).
  function bestValueReason(it, ref) {
    if (!it.price || it.price <= 0 || !ref || ref <= 0) return "";
    var diff = Math.round(ref - it.price);
    if (diff <= 0)
      return "The strongest pick of what's around — " + it._tier.label.toLowerCase() + " at this price.";
    var basis = it._basis === "absolute" ? "fair market value" : "the going rate";
    return "$" + diff.toLocaleString("en-CA") + " below " + basis + (it.condition ? " for this condition" : "") + ".";
  }

  function renderMainZone(f, native, best, med) {
    var showMain = f.src === "all" || f.src === "rebuy";
    var mz = $("#mainZone");
    if (!showMain) { mz.innerHTML = ""; return; }
    var html = (best ? bestValueHTML(best, best._fair || med) : "") +
      '<div class="zone-title"><h2 class="serif">On Rebuy</h2>' +
      '<span class="count">' + native.length + ' nearby</span></div>' +
      '<p><span class="beta-badge">Beta: showing items within ' + G.getRadiusKm() + ' km</span></p>' +
      (native.length ? '<div class="cards">' + native.map(cardHTML).join("") + "</div>"
        : '<div class="empty"><p class="serif">Nothing on Rebuy matches — yet.</p>' +
          '<p>Check “Also listed on” beside, or <a href="#/sell">be the first to list it</a>.</p></div>');
    mz.innerHTML = html;
    wireCompareBoxes(mz);
  }

  function modeNote(r, settingsHint) {
    if (r.mode === "live" && !r.quota)
      return '<div class="mode-note">Live results — real listings, updated just now.</div>';
    if (r.quota)
      return '<div class="mode-note demo">' + esc(r.notice || "External results paused — quota.") + "</div>";
    return '<div class="mode-note demo">Demo results — <a href="#/settings">' + esc(settingsHint) + "</a> for live listings.</div>";
  }

  // Calm dot colour per marketplace (stable across renders).
  function mktHue(label) {
    var h = 0, s = String(label || "web");
    for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
    return h;
  }

  // Grouped "Across the second-hand web" markup: one sub-header per marketplace
  // (dot + name + count), groups ordered by count. Empty → "" (zone hides).
  function webGroupsHTML(items) {
    var groups = GSE.groupByMarketplace(items);
    if (!groups.length) return "";
    return groups.map(function (g) {
      return '<div class="market-group">' +
        '<div class="mkt-head"><span class="mkt-dot" style="background:hsl(' + mktHue(g.label) + ',42%,52%)"></span>' +
        '<span class="mkt-name">' + esc(g.label) + '</span><span class="mkt-count">' + g.items.length + "</span></div>" +
        '<div class="cards">' + g.items.map(extCardHTML).join("") + "</div></div>";
    }).join("");
  }

  // Zone 3: chip row of every deep-link marketplace.
  function deepLinkChipsHTML(q) {
    return '<div class="search-chips">' +
      DL.links(q).map(function (l) {
        return '<a class="search-chip" href="' + esc(l.url) + '" target="_blank" rel="noopener">' +
          esc(l.label) + '<span class="arrow" aria-hidden="true">' + IC.icon("arrow-up-right", 14) + "</span></a>";
      }).join("") + "</div>";
  }

  function renderSidePanel(f, R) {
    var sp = $("#sidePanel");
    var q = f.q;
    var showEbay = f.src === "all" || f.src === "ebay";
    var showWeb = f.src === "all" || f.src === "web";
    var html = "<h2 class=\"serif\">Also listed on</h2>";
    // Graceful widen-out: when the Sudbury-area filter ate every eBay result,
    // offer one tap to see all Canadian listings for the same search.
    var widenHash = "#/search?q=" + encodeURIComponent(q) + "&cat=any&cond=any&sort=deal&src=" +
      (f.src === "all" ? "all" : "ebay") + "&sudbury=0";
    function widenEmptyHTML() {
      return '<div class="empty"><p class="serif">No Sudbury-area eBay listings for this search.</p>' +
        '<p><a class="btn btn-soft btn-sm" href="' + widenHash + '">Show all Canadian results</a></p></div>';
    }

    if (f.src === "rebuy") { sp.innerHTML = html + '<p class="hint">Showing only Rebuy listings. Switch the source filter to compare elsewhere.</p>'; return; }

    if (showEbay) {
      html += '<div class="tier-label">' + (R.ebay.mode === "live" && !R.ebay.quota ? "eBay · live prices" : "eBay") +
        (R.sudbury && R.ebay.mode === "live" ? " · Sudbury area" : "") + "</div>";
      html += modeNote(R.ebay, "add your free eBay key in Settings");
      if (R.ebay.notice && R.ebay.mode === "demo")
        html += '<div class="mode-note demo">' + esc(R.ebay.notice) + "</div>";
      if (R.ebayItems.length) {
        html += '<div class="cards">' + R.ebayItems.map(extCardHTML).join("") + "</div>";
      } else if (R.ebayWidened) {
        html += widenEmptyHTML();
      } else {
        html += '<p class="hint">No eBay matches for this search.</p>';
      }
    }
    if (showWeb) {
      html += '<div class="tier-label">Across the second-hand web</div>';
      html += modeNote(R.gse, "add your free Google key in Settings");
      if (!R.gse.quota) {
        var groups = webGroupsHTML(R.gseItems);
        html += groups || '<p class="hint">No web matches for this search.</p>';
      }
      html += '<div class="tier-label">Search directly on</div>' +
        deepLinkChipsHTML(q) +
        '<p class="honest-note">' + esc(DL.HONEST_NOTE) + "</p>";
    }
    if (f.src === "ebay" || f.src === "web") {
      // single-tier focus: render rows large in main column instead
      var mz = $("#mainZone");
      var items = f.src === "ebay" ? R.ebayItems : R.gseItems;
      var r = f.src === "ebay" ? R.ebay : R.gse;
      var isLiveEbay = f.src === "ebay" && r.mode === "live" && !r.quota;
      // The best-value pick was lifted out of the lists above — keep it
      // visible here instead of vanishing in focused views.
      var focusHero = (R.best && R.best.source === f.src) ? bestValueHTML(R.best, R.best._fair || R.med) : "";
      mz.innerHTML = '<div class="zone-title"><h2 class="serif">' +
        (f.src === "ebay" ? (isLiveEbay ? "eBay · live prices" : "eBay") : "Across the second-hand web") +
        '</h2><span class="count">' + items.length + "</span></div>" +
        modeNote(r, "add your free key in Settings") + focusHero +
        (items.length
          ? (f.src === "web" ? webGroupsHTML(items) : '<div class="cards">' + items.map(extCardHTML).join("") + "</div>")
          : (f.src === "ebay" && R.ebayWidened ? widenEmptyHTML()
            : '<div class="empty"><p class="serif">No matches here.</p></div>')) +
        (f.src === "web" ? '<div class="tier-label">Search directly on</div>' +
          deepLinkChipsHTML(q) + '<p class="honest-note">' + esc(DL.HONEST_NOTE) + "</p>" : "");
      sp.innerHTML = "<h2 class=\"serif\">Also listed on</h2><p class=\"hint\">Focused view — switch the source filter back to “All” to compare all sources at once.</p>";
      wireCompareBoxes(mz);
      return;
    }
    sp.innerHTML = html;
    wireCompareBoxes(sp);
  }

  // ============================================================ LISTING DETAIL
  function renderListing(id) {
    var l = Store.getListing(id);
    if (!l) {
      view.innerHTML = '<div class="empty"><p class="serif">That listing is gone.</p><p><a href="#/">Back to search</a></p></div>';
      return;
    }
    var n = Native.normalize(l);
    if (S.center) n.distanceKm = Math.round(G.haversineKm(S.center.lat, S.center.lng, l.lat, l.lng) * 10) / 10;
    var info = D.dealInfo({ price: l.price, newPrice: l.newPrice, year: l.year, category: l.category, condition: l.condition, soldComps: l.soldComps });
    n._score = info.score; n._tier = info.tier; n._basis = info.basis; n._fair = info.fair;
    S.cache[n.id] = n;
    var th = D.autoThresholds({ price: l.price, newPrice: l.newPrice, year: l.year, category: l.category, condition: l.condition, soldComps: l.soldComps });
    var suggest = D.suggestedOffer({ price: l.price, newPrice: l.newPrice, year: l.year, category: l.category, condition: l.condition, soldComps: l.soldComps });
    var range = D.offerRange({ price: l.price, newPrice: l.newPrice, year: l.year, category: l.category, condition: l.condition, soldComps: l.soldComps });
    var photos = l.photos && l.photos.length ? l.photos : [l.photo];
    var checked = S.compareIds.indexOf(n.id) >= 0;

    view.innerHTML =
      '<p><a class="back-link" href="javascript:history.back()">' + IC.icon("arrow-left", 15) + ' Back to results</a></p>' +
      '<div class="detail-grid"><div>' +
      '<img class="detail-photo" id="detailPhoto" src="' + esc(photos[0]) + '" alt="' + esc(l.title) + '">' +
      (photos.length > 1 ? '<div class="photo-preview">' + photos.map(function (p, i) {
        return '<img src="' + esc(p) + '" alt="Photo ' + (i + 1) + '" data-ph="' + i + '" style="cursor:pointer">';
      }).join("") + "</div>" : "") +
      '<div class="panel" style="margin-top:1.1rem"><h3 class="serif">About this item</h3><p>' + esc(l.description) + "</p>" +
      '<dl class="kv"><dt>Condition</dt><dd>' + esc(condLabel(l.condition)) + "</dd>" +
      "<dt>Year</dt><dd>" + esc(l.year || "—") + "</dd><dt>Category</dt><dd>" + esc(l.category) +
      "</dd><dt>Listed</dt><dd>" + esc(timeAgo(l.postedAt)) + "</dd><dt>Distance</dt><dd>" + esc(distLabel(n.distanceKm)) + "</dd></dl></div>" +
      '<div class="panel"><h3 class="serif">Sold recently nearby</h3>' +
      (l.soldComps && l.soldComps.length ? '<ul class="comps-list">' + l.soldComps.map(function (c) { return "<li>" + money(c) + "</li>"; }).join("") + "</ul>" +
      '<p class="hint" style="margin-top:.6em">Similar items that sold locally — what the market actually paid.</p>'
        : '<p class="hint">No local comps for this one yet.</p>') + "</div>" +
      "</div><div>" +
      mktRowHTML("On Rebuy", 115) +
      '<h1 class="serif" style="font-size:1.8rem">' + esc(l.title) +
      (l.reduced ? '<span class="reduced-flag">Reduced</span>' : "") + "</h1>" +
      '<p><span class="detail-price">' + money(l.price) + "</span> " + dealBadge(n) + "</p>" +
      '<p class="hint">Fair market value ≈ ' + money(n._fair) + " · " + esc(distLabel(n.distanceKm)) + "</p>" +
      '<div class="seller-card"><h3 class="serif">Seller</h3><div class="seller-row"><span class="avatar">' +
      esc(l.seller.name.charAt(0)) + '</span><div><strong>' + esc(l.seller.name) + "</strong><br>" +
      (l.seller.verified ? '<span class="verified">' + IC.icon("badge-check", 14) + ' Verified seller</span><br>' : "") +
      (l.seller.rating != null ? starsHTML(l.seller.rating, (+l.seller.rating).toFixed(1) + " · " + l.seller.trades + " trades") : '<span class="hint">' + l.seller.trades + " trades</span>") + "</div></div></div>" +
      '<div class="panel"><div class="tier-label">Haggle Engine</div><h3 class="serif">What should I offer?</h3>' +
      "<p>Data-backed suggestion: <strong>" + money(suggest) + "</strong></p>" +
      '<p class="hint">Fair range ' + money(range.low) + "–" + money(range.high) +
      ". Most " + esc(l.category) + " listings settle around " + money(n._fair) + ".</p>" +
      '<button class="btn btn-primary" id="offerBtn">Make an offer</button> ' +
      '<button class="btn btn-ghost" id="msgBtn">Message seller</button></div>' +
      '<div class="panel"><h3 class="serif">Get it</h3>' +
      '<button class="btn btn-soft" id="boughtBtn">I bought this — log it</button> ' +
      '<label class="compare-check' + (checked ? " on" : "") + '"><input type="checkbox" id="cmpDetail"' +
      (checked ? " checked" : "") + "> Compare</label>" +
      '<div class="zero-cut"><strong>Rebuy never takes a cut.</strong> You pay the seller in person — cash or e-transfer at a public meetup. No payments, no fees, ever.</div></div>' +
      '<div class="safety"><strong>Stay safe out there</strong><ul>' +
      "<li>Meet in a public, well-lit place — daytime is best.</li>" +
      "<li>Bring a friend, or tell someone where you're going.</li>" +
      "<li>Check the item works before money changes hands.</li>" +
      "<li>Nearby safe spots: " + Seed.MEETUPS.map(function (m) { return esc(m.name); }).join(" · ") + ".</li>" +
      "</ul></div>" +
      "</div></div>";

    $all("[data-ph]").forEach(function (t) {
      t.addEventListener("click", function () { $("#detailPhoto").src = photos[+t.getAttribute("data-ph")]; Sound.click(); });
    });
    $("#cmpDetail").addEventListener("change", function (e) {
      var ok = toggleCompare(n.id, e.target.checked);
      if (!ok) e.target.checked = false;
      else { e.target.closest(".compare-check").classList.toggle("on", e.target.checked); Sound.toggle(e.target.checked); }
    });
    $("#offerBtn").addEventListener("click", function () { Sound.click(); offerModal(l, n, th, suggest); });
    $("#msgBtn").addEventListener("click", function () { Sound.click(); messageModal(l); });
    $("#boughtBtn").addEventListener("click", function () { Sound.click(); boughtModal(l); });
    renderTray();
  }

  function offerModal(l, n, th, suggest) {
    var box = openModal(
      "<h2 class=\"serif\">Make an offer</h2>" +
      "<p><strong>" + esc(l.title) + "</strong> · listed at " + money(l.price) + "</p>" +
      '<div class="guidance">Haggle Engine suggests <strong>' + money(suggest) + "</strong><br>" +
      '<span class="hint">Offers at ' + money(th.acceptAt) + "+ auto-accept · below " + money(th.declineBelow) + " the seller usually counters.</span></div>" +
      '<label class="field" style="margin-top:1rem"><span>Your offer ($)</span>' +
      '<input type="number" id="offerAmt" min="5" value="' + suggest + '"></label>' +
      '<div class="zero-cut"><strong>Zero commission.</strong> If they accept, you pay the seller in person.</div>' +
      '<div class="modal-actions"><button class="btn btn-ghost" id="mCancel">Cancel</button>' +
      '<button class="btn btn-primary" id="mSend">Send offer</button></div>');
    $("#mCancel", box).addEventListener("click", closeModal);
    $("#mSend", box).addEventListener("click", function () {
      var amt = Math.max(5, Math.round(+$("#offerAmt", box).value || 0));
      if (!amt) { Sound.error(); toast("Enter an offer amount.", "error"); return; }
      var o = OF.newOffer(l.id, amt, "you");
      var listing = { price: l.price, auto: { acceptAt: th.acceptAt, declineBelow: th.declineBelow } };
      OF.applyResponse(o, OF.autoRespond(o, listing));
      Store.addOffer(o);
      closeModal(); Sound.success();
      toast(OF.statusLabel(o.status) + (o.counterTo ? " — seller counters at " + money(o.counterTo) : "") + ".", "success");
      location.hash = "#/offers";
    });
  }

  // Calm, deterministic seller auto-replies — keeps the thread alive while
  // real sellers are away. Keyword-matched, never random.
  function sellerReply(text) {
    var t = (text || "").toLowerCase();
    if (/available|still have|still for sale/.test(t))
      return "Hi! Yes, it's still available. Happy to arrange a time that works for you.";
    if (/deliver|ship|mail it/.test(t))
      return "I don't ship, sorry — in-person pickup only. I can meet somewhere public that suits you.";
    if (/price|offer|discount|lower|negotiat/.test(t))
      return "I'm fairly firm on the price, but feel free to make an offer through the listing and I'll consider it.";
    if (/meet|pick ?up|when|where|this week/.test(t))
      return "I'm usually free weekday evenings and weekends. A public meetup works best — there's a list of safe spots on the listing page.";
    if (/condition|works|working|scratch|damage|battery/.test(t))
      return "It's in the condition described — everything works as it should. You're welcome to check it over before we finalize.";
    return "Thanks for reaching out! I'll get back to you shortly — feel free to ask anything else about it.";
  }

  function messageModal(l) {
    var box = openModal(
      "<h2 class=\"serif\">Message " + esc(l.seller.name) + "</h2>" +
      '<p class="hint">Chat here — the seller gets your messages, and their replies land in this thread. <strong>Rebuy never takes a cut:</strong> you pay in person.</p>' +
      '<div class="msg-thread" id="msgThread" aria-live="polite"></div>' +
      '<div class="msg-compose"><input type="text" id="msgInput" placeholder="Write a message…" aria-label="Write a message" maxlength="500">' +
      '<button class="btn btn-primary btn-sm" id="mSendMsg">Send</button></div>' +
      '<div class="modal-actions"><button class="btn btn-ghost" id="mCancel">Close</button></div>');
    function paint() {
      var thread = $("#msgThread", box);
      var msgs = Store.messagesFor(l.id);
      thread.innerHTML = msgs.length
        ? msgs.map(function (m) {
          return '<div class="msg ' + (m.from === "you" ? "mine" : "theirs") + '"><p>' + esc(m.text) +
            '</p><span class="hint">' + esc(m.from === "you" ? "You" : l.seller.name) + " · " + esc(timeAgo(m.at)) + "</span></div>";
        }).join("")
        : '<p class="hint">No messages yet — say hello. A good opener: ask if it\'s still available.</p>';
      thread.scrollTop = thread.scrollHeight;
    }
    function send() {
      var input = $("#msgInput", box);
      var text = input.value.trim();
      if (!text) return;
      Store.addMessage({ listingId: l.id, from: "you", text: text });
      input.value = "";
      Sound.toggle(true);
      paint();
      // Seller replies shortly — deterministic, keyword-matched.
      setTimeout(function () {
        if (!document.body.contains(box)) return;
        Store.addMessage({ listingId: l.id, from: "seller", text: sellerReply(text) });
        Sound.toggle(false);
        paint();
      }, 900);
    }
    paint();
    $("#mSendMsg", box).addEventListener("click", send);
    $("#msgInput", box).addEventListener("keydown", function (e) { if (e.key === "Enter") send(); });
    $("#mCancel", box).addEventListener("click", closeModal);
  }

  function boughtModal(l) {
    var box = openModal(
      "<h2 class=\"serif\">Log your purchase</h2>" +
      "<p><strong>" + esc(l.title) + "</strong></p>" +
      '<label class="field"><span>You paid ($)</span><input type="number" id="bpPaid" min="1" value="' + l.price + '"></label>' +
      '<label class="field"><span>New retail price ($) — for your “saved vs new” total</span>' +
      '<input type="number" id="bpNew" min="0" value="' + (l.newPrice || "") + '" placeholder="Optional"></label>' +
      '<div class="modal-actions"><button class="btn btn-ghost" id="mCancel">Cancel</button>' +
      '<button class="btn btn-primary" id="mLog">Log it</button></div>');
    $("#mCancel", box).addEventListener("click", closeModal);
    $("#mLog", box).addEventListener("click", function () {
      var paid = Math.max(1, Math.round(+$("#bpPaid", box).value || 0));
      var newRef = Math.max(0, Math.round(+$("#bpNew", box).value || 0));
      Store.addPurchase({ pricePaid: paid, newRef: newRef, dateISO: new Date().toISOString().slice(0, 10), category: l.category, title: l.title });
      closeModal(); Sound.success();
      toast("Logged — nice find. See it in your Spend tab.", "success");
    });
  }

  // ============================================================ COMPARE
  function renderCompare() {
    var items = S.compareIds.map(function (id) { return S.cache[id]; }).filter(Boolean);
    if (items.length < 2) {
      view.innerHTML = '<div class="view-narrow" style="margin:0 auto"><div class="empty">' +
        '<p class="serif">Pick at least two listings to compare.</p>' +
        '<p>Tick the <strong>Compare</strong> checkbox on any search result — from Rebuy, eBay, or the web.</p>' +
        '<p><a class="btn btn-primary" href="#/">Find something to compare</a></p></div></div>';
      return;
    }
    function bestIdx(fn, better) {
      var bi = 0;
      items.forEach(function (it, i) { if (better(fn(it), fn(items[bi]))) bi = i; });
      return bi;
    }
    var biPrice = bestIdx(function (it) { return it.price || 1e12; }, function (a, b) { return a < b; });
    var biScore = bestIdx(function (it) { return it._score || 0; }, function (a, b) { return a > b; });
    var rows = [
      { label: "Price", fn: function (it, i) { return "<strong>" + money(it.price) + "</strong>"; }, best: biPrice },
      { label: "Deal score", fn: function (it) { return dealBadge(it); }, best: biScore },
      { label: "Condition", fn: function (it) { return esc(condLabel(it.condition)); } },
      { label: "Distance", fn: function (it) { return esc(distLabel(it.distanceKm)); } },
      { label: "Source", fn: function (it) { return sourceBadge(it); } },
      {
        label: "Get it", fn: function (it) {
          return it.source === "rebuy"
            ? '<a class="btn btn-primary btn-sm" href="#/listing/' + esc(it.id) + '">View & offer</a>'
            : '<a class="btn btn-ghost btn-sm" href="' + esc(it.url) + '" target="_blank" rel="noopener">Open listing ' + IC.icon("arrow-up-right", 14) + "</a>";
        }
      }
    ];
    view.innerHTML =
      '<section class="results-head"><h1 class="serif">Side by side</h1>' +
      '<p class="results-meta">The calm way to choose. Best price and best deal are highlighted.</p></section>' +
      '<div class="cmp-scroll"><table class="cmp-table"><thead><tr><th></th>' +
      items.map(function (it) {
        return "<th>" + (it.image ? '<img src="' + esc(it.image) + '" alt="" loading="lazy"><br>' : "") + esc(it.title) + "</th>";
      }).join("") + "</tr></thead><tbody>" +
      rows.map(function (r) {
        return "<tr><th>" + r.label + "</th>" + items.map(function (it, i) {
          return '<td class="' + (r.best === i ? "best-cell" : "") + '">' + r.fn(it, i) + "</td>";
        }).join("") + "</tr>";
      }).join("") + "</tbody></table></div>" +
      '<p style="margin-top:1rem"><button class="btn btn-ghost" id="cmpClear">Clear selection</button></p>';
    $("#cmpClear").addEventListener("click", function () {
      S.compareIds = []; persistCompare(); renderTray(); Sound.toggle(false); route();
    });
    renderTray();
  }

  // ============================================================ SELL (secondary)
  function compsFor(cat) {
    var vals = [];
    Store.listings().forEach(function (l) { if (l.category === cat && l.soldComps) vals = vals.concat(l.soldComps); });
    return vals;
  }
  function renderSell() {
    view.innerHTML =
      '<div class="view-narrow" style="margin:0 auto"><section class="results-head">' +
      '<h1 class="serif">Sell on Rebuy</h1>' +
      '<p class="results-meta">The cozy corner of Rebuy. List in a minute — <strong>zero commission, always.</strong></p></section>' +
      '<div class="steps" aria-hidden="true">' + [1, 2, 3, 4, 5].map(function (i) {
        return '<span class="step-dot' + (i === 1 ? " now" : "") + '"></span>';
      }).join("") + "</div>" +
      '<div class="panel"><h3 class="serif">1 · What kind of thing is it?</h3>' +
      '<label class="field"><span>Category</span><select id="sCat">' +
      CATS.map(function (c) { return '<option value="' + c + '">' + esc(c) + "</option>"; }).join("") + "</select></label></div>" +
      '<div class="panel"><h3 class="serif">2 · Photos</h3>' +
      '<label class="field"><span>Add a photo or two (stored on your device only)</span>' +
      '<input type="file" id="sPhoto" accept="image/*" multiple></label><div class="photo-preview" id="sPreview"></div></div>' +
      '<div class="panel"><h3 class="serif">3 · Tell its second story</h3>' +
      '<label class="field"><span>Title</span><input type="text" id="sTitle" placeholder="e.g. ThinkPad T480 — i5, 16GB, great battery" maxlength="80"></label>' +
      '<label class="field"><span>Description</span><textarea id="sDesc" rows="3" placeholder="Condition details, what\'s included, why you\'re parting with it…"></textarea></label>' +
      '<label class="field"><span>Year bought</span><input type="number" id="sYear" min="1990" max="2026" value="2020"></label></div>' +
      '<div class="panel"><h3 class="serif">4 · Condition</h3><div class="cond-picker" id="sCond">' +
      CONDS.map(function (c, i) {
        return '<button type="button" data-cond="' + c[0] + '" aria-pressed="' + (i === 1) + '">' + c[1] + "</button>";
      }).join("") + "</div></div>" +
      '<div class="panel"><h3 class="serif">5 · Price it with live guidance</h3>' +
      '<label class="field"><span>What did it cost new? ($) — optional, sharpens guidance</span>' +
      '<input type="number" id="sNew" min="0" placeholder="e.g. 1450"></label>' +
      '<label class="field"><span>Your asking price ($)</span><input type="number" id="sPrice" min="5" placeholder="e.g. 320"></label>' +
      '<div class="guidance" id="sGuide">Fill in the details above — live price guidance appears here.</div>' +
      '<div class="zero-cut"><strong>Zero commission.</strong> Whatever you agree with the buyer is 100% yours.</div></div>' +
      '<p><button class="btn btn-primary" id="sPost">List it on Rebuy</button></p></div>';

    var photos = [];
    var cond = "good";
    $all("#sCond button").forEach(function (b) {
      b.addEventListener("click", function () {
        $all("#sCond button").forEach(function (x) { x.setAttribute("aria-pressed", "false"); });
        b.setAttribute("aria-pressed", "true");
        cond = b.getAttribute("data-cond");
        Sound.toggle(true); updateGuide();
      });
    });
    $("#sPhoto").addEventListener("change", function (e) {
      var files = Array.prototype.slice.call(e.target.files || []).slice(0, 4);
      photos = [];
      $("#sPreview").innerHTML = "";
      files.forEach(function (file) {
        var img = new Image();
        img.onload = function () {
          var scale = Math.min(1, 1200 / Math.max(img.width, img.height));
          var c = document.createElement("canvas");
          c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
          c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
          var url = c.toDataURL("image/jpeg", 0.8);
          photos.push(url);
          var t = document.createElement("img");
          t.src = url; t.alt = "Preview";
          $("#sPreview").appendChild(t);
          URL.revokeObjectURL(img.src);
        };
        img.src = URL.createObjectURL(file);
      });
    });
    function updateGuide() {
      var cat = $("#sCat").value, year = +$("#sYear").value || 2020;
      var orig = +$("#sNew").value || 0, price = +$("#sPrice").value || 0;
      var comps = compsFor(cat);
      var fair;
      if (orig > 0) {
        fair = D.fairPrice({ price: price || orig, newPrice: orig, year: year, category: cat, condition: cond, soldComps: comps });
      } else if (comps.length) {
        fair = Math.round(D.median(comps) * D.conditionMult(cond));
      } else fair = null;
      var g = $("#sGuide");
      if (!fair) { g.innerHTML = "Add a category (and ideally the original price) for guidance."; return; }
      var listAt = D.round5(fair * 1.08), expect = D.round5(fair);
      var verdict = "";
      if (price > 0) {
        var ratio = price / fair;
        verdict = ratio < 0.9 ? " — that's a <strong>quick-sale price</strong>, expect messages fast." :
          ratio > 1.2 ? " — that's <strong>ambitious</strong>; expect haggling." :
          " — that's <strong>right in the pocket</strong>.";
      }
      g.innerHTML = "Fair market value ≈ <strong>" + money(fair) + "</strong><br>" +
        "List at <strong>" + money(listAt) + "</strong> to sell within a week — most " + esc(cat) +
        " settles near <strong>" + money(expect) + "</strong>." + verdict;
    }
    ["sCat", "sYear", "sNew", "sPrice"].forEach(function (id) {
      $("#" + id).addEventListener("input", updateGuide);
    });
    $("#sPost").addEventListener("click", function () {
      var title = $("#sTitle").value.trim();
      if (!title) { Sound.error(); toast("Give your listing a title first.", "error"); $("#sTitle").focus(); return; }
      var price = Math.max(5, Math.round(+$("#sPrice").value || 0));
      if (!price) { Sound.error(); toast("Set an asking price (min $5).", "error"); $("#sPrice").focus(); return; }
      var l = Store.addListing({
        title: title, category: $("#sCat").value, price: price,
        newPrice: +$("#sNew").value || null, condition: cond, year: +$("#sYear").value || 2020,
        lat: S.center.lat + (Math.random() - 0.5) * 0.06, lng: S.center.lng + (Math.random() - 0.5) * 0.06,
        area: S.center.label,
        seller: { name: "You", verified: false, rating: 5.0, trades: 0 },
        description: $("#sDesc").value.trim() || "No description yet.",
        photo: photos[0] || Seed.art($("#sCat").value), photos: photos.length ? photos : null,
        soldComps: compsFor($("#sCat").value), reduced: false, auto: null
      });
      Sound.success();
      toast("Listed! Checking your saved alerts…", "success");
      checkAlerts(l);
      location.hash = "#/listing/" + l.id;
    });
    updateGuide();
  }

  function checkAlerts(listing) {
    var hits = Store.alerts().filter(function (a) {
      return Native.matches(listing, a.query, a.filters || {});
    });
    if (!hits.length) return;
    Sound.notify();
    hits.forEach(function (a) {
      toast("Your \"" + a.query + "\" alert just matched — " + listing.title, "success");
    });
    var dot = document.getElementById("alertsDot");
    if (dot) dot.hidden = false;
    if ("Notification" in window && Notification.permission === "granted") {
      try {
        new Notification("Rebuy alert", {
          body: hits.length === 1
            ? "Your \"" + hits[0].query + "\" alert found a match: " + listing.title
            : hits.length + " of your saved searches matched a new listing: " + listing.title
        });
      } catch (e) {}
    }
  }

  // ============================================================ SPEND
  function renderSpend() {
    var purchases = Store.purchases();
    var buckets = SP.bucketByMonth(purchases);
    var ranges = SP.availableRanges(buckets);
    var range = ranges.indexOf("1Y") >= 0 ? "1Y" : "MAX";
    var saved = SP.totalSaved(purchases);
    var last30 = SP.last30Days(purchases);

    view.innerHTML =
      '<div class="view-narrow" style="margin:0 auto"><section class="results-head">' +
      '<h1 class="serif">Your spend, gently tracked</h1>' +
      '<p class="results-meta">Every dollar you didn\'t give to retail.</p></section>' +
      '<div class="spend-hero"><div><div class="lbl">Saved vs buying new</div><div class="big" id="savedHero">' + money(0) + "</div>" +
      '<p class="hint">The whole point of secondhand.</p></div>' +
      '<div><div class="lbl">Last 30 days</div><div class="big" id="last30Hero" style="color:var(--clay-deep)">' + money(0) + "</div>" +
      '<p class="hint">Logged purchases only.</p></div></div>' +
      '<div class="panel"><h3 class="serif">Monthly spend</h3>' +
      '<div class="range-pills" id="rangePills">' + ranges.map(function (r) {
        return '<button type="button" class="chip" data-range="' + r + '" aria-pressed="' + (r === range) + '">' + r + "</button>";
      }).join("") + "</div>" +
      '<canvas class="chart" id="spendChart" height="220" aria-label="Monthly spend chart"></canvas></div>' +
      '<div class="panel"><h3 class="serif">By category</h3><canvas class="chart" id="catChart" aria-label="Spend by category"></canvas></div>' +
      '<div class="panel"><h3 class="serif">Log a purchase</h3>' +
      '<div class="key-row"><label class="field"><span>What</span><input type="text" id="pTitle" placeholder="e.g. ThinkPad T480"></label>' +
      '<label class="field"><span>Category</span><select id="pCat">' + CATS.map(function (c) {
        return '<option value="' + c + '">' + esc(c) + "</option>";
      }).join("") + "</select></label></div>" +
      '<div class="key-row"><label class="field"><span>You paid ($)</span><input type="number" id="pPaid" min="1"></label>' +
      '<label class="field"><span>New price ($) — optional</span><input type="number" id="pNew" min="0"></label></div>' +
      '<button class="btn btn-primary" id="pLog">Log purchase</button></div>' +
      (purchases.length ? '<div class="panel"><h3 class="serif">History</h3>' +
        purchases.slice().reverse().slice(0, 12).map(function (p) {
          return '<div class="offer-row"><div class="grow" style="flex:1"><strong>' + esc(p.title || p.category) +
            "</strong><br><span class=\"hint\">" + esc(p.dateISO) + " · " + esc(p.category) + "</span></div>" +
            "<strong>" + money(p.pricePaid) + "</strong></div>";
        }).join("") + "</div>" : "") + "</div>";

    // animated counters
    animateCount($("#savedHero"), saved);
    animateCount($("#last30Hero"), last30);

    function drawChart() {
      var b = SP.filterByRange(buckets, range);
      Charts.monthlyBars($("#spendChart"), b, { height: 220 });
    }
    drawChart();
    Charts.categoryBars($("#catChart"), SP.byCategory(purchases));
    $all("#rangePills .chip").forEach(function (c) {
      c.addEventListener("click", function () {
        $all("#rangePills .chip").forEach(function (x) { x.setAttribute("aria-pressed", "false"); });
        c.setAttribute("aria-pressed", "true");
        range = c.getAttribute("data-range");
        Sound.toggle(true); drawChart();
      });
    });
    $("#pLog").addEventListener("click", function () {
      var paid = Math.max(1, Math.round(+$("#pPaid").value || 0));
      if (!paid) { Sound.error(); toast("Enter what you paid.", "error"); return; }
      Store.addPurchase({
        pricePaid: paid, newRef: Math.max(0, Math.round(+$("#pNew").value || 0)),
        dateISO: new Date().toISOString().slice(0, 10),
        category: $("#pCat").value, title: $("#pTitle").value.trim() || $("#pCat").value
      });
      Sound.success(); toast("Logged.", "success"); route();
    });
  }
  function animateCount(el, target) {
    if (!el) return;
    if (reducedMotion()) { el.textContent = money(target); return; }
    var t0 = null, dur = 650;
    function frame(t) {
      if (!t0) t0 = t;
      var p = Math.min(1, (t - t0) / dur);
      var e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
      el.textContent = money(Math.round(target * e));
      if (p < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  // ============================================================ ALERTS
  function renderAlerts() {
    var alerts = Store.alerts();
    view.innerHTML =
      '<div class="view-narrow" style="margin:0 auto"><section class="results-head">' +
      '<h1 class="serif">Saved-search alerts</h1>' +
      '<p class="results-meta">We watch Rebuy for you. When a matching listing lands, you get a gentle ping.</p></section>' +
      '<div class="panel"><h3 class="serif">Notifications</h3>' +
      '<p class="hint">In-app pings always work. Browser notifications are optional.</p>' +
      '<button class="btn btn-soft" id="notifBtn">Enable browser notifications</button> ' +
      '<span class="hint" id="notifState"></span></div>' +
      (S.lastSearch && S.lastSearch.query ?
        '<div class="panel"><h3 class="serif">Save your last search</h3>' +
        '<p>“' + esc(S.lastSearch.query) + '”' +
        (S.lastSearch.filters.cat !== "any" ? " · " + esc(S.lastSearch.filters.cat) : "") +
        (S.lastSearch.filters.max ? " · under " + money(S.lastSearch.filters.max) : "") + " · within " + G.getRadiusKm() + " km</p>" +
        '<button class="btn btn-primary" id="saveSearchBtn">Save this search</button></div>' : "") +
      '<div class="panel"><h3 class="serif">Your alerts (' + alerts.length + ")</h3>" +
      (alerts.length ? alerts.map(function (a) {
        return '<div class="alert-row"><div class="grow"><strong>' + esc(a.query || "Everything") + "</strong><br>" +
          '<span class="hint">saved ' + esc(timeAgo(a.createdAt)) + "</span></div>" +
          '<button class="btn btn-ghost btn-sm" data-del="' + a.id + '">Remove</button></div>';
      }).join("") : '<p class="hint">No alerts yet. Search for something, then save it here.</p>') + "</div></div>";

    var ns = $("#notifState");
    function paintNotif() {
      ns.textContent = !("Notification" in window) ? "Not supported in this browser." :
        Notification.permission === "granted" ? "On — we'll ping you here too." :
        Notification.permission === "denied" ? "Blocked — check your browser's site settings." : "Off.";
    }
    paintNotif();
    $("#notifBtn").addEventListener("click", function () {
      if (!("Notification" in window)) { toast("This browser doesn't do notifications.", "error"); return; }
      Notification.requestPermission().then(function () { paintNotif(); Sound.toggle(true); });
    });
    var ssb = $("#saveSearchBtn");
    if (ssb) ssb.addEventListener("click", function () {
      Store.addAlert({ query: S.lastSearch.query, filters: S.lastSearch.filters });
      Sound.success(); toast("Alert saved. We'll ping you when it appears.", "success"); route();
    });
    $all("[data-del]").forEach(function (b) {
      b.addEventListener("click", function () {
        Store.removeAlert(b.getAttribute("data-del"));
        Sound.toggle(false); route();
      });
    });
    var dot = document.getElementById("alertsDot");
    if (dot) dot.hidden = true;
  }

  // ============================================================ OFFERS
  function renderOffers() {
    var offers = Store.offers().slice().reverse();
    view.innerHTML =
      '<div class="view-narrow" style="margin:0 auto"><section class="results-head">' +
      '<h1 class="serif">Your offers</h1>' +
      '<p class="results-meta">Structured haggling — every offer, counter, and outcome in one calm place.</p></section>' +
      '<div class="panel">' +
      (offers.length ? offers.map(function (o) {
        var l = Store.getListing(o.listingId);
        return '<div class="offer-row"><div style="flex:1"><strong>' + money(o.amount) + "</strong> on " +
          (l ? '<a href="#/listing/' + l.id + '">' + esc(l.title) + "</a>" : "a listing") + "<br>" +
          '<span class="hint">' + esc(timeAgo(o.createdAt)) +
          (o.counterTo ? " · seller counters at " + money(o.counterTo) : "") + "</span></div>" +
          '<span class="status-pill ' + o.status + '">' + esc(OF.statusLabel(o.status)) + "</span></div>";
      }).join("") : '<p class="hint">No offers yet. Find something you like and make one — the Haggle Engine will back you up.</p>') +
      "</div></div>";
  }

  // ============================================================ SETTINGS
  function renderSettings() {
    var ek = Ebay.getKeys(), gk = GSE.getKeys();
    var ebayOn = Ebay.hasKeys(), gseOn = GSE.hasKeys();
    view.innerHTML =
      '<div class="view-narrow" style="margin:0 auto"><section class="results-head">' +
      '<h1 class="serif">Settings</h1>' +
      '<p class="results-meta">Everything works in demo mode. Keys unlock live data — free, no card, stored only on this device.</p></section>' +

      '<div class="panel key-card"><h3 class="serif">eBay API key</h3>' +
      '<p class="hint">Your App ID is pre-filled below — just add the Cert ID (client secret) from <strong>developer.ebay.com → Application Keys</strong>. Free, no card. Unlocks <strong>live eBay results</strong> in “Also listed on”. Keys stay on this device only.</p>' +
      '<div class="key-row"><label class="field"><span>App ID (client ID)</span><input type="text" id="ebayId" value="' + esc((ek && ek.clientId) || "") + '" autocomplete="off"></label>' +
      '<label class="field"><span>Cert ID (client secret)</span><input type="text" id="ebaySecret" value="' + esc((ek && ek.clientSecret) || "") + '" autocomplete="off"></label></div>' +
      '<label class="field"><span>Marketplace</span><select id="ebayMkt"><option value="EBAY_CA"' + ((ek && ek.marketplace) !== "EBAY_US" ? " selected" : "") + '>Canada (EBAY_CA)</option>' +
      '<option value="EBAY_US"' + ((ek && ek.marketplace) === "EBAY_US" ? " selected" : "") + '>United States (EBAY_US)</option></select></label>' +
      '<button class="btn btn-primary btn-sm" id="ebaySave">Save eBay key</button> ' +
      '<button class="btn btn-ghost btn-sm" id="ebayClear">Remove</button>' +
      '<p class="status-line ' + (ebayOn ? "ok" : "off") + '" id="ebayStatus">' + IC.icon(ebayOn ? "circle-check" : "circle", 14) + " " + (ebayOn ? "Live eBay key saved — searches use real listings." : "Demo mode — add your free key for live eBay results.") + "</p></div>" +

      '<div class="panel key-card"><h3 class="serif">Google Search API key + Engine ID</h3>' +
      '<p class="hint">Free: Google Cloud Console → enable the Custom Search API (100 queries/day) for the key, then create a Programmable Search Engine at <strong>programmablesearchengine.google.com</strong> restricted to marketplace domains (kijiji.ca, craigslist.org, facebook.com/marketplace…). Unlocks <strong>cross-marketplace web results</strong>.</p>' +
      '<div class="key-row"><label class="field"><span>API key</span><input type="text" id="gseKey" value="' + esc((gk && gk.apiKey) || "") + '" autocomplete="off"></label>' +
      '<label class="field"><span>Search engine ID</span><input type="text" id="gseCx" value="' + esc((gk && gk.engineId) || "") + '" autocomplete="off"></label></div>' +
      '<button class="btn btn-primary btn-sm" id="gseSave">Save Google key</button> ' +
      '<button class="btn btn-ghost btn-sm" id="gseClear">Remove</button>' +
      '<p class="status-line ' + (gseOn ? "ok" : "off") + '">' + IC.icon(gseOn ? "circle-check" : "circle", 14) + " " + (gseOn ? "Live Google key saved — web results are real." : "Demo mode — add your free key for live web results.") + "</p></div>" +

      '<div class="panel key-card"><h3 class="serif">Location</h3>' +
      '<p class="hint">Currently searching within ' + G.getRadiusKm() + ' km of <strong>' + esc(S.center.label) + '</strong> (' + S.center.source + "). Rebuy is Sudbury-only for now — the pill always shows your real search area.</p>" +
      '<div class="key-row"><label class="field"><span>Search radius</span><select id="locRadius">' +
      G.RADII.map(function (r) {
        return '<option value="' + r + '"' + (G.getRadiusKm() === r ? " selected" : "") + ">" + r + " km</option>";
      }).join("") + "</select></label>" +
      '<label class="field"><span>Latitude</span><input type="number" step="any" id="locLat" value="' + S.center.lat + '"></label>' +
      '<label class="field"><span>Longitude</span><input type="number" step="any" id="locLng" value="' + S.center.lng + '"></label></div>' +
      '<label class="field"><span>Label</span><input type="text" id="locLabel" value="' + esc(S.center.label) + '"></label>' +
      '<button class="btn btn-soft btn-sm" id="locGps">Use my location</button> ' +
      '<button class="btn btn-soft btn-sm" id="locSudbury">Reset to Sudbury</button> ' +
      '<button class="btn btn-primary btn-sm" id="locSave">Save location</button></div>' +

      '<div class="panel key-card"><h3 class="serif">Sound</h3>' +
      '<p class="hint">Soft chimes for taps, filters, and good news. Never anything jarring.</p>' +
      '<button class="btn btn-soft btn-sm" id="sndToggle">' + (Sound.isMuted() ? "Unmute sounds" : "Mute sounds") + "</button></div>" +

      '<div class="panel key-card"><h3 class="serif">Demo data</h3>' +
      '<p class="hint">Restore the 24 starter listings around Sudbury. Your keys and settings are kept.</p>' +
      '<button class="btn btn-ghost btn-sm" id="reseed">Reset demo listings</button></div></div>';

    $("#ebaySave").addEventListener("click", function () {
      var id = $("#ebayId").value.trim(), sec = $("#ebaySecret").value.trim();
      if (!id || !sec) { Sound.error(); toast("Paste both the App ID and the Cert ID.", "error"); return; }
      Ebay.saveKeys(id, sec, $("#ebayMkt").value);
      Sound.success(); toast("eBay key saved — live results unlocked.", "success"); route();
    });
    $("#ebayClear").addEventListener("click", function () { Ebay.clearKeys(); Sound.toggle(false); route(); });
    $("#gseSave").addEventListener("click", function () {
      var k = $("#gseKey").value.trim(), cx = $("#gseCx").value.trim();
      if (!k || !cx) { Sound.error(); toast("Paste both the API key and the engine ID.", "error"); return; }
      GSE.saveKeys(k, cx);
      Sound.success(); toast("Google key saved — live web results unlocked.", "success"); route();
    });
    $("#gseClear").addEventListener("click", function () { GSE.clearKeys(); Sound.toggle(false); route(); });
    $("#locGps").addEventListener("click", function () {
      G.locate(function (c) { applyLocated(c); Sound.success(); }, 8000);
    });
    $("#locSudbury").addEventListener("click", function () {
      setCenter({ lat: G.SUDBURY.lat, lng: G.SUDBURY.lng, label: "Sudbury, ON", source: "default" });
      Sound.toggle(true); route();
    });
    $("#locRadius").addEventListener("change", function () {
      G.setRadiusKm(+$("#locRadius").value);
      paintPill();
      Sound.toggle(true); toast("Search radius: " + G.getRadiusKm() + " km.", "success"); route();
    });
    $("#locSave").addEventListener("click", function () {
      setCenter({ lat: +$("#locLat").value || G.SUDBURY.lat, lng: +$("#locLng").value || G.SUDBURY.lng, label: $("#locLabel").value.trim() || "Custom", source: "manual" });
      Sound.success(); toast("Location saved.", "success"); route();
    });
    $("#sndToggle").addEventListener("click", function () {
      Sound.setMuted(!Sound.isMuted());
      syncMuteIcon(); Sound.toggle(!Sound.isMuted()); route();
    });
    $("#reseed").addEventListener("click", function () {
      Store.reset(function (d) { var s = Seed.build(); d.listings = s.listings; d.seededAt = s.seededAt; });
      Sound.success(); toast("Demo listings restored.", "success");
    });
  }

  function setCenter(c) {
    S.center = { lat: c.lat, lng: c.lng, label: c.label, source: c.source };
    try { localStorage.setItem("rebuy:center", JSON.stringify(S.center)); } catch (e) {}
    paintPill();
  }

  function syncMuteIcon() {
    var muted = Sound.isMuted();
    document.getElementById("soundOnIcon").hidden = muted;
    document.getElementById("soundOffIcon").hidden = !muted;
    document.getElementById("muteBtn").setAttribute("aria-pressed", String(!muted));
  }

  // Rebuy only covers the Sudbury area: a GPS fix far from Sudbury gets an
  // honest label ("showing Sudbury-area listings"), never a fake "near you".
  function applyLocated(c) {
    if (c.source === "gps" && G.haversineKm(c.lat, c.lng, G.SUDBURY.lat, G.SUDBURY.lng) > 150) {
      setCenter({ lat: G.SUDBURY.lat, lng: G.SUDBURY.lng, label: "Sudbury, ON", source: "fallback" });
      toast("Rebuy is in beta around Sudbury, ON — showing Sudbury-area listings.", "");
    } else {
      setCenter(c);
    }
  }

  // ---------- boot ----------
  function boot() {
    try {
      var saved = JSON.parse(localStorage.getItem("rebuy:center") || "null");
      if (saved && saved.lat != null) {
        S.center = saved;
      }
    } catch (e) {}
    paintPill();
    // seed once
    if (!Store.all().seededAt) {
      Store.reset(function (d) { var s = Seed.build(); d.listings = s.listings; d.seededAt = s.seededAt; });
    }
    // gentle geolocation upgrade (never blocks). Off-Sudbury positions keep
    // the honest Sudbury fallback — see applyLocated above.
    if (!localStorage.getItem("rebuy:center")) {
      G.locate(applyLocated, 8000);
    }
    // FAQ chatbot widget (two-tier: instant local KB, free Pollinations AI).
    try { if (root.RebuyChatbot) root.RebuyChatbot.mount(); } catch (e) {}
    // header mute
    syncMuteIcon();
    document.getElementById("muteBtn").addEventListener("click", function () {
      Sound.setMuted(!Sound.isMuted());
      syncMuteIcon(); Sound.toggle(!Sound.isMuted());
      toast(Sound.isMuted() ? "Sounds off. Peaceful." : "Sounds on.", "");
    });
    // register adapters (future sources = one file + one register call)
    Src.register(Native.makeAdapter(Store, G));
    Src.register(Ebay.adapter);
    Src.register(GSE.adapter);
    // alerts dot if any alerts exist
    if (Store.alerts().length) {
      var dot = document.getElementById("alertsDot");
      if (dot) dot.hidden = false;
    }
    renderTray();
    window.addEventListener("hashchange", route);
    // one-tap eBay setup link: save keys, strip the secret from the URL, confirm
    try {
      if (Ebay.consumeSetupFragment()) toast("eBay connected — live listings on.", "");
    } catch (e) {}
    route();
  }

  root.RebuyUI = { boot: boot, route: route, toast: toast, setCenter: setCenter, state: S };
})(this);
