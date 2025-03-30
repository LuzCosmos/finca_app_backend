import { Injectable, NotFoundException, ConflictException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { CreateUserDto } from '../dto/create-user.dto';
import { User } from '../entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>
  ) {}

  async create(createUserDto: CreateUserDto): Promise<User> {
    try {
      const hashedPassword = await bcrypt.hash(createUserDto.pass_word, 10);
      const user = this.usersRepository.create({
        ...createUserDto,
        pass_word: hashedPassword,
      });
      
      const savedUser = await this.usersRepository.save(user);
      const userWithoutPassword = await this.findOne(savedUser.id);
      return userWithoutPassword;
    } catch (error) {
      if (error.code === '23505') {
        throw new ConflictException('El nombre de usuario ya existe para este tenant');
      }
      throw error;
    }
  }

  async findAll(): Promise<User[]> {
    return this.usersRepository.find({
      relations: ['tenant', 'role'],
    });
  }

  async findByTenant(tenantId: string): Promise<User[]> {
    return this.usersRepository.find({
      where: { id_tenant: tenantId },
      relations: ['tenant', 'role'],
    });
  }

  async findOne(id: string): Promise<User> {
    const user = await this.usersRepository.findOne({
      where: { id },
      relations: ['tenant', 'role'],
    });

    if (!user) {
      throw new NotFoundException(`Usuario con ID ${id} no encontrado`);
    }

    return user;
  }

  async update(id: string, updateUserDto: Partial<CreateUserDto>): Promise<User> {
    try {
      const user = await this.usersRepository.findOne({
        where: { id },
        select: ['id', 'pass_word'],
      });

      if (!user) {
        throw new NotFoundException(`Usuario con ID ${id} no encontrado`);
      }

      if (updateUserDto.pass_word) {
        updateUserDto.pass_word = await bcrypt.hash(updateUserDto.pass_word, 10);
      }

      await this.usersRepository.save({ ...user, ...updateUserDto });
      return this.findOne(id);
    } catch (error) {
      if (error.code === '23505') {
        throw new ConflictException('El nombre de usuario ya existe para este tenant');
      }
      throw error;
    }
  }

  async remove(id: string): Promise<void> {
    const result = await this.usersRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Usuario con ID ${id} no encontrado`);
    }
  }

  async validateUser(username: string, tenantId: string, password: string): Promise<User | null> {
    const user = await this.usersRepository.findOne({
      where: { username, id_tenant: tenantId },
      select: ['id', 'id_tenant', 'username', 'id_role', 'first_name', 'last_name', 'email', 'pass_word'],
    });

    if (!user) {
      return null;
    }

    const isPasswordValid = await bcrypt.compare(password, user.pass_word);
    if (!isPasswordValid) {
      return null;
    }

    return this.findOne(user.id);
  }
} 