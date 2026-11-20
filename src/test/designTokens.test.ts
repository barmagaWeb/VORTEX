import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Contrast regression tests. Token values are parsed from the real stylesheet so a future edit that
 * lowers a text token below WCAG 2.2 AA (4.5:1 for small text) fails here.
 */
const css = readFileSync(resolve(__dirname, '../styles/index.css'), 'utf8');

const block = (selector: string): string => {
  const start = css.indexOf(selector);
  expect(start, `selector ${selector} present`).toBeGreaterThan(-1);
  const open = css.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < css.length; i += 1) {
    if (css[i] === '{') depth += 1;
    if (css[i] === '}') {
      depth -= 1;
      if (depth === 0) return css.slice(open, i);
    }
  }
  throw new Error('unbalanced css');
};

type RGB = [number, number, number];
const parseTokens = (body: string): Record<string, RGB> => {
  const out: Record<string, RGB> = {};
  for (const m of body.matchAll(/--v-([\w-]+):\s*(\d+)\s+(\d+)\s+(\d+)\s*;/g)) {
    out[m[1]] = [Number(m[2]), Number(m[3]), Number(m[4])];
  }
  return out;
};
const light = parseTokens(block(':root {'));
const dark = { ...light, ...parseTokens(block('.dark {')) };

const channel = (v: number) => {
  const s = v / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
const luminance = ([r, g, b]: RGB) => 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
const contrast = (a: RGB, b: RGB) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
const over = (fg: RGB, bg: RGB, alpha: number): RGB =>
  [0, 1, 2].map((i) => Math.round(fg[i] * alpha + bg[i] * (1 - alpha))) as RGB;

const themes = { light, dark } as const;

describe('design token contrast (WCAG AA, small text 4.5:1)', () => {
  for (const [name, tokens] of Object.entries(themes)) {
    describe(name, () => {
      const surfaces = ['bg', 'surface', 'surface-card', 'surface-hover'] as const;

      it.each(surfaces)('fg-subtle on %s', (surface) => {
        expect(contrast(tokens['fg-subtle'], tokens[surface])).toBeGreaterThanOrEqual(4.5);
      });

      it.each(surfaces)('fg-muted on %s', (surface) => {
        expect(contrast(tokens['fg-muted'], tokens[surface])).toBeGreaterThanOrEqual(4.5);
      });

      it.each(surfaces)('primary-text on %s and on primary/15 tint', (surface) => {
        expect(contrast(tokens['primary-text'], tokens[surface])).toBeGreaterThanOrEqual(4.5);
        const tint = over(tokens.primary, tokens[surface], 0.15);
        expect(contrast(tokens['primary-text'], tint)).toBeGreaterThanOrEqual(4.5);
      });

      it.each(surfaces)('danger-text on %s and on danger/10 tint', (surface) => {
        expect(contrast(tokens['danger-text'], tokens[surface])).toBeGreaterThanOrEqual(4.5);
        const tint = over(tokens.danger, tokens[surface], 0.1);
        expect(contrast(tokens['danger-text'], tint)).toBeGreaterThanOrEqual(4.5);
      });

      it.each(surfaces)('success-text on %s and on success/15 tint', (surface) => {
        expect(contrast(tokens['success-text'], tokens[surface])).toBeGreaterThanOrEqual(4.5);
        const tint = over(tokens.success, tokens[surface], 0.15);
        expect(contrast(tokens['success-text'], tint)).toBeGreaterThanOrEqual(4.5);
      });
    });
  }

  it('keeps visual hierarchy: fg-subtle is dimmer than fg-muted in both themes', () => {
    for (const tokens of Object.values(themes)) {
      expect(contrast(tokens['fg-subtle'], tokens.surface)).toBeLessThan(
        contrast(tokens['fg-muted'], tokens.surface),
      );
    }
  });
});
