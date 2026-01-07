import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApplicationPermissionsModule } from '../../common/application-permissions/application-permissions.module';
import { CommerceModule } from '../commerce/commerce.module';
import { MassiveEventsModule } from '../massive-events/massive-events.module';
import { FarmModule } from '../farm/farm.module';
import { ConfigurationModule } from '../configurations/configuration.module';
import { PurchaseReception } from './entities/purchase-reception.entity';
import { PurchaseReceptionRepository } from './repositories/purchase-reception.repository';
import { ReceptionsService } from './services/receptions.service';
import { ReceptionController } from './controllers/purchase-reception.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([PurchaseReception]),
    ApplicationPermissionsModule,
    CommerceModule,
    MassiveEventsModule,
    FarmModule,
    ConfigurationModule,
  ],
  controllers: [ReceptionController],
  providers: [ReceptionsService, PurchaseReceptionRepository],
  exports: [ReceptionsService, PurchaseReceptionRepository],
})
export class ReceptionModule { }