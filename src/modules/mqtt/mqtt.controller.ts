import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';

@Controller()
export class MqttController {
  // Subscribe to all events from ChirpStack (you may refine the topic filter as needed)
  
 // @MessagePattern('application/+/device/+/event/+')
 @MessagePattern('application/#')
  handleChirpstackEvent(@Payload() message: any) {
    console.log('Received ChirpStack event:', message);
    // Here you can process the event (e.g., save to database, trigger business logic, etc.)
    return { ack: true };
  }
  @MessagePattern('au915_0/gateway/+/command/+')
  handleGatewayCommand(@Payload() message: any) {
    console.log('Received gateway command:', message);
    return { ack: true };
  }
}