# -*- coding: utf-8 -*-
"""sleep 카운트를 남은 폭에 맞춰 유동 배치(라벨 축약/생략), 상태표시는 절대 침범 금지."""
import io

p = 'main/ui_core.c'
t = io.open(p, encoding='utf-8').read()

old = '''void draw_header_sleep(void)
{
    if (!(s_sleep_min > 0 && s_sleep_armed)) {
        return;
    }
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
    /* 중앙 알림(46~170)은 침범하지 않고, 상태표시 왼쪽에 우측 정렬 */
    int right = s_status_cursor;
    if (right > UI_W - 6) {
        right = UI_W - 6;
    }
    int tx = right - tw;
    if (tx < 174) {
        tx = 174;
    }
    int fw = right - tx;
    if (fw < tw) {
        fw = tw;
    }
    if (tx + fw > UI_W) {
        fw = UI_W - tx;
    }
    display_fill_rect((int16_t)tx, 0, (uint16_t)fw, HDR_H - 1, UI_BG);
    display_draw_text((int16_t)tx, 6, b, DISPLAY_FONT_TINY, UI_ACC, UI_BG,
                      DISPLAY_DATUM_TL);
}'''

new = '''void draw_header_sleep(void)
{
    if (!(s_sleep_min > 0 && s_sleep_armed)) {
        return;
    }
    int32_t remain = (int32_t)(s_sleep_deadline - now_ms());
    if (remain < 0) {
        remain = 0;
    }
    int sec = (int)((remain + 999) / 1000);
    if (sec > 99 * 60 + 59) {
        sec = 99 * 60 + 59;
    }

    /* 유동 배치: 중앙 알림(<=170)과 상태표시(오른쪽) 사이의 남은 폭만 사용.
       폭이 부족하면 'SLEEP ' 라벨을 떼고, 그래도 부족하면 표시하지 않는다.
       (상태표시/Wi-Fi 신호는 절대 가리지 않는다) */
    const int left_limit = 174;
    int right = s_status_cursor - 4;
    if (right > UI_W - 6) {
        right = UI_W - 6;
    }
    int avail = right - left_limit;
    if (avail < 26) {
        return;
    }

    char b[20];
    snprintf(b, sizeof(b), "SLEEP %d:%02d", sec / 60, sec % 60);
    if ((int)display_text_width(b, DISPLAY_FONT_TINY) > avail) {
        snprintf(b, sizeof(b), "%d:%02d", sec / 60, sec % 60);
        if ((int)display_text_width(b, DISPLAY_FONT_TINY) > avail) {
            return;
        }
    }

    int tw = display_text_width(b, DISPLAY_FONT_TINY);
    int tx = right - tw;
    if (tx < left_limit) {
        tx = left_limit;
    }
    display_fill_rect((int16_t)tx, 0, (uint16_t)(right - tx), HDR_H - 1, UI_BG);
    display_draw_text((int16_t)tx, 6, b, DISPLAY_FONT_TINY, UI_ACC, UI_BG,
                      DISPLAY_DATUM_TL);
}'''
assert old in t
t = t.replace(old, new)
io.open(p, 'w', encoding='utf-8', newline='').write(t)
print('patched')
