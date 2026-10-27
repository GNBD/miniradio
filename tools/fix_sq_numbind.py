# -*- coding: utf-8 -*-
import io

p = 'main/ui/ui_custom.c'
t = io.open(p, encoding='utf-8').read()

# 1) num_bind: UC_B_SQ 케이스 추가 (mode_dsp_slot 동일)
old1 = '''    case UC_B_VOL:  return s->volume;
    default:        return 0;'''
new1 = '''    case UC_B_VOL:  return s->volume;
    case UC_B_SQ: {
        if (!s_squelch_on) {
            return 0;
        }
        int sq = (s->mode == RADIO_MODE_FM) ? 0
               : (s->mode == RADIO_MODE_AM) ? 1
               : (s->mode == RADIO_MODE_LSB) ? 2 : 3;
        return s_squelch_thr[sq];
    }
    default:        return 0;'''
assert old1 in t, 'num_bind anchor not found'
t = t.replace(old1, new1, 1)

# 2) str_bind: sq 계산 수정 (LSB=2, USB=3)
old2 = '''    case UC_B_SQ: {
        int sq = s->mode == RADIO_MODE_FM ? 0
               : (s->mode == RADIO_MODE_AM ? 1 : 2);
        if (!s_squelch_on) { return "OFF"; }'''
new2 = '''    case UC_B_SQ: {
        int sq = (s->mode == RADIO_MODE_FM) ? 0
               : (s->mode == RADIO_MODE_AM) ? 1
               : (s->mode == RADIO_MODE_LSB) ? 2 : 3;
        if (!s_squelch_on) { return "OFF"; }'''
assert old2 in t, 'str_bind anchor not found'
t = t.replace(old2, new2, 1)

io.open(p, 'w', encoding='utf-8', newline='').write(t)
print('ok')
