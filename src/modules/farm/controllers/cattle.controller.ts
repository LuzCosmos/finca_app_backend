import { Controller, Get, Post, Put, Delete, Param, Body, UploadedFile, UseInterceptors } from '@nestjs/common';
import { CattleService } from '../services/cattle.service';
import { CreateCattleDto } from '../dto/create-cattle.dto';
import { UpdateCattleDto } from '../dto/update-cattle.dto';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { RequireEntity, RequireModule, RequireAction } from 'src/modules/auth/application-permissions/application-permissions.decorator';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { ApplicationPermissionsGuard } from 'src/modules/auth/application-permissions/application-permissions.guard';
import { UseGuards } from '@nestjs/common';
import { CattleResponseDto } from '../dto/cattle-response.dto';
import { SessionUser } from 'src/modules/auth/decorators/session-user.decorator';
import { SessionUserDto } from 'src/modules/auth/dto/session-user.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';

@ApiTags('Cattle')
@ApiBearerAuth('access-token')
@Controller('cattle')
@RequireEntity('cattles')
@RequireModule('FARM')
@UseGuards(JwtAuthGuard, ApplicationPermissionsGuard)
export class CattleController {
  constructor(private readonly cattleService: CattleService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new cattle' })
  @ApiResponse({ status: 201, description: 'Cattle created successfully', type: CattleResponseDto })
  @RequireAction('create')
  @ApiBody({ type: CreateCattleDto, required: true, examples:{
    example1: {
      summary: 'Mandatory fields',
      value: {
        sysNumber: '1234567890',
        number: '1234567890',
        receivedAt: '2021-01-01',
        receivedWeight: 100,
        purchaseFrom: 'Lugar de compra',
        purchasePrice: 100,
        purchaseWeight: 100
      },
    },
    example2: {
      summary: 'Create a new cattle with all fields',
      value: {
        deveui: 'string',
        sysNumber: 'string',
        number: 'string',
        brand: 'string',
        colorMain: 'string',
        colorDescription: 'string',
        colorFeature: 'string',
        lot: 'string',
        receivedAt: 'string',
        receivedWeight: 0,
        purchaseWeight: 0,
        comments: 'string',
        purchasedFrom: 'string',
        purchasePrice: 0,
        purchaseCommission: 0,
        negotiatedPricePerKg: 0,
        lotPricePerWeight: 0,
      },
    },
  } })
  create(@SessionUser() sessionUser: SessionUserDto, @Body() dto: CreateCattleDto) {
    return this.cattleService.create(sessionUser.tenant_id, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a cattle by ID' })
  @ApiResponse({ status: 200, description: 'Cattle found', type: CattleResponseDto })
  @RequireAction('read')
  findOne(@Param('id') id: string, @SessionUser() sessionUser: SessionUserDto) {
    return this.cattleService.findOne(sessionUser.tenant_id, id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a cattle' })
  @ApiResponse({ status: 200, description: 'Cattle updated', type: CattleResponseDto })
  @RequireAction('update')
  update(@Param('id') id: string, @SessionUser() sessionUser: SessionUserDto, @Body() dto: UpdateCattleDto) {
    return this.cattleService.update(sessionUser.tenant_id, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a cattle' })
  @ApiResponse({ status: 200, description: 'Cattle deleted successfully' })
  @RequireAction('delete')
  remove(@Param('id') id: string, @SessionUser() sessionUser: SessionUserDto) {
    return this.cattleService.remove(sessionUser.tenant_id, id);
  }

  @Get()
  @ApiOperation({ summary: 'List all cattle' })
  @ApiResponse({ status: 200, description: 'List of cattle', type: [CattleResponseDto] })
  @RequireAction('read')
  list(@SessionUser() sessionUser: SessionUserDto) {
    return this.cattleService.list(sessionUser.tenant_id);
  }

  @Post('import')
  @ApiOperation({ summary: 'Import cattle from an Excel file' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', required: ['file'], properties: { file: { type: 'string', format: 'binary' } } } })
  @RequireAction('create')
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: './uploads',
      filename: (req, file, cb) => {
        const randomName = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, `${randomName}${extname(file.originalname)}`);
      },
    }),
    fileFilter: (req, file, cb) => {
      if (!file.originalname.match(/\.(xlsx|xls)$/)) {
        return cb(new Error('Only Excel files (.xlsx, .xls) are allowed'), false);
      }
      cb(null, true);
    },
  }))
  import(@SessionUser() sessionUser: SessionUserDto, @UploadedFile() file: Express.Multer.File) {
    return this.cattleService.import(file, sessionUser.tenant_id);
  }
}