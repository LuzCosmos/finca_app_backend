import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  DeviceDownlinkCommand,
  DeviceDownlinkCommandStatus,
} from '../entities/device-downlink-command.entity';

@Injectable()
export class DeviceDownlinkCommandRepository {
  constructor(
    @InjectRepository(DeviceDownlinkCommand)
    private readonly repository: Repository<DeviceDownlinkCommand>,
  ) {}

  async create(input: Partial<DeviceDownlinkCommand>): Promise<DeviceDownlinkCommand> {
    const entity = this.repository.create(input);
    return this.repository.save(entity);
  }

  async update(
    id: string,
    patch: Partial<DeviceDownlinkCommand>,
  ): Promise<DeviceDownlinkCommand> {
    await this.repository.update(id, patch as never);
    const found = await this.repository.findOne({ where: { id } });
    if (!found) throw new NotFoundException(`Downlink command ${id} not found`);
    return found;
  }

  async findById(id: string, idTenant: string): Promise<DeviceDownlinkCommand | null> {
    return this.repository.findOne({ where: { id, idTenant } });
  }

  async listForDevice(
    idDevice: string,
    idTenant: string,
    options: { limit?: number; offset?: number; status?: DeviceDownlinkCommandStatus } = {},
  ): Promise<{ items: DeviceDownlinkCommand[]; total: number }> {
    const where = options.status
      ? { idDevice, idTenant, status: options.status }
      : { idDevice, idTenant };
    const [items, total] = await this.repository.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      take: options.limit ?? 50,
      skip: options.offset ?? 0,
    });
    return { items, total };
  }

  async findLatestPendingVerificationForDevice(
    idDevice: string,
  ): Promise<DeviceDownlinkCommand[]> {
    return this.repository.find({
      where: { idDevice, status: 'PENDING_VERIFICATION' },
      order: { createdAt: 'ASC' },
    });
  }
}
