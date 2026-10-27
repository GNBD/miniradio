# Mod API Inventory (verified)

> Source of truth: `main/app.h`, `main/radio.c`, `main/main.c`, `main/ui.h`,
> `main/audio` (component), `main/storage` (component).
> Only functions declared in headers or exposed below may be called from
> generated mod code. Anything marked **GAP** is not exposed yet.

## Context rules

- Generated code runs from `mod_runtime_tick()` in the main loop, or from
  `mod_user_menu_event()` / `mod_user_settings_event()` during input handling.
- Do not call I2C/SI4732 directly from web/HTTP tasks; use queued commands.
- Do not block. `seek_start`, `ats_start`, `spectrum_scan_start` are asynchronous.
- NVS writes must stay debounced via `mark_change()` / `do_save()`.
- UI redraw ownership stays with the main loop; use `toast()` or state flags.

## Read state

| Value | Source | Notes |
|---|---|---|
| frequency | `s_ui.freq_hz` | Hz |
| mode / band | `s_ui.mode`, `s_ui.band_idx`, `band_table[]` | |
| RSSI / SNR | `s_ui.rsq.rssi`, `.snr`, `s_ui.have_rsq` | 0–63 |
| seeking | `s_seeking`, `s_ui.seeking` | |
| radio ready | `s_radio_ok`, `s_powered` | |
| stereo | `s_ui.stereo` | |
| RDS | `s_rds`, `s_ui.rds` | `rds_info_t` |
| preset / ATS | `s_ui.preset_slot`, `s_ui.ats_slot` | -1 = none |
| volume | `audio_get_volume()`, `s_ui.volume` | 0–63 |
| battery | `s_batt`, `s_ui.battery` | |
| Wi-Fi | `s_wifi_mode`, `s_sta_connected`, `s_sta_ip` | |
| DSP settings | `s_agc_on`, `s_avc`, `s_softmute`, `s_squelch_*` | |
| audio settings | `s_deemph_75`, `s_stereo_force` | |
| display settings | `s_brightness`, `s_screen_sec`, `s_cpu_mhz` | brightness apply is static (GAP) |
| sleep | `s_sleep_min`, `s_sleep_deadline`, `s_sleep_armed` | |

## Tuning / scanning

| Function | Header | Safe use |
|---|---|---|
| `radio_tune()` | `app.h` | direct tune of current `s_ui.freq_hz` |
| `radio_apply()` | `app.h` | re-apply mode/filter/volume |
| `radio_ensure_mode()` | `app.h` | ensure SI4732 mode |
| `tune_commit(now)` | `app.h` | coalesced tune from pending steps |
| `on_encoder(delta)` | `app.h` | emulate tuning input (careful) |
| `seek_start(up)` | `app.h` | async, fails on SSB / not ready / busy |
| `seek_stop()` | `app.h` | stops seek |
| `ats_start()` | `app.h` | async auto-store scan |
| `ats_cancel()` | `app.h` | cancels ATS |
| `spectrum_scan_start()` | `app.h` | async spectrum scan |
| `spectrum_scan_cancel()` | `app.h` | cancel |
| `set_band(idx)` | `app.h` | 0..`band_count-1` |
| `apply_step_snap()` | `app.h` | after changing step |
| `bw_apply()` | `app.h` | apply bandwidth |
| `radio_set_volume()` | `app.h` | applies `s_ui.volume` |
| `audio_change_volume(delta)` | `audio.h` | relative volume |
| `dsp_apply()` | `app.h` | apply AGC/AVC/softmute/squelch |
| `rfgain_apply()` | `app.h` | apply FM RF gain |
| `cpu_apply(mhz)` | `app.h` | 80/160/240 MHz |

## UI / navigation / notification

| Function | Header | Notes |
|---|---|---|
| `toast(text)` | `app.h` | 40-byte buffer, 2 s |
| `page_radio()` | `app.h` | return to radio |
| `page_menu()` | `app.h` | open MENU |
| `page_set()` | `app.h` | open SETTINGS |
| `open_favorites()` | `app.h` | FAV list |
| `open_scan_list()` | `app.h` | Wi-Fi scan list |
| `open_ats_list()` | `app.h` | ATS results |
| `options_open(page,item)` | `app.h` | value overlay |
| `menu_action(cursor)` | `app.h` | cursor-based, not ID-based |
| `ui_draw_*` | `ui.h` | drawing primitives/pages |
| `display_*` | `display.h` | drawing only |

## Persistence

| Function | Header | Notes |
|---|---|---|
| `mark_change()` | `app.h` | schedules debounced save |
| `do_save()` | `app.h` | immediate save |
| `save_flush(now)` | `app.h` | loop-driven flush |
| `storage_save_*` / `storage_load_*` | `storage.h` | NVS; avoid high frequency |

## Current block mapping (v1)

| Block | Implementation |
|---|---|
| `event.ui_menu` | `menu_action()` → `mod_user_menu_event()` |
| `event.ui_settings` | SET click → `mod_user_settings_event()` |
| `condition.seek_ok` | `s_radio_ok && !s_seeking && !band_is_ssb()` |
| `action.seek` | `seek_start(true)` |
| `action.toast` | `toast()` |

## Not exposed yet (GAP)

- brightness apply (`brightness_apply` is `static` in `main.c`)
- sleep arm/cancel wrapper
- direct preset save/delete by slot
- RDS on/off wrapper
- stereo/deemphasis apply wrapper
- ATS/scan completion callbacks (only polling)
- encoder/button events to rules
- settings/options value change events
- horizontal MENU/SETTINGS renderer
- runtime user variables
