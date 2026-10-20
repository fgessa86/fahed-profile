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

  // ---------- Logo fallback: if a card's logo image fails to load, drop the
  // image slot entirely so the caption/text stands alone rather than showing
  // a broken-image icon or empty box. ----------
  document.querySelectorAll(".proof-logo img, .cred-logo img").forEach((img) => {
    img.addEventListener("error", () => {
      const slot = img.closest(".proof-logo, .cred-logo");
      if (slot) slot.remove();
    });
  });

  render(false);
})();
