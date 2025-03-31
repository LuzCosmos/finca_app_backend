import { Controller, Post, Body, Param, Delete, UseGuards, Get, ForbiddenException, Put } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from '../services/users.service';
import { CreateUserDto } from '../dto/create-user.dto';
import { User } from '../entities/user.entity';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ModuleAccessGuard } from 'src/modules/auth/guards/module-access.guard';
import { RequireModule, RequireAction } from '../../auth/decorators/module-access.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';

@ApiTags('Users')
@ApiBearerAuth('access-token')
@Controller('users')
@UseGuards(JwtAuthGuard, ModuleAccessGuard)
@RequireModule('Employee Management')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @RequireAction('create')
  @ApiOperation({ summary: 'Crear un nuevo usuario' })
  @ApiResponse({ 
    status: 201, 
    description: 'Usuario creado exitosamente',
    type: User 
  })
  @ApiResponse({ status: 403, description: 'No tienes permisos para crear usuarios' })
  async create(@CurrentUser() currentUser: User, @Body() createUserDto: CreateUserDto) {
    // El tenantId se toma del usuario actual
    createUserDto.tenantId = currentUser.idTenant;
    return this.usersService.create(createUserDto);
  }

  @Get()
  @RequireAction('read')
  @ApiOperation({ summary: 'Obtener todos los usuarios' })
  @ApiResponse({
    status: 200,
    description: 'Lista de usuarios obtenida exitosamente',
    type: [User]
  })
  async findAll(@CurrentUser() currentUser: User) {
    return this.usersService.findByTenant(currentUser.idTenant);
  }

  @Get(':id')
  @RequireAction('read')
  @ApiOperation({ summary: 'Obtener un usuario por ID' })
  @ApiResponse({
    status: 200,
    description: 'Usuario encontrado exitosamente',
    type: User
  })
  @ApiResponse({ status: 404, description: 'Usuario no encontrado' })
  async findOne(@CurrentUser() currentUser: User, @Param('id') id: string) {
    const user = await this.usersService.findOne(id);
    if (user.idTenant !== currentUser.idTenant) {
      throw new ForbiddenException('No tienes permisos para ver este usuario');
    }
    return user;
  }

  @Put(':id')
  @RequireAction('update')
  @ApiOperation({ summary: 'Actualizar un usuario' })
  @ApiResponse({
    status: 200,
    description: 'Usuario actualizado exitosamente',
    type: User
  })
  @ApiResponse({ status: 404, description: 'Usuario no encontrado' })
  async update(
    @CurrentUser() currentUser: User,
    @Param('id') id: string,
    @Body() updateUserDto: Partial<CreateUserDto>
  ) {
    const user = await this.usersService.findOne(id);
    if (user.idTenant !== currentUser.idTenant) {
      throw new ForbiddenException('No tienes permisos para actualizar este usuario');
    }
    return this.usersService.update(id, updateUserDto);
  }

  @Delete(':id')
  @RequireAction('delete')
  @ApiOperation({ summary: 'Eliminar un usuario' })
  @ApiResponse({ status: 200, description: 'Usuario eliminado exitosamente' })
  @ApiResponse({ status: 404, description: 'Usuario no encontrado' })
  async remove(@CurrentUser() currentUser: User, @Param('id') id: string) {
    const user = await this.usersService.findOne(id);
    if (user.idTenant !== currentUser.idTenant) {
      throw new ForbiddenException('No tienes permisos para eliminar este usuario');
    }
    return this.usersService.remove(id);
  }
} 