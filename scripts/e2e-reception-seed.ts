import type { INestApplicationContext } from '@nestjs/common';
import type { DataSource } from 'typeorm';
import {
  E2E_RECEPTION_CATTLE_EARTAG_HOLDER_NUMBER,
  E2E_RECEPTION_CATTLE_IN_LOT_NUMBER,
  E2E_RECEPTION_CATTLE_UNASSIGNED_NUMBER,
  E2E_RECEPTION_LOT_NUMBER,
  E2E_RECEPTION_PROVIDER_NAME,
  E2E_RECEPTION_PROVIDER_NIT,
  E2E_RECEPTION_SEED_EARTAG_DUPLICATE,
} from './e2e-reception-seed.constants';
import { ReceiveCattleRequestDto } from '../src/modules/purchase-receptions/dto/receive-cattle-request.dto';
import { Provider, ProviderType } from '../src/modules/commerce/entities/provider.entity';
import { Purchase } from '../src/modules/commerce/entities/purchase.entity';
import { Lot } from '../src/modules/commerce/entities/lot.entity';
import { Cattle, CattleStatus } from '../src/modules/farm/entities/cattle.entity';
import { CattleGender } from '../src/modules/farm/enums/cattle-gender.enum';
import { CattleColor } from '../src/modules/farm/enums/cattle-color.enum';

export interface E2eReceptionSeedSnapshot {
  providerId: string;
  purchaseId: string;
  lotId: string;
  cattleInLotId: string;
  cattleUnassignedId: string;
  cattleEartagHolderId: string;
}

async function ensureProvider(
  dataSource: DataSource,
  tenantId: string,
): Promise<Provider> {
  const repo = dataSource.getRepository(Provider);
  let provider = await repo.findOne({
    where: { idTenant: tenantId, nit: E2E_RECEPTION_PROVIDER_NIT },
  });
  if (provider) {
    provider.name = E2E_RECEPTION_PROVIDER_NAME;
    return repo.save(provider);
  }
  provider = repo.create({
    idTenant: tenantId,
    name: E2E_RECEPTION_PROVIDER_NAME,
    nit: E2E_RECEPTION_PROVIDER_NIT,
    type: ProviderType.PROVIDER,
    address: 'E2E Reception Address',
  });
  return repo.save(provider);
}

async function findPurchaseBySeedLot(
  dataSource: DataSource,
  tenantId: string,
): Promise<{ purchase: Purchase; lot: Lot } | null> {
  const lot = await dataSource.getRepository(Lot).findOne({
    where: { idTenant: tenantId, lotNumber: E2E_RECEPTION_LOT_NUMBER },
    relations: ['purchase'],
  });
  if (!lot?.idPurchase) return null;
  const purchase = await dataSource.getRepository(Purchase).findOne({
    where: { id: lot.idPurchase, idTenant: tenantId },
  });
  if (!purchase) return null;
  return { purchase, lot };
}

async function ensurePurchaseWithLot(
  dataSource: DataSource,
  tenantId: string,
  providerId: string,
  userId: string,
): Promise<{ purchase: Purchase; lot: Lot }> {
  const existing = await findPurchaseBySeedLot(dataSource, tenantId);
  if (existing) {
    return existing;
  }

  const purchaseRepo = dataSource.getRepository(Purchase);
  const lotRepo = dataSource.getRepository(Lot);

  const purchase = purchaseRepo.create({
    idTenant: tenantId,
    idProvider: providerId,
    purchaseDate: new Date('2025-06-01'),
    totalCattle: 10,
    totalWeight: 3500,
    status: 'OPEN',
    idCreatedBy: userId,
    idUpdatedBy: userId,
  });
  const savedPurchase = await purchaseRepo.save(purchase);

  const lot = lotRepo.create({
    idTenant: tenantId,
    idPurchase: savedPurchase.id,
    lotNumber: E2E_RECEPTION_LOT_NUMBER,
    originPlace: 'E2E Farm',
    purchasedCattleCount: 10,
    receivedCattleCount: 0,
    totalWeight: 3500,
    receivedTotalWeight: 0,
    pricePerKg: 2.5,
    totalValue: 8750,
    gender: CattleGender.MALE,
    averageWeight: 350,
  });
  const savedLot = await lotRepo.save(lot);
  savedPurchase.lots = [savedLot];
  return { purchase: savedPurchase, lot: savedLot };
}

async function findCattleByNumber(
  dataSource: DataSource,
  tenantId: string,
  number: string,
): Promise<Cattle | null> {
  return dataSource.getRepository(Cattle).findOne({
    where: { idTenant: tenantId, number },
  });
}

async function ensureReceivedCattle(
  receptionsService: {
    receiveCattle_Transaction: (
      idTenant: string,
      userId: string,
      dto: ReceiveCattleRequestDto,
    ) => Promise<{ id: string }>;
  },
  dataSource: DataSource,
  tenantId: string,
  userId: string,
  purchaseId: string,
  spec: {
    number: string;
    idLot?: string;
    eartagLeft?: string;
    eartagRight?: string;
    receivedWeight?: number;
  },
): Promise<string> {
  const existing = await findCattleByNumber(dataSource, tenantId, spec.number);
  if (
    existing &&
    (existing.status === CattleStatus.ACTIVE ||
      existing.status === CattleStatus.LOST)
  ) {
    return existing.id;
  }

  const receivedWeight = spec.receivedWeight ?? 320;
  const dto: ReceiveCattleRequestDto = {
    idPurchase: purchaseId,
    number: spec.number,
    receivedWeight,
    color: CattleColor.BLACK,
    hasHorn: false,
    castrated: false,
    gender: CattleGender.MALE,
    idLot: spec.idLot,
    eartagLeft: spec.eartagLeft,
    eartagRight: spec.eartagRight,
    comments: 'E2E reception seed',
  };
  // Sin lote, `receiveCattle_Transaction` no infiere peso/precio de compra.
  if (!spec.idLot) {
    dto.purchaseWeight = receivedWeight;
    dto.purchasePrice = receivedWeight * 2.5;
  }
  const created = await receptionsService.receiveCattle_Transaction(
    tenantId,
    userId,
    dto,
  );
  return created.id;
}

/**
 * Semilla idempotente: compra OPEN + lote + 3 reses para E2E de `PATCH received-cattle`.
 * Invocada desde `scripts/seed-e2e.ts` tras crear/sincronizar el tenant E2E.
 */
export async function ensureE2eReceptionPurchaseFixture(
  app: INestApplicationContext,
  tenantId: string,
  userId: string,
): Promise<E2eReceptionSeedSnapshot> {
  const { DataSource } = await import('typeorm');
  const dataSource = app.get(DataSource);
  const { ReceptionsService } = await import(
    '../src/modules/purchase-receptions/services/receptions.service'
  );
  const receptionsService = app.get(ReceptionsService);

  const provider = await ensureProvider(dataSource, tenantId);
  const { purchase, lot } = await ensurePurchaseWithLot(
    dataSource,
    tenantId,
    provider.id,
    userId,
  );

  await receptionsService.findOrCreateReceptionByIdPurchase(
    tenantId,
    purchase.id,
    userId,
  );

  const cattleInLotId = await ensureReceivedCattle(
    receptionsService,
    dataSource,
    tenantId,
    userId,
    purchase.id,
    {
      number: E2E_RECEPTION_CATTLE_IN_LOT_NUMBER,
      idLot: lot.id,
      eartagLeft: 'E2E-REC-L-001',
      eartagRight: 'E2E-REC-R-001',
      receivedWeight: 325,
    },
  );

  const cattleUnassignedId = await ensureReceivedCattle(
    receptionsService,
    dataSource,
    tenantId,
    userId,
    purchase.id,
    {
      number: E2E_RECEPTION_CATTLE_UNASSIGNED_NUMBER,
      eartagLeft: 'E2E-REC-L-002',
      receivedWeight: 310,
    },
  );

  const cattleEartagHolderId = await ensureReceivedCattle(
    receptionsService,
    dataSource,
    tenantId,
    userId,
    purchase.id,
    {
      number: E2E_RECEPTION_CATTLE_EARTAG_HOLDER_NUMBER,
      eartagLeft: E2E_RECEPTION_SEED_EARTAG_DUPLICATE,
      receivedWeight: 300,
    },
  );

  const snapshot: E2eReceptionSeedSnapshot = {
    providerId: provider.id,
    purchaseId: purchase.id,
    lotId: lot.id,
    cattleInLotId,
    cattleUnassignedId,
    cattleEartagHolderId,
  };

  console.log(
    `seed:e2e: recepción → purchase=${snapshot.purchaseId} lot=${snapshot.lotId} ` +
      `cattle(lote)=${snapshot.cattleInLotId} cattle(sin lote)=${snapshot.cattleUnassignedId}`,
  );

  return snapshot;
}
