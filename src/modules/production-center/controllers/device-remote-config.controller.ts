import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
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
import { DeviceRemoteConfigurationService } from '../services/device-remote-configuration.service';
import { DeviceDownlinkCommandRepository } from '../repositories/device-downlink-command.repository';
import { DeviceRepository } from '../repositories/device.repository';
import { ApplyProfileDto } from '../dto/apply-profile.dto';
import { ConfigureParametersDto } from '../dto/configure-parameters.dto';
import { ReadParametersDto } from '../dto/read-parameters.dto';
import { ReadSafeParametersChunkDto } from '../dto/read-safe-parameters-chunk.dto';
import { LocalStorageCommandDto } from '../dto/local-storage-command.dto';

/**
 * Endpoints REST para configuración remota de dispositivos MOKO LW001-BG PRO.
 *
 * Identificador en URL: `:deveui` (LoRaWAN, 16 hex), por consistencia con GET/PUT existentes.
 *
 * Comandos peligrosos (Factory Reset, cambios de DEVEUI/APPKEY/APPSKEY/NWKSKEY/region/CH/DR/
 * duty-cycle/login password/LoRaWAN mode) NO están expuestos. Solo lectura admin de algunos.
 */
@ApiTags('Device Remote Configuration')
@Controller('devices/:deveui/remote-config')
@ApiBearerAuth('access-token')
@RequireEntity('remote_config')
@RequireModule('PROD_CENTER')
@UseGuards(JwtAuthGuard, ApplicationPermissionsGuard)
export class DeviceRemoteConfigController {
  constructor(
    private readonly remoteConfig: DeviceRemoteConfigurationService,
    private readonly downlinkRepo: DeviceDownlinkCommandRepository,
    private readonly deviceRepo: DeviceRepository,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Estado actual de configuración remota del device.' })
  @ApiResponse({ status: 200 })
  @RequireAction('read')
  async getStatus(
    @Param('deveui') deveui: string,
    @SessionUser() user: SessionUserDto,
  ) {
    return this.remoteConfig.getStatus(deveui, user.tenant_id);
  }

  @Post('apply-profile')
  @ApiOperation({ summary: 'Aplica un perfil de configuración (system o tenant).' })
  @ApiResponse({ status: 202 })
  @HttpCode(HttpStatus.ACCEPTED)
  @RequireAction('update')
  async applyProfile(
    @Param('deveui') deveui: string,
    @Body() dto: ApplyProfileDto,
    @SessionUser() user: SessionUserDto,
  ) {
    return this.remoteConfig.applyProfile({
      deveui,
      idTenant: user.tenant_id,
      idProfile: dto.idProfile,
      idUser: user.sub,
    });
  }

  @Post('configure')
  @ApiOperation({ summary: 'Configura uno o varios parámetros sueltos (verificación estricta).' })
  @ApiResponse({ status: 202 })
  @HttpCode(HttpStatus.ACCEPTED)
  @RequireAction('update')
  async configureParameters(
    @Param('deveui') deveui: string,
    @Body() dto: ConfigureParametersDto,
    @SessionUser() user: SessionUserDto,
  ) {
    return this.remoteConfig.configureParameters({
      deveui,
      idTenant: user.tenant_id,
      parameters: dto.parameters,
      idUser: user.sub,
    });
  }

  @Post('read')
  @ApiOperation({ summary: 'Solicita al device que reporte los parámetros indicados.' })
  @ApiResponse({ status: 202 })
  @HttpCode(HttpStatus.ACCEPTED)
  @RequireAction('update')
  async readParameters(
    @Param('deveui') deveui: string,
    @Body() dto: ReadParametersDto,
    @SessionUser() user: SessionUserDto,
  ) {
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
      'Solicita lectura de todos los parámetros del PDF no peligrosos (varias tramas Read si hace falta).',
  })
  @ApiResponse({ status: 202 })
  @HttpCode(HttpStatus.ACCEPTED)
  @RequireAction('update')
  async readAllSafeParameters(
    @Param('deveui') deveui: string,
    @SessionUser() user: SessionUserDto,
  ) {
    return this.remoteConfig.readAllSafeParameters({
      deveui,
      idTenant: user.tenant_id,
      idUser: user.sub,
    });
  }

  @Get('read-safe-parameters-chunks')
  @ApiOperation({
    summary:
      'Plan de bloques para lectura segura (misma partición que read-all-safe-parameters), sin encolar.',
    description:
      'Devuelve `totalChunks` y por cada bloque los `parameterIds` y `parameterNames`. ' +
      'La app puede mostrar un botón por bloque y llamar POST …/read-safe-parameters-chunk con `chunkIndex`.',
  })
  @ApiResponse({ status: 200 })
  @RequireAction('read')
  async getReadSafeParametersChunkPlan(
    @Param('deveui') deveui: string,
    @SessionUser() user: SessionUserDto,
  ) {
    return this.remoteConfig.getReadSafeParametersChunkPlan(deveui, user.tenant_id);
  }

  @Post('read-safe-parameters-chunk')
  @ApiOperation({
    summary: 'Encola un solo Read con un bloque seguro (por índice 0-based).',
    description:
      'Alternativa a read-all-safe-parameters cuando conviene espaciar downlinks en el aire ' +
      'o el firmware del device no tolera encolar todos los bloques a la vez.',
  })
  @ApiResponse({ status: 202 })
  @HttpCode(HttpStatus.ACCEPTED)
  @RequireAction('update')
  async readSafeParametersChunk(
    @Param('deveui') deveui: string,
    @Body() dto: ReadSafeParametersChunkDto,
    @SessionUser() user: SessionUserDto,
  ) {
    return this.remoteConfig.readSafeParametersChunk({
      deveui,
      idTenant: user.tenant_id,
      idUser: user.sub,
      chunkIndex: dto.chunkIndex,
    });
  }

  @Post('control/request-position')
  @ApiOperation({ summary: 'Pide posición inmediata al device (Downlink for Position).' })
  @ApiResponse({ status: 202 })
  @HttpCode(HttpStatus.ACCEPTED)
  @RequireAction('update')
  async requestPosition(
    @Param('deveui') deveui: string,
    @SessionUser() user: SessionUserDto,
  ) {
    return this.remoteConfig.requestPosition({
      deveui,
      idTenant: user.tenant_id,
      idUser: user.sub,
    });
  }

  @Post('control/request-battery')
  @ApiOperation({ summary: 'Solicita reporte de consumo de batería.' })
  @ApiResponse({ status: 202 })
  @HttpCode(HttpStatus.ACCEPTED)
  @RequireAction('update')
  async requestBattery(
    @Param('deveui') deveui: string,
    @SessionUser() user: SessionUserDto,
  ) {
    return this.remoteConfig.requestBatteryConsumption({
      deveui,
      idTenant: user.tenant_id,
      idUser: user.sub,
    });
  }

  @Post('control/clear-man-down')
  @ApiOperation({ summary: 'Limpia el estado man-down del device.' })
  @ApiResponse({ status: 202 })
  @HttpCode(HttpStatus.ACCEPTED)
  @RequireAction('update')
  async clearManDown(
    @Param('deveui') deveui: string,
    @SessionUser() user: SessionUserDto,
  ) {
    return this.remoteConfig.clearManDown({
      deveui,
      idTenant: user.tenant_id,
      idUser: user.sub,
    });
  }

  @Post('control/reboot')
  @ApiOperation({ summary: 'Reinicia el device.' })
  @ApiResponse({ status: 202 })
  @HttpCode(HttpStatus.ACCEPTED)
  @RequireAction('update')
  async reboot(@Param('deveui') deveui: string, @SessionUser() user: SessionUserDto) {
    return this.remoteConfig.rebootDevice({
      deveui,
      idTenant: user.tenant_id,
      idUser: user.sub,
    });
  }

  @Post('control/enable-bluetooth')
  @ApiOperation({ summary: 'Activa transmisión BLE (configuración local con la app oficial).' })
  @ApiResponse({ status: 202 })
  @HttpCode(HttpStatus.ACCEPTED)
  @RequireAction('update')
  async enableBluetooth(
    @Param('deveui') deveui: string,
    @SessionUser() user: SessionUserDto,
  ) {
    return this.remoteConfig.enableBluetooth({
      deveui,
      idTenant: user.tenant_id,
      idUser: user.sub,
    });
  }

  @Post('positioning/lorawan-only')
  @ApiOperation({
    summary:
      'Apaga GPS / WiFi / BT en el collar y deja la posición a cargo del LNS (TDOA/RSSI).',
    description:
      'Encola un único Configure (port 10) con las 6 position-strategy del PDF MOKO en 0x00. ' +
      'Reduce consumo de batería y tráfico LoRaWAN. Para revertir, configurar las strategies ' +
      'deseadas vía POST /remote-config/configure.',
  })
  @ApiResponse({ status: 202 })
  @HttpCode(HttpStatus.ACCEPTED)
  @RequireAction('update')
  async setLorawanOnlyPositioning(
    @Param('deveui') deveui: string,
    @SessionUser() user: SessionUserDto,
  ) {
    return this.remoteConfig.setLorawanOnlyPositioning({
      deveui,
      idTenant: user.tenant_id,
      idUser: user.sub,
    });
  }

  @Post('diagnostic-mode/enable')
  @ApiOperation({
    summary:
      'Activa el modo diagnóstico (silencia shock/man-down/tamper y baja heartbeat a 300 s).',
    description:
      'Pensado para soporte técnico: facilita observar uplinks Port 1 limpios mientras se ' +
      'diagnostica un device. Se auto-restaura tras `ttlMinutes` (default 30). ' +
      'Idempotente: una segunda llamada solo extiende el TTL sin pisar el snapshot original.',
  })
  @ApiResponse({ status: 202 })
  @HttpCode(HttpStatus.ACCEPTED)
  @RequireAction('update')
  async enableDiagnosticMode(
    @Param('deveui') deveui: string,
    @Body() dto: { ttlMinutes?: number } | undefined,
    @SessionUser() user: SessionUserDto,
  ) {
    return this.remoteConfig.enableDiagnosticMode({
      deveui,
      idTenant: user.tenant_id,
      idUser: user.sub,
      ttlMinutes: dto?.ttlMinutes,
    });
  }

  @Post('diagnostic-mode/disable')
  @ApiOperation({
    summary: 'Desactiva el modo diagnóstico restaurando los parámetros previos.',
  })
  @ApiResponse({ status: 202 })
  @HttpCode(HttpStatus.ACCEPTED)
  @RequireAction('update')
  async disableDiagnosticMode(
    @Param('deveui') deveui: string,
    @SessionUser() user: SessionUserDto,
  ) {
    return this.remoteConfig.disableDiagnosticMode({
      deveui,
      idTenant: user.tenant_id,
      idUser: user.sub,
      triggeredBy: 'user',
    });
  }

  @Post('local-storage')
  @ApiOperation({ summary: 'Local Storage Data Command (port 11): upload/clear/pause/resume.' })
  @ApiResponse({ status: 202 })
  @HttpCode(HttpStatus.ACCEPTED)
  @RequireAction('update')
  async localStorage(
    @Param('deveui') deveui: string,
    @Body() dto: LocalStorageCommandDto,
    @SessionUser() user: SessionUserDto,
  ) {
    const command =
      dto.action === 'upload'
        ? { action: 'upload' as const, lastDays: dto.lastDays ?? 0xffff }
        : { action: dto.action };
    return this.remoteConfig.localStorageCommand({
      deveui,
      idTenant: user.tenant_id,
      command,
      idUser: user.sub,
    });
  }

  @Get('commands')
  @ApiOperation({ summary: 'Historial de downlinks del device, paginado.' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, type: String })
  @RequireAction('read')
  async commandHistory(
    @Param('deveui') deveui: string,
    @SessionUser() user: SessionUserDto,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('status') status?: string,
  ) {
    const device = await this.deviceRepo.findByDevEuiAndTenantId(deveui, user.tenant_id);
    return this.downlinkRepo.listForDevice(device.id, user.tenant_id, {
      limit: limit ? Number(limit) : 50,
      offset: offset ? Number(offset) : 0,
      status: status as never,
    });
  }
}
