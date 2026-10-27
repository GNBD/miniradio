/*
 * SPDX-License-Identifier: MIT
 * core/ir.js - typed intermediate representation for the mod rules.
 *
 * Only tier-1 (allowlisted) blocks reach this layer. validate.js must pass
 * with { forCodegen: true } before build() is called.
 */
(function (root, factory) {
  const S = (typeof require === "function") ? require("./schema.js") : root.MRSchema;
  const api = factory(S);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.MRIR = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (S) {
  function num(c) {
    return Number(String(c.param).trim());
  }

  function condition(c) {
    const def = S.CONDITIONS[c.type];
    if (!def || def.tier < 1) throw new Error("unsupported condition: " + c.type);
    const out = { type: c.type, op: null, value: null };
    switch (c.type) {
      case "rssi_lt": out.read = "rssi"; out.op = "<"; out.value = num(c); break;
      case "rssi_gt": out.read = "rssi"; out.op = ">"; out.value = num(c); break;
      case "snr_lt":  out.read = "snr";  out.op = "<"; out.value = num(c); break;
      case "snr_gt":  out.read = "snr";  out.op = ">"; out.value = num(c); break;
      case "freq_gt": out.read = "freq"; out.op = ">"; out.value = num(c); break;
      case "freq_lt": out.read = "freq"; out.op = "<"; out.value = num(c); break;
      case "band_is": out.read = "band"; out.op = "=="; out.value = String(c.param); break;
      case "seek_ok": out.read = "seek_ok"; break;
      default: throw new Error("unhandled condition: " + c.type);
    }
    return out;
  }

  function action(a) {
    const def = S.ACTIONS[a.type];
    if (!def || def.tier < 1) throw new Error("unsupported action: " + a.type);
    switch (a.type) {
      case "toast":
        return { type: "toast", text: String(a.param) };
      case "seek":
        return { type: "seek" };
      default:
        throw new Error("unhandled action: " + a.type);
    }
  }

  function build(project) {
    const rules = (project.rules || []).map((r, i) => {
      const event = S.EVENTS[r.when.type];
      if (!event || event.tier < 1) throw new Error("unsupported event: " + r.when.type);
      return {
        id: (r.id != null ? r.id : i + 1),
        event: r.when.type,
        element: r.when.param ? String(r.when.param) : null,
        conditions: (r.if || []).map(condition),
        actions: (r.do || []).map(action),
      };
    });
    return {
      schemaVersion: S.SCHEMA_VERSION,
      project: project.manifest.name,
      version: project.manifest.version,
      rules,
    };
  }

  return { build };
});
