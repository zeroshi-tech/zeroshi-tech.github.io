"use strict";
// CURSOR AGENTS — no dependencies.
// 1. On load, a swarm of colored cursors flies out and "builds" the page: each one drags a
//    selection box around an element and the element materializes. Sections further down are
//    built when they scroll into view.
// 2. Afterwards a few agents follow the visitor's mouse, inspect whatever is hovered and
//    celebrate when the Contact section is reached.
// Visitors can skip the build or hide the agents from the small HUD; the choice is remembered.
(() => {
  const root = document.documentElement;
  window.__cursorAgents = true;

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    root.classList.remove("ca-boot");
    return;
  }

  const read = (area, key) => { try { return window[area].getItem(key); } catch { return null; } };
  const write = (area, key, value) => { try { window[area].setItem(key, value); } catch { /* private mode */ } };

  const PREF_KEY = "zeroshi-cursor-agents";      // "off" when the visitor hid the agents
  const SEEN_KEY = "zeroshi-cursor-agents-seen";  // later builds in the same visit run faster
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  const COLORS = ["#ff5c8a", "#ffb547", "#4fd18b", "#5b9dff", "#a77bff", "#3fd6e8", "#ff7a45", "#e46bff"];
  const NAMES = ["Keyframe", "Mask", "Roto", "Comp", "Easing", "Track", "Blur", "Grade", "Layer",
    "Render", "Type", "Glow", "Matte", "Null", "Shape", "Pivot", "Motion", "Edit"];
  const FOLLOWERS = 5;

  // Everything an agent builds. Nested matches are dropped so a parent and child never both wait.
  const LAYER_SELECTOR = [
    ".brand", ".nav-link", ".sidebar-bottom small",
    ".hero-showreel", ".archive-showreel",
    ".eyebrow", "h1", "h2", ".hero-role", ".hero-copy", ".button", ".hero-footer > span",
    ".about-intro > p:not(.eyebrow)", ".services > span", ".about-facts > div", ".tools > p", ".tool",
    ".text-link", ".filter-btn", ".project-count", ".project-card", ".archive-teaser",
    ".contact-side > p", ".outro-line", ".main-footer > *",
    ".archive-copy", ".archive-back", ".archive-projects .section-heading > p"
  ].join(",");
  const INSPECT_SELECTOR = ".project-card,.button,.filter-btn,.nav-link,.tool,.archive-teaser,.text-link,.archive-back,.brand";

  const CURSOR_SVG = '<svg viewBox="0 0 16 20" aria-hidden="true"><path d="M1.5 1.5v14.2l3.9-3.6 2.6 6.1 2.6-1.1-2.6-6h5.4z"/></svg>';

  const rand = (min, max) => min + Math.random() * (max - min);
  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
  const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);
  const easeIn = (t) => t * t * t;
  const make = (tag, cls, parent) => {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (parent) parent.appendChild(node);
    return node;
  };

  let agentsOff = read("localStorage", PREF_KEY) === "off";
  const shouldBuild = root.classList.contains("ca-boot") && !agentsOff;

  let overlay, hud, hudParts, rulers = [], bootmark = null;
  let agents = [], layers = [], done = 0, building = false, speed = 1, baseSpeed = 1, bootUntil = 0, raf = 0, last = 0;
  let vw = window.innerWidth, vh = window.innerHeight;
  let inspecting = null, contactVisible = false, swarmDone = false, hudCache = "";
  const mouse = { x: vw / 2, y: vh / 2, active: false };
  const scannedSections = new Set();

  /* ---------- drawing helpers ---------- */
  function createAgent(index, x, y) {
    const color = COLORS[index % COLORS.length];
    const node = make("div", "ca-agent", overlay);
    node.style.setProperty("--c", color);
    node.innerHTML = CURSOR_SVG;
    const tag = make("span", "ca-tag", node);
    tag.textContent = NAMES[index % NAMES.length];
    const agent = { node, color, x, y, vx: 0, vy: 0, task: null, cooldown: 0, home: { x, y },
      k: rand(55, 85), phase: rand(0, Math.PI * 2), follower: false, radius: 60, orbit: 0.4, dead: false };
    place(agent);
    agents.push(agent);
    return agent;
  }
  const place = (a) => { a.node.style.transform = `translate3d(${a.x - 1.5}px,${a.y - 1.5}px,0)`; };

  function createBox() {
    const node = make("div", "ca-box", overlay);
    ["tl", "tr", "bl", "br"].forEach((corner) => make("i", corner, node));
    const dim = make("span", "ca-dim", node);
    // Only some boxes draw full-screen guide lines, otherwise the screen turns into a grid.
    const gx = make("div", "ca-guide ca-guide-v", overlay);
    const gy = make("div", "ca-guide ca-guide-h", overlay);
    if (Math.random() < 0.65) gx.hidden = true;
    if (Math.random() < 0.65) gy.hidden = true;
    if (Math.random() < 0.25) gy.classList.add("is-alt");
    return { node, dim, gx, gy, w: -1, h: -1 };
  }
  function drawBox(box, x, y, w, h) {
    w = Math.max(0, w); h = Math.max(0, h);
    box.node.style.transform = `translate3d(${x}px,${y}px,0)`;
    box.node.style.width = `${w}px`;
    box.node.style.height = `${h}px`;
    box.gx.style.transform = `translate3d(${x}px,0,0)`;
    box.gy.style.transform = `translate3d(0,${y}px,0)`;
    box.node.classList.toggle("dim-inside", y + h > vh - 26);
    const rw = Math.round(w), rh = Math.round(h);
    if (rw !== box.w || rh !== box.h) { box.dim.textContent = `${rw} × ${rh}`; box.w = rw; box.h = rh; }
  }
  function dropBox(box, flash) {
    if (!box) return;
    box.gx.classList.add("is-out"); box.gy.classList.add("is-out");
    box.node.classList.add(flash ? "is-done" : "is-out");
    setTimeout(() => { box.node.remove(); box.gx.remove(); box.gy.remove(); }, flash ? 680 : 360);
  }
  function spark(x, y, color) {
    const s = make("span", "ca-plus", overlay);
    s.style.left = `${x}px`; s.style.top = `${y}px`;
    if (color) s.style.color = color;
    setTimeout(() => s.remove(), 1000);
  }
  function scan(section) {
    const r = section.getBoundingClientRect();
    const top = Math.max(r.top, 0), bottom = Math.min(r.bottom, vh);
    if (bottom - top < 60 || !overlay.animate) return;
    const band = make("div", "ca-scan", overlay);
    band.style.left = `${r.left}px`; band.style.width = `${r.width}px`;
    band.animate([
      { transform: `translateY(${top}px)`, opacity: 0 },
      { opacity: 1, offset: 0.15 }, { opacity: 1, offset: 0.8 },
      { transform: `translateY(${bottom - 42}px)`, opacity: 0 }
    ], { duration: 1100 / speed, easing: "cubic-bezier(.45,0,.25,1)" }).onfinish = () => band.remove();
  }
  function buildRulers() {
    const x = make("div", "ca-ruler ca-ruler-x", document.body);
    const y = make("div", "ca-ruler ca-ruler-y", document.body);
    [x, y].forEach((r) => r.setAttribute("aria-hidden", "true"));
    for (let p = 100; p < Math.min(vw, 4000); p += 100) { const s = make("span", "", x); s.style.left = `${p}px`; s.textContent = p; }
    for (let p = 100; p < Math.min(vh, 3000); p += 100) { const s = make("span", "", y); s.style.top = `${p - 15}px`; s.textContent = p; }
    rulers = [x, y];
  }

  /* ---------- layers ---------- */
  function collectLayers() {
    const found = [...document.querySelectorAll(LAYER_SELECTOR)].filter((el) => !el.closest("dialog"));
    const set = new Set(found);
    return found.filter((el) => {
      for (let p = el.parentElement; p; p = p.parentElement) if (set.has(p)) return false;
      return true;
    });
  }
  function reveal(layer, animate) {
    if (layer.state === "done") return;
    layer.state = "done";
    done++;
    const el = layer.el;
    el.classList.remove("ca-pending");
    if (animate) {
      el.classList.add("ca-in");
      // Remove right after the animation so it can't override hover filters/transforms.
      setTimeout(() => el.classList.remove("ca-in"), 700);
    }
  }
  // The part of an element that is on screen, or null when it is hidden or scrolled away.
  function rectOf(el) {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) return null;
    const left = Math.max(r.left, 2), top = Math.max(r.top, 2);
    const right = Math.min(r.right, vw - 2), bottom = Math.min(r.bottom, vh - 2);
    if (right - left < 4 || bottom - top < 4) return null;
    return { left, top, right, bottom };
  }

  /* ---------- tasks ---------- */
  function startTask(a, task, now) {
    a.task = Object.assign({ phase: "travel", t0: now, sx: a.x, sy: a.y, dur: 0, bend: rand(-150, 150), box: null }, task);
    a.node.classList.add("is-busy");
  }
  function endTask(a, now) {
    if (a.task && a.task.box) dropBox(a.task.box, false);
    a.task = null;
    a.node.classList.remove("is-busy");
    a.home = { x: clamp(a.x + rand(-40, 40), 20, vw - 20), y: clamp(a.y + rand(8, 46), 20, vh - 20) };
    a.cooldown = now + rand(30, 180) / speed;
    a.vx *= 0.3; a.vy *= 0.3;
  }
  function leave(a, now) {
    if (a.task && a.task.box) dropBox(a.task.box, false);
    a.node.classList.remove("is-busy");
    a.follower = false;
    a.task = { kind: "leave", t0: now + rand(0, 260), sx: a.x, sy: a.y,
      ex: a.x < vw / 2 ? -40 : vw + 40, ey: a.y + rand(-140, 140), dur: rand(550, 900) };
  }

  function runTask(a, now) {
    const t = a.task;
    if (t.kind === "leave") {
      const p = clamp((now - t.t0) / t.dur, 0, 1), e = easeIn(p);
      a.x = t.sx + (t.ex - t.sx) * e; a.y = t.sy + (t.ey - t.sy) * e;
      if (p >= 1) { a.node.remove(); a.dead = true; }
      return;
    }
    if (t.kind === "inspect" && t.released && t.phase !== "hold") { endTask(a, now); return; }
    const r = rectOf(t.el);
    if (!r) {
      if (t.kind === "build") reveal(t.layer, false);
      endTask(a, now);
      return;
    }
    if (t.phase === "travel") {
      if (!t.dur) t.dur = clamp(Math.hypot(r.left - t.sx, r.top - t.sy) * 0.9, 260, 820) / speed;
      const p = Math.min(1, (now - t.t0) / t.dur), e = easeInOut(p);
      const dx = r.left - t.sx, dy = r.top - t.sy, len = Math.hypot(dx, dy) || 1;
      const bend = Math.sin(Math.PI * p) * t.bend * Math.min(1, len / 360);
      a.x = t.sx + dx * e - (dy / len) * bend;
      a.y = t.sy + dy * e + (dx / len) * bend;
      if (p >= 1) {
        t.phase = "drag"; t.t0 = now;
        t.dur = clamp(Math.hypot(r.right - r.left, r.bottom - r.top) * 0.75, 240, 720) / speed;
        t.box = createBox();
        drawBox(t.box, r.left, r.top, 0, 0);
      }
    } else if (t.phase === "drag") {
      const p = Math.min(1, (now - t.t0) / t.dur), e = easeOut(p);
      a.x = r.left + (r.right - r.left) * e;
      a.y = r.top + (r.bottom - r.top) * e;
      drawBox(t.box, r.left, r.top, a.x - r.left, a.y - r.top);
      if (p >= 1) {
        if (t.kind === "build") {
          reveal(t.layer, true);
          spark(r.left, r.top, a.color);
          spark(r.right, r.bottom, a.color);
          if (Math.random() < 0.5) spark(r.right, r.top);
          dropBox(t.box, true); t.box = null;
          t.phase = "linger"; t.t0 = now; t.dur = 140 / speed;
        } else {
          t.phase = "hold";
        }
      }
    } else if (t.phase === "hold") {
      a.x = r.right + Math.sin(now / 260) * 2;
      a.y = r.bottom + Math.cos(now / 310) * 2;
      drawBox(t.box, r.left, r.top, r.right - r.left, r.bottom - r.top);
      if (t.released) endTask(a, now);
    } else if (now - t.t0 >= t.dur) {
      endTask(a, now);
    }
  }

  function idle(a, now, dt) {
    let tx, ty;
    if (now < bootUntil) {
      const ang = a.phase + now / 700;
      tx = vw / 2 + Math.cos(ang) * a.radius; ty = vh / 2 + Math.sin(ang) * a.radius;
    } else if (a.follower && mouse.active) {
      const ang = a.phase + (now / 1000) * a.orbit;
      tx = mouse.x + Math.cos(ang) * a.radius;
      ty = mouse.y + Math.sin(ang) * a.radius * 0.75;
      a.home.x = tx; a.home.y = ty;
    } else {
      tx = a.home.x + Math.sin(now / 900 + a.phase) * 14;
      ty = a.home.y + Math.cos(now / 1100 + a.phase * 1.3) * 10;
    }
    const c = 2 * Math.sqrt(a.k) * 0.78;
    a.vx += ((tx - a.x) * a.k - a.vx * c) * dt;
    a.vy += ((ty - a.y) * a.k - a.vy * c) * dt;
    a.x += a.vx * dt;
    a.y += a.vy * dt;
  }

  /* ---------- build scheduler ---------- */
  function schedule(now) {
    if (now < bootUntil) return;
    const free = agents.filter((a) => !a.task && !a.dead && now >= a.cooldown);
    const candidates = [];
    let pendingInView = 0;
    for (const layer of layers) {
      if (layer.state !== "pending") continue;
      if (!layer.el.getClientRects().length) { reveal(layer, false); continue; } // filtered out / hidden
      const r = layer.el.getBoundingClientRect();
      if (r.bottom > -20 && r.top < vh + 20) {
        pendingInView++;
        layer.seen = layer.seen || now;
        if (now - layer.seen > 6000) { reveal(layer, true); continue; } // safety net
        if (candidates.length < free.length + 3) candidates.push(layer);
      }
    }
    speed = baseSpeed * (pendingInView > agents.length * 2 ? 1.45 : 1);
    for (const a of free) {
      if (!candidates.length) break;
      let best = 0, bestDist = Infinity;
      for (let i = 0; i < Math.min(4, candidates.length); i++) {
        const r = candidates[i].el.getBoundingClientRect();
        const d = Math.hypot(r.left - a.x, r.top - a.y);
        if (d < bestDist) { bestDist = d; best = i; }
      }
      const layer = candidates.splice(best, 1)[0];
      layer.state = "assigned";
      if (layer.section && !scannedSections.has(layer.section)) { scannedSections.add(layer.section); scan(layer.section); }
      startTask(a, { kind: "build", el: layer.el, layer }, now);
    }
    const busy = agents.some((a) => a.task && a.task.kind === "build");
    if (done >= layers.length && !busy) finishBuild(now);
    else if (!busy && contactVisible) maybeSwarm();
  }

  function finishBuild(now) {
    if (!building) return;
    building = false;
    write("sessionStorage", SEEN_KEY, "1");
    root.classList.remove("ca-building");
    setTimeout(() => { rulers.forEach((r) => r.remove()); rulers = []; }, 700);
    const keep = finePointer && !agentsOff ? Math.min(FOLLOWERS, agents.length) : 0;
    agents.forEach((a, i) => (i < keep ? makeFollower(a, i) : leave(a, now)));
    updateHud(now, true);
    setTimeout(compactHud, 1500);
    maybeSwarm();
  }
  function makeFollower(a, i) {
    a.follower = true;
    a.k = 14 + i * 7;
    a.radius = 38 + i * 15;
    a.orbit = (i % 2 ? -1 : 1) * (0.3 + i * 0.07);
  }

  /* ---------- HUD ---------- */
  function createHud() {
    hud = make("div", "ca-hud", document.body);
    const dots = make("span", "ca-dots", hud);
    dots.setAttribute("aria-hidden", "true");
    COLORS.slice(0, 4).forEach((c) => make("i", "", dots).style.setProperty("--c", c));
    const text = make("span", "ca-hud-text", hud);
    text.setAttribute("aria-hidden", "true");
    const count = make("b", "", text);
    text.append(" agents");
    const layersText = make("span", "ca-layers", text);
    const state = make("span", "ca-hud-state", hud);
    state.setAttribute("aria-hidden", "true");
    const bar = make("span", "ca-bar", hud);
    bar.setAttribute("aria-hidden", "true");
    const fill = make("i", "", bar);
    const button = make("button", "ca-hud-btn", hud);
    button.type = "button";
    button.addEventListener("click", onHudButton);
    hudParts = { count, layersText, state, fill, button };
  }
  function updateHud(now, force) {
    if (!hud) return;
    const alive = agents.filter((a) => !a.dead && !(a.task && a.task.kind === "leave")).length;
    const busy = agents.some((a) => a.task && a.task.kind === "build");
    const state = building
      ? (now < bootUntil ? "Booting agents…" : busy ? "Building" : "Scroll to build more")
      : "Built ✓";
    const key = `${alive}|${done}|${state}|${agentsOff}`;
    if (!force && key === hudCache) return;
    hudCache = key;
    hudParts.count.textContent = String(alive);
    hudParts.layersText.textContent = ` · ${done} / ${layers.length} layers`;
    hudParts.state.textContent = state;
    hudParts.fill.style.width = `${layers.length ? (done / layers.length) * 100 : 100}%`;
    hud.classList.toggle("is-building", building && busy);
    hud.classList.toggle("is-off", agentsOff);
    if (building) {
      hudParts.button.textContent = "Skip";
      hudParts.button.setAttribute("aria-label", "Skip the build animation");
    } else {
      hudParts.button.textContent = agentsOff ? "Show agents" : "Hide";
      hudParts.button.setAttribute("aria-label", agentsOff ? "Show cursor agents" : "Hide cursor agents");
    }
  }
  function compactHud() {
    if (!hud || building) return;
    // Touch screens have no mouse to follow, so the HUD simply fades away after the build.
    hud.classList.add(finePointer ? "is-compact" : "is-gone");
  }
  function onHudButton() {
    const now = performance.now();
    if (building) { skip(now); return; }
    agentsOff = !agentsOff;
    write("localStorage", PREF_KEY, agentsOff ? "off" : "on");
    if (agentsOff) {
      releaseInspect();
      agents.forEach((a) => { if (!a.dead) leave(a, now); });
    } else if (finePointer) {
      spawnFollowers(now);
    }
    updateHud(now, true);
    loop();
  }
  function skip(now) {
    agents.forEach((a) => { if (a.task) endTask(a, now); });
    layers.forEach((layer) => reveal(layer, true));
    finishBuild(now);
    loop();
  }
  function spawnFollowers(now) {
    const fromLeft = mouse.x > vw / 2;
    for (let i = 0; i < FOLLOWERS; i++) {
      const a = createAgent(i, fromLeft ? -30 : vw + 30, clamp(mouse.y + rand(-120, 120), 20, vh - 20));
      makeFollower(a, i);
      a.cooldown = now;
    }
  }

  /* ---------- finale: a swarm of cursors rises through the Contact section ---------- */
  function maybeSwarm() {
    if (swarmDone || agentsOff || !contactVisible || !overlay.animate) return;
    if (agents.some((a) => a.task && a.task.kind === "build")) return; // wait until Contact is built
    swarmDone = true;
    const n = finePointer ? 30 : 16;
    for (let i = 0; i < n; i++) {
      const node = make("div", "ca-agent ca-swarm", overlay);
      node.style.setProperty("--c", COLORS[i % COLORS.length]);
      node.innerHTML = CURSOR_SVG;
      const x0 = rand(vw * 0.15, vw * 0.98), y0 = vh + rand(20, 140);
      const x1 = x0 + rand(-180, 180), y1 = rand(-60, vh * 0.45);
      const s = rand(0.75, 1.15);
      node.animate([
        { transform: `translate(${x0}px,${y0}px) rotate(${rand(-20, 20)}deg) scale(${s})`, opacity: 0 },
        { opacity: 1, offset: 0.12 }, { opacity: 0.9, offset: 0.7 },
        { transform: `translate(${x1}px,${y1}px) rotate(${rand(-35, 35)}deg) scale(${s})`, opacity: 0 }
      ], { duration: rand(2600, 4600), delay: rand(0, 900), easing: "cubic-bezier(.3,.1,.3,1)", fill: "both" })
        .onfinish = () => node.remove();
    }
  }

  /* ---------- visitor interaction ---------- */
  function releaseInspect() {
    if (inspecting) { inspecting.task.released = true; inspecting = null; }
  }
  function bindInteraction() {
    window.addEventListener("pointermove", (e) => {
      if (e.pointerType !== "mouse") return;
      mouse.x = e.clientX; mouse.y = e.clientY; mouse.active = true;
    }, { passive: true });
    root.addEventListener("mouseleave", () => { mouse.active = false; });

    document.addEventListener("pointerover", (e) => {
      if (building || agentsOff || e.pointerType !== "mouse") return;
      const target = e.target.closest && e.target.closest(INSPECT_SELECTOR);
      if (!target || target.closest("dialog") || (inspecting && inspecting.el === target)) return;
      releaseInspect();
      const free = agents.filter((a) => a.follower && !a.task && !a.dead);
      if (!free.length) return;
      const r = target.getBoundingClientRect();
      free.sort((p, q) => Math.hypot(p.x - r.left, p.y - r.top) - Math.hypot(q.x - r.left, q.y - r.top));
      const a = free[0];
      startTask(a, { kind: "inspect", el: target }, performance.now());
      inspecting = { el: target, task: a.task };
      loop();
    });
    document.addEventListener("pointerout", (e) => {
      if (!inspecting) return;
      const to = e.relatedTarget;
      if (to && inspecting.el.contains(to)) return;
      if (inspecting.el.contains(e.target)) releaseInspect();
    });
    document.addEventListener("pointerdown", (e) => {
      if (agentsOff || !agents.length) return;
      releaseInspect();
      for (let k = 0; k < 4; k++) spark(e.clientX + rand(-18, 18), e.clientY + rand(-18, 18), COLORS[k * 2]);
      agents.forEach((a) => {
        if (a.task) return;
        const dx = a.x - e.clientX, dy = a.y - e.clientY, d = Math.hypot(dx, dy) || 1;
        if (d < 220) { const f = (1 - d / 220) * 900; a.vx += (dx / d) * f; a.vy += (dy / d) * f; }
      });
      loop();
    });

    const contact = document.getElementById("contact");
    if (contact && "IntersectionObserver" in window) {
      new IntersectionObserver((entries) => {
        contactVisible = entries[entries.length - 1].isIntersecting;
        maybeSwarm();
      }, { threshold: 0.4 }).observe(contact);
    }
  }

  /* ---------- main loop ---------- */
  function frame(now) {
    const dt = Math.min((now - last) / 1000, 1 / 20);
    last = now;
    vw = window.innerWidth; vh = window.innerHeight;
    if (bootmark && now >= bootUntil) {
      const mark = bootmark; bootmark = null;
      mark.classList.add("is-out");
      setTimeout(() => mark.remove(), 450);
    }
    if (building) schedule(now);
    for (const a of agents) {
      const px = a.x, py = a.y;
      if (a.task) {
        runTask(a, now);
        if (a.task && dt > 0) { a.vx = ((a.x - px) / dt) * 0.4; a.vy = ((a.y - py) / dt) * 0.4; }
      } else {
        idle(a, now, dt);
      }
      if (!a.dead) place(a);
    }
    agents = agents.filter((a) => !a.dead);
    updateHud(now, false);
    raf = agents.length || building ? requestAnimationFrame(frame) : 0;
  }
  function loop() {
    if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); }
  }

  /* ---------- start ---------- */
  function start() {
    overlay = make("div", "ca-overlay", document.body);
    overlay.setAttribute("aria-hidden", "true");
    createHud();
    bindInteraction();
    const now = performance.now();

    if (!shouldBuild) {
      root.classList.remove("ca-boot");
      if (!agentsOff && finePointer) spawnFollowers(now);
      updateHud(now, true);
      compactHud();
      loop();
      return;
    }

    layers = collectLayers().map((el) => ({ el, state: "pending", section: el.closest("aside,header,section,footer") }));
    layers.forEach((layer) => layer.el.classList.add("ca-pending"));
    root.classList.add("ca-building");
    root.classList.remove("ca-boot");
    building = true;

    const repeat = read("sessionStorage", SEEN_KEY) === "1";
    baseSpeed = speed = repeat ? 1.6 : 1;
    bootUntil = now + (repeat ? 350 : 800);
    buildRulers();
    bootmark = make("div", "ca-bootmark", overlay);
    make("span", "brand-mark", bootmark).textContent = "Z";
    make("small", "", bootmark).textContent = "Booting agents";

    const count = finePointer ? (repeat ? 12 : 16) : 9;
    for (let i = 0; i < count; i++) {
      const ang = (i / count) * Math.PI * 2;
      const radius = rand(34, 70);
      const a = createAgent(i, vw / 2 + Math.cos(ang) * radius, vh / 2 + Math.sin(ang) * radius);
      a.phase = ang;
      a.radius = radius;
      a.cooldown = bootUntil + (i * 45) / speed;
    }
    updateHud(now, true);
    loop();
  }

  try {
    start();
  } catch (error) {
    // Never leave the page hidden if something goes wrong.
    root.classList.remove("ca-boot", "ca-building");
    document.querySelectorAll(".ca-pending").forEach((el) => el.classList.remove("ca-pending"));
    if (overlay) overlay.remove();
    if (hud) hud.remove();
    console.error("cursor-agents:", error);
  }
})();
