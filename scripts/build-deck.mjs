import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const shellPath = path.join(rootDir, 'src', 'shell.html');
const slidesDir = path.join(rootDir, 'slides');
const outputPath = path.join(rootDir, 'index.html');
const chibiPath = path.join(rootDir, 'assets', 'digitan-chibi.png');

const OUTLET_TOKEN = '<!-- SLIDES_OUTLET -->';

function buildBase64FallbackMap() {
  const map = new Map();
  if (fs.existsSync(chibiPath)) {
    const b64 = fs.readFileSync(chibiPath).toString('base64');
    map.set('assets/digitan-chibi.png', `data:image/png;base64,${b64}`);
  }
  return map;
}

function attachImageFallbacks(html, fallbackMap) {
  let result = html;
  for (const [assetPath, dataUri] of fallbackMap.entries()) {
    const escapedPath = assetPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const imgPattern = new RegExp(
      `<img([^>]*\\bsrc=["']${escapedPath}["'][^>]*)>`,
      'g'
    );
    result = result.replace(imgPattern, (fullMatch, attrs) => {
      if (attrs.includes('data-fallback-src=')) return fullMatch;
      return `<img${attrs} data-fallback-src="${dataUri}" onerror="if(this.dataset.fallbackSrc&amp;&amp;this.src!==this.dataset.fallbackSrc)this.src=this.dataset.fallbackSrc">`;
    });
  }
  return result;
}

function main() {
  if (!fs.existsSync(shellPath)) {
    throw new Error(`Missing shell template: ${shellPath}`);
  }
  if (!fs.existsSync(slidesDir)) {
    throw new Error(`Missing slides directory: ${slidesDir}`);
  }

  const shell = fs.readFileSync(shellPath, 'utf8');
  if (!shell.includes(OUTLET_TOKEN)) {
    throw new Error(`Shell template must contain "${OUTLET_TOKEN}"`);
  }

  const slideFiles = fs
    .readdirSync(slidesDir)
    .filter((name) => name.endsWith('.html'))
    .sort((a, b) => a.localeCompare(b, 'en'));

  if (!slideFiles.length) {
    throw new Error(`No slide .html files found in ${slidesDir}`);
  }

  const fallbackMap = buildBase64FallbackMap();

  const slideSections = slideFiles.map((fileName) => {
    const raw = fs.readFileSync(path.join(slidesDir, fileName), 'utf8').trim();
    const withFallbacks = attachImageFallbacks(raw, fallbackMap);
    return withFallbacks
      .split('\n')
      .map((line) => (line.length ? `  ${line}` : line))
      .join('\n');
  });

  const compiled = shell.replace(OUTLET_TOKEN, slideSections.join('\n\n'));
  fs.writeFileSync(outputPath, compiled, 'utf8');

  console.log(
    `Built index.html from ${slideFiles.length} slides (${(compiled.length / 1024).toFixed(1)} KB)`
  );
}

main();
