// All the pixel art. Characters are hand-drawn as character grids; scenery is
// painted procedurally into small canvases once and reused every frame.
const Art = (() => {
  // ---------- colour + canvas helpers ----------
  function canvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    return [c, g];
  }
  function hex2rgb(h) { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
  function rgb2hex(r, g, b) { return '#' + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join(''); }
  function mix(a, b, t) { const A = hex2rgb(a), B = hex2rgb(b); return rgb2hex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t); }
  function shade(h, amt) { return amt < 0 ? mix(h, '#1a1020', -amt) : mix(h, '#ffffff', amt); }
  function rng(seed) {
    let a = seed >>> 0;
    return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  function hash(x, y, s = 0) {
    let h = (x * 374761393 + y * 668265263 + s * 982451653) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  function rect(g, x, y, w, h, c) { g.fillStyle = c; g.fillRect(x, y, w, h); }
  function px(g, x, y, c) { g.fillStyle = c; g.fillRect(x, y, 1, 1); }
  function disc(g, cx, cy, r, c) {
    g.fillStyle = c;
    for (let y = -r; y <= r; y++) { const w = Math.floor(Math.sqrt(r * r - y * y + r * 0.6)); g.fillRect(cx - w, cy + y, w * 2 + 1, 1); }
  }
  function ellipse(g, cx, cy, rx, ry, c) {
    g.fillStyle = c;
    for (let y = -ry; y <= ry; y++) { const w = Math.round(rx * Math.sqrt(Math.max(0, 1 - (y * y) / (ry * ry + 0.5)))); g.fillRect(cx - w, cy + y, w * 2 + 1, 1); }
  }
  function fromRows(rows, pal, flip = false) {
    const h = rows.length, w = rows[0].length;
    const [c, g] = canvas(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const col = pal[rows[y][x]];
      if (col) px(g, flip ? w - 1 - x : x, y, col);
    }
    return c;
  }

  // ---------- the birthday girl ----------
  // k outline, h/H hijab, a hair, s/S skin, e eyes, b blush, l lips, n nose ring, d/D outfit, f shoes
  const HER = {
    down: [
      '.....kkkkkk.....',
      '....khhhhhhk....',
      '...khhhhhhhhk...',
      '...khaaaaaaHk...',
      '...khsssssshk...',
      '...khsessesHk...',
      '...khbssnsbHk...',
      '...khssllssHk...',
      '...khhssssHHk...',
      '..khhhhhhhhhHk..',
      '..kdhhhhhhhHdk..',
      '..ksdddddddDsk..',
      '...kdddddddDk...',
      '...kddddddDDk...',
    ],
    up: [
      '.....kkkkkk.....',
      '....khhhhhhk....',
      '...khhhhhhhhk...',
      '...khhhhhhhHk...',
      '...khhhhhhhHk...',
      '...khhhHhhhHk...',
      '...khhhHhhhHk...',
      '...khhhHhhhHk...',
      '...khhhHhhHHk...',
      '..khhhhhhhhhHk..',
      '..kdhhhhhhhHdk..',
      '..ksdddddddDsk..',
      '...kdddddddDk...',
      '...kddddddDDk...',
    ],
    left: [
      '......kkkkk.....',
      '.....khhhhhk....',
      '....khhhhhhhk...',
      '....kaahhhhhhk..',
      '...kssshhhhhHk..',
      '...ksesshhhhHk..',
      '...knbshhhhhHk..',
      '....kslhhhhHHk..',
      '....kshhhhhHHk..',
      '...khhhhhhhhHk..',
      '...kdhhhhhhHdk..',
      '...kdddsddddDk..',
      '...kddddddddDk..',
      '....kdddddddk...',
    ],
  };
  const FEET = {
    down: ['....kff..ffk....', '...kff....ffk...', '.....kffffk.....'],
    up: ['....kff..ffk....', '.....kffffk.....', '...kff....ffk...'],
    left: ['.....kffffk.....', '....kff..ffk....', '.....kffffk.....'],
  };
  const PRESETS = {
    hijab: ['#a6c9b1', '#e8b4c0', '#c3b1e1', '#f1e4cc', '#7d9cc9', '#2f2c38', '#c98463', '#ffffff'],
    dress: ['#f3e7d3', '#e7a3b2', '#b7a6dd', '#8fbfd9', '#9bb07a', '#5c5470', '#f2c875', '#d9675f'],
    skin: ['#dba485', '#f1c7a5', '#c68a64', '#a26a48', '#7a4b32'],
  };
  function herPalette(look) {
    const s = look.skin;
    return {
      k: '#3b2a35', h: look.hijab, H: shade(look.hijab, -0.2), a: '#3a2620',
      s, S: shade(s, -0.15), e: '#24161a', b: mix(s, '#ff6f86', 0.3), l: mix(s, '#b9475a', 0.45), n: '#f2c94c',
      d: look.dress, D: shade(look.dress, -0.2), f: '#5a3a2e',
    };
  }
  // returns { down:[f0,f1,f2], up:[...], left:[...], right:[...] }
  function buildHer(look) {
    const pal = herPalette(look);
    const out = {};
    for (const dir of ['down', 'up', 'left', 'right']) {
      const base = dir === 'right' ? 'left' : dir;
      out[dir] = FEET[base].map(feet => fromRows(['................', ...HER[base], feet], pal, dir === 'right'));
    }
    // arms-up "item get" pose
    const hold = HER.down.slice();
    hold[10] = '.skdhhhhhhhHdks.';
    hold[11] = '..kdddddddddDk..';
    out.hold = fromRows(['................', ...hold, FEET.down[0]], pal);
    return out;
  }

  // ---------- Twinkle the cat ----------
  const CAT = [
    [
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '..k..k..........',
      '.kpkkpk.........',
      '.kwwvwwk.....k..',
      '.kevvevk....kwk.',
      '.kvvpvvkkkkkwk..',
      '..kvvvkwwwwwwk..',
      '...kvvwwwwwwwk..',
      '...kwWwwwwwWwk..',
      '...kvk.kvk.kwk..',
      '...kk..kk..kk...',
    ],
    [
      '................',
      '................',
      '................',
      '................',
      '................',
      '.............k..',
      '..k..k......kwk.',
      '.kpkkpk.....kwk.',
      '.kwwvwwk....kwk.',
      '.kevvevk...kwk..',
      '.kvvpvvkkkkkk...',
      '..kvvvkwwwwwwk..',
      '...kvvwwwwwwwk..',
      '...kwWwwwwwWwk..',
      '....kvk.kvkkwk..',
      '....kk..kk.kk...',
    ],
  ];
  const CAT_SIT = [
    '................',
    '................',
    '................',
    '................',
    '................',
    '..k..k..........',
    '.kpkkpk.........',
    '.kwwvwwk........',
    '.kevvevk........',
    '.kvvpvvk........',
    '..kvvvkwk.......',
    '...kvvwwwk......',
    '...kwwwwwwk.kk..',
    '...kwWwwwWwkwwk.',
    '...kvvkvvkwwkk..',
    '....kk.kk.kkk...',
  ];
  const CAT_FACE = [
    '..k..........k..',
    '.kpk........kpk.',
    '.kppk......kppk.',
    '.kwwwkkkkkkwwwk.',
    'kwwwwwwvvwwwwwwk',
    'kwwwwwwvvwwwwwwk',
    'kwwweewvvweewwwk',
    'kwwwiewvvwiewwwk',
    'kbbwwwvvvvwwwbbk',
    'kwwwwvvppvvwwwwk',
    'kwwwvvkvvkvvwwwk',
    '.kwvvvvkkvvvvwk.',
    '..kvvvvvvvvvvk..',
    '...kkkkkkkkkk...',
  ];
  const catPal = { k: '#2b2630', w: '#706b78', W: '#5a5562', v: '#faf5ee', p: '#f2a0b4', e: '#c4cf55', i: '#fffbe0', b: '#c98a9a' };
  const cat = {
    left: CAT.map(r => fromRows(r, catPal)),
    right: CAT.map(r => fromRows(r, catPal, true)),
    sitLeft: fromRows(CAT_SIT, catPal),
    sitRight: fromRows(CAT_SIT, catPal, true),
    face: fromRows(CAT_FACE, catPal),
  };

  // ---------- the Gem Rose ----------
  const ROSE = [
    '......kkkk......',
    '....kk1w12kk....',
    '...k12w1223k....',
    '..k1w12k2233k...',
    '.k12w1k3k2333k..',
    '.k112k333k233k..',
    '.k1122k34k233k..',
    '..k1122k4423k...',
    '..k21122223k....',
    '...k3222233k....',
    '....kk3333kk....',
    '......kGgk......',
    '......kgGk......',
    '..kkk..kgk......',
    '.kggGk.kgk......',
    '.kgggGkkgk......',
    '..kkgggkgk.kkk..',
    '....kkkgGkkggGk.',
    '.......kgkgGGgk.',
    '.......kgkkkkk..',
    '.......kGk......',
    '.......kgk......',
    '.......kGk......',
    '........k.......',
  ];
  const rosePal = { k: '#4b1638', 1: '#ffd6ec', 2: '#ff7fc0', 3: '#e0368f', 4: '#9c1f63', w: '#ffffff', g: '#7ee0b0', G: '#2f9e7a' };
  const rose = fromRows(ROSE, rosePal);

  // ---------- scenery ----------
  const THEMES = {
    meadow: { grass: '#7cc66a', grassD: '#62ad59', grassL: '#9bd982', path: '#d6b07a', pathD: '#b88f5d', water: '#4fa6dd', waterL: '#8fd4f5', waterD: '#3b88c4', bg: '#3f6b3b' },
    falls: { grass: '#6cc07a', grassD: '#4fa466', grassL: '#93d79a', path: '#c9a878', pathD: '#a98a5c', water: '#45a8d6', waterL: '#9be0f7', waterD: '#2f87b8', bg: '#355e45' },
    sunset: { grass: '#93c766', grassD: '#76ad55', grassL: '#b5da7f', path: '#dab27d', pathD: '#bb915f', water: '#5b8fd1', waterL: '#ffc58a', waterD: '#476fb0', bg: '#4a5b38' },
    sakura: { grass: '#8fcf7c', grassD: '#73b56a', grassL: '#b0e092', path: '#d8b484', pathD: '#b8925f', water: '#58b0da', waterL: '#a6e2f7', waterD: '#3d8fbf', bg: '#4a6845' },
    night: { grass: '#6ab070', grassD: '#4f945c', grassL: '#88c98a', path: '#cbb08a', pathD: '#a78d68', water: '#4a8fcf', waterL: '#a7d8ff', waterD: '#3570aa', bg: '#1a2540' },
  };

  function tree(seed, pal, big = false) {
    const W = big ? 64 : 32, H = big ? 72 : 44;
    const [c, g] = canvas(W, H);
    const R = rng(seed);
    const cx = W / 2;
    ellipse(g, cx, H - 3, big ? 20 : 11, big ? 4 : 3, 'rgba(0,0,0,0.18)');
    const tw = big ? 10 : 6, th = big ? 22 : 14;
    rect(g, cx - tw / 2, H - th - 3, tw, th, pal.trunk);
    rect(g, cx + tw / 2 - 2, H - th - 3, 2, th, pal.trunkD);
    rect(g, cx - tw / 2 - 1, H - 5, tw + 2, 2, pal.trunkD);
    const k = big ? 2 : 1;
    const cy = big ? 28 : 18;
    const blobs = [[0, 1, 12], [-7, 3, 7], [7, 3, 7], [0, -8, 8], [-5, -4, 7], [5, -4, 7]];
    blobs.forEach(([x, y, r]) => disc(g, cx + x * k, cy + y * k, r * k, pal.d));
    blobs.forEach(([x, y, r]) => disc(g, cx + x * k - 1, cy + y * k - 1, (r - 1) * k, pal.m));
    [[-4, -8, 4], [3, -3, 3], [-7, 1, 3], [6, 3, 2]].forEach(([x, y, r]) => disc(g, cx + x * k, cy + y * k, r * k, pal.l));
    for (let i = 0; i < (big ? 160 : 45); i++) {
      const a = R() * Math.PI * 2, d = Math.sqrt(R()) * 11 * k;
      const x = Math.round(cx + Math.cos(a) * d), y = Math.round(cy - 2 * k + Math.sin(a) * d * 0.9);
      px(g, x, y, R() < 0.5 ? pal.d : pal.l);
      if (pal.petal && R() < 0.3) px(g, x, y, pal.petal);
    }
    return c;
  }
  const TREE_PAL = { trunk: '#8b5a3c', trunkD: '#6a4130', d: '#3f8a4a', m: '#55a557', l: '#7cc66a' };
  const CHERRY_PAL = { trunk: '#6e3f3d', trunkD: '#51292c', d: '#e383ab', m: '#f3a8c6', l: '#ffd3e3', petal: '#ffffff' };

  function rock(seed) {
    const [c, g] = canvas(16, 16);
    ellipse(g, 8, 14, 7, 2, 'rgba(0,0,0,0.2)');
    ellipse(g, 8, 10, 7, 5, '#7d7a80');
    ellipse(g, 7, 9, 6, 4, '#a5a2a8');
    ellipse(g, 6, 8, 3, 2, '#c8c5cb');
    px(g, 10, 11, '#6a666d'); px(g, 4, 11, '#6a666d');
    if (seed % 2) { rect(g, 3, 6, 3, 1, '#7fbf6a'); px(g, 4, 5, '#7fbf6a'); }
    return c;
  }
  function bush(roses) {
    const [c, g] = canvas(16, 16);
    ellipse(g, 8, 14, 7, 2, 'rgba(0,0,0,0.2)');
    disc(g, 8, 9, 6, '#3d8a4a'); disc(g, 4, 11, 4, '#3d8a4a'); disc(g, 12, 11, 4, '#3d8a4a');
    disc(g, 7, 8, 5, '#55a557'); disc(g, 4, 10, 3, '#55a557'); disc(g, 11, 10, 3, '#55a557');
    px(g, 6, 6, '#86cf74'); px(g, 5, 7, '#86cf74'); px(g, 10, 8, '#86cf74');
    const spots = roses ? [[4, 9], [9, 6], [12, 10], [7, 11]] : [[5, 8], [10, 10]];
    spots.forEach(([x, y], i) => {
      if (roses) {
        const col = i % 2 ? '#ff7fa8' : '#e8385c';
        rect(g, x, y, 2, 2, col); px(g, x, y, shade(col, 0.4));
      } else px(g, x, y, '#e8385c');
    });
    return c;
  }
  function house() {
    const [c, g] = canvas(48, 52);
    ellipse(g, 24, 49, 23, 3, 'rgba(0,0,0,0.18)');
    rect(g, 3, 24, 42, 24, '#ead7b5');
    for (let y = 27; y < 46; y += 4) rect(g, 3, y, 42, 1, '#d6bf98');
    rect(g, 2, 45, 44, 4, '#9a8f86'); rect(g, 2, 45, 44, 1, '#b7aea6');
    // roof
    rect(g, 36, 0, 6, 10, '#9c5a48'); rect(g, 35, 0, 8, 2, '#7d4436');
    rect(g, 0, 8, 48, 18, '#c4584a');
    for (let y = 10; y < 26; y += 4) {
      rect(g, 0, y, 48, 1, '#9c3f36');
      for (let x = (y / 4) % 2 ? 0 : 3; x < 48; x += 6) rect(g, x, y, 1, 4, '#ab4a3f');
    }
    rect(g, 1, 6, 46, 3, '#9c3f36'); rect(g, 0, 25, 48, 2, '#7f3229');
    // door
    rect(g, 19, 31, 10, 15, '#7a4a32'); rect(g, 20, 32, 8, 14, '#9a6142'); rect(g, 26, 38, 1, 2, '#f2c94c');
    rect(g, 20, 35, 8, 1, '#7a4a32');
    // windows
    [[6, 30], [33, 30]].forEach(([x, y]) => {
      rect(g, x, y, 10, 9, '#f8f1e4'); rect(g, x + 1, y + 1, 8, 7, '#8fd0f0'); rect(g, x + 5, y + 1, 1, 7, '#f8f1e4'); rect(g, x + 1, y + 4, 8, 1, '#f8f1e4');
      px(g, x + 2, y + 2, '#ffffff');
      rect(g, x - 1, y + 9, 12, 3, '#8b5a3c');
      [[1, '#ff7fa8'], [4, '#f7c948'], [7, '#e8385c'], [9, '#ff7fa8']].forEach(([dx, col]) => { px(g, x + dx, y + 8, col); px(g, x + dx, y + 9, '#55a557'); });
    });
    return c;
  }
  function lantern() {
    const [c, g] = canvas(12, 24);
    ellipse(g, 6, 22, 5, 2, 'rgba(0,0,0,0.2)');
    rect(g, 1, 19, 10, 3, '#9d968f'); rect(g, 1, 19, 10, 1, '#c2bcb4');
    rect(g, 4, 12, 4, 7, '#b3ada5'); rect(g, 7, 12, 1, 7, '#8c857e');
    rect(g, 2, 7, 8, 6, '#b3ada5'); rect(g, 4, 8, 4, 4, '#ffd77a'); rect(g, 4, 8, 4, 1, '#fff2c0');
    rect(g, 0, 4, 12, 3, '#8c857e'); rect(g, 1, 4, 10, 1, '#aaa39b'); rect(g, 5, 1, 2, 3, '#8c857e');
    return c;
  }
  function torii() {
    const [c, g] = canvas(48, 46);
    const red = '#d8433a', redD = '#a8302a';
    [[6], [38]].forEach(([x]) => { rect(g, x, 12, 5, 32, red); rect(g, x + 3, 12, 2, 32, redD); rect(g, x - 1, 41, 7, 3, '#2b2b33'); });
    rect(g, 2, 18, 44, 3, red); rect(g, 2, 20, 44, 1, redD);
    rect(g, 3, 10, 42, 3, red); rect(g, 3, 12, 42, 1, redD);
    rect(g, 21, 10, 6, 8, red); rect(g, 22, 11, 4, 5, '#2b2b33');
    rect(g, 1, 5, 46, 5, '#2b2b33'); rect(g, 0, 4, 3, 3, '#2b2b33'); rect(g, 45, 4, 3, 3, '#2b2b33');
    rect(g, 0, 3, 2, 2, '#2b2b33'); rect(g, 46, 3, 2, 2, '#2b2b33'); rect(g, 2, 5, 44, 1, '#4a4a55');
    return c;
  }
  function mailbox() {
    const [c, g] = canvas(16, 20);
    ellipse(g, 8, 18, 4, 1, 'rgba(0,0,0,0.2)');
    rect(g, 7, 9, 2, 10, '#8b5a3c');
    rect(g, 3, 3, 10, 7, '#6c8fb3'); rect(g, 3, 3, 10, 1, '#93b4d6'); rect(g, 3, 9, 10, 1, '#4f6f91'); rect(g, 4, 5, 3, 3, '#4f6f91');
    rect(g, 13, 1, 1, 6, '#5a3a2e'); rect(g, 14, 1, 2, 3, '#e8385c');
    rect(g, 6, 4, 4, 2, '#fff6e8'); px(g, 8, 5, '#e8385c');
    return c;
  }
  function sign() {
    const [c, g] = canvas(16, 18);
    ellipse(g, 8, 16, 4, 1, 'rgba(0,0,0,0.2)');
    rect(g, 7, 9, 2, 8, '#6a4130');
    rect(g, 2, 2, 12, 8, '#b5834f'); rect(g, 2, 2, 12, 1, '#d1a46b'); rect(g, 2, 9, 12, 1, '#8b5a3c');
    rect(g, 4, 4, 8, 1, '#6a4130'); rect(g, 4, 6, 6, 1, '#6a4130');
    return c;
  }
  function fence() {
    const [c, g] = canvas(16, 16);
    rect(g, 0, 7, 16, 2, '#c99a62'); rect(g, 0, 11, 16, 2, '#c99a62'); rect(g, 0, 8, 16, 1, '#a87a48'); rect(g, 0, 12, 16, 1, '#a87a48');
    [1, 12].forEach(x => { rect(g, x, 4, 3, 12, '#b5834f'); rect(g, x, 4, 3, 1, '#ddb27a'); rect(g, x + 2, 5, 1, 11, '#8b5a3c'); });
    return c;
  }
  function reeds() {
    const [c, g] = canvas(16, 18);
    [[3, 6], [6, 3], [9, 5], [12, 7]].forEach(([x, top]) => { rect(g, x, top, 1, 18 - top, '#4f9a4f'); px(g, x - 1, top + 5, '#6cbf62'); });
    [[6, 2], [9, 4]].forEach(([x, y]) => { rect(g, x - 1, y, 2, 4, '#8b5a3c'); px(g, x - 1, y, '#a87a48'); });
    return c;
  }
  function pedestal(fancy) {
    const [c, g] = canvas(16, 18);
    ellipse(g, 8, 16, 7, 2, 'rgba(0,0,0,0.2)');
    rect(g, 2, 13, 12, 3, '#9d968f'); rect(g, 2, 13, 12, 1, '#c8c2ba');
    rect(g, 4, 6, 8, 7, '#b8b1a8'); rect(g, 10, 6, 2, 7, '#958e86');
    rect(g, 1, 3, 14, 3, '#c8c2ba'); rect(g, 1, 3, 14, 1, '#e4dfd8'); rect(g, 1, 5, 14, 1, '#958e86');
    if (fancy) {
      px(g, 6, 8, '#ff7fc0'); px(g, 9, 10, '#7ee0b0'); px(g, 7, 11, '#c3b1e1');
      rect(g, 3, 4, 1, 1, '#ff7fc0'); rect(g, 12, 4, 1, 1, '#ff7fc0');
    } else {
      rect(g, 6, 8, 4, 1, '#7fbf6a'); px(g, 5, 9, '#7fbf6a');
    }
    return c;
  }
  function scrollIcon() {
    const [c, g] = canvas(14, 8);
    rect(g, 2, 1, 10, 6, '#f6e7c4'); rect(g, 2, 1, 10, 1, '#fff7e2'); rect(g, 2, 6, 10, 1, '#dcc49a');
    rect(g, 0, 0, 3, 8, '#d9bb88'); rect(g, 11, 0, 3, 8, '#d9bb88'); rect(g, 1, 0, 1, 8, '#efd6a6'); rect(g, 12, 0, 1, 8, '#efd6a6');
    rect(g, 6, 1, 2, 6, '#e0446a'); px(g, 6, 7, '#e0446a'); px(g, 8, 7, '#b52f52');
    return c;
  }

  // ---------- ground tiles (painted once per map) ----------
  const WATERY = new Set(['~', 'l', 'w']);
  function paintGround(g, map, th) {
    const { rows, w, h } = map;
    const at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h) ? null : map.ground[y][x];
    for (let ty = 0; ty < h; ty++) for (let tx = 0; tx < w; tx++) {
      const t = map.ground[ty][tx], X = tx * 16, Y = ty * 16;
      const r = (i) => hash(tx, ty, i);
      const grass = () => {
        rect(g, X, Y, 16, 16, th.grass);
        for (let i = 0; i < 7; i++) {
          const gx = X + Math.floor(r(i) * 15), gy = Y + Math.floor(r(i + 20) * 14);
          px(g, gx, gy, th.grassD); px(g, gx, gy + 1, th.grassD);
          if (r(i + 40) < 0.4) px(g, gx + 1, gy, th.grassL);
        }
      };
      switch (t) {
        case '.': grass(); break;
        case ',': {
          grass();
          const cols = map.theme === 'sakura' ? ['#ffd3e3', '#ffffff'] : ['#ffffff', '#ffe066', '#ff9ec4', '#c3b1e1'];
          for (let i = 0; i < 3; i++) {
            const fx = X + 2 + Math.floor(r(i + 60) * 12), fy = Y + 2 + Math.floor(r(i + 70) * 12);
            const col = cols[Math.floor(r(i + 80) * cols.length)];
            px(g, fx - 1, fy, col); px(g, fx + 1, fy, col); px(g, fx, fy - 1, col); px(g, fx, fy + 1, col); px(g, fx, fy, '#ffd23f');
          }
          break;
        }
        case ';': {
          grass();
          for (let i = 0; i < 6; i++) {
            const bx = X + 1 + Math.floor(r(i + 90) * 14), by = Y + 4 + Math.floor(r(i + 99) * 10);
            rect(g, bx, by, 1, 4, th.grassD); px(g, bx + 1, by + 1, th.grassD); px(g, bx, by - 1, th.grassL);
          }
          break;
        }
        case 'p': {
          grass();
          for (let i = 0; i < 6; i++) {
            const fx = X + Math.floor(r(i + 110) * 15), fy = Y + Math.floor(r(i + 120) * 15);
            px(g, fx, fy, r(i + 130) < 0.5 ? '#ffc2d8' : '#ff9ec4'); if (r(i + 140) < 0.5) px(g, fx + 1, fy, '#ffd3e3');
          }
          break;
        }
        case '=': {
          grass();
          const n = (x, y) => { const v = at(x, y); return v === '=' || v === 'E' ; };
          rect(g, X, Y, 16, 16, th.path);
          const cut = th.grass;
          if (!n(tx - 1, ty) && !n(tx, ty - 1)) { rect(g, X, Y, 2, 1, cut); px(g, X, Y + 1, cut); }
          if (!n(tx + 1, ty) && !n(tx, ty - 1)) { rect(g, X + 14, Y, 2, 1, cut); px(g, X + 15, Y + 1, cut); }
          if (!n(tx - 1, ty) && !n(tx, ty + 1)) { rect(g, X, Y + 15, 2, 1, cut); px(g, X, Y + 14, cut); }
          if (!n(tx + 1, ty) && !n(tx, ty + 1)) { rect(g, X + 14, Y + 15, 2, 1, cut); px(g, X + 15, Y + 14, cut); }
          for (let i = 0; i < 5; i++) px(g, X + Math.floor(r(i + 150) * 15), Y + Math.floor(r(i + 160) * 15), th.pathD);
          if (r(170) < 0.4) { const sx = X + 3 + Math.floor(r(171) * 9), sy = Y + 3 + Math.floor(r(172) * 9); rect(g, sx, sy, 2, 1, '#e9d2a8'); }
          break;
        }
        case 'k': {
          grass();
          const stones = [[1, 1, 6, 6], [8, 1, 7, 5], [1, 8, 5, 7], [7, 7, 8, 8]];
          stones.forEach(([sx, sy, sw, sh], i) => {
            const c1 = r(i + 180) < 0.5 ? '#c9c2b8' : '#bab3a9';
            rect(g, X + sx, Y + sy, sw, sh, c1); rect(g, X + sx, Y + sy, sw, 1, '#ddd7ce'); rect(g, X + sx, Y + sy + sh - 1, sw, 1, '#9e978e');
          });
          break;
        }
        case 's': {
          rect(g, X, Y, 16, 16, '#ecd7a6');
          for (let i = 0; i < 6; i++) px(g, X + Math.floor(r(i + 200) * 16), Y + Math.floor(r(i + 210) * 16), r(i + 220) < 0.5 ? '#d9c08a' : '#f7e8c3');
          break;
        }
        case 'b': {
          const below = at(tx, ty + 1);
          if (WATERY.has(at(tx - 1, ty)) || WATERY.has(at(tx + 1, ty))) rect(g, X, Y, 16, 16, th.water);
          rect(g, X + 2, Y, 12, 16, '#b07a4a');
          for (let y = 0; y < 16; y += 4) { rect(g, X + 2, Y + y, 12, 1, '#8a5a35'); px(g, X + 3 + (y % 8), Y + y + 2, '#c99460'); }
          rect(g, X + 2, Y, 1, 16, '#c99460'); rect(g, X + 13, Y, 1, 16, '#8a5a35');
          if (ty % 2 === 0) { rect(g, X + 1, Y + 6, 2, 3, '#6a4130'); rect(g, X + 13, Y + 6, 2, 3, '#6a4130'); }
          if (below === '~') rect(g, X + 2, Y + 15, 12, 1, '#6a4130');
          break;
        }
        case '#': {
          rect(g, X, Y, 16, 16, '#8f857c');
          for (let y = 3; y < 16; y += 5) rect(g, X, Y + y + (tx % 2), 16, 1, '#766d65');
          for (let i = 0; i < 4; i++) { const cx = X + Math.floor(r(i + 230) * 14), cy = Y + Math.floor(r(i + 240) * 14); rect(g, cx, cy, 2, 1, '#a69c92'); }
          if (r(250) < 0.35) { const vx = X + 2 + Math.floor(r(251) * 12); rect(g, vx, Y, 1, 6 + Math.floor(r(252) * 8), '#4f9a4f'); px(g, vx + 1, Y + 3, '#6cbf62'); }
          if (at(tx, ty + 1) && at(tx, ty + 1) !== '#' && at(tx, ty + 1) !== 'w') {
            rect(g, X, Y + 13, 16, 3, '#665e57');
            for (let i = 0; i < 4; i++) px(g, X + Math.floor(r(i + 260) * 16), Y + 12, '#6cbf62');
          }
          if (WATERY.has(at(tx + 1, ty)) && at(tx + 1, ty) === 'w') rect(g, X + 14, Y, 2, 16, '#6c635b');
          if (at(tx - 1, ty) === 'w') rect(g, X, Y, 2, 16, '#6c635b');
          break;
        }
        case '~': case 'l': case 'w': {
          rect(g, X, Y, 16, 16, th.water);
          if (t === 'w') break;
          const land = (x, y) => { const v = at(x, y); return v !== null && !WATERY.has(v) && v !== 'b'; };
          if (land(tx, ty - 1)) { rect(g, X, Y, 16, 3, th.waterD); rect(g, X, Y, 16, 1, '#2f5f80'); }
          if (land(tx, ty + 1)) rect(g, X, Y + 14, 16, 2, th.waterL);
          if (land(tx - 1, ty)) rect(g, X, Y, 2, 16, th.waterL);
          if (land(tx + 1, ty)) rect(g, X + 14, Y, 2, 16, th.waterL);
          if (t === 'l') {
            disc(g, X + 8, Y + 8, 5, '#4f9a4f'); disc(g, X + 7, Y + 7, 4, '#6cbf62');
            rect(g, X + 8, Y + 3, 1, 5, th.water); px(g, X + 9, Y + 4, th.water);
            if ((tx + ty) % 2) { rect(g, X + 4, Y + 8, 3, 2, '#ffb3cf'); px(g, X + 5, Y + 7, '#ffffff'); }
          }
          break;
        }
        default: grass();
      }
    }
  }

  return {
    canvas, mix, shade, hash, rect, px, disc, ellipse, fromRows,
    PRESETS, buildHer, cat, rose, THEMES, paintGround,
    tree: (seed) => tree(seed, TREE_PAL),
    cherry: (seed) => tree(seed, CHERRY_PAL),
    bigCherry: () => tree(7, CHERRY_PAL, true),
    rock, bush: () => bush(false), roseBush: () => bush(true), house, lantern, torii, mailbox, sign, fence, reeds,
    pedestal: () => pedestal(false), rosePedestal: () => pedestal(true), scrollIcon: scrollIcon(),
  };
})();
