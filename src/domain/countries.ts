import countries from 'i18n-iso-countries';
import pt from 'i18n-iso-countries/langs/pt.json';

countries.registerLocale(pt);

/** Nome do país em português a partir do código ISO de 2 letras (ex.: "BR" → "Brasil"). */
export const countryName = (code?: string) => (code ? countries.getName(code, 'pt') ?? code : '');

/** Código numérico usado no mapa (ex.: "BR" → "076"). */
export const countryNumeric = (code: string) => countries.alpha2ToNumeric(code);

/** Lista para escolher o país, em ordem alfabética. */
export const COUNTRY_OPTIONS = Object.entries(countries.getNames('pt', { select: 'official' }))
  .map(([code, name]) => ({ code, name }))
  .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

/** Aceita nome em português, em inglês ou código ("Brasil", "Brazil", "BR") e devolve o código. */
export function toCountryCode(value?: string | null) {
  if (!value) return undefined;
  const v = value.trim();
  if (/^[A-Za-z]{2}$/.test(v) && countries.isValid(v.toUpperCase())) return v.toUpperCase();
  return countries.getAlpha2Code(v, 'pt') ?? countries.getAlpha2Code(v, 'en') ?? undefined;
}

/** Livros lidos por país de origem. */
export function booksByCountry<T extends { country?: string; status: string }>(books: T[]) {
  const m = new Map<string, T[]>();
  for (const b of books) {
    if (!b.country || (b.status !== 'lido' && b.status !== 'relendo')) continue;
    if (!m.has(b.country)) m.set(b.country, []);
    m.get(b.country)!.push(b);
  }
  return m;
}
