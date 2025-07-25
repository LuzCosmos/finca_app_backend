import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { PurchaseService } from '../services/purchase.service';
import { CreatePurchaseDto } from '../dto/create-purchase.dto';
import { UpdatePurchaseDto } from '../dto/update-purchase.dto';
import { SessionUser } from '../../../common/decorators/session-user.decorator';
import { SessionUserDto } from '../../auth/dto/session-user.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ApplicationPermissionsGuard } from '../../../common/application-permissions/application-permissions.guard';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { PurchaseResponseDto } from '../dto/purchase-response.dto';
import { RequireEntity, RequireModule, RequireAction } from '../../../common/application-permissions/application-permissions.decorator';

@ApiTags('Purchases')
@ApiBearerAuth('access-token')
@Controller('purchases')
@RequireEntity('purchases')
@RequireModule('COMMERCE')
@UseGuards(JwtAuthGuard, ApplicationPermissionsGuard)
export class PurchaseController {
  constructor(private readonly purchaseService: PurchaseService) {}

  @Post()
  @RequireAction('create')
  @ApiOperation({ summary: 'Create a new purchase' })
  @ApiResponse({ status: 201, type: PurchaseResponseDto })
  async createPurchase(
    @Body() dto: CreatePurchaseDto,
    @SessionUser() user: SessionUserDto,
  ): Promise<PurchaseResponseDto> {
    const purchase = await this.purchaseService.createPurchase(dto, user.tenant_id, user.sub);
    //return { ...purchase, lots: purchase.lots };
    return PurchaseResponseDto.toPurchaseResponse(purchase);
  }

  @Patch(':id')
  @RequireAction('update')
  @ApiOperation({ summary: 'Update an existing purchase' })
  @ApiResponse({ status: 201, type: PurchaseResponseDto })
  async updatePurchase(
    @Param('id') id: string,
    @Body() dto: UpdatePurchaseDto,
    @SessionUser() user: SessionUserDto,
  ): Promise<PurchaseResponseDto> {
    const purchase = await this.purchaseService.updatePurchase(id, dto, user.tenant_id, user.sub);
    return PurchaseResponseDto.toPurchaseResponse(purchase);
  }

  @Get()
  @RequireAction('read')
  @ApiOperation({ summary: 'Get all purchases for tenant' })
  @ApiResponse({ status: 200, type: [PurchaseResponseDto] })
  async findAll(
    @SessionUser() user: SessionUserDto,
  ): Promise<PurchaseResponseDto[]> {
    const purchases = await this.purchaseService.findAll(user.tenant_id);
    return purchases.map(purchase => PurchaseResponseDto.toPurchaseResponse(purchase));
  }

  @Get(':id')
  @RequireAction('read')
  @ApiOperation({ summary: 'Get a purchase by ID' })
  @ApiResponse({ status: 200, type: PurchaseResponseDto })
  async findById(
    @Param('id') id: string,
    @SessionUser() user: SessionUserDto,
  ): Promise<PurchaseResponseDto> {
    return PurchaseResponseDto.toPurchaseResponse(await this.purchaseService.findById(id, user.tenant_id));
  }

  @Delete(':id')
  @RequireAction('delete')
  @ApiOperation({ summary: 'Delete a purchase by ID' })
  @ApiResponse({ status: 204 })
  async deleteById(
    @Param('id') id: string,
    @SessionUser() user: SessionUserDto,
  ): Promise<void> {
    await this.purchaseService.deleteById(id, user.tenant_id);
  }
}
