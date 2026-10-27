# -*- coding: utf-8 -*-
"""sleep 카운트다운을 헤더 우측(상태표시 왼쪽)으로 이동, 중앙 알림 복원."""
import io

# 1) draw_header_msg: sleep 분기 제거 (SEEK%/SEEK/SSB 알림 복원)
p = 'main/ui_core.c'
t = io.open(p, encoding='utf-8').read()
old = '''    } else if (s_sleep_min > 0 && s_sleep_armed) {
        int32_t remain = (int32_t)(s_sleep_deadline - now_ms());
        if (remain < 0) {
            remain = 0;
        }
        int sec = (int)((remain + 999) / 1000);
        if (sec > 99 * 60 + 59) {
            sec = 99 * 60 + 59;
        }
        snprintf(sleep_buf, sizeof(sleep_buf), "SLEEP %d:%02d",
                 sec / 60, sec % 60);
        msg = sleep_buf;
        col = UI_ACC;
    } else if (s->seeking) {'''
new = '''    } else if (s->seeking) {'''
assert old in t
t = t.replace(old, new)
t = t.replace('    char sleep_buf[20];\n', '')

# 2) draw_status_right: 조기 return 제거 + 우측 최외곽에 sleep 배치
old2 = '''    if (s->wifi_state == 1) {
        int tw = display_text_width("ap", DISPLAY_FONT_TINY);
        display_draw_text((int16_t)(cursor - tw), 6, "ap", DISPLAY_FONT_TINY,
                          UI_WARN, UI_BG, DISPLAY_DATUM_TL);
        return;
    }
    if (!s_sta_connected || s->wifi_state != 2) {
        return;
    }
    uint16_t wc;
    if (s->wifi_state == 0) {
        wc = UI_MUTED;
    } else if (s->wifi_state == 2) {
        wc = UI_ACC_HI;
    } else {
        wc = UI_GOLD;
    }
    int bars = 0;
    if (s->wifi_state == 1) {
        bars = 4;
    } else if (s->wifi_state == 2) {
        int r = s->wifi_rssi;
        bars = (r >= -55) ? 4 : (r >= -65) ? 3 : (r >= -75) ? 2 : 1;
    }
    const char *lbl = (s->wifi_state == 0) ? NULL
                    : (s->wifi_state == 1) ? "ap" : "sta";
    int lw = lbl ? display_text_width(lbl, DISPLAY_FONT_TINY) : 0;
    int gx = cursor - (12 + (lbl ? 3 + lw : 0));
    if (gx < 0) {
        gx = 0;
    }
    wifi_icon(gx, 5, wc, bars);
    if (lbl) {
        display_draw_text((int16_t)(gx + 15), 6, lbl, DISPLAY_FONT_TINY,
                          UI_MUTED, UI_BG, DISPLAY_DATUM_TL);
    }
}'''
new2 = '''    if (s->wifi_state == 1) {
        int tw = display_text_width("ap", DISPLAY_FONT_TINY);
        display_draw_text((int16_t)(cursor - tw), 6, "ap", DISPLAY_FONT_TINY,
                          UI_WARN, UI_BG, DISPLAY_DATUM_TL);
        cursor = cursor - tw - 6;
    } else if (s_sta_connected && s->wifi_state == 2) {
        int r = s->wifi_rssi;
        int bars = (r >= -55) ? 4 : (r >= -65) ? 3 : (r >= -75) ? 2 : 1;
        const char *lbl = "sta";
        int lw = display_text_width(lbl, DISPLAY_FONT_TINY);
        int gx = cursor - (12 + 3 + lw);
        if (gx < 0) {
            gx = 0;
        }
        wifi_icon(gx, 5, UI_ACC_HI, bars);
        display_draw_text((int16_t)(gx + 15), 6, lbl, DISPLAY_FONT_TINY,
                          UI_MUTED, UI_BG, DISPLAY_DATUM_TL);
        cursor = gx - 6;
    }

    /* Sleep 카운트다운: 상태표시(배터리/Wi-Fi) 왼쪽 = 헤더 최대 우측.
       중앙 영역은 SEEK%/SEEK/SSB 알림용으로 비워 둔다. */
    if (s_sleep_min > 0 && s_sleep_armed) {
        char b[20];
        int32_t remain = (int32_t)(s_sleep_deadline - now_ms());
        if (remain < 0) {
            remain = 0;
        }
        int sec = (int)((remain + 999) / 1000);
        if (sec > 99 * 60 + 59) {
            sec = 99 * 60 + 59;
        }
        snprintf(b, sizeof(b), "SLEEP %d:%02d", sec / 60, sec % 60);
        int tw = display_text_width(b, DISPLAY_FONT_TINY);
        int tx = cursor - tw;
        if (tx < 0) {
            tx = 0;
        }
        int fw = cursor - tx;
        if (fw < tw) {
            fw = tw;
        }
        display_fill_rect((int16_t)tx, 0, (uint16_t)fw, HDR_H - 1, UI_BG);
        display_draw_text((int16_t)tx, 6, b, DISPLAY_FONT_TINY, UI_ACC, UI_BG,
                          DISPLAY_DATUM_TL);
    }
}'''
assert old2 in t
t = t.replace(old2, new2)
io.open(p, 'w', encoding='utf-8', newline='').write(t)

# 3) main.c: 매초 헤더 전체(시계+상태+sleep) 갱신
p = 'main/main.c'
t = io.open(p, encoding='utf-8').read()
old3 = '                draw_header_msg(&s_ui);\n'
new3 = '                ui_draw_header(&s_ui);\n'
assert old3 in t
t = t.replace(old3, new3)
io.open(p, 'w', encoding='utf-8', newline='').write(t)
print('patched')
