
function enhanceBookkeepingReports(root = document) {
  const items = root.querySelectorAll(".bookkeeping-report-item");

  items.forEach((item) => {
    if (item.dataset.plunoEnhanced === "true") return;

    const main = item.children?.[0];
    const meta = item.querySelector(".bookkeeping-report-meta");
    const info = main?.querySelector("span");

    if (!main || !meta || !info) return;

    const text = (info.textContent || "").replace(/\s+/g, " ").trim();
    const match = text.match(/\((Generated[^)]*)\)/i);

    if (match) {
      const generatedValue = match[1]
        .replace(/^Generated\s*/i, "")
        .trim();

      const generated = document.createElement("div");
      generated.className = "bookkeeping-report-generated";
      generated.innerHTML = `
        <span>GENERATED</span>
        <strong>${generatedValue}</strong>
      `;

      meta.insertBefore(generated, meta.firstChild);
    }

    /* The report title already includes the period, so remove the duplicate line. */
    info.style.display = "none";
    item.dataset.plunoEnhanced = "true";
  });
}

function enhanceUI() {
  enhanceBookkeepingReports(document);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", enhanceUI, { once: true });
} else {
  enhanceUI();
}

const observer = new MutationObserver(() => {
  enhanceUI();
});

observer.observe(document.documentElement, {
  subtree: true,
  childList: true,
});
