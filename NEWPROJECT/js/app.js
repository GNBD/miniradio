/*
 * SPDX-License-Identifier: MIT
 * app.js - bootstrap + toolbar wiring only.
 *
 * Load order (index.html):
 *   catalog -> render -> editor -> blocks -> properties -> palette -> code -> export -> app
 */
let MODE = "ui";

/* ---------------------------------------------------------------- license */
const LicenseGate = {
  accepted: false,
  ok() {
    if (this.accepted) return true;
    const msg = [
      "MINI-radio Modder Studio",
      "",
      "이 도구의 결과물은 다음 오픈소스 라이선스를 포함합니다:",
      "· miniradio firmware — MIT",
      "· LovyanGFX — BSD-2-Clause / MIT",
      "· littlefs (joltwallet port) — MIT",
      "· ESP-IDF — Apache-2.0",
      "",
      "모드를 배포할 경우 위 라이선스와 호환되어야 하며,",
      "모드는 전체 권한으로 실행됩니다.",
      "배포와 그 결과에 대한 책임은 작성자에게 있습니다.",
      "",
      "동의하시겠습니까?",
    ].join("\n");
    if (!window.confirm(msg)) return false;
    this.accepted = true;
    return true;
  },
};
window.LicenseGate = LicenseGate;

/* 모든 다운로드 앞에 동의 게이트 */
["exportPack", "downloadC"].forEach((fn) => {
  const orig = ED[fn].bind(ED);
  ED[fn] = function (...a) { if (!LicenseGate.ok()) return; return orig(...a); };
});
[MenuEd, SetEd].forEach((obj) => {
  const orig = obj.download.bind(obj);
  obj.download = function (...a) { if (!LicenseGate.ok()) return; return orig(...a); };
});

function setMode(mode) {
  MODE = mode;
  document.getElementById("tabUI").classList.toggle("on", mode === "ui");
  document.getElementById("tabMenu").classList.toggle("on", mode === "menu");
  document.getElementById("tabSet").classList.toggle("on", mode === "settings");
  document.getElementById("tabLogic").classList.toggle("on", mode === "logic");
  document.getElementById("tabCode").classList.toggle("on", mode === "code");
  document.getElementById("stageUI").hidden = mode !== "ui";
  document.getElementById("stageMenu").hidden = mode !== "menu";
  document.getElementById("stageSet").hidden = mode !== "settings";
  document.getElementById("stageLogic").hidden = mode !== "logic";
  document.getElementById("stageCode").hidden = mode !== "code";
  if (mode === "menu") MenuEd.render();
  if (mode === "settings") SetEd.render();
  if (mode === "code") CODE.render();
  if (mode === "logic" && window.RULES) RULES.render();
  if (mode !== "logic" && window.ModOut) ModOut.clear();
  buildPalette(mode);
}

function syncPmodeButtons() {
  document.querySelectorAll("[data-pmode]").forEach((x) =>
    x.classList.toggle("on", (parseInt(x.dataset.pmode, 10) || 0) === ED.pmode));
}

window.addEventListener("DOMContentLoaded", () => {
  ED.init(document.getElementById("screen"));
  Tip.init();
  RULES.reset();
  CODE.ensure();
  buildPalette("ui");

  document.getElementById("tabUI").onclick = () => setMode("ui");
  document.getElementById("tabMenu").onclick = () => setMode("menu");
  document.getElementById("tabSet").onclick = () => setMode("settings");
  document.getElementById("tabLogic").onclick = () => setMode("logic");
  document.getElementById("tabCode").onclick = () => setMode("code");

  document.getElementById("search").addEventListener("input", () => buildPalette(MODE));

  document.getElementById("btnAddRule").onclick = () => RULES.addRule();
  document.getElementById("btnSampleA").onclick = () => {
    if (!confirm("샘플 A(RSSI < 15 → 토스트)로 규칙을 교체할까요?")) return;
    RULES.sampleA();
    ED.dirty = true; ED.uiDirty();
    ModOut.clear();
  };
  document.getElementById("btnSampleUi").onclick = () => {
    if (!confirm("메뉴 SCAN → SEEK 예제로 규칙과 MENU 항목을 설정할까요?")) return;
    RULES.sampleUi();
    ED.dirty = true; ED.uiDirty();
    buildPalette(MODE);
    ModOut.clear();
  };
  document.getElementById("btnModValidate").onclick = () => ModOut.validate();
  document.getElementById("btnModGen").onclick = () => ModOut.generate();
  document.getElementById("btnUndo").onclick = () => ED.undo();
  document.getElementById("btnExport").onclick = () => ED.exportPack();
  document.getElementById("btnExportC").onclick = () => ED.downloadC();
  document.getElementById("btnImport").onclick = () => document.getElementById("fileIn").click();

  /* ---- C tab ---- */
  document.getElementById("btnCmSave").onclick = () => CODE.save();
  document.getElementById("btnCmNew").onclick = () => CODE.add();
  document.getElementById("btnCmDel").onclick = () => CODE.del();
  document.getElementById("btnMenuDl").onclick = () => MenuEd.download();
  document.getElementById("btnSetDl").onclick = () => SetEd.download();
  document.getElementById("btnMenuRestore").onclick = () => MenuEd.restore();
  document.getElementById("btnSetRestore").onclick = () => SetEd.restore();

  document.getElementById("menuLayoutSel").addEventListener("change", (e) => {
    ED.project.menuLayout = e.target.value;
    ED.dirty = true; ED.uiDirty();
    MenuEd.render(); ED.draw();
  });
  document.getElementById("setLayoutSel").addEventListener("change", (e) => {
    ED.project.settingsLayout = e.target.value;
    ED.dirty = true; ED.uiDirty();
    SetEd.render(); ED.draw();
  });

  document.getElementById("fileIn").addEventListener("change", (e) => {
    const f = e.target.files[0];
    if (!f) return;
    const rd = new FileReader();
    rd.onload = () => {
      try {
        if (!ED.load(JSON.parse(rd.result))) {
          const e2 = ED.lastLoadErrors;
          alert("invalid .mrpack" + (e2 && e2.length ? "\n" + e2[0].message + " (" + e2[0].path + ")" : ""));
        } else {
          syncPmodeButtons();
        }
      } catch (err) { alert("parse error: " + err.message); }
    };
    rd.readAsText(f);
    e.target.value = "";
  });

  document.getElementById("btnNew").onclick = () => {
    if (!confirm("새 프로젝트로 초기화할까요?")) return;
    ED.project = {
      bg: "bg", items: [], code: [],
      layouts: null, activeMode: "FM",
      menu: null, settings: null,
      menuLayout: "v", settingsLayout: "v",
      meta: {},
    };
    ED.pmode = 0;
    ED.setSel(-1);
    ED.dirty = false;
    ED.uiDirty();
    document.getElementById("projName").value = "my-radio";
    RULES.reset();
    ModOut.clear();
    CODE.selIndex = 0;
    CODE.ensure();
    buildPalette(MODE);
  };

  /* 새로고침/닫기 전 경고 (저장 = 다운로드) */
  window.addEventListener("beforeunload", (e) => {
    if (!ED.dirty) return undefined;
    const msg = "저장하지 않은 변경사항이 있습니다.\n" +
                "Download .mrpack 또는 Download C로 저장하세요.";
    e.preventDefault();
    e.returnValue = msg;
    return msg;
  });

  document.getElementById("previewChk").addEventListener("change", (e) => {
    ED.preview = e.target.checked;
    document.getElementById("screen").classList.toggle("preview", ED.preview);
    document.getElementById("hud").textContent = ED.preview
      ? "PREVIEW — 실제 기기 렌더링과 동일한 좌표/색/폰트 크기"
      : "FM/AM/SSB는 각각 별도 레이아웃 · Delete 삭제";
    if (ED.preview) ED.startSim(); else ED.stopSim();
    ED.draw();
  });

  document.getElementById("gridChk").addEventListener("change", (e) => {
    ED.useGrid = e.target.checked;
  });

  document.getElementById("gridSize").addEventListener("change", (e) => {
    ED.snap = Math.max(1, parseInt(e.target.value, 10) || 8);
  });

  document.getElementById("hideGuidesChk").addEventListener("change", (e) => {
    ED.hideGuides = e.target.checked;
    ED.setSel(-1);
  });

  document.querySelectorAll("[data-align]").forEach((b) => {
    b.addEventListener("click", () => ED.align(b.dataset.align));
  });

  /* FM / AM / SSB 미리보기 */
  const MODE_MOCK = {
    0: { mode: "FM", band: "VHF", freq: 89100000, ps: "KBS 1FM",
         rt: "뉴스와 음악, 그리고 사람", pty: "Varied", stereo: "ST" },
    1: { mode: "AM", band: "MW", freq: 1200000, ps: "", rt: "", pty: "", stereo: "" },
    2: { mode: "LSB", band: "40m", freq: 7100000, ps: "", rt: "", pty: "", stereo: "" },
  };
  document.querySelectorAll("[data-pmode]").forEach((b) => {
    b.addEventListener("click", () => {
      const idx = parseInt(b.dataset.pmode, 10) || 0;
      ED.setPmode(idx);
      syncPmodeButtons();
      Object.assign(ED.sim, MODE_MOCK[idx]);
      ED.draw();
      if (window.LayerView) LayerView.render();
      Props.render();
    });
  });

  /* start from the real radio screen */
  ED.applyTemplate(TEMPLATES[0]);
  ED.dirty = false;
  ED.uiDirty();
});

/* expose for debugging */
window.ED = ED;
window.RULES = RULES;
window.CODE = CODE;
window.LayerView = LayerView;
window.CPreview = CPreview;
