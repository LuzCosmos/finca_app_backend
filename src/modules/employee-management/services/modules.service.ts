import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ModuleEntity } from '../entities/module.entity';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { EntityManager } from 'typeorm';

@Injectable()
export class ModulesService {
  constructor(
    @InjectRepository(ModuleEntity)
    private readonly moduleRepository: Repository<ModuleEntity>,
  ) { }

  @ApiOperation({ summary: 'Obtener todos los módulos' })
  async findAll(manager?: EntityManager): Promise<ModuleEntity[]> {
    const moduleRepo = manager ? manager.getRepository(ModuleEntity) : this.moduleRepository;
    return moduleRepo.find();
  }

  @ApiOperation({ summary: 'Buscar un módulo por nombre' })
  async findByName(name: string, manager?: EntityManager): Promise<ModuleEntity> {
    const moduleRepo = manager ? manager.getRepository(ModuleEntity) : this.moduleRepository;
    const module = await moduleRepo.findOne({
      where: { name }
    });

    if (!module) {
      throw new NotFoundException(`Module "${name}" not found`);
    }

    return module;
  }

  @ApiOperation({ summary: 'Buscar un módulo por ID' })
  async findById(id: string, manager?: EntityManager): Promise<ModuleEntity> {
    const moduleRepo = manager ? manager.getRepository(ModuleEntity) : this.moduleRepository;
    const module = await moduleRepo.findOne({
      where: { id }
    });

    if (!module) {
      throw new NotFoundException(`Module with ID "${id}" not found`);
    }

    return module;
  }
} 