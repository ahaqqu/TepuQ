// TepuQ Lari — 3D runner game (Bunny Rainbow Runner) adapted for the
// TepuQ & TariQ multi-game shell (see ADR 0002).
// createLariGame() boots the Three.js world into #lariStage and returns
// { destroy } so src/game-picker.js can cleanly leave the game.

import * as THREE from "three";

/**
 * Boot TepuQ Lari. Assumes #lariStage already contains LARI_MARKUP.
 * @returns {{ destroy: () => void }}
 */
export function createLariGame() {
  const ac = new AbortController();
  const signal = ac.signal;
  let rafId = 0;
  let destroyed = false;

  // Listeners that take `signal` are removed automatically on destroy().


  /* =========================================================
   * Bunny Rainbow Runner 3D
   * ---------------------------------------------------------
   * World-space motion is the core fix vs the 2D version:
   *   • Obstacles spawn far ahead (negative Z) and move toward
   *     the camera (positive Z) every frame.
   *   • They pass the bunny at z≈0 and KEEP GOING until they
   *     keep going until they pass the player (z > DESPAWN_Z), then dispose
   *     before they can clip through the camera.
   *   • Nothing freezes on the character.
   *
   * Collision is also world-space: only when |z| is inside a
   * small contact band, same lane, and the player is not
   * jumping/sliding correctly.
   * ========================================================= */

  // ---------------------------------------------------------
  // CONFIG
  // ---------------------------------------------------------
  const CONFIG = {
    LANE_X: [-3.2, 0, 3.2],
    PLAYER_Z: 0,
    SPAWN_Z: -110,
    DESPAWN_Z: 9,           // past the player, but BEFORE the camera — never clip through the lens
    Z_HIT_AHEAD: 2.8,
    Z_HIT_BEHIND: 2.2,
    Z_COLLECT: 3.2,
    LANE_HIT_X: 2.35,
    BASE_SPEED: 16,
    MAX_SPEED: 32,
    SPEED_RAMP: 0.12,
    JUMP_VELOCITY: 12.5,
    GRAVITY: 32,
    SLIDE_DURATION: 0.75,
    LANE_LERP: 10,
    PLAYER_BASE_Y: 0,
    JUMP_CLEAR: { puddle: 0.35, block: 1.0, cart: 9999, balloon: 0 },
    // Distance scoring is disabled — score = items picked up
    DISTANCE_SCORE_RATE: 0,
    STAR_SCORE: 1, // 1 point per item (score == items collected)
    SPAWN_INTERVAL_START: 1.35,
    SPAWN_INTERVAL_MIN: 0.7,
    // Toddler pacing: big items on a calm, steady timer
    ITEM_SCALE: 2.45,
    ITEM_BASE_Y: 1.35,
    ITEM_INTERVAL: 2.0,     // one pickup every 2 seconds
    COLORS: {
      sky: 0x7ec8ff,
      fog: 0xb8e6ff,
      grass: 0x8fd96a,
      grassDark: 0x6bc04a,
      road: 0xf5e6c8,
      roadEdge: 0xe8c98a,
      lane: 0xfff8e7,
      bunny: 0xfff8f0,
      bunnyPink: 0xffb7c5,
      bunnyNose: 0xff6b9d,
      star: 0xffd60a,
      puddle: 0x7ec8ff,
      blockRed: 0xff8fab,
      blockYellow: 0xffd66b,
      blockBlue: 0x7bdff2,
      balloon: 0xff6b9d,
      balloon2: 0xffd60a,
      balloon3: 0x7bdff2,
      cart: 0xff8fab,
      treeTrunk: 0xc4a574,
      treeLeaf: 0x5cbc6e,
      treeLeaf2: 0x3da35a,
    },
  };

  // ---------------------------------------------------------
  // HELPERS
  // ---------------------------------------------------------
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[(Math.random() * arr.length) | 0];

  // ---------------------------------------------------------
  // AUDIO (same soft Web Audio SFX)
  // ---------------------------------------------------------
  const AudioFX = (() => {
    let ctx = null, master = null, unlocked = false;
    function ensure() {
      if (ctx) return;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.22;
      master.connect(ctx.destination);
    }
    function unlock() {
      ensure();
      if (ctx && ctx.state === "suspended") ctx.resume();
      unlocked = true;
    }
    function tone(freq, dur, type = "sine", vol = 0.28, slideTo = null) {
      if (!unlocked || !ctx) return;
      const t0 = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t0);
      if (slideTo != null) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
      gain.gain.setValueAtTime(vol, t0);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
      osc.connect(gain); gain.connect(master);
      osc.start(t0); osc.stop(t0 + dur + 0.02);
    }
    return {
      unlock,
      coin() { tone(880, 0.1, "sine", 0.28, 1320); setTimeout(() => tone(1320, 0.1, "sine", 0.2, 1760), 55); },
      jump() { tone(320, 0.16, "triangle", 0.28, 640); },
      slide() { tone(480, 0.14, "triangle", 0.18, 220); },
      hit() { tone(180, 0.25, "sawtooth", 0.15, 80); },
      // Silly per-obstacle hit sounds
      splat() {
        tone(220, 0.28, "triangle", 0.28, 60);
        setTimeout(() => tone(90, 0.2, "sine", 0.18), 40);
      },
      bonk() {
        tone(140, 0.18, "square", 0.22, 70);
        setTimeout(() => tone(90, 0.22, "triangle", 0.18, 40), 90);
      },
      wheee() {
        tone(400, 0.35, "sine", 0.22, 900);
        setTimeout(() => tone(700, 0.25, "sine", 0.16, 1200), 80);
      },
      pow() {
        tone(100, 0.12, "square", 0.28, 50);
        setTimeout(() => tone(200, 0.15, "sawtooth", 0.18, 80), 70);
        setTimeout(() => tone(60, 0.25, "triangle", 0.16), 140);
      },
      start() { tone(392, 0.1, "sine", 0.25); setTimeout(() => tone(523, 0.1, "sine", 0.25), 90); setTimeout(() => tone(659, 0.16, "sine", 0.28), 180); },
      gameOver() { tone(523, 0.14, "sine", 0.25); setTimeout(() => tone(392, 0.16, "sine", 0.25), 110); setTimeout(() => tone(262, 0.32, "sine", 0.22), 250); },
    };
  })();

  // ---------------------------------------------------------
  // INPUT — keyboard, swipe, and big on-screen buttons
  // ---------------------------------------------------------
  const Input = (() => {
    let pending = { left: false, right: false, jump: false, slide: false };
    function press(a) { if (a) pending[a] = true; }
    function consume() {
      const out = { ...pending };
      pending = { left: false, right: false, jump: false, slide: false };
      return out;
    }
    const KEY_MAP = {
      ArrowLeft: "left", KeyA: "left",
      ArrowRight: "right", KeyD: "right",
      ArrowUp: "jump", KeyW: "jump", Space: "jump",
      ArrowDown: "slide", KeyS: "slide",
    };
    window.addEventListener("keydown", (e) => {
      if (e.repeat) return;
      const a = KEY_MAP[e.code];
      if (a) { e.preventDefault(); AudioFX.unlock(); press(a); }
      if (e.code === "Escape" || e.code === "KeyP") window.dispatchEvent(new Event("game:toggle-pause"));
    }, { signal });

    // --- swipe (works on touch screens and mouse drag) ---
    let sx = 0, sy = 0, touching = false, touchId = null;
    const TH = 28;
    function isUiTarget(e) {
      return !!(e.target && e.target.closest && e.target.closest("button, .overlay, #touch-pad, #pause-btn"));
    }
    function onStart(e) {
      AudioFX.unlock();
      if (isUiTarget(e)) return;
      if (e.changedTouches) {
        if (touchId !== null) return;
        const t = e.changedTouches[0];
        touchId = t.identifier;
        sx = t.clientX; sy = t.clientY; touching = true;
      } else {
        sx = e.clientX; sy = e.clientY; touching = true;
      }
    }
    function onMove(e) {
      if (!touching) return;
      let t = null;
      if (e.changedTouches) {
        for (const c of e.changedTouches) {
          if (c.identifier === touchId) { t = c; break; }
        }
        if (!t) return;
      } else {
        t = e;
      }
      const dx = t.clientX - sx, dy = t.clientY - sy;
      if (Math.abs(dx) > TH || Math.abs(dy) > TH) {
        if (Math.abs(dx) > Math.abs(dy)) press(dx > 0 ? "right" : "left");
        else press(dy > 0 ? "slide" : "jump");
        sx = t.clientX; sy = t.clientY;
      }
      if (e.cancelable) e.preventDefault();
    }
    function onEnd(e) {
      if (e && e.changedTouches) {
        for (const c of e.changedTouches) {
          if (c.identifier === touchId) { touchId = null; touching = false; return; }
        }
      } else {
        touchId = null; touching = false;
      }
    }

    const wrap = document.getElementById("game-wrap");
    wrap.addEventListener("touchstart", onStart, { ...{ passive: true }, signal });
    wrap.addEventListener("touchmove", onMove, { ...{ passive: false }, signal });
    wrap.addEventListener("touchend", onEnd, { ...{ passive: true }, signal });
    wrap.addEventListener("touchcancel", onEnd, { ...{ passive: true }, signal });
    wrap.addEventListener("mousedown", onStart, { signal });
    wrap.addEventListener("mousemove", (e) => touching && onMove(e), { signal });
    wrap.addEventListener("mouseup", onEnd, { signal });
    wrap.addEventListener("mouseleave", onEnd, { signal });
    wrap.addEventListener("contextmenu", (e) => e.preventDefault(), { signal });

    // --- big on-screen buttons (toddler-friendly) ---
    const pad = document.getElementById("touch-pad");
    function bindPad(btn) {
      const act = btn.getAttribute("data-act");
      const down = (e) => {
        e.preventDefault();
        e.stopPropagation();
        AudioFX.unlock();
        press(act);
        btn.classList.add("pressed");
      };
      const up = (e) => {
        if (e) { e.preventDefault(); e.stopPropagation(); }
        btn.classList.remove("pressed");
      };
      // Prefer Pointer Events only — avoids double-firing with touch
      if (window.PointerEvent) {
        btn.addEventListener("pointerdown", down, { signal });
        btn.addEventListener("pointerup", up, { signal });
        btn.addEventListener("pointercancel", up, { signal });
        btn.addEventListener("pointerleave", up, { signal });
      } else {
        btn.addEventListener("touchstart", down, { ...{ passive: false }, signal });
        btn.addEventListener("touchend", up, { ...{ passive: false }, signal });
        btn.addEventListener("touchcancel", up, { ...{ passive: false }, signal });
        btn.addEventListener("mousedown", down, { signal });
        btn.addEventListener("mouseup", up, { signal });
        btn.addEventListener("mouseleave", up, { signal });
      }
      btn.addEventListener("click", (e) => e.preventDefault(), { signal });
    }
    pad.querySelectorAll(".pad-btn").forEach(bindPad);

    return { consume, press };
  })();

  // ---------------------------------------------------------
  // THREE.JS SCENE
  // ---------------------------------------------------------
  const canvas = document.getElementById("game-canvas");
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(CONFIG.COLORS.sky);
  scene.fog = new THREE.Fog(CONFIG.COLORS.fog, 40, 120);

  const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 200);
  camera.position.set(0, 7.2, 14.5);
  camera.lookAt(0, 1.4, -8);

  // Lights — soft, toddler-bright
  const hemi = new THREE.HemisphereLight(0xcfefff, 0x8fd96a, 0.85);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff2cc, 1.15);
  sun.position.set(18, 28, 12);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 80;
  sun.shadow.camera.left = -30;
  sun.shadow.camera.right = 30;
  sun.shadow.camera.top = 30;
  sun.shadow.camera.bottom = -30;
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0xa8d8ff, 0.35);
  fill.position.set(-12, 10, -8);
  scene.add(fill);

  // Shared materials
  const MAT = {
    grass: new THREE.MeshLambertMaterial({ color: CONFIG.COLORS.grass }),
    grassDark: new THREE.MeshLambertMaterial({ color: CONFIG.COLORS.grassDark }),
    road: new THREE.MeshLambertMaterial({ color: CONFIG.COLORS.road }),
    roadEdge: new THREE.MeshLambertMaterial({ color: CONFIG.COLORS.roadEdge }),
    lane: new THREE.MeshLambertMaterial({ color: CONFIG.COLORS.lane }),
    bunny: new THREE.MeshLambertMaterial({ color: CONFIG.COLORS.bunny }),
    bunnyShade: new THREE.MeshLambertMaterial({ color: 0xf0d8c8 }),
    bunnyPink: new THREE.MeshLambertMaterial({ color: CONFIG.COLORS.bunnyPink }),
    bunnyNose: new THREE.MeshLambertMaterial({ color: CONFIG.COLORS.bunnyNose }),
    dark: new THREE.MeshLambertMaterial({ color: 0x2b2b2b }),
    white: new THREE.MeshLambertMaterial({ color: 0xffffff }),
    star: new THREE.MeshStandardMaterial({ color: CONFIG.COLORS.star, emissive: 0xaa8800, emissiveIntensity: 0.35, metalness: 0.2, roughness: 0.45 }),
    puddle: new THREE.MeshLambertMaterial({ color: CONFIG.COLORS.puddle, transparent: true, opacity: 0.85 }),
    blockRed: new THREE.MeshLambertMaterial({ color: CONFIG.COLORS.blockRed }),
    blockYellow: new THREE.MeshLambertMaterial({ color: CONFIG.COLORS.blockYellow }),
    blockBlue: new THREE.MeshLambertMaterial({ color: CONFIG.COLORS.blockBlue }),
    balloon: new THREE.MeshLambertMaterial({ color: CONFIG.COLORS.balloon }),
    balloon2: new THREE.MeshLambertMaterial({ color: CONFIG.COLORS.balloon2 }),
    balloon3: new THREE.MeshLambertMaterial({ color: CONFIG.COLORS.balloon3 }),
    cart: new THREE.MeshLambertMaterial({ color: CONFIG.COLORS.cart }),
    cartDark: new THREE.MeshLambertMaterial({ color: 0x444444 }),
    trunk: new THREE.MeshLambertMaterial({ color: CONFIG.COLORS.treeTrunk }),
    leaf: new THREE.MeshLambertMaterial({ color: CONFIG.COLORS.treeLeaf }),
    leaf2: new THREE.MeshLambertMaterial({ color: CONFIG.COLORS.treeLeaf2 }),
    cloud: new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.92 }),
    sunMat: new THREE.MeshBasicMaterial({ color: 0xffd66b }),
    moonMat: new THREE.MeshBasicMaterial({ color: 0xf5f0d8 }),
    flowerPink: new THREE.MeshLambertMaterial({ color: 0xff8fab }),
    flowerYellow: new THREE.MeshLambertMaterial({ color: 0xffd66b }),
    flowerPurple: new THREE.MeshLambertMaterial({ color: 0xc9a0ff }),
    flowerWhite: new THREE.MeshLambertMaterial({ color: 0xfff6e8 }),
    rock: new THREE.MeshLambertMaterial({ color: 0xb0a89a }),
    rockDark: new THREE.MeshLambertMaterial({ color: 0x8a8278 }),
    mushroomCap: new THREE.MeshLambertMaterial({ color: 0xff6b6b }),
    mushroomStem: new THREE.MeshLambertMaterial({ color: 0xfff0dd }),
    fence: new THREE.MeshLambertMaterial({ color: 0xe8d4b0 }),
    lampPost: new THREE.MeshLambertMaterial({ color: 0x5a6a7a }),
    lampGlow: new THREE.MeshBasicMaterial({ color: 0xffe08a }),
    lampGlowSoft: new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.35, depthWrite: false }),
    // PICKUPS: soft green/gold glow — clearly "take me"
    pickupRing: new THREE.MeshBasicMaterial({ color: 0x7dff9a, transparent: true, opacity: 0.55, depthWrite: false }),
    pickupRingInner: new THREE.MeshBasicMaterial({ color: 0xfff3a0, transparent: true, opacity: 0.75, depthWrite: false }),
    pickupSpark: new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, depthWrite: false }),
    // OBSTACLES: warm warning base — clearly "avoid me"
    warnRing: new THREE.MeshBasicMaterial({ color: 0xff6b4a, transparent: true, opacity: 0.4, depthWrite: false }),
    leafFly: new THREE.MeshBasicMaterial({ color: 0x7ecf5e, transparent: true, opacity: 0.85 }),
    rain: new THREE.MeshBasicMaterial({ color: 0x9ec9ff, transparent: true, opacity: 0.55 }),
    starNight: new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 }),
  };

  // ---------------------------------------------------------
  // ENVIRONMENT (static + recycled scenery)
  // ---------------------------------------------------------
  const worldRoot = new THREE.Group();
  scene.add(worldRoot);

  // Ground
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(80, 200), MAT.grass);
  ground.rotation.x = -Math.PI / 2;
  ground.position.z = -60;
  ground.receiveShadow = true;
  worldRoot.add(ground);

  // Road
  const road = new THREE.Mesh(new THREE.PlaneGeometry(11, 200), MAT.road);
  road.rotation.x = -Math.PI / 2;
  road.position.set(0, 0.02, -60);
  road.receiveShadow = true;
  worldRoot.add(road);

  // Road edges
  for (const side of [-1, 1]) {
    const edge = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 200), MAT.roadEdge);
    edge.rotation.x = -Math.PI / 2;
    edge.position.set(side * 5.5, 0.03, -60);
    worldRoot.add(edge);
  }

  // Lane dashes — recycled for infinite scroll
  const dashGeo = new THREE.BoxGeometry(0.22, 0.05, 1.6);
  const dashes = [];
  for (let i = 0; i < 28; i++) {
    for (const x of [-1.6, 1.6]) {
      const d = new THREE.Mesh(dashGeo, MAT.lane);
      d.position.set(x, 0.06, -i * 5);
      worldRoot.add(d);
      dashes.push(d);
    }
  }

  // Trees / bushes / flowers / rocks on the sides — recycled
  const scenery = [];
  const swaying = []; // trees/bushes that sway in the wind

  function makeTree(x, z, s = 1) {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22 * s, 0.32 * s, 1.6 * s, 6), MAT.trunk);
    trunk.position.y = 0.8 * s;
    trunk.castShadow = true;
    g.add(trunk);
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(1.1 * s, 8, 7), MAT.leaf);
    leaf.position.y = 2.1 * s;
    leaf.castShadow = true;
    g.add(leaf);
    const leaf2 = new THREE.Mesh(new THREE.SphereGeometry(0.75 * s, 8, 7), MAT.leaf2);
    leaf2.position.set(0.5 * s, 2.55 * s, 0.2 * s);
    g.add(leaf2);
    // Extra canopy puff for a fuller tree
    const leaf3 = new THREE.Mesh(new THREE.SphereGeometry(0.65 * s, 8, 7), MAT.leaf);
    leaf3.position.set(-0.55 * s, 2.35 * s, -0.15 * s);
    g.add(leaf3);
    g.position.set(x, 0, z);
    g.userData.swayAmp = rand(0.04, 0.1) * s;
    g.userData.swayPhase = Math.random() * 6.28;
    worldRoot.add(g);
    scenery.push(g);
    swaying.push(g);
  }

  function makeBush(x, z, s = 1) {
    const g = new THREE.Group();
    const a = new THREE.Mesh(new THREE.SphereGeometry(0.7 * s, 8, 7), MAT.leaf);
    a.position.y = 0.55 * s;
    a.castShadow = true;
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.55 * s, 8, 7), MAT.leaf2);
    b.position.set(0.5 * s, 0.5 * s, 0.15);
    g.add(a, b);
    g.position.set(x, 0, z);
    g.userData.swayAmp = rand(0.05, 0.12) * s;
    g.userData.swayPhase = Math.random() * 6.28;
    worldRoot.add(g);
    scenery.push(g);
    swaying.push(g);
  }

  function makeFlowers(x, z) {
    const g = new THREE.Group();
    const mats = [MAT.flowerPink, MAT.flowerYellow, MAT.flowerPurple, MAT.flowerWhite];
    for (let i = 0; i < 5; i++) {
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.45, 4), MAT.grassDark);
      stem.position.set(rand(-0.7, 0.7), 0.22, rand(-0.7, 0.7));
      g.add(stem);
      const bloom = new THREE.Mesh(new THREE.SphereGeometry(0.14, 6, 6), mats[i % mats.length]);
      bloom.position.copy(stem.position);
      bloom.position.y = 0.5;
      g.add(bloom);
    }
    g.position.set(x, 0, z);
    g.userData.swayAmp = rand(0.08, 0.16);
    g.userData.swayPhase = Math.random() * 6.28;
    worldRoot.add(g);
    scenery.push(g);
    swaying.push(g);
  }

  function makeRock(x, z, s = 1) {
    const g = new THREE.Group();
    const r = new THREE.Mesh(new THREE.DodecahedronGeometry(0.55 * s, 0), MAT.rock);
    r.position.y = 0.35 * s;
    r.rotation.set(rand(0, 1), rand(0, 1), rand(0, 1));
    r.castShadow = true;
    g.add(r);
    const r2 = new THREE.Mesh(new THREE.DodecahedronGeometry(0.3 * s, 0), MAT.rockDark);
    r2.position.set(0.45 * s, 0.2 * s, 0.2);
    g.add(r2);
    g.position.set(x, 0, z);
    worldRoot.add(g);
    scenery.push(g);
  }

  function makeMushroom(x, z, s = 1) {
    const g = new THREE.Group();
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.12 * s, 0.16 * s, 0.45 * s, 8), MAT.mushroomStem);
    stem.position.y = 0.22 * s;
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.32 * s, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), MAT.mushroomCap);
    cap.position.y = 0.42 * s;
    cap.castShadow = true;
    g.add(stem, cap);
    g.position.set(x, 0, z);
    worldRoot.add(g);
    scenery.push(g);
  }

  function makeFence(x, z) {
    const g = new THREE.Group();
    for (let i = 0; i < 5; i++) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.7, 0.12), MAT.fence);
      post.position.set(i * 0.7 - 1.4, 0.35, 0);
      g.add(post);
    }
    const rail = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.1, 0.1), MAT.fence);
    rail.position.y = 0.55;
    g.add(rail);
    const rail2 = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.1, 0.1), MAT.fence);
    rail2.position.y = 0.28;
    g.add(rail2);
    g.position.set(x, 0, z);
    worldRoot.add(g);
    scenery.push(g);
  }

  /**
   * Street lamp along the roadside. Glow bulbs turn warm-bright at
   * night so toddlers can always see the path.
   */
  function makeLamp(x, z) {
    const g = new THREE.Group();
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 3.2, 8), MAT.lampPost);
    post.position.y = 1.6;
    post.castShadow = true;
    g.add(post);

    // Curved arm toward the road
    const armSide = x > 0 ? -1 : 1;
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.85, 6), MAT.lampPost);
    arm.rotation.z = armSide * Math.PI * 0.5;
    arm.position.set(armSide * 0.4, 3.15, 0);
    g.add(arm);

    // Bulb + soft halo
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 10), MAT.lampGlow);
    bulb.position.set(armSide * 0.85, 3.15, 0);
    g.add(bulb);

    const halo = new THREE.Mesh(new THREE.SphereGeometry(0.55, 10, 10), MAT.lampGlowSoft);
    halo.position.copy(bulb.position);
    g.add(halo);

    // Small light pool on the ground
    const pool = new THREE.Mesh(
      new THREE.CircleGeometry(1.1, 16),
      new THREE.MeshBasicMaterial({ color: 0xffe6a0, transparent: true, opacity: 0.0, depthWrite: false })
    );
    pool.rotation.x = -Math.PI / 2;
    pool.position.set(armSide * 0.85, 0.05, 0);
    g.add(pool);

    g.position.set(x, 0, z);
    g.userData.lamp = { bulb, halo, pool };
    worldRoot.add(g);
    scenery.push(g);
    lamps.push(g);
  }

  const lamps = [];

  // Dense roadside kit along the whole track
  for (let i = 0; i < 22; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const z = -i * 9 - 3;
    makeTree(side * rand(9, 17), z, rand(0.85, 1.4));
    if (i % 2 === 0) makeBush(side * rand(7, 11), z + 3, rand(0.7, 1.1));
    if (i % 3 === 0) makeFlowers(side * rand(6.5, 10), z - 2);
    if (i % 4 === 0) makeRock(side * rand(8, 14), z + 5, rand(0.7, 1.3));
    if (i % 5 === 0) makeMushroom(side * rand(7, 12), z + 1, rand(0.8, 1.2));
    if (i % 6 === 0) makeFence(side * rand(12, 15), z + 2);
    // Street lamps every stretch, both sides of the road
    if (i % 2 === 1) makeLamp(side * 7.2, z + 1);
  }

  // Extra lamps denser near the player lane for night readability
  for (let i = 0; i < 10; i++) {
    makeLamp(-7.0, -i * 14 - 6);
    makeLamp(7.0, -i * 14 - 13);
  }

  // Warm fill lights that ride with the player so night stays bright
  const nightLights = [];
  for (let i = 0; i < 3; i++) {
    const pl = new THREE.PointLight(0xffd9a0, 0, 18, 2);
    pl.position.set(i === 1 ? 0 : (i === 0 ? -5 : 5), 3.2, -i * 10);
    scene.add(pl);
    nightLights.push(pl);
  }

  // Distant birds (tiny dark Vs that flap across)
  const birds = [];
  for (let i = 0; i < 5; i++) {
    const g = new THREE.Group();
    const wingGeo = new THREE.PlaneGeometry(0.7, 0.18);
    const m = new THREE.MeshBasicMaterial({ color: 0x333344, side: THREE.DoubleSide });
    const l = new THREE.Mesh(wingGeo, m);
    const r = new THREE.Mesh(wingGeo, m);
    l.position.x = -0.35; r.position.x = 0.35;
    l.rotation.z = 0.35; r.rotation.z = -0.35;
    g.add(l, r);
    g.position.set(rand(-30, 30), rand(12, 20), rand(-80, -30));
    scene.add(g);
    birds.push({ g, l, r, phase: Math.random() * 6.28, speed: rand(2, 4) });
  }

  // Clouds
  const clouds = [];
  for (let i = 0; i < 8; i++) {
    const g = new THREE.Group();
    for (let j = 0; j < 5; j++) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(rand(1.3, 2.4), 8, 7), MAT.cloud);
      puff.position.set(j * 1.5 - 3, rand(-0.2, 0.6), rand(-0.6, 0.6));
      g.add(puff);
    }
    g.position.set(rand(-30, 30), rand(13, 22), rand(-90, -15));
    scene.add(g);
    clouds.push(g);
  }

  // Night sky stars (fade in after dark)
  const nightStars = [];
  for (let i = 0; i < 60; i++) {
    const s = new THREE.Mesh(new THREE.SphereGeometry(rand(0.08, 0.22), 4, 4), MAT.starNight.clone());
    s.position.set(rand(-60, 60), rand(8, 35), rand(-100, -40));
    scene.add(s);
    nightStars.push(s);
  }

  // Sun + Moon discs (day cycle drives position/visibility)
  const sunMesh = new THREE.Mesh(new THREE.SphereGeometry(3.2, 16, 16), MAT.sunMat);
  sunMesh.position.set(22, 24, -70);
  scene.add(sunMesh);

  const sunGlow = new THREE.Mesh(
    new THREE.SphereGeometry(4.6, 16, 16),
    new THREE.MeshBasicMaterial({ color: 0xffd66b, transparent: true, opacity: 0.28, depthWrite: false })
  );
  scene.add(sunGlow);

  const moonMesh = new THREE.Mesh(new THREE.SphereGeometry(2.6, 16, 16), MAT.moonMat);
  moonMesh.position.set(-24, 26, -70);
  moonMesh.visible = false;
  scene.add(moonMesh);

  // Crescent bite (small dark sphere offset — simple cute moon)
  const moonShade = new THREE.Mesh(new THREE.SphereGeometry(2.1, 16, 16), new THREE.MeshBasicMaterial({ color: 0x1a2744 }));
  moonShade.position.set(-23, 27, -69.5);
  moonShade.visible = false;
  scene.add(moonShade);

  // ---------------------------------------------------------
  // DAY / NIGHT CYCLE
  // sunrise → day → evening → sunset → night → sunrise …
  // ---------------------------------------------------------
  const DayNight = {
    // Full loop length in seconds (tuned so kids see a change mid-run)
    CYCLE: 100,
    t: 0.12, // start mid-morning so the first run looks bright
    /** Phase keyframes along t∈[0,1) */
    phases: [
      // name, t, sky, fog, sunLight, sunColor, ambient, sunY
      { name: "sunrise", t: 0.0,  sky: 0xffb37a, fog: 0xffc9a0, sunI: 0.75, sunC: 0xffb070, amb: 0.55, sunY: 10 },
      { name: "day",     t: 0.18, sky: 0x7ec8ff, fog: 0xb8e6ff, sunI: 1.15, sunC: 0xfff2cc, amb: 0.85, sunY: 28 },
      { name: "day2",    t: 0.42, sky: 0x6eb8f5, fog: 0xa8d4f5, sunI: 1.1,  sunC: 0xfff0c0, amb: 0.8,  sunY: 26 },
      { name: "evening", t: 0.58, sky: 0x9b7fd4, fog: 0xc4a8e8, sunI: 0.7,  sunC: 0xffc090, amb: 0.55, sunY: 16 },
      { name: "sunset",  t: 0.72, sky: 0xff7e5a, fog: 0xffa070, sunI: 0.55, sunC: 0xff8050, amb: 0.45, sunY: 8 },
      { name: "night",   t: 0.86, sky: 0x1a2744, fog: 0x2a3a5c, sunI: 0.28, sunC: 0x8899cc, amb: 0.42, sunY: 2 },
      { name: "night2",  t: 0.94, sky: 0x152038, fog: 0x243452, sunI: 0.25, sunC: 0x7788bb, amb: 0.4, sunY: 1 },
    ],

    /** Blend between surrounding keyframes. */
    sample(t) {
      const list = this.phases;
      // wrap
      let i = 0;
      for (let k = 0; k < list.length; k++) {
        if (list[k].t <= t) i = k;
      }
      const a = list[i];
      const b = list[(i + 1) % list.length];
      const span = (b.t > a.t ? b.t - a.t : 1 - a.t + b.t);
      const local = span <= 0 ? 0 : (t >= a.t ? (t - a.t) / span : (1 - a.t + t) / span);
      const u = local * local * (3 - 2 * local); // smoothstep
      return {
        sky: new THREE.Color(a.sky).lerp(new THREE.Color(b.sky), u),
        fog: new THREE.Color(a.fog).lerp(new THREE.Color(b.fog), u),
        sunI: lerp(a.sunI, b.sunI, u),
        sunC: new THREE.Color(a.sunC).lerp(new THREE.Color(b.sunC), u),
        amb: lerp(a.amb, b.amb, u),
        sunY: lerp(a.sunY, b.sunY, u),
        night: Math.max(0, lerp(a.sky === 0x1a2744 || a.name.startsWith("night") ? 1 : 0,
                                b.sky === 0x1a2744 || b.name.startsWith("night") ? 1 : 0, u)),
      };
    },

    update(dt) {
      this.t = (this.t + dt / this.CYCLE) % 1;
      const s = this.sample(this.t);

      // Sky + fog
      scene.background.copy(s.sky);
      scene.fog.color.copy(s.fog);

      // Lights
      sun.intensity = s.sunI;
      sun.color.copy(s.sunC);
      hemi.intensity = s.amb;
      hemi.color.copy(s.sky).lerp(new THREE.Color(0xffffff), 0.35);
      hemi.groundColor.set(s.night > 0.5 ? 0x223344 : 0x8fd96a);
      fill.intensity = s.amb * 0.4;

      // Sun / moon arc across the sky (behind the road, looking forward)
      const angle = this.t * Math.PI * 2 - Math.PI * 0.15;
      const sunX = Math.cos(angle) * 28;
      const sunY = 6 + Math.sin(angle) * 22;
      sunMesh.position.set(sunX, Math.max(sunY, -8), -70);
      sunGlow.position.copy(sunMesh.position);
      sun.position.set(sunX, Math.max(sunY, 4) + 8, 20);

      const isNight = s.night > 0.45;
      sunMesh.visible = !isNight && sunY > -4;
      sunGlow.visible = sunMesh.visible;
      moonMesh.visible = isNight || s.night > 0.25;
      moonShade.visible = moonMesh.visible;

      // Moon sits opposite the sun
      const mAngle = angle + Math.PI;
      const mx = Math.cos(mAngle) * 26;
      const my = 10 + Math.sin(mAngle) * 18;
      moonMesh.position.set(mx, my, -70);
      moonShade.position.set(mx + 1.1, my + 1.2, -69.4);

      // Stars twinkle in at night
      for (let i = 0; i < nightStars.length; i++) {
        const st = nightStars[i];
        st.material.opacity = s.night * (0.45 + 0.55 * Math.abs(Math.sin(this.t * 20 + i)));
      }

      // Clouds tint toward night
      MAT.cloud.color.setHex(isNight ? 0x8899bb : 0xffffff);
      MAT.cloud.opacity = isNight ? 0.55 : 0.92;

      // ---- Road lamps: warm pools of light at dusk/night ----
      // Glow strength ramps up as it gets darker
      const lampOn = clamp((s.night - 0.12) / 0.55, 0, 1);
      MAT.lampGlow.color.setHex(lampOn > 0.05 ? 0xffe08a : 0xfff6d0);
      MAT.lampGlow.opacity = 1;
      // Soft halo + ground pool
      MAT.lampGlowSoft.opacity = 0.15 + lampOn * 0.55;

      for (const lamp of lamps) {
        const u = lamp.userData.lamp;
        if (!u) continue;
        // Subtle flicker when lit
        const flicker = 1 + Math.sin(this.t * 18 + lamp.position.z) * 0.06;
        u.bulb.scale.setScalar(1 + lampOn * 0.15 * flicker);
        u.halo.scale.setScalar(1 + lampOn * 0.35);
        u.pool.material.opacity = lampOn * 0.42 * flicker;
        // Daytime: hide the bright pool so it doesn't look odd
        u.pool.visible = lampOn > 0.02;
      }

      // Player-side warm lights (always a little on at night)
      // Fixed near the play area so the road under the bunny stays readable
      const nightLightPower = 0.2 + s.night * 2.8;
      const lightPos = [
        [-5.2, 3.4, -2],
        [0, 4.0, -8],
        [5.2, 3.4, -2],
      ];
      for (let li = 0; li < nightLights.length; li++) {
        const pl = nightLights[li];
        pl.intensity = nightLightPower;
        pl.distance = 22;
        pl.decay = 1.6;
        pl.color.setHex(0xffd9a0);
        const p = lightPos[li] || lightPos[0];
        pl.position.set(p[0], p[1], p[2]);
      }

      return s; // pass night factor etc. to weather
    },
  };

  // ---------------------------------------------------------
  // WEATHER — rain & wind (soft, kid-friendly)
  // ---------------------------------------------------------
  const Weather = {
    rain: 0,      // 0..1 intensity
    wind: 0,      // 0..1 intensity
    targetRain: 0,
    targetWind: 0,
    retargetIn: 12,
    drops: [],
    leaves: [],

    init() {
      // Rain drop pool
      const dropGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.55, 3);
      for (let i = 0; i < 80; i++) {
        const m = new THREE.Mesh(dropGeo, MAT.rain);
        m.rotation.x = 0.25;
        m.visible = false;
        scene.add(m);
        this.drops.push({
          mesh: m,
          x: rand(-18, 18),
          y: rand(0, 18),
          z: rand(-40, 15),
          speed: rand(18, 28),
        });
      }
      // Wind-blown leaves
      const leafGeo = new THREE.PlaneGeometry(0.22, 0.14);
      for (let i = 0; i < 18; i++) {
        const m = new THREE.Mesh(leafGeo, MAT.leafFly);
        m.visible = false;
        scene.add(m);
        this.leaves.push({
          mesh: m,
          x: rand(-16, 16),
          y: rand(0.2, 4),
          z: rand(-30, 12),
          phase: Math.random() * 6.28,
          speed: rand(2, 5),
        });
      }
    },

    update(dt, worldSpeed) {
      // Occasional weather shifts
      this.retargetIn -= dt;
      if (this.retargetIn <= 0) {
        this.retargetIn = rand(16, 32);
        // Mostly clear; sometimes rain, sometimes wind, sometimes both
        const roll = Math.random();
        if (roll < 0.28) {
          this.targetRain = rand(0.35, 0.85);
          this.targetWind = rand(0, 0.35);
        } else if (roll < 0.55) {
          this.targetRain = 0;
          this.targetWind = rand(0.45, 1);
        } else if (roll < 0.7) {
          this.targetRain = rand(0.25, 0.55);
          this.targetWind = rand(0.4, 0.8);
        } else {
          this.targetRain = 0;
          this.targetWind = rand(0, 0.25);
        }
      }
      this.rain = lerp(this.rain, this.targetRain, 1 - Math.exp(-0.6 * dt));
      this.wind = lerp(this.wind, this.targetWind, 1 - Math.exp(-0.6 * dt));

      // Rain drops fall toward the camera-ish and recycle
      const rainOn = this.rain > 0.02;
      for (const d of this.drops) {
        d.mesh.visible = rainOn;
        if (!rainOn) continue;
        d.y -= d.speed * dt * (0.7 + this.rain * 0.6);
        d.z += worldSpeed * dt * 0.15;
        d.x += this.wind * 6 * dt;
        if (d.y < 0 || d.z > 18) {
          d.x = rand(-18, 18);
          d.y = rand(12, 20);
          d.z = rand(-35, 5);
        }
        d.mesh.position.set(d.x, d.y, d.z);
        d.mesh.material.opacity = 0.25 + this.rain * 0.4;
      }

      // Flying leaves when windy
      const windOn = this.wind > 0.05;
      for (const l of this.leaves) {
        l.mesh.visible = windOn;
        if (!windOn) continue;
        l.phase += dt * 4;
        l.x += (4 + this.wind * 14) * dt;
        l.y += Math.sin(l.phase) * dt * 1.2;
        l.z += worldSpeed * dt * 0.25;
        if (l.x > 18 || l.z > 16) {
          l.x = rand(-18, -8);
          l.y = rand(0.3, 3.5);
          l.z = rand(-30, 0);
        }
        l.mesh.position.set(l.x, l.y, l.z);
        l.mesh.rotation.z = l.phase;
        l.mesh.rotation.y = l.phase * 0.7;
        l.mesh.material.opacity = 0.5 + this.wind * 0.4;
      }

      // Sky mood when raining
      if (this.rain > 0.15) {
        const grey = new THREE.Color(0x8a9bb0);
        scene.background.lerp(grey, this.rain * 0.18 * dt * 3);
        scene.fog.color.lerp(grey, this.rain * 0.12 * dt * 3);
        sun.intensity *= 1 - this.rain * 0.25;
      }
    },

    /** Wind influence on trees / bunny ears. */
    swayBoost() {
      return 1 + this.wind * 2.8;
    },
  };

  Weather.init();

  // ---------------------------------------------------------
  // PLAYER — cute 3D bunny (rich parts for lively anim)
  // ---------------------------------------------------------
  function buildBunny() {
    const root = new THREE.Group();
    const bodyGroup = new THREE.Group();
    root.add(bodyGroup);

    // Body
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.72, 16, 14), MAT.bunny);
    body.scale.set(1, 1.1, 1.15);
    body.position.y = 0.95;
    body.castShadow = true;
    bodyGroup.add(body);

    // Belly
    const belly = new THREE.Mesh(new THREE.SphereGeometry(0.48, 12, 10), MAT.bunnyShade);
    belly.position.set(0, 0.85, 0.35);
    bodyGroup.add(belly);

    // Head group (can look around)
    const headGroup = new THREE.Group();
    headGroup.position.set(0, 1.85, 0.15);
    bodyGroup.add(headGroup);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.62, 16, 14), MAT.bunny);
    head.castShadow = true;
    headGroup.add(head);

    // Ears (separate so they can flop in the wind)
    const ears = [];
    for (const side of [-1, 1]) {
      const earGroup = new THREE.Group();
      earGroup.position.set(side * 0.28, 0.9, 0.05);
      const ear = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 10), MAT.bunny);
      ear.scale.set(1, 2.4, 0.7);
      ear.position.y = 0.15;
      ear.castShadow = true;
      const inner = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), MAT.bunnyPink);
      inner.scale.set(1, 2.1, 0.45);
      inner.position.set(0, 0.15, 0.12);
      earGroup.add(ear, inner);
      earGroup.rotation.z = side * -0.18;
      headGroup.add(earGroup);
      ears.push(earGroup);
    }

    // Eyes
    const eyes = [];
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 10), MAT.dark);
      eye.position.set(side * 0.22, 0.1, 0.5);
      headGroup.add(eye);
      const shine = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 6), MAT.white);
      shine.position.set(side * 0.25, 0.14, 0.58);
      headGroup.add(shine);
      eyes.push(eye);
    }

    // Cheeks
    for (const side of [-1, 1]) {
      const cheek = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), MAT.bunnyPink);
      cheek.position.set(side * 0.38, -0.1, 0.38);
      headGroup.add(cheek);
    }

    // Nose + smile
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), MAT.bunnyNose);
    nose.position.set(0, -0.07, 0.6);
    headGroup.add(nose);

    // Tail (wiggles)
    const tail = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 10), MAT.bunny);
    tail.position.set(0, 1.0, -0.75);
    bodyGroup.add(tail);

    // Feet
    const feet = [];
    for (const side of [-1, 1]) {
      const foot = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), MAT.bunny);
      foot.scale.set(1, 0.7, 1.3);
      foot.position.set(side * 0.35, 0.22, 0.15);
      foot.castShadow = true;
      root.add(foot);
      feet.push(foot);
    }

    // Arms
    const arms = [];
    for (const side of [-1, 1]) {
      const arm = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 8), MAT.bunny);
      arm.scale.set(0.8, 1.2, 0.8);
      arm.position.set(side * 0.72, 1.15, 0.2);
      root.add(arm);
      arms.push(arm);
    }

    return { root, bodyGroup, headGroup, body, head, feet, arms, ears, eyes, tail, earL: ears[0], earR: ears[1] };
  }

  const bunny = buildBunny();
  bunny.root.position.set(0, 0, CONFIG.PLAYER_Z);
  scene.add(bunny.root);

  // Soft blob shadow under bunny
  const blob = new THREE.Mesh(
    new THREE.CircleGeometry(0.85, 20),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.18, depthWrite: false })
  );
  blob.rotation.x = -Math.PI / 2;
  blob.position.y = 0.04;
  scene.add(blob);

  // ---------------------------------------------------------
  // OBSTACLE + COLLECTIBLE MODELS
  // ---------------------------------------------------------
  function buildPuddle() {
    const g = new THREE.Group();
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(1.35, 1.35, 0.12, 20), MAT.puddle);
    disc.position.y = 0.08;
    disc.receiveShadow = true;
    g.add(disc);
    const shine = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 8), MAT.white);
    shine.scale.set(1.4, 0.15, 0.7);
    shine.position.set(-0.35, 0.16, 0.1);
    g.add(shine);
    return g;
  }

  function buildBlock() {
    const g = new THREE.Group();
    const mats = [MAT.blockRed, MAT.blockYellow, MAT.blockBlue];
    const box = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.6, 1.4), pick(mats));
    box.position.y = 0.85;
    box.castShadow = true;
    box.receiveShadow = true;
    g.add(box);
    // Simple face
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.08), MAT.white);
      eye.position.set(side * 0.32, 1.1, 0.72);
      g.add(eye);
      const pupil = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.08), MAT.dark);
      pupil.position.set(side * 0.32, 1.1, 0.78);
      g.add(pupil);
    }
    return g;
  }

  function buildBalloonArch() {
    const g = new THREE.Group();
    // Crossbar
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 3.2, 6), MAT.trunk);
    bar.rotation.z = Math.PI / 2;
    bar.position.y = 2.55;
    g.add(bar);
    // Posts
    for (const side of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 2.55, 6), MAT.trunk);
      post.position.set(side * 1.55, 1.27, 0);
      g.add(post);
    }
    // Balloons
    const colors = [MAT.balloon, MAT.balloon2, MAT.balloon3, MAT.balloon, MAT.balloon2];
    for (let i = 0; i < 5; i++) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 12), colors[i]);
      b.position.set(-1.3 + i * 0.65, 2.95, 0);
      b.castShadow = true;
      g.add(b);
    }
    return g;
  }

  function buildCart() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.3, 1.6), MAT.cart);
    body.position.y = 1.0;
    body.castShadow = true;
    g.add(body);
    // Awning
    const awning = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.35, 1.9), MAT.blockYellow);
    awning.position.y = 1.85;
    g.add(awning);
    // Wheels
    for (const x of [-0.75, 0.75]) {
      for (const z of [-0.55, 0.55]) {
        const w = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.22, 10), MAT.cartDark);
        w.rotation.x = Math.PI / 2;
        w.position.set(x, 0.32, z);
        g.add(w);
      }
    }
    // Scoop
    const scoop = new THREE.Mesh(new THREE.SphereGeometry(0.4, 10, 10), MAT.balloon3);
    scoop.position.set(0, 1.45, 0.4);
    g.add(scoop);
    return g;
  }

  function buildStar() {
    const g = new THREE.Group();
    // 5-point star from a thin cylinder stack look: use octahedron + ring
    const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.55, 0), MAT.star);
    core.castShadow = true;
    g.add(core);
    for (let i = 0; i < 5; i++) {
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.45, 5), MAT.star);
      const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
      tip.position.set(Math.cos(a) * 0.55, Math.sin(a) * 0.55, 0);
      tip.rotation.z = a - Math.PI / 2;
      g.add(tip);
    }
    return g;
  }

  function buildHeart() {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: 0xff6b9d, emissive: 0x882244, emissiveIntensity: 0.25 });
    const left = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 10), mat);
    const right = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 10), mat);
    left.position.set(-0.22, 0.12, 0);
    right.position.set(0.22, 0.12, 0);
    const bot = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.55, 10), mat);
    bot.rotation.x = Math.PI;
    bot.position.y = -0.22;
    g.add(left, right, bot);
    return g;
  }

  // ---------------------------------------------------------
  // LEARNING OBJECTS — familiar things toddlers know
  // Collecting one shows the word + spelling and says it aloud.
  // ---------------------------------------------------------
  const LEARN_OBJECTS = [
    { id: "cat", name: "Kucing", spell: "K-U-C-I-N-G", say: "Kucing", color: 0xffb347 },
    { id: "dog", name: "Anjing", spell: "A-N-J-I-N-G", say: "Anjing", color: 0xc4a574 },
    { id: "milk", name: "Susu", spell: "S-U-S-U", say: "Susu", color: 0xffffff },
    { id: "banana", name: "Pisang", spell: "P-I-S-A-N-G", say: "Pisang", color: 0xffe566 },
    { id: "apple", name: "Apel", spell: "A-P-E-L", say: "Apel", color: 0xff6b6b },
    { id: "ball", name: "Bola", spell: "B-O-L-A", say: "Bola", color: 0x7bdff2 },
    { id: "duck", name: "Bebek", spell: "B-E-B-E-K", say: "Bebek", color: 0xffd60a },
    { id: "teddy", name: "Boneka", spell: "B-O-N-E-K-A", say: "Boneka", color: 0xd4a574 },
    { id: "car", name: "Mobil", spell: "M-O-B-I-L", say: "Mobil", color: 0xff6b6b },
    { id: "chair", name: "Kursi", spell: "K-U-R-S-I", say: "Kursi", color: 0xc4a574 },
    { id: "cup", name: "Gelas", spell: "G-E-L-A-S", say: "Gelas", color: 0x7bdff2 },
    { id: "book", name: "Buku", spell: "B-U-K-U", say: "Buku", color: 0x8fd96a },
    { id: "shoe", name: "Sepatu", spell: "S-E-P-A-T-U", say: "Sepatu", color: 0xff8fab },
    { id: "star", name: "Bintang", spell: "B-I-N-T-A-N-G", say: "Bintang", color: 0xffd60a },
    { id: "heart", name: "Hati", spell: "H-A-T-I", say: "Hati", color: 0xff6b9d },
    { id: "baby", name: "Bayi", spell: "B-A-Y-I", say: "Bayi", color: 0xffc2d1 },
    { id: "teddybear", name: "Boneka Beruang", spell: "B-O-N-E-K-A", say: "Boneka beruang", color: 0xd4a574 },
    { id: "milk_bottle", name: "Botol Susu", spell: "B-O-T-O-L", say: "Botol susu", color: 0xffffff },
  ];

  function buildLearnObject(id) {
    // Alias longer learning names to the same cute mesh
    const alias = { teddybear: "teddy", milk_bottle: "milk" };
    const key = alias[id] || id;
    const g = new THREE.Group();
    const M = (color, opts = {}) =>
      new THREE.MeshLambertMaterial({ color, ...opts });
    const S = (geo, mat, x = 0, y = 0, z = 0) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      m.castShadow = true;
      g.add(m);
      return m;
    };

    if (key === "cat") {
      const body = M(0xffb347);
      S(new THREE.SphereGeometry(0.38, 12, 12), body, 0, 0.35, 0);
      S(new THREE.SphereGeometry(0.28, 12, 12), body, 0, 0.72, 0.12);
      // ears
      S(new THREE.ConeGeometry(0.1, 0.18, 6), body, -0.16, 0.95, 0.1);
      S(new THREE.ConeGeometry(0.1, 0.18, 6), body, 0.16, 0.95, 0.1);
      // face
      S(new THREE.SphereGeometry(0.05, 6, 6), MAT.dark, -0.1, 0.75, 0.32);
      S(new THREE.SphereGeometry(0.05, 6, 6), MAT.dark, 0.1, 0.75, 0.32);
      S(new THREE.SphereGeometry(0.04, 6, 6), MAT.bunnyNose, 0, 0.68, 0.36);
      // tail
      const tail = S(new THREE.CylinderGeometry(0.05, 0.07, 0.45, 6), body, 0, 0.4, -0.38);
      tail.rotation.x = 0.7;
    } else if (key === "dog") {
      const body = M(0xc4a574);
      S(new THREE.SphereGeometry(0.4, 12, 12), body, 0, 0.38, 0);
      S(new THREE.SphereGeometry(0.3, 12, 12), body, 0, 0.78, 0.14);
      S(new THREE.SphereGeometry(0.12, 8, 8), body, -0.28, 0.85, 0.18);
      S(new THREE.SphereGeometry(0.12, 8, 8), body, 0.28, 0.85, 0.18);
      S(new THREE.SphereGeometry(0.06, 6, 6), MAT.dark, -0.1, 0.8, 0.36);
      S(new THREE.SphereGeometry(0.06, 6, 6), MAT.dark, 0.1, 0.8, 0.36);
      S(new THREE.SphereGeometry(0.08, 8, 8), MAT.dark, 0, 0.7, 0.38);
      S(new THREE.CylinderGeometry(0.05, 0.06, 0.35, 6), body, 0, 0.45, -0.4).rotation.x = 1;
    } else if (key === "milk") {
      const bottle = M(0xf5f5f5);
      S(new THREE.CylinderGeometry(0.22, 0.28, 0.7, 12), bottle, 0, 0.4, 0);
      S(new THREE.CylinderGeometry(0.12, 0.14, 0.22, 10), bottle, 0, 0.85, 0);
      S(new THREE.CylinderGeometry(0.14, 0.14, 0.1, 10), M(0xff8fab), 0, 1.0, 0);
      S(new THREE.CylinderGeometry(0.285, 0.285, 0.28, 12), M(0x7ec8ff), 0, 0.42, 0);
    } else if (key === "banana") {
      const mat = M(0xffe566);
      const b = S(new THREE.TorusGeometry(0.32, 0.12, 8, 12, Math.PI), mat, 0, 0.35, 0);
      b.rotation.z = Math.PI / 2;
      b.rotation.y = 0.3;
      S(new THREE.CylinderGeometry(0.05, 0.05, 0.12, 6), M(0x8b6914), -0.32, 0.48, 0.1);
    } else if (key === "apple") {
      S(new THREE.SphereGeometry(0.32, 12, 12), M(0xff6b6b), 0, 0.35, 0);
      S(new THREE.CylinderGeometry(0.03, 0.03, 0.16, 6), M(0x6b4423), 0, 0.7, 0);
      S(new THREE.SphereGeometry(0.1, 6, 6), M(0x6bc04a), 0.1, 0.72, 0);
    } else if (key === "ball") {
      S(new THREE.SphereGeometry(0.36, 14, 14), M(0x7bdff2), 0, 0.38, 0);
      S(new THREE.TorusGeometry(0.36, 0.04, 6, 20), M(0xffffff), 0, 0.38, 0);
      S(new THREE.TorusGeometry(0.36, 0.04, 6, 20), M(0xffffff), 0, 0.38, 0).rotation.y = Math.PI / 2;
    } else if (key === "duck") {
      const yellow = M(0xffd60a);
      S(new THREE.SphereGeometry(0.32, 12, 12), yellow, 0, 0.35, 0);
      S(new THREE.SphereGeometry(0.22, 12, 12), yellow, 0, 0.68, 0.12);
      S(new THREE.SphereGeometry(0.05, 6, 6), MAT.dark, -0.08, 0.72, 0.28);
      S(new THREE.SphereGeometry(0.05, 6, 6), MAT.dark, 0.08, 0.72, 0.28);
      S(new THREE.ConeGeometry(0.08, 0.18, 6), M(0xff8c00), 0, 0.65, 0.34).rotation.x = Math.PI / 2;
    } else if (key === "teddy") {
      const fur = M(0xd4a574);
      S(new THREE.SphereGeometry(0.36, 12, 12), fur, 0, 0.38, 0);
      S(new THREE.SphereGeometry(0.28, 12, 12), fur, 0, 0.78, 0.08);
      S(new THREE.SphereGeometry(0.1, 8, 8), fur, -0.22, 0.98, 0.05);
      S(new THREE.SphereGeometry(0.1, 8, 8), fur, 0.22, 0.98, 0.05);
      S(new THREE.SphereGeometry(0.08, 8, 8), M(0xf0c8a0), 0, 0.72, 0.28);
      S(new THREE.SphereGeometry(0.05, 6, 6), MAT.dark, -0.1, 0.82, 0.28);
      S(new THREE.SphereGeometry(0.05, 6, 6), MAT.dark, 0.1, 0.82, 0.28);
      S(new THREE.SphereGeometry(0.12, 8, 8), fur, -0.38, 0.4, 0.1);
      S(new THREE.SphereGeometry(0.12, 8, 8), fur, 0.38, 0.4, 0.1);
    } else if (key === "car") {
      S(new THREE.BoxGeometry(0.7, 0.28, 0.38), M(0xff6b6b), 0, 0.28, 0);
      S(new THREE.BoxGeometry(0.4, 0.22, 0.32), M(0x7bdff2), 0, 0.5, -0.02);
      for (const x of [-0.24, 0.24]) {
        S(new THREE.CylinderGeometry(0.12, 0.12, 0.1, 10), MAT.dark, x, 0.14, 0.18).rotation.x = Math.PI / 2;
        S(new THREE.CylinderGeometry(0.12, 0.12, 0.1, 10), MAT.dark, x, 0.14, -0.18).rotation.x = Math.PI / 2;
      }
    } else if (key === "chair") {
      S(new THREE.BoxGeometry(0.55, 0.1, 0.5), M(0xc4a574), 0, 0.42, 0);
      S(new THREE.BoxGeometry(0.55, 0.55, 0.1), M(0xc4a574), 0, 0.7, -0.22);
      for (const x of [-0.2, 0.2]) {
        for (const z of [-0.18, 0.18]) {
          S(new THREE.CylinderGeometry(0.04, 0.04, 0.42, 6), M(0xa8845c), x, 0.21, z);
        }
      }
    } else if (key === "cup") {
      S(new THREE.CylinderGeometry(0.22, 0.18, 0.38, 12), M(0x7bdff2), 0, 0.25, 0);
      const handle = S(new THREE.TorusGeometry(0.1, 0.035, 6, 12), M(0x7bdff2), 0.26, 0.28, 0);
      handle.rotation.y = Math.PI / 2;
      S(new THREE.CylinderGeometry(0.18, 0.18, 0.04, 12), M(0xffffff), 0, 0.45, 0);
    } else if (key === "book") {
      S(new THREE.BoxGeometry(0.45, 0.08, 0.55), M(0x8fd96a), 0, 0.15, 0);
      S(new THREE.BoxGeometry(0.42, 0.06, 0.5), M(0xfff6e8), 0, 0.22, 0);
      S(new THREE.BoxGeometry(0.45, 0.08, 0.08), M(0x6bc04a), 0, 0.15, -0.24);
    } else if (key === "shoe") {
      S(new THREE.BoxGeometry(0.55, 0.18, 0.28), M(0xff8fab), 0, 0.15, 0);
      S(new THREE.BoxGeometry(0.28, 0.28, 0.28), M(0xff8fab), -0.12, 0.28, 0);
      S(new THREE.BoxGeometry(0.55, 0.08, 0.3), M(0xffffff), 0, 0.06, 0);
    } else if (key === "baby") {
      const skin = M(0xffc2d1);
      S(new THREE.SphereGeometry(0.28, 12, 12), skin, 0, 0.55, 0);
      S(new THREE.SphereGeometry(0.32, 12, 12), M(0xfff6e8), 0, 0.28, 0);
      S(new THREE.SphereGeometry(0.05, 6, 6), MAT.dark, -0.1, 0.58, 0.24);
      S(new THREE.SphereGeometry(0.05, 6, 6), MAT.dark, 0.1, 0.58, 0.24);
      S(new THREE.SphereGeometry(0.1, 8, 8), M(0xffe0a0), 0, 0.85, 0);
    } else {
      // star fallback
      return buildStar();
    }
    return g;
  }

  // ---------------------------------------------------------
  // SPEECH — say the object name (Web Speech API, no files)
  // ---------------------------------------------------------
  const Speak = {
    enabled: true,
    /** Only one name at a time — never cut a word off mid-say. */
    busy: false,
    say(text, force = false) {
      if (!this.enabled || !window.speechSynthesis || !text) return;
      // Something is already speaking → stay silent (no cancel, no queue spam)
      if (this.busy || window.speechSynthesis.speaking || window.speechSynthesis.pending) {
        return;
      }
      try {
        this.busy = true;
        const u = new SpeechSynthesisUtterance(text);
        u.rate = 0.85;
        u.pitch = 1.3;
        u.volume = 1;
        const voices = window.speechSynthesis.getVoices();
        const v =
          voices.find((x) => /en(-|_)?(US|GB)/i.test(x.lang) && /female|woman|girl|zira|samantha|google/i.test(x.name)) ||
          voices.find((x) => /^en/i.test(x.lang));
        if (v) u.voice = v;
        u.onend = () => { this.busy = false; };
        u.onerror = () => { this.busy = false; };
        window.speechSynthesis.speak(u);
      } catch (_) {
        this.busy = false;
      }
    },
    /** Say only the full object name — no spelling. */
    sayObject(obj) {
      const name = (obj && (obj.say || obj.name)) || "";
      if (name) this.say(name);
    },
  };
  // Chrome loads voices async
  if (window.speechSynthesis) {
    window.speechSynthesis.getVoices();
    window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
  }

  // ---------------------------------------------------------
  // LEARN POPUP + CHEER (every 10 points)
  // ---------------------------------------------------------
  const UI = {
    showLearn(obj) {
      const elp = document.getElementById("learn-popup");
      elp.querySelector(".word").textContent = obj.name + "!";
      elp.querySelector(".spell").textContent = obj.spell;
      elp.classList.remove("show");
      void elp.offsetWidth;
      elp.classList.add("show");
      Speak.sayObject(obj);
    },
    showCheer(itemCount) {
      const elc = document.getElementById("cheer-popup");
      const words = ["YAY!", "WOW!", "GOOD JOB!", "AMAZING!", "SUPER!", "HOORAY!"];
      elc.querySelector(".cheer-word").textContent = pick(words);
      elc.querySelector(".cheer-sub").textContent = `${Math.floor(itemCount)} items! Keep going!`;
      elc.classList.remove("show");
      void elc.offsetWidth;
      elc.classList.add("show");
      AudioFX.coin();
      setTimeout(() => AudioFX.coin(), 90);
      setTimeout(() => {
        [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => window.__blip(f), i * 70));
      }, 120);
      Speak.say(pick([
        `Yay! ${Math.floor(itemCount)} items!`,
        `Wow! Great job!`,
        `Amazing! Keep going!`,
        `Good job! You found ${Math.floor(itemCount)} things!`,
      ]), true);
    },
  };

  // tiny helper blip
  window.__blip = (freq) => {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      const ctx = window.__ac || (window.__ac = new AC());
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = freq;
      g.gain.value = 0.12;
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
      o.connect(g);
      g.connect(ctx.destination);
      o.start();
      o.stop(ctx.currentTime + 0.13);
    } catch (_) {}
  };

  // ---------------------------------------------------------
  // ENTITY POOLS
  // ---------------------------------------------------------
  /** @type {{mesh:THREE.Group, type:string, z:number, lane:number, passed:boolean, alive:boolean}[]} */
  let obstacles = [];
  /** @type {{mesh:THREE.Group, kind:string, z:number, lane:number, phase:number, alive:boolean}[]} */
  let collectibles = [];
  /** @type {{mesh:THREE.Mesh, vx:number, vy:number, vz:number, life:number, max:number}[]} */
  let particles = [];

  /**
   * Visual language for toddlers:
   *  PICKUPS  = float, spin, green/gold glow ring, sparkles
   *  OBSTACLES = sit on the ground, no float
   */
  function decoratePickup(group) {
    // Soft green pedestal ring
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.85, 1.15, 28), MAT.pickupRing);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = -0.05;
    group.add(ring);

    const inner = new THREE.Mesh(new THREE.CircleGeometry(0.75, 24), MAT.pickupRingInner);
    inner.rotation.x = -Math.PI / 2;
    inner.position.y = -0.04;
    group.add(inner);

    // A few floating sparkles
    for (let i = 0; i < 4; i++) {
      const sp = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 6), MAT.pickupSpark);
      const a = (i / 4) * Math.PI * 2;
      sp.position.set(Math.cos(a) * 1.15, 0.55 + (i % 2) * 0.35, Math.sin(a) * 1.15);
      sp.userData.sparkle = true;
      sp.userData.sparkPhase = a;
      group.add(sp);
    }

    // Cheerful glow orb behind the object
    const glow = new THREE.Mesh(
      new THREE.SphereGeometry(1.05, 12, 12),
      new THREE.MeshBasicMaterial({ color: 0xb8ffc8, transparent: true, opacity: 0.18, depthWrite: false })
    );
    glow.position.y = 0.7;
    group.add(glow);
    return group;
  }

  function decorateObstacle(group) {
    // Short posts / bars so it reads as a blocker
    for (const side of [-1, 1]) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.35, 0.12), MAT.warnRing);
      bar.position.set(side * 1.15, 0.2, 0);
      group.add(bar);
    }
    return group;
  }

  function spawnObstacle() {
    const lane = (Math.random() * 3) | 0;
    const roll = Math.random();
    let type;
    if (roll < 0.28) type = "puddle";
    else if (roll < 0.52) type = "block";
    else if (roll < 0.76) type = "balloon";
    else type = "cart";

    let mesh;
    if (type === "puddle") mesh = buildPuddle();
    else if (type === "block") mesh = buildBlock();
    else if (type === "balloon") mesh = buildBalloonArch();
    else mesh = buildCart();

    decorateObstacle(mesh);
    mesh.position.set(CONFIG.LANE_X[lane], 0, CONFIG.SPAWN_Z);
    scene.add(mesh);
    obstacles.push({ mesh, type, z: CONFIG.SPAWN_Z, lane, passed: false, alive: true });
  }

  function spawnCollectible(lane, z, kind = "learn") {
    // Only named learning objects — no stars
    let obj;
    let mesh;
    if (kind && kind !== "learn" && kind !== "star" && kind !== "heart") {
      obj = LEARN_OBJECTS.find((o) => o.id === kind) || pick(LEARN_OBJECTS.filter((o) => o.id !== "star" && o.id !== "heart"));
      mesh = buildLearnObject(obj.id);
    } else {
      obj = pick(LEARN_OBJECTS.filter((o) => o.id !== "star" && o.id !== "heart"));
      mesh = buildLearnObject(obj.id);
    }

    decoratePickup(mesh);
    mesh.position.set(CONFIG.LANE_X[lane], CONFIG.ITEM_BASE_Y, z);
    mesh.scale.setScalar(CONFIG.ITEM_SCALE);
    scene.add(mesh);
    collectibles.push({
      mesh,
      kind: obj.id,
      z,
      lane,
      phase: Math.random() * 6.28,
      alive: true,
      learn: obj,
    });
  }

  /** Pick a random everyday learning object id. */
  function randomLearnId() {
    const pool = LEARN_OBJECTS.filter((o) => o.id !== "heart" && o.id !== "star");
    return pick(pool).id;
  }

  function burst(x, y, z, colorHex, count = 10, speed = 1) {
    for (let i = 0; i < count; i++) {
      const m = new THREE.Mesh(
        new THREE.SphereGeometry(rand(0.08, 0.2), 6, 6),
        new THREE.MeshBasicMaterial({ color: colorHex, transparent: true, opacity: 0.9 })
      );
      m.position.set(x, y, z);
      scene.add(m);
      particles.push({
        mesh: m,
        vx: rand(-3, 3) * speed, vy: rand(2, 7) * speed, vz: rand(-2, 2) * speed,
        life: rand(0.35, 0.8), max: 0.8,
        gravity: 10,
      });
    }
  }

  /** Squashy comic droplets / confetti with optional upward float. */
  function spray(x, y, z, colorHex, opts = {}) {
    const count = opts.count || 14;
    const up = opts.up ?? 1;
    const flat = opts.flat ?? false;
    const scale = opts.scale ?? 1;
    for (let i = 0; i < count; i++) {
      const m = new THREE.Mesh(
        flat
          ? new THREE.BoxGeometry(rand(0.12, 0.28) * scale, rand(0.08, 0.16) * scale, rand(0.12, 0.28) * scale)
          : new THREE.SphereGeometry(rand(0.1, 0.22) * scale, 6, 6),
        new THREE.MeshBasicMaterial({ color: colorHex, transparent: true, opacity: 0.95 })
      );
      m.position.set(x + rand(-0.4, 0.4) * scale, y + rand(-0.2, 0.6) * scale, z + rand(-0.3, 0.3) * scale);
      scene.add(m);
      particles.push({
        mesh: m,
        vx: rand(-5, 5) * (0.55 + 0.45 * scale), vy: rand(1, 8) * up * (0.55 + 0.45 * scale), vz: rand(-3, 3) * (0.55 + 0.45 * scale),
        life: rand(0.45, 0.95), max: 0.95,
        gravity: opts.gravity ?? 12,
        spin: rand(-8, 8),
      });
    }
  }

  // ---------------------------------------------------------
  // HIT FX — funny, obstacle-specific reactions
  // ---------------------------------------------------------
  /**
   * Each obstacle type gets its own slapstick routine:
   *  puddle  → slip, spin, splash, "SPLAT!"
   *  block   → trip & faceplant, dizzy stars, "BONK!"
   *  balloon → float up tangled, balloon confetti, "WHEEE!"
   *  cart    → big squash-bonk, POW burst, "POW!"
   */
  const HitFX = {
    active: false,
    type: null,
    timer: 0,
    duration: 0,
    // pose params driven during the reaction
    spin: 0,
    spinVel: 0,
    bounceY: 0,
    bounceVel: 0,
    tilt: 0,
    floatUp: 0,
    squashPulse: 0,
    shake: 0,
    dizzy: 0,

    reset() {
      this.active = false;
      this.type = null;
      this.timer = 0;
      this.spin = 0;
      this.spinVel = 0;
      this.bounceY = 0;
      this.bounceVel = 0;
      this.tilt = 0;
      this.floatUp = 0;
      this.squashPulse = 0;
      this.shake = 0;
      this.dizzy = 0;
    },

    /** Fire a reaction. `obstacleType` drives the look. */
    trigger(obstacleType) {
      this.active = true;
      this.type = obstacleType;
      this.timer = 0;
      this.shake = 1;
      this.dizzy = 1;

      const px = player.x, py = player.y + 1.1, pz = CONFIG.PLAYER_Z;
      const popup = document.getElementById("hit-popup");
      const flash = document.getElementById("hit-flash");

      // Reset popup animation
      popup.classList.remove("show", "fx-puddle", "fx-block", "fx-balloon", "fx-cart");
      void popup.offsetWidth; // reflow so animation restarts

      if (obstacleType === "puddle") {
        // Slip on the puddle: spin + blue splash
        this.duration = 0.95;
        this.spinVel = rand(9, 12) * (Math.random() < 0.5 ? 1 : -1);
        this.tilt = 0.85;
        this.bounceVel = 2.2;
        spray(px, 0.25, pz, 0x7ec8ff, { count: 18, up: 1.4, flat: true, gravity: 16 });
        spray(px, 0.2, pz, 0xb8e6ff, { count: 10, up: 2.2, gravity: 14 });
        popup.textContent = pick(["SPLAT!", "WHOOPS!", "SPLOOSH!"]);
        popup.classList.add("show", "fx-puddle");
        flash.style.background = "rgba(120,200,255,0.55)";
        AudioFX.splat();
      } else if (obstacleType === "block") {
        // Trip over the block: forward faceplant + dizzy stars
        this.duration = 1.05;
        this.spinVel = rand(-7, -4); // topple forward
        this.tilt = 1.15;
        this.bounceVel = 3.2;
        spray(px, py + 0.6, pz, 0xffd66b, { count: 12, up: 1.2 });
        spray(px, py + 0.8, pz, 0xff8fab, { count: 8, up: 1.5 });
        popup.textContent = pick(["BONK!", "OOPS!", "TRIP!"]);
        popup.classList.add("show", "fx-block");
        flash.style.background = "rgba(255,210,100,0.5)";
        AudioFX.bonk();
      } else if (obstacleType === "balloon") {
        // Tangled in balloons: one smooth float arc (no spin, no jitter)
        this.duration = 1.2;
        this.floatUp = 1.15;
        this.spinVel = 0;
        this.tilt = 0.12;
        this.bounceVel = 0;
        // Small balloon-pop confetti (kept subtle so it never covers the bunny)
        spray(px, py + 1.1, pz, 0xff6b9d, { count: 5, up: 0.5, gravity: 2, scale: 0.4 });
        spray(px, py + 1.25, pz, 0xffd60a, { count: 4, up: 0.45, gravity: 2, scale: 0.4 });
        spray(px, py + 1.15, pz, 0x7bdff2, { count: 4, up: 0.55, gravity: 2, scale: 0.4 });
        popup.textContent = pick(["WHEEE!", "POP!", "UH-OH!"]);
        popup.classList.add("show", "fx-balloon");
        flash.style.background = "rgba(255,150,200,0.5)";
        AudioFX.wheee();
      } else {
        // Cart: squash bonk, hard shake, POW
        this.duration = 0.9;
        this.spinVel = rand(-10, -6);
        this.tilt = 1.35;
        this.bounceVel = 4.5;
        this.squashPulse = 1;
        spray(px, py + 0.4, pz, 0xff8a6b, { count: 16, up: 1.6, speed: 1.3 });
        spray(px, py + 0.5, pz, 0xffd66b, { count: 10, up: 2.0 });
        // Big comic ring
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(1.1, 0.12, 8, 20),
          new THREE.MeshBasicMaterial({ color: 0xff5533, transparent: true, opacity: 0.85 })
        );
        ring.position.set(px, py + 0.5, pz);
        scene.add(ring);
        particles.push({
          mesh: ring, vx: 0, vy: 1.5, vz: 2,
          life: 0.45, max: 0.45, gravity: 0, spin: 6,
          grow: 2.2,
        });
        popup.textContent = pick(["POW!", "BAM!", "CRASH!"]);
        popup.classList.add("show", "fx-cart");
        flash.style.background = "rgba(255,120,80,0.55)";
        AudioFX.pow();
      }

      flash.style.opacity = "1";
      // Fade the flash
      setTimeout(() => {
        flash.style.transition = "opacity 0.35s ease";
        flash.style.opacity = "0";
        setTimeout(() => { flash.style.transition = ""; }, 400);
      }, 60);
    },

    /** Advance timers; returns true while a reaction is playing. */
    update(dt) {
      if (!this.active) return false;
      this.timer += dt;

      // Spin settles back
      this.spin += this.spinVel * dt;
      this.spinVel *= Math.exp(-2.2 * dt);

      // Bounce / hop
      this.bounceVel -= 14 * dt;
      this.bounceY += this.bounceVel * dt;
      if (this.bounceY < 0) {
        this.bounceY = 0;
        this.bounceVel *= -0.35; // silly little rebounds
        if (Math.abs(this.bounceVel) < 0.4) this.bounceVel = 0;
      }

      // Balloon float — smooth sine arc handled in applyPose (no jitter here)
      if (this.type === "balloon") {
        this.floatUp *= Math.exp(-0.8 * dt);
      }

      // Squash pulse (cart)
      this.squashPulse *= Math.exp(-4 * dt);

      // Shake + dizzy decay
      this.shake *= Math.exp(-3.5 * dt);
      this.dizzy *= Math.exp(-1.6 * dt);

      if (this.timer >= this.duration) {
        // Soft land
        this.active = false;
        this.spin *= 0.2;
        player.squash = this.type === "balloon" ? 0.55 : 1.2;
        return false;
      }
      return true;
    },

    /** Overlay pose onto the bunny after normal run anim. */
    applyPose(dt) {
      if (!this.active) return;

      const t = this.timer / this.duration;
      const easeOut = 1 - t * t;

      // Funny tumble / tilt
      bunny.root.rotation.z = this.spin * 0.35 * easeOut + Math.sin(this.timer * 20) * 0.08 * this.dizzy;
      bunny.root.rotation.x = this.tilt * easeOut * (this.type === "block" || this.type === "cart" ? 1 : 0.35);
      bunny.root.rotation.y = this.spin * 0.15 * easeOut;

      // Hop / float — balloon uses a full smooth sine arc (0 → peak → 0)
      let floatY = 0;
      if (this.type === "balloon") {
        const u = Math.min(1, Math.max(0, t));
        floatY = Math.sin(u * Math.PI) * this.floatUp;
      }
      bunny.root.position.y = player.y + this.bounceY + floatY;

      // Squash-stretch comedy
      const sq = 1 + this.squashPulse * 0.55 * Math.sin(this.timer * 28);
      const flatten = this.type === "cart" ? 1 - 0.35 * this.squashPulse * easeOut : 1;
      bunny.root.scale.set(
        (1 / Math.sqrt(sq)) * (1 + this.squashPulse * 0.4 * easeOut),
        sq * flatten,
        (1 / Math.sqrt(sq)) * (1 + this.squashPulse * 0.25 * easeOut)
      );

      // Arms flail
      if (bunny.arms) {
        const flail = Math.sin(this.timer * 18) * 1.2 * easeOut;
        bunny.arms[0].rotation.x = flail;
        bunny.arms[1].rotation.x = -flail;
        bunny.arms[0].rotation.z = 0.6 * easeOut;
        bunny.arms[1].rotation.z = -0.6 * easeOut;
      }
    },
  };

  /** Orbiting cartoon dizzy stars above the bunny's head. */
  const dizzyStars = [];
  for (let i = 0; i < 5; i++) {
    const s = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.18, 0),
      new THREE.MeshBasicMaterial({ color: 0xffe566, transparent: true, opacity: 0 })
    );
    scene.add(s);
    dizzyStars.push(s);
  }
  function updateDizzyStars(dt) {
    const strength = HitFX.dizzy;
    for (let i = 0; i < dizzyStars.length; i++) {
      const s = dizzyStars[i];
      if (strength < 0.02) {
        s.material.opacity = 0;
        continue;
      }
      const angle = HitFX.timer * 7 + (i / dizzyStars.length) * Math.PI * 2;
      const r = 0.95 + Math.sin(HitFX.timer * 4 + i) * 0.12;
      s.position.set(
        player.x + Math.cos(angle) * r,
        player.y + 2.55 + Math.sin(HitFX.timer * 3 + i) * 0.15 + (HitFX.bounceY || 0),
        CONFIG.PLAYER_Z + Math.sin(angle) * r * 0.55
      );
      s.rotation.y += dt * 6;
      s.rotation.z += dt * 3;
      s.material.opacity = strength * 0.95;
      s.scale.setScalar(0.7 + strength * 0.5);
    }
  }

  // ---------------------------------------------------------
  // PLAYER STATE + PHYSICS
  // ---------------------------------------------------------
  const player = {
    lane: 1,
    x: 0,
    y: 0,
    vy: 0,
    jumping: false,
    sliding: false,
    slideTimer: 0,
    invuln: 0,
    anim: 0,
    squash: 1,
  };

  function resetPlayer() {
    player.lane = 1;
    player.x = 0;
    player.y = 0;
    player.vy = 0;
    player.jumping = false;
    player.sliding = false;
    player.slideTimer = 0;
    player.invuln = 0;
    player.squash = 1;
    HitFX.reset();
    bunny.root.position.set(0, 0, CONFIG.PLAYER_Z);
    bunny.root.rotation.set(0, 0, 0);
    bunny.root.scale.set(1, 1, 1);
  }

  function clearsObstacle(type) {
    if (type === "balloon") return player.sliding;
    const need = CONFIG.JUMP_CLEAR[type];
    if (need == null) return false;
    if (need >= 9999) return false;
    return player.y >= need - 0.08;
  }

  function hitsPlayer(type, x, z) {
    // World-space contact band only — far objects NEVER hit
    if (z < CONFIG.PLAYER_Z - CONFIG.Z_HIT_BEHIND || z > CONFIG.PLAYER_Z + CONFIG.Z_HIT_AHEAD) return false;
    if (Math.abs(player.x - x) > CONFIG.LANE_HIT_X) return false;
    return !clearsObstacle(type);
  }

  // ---------------------------------------------------------
  // WORLD UPDATE — objects always move forward past the player
  // ---------------------------------------------------------
  const GameState = {
    speed: CONFIG.BASE_SPEED,
    time: 0,
    distance: 0,
    score: 0,
    stars: 0,
    lives: 3,
    unlimited: true, // default: Play Forever for toddlers
    lastMilestone: 0,
    spawnTimer: 0.5,
    itemTimer: 1.0,
  };

  function resetWorld() {
    for (const o of obstacles) scene.remove(o.mesh);
    for (const c of collectibles) scene.remove(c.mesh);
    for (const p of particles) scene.remove(p.mesh);
    obstacles = [];
    collectibles = [];
    particles = [];
    GameState.speed = CONFIG.BASE_SPEED;
    GameState.time = 0;
    GameState.distance = 0;
    GameState.score = 0;
    GameState.stars = 0;
    GameState.lives = 3;
    GameState.lastMilestone = 0;
    GameState.spawnTimer = 0.4;
    GameState.itemTimer = 1.0;
  }

  function updateWorld(dt, intents) {
    // Difficulty
    GameState.time += dt;
    const targetSpeed = clamp(CONFIG.BASE_SPEED + GameState.time * CONFIG.SPEED_RAMP, CONFIG.BASE_SPEED, CONFIG.MAX_SPEED);
    GameState.speed = lerp(GameState.speed, targetSpeed, 1 - Math.exp(-1.5 * dt));
    GameState.distance += GameState.speed * dt;

    // Obstacles keep their own rhythm (unchanged)
    GameState.spawnTimer -= dt;
    if (GameState.spawnTimer <= 0) {
      spawnObstacle();
      const interval = clamp(
        CONFIG.SPAWN_INTERVAL_START - GameState.time * 0.012,
        CONFIG.SPAWN_INTERVAL_MIN,
        CONFIG.SPAWN_INTERVAL_START
      );
      GameState.spawnTimer = interval * rand(0.85, 1.2);
    }

    // One learning item every ~2 seconds (steady, independent of obstacles)
    GameState.itemTimer -= dt;
    if (GameState.itemTimer <= 0) {
      const lane = (Math.random() * 3) | 0;
      spawnCollectible(lane, CONFIG.SPAWN_Z + rand(0, 6), randomLearnId());
      GameState.itemTimer = CONFIG.ITEM_INTERVAL * rand(0.9, 1.1);
    }

    // Player movement
    if (intents.left) player.lane = clamp(player.lane - 1, 0, 2);
    if (intents.right) player.lane = clamp(player.lane + 1, 0, 2);
    player.x = lerp(player.x, CONFIG.LANE_X[player.lane], 1 - Math.exp(-CONFIG.LANE_LERP * dt));

    if (intents.jump && !player.jumping) {
      player.vy = CONFIG.JUMP_VELOCITY;
      player.jumping = true;
      player.sliding = false;
      player.slideTimer = 0;
      AudioFX.jump();
    }
    if (intents.slide && !player.sliding) {
      player.sliding = true;
      player.slideTimer = CONFIG.SLIDE_DURATION;
      if (player.jumping) player.vy = Math.max(player.vy, -6);
      AudioFX.slide();
    }

    if (player.jumping) {
      player.vy -= CONFIG.GRAVITY * dt;
      player.y += player.vy * dt;
      if (player.y <= 0) {
        player.y = 0;
        player.vy = 0;
        player.jumping = false;
        player.squash = 1.25;
      }
    }
    if (player.sliding) {
      player.slideTimer -= dt;
      if (player.slideTimer <= 0) player.sliding = false;
    }
    if (player.invuln > 0) player.invuln -= dt;

    // Animate bunny — lively run with ear flop, tail wiggle, head bob
    player.anim += dt * (GameState.speed * 0.4);
    const hitActive = HitFX.active;
    const wind = Weather.wind;
    const bounceWave = Math.sin(player.anim * 2);

    if (hitActive) {
      bunny.root.position.x = player.x;
      bunny.root.position.z = CONFIG.PLAYER_Z;
      HitFX.applyPose(dt);
    } else {
      // Vertical bounce (double-frequency hop for a springy run)
      const bob = player.jumping ? 0 : Math.abs(bounceWave) * 0.14;
      const hipTilt = Math.sin(player.anim) * 0.08;
      bunny.root.position.set(player.x, player.y + bob, CONFIG.PLAYER_Z);
      bunny.root.rotation.z = lerp(
        bunny.root.rotation.z,
        (player.lane === 0 ? 0.16 : player.lane === 2 ? -0.16 : 0) + hipTilt,
        0.18
      );
      bunny.root.rotation.y = lerp(bunny.root.rotation.y, Math.sin(player.anim) * 0.06, 0.15);

      const slideSquash = player.sliding ? 0.52 : 1;
      player.squash = lerp(player.squash, 1, 1 - Math.exp(-10 * dt));
      // Squash & stretch with the bounce
      const stretch = 1 + bounceWave * 0.06;
      bunny.root.scale.set(
        player.squash * (1 / stretch),
        slideSquash * (2 - player.squash) * stretch,
        player.squash * (1 / stretch)
      );
      bunny.root.rotation.x = player.sliding ? 0.55 : bounceWave * 0.04;

      // Body lean / breathe
      if (bunny.bodyGroup) {
        bunny.bodyGroup.rotation.x = player.sliding ? 0.15 : Math.sin(player.anim * 2) * 0.07;
        bunny.bodyGroup.position.y = Math.sin(player.anim * 2 + 0.5) * 0.03;
      }

      // Head looks around playfully
      if (bunny.headGroup) {
        const look = Math.sin(player.anim * 0.55) * 0.22 + Math.sin(player.anim * 1.7) * 0.06;
        bunny.headGroup.rotation.y = lerp(bunny.headGroup.rotation.y, look, 0.12);
        bunny.headGroup.rotation.z = Math.sin(player.anim * 1.1) * 0.08;
        bunny.headGroup.rotation.x = player.jumping ? -0.2 : Math.sin(player.anim * 2) * 0.05;
      }

      // Ears flop (extra in the wind!)
      if (bunny.ears) {
        const flop = Math.sin(player.anim * 2.3) * (0.35 + wind * 0.7);
        bunny.ears[0].rotation.z = -0.22 + flop * 0.55 + wind * 0.35;
        bunny.ears[1].rotation.z = 0.22 - flop * 0.55 - wind * 0.35;
        bunny.ears[0].rotation.x = Math.sin(player.anim * 3 + 0.4) * (0.25 + wind * 0.4);
        bunny.ears[1].rotation.x = Math.sin(player.anim * 3 + 1.1) * (0.25 + wind * 0.4);
      }

      // Tail wiggle
      if (bunny.tail) {
        bunny.tail.position.x = Math.sin(player.anim * 3.5) * 0.12;
        bunny.tail.position.y = 1.0 + Math.abs(Math.sin(player.anim * 3.5)) * 0.08;
        bunny.tail.scale.setScalar(1 + Math.sin(player.anim * 4) * 0.08);
      }

      // Feet run cycle with a skip every few steps (silly!)
      const skip = Math.sin(player.anim * 0.5) > 0.72 ? 1.6 : 1;
      const step = Math.sin(player.anim * skip) * 0.42;
      const step2 = Math.sin(player.anim * skip + Math.PI) * 0.42;
      if (!player.jumping && !player.sliding) {
        bunny.feet[0].position.z = 0.15 + step;
        bunny.feet[1].position.z = 0.15 + step2;
        bunny.feet[0].position.y = 0.22 + Math.max(0, step) * 0.35;
        bunny.feet[1].position.y = 0.22 + Math.max(0, step2) * 0.35;
        // Arms swing + occasional double-pump
        bunny.arms[0].rotation.x = step * 1.5;
        bunny.arms[1].rotation.x = step2 * 1.5;
        bunny.arms[0].rotation.z = -0.15 + Math.sin(player.anim * 0.7) * 0.12;
        bunny.arms[1].rotation.z = 0.15 - Math.sin(player.anim * 0.7) * 0.12;
        bunny.arms[0].position.y = 1.15 + Math.abs(step) * 0.12;
        bunny.arms[1].position.y = 1.15 + Math.abs(step2) * 0.12;
      } else if (player.jumping) {
        bunny.feet[0].position.z = 0.45;
        bunny.feet[1].position.z = -0.15;
        bunny.feet[0].position.y = 0.35;
        bunny.feet[1].position.y = 0.18;
        bunny.arms[0].rotation.x = -1.1;
        bunny.arms[1].rotation.x = -1.1;
        bunny.arms[0].rotation.z = -0.7;
        bunny.arms[1].rotation.z = 0.7;
      } else if (player.sliding) {
        bunny.feet[0].position.z = 0.55;
        bunny.feet[1].position.z = 0.45;
        bunny.arms[0].rotation.x = 0.8;
        bunny.arms[1].rotation.x = 0.8;
        bunny.arms[0].rotation.z = -1.0;
        bunny.arms[1].rotation.z = 1.0;
      }
    }

    blob.position.set(player.x, 0.05, CONFIG.PLAYER_Z);
    const blobS = clamp(1 - player.y * 0.12, 0.55, 1);
    blob.scale.setScalar(blobS * (player.sliding ? 1.35 : 1));

    // Scroll scenery / dashes toward camera (same direction as obstacles)
    const move = GameState.speed * dt;
    const sway = Weather.swayBoost();
    for (const d of dashes) {
      d.position.z += move;
      if (d.position.z > 20) d.position.z -= 140;
    }
    for (const s of scenery) {
      s.position.z += move * 0.72;
      if (s.position.z > 28) {
        s.position.z -= 22 * 9 + rand(0, 20);
        s.position.x = (Math.random() < 0.5 ? -1 : 1) * rand(6.5, 17);
      }
      // Wind sway
      if (s.userData.swayAmp != null) {
        const ph = s.userData.swayPhase || 0;
        s.rotation.z = Math.sin(GameState.time * (2 + Weather.wind * 3) + ph) * s.userData.swayAmp * sway;
        s.rotation.x = Math.sin(GameState.time * 1.4 + ph) * s.userData.swayAmp * 0.45 * sway;
      }
    }

    // Birds glide across the sky
    for (const bird of birds) {
      bird.phase += dt * 5;
      bird.g.position.x += bird.speed * dt * (1 + Weather.wind);
      bird.g.position.z += move * 0.15;
      bird.g.position.y += Math.sin(bird.phase * 0.5) * dt * 0.4;
      const flap = Math.sin(bird.phase) * 0.55;
      bird.l.rotation.z = 0.35 + flap;
      bird.r.rotation.z = -0.35 - flap;
      if (bird.g.position.x > 35 || bird.g.position.z > 10) {
        bird.g.position.set(rand(-40, -20), rand(12, 22), rand(-80, -25));
      }
    }

    // Day / night + weather
    DayNight.update(dt);
    Weather.update(dt, GameState.speed);

    // Clouds drift (faster in wind)
    for (const c of clouds) {
      c.position.x += dt * (0.45 + Weather.wind * 2.2);
      c.position.z += move * 0.08;
      if (c.position.x > 35) {
        c.position.x = -35;
        c.position.y = rand(13, 22);
        c.position.z = rand(-90, -20);
      }
      if (c.position.z > 20) c.position.z -= 80;
    }

    // ===== OBSTACLES: keep moving until OFF SCREEN =====
    // This is the key behaviour: z increases toward the camera and
    // continues PAST the player (z=0) and is disposed before the camera (z≈14.5)
    // before the object is removed.
    let hitEvent = null;
    for (const o of obstacles) {
      if (!o.alive) continue;

      // World motion — never stops at the character
      o.z += move;
      o.mesh.position.z = o.z;

      // Contact test only inside the narrow world band
      if (!o.passed && player.invuln <= 0 && hitsPlayer(o.type, o.mesh.position.x, o.z)) {
        o.passed = true;
        player.invuln = 1.15;
        // Funny obstacle-specific reaction (trip / splash / float / bonk)
        HitFX.trigger(o.type);
        const names = {
          puddle: "the puddle",
          block: "the toy block",
          balloon: "the balloons",
          cart: "the cart",
        };
        if (Math.random() < 0.55) {
          Speak.say(pick([
            `Oops! Watch out for ${names[o.type] || "that"}!`,
            `Oh no! ${names[o.type] || "Something"}!`,
            `Try to jump or move!`,
          ]));
        }
        hitEvent = { type: "hit", obstacle: o };
      }

      // Survived
      if (!o.passed && o.z > CONFIG.PLAYER_Z + CONFIG.Z_HIT_BEHIND) {
        o.passed = true;
      }

      // Past the player and clear of the camera → dispose
      if (o.z > CONFIG.DESPAWN_Z) {
        o.alive = false;
        scene.remove(o.mesh);
      }
    }
    obstacles = obstacles.filter((o) => o.alive);

    // ===== COLLECTIBLES =====
    for (const c of collectibles) {
      if (!c.alive) continue;
      c.z += move;
      c.phase += dt * 4;
      c.mesh.position.z = c.z;
      c.mesh.position.y = 1.25 + Math.sin(c.phase) * 0.18;
      c.mesh.rotation.y += dt * 1.8;

      // Pickup in world space when close to the bunny
      if (
        c.z > CONFIG.PLAYER_Z - CONFIG.Z_HIT_BEHIND &&
        c.z < CONFIG.PLAYER_Z + CONFIG.Z_COLLECT &&
        Math.abs(player.x - c.mesh.position.x) < 2.45
      ) {
        c.alive = false;
        scene.remove(c.mesh);
        burst(c.mesh.position.x, 1.4, c.z, 0x7dff9a);
        AudioFX.coin();

        // Score is simply the number of items picked up
        GameState.stars += 1;
        GameState.score = GameState.stars;

        // Always speak the object name
        if (c.learn) {
          UI.showLearn(c.learn);
        }

        // Cheer every 10 items picked
        const itemMilestone = Math.floor(GameState.stars / 10);
        if (itemMilestone > GameState.lastMilestone && GameState.stars > 0) {
          GameState.lastMilestone = itemMilestone;
          UI.showCheer(GameState.stars);
          spray(player.x, player.y + 1.5, CONFIG.PLAYER_Z, 0xffd60a, { count: 12, up: 2.2, gravity: 6 });
          spray(player.x, player.y + 1.6, CONFIG.PLAYER_Z, 0xff8fab, { count: 8, up: 2.5, gravity: 6 });
          spray(player.x, player.y + 1.4, CONFIG.PLAYER_Z, 0x7bdff2, { count: 8, up: 2.0, gravity: 6 });
        }
        continue;
      }

      if (c.z > CONFIG.DESPAWN_Z) {
        c.alive = false;
        scene.remove(c.mesh);
      }
    }
    collectibles = collectibles.filter((c) => c.alive);

    // Particles
    for (const p of particles) {
      p.life -= dt;
      p.mesh.position.x += (p.vx || 0) * dt;
      p.mesh.position.y += (p.vy || 0) * dt;
      p.mesh.position.z += (p.vz || 0) * dt;
      if (p.gravity) p.vy -= p.gravity * dt;
      if (p.spin) {
        p.mesh.rotation.x += p.spin * dt;
        p.mesh.rotation.z += p.spin * 0.7 * dt;
      }
      if (p.grow) {
        const s = 1 + (1 - p.life / p.max) * p.grow;
        p.mesh.scale.setScalar(s);
      }
      if (p.mesh.material) p.mesh.material.opacity = clamp(p.life / p.max, 0, 1);
      if (p.life <= 0) {
        p.dead = true;
        scene.remove(p.mesh);
      }
    }
    particles = particles.filter((p) => !p.dead);

    // Hit reaction timers + dizzy stars
    HitFX.update(dt);
    updateDizzyStars(dt);

    // Score from distance
    GameState.score += GameState.speed * dt * CONFIG.DISTANCE_SCORE_RATE * 0.08;

    return hitEvent;
  }

  // ---------------------------------------------------------
  // CAMERA — gentle follow / look + hit shake
  // ---------------------------------------------------------
  function updateCamera(dt) {
    const targetX = player.x * 0.35;
    camera.position.x = lerp(camera.position.x, targetX, 1 - Math.exp(-3 * dt));
    camera.position.y = lerp(camera.position.y, 7.2 + player.y * 0.35, 1 - Math.exp(-3 * dt));

    // Funny screen shake on hits
    if (HitFX.shake > 0.01) {
      const s = HitFX.shake * 0.28;
      camera.position.x += rand(-s, s);
      camera.position.y += rand(-s, s) * 0.6;
    }

    const lookY = 1.4 + player.y * 0.4;
    camera.lookAt(camera.position.x * 0.4, lookY, -8);
  }

  // ---------------------------------------------------------
  // RENDER
  // ---------------------------------------------------------
  function resize() {
    const vv = window.visualViewport;
    const w = Math.round(vv ? vv.width : window.innerWidth);
    const h = Math.round(vv ? vv.height : window.innerHeight);
    const aspect = w / Math.max(1, h);
    camera.aspect = aspect;
    // Portrait phones need a wider FOV so all 3 lanes stay visible
    camera.fov = aspect < 0.8 ? 70 : aspect < 1.05 ? 62 : 55;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
    const canvas = renderer.domElement;
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
  }
  window.addEventListener("resize", resize, { signal });
  window.addEventListener("orientationchange", () => setTimeout(resize, 120), { signal });
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", resize, { signal });
  }

  // ---------------------------------------------------------
  // GAME STATE MACHINE + UI
  // ---------------------------------------------------------
  const STATE = { MENU: "menu", PLAYING: "playing", PAUSED: "paused", GAMEOVER: "gameover" };
  let state = STATE.MENU;
  let lastTime = 0;

  const el = {
    score: document.getElementById("score-value"),
    stars: document.getElementById("stars-value"),
    hearts: document.getElementById("hearts-value"),
    speed: document.getElementById("speed-value"),
    finalScore: document.getElementById("final-score"),
    celebrate: document.getElementById("celebrate-text"),
    startOverlay: document.getElementById("start-overlay"),
    pauseOverlay: document.getElementById("pause-overlay"),
    gameoverOverlay: document.getElementById("gameover-overlay"),
    pauseBtn: document.getElementById("pause-btn"),
    touchPad: document.getElementById("touch-pad"),
    loading: document.getElementById("loading"),
  };

  const isTouchLike =
    window.matchMedia("(pointer: coarse)").matches ||
    "ontouchstart" in window ||
    navigator.maxTouchPoints > 0;

  function setState(next) {
    state = next;
    el.startOverlay.classList.toggle("hidden", state !== STATE.MENU);
    el.pauseOverlay.classList.toggle("hidden", state !== STATE.PAUSED);
    el.gameoverOverlay.classList.toggle("hidden", state !== STATE.GAMEOVER);
    el.pauseBtn.classList.toggle("visible", state === STATE.PLAYING);
    el.touchPad.classList.toggle("visible", isTouchLike && state === STATE.PLAYING);
  }

  function updateHUD() {
    el.score.textContent = Math.floor(GameState.score).toLocaleString();
    el.stars.textContent = GameState.stars;
    if (GameState.unlimited) {
      el.hearts.textContent = "∞";
    } else {
      el.hearts.textContent = "❤".repeat(Math.max(0, GameState.lives));
    }
    el.speed.textContent = (GameState.speed / CONFIG.BASE_SPEED).toFixed(1) + "×";
  }

  function startGame() {
    AudioFX.unlock();
    AudioFX.start();
    // Unlock browser speech on the play tap (required on mobile)
    if (window.speechSynthesis) {
      try {
        window.speechSynthesis.resume();
        const warm = new SpeechSynthesisUtterance(" ");
        warm.volume = 0;
        window.speechSynthesis.speak(warm);
      } catch (_) {}
    }
    resetPlayer();
    resetWorld();
    updateHUD();
    setState(STATE.PLAYING);
    lastTime = performance.now();
  }

  function gameOver() {
    AudioFX.gameOver();
    const best = Math.max(Number(localStorage.getItem("bunnyRunnerBest") || 0), Math.floor(GameState.score));
    localStorage.setItem("bunnyRunnerBest", String(best));
    el.finalScore.textContent = Math.floor(GameState.score).toLocaleString();
    el.celebrate.textContent = pick(["Hebat, Kelinci!", "Kamu luar biasa!", "Seru banget!", "Banyak bintang!", "Tos!"]);
    setState(STATE.GAMEOVER);
  }

  function togglePause() {
    if (state === STATE.PLAYING) setState(STATE.PAUSED);
    else if (state === STATE.PAUSED) {
      setState(STATE.PLAYING);
      lastTime = performance.now();
    }
  }

  document.getElementById("start-btn").addEventListener("click", () => { AudioFX.unlock(); startGame(); }, { signal });
  document.getElementById("retry-btn").addEventListener("click", () => { AudioFX.unlock(); startGame(); }, { signal });
  document.getElementById("resume-btn").addEventListener("click", togglePause, { signal });
  const backToGamePicker = () => {
    setState(STATE.MENU);
    window.dispatchEvent(new CustomEvent("tepuq:lari-back-to-menu"));
  };
  document.getElementById("quit-btn").addEventListener("click", backToGamePicker, { signal });
  document.getElementById("home-btn").addEventListener("click", backToGamePicker, { signal });
  el.pauseBtn.addEventListener("click", togglePause, { signal });

  // Mode picker: Play Forever (default) vs 3 Hearts
  const modeForever = document.getElementById("mode-forever");
  const modeHearts = document.getElementById("mode-hearts");
  function setMode(unlimited) {
    GameState.unlimited = unlimited;
    modeForever.classList.toggle("active", unlimited);
    modeHearts.classList.toggle("active", !unlimited);
  }
  modeForever.addEventListener("click", () => { AudioFX.unlock(); setMode(true); }, { signal });
  modeHearts.addEventListener("click", () => { AudioFX.unlock(); setMode(false); }, { signal });
  setMode(true);
  window.addEventListener("game:toggle-pause", togglePause, { signal });
  window.addEventListener("blur", () => { if (state === STATE.PLAYING) setState(STATE.PAUSED); }, { signal });

  // ---------------------------------------------------------
  // MAIN LOOP
  // ---------------------------------------------------------
  function frame(now) {
    if (destroyed) return;
    rafId = requestAnimationFrame(frame);
    if (!lastTime) lastTime = now;
    let dt = (now - lastTime) / 1000;
    lastTime = now;
    dt = clamp(dt, 0, 0.05);

    if (state === STATE.PLAYING) {
      const intents = Input.consume();
      const hit = updateWorld(dt, intents);
      if (hit && hit.type === "hit") {
        if (!GameState.unlimited) {
          // Hearts mode only: lose a heart on bump (score stays = items)
          GameState.lives -= 1;
          if (GameState.lives <= 0) {
            gameOver();
          }
        }
        // Unlimited mode: funny stumble only — score stays item count
      }
      updateHUD();
    } else {
      // Idle: keep world alive (menu attract)
      Input.consume();
    }

    updateCamera(dt);
    renderer.render(scene, camera);
  }

  // Boot
  resize();
  el.loading.classList.add("hidden");
  setState(STATE.MENU);
  rafId = requestAnimationFrame(frame);

  // Autoplay for automated checks
  if (/autoplay=1|#play\b/.test(location.search + location.hash)) startGame();

  return {
    destroy() {
      destroyed = true;
      try { ac.abort(); } catch {}
      if (rafId) cancelAnimationFrame(rafId);
      try {
        if (typeof renderer !== "undefined" && renderer) {
          renderer.dispose();
          renderer.forceContextLoss?.();
        }
      } catch {}
      try {
        if (typeof AudioFX !== "undefined" && AudioFX && AudioFX.close) AudioFX.close();
      } catch {}
      try {
        const stage = document.getElementById("lariStage");
        if (stage) stage.innerHTML = "";
      } catch {}
    },
  };
}
