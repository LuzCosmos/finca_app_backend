// src/devices/interfaces/device.interface.ts
export interface ChirpstackDevice {
  applicationId: string;
  description?: string;
  devEui: string;
  deviceProfileId: string;
  isDisabled: boolean;
  joinEui: string;
  name: string;
  skipFcntCheck: boolean;
  tags?: Record<string, string>;
  variables?: Record<string, string>;
}

export interface Device {
  devEui: string;
  deviceName: string;
  deviceProfileId: string;
  description?: string;
  deviceType: 'CATTLE' | 'CLIMATE';
  joinEui?: string;
  isDisabled?: boolean;
  tags?: Record<string, string>;
  variables?: Record<string, string>;
}

// src/devices/interfaces/device-excel.interface.ts
export interface DeviceExcelRow {
  devEui: string;
  deviceName: string;
  deviceType: string;
  deviceProfileId: string;
  joinEui?: string;
  description?: string;
  tags?: string; // Format: "key1:value1,key2:value2"
  variables?: string; // Format: "key1:value1,key2:value2"
}