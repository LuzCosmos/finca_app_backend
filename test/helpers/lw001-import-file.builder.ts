import * as XLSX from 'xlsx';
import { LW001_HEADER_COLUMNS } from '../../src/modules/production-center/import-lw001/import-lw001.constants';

export type Lw001ImportFileFormat = 'xlsx' | 'xls' | 'csv';

const MIME_BY_FORMAT: Record<Lw001ImportFileFormat, string> = {
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  xls: 'application/vnd.ms-excel',
  csv: 'text/csv',
};

export function buildLw001ImportFileBuffer(
  dataRows: (string | number)[][],
  format: Lw001ImportFileFormat,
  options?: { headerRow?: (string | number)[] },
): { buffer: Buffer; filename: string; mimetype: string } {
  const headerRow = options?.headerRow ?? [...LW001_HEADER_COLUMNS];
  const rows = [headerRow, ...dataRows];
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, 'Sheet1');
  const buffer = XLSX.write(workbook, {
    type: 'buffer',
    bookType: format,
  }) as Buffer;
  return {
    buffer,
    filename: `lw001-import.${format}`,
    mimetype: MIME_BY_FORMAT[format],
  };
}

export function buildLw001MultiSheetImportFileBuffer(
  sheets: { name: string; dataRows: (string | number)[][] }[],
): { buffer: Buffer; filename: string; mimetype: string } {
  const workbook = XLSX.utils.book_new();
  for (const { name, dataRows } of sheets) {
    const rows = [[...LW001_HEADER_COLUMNS], ...dataRows];
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), name);
  }
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  return {
    buffer,
    filename: 'lw001-import-multi.xlsx',
    mimetype: MIME_BY_FORMAT.xlsx,
  };
}

export function buildLegacyImportFileBuffer(
  format: Lw001ImportFileFormat,
): { buffer: Buffer; filename: string; mimetype: string } {
  const rows = [
    ['devEui', 'deviceName', 'idDeviceProfile', 'joineui'],
    ['0102030405060708', 'LW001-BG-0708', 'profile', ''],
  ];
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, 'Sheet1');
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: format }) as Buffer;
  return {
    buffer,
    filename: `legacy-import.${format}`,
    mimetype: MIME_BY_FORMAT[format],
  };
}
