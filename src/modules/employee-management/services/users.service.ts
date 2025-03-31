import { Injectable, NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere } from 'typeorm';
import { plainToInstance } from 'class-transformer';
import * as bcrypt from 'bcrypt';
import { CreateUserDto } from '../dto/create-user.dto';
import { User } from '../entities/user.entity';
import { Role } from '../entities/role.entity';
import { RolesService } from './roles.service';
import { ModuleEntity } from '../entities/module.entity';
import { UpdateUserDto } from '../dto/update-user.dto';
import { UserResponseDto } from '../dto/user-response.dto';
import { ModuleAction } from '../../auth/types/module-action.type';


interface CreateAdminUserDto {
  username: string;
  password: string;
  email: string;
  firstName: string;
  lastName: string;
  tenantId: string;
}

@Injectable()
export class UsersService {
  private userModuleId: string;
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Role)
    private readonly rolesRepository: Repository<Role>,
    @InjectRepository(ModuleEntity)
    private readonly modulesRepository: Repository<ModuleEntity>,
    private readonly rolesService: RolesService,
  ) {this.initializeUsersModuleId()}

  private async initializeUsersModuleId() {
    const employeeManagementModule = await this.modulesRepository.findOne({ 
      where: { name: 'Employee Management' } 
    });
    
    if (!employeeManagementModule) {
      throw new Error('Módulo Employee Management no encontrado');
    }
    this.userModuleId = employeeManagementModule.id;
  }

  async create(createUserDto: CreateUserDto): Promise<UserResponseDto> {
    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);
    const user = this.userRepository.create({
      ...createUserDto,
      password: hashedPassword,
    });
    const savedUser = await this.userRepository.save(user);
    return plainToInstance(UserResponseDto, savedUser);
  }

  async findAll(): Promise<UserResponseDto[]> {
    const users = await this.userRepository.find({
      relations: ['roles', 'tenant']
    });
    return users.map(user => plainToInstance(UserResponseDto, user));
  }

  async findByTenant(tenantId: string): Promise<UserResponseDto[]> {
    const users = await this.userRepository.find({
      where: { idTenant: tenantId },
      relations: ['roles', 'tenant']
    });
    return users.map(user => plainToInstance(UserResponseDto, user));
  }

  async findOne(id: string): Promise<UserResponseDto> {
    const user = await this.userRepository.findOne({
      where: { id },
      relations: ['roles', 'tenant']
    });
    if (!user) {
      throw new NotFoundException(`Usuario con ID ${id} no encontrado`);
    }
    return plainToInstance(UserResponseDto, user);
  }

  async findOneWithPassword(id: string): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id },
      relations: ['roles', 'tenant']
    });
    if (!user) {
      throw new NotFoundException(`Usuario con ID ${id} no encontrado`);
    }
    return user;
  }

  async update(
    id: string, 
    updateUserDto: UpdateUserDto, 
    currentUserId: string,
    currentUserTenantId: string
  ): Promise<UserResponseDto> {
    const user = await this.findOneWithPassword(id);
    const isOwnUser = currentUserId === id;
    
    // Verificar si es el propio usuario o tiene permisos de actualización
    if (!isOwnUser) {
      const hasUpdatePermission = await this.hasPermission(
        currentUserId,
        currentUserTenantId,
        'update'
      );
      if (!hasUpdatePermission) {
        throw new ForbiddenException('No tienes permisos para modificar otros usuarios');
      }
    }

    // Crear objeto con los cambios permitidos
    const allowedChanges: Partial<User> = {};

    // Campos que cualquier usuario puede modificar de sí mismo
    if (isOwnUser) {
      if (updateUserDto.firstName) allowedChanges.firstName = updateUserDto.firstName;
      if (updateUserDto.lastName) allowedChanges.lastName = updateUserDto.lastName;
      if (updateUserDto.email) allowedChanges.email = updateUserDto.email;
      if (updateUserDto.username) allowedChanges.username = updateUserDto.username;
      if (updateUserDto.password) {
        allowedChanges.password = await bcrypt.hash(updateUserDto.password, 10);
      }
    }

    // Campos que solo los administradores pueden modificar
    if (!isOwnUser) {
      if (updateUserDto.firstName) allowedChanges.firstName = updateUserDto.firstName;
      if (updateUserDto.lastName) allowedChanges.lastName = updateUserDto.lastName;
      if (updateUserDto.email) allowedChanges.email = updateUserDto.email;
      if (updateUserDto.username) allowedChanges.username = updateUserDto.username;
      if (updateUserDto.password) {
        allowedChanges.password = await bcrypt.hash(updateUserDto.password, 10);
      }
      
      // Roles solo pueden ser modificados por administradores
      if (updateUserDto.roleIds) {
        const roles = await this.rolesRepository.findByIds(updateUserDto.roleIds);
        if (roles.length !== updateUserDto.roleIds.length) {
          throw new NotFoundException('Uno o más roles no encontrados');
        }
        allowedChanges.roles = roles;
      }
    }

    // Nunca permitir cambiar el tenant
    if (updateUserDto.tenantId) {
      throw new ForbiddenException('No se permite modificar el tenant de un usuario');
    }

    const updatedUser = await this.userRepository.save({
      ...user,
      ...allowedChanges,
    });
    
    return plainToInstance(UserResponseDto, updatedUser);
  }

  async remove(id: string): Promise<void> {
    const result = await this.userRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Usuario con ID ${id} no encontrado`);
    }
  }

  async findByUsername(username: string, tenantId: string): Promise<User | undefined> {
    const user = await this.userRepository.findOne({
      where: { username, idTenant: tenantId },
      relations: ['roles', 'tenant']
    });
    return user || undefined;
  }

  async validateUser(username: string, password: string, tenantId: string): Promise<UserResponseDto | undefined> {
    const user = await this.findByUsername(username, tenantId);
    if (user && await bcrypt.compare(password, user.password)) {
      return plainToInstance(UserResponseDto, user);
    }
    return undefined;
  }

  async hasPermission(userId: string, tenantId: string, action: ModuleAction): Promise<boolean> {
    const user = await this.findOneWithPassword(userId);
    
    if (!user || user.idTenant !== tenantId) {
      throw new ForbiddenException('El usuario no pertenece a este tenant');
    }

    return this.rolesService.hasPermission(
      user,
      this.userModuleId,
      action
    );
  }

  async createAdminUser(dto: CreateAdminUserDto): Promise<UserResponseDto> {
    const where: FindOptionsWhere<User>[] = [
      { username: dto.username, idTenant: dto.tenantId },
      { email: dto.email, idTenant: dto.tenantId }
    ];

    const existingUser = await this.userRepository.findOne({ where });

    if (existingUser) {
      throw new ConflictException('Ya existe un usuario con ese username o email en este tenant');
    }

    const adminRole = await this.rolesService.findByName('System Admin IT');
    if (!adminRole) {
      throw new NotFoundException('No se encontró el rol de administrador');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    const user = this.userRepository.create({
      username: dto.username,
      password: hashedPassword,
      email: dto.email,
      firstName: dto.firstName,
      lastName: dto.lastName,
      idTenant: dto.tenantId,
      roles: [adminRole]
    });

    const savedUser = await this.userRepository.save(user);
    return plainToInstance(UserResponseDto, savedUser);
  }
} 