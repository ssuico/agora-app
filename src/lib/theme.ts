export type ThemePreference = 'light' | 'dark' | 'system';

export const THEME_STORAGE_KEY = 'agora-theme';

// Keep in sync with the `theme-color` values in ThemeBoot.astro.
const THEME_COLOR = { light: '#ffffff', dark: '#1a1d21' } as const;

export function readThemePreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return stored === 'light' || stored === 'dark' ? stored : 'system';
  } catch {
    return 'system';
  }
}

export function applyThemePreference(pref: ThemePreference): void {
  try {
    if (pref === 'system') localStorage.removeItem(THEME_STORAGE_KEY);
    else localStorage.setItem(THEME_STORAGE_KEY, pref);
  } catch {
    // Storage can be blocked; the theme still applies for this page view.
  }
  const dark = pref === 'dark' || (pref === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[dark ? 'dark' : 'light']);
}
