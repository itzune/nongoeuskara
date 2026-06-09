/**
 * Theme manager — handles light/dark mode with system preference detection.
 *
 * Applies the theme by adding a `.light` or `.dark` class to <html>.
 * Defaults to the user's OS/browser preference via prefers-color-scheme.
 * Respects a `theme` key in localStorage for user override.
 */

const THEME_KEY = "euskalkid-theme";

/**
 * Apply the current theme based on:
 * 1. Saved preference in localStorage
 * 2. System preference (prefers-color-scheme)
 * Falls back to dark theme.
 */
export function applyTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;

  let theme;
  if (saved === "light" || saved === "dark") {
    theme = saved;
  } else {
    theme = prefersDark ? "dark" : "light";
  }

  document.documentElement.classList.remove("light", "dark");
  document.documentElement.classList.add(theme);

  return theme;
}

/**
 * Listen for system theme changes and re-apply if no user preference is saved.
 */
export function listenForSystemChanges() {
  window
    .matchMedia("(prefers-color-scheme: dark)")
    .addEventListener("change", () => {
      // Only auto-switch if user hasn't manually set a preference
      if (!localStorage.getItem(THEME_KEY)) {
        applyTheme();
      }
    });
}

/**
 * Toggle between light and dark themes, persisting the choice.
 */
export function toggleTheme() {
  const current = document.documentElement.classList.contains("dark")
    ? "dark"
    : "light";
  const next = current === "dark" ? "light" : "dark";
  localStorage.setItem(THEME_KEY, next);
  applyTheme();
  return next;
}

/**
 * Get the current active theme name.
 */
export function getCurrentTheme() {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}
