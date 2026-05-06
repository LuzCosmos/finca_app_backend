import { Controller, Get, Post, Body, Patch, Param, Delete, HttpCode, HttpStatus } from '@nestjs/common';
import { LocationService } from '../services/location.service';
import { CreateLocationDto } from '../dto/create-location.dto';
import { ApiOperation, ApiResponse, ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Location } from '../entities/location.entity';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { ApplicationPermissionsGuard } from 'src/common/application-permissions/application-permissions.guard';
import { RequireAction, RequireEntity, RequireModule } from 'src/common/application-permissions/application-permissions.decorator';
import { SessionUserDto } from 'src/modules/auth/dto/session-user.dto';
import { SessionUser } from 'src/common/decorators/session-user.decorator';

@ApiTags('Locations')
@ApiBearerAuth('access-token')
@Controller('locations')
@RequireEntity('locations')
@RequireModule('FARM')
@UseGuards(JwtAuthGuard, ApplicationPermissionsGuard)
export class LocationController {
  constructor(private readonly locationService: LocationService) {}

  /*
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new location' })
  @ApiResponse({ status: 201, description: 'Location created successfully', type: Location })
  create(@Body() dto: CreateLocationDto) {
    return this.locationService.create(dto);
  }*/

  @Get('cattle/:id')
  @RequireAction('read')
  @ApiOperation({ summary: 'Get a location by cattle ID' })
  @ApiResponse({ status: 200, description: 'Location found', type: Location })
  findByCattle(@Param('id') id: string, @SessionUser() sessionUser: SessionUserDto) {
    return this.locationService.findByCattle(id, sessionUser.tenant_id);
  }

  @Get('device/:id')
  @RequireAction('read')
  @ApiOperation({ summary: 'Get a location by device ID' })
  @ApiResponse({ status: 200, description: 'Location found', type: Location })
  findByDevice(@Param('id') id: string, @SessionUser() sessionUser: SessionUserDto) {
    return this.locationService.findByDevice(id, sessionUser.tenant_id);
  }

  @Get('latest/cattle')
  @RequireAction('read')
  @ApiOperation({ summary: 'Get latest location per cattle (tenant)' })
  @ApiResponse({ status: 200, description: 'Latest locations per cattle' })
  findLatestPerCattle(@SessionUser() sessionUser: SessionUserDto) {
    return this.locationService.findLatestPerCattleForTenant(sessionUser.tenant_id);
  }

  @Get(':id')
  @RequireAction('read')
  @ApiOperation({ summary: 'Get a location by ID' })
  @ApiResponse({ status: 200, description: 'Location found', type: Location })
  findOne(@Param('id') id: string) {
    return this.locationService.findOne(id);
  }

  @Delete(':id')
  @RequireAction('delete')
  @ApiOperation({ summary: 'Delete a location' })
  @ApiResponse({ status: 200, description: 'Location deleted successfully' })
  remove(@Param('id') id: string) {
    return this.locationService.remove(id);
  }
}
