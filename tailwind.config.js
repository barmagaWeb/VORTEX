/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Semantic design tokens powered by CSS variables
        bg: 'rgb(var(--v-bg) / <alpha-value>)',
        surface: {
          DEFAULT: 'rgb(var(--v-surface) / <alpha-value>)',
          elevated: 'rgb(var(--v-surface-elevated) / <alpha-value>)',
          hover: 'rgb(var(--v-surface-hover) / <alpha-value>)',
          card: 'rgb(var(--v-surface-card) / <alpha-value>)',
          active: 'rgb(var(--v-surface-active) / <alpha-value>)',
        },
        border: {
          DEFAULT: 'rgb(var(--v-border) / <alpha-value>)',
          subtle: 'rgb(var(--v-border-subtle) / <alpha-value>)',
        },
        line: 'rgb(var(--v-border) / <alpha-value>)',
        fg: {
          DEFAULT: 'rgb(var(--v-fg) / <alpha-value>)',
          muted: 'rgb(var(--v-fg-muted) / <alpha-value>)',
          subtle: 'rgb(var(--v-fg-subtle) / <alpha-value>)',
        },
        primary: {
          DEFAULT: 'rgb(var(--v-primary) / <alpha-value>)',
          hover: 'rgb(var(--v-primary-hover) / <alpha-value>)',
          fg: 'rgb(var(--v-primary-fg) / <alpha-value>)',
          text: 'rgb(var(--v-primary-text) / <alpha-value>)',
        },
        accent: {
          DEFAULT: 'rgb(var(--v-accent) / <alpha-value>)',
          fg: 'rgb(var(--v-accent-fg) / <alpha-value>)',
        },
        success: {
          DEFAULT: 'rgb(var(--v-success) / <alpha-value>)',
          text: 'rgb(var(--v-success-text) / <alpha-value>)',
        },
        warning: 'rgb(var(--v-warning) / <alpha-value>)',
        danger: {
          DEFAULT: 'rgb(var(--v-danger) / <alpha-value>)',
          text: 'rgb(var(--v-danger-text) / <alpha-value>)',
        },
        ring: 'rgb(var(--v-ring) / <alpha-value>)',
        overlay: 'rgb(var(--v-overlay) / <alpha-value>)',

        // Legacy / Palette references preserved for backwards compatibility
        vortex: {
          dark: {
            bg: '#0A0D14',
            surface: '#0F131D',
            elevated: '#151926',
            card: '#181E2E',
            hover: '#22293D',
            border: '#232A3E',
            borderSubtle: '#192032',
          },
          light: {
            bg: '#F8FAFC',
            surface: '#FFFFFF',
            elevated: '#FFFFFF',
            card: '#FFFFFF',
            hover: '#F1F5F9',
            border: '#E2E8F0',
            borderSubtle: '#EDF2F7',
          },
          violet: {
            DEFAULT: '#7C3AED',
            50: '#F5F3FF',
            100: '#EDE9FE',
            200: '#DDD6FE',
            300: '#C4B5FD',
            400: '#A78BFA',
            500: '#8B5CF6',
            600: '#7C3AED',
            700: '#6D28D9',
            800: '#5B21B6',
            900: '#4C1D95',
            glow: 'rgba(124, 58, 237, 0.35)',
          },
          blue: {
            DEFAULT: '#3B82F6',
            400: '#60A5FA',
            500: '#3B82F6',
            600: '#2563EB',
            glow: 'rgba(59, 130, 246, 0.35)',
          },
          cyan: '#06B6D4',
          accent: {
            gradientFrom: '#8B5CF6',
            gradientTo: '#3B82F6',
          }
        }
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', '-apple-system', 'sans-serif'],
        arabic: ['"IBM Plex Sans Arabic"', '"Cairo"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'card': 'var(--v-shadow-card)',
        'vortex-glow': '0 0 25px -5px rgba(139, 92, 246, 0.35)',
        'vortex-blue-glow': '0 0 25px -5px rgba(59, 130, 246, 0.35)',
        'card-dark': '0 4px 20px -2px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.05)',
        'card-light': '0 4px 20px -2px rgba(0, 0, 0, 0.06), 0 0 0 1px rgba(0, 0, 0, 0.05)',
      },
      animation: {
        'pulse-subtle': 'pulseSubtle 3s ease-in-out infinite',
      },
      keyframes: {
        pulseSubtle: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.85' },
        }
      }
    },
  },
  plugins: [],
}
