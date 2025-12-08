import { Controller, Post, Body, Param, Delete, UseGuards, Get, ForbiddenException, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { TenantsService } from '../services/tenants.service';
import { CreateTenantDto } from '../dto/create-tenant.dto';
import { Tenant } from '../entities/tenant.entity';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ApplicationPermissionsGuard } from '../../../common/application-permissions/application-permissions.guard';
import { RequireModule, RequireAction, RequireEntity } from '../../../common/application-permissions/application-permissions.decorator';
import { SessionUserDto } from 'src/modules/auth/dto/session-user.dto';
import { SessionUser } from 'src/common/decorators/session-user.decorator';

@ApiTags('Tenants')
@Controller('tenants')
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Post()
  @ApiOperation({ summary: 'Crear un nuevo tenant con usuario administrador' })
  @HttpCode(HttpStatus.CREATED)
  @ApiResponse({
    status: 201,
    description: 'El tenant ha sido creado exitosamente con su usuario administrador',
    type: CreateTenantDto,
  })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  @ApiResponse({ status: 409, description: 'El nombre de usuario de la compañía ya existe' })
  async create(@Body() createTenantDto: CreateTenantDto): Promise<Tenant> {
    return this.tenantsService.create(createTenantDto);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, ApplicationPermissionsGuard)
  @RequireModule('EMP_MGMT')
  @RequireEntity('tenants')
  @RequireAction('read')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Obtener un tenant por ID' })
  @ApiResponse({
    status: 200,
    description: 'El tenant ha sido encontrado',
    type: Tenant,
  })
  @ApiResponse({ status: 404, description: 'Tenant no encontrado' })
  async read(@SessionUser() sessionUser: SessionUserDto, @Param('id') id: string): Promise<Tenant> {
    if(sessionUser.tenant_id !== id){
      throw new ForbiddenException('No tienes permisos para acceder a este tenant');
    }
    return this.tenantsService.findOne(id);
  }
/*
  @Post(':id/update')
  @UseGuards(JwtAuthGuard, ApplicationPermissionsGuard)
  @RequireModule('EMP_MGMT')
  @RequireEntity('tenants')
  @RequireAction('update')
  @ApiBearerAuth('access-token')
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
*/
/*
  @Delete(':id')
  @UseGuards(JwtAuthGuard, ApplicationPermissionsGuard)
  @RequireModule('EMP_MGMT')
  @RequireEntity('tenants')
  @RequireAction('delete')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Eliminar un tenant' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiResponse({ status: 204, description: 'El tenant ha sido eliminado' })
  @ApiResponse({ status: 404, description: 'Tenant no encontrado' })
  async remove(@Param('id') id: string): Promise<void> {
    return this.tenantsService.remove(id);
  }
*/
/*
  @Get()
  @UseGuards(JwtAuthGuard, ApplicationPermissionsGuard)
  @RequireModule('EMP_MGMT')
  @RequireEntity('tenants')
  @RequireAction('list')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Obtener todos los tenants' })
  @ApiResponse({
    status: 200,
    description: 'Lista de todos los tenants',
    type: [CreateTenantDto],
  })
  async findAll(): Promise<Tenant[]> {
    return this.tenantsService.findAll();
  }*/
} 