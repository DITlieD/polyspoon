import { chromium } from 'playwright-core';
import { createServer } from 'vite';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { families, fixtures } from '../src/families/index.ts';
import type { Family } from '../src/families/index.ts';
import { defaults as lanternDefaults, presets as lanternPresets } from '../src/lantern/config.ts';
import { sourceProvenance, sha256 } from './provenance.ts';
import type {} from '../src/kit-review/main.ts';

const output = process.env.R4_CAPTURE_OUTPUT ?? 'evidence/revision4/art-pass4';
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
  async function capture(name: string, entries: Array<{ family: Family | 'lantern'; input: unknown }>, view: 'front' | 'side' | 'oblique' | 'rear' = 'oblique', mode = 'shaded') {
    const report = await page.evaluate(({ entries, view, mode }) => window.kitReview.display(entries, view, mode), { entries, view, mode });
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
  const order: Array<Family | 'lantern'> = ['cottage','tree','fence','crate','boulder','lantern'];
  const cells:string[]=[];
  for(const c of [{id:'default',input:{}},{id:'narrow',input:{width:3.6,roofRise:1.15}},{id:'sparse',input:{windowLayout:'sparse'}}]){
    for(const view of ['front','oblique'] as const){
      const png=await capture('cottage-'+c.id+'-'+view,[{family:'cottage',input:c.input}],view);
      cells.push('<article><img src="data:image/png;base64,'+png+'"><h2>'+c.id+' / '+view+'</h2></article>');
    }
  }
  await contact('front-framing','Cottage / connected front framing','Default, narrow and sparse bays. Front and oblique views.',cells,2);
  const gl = await page.evaluate(() => {
    const context = document.querySelector('canvas')!.getContext('webgl2')!;
    const ext = context.getExtension('WEBGL_debug_renderer_info');
    return ext ? context.getParameter(ext.UNMASKED_RENDERER_WEBGL) as string : 'unavailable';
  });
  const after = await sourceProvenance();
  const owned=(sources:Record<string,string>)=>Object.fromEntries(Object.entries(sources).filter(([p])=>p.startsWith('src/families/')||p.startsWith('src/lantern/')||(p.startsWith('src/engine/')&&!p.endsWith('parameters.ts'))));
  if(JSON.stringify(owned(before.sources))!==JSON.stringify(owned(after.sources)))throw new Error('Owned geometry changed during capture');
  if (errors.length) throw new Error(errors.join('; '));
  const diagnosticHash = sha256(await readFile('kit-review.html'));
  await writeFile(output + (cottageOnly ? '/manifest-cottage-correction.json' : '/manifest.json'), JSON.stringify({
    generatedAt: new Date().toISOString(), provenance: after, additionalSources: { 'kit-review.html': diagnosticHash },
    browser: browser.version(), renderer: gl,
    stage: { background: '#e6e8e3', colorSpace: 'sRGB', toneMapping: 'none', key: [-2, 5, 3, 2.3], fill: [3, 2, -3, 0.7], hemisphere: 1.6, ambient: 0.25, shadows: false, ground: false, framing: 'orthographic projected-bounds plus 20 percent margin' },
    captures, files, errors,
  }, null, 2));
  console.log('Saved ' + Object.keys(files).length + ' original PNGs and configuration/source manifest in ' + output);
} finally {
  await browser?.close();
  await server.close();
}
