import { DataSource } from 'typeorm';
import { LocationRepository } from './location.repository';

type MockQueryBuilder = {
  subQuery: jest.Mock;
  select: jest.Mock;
  addSelect: jest.Mock;
  from: jest.Mock;
  where: jest.Mock;
  groupBy: jest.Mock;
  getQuery: jest.Mock;
  innerJoin: jest.Mock;
  orderBy: jest.Mock;
  getRawMany: jest.Mock;
};

function createMockQueryBuilder(): MockQueryBuilder {
  const qb: MockQueryBuilder = {
    subQuery: jest.fn(),
    select: jest.fn(),
    addSelect: jest.fn(),
    from: jest.fn(),
    where: jest.fn(),
    groupBy: jest.fn(),
    getQuery: jest.fn(),
    innerJoin: jest.fn(),
    orderBy: jest.fn(),
    getRawMany: jest.fn(),
  };
  qb.subQuery.mockReturnValue(qb);
  qb.select.mockReturnValue(qb);
  qb.addSelect.mockReturnValue(qb);
  qb.from.mockReturnValue(qb);
  qb.where.mockReturnValue(qb);
  qb.groupBy.mockReturnValue(qb);
  qb.innerJoin.mockReturnValue(qb);
  qb.orderBy.mockReturnValue(qb);
  return qb;
}

describe('LocationRepository', () => {
  let repository: LocationRepository;
  let dataSource: { createEntityManager: jest.Mock };

  beforeEach(() => {
    dataSource = { createEntityManager: jest.fn().mockReturnValue({}) };
    repository = new LocationRepository(dataSource as unknown as DataSource);
  });

  it('findLatestPerCattleForTenant retorna 1 fila por id_cattle y usa MAX(time)', async () => {
    const subQb = createMockQueryBuilder();
    const mainQb = createMockQueryBuilder();

    subQb.getQuery.mockReturnValue('SELECT l.id_cattle, MAX(l.time) AS max_time FROM location l');

    const rawRows = [
      {
        id: 'loc-1',
        id_tenant: 'tenant-1',
        id_device: 'dev-1',
        id_cattle: 'cattle-1',
        latitude: 4.7,
        longitude: -74.1,
        altitude: 10,
        time: new Date('2026-05-01T12:00:00.000Z'),
        cattle_number: '101',
      },
      {
        id: 'loc-2',
        id_tenant: 'tenant-1',
        id_device: 'dev-2',
        id_cattle: 'cattle-2',
        latitude: 4.71,
        longitude: -74.11,
        altitude: null,
        time: new Date('2026-05-01T11:00:00.000Z'),
        cattle_number: '102',
      },
    ];
    mainQb.getRawMany.mockResolvedValue(rawRows);

    jest
      .spyOn(repository, 'createQueryBuilder')
      .mockReturnValueOnce(subQb as never)
      .mockReturnValueOnce(mainQb as never);

    const result = await repository.findLatestPerCattleForTenant('tenant-1');

    expect(subQb.addSelect).toHaveBeenCalledWith('MAX(l.time)', 'max_time');
    expect(subQb.groupBy).toHaveBeenCalledWith('l.id_cattle');
    expect(subQb.where).toHaveBeenCalledWith('l.id_tenant = :idTenant', { idTenant: 'tenant-1' });
    expect(mainQb.innerJoin).toHaveBeenCalledWith(
      expect.stringContaining('SELECT l.id_cattle'),
      'latest',
      'latest.id_cattle = location.id_cattle AND latest.max_time = location.time',
    );
    expect(mainQb.where).toHaveBeenCalledWith('location.id_tenant = :idTenant', {
      idTenant: 'tenant-1',
    });

    expect(result).toHaveLength(2);
    const cattleIds = result.map((r) => r.id_cattle);
    expect(new Set(cattleIds).size).toBe(cattleIds.length);
    expect(result[0].cattle_number).toBe('101');
    expect(result[1].cattle_number).toBe('102');
  });
});
