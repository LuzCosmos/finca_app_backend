import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MassiveEvent } from './entities/massive-events.entity';
import { SimpleEvent } from './entities/simple-event.entity';
import { SimpleEventCattle } from './entities/simple-event-cattle.entity';
import { MassiveEventRepository } from './repositories/massive-event.repository';
import { SimpleEventRepository } from './repositories/simple-event.repository';
import { SimpleEventCattleRepository } from './repositories/simple-event-cattle.repository';
import { MassiveEventService } from './services/massive-event.service';
import { SimpleEventService } from './services/simple-event.service';
import { MassiveEventController } from './controllers/massive-event.controller';
import { SimpleEventController } from './controllers/simple-event.controller';
import { FarmModule } from '../farm/farm.module';
import { ApplicationPermissionsModule } from '../../common/application-permissions/application-permissions.module';


@Module({
  imports: [forwardRef(() => FarmModule), ApplicationPermissionsModule, TypeOrmModule.forFeature([MassiveEvent, SimpleEvent, SimpleEventCattle])],
  controllers: [MassiveEventController, SimpleEventController],
  providers: [
    MassiveEventRepository,
    SimpleEventRepository,
    SimpleEventCattleRepository,
    MassiveEventService,
    SimpleEventService
  ],
  exports: [MassiveEventService, SimpleEventService,SimpleEventCattleRepository],
})
export class MassiveEventsModule {}
