import { Controller, Post, Body, Param, Delete, UseGuards, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { RolesService } from '../services/roles.service';
import { CreateRoleDto } from '../dto/create-role.dto';
import { Role } from '../interfaces/role.interface';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@ApiTags('Roles')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Post()
  @ApiOperation({ summary: 'Crear un nuevo rol' })
  @ApiResponse({
    status: 201,
    description: 'El rol ha sido creado exitosamente',
    type: CreateRoleDto,
  })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  async create(@Body() createRoleDto: CreateRoleDto): Promise<Role> {
    return this.rolesService.create(createRoleDto);
  }

  @Get()
  @ApiOperation({ summary: 'Obtener todos los roles' })
  @ApiResponse({
    status: 200,
    description: 'Lista de todos los roles',
    type: [CreateRoleDto],
  })
  async findAll(): Promise<Role[]> {
    return this.rolesService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener un rol por ID' })
  @ApiResponse({
    status: 200,
    description: 'El rol ha sido encontrado',
    type: CreateRoleDto,
  })
  @ApiResponse({ status: 404, description: 'Rol no encontrado' })
  async findOne(@Param('id') id: string): Promise<Role> {
    return this.rolesService.findOne(id);
  }

  @Post(':id/update')
  @ApiOperation({ summary: 'Actualizar un rol' })
  @ApiResponse({
    status: 200,
    description: 'El rol ha sido actualizado',
    type: CreateRoleDto,
  })
  @ApiResponse({ status: 404, description: 'Rol no encontrado' })
  async update(
    @Param('id') id: string,
    @Body() updateRoleDto: Partial<CreateRoleDto>,
  ): Promise<Role> {
    return this.rolesService.update(id, updateRoleDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar un rol' })
  @ApiResponse({ status: 204, description: 'El rol ha sido eliminado' })
  @ApiResponse({ status: 404, description: 'Rol no encontrado' })
  async remove(@Param('id') id: string): Promise<void> {
    return this.rolesService.remove(id);
  }
} 