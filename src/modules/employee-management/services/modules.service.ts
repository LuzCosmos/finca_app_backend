import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ModuleEntity } from '../entities/module.entity';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@Injectable()
export class ModulesService {
  constructor(
    @InjectRepository(ModuleEntity)
    private readonly moduleRepository: Repository<ModuleEntity>,
  ) {}

  @ApiOperation({ summary: 'Obtener todos los módulos' })
  async findAll(): Promise<ModuleEntity[]> {
    return this.moduleRepository.find();
  }

  @ApiOperation({ summary: 'Buscar un módulo por nombre' })
  async findByName(name: string): Promise<ModuleEntity> {
    const module = await this.moduleRepository.findOne({
      where: { name }
    });

    if (!module) {
      throw new NotFoundException(`Module "${name}" not found`);
    }

    return module;
  }

  @ApiOperation({ summary: 'Buscar un módulo por ID' })
  async findById(id: string): Promise<ModuleEntity> {
    const module = await this.moduleRepository.findOne({
      where: { id }
    });

    if (!module) {
      throw new NotFoundException(`Module with ID "${id}" not found`);
    }

    return module;
  }
} 