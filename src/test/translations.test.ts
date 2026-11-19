import { describe, it, expect } from 'vitest';
import { translations } from '../constants/translations';

describe('Bilingual Localization Completeness', () => {
  it('should ensure every English translation key has an Arabic equivalent', () => {
    const enKeys = Object.keys(translations.en);
    const arKeys = Object.keys(translations.ar);

    const missingInAr = enKeys.filter((key) => !(key in translations.ar));
    expect(missingInAr).toEqual([]);
    expect(arKeys.length).toBeGreaterThanOrEqual(enKeys.length);
  });

  it('should verify translations contain no empty strings', () => {
    Object.entries(translations.en).forEach(([key, val]) => {
      expect(val, `English key ${key} should not be empty`).toBeTruthy();
    });
    Object.entries(translations.ar).forEach(([key, val]) => {
      expect(val, `Arabic key ${key} should not be empty`).toBeTruthy();
    });
  });
});
