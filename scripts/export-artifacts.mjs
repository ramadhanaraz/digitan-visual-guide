import fs from 'node:fs';
import http from 'node:http';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const exportsDir = path.join(rootDir, 'exports');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.pdf': 'application/pdf',
};

function getWibFileTimestamp(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const map = {};
  for (const p of parts) map[p.type] = p.value;
  return `${map.year}${map.month}${map.day}-${map.hour}${map.minute}WIB`;
}

function startStaticServer(dir) {
  const server = http.createServer((req, res) => {
    const reqPath = decodeURIComponent((req.url || '/').split('?')[0]);
    const safeRel = reqPath === '/' ? 'index.html' : reqPath.replace(/^\/+/, '');
    const filePath = path.resolve(dir, safeRel);
    if (!filePath.startsWith(dir)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }
    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end('Not Found');
        return;
      }
      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
      res.end(data);
    });
  });

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      resolve({ server, url: `http://127.0.0.1:${addr.port}` });
    });
  });
}

async function loadPlaywright() {
  try {
    return await import('playwright');
  } catch (_) {
    try {
      return await import('playwright-core');
    } catch (_) {
      const require = createRequire(import.meta.url);
      try {
        return require('playwright');
      } catch (_) {
        return require('playwright-core');
      }
    }
  }
}

async function main() {
  const fileTs = process.env.FILE_TS || getWibFileTimestamp();
  const skipPdf = process.env.SKIP_PDF === '1';

  fs.mkdirSync(exportsDir, { recursive: true });

  const { server, url } = await startStaticServer(rootDir);
  const { chromium } = await loadPlaywright();

  const launchOpts = {};
  if (process.env.CHROMIUM_EXECUTABLE_PATH) {
    launchOpts.executablePath = process.env.CHROMIUM_EXECUTABLE_PATH;
  } else if (fs.existsSync('/usr/bin/google-chrome') && !process.env.CI) {
    launchOpts.executablePath = '/usr/bin/google-chrome';
  } else if (fs.existsSync('/usr/bin/chromium') && !process.env.CI) {
    launchOpts.executablePath = '/usr/bin/chromium';
  }

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-gpu'],
    ...launchOpts,
  });

  try {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      ignoreHTTPSErrors: process.env.IGNORE_HTTPS_ERRORS === '1',
    });
    const page = await context.newPage();

    page.on('pageerror', (err) => {
      console.error('Page error:', err);
    });

    await page.goto(`${url}/index.html`, { waitUntil: 'networkidle' });
    await page.waitForFunction(
      () =>
        typeof globalThis.DigitanDeck === 'object' &&
        typeof globalThis.DigitanExporter === 'object' &&
        typeof globalThis.HtmlSlideConverter === 'function',
      null,
      { timeout: 30000 }
    );

    if (!skipPdf) {
      for (const f of fs.readdirSync(exportsDir)) {
        if (/^Digitan-Guide-\d{8}-\d{4}WIB\.pdf$/.test(f)) {
          fs.unlinkSync(path.join(exportsDir, f));
        }
      }
      const pdfPath = path.join(exportsDir, `Digitan-Guide-${fileTs}.pdf`);
      await page.evaluate(() => globalThis.DigitanDeck.setTheme(false, false));
      await page.waitForTimeout(250);
      await page.pdf({
        path: pdfPath,
        width: '1280px',
        height: '720px',
        printBackground: true,
        margin: { top: '0px', right: '0px', bottom: '0px', left: '0px' },
      });
      console.log(`Generated PDF: ${path.relative(rootDir, pdfPath)}`);
    }

    for (const theme of ['Dark', 'Light']) {
      const isLight = theme === 'Light';
      await page.evaluate((light) => {
        globalThis.DigitanDeck.setTheme(light, false);
      }, isLight);
      await page.waitForTimeout(300);

      const base64 = await page.evaluate(async () => {
        const pptx = await globalThis.DigitanExporter.convertLiveDeck();
        const arrBuf = await pptx.exportBuffer();
        const bytes = new Uint8Array(arrBuf);
        const chunkSize = 0x8000;
        const chunks = [];
        for (let i = 0; i < bytes.length; i += chunkSize) {
          chunks.push(String.fromCharCode(...bytes.subarray(i, i + chunkSize)));
        }
        return btoa(chunks.join(''));
      });

      const buffer = Buffer.from(base64, 'base64');

      for (const f of fs.readdirSync(exportsDir)) {
        if (new RegExp(`^Digitan-Guide-${theme}-\\d{8}-\\d{4}WIB\\.pptx$`).test(f)) {
          fs.unlinkSync(path.join(exportsDir, f));
        }
      }

      const stablePath = path.join(exportsDir, `Digitan-Guide-${theme}.pptx`);
      const archivePath = path.join(exportsDir, `Digitan-Guide-${theme}-${fileTs}.pptx`);
      fs.writeFileSync(stablePath, buffer);
      fs.writeFileSync(archivePath, buffer);

      console.log(
        `Generated ${theme} PPTX: ${path.relative(rootDir, stablePath)} & ${path.relative(rootDir, archivePath)} (${(buffer.length / 1024).toFixed(1)} KB)`
      );
    }
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
