# -*- coding: utf-8 -*-
"""EIBI/RDS marquee 속도를 절반으로 낮춤."""
import io

p = 'main/ui/ui_custom.c'
t = io.open(p, encoding='utf-8').read()

# EiBi: ++eibi_off[idx] -> 매 2회에 1회
old1 = '''            fit(eb, sizeof(eb), rot, DISPLAY_FONT_TINY, w->w - 8);
            ++eibi_off[idx];'''
new1 = '''            fit(eb, sizeof(eb), rot, DISPLAY_FONT_TINY, w->w - 8);
            /* 속도 절반: 2회 렌더마다 1자 이동 */
            static int eibi_skip[8];
            if (++eibi_skip[idx] >= 2) {
                eibi_skip[idx] = 0;
                ++eibi_off[idx];
            }'''
assert old1 in t
t = t.replace(old1, new1, 1)

# RDS: ++rds_off[idx] -> 매 2회에 1회
old2 = '''            fit(pr, sizeof(pr), rot, DISPLAY_FONT_TINY, w->w - 8);
            ++rds_off[idx];'''
new2 = '''            fit(pr, sizeof(pr), rot, DISPLAY_FONT_TINY, w->w - 8);
            static int rds_skip[8];
            if (++rds_skip[idx] >= 2) {
                rds_skip[idx] = 0;
                ++rds_off[idx];
            }'''
assert old2 in t
t = t.replace(old2, new2, 1)

io.open(p, 'w', encoding='utf-8', newline='').write(t)
print('ok')
