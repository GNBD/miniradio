# GNBD ATS Mini Radio

ESP32-S3 firmware for the SI4732 radio. Supports FM/AM/SSB reception, RDS, EiBi schedule,
custom UI, Lua scripting, and Wi-Fi web editor.

## Features

- FM / AM / SSB(LSB/USB) reception
- RDS (PS/RT/PTY/CT), EiBi broadcast schedule lookup
- Custom UI layout (LittleFS runtime + web editor)
- Lua widget API (w, radio, gpio, log, time_ms)
- ATS (auto channel scan), spectrum scan, preset/ATS list
- Wi-Fi web interface (settings, UI editing, firmware update)

## License

- This project: MIT License (see `LICENSE`)
- Display: ESP32-SI4732 Radio (Max Arnold) — MIT
- LovyanGFX: see license.txt
- ESP-IDF / LittleFS: see their respective licenses
- SSB patch data: Silicon Labs origin, separate license verification required
