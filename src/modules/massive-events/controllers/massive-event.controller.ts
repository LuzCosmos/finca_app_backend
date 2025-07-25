import { Controller, Get, Post, Put, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { MassiveEventService } from '../services/massive-event.service';
import { CreateMassiveEventDto } from '../dto/create-massive-event.dto';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { RequireEntity, RequireModule, RequireAction } from 'src/common/application-permissions/application-permissions.decorator';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { ApplicationPermissionsGuard } from 'src/common/application-permissions/application-permissions.guard';
import { SessionUser } from 'src/common/decorators/session-user.decorator';
import { SessionUserDto } from 'src/modules/auth/dto/session-user.dto';
import { MassiveEventResponseDto } from '../dto/massive-event-response.dto';

@ApiTags('Massive Events')
@ApiBearerAuth('access-token')
@Controller('massive-events')
@RequireEntity('massive_events')
@RequireModule('FARM')
@UseGuards(JwtAuthGuard, ApplicationPermissionsGuard)
export class MassiveEventController {
  constructor(private readonly massiveEventService: MassiveEventService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new massive event with initial simple events' })
  @ApiResponse({ status: 201, description: 'Massive event created successfully', type: MassiveEventResponseDto })
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
                medicationId: 'abc',
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
  @RequireAction('read')
  async findOne(@SessionUser() sessionUser: SessionUserDto, @Param('id') id: string) {
    const massiveEvent = await this.massiveEventService.findOne(sessionUser.tenant_id, id);
    return MassiveEventResponseDto.toResponseDto(massiveEvent, massiveEvent.simpleEvents);
  }

  @Get(':id/cattle')
  @ApiOperation({ summary: 'List all cattle impacted by a massive event' })
  @ApiResponse({ status: 200, description: 'List of cattle with metadata' })
  @RequireAction('read')
  async findCattleByMassiveEvent(@Param('id') idMassiveEvent: string, @SessionUser() sessionUser: SessionUserDto) {
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

  @Put(':id/close')
  @ApiOperation({ summary: 'Close a massive event' })
  @ApiResponse({ status: 200, description: 'Massive event closed', type: MassiveEventResponseDto })
  @RequireAction('update')
  async close(@SessionUser() sessionUser: SessionUserDto, @Param('id') id: string) {
    const massiveEvent = await this.massiveEventService.closeMassiveEvent(sessionUser.tenant_id, id);
    return MassiveEventResponseDto.toResponseDto(massiveEvent, massiveEvent.simpleEvents);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a massive event' })
  @ApiResponse({ status: 200, description: 'Massive event deleted' })
  @RequireAction('delete')
  remove(@SessionUser() sessionUser: SessionUserDto, @Param('id') id: string) {
    return this.massiveEventService.deleteMassiveEvent(sessionUser.tenant_id, id);
  }
}
