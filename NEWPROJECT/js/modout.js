/*
 * SPDX-License-Identifier: MIT
 * modout.js - BLOCKS tab: validate + allowlisted mod code generation.
 *
 * Keeps the existing rule editor. Adds:
 *   - diagnostics panel (errors / warnings with rule links)
 *   - "Generate mod" -> mod_generated.h (one file)
 */
const ModOut = {
  last: null,

  panel() {
    return document.getElementById("modErrors");
  },

  clear() {
    const el = this.panel();
    if (el) { el.innerHTML = ""; el.hidden = true; }
  },

  show(result, title) {
    const el = this.panel();
    if (!el) return;
    el.innerHTML = "";
    el.hidden = false;

    const head = document.createElement("div");
    head.className = "mres " + (result.ok ? "ok" : "bad");
    head.textContent = title + " · 오류 " + result.errors.length +
      " / 경고 " + result.warnings.length;
    el.appendChild(head);

    const add = (d, cls) => {
      const row = document.createElement("div");
      row.className = "mline " + cls;
      const where = d.ruleId != null ? "RULE #" + d.ruleId + " · " : "";
      row.textContent = where + d.message + (d.path ? "  (" + d.path + ")" : "");
      if (d.ruleId != null) {
        row.title = "클릭하면 해당 규칙으로 이동";
        row.onclick = () => {
          const card = document.querySelector('#rules .rule[data-rule="' + d.ruleId + '"]');
          if (card) {
            card.scrollIntoView({ block: "center", behavior: "smooth" });
            card.classList.add("flash");
            setTimeout(() => card.classList.remove("flash"), 900);
          }
        };
      }
      el.appendChild(row);
    };

    result.errors.slice(0, 40).forEach((d) => add(d, "err"));
    result.warnings.slice(0, 20).forEach((d) => add(d, "warn"));
    if (result.errors.length > 40) {
      const more = document.createElement("div");
      more.className = "mline warn";
      more.textContent = "… 오류 " + (result.errors.length - 40) + "개 더";
      el.appendChild(more);
    }
  },

  validate() {
    const res = MRValidate.validateProject(ED.pack(), { forCodegen: false });
    this.last = res;
    this.show(res, "VALIDATE");
    return res;
  },

  generate() {
    if (window.LicenseGate && !LicenseGate.ok()) return false;
    const res = MRValidate.validateProject(ED.pack(), { forCodegen: true });
    this.last = res;
    if (!res.ok) {
      this.show(res, "GENERATE BLOCKED");
      return false;
    }
    let out;
    try {
      out = MRCodegen.generate(res.project);
    } catch (e) {
      this.show({ ok: false, errors: [{ message: e.message, path: "" }], warnings: [] },
                "GENERATE FAILED");
      return false;
    }
    this.show({ ok: true, errors: [], warnings: res.warnings }, "GENERATED");
    const blob = new Blob([out.content], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = out.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    return true;
  },
};

window.ModOut = ModOut;
