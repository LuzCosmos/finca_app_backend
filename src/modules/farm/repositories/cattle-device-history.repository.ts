import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager, IsNull } from 'typeorm';
import { CattleDeviceHistory } from '../entities/cattle-device-history.entity';

@Injectable()
export class CattleDeviceHistoryRepository {
  constructor(
    @InjectRepository(CattleDeviceHistory)
    private readonly repo: Repository<CattleDeviceHistory>,
  ) {}

  /**
   * Create a new device history
   * @param entity - The device history entity
   * @returns The created device history
   */
  async create(entity: CattleDeviceHistory): Promise<CattleDeviceHistory> {
    return await this.repo.save(entity);
  }

  /**
   * Create a new device history with manager
   * @param manager - The entity manager
   * @param entity - The device history entity
   * @returns The created device history
   */
  async createWithManager(
    manager: EntityManager,
    entity: CattleDeviceHistory,
  ): Promise<CattleDeviceHistory> {
    return await manager.save(CattleDeviceHistory, entity);
  }

  /**
   * Get device history by cattle id
   * @param idTenant - The tenant id
   * @param idCattle - The cattle id
   * @returns The device history
   */
  async findByCattle(
    idTenant: string,
    idCattle: string,
  ): Promise<CattleDeviceHistory[]> {
    return await this.repo.find({
      where: {
        idTenant,
        idCattle,
      },
      order: { assignedAt: 'DESC' },
    });
  }

  /**
   * Get device history by id
   * @param idTenant - The tenant id
   * @param id - The device history id
   * @returns The device history
   */
  async findOneById(
    idTenant: string,
    id: string,
  ): Promise<CattleDeviceHistory | null> {
    return await this.repo.findOne({
      where: { idTenant, id },
    });
  }

  /**
   * Update a device history
   * @param entity - The device history entity
   * @returns The updated device history
   */
  async update(entity: CattleDeviceHistory): Promise<CattleDeviceHistory> {
    return await this.repo.save(entity);
  }

  /**
   * Update a device history with manager
   * @param manager - The entity manager
   * @param entity - The device history entity
   * @returns The updated device history
   */
  async updateWithManager(
    manager: EntityManager,
    entity: CattleDeviceHistory,
  ): Promise<CattleDeviceHistory> {
    return await manager.save(CattleDeviceHistory, entity);
  }

  /**
   * Delete a device history by id
   * @param idTenant - The tenant id
   * @param id - The device history id
   */
  async deleteById(idTenant: string, id: string): Promise<void> {
    await this.repo.delete({ idTenant, id });
  }

  /**
   * Delete a device history by id with manager
   * @param idTenant - The tenant id
   * @param id - The device history id
   * @param manager - The entity manager
   */
  async deleteByIdWithManager(
    idTenant: string,
    id: string,
    manager: EntityManager,
  ): Promise<void> {
    await manager.delete(CattleDeviceHistory, { idTenant, id });
  }

  async assignDeviceToCattle(
    idDevice: string,
    idCattle: string,
    idTenant: string,
    assignedBy?: string,
    recordedInMassiveEvent?: string,
    manager?: EntityManager,
  ) {
    const repo = manager?.getRepository(CattleDeviceHistory) ?? this.repo;
  
    const activeAssignment = await repo.findOne({
      where: { idDevice, idTenant, unassignedAt: IsNull() },
    });
  
    if (activeAssignment) {
      if (activeAssignment.idCattle === idCattle) {
        return activeAssignment;
      }
      throw new BadRequestException('Este device ya está asignado a otro cattle.');
    }
  
    const newAssignment = repo.create({
      idCattle,
      idDevice,
      idTenant,
      assignedBy: assignedBy ?? undefined,
      recordedInMassiveEvent: recordedInMassiveEvent ?? undefined,
      assignedAt: new Date(),
    });
    await repo.save(newAssignment);
    return newAssignment;
  }

  /**
   * Unassign a device from a cattle
   * @param idCattle - The cattle ID
   * @param idDevice - The device ID
   */
  async unassignDeviceToCattle(idTenant: string, idCattle: string, idDevice: string, manager?: EntityManager) {
    const repo = manager?.getRepository(CattleDeviceHistory) ?? this.repo;
    const current = await repo.findOne({
      where: { idDevice, idTenant, unassignedAt: IsNull() },
    });
    if (current) {
      current.unassignedAt = new Date();
      await repo.save(current);
    }
  }
}
