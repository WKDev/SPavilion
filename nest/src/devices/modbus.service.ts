import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import ModbusRTU from 'modbus-serial';
import { ConfigService } from '@nestjs/config';
import { DEVICE_TARGETS, DeviceTarget } from './device-target';
import { DeviceStatusDto, DeviceStatusRecord } from './dto/device-status.dto';

type DeviceRegisterMap = Record<DeviceTarget, number>;

const POLL_INTERVAL_MS = 100;

@Injectable()
export class ModbusService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ModbusService.name);
  private client: ModbusRTU | null = null;
  private pollTimer?: NodeJS.Timeout;
  private readonly statuses: DeviceStatusRecord;
  private readonly registerMap: DeviceRegisterMap = {
    heat: 0,
    fan: 1,
    btsp: 2,
    'light-red': 3,
    'light-green': 4,
    'light-blue': 5,
    'light-white': 6,
    display: 7,
  };

  constructor(private readonly configService: ConfigService) {
    this.statuses = DEVICE_TARGETS.reduce<DeviceStatusRecord>((acc, target) => {
      acc[target] = false;
      return acc;
    }, {} as DeviceStatusRecord);
  }

  private get isMock(): boolean {
    return this.configService.get('modbus.mock', true);
  }

  private get unitId(): number {
    return this.configService.get('modbus.unitId', 1);
  }

  async onModuleInit(): Promise<void> {
    if (this.isMock) {
      this.logger.log('MODBUS_MOCK enabled; using in-memory device state');
      return;
    }

    try {
      await this.connectClient();
      await this.refreshStatuses();
      this.startPolling();
    } catch (error) {
      this.logger.error('Unable to initialize Modbus client; falling back to mock', error as Error);
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = undefined;
    }
    if (this.client) {
      await this.client.close();
      this.client = null;
    }
  }

  getStatuses(): DeviceStatusDto {
    return new DeviceStatusDto({ ...this.statuses });
  }

  async toggleDevice(target: DeviceTarget): Promise<DeviceStatusDto> {
    if (this.isMock || !this.client) {
      this.statuses[target] = !this.statuses[target];
      return this.getStatuses();
    }

    const register = this.registerMap[target];
    try {
      const current = await this.readCoil(register);
      await this.client.writeCoil(register, !current);
      this.statuses[target] = !current;
    } catch (error) {
      this.logger.error(`Failed to toggle ${target}`, error as Error);
      throw error;
    }

    return this.getStatuses();
  }

  async setDeviceState(target: DeviceTarget, desired: boolean): Promise<DeviceStatusDto> {
    if (this.isMock || !this.client) {
      this.statuses[target] = desired;
      return this.getStatuses();
    }

    const register = this.registerMap[target];
    try {
      await this.client.writeCoil(register, desired);
      this.statuses[target] = desired;
    } catch (error) {
      this.logger.error(`Failed to set ${target}`, error as Error);
      throw error;
    }

    return this.getStatuses();
  }

  private async connectClient(): Promise<void> {
    const port = this.configService.get<string>('modbus.port');
    const baudRate = this.configService.get<number>('modbus.baudRate', 9600);
    const tcpHost = this.configService.get<string>('modbus.tcpHost');
    const tcpPort = this.configService.get<number>('modbus.tcpPort', 502);

    this.client = new ModbusRTU();
    this.client.setID(this.unitId);

    if (tcpHost) {
      await this.client.connectTCP(tcpHost, { port: tcpPort });
      this.logger.log(`Connected to Modbus TCP at ${tcpHost}:${tcpPort}`);
    } else if (port) {
      await this.client.connectRTUBuffered(port, { baudRate });
      this.logger.log(`Connected to Modbus serial port ${port} @${baudRate} baud`);
    } else {
      throw new Error('No Modbus connection details provided');
    }
  }

  private startPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
    }
    this.pollTimer = setInterval(async () => {
      try {
        await this.refreshStatuses();
      } catch (error) {
        this.logger.warn(`Polling error: ${(error as Error).message}`);
      }
    }, POLL_INTERVAL_MS);
  }

  private async refreshStatuses(): Promise<void> {
    if (!this.client) {
      return;
    }
    for (const target of DEVICE_TARGETS) {
      const register = this.registerMap[target];
      this.statuses[target] = await this.readCoil(register);
    }
  }

  private async readCoil(register: number): Promise<boolean> {
    if (!this.client) {
      return false;
    }
    const response = await this.client.readCoils(register, 1);
    return Boolean(response.data?.[0]);
  }
}
