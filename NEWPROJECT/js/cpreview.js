/*
 * SPDX-License-Identifier: MIT
 * cpreview.js - best-effort preview of C widgets.
 *
 * Full C cannot run in the browser. This translates the *drawing subset* to
 * JS: the body of `void fn(int x,int y,int w,int h)` is executed with
 * display_* shims that draw on the editor canvas.
 *
 * Supported: int arithmetic, variables, if/for/while (C syntax is JS-like),
 * display_draw_text / display_fill_rect / display_draw_rect /
 * display_draw_line / display_fill_round_rect, UI_* colors, DISPLAY_FONT_*.
 * Not supported: pointers, structs, arrays, static state, other APIs.
 */
const CPreview = {
  COLORS: {
    UI_BG: "bg", UI_PANEL: "panel", UI_FG: "fg", UI_MUTED: "muted",
    UI_LINE: "line", UI_ACC: "accent", UI_ACC_HI: "accenth", UI_OK: "ok",
    UI_WARN: "warn", UI_RED: "red", UI_TRACK: "track", UI_HSEL: "hsel",
    UI_GOLD: "warn", UI_HL: "hsel", UI_CELL: "panel",
  },
  FONTS: {
    DISPLAY_FONT_TINY: 8, DISPLAY_FONT_SMALL: 16, DISPLAY_FONT_LARGE: 26,
    DISPLAY_FONT_DIGIT: 26, DISPLAY_FONT_HERO: 26, DISPLAY_FONT_TEXT48: 48,
  },
  cache: {},

  get(mod) {
    const key = mod.id + ":" + mod.fn + ":" + (mod.code || "").length;
    if (this.cache[key] !== undefined) return this.cache[key];
    this.cache[key] = this.compile(mod);
    return this.cache[key];
  },

  /* returns fn(ctx,x,y,w,h,state) or null */
  compile(mod) {
    try {
      let code = String(mod.code || "");
      code = code.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");

      /* protect string literals */
      const strs = [];
      code = code.replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g, (m) => {
        strs.push(m);
        return "__S" + (strs.length - 1) + "__";
      });

      /* function body: first '{' after the signature, balanced */
      const sig = new RegExp("\\b" + mod.fn + "\\s*\\([^)]*\\)\\s*\\{");
      const m = code.match(sig);
      if (!m) return null;
      const start = code.indexOf("{", m.index + m[0].length - 1);
      let depth = 0;
      let end = -1;
      for (let i = start; i < code.length; i++) {
        if (code[i] === "{") depth++;
        else if (code[i] === "}") { depth--; if (depth === 0) { end = i; break; } }
      }
      if (end < 0) return null;
      let body = code.slice(start + 1, end);

      /* drop C types */
      body = body.replace(
        /\b(void|int|char|float|double|bool|const|unsigned|signed|static|register|volatile|uint8_t|uint16_t|uint32_t|int8_t|int16_t|int32_t|size_t)\b/g,
        " ");

      /* constants */
      for (const [k, v] of Object.entries(this.FONTS)) body = body.split(k).join(String(v));
      for (const [k, v] of Object.entries(this.COLORS)) body = body.split(k).join('"' + v + '"');
      body = body.replace(/DISPLAY_DATUM_(TL|TC|TR|ML|MC|MR|BL|BC|BR)/g,
        (mm, d) => '"' + ({ TL: "l", TC: "c", TR: "r" }[d] || "l") + '"');

      /* restore strings */
      body = body.replace(/__S(\d+)__/g, (mm, i) => strs[+i]);

      const fn = new Function("ctx", "x", "y", "w", "h", "s",
        "const T=(px,py,txt,font,fg,bg,dat)=>{const sz=typeof font==='number'?font:8;" +
        "Render.text(ctx,px,py,320-px,14,String(txt==null?'':txt)," +
        "{size:sz>=24?'large':sz>=16?'small':'tiny',color:fg||'fg'," +
        "align:dat==='c'?'c':dat==='r'?'r':'l'});};" +
        "const R=(px,py,pw,ph,col)=>{ctx.fillStyle=Render.color(col||'fg');" +
        "ctx.fillRect(px,py,Math.max(1,pw),Math.max(1,ph));};" +
        "const O=(px,py,pw,ph,col)=>{ctx.strokeStyle=Render.color(col||'line');" +
        "ctx.lineWidth=1;ctx.strokeRect(px+.5,py+.5,Math.max(1,pw)-1,Math.max(1,ph)-1);};" +
        "const L=(x0,y0,x1,y1,col)=>{ctx.strokeStyle=Render.color(col||'line');" +
        "ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x0+.5,y0+.5);ctx.lineTo(x1+.5,y1+.5);ctx.stroke();};" +
        "const RR=(px,py,pw,ph,r,col)=>{ctx.fillStyle=Render.color(col||'panel');" +
        "Render.roundRect(ctx,px,py,Math.max(1,pw),Math.max(1,ph),Math.max(0,r||0));ctx.fill();};" +
        "const display_draw_text=T, display_fill_rect=R, display_draw_rect=O," +
        "display_draw_line=(x0,y0,x1,y1,col)=>L(x0,y0,x1,y1,col)," +
        "display_fill_round_rect=RR;" +
        body);
      return fn;
    } catch (e) {
      return null;
    }
  },
};

/* const 는 window 에 붙지 않으므로 명시적으로 노출 */
window.CPreview = CPreview;

