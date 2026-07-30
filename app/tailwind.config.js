/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      keyframes: {
        laserScan: {
          '0%': { left: '-40%', filter: 'hue-rotate(0deg)' },
          '50%': { filter: 'hue-rotate(180deg)' },
          '100%': { left: '100%', filter: 'hue-rotate(360deg)' },
        }
      },
      animation: {
        'magic-laser': 'laserScan 2s infinite linear',
      }
    },
  },
  plugins: [],
}
