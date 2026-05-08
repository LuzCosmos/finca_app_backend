import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import * as mqtt from 'mqtt';
import { ConfigService } from '@nestjs/config';
import { LocationService } from '../farm/services/location.service';
import { CreateLocationDto } from '../farm/dto/create-location.dto';
import { Lw001BgProUplinkParserService } from '../production-center/lw001-bg-pro/lw001-bg-pro-uplink-parser.service';
import { DeviceRemoteConfigurationService } from '../production-center/services/device-remote-configuration.service';

@Injectable()
export class MqttService implements OnModuleInit, OnModuleDestroy {
  private client: mqtt.MqttClient;
  private readonly configService: ConfigService;
  private readonly logger: Logger;
  constructor(
    configService: ConfigService,
    private readonly locationService: LocationService,
    private readonly uplinkParser: Lw001BgProUplinkParserService,
    private readonly remoteConfig: DeviceRemoteConfigurationService,
  ) {
    this.configService = configService;
    this.logger = new Logger(MqttService.name);
  }

  handleEvent(message: any) {
    this.logger.debug(`Processing MQTT event (handleEvent), type=${typeof message}`);
  }

  /**
   * Parse ChirpStack uplink JSON, opcionalmente persiste ubicación, y siempre intenta
   * ingest de respuestas Read (MOKO). Nunca propaga errores al cliente MQTT.
   */
  private async processMqttMessage(topic: string, message: Buffer): Promise<void> {
    let parsedMessage: Record<string, unknown>;
    try {
      parsedMessage = JSON.parse(message.toString()) as Record<string, unknown>;
    } catch (e) {
      this.logger.warn(
        `MQTT JSON parse failed (topic=${topic}, bytes=${message.length}): ${e instanceof Error ? e.message : 'unknown'}`,
      );
      return;
    }

    await this.tryPersistLocationFromChirpstackUplink(topic, parsedMessage);

    // Independiente de si el uplink trae GPS: muchos frames (p. ej. heartbeat con Read)
    // no incluyen `rxInfo[0].location` y antes se descartaba todo el mensaje aquí.
    await this.processMokoUplinkForVerification(parsedMessage).catch((e) => {
      this.logger.warn(
        `MOKO verification processing failed: ${e instanceof Error ? e.message : String(e)}`,
      );
    });
  }

  /**
   * Si el JSON de ChirpStack trae coordenadas y tags de FincaApp, persiste un punto.
   * Los `return` son locales a este método — no deben bloquear otras ramas de ingest.
   */
  private async tryPersistLocationFromChirpstackUplink(
    topic: string,
    parsedMessage: Record<string, unknown>,
  ): Promise<void> {
    try {
      const rxInfo = parsedMessage.rxInfo;
      if (!Array.isArray(rxInfo) || rxInfo.length === 0) {
        return;
      }
      const firstRx = rxInfo[0] as Record<string, unknown> | undefined;
      const locationInfo = firstRx?.location as Record<string, unknown> | undefined;
      if (
        !locationInfo ||
        typeof locationInfo.latitude !== 'number' ||
        typeof locationInfo.longitude !== 'number'
      ) {
        return;
      }

      const deviceInfo = parsedMessage.deviceInfo as Record<string, unknown> | undefined;
      const tags = deviceInfo?.tags as Record<string, unknown> | undefined;
      if (!tags || typeof tags !== 'object') {
        return;
      }

      const idTenant = tags.idTenant;
      const idCattle = tags.idCattle;
      const idDevice = tags.idDevice;
      if (
        idTenant === undefined ||
        idTenant === null ||
        idCattle === undefined ||
        idCattle === null ||
        idDevice === undefined ||
        idDevice === null
      ) {
        return;
      }

      let time: Date;
      const rawTime = parsedMessage.time;
      if (rawTime !== undefined && rawTime !== null) {
        time = new Date(rawTime as string | number | Date);
        if (Number.isNaN(time.getTime())) {
          time = new Date();
        }
      } else {
        time = new Date();
      }

      const altitude = locationInfo.altitude;
      const locationDto: CreateLocationDto = {
        idTenant: String(idTenant),
        idDevice: String(idDevice),
        idCattle: String(idCattle),
        latitude: locationInfo.latitude,
        longitude: locationInfo.longitude,
        altitude: typeof altitude === 'number' ? altitude : undefined,
        time,
      };

      await this.locationService.create(locationDto);
    } catch (e) {
      this.logger.error(
        `MQTT location processing failed (topic=${topic}): ${e instanceof Error ? e.message : String(e)}`,
        e instanceof Error ? e.stack : undefined,
      );
    }
  }

  /**
   * Si el uplink trae datos en base64 con un puerto que puede contener respuesta a
   * `Read parameters` (heartbeat fPort 1 o respuesta directa fPort 10), los parsea y dispara
   * verificación de los downlinks pendientes.
   *
   * Puertos aceptados:
   *  - `fPort=1` (heartbeat): a veces el firmware "pega" una respuesta TLV tras la sección
   *    estándar (reason+fw+activeStateCount). El parser solo expone `parameters` si encaja.
   *  - `fPort=10` (general commands response): respuesta directa al CMD `Read` enviada en el
   *    mismo puerto del downlink. Este puerto fue clave para confirmar lecturas en bloques
   *    pequeños (≤ ~16 IDs) cuando el firmware no respondía a lecturas masivas.
   *
   * No lanza nunca: si algo falla, el mensaje MQTT se considera procesado (la verificación es
   * mejor-esfuerzo, no debe bloquear ingest de telemetría).
   */
  private async processMokoUplinkForVerification(
    message: Record<string, unknown>,
  ): Promise<void> {
    const dataB64 = message.data;
    const fPort = message.fPort;
    if (typeof dataB64 !== 'string' || typeof fPort !== 'number') return;

    const deviceInfo = message.deviceInfo as Record<string, unknown> | undefined;
    const tags = deviceInfo?.tags as Record<string, unknown> | undefined;
    const idDevice = tags?.idDevice;
    if (typeof idDevice !== 'string' || idDevice.length === 0) return;

    let payload: Buffer;
    try {
      payload = Buffer.from(dataB64, 'base64');
    } catch {
      return;
    }

    const parsed = this.uplinkParser.parse(fPort, payload);
    if (!parsed.ok) return;
    if (parsed.type !== 'heartbeat' && parsed.type !== 'read_response') return;
    if (!parsed.parameters || parsed.parameters.length === 0) return;

    await this.remoteConfig.processUplinkForVerification({
      idDevice,
      parameters: parsed.parameters.map((p) => ({
        id: p.id,
        name: p.name,
        valueHex: p.valueHex,
      })),
    });
  }

  onModuleInit() {
    const mqttHost = this.configService.get<string>('MQTT_BROKER_HOST');
    if (!mqttHost) {
      throw new Error('MQTT_BROKER_HOST is not defined in environment variables');
    }
    const mqttPort = this.configService.get<string>('MQTT_BROKER_PORT');
    if (!mqttPort) {
      throw new Error('MQTT_BROKER_PORT is not defined in environment variables');
    }
    const mqttProtocol = this.configService.get<string>('MQTT_BROKER_PROTOCOL');
    if (!mqttProtocol) {
      throw new Error('MQTT_BROKER_PROTOCOL is not defined in environment variables');
    }
    const mqttOptions: mqtt.IClientOptions = {
      host: mqttHost,
      port: parseInt(mqttPort),
      protocol: mqttProtocol as mqtt.MqttProtocol,
      reconnectPeriod: 3000,
      connectTimeout: 15000,
      keepalive: 30,
    };
    this.logger.log(`MQTT_BROKER_URL=${mqttProtocol}://${mqttHost}:${mqttPort}`);
    this.client = mqtt.connect(mqttOptions);

    this.client.on('connect', () => {
      this.logger.log('Conectado al servidor MQTT');
      this.client.subscribe('application/#', (err) => {
        if (err) {
          this.logger.error('Error al suscribirse:', err);
        } else {
          this.logger.log('Suscripción exitosa a application/#');
        }
      });
    });
    this.client.on('message', (topic, message) => {
      this.logger.debug(`MQTT mensaje topic=${topic} bytes=${message.length}`);
      void this.processMqttMessage(topic, message).catch((err) => {
        this.logger.error(
          `MQTT processMqttMessage rejected (topic=${topic}): ${err instanceof Error ? err.message : String(err)}`,
        );
      });
    });
    this.client.on('error', (err) => {
      this.logger.error('Error en MQTT:', err);
    });
  }

  onModuleDestroy() {
    if (this.client) {
      this.client.end();
    }
  }
}
