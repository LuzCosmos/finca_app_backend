import { mapDeviceToListItem } from './device-list.mapper';
import { Device } from '../entities/device.entity';

describe('mapDeviceToListItem', () => {
  it('maps fields without secrets', () => {
    const device = {
      id: 'id-1',
      name: 'LW001-BG-0708',
      deveui: '0102030405060708',
      isActive: true,
      batteryStatus: '85%',
      batteryUpdate: new Date('2026-01-01T12:00:00Z'),
      csAppKey: 'secret-app-key',
      csNwkKey: 'secret-nwk-key',
      deviceProfile: { name: 'LW001 Profile' },
    } as Device;

    const dto = mapDeviceToListItem(device);

    expect(dto).toEqual({
      id: 'id-1',
      name: 'LW001-BG-0708',
      deveui: '0102030405060708',
      isActive: true,
      batteryStatus: '85%',
      batteryUpdate: device.batteryUpdate,
      deviceProfileName: 'LW001 Profile',
    });
    expect(dto).not.toHaveProperty('csAppKey');
    expect(dto).not.toHaveProperty('csNwkKey');
  });

  it('handles null battery and missing profile', () => {
    const device = {
      id: 'id-2',
      name: 'Collar B',
      deveui: 'aabbccddeeff0011',
      isActive: false,
      batteryStatus: null,
      batteryUpdate: null,
    } as unknown as Device;

    const dto = mapDeviceToListItem(device);

    expect(dto.isActive).toBe(false);
    expect(dto.batteryStatus).toBeNull();
    expect(dto.batteryUpdate).toBeNull();
    expect(dto.deviceProfileName).toBeNull();
  });
});
