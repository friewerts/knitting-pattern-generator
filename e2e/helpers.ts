import { expect, type Page } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const fixture = (name: string) => path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', name);

/** Bildschirmposition (Seitenkoordinaten) der Mitte einer Rasterzelle. */
export async function cellPoint(page: Page, x: number, y: number) {
  const canvas = page.locator('.canvas-wrap canvas');
  await expect(canvas).toHaveAttribute('data-cw', /\d/);
  const box = (await canvas.boundingBox())!;
  const d = await canvas.evaluate((el) => ({ ...(el as HTMLCanvasElement).dataset }));
  return {
    x: box.x + Number(d.ox) + (x + 0.5) * Number(d.cw),
    y: box.y + Number(d.oy) + (y + 0.5) * Number(d.ch),
  };
}

export async function createBlankChart(page: Page, size: string) {
  await page.goto('/');
  await page.getByRole('button', { name: /Leeres Muster/ }).click();
  await page.getByRole('button', { name: size, exact: true }).click();
  await page.getByRole('button', { name: 'Erstellen' }).click();
  await expect(page).toHaveURL(/#\/edit\//);
  await expect(page.locator('.canvas-wrap canvas')).toBeVisible();
}
