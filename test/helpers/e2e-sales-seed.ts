import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  BusinessPartner,
  BusinessPartnerRole,
} from '../../src/modules/commerce/entities/business-partner.entity';
import { SaleDetail } from '../../src/modules/commerce/entities/sale-detail.entity';
import { Cattle, CattleStatus } from '../../src/modules/farm/entities/cattle.entity';
import { resolveE2eReceptionSeed } from './e2e-reception-seed';

/** Máx. 20 caracteres (`business_partners.nit` varchar(20)). */
export const E2E_SALES_BUYER_NIT = 'E2E-BUYER-NIT';

export type E2eSalesSeedSnapshot = {
  buyerId: string;
  cattleId: string;
  cattleNumber: string;
};

/**
 * Resuelve comprador BUYER y ganado ACTIVE del tenant E2E (reutiliza semilla de recepción).
 */
export async function resolveE2eSalesSeed(
  dataSource: DataSource,
  tenantId: string,
): Promise<E2eSalesSeedSnapshot | null> {
  const reception = await resolveE2eReceptionSeed(dataSource, tenantId);
  if (!reception) {
    return null;
  }

  let buyer = await dataSource.getRepository(BusinessPartner).findOne({
    where: { idTenant: tenantId, nit: E2E_SALES_BUYER_NIT },
  });
  if (!buyer) {
    const businessPartnerRepo = dataSource.getRepository(BusinessPartner);
    buyer = businessPartnerRepo.create({
      idTenant: tenantId,
      name: 'E2E Buyer',
      nit: E2E_SALES_BUYER_NIT,
      type: BusinessPartnerRole.BUYER,
    });
    buyer = await businessPartnerRepo.save(buyer);
  }

  const cattleRepo = dataSource.getRepository(Cattle);
  const detailRepo = dataSource.getRepository(SaleDetail);
  // Solo E2E-REC-002: REC-001 (lote/409) y REC-003 (arete duplicado) los usa recepción.
  const cattleId = reception.cattleUnassignedId;
  const cattle = await cattleRepo.findOne({
    where: { id: cattleId, idTenant: tenantId },
  });
  if (!cattle) {
    return null;
  }
  await detailRepo.delete({ idTenant: tenantId, cattleId });
  if (cattle.status !== CattleStatus.ACTIVE) {
    cattle.status = CattleStatus.ACTIVE;
    await cattleRepo.save(cattle);
  }

  return {
    buyerId: buyer.id,
    cattleId: cattle.id,
    cattleNumber: cattle.number,
  };
}

export async function resolveE2eSalesSeedFromApp(
  app: INestApplication,
  tenantId: string,
): Promise<E2eSalesSeedSnapshot | null> {
  const dataSource = app.get(DataSource);
  return resolveE2eSalesSeed(dataSource, tenantId);
}
