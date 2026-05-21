/**
 * Resuelve ganancia diaria efectiva (kg/día) por res según RB-03 de reportes generales.
 */
export function resolveGainEfectivoKg(
  cattleAverageDailyGain: number | null | undefined,
  tenantFallbackKg: number | null,
): number | null {
  const cattleAdg =
    cattleAverageDailyGain != null ? Number(cattleAverageDailyGain) : null;
  if (cattleAdg != null && cattleAdg !== 0) {
    return cattleAdg;
  }
  if (tenantFallbackKg != null && !Number.isNaN(tenantFallbackKg)) {
    return tenantFallbackKg;
  }
  return null;
}

export function parseTenantAverageDailyGain(value: string | undefined | null): number | null {
  if (value == null || value.trim() === '') {
    return null;
  }
  const parsed = parseFloat(value);
  if (Number.isNaN(parsed)) {
    return null;
  }
  return parsed;
}

export function roundFarmAverageDailyGainKg(value: number): number {
  return Math.round(value * 1000) / 1000;
}
