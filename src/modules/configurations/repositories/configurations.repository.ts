import { Configuration } from "../entities/configuration.entity";
import { EntityManager } from "typeorm";
import { Repository } from "typeorm";
import { InjectRepository } from "@nestjs/typeorm";
import { Injectable } from "@nestjs/common";

@Injectable()
export class ConfigurationsRepository {
    constructor(
        @InjectRepository(Configuration)
        private readonly repository: Repository<Configuration>,
    ) { }

    async createTenantDefaults(idTenant: string, manager?: EntityManager): Promise<Configuration> {
        const configurationRepository = manager?.getRepository(Configuration) || this.repository;
        const configuration = new Configuration();
        configuration.idTenant = idTenant;
        configuration.code = 'next_cattle_sysnumber';
        configuration.isSystemConfig = true;
        configuration.name = 'Next Cattle SysNumber';
        configuration.value = '1';
        configuration.valueType = 'number';
        configuration.description = 'Next sysnumber assignment for new cattle';
        return configurationRepository.save(configuration);
    }

    async create(idTenant: string, configuration: Configuration, manager?: EntityManager): Promise<Configuration> {
        const configurationRepository = manager?.getRepository(Configuration) || this.repository;
        return configurationRepository.save({ ...configuration, idTenant });
    }

    async update(idTenant: string, id: string, configuration: Configuration, manager?: EntityManager): Promise<Configuration> {
        const configurationRepository = manager?.getRepository(Configuration) || this.repository;
        return configurationRepository.save({ ...configuration, idTenant, id });
    }

    async updateTenantConfiguration(idTenant: string, code: string, value: string, manager?: EntityManager): Promise<void> {
        const configurationRepository = manager?.getRepository(Configuration) || this.repository;
        await configurationRepository.update({ idTenant, code }, { value });
    }

    async delete(idTenant: string, id: string, manager?: EntityManager): Promise<void> {
        const configurationRepository = manager?.getRepository(Configuration) || this.repository;
        await configurationRepository.delete({ idTenant, id });
    }

    async findOneByCode(idTenant: string, code: string, manager?: EntityManager): Promise<Configuration | null> {
        const configurationRepository = manager?.getRepository(Configuration) || this.repository;
        return configurationRepository.findOne({ where: { idTenant, code } });
    }

    async findAll(idTenant: string, manager?: EntityManager): Promise<Configuration[]> {
        const configurationRepository = manager?.getRepository(Configuration) || this.repository;
        return configurationRepository.find({ where: { idTenant } });
    }
}