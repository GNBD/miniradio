# NEWPROJECT — MINI-radio Modder Studio v1.0

브라우저에서 도는 **펌웨어 모더**: UI 배치, 라디오 메뉴, 블록 로직, C 위젯을 편집하고
실제 펌웨어 파일을 생성해 빌드·플래시합니다. 서버/설치 없이 동작하며 저장은 **다운로드**입니다.

블록 규칙은 v1에서 **허용 목록에 있는 이벤트/조건/동작만** C로 생성됩니다.
목록 밖 블록은 저장은 되지만 생성이 차단되고 이유가 표시됩니다.

## 실행

```powershell
cd NEWPROJECT
python -m http.server 8765 --bind 127.0.0.1
# http://localhost:8765/
```

## 화면

| 탭 | 내용 |
|---|---|
| **UI** | 320×170 캔버스. FM/AM/SSB **별도 레이아웃**, 스냅, 정렬, 다중선택, 드롭 위치 고스트 |
| **MENU** | 라디오 메뉴 순서/라벨/표시 편집 → `menu_data.c` |
| **SETTINGS** | 설정 메뉴 순서/라벨/표시 편집 → `settings_data.c` |
| **BLOCKS** | WHEN / IF / DO 규칙 → 검증 → `mod_generated.h` (허용 목록 v1) |
| **C** | C 위젯 작성 → 팔레트 `CUSTOM (C)` 등록. 그리기 API는 캔버스에서 미리보기 |

## 파일 구조

```
js/
  catalog.js    데이터: 모듈/템플릿/바인딩/블록/목데이터/메뉴 id
  core/
    schema.js   스키마 v2, 허용 목록, 한도
    project.js  정규화/마이그레이션 (mrpack/1 → v2)
    validate.js 위젯/규칙/코드 검증 (경로·규칙 id 포함)
    ir.js       typed IR
    cgen.js     허용 목록 C 생성 (mod_generated.h)
    menu_c.js   menu_data.c / settings_data.c 생성
    layout_c.js ui_custom_layout.h 생성 (모드별 마스크)
  render.js     320×170 순수 렌더러 (모드 마스크 지원)
  editor.js     캔버스 조작 + FM/AM/SSB 레이아웃 전환
  properties.js 우측 속성 패널
  palette.js    좌측 팔레트 + 툴팁 썸네일
  blocks.js     규칙 편집기 (UI 요소 선택 포함)
  modout.js     검증 패널 + Generate mod
  menu.js       메뉴/설정 리스트 편집기 (공용 팩토리)
  code.js       C 위젯 편집기
  cpreview.js   C 그리기 서브셋 → JS 변환 미리보기
  export.js     저장/로드 + 레이아웃 C 생성 (.mrpack, ui_custom_layout.h)
  app.js        부트스트랩/툴바 배선
samples/        sample-a.mrpack, sample-ui-menu.mrpack
tools/          build-mod.js, build-project.js (CLI 검증/생성)
test/           core.test.js (node --test)
```

로드 순서는 `index.html` 하단에 고정. 각 파일 상단 주석에 의존 관계 표기.

## 사용 흐름

1. **UI**: `TEMPLATES`에서 현재 모드 레이아웃 로드 → 모듈 드래그 → 속성 편집
   - **FM / AM / SSB** 버튼은 각각 독립 레이아웃입니다. 처음 전환할 때 현재 레이아웃을 복사해 시작합니다.
   - 왼쪽 **LAYERS**: 위 = 뒤, **아래 = 앞**. 드래그로 순서 변경, ●/◌ 로 표시/숨김
   - `Inherit` 로 다른 위젯의 레이어를 상속(동일 레이어)
2. **MENU / SETTINGS**: 순서/라벨/표시 편집, 세로·가로 배치 선택
3. **BLOCKS**: 규칙 작성 → `Validate` → `Generate mod` → `mod_generated.h`
   - `Sample A` = RSSI < 15 → 토스트
   - `Sample UI` = MENU `RM_MOD_A`(라벨 `MOD SCAN`) 활성화 → SEEK
4. **C**: 위젯 코드 작성 후 `Save module` → 캔버스로 드래그
5. **Download C** → `ui_custom_layout.h`, **Download menu_data.c / settings_data.c**
6. 적용:

```powershell
powershell -ExecutionPolicy Bypass -File NEWPROJECT\apply.ps1 `
  -Layout "$env:USERPROFILE\Downloads\ui_custom_layout.h" `
  -Menu   "$env:USERPROFILE\Downloads\menu_data.c" `
  -Settings "$env:USERPROFILE\Downloads\settings_data.c" `
  -Mod    "$env:USERPROFILE\Downloads\mod_generated.h"
# 커스텀 UI 끄기 / 생성 모드 끄기
powershell -ExecutionPolicy Bypass -File NEWPROJECT\apply.ps1 -Off
powershell -ExecutionPolicy Bypass -File NEWPROJECT\apply.ps1 -OffMod
```

`apply.ps1`은 기존 파일을 `.bak`으로 백업하고, 빌드 후 버전이 붙은
`build\GNBD_miniradio_<버전>_ota.bin`을 만들어 `0x10000`에 기록합니다
(부트로더/파티션/otadata는 건드리지 않음).

## 모드 생성 (v1 허용 목록)

| 구분 | 지원 |
|---|---|
| WHEN | `boot_ready`, `rssi_updated`, `timer_1s`, `ui_menu` |
| IF | `rssi_lt`, `rssi_gt`, `snr_lt`, `snr_gt`, `freq_gt`, `freq_lt`, `band_is`, `seek_ok` |
| DO | `toast`, `seek` |

- 조건은 모두 AND로 결합됩니다.
- 폴링 규칙(`rssi_updated`, `timer_1s`)은 10초 쿨다운으로 반복 알림을 막습니다.
  사용자 입력 규칙(`ui_menu`)은 누를 때마다 실행됩니다.
- 그 외 블록(엔코더/롱프레스/볼륨/프리셋 등)은 팔레트에 `미구현 (생성 안 됨)`으로 표시되며,
  `Generate mod` 시 해당 규칙이 오류로 표시되고 생성이 차단됩니다.
- 생성 파일은 `main/mod_generated.h` 하나이며 `main/mod_runtime.c`만 include합니다.
- `MODS_ENABLE 0` 스텁이 기본값이라 모드를 끈 펌웨어는 기존과 동일하게 빌드됩니다.

## UI 요소 ↔ 블록 규칙

ATS Mini에는 터치가 없습니다. 따라서 실제 입력이 있는 **MENU 항목**을 UI 요소로 사용합니다.

- UI 요소 ID: `RM_BACK`, `RM_SCAN`, `RM_MOD_A` … `RM_MOD_D` (고정, 라벨과 순서는 편집 가능)
- `RM_MOD_A`~`RM_MOD_D`는 모드 전용 슬롯입니다. 기본 메뉴에서는 숨김이고,
  MENU 탭에서 표시/라벨을 바꿔 사용합니다.
- 규칙은 좌표가 아니라 **ID**를 참조합니다. 라벨을 바꾸거나 위치를 옮겨도 연결이 유지됩니다.
- 검증: 존재하지 않는 ID, 숨김 ID(경고), 중복 ID, 미지원 이벤트/동작을 검사합니다.
- 펌웨어: `menu_action()` → `mod_runtime_ui_event(id)` → `mod_user_menu_event(id)`
- 웹 테스트/연동: `GET /api/cmd?ui=RM_MOD_A` (MOD A~D만 허용)

## 모드별 UI

- `ui.layouts = { FM, AM, SSB }`로 저장하며, 현재 모드는 `ui.activeMode`입니다.
- 내보내기 시 각 모드 위젯에 `UC_M_FM` / `UC_M_AM` / `UC_M_SSB`를 강제합니다.
- 기존 단일 레이아웃 프로젝트는 그대로 동작하며, 위젯별 `modes` 마스크를 사용합니다.
- 가로 메뉴 렌더러는 여전히 미구현입니다.

CLI로도 같은 코어를 실행할 수 있습니다:

```powershell
node NEWPROJECT\tools\build-project.js NEWPROJECT\samples\sample-ui-menu.mrpack NEWPROJECT\.out
node NEWPROJECT\tools\build-project.js <pack> <out> --layout   # ui_custom_layout.h 포함
node --test NEWPROJECT\test\core.test.js
```

## 라이선스 / 책임

- 첫 다운로드 시 동의 모달이 뜹니다.
  - miniradio firmware **MIT**, LovyanGFX **BSD-2-Clause/MIT**,
    littlefs(joltwallet) **MIT**, ESP-IDF **Apache-2.0**
- 배포 시 위 라이선스와 호환되어야 하며, 모드는 전체 권한으로 실행됩니다.
  배포와 결과에 대한 책임은 작성자에게 있습니다.
- 동의 여부는 `.mrpack`의 `manifest.license_accepted`에 기록됩니다.

## 펌웨어 구조

| 파일 | 역할 |
|---|---|
| `main/ui_custom.h/.c` | 위젯 구조체 + 렌더러 (rect/text/bar/line/freq/rsq/rds/sig/bandmap/custom) |
| `main/ui_custom_layout.h` | 생성 레이아웃 (`UI_CUSTOM_ENABLE`, `modes` 마스크) |
| `main/menu_data.h/.c` | 데이터 기반 라디오 메뉴 |
| `main/ui.c` | `ui_custom_active()`일 때 라디오 화면만 대체 (메뉴/설정은 기존 유지) |
| `main/mod_runtime.h/.c` | 생성 모드 경계 (`mod_runtime_tick`, `mod_runtime_ui_event`) |
| `main/mod_generated.h` | 기본은 `MODS_ENABLE 0` 스텁, 생성 시 교체 |
| `main/menu_data.c` | UI 요소 순서/라벨/표시 (숨김은 펌웨어에서 실제 제외) |
| `main/main.c` | `menu_action()`에서 UI 이벤트 디스패치, 메뉴/설정 가시성 필터 |

## 모드 마스크

- 모드별 레이아웃: 내보내기 시 FM/AM/SSB 위젯에 각각의 `UC_M_*` 강제
- 기존 단일 레이아웃: 위젯 속성 `Modes` 마스크 사용 (0/미지정 = 전체)
- 툴의 FM/AM/SSB 버튼은 **편집 레이아웃 전환**입니다.

## 제한 / 다음 단계

- v1 코드 생성은 위 표의 블록만 지원합니다. 나머지는 저장만 되며 생성 시 명시적으로 차단됩니다.
- `seek` 외 라디오 제어(밴드/볼륨/프리셋/튠)는 미구현입니다.
- 레이아웃은 컴파일 적용 (LittleFS 런타임 로드는 v2)
- 가로 MENU/SETTINGS 매크로는 생성되지만 펌웨어 렌더러가 아직 없어 세로로 표시됩니다.
- C 탭은 고급 기능으로, 허용 목록 밖의 코드가 레이아웃에 포함됩니다. mod 생성과는 분리되어 있습니다.
- 메뉴/설정에 **새 값(옵션)을 추가하는 기능은 아직 없습니다.** 현재는 고정 ID의 라벨/순서/표시만 편집합니다.
- 모듈 공유(`.mrmod`), 설치형 에디터(Electron), OTA는 v2

## 검증 상태

| 항목 | 상태 |
|---|---|
| 코어 단위 테스트 | `node --test` 23개 통과 |
| 모드 OFF 빌드 | 성공 |
| 모드 ON 빌드 | 성공 (`sample-ui-menu`, `mod_runtime.c` 경고 없음) |
| 실기 부팅 | 성공 (ESP32-S3, 앱 `0x10000`) |
| UI→규칙 실행 | 성공 — `ui=RM_MOD_A` → 97.50→100.70 MHz, 시리얼 `rule 1 fired` + `seek start` |
| 토스트 표시 | 성공 — `PRESET SAVED` 오버레이 캡처 확인 |
| 토스트 만료 버그 | 수정 — unsigned 비교로 즉시 지워지던 문제 (`main.c`) |
| 모드별 레이아웃 | 생성·검증·컴파일 성공 (실기 플래시는 미적용) |
| 메뉴 숨김 | 펌웨어 필터 구현, 빌드 성공 |
