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

void ui_draw_freq_saved(void)
{
    display_fill_rect(0, HERO_Y - 2, UI_W, HERO_H + 6, UI_BG);
    panel(HERO_X, HERO_Y, HERO_W, HERO_H, 16, UI_PANEL, UI_HL);
    display_draw_text(UI_W / 2, HERO_Y + 15, "-- SAVED --",
                      DISPLAY_FONT_LARGE, UI_OK, UI_PANEL, DISPLAY_DATUM_TC);
}

void ui_draw_freq(const ui_state_t *s)
{
    if (ui_custom_active()) {
        return;
    }
    s_radio_draw_seq++;
    display_fill_rect(0, HERO_Y - 2, UI_W, HERO_H + 6, UI_BG);
    panel(HERO_X, HERO_Y, HERO_W, HERO_H, 16, UI_PANEL, UI_HL);

    int meta_x = HERO_X + 10;
    int meta_y = HERO_Y + 5;
    uint16_t mw = display_draw_text((int16_t)meta_x, (int16_t)meta_y,
                                    band_table[s->band_idx].name,
                                    DISPLAY_FONT_TINY, UI_ACC_HI, UI_PANEL,
                                    DISPLAY_DATUM_TL);
    mw += display_draw_text((int16_t)(meta_x + mw + 4), (int16_t)meta_y, "/",
                            DISPLAY_FONT_TINY, UI_LINE, UI_PANEL,
                            DISPLAY_DATUM_TL);
    display_draw_text((int16_t)(meta_x + mw + 7), (int16_t)meta_y,
                      ui_mode_str(s->mode), DISPLAY_FONT_TINY, UI_MUTED, UI_PANEL,
                      DISPLAY_DATUM_TL);

    char num[20];
    const char *unit;
    ui_fmt_freq(s, num, sizeof(num), &unit);

    display_font_t font = DISPLAY_FONT_HERO;
    uint16_t fw = display_text_width(num, font);
    if (fw > HERO_W - 20) {
        font = DISPLAY_FONT_LARGE;
        fw = display_text_width(num, font);
    }
    uint16_t fh = display_font_height(font);
    int ty = HERO_Y + (HERO_H - (int)fh) / 2 + 1;
    display_draw_text(UI_W / 2, (int16_t)ty, num, font, UI_FG, UI_PANEL,
                      DISPLAY_DATUM_TC);

    display_draw_text(HERO_X + HERO_W - 10, HERO_Y + 5, unit,
                      DISPLAY_FONT_TINY, UI_MUTED, UI_PANEL,
                      DISPLAY_DATUM_TR);

    int badge_x = HERO_X + 8;
    if (s->preset_slot >= 0) {
        char p[16];
        snprintf(p, sizeof(p), "P%d", s->preset_slot + 1);
        pill(badge_x, HERO_Y + HERO_H - 18, p, 50, UI_BLACK, UI_ACC);
        badge_x += display_text_width(p, DISPLAY_FONT_TINY) + 18;
    }
    if (s->ats_slot >= 0) {
        char a[16];
        snprintf(a, sizeof(a), "A%d", s->ats_slot + 1);
        pill(badge_x, HERO_Y + HERO_H - 18, a, 50, UI_BLACK, UI_GOLD);
    }
    if (s->bfo_hz != 0 && band_is_ssb(s->mode)) {
        char b[16];
        snprintf(b, sizeof(b), "BFO %+d", (int)s->bfo_hz);
        uint16_t bw = display_text_width(b, DISPLAY_FONT_TINY);
        pill(HERO_X + HERO_W - (int)bw - 22, HERO_Y + HERO_H - 18, b, 110,
             UI_GOLD, UI_PANEL);
    }
}

void chip_row(const ui_state_t *s)
{
    display_fill_rect(0, META_Y, UI_W, META_H, UI_BG);

    char st[12];
    if (s->step_hz >= 1000 && s->step_hz % 1000 == 0) {
        snprintf(st, sizeof(st), "%dK", s->step_hz / 1000);
    } else {
        snprintf(st, sizeof(st), "%d", s->step_hz);
    }

    int y = META_Y + 4;
    int x = 10;
    uint16_t w = display_draw_text((int16_t)x, (int16_t)y, "BW",
                                   DISPLAY_FONT_TINY, UI_MUTED, UI_BG,
                                   DISPLAY_DATUM_TL);
    display_draw_text((int16_t)(x + w + 5), (int16_t)y, ui_bw_label(s),
                      DISPLAY_FONT_TINY, UI_FG, UI_BG, DISPLAY_DATUM_TL);

    uint16_t vw = display_text_width(st, DISPLAY_FONT_TINY);
    uint16_t lw = display_text_width("STEP", DISPLAY_FONT_TINY);
    int rx = UI_W - 10 - (int)vw;
    display_draw_text((int16_t)(rx - (int)lw - 5), (int16_t)y, "STEP",
                      DISPLAY_FONT_TINY, UI_MUTED, UI_BG, DISPLAY_DATUM_TL);
    display_draw_text((int16_t)rx, (int16_t)y, st, DISPLAY_FONT_TINY, UI_FG,
                      UI_BG, DISPLAY_DATUM_TL);

    display_fill_rect(UI_W / 2, (int16_t)(META_Y + 5), 1, 6, UI_LINE);
}

void ui_draw_smeter(const ui_state_t *s)
{
    if (ui_custom_active()) {
        return;
    }
    s_radio_draw_seq++;
    ui_draw_adv_signal4b(s);
    return;
    display_fill_rect(0, SIG_Y, UI_W, SIG_H + 2, UI_BG);
    panel(SIG_X, SIG_Y, SIG_W, SIG_H, 12, UI_PANEL, UI_HL);

    char sv[16];
    char nv[16];
    uint16_t ncol = (!s->have_rsq || s->rsq.snr < 10) ? UI_WARN : UI_ACC;
    if (s->have_rsq) {
        snprintf(sv, sizeof(sv), "RSSI %d%s", s->rsq.rssi,
                 s->rsq.rssi > 63 ? "+" : "");
        snprintf(nv, sizeof(nv), "SNR %u", s->rsq.snr);
    } else {
        snprintf(sv, sizeof(sv), "RSSI --");
        snprintf(nv, sizeof(nv), "SNR --");
        ncol = UI_MUTED;
    }
    const char *lbl = "SIGNAL";
    uint16_t lcol = UI_MUTED;
    char seek_lbl[20];
    if (s->seeking) {
        int pct = 0;
        if (s->sw_max > 0) {
            pct = (s->sw_steps * 100) / s->sw_max;
            if (pct > 100) { pct = 100; }
            if (pct < 0) { pct = 0; }
        }
        snprintf(seek_lbl, sizeof(seek_lbl), "SEEK %d%%", pct);
        lbl = seek_lbl;
        lcol = UI_ACC_HI;
    }
    display_draw_text(SIG_X + 10, SIG_Y + 5, lbl, DISPLAY_FONT_TINY,
                      lcol, UI_PANEL, DISPLAY_DATUM_TL);
    int right = SIG_X + SIG_W - 10;
    int nw = (int)display_text_width(nv, DISPLAY_FONT_TINY);
    display_draw_text((int16_t)right, SIG_Y + 5, nv, DISPLAY_FONT_TINY, ncol,
                      UI_PANEL, DISPLAY_DATUM_TR);
    int divx = right - nw - 8;
    display_fill_rect((int16_t)divx, SIG_Y + 7, 1, 6, UI_LINE);
    display_draw_text((int16_t)(divx - 6), SIG_Y + 5, sv,
                      DISPLAY_FONT_TINY, UI_OK, UI_PANEL, DISPLAY_DATUM_TR);

    int bar_y = SIG_Y + 15;
    bar(SIG_X + 10, bar_y, SIG_W - 20, 4,
        s->have_rsq ? s->rsq.rssi : 0, 63, UI_OK);
    bar_y += 5;
    bar(SIG_X + 10, bar_y, SIG_W - 20, 4,
        s->have_rsq ? s->rsq.snr : 0, 63,
        (!s->have_rsq || s->rsq.snr < 10) ? UI_WARN : UI_ACC);
}

void ui_draw_rds(const ui_state_t *s)
{
    if (ui_custom_active()) {
        return;
    }
    s_radio_draw_seq++;
    ui_draw_adv_signal4b(s);
    return;
    display_fill_rect(0, RDS_Y, UI_W, UI_H - RDS_Y, UI_BG);
    panel(6, RDS_Y, 308, RDS_H, 11, UI_PANEL, UI_HL);

    bool fm = (s->mode == RADIO_MODE_FM);
    const char *tag = fm ? "RDS" : "EiBi";
    uint16_t tagc = !fm ? UI_GOLD : (s->rds_on ? UI_ACC_HI : UI_MUTED);
    display_draw_text(16, RDS_Y + 7, tag, DISPLAY_FONT_TINY, tagc, UI_PANEL,
                      DISPLAY_DATUM_TL);
    display_fill_rect(48, RDS_Y + 5, 1, RDS_H - 10, UI_LINE);

    int cx = 56;
    int right = 304;
    int avail = right - cx;

    if (!fm) {
        static int st_off;
        const char *line = (s->station && s->station[0]) ? s->station
                                                         : "...";
        char rot[128];
        size_t len = strlen(line);
        if (s->station && len > 3 &&
            display_text_width(line, DISPLAY_FONT_TINY) > (uint16_t)avail) {
            int off = st_off % (int)len;
            for (size_t i = 0; i < len; ++i) {
                rot[i] = line[(off + i) % len];
            }
            rot[len] = '\0';
            line = rot;
            st_off++;
        }
        char buf[128];
        fit_text(buf, sizeof(buf), line, DISPLAY_FONT_TINY, avail);
        display_draw_text(cx, RDS_Y + 7, buf, DISPLAY_FONT_TINY,
                          s->station ? UI_OK : UI_MUTED, UI_PANEL,
                          DISPLAY_DATUM_TL);
        return;
    }

    if (!s->rds_on) {
        display_draw_text(cx, RDS_Y + 7, "OFF", DISPLAY_FONT_TINY,
                          UI_MUTED, UI_PANEL, DISPLAY_DATUM_TL);
        return;
    }
    const rds_info_t *r = s->rds;
    if (!r || (!r->ps_valid && !r->rt_valid)) {
        display_draw_text(cx, RDS_Y + 7, "...",
                          DISPLAY_FONT_TINY, UI_MUTED, UI_PANEL,
                          DISPLAY_DATUM_TL);
        return;
    }

    int ptyw = 0;
    const char *pty = rds_pty_name(r->pty);
    if (pty && pty[0] && strcmp(pty, "NONE") != 0) {
        char pb[24];
        ptyw = fit_text(pb, sizeof(pb), pty, DISPLAY_FONT_TINY, 72);
        display_draw_text(right, RDS_Y + 7, pb, DISPLAY_FONT_TINY, UI_ACC,
                          UI_PANEL, DISPLAY_DATUM_TR);
        ptyw += 10;
    }

    char line[80];
    const char *src = (r->rt_valid && r->rt[0]) ? r->rt : r->ps;

    static int s_rt_off;
    char rot[80];
    size_t len = strlen(src);
    int textw = avail - ptyw;
    if (textw < 24) {
        textw = 24;
    }
    if ((r->rt_valid && r->rt[0]) && len > 3 && len < sizeof(rot) &&
        display_text_width(src, DISPLAY_FONT_SMALL) > (uint16_t)textw) {
        int off = s_rt_off % (int)len;
        for (size_t i = 0; i < len; ++i) {
            rot[i] = src[(off + i) % len];
        }
        rot[len] = '\0';
        src = rot;
        s_rt_off++;
    }

    fit_text(line, sizeof(line), src, DISPLAY_FONT_SMALL, textw);
    display_draw_text(cx, RDS_Y + 3, line, DISPLAY_FONT_SMALL, UI_FG, UI_PANEL,
                      DISPLAY_DATUM_TL);
}

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
