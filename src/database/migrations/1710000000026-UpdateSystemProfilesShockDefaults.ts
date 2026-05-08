import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Actualiza los valores por defecto de detección de golpes (shock) en los
 * perfiles globales del sistema MOKO LW001-BG PRO sembrados en `1710000000025`.
 *
 * Cambios aplicados a `AHORRO_BATERIA`, `NORMAL_1H`, `SEGUIMIENTO_30MIN`,
 * `MOVIMIENTO_1H` y `ALERTA_ROBO`:
 *
 *   - `shockThreshold`       : 15 → 30   (300 mg, antes 150 mg, menos sensible).
 *   - `shockTimeout`         : 10 → 15   s.
 *   - `shockReportInterval`  : 60 / 300 → 255 s (máximo, reduce tráfico LoRa).
 *
 * Adicionalmente, corrige un valor fuera de rango sembrado en `1710000000025`
 * solo para `ALERTA_ROBO`:
 *
 *   - `heartbeatInterval`    : 60 → 300 s (mínimo legal del codec MOKO,
 *                                          rango oficial 300..86400 s).
 *
 * Sin esta corrección, `applyProfile('ALERTA_ROBO')` levanta `RangeError`
 * porque `lw001-bg-pro-downlink-codec` rechaza `heartbeatInterval < 300`.
 *
 * Solo afecta filas con `is_system = true` y `id_tenant IS NULL`. Perfiles
 * personalizados de tenants no se tocan.
 */
export class UpdateSystemProfilesShockDefaults1710000000026 implements MigrationInterface {
  name = 'UpdateSystemProfilesShockDefaults1710000000026';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "device_configuration_profiles"
      SET "parameters" = (
        ("parameters"::jsonb)
          || jsonb_build_object(
            'shockDetectionSwitch', true,
            'manDownDetectionSwitch', true,
            'shockThreshold', 30,
            'shockTimeout', 15,
            'shockReportInterval', 255
          )
      ),
      "updated_at" = now()
      WHERE "is_system" = true
        AND "id_tenant" IS NULL
        AND "code" IN (
          'AHORRO_BATERIA',
          'NORMAL_1H',
          'SEGUIMIENTO_30MIN',
          'MOVIMIENTO_1H',
          'ALERTA_ROBO'
        );
    `);

    // Corrige heartbeatInterval fuera de rango en ALERTA_ROBO.
    // El codec MOKO acepta 300..86400 s; el seed original de 0025 usaba 60.
    // Idempotente: si la BD ya quedó en 300 (por ejemplo tras re-seed), no cambia nada.
    await queryRunner.query(`
      UPDATE "device_configuration_profiles"
      SET "parameters" = (
        ("parameters"::jsonb)
          || jsonb_build_object('heartbeatInterval', 300)
      ),
      "updated_at" = now()
      WHERE "is_system" = true
        AND "id_tenant" IS NULL
        AND "code" = 'ALERTA_ROBO'
        AND COALESCE(("parameters"->>'heartbeatInterval')::int, 0) < 300;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Restaura los valores que tenía la migración 0025 al sembrar los perfiles.
    // ALERTA_ROBO usaba shockReportInterval=300; los demás 60.
    await queryRunner.query(`
      UPDATE "device_configuration_profiles"
      SET "parameters" = (
        ("parameters"::jsonb)
          || jsonb_build_object(
            'shockThreshold', 15,
            'shockTimeout', 10,
            'shockReportInterval', 60
          )
      ),
      "updated_at" = now()
      WHERE "is_system" = true
        AND "id_tenant" IS NULL
        AND "code" IN (
          'AHORRO_BATERIA',
          'NORMAL_1H',
          'SEGUIMIENTO_30MIN',
          'MOVIMIENTO_1H'
        );
    `);

    await queryRunner.query(`
      UPDATE "device_configuration_profiles"
      SET "parameters" = (
        ("parameters"::jsonb)
          || jsonb_build_object(
            'shockThreshold', 15,
            'shockTimeout', 10,
            'shockReportInterval', 300,
            'heartbeatInterval', 60
          )
      ),
      "updated_at" = now()
      WHERE "is_system" = true
        AND "id_tenant" IS NULL
        AND "code" = 'ALERTA_ROBO';
    `);
  }
}
