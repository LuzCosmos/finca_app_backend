import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ApplicationPermissionsGuard } from '../../../common/application-permissions/application-permissions.guard';
import {
  RequireAction,
  RequireEntity,
  RequireModule,
} from '../../../common/application-permissions/application-permissions.decorator';
import { SessionUser } from '../../../common/decorators/session-user.decorator';
import { SessionUserDto } from '../../auth/dto/session-user.dto';
import { DeviceConfigurationProfileRepository } from '../repositories/device-configuration-profile.repository';
import {
  assertSafeAndSupportedParameters,
  mergeLw001ShockAndManDownDefaults,
} from '../lw001-bg-pro/lw001-bg-pro-parameter-encoder';
import {
  CreateConfigurationProfileDto,
  UpdateConfigurationProfileDto,
} from '../dto/configuration-profile.dto';

/**
 * CRUD de perfiles de configuración remota del tenant.
 *
 * Los perfiles globales del sistema (`is_system = true`) son visibles para todos los tenants
 * pero NO se pueden editar ni eliminar. Cada tenant puede crear sus propios perfiles
 * personalizados, siempre dentro de los validadores de seguridad (rangos del PDF + bloqueo
 * de parámetros peligrosos).
 */
@ApiTags('Device Configuration Profiles')
@Controller('device-configuration-profiles')
@ApiBearerAuth('access-token')
@RequireEntity('device_configuration_profiles')
@RequireModule('PROD_CENTER')
@UseGuards(JwtAuthGuard, ApplicationPermissionsGuard)
export class DeviceConfigurationProfileController {
  constructor(private readonly profileRepo: DeviceConfigurationProfileRepository) {}

  @Get()
  @ApiOperation({ summary: 'Lista perfiles disponibles (system + tenant).' })
  @ApiResponse({ status: 200 })
  @RequireAction('list')
  async list(@SessionUser() user: SessionUserDto) {
    return this.profileRepo.findAvailableForTenant(user.tenant_id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle de un perfil.' })
  @RequireAction('read')
  async findOne(@Param('id') id: string) {
    return this.profileRepo.findById(id);
  }

  @Post()
  @ApiOperation({ summary: 'Crea un perfil personalizado del tenant.' })
  @ApiResponse({ status: 201 })
  @HttpCode(HttpStatus.CREATED)
  @RequireAction('create')
  async create(
    @Body() dto: CreateConfigurationProfileDto,
    @SessionUser() user: SessionUserDto,
  ) {
    const parameters = mergeLw001ShockAndManDownDefaults(dto.parameters);
    assertSafeAndSupportedParameters(parameters);
    return this.profileRepo.createForTenant(user.tenant_id, {
      code: dto.code,
      name: dto.name,
      description: dto.description,
      parameters,
    });
  }

  @Put(':id')
  @ApiOperation({ summary: 'Edita un perfil personalizado del tenant (no system).' })
  @RequireAction('update')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateConfigurationProfileDto,
    @SessionUser() user: SessionUserDto,
  ) {
    if (dto.parameters) {
      const parameters = mergeLw001ShockAndManDownDefaults(dto.parameters);
      assertSafeAndSupportedParameters(parameters);
      return this.profileRepo.updateForTenant(id, user.tenant_id, {
        ...dto,
        parameters,
      });
    }
    return this.profileRepo.updateForTenant(id, user.tenant_id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Elimina un perfil personalizado del tenant.' })
  @RequireAction('delete')
  async remove(@Param('id') id: string, @SessionUser() user: SessionUserDto) {
    return this.profileRepo.deleteForTenant(id, user.tenant_id);
  }
}
