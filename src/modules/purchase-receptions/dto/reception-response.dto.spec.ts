import { CattleReceptionResponseDto } from './reception-response.dto';
import { Cattle, CattleStatus } from '../../farm/entities/cattle.entity';
import { CattleGender } from '../../farm/enums/cattle-gender.enum';
import { CattleColor } from '../../farm/enums/cattle-color.enum';
import { BirthDateAprxSource } from '../../farm/enums/birth-date-aprx-source.enum';

describe('CattleReceptionResponseDto', () => {
  it('mapea campos editables para precargar diálogo de corrección', () => {
    const birth = new Date('2020-03-15T12:00:00.000Z');
    const dental = new Date('2025-01-20T12:00:00.000Z');
    const entity = {
      id: 'c-1',
      number: '42',
      sysNumber: '1001',
      receivedWeight: 355,
      idDevice: 'dev-1',
      device: { name: 'Tracker A' },
      eartagLeft: 'EL',
      eartagRight: 'ER',
      idLot: 'lot-9',
      color: CattleColor.BROWN,
      comments: 'obs',
      hasHorn: true,
      castrated: false,
      gender: CattleGender.FEMALE,
      cattleCharacteristics: [{ characteristic: 'SPOTTED' }],
      birthDateAprx: birth,
      birthDateAprxSource: BirthDateAprxSource.MANUAL,
      milkTeethCount: null,
      permanentTeethCount: null,
      milkTeethWear: null,
      permanentTeethWear: null,
      dentalEvaluationDate: dental,
      status: CattleStatus.ACTIVE,
    } as unknown as Cattle;

    const dto = CattleReceptionResponseDto.toResponseDto(entity, []);

    expect(dto.id).toBe('c-1');
    expect(dto.idLot).toBe('lot-9');
    expect(dto.hasHorn).toBe(true);
    expect(dto.castrated).toBe(false);
    expect(dto.gender).toBe(CattleGender.FEMALE);
    expect(dto.characteristics).toEqual(['SPOTTED']);
    expect(dto.birthDateAprx).toBe('2020-03-15');
    expect(dto.dentalEvaluationDate).toBe('2025-01-20');
    expect(dto.deviceName).toBe('Tracker A');
    expect(dto.appliedEvents).toEqual([]);
  });

  it('formatea fechas cuando vienen como string desde la BD', () => {
    const entity = {
      id: 'c-str',
      number: '99',
      sysNumber: '2001',
      receivedWeight: 310,
      idDevice: null,
      device: undefined,
      eartagLeft: null,
      eartagRight: null,
      idLot: 'lot-1',
      color: CattleColor.BLACK,
      comments: null,
      hasHorn: false,
      castrated: false,
      gender: CattleGender.MALE,
      cattleCharacteristics: [],
      birthDateAprx: '2019-06-01',
      dentalEvaluationDate: '2025-02-10',
      milkTeethCount: null,
      permanentTeethCount: null,
      milkTeethWear: null,
      permanentTeethWear: null,
    } as unknown as Cattle;

    const dto = CattleReceptionResponseDto.toResponseDto(entity, []);

    expect(dto.birthDateAprx).toBe('2019-06-01');
    expect(dto.dentalEvaluationDate).toBe('2025-02-10');
  });

  it('omite campos opcionales cuando son null', () => {
    const entity = {
      id: 'c-2',
      number: '43',
      sysNumber: '1002',
      receivedWeight: 300,
      idDevice: null,
      device: undefined,
      eartagLeft: null,
      eartagRight: null,
      idLot: null,
      color: CattleColor.WHITE,
      comments: null,
      hasHorn: false,
      castrated: false,
      gender: CattleGender.MALE,
      cattleCharacteristics: [],
      birthDateAprx: null,
      milkTeethCount: null,
      permanentTeethCount: null,
      milkTeethWear: null,
      permanentTeethWear: null,
      dentalEvaluationDate: null,
    } as unknown as Cattle;

    const dto = CattleReceptionResponseDto.toResponseDto(entity, []);

    expect(dto.idLot).toBeUndefined();
    expect(dto.birthDateAprx).toBeUndefined();
    expect(dto.characteristics).toEqual([]);
    expect(dto.deviceName).toBe('-');
  });
});
