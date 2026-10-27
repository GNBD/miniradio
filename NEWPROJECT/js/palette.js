/*
 * SPDX-License-Identifier: MIT
 * palette.js - left module palette + hover tooltips
 * depends: catalog.js, render.js, editor.js (ED), code.js (CODE modules)
 */
const Tip = {
  el: null, cv: null, nameEl: null, subEl: null, timer: null,

  init() {
    this.el = document.getElementById("tip");
    this.cv = document.getElementById("tipCanvas");
    this.nameEl = document.getElementById("tipName");
    this.subEl = document.getElementById("tipSub");
  },

  place(rect, h) {
    const w = 180;
    let x = rect.right + 10;
    let y = rect.top;
    if (x + w > window.innerWidth - 8) x = rect.left - w - 10;
    if (x < 8) x = 8;
    if (y + h > window.innerHeight - 8) y = window.innerHeight - h - 8;
    if (y < 8) y = 8;
    this.el.style.left = x + "px";
    this.el.style.top = y + "px";
  },

  preview(project, name, sub, rect) {
    this.hide();
    this.timer = setTimeout(() => {
      this.el.classList.remove("textonly");
      this.nameEl.textContent = name;
      this.subEl.textContent = sub || "";
      Render.draw(this.cv.getContext("2d"), project, MOCK, 2);
      this.el.hidden = false;
      this.place(rect, 150);
    }, 420);
  },

  module(mod, rect) {
    this.preview({ bg: "bg", items: mod.make() }, mod.name, mod.sub, rect);
  },

  template(tpl, rect) {
    const items = [];
    for (const id of tpl.ids) {
      const m = MODULES.find((x) => x.id === id);
      if (m) items.push(...m.make());
    }
    this.preview({ bg: "bg", items }, tpl.name, "템플릿 · " + tpl.sub, rect);
  },

  text(title, sub, rect) {
    this.hide();
    this.timer = setTimeout(() => {
      this.el.classList.add("textonly");
      this.nameEl.textContent = title;
      this.subEl.textContent = sub || "";
      this.el.hidden = false;
      this.place(rect, 62);
    }, 420);
  },

  hide() {
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
    if (this.el) this.el.hidden = true;
  },
};

function attachTip(el, fn) {
  el.tabIndex = 0;
  el.addEventListener("pointerenter", () => fn(el.getBoundingClientRect()));
  el.addEventListener("pointerleave", () => Tip.hide());
  el.addEventListener("blur", () => Tip.hide());
  el.addEventListener("focus", () => fn(el.getBoundingClientRect()));
}

function buildPalette(mode) {
  const body = document.getElementById("paletteBody");
  const q = (document.getElementById("search").value || "").toLowerCase();
  body.innerHTML = "";

  const match = (name, sub) => !q || (name + " " + (sub || "")).toLowerCase().includes(q);

  if (mode === "code") {
    const g = document.createElement("div");
    g.className = "grp"; g.textContent = "C MODULES";
    body.appendChild(g);
    for (const m of (ED.project.code || [])) {
      const el = document.createElement("div");
      el.className = "mod app";
      el.innerHTML = `<span class="dot"></span><div><div class="nm">${m.name}</div>
        <div class="sub">${m.fn}()</div></div>`;
      el.addEventListener("click", () => CODE.select(m.id));
      attachTip(el, (r) => Tip.text(m.name, m.fn + "() · 캔버스로 드래그", r));
      body.appendChild(el);
    }
    return;
  }

  if (mode === "menu" || mode === "settings") {
    const ed = mode === "menu" ? MenuEd : SetEd;
    const ids = mode === "menu" ? MENU_IDS : SET_IDS;
    const used = new Set(ed.list().map((x) => x.id));
    const g = document.createElement("div");
    g.className = "grp";
    g.textContent = mode === "menu" ? "MENU ACTIONS" : "SETTINGS ITEMS";
    body.appendChild(g);
    for (const [id, label] of ids) {
      if (used.has(id)) continue;
      if (!match(label, id)) continue;
      const el = document.createElement("div");
      el.className = "mod";
      el.innerHTML = `<span class="dot"></span><div><div class="nm">${label}</div>
        <div class="sub">${id}</div></div>`;
      el.addEventListener("click", () => ed.add(id));
      attachTip(el, (r) => Tip.text(label, id + " · 클릭하면 추가", r));
      body.appendChild(el);
    }
    return;
  }

  if (mode === "logic") {
    for (const [kind, title] of [["when", "WHEN (이벤트)"], ["if", "IF (조건)"], ["do", "DO (동작)"]]) {
      const g = document.createElement("div");
      g.className = "grp"; g.textContent = title;
      body.appendChild(g);
      for (const b of BLOCKS[kind]) {
        if (!match(b.label)) continue;
        const tier = (window.MRSchema ? MRSchema.tierOf(kind, b.type) : 1);
        const el = document.createElement("div");
        el.className = "mod block" + (tier === 0 ? " off" : "");
        el.draggable = true;
        const subTxt = (b.param != null ? "param: " + b.param : "—") +
          (tier === 0 ? " · 미구현 (생성 안 됨)" : "");
        el.innerHTML = `<span class="dot"></span><div><div class="nm">${b.label}</div>
          <div class="sub">${subTxt}</div></div>`;
        el.addEventListener("dragstart", (e) => {
          e.dataTransfer.setData("text/block", JSON.stringify({ kind, type: b.type }));
        });
        el.addEventListener("dblclick", () => {
          const r = RULES.list[0];
          if (r) RULES.add(kind, b.type, r.id);
        });
        attachTip(el, (r) => Tip.text(
          b.label,
          b.param != null ? "파라미터: " + b.param + " · 규칙 칸으로 드래그"
                          : "규칙 칸으로 드래그하세요", r));
        body.appendChild(el);
      }
    }
    return;
  }

  /* ---- UI mode ---- */
  const gt = document.createElement("div");
  gt.className = "grp"; gt.textContent = "TEMPLATES";
  body.appendChild(gt);
  for (const t of TEMPLATES) {
    if (!match(t.name, t.sub)) continue;
    const el = document.createElement("div");
    el.className = "mod tpl";
    el.innerHTML = `<span class="dot"></span><div><div class="nm">${t.name}</div>
      <div class="sub">${t.sub}</div></div>`;
    el.addEventListener("click", () => ED.applyTemplate(t));
    attachTip(el, (r) => Tip.template(t, r));
    body.appendChild(el);
  }

  for (const cat of ["UI", "BASIC"]) {
    const g = document.createElement("div");
    g.className = "grp"; g.textContent = cat === "UI" ? "SCREEN MODULES" : "PRIMITIVES";
    body.appendChild(g);
    for (const m of MODULES.filter((x) => x.cat === cat)) {
      if (!match(m.name, m.sub)) continue;
      const el = document.createElement("div");
      el.className = "mod";
      el.draggable = true;
      el.innerHTML = `<span class="dot"></span><div><div class="nm">${m.name}</div>
        <div class="sub">${m.sub}</div></div>`;
      el.addEventListener("dragstart", (e) => {
        e.dataTransfer.setData("text/module", m.id);
        e.dataTransfer.effectAllowed = "copy";
        ED.dragPayload = { kind: "module", id: m.id };
      });
      el.addEventListener("dragend", () => { ED.dragPayload = null; ED.ghost = null; ED.draw(); });
      el.addEventListener("dblclick", () => ED.addModule(m, 160, 85));
      attachTip(el, (r) => Tip.module(m, r));
      body.appendChild(el);
    }
  }

  /* custom C widgets */
  if ((ED.project.code || []).length) {
    const g = document.createElement("div");
    g.className = "grp"; g.textContent = "CUSTOM (C)";
    body.appendChild(g);
    for (const m of ED.project.code) {
      if (!match(m.name, m.fn)) continue;
      const el = document.createElement("div");
      el.className = "mod app";
      el.draggable = true;
      el.innerHTML = `<span class="dot"></span><div><div class="nm">${m.name}</div>
        <div class="sub">${m.fn}()</div></div>`;
      el.addEventListener("dragstart", (e) => {
        e.dataTransfer.setData("text/custom", m.id);
        e.dataTransfer.effectAllowed = "copy";
        ED.dragPayload = { kind: "custom", id: m.id };
      });
      el.addEventListener("dragend", () => { ED.dragPayload = null; ED.ghost = null; ED.draw(); });
      el.addEventListener("dblclick", () => ED.addCustom(m.id, 160, 85));
      attachTip(el, (r) => Tip.text(m.name, m.fn + "() · C로 그리는 위젯", r));
      body.appendChild(el);
    }
  }
}
