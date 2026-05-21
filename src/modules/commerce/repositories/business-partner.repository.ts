import { ILike, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { BusinessPartner } from '../entities/business-partner.entity';
import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';

@Injectable()
export class BusinessPartnerRepository {
  constructor(
    @InjectRepository(BusinessPartner)
    private readonly repository: Repository<BusinessPartner>,
  ) {}

  async createBusinessPartner(data: Partial<BusinessPartner>): Promise<BusinessPartner> {
    const businessPartner = this.repository.create(data);
    return this.repository.save(businessPartner);
  }

  async findByNit(nit: string, idTenant: string): Promise<BusinessPartner | null> {
    return this.repository.findOne({
      where: { nit, idTenant },
    });
  }

  async findByNitLike(nitFragment: string, idTenant: string): Promise<BusinessPartner[]> {
    return this.repository.find({
      where: {
        nit: ILike(`%${nitFragment}%`),
        idTenant,
      },
      order: { nit: 'ASC', name: 'ASC' },
    });
  }

  async findById(
    id: string,
    idTenant: string,
    manager?: EntityManager,
  ): Promise<BusinessPartner | null> {
    const repo = manager?.getRepository(BusinessPartner) ?? this.repository;
    return repo.findOne({ where: { id, idTenant } });
  }

  async findAll(idTenant: string): Promise<BusinessPartner[]> {
    return this.repository.find({ where: { idTenant } });
  }

  async findAllWithRelations(idTenant: string): Promise<BusinessPartner[]> {
    return this.repository.find({
      where: { idTenant },
      relations: ['contactPerson'],
    });
  }

  async updateById(id: string, idTenant: string, data: Partial<BusinessPartner>): Promise<void> {
    await this.repository.update({ id, idTenant }, data);
  }

  async updateByNit(nit: string, idTenant: string, data: Partial<BusinessPartner>): Promise<void> {
    await this.repository.update({ nit, idTenant }, data);
  }

  async deleteById(id: string, idTenant: string): Promise<void> {
    await this.repository.delete({ id, idTenant });
  }

  async deleteByNit(nit: string, idTenant: string): Promise<void> {
    await this.repository.delete({ nit, idTenant });
  }
}
