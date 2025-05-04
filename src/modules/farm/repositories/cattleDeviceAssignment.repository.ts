import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository, IsNull } from 'typeorm';
import { Cattle } from '../entities/cattle.entity';
import { CattleDeviceAssignment } from '../entities/cattleDeviceAssignment.entity';

@Injectable() 
export class CattleDeviceAssignmentRepository {
  constructor(
    @InjectRepository(CattleDeviceAssignment)
    private readonly repository: Repository<CattleDeviceAssignment>,
  ) {}

  /**
   * Assign a device to a cattle
   * @param idDevice - The device ID
   * @param idCattle - The cattle ID
   * @returns The new assignment
   */
  async assignDeviceToCattle(idDevice: string, idCattle: string, manager?: EntityManager) {
    const repo = manager?.getRepository(CattleDeviceAssignment) ?? this.repository;
    // 1. Verify if the device is already assigned to another cattle
    const activeAssignment = await repo.findOne({
      where: {
        idDevice: idDevice,
        unassignedAt: IsNull(),
      },
    });
    if(activeAssignment) {
      if (activeAssignment.idCattle === idCattle) {
        return activeAssignment;
      }
      throw new BadRequestException('Este device ya está asignado a otro cattle.');
    }
    // 2. Create new assignment
    const newAssignment = repo.create({
      idCattle: idCattle,
      idDevice: idDevice,
    });
    await repo.save(newAssignment);
    return newAssignment;
  }


  /**
   * Unassign a device from a cattle
   * @param idCattle - The cattle ID
   * @param idDevice - The device ID
   */
  async unassignDeviceToCattle( idCattle: string, idDevice: string, manager?: EntityManager) {
    const repo = manager?.getRepository(CattleDeviceAssignment) ?? this.repository;
    const current = await repo.findOne({
      where: { idCattle, unassignedAt: IsNull() },
    });
    if (current) {
      current.unassignedAt = new Date();
      await repo.save(current);
    }
  }
  
  async findCurrentAssignedToCattle(idCattle: string): Promise<CattleDeviceAssignment | undefined> {
    const cattle = await this.repository.findOne({ where: { idCattle, unassignedAt: IsNull() } });
    return cattle || undefined;
  }

  async findAllAssignedToCattle(idCattle: string): Promise<CattleDeviceAssignment[]> {
    return this.repository.find({ where: { idCattle } });
  }

  async delete(id: string, manager?: EntityManager) {
    const repo = manager?.getRepository(CattleDeviceAssignment) ?? this.repository;
    await repo.delete(id);
  }
  
/*
  async create(cattleDto: CreateCattleDto, manager?: EntityManager): Promise<Cattle> {
    const repo = manager?.getRepository(Cattle) ?? this.repository;
    const cattle = repo.create(cattleDto);
    return repo.save(cattle);
  }

  async findByCattleIdDeviceId(idCattle: string, idDevice: string): Promise<CattleDeviceAssignment | undefined> {
    const cattle = await this.repository.findOne({ where: {idCattle, idDevice   } });
    return cattle || undefined;
  }

  async findOne(idTenant: string, id: string): Promise<Cattle | undefined> {
    const cattle = await this.repository.findOne({ where: { idTenant, id } });
    return cattle || undefined;
  }

  async findAll(idTenant: string): Promise<Cattle[]> {
    return this.repository.find({ where: { idTenant } });
  }

  async update(idTenant: string, id: string, cattleDto: UpdateCattleDto, manager?: EntityManager): Promise<Cattle | undefined> {
    const repo = manager?.getRepository(Cattle) ?? this.repository;
    await repo.update(id, cattleDto);
    const updatedCattle = await this.findOne(idTenant, id);
    return updatedCattle || undefined;
  }

  async delete(idTenant: string, id: string): Promise<void> {
    await this.repository.delete(id);
  }

  async findBySysNumber(idTenant: string, sysNumber: string): Promise<Cattle | undefined> {
    const cattle = await this.repository.findOne({ where: { idTenant, sysNumber } });
    return cattle || undefined;
  }

  async findByNumber(idTenant: string, number: string): Promise<Cattle | undefined> {
    const cattle = await this.repository.findOne({ where: { idTenant, number } });
    return cattle || undefined;
  }
  */
}
