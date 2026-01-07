import { Controller, Get, Post, Put, Patch, Delete, Param, Body, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { RequireEntity, RequireModule, RequireAction } from 'src/common/application-permissions/application-permissions.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ApplicationPermissionsGuard } from 'src/common/application-permissions/application-permissions.guard';
import { SessionUser } from 'src/common/decorators/session-user.decorator';
import { SessionUserDto } from '../../auth/dto/session-user.dto';
import { ReceptionsService } from '../services/receptions.service';
import { ReceptionResponseDto } from '../dto/reception-response.dto';
import { ReceiveCattleRequestDto, UpdateLotCattleRequestDto } from '../dto/receive-cattle-request.dto';
import { ReceiveCattleResponseDto } from '../dto/receive-cattle-response.dto';
import { Cattle } from 'src/modules/farm/entities/cattle.entity';

@ApiTags('Purchase reception')
@ApiBearerAuth('access-token')
@Controller('purchase-receptions')
@RequireEntity('receptions')
@RequireModule('RECEPTION')
@UseGuards(JwtAuthGuard, ApplicationPermissionsGuard)
export class ReceptionController {

  constructor(
    private readonly receptionsService: ReceptionsService) { }

  @Get(':idPurchase')
  @ApiOperation({ summary: 'Find or create a reception by purchase id' })
  @HttpCode(HttpStatus.OK)
  @ApiResponse({ status: 200, description: 'Reception found or created successfully', type: ReceptionResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid request body' })
  @RequireAction('create')
  async findOrCreateReception(@SessionUser() sessionUser: SessionUserDto, @Param('idPurchase') idPurchase: string) {
    console.log('idPurchase - controller', idPurchase);
    const receptionInfo = await this.receptionsService.findOrCreateReceptionByIdPurchase(
      sessionUser.tenant_id,
      idPurchase,
      sessionUser.sub);
    const colors = await this.receptionsService.getColors(sessionUser.tenant_id);
    const characteristics = await this.receptionsService.getCharacteristics(sessionUser.tenant_id);
    const receptionResponseDto = ReceptionResponseDto.toResponseDto(receptionInfo, colors, characteristics);
    return receptionResponseDto;
  }

  @Post('receive-cattle')
  @ApiOperation({ summary: 'Receive cattle to a reception' })
  @HttpCode(HttpStatus.OK)
  @ApiResponse({ status: 200, description: 'Cattle received successfully', type: ReceiveCattleResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid request body' })
  @RequireAction('create')
  @ApiBody({
    type: ReceiveCattleRequestDto,
    examples: {
      'ReceiveCattleRequestDto': {
        value: {
          number: 'C-001',
          receivedWeight: 250.5,
          idPurchase: 'uuid-purchase-123',
          purchaseWeight: 254.0,
          purchasePrice: 1900000,
          idLot: 'uuid-lot-456', // Optional
          idBrand: 'uuid-brand-789', // Optional
          idColor: 'uuid-color-101', // Optional
          characteristicsIds: ['uuid-char-1', 'uuid-char-2'], // Optional
          eartag: 'ET-12345', // Optional
          idDevice: 'uuid-device-999', // Optional
          castrated: true, // Optional
          hasHorn: true, // Optional
          comments: 'Initial reception check completed.', // Optional
          idProvider: 'uuid-provider-123', // Optional
          idSimpleEvents: ['uuid-simple-event-1', 'uuid-simple-event-2'] // Optional
        }
      }
    }
  })
  async receiveCattle(@SessionUser() sessionUser: SessionUserDto, @Body() dto: ReceiveCattleRequestDto): Promise<ReceiveCattleResponseDto> {
    console.log('dto - controller', dto);
    return this.receptionsService.receiveCattle_Transaction(
      sessionUser.tenant_id,
      sessionUser.sub,
      dto);
  }

  @Patch('assign-lot-cattle')
  @ApiOperation({ summary: 'Assign a lot to a cattle' })
  @HttpCode(HttpStatus.OK)
  @ApiResponse({ status: 200, description: 'Cattle updated successfully', type: Cattle })
  @ApiResponse({ status: 400, description: 'Invalid request body' })
  @RequireAction('update')
  @ApiBody({
    type: UpdateLotCattleRequestDto,
    examples: {
      'UpdateLotCattleRequestDto': {
        value: {
          idCattle: 'uuid-cattle-123',
          idLot: 'uuid-lot-456',
        }
      }
    }
  })
  async assignLotCattle(@SessionUser() sessionUser: SessionUserDto, @Body() dto: UpdateLotCattleRequestDto): Promise<Cattle> {
    return this.receptionsService.assignLotCattle(
      sessionUser.tenant_id,
      dto);
  }
}