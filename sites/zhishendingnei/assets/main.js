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
document.querySelectorAll(".image-button img").forEach((img) => {
  img.addEventListener("click", () => {
    if (!lightbox || !lightboxImg) return;
    lightboxImg.src = img.currentSrc || img.src;
    lightboxImg.alt = img.alt;
    lightbox.showModal();
  });
});

lightbox?.querySelector(".close")?.addEventListener("click", () => lightbox.close());
lightbox?.addEventListener("click", (event) => {
  if (event.target === lightbox) lightbox.close();
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
