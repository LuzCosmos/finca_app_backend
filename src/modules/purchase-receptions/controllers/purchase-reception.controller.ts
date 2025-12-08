import { Controller, Get, Post, Put, Delete, Param, Body, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { RequireEntity, RequireModule, RequireAction } from 'src/common/application-permissions/application-permissions.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ApplicationPermissionsGuard } from 'src/common/application-permissions/application-permissions.guard';
import { SessionUser } from 'src/common/decorators/session-user.decorator';
import { SessionUserDto } from '../../auth/dto/session-user.dto';
import { ReceptionsService } from '../services/receptions.service';
import { ReceptionResponseDto } from '../dto/reception-response.dto';
import { ReceiveCattleDto } from '../dto/receive-cattle.dto';


@ApiTags('Purchase reception')
@ApiBearerAuth('access-token')
@Controller('purchase-receptions')
@RequireEntity('receptions')
@RequireModule('RECEPTION')
@UseGuards(JwtAuthGuard, ApplicationPermissionsGuard)
export class ReceptionController {
  constructor(private readonly receptionsService: ReceptionsService) { }

  @Get(':idPurchase')
  @ApiOperation({ summary: 'Find or create a reception by purchase id' })
  @HttpCode(HttpStatus.OK)
  @ApiResponse({ status: 200, description: 'Reception found or created successfully', type: ReceptionResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid request body' })
  @RequireAction('create')
  async findOrCreateReception(@SessionUser() sessionUser: SessionUserDto, @Param('idPurchase') idPurchase: string) {
    console.log('idPurchase - controller', idPurchase);
    const receptionResponseDto = await this.receptionsService.findOrCreateReceptionByIdPurchase(
      sessionUser.tenant_id,
      idPurchase,
      sessionUser.sub);
    return receptionResponseDto;
  }
  /*
    @Post('receive-cattle')
    @ApiOperation({ summary: 'Receive cattle to a reception' })
    @HttpCode(HttpStatus.OK)
    @ApiResponse({ status: 200, description: 'Cattle received successfully', type: ReceptionResponseDto })
    @ApiResponse({ status: 400, description: 'Invalid request body'})
    @RequireAction('create')
    @ApiBody({ type: ReceiveCattleDto })
    async receiveCattle(@SessionUser() sessionUser: SessionUserDto, @Body() dto: ReceiveCattleDto) {
      const receptionResponseDto = await this.receptionsService.receiveCattle(
        sessionUser.tenant_id,
        dto.receptionId,
        dto.cattle,
        sessionUser.sub);
      return receptionResponseDto;
    }*/







} 