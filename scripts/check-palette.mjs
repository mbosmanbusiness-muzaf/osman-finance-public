// Uchma-uch tekshiruv: qiymatlarni src/lib/palette.ts va src/index.css DAN o'qiydi (nusxa emas),
// so'ng rang ko'rlik masofalari, kontrast va tokenlar mosligini qayta hisoblaydi.
// Ishlatish: npm run check:palette   (yoki: node scripts/check-palette.mjs)
// Chiqish kodi 0 — hammasi joyida, 1 — muammo bor. Ranglar o'zgartirilgan har safar yuritilsin:
// index.css va palette.ts bir xil ranglarni ikki joyda saqlaydi va ular sezdirmay ajralib ketadi.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
// loyiha ildizi skriptning o'z joylashuvidan olinadi — mutlaq yo'l yozib qo'yilmaydi
const P = fileURLToPath(new URL('..', import.meta.url)).replace(/\/$/, '')

const hexToRgb = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]
const toHex = (rgb) => '#' + rgb.map((c) => Math.max(0, Math.min(255, Math.round(c))).toString(16).padStart(2, '0').toUpperCase()).join('')
const hsl2rgb = (h, s, l) => {
  s /= 100; l /= 100
  const k = (n) => (n + h / 30) % 12
  const a = s * Math.min(l, 1 - l)
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
  return [f(0) * 255, f(8) * 255, f(4) * 255]
}
const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4 }
const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05) }
const toLin = (c) => c.map(lin)
const fromLin = (c) => c.map((v) => 255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055))
const mul = (m, v) => m.map((r) => r[0] * v[0] + r[1] * v[1] + r[2] * v[2])
const RGB2LMS = [[0.31399022, 0.63951294, 0.04649755], [0.15537241, 0.75789446, 0.08670142], [0.01775239, 0.10944209, 0.87256922]]
const LMS2RGB = [[5.47221206, -4.6419601, 0.16963708], [-1.1252419, 2.29317094, -0.1678952], [0.02980165, -0.19318073, 1.16364789]]
const SIM = {
  protanopiya: [[0, 1.05118294, -0.05116099], [0, 1, 0], [0, 0, 1]],
  deyteranopiya: [[1, 0, 0], [0.9513092, 0, 0.04866992], [0, 0, 1]],
  tritanopiya: [[1, 0, 0], [0, 1, 0], [-0.86744736, 1.86727089, 0]],
}
const simulate = (rgb, k) => (k === 'normal' ? rgb : fromLin(mul(LMS2RGB, mul(SIM[k], mul(RGB2LMS, toLin(rgb))))))
const toLab = (rgb) => {
  const [r, g, b] = toLin(rgb)
  let x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047
  let y = 0.2126 * r + 0.7152 * g + 0.0722 * b
  let z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116)
  ;[x, y, z] = [f(x), f(y), f(z)]
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)]
}
const de = ([L1, a1, b1], [L2, a2, b2]) => {
  const rad = Math.PI / 180, deg = 180 / Math.PI
  const C1 = Math.hypot(a1, b1), C2 = Math.hypot(a2, b2), Cb = (C1 + C2) / 2
  const G = 0.5 * (1 - Math.sqrt(Cb ** 7 / (Cb ** 7 + 25 ** 7)))
  const ap1 = (1 + G) * a1, ap2 = (1 + G) * a2
  const Cp1 = Math.hypot(ap1, b1), Cp2 = Math.hypot(ap2, b2)
  const hf = (b, a) => { if (b === 0 && a === 0) return 0; const v = Math.atan2(b, a) * deg; return v < 0 ? v + 360 : v }
  const hp1 = hf(b1, ap1), hp2 = hf(b2, ap2)
  const dL = L2 - L1, dC = Cp2 - Cp1
  let dh = 0
  if (Cp1 * Cp2 !== 0) { dh = hp2 - hp1; if (dh > 180) dh -= 360; else if (dh < -180) dh += 360 }
  const dH = 2 * Math.sqrt(Cp1 * Cp2) * Math.sin((dh * rad) / 2)
  const Lp = (L1 + L2) / 2, Cp = (Cp1 + Cp2) / 2
  let hp = hp1 + hp2
  if (Cp1 * Cp2 !== 0) { if (Math.abs(hp1 - hp2) > 180) hp += hp1 + hp2 < 360 ? 360 : -360; hp /= 2 }
  const T = 1 - 0.17 * Math.cos((hp - 30) * rad) + 0.24 * Math.cos(2 * hp * rad) + 0.32 * Math.cos((3 * hp + 6) * rad) - 0.20 * Math.cos((4 * hp - 63) * rad)
  const Sl = 1 + (0.015 * (Lp - 50) ** 2) / Math.sqrt(20 + (Lp - 50) ** 2)
  const Sc = 1 + 0.045 * Cp, Sh = 1 + 0.015 * Cp * T
  const Rt = -2 * Math.sqrt(Cp ** 7 / (Cp ** 7 + 25 ** 7)) * Math.sin(60 * Math.exp(-(((hp - 275) / 25) ** 2)) * rad)
  return Math.sqrt((dL / Sl) ** 2 + (dC / Sc) ** 2 + (dH / Sh) ** 2 + Rt * (dC / Sc) * (dH / Sh))
}

const src = readFileSync(`${P}/src/lib/palette.ts`, 'utf8')
const css = readFileSync(`${P}/src/index.css`, 'utf8')
let fails = 0
const check = (ok, msg) => { console.log(`  ${ok ? '✓' : '✗'} ${msg}`); if (!ok) fails++ }

// palette.ts dan ikkita tema blokini ajratamiz
const blocks = {}
for (const theme of ['dark', 'light']) {
  const m = src.match(new RegExp(`\\n  ${theme}: \\{([\\s\\S]*?)\\n  \\},`))
  if (!m) { console.log(`✗ palette.ts: ${theme} bloki topilmadi`); process.exit(1) }
  const body = m[1]
  const series = [...body.match(/series: \[([^\]]+)\]/)[1].matchAll(/#[0-9A-Fa-f]{6}/g)].map((x) => x[0])
  const val = (k) => body.match(new RegExp(`\\b${k}: '(#[0-9A-Fa-f]{6})'`))?.[1]
  blocks[theme] = {
    body,
    series, purple: val('purple'), pink: val('pink'), orange: val('orange'), surface: val('surface'), gold: val('gold'),
    actual: val('actual'), plan: val('plan'), prior: val('prior'), forecast: val('forecast'),
  }
}

// index.css: brauzer HSL uchligini chizadi, izohdagi hex esa taxminiy bo'lishi mumkin —
// shuning uchun uchlikdan hisoblaymiz va palette.ts bilan solishtiramiz (drift shu yerdan boshlangan).
const darkCss = css.slice(css.indexOf(':root, .dark {'), css.indexOf('.light {'))
const lightCss = css.slice(css.indexOf('.light {'))
const cssVar = (text, name) => {
  const m = text.match(new RegExp(`--${name}:\\s*([\\d.]+)\\s+([\\d.]+)%\\s+([\\d.]+)%`))
  return m ? toHex(hsl2rgb(+m[1], +m[2], +m[3])) : null
}
const MAP = [['gold', 'gold'], ['positive', 'positive'], ['negative', 'negative'], ['warning', 'warning'],
  ['info', 'info'], ['orange', 'orange'], ['text-muted', 'muted'], ['bg-surface', 'surface'],
  ['bg-elevated', 'elevated'], ['border', 'border'], ['text-primary', 'text'], ['text-secondary', 'textSecondary']]

console.log('\n=== 1. index.css tokenlari == palette.ts qiymatlari ===')
for (const [theme, text] of [['dark', darkCss], ['light', lightCss]]) {
  const val = (k) => blocks[theme].body.match(new RegExp(`\\b${k}: '(#[0-9A-Fa-f]{6})'`))?.[1]
  for (const [cssName, palKey] of MAP) {
    const a = cssVar(text, cssName), b = val(palKey)
    if (!a || !b) { check(false, `${theme}.${palKey}: topilmadi (css ${a}, palette ${b})`); continue }
    const d = de(toLab(hexToRgb(a)), toLab(hexToRgb(b)))
    // HSL uchligi yaxlitlanadi, shuning uchun hex bilan kichik farq bo'lishi tabiiy (ΔE00 < 1 — ko'z ilg'amaydi).
    // Haqiqiy drift — undan kattasi: aynan shunday #EA580C / #C03F0C xatosi paydo bo'lgan edi.
    check(d < 1, `${theme}.${palKey}: css ${a} / palette ${b} (ΔE00 ${d.toFixed(2)})${a.toUpperCase() === b.toUpperCase() ? ' — aynan' : ''}`)
  }
}
for (const theme of ['dark', 'light']) {
  check(blocks[theme].purple.toUpperCase() === blocks[theme].series[3].toUpperCase(), `${theme}: purple == series[3] (${blocks[theme].series[3]})`)
  check(blocks[theme].pink.toUpperCase() === blocks[theme].series[5].toUpperCase(), `${theme}: pink == series[5] (${blocks[theme].series[5]})`)
}

console.log('\n=== 2. Kategoriya shkalasi: rang ko\'rlik (ΔE00, eng yaqin juftlik) ===')
const VIS = ['normal', 'protanopiya', 'deyteranopiya', 'tritanopiya']
for (const theme of ['dark', 'light']) {
  const items = blocks[theme].series.map((h, i) => ({ n: `c${i + 1}`, labs: Object.fromEntries(VIS.map((v) => [v, toLab(simulate(hexToRgb(h), v))])) }))
  console.log(`\n  ${theme}: ${blocks[theme].series.join(', ')}`)
  for (const v of VIS) {
    let min = Infinity, pair = ''
    for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
      const d = de(items[i].labs[v], items[j].labs[v])
      if (d < min) { min = d; pair = `${items[i].n}/${items[j].n}` }
    }
    const need = v === 'tritanopiya' ? 5 : 10
    check(min >= need, `${v.padEnd(14)} ${min.toFixed(1).padStart(5)} (${pair}) — kerak ≥ ${need}`)
  }
}

console.log('\n=== 3. Kontrast: har bir kategoriya rangi fonda ≥ 3:1 ===')
for (const theme of ['dark', 'light']) {
  const surface = hexToRgb(blocks[theme].surface)
  const bad = blocks[theme].series.filter((h) => ratio(hexToRgb(h), surface) < 3)
  check(bad.length === 0, `${theme}: ${blocks[theme].series.map((h) => ratio(hexToRgb(h), surface).toFixed(1)).join(', ')}`)
}

console.log('\n=== 4. Ssenariy ranglari (IBCS): fonda ≥ 3:1 va bir-biridan farqli ===')
for (const theme of ['dark', 'light']) {
  const surface = hexToRgb(blocks[theme].surface)
  for (const k of ['actual', 'plan', 'prior']) {
    const c = ratio(hexToRgb(blocks[theme][k]), surface)
    check(c >= 3, `${theme}: ${k} (${blocks[theme][k]}) fonda ${c.toFixed(2)}:1`)
  }
  const labs = (h) => toLab(hexToRgb(h))
  const d = de(labs(blocks[theme].plan), labs(blocks[theme].prior))
  check(d >= 10, `${theme}: plan va prior farqi ΔE00 ${d.toFixed(1)}`)
}

console.log(`\n${fails === 0 ? 'HAMMASI JOYIDA' : `MUAMMO: ${fails} ta`}`)
process.exit(fails === 0 ? 0 : 1)
