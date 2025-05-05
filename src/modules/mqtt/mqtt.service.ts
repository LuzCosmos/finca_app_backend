import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import * as mqtt from 'mqtt';
import { ConfigService } from '@nestjs/config';
import { LocationService } from '../farm/services/location.service';

@Injectable()
export class MqttService implements OnModuleInit, OnModuleDestroy {
  private client: mqtt.MqttClient;
  private readonly configService: ConfigService;
  private readonly logger: Logger;
  constructor(configService: ConfigService, 
    private readonly locationService: LocationService) {
    this.configService = configService;
    this.logger = new Logger(MqttService.name);
  }

  handleEvent(message: any) {
    // Process the MQTT event here (e.g., logging or saving to database)
    this.logger.debug('Processing MQTT event:', message);
  }

  onModuleInit() {
    const mqttUrl = this.configService.get<string>('MQTT_BROKER_URL');
    if (!mqttUrl) {
      throw new Error('MQTT_BROKER_URL is not defined in environment variables');
    }
    this.client = mqtt.connect(mqttUrl);

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
      this.logger.log(`Mensaje recibido en ${topic}`);
      this.logger.debug(message.toString());
      const parsedMessage = JSON.parse(message.toString());
      this.logger.debug(`Parsed message: ${JSON.stringify(parsedMessage)}`);
      const info = parsedMessage.rxInfo;
      this.logger.debug(info);
      if(info !== undefined) {
        const locationInfo = info[0].location;
        this.logger.debug(`Location info: ${JSON.stringify(locationInfo)}`);
        if(locationInfo !== undefined) {
          const idTenant = parsedMessage.deviceInfo.tags.idTenant;
          const idCattle = parsedMessage.deviceInfo.tags.idCattle;
          const idDevice = parsedMessage.deviceInfo.tags.idDevice;
          if(idCattle !== undefined && idDevice !== undefined && idTenant !== undefined) {
            const locationDto = {
              idTenant: idTenant,
              idDevice: idDevice,
              idCattle: idCattle,
              latitude: locationInfo.latitude,
              longitude: locationInfo.longitude,
              altitude: locationInfo.altitude,
              time: new Date(parsedMessage.time),
            };
            this.locationService.create(locationDto);
          }
        }
      }
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