/* Tarun RG · The ride. One canvas, one rAF loop, pre-rendered parallax tiles. */
(function () {
  "use strict";
  var D = window.ODYSSEY, STOPS = D.stops, N = STOPS.length;
  var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  var INK = "#1D1A1F", PAPER = "#FBF6EC", CREAM = "#F4ECDD", OCHRE = "#D9A441", TEAL = "#3E8A86",
      BRICK = "#B5523B", SAGE = "#8FA77E", NAVY = "#23324F", MAROON = "#8E1B2B";
  var SERIF = '"Fraunces", Georgia, serif', SANS = '"Manrope", system-ui, sans-serif';

  /* ---------- world geometry ---------- */
  var GAP = 2200, X0 = 760;
  var STOPX = STOPS.map(function (_, i) { return X0 + i * GAP; });
  var WORLD_END = STOPX[N - 1] + 900;
  var KM_PER_PX = 0.17;

  /* biomes, one per stop */
  var B = [
    { sky: ["#FBE6BE", "#F3B98A"], night: 0, far: ["#9CC3BC", "#6FA39E"], amp: [10, 0], sea: 1, ground: "#E8C890", deep: "#D8AF74", road: "#6E5E53", line: "#F4ECDD", sun: "#F6D27A" },
    { sky: ["#D7E8E2", "#F3E4C6"], night: 0, far: ["#AFC6C4", "#8EAAAA"], amp: [40, 26], city: 1, ground: "#C9BB8E", deep: "#B4A677", road: "#5C5A5E", line: "#F4ECDD", sun: "#FBEFC9" },
    { sky: ["#F7D5B4", "#EBA88E"], night: 0, far: ["#D7A79A", "#BC8A86"], amp: [36, 20], city: 1, ground: "#D4B488", deep: "#C29E70", road: "#5E5258", line: "#F4ECDD", sun: "#F8D98A" },
    { sky: ["#2E3C62", "#C56E5C"], night: .55, far: ["#4E5378", "#3A3F63"], amp: [70, 48], city: 2, ground: "#5E5A6C", deep: "#4B4859", road: "#2E2D38", line: "#D9A441", moon: 1 },
    { sky: ["#18213A", "#3B4A6E"], night: 1, far: ["#2E3A5C", "#232D4B"], amp: [60, 44], city: 2, ground: "#3C4258", deep: "#30354A", road: "#22222C", line: "#D9A441", moon: 1 },
    { sky: ["#AED3E3", "#F1E7C8"], night: 0, far: ["#93AFC9", "#7697B5"], amp: [80, 46], ground: "#A9BC86", deep: "#8FA77E", road: "#55565C", line: "#F4ECDD", sun: "#FFF2C8" },
    { sky: ["#7FB3D9", "#E7F1F4"], night: 0, far: ["#C9DDEB", "#9DB9D2"], amp: [150, 95], snow: 1, ground: "#D8C29E", deep: "#C2A982", road: "#6A6C74", line: "#F4ECDD", sun: "#FFFFFF" },
    { sky: ["#141C33", "#30416A"], night: 1, far: ["#2B3A5E", "#1F2B49"], amp: [110, 70], snow: .5, ground: "#3A465E", deep: "#2E384D", road: "#20232E", line: "#D9A441", moon: 1 },
    { sky: ["#FAE0B0", "#F0A56E"], night: 0, far: ["#E3B98C", "#C9976E"], amp: [50, 30], ground: "#DDB57C", deep: "#C99C62", road: "#6B4F48", line: "#F4ECDD", sun: "#FBE29A", big: 1 }
  ];

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function smooth(t) { return t * t * (3 - 2 * t); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  /* biome blend at a world x: [i, j, t] */
  function biomeAt(x) {
    if (x <= STOPX[0]) return [0, 0, 0];
    if (x >= STOPX[N - 1]) return [N - 1, N - 1, 0];
    var i = Math.floor((x - X0) / GAP), local = (x - STOPX[i]) / GAP;
    return [i, i + 1, smooth(clamp((local - 0.38) / 0.24, 0, 1))];
  }
  function hex(h) { return [parseInt(h.substr(1, 2), 16), parseInt(h.substr(3, 2), 16), parseInt(h.substr(5, 2), 16)]; }
  var hexCache = {};
  function mix(a, b, t) {
    if (t <= 0) return a; if (t >= 1) return b;
    var A = hexCache[a] || (hexCache[a] = hex(a)), C = hexCache[b] || (hexCache[b] = hex(b));
    return "rgb(" + Math.round(lerp(A[0], C[0], t)) + "," + Math.round(lerp(A[1], C[1], t)) + "," + Math.round(lerp(A[2], C[2], t)) + ")";
  }
  function bget(x, key, idx) {
    var w = biomeAt(x), a = B[w[0]][key], b = B[w[1]][key];
    if (idx !== undefined) { a = a[idx]; b = b[idx]; }
    if (typeof a === "number" || typeof b === "number" || a === undefined || b === undefined) return lerp(a || 0, b || 0, w[2]);
    return mix(a, b, w[2]);
  }
  function rng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; var t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function noise(x, s) {
    var i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
    function h(n) { var v = Math.sin((n + s * 131.7) * 127.1) * 43758.5453; return v - Math.floor(v); }
    return lerp(h(i), h(i + 1), u);
  }

  /* ---------- canvas ---------- */
  var cv = document.getElementById("world"), ctx = cv.getContext("2d", { alpha: false });
  var W = 0, H = 0, DPR = 1, S = 1, GY = 0, portrait = false, dprCap = 2;

  /* ---------- drawing helpers (ligne claire: flat fills, ink outlines) ---------- */
  function ink(c, w) { c.strokeStyle = INK; c.lineWidth = w || 2; c.lineJoin = "round"; c.lineCap = "round"; }
  function fs(c, col) { c.fillStyle = col; c.fill(); c.stroke(); }
  function rect(c, x, y, w, h, col) { c.beginPath(); c.rect(x, y, w, h); fs(c, col); }
  function rrect(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  function circle(c, x, y, r, col) { c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); fs(c, col); }
  function txt(c, s, x, y, font, col) { c.fillStyle = col; c.font = font; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(s, x, y); }

  /* ---------- parallax layers: pre-rendered, cached tiles ---------- */
  var TW = 512;
  function Layer(name, f, top, th) { this.name = name; this.f = f; this.top = top; this.th = th; this.objs = []; this.cache = new Map(); this.cont = null; }
  var FAR = new Layer("far", 0.28, -236, 240);
  var MID = new Layer("mid", 0.6, -276, 290);
  var ROAD = new Layer("road", 1, -112, 0);
  var FORE = new Layer("fore", 1.32, 70, 0);
  var LAYERS = [FAR, MID, ROAD, FORE];
  function camOf(L, lx) { return lx / L.f; }

  /* FAR: sea, skylines, mountain ridges */
  FAR.cont = function (c, x0, x1) {
    var L = this, step = 6, x, h, cam, midCam = camOf(L, (x0 + x1) / 2);
    c.beginPath(); c.moveTo(x0, 0);
    for (x = x0; x <= x1 + step; x += step) { cam = camOf(L, x); h = bget(cam, "amp", 0) * (0.45 + 0.75 * noise(x / 90, 1) + 0.25 * noise(x / 23, 2)); c.lineTo(x, -h - 30); }
    c.lineTo(x1 + step, 0); c.closePath(); ink(c, 1.6); c.fillStyle = bget(midCam, "far", 0); c.fill(); c.stroke();
    var snowAmt = Math.max(bget(camOf(L, x0), "snow"), bget(camOf(L, x1), "snow"));
    if (snowAmt > 0.05) {
      c.save(); c.clip();
      c.beginPath(); c.moveTo(x0, -400);
      for (x = x0; x <= x1 + step; x += step) { cam = camOf(L, x); var a = bget(cam, "amp", 0); c.lineTo(x, -30 - a * 0.8 + Math.sin(x / 9) * 4 + noise(x / 15, 7) * 8); }
      c.lineTo(x1 + step, -400); c.closePath(); c.globalAlpha = Math.min(1, snowAmt * 1.4); c.fillStyle = "#FFFFFF"; c.fill(); c.globalAlpha = 1; c.lineWidth = 1.2; c.stroke();
      c.restore();
    }
    for (x = Math.floor(x0 / 34) * 34 - 34; x < x1; x += 34) {
      cam = camOf(L, x); var w = biomeAt(cam), city = lerp(B[w[0]].city || 0, B[w[1]].city || 0, w[2]);
      var rr = rng(Math.round(x * 7.31));
      if (city < 0.25 || rr() > city * 0.9) continue;
      var bh = 40 + rr() * 70 * Math.min(city, 1.5), bw = 20 + rr() * 16;
      c.beginPath(); c.rect(x, -bh, bw, bh); ink(c, 1.4); c.fillStyle = bget(cam, "far", 1); c.fill(); c.stroke();
      var night = bget(cam, "night");
      c.fillStyle = night > 0.3 ? "#E9C46A" : "rgba(255,255,255,.45)";
      for (var wy = -bh + 6; wy < -8; wy += 9) for (var wx = x + 4; wx < x + bw - 5; wx += 7) if (rr() > 0.5) c.fillRect(wx, wy, 3, 4);
    }
    c.beginPath(); c.moveTo(x0, 0);
    for (x = x0; x <= x1 + step; x += step) { cam = camOf(L, x); h = bget(cam, "amp", 1) * (0.3 + 0.8 * noise(x / 60, 3)); c.lineTo(x, -h - 6); }
    c.lineTo(x1 + step, 0); c.closePath(); ink(c, 1.6); c.fillStyle = bget(midCam, "far", 1); c.fill(); c.stroke();
    var seaAmt = Math.max(bget(camOf(L, x0), "sea"), bget(camOf(L, x1), "sea"));
    if (seaAmt > 0.02) {
      c.globalAlpha = seaAmt; c.fillStyle = TEAL; c.fillRect(x0 - 2, -26, x1 - x0 + 4, 26);
      c.strokeStyle = "rgba(244,236,221,.8)"; c.lineWidth = 1.4;
      for (var sx = Math.floor(x0 / 22) * 22; sx < x1; sx += 22) { var oy = (Math.abs(sx / 22) % 3) * 6; c.beginPath(); c.moveTo(sx, -8 - oy); c.quadraticCurveTo(sx + 5, -12 - oy, sx + 10, -8 - oy); c.stroke(); }
      ink(c, 1.6); c.beginPath(); c.moveTo(x0, -26); c.lineTo(x1, -26); c.stroke(); c.globalAlpha = 1;
    }
  };

  /* object builders */
  function palm(c, x, s) {
    c.beginPath(); c.moveTo(x, 0); c.quadraticCurveTo(x + 10 * s, -60 * s, x + 4 * s, -110 * s); c.lineCap = "round"; c.lineWidth = 7 * s; c.strokeStyle = INK; c.stroke(); c.lineWidth = 4.2 * s; c.strokeStyle = "#9C7A54"; c.stroke(); ink(c, 1.8);
    var tx = x + 4 * s, ty = -110 * s;
    for (var k = 0; k < 6; k++) { var a = -Math.PI / 2 + (k - 2.5) * 0.55; c.beginPath(); c.moveTo(tx, ty); c.quadraticCurveTo(tx + Math.cos(a) * 30 * s, ty + Math.sin(a) * 26 * s - 6 * s, tx + Math.cos(a) * 46 * s, ty + Math.sin(a) * 14 * s + 18 * s); c.quadraticCurveTo(tx + Math.cos(a) * 26 * s, ty + Math.sin(a) * 18 * s + 4 * s, tx, ty); fs(c, k % 2 ? "#6E9A63" : SAGE); }
    circle(c, tx, ty + 3, 4 * s, "#8A6A3E");
  }
  function tree(c, x, s, col) { ink(c, 2); rect(c, x - 3 * s, -34 * s, 6 * s, 34 * s, "#8A6A4A"); c.beginPath(); c.arc(x - 12 * s, -42 * s, 15 * s, 0, 7); fs(c, col); c.beginPath(); c.arc(x + 12 * s, -44 * s, 16 * s, 0, 7); fs(c, col); circle(c, x, -60 * s, 18 * s, col); c.beginPath(); c.arc(x - 12 * s, -42 * s, 13.5 * s, 0, 7); c.arc(x + 12 * s, -44 * s, 14.5 * s, 0, 7); c.fillStyle = col; c.fill(); }
  function pine(c, x, s, col) { ink(c, 2); rect(c, x - 2.5 * s, -14 * s, 5 * s, 14 * s, "#7A5A3E"); c.beginPath(); c.moveTo(x, -78 * s); c.lineTo(x + 18 * s, -14 * s); c.lineTo(x - 18 * s, -14 * s); c.closePath(); fs(c, col); }
  function house(c, x, w, h, wall, roof) { ink(c, 2); rect(c, x, -h, w, h, wall); c.beginPath(); c.moveTo(x - 4, -h); c.lineTo(x + w / 2, -h - w * 0.32); c.lineTo(x + w + 4, -h); c.closePath(); fs(c, roof); rect(c, x + w * 0.38, -h * 0.5, w * 0.24, h * 0.5, NAVY); rect(c, x + 6, -h + 8, w * 0.22, h * 0.22, "#F2DFA8"); }
  function tower(c, x, w, h, glass, night) {
    ink(c, 2.2); rect(c, x, -h, w, h, glass); c.lineWidth = 1; c.strokeStyle = "rgba(29,26,31,.5)"; c.beginPath();
    for (var yy = -h + 12; yy < 0; yy += 12) { c.moveTo(x, yy); c.lineTo(x + w, yy); } for (var xx = x + 10; xx < x + w; xx += 10) { c.moveTo(xx, -h); c.lineTo(xx, 0); } c.stroke();
    if (night) { c.fillStyle = "#E9C46A"; var r = rng(Math.round(x)); for (yy = -h + 3; yy < -4; yy += 12) for (xx = x + 2; xx < x + w - 4; xx += 10) if (r() > 0.5) c.fillRect(xx, yy, 6, 7); }
    else { c.fillStyle = "rgba(255,255,255,.35)"; c.beginPath(); c.moveTo(x + 4, -h + 4); c.lineTo(x + w * 0.45, -h + 4); c.lineTo(x + 4, -h * 0.4); c.fill(); }
    ink(c, 2.2); c.strokeRect(x, -h, w, h);
  }
  function board(c, x, y, w, h, bg, fg, text, font) { ink(c, 2); rrect(c, x, y, w, h, 4); fs(c, bg); txt(c, text, x + w / 2, y + h / 2 + 1, font, fg); }
  function poster(c, x, w, h, bg, fg, title, sub) {
    ink(c, 2); rect(c, x + w * 0.2, -26, 4, 26, INK); rect(c, x + w * 0.8 - 4, -26, 4, 26, INK);
    rrect(c, x, -26 - h, w, h, 3); fs(c, bg); c.lineWidth = 1.4; rrect(c, x + 4, -22 - h, w - 8, h - 8, 2); c.stroke();
    var lines = title.split("|"), fsz = h * 0.16; c.font = "700 " + fsz + "px " + SERIF;
    for (var j = 0; j < lines.length; j++) { var mw = c.measureText(lines[j]).width; if (mw > w - 14) fsz = Math.min(fsz, fsz * (w - 14) / mw); }
    for (var i = 0; i < lines.length; i++) txt(c, lines[i], x + w / 2, -26 - h + h * (0.36 + i * 0.2), "700 " + fsz.toFixed(1) + "px " + SERIF, fg);
    if (sub) txt(c, sub, x + w / 2, -26 - h * 0.14, "700 " + Math.round(h * 0.075) + "px " + SANS, fg);
  }
  function gopuram(c, x, s) { ink(c, 2); for (var k = 0; k < 5; k++) { var w = (70 - k * 11) * s, y = -k * 18 * s; c.beginPath(); c.moveTo(x - w / 2, y); c.lineTo(x - w / 2 + 4 * s, y - 18 * s); c.lineTo(x + w / 2 - 4 * s, y - 18 * s); c.lineTo(x + w / 2, y); c.closePath(); fs(c, k % 2 ? "#D49A62" : "#E2B47A"); } c.beginPath(); c.ellipse(x, -96 * s, 10 * s, 7 * s, 0, 0, 7); fs(c, OCHRE); rect(c, x - 9 * s, -16 * s, 18 * s, 16 * s, NAVY); }
  function gate(c, x) { ink(c, 2.2); c.lineWidth = 1.6; c.beginPath(); for (var k = 0; k < 8; k++) { c.moveTo(x + 22 + k * 13, -40); c.lineTo(x + 22 + k * 13, 0); } c.moveTo(x + 14, -40); c.lineTo(x + 116, -40); c.stroke(); ink(c, 2.2); rect(c, x, -92, 14, 92, "#E7D8BC"); rect(c, x + 116, -92, 14, 92, "#E7D8BC"); rect(c, x - 8, -112, 146, 22, BRICK); txt(c, "ENGINEERING COLLEGE", x + 65, -100, "700 10px " + SANS, CREAM); }
  function stupa(c, x, s) { ink(c, 2); rect(c, x - 22 * s, -16 * s, 44 * s, 16 * s, "#F4F1EA"); rect(c, x - 16 * s, -28 * s, 32 * s, 12 * s, "#F4F1EA"); c.beginPath(); c.arc(x, -28 * s, 15 * s, Math.PI, 0); fs(c, "#F4F1EA"); rect(c, x - 3 * s, -66 * s, 6 * s, 24 * s, OCHRE); c.beginPath(); c.moveTo(x - 6 * s, -66 * s); c.lineTo(x, -76 * s); c.lineTo(x + 6 * s, -66 * s); c.closePath(); fs(c, MAROON); }
  var FLAGS = ["#2F6DB5", "#F4F1EA", "#C0392B", "#4E9A55", "#E8B83A"];
  function flags(c, x0, x1, top, sag) { ink(c, 1.4); c.beginPath(); c.moveTo(x0, top); c.quadraticCurveTo((x0 + x1) / 2, top + sag * 2, x1, top); c.stroke(); var n = Math.floor((x1 - x0) / 12); for (var k = 1; k < n; k++) { var t = k / n, fx = lerp(x0, x1, t), fy = top + sag * 4 * t * (1 - t) * 0.98; c.beginPath(); c.moveTo(fx - 4, fy); c.lineTo(fx + 4, fy); c.lineTo(fx + 2, fy + 11); c.lineTo(fx - 4, fy + 9); c.closePath(); c.fillStyle = FLAGS[k % 5]; c.fill(); c.lineWidth = 1; c.stroke(); } }
  function pole(c, x, h) { ink(c, 1.6); rect(c, x - 2, -h, 4, h, "#7A5A3E"); }
  function lightStand(c, x) { c.fillStyle = "rgba(249,226,140,.4)"; c.beginPath(); c.moveTo(x + 12, -84); c.lineTo(x + 80, -10); c.lineTo(x + 80, 0); c.lineTo(x + 30, 0); c.lineTo(x + 12, -70); c.fill(); ink(c, 2); c.beginPath(); c.moveTo(x, 0); c.lineTo(x, -70); c.moveTo(x - 12, 0); c.lineTo(x, -24); c.lineTo(x + 12, 0); c.stroke(); rrect(c, x - 12, -88, 24, 20, 3); fs(c, "#3A3A44"); rect(c, x + 10, -84, 4, 12, "#F7D36A"); }
  function camera(c, x) { ink(c, 2); c.beginPath(); c.moveTo(x, 0); c.lineTo(x + 10, -40); c.lineTo(x + 20, 0); c.moveTo(x + 10, -40); c.lineTo(x + 10, 0); c.stroke(); rrect(c, x - 4, -58, 30, 18, 3); fs(c, "#2E2D38"); rect(c, x + 26, -55, 10, 12, "#55535F"); circle(c, x + 4, -64, 6, "#2E2D38"); circle(c, x + 18, -64, 6, "#2E2D38"); c.fillStyle = "#C0392B"; c.fillRect(x + 18, -54, 3, 3); }
  function tent(c, x) { ink(c, 2); c.beginPath(); c.moveTo(x, 0); c.lineTo(x + 30, -44); c.lineTo(x + 60, 0); c.closePath(); fs(c, OCHRE); c.beginPath(); c.moveTo(x + 30, -44); c.lineTo(x + 22, 0); c.lineTo(x + 38, 0); c.closePath(); fs(c, "#7C5A2E"); }
  function fire(c, x) { c.fillStyle = "rgba(249,200,110,.25)"; c.beginPath(); c.arc(x, -10, 46, 0, 7); c.fill(); ink(c, 1.6); c.beginPath(); c.moveTo(x - 12, 0); c.lineTo(x + 12, -6); c.moveTo(x + 12, 0); c.lineTo(x - 12, -6); c.stroke(); c.beginPath(); c.moveTo(x - 8, -4); c.quadraticCurveTo(x - 6, -22, x, -30); c.quadraticCurveTo(x + 8, -18, x + 8, -4); c.closePath(); fs(c, "#E8833A"); c.beginPath(); c.moveTo(x - 3, -4); c.quadraticCurveTo(x, -16, x + 1, -18); c.quadraticCurveTo(x + 4, -10, x + 4, -4); c.closePath(); c.fillStyle = "#F7D36A"; c.fill(); }
  function phoneMap(c, x) {
    c.fillStyle = "rgba(233,226,207,.12)"; c.beginPath(); c.arc(x + 48, -110, 90, 0, 7); c.fill();
    ink(c, 2.4); rect(c, x + 44, -30, 8, 30, INK); rrect(c, x, -196, 96, 170, 14); fs(c, "#22242E"); rrect(c, x + 7, -184, 82, 146, 6); fs(c, "#E9E2CF");
    c.save(); rrect(c, x + 7, -184, 82, 146, 6); c.clip(); c.strokeStyle = "#C9BFA6"; c.lineWidth = 1; c.beginPath(); for (var k = 0; k < 8; k++) { c.moveTo(x, -180 + k * 20); c.lineTo(x + 96, -170 + k * 18); } c.stroke();
    c.strokeStyle = MAROON; c.lineWidth = 4; c.beginPath(); c.moveTo(x + 18, -44); c.bezierCurveTo(x + 30, -100, x + 70, -90, x + 60, -150); c.lineTo(x + 76, -176); c.stroke();
    var pins = [[x + 30, -88], [x + 58, -128], [x + 72, -170]]; for (k = 0; k < 3; k++) { ink(c, 1.4); circle(c, pins[k][0], pins[k][1], 5, k == 2 ? TEAL : OCHRE); } c.restore();
    txt(c, "GEARTRIBE", x + 48, -190, "700 8px " + SANS, PAPER);
  }
  function stage(c, x) { ink(c, 2.2); rect(c, x + 4, -150, 8, 110, "#5E5258"); rect(c, x + 138, -150, 8, 110, "#5E5258"); rect(c, x, -40, 150, 40, "#7A3E4A"); rect(c, x - 6, -48, 162, 8, INK); rect(c, x - 8, -172, 166, 28, MAROON); txt(c, "POSSIBILITIES FEST", x + 75, -158, "700 13px " + SERIF, OCHRE); for (var k = 0; k < 6; k++) circle(c, x + 20 + k * 22, -138, 4, "#F7D36A"); }
  function studio(c, x, label) { ink(c, 2.4); rect(c, x, -150, 170, 150, "#EADBC0"); rect(c, x + 12, -120, 40, 40, "#F2D78A"); rect(c, x + 118, -120, 40, 40, "#F2D78A"); rect(c, x + 66, -64, 38, 64, NAVY); rect(c, x + 40, -180, 90, 32, MAROON); txt(c, label, x + 85, -163, "700 20px " + SERIF, CREAM); }

  function r2(x, arr) { return arr[Math.abs(Math.round(x * 13)) % arr.length]; }
  function midObj(b, x, r) {
    var s = 0.8 + r() * 0.5, k = r();
    switch (b) {
      case 0: return k < 0.6 ? { x: x, w: 50 * s, d: function (c, x) { palm(c, x + 10, s); } } : { x: x, w: 60, d: function (c, x) { house(c, x, 52, 42, r2(x, ["#E9C9A0", "#9CC3BC", "#F2DFA8"]), BRICK); } };
      case 1: return k < 0.55 ? { x: x, w: 60, d: function (c, x) { tower(c, x, 46 + Math.abs(Math.round(x)) % 3 * 6, 100 + Math.abs(Math.round(x)) % 5 * 16, "#A7CDCA", 0); } } : { x: x, w: 50, d: function (c, x) { tree(c, x + 22, s, SAGE); } };
      case 2: return k < 0.5 ? { x: x, w: 64, d: function (c, x) { house(c, x, 58, 54, r2(x, ["#E8B4A0", "#F2DFA8", "#B9D3C4", "#E6C27A"]), r2(x + 1, [MAROON, TEAL, BRICK])); } } : { x: x, w: 50, d: function (c, x) { tree(c, x + 22, s, "#C98C6E"); } };
      case 3: return k < 0.6 ? { x: x, w: 60, d: function (c, x) { tower(c, x, 46 + Math.abs(Math.round(x)) % 4 * 4, 96 + Math.abs(Math.round(x)) % 7 * 14, "#4E5A86", 1); } } : { x: x, w: 50, d: function (c, x) { tree(c, x + 22, s, "#5E7A5A"); } };
      case 4: return k < 0.55 ? { x: x, w: 60, d: function (c, x) { tower(c, x, 52, 90 + Math.abs(Math.round(x)) % 5 * 12, "#36426A", 1); } } : { x: x, w: 50, d: function (c, x) { tree(c, x + 22, s, "#3E5A4E"); } };
      case 5: return k < 0.5 ? { x: x, w: 40, d: function (c, x) { pine(c, x + 18, s, "#5E8A5A"); } } : { x: x, w: 50, d: function (c, x) { tree(c, x + 22, s, "#7FA06A"); } };
      case 6: return k < 0.3 ? { x: x, w: 50, d: function (c, x) { stupa(c, x + 25, 0.9); } } : k < 0.6 ? { x: x, w: 64, d: function (c, x) { pole(c, x, 70); pole(c, x + 60, 64); flags(c, x, x + 60, -68, 8); } } : { x: x, w: 30, d: function (c, x) { pine(c, x + 14, 0.6, "#8FA07A"); } };
      case 7: return k < 0.6 ? { x: x, w: 40, d: function (c, x) { pine(c, x + 18, s, "#2E4A44"); } } : { x: x, w: 50, d: function (c, x) { tree(c, x + 22, s, "#2F4A42"); } };
      default: return k < 0.6 ? { x: x, w: 50, d: function (c, x) { tree(c, x + 22, s * 0.9, "#B9A15E"); } } : { x: x, w: 30, d: function (c, x) { pine(c, x + 14, 0.7, "#A08A4E"); } };
    }
  }
  function genMid() {
    var L = MID, r = rng(42), x = -300, end = WORLD_END * L.f + 900;
    function at(i, dx) { return STOPX[i] * L.f + dx; }
    var lm = [
      [at(0, -200), 140, function (c, x) { gate(c, x); }], [at(0, -400), 80, function (c, x) { gopuram(c, x + 40, 1); }],
      [at(1, -170), 80, function (c, x) { tower(c, x, 70, 214, "#8FC3C0", 0); }], [at(1, -86), 60, function (c, x) { tower(c, x, 54, 160, "#A9CFCB", 0); }],
      [at(2, -220), 160, function (c, x) { stage(c, x); }],
      [at(3, -220), 170, function (c, x) { studio(c, x, "YAAS"); }], [at(3, -330), 90, function (c, x) { lightStand(c, x); }], [at(3, 240), 40, function (c, x) { camera(c, x); }],
      [at(4, -350), 84, function (c, x) { poster(c, x, 84, 112, MAROON, CREAM, "FULL|DISCLOSURE", "YAAS ORIGINAL"); }],
      [at(4, -254), 84, function (c, x) { poster(c, x, 84, 112, OCHRE, INK, "FIN|CREDIBLES", "ON INSTAGRAM"); }],
      [at(4, -158), 84, function (c, x) { poster(c, x, 84, 112, TEAL, CREAM, "ONE8", "LAUNCH CAMPAIGN"); }],
      [at(4, -62), 84, function (c, x) { poster(c, x, 84, 112, CREAM, MAROON, "WHAT THE|WALLET", "FOR CRED"); }],
      [at(5, -230), 74, function (c, x) { pole(c, x + 12, 56); pole(c, x + 60, 56); board(c, x, -80, 74, 28, "#2F7A4F", CREAM, "LEH  \u2192", "700 13px " + SANS); }],
      [at(6, -130), 250, function (c, x) { pole(c, x, 124); pole(c, x + 250, 140); flags(c, x, x + 250, -120, 18); flags(c, x, x + 250, -100, 24); }],
      [at(6, 240), 60, function (c, x) { stupa(c, x + 30, 1.5); }],
      [at(7, -160), 96, function (c, x) { phoneMap(c, x); }], [at(7, -340), 110, function (c, x) { tent(c, x); fire(c, x + 84); }]
    ];
    var busy = lm.map(function (l) { return [l[0] - 24, l[0] + l[1] + 24]; });
    function free(a, b) { for (var i = 0; i < busy.length; i++) if (b > busy[i][0] && a < busy[i][1]) return false; return true; }
    while (x < end) {
      var cam = camOf(L, x), w = biomeAt(cam), b = w[2] > 0.5 ? w[1] : w[0];
      if (w[2] > 0.15 && w[2] < 0.85) b = r() < w[2] ? w[1] : w[0];
      var o = midObj(b, x, r); if (free(o.x, o.x + o.w)) L.objs.push(o); x += o.w + 14 + r() * 50;
    }
    lm.forEach(function (l) { L.objs.push({ x: l[0], w: l[1], d: l[2] }); });
    L.objs.sort(function (a, b) { return a.x - b.x; });
  }
  MID.cont = function (c, x0, x1) {
    var step = 8, x;
    function wts(x) { var w = biomeAt(camOf(MID, x)); function q(n) { return (w[0] == n ? 1 - w[2] : 0) + (w[1] == n ? w[2] : 0); } return [q(5), q(6) + 0.6 * q(7)]; }
    var e0 = wts(x0), e1 = wts(x1), em = wts((x0 + x1) / 2);
    if (e0[0] + e0[1] + e1[0] + e1[1] + em[0] + em[1] < 0.01) return;
    c.beginPath(); c.moveTo(x0, 4);
    for (x = x0; x <= x1 + step; x += step) { var h = wts(x), a = h[0] * 50 + h[1] * 120; c.lineTo(x, -a * (0.45 + 0.6 * noise(x / 70, 5))); }
    c.lineTo(x1 + step, 4); c.closePath(); ink(c, 2); c.fillStyle = bget(camOf(MID, (x0 + x1) / 2), "deep"); c.fill(); c.stroke();
  };

  /* ROAD: verge, asphalt, kerbs, milestones, lamps, autos */
  function milestone(c, x, km) { ink(c, 2); c.beginPath(); c.moveTo(x, -2); c.lineTo(x, -22); c.arc(x + 11, -22, 11, Math.PI, 0); c.lineTo(x + 22, -2); c.closePath(); fs(c, "#F4F1EA"); c.beginPath(); c.moveTo(x, -22); c.arc(x + 11, -22, 11, Math.PI, 0); c.closePath(); fs(c, OCHRE); txt(c, String(km), x + 11, -13, "700 7px " + SANS, INK); txt(c, "KM", x + 11, -6, "700 5px " + SANS, INK); }
  function lamp(c, x, lit) { if (lit) { c.fillStyle = "rgba(247,211,106,.18)"; c.beginPath(); c.moveTo(x + 9, -98); c.lineTo(x - 22, 30); c.lineTo(x + 52, 30); c.lineTo(x + 21, -98); c.fill(); } ink(c, 2); rect(c, x - 2, -96, 4, 94, "#3A3A44"); c.beginPath(); c.moveTo(x, -94); c.quadraticCurveTo(x + 2, -104, x + 14, -102); c.stroke(); rrect(c, x + 8, -104, 14, 6, 2); fs(c, lit ? "#F7D36A" : "#D9D2C2"); }
  function auto(c, x) { ink(c, 2); c.beginPath(); c.moveTo(x, -10); c.lineTo(x, -34); c.quadraticCurveTo(x + 4, -48, x + 22, -48); c.lineTo(x + 40, -48); c.quadraticCurveTo(x + 52, -46, x + 54, -30); c.lineTo(x + 54, -10); c.closePath(); fs(c, "#3E7A4A"); c.beginPath(); c.moveTo(x + 1, -26); c.lineTo(x + 54, -26); c.lineTo(x + 54, -10); c.lineTo(x, -10); c.closePath(); fs(c, "#F2C230"); rect(c, x + 30, -42, 14, 14, "#CFE3E0"); circle(c, x + 10, -8, 7, "#2A2A30"); circle(c, x + 46, -8, 7, "#2A2A30"); circle(c, x + 10, -8, 2.5, "#B9B2A6"); circle(c, x + 46, -8, 2.5, "#B9B2A6"); }
  function rock(c, x, k) { ink(c, 1.8); c.beginPath(); c.moveTo(x, -2); c.quadraticCurveTo(x + 2, -12 - k * 6, x + 10, -13 - k * 6); c.quadraticCurveTo(x + 20, -12, x + 22, -2); c.closePath(); fs(c, "#B8AC98"); }
  function genRoad() {
    var L = ROAD, r = rng(7), x;
    for (x = 500; x < WORLD_END; x += 2200) (function (x) { L.objs.push({ x: x, w: 24, d: function (c, xx) { milestone(c, xx, Math.round(x * KM_PER_PX)); } }); })(x);
    for (x = 140; x < WORLD_END; x += 240 + r() * 280) (function (x, k) {
      if (Math.abs((x - 500) % 2200) < 40) return;
      for (var i = 0; i < N; i++) if (x > STOPX[i] + 40 && x < STOPX[i] + 210) return; // keep the signpost spot clear
      var w = biomeAt(x), b = w[2] > 0.5 ? w[1] : w[0];
      if (b >= 1 && b <= 4) L.objs.push({ x: x, w: 60, d: function (c, xx) { lamp(c, xx, B[b].night > 0.3); } });
      else if (b === 0 && k < 0.45) L.objs.push({ x: x, w: 60, d: function (c, xx) { auto(c, xx); } });
      else L.objs.push({ x: x, w: 24, d: function (c, xx) { rock(c, xx, k); } });
    })(x, r());
    L.objs.sort(function (a, b) { return a.x - b.x; });
  }
  var RH = 64;
  ROAD.cont = function (c, x0, x1) {
    var step = 32, x;
    for (x = Math.floor(x0 / step) * step; x < x1; x += step) {
      c.fillStyle = bget(x + step / 2, "ground"); c.fillRect(x, -30, step + 1, 30);
      c.fillStyle = bget(x + step / 2, "road"); c.fillRect(x, 0, step + 1, RH);
      c.fillStyle = bget(x + step / 2, "deep"); c.fillRect(x, RH, step + 1, ROAD.th);
    }
    ink(c, 2.4); c.beginPath(); c.moveTo(x0, -30); c.lineTo(x1, -30); c.moveTo(x0, 0); c.lineTo(x1, 0); c.moveTo(x0, RH); c.lineTo(x1, RH); c.stroke();
    for (x = Math.floor(x0 / 30) * 30; x < x1; x += 30) { c.fillStyle = Math.abs(x / 30) % 2 ? "#F4ECDD" : "rgba(29,26,31,.7)"; c.fillRect(x, 0, 30, 4); }
    for (x = Math.floor(x0 / 60) * 60; x < x1; x += 60) { c.fillStyle = bget(x, "line"); c.fillRect(x, RH / 2 - 2, 30, 4); }
    var r = rng(Math.floor(x0) + 5); c.strokeStyle = "rgba(29,26,31,.45)"; c.lineWidth = 1.4; c.beginPath();
    for (x = x0; x < x1; x += 14 + r() * 30) { var y = RH + 14 + r() * 36; c.moveTo(x, y); c.lineTo(x - 3, y - 7); c.moveTo(x + 3, y); c.lineTo(x + 3, y - 9); c.moveTo(x + 6, y); c.lineTo(x + 9, y - 6); }
    for (x = x0; x < x1; x += 20 + r() * 40) { var y2 = -24 + r() * 18; c.moveTo(x, y2); c.lineTo(x - 2, y2 - 5); c.moveTo(x + 3, y2); c.lineTo(x + 4, y2 - 6); }
    c.stroke();
  };
  /* FORE: bushes and rocks close to camera */
  function bigRock(c, x, col) { ink(c, 2.4); c.beginPath(); c.moveTo(x, 44); c.quadraticCurveTo(x + 6, 6, x + 26, 4); c.quadraticCurveTo(x + 54, 2, x + 60, 44); c.closePath(); fs(c, col); c.lineWidth = 1.4; c.beginPath(); c.moveTo(x + 22, 14); c.lineTo(x + 30, 22); c.stroke(); }
  function bush(c, x, col) { ink(c, 2.4); c.beginPath(); for (var k = 0; k < 5; k++) { var bx = x + 8 + k * 12, h = 22 + (k % 2) * 10; c.moveTo(bx - 6, 44); c.quadraticCurveTo(bx - 8, 44 - h, bx, 44 - h - 6); c.quadraticCurveTo(bx + 8, 44 - h, bx + 6, 44); } c.fillStyle = col; c.fill(); c.stroke(); }
  function genFore() {
    var L = FORE, r = rng(99), x = 0, end = WORLD_END * L.f + 900;
    while (x < end) {
      (function (x, k, cam) { var w = biomeAt(cam), b = w[2] > 0.5 ? w[1] : w[0], dark = b === 3 || b === 4 || b === 7;
        if ((b === 6 && k < 0.6) || k < 0.25) L.objs.push({ x: x, w: 60, d: function (c, xx) { bigRock(c, xx, dark ? "#4A4F60" : "#C9B89A"); } });
        else L.objs.push({ x: x, w: 70, d: function (c, xx) { bush(c, xx, dark ? "#2E4A44" : b === 8 ? "#B9A15E" : "#6E9A63"); } });
      })(x, r(), camOf(L, x));
      x += 140 + r() * 360;
    }
  }

  /* ---------- tiles ---------- */
  var MAX_TILES = 9;
  function renderTile(L, k) {
    var c = document.createElement("canvas"), sc = S * DPR;
    c.width = Math.ceil(TW * sc) + 1; c.height = Math.max(1, Math.ceil(L.th * sc));
    var g = c.getContext("2d"), x0 = k * TW, x1 = x0 + TW;
    g.setTransform(sc, 0, 0, sc, -x0 * sc, -L.top * sc);
    if (L.cont) L.cont.call(L, g, x0 - 2, x1 + 2);
    var objs = L.objs;
    for (var i = 0; i < objs.length; i++) { var o = objs[i]; if (o.x - 90 > x1) break; if (o.x + o.w + 90 < x0) continue; o.d(g, o.x); }
    L.cache.set(k, c);
    while (L.cache.size > MAX_TILES) L.cache.delete(L.cache.keys().next().value);
    return c;
  }
  function getTile(L, k) { var t = L.cache.get(k); if (t) { L.cache.delete(k); L.cache.set(k, t); return t; } return renderTile(L, k); }
  function visRange(L, cam) { var lc = cam * L.f, half = W / 2 / S; return [Math.floor((lc - half) / TW), Math.floor((lc + half) / TW), lc]; }
  function prewarm(cam, dir) {
    for (var j = 0; j < LAYERS.length; j++) {
      var L = LAYERS[j], v = visRange(L, cam), want = dir >= 0 ? [v[1] + 1, v[0] - 1] : [v[0] - 1, v[1] + 1];
      for (var i = 0; i < want.length; i++) if (!L.cache.has(want[i])) { renderTile(L, want[i]); return true; }
    }
    return false;
  }
  function drawLayer(L, cam) {
    var v = visRange(L, cam), y = Math.round((GY + L.top * S) * DPR);
    for (var k = v[0]; k <= v[1]; k++) ctx.drawImage(getTile(L, k), Math.round(((k * TW - v[2]) * S + W / 2) * DPR), y);
  }

  /* ---------- sky ---------- */
  var stars = null, cloud = null;
  function makeStars() { var c = document.createElement("canvas"); c.width = 512; c.height = 300; var g = c.getContext("2d"), r = rng(3); g.fillStyle = "#FBF6EC"; for (var i = 0; i < 90; i++) { var s = r() < 0.15 ? 2 : 1.2; g.fillRect(r() * 512, r() * 300, s, s); } return c; }
  function makeCloud() { var sc = DPR * S, c = document.createElement("canvas"); c.width = Math.ceil(130 * sc); c.height = Math.ceil(50 * sc); var g = c.getContext("2d"); g.setTransform(sc, 0, 0, sc, 0, 0); ink(g, 2); g.beginPath(); g.moveTo(10, 42); g.quadraticCurveTo(6, 26, 24, 26); g.quadraticCurveTo(28, 8, 50, 12); g.quadraticCurveTo(66, 0, 82, 14); g.quadraticCurveTo(104, 10, 106, 28); g.quadraticCurveTo(124, 30, 118, 42); g.closePath(); g.fillStyle = "#FBF6EC"; g.fill(); g.stroke(); return c; }
  var gradKey = "", grad = null;
  function drawSky(cam, t) {
    var top = bget(cam, "sky", 0), bot = bget(cam, "sky", 1), key = top + bot;
    if (key !== gradKey) { grad = ctx.createLinearGradient(0, 0, 0, GY * DPR); grad.addColorStop(0, top); grad.addColorStop(1, bot); gradKey = key; }
    ctx.fillStyle = grad; ctx.fillRect(0, 0, cv.width, Math.ceil((GY - 28 * S) * DPR));
    var night = bget(cam, "night");
    if (night > 0.05) { ctx.globalAlpha = night; var off = (cam * 0.02) % 512; for (var sx = -off; sx < W; sx += 512) ctx.drawImage(stars, Math.round(sx * DPR), 0, 512 * DPR, 300 * DPR); ctx.globalAlpha = 1; }
    var w = biomeAt(cam), k = w[2], cx = W * (portrait ? 0.76 : 0.74), cy = GY * (portrait ? 0.3 : 0.32), R = 28 * S;
    function orb(bi, alpha) {
      if (alpha <= 0.01) return; var rr = (bi.big ? 1.8 : 1) * R, oy = bi.big ? GY * 0.66 : cy;
      ctx.globalAlpha = alpha; ctx.lineWidth = 2 * DPR; ctx.strokeStyle = INK; ctx.beginPath(); ctx.arc(cx * DPR, oy * DPR, rr * DPR, 0, 7); ctx.fillStyle = bi.moon ? "#F4ECDD" : bi.sun; ctx.fill(); ctx.stroke();
      if (bi.moon) { ctx.beginPath(); ctx.arc((cx + rr * 0.45) * DPR, (oy - rr * 0.25) * DPR, rr * 0.82 * DPR, 0, 7); ctx.fillStyle = top; ctx.fill(); }
      ctx.globalAlpha = 1;
    }
    orb(B[w[0]], 1 - k); orb(B[w[1]], k);
    var drift = reduce ? 0 : t * 0.006, cw = cloud.width / DPR, span = W + cw * 2;
    ctx.globalAlpha = 1 - night * 0.75;
    for (var i = 0; i < 4; i++) { var x = (((i * 397 - cam * 0.05 - drift) % span) + span) % span - cw, y = (portrait ? 0.2 : 0.14) * H + (i % 2) * 44 * S + i * 10; ctx.drawImage(cloud, Math.round(x * DPR), Math.round(y * DPR)); }
    ctx.globalAlpha = 1;
  }

  /* ---------- signposts ---------- */
  var signCache = {}, popAt = {};
  function signSprite(i) {
    if (signCache[i]) return signCache[i];
    var sc = S * DPR, c = document.createElement("canvas"); c.width = Math.ceil(120 * sc); c.height = Math.ceil(112 * sc);
    var g = c.getContext("2d"); g.setTransform(sc, 0, 0, sc, 0, 0);
    ink(g, 2.2); rect(g, 56, 50, 8, 60, "#8A5A3A");
    rrect(g, 6, 6, 108, 50, 6); fs(g, PAPER); g.lineWidth = 2; g.strokeStyle = MAROON; rrect(g, 11, 11, 98, 40, 4); g.stroke();
    txt(g, STOPS[i].end ? "NEXT STOP" : "STOP 0" + (i + 1), 60, 21, "700 9px " + SANS, MAROON);
    txt(g, STOPS[i].short.toUpperCase(), 60, 38, "700 15px " + SERIF, INK);
    signCache[i] = c; return c;
  }
  function backOut(t) { var c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); }
  function drawSigns(cam, now) {
    for (var i = 0; i < N; i++) {
      if (popAt[i] === undefined) continue;
      var sx = (STOPX[i] + 80 - cam) * S + W / 2; if (sx < -130 * S || sx > W + 10) continue;
      var p = reduce ? 1 : clamp((now - popAt[i]) / 560, 0, 1), sy = backOut(p);
      var spr = signSprite(i), h = spr.height * sy; if (h < 1) continue;
      var baseY = (GY - 8 * S) * DPR;
      ctx.drawImage(spr, 0, 0, spr.width, spr.height, Math.round(sx * DPR), Math.round(baseY - h), spr.width, h);
    }
  }

  /* ---------- rider sprite ---------- */
  var SKIN = "#C98C64", DENIM = "#4F6E99", DENIM_D = "#3D5880", PANTS = "#2E3140", HAIR = "#1D1A1F";
  function head(c, x, y, helmet) {
    ink(c, 2);
    c.beginPath(); c.moveTo(x - 3, y + 6); c.lineTo(x - 2, y + 12); c.lineTo(x + 4, y + 12); c.lineTo(x + 4, y + 6); c.closePath(); fs(c, SKIN);
    c.beginPath(); c.arc(x, y, 9, 0, 7); fs(c, SKIN);
    c.beginPath(); c.moveTo(x + 8.4, y + 1); c.lineTo(x + 11, y + 4); c.lineTo(x + 8.2, y + 5); fs(c, SKIN);
    c.beginPath(); c.moveTo(x - 6, y + 2); c.quadraticCurveTo(x - 3, y + 11, x + 4, y + 10); c.quadraticCurveTo(x + 9, y + 9, x + 9, y + 5.6); c.lineTo(x + 5, y + 5.2); c.quadraticCurveTo(x, y + 6.5, x - 3, y + 1); c.closePath(); c.fillStyle = HAIR; c.fill();
    c.fillStyle = INK; c.beginPath(); c.arc(x + 4.5, y - 1.4, 1.2, 0, 7); c.fill();
    if (helmet) {
      c.beginPath(); c.arc(x - 0.5, y - 1, 11.2, Math.PI * 0.9, Math.PI * 2.02); c.lineTo(x + 9.6, y - 3); c.lineTo(x - 1, y - 2.5); c.lineTo(x - 10, y + 4); c.closePath(); fs(c, MAROON);
      c.fillStyle = CREAM; c.fillRect(x - 7, y - 9.5, 10, 2.2); c.beginPath(); c.moveTo(x + 6, y - 8.6); c.lineTo(x + 13, y - 4.5); c.lineWidth = 2.4; c.stroke();
    } else {
      c.beginPath(); c.moveTo(x - 9, y + 2); c.quadraticCurveTo(x - 11, y - 10, x, y - 11.5); c.quadraticCurveTo(x + 9.5, y - 11, x + 9.8, y - 3); c.quadraticCurveTo(x + 4, y - 7.5, x - 2, y - 5); c.quadraticCurveTo(x - 4, y, x - 6, y + 2); c.closePath(); fs(c, HAIR);
      c.beginPath(); c.arc(x - 3, y + 1, 2.4, 0, 7); fs(c, SKIN);
    }
  }
  function limb(c, ax, ay, bx, by, cx2, cy2, w, col) { c.beginPath(); c.moveTo(ax, ay); c.lineTo(bx, by); c.lineTo(cx2, cy2); c.lineCap = "round"; c.lineJoin = "round"; c.lineWidth = w + 4; c.strokeStyle = INK; c.stroke(); c.lineWidth = w; c.strokeStyle = col; c.stroke(); }
  function ik(hx, hy, fx, fy, l1, l2, fwd) { var dx = fx - hx, dy = fy - hy, d = Math.max(0.01, Math.min(Math.hypot(dx, dy), l1 + l2 - 0.01)), base = Math.atan2(dy, dx), a = Math.acos(clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1)), ang = base + (fwd ? -a : a); return [hx + Math.cos(ang) * l1, hy + Math.sin(ang) * l1]; }
  function torso(c, hx, hy, sx, sy) {
    ink(c, 2); var nx = sy - hy, ny = hx - sx, l = Math.hypot(nx, ny); nx /= l; ny /= l;
    c.beginPath(); c.moveTo(hx - nx * 9, hy - ny * 9); c.lineTo(sx - nx * 8, sy - ny * 8); c.quadraticCurveTo(sx - ny * 4, sy + nx * 4, sx + nx * 8, sy + ny * 8); c.lineTo(hx + nx * 9.5, hy + ny * 9.5); c.closePath(); fs(c, DENIM);
    c.beginPath(); c.moveTo(lerp(sx, hx, 0.08) + nx * 4, lerp(sy, hy, 0.08) + ny * 4); c.lineTo(hx + nx * 5, hy + ny * 5); c.lineWidth = 3.4; c.strokeStyle = "#F4F1EA"; c.stroke();
    ink(c, 1.2); c.beginPath(); c.moveTo(lerp(hx, sx, .16) - nx * 9, lerp(hy, sy, .16) - ny * 9); c.lineTo(lerp(hx, sx, .16) + nx * 9.4, lerp(hy, sy, .16) + ny * 9.4); c.moveTo(lerp(hx, sx, .62) - nx * 6, lerp(hy, sy, .62) - ny * 6); c.lineTo(lerp(hx, sx, .62) - nx * 1, lerp(hy, sy, .62) - ny * 1); c.stroke();
  }
  function shoe(c, x, y) { ink(c, 1.6); c.beginPath(); c.moveTo(x - 4, y - 3); c.lineTo(x + 7, y - 3); c.quadraticCurveTo(x + 10, y + 1, x + 8, y + 1.5); c.lineTo(x - 4, y + 1.5); c.closePath(); fs(c, "#7A4A30"); }
  function wheel(c, x, y, r, ang, motoW) {
    ink(c, 2); c.beginPath(); c.arc(x, y, r, 0, 7); c.fillStyle = "#26252C"; c.fill(); c.stroke();
    var ri = r - (motoW ? 5 : 3); c.beginPath(); c.arc(x, y, ri, 0, 7); c.fillStyle = motoW ? "#4A4A52" : "#E9E2CF"; c.fill(); c.lineWidth = 1.2; c.stroke();
    c.strokeStyle = motoW ? "#C9C2B2" : "#55535F"; c.lineWidth = motoW ? 2.2 : 1; c.beginPath();
    var n = motoW ? 6 : 8; for (var k = 0; k < n; k++) { var a = ang + k * Math.PI * 2 / n; c.moveTo(x + Math.cos(a) * 3, y + Math.sin(a) * 3); c.lineTo(x + Math.cos(a) * (ri - 1), y + Math.sin(a) * (ri - 1)); } c.stroke();
    ink(c, 1.4); c.beginPath(); c.arc(x, y, 3, 0, 7); c.fillStyle = OCHRE; c.fill(); c.stroke();
  }
  function walker(c, phase, amt, wave) {
    var bob = -Math.abs(Math.sin(phase)) * 2.2 * amt, hx = 0, hy = -46 + bob, sw = Math.sin(phase) * 0.5 * amt;
    function leg(s, col) { var a = sw * s, kx = hx + Math.sin(a) * 22, ky = hy + Math.cos(a) * 22, bend = Math.max(0, -Math.cos(phase) * s) * 0.6 * amt, fx = kx + Math.sin(a - bend) * 22, fy = Math.min(-2, ky + Math.cos(a - bend) * 22); limb(c, hx, hy, kx, ky, fx, fy, 6.5, col); shoe(c, fx, fy + 0.5); }
    function arm(s, col, up) { var a = -sw * s, ex, ey, px, py; if (up !== undefined && up !== null) { ex = 13; ey = hy - 40; px = 18 + Math.sin(up) * 6; py = hy - 54; } else { ex = 3 + Math.sin(a) * 13; ey = hy - 30 + Math.cos(a) * 13; px = ex + Math.sin(a + 0.5 * amt + 0.1) * 12; py = ey + Math.cos(a + 0.5 * amt + 0.1) * 12; } limb(c, 3, hy - 30, ex, ey, px, py, 5.5, col); ink(c, 1.6); circle(c, px, py, 2.8, SKIN); }
    arm(-1, DENIM_D, null); leg(-1, "#262836"); leg(1, PANTS); torso(c, hx, hy, 3, hy - 32); head(c, 6, hy - 44, false); arm(1, DENIM, wave);
  }
  function bicycle(c, dist, amt) {
    var r = 17, ang = dist / r, crank = dist / 10, bw = [-25, -r], fw = [27, -r], bb = [2, -18];
    c.beginPath(); c.moveTo(bw[0], bw[1]); c.lineTo(bb[0], bb[1]); c.lineTo(-6, -46); c.lineTo(bw[0], bw[1]); c.moveTo(bb[0], bb[1]); c.lineTo(20, -48); c.lineTo(-6, -46); c.moveTo(20, -48); c.lineTo(fw[0], fw[1]); c.moveTo(20, -48); c.lineTo(17, -58); c.lineTo(25, -60);
    c.lineCap = "round"; c.lineJoin = "round"; c.lineWidth = 6; c.strokeStyle = INK; c.stroke(); c.lineWidth = 3; c.strokeStyle = TEAL; c.stroke();
    wheel(c, bw[0], bw[1], r, ang, false); wheel(c, fw[0], fw[1], r, ang, false);
    var hip = [-7, -53], sh = [8, -80], hand = [23, -60];
    function pedal(s) { var a = crank + (s > 0 ? 0 : Math.PI); return [bb[0] + Math.cos(a) * 7, bb[1] + Math.sin(a) * 7]; }
    var p2 = pedal(-1), k2 = ik(hip[0], hip[1], p2[0], p2[1], 23, 23, false); limb(c, hip[0], hip[1], k2[0], k2[1], p2[0], p2[1], 6.5, "#262836"); shoe(c, p2[0], p2[1]);
    ink(c, 2); rrect(c, -15, -57, 15, 5, 2); fs(c, INK);
    torso(c, hip[0], hip[1], sh[0], sh[1]); head(c, 14, -92, false);
    var p1 = pedal(1), k1 = ik(hip[0], hip[1], p1[0], p1[1], 23, 23, false); limb(c, hip[0], hip[1], k1[0], k1[1], p1[0], p1[1], 6.5, PANTS); shoe(c, p1[0], p1[1]);
    var el = ik(sh[0], sh[1], hand[0], hand[1], 14, 14, true); limb(c, sh[0], sh[1], el[0], el[1], hand[0], hand[1], 5.5, DENIM); ink(c, 1.6); circle(c, hand[0], hand[1], 2.8, SKIN);
  }
  function moto(c, dist, amt, t, parked) {
    var rb = 19, rf = 20, ang = dist / rb, bob = parked ? 0 : Math.sin(t * 0.024) * 0.9 * amt, bw = [-34, -rb], fw = [36, -rf];
    c.beginPath(); c.moveTo(bw[0], bw[1]); c.lineTo(-4, -30); c.lineCap = "round"; c.lineWidth = 6; c.strokeStyle = INK; c.stroke(); c.lineWidth = 3; c.strokeStyle = "#3E3D46"; c.stroke();
    wheel(c, bw[0], bw[1], rb, ang, true); wheel(c, fw[0], fw[1], rf, ang * rb / rf, true);
    ink(c, 2); c.beginPath(); c.arc(fw[0], fw[1], rf + 4, Math.PI * 1.08, Math.PI * 1.62); c.lineWidth = 4; c.stroke();
    c.save(); c.translate(0, bob * 0.4);
    c.beginPath(); c.moveTo(-6, -18); c.lineTo(-30, -22); c.lineTo(-48, -31); c.lineWidth = 7; c.strokeStyle = INK; c.stroke(); c.lineWidth = 4; c.strokeStyle = "#B9B2A6"; c.stroke();
    c.beginPath(); c.moveTo(fw[0], fw[1]); c.lineTo(24, -62); c.lineWidth = 7; c.strokeStyle = INK; c.stroke(); c.lineWidth = 3.4; c.strokeStyle = "#C9A24A"; c.stroke();
    ink(c, 2); rrect(c, -14, -37, 27, 23, 4); fs(c, "#3E3D46"); c.lineWidth = 1.2; c.beginPath(); for (var k = 0; k < 4; k++) { c.moveTo(-11, -33 + k * 5); c.lineTo(10, -33 + k * 5); } c.stroke();
    ink(c, 2); c.beginPath(); c.moveTo(-34, -46); c.lineTo(-6, -44); c.lineTo(10, -36); c.lineTo(-20, -30); c.closePath(); fs(c, CREAM);
    c.beginPath(); c.moveTo(-6, -48); c.quadraticCurveTo(0, -61, 16, -59); c.quadraticCurveTo(27, -56, 22, -44); c.lineTo(-4, -42); c.closePath(); fs(c, MAROON);
    c.beginPath(); c.moveTo(0, -51); c.quadraticCurveTo(8, -57, 16, -55); c.strokeStyle = "rgba(244,236,221,.75)"; c.lineWidth = 2; c.stroke();
    ink(c, 2); c.beginPath(); c.moveTo(-42, -48); c.quadraticCurveTo(-24, -55, -4, -50); c.lineTo(-6, -45); c.lineTo(-40, -44); c.closePath(); fs(c, "#2A2830");
    rect(c, -52, -50, 12, 4, INK); c.fillStyle = "#E8833A"; c.fillRect(-54, -50, 3, 4);
    ink(c, 2); c.beginPath(); c.moveTo(24, -66); c.lineTo(30, -86); c.lineTo(35, -84); c.lineTo(30, -64); c.closePath(); c.fillStyle = "rgba(207,227,224,.9)"; c.fill(); c.stroke();
    circle(c, 31, -62, 6.5, "#2A2830"); circle(c, 32, -62, 4.2, "#F7E7A8");
    c.beginPath(); c.moveTo(21, -68); c.lineTo(13, -73); c.lineWidth = 3.5; c.strokeStyle = INK; c.stroke();
    c.restore();
    if (parked) { ink(c, 2.4); c.beginPath(); c.moveTo(-8, -18); c.lineTo(-16, -1); c.stroke(); return; }
    c.save(); c.translate(0, bob);
    var hip = [-17, -56], sh = [-3, -84], hand = [14, -72], foot = [-2, -26];
    var kn = ik(hip[0], hip[1], foot[0], foot[1], 21, 22, false); limb(c, hip[0], hip[1], kn[0], kn[1], foot[0], foot[1], 7, PANTS); shoe(c, foot[0] + 1, foot[1]);
    torso(c, hip[0], hip[1], sh[0], sh[1]); head(c, 3, -96, true);
    var el = ik(sh[0], sh[1], hand[0], hand[1], 13, 13, true); limb(c, sh[0], sh[1], el[0], el[1], hand[0], hand[1], 5.5, DENIM); ink(c, 1.6); circle(c, hand[0], hand[1], 3, "#2A2830");
    c.restore();
  }
  function puff(c, x, y, p) { c.globalAlpha = 1 - p; ink(c, 1.6); for (var k = 0; k < 3; k++) { c.beginPath(); c.arc(x - k * 10 - p * 20, y - k * 3 - p * 8, 5 + p * 8, 0, 7); c.fillStyle = PAPER; c.fill(); c.stroke(); } c.globalAlpha = 1; }

  function modeAt(x) { if (x < STOPX[2] - 420) return "walk"; if (x < STOPX[3] - 420) return "cycle"; return "moto"; }
  var dist = 0, facing = 1, lastMode = null, swapAt = -1e9;
  function drawRider(cam, speed, now) {
    var mode = modeAt(cam), amt = clamp(Math.abs(speed) / 160, 0, 1);
    if (mode !== lastMode) { if (lastMode) swapAt = now; lastMode = mode; }
    if (speed > 6) facing = 1; else if (speed < -6) facing = -1;
    var rx = W / 2, ry = GY + 40 * S;
    ctx.setTransform(S * DPR * facing, 0, 0, S * DPR, rx * DPR, ry * DPR);
    ctx.fillStyle = "rgba(29,26,31,.22)"; ctx.beginPath(); ctx.ellipse(0, 0, mode === "walk" ? 16 : 46, 4, 0, 0, 7); ctx.fill();
    var atEnd = cam > STOPX[N - 1] - 20 && amt < 0.12;
    if (atEnd) { ctx.save(); ctx.translate(-14, 0); moto(ctx, dist, 0, now, true); ctx.restore(); ctx.translate(48, 0); walker(ctx, 0, 0, reduce ? 0.6 : Math.sin(now * 0.008) * 0.9); }
    else if (mode === "walk") walker(ctx, dist / 9, amt, null);
    else if (mode === "cycle") bicycle(ctx, dist, amt);
    else moto(ctx, dist, reduce ? 0 : amt, now, false);
    var sp = (now - swapAt) / 650; if (sp < 1 && !reduce) puff(ctx, -24, -12, sp);
    if (mode === "moto" && amt > 0.55 && !reduce && !atEnd) { ctx.strokeStyle = "rgba(29,26,31,.3)"; ctx.lineWidth = 2; ctx.beginPath(); for (var k = 0; k < 3; k++) { var yy = -34 - k * 16, xx = -66 - ((now * 0.35 + k * 23) % 36); ctx.moveTo(xx, yy); ctx.lineTo(xx - 24 * amt, yy); } ctx.stroke(); }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  /* ---------- scroll ↔ world: travel, then dwell at each stop ---------- */
  var keys = [], track = document.getElementById("track"), vh = 0, lastW = 0;
  function layoutTrack(force) {
    var h = window.innerHeight, w = window.innerWidth;
    if (!force && w === lastW && Math.abs(h - vh) < 160) return false;
    var oldMax = keys.length ? keys[keys.length - 1].s : 0, ratio = oldMax ? scrollNow() / oldMax : 0;
    vh = h; lastW = w;
    var s = 0, dwell = 0.8 * vh, travel = 1.3 * vh;
    keys = [{ s: 0, x: 0, dwell: false }]; s += 0.9 * vh;
    for (var i = 0; i < N; i++) {
      keys.push({ s: s, x: STOPX[i], dwell: false, stop: i }); s += dwell;
      keys.push({ s: s, x: STOPX[i], dwell: true, stop: i }); if (i < N - 1) s += travel;
    }
    track.style.height = Math.round(s + vh) + "px";
    if (oldMax) setScroll(ratio * s);
    return true;
  }
  function worldAt(s) {
    if (s <= 0) return 0;
    for (var i = 1; i < keys.length; i++) { var a = keys[i - 1], b = keys[i]; if (s <= b.s) { if (b.dwell) return b.x; return lerp(a.x, b.x, smooth((s - a.s) / (b.s - a.s))); } }
    return keys[keys.length - 1].x;
  }
  function stopScroll(i) { if (i < 0) return 0; var a = keys[1 + i * 2], b = keys[2 + i * 2]; return Math.round(a.s + (b.s - a.s) * 0.3); }

  /* ---------- DOM: badges, cards ---------- */
  var ICONS = {
    li: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM3 9.5h4V21H3zM9.5 9.5h3.8v1.6h.06c.53-1 1.83-2.06 3.77-2.06 4.03 0 4.77 2.65 4.77 6.1V21h-4v-5.1c0-1.22-.02-2.78-1.7-2.78-1.7 0-1.96 1.33-1.96 2.7V21h-4z"/></svg>',
    yt: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M23 7.2a3 3 0 0 0-2.1-2.1C19 4.6 12 4.6 12 4.6s-7 0-8.9.5A3 3 0 0 0 1 7.2 31 31 0 0 0 .5 12 31 31 0 0 0 1 16.8a3 3 0 0 0 2.1 2.1c1.9.5 8.9.5 8.9.5s7 0 8.9-.5a3 3 0 0 0 2.1-2.1c.4-1.6.5-3.2.5-4.8s-.1-3.2-.5-4.8zM9.8 15.1V8.9l5.4 3.1z"/></svg>',
    ig: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="17.5" cy="6.5" r="1.3" fill="currentColor"/></svg>',
    web: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M3 12h18M12 3c3 3.2 3 14.8 0 18M12 3c-3 3.2-3 14.8 0 18" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
    em: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M3.5 6.5 12 13l8.5-6.5" fill="none" stroke="currentColor" stroke-width="2"/></svg>'
  };
  function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function linksHTML(st) { return '<div class="links">' + st.links.map(function (l) { var ext = l.href.indexOf("mailto:") !== 0; return '<a class="chip' + (l.primary ? " primary" : "") + '" href="' + esc(l.href) + '"' + (ext ? ' target="_blank" rel="noopener"' : "") + ">" + (ICONS[l.icon] || "") + "<span>" + esc(l.label) + "</span></a>"; }).join("") + "</div>"; }
  function cardHTML(st, i) {
    var eyebrow = (st.end ? "The end of the road, for now" : "Stop 0" + (i + 1) + " · " + st.place + " · " + st.years);
    return '<div class="panel">' + (st.end ? "" : '<img alt="' + esc(st.alt) + '" width="1280" height="858" decoding="async" data-src="img/s' + (i + 1) + '-560.webp" data-srcset="img/s' + (i + 1) + "-560.webp 560w, img/s" + (i + 1) + '-960.webp 960w" sizes="(max-width:700px) 100vw, 340px"><span class="num">' + (i + 1) + "/8</span>") + "</div>" +
      '<div class="body"><p class="eyebrow">' + esc(eyebrow) + "</p><h2>" + esc(st.title) + '</h2><div class="story">' + st.story.map(function (p) { return "<p>" + esc(p) + "</p>"; }).join("") + "</div>" +
      (st.big ? '<div class="stat"><b>' + esc(st.big) + "</b><span>" + esc(st.bigLabel) + "</span></div>" : "") + linksHTML(st) + "</div>";
  }
  var cardsEl = document.getElementById("cards"), cards = [], badgeBtns = [];
  STOPS.forEach(function (st, i) {
    var a = document.createElement("article"); a.className = "card" + (st.end ? " end" : ""); a.setAttribute("aria-label", st.title); a.innerHTML = cardHTML(st, i); cardsEl.appendChild(a); cards.push(a);
    if (!st.end) { var li = document.createElement("li"), b = document.createElement("button"); b.textContent = i + 1; b.title = st.short; b.setAttribute("aria-label", "Ride to stop " + (i + 1) + ", " + st.short); b.addEventListener("click", function () { started(); goTo(i); }); li.appendChild(b); document.getElementById("badges").appendChild(li); badgeBtns.push(b); }
  });
  function loadImg(i) { if (i < 0 || i >= N) return; var img = cards[i].querySelector("img[data-src]"); if (img) { img.srcset = img.getAttribute("data-srcset"); img.src = img.getAttribute("data-src"); img.removeAttribute("data-src"); } }

  /* ---------- sound (muted by default) ---------- */
  var soundOn = false, actx = null, soundBtn = document.getElementById("sound");
  soundBtn.addEventListener("click", function () { soundOn = !soundOn; soundBtn.setAttribute("aria-pressed", String(soundOn)); soundBtn.setAttribute("aria-label", soundOn ? "Sound on. Turn sound off" : "Sound off. Turn sound on"); if (soundOn) { try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); actx.resume(); chime(); } catch (e) { soundOn = false; } } });
  function tone(f, t0, d, v) { var o = actx.createOscillator(), g = actx.createGain(); o.type = "sine"; o.frequency.value = f; g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(v, t0 + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t0 + d); o.connect(g); g.connect(actx.destination); o.start(t0); o.stop(t0 + d + 0.05); }
  function chime() { if (!soundOn || !actx) return; var t = actx.currentTime; tone(659.25, t, 0.5, 0.12); tone(987.77, t + 0.11, 0.7, 0.09); }

  /* ---------- input ---------- */
  var drive = 0, keyDown = {}, keyT = {};
  function scrollNow() { return window.pageYOffset || document.documentElement.scrollTop || 0; }
  function setScroll(y) { window.scrollTo(0, Math.max(0, y)); }
  var anim = null; // our own eased scroll so jumps feel weighted (and work everywhere)
  function goTo(i) {
    i = clamp(i, -1, N - 1); var to = stopScroll(i), from = scrollNow(); loadImg(i);
    if (reduce || Math.abs(to - from) < 2) { setScroll(to); return; }
    var dur = clamp(Math.abs(to - from) / vh * 420, 500, 1800);
    anim = { from: from, to: to, t0: performance.now(), dur: dur };
  }
  function easeIO(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function next() { var x = anim ? worldAt(anim.to) : worldAt(scrollNow()), i; for (i = 0; i < N; i++) if (STOPX[i] > x + 40) break; goTo(Math.min(i, N - 1)); }
  function prev() { var x = anim ? worldAt(anim.to) : worldAt(scrollNow()), i; for (i = N - 1; i >= 0; i--) if (STOPX[i] < x - 40) break; goTo(i); }
  ["wheel", "touchstart"].forEach(function (ev) { window.addEventListener(ev, function () { anim = null; started(); }, { passive: true }); });
  var FWD = { ArrowRight: 1, d: 1, D: 1, ArrowDown: 1 }, BACK = { ArrowLeft: -1, a: -1, A: -1, ArrowUp: -1 };
  window.addEventListener("keydown", function (e) {
    if (listOpen || e.metaKey || e.ctrlKey || e.altKey) return;
    var d = FWD[e.key] || BACK[e.key];
    if (!d) { var m = { " ": next, PageDown: next, PageUp: prev, End: function () { goTo(N - 1); }, Home: function () { goTo(-1); } }[e.key]; if (m && !(e.key === " " && e.target.closest && e.target.closest("a,button"))) { e.preventDefault(); started(); m(); } return; }
    e.preventDefault(); anim = null; if (!keyDown[e.key]) { keyDown[e.key] = true; keyT[e.key] = performance.now(); } drive = d; started();
  });
  window.addEventListener("keyup", function (e) { var d = FWD[e.key] || BACK[e.key]; if (!d || !keyDown[e.key]) return; keyDown[e.key] = false; drive = 0; if (performance.now() - keyT[e.key] < 200) (d > 0 ? next : prev)(); });
  window.addEventListener("blur", function () { drive = 0; keyDown = {}; });
  function holdBtn(el, d) {
    var t0 = 0, id = null;
    el.addEventListener("pointerdown", function (e) { if (e.button > 0) return; e.preventDefault(); anim = null; t0 = performance.now(); id = e.pointerId; try { el.setPointerCapture(id); } catch (x) { } el.classList.add("held"); drive = d; started(); });
    function up() { if (id === null) return; id = null; el.classList.remove("held"); drive = 0; if (performance.now() - t0 < 230) (d > 0 ? next : prev)(); }
    el.addEventListener("pointerup", up); el.addEventListener("pointercancel", up);
    el.addEventListener("click", function (e) { if (e.detail === 0) { started(); (d > 0 ? next : prev)(); } });
    el.addEventListener("contextmenu", function (e) { e.preventDefault(); });
  }
  holdBtn(document.getElementById("fwd"), 1); holdBtn(document.getElementById("back"), -1);
  var game = document.getElementById("game"), dragX = null, dragY = null, dragging = false;
  game.addEventListener("pointerdown", function (e) { if (e.target.closest("a,button,.card,.intro")) return; dragX = e.clientX; dragY = e.clientY; dragging = false; });
  game.addEventListener("pointermove", function (e) { if (dragX === null) return; var dx = e.clientX - dragX, dy = e.clientY - dragY; if (!dragging && Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy) * 1.2) dragging = true; if (dragging) { anim = null; setScroll(scrollNow() - dx * 2.4); dragX = e.clientX; dragY = e.clientY; started(); } });
  ["pointerup", "pointercancel", "pointerleave"].forEach(function (ev) { game.addEventListener(ev, function () { dragX = null; dragging = false; }); });
  document.getElementById("start").addEventListener("click", function () { started(); next(); });
  document.querySelector(".mono").addEventListener("click", function (e) { e.preventDefault(); goTo(-1); });

  /* ---------- list view ---------- */
  var listEl = document.getElementById("list"), listOpen = false, lastFocus = null;
  function openList(e) { if (e) e.preventDefault(); listOpen = true; drive = 0; anim = null; lastFocus = document.activeElement; listEl.classList.add("open"); listEl.querySelectorAll("img[data-src]").forEach(function (im) { im.src = im.getAttribute("data-src"); im.removeAttribute("data-src"); }); requestAnimationFrame(function () { listEl.classList.add("show"); listEl.focus(); }); document.documentElement.style.overflow = "hidden"; }
  function closeList() { listOpen = false; listEl.classList.remove("show", "open"); document.documentElement.style.overflow = ""; if (lastFocus && lastFocus.focus) lastFocus.focus(); }
  document.querySelectorAll("[data-open-list]").forEach(function (b) { b.addEventListener("click", openList); });
  document.querySelectorAll("[data-close-list]").forEach(function (b) { b.addEventListener("click", closeList); });
  listEl.addEventListener("keydown", function (e) { if (e.key === "Escape") closeList(); });
  if (location.hash === "#list") openList();

  /* ---------- HUD state ---------- */
  var odoEl = document.getElementById("odo"), barEl = document.getElementById("bar"), introEl = document.getElementById("intro"), hintEl = document.getElementById("hint"), liveEl = document.getElementById("live");
  var shownOdo = -1, shownCard = -1, reached = -1, hasStarted = false, hereIdx = -2;
  function started() { if (hasStarted) return; hasStarted = true; introEl.classList.add("gone"); }
  function updateHud(cam, now) {
    var km = Math.round(cam * KM_PER_PX); if (km !== shownOdo) { shownOdo = km; odoEl.textContent = ("000" + km).slice(-4); }
    barEl.style.transform = "scaleX(" + (cam / STOPX[N - 1]).toFixed(4) + ")";
    var near = -1; for (var i = 0; i < N; i++) if (Math.abs(cam - STOPX[i]) < 70) near = i;
    for (i = 0; i < N; i++) if (cam >= STOPX[i] - 70 && popAt[i] === undefined) { popAt[i] = now; if (i > reached) reached = i; }
    var here = near; if (here !== hereIdx) { badgeBtns.forEach(function (b, j) { b.classList.toggle("on", j <= reached); b.classList.toggle("here", j === here); if (j === here) b.setAttribute("aria-current", "step"); else b.removeAttribute("aria-current"); }); hereIdx = here; }
    if (near !== shownCard) {
      if (shownCard >= 0) cards[shownCard].classList.remove("on");
      if (near >= 0) { loadImg(near); loadImg(near + 1); cards[near].classList.add("on"); chime(); liveEl.textContent = STOPS[near].title; }
      shownCard = near;
    }
    var s = scrollNow(); if (s > 30) started();
    hintEl.classList.toggle("gone", cam > STOPX[0] - 100);
  }

  /* ---------- main loop ---------- */
  var cam = 0, camV = 0, last = 0, frameTimes = [], workTimes = [], slow = 0, ema = 16.7;
  window.__odyssey = { frames: frameTimes, work: workTimes, stops: STOPX, scrollFor: function (i) { return stopScroll(i); }, state: function () { return { cam: cam, dpr: DPR, S: S, shownCard: shownCard }; } };
  function frame(now) {
    requestAnimationFrame(frame);
    var dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016; if (last) { frameTimes.push(now - last); if (frameTimes.length > 4000) frameTimes.shift(); } last = now;
    if (anim) { var p = clamp((now - anim.t0) / anim.dur, 0, 1); setScroll(anim.from + (anim.to - anim.from) * easeIO(p)); if (p >= 1) anim = null; }
    else if (drive && !listOpen) setScroll(scrollNow() + drive * vh * 1.1 * dt);
    var target = worldAt(scrollNow()), prevCam = cam;
    cam = reduce ? target : cam + (target - cam) * (1 - Math.exp(-dt * 10));
    if (Math.abs(target - cam) < 0.05) cam = target;
    var v = dt > 0 ? (cam - prevCam) / dt : 0; camV += (v - camV) * Math.min(1, dt * 12);
    dist += Math.abs(cam - prevCam);
    var t0 = performance.now();
    drawSky(cam, now);
    drawLayer(FAR, cam); drawLayer(MID, cam); drawLayer(ROAD, cam);
    drawSigns(cam, now);
    drawRider(cam, camV, now);
    drawLayer(FORE, cam);
    updateHud(cam, now);
    var work = performance.now() - t0; workTimes.push(work); if (workTimes.length > 4000) workTimes.shift();
    if (work < 6) prewarm(cam, camV >= 0 ? 1 : -1);
    // quality governor: if frames are consistently heavy, render at a lower pixel ratio
    // judged on the real frame interval (includes raster + compositing), only while the page is in use
    var iv = frameTimes.length ? frameTimes[frameTimes.length - 1] : 16.7;
    if (iv < 250 && !document.hidden) { ema += (iv - ema) * 0.1; if (ema > 21) slow++; else slow = Math.max(0, slow - 2); }
    if (slow > 45 && dprCap > 1) { dprCap = dprCap > 1.6 ? 1.5 : dprCap > 1.3 ? 1.25 : 1; slow = 0; ema = 16.7; measure(); }
  }
  function measure() {
    W = window.innerWidth; H = window.innerHeight; portrait = H > W * 1.1;
    DPR = Math.min(window.devicePixelRatio || 1, dprCap);
    S = clamp(Math.min(H / 650, W / 420), 0.72, 1.5);
    GY = Math.round(H * (portrait ? 0.79 : 0.75));
    cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
    ROAD.th = (H - GY) / S - ROAD.top + 4; FORE.th = Math.max(10, (H - GY) / S - FORE.top + 4);
    LAYERS.forEach(function (L) { L.cache.clear(); });
    signCache = {}; cloud = makeCloud(); gradKey = "";
  }
  var rT = 0;
  window.addEventListener("resize", function () { clearTimeout(rT); rT = setTimeout(function () { var w = window.innerWidth, h = window.innerHeight; if (w !== W || Math.abs(h - H) > 2) { layoutTrack(false); measure(); } }, 120); });
  function boot() {
    genMid(); genRoad(); genFore(); stars = makeStars();
    layoutTrack(true); measure();
    // warm the first screen's tiles before the first frame
    for (var j = 0; j < LAYERS.length; j++) { var v = visRange(LAYERS[j], 0); for (var k = v[0]; k <= v[1] + 1; k++) getTile(LAYERS[j], k); }
    if ("scrollRestoration" in history) history.scrollRestoration = "manual";
    if (scrollNow() > 30) started();
    requestAnimationFrame(frame);
  }
  var fontsReady = document.fonts && document.fonts.load ? Promise.all([document.fonts.load('700 16px "Fraunces"'), document.fonts.load('700 12px "Manrope"')]) : Promise.resolve();
  Promise.race([fontsReady, new Promise(function (r) { setTimeout(r, 1500); })]).then(boot, boot);
})();
