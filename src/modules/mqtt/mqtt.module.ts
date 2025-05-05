import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { MqttController } from './mqtt.controller';
import { MqttService } from './mqtt.service';
import { FarmModule } from '../farm/farm.module';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'MQTT_SERVICE',
        transport: Transport.MQTT,
        options: {
          url: process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883',
          // You can also set additional MQTT options here if needed.
        },
      },
    ]),
    FarmModule
  ],
  controllers: [MqttController],
  providers: [MqttService],
  exports: [MqttService],
})
export class MqttModule {}


/*
Mensaje recibido en application/84000af8-44f6-496c-8cfe-f0b3b698d70a/device/d173ecffffeabab8/event/up:
 {
"deduplicationId":"72e64fcf-01ca-44e8-9ed4-6183cb7944d7",
"time":"2025-05-05T00:18:24.047878683+00:00",
"deviceInfo":{
  "tenantId":"52f14cd4-c6f1-4fbd-8f87-4025e1d49242","tenantName":"ChirpStack","applicationId":"84000af8-44f6-496c-8cfe-f0b3b698d70a","applicationName":"CattleTracking","deviceProfileId":"0baa23f6-aa00-43e1-9848-4c4dc32f9812","deviceProfileName":"LW001-BG Pro","deviceName":"LW001-GB-d173ecffffeabab8","devEui":"d173ecffffeabab8","deviceClassEnabled":"CLASS_A",
  "tags":{
    "idDevice":"4f2b33df-4af1-4fb2-bce4-03a99e53814f","idCattle":"85209f19-92a0-4747-9214-c70a4527506e"
  }
},
"devAddr":"011fb3a3",
"adr":true,
"dr":5,
"fCnt":111,
"fPort":2,
"confirmed":false,
"data":"CxrgAAfpBQUFEhgFFawfCRitZdVg0khgQLLGbGOcQ2SNwA==",
"rxInfo":[{"gatewayId":"ac1f09fffe18ad64","uplinkId":37132,"nsTime":"2025-05-05T00:18:23.826378044+00:00","rssi":-52,"snr":11.5,"channel":1,
"location":{"latitude":6.26023,"longitude":-75.55968,"altitude":1553.0},"context":"yweBGg==","crcStatus":"CRC_OK"}],


"txInfo":{"frequency":915400000,"modulation":{"lora":{"bandwidth":125000,"spreadingFactor":7,"codeRate":"CR_4_5"}}},"regionConfigId":"au915_0"}

*/