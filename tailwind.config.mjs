/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/renderer/index.html', './src/renderer/src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['"DM Sans"', 'Segoe UI', 'system-ui', 'sans-serif'],
        display: ['Sora', '"DM Sans"', 'Segoe UI', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace']
      },
      fontSize: {
        '2xs': ['10px', { lineHeight: '1.4' }],
        xs: ['11.5px', { lineHeight: '1.45' }],
        sm: ['13px', { lineHeight: '1.5' }],
        base: ['15px', { lineHeight: '1.5' }],
        lg: ['17px', { lineHeight: '1.3' }],
        xl: ['21px', { lineHeight: '1.28' }],
        '2xl': ['27px', { lineHeight: '1.16' }],
        '3xl': ['34px', { lineHeight: '1.12' }]
      },
      borderRadius: {
        none: '0',
        sm: '3px',
        DEFAULT: '3px',
        md: '3px',
        lg: '8px',
        xl: '12px',
        '2xl': '12px',
        full: '9999px'
      },
      colors: {
        window: 'var(--window)',
        canvas: 'var(--canvas)',
        panel: 'var(--panel)',
        chrome: {
          DEFAULT: 'var(--chrome)',
          2: 'var(--chrome-2)',
          3: 'var(--chrome-3)'
        },
        well: 'var(--well)',
        line: {
          DEFAULT: 'var(--line)',
          control: 'var(--line-control)',
          hover: 'var(--line-hover)'
        },
        ink: {
          DEFAULT: 'var(--text-primary)',
          soft: 'var(--text-secondary)',
          mute: 'var(--text-muted)'
        },
        accent: {
          DEFAULT: 'var(--accent)',
          hover: 'var(--accent-hover)',
          pressed: 'var(--accent-pressed)',
          soft: 'var(--accent-soft)',
          text: 'var(--accent-text)',
          strong: 'var(--accent-text-strong)',
          on: 'var(--accent-on)'
        },
        ok: 'var(--ok)',
        warn: 'var(--warn)',
        bad: 'var(--bad)',
        info: 'var(--info)'
      },
      boxShadow: {
        glow: 'var(--glow)',
        window: 'var(--elev-window)',
        popover: 'var(--elev-popover)',
        dialog: 'var(--elev-dialog)',
        well: 'inset 0 2px 6px rgba(4, 5, 14, 0.28)'
      },
      transitionTimingFunction: {
        standard: 'var(--ease-standard)',
        out: 'var(--ease-out)'
      },
      keyframes: {
        loading: { '0%': { transform: 'translateX(-100%)' }, '100%': { transform: 'translateX(400%)' } },
        'toast-in': {
          from: { opacity: '0', transform: 'translateX(16px)' },
          to: { opacity: '1', transform: 'translateX(0)' }
        },
        'dialog-in': {
          from: { opacity: '0', transform: 'translateY(12px) scale(0.985)' },
          to: { opacity: '1', transform: 'translateY(0) scale(1)' }
        },
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        spin: { to: { transform: 'rotate(360deg)' } }
      },
      animation: {
        loading: 'loading 1s linear infinite',
        'toast-in': 'toast-in 0.32s var(--ease-out)',
        'dialog-in': 'dialog-in 0.32s var(--ease-out)',
        'fade-in': 'fade-in 0.2s var(--ease-standard)',
        'spin-slow': 'spin 1s linear infinite'
      }
    }
  },
  plugins: []
}
