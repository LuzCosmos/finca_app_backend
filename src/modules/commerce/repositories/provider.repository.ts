import { ILike, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Provider } from '../entities/provider.entity';
import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';

@Injectable()
export class ProviderRepository {

  constructor(
    @InjectRepository(Provider)
    private readonly repository: Repository<Provider>,
  ) { }

  /**
   * Create a new provider
   * @param data - The data to create the provider
   * @returns The created provider
   */
  async createProvider(data: Partial<Provider>): Promise<Provider> {
    const provider = this.repository.create(data);
    return this.repository.save(provider);
  }

  /**
   * Find a provider by NIT
   * @param nit - The NIT of the provider
   * @param idTenant - The tenant ID
   * @returns The provider
   */
  async findByNit(nit: string, idTenant: string): Promise<Provider | null> {
    return this.repository.findOne({
      where: {
        nit,
        idTenant,
      },
    });
  }

  /**
   * Find providers by NIT fragment
   * @param nitFragment - The NIT fragment
   * @param idTenant - The tenant ID
   * @returns The providers
   */
  async findByNitLike(nitFragment: string, idTenant: string): Promise<Provider[]> {
    return this.repository.find({
      where: {
        nit: ILike(`%${nitFragment}%`),
        idTenant,
      },
      order: {
        nit: 'ASC',
        name: 'ASC',
      },
    });
  }

  /**
   * Find a provider by ID
   * @param id - The ID of the provider
   * @param idTenant - The tenant ID
   * @returns The provider
   */
  async findById(id: string, idTenant: string, manager?: EntityManager): Promise<Provider | null> {
    const repo = manager?.getRepository(Provider) ?? this.repository;
    return repo.findOne({
      where: {
        id,
        idTenant,
      },
    });
  }

  /**
   * Find all providers
   * @param idTenant - The tenant ID
   * @returns The providers
   */
  async findAll(idTenant: string): Promise<Provider[]> {
    return this.repository.find({ where: { idTenant } });
  }

  /**
   * Find all providers with contact relations
   * @param idTenant - The tenant ID
   * @returns The providers with contact person loaded
   */
  async findAllWithRelations(idTenant: string): Promise<Provider[]> {
    return this.repository.find({
      where: { idTenant },
      relations: ['contactPerson'],
    });
  }

  /**
   * Update a provider by ID
   * @param id - The ID of the provider
   * @param idTenant - The tenant ID
   * @param data - The data to update the provider
   */
  async updateById(id: string, idTenant: string, data: Partial<Provider>): Promise<void> {
    await this.repository.update({ id, idTenant }, data);
  }

  /**
   * Update a provider by NIT
   * @param nit - The NIT of the provider
   * @param idTenant - The tenant ID
   * @param data - The data to update the provider
   */
  async updateByNit(nit: string, idTenant: string, data: Partial<Provider>): Promise<void> {
    await this.repository.update({ nit, idTenant }, data);
  }

  /**
   * Delete a provider by ID
   * @param id - The ID of the provider
   * @param idTenant - The tenant ID
   */
  async deleteById(id: string, idTenant: string): Promise<void> {
    await this.repository.delete({ id, idTenant });
  }

  /**
   * Delete a provider by NIT
   * @param nit - The NIT of the provider
   * @param idTenant - The tenant ID
   */
  async deleteByNit(nit: string, idTenant: string): Promise<void> {
    await this.repository.delete({ nit, idTenant });
  }
}
