import {
  Controller,
  Get,
  Param,
  UseGuards,
} from '@nestjs/common';
import { LotService } from '../services/lot.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ApplicationPermissionsGuard } from '../../auth/application-permissions/application-permissions.guard';
import { SessionUser } from '../../auth/decorators/session-user.decorator';
import { SessionUserDto } from '../../auth/dto/session-user.dto';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { LotResponseDto } from '../dtos/lot-response.dto';
import { RequireEntity, RequireModule, RequireAction } from 'src/modules/auth/application-permissions/application-permissions.decorator';

@ApiTags('Lots')
@ApiBearerAuth('access-token')
@Controller('lots')
@RequireEntity('lots')
@RequireModule('COMMERCE')
@UseGuards(JwtAuthGuard, ApplicationPermissionsGuard)
export class LotController {
  constructor(private readonly lotService: LotService) {}

  @Get(':id')
  @RequireAction('read')
  @ApiOperation({ summary: 'Get a lot by ID' })
  @ApiResponse({ status: 200, type: LotResponseDto })
  async findOne(
    @Param('id') id: string,
    @SessionUser() user: SessionUserDto,
  ): Promise<LotResponseDto> {
    return LotResponseDto.toLotResponse(await this.lotService.findOne(id, user.tenant_id));
  }

  @Get('/purchase/:idPurchase')
  @RequireAction('read')
  @ApiOperation({ summary: 'Get all lots for a given purchase ID' })
  @ApiResponse({ status: 200, type: [LotResponseDto] })
  async findByPurchase(
    @Param('idPurchase') idPurchase: string,
    @SessionUser() user: SessionUserDto,
  ): Promise<LotResponseDto[]> {
    const lots = await this.lotService.findByPurchaseId(idPurchase, user.tenant_id);
    return lots.map(lot => LotResponseDto.toLotResponse(lot));
  }
}
