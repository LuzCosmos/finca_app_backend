import { mergeLw001ShockAndManDownDefaults } from './lw001-bg-pro-parameter-encoder';

describe('mergeLw001ShockAndManDownDefaults', () => {
  it('fuerza ambos switches a true y rellena subcampos cuando faltan', () => {
    const out = mergeLw001ShockAndManDownDefaults({
      workingMode: 'periodic',
      heartbeatInterval: 600,
    });
    expect(out.shockDetectionSwitch).toBe(true);
    expect(out.manDownDetectionSwitch).toBe(true);
    expect(out.shockThreshold).toBe(30);
    expect(out.shockTimeout).toBe(15);
    expect(out.shockReportInterval).toBe(255);
    expect(out.idleDetectionTimeout).toBe(120);
  });

  it('corrige shockThreshold y shockTimeout fuera de rango', () => {
    const out = mergeLw001ShockAndManDownDefaults({
      workingMode: 'periodic',
      shockThreshold: 3,
      shockTimeout: 60,
    });
    expect(out.shockThreshold).toBe(30);
    expect(out.shockTimeout).toBe(15);
  });

  it('respeta valores shock e idle válidos ya presentes', () => {
    const out = mergeLw001ShockAndManDownDefaults({
      workingMode: 'periodic',
      shockThreshold: 20,
      shockTimeout: 5,
      shockReportInterval: 120,
      idleDetectionTimeout: 48,
    });
    expect(out.shockThreshold).toBe(20);
    expect(out.shockTimeout).toBe(5);
    expect(out.shockReportInterval).toBe(120);
    expect(out.idleDetectionTimeout).toBe(48);
  });
});
