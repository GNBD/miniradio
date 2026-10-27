# -*- coding: utf-8 -*-
"""Sleep 남은 시간을 상단바 중앙에 표시하는 패치."""
import io

# 1) ui_int.h: sleep 상태 extern
p = 'main/ui_int.h'
t = io.open(p, encoding='utf-8').read()
anchor = 'extern uint16_t s_quick_mask;\n'
assert anchor in t
if 's_sleep_min' not in t:
    t = t.replace(anchor, anchor +
                  'extern uint16_t s_sleep_min;\n'
                  'extern uint32_t s_sleep_deadline;\n'
                  'extern bool     s_sleep_armed;\n')
io.open(p, 'w', encoding='utf-8', newline='').write(t)

# 2) ui_core.c: draw_header_msg에 SLEEP m:ss
p = 'main/ui_core.c'
t = io.open(p, encoding='utf-8').read()
old = (
    '    const char *msg = NULL;\n'
    '    uint16_t col = UI_MUTED;\n'
    '    char seek_buf[20];\n'
    '    if (!s->radio_ok) {\n'
    '        msg = "ERR";\n'
    '        col = UI_WARN;\n'
    '    } else if (s->seeking) {'
)
new = (
    '    const char *msg = NULL;\n'
    '    uint16_t col = UI_MUTED;\n'
    '    char seek_buf[20];\n'
    '    char sleep_buf[20];\n'
    '    if (!s->radio_ok) {\n'
    '        msg = "ERR";\n'
    '        col = UI_WARN;\n'
    '    } else if (s_sleep_min > 0 && s_sleep_armed) {\n'
    '        int32_t remain = (int32_t)(s_sleep_deadline - now_ms());\n'
    '        if (remain < 0) {\n'
    '            remain = 0;\n'
    '        }\n'
    '        int sec = (int)((remain + 999) / 1000);\n'
    '        if (sec > 99 * 60 + 59) {\n'
    '            sec = 99 * 60 + 59;\n'
    '        }\n'
    '        snprintf(sleep_buf, sizeof(sleep_buf), "SLEEP %d:%02d",\n'
    '                 sec / 60, sec % 60);\n'
    '        msg = sleep_buf;\n'
    '        col = UI_ACC;\n'
    '    } else if (s->seeking) {'
)
assert old in t
t = t.replace(old, new)
io.open(p, 'w', encoding='utf-8', newline='').write(t)

# 3) main.c: 매초 헤더 갱신
p = 'main/main.c'
t = io.open(p, encoding='utf-8').read()
old = '        seek_poll(now);\n        ats_poll(now);'
new = (
    '        if ((s_hmi == HMI_TUNE || s_hmi == HMI_SEEK) &&\n'
    '            s_sleep_min > 0 && s_sleep_armed) {\n'
    '            static uint32_t sleep_hdr_ms;\n'
    '            if ((now - sleep_hdr_ms) >= 1000u) {\n'
    '                sleep_hdr_ms = now;\n'
    '                draw_header_msg(&s_ui);\n'
    '            }\n'
    '        }\n'
    '        seek_poll(now);\n'
    '        ats_poll(now);'
)
assert old in t
t = t.replace(old, new)
io.open(p, 'w', encoding='utf-8', newline='').write(t)
print('patched')
