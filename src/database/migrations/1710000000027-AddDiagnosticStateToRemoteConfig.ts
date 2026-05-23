import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Añade la columna `diagnostic_state` (jsonb nullable) a `device_remote_configurations`.
 *
 * Esta columna almacena el estado del "modo diagnóstico", una utilidad para silenciar
 * temporalmente eventos auxiliares (shock, man-down, tamper) y reducir el heartbeat al
 * mínimo legal MOKO (300 s), de forma que el técnico de soporte pueda observar en
 * ChirpStack uplinks Port 1 limpios mientras diagnostica un device.
 *
 * Estructura esperada de la columna cuando está activo:
 *
 *   {
 *     "active": true,
 *     "enabledAt": "2026-05-07T22:11:00.000Z",
 *     "expiresAt": "2026-05-07T22:41:00.000Z",
 *     "previous": {
 *       "shockDetectionSwitch": true,
 *       "manDownDetectionSwitch": true,
 *       "tamperAlarmSwitch": true,
 *       "heartbeatInterval": 720
 *     },
 *     "enabledByUserId": "...",
 *     "ttlMinutes": 30
 *   }
 *
 * Cuando está inactivo, la columna queda en `NULL` (no en `{ active: false }`) para
 * facilitar índices parciales y queries de auto-restauración eficientes.
 */
export class AddDiagnosticStateToRemoteConfig1710000000027 implements MigrationInterface {
  name = 'AddDiagnosticStateToRemoteConfig1710000000027';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "device_remote_configurations"
      ADD COLUMN "diagnostic_state" jsonb NULL;
    `);

    // Índice parcial para acelerar el cron de auto-restauración:
    // solo necesita escanear filas con diagnostic_state IS NOT NULL.
    await queryRunner.query(`
      CREATE INDEX "idx_device_remote_cfg_diagnostic_active"
        ON "device_remote_configurations" ((("diagnostic_state"->>'expiresAt')))
        WHERE "diagnostic_state" IS NOT NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_device_remote_cfg_diagnostic_active";
    `);
    await queryRunner.query(`
      ALTER TABLE "device_remote_configurations"
      DROP COLUMN IF EXISTS "diagnostic_state";
    `);
  }
}
