# -*- coding: utf-8 -*-
"""EIBI/RDS marquee 속도를 추가로 절반 낮춤 (4회 렌더당 1자)."""
import io

p = 'main/ui/ui_custom.c'
t = io.open(p, encoding='utf-8').read()
t = t.replace('if (++eibi_skip[idx] >= 2) {', 'if (++eibi_skip[idx] >= 4) {')
t = t.replace('if (++rds_skip[idx] >= 2) {', 'if (++rds_skip[idx] >= 4) {')
io.open(p, 'w', encoding='utf-8', newline='').write(t)
print('ok')
