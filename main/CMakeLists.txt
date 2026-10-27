# SPDX-License-Identifier: MIT
idf_component_register(SRCS "main.c" "menu.c" "input.c" "pages.c" "time.c" "wifi_ui.c" "lists.c" "keypad.c" "save.c" "webcmd.c" "setup.c" "ui_core.c" "ui_freq.c" "ui_home.c" "ui_spectrum.c" "ui_quick.c" "ui_dx.c" "ui_list.c" "ui_wifi.c" "ui_misc.c" "app_state.c" "board_util.c" "decode.c" "eibi.c" "radio.c" "weather.c" "wifi.c" "web.c" "ui_custom.c" "menu_data.c" "settings_data.c" "splash.c" "version.c" "mod_runtime.c" "ui_runtime.c" "ui_web.c" "ui_editor_assets.c"
                       INCLUDE_DIRS "."
                       REQUIRES si4732 band display encoder audio storage
                                battery rds esp_adc
                                esp_driver_i2c esp_driver_gpio esp_system
                                esp_wifi esp_netif esp_event esp_pm
                                esp_http_server app_update
                                esp_http_client esp-tls littlefs mbedtls)
