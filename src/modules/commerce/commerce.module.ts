import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { ApplicationPermissionsModule } from '../../common/application-permissions/application-permissions.module';
import { FarmModule } from '../farm/farm.module';
import { ProductionCenterModule } from '../production-center/production-center.module';

import { Contact } from './entities/contact.entity';
import { BusinessPartner } from './entities/business-partner.entity';
import { BusinessPartnerController } from './controllers/business-partner.controller';
import { BusinessPartnerService } from './services/business-partner.service';
import { BusinessPartnerRepository } from './repositories/business-partner.repository';

import { Purchase } from './entities/purchase.entity';
import { PurchaseController } from './controllers/purchase.controller';
import { PurchaseService } from './services/purchase.service';
import { PurchaseRepository } from './repositories/purchase.repository';

import { Lot } from './entities/lot.entity';
import { LotRepository } from './repositories/lot.repository';
import { LotController } from './controllers/lot.controller';
import { LotService } from './services/lot.service';

import { Sale } from './entities/sale.entity';
import { SaleDetail } from './entities/sale-detail.entity';
import { SalesController } from './controllers/sales.controller';
import { SalesService } from './services/sales.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Contact,
      BusinessPartner,
      Purchase,
      Lot,
      Sale,
      SaleDetail,
    ]),
    ConfigModule,
    ApplicationPermissionsModule,
    forwardRef(() => FarmModule),
    ProductionCenterModule,
  ],
  controllers: [LotController, BusinessPartnerController, PurchaseController, SalesController],
  providers: [
    BusinessPartnerService,
    BusinessPartnerRepository,
    PurchaseService,
    PurchaseRepository,
    LotRepository,
    LotService,
    SalesService,
  ],
  exports: [
    BusinessPartnerRepository,
    PurchaseRepository,
    LotRepository,
    LotService,
    PurchaseService,
    SalesService,
  ],
})
export class CommerceModule {}
