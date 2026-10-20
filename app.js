(function () {
  "use strict";

  const screens = document.getElementById("screens");
  const track = document.getElementById("track");
  const footer = document.querySelector(".site-footer");
  const frames = Array.from(track.children);
  const segments = Array.from(document.getElementById("progress").children);
  const total = frames.length;

  let current = 0;
  let viewportWidth = screens.getBoundingClientRect().width;

  // Drag state
  let dragging = false;
  let startX = 0;
  let startY = 0;
  let startTime = 0;
  let deltaX = 0;
  let axisLocked = null; // "x" | "y" | null
  let interactiveTarget = false;

  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }

  function updateProgress() {
    segments.forEach((seg, i) => {
      seg.classList.toggle("done", i < current);
      seg.classList.toggle("active", i === current);
    });
    if (footer) {
      footer.classList.toggle("footer-hidden", frames[current].classList.contains("frame-last"));
    }
  }

  function setTrackTransform(px, withTransition) {
    track.style.transition = withTransition ? "transform 0.38s cubic-bezier(.22,.61,.36,1)" : "none";
    track.style.transform = `translate3d(${px}px,0,0)`;
  }

  function render(withTransition) {
    viewportWidth = screens.getBoundingClientRect().width;
    setTrackTransform(-current * viewportWidth, withTransition);
    updateProgress();
  }

  function goTo(index) {
    current = clamp(index, 0, total - 1);
    render(true);
    if (current === mapFrameIndex) animateMapPins();
  }

  function next() {
    goTo(current + 1);
  }

  function prev() {
    goTo(current - 1);
  }

  // ---------- Pointer handling: split tap (left = back, right = forward) + swipe ----------
  function onPointerDown(e) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    interactiveTarget = !!e.target.closest("a, button, .no-advance");
    dragging = true;
    axisLocked = null;
    startX = e.clientX;
    startY = e.clientY;
    startTime = Date.now();
    deltaX = 0;
    viewportWidth = screens.getBoundingClientRect().width;
  }

  function onPointerMove(e) {
    if (!dragging || interactiveTarget) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;

    if (axisLocked === null) {
      if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
        axisLocked = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
      }
    }

    if (axisLocked === "y") return; // let vertical gesture pass

    if (axisLocked === "x") {
      e.preventDefault();
      deltaX = dx;
      let resisted = deltaX;
      if ((current === 0 && deltaX > 0) || (current === total - 1 && deltaX < 0)) {
        resisted = deltaX * 0.3;
      }
      setTrackTransform(-current * viewportWidth + resisted, false);
    }
  }

  function onPointerUp(e) {
    if (!dragging) return;
    dragging = false;

    if (interactiveTarget) {
      interactiveTarget = false;
      return;
    }

    const elapsed = Date.now() - startTime;

    if (axisLocked === "x") {
      const threshold = viewportWidth * 0.16;
      const fast = Math.abs(deltaX) > 55 && elapsed < 250;
      if (deltaX < -threshold || (fast && deltaX < 0)) {
        next();
      } else if (deltaX > threshold || (fast && deltaX > 0)) {
        prev();
      } else {
        render(true);
      }
      return;
    }

    if (axisLocked === "y") {
      return;
    }

    // Negligible movement: split tap. Right half of the VIEWPORT -> forward, left half -> back.
    if (elapsed < 400) {
      const rect = screens.getBoundingClientRect();
      const midpoint = rect.left + rect.width / 2;
      if (e.clientX >= midpoint) {
        next();
      } else {
        prev();
      }
    }
  }

  screens.addEventListener("pointerdown", onPointerDown);
  screens.addEventListener("pointermove", onPointerMove, { passive: false });
  window.addEventListener("pointerup", onPointerUp);
  window.addEventListener("pointercancel", () => {
    dragging = false;
    render(true);
  });

  window.addEventListener("resize", () => render(false));

  // ---------- Map pins: tap or hover shows the city label ----------
  const pins = document.querySelectorAll(".map-pin");
  pins.forEach((pin) => {
    pin.addEventListener("click", (e) => {
      e.stopPropagation();
      const wasActive = pin.classList.contains("pin-active");
      pins.forEach((p) => p.classList.remove("pin-active"));
      if (!wasActive) pin.classList.add("pin-active");
    });
  });

  // ---------- Map pins: drop in one by one, in a fixed order, with a 0.4s
  // stagger, the first time the map frame becomes active. Runs once; never
  // repeats on later visits to the frame. ----------
  const mapFrameIndex = frames.findIndex((f) => f.classList.contains("frame-map"));
  const MAP_PIN_ORDER = ["New York", "Kuwait City", "Riyadh", "San Francisco", "Mexico City", "Santiago"];
  let mapPinsAnimated = false;

  function animateMapPins() {
    if (mapPinsAnimated) return;
    mapPinsAnimated = true;
    MAP_PIN_ORDER.forEach((name, i) => {
      const pin = document.querySelector(`.map-pin[data-name="${name}"]`);
      if (!pin) return;
      setTimeout(() => pin.classList.add("pin-dropped"), i * 400);
    });
  }

  // ---------- Logo fallback: if a card's logo image fails to load, drop the
  // image slot entirely so the caption/text stands alone rather than showing
  // a broken-image icon or empty box. ----------
  document.querySelectorAll(".proof-logo img, .cred-logo img").forEach((img) => {
    img.addEventListener("error", () => {
      const slot = img.closest(".proof-logo, .cred-logo");
      if (slot) slot.remove();
    });
  });

  // ---------- Frame 1: keep "Tap right to continue" pinned just above the
  // footer by measuring the footer's actual rendered height, rather than a
  // guessed fixed offset, so it never overlaps the footer at any viewport
  // size or safe-area inset. ----------
  const tapHint = document.getElementById("tap-hint");

  function syncTapHintPosition() {
    if (!tapHint || !footer) return;
    tapHint.style.bottom = footer.offsetHeight + 12 + "px";
  }

  if (tapHint && footer) {
    syncTapHintPosition();
    window.addEventListener("resize", syncTapHintPosition);
  }

  // ---------- Frame 1: size the cover photo to exactly fill the space left
  // over above the text block, so there's zero wasted whitespace at any
  // device height: photo = frame height - text block - the space reserved
  // below the text for the tap-hint. "Frame height" is the cover frame's
  // own rendered height (screens.getBoundingClientRect(), same element
  // used elsewhere in this file for viewportWidth), which already excludes
  // the footer, since the footer is a sibling below .screens, not inside
  // the frame. The reserved space below the text is the tap-hint's own
  // distance up from the frame's bottom edge (footer height + the 12px
  // clearance above the footer + the tap-hint's own line height) plus 8px
  // of air, so the tap-hint never overlaps the subtitle's last line. ----------
  const coverPhoto = document.querySelector(".cover-photo");
  const coverText = document.querySelector(".cover-text");

  function syncCoverPhotoHeight() {
    if (!coverPhoto || !coverText || !footer) return;
    const frameHeight = screens.getBoundingClientRect().height;
    const tapHintReserve = tapHint ? footer.offsetHeight + 12 + tapHint.offsetHeight + 8 : footer.offsetHeight + 24;
    const available = frameHeight - coverText.offsetHeight - tapHintReserve;
    coverPhoto.style.height = Math.max(0, available) + "px";
  }

  if (coverPhoto && coverText && footer) {
    syncCoverPhotoHeight();
    window.addEventListener("resize", syncCoverPhotoHeight);
    // The name/subtitle use webfonts loaded with font-display: swap, so the
    // initial measurement can be taken against fallback-font metrics; redo
    // it once the real fonts are in so the reserved gap stays exact.
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(syncCoverPhotoHeight);
    }
  }

  render(false);
})();
