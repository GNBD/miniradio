#!/usr/bin/env node
/*
 * SPDX-License-Identifier: MIT
 * tools/build-project.js - validate a project and emit firmware files.
 *
 * Usage:
 *   node NEWPROJECT/tools/build-project.js <pack> [outDir]
 *
 * Writes:
 *   mod_generated.h   (always)
 *   menu_data.c       (when project.menu is present)
 *   settings_data.c   (when project.settings is present)
 */
const fs = require("fs");
const path = require("path");

const V = require("../js/core/validate.js");
const C = require("../js/core/cgen.js");
const M = require("../js/core/menu_c.js");
const L = require("../js/core/layout_c.js");

function main(rawArgv) {
  const wantLayout = rawArgv.indexOf("--layout") >= 0;
  const argv = rawArgv.filter((a) => a !== "--layout");
  const input = argv[0];
  if (!input) {
    console.error("usage: node NEWPROJECT/tools/build-project.js <pack> [outDir] [--layout]");
    return 2;
  }
  const outDir = path.resolve(argv[1] || path.join(__dirname, "..", "..", "main"));
  const raw = JSON.parse(fs.readFileSync(input, "utf8"));
  const res = V.validateProject(raw, { forCodegen: true });

  for (const w of res.warnings) {
    console.warn("warning [" + w.code + "] " + w.message +
      (w.ruleId != null ? " (rule " + w.ruleId + ")" : ""));
  }
  if (!res.ok) {
    for (const e of res.errors) {
      console.error("error [" + e.code + "] " + e.message +
        (e.path ? " at " + e.path : "") +
        (e.ruleId != null ? " (rule " + e.ruleId + ")" : ""));
    }
    console.error("validation failed: " + res.errors.length + " error(s)");
    return 1;
  }

  const out = C.generate(res.project);
  fs.mkdirSync(outDir, { recursive: true });
  const files = [out];

  if (res.project.menu !== null) files.push(M.generate(res.project, "menu"));
  if (res.project.settings !== null) files.push(M.generate(res.project, "settings"));
  if (wantLayout) files.push(L.generate(res.project));

  for (const f of files) {
    const dst = path.join(outDir, f.name);
    fs.writeFileSync(dst, f.content, "utf8");
    console.log("wrote   : " + dst + " (" + Buffer.byteLength(f.content) + " bytes)");
  }
  console.log("project : " + res.project.manifest.name + " " + res.project.manifest.version);
  console.log("rules   : " + out.ir.rules.length);
  return 0;
}

process.exitCode = main(process.argv.slice(2));
