import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { ApplicationPermissionsGuard } from 'src/common/application-permissions/application-permissions.guard';
import {
  RequireAction,
  RequireEntity,
  RequireModule,
} from 'src/common/application-permissions/application-permissions.decorator';
import { SessionUser } from 'src/common/decorators/session-user.decorator';
import { SessionUserDto } from 'src/modules/auth/dto/session-user.dto';
import { ScaleBridgeAuthGuard } from '../../guards/scale-bridge-auth.guard';
import { PostScaleReadingDto } from '../dto/post-scale-reading.dto';
import { ScaleReadingResponseDto } from '../dto/scale-reading-response.dto';
import { ScaleStatusResponseDto } from '../dto/scale-status-response.dto';
import { ScalesService } from '../services/scales.service';

@ApiTags('Hardware Scales')
@Controller('hardware/scales')
export class ScalesController {
  constructor(private readonly scalesService: ScalesService) {}

  @Post(':scaleId/readings')
  @UseGuards(ScaleBridgeAuthGuard)
  @ApiOperation({ summary: 'Publicar lectura de pesa (scale bridge)' })
  @ApiResponse({ status: 202, type: ScaleReadingResponseDto })
  @ApiResponse({
    status: 204,
    description: 'Sin sesión activa de frontend para esta pesa; lectura descartada',
  })
  ingestReading(
    @Param('scaleId') scaleId: string,
    @Body() dto: PostScaleReadingDto,
    @Res({ passthrough: true }) res: Response,
  ): ScaleReadingResponseDto | void {
    const reading = this.scalesService.ingestReading(scaleId, dto);
    if (!reading) {
      res.status(HttpStatus.NO_CONTENT);
      return;
    }
    res.status(HttpStatus.ACCEPTED);
    return reading;
  }

  @Post(':scaleId/session')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, ApplicationPermissionsGuard)
  @RequireModule('FARM')
  @RequireEntity('cattle')
  @RequireAction('read')
  @ApiOperation({
    summary:
      'Activar sesión de pesa para el tenant del usuario (requerido antes de que el bridge enrute lecturas)',
  })
  @ApiResponse({ status: 204, description: 'Sesión activa registrada' })
  bindSession(
    @Param('scaleId') scaleId: string,
    @SessionUser() sessionUser: SessionUserDto,
  ): void {
    this.scalesService.bindActiveSession(scaleId, sessionUser.tenant_id);
  }

  @Get(':scaleId/status')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, ApplicationPermissionsGuard)
  @RequireModule('FARM')
  @RequireEntity('cattle')
  @RequireAction('read')
  @ApiOperation({ summary: 'Estado de conexión de la pesa' })
  @ApiResponse({ status: 200, type: ScaleStatusResponseDto })
  getStatus(
    @Param('scaleId') scaleId: string,
    @SessionUser() sessionUser: SessionUserDto,
  ): ScaleStatusResponseDto {
    return this.scalesService.getStatus(sessionUser.tenant_id, scaleId);
  }

  @Get(':scaleId/latest-reading')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, ApplicationPermissionsGuard)
  @RequireModule('FARM')
  @RequireEntity('cattle')
  @RequireAction('read')
  @ApiOperation({ summary: 'Última lectura de pesa' })
  @ApiResponse({ status: 200, type: ScaleReadingResponseDto })
  getLatestReading(
    @Param('scaleId') scaleId: string,
    @SessionUser() sessionUser: SessionUserDto,
  ): ScaleReadingResponseDto {
    return this.scalesService.getLatestReading(sessionUser.tenant_id, scaleId);
  }

  @Get(':scaleId/latest-stable-reading')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, ApplicationPermissionsGuard)
  @RequireModule('FARM')
  @RequireEntity('cattle')
  @RequireAction('read')
  @ApiOperation({ summary: 'Última lectura estable de pesa' })
  @ApiResponse({ status: 200, type: ScaleReadingResponseDto })
  getLatestStableReading(
    @Param('scaleId') scaleId: string,
    @SessionUser() sessionUser: SessionUserDto,
  ): ScaleReadingResponseDto {
    return this.scalesService.getLatestStableReading(
      sessionUser.tenant_id,
      scaleId,
    );
  }
}
