(() => {
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (window.location.hash) {
    const initialTarget = document.querySelector(window.location.hash);
    if (initialTarget) requestAnimationFrame(() => initialTarget.scrollIntoView({ behavior: "instant" }));
  }

  const sequenceData = [
    {
      kicker: "Continuous behavior",
      title: "Start",
      description: "Observe the scene and begin a single, continuous interaction.",
    },
    {
      kicker: "Scene awareness",
      title: "Pass sideways",
      description: "Turn the torso and coordinate sideways steps through the narrow gap.",
    },
    {
      kicker: "Contact-rich control",
      title: "Pick up",
      description: "Transition smoothly from navigation into whole-body object manipulation.",
    },
    {
      kicker: "Concurrent composition",
      title: "Obstacle-aware carry",
      description: "Transport the object while continuously adapting to nearby geometry.",
    },
    {
      kicker: "Long-horizon control",
      title: "Place",
      description: "Complete the multi-stage objective within one continuous behavior.",
    },
  ];

  const stage = document.querySelector(".sequence-stage");
  const frames = [...document.querySelectorAll(".frame")];
  const steps = [...document.querySelectorAll(".sequence-step")];
  const frameCounter = document.querySelector(".frame-counter b");
  const captionIndex = document.querySelector(".caption-index");
  const captionKicker = document.querySelector(".caption-kicker");
  const captionTitle = document.querySelector(".caption-title");
  const captionDescription = document.querySelector(".caption-description");
  let activeFrame = 0;
  let timer = null;
  let dragging = false;

  function restartStepProgress(step) {
    const line = step.querySelector("i");
    if (!line || reducedMotion) return;
    line.style.animation = "none";
    void line.offsetWidth;
    line.style.animation = "";
  }

  function setFrame(index, restart = false) {
    const next = (index + frames.length) % frames.length;
    activeFrame = next;

    frames.forEach((frame, frameIndex) => {
      const isCurrent = frameIndex === next;
      frame.classList.toggle("is-active", isCurrent);
      frame.setAttribute("aria-hidden", String(!isCurrent));
    });

    steps.forEach((step, stepIndex) => {
      const isCurrent = stepIndex === next;
      step.classList.toggle("is-active", isCurrent);
      step.setAttribute("aria-pressed", String(isCurrent));
      if (isCurrent) restartStepProgress(step);
    });

    const item = sequenceData[next];
    const number = String(next + 1).padStart(2, "0");
    frameCounter.textContent = number;
    captionIndex.textContent = number;
    captionKicker.textContent = item.kicker;
    captionTitle.textContent = item.title;
    captionDescription.textContent = item.description;

    if (restart) startAutoplay();
  }

  function stopAutoplay() {
    if (timer) window.clearInterval(timer);
    timer = null;
  }

  function startAutoplay() {
    stopAutoplay();
    if (reducedMotion || document.hidden) return;
    timer = window.setInterval(() => setFrame(activeFrame + 1), 3800);
  }

  function frameFromPointer(event) {
    const rect = stage.getBoundingClientRect();
    const progress = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    return Math.min(frames.length - 1, Math.floor(progress * frames.length));
  }

  if (stage && frames.length) {
    frames.forEach((frame) => {
      if (!frame.complete) {
        const preload = new Image();
        preload.src = frame.src;
      }
    });

    steps.forEach((step) => {
      step.addEventListener("click", () => setFrame(Number(step.dataset.frame), true));
    });

    stage.addEventListener("pointermove", (event) => {
      const rect = stage.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * 100;
      const y = ((event.clientY - rect.top) / rect.height) * 100;
      stage.style.setProperty("--mx", `${x}%`);
      stage.style.setProperty("--my", `${y}%`);
      if (dragging) setFrame(frameFromPointer(event));
    });

    stage.addEventListener("pointerdown", (event) => {
      dragging = true;
      stopAutoplay();
      stage.setPointerCapture(event.pointerId);
      setFrame(frameFromPointer(event));
    });

    stage.addEventListener("pointerup", (event) => {
      dragging = false;
      if (stage.hasPointerCapture(event.pointerId)) stage.releasePointerCapture(event.pointerId);
      startAutoplay();
    });

    stage.addEventListener("pointercancel", () => {
      dragging = false;
      startAutoplay();
    });

    stage.addEventListener("mouseenter", stopAutoplay);
    stage.addEventListener("mouseleave", () => {
      if (!dragging) startAutoplay();
    });

    stage.addEventListener("keydown", (event) => {
      if (event.key === "ArrowRight") {
        event.preventDefault();
        setFrame(activeFrame + 1, true);
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        setFrame(activeFrame - 1, true);
      }
    });

    document.addEventListener("visibilitychange", () => {
      if (document.hidden) stopAutoplay();
      else startAutoplay();
    });

    setFrame(0);
    startAutoplay();
  }

  const revealObserver = new IntersectionObserver(
    (entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("in-view");
        observer.unobserve(entry.target);
      });
    },
    { threshold: 0.12, rootMargin: "0px 0px -6%" },
  );

  document.querySelectorAll(".reveal").forEach((element) => revealObserver.observe(element));

  const filmstrip = document.querySelector(".filmstrip");
  const filmstripViewport = document.querySelector(".filmstrip-viewport");
  const filmstripTrack = document.querySelector(".filmstrip-track");
  const originalFilmstripItems = filmstripTrack ? [...filmstripTrack.children] : [];
  const originalFilmstripCount = originalFilmstripItems.length;

  if (filmstripTrack) {
    originalFilmstripItems.forEach((item, index) => {
      const clone = item.cloneNode(true);
      clone.setAttribute("aria-hidden", "true");
      clone.dataset.filmstripClone = String(index);

      const cloneVideo = clone.querySelector(".filmstrip-video");
      if (cloneVideo) cloneVideo.preload = "none";

      filmstripTrack.appendChild(clone);
    });
  }

  const filmstripVideos = [...document.querySelectorAll(".filmstrip-video")];
  const visibleFilmstripVideos = new Set();
  let filmstripFrame = 0;
  let filmstripLastTime = 0;
  let filmstripVisible = false;
  let filmstripDragging = false;
  let filmstripDragStart = 0;
  let filmstripScrollStart = 0;

  function syncFilmstripVideos() {
    filmstripVideos.forEach((video) => {
      const shouldPlay = visibleFilmstripVideos.has(video) && !reducedMotion && !document.hidden;
      if (shouldPlay) {
        video.muted = true;
        video.play().catch(() => {});
      } else if (!video.paused) {
        video.pause();
      }
    });
  }

  function filmstripCanMove() {
    return (
      filmstripVisible &&
      !filmstripDragging &&
      !reducedMotion &&
      !document.hidden &&
      filmstripViewport.scrollWidth > filmstripViewport.clientWidth + 1
    );
  }

  function stopFilmstripMotion() {
    if (filmstripFrame) window.cancelAnimationFrame(filmstripFrame);
    filmstripFrame = 0;
  }

  function getFilmstripLoop() {
    const firstItem = filmstripTrack?.children[0];
    const firstClone = filmstripTrack?.children[originalFilmstripCount];
    if (!firstItem || !firstClone) return null;

    const start = firstItem.offsetLeft;
    const end = firstClone.offsetLeft;
    if (end <= start) return null;

    return { start, end, length: end - start };
  }

  function syncFilmstripLoopFrames() {
    originalFilmstripItems.forEach((item, index) => {
      const originalVideo = item.querySelector(".filmstrip-video");
      const cloneVideo = filmstripTrack?.children[
        index + originalFilmstripCount
      ]?.querySelector(".filmstrip-video");

      if (!originalVideo || !cloneVideo || cloneVideo.readyState < 1) return;

      try {
        originalVideo.currentTime = cloneVideo.currentTime;
      } catch (_) {
        // Some browsers may reject seeking before enough metadata is available.
      }
    });
  }

  function normalizeFilmstripPosition() {
    const loop = getFilmstripLoop();
    if (!loop || filmstripViewport.scrollLeft < loop.end) return;

    syncFilmstripLoopFrames();
    filmstripViewport.scrollLeft =
      loop.start + ((filmstripViewport.scrollLeft - loop.end) % loop.length);
  }

  function alignFilmstripClone(video) {
    const clone = video.closest("[data-filmstrip-clone]");
    if (!clone) return;

    const sourceVideo = originalFilmstripItems[
      Number(clone.dataset.filmstripClone)
    ]?.querySelector(".filmstrip-video");
    if (!sourceVideo) return;

    const align = () => {
      try {
        video.currentTime = sourceVideo.currentTime;
      } catch (_) {
        // Seeking can fail until metadata is available; playback still continues.
      }
    };

    if (video.readyState >= 1) align();
    else video.addEventListener("loadedmetadata", align, { once: true });
  }

  function advanceFilmstrip(time) {
    filmstripFrame = 0;
    if (!filmstripCanMove()) return;

    const elapsed = Math.min(50, time - filmstripLastTime);
    filmstripViewport.scrollLeft += elapsed * 0.034;
    normalizeFilmstripPosition();
    filmstripLastTime = time;
    filmstripFrame = window.requestAnimationFrame(advanceFilmstrip);
  }

  function startFilmstripMotion() {
    if (filmstripFrame || !filmstripCanMove()) return;
    filmstripLastTime = performance.now();
    filmstripFrame = window.requestAnimationFrame(advanceFilmstrip);
  }

  if (filmstrip && filmstripViewport) {
    const filmstripObserver = new IntersectionObserver(
      ([entry]) => {
        filmstripVisible = entry.isIntersecting;
        if (filmstripVisible) startFilmstripMotion();
        else stopFilmstripMotion();
      },
      { threshold: 0.12 },
    );

    const filmstripVideoObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            alignFilmstripClone(entry.target);
            visibleFilmstripVideos.add(entry.target);
          } else {
            visibleFilmstripVideos.delete(entry.target);
          }
        });
        syncFilmstripVideos();
      },
      { threshold: 0.35 },
    );

    filmstripObserver.observe(filmstrip);
    filmstripVideos.forEach((video) => filmstripVideoObserver.observe(video));

    filmstripViewport.addEventListener("pointerdown", (event) => {
      if (event.pointerType !== "mouse" || event.button !== 0) return;
      event.preventDefault();
      filmstripDragging = true;
      filmstripDragStart = event.clientX;
      filmstripScrollStart = filmstripViewport.scrollLeft;
      filmstripViewport.classList.add("is-dragging");
      filmstripViewport.setPointerCapture(event.pointerId);
      stopFilmstripMotion();
    });

    filmstripViewport.addEventListener("pointermove", (event) => {
      if (!filmstripDragging) return;
      filmstripViewport.scrollLeft = filmstripScrollStart - (event.clientX - filmstripDragStart);
      normalizeFilmstripPosition();
    });

    function finishFilmstripDrag(event) {
      if (!filmstripDragging) return;
      filmstripDragging = false;
      filmstripViewport.classList.remove("is-dragging");
      if (filmstripViewport.hasPointerCapture(event.pointerId)) {
        filmstripViewport.releasePointerCapture(event.pointerId);
      }
      normalizeFilmstripPosition();
      startFilmstripMotion();
    }

    filmstripViewport.addEventListener("pointerup", finishFilmstripDrag);
    filmstripViewport.addEventListener("pointercancel", finishFilmstripDrag);
    filmstripViewport.addEventListener("scroll", normalizeFilmstripPosition, {
      passive: true,
    });

    window.addEventListener("resize", () => {
      normalizeFilmstripPosition();
      startFilmstripMotion();
    });

    document.addEventListener("visibilitychange", () => {
      syncFilmstripVideos();
      if (document.hidden) stopFilmstripMotion();
      else startFilmstripMotion();
    });
  }

  const behaviorVideos = [...document.querySelectorAll(".behavior-media")];
  const userPausedVideos = new WeakSet();

  function updateVideoToggle(video) {
    const button = video.closest(".behavior-card")?.querySelector(".video-toggle");
    if (!button) return;
    const isPaused = video.paused;
    button.classList.toggle("is-paused", isPaused);
    button.querySelector("b").textContent = isPaused ? "Play" : "Pause";
    button.setAttribute("aria-label", `${isPaused ? "Play" : "Pause"} ${video.getAttribute("aria-label") || "behavior video"}`);
  }

  behaviorVideos.forEach((video) => {
    const card = video.closest(".behavior-card");
    const toggle = card.querySelector(".video-toggle");
    const clipButtons = [...card.querySelectorAll(".clip-button")];

    video.addEventListener("play", () => updateVideoToggle(video));
    video.addEventListener("pause", () => updateVideoToggle(video));
    video.addEventListener("error", () => card.classList.remove("is-switching"));

    toggle?.addEventListener("click", () => {
      if (video.paused) {
        userPausedVideos.delete(video);
        video.play().catch(() => updateVideoToggle(video));
      } else {
        userPausedVideos.add(video);
        video.pause();
      }
    });

    clipButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const nextSource = button.dataset.videoSrc;
        if (!nextSource || video.getAttribute("src") === nextSource) return;

        clipButtons.forEach((clipButton) => {
          const isActive = clipButton === button;
          clipButton.classList.toggle("is-active", isActive);
          clipButton.setAttribute("aria-pressed", String(isActive));
        });

        card.classList.add("is-switching");
        video.src = nextSource;
        video.load();
        video.addEventListener(
          "canplay",
          () => {
            card.classList.remove("is-switching");
            if (!reducedMotion && !userPausedVideos.has(video)) {
              video.play().catch(() => updateVideoToggle(video));
            }
          },
          { once: true },
        );
      });
    });

    if (reducedMotion) {
      userPausedVideos.add(video);
      video.pause();
    }
    updateVideoToggle(video);
  });

  const videoObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const video = entry.target;
        if (entry.isIntersecting && !reducedMotion && !userPausedVideos.has(video)) {
          video.play().catch(() => updateVideoToggle(video));
        } else if (!entry.isIntersecting) {
          video.pause();
        }
      });
    },
    { threshold: 0.45 },
  );

  behaviorVideos.forEach((video) => videoObserver.observe(video));

  const nav = document.querySelector(".site-nav");
  const progress = document.querySelector(".page-progress span");
  let scrollTicking = false;

  function updateScrollUI() {
    const scrollTop = window.scrollY;
    const scrollRange = document.documentElement.scrollHeight - window.innerHeight;
    nav.classList.toggle("is-scrolled", scrollTop > 24);
    progress.style.transform = `scaleX(${scrollRange > 0 ? scrollTop / scrollRange : 0})`;
    scrollTicking = false;
  }

  window.addEventListener(
    "scroll",
    () => {
      if (scrollTicking) return;
      scrollTicking = true;
      requestAnimationFrame(updateScrollUI);
    },
    { passive: true },
  );
  updateScrollUI();

  const menuToggle = document.querySelector(".menu-toggle");
  const navLinks = document.querySelector(".nav-links");

  function closeMenu() {
    menuToggle.setAttribute("aria-expanded", "false");
    navLinks.classList.remove("is-open");
  }

  menuToggle.addEventListener("click", () => {
    const willOpen = menuToggle.getAttribute("aria-expanded") !== "true";
    menuToggle.setAttribute("aria-expanded", String(willOpen));
    navLinks.classList.toggle("is-open", willOpen);
  });

  navLinks.querySelectorAll("a").forEach((link) => link.addEventListener("click", closeMenu));

  document.addEventListener("click", (event) => {
    if (!nav.contains(event.target)) closeMenu();
  });

  const methodZoomTrigger = document.querySelector(".method-zoom-trigger");
  const methodLightbox = document.querySelector("#method-lightbox");
  const methodLightboxClose = methodLightbox?.querySelector(".method-lightbox-close");
  const methodLightboxViewport = methodLightbox?.querySelector(".method-lightbox-viewport");

  function openMethodLightbox() {
    if (!methodLightbox) return;
    methodZoomTrigger.setAttribute("aria-expanded", "true");
    document.body.classList.add("has-modal");

    if (typeof methodLightbox.showModal === "function") methodLightbox.showModal();
    else methodLightbox.setAttribute("open", "");

    methodLightboxViewport.scrollTo({ left: 0, top: 0 });
  }

  function closeMethodLightbox() {
    if (!methodLightbox?.open) return;
    if (typeof methodLightbox.close === "function") methodLightbox.close();
    else methodLightbox.removeAttribute("open");
  }

  methodZoomTrigger?.addEventListener("click", openMethodLightbox);
  methodLightboxClose?.addEventListener("click", closeMethodLightbox);
  methodLightbox?.addEventListener("click", (event) => {
    if (event.target === methodLightbox) closeMethodLightbox();
  });
  methodLightbox?.addEventListener("close", () => {
    document.body.classList.remove("has-modal");
    methodZoomTrigger.setAttribute("aria-expanded", "false");
    methodZoomTrigger.focus();
  });

  const bibtex = document.querySelector("#bibtex");
  const toast = document.querySelector(".toast");
  let toastTimer;

  async function copyBibtex() {
    if (!bibtex) return;
    const value = bibtex.textContent.trim();

    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = value;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      textarea.remove();
    }

    window.clearTimeout(toastTimer);
    toast?.classList.add("is-visible");
    toastTimer = window.setTimeout(() => toast?.classList.remove("is-visible"), 1800);
  }

  document.querySelectorAll(".copy-citation").forEach((button) => {
    button.addEventListener("click", copyBibtex);
  });

})();
