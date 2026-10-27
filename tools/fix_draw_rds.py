# -*- coding: utf-8 -*-
import io

p = 'main/ui/ui_custom.c'
lines = io.open(p, encoding='utf-8').read().split('\n')

# 478..496 (1-based) = RDS 블록이 함수 밖에 남은 부분
block = lines[477:496]
# 476 is the function closing brace; remove it and re-add after block
# lines[475] (1-based 476) is '}'
assert lines[475].strip() == '}', lines[475]
# remove lines 478..496 (indices 477..496)
out = lines[:477] + lines[496:]
# insert block before the now-last closing brace of draw_rds
# find the position: out[476] is '}' (function end) after removal
assert out[476].strip() == '}', out[476]
out = out[:476] + block + ['}'] + out[477:]
io.open(p, 'w', encoding='utf-8', newline='').write('\n'.join(out))
print('fixed')
