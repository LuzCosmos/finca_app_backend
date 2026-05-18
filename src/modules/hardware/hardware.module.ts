import { Module } from '@nestjs/common';
import { ApplicationPermissionsModule } from '../../common/application-permissions/application-permissions.module';
import { ScalesController } from './scales/controllers/scales.controller';
import { ScalesService } from './scales/services/scales.service';
import { ScaleBridgeAuthGuard } from './guards/scale-bridge-auth.guard';

@Module({
  imports: [ApplicationPermissionsModule],
  controllers: [ScalesController],
  providers: [ScalesService, ScaleBridgeAuthGuard],
  exports: [ScalesService],
})
export class HardwareModule {}
