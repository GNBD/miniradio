/*
 * SPDX-License-Identifier: MIT
 * properties.js - right panel (selection inspector)
 * depends: editor.js (ED), catalog.js (BINDINGS), editor.js (Props.sync)
 */
const COLORS = ["bg", "panel", "fg", "muted", "line", "accent", "accenth",
  "ok", "warn", "red", "track", "hsel", "none"];

const Props = {
  el(id) { return document.getElementById(id); },

  row(label, ...nodes) {
    const r = document.createElement("div");
    r.className = "row";
    const l = document.createElement("label");
    l.textContent = label;
    r.appendChild(l);
    for (const n of nodes) r.appendChild(n);
    return r;
  },

  input(value, onInput, type) {
    const i = document.createElement("input");
    i.type = type || "text";
    i.value = value == null ? "" : value;
    i.addEventListener("input", () => onInput(i.value));
    return i;
  },

  select(options, value, onInput) {
    const s = document.createElement("select");
    for (const o of options) {
      const [v, t] = Array.isArray(o) ? o : [o, o];
      const el = document.createElement("option");
      el.value = v; el.textContent = t;
      if (String(v) === String(value)) el.selected = true;
      s.appendChild(el);
    }
    s.addEventListener("change", () => onInput(s.value));
    return s;
  },

  render() {
    const body = this.el("propsBody");
    body.innerHTML = "";
    const i = ED.sel;
    if (i < 0) {
      const meta = ED.project.meta || (ED.project.meta = { version: "0.1.0", author: "" });
      const p = document.createElement("div");
      p.innerHTML = `<div class="muted">프로젝트</div>`;
      body.appendChild(p);
      body.appendChild(this.row("Version", this.input(meta.version, (v) => { meta.version = v; })));
      body.appendChild(this.row("Author", this.input(meta.author, (v) => { meta.author = v; })));
      const hint = document.createElement("div");
      hint.className = "empty";
      hint.innerHTML = `모듈을 선택하세요.<br><br>
        캔버스: 드래그 이동 &middot; 우하단 핸들 크기조절<br>
        Shift+클릭 다중선택 &middot; 방향키 미세조정<br>
        Delete 삭제 &middot; Ctrl+D 복제 &middot; Ctrl+Z 실행취소<br>
        레이어: 오른쪽 LAYERS에서 드래그 (아래 = 앞)`;
      body.appendChild(hint);
      const sep = document.createElement("div");
      sep.className = "sep";
      body.appendChild(sep);
      const cnt = document.createElement("div");
      cnt.className = "muted";
      cnt.textContent = "items: " + ED.project.items.length;
      body.appendChild(cnt);
      return;
    }
    const w = ED.project.items[i];
    const upd = () => { ED.draw(); };

    const t = this.input(w.t, () => {}, "text");
    t.disabled = true;
    body.appendChild(this.row("Type", t));

    const nameInp = this.input(w.name || "", (v) => {
      w.name = v.trim() || undefined;
      upd();
      if (window.LayerView) LayerView.render();
    });
    nameInp.placeholder = w.origin || ED.baseOf(w);
    body.appendChild(this.row("Name", nameInp));

    const g1 = document.createElement("div");
    g1.className = "grid2";
    g1.appendChild(this.input(w.x, (v) => { w.x = +v; upd(); }, "number"));
    g1.appendChild(this.input(w.y, (v) => { w.y = +v; upd(); }, "number"));
    body.appendChild(this.row("X / Y", g1));

    const g2 = document.createElement("div");
    g2.className = "grid2";
    g2.appendChild(this.input(w.w, (v) => { w.w = +v; upd(); }, "number"));
    g2.appendChild(this.input(w.h, (v) => { w.h = +v; upd(); }, "number"));
    body.appendChild(this.row("W / H", g2));
    body.querySelectorAll(".grid2 input").forEach((inp) => { inp.style.width = "100%"; });

    /* FM / AM / SSB 표시 모드 */
    {
      const row = document.createElement("div");
      row.className = "row";
      const lb = document.createElement("label");
      lb.textContent = "Modes";
      row.appendChild(lb);
      const box = document.createElement("div");
      box.style.cssText = "display:flex;gap:10px;font-size:11px";
      ["FM", "AM", "SSB"].forEach((name, bit) => {
        const lab = document.createElement("label");
        lab.style.cssText = "display:flex;align-items:center;gap:3px";
        const cb = document.createElement("input");
        cb.type = "checkbox";
        const cur = w.modes == null ? 7 : w.modes;
        cb.checked = (cur & (1 << bit)) !== 0;
        cb.addEventListener("change", () => {
          let m = w.modes == null ? 7 : w.modes;
          m = cb.checked ? (m | (1 << bit)) : (m & ~(1 << bit));
          w.modes = m;
          upd();
        });
        lab.appendChild(cb);
        lab.appendChild(document.createTextNode(name));
        box.appendChild(lab);
      });
      row.appendChild(box);
      body.appendChild(row);
    }

    {
      const hide = document.createElement("input");
      hide.type = "checkbox";
      hide.checked = !!w.hidden;
      hide.addEventListener("change", () => {
        w.hidden = hide.checked;
        ED.draw();
      });
      body.appendChild(this.row("Hide", hide));
    }

    /* 레이어 / 상속 */
    {
      const lz = this.input(w.z == null ? 0 : w.z, (v) => { w.z = +v; upd(); }, "number");
      const up = document.createElement("button");
      up.className = "btn"; up.textContent = "▲"; up.title = "레이어 +1";
      up.style.padding = "3px 7px";
      up.onclick = () => { w.z = (w.z || 0) + 1; upd(); Props.render(); };
      const dn = document.createElement("button");
      dn.className = "btn"; dn.textContent = "▼"; dn.title = "레이어 -1";
      dn.style.padding = "3px 7px";
      dn.onclick = () => { w.z = (w.z || 0) - 1; upd(); Props.render(); };
      body.appendChild(this.row("Layer", lz, up, dn));
    }
    {
      const others = ED.project.items.filter((x) => x !== w && x.uid);
      const opts = [["", "— none —"]].concat(others.map((x) =>
        [String(x.uid), (x.t || "?") + (x.bind ? "/" + x.bind : "") + " #" + x.uid]));
      body.appendChild(this.row("Inherit", this.select(opts, w.parent || "",
        (v) => { w.parent = v || undefined; upd(); })));
      if (w.parent) {
        const n = document.createElement("div");
        n.className = "empty";
        n.textContent = "부모의 레이어를 그대로 사용 (동일 레이어)";
        body.appendChild(n);
      }
    }

    if (w.t === "text") {
      body.appendChild(this.row("Bind", this.select(BINDINGS, w.bind || "", (v) => { w.bind = v || undefined; upd(); })));
      body.appendChild(this.row("Text", this.input(w.text || "", (v) => { w.text = v; upd(); })));
      body.appendChild(this.row("Size", this.select(["tiny", "small", "large"], w.size || "tiny", (v) => { w.size = v; upd(); })));
      body.appendChild(this.row("Align", this.select([["l", "Left"], ["c", "Center"], ["r", "Right"]], w.align || "l", (v) => { w.align = v; upd(); })));
      body.appendChild(this.row("Color", this.select(COLORS, w.color || "fg", (v) => { w.color = v; upd(); })));
      body.appendChild(this.row("Chip", this.select([["", "off"], ["1", "on"]], w.chip ? "1" : "", (v) => { w.chip = v ? 1 : undefined; upd(); })));
    } else if (w.t === "rect") {
      body.appendChild(this.row("Fill", this.select(COLORS, w.fill || "panel", (v) => { w.fill = v; upd(); })));
      body.appendChild(this.row("Stroke", this.select(COLORS, w.stroke || "none", (v) => { w.stroke = v; upd(); })));
      body.appendChild(this.row("Radius", this.input(w.r || 0, (v) => { w.r = +v; upd(); }, "number")));
    } else if (w.t === "bar") {
      body.appendChild(this.row("Bind", this.select(BINDINGS, w.bind || "", (v) => { w.bind = v; upd(); })));
      body.appendChild(this.row("Max", this.input(w.max || 63, (v) => { w.max = +v; upd(); }, "number")));
      body.appendChild(this.row("Color", this.select(COLORS, w.color || "ok", (v) => { w.color = v; upd(); })));
    } else if (w.t === "line") {
      body.appendChild(this.row("Color", this.select(COLORS, w.color || "line", (v) => { w.color = v; upd(); })));
    } else if (w.t === "custom") {
      const mods = (ED.project.code || []).map((m) => [m.id, m.name]);
      body.appendChild(this.row("Module", this.select(mods, w.mod || "", (v) => { w.mod = v; upd(); })));
    } else if (w.t === "menu") {
      const info = document.createElement("div");
      info.className = "empty";
      info.innerHTML = `설계 가이드입니다. 실제 패널은 펌웨어가 그리고,<br>
        이 모듈은 위치/크기만 보여줍니다 (내보내기 제외).`;
      body.appendChild(info);
      body.appendChild(this.row("List", this.select(
        [["menu", "MENU"], ["settings", "SETTINGS"]], w.kind || "menu",
        (v) => { w.kind = v; upd(); })));
    } else {
      const n = document.createElement("div");
      n.className = "empty";
      n.textContent = "이 모듈은 위치/크기만 조정합니다 (내용은 펌웨어가 그림).";
      body.appendChild(n);
    }

    const sep = document.createElement("div");
    sep.className = "sep";
    body.appendChild(sep);
    const btns = document.createElement("div");
    btns.className = "grid2";
    const d1 = document.createElement("button");
    d1.className = "btn"; d1.textContent = "복제"; d1.onclick = () => ED.dup();
    const d2 = document.createElement("button");
    d2.className = "btn"; d2.textContent = "삭제"; d2.onclick = () => ED.del();
    btns.appendChild(d1); btns.appendChild(d2);
    body.appendChild(btns);
  },

  /* keep numeric fields in sync while dragging */
  sync() {
    const i = ED.sel;
    if (i < 0) return;
    const w = ED.project.items[i];
    const nums = this.el("propsBody").querySelectorAll(".grid2 input[type=number]");
    if (nums.length === 4) {
      if (document.activeElement !== nums[0]) nums[0].value = w.x;
      if (document.activeElement !== nums[1]) nums[1].value = w.y;
      if (document.activeElement !== nums[2]) nums[2].value = w.w;
      if (document.activeElement !== nums[3]) nums[3].value = w.h;
    }
  },
};
