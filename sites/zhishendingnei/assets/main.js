const progress = document.querySelector(".progress span");
const tocLinks = Array.from(document.querySelectorAll(".toc-list a"));
const headings = tocLinks
  .map((link) => document.querySelector(link.getAttribute("href")))
  .filter(Boolean);
const progressKey = "zhishendingnei-scroll";
let saveTimer = 0;

function updateProgress() {
  const scrollTop = window.scrollY;
  const max = document.documentElement.scrollHeight - window.innerHeight;
  const ratio = max > 0 ? Math.min(1, scrollTop / max) : 0;
  progress.style.width = `${ratio * 100}%`;
}

function saveScrollPosition() {
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    if (max <= 0) return;
    localStorage.setItem(progressKey, JSON.stringify({
      y: window.scrollY,
      ratio: window.scrollY / max,
      updatedAt: Date.now(),
    }));
  }, 120);
}

function restoreScrollPosition() {
  if (window.location.hash) return;
  const saved = JSON.parse(localStorage.getItem(progressKey) || "null");
  if (!saved || saved.y < 500) return;
  const max = document.documentElement.scrollHeight - window.innerHeight;
  const y = Math.min(saved.y || (saved.ratio || 0) * max, max);
  window.scrollTo(0, y);
}

const observer = new IntersectionObserver(
  (entries) => {
    const visible = entries
      .filter((entry) => entry.isIntersecting)
      .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
    if (!visible) return;
    tocLinks.forEach((link) => {
      link.classList.toggle("active", link.getAttribute("href") === `#${visible.target.id}`);
    });
  },
  { rootMargin: "-12% 0px -72% 0px", threshold: [0, 1] },
);

headings.forEach((heading) => observer.observe(heading));
window.addEventListener("scroll", () => {
  updateProgress();
  saveScrollPosition();
}, { passive: true });
window.addEventListener("beforeunload", () => {
  localStorage.setItem(progressKey, JSON.stringify({
    y: window.scrollY,
    ratio: window.scrollY / Math.max(1, document.documentElement.scrollHeight - window.innerHeight),
    updatedAt: Date.now(),
  }));
});
requestAnimationFrame(() => {
  restoreScrollPosition();
  updateProgress();
});

const lightbox = document.querySelector("#lightbox");
const lightboxImg = lightbox?.querySelector("img");
let zoomState = { scale: 1, fitScale: 1, x: 0, y: 0, dragging: false, startX: 0, startY: 0, originX: 0, originY: 0 };

function applyZoom() {
  if (!lightboxImg) return;
  lightboxImg.style.setProperty("--zoom", zoomState.scale);
  lightboxImg.style.transform = `translate(calc(-50% + ${zoomState.x}px), calc(-50% + ${zoomState.y}px)) scale(${zoomState.scale})`;
}

function fitImageToViewport() {
  if (!lightboxImg) return;
  const naturalWidth = lightboxImg.naturalWidth || 1;
  const naturalHeight = lightboxImg.naturalHeight || 1;
  const fitX = (window.innerWidth * 0.94) / naturalWidth;
  const fitY = (window.innerHeight * 0.86) / naturalHeight;
  zoomState.fitScale = Math.min(1, fitX, fitY);
  zoomState.scale = zoomState.fitScale;
  zoomState.x = 0;
  zoomState.y = 0;
  applyZoom();
}

function setZoom(nextScale) {
  zoomState.scale = Math.max(zoomState.fitScale, Math.min(6, nextScale));
  if (zoomState.scale === zoomState.fitScale) {
    zoomState.x = 0;
    zoomState.y = 0;
  }
  applyZoom();
}

document.querySelectorAll(".image-button img").forEach((img) => {
  img.addEventListener("click", () => {
    if (!lightbox || !lightboxImg) return;
    lightboxImg.src = img.currentSrc || img.src;
    lightboxImg.alt = img.alt;
    lightbox.showModal();
    if (lightboxImg.complete) fitImageToViewport();
    else lightboxImg.addEventListener("load", fitImageToViewport, { once: true });
  });
});

lightbox?.querySelector(".close")?.addEventListener("click", () => lightbox.close());
lightbox?.addEventListener("click", (event) => {
  if (event.target === lightbox) lightbox.close();
});
lightbox?.addEventListener("wheel", (event) => {
  event.preventDefault();
  const factor = event.deltaY < 0 ? 1.14 : 0.88;
  setZoom(zoomState.scale * factor);
}, { passive: false });
lightbox?.addEventListener("dblclick", () => {
  setZoom(zoomState.scale <= zoomState.fitScale * 1.1 ? Math.max(1, zoomState.fitScale * 2.2) : zoomState.fitScale);
});
lightbox?.querySelectorAll("[data-zoom]").forEach((button) => {
  button.addEventListener("click", (event) => {
    event.stopPropagation();
    const action = button.dataset.zoom;
    if (action === "in") setZoom(zoomState.scale * 1.25);
    if (action === "out") setZoom(zoomState.scale / 1.25);
    if (action === "reset") setZoom(zoomState.fitScale);
  });
});
lightboxImg?.addEventListener("pointerdown", (event) => {
  zoomState.dragging = true;
  zoomState.startX = event.clientX;
  zoomState.startY = event.clientY;
  zoomState.originX = zoomState.x;
  zoomState.originY = zoomState.y;
  lightboxImg.setPointerCapture(event.pointerId);
  lightboxImg.classList.add("dragging");
});
lightboxImg?.addEventListener("pointermove", (event) => {
  if (!zoomState.dragging) return;
  zoomState.x = zoomState.originX + event.clientX - zoomState.startX;
  zoomState.y = zoomState.originY + event.clientY - zoomState.startY;
  applyZoom();
});
lightboxImg?.addEventListener("pointerup", (event) => {
  zoomState.dragging = false;
  lightboxImg.releasePointerCapture(event.pointerId);
  lightboxImg.classList.remove("dragging");
});
lightboxImg?.addEventListener("pointercancel", () => {
  zoomState.dragging = false;
  lightboxImg.classList.remove("dragging");
});

const readerToggle = document.querySelector("#readerToggle");
const readerPanel = document.querySelector("#readerPanel");
const fontSizeControl = document.querySelector("#fontSizeControl");
const lineHeightControl = document.querySelector("#lineHeightControl");
const savedSettings = JSON.parse(localStorage.getItem("reader-settings") || "{}");

function applyReaderSettings(settings) {
  if (settings.fontSize) {
    document.documentElement.style.setProperty("--reader-font-size", `${settings.fontSize}px`);
    if (fontSizeControl) fontSizeControl.value = settings.fontSize;
  }
  if (settings.lineHeight) {
    document.documentElement.style.setProperty("--reader-line-height", settings.lineHeight);
    if (lineHeightControl) lineHeightControl.value = settings.lineHeight;
  }
  document.body.classList.remove("theme-light", "theme-warm", "theme-dark");
  if (settings.theme === "light") document.body.classList.add("theme-light");
  if (settings.theme === "warm") document.body.classList.add("theme-warm");
  if (settings.theme === "dark") document.body.classList.add("theme-dark");
}

function saveReaderSetting(key, value) {
  const next = { ...savedSettings, ...JSON.parse(localStorage.getItem("reader-settings") || "{}") };
  if (key === "theme" && value === "system") {
    delete next.theme;
  } else {
    next[key] = value;
  }
  localStorage.setItem("reader-settings", JSON.stringify(next));
  applyReaderSettings(next);
}

applyReaderSettings(savedSettings);

readerToggle?.addEventListener("click", () => {
  const open = readerPanel?.hasAttribute("hidden");
  if (!readerPanel) return;
  readerPanel.toggleAttribute("hidden", !open);
  readerToggle.setAttribute("aria-expanded", String(open));
});

fontSizeControl?.addEventListener("input", (event) => {
  saveReaderSetting("fontSize", event.target.value);
});

lineHeightControl?.addEventListener("input", (event) => {
  saveReaderSetting("lineHeight", event.target.value);
});

document.querySelectorAll("[data-theme]").forEach((button) => {
  button.addEventListener("click", () => saveReaderSetting("theme", button.dataset.theme));
});

document.addEventListener("click", (event) => {
  if (!readerPanel || readerPanel.hasAttribute("hidden")) return;
  if (readerPanel.contains(event.target) || readerToggle?.contains(event.target)) return;
  readerPanel.setAttribute("hidden", "");
  readerToggle?.setAttribute("aria-expanded", "false");
});
