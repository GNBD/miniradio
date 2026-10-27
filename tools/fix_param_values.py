# -*- coding: utf-8 -*-
"""커스텀 UI param grid 값 반영: 설정 변경 시 redraw + AFC 실제 상태."""
import io

# 1) menu.c: 설정 변경 시 s_freq_dirty = true (main loop redraw 트리거)
p = 'main/menu.c'
t = io.open(p, encoding='utf-8').read()
reps = [
    ('        case RM_AGC:\n            s_agc_on = (idx == 0);\n            dsp_apply();\n            mark_change();',
     '        case RM_AGC:\n            s_agc_on = (idx == 0);\n            dsp_apply();\n            s_freq_dirty = true;\n            mark_change();'),
    ('        case RM_AVC:\n            s_avc = (uint8_t)((idx < 0) ? 0 : (idx > 90 ? 90 : idx));\n            dsp_apply();\n            mark_change();',
     '        case RM_AVC:\n            s_avc = (uint8_t)((idx < 0) ? 0 : (idx > 90 ? 90 : idx));\n            dsp_apply();\n            s_freq_dirty = true;\n            mark_change();'),
    ('        case RM_SOFTMUTE:\n            s_softmute = (uint8_t)((idx < 0) ? 0 : (idx > 63 ? 63 : idx));\n            dsp_apply();\n            mark_change();',
     '        case RM_SOFTMUTE:\n            s_softmute = (uint8_t)((idx < 0) ? 0 : (idx > 63 ? 63 : idx));\n            dsp_apply();\n            s_freq_dirty = true;\n            mark_change();'),
    ('        case RM_BFO:\n            if (band_is_ssb(s_ui.mode) && si4732_ssb_patch_size > 0) {\n                s_bfo = idx;\n                if (s_radio_ok) {\n                    si4732_set_bfo(&s_radio, radio_bfo_value());\n                }\n                mark_change();',
     '        case RM_BFO:\n            if (band_is_ssb(s_ui.mode) && si4732_ssb_patch_size > 0) {\n                s_bfo = idx;\n                if (s_radio_ok) {\n                    si4732_set_bfo(&s_radio, radio_bfo_value());\n                }\n                s_freq_dirty = true;\n                mark_change();'),
    ('        case RM_BW:\n            s_bw[slot] = (uint8_t)idx;\n            apply_bw();\n            mark_change();',
     '        case RM_BW:\n            s_bw[slot] = (uint8_t)idx;\n            apply_bw();\n            s_freq_dirty = true;\n            mark_change();'),
    ('        case RM_DEEMPH:\n            s_deemph_75 = (idx == 1);\n            if (s_radio_ok && s_ui.mode == RADIO_MODE_FM) {\n                si4732_set_deemphasis(&s_radio, s_deemph_75);\n            }\n            mark_change();',
     '        case RM_DEEMPH:\n            s_deemph_75 = (idx == 1);\n            if (s_radio_ok && s_ui.mode == RADIO_MODE_FM) {\n                si4732_set_deemphasis(&s_radio, s_deemph_75);\n            }\n            s_freq_dirty = true;\n            mark_change();'),
]
for a, b in reps:
    if a in t:
        t = t.replace(a, b, 1)
io.open(p, 'w', encoding='utf-8', newline='').write(t)

# 2) ui_custom.c: LINE3 AFC 를 실제 rail 상태로
p = 'main/ui/ui_custom.c'
t = io.open(p, encoding='utf-8').read()
old2 = '        snprintf(buf, n, "AFC OK  AVC %u  SQ %s", (unsigned)s_avc,\n                  s_squelch_on ? "ON" : "OFF");'
new2 = '        const char *afc = !s->have_rsq ? "--" : (s->rsq.afc_rail ? "RA" : "OK");\n        snprintf(buf, n, "AFC %s  AVC %u  SQ %s", afc, (unsigned)s_avc,\n                  s_squelch_on ? "ON" : "OFF");'
assert old2 in t
t = t.replace(old2, new2, 1)
io.open(p, 'w', encoding='utf-8', newline='').write(t)
print('ok')
