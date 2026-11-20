import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { render, screen, fireEvent } from '@testing-library/react';
import { translations } from '../constants/translations';
import { LanguageProvider, useLanguage } from '../context/LanguageContext';

const SRC = resolve(__dirname, '..');
const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return entry === 'test' ? [] : walk(full);
    return full.endsWith('.tsx') ? [full] : [];
  });

describe('translation placeholders', () => {
  const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

  it('uses identical {placeholders} in English and Arabic for every key', () => {
    const mismatches = (Object.keys(translations.en) as Array<keyof typeof translations.en>)
      .filter((key) => JSON.stringify(placeholders(translations.en[key])) !== JSON.stringify(placeholders(translations.ar[key])))
      .map(String);
    expect(mismatches).toEqual([]);
  });
});

describe('t() interpolation', () => {
  const Probe = () => {
    const { t, toggleLanguage } = useLanguage();
    return (
      <div>
        <span data-testid="out">{t('toastCommunityCreated', { name: 'Web' })}</span>
        <span data-testid="missing">{t('replyToPlaceholder', {})}</span>
        <button onClick={toggleLanguage}>toggle</button>
      </div>
    );
  };

  it('replaces named params and leaves unknown placeholders intact', () => {
    localStorage.setItem('vortex_lang', 'en');
    render(
      <LanguageProvider>
        <Probe />
      </LanguageProvider>,
    );
    expect(screen.getByTestId('out')).toHaveTextContent('Created community "Web"!');
    expect(screen.getByTestId('missing')).toHaveTextContent('Reply to {name}...');
  });

  it('switches the same key to Arabic and keeps the interpolated value', () => {
    localStorage.setItem('vortex_lang', 'en');
    render(
      <LanguageProvider>
        <Probe />
      </LanguageProvider>,
    );
    fireEvent.click(screen.getByText('toggle'));
    expect(screen.getByTestId('out')).toHaveTextContent('تم إنشاء المجتمع "Web"!');
    expect(document.documentElement.getAttribute('dir')).toBe('rtl');
  });
});

describe('logical properties (RTL safety)', () => {
  // Physical utilities that must not appear in component class strings.
  const physical = /(?<![\w-])-?(?:ml|mr|pl|pr|left|right|text-left|text-right|rounded-l|rounded-r|rounded-tl|rounded-tr|rounded-bl|rounded-br|border-l|border-r|space-x|scroll-ml|scroll-mr)-[\w[\].%/]+(?![\w-])|(?<![\w-])(?:text-left|text-right)(?![\w-])/;

  it('has no physical margin/padding/position/rounding/border/space-x utilities in src', () => {
    const offenders: string[] = [];
    for (const file of walk(SRC)) {
      readFileSync(file, 'utf8')
        .split('\n')
        .forEach((line, idx) => {
          const classLike = [...line.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\})|['"`]([^'"`]*\b(?:flex|grid|px|py|rounded|text-)[^'"`]*)['"`]/g)];
          for (const m of classLike) {
            const value = m[1] ?? m[2] ?? m[3] ?? '';
            if (physical.test(value)) offenders.push(`${file.replace(SRC, 'src')}:${idx + 1}: ${value.trim().slice(0, 80)}`);
          }
        });
    }
    expect(offenders).toEqual([]);
  });

  it('flips every directional icon for RTL', () => {
    const directional = /<(ArrowLeft|ArrowRight|ChevronLeft|ChevronRight|CornerDownRight|Send)\b[^>]*>/g;
    const offenders: string[] = [];
    for (const file of walk(SRC)) {
      for (const m of readFileSync(file, 'utf8').matchAll(directional)) {
        if (!/rtl:(rotate-180|-scale-x-100)/.test(m[0])) offenders.push(`${file.replace(SRC, 'src')}: ${m[0].slice(0, 80)}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
