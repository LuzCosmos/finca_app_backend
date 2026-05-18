import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import * as XLSX from 'xlsx';
import { promises as fs } from 'fs';
import { DevicesService } from './devices.service';
import { DeviceRepository } from '../repositories/device.repository';
import { DeviceProfileRepository } from '../repositories/device-profile.repository';
import { DeviceProfile } from '../entities/device-profile.entity';
import { ImportLw001Reason } from '../import-lw001/import-lw001.constants';

function buildImportFile(
  rows: (string | number)[][],
  format: 'xlsx' | 'xls' | 'csv',
): Express.Multer.File {
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, 'Sheet1');
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: format }) as Buffer;
  const path = `/tmp/lw001-import-test-${Date.now()}-${Math.random()}.${format}`;
  return {
    path,
    buffer,
    originalname: `import.${format}`,
    mimetype: 'application/octet-stream',
  } as Express.Multer.File;
}

function mockFileBuffer(
  file: Express.Multer.File,
  rows: (string | number)[][],
  format: 'xlsx' | 'xls' | 'csv',
): void {
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, 'Sheet1');
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: format }) as Buffer;
  jest.spyOn(fs, 'readFile').mockResolvedValue(buffer);
}

describe('DevicesService.importDevicesFromExcel (LW001)', () => {
  let service: DevicesService;
  const deviceRepository = {
    findOptionalByDevEuiAndTenantId: jest.fn(),
    findOptionalByNameAndTenantId: jest.fn(),
  };
  const deviceProfileRepository = {
    findOptionalByIdAndTenant: jest.fn(),
    findOne: jest.fn(),
  };

  const profileId = '11111111-1111-4111-8111-111111111111';
  const tenantId = '22222222-2222-4222-8222-222222222222';
  const profile: DeviceProfile = {
    id: profileId,
    idTenant: tenantId,
    name: 'LW001 Profile',
    csApplicationId: 'app-id',
    csJoineui: '0000000000000001',
    csAppKey: 'a'.repeat(32),
    csNwkKey: 'b'.repeat(32),
    idChipstack: 'chipstack-profile',
  } as DeviceProfile;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DevicesService,
        { provide: DeviceRepository, useValue: deviceRepository },
        { provide: DeviceProfileRepository, useValue: deviceProfileRepository },
        { provide: HttpService, useValue: { axiosRef: {} } },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) =>
              key === 'CHIRPSTACK_API_URL'
                ? 'http://chirpstack.test'
                : 'token',
          },
        },
      ],
    }).compile();

    service = module.get(DevicesService);
    deviceProfileRepository.findOptionalByIdAndTenant.mockReset();
    deviceProfileRepository.findOptionalByIdAndTenant.mockResolvedValue(profile);
    deviceRepository.findOptionalByDevEuiAndTenantId.mockReset();
    deviceRepository.findOptionalByDevEuiAndTenantId.mockResolvedValue(null);
    deviceRepository.findOptionalByNameAndTenantId.mockReset();
    deviceRepository.findOptionalByNameAndTenantId.mockResolvedValue(null);
    deviceRepository.findOptionalByNameAndTenantId.mockResolvedValue(null);
    jest.spyOn(fs, 'readFile').mockImplementation(async () => Buffer.from(''));
    jest.spyOn(fs, 'unlink').mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('rejects legacy headers with IMPORT_HEADERS_INVALID', async () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([
        ['devEui', 'deviceName', 'idDeviceProfile', 'joineui'],
        ['0102030405060708', 'name', profileId, ''],
      ]),
      'Sheet1',
    );
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
    jest.spyOn(fs, 'readFile').mockResolvedValue(buffer);

    await expect(
      service.importDevicesFromExcel(
        { path: '/tmp/legacy.xlsx', originalname: 'legacy.xlsx' } as Express.Multer.File,
        tenantId,
        profileId,
      ),
    ).rejects.toMatchObject({
      response: { message: ImportLw001Reason.IMPORT_HEADERS_INVALID },
    });
  });

  it('requires deviceProfileId when a row has empty column B', async () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([
        ['devEui', 'idDeviceProfile', 'joineui', 'appKey'],
        ['0102030405060708', '', '', ''],
      ]),
      'Sheet1',
    );
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
    jest.spyOn(fs, 'readFile').mockResolvedValue(buffer);

    await expect(
      service.importDevicesFromExcel(
        { path: '/tmp/x.xlsx', originalname: 'x.xlsx' } as Express.Multer.File,
        tenantId,
        undefined,
      ),
    ).rejects.toMatchObject({
      response: { message: ImportLw001Reason.DEVICE_PROFILE_ID_REQUIRED },
    });
  });

  it('happy path creates device via createDevice', async () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([
        ['devEui', 'idDeviceProfile', 'joineui', 'appKey'],
        ['0102030405060708', '', '', ''],
      ]),
      'Sheet1',
    );
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
    jest.spyOn(fs, 'readFile').mockResolvedValue(buffer);
    const createDeviceSpy = jest
      .spyOn(service, 'createDevice')
      .mockResolvedValue({ id: 'dev-1', deveui: '0102030405060708' } as never);

    const result = await service.importDevicesFromExcel(
      { path: '/tmp/x.xlsx', originalname: 'x.xlsx' } as Express.Multer.File,
      tenantId,
      profileId,
    );

    expect(result.totalRows).toBe(1);
    expect(result.created).toBe(1);
    expect(result.errors).toHaveLength(0);
    expect(createDeviceSpy).toHaveBeenCalled();
  });

  it('flags invalid deveui length per row', async () => {
    mockFileBuffer(
      buildImportFile([], 'xlsx'),
      [
        ['devEui', 'idDeviceProfile', 'joineui', 'appKey'],
        ['0102', '', '', ''],
      ],
      'xlsx',
    );

    const result = await service.importDevicesFromExcel(
      buildImportFile([], 'xlsx'),
      tenantId,
      profileId,
    );

    expect(result.created).toBe(0);
    expect(result.errors[0].reason).toBe(ImportLw001Reason.DEVEUI_INVALID_LENGTH);
  });

  it.each(['xls', 'csv'] as const)('happy path parses .%s file', async (format) => {
    mockFileBuffer(
      buildImportFile([], format),
      [
        ['devEui', 'idDeviceProfile', 'joineui', 'appKey'],
        ['0102030405060708', '', '', ''],
      ],
      format,
    );
    jest.spyOn(service, 'createDevice').mockResolvedValue({ id: 'dev-1' } as never);

    const result = await service.importDevicesFromExcel(
      buildImportFile([], format),
      tenantId,
      profileId,
    );

    expect(result.totalRows).toBe(1);
    expect(result.created).toBe(1);
    expect(result.errors).toHaveLength(0);
  });

  it('succeeds without multipart when every row has valid profile in column B', async () => {
    mockFileBuffer(
      buildImportFile([], 'xlsx'),
      [
        ['devEui', 'idDeviceProfile', 'joineui', 'appKey'],
        ['0102030405060708', profileId, '', ''],
        ['AABBCCDDEEFF0011', profileId, '', ''],
      ],
      'xlsx',
    );
    jest.spyOn(service, 'createDevice').mockResolvedValue({ id: 'dev-1' } as never);

    const result = await service.importDevicesFromExcel(
      buildImportFile([], 'xlsx'),
      tenantId,
      undefined,
    );

    expect(result.totalRows).toBe(2);
    expect(result.created).toBe(2);
    expect(result.errors).toHaveLength(0);
  });

  it('flags APP_KEY_SCIENTIFIC_NOTATION per row', async () => {
    mockFileBuffer(
      buildImportFile([], 'xlsx'),
      [
        ['devEui', 'idDeviceProfile', 'joineui', 'appKey'],
        ['0102030405060708', '', '', '1.23E+32'],
      ],
      'xlsx',
    );

    const result = await service.importDevicesFromExcel(
      buildImportFile([], 'xlsx'),
      tenantId,
      profileId,
    );

    expect(result.errors[0].reason).toBe(ImportLw001Reason.APP_KEY_SCIENTIFIC_NOTATION);
  });

  it('flags DEVICE_PROFILE_ID_INVALID for unknown profile in column B', async () => {
    deviceProfileRepository.findOptionalByIdAndTenant.mockResolvedValue(null);
    mockFileBuffer(
      buildImportFile([], 'xlsx'),
      [
        ['devEui', 'idDeviceProfile', 'joineui', 'appKey'],
        ['0102030405060708', profileId, '', ''],
      ],
      'xlsx',
    );

    const result = await service.importDevicesFromExcel(
      buildImportFile([], 'xlsx'),
      tenantId,
      undefined,
    );

    expect(result.errors[0].reason).toBe(ImportLw001Reason.DEVICE_PROFILE_ID_INVALID);
  });

  it('partial import: valid row creates, invalid row errors', async () => {
    mockFileBuffer(
      buildImportFile([], 'xlsx'),
      [
        ['devEui', 'idDeviceProfile', 'joineui', 'appKey'],
        ['0102030405060708', '', '', ''],
        ['0102', '', '', ''],
      ],
      'xlsx',
    );
    const createDeviceSpy = jest
      .spyOn(service, 'createDevice')
      .mockResolvedValue({ id: 'dev-1' } as never);

    const result = await service.importDevicesFromExcel(
      buildImportFile([], 'xlsx'),
      tenantId,
      profileId,
    );

    expect(result.created).toBe(1);
    expect(result.errors).toHaveLength(1);
    expect(createDeviceSpy).toHaveBeenCalledTimes(1);
  });

  it('duplicate deveui in file updates second row and warns', async () => {
    const deveui = '0102030405060708';
    deviceRepository.findOptionalByDevEuiAndTenantId
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValue({ id: 'dev-1', deveui } as never);
    jest.spyOn(service, 'createDevice').mockResolvedValue({ id: 'dev-1', deveui } as never);
    jest.spyOn(service, 'updateWithDevice').mockResolvedValue({ id: 'dev-1', deveui } as never);
    mockFileBuffer(
      buildImportFile([], 'xlsx'),
      [
        ['devEui', 'idDeviceProfile', 'joineui', 'appKey'],
        [deveui, '', '', ''],
        [deveui, '', '', ''],
      ],
      'xlsx',
    );

    const result = await service.importDevicesFromExcel(
      buildImportFile([], 'xlsx'),
      tenantId,
      profileId,
    );

    expect(result.created).toBe(1);
    expect(result.updated).toBe(1);
    expect(result.duplicateDeveuisInFile).toContain(deveui);
    expect(result.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          reason: ImportLw001Reason.DEVEUI_DUPLICATE_IN_FILE_UPDATED,
        }),
      ]),
    );
  });

  it('inherits joineui and appKey from row device profile when column B is set and C/D empty', async () => {
    const rowProfileId = '33333333-3333-4333-8333-333333333333';
    const dropdownProfileId = profileId;
    const rowProfile: DeviceProfile = {
      ...profile,
      id: rowProfileId,
      csJoineui: '2222222222222222',
      csAppKey: 'd'.repeat(32),
    } as DeviceProfile;

    deviceProfileRepository.findOptionalByIdAndTenant.mockImplementation(
      async (id: string) => {
        if (id === rowProfileId) {
          return rowProfile;
        }
        if (id === dropdownProfileId) {
          return profile;
        }
        return null;
      },
    );

    mockFileBuffer(
      buildImportFile([], 'xlsx'),
      [
        ['devEui', 'idDeviceProfile', 'joineui', 'appKey'],
        ['0102030405060708', rowProfileId, '', ''],
      ],
      'xlsx',
    );
    const createDeviceSpy = jest
      .spyOn(service, 'createDevice')
      .mockResolvedValue({ id: 'dev-1', deveui: '0102030405060708' } as never);

    await service.importDevicesFromExcel(
      buildImportFile([], 'xlsx'),
      tenantId,
      dropdownProfileId,
    );

    expect(createDeviceSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        idDeviceProfile: rowProfileId,
        csJoineui: rowProfile.csJoineui,
        csAppKey: rowProfile.csAppKey,
      }),
      rowProfile,
      expect.anything(),
      expect.objectContaining({
        appKey: rowProfile.csAppKey,
        nwkKey: rowProfile.csNwkKey,
      }),
    );
  });

  it('inherits joineui and appKey from dropdown profile when column B is empty', async () => {
    mockFileBuffer(
      buildImportFile([], 'xlsx'),
      [
        ['devEui', 'idDeviceProfile', 'joineui', 'appKey'],
        ['0102030405060708', '', '', ''],
      ],
      'xlsx',
    );
    const createDeviceSpy = jest
      .spyOn(service, 'createDevice')
      .mockResolvedValue({ id: 'dev-1', deveui: '0102030405060708' } as never);

    await service.importDevicesFromExcel(
      buildImportFile([], 'xlsx'),
      tenantId,
      profileId,
    );

    expect(createDeviceSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        idDeviceProfile: profileId,
        csJoineui: profile.csJoineui,
        csAppKey: profile.csAppKey,
      }),
      profile,
      expect.anything(),
      expect.objectContaining({
        appKey: profile.csAppKey,
        nwkKey: profile.csNwkKey,
      }),
    );
  });

  it('uses row joineui and appKey when provided instead of profile defaults', async () => {
    const rowJoin = '1111111111111111';
    const rowAppKey = 'f'.repeat(32);
    mockFileBuffer(
      buildImportFile([], 'xlsx'),
      [
        ['devEui', 'idDeviceProfile', 'joineui', 'appKey'],
        ['0102030405060708', '', rowJoin, rowAppKey],
      ],
      'xlsx',
    );
    const createDeviceSpy = jest
      .spyOn(service, 'createDevice')
      .mockResolvedValue({ id: 'dev-1' } as never);

    const result = await service.importDevicesFromExcel(
      buildImportFile([], 'xlsx'),
      tenantId,
      profileId,
    );

    expect(result.errors).toHaveLength(0);
    expect(result.created).toBe(1);
    expect(createDeviceSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        csJoineui: rowJoin,
        csAppKey: rowAppKey,
      }),
      profile,
      expect.anything(),
      expect.objectContaining({ appKey: rowAppKey }),
    );
  });

  it('existing deveui in tenant updates with DEVEUI_ALREADY_EXISTS_UPDATED warning', async () => {
    const deveui = '0102030405060708';
    deviceRepository.findOptionalByDevEuiAndTenantId.mockResolvedValue({
      id: 'dev-existing',
      deveui,
    } as never);
    jest.spyOn(service, 'updateWithDevice').mockResolvedValue({ id: 'dev-existing', deveui } as never);
    mockFileBuffer(
      buildImportFile([], 'xlsx'),
      [
        ['devEui', 'idDeviceProfile', 'joineui', 'appKey'],
        [deveui, '', '', ''],
      ],
      'xlsx',
    );

    const result = await service.importDevicesFromExcel(
      buildImportFile([], 'xlsx'),
      tenantId,
      profileId,
    );

    expect(result.created).toBe(0);
    expect(result.updated).toBe(1);
    expect(result.warnings[0].reason).toBe(ImportLw001Reason.DEVEUI_ALREADY_EXISTS_UPDATED);
  });
});
