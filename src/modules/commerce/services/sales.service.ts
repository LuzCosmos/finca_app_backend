import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { DataSource, EntityManager, Between, FindOptionsWhere } from 'typeorm';
import { CreateSaleDto } from '../dto/create-sale.dto';
import { CreateSaleDetailDto } from '../dto/create-sale-detail.dto';
import { GetSalesQueryDto } from '../dto/get-sales-query.dto';
import { UpdateSaleDto } from '../dto/update-sale.dto';
import { Sale } from '../entities/sale.entity';
import { SaleDetail } from '../entities/sale-detail.entity';
import { Cattle, CattleStatus } from '../../farm/entities/cattle.entity';
import { CattleDeviceHistoryRepository } from '../../farm/repositories/cattle-device-history.repository';
import { DevicesService } from '../../production-center/services/devices.service';
import { CattleRepository } from '../../farm/repositories/cattle.repository';

/** Inicio y fin del día civil en hora local para strings YYYY-MM-DD (fin inclusivo 23:59:59.999). */
function calendarDayBounds(dateStr: string): { start: Date; end: Date } {
    const m = /^(\d{4})-(\d{2})-(\d{2})(?:[Tt ].*)?$/.exec(dateStr.trim());
    if (m) {
        const y = Number(m[1]);
        const mo = Number(m[2]);
        const d = Number(m[3]);
        return {
            start: new Date(y, mo - 1, d, 0, 0, 0, 0),
            end: new Date(y, mo - 1, d, 23, 59, 59, 999),
        };
    }
    const parsed = new Date(dateStr);
    return { start: parsed, end: parsed };
}

@Injectable()
export class SalesService {
    private readonly logger = new Logger(SalesService.name);

    constructor(
        private readonly dataSource: DataSource,
        private readonly deviceService: DevicesService,
        private readonly cattleDeviceHistoryRepository: CattleDeviceHistoryRepository,
        private readonly cattleRepository: CattleRepository,
    ) { }

    async createSale(dto: CreateSaleDto): Promise<Sale> {
        return await this.dataSource.transaction(async (manager) => {
            const sale = manager.create(Sale, {
                transactionDate: dto.transactionDate,
                buyerId: dto.buyerId,
                transporterId: dto.transporterId,
                minWeightConfig: dto.minWeightConfig,
                valuePerKgConfig: dto.valuePerKgConfig,
                totalAnimalCount: dto.totalAnimalCount,
                totalWeightKg: dto.totalWeightKg,
                totalAmount: dto.totalAmount,
                notes: dto.notes,
                idTenant: dto.idTenant,
                createdBy: dto.createdBy,
                updatedAt: new Date(),
            });
            const savedSale = await manager.save(Sale, sale);

            for (const detailDto of dto.details) {
                await this.persistSaleDetail(manager, savedSale.id, dto.idTenant!, detailDto, {
                    buyerId: dto.buyerId,
                    valuePerKgConfig: dto.valuePerKgConfig,
                    transactionDate: dto.transactionDate,
                    applyTrackerRemoval: detailDto.trackerRemoved ?? false,
                });
            }

            return savedSale;
        });
    }

    async findAll(idTenant: string, query: GetSalesQueryDto) {
        const { skip, take, orderBy, order, startDate, endDate, buyerId } = query;

        const queryBuilder = this.dataSource.getRepository(Sale).createQueryBuilder('sale')
            .leftJoinAndSelect('sale.buyer', 'buyer')
            .leftJoinAndSelect('sale.transporter', 'transporter')
            .leftJoinAndSelect('sale.details', 'details')
            .leftJoin('details.cattle', 'cattle')
            .addSelect(['cattle.id', 'cattle.number', 'cattle.salePrice', 'cattle.saleWeight'])
            .where('sale.idTenant = :idTenant', { idTenant });

        if (buyerId) {
            queryBuilder.andWhere('sale.buyerId = :buyerId', { buyerId });
        }

        if (startDate || endDate) {
            let start: Date;
            let end: Date;
            if (startDate && endDate) {
                start = calendarDayBounds(startDate).start;
                end = calendarDayBounds(endDate).end;
            } else if (startDate) {
                start = calendarDayBounds(startDate).start;
                end = new Date(2999, 11, 31, 23, 59, 59, 999);
            } else {
                start = new Date(1970, 0, 1, 0, 0, 0, 0);
                end = calendarDayBounds(endDate!).end;
            }
            queryBuilder.andWhere('sale.transactionDate BETWEEN :start AND :end', { start, end });
        }

        const validSortFields = ['transactionDate', 'totalAmount', 'totalWeightKg', 'createdAt', 'updatedAt'];
        const sortField = (orderBy && validSortFields.includes(orderBy as string)) ? `sale.${orderBy}` : 'sale.transactionDate';
        const sortOrder = order === 'ASC' ? 'ASC' : 'DESC';

        queryBuilder.orderBy(sortField, sortOrder);
        queryBuilder.skip(skip).take(take);

        const [items, total] = await queryBuilder.getManyAndCount();
        return { items, total };
    }

    async findAll2(idTenant: string, query: GetSalesQueryDto) {
        const { skip, take, orderBy, order, startDate, endDate, buyerId } = query;

        const where: FindOptionsWhere<Sale> = { idTenant };

        if (buyerId) {
            where.buyerId = buyerId;
        }

        if (startDate && endDate) {
            where.transactionDate = Between(new Date(startDate), new Date(endDate));
        } else if (startDate) {
            where.transactionDate = Between(new Date(startDate), new Date('2999-12-31'));
        }

        const [items, total] = await this.dataSource.getRepository(Sale).findAndCount({
            where,
            relations: ['buyer', 'transporter', 'details', 'details.cattle'],
            order: { [orderBy as string]: order },
            skip,
            take,
        });

        return { items, total };
    }

    async findOne(idTenant: string, id: string): Promise<Sale> {
        const sale = await this.dataSource.getRepository(Sale).findOne({
            where: { id, idTenant },
            relations: ['buyer', 'transporter', 'details', 'details.cattle'],
        });
        if (!sale) throw new NotFoundException(`Sale with ID ${id} not found`);
        return sale;
    }

    async update(idTenant: string, id: string, dto: UpdateSaleDto): Promise<Sale> {
        if (!dto.details?.length) {
            throw new BadRequestException('At least one sale detail is required');
        }
        if (!dto.buyerId || dto.transactionDate == null || dto.minWeightConfig == null || dto.valuePerKgConfig == null) {
            throw new BadRequestException('Sale header fields are required for update');
        }

        return await this.dataSource.transaction(async (manager) => {
            const sale = await manager
                .createQueryBuilder(Sale, 'sale')
                .setLock('pessimistic_write')
                .where('sale.id = :id', { id })
                .andWhere('sale.idTenant = :idTenant', { idTenant })
                .getOne();

            if (!sale) {
                throw new NotFoundException(`Sale with ID ${id} not found`);
            }

            const existingDetails = await manager.find(SaleDetail, {
                where: { saleId: id, idTenant },
            });
            const existingByCattleId = new Map(existingDetails.map((d) => [d.cattleId, d]));
            const incomingByCattleId = new Map(dto.details!.map((d) => [d.cattleId, d]));

            const approvedDetails = dto.details!.filter((d) => d.isApproved);
            const totalAnimalCount = approvedDetails.length;
            const totalWeightKg = approvedDetails.reduce((sum, d) => sum + Number(d.measuredWeight), 0);
            const totalAmount = approvedDetails.reduce((sum, d) => sum + Number(d.calculatedPrice), 0);

            await manager.update(
                Sale,
                { id, idTenant },
                {
                    transactionDate: dto.transactionDate,
                    buyerId: dto.buyerId,
                    transporterId: dto.transporterId,
                    minWeightConfig: dto.minWeightConfig,
                    valuePerKgConfig: dto.valuePerKgConfig,
                    totalAnimalCount,
                    totalWeightKg,
                    totalAmount,
                    notes: dto.notes,
                    updatedAt: new Date(),
                },
            );

            for (const existing of existingDetails) {
                if (!incomingByCattleId.has(existing.cattleId)) {
                    await manager.delete(SaleDetail, { id: existing.id, idTenant });
                    if (existing.isApproved) {
                        await this.revertCattleFromSale(manager, existing.cattleId, idTenant);
                    }
                }
            }

            for (const detailDto of dto.details!) {
                const existing = existingByCattleId.get(detailDto.cattleId);
                if (!existing) {
                    await this.assertCattleCanBeAddedToSale(manager, idTenant, detailDto.cattleId, id);
                    await this.persistSaleDetail(manager, id, idTenant, detailDto, {
                        buyerId: dto.buyerId!,
                        valuePerKgConfig: dto.valuePerKgConfig!,
                        transactionDate: dto.transactionDate!,
                        applyTrackerRemoval: detailDto.trackerRemoved ?? false,
                    });
                    continue;
                }

                const wasApproved = existing.isApproved;
                existing.measuredWeight = detailDto.measuredWeight;
                existing.isApproved = detailDto.isApproved;
                if (detailDto.rejectionReason !== undefined) {
                    existing.rejectionReason = detailDto.rejectionReason;
                }
                existing.calculatedPrice = detailDto.calculatedPrice;
                const trackerJustRemoved =
                    (detailDto.trackerRemoved ?? false) && !existing.trackerRemoved;
                if (detailDto.trackerRemoved != null) {
                    existing.trackerRemoved = detailDto.trackerRemoved;
                }
                await manager.save(SaleDetail, existing);

                if (wasApproved && !detailDto.isApproved) {
                    await this.revertCattleFromSale(manager, detailDto.cattleId, idTenant);
                } else if (detailDto.isApproved) {
                    await this.applyApprovedCattleSideEffects(
                        manager,
                        detailDto.cattleId,
                        idTenant,
                        dto.buyerId!,
                        dto.valuePerKgConfig!,
                        detailDto,
                    );
                }

                if (trackerJustRemoved) {
                    await this.applyTrackerRemoval(
                        manager,
                        idTenant,
                        detailDto.cattleId,
                        dto.transactionDate!,
                    );
                }
            }

            const updated = await manager.findOne(Sale, {
                where: { id, idTenant },
                relations: ['buyer', 'transporter', 'details', 'details.cattle'],
            });
            if (!updated) {
                throw new NotFoundException(`Sale with ID ${id} not found`);
            }
            return updated;
        });
    }

    /**
     * Syncs sale-related data when a SOLD cattle's salePrice or saleWeight is updated.
     * Must be called within an existing transaction (same EntityManager).
     */
    async syncSaleDataForSoldCattle(
        idTenant: string,
        cattleId: string,
        payload: { salePrice?: number; saleWeight?: number },
        manager: EntityManager,
    ): Promise<{ saleId: string; totalAmount: number; totalWeightKg: number }> {
        if (payload.salePrice == null && payload.saleWeight == null) {
            throw new BadRequestException('At least one of salePrice or saleWeight must be provided');
        }

        const detailRepo = manager.getRepository(SaleDetail);
        const detail = await detailRepo
            .createQueryBuilder('detail')
            .setLock('pessimistic_write')
            .where('detail.cattleId = :cattleId', { cattleId })
            .andWhere('detail.idTenant = :idTenant', { idTenant })
            .getOne();

        if (!detail) {
            throw new BadRequestException('SOLD_CATTLE_MISSING_SALE_DETAIL');
        }

        const saleRepo = manager.getRepository(Sale);
        const sale = await saleRepo
            .createQueryBuilder('sale')
            .setLock('pessimistic_write')
            .where('sale.id = :saleId', { saleId: detail.saleId })
            .andWhere('sale.idTenant = :idTenant', { idTenant })
            .getOne();

        if (!sale) {
            throw new BadRequestException('SALE_NOT_FOUND');
        }

        if (payload.salePrice != null) {
            detail.calculatedPrice = Number(payload.salePrice);
        }
        if (payload.saleWeight != null) {
            detail.measuredWeight = Number(payload.saleWeight);
        }
        await manager.save(SaleDetail, detail);

        const allDetails = await manager.find(SaleDetail, {
            where: { saleId: sale.id, idTenant },
        });

        const approvedDetails = allDetails.filter((d) => d.isApproved);
        const totalAmount = approvedDetails.reduce((sum, d) => sum + Number(d.calculatedPrice), 0);
        const totalWeightKg = approvedDetails.reduce((sum, d) => sum + Number(d.measuredWeight), 0);
        const totalAnimalCount = approvedDetails.length;

        await manager.update(
            Sale,
            { id: sale.id, idTenant },
            {
                totalAmount,
                totalWeightKg,
                totalAnimalCount,
                updatedAt: new Date(),
            },
        );

        return {
            saleId: sale.id,
            totalAmount,
            totalWeightKg,
        };
    }

    private async persistSaleDetail(
        manager: EntityManager,
        saleId: string,
        idTenant: string,
        detailDto: CreateSaleDetailDto,
        context: {
            buyerId: string;
            valuePerKgConfig: number;
            transactionDate: Date;
            applyTrackerRemoval: boolean;
        },
    ): Promise<void> {
        const detail = manager.create(SaleDetail, {
            saleId,
            cattleId: detailDto.cattleId,
            measuredWeight: detailDto.measuredWeight,
            isApproved: detailDto.isApproved,
            rejectionReason: detailDto.rejectionReason,
            trackerRemoved: detailDto.trackerRemoved ?? false,
            calculatedPrice: detailDto.calculatedPrice,
            idTenant,
        });
        await manager.save(SaleDetail, detail);

        if (detailDto.isApproved) {
            await this.applyApprovedCattleSideEffects(
                manager,
                detailDto.cattleId,
                idTenant,
                context.buyerId,
                context.valuePerKgConfig,
                detailDto,
            );
        }

        if (context.applyTrackerRemoval) {
            await this.applyTrackerRemoval(
                manager,
                idTenant,
                detailDto.cattleId,
                context.transactionDate,
            );
        }
    }

    private async applyApprovedCattleSideEffects(
        manager: EntityManager,
        cattleId: string,
        idTenant: string,
        buyerId: string,
        valuePerKgConfig: number,
        detailDto: CreateSaleDetailDto,
    ): Promise<void> {
        await manager.update(Cattle, { id: cattleId, idTenant }, {
            status: CattleStatus.SOLD,
            saleWeight: detailDto.measuredWeight,
            salePrice: detailDto.calculatedPrice,
            salePricePerKg: valuePerKgConfig,
            idProvider: buyerId,
        } as Partial<Cattle>);
    }

    private async revertCattleFromSale(
        manager: EntityManager,
        cattleId: string,
        idTenant: string,
    ): Promise<void> {
        await manager.update(Cattle, { id: cattleId, idTenant }, {
            status: CattleStatus.ACTIVE,
            saleWeight: null,
            salePrice: null,
            salePricePerKg: null,
            idProvider: null,
        } as never);
    }

    private async applyTrackerRemoval(
        manager: EntityManager,
        idTenant: string,
        cattleId: string,
        transactionDate: Date,
    ): Promise<void> {
        const cattleInTx = await manager.findOne(Cattle, {
            where: { id: cattleId, idTenant },
        });
        if (!cattleInTx?.idDevice) {
            return;
        }

        const deviceId = cattleInTx.idDevice;
        const device = await this.deviceService.findById(deviceId, idTenant, manager);

        await this.cattleDeviceHistoryRepository.unassignDeviceByidCattle(
            idTenant,
            cattleInTx.id,
            manager,
            transactionDate,
        );
        await manager.update(Cattle, { id: cattleInTx.id }, { idDevice: null });

        if (device) {
            const tags = { ...(device.tags || {}) };
            delete tags.idCattle;
            delete tags.id_cattle;
            const deviceUpdateDto = {
                name: device.name,
                tags,
            };
            await this.deviceService.updateWithDevice(device, deviceUpdateDto as never, manager);
        }
    }

    private async assertCattleCanBeAddedToSale(
        manager: EntityManager,
        idTenant: string,
        cattleId: string,
        saleId: string,
    ): Promise<void> {
        const cattle = await manager.findOne(Cattle, { where: { id: cattleId, idTenant } });
        if (!cattle) {
            throw new BadRequestException('CATTLE_NOT_FOUND');
        }

        const detailInOtherSale = await manager
            .createQueryBuilder(SaleDetail, 'detail')
            .where('detail.cattleId = :cattleId', { cattleId })
            .andWhere('detail.idTenant = :idTenant', { idTenant })
            .andWhere('detail.saleId != :saleId', { saleId })
            .getOne();

        if (detailInOtherSale) {
            throw new BadRequestException('CATTLE_ALREADY_IN_SALE');
        }

        if (cattle.status === CattleStatus.SOLD) {
            const detailInThisSale = await manager.findOne(SaleDetail, {
                where: { cattleId, idTenant, saleId },
            });
            if (!detailInThisSale) {
                throw new BadRequestException('CATTLE_ALREADY_SOLD');
            }
            return;
        }

        if (cattle.status !== CattleStatus.ACTIVE) {
            throw new BadRequestException('CATTLE_NOT_ACTIVE');
        }
    }
}
