/**
 * Strickschrift-Symbole (angelehnt an die gängigen Standard-Symbole des Craft Yarn Council)
 * inklusive Zeichenfunktionen, Bedeutung auf Hin- und Rückreihe und Texten für die Anleitung.
 *
 * WICHTIG: Die numerischen Codes werden in gespeicherten Mustern verwendet und dürfen
 * niemals geändert oder neu vergeben werden.
 */

export type Lang = 'de' | 'en';

export type ActionKey =
  | 'k'
  | 'p'
  | 'yo'
  | 'k2tog'
  | 'ssk'
  | 'k3tog'
  | 'sssk'
  | 'cdd'
  | 'p2tog'
  | 'ssp'
  | 'p3tog'
  | 'sssp'
  | 'cddp'
  | 'm1l'
  | 'm1r'
  | 'm1lp'
  | 'm1rp'
  | 'kfb'
  | 'pfb'
  | 'sl'
  | 'ktbl'
  | 'ptbl'
  | 'mb'
  | 'bo'
  | 'none'
  | 'c11rc'
  | 'c11lc'
  | 'c22rc'
  | 'c22lc'
  | 'c33rc'
  | 'c33lc';

interface ActionText {
  /** Abkürzung für eine Masche */
  abbr: string;
  /** Ausführliche Erklärung für die Legende */
  long: string;
  /** Formatierung für n aufeinanderfolgende Maschen dieser Art */
  count?: (n: number) => string;
}

const times = {
  en: (abbr: string) => (n: number) => (n === 1 ? abbr : `${abbr} ${n} times`),
  de: (abbr: string) => (n: number) => (n === 1 ? abbr : `${n}× ${abbr}`),
};

export const ACTIONS: Record<ActionKey, Record<Lang, ActionText>> = {
  k: {
    en: { abbr: 'k1', long: 'Knit', count: (n) => `k${n}` },
    de: { abbr: '1 re', long: 'Rechte Masche', count: (n) => `${n} re` },
  },
  p: {
    en: { abbr: 'p1', long: 'Purl', count: (n) => `p${n}` },
    de: { abbr: '1 li', long: 'Linke Masche', count: (n) => `${n} li` },
  },
  yo: {
    en: { abbr: 'yo', long: 'Yarn over' },
    de: { abbr: '1 U', long: 'Umschlag', count: (n) => `${n} U` },
  },
  k2tog: {
    en: { abbr: 'k2tog', long: 'Knit 2 together (right-leaning decrease)' },
    de: { abbr: '2 re zus.', long: '2 Maschen rechts zusammenstricken (nach rechts geneigt)' },
  },
  ssk: {
    en: { abbr: 'ssk', long: 'Slip, slip, knit 2 slipped stitches together (left-leaning decrease)' },
    de: { abbr: '2 re überz. zus.', long: '2 Maschen rechts überzogen zusammenstricken (nach links geneigt)' },
  },
  k3tog: {
    en: { abbr: 'k3tog', long: 'Knit 3 together (right-leaning double decrease)' },
    de: { abbr: '3 re zus.', long: '3 Maschen rechts zusammenstricken' },
  },
  sssk: {
    en: { abbr: 'sssk', long: 'Slip 3 stitches knitwise, knit them together (left-leaning double decrease)' },
    de: { abbr: '3 re überz. zus.', long: '3 Maschen rechts überzogen zusammenstricken' },
  },
  cdd: {
    en: { abbr: 'cdd', long: 'Centered double decrease: slip 2 together knitwise, k1, pass slipped stitches over' },
    de: { abbr: 'dopp. Überzug', long: 'Doppelter Überzug: 2 M zusammen wie zum Rechtsstricken abheben, 1 M re, die abgehobenen M überziehen' },
  },
  p2tog: {
    en: { abbr: 'p2tog', long: 'Purl 2 together' },
    de: { abbr: '2 li zus.', long: '2 Maschen links zusammenstricken' },
  },
  ssp: {
    en: { abbr: 'ssp', long: 'Slip, slip, purl 2 together through the back loops' },
    de: { abbr: '2 li verschr. zus.', long: '2 Maschen links verschränkt zusammenstricken' },
  },
  p3tog: {
    en: { abbr: 'p3tog', long: 'Purl 3 together' },
    de: { abbr: '3 li zus.', long: '3 Maschen links zusammenstricken' },
  },
  sssp: {
    en: { abbr: 'sssp', long: 'Slip 3, purl 3 together through the back loops' },
    de: { abbr: '3 li verschr. zus.', long: '3 Maschen links verschränkt zusammenstricken' },
  },
  cddp: {
    en: { abbr: 'cddp', long: 'Centered double decrease worked from the wrong side' },
    de: { abbr: 'dopp. Überzug li', long: 'Doppelter Überzug von der Rückseite gearbeitet' },
  },
  m1l: {
    en: { abbr: 'M1L', long: 'Make 1 left: lift the bar between stitches from front to back and knit it through the back loop' },
    de: { abbr: '1 M zun. (li-geneigt)', long: '1 Masche aus dem Querfaden zunehmen, nach links geneigt' },
  },
  m1r: {
    en: { abbr: 'M1R', long: 'Make 1 right: lift the bar between stitches from back to front and knit it through the front loop' },
    de: { abbr: '1 M zun. (re-geneigt)', long: '1 Masche aus dem Querfaden zunehmen, nach rechts geneigt' },
  },
  m1lp: {
    en: { abbr: 'M1LP', long: 'Make 1 left purlwise' },
    de: { abbr: '1 M li zun. (li-geneigt)', long: '1 Masche links aus dem Querfaden zunehmen, nach links geneigt' },
  },
  m1rp: {
    en: { abbr: 'M1RP', long: 'Make 1 right purlwise' },
    de: { abbr: '1 M li zun. (re-geneigt)', long: '1 Masche links aus dem Querfaden zunehmen, nach rechts geneigt' },
  },
  kfb: {
    en: { abbr: 'kfb', long: 'Knit into the front and back of the stitch (1 increase)' },
    de: { abbr: '1 M re verdoppeln', long: 'Aus 1 Masche 2 Maschen herausstricken (1 re, 1 re verschränkt)' },
  },
  pfb: {
    en: { abbr: 'pfb', long: 'Purl into the front and back of the stitch (1 increase)' },
    de: { abbr: '1 M li verdoppeln', long: 'Aus 1 Masche 2 Maschen links herausstricken' },
  },
  sl: {
    en: { abbr: 'sl1', long: 'Slip 1 stitch purlwise', count: (n) => `sl${n}` },
    de: { abbr: '1 M abh.', long: '1 Masche wie zum Linksstricken abheben', count: (n) => `${n} M abh.` },
  },
  ktbl: {
    en: { abbr: 'k1tbl', long: 'Knit through the back loop (twisted stitch)', count: (n) => `k${n}tbl` },
    de: { abbr: '1 re verschr.', long: '1 Masche rechts verschränkt', count: (n) => `${n} re verschr.` },
  },
  ptbl: {
    en: { abbr: 'p1tbl', long: 'Purl through the back loop', count: (n) => `p${n}tbl` },
    de: { abbr: '1 li verschr.', long: '1 Masche links verschränkt', count: (n) => `${n} li verschr.` },
  },
  mb: {
    en: { abbr: 'MB', long: 'Make bobble' },
    de: { abbr: 'Noppe', long: 'Noppe stricken', count: (n) => (n === 1 ? 'Noppe' : `${n} Noppen`) },
  },
  bo: {
    en: { abbr: 'BO1', long: 'Bind off 1 stitch', count: (n) => `BO${n}` },
    de: { abbr: '1 M abk.', long: '1 Masche abketten', count: (n) => `${n} M abk.` },
  },
  none: {
    en: { abbr: '', long: 'No stitch (placeholder, skip this square)' },
    de: { abbr: '', long: 'Keine Masche (Platzhalter, Kästchen überspringen)' },
  },
  c11rc: {
    en: { abbr: '1/1 RC', long: '1/1 right cross: slip 1 st to cable needle, hold in back, k1, k1 from cable needle' },
    de: { abbr: '2 M n. re kreuzen', long: '1 M auf die Zopfnadel hinter die Arbeit legen, 1 M re, dann die M der Zopfnadel re stricken' },
  },
  c11lc: {
    en: { abbr: '1/1 LC', long: '1/1 left cross: slip 1 st to cable needle, hold in front, k1, k1 from cable needle' },
    de: { abbr: '2 M n. li kreuzen', long: '1 M auf die Zopfnadel vor die Arbeit legen, 1 M re, dann die M der Zopfnadel re stricken' },
  },
  c22rc: {
    en: { abbr: '2/2 RC', long: '2/2 right cross: slip 2 sts to cable needle, hold in back, k2, k2 from cable needle' },
    de: { abbr: '4 M n. re kreuzen', long: '2 M auf die Zopfnadel hinter die Arbeit legen, 2 M re, dann die 2 M der Zopfnadel re stricken' },
  },
  c22lc: {
    en: { abbr: '2/2 LC', long: '2/2 left cross: slip 2 sts to cable needle, hold in front, k2, k2 from cable needle' },
    de: { abbr: '4 M n. li kreuzen', long: '2 M auf die Zopfnadel vor die Arbeit legen, 2 M re, dann die 2 M der Zopfnadel re stricken' },
  },
  c33rc: {
    en: { abbr: '3/3 RC', long: '3/3 right cross: slip 3 sts to cable needle, hold in back, k3, k3 from cable needle' },
    de: { abbr: '6 M n. re kreuzen', long: '3 M auf die Zopfnadel hinter die Arbeit legen, 3 M re, dann die 3 M der Zopfnadel re stricken' },
  },
  c33lc: {
    en: { abbr: '3/3 LC', long: '3/3 left cross: slip 3 sts to cable needle, hold in front, k3, k3 from cable needle' },
    de: { abbr: '6 M n. li kreuzen', long: '3 M auf die Zopfnadel vor die Arbeit legen, 3 M re, dann die 3 M der Zopfnadel re stricken' },
  },
};

export function actionCount(action: ActionKey, n: number, lang: Lang): string {
  const a = ACTIONS[action][lang];
  if (a.count) return a.count(n);
  return times[lang](a.abbr)(n);
}

export type SymbolCategory = 'basic' | 'decrease' | 'increase' | 'special' | 'cable';

/** Zeichenkontext für ein Symbol. (x, y, w, h) umfasst alle Kästchen eines mehrteiligen Symbols. */
export interface DrawContext {
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
  x: number;
  y: number;
  w: number;
  h: number;
  cellW: number;
  cellH: number;
  ink: string;
  /** Hintergrundfarbe des Kästchens (für Lücken bei Zöpfen) */
  bg: string;
  lineWidth: number;
}

export interface StitchSymbol {
  key: string;
  /** Code des ersten (linken) Teils; weitere Teile haben code + 1, code + 2 … */
  code: number;
  /** Anzahl Kästchen, die das Symbol belegt */
  width: number;
  category: SymbolCategory;
  /** Schlüssel des horizontal gespiegelten Symbols */
  mirror: string;
  rs: ActionKey;
  ws: ActionKey;
  /** Maschen, die von der linken Nadel verbraucht werden */
  consumes: number;
  /** Maschen, die auf der rechten Nadel entstehen */
  produces: number;
  noStitch?: boolean;
  draw: (d: DrawContext) => void;
}

type Pt = [number, number];

function pt(d: DrawContext, [u, v]: Pt): Pt {
  return [d.x + u * d.w, d.y + v * d.h];
}

function stroke(d: DrawContext, ...paths: Pt[][]): void {
  const { ctx } = d;
  ctx.strokeStyle = d.ink;
  ctx.lineWidth = d.lineWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  for (const path of paths) {
    path.forEach((p, i) => {
      const [x, y] = pt(d, p);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
  }
  ctx.stroke();
}

function dot(d: DrawContext, u: number, v: number, r: number): void {
  const { ctx } = d;
  const [x, y] = pt(d, [u, v]);
  ctx.fillStyle = d.ink;
  ctx.beginPath();
  ctx.arc(x, y, Math.max(0.8, r * Math.min(d.cellW, d.cellH)), 0, Math.PI * 2);
  ctx.fill();
}

function ring(d: DrawContext, u: number, v: number, rx: number, ry: number): void {
  const { ctx } = d;
  const [x, y] = pt(d, [u, v]);
  ctx.strokeStyle = d.ink;
  ctx.lineWidth = d.lineWidth;
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(1, rx * d.cellW), Math.max(1, ry * d.cellH), 0, 0, Math.PI * 2);
  ctx.stroke();
}

function circle(d: DrawContext, u: number, v: number, r: number): void {
  const { ctx } = d;
  const [x, y] = pt(d, [u, v]);
  ctx.strokeStyle = d.ink;
  ctx.lineWidth = d.lineWidth;
  ctx.beginPath();
  ctx.arc(x, y, Math.max(1, r * Math.min(d.cellW, d.cellH)), 0, Math.PI * 2);
  ctx.stroke();
}

function twistedLoop(d: DrawContext): void {
  // Gekreuzte Schlinge (verschränkte Masche)
  const { ctx } = d;
  const m = Math.min(d.w, d.h);
  const cx = d.x + d.w / 2;
  const top = d.y + d.h * 0.16;
  const r = m * 0.17;
  ctx.strokeStyle = d.ink;
  ctx.lineWidth = d.lineWidth;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(d.x + d.w * 0.28, d.y + d.h * 0.86);
  ctx.bezierCurveTo(cx + r * 0.2, d.y + d.h * 0.6, cx + r * 1.6, top + r * 1.2, cx, top);
  ctx.bezierCurveTo(cx - r * 1.6, top + r * 1.2, cx - r * 0.2, d.y + d.h * 0.6, d.x + d.w * 0.72, d.y + d.h * 0.86);
  ctx.stroke();
}

function star(d: DrawContext): void {
  const { ctx } = d;
  const cx = d.x + d.w / 2;
  const cy = d.y + d.h / 2 + d.h * 0.02;
  const m = Math.min(d.cellW, d.cellH);
  const ro = m * 0.36;
  const ri = m * 0.15;
  ctx.fillStyle = d.ink;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? ro : ri;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
}

function noStitch(d: DrawContext): void {
  const { ctx } = d;
  ctx.fillStyle = '#b9b3ac';
  ctx.fillRect(d.x, d.y, d.w, d.h);
  ctx.save();
  ctx.beginPath();
  ctx.rect(d.x, d.y, d.w, d.h);
  ctx.clip();
  ctx.strokeStyle = 'rgba(80, 72, 66, 0.35)';
  ctx.lineWidth = Math.max(0.6, d.lineWidth * 0.6);
  ctx.beginPath();
  const step = Math.max(3, Math.min(d.w, d.h) / 3);
  for (let s = -d.h; s < d.w + d.h; s += step) {
    ctx.moveTo(d.x + s, d.y + d.h);
    ctx.lineTo(d.x + s + d.h, d.y);
  }
  ctx.stroke();
  ctx.restore();
}

/**
 * Zopf über n + n Maschen. right = true: Rechtskreuzung (vordere Maschen laufen nach rechts oben).
 * Die vorderen Stränge werden durchgehend, die hinteren mit Lücke gezeichnet.
 */
function cable(d: DrawContext, n: number, right: boolean): void {
  const { ctx } = d;
  const total = n * 2;
  const unit = 1 / total;
  const yb = 0.88;
  const yt = 0.12;
  // Linien je Strang: Startpositionen unten (in Box-Einheiten)
  const leftStrand = Array.from({ length: n }, (_, i) => (i + 0.5) * unit);
  const rightStrand = Array.from({ length: n }, (_, i) => (n + i + 0.5) * unit);
  // Vorderer Strang: bei Rechtskreuzung der linke (wandert nach rechts)
  const front = right
    ? leftStrand.map((u) => [[u, yb], [u + n * unit, yt]] as Pt[])
    : rightStrand.map((u) => [[u, yb], [u - n * unit, yt]] as Pt[]);
  const back = right
    ? rightStrand.map((u) => [[u, yb], [u - n * unit, yt]] as Pt[])
    : leftStrand.map((u) => [[u, yb], [u + n * unit, yt]] as Pt[]);

  // Rahmen oben und unten (feiner als die Stränge)
  stroke({ ...d, lineWidth: Math.max(1, d.lineWidth * 0.6) }, [[0.02 * unit, 0.05], [1 - 0.02 * unit, 0.05]], [[0.02 * unit, 0.95], [1 - 0.02 * unit, 0.95]]);
  stroke(d, ...back);
  // Lücke: Band des vorderen Strangs mit Hintergrundfarbe füllen
  const first = front[0];
  const last = front[front.length - 1];
  const pad = unit * 0.42;
  const band: Pt[] = right
    ? [
        [first[0][0] - pad, first[0][1]],
        [last[0][0] + pad, last[0][1]],
        [last[1][0] + pad, last[1][1]],
        [first[1][0] - pad, first[1][1]],
      ]
    : [
        [first[0][0] + pad, first[0][1]],
        [last[0][0] - pad, last[0][1]],
        [last[1][0] - pad, last[1][1]],
        [first[1][0] + pad, first[1][1]],
      ];
  ctx.fillStyle = d.bg;
  ctx.beginPath();
  band.forEach((p, i) => {
    const [x, y] = pt(d, p);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.closePath();
  ctx.fill();
  stroke(d, ...front);
}

export const SYMBOLS: StitchSymbol[] = [
  {
    key: 'knit', code: 0, width: 1, category: 'basic', mirror: 'knit', rs: 'k', ws: 'p', consumes: 1, produces: 1,
    draw: () => {},
  },
  {
    key: 'purl', code: 1, width: 1, category: 'basic', mirror: 'purl', rs: 'p', ws: 'k', consumes: 1, produces: 1,
    draw: (d) => dot(d, 0.5, 0.5, 0.15),
  },
  {
    key: 'yo', code: 2, width: 1, category: 'increase', mirror: 'yo', rs: 'yo', ws: 'yo', consumes: 0, produces: 1,
    draw: (d) => circle(d, 0.5, 0.5, 0.27),
  },
  {
    key: 'k2tog', code: 3, width: 1, category: 'decrease', mirror: 'ssk', rs: 'k2tog', ws: 'p2tog', consumes: 2, produces: 1,
    draw: (d) => stroke(d, [[0.2, 0.82], [0.8, 0.18]]),
  },
  {
    key: 'ssk', code: 4, width: 1, category: 'decrease', mirror: 'k2tog', rs: 'ssk', ws: 'ssp', consumes: 2, produces: 1,
    draw: (d) => stroke(d, [[0.2, 0.18], [0.8, 0.82]]),
  },
  {
    key: 'k3tog', code: 5, width: 1, category: 'decrease', mirror: 'sssk', rs: 'k3tog', ws: 'p3tog', consumes: 3, produces: 1,
    draw: (d) => stroke(d, [[0.18, 0.84], [0.82, 0.16]], [[0.52, 0.84], [0.52, 0.48]]),
  },
  {
    key: 'sssk', code: 6, width: 1, category: 'decrease', mirror: 'k3tog', rs: 'sssk', ws: 'sssp', consumes: 3, produces: 1,
    draw: (d) => stroke(d, [[0.18, 0.16], [0.82, 0.84]], [[0.48, 0.84], [0.48, 0.48]]),
  },
  {
    key: 'cdd', code: 7, width: 1, category: 'decrease', mirror: 'cdd', rs: 'cdd', ws: 'cddp', consumes: 3, produces: 1,
    draw: (d) => stroke(d, [[0.18, 0.84], [0.5, 0.16], [0.82, 0.84]], [[0.5, 0.84], [0.5, 0.16]]),
  },
  {
    key: 'p2tog', code: 8, width: 1, category: 'decrease', mirror: 'ssp', rs: 'p2tog', ws: 'k2tog', consumes: 2, produces: 1,
    draw: (d) => {
      stroke(d, [[0.2, 0.82], [0.8, 0.18]]);
      dot(d, 0.3, 0.3, 0.1);
    },
  },
  {
    key: 'ssp', code: 9, width: 1, category: 'decrease', mirror: 'p2tog', rs: 'ssp', ws: 'ssk', consumes: 2, produces: 1,
    draw: (d) => {
      stroke(d, [[0.2, 0.18], [0.8, 0.82]]);
      dot(d, 0.7, 0.3, 0.1);
    },
  },
  {
    key: 'm1l', code: 10, width: 1, category: 'increase', mirror: 'm1r', rs: 'm1l', ws: 'm1lp', consumes: 0, produces: 1,
    draw: (d) => stroke(d, [[0.56, 0.86], [0.56, 0.46], [0.24, 0.16]]),
  },
  {
    key: 'm1r', code: 11, width: 1, category: 'increase', mirror: 'm1l', rs: 'm1r', ws: 'm1rp', consumes: 0, produces: 1,
    draw: (d) => stroke(d, [[0.44, 0.86], [0.44, 0.46], [0.76, 0.16]]),
  },
  {
    key: 'kfb', code: 12, width: 1, category: 'increase', mirror: 'kfb', rs: 'kfb', ws: 'pfb', consumes: 1, produces: 2,
    draw: (d) => stroke(d, [[0.5, 0.86], [0.5, 0.5]], [[0.2, 0.16], [0.5, 0.5], [0.8, 0.16]]),
  },
  {
    key: 'slip', code: 13, width: 1, category: 'special', mirror: 'slip', rs: 'sl', ws: 'sl', consumes: 1, produces: 1,
    draw: (d) => stroke(d, [[0.22, 0.18], [0.5, 0.84], [0.78, 0.18]]),
  },
  {
    key: 'ktbl', code: 14, width: 1, category: 'special', mirror: 'ktbl', rs: 'ktbl', ws: 'ptbl', consumes: 1, produces: 1,
    draw: (d) => twistedLoop(d),
  },
  {
    key: 'ptbl', code: 15, width: 1, category: 'special', mirror: 'ptbl', rs: 'ptbl', ws: 'ktbl', consumes: 1, produces: 1,
    draw: (d) => {
      twistedLoop(d);
      stroke(d, [[0.2, 0.93], [0.8, 0.93]]);
    },
  },
  {
    key: 'bobble', code: 16, width: 1, category: 'special', mirror: 'bobble', rs: 'mb', ws: 'mb', consumes: 1, produces: 1,
    draw: (d) => star(d),
  },
  {
    key: 'bindoff', code: 17, width: 1, category: 'special', mirror: 'bindoff', rs: 'bo', ws: 'bo', consumes: 1, produces: 0,
    draw: (d) => ring(d, 0.5, 0.5, 0.32, 0.15),
  },
  {
    key: 'nostitch', code: 18, width: 1, category: 'special', mirror: 'nostitch', rs: 'none', ws: 'none', consumes: 0, produces: 0,
    noStitch: true,
    draw: (d) => noStitch(d),
  },
  {
    key: 'c11rc', code: 32, width: 2, category: 'cable', mirror: 'c11lc', rs: 'c11rc', ws: 'c11rc', consumes: 2, produces: 2,
    draw: (d) => cable(d, 1, true),
  },
  {
    key: 'c11lc', code: 34, width: 2, category: 'cable', mirror: 'c11rc', rs: 'c11lc', ws: 'c11lc', consumes: 2, produces: 2,
    draw: (d) => cable(d, 1, false),
  },
  {
    key: 'c22rc', code: 36, width: 4, category: 'cable', mirror: 'c22lc', rs: 'c22rc', ws: 'c22rc', consumes: 4, produces: 4,
    draw: (d) => cable(d, 2, true),
  },
  {
    key: 'c22lc', code: 40, width: 4, category: 'cable', mirror: 'c22rc', rs: 'c22lc', ws: 'c22lc', consumes: 4, produces: 4,
    draw: (d) => cable(d, 2, false),
  },
  {
    key: 'c33rc', code: 44, width: 6, category: 'cable', mirror: 'c33lc', rs: 'c33rc', ws: 'c33rc', consumes: 6, produces: 6,
    draw: (d) => cable(d, 3, true),
  },
  {
    key: 'c33lc', code: 50, width: 6, category: 'cable', mirror: 'c33rc', rs: 'c33lc', ws: 'c33lc', consumes: 6, produces: 6,
    draw: (d) => cable(d, 3, false),
  },
];

export interface SymbolPart {
  symbol: StitchSymbol;
  part: number;
}

const BY_KEY = new Map<string, StitchSymbol>();
const BY_CODE: (SymbolPart | undefined)[] = new Array(256);
for (const s of SYMBOLS) {
  BY_KEY.set(s.key, s);
  for (let p = 0; p < s.width; p++) {
    if (BY_CODE[s.code + p]) throw new Error(`Doppelter Symbolcode ${s.code + p}`);
    BY_CODE[s.code + p] = { symbol: s, part: p };
  }
}

export const KNIT = BY_KEY.get('knit')!;

export function symbolByKey(key: string): StitchSymbol | undefined {
  return BY_KEY.get(key);
}

/** Liefert Symbol und Teilindex für einen gespeicherten Code (unbekannte Codes → rechte Masche). */
export function symbolPart(code: number): SymbolPart {
  return BY_CODE[code] ?? { symbol: KNIT, part: 0 };
}

export function isKnownCode(code: number): boolean {
  return BY_CODE[code] !== undefined;
}

/** Code des gespiegelten Symbolteils (für horizontales Spiegeln). */
export function mirrorCode(code: number): number {
  const { symbol, part } = symbolPart(code);
  const m = BY_KEY.get(symbol.mirror) ?? symbol;
  if (m.width !== symbol.width) return code;
  return m.code + (symbol.width - 1 - part);
}

export const SYMBOL_NAMES: Record<string, Record<Lang, string>> = {
  knit: { de: 'Rechte Masche', en: 'Knit' },
  purl: { de: 'Linke Masche', en: 'Purl' },
  yo: { de: 'Umschlag', en: 'Yarn over' },
  k2tog: { de: '2 re zusammen', en: 'K2tog' },
  ssk: { de: '2 re überzogen zus.', en: 'SSK' },
  k3tog: { de: '3 re zusammen', en: 'K3tog' },
  sssk: { de: '3 re überzogen zus.', en: 'SSSK' },
  cdd: { de: 'Doppelter Überzug', en: 'Centered double dec.' },
  p2tog: { de: '2 li zusammen', en: 'P2tog' },
  ssp: { de: '2 li verschränkt zus.', en: 'SSP' },
  m1l: { de: 'Zunahme links geneigt', en: 'M1L' },
  m1r: { de: 'Zunahme rechts geneigt', en: 'M1R' },
  kfb: { de: '1 M verdoppeln', en: 'KFB' },
  slip: { de: 'Masche abheben', en: 'Slip' },
  ktbl: { de: 'Rechts verschränkt', en: 'Knit tbl' },
  ptbl: { de: 'Links verschränkt', en: 'Purl tbl' },
  bobble: { de: 'Noppe', en: 'Bobble' },
  bindoff: { de: 'Abketten', en: 'Bind off' },
  nostitch: { de: 'Keine Masche', en: 'No stitch' },
  c11rc: { de: 'Zopf 1/1 nach rechts', en: '1/1 right cross' },
  c11lc: { de: 'Zopf 1/1 nach links', en: '1/1 left cross' },
  c22rc: { de: 'Zopf 2/2 nach rechts', en: '2/2 right cross' },
  c22lc: { de: 'Zopf 2/2 nach links', en: '2/2 left cross' },
  c33rc: { de: 'Zopf 3/3 nach rechts', en: '3/3 right cross' },
  c33lc: { de: 'Zopf 3/3 nach links', en: '3/3 left cross' },
};

export function symbolName(s: StitchSymbol, lang: Lang): string {
  return SYMBOL_NAMES[s.key]?.[lang] ?? s.key;
}

export const SYMBOL_CATEGORIES: { key: SymbolCategory; de: string; en: string }[] = [
  { key: 'basic', de: 'Grundmaschen', en: 'Basic' },
  { key: 'decrease', de: 'Abnahmen', en: 'Decreases' },
  { key: 'increase', de: 'Zunahmen', en: 'Increases' },
  { key: 'special', de: 'Besondere Maschen', en: 'Special' },
  { key: 'cable', de: 'Zöpfe', en: 'Cables' },
];

/**
 * Zeichnet einen Symbolteil in ein einzelnes Kästchen.
 * Mehrteilige Symbole werden komplett gezeichnet und auf das Kästchen zugeschnitten.
 */
export function drawSymbolPart(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  code: number,
  x: number,
  y: number,
  cellW: number,
  cellH: number,
  ink: string,
  bg: string,
): void {
  if (code === 0) return;
  const { symbol, part } = symbolPart(code);
  const lineWidth = Math.max(1, Math.min(cellW, cellH) * 0.09);
  if (symbol.width === 1) {
    symbol.draw({ ctx, x, y, w: cellW, h: cellH, cellW, cellH, ink, bg, lineWidth });
    return;
  }
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, cellW, cellH);
  ctx.clip();
  symbol.draw({ ctx, x: x - part * cellW, y, w: cellW * symbol.width, h: cellH, cellW, cellH, ink, bg, lineWidth });
  ctx.restore();
}
