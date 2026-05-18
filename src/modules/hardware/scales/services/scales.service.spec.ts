import { NotFoundException } from '@nestjs/common';
import { ScalesService } from './scales.service';

describe('ScalesService', () => {
  let service: ScalesService;

  beforeEach(() => {
    service = new ScalesService();
  });

  const baseDto = {
    tenantId: '11111111-1111-1111-1111-111111111111',
    weight: 350,
    unit: 'kg',
    isStable: false,
    observedAt: new Date().toISOString(),
    sequence: 1,
  };

  it('ignores ingest when no active frontend session', () => {
    const reading = service.ingestReading('scale-1', {
      ...baseDto,
      tenantId: undefined,
    });
    expect(reading).toBeNull();
  });

  it('ingests reading after bindActiveSession', () => {
    service.bindActiveSession('scale-1', baseDto.tenantId);
    const reading = service.ingestReading('scale-1', {
      ...baseDto,
      tenantId: undefined,
    });
    expect(reading?.weight).toBe(350);
  });

  it('ingests reading and updates latest', () => {
    service.bindActiveSession('scale-1', baseDto.tenantId);
    const reading = service.ingestReading('scale-1', baseDto);
    expect(reading).not.toBeNull();
    expect(reading!.weight).toBe(350);
    const status = service.getStatus(baseDto.tenantId, 'scale-1');
    expect(status.status).toBe('connected');
    expect(service.getLatestReading(baseDto.tenantId, 'scale-1').sequence).toBe(1);
  });

  it('stores latest stable only when isStable and weight > 0', () => {
    service.bindActiveSession('scale-1', baseDto.tenantId);
    service.ingestReading('scale-1', { ...baseDto, isStable: false, sequence: 1 });
    expect(() =>
      service.getLatestStableReading(baseDto.tenantId, 'scale-1'),
    ).toThrow(NotFoundException);

    service.ingestReading('scale-1', {
      ...baseDto,
      isStable: true,
      weight: 351,
      sequence: 2,
    });
    expect(
      service.getLatestStableReading(baseDto.tenantId, 'scale-1').weight,
    ).toBe(351);
  });

  it('isolates tenants', () => {
    const tenantB = '22222222-2222-2222-2222-222222222222';
    service.bindActiveSession('scale-1', baseDto.tenantId);
    service.ingestReading('scale-1', {
      ...baseDto,
      isStable: true,
      sequence: 1,
    });
    expect(() => service.getLatestStableReading(tenantB, 'scale-1')).toThrow(
      NotFoundException,
    );
  });
});
