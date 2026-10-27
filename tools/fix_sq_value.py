# -*- coding: utf-8 -*-
"""SQ(스 forCell치) 값 반영: 설정 변경 시 redraw + num_bind 추가."""
import io

# 1) menu.c: SQUELCH 변경 시 s_freq_dirty=true
p = 'main/menu.c'
t = io.open(p, encoding='utf-8').read()
old = '''            s_squelch_muted = false;
            if (s_radio_ok) {
                si4732_set_mute(&s_radio, false);
            }
            mark_change();
            break;
        }
        case RM_BFO:'''
new = '''            s_squelch_muted = false;
            if (s_radio_ok) {
                si4732_set_mute(&s_radio, false);
            }
            s_freq_dirty = true;
            mark_change();
            break;
        }
        case RM_BFO:'''
assert old in t
t = t.replace(old, new, 1)
io.open(p, 'w', encoding='utf-8', newline='').write(t)

# 2) ui_custom.c: num_bind에 SQ 추가 (bar/숫자로 표시 가능)
p = 'main/ui/ui_custom.c'
t = io.open(p, encoding='utf-8').read()
old2 = '''    case UC_B_VOL:  return s->volume;
    default:        return 0;'''
new2 = '''    case UC_B_VOL:  return s->volume;
    case UC_B_SQ: {
        if (!s_squelch_on) {
            return 0;
        }
        int sq = s->mode == RADIO_MODE_FM ? 0
               : (s->mode == RADIO_MODE_AM ? 1 : 2);
        return s_squelch_thr[sq];
    }
    default:        return 0;'''
assert old2 in t
t = t.replace(old2, new2, 1)
io.open(p, 'w', encoding='utf-8', newline='').write(t)
print('ok')
