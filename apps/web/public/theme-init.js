// Applies the saved theme/density before first paint to avoid a flash of the wrong theme.
(function () {
  try {
    var t = JSON.parse(localStorage.getItem('tt.theme') || '"system"');
    var dark = t === 'dark' || (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    var d = JSON.parse(localStorage.getItem('tt.density') || '"comfortable"');
    document.documentElement.setAttribute('data-density', d);
  } catch (e) {}
})();
