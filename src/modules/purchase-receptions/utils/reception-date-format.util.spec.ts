import { formatDateYmd } from './reception-date-format.util';

describe('formatDateYmd', () => {
  it('formatea instancia Date en UTC', () => {
    expect(formatDateYmd(new Date('2020-03-15T12:00:00.000Z'))).toBe('2020-03-15');
  });

  it('acepta string YYYY-MM-DD como devuelve Postgres', () => {
    expect(formatDateYmd('2020-03-15')).toBe('2020-03-15');
    expect(formatDateYmd('2025-01-20T00:00:00.000Z')).toBe('2025-01-20');
  });

  it('devuelve undefined para null, vacío o inválido', () => {
    expect(formatDateYmd(null)).toBeUndefined();
    expect(formatDateYmd(undefined)).toBeUndefined();
    expect(formatDateYmd('')).toBeUndefined();
    expect(formatDateYmd('   ')).toBeUndefined();
    expect(formatDateYmd('no-es-fecha')).toBeUndefined();
  });
});
