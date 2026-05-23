import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { DeviceConfigurationProfile } from '../entities/device-configuration-profile.entity';

@Injectable()
export class DeviceConfigurationProfileRepository {
  constructor(
    @InjectRepository(DeviceConfigurationProfile)
    private readonly repository: Repository<DeviceConfigurationProfile>,
  ) {}

  /** Devuelve perfiles globales (system) + perfiles del tenant. */
  async findAvailableForTenant(idTenant: string): Promise<DeviceConfigurationProfile[]> {
    return this.repository
      .createQueryBuilder('p')
      .where('(p.idTenant IS NULL OR p.idTenant = :idTenant)', { idTenant })
      .andWhere('p.isActive = true')
      .orderBy('p.isSystem', 'DESC')
      .addOrderBy('p.code', 'ASC')
      .getMany();
  }

  async findById(id: string): Promise<DeviceConfigurationProfile> {
    const p = await this.repository.findOne({ where: { id } });
    if (!p) throw new NotFoundException(`Configuration profile ${id} not found`);
    return p;
  }

  async findByCodeForTenant(
    code: string,
    idTenant: string,
  ): Promise<DeviceConfigurationProfile | null> {
    return this.repository.findOne({
      where: [
        { code, idTenant: IsNull(), isActive: true },
        { code, idTenant, isActive: true },
      ],
    });
  }

  async createForTenant(
    idTenant: string,
    data: {
      code: string;
      name: string;
      description?: string;
      parameters: Record<string, unknown>;
    },
  ): Promise<DeviceConfigurationProfile> {
    const entity = this.repository.create({
      ...data,
      idTenant,
      isSystem: false,
      isActive: true,
    });
    return this.repository.save(entity);
  }

  async updateForTenant(
    id: string,
    idTenant: string,
    patch: Partial<{
      name: string;
      description: string | null;
      parameters: Record<string, unknown>;
      isActive: boolean;
    }>,
  ): Promise<DeviceConfigurationProfile> {
    const profile = await this.repository.findOne({ where: { id } });
    if (!profile) throw new NotFoundException(`Configuration profile ${id} not found`);
    if (profile.isSystem) {
      throw new NotFoundException(`Profile ${profile.code} is system-managed and not editable`);
    }
    if (profile.idTenant !== idTenant) {
      throw new NotFoundException(`Configuration profile ${id} not found in this tenant`);
    }
    Object.assign(profile, patch);
    return this.repository.save(profile);
  }

  async deleteForTenant(id: string, idTenant: string): Promise<void> {
    const profile = await this.repository.findOne({ where: { id } });
    if (!profile) throw new NotFoundException(`Configuration profile ${id} not found`);
    if (profile.isSystem) {
      throw new NotFoundException(`Profile ${profile.code} is system-managed and not removable`);
    }
    if (profile.idTenant !== idTenant) {
      throw new NotFoundException(`Configuration profile ${id} not found in this tenant`);
    }
    await this.repository.delete(id);
  }
}
