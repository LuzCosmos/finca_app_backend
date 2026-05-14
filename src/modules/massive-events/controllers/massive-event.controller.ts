import { Controller, Get, Post, Put, Param, Body, UseGuards, HttpCode, HttpStatus, Query } from '@nestjs/common';
import { MassiveEventService } from '../services/massive-event.service';
import { CreateMassiveEventDto } from '../dto/create-massive-event.dto';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiBody, ApiOkResponse } from '@nestjs/swagger';
import { RequireEntity, RequireModule, RequireAction } from 'src/common/application-permissions/application-permissions.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ApplicationPermissionsGuard } from 'src/common/application-permissions/application-permissions.guard';
import { SessionUser } from 'src/common/decorators/session-user.decorator';
import { SessionUserDto } from '../../auth/dto/session-user.dto';
import { MassiveEventResponseDto } from '../dto/massive-event-response.dto';
import { SyncMassiveEventsRequestDto, SyncMassiveEventsResponseDto } from '../dto/sync-massive-event.dto';
import { PagedResponseDto } from 'src/shared/dto/paged-response.dto';
import { MassiveEventListQueryDto } from '../dto/massive-event-list.query.dto';

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
  @ApiResponse({ status: 400, description: 'Invalid request body' })
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
                lot: '232adf-asdf',
              },
            },
          ],
        },
      },
    },
  })
  async create(@SessionUser() sessionUser: SessionUserDto, @Body() dto: CreateMassiveEventDto) {
    const massiveEvent = await this.massiveEventService.createMassiveEvent(sessionUser.tenant_id, sessionUser.sub, dto);
    const createdByUsername =
      massiveEvent.createdBy != null
        ? await this.massiveEventService.getUsernameForUser(sessionUser.tenant_id, massiveEvent.createdBy)
        : undefined;
    return MassiveEventResponseDto.toResponseDto(massiveEvent, massiveEvent.simpleEvents ?? [], {
      createdByUsername,
    });
  }

  /** Rutas estáticas antes de `:id` para que no capturen "cattle" como id. */
  @Get()
  @ApiOperation({ summary: 'List standalone massive events (excludes purchase reception), paginated' })
  @ApiOkResponse({ type: PagedResponseDto as any, description: 'Paged list of massive events' })
  @RequireAction('list')
  async list(
    @SessionUser() sessionUser: SessionUserDto,
    @Query() q: MassiveEventListQueryDto,
  ): Promise<PagedResponseDto<MassiveEventResponseDto>> {
    const { items, total, page, limit, usernameByUserId } = await this.massiveEventService.findStandaloneListPaged(
      sessionUser.tenant_id,
      q,
    );
    const dtos = items.map(massiveEvent =>
      MassiveEventResponseDto.toResponseDto(massiveEvent, massiveEvent.simpleEvents ?? [], {
        createdByUsername:
          massiveEvent.createdBy != null ? usernameByUserId.get(massiveEvent.createdBy) : undefined,
      }),
    );
    return PagedResponseDto.of(page, limit, total, dtos);
  }

  @Get('cattle/:id')
  @ApiOperation({ summary: 'List all ids of cattle impacted by a massive event' })
  @ApiResponse({ status: 200, description: 'List of cattle with metadata' })
  @RequireAction('read')
  async getAppliedCattleIdsByMassiveEvent(@Param('id') idMassiveEvent: string, @SessionUser() sessionUser: SessionUserDto) {
    await this.massiveEventService.findByIdForMassiveEventsModuleOrFail(sessionUser.tenant_id, idMassiveEvent);
    return this.massiveEventService.findCattleByMassiveEvent(sessionUser.tenant_id, idMassiveEvent);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a massive event by ID (not available for purchase-reception-linked events)' })
  @ApiResponse({ status: 200, description: 'Massive event found', type: MassiveEventResponseDto })
  @ApiResponse({ status: 404, description: 'Massive event not found' })
  @ApiResponse({
    status: 422,
    description: 'Massive event belongs to a purchase reception',
  })

  @RequireAction('read')
  async findOne(@SessionUser() sessionUser: SessionUserDto, @Param('id') id: string) {
    const massiveEvent = await this.massiveEventService.findByIdForMassiveEventsModuleOrFail(sessionUser.tenant_id, id);
    const createdByUsername =
      massiveEvent.createdBy != null
        ? await this.massiveEventService.getUsernameForUser(sessionUser.tenant_id, massiveEvent.createdBy)
        : undefined;
    return MassiveEventResponseDto.toResponseDto(massiveEvent, massiveEvent.simpleEvents ?? [], {
      createdByUsername,
    });
  }

  @Put('close/:id')
  @ApiOperation({ summary: 'Close a massive event' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiResponse({ status: 204, description: 'Massive event closed' })
  @ApiResponse({ status: 404, description: 'Massive event not found' })
  @ApiResponse({ status: 422, description: 'No simple events applied' })
  @RequireAction('update')
  async close(@SessionUser() sessionUser: SessionUserDto, @Param('id') id: string) {
    await this.massiveEventService.closeMassiveEvent(sessionUser.tenant_id, id);
  }

  @Post('sync')
  @HttpCode(HttpStatus.OK)
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
                  dataJson: '{}',
                },
                {
                  id: 'uuid-se-eartag',
                  type: 'eartag',
                  dataJson: '{"eartagLeft":"ET-L-001","eartagRight":"ET-R-001"}',
                },
                {
                  id: 'uuid-se-tracker',
                  type: 'tracker',
                  dataJson: '{}',
                },
                {
                  id: 'uuid-se-brand',
                  type: 'brand',
                  dataJson: '{"idBrand":"brand-777"}',
                },
                {
                  id: 'uuid-se-castration',
                  type: 'castration',
                },
                {
                  id: 'uuid-se-medication',
                  type: 'medication',
                  dataJson: '{"medicationName":"med-001","dosage":"1ml","route":"oral","lot":"LOT-2025"}',
                },
              ],
            },
          ],
        },
      },
    },
  })
  @RequireAction('create')
  sync(@SessionUser() user: SessionUserDto, @Body() body: SyncMassiveEventsRequestDto) {
    return this.massiveEventService.syncMassiveEvents(user.tenant_id, body.massiveEvents);
  }
}
