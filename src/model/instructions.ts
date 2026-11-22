import type { ChartGrid, ChartSettings } from './types';
import { colorLetter } from './color';
import { actionCount, type ActionKey, type Lang, symbolPart } from './stitches';

export type RowSide = 'rs' | 'ws' | 'round';

/** Eine Einheit in einer Reihe: eine Masche oder ein vollständiges mehrteiliges Symbol (z. B. Zopf). */
export interface StitchUnit {
  x: number;
  width: number;
  /** Basis-Code des Symbols */
  code: number;
  color: number;
  /** Teil eines unvollständigen mehrteiligen Symbols */
  broken: boolean;
}

export interface RowInstruction {
  row: number;
  y: number;
  side: RowSide;
  /** Einheiten in Strickrichtung */
  units: StitchUnit[];
  stitchesBefore: number;
  stitchesAfter: number;
  hasBroken: boolean;
}

export function rowSide(row: number, settings: Pick<ChartSettings, 'workedIn' | 'firstRowRS'>): RowSide {
  if (settings.workedIn === 'rounds') return 'round';
  const odd = row % 2 === 1;
  return odd === settings.firstRowRS ? 'rs' : 'ws';
}

/** Zerlegt eine Rasterzeile (von links nach rechts) in Einheiten. */
export function parseRow(g: ChartGrid, y: number): StitchUnit[] {
  const units: StitchUnit[] = [];
  const w = g.width;
  let x = 0;
  while (x < w) {
    const i = y * w + x;
    const code = g.symbols[i];
    const { symbol, part } = symbolPart(code);
    if (symbol.width > 1) {
      let complete = part === 0 && x + symbol.width <= w;
      if (complete) {
        for (let k = 1; k < symbol.width; k++) {
          if (g.symbols[i + k] !== symbol.code + k) {
            complete = false;
            break;
          }
        }
      }
      if (complete) {
        units.push({ x, width: symbol.width, code: symbol.code, color: g.colors[i], broken: false });
        x += symbol.width;
        continue;
      }
      units.push({ x, width: 1, code: symbol.code, color: g.colors[i], broken: true });
      x++;
      continue;
    }
    units.push({ x, width: 1, code: symbol.code, color: g.colors[i], broken: false });
    x++;
  }
  return units;
}

export function rowInstruction(g: ChartGrid, settings: ChartSettings, row: number): RowInstruction {
  const y = g.height - row;
  const side = rowSide(row, settings);
  let units = parseRow(g, y);
  if (side !== 'ws') units = units.reverse();
  let before = 0;
  let after = 0;
  let hasBroken = false;
  const out: StitchUnit[] = [];
  for (const u of units) {
    const { symbol } = symbolPart(u.code);
    if (u.broken) {
      hasBroken = true;
      before += 1;
      after += 1;
      out.push(u);
      continue;
    }
    if (symbol.noStitch) continue;
    before += symbol.consumes;
    after += symbol.produces;
    out.push(u);
  }
  return { row, y, side, units: out, stitchesBefore: before, stitchesAfter: after, hasBroken };
}

function unitAction(u: StitchUnit, side: RowSide): ActionKey {
  const { symbol } = symbolPart(u.code);
  if (u.broken) return side === 'ws' ? 'p' : 'k';
  return side === 'ws' ? symbol.ws : symbol.rs;
}

interface Token {
  action: ActionKey;
  color: number;
  count: number;
}

function tokenize(units: StitchUnit[], side: RowSide): Token[] {
  const tokens: Token[] = [];
  for (const u of units) {
    const action = unitAction(u, side);
    const last = tokens[tokens.length - 1];
    if (last && last.action === action && last.color === u.color) last.count++;
    else tokens.push({ action, color: u.color, count: 1 });
  }
  return tokens;
}

/** Formatiert Tokens: bei mehreren Farben wird vor jedem Farbwechsel die Farbe genannt („A: 3 re, 1 U · B: 2 re“). */
function formatTokens(tokens: Token[], lang: Lang, multiColor: boolean): string {
  if (!multiColor) return tokens.map((t) => actionCount(t.action, t.count, lang)).join(', ');
  const groups: { color: number; parts: string[] }[] = [];
  for (const t of tokens) {
    const last = groups[groups.length - 1];
    const text = actionCount(t.action, t.count, lang);
    if (last && last.color === t.color) last.parts.push(text);
    else groups.push({ color: t.color, parts: [text] });
  }
  return groups.map((gr) => `${colorLetter(gr.color)}: ${gr.parts.join(', ')}`).join(' · ');
}

function unitKey(u: StitchUnit, side: RowSide): string {
  return `${unitAction(u, side)}|${u.color}`;
}

/** Kleinste Periode p ≥ 2 mit mindestens 2 Wiederholungen, sonst 0. */
export function findPeriod(keys: string[]): number {
  const n = keys.length;
  for (let p = 1; p <= Math.floor(n / 2); p++) {
    let ok = true;
    for (let i = 0; i + p < n; i++) {
      if (keys[i] !== keys[i + p]) {
        ok = false;
        break;
      }
    }
    if (ok) return p === 1 ? 0 : p;
  }
  return 0;
}

const LABELS = {
  de: {
    rs: (n: number) => `R ${n} (Hinr.)`,
    ws: (n: number) => `R ${n} (Rückr.)`,
    round: (n: number) => `Rd. ${n}`,
    sts: (n: number) => `(${n} M)`,
    repeat: (seq: string, n: number) => `[${seq}] ${n}×`,
    broken: 'unvollständiges Symbol als re/li gezählt',
    empty: 'keine Maschen',
  },
  en: {
    rs: (n: number) => `Row ${n} (RS)`,
    ws: (n: number) => `Row ${n} (WS)`,
    round: (n: number) => `Rnd ${n}`,
    sts: (n: number) => `(${n} sts)`,
    repeat: (seq: string, n: number) => `[${seq}] ${n} times`,
    broken: 'incomplete symbol counted as k/p',
    empty: 'no stitches',
  },
};

export function rowLabel(row: number, side: RowSide, lang: Lang): string {
  return LABELS[lang][side](row);
}

export function chartUsesMultipleColors(g: ChartGrid): boolean {
  const first = g.colors[0];
  for (let i = 1; i < g.colors.length; i++) if (g.colors[i] !== first) return true;
  return false;
}

/** Text der Anleitung für eine Reihe (ohne Reihenbezeichnung). */
export function formatRowBody(instr: RowInstruction, lang: Lang, multiColor: boolean): string {
  const L = LABELS[lang];
  if (instr.units.length === 0) return L.empty;
  const keys = instr.units.map((u) => unitKey(u, instr.side));
  const p = findPeriod(keys);
  let body: string;
  if (p > 0) {
    const reps = Math.floor(keys.length / p);
    const rem = keys.length - reps * p;
    const period = formatTokens(tokenize(instr.units.slice(0, p), instr.side), lang, multiColor);
    body = L.repeat(period, reps);
    if (rem > 0) body += ', ' + formatTokens(tokenize(instr.units.slice(0, rem), instr.side), lang, multiColor);
  } else {
    body = formatTokens(tokenize(instr.units, instr.side), lang, multiColor);
  }
  body += ' ' + L.sts(instr.stitchesAfter);
  if (instr.hasBroken) body += ` – ${L.broken}`;
  return body;
}

export function formatRow(instr: RowInstruction, lang: Lang, multiColor: boolean): string {
  return `${rowLabel(instr.row, instr.side, lang)}: ${formatRowBody(instr, lang, multiColor)}`;
}

export function chartInstructions(g: ChartGrid, settings: ChartSettings): RowInstruction[] {
  const rows: RowInstruction[] = [];
  for (let row = 1; row <= g.height; row++) rows.push(rowInstruction(g, settings, row));
  return rows;
}

/** Komplette Anleitung als Text (z. B. für Export oder Zwischenablage). */
export function instructionsText(
  g: ChartGrid,
  settings: ChartSettings,
  lang: Lang,
  title: string,
): string {
  const multi = chartUsesMultipleColors(g);
  const rows = chartInstructions(g, settings);
  const lines: string[] = [title, ''];
  const castOn = rows[0]?.stitchesBefore ?? g.width;
  if (lang === 'de') {
    lines.push(`Anschlag: ${castOn} M`);
    lines.push(settings.workedIn === 'rounds' ? 'In Runden gestrickt, jede Runde von rechts nach links lesen.' : 'In Reihen gestrickt: Hinreihen von rechts nach links, Rückreihen von links nach rechts lesen.');
  } else {
    lines.push(`Cast on: ${castOn} sts`);
    lines.push(settings.workedIn === 'rounds' ? 'Worked in the round, read every round from right to left.' : 'Worked flat: read RS rows from right to left and WS rows from left to right.');
  }
  if (multi) {
    const used = new Set<number>();
    for (let i = 0; i < g.colors.length; i++) used.add(g.colors[i]);
    const colorLines = [...used]
      .sort((a, b) => a - b)
      .map((c) => `${colorLetter(c)} = ${g.palette[c].name || g.palette[c].hex}`);
    lines.push((lang === 'de' ? 'Farben: ' : 'Colours: ') + colorLines.join(', '));
  }
  lines.push('');
  for (const r of rows) lines.push(formatRow(r, lang, multi));
  return lines.join('\n');
}
