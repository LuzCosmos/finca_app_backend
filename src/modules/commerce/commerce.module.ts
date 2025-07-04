import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProviderController } from './controllers/provider.controller';
import { ProviderService } from './services/provider.service';
import { ProviderRepository } from './repositories/provider.repository';
import { Provider } from './entities/provider.entity';
import { Purchase } from './entities/purchase.entity';
import { Lot } from './entities/lot.entity';
import { ConfigModule } from '@nestjs/config';
import { ApplicationPermissionsModule } from '../auth/application-permissions/application-permissions.module';


@Module({
  imports: [
    TypeOrmModule.forFeature([
      Provider,
      Purchase,
      Lot,
    ]),
    ConfigModule,
    ApplicationPermissionsModule
  ],
  controllers: [ProviderController],
  providers: [ProviderService, ProviderRepository],
  exports: [],
})
export class CommerceModule {}
