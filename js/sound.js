/* Rebuy SFX — calming Web Audio chimes. Tunings from the ui-sound-design recipes.
   "Softer/warmer" variants chosen throughout. Persisted mute in localStorage. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.RebuySound = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var MUTE_KEY = "rebuy:muted";
  var ctx = null, enabled = true, master = 0.5;

  try { enabled = (typeof localStorage !== "undefined" && localStorage.getItem(MUTE_KEY)) !== "1"; } catch (e) {}

  function ac() {
    if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; } }
    if (ctx && ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  function env(g, t, vol, dur) {
    g.gain.setValueAtTime(vol * master, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  }

  function tone(freq, dur, vol, type, when) {
    var c = ac(); if (!c || !enabled) return;
    var t = c.currentTime + (when || 0);
    var o = c.createOscillator(), g = c.createGain();
    o.type = type || "sine"; o.frequency.value = freq;
    env(g, t, vol, dur);
    o.connect(g); g.connect(c.destination);
    o.start(t); o.stop(t + dur + 0.02);
  }

  function sweep(f0, f1, dur, vol, type) {
    var c = ac(); if (!c || !enabled) return;
    var t = c.currentTime;
    var o = c.createOscillator(), g = c.createGain();
    o.type = type || "sine";
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    env(g, t, vol, dur);
    o.connect(g); g.connect(c.destination);
    o.start(t); o.stop(t + dur + 0.02);
  }

  var S = {
    // soft click — buttons, tabs
    click: function () { softClick(); },
    // warm hover — kept very subtle; used sparingly
    hover: function () { tone(1800, 0.07, 0.06, "triangle"); },
    // gentle success — listing posted, offer sent, purchase logged
    success: function () { tone(523, 0.18, 0.14, "triangle"); tone(659, 0.22, 0.14, "triangle", 0.12); },
    // soft bell — saved-search alert
    notify: function () { tone(660, 0.6, 0.14, "sine"); },
    // gentle error — validation
    error: function () { sweep(350, 250, 0.2, 0.13, "sine"); },
    // minimal toggle — filters, mute
    toggle: function (on) { sweep(on ? 550 : 650, on ? 650 : 550, 0.08, 0.10, "sine"); },
    isMuted: function () { return !enabled; },
    setMuted: function (m) {
      enabled = !m;
      try { if (typeof localStorage !== "undefined") localStorage.setItem(MUTE_KEY, m ? "1" : "0"); } catch (e) {}
    }
  };

  function softClick() {
    var c = ac(); if (!c || !enabled) return;
    var t = c.currentTime, dur = 0.06;
    var len = Math.floor(c.sampleRate * dur);
    var buf = c.createBuffer(1, len, c.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    var src = c.createBufferSource(); src.buffer = buf;
    var f = c.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = 1200; f.Q.value = 1;
    var g = c.createGain();
    env(g, t, 0.15, dur);
    src.connect(f); f.connect(g); g.connect(c.destination);
    src.start(t);
  }

  // Unlock on first gesture (autoplay policy).
  if (typeof document !== "undefined") {
    var unlock = function () { ac(); document.removeEventListener("pointerdown", unlock); };
    document.addEventListener("pointerdown", unlock);
  }

  return S;
});
