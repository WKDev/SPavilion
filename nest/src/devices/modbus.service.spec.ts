import { ConfigService } from '@nestjs/config';
import { ModbusService } from './modbus.service';

const defaultStatus = {
  heat: false,
  fan: false,
  btsp: false,
  'light-red': false,
  'light-green': false,
  'light-blue': false,
  'light-white': false,
  display: false,
};

describe('ModbusService (mock mode)', () => {
  let service: ModbusService;

  beforeEach(async () => {
    const configService = new ConfigService({
      modbus: {
        mock: true,
      },
    });
    service = new ModbusService(configService);
    await service.onModuleInit();
  });

  afterEach(async () => {
    await service.onModuleDestroy();
  });

  it('returns default device statuses', () => {
    expect(service.getStatuses().toJSON()).toEqual(defaultStatus);
  });

  it('toggles device state locally', async () => {
    await service.toggleDevice('heat');
    expect(service.getStatuses().toJSON().heat).toBe(true);

    await service.toggleDevice('heat');
    expect(service.getStatuses().toJSON().heat).toBe(false);
  });

  it('allows setting an explicit device state', async () => {
    await service.setDeviceState('fan', true);
    expect(service.getStatuses().toJSON().fan).toBe(true);

    await service.setDeviceState('fan', false);
    expect(service.getStatuses().toJSON().fan).toBe(false);
  });
});
