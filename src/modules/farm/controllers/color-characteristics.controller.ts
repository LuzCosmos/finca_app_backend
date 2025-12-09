import { Post, Get, Body } from "@nestjs/common";
import { ApiTags, ApiBearerAuth, ApiBody, ApiOperation, ApiResponse } from "@nestjs/swagger";
import { HttpCode, HttpStatus, UseGuards } from "@nestjs/common";
import { RequireModule } from "src/common/application-permissions/application-permissions.decorator";
import { Controller } from "@nestjs/common";
import { RequireEntity } from "src/common/application-permissions/application-permissions.decorator";
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { ApplicationPermissionsGuard } from 'src/common/application-permissions/application-permissions.guard';
import { SessionUser } from 'src/common/decorators/session-user.decorator';
import { SessionUserDto } from 'src/modules/auth/dto/session-user.dto';
import { CreateColorDto, ColorResponseDto, CreateCharacteristicDto, CharacteristicResponseDto } from "../dto/color-characteristic.dto";
import { RequireAction } from "src/common/application-permissions/application-permissions.decorator";
import { ColorCharacteristicsService } from "../services/color-characteristics.service";

@ApiTags('Color-Characteristics')
@ApiBearerAuth('access-token')
@Controller('color-characteristics')
@RequireEntity('cattles')
@RequireModule('FARM')
@UseGuards(JwtAuthGuard, ApplicationPermissionsGuard)
export class ColorCharacteristicsController {
    constructor(
        private readonly colorCharacteristicsService: ColorCharacteristicsService,
    ) { }

    @Post('color')
    @ApiOperation({ summary: 'Create a new color' })
    @HttpCode(HttpStatus.CREATED)
    @ApiResponse({ status: 201, description: 'Color created successfully', type: ColorResponseDto })
    @ApiResponse({ status: 400, description: 'Invalid request body' })
    @RequireAction('create')
    @ApiBody({
        type: CreateColorDto, description: 'Color to create', required: true, examples: {
            example1: {
                summary: 'Basic color creation',
                value: { name: 'Black' },
            },
            example2: {
                summary: 'Another color',
                value: { name: 'White' },
            },
        }
    })
    createColor(@SessionUser() sessionUser: SessionUserDto, @Body() dto: CreateColorDto) {
        console.log(dto);
        return this.colorCharacteristicsService.createColor(sessionUser.tenant_id, dto);
    }

    @Get('color')
    @ApiOperation({ summary: 'Get all colors' })
    @HttpCode(HttpStatus.OK)
    @ApiResponse({ status: 200, description: 'Colors retrieved successfully', type: ColorResponseDto })
    @ApiResponse({ status: 400, description: 'Invalid request body' })
    @RequireAction('read')
    getAllColors(@SessionUser() sessionUser: SessionUserDto) {
        return this.colorCharacteristicsService.getAllColors(sessionUser.tenant_id);
    }

    @Post('characteristic')
    @ApiOperation({ summary: 'Create a new characteristic' })
    @HttpCode(HttpStatus.CREATED)
    @ApiResponse({ status: 201, description: 'Characteristic created successfully', type: CharacteristicResponseDto })
    @ApiResponse({ status: 400, description: 'Invalid request body' })
    @RequireAction('create')
    @ApiBody({
        type: CreateCharacteristicDto, description: 'Characteristic to create', required: true, examples: {
            example1: {
                summary: 'Basic characteristic creation',
                value: { name: 'White belly' },
            },
            example2: {
                summary: 'Another characteristic',
                value: { name: 'White spot on head' },
            },
        }
    })
    createCharacteristic(@SessionUser() sessionUser: SessionUserDto, @Body() dto: CreateCharacteristicDto) {
        return this.colorCharacteristicsService.createCharacteristic(sessionUser.tenant_id, dto);
    }

    @Get('characteristic')
    @ApiOperation({ summary: 'Get all characteristics' })
    @HttpCode(HttpStatus.OK)
    @ApiResponse({ status: 200, description: 'Characteristics retrieved successfully', type: CharacteristicResponseDto })
    @ApiResponse({ status: 400, description: 'Invalid request body' })
    @RequireAction('read')
    getAllCharacteristics(@SessionUser() sessionUser: SessionUserDto) {
        return this.colorCharacteristicsService.getAllCharacteristics(sessionUser.tenant_id);
    }

}