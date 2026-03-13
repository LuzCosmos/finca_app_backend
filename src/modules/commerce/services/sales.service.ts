import { Injectable, Logger, InternalServerErrorException, NotFoundException, BadRequestException } from '@nestjs/common';
import { DataSource, EntityManager, Between, FindOptionsWhere, ILike } from 'typeorm';
import { CreateSaleDto } from '../dto/create-sale.dto';
import { GetSalesQueryDto, SaleSortField } from '../dto/get-sales-query.dto';
import { UpdateSaleDto } from '../dto/update-sale.dto';
import { Sale } from '../entities/sale.entity';
import { SaleDetail } from '../entities/sale-detail.entity';
import { Cattle, CattleStatus } from '../../farm/entities/cattle.entity';
import { CattleDeviceHistoryRepository } from '../../farm/repositories/cattle-device-history.repository';
import { DevicesService } from '../../production-center/services/devices.service';
import { CattleRepository } from '../../farm/repositories/cattle.repository';

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
            // 1. Create Sale Header
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
                updatedAt: new Date(), // Explicitly set updated_at if needed
            });
            const savedSale = await manager.save(Sale, sale);
            // 2. Process Details
            for (const detailDto of dto.details) {
                // Create Sale Detail
                const detail = manager.create(SaleDetail, {
                    saleId: savedSale.id,
                    cattleId: detailDto.cattleId,
                    measuredWeight: detailDto.measuredWeight,
                    isApproved: detailDto.isApproved,
                    rejectionReason: detailDto.rejectionReason,
                    trackerRemoved: detailDto.trackerRemoved ?? false,
                    calculatedPrice: detailDto.calculatedPrice,
                    idTenant: dto.idTenant,
                });
                await manager.save(SaleDetail, detail);
                // 3. Side Effects on Cattle
                if (detailDto.isApproved) {
                    // Update status to SOLD
                    // We also update sale-related fields in Cattle as per requirements/legacy columns
                    await manager.update(Cattle, { id: detailDto.cattleId, idTenant: dto.idTenant }, {
                        status: CattleStatus.SOLD,
                        saleWeight: detailDto.measuredWeight,
                        salePrice: detailDto.calculatedPrice,
                        salePricePerKg: dto.valuePerKgConfig,
                        idProvider: dto.buyerId, // Buyer
                    } as any); // Type cast due to legacy columns might be flexible or strict
                }
                // 4. IoT Tracker Logic
                if (detailDto.trackerRemoved) {
                    const cattleInTx = await manager.findOne(Cattle, { where: { id: detailDto.cattleId, idTenant: dto.idTenant } });
                    if (cattleInTx && cattleInTx.idDevice) {
                        const deviceId = cattleInTx.idDevice;
                        const device = await this.deviceService.findById(deviceId, dto.idTenant!, manager); // deviceService might need refactoring to accept manager... 
                        // Actually, in the CattleService `TRACKER` event logic shown earlier, it seemed to be re-assigning?
                        // Ah, the snippet for `TRACKER` event was handling "Tracker detected" -> Ensure assignment.
                        // Here we want "Tracker Removed" -> Return to inventory.
                        // Logic:
                        // 1. Unassign in history.
                        // 2. Unset idDevice in Cattle.
                        // 3. Clear tags in Device (remove idCattle).
                        // 1. Unassign History
                        await this.cattleDeviceHistoryRepository.unassignDeviceByidCattle(dto.idTenant!, cattleInTx.id, manager, dto.transactionDate)
                        // 2. Unset Cattle
                        await manager.update(Cattle, { id: cattleInTx.id }, { idDevice: null });
                        // 3. Update Device Tags
                        if (device) {
                            // Update device via DeviceService to sync with Chirpstack
                            // Update logic:
                            const tags = device.tags || {};
                            delete tags.idCattle;
                            delete tags.id_cattle;
                            // Also check 'id_device' in tags?
                            const deviceUpdateDto = {
                                name: device.name,
                                // other fields...
                                tags: tags
                            };
                            // Use DeviceService to sync
                            await this.deviceService.updateWithDevice(device, deviceUpdateDto as any, manager);
                        }
                    }
                }
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

        if (startDate) {
            const start = new Date(startDate);
            const end = endDate ? new Date(endDate) : new Date('2999-12-31');
            queryBuilder.andWhere('sale.transactionDate BETWEEN :start AND :end', { start, end });
        }

        // Validate orderBy to prevent injection or errors if field doesn't exist
        // Default to createdAt
        const validSortFields = ['transactionDate', 'totalAmount', 'totalWeightKg', 'createdAt', 'updatedAt'];
        const sortField = (orderBy && validSortFields.includes(orderBy as string)) ? `sale.${orderBy}` : 'sale.transactionDate';
        const sortOrder = order === 'ASC' ? 'ASC' : 'DESC';

        queryBuilder.orderBy(sortField, sortOrder);

        queryBuilder.skip(skip).take(take);

        const [items, total] = await queryBuilder.getManyAndCount();

        return { items, total };
    }

    async findAll2(idTenant: string, query: GetSalesQueryDto) {
        const { skip, take, orderBy, order, startDate, endDate, buyerId, status } = query;

        const where: FindOptionsWhere<Sale> = { idTenant };

        if (buyerId) {
            where.buyerId = buyerId;
        }

        if (startDate && endDate) {
            where.transactionDate = Between(new Date(startDate), new Date(endDate));
        } else if (startDate) {
            where.transactionDate = Between(new Date(startDate), new Date('2999-12-31'));
        }

        // Relation filtering logic would need Join, but simple where checks are easier.
        // For 'status', Sale doesn't have status, but Details do. 
        // If sorting by buyer name is required, we need queryBuilder.
        // For now, let's use standard find with relations.

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

    async update(idTenant: string, id: string, dto: UpdateSaleDto): Promise<void> {
        const sale = await this.findOne(idTenant, id);

        // Remove details from update for now to avoid complexity
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { details, ...updateData } = dto;

        await this.dataSource.getRepository(Sale).update(
            { id, idTenant },
            {
                ...updateData,
                updatedAt: new Date(),
            }
        );

        // If buyer changed, we should theoretically update the cattle history/provider. 
        // This is complex and skipped for this iteration unless requested.
        // Warn if critical fields look changed.
    }

    /**
     * Syncs sale-related data when a SOLD cattle's salePrice or saleWeight is updated.
     * Must be called within an existing transaction (same EntityManager).
     * Updates the linked SaleDetail, recalculates parent Sale totals, and returns the affected sale id.
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

        const totalAmount = allDetails.reduce((sum, d) => sum + Number(d.calculatedPrice), 0);
        const totalWeightKg = allDetails.reduce((sum, d) => sum + Number(d.measuredWeight), 0);
        const totalAnimalCount = allDetails.length;

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
}
