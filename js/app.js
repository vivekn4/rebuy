/* Rebuy bootstrap — nothing clever, just the right order.
   Store seeds on first run; UI boots the router, location, and adapters. */
(function (root) {
  "use strict";

  function ready(fn) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn);
    else fn();
  }

  ready(function () {
    try {
      root.RebuyUI.boot();
    } catch (err) {
      var v = document.getElementById("view");
      if (v) v.innerHTML = '<div class="empty"><p class="serif">Rebuy tripped on the doorstep.</p>' +
        "<p>" + String((err && err.message) || err) + "</p><p>Try reloading the page.</p></div>";
      if (window.console && console.error) console.error(err);
    }
  });
})(this);
