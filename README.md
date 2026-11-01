# GNBD ATS Mini Radio

ESP32-S3 기반 SI4732 라디오 펌웨어입니다. FM/AM/SSB 수신, RDS, EiBi 스케줄, 커스텀 UI,
Lua 스크립팅, Wi-Fi 웹 에디터 등을 지원합니다.

## 주요 기능

- FM / AM / SSB(LSB/USB) 수신
- RDS (PS/RT/PTY/CT), EiBi 방송 스케줄 조회
- 커스텀 UI 레이아웃 (LittleFS 런타임 + web 에디터)
- Lua 위젯 API (w, radio, gpio, log, time_ms)
- ATS(자동 채널 스캔), 스펙트럼 스캔, 프리셋/ATS 리스트
- Wi-Fi 웹 인터페이스 (설정, UI 편집, 펌웨어 업데이트)

## 라이선스

- 본 프로젝트: MIT License (see `LICENSE`)
- 디스플레이: ESP32-SI4732 Radio (Max Arnold) — MIT
- LovyanGFX: license.txt 참조
- ESP-IDF / LittleFS: 각 라이선스 참조
- SSB 패치 데이터: Silicon Labs 출처, 별도 라이선스 검증 필요
