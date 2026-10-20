(function () {
  "use strict";

  const viewport = document.getElementById("viewport");
  const track = document.getElementById("track");
  const frames = Array.from(track.children);
  const segments = Array.from(document.getElementById("progress").children);
  const total = frames.length;

  let current = 0;
  let viewportWidth = viewport.getBoundingClientRect().width;

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
  }

  function setTrackTransform(px, withTransition) {
    track.style.transition = withTransition ? "transform 0.38s cubic-bezier(.22,.61,.36,1)" : "none";
    track.style.transform = `translate3d(${px}px,0,0)`;
  }

  function render(withTransition) {
    viewportWidth = viewport.getBoundingClientRect().width;
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

  // ---------- Pointer handling (tap + swipe, unified) ----------
  function onPointerDown(e) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    interactiveTarget = !!e.target.closest("a, button, .no-advance");
    dragging = true;
    axisLocked = null;
    startX = e.clientX;
    startY = e.clientY;
    startTime = Date.now();
    deltaX = 0;
    viewportWidth = viewport.getBoundingClientRect().width;
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

    if (axisLocked === "y") return; // let vertical scroll/gesture pass

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
      const threshold = viewportWidth * 0.18;
      const fast = Math.abs(deltaX) > 60 && elapsed < 250;
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

    // Treated as a tap (negligible movement)
    if (elapsed < 400) {
      const rect = viewport.getBoundingClientRect();
      const relX = (e.clientX - rect.left) / rect.width;
      if (relX < 0.28) {
        prev();
      } else {
        next();
      }
    }
  }

  viewport.addEventListener("pointerdown", onPointerDown);
  viewport.addEventListener("pointermove", onPointerMove, { passive: false });
  window.addEventListener("pointerup", onPointerUp);
  window.addEventListener("pointercancel", () => {
    dragging = false;
    render(true);
  });

  // ---------- Keyboard (desktop) ----------
  window.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight" || e.key === " ") next();
    if (e.key === "ArrowLeft") prev();
  });

  // ---------- Desktop nav arrows ----------
  function buildArrows() {
    const prevBtn = document.createElement("button");
    prevBtn.className = "nav-arrow nav-prev";
    prevBtn.setAttribute("aria-label", "Previous");
    prevBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6"/></svg>';
    prevBtn.addEventListener("click", prev);

    const nextBtn = document.createElement("button");
    nextBtn.className = "nav-arrow nav-next";
    nextBtn.setAttribute("aria-label", "Next");
    nextBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 6l6 6-6 6"/></svg>';
    nextBtn.addEventListener("click", next);

    viewport.appendChild(prevBtn);
    viewport.appendChild(nextBtn);
  }
  buildArrows();

  window.addEventListener("resize", () => render(false));

  render(false);
})();
