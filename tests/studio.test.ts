import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { createServer, preview } from 'vite';
import { readFile } from 'node:fs/promises';
import { saveConfiguration } from '../src/lantern/config.ts';
import { validateBytes } from 'gltf-validator';

test('studio edits, invalid retention, downloads, load races and GPU resource lifetime', { timeout: 60000 }, async () => {
  const integration=process.env.INTEGRATION_EVIDENCE_ROOT;
  const server = integration ? await preview({build:{outDir:integration+'/build'},preview:{host:'127.0.0.1',port:0}}) : await createServer({server:{host:'127.0.0.1',port:0}});
  if('listen' in server) await server.listen();
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? '/usr/bin/google-chrome', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'] });
  const page = await browser.newPage({ acceptDownloads: true });
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    await page.goto(`${server.resolvedUrls!.local[0]}?diagnostic=1`);
    await page.waitForFunction(() => Boolean(window.workshopDiagnostics));
    await page.evaluate(() => document.body.classList.remove('diagnostic'));
    const initial = await page.evaluate(() => window.workshopDiagnostics.configuration());
    const memory = await page.evaluate(() => window.workshopDiagnostics.memory());
    await page.evaluate(() => {
      const input = document.querySelector<HTMLInputElement>('#bodyWidth')!;
      input.focus(); input.value = '40'; input.dispatchEvent(new Event('input')); input.dispatchEvent(new Event('blur'));
    });
    assert.equal(await page.evaluate(() => window.workshopDiagnostics.configuration().applied.bodyWidth), 0.4);
    await page.evaluate(() => {
      for (const [id, value] of [['bodyWidth', '22'], ['bodyHeight', '36']]) {
        const input = document.getElementById(id!) as HTMLInputElement;
        input.focus(); input.value = value!; input.dispatchEvent(new Event('input')); input.dispatchEvent(new Event('blur'));
      }
    });
    assert.equal(await page.locator('#error').isVisible(), true);
    assert.equal(await page.evaluate(() => window.workshopDiagnostics.configuration().applied.bodyHeight), 0.26);
    await page.evaluate(() => document.querySelector<HTMLButtonElement>('#reset')!.click());
    assert.equal(await page.locator('#error').isVisible(), false);
    assert.deepEqual(await page.evaluate(() => window.workshopDiagnostics.configuration().applied), initial.applied);
    await page.evaluate(() => Object.assign(document.querySelector<HTMLSelectElement>('#preset')!,{value:'harbor'}).dispatchEvent(new Event('change')));
    assert.equal(await page.evaluate(() => window.workshopDiagnostics.configuration().applied.colorway), 'harbor');
    const saveEvent = page.waitForEvent('download');
    await page.evaluate(() => document.querySelector<HTMLButtonElement>('#save')!.click());
    const saved = await saveEvent;
    const downloaded = JSON.parse(await readFile((await saved.path())!, 'utf8'));
    assert.equal(downloaded.applied.bodyWidth, 0.4);
    await page.locator('#file').setInputFiles({ name: 'field.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(saveConfiguration({}))) });
    await page.waitForFunction(() => window.workshopDiagnostics.configuration().applied.bodyWidth === 0.32);
    await page.evaluate(`{
      const original = File.prototype.text;
      window.releaseRead = undefined;
      File.prototype.text = function() { return new Promise(resolve => { window.releaseRead = () => original.call(this).then(resolve); }); };
    }`);
    await page.locator('#file').setInputFiles({ name: 'old.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(saveConfiguration({ bodyWidth: 0.44 }))) });
    assert.equal(await page.evaluate(() => typeof (window as unknown as { releaseRead: unknown }).releaseRead), 'function', await page.locator('#error').textContent() ?? 'file read never started');
    await page.evaluate(() => {
      const input = document.querySelector<HTMLInputElement>('#bodyWidth')!;
      input.focus(); input.value = '30'; input.dispatchEvent(new Event('input')); input.dispatchEvent(new Event('blur'));
      (window as unknown as { releaseRead(): void }).releaseRead();
    });
    await page.waitForTimeout(100);
    assert.equal(await page.evaluate(() => window.workshopDiagnostics.configuration().applied.bodyWidth), 0.3);
    const exportEvent = page.waitForEvent('download');
    await page.evaluate(() => document.querySelector<HTMLButtonElement>('#export')!.click());
    const model = await exportEvent;
    const validation = await validateBytes(await readFile((await model.path())!));
    assert.equal(validation.issues.numErrors, 0);
    assert.equal(validation.issues.numWarnings, 0);
    await page.evaluate(() => {
      for (let i = 0; i < 120; i++) window.workshopDiagnostics.apply({ bodyWidth: 0.3 + i % 10 * 0.005 });
      window.workshopDiagnostics.render();
    });
    const finalMemory = await page.evaluate(() => window.workshopDiagnostics.memory());
    assert.equal(finalMemory.geometries, memory.geometries);
    assert.equal(finalMemory.textures, memory.textures);
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ studio: 'passed', edits: 120, before: memory, after: finalMemory, browserExportErrors: validation.issues.numErrors }));
  } finally { await browser.close(); await server.close(); }
});
