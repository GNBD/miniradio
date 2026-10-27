/*
 * SPDX-License-Identifier: MIT
 * code.js - C widget editor tab
 * A module is: { id, name, glyph, fn, code }
 * The rendered function signature is fixed:
 *   void <fn>(int x, int y, int w, int h)
 */
const DEFAULT_CODE = `void vu_render(int x, int y, int w, int h)
{
    display_draw_rect(x, y, w, h, UI_LINE);
    display_draw_text(x + 4, y + 3, "VU", DISPLAY_FONT_TINY,
                      UI_MUTED, UI_BG, DISPLAY_DATUM_TL);
    display_fill_rect(x + 6, y + h - 8, w - 12, 3, UI_TRACK);
    display_fill_rect(x + 6, y + h - 8, (w - 12) / 2, 3, UI_OK);
}`;

const CODE = {
  selIndex: 0,

  list() {
    if (!ED.project.code) ED.project.code = [];
    return ED.project.code;
  },

  ensure() {
    const l = this.list();
    if (!l.length) {
      l.push({ id: "vu", name: "VU", glyph: "VU", fn: "vu_render", code: DEFAULT_CODE });
    }
    return l;
  },

  select(id) {
    const l = this.ensure();
    const i = l.findIndex((m) => m.id === id);
    if (i >= 0) { this.selIndex = i; this.render(); }
  },

  render() {
    const l = this.ensure();
    if (this.selIndex >= l.length) this.selIndex = 0;
    const m = l[this.selIndex];
    document.getElementById("cmName").value = m.name;
    document.getElementById("cmGlyph").value = m.glyph;
    document.getElementById("cmFn").value = m.fn;
    document.getElementById("cmCode").value = m.code;
    buildPalette(MODE);
  },

  save() {
    const l = this.ensure();
    const m = l[this.selIndex];
    m.name = document.getElementById("cmName").value || m.name;
    m.glyph = document.getElementById("cmGlyph").value || m.glyph;
    m.fn = (document.getElementById("cmFn").value || m.fn).replace(/[^A-Za-z0-9_]/g, "_");
    m.code = document.getElementById("cmCode").value;
    ED.dirty = true;
    ED.uiDirty();
    this.render();
  },

  add() {
    const l = this.ensure();
    const n = l.length + 1;
    const fn = "mod" + n + "_render";
    l.push({
      id: "mod" + n, name: "MOD" + n, glyph: "M" + n, fn,
      code: DEFAULT_CODE.replace(/vu_render/g, fn),
    });
    this.selIndex = l.length - 1;
    ED.dirty = true;
    ED.uiDirty();
    this.render();
  },

  del() {
    const l = this.ensure();
    if (l.length <= 1) return;
    l.splice(this.selIndex, 1);
    this.selIndex = 0;
    ED.dirty = true;
    ED.uiDirty();
    this.render();
  },
};
