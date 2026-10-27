# -*- coding: utf-8 -*-
import io
import re

p = 'main/ui/ui_custom.c'
t = io.open(p, encoding='utf-8').read()
pat = re.compile(r'        snprintf\(buf, n, "AFC OK  AVC %u  SQ %s", \(unsigned\)s_avc,\n                  s_squelch_on \? "ON" : "OFF"\);')
new = ('        const char *afc = !s->have_rsq ? "--" : (s->rsq.afc_rail ? "RA" : "OK");\n'
       '        snprintf(buf, n, "AFC %s  AVC %u  SQ %s", afc, (unsigned)s_avc,\n'
       '                  s_squelch_on ? "ON" : "OFF");')
t2, n = pat.subn(new, t, count=1)
assert n == 1, 'no match'
io.open(p, 'w', encoding='utf-8', newline='').write(t2)
print('ok')
