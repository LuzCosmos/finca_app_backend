import { Controller, Get, Post, Put, Delete, Param, Body, UploadedFile, UseInterceptors } from '@nestjs/common';
import { CattleService } from '../services/cattle.service';
import { CreateCattleDto } from '../dto/create-cattle.dto';
import { UpdateCattleDto } from '../dto/update-cattle.dto';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { RequireEntity, RequireModule, RequireAction } from 'src/common/application-permissions/application-permissions.decorator';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { ApplicationPermissionsGuard } from 'src/common/application-permissions/application-permissions.guard';
import { UseGuards } from '@nestjs/common';
import { CattleResponseDto } from '../dto/cattle-response.dto';
import { SessionUser } from 'src/common/decorators/session-user.decorator';
import { SessionUserDto } from 'src/modules/auth/dto/session-user.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { ApplySimpleEventsDto } from 'src/modules/massive-events/dto/apply-simple-events.dto';
import { AnimalSimpleEventRepository } from 'src/modules/massive-events/repositories/animal-simple-event.repository';
import { SyncAnimalSimpleEventRequestDto, SyncAnimalSimpleEventResponseDto } from 'src/modules/massive-events/dto/sync-animal-simple-event.dto';

@ApiTags('Cattle')
@ApiBearerAuth('access-token')
@Controller('cattle')
@RequireEntity('cattles')
@RequireModule('FARM')
@UseGuards(JwtAuthGuard, ApplicationPermissionsGuard)
export class CattleController {
  constructor(
    private readonly cattleService: CattleService,
    private readonly simpleEventCattleRepository: AnimalSimpleEventRepository,
  ) {}

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

  @Get(':id/simple-events')
  @ApiOperation({ summary: 'List all simple events applied to a cattle' })
  @ApiResponse({ status: 200, description: 'List of simple events IDs' })
  @RequireAction('read')
  async findSimpleEventsByCattle(@Param('id') id: string, @SessionUser() sessionUser: SessionUserDto) {
    const links = await this.simpleEventCattleRepository.findByCattle(sessionUser.tenant_id, id);
    return links.map(link => ({
      idSimpleEvent: link.idSimpleEvent,
      appliedAt: link.appliedAt,
      appliedBy: link.appliedBy,
    }));
  }


  @Post('apply-simple-events')
  @ApiOperation({ summary: 'Apply multiple simple events to cattle by their number' })
  @ApiResponse({ status: 200, description: 'Events applied successfully', type: [CattleResponseDto] })
  @RequireAction('update')
  @ApiBody({
    type: ApplySimpleEventsDto,
    examples: {
      example1: {
        summary: 'Apply various events',
        value: {
          events: [
            {
              cattleNumber: 'C-001',
              type: 'weight',
              data: { weight: 350 },
              recordedInMassiveEvent: 'uuid-simple-event-1'
            },
            {
              cattleNumber: 'C-002',
              type: 'eartag',
              data: { eartagNumber: 'ET-789' },
              recordedInMassiveEvent: 'uuid-simple-event-2'
            }
          ]
        }
      }
    }
  })
  async applySimpleEventsToCattle(
    @SessionUser() sessionUser: SessionUserDto,
    @Body() body: ApplySimpleEventsDto
  ) {
    return this.cattleService.applyBulkSimpleEvents(sessionUser.tenant_id, body.events, sessionUser.sub);
  }

  @Post(':cattleNumber/apply-events')
  @ApiOperation({ summary: 'Apply multiple simple events to a single cattle by number' })
  @ApiResponse({ status: 200, description: 'Events applied successfully', type: CattleResponseDto })
  @RequireAction('update')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        events: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              type: { type: 'string', enum: ['weight','eartag','tracker','brand','castration','medication'] },
              data: { type: 'object' },
              appliedBy: { type: 'string' },
              recordedInMassiveEvent: { type: 'string' }
            }
          }
        }
      }
    },
    examples: {
      example1: {
        summary: 'Apply multiple events to one cattle',
        value: {
          events: [
            { type: 'weight', data: { weight: 350 } },
            { type: 'eartag', data: { eartagNumber: 'ET-789' } }
          ]
        }
      }
    }
  })
  async applyEventsToSingleCattle(
    @SessionUser() sessionUser: SessionUserDto,
    @Param('cattleNumber') cattleNumber: string,
    @Body('events') events: Array<{
      type: 'weight'|'eartag'|'tracker'|'brand'|'castration'|'medication';
      data: any;
      appliedBy?: string;
      recordedInMassiveEvent?: string;
    }>
  ) {
    const cattle = await this.cattleService.applyMultipleSimpleEventsByNumber(
      sessionUser.tenant_id,
      cattleNumber,
      events,
      sessionUser.sub
    );
    
    //return CattleResponseDto.toResponseDto(    );
  }


  @Post('sync-cattle-simple-event')
  @ApiOperation({ summary: 'Sync offline cattle-simple-event records to backend' })
  @ApiResponse({ status: 200, description: 'Sync results', type: SyncAnimalSimpleEventResponseDto })
  @RequireAction('update')
  @ApiBody({
    type: SyncAnimalSimpleEventRequestDto,
    examples: {
      example1: {
        summary: 'Sync multiple SimpleEventCattle',
        value: {
          simpleEventCattle: [
            {
              id: 'uuid-local-1',
              idTenant: 'tenant-uuid',
              cattleNumber: 'C-123',
              type: 'weight',
              dataJson: '{"weight":350}',
              appliedAt: '2025-07-24T10:00:00Z',
              appliedBy: 'user-123',
              recordedInMassiveEvent: 'uuid-simple-event-1'
            },
            {
              id: 'uuid-local-2',
              idTenant: 'tenant-uuid',
              cattleNumber: 'C-999',
              type: 'medication',
              dataJson: '{"medicationName":"med-001","dosage":"1ml","route":"oral","lot":"LOT-2025"}',
              appliedAt: '2025-07-24T11:00:00Z',
              appliedBy: 'user-123',
              recordedInMassiveEvent: 'uuid-simple-event-2'
            }
          ]
        }
      }
    }
  })
  async syncSimpleEventCattle(
    @SessionUser() sessionUser: SessionUserDto,
    @Body() body: SyncAnimalSimpleEventRequestDto,
  ): Promise<SyncAnimalSimpleEventResponseDto> {
    const results = await this.cattleService.syncSimpleEventCattle(sessionUser.tenant_id, body.animalSimpleEvent, sessionUser.sub);
    return { results };
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