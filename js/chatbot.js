/* Rebuy FAQ chatbot — calm help widget. Two-tier answers:
   Tier 1: RebuyFAQ.findAnswer (local KB — instant, synchronous, offline-first).
   Tier 2: keyless Pollinations text API with RebuyFAQ.SYSTEM_PROMPT
   (private=true, 12s timeout, honest failure).
   answerLocal() returns {text, title, tier} or null. Falls back to a built-in
   mini-KB (exposed as CB.KB) when js/faq-kb.js is unavailable.
   No keys, no paid services, no Sound. Mounted by RebuyUI.boot() via
   RebuyChatbot.mount(). DOM uses the .chat-* classes from styles.css. */
(function (root) {
  "use strict";

  var POLL_URL = "https://text.pollinations.ai/";
  var TIMEOUT_MS = 12000;

  // Minimal fallback KB (used only if js/faq-kb.js failed to load).
  // a = answer text; never contains prices, listings, or city claims.
  var FALLBACK_KB = [
    { keys: ["how does rebuy work", "what is rebuy", "how rebuy works"], title: "How Rebuy works",
      a: "Rebuy compares used listings around Sudbury: search once, see Rebuy sellers, eBay, and the second-hand web side by side with a deal score on each. Message the seller, meet in person, pay in person." },
    { keys: ["is it really free", "is it free", "free", "cost", "charge"], title: "Is Rebuy free?",
      a: "Yes — searching, listing, messaging, and alerts are all free, and Rebuy never takes a cut of a sale." },
    { keys: ["commission", "cut", "fee", "take a cut"], title: "Does Rebuy take a cut?",
      a: "Never. Zero commission, always — you pay the seller in person." },
    { keys: ["safe", "safety", "meetup", "meet", "scam", "is rebuy a scam"], title: "Buying safely",
      a: "Meet in a public, well-lit place during the day, bring a friend if you can, and check the item before you pay. Good Sudbury spots: the Greater Sudbury Police HQ lobby (190 Brady St) and the New Sudbury Centre food court." },
    { keys: ["turn on live ebay", "live ebay", "ebay"], title: "Turn on live eBay results",
      a: "Use the one-tap setup link from your chat \u2014 it saves your free eBay key on this phone. Heads-up: eBay blocks in-page requests, so eBay results stay clearly-labeled demo samples for now. Your keys stay on this device only." },
    { keys: ["delivery", "deliver", "shipping", "ship it"], title: "Delivery and shipping",
      a: "Rebuy is in-person only \u2014 no delivery or shipping. You meet the seller, check the item, and pay on the spot." },
    { keys: ["demo", "sample", "placeholder", "fake", "mock"], title: "Demo vs live",
      a: "Anything tagged \u201cDemo\u201d is a sample so you can see how the site works \u2014 not a real item for sale. eBay results stay demo because eBay blocks in-page requests; add the free Google key in #/settings and those web results go live." }
  ];
  var FALLBACK_CHIPS = [
    { label: "How does Rebuy work?", q: "How does Rebuy work?" },
    { label: "Is it free?", q: "Is Rebuy free?" },
    { label: "Safe meetup tips", q: "How do I buy safely?" },
    { label: "Turn on live eBay", q: "How do I turn on live eBay results?" }
  ];
  var FALLBACK_SYSTEM = "You are the Rebuy help assistant. Rebuy is a calm, free used-goods comparison site in beta around Sudbury, Ontario, Canada (default 25 km radius). Help only with Rebuy topics: how it works, zero commission, safe in-person meetups in Sudbury, live eBay setup, alerts, selling, search radius, deal scores. Never invent listings, prices, features, or locations; never claim coverage beyond Sudbury; if unsure, say so and point to Settings or the seller. Off-topic questions get one short polite redirect sentence. Keep answers under 60 words, plain and neighborly.";

  var GREETING_TEXT = "Hi there — quick question about Rebuy? Ask below, or tap a topic.";
  var THANKS_TEXT = "Anytime. Happy hunting.";
  var OFFLINE_TEXT = "The free AI helper isn\u2019t reachable right now — but the topics below work offline.";

  function faq() { return root.RebuyFAQ || null; }

  function normalize(s) {
    return String(s == null ? "" : s).toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  }

  function answerLocal(text) {
    var nq = normalize(text);
    if (!nq) return null;
    if (/^(hi|hey|hello|yo|sup|good\s?(morning|afternoon|evening))\b/.test(nq))
      return { text: GREETING_TEXT, title: null, tier: 1 };
    if (/\b(thanks|thank you|thx|ty)\b/.test(nq))
      return { text: THANKS_TEXT, title: null, tier: 1 };
    var F = faq(), r = null;
    if (F && F.findAnswer) { try { r = F.findAnswer(text); } catch (e) { r = null; } }
    if (r) return { text: r.body, title: r.title || null, tier: 1 };
    var best = null, bestScore = 0, i, j, k;
    for (i = 0; i < FALLBACK_KB.length; i++) {
      var score = 0;
      for (j = 0; j < FALLBACK_KB[i].keys.length; j++) {
        k = normalize(FALLBACK_KB[i].keys[j]);
        if (k && nq.indexOf(k) >= 0) score += k.split(" ").length; // phrases weigh more
      }
      if (score > bestScore) { bestScore = score; best = FALLBACK_KB[i]; }
    }
    // short queries ("free", "demo?") get a break: one solid keyword is enough
    if (best && (bestScore >= 2 || (bestScore >= 1 && nq.split(" ").length <= 3)))
      return { text: best.a, title: best.title, tier: 1 };
    return null;
  }

  function chips() {
    var F = faq();
    return (F && F.QUICK_CHIPS) || FALLBACK_CHIPS;
  }

  function answerRemote(text) {
    var F = faq();
    var system = (F && F.SYSTEM_PROMPT) || FALLBACK_SYSTEM;
    // private=true keeps help questions out of the public Pollinations feed.
    var url = POLL_URL + encodeURIComponent(String(text).slice(0, 500)) +
      "?model=openai&private=true&system=" + encodeURIComponent(system);
    var ctrl = null, timer = null;
    try {
      if (typeof AbortController !== "undefined") {
        ctrl = new AbortController();
        timer = setTimeout(function () { try { ctrl.abort(); } catch (e) {} }, TIMEOUT_MS);
      }
    } catch (e) {}
    var req = null;
    try { req = fetch(url, ctrl ? { signal: ctrl.signal } : {}); }
    catch (e) { return Promise.reject(e); }
    var timeout = new Promise(function (_, rej) {
      setTimeout(function () { rej(new Error("timeout")); }, TIMEOUT_MS + 2000);
    });
    return Promise.race([req, timeout]).then(function (r) {
      if (timer) clearTimeout(timer);
      if (!r.ok) throw new Error("http " + r.status);
      return r.text();
    }).then(function (t) {
      t = String(t || "").trim();
      if (!t) throw new Error("empty");
      return { text: t, title: null, tier: 2 };
    });
  }

  // ---------- widget ----------
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  // Only our own "#/settings" token becomes a link — everything else stays text.
  function rich(text) {
    return esc(text).replace(/#\/settings/g, '<a href="#/settings">Settings</a>');
  }
  function icon(name, size) {
    try { return root.RebuyIcons.icon(name, size || 20); } catch (e) { return ""; }
  }

  var bubble = null, panel = null, log = null, input = null, opened = false;

  function addMsg(text, who) {
    var d = document.createElement("div");
    d.className = "chat-msg " + who;
    d.innerHTML = "<p>" + esc(text) + "</p>";
    log.appendChild(d);
    log.scrollTop = log.scrollHeight;
    return d;
  }
  function addBot(answer) {
    var html = answer.title
      ? "<strong>" + esc(answer.title) + "</strong><br>" + rich(answer.text)
      : rich(answer.text).replace(/\n+/g, "<br>");
    var d = document.createElement("div");
    d.className = "chat-msg bot";
    d.innerHTML = "<p>" + html + "</p>";
    log.appendChild(d);
    log.scrollTop = log.scrollHeight;
    return d;
  }
  function addTyping() {
    var d = document.createElement("div");
    d.className = "chat-typing";
    d.setAttribute("aria-label", "Rebuy helper is typing");
    d.innerHTML = "<span></span><span></span><span></span>";
    log.appendChild(d);
    log.scrollTop = log.scrollHeight;
    return d;
  }

  function ask(text) {
    text = String(text || "").trim();
    if (!text) return;
    addMsg(text, "user");
    var local = answerLocal(text);
    if (local) { addBot(local); return; }
    var online = true;
    try { online = navigator.onLine !== false; } catch (e) {}
    if (!online) { addBot({ text: OFFLINE_TEXT, title: null, tier: 1 }); return; }
    var tp = addTyping();
    answerRemote(text).then(function (r) {
      tp.remove();
      addBot(r);
    }).catch(function () {
      tp.remove();
      addBot({ text: OFFLINE_TEXT, title: null, tier: 1 });
    });
  }

  function setOpen(open) {
    opened = open;
    panel.hidden = !open;
    bubble.setAttribute("aria-expanded", String(open));
    if (open) {
      try { input.focus(); } catch (e) {}
      if (!log.children.length) addBot({ text: GREETING_TEXT, title: null, tier: 1 });
    } else {
      try { bubble.focus(); } catch (e) {}
    }
  }

  function syncTray() {
    try {
      var tray = document.getElementById("compareTray");
      document.body.classList.toggle("chat-above-tray", !!(tray && !tray.hidden));
    } catch (e) {}
  }

  function mount() {
    if (bubble || !document.body) return;
    bubble = document.createElement("button");
    bubble.className = "chat-bubble";
    bubble.type = "button";
    bubble.id = "chatBubble";
    bubble.setAttribute("aria-label", "Rebuy help \u2014 ask a question");
    bubble.setAttribute("aria-expanded", "false");
    bubble.setAttribute("aria-controls", "chatPanel");
    bubble.innerHTML = icon("message-circle", 24);

    panel = document.createElement("section");
    panel.className = "chat-panel";
    panel.id = "chatPanel";
    panel.hidden = true;
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", "Rebuy help");
    panel.innerHTML =
      '<div class="chat-head"><div><strong>Rebuy help</strong>' +
      '<span class="chat-status">Quick answers \u2014 even offline</span></div>' +
      '<button class="chat-close" type="button" aria-label="Close help chat">' + icon("x", 16) + "</button></div>" +
      '<div class="chat-log" id="chatLog" aria-live="polite"></div>' +
      '<div class="chat-chips">' + chips().map(function (c) {
        return '<button type="button" class="chat-chip" data-q="' + esc(c.q) + '">' + esc(c.label) + "</button>";
      }).join("") + "</div>" +
      '<form class="chat-compose"><input type="text" id="chatInput" placeholder="Ask about Rebuy\u2026" aria-label="Ask about Rebuy" maxlength="500" autocomplete="off">' +
      '<button class="chat-send" type="submit" aria-label="Send">' + icon("send", 17) + "</button></form>" +
      '<p class="chat-foot">Rebuy never takes a cut \u2014 you pay the seller in person.</p>' +
      '<p class="chat-foot chat-privacy">If the quick answers can\u2019t help, your typed question is sent privately to our free AI helper \u2014 never posted publicly.</p>';

    document.body.appendChild(bubble);
    document.body.appendChild(panel);
    log = panel.querySelector("#chatLog");
    input = panel.querySelector("#chatInput");

    bubble.addEventListener("click", function () { setOpen(true); });
    panel.querySelector(".chat-close").addEventListener("click", function () { setOpen(false); });
    panel.querySelectorAll(".chat-chip").forEach(function (chip) {
      chip.addEventListener("click", function () { ask(chip.getAttribute("data-q")); });
    });
    panel.querySelector(".chat-compose").addEventListener("submit", function (e) {
      e.preventDefault();
      ask(input.value);
      input.value = "";
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && opened) setOpen(false);
    });
    // Keep the bubble clear of the compare tray when it slides up.
    syncTray();
    try {
      var tray = document.getElementById("compareTray");
      if (tray && window.MutationObserver)
        new MutationObserver(syncTray).observe(tray, { attributes: true, attributeFilter: ["hidden"] });
    } catch (e) {}
  }

  root.RebuyChatbot = {
    mount: mount, ask: ask, answerLocal: answerLocal, answerRemote: answerRemote,
    KB: FALLBACK_KB
  };
})(this);
