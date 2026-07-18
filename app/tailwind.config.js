module.exports = {
  theme: {
    extend: {
      animation: {
        'magic-spinner': 'magicTransform 2.5s cubic-bezier(0.4, 0, 0.2, 1) infinite',
      },
      keyframes: {
        magicTransform: {
          '0%': { 
            transform: 'rotate(0deg)', 
            backgroundImage: 'linear-gradient(to right, #10b981, #06b6d4)' // Emerald à Cyan
          },
          '50%': { 
            backgroundImage: 'linear-gradient(to right, #3b82f6, #6366f1)' // Blue à Indigo
          },
          '100%': { 
            transform: 'rotate(360deg)', 
            backgroundImage: 'linear-gradient(to right, #10b981, #06b6d4)' // Retour au départ
          },
        },
      },
    },
  },
}
