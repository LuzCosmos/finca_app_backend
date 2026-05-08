import { Controller, Logger } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';

@Controller()
export class MqttController {
  private readonly logger = new Logger(MqttController.name);
  // Subscribe to all events from ChirpStack (you may refine the topic filter as needed)
  
 // @MessagePattern('application/+/device/+/event/+')
 @MessagePattern('application/#')
  handleChirpstackEvent(@Payload() message: any) {
    this.logger.log(
      `ChirpStack event received (microservice handler), payloadType=${typeof message}`,
    );
    // Here you can process the event (e.g., save to database, trigger business logic, etc.)
    return { ack: true };
  }
  @MessagePattern('au915_0/gateway/+/command/+')
  handleGatewayCommand(@Payload() message: any) {
    this.logger.log(
      `Gateway command received (microservice handler), payloadType=${typeof message}`,
    );
    return { ack: true };
  }
}