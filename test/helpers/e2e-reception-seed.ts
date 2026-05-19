import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { E2eReceptionSeedSnapshot } from '../../scripts/e2e-reception-seed';
import {
  E2E_RECEPTION_CATTLE_EARTAG_HOLDER_NUMBER,
  E2E_RECEPTION_CATTLE_IN_LOT_NUMBER,
  E2E_RECEPTION_CATTLE_UNASSIGNED_NUMBER,
  E2E_RECEPTION_LOT_NUMBER,
  E2E_RECEPTION_PROVIDER_NIT,
} from './e2e-reception-seed.constants';
import { Provider } from '../../src/modules/commerce/entities/provider.entity';
import { Lot } from '../../src/modules/commerce/entities/lot.entity';
import { Cattle } from '../../src/modules/farm/entities/cattle.entity';

export type { E2eReceptionSeedSnapshot };
export { E2E_RECEPTION_SEED_EARTAG_DUPLICATE } from './e2e-reception-seed.constants';

/**
 * Resuelve IDs sembrados por `npm run seed:e2e` para el tenant de la sesión E2E.
 * Devuelve `null` si falta la semilla (ejecutar seed antes de los E2E autenticados).
 */
export async function resolveE2eReceptionSeed(
  dataSource: DataSource,
  tenantId: string,
): Promise<E2eReceptionSeedSnapshot | null> {
  const provider = await dataSource.getRepository(Provider).findOne({
    where: { idTenant: tenantId, nit: E2E_RECEPTION_PROVIDER_NIT },
  });
  if (!provider) return null;

  const lot = await dataSource.getRepository(Lot).findOne({
    where: { idTenant: tenantId, lotNumber: E2E_RECEPTION_LOT_NUMBER },
  });
  if (!lot?.idPurchase) return null;

  const cattleInLot = await dataSource.getRepository(Cattle).findOne({
    where: { idTenant: tenantId, number: E2E_RECEPTION_CATTLE_IN_LOT_NUMBER },
  });
  const cattleUnassigned = await dataSource.getRepository(Cattle).findOne({
    where: { idTenant: tenantId, number: E2E_RECEPTION_CATTLE_UNASSIGNED_NUMBER },
  });
  const cattleEartagHolder = await dataSource.getRepository(Cattle).findOne({
    where: { idTenant: tenantId, number: E2E_RECEPTION_CATTLE_EARTAG_HOLDER_NUMBER },
  });

  if (!cattleInLot || !cattleUnassigned || !cattleEartagHolder) {
    return null;
  }

  return {
    providerId: provider.id,
    purchaseId: lot.idPurchase,
    lotId: lot.id,
    cattleInLotId: cattleInLot.id,
    cattleUnassignedId: cattleUnassigned.id,
    cattleEartagHolderId: cattleEartagHolder.id,
  };
}

export async function resolveE2eReceptionSeedFromApp(
  app: INestApplication,
  tenantId: string,
): Promise<E2eReceptionSeedSnapshot | null> {
  const dataSource = app.get(DataSource);
  return resolveE2eReceptionSeed(dataSource, tenantId);
}
