# -*- coding: utf-8 -*-
"""sleep 카운트를 헤더 마지막 단계로 분리해 중앙 알림 fill에 덮이지 않게."""
import io

p = 'main/ui_core.c'
t = io.open(p, encoding='utf-8').read()

# 1) draw_status_right: sleep 블록 제거, 마지막 cursor 저장
old = '''
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
new = '''
    s_status_cursor = cursor;
}'''
assert old in t
t = t.replace(old, new)

# 2) cursor static + sleep 전용 함수 (draw_header_msg 뒤에 배치)
old2 = '''void draw_header_msg(const ui_state_t *s)
{'''
new2 = '''/* draw_status_right가 남긴 우측 상태 영역의 왼쪽 경계 */
static int s_status_cursor = UI_W - 6;

void draw_header_sleep(void)
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
}

void draw_header_msg(const ui_state_t *s)
{'''
assert old2 in t
t = t.replace(old2, new2)

# 3) draw_header_msg 끝(중앙 알림을 다 그린 뒤)에 sleep 오버레이
old3 = '''        display_fill_rect(46, 0, 124, HDR_H - 1, UI_BG);
        if (msg) {
            display_draw_text(48, 6, msg, DISPLAY_FONT_TINY, col, UI_BG,
                              DISPLAY_DATUM_TL);
        }
    }
}'''
new3 = '''        display_fill_rect(46, 0, 124, HDR_H - 1, UI_BG);
        if (msg) {
            display_draw_text(48, 6, msg, DISPLAY_FONT_TINY, col, UI_BG,
                              DISPLAY_DATUM_TL);
        }
    }
    draw_header_sleep();
}'''
assert old3 in t
t = t.replace(old3, new3)

io.open(p, 'w', encoding='utf-8', newline='').write(t)

# 4) ui.h 선언
p = 'main/ui.h'
t = io.open(p, encoding='utf-8').read()
anchor = 'void draw_header_msg(const ui_state_t *s);'
assert anchor in t
if 'draw_header_sleep' not in t:
    t = t.replace(anchor, anchor + '\nvoid draw_header_sleep(void);')
io.open(p, 'w', encoding='utf-8', newline='').write(t)

# 5) 사이드 리스트(중앙 알림 없음)에서도 헤더 직후 호출
p = 'main/ui_list.c'
t = io.open(p, encoding='utf-8').read()
old4 = '    if (!themed) draw_header_tabs(UI_TAB_RADIO, s);\n'
new4 = '    if (!themed) {\n        draw_header_tabs(UI_TAB_RADIO, s);\n        draw_header_sleep();\n    }\n'
assert old4 in t
t = t.replace(old4, new4)
io.open(p, 'w', encoding='utf-8', newline='').write(t)
print('patched')
