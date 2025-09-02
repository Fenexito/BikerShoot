/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["Poppins", "sans-serif"], // 👈 para títulos y botones
      },
      colors: {
        studio: {
          bg: "#0b0f1a",
          panel: "#0f1115"
        }
      },
      boxShadow: {
        card: "0 10px 30px rgba(15,23,42,.08)"
      },
      borderRadius: {
        xl2: "1rem"
      }
    }
  },
  plugins: []
}
