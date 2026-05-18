import { ScaleStabilityDetector } from './scale-stability-detector';

describe('ScaleStabilityDetector', () => {
  const config = {
    tolerancePercent: 0.5,
    consecutiveReadings: 3,
    zeroThresholdKg: 0.1,
  };

  it('marks stable when 3 readings within tolerance', () => {
    const d = new ScaleStabilityDetector(config);
    expect(d.add({ weight: 350, unit: 'kg' }).isStable).toBe(false);
    expect(d.add({ weight: 350.8, unit: 'kg' }).isStable).toBe(false);
    expect(d.add({ weight: 349.9, unit: 'kg' }).isStable).toBe(true);
  });

  it('rejects excessive variation', () => {
    const d = new ScaleStabilityDetector(config);
    d.add({ weight: 350, unit: 'kg' });
    d.add({ weight: 360, unit: 'kg' });
    expect(d.add({ weight: 370, unit: 'kg' }).isStable).toBe(false);
  });

  it('rejects zero readings', () => {
    const d = new ScaleStabilityDetector(config);
    expect(d.add({ weight: 0.05, unit: 'kg' }).reason).toBe('below_zero_threshold');
  });
});
