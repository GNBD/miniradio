/*
 * SPDX-License-Identifier: MIT
 * core/cgen.js - allowlist C code generator (mod_generated.h).
 *
 * The generated header is included by main/mod_runtime.c only, so static
 * helpers and function definitions are safe in a single translation unit.
 * No project string is inserted without escaping; no block type is emitted
 * unless it exists in schema.js with tier >= 1.
 *
 * Deterministic: identical project + schema => identical bytes.
 */
(function (root, factory) {
  const S = (typeof require === "function") ? require("./schema.js") : root.MRSchema;
  const IR = (typeof require === "function") ? require("./ir.js") : root.MRIR;
  const api = factory(S, IR);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.MRCodegen = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (S, IR) {
  function cstr(s) {
    /* JSON.stringify produces a valid double-quoted C string literal here:
       quotes, backslashes and control characters are escaped. */
    return JSON.stringify(String(s));
  }

  function usesRssi(rules) {
    return rules.some((r) => r.conditions.some((c) => c.read === "rssi" || c.read === "snr"));
  }

  function condExpr(c) {
    switch (c.read) {
      case "rssi": return "s_ui.rsq.rssi " + c.op + " " + c.value;
      case "snr":  return "s_ui.rsq.snr " + c.op + " " + c.value;
      case "freq": return "s_ui.freq_hz " + c.op + " " + c.value + "u";
      case "band": return "strcmp(band_table[s_ui.band_idx].name, " + cstr(c.value) + ") == 0";
      case "seek_ok": return "(s_radio_ok && !s_seeking && !band_is_ssb(s_ui.mode))";
      default: throw new Error("unsupported condition read: " + c.read);
    }
  }

  function condFn(rule, n) {
    const body = [];
    const needsRsq = rule.conditions.some((c) => c.read === "rssi" || c.read === "snr");
    if (needsRsq) body.push("    if (!s_ui.have_rsq) return false;");
    if (!rule.conditions.length) {
      body.push("    return true;");
    } else {
      body.push("    return " + rule.conditions.map(condExpr).join(" &&\n           ") + ";");
    }
    return "static bool mr_r" + n + "_cond(void)\n{\n" + body.join("\n") + "\n}";
  }

  function fireFn(rule, n, cooldown) {
    const body = [];
    if (cooldown) {
      body.push("    if (mr_r" + n + "_last &&");
      body.push("        (uint32_t)(now - mr_r" + n + "_last) < MR_COOLDOWN_MS) {");
      body.push("        return;");
      body.push("    }");
      body.push("    mr_r" + n + "_last = now;");
    } else {
      body.push("    (void)now;");
    }
    for (const a of rule.actions) {
      if (a.type === "toast") {
        body.push("    toast(" + cstr(a.text) + ");");
      } else if (a.type === "seek") {
        body.push("    if (!seek_start(true)) {");
        body.push("        ESP_LOGW(MR_TAG, \"seek rejected\");");
        body.push("    }");
      } else {
        throw new Error("unhandled action: " + a.type);
      }
    }
    body.push("    ESP_LOGI(MR_TAG, \"rule " + (n + 1) + " fired rssi=%d snr=%d\",");
    body.push("             s_ui.have_rsq ? (int)s_ui.rsq.rssi : -1,");
    body.push("             s_ui.have_rsq ? (int)s_ui.rsq.snr : -1);");
    return "static void mr_r" + n + "_fire(uint32_t now)\n{\n" + body.join("\n") + "\n}";
  }

  function isUiEvent(ev) {
    return ev === "ui_menu" || ev === "ui_settings";
  }

  function ruleState(rule, n) {
    if (isUiEvent(rule.event)) return "";
    const lines = [];
    if (rule.event === "rssi_updated" || rule.event === "timer_1s") {
      lines.push("static uint32_t mr_r" + n + "_last;");
    }
    if (rule.event === "boot_ready") {
      lines.push("static bool mr_r" + n + "_boot;");
    } else if (rule.event === "timer_1s") {
      lines.push("static bool mr_r" + n + "_prev;");
      lines.push("static uint32_t mr_r" + n + "_ms;");
    } else {
      lines.push("static bool mr_r" + n + "_prev;");
    }
    return lines.join("\n");
  }

  function ruleTick(rule, n) {
    if (rule.event === "boot_ready") {
      return [
        "    if (!mr_r" + n + "_boot) {",
        "        mr_r" + n + "_boot = true;",
        "        if (mr_r" + n + "_cond()) mr_r" + n + "_fire(now);",
        "    }",
      ].join("\n");
    }
    if (rule.event === "timer_1s") {
      return [
        "    if ((uint32_t)(now - mr_r" + n + "_ms) >= 1000u) {",
        "        mr_r" + n + "_ms = now;",
        "        bool cur" + n + " = mr_r" + n + "_cond();",
        "        if (cur" + n + " && !mr_r" + n + "_prev) mr_r" + n + "_fire(now);",
        "        mr_r" + n + "_prev = cur" + n + ";",
        "    }",
      ].join("\n");
    }
    return [
      "    {",
      "        bool cur" + n + " = mr_r" + n + "_cond();",
      "        if (cur" + n + " && !mr_r" + n + "_prev) mr_r" + n + "_fire(now);",
      "        mr_r" + n + "_prev = cur" + n + ";",
      "    }",
    ].join("\n");
  }

  function generate(project) {
    const ir = IR.build(project);
    if (!ir.rules.length) throw new Error("no rules to generate");

    const out = [];
    out.push("/*");
    out.push(" * Generated by MINI-radio Modder Studio v1.0 - do not edit by hand.");
    out.push(" * project: " + project.manifest.name + " " + project.manifest.version);
    out.push(" * schema: " + S.SCHEMA_VERSION + " (allowlist codegen)");
    out.push(" *");
    out.push(" * Included only by main/mod_runtime.c.");
    out.push(" */");
    out.push("#pragma once");
    out.push("");
    out.push("#define MODS_ENABLE 1");
    out.push("#define MOD_PROJECT_NAME " + cstr(project.manifest.name));
    out.push("#define MOD_PROJECT_VERSION " + cstr(project.manifest.version));
    out.push("");
    out.push("#include <stdbool.h>");
    out.push("#include <stdint.h>");
    out.push("#include <string.h>");
    out.push("#include \"app.h\"");
    out.push("#include \"ui.h\"");
    out.push("#include \"esp_log.h\"");
    out.push("");
    out.push("#if MODS_ENABLE");
    out.push("");
    out.push("static const char *MR_TAG = \"mod\";");
    out.push("");
    out.push("/* minimum interval between two firings of the same rule */");
    out.push("#define MR_COOLDOWN_MS 10000u");
    out.push("");
    if (usesRssi(ir.rules)) {
      out.push("/* RSSI/SNR conditions are evaluated only when s_ui.have_rsq is set. */");
      out.push("");
    }

    ir.rules.forEach((r, n) => {
      out.push("/* rule " + (n + 1) + ": " + r.event + " */");
      const st = ruleState(r, n);
      if (st) out.push(st);
      out.push(condFn(r, n));
      const cooldown = (r.event === "rssi_updated" || r.event === "timer_1s");
      out.push(fireFn(r, n, cooldown));
      out.push("");
    });

    for (const [ev, fnName] of [["ui_menu", "mod_user_menu_event"],
                                ["ui_settings", "mod_user_settings_event"]]) {
      out.push("bool " + fnName + "(int element)");
      out.push("{");
      out.push("    bool handled = false;");
      out.push("    uint32_t now = now_ms();");
      out.push("    (void)now;");
      ir.rules.forEach((r, n) => {
        if (r.event !== ev) return;
        out.push("    if (element == " + r.element + ") {");
        out.push("        handled = true;");
        out.push("        if (mr_r" + n + "_cond()) mr_r" + n + "_fire(now);");
        out.push("    }");
      });
      out.push("    return handled;");
      out.push("}");
      out.push("");
    }

    out.push("void mod_user_init(void)");
    out.push("{");
    out.push("    ESP_LOGI(MR_TAG, \"enabled project=%s version=%s rules=%d\",");
    out.push("             MOD_PROJECT_NAME, MOD_PROJECT_VERSION, " + ir.rules.length + ");");
    out.push("}");
    out.push("");
    out.push("void mod_user_tick(uint32_t now)");
    out.push("{");
    out.push("    (void)now;");
    ir.rules.forEach((r, n) => {
      if (isUiEvent(r.event)) return;
      out.push(ruleTick(r, n));
    });
    out.push("}");
    out.push("");
    out.push("#endif /* MODS_ENABLE */");
    out.push("");

    return {
      name: "mod_generated.h",
      content: out.join("\n"),
      ir,
    };
  }

  return { generate, cstr };
});
