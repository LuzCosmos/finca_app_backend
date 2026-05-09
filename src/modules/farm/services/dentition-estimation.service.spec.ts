import { BadRequestException } from '@nestjs/common';
import { DentitionEstimationService } from './dentition-estimation.service';

describe('DentitionEstimationService', () => {
  let service: DentitionEstimationService;

  beforeEach(() => {
    service = new DentitionEstimationService();
  });

  describe('estimateAgeDays', () => {
    it('resuelve coincidencia exacta (2 leche, 0 perm, desgaste leche 1)', () => {
      expect(service.estimateAgeDays({ milkTeeth: 2, permanentTeeth: 0, milkWear: 1, permanentWear: 0 })).toBe(0);
    });

    it('resuelve fila 8 leche desgaste 3 → 365 días', () => {
      expect(service.estimateAgeDays({ milkTeeth: 8, permanentTeeth: 0, milkWear: 3, permanentWear: 2 })).toBe(365);
    });

    it('resuelve 6 leche + 2 permanente con desgastes en intervalo → 730', () => {
      expect(service.estimateAgeDays({ milkTeeth: 6, permanentTeeth: 2, milkWear: 3, permanentWear: 1 })).toBe(730);
    });

    it('resuelve 0 leche + 8 permanente desgaste perm 5 → 4745', () => {
      expect(service.estimateAgeDays({ milkTeeth: 0, permanentTeeth: 8, milkWear: 2, permanentWear: 5 })).toBe(4745);
    });

    it('sin regla para el par de conteos lanza DENTITION_NO_RULE_FOR_COUNTS', () => {
      expect(() =>
        service.estimateAgeDays({ milkTeeth: 1, permanentTeeth: 0, milkWear: 1, permanentWear: 0 }),
      ).toThrow(BadRequestException);
      try {
        service.estimateAgeDays({ milkTeeth: 1, permanentTeeth: 0, milkWear: 1, permanentWear: 0 });
      } catch (e: unknown) {
        expect((e as BadRequestException).message).toContain('DENTITION_NO_RULE_FOR_COUNTS');
      }
    });

    it('desgaste fuera del intervalo de la fila usa la única regla del par (distancia mínima)', () => {
      // Fila 6+2 exige milkWear 3–4; con milkWear 5 no hay exacta → misma regla 730 días
      expect(
        service.estimateAgeDays({ milkTeeth: 6, permanentTeeth: 2, milkWear: 5, permanentWear: 1 }),
      ).toBe(730);
    });

    it('rechaza desgaste fuera de 0–5', () => {
      expect(() =>
        service.estimateAgeDays({ milkTeeth: 8, permanentTeeth: 0, milkWear: 6, permanentWear: 0 }),
      ).toThrow(BadRequestException);
    });

    it('rechaza NaN', () => {
      expect(() =>
        service.estimateAgeDays({
          milkTeeth: NaN,
          permanentTeeth: 0,
          milkWear: 1,
          permanentWear: 0,
        }),
      ).toThrow('DENTITION_INVALID_NUMBERS');
    });
  });

  describe('computeBirthDateApprox', () => {
    it('resta ageDays en calendario UTC (solo fecha)', () => {
      const evalDate = new Date(Date.UTC(2024, 5, 15));
      const birth = service.computeBirthDateApprox(evalDate, 30);
      expect(birth.getUTCFullYear()).toBe(2024);
      expect(birth.getUTCMonth()).toBe(4);
      expect(birth.getUTCDate()).toBe(16);
    });

    it('atraviesa mes y año correctamente', () => {
      const evalDate = new Date(Date.UTC(2024, 2, 10));
      const birth = service.computeBirthDateApprox(evalDate, 40);
      expect(birth.getUTCMonth()).toBe(0);
      expect(birth.getUTCDate()).toBe(30);
    });
  });
});
