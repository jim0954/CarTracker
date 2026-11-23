// Tailwind Play CDN 設定（需在 tailwindcss CDN 之後載入）
// 介面配色用 CSS 變數（css/theme.css）：經典深色與明亮兩套主題共用同一份 HTML，
// <html data-theme="..."> 決定套用哪一套。
(() => {
  const SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
  const palette = name => Object.fromEntries(SHADES.map(s => [s, `rgb(var(--${name}-${s}) / <alpha-value>)`]));
  const slate = palette('slate');
  // 經典主題沒有這兩個中間色階（維持原本的透明），明亮主題才定義
  slate[750] = 'var(--slate-750)';
  slate[850] = 'var(--slate-850)';

  tailwind.config = {
    darkMode: 'class',
    theme: {
      extend: {
        colors: {
          slate,
          emerald: palette('emerald'),
          teal: palette('teal'),
          amber: palette('amber'),
          rose: palette('rose'),
          sky: palette('sky'),
          indigo: palette('indigo'),
          violet: palette('violet')
        }
      }
    }
  };
})();
