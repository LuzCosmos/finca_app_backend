import { LocationService } from './location.service';
import { LocationRepository } from '../repositories/location.repository';

describe('LocationService', () => {
  let service: LocationService;
  let locationRepository: {
    findLatestByCattle: jest.Mock;
    findLatestByDevice: jest.Mock;
    findLatestPerCattleForTenant: jest.Mock;
    findOne: jest.Mock;
    delete: jest.Mock;
    createLocation: jest.Mock;
  };

  beforeEach(() => {
    locationRepository = {
      findLatestByCattle: jest.fn(),
      findLatestByDevice: jest.fn(),
      findLatestPerCattleForTenant: jest.fn(),
      findOne: jest.fn(),
      delete: jest.fn(),
      createLocation: jest.fn(),
    };

    service = new LocationService(locationRepository as unknown as LocationRepository);
  });

  it('findLatestPerCattleForTenant delega en el repositorio', async () => {
    locationRepository.findLatestPerCattleForTenant.mockResolvedValue([{ cattle_number: '1' }]);
    const out = await service.findLatestPerCattleForTenant('tenant-1');
    expect(out).toEqual([{ cattle_number: '1' }]);
    expect(locationRepository.findLatestPerCattleForTenant).toHaveBeenCalledWith('tenant-1');
  });
});

