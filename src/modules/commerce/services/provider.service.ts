import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { ProviderRepository } from '../repositories/provider.repository';
import { Provider } from '../entities/provider.entity';
import { ConflictException } from '@nestjs/common';

@Injectable()
export class ProviderService {

  private readonly logger = new Logger(ProviderService.name);

  constructor(private readonly providerRepository: ProviderRepository) {}

  async createProvider(data: Partial<Provider>): Promise<Provider> {
    const existing = await this.providerRepository.findByNit(data.nit!, data.idTenant!);
    if (existing) {
      throw new ConflictException('NIT already exists for this tenant');
    }
    return this.providerRepository.createProvider(data);
  }

  async findByNit(nit: string, idTenant: string): Promise<Provider> {
    const provider = await this.providerRepository.findByNit(nit, idTenant);
    if (!provider) {
      throw new NotFoundException('Provider not found by NIT');
    }
    return provider;
  }

  async searchProvidersByNit(nitFragment: string, idTenant: string): Promise<Provider[]> {
    return this.providerRepository.findByNitLike(nitFragment, idTenant);
  }

  async findById(id: string, idTenant: string): Promise<Provider> {
    const provider = await this.providerRepository.findById(id, idTenant);
    if (!provider) {
      throw new NotFoundException('Provider not found by ID');
    }
    return provider;
  }

  async findAll(idTenant: string): Promise<Provider[]> {
    return this.providerRepository.findAll(idTenant);
  }

  async updateById(id: string, idTenant: string, data: Partial<Provider>): Promise<void> {
    const existing = await this.findById(id, idTenant);
    if (data.nit && data.nit !== existing.nit) {
      const existingByNit = await this.providerRepository.findByNit(data.nit, idTenant);
      if (existingByNit) {
        throw new ConflictException('NIT already exists for this tenant');
      }
    }
    await this.providerRepository.updateById(existing.id, idTenant, data);
  }

  async updateByNit(nit: string, idTenant: string, data: Partial<Provider>): Promise<void> {
    const existing = await this.findByNit(nit, idTenant);
    await this.providerRepository.updateByNit(existing.nit, idTenant, data);
  }

  async deleteById(id: string, idTenant: string): Promise<void> {
    const existing = await this.findById(id, idTenant);
    await this.providerRepository.deleteById(existing.id, idTenant);
  }

  async deleteByNit(nit: string, idTenant: string): Promise<void> {
    const existing = await this.findByNit(nit, idTenant);
    await this.providerRepository.deleteByNit(existing.nit, idTenant);
  }
}
