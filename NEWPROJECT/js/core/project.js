/*
 * SPDX-License-Identifier: MIT
 * core/project.js - pure project normalization / migration.
 *
 * Accepts both the current format and the legacy "mrpack/1" files.
 * Never mutates the input object.
 */
(function (root, factory) {
  const S = (typeof require === "function") ? require("./schema.js") : root.MRSchema;
  const api = factory(S);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.MRProject = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (S) {
  function str(v, fallback) {
    return typeof v === "string" ? v : (fallback || "");
  }

  function num(v, fallback) {
    return (typeof v === "number" && isFinite(v)) ? v : fallback;
  }

  function clone(v) {
    return v == null ? v : JSON.parse(JSON.stringify(v));
  }

  function normalizeRule(r, index) {
    const id = (r && (r.id != null)) ? r.id : (index + 1);
    return {
      id,
      when: r && r.when ? { type: str(r.when.type), param: str(r.when.param) } : null,
      if: Array.isArray(r && r.if)
        ? r.if.map((c) => ({ type: str(c && c.type), param: str(c && c.param) }))
        : [],
      do: Array.isArray(r && r.do)
        ? r.do.map((a) => ({ type: str(a && a.type), param: str(a && a.param) }))
        : [],
    };
  }

  function normalizeManifest(m, fallback) {
    m = m || {};
    return {
      name: str(m.name, (fallback && fallback.name) || "my-radio"),
      version: str(m.version, "0.1.0"),
      author: str(m.author),
      api: num(m.api, 1),
      license: str(m.license, "MIT"),
      license_accepted: !!(m.license_accepted || (fallback && fallback.license_accepted)),
      created: str(m.created),
      generator: str(m.generator, "MINI-radio Modder Studio v1.0"),
    };
  }

  function normalize(pack, fallbackManifest) {
    pack = pack || {};
    const legacy = pack.format !== S.FORMAT;
    const ui = pack.ui || {};
    const manifest = normalizeManifest(pack.manifest, fallbackManifest);

    const rulesSrc = Array.isArray(pack.rules) ? pack.rules : [];
    const rules = rulesSrc.map(normalizeRule);

    let layouts = null;
    if (ui.layouts && typeof ui.layouts === "object") {
      layouts = {};
      for (const k of ["FM", "AM", "SSB"]) {
        layouts[k] = Array.isArray(ui.layouts[k]) ? clone(ui.layouts[k]) : [];
      }
    }
    const activeMode = ["FM", "AM", "SSB"].indexOf(ui.activeMode) >= 0
      ? ui.activeMode : "FM";

    return {
      format: S.FORMAT,
      schemaVersion: S.SCHEMA_VERSION,
      migratedFrom: legacy ? (pack.format || "unknown") : null,
      manifest,
      target: {
        board: str((pack.target && pack.target.board), "ESP32-S3-N16R8"),
        firmware: str((pack.target && pack.target.firmware), "GNBD ATS Mini"),
      },
      ui: {
        bg: str(ui.bg, "bg"),
        items: Array.isArray(ui.items) ? clone(ui.items) : [],
        layouts,
        activeMode,
      },
      code: Array.isArray(pack.code) ? clone(pack.code) : [],
      menu: Array.isArray(pack.menu) ? clone(pack.menu) : null,
      settings: Array.isArray(pack.settings) ? clone(pack.settings) : null,
      menuLayout: S.LAYOUTS.indexOf(pack.menuLayout) >= 0 ? pack.menuLayout : "v",
      settingsLayout: S.LAYOUTS.indexOf(pack.settingsLayout) >= 0 ? pack.settingsLayout : "v",
      meta: pack.meta && typeof pack.meta === "object" ? clone(pack.meta) : {},
      rules,
    };
  }

  function emptyProject(name) {
    return normalize({
      format: S.FORMAT,
      manifest: { name: name || "my-radio", version: "0.1.0" },
      ui: { bg: "bg", items: [] },
      rules: [],
    });
  }

  return { normalize, emptyProject };
});
