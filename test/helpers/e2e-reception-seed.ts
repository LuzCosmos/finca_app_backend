import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { E2eReceptionSeedSnapshot } from '../../scripts/e2e-reception-seed';
import {
  E2E_RECEPTION_CATTLE_EARTAG_HOLDER_NUMBER,
  E2E_RECEPTION_CATTLE_IN_LOT_EARTAG_LEFT,
  E2E_RECEPTION_CATTLE_IN_LOT_EARTAG_RIGHT,
  E2E_RECEPTION_CATTLE_IN_LOT_NUMBER,
  E2E_RECEPTION_CATTLE_UNASSIGNED_EARTAG_LEFT,
  E2E_RECEPTION_CATTLE_UNASSIGNED_NUMBER,
  E2E_RECEPTION_LOT_NUMBER,
  E2E_RECEPTION_PROVIDER_NIT,
  E2E_RECEPTION_SEED_EARTAG_DUPLICATE,
} from './e2e-reception-seed.constants';
import { Provider } from '../../src/modules/commerce/entities/provider.entity';
import { Lot } from '../../src/modules/commerce/entities/lot.entity';
import { Cattle, CattleStatus } from '../../src/modules/farm/entities/cattle.entity';

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

/**
 * Restaura aretes y estado ACTIVE de las res E2E de recepción (idempotente tras ventas u otros E2E).
 */
export async function restoreE2eReceptionCattleFixtures(
  dataSource: DataSource,
  tenantId: string,
  reception: E2eReceptionSeedSnapshot,
): Promise<void> {
  const repo = dataSource.getRepository(Cattle);

  const inLot = await repo.findOne({
    where: { id: reception.cattleInLotId, idTenant: tenantId },
  });
  if (inLot) {
    inLot.eartagLeft = E2E_RECEPTION_CATTLE_IN_LOT_EARTAG_LEFT;
    inLot.eartagRight = E2E_RECEPTION_CATTLE_IN_LOT_EARTAG_RIGHT;
    inLot.status = CattleStatus.ACTIVE;
    await repo.save(inLot);
  }

  const holder = await repo.findOne({
    where: { id: reception.cattleEartagHolderId, idTenant: tenantId },
  });
  if (holder) {
    holder.eartagLeft = E2E_RECEPTION_SEED_EARTAG_DUPLICATE;
    holder.status = CattleStatus.ACTIVE;
    await repo.save(holder);
  }

  const unassigned = await repo.findOne({
    where: { id: reception.cattleUnassignedId, idTenant: tenantId },
  });
  if (unassigned) {
    unassigned.eartagLeft = E2E_RECEPTION_CATTLE_UNASSIGNED_EARTAG_LEFT;
    unassigned.status = CattleStatus.ACTIVE;
    await repo.save(unassigned);
  }
}
