(function () {
  "use strict";

  const isArabic = document.documentElement.lang === "ar";
  const screens = document.getElementById("screens");
  const track = document.getElementById("track");
  const footer = document.querySelector(".site-footer");
  const viewportEl = document.getElementById("viewport");
  const frames = Array.from(track.children);
  const segments = Array.from(document.getElementById("progress").children);
  const total = frames.length;

  // ---------- Keep .viewport's rendered height exactly matched to the real
  // visible area on mobile. CSS's 100dvh is the right idea but has a known
  // real-world gap on iOS Safari: it can report the browser-chrome-visible
  // (larger) viewport value until a scroll event forces a recalculation,
  // and this is a swipe-only app that never scrolls the page, so that
  // recalculation may never fire, leaving the URL/tab bar overlapping the
  // bottom of the content on a fresh load. window.visualViewport.height is
  // the one API that always reports the true visible area and fires its
  // own resize event when the browser chrome shows or hides, so it drives
  // .viewport's height on mobile. Desktop keeps the fixed phone-frame size
  // the stylesheet's own media query sets, so this only applies below that
  // breakpoint and clears the inline override above it. ----------
  const MOBILE_BREAKPOINT = 680;

  function syncViewportHeight() {
    if (!viewportEl) return;
    if (window.innerWidth > MOBILE_BREAKPOINT) {
      viewportEl.style.height = "";
      return;
    }
    const vv = window.visualViewport;
    viewportEl.style.height = (vv ? vv.height : window.innerHeight) + "px";
  }

  syncViewportHeight();

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
      footer.classList.toggle("footer-hidden", frames[current].classList.contains("frame-work"));
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

    // Negligible movement: split tap. Right half of the VIEWPORT -> forward,
    // left half -> back. In Arabic (RTL), reading order is reversed, so the
    // tap zones flip: left half -> forward, right half -> back.
    if (elapsed < 400) {
      const rect = screens.getBoundingClientRect();
      const midpoint = rect.left + rect.width / 2;
      const tappedRightHalf = e.clientX >= midpoint;
      const forward = isArabic ? !tappedRightHalf : tappedRightHalf;
      if (forward) {
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

  // ---------- Logo fallback: if a credential card's logo image fails to
  // load, drop the image slot entirely so the text stands alone rather
  // than showing a broken-image icon or empty box. ----------
  document.querySelectorAll(".cred-logo img").forEach((img) => {
    img.addEventListener("error", () => {
      const slot = img.closest(".cred-logo");
      if (slot) slot.remove();
    });
  });

  // ---------- Frame 9: "Share this profile" button. Uses the native Web
  // Share API where available (mobile browsers, mainly); falls back to
  // copying the prewritten text to the clipboard and briefly flipping the
  // button's label to confirm, since most desktop browsers don't support
  // navigator.share. ----------
  const shareBtns = document.querySelectorAll(".share-btn");
  const SHARE_TITLE = isArabic ? "فهد العيسى" : "Fahed Al Essa";
  const SHARE_TEXT = isArabic
    ? "رأيت أن هذا الملف يستحق المشاركة. فهد قائد في القطاع الصحي، لديه خبرة في التحوّل التشغيلي، وإعادة توجيه نماذج الأعمال، وتأسيس عمليات الشركات العالمية في الخليج. مقيم في الرياض. fahedalessa.com/ar"
    : "Thought this profile was worth passing along. Fahed is a healthcare operator who's done turnarounds, pivots, and multinational stand-ups across the Gulf. Based in Riyadh. fahedalessa.com";
  const COPIED_LABEL = isArabic ? "تم النسخ" : "Copied!";

  shareBtns.forEach((shareBtn) => {
    shareBtn.addEventListener("click", async () => {
      if (navigator.share) {
        try {
          await navigator.share({ title: SHARE_TITLE, text: SHARE_TEXT });
        } catch (err) {
          // User cancelled the share sheet, or it failed silently; nothing to do.
        }
        return;
      }
      const label = shareBtn.querySelector("span");
      try {
        await navigator.clipboard.writeText(SHARE_TEXT);
        if (label) {
          const original = label.textContent;
          label.textContent = COPIED_LABEL;
          setTimeout(() => {
            label.textContent = original;
          }, 2000);
        }
      } catch (err) {
        // Clipboard write failed (no permission, insecure context, etc.); nothing more to do.
      }
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
    // The name/subtitle use webfonts loaded with font-display: swap, so the
    // initial measurement can be taken against fallback-font metrics; redo
    // it once the real fonts are in so the reserved gap stays exact.
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(syncCoverPhotoHeight);
    }
  }

  // ---------- Single resize/visual-viewport handler for everything that
  // depends on the viewport's actual rendered size, in dependency order:
  // the viewport height itself first, then the frame-slide position, then
  // the two Frame 1 measurements that read .screens/.footer's resulting
  // size. window.visualViewport fires its own "resize" event when the
  // browser chrome shows/hides even without a matching window "resize"
  // (window.innerHeight reflects the layout viewport, not the visual one),
  // which is exactly the case 100dvh alone misses on this non-scrolling
  // page, so it's listened to separately rather than relying on "resize"
  // alone to catch it. ----------
  function handleViewportChange() {
    syncViewportHeight();
    render(false);
    syncTapHintPosition();
    syncCoverPhotoHeight();
  }

  window.addEventListener("resize", handleViewportChange);
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", handleViewportChange);
  }

  render(false);
})();
