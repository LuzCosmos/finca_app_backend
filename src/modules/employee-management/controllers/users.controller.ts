import { Controller, Post, Body, Param, Delete, UseGuards, Get, Put, HttpCode, HttpStatus, Query, ParseIntPipe, DefaultValuePipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { UsersService } from '../services/users.service';
import { CreateUserDto } from '../dto/create-user.dto';
import { UpdateUserDto } from '../dto/update-user.dto';
import { User } from '../entities/user.entity';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RequireModule, RequireAction, RequireEntity } from '../../../common/application-permissions/application-permissions.decorator';
import { UserResponseDto } from '../dto/user-response.dto';
import { plainToInstance } from 'class-transformer';
import { ApplicationPermissionsGuard } from '../../../common/application-permissions/application-permissions.guard';
import { SessionUser } from 'src/common/decorators/session-user.decorator';
import { SessionUserDto } from 'src/modules/auth/dto/session-user.dto';

@ApiTags('Users')
@ApiBearerAuth('access-token')
@Controller('users')
@UseGuards(JwtAuthGuard, ApplicationPermissionsGuard)
@RequireModule('EMP_MGMT')
@RequireEntity('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) { }

  @Post()
  @RequireAction('create')
  @ApiOperation({ summary: 'Crear un nuevo usuario' })
  @HttpCode(HttpStatus.CREATED)
  @ApiResponse({
    status: 201,
    description: 'Usuario creado exitosamente',
    type: User
  })
  @ApiResponse({ status: 403, description: 'No tienes permisos para crear usuarios' })
  async create(@SessionUser() sessionUser: SessionUserDto, @Body() createUserDto: CreateUserDto) {
    // El tenantId se toma del usuario actual
    createUserDto.tenantId = sessionUser.tenant_id;
    return this.usersService.create(createUserDto);
  }

  @Get('roles')
  @RequireAction('read')
  @ApiOperation({ summary: 'Obtener roles disponibles' })
  async getRoles(@SessionUser() sessionUser: SessionUserDto) {
    return this.usersService.getRoles(sessionUser);
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
  async findOne(@SessionUser() sessionUser: SessionUserDto, @Param('id') id: string) {
    return this.usersService.findOne(id, sessionUser);
  }

  @Put(':id')
  @RequireAction('update')
  @ApiOperation({ summary: 'Actualizar un usuario' })
  @ApiBody({
    type: UpdateUserDto,
    description: 'Actualizar datos usuario.',
    required: true
  })
  @ApiResponse({
    status: 200,
    description: 'Usuario actualizado exitosamente',
    type: User
  })
  @ApiResponse({ status: 404, description: 'Usuario no encontrado' })
  async update(@SessionUser() sessionUser: SessionUserDto, @Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.usersService.update(id, updateUserDto, sessionUser);
  }

  @Delete(':id')
  @RequireAction('delete')
  @ApiOperation({ summary: 'Eliminar un usuario' })
  @ApiResponse({
    status: 200,
    description: 'Usuario eliminado exitosamente'
  })
  @ApiResponse({ status: 404, description: 'Usuario no encontrado' })
  @ApiResponse({ status: 403, description: 'No tienes permisos para eliminar usuarios' })
  async delete(@SessionUser() sessionUser: SessionUserDto, @Param('id') id: string) {
    return this.usersService.remove(id, sessionUser);
  }

  @Get()
  @RequireAction('list')
  @ApiOperation({ summary: 'Obtener todos los usuarios' })
  @ApiResponse({
    status: 200,
    description: 'Lista de usuarios obtenida exitosamente',
    type: [UserResponseDto]
  })
  @ApiResponse({ status: 403, description: 'No tienes permisos para ver usuarios' })
  @ApiResponse({ status: 403, description: 'No tienes permisos para ver usuarios' })
  async list(
    @SessionUser() sessionUser: SessionUserDto,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('username') username?: string,
    @Query('lastName') lastName?: string,
  ) {
    return this.usersService.findWithPagination(sessionUser.tenant_id, page, limit, { username, lastName });
  }
} 