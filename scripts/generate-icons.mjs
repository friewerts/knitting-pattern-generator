// Erzeugt die App-Icons (PNG) aus SVG mit dem vorinstallierten Chromium (Playwright).
// Aufruf: npm run icons
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = (p) => resolve(root, 'public', p);

const BG = '#b23a5e';
const FABRIC = '#c24f72';
const FABRIC_DARK = '#9c3050';
const HEART = '#fbf3e6';
const HEART_DARK = '#e9dcc7';

// 9 x 8 Pixel-Herz
const HEART_ROWS = [
  '.XX...XX.',
  'XXXX.XXXX',
  'XXXXXXXXX',
  'XXXXXXXXX',
  '.XXXXXXX.',
  '..XXXXX..',
  '...XXX...',
  '....X....',
];

/** Eine rechte Masche als „V“ aus zwei Blättern. */
function stitch(cx, cy, w, h, fill, shade) {
  const rx = w * 0.27;
  const ry = h * 0.56;
  const dx = w * 0.235;
  return `
    <g>
      <ellipse cx="${cx - dx}" cy="${cy}" rx="${rx}" ry="${ry}" transform="rotate(-24 ${cx - dx} ${cy})" fill="${fill}" stroke="${shade}" stroke-width="${w * 0.05}"/>
      <ellipse cx="${cx + dx}" cy="${cy}" rx="${rx}" ry="${ry}" transform="rotate(24 ${cx + dx} ${cy})" fill="${fill}" stroke="${shade}" stroke-width="${w * 0.05}"/>
    </g>`;
}

function knittedHeartSvg({ size = 512, maskable = false } = {}) {
  const cols = 11;
  const rows = 10;
  const area = maskable ? size * 0.62 : size * 0.78;
  const cw = area / cols;
  const ch = cw * 0.82;
  const totalW = cw * cols;
  const totalH = ch * rows;
  const x0 = (size - totalW) / 2;
  const y0 = (size - totalH) / 2 + ch * 0.1;
  let stitches = '';
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const hr = r - 1;
      const hc = c - 1;
      const inHeart = hr >= 0 && hr < HEART_ROWS.length && hc >= 0 && hc < 9 && HEART_ROWS[hr][hc] === 'X';
      const cx = x0 + c * cw + cw / 2;
      const cy = y0 + r * ch + ch / 2;
      stitches += inHeart
        ? stitch(cx, cy, cw, ch, HEART, HEART_DARK)
        : stitch(cx, cy, cw, ch, FABRIC, FABRIC_DARK);
    }
  }
  const radius = maskable ? 0 : size * 0.22;
  const clipId = 'clip';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs><clipPath id="${clipId}"><rect width="${size}" height="${size}" rx="${radius}"/></clipPath></defs>
  <g clip-path="url(#${clipId})">
    <rect width="${size}" height="${size}" fill="${BG}"/>
    ${maskable ? '' : `<rect x="${size * 0.06}" y="${size * 0.06}" width="${size * 0.88}" height="${size * 0.88}" rx="${size * 0.17}" fill="${FABRIC_DARK}" opacity="0.35"/>`}
    ${stitches}
  </g>
</svg>`;
}

/** Schlichtes Favicon: Pixelherz auf abgerundetem Quadrat (gut lesbar in 16 px). */
function faviconSvg() {
  const size = 64;
  const cell = 5.6;
  const x0 = (size - cell * 9) / 2;
  const y0 = (size - cell * 8) / 2 + 1;
  let cells = '';
  HEART_ROWS.forEach((row, r) => {
    [...row].forEach((ch, c) => {
      if (ch === 'X') {
        cells += `<rect x="${(x0 + c * cell).toFixed(2)}" y="${(y0 + r * cell).toFixed(2)}" width="${cell - 0.6}" height="${cell - 0.6}" rx="1" fill="${HEART}"/>`;
      }
    });
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}"><rect width="${size}" height="${size}" rx="14" fill="${BG}"/>${cells}</svg>\n`;
}

async function render(page, svg, size, file) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<html><body style="margin:0;background:transparent">${svg.replace(/width="\d+" height="\d+"/, `width="${size}" height="${size}"`)}</body></html>`,
  );
  const buf = await page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
  mkdirSync(dirname(out(file)), { recursive: true });
  writeFileSync(out(file), buf);
  console.log('wrote', file);
}

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });
const icon = knittedHeartSvg({ size: 512 });
const maskable = knittedHeartSvg({ size: 512, maskable: true });
await render(page, icon, 192, 'icons/icon-192.png');
await render(page, icon, 512, 'icons/icon-512.png');
await render(page, maskable, 512, 'icons/maskable-512.png');
// Apple: kein transparenter Rand, volle Fläche
await render(page, maskable, 180, 'icons/apple-touch-icon.png');
writeFileSync(out('favicon.svg'), faviconSvg());
writeFileSync(out('icons/icon.svg'), icon);
console.log('wrote favicon.svg, icons/icon.svg');
await browser.close();
