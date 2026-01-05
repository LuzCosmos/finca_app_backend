import { Injectable, NotFoundException, ConflictException, ForbiddenException, UnauthorizedException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere, EntityManager } from 'typeorm';
import { plainToInstance } from 'class-transformer';
import * as bcrypt from 'bcrypt';
import { CreateUserDto } from '../dto/create-user.dto';
import { User } from '../entities/user.entity';
import { Role } from '../entities/role.entity';
import { RoleService } from './roles.service';
import { UpdateUserDto } from '../dto/update-user.dto';
import { UserResponseDto } from '../dto/user-response.dto';
import { UserRepository } from '../repositories/user.repository';
import { SessionUserDto } from 'src/modules/auth/dto/session-user.dto';
import { ApplicationPermissionsService } from '../../../common/application-permissions/application-permissions.service';

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
  private readonly logger = new Logger(UsersService.name);
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly userCustomRepository: UserRepository,
    @InjectRepository(Role)
    private readonly rolesRepository: Repository<Role>,
    private readonly rolesService: RoleService,
    private readonly applicationPermissionsService: ApplicationPermissionsService
  ) { }

  /**
   * Create a new user
   * @param createUserDto - The DTO of the user to create
   * @returns The user created
   */
  async create(createUserDto: CreateUserDto): Promise<UserResponseDto> {
    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);
    const savedUser = await this.userCustomRepository.createUserWithRoles(createUserDto, hashedPassword);
    return plainToInstance(UserResponseDto, savedUser);
  }

  /**
   * Find a user by its ID
   * @param id - The ID of the user
   * @param sessionUser - The session user
   * @returns The user found
   */
  async findOne(id: string, sessionUser: SessionUserDto): Promise<UserResponseDto> {
    const user = await this.userRepository.findOne({
      where: {
        id,
        tenantId: sessionUser.tenant_id
      },
      relations: ['roles']
    });
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    return plainToInstance(UserResponseDto, user);
  }

  /**
   * Update a user
   * @param id - The ID of the user
   * @param updateUserDto - The DTO of the user to update
   * @param sessionUser - The session user
   * @returns The user updated
   */
  async update(id: string, updateUserDto: UpdateUserDto, sessionUser: SessionUserDto): Promise<UserResponseDto> {
    const user = await this.userCustomRepository.findById(id);
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    // Verificar permisos
    const isOwnUser = sessionUser.sub === id;
    if (!isOwnUser && sessionUser.tenant_id !== user.tenantId) {
      throw new ForbiddenException('No tienes permisos para modificar este usuario');
    }
    // Verificar si el username ya existe
    if (updateUserDto.username && updateUserDto.username !== user.username) {
      const existingUser = await this.userCustomRepository.findByUsernameAndTenant(updateUserDto.username, sessionUser.tenant_id);
      if (existingUser) {
        throw new ConflictException('El nombre de usuario ya está en uso');
      }
    }
    // Nunca permitir cambiar el tenant
    if (updateUserDto.tenantId) {
      throw new ForbiddenException('No se permite modificar el tenant de un usuario');
    }
    // Hashear la contraseña si se proporciona
    let hashedPassword: string | undefined;
    if (updateUserDto.password) {
      hashedPassword = await this.getHashedPassword(updateUserDto.password);
      delete updateUserDto.password; // Eliminar la contraseña en texto plano
    }
    // Actualizar el usuario con transacción
    const updatedUser = await this.userCustomRepository.UpdateUserWithRoles(
      user,
      updateUserDto,
      hashedPassword
    );
    return plainToInstance(UserResponseDto, updatedUser);
  }

  /**
   * Remove a user
   * @param id - The ID of the user
   * @param sessionUser - The session user
   * @returns The user removed
   */
  async remove(id: string, sessionUser: SessionUserDto): Promise<void> {
    const user = await this.userCustomRepository.findById(id);
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    // Verificar si es el propio usuario o tiene permisos de eliminación
    const isOwnUser = sessionUser.sub === id;
    if (!isOwnUser) {
      if (sessionUser.tenant_id !== user.tenantId) {
        throw new ForbiddenException('No tienes permisos para eliminar este usuario');
      }
    }
    // Eliminar el usuario y sus roles en una transacción
    const deleted = await this.userCustomRepository.deleteUserWithRoles(id);
    if (!deleted) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
  }

  /**
   * Find all users by their tenantId
   * @param tenantId - The ID of the tenant
   * @returns The users found
   */
  async findByTenant(tenantId: string): Promise<User[]> {
    const users = await this.userRepository.find({
      where: { tenantId: tenantId },
      relations: ['roles']
    });
    return users;
  }

  /**
   * Find all users by their tenantId
   * @param tenantId - The ID of the tenant
   * @returns The users found
   */
  async findAll(tenantId: string): Promise<User[]> {
    // Obtener usuarios solo del tenant actual
    return this.userCustomRepository.find({
      where: { tenantId: tenantId },
      relations: ['roles', 'roles.permissions', 'roles.permissions.module']
    });
  }

  /**
   * Find a user by its username and password and company_username
   * @param username - The username of the user
   * @param password - The password of the user
   * @param company_username - The company_username of the user
   * @returns The user found
   */
  async findByUsernameAndPasswordAndCompanyUsername(username: string, password: string, company_username: string): Promise<User | null> {
    try {
      const user_db = await this.userCustomRepository.findByUsernameAndCompanyUsername(username, company_username);
      if (!user_db) {
        throw new UnauthorizedException('Credenciales inválidas');
        return null;
      }
      var user: User | null = null;
      const isPasswordValid = await bcrypt.compare(password, user_db.password);
      if (!isPasswordValid) {
        throw new UnauthorizedException('Credenciales inválidas');
      }
      user = plainToInstance(User, user_db);
      return user;
    } catch (error) {
      this.logger.error('Error en findByUsernameAndPasswordAndCompanyUsername:', error);
      throw error;
    }
  }

  /**
   * Get the hashed password
   * @param password - The password of the user
   * @returns The hashed password
   */
  getHashedPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 10);
  }

  /**
   * Find a user by its username and tenantId
   * @param username - The username of the user
   * @param tenantId - The ID of the tenant
   * @returns The user found
   */
  async findByUsername(username: string, tenantId: string): Promise<User | undefined> {
    const user = await this.userRepository.findOne({
      where: { username, tenantId: tenantId },
      relations: ['roles', 'tenant']
    });
    return user || undefined;
  }

  /**
   * Validate a user
   * @param username - The username of the user
   * @param password - The password of the user
   * @param tenantId - The ID of the tenant
   * @returns The user found
   */
  async validateUser(username: string, password: string, tenantId: string): Promise<UserResponseDto | undefined> {
    const user = await this.findByUsername(username, tenantId);
    if (user && await bcrypt.compare(password, user.password)) {
      return plainToInstance(UserResponseDto, user);
    }
    return undefined;
  }

  /**
   * Create an admin user
   * @param dto - The DTO of the user to create
   * @returns The user created
   */
  async createAdminUser(dto: CreateAdminUserDto, manager?: EntityManager): Promise<UserResponseDto> {
    const userRepository = manager ? manager.getRepository(User) : this.userRepository;
    const where: FindOptionsWhere<User>[] = [
      { username: dto.username, tenantId: dto.tenantId },
      { email: dto.email, tenantId: dto.tenantId }
    ];

    const existingUser = await userRepository.findOne({ where });

    if (existingUser) {
      throw new ConflictException('Ya existe un usuario con ese username o email en este tenant');
    }

    const adminRole = await this.rolesService.findByCode('SYS_ADMIN');
    if (!adminRole) {
      throw new NotFoundException('Admin role not found');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    const user = userRepository.create({
      username: dto.username,
      password: hashedPassword,
      email: dto.email,
      firstName: dto.firstName,
      lastName: dto.lastName,
      tenantId: dto.tenantId,
      roles: [adminRole]
    });
    const savedUser = await userRepository.save(user);
    return plainToInstance(UserResponseDto, savedUser);
  }
} 