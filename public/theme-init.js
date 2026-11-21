(function () {
  try {
    var saved = localStorage.getItem('vortex_theme');
    var systemDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    var theme = (saved === 'light' || saved === 'dark') ? saved : (systemDark ? 'dark' : 'light');
    var root = document.documentElement;

    if (theme === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
      root.style.colorScheme = 'dark';
    } else {
      root.classList.add('light');
      root.classList.remove('dark');
      root.style.colorScheme = 'light';
    }

    var meta = document.getElementById('theme-color-meta') || document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#0A0D14' : '#F8FAFC');

    var savedLang = localStorage.getItem('vortex_lang');
    if (savedLang === 'ar') {
      root.setAttribute('lang', 'ar');
      root.setAttribute('dir', 'rtl');
    } else {
      root.setAttribute('lang', 'en');
      root.setAttribute('dir', 'ltr');
    }
  } catch (e) {}
})();
