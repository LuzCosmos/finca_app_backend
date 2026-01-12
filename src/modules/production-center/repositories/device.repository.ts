import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { Device } from '../entities/device.entity';
import { CreateDeviceDto } from '../dto/create-device.dto';
import { UpdateDeviceDto } from '../dto/update-device.dto';

@Injectable()
export class DeviceRepository {
  constructor(
    @InjectRepository(Device)
    private readonly repository: Repository<Device>,
  ) { }

  /**
   * Create a new device
   * @param createDeviceDto - The DTO containing the device data
   * @returns The created device
   */
  async create(createDeviceDto: CreateDeviceDto): Promise<Device> {
    const device = this.repository.create(createDeviceDto);
    return await this.repository.save(device);
  }

  /**
   * Find all devices by tenant ID
   * @param idTenant - The tenant ID
   * @returns The list of devices
   */
  async findAll(idTenant: string): Promise<Device[]> {
    return await this.repository.find({ where: { idTenant } });
  }

  /**
   * Find a device by its ID
   * @param id - The ID of the device
   * @returns The found device
   */
  async findOne(id: string): Promise<Device> {
    const device = await this.repository.findOne({ where: { id } });
    if (!device) {
      throw new NotFoundException(`Device with ID ${id} not found`);
    }
    return device;
  }

  /**
   * Find a device by its DevEUI and tenant ID
   * @param deveui - The DevEUI of the device
   * @param idTenant - The tenant ID
   * @returns The found device
   */
  async findByIdAndTenantId(id: string, idTenant: string, manager?: EntityManager): Promise<Device> {
    const repo = manager ? manager.getRepository(Device) : this.repository;
    const device = await repo.findOne({ where: { id, idTenant } });
    if (!device) {
      throw new NotFoundException(`Device with ID ${id} not found`);
    }
    return device;
  }

  /**
   * Find a device by its DevEUI and tenant ID
   * @param deveui - The DevEUI of the device
   * @param idTenant - The tenant ID
   * @returns The found device
   */
  async findByDevEuiAndTenantId(deveui: string, idTenant: string, manager?: EntityManager): Promise<Device> {
    const repo = manager ? manager.getRepository(Device) : this.repository;
    const device = await repo.findOne({ where: { deveui, idTenant } });
    if (!device) {
      throw new NotFoundException(`Device with DevEUI ${deveui} not found`);
    }
    return device;
  }

  /**
   * Update a device by its ID
   * @param id - The ID of the device
   * @param updateDeviceDto - The DTO containing the updated device data
   * @returns The updated device
   */
  async update(id: string, updateDeviceDto: UpdateDeviceDto, manager?: EntityManager): Promise<Device | null> {
    const repo = manager ? manager.getRepository(Device) : this.repository;
    await repo.update(id, updateDeviceDto);
    return await repo.findOne({ where: { id } });
  }

  /**
   * Remove a device by its ID
   * @param id - The ID of the device
   */
  async remove(id: string): Promise<void> {
    const result = await this.repository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Device with ID ${id} not found`);
    }
  }
} 