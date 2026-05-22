import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PostScaleReadingDto } from './post-scale-reading.dto';

describe('PostScaleReadingDto', () => {
  it('rejects invalid observedAt and negative sequence', async () => {
    const dto = plainToInstance(PostScaleReadingDto, {
      isStable: true,
      observedAt: 'not-a-date',
      sequence: -1,
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('accepts minimal valid payload', async () => {
    const dto = plainToInstance(PostScaleReadingDto, {
      isStable: false,
      observedAt: new Date().toISOString(),
      sequence: 1,
      weight: 350,
      unit: 'kg',
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });
});
