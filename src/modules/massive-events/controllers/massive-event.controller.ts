import { Controller, Get, Post, Put, Delete, Param, Body, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { MassiveEventService } from '../services/massive-event.service';
import { CreateMassiveEventDto } from '../dto/create-massive-event.dto';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { RequireEntity, RequireModule, RequireAction } from 'src/common/application-permissions/application-permissions.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ApplicationPermissionsGuard } from 'src/common/application-permissions/application-permissions.guard';
import { SessionUser } from 'src/common/decorators/session-user.decorator';
import { SessionUserDto } from '../../auth/dto/session-user.dto';
import { MassiveEventResponseDto } from '../dto/massive-event-response.dto';
import { SyncMassiveEventsRequestDto, SyncMassiveEventsResponseDto } from '../dto/sync-massive-event.dto';

@ApiTags('Massive Events')
@ApiBearerAuth('access-token')
@Controller('massive-events')
@RequireEntity('massive_events')
@RequireModule('MASSIVE_EVENTS')
@UseGuards(JwtAuthGuard, ApplicationPermissionsGuard)
export class MassiveEventController {
  constructor(private readonly massiveEventService: MassiveEventService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new massive event with initial simple events' })
  @HttpCode(HttpStatus.CREATED)
  @ApiResponse({ status: 201, description: 'Massive event created successfully', type: MassiveEventResponseDto })
  @ApiResponse({status: 400, description: 'Invalid request body'})
  @RequireAction('create')
  @ApiBody({
    type: CreateMassiveEventDto,
    examples: {
      medication: {
        summary: 'Massive event with medication simple event',
        value: {
          eventDate: '2025-07-24',
          simpleEvents: [
            {
              type: 'medication',
              data: {
                medicationName: 'abc',
                dosage: '1ml/50kg',
                route: 'oral',
                lot: '232adf-asdf'
              }
            }
          ]
        }
      }
    }
  })
  async create(@SessionUser() sessionUser: SessionUserDto, @Body() dto: CreateMassiveEventDto) {
    const massiveEvent = await this.massiveEventService.createMassiveEvent(sessionUser.tenant_id, sessionUser.sub, dto);
    return MassiveEventResponseDto.toResponseDto(massiveEvent, massiveEvent.simpleEvents);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a massive event by ID' })
  @ApiResponse({ status: 200, description: 'Massive event found', type: MassiveEventResponseDto  })
  @ApiResponse({ status: 404, description: 'Massive event not found'})
  @RequireAction('read')
  async findOne(@SessionUser() sessionUser: SessionUserDto, @Param('id') id: string) {
    const massiveEvent = await this.massiveEventService.findByIdOrFail(sessionUser.tenant_id, id);
    return MassiveEventResponseDto.toResponseDto(massiveEvent, massiveEvent.simpleEvents);
  }

  @Get('cattle/:id')
  @ApiOperation({ summary: 'List all ids of cattle impacted by a massive event' })
  @ApiResponse({ status: 200, description: 'List of cattle with metadata' })
  @RequireAction('read')
  async getAppliedCattleIdsByMassiveEvent(@Param('id') idMassiveEvent: string, @SessionUser() sessionUser: SessionUserDto) {
    return this.massiveEventService.findCattleByMassiveEvent(sessionUser.tenant_id, idMassiveEvent);
  }

  @Get()
  @ApiOperation({ summary: 'List all massive events' })
  @ApiResponse({ status: 200, description: 'List of massive events', type: [MassiveEventResponseDto] })
  @RequireAction('read')
  async list(@SessionUser() sessionUser: SessionUserDto) {
    const massiveEvents = await this.massiveEventService.findAll(sessionUser.tenant_id);
    return massiveEvents.map(massiveEvent => MassiveEventResponseDto.toResponseDto(massiveEvent, massiveEvent.simpleEvents));
  }

  @Put('close/:id')
  @ApiOperation({ summary: 'Close a massive event' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiResponse({ status: 204, description: 'Massive event closed'})
  @ApiResponse({ status: 404, description: 'Massive event not found'})
  @ApiResponse({ status: 422, description: 'No simple events applied'})
  @RequireAction('update')
  async close(@SessionUser() sessionUser: SessionUserDto, @Param('id') id: string) {
    await this.massiveEventService.closeMassiveEvent(sessionUser.tenant_id, id);
  }

 /* @Delete(':id')
  @ApiOperation({ summary: 'Delete a massive event' })
  @ApiResponse({ status: 200, description: 'Massive event deleted' })
  @RequireAction('delete')
  remove(@SessionUser() sessionUser: SessionUserDto, @Param('id') id: string) {
    return this.massiveEventService.deleteMassiveEvent(sessionUser.tenant_id, id);
  }
*/

  @Post('sync')
  @ApiOperation({ summary: 'Sync Massive Events and their Simple Events (offline to backend)' })
  @ApiResponse({ status: 200, description: 'Massive Events synced successfully', type: SyncMassiveEventsResponseDto })
  @ApiBody({
    type: SyncMassiveEventsRequestDto,
    examples: {
      example1: {
        summary: 'MassiveEvent with all types of SimpleEvents',
        value: {
          massiveEvents: [
            {
              id: 'uuid-massive-1',
              idTenant: 'tenant-uuid',
              eventDate: '2025-07-24T00:00:00Z',
              status: 'open',
              createdBy: 'user-123',
              createdAt: '2025-07-24T00:00:00Z',
              simpleEvents: [
                {
                  id: 'uuid-se-weight',
                  type: 'weight',
                  dataJson: '{}'
                },
                {
                  id: 'uuid-se-eartag',
                  type: 'eartag',
                  dataJson: '{}'
                },
                {
                  id: 'uuid-se-tracker',
                  type: 'tracker',
                  dataJson: '{}'
                },
                {
                  id: 'uuid-se-brand',
                  type: 'brand',
                  dataJson: '{"idBrand":"brand-777"}'
                },
                {
                  id: 'uuid-se-castration',
                  type: 'castration'
                },
                {
                  id: 'uuid-se-medication',
                  type: 'medication',
                  dataJson: '{"medicationName":"med-001","dosage":"1ml","route":"oral","lot":"LOT-2025"}'
                }
              ]
            }
          ]
        }
      }
    },
  })
  @RequireAction('create')
  sync(@SessionUser() user: SessionUserDto, @Body() body: SyncMassiveEventsRequestDto) {
    return this.massiveEventService.syncMassiveEvents(user.tenant_id, body.massiveEvents);
  }
}
