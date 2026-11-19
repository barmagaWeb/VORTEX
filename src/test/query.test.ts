import { describe, expect, it } from 'vitest';
import { escapeLikeLiteral, isUuid } from '../services/supabase/query';

describe('Supabase query input helpers', () => {
  it('escapes Postgres LIKE wildcard and escape characters', () => {
    expect(escapeLikeLiteral('100%_safe\\path')).toBe('100\\%\\_safe\\\\path');
  });

  it('recognizes UUID identifiers without accepting arbitrary filter syntax', () => {
    expect(isUuid('11111111-1111-4111-8111-111111111111')).toBe(true);
    expect(isUuid('11111111-1111-4111-8111-111111111111,role.eq.admin')).toBe(false);
  });
});
