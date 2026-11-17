import { describe, expect, it } from 'vitest';
import { booksByCountry, countryName, countryNumeric, toCountryCode } from './countries';

describe('países', () => {
  it('nomes em português e códigos do mapa', () => {
    expect(countryName('BR')).toBe('Brasil');
    expect(countryName('GB')).toMatch(/Reino Unido/);
    expect(countryNumeric('BR')).toBe('076');
  });
  it('entende nome em português, inglês ou código', () => {
    expect(toCountryCode('Brasil')).toBe('BR');
    expect(toCountryCode('Colombia')).toBe('CO');
    expect(toCountryCode('jp')).toBe('JP');
    expect(toCountryCode('Terra Média')).toBeUndefined();
  });
  it('conta só livros lidos', () => {
    const m = booksByCountry([
      { country: 'BR', status: 'lido' }, { country: 'BR', status: 'relendo' }, { country: 'BR', status: 'quero_ler' }, { country: 'US', status: 'lido' }, { status: 'lido' },
    ]);
    expect(m.get('BR')).toHaveLength(2);
    expect(m.get('US')).toHaveLength(1);
    expect(m.size).toBe(2);
  });
});
