/**
 * Formatea fechas de columna `date` de Postgres / TypeORM a `YYYY-MM-DD`.
 * El driver puede devolver `Date` o string (`'2020-03-15'`).
 */
export function formatDateYmd(
  value: Date | string | null | undefined,
): string | undefined {
  if (value == null) return undefined;

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
      return trimmed.slice(0, 10);
    }
    const parsed = new Date(trimmed);
    if (Number.isNaN(parsed.getTime())) return undefined;
    value = parsed;
  }

  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    return undefined;
  }

  const y = value.getUTCFullYear();
  const mo = String(value.getUTCMonth() + 1).padStart(2, '0');
  const da = String(value.getUTCDate()).padStart(2, '0');
  return `${y}-${mo}-${da}`;
}
