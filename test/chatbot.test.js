"use strict";
const t = require("node:test");
const assert = require("node:assert/strict");
const FAQ = require("../js/faq-kb.js");
const CB = require("../js/chatbot.js").RebuyChatbot;

// --- js/faq-kb.js (retention team's canonical Tier-1 copy) --------------------
t("faq-kb: every quick chip resolves to an answer", () => {
  for (const c of FAQ.QUICK_CHIPS) {
    const a = FAQ.findAnswer(c.q);
    assert.ok(a && a.body && a.body.length > 20, "chip q=" + c.q);
  }
});

t("faq-kb: the 12 help topics resolve", () => {
  const probes = [
    ["How does Rebuy work?", "how-it-works"],
    ["Is Rebuy free?", "is-it-free"],
    ["Does Rebuy take a cut?", "commission"],
    ["How do I buy safely?", "safe-buy"],
    ["How do I turn on live eBay results?", "live-ebay"],
    ["How do alerts work?", "alerts"],
    ["How do I sell something?", "selling"],
    ["What cities do you cover?", "coverage"],
    ["What do the deal scores mean?", "deal-scores"],
    ["How do I make an offer?", "offers"],
    ["What is the Spend tab?", "spend"],
    ["How do I compare listings?", "compare"],
  ];
  for (const [q, id] of probes) {
    const a = FAQ.findAnswer(q);
    assert.ok(a, "no answer for: " + q);
    assert.equal(a.id, id, "wrong entry for: " + q);
  }
});

t("faq-kb: off-topic / empty returns null (falls through to Tier 2)", () => {
  assert.equal(FAQ.findAnswer("what is the capital of France"), null);
  assert.equal(FAQ.findAnswer(""), null);
  assert.equal(FAQ.findAnswer("   "), null);
});

t("faq-kb: answers are honest — no prices, no other cities promised", () => {
  for (const e of FAQ.KB) {
    assert.ok(!/\$\d/.test(e.body), "price in " + e.id);
    assert.ok(!/toronto|ottawa/i.test(e.body) || /beyond|only/i.test(e.body), "city claim in " + e.id);
  }
});

// --- js/chatbot.js Tier-1 ----------------------------------------------------
t("chatbot answerLocal: instant answers for the four quick chips", () => {
  for (const q of ["How does Rebuy work?", "Is it really free?", "Safe meetup tips", "Turn on live eBay"]) {
    const a = CB.answerLocal(q);
    assert.ok(a && a.text && a.text.length > 20, "no Tier-1 answer for: " + q);
    assert.equal(a.tier, 1);
  }
});

t("chatbot answerLocal: short queries get a break", () => {
  assert.ok(CB.answerLocal("free").text.length > 10);
  assert.ok(CB.answerLocal("demo?").text.length > 10);
});

t("chatbot answerLocal: greetings + thanks handled locally", () => {
  assert.ok(CB.answerLocal("hi").text.length > 5);
  assert.ok(CB.answerLocal("thanks!").text.length > 5);
});

t("chatbot answerLocal: unknown questions return null (Tier 2 path)", () => {
  assert.equal(CB.answerLocal("what is the capital of France"), null);
  assert.equal(CB.answerLocal(""), null);
});

t("chatbot answerLocal: never invents prices", () => {
  for (const e of CB.KB) assert.ok(!/\$\d/.test(e.a), "price in KB entry");
});

t("chatbot: Pollinations URL is keyless GET with system prompt + private flag", () => {
  // answerRemote builds the URL synchronously before fetching; capture it.
  let seen = null;
  const realFetch = global.fetch;
  global.fetch = (url) => { seen = url; return Promise.reject(new Error("stop")); };
  return CB.answerRemote("hello?").catch(() => {}).then(() => {
    global.fetch = realFetch;
    assert.ok(seen.startsWith("https://text.pollinations.ai/"), seen);
    assert.ok(seen.includes("system="), "system prompt missing");
    assert.ok(seen.includes("private=true"), "private flag missing");
    assert.ok(!seen.includes("api_key") && !seen.includes("apikey"), "key leaked into URL");
  });
});
