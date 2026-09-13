import { describe, expect, it } from 'vitest';
import {
  composeImpressum,
  GERMAN_PRIVACY,
  GERMAN_TERMS,
  resolveLegalTexts,
} from './legal-templates.js';

describe('legal templates', () => {
  it('does not invent café contact details', () => {
    const text = composeImpressum({
      name: '',
      street: '',
      postalCity: '',
      phone: '',
      email: '',
      owner: '',
      vatId: '',
      notes: '',
    });
    expect(text).toContain('§ 5 Digitale-Dienste-Gesetz');
    expect(text).not.toMatch(/\d{5}/);
    expect(text.toLowerCase()).not.toContain('mustermann');
    expect(text).not.toMatch(/\+49/);
  });

  it('builds Impressum only from filled contact fields', () => {
    const text = composeImpressum({
      name: 'Roots Café',
      street: 'Musterstraße 1',
      postalCity: '10115 Berlin',
      phone: '+49 30 123456',
      email: 'cafe@example.com',
      owner: 'Ada Example',
      vatId: 'DE123',
      notes: '',
    });
    expect(text).toContain('Roots Café');
    expect(text).toContain('Musterstraße 1');
    expect(text).toContain('Ada Example');
    expect(text).toContain('cafe@example.com');
  });

  it('serves German café GDPR and AGB when texts are empty', () => {
    const resolved = resolveLegalTexts({});
    expect(resolved.privacy).toBe(GERMAN_PRIVACY);
    expect(resolved.terms).toBe(GERMAN_TERMS);
    expect(resolved.privacy).toContain('Art. 6 Abs. 1');
    expect(resolved.terms).toContain('Nicht abgeholte Bestellungen');
  });
});
