/*
 * SPDX-License-Identifier: MIT
 * Node tests for the pure project core (no DOM, no firmware).
 *
 *   node --test NEWPROJECT/test
 */
const test = require("node:test");
const assert = require("node:assert");

const fs = require("node:fs");
const path = require("node:path");

const S = require("../js/core/schema.js");
const P = require("../js/core/project.js");
const V = require("../js/core/validate.js");
const IR = require("../js/core/ir.js");
const C = require("../js/core/cgen.js");
const M = require("../js/core/menu_c.js");
const L = require("../js/core/layout_c.js");

const SAMPLE = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../samples/sample-a.mrpack"), "utf8"));

function clone(o) {
  return JSON.parse(JSON.stringify(o));
}

test("schema exposes v2 and limits", () => {
  assert.equal(S.SCHEMA_VERSION, 2);
  assert.equal(S.FORMAT, "gnbd-mod-project");
  assert.ok(S.LIMITS.rules > 0);
  assert.equal(S.tierOf("when", "rssi_updated"), 1);
  assert.equal(S.tierOf("when", "encoder_turn"), 0);
});

test("sample A passes codegen validation", () => {
  const res = V.validateProject(clone(SAMPLE), { forCodegen: true });
  assert.equal(res.ok, true, JSON.stringify(res.errors));
  assert.equal(res.project.rules.length, 1);
});

test("legacy mrpack/1 is migrated and preserved", () => {
  const legacy = {
    format: "mrpack/1",
    manifest: { name: "old", version: "0.1.0" },
    ui: { bg: "bg", items: [] },
    rules: [{ when: { type: "timer_1s" }, if: [], do: [] }],
  };
  const p = P.normalize(legacy);
  assert.equal(p.format, S.FORMAT);
  assert.equal(p.schemaVersion, 2);
  assert.equal(p.migratedFrom, "mrpack/1");
  assert.equal(p.rules[0].when.type, "timer_1s");
});

test("unsupported block is warned in validate, rejected in codegen", () => {
  const p = clone(SAMPLE);
  p.rules[0].do = [{ type: "tune_to", param: "1000000" }];
  const soft = V.validateProject(p, { forCodegen: false });
  assert.ok(soft.warnings.some((w) => w.code === "W_UNSUPPORTED"));
  const res = V.validateProject(p, { forCodegen: true });
  assert.equal(res.ok, false);
  assert.ok(res.errors.some((e) => e.code === "E_UNSUPPORTED"));
});

test("numeric range is enforced", () => {
  const p = clone(SAMPLE);
  p.rules[0].if[0].param = "99";
  const res = V.validateProject(p, { forCodegen: true });
  assert.equal(res.ok, false);
  assert.ok(res.errors.some((e) => e.code === "E_PARAM_RANGE"));
});

test("non numeric param is rejected", () => {
  const p = clone(SAMPLE);
  p.rules[0].if[0].param = "abc";
  const res = V.validateProject(p, { forCodegen: true });
  assert.equal(res.ok, false);
  assert.ok(res.errors.some((e) => e.code === "E_PARAM_NUM"));
});

test("toast length limit uses bytes", () => {
  const p = clone(SAMPLE);
  p.rules[0].do[0].param = "x".repeat(S.LIMITS.toastBytes + 1);
  const res = V.validateProject(p, { forCodegen: true });
  assert.equal(res.ok, false);
  assert.ok(res.errors.some((e) => e.code === "E_TOAST_LEN"));
});

test("unknown widget type and color are rejected", () => {
  const p = clone(SAMPLE);
  p.ui.items = [
    { t: "hologram", x: 0, y: 0, w: 10, h: 10 },
    { t: "rect", x: 0, y: 0, w: 10, h: 10, fill: "neon" },
  ];
  const res = V.validateProject(p, { forCodegen: false });
  assert.ok(res.errors.some((e) => e.code === "E_WIDGET_TYPE"));
  assert.ok(res.errors.some((e) => e.code === "E_WIDGET_COLOR"));
});

test("layer inheritance cycle is detected", () => {
  const p = clone(SAMPLE);
  p.ui.items = [
    { t: "rect", uid: 1, parent: 2, x: 0, y: 0, w: 10, h: 10 },
    { t: "rect", uid: 2, parent: 1, x: 0, y: 0, w: 10, h: 10 },
  ];
  const res = V.validateProject(p, { forCodegen: false });
  assert.ok(res.errors.some((e) => e.code === "E_PARENT_CYCLE"));
});

test("IR keeps typed condition values", () => {
  const res = V.validateProject(clone(SAMPLE), { forCodegen: true });
  const ir = IR.build(res.project);
  assert.equal(ir.rules[0].event, "rssi_updated");
  assert.deepEqual(ir.rules[0].conditions[0], {
    type: "rssi_lt", op: "<", value: 15, read: "rssi",
  });
  assert.deepEqual(ir.rules[0].actions[0], { type: "toast", text: "WEAK SIGNAL" });
});

test("generated C is deterministic and uses the allowlist", () => {
  const res = V.validateProject(clone(SAMPLE), { forCodegen: true });
  const a = C.generate(res.project);
  const b = C.generate(res.project);
  assert.equal(a.name, "mod_generated.h");
  assert.equal(a.content, b.content);
  assert.match(a.content, /#define MODS_ENABLE 1/);
  assert.match(a.content, /s_ui\.rsq\.rssi < 15/);
  assert.match(a.content, /!mr_r0_prev/);
  assert.match(a.content, /MR_COOLDOWN_MS/);
  assert.match(a.content, /toast\("WEAK SIGNAL"\)/);
  assert.doesNotMatch(a.content, /tune_to|seek_start/);
});

test("C string escaping", () => {
  assert.equal(C.cstr('A"B\\C'), '"A\\"B\\\\C"');
});

test("generator refuses an empty rule list", () => {
  const p = clone(SAMPLE);
  p.rules = [];
  const res = V.validateProject(p, { forCodegen: true });
  assert.equal(res.ok, false);
  assert.ok(res.errors.some((e) => e.code === "E_RULES_EMPTY"));
  assert.throws(() => C.generate(res.project));
});

test("future schema version is rejected", () => {
  const p = clone(SAMPLE);
  p.schemaVersion = 99;
  const res = V.validateProject(p, { forCodegen: true });
  assert.ok(res.errors.some((e) => e.code === "E_SCHEMA_FUTURE"));
});

/* ---------------- UI element <-> block rule integration ---------------- */

const UI_SAMPLE = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../samples/sample-ui-menu.mrpack"), "utf8"));

test("UI menu sample validates and generates event dispatch", () => {
  const res = V.validateProject(clone(UI_SAMPLE), { forCodegen: true });
  assert.equal(res.ok, true, JSON.stringify(res.errors));
  const out = C.generate(res.project);
  assert.match(out.content, /bool mod_user_menu_event\(int element\)/);
  assert.match(out.content, /element == RM_MOD_A/);
  assert.match(out.content, /seek_start\(true\)/);
  assert.match(out.content, /s_radio_ok && !s_seeking && !band_is_ssb/);
  assert.doesNotMatch(out.content, /mr_r0_prev/);
  assert.doesNotMatch(out.content, /mr_r0_last/);
});

test("deleting a referenced UI element is an error", () => {
  const p = clone(UI_SAMPLE);
  p.menu = p.menu.filter((x) => x.id !== "RM_MOD_A");
  const res = V.validateProject(p, { forCodegen: true });
  assert.equal(res.ok, false);
  assert.ok(res.errors.some((e) => e.code === "E_ELEMENT_REF"));
});

test("hidden UI element is a warning, not silent", () => {
  const p = clone(UI_SAMPLE);
  p.menu.find((x) => x.id === "RM_MOD_A").visible = 0;
  const res = V.validateProject(p, { forCodegen: true });
  assert.equal(res.ok, true);
  assert.ok(res.warnings.some((w) => w.code === "W_ELEMENT_HIDDEN"));
});

test("duplicate UI element ids are rejected", () => {
  const p = clone(UI_SAMPLE);
  p.menu.push({ id: "RM_MOD_A", label: "DUP", visible: 1 });
  const res = V.validateProject(p, { forCodegen: true });
  assert.equal(res.ok, false);
  assert.ok(res.errors.some((e) => e.code === "E_ELEMENT_DUP"));
});

test("UI sample menu C keeps ids and label", () => {
  const res = V.validateProject(clone(UI_SAMPLE), { forCodegen: true });
  const out = M.generate(res.project, "menu");
  assert.equal(out.name, "menu_data.c");
  assert.match(out.content, /\{ RM_MOD_A, "MOD SCAN", 1 \}/);
  assert.match(out.content, /\{ RM_BACK, "< BACK", 1 \}/);
  assert.match(out.content, /g_menu_items = s_menu/);
});

test("per-mode UI layouts survive normalization and validation", () => {
  const p = clone(SAMPLE);
  p.ui.layouts = {
    FM: [{ t: "rect", x: 0, y: 0, w: 10, h: 10 }],
    AM: [{ t: "text", x: 0, y: 0, w: 20, h: 10, text: "AM" }],
    SSB: [{ t: "rect", x: 5, y: 5, w: 20, h: 20, fill: "panel" }],
  };
  p.ui.activeMode = "AM";
  const res = V.validateProject(p, { forCodegen: false });
  assert.equal(res.ok, true, JSON.stringify(res.errors));
  assert.equal(res.project.ui.layouts.FM.length, 1);
  assert.equal(res.project.ui.layouts.AM[0].text, "AM");
  assert.equal(res.project.ui.activeMode, "AM");
});

test("bad widget inside one mode layout is caught with its path", () => {
  const p = clone(SAMPLE);
  p.ui.layouts = {
    FM: [], AM: [], SSB: [{ t: "hologram", x: 0, y: 0, w: 10, h: 10 }],
  };
  const res = V.validateProject(p, { forCodegen: false });
  assert.ok(res.errors.some((e) => e.code === "E_WIDGET_TYPE" &&
    e.path.indexOf("ui.layouts.SSB") === 0));
});

test("layout C emits one forced mask per mode", () => {
  const p = clone(SAMPLE);
  p.ui.layouts = {
    FM: [{ t: "rect", x: 1, y: 2, w: 10, h: 10, fill: "panel" }],
    AM: [{ t: "text", x: 3, y: 4, w: 20, h: 10, text: "AM" }],
    SSB: [{ t: "bar", x: 5, y: 6, w: 30, h: 8, bind: "rssi", max: 63 }],
  };
  const out = L.generate(p);
  assert.equal(out.name, "ui_custom_layout.h");
  assert.match(out.content, /UC_RECT/);
  assert.match(out.content, /UC_M_FM/);
  assert.match(out.content, /UC_M_AM/);
  assert.match(out.content, /UC_M_SSB/);
  assert.match(out.content, /UI_CUSTOM_ENABLE 1/);
  assert.equal(L.generate(p).content, out.content);
});

test("UI settings event generates a separate dispatcher", () => {
  const p = clone(SAMPLE);
  p.rules = [{
    id: 1,
    when: { type: "ui_settings", param: "ST_MOD_A" },
    if: [], do: [{ type: "toast", param: "SET OK" }],
  }];
  const res = V.validateProject(p, { forCodegen: true });
  assert.equal(res.ok, true, JSON.stringify(res.errors));
  const out = C.generate(res.project);
  assert.match(out.content, /mod_user_settings_event/);
  assert.match(out.content, /element == ST_MOD_A/);
  assert.match(out.content, /SET OK/);
});

test("missing settings element reference is rejected", () => {
  const p = clone(SAMPLE);
  p.settings = [
    { id: "ST_BACK", label: "< BACK", visible: 1 },
    { id: "ST_ABOUT", label: "ABOUT", visible: 1 },
  ];
  p.rules = [{
    id: 1, when: { type: "ui_settings", param: "ST_MOD_A" },
    if: [], do: [{ type: "toast", param: "X" }],
  }];
  const res = V.validateProject(p, { forCodegen: true });
  assert.ok(res.errors.some((e) => e.code === "E_ELEMENT_REF"));
});

test("menu MOD slots A-H are known elements", () => {
  for (const c of "ABCDEFGH") {
    assert.ok(S.elementIds("menu").indexOf("RM_MOD_" + c) >= 0);
    assert.ok(S.elementIds("settings").indexOf("ST_MOD_" + c) >= 0);
  }
});

test("legacy single layout still uses widget mode masks", () => {
  const p = clone(SAMPLE);
  p.ui.items = [{ t: "text", x: 0, y: 0, w: 20, h: 10, text: "A", modes: 2 }];
  const out = L.generate(p);
  assert.match(out.content, /\.modes = UC_M_AM/);
  assert.doesNotMatch(out.content, /UC_M_FM/);
});

