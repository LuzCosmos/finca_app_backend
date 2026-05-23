import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { BusinessPartnerService } from './business-partner.service';
import { BusinessPartnerRepository } from '../repositories/business-partner.repository';
import { BusinessPartner, BusinessPartnerRole } from '../entities/business-partner.entity';
import { Contact } from '../entities/contact.entity';

describe('BusinessPartnerService', () => {
  let service: BusinessPartnerService;
  let businessPartnerRepository: jest.Mocked<
    Pick<
      BusinessPartnerRepository,
      | 'findByNit'
      | 'findById'
      | 'findByNitLike'
      | 'findAll'
      | 'findAllWithRelations'
      | 'updateById'
      | 'updateByNit'
      | 'deleteById'
      | 'deleteByNit'
    >
  >;
  let contactRepository: { create: jest.Mock; save: jest.Mock };
  let dataSource: { manager: { transaction: jest.Mock } };

  const tenantId = 'tenant-1';
  const existingPartner = {
    id: 'bp-1',
    idTenant: tenantId,
    name: 'Ganadería Test',
    nit: '900111222',
    type: BusinessPartnerRole.PROVIDER,
  } as BusinessPartner;

  beforeEach(() => {
    businessPartnerRepository = {
      findByNit: jest.fn(),
      findById: jest.fn(),
      findByNitLike: jest.fn(),
      findAll: jest.fn(),
      findAllWithRelations: jest.fn(),
      updateById: jest.fn(),
      updateByNit: jest.fn(),
      deleteById: jest.fn(),
      deleteByNit: jest.fn(),
    };
    contactRepository = {
      create: jest.fn((data) => data as Contact),
      save: jest.fn(async (c) => ({ ...c, id: 'contact-1' }) as Contact),
    };
    dataSource = {
      manager: {
        transaction: jest.fn(async (cb) => {
          const transactionalEntityManager = {
            getRepository: jest.fn((entity) => {
              if (entity === Contact) {
                return contactRepository;
              }
              return {
                create: jest.fn((data) => ({ ...data, id: 'bp-new' })),
                save: jest.fn(async (bp) => bp as BusinessPartner),
              };
            }),
          };
          return cb(transactionalEntityManager);
        }),
      },
    };
    service = new BusinessPartnerService(
      businessPartnerRepository as unknown as BusinessPartnerRepository,
      contactRepository as never,
      dataSource as unknown as DataSource,
    );
  });

  describe('createBusinessPartner', () => {
    it('rejects empty name', async () => {
      await expect(
        service.createBusinessPartner({
          name: '  ',
          nit: '900123',
          type: BusinessPartnerRole.PROVIDER,
          idTenant: tenantId,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('returns existing partner when NIT already exists', async () => {
      businessPartnerRepository.findByNit.mockResolvedValue(existingPartner);

      const result = await service.createBusinessPartner({
        name: 'Otro nombre',
        nit: existingPartner.nit,
        type: BusinessPartnerRole.BUYER,
        idTenant: tenantId,
      });

      expect(result).toBe(existingPartner);
      expect(dataSource.manager.transaction).not.toHaveBeenCalled();
    });

    it('creates partner with contact in transaction', async () => {
      businessPartnerRepository.findByNit.mockResolvedValue(null);

      const result = await service.createBusinessPartner({
        name: 'Nueva Ganadería',
        nit: '900999888',
        type: BusinessPartnerRole.PROVIDER,
        idTenant: tenantId,
        contactPersonName: 'Juan',
        email: 'juan@test.com',
      });

      expect(result.id).toBe('bp-new');
      expect(contactRepository.save).toHaveBeenCalled();
    });

    it('rejects invalid email', async () => {
      businessPartnerRepository.findByNit.mockResolvedValue(null);

      await expect(
        service.createBusinessPartner({
          name: 'Nueva',
          nit: '900999887',
          type: BusinessPartnerRole.PROVIDER,
          idTenant: tenantId,
          email: 'not-an-email',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('requires extraConfig.sales.minWeightKg for BUYER', async () => {
      businessPartnerRepository.findByNit.mockResolvedValue(null);

      await expect(
        service.createBusinessPartner({
          name: 'Comprador',
          nit: '900999886',
          type: BusinessPartnerRole.BUYER,
          idTenant: tenantId,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('creates BUYER with extraConfig', async () => {
      businessPartnerRepository.findByNit.mockResolvedValue(null);

      const result = await service.createBusinessPartner({
        name: 'Comprador Con Min',
        nit: '900999885',
        type: BusinessPartnerRole.BUYER,
        idTenant: tenantId,
        extraConfig: { sales: { minWeightKg: 310 } },
      });

      expect(result.extraConfig).toEqual({ sales: { minWeightKg: 310 } });
    });
  });

  describe('findByNit', () => {
    it('throws NotFoundException when missing', async () => {
      businessPartnerRepository.findByNit.mockResolvedValue(null);

      await expect(service.findByNit('missing', tenantId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('searchByName', () => {
    it('filters partners by name case-insensitively', async () => {
      businessPartnerRepository.findAllWithRelations.mockResolvedValue([
        { ...existingPartner, name: 'Alpha Farms' } as BusinessPartner,
        { ...existingPartner, id: 'bp-2', name: 'Beta Ranch' } as BusinessPartner,
      ]);

      const result = await service.searchByName('alpha', tenantId);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Alpha Farms');
    });

    it('returns all when search term is empty', async () => {
      const all = [existingPartner];
      businessPartnerRepository.findAllWithRelations.mockResolvedValue(all);

      const result = await service.searchByName('', tenantId);

      expect(result).toEqual(all);
    });
  });

  describe('updateById', () => {
    it('throws ConflictException when NIT collides with another partner', async () => {
      businessPartnerRepository.findById.mockResolvedValue(existingPartner);
      businessPartnerRepository.findByNit.mockResolvedValue({
        ...existingPartner,
        id: 'other-id',
        nit: '900555666',
      } as BusinessPartner);

      await expect(
        service.updateById(existingPartner.id, tenantId, { nit: '900555666' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('deleteById', () => {
    it('deletes after resolving partner', async () => {
      businessPartnerRepository.findById.mockResolvedValue(existingPartner);

      await service.deleteById(existingPartner.id, tenantId);

      expect(businessPartnerRepository.deleteById).toHaveBeenCalledWith(
        existingPartner.id,
        tenantId,
      );
    });
  });
});
