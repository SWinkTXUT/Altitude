// Renders icons/logo.svg to the PNG sizes iOS and the web manifest need.
// Usage: node tools/render_icons.mjs   (needs Playwright + Chromium)
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const dir = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'icons');
const svg = fs.readFileSync(path.join(dir, 'logo.svg'), 'utf8');
const browser = await chromium.launch();
for (const size of [180, 192, 512, 1024]) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(`<body style="margin:0">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body>`);
  await page.screenshot({ path: path.join(dir, `icon-${size}.png`) });
  await page.close();
}
await browser.close();
