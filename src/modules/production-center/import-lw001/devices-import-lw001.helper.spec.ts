import { BadRequestException } from '@nestjs/common';
import * as XLSX from 'xlsx';
import {
  assertLw001SupportedExtension,
  assertLw001HeaderRowFromRaw,
  buildLw001DeviceName,
  isLw001CellEmpty,
  loadLw001ImportLayout,
  normalizeLw001Deveui,
  appKeyHasScientificNotation,
  resolveLw001AppKeyValue,
  resolveLw001JoinEuiValue,
} from './devices-import-lw001.helper';
import { ImportLw001Reason } from './import-lw001.constants';

function buildFileBuffer(
  rows: (string | number)[][],
  bookType: 'xlsx' | 'xls' | 'csv',
): Buffer {
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, 'Sheet1');
  return XLSX.write(workbook, { type: 'buffer', bookType }) as Buffer;
}

function buildXlsxBuffer(rows: (string | number)[][]): Buffer {
  return buildFileBuffer(rows, 'xlsx');
}

function buildMultiSheetXlsxBuffer(
  sheets: { name: string; rows: (string | number)[][] }[],
): Buffer {
  const workbook = XLSX.utils.book_new();
  for (const { name, rows } of sheets) {
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), name);
  }
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

describe('devices-import-lw001.helper', () => {
  it('rejects invalid header row', () => {
    expect(() =>
      assertLw001HeaderRowFromRaw(['devEui', 'wrong', 'joineui', 'appKey']),
    ).toThrow(BadRequestException);
    expect(() =>
      assertLw001HeaderRowFromRaw(['devEui', 'idDeviceProfile', 'joineui', 'appKey']),
    ).not.toThrow();
  });

  describe('workbook con varias hojas (.xlsx)', () => {
    it('concatena filas de todas las hojas con cabecera LW001', () => {
      const buffer = buildMultiSheetXlsxBuffer([
        {
          name: 'LoteA',
          rows: [
            ['devEui', 'idDeviceProfile', 'joineui', 'appKey'],
            ['0102030405060708', '', '', ''],
          ],
        },
        {
          name: 'LoteB',
          rows: [
            ['devEui', 'idDeviceProfile', 'joineui', 'appKey'],
            ['AABBCCDDEEFF0011', '', '', ''],
          ],
        },
      ]);
      const layout = loadLw001ImportLayout(buffer, 'devices.xlsx');
      expect(layout.dataRows).toHaveLength(2);
      expect(layout.dataRows[0]).toMatchObject({
        devEui: '0102030405060708',
        sheetName: 'LoteA',
        rowNumber: 2,
      });
      expect(layout.dataRows[1]).toMatchObject({
        devEui: 'AABBCCDDEEFF0011',
        sheetName: 'LoteB',
        rowNumber: 2,
      });
    });

    it('omite hojas vacías y lanza FILE_EMPTY si ninguna tiene datos', () => {
      const buffer = buildMultiSheetXlsxBuffer([
        {
          name: 'Vacía',
          rows: [['devEui', 'idDeviceProfile', 'joineui', 'appKey']],
        },
        { name: 'SinFilas', rows: [] },
      ]);
      try {
        loadLw001ImportLayout(buffer, 'empty-sheets.xlsx');
        fail('expected BadRequestException');
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        expect((error as BadRequestException).getResponse()).toMatchObject({
          message: ImportLw001Reason.FILE_EMPTY,
        });
      }
    });

    it('rechaza el archivo si una hoja con datos tiene cabecera inválida', () => {
      const buffer = buildMultiSheetXlsxBuffer([
        {
          name: 'Ok',
          rows: [
            ['devEui', 'idDeviceProfile', 'joineui', 'appKey'],
            ['0102030405060708', '', '', ''],
          ],
        },
        {
          name: 'Mal',
          rows: [
            ['devEui', 'deviceName', 'joineui', 'appKey'],
            ['AABBCCDDEEFF0011', 'x', '', ''],
          ],
        },
      ]);
      try {
        loadLw001ImportLayout(buffer, 'mixed-headers.xlsx');
        fail('expected BadRequestException');
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        expect((error as BadRequestException).getResponse()).toMatchObject({
          message: ImportLw001Reason.IMPORT_HEADERS_INVALID,
        });
      }
    });
  });

  it('loads valid layout and ignores empty deveui rows', () => {
    const buffer = buildXlsxBuffer([
      ['devEui', 'idDeviceProfile', 'joineui', 'appKey'],
      ['0102030405060708', '', '', ''],
      ['', '', '', ''],
      ['AABBCCDDEEFF0011', '', '', ''],
    ]);
    const layout = loadLw001ImportLayout(buffer, 'devices.xlsx');
    expect(layout.dataRows).toHaveLength(2);
    expect(layout.dataRows[0].devEui).toBe('0102030405060708');
  });

  it('throws IMPORT_HEADERS_INVALID for legacy headers', () => {
    const buffer = buildXlsxBuffer([
      ['devEui', 'deviceName', 'deviceProfileId', 'description'],
      ['0102030405060708', 'LW001-BG-0708', 'profile', ''],
    ]);
    try {
      loadLw001ImportLayout(buffer, 'legacy.xlsx');
      fail('expected BadRequestException');
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      expect((error as BadRequestException).getResponse()).toMatchObject({
        message: ImportLw001Reason.IMPORT_HEADERS_INVALID,
      });
    }
  });

  it('normalizes deveui to lowercase', () => {
    expect(normalizeLw001Deveui('0102030405060708')).toBe('0102030405060708');
    expect(normalizeLw001Deveui(' 0102030405060708 ')).toBe('0102030405060708');
    expect(normalizeLw001Deveui('010203040506070')).toBeNull();
  });

  it('builds device name with 4 or 5 hex suffix', () => {
    expect(buildLw001DeviceName('0102030405060708', false)).toBe('LW001-BG-0708');
    expect(buildLw001DeviceName('0102030405060708', true)).toBe('LW001-BG-60708');
  });

  it('detects scientific notation in app key', () => {
    expect(appKeyHasScientificNotation('1.23E+32')).toBe(true);
    expect(appKeyHasScientificNotation('a'.repeat(32))).toBe(false);
  });

  it('acepta AppKey hex de 32 caracteres que incluyen la letra e (no es notación científica)', () => {
    const profileKey = 'd4e9f3b27a5c8160f8d2a1943eb7c65f';
    expect(resolveLw001AppKeyValue('', profileKey)).toEqual({
      ok: true,
      value: profileKey,
    });
    expect(appKeyHasScientificNotation(profileKey)).toBe(false);
  });

  it('treats whitespace-only cells as empty', () => {
    expect(isLw001CellEmpty('')).toBe(true);
    expect(isLw001CellEmpty('   ')).toBe(true);
    expect(isLw001CellEmpty('0102030405060708')).toBe(false);
  });

  describe('resolveLw001JoinEuiValue / resolveLw001AppKeyValue — herencia desde perfil', () => {
    const profileJoin = '00000000000000aa';
    const profileAppKey = 'b'.repeat(32);
    const rowJoin = '1111111111111111';
    const rowAppKey = 'c'.repeat(32);

    it('usa cs_joineui y cs_app_key del perfil cuando la fila deja celdas vacías', () => {
      expect(resolveLw001JoinEuiValue('', profileJoin)).toEqual({
        ok: true,
        value: profileJoin,
      });
      expect(resolveLw001AppKeyValue('', profileAppKey)).toEqual({
        ok: true,
        value: profileAppKey,
      });
    });

    it('prioriza valores de fila sobre el perfil cuando están presentes', () => {
      expect(resolveLw001JoinEuiValue(rowJoin, profileJoin)).toEqual({
        ok: true,
        value: rowJoin,
      });
      expect(resolveLw001AppKeyValue(rowAppKey, profileAppKey)).toEqual({
        ok: true,
        value: rowAppKey,
      });
    });

    it('perfiles distintos aportan claves distintas (simula fila B vs dropdown)', () => {
      const rowProfileJoin = '2222222222222222';
      const dropdownProfileJoin = '3333333333333333';
      expect(resolveLw001JoinEuiValue('', rowProfileJoin)).toEqual({
        ok: true,
        value: rowProfileJoin,
      });
      expect(resolveLw001JoinEuiValue('', dropdownProfileJoin)).toEqual({
        ok: true,
        value: dropdownProfileJoin,
      });
    });
  });

  it('rejects unsupported file extension', () => {
    expect(() => assertLw001SupportedExtension('import.txt')).toThrow(BadRequestException);
    expect(() => assertLw001SupportedExtension('import.xlsx')).not.toThrow();
  });

  describe.each(['xlsx', 'xls', 'csv'] as const)('formato .%s', (format) => {
    const filename = `devices.${format}`;

    it('carga plantilla LW001 válida', () => {
      const buffer = buildFileBuffer(
        [
          ['devEui', 'idDeviceProfile', 'joineui', 'appKey'],
          ['0102030405060708', '', '', ''],
        ],
        format,
      );
      const layout = loadLw001ImportLayout(buffer, filename);
      expect(layout.dataRows).toHaveLength(1);
    });

    it('lanza IMPORT_HEADERS_INVALID con cabecera legacy', () => {
      const buffer = buildFileBuffer(
        [
          ['devEui', 'deviceName', 'idDeviceProfile', 'joineui'],
          ['0102030405060708', 'LW001-BG-0708', 'profile', ''],
        ],
        format,
      );
      try {
        loadLw001ImportLayout(buffer, filename);
        fail('expected BadRequestException');
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        expect((error as BadRequestException).getResponse()).toMatchObject({
          message: ImportLw001Reason.IMPORT_HEADERS_INVALID,
        });
      }
    });

    it('lanza FILE_EMPTY sin filas de datos útiles', () => {
      const buffer = buildFileBuffer([['devEui', 'idDeviceProfile', 'joineui', 'appKey']], format);
      try {
        loadLw001ImportLayout(buffer, filename);
        fail('expected BadRequestException');
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        expect((error as BadRequestException).getResponse()).toMatchObject({
          message: ImportLw001Reason.FILE_EMPTY,
        });
      }
    });
  });
});
