import { Body, Controller, Post, Get, Put, Param, Query, UseGuards } from '@nestjs/common';
import { SalesService } from '../services/sales.service';
import { CreateSaleDto } from '../dto/create-sale.dto';
import { GetSalesQueryDto } from '../dto/get-sales-query.dto';
import { UpdateSaleDto } from '../dto/update-sale.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { SessionUser } from '../../../common/decorators/session-user.decorator';
import { SessionUserDto } from '../../auth/dto/session-user.dto';
import { ApplicationPermissionsGuard } from '../../../common/application-permissions/application-permissions.guard';
import { RequireEntity, RequireModule, RequireAction } from '../../../common/application-permissions/application-permissions.decorator';
import { PaginatedResponseDto } from '../../../common/dto/paginated-response.dto';
import { Sale } from '../entities/sale.entity';

@Controller('sales')
@RequireEntity('sales')
@RequireModule('COMMERCE')
@UseGuards(JwtAuthGuard, ApplicationPermissionsGuard)
export class SalesController {
    constructor(private readonly salesService: SalesService) { }

    @Post()
    @RequireAction('create')
    async create(@Body() createSaleDto: CreateSaleDto, @SessionUser() user: SessionUserDto) {
        // Inject tenant and creator from authenticated user
        createSaleDto.idTenant = user.tenant_id;
        createSaleDto.createdBy = user.sub;

        return await this.salesService.createSale(createSaleDto);
    }


    @Get()
    @RequireAction('read')
    async findAll(@Query() query: GetSalesQueryDto, @SessionUser() user: SessionUserDto): Promise<PaginatedResponseDto<Sale>> {
        return await this.salesService.findAll(user.tenant_id, query);
    }

    @Get(':id')
    @RequireAction('read')
    async findOne(@Param('id') id: string, @SessionUser() user: SessionUserDto) {
        return await this.salesService.findOne(user.tenant_id, id);
    }

    @Put(':id')
    @RequireAction('update')
    async update(@Param('id') id: string, @Body() updateSaleDto: UpdateSaleDto, @SessionUser() user: SessionUserDto) {
        return await this.salesService.update(user.tenant_id, id, updateSaleDto);
    }
}
