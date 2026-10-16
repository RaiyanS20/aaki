(() => {
  const TILE = 16;
  const SOLID_GROUND = new Set(['~', 'l', 'w', '#']);
  const GROUND = new Set(['.', ',', ';', '=', '~', 'w', '#', 's', 'b', 'p', 'k', 'l']);
  const $ = (id) => document.getElementById(id);
  const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
  const fill = (s) => s.replace(/\{name\}/g, CONFIG.name).replace(/\{cat\}/g, CONFIG.catName);

  // ---------- sprites ----------
  const SPR = {
    T: [1, 2, 3].map(Art.tree), C: [4, 5, 6].map(Art.cherry), Q: [Art.bigCherry()],
    o: [Art.rock(1), Art.rock(2)], B: [Art.bush()], R: [Art.roseBush()], L: [Art.lantern()],
    G: [Art.torii()], H: [Art.house()], M: [Art.mailbox()], S: [Art.sign()], f: [Art.fence()],
    r: [Art.reeds()], '*': [Art.pedestal()], X: [Art.rosePedestal()],
  };
  // collision boxes relative to the tile's top-left corner
  const OBJ = {
    T: { boxes: [[1, 2, 14, 14]] }, C: { boxes: [[1, 2, 14, 14]] }, Q: { boxes: [[-6, 2, 28, 14]] },
    o: { boxes: [[2, 6, 12, 9]] }, B: { boxes: [[1, 5, 14, 10]] }, R: { boxes: [[1, 5, 14, 10]] },
    L: { boxes: [[3, 9, 10, 7]] }, G: { boxes: [[-10, 11, 5, 5], [22, 11, 5, 5]] },
    H: { boxes: [[0, -14, 48, 30]], anchor: 'left' }, M: { boxes: [[5, 9, 6, 6]] }, S: { boxes: [[4, 9, 8, 6]] },
    f: { boxes: [[0, 8, 16, 6]] }, r: { boxes: [] }, '*': { boxes: [[2, 6, 12, 9]] }, X: { boxes: [[1, 5, 14, 10]] },
  };

  // ---------- state ----------
  const S = {
    mode: 'title', t: 0, map: null, mapIdx: 0,
    look: { hijab: Art.PRESETS.hijab[0], dress: Art.PRESETS.dress[0], skin: Art.PRESETS.skin[0] },
    flags: { intro: false, scrolls: [false, false, false], rose: false },
    cam: { x: 0, y: 0 }, parts: [], hold: false, flash: 0, bumpCd: 0, catTarget: null, fireworks: false,
  };
  const P = { x: 0, y: 0, dir: 'down', walk: 0, moving: false };
  const CAT = { x: 0, y: 0, dir: 'left', walk: 0, moving: false, idle: 0, trail: [] };
  let HER = Art.buildHer(S.look);

  // ---------- canvas ----------
  const cv = $('cv'), g = cv.getContext('2d');
  let VW = 320, VH = 180;
  function resize() {
    const W = innerWidth, H = innerHeight;
    let s = Math.max(W / (20 * TILE), H / (13 * TILE));
    s = Math.min(s, W / (7 * TILE));
    VW = Math.ceil(W / s); VH = Math.ceil(H / s);
    cv.width = VW; cv.height = VH;
    cv.style.width = VW * s + 'px'; cv.style.height = VH * s + 'px';
    g.imageSmoothingEnabled = false;
  }
  addEventListener('resize', resize); resize();

  // ---------- maps ----------
  function loadMap(idx) {
    const def = MAPS[idx];
    const h = def.rows.length, w = def.rows[0].length;
    const raw = (x, y) => (x < 0 || y < 0 || x >= w || y >= h) ? null : def.rows[y][x];
    const map = { def, idx, w, h, theme: def.theme, ground: [], objects: [], exits: new Set(), lights: [], water: [] };
    let start = { x: 2, y: 2 };
    for (let y = 0; y < h; y++) {
      const row = [];
      for (let x = 0; x < w; x++) {
        const ch = def.rows[y][x];
        if (GROUND.has(ch)) { row.push(ch); continue; }
        let under = ch === 'E' ? '=' : null;
        for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y + 1], [x, y - 1]]) {
          if (under) break;
          const n = raw(nx, ny);
          if (n && GROUND.has(n) && !SOLID_GROUND.has(n)) under = n;
        }
        row.push(under || '.');
        if (ch === 'P') start = { x, y };
        else if (ch === 'E') map.exits.add(x + ',' + y);
        else if (OBJ[ch]) {
          const sprs = SPR[ch], spr = sprs[(x * 7 + y * 3) % sprs.length];
          const o = { ch, tx: x, ty: y, spr, x: x * TILE, y: y * TILE, sortY: y * TILE + 15 };
          o.boxes = OBJ[ch].boxes.map(([bx, by, bw, bh]) => ({ x: o.x + bx, y: o.y + by, w: bw, h: bh }));
          o.dx = OBJ[ch].anchor === 'left' ? o.x : o.x + 8 - spr.width / 2;
          o.dy = o.y + TILE - spr.height + (ch === 'H' ? 2 : 0);
          if (ch === 'r') o.sortY = y * TILE + 4;
          if (ch === 'L') map.lights.push({ x: o.x + 8, y: o.y + 4, r: 26, c: '255,200,110' });
          if (ch === '*') map.lights.push({ x: o.x + 8, y: o.y - 6, r: 30, c: '255,240,170', obj: o });
          if (ch === 'X') map.lights.push({ x: o.x + 8, y: o.y - 10, r: 52, c: '255,130,200', obj: o });
          map.objects.push(o);
        }
      }
      map.ground.push(row);
    }
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (map.ground[y][x] === '~' || map.ground[y][x] === 'l') map.water.push([x, y]);
    const th = Art.THEMES[def.theme];
    const [gc, gg] = Art.canvas(w * TILE, h * TILE);
    Art.paintGround(gg, map, th);
    map.groundCanvas = gc;
    map.th = th;
    // koi live in the sakura pond
    if (def.theme === 'sakura') {
      let sx = 0, sy = 0, n = 0;
      map.water.forEach(([x, y]) => { sx += x; sy += y; n++; });
      map.pond = { x: (sx / n) * TILE + 8, y: (sy / n) * TILE + 8 };
    }
    map.start = { x: start.x * TILE + 8, y: start.y * TILE + 14 };
    // restore collected state
    map.objects.forEach(o => {
      if (o.ch === '*' && S.flags.scrolls[def.scroll]) o.taken = true;
      if (o.ch === 'X' && S.flags.rose) o.taken = true;
    });
    return map;
  }

  function exitOpen() {
    const d = S.map.def;
    if (d.final) return false;
    if (d.scroll === undefined) return S.flags.intro;
    return S.flags.scrolls[d.scroll];
  }

  function tileSolid(tx, ty) {
    const m = S.map;
    if (tx < 0 || ty < 0 || tx >= m.w || ty >= m.h) return true;
    if (m.exits.has(tx + ',' + ty)) { if (!exitOpen()) { S.bumpedExit = true; return true; } return false; }
    return SOLID_GROUND.has(m.ground[ty][tx]);
  }
  function blocked(x, y) {
    const bx = x - 5, by = y - 5, bw = 10, bh = 5;
    for (let ty = Math.floor(by / TILE); ty <= Math.floor((by + bh - 1) / TILE); ty++)
      for (let tx = Math.floor(bx / TILE); tx <= Math.floor((bx + bw - 1) / TILE); tx++)
        if (tileSolid(tx, ty)) return true;
    for (const o of S.map.objects) for (const b of o.boxes)
      if (bx < b.x + b.w && bx + bw > b.x && by < b.y + b.h && by + bh > b.y) return true;
    return false;
  }

  // ---------- input ----------
  const keys = {};
  const joy = { x: 0, y: 0, id: null, ox: 0, oy: 0 };
  const DIRKEYS = { ArrowUp: 'u', KeyW: 'u', ArrowDown: 'd', KeyS: 'd', ArrowLeft: 'l', KeyA: 'l', ArrowRight: 'r', KeyD: 'r' };
  addEventListener('keydown', (e) => {
    if (DIRKEYS[e.code]) { keys[DIRKEYS[e.code]] = true; e.preventDefault(); }
    if (['Space', 'Enter', 'KeyZ', 'KeyE', 'KeyX'].includes(e.code)) { e.preventDefault(); if (!e.repeat) action(); }
    if (e.code === 'Escape' && S.mode === 'scroll') closeScroll();
  });
  addEventListener('keyup', (e) => { if (DIRKEYS[e.code]) keys[DIRKEYS[e.code]] = false; });
  addEventListener('blur', () => { for (const k in keys) keys[k] = false; });

  const touch = $('touch'), stick = $('stick'), knob = $('knob');
  if (isTouch) document.body.classList.add('touch');
  touch.addEventListener('pointerdown', (e) => {
    if (S.mode === 'dialog') { action(); return; }
    if (joy.id !== null) return;
    joy.id = e.pointerId; joy.ox = e.clientX; joy.oy = e.clientY;
    stick.style.left = e.clientX + 'px'; stick.style.top = e.clientY + 'px';
    stick.classList.add('on'); knob.style.transform = 'translate(-50%,-50%)';
    touch.setPointerCapture(e.pointerId);
  });
  touch.addEventListener('pointermove', (e) => {
    if (e.pointerId !== joy.id) return;
    let dx = e.clientX - joy.ox, dy = e.clientY - joy.oy;
    const d = Math.hypot(dx, dy), R = 42;
    if (d > R) { dx = dx / d * R; dy = dy / d * R; }
    joy.x = Math.abs(dx) > 6 ? dx / R : 0; joy.y = Math.abs(dy) > 6 ? dy / R : 0;
    knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
  });
  const endJoy = (e) => { if (e.pointerId !== joy.id) return; joy.id = null; joy.x = joy.y = 0; stick.classList.remove('on'); };
  touch.addEventListener('pointerup', endJoy); touch.addEventListener('pointercancel', endJoy);
  $('btnA').addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); action(); });

  function action() {
    Sound.init();
    if (S.mode === 'dialog') Dialog.advance();
    else if (S.mode === 'scroll') closeScroll();
    else if (S.mode === 'play') interact();
  }

  // ---------- dialogue ----------
  const portraitImg = new Image(); portraitImg.src = 'assets/aaki-portrait.png';
  const Dialog = {
    lines: [], i: 0, shown: 0, done: null, prevMode: 'play',
    open(lines, done) {
      this.lines = lines; this.i = 0; this.done = done || null;
      if (S.mode !== 'dialog') this.prevMode = S.mode === 'cutscene' ? 'play' : S.mode;
      S.mode = 'dialog';
      $('dialog').classList.remove('hidden');
      this.show();
    },
    show() {
      const L = this.lines[this.i];
      this.text = fill(L.text); this.shown = 0;
      const box = $('dialog'), por = $('portrait');
      box.className = 'who-' + L.who;
      por.innerHTML = '';
      if (L.who === 'her') { const im = portraitImg.cloneNode(); por.appendChild(im); $('speaker').textContent = CONFIG.name; }
      else if (L.who === 'cat') { const c = document.createElement('canvas'); c.width = 16; c.height = 14; c.getContext('2d').drawImage(Art.cat.face, 0, 0); por.appendChild(c); $('speaker').textContent = CONFIG.catName; }
      else $('speaker').textContent = '';
      if (L.who === 'cat' && L.meow !== false && this.i === 0) Sound.sfx('meow');
      $('dtext').textContent = '';
      $('dnext').classList.remove('on');
    },
    update(dt) {
      if (S.mode !== 'dialog' || this.shown >= this.text.length) return;
      const before = Math.floor(this.shown);
      this.shown = Math.min(this.text.length, this.shown + dt * 45);
      const now = Math.floor(this.shown);
      if (now !== before) {
        $('dtext').textContent = this.text.slice(0, now);
        if (now % 3 === 0) Sound.sfx('blip');
      }
      if (now >= this.text.length) $('dnext').classList.add('on');
    },
    advance() {
      if (this.shown < this.text.length) { this.shown = this.text.length; $('dtext').textContent = this.text; $('dnext').classList.add('on'); return; }
      this.i++;
      if (this.i < this.lines.length) { this.show(); return; }
      $('dialog').classList.add('hidden');
      S.mode = this.prevMode;
      const d = this.done; this.done = null;
      if (d) d();
    },
  };
  const her = (text) => ({ who: 'her', text });
  const cat = (text, meow) => ({ who: 'cat', text, meow });
  const sys = (text) => ({ who: 'sys', text });
  const say = (...lines) => Dialog.open(lines);

  // ---------- magic scroll ----------
  let scrollReady = 0, scrollDone = null;
  function openScroll(def, done) {
    S.mode = 'scroll'; scrollDone = done;
    $('stitle').textContent = fill(def.title);
    const body = $('sbody'); body.innerHTML = '';
    fill(def.text).split(/\n\n+/).forEach(p => { const el = document.createElement('p'); el.textContent = p; body.appendChild(el); });
    const el = $('scroll');
    el.classList.remove('hidden'); el.classList.remove('open');
    void el.offsetWidth;
    el.classList.add('open');
    Sound.sfx('unroll'); setTimeout(() => Sound.sfx('chime'), 350);
    scrollReady = performance.now() + 900;
  }
  function closeScroll() {
    if (S.mode !== 'scroll' || performance.now() < scrollReady) return;
    $('scroll').classList.add('hidden');
    S.mode = 'play';
    Sound.sfx('select');
    const d = scrollDone; scrollDone = null;
    if (d) d();
  }
  $('sclose').addEventListener('click', (e) => { e.stopPropagation(); closeScroll(); });

  // ---------- story ----------
  const STORY = {
    meadow: {
      enter() {
        say(her('Mmm... what a beautiful morning.'), her('Wait... what was that sound?'));
        Dialog.done = () => {
          CAT.x = P.x + Math.min(VW / 2 + 20, 140); CAT.y = P.y; CAT.dir = 'left';
          S.catTarget = { x: P.x + 18, y: P.y };
          S.mode = 'cutscene';
          Sound.sfx('meow');
          S.onCatArrive = () => {
            S.catTarget = null; P.dir = 'right';
            hearts(CAT.x, CAT.y - 12);
            Dialog.open([
              cat('Meow! Happy birthday, {name}!! 🎉'),
              cat("I'm {cat}! I've been waiting ALL morning for you to wake up."),
              cat("Today is a very special day, so I hid three magical scrolls around the valley."),
              cat("One at the waterfall, one at the lake, and one under the cherry blossoms."),
              cat("Each one has a message written just for you. Follow me! 🐾"),
              sys(isTouch ? 'Drag anywhere on the left to walk. Tap Ⓐ to talk, read, and pet {cat}.' : 'Walk with the arrow keys / WASD. Press Space to talk, read, and pet {cat}.'),
            ], () => {
              S.flags.intro = true;
              objective('Follow the path east to the waterfall');
            });
          };
        };
        objective('Good morning!');
      },
      objective: () => S.flags.intro ? 'Follow the path east to the waterfall' : 'Good morning!',
    },
    falls: {
      enter() { say(her("Wow... it's so peaceful here."), cat('Listen to that water! The first scroll is somewhere near the pool.')); },
      objective: () => S.flags.scrolls[0] ? 'Head east to Golden Lake' : 'Find the scroll near the waterfall',
      pre: [cat("There it is, glowing on the rock! Go on, open it ✨")],
      post: [cat('Aww... 🥹', false), cat("Okay! The next one is at the lake. The sun is about to set, let's hurry!", false)],
    },
    lake: {
      enter() { say(her('Oh... look at that sky.'), cat('Golden hour! My favourite. Check the very end of the dock.')); },
      objective: () => S.flags.scrolls[1] ? 'Head east to the cherry blossoms' : 'Walk to the end of the dock',
      pre: [cat("Careful not to fall in! ...I can't swim. 😿")],
      post: [cat('One more! The cherry blossoms are just past the lake. 🌸', false)],
    },
    sakura: {
      enter() { say(cat('Sakura season! 🌸 Look at all the petals...'), cat('The last scroll is under the biggest blossom tree, through the red gate.')); },
      objective: () => S.flags.scrolls[2] ? 'Follow Twinkle east... ✨' : 'Go through the red gate to the giant blossom tree',
      pre: [cat('This is the last scroll... ready?')],
      post: [cat("That's all three scrolls!", false), cat("...but wait. I think there's one more surprise. Follow me, quick! ✨", false)],
    },
    garden: {
      enter() { say(her('It got dark so fast... and the whole garden is full of roses.'), cat("Look! Something is glowing in the middle of the garden!")); },
      objective: () => S.flags.rose ? 'Happy Birthday, {name} 💗' : 'Find the glowing light in the garden',
    },
  };

  function objective(text) { $('objective').textContent = fill(text); }
  function refreshHud() {
    const n = S.flags.scrolls.filter(Boolean).length;
    $('count').textContent = S.flags.rose ? '🌹 1/1' : `📜 ${n}/3`;
    objective(STORY[S.map.def.id].objective());
  }

  function interact() {
    const target = nearestInteractable();
    if (!target) return;
    if (target === CAT) { petCat(); return; }
    const o = target, id = S.map.def.id, st = STORY[id];
    switch (o.ch) {
      case '*': {
        const i = S.map.def.scroll;
        if (o.taken) { say(cat("We already read this one! You can read them all again at the end. 💕")); return; }
        Dialog.open(st.pre, () => openScroll(CONFIG.scrolls[i], () => {
          o.taken = true; S.flags.scrolls[i] = true;
          sparkles(o.x + 8, o.y - 4, 14); Sound.sfx('sparkle');
          refreshHud();
          Dialog.open(st.post, refreshHud);
        }));
        break;
      }
      case 'X': takeRose(o); break;
      case 'M': say(sys("There's a card inside the mailbox!"), sys('"Happy birthday! Keep an eye out for a small white cat with a star on its forehead." 🐾')); break;
      case 'H': say(her('Home sweet home.'), her('Adventure first... cake later! 🎂')); break;
      case 'S': say(...S.map.def.sign.map(sys)); break;
    }
  }

  function interactables() {
    return S.map.objects.filter(o => '*XMHS'.includes(o.ch) && !(o.ch === 'X' && o.taken));
  }
  function nearestInteractable() {
    const dv = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[P.dir];
    const fx = P.x + dv[0] * 10, fy = P.y - 4 + dv[1] * 10;
    let best = null, bd = 18;
    for (const o of interactables()) {
      const cx = o.ch === 'H' ? o.x + 24 : o.x + 8, cy = o.ch === 'H' ? o.y + 14 : o.y + 10;
      const d = Math.hypot(cx - fx, cy - fy);
      if (d < bd) { bd = d; best = o; }
    }
    if (!best && S.flags.intro && Math.hypot(CAT.x - fx, CAT.y - 4 - fy) < 16) best = CAT;
    return best;
  }

  let pets = 0;
  function petCat() {
    hearts(CAT.x, CAT.y - 12); Sound.sfx('meow'); CAT.idle = 3;
    pets++;
    const lines = ['Purrrrr... 💕', 'Hehe, that tickles!', "You're my favourite human. Don't tell anyone.", 'More pets please. It IS a special day.', 'Mrrrp! 🐾'];
    if (pets % 3 === 0) say(cat(lines[(pets / 3 - 1) % lines.length], false));
  }

  function takeRose(o) {
    Dialog.open([cat('This is it, my favourite part. Go on, it’s yours! ✨')], () => {
      S.mode = 'cutscene'; o.taken = true; S.flags.rose = true;
      P.dir = 'down'; S.hold = true; S.flash = 1;
      Sound.sfx('fanfare'); sparkles(P.x, P.y - 26, 24);
      setTimeout(() => {
        Dialog.open([
          sys('✨ You received the Gem Rose! ✨'),
          cat("It's made of crystal and starlight, so it will never, ever wilt.", false),
          cat("Someone wanted you to have a flower that lasts forever. 💗", false),
        ], () => { S.hold = false; refreshHud(); showEnding(); });
      }, 2000);
    });
  }

  function showEnding() {
    S.mode = 'ending'; S.fireworks = true;
    $('etitle').textContent = fill('Happy Birthday, {name}!');
    $('enote-title').textContent = fill(CONFIG.rose.title);
    const body = $('enote'); body.innerHTML = '';
    fill(CONFIG.rose.text).split(/\n\n+/).forEach(p => { const el = document.createElement('p'); el.textContent = p; body.appendChild(el); });
    $('efrom').textContent = '— with love, ' + CONFIG.from;
    $('ending').classList.remove('hidden');
    Sound.play('birthday', () => Sound.play('night'));
  }
  $('ekeep').addEventListener('click', () => {
    $('ending').classList.add('hidden'); S.mode = 'play'; S.fireworks = false;
    say(cat("Want to read your scrolls again? Here they are, in order. 📜", false));
    Dialog.done = () => readAll(0);
  });
  function readAll(i) {
    if (i >= CONFIG.scrolls.length) { say(cat('Happy birthday, {name}. Thanks for playing with me today. 🐾', false)); return; }
    openScroll(CONFIG.scrolls[i], () => readAll(i + 1));
  }
  $('eagain').addEventListener('click', () => location.reload());

  // ---------- area transitions ----------
  function enterMap(idx, first) {
    S.map = loadMap(idx); S.mapIdx = idx;
    P.x = S.map.start.x; P.y = S.map.start.y; P.dir = 'right';
    CAT.x = S.flags.intro ? P.x - 14 : -999; CAT.y = P.y; CAT.trail = []; CAT.dir = 'right';
    S.parts = [];
    updateCamera(true);
    Sound.play(S.map.def.music);
    refreshHud();
    const card = $('area');
    card.textContent = '~ ' + S.map.def.name + ' ~';
    card.classList.remove('show'); void card.offsetWidth; card.classList.add('show');
    if (first !== false) setTimeout(() => { if (S.mode === 'play') STORY[S.map.def.id].enter(); }, 1300);
  }
  function goTo(idx) {
    S.mode = 'transition';
    $('fade').classList.add('on');
    setTimeout(() => {
      enterMap(idx);
      S.mode = 'play';
      $('fade').classList.remove('on');
    }, 500);
  }

  // ---------- particles ----------
  function hearts(x, y) { for (let i = 0; i < 4; i++) S.parts.push({ k: 'heart', x: x + (Math.random() - 0.5) * 12, y, vx: (Math.random() - 0.5) * 10, vy: -18 - Math.random() * 14, life: 0, max: 1.3 + i * 0.15 }); }
  function sparkles(x, y, n) { for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, s = 15 + Math.random() * 35; S.parts.push({ k: 'spark', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0, max: 0.8 + Math.random() * 0.6 }); } }

  function ambient(dt) {
    const th = S.map.theme, c = S.cam, R = Math.random;
    const count = (k) => S.parts.reduce((n, p) => n + (p.k === k), 0);
    if (th === 'sakura' && count('petal') < 40 && R() < dt * 14)
      S.parts.push({ k: 'petal', x: c.x + R() * (VW + 60) - 30, y: c.y - 6, vx: 6 + R() * 10, vy: 10 + R() * 10, life: 0, max: 30, ph: R() * 6, col: R() < 0.5 ? '#ffc2d8' : '#ffe1ec' });
    if ((th === 'sunset' || th === 'night') && count('fly') < (th === 'night' ? 26 : 14) && R() < dt * 4)
      S.parts.push({ k: 'fly', x: c.x + R() * VW, y: c.y + R() * VH, vx: 0, vy: 0, life: 0, max: 6 + R() * 6, ph: R() * 6 });
    if (th === 'meadow' && count('fly2') < 4 && R() < dt * 0.6)
      S.parts.push({ k: 'fly2', x: c.x + R() * VW, y: c.y + R() * VH, vx: (R() - 0.5) * 16, vy: (R() - 0.5) * 10, life: 0, max: 10, ph: R() * 6, col: ['#ffe066', '#ff9ec4', '#a8d8ff', '#ffffff'][Math.floor(R() * 4)] });
    if (th === 'falls' && R() < dt * 18) {
      const fx = 9 * TILE + R() * 5 * TILE;
      S.parts.push({ k: 'mist', x: fx, y: 3 * TILE + 2 + R() * 6, vx: (R() - 0.5) * 14, vy: -6 - R() * 10, life: 0, max: 1.2 + R() });
    }
    if (th === 'night' && R() < dt * 3)
      S.parts.push({ k: 'twinkle', x: c.x + R() * VW, y: c.y + R() * VH, vx: 0, vy: 0, life: 0, max: 1 });
    if (S.fireworks && R() < dt * 1.6) {
      const x = c.x + VW * (0.15 + R() * 0.7), y = c.y + VH * (0.12 + R() * 0.35);
      const col = ['#ff7fc0', '#ffe066', '#7ee0b0', '#a8d8ff', '#c3b1e1'][Math.floor(R() * 5)];
      for (let i = 0; i < 28; i++) { const a = (i / 28) * Math.PI * 2, s = 30 + R() * 14; S.parts.push({ k: 'fw', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0, max: 1.4, col }); }
      Sound.sfx('sparkle');
    }
  }

  function updateParts(dt) {
    for (const p of S.parts) {
      p.life += dt;
      if (p.k === 'petal') { p.x += (p.vx + Math.sin(S.t * 2 + p.ph) * 8) * dt; p.y += p.vy * dt; if (p.y > S.cam.y + VH + 10) p.life = p.max; }
      else if (p.k === 'fly' || p.k === 'fly2') { p.vx += (Math.random() - 0.5) * 40 * dt; p.vy += (Math.random() - 0.5) * 40 * dt; p.vx *= 0.98; p.vy *= 0.98; p.x += p.vx * dt; p.y += p.vy * dt; }
      else if (p.k === 'fw') { p.vx *= 0.97; p.vy = p.vy * 0.97 + 14 * dt; p.x += p.vx * dt; p.y += p.vy * dt; }
      else { p.x += p.vx * dt; p.y += p.vy * dt; if (p.k === 'spark') { p.vx *= 0.94; p.vy *= 0.94; } }
    }
    S.parts = S.parts.filter(p => p.life < p.max);
  }

  // ---------- update ----------
  function update(dt) {
    S.t += dt;
    if (S.flash > 0) S.flash = Math.max(0, S.flash - dt * 1.5);
    S.bumpCd -= dt;
    Dialog.update(dt);
    if (!S.map) return;

    P.moving = false;
    if (S.mode === 'play') {
      let mx = (keys.r ? 1 : 0) - (keys.l ? 1 : 0) + joy.x;
      let my = (keys.d ? 1 : 0) - (keys.u ? 1 : 0) + joy.y;
      const len = Math.hypot(mx, my);
      if (len > 0.15) {
        mx /= Math.max(1, len); my /= Math.max(1, len);
        const sp = 64 * dt;
        S.bumpedExit = false;
        if (!blocked(P.x + mx * sp, P.y)) P.x += mx * sp;
        if (!blocked(P.x, P.y + my * sp)) P.y += my * sp;
        P.dir = Math.abs(mx) > Math.abs(my) ? (mx > 0 ? 'right' : 'left') : (my > 0 ? 'down' : 'up');
        P.moving = true; P.walk += dt;
        const last = CAT.trail[CAT.trail.length - 1];
        if (!last || Math.hypot(last.x - P.x, last.y - P.y) > 1.5) { CAT.trail.push({ x: P.x, y: P.y }); if (CAT.trail.length > 80) CAT.trail.shift(); }
        if (S.bumpedExit && S.bumpCd <= 0) {
          S.bumpCd = 4; Sound.sfx('bump');
          say(S.map.def.final ? cat('Mrrp? Not that way!') : !S.flags.intro ? cat('Mrrp?') : cat("Wait! We haven't found the scroll here yet. ✨"));
        }
        const tx = Math.floor(P.x / TILE), ty = Math.floor((P.y - 3) / TILE);
        if (S.map.exits.has(tx + ',' + ty) && exitOpen()) goTo(S.mapIdx + 1);
      }
    }
    updateCat(dt);
    ambient(dt);
    updateParts(dt);
    updateCamera(false);
  }

  function updateCat(dt) {
    let tx, ty;
    if (S.catTarget) { tx = S.catTarget.x; ty = S.catTarget.y; }
    else {
      // walk back along the trail until we're ~18px behind her
      let acc = 0, px = P.x, py = P.y; tx = null;
      for (let i = CAT.trail.length - 1; i >= 0; i--) {
        const q = CAT.trail[i];
        acc += Math.hypot(q.x - px, q.y - py); px = q.x; py = q.y;
        if (acc >= 18) { tx = q.x; ty = q.y; break; }
      }
      if (tx === null) { tx = CAT.x; ty = CAT.y; }
    }
    const dx = tx - CAT.x, dy = ty - CAT.y, d = Math.hypot(dx, dy);
    const sp = (S.catTarget ? 70 : 80) * dt;
    if (d > 1) {
      const s = Math.min(d, sp * (d > 30 ? 1.5 : 1));
      CAT.x += dx / d * s; CAT.y += dy / d * s;
      if (Math.abs(dx) > 0.3) CAT.dir = dx > 0 ? 'right' : 'left';
      CAT.moving = true; CAT.walk += dt; CAT.idle = 0;
    } else {
      CAT.moving = false; CAT.idle += dt;
      if (S.catTarget && S.onCatArrive) { const f = S.onCatArrive; S.onCatArrive = null; f(); }
    }
  }

  function updateCamera(snap) {
    const m = S.map, W = m.w * TILE, H = m.h * TILE;
    let x = W <= VW ? (W - VW) / 2 : Math.max(0, Math.min(W - VW, P.x - VW / 2));
    let y = H <= VH ? (H - VH) / 2 : Math.max(0, Math.min(H - VH, P.y - 8 - VH / 2));
    if (snap) { S.cam.x = x; S.cam.y = y; }
    else { S.cam.x += (x - S.cam.x) * 0.2; S.cam.y += (y - S.cam.y) * 0.2; }
  }

  // ---------- render ----------
  function render() {
    const m = S.map;
    if (!m) return;
    const cx = Math.round(S.cam.x), cy = Math.round(S.cam.y), t = S.t, th = m.th;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'source-over';
    g.fillStyle = th.bg; g.fillRect(0, 0, VW, VH);
    g.setTransform(1, 0, 0, 1, -cx, -cy);
    g.drawImage(m.groundCanvas, 0, 0);

    const x0 = Math.max(0, Math.floor(cx / TILE)), y0 = Math.max(0, Math.floor(cy / TILE));
    const x1 = Math.min(m.w - 1, Math.floor((cx + VW) / TILE)), y1 = Math.min(m.h - 1, Math.floor((cy + VH) / TILE));
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
      const gt = m.ground[ty][tx], X = tx * TILE, Y = ty * TILE;
      if (gt === 'w') drawFall(tx, ty, X, Y, t);
      else if (gt === '~') {
        for (let k = 0; k < 2; k++) {
          const ph = (t * 0.8 + Art.hash(tx, ty, k + 5) * 4) % 4;
          if (ph < 0.6) {
            const sx = X + 2 + Math.floor(Art.hash(tx, ty, k) * 10), sy = Y + 3 + Math.floor(Art.hash(tx, ty, k + 9) * 10);
            g.fillStyle = m.theme === 'sunset' && k === 0 ? '#ffd28a' : th.waterL;
            g.fillRect(sx, sy, ph < 0.3 ? 3 : 2, 1);
          }
        }
        if (ty > 0 && m.ground[ty - 1][tx] === 'w') drawFoam(X, Y, t, tx);
      }
    }
    if (m.pond) drawKoi(m.pond, t);
    if (exitOpen()) drawExitArrows(t);

    // y-sorted world
    const list = [];
    for (const o of m.objects) if (o.dx < cx + VW && o.dx + o.spr.width > cx && o.dy < cy + VH + 8 && o.dy + o.spr.height > cy) list.push(o);
    list.push({ sortY: P.y, draw: drawHer });
    list.push({ sortY: CAT.y - 0.5, draw: drawCat });
    list.sort((a, b) => a.sortY - b.sortY);
    for (const it of list) {
      if (it.draw) { it.draw(); continue; }
      g.drawImage(it.spr, Math.round(it.dx), Math.round(it.dy));
      if ((it.ch === '*' || it.ch === 'X') && !it.taken) drawFloating(it, t);
    }

    drawParts(false);
    drawPrompt(t);
    lighting(cx, cy, t);
    drawParts(true);

    g.setTransform(1, 0, 0, 1, 0, 0);
    if (S.flash > 0) { g.fillStyle = `rgba(255,255,255,${S.flash * 0.8})`; g.fillRect(0, 0, VW, VH); }
  }

  function drawFall(tx, ty, X, Y, t) {
    const cols = ['#ffffff', '#c9f1fd', '#8fd8f4', '#62bfe6'];
    for (let x = 0; x < 16; x++) {
      const off = Art.hash(tx * 16 + x, 0, 3) * 32;
      for (let y = 0; y < 16; y++) {
        const v = (((Y + y) - t * 70 + off) % 16 + 16) % 16;
        g.fillStyle = cols[v < 1.5 ? 0 : v < 5 ? 1 : v < 11 ? 2 : 3];
        g.fillRect(X + x, Y + y, 1, 1);
      }
    }
    if (S.map.ground[ty][tx - 1] !== 'w') { g.fillStyle = 'rgba(40,70,100,0.35)'; g.fillRect(X, Y, 2, 16); }
    if (S.map.ground[ty][tx + 1] !== 'w') { g.fillStyle = 'rgba(40,70,100,0.35)'; g.fillRect(X + 14, Y, 2, 16); }
  }
  function drawFoam(X, Y, t, tx) {
    for (let i = 0; i < 5; i++) {
      const r = 1.5 + 1.5 * Math.sin(t * 5 + i * 1.7 + tx);
      g.fillStyle = i % 2 ? '#ffffff' : '#dff6ff';
      Art.disc(g, X + 2 + i * 3, Y + 2 + ((i * 5 + tx) % 4), Math.max(1, Math.round(r)), g.fillStyle);
    }
  }
  function drawKoi(pond, t) {
    for (let i = 0; i < 3; i++) {
      const a = t * (0.45 + i * 0.12) + i * 2.1, rx = 22 - i * 4, ry = 12 - i * 2;
      const x = Math.round(pond.x + Math.cos(a) * rx), y = Math.round(pond.y + Math.sin(a) * ry);
      const vx = -Math.sin(a), vy = Math.cos(a);
      const col = ['#ff8a3d', '#ffffff', '#ffb347'][i];
      g.fillStyle = 'rgba(30,60,90,0.25)'; g.fillRect(x - 1, y + 2, 4, 2);
      g.fillStyle = col; g.fillRect(x - 1, y - 1, 3, 3);
      g.fillRect(Math.round(x - vx * 3), Math.round(y - vy * 3), 2, 2);
      if (i === 1) { g.fillStyle = '#ff6a3d'; g.fillRect(x, y - 1, 1, 1); }
    }
  }
  function drawExitArrows(t) {
    for (const k of S.map.exits) {
      const [tx, ty] = k.split(',').map(Number);
      const X = tx * TILE + 4 + Math.round(Math.sin(t * 5) * 2), Y = ty * TILE + 5;
      g.fillStyle = 'rgba(255,255,255,0.85)';
      for (let i = 0; i < 3; i++) { g.fillRect(X + i, Y + i, 2, 1); g.fillRect(X + i, Y + 6 - i, 2, 1); }
      g.fillStyle = 'rgba(255,224,102,0.9)';
      for (let i = 0; i < 3; i++) { g.fillRect(X + 4 + i, Y + i, 2, 1); g.fillRect(X + 4 + i, Y + 6 - i, 2, 1); }
    }
  }
  function drawFloating(o, t) {
    const bob = Math.round(Math.sin(t * 2.5) * 2);
    if (o.ch === '*') g.drawImage(Art.scrollIcon, o.x + 1, o.y - 8 + bob);
    else g.drawImage(Art.rose, o.x, o.y - 22 + bob);
    if (Math.random() < 0.06) S.parts.push({ k: 'spark', x: o.x + 8 + (Math.random() - 0.5) * 16, y: o.y - 6 + (Math.random() - 0.5) * 14, vx: 0, vy: -8, life: 0, max: 0.7 });
  }
  function drawHer() {
    const x = Math.round(P.x - 8), y = Math.round(P.y - 16);
    Art.ellipse(g, Math.round(P.x), Math.round(P.y - 1), 5, 1, 'rgba(0,0,0,0.22)');
    if (S.hold) {
      g.drawImage(HER.hold, x, y);
      const glow = g.createRadialGradient(P.x, y - 10, 1, P.x, y - 10, 22);
      glow.addColorStop(0, 'rgba(255,190,230,0.7)'); glow.addColorStop(1, 'rgba(255,190,230,0)');
      g.fillStyle = glow; g.fillRect(P.x - 24, y - 34, 48, 48);
      g.drawImage(Art.rose, x, y - 24 + Math.round(Math.sin(S.t * 3)));
      return;
    }
    const f = P.moving ? 1 + (Math.floor(P.walk * 7) % 2) : 0;
    g.drawImage(HER[P.dir][f], x, y - (f === 1 ? 1 : 0));
  }
  function drawCat() {
    const x = Math.round(CAT.x - 8), y = Math.round(CAT.y - 16);
    Art.ellipse(g, Math.round(CAT.x), Math.round(CAT.y - 1), 5, 1, 'rgba(0,0,0,0.2)');
    let spr;
    if (CAT.moving) spr = Art.cat[CAT.dir][Math.floor(CAT.walk * 8) % 2];
    else if (CAT.idle > 1.2) spr = CAT.dir === 'right' ? Art.cat.sitRight : Art.cat.sitLeft;
    else spr = Art.cat[CAT.dir][0];
    g.drawImage(spr, x, y);
  }
  function drawPrompt(t) {
    if (S.mode !== 'play') return;
    const o = nearestInteractable();
    if (!o) return;
    let x, y;
    if (o === CAT) { x = CAT.x; y = CAT.y - 18; }
    else if (o.ch === 'H') { x = o.x + 24; y = o.y - 8; }
    else { x = o.x + 8; y = o.dy - (o.ch === '*' ? 12 : o.ch === 'X' ? 26 : 2); }
    x = Math.round(x - 4); y = Math.round(y - 9 + Math.sin(t * 6) * 1.5);
    g.fillStyle = '#3b2a35'; g.fillRect(x, y + 1, 9, 7); g.fillRect(x + 1, y, 7, 9);
    g.fillStyle = '#fff8ee'; g.fillRect(x + 1, y + 1, 7, 7);
    g.fillStyle = o === CAT ? '#e8385c' : '#3b2a35';
    if (o === CAT) { g.fillRect(x + 2, y + 3, 2, 2); g.fillRect(x + 5, y + 3, 2, 2); g.fillRect(x + 3, y + 5, 3, 1); g.fillRect(x + 4, y + 6, 1, 1); g.fillRect(x + 2, y + 4, 5, 1); }
    else { g.fillRect(x + 4, y + 2, 1, 3); g.fillRect(x + 4, y + 6, 1, 1); }
    g.fillStyle = '#3b2a35'; g.fillRect(x + 4, y + 9, 1, 1);
  }

  const HEART = ['.x.x.', 'xxxxx', 'xxxxx', '.xxx.', '..x..'];
  function drawParts(glowPass) {
    for (const p of S.parts) {
      const a = 1 - p.life / p.max, x = Math.round(p.x), y = Math.round(p.y);
      const glowy = p.k === 'fly' || p.k === 'twinkle' || p.k === 'fw';
      if (glowy !== glowPass) continue;
      g.globalAlpha = Math.min(1, a * 1.5);
      switch (p.k) {
        case 'heart':
          g.fillStyle = '#ff6f9c';
          HEART.forEach((r, j) => { for (let i = 0; i < 5; i++) if (r[i] === 'x') g.fillRect(x + i - 2, y + j - 2, 1, 1); });
          g.fillStyle = '#ffd3e3'; g.fillRect(x - 1, y - 1, 1, 1);
          break;
        case 'spark':
          g.fillStyle = '#fff6c2'; g.fillRect(x, y - 1, 1, 3); g.fillRect(x - 1, y, 3, 1);
          break;
        case 'petal': g.globalAlpha = 1; g.fillStyle = p.col; g.fillRect(x, y, 2, 1); g.fillRect(x + (Math.sin(S.t * 4 + p.ph) > 0 ? 1 : 0), y + 1, 1, 1); break;
        case 'mist': g.globalAlpha = a * 0.6; g.fillStyle = '#ffffff'; g.fillRect(x, y, 2, 2); break;
        case 'fly2': {
          g.globalAlpha = 1; g.fillStyle = p.col;
          const open = Math.sin(S.t * 18 + p.ph) > 0;
          if (open) { g.fillRect(x - 2, y, 2, 2); g.fillRect(x + 1, y, 2, 2); } else { g.fillRect(x - 1, y, 1, 2); g.fillRect(x + 1, y, 1, 2); }
          g.fillStyle = '#3b2a35'; g.fillRect(x, y, 1, 2);
          break;
        }
        case 'fly': {
          const tw = 0.5 + 0.5 * Math.sin(S.t * 3 + p.ph);
          g.globalAlpha = Math.min(1, Math.min(p.life, p.max - p.life)) * tw;
          const gr = g.createRadialGradient(x, y, 0, x, y, 6);
          gr.addColorStop(0, 'rgba(255,240,150,0.9)'); gr.addColorStop(1, 'rgba(255,240,150,0)');
          g.fillStyle = gr; g.fillRect(x - 6, y - 6, 12, 12);
          g.fillStyle = '#fffbd0'; g.fillRect(x, y, 1, 1);
          break;
        }
        case 'twinkle': {
          const s = Math.sin((p.life / p.max) * Math.PI);
          g.globalAlpha = s; g.fillStyle = '#ffffff';
          g.fillRect(x, y, 1, 1); if (s > 0.6) { g.fillRect(x - 1, y, 3, 1); g.fillRect(x, y - 1, 1, 3); }
          break;
        }
        case 'fw': g.fillStyle = p.col; g.fillRect(x, y, 1, 1); g.globalAlpha *= 0.5; g.fillRect(Math.round(x - p.vx * 0.04), Math.round(y - p.vy * 0.04), 1, 1); break;
      }
    }
    g.globalAlpha = 1;
  }

  function lighting(cx, cy, t) {
    const th = S.map.theme;
    g.save();
    g.setTransform(1, 0, 0, 1, 0, 0);
    if (th === 'sunset') {
      const gr = g.createLinearGradient(0, 0, 0, VH);
      gr.addColorStop(0, 'rgba(255,150,70,0.55)'); gr.addColorStop(1, 'rgba(255,100,150,0.4)');
      g.globalCompositeOperation = 'overlay'; g.fillStyle = gr; g.fillRect(0, 0, VW, VH);
      const sun = g.createRadialGradient(VW, 0, 0, VW, 0, VW * 0.8);
      sun.addColorStop(0, 'rgba(255,210,130,0.35)'); sun.addColorStop(1, 'rgba(255,210,130,0)');
      g.globalCompositeOperation = 'lighter'; g.fillStyle = sun; g.fillRect(0, 0, VW, VH);
    } else if (th === 'night') {
      g.globalCompositeOperation = 'multiply'; g.fillStyle = '#6474c4'; g.fillRect(0, 0, VW, VH);
      g.globalCompositeOperation = 'source-over'; g.fillStyle = 'rgba(12,16,52,0.15)'; g.fillRect(0, 0, VW, VH);
    } else if (th === 'sakura') {
      g.fillStyle = 'rgba(255,190,215,0.08)'; g.fillRect(0, 0, VW, VH);
    } else if (th === 'falls') {
      g.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 3; i++) {
        const x = ((i * 90 + t * 4) % (VW + 120)) - 60;
        g.fillStyle = 'rgba(255,255,230,0.04)';
        g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 30, 0); g.lineTo(x - 40, VH); g.lineTo(x - 70, VH); g.fill();
      }
    }
    if (th === 'night' || th === 'sunset') {
      g.globalCompositeOperation = 'lighter';
      for (const L of S.map.lights) {
        if (L.obj && L.obj.taken && L.obj.ch === '*') continue;
        const x = L.x - cx, y = L.y - cy, r = L.r * (1 + 0.05 * Math.sin(t * 3 + L.x));
        const gr = g.createRadialGradient(x, y, 0, x, y, r);
        const k = th === 'night' ? 0.5 : 0.25;
        gr.addColorStop(0, `rgba(${L.c},${k})`); gr.addColorStop(1, `rgba(${L.c},0)`);
        g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
      }
      if (S.hold) {
        const x = P.x - cx, y = P.y - 38 - cy;
        const gr = g.createRadialGradient(x, y, 0, x, y, 60);
        gr.addColorStop(0, 'rgba(255,150,210,0.6)'); gr.addColorStop(1, 'rgba(255,150,210,0)');
        g.fillStyle = gr; g.fillRect(x - 60, y - 60, 120, 120);
      }
    }
    g.restore();
  }

  // ---------- title + customisation ----------
  function buildSwatches(id, key) {
    const wrap = $(id);
    Art.PRESETS[key].forEach((col, i) => {
      const b = document.createElement('button');
      b.className = 'sw' + (i === 0 ? ' on' : ''); b.style.background = col; b.setAttribute('aria-label', col);
      b.addEventListener('click', () => {
        S.look[key] = col; HER = Art.buildHer(S.look);
        wrap.querySelectorAll('.sw').forEach(s => s.classList.remove('on')); b.classList.add('on');
        Sound.init(); Sound.sfx('select');
      });
      wrap.appendChild(b);
    });
  }
  buildSwatches('sw-hijab', 'hijab'); buildSwatches('sw-dress', 'dress'); buildSwatches('sw-skin', 'skin');
  $('nameIn').value = CONFIG.name;
  $('title-name').textContent = CONFIG.name;
  document.title = CONFIG.name + "'s Birthday Adventure";

  const prev = $('preview').getContext('2d'), tprev = $('title-sprites').getContext('2d');
  function drawPreviews(t) {
    if (S.mode === 'custom') {
      const dirs = ['down', 'left', 'up', 'right'], d = dirs[Math.floor(t / 1.2) % 4];
      prev.clearRect(0, 0, 32, 20);
      prev.drawImage(HER[d][1 + Math.floor(t * 6) % 2], 2, 2);
      prev.drawImage(Art.cat.sitLeft, 15, 3);
    } else if (S.mode === 'title') {
      tprev.clearRect(0, 0, 48, 24);
      tprev.drawImage(HER.right[1 + Math.floor(t * 6) % 2], 6, 4 - (Math.floor(t * 6) % 2));
      tprev.drawImage(Art.cat.right[Math.floor(t * 8) % 2], 26, 6);
    }
  }

  $('startBtn').addEventListener('click', () => {
    Sound.init(); Sound.sfx('select'); Sound.play('valley');
    $('title').classList.add('hidden'); $('custom').classList.remove('hidden'); S.mode = 'custom';
  });
  $('goBtn').addEventListener('click', () => {
    Sound.init(); Sound.sfx('chime');
    const n = $('nameIn').value.trim(); if (n) CONFIG.name = n.slice(0, 16);
    $('custom').classList.add('hidden');
    $('hud').classList.remove('hidden');
    S.mode = 'transition';
    $('fade').classList.add('on');
    setTimeout(() => { enterMap(startMap, false); S.mode = 'play'; $('fade').classList.remove('on'); setTimeout(() => STORY[S.map.def.id].enter(), 1300); }, 450);
  });
  $('mute').addEventListener('click', (e) => { e.stopPropagation(); Sound.init(); $('mute').textContent = Sound.toggleMute() ? '🔇' : '🔊'; });

  // ?area=2 jumps ahead (handy for testing)
  const q = new URLSearchParams(location.search);
  let startMap = Math.max(0, Math.min(MAPS.length - 1, parseInt(q.get('area') || '0', 10) || 0));
  if (startMap > 0) { S.flags.intro = true; for (let i = 0; i < startMap - 1; i++) S.flags.scrolls[i] = true; }

  // ---------- loop ----------
  let last = performance.now();
  function frame(now) {
    const dt = Math.max(0, Math.min(0.05, (now - last) / 1000)); last = now;
    update(dt);
    render();
    drawPreviews(S.t);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // test hook
  window.__game = { S, P, CAT, enterMap, interact, action };
})();
