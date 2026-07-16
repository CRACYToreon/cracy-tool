/**
 * Turns the assessment report into a horizontal carousel: one main block at a time,
 * with adjacent slides partly visible. Prev/next, dots, keyboard, swipe.
 */

/** Wider active slide on large screens; still shows a sliver of neighbours. */
function metricsForViewportWidth(w) {
  if (w < 400) return { ratio: 0.9, gapRatio: 0.024 };
  if (w < 560) return { ratio: 0.91, gapRatio: 0.02 };
  if (w < 720) return { ratio: 0.92, gapRatio: 0.018 };
  if (w < 960) return { ratio: 0.93, gapRatio: 0.016 };
  if (w < 1200) return { ratio: 0.945, gapRatio: 0.014 };
  if (w < 1600) return { ratio: 0.955, gapRatio: 0.012 };
  return { ratio: 0.965, gapRatio: 0.01 };
}

function collectSlideNodes(pageEl) {
  const asmWrap = pageEl.querySelector(".survey-assembled-wrap");
  const hasLayout = Boolean(asmWrap?.querySelector(".survey-assembled--layout"));

  const nodes = [];
  const hero = pageEl.querySelector(".survey-result-hero");
  const rec = pageEl.querySelector(".survey-recommendations-wrap");
  if (hero) nodes.push(hero);
  if (rec) nodes.push(rec);

  if (hasLayout && asmWrap) {
    const rail = asmWrap.querySelector(".survey-assembled__rail");
    const main = asmWrap.querySelector(".survey-assembled__main");
    if (rail) nodes.push(rail);
    if (main) {
      const craSection = main.querySelector(".survey-cra-section");
      if (craSection) {
        const intro = craSection.querySelector(".survey-cra-section__intro");
        const cardsRoot = craSection.querySelector(".survey-cra-section__cards");
        if (intro) nodes.push(intro);
        if (cardsRoot) {
          cardsRoot.querySelectorAll(":scope > .survey-cra-card").forEach((card) => nodes.push(card));
        }
      }
      main.querySelectorAll(".survey-addon-section").forEach((addon) => nodes.push(addon));
    }
  }

  return { nodes, asmWrap, removeAsm: hasLayout };
}

function buildCarouselShell(count) {
  const root = document.createElement("div");
  root.className = "survey-report-carousel";

  const toolbar = document.createElement("div");
  toolbar.className = "survey-report-carousel__toolbar";

  const prev = document.createElement("button");
  prev.type = "button";
  prev.className = "survey-carousel-btn survey-carousel-btn--prev";
  prev.setAttribute("aria-label", "Previous section");
  prev.innerHTML =
    '<span class="survey-carousel-btn__icon" aria-hidden="true">\u2039</span><span class="survey-carousel-btn__text">Back</span>';

  const counter = document.createElement("span");
  counter.className = "survey-carousel-counter";
  counter.setAttribute("aria-live", "polite");

  const next = document.createElement("button");
  next.type = "button";
  next.className = "survey-carousel-btn survey-carousel-btn--next";
  next.setAttribute("aria-label", "Next section");
  next.innerHTML =
    '<span class="survey-carousel-btn__text">Next</span><span class="survey-carousel-btn__icon" aria-hidden="true">\u203A</span>';

  toolbar.append(prev, counter, next);

  const viewport = document.createElement("div");
  viewport.className = "survey-carousel-viewport";
  viewport.setAttribute("tabindex", "0");
  viewport.setAttribute("role", "region");
  viewport.setAttribute("aria-roledescription", "carousel");
  viewport.setAttribute("aria-label", "Report sections");

  const track = document.createElement("div");
  track.className = "survey-carousel-track";
  viewport.appendChild(track);

  const dots = document.createElement("div");
  dots.className = "survey-carousel-dots";
  dots.setAttribute("role", "tablist");
  dots.setAttribute("aria-label", "Section");

  for (let i = 0; i < count; i++) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "survey-carousel-dot";
    b.setAttribute("role", "tab");
    b.setAttribute("aria-label", `Section ${i + 1} of ${count}`);
    b.dataset.slideIndex = String(i);
    dots.appendChild(b);
  }

  root.append(toolbar, viewport, dots);
  return { root, prev, next, counter, viewport, track, dots };
}

/**
 * @param {HTMLElement} pageEl - .survey-result-page
 * @returns {(() => void) | null} teardown on re-render
 */
export function mountReportCarousel(pageEl) {
  if (!pageEl || pageEl.querySelector(".survey-report-carousel")) return null;

  const { nodes, asmWrap, removeAsm } = collectSlideNodes(pageEl);
  if (nodes.length < 2) return null;

  const footer = pageEl.querySelector(".survey-end-footer");
  const { root, prev, next, counter, viewport, track, dots } = buildCarouselShell(nodes.length);

  nodes.forEach((node, slideIndex) => {
    const slide = document.createElement("div");
    slide.className = "survey-carousel-slide";
    if (slideIndex === 0) slide.classList.add("survey-carousel-slide--welcome");
    slide.appendChild(node);
    track.appendChild(slide);
  });

  if (removeAsm && asmWrap) asmWrap.remove();

  if (footer) {
    pageEl.insertBefore(root, footer);
  } else {
    pageEl.appendChild(root);
  }

  pageEl.closest(".survey-main")?.classList.add("survey-main--report-focus");

  const slides = [...track.querySelectorAll(".survey-carousel-slide")];
  let index = 0;
  let slideW = 0;
  let gap = 0;

  function updateDots() {
    dots.querySelectorAll(".survey-carousel-dot").forEach((b, i) => {
      const on = i === index;
      b.classList.toggle("is-active", on);
      b.setAttribute("aria-selected", on ? "true" : "false");
    });
  }

  function layout() {
    const w = viewport.clientWidth;
    if (w <= 0) return;
    const { ratio, gapRatio } = metricsForViewportWidth(w);
    gap = Math.max(12, w * gapRatio);
    slideW = w * ratio;
    const step = slideW + gap;
    const offset = (w - slideW) / 2 - index * step;
    track.style.gap = `${gap}px`;
    track.style.transform = `translate3d(${offset}px, 0, 0)`;
    slides.forEach((s) => {
      s.style.flex = `0 0 ${slideW}px`;
      s.style.width = `${slideW}px`;
      s.style.minWidth = `${slideW}px`;
      s.classList.toggle("is-active", slides.indexOf(s) === index);
    });
    counter.textContent = `${index + 1} / ${slides.length}`;
    prev.disabled = index <= 0;
    next.disabled = index >= slides.length - 1;
    updateDots();
  }

  function go(i) {
    index = Math.max(0, Math.min(slides.length - 1, i));
    layout();
  }

  prev.addEventListener("click", () => go(index - 1));
  next.addEventListener("click", () => go(index + 1));

  dots.addEventListener("click", (e) => {
    const t = e.target.closest(".survey-carousel-dot");
    if (!t || !dots.contains(t)) return;
    const i = parseInt(t.dataset.slideIndex, 10);
    if (!Number.isNaN(i)) go(i);
  });

  viewport.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      go(index - 1);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      go(index + 1);
    }
  });

  let touchStartX = null;
  viewport.addEventListener(
    "touchstart",
    (e) => {
      touchStartX = e.changedTouches[0]?.clientX ?? null;
    },
    { passive: true }
  );
  viewport.addEventListener(
    "touchend",
    (e) => {
      if (touchStartX == null) return;
      const x = e.changedTouches[0]?.clientX;
      if (x == null) return;
      const dx = x - touchStartX;
      touchStartX = null;
      if (dx > 56) go(index - 1);
      else if (dx < -56) go(index + 1);
    },
    { passive: true }
  );

  const ro = new ResizeObserver(() => layout());
  ro.observe(viewport);
  requestAnimationFrame(() => layout());

  return () => {
    ro.disconnect();
  };
}
