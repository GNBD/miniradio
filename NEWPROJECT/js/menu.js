/*
 * SPDX-License-Identifier: MIT
 * menu.js - list editors for the firmware menus.
 *
 * Two instances share one implementation:
 *   MenuEd -> radio menu      -> main/menu_data.c
 *   SetEd  -> settings menu   -> main/settings_data.c
 *
 * Model: ED.project[cfg.key] = [{ id, label, visible }]
 * The first item (BACK) is pinned: no delete / no drag / always visible.
 */
function makeListEd(cfg) {
  const ed = {
    cfg,

    list() {
      if (!ED.project[cfg.key]) {
        ED.project[cfg.key] = cfg.ids.map(([id, label]) => ({ id, label, visible: true }));
      }
      const l = ED.project[cfg.key];
      if (!l.length || l[0].id !== cfg.pin) {
        l.unshift({ id: cfg.pin, label: cfg.pinLabel, visible: true });
      }
      l[0].visible = true;
      return l;
    },

    render() {
      const l = this.list();
      const root = document.getElementById(cfg.listId);
      root.innerHTML = "";
      const sel = document.getElementById(cfg.layoutSel);
      if (sel) sel.value = ED.project[cfg.layoutKey] || "v";

      l.forEach((it, i) => {
        const pin = i === 0;
        const row = document.createElement("div");
        row.className = "mrow" + (pin ? " pin" : "");
        row.draggable = !pin;

        const grip = document.createElement("span");
        grip.className = "grip";
        grip.textContent = pin ? "🔒" : "≡";
        row.appendChild(grip);

        const id = document.createElement("span");
        id.className = "id";
        id.textContent = it.id;
        row.appendChild(id);

        const lb = document.createElement("input");
        lb.type = "text";
        lb.value = it.label;
        lb.maxLength = 12;
        lb.addEventListener("input", () => {
          it.label = lb.value;
          ED.dirty = true; ED.uiDirty();
          this.preview();
        });
        row.appendChild(lb);

        const on = document.createElement("label");
        on.className = "on";
        const cb = document.createElement("input");
        cb.type = "checkbox";
        cb.checked = it.visible;
        cb.disabled = pin;
        cb.addEventListener("change", () => {
          it.visible = cb.checked;
          ED.dirty = true; ED.uiDirty();
          this.preview();
        });
        on.appendChild(cb);
        on.appendChild(document.createTextNode("표시"));
        row.appendChild(on);

        if (!pin) {
          const del = document.createElement("button");
          del.className = "del";
          del.textContent = "삭제";
          del.addEventListener("click", () => {
            l.splice(i, 1);
            ED.dirty = true; ED.uiDirty();
            this.render();
          });
          row.appendChild(del);

          row.addEventListener("dragstart", (e) => {
            e.dataTransfer.setData("text/listrow", String(i));
            e.dataTransfer.effectAllowed = "move";
          });
          row.addEventListener("dragover", (e) => e.preventDefault());
          row.addEventListener("drop", (e) => {
            e.preventDefault();
            const from = parseInt(e.dataTransfer.getData("text/listrow"), 10);
            if (isNaN(from) || from === i) return;
            const [m] = l.splice(from, 1);
            l.splice(i, 0, m);
            ED.dirty = true; ED.uiDirty();
            this.render();
          });
        }

        root.appendChild(row);
      });

      this.preview();
    },

    preview() {
      const rows = document.getElementById(cfg.prevId);
      rows.innerHTML = "";
      const layout = (ED.project[cfg.layoutKey] || "v");
      rows.className = layout === "h" ? "mph" : "";
      const l = this.list();
      let shown = 0;
      for (let i = 0; i < l.length; ++i) {
        if (!l[i].visible) continue;
        ++shown;
        const d = document.createElement("div");
        d.className = "mpr" + (shown === 1 ? " hi" : "");
        d.innerHTML = layout === "h"
          ? `<b>${l[i].label}</b>`
          : `<b>${l[i].label}</b><span>${shown}</span>`;
        rows.appendChild(d);
      }
    },

    add(id) {
      const l = this.list();
      if (l.some((x) => x.id === id)) return;
      const def = cfg.ids.find(([k]) => k === id);
      l.push({ id, label: def ? def[1] : id, visible: true });
      ED.dirty = true; ED.uiDirty();
      this.render();
      buildPalette(MODE);
    },

    /* 삭제된 기본 항목을 기본 라벨로 복구 */
    restore() {
      const l = this.list();
      const have = new Set(l.map((x) => x.id));
      const missing = cfg.ids.filter(([id]) => !have.has(id));
      if (!missing.length) {
        alert("복구할 항목이 없습니다.");
        return;
      }
      if (!confirm("삭제된 기본 항목 " + missing.length + "개를 복구할까요?\n라벨은 기본값으로 돌아갑니다.")) {
        return;
      }
      for (const [id, label] of missing) {
        l.push({ id, label, visible: true });
      }
      ED.dirty = true; ED.uiDirty();
      this.render();
      buildPalette(MODE);
    },

    toC() {
      if (window.MRMenuC) {
        return MRMenuC.generate(ED.pack(), cfg.key).content;
      }
      const l = this.list();
      const lines = l.map((it) =>
        `    { ${it.id}, "${it.label.replace(/"/g, '\\"')}", ${it.visible ? 1 : 0} },`);
      return [
        "/* Generated by NEWPROJECT Modder Studio - do not edit by hand.",
        " * Drop this file into main/" + cfg.file + " and rebuild. */",
        "#include \"menu_data.h\"",
        "",
        "#define " + cfg.layoutMacro + " " +
          ((ED.project[cfg.layoutKey] || "v") === "h" ? 1 : 0),
        "",
        "static const menu_entry_t " + cfg.arr + "[] = {",
        lines.join("\n"),
        "};",
        "",
        "const menu_entry_t *" + cfg.items + " = " + cfg.arr + ";",
        "const int " + cfg.count + " = (int)(sizeof(" + cfg.arr + ") / sizeof(" + cfg.arr + "[0]));",
        "",
      ].join("\n");
    },

    download() {
      const blob = new Blob([this.toC()], { type: "text/plain" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = cfg.file;
      a.click();
      URL.revokeObjectURL(a.href);
      ED.dirty = false;
      ED.uiDirty();
    },
  };
  return ed;
}

const MenuEd = makeListEd({
  key: "menu", ids: MENU_IDS, pin: "RM_BACK", pinLabel: "< BACK",
  listId: "menuList", prevId: "mpRows", file: "menu_data.c",
  arr: "s_menu", items: "g_menu_items", count: "g_menu_count",
  layoutKey: "menuLayout", layoutSel: "menuLayoutSel", layoutMacro: "MENU_LAYOUT_H",
});

const SetEd = makeListEd({
  key: "settings", ids: SET_IDS, pin: "ST_BACK", pinLabel: "< BACK",
  listId: "setList", prevId: "spRows", file: "settings_data.c",
  arr: "s_set", items: "g_set_items", count: "g_set_count",
  layoutKey: "settingsLayout", layoutSel: "setLayoutSel", layoutMacro: "SETTINGS_LAYOUT_H",
});
