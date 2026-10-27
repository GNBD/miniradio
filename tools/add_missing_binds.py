# -*- coding: utf-8 -*-
"""커스텀 UI 누락 바인딩 보완: TOAST/SLEEP/STEREO 등."""
import io

p = 'main/ui/ui_custom.c'
t = io.open(p, encoding='utf-8').read()

# str_bind: TOAST 추가 (EIBI 다음)
old = '''    case UC_B_EIBI:
        return (s->station && s->station[0]) ? s->station : "";
    default: return buf;'''
new = '''    case UC_B_EIBI:
        return (s->station && s->station[0]) ? s->station : "";
    case UC_B_TOAST:
        return s_toast[0] ? s_toast : "";
    case UC_B_SLEEP:
        if (!s_sleep_armed || s_sleep_min == 0) {
            return "";
        }
        {
            int32_t remain = (int32_t)(s_sleep_deadline - now_ms());
            if (remain < 0) {
                remain = 0;
            }
            int sec = (int)((remain + 999) / 1000);
            snprintf(buf, n, "SLEEP %d:%02d", sec / 60, sec % 60);
            return buf;
        }
    default: return buf;'''
assert old in t
t = t.replace(old, new, 1)

# num_bind: SLEEP/DECODE_LEVEL은 이미 처리. SLEEP bind가 bar로도 쓰일 수 있도록 num_bind에 SLEEP 추가(이미 있음)
io.open(p, 'w', encoding='utf-8', newline='').write(t)
print('ok')
