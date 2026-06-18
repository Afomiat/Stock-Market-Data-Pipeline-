/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'deep-navy': '#050B14',
        'dark-card': '#0A1628',
        'card-surface': '#0F1E35',
        'electric-cyan': '#00D4FF',
        'neon-teal': '#00B8D9',
        'emerald-gain': '#00E5A0',
        'crimson-loss': '#FF4D6D',
        'soft-gold': '#FFD700',
        'muted': '#4A6080',
        'text-primary': '#E8F4FF',
        'text-secondary': '#8BAFC8',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      animation: {
        'pulse-slow': 'pulse 3s ease-in-out infinite',
        'spin-slow': 'spin 3s linear infinite',
      },
    },
  },
  plugins: [],
}
