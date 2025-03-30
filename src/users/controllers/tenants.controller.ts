import { Controller, Post, Body, Param, Delete, UseGuards, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { TenantsService } from '../services/tenants.service';
import { CreateTenantDto } from '../dto/create-tenant.dto';
import { Tenant } from '../interfaces/tenant.interface';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@ApiTags('Tenants')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('tenants')
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Post()
  @ApiOperation({ summary: 'Crear un nuevo tenant' })
  @ApiResponse({
    status: 201,
    description: 'El tenant ha sido creado exitosamente',
    type: CreateTenantDto,
  })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  @ApiResponse({ status: 409, description: 'El nombre de usuario de la compañía ya existe' })
  async create(@Body() createTenantDto: CreateTenantDto): Promise<Tenant> {
    return this.tenantsService.create(createTenantDto);
  }

  @Get()
  @ApiOperation({ summary: 'Obtener todos los tenants' })
  @ApiResponse({
    status: 200,
    description: 'Lista de todos los tenants',
    type: [CreateTenantDto],
  })
  async findAll(): Promise<Tenant[]> {
    return this.tenantsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener un tenant por ID' })
  @ApiResponse({
    status: 200,
    description: 'El tenant ha sido encontrado',
    type: CreateTenantDto,
  })
  @ApiResponse({ status: 404, description: 'Tenant no encontrado' })
  async findOne(@Param('id') id: string): Promise<Tenant> {
    return this.tenantsService.findOne(id);
  }

  @Post(':id/update')
  @ApiOperation({ summary: 'Actualizar un tenant' })
  @ApiResponse({
    status: 200,
    description: 'El tenant ha sido actualizado',
    type: CreateTenantDto,
  })
  @ApiResponse({ status: 404, description: 'Tenant no encontrado' })
  async update(
    @Param('id') id: string,
    @Body() updateTenantDto: Partial<CreateTenantDto>,
  ): Promise<Tenant> {
    return this.tenantsService.update(id, updateTenantDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar un tenant' })
  @ApiResponse({ status: 204, description: 'El tenant ha sido eliminado' })
  @ApiResponse({ status: 404, description: 'Tenant no encontrado' })
  async remove(@Param('id') id: string): Promise<void> {
    return this.tenantsService.remove(id);
  }
} 