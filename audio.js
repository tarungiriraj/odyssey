/* Tarun RG · The ride. Procedural sound layer (Web Audio only, no audio files). */
(function (root) {
  "use strict";
  function mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); }
  function rngf(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; var t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  var AUTO = ["chennai", "chennai", "bangalore", "bangalore", "bangalore", "highway", "ladakh", "geartribe", "golden"];
  var MOODS = { morning: { tempo: 1.06, tr: 2, bright: 1.3 }, evening: { tempo: 0.88, tr: -2, bright: 0.62 } };
  var TRACK_IDS = ["chennai", "bangalore", "ladakh", "highway", "morning", "evening", "geartribe", "golden"];

  function create(ctx, opt) {
    opt = opt || {};
    var clock = opt.clock || function () { return ctx.currentTime; };
    var rnd = rngf(opt.seed || (Date.now() & 0xffff)), SR = ctx.sampleRate, E = {};
    var M = MOODS.morning, tod = "morning";
    var GENT = opt.gentle ? 0.7 : 1, MUSIC_K = (opt.musicK || 0.34) * GENT, SFX_K = (opt.sfxK || 1) * GENT * 0.7225, vol = { music: 0.7 };

    /* ---------- graph: music + sfx -> compressor -> limiter -> out ---------- */
    var musicBus = ctx.createGain(), duckG = ctx.createGain(), sfxBus = ctx.createGain(), mix = ctx.createGain(),
        comp = ctx.createDynamicsCompressor(), lim = ctx.createDynamicsCompressor(), out = ctx.createGain(), sm = ctx.createBiquadFilter(), sat = ctx.createWaveShaper();
    (function () { var n = 1024, c = new Float32Array(n); for (var q = 0; q < n; q++) { var x = q / (n - 1) * 2 - 1; c[q] = Math.tanh(x); } sat.curve = c; })();
    sm.type = "lowpass"; sm.frequency.value = Math.min(11000, ctx.sampleRate * 0.33); sm.Q.value = 0.5;
    comp.threshold.value = -16; comp.knee.value = 10; comp.ratio.value = 4; comp.attack.value = 0.006; comp.release.value = 0.22;
    lim.threshold.value = -4; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = 0.001; lim.release.value = 0.08;
    musicBus.connect(duckG); duckG.connect(mix); sfxBus.connect(mix); mix.connect(sm); sm.connect(comp); comp.connect(lim); lim.connect(sat); sat.connect(out); out.connect(ctx.destination);
    out.gain.value = 0;
    function applyVol() { musicBus.gain.value = MUSIC_K * vol.music * vol.music; sfxBus.gain.value = SFX_K; }
    applyVol();

    /* ---------- noise ---------- */
    function mkNoise(pink) {
      var n = SR * 2, b = ctx.createBuffer(1, n, SR), d = b.getChannelData(0), b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (var i = 0; i < n; i++) {
        var w = rnd() * 2 - 1;
        if (!pink) d[i] = w; else { b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852; b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898; d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11; b6 = w * 0.115926; }
      }
      return b;
    }
    var WHITE = mkNoise(false), PINK = mkNoise(true);
    function nsrc(buf, loop) { var s = ctx.createBufferSource(); s.buffer = buf; s.loop = !!loop; return s; }
    function pan(dest, p) { if (!ctx.createStereoPanner) return dest; var n = ctx.createStereoPanner(); n.pan.value = p; n.connect(dest); return n; }

    /* one-shot voices */
    function nv(dest, t, dur, ftype, f, fEnd, q, vol_, a, buf) {
      var s = nsrc(buf || WHITE, false), fl = ctx.createBiquadFilter(), g = ctx.createGain();
      fl.type = ftype; fl.Q.value = q || 0.7; fl.frequency.setValueAtTime(f, t); if (fEnd) fl.frequency.exponentialRampToValueAtTime(fEnd, t + dur);
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol_, t + (a || 0.004)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      s.connect(fl); fl.connect(g); g.connect(dest); s.start(t, rnd() * 1.4); s.stop(t + dur + 0.04);
    }
    function tv(dest, t, type, f, fEnd, dur, vol_, a) {
      var o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.setValueAtTime(f, t); if (fEnd) o.frequency.exponentialRampToValueAtTime(fEnd, t + dur);
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol_, t + (a || 0.004)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + 0.04);
    }

    /* ---------- SFX ---------- */
    var SF = {};
    SF.step = function (t, k, side) {
      var d = pan(sfxBus, side * 0.14);
      nv(d, t, 0.12, "lowpass", 1100 + 500 * k, 500, 0.8, 1.8, 0.003, WHITE);
      tv(d, t, "sine", 150 + 30 * k, 60, 0.10, 1.7, 0.003);
      nv(d, t + 0.012, 0.06, "bandpass", 3200, 0, 0.9, 0.22, 0.002, WHITE);
    };
    SF.tick = function (t) {
      nv(sfxBus, t, 0.02, "highpass", 3000 + rnd() * 900, 0, 0.7, 0.6, 0.0006, WHITE);
      tv(sfxBus, t, "sine", 2300 + rnd() * 500, 0, 0.014, 0.2, 0.0005);
    };
    SF.brake = function (t, mode) {
      if (mode === "moto") { nv(sfxBus, t, 0.34, "bandpass", 3000, 1500, 3, 0.4, 0.02, WHITE); tv(sfxBus, t + 0.28, "sine", 130, 70, 0.14, 0.6, 0.004); nv(sfxBus, t + 0.28, 0.09, "lowpass", 900, 0, 0.7, 0.35, 0.002, PINK); }
      else if (mode === "cycle") { tv(sfxBus, t, "sawtooth", 2500, 1900, 0.26, 0.07, 0.03); nv(sfxBus, t, 0.26, "bandpass", 2400, 1800, 6, 0.3, 0.03, WHITE); }
      else { nv(sfxBus, t, 0.09, "lowpass", 1000, 0, 0.8, 0.5, 0.004, WHITE); nv(sfxBus, t + 0.1, 0.07, "lowpass", 800, 0, 0.8, 0.3, 0.004, WHITE); }
    };
    SF.pop = function (t) { tv(sfxBus, t, "sine", 360, 1150, 0.1, 0.8, 0.004); nv(sfxBus, t, 0.03, "highpass", 4000, 0, 0.7, 0.3, 0.001, WHITE); tv(sfxBus, t + 0.09, "sine", 1700, 1100, 0.07, 0.25, 0.002); };
    SF.whoosh = function (t) { nv(sfxBus, t, 0.42, "bandpass", 300, 2600, 1.3, 0.6, 0.15, WHITE); };
    SF.arrive = function (t) { tv(sfxBus, t, "sine", 220, 98, 0.32, 0.85, 0.005); nv(sfxBus, t, 0.1, "lowpass", 600, 0, 0.8, 0.45, 0.003, PINK); tv(sfxBus, t + 0.02, "triangle", 784, 0, 0.5, 0.18, 0.004); };
    SF.badge = function (t) {
      [659.25, 830.61, 987.77, 1318.5].forEach(function (f, i) { var tt = t + i * 0.075; tv(sfxBus, tt, "sine", f, 0, 0.95, 0.5, 0.004); tv(sfxBus, tt, "triangle", f * 2.01, 0, 0.5, 0.12, 0.004); });
    };
    SF.tap = function (t) { tv(sfxBus, t, "sine", 900, 640, 0.05, 0.6, 0.002); nv(sfxBus, t, 0.012, "highpass", 3000, 0, 0.7, 0.2, 0.0005, WHITE); };
    SF.crank = function (t) { // engine start: a short rev-up, handled in update() through revT; plus a starter whirr
      nv(sfxBus, t, 0.3, "bandpass", 700, 1500, 2, 0.28, 0.05, PINK);
    };
    E.sfx = SF;

    /* duck the music a few dB for a moment */
    function duck(db, hold) {
      var t = clock(), g = Math.pow(10, -db / 20);
      duckG.gain.cancelScheduledValues(t); duckG.gain.setTargetAtTime(g, t, 0.03); duckG.gain.setTargetAtTime(1, t + hold, 0.45);
    }

    /* ---------- continuous voices: bicycle chain + motorbike ---------- */
    var cyc = null, bike = null, revT = -9, lastCtl = 0;
    function mkCycle() {
      var s = nsrc(PINK, true), bp = ctx.createBiquadFilter(), g = ctx.createGain(), trem = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain();
      bp.type = "bandpass"; bp.Q.value = 2; bp.frequency.value = 900; g.gain.value = 0; trem.gain.value = 0.7; lfo.frequency.value = 8; lg.gain.value = 0.3;
      lfo.connect(lg); lg.connect(trem.gain); s.connect(bp); bp.connect(trem); trem.connect(g); g.connect(sfxBus); s.start(0, rnd()); lfo.start();
      return { g: g, bp: bp, lfo: lfo, srcs: [s, lfo] };
    }
    function mkBike() {
      var a = ctx.createOscillator(), b = ctx.createOscillator(), c = ctx.createOscillator(), n = nsrc(PINK, true), lp = ctx.createBiquadFilter(), th = ctx.createGain(), thl = ctx.createOscillator(), thd = ctx.createGain(),
          ng = ctx.createGain(), nbp = ctx.createBiquadFilter(), g = ctx.createGain(), mixo = ctx.createGain();
      a.type = "sawtooth"; b.type = "square"; c.type = "sawtooth"; lp.type = "lowpass"; lp.Q.value = 1.4; th.gain.value = 0.62; thl.type = "sine"; thd.gain.value = 0.36;
      nbp.type = "bandpass"; nbp.Q.value = 0.8; nbp.frequency.value = 500; ng.gain.value = 0; g.gain.value = 0; mixo.gain.value = 1;
      a.frequency.value = 50; b.frequency.value = 100.6; c.frequency.value = 49.2; thl.frequency.value = 9;
      var ga = ctx.createGain(), gb = ctx.createGain(), gc = ctx.createGain(); ga.gain.value = 0.5; gb.gain.value = 0.2; gc.gain.value = 0.3;
      a.connect(ga); b.connect(gb); c.connect(gc); ga.connect(mixo); gb.connect(mixo); gc.connect(mixo); mixo.connect(lp); lp.connect(th); th.connect(g);
      thl.connect(thd); thd.connect(th.gain); n.connect(nbp); nbp.connect(ng); ng.connect(g); g.connect(sfxBus);
      a.start(); b.start(); c.start(); thl.start(); n.start(0, rnd());
      return { g: g, a: a, b: b, c: c, lp: lp, thl: thl, ng: ng, nbp: nbp, srcs: [a, b, c, thl, n] };
    }
    function killVoice(v, t) { if (!v) return; v.g.gain.cancelScheduledValues(t); v.g.gain.setTargetAtTime(0, t, 0.06); v.srcs.forEach(function (s) { try { s.stop(t + 0.5); } catch (e) {} }); }

    /* ---------- music helpers ---------- */
    function pluck(dest, t, freq, dur, v, o) {
      o = o || {}; var g = ctx.createGain(), lp = ctx.createBiquadFilter(), o1 = ctx.createOscillator(), cut = (o.cut || 2000) * M.bright;
      lp.type = "lowpass"; lp.Q.value = o.q || 0.7; lp.frequency.setValueAtTime(cut, t); lp.frequency.exponentialRampToValueAtTime(Math.max(150, cut * (o.end || 0.25)), t + dur);
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + (o.a || 0.005)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o1.type = o.type || "sawtooth"; o1.frequency.setValueAtTime(o.slide ? freq * Math.pow(2, o.slide / 12) : freq, t); if (o.slide) o1.frequency.linearRampToValueAtTime(freq, t + 0.07);
      o1.connect(lp);
      if (o.type2 !== null) { var o2 = ctx.createOscillator(); o2.type = o.type2 || "triangle"; o2.frequency.setValueAtTime(freq * (o.det || 1.004), t); o2.connect(lp); o2.start(t); o2.stop(t + dur + 0.05); }
      lp.connect(g); g.connect(dest); o1.start(t); o1.stop(t + dur + 0.05);
    }
    function pad(dest, t, freq, dur, v, cut) {
      var g = ctx.createGain(), lp = ctx.createBiquadFilter(), at = Math.min(dur * 0.4, 1.6);
      lp.type = "lowpass"; lp.Q.value = 0.5; lp.frequency.value = (cut || 900) * M.bright;
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + at); g.gain.setValueAtTime(v, t + Math.max(at, dur - at)); g.gain.linearRampToValueAtTime(0.0001, t + dur);
      [["sawtooth", -8], ["sawtooth", 8], ["triangle", 0]].forEach(function (x) { var o = ctx.createOscillator(); o.type = x[0]; o.frequency.value = freq; o.detune.value = x[1]; o.connect(lp); o.start(t); o.stop(t + dur + 0.05); });
      lp.connect(g); g.connect(dest);
    }
    function bell(dest, t, freq, dur, v) {
      [[1, 1, 1], [2.76, 0.45, 0.6], [5.4, 0.22, 0.35], [8.93, 0.1, 0.2]].forEach(function (p) { tv(dest, t, "sine", freq * p[0], 0, dur * p[2], v * p[1], 0.004); });
    }
    function kick(dest, t, v) { tv(dest, t, "sine", 135, 46, 0.22, v, 0.002); nv(dest, t, 0.015, "lowpass", 2500, 0, 0.7, v * 0.25, 0.001, WHITE); }
    function hat(dest, t, v, open) { nv(dest, t, open ? 0.16 : 0.04, "highpass", 7200, 0, 0.7, v, 0.002, WHITE); }
    function snare(dest, t, v) { nv(dest, t, 0.15, "bandpass", 1900, 0, 0.8, v, 0.002, WHITE); tv(dest, t, "triangle", 200, 140, 0.1, v * 0.6, 0.002); }
    function shaker(dest, t, v) { nv(dest, t, 0.07, "bandpass", 6000, 0, 1.2, v, 0.02, WHITE); }
    function thump(dest, t, v, f) { tv(dest, t, "sine", f * 1.6, f, 0.16, v, 0.002); nv(dest, t, 0.03, "bandpass", 700, 0, 1.4, v * 0.2, 0.001, WHITE); }
    function chirp(dest, t, v) { var f = 3000 + rnd() * 1800; tv(dest, t, "sine", f, f * 1.35, 0.07, v, 0.008); tv(dest, t + 0.1, "sine", f * 1.2, f * 0.95, 0.06, v * 0.8, 0.008); }
    function hold(inst, node) { node.start(); inst.srcs.push(node); }
    function noiseBed(inst, buf, ftype, f, q, v) { var s = nsrc(buf, true), fl = ctx.createBiquadFilter(), g = ctx.createGain(); fl.type = ftype; fl.frequency.value = f; fl.Q.value = q; g.gain.value = v; s.connect(fl); fl.connect(g); g.connect(inst.gain); s.start(0, rnd()); inst.srcs.push(s); return { f: fl, g: g }; }
    function lfo(inst, rate, depth, param) { var o = ctx.createOscillator(), d = ctx.createGain(); o.frequency.value = rate; d.gain.value = depth; o.connect(d); d.connect(param); hold(inst, o); return o; }
    function drone(inst, type, midi, v, cut, det) {
      var o = ctx.createOscillator(), lp = ctx.createBiquadFilter(), g = ctx.createGain(); o.type = type; o.frequency.value = mtof(midi + M.tr); if (det) o.detune.value = det;
      lp.type = "lowpass"; lp.frequency.value = cut * M.bright; lp.Q.value = 0.6; g.gain.value = v; o.connect(lp); lp.connect(g); g.connect(inst.gain); hold(inst, o); inst.tune.push([o, midi]); return lp;
    }
    function pick(inst, arr) { return arr[Math.floor(inst.r() * arr.length)]; }

    /* ---------- tracks ---------- */
    var T = {};
    var MOHANAM = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21];
    T.chennai = { bpm: 76, level: 0.4, init: function (i) {
      var w = noiseBed(i, PINK, "lowpass", 700, 0.6, 0.0); lfo(i, 0.09, 0.2, w.g.gain); w.g.gain.value = 0.22; i.sea = w;
      drone(i, "triangle", 38, 0.1, 500, 0); drone(i, "sine", 50, 0.06, 400, 0); i.idx = 3;
    }, step: function (i, n, t) {
      var s = n % 16, d = i.gain;
      if (s === 0) pluck(d, t, mtof(50 + M.tr - 5), 3.4, 0.28, { cut: 1400, end: 0.3, a: 0.012, det: 1.003 });
      if (s === 4 || s === 8) pluck(d, t, mtof(50 + M.tr), 3.4, 0.26, { cut: 1500, end: 0.3, a: 0.012 });
      if (s === 12) pluck(d, t, mtof(38 + M.tr), 3.6, 0.3, { cut: 1100, end: 0.3, a: 0.012 });
      if ((s === 2 || s === 6 || s === 10 || s === 14) && i.r() < 0.5) {
        i.idx = clamp(i.idx + pick(i, [-2, -1, -1, 1, 1, 2]), 0, MOHANAM.length - 1);
        pluck(d, t, mtof(62 + M.tr + MOHANAM[i.idx]), 1.7, 0.2, { type: "triangle", type2: "sawtooth", cut: 2600, end: 0.2, slide: -1.2, det: 1.002 });
      }
      if (s === 0 || s === 6 || s === 10) thump(d, t, s === 0 ? 0.3 : 0.2, 110);
      if (s % 4 === 2) shaker(d, t, 0.06);
    } };
    var LOFI = [[62, 65, 69, 72, 76], [59, 62, 65, 69, 71], [60, 64, 67, 71, 74], [57, 60, 64, 67, 72]], LOFIB = [38, 43, 36, 45];
    T.bangalore = { bpm: 78, level: 0.61, init: function (i) { drone(i, "sine", 50, 0.06, 500, 0); drone(i, "triangle", 57, 0.025, 700, 4); noiseBed(i, PINK, "lowpass", 3200, 0.5, 0.03); }, step: function (i, n, t, dt) {
      var s = n % 16, bar = Math.floor(n / 16) % 4, d = i.gain, sw = (s % 2) ? dt * 0.28 : 0;
      if (s === 0 || s === 10) LOFI[bar].forEach(function (m, k) { pluck(d, t + k * 0.014, mtof(m + M.tr), s ? 1.1 : 2.4, 0.12, { type: "sine", type2: "triangle", det: 2.0, cut: 1900, end: 0.4, a: 0.012, q: 0.5 }); });
      if (s === 0 || s === 7 || s === 10) pluck(d, t, mtof(LOFIB[bar] + M.tr), 0.6, 0.34, { type: "sine", type2: null, cut: 600, end: 0.6, a: 0.01 });
      if (s === 0 || s === 7 || s === 10) kick(d, t, 0.34);
      if (s === 4 || s === 12) snare(d, t, 0.14);
      if (s % 2 === 0) hat(d, t + sw, (s % 4 === 0 ? 0.08 : 0.05) * (0.8 + i.r() * 0.4), false);
      if (i.r() < 0.22) nv(d, t + i.r() * dt, 0.012, "highpass", 3500, 0, 0.7, 0.07, 0.0005, WHITE);
    } };
    T.ladakh = { bpm: 60, level: 0.48, init: function (i) {
      var l = drone(i, "sawtooth", 38, 0.14, 260, 0); lfo(i, 0.05, 150, l.frequency);
      drone(i, "sawtooth", 38, 0.1, 240, 7); drone(i, "sine", 45, 0.14, 300, 0); drone(i, "triangle", 50, 0.05, 500, 0);
      var w = noiseBed(i, PINK, "bandpass", 520, 0.7, 0.2); lfo(i, 0.07, 280, w.f.frequency); lfo(i, 0.045, 0.1, w.g.gain);
      var w2 = noiseBed(i, WHITE, "highpass", 3200, 0.5, 0.025); lfo(i, 0.06, 0.02, w2.g.gain);
    }, step: function (i, n, t) {
      var s = n % 16, d = i.gain;
      if (s === 0 && i.r() < 0.75) { var m = pick(i, [74, 76, 79, 81, 83, 86]); bell(d, t, mtof(m + M.tr), 5.5, 0.16); if (i.r() < 0.35) bell(d, t + 0.5, mtof(m + M.tr + 7), 5, 0.1); }
      if (s === 8 && i.r() < 0.3) bell(d, t, mtof(pick(i, [62, 69, 74]) + M.tr), 7, 0.12);
      if (n % 64 === 32) { var g = ctx.createGain(), lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 220; g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.09, t + 4); g.gain.linearRampToValueAtTime(0.0001, t + 11);
        [-0, 7].forEach(function (c) { var o = ctx.createOscillator(); o.type = "sawtooth"; o.frequency.value = mtof(38 + M.tr); o.detune.value = c * 3; o.connect(lp); o.start(t); o.stop(t + 11.1); }); lp.connect(g); g.connect(d); }
    } };
    var HW = [[57, 60, 64], [53, 57, 60], [48, 55, 60], [55, 59, 62]], HWB = [33, 29, 36, 31];
    T.highway = { bpm: 112, level: 0.62, init: function (i) { }, step: function (i, n, t, dt) {
      var s = n % 16, bar = Math.floor(n / 16) % 4, d = i.gain, ch = HW[bar];
      if (s % 4 === 0) kick(d, t, 0.26);
      if (s % 4 === 2) hat(d, t, 0.09, s === 14); else if (s % 2 === 1) hat(d, t, 0.025, false);
      if (s % 2 === 0) pluck(d, t, mtof(HWB[bar] + M.tr + (s === 6 || s === 14 ? 12 : 0)), 0.2, 0.22, { cut: 520, end: 0.5, q: 2, type2: "square", det: 1.006 });
      pluck(d, t, mtof(ch[[0, 1, 2, 1][s % 4]] + 12 + M.tr), 0.16, 0.07, { type: "square", type2: null, cut: 2200, end: 0.3 });
      if (s === 0) ch.forEach(function (m) { pad(d, t, mtof(m + 12 + M.tr), 4.3, 0.045, 900); });
      if (s === 8) snare(d, t, 0.1);
    } };
    var NT = [[50, 53, 57], [46, 50, 53], [53, 57, 60], [48, 52, 55]];
    T.geartribe = { bpm: 84, level: 0.45, init: function (i) { drone(i, "sine", 38, 0.14, 300, 0); drone(i, "triangle", 50, 0.04, 600, 6); }, step: function (i, n, t) {
      var s = n % 16, bar = Math.floor(n / 16) % 4, d = i.gain, ch = NT[bar];
      if (s === 0) ch.forEach(function (m) { pad(d, t, mtof(m + 12 + M.tr), 3.9, 0.07, 700); });
      if (s % 2 === 0) pluck(d, t, mtof(ch[(s / 2 + (bar % 2)) % 3] + 24 + M.tr), 0.5, 0.09, { type: "sine", type2: "triangle", det: 2.0, cut: 3000, end: 0.5 });
      if (s % 8 === 0) tv(d, t, "sine", 80, 45, 0.3, 0.3, 0.004);
      if (i.r() < 0.06) tv(d, t, "sine", mtof(pick(i, [86, 89, 93]) + M.tr), 0, 0.3, 0.05, 0.003);
    } };
    var GD = [[62, 66, 69], [57, 61, 64], [59, 62, 66], [55, 59, 62]];
    T.golden = { bpm: 80, level: 0.53, init: function (i) { drone(i, "triangle", 38, 0.08, 400, 0); }, step: function (i, n, t) {
      var s = n % 16, bar = Math.floor(n / 16) % 4, d = i.gain, ch = GD[bar];
      if (s === 0) { ch.forEach(function (m) { pad(d, t, mtof(m + M.tr), 3.9, 0.07, 1100); }); bell(d, t, mtof(ch[2] + 24 + M.tr), 3, 0.09); }
      if (s % 2 === 0) pluck(d, t, mtof(ch[(s / 2) % 3] + 12 + M.tr), 0.7, 0.13, { type: "triangle", type2: "sine", det: 2.0, cut: 2600, end: 0.35 });
      if (s % 4 === 2) shaker(d, t, 0.05);
      if (s === 0 || s === 8) pluck(d, t, mtof(ch[0] - 12 + M.tr), 1.0, 0.3, { type: "sine", type2: null, cut: 500 });
    } };
    var PENT = [0, 2, 4, 7, 9, 12, 14, 16];
    T.morning = { bpm: 100, level: 0.55, init: function (i) { drone(i, "sine", 36, 0.06, 300, 0); i.idx = 2; }, step: function (i, n, t) {
      var s = n % 16, bar = Math.floor(n / 16) % 2, d = i.gain;
      if (s === 0) [60, 64, 67].forEach(function (m) { pad(d, t, mtof(m + 12 * 0 + M.tr), 4.5, 0.05, 1500); });
      if (s % 2 === 0 && i.r() < 0.6) { i.idx = clamp(i.idx + pick(i, [-2, -1, 1, 1, 2]), 0, PENT.length - 1); pluck(d, t, mtof(72 + M.tr + PENT[i.idx]), 0.5, 0.18, { type: "sine", type2: "triangle", det: 2.0, cut: 3400, end: 0.3 }); }
      if (s === 0 || s === 8) pluck(d, t, mtof((bar ? 31 : 36) + M.tr), 0.9, 0.3, { type: "sine", type2: null, cut: 600 });
      if (s % 2 === 0) shaker(d, t, 0.05); if (s === 0 && i.r() < 0.5) chirp(d, t + 0.4 + i.r() * 2, 0.05);
    } };
    var EV = [[57, 60, 64], [53, 57, 60], [60, 64, 67], [55, 59, 62]];
    T.evening = { bpm: 66, level: 0.54, init: function (i) {
      drone(i, "triangle", 33, 0.08, 400, 0); var c = noiseBed(i, WHITE, "bandpass", 4300, 8, 0.0); var g2 = ctx.createGain(); g2.gain.value = 0.5; var o = ctx.createOscillator(); o.frequency.value = 26; var od = ctx.createGain(); od.gain.value = 0.5; o.connect(od); od.connect(g2.gain);
      c.g.disconnect(); c.g.gain.value = 0.05; c.g.connect(g2); g2.connect(i.gain); hold(i, o);
    }, step: function (i, n, t) {
      var s = n % 16, bar = Math.floor(n / 16) % 4, d = i.gain, ch = EV[bar];
      if (s === 0) ch.forEach(function (m) { pad(d, t, mtof(m + M.tr), 3.9, 0.07, 800); });
      if (s % 2 === 0) pluck(d, t, mtof(ch[[0, 1, 2, 1, 2, 1, 0, 1][(s / 2) % 8]] + 12 + M.tr), 1.3, 0.15, { type2: "triangle", cut: 1700, end: 0.2, det: 1.003 });
      if (s === 0) kick(d, t, 0.2);
      if (s === 0 || s === 8) pluck(d, t, mtof(ch[0] - 12 + M.tr), 1.3, 0.28, { type: "sine", type2: null, cut: 500 });
    } };

    /* ---------- music engine: look-ahead scheduler, crossfades ---------- */
    var insts = [], curId = null, musicChoice = "auto", enabled = false, timer = null, XF = 3.2, wantSince = 0, wantId = null, LOOK = 0.7;
    function startTrack(id) {
      var def = T[id]; if (!def) return null;
      var inst = { id: id, def: def, gain: ctx.createGain(), fade: ctx.createGain(), srcs: [], tune: [], step: 0, nextT: clock() + 0.08, r: rngf(Math.floor(rnd() * 1e9)), dead: false, endAt: 0 };
      var t = clock(), ramp = insts.some(function (x) { return !x.dead; }) ? XF : 1.4; inst.gain.gain.setValueAtTime(0.0001, t); inst.gain.gain.linearRampToValueAtTime(def.level, t + ramp); inst.fade.gain.value = 1; inst.gain.connect(inst.fade); inst.fade.connect(musicBus);
      def.init(inst); insts.push(inst); return inst;
    }
    function stopTrack(inst, xf) {
      var t = clock(), fp = inst.fade.gain; inst.dead = true; inst.endAt = t + xf + 0.3;
      fp.setValueAtTime(1, t); fp.linearRampToValueAtTime(0.0001, t + xf);
      inst.srcs.forEach(function (s) { try { s.stop(t + xf + 0.2); } catch (e) {} });
    }
    function setTrack(id) {
      if (id === curId) return; curId = id;
      insts.forEach(function (x) { if (!x.dead) stopTrack(x, XF); });
      if (id && enabled) startTrack(id);
    }
    function tick() {
      var T0 = clock();
      for (var k = insts.length - 1; k >= 0; k--) {
        var x = insts[k];
        if (x.dead) { if (T0 > x.endAt) { if (!opt.manual) { try { x.fade.disconnect(); } catch (e) {} } insts.splice(k, 1); } continue; }
        var guard = 0;
        while (x.nextT < T0 + LOOK && guard++ < 40) { var dt = 60 / (x.def.bpm * M.tempo) / 4; x.def.step(x, x.step, x.nextT, dt); x.nextT += dt; x.step++; }
      }
    }
    E._tick = tick;
    function startTimer() { if (opt.manual || timer) return; timer = setInterval(tick, 110); }
    function stopTimer() { if (timer) { clearInterval(timer); timer = null; } }

    /* ---------- public API ---------- */
    E.ctx = ctx;
    /* unlock: call inside a user gesture. SFX are always on once unlocked; music follows setMusic */
    E.unlock = function () {
      var first = !enabled, t = clock(); enabled = true;
      if (ctx.resume && ctx.state !== "running") { try { var pr = ctx.resume(); if (pr && pr.catch) pr.catch(function () {}); } catch (e) {} }
      if (first) { try { var sb = ctx.createBuffer(1, 1, SR), ss = ctx.createBufferSource(); ss.buffer = sb; ss.connect(ctx.destination); ss.start(0); } catch (e) {} }
      out.gain.cancelScheduledValues(t); out.gain.setTargetAtTime(0.85, t, 0.04); startTimer();
      if (first) { curId = null; wantId = null; if (musicChoice !== "auto" && musicChoice !== "off") setTrack(musicChoice); }
    };
    E.isOn = function () { return enabled && ctx.state === "running"; };
    E.isUnlocked = function () { return enabled; };
    E.setMusic = function (c) { musicChoice = c; wantId = null; if (!enabled) return; if (c === "off") setTrack(null); else if (c !== "auto") setTrack(c); else { /* update() picks the biome track */ } };
    E.getMusic = function () { return musicChoice; };
    E.setTod = function (x) { tod = x; M = MOODS[x] || M; var t = clock(); insts.forEach(function (i) { i.tune.forEach(function (p) { p[0].frequency.setTargetAtTime(mtof(p[1] + M.tr), t, 0.9); }); }); };
    E.getTod = function () { return tod; };
    E.setVol = function (k, v) { if (k === "music") { vol.music = clamp(v, 0, 1); applyVol(); } };
    E.getVol = function () { return { music: vol.music }; };
    E.current = function () { return curId; };
    E.tracks = TRACK_IDS;
    E.duck = duck;
    E.tap = function () { if (enabled) SF.tap(clock()); };
    E.out = out; E.musicBus = musicBus; E.sfxBus = sfxBus;

    /* stop reached: pop, whoosh, arrival, (first time) badge chime, music ducks a few dB */
    E.stopReached = function (first) {
      if (!enabled) return; var t = clock();
      SF.pop(t); SF.whoosh(t + 0.1); SF.arrive(t + 0.2); if (curId) duck(first ? 5 : 3.5, first ? 1.6 : 0.9);
      if (first) SF.badge(t + 0.45);
    };

    /* per-frame: travel sfx + biome music. s = {dist, speed, mode, amt, biome, reduce} */
    var pd = null, stepAcc = 0, tickAcc = 0, lastStep = -9, side = 1, prevAmt = 0, prevMode = null, lastBrake = -9, lastUpd = -9;
    E.update = function (s) {
      var t = clock();
      if (!enabled) { pd = s.dist; return; }
      if (!opt.manual && ctx.state !== "running") { pd = s.dist; return; }
      if (musicChoice === "auto") {
        var w = AUTO[clamp(s.biome | 0, 0, AUTO.length - 1)];
        if (w !== wantId) { wantId = w; wantSince = t; }
        if (wantId !== curId && (!curId || t - wantSince > 1.0)) setTrack(wantId);
      }
      var amt = s.reduce ? 0 : s.amt, mode = s.mode;
      if (mode !== prevMode) { if (prevMode && mode === "moto") { revT = t; SF.crank(t); } killVoice(mode === "cycle" ? null : cyc, t); if (mode !== "cycle") cyc = null; if (mode !== "moto") { killVoice(bike, t); bike = null; } prevMode = mode; }
      var dd = pd === null ? 0 : Math.abs(s.dist - pd); pd = s.dist;
      if (amt > 0.04 && dd > 0 && dd < 90) {
        if (mode === "walk") { stepAcc += dd; if (stepAcc >= 28.3) { stepAcc %= 28.3; if (t - lastStep > 0.13) { lastStep = t; side = -side; SF.step(t + 0.005, rnd(), side); } } }
        else if (mode === "cycle") { tickAcc += dd; var guard = 0; while (tickAcc >= 13 && guard++ < 3) { tickAcc -= 13; SF.tick(t + 0.004 + guard * 0.008); } }
      }
      if (prevAmt > 0.3 && amt < 0.06 && t - lastBrake > 0.7 && !s.reduce) { lastBrake = t; SF.brake(t, mode); }
      prevAmt = amt;
      if (t - lastCtl < 0.032) return; lastCtl = t;
      if (mode === "cycle") {
        if (!cyc) cyc = mkCycle();
        cyc.g.gain.setTargetAtTime(amt > 0.04 ? 0.5 + 1.8 * amt : 0, t, 0.06); cyc.bp.frequency.setTargetAtTime(700 + 1500 * amt, t, 0.08); cyc.lfo.frequency.setTargetAtTime(6 + 12 * amt, t, 0.1);
      } else if (cyc) { killVoice(cyc, t); cyc = null; }
      if (mode === "moto") {
        var rv = clamp(1 - (t - revT) / 1.1, 0, 1), e = Math.max(amt, rv * 0.7 * Math.sin(Math.min(1, (t - revT) / 0.35) * Math.PI * 0.5) * (rv > 0 ? 1 : 0));
        if (!bike && (e > 0.03)) bike = mkBike();
        if (bike) {
          var f0 = 40 + e * 62, lv = e > 0.03 ? 0.2 + 0.8 * Math.pow(e, 0.6) : 0;
          bike.a.frequency.setTargetAtTime(f0, t, 0.05); bike.b.frequency.setTargetAtTime(f0 * 2.01, t, 0.05); bike.c.frequency.setTargetAtTime(f0 * 0.985, t, 0.05);
          bike.lp.frequency.setTargetAtTime(520 + e * 2300, t, 0.06); bike.thl.frequency.setTargetAtTime(8 + e * 20, t, 0.06);
          bike.ng.gain.setTargetAtTime(0.04 + 0.34 * e, t, 0.06); bike.nbp.frequency.setTargetAtTime(380 + e * 1500, t, 0.08);
          bike.g.gain.setTargetAtTime(0.5 * lv, t, 0.06);
          if (lv === 0 && !bike.idleSince) bike.idleSince = t; else if (lv > 0) bike.idleSince = 0;
          if (bike.idleSince && t - bike.idleSince > 1.2) { killVoice(bike, t); bike = null; }
        }
      }
    };
    E.suspend = function () { if (ctx.suspend && ctx.state === "running") ctx.suspend(); };
    E.resume = function () { if (enabled && ctx.resume && ctx.state === "suspended") ctx.resume(); };
    E.debug = function () { return { unlocked: enabled, track: curId, choice: musicChoice, tod: tod, state: ctx.state, insts: insts.length, cyc: !!cyc, bike: !!bike }; };
    return E;
  }
  root.OdysseyAudio = { create: create, AUTO: AUTO, TRACKS: TRACK_IDS };
})(window);
