/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: ['class', '.theme-studio.dark'],
  theme: {
    extend: {
      colors: {
        background: 'var(--color-background)',
        foreground: 'var(--color-foreground)',
        muted: 'var(--color-muted)',
        'muted-foreground': 'var(--color-muted-foreground)',
        primary: 'var(--color-primary)',
        'primary-foreground': 'var(--color-primary-foreground)',
        secondary: 'var(--color-secondary)',
        'secondary-foreground': 'var(--color-secondary-foreground)',
        accent: 'var(--color-accent)',
        'accent-foreground': 'var(--color-accent-foreground)',
        border: 'var(--color-border)',
        'border-hover': 'var(--color-border-hover)',
        input: 'var(--color-input)',
        card: 'var(--color-card)',
        'card-foreground': 'var(--color-card-foreground)',
        ring: 'var(--color-ring)',
      },
      fontFamily: {
        // Bold Typography (studio)
        studio: ['"Inter Tight"', 'Inter', 'system-ui', 'sans-serif'],
        'studio-display': ['"Playfair Display"', 'Georgia', 'serif'],
        'studio-mono': ['"JetBrains Mono"', '"Fira Code"', 'monospace'],
        // Flat Design (público / biker)
        flat: ['Outfit', 'sans-serif'],
      },
      letterSpacing: {
        tighter2: '-0.06em',
        tight2: '-0.04em',
        wider2: '0.1em',
        widest2: '0.2em',
      },
      fontSize: {
        '5xl': ['3.5rem', { lineHeight: '1.1' }],
        '6xl': ['4.5rem', { lineHeight: '1.1' }],
        '7xl': ['6rem', { lineHeight: '1' }],
        '8xl': ['8rem', { lineHeight: '1' }],
        '9xl': ['10rem', { lineHeight: '1' }],
      },
    },
  },
  plugins: [],
}
