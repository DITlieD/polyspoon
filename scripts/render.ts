import { chromium } from 'playwright-core';
import { createServer } from 'vite';
import { mkdir, writeFile } from 'node:fs/promises';
import { presets } from '../src/lantern/config.ts';
import type { Parameters } from '../src/lantern/config.ts';
import type { Mode, View } from '../src/studio/stage.ts';
import { sourceProvenance, sha256 } from './provenance.ts';

interface Diagnostics {
  apply(input: unknown, frame?: boolean): boolean;
  configuration(): { applied: Parameters };
  view(view: View, span?: number): void;
  mode(mode: Mode): void;
  memory(): { geometries: number; textures: number };
  render(): void;
}
declare global { interface Window { workshopDiagnostics: Diagnostics } }
const output = 'evidence/renders';
await mkdir(output, { recursive: true });
const server = process.env.STUDIO_URL ? undefined : await createServer({ server: { host: '127.0.0.1', port: 0 } });
await server?.listen();
const url = process.env.STUDIO_URL ?? server!.resolvedUrls!.local[0]!;
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? '/usr/bin/google-chrome', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'] });
const page = await browser.newPage({ viewport: { width: 1024, height: 1024 }, deviceScaleFactor: 1 });
const errors: string[] = [];
page.on('pageerror', error => errors.push(error.message));
const files: Record<string, string> = {};
try {
  await page.goto(`${url}?diagnostic=1`);
  await page.waitForFunction(() => Boolean(window.workshopDiagnostics));
  const settle = async () => { await page.evaluate(async () => { for (let i = 0; i < 6; i++) await new Promise(requestAnimationFrame); window.workshopDiagnostics.render(); }); };
  async function capture(name: string, input: unknown, view: View, mode: Mode = 'shaded', span?: number) {
    const applied = await page.evaluate(({ input, view, mode, span }) => {
      const api = window.workshopDiagnostics;
      const success = api.apply(input); api.mode(mode); api.view(view, span); return success;
    }, { input, view, mode, span });
    if (!applied) throw new Error(`Rejected render configuration: ${name}`);
    await settle();
    const buffer = await page.screenshot({ path: `${output}/${name}.png` });
    files[`${name}.png`] = sha256(buffer);
    return buffer.toString('base64');
  }
  for (const view of ['front', 'rear', 'left', 'right', 'top', 'oblique', 'rear-oblique'] as const) await capture(`field-${view}`, {}, view);
  for (const mode of ['clay', 'color', 'silhouette'] as const) await capture(`field-${mode}`, {}, 'oblique', mode);
  await page.setViewportSize({ width: 128, height: 128 });
  await capture('field-silhouette-128', {}, 'oblique', 'silhouette');
  await page.setViewportSize({ width: 512, height: 512 });
  const fixtures = [
    ...presets.map(p => ({ name: p.name, parameters: p.parameters })),
    { name: 'Wide / low opening', parameters: { bodyWidth: 0.44, bodyHeight: 0.18, handleClearance: 0.075, colorway: 'forest' } },
    { name: 'Narrow / tall enclosure', parameters: { bodyWidth: 0.22, bodyHeight: 0.297, handleClearance: 0.143, colorway: 'ember' } },
    { name: 'Wide / tall enclosure', parameters: { bodyWidth: 0.44, bodyHeight: 0.36, handleClearance: 0.19, colorway: 'harbor' } },
  ];
  const sheet = await browser.newPage({ viewport: { width: 1080, height: 960 }, deviceScaleFactor: 1 });
  for (const framing of ['normalized', 'fixed-scale'] as const) {
    const cells: string[] = [];
    for (let i = 0; i < fixtures.length; i++) {
      const fixture = fixtures[i]!;
      const image = await capture(`${framing}-${i + 1}`, fixture.parameters, 'oblique', 'shaded', framing === 'fixed-scale' ? 1.04 : undefined);
      const p = fixture.parameters;
      cells.push(`<article><img src="data:image/png;base64,${image}"><h2>${fixture.name}</h2><p>Body ${(p.bodyWidth * 100).toFixed(1)} × ${(p.bodyHeight * 100).toFixed(1)} cm · opening ${(p.handleClearance * 100).toFixed(1)} cm</p></article>`);
    }
    await sheet.setContent(`<html><head><style>body{margin:0;background:#f5f4ef;color:#29342e;font-family:Arial,sans-serif;padding:30px}h1{font-size:25px;margin:0 0 8px}header p{font-size:13px;color:#687568;margin:0 0 24px}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}article{background:#e6e8e3;border:1px solid #cdd3c8;border-radius:5px;overflow:hidden}img{width:100%;display:block}h2{font-size:14px;margin:10px 13px 5px}article p{font-size:10px;margin:0 13px 16px;color:#687568}footer{font-size:11px;color:#687568;margin-top:20px}</style></head><body><header><h1>Work lantern · presets & boundary cases</h1><p>${framing === 'fixed-scale' ? 'Fixed scale · each square spans 1.04 m vertically; compare physical size' : 'Normalized framing · compare silhouette and proportion, not physical size'}</p></header><section class="grid">${cells.join('')}</section><footer>Actual generated geometry · neutral light · sRGB · no tone mapping · family 1.0.0 · review evidence, not visual acceptance</footer></body></html>`);
    await sheet.locator('img').evaluateAll(images => Promise.all(images.map(image => (image as HTMLImageElement).decode())));
    const buffer = await sheet.screenshot({ path: `${output}/contact-${framing}.png`, fullPage: true });
    files[`contact-${framing}.png`] = sha256(buffer);
  }
  await sheet.close();
  const renderer = await page.evaluate(() => {
    const canvas = document.querySelector('canvas')!;
    const gl = canvas.getContext('webgl2')!;
    const extension = gl.getExtension('WEBGL_debug_renderer_info');
    return { vendor: extension ? gl.getParameter(extension.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR), renderer: extension ? gl.getParameter(extension.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER) };
  });
  await page.goto(url);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.waitForSelector('canvas');
  await page.waitForTimeout(350);
  files['studio-desktop.png'] = sha256(await page.screenshot({ path: `${output}/studio-desktop.png` }));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(150);
  files['studio-mobile.png'] = sha256(await page.screenshot({ path: `${output}/studio-mobile.png`, fullPage: true }));
  if (errors.length) throw new Error(errors.join('; '));
  await writeFile(`${output}/manifest.json`, JSON.stringify({ generatedAt: new Date().toISOString(), provenance: await sourceProvenance(), browser: browser.version(), renderer, stage: { colorSpace: 'sRGB', toneMapping: 'none', key: [-2, 5, 3, 2.3], shadowIntensity: 0.35, shadowRadius: 3, fill: [3, 2, -3, 0.7], hemisphere: 1.6, ambient: 0.25, diagnosticGround: false, framing: 'orthographic', mode: 'opaque matte PBR' }, configurations: fixtures, files }, null, 2));
  console.log(`Saved ${Object.keys(files).length} diagnostic images and provenance in ${output}`);
} finally { await browser.close(); await server?.close(); }
