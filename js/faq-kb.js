/* Rebuy FAQ knowledge base — Tier-1 answers for the help chatbot.
   Retention team copy (2026-10-15). Human-made voice: short sentences, plain
   words, reads like a helpful neighbour. No AI-tell vocabulary anywhere.

   Contract for the chatbot widget (js/chatbot.js):
     - RebuyFAQ.findAnswer(text) -> { title, body, chips } or null.
       Instant, synchronous, works offline. Call this FIRST.
     - If findAnswer returns null, fall back to the free Pollinations text API
       with RebuyFAQ.SYSTEM_PROMPT as the system prompt (12s timeout).
     - Escape every rendered answer through the same esc() path as listings.
   Honesty: Tier-1 answers never invent listings, prices, or features. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.RebuyFAQ = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var KB = [
    {
      id: "how-it-works",
      keys: ["how does rebuy work", "how rebuy works", "how to use rebuy", "what is rebuy", "what's rebuy", "about rebuy", "explain rebuy"],
      title: "How Rebuy works",
      body: "Rebuy compares used listings for you. Search once and it lines up Rebuy sellers, eBay, and other second-hand sites side by side, each with a deal score. The best value-for-money pick sits at the top. Tap a listing to message the seller or hop over to the marketplace."
    },
    {
      id: "is-it-free",
      keys: ["free", "cost", "pay to use", "charge", "subscription", "sign up", "account"],
      title: "Is Rebuy free?",
      body: "Yes — free, no account, no fees, no catch. The keys that turn on live eBay or web results are free too (no card), and they're stored only on your phone, never on our servers."
    },
    {
      id: "commission",
      keys: ["commission", "cut", "fee", "take a", "how do you make money", "make money", "profit"],
      title: "Does Rebuy take a cut?",
      body: "Never. Zero commission, always. If you buy, you pay the seller in person — cash or e-transfer. Whatever a seller agrees to is 100% theirs."
    },
    {
      id: "safe-buy",
      keys: ["safe", "safety", "meet", "meetup", "scam", "trust", "public", "police"],
      title: "Buying safely",
      body: "Meet in a public, well-lit place — daytime is best, and bring a friend if you can. Easy spots around town: the Greater Sudbury Police headquarters lobby and the New Sudbury Centre food court. Check the item before you pay, and trust your gut — if a deal feels off, walk away."
    },
    {
      id: "live-ebay",
      keys: ["ebay", "live", "setup", "one-tap", "key", "thumbnails", "photos", "real listings", "turn on"],
      title: "Turn on live eBay results",
      body: "Use the one-tap setup link from your chat — one tap saves your free eBay key on this phone and switches results to live listings with real product photos. Lost the link? Open #/settings and paste the App ID and Cert ID instead (the App ID is pre-filled). Your key never leaves your device."
    },
    {
      id: "alerts",
      keys: ["alert", "alerts", "how do alerts work", "alerts work", "saved search", "saved searches", "save search", "notify", "notification", "ping", "watch", "remind"],
      title: "Saved-search alerts",
      body: "Find something you like, tap \"Save this search\", and Rebuy watches for you. When a matching listing lands, you get a gentle ping — in the app, and in your browser if you turn notifications on. Manage or remove them any time under Alerts. No spam, ever."
    },
    {
      id: "selling",
      keys: ["sell", "listing", "list an item", "post", "how do i sell"],
      title: "Selling on Rebuy",
      body: "Tap Sell, add a photo and a fair price, and your listing goes live for Sudbury shoppers. Zero commission — whatever you agree with the buyer is yours. Buyers pay you in person, so meet somewhere public."
    },
    {
      id: "coverage",
      keys: ["where", "area", "cover", "city", "cities", "toronto", "location", "radius", "near me", "sudbury", "distance", "km"],
      title: "Where Rebuy works",
      body: "Rebuy is in beta around Sudbury, Ontario. By default it shows things within 25 km of you; you can widen the radius in the location pill (up to 100 km). We only cover the Sudbury area for now — we won't pretend otherwise."
    },
    {
      id: "demo",
      keys: ["demo", "sample", "placeholder", "fake", "mock", "real listings", "not real", "samples"],
      title: "Demo vs live",
      body: "Anything tagged \u201cDemo\u201d is a sample so you can see how the site works \u2014 not a real item for sale. Live eBay results are real listings with real photos, once you\u2019ve added your free eBay key in Settings. We never dress samples up as real deals."
    },
    {
      id: "shipping",
      keys: ["delivery", "deliver", "shipping", "ship it", "post it", "mail"],
      title: "Delivery and shipping",
      body: "Rebuy is in-person only \u2014 there\u2019s no delivery or shipping. You meet the seller, check the item, and pay on the spot. Keep meetups public and daytime, and bring a friend if you can."
    },
    {
      id: "deal-scores",
      keys: ["deal score", "deal", "great deal", "fair", "overpriced", "hang-tag", "hangtag", "price", "worth"],
      title: "What the deal scores mean",
      body: "Every listing gets a little hang-tag: Great deal, Fair, or Overpriced, based on the going rate for that item and condition. It's a guide, not gospel — always read the listing yourself before you buy."
    },
    {
      id: "offers",
      keys: ["offer", "haggle", "negotiate", "counter", "bid", "lower price"],
      title: "Making an offer",
      body: "On Rebuy listings you can send an offer and the seller can counter — it all happens in one calm thread under Offers. For eBay listings, tap through to eBay, where their rules apply."
    },
    {
      id: "spend",
      keys: ["spend", "saved", "savings", "tracking", "bought", "purchase"],
      title: "The Spend tab",
      body: "The Spend tab adds up what you've bought through Rebuy and shows what you saved versus buying new. When you pick something up, log the purchase — watching the savings stack up is the fun part."
    },
    {
      id: "compare",
      keys: ["compare", "side by side", "tray", "which one", "choose"],
      title: "Comparing listings",
      body: "Tick up to 4 listings and the Compare tray slides up — one tap shows them side by side: price, condition, distance, and deal score. Pick the one that actually fits."
    }
  ];

  var QUICK_CHIPS = [
    { label: "How does Rebuy work?", q: "How does Rebuy work?" },
    { label: "Is it free?", q: "Is Rebuy free?" },
    { label: "Safe meetup tips", q: "How do I buy safely?" },
    { label: "Turn on live eBay", q: "How do I turn on live eBay results?" }
  ];

  var SYSTEM_PROMPT = [
    "You are the Rebuy help bot — a calm, plain-spoken assistant for Rebuy,",
    "a free used-goods comparison site in beta around Sudbury, Ontario.",
    "Answer ONLY Rebuy help topics: how Rebuy works, zero commission, safe",
    "in-person meetups, live eBay setup (the one-tap #ebay-setup link in your chat, or Settings),",
    "saved searches, selling on Rebuy, search radius, deal scores, offers, the",
    "Spend tab, comparing listings, demo-vs-live labels, and delivery/shipping",
    "(Rebuy is in-person only — no delivery, no shipping).",
    "Hard rules:",
    "- Never invent listings, prices, sellers, features, or locations.",
    "- Never claim Rebuy covers any city beyond the Sudbury, Ontario area.",
    "- If you do not know something, say so plainly and point the user to",
    "  Settings or to the seller — never guess.",
    "- Keep answers to two or three short sentences, plain words, no jargon.",
    "- If asked about anything off-topic (politics, general knowledge, health,",
    "  legal advice, anything not about Rebuy), reply with ONE brief polite",
    "  sentence redirecting to Rebuy help topics. No full conversations."
  ].join(" ");

  function normalize(s) {
    return String(s || "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  }

  // Keyword scoring: entry wins if any key phrase (or most of its words) hits.
  function findAnswer(text) {
    var n = " " + normalize(text) + " ";
    if (!n.trim()) return null;
    var best = null, bestScore = 0;
    KB.forEach(function (entry) {
      var score = 0;
      entry.keys.forEach(function (k) {
        var nk = " " + normalize(k) + " ";
        if (n.indexOf(nk) !== -1) score += 3;                 // whole phrase hit
        else {
          var words = nk.trim().split(" ");
          var textWords = n.trim().split(" ");
          var substantive = words.filter(function (w) { return w.length >= 3; });
          var hits = substantive.filter(function (w) {
            return textWords.some(function (tw) {
              return tw === w || (w.length > 3 && tw.length > 2 && (tw.indexOf(w) === 0 || w.indexOf(tw) === 0));
            });
          }).length;
          if (hits === substantive.length && substantive.length) score += 2;  // every real word hit
          else if (hits >= 2) score += 1;                                     // needs 2+ to count
        }
      });
      if (score > bestScore) { bestScore = score; best = entry; }
    });
    if (!best || bestScore < 2) return null;
    return { title: best.title, body: best.body, chips: QUICK_CHIPS, id: best.id };
  }

  return {
    KB: KB,
    QUICK_CHIPS: QUICK_CHIPS,
    SYSTEM_PROMPT: SYSTEM_PROMPT,
    findAnswer: findAnswer,
    normalize: normalize
  };
});
