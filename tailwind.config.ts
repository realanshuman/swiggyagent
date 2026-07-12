import type { Config } from "tailwindcss";

/**
 * Swiggy-inspired design tokens.
 * - swiggy:    the 2024-rebrand bright orange used for primary actions
 * - saffron:   the classic Swiggy orange, used for gradients/accents
 * - ink:       Swiggy's near-black text color
 * - slate:     secondary text
 * - rating:    the green used on rating badges
 * - veg/nonveg: FSSAI food-mark colors
 * - im:        Instamart accent (violet)
 * - dineout:   Dineout accent (deep navy)
 */
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        swiggy: "#FF5200",
        saffron: "#FC8019",
        ink: "#282C3F",
        slate2: "#686B78",
        line: "#E9E9EB",
        cream: "#FFF8F4",
        rating: "#1BA672",
        veg: "#267E3E",
        nonveg: "#A03333",
        im: "#7C3AED",
        dineout: "#1E2A4A",
      },
      boxShadow: {
        card: "0 2px 12px rgba(40, 44, 63, 0.08)",
        pop: "0 6px 24px rgba(40, 44, 63, 0.16)",
      },
      borderRadius: {
        card: "16px",
      },
      keyframes: {
        typing: {
          "0%, 60%, 100%": { transform: "translateY(0)", opacity: "0.4" },
          "30%": { transform: "translateY(-4px)", opacity: "1" },
        },
        slideup: {
          from: { transform: "translateY(12px)", opacity: "0" },
          to: { transform: "translateY(0)", opacity: "1" },
        },
      },
      animation: {
        typing: "typing 1.2s infinite",
        slideup: "slideup 0.25s ease-out",
      },
    },
  },
  plugins: [],
};
export default config;
