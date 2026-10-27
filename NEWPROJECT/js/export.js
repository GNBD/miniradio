/*
 * SPDX-License-Identifier: MIT
 * export.js - project serialization + code generation
 * Adds pack/load/exportPack/exportC/downloadC to ED.
 * depends: editor.js (ED), catalog.js
 */
Object.assign(ED, {
  pack() {
    const meta = this.project.meta || {};
    if (this.project.layouts) this.syncLayout();
    const base = {
      format: (window.MRSchema ? MRSchema.FORMAT : "gnbd-mod-project"),
      schemaVersion: (window.MRSchema ? MRSchema.SCHEMA_VERSION : 2),
      manifest: {
        name: (document.getElementById("projName").value || "my-radio").trim(),
        version: meta.version || "0.1.0",
        author: meta.author || "",
        api: 1,
        license: "MIT",
        license_accepted: !!(window.LicenseGate && LicenseGate.accepted),
        created: new Date().toISOString(),
        generator: "MINI-radio Modder Studio v1.0",
      },
      target: { board: "ESP32-S3-N16R8", firmware: "GNBD ATS Mini" },
      ui: {
        bg: this.project.bg,
        items: this.project.items,
        layouts: this.project.layouts || null,
        activeMode: this.activeLayout(),
      },
      code: this.project.code || [],
      menu: this.project.menu || null,
      settings: this.project.settings || null,
      menuLayout: this.project.menuLayout || "v",
      settingsLayout: this.project.settingsLayout || "v",
      meta: this.project.meta || {},
      rules: (window.RULES ? RULES.serialize() : []),
    };
    return window.MRProject ? MRProject.normalize(base) : base;
  },

  load(pack) {
    if (!pack || (!pack.ui && !pack.manifest)) return false;
    this.lastLoadErrors = null;
    if (window.MRValidate) {
      const chk = MRValidate.validateProject(pack, { forCodegen: false });
      if (!chk.ok) {
        this.lastLoadErrors = chk.errors;
        return false;
      }
    }
    this.snapshot();
    const n = window.MRProject ? MRProject.normalize(pack) : pack;
    const ui = n.ui || {};
    const layouts = ui.layouts || null;
    const active = (layouts && ["FM", "AM", "SSB"].indexOf(ui.activeMode) >= 0)
      ? ui.activeMode : "FM";
    this.project = {
      bg: ui.bg || "bg",
      items: layouts ? (layouts[active] || []) : (ui.items || []),
      layouts,
      activeMode: active,
      code: n.code || [],
      menu: n.menu || null,
      settings: n.settings || null,
      menuLayout: n.menuLayout || "v",
      settingsLayout: n.settingsLayout || "v",
      meta: n.meta || {},
    };
    this.project.items.forEach((w) => this.ensureUid(w));
    if (layouts) {
      for (const k of this.layoutKeys) {
        (layouts[k] || []).forEach((w) => this.ensureUid(w));
      }
    }
    this.pmode = Math.max(0, this.layoutKeys.indexOf(active));
    if (n.rules && window.RULES) RULES.load(n.rules);
    if (n.manifest) {
      document.getElementById("projName").value = n.manifest.name || "my-radio";
    }
    this.setSel(-1);
    this.dirty = false;
    this.uiDirty();
    return true;
  },

  exportPack() {
    const pack = this.pack();
    const blob = new Blob([JSON.stringify(pack, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = (pack.manifest.name || "project") + ".mrpack";
    a.click();
    URL.revokeObjectURL(a.href);
    this.dirty = false;
    this.uiDirty();
  },

  /* ---------------- C header (main/ui_custom_layout.h) ---------------- */
  exportC() {
    return MRLayoutC.generate(this.pack()).content;
  },

  downloadC() {
    const blob = new Blob([this.exportC()], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "ui_custom_layout.h";
    a.click();
    URL.revokeObjectURL(a.href);
    this.dirty = false;
    this.uiDirty();
  },
});
