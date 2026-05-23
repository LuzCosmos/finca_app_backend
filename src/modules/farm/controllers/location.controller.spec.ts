import { LocationController } from './location.controller';

describe('LocationController metadata', () => {
  it('latest cattle map endpoint uses cattle read permission', () => {
    const handler = LocationController.prototype.findLatestPerCattle;

    expect(Reflect.getMetadata('requireEntity', handler)).toBe('cattle');
    expect(Reflect.getMetadata('requireAction', handler)).toBe('read');
  });
});
