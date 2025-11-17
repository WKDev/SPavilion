import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { DeviceKind } from '@prisma/client';
import ModbusRTU from 'modbus-serial';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface DeviceState {
  heat: boolean;
  fan: boolean;
  btsp: boolean;
  light_red: boolean;
  light_green: boolean;
  light_blue: boolean;
  light_white: boolean;
  display: boolean;
}

export interface AllDeviceStatus {
  devices: DeviceState;
  coils: boolean[];
  registers: number[];
  isConnected: boolean;
}

export interface PLCConnectionConfig {
  protocol: 'modbusTCP' | 'modbusRTU';
  host?: string;
  port?: number;
  device?: string;
  baudRate?: number;
}

@Injectable()
export class ModbusService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ModbusService.name);
  private client: ModbusRTU;
  private mockTcpClient: ModbusRTU; // TCP client for mock mode
  private pollingInterval: NodeJS.Timeout;
  private previousState: DeviceState;
  private isConnected = false;

  // --- START: In-memory cache for polled data ---
  private cachedCoils: boolean[] = [];
  private cachedRegisters: number[] = [];
  private coilPollRange = { start: 0, count: 20 };
  private registerPollRange = { start: 0, count: 20 };
  // --- END: In-memory cache for polled data ---

  // --- START: Queue Implementation ---
  // A true FIFO queue to serialize all Modbus operations
  private requestQueue: {
    operation: () => Promise<any>;
    resolve: (value: any) => void;
    reject: (reason?: any) => void;
  }[] = [];
  private isProcessingQueue = false;
  // --- END: Queue Implementation ---

  private currentConfig: PLCConnectionConfig; // Current active connection settings

  // PLC configuration file path
  private readonly CONFIG_FILE_PATH = path.join(process.cwd(), 'plc-config.json');

  // Default PLC connection settings
  private readonly DEFAULT_CONFIG: PLCConnectionConfig = {
    protocol: 'modbusRTU',
    device: 'COM3',
    baudRate: 115200
  };

  // Modbus address mapping
  private readonly STATUS_START_ADDR = 0x00; // Read addresses 0x00-0x07
  private readonly CONTROL_START_ADDR = 0x10; // Write addresses 0x10-0x17
  private readonly DEVICE_COUNT = 8;

  private readonly deviceOrder: DeviceKind[] = [
    DeviceKind.heat,
    DeviceKind.fan,
    DeviceKind.btsp,
    DeviceKind.light_red,
    DeviceKind.light_green,
    DeviceKind.light_blue,
    DeviceKind.light_white,
    DeviceKind.display,
  ];

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.client = new ModbusRTU();
    this.mockTcpClient = new ModbusRTU();
    this.previousState = this.createEmptyState();
  }

  async onModuleInit() {
    // Load saved connection settings and auto-connect
    const config = await this.loadConnectionConfig();
    this.currentConfig = config; // Store loaded config
    this.logger.log(`Loading PLC connection config: ${JSON.stringify(config)}`);

    try {
      await this.connectWithSettings(config);
    } catch (error) {
      this.logger.error(`Failed to auto-connect on startup: ${error.message}`);
      this.logger.warn('PLC connection failed. Please configure connection via Settings UI.');
    }
  }

  async onModuleDestroy() {
    this.stopPolling();
    if (this.isConnected) {
      // Close the appropriate client based on current config
      if (this.currentConfig?.protocol === 'modbusTCP' && this.mockTcpClient) {
        this.mockTcpClient.close(() => {
          this.logger.log('Modbus TCP connection closed');
        });
      } else if (this.client) {
        this.client.close(() => {
          this.logger.log('Modbus RTU connection closed');
        });
      }
    }
  }

  private async connect() {
    // Use currentConfig instead of environment variables
    if (!this.currentConfig) {
      this.logger.error('No connection config available. Cannot connect.');
      return;
    }

    const slaveId = parseInt(this.configService.get<string>('PLC_SLAVE_ID', '1'), 10);

    if (this.currentConfig.protocol === 'modbusTCP') {
      // Modbus TCP connection
      const host = this.currentConfig.host || 'mock-modbus';
      const port = this.currentConfig.port || 502;

      try {
        await this.mockTcpClient.connectTCP(host, { port });
        this.mockTcpClient.setID(slaveId);
        this.mockTcpClient.setTimeout(3000);

        // Test connection immediately
        const connectionTest = await this.testMockTcpConnection();
        if (connectionTest) {
          this.isConnected = true;
          this.logger.log(
            `Connected to Modbus TCP at ${host}:${port} (slave ID: ${slaveId})`,
          );
        } else {
          throw new Error('Modbus TCP connection test failed');
        }
      } catch (error) {
        this.logger.error(`Failed to connect to Modbus TCP: ${error.message}`);
        this.isConnected = false;
        // Retry connection after 5 seconds
        setTimeout(() => this.connect(), 5000);
      }
    } else {
      // Modbus RTU connection
      const device = this.currentConfig.device || 'COM3';
      const baudRate = this.currentConfig.baudRate || 115200;

      try {
        await this.client.connectRTUBuffered(device, {
          baudRate,
          dataBits: 8,
          stopBits: 1,
          parity: 'none',
        });

        this.client.setID(slaveId);
        this.client.setTimeout(3000);

        // Test connection immediately (like test-modbus.js)
        const connectionTest = await this.testConnection();
        if (connectionTest) {
          this.isConnected = true;
          this.logger.log(
            `Connected to Modbus RTU at ${device} (${baudRate} baud, slave ID: ${slaveId})`,
          );
        } else {
          throw new Error('Modbus RTU connection test failed');
        }
      } catch (error) {
        this.logger.error(`Failed to connect to Modbus RTU: ${error.message}`);
        this.isConnected = false;

        // IMPORTANT: Close the port before retrying to prevent "Cannot lock port" errors
        try {
          if (this.client && this.client.isOpen) {
            await new Promise<void>((resolve) => {
              this.client.close(() => {
                this.logger.debug('Closed Modbus RTU port after connection failure');
                resolve();
              });
            });
          }
        } catch (closeError) {
          this.logger.error(`Failed to close port: ${closeError.message}`);
        }

        // Retry connection after 5 seconds
        setTimeout(() => this.connect(), 5000);
      }
    }
  }

  private startPolling() {
    this.stopPolling(); // 이전 폴링 루프가 있다면 중지
    this.logger.log('Started PLC polling loop.');
    // 즉시 첫 폴링을 시작하고, this.pollingInterval에 timeout ID를 할당
    this.pollingInterval = setTimeout(() => this.pollDeviceStatus(), 0); 
  }

  private stopPolling() {
    if (this.pollingInterval) {
      clearTimeout(this.pollingInterval);
      this.pollingInterval = null; // null로 설정하여 루프 중단 신호
      this.logger.log('Stopped PLC polling loop.');
    }
  }

  private async pollDeviceStatus() {
    // stopPolling이 호출되었거나 연결이 끊어졌으면 루프를 중단
    if (!this.pollingInterval || !this.isConnected) {
      this.logger.warn('Polling loop terminated or PLC not connected.');
      this.stopPolling();
      return;
    }

    try {
      // 큐를 사용하여 순차적 접근 보장
      await this.executeWithQueue(async () => {
        const client = this.currentConfig?.protocol === 'modbusTCP' ? this.mockTcpClient : this.client;
        
        const deviceStatus = await client.readCoils(this.STATUS_START_ADDR, this.DEVICE_COUNT);
        const coils = await client.readCoils(this.coilPollRange.start, this.coilPollRange.count);
        const registers = await client.readHoldingRegisters(this.registerPollRange.start, this.registerPollRange.count);

        this.logger.debug(`Polled PLC Data:
- Device Status: ${JSON.stringify(deviceStatus.data)}
- Coils (${this.coilPollRange.start}-${this.coilPollRange.start + this.coilPollRange.count -1}): ${JSON.stringify(coils.data)}
- Registers (${this.registerPollRange.start}-${this.registerPollRange.start + this.registerPollRange.count - 1}): ${JSON.stringify(registers.data)}`);

        const currentState = this.createStateFromCoils(deviceStatus.data);
        
        this.cachedCoils = coils.data;
        this.cachedRegisters = registers.data;
        
        await this.detectAndLogChanges(currentState);
        this.previousState = currentState;
      });
    } catch (error) {
      this.logger.error(`Polling execution error: ${error.message}`);
      if (this.isConnected) {
        this.isConnected = false;
        this.logger.warn('PLC connection lost during poll. Attempting to reconnect...');
        this.disconnect().finally(() => {
          setTimeout(() => this.connect(), 5000);
        });
      }
    } finally {
      // 루프가 중단되지 않았다면 다음 폴링을 스케줄
      if (this.pollingInterval) {
        this.pollingInterval = setTimeout(() => this.pollDeviceStatus(), 100);
      }
    }
  }

  private createStateFromCoils(coils: boolean[]): DeviceState {
    return {
      heat: coils[0] || false,
      fan: coils[1] || false,
      btsp: coils[2] || false,
      light_red: coils[3] || false,
      light_green: coils[4] || false,
      light_blue: coils[5] || false,
      light_white: coils[6] || false,
      display: coils[7] || false,
    };
  }

  private createEmptyState(): DeviceState {
    return {
      heat: false,
      fan: false,
      btsp: false,
      light_red: false,
      light_green: false,
      light_blue: false,
      light_white: false,
      display: false,
    };
  }

  private async detectAndLogChanges(currentState: DeviceState) {
    const changesToLog: {
      deviceType: DeviceKind;
      action: string;
      value: number;
    }[] = [];

    for (const deviceKind of this.deviceOrder) {
      const prevValue = this.previousState[deviceKind];
      const currValue = currentState[deviceKind];

      if (prevValue !== currValue) {
        const action = currValue ? 'ON' : 'OFF';
        changesToLog.push({
          deviceType: deviceKind,
          action,
          value: currValue ? 1.0 : 0.0,
        });

        this.logger.debug(
          `Device state change detected: ${deviceKind} = ${action}`,
        );
      }
    }

    if (changesToLog.length > 0) {
      try {
        await this.prisma.deviceUsage.createMany({
          data: changesToLog,
        });
        this.logger.debug(
          `Successfully logged ${changesToLog.length} device state changes to the database.`,
        );
      } catch (error) {
        this.logger.error(
          `Failed to log device changes using createMany: ${error.message}`,
        );
      }
    }
  }

  /**
   * Execute a Modbus request with proper queueing to prevent concurrent access
   * @param operation The async function to execute
   * @param priority If true, adds the operation to the front of the queue
   */
  private executeWithQueue<T>(
    operation: () => Promise<T>,
    priority = false,
  ): Promise<T> {
    // 큐가 2 이상이면 새 요청을 거부 (단, 우선순위가 높은 쓰기 작업은 제외)
    if (this.requestQueue.length >= 3 && !priority) {
      this.logger.warn(
        `[Q] Request rejected. Queue is full (length: ${this.requestQueue.length})`,
      );
      return Promise.reject(
        new Error('Modbus request queue is full. Please try again later.'),
      );
    }

    return new Promise<T>((resolve, reject) => {
      const request = { operation, resolve, reject };
      if (priority) {
        this.requestQueue.unshift(request); // Add to front for high priority
      } else {
        this.requestQueue.push(request); // Add to back for normal priority
      }
      this.logger.debug(`[Q] Added to queue. New length: ${this.requestQueue.length}`);

      if (!this.isProcessingQueue) {
        this.processQueue();
      }
    });
  }

  /**
   * Process the request queue sequentially
   */
  private async processQueue() {
    if (this.isProcessingQueue || this.requestQueue.length === 0) {
      return;
    }
    this.isProcessingQueue = true;

    // Get the next operation from the queue
    const { operation, resolve, reject } = this.requestQueue.shift()!;
    this.logger.debug(`[Q] Processing from queue. Remaining: ${this.requestQueue.length}`);

    let timeoutId: NodeJS.Timeout | null = null;

    try {
      // Create a timeout promise that rejects after 1 seconds
      const timeoutPromise = new Promise((_, rejectPromise) => {
        timeoutId = setTimeout(() => {
          rejectPromise(new Error('Modbus operation timed out after 1 seconds'));
        }, 1000); // 1-second timeout
      });
      
      const result = await Promise.race([operation(), timeoutPromise]);
      resolve(result);
    } catch (error) {
      reject(error);
    } finally {
      // Clear the timeout to prevent it from running unnecessarily
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      
      // Continue processing the queue
      this.isProcessingQueue = false;
      this.processQueue();
    }
  }

  /**
   * Get current device status from the last poll
   */
  getDeviceStatus(): DeviceState {
    if (!this.isConnected) {
      throw new Error('PLC is not connected');
    }
    // Return the most recently polled state, ensuring a fast response.
    return this.previousState;
  }

  async getAllStatus(
    coilRange?: { start: number; count: number },
    registerRange?: { start: number; count: number },
  ): Promise<AllDeviceStatus> {
    // If ranges are provided, perform an immediate read. Otherwise, return cached data.
    if (coilRange && registerRange) {
      return this.executeWithQueue(async () => {
        try {
          const client = this.currentConfig?.protocol === 'modbusTCP' ? this.mockTcpClient : this.client;
          
          // PLC 부하를 줄이기 위해 동시 요청에서 순차 요청으로 변경
          const deviceStatus = await client.readCoils(this.STATUS_START_ADDR, this.DEVICE_COUNT);
          const coils = await client.readCoils(coilRange.start, coilRange.count);
          const registers = await client.readHoldingRegisters(registerRange.start, registerRange.count);

          return {
            devices: this.createStateFromCoils(deviceStatus.data),
            coils: coils.data,
            registers: registers.data,
            isConnected: this.isConnected,
          };
        } catch (error) {
          this.logger.error(`Failed to get immediate all status: ${error.message}`);
          // On error, return the last known good state to avoid UI crashes
          return {
            devices: this.previousState,
            coils: this.cachedCoils,
            registers: this.cachedRegisters,
            isConnected: this.isConnected,
          };
        }
      });
    }

    // Return data directly from the in-memory cache if no specific range is requested
    return {
      devices: this.previousState,
      coils: this.cachedCoils,
      registers: this.cachedRegisters,
      isConnected: this.isConnected,
    };
  }

  /**
   * Update the polling ranges for coils and registers
   */
  updatePollingRanges(ranges: {
    coilStart?: number;
    coilCount?: number;
    registerStart?: number;
    registerCount?: number;
  }): void {
    if (ranges.coilStart !== undefined && ranges.coilCount !== undefined) {
      this.coilPollRange = { start: ranges.coilStart, count: ranges.coilCount };
      this.logger.log(`Updated coil polling range to ${JSON.stringify(this.coilPollRange)}`);
    }
    if (ranges.registerStart !== undefined && ranges.registerCount !== undefined) {
      this.registerPollRange = { start: ranges.registerStart, count: ranges.registerCount };
      this.logger.log(`Updated register polling range to ${JSON.stringify(this.registerPollRange)}`);
    }
    // The next background poll will automatically use these new ranges.
  }

  /**
   * Toggle a device (write to control coil)
   */
  async toggleDevice(deviceKind: DeviceKind): Promise<void> {
    if (!this.isConnected) {
      throw new Error('PLC is not connected');
    }

    const deviceIndex = this.deviceOrder.indexOf(deviceKind);
    if (deviceIndex === -1) {
      throw new Error(`Invalid device kind: ${deviceKind}`);
    }

    const controlAddress = this.CONTROL_START_ADDR + deviceIndex;

    // This entire read-modify-write operation is now atomic within the queue
    // Set priority=true to process this write request before pending reads
    return this.executeWithQueue(async () => {
      try {
        if (this.currentConfig?.protocol === 'modbusTCP') {
          // Modbus TCP: Mock a momentary button press
          this.logger.debug(
            `[Q] Toggling TCP device ${deviceKind} (addr: ${controlAddress}) - sending TRUE`,
          );
          await this.mockTcpClient.writeCoil(controlAddress, true);

          // The delayed FALSE signal must also be queued to prevent conflicts
          setTimeout(() => {
            this.executeWithQueue(async () => {
              this.logger.debug(
                `[Q] Toggling TCP device ${deviceKind} (addr: ${controlAddress}) - sending FALSE`,
              );
              await this.mockTcpClient.writeCoil(controlAddress, false);
            }, true).catch((e) => this.logger.error(`Failed to send FALSE: ${e.message}`)); // Also high priority
          }, 100);

        } else {
          // Modbus RTU: Read current state, then write the opposite
          this.logger.debug(`[Q] Toggling RTU device ${deviceKind} (addr: ${controlAddress}) - reading state`);
          const result = await this.client.readCoils(
            this.STATUS_START_ADDR,
            this.DEVICE_COUNT,
          );
          const currentState = this.createStateFromCoils(result.data);
          const currentValue = currentState[deviceKind];
          const newValue = !currentValue;

          this.logger.debug(
            `[Q] Toggling RTU device ${deviceKind} (addr: ${controlAddress}) - writing ${newValue}`,
          );
          await this.client.writeCoil(controlAddress, newValue);
        }

        this.logger.log(
          `Toggled device ${deviceKind} at address 0x${controlAddress.toString(
            16,
          )}`,
        );
      } catch (error) {
        this.logger.error(`Failed to toggle device: ${error.message}`);
        throw error;
      }
    }, true);
  }

  /**
   * Momentary switch: Send momentary pulse for rising edge detection
   * Sends true immediately, then false after 100ms
   */
  async momentarySwitch(deviceKind: DeviceKind): Promise<void> {
    if (!this.isConnected) {
      throw new Error('PLC is not connected');
    }

    const deviceIndex = this.deviceOrder.indexOf(deviceKind);
    if (deviceIndex === -1) {
      throw new Error(`Invalid device kind: ${deviceKind}`);
    }

    const controlAddress = this.CONTROL_START_ADDR + deviceIndex;

    // The entire operation is queued with high priority
    return this.executeWithQueue(async () => {
      const client = this.currentConfig?.protocol === 'modbusTCP' ? this.mockTcpClient : this.client;
      try {
        // Send TRUE
        this.logger.debug(
          `[Q] Momentary switch ${deviceKind} (addr: ${controlAddress}) - sending TRUE`,
        );
        await client.writeCoil(controlAddress, true);
        this.logger.log(
          `Momentary switch ${deviceKind} at address 0x${controlAddress.toString(
            16,
          )} - sent TRUE`,
        );

        // Send FALSE after a delay, also queued with high priority
        setTimeout(() => {
          this.executeWithQueue(async () => {
            this.logger.debug(
              `[Q] Momentary switch ${deviceKind} (addr: ${controlAddress}) - sending FALSE`,
            );
            await client.writeCoil(controlAddress, false);
            this.logger.log(
              `Momentary switch ${deviceKind} at address 0x${controlAddress.toString(
                16,
              )} - sent FALSE`,
            );
          }, true).catch((e) => this.logger.error(`Failed to send FALSE for momentary switch: ${e.message}`));
        }, 100);
      } catch (error) {
        this.logger.error(`Failed to execute momentary switch: ${error.message}`);
        throw error;
      }
    }, true);
  }

  /**
   * Set a specific device state
   */
  async setDevice(deviceKind: DeviceKind, value: boolean): Promise<void> {
    if (!this.isConnected) {
      throw new Error('PLC is not connected');
    }

    const deviceIndex = this.deviceOrder.indexOf(deviceKind);
    if (deviceIndex === -1) {
      throw new Error(`Invalid device kind: ${deviceKind}`);
    }

    const controlAddress = this.CONTROL_START_ADDR + deviceIndex;

    // The write operation is queued with high priority
    return this.executeWithQueue(async () => {
      const client = this.currentConfig?.protocol === 'modbusTCP' ? this.mockTcpClient : this.client;
      try {
        this.logger.debug(
          `[Q] Setting device ${deviceKind} (addr: ${controlAddress}) to ${value}`,
        );
        await client.writeCoil(controlAddress, value);
        this.logger.log(
          `Set device ${deviceKind} to ${value} at address 0x${controlAddress.toString(
            16,
          )}`,
        );
      } catch (error) {
        this.logger.error(`Failed to set device: ${error.message}`);
        throw error;
      }
    }, true);
  }

  /**
   * Check if PLC is connected
   */
  isPlcConnected(): boolean {
    return this.isConnected;
  }

  /**
   * Test connection by reading a single coil
   */
  private async testConnection(): Promise<boolean> {
    try {
      await this.client.readCoils(0, 1);
      return true;
    } catch (error) {
      this.logger.warn(`Connection test failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Test mock TCP connection by reading a single coil
   */
  private async testMockTcpConnection(): Promise<boolean> {
    try {
      await this.mockTcpClient.readCoils(0, 1);
      return true;
    } catch (error) {
      this.logger.warn(`Mock TCP connection test failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Read multiple coils
   */
  async readCoils(startAddress: number, count: number): Promise<boolean[]> {
    if (!this.isConnected) {
      throw new Error('PLC is not connected');
    }

    return this.executeWithQueue(async () => {
      try {
        const client = this.currentConfig?.protocol === 'modbusTCP' ? this.mockTcpClient : this.client;
        const result = await client.readCoils(startAddress, count);
        return result.data;
      } catch (error) {
        this.logger.error(
          `Failed to read coils ${startAddress}-${
            startAddress + count - 1
          }: ${error.message}`,
        );
        throw error;
      }
    });
  }

  /**
   * Write a single coil
   */
  async writeCoil(address: number, value: boolean): Promise<void> {
    if (!this.isConnected) {
      throw new Error('PLC is not connected');
    }

    return this.executeWithQueue(async () => {
      try {
        const client = this.currentConfig?.protocol === 'modbusTCP' ? this.mockTcpClient : this.client;
        this.logger.debug(`[Q] Writing coil ${address} = ${value}`);
        await client.writeCoil(address, value);
        this.logger.debug(`Wrote coil ${address} = ${value}`);
      } catch (error) {
        this.logger.error(`Failed to write coil ${address}: ${error.message}`);
        throw error;
      }
    }, true);
  }

  /**
   * Read multiple holding registers
   */
  async readHoldingRegisters(startAddress: number, count: number): Promise<number[]> {
    if (!this.isConnected) {
      throw new Error('PLC is not connected');
    }

    return this.executeWithQueue(async () => {
      try {
        const client = this.currentConfig?.protocol === 'modbusTCP' ? this.mockTcpClient : this.client;
        const result = await client.readHoldingRegisters(startAddress, count);
        return result.data;
      } catch (error) {
        this.logger.error(
          `Failed to read registers ${startAddress}-${
            startAddress + count - 1
          }: ${error.message}`,
        );
        throw error;
      }
    });
  }

  /**
   * Write a single holding register
   */
  async writeRegister(address: number, value: number): Promise<void> {
    if (!this.isConnected) {
      throw new Error('PLC is not connected');
    }

    return this.executeWithQueue(async () => {
      try {
        const client = this.currentConfig?.protocol === 'modbusTCP' ? this.mockTcpClient : this.client;
        this.logger.debug(`[Q] Writing register ${address} = ${value}`);
        await client.writeRegister(address, value);
        this.logger.debug(`Wrote register ${address} = ${value}`);
      } catch (error) {
        this.logger.error(`Failed to write register ${address}: ${error.message}`);
        throw error;
      }
    }, true);
  }

  /**
   * Connect with custom settings
   */
  async connectWithSettings(settings: {
    protocol: 'modbusTCP' | 'modbusRTU';
    host?: string;
    port?: number;
    device?: string;
    baudRate?: number;
  }): Promise<{ success: boolean; message: string }> {
    // Prevent re-connection if already connected with the same settings
    if (this.isConnected) {
      const currentSettings = await this.getCurrentConnectionSettings();
      const isSameConnection =
        currentSettings.protocol === settings.protocol &&
        (settings.protocol === 'modbusTCP'
          ? currentSettings.host === settings.host && currentSettings.port === settings.port
          : currentSettings.device === settings.device && currentSettings.baudRate === settings.baudRate);

      if (isSameConnection) {
        this.logger.log('Already connected with the same settings. Skipping connection attempt.');
        return {
          success: true,
          message: 'Already connected with the same settings.',
        };
      }
    }
    
    const MAX_RETRIES = 5;
    const RETRY_DELAY = 3000; // 3 seconds

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        // Disconnect if already connected
        if (this.isConnected) {
          await this.disconnect();
        }

        this.stopPolling();

        const slaveId = parseInt(
          this.configService.get<string>('PLC_SLAVE_ID', '1'),
          10,
        );

        if (settings.protocol === 'modbusTCP') {
          // Connect via Modbus TCP
          const host =
            settings.host ||
            this.configService.get<string>('MOCK_PLC_HOST', 'localhost');
          const port =
            settings.port ||
            parseInt(
              this.configService.get<string>('MOCK_PLC_PORT', '502'),
              10,
            );

          this.mockTcpClient = new ModbusRTU(); // New instance for clean connection

          await this.mockTcpClient.connectTCP(host, { port });
          this.mockTcpClient.setID(slaveId);
          this.mockTcpClient.setTimeout(2000);

          const connectionTest = await this.testMockTcpConnection();
          if (connectionTest) {
            this.isConnected = true;
            this.logger.log(
              `Connected to Modbus TCP at ${host}:${port} (slave ID: ${slaveId})`,
            );
            this.currentConfig = settings;
            await this.saveConnectionConfig(settings);
            this.startPolling();
            return {
              success: true,
              message: `Connected to Modbus TCP at ${host}:${port}`,
            };
          } else {
            throw new Error('Modbus TCP connection test failed');
          }
        } else {
          // Connect via Modbus RTU
          const device =
            settings.device || this.configService.get<string>('PLC_PORT', 'COM3');
          const baudRate =
            settings.baudRate ||
            parseInt(
              this.configService.get<string>('PLC_BAUD_RATE', '115200'),
              10,
            );

          this.client = new ModbusRTU(); // New instance for clean connection

          await this.client.connectRTUBuffered(device, {
            baudRate,
            dataBits: 8,
            stopBits: 1,
            parity: 'none',
          });

          this.client.setID(slaveId);
          this.client.setTimeout(3000);

          this.logger.log(
            `Testing connection... ${device} (${baudRate} baud, slave ID: ${slaveId})`,
          );

          const connectionTest = await this.testConnection();
          if (connectionTest) {
            this.isConnected = true;
            this.logger.log(
              `Connected to PLC at ${device} (${baudRate} baud, slave ID: ${slaveId})`,
            );
            this.currentConfig = settings;
            await this.saveConnectionConfig(settings);
            this.startPolling();
            return {
              success: true,
              message: `Connected to Modbus RTU at ${device} (${baudRate} baud)`,
            };
          } else {
            throw new Error('Modbus RTU connection test failed');
          }
        }
      } catch (error) {
        this.logger.warn(
          `Connection attempt ${attempt}/${MAX_RETRIES} failed: ${error.message}`,
        );
        this.isConnected = false;

        // Ensure connection is fully closed before retrying
        try {
          if (
            settings.protocol === 'modbusTCP' &&
            this.mockTcpClient &&
            this.mockTcpClient.isOpen
          ) {
            await new Promise<void>((resolve) => {
              this.mockTcpClient.close(() => {
                this.logger.debug(
                  'Closed Modbus TCP connection after failure',
                );
                resolve();
              });
            });
          } else if (
            settings.protocol === 'modbusRTU' &&
            this.client &&
            this.client.isOpen
          ) {
            await new Promise<void>((resolve) => {
              this.client.close(() => {
                this.logger.debug('Closed Modbus RTU port after failure');
                resolve();
              });
            });
          }
        } catch (closeError) {
          this.logger.error(
            `Failed to close connection after error: ${closeError.message}`,
          );
        }

        if (attempt === MAX_RETRIES) {
          this.logger.error(
            `Failed to connect after ${MAX_RETRIES} attempts. Last error: ${error.message}`,
          );
          throw new Error(
            `Connection failed after ${MAX_RETRIES} retries: ${error.message}`,
          );
        }

        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
      }
    }
    // This part should be unreachable if MAX_RETRIES > 0
    throw new Error('Connection failed unexpectedly after retry loop.');
  }

  /**
   * Disconnect from PLC
   */
  async disconnect(): Promise<void> {
    try {
      this.stopPolling();

      if (this.isConnected) {
        // Close RTU client if it exists
        if (this.client) {
          await new Promise<void>((resolve) => {
            this.client.close(() => {
              this.logger.log('Modbus RTU connection closed');
              resolve();
            });
          });
        }

        // Close TCP client if it exists
        if (this.mockTcpClient) {
          await new Promise<void>((resolve) => {
            this.mockTcpClient.close(() => {
              this.logger.log('Mock Modbus TCP connection closed');
              resolve();
            });
          });
        }

        this.isConnected = false;
        this.logger.log('Disconnected from PLC');

        // Wait a bit to ensure connection is fully closed
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } catch (error) {
      this.logger.error(`Failed to disconnect: ${error.message}`);
      // Don't throw, just log the error
    }
  }

  /**
   * Load PLC connection configuration from file
   * Returns default config if file doesn't exist
   */
  private async loadConnectionConfig(): Promise<PLCConnectionConfig> {
    try {
      const fileContent = await fs.readFile(this.CONFIG_FILE_PATH, 'utf-8');
      const config = JSON.parse(fileContent) as PLCConnectionConfig;
      this.logger.log(`Loaded PLC config from file: ${this.CONFIG_FILE_PATH}`);
      return config;
    } catch (error) {
      if (error.code === 'ENOENT') {
        this.logger.log(`Config file not found. Using default config: ${JSON.stringify(this.DEFAULT_CONFIG)}`);
        return this.DEFAULT_CONFIG;
      }
      this.logger.error(`Failed to load config file: ${error.message}. Using default config.`);
      return this.DEFAULT_CONFIG;
    }
  }

  /**
   * Save PLC connection configuration to file
   */
  private async saveConnectionConfig(config: PLCConnectionConfig): Promise<void> {
    try {
      await fs.writeFile(this.CONFIG_FILE_PATH, JSON.stringify(config, null, 2), 'utf-8');
      this.logger.log(`Saved PLC config to file: ${this.CONFIG_FILE_PATH}`);
    } catch (error) {
      this.logger.error(`Failed to save config file: ${error.message}`);
      // Don't throw, just log the error
    }
  }

  /**
   * Get current PLC connection configuration
   * Public method for API access
   */
  async getCurrentConnectionSettings(): Promise<PLCConnectionConfig> {
    return this.loadConnectionConfig();
  }

}
