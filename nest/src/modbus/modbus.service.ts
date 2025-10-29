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
  private isReading = false; // Flag to prevent concurrent reads
  private requestQueue: Array<() => Promise<any>> = []; // Request queue for serialization

  // PLC configuration file path
  private readonly CONFIG_FILE_PATH = path.join(process.cwd(), 'plc-config.json');

  // Default PLC connection settings
  private readonly DEFAULT_CONFIG: PLCConnectionConfig = {
    protocol: 'modbusTCP',
    host: 'mock-modbus',
    port: 502,
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
      this.client.close(() => {
        this.logger.log('Modbus connection closed');
      });
    }
    // Close mock TCP client if connected
    const mockMode = this.configService.get<string>('MOCK_MODE', 'false');
    if (mockMode === 'true' && this.mockTcpClient) {
      this.mockTcpClient.close(() => {
        this.logger.log('Mock Modbus TCP connection closed');
      });
    }
  }

  private async connect() {
    const mockMode = this.configService.get<string>('MOCK_MODE', 'false');
    
    if (mockMode === 'true') {
      // Mock 모드: Modbus TCP 서버에 연결
      const host = this.configService.get<string>('MOCK_PLC_HOST', 'mock-modbus');
      const port = parseInt(this.configService.get<string>('MOCK_PLC_PORT', '502'), 10);
      const slaveId = parseInt(this.configService.get<string>('PLC_SLAVE_ID', '1'), 10);

      try {
        await this.mockTcpClient.connectTCP(host, { port });
        this.mockTcpClient.setID(slaveId);
        this.mockTcpClient.setTimeout(10000);

        // Wait for connection to stabilize
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Test connection
        const connectionTest = await this.testMockTcpConnection();
        if (connectionTest) {
          this.isConnected = true;
          this.logger.log(
            `Mock mode enabled - Connected to Modbus TCP at ${host}:${port} (slave ID: ${slaveId})`,
          );
        } else {
          throw new Error('Mock TCP connection test failed');
        }
      } catch (error) {
        this.logger.error(`Failed to connect to mock PLC: ${error.message}`);
        this.isConnected = false;
        // Retry connection after 5 seconds
        setTimeout(() => this.connect(), 5000);
      }
    } else {
      // 실제 하드웨어 모드: 시리얼 연결
      const port = this.configService.get<string>('PLC_PORT', '/dev/ttyUSB0');
      const baudRate = parseInt(this.configService.get<string>('PLC_BAUD_RATE', '9600'), 10);
      const slaveId = parseInt(this.configService.get<string>('PLC_SLAVE_ID', '1'), 10);

      try {
        await this.client.connectRTUBuffered(port, {
          baudRate,
          dataBits: 8,
          stopBits: 1,
          parity: 'none',
        });

        this.client.setID(slaveId);
        this.client.setTimeout(10000); // 타임아웃을 10초로 증가

        // Wait for connection to stabilize
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Test connection
        const connectionTest = await this.testConnection();
        if (connectionTest) {
          this.isConnected = true;
          this.logger.log(
            `Connected to PLC at ${port} (${baudRate} baud, slave ID: ${slaveId})`,
          );
        } else {
          throw new Error('Connection test failed');
        }
      } catch (error) {
        this.logger.error(`Failed to connect to PLC: ${error.message}`);
        this.isConnected = false;
        // Retry connection after 5 seconds
        setTimeout(() => this.connect(), 5000);
      }
    }
  }

  private startPolling() {
    // Poll every 500ms (0.5 seconds) - increased for network stability
    this.pollingInterval = setInterval(() => {
      this.pollDeviceStatus();
    }, 500);
    this.logger.log('Started PLC polling (500ms interval)');
  }

  private stopPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.logger.log('Stopped PLC polling');
    }
  }

  private async pollDeviceStatus() {
    if (!this.isConnected || this.isReading) {
      return; // Skip if already reading
    }

    this.isReading = true;
    try {
      const mockMode = this.configService.get<string>('MOCK_MODE', 'false');
      
      let currentState: DeviceState;
      
      if (mockMode === 'true') {
        // Mock 모드: Modbus TCP 서버에서 읽기
        const result = await this.mockTcpClient.readCoils(
          this.STATUS_START_ADDR,
          this.DEVICE_COUNT,
        );
        currentState = this.createStateFromCoils(result.data);
      } else {
        // 실제 하드웨어 모드: PLC에서 읽기
        const result = await this.client.readCoils(
          this.STATUS_START_ADDR,
          this.DEVICE_COUNT,
        );
        currentState = this.createStateFromCoils(result.data);
      }

      // Detect state changes and log to database
      await this.detectAndLogChanges(currentState);

      this.previousState = currentState;
    } catch (error) {
      this.logger.error(`Polling error: ${error.message}`);
      this.isConnected = false;
      // Attempt to reconnect after a short delay
      setTimeout(() => {
        this.logger.log('Attempting to reconnect to PLC...');
        this.connect();
      }, 2000);
    } finally {
      this.isReading = false;
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
    for (const deviceKind of this.deviceOrder) {
      const prevValue = this.previousState[deviceKind];
      const currValue = currentState[deviceKind];

      if (prevValue !== currValue) {
        const action = currValue ? 'ON' : 'OFF';

        // Log to database
        try {
          await this.prisma.deviceUsage.create({
            data: {
              deviceType: deviceKind,
              action,
              value: currValue ? 1.0 : 0.0,
            },
          });

          this.logger.debug(
            `Device state change: ${deviceKind} = ${action}`,
          );
        } catch (error) {
          this.logger.error(
            `Failed to log device change: ${error.message}`,
          );
        }
      }
    }
  }

  /**
   * Execute a Modbus request with proper queueing to prevent concurrent access
   */
  private async executeWithQueue<T>(operation: () => Promise<T>): Promise<T> {
    // Wait until no other operation is in progress
    while (this.isReading) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    this.isReading = true;
    try {
      return await operation();
    } finally {
      this.isReading = false;
    }
  }

  /**
   * Get current device status
   */
  async getDeviceStatus(): Promise<DeviceState> {
    if (!this.isConnected) {
      throw new Error('PLC is not connected');
    }

    const mockMode = this.configService.get<string>('MOCK_MODE', 'false');
    
    if (mockMode === 'true') {
      // Mock 모드: Modbus TCP 서버에서 읽기
      return this.executeWithQueue(async () => {
        try {
          const result = await this.mockTcpClient.readCoils(
            this.STATUS_START_ADDR,
            this.DEVICE_COUNT,
          );
          return this.createStateFromCoils(result.data);
        } catch (error) {
          this.logger.error(`Failed to read device status from mock server: ${error.message}`);
          throw error;
        }
      });
    }

    return this.executeWithQueue(async () => {
      try {
        const result = await this.client.readCoils(
          this.STATUS_START_ADDR,
          this.DEVICE_COUNT,
        );
        return this.createStateFromCoils(result.data);
      } catch (error) {
        this.logger.error(`Failed to read device status: ${error.message}`);
        throw error;
      }
    });
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
    const mockMode = this.configService.get<string>('MOCK_MODE', 'false');

    try {
      if (mockMode === 'true') {
        // Mock 모드: Modbus TCP 서버에 쓰기
        console.log(`[ModbusService] Toggle device command - Device: ${deviceKind}, Address: ${controlAddress}, Sending to TCP server`);
        await this.mockTcpClient.writeCoil(controlAddress, true);
        this.logger.log(
          `Toggle device ${deviceKind} at address 0x${controlAddress.toString(16)} on mock server`,
        );
        
        // Send false after 100ms delay
        setTimeout(async () => {
          try {
            await this.mockTcpClient.writeCoil(controlAddress, false);
          } catch (error) {
            this.logger.error(`Failed to send FALSE to mock server: ${error.message}`);
          }
        }, 100);
      } else {
        // 실제 하드웨어 모드: PLC에 쓰기
        const currentState = await this.getDeviceStatus();
        const currentValue = currentState[deviceKind];
        const newValue = !currentValue;
        
        console.log(`[ModbusService] Toggle device command - Device: ${deviceKind}, Address: ${controlAddress}, Current: ${currentValue}, New: ${newValue}`);
        await this.client.writeCoil(controlAddress, newValue);
        this.logger.log(
          `Toggled device ${deviceKind} at address 0x${controlAddress.toString(16)}`,
        );
      }
    } catch (error) {
      this.logger.error(`Failed to toggle device: ${error.message}`);
      throw error;
    }
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
    const mockMode = this.configService.get<string>('MOCK_MODE', 'false');

    try {
      if (mockMode === 'true') {
        // Mock 모드: Modbus TCP 서버에 쓰기
        console.log(`[ModbusService] Momentary switch command - Device: ${deviceKind}, Address: ${controlAddress}, Sending TRUE to TCP server`);
        await this.mockTcpClient.writeCoil(controlAddress, true);

        this.logger.log(
          `Momentary switch ${deviceKind} at address 0x${controlAddress.toString(16)} on mock server - sent TRUE`,
        );

        // Send false after 100ms delay
        setTimeout(async () => {
          try {
            console.log(`[ModbusService] Momentary switch command - Device: ${deviceKind}, Address: ${controlAddress}, Sending FALSE to TCP server`);
            await this.mockTcpClient.writeCoil(controlAddress, false);
            this.logger.log(
              `Momentary switch ${deviceKind} at address 0x${controlAddress.toString(16)} on mock server - sent FALSE`,
            );
          } catch (error) {
            this.logger.error(`Failed to send FALSE to mock server: ${error.message}`);
          }
        }, 100);
      } else {
        // 실제 하드웨어 모드: PLC에 쓰기
        console.log(`[ModbusService] Momentary switch command - Device: ${deviceKind}, Address: ${controlAddress}, Sending TRUE`);
        await this.client.writeCoil(controlAddress, true);

        this.logger.log(
          `Momentary switch ${deviceKind} at address 0x${controlAddress.toString(16)} - sent TRUE`,
        );

        // Send false after 100ms delay
        setTimeout(async () => {
          try {
            console.log(`[ModbusService] Momentary switch command - Device: ${deviceKind}, Address: ${controlAddress}, Sending FALSE`);
            await this.client.writeCoil(controlAddress, false);
            this.logger.log(
              `Momentary switch ${deviceKind} at address 0x${controlAddress.toString(16)} - sent FALSE`,
            );
          } catch (error) {
            this.logger.error(`Failed to send FALSE for momentary switch: ${error.message}`);
          }
        }, 100);
      }
    } catch (error) {
      this.logger.error(`Failed to execute momentary switch: ${error.message}`);
      throw error;
    }
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
    const mockMode = this.configService.get<string>('MOCK_MODE', 'false');

    try {
      if (mockMode === 'true') {
        // Mock 모드: Modbus TCP 서버에 쓰기
        console.log(`[ModbusService] Set device command - Device: ${deviceKind}, Address: ${controlAddress}, Value: ${value} to TCP server`);
        await this.mockTcpClient.writeCoil(controlAddress, value);
        this.logger.log(
          `Set device ${deviceKind} to ${value} at address 0x${controlAddress.toString(16)} on mock server`,
        );
      } else {
        // 실제 하드웨어 모드: PLC에 쓰기
        console.log(`[ModbusService] Set device command - Device: ${deviceKind}, Address: ${controlAddress}, Value: ${value}`);
        await this.client.writeCoil(controlAddress, value);
        this.logger.log(
          `Set device ${deviceKind} to ${value} at address 0x${controlAddress.toString(16)}`,
        );
      }
    } catch (error) {
      this.logger.error(`Failed to set device: ${error.message}`);
      throw error;
    }
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

    const mockMode = this.configService.get<string>('MOCK_MODE', 'false');
    
    if (mockMode === 'true') {
      // Mock 모드: Modbus TCP 서버에서 읽기
      return this.executeWithQueue(async () => {
        try {
          const result = await this.mockTcpClient.readCoils(startAddress, count);
          return result.data;
        } catch (error) {
          this.logger.error(`Failed to read coils from mock server ${startAddress}-${startAddress + count - 1}: ${error.message}`);
          throw error;
        }
      });
    }

    return this.executeWithQueue(async () => {
      try {
        const result = await this.client.readCoils(startAddress, count);
        return result.data;
      } catch (error) {
        this.logger.error(`Failed to read coils ${startAddress}-${startAddress + count - 1}: ${error.message}`);
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

    const mockMode = this.configService.get<string>('MOCK_MODE', 'false');
    
    if (mockMode === 'true') {
      // Mock 모드: Modbus TCP 서버에 쓰기
      return this.executeWithQueue(async () => {
        try {
          console.log(`[ModbusService] Writing coil - Address: ${address}, Value: ${value} to TCP server`);
          await this.mockTcpClient.writeCoil(address, value);
          this.logger.debug(`Wrote coil ${address} = ${value} on mock server`);
          console.log(`[ModbusService] Successfully wrote coil - Address: ${address}, Value: ${value}`);
        } catch (error) {
          this.logger.error(`Failed to write coil ${address} on mock server: ${error.message}`);
          console.log(`[ModbusService] Failed to write coil - Address: ${address}, Value: ${value}, Error: ${error.message}`);
          throw error;
        }
      });
    }

    return this.executeWithQueue(async () => {
      try {
        console.log(`[ModbusService] Writing coil - Address: ${address}, Value: ${value}`);
        await this.client.writeCoil(address, value);
        this.logger.debug(`Wrote coil ${address} = ${value}`);
        console.log(`[ModbusService] Successfully wrote coil - Address: ${address}, Value: ${value}`);
      } catch (error) {
        this.logger.error(`Failed to write coil ${address}: ${error.message}`);
        console.log(`[ModbusService] Failed to write coil - Address: ${address}, Value: ${value}, Error: ${error.message}`);
        throw error;
      }
    });
  }

  /**
   * Read multiple holding registers
   */
  async readHoldingRegisters(startAddress: number, count: number): Promise<number[]> {
    if (!this.isConnected) {
      throw new Error('PLC is not connected');
    }

    const mockMode = this.configService.get<string>('MOCK_MODE', 'false');
    
    if (mockMode === 'true') {
      // Mock 모드: Modbus TCP 서버에서 읽기
      return this.executeWithQueue(async () => {
        try {
          const result = await this.mockTcpClient.readHoldingRegisters(startAddress, count);
          return result.data;
        } catch (error) {
          this.logger.error(`Failed to read registers from mock server ${startAddress}-${startAddress + count - 1}: ${error.message}`);
          throw error;
        }
      });
    }

    return this.executeWithQueue(async () => {
      try {
        const result = await this.client.readHoldingRegisters(startAddress, count);
        return result.data;
      } catch (error) {
        this.logger.error(`Failed to read registers ${startAddress}-${startAddress + count - 1}: ${error.message}`);
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

    const mockMode = this.configService.get<string>('MOCK_MODE', 'false');
    
    if (mockMode === 'true') {
      // Mock 모드: Modbus TCP 서버에 쓰기
      return this.executeWithQueue(async () => {
        try {
          console.log(`[ModbusService] Writing register - Address: ${address}, Value: ${value} to TCP server`);
          await this.mockTcpClient.writeRegister(address, value);
          this.logger.debug(`Wrote register ${address} = ${value} on mock server`);
        } catch (error) {
          this.logger.error(`Failed to write register ${address} on mock server: ${error.message}`);
          throw error;
        }
      });
    }

    return this.executeWithQueue(async () => {
      try {
        await this.client.writeRegister(address, value);
        this.logger.debug(`Wrote register ${address} = ${value}`);
      } catch (error) {
        this.logger.error(`Failed to write register ${address}: ${error.message}`);
        throw error;
      }
    });
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
    try {
      // Close existing connections
      if (this.isConnected) {
        await this.disconnect();
      }

      this.stopPolling();

      const slaveId = parseInt(this.configService.get<string>('PLC_SLAVE_ID', '1'), 10);

      if (settings.protocol === 'modbusTCP') {
        // Connect via Modbus TCP
        const host = settings.host || this.configService.get<string>('MOCK_PLC_HOST', 'localhost');
        const port = settings.port || parseInt(this.configService.get<string>('MOCK_PLC_PORT', '502'), 10);

        // Create a new TCP client instance to avoid reusing closed connection
        this.mockTcpClient = new ModbusRTU();

        await this.mockTcpClient.connectTCP(host, { port });
        this.mockTcpClient.setID(slaveId);
        this.mockTcpClient.setTimeout(10000);

        // Wait for connection to stabilize
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Test connection
        const connectionTest = await this.testMockTcpConnection();
        if (connectionTest) {
          this.isConnected = true;
          this.logger.log(`Connected to Modbus TCP at ${host}:${port} (slave ID: ${slaveId})`);

          // Save connection settings for next startup
          await this.saveConnectionConfig(settings);

          // Restart polling
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
        const device = settings.device || this.configService.get<string>('PLC_PORT', '/dev/ttyUSB0');
        const baudRate = settings.baudRate || parseInt(this.configService.get<string>('PLC_BAUD_RATE', '9600'), 10);

        // Create a new RTU client instance to avoid reusing closed connection
        this.client = new ModbusRTU();

        await this.client.connectRTUBuffered(device, {
          baudRate,
          dataBits: 8,
          stopBits: 1,
          parity: 'none',
        });

        this.client.setID(slaveId);
        this.client.setTimeout(10000);

        // Wait for connection to stabilize
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Test connection
        const connectionTest = await this.testConnection();
        if (connectionTest) {
          this.isConnected = true;
          this.logger.log(`Connected to PLC at ${device} (${baudRate} baud, slave ID: ${slaveId})`);

          // Save connection settings for next startup
          await this.saveConnectionConfig(settings);

          // Restart polling
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
      this.logger.error(`Failed to connect with custom settings: ${error.message}`);
      this.isConnected = false;
      throw new Error(`Connection failed: ${error.message}`);
    }
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
        await new Promise(resolve => setTimeout(resolve, 500));
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

}
