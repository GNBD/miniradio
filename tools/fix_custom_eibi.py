# -*- coding: utf-8 -*-
"""커스텀 UI EIBI 문제 수정: 메뉴/설정 깜빡임 제거 + EIBI 마퀴 위젯별."""
import io

# 1) main.c: 커스텀 UI 모드에서 메뉴/설정 패널 redraw 건너뛰기
p = 'main/main.c'
t = io.open(p, encoding='utf-8').read()
old = '''                if (s_hmi == HMI_TUNE) {
                    ui_draw_all(&s_ui);
                } else if (s_hmi == HMI_MENU || s_hmi == HMI_SET ||
                           s_hmi == HMI_FAV || s_hmi == HMI_ATS_LIST) {
                    ui_draw_radio_panel(&s_ui);
                }'''
new = '''                if (s_hmi == HMI_TUNE) {
                    ui_draw_all(&s_ui);
                } else if (s_hmi == HMI_MENU || s_hmi == HMI_SET ||
                           s_hmi == HMI_FAV || s_hmi == HMI_ATS_LIST) {
                    /* 커스텀 UI 는 패널 재그림 시 화면 전체를 다시 그리므로
                       EIBI 갱신마다 깜빡임 -> 커스텀 모드에서는 redraw 하지 않고
                       값만 저장(메뉴 종료 후 라디오로 돌아올 때 반영) */
                    if (!ui_custom_active()) {
                        ui_draw_radio_panel(&s_ui);
                    }
                }'''
assert old in t
t = t.replace(old, new, 1)
io.open(p, 'w', encoding='utf-8', newline='').write(t)

# 2) ui_custom.c: EIBI/RDS 마퀴를 위젯 uid 기준으로
p = 'main/ui/ui_custom.c'
t = io.open(p, encoding='utf-8').read()

old2 = '''static void draw_rds(const uc_widget_t *w, const ui_state_t *s)
{
    display_fill_rect((int16_t)w->x, (int16_t)w->y, (uint16_t)w->w,
                      (uint16_t)w->h, UI_PANEL);
    display_draw_rect((int16_t)w->x, (int16_t)w->y, (uint16_t)w->w,
                      (uint16_t)w->h, UI_LINE);

    if (s->mode != RADIO_MODE_FM) {
        /* AM/SSB: EiBi 정보 카드 */
        display_draw_text((int16_t)(w->x + 4), (int16_t)(w->y + 3), "EIBI",
                          DISPLAY_FONT_TINY, UI_GOLD, UI_PANEL,
                          DISPLAY_DATUM_TL);
        display_draw_text((int16_t)(w->x + w->w - 4), (int16_t)(w->y + 3),
                          s->clock, DISPLAY_FONT_TINY, UI_MUTED, UI_PANEL,
                          DISPLAY_DATUM_TR);
        const char *st = (s->station && s->station[0]) ? s->station : "NO DATA";
        char eb[40];
        fit(eb, sizeof(eb), st, DISPLAY_FONT_TINY, w->w - 8);
        display_draw_text((int16_t)(w->x + 4), (int16_t)(w->y + 16), eb,
                          DISPLAY_FONT_TINY, UI_FG, UI_PANEL,
                          DISPLAY_DATUM_TL);
        return;
    }'''
new2 = '''static void draw_rds(const uc_widget_t *w, const ui_state_t *s)
{
    display_fill_rect((int16_t)w->x, (int16_t)w->y, (uint16_t)w->w,
                      (uint16_t)w->h, UI_PANEL);
    display_draw_rect((int16_t)w->x, (int16_t)w->y, (uint16_t)w->w,
                      (uint16_t)w->h, UI_LINE);

    int idx = w->uid ? (int)(w->uid % 8) : 0;

    if (s->mode != RADIO_MODE_FM) {
        /* AM/SSB: EiBi 정보 카드 (uid 별 마퀴) */
        display_draw_text((int16_t)(w->x + 4), (int16_t)(w->y + 3), "EIBI",
                          DISPLAY_FONT_TINY, UI_GOLD, UI_PANEL,
                          DISPLAY_DATUM_TL);
        display_draw_text((int16_t)(w->x + w->w - 4), (int16_t)(w->y + 3),
                          s->clock, DISPLAY_FONT_TINY, UI_MUTED, UI_PANEL,
                          DISPLAY_DATUM_TR);
        const char *st = (s->station && s->station[0]) ? s->station : "NO DATA";
        static int eibi_off[8];
        char eb[40];
        size_t len = strlen(st);
        if (len > 3 && display_text_width(st, DISPLAY_FONT_TINY) >
            (uint16_t)(w->w - 8)) {
            int off = eibi_off[idx] % (int)len;
            char rot[128];
            size_t n = len;
            if (n > sizeof(rot) - 1) {
                n = sizeof(rot) - 1;
            }
            for (size_t i = 0; i < n; ++i) {
                rot[i] = st[(off + i) % len];
            }
            rot[n] = '\\0';
            fit(eb, sizeof(eb), rot, DISPLAY_FONT_TINY, w->w - 8);
            ++eibi_off[idx];
        } else {
            fit(eb, sizeof(eb), st, DISPLAY_FONT_TINY, w->w - 8);
        }
        display_draw_text((int16_t)(w->x + 4), (int16_t)(w->y + 16), eb,
                          DISPLAY_FONT_TINY, UI_FG, UI_PANEL,
                          DISPLAY_DATUM_TL);
        return;
    }

    display_draw_text((int16_t)(w->x + 4), (int16_t)(w->y + 3), "RDS",
                      DISPLAY_FONT_TINY, UI_ACC_HI, UI_PANEL, DISPLAY_DATUM_TL);
    if (s->rds) {
        display_draw_text((int16_t)(w->x + w->w - 4), (int16_t)(w->y + 3),
                          rds_pty_name(s->rds->pty), DISPLAY_FONT_TINY,
                          UI_MUTED, UI_PANEL, DISPLAY_DATUM_TR);
        const char *ps = (s->rds->ps_valid && s->rds->ps[0]) ? s->rds->ps : "--";
        static int rds_off[8];
        char pr[40];
        size_t plen = strlen(ps);
        if (plen > 3 && display_text_width(ps, DISPLAY_FONT_TINY) >
            (uint16_t)(w->w - 8)) {
            int off = rds_off[idx] % (int)plen;
            char rot[128];
            size_t n = plen;
            if (n > sizeof(rot) - 1) {
                n = sizeof(rot) - 1;
            }
            for (size_t i = 0; i < n; ++i) {
                rot[i] = ps[(off + i) % plen];
            }
            rot[n] = '\\0';
            fit(pr, sizeof(pr), rot, DISPLAY_FONT_TINY, w->w - 8);
            ++rds_off[idx];
        } else {
            fit(pr, sizeof(pr), ps, DISPLAY_FONT_TINY, w->w - 8);
        }
        display_draw_text((int16_t)(w->x + 4), (int16_t)(w->y + 16), pr,
                          DISPLAY_FONT_TINY, UI_FG, UI_PANEL,
                          DISPLAY_DATUM_TL);
        if (s->rds->rt_valid && s->rds->rt[0]) {
            char rt[40];
            fit(rt, sizeof(rt), s->rds->rt, DISPLAY_FONT_TINY, w->w - 8);
            display_draw_text((int16_t)(w->x + 4), (int16_t)(w->y + 30), rt,
                              DISPLAY_FONT_TINY, UI_MUTED, UI_PANEL,
                              DISPLAY_DATUM_TL);
        }
    }
}'''
assert old2 in t
t = t.replace(old2, new2, 1)
io.open(p, 'w', encoding='utf-8', newline='').write(t)
print('ok')
