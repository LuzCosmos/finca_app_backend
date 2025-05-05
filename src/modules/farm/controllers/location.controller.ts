import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { LocationService } from '../services/location.service';
import { CreateLocationDto } from '../dto/create-location.dto';
import { ApiOperation, ApiResponse, ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Location } from '../entities/location.entity';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { ApplicationPermissionsGuard } from 'src/modules/auth/application-permissions/application-permissions.guard';
import { RequireEntity } from 'src/modules/auth/application-permissions/application-permissions.decorator';
import { RequireModule } from 'src/modules/auth/application-permissions/application-permissions.decorator';
import { SessionUserDto } from 'src/modules/auth/dto/session-user.dto';
import { SessionUser } from 'src/modules/auth/decorators/session-user.decorator';

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
  @ApiOperation({ summary: 'Create a new location' })
  @ApiResponse({ status: 201, description: 'Location created successfully', type: Location })
  create(@Body() dto: CreateLocationDto) {
    return this.locationService.create(dto);
  }*/

  @Get(':id')
  @ApiOperation({ summary: 'Get a location by ID' })
  @ApiResponse({ status: 200, description: 'Location found', type: Location })
  findOne(@Param('id') id: string) {
    return this.locationService.findOne(id);
  }

  @Get('cattle/:id')
  @ApiOperation({ summary: 'Get a location by cattle ID' })
  @ApiResponse({ status: 200, description: 'Location found', type: Location })
  findByCattle(@Param('id') id: string, @SessionUser() sessionUser: SessionUserDto) {
    return this.locationService.findByCattle(id, sessionUser.tenant_id);
  }

  @Get('device/:id')
  @ApiOperation({ summary: 'Get a location by device ID' })
  @ApiResponse({ status: 200, description: 'Location found', type: Location })
  findByDevice(@Param('id') id: string, @SessionUser() sessionUser: SessionUserDto) {
    return this.locationService.findByDevice(id, sessionUser.tenant_id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a location' })
  @ApiResponse({ status: 200, description: 'Location deleted successfully' })
  remove(@Param('id') id: string) {
    return this.locationService.remove(id);
  }
}
