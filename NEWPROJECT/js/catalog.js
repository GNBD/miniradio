/*
 * SPDX-License-Identifier: MIT
 * Module catalog: every firmware screen element as a module that expands
 * into primitive widgets (rect / text / bar / line) or a dynamic widget
 * (freq / rsq / rds / sig / bandmap) implemented in firmware.
 */
const PALETTE = {
  bg: "#eef1f7", panel: "#ffffff", fg: "#111827", muted: "#667085",
  line: "#e4e7ec", accent: "#0072de", accenth: "#0057b8", ok: "#12b76a",
  warn: "#f79009", red: "#d92d20", track: "#e9edf5", hsel: "#e8f1fd",
};

function W(o) { return Object.assign({ t: "rect", x: 0, y: 0, w: 10, h: 10 }, o); }

/* each module returns an array of widget objects */
const MODULES = [
  { id: "header", cat: "UI", name: "Header", sub: "clock / wifi / battery",
    make: () => [
      W({ t: "rect", x: 0, y: 0, w: 320, h: 22, fill: "panel" }),
      W({ t: "rect", x: 6, y: 6, w: 3, h: 10, fill: "accent" }),
      W({ t: "text", x: 14, y: 6, w: 70, h: 12, bind: "clock", size: "small", color: "fg" }),
      W({ t: "text", x: 240, y: 7, w: 50, h: 10, bind: "batt", size: "tiny", color: "muted", align: "r" }),
      W({ t: "text", x: 302, y: 7, w: 12, h: 10, bind: "stereo", size: "tiny", color: "ok", align: "r" }),
      W({ t: "line", x: 0, y: 22, w: 320, h: 1, color: "panel" }),
    ] },
  { id: "band", cat: "UI", name: "Band + Mode", sub: "VHF / FM",
    make: () => [
      W({ t: "text", x: 12, y: 27, w: 28, h: 12, bind: "band", size: "tiny", color: "muted" }),
      W({ t: "text", x: 42, y: 27, w: 28, h: 12, bind: "mode", size: "tiny", color: "muted" }),
    ] },
  { id: "badges", cat: "UI", name: "P / A badges", sub: "preset + ATS",
    make: () => [
      W({ t: "text", x: 195, y: 27, w: 34, h: 12, bind: "preset", size: "tiny", color: "accent", align: "c", chip: 1 }),
      W({ t: "text", x: 235, y: 27, w: 34, h: 12, bind: "ats", size: "tiny", color: "warn", align: "c", chip: 1 }),
    ] },
  { id: "freq", cat: "UI", name: "Frequency", sub: "large + unit",
    make: () => [
      W({ t: "freq", x: 12, y: 40, w: 200, h: 34 }),
    ] },
  { id: "rsq", cat: "UI", name: "RSSI / SNR", sub: "bars + numbers",
    make: () => [
      W({ t: "rsq", x: 8, y: 72, w: 176, h: 44 }),
    ] },
  { id: "params", cat: "UI", name: "Param grid", sub: "BW/ST/BFO/AGC/AFC...",
    make: () => [
      W({ t: "text", x: 180, y: 74, w: 130, h: 10, bind: "line1", size: "tiny", color: "muted" }),
      W({ t: "text", x: 180, y: 90, w: 130, h: 10, bind: "line2", size: "tiny", color: "muted" }),
      W({ t: "text", x: 180, y: 106, w: 130, h: 10, bind: "line3", size: "tiny", color: "muted" }),
    ] },
  { id: "rds", cat: "UI", name: "INFO card (RDS/EIBI)", sub: "mode-aware info",
    make: () => [
      W({ t: "rds", x: 8, y: 122, w: 200, h: 46 }),
    ] },
  { id: "sig", cat: "UI", name: "SIG graph", sub: "RSSI/SNR history",
    make: () => [
      W({ t: "sig", x: 212, y: 122, w: 98, h: 46 }),
    ] },
  { id: "bandmap", cat: "UI", name: "Band map", sub: "centered dial",
    make: () => [
      W({ t: "bandmap", x: 8, y: 122, w: 304, h: 46 }),
    ] },
  { id: "panel", cat: "UI", name: "PANEL (MENU/SETTINGS)", sub: "설계 가이드",
    make: () => [
      W({ t: "menu", kind: "menu", x: 212, y: 18, w: 98, h: 150 }),
    ] },
  { id: "text", cat: "BASIC", name: "Text", sub: "binding or literal",
    make: () => [ W({ t: "text", x: 16, y: 70, w: 90, h: 12, text: "TEXT", size: "tiny", color: "fg" }) ] },
  { id: "bar", cat: "BASIC", name: "Bar", sub: "bound 0..max",
    make: () => [ W({ t: "bar", x: 52, y: 78, w: 88, h: 8, bind: "rssi", max: 63, color: "ok" }) ] },
  { id: "rect", cat: "BASIC", name: "Rect / Panel", sub: "fill + border",
    make: () => [ W({ t: "rect", x: 20, y: 60, w: 120, h: 40, fill: "panel", stroke: "line" }) ] },
  { id: "line", cat: "BASIC", name: "Line", sub: "divider",
    make: () => [ W({ t: "line", x: 8, y: 118, w: 304, h: 1, color: "line" }) ] },
  { id: "toast", cat: "BASIC", name: "Toast", sub: "bottom message",
    make: () => [
      W({ t: "rect", x: 60, y: 140, w: 200, h: 18, fill: "panel", stroke: "line", r: 9 }),
      W({ t: "text", x: 70, y: 145, w: 180, h: 10, bind: "toast", size: "tiny", color: "fg", align: "c" }),
    ] },
];

/* full-screen templates (the screens we already built) */
const TEMPLATES = [
  { id: "tpl-radio", name: "Radio (현재 구현)", sub: "header+freq+rsq+rds+sig",
    ids: ["header", "band", "badges", "freq", "rsq", "params", "rds", "sig"] },
  { id: "tpl-bandmap", name: "Radio + Band map", sub: "하단 전체 밴드맵",
    ids: ["header", "band", "badges", "freq", "rsq", "params", "bandmap"] },
  { id: "tpl-minimal", name: "Minimal", sub: "주파수 + RSSI만",
    ids: ["header", "freq", "rsq"] },
];

const BINDINGS = [  ["freq", "주파수 (문자열)"], ["mode", "모드 FM/AM/LSB/USB"], ["band", "밴드명"],
  ["rssi", "RSSI 0-63"], ["snr", "SNR 0-63"], ["clock", "시계 HH:MM"],
  ["date", "날짜"], ["ps", "RDS PS"], ["rt", "RDS RT"], ["pty", "RDS PTY"],
  ["preset", "프리셋 번호"], ["pname", "프리셋 이름"], ["ats", "ATS 번호"],
  ["batt", "배터리 %"], ["vol", "볼륨"], ["bw", "대역폭"], ["step", "스텝"],
  ["bfo", "BFO"], ["agc", "AGC"], ["sm", "소프트뮤트"], ["afc", "AFC"],
  ["avc", "AVC"], ["sq", "스퀠치"], ["stereo", "스테레오"],
  ["line1", "BW/ST"], ["line2", "BFO/AGC/SM"], ["line3", "AFC/AVC/SQ"],
  ["eibi", "EiBi 방송"], ["toast", "토스트"],
];

/* logic blocks */
const BLOCKS = {
  when: [
    { type: "rssi_updated", label: "RSSI 갱신" },
    { type: "ui_menu", label: "메뉴 실행", param: "RM_MOD_A", element: "menu" },
    { type: "ui_settings", label: "설정 실행", param: "ST_MOD_A", element: "settings" },
    { type: "encoder_turn", label: "엔코더 회전" },
    { type: "encoder_click", label: "엔코더 클릭" },
    { type: "long_press", label: "롱프레스" },
    { type: "timer_1s", label: "1초마다" },
    { type: "screen_enter", label: "화면 진입" },
    { type: "boot_ready", label: "부팅 완료" },
  ],
  if: [
    { type: "seek_ok", label: "탐색 가능" },
    { type: "band_is", label: "밴드가", param: "VHF" },
    { type: "freq_gt", label: "주파수 >", param: "100000000", num: 1 },
    { type: "freq_lt", label: "주파수 <", param: "108000000", num: 1 },
    { type: "rssi_lt", label: "RSSI <", param: "15", num: 1 },
    { type: "snr_lt", label: "SNR <", param: "8", num: 1 },
    { type: "preset_match", label: "프리셋 일치" },
  ],
  do: [
    { type: "tune_step", label: "주파수 ±", param: "100000", num: 1 },
    { type: "tune_to", label: "주파수 이동", param: "89100000", num: 1 },
    { type: "seek", label: "SEEK" },
    { type: "set_band", label: "밴드 변경", param: "VHF" },
    { type: "set_volume", label: "볼륨", param: "30", num: 1 },
    { type: "open_screen", label: "화면 열기", param: "favorites" },
    { type: "toast", label: "토스트", param: "HELLO" },
    { type: "save_preset", label: "프리셋 저장" },
  ],
};

/* mock device state for preview + simulation */
const MOCK = {
  freq: 89100000, mode: "FM", band: "VHF", rssi: 35, snr: 9,
  clock: "14:32", date: "2026-10-26", ps: "KBS 1FM",
  rt: "뉴스와 음악, 그리고 사람", pty: "Varied", preset: "P01",
  pname: "KBS 1FM", ats: "A07", batt: 87, vol: 22, bw: "AUTO", step: "100K",
  bfo: "+0", agc: "ON", sm: "0", afc: "OK", avc: "63", sq: "OFF",
  stereo: "ST", eibi: "KBS World Radio 19:00", toast: "SAVED",
  line1: "BW AUTO  ST 100K", line2: "BFO +0  AGC ON  SM 4",
  line3: "AFC OK  AVC 63  SQ OFF",
};

/* firmware menu ids (fixed actions, labels are editable) */
const MENU_IDS = (window.MRSchema ? MRSchema.MENU_ELEMENTS : [
  ["RM_BACK", "< BACK"], ["RM_BAND", "BAND"], ["RM_MODE", "MODE"],
  ["RM_STEP", "STEP"], ["RM_BW", "BW"], ["RM_BFO", "BFO"],
  ["RM_SEEK", "SEEK"], ["RM_SCAN", "SCAN"], ["RM_ATS", "ATS"],
  ["RM_FAV", "FAVORITES"], ["RM_RDS", "RDS"], ["RM_STEREO", "STEREO"],
  ["RM_DEEMPH", "DEEMPH"], ["RM_VOLUME", "VOLUME"], ["RM_AGC", "AGC"],
  ["RM_RFGAIN", "RF GAIN"], ["RM_AVC", "AVC"], ["RM_SOFTMUTE", "SOFTMUTE"],
  ["RM_SQUELCH", "SQUELCH"], ["RM_MOD_A", "MOD A"], ["RM_MOD_B", "MOD B"],
  ["RM_MOD_C", "MOD C"], ["RM_MOD_D", "MOD D"], ["RM_MOD_E", "MOD E"],
  ["RM_MOD_F", "MOD F"], ["RM_MOD_G", "MOD G"], ["RM_MOD_H", "MOD H"],
  ["RM_SETTINGS", "SETTINGS"],
]).map((e) => Array.isArray(e) ? e : [e.id, e.label]);

const SET_IDS = (window.MRSchema ? MRSchema.SETTINGS_ELEMENTS : [
  ["ST_BACK", "< BACK"], ["ST_BRIGHT", "BRIGHT"], ["ST_SCREEN", "SCREEN"],
  ["ST_SLEEP", "SLEEP"], ["ST_POWERSAVE", "POWER SAVE"], ["ST_UNIT", "UNIT"],
  ["ST_THEME", "THEME"], ["ST_TIME", "TIME"], ["ST_UTC", "UTC"],
  ["ST_BATT", "BATT"], ["ST_BATT_CAL", "BATT CAL"], ["ST_CPU", "CPU"],
  ["ST_WIFI", "WI-FI"], ["ST_EIBI", "EIBI"], ["ST_QUICKSET", "QUICK SET"],
  ["ST_SIGDBG", "SIG DBG"], ["ST_SIGVIEW", "BOTTOM"],
  ["ST_MOD_A", "MOD A"], ["ST_MOD_B", "MOD B"], ["ST_MOD_C", "MOD C"],
  ["ST_MOD_D", "MOD D"], ["ST_MOD_E", "MOD E"], ["ST_MOD_F", "MOD F"],
  ["ST_MOD_G", "MOD G"], ["ST_MOD_H", "MOD H"], ["ST_ABOUT", "ABOUT"],
]).map((e) => Array.isArray(e) ? e : [e.id, e.label]);
