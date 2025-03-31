import { 
  Controller, 
  Post, 
  Put,
  Body, 
  Param,
  UploadedFile, 
  UseInterceptors,
  BadRequestException,
  UseGuards
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { DevicesService } from './devices.service';
import { Device } from './interfaces/device.interface';
import { JwtAuthGuard } from '../modules/auth/guards/jwt-auth.guard';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

@ApiTags('Dispositivos')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('devices')
export class DevicesController {
  constructor(private readonly devicesService: DevicesService) {}

  @Post()
  async createDevice(@Body() device: Device) {
    return await this.devicesService.createSingleDevice(device);
  }

  @Post(':deviceEUI/update')
  async updateDevice(
    @Param('deviceEUI') deviceEUI: string,
    @Body() device: Device
  ) {
    return await this.devicesService.updateDevice(deviceEUI, device);
  }

  @Post('import')
  @UseInterceptors(FileInterceptor('file'))
  async importDevices(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    const allowedMimeTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'application/octet-stream'  // Algunos sistemas envían archivos Excel con este tipo
    ];

    if (!allowedMimeTypes.includes(file.mimetype) && !file.originalname.endsWith('.xlsx')) {
      throw new BadRequestException('Invalid file type. Please upload an Excel file (.xlsx)');
    }

    return await this.devicesService.importFromExcel(file);
  }
} 