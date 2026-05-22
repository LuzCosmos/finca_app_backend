import { normalizeWeightToKg } from './scale-weight-unit';

describe('normalizeWeightToKg', () => {
  it('converts lb to kg', () => {
    const r = normalizeWeightToKg(100, 'lb');
    expect(r.unit).toBe('kg');
    expect(r.weight).toBeCloseTo(45.359237, 4);
  });

  it('keeps kg unchanged', () => {
    const r = normalizeWeightToKg(350.5, 'kg');
    expect(r.weight).toBe(350.5);
    expect(r.unit).toBe('kg');
  });
});
