import { Device } from '../entities/device.entity';
import { DeviceListItemResponseDto } from '../dto/device-list-item-response.dto';

export function mapDeviceToListItem(device: Device): DeviceListItemResponseDto {
  return {
    id: device.id,
    name: device.name,
    deveui: device.deveui,
    isActive: device.isActive,
    batteryStatus: device.batteryStatus ?? null,
    batteryUpdate: device.batteryUpdate ?? null,
    deviceProfileName: device.deviceProfile?.name ?? null,
  };
}
