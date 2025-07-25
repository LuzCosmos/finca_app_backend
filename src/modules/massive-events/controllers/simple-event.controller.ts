import { Controller, Post, Get, Param, Body, UseGuards } from '@nestjs/common';
import { SimpleEventService } from '../services/simple-event.service';
import { CreateSimpleEventDto } from '../dto/create-simple-event.dto';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { RequireEntity, RequireModule, RequireAction } from 'src/common/application-permissions/application-permissions.decorator';
import { SimpleEventCattleRepository } from '../repositories/simple-event-cattle.repository';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { ApplicationPermissionsGuard } from 'src/common/application-permissions/application-permissions.guard';
import { SessionUser } from 'src/common/decorators/session-user.decorator';
import { SessionUserDto } from 'src/modules/auth/dto/session-user.dto';

@ApiTags('Simple Events')
@ApiBearerAuth('access-token')
@Controller('simple-events')
@RequireEntity('simple_events')
@RequireModule('FARM')
@UseGuards(JwtAuthGuard, ApplicationPermissionsGuard)
export class SimpleEventController {
  constructor(
    private readonly simpleEventService: SimpleEventService,
    private readonly simpleEventCattleRepository: SimpleEventCattleRepository,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a new simple event and attach to a massive event' })
  @ApiResponse({ status: 201, description: 'Simple event created successfully' })
  @RequireAction('create')
  @ApiBody({
    type: CreateSimpleEventDto,
    examples: {
      weight: {
        summary: 'Weight type (data varies per cattle)',
        value: {
          idMassiveEvent: 'uuid-massive-event',
          type: 'weight',
          data: {}
        }
      },
      eartag: {
        summary: 'Eartag type (data varies per cattle)',
        value: {
          idMassiveEvent: 'uuid-massive-event',
          type: 'eartag',
          data: {}
        }
      },
      tracker: {
        summary: 'Tracker type (data varies per cattle)',
        value: {
          idMassiveEvent: 'uuid-massive-event',
          type: 'tracker',
          data: {}
        }
      },
      castration: {
        summary: 'Castration type (data varies per cattle)',
        value: {
          idMassiveEvent: 'uuid-massive-event',
          type: 'castration',
          data: {}
        }
      },
      brand: {
        summary: 'Brand type (same brand for all cattle)',
        value: {
          idMassiveEvent: 'uuid-massive-event',
          type: 'brand',
          data: { brandId: 'uuid-brand' }
        }
      },
      medication: {
        summary: 'Medication type (same medication for all cattle)',
        value: {
          idMassiveEvent: 'uuid-massive-event',
          type: 'medication',
          data: {
            medicationId: 'abc',
            dosage: '1ml/50kg',
            route: 'oral',
            lot: '232adf-asdf'
          }
        }
      }
    }
  })
  create(@SessionUser() sessionUser: SessionUserDto, @Body() dto: CreateSimpleEventDto) {
    return this.simpleEventService.createSimpleEvent(sessionUser.tenant_id, dto);
  }

  @Get(':idMassiveEvent')
  @ApiOperation({ summary: 'List all simple events by massive event' })
  @ApiResponse({ status: 200, description: 'List of simple events by massive event' })
  @RequireAction('read')
  list(@SessionUser() sessionUser: SessionUserDto, @Param('idMassiveEvent') idMassiveEvent: string) {
    return this.simpleEventService.findByMassiveEvent(sessionUser.tenant_id, idMassiveEvent);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a simple event by ID' })
  @ApiResponse({ status: 200, description: 'Simple event found' })
  @RequireAction('read')
  findById(@SessionUser() sessionUser: SessionUserDto, @Param('id') id: string) {
    return this.simpleEventService.findById(sessionUser.tenant_id, id);
  }

  @Get(':id/cattle')
  @ApiOperation({ summary: 'List all cattle related to a simple event' })
  @ApiResponse({ status: 200, description: 'List of cattle IDs' })
  @RequireAction('read')
  async findCattleBySimpleEvent(@Param('id') id: string) {
    const links = await this.simpleEventCattleRepository.findBySimpleEvent(id);
    return links.map(link => ({
      idCattle: link.idCattle,
      appliedAt: link.appliedAt,
      appliedBy: link.appliedBy,
    }));
  }

}
