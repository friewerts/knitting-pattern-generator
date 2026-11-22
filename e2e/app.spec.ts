import { expect, test } from '@playwright/test';
import { cellPoint, createBlankChart, fixture } from './helpers';

test.describe('Bild umwandeln', () => {
  test('erstellt aus einem Bild ein Muster mit Legende', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /Bild umwandeln/ }).click();
    const chooser = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Bild auswählen' }).click();
    await (await chooser).setFiles(fixture('motiv.png'));
    await expect(page.getByText(/60 × \d+ Maschen/)).toBeVisible();
    await expect(page.locator('.swatch-btn')).toHaveCount(4);
    // Anzahl Farben ändern
    const colors = page.getByRole('slider', { name: /Anzahl Farben/ });
    await colors.focus();
    await page.keyboard.press('ArrowRight');
    await expect(colors).toHaveValue('5');
    await expect(page.locator('.swatch-btn')).toHaveCount(5);
    await page.getByRole('button', { name: /Muster erstellen/ }).click();
    await expect(page).toHaveURL(/#\/edit\//);
    await expect(page.getByRole('textbox', { name: 'Name des Musters' })).toHaveValue('motiv');
    if (test.info().project.name === 'mobile') {
      await page.getByRole('button', { name: 'Menü' }).click();
      await page.getByRole('menuitem', { name: 'Legende & Anleitung' }).click();
    } else {
      await page.getByRole('tab', { name: 'Legende' }).click();
    }
    await expect(page.locator('.legend-item .legend-swatch').filter({ hasText: /^[A-E]$/ })).toHaveCount(5);
  });
});

test.describe('Editor', () => {
  test.skip(({ isMobile }) => isMobile, 'Desktop-Bedienung');

  test('zeichnet, macht rückgängig und schreibt die Anleitung', async ({ page }) => {
    await createBlankChart(page, '10×10');
    // Masche 1 in Reihe 1 (unten rechts) mit Farbe B
    const p = await cellPoint(page, 9, 9);
    await page.mouse.click(p.x, p.y);
    await page.getByRole('tab', { name: 'Anleitung' }).click();
    const row1 = page.locator('.instr-list li[data-row="1"]');
    await expect(row1).toContainText('B: 1 re · A: 9 re (10 M)');
    await page.keyboard.press('Control+z');
    await expect(row1).toContainText('10 re (10 M)');
    await page.keyboard.press('Control+y');
    await expect(row1).toContainText('B: 1 re');
    // Symbol setzen: Umschlag in Reihe 2 (Rückreihe), Masche 10 (links)
    await page.getByRole('tab', { name: 'Farben & Symbole' }).click();
    await page.getByRole('button', { name: 'Umschlag', exact: true }).click();
    const q = await cellPoint(page, 0, 8);
    await page.mouse.click(q.x, q.y);
    await page.getByRole('tab', { name: 'Anleitung' }).click();
    await expect(page.locator('.instr-list li[data-row="2"]')).toContainText('1 U');
  });

  test('speichert automatisch und lädt nach dem Neuladen', async ({ page }) => {
    await createBlankChart(page, '20×20');
    await page.getByRole('textbox', { name: 'Name des Musters' }).fill('Testmütze');
    await page.keyboard.press('Enter');
    const p = await cellPoint(page, 3, 3);
    await page.mouse.click(p.x, p.y);
    await expect(page.getByText('Gespeichert')).toBeVisible();
    await page.reload();
    await expect(page.getByRole('textbox', { name: 'Name des Musters' })).toHaveValue('Testmütze');
    await page.getByRole('button', { name: 'Zur Übersicht' }).click();
    await expect(page.locator('.chart-card').filter({ hasText: 'Testmütze' })).toBeVisible();
  });

  test('Auswahl über die Breite wiederholen', async ({ page }) => {
    await createBlankChart(page, '10×10');
    const a = await cellPoint(page, 0, 9);
    await page.mouse.click(a.x, a.y);
    await page.keyboard.press('s');
    const s0 = await cellPoint(page, 0, 9);
    const s1 = await cellPoint(page, 1, 9);
    await page.mouse.move(s0.x, s0.y);
    await page.mouse.down();
    await page.mouse.move(s1.x, s1.y, { steps: 4 });
    await page.mouse.up();
    await page.getByRole('button', { name: 'Über die ganze Breite wiederholen' }).click();
    await page.getByRole('tab', { name: 'Anleitung' }).click();
    await expect(page.locator('.instr-list li[data-row="1"]')).toContainText('[A: 1 re · B: 1 re] 5× (10 M)');
  });

  test('Auswahl anklicken und löschen leert die Maschen', async ({ page }) => {
    await createBlankChart(page, '10×10');
    // Reihe 1 komplett mit Farbe B
    const r0 = await cellPoint(page, 0, 9);
    const r9 = await cellPoint(page, 9, 9);
    await page.keyboard.press('l');
    await page.mouse.move(r0.x, r0.y);
    await page.mouse.down();
    await page.mouse.move(r9.x, r9.y, { steps: 4 });
    await page.mouse.up();
    await page.getByRole('tab', { name: 'Anleitung' }).click();
    const row1 = page.locator('.instr-list li[data-row="1"]');
    await expect(row1).toContainText('B: 10 re');
    // Auswahl über die rechten 4 Maschen, hineinklicken ohne zu ziehen, Entf
    await page.keyboard.press('s');
    const a = await cellPoint(page, 6, 9);
    const b = await cellPoint(page, 9, 9);
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(b.x, b.y, { steps: 3 });
    await page.mouse.up();
    const inside = await cellPoint(page, 7, 9);
    await page.mouse.click(inside.x, inside.y);
    await page.keyboard.press('Delete');
    await expect(row1).toContainText('A: 4 re · B: 6 re');
  });

  test('Farbwahl übernimmt einen eingefügten Ausschnitt', async ({ page }) => {
    await createBlankChart(page, '10×10');
    const p = await cellPoint(page, 9, 9);
    await page.mouse.click(p.x, p.y);
    await page.keyboard.press('s');
    const a = await cellPoint(page, 8, 9);
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(p.x, p.y, { steps: 3 });
    await page.mouse.up();
    await page.keyboard.press('Control+c');
    await page.keyboard.press('Escape');
    await page.keyboard.press('Control+v');
    await expect(page.getByRole('button', { name: 'Platzieren' })).toBeVisible();
    // Farbe wählen → Ausschnitt wird platziert, Stift ist aktiv
    await page.getByRole('button', { name: /^Farben C/ }).click();
    await expect(page.getByRole('button', { name: 'Platzieren' })).toBeHidden();
    const q = await cellPoint(page, 0, 0);
    await page.mouse.click(q.x, q.y);
    await page.getByRole('tab', { name: 'Anleitung' }).click();
    await expect(page.locator('.instr-list li[data-row="10"]')).toContainText('C: 1');
  });

  test('Strickmodus führt Reihe für Reihe', async ({ page }) => {
    await createBlankChart(page, '10×10');
    await page.getByRole('button', { name: 'Strickmodus' }).click();
    await expect(page.getByText('Reihe 1 von 10')).toBeVisible();
    await page.getByRole('button', { name: 'Nächste' }).click();
    await expect(page.getByText('Reihe 2 von 10')).toBeVisible();
    await expect(page.getByText('Rückreihe – von links nach rechts')).toBeVisible();
    await page.keyboard.press('ArrowUp');
    await expect(page.getByText('Reihe 3 von 10')).toBeVisible();
    await page.getByRole('button', { name: 'Strickmodus beenden' }).click();
    await expect(page.getByText('Reihe 3 von 10')).toBeHidden();
  });

  test('exportiert PNG und Musterdatei', async ({ page }) => {
    await createBlankChart(page, '10×10');
    await page.getByRole('button', { name: 'Exportieren & Drucken' }).click();
    const png = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Als Bild speichern' }).first().click();
    expect((await png).suggestedFilename()).toBe('Neues-Muster.png');
    const json = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Musterdatei (.json)' }).click();
    const file = await json;
    expect(file.suggestedFilename()).toBe('Neues-Muster.maschenwerk.json');
  });
});

test('funktioniert offline (Service Worker)', async ({ page, context }) => {
  await page.goto('/');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  // Seite einmal neu laden, damit der Service Worker die Seite kontrolliert
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('button', { name: /Bild umwandeln/ })).toBeVisible();
  await page.getByRole('button', { name: /Leeres Muster/ }).click();
  await page.getByRole('button', { name: 'Erstellen' }).click();
  await expect(page.locator('.canvas-wrap canvas')).toBeVisible();
  await context.setOffline(false);
});
