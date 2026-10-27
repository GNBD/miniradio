/*
 * SPDX-License-Identifier: MIT
 * Block logic editor (WHEN / IF / DO) -> rules.json
 */
const RULES = {
  list: [],
  seq: 1,

  reset() {
    this.list = [{ id: this.seq++, when: null, if: [], do: [] }];
    this.render();
  },

  addRule() {
    this.list.push({ id: this.seq++, when: null, if: [], do: [] });
    this.render();
  },

  delRule(id) {
    this.list = this.list.filter((r) => r.id !== id);
    if (!this.list.length) this.addRule();
    else this.render();
  },

  def(kind, type) {
    return (BLOCKS[kind] || []).find((d) => d.type === type);
  },

  add(kind, type, ruleId) {
    const r = this.list.find((x) => x.id === ruleId);
    const d = this.def(kind, type);
    if (!r || !d) return;
    const item = { type, param: d.param != null ? String(d.param) : "" };
    if (kind === "when") r.when = item;
    else r[kind].push(item);
    this.render();
  },

  remove(kind, ruleId, idx) {
    const r = this.list.find((x) => x.id === ruleId);
    if (!r) return;
    if (kind === "when") r.when = null;
    else r[kind].splice(idx, 1);
    this.render();
  },

  setParam(kind, ruleId, idx, value) {
    const r = this.list.find((x) => x.id === ruleId);
    if (!r) return;
    if (kind === "when") { if (r.when) r.when.param = value; }
    else if (r[kind][idx]) r[kind][idx].param = value;
  },

  chip(kind, ruleId, item, idx) {
    const d = this.def(kind, item.type);
    const label = d ? d.label : item.type;
    const el = document.createElement("span");
    el.className = "chip";
    el.dataset.k = kind; el.dataset.r = ruleId; el.dataset.i = idx;
    el.draggable = true;
    el.innerHTML = `<b>${label}</b>`;
    if (d && d.element) {
      const sel = document.createElement("select");
      sel.className = "par";
      let list = [];
      try {
        if (d.element === "menu" && typeof MenuEd !== "undefined") list = MenuEd.list();
        else if (d.element === "settings" && typeof SetEd !== "undefined") list = SetEd.list();
      } catch (e) { list = []; }
      if (!list.length) {
        const fallback = d.element === "menu" ? MENU_IDS : SET_IDS;
        list = fallback.map(([id, label]) => ({ id, label }));
      }
      for (const el of list) {
        const o = document.createElement("option");
        o.value = el.id;
        o.textContent = (el.label || el.id) + " (" + el.id + ")";
        sel.appendChild(o);
      }
      if (item.param) sel.value = item.param;
      sel.addEventListener("change", () => this.setParam(kind, ruleId, idx, sel.value));
      el.appendChild(sel);
    } else if (d && d.param != null) {
      const inp = document.createElement("input");
      inp.className = "par";
      inp.value = item.param || "";
      inp.type = d.num ? "number" : "text";
      inp.addEventListener("input", () => this.setParam(kind, ruleId, idx, inp.value));
      el.appendChild(inp);
    }
    const x = document.createElement("button");
    x.className = "x"; x.textContent = "×";
    x.addEventListener("click", () => this.remove(kind, ruleId, idx));
    el.appendChild(x);
    el.addEventListener("dragstart", (e) => {
      e.dataTransfer.setData("text/move", JSON.stringify({ kind, ruleId, idx }));
      e.dataTransfer.effectAllowed = "move";
    });
    return el;
  },

  zone(kind, ruleId) {
    const z = document.createElement("div");
    z.className = "zone";
    z.dataset.k = kind; z.dataset.r = ruleId;
    z.addEventListener("dragover", (e) => { e.preventDefault(); z.classList.add("over"); });
    z.addEventListener("dragleave", () => z.classList.remove("over"));
    z.addEventListener("drop", (e) => {
      e.preventDefault();
      z.classList.remove("over");
      const mv = e.dataTransfer.getData("text/move");
      const nb = e.dataTransfer.getData("text/block");
      if (nb) {
        const d = JSON.parse(nb);
        if (d.kind === kind) this.add(kind, d.type, ruleId);
        return;
      }
      if (mv) {
        const m = JSON.parse(mv);
        if (m.kind === kind) return;         /* same lane: ignore */
        const r = this.list.find((x) => x.id === ruleId);
        if (!r) return;
        const src = m.kind === "when" ? r.when : r[m.kind][m.idx];
        if (!src) return;
        if (m.kind === "when") r.when = null; else r[m.kind].splice(m.idx, 1);
        if (kind === "when") r.when = src; else r[kind].push(src);
        this.render();
      }
    });
    return z;
  },

  render() {
    const root = document.getElementById("rules");
    root.innerHTML = "";
    for (const r of this.list) {
      const card = document.createElement("div");
      card.className = "rule";
      card.dataset.rule = r.id;
      const h = document.createElement("h4");
      h.innerHTML = `<span>RULE #${r.id}</span>`;
      const del = document.createElement("button");
      del.textContent = "삭제";
      del.addEventListener("click", () => this.delRule(r.id));
      h.appendChild(del);
      card.appendChild(h);

      for (const kind of ["when", "if", "do"]) {
        const lane = document.createElement("div");
        lane.className = "lane";
        const lb = document.createElement("div");
        lb.className = "lb";
        lb.textContent = kind === "when" ? "WHEN" : kind === "if" ? "IF" : "DO";
        lane.appendChild(lb);
        const z = this.zone(kind, r.id);
        if (kind === "when") {
          if (r.when) z.appendChild(this.chip(kind, r.id, r.when, 0));
        } else {
          r[kind].forEach((it, i) => z.appendChild(this.chip(kind, r.id, it, i)));
        }
        lane.appendChild(z);
        card.appendChild(lane);
      }
      root.appendChild(card);
    }
  },

  load(arr) {
    this.list = (arr || []).map((r) => ({
      id: this.seq++,
      when: r.when ? { type: r.when.type, param: r.when.param || "" } : null,
      if: (r.if || []).map((x) => ({ type: x.type, param: x.param || "" })),
      do: (r.do || []).map((x) => ({ type: x.type, param: x.param || "" })),
    }));
    if (!this.list.length) this.list = [{ id: this.seq++, when: null, if: [], do: [] }];
    this.render();
  },

  serialize() {
    return this.list.map((r) => ({
      id: r.id,
      when: r.when, if: r.if, do: r.do,
    }));
  },

  /* 샘플 A: RSSI 임계값 진입 시 토스트 */
  sampleA() {
    this.list = [{
      id: this.seq++,
      when: { type: "rssi_updated", param: "" },
      if: [{ type: "rssi_lt", param: "15" }],
      do: [{ type: "toast", param: "WEAK SIGNAL" }],
    }];
    this.render();
  },

  /* 샘플 UI: 메뉴 항목 SCAN 활성화 -> SEEK */
  sampleUi() {
    try {
      if (typeof MenuEd !== "undefined") {
        const l = MenuEd.list();
        const it = l.find((x) => x.id === "RM_MOD_A");
        if (it) { it.visible = true; it.label = "MOD SCAN"; }
        else l.push({ id: "RM_MOD_A", label: "MOD SCAN", visible: true });
      }
    } catch (e) { /* menu editor not ready */ }
    this.list = [{
      id: this.seq++,
      when: { type: "ui_menu", param: "RM_MOD_A" },
      if: [{ type: "seek_ok", param: "" }],
      do: [{ type: "seek", param: "" }],
    }];
    this.render();
  },
};
