(() => {
  const EXTENDED_PPTX_CDN =
    'https://ramadhanaraz.github.io/extended-pptxjs/dist/extended-pptxjs.bundle.js';

  let bundleLoadPromise = null;

  function loadExtendedPptxBundle() {
    if (
      typeof globalThis.ExtendedPptxJS === 'function' &&
      typeof globalThis.HtmlSlideConverter === 'function'
    ) {
      return Promise.resolve();
    }
    if (bundleLoadPromise) return bundleLoadPromise;

    bundleLoadPromise = new Promise((resolve, reject) => {
      const existing = Array.from(document.scripts).find(
        (s) => s.src && s.src.includes('extended-pptxjs.bundle.js')
      );
      if (existing) {
        existing.addEventListener('load', () => resolve(), { once: true });
        existing.addEventListener(
          'error',
          () => reject(new Error('Failed to load extended-pptxjs bundle.')),
          { once: true }
        );
        // If already finished loading between checks:
        setTimeout(() => {
          if (
            typeof globalThis.ExtendedPptxJS === 'function' &&
            typeof globalThis.HtmlSlideConverter === 'function'
          ) {
            resolve();
          }
        }, 50);
        return;
      }

      const script = document.createElement('script');
      script.src = EXTENDED_PPTX_CDN;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () =>
        reject(new Error('Failed to load extended-pptxjs bundle from CDN.'));
      document.head.appendChild(script);
    });

    return bundleLoadPromise;
  }

  function getActiveTheme() {
    return document.body.classList.contains('theme-light') ? 'Light' : 'Dark';
  }

  function formatWibTimestamp(date = new Date()) {
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

  function triggerDownload(href, filename) {
    const link = document.createElement('a');
    link.href = href;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  async function prepareImagesForExport(slideElements) {
    const restores = [];
    const isFileProtocol = window.location.protocol === 'file:';

    for (const slideEl of slideElements) {
      const imgs = slideEl.querySelectorAll('img');
      for (const img of imgs) {
        const fallback = img.getAttribute('data-fallback-src');
        if (!fallback) continue;
        const needsFallback =
          isFileProtocol || !img.complete || img.naturalWidth === 0;
        if (needsFallback && img.getAttribute('src') !== fallback) {
          const prevSrc = img.getAttribute('src');
          img.setAttribute('src', fallback);
          await new Promise((resolve) => {
            if (img.complete) return resolve();
            img.addEventListener('load', resolve, { once: true });
            img.addEventListener('error', resolve, { once: true });
          });
          restores.push(() => {
            if (prevSrc !== null) img.setAttribute('src', prevSrc);
          });
        }
      }
    }

    return () => {
      for (const restore of restores) restore();
    };
  }

  async function convertLiveDeck({ onProgress } = {}) {
    await loadExtendedPptxBundle();

    const slides = Array.from(
      document.querySelectorAll('.slide, .slide-container')
    );
    if (!slides.length) {
      throw new Error('No slides found to export.');
    }

    const restoreImages = await prepareImagesForExport(slides);
    try {
      const pptx = new globalThis.ExtendedPptxJS();
      const converter = new globalThis.HtmlSlideConverter(pptx, {
        glassMode: 'native-translucent',
        fontMap: {
          'Plus Jakarta Sans': 'Calibri',
          'Space Grotesk': 'Arial',
        },
      });

      for (let i = 0; i < slides.length; i++) {
        if (typeof onProgress === 'function') {
          onProgress(i + 1, slides.length);
        }
        await converter.convertSlide(slides[i]);
      }

      return pptx;
    } finally {
      restoreImages();
    }
  }

  async function exportPptx({ onProgress, onStatus } = {}) {
    const theme = getActiveTheme();
    const prebuiltFilename = `Digitan-Guide-${theme}.pptx`;
    const prebuiltUrl = `./exports/${prebuiltFilename}`;

    if (window.location.protocol !== 'file:') {
      try {
        if (typeof onStatus === 'function') onStatus('Checking...');
        const res = await fetch(prebuiltUrl, {
          method: 'HEAD',
          cache: 'no-store',
        });
        if (res.ok) {
          triggerDownload(prebuiltUrl, prebuiltFilename);
          return { mode: 'prebuilt', fileName: prebuiltFilename };
        }
      } catch (_) {
        // Pre-built file unavailable -> fall through to live HtmlSlideConverter
      }
    }

    if (typeof onStatus === 'function') onStatus('Loading...');
    const pptx = await convertLiveDeck({ onProgress });
    const fileName = `Digitan-Guide-${theme}-${formatWibTimestamp()}.pptx`;
    if (typeof onStatus === 'function') onStatus('Saving...');
    await pptx.downloadBrowserFile(fileName);
    return { mode: 'live', fileName };
  }

  async function exportPdf({ onStatus } = {}) {
    if (typeof onStatus === 'function') onStatus('PDF...');
    try {
      if (window.location.hostname.endsWith('github.io')) {
        const owner = window.location.hostname.split('.')[0];
        const repo = window.location.pathname.split('/').filter(Boolean)[0];
        if (owner && repo) {
          const res = await fetch(
            `https://api.github.com/repos/${owner}/${repo}/contents/exports`
          );
          if (res.ok) {
            const files = await res.json();
            const pdfs = Array.isArray(files)
              ? files
                  .filter((f) => f.name && f.name.endsWith('.pdf'))
                  .sort((a, b) => {
                    const aMatch = a.name.startsWith('Digitan-Guide-') ? 1 : 0;
                    const bMatch = b.name.startsWith('Digitan-Guide-') ? 1 : 0;
                    if (aMatch !== bMatch) return bMatch - aMatch;
                    return b.name.localeCompare(a.name);
                  })
              : [];
            if (pdfs.length > 0) {
              triggerDownload(`./exports/${pdfs[0].name}`, pdfs[0].name);
              return { mode: 'prebuilt', fileName: pdfs[0].name };
            }
          }
        }
      }
    } catch (_) {}

    window.print();
    return { mode: 'print' };
  }

  globalThis.DigitanExporter = {
    exportPptx,
    exportPdf,
    convertLiveDeck,
    getActiveTheme,
  };
})();
