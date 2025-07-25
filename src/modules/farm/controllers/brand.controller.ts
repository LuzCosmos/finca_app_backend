import { Controller, Get, Post, Put, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { BrandService } from '../services/brand.service';
import { CreateBrandDto } from '../dto/create-brand.dto';
import { UpdateBrandDto } from '../dto/update-brand.dto';
import { BrandResponseDto } from '../dto/brand-response.dto';
import { Brand } from '../entities/brand.entity';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { RequireEntity, RequireModule, RequireAction } from 'src/common/application-permissions/application-permissions.decorator';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { ApplicationPermissionsGuard } from 'src/common/application-permissions/application-permissions.guard';
import { SessionUser } from 'src/common/decorators/session-user.decorator';
import { SessionUserDto } from 'src/modules/auth/dto/session-user.dto';

@ApiTags('Brands')
@ApiBearerAuth('access-token')
@Controller('brands')
@RequireEntity('brands')
@RequireModule('FARM')
@UseGuards(JwtAuthGuard, ApplicationPermissionsGuard)
export class BrandController {
  constructor(private readonly brandService: BrandService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new brand' })
  @ApiResponse({ status: 201, description: 'Brand created successfully', type: BrandResponseDto })
  @RequireAction('create')
  @ApiBody({ type: CreateBrandDto, required: true, examples: {
    example1: {
      summary: 'Basic brand creation',
      value: { name: 'Marca A' },
    },
    example2: {
      summary: 'Another brand',
      value: { name: 'Marca B' },
    },
  }})
  async create(@SessionUser() sessionUser: SessionUserDto, @Body() dto: CreateBrandDto): Promise<BrandResponseDto> {
    const brand = await this.brandService.create(sessionUser.tenant_id, dto); 
    return BrandResponseDto.toResponseDto(brand);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a brand by ID' })
  @ApiResponse({ status: 200, description: 'Brand found', type: BrandResponseDto })
  @RequireAction('read')
  async findOne(@Param('id') id: string, @SessionUser() sessionUser: SessionUserDto): Promise<BrandResponseDto> {
    const brand = await this.brandService.findOne(sessionUser.tenant_id, id);
    return BrandResponseDto.toResponseDto(brand);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a brand' })
  @ApiResponse({ status: 200, description: 'Brand updated', type: BrandResponseDto })
  @RequireAction('update')
  async update(@Param('id') id: string, @SessionUser() sessionUser: SessionUserDto, @Body() dto: UpdateBrandDto): Promise<BrandResponseDto> {
    const brand = await this.brandService.update(sessionUser.tenant_id, id, dto);
    return BrandResponseDto.toResponseDto(brand);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a brand' })
  @ApiResponse({ status: 200, description: 'Brand deleted successfully' })
  @RequireAction('delete')
  remove(@Param('id') id: string, @SessionUser() sessionUser: SessionUserDto) {
    return this.brandService.remove(sessionUser.tenant_id, id);
  }

  @Get()
  @ApiOperation({ summary: 'List all brands' })
  @ApiResponse({ status: 200, description: 'List of brands', type: [BrandResponseDto] })
  @RequireAction('read')
  async list(@SessionUser() sessionUser: SessionUserDto): Promise<BrandResponseDto[]> {
    const brands = await this.brandService.findAll(sessionUser.tenant_id);
    return brands.map(BrandResponseDto.toResponseDto);
  }
}
