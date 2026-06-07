const progress = document.querySelector(".progress span");
const tocLinks = Array.from(document.querySelectorAll(".toc-list a"));
const headings = tocLinks
  .map((link) => document.querySelector(link.getAttribute("href")))
  .filter(Boolean);

function updateProgress() {
  const scrollTop = window.scrollY;
  const max = document.documentElement.scrollHeight - window.innerHeight;
  const ratio = max > 0 ? Math.min(1, scrollTop / max) : 0;
  progress.style.width = `${ratio * 100}%`;
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
window.addEventListener("scroll", updateProgress, { passive: true });
updateProgress();

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

const themeToggle = document.querySelector("#themeToggle");
const savedTheme = localStorage.getItem("reader-theme");
if (savedTheme === "dark") document.body.classList.add("dark");
themeToggle?.addEventListener("click", () => {
  document.body.classList.toggle("dark");
  localStorage.setItem("reader-theme", document.body.classList.contains("dark") ? "dark" : "light");
});
