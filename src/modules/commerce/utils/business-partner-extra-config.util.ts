import { BadRequestException } from '@nestjs/common';
import { BusinessPartnerRole } from '../entities/business-partner.entity';
import { BusinessPartnerExtraConfigDto } from '../dto/business-partner-extra-config.dto';

export type BusinessPartnerExtraConfigRecord = {
  sales?: { minWeightKg: number };
};

export function parseBuyerMinWeightKg(
  extraConfig: BusinessPartnerExtraConfigRecord | null | undefined,
): number | undefined {
  const value = extraConfig?.sales?.minWeightKg;
  if (value == null || typeof value !== 'number' || Number.isNaN(value)) {
    return undefined;
  }
  return value;
}

export function validateAndNormalizeExtraConfig(
  type: BusinessPartnerRole,
  extraConfig: BusinessPartnerExtraConfigDto | undefined | null,
  options: { requireForBuyer: boolean },
): BusinessPartnerExtraConfigRecord | null {
  const salesMin = extraConfig?.sales?.minWeightKg;

  if (type !== BusinessPartnerRole.BUYER) {
    if (salesMin != null || extraConfig?.sales != null) {
      throw new BadRequestException(
        'extraConfig.sales is only allowed for business partners with type BUYER',
      );
    }
    return null;
  }

  if (options.requireForBuyer && (salesMin == null || salesMin === undefined)) {
    throw new BadRequestException(
      'extraConfig.sales.minWeightKg is required when creating a BUYER',
    );
  }

  if (salesMin == null || salesMin === undefined) {
    return extraConfig ? (extraConfig as BusinessPartnerExtraConfigRecord) : null;
  }

  if (typeof salesMin !== 'number' || Number.isNaN(salesMin) || salesMin <= 0 || salesMin > 99999.99) {
    throw new BadRequestException(
      'extraConfig.sales.minWeightKg must be a number greater than 0 and at most 99999.99',
    );
  }

  return {
    sales: { minWeightKg: salesMin },
  };
}
