# -*- coding: utf-8 -*-
"""SQ 슬롯 인덱스를 mode_dsp_slot과 일치 (LSB=2, USB=3)."""
import io

p = 'main/ui/ui_custom.c'
t = io.open(p, encoding='utf-8').read()

# num_bind
old1 = '''    case UC_B_SQ: {
        if (!s_squelch_on) {
            return 0;
        }
        int sq = s->mode == RADIO_MODE_FM ? 0
               : (s->mode == RADIO_MODE_AM ? 1 : 2);
        return s_squelch_thr[sq];
    }'''
new1 = '''    case UC_B_SQ: {
        if (!s_squelch_on) {
            return 0;
        }
        int sq = (s->mode == RADIO_MODE_FM) ? 0
               : (s->mode == RADIO_MODE_AM) ? 1
               : (s->mode == RADIO_MODE_LSB) ? 2 : 3;
        return s_squelch_thr[sq];
    }'''
assert old1 in t
t = t.replace(old1, new1, 1)

# str_bind
old2 = '''    case UC_B_SQ: {
        int sq = s->mode == RADIO_MODE_FM ? 0
               : (s->mode == RADIO_MODE_AM ? 1 : 2);
        if (!s_squelch_on) { return "OFF"; }'''
new2 = '''    case UC_B_SQ: {
        int sq = (s->mode == RADIO_MODE_FM) ? 0
               : (s->mode == RADIO_MODE_AM) ? 1
               : (s->mode == RADIO_MODE_LSB) ? 2 : 3;
        if (!s_squelch_on) { return "OFF"; }'''
assert old2 in t
t = t.replace(old2, new2, 1)
io.open(p, 'w', encoding='utf-8', newline='').write(t)
print('ok')
