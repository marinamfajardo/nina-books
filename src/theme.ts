export type Theme = 'auto' | 'light' | 'dark';
const KEY = 'nina.theme';

export const getTheme = (): Theme => {
  try {
    return (localStorage.getItem(KEY) as Theme) || 'auto';
  } catch {
    return 'auto';
  }
};

export function applyTheme(t: Theme = getTheme()) {
  const root = document.documentElement;
  if (t === 'auto') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', t);
  try {
    localStorage.setItem(KEY, t);
  } catch { /* modo privado */ }
  const dark = t === 'dark' || (t === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#3a0a1b' : '#6d1a36');
}
