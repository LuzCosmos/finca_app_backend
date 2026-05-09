/**
 * Tabla SAPA 2014 — filas codificadas para matching por conteos + desgaste (0–5).
 * Documento: edad_bovinos/tabla_edad_bovinos_dientes.md
 * Rangos textuales → un único ageDays (punto representativo).
 */
export const DENTITION_TABLE_VERSION = 'sapa2014-v1';

export type DentitionRule = {
  milkTeeth: number;
  permanentTeeth: number;
  milkWearMin: number;
  milkWearMax: number;
  permWearMin: number;
  permWearMax: number;
  ageDays: number;
};

/** Sin solapamiento por fila: desgaste agregado encaja en un solo intervalo por par (leche, permanente). */
export const SAPA2014_RULES: DentitionRule[] = [
  { milkTeeth: 2, permanentTeeth: 0, milkWearMin: 1, milkWearMax: 1, permWearMin: 0, permWearMax: 5, ageDays: 0 },
  { milkTeeth: 4, permanentTeeth: 0, milkWearMin: 1, milkWearMax: 1, permWearMin: 0, permWearMax: 5, ageDays: 7 },
  { milkTeeth: 6, permanentTeeth: 0, milkWearMin: 1, milkWearMax: 1, permWearMin: 0, permWearMax: 5, ageDays: 21 },
  { milkTeeth: 8, permanentTeeth: 0, milkWearMin: 1, milkWearMax: 1, permWearMin: 0, permWearMax: 5, ageDays: 30 },
  { milkTeeth: 8, permanentTeeth: 0, milkWearMin: 2, milkWearMax: 2, permWearMin: 0, permWearMax: 5, ageDays: 183 },
  { milkTeeth: 8, permanentTeeth: 0, milkWearMin: 3, milkWearMax: 3, permWearMin: 0, permWearMax: 5, ageDays: 365 },
  { milkTeeth: 8, permanentTeeth: 0, milkWearMin: 4, milkWearMax: 4, permWearMin: 0, permWearMax: 5, ageDays: 548 },
  { milkTeeth: 8, permanentTeeth: 0, milkWearMin: 5, milkWearMax: 5, permWearMin: 0, permWearMax: 5, ageDays: 640 },
  { milkTeeth: 6, permanentTeeth: 2, milkWearMin: 3, milkWearMax: 4, permWearMin: 1, permWearMax: 2, ageDays: 730 },
  { milkTeeth: 4, permanentTeeth: 4, milkWearMin: 3, milkWearMax: 4, permWearMin: 1, permWearMax: 2, ageDays: 1095 },
  { milkTeeth: 2, permanentTeeth: 6, milkWearMin: 4, milkWearMax: 4, permWearMin: 1, permWearMax: 2, ageDays: 1460 },
  { milkTeeth: 0, permanentTeeth: 8, milkWearMin: 0, milkWearMax: 5, permWearMin: 1, permWearMax: 2, ageDays: 1825 },
  { milkTeeth: 0, permanentTeeth: 8, milkWearMin: 0, milkWearMax: 5, permWearMin: 3, permWearMax: 3, ageDays: 2190 },
  { milkTeeth: 0, permanentTeeth: 8, milkWearMin: 0, milkWearMax: 5, permWearMin: 4, permWearMax: 4, ageDays: 2920 },
  { milkTeeth: 0, permanentTeeth: 8, milkWearMin: 0, milkWearMax: 5, permWearMin: 5, permWearMax: 5, ageDays: 4745 },
];
