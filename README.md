# Digitan’s Guide to Luminous Gradients & Architectural Shapes

An interactive 30-slide HTML/CSS visual design reference and presentation deck covering multi-stop gradients, container silhouettes, elevation tokens, and light/dark UI component patterns—including Aurora systems, frosted glassmorphism, executive telemetry, deep-tech HUDs, warm clay organics, and editorial neo-brutalism.

## Features

- **Interactive Presentation Toolbar**: Floating centered HUD with `Prev`/`Next` navigation (`01 / 30`), fullscreen **Present** mode (`F`), **Scroll All / Single Slide** view toggle (`M`), **Light / Dark** outer backdrop and cover theme switcher (`T`), keyboard/touch-swipe/mousewheel navigation, and auto-fade inactivity behavior.
- **Pre-Built & Live Exports**:
  - **`.PPTX` Export**: Serves theme-matched pre-built PowerPoint decks (`exports/Digitan-Guide-Dark.pptx` / `exports/Digitan-Guide-Light.pptx`) or falls back dynamically to live conversion via [`extended-pptxjs`](https://github.com/ramadhanaraz/extended-pptxjs) (`HtmlSlideConverter`).
  - **`.PDF` Export**: Downloads the latest CI-rendered `1280×720` PDF on GitHub Pages or falls back to browser print locally.
- **Modular Slide Architecture**: Individual slides live in `slides/` and compile into a unified standalone `index.html` that works both on GitHub Pages and offline via `file://`.

## Repository Structure

```text
├── slides/                 # 30 modular slide fragments (00-cover.html .. 29-closing-cover.html)
├── src/shell.html          # Outer HTML template with <!-- SLIDES_OUTLET -->
├── assets/
│   ├── css/styles.css      # Theme variables, stage/scroll layout, floating HUD, and print CSS
│   ├── js/navigation.js    # Floating toolbar injection, navigation, theme, and scroll tracking
│   ├── js/exporter.js      # Pre-built + live HtmlSlideConverter PPTX and PDF export logic
│   └── ...                 # Local cover mascot and inspiration tool thumbnails
├── scripts/
│   ├── build-deck.mjs      # Zero-dependency compiler assembling index.html from slides/
│   └── export-artifacts.mjs# Playwright script generating PDF and Dark/Light PPTX artifacts
├── exports/                # Pre-built Dark/Light .pptx and timestamped WIB .pdf/.pptx artifacts
├── index.html              # Compiled standalone presentation deck
└── .github/workflows/      # CI workflow building index.html and exports/ on push to main
```

## Local Build

```bash
npm run build
```

This runs `node scripts/build-deck.mjs` to assemble `slides/*.html` into `src/shell.html` and write the standalone `index.html`.

## License

Licensed under the **GNU General Public License v3.0 (GPL-3.0)**. See [LICENSE](./LICENSE) for details.
