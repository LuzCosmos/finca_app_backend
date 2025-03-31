import { SetMetadata } from '@nestjs/common';
import { ModuleAction } from '../types/module-action.type';

export const REQUIRE_ACTION_KEY = 'requireAction';

export const RequireAction = (action: ModuleAction) => SetMetadata(REQUIRE_ACTION_KEY, action); 