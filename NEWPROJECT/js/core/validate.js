/*
 * SPDX-License-Identifier: MIT
 * core/validate.js - schema + semantic validation.
 *
 * Returns diagnostics as { code, message, path, ruleId?, severity }.
 * Nothing here touches the DOM or the firmware.
 */
(function (root, factory) {
  const S = (typeof require === "function") ? require("./schema.js") : root.MRSchema;
  const P = (typeof require === "function") ? require("./project.js") : root.MRProject;
  const api = factory(S, P);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.MRValidate = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (S, P) {
  const FN_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

  function V() {
    this.errors = [];
    this.warnings = [];
  }

  V.prototype.err = function (code, message, path, ruleId) {
    this.errors.push({ code, message, path: path || "", ruleId: ruleId, severity: "error" });
  };

  V.prototype.warn = function (code, message, path, ruleId) {
    this.warnings.push({ code, message, path: path || "", ruleId: ruleId, severity: "warning" });
  };

  function isInt(v) {
    return typeof v === "number" && isFinite(v) && Math.floor(v) === v;
  }

  function checkWidget(v, w, i, codeIds, base) {
    const p = (base || "ui.items") + "[" + i + "]";
    if (!w || typeof w !== "object") {
      v.err("E_WIDGET", "위젯이 객체가 아닙니다.", p);
      return;
    }
    if (S.WIDGET_TYPES.indexOf(w.t) < 0) {
      v.err("E_WIDGET_TYPE", "지원하지 않는 위젯 타입: " + w.t, p + ".t");
      return;
    }
    if (!isInt(w.x) || !isInt(w.y)) {
      v.err("E_WIDGET_XY", "x/y는 정수여야 합니다.", p);
    } else if (w.x < -320 || w.x > 640 || w.y < -170 || w.y > 340) {
      v.warn("W_WIDGET_OFFSCREEN", "위젯이 화면 밖에 있습니다.", p);
    }
    if (!isInt(w.w) || !isInt(w.h) || w.w <= 0 || w.h <= 0) {
      v.err("E_WIDGET_SIZE", "w/h는 1 이상의 정수여야 합니다.", p);
    } else if (w.w > 320 || w.h > 170) {
      v.err("E_WIDGET_SIZE", "위젯 크기가 화면(320x170)을 넘습니다.", p);
    }
    if (w.z != null && (!isInt(w.z) || w.z < -1000 || w.z > 1000)) {
      v.err("E_WIDGET_Z", "Layer는 -1000..1000 정수여야 합니다.", p + ".z");
    }
    for (const k of ["fill", "stroke", "color"]) {
      if (w[k] != null && S.COLORS.indexOf(w[k]) < 0) {
        v.err("E_WIDGET_COLOR", "허용되지 않는 색상: " + w[k], p + "." + k);
      }
    }
    if (w.font != null && S.FONTS.indexOf(w.font) < 0) {
      v.err("E_WIDGET_FONT", "허용되지 않는 폰트: " + w.font, p + ".font");
    }
    if (w.size != null && S.FONTS.indexOf(w.size) < 0) {
      v.err("E_WIDGET_FONT", "허용되지 않는 폰트 크기: " + w.size, p + ".size");
    }
    if (w.align != null && S.ALIGNS.indexOf(w.align) < 0) {
      v.err("E_WIDGET_ALIGN", "허용되지 않는 정렬: " + w.align, p + ".align");
    }
    if (w.bind != null && S.BINDS.indexOf(w.bind) < 0) {
      v.err("E_WIDGET_BIND", "허용되지 않는 바인딩: " + w.bind, p + ".bind");
    }
    if (w.modes != null && (!isInt(w.modes) || w.modes < 0 || w.modes > 7)) {
      v.err("E_WIDGET_MODES", "모드 마스크는 0..7이어야 합니다.", p + ".modes");
    }
    if (w.max != null && (!isInt(w.max) || w.max < 0 || w.max > 65535)) {
      v.err("E_WIDGET_MAX", "max는 0..65535 정수여야 합니다.", p + ".max");
    }
    if (w.text != null) {
      if (typeof w.text !== "string") {
        v.err("E_WIDGET_TEXT", "text는 문자열이어야 합니다.", p + ".text");
      } else if (S.byteLength(w.text) > S.LIMITS.textBytes) {
        v.err("E_WIDGET_TEXT", "text가 너무 깁니다 (최대 " + S.LIMITS.textBytes + "바이트).", p + ".text");
      }
    }
    if (w.t === "custom") {
      if (!w.mod || !codeIds.has(w.mod)) {
        v.err("E_WIDGET_CUSTOM", "C 위젯이 존재하지 않는 모듈을 참조합니다: " + w.mod, p + ".mod");
      }
    }
    if (w.uid != null && !isInt(w.uid)) {
      v.err("E_WIDGET_UID", "uid는 정수여야 합니다.", p + ".uid");
    }
  }

  function checkLayers(v, items, base) {
    const pfx = base || "ui.items";
    const byUid = new Map();
    const seen = new Set();
    items.forEach((w, i) => {
      if (!w || w.uid == null) return;
      if (seen.has(w.uid)) {
        v.err("E_UID_DUP", "중복 uid: " + w.uid, pfx + "[" + i + "].uid");
      }
      seen.add(w.uid);
      byUid.set(w.uid, w);
    });
    items.forEach((w, i) => {
      if (!w || !w.parent) return;
      const p = pfx + "[" + i + "].parent";
      if (!byUid.has(w.parent)) {
        v.err("E_PARENT", "상속 대상 uid가 없습니다: " + w.parent, p);
        return;
      }
      let cur = w, depth = 0;
      while (cur && cur.parent != null) {
        if (++depth > 32) {
          v.err("E_PARENT_CYCLE", "레이어 상속이 순환합니다.", p);
          break;
        }
        const next = byUid.get(cur.parent);
        if (next === w) {
          v.err("E_PARENT_CYCLE", "레이어 상속이 순환합니다.", p);
          break;
        }
        cur = next;
      }
    });
  }

  function parseNum(v, c, path, ruleId) {
    const raw = (c.param == null) ? "" : String(c.param).trim();
    if (!raw.length) {
      v.err("E_PARAM_EMPTY", "숫자 파라미터가 비어 있습니다.", path, ruleId);
      return null;
    }
    const n = Number(raw);
    if (!isFinite(n) || Math.floor(n) !== n) {
      v.err("E_PARAM_NUM", "정수가 아닙니다: " + raw, path, ruleId);
      return null;
    }
    if (c.range && (n < c.range[0] || n > c.range[1])) {
      v.err("E_PARAM_RANGE", "범위를 벗어났습니다 (" + c.range[0] + ".." + c.range[1] + "): " + n,
        path, ruleId);
      return null;
    }
    return n;
  }

  function checkRules(v, rules, forCodegen, elems) {
    if (!Array.isArray(rules)) {
      v.err("E_RULES", "rules는 배열이어야 합니다.", "rules");
      return;
    }
    if (rules.length > S.LIMITS.rules) {
      v.err("E_LIMIT", "규칙이 너무 많습니다 (최대 " + S.LIMITS.rules + ").", "rules");
    }
    if (forCodegen && rules.length === 0) {
      v.err("E_RULES_EMPTY", "생성할 규칙이 없습니다. BLOCKS에서 WHEN/IF/DO를 추가하세요.", "rules");
    }

    rules.forEach((r, ri) => {
      const rp = "rules[" + ri + "]";
      const rid = r && r.id != null ? r.id : (ri + 1);
      if (!r || typeof r !== "object") {
        v.err("E_RULE", "규칙이 객체가 아닙니다.", rp, rid);
        return;
      }
      if (!r.when || !r.when.type) {
        if (forCodegen) v.err("E_WHEN_MISSING", "WHEN(이벤트)이 없습니다.", rp + ".when", rid);
        else v.warn("W_WHEN_MISSING", "WHEN이 없는 규칙은 실행되지 않습니다.", rp + ".when", rid);
      } else {
        const def = S.EVENTS[r.when.type];
        if (!def) {
          v.err("E_WHEN_TYPE", "알 수 없는 이벤트: " + r.when.type, rp + ".when.type", rid);
        } else if (forCodegen && def.tier < 1) {
          v.err("E_UNSUPPORTED", "'" + def.label + "' 이벤트는 v1 코드 생성 미지원입니다.",
            rp + ".when.type", rid);
        } else if (!forCodegen && def.tier < 1) {
          v.warn("W_UNSUPPORTED", "'" + def.label + "' 이벤트는 v1.1에서 지원됩니다.",
            rp + ".when.type", rid);
        }
        if (def && def.element) {
          const ref = r.when.param == null ? "" : String(r.when.param);
          const set = elems && elems[def.element];
          if (!ref) {
            v.err("E_ELEMENT_MISSING", "UI 요소를 선택하세요.", rp + ".when.param", rid);
          } else if (set && !set.ids.has(ref)) {
            v.err("E_ELEMENT_REF", "존재하지 않는 UI 요소입니다: " + ref,
              rp + ".when.param", rid);
          } else if (set && set.hidden.has(ref)) {
            v.warn("W_ELEMENT_HIDDEN", "숨김 처리된 UI 요소입니다: " + ref,
              rp + ".when.param", rid);
          }
        }
      }

      if (!Array.isArray(r.if) || r.if.length > S.LIMITS.conditions) {
        v.err("E_IF_LIMIT", "조건은 최대 " + S.LIMITS.conditions + "개입니다.", rp + ".if", rid);
      } else {
        r.if.forEach((c, ci) => {
          const cp = rp + ".if[" + ci + "]";
          if (!c || !c.type) {
            v.err("E_IF", "조건 타입이 없습니다.", cp, rid);
            return;
          }
          const def = S.CONDITIONS[c.type];
          if (!def) {
            v.err("E_IF_TYPE", "알 수 없는 조건: " + c.type, cp + ".type", rid);
            return;
          }
          if (forCodegen && def.tier < 1) {
            v.err("E_UNSUPPORTED", "'" + def.label + "' 조건은 v1 코드 생성 미지원입니다.",
              cp + ".type", rid);
          } else if (!forCodegen && def.tier < 1) {
            v.warn("W_UNSUPPORTED", "'" + def.label + "' 조건은 v1.1에서 지원됩니다.",
              cp + ".type", rid);
          }
          if (def.num) parseNum(v, { param: c.param, range: def.range }, cp + ".param", rid);
          if (def.options && def.options.indexOf(String(c.param || "")) < 0) {
            v.err("E_PARAM_OPTION", "허용되지 않는 값: " + c.param, cp + ".param", rid);
          }
        });
      }

      if (!Array.isArray(r.do) || !r.do.length) {
        if (forCodegen) v.err("E_DO_MISSING", "DO(동작)가 없습니다.", rp + ".do", rid);
      } else if (r.do.length > S.LIMITS.actions) {
        v.err("E_DO_LIMIT", "동작은 최대 " + S.LIMITS.actions + "개입니다.", rp + ".do", rid);
      } else {
        r.do.forEach((a, ai) => {
          const ap = rp + ".do[" + ai + "]";
          if (!a || !a.type) {
            v.err("E_DO", "동작 타입이 없습니다.", ap, rid);
            return;
          }
          const def = S.ACTIONS[a.type];
          if (!def) {
            v.err("E_DO_TYPE", "알 수 없는 동작: " + a.type, ap + ".type", rid);
            return;
          }
          if (forCodegen && def.tier < 1) {
            v.err("E_UNSUPPORTED", "'" + def.label + "' 동작은 v1 코드 생성 미지원입니다.",
              ap + ".type", rid);
          } else if (!forCodegen && def.tier < 1) {
            v.warn("W_UNSUPPORTED", "'" + def.label + "' 동작은 v1.1에서 지원됩니다.",
              ap + ".type", rid);
          }
          if (def.num) parseNum(v, { param: a.param }, ap + ".param", rid);
          if (def.text) {
            const t = String(a.param == null ? "" : a.param);
            if (!t.length) v.err("E_PARAM_EMPTY", "문자열 파라미터가 비어 있습니다.", ap + ".param", rid);
            if (S.byteLength(t) > S.LIMITS.textBytes) {
              v.err("E_PARAM_LEN", "문자열이 너무 깁니다.", ap + ".param", rid);
            }
            if (a.type === "toast" && S.byteLength(t) > S.LIMITS.toastBytes) {
              v.err("E_TOAST_LEN", "토스트는 " + S.LIMITS.toastBytes + "바이트 이하여야 합니다.", ap + ".param", rid);
            }
            if (!S.isAscii(t)) {
              v.warn("W_ASCII", "비ASCII 문자는 기기 폰트에 없을 수 있습니다.", ap + ".param", rid);
            }
          }
        });
      }
    });
  }

  function checkMeta(v, proj) {
    if (S.byteLength(proj.manifest.name) > S.LIMITS.nameBytes) {
      v.err("E_NAME_LEN", "프로젝트 이름이 너무 깁니다.", "manifest.name");
    }
    if (!proj.manifest.version) {
      v.warn("W_VERSION", "버전이 비어 있습니다.", "manifest.version");
    }
    if (proj.target && proj.target.board && proj.target.board !== "ESP32-S3-N16R8") {
      v.err("E_TARGET", "지원 대상은 ESP32-S3-N16R8입니다.", "target.board");
    }
  }

  function elementSet(list, defaults) {
    const known = new Set(defaults.map((e) => e.id));
    const src = (Array.isArray(list) && list.length) ? list : defaults;
    const ids = new Set();
    const hidden = new Set();
    for (const it of src) {
      if (it && it.id) {
        ids.add(it.id);
        if (it.visible === 0 || it.visible === false) hidden.add(it.id);
      }
    }
    return { ids, hidden, known, src };
  }

  function checkList(v, list, defaults, key, pinId) {
    if (!Array.isArray(list)) return;
    if (list.length > S.LIMITS.menuItems) {
      v.err("E_LIMIT", "UI 요소가 너무 많습니다 (최대 " + S.LIMITS.menuItems + ").", key);
    }
    if (!list.length) {
      v.err("E_LIST_EMPTY", "UI 목록이 비어 있습니다.", key);
      return;
    }
    const seen = new Set();
    const known = new Set(defaults.map((e) => e.id));
    list.forEach((it, i) => {
      const p = key + "[" + i + "]";
      if (!it || typeof it !== "object" || !it.id) {
        v.err("E_ELEMENT_ID", "UI 요소 id가 없습니다.", p + ".id");
        return;
      }
      if (seen.has(it.id)) v.err("E_ELEMENT_DUP", "중복 UI 요소 id: " + it.id, p + ".id");
      seen.add(it.id);
      if (!known.has(it.id)) {
        v.err("E_ELEMENT_TYPE", "펌웨어에 없는 UI 요소 id: " + it.id, p + ".id");
      }
      if (typeof it.label !== "string" || !it.label.length) {
        v.err("E_LABEL", "라벨이 비어 있습니다.", p + ".label");
      } else if (S.byteLength(it.label) > 20) {
        v.err("E_LABEL", "라벨이 너무 깁니다 (최대 20바이트).", p + ".label");
      }
      if (it.visible !== 0 && it.visible !== 1 &&
          it.visible !== true && it.visible !== false) {
        v.err("E_VISIBLE", "visible은 0 또는 1이어야 합니다.", p + ".visible");
      }
    });
    if (pinId && !seen.has(pinId)) {
      v.err("E_ELEMENT_PIN", "고정 항목이 없습니다: " + pinId, key);
    }
  }

  function validateProject(pack, opts) {
    opts = opts || {};
    const v = new V();
    if (!pack || typeof pack !== "object") {
      v.err("E_PROJECT", "프로젝트가 객체가 아닙니다.", "");
      return { ok: false, errors: v.errors, warnings: v.warnings, project: null };
    }

    const proj = P.normalize(pack, opts.manifest);

    if (pack.schemaVersion != null && pack.schemaVersion > S.SCHEMA_VERSION) {
      v.err("E_SCHEMA_FUTURE", "더 새로운 스키마입니다 (v" + pack.schemaVersion + ").", "schemaVersion");
    }
    if (pack.format && pack.format !== S.FORMAT && pack.format !== S.LEGACY_FORMAT) {
      v.err("E_FORMAT", "알 수 없는 형식: " + pack.format, "format");
    }
    if (proj.migratedFrom) {
      v.warn("W_MIGRATE", "이전 형식(" + proj.migratedFrom + ")을 v2로 변환했습니다.", "format");
    }

    checkMeta(v, proj);

    const codeIds = new Set((proj.code || []).map((m) => m && m.id).filter(Boolean));
    if (proj.code.length > S.LIMITS.codeModules) {
      v.err("E_LIMIT", "C 모듈이 너무 많습니다 (최대 " + S.LIMITS.codeModules + ").", "code");
    }
    let totalCode = 0;
    proj.code.forEach((m, i) => {
      const p = "code[" + i + "]";
      if (!m || typeof m !== "object") {
        v.err("E_CODE", "C 모듈이 객체가 아닙니다.", p);
        return;
      }
      if (!m.id) v.err("E_CODE", "C 모듈 id가 없습니다.", p + ".id");
      if (!m.fn || !FN_RE.test(m.fn)) {
        v.err("E_CODE_FN", "함수명은 C 식별자여야 합니다: " + m.fn, p + ".fn");
      }
      if (!m.code || !String(m.code).length) {
        v.err("E_CODE_EMPTY", "C 코드가 비어 있습니다.", p + ".code");
      } else {
        const n = S.byteLength(String(m.code));
        totalCode += n;
        if (n > S.LIMITS.codeBytes) {
          v.err("E_CODE_LEN", "C 모듈이 너무 큽니다 (최대 " + S.LIMITS.codeBytes + "바이트).", p + ".code");
        }
      }
      v.warn("W_CODE_ADVANCED", "C 모듈은 UI 레이아웃에만 포함되며 mod 생성에는 사용되지 않습니다.", p);
    });
    if (totalCode > S.LIMITS.totalCodeBytes) {
      v.err("E_CODE_TOTAL", "C 코드 전체가 너무 큽니다.", "code");
    }

    const itemSets = [["ui.items", proj.ui.items]];
    if (proj.ui.layouts) {
      for (const k of ["FM", "AM", "SSB"]) {
        itemSets.push(["ui.layouts." + k, proj.ui.layouts[k] || []]);
      }
    }
    let totalWidgets = 0;
    for (const [key, items] of itemSets) {
      totalWidgets += items.length;
      if (items.length > S.LIMITS.widgets) {
        v.err("E_LIMIT", "위젯이 너무 많습니다 (최대 " + S.LIMITS.widgets + ").", key);
      }
      items.forEach((w, i) => checkWidget(v, w, i, codeIds, key));
      checkLayers(v, items, key);
    }
    if (totalWidgets > S.LIMITS.widgets * 3) {
      v.err("E_LIMIT", "전체 위젯 수가 너무 많습니다.", "ui");
    }

    if (S.LAYOUTS.indexOf(proj.menuLayout) < 0) {
      v.err("E_LAYOUT", "메뉴 배치는 v 또는 h입니다.", "menuLayout");
    }
    if (S.LAYOUTS.indexOf(proj.settingsLayout) < 0) {
      v.err("E_LAYOUT", "설정 배치는 v 또는 h입니다.", "settingsLayout");
    }

    if (proj.menuLayout === "h" || proj.settingsLayout === "h") {
      v.warn("W_LAYOUT_H", "가로 메뉴는 아직 펌웨어 렌더러가 없어 세로로 표시됩니다.", "menuLayout");
    }

    if (proj.menu !== null) {
      checkList(v, proj.menu, S.MENU_ELEMENTS, "menu", "RM_BACK");
    }
    if (proj.settings !== null) {
      checkList(v, proj.settings, S.SETTINGS_ELEMENTS, "settings", "ST_BACK");
    }
    const elems = {
      menu: elementSet(proj.menu, S.MENU_ELEMENTS),
      settings: elementSet(proj.settings, S.SETTINGS_ELEMENTS),
    };

    checkRules(v, proj.rules, !!opts.forCodegen, elems);

    return { ok: v.errors.length === 0, errors: v.errors, warnings: v.warnings, project: proj };
  }

  return { validateProject };
});
