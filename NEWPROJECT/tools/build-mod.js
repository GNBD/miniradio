#!/usr/bin/env node
/*
 * SPDX-License-Identifier: MIT
 * tools/build-mod.js - validate a .mrpack and emit mod_generated.h.
 *
 * Usage:
 *   node NEWPROJECT/tools/build-mod.js <pack> [outDir]
 *
 * This is the local counterpart of the browser's "Generate mod" button.
 * It shares the exact same core modules (schema/validate/ir/cgen).
 */
const fs = require("fs");
const path = require("path");

const S = require("../js/core/schema.js");
const P = require("../js/core/project.js");
const V = require("../js/core/validate.js");
const C = require("../js/core/cgen.js");

function main(argv) {
  const input = argv[0];
  if (!input) {
    console.error("usage: node NEWPROJECT/tools/build-mod.js <pack> [outDir]");
    return 2;
  }
  const outDir = path.resolve(argv[1] || path.join(__dirname, "..", "..", "main"));
  const raw = JSON.parse(fs.readFileSync(input, "utf8"));

  const res = V.validateProject(raw, { forCodegen: true });
  for (const w of res.warnings) {
    console.warn("warning [" + w.code + "] " + w.message + (w.ruleId != null ? " (rule " + w.ruleId + ")" : ""));
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
  const dst = path.join(outDir, out.name);
  fs.writeFileSync(dst, out.content, "utf8");

  console.log("project : " + res.project.manifest.name + " " + res.project.manifest.version);
  console.log("rules   : " + out.ir.rules.length);
  console.log("wrote   : " + dst + " (" + Buffer.byteLength(out.content) + " bytes)");
  return 0;
}

process.exitCode = main(process.argv.slice(2));
