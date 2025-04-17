import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Device } from '../entities/device.entity';
import { CreateDeviceDto } from '../dto/create-device.dto';
import { UpdateDeviceDto } from '../dto/update-device.dto';

@Injectable()
export class DeviceRepository {
  constructor(
    @InjectRepository(Device)
    private readonly repository: Repository<Device>,
  ) {}

  async create(createDeviceDto: CreateDeviceDto): Promise<Device> {
    const device = this.repository.create(createDeviceDto);
    return await this.repository.save(device);
  }

  async findAll(idTenant: string): Promise<Device[]> {
    return await this.repository.find({ where: { idTenant } });
  }

  async findOne(id: string): Promise<Device> {
    const device = await this.repository.findOne({ where: { id } });
    if (!device) {
      throw new NotFoundException(`Device with ID ${id} not found`);
    }
    return device;
  }

  async findByDevEuiAndTenantId(deveui: string, idTenant: string): Promise<Device> {
    const device = await this.repository.findOne({ where: { deveui, idTenant } });
    if (!device) {
      throw new NotFoundException(`Device with DevEUI ${deveui} not found`);
    }
    return device;
  }

  async update(id: string, updateDeviceDto: UpdateDeviceDto): Promise<Device> {
    await this.repository.update(id, updateDeviceDto);
    return await this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    const result = await this.repository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Device with ID ${id} not found`);
    }
  }
} 