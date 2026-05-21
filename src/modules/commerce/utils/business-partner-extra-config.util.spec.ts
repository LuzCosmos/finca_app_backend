import { BadRequestException } from '@nestjs/common';
import { BusinessPartnerRole } from '../entities/business-partner.entity';
import {
  parseBuyerMinWeightKg,
  validateAndNormalizeExtraConfig,
} from './business-partner-extra-config.util';

describe('business-partner-extra-config.util', () => {
  describe('parseBuyerMinWeightKg', () => {
    it('returns minWeightKg from sales config', () => {
      expect(parseBuyerMinWeightKg({ sales: { minWeightKg: 320 } })).toBe(320);
    });

    it('returns undefined when missing', () => {
      expect(parseBuyerMinWeightKg(null)).toBeUndefined();
      expect(parseBuyerMinWeightKg({})).toBeUndefined();
    });
  });

  describe('validateAndNormalizeExtraConfig', () => {
    it('requires minWeightKg when creating BUYER', () => {
      expect(() =>
        validateAndNormalizeExtraConfig(BusinessPartnerRole.BUYER, undefined, {
          requireForBuyer: true,
        }),
      ).toThrow(BadRequestException);
    });

    it('normalizes valid BUYER config', () => {
      expect(
        validateAndNormalizeExtraConfig(
          BusinessPartnerRole.BUYER,
          { sales: { minWeightKg: 350.5 } },
          { requireForBuyer: true },
        ),
      ).toEqual({ sales: { minWeightKg: 350.5 } });
    });

    it('rejects sales config for PROVIDER', () => {
      expect(() =>
        validateAndNormalizeExtraConfig(
          BusinessPartnerRole.PROVIDER,
          { sales: { minWeightKg: 300 } },
          { requireForBuyer: false },
        ),
      ).toThrow(BadRequestException);
    });

    it('allows null extra config for PROVIDER', () => {
      expect(
        validateAndNormalizeExtraConfig(BusinessPartnerRole.PROVIDER, undefined, {
          requireForBuyer: false,
        }),
      ).toBeNull();
    });
  });
});
