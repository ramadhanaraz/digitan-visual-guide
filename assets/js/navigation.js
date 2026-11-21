(() => {
  const slides = Array.from(document.querySelectorAll('.slide, .slide-container'));
  if (!slides.length) return;

  let current = 0;
  let isStage = true;
  let isLightTheme = false;
  let isExporting = false;
  let idleTimer = null;
  let isHovered = false;
  let wheelLocked = false;
  let scrollTicking = false;

  const pad2 = (n) => String(n).padStart(2, '0');

  // Inject Floating Navigation Bar with data-pptx-ignore so HtmlSlideConverter skips it
  const existingZone = document.getElementById('deck-hud-zone');
  if (existingZone) existingZone.remove();

  const hudZone = document.createElement('div');
  hudZone.id = 'deck-hud-zone';
  hudZone.setAttribute('data-pptx-ignore', '');
  hudZone.innerHTML = `
    <nav id="deck-hud" aria-label="Presentation Toolbar">
      <button type="button" id="hud-prev" class="hud-btn" title="Previous Slide (←)" aria-label="Previous Slide">
        <i class="fa-solid fa-chevron-left" aria-hidden="true"></i>
        <span class="hud-label">Prev</span>
      </button>
      <span id="deck-counter" aria-live="polite">01 / ${pad2(slides.length)}</span>
      <button type="button" id="hud-next" class="hud-btn" title="Next Slide (→)" aria-label="Next Slide">
        <span class="hud-label">Next</span>
        <i class="fa-solid fa-chevron-right" aria-hidden="true"></i>
      </button>
      <span class="hud-sep" aria-hidden="true"></span>
      <button type="button" id="hud-present" class="hud-btn" title="Present Fullscreen (F)" aria-label="Present Fullscreen">
        <i class="fa-solid fa-play" aria-hidden="true"></i>
        <span class="hud-label">Present</span>
      </button>
      <button type="button" id="hud-mode" class="hud-btn" title="Switch to Scroll All (M)" aria-label="Toggle Scroll All / Single Slide">
        <i class="fa-solid fa-layer-group" aria-hidden="true"></i>
        <span class="hud-label">Scroll All</span>
      </button>
      <button type="button" id="hud-theme" class="hud-btn" title="Switch to Light Theme (T)" aria-label="Toggle Theme">
        <i class="fa-solid fa-sun" aria-hidden="true"></i>
        <span class="hud-label">Light</span>
      </button>
      <span class="hud-sep" aria-hidden="true"></span>
      <button type="button" id="hud-pptx" class="hud-btn hud-btn-pptx" title="Export 16:9 PowerPoint (.pptx)" aria-label="Export PPTX">
        <i class="fa-solid fa-file-powerpoint" aria-hidden="true"></i>
        <span class="hud-label">.PPTX</span>
      </button>
      <button type="button" id="hud-pdf" class="hud-btn hud-btn-pdf" title="Save PDF" aria-label="Save PDF">
        <i class="fa-solid fa-file-pdf" aria-hidden="true"></i>
        <span class="hud-label">.PDF</span>
      </button>
    </nav>
  `;
  document.body.appendChild(hudZone);

  const hud = document.getElementById('deck-hud');
  const counterEl = document.getElementById('deck-counter');
  const prevBtn = document.getElementById('hud-prev');
  const nextBtn = document.getElementById('hud-next');
  const presentBtn = document.getElementById('hud-present');
  const modeBtn = document.getElementById('hud-mode');
  const themeBtn = document.getElementById('hud-theme');
  const pptxBtn = document.getElementById('hud-pptx');
  const pdfBtn = document.getElementById('hud-pdf');

  // 1. Auto-Fade & Wake Logic (Desktop Hover + Mobile Tap-to-Wake)
  function scheduleIdle(delay = 2500) {
    clearTimeout(idleTimer);
    if (isHovered || isExporting) return;
    idleTimer = setTimeout(() => {
      hud.classList.add('hud-idle');
    }, delay);
  }

  function wakeHud(delay = 2800) {
    hud.classList.remove('hud-idle');
    scheduleIdle(delay);
  }

  hudZone.addEventListener('mouseenter', () => {
    isHovered = true;
    clearTimeout(idleTimer);
    hud.classList.remove('hud-idle');
  });

  hudZone.addEventListener('mouseleave', () => {
    isHovered = false;
    scheduleIdle(1600);
  });

  hudZone.addEventListener(
    'click',
    (e) => {
      if (hud.classList.contains('hud-idle')) {
        e.preventDefault();
        e.stopPropagation();
        wakeHud(3200);
        return;
      }
      wakeHud(3200);
    },
    true
  );

  // 2. Slide Scaling, Counter & Navigation
  function updateCounter(index) {
    counterEl.textContent = `${pad2(index + 1)} / ${pad2(slides.length)}`;
    prevBtn.disabled = index <= 0;
    nextBtn.disabled = index >= slides.length - 1;
  }

  function scaleActiveSlide() {
    slides.forEach((s, idx) => {
      if (!isStage) {
        s.style.transform = '';
        return;
      }
      if (idx === current) {
        const scale = Math.min(window.innerWidth / 1280, window.innerHeight / 720);
        s.style.transform = `translate(-50%, -50%) scale(${scale})`;
      } else {
        s.style.transform = '';
      }
    });
  }

  function showSlide(index, updateHash = true) {
    current = Math.max(0, Math.min(slides.length - 1, index));
    slides.forEach((s, idx) => s.classList.toggle('active-slide', idx === current));
    updateCounter(current);
    scaleActiveSlide();
    if (!isStage) {
      slides[current].scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else if (updateHash) {
      history.replaceState(null, '', `#slide-${pad2(current + 1)}`);
    }
  }

  // 3. Scroll Mode Center-of-Viewport Page Tracking (PC & Mobile)
  function syncSlideFromScroll() {
    scrollTicking = false;
    if (isStage) return;

    const viewportCenter = window.innerHeight / 2;
    let closestIdx = current;
    let minDistance = Infinity;

    slides.forEach((slide, idx) => {
      const rect = slide.getBoundingClientRect();
      const slideCenter = rect.top + rect.height / 2;
      const dist = Math.abs(slideCenter - viewportCenter);
      if (dist < minDistance) {
        minDistance = dist;
        closestIdx = idx;
      }
    });

    if (closestIdx !== current) {
      current = closestIdx;
      slides.forEach((s, idx) => s.classList.toggle('active-slide', idx === current));
      updateCounter(current);
      history.replaceState(null, '', `#slide-${pad2(current + 1)}`);
    }
  }

  window.addEventListener(
    'scroll',
    () => {
      if (isStage || scrollTicking) return;
      scrollTicking = true;
      requestAnimationFrame(syncSlideFromScroll);
    },
    { passive: true }
  );

  // 4. Single Slide / Present Mode Mouse Wheel Navigation (360ms debounced)
  window.addEventListener(
    'wheel',
    (e) => {
      if (!isStage) return;
      if (e.ctrlKey || e.metaKey) return;
      if (e.target && e.target.isContentEditable) return;

      e.preventDefault();
      if (wheelLocked || Math.abs(e.deltaY) < 12) return;

      wheelLocked = true;
      showSlide(e.deltaY > 0 ? current + 1 : current - 1);
      setTimeout(() => {
        wheelLocked = false;
      }, 360);
    },
    { passive: false }
  );

  // 5. Mode, Presentation (Fullscreen), and Theme Toggles
  function setMode(stageEnabled) {
    isStage = Boolean(stageEnabled);
    document.body.classList.toggle('stage-mode', isStage);

    const icon = modeBtn.querySelector('i');
    const label = modeBtn.querySelector('.hud-label');
    if (isStage) {
      icon.className = 'fa-solid fa-layer-group';
      label.textContent = 'Scroll All';
      modeBtn.title = 'Switch to Scroll All (M)';
      modeBtn.classList.remove('is-active');
    } else {
      icon.className = 'fa-solid fa-display';
      label.textContent = 'Single Slide';
      modeBtn.title = 'Switch to Single Slide (M)';
      modeBtn.classList.add('is-active');
    }

    showSlide(current, false);
    if (!isStage) {
      requestAnimationFrame(syncSlideFromScroll);
    }
  }

  function updatePresentButton() {
    const isFs = Boolean(document.fullscreenElement);
    const icon = presentBtn.querySelector('i');
    const label = presentBtn.querySelector('.hud-label');
    if (isFs) {
      icon.className = 'fa-solid fa-compress';
      label.textContent = 'Exit';
      presentBtn.title = 'Exit Presentation (F / Esc)';
      presentBtn.classList.add('is-active');
    } else {
      icon.className = 'fa-solid fa-play';
      label.textContent = 'Present';
      presentBtn.title = 'Present Fullscreen (F)';
      presentBtn.classList.remove('is-active');
    }
  }

  function togglePresentation() {
    if (!document.fullscreenElement) {
      if (!isStage) setMode(true);
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
    } else if (document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }
  }

  document.addEventListener('fullscreenchange', updatePresentButton);

  function applyTheme(lightEnabled, persist = true) {
    isLightTheme = Boolean(lightEnabled);
    document.body.classList.toggle('theme-light', isLightTheme);

    const icon = themeBtn.querySelector('i');
    const label = themeBtn.querySelector('.hud-label');
    if (isLightTheme) {
      icon.className = 'fa-solid fa-moon';
      label.textContent = 'Dark';
      themeBtn.title = 'Switch to Dark Theme (T)';
      themeBtn.classList.add('is-active');
    } else {
      icon.className = 'fa-solid fa-sun';
      label.textContent = 'Light';
      themeBtn.title = 'Switch to Light Theme (T)';
      themeBtn.classList.remove('is-active');
    }

    if (persist) {
      try {
        localStorage.setItem('digitan-deck-theme', isLightTheme ? 'light' : 'dark');
      } catch (_) {}
    }
  }

  // 6. Export Button Handlers (delegated to DigitanExporter)
  async function handleExportPptx() {
    if (isExporting || !globalThis.DigitanExporter) return;
    isExporting = true;
    pptxBtn.disabled = true;
    const label = pptxBtn.querySelector('.hud-label');
    const originalLabel = label.textContent;
    try {
      await globalThis.DigitanExporter.exportPptx({
        onStatus: (txt) => {
          label.textContent = txt;
        },
        onProgress: (done, total) => {
          label.textContent = `${pad2(done)}/${pad2(total)}`;
        },
      });
    } catch (err) {
      console.error('PPTX export error:', err);
      alert('Unable to export .PPTX right now. Please check your network connection.');
    } finally {
      isExporting = false;
      pptxBtn.disabled = false;
      label.textContent = originalLabel;
      scheduleIdle(2500);
    }
  }

  async function handleExportPdf() {
    if (!globalThis.DigitanExporter) {
      window.print();
      return;
    }
    const label = pdfBtn.querySelector('.hud-label');
    const originalLabel = label.textContent;
    try {
      await globalThis.DigitanExporter.exportPdf({
        onStatus: (txt) => {
          label.textContent = txt;
        },
      });
    } finally {
      label.textContent = originalLabel;
    }
  }

  // 7. Button, Keyboard & Touch Listeners
  prevBtn.addEventListener('click', () => showSlide(current - 1));
  nextBtn.addEventListener('click', () => showSlide(current + 1));
  presentBtn.addEventListener('click', togglePresentation);
  modeBtn.addEventListener('click', () => setMode(!isStage));
  themeBtn.addEventListener('click', () => applyTheme(!isLightTheme));
  pptxBtn.addEventListener('click', handleExportPptx);
  pdfBtn.addEventListener('click', handleExportPdf);

  window.addEventListener('keydown', (e) => {
    if (e.target && e.target.isContentEditable) return;
    if (['ArrowRight', 'ArrowDown', 'PageDown', ' '].includes(e.key)) {
      if (isStage || e.key === 'ArrowRight') {
        e.preventDefault();
        showSlide(current + 1);
      }
    } else if (['ArrowLeft', 'ArrowUp', 'PageUp'].includes(e.key)) {
      if (isStage || e.key === 'ArrowLeft') {
        e.preventDefault();
        showSlide(current - 1);
      }
    } else if (e.key === 'Home') {
      e.preventDefault();
      showSlide(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      showSlide(slides.length - 1);
    } else if (e.key === 'f' || e.key === 'F') {
      e.preventDefault();
      togglePresentation();
    } else if (e.key === 'm' || e.key === 'M') {
      e.preventDefault();
      setMode(!isStage);
    } else if (e.key === 't' || e.key === 'T') {
      e.preventDefault();
      applyTheme(!isLightTheme);
    }
  });

  let touchStartX = 0;
  window.addEventListener(
    'touchstart',
    (e) => {
      touchStartX = e.changedTouches[0].screenX;
    },
    { passive: true }
  );

  window.addEventListener(
    'touchend',
    (e) => {
      if (!isStage) return;
      const deltaX = e.changedTouches[0].screenX - touchStartX;
      if (Math.abs(deltaX) > 45) {
        showSlide(deltaX < 0 ? current + 1 : current - 1);
      }
    },
    { passive: true }
  );

  window.addEventListener('resize', scaleActiveSlide);

  // Initialize Theme, URL Hash, Mode & Auto-Hide
  try {
    const savedTheme = localStorage.getItem('digitan-deck-theme');
    applyTheme(savedTheme === 'light', false);
  } catch (_) {
    applyTheme(false, false);
  }

  const hashMatch = window.location.hash.match(/^#slide-(\d+)$/);
  if (hashMatch) {
    const target = parseInt(hashMatch[1], 10) - 1;
    if (target >= 0 && target < slides.length) current = target;
  }

  updatePresentButton();
  setMode(true);
  scheduleIdle(2500);

  globalThis.DigitanDeck = {
    getSlides: () => slides,
    getTheme: () => (isLightTheme ? 'Light' : 'Dark'),
    setTheme: applyTheme,
    setMode,
    showSlide,
  };
})();
