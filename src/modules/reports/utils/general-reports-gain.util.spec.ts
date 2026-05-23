import {
  parseTenantAverageDailyGain,
  resolveGainEfectivoKg,
  roundFarmAverageDailyGainKg,
} from './general-reports-gain.util';

describe('general-reports-gain.util', () => {
  describe('resolveGainEfectivoKg', () => {
    it('usa ADG de la res si es no nulo y distinto de cero', () => {
      expect(resolveGainEfectivoKg(1.2, 0.5)).toBe(1.2);
    });

    it('trata ADG 0 como no definido y aplica fallback tenant', () => {
      expect(resolveGainEfectivoKg(0, 0.5)).toBe(0.5);
    });

    it('sin ADG ni fallback tenant retorna null', () => {
      expect(resolveGainEfectivoKg(null, null)).toBeNull();
    });
  });

  describe('parseTenantAverageDailyGain', () => {
    it('parsea valor numérico válido', () => {
      expect(parseTenantAverageDailyGain('0.462')).toBe(0.462);
    });

    it('retorna null para vacío o no numérico', () => {
      expect(parseTenantAverageDailyGain('')).toBeNull();
      expect(parseTenantAverageDailyGain('abc')).toBeNull();
    });
  });

  describe('roundFarmAverageDailyGainKg', () => {
    it('redondea a 3 decimales', () => {
      expect(roundFarmAverageDailyGainKg(0.7333333)).toBe(0.733);
    });
  });
});
