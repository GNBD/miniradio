/*
 * SPDX-License-Identifier: MIT
 * core/schema.js - project schema, allowlist, and limits.
 *
 * Pure data + helpers. No DOM access: this file is also loaded by Node
 * (NEWPROJECT/tools/build-mod.js and test/core.test.js).
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.MRSchema = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const FORMAT = "gnbd-mod-project";
  const LEGACY_FORMAT = "mrpack/1";
  const SCHEMA_VERSION = 2;

  const LIMITS = {
    widgets: 512,
    rules: 32,
    conditions: 8,
    actions: 8,
    codeModules: 32,
    codeBytes: 32768,
    totalCodeBytes: 131072,
    nameBytes: 64,
    labelBytes: 24,
    textBytes: 64,
    paramBytes: 64,
    toastBytes: 32,
    menuItems: 64,
  };

  const WIDGET_TYPES = [
    "rect", "text", "bar", "line", "freq", "rsq", "rds", "sig",
    "bandmap", "custom", "menu",
  ];

  const COLORS = [
    "bg", "panel", "fg", "muted", "line", "accent", "accenth",
    "ok", "warn", "red", "track", "hsel", "none",
  ];

  const FONTS = ["tiny", "small", "large"];
  const ALIGNS = ["l", "c", "r"];
  const LAYOUTS = ["v", "h"];

  const BINDS = [
    "freq", "mode", "band", "rssi", "snr", "clock", "date", "ps", "rt",
    "pty", "preset", "pname", "ats", "batt", "vol", "bw", "step", "bfo",
    "agc", "sm", "afc", "avc", "sq", "stereo", "line1", "line2", "line3",
    "eibi", "toast",
  ];

  const BAND_NAMES = [
    "VHF", "MW", "LW", "SW", "160m", "80m", "40m", "30m", "20m",
    "17m", "15m", "12m", "10m", "CB",
  ];

  /*
   * tier 1 = generated C supported in schema v2.
   * tier 0 = editable/stored, but code generation is rejected with a clear
   *          error instead of silently producing broken firmware.
   */
  const EVENTS = {
    boot_ready:   { label: "부팅 완료",   tier: 1 },
    rssi_updated: { label: "RSSI 갱신",   tier: 1 },
    timer_1s:     { label: "1초마다",     tier: 1 },
    ui_menu:      { label: "메뉴 실행",   tier: 1, element: "menu" },
    ui_settings:  { label: "설정 실행",   tier: 1, element: "settings" },
    encoder_turn: { label: "엔코더 회전", tier: 0 },
    encoder_click:{ label: "엔코더 클릭", tier: 0 },
    long_press:   { label: "롱프레스",    tier: 0 },
    screen_enter: { label: "화면 진입",   tier: 0 },
  };

  const CONDITIONS = {
    rssi_lt:      { label: "RSSI <",  num: true, range: [0, 63], tier: 1 },
    rssi_gt:      { label: "RSSI >",  num: true, range: [0, 63], tier: 1 },
    snr_lt:       { label: "SNR <",   num: true, range: [0, 63], tier: 1 },
    snr_gt:       { label: "SNR >",   num: true, range: [0, 63], tier: 1 },
    freq_gt:      { label: "주파수 >", num: true, range: [1000, 1000000000], tier: 1 },
    freq_lt:      { label: "주파수 <", num: true, range: [1000, 1000000000], tier: 1 },
    band_is:      { label: "밴드가",  text: true, options: BAND_NAMES, tier: 1 },
    seek_ok:      { label: "탐색 가능", tier: 1 },
    preset_match: { label: "프리셋 일치", tier: 0 },
  };

  const ACTIONS = {
    toast:       { label: "토스트", text: true, tier: 1 },
    seek:        { label: "SEEK", tier: 1 },
    tune_step:   { label: "주파수 ±", num: true, tier: 0 },
    tune_to:     { label: "주파수 이동", num: true, tier: 0 },
    set_band:    { label: "밴드 변경", text: true, tier: 0 },
    set_volume:  { label: "볼륨", num: true, tier: 0 },
    open_screen: { label: "화면 열기", text: true, tier: 0 },
    save_preset: { label: "프리셋 저장", tier: 0 },
  };

  /* UI 요소: 펌웨어 메뉴 항목 (실제 엔코더 입력 경로) */
  const MENU_ELEMENTS = [
    { id: "RM_BACK", label: "< BACK" },
    { id: "RM_BAND", label: "BAND" },
    { id: "RM_MODE", label: "MODE" },
    { id: "RM_STEP", label: "STEP" },
    { id: "RM_BW", label: "BW" },
    { id: "RM_BFO", label: "BFO" },
    { id: "RM_SEEK", label: "SEEK" },
    { id: "RM_SCAN", label: "SCAN" },
    { id: "RM_ATS", label: "ATS" },
    { id: "RM_FAV", label: "FAVORITES" },
    { id: "RM_RDS", label: "RDS" },
    { id: "RM_STEREO", label: "STEREO" },
    { id: "RM_DEEMPH", label: "DEEMPH" },
    { id: "RM_VOLUME", label: "VOLUME" },
    { id: "RM_AGC", label: "AGC" },
    { id: "RM_RFGAIN", label: "RF GAIN" },
    { id: "RM_AVC", label: "AVC" },
    { id: "RM_SOFTMUTE", label: "SOFTMUTE" },
    { id: "RM_SQUELCH", label: "SQUELCH" },
    { id: "RM_MOD_A", label: "MOD A" },
    { id: "RM_MOD_B", label: "MOD B" },
    { id: "RM_MOD_C", label: "MOD C" },
    { id: "RM_MOD_D", label: "MOD D" },
    { id: "RM_MOD_E", label: "MOD E" },
    { id: "RM_MOD_F", label: "MOD F" },
    { id: "RM_MOD_G", label: "MOD G" },
    { id: "RM_MOD_H", label: "MOD H" },
    { id: "RM_SETTINGS", label: "SETTINGS" },
  ];

  const SETTINGS_ELEMENTS = [
    { id: "ST_BACK", label: "< BACK" },
    { id: "ST_BRIGHT", label: "BRIGHT" },
    { id: "ST_SCREEN", label: "SCREEN" },
    { id: "ST_SLEEP", label: "SLEEP" },
    { id: "ST_POWERSAVE", label: "POWER SAVE" },
    { id: "ST_UNIT", label: "UNIT" },
    { id: "ST_THEME", label: "THEME" },
    { id: "ST_TIME", label: "TIME" },
    { id: "ST_UTC", label: "UTC" },
    { id: "ST_BATT", label: "BATT" },
    { id: "ST_BATT_CAL", label: "BATT CAL" },
    { id: "ST_CPU", label: "CPU" },
    { id: "ST_WIFI", label: "WI-FI" },
    { id: "ST_EIBI", label: "EIBI" },
    { id: "ST_QUICKSET", label: "QUICK SET" },
    { id: "ST_SIGDBG", label: "SIG DBG" },
    { id: "ST_SIGVIEW", label: "BOTTOM" },
    { id: "ST_MOD_A", label: "MOD A" },
    { id: "ST_MOD_B", label: "MOD B" },
    { id: "ST_MOD_C", label: "MOD C" },
    { id: "ST_MOD_D", label: "MOD D" },
    { id: "ST_MOD_E", label: "MOD E" },
    { id: "ST_MOD_F", label: "MOD F" },
    { id: "ST_MOD_G", label: "MOD G" },
    { id: "ST_MOD_H", label: "MOD H" },
    { id: "ST_ABOUT", label: "ABOUT" },
  ];

  function elementIds(kind) {
    if (kind === "menu") return MENU_ELEMENTS.map((e) => e.id);
    if (kind === "settings") return SETTINGS_ELEMENTS.map((e) => e.id);
    return [];
  }

  const TIERS = { when: EVENTS, if: CONDITIONS, do: ACTIONS };

  /* 한글 등 비ASCII는 기기 폰트에 없을 수 있으므로 경고용 */
  function isAscii(s) {
    return /^[\x00-\x7F]*$/.test(s);
  }

  function byteLength(s) {
    if (typeof TextEncoder !== "undefined") return new TextEncoder().encode(s).length;
    return Buffer.byteLength(String(s), "utf8");
  }

  function tierOf(kind, type) {
    const map = TIERS[kind];
    const def = map && map[type];
    return def ? def.tier : -1;
  }

  function defOf(kind, type) {
    const map = TIERS[kind];
    return (map && map[type]) || null;
  }

  return {
    FORMAT, LEGACY_FORMAT, SCHEMA_VERSION, LIMITS,
    WIDGET_TYPES, COLORS, FONTS, ALIGNS, LAYOUTS, BINDS, BAND_NAMES,
    EVENTS, CONDITIONS, ACTIONS, TIERS,
    MENU_ELEMENTS, SETTINGS_ELEMENTS, elementIds,
    isAscii, byteLength, tierOf, defOf,
  };
});
