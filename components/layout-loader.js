document.addEventListener("DOMContentLoaded", function () {
  // 1. Load Header Dynamically
  const headerContainer = document.getElementById("site-header");
  if (headerContainer) {
    fetch("/components/header.html")
      .then((res) => res.text())
      .then((data) => {
        headerContainer.innerHTML = data;
        initThemeToggle(); // Initialize Theme button events after header elements exist
      })
      .catch((err) => console.error("Header loading failed:", err));
  }

  // 2. Load Footer Dynamically
  const footerContainer = document.getElementById("site-footer");
  if (footerContainer) {
    fetch("/components/footer.html")
      .then((res) => res.text())
      .then((data) => {
        footerContainer.innerHTML = data;
      })
      .catch((err) => console.error("Footer loading failed:", err));
  }
});

// Theme Switcher Functionality
function initThemeToggle() {
  const themeBtn = document.getElementById("themeBtn");
  const themeIcon = document.getElementById("themeIcon");

  if (!themeBtn) return;

  themeBtn.addEventListener("click", () => {
    document.body.classList.toggle("light-mode");
    const isLight = document.body.classList.contains("light-mode");

    if (isLight) {
      document.documentElement.setAttribute("data-theme", "light");
      themeIcon.innerHTML = `<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>`;
    } else {
      document.documentElement.setAttribute("data-theme", "dark");
      themeIcon.innerHTML = `
        <circle cx="12" cy="12" r="5"></circle>
        <line x1="12" y1="1" x2="12" y2="3"></line>
        <line x1="12" y1="21" x2="12" y2="23"></line>
        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
        <line x1="1" y1="12" x2="3" y2="12"></line>
        <line x1="21" y1="12" x2="23" y2="12"></line>
        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
        <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
      `;
    }
  });
}
