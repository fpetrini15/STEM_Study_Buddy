const THEME_KEY = "stemStudyBuddy.theme";

(function initTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  if (saved === "dark" || saved === "light") {
    document.documentElement.setAttribute("data-theme", saved);
    return;
  }
  if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
    document.documentElement.setAttribute("data-theme", "dark");
  }
})();

const Theme = {
  isDark() {
    return document.documentElement.getAttribute("data-theme") === "dark";
  },

  toggle() {
    const next = this.isDark() ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem(THEME_KEY, next);
    this.updateToggleButton();
  },

  updateToggleButton() {
    const btn = document.getElementById("theme-toggle");
    if (!btn) return;

    const dark = this.isDark();
    btn.textContent = dark ? "☀️" : "🌙";
    btn.setAttribute(
      "aria-label",
      dark ? "Switch to light mode" : "Switch to dark mode"
    );
  },

  bindToggle() {
    const btn = document.getElementById("theme-toggle");
    if (!btn || btn.dataset.bound) return;

    btn.dataset.bound = "true";
    btn.addEventListener("click", () => this.toggle());
    this.updateToggleButton();
  },
};
