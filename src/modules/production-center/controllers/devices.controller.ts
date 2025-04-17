import { Controller, Get, Post, Body, Put, Param, Delete, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { DevicesService } from '../services/devices.service';
import { CreateDeviceDto } from '../dto/create-device.dto';
import { UpdateDeviceDto } from '../dto/update-device.dto';
import { DeviceResponseDto } from '../dto/device-response.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ApplicationPermissionsGuard } from 'src/modules/auth/application-permissions/application-permissions.guard';
import { RequireAction, RequireEntity, RequireModule } from 'src/modules/auth/application-permissions/application-permissions.decorator';
import { SessionUser } from 'src/modules/auth/decorators/session-user.decorator';
import { SessionUserDto } from 'src/modules/auth/dto/session-user.dto';

@ApiTags('Devices')
@Controller('devices')
@ApiBearerAuth('access-token')
@RequireEntity('devices')
@RequireModule('PROD_CENTER')
@UseGuards(JwtAuthGuard,ApplicationPermissionsGuard)
export class DevicesController {
  constructor(private readonly deviceService: DevicesService) {}

  @Post()
  @ApiOperation({ summary: 'Crear un nuevo dispositivo' })
  @ApiResponse({ status: 201, description: 'Dispositivo creado exitosamente', type: DeviceResponseDto })
  @RequireAction('create')
  async create(@SessionUser() sessionUser: SessionUserDto, @Body() createDeviceDto: CreateDeviceDto): Promise<DeviceResponseDto> {
    createDeviceDto.idTenant = sessionUser.tenant_id;
    createDeviceDto.createdAt = new Date();
    createDeviceDto.updatedAt = new Date();
    return await this.deviceService.create(createDeviceDto);
  }

  @Get(':deveui')
  @ApiOperation({ summary: 'Obtener un dispositivo por ID' })
  @ApiResponse({ status: 200, description: 'Dispositivo encontrado', type: DeviceResponseDto })
  @RequireAction('read')
  async findOne(@Param('deveui') deveui: string, @SessionUser() sessionUser: SessionUserDto): Promise<DeviceResponseDto> {
    return await this.deviceService.findOne(deveui, sessionUser.tenant_id);
  }

  @Put(':deveui')
  @ApiOperation({ summary: 'Actualizar un dispositivo' })
  @ApiResponse({ status: 200, description: 'Dispositivo actualizado', type: DeviceResponseDto })
  @RequireAction('update')
  async update(@Param('deveui') deveui: string, @SessionUser() sessionUser: SessionUserDto, @Body() updateDeviceDto: UpdateDeviceDto): Promise<DeviceResponseDto> {
    updateDeviceDto.updatedAt = new Date();
    return await this.deviceService.update(deveui, sessionUser.tenant_id, updateDeviceDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar un dispositivo' })
  @ApiResponse({ status: 200, description: 'Dispositivo eliminado' })
  @RequireAction('delete')
  async remove(@Param('id') id: string): Promise<void> {
    return await this.deviceService.remove(id);
  }

  @Get()
  @ApiOperation({ summary: 'Obtener todos los dispositivos' })
  @ApiResponse({ status: 200, description: 'Lista de dispositivos', type: [DeviceResponseDto] })
  @RequireAction('list')
  async list(@SessionUser() sessionUser: SessionUserDto): Promise<DeviceResponseDto[]> {
    return await this.deviceService.findAll(sessionUser.tenant_id);
  }
} 