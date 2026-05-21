import {
  Injectable,
  NotFoundException,
  Logger,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { BusinessPartnerRepository } from '../repositories/business-partner.repository';
import { BusinessPartner } from '../entities/business-partner.entity';
import { Contact } from '../entities/contact.entity';
import { CreateBusinessPartnerDto } from '../dto/create-business-partner.dto';

@Injectable()
export class BusinessPartnerService {
  private readonly logger = new Logger(BusinessPartnerService.name);

  constructor(
    private readonly businessPartnerRepository: BusinessPartnerRepository,
    @InjectRepository(Contact)
    private readonly contactRepository: Repository<Contact>,
    private dataSource: DataSource,
  ) {}

  async createBusinessPartner(
    data: Partial<BusinessPartner> & CreateBusinessPartnerDto & { idTenant: string },
  ): Promise<BusinessPartner> {
    if (!data.name || data.name.trim() === '') {
      throw new BadRequestException('Business partner name is required');
    }
    if (!data.nit || data.nit.trim() === '') {
      throw new BadRequestException('NIT is required');
    }
    if (!data.type) {
      throw new BadRequestException('Business partner role is required');
    }

    const existing = await this.businessPartnerRepository.findByNit(data.nit!, data.idTenant!);
    if (existing) {
      return existing;
    }

    return await this.dataSource.manager.transaction(async (transactionalEntityManager) => {
      let contactPersonId: string | undefined;

      if (data.contactPersonName || data.phone1 || data.phone2 || data.email) {
        if (data.email && !this.isValidEmail(data.email)) {
          throw new BadRequestException('Invalid email format');
        }

        const contactRepo = transactionalEntityManager.getRepository(Contact);
        const contact = contactRepo.create({
          idTenant: data.idTenant,
          name: data.contactPersonName || '',
          phone1: data.phone1,
          phone2: data.phone2,
          email: data.email,
        });
        const savedContact = await contactRepo.save(contact);
        contactPersonId = savedContact.id;
      }

      const businessPartnerRepo = transactionalEntityManager.getRepository(BusinessPartner);
      const businessPartner = businessPartnerRepo.create({
        name: data.name!,
        nit: data.nit!,
        idTenant: data.idTenant,
        type: data.type!,
        address: data.address,
        contactPersonId,
      });

      return await businessPartnerRepo.save(businessPartner);
    });
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  async findByNit(nit: string, idTenant: string): Promise<BusinessPartner> {
    const businessPartner = await this.businessPartnerRepository.findByNit(nit, idTenant);
    if (!businessPartner) {
      throw new NotFoundException('Business partner not found by NIT');
    }
    return businessPartner;
  }

  async searchBusinessPartnersByNit(nitFragment: string, idTenant: string): Promise<BusinessPartner[]> {
    return this.businessPartnerRepository.findByNitLike(nitFragment, idTenant);
  }

  async findById(id: string, idTenant: string): Promise<BusinessPartner> {
    const businessPartner = await this.businessPartnerRepository.findById(id, idTenant);
    if (!businessPartner) {
      throw new NotFoundException('Business partner not found by ID');
    }
    return businessPartner;
  }

  async findAll(idTenant: string): Promise<BusinessPartner[]> {
    return this.businessPartnerRepository.findAll(idTenant);
  }

  async searchByName(name: string, idTenant: string): Promise<BusinessPartner[]> {
    this.logger.debug(`Searching business partners by name: "${name}" for tenant: ${idTenant}`);

    const allBusinessPartners = await this.businessPartnerRepository.findAllWithRelations(idTenant);

    this.logger.debug(`Found ${allBusinessPartners.length} total business partners for tenant`);

    if (!name || name.trim() === '') {
      return allBusinessPartners;
    }

    const searchTerm = name.toLowerCase();
    const filtered = allBusinessPartners.filter((p) =>
      p.name.toLowerCase().includes(searchTerm),
    );

    this.logger.debug(
      `Filtered to ${filtered.length} business partners matching "${searchTerm}"`,
    );

    return filtered;
  }

  async updateById(id: string, idTenant: string, data: Partial<BusinessPartner>): Promise<void> {
    const existing = await this.findById(id, idTenant);
    if (data.nit && data.nit !== existing.nit) {
      const existingByNit = await this.businessPartnerRepository.findByNit(data.nit, idTenant);
      if (existingByNit) {
        throw new ConflictException('NIT already exists for this tenant');
      }
    }
    await this.businessPartnerRepository.updateById(existing.id, idTenant, data);
  }

  async updateByNit(nit: string, idTenant: string, data: Partial<BusinessPartner>): Promise<void> {
    const existing = await this.findByNit(nit, idTenant);
    await this.businessPartnerRepository.updateByNit(existing.nit, idTenant, data);
  }

  async deleteById(id: string, idTenant: string): Promise<void> {
    const existing = await this.findById(id, idTenant);
    await this.businessPartnerRepository.deleteById(existing.id, idTenant);
  }

  async deleteByNit(nit: string, idTenant: string): Promise<void> {
    const existing = await this.findByNit(nit, idTenant);
    await this.businessPartnerRepository.deleteByNit(existing.nit, idTenant);
  }
}
