import { useState } from 'react';
import { Moon, Sun } from 'lucide-react';
type Theme = 'light' | 'dark';
function savedTheme(): Theme {
    try {
        const stored = localStorage.getItem('atlas-theme');
        if (stored === 'dark' || stored === 'light') return stored;
    } catch { /* Storage may be disabled in a private browser session. */ }
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
function applyTheme(theme: Theme) {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
}
applyTheme(savedTheme());
export function ThemeToggle({ floating = false }: { floating?: boolean }) {
    const [theme, setTheme] = useState<Theme>(() => document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');
    return <button type="button" className={'icon-button theme-toggle' + (floating ? ' floating-theme' : '')}
        aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        onClick={() => {
            const next = theme === 'dark' ? 'light' : 'dark';
            setTheme(next); applyTheme(next);
            try { localStorage.setItem('atlas-theme', next); } catch { /* Theme still works without persistence. */ }
        }}>
        {theme === 'dark' ? <Sun size={19} /> : <Moon size={19} />}
    </button>;
}
