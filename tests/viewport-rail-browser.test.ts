import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer, type ViteDevServer} from 'vite';
import {chromium, type Browser, type Page} from 'playwright-core';

const root = new URL('..', import.meta.url).pathname;

function smokePage() {
  return [
    '<!doctype html><meta charset="utf-8"><title>rail</title>',
    '<style>#host{position:relative;width:720px;height:640px}#host .orbit-stage{position:absolute;inset:0}</style>',
    '<body style="margin:0"><section id="controls"></section><div id="host"></div>',
    '<script type="module">',
    "import {mountRecipe} from '/hosted/app/recipe-viewer.ts';",
    "import '/hosted/app/recipe.css';",
    "import {resolvePreset} from '/hosted/app/preset-resolve.ts';",
    'const host = document.querySelector("#host");',
    'const controls = document.querySelector("#controls");',
    'let stop = await mountRecipe(host, resolvePreset({title: "Fruit Stall Preset"}), controls);',
    'window.__switch = async (title) => { stop(); stop = await mountRecipe(host, resolvePreset({title}), controls); };',
    "document.documentElement.dataset.ready = '1';",
    '</script>',
  ].join('');
}

async function labels(page: Page) {
  return page.locator('.orbit-stage .viewport-tool').evaluateAll(nodes => nodes.map(node => node.getAttribute('aria-label')));
}

test('round parameter buttons sit inside the model view', {timeout: 180000}, async () => {
  const errors: string[] = [];
  let server: ViteDevServer | undefined;
  let browser: Browser | undefined;
  try {
    server = await createServer({
      configFile: false,
      root,
      logLevel: 'error',
      server: {host: '127.0.0.1', port: 0},
      plugins: [{
        name: 'rail-smoke',
        configureServer(dev) {
          dev.middlewares.use((req, res, next) => {
            if (req.url?.split('?')[0] !== '/rail-smoke') return next();
            res.setHeader('content-type', 'text/html; charset=utf-8');
            res.end(smokePage());
          });
        },
      }],
    });
    await server.listen();
    const origin = server.resolvedUrls?.local[0];
    assert.ok(origin);
    browser = await chromium.launch({
      executablePath: process.env.CHROME_PATH ?? '/usr/bin/google-chrome',
      headless: true,
      args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'],
    });
    const page = await browser.newPage({viewport: {width: 1100, height: 900}});
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(origin + 'rail-smoke');
    await page.waitForFunction(() => document.documentElement.dataset.ready === '1', undefined, {timeout: 90000});
    const fruit = await labels(page);
    for (const name of ['Stall type', 'Width', 'Depth', 'Front post height', 'Stripes', 'Goods', 'Layout seed', 'Timber', 'Cloth', 'Stripe', 'Crate']) {
      assert.ok(fruit.includes(name), fruit.join(', '));
    }
    assert.ok(fruit.filter(name => name === 'Goods').length >= 2);
    assert.equal(await page.locator('.orbit-stage .viewport-tool').count(), fruit.length);
    assert.equal(await page.locator('.model-controls').count(), 0);
    assert.equal(await page.locator('.viewport-popover').isVisible(), false);
    await page.getByRole('button', {name: 'Width', exact: true}).click();
    await page.locator('.viewport-popover-title', {hasText: 'Width'}).waitFor({state: 'visible'});
    const before = await page.locator('#width').inputValue();
    await page.locator('#width-slider').fill('4');
    await page.waitForFunction(() => (document.querySelector('#width') as HTMLInputElement).value === '4');
    await page.getByRole('button', {name: 'Reset Width'}).click();
    await page.waitForFunction(value => (document.querySelector('#width') as HTMLInputElement).value === value, before);
    await page.getByRole('button', {name: 'Stall type', exact: true}).click();
    await page.locator('.viewport-popover-title', {hasText: 'Stall type'}).waitFor({state: 'visible'});
    const stallBefore = await page.locator('#type').inputValue();
    const other = await page.locator('#type option').evaluateAll((nodes, current) => nodes.map(node => (node as HTMLOptionElement).value).find(value => value !== current), stallBefore);
    assert.ok(other);
    await page.locator('#type').selectOption(other);
    await page.waitForFunction(value => (document.querySelector('#type') as HTMLSelectElement).value === value, other);
    await page.getByRole('button', {name: 'Reset Stall type'}).click();
    await page.waitForFunction(value => (document.querySelector('#type') as HTMLSelectElement).value === value, stallBefore);
    await page.evaluate(async () => { await (window as unknown as {__switch: (title: string) => Promise<void>}).__switch('Smithy Preset'); });
    const smithy = await labels(page);
    assert.equal(smithy.includes('Stall type'), false);
    for (const name of ['Anvil length', 'Stand height', 'Horns', 'Iron', 'Wood']) assert.ok(smithy.includes(name), smithy.join(', '));
    assert.deepEqual(errors, []);
  } finally {
    await browser?.close();
    await server?.close();
  }
});
