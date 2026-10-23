// Tailwind Play CDN 設定（需在 tailwindcss CDN 之後載入）
tailwind.config = {
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0fdf4',
          100: '#dcfce7',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d'
        },
        accent: {
          50: '#f0f9ff',
          500: '#0ea5e9',
          600: '#0284c7'
        }
      }
    }
  }
};
