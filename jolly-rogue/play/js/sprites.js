// Character sprites, Contra-style: legs, torso, head and the gun arm are separate parts, each
// outlined on its own, then stacked into a cached frame. Aim direction picks the arm pose;
// the run cycle comes from swinging thighs and shins. Navy sprites take their nation's colors.
(() => {
  const JR = window.JR;
  const px = JR.px;
  const FW = 34, FH = 34;                // frame size
  const AX = 14, AY = 33;                // anchor: feet center
  const HIP = { x: 14, y: 22 };

  JR.SPRITE = { FW, FH, AX, AY };

  // ---------- part art (facing right) ----------

  const HEADS = {
    pirate: [
      '....HHHH....',
      '..HHHHHHHH..',
      '.HHHHWWHHHH.',
      '.HHHWKKWHHH.',
      'HhhHHWWHHhhH',
      '.hHHHHHHHHHH',
      '..SSSSSSSS..',
      '..SSSSSSKS..',
      '..sSSSSSSSS.',
      '..EESSSEEE..',
      '...EEEEEE...',
    ],
    sailor: [
      '............',
      '............',
      '...AAAAAA...',
      '..AAAAAAAA..',
      '.aaaaaaaaaa.',
      '..EESSSSSS..',
      '..SSSSSSSS..',
      '..SSSSSSKS..',
      '..sSSSSSSSS.',
      '..SSSSSSES..',
      '...SSSSSS...',
    ],
    officer: [
      '............',
      '..HHHHHHHH..',
      '.HHHHHYHHHH.',
      'HHHHHHHHHHHH',
      '.YYYYYYYYYY.',
      '..SSSSSSSS..',
      '..SSSSSSKS..',
      '..sSSSSSSSS.',
      '..SSEEEESS..',
      '..SSSSSSSS..',
      '...SSSSSS...',
    ],
    grenadier: [
      '.....AA.....',
      '....AAAA....',
      '....AaaA....',
      '...AAaaAA...',
      '...AAAAAA...',
      '..aaaaaaaa..',
      '..SSSSSSSS..',
      '..SSSSSSKS..',
      '..sSSSSSSSS.',
      '..SSSSSSSS..',
      '...SSSSSS...',
    ],
    marine: [
      '.....HH.....',
      '....HHHH....',
      '...HHHHHH...',
      '..HHHHHHHH..',
      'TTHHHHHHHHTT',
      '.THHHHHHHHT.',
      '..SSSSSSSS..',
      '..SSSSSSKS..',
      '..sSSSSSSSS.',
      '..SSSEEEES..',
      '...SSSSSS...',
    ],
  };

  const TORSOS = {
    pirate: [
      '..VVVVVVV..',
      '.VVVVWWVVV.',
      'VVVVVWWVVVV',
      'VVVVYWWVVVV',
      'VVVVvWWVVVV',
      'VVVVYWWVVVV',
      'RRRRRYYRRRR',
      'VVVVVRRVVVV',
      'vVVVV.RVVVv',
      'vVVV...VVVv',
      '.vv.....vv.',
    ],
    sailor: [
      '..JJJJJJJ..',
      '.JJJJWWJJJ.',
      'JJJJWjjWJJJ',
      'JJJJWWWWJJJ',
      'jJJJWjjWJJJ',
      'jJJJWWWWJJJ',
      'KKKKKKKKKKK',
      '.NNNNNNNNN.',
    ],
    marine: [
      '..CCCCCCC..',
      '.CTCCCCCTC.',
      'CCCTCCCTCCC',
      'CCCCTCTCCCC',
      'cCCCCTCCCCC',
      'cCCCTCTCCCC',
      'KKKKKYKKKKK',
      'CCCCWWWCCCC',
      'cCCC...CCCc',
      'cCC.....CCc',
      '.cc.....cc.',
    ],
  };

  TORSOS.officer = [
    '.YCCCCCCCY.',
    'YYCCWWWCCYY',
    'CCCCWWWCCCC',
    'CCCCWYWCCCC',
    'cCCCWWWCCCC',
    'cCCCWYWCCCC',
    'KKKKKYKKKKK',
    'CCCCWWWCCCC',
    'cCCC...CCCc',
    'cCC.....CCc',
    '.cc.....cc.',
  ];

  const LOOK = {
    pirate: { head: 'pirate', torso: 'pirate', pants: 'P', pantsBack: 'p', sleeve: 'V', sleeveBack: 'v', cuff: 'W' },
    sailor: { head: 'sailor', torso: 'sailor', pants: 'N', pantsBack: 'n', sleeve: 'J', sleeveBack: 'j', cuff: 'W' },
    marine: { head: 'marine', torso: 'marine', pants: 'W', pantsBack: 'w', sleeve: 'C', sleeveBack: 'c', cuff: 'T' },
    officer: { head: 'officer', torso: 'officer', pants: 'W', pantsBack: 'w', sleeve: 'C', sleeveBack: 'c', cuff: 'Y' },
    grenadier: { head: 'grenadier', torso: 'marine', pants: 'W', pantsBack: 'w', sleeve: 'C', sleeveBack: 'c', cuff: 'T' },
  };

  // ---------- the player's pirate, built from their look ----------

  const SKIN = { light: ['#f8b888', '#d07850'], tan: ['#e0a070', '#b06838'], brown: ['#b07040', '#804820'], dark: ['#7a4824', '#502c12'] };
  const HAIRC = { brown: ['#6a3418', '#9a5a28'], black: ['#2c2430', '#4c4458'], blonde: ['#e8c050', '#fce090'], red: ['#c04818', '#e07030'], grey: ['#9c9cac', '#c8c8d4'] };
  const COAT = { leather: ['#a05a2c', '#6a3418'], black: ['#3c3648', '#24202c'], crimson: ['#a81c30', '#6c1020'], purple: ['#6c3c9c', '#42206a'], green: ['#2c7c4c', '#1a4c2c'] };
  const DEFAULT_STYLE = { body: 'male', skin: 'light', hair: 'short', hairColor: 'brown', beard: 'full', hat: 'tricorn', coat: 'leather', eye: 'none', hand: 'hand' };

  const FACE = {
    male: ['..SSSSSSSS..', '..SSSSSSKS..', '..sSSSSSSSS.', '..SSSSSSSS..', '..SSSSSSSS..', '...SSSSSS...'],
    female: ['..SSSSSSKK..', '..SSSSSSKS..', '..sSSSSSSSS.', '..SSSSSSSS..', '..SSSSSSRS..', '...SSSSS....'],
  };
  const HATS = {
    tricorn: ['....HHHH....', '..HHHHHHHH..', '.HHHHWWHHHH.', '.HHHWKKWHHH.', 'HhhHHWWHHhhH', '.hHHHHHHHHHH'],
    captain: ['...HHHHHH...', '..HHHHHHHH..', '.HHHHWWHHHH.', 'YHHHWKKWHHHY', 'YYYYYYYYYYYY', '.hHHHHHHHHHH'],
    cavalier: ['.RRR........', '..RRRHHHH...', '...HHHHHHH..', '..HHHHHHHH..', 'HHHHHHHHHHHH', '.hhhhhhhhhh.'],
    bandana: ['............', '............', '...RRRRRR...', '..RRRWRRRR..', 'RRRRRRRRWRR.', 'RR.RRRRRRRR.'],
  };
  const HAIR_TOP = ['............', '............', '...EEEEEE...', '..EEEEEEEE..', '..EEEEEEEE..', '..EEE.......'];
  const BALD_TOP = ['............', '............', '............', '...SSSSSS...', '..SSSSSSSS..', '............'];
  const BEARDS = {
    stubble: [[8, '..e.e.e.e...'], [9, '...e.e.e....']],
    full: [[8, '..EESSSEEE..'], [9, '..EEEEEEEE..'], [10, '...EEEEEE...']],
    braided: [[8, '..EESSSEEE..'], [9, '..EEEEEEEE..'], [10, '...EEEEEE...'], [11, '......EE....'], [12, '......YE....'], [13, '......EE....']],
  };

  function drawPirateHead(s, st, ox, oy) {
    const hatless = st.hat === 'none';
    if (hatless) s.rows(st.hair === 'bald' ? BALD_TOP : HAIR_TOP, ox, oy);
    s.rows(FACE[st.body] || FACE.male, ox, oy + 5);
    if (st.hair !== 'bald') s.rect(ox + 2, oy + 5, 2, st.body === 'female' ? 4 : 3, 'E');   // hair behind the ear
    for (const [r, row] of BEARDS[st.beard] || []) s.rows([row], ox, oy + r);
    if (st.eye === 'patch') { s.rows(['...KKKK.....'], ox, oy + 5); s.rows(['.......KKK..', '.......KK...'], ox, oy + 6); }
    if (!hatless) s.rows(HATS[st.hat] || HATS.tricorn, ox, oy);
  }

  function drawHairBack(s, st, ox, oy) {
    if (st.hair === 'long') { s.rect(ox + 1, oy + 6, 3, 9, 'E'); s.rect(ox + 2, oy + 15, 2, 1, 'E'); }
    else if (st.hair === 'ponytail') { s.rect(ox + 1, oy + 6, 2, 2, 'R'); s.rect(ox, oy + 8, 2, 7, 'E'); }
  }

  const styleKey = st => Object.keys(DEFAULT_STYLE).map(k => st[k]).join('.');

  // ---------- legs ----------

  // Thigh/shin angles in radians from straight down, + is forward.
  function legPose(kind, k) {
    if (kind === 'jump') return { front: [1.0, -0.2], back: [-0.2, -1.1], lift: -1 };
    if (kind === 'idle') return { front: [0.12, 0.0], back: [-0.12, 0.0], lift: 0 };
    if (kind === 'kneel') return { front: [1.45, 0.05], back: [0.1, -1.5], lift: 4 };
    const phi = (k / 8) * Math.PI * 2;
    const leg = ph => {
      const thigh = 0.62 * Math.sin(ph);
      const bend = 1.15 * Math.max(0, Math.cos(ph));      // knee folds while swinging forward
      return [thigh, thigh - bend];
    };
    return { front: leg(phi), back: leg(phi + Math.PI), lift: Math.abs(Math.sin(phi)) > 0.7 ? -1 : 0 };
  }

  function drawLeg(s, hx, hy, [ta, sa], pants) {
    const kx = hx + Math.sin(ta) * 5, ky = hy + Math.cos(ta) * 5;
    const ax = kx + Math.sin(sa) * 5, ay = ky + Math.cos(sa) * 5;
    s.line(hx, hy, kx, ky, pants, 3);
    s.line(kx, ky, ax, ay, pants, 3);
    s.rect(ax - 1, ay - 1, 4, 3, 'B');
    s.dot(ax + 3, ay + 1, 'B');
    s.dot(ax, ay - 1, 'b');
  }

  const CROUCH_LEGS = [
    '....PPPPPPP..',
    '...PPPPPPPPP.',
    '..ppp....PPP.',
    '.pppp....PPP.',
    'BBBBB....BBBB',
    'BBBB.....BBBBB',
  ];

  // ---------- arms and what they hold ----------

  const AIMS = {
    fwd: [1, 0], up: [0, -1], diagUp: [0.72, -0.72], diagDown: [0.72, 0.72], down: [0, 1],
    low: [0.88, 0.48],                                      // musket held low (marine idle)
  };

  function drawHeld(s, hx, hy, dx, dy, item) {
    if (item === 'pistol') {
      s.line(hx + dx, hy + dy, hx + dx * 6, hy + dy * 6, 'G', 2);
      s.dot(hx + dx * 5, hy + dy * 5 - (dy === 0 ? 1 : 0), 'g');
      s.line(hx - dy, hy + dx, hx - dy * 3 + dx, hy + dx * 3, 'D', 2);   // grip, perpendicular
    } else if (item === 'musket') {
      s.line(hx - dx * 6, hy - dy * 6 + 1, hx + dx * 2, hy + dy * 2, 'D', 2);
      s.line(hx + dx * 2, hy + dy * 2, hx + dx * 13, hy + dy * 13, 'G', 1);
      s.dot(hx + dx * 13, hy + dy * 13, 'g');
    } else if (item === 'rifle') {
      s.line(hx - dx * 6, hy - dy * 6 + 1, hx + dx * 2, hy + dy * 2, 'd', 2);
      s.line(hx + dx * 2, hy + dy * 2, hx + dx * 15, hy + dy * 15, 'G', 1);
      s.dot(hx + dx * 15, hy + dy * 15, 'g');
    } else if (item === 'tribarrel') {
      s.line(hx + dx, hy + dy, hx + dx * 6, hy + dy * 6, 'G', 3);
      s.line(hx + dx * 2, hy + dy * 2, hx + dx * 6, hy + dy * 6, 'g', 1);
      s.line(hx - dy, hy + dx, hx - dy * 3 + dx, hy + dx * 3, 'D', 2);
    } else if (item === 'blunderbuss') {
      s.line(hx - dx * 4, hy - dy * 4 + 1, hx + dx, hy + dy, 'D', 2);
      s.line(hx + dx, hy + dy, hx + dx * 7, hy + dy * 7, 'Y', 2);
      s.rect(hx + dx * 8 - 1, hy + dy * 8 - 1, 3, 3, 'Y');
      s.dot(hx + dx * 8, hy + dy * 8, 'y');
    } else if (item === 'swivel') {
      s.line(hx - dx * 2, hy - dy * 2, hx + dx * 8, hy + dy * 8, 'G', 3);
      s.line(hx, hy, hx + dx * 8, hy + dy * 8, 'g', 1);
      s.rect(hx + dx * 8 - 1, hy + dy * 8 - 1, 3, 3, 'G');
      s.line(hx - dy * 2, hy + dx * 2, hx - dy * 4, hy + dx * 4, 'D', 2);
    } else if (item === 'grenado' || item === 'bomb') {
      s.disc(hx + dx * 3, hy + dy * 3 - 1, 2, 'H');
      s.dot(hx + dx * 3 + 1, hy + dy * 3 - 2, 'h');
      s.dot(hx + dx * 3, hy + dy * 3 - 4, 'O');
    } else if (item === 'dagger') {
      s.line(hx + dx, hy + dy, hx + dx * 6, hy + dy * 6, 'W', 1);
      s.line(hx - dy, hy + dx, hx + dy, hy - dx, 'Y', 1);
    } else if (item === 'axe') {
      s.line(hx - dx * 2, hy - dy * 2, hx + dx * 8, hy + dy * 8, 'D', 1);
      s.rect(hx + dx * 7 - dy * 1 - 1, hy + dy * 7 + dx * 1 - 2, 4, 4, 'G');
      s.dot(hx + dx * 8 - dy * 2, hy + dy * 8 + dx * 2, 'g');
    } else if (item === 'rapier') {
      s.line(hx + dx * 2, hy + dy * 2, hx + dx * 14, hy + dy * 14, 'W', 1);
      s.disc(hx + dx, hy + dy, 1, 'Y');
    } else if (item === 'brace') {
      drawHeld(s, hx, hy, dx, dy, 'pistol');
    } else if (item === 'cutlass') {
      s.line(hx + dx, hy + dy, hx + dx * 9, hy + dy * 9, 'W', 2);
      s.line(hx + dx * 3, hy + dy * 3, hx + dx * 8, hy + dy * 8, 'w', 1);
      s.line(hx - dy * 2, hy + dx * 2, hx + dy * 2, hy - dx * 2, 'Y', 1);   // guard
    }
  }

  function drawArm(s, sx, sy, dx, dy, sleeve, cuff, item, recoil, hook) {
    const len = 5 - (recoil ? 1 : 0);
    const hx = sx + dx * len, hy = sy + dy * len;
    s.line(sx, sy, hx - dx, hy - dy, sleeve, 3);
    s.dot(hx - dx, hy - dy, cuff);
    if (hook) { s.dot(hx, hy, 'g'); s.dot(hx + 1, hy + 1, 'g'); s.dot(hx + 1, hy + 2, 'g'); s.dot(hx, hy + 3, 'g'); s.dot(hx - 1, hy + 2, 'g'); return; }
    s.rect(hx - 1, hy - 1, 2, 2, 'S');
    if (item) drawHeld(s, hx, hy, dx, dy, item);
  }

  // ---------- frames ----------

  // opts: look (pirate|sailor|marine), legs (idle|run|jump|crouch), k (run frame 0-7),
  //       aim (key of AIMS), item, recoil, slash (0-2), nation, white (hit flash)
  JR.frame = o => {
    const look = LOOK[o.look];
    const st = o.look === 'pirate' ? Object.assign({}, DEFAULT_STYLE, o.style) : null;
    const key = `f:${o.look}:${o.legs}:${o.k | 0}:${o.aim}:${o.item}:${!!o.recoil}:${o.slash ?? -1}:${o.blade || ''}:${o.nation || ''}:${!!o.white}:${st ? styleKey(st) : ''}`;
    const pal = Object.assign({}, px.PAL, o.nation ? px.NATION[o.nation] : null);
    if (st) {
      [pal.S, pal.s] = SKIN[st.skin] || SKIN.light;
      [pal.E, pal.e] = HAIRC[st.hairColor] || HAIRC.brown;
      [pal.V, pal.v] = COAT[st.coat] || COAT.leather;
    }
    return px.sprite(key, FW, FH, s => {
      const parts = [];
      const part = draw => { const p = px.surface(FW, FH, pal); draw(p); p.outline(); parts.push(p.c); };
      const crouch = o.legs === 'crouch';
      const pose = crouch ? null : legPose(o.legs, o.k | 0);
      const drop = crouch ? 8 : pose.lift + (o.legs === 'run' && (o.k | 0) % 4 === 2 ? -1 : 0);   // + is down
      const dy = crouch ? 8 : drop;                  // torso/head offset

      // back arm swings opposite the front leg while running
      const swing = o.legs === 'run' ? -Math.sin(((o.k | 0) / 8) * Math.PI * 2) * 0.9 : 0.25;
      if (st) part(p => drawHairBack(p, st, 8, dy));
      part(p => drawArm(p, 11, 13 + dy, Math.sin(swing), Math.cos(swing), look.sleeveBack, look.cuff, null, false, st && st.hand === 'hook'));
      if (crouch) part(p => p.rows(CROUCH_LEGS, 8, 27));
      else {
        part(p => drawLeg(p, HIP.x - 1, HIP.y + dy, pose.back, look.pantsBack));
        part(p => drawLeg(p, HIP.x + 1, HIP.y + dy, pose.front, look.pants));
      }
      part(p => p.rows(TORSOS[look.torso], 9, 11 + dy));
      if (st) part(p => drawPirateHead(p, st, 8, dy));
      else part(p => p.rows(HEADS[look.head], 8, dy));
      if (o.slash != null && o.slash >= 0) {
        const a = [[-0.35, -0.94], [1, -0.2], [0.75, 0.66]][o.slash];
        part(p => drawArm(p, 16, 13 + dy, a[0], a[1], look.sleeve, look.cuff, o.blade || 'cutlass', false));
      } else {
        const [ax, ay] = AIMS[o.aim || 'fwd'];
        part(p => drawArm(p, 16, 13 + dy, ax, ay, look.sleeve, look.cuff, o.item, o.recoil));
      }
      for (const c of parts) s.g.drawImage(c, 0, 0);
      if (o.white) {
        s.g.globalCompositeOperation = 'source-atop';
        s.g.fillStyle = 'rgba(255,255,255,.85)';
        s.g.fillRect(0, 0, FW, FH);
        s.g.globalCompositeOperation = 'source-over';
      }
    });
  };

  // ---------- bosses: bigger parts, same idea ----------

  const BOSS_HEADS = {
    british: [
      '................',
      '...HHHHHHHHHH...',
      '..HHHHHHYHHHHH..',
      '.HHHHHHYYYHHHHH.',
      'HHHHHHHHHHHHHHHH',
      'YYYYYYYYYYYYYYYY',
      '..WWSSSSSSSSWW..',
      '.WWWSSSSSSKSSW..',
      '.WWWSSSSSSSSSS..',
      '.WWWsSSSSSSSSSS.',
      '..WWSSSSSRRSS...',
      '..WWSSSSSSSSS...',
      '...WSSSSSSSS....',
      '....SSSSSSS.....',
    ],
    spanish: [
      '.........RRR....',
      '.......RRRR.....',
      '....HHHHHHHH....',
      '...HHHHHHHHHH...',
      'HHHHHHHHHHHHHHHH',
      '.hhhhhhhhhhhhhh.',
      '...SSSSSSSSSS...',
      '...SSSSSSSKSS...',
      '...SSSSSSSSSSS..',
      '...sSSSSSSSSSS..',
      '...SSEEEEEESS...',
      '...SSSSSESSS....',
      '....SSSSESSS....',
      '.....SSSSSS.....',
    ],
    french: [
      '.......HH.......',
      '.....HHHHHH.....',
      '....HHHWWHHH....',
      '...HHHWRRWHHH...',
      '..HHHHHWWHHHHH..',
      '.YYYYYYYYYYYYYY.',
      '...SSSSSSSSSS...',
      '...SSSSSSSKSS...',
      '...SSSSSSSSSSS..',
      '...sSSSSSSSSSS..',
      '..EESSSSSSSSEE..',
      '...EEEESSEEEE...',
      '....SSSSSSSS....',
      '.....SSSSSS.....',
    ],
    dutch: [
      '................',
      '....HHHHHHHH....',
      '...HHHHHHHHHH...',
      '...HHHHHHHHHH...',
      '.HHHHHHHHHHHHHH.',
      '..TTTTTTTTTTTT..',
      '...SSSSSSSSSS...',
      '...SSSSSSSKSS...',
      '...SSSSSSSSSSS..',
      '..EsSSSSSSSSSE..',
      '..EEEESSSSEEEE..',
      '..EEEEEEEEEEEE..',
      '...EEEEEEEEEE...',
      '....EEEEEEEE....',
    ],
  };
  const BOSS_TORSO = [
    '....CCCCCCCCCC....',
    '.YYCCCCCWWCCCCYY..',
    'YYYCCCCCWWCCCCYYY.',
    '.CCCCCCCWWCCCCCC..',
    'CCCCCCCCWWYCCCCCC.',
    'CCCCCCCCWWCCCCCCC.',
    'CCCCCCCCWWYCCCCCC.',
    'cCCCCCCCWWCCCCCCc.',
    'cCCCCCCCWWYCCCCCc.',
    'KKKKKKKKYYKKKKKKK.',
    'CCCCCCCCWWCCCCCCC.',
    'cCCCCCCC..CCCCCCc.',
    'cCCCCCC....CCCCCc.',
    'cCCCCC......CCCCc.',
    '.cc..........ccc..',
  ];
  const BW = 52, BH = 56;
  JR.BOSS_SPRITE = { W: BW, H: BH, AX: 24, AY: 55 };

  function bigLeg(s, hx, hy, [ta, sa], pants) {
    const kx = hx + Math.sin(ta) * 8, ky = hy + Math.cos(ta) * 8;
    const ax = kx + Math.sin(sa) * 8, ay = ky + Math.cos(sa) * 8;
    s.line(hx, hy, kx, ky, pants, 5);
    s.line(kx, ky, ax, ay, pants, 5);
    s.rect(ax - 2, ay - 2, 8, 4, 'B');
    s.rect(ax - 1, ay - 2, 3, 1, 'b');
  }

  function bigHeld(s, hx, hy, dx, dy, item) {
    if (item === 'swivel') {
      s.line(hx - dx * 6, hy - dy * 6, hx, hy, 'D', 3);
      s.line(hx, hy, hx + dx * 18, hy + dy * 18, 'G', 5);
      s.line(hx + dx * 2, hy + dy * 2 - 1, hx + dx * 17, hy + dy * 17 - 1, 'g', 1);
      s.rect(hx + dx * 18 - 2, hy + dy * 18 - 3, 4, 6, 'G');
    } else if (item === 'rapier') {
      s.line(hx + dx * 2, hy + dy * 2, hx + dx * 24, hy + dy * 24, 'W', 1);
      s.line(hx + dx * 3, hy + dy * 3 + 1, hx + dx * 20, hy + dy * 20 + 1, 'w', 1);
      s.disc(hx + dx * 2, hy + dy * 2, 2, 'Y');
    } else if (item === 'bomb') {
      s.disc(hx + dx * 4, hy + dy * 4 - 2, 4, 'H');
      s.rect(hx + dx * 4 - 2, hy + dy * 4 - 5, 2, 2, 'h');
      s.line(hx + dx * 4 + 2, hy + dy * 4 - 6, hx + dx * 4 + 4, hy + dy * 4 - 9, 'y', 1);
      s.dot(hx + dx * 4 + 4, hy + dy * 4 - 10, 'O');
    } else if (item === 'blunderbuss') {
      s.line(hx - dx * 8, hy - dy * 8 + 2, hx, hy, 'D', 3);
      s.line(hx, hy, hx + dx * 14, hy + dy * 14, 'Y', 3);
      s.rect(hx + dx * 15 - 3, hy + dy * 15 - 3, 6, 6, 'Y');
      s.rect(hx + dx * 15 - 1, hy + dy * 15 - 1, 2, 2, 'y');
    }
  }

  // pose: idle | stride (k 0-7) | tell | act | jump; recoil nudges the arm back.
  JR.bossFrame = o => {
    const key = `B:${o.nation}:${o.pose}:${o.k | 0}:${!!o.recoil}:${!!o.white}`;
    const pal = Object.assign({}, px.PAL, px.NATION[o.nation]);
    const item = JR.BOSSES[o.nation].item;
    return px.sprite(key, BW, BH, s => {
      const parts = [];
      const part = draw => { const p = px.surface(BW, BH, pal); draw(p); p.outline(); parts.push(p.c); };
      const legs = o.pose === 'jump' ? 'jump' : o.pose === 'stride' ? 'run' : 'idle';
      const pose = legPose(legs, o.k | 0);
      const dy = o.pose === 'stride' && (o.k | 0) % 4 === 2 ? -1 : o.pose === 'tell' ? 1 : 0;
      const swing = o.pose === 'stride' ? -Math.sin(((o.k | 0) / 8) * Math.PI * 2) * 0.8 : 0.2;
      part(p => { p.line(18, 26 + dy, 18 + Math.sin(swing) * 9, 26 + dy + Math.cos(swing) * 9, 'c', 4); p.rect(17 + Math.sin(swing) * 9, 25 + dy + Math.cos(swing) * 9, 3, 3, 'S'); });
      part(p => bigLeg(p, 21, 38 + dy, pose.back, 'w'));
      part(p => bigLeg(p, 26, 38 + dy, pose.front, 'W'));
      part(p => p.rows(BOSS_TORSO, 15, 22 + dy));
      part(p => p.rows(BOSS_HEADS[o.nation], 16, 8 + dy));
      const [ax, ay] = o.pose === 'tell' ? (item === 'rapier' || item === 'bomb' ? [0.35, -0.94] : [0.8, -0.6])
        : o.pose === 'act' ? [1, 0] : [0.9, 0.35];
      const len = 8 - (o.recoil ? 2 : 0);
      const hx = 30 + ax * len, hy = 26 + dy + ay * len;
      part(p => {
        p.line(30, 26 + dy, hx, hy, 'C', 4);
        p.rect(hx - 2, hy - 2, 4, 4, 'S');
        bigHeld(p, hx, hy, ax, ay, item);
      });
      for (const c of parts) s.g.drawImage(c, 0, 0);
      if (o.white) {
        s.g.globalCompositeOperation = 'source-atop';
        s.g.fillStyle = 'rgba(255,255,255,.85)';
        s.g.fillRect(0, 0, BW, BH);
        s.g.globalCompositeOperation = 'source-over';
      }
    });
  };

  // ---------- small sprites ----------

  const S = (key, w, h, rows, outline = true, pal) => px.sprite(key, w, h, s => { s.rows(rows); if (outline) s.outline(); }, pal);

  JR.small = {
    heart: full => S('heart' + full, 9, 8, full ? [
      '.RR.RR.',
      'RWRRRRR',
      'RRRRRRR',
      '.RRRRR.',
      '..RRR..',
      '...R...',
    ].map(r => '.' + r + '.').concat([]) : [
      '.rr.rr.',
      'rrrrrrr',
      'rrrrrrr',
      '.rrrrr.',
      '..rrr..',
      '...r...',
    ].map(r => '.' + r + '.'), true),
    coin: f => S('coin' + f, 9, 10, [
      ['..YYYY..', '.YLLYYY.', '.YLYYYY.', '.YLYYyY.', '.YYYYyY.', '.YYYyyY.', '..YYYY..'],
      ['...YY...', '..YLYY..', '..YLYy..', '..YLYy..', '..YYYy..', '..YYyy..', '...YY...'],
      ['...Y....', '...Y....', '...Y....', '...Y....', '...y....', '...y....', '...Y....'],
      ['...YY...', '..YYLY..', '..yYLY..', '..yYLY..', '..yYYY..', '..yyYY..', '...YY...'],
    ][f].map(r => '.' + r), true),
    rum: () => S('rum', 12, 13, [
      '...dddd...',
      '..DDDDDD..',
      '.dddddddd.',
      '.DDDDDDDD.',
      '.DDDWDDDD.',
      '.DDWRWDDD.',
      '.DDDWDDDD.',
      '.DDDDDDDD.',
      '.dddddddd.',
      '..DDDDDD..',
      '...dddd...',
    ].map(r => '.' + r), true),
    skull: () => S('skull', 9, 9, ['.WWWWW.', 'WWWWWWW', 'WKKWKKW', 'WKKWKKW', 'WWWKWWW', '.WWWWW.', '.W.W.W.'].map(r => '.' + r), true),
    flash: f => S('flash' + f, 9, 9, [
      ['...O...', '..OLO..', '.OLLLO.', 'OLLWLLO', '.OLLLO.', '..OLO..', '...O...'],
      ['.......', '...O...', '..OLO..', '.OLWLO.', '..OLO..', '...O...', '.......'],
    ][f].map(r => '.' + r), false),
    bullet: () => S('bullet', 6, 6, ['.....', '..L..', '.LWL.', '..L..', '.....'].map(r => r + '.'), true),
    cannonball: f => S('cball' + f, 11, 11, [
      ['..........', '...KKKK...', '..KGgKKK..', '.KGgKKKKK.', '.KgKKKKKK.', '.KKKKKKKK.', '.KKKKKKKK.', '..KKKKKK..', '...KKKK...', '..........'],
      ['...OOOO...', '..OKKKKO..', '.OKGgKKKO.', 'OKGgKKKKKO', 'OKgKKKKKKO', 'OKKKKKKKKO', 'OKKKKKKKKO', '.OKKKKKKO.', '..OKKKKO..', '...OOOO...'],
    ][f].map(r => r + '.'), false),
    bomb: f => S('bomb' + f, 9, 11, [
      '....O...'.replace('O', f ? 'L' : 'O'),
      '...y....',
      '..HHHH..',
      '.HhHHHH.',
      '.HhHHHH.',
      '.HHHHHH.',
      '..HHHH..',
    ].map(r => '.' + r), true),
    crate: () => S('crate', 16, 16, [
      'DDDDDDDDDDDDDD',
      'DddddddddddddD',
      'DdDDDDDDDDDdDD',
      'DdDdDDDDDDdDdD',
      'DdDDdDDDDdDDdD',
      'DdDDDdDDdDDDdD',
      'DdDDDDddDDDDdD',
      'DdDDDDddDDDDdD',
      'DdDDDdDDdDDDdD',
      'DdDDdDDDDdDDdD',
      'DdDdDDDDDDdDdD',
      'DdDDDDDDDDDDdD',
      'DddddddddddddD',
      'DDDDDDDDDDDDDD',
    ].map(r => '.' + r + '.'), true),
    chest: () => S('chest', 16, 14, [
      '..DDDDDDDDDD..',
      '.DDDDDDDDDDDD.',
      'DYDDDDDDDDDDYD',
      'DYDDDDDDDDDDYD',
      'YYYYYYYYYYYYYY',
      'DYDDDDYYDDDDYD',
      'DYDDDDyyDDDDYD',
      'DYDDDDDDDDDDYD',
      'DYDDDDDDDDDDYD',
      'dYddddddddddYd',
    ].map(r => '.' + r + '.'), true),
    cannon: f => px.sprite('cannon' + f, 26, 22, s => {
      const k = f ? -2 : 0;                                   // recoil
      s.line(3 + k, 9, 21 + k, 6, 'H', 5);                    // barrel, aimed a touch up
      s.line(4 + k, 8, 20 + k, 5, 'h', 1);
      s.rect(20 + k, 4, 3, 5, 'H');
      s.rect(4, 12, 15, 5, 'D'); s.rect(4, 12, 15, 1, 'e');   // carriage
      s.disc(7, 18, 3, 'd'); s.disc(16, 18, 3, 'd');          // wheels
      s.dot(7, 18, 'Y'); s.dot(16, 18, 'Y');
      s.outline();
    }),
    badge: letter => px.sprite('badge' + letter, 16, 16, s => {
      s.disc(7, 7, 6, 'Y'); s.disc(7, 7, 5, 'R'); s.disc(6, 6, 1, 'r');
      const g = px.textImage(letter, '#fcfcfc', false);
      s.g.drawImage(g, 4, 3);
      s.outline();
    }),
    parrot: f => S('parrot' + f, 12, 11, (f ? [
      '...RR.....',
      '..RRRY....',
      '..RKRYY...',
      '.JRRRR....',
      'JJJRRR....',
      '.JJRRR....',
      '...RR.....',
      '...YY.....',
    ] : [
      '..........',
      '...RR.....',
      '..RRRY....',
      '..RKRYY...',
      '..RRRR....',
      '.RRRJJ....',
      '..RRJJJ...',
      '...YY.....',
    ]).map(r => '.' + r + '.'), true, { J: '#2c6cf0' }),
    monkey: f => S('monkey' + f, 12, 12, [
      '..DDDD....',
      '.DDSSDD...',
      '.DSKSKS...',
      '.DSSSSSD..',
      '..DSSSD...',
      '..DDDDD...',
      '.DDDDDDD..',
      '.D.DDD.D' + (f ? '.D' : 'D.'),
      '...D.D..' + (f ? 'D.' : '.D'),
    ].map(r => '.' + r + '.'), true),
    dagger: () => S('dagger', 10, 5, ['........', '.Ywwwww.', 'YYWWWWWW', '.Ywwwww.'].map(r => r + '.'), true),
    keg: f => px.sprite('keg' + f, 12, 12, s => {
      s.disc(5, 5, 5, 'D');
      s.line(1, 5, 9, 5, 'd', 1); s.line(5, 1, 5, 9, 'd', 1);
      if (f) { s.line(2, 2, 8, 8, 'd', 1); s.line(8, 2, 2, 8, 'd', 1); }
      s.dot(5, 5, 'R');
      s.outline();
    }),
    wave: f => px.sprite('wave' + f, 14, 10, s => {
      const h = f ? 8 : 6;
      for (let x = 0; x < 12; x++) { const y = Math.round(h * Math.sin((x / 11) * Math.PI)); s.rect(x + 1, 9 - y, 1, y, x % 3 ? '#fce4a8' : '#fcfcfc'); }
    }),
    ball: f => S('ball' + f, 8, 8, [
      ['.......', '..KKK..', '.KGgKK.', '.KgKKK.', '.KKKKK.', '..KKK..', '.......'],
      ['..OOO..', '.OKKKO.', 'OKGgKKO', 'OKgKKKO', 'OKKKKKO', '.OKKKO.', '..OOO..'],
    ][f].map(r => r + '.'), false),
  };
})();
