/* QA: boot the real app in jsdom with a VirtualConsole, drive key views,
   and fail on ANY jsdomError (the zero-console-errors gate).
   Run: node console-errors.js (from test-harness/) */
"use strict";
const fs = require("fs");
const path = require("path");
const { JSDOM, VirtualConsole } = require("jsdom");
const vm = require("vm");

const ROOT = path.resolve(__dirname, "..");
const SCRIPTS = [
  "js/geo.js", "js/deals.js", "js/offers.js", "js/spend.js", "js/store.js",
  "js/seed.js", "js/sound.js", "js/charts.js", "js/sources/adapter.js",
  "js/sources/ebay.js", "js/sources/google.js", "js/sources/deeplinks.js",
  "js/sources/rebuy.js", "js/icons.js", "js/faq-kb.js", "js/chatbot.js", "js/ui.js"
];

const errors = [];
const vc = new VirtualConsole();
vc.on("jsdomError", (e) => errors.push("jsdomError: " + (e.stack || e.message || e)));
vc.on("error", (...a) => errors.push("console.error: " + a.join(" ")));

const tick = (ms) => new Promise((r) => setTimeout(r, ms || 40));

(async () => {
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const dom = new JSDOM(html, {
    url: "https://vivekn4.github.io/rebuy/",
    pretendToBeVisual: true,
    runScripts: "outside-only",
    virtualConsole: vc
  });
  const { window } = dom;
  window.HTMLCanvasElement.prototype.getContext = function () {
    const el = this;
    return new Proxy({}, {
      get: (t, p) => {
        if (p === "canvas") return el;
        if (p === "measureText") return function () { return { width: 10 }; };
        return function () {};
      },
      set: () => true
    });
  };
  window.fetch = () => Promise.reject(new Error("no network in harness"));
  // silence the app's own console chatter but keep real errors
  const realErr = window.console.error.bind(window.console);
  window.console.error = (...a) => { errors.push("app console.error: " + a.join(" ")); realErr(...a); };
  const vmCtx = dom.getInternalVMContext();
  for (const s of SCRIPTS) vm.runInContext(fs.readFileSync(path.join(ROOT, s), "utf8"), vmCtx);
  window.RebuyUI.boot();

  const views = ["#/", "#/search?q=laptop", "#/search?q=bike&sudbury=0", "#/spend",
                 "#/sell", "#/alerts", "#/settings", "#/search?q=laptop&src=ebay"];
  for (const h of views) {
    window.location.hash = h;
    window.RebuyUI.route();
    await tick(500);
  }
  // open + close the chat widget, ask a Tier-1 question
  const doc = window.document;
  doc.querySelector("#chatBubble").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  await tick(150);
  const input = doc.querySelector("#chatInput");
  input.value = "Is Rebuy free?";
  input.dispatchEvent(new window.Event("input", { bubbles: true }));
  doc.querySelector(".chat-compose").dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
  await tick(300);
  doc.querySelector(".chat-close").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  await tick(100);

  // scrollTo-not-implemented warnings are jsdom noise, not app errors
  const real = errors.filter(e => !/Not implemented: Window's scrollTo/.test(e));
  if (real.length) {
    console.log("CONSOLE-ERROR GATE: FAILED — " + real.length + " error(s)");
    real.slice(0, 10).forEach(e => console.log("  ↳ " + e.slice(0, 300)));
    process.exit(1);
  }
  console.log("CONSOLE-ERROR GATE: PASSED — zero errors across " + views.length + " views + chat widget");
  process.exit(0);
})().catch((e) => { console.log("HARNESS CRASH: " + (e.stack || e)); process.exit(2); });
