export const DEVICE_TARGETS = [
  'heat',
  'fan',
  'btsp',
  'light-red',
  'light-green',
  'light-blue',
  'light-white',
  'display',
] as const;

export type DeviceTarget = (typeof DEVICE_TARGETS)[number];
