/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        "neon-red": "#ff1a1a",
        "dark-bg": "#0a0a0a",
        "dark-surface": "#160808",
      },
      fontFamily: {
        mono: ["JetBrains Mono", "Courier New", "monospace"],
      },
      keyframes: {
        "subtle-shimmer": {
          "0%, 100%": { opacity: "0.5" },
          "50%": { opacity: "0.9" },
        },
        "pulse-glow": {
          "0%, 100%": {
            textShadow: "0 0 5px rgba(255,26,26,0.5), 0 0 10px rgba(255,26,26,0.3)",
          },
          "50%": {
            textShadow:
              "0 0 10px rgba(255,26,26,0.8), 0 0 20px rgba(255,26,26,0.5), 0 0 30px rgba(255,26,26,0.3)",
          },
        },
        shimmer: {
          "0%": { backgroundPosition: "200% 50%" },
          "100%": { backgroundPosition: "-200% 50%" },
        },
        "float-y": {
          "0%, 100%": { transform: "translateY(0px) rotate(0deg)" },
          "33%": { transform: "translateY(-20px) rotate(5deg)" },
          "66%": { transform: "translateY(-10px) rotate(-5deg)" },
        },
        "scan-line": {
          "0%": { transform: "translateY(-100%)" },
          "100%": { transform: "translateY(100vh)" },
        },
      },
      animation: {
        "subtle-shimmer": "subtle-shimmer 3s ease-in-out infinite",
        "pulse-glow": "pulse-glow 2s ease-in-out infinite",
        shimmer: "shimmer 4s linear infinite",
        "float-y": "float-y 8s ease-in-out infinite",
        "scan-line": "scan-line 6s linear infinite",
      },
    },
  },
  plugins: [],
};
