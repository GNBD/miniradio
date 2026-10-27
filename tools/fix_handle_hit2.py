# -*- coding: utf-8 -*-
import io

p = 'uiedt/js/editor.js'
t = io.open(p, encoding='utf-8').read()
old = '''    const t = Math.max(3, 9 / zoom);   /* 화면 약 9px, 최소 3 논리 px */'''
new = '''    const t = Math.max(2, 5 / zoom);   /* 화면 약 5px, 최소 2 논리 px */'''
assert old in t
t = t.replace(old, new, 1)
io.open(p, 'w', encoding='utf-8', newline='\n').write(t)
print('ok')
