// Tailwind 빌드 설정 (index.html 의 예전 CDN 설정을 그대로 옮김)
module.exports = {
  content: ['./index.html'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: { apple: { gray: '#F5F5F7', dark: '#1C1C1E', darkCard: '#2C2C2E' } },
      fontFamily: { batang: ['"Gowun Batang"', 'serif'] },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-up': 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        'zoom-in': 'zoomIn 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
        'zoom-out': 'zoomOut 0.2s cubic-bezier(0.4, 0.0, 0.2, 1)',
      },
      keyframes: {
        fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        slideUp: { '0%': { transform: 'translateY(20px)', opacity: '0' }, '100%': { transform: 'translateY(0)', opacity: '1' } },
        zoomIn: { '0%': { opacity: '0', transform: 'scale(0.9)' }, '100%': { opacity: '1', transform: 'scale(1)' } },
        zoomOut: { '0%': { opacity: '1', transform: 'scale(1)' }, '100%': { opacity: '0', transform: 'scale(0.9)' } },
      },
    },
  },
};
