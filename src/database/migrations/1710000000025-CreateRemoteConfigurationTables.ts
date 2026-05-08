import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Crea la infraestructura de configuración remota MOKO LW001-BG PRO:
 *
 * - `device_configuration_profiles` (perfiles globales + por tenant).
 * - `device_remote_configurations` (estado vigente por device).
 * - `device_downlink_commands` (historial de downlinks con ciclo de vida).
 *
 * También:
 * - Inserta 5 perfiles globales (`AHORRO_BATERIA`, `NORMAL_1H`, `SEGUIMIENTO_30MIN`,
 *   `MOVIMIENTO_1H`, `ALERTA_ROBO`).
 * - Extiende `modules.access_details` para `PROD_CENTER` agregando
 *   `device_configuration_profiles:CRUDL`, `remote_config:0RU00` (read+update) y
 *   `downlink_commands:0R00L` (read+list).
 */
export class CreateRemoteConfigurationTables1710000000025 implements MigrationInterface {
  name = 'CreateRemoteConfigurationTables1710000000025';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Tabla de perfiles
    await queryRunner.query(`
      CREATE TABLE "device_configuration_profiles" (
        "id" uuid NOT NULL PRIMARY KEY DEFAULT uuid_generate_v4(),
        "id_tenant" uuid NULL,
        "code" varchar(50) NOT NULL,
        "name" varchar(100) NOT NULL,
        "description" varchar(255) NULL,
        "parameters" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "is_system" boolean NOT NULL DEFAULT false,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now()
      );
    `);

    // Índice único compuesto que admite NULL en id_tenant (perfil global) gracias a COALESCE.
    await queryRunner.query(`
      CREATE UNIQUE INDEX "uq_device_cfg_profile_tenant_code"
        ON "device_configuration_profiles" (COALESCE("id_tenant"::text, 'GLOBAL'), "code");
    `);

    // 2. Configuración remota vigente
    await queryRunner.query(`
      CREATE TABLE "device_remote_configurations" (
        "id" uuid NOT NULL PRIMARY KEY DEFAULT uuid_generate_v4(),
        "id_tenant" uuid NOT NULL,
        "id_device" uuid NOT NULL,
        "id_profile" uuid NULL,
        "profile_snapshot" jsonb NULL,
        "desired" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "confirmed" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "divergent" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "desired_version" integer NOT NULL DEFAULT 0,
        "confirmed_version" integer NOT NULL DEFAULT 0,
        "last_pushed_at" TIMESTAMP NULL,
        "last_confirmed_at" TIMESTAMP NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "device_remote_cfg_device_fkey" FOREIGN KEY ("id_device") REFERENCES "devices"("id") ON DELETE CASCADE,
        CONSTRAINT "device_remote_cfg_profile_fkey" FOREIGN KEY ("id_profile") REFERENCES "device_configuration_profiles"("id") ON DELETE SET NULL
      );
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "uq_device_remote_cfg_device" ON "device_remote_configurations" ("id_device");
    `);

    // 3. Historial de downlinks
    await queryRunner.query(`
      CREATE TABLE "device_downlink_commands" (
        "id" uuid NOT NULL PRIMARY KEY DEFAULT uuid_generate_v4(),
        "id_tenant" uuid NOT NULL,
        "id_device" uuid NOT NULL,
        "id_user" uuid NULL,
        "id_profile" uuid NULL,
        "type" varchar(30) NOT NULL,
        "action" varchar(80) NOT NULL,
        "f_port" smallint NOT NULL,
        "payload_hex" varchar(600) NOT NULL,
        "payload_base64" varchar(800) NOT NULL,
        "confirmed" boolean NOT NULL DEFAULT false,
        "parameters" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "chirpstack_queue_item_id" varchar(64) NULL,
        "status" varchar(30) NOT NULL DEFAULT 'PENDING',
        "error_message" varchar(600) NULL,
        "queued_at" TIMESTAMP NULL,
        "sent_at" TIMESTAMP NULL,
        "verified_at" TIMESTAMP NULL,
        "verification_deadline" TIMESTAMP NULL,
        "desired_version" integer NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "device_dl_cmd_device_fkey" FOREIGN KEY ("id_device") REFERENCES "devices"("id") ON DELETE CASCADE,
        CONSTRAINT "device_dl_cmd_profile_fkey" FOREIGN KEY ("id_profile") REFERENCES "device_configuration_profiles"("id") ON DELETE SET NULL
      );
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_dl_cmd_device_status" ON "device_downlink_commands" ("id_device", "status");
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_dl_cmd_tenant_created" ON "device_downlink_commands" ("id_tenant", "created_at");
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_dl_cmd_queue_item" ON "device_downlink_commands" ("chirpstack_queue_item_id");
    `);

    // 4. Permisos en modules.access_details (no destruimos lo que ya hay).
    await queryRunner.query(`
      UPDATE modules
      SET access_details = '{"device_profiles":"CRUDL","devices":"CRUDL","device_configuration_profiles":"CRUDL","remote_config":"0RU00","downlink_commands":"0R00L"}'
      WHERE code = 'PROD_CENTER';
    `);

    // 5. Seed de perfiles globales del sistema (id_tenant = NULL, is_system = true).
    await queryRunner.query(`
      INSERT INTO "device_configuration_profiles"
        ("id_tenant", "code", "name", "description", "parameters", "is_system", "is_active")
      VALUES
        (NULL, 'AHORRO_BATERIA', 'Ahorro de batería',
          'Reportes diarios para máxima duración de batería en ganado de pastoreo extensivo.',
          '{"workingMode":"periodic","heartbeatInterval":1440,"periodicReportInterval":86400,"periodicPositioningStrategy":{"wifi":false,"bluetooth":false,"gps":true},"shockDetectionSwitch":true,"shockThreshold":30,"shockTimeout":15,"shockReportInterval":255,"manDownDetectionSwitch":true,"idleDetectionTimeout":120,"tamperAlarmSwitch":true,"ledIndicatorSetting":{"tamperAlarm":false,"lowPower":false,"inBluetoothFix":false,"bluetoothFixSuccess":false,"bluetoothFixFailed":false,"inGpsFix":false,"gpsFixSuccess":false,"gpsFixFailed":false,"inWifiFix":false,"wifiFixSuccess":false,"wifiFixFailed":false}}',
          true, true),

        (NULL, 'NORMAL_1H', 'Normal cada 1 hora',
          'Reporte de posición cada 1 hora. Equilibrio entre frescura de datos y batería.',
          '{"workingMode":"periodic","heartbeatInterval":720,"periodicReportInterval":3600,"periodicPositioningStrategy":{"wifi":false,"bluetooth":false,"gps":true},"shockDetectionSwitch":true,"shockThreshold":30,"shockTimeout":15,"shockReportInterval":255,"manDownDetectionSwitch":true,"idleDetectionTimeout":120,"tamperAlarmSwitch":true}',
          true, true),

        (NULL, 'SEGUIMIENTO_30MIN', 'Seguimiento cada 30 min',
          'Para hatos lecheros o ganado en confinamiento donde se quiera mayor frecuencia.',
          '{"workingMode":"periodic","heartbeatInterval":360,"periodicReportInterval":1800,"periodicPositioningStrategy":{"wifi":true,"bluetooth":false,"gps":true},"shockDetectionSwitch":true,"shockThreshold":30,"shockTimeout":15,"shockReportInterval":255,"manDownDetectionSwitch":true,"idleDetectionTimeout":60,"tamperAlarmSwitch":true}',
          true, true),

        (NULL, 'MOVIMIENTO_1H', 'Movimiento por trip',
          'Modo motion: reportes solo cuando hay movimiento detectado, optimizando batería.',
          '{"workingMode":"motion","heartbeatInterval":720,"motionModeSetting":{"notifyEventOnStart":true,"fixOnStart":true,"notifyEventInTrip":false,"fixInTrip":true,"notifyEventOnEnd":true,"fixOnEnd":true},"motionReportIntervalInTrip":3600,"motionTripEndTimeout":600,"motionPositionStrategyInTrip":{"wifi":false,"bluetooth":false,"gps":true},"shockDetectionSwitch":true,"shockThreshold":30,"shockTimeout":15,"shockReportInterval":255,"manDownDetectionSwitch":true,"idleDetectionTimeout":120,"tamperAlarmSwitch":true}',
          true, true),

        (NULL, 'ALERTA_ROBO', 'Alerta antirrobo',
          'Modo de alta frecuencia tras tamper/shock para localización en caso de robo. Consume más batería.',
          '{"workingMode":"periodic","heartbeatInterval":300,"periodicReportInterval":300,"periodicPositioningStrategy":{"wifi":true,"bluetooth":true,"gps":true},"shockDetectionSwitch":true,"shockThreshold":30,"shockTimeout":15,"shockReportInterval":255,"manDownDetectionSwitch":true,"idleDetectionTimeout":8,"tamperAlarmSwitch":true,"ledIndicatorSetting":{"tamperAlarm":true,"lowPower":true,"inBluetoothFix":false,"bluetoothFixSuccess":false,"bluetoothFixFailed":false,"inGpsFix":true,"gpsFixSuccess":true,"gpsFixFailed":false,"inWifiFix":true,"wifiFixSuccess":true,"wifiFixFailed":false}}',
          true, true);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_dl_cmd_queue_item";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_dl_cmd_tenant_created";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_dl_cmd_device_status";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "device_downlink_commands";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "uq_device_remote_cfg_device";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "device_remote_configurations";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "uq_device_cfg_profile_tenant_code";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "device_configuration_profiles";`);
    await queryRunner.query(`
      UPDATE modules
      SET access_details = '{"device_profiles":"CRUDL","devices":"CRUDL"}'
      WHERE code = 'PROD_CENTER';
    `);
  }
}
