/*
 * SPDX-License-Identifier: MIT
 *
 * Copyright (c) miniradio Contributors
 * Copyright (c) 2026 GNBD
 *
 * Radio frequency screen (hero card, S-meter, RDS, status).
 *
 * This source file is licensed under the MIT License.
 */
#include <stdio.h>
#include <string.h>
#include <ctype.h>
#include <stdlib.h>
#include "display.h"
#include "ui.h"
#include "ui_custom.h"
#include "ui_runtime.h"
#include "eibi.h"
#include "decode.h"
#include "ui_int.h"


void ui_draw_status(const ui_state_t *s)
{
    if (ui_custom_active()) {
        return;
    }
    draw_header_msg(s);
}

void ui_draw_loading(const char *msg)
{
    panel(60, 55, 200, 60, 12, UI_PANEL, UI_ACC);
    display_draw_text(UI_W / 2, 68, msg ? msg : "LOADING",
                      DISPLAY_FONT_SMALL, UI_FG, UI_PANEL, DISPLAY_DATUM_TC);
    display_draw_text(UI_W / 2, 88, "PLEASE WAIT", DISPLAY_FONT_TINY,
                      UI_MUTED, UI_PANEL, DISPLAY_DATUM_TC);
    display_flush();
}

/* Sleep 진입 5초 카운트다운 — SSB 로딩 패널과 같은 스타일 */
void ui_draw_sleep_countdown(int sec)
{
    if (sec < 0) { sec = 0; }
    if (sec > 5) { sec = 5; }
    uint16_t col = (sec <= 2) ? UI_WARN : UI_ACC;
    /* 뒤에 남은 주파수/상태 글자가 비쳐 보이지 않도록 화면을 비운다 */
    display_fill_screen(UI_BG);
    panel(60, 50, 200, 72, 14, UI_PANEL, UI_ACC);
    display_draw_text(UI_W / 2, 58, "SLEEP TIMER", DISPLAY_FONT_TINY, UI_MUTED,
                      UI_PANEL, DISPLAY_DATUM_TC);
    char v[8];
    snprintf(v, sizeof(v), "%d", sec);
    display_draw_text(UI_W / 2, 82, v, DISPLAY_FONT_LARGE,
                      (sec <= 2) ? UI_WARN : UI_FG, UI_PANEL,
                      DISPLAY_DATUM_TC);
    bar(80, 100, 160, 6, sec, 5, col);
    display_draw_text(UI_W / 2, 114, "POWER OFF", DISPLAY_FONT_TINY,
                      UI_MUTED, UI_PANEL, DISPLAY_DATUM_TC);
    display_flush();
}

void ui_draw_volume(const ui_state_t *s, bool show)
{
    if (!show) {
        ui_draw_all(s);
        return;
    }
    display_fill_round_rect(44, 50, 232, 70, 18, UI_PANEL);
    display_draw_round_rect(44, 50, 232, 70, 18, UI_LINE);

    display_draw_text(60, 58, "Volume", DISPLAY_FONT_TINY, UI_MUTED, UI_PANEL,
                      DISPLAY_DATUM_TL);
    char v[8];
    snprintf(v, sizeof(v), "%u", s->volume);
    display_draw_text(260, 55, v, DISPLAY_FONT_LARGE, UI_FG, UI_PANEL,
                      DISPLAY_DATUM_TR);
    bar(60, 96, 200, 8, s->volume, 63, UI_ACC);
}
