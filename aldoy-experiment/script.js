(() => {
  "use strict";

  const docEl = document.documentElement;
  const $ = (selector, context = document) => context.querySelector(selector);
  const $$ = (selector, context = document) => Array.from(context.querySelectorAll(selector));
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  let reduceMotion = motionQuery.matches;

  /* -------------------------------------------------------
     Navigation + page progress
     ------------------------------------------------------- */

  const nav = $("#nav");
  const pageProgress = $("#page-progress");
  const menu = $("#menu");
  const menuButton = $(".menu-btn");
  const pageMain = $("main");
  const pageFooter = $(".footer");
  const lightSections = $$(".intro, .mindset, .people");
  let menuOpen = false;

  const metrics = {
    vh: window.innerHeight,
    docScroll: 1,
    storyTop: 0,
    storyScroll: 1,
    spaceTop: 0,
    spaceScroll: 1,
    mindsetTop: 0,
    mindsetSpan: 1,
    lightRanges: [],
    cards: []
  };

  // All geometry is measured once (and on resize/relayout) so the scroll loop
  // never has to touch the DOM for layout — reads and writes stay separated.
  function measure() {
    const vh = window.innerHeight;
    const y = window.scrollY;
    metrics.vh = vh;

    if (story) {
      metrics.storyTop = story.getBoundingClientRect().top + y;
      metrics.storyScroll = Math.max(1, story.offsetHeight - vh);
    }
    if (space) {
      metrics.spaceTop = space.getBoundingClientRect().top + y;
      metrics.spaceScroll = Math.max(1, space.offsetHeight - vh);
    }
    if (mindsetText) {
      const rect = mindsetText.getBoundingClientRect();
      metrics.mindsetTop = rect.top + y;
      metrics.mindsetSpan = Math.max(1, rect.height + vh * 0.52);
    }
    metrics.lightRanges = lightSections.map((section) => {
      const rect = section.getBoundingClientRect();
      return { top: rect.top + y, bottom: rect.bottom + y };
    });
    metrics.cards = spaceCards.map((card) => ({ left: card.offsetLeft, width: card.offsetWidth }));
    metrics.docScroll = Math.max(1, docEl.scrollHeight - vh);
  }

  function overLightAt(y) {
    if (menuOpen) return false;
    const line = y + 34;
    for (let i = 0; i < metrics.lightRanges.length; i += 1) {
      const range = metrics.lightRanges[i];
      if (line >= range.top && line < range.bottom) return true;
    }
    return false;
  }

  function updateChrome(y, overLight = overLightAt(y)) {
    if (pageProgress) {
      pageProgress.style.width = `${clamp((y / metrics.docScroll) * 100, 0, 100)}%`;
    }
    if (!nav) return;

    nav.classList.toggle("is-solid", y > 24);
    nav.classList.toggle("is-light", overLight);
  }

  /* -------------------------------------------------------
     Cinematic story — scroll-scrubbed video + chapters
     ------------------------------------------------------- */

  const story = $(".story");
  const video = $("#story-video");
  const storyOpen = $("#story-open");
  const chapterEls = $$(".chapter");
  const storyIndex = $("#story-index");
  const storyBar = $("#story-bar");
  const storyTime = $("#story-time");

  const chapterStarts = [0.24, 0.39, 0.61];
  let videoDuration = 10;
  let activeChapter = -1;
  let lastTimeLabel = "";
  let storyLocked = null;
  let scrubRetry = 0;
  let scrubRetries = 0;

  if (video) {
    video.pause();
    video.addEventListener("loadedmetadata", () => {
      if (Number.isFinite(video.duration) && video.duration > 0) {
        videoDuration = video.duration;
      }
      onScroll();
    });
    // Retry a pending seek once the next chunk lands, when playback is ready,
    // and when a seek lands (this keeps the last scroll position in sync).
    video.addEventListener("progress", onScroll);
    video.addEventListener("canplay", onScroll);
    video.addEventListener("loadeddata", onScroll);
    video.addEventListener("seeked", onScroll);

    // iOS refuses to decode a paused video until it has been played once, and
    // ignores preload. A muted play/pause on the first touch unlocks seeking.
    if (window.matchMedia("(hover: none)").matches) {
      const unlock = () => {
        if (reduceMotion) return;
        const started = video.play();
        if (started && typeof started.then === "function") {
          started.then(() => video.pause()).catch(() => {});
        } else {
          video.pause();
        }
        onScroll();
      };
      window.addEventListener("touchstart", unlock, { passive: true, once: true });
    }
  }

  function formatTime(seconds) {
    const total = Math.max(0, Math.floor(seconds));
    const minutes = String(Math.floor(total / 60)).padStart(2, "0");
    const secs = String(total % 60).padStart(2, "0");
    return `${minutes}:${secs}`;
  }

  function updateStory(progress) {
    if (!story) return;

    if (storyBar) storyBar.style.width = `${(progress * 100).toFixed(2)}%`;

    if (storyTime) {
      const label = formatTime(progress * videoDuration);
      if (label !== lastTimeLabel) {
        storyTime.textContent = label;
        lastTimeLabel = label;
      }
    }

    // Opening statement fades away as the chapters begin. Opacity + translate
    // only — animating a blur here costs a full filter pass on every frame.
    if (storyOpen) {
      const t = clamp((progress - 0.02) / 0.22, 0, 1);
      storyOpen.style.opacity = t >= 1 ? "0" : String(1 - t);
      storyOpen.style.transform = `translate3d(0, ${(-47 - t * 4).toFixed(2)}%, 0)`;
      const locked = t > 0.55;
      if (locked !== storyLocked) {
        storyLocked = locked;
        storyOpen.style.pointerEvents = locked ? "none" : "auto";
        storyOpen.toggleAttribute("inert", locked);
      }
    }

    // Chapter selection.
    let nextChapter = -1;
    for (let i = chapterStarts.length - 1; i >= 0; i -= 1) {
      if (progress >= chapterStarts[i]) {
        nextChapter = i;
        break;
      }
    }

    if (nextChapter !== activeChapter) {
      chapterEls.forEach((chapter, index) => {
        const isActive = index === nextChapter;
        chapter.classList.toggle("is-active", isActive);
        chapter.setAttribute("aria-hidden", String(!isActive));
      });
      if (storyIndex) {
        storyIndex.textContent =
          nextChapter < 0
            ? "01 / 03"
            : `${String(nextChapter + 1).padStart(2, "0")} / 03`;
      }
      activeChapter = nextChapter;
    }
  }

  // The hero film is scrubbed directly from scroll. The source is encoded with
  // a keyframe every 4 frames (≈13 ms seeks, measured) so a seek can be issued
  // on almost every frame without the decoder falling behind.
  // Some mobile browsers do not fire `progress` reliably while a paused video
  // buffers, so a blocked seek gets a few timed retries instead of waiting.
  function scheduleScrubRetry(progress) {
    if (scrubRetry || scrubRetries > 10 || progress <= 0) return;
    scrubRetries += 1;
    scrubRetry = window.setTimeout(() => {
      scrubRetry = 0;
      onScroll();
    }, 350);
  }

  function scrubVideo(progress) {
    if (reduceMotion || !video || videoDuration <= 0) return;
    if (video.readyState < 2 || video.seeking) {
      scheduleScrubRetry(progress);
      return;
    }

    const target = progress * Math.max(0, videoDuration - 0.04);
    if (Math.abs(target - video.currentTime) < 0.02) return;

    // Never seek past downloaded data; waiting a frame looks better than a stall.
    // Once the clip is fully buffered, let the final frames through too.
    if (video.buffered.length) {
      const bufferedEnd = video.buffered.end(video.buffered.length - 1);
      const fullyBuffered = bufferedEnd >= videoDuration - 0.25;
      if (!fullyBuffered && target > bufferedEnd - 0.08) {
        scheduleScrubRetry(progress);
        return;
      }
    }

    try {
      video.currentTime = target;
    } catch (error) {
      /* Decoder not ready yet — the next frame will try again. */
    }
  }

  /* -------------------------------------------------------
     Mindset — word-by-word scroll highlight
     ------------------------------------------------------- */

  const mindsetText = $("#mindset-text");
  let mindsetWords = [];
  let litWords = -1;

  if (mindsetText) {
    const source = mindsetText.textContent.trim().replace(/\s+/g, " ");
    const words = source.split(" ");
    mindsetText.textContent = "";

    const fragment = document.createDocumentFragment();
    words.forEach((word, index) => {
      const span = document.createElement("span");
      span.className = "w";
      span.textContent = word;
      fragment.appendChild(span);
      if (index < words.length - 1) fragment.appendChild(document.createTextNode(" "));
    });
    mindsetText.appendChild(fragment);
    mindsetWords = $$(".w", mindsetText);
  }

  function updateMindset(progress) {
    if (!mindsetWords.length || !mindsetText) return;

    const count = Math.round(progress * mindsetWords.length);
    if (count === litWords) return;
    mindsetWords.forEach((word, index) => {
      word.classList.toggle("is-lit", index < count);
    });
    litWords = count;
  }

  /* -------------------------------------------------------
     The space — pinned horizontal gallery
     ------------------------------------------------------- */

  const space = $("#space");
  const spaceRail = $(".space-rail");
  const spaceTrack = $("#space-track");
  const spaceBar = $("#space-bar");
  const spaceCards = $$(".space-card");
  const wideQuery = window.matchMedia("(min-width: 901px)");
  let spaceDistance = 0;
  let spaceFrame = 0;

  function updateSpaceCaptions(progress = 0) {
    if (!spaceCards.length) return;
    const pinned = space && spaceDistance > 0 && space.classList.contains("is-pinned");
    const viewport = window.innerWidth;

    spaceCards.forEach((card, index) => {
      let left;
      let width;
      const cached = metrics.cards[index];
      if (pinned && cached) {
        width = cached.width;
        left = cached.left - spaceDistance * progress;
      } else {
        const rect = card.getBoundingClientRect();
        left = rect.left;
        width = rect.width;
      }
      const visible = Math.max(0, Math.min(left + width, viewport) - Math.max(left, 0));
      card.classList.toggle("is-cropped", visible / Math.max(1, width) < 0.78);
    });
  }

  function setupSpace() {
    if (!space || !spaceTrack) return;

    const pinned = wideQuery.matches && !reduceMotion;
    space.classList.toggle("is-pinned", pinned);

    if (!pinned) {
      space.style.removeProperty("--space-height");
      space.style.height = "";
      spaceTrack.style.transform = "";
      spaceDistance = 0;
      if (spaceBar) spaceBar.style.width = "0%";
      measure();
      return;
    }

    // Wait one frame so the pinned card widths are applied before measuring.
    if (spaceFrame) cancelAnimationFrame(spaceFrame);
    spaceFrame = requestAnimationFrame(() => {
      spaceDistance = Math.max(0, spaceTrack.scrollWidth - window.innerWidth);
      const height = window.innerHeight + spaceDistance + 120;
      space.style.setProperty("--space-height", `${height}px`);
      space.style.height = `${height}px`;
      measure();
      updateSpace(clamp((window.scrollY - metrics.spaceTop) / metrics.spaceScroll, 0, 1));
    });
  }

  function updateSpace(progress) {
    if (!space || !space.classList.contains("is-pinned") || !spaceDistance) return;

    spaceTrack.style.transform = `translate3d(${(-spaceDistance * progress).toFixed(2)}px, 0, 0)`;
    if (spaceBar) spaceBar.style.width = `${(progress * 100).toFixed(2)}%`;
    updateSpaceCaptions(progress);
  }

  /* -------------------------------------------------------
     Reveals
     ------------------------------------------------------- */

  const revealEls = $$(".reveal");
  if ("IntersectionObserver" in window && !reduceMotion) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("in");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -6% 0px" }
    );
    revealEls.forEach((element) => observer.observe(element));
  } else {
    revealEls.forEach((element) => element.classList.add("in"));
  }

  /* -------------------------------------------------------
     Menu
     ------------------------------------------------------- */

  function setMenu(open) {
    if (!menu || !menuButton) return;
    menuOpen = open;
    menu.classList.toggle("is-open", open);
    menuButton.classList.toggle("is-open", open);
    menuButton.setAttribute("aria-expanded", String(open));
    menuButton.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    menu.setAttribute("aria-hidden", String(!open));
    document.body.classList.toggle("menu-open", open);
    if (pageMain) pageMain.toggleAttribute("inert", open);
    if (pageFooter) pageFooter.toggleAttribute("inert", open);

    if (open) {
      window.setTimeout(() => {
        const firstLink = menu.querySelector("a");
        if (firstLink && menuOpen) firstLink.focus({ preventScroll: true });
      }, 260);
    }

    updateChrome(window.scrollY);
  }

  if (menuButton) {
    menuButton.addEventListener("click", () => setMenu(!menuOpen));
  }

  if (menu) {
    menu.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => setMenu(false));
    });
  }

  $$(".brand").forEach((brand) => {
    brand.addEventListener("click", () => {
      if (menuOpen) setMenu(false);
    });
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && menuOpen) {
      setMenu(false);
      if (menuButton) menuButton.focus();
    }
  });

  wideQuery.addEventListener("change", (event) => {
    if (event.matches && menuOpen) setMenu(false);
    setupSpace();
  });

  /* -------------------------------------------------------
     Card spotlight (fine pointers only)
     ------------------------------------------------------- */

  if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
    $$(".card").forEach((card) => {
      card.addEventListener("pointermove", (event) => {
        const rect = card.getBoundingClientRect();
        const x = ((event.clientX - rect.left) / rect.width) * 100;
        const y = ((event.clientY - rect.top) / rect.height) * 100;
        card.style.setProperty("--mx", `${x}%`);
        card.style.setProperty("--my", `${y}%`);
      });
    });
  }

  /* -------------------------------------------------------
     Scroll loop
     ------------------------------------------------------- */

  let ticking = false;

  function renderFrame() {
    ticking = false;

    const y = window.scrollY;
    const m = metrics;

    // Geometry comes from the cached measurements — no layout reads per frame.
    const storyProgress = clamp((y - m.storyTop) / m.storyScroll, 0, 1);
    const spaceProgress = clamp((y - m.spaceTop) / m.spaceScroll, 0, 1);
    const mindsetProgress = clamp((m.vh * 0.82 - (m.mindsetTop - y)) / m.mindsetSpan, 0, 1);

    // Writes only from here down.
    updateChrome(y, overLightAt(y));
    updateStory(storyProgress);
    updateMindset(mindsetProgress);
    updateSpace(spaceProgress);
    scrubVideo(storyProgress);
  }

  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(renderFrame);
  }

  // iOS fires few (or no) scroll events while momentum scrolling, so a scroll
  // event alone is not enough there. A short rAF watcher rides along with touch
  // and wheel input, updates while the page is actually moving, then stops.
  let watchFrame = 0;
  let watchY = -1;
  let watchIdle = 0;

  function watchScroll() {
    watchFrame = 0;
    const y = window.scrollY;
    if (y !== watchY) {
      watchY = y;
      watchIdle = 0;
      onScroll();
    } else {
      watchIdle += 1;
    }
    if (watchIdle < 10) watchFrame = requestAnimationFrame(watchScroll);
  }

  function startScrollWatch() {
    if (watchFrame) return;
    watchY = window.scrollY;
    watchIdle = 0;
    watchFrame = requestAnimationFrame(watchScroll);
  }

  window.addEventListener(
    "scroll",
    () => {
      scrubRetries = 0;
      startScrollWatch();
      onScroll();
    },
    { passive: true }
  );
  window.addEventListener("touchstart", startScrollWatch, { passive: true });
  window.addEventListener("touchmove", startScrollWatch, { passive: true });
  window.addEventListener("pageshow", onScroll);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) onScroll();
  });
  if (spaceRail) {
    spaceRail.addEventListener(
      "scroll",
      () => {
        if (!space || !space.classList.contains("is-pinned")) updateSpaceCaptions(0);
      },
      { passive: true }
    );
  }

  // Re-measure when the document changes size: font swap, image decode, pin height.
  let measureFrame = 0;
  function scheduleMeasure() {
    if (measureFrame) return;
    measureFrame = requestAnimationFrame(() => {
      measureFrame = 0;
      measure();
      onScroll();
    });
  }

  window.addEventListener("resize", () => {
    setupSpace();
    scheduleMeasure();
  });

  if ("ResizeObserver" in window) {
    new ResizeObserver(scheduleMeasure).observe(docEl);
  }
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(scheduleMeasure);
  }

  window.addEventListener("load", () => {
    setupSpace();
    scheduleMeasure();
  });

  motionQuery.addEventListener("change", (event) => {
    reduceMotion = event.matches;
    setupSpace();
    scheduleMeasure();
  });

  measure();
  setupSpace();
  onScroll();
})();
