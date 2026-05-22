const LB_TO_KG = 0.45359237;

export function normalizeWeightToKg(
  weight: number | null,
  unit: string | null,
): { weight: number | null; unit: string | null } {
  if (weight == null) return { weight: null, unit };
  const u = (unit ?? 'kg').toLowerCase();
  if (u === 'lb') {
    return { weight: weight * LB_TO_KG, unit: 'kg' };
  }
  return { weight, unit: u === 'kg' ? 'kg' : unit };
}
