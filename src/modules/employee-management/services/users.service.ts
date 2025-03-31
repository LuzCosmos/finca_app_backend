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
    private rolesRepository: Repository<Role>,
    @InjectRepository(ModuleEntity)
    private modulesRepository: Repository<ModuleEntity>,
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

  async update(id: string, updateUserDto: UpdateUserDto): Promise<UserResponseDto> {
    const user = await this.findOneWithPassword(id);
    
    if (updateUserDto.password) {
      updateUserDto.password = await bcrypt.hash(updateUserDto.password, 10);
    }
    
    const updatedUser = await this.userRepository.save({
      ...user,
      ...updateUserDto,
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

    for (const role of user.roles) {
      const hasPermission = await this.rolesService.hasPermission(
        user,
        this.userModuleId,
        action
      );
      if (hasPermission) {
        return true;
      }
    }

    return false;
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