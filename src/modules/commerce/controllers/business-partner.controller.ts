import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { BusinessPartnerService } from '../services/business-partner.service';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
  ApiQuery,
} from '@nestjs/swagger';
import { ApplicationPermissionsGuard } from '../../../common/application-permissions/application-permissions.guard';
import { SessionUser } from '../../../common/decorators/session-user.decorator';
import { SessionUserDto } from '../../auth/dto/session-user.dto';
import {
  RequireEntity,
  RequireModule,
  RequireAction,
} from '../../../common/application-permissions/application-permissions.decorator';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { CreateBusinessPartnerDto } from '../dto/create-business-partner.dto';
import { UpdateBusinessPartnerDto } from '../dto/update-business-partner.dto';
import { BusinessPartnerResponseDto } from '../dto/business-partner-response.dto';

@ApiTags('BusinessPartner')
@ApiBearerAuth('access-token')
@Controller('business-partners')
@RequireEntity('business_partners')
@RequireModule('COMMERCE')
@UseGuards(JwtAuthGuard, ApplicationPermissionsGuard)
export class BusinessPartnerController {
  constructor(private readonly businessPartnerService: BusinessPartnerService) {}

  @Post()
  @RequireAction('create')
  @ApiOperation({ summary: 'Create a new business partner' })
  @HttpCode(HttpStatus.CREATED)
  @ApiResponse({
    status: 201,
    description: 'Business partner created successfully',
    type: BusinessPartnerResponseDto,
  })
  @ApiResponse({ status: 409, description: 'NIT already exists for this tenant' })
  @ApiBody({
    type: CreateBusinessPartnerDto,
    required: true,
    examples: {
      example1: {
        summary: 'Mandatory fields',
        value: { nit: '1234567890', name: 'Partner 1', type: 'PROVIDER' },
      },
    },
  })
  async create(
    @Body() body: CreateBusinessPartnerDto,
    @SessionUser() user: SessionUserDto,
  ): Promise<BusinessPartnerResponseDto> {
    const businessPartner = await this.businessPartnerService.createBusinessPartner({
      ...body,
      idTenant: user.tenant_id,
    });
    return BusinessPartnerResponseDto.toResponse(businessPartner);
  }

  @Get('search')
  @RequireAction('read')
  @ApiOperation({ summary: 'Search business partners by name' })
  @ApiQuery({ name: 'name', required: true, description: 'Search term for business partner name' })
  @ApiQuery({
    name: 'type',
    required: false,
    description: 'Filter by role (BUYER, TRANSPORTER, VET, OTHER, PROVIDER)',
  })
  @ApiResponse({
    status: 200,
    description: 'List of matching business partners',
    type: [BusinessPartnerResponseDto],
  })
  async searchByName(
    @SessionUser() user: SessionUserDto,
    @Query('name') name: string,
    @Query('type') type?: string,
  ): Promise<BusinessPartnerResponseDto[]> {
    const businessPartners = await this.businessPartnerService.searchByName(name, user.tenant_id);
    const filtered = type ? businessPartners.filter((p) => p.type === type) : businessPartners;
    return filtered.map(BusinessPartnerResponseDto.toResponse);
  }

  @Get('search/by-nit')
  @RequireAction('read')
  @ApiQuery({ name: 'query', required: true, description: 'Fragmento parcial del NIT' })
  @ApiResponse({
    status: 200,
    description: 'Business partners coincidentes con fragmento del NIT',
    type: [BusinessPartnerResponseDto],
  })
  async searchByNit(
    @Query('query') query: string,
    @SessionUser() session: SessionUserDto,
  ): Promise<BusinessPartnerResponseDto[]> {
    const results = await this.businessPartnerService.searchBusinessPartnersByNit(
      query,
      session.tenant_id,
    );
    return results.map(BusinessPartnerResponseDto.toResponse);
  }

  @Get(':id')
  @RequireAction('read')
  @ApiOperation({ summary: 'Find business partner by ID' })
  @ApiResponse({ status: 200, description: 'Business partner found', type: BusinessPartnerResponseDto })
  @ApiResponse({ status: 404, description: 'Business partner not found by ID' })
  async findById(
    @Param('id') id: string,
    @SessionUser() user: SessionUserDto,
  ): Promise<BusinessPartnerResponseDto> {
    return BusinessPartnerResponseDto.toResponse(
      await this.businessPartnerService.findById(id, user.tenant_id),
    );
  }

  @Get('nit/:nit')
  @RequireAction('read')
  @ApiOperation({ summary: 'Find business partner by NIT' })
  @ApiResponse({ status: 200, description: 'Business partner found', type: BusinessPartnerResponseDto })
  @ApiResponse({ status: 404, description: 'Business partner not found by NIT' })
  async findByNit(
    @Param('nit') nit: string,
    @SessionUser() user: SessionUserDto,
  ): Promise<BusinessPartnerResponseDto> {
    return BusinessPartnerResponseDto.toResponse(
      await this.businessPartnerService.findByNit(nit, user.tenant_id),
    );
  }

  @Get()
  @RequireAction('read')
  @ApiOperation({ summary: 'Get all business partners by tenant' })
  @ApiQuery({
    name: 'type',
    required: false,
    description: 'Filter by role (BUYER, TRANSPORTER, VET, OTHER, PROVIDER)',
  })
  @ApiResponse({ status: 200, description: 'List of business partners', type: [BusinessPartnerResponseDto] })
  async findAll(
    @SessionUser() user: SessionUserDto,
    @Query('type') type?: string,
  ): Promise<BusinessPartnerResponseDto[]> {
    const businessPartners = await this.businessPartnerService.findAll(user.tenant_id);
    const filtered = type ? businessPartners.filter((p) => p.type === type) : businessPartners;
    return filtered.map(BusinessPartnerResponseDto.toResponse);
  }

  @Put(':id')
  @RequireAction('update')
  @ApiOperation({ summary: 'Update business partner by ID' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiResponse({ status: 204, description: 'Business partner updated' })
  @ApiResponse({ status: 404, description: 'Business partner not found by ID' })
  @ApiResponse({ status: 409, description: 'NIT already exists for this tenant' })
  @ApiBody({ type: UpdateBusinessPartnerDto, required: true })
  async updateById(
    @Param('id') id: string,
    @Body() data: UpdateBusinessPartnerDto,
    @SessionUser() user: SessionUserDto,
  ): Promise<void> {
    await this.businessPartnerService.updateById(id, user.tenant_id, data);
  }

  @Put('nit/:nit')
  @RequireAction('update')
  @ApiOperation({ summary: 'Update business partner by NIT (NIT cannot be changed)' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiResponse({ status: 204, description: 'Business partner updated' })
  @ApiResponse({ status: 400, description: 'NIT update not allowed in this endpoint' })
  @ApiResponse({ status: 404, description: 'Business partner not found by NIT' })
  @ApiBody({ type: UpdateBusinessPartnerDto, required: true })
  async updateByNit(
    @Param('nit') nit: string,
    @Body() data: UpdateBusinessPartnerDto,
    @SessionUser() user: SessionUserDto,
  ): Promise<void> {
    if ('nit' in data && data.nit !== undefined && data.nit !== null) {
      throw new BadRequestException('NIT update not allowed in this endpoint');
    }
    await this.businessPartnerService.updateByNit(nit, user.tenant_id, data);
  }

  @Delete(':id')
  @RequireAction('delete')
  @ApiOperation({ summary: 'Delete business partner by ID' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiResponse({ status: 204, description: 'Business partner deleted' })
  async deleteById(@Param('id') id: string, @SessionUser() user: SessionUserDto): Promise<void> {
    await this.businessPartnerService.deleteById(id, user.tenant_id);
  }

  @Delete('nit/:nit')
  @RequireAction('delete')
  @ApiOperation({ summary: 'Delete business partner by NIT' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiResponse({ status: 204, description: 'Business partner deleted' })
  async deleteByNit(@Param('nit') nit: string, @SessionUser() user: SessionUserDto): Promise<void> {
    await this.businessPartnerService.deleteByNit(nit, user.tenant_id);
  }
}
