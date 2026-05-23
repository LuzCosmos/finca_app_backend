import { extname } from 'path';
import * as XLSX from 'xlsx';
import { BadRequestException } from '@nestjs/common';
import {
  ImportLw001Reason,
  ImportLw001ReasonCode,
  LW001_HEADER_COLUMNS,
} from './import-lw001.constants';

export interface Lw001ParsedRow {
  /** Número de fila en la hoja (1 = cabecera). */
  rowNumber: number;
  /** Nombre de la hoja Excel; ausente en CSV (una sola tabla). */
  sheetName?: string;
  devEui: string;
  idDeviceProfile: string;
  joineui: string;
  appKey: string;
}

export interface Lw001ImportLayout {
  dataRows: Lw001ParsedRow[];
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DEVEUI_REGEX = /^[0-9a-fA-F]{16}$/;
const HEX_16_REGEX = /^[0-9a-fA-F]{16}$/;
const HEX_32_REGEX = /^[0-9a-fA-F]{32}$/;
const SUPPORTED_EXTENSIONS = new Set(['.xlsx', '.xls', '.csv']);
/** Notación científica típica de Excel (p. ej. `1.23E+32`), no la letra `e` de un hex válido. */
const EXCEL_SCIENTIFIC_NOTATION_REGEX = /\d+\.?\d*[eE][+-]?\d+/;

export function assertLw001SupportedExtension(filename: string): void {
  const ext = extname(filename).toLowerCase();
  if (!SUPPORTED_EXTENSIONS.has(ext)) {
    throw new BadRequestException(ImportLw001Reason.UNSUPPORTED_FILE_FORMAT);
  }
}

export function loadLw001ImportLayout(
  buffer: Buffer,
  filename: string,
): Lw001ImportLayout {
  assertLw001SupportedExtension(filename);
  const ext = extname(filename).toLowerCase();
  let workbook: XLSX.WorkBook;
  try {
    const readType = ext === '.csv' ? 'string' : 'buffer';
    const data = ext === '.csv' ? buffer.toString('utf8') : buffer;
    workbook = XLSX.read(data, { type: readType, raw: false });
  } catch {
    throw new BadRequestException(ImportLw001Reason.UNSUPPORTED_FILE_FORMAT);
  }

  const dataRows =
    ext === '.csv'
      ? loadLw001RowsFromRawSheet(workbook.SheetNames[0] ?? '', workbook)
      : loadLw001RowsFromAllSheets(workbook);

  if (dataRows.length === 0) {
    throw new BadRequestException(ImportLw001Reason.FILE_EMPTY);
  }

  return { dataRows };
}

/** CSV y hoja única: misma lógica de cabecera + filas. */
function loadLw001RowsFromRawSheet(
  sheetName: string,
  workbook: XLSX.WorkBook,
): Lw001ParsedRow[] {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    return [];
  }
  const rawRows = sheetToRawRows(sheet);
  if (!rawRows.length) {
    return [];
  }
  return parseLw001DataRowsFromSheet(sheetName || undefined, rawRows);
}

/** `.xlsx` / `.xls`: importa todas las hojas con cabecera LW001 en fila 1 cada una. */
function loadLw001RowsFromAllSheets(workbook: XLSX.WorkBook): Lw001ParsedRow[] {
  const dataRows: Lw001ParsedRow[] = [];
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) {
      continue;
    }
    const rawRows = sheetToRawRows(sheet);
    if (!rawRows.length) {
      continue;
    }
    dataRows.push(...parseLw001DataRowsFromSheet(sheetName, rawRows));
  }
  return dataRows;
}

function sheetToRawRows(sheet: XLSX.WorkSheet): (string | number | null)[][] {
  return XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, {
    header: 1,
    defval: '',
    raw: false,
  }) as (string | number | null)[][];
}

function parseLw001DataRowsFromSheet(
  sheetName: string | undefined,
  rawRows: (string | number | null)[][],
): Lw001ParsedRow[] {
  assertLw001HeaderRowFromRaw(rawRows[0] ?? []);

  const dataRows: Lw001ParsedRow[] = [];
  for (let i = 1; i < rawRows.length; i++) {
    const rowNumber = i + 1;
    const cells = normalizeRowCells(rawRows[i] ?? []);
    const devEui = cells[0] ?? '';
    if (!hasUsefulDevEui(devEui)) {
      continue;
    }
    dataRows.push({
      rowNumber,
      sheetName,
      devEui,
      idDeviceProfile: cells[1] ?? '',
      joineui: cells[2] ?? '',
      appKey: cells[3] ?? '',
    });
  }
  return dataRows;
}

export function assertLw001HeaderRowFromRaw(headerRow: (string | number | null)[]): void {
  const headers = normalizeRowCells(headerRow).slice(0, 4);
  while (headers.length < 4) {
    headers.push('');
  }
  const expected = [...LW001_HEADER_COLUMNS];
  const matches = expected.every((name, index) => headers[index] === name);
  if (!matches) {
    throw new BadRequestException(ImportLw001Reason.IMPORT_HEADERS_INVALID);
  }
}

export function normalizeLw001Deveui(raw: string): string | null {
  const trimmed = raw.trim();
  if (!DEVEUI_REGEX.test(trimmed)) {
    return null;
  }
  return trimmed.toLowerCase();
}

export function buildLw001DeviceName(deveuiLower: string, useFiveSuffix = false): string {
  const suffix = useFiveSuffix
    ? deveuiLower.slice(-5).toUpperCase()
    : deveuiLower.slice(-4).toUpperCase();
  return `LW001-BG-${suffix}`;
}

export function isValidUuid(value: string): boolean {
  return UUID_REGEX.test(value.trim());
}

export function normalizeOptionalHex16(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  if (!HEX_16_REGEX.test(trimmed)) {
    return null;
  }
  return trimmed.toLowerCase();
}

export function normalizeOptionalHex32(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  if (HEX_32_REGEX.test(trimmed)) {
    return trimmed.toLowerCase();
  }
  if (EXCEL_SCIENTIFIC_NOTATION_REGEX.test(trimmed)) {
    return null;
  }
  return null;
}

export function appKeyHasScientificNotation(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed.length) {
    return false;
  }
  if (HEX_32_REGEX.test(trimmed)) {
    return false;
  }
  return EXCEL_SCIENTIFIC_NOTATION_REGEX.test(trimmed);
}

/** Celda vacía o solo espacios (valor faltante en archivo). */
export function isLw001CellEmpty(value: string): boolean {
  return value.trim().length === 0;
}

export type Lw001FieldResolveResult =
  | { ok: true; value: string }
  | { ok: false; reason: ImportLw001ReasonCode };

/**
 * Resuelve JoinEUI: valor de fila si está presente y válido; si no, `cs_joineui` del perfil resuelto.
 */
export function resolveLw001JoinEuiValue(
  rowJoineui: string,
  profileCsJoineui: string | null | undefined,
): Lw001FieldResolveResult {
  const fromRow = normalizeOptionalHex16(rowJoineui);
  if (!isLw001CellEmpty(rowJoineui) && !fromRow) {
    return { ok: false, reason: ImportLw001Reason.JOINEUI_INVALID };
  }
  const effective = fromRow ?? normalizeOptionalHex16(profileCsJoineui ?? '');
  if (!effective) {
    return { ok: false, reason: ImportLw001Reason.JOINEUI_INVALID };
  }
  return { ok: true, value: effective };
}

/**
 * Resuelve AppKey: valor de fila si está presente y válido; si no, `cs_app_key` del perfil resuelto.
 */
export function resolveLw001AppKeyValue(
  rowAppKey: string,
  profileCsAppKey: string | null | undefined,
): Lw001FieldResolveResult {
  if (appKeyHasScientificNotation(rowAppKey)) {
    return { ok: false, reason: ImportLw001Reason.APP_KEY_SCIENTIFIC_NOTATION };
  }
  const fromRow = normalizeOptionalHex32(rowAppKey);
  if (!isLw001CellEmpty(rowAppKey) && !fromRow) {
    return { ok: false, reason: ImportLw001Reason.APP_KEY_INVALID };
  }
  const effective = fromRow ?? normalizeOptionalHex32(profileCsAppKey ?? '');
  if (!effective) {
    return { ok: false, reason: ImportLw001Reason.APP_KEY_INVALID };
  }
  return { ok: true, value: effective };
}

export function allRowsHaveValidProfileId(
  rows: Lw001ParsedRow[],
  isProfileValid: (id: string) => boolean,
): boolean {
  if (rows.length === 0) {
    return false;
  }
  return rows.every((row) => {
    const profileId = row.idDeviceProfile.trim();
    return profileId.length > 0 && isProfileValid(profileId);
  });
}

function normalizeRowCells(row: (string | number | null)[]): string[] {
  return row.map((cell) => normalizeCellValue(cell));
}

function normalizeCellValue(cell: string | number | null | undefined): string {
  if (cell === null || cell === undefined) {
    return '';
  }
  if (typeof cell === 'number') {
    if (!Number.isFinite(cell)) {
      return '';
    }
    if (EXCEL_SCIENTIFIC_NOTATION_REGEX.test(String(cell))) {
      return String(cell);
    }
    if (Number.isInteger(cell)) {
      return String(cell);
    }
    return String(cell);
  }
  return String(cell).trim();
}

function hasUsefulDevEui(devEui: string): boolean {
  return devEui.trim().length > 0;
}
