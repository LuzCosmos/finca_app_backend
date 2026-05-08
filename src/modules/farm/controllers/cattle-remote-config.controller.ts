import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
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
import { CattleDeviceHistoryRepository } from '../repositories/cattle-device-history.repository';
import { DeviceRepository } from '../../production-center/repositories/device.repository';
import { DeviceRemoteConfigurationService } from '../../production-center/services/device-remote-configuration.service';
import { ApplyProfileDto } from '../../production-center/dto/apply-profile.dto';
import { ConfigureParametersDto } from '../../production-center/dto/configure-parameters.dto';
import { ReadParametersDto } from '../../production-center/dto/read-parameters.dto';
import { ReadSafeParametersChunkDto } from '../../production-center/dto/read-safe-parameters-chunk.dto';

/**
 * Endpoints de configuración remota indexados por `idCattle`.
 *
 * Internamente resuelve el `device` activo desde `cattle_device_history` y delega
 * en `DeviceRemoteConfigurationService` (mismo flujo que el controller por DevEUI).
 *
 * No hay duplicación lógica — el codec, ChirpStack, persistencia y verificación
 * estricta son idénticos.
 */
@ApiTags('Cattle Remote Configuration')
@Controller('cattle/:idCattle/remote-config')
@ApiBearerAuth('access-token')
@RequireEntity('remote_config')
@RequireModule('PROD_CENTER')
@UseGuards(JwtAuthGuard, ApplicationPermissionsGuard)
export class CattleRemoteConfigController {
  constructor(
    private readonly cattleDeviceHistoryRepo: CattleDeviceHistoryRepository,
    private readonly deviceRepo: DeviceRepository,
    private readonly remoteConfig: DeviceRemoteConfigurationService,
  ) {}

  private async resolveDeveui(idCattle: string, idTenant: string): Promise<string> {
    const assignment = await this.cattleDeviceHistoryRepo.findActiveByCattle(idTenant, idCattle);
    if (!assignment) {
      throw new NotFoundException(`Cattle ${idCattle} has no active device assignment`);
    }
    const device = await this.deviceRepo.findByIdAndTenantId(assignment.idDevice, idTenant);
    return device.deveui;
  }

  @Get()
  @ApiOperation({ summary: 'Estado actual de configuración del device asignado al ganado.' })
  @ApiResponse({ status: 200 })
  @RequireAction('read')
  async getStatus(
    @Param('idCattle') idCattle: string,
    @SessionUser() user: SessionUserDto,
  ) {
    const deveui = await this.resolveDeveui(idCattle, user.tenant_id);
    return this.remoteConfig.getStatus(deveui, user.tenant_id);
  }

  @Post('apply-profile')
  @ApiOperation({ summary: 'Aplica un perfil al device del ganado.' })
  @ApiResponse({ status: 202 })
  @HttpCode(HttpStatus.ACCEPTED)
  @RequireAction('update')
  async applyProfile(
    @Param('idCattle') idCattle: string,
    @Body() dto: ApplyProfileDto,
    @SessionUser() user: SessionUserDto,
  ) {
    const deveui = await this.resolveDeveui(idCattle, user.tenant_id);
    return this.remoteConfig.applyProfile({
      deveui,
      idTenant: user.tenant_id,
      idProfile: dto.idProfile,
      idUser: user.sub,
    });
  }

  @Post('configure')
  @ApiOperation({ summary: 'Configura parámetros sueltos en el device del ganado.' })
  @ApiResponse({ status: 202 })
  @HttpCode(HttpStatus.ACCEPTED)
  @RequireAction('update')
  async configureParameters(
    @Param('idCattle') idCattle: string,
    @Body() dto: ConfigureParametersDto,
    @SessionUser() user: SessionUserDto,
  ) {
    const deveui = await this.resolveDeveui(idCattle, user.tenant_id);
    return this.remoteConfig.configureParameters({
      deveui,
      idTenant: user.tenant_id,
      parameters: dto.parameters,
      idUser: user.sub,
    });
  }

  @Post('read')
  @ApiOperation({ summary: 'Solicita lectura de parámetros al device del ganado.' })
  @ApiResponse({ status: 202 })
  @HttpCode(HttpStatus.ACCEPTED)
  @RequireAction('update')
  async readParameters(
    @Param('idCattle') idCattle: string,
    @Body() dto: ReadParametersDto,
    @SessionUser() user: SessionUserDto,
  ) {
    const deveui = await this.resolveDeveui(idCattle, user.tenant_id);
    return this.remoteConfig.readParameters({
      deveui,
      idTenant: user.tenant_id,
      parameterNames: dto.parameterNames,
      idUser: user.sub,
    });
  }

  @Post('read-all-safe-parameters')
  @ApiOperation({
    summary:
      'Solicita lectura masiva de parámetros no peligrosos en el device asignado al ganado.',
  })
  @ApiResponse({ status: 202 })
  @HttpCode(HttpStatus.ACCEPTED)
  @RequireAction('update')
  async readAllSafeParameters(
    @Param('idCattle') idCattle: string,
    @SessionUser() user: SessionUserDto,
  ) {
    const deveui = await this.resolveDeveui(idCattle, user.tenant_id);
    return this.remoteConfig.readAllSafeParameters({
      deveui,
      idTenant: user.tenant_id,
      idUser: user.sub,
    });
  }

  @Get('read-safe-parameters-chunks')
  @ApiOperation({
    summary: 'Plan de bloques de lectura segura del device del ganado (sin encolar).',
  })
  @ApiResponse({ status: 200 })
  @RequireAction('read')
  async getReadSafeParametersChunkPlan(
    @Param('idCattle') idCattle: string,
    @SessionUser() user: SessionUserDto,
  ) {
    const deveui = await this.resolveDeveui(idCattle, user.tenant_id);
    return this.remoteConfig.getReadSafeParametersChunkPlan(deveui, user.tenant_id);
  }

  @Post('read-safe-parameters-chunk')
  @ApiOperation({ summary: 'Encola un solo Read seguro por bloque en el device del ganado.' })
  @ApiResponse({ status: 202 })
  @HttpCode(HttpStatus.ACCEPTED)
  @RequireAction('update')
  async readSafeParametersChunk(
    @Param('idCattle') idCattle: string,
    @Body() dto: ReadSafeParametersChunkDto,
    @SessionUser() user: SessionUserDto,
  ) {
    const deveui = await this.resolveDeveui(idCattle, user.tenant_id);
    return this.remoteConfig.readSafeParametersChunk({
      deveui,
      idTenant: user.tenant_id,
      idUser: user.sub,
      chunkIndex: dto.chunkIndex,
    });
  }

  @Post('control/request-position')
  @ApiOperation({ summary: 'Pide posición inmediata al device del ganado.' })
  @ApiResponse({ status: 202 })
  @HttpCode(HttpStatus.ACCEPTED)
  @RequireAction('update')
  async requestPosition(
    @Param('idCattle') idCattle: string,
    @SessionUser() user: SessionUserDto,
  ) {
    const deveui = await this.resolveDeveui(idCattle, user.tenant_id);
    return this.remoteConfig.requestPosition({
      deveui,
      idTenant: user.tenant_id,
      idUser: user.sub,
    });
  }

  @Post('control/clear-man-down')
  @ApiOperation({ summary: 'Limpia man-down del device del ganado.' })
  @ApiResponse({ status: 202 })
  @HttpCode(HttpStatus.ACCEPTED)
  @RequireAction('update')
  async clearManDown(
    @Param('idCattle') idCattle: string,
    @SessionUser() user: SessionUserDto,
  ) {
    const deveui = await this.resolveDeveui(idCattle, user.tenant_id);
    return this.remoteConfig.clearManDown({
      deveui,
      idTenant: user.tenant_id,
      idUser: user.sub,
    });
  }

  @Post('positioning/lorawan-only')
  @ApiOperation({
    summary:
      'Apaga GPS / WiFi / BT en el device del ganado (posición vía LoRaWAN/TDOA).',
    description:
      'Encola un único Configure (port 10) con las 6 position-strategy del PDF MOKO en 0x00.',
  })
  @ApiResponse({ status: 202 })
  @HttpCode(HttpStatus.ACCEPTED)
  @RequireAction('update')
  async setLorawanOnlyPositioning(
    @Param('idCattle') idCattle: string,
    @SessionUser() user: SessionUserDto,
  ) {
    const deveui = await this.resolveDeveui(idCattle, user.tenant_id);
    return this.remoteConfig.setLorawanOnlyPositioning({
      deveui,
      idTenant: user.tenant_id,
      idUser: user.sub,
    });
  }

  @Post('diagnostic-mode/enable')
  @ApiOperation({
    summary:
      'Activa el modo diagnóstico en el device del ganado (silencia auxiliares y baja heartbeat a 300 s).',
  })
  @ApiResponse({ status: 202 })
  @HttpCode(HttpStatus.ACCEPTED)
  @RequireAction('update')
  async enableDiagnosticMode(
    @Param('idCattle') idCattle: string,
    @Body() dto: { ttlMinutes?: number } | undefined,
    @SessionUser() user: SessionUserDto,
  ) {
    const deveui = await this.resolveDeveui(idCattle, user.tenant_id);
    return this.remoteConfig.enableDiagnosticMode({
      deveui,
      idTenant: user.tenant_id,
      idUser: user.sub,
      ttlMinutes: dto?.ttlMinutes,
    });
  }

  @Post('diagnostic-mode/disable')
  @ApiOperation({ summary: 'Desactiva el modo diagnóstico del device del ganado.' })
  @ApiResponse({ status: 202 })
  @HttpCode(HttpStatus.ACCEPTED)
  @RequireAction('update')
  async disableDiagnosticMode(
    @Param('idCattle') idCattle: string,
    @SessionUser() user: SessionUserDto,
  ) {
    const deveui = await this.resolveDeveui(idCattle, user.tenant_id);
    return this.remoteConfig.disableDiagnosticMode({
      deveui,
      idTenant: user.tenant_id,
      idUser: user.sub,
      triggeredBy: 'user',
    });
  }
}
