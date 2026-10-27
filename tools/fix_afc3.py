# -*- coding: utf-8 -*-
import io

p = 'main/ui/ui_custom.c'
t = io.open(p, encoding='utf-8').read()
old = '        snprintf(buf, n, "AFC OK  AVC %u  SQ %s", (unsigned)s_avc,'
new = ('        const char *afc = !s->have_rsq ? "--" : (s->rsq.afc_rail ? "RA" : "OK");\n'
       '        snprintf(buf, n, "AFC %s  AVC %u  SQ %s", afc, (unsigned)s_avc,')
assert old in t, 'not found'
t = t.replace(old, new, 1)
io.open(p, 'w', encoding='utf-8', newline='').write(t)
print('ok')
