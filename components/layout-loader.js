// LocalStorage سے پرانی سیٹ کی ہوئی تھیم پڑھیں
const savedTheme = localStorage.getItem("app-theme") || "dark";
applyTheme(savedTheme);

document.addEventListener("DOMContentLoaded", function () {
  // 1. Load Header
  const headerContainer = document.getElementById("site-header");
  if (headerContainer) {
    fetch("/components/header.html")
      .then((res) => res.text())
      .then((data) => {
        headerContainer.innerHTML = data;
        initThemeToggle();
      });
  }

  // 2. Load Footer
  const footerContainer = document.getElementById("site-footer");
  if (footerContainer) {
    fetch("/components/footer.html")
      .then((res) => res.text())
      .then((data) => {
        footerContainer.innerHTML = data;
      });
  }
});

// Theme Switcher Engine
function initThemeToggle() {
  const themeBtn = document.getElementById("themeBtn");
  if (!themeBtn) return;

  // موجودہ حالت کے مطابق آئیکن کی ترتیب
  updateThemeIcon(localStorage.getItem("app-theme") || "dark");

  themeBtn.addEventListener("click", () => {
    const currentTheme = document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
    const newTheme = currentTheme === "light" ? "dark" : "light";
    
    applyTheme(newTheme);
    localStorage.setItem("app-theme", newTheme);
  });
}

function applyTheme(theme) {
  if (theme === "light") {
    document.documentElement.setAttribute("data-theme", "light");
    document.body.classList.add("light-mode");
  } else {
    document.documentElement.setAttribute("data-theme", "dark");
    document.body.classList.remove("light-mode");
  }
  updateThemeIcon(theme);
}

function updateThemeIcon(theme) {
  const themeIcon = document.getElementById("themeIcon");
  if (!themeIcon) return;

  if (theme === "light") {
    themeIcon.innerHTML = `<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>`;
  } else {
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
}
