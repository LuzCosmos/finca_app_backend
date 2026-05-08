# LW001-BG PRO — Bloques de lectura (`Read parameters`, 18 tramas)

Este documento describe los **18 bloques predefinidos** de downlink `CMD = Read (0x01)` para el collar MOKO **LW001-BG PRO**: categoría, **HEX exacto** del payload (sin espacios), y **cada variable** (ID de parámetro en hex + nombre `camelCase` en el backend cuando existe).

**Fuente de verdad en código:** `finca_app_backend/src/modules/production-center/lw001-bg-pro/lw001-bg-pro.constants.ts` → constante `READ_BLOCK_DEFINITIONS` y función `lw001BgProSafeReadParameterChunks()`.

**API:** `POST /api/v1/devices/:deveui/remote-config/read-safe-parameters-chunk` con cuerpo `{ "chunkIndex": N }` donde `N` es **0…17** (mismo orden que las tablas de abajo). **fPort:** `10` (GENERAL_COMMANDS). Equivalente por ganado: `POST /api/v1/cattle/:idCattle/remote-config/read-safe-parameters-chunk`.

**Mapa de nombres:** cuando un ID tiene entrada en `LW001_BG_PRO_PARAM_NAME_TO_ID`, el backend y el uplink parser usan el `camelCase` indicado. Los IDs de **filtros BLE** (`0x34`…`0x45` en los bloques 4–6) **aún no** tienen esa entrada en el código actual; en respuestas JSON verás `id0xNN` hasta que se añadan las claves al mapa.

**Formato del payload:** `0x01` seguido de los bytes de ID de parámetro en el orden listado (sin duplicar el `0x01` en las columnas HEX de esta doc: el HEX mostrado **incluye** el `01` inicial del comando Read).

## Por qué 18 bloques (mayo 2026)

Pasamos de 11 a 18 bloques tras observar en producción (firmware MOKO V1.0.9) que para los bloques originales 2 (Periodic/Timing/Motion, 14 IDs), 6 (GPS, 12 IDs), 7 (LoRaWAN básico, 11 IDs), 8 (Bluetooth broadcast, 11 IDs) y 9 (Sensores/alertas, 11 IDs) el firmware **no emitía la respuesta TLV** en `fPort 10`. Solo enviaba el evento `0x03` (`triggered_by_downlink`) en `fPort 8`, confirmando que el comando se procesó pero sin replicar los valores.

Los bloques que **sí** funcionaban (1, 3, 5, 10) y los que tenían 6 IDs o menos (4, 11) se mantuvieron tal cual. Los problemáticos se subdividieron en sub-bloques con sufijos `A`, `B`, `C`, todos con **6 IDs o menos**, para que la respuesta TLV sea pequeña y el firmware no la silencie.

| `chunkIndex` original | Subdivisión | Razón |
|---|---|---|
| 1 (Periodic/Timing/Motion, 14 IDs) | 1, 2, 3 (5+5+4 IDs) | Bloque más grande; Bloque 2 es prioritario para reducir consumo |
| 5 (GPS, 12 IDs) | 7, 8 (6+6 IDs) | Partición simétrica accuracy / aiding |
| 6 (LoRaWAN básico, 11 IDs) | 9, 10, 11 (4+4+3 IDs) | Aísla DevEUI/AppEUI (9 bytes c/u), CH/DR, y duty/sync |
| 7 (Bluetooth broadcast, 11 IDs) | 12, 13 (5+6 IDs) | Aísla UUID (17 bytes) en su propio sub-bloque |
| 8 (Sensores y alertas, 11 IDs) | 14, 15 (6+5 IDs) | Axis+shock vs man-down/tamper |

**Notas importantes**

- Los bloques **9 (LoRaWAN region/EUIs)**, **16 (contraseña)** y **17 (claves)** incluyen IDs marcados como **peligrosos** en `LW001_BG_PRO_DANGEROUS_PARAM_IDS` (región, modo LoRaWAN, DevEUI, AppEUI, claves, canal, etc.). El endpoint genérico `POST …/read` con nombres los rechaza; los presets de bloque son la vía explícita para pruebas de campo.
- El ID **0x05** (`loginPassword`) aparece en el **bloque 16** (`bluetoothPassword`) y de nuevo en el **bloque 17** (`lorawanKeys`, vuelve a incluir `0x05` junto con las claves).
- Del catálogo PDF mapeado en código, el único ID de parámetro **no incluido** en ningún bloque es **0x66 (DevAddr)** — también es sensible y no forma parte de `lw001BgProSafeReadParameterIds()`.
- En clase A LoRaWAN, ChirpStack solo entrega 1 downlink por uplink. Si se pulsan varios botones en ráfaga, los nuevos **sobrescriben los pendientes**. Espacia las pruebas o usa el **modo diagnóstico** para acortar el heartbeat.

---

## Resumen rápido (18 bloques)

| `chunkIndex` | Etiqueta UI | Categoría | IDs | HEX del payload |
|---|---|---|---|---|
| 0 | Bloque 1 — General | `general` | 9 | `0104060708090a0b0c0d` |
| 1 | Bloque 2A — Periodic / Timing | `periodicTimingMotionA` | 5 | `012021222324` |
| 2 | Bloque 2B — Motion (inicio + en viaje) | `periodicTimingMotionB` | 5 | `012526272829` |
| 3 | Bloque 2C — Motion (fin) + downlink | `periodicTimingMotionC` | 4 | `012a2b2c2d` |
| 4 | Bloque 3 — WiFi / BT básico + filtros globales | `wifiBluetoothBasic` | 9 | `013031323334353c3e45` |
| 5 | Bloque 4 — Filtros BLE A | `bleFilterA` | 6 | `01363738393a3b` |
| 6 | Bloque 5 — Filtros BLE B | `bleFilterB` | 6 | `013f4041424344` |
| 7 | Bloque 6A — GPS accuracy / timeouts | `gpsA` | 6 | `0148494a4b4c4d` |
| 8 | Bloque 6B — GPS model + aiding | `gpsB` | 6 | `014e4f50515253` |
| 9 | Bloque 7A — LoRaWAN región + DevEUI/AppEUI | `lorawanBasicA` | 4 | `0160616364` |
| 10 | Bloque 7B — LoRaWAN msg / CH / DR | `lorawanBasicB` | 4 | `01696a6b6c` |
| 11 | Bloque 7C — LoRaWAN duty / sync / reconnect | `lorawanBasicC` | 3 | `016d6e6f` |
| 12 | Bloque 8A — BT beacon + UUID | `bluetoothBroadcastA` | 5 | `017071727374` |
| 13 | Bloque 8B — BT Major/Minor/Power/Name | `bluetoothBroadcastB` | 6 | `0175767778797a` |
| 14 | Bloque 9A — Axis + shock detalle | `sensorsAndAlertsA` | 6 | `01808182838485` |
| 15 | Bloque 9B — Man down + tamper + active | `sensorsAndAlertsB` | 5 | `01868788898a` |
| 16 | Bloque 10 — Password Bluetooth | `bluetoothPassword` | 1 | `0105` |
| 17 | Bloque 11 — Keys (AppKey/AppSKey/NwkSKey) | `lorawanKeys` | 4 | `0105656768` |

**Total de lecturas de parámetro en las 18 tramas:** 94 (porque `0x05` se solicita dos veces: en 16 y en 17). **IDs distintos cubiertos:** 93 (falta solo **0x66** respecto al conjunto de 94 IDs del PDF en código).

---

## Bloque 1 — General (`chunkIndex` 0, `general`) — sin cambios, respondió OK

**HEX:** `0104060708090a0b0c0d`

| ID (hex) | Nombre en backend | Descripción breve (PDF / producto) |
|----------|-------------------|-------------------------------------|
| `0x04` | `timeZone` | Zona horaria |
| `0x06` | `workingMode` | Modo de trabajo (p. ej. periódico / movimiento) |
| `0x07` | `defaultPowerStatus` | Estado de energía por defecto |
| `0x08` | `heartbeatInterval` | Intervalo de heartbeat |
| `0x09` | `offByMagnetSwitch` | Apagado por imán |
| `0x0a` | `shutdownPayloadSwitch` | Switch de payload de apagado |
| `0x0b` | `offlineFixSwitch` | Fix offline |
| `0x0c` | `lowPowerSetting` | Ajuste de bajo consumo |
| `0x0d` | `ledIndicatorSetting` | LED / indicador |

---

## Bloque 2A — Periodic / Timing (`chunkIndex` 1, `periodicTimingMotionA`)

**HEX:** `012021222324`

| ID (hex) | Nombre en backend | Descripción breve |
|----------|-------------------|-------------------|
| `0x20` | `periodicPositioningStrategy` | Estrategia de posicionamiento periódico |
| `0x21` | `periodicReportInterval` | Intervalo de informe periódico |
| `0x22` | `timingPositioningStrategy` | Estrategia de posicionamiento por horario |
| `0x23` | `timingReportPoints` | Puntos de informe por tiempo (longitud variable, hasta 10) |
| `0x24` | `motionModeSetting` | Modo movimiento (bitmask) |

---

## Bloque 2B — Motion (inicio + en viaje) (`chunkIndex` 2, `periodicTimingMotionB`)

**HEX:** `012526272829`

| ID (hex) | Nombre en backend | Descripción breve |
|----------|-------------------|-------------------|
| `0x25` | `motionNumberOfFixOnTripStart` | Nº de fixes al inicio de viaje |
| `0x26` | `motionPositionStrategyOnTripStart` | Estrategia de posición al inicio de viaje |
| `0x27` | `motionReportIntervalInTrip` | Intervalo de informe en viaje |
| `0x28` | `motionPositionStrategyInTrip` | Estrategia de posición en viaje |
| `0x29` | `motionTripEndTimeout` | Timeout fin de viaje |

---

## Bloque 2C — Motion (fin) + downlink (`chunkIndex` 3, `periodicTimingMotionC`)

**HEX:** `012a2b2c2d`

| ID (hex) | Nombre en backend | Descripción breve |
|----------|-------------------|-------------------|
| `0x2a` | `motionNumberOfFixOnTripEnd` | Nº de fixes al fin de viaje |
| `0x2b` | `motionReportIntervalOnTripEnd` | Intervalo de informe al fin de viaje |
| `0x2c` | `motionPositionStrategyOnTripEnd` | Estrategia de posición al fin de viaje |
| `0x2d` | `downlinkForPositionStrategy` | Estrategia "downlink for position" |

---

## Bloque 3 — WiFi / Bluetooth básico y filtros globales (`chunkIndex` 4, `wifiBluetoothBasic`) — sin cambios, respondió OK

**HEX:** `013031323334353c3e45`

| ID (hex) | Identificación |
|----------|----------------|
| `0x30` | Backend: `wifiFixTimeout` |
| `0x31` | Backend: `numberOfWifiBssid` |
| `0x32` | Backend: `bluetoothFixTimeout` |
| `0x33` | Backend: `numberOfBtDevicesInBleFix` |
| `0x34` | PDF: `FILTER_AB_RELATION` — sin clave en `LW001_BG_PRO_PARAM_NAME_TO_ID` (`id0x34` en runtime) |
| `0x35` | PDF: `FILTER_A_SWITCH` — sin clave en mapa (`id0x35`) |
| `0x3c` | PDF: `FILTER_A_RSSI` — sin clave en mapa (`id0x3c`) |
| `0x3e` | PDF: `FILTER_B_SWITCH` — sin clave en mapa (`id0x3e`) |
| `0x45` | PDF: `FILTER_B_RSSI` — sin clave en mapa (`id0x45`) |

---

## Bloque 4 — Filtros BLE A (`chunkIndex` 5, `bleFilterA`) — sin cambios

**HEX:** `01363738393a3b`

| ID (hex) | Identificación |
|----------|----------------|
| `0x36` | PDF: `FILTER_A_ADV_NAME` — sin clave en mapa (`id0x36`) |
| `0x37` | PDF: `FILTER_A_MAC` — sin clave en mapa (`id0x37`) |
| `0x38` | PDF: `FILTER_A_MAJOR` — sin clave en mapa (`id0x38`) |
| `0x39` | PDF: `FILTER_A_MINOR` — sin clave en mapa (`id0x39`) |
| `0x3a` | PDF: `FILTER_A_RAW_DATA` — sin clave en mapa (`id0x3a`); respuesta hasta 167 bytes si está configurado |
| `0x3b` | PDF: `FILTER_A_UUID` — sin clave en mapa (`id0x3b`) |

> Nota: en producción este bloque **no respondió**, pero su simétrico Bloque 5 (filtros B) sí. Lo más probable es que se haya perdido el downlink en la cola de ChirpStack. Reintentar espaciado.

---

## Bloque 5 — Filtros BLE B (`chunkIndex` 6, `bleFilterB`) — sin cambios, respondió OK

**HEX:** `013f4041424344`

| ID (hex) | Identificación |
|----------|----------------|
| `0x3f` | PDF: `FILTER_B_ADV_NAME` — sin clave en mapa (`id0x3f`) |
| `0x40` | PDF: `FILTER_B_MAC` — sin clave en mapa (`id0x40`) |
| `0x41` | PDF: `FILTER_B_MAJOR` — sin clave en mapa (`id0x41`) |
| `0x42` | PDF: `FILTER_B_MINOR` — sin clave en mapa (`id0x42`) |
| `0x43` | PDF: `FILTER_B_RAW_DATA` — sin clave en mapa (`id0x43`) |
| `0x44` | PDF: `FILTER_B_UUID` — sin clave en mapa (`id0x44`) |

---

## Bloque 6A — GPS accuracy / timeouts (`chunkIndex` 7, `gpsA`)

**HEX:** `0148494a4b4c4d`

| ID (hex) | Nombre en backend |
|----------|---------------------|
| `0x48` | `coarseAccuracyMask` |
| `0x49` | `fineAccuracyMask` |
| `0x4a` | `coarseTimeout` |
| `0x4b` | `fineTimeout` |
| `0x4c` | `pdopLimit` |
| `0x4d` | `fixMode` |

---

## Bloque 6B — GPS model + aiding (`chunkIndex` 8, `gpsB`)

**HEX:** `014e4f50515253`

| ID (hex) | Nombre en backend |
|----------|---------------------|
| `0x4e` | `gpsModel` |
| `0x4f` | `gpsTimeBudget` |
| `0x50` | `autonomousAidingSwitch` |
| `0x51` | `aidingAccuracy` |
| `0x52` | `aidingTimeout` |
| `0x53` | `gpsExtremeModeSwitch` |

---

## Bloque 7A — LoRaWAN región + DevEUI/AppEUI (`chunkIndex` 9, `lorawanBasicA`) — **sensible**

**HEX:** `0160616364`

| ID (hex) | Nombre en backend | Nota |
|----------|-------------------|------|
| `0x60` | `region` | **Sensible** |
| `0x61` | `lorawanMode` | **Sensible** |
| `0x63` | PDF: **DevEUI** (`LW001_BG_PRO_PARAM_IDS.DEVEUI`) | **Sensible**; sin clave en `PARAM_NAME_TO_ID` → `id0x63` en runtime |
| `0x64` | PDF: **AppEUI** (`LW001_BG_PRO_PARAM_IDS.APPEUI`) | **Sensible**; sin clave en `PARAM_NAME_TO_ID` → `id0x64` en runtime |

---

## Bloque 7B — LoRaWAN msg / CH / DR (`chunkIndex` 10, `lorawanBasicB`) — **sensible**

**HEX:** `01696a6b6c`

| ID (hex) | Nombre en backend | Nota |
|----------|-------------------|------|
| `0x69` | `messageType` | **Sensible** |
| `0x6a` | `ch` | **Sensible** |
| `0x6b` | `drForJoin` | **Sensible** |
| `0x6c` | `uplinkStrategy` | **Sensible** |

---

## Bloque 7C — LoRaWAN duty / sync / reconnect (`chunkIndex` 11, `lorawanBasicC`)

**HEX:** `016d6e6f`

| ID (hex) | Nombre en backend | Nota |
|----------|-------------------|------|
| `0x6d` | `dutyCycleSwitch` | **Sensible** |
| `0x6e` | `timeSyncInterval` | Seguro |
| `0x6f` | `reconnectInterval` | Seguro |

---

## Bloque 8A — Bluetooth beacon + UUID (`chunkIndex` 12, `bluetoothBroadcastA`)

**HEX:** `017071727374`

| ID (hex) | Nombre en backend |
|----------|---------------------|
| `0x70` | `btBeaconModeSwitch` |
| `0x71` | `btAdvIntervalBeacon` |
| `0x72` | `btConnectableState` |
| `0x73` | `btConfigBroadcastTimeout` |
| `0x74` | `btBeaconUuid` (16 bytes UUID en respuesta) |

---

## Bloque 8B — Bluetooth Major/Minor/Power/Name (`chunkIndex` 13, `bluetoothBroadcastB`)

**HEX:** `0175767778797a`

| ID (hex) | Nombre en backend |
|----------|---------------------|
| `0x75` | `btBeaconMajor` |
| `0x76` | `btBeaconMinor` |
| `0x77` | `btMeasuredPower` |
| `0x78` | `btTxPower` |
| `0x79` | `btAdvName` (hasta 14 bytes ASCII) |
| `0x7a` | `btScanningType` |

---

## Bloque 9A — Axis + shock detalle (`chunkIndex` 14, `sensorsAndAlertsA`) — muy usado en FincaApp

**HEX:** `01808182838485`

| ID (hex) | Nombre en backend | Uso típico en FincaApp |
|----------|-------------------|-------------------------|
| `0x80` | `accelWakeup` | Acelerómetro — despertar |
| `0x81` | `accelMotion` | Acelerómetro — movimiento |
| `0x82` | `shockDetectionSwitch` | Shock on/off |
| `0x83` | `shockThreshold` | Umbral de shock |
| `0x84` | `shockReportInterval` | Intervalo de informe de shock |
| `0x85` | `shockTimeout` | Timeout de shock |

---

## Bloque 9B — Man down + tamper + active state (`chunkIndex` 15, `sensorsAndAlertsB`)

**HEX:** `01868788898a`

| ID (hex) | Nombre en backend | Uso típico en FincaApp |
|----------|-------------------|-------------------------|
| `0x86` | `manDownDetectionSwitch` | Man-down on/off |
| `0x87` | `idleDetectionTimeout` | Timeout detección inactividad |
| `0x88` | `tamperAlarmSwitch` | Tamper on/off |
| `0x89` | `activeStateCountSwitch` | Conteo de estado activo |
| `0x8a` | `activeStateTimeout` | Timeout estado activo |

---

## Bloque 10 — Contraseña Bluetooth (`chunkIndex` 16, `bluetoothPassword`) — sin cambios, respondió OK

**HEX:** `0105`

| ID (hex) | Nombre en backend | Nota |
|----------|-------------------|------|
| `0x05` | `loginPassword` | **Sensible** — contraseña de login Bluetooth (PDF) |

---

## Bloque 11 — Claves LoRaWAN (`chunkIndex` 17, `lorawanKeys`) — sin cambios

**HEX:** `0105656768`

| ID (hex) | Nombre en backend | Nota |
|----------|-------------------|------|
| `0x05` | `loginPassword` | Repetido respecto al bloque 10 (misma trama Read multi-ID) |
| `0x65` | `appKey` | **Sensible** |
| `0x67` | `appsKey` | **Sensible** |
| `0x68` | `nwkSKey` | **Sensible** |

---

## Mantenimiento

Si se añaden IDs nuevos al PDF, se renombran claves en `LW001_BG_PRO_PARAM_NAME_TO_ID`, o se cambia la subdivisión de bloques, actualizar:

1. `READ_BLOCK_DEFINITIONS` y `Lw001BgProReadBlockCategory` en `lw001-bg-pro.constants.ts`
2. Los tests HEX en `device-remote-configuration.service.spec.ts` (`EXPECTED_BLOCK_HEX`)
3. `kLw001BgProSafeReadChunkPresets` en el frontend (`lw001_bg_pro_safe_read_chunks.dart`)
4. Este archivo `docs/lw001-bg-pro-read-blocks.md`
