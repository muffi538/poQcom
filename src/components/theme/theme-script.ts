// Runs synchronously before paint (see layout.tsx) so the correct theme
// class is on <html> before React hydrates — avoids a flash of the wrong
// theme. Kept as a plain string injected via dangerouslySetInnerHTML
// rather than a script file, since Next can't guarantee load order for
// external/deferred scripts this early.
export const THEME_INIT_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem('theme');
    var isDark = stored === 'dark' || (stored !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle('dark', isDark);
  } catch (e) {}
})();
`;
