/**
 * Light/dark theme handling.
 *
 * The user picks "system", "light" or "dark" (Settings, Phase 10). We store
 * the choice in localStorage and reflect the *resolved* theme as
 * <html data-theme="light|dark">, which globals.css reads.
 *
 * The tricky part is avoiding a "flash": React hydrates after the first
 * paint, so if we waited for React to set the theme, dark-mode users would see
 * a white screen for a split second. THEME_SCRIPT is a tiny piece of plain JS
 * that layout.tsx inlines into <head>; it runs before anything is painted.
 */

export type ThemePreference = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "theme";

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === "system" || value === "light" || value === "dark";
}

/** Turn a preference into an actual theme, given whether the OS is dark. */
export function resolveTheme(pref: ThemePreference, systemIsDark: boolean): ResolvedTheme {
  if (pref === "system") return systemIsDark ? "dark" : "light";
  return pref;
}

// Kept as a string because it is injected verbatim into the HTML. It mirrors
// resolveTheme() above; it is wrapped in try/catch because localStorage can
// throw (Safari private mode, blocked storage).
export const THEME_SCRIPT = `(function(){try{var p=localStorage.getItem("${THEME_STORAGE_KEY}");if(p!=="light"&&p!=="dark")p="system";var d=p==="dark"||(p==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.dataset.theme=d?"dark":"light";}catch(e){}})();`;
