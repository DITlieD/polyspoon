import { chromium } from 'playwright-core';
import { createServer } from 'vite';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { families, fixtures } from '../src/families/index.ts';
import type { Family } from '../src/families/index.ts';
import { defaults as lanternDefaults, presets as lanternPresets } from '../src/lantern/config.ts';
import { sourceProvenance, sha256 } from './provenance.ts';
import type {} from '../src/kit-review/main.ts';

const packetIndex=process.argv.indexOf('--packet'),outputIndex=process.argv.indexOf('--out');
const packet=packetIndex<0?undefined:JSON.parse(await readFile(process.argv[packetIndex+1]!,'utf8'));
const output = outputIndex<0?'evidence/kit':process.argv[outputIndex+1]!;
const cottageOnly = process.argv.includes('--cottage-correction');
await mkdir(output, { recursive: true });
const before = await sourceProvenance();
const server = await createServer({ server: { host: '127.0.0.1', port: 0 } });
await server.listen();
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
const files: Record<string, string> = {}, captures: unknown[] = [], errors: string[] = [];
try {
  browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? '/usr/bin/google-chrome', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'] });
  const page = await browser.newPage({ viewport: { width: 768, height: 768 }, deviceScaleFactor: 1 });
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(server.resolvedUrls!.local[0]! + 'kit-review.html');
  await page.waitForFunction(() => Boolean(window.kitReview));
  async function capture(name: string, entries: Array<{ family: string; input: unknown; position?: readonly [number,number,number]; rotation?: number }>, view: 'front' | 'side' | 'oblique' | 'rear' = 'oblique', mode = 'shaded',fixedSpan?:number) {
    const report = await page.evaluate(({ entries, view, mode,fixedSpan }) => window.kitReview.display(entries, view, mode,fixedSpan), { entries, view, mode,fixedSpan });
    for (const entry of report.entries) if (entry.inspection.errors.length) throw new Error(name + ': ' + entry.inspection.errors.join(', '));
    captures.push({ file: name + '.png', view, mode, ...report });
    const image = await page.screenshot({ path: output + '/' + name + '.png' });
    files[name + '.png'] = sha256(image);
    return image.toString('base64');
  }
  const sheet = await browser.newPage({ viewport: { width: 1320, height: 1100 }, deviceScaleFactor: 1 });
  async function contact(name: string, title: string, subtitle: string, cells: string[], columns = 3) {
    await sheet.setContent('<html><head><style>body{margin:0;padding:28px;background:#f5f4ef;color:#29342e;font-family:Arial}h1{font-size:25px;margin:0 0 8px}header p{font-size:13px;margin-bottom:24px}.grid{display:grid;grid-template-columns:repeat(' + columns + ',1fr);gap:15px}article{background:#e6e8e3;border:1px solid #cdd3c8}img{display:block;width:100%}h2{font-size:15px;margin:12px}article p{font-size:11px;margin:12px;line-height:1.5;overflow-wrap:anywhere}footer{font-size:12px;margin-top:20px}</style></head><body><header><h1>' + title + '</h1><p>' + subtitle + '</p></header><div class="grid">' + cells.join('') + '</div><footer>Actual generated geometry. Neutral sRGB, no tone mapping, matte opaque materials. Review evidence; no aesthetic acceptance.</footer></body></html>');
    await sheet.locator('img').evaluateAll(imgs => Promise.all(imgs.map(i => (i as HTMLImageElement).decode())));
    const buffer = await sheet.screenshot({ path: output + '/' + name + '.png', fullPage: true }); files[name + '.png'] = sha256(buffer);
  }
  if(packet) {
    for(const c of packet.captures) {
      await page.setViewportSize({width:c.width??1600,height:c.height??900});
      await capture(c.id,c.entries,c.view??'oblique',c.mode??'shaded',c.fixedSpan);
    }
  } else {
  const order: Array<Family | 'lantern'> = ['cottage', 'tree', 'fence', 'boulder', 'crate', 'lantern'];
  await page.setViewportSize({ width: 2200, height: 800 });
  await capture('lineup-fixed-scale', order.map(family => ({ family, input: {} })));
  await capture('lineup-fixed-scale-front', order.map(family => ({ family, input: {} })), 'front');
  const silhouettes: string[] = [];
  for (const family of order) {
    if (cottageOnly && family !== 'cottage') continue;
    await page.setViewportSize({ width: 768, height: 768 });
    const definition = family === 'lantern' ? undefined : families[family];
    const cases = family === 'lantern' ? [
      ...lanternPresets.map(p => ({ id: p.id, name: p.name, parameters: p.parameters })),
      { id: 'wide-low', name: 'Wide / low', parameters: { bodyWidth: 0.44, bodyHeight: 0.18, handleClearance: 0.075 } },
      { id: 'narrow-tall', name: 'Narrow / tall', parameters: { bodyWidth: 0.22, bodyHeight: 0.297, handleClearance: 0.143 } },
      { id: 'wide-tall', name: 'Wide / tall', parameters: { bodyWidth: 0.44, bodyHeight: 0.36, handleClearance: 0.19 } },
    ] : fixtures(family).slice(0, 6);
    const cells: string[] = [];
    for (const c of cases) {
      const png = await capture(family + '-' + c.id, [{ family, input: c.parameters }]);
      cells.push('<article><img src="data:image/png;base64,' + png + '"><h2>' + c.name + '</h2><p>' + Object.entries({ ...(definition?.defaults ?? lanternDefaults), ...c.parameters }).map(([k, v]) => k + ': ' + v).join(' · ') + '</p></article>');
    }
    await contact(family + '-sheet', (definition?.label ?? 'Existing work lantern') + ' · presets and coupled extremes', 'Normalized framing compares silhouette and proportions. First row: three presets. Second row: coupled extremes. Dimensions are in meters.', cells);
    const views: string[] = [];
    for (const view of ['front', 'side', 'rear'] as const) {
      const png = await capture(family + '-default-' + view, [{ family, input: {} }], view);
      views.push('<article><img src="data:image/png;base64,' + png + '"><h2>' + view + '</h2></article>');
    }
    await contact(family + '-views', (definition?.label ?? 'Existing work lantern') + ' · neutral construction views', 'Normalized front, side and rear oblique. Same production generator and default configuration.', views);
    if (cottageOnly) continue;
    await page.setViewportSize({ width: 128, height: 128 });
    const png = await capture(family + '-silhouette-128', [{ family, input: {} }], 'oblique', 'silhouette');
    silhouettes.push('<article><img style="width:128px;height:128px;margin:24px auto" src="data:image/png;base64,' + png + '"><h2>' + family + '</h2></article>');
  }
  await sheet.setViewportSize({ width: 900, height: 650 });
  if (!cottageOnly) await contact('silhouettes', 'Woodland Workshop · compact silhouettes', '128 × 128 originals, normalized independently. Compare identity, not physical scale.', silhouettes);
  }
  const gl = await page.evaluate(() => {
    const context = document.querySelector('canvas')!.getContext('webgl2')!;
    const ext = context.getExtension('WEBGL_debug_renderer_info');
    return ext ? context.getParameter(ext.UNMASKED_RENDERER_WEBGL) as string : 'unavailable';
  });
  const after = await sourceProvenance();
  if (JSON.stringify(before.sources) !== JSON.stringify(after.sources)) throw new Error('Source changed during rendering; rerun packet');
  if (errors.length) throw new Error(errors.join('; '));
  const diagnosticHash = sha256(await readFile('kit-review.html'));
  await writeFile(output + (cottageOnly ? '/manifest-cottage-correction.json' : '/manifest.json'), JSON.stringify({
    generatedAt: new Date().toISOString(), provenance: after, additionalSources: { 'kit-review.html': diagnosticHash },
    browser: browser.version(), renderer: gl,
    stage: { background: '#e6e8e3', colorSpace: 'sRGB', toneMapping: 'none', key: [-2, 5, 3, 2.3], fill: [3, 2, -3, 0.7], hemisphere: 1.6, ambient: 0.25, shadows: false, ground: false, framing: 'orthographic projected-bounds plus 20 percent margin' },
    captures, files, errors,packet,
  }, null, 2));
  console.log('Saved ' + Object.keys(files).length + ' original PNGs and configuration/source manifest in ' + output);
} finally {
  await browser?.close();
  await server.close();
}
