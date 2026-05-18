import { BadRequestException, Controller, Get, Post, Body, Put, Param, Delete, UseGuards, UploadedFile, UseInterceptors, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiConsumes, ApiBody, } from '@nestjs/swagger';
import { DevicesService } from '../services/devices.service';
import { CreateDeviceDto } from '../dto/create-device.dto';
import { UpdateDeviceDto } from '../dto/update-device.dto';
import { DeviceResponseDto } from '../dto/device-response.dto';
import { DeviceCatalogResponseDto } from '../dto/device-catalog-response.dto';
import { DeviceListItemResponseDto } from '../dto/device-list-item-response.dto';
import { ImportDevicesResultDto } from '../dto/import-devices-result.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ApplicationPermissionsGuard } from '../../../common/application-permissions/application-permissions.guard';
import { RequireAction, RequireEntity, RequireModule } from '../../../common/application-permissions/application-permissions.decorator';
import { SessionUser } from 'src/common/decorators/session-user.decorator';
import { SessionUserDto } from 'src/modules/auth/dto/session-user.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { ImportLw001Reason } from '../import-lw001/import-lw001.constants';


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
  @HttpCode(HttpStatus.CREATED)
  @ApiResponse({ status: 201, description: 'Dispositivo creado exitosamente', type: DeviceResponseDto })
  @RequireAction('create')
  async create(@SessionUser() sessionUser: SessionUserDto, @Body() createDeviceDto: CreateDeviceDto): Promise<DeviceResponseDto> {
    createDeviceDto.idTenant = sessionUser.tenant_id;
    createDeviceDto.createdAt = new Date();
    createDeviceDto.updatedAt = new Date();
    return await this.deviceService.create(createDeviceDto);
  }

  @Get('catalog')
  @ApiOperation({ summary: 'Catálogo mínimo (id, deveui, name) para apps móviles' })
  @ApiResponse({ status: 200, description: 'Lista', type: [DeviceCatalogResponseDto] })
  @RequireAction('list')
  async catalog(@SessionUser() sessionUser: SessionUserDto): Promise<DeviceCatalogResponseDto[]> {
    return await this.deviceService.findAllCatalog(sessionUser.tenant_id);
  }

  @Get('list-summary')
  @ApiOperation({ summary: 'Listado resumido de dispositivos (sin claves)' })
  @ApiResponse({ status: 200, description: 'Lista resumida', type: [DeviceListItemResponseDto] })
  @RequireAction('list')
  async listSummary(
    @SessionUser() sessionUser: SessionUserDto,
  ): Promise<DeviceListItemResponseDto[]> {
    return await this.deviceService.findAllListSummary(sessionUser.tenant_id);
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
  async remove(@Param('id') id: string, @SessionUser() sessionUser: SessionUserDto): Promise<void> {
    return await this.deviceService.remove(id, sessionUser.tenant_id);
  }

  @Get()
  @ApiOperation({ summary: 'Obtener todos los dispositivos' })
  @ApiResponse({ status: 200, description: 'Lista de dispositivos', type: [DeviceResponseDto] })
  @RequireAction('list')
  async list(@SessionUser() sessionUser: SessionUserDto): Promise<DeviceResponseDto[]> {
    return await this.deviceService.findAll(sessionUser.tenant_id);
  }

  @Post('import')
  @RequireAction('create')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads', // asegúrate de crear esta carpeta
        filename: (req, file, cb) => {
          const randomName = Date.now() + '-' + Math.round(Math.random() * 1e9);
          cb(null, `${randomName}${extname(file.originalname)}`);
        },
      }),
      fileFilter: (req, file, cb) => {
        if (!file.originalname.match(/\.(xlsx|xls|csv)$/i)) {
          return cb(
            new BadRequestException(ImportLw001Reason.UNSUPPORTED_FILE_FORMAT),
            false,
          );
        }
        cb(null, true);
      },
    }),
  )
  @ApiOperation({
    summary: 'Importación masiva LW001-BG PRO (.xlsx, .xls, .csv)',
    description:
      'Plantilla fila 1 (orden fijo): devEui, idDeviceProfile, joineui, appKey. Solo devEui es obligatorio en archivo por fila. Si idDeviceProfile, joineui o appKey faltan en la fila, se toman del perfil resuelto: UUID en columna B si existe; si no, deviceProfileId del formulario. joineui/appKey vacíos heredan cs_joineui/cs_app_key de ese perfil. En .xlsx/.xls con varias hojas, se importan todas las que tengan datos (cabecera LW001 en fila 1 de cada hoja; hojas vacías se omiten).',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Archivo LW001 + perfil por defecto opcional',
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        deviceProfileId: {
          type: 'string',
          description:
            'UUID de perfil por defecto cuando alguna fila tiene columna idDeviceProfile vacía',
          example: '12345e8d-926c-800c-bff5-490e7f8c6051',
        },
        file: {
          description:
            'Columnas A–D: devEui, idDeviceProfile, joineui, appKey (cabeceras exactas en fila 1)',
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @HttpCode(HttpStatus.OK)
  @ApiResponse({ status: 200, description: 'Resumen de importación', type: ImportDevicesResultDto })
  async importarExcel(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { deviceProfileId?: string },
    @SessionUser() sessionUser: SessionUserDto,
  ): Promise<ImportDevicesResultDto> {
    if (!file) {
      throw new BadRequestException('file is required');
    }
    return await this.deviceService.importDevicesFromExcel(
      file,
      sessionUser.tenant_id,
      body.deviceProfileId,
    );
  }

} 