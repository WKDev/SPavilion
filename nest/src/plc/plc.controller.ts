import { Controller, Get, Post, Body, Param, Query, HttpException, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiParam, ApiQuery } from '@nestjs/swagger';
import { ModbusService } from '../modbus/modbus.service';
import { DeviceKind } from '@prisma/client';

@ApiTags('plc')
@Controller('api/plc')
export class PlcController {
  constructor(private readonly modbusService: ModbusService) {}

  @Get('coils')
  @ApiOperation({ summary: 'PLC Coils 상태 조회 (주소 범위 지정)' })
  @ApiQuery({ name: 'start', description: '시작 주소 (기본값: 0)', required: false, type: 'number' })
  @ApiQuery({ name: 'count', description: '조회할 개수 (기본값: 100, 최대: 2000)', required: false, type: 'number' })
  @ApiResponse({ status: 200, description: 'Coils 상태 조회 성공' })
  @ApiResponse({ status: 400, description: '잘못된 주소 범위' })
  @ApiResponse({ status: 500, description: 'PLC 연결 실패' })
  async getCoils(
    @Query('start') start?: string,
    @Query('count') count?: string,
  ): Promise<{ data: boolean[]; start: number; count: number }> {
    try {
      const startAddr = start ? parseInt(start, 10) : 0;
      // Reduced default from 100 to 80 to work around pymodbus 3.11+ limit
      const readCount = count ? parseInt(count, 10) : 80;

      // 유효성 검사
      if (isNaN(startAddr) || startAddr < 0 || startAddr > 65535) {
        throw new HttpException('Invalid start address. Must be between 0-65535', HttpStatus.BAD_REQUEST);
      }
      if (isNaN(readCount) || readCount < 1 || readCount > 2000) {
        throw new HttpException('Invalid count. Must be between 1-2000', HttpStatus.BAD_REQUEST);
      }
      if (startAddr + readCount > 65536) {
        throw new HttpException('Address range exceeds maximum (start + count > 65536)', HttpStatus.BAD_REQUEST);
      }

      if (!this.modbusService.isPlcConnected()) {
        throw new HttpException('PLC is not connected', HttpStatus.SERVICE_UNAVAILABLE);
      }

      const coils = await this.modbusService.readCoils(startAddr, readCount);
      return {
        data: coils,
        start: startAddr,
        count: readCount,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        `Failed to read coils: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('coils/:address')
  @ApiOperation({ summary: 'PLC Coil 값 설정' })
  @ApiParam({ name: 'address', description: 'Coil 주소 (0-65535)', type: 'number' })
  @ApiBody({ 
    schema: { 
      type: 'object', 
      properties: { 
        value: { type: 'boolean', description: '설정할 값' } 
      },
      required: ['value']
    } 
  })
  @ApiResponse({ status: 200, description: 'Coil 설정 성공' })
  @ApiResponse({ status: 400, description: '잘못된 주소 또는 값' })
  @ApiResponse({ status: 500, description: 'PLC 연결 실패' })
  async setCoil(
    @Param('address') address: string,
    @Body() body: { value: boolean },
  ): Promise<{ success: boolean; address: number; value: boolean }> {
    try {
      const coilAddress = parseInt(address, 10);
      
      if (isNaN(coilAddress) || coilAddress < 0 || coilAddress > 65535) {
        throw new HttpException('Invalid coil address. Must be between 0-65535', HttpStatus.BAD_REQUEST);
      }

      if (!this.modbusService.isPlcConnected()) {
        throw new HttpException('PLC is not connected', HttpStatus.SERVICE_UNAVAILABLE);
      }

      await this.modbusService.writeCoil(coilAddress, body.value);

      return {
        success: true,
        address: coilAddress,
        value: body.value,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        `Failed to set coil: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('registers')
  @ApiOperation({ summary: 'PLC Registers 상태 조회 (주소 범위 지정)' })
  @ApiQuery({ name: 'start', description: '시작 주소 (기본값: 0)', required: false, type: 'number' })
  @ApiQuery({ name: 'count', description: '조회할 개수 (기본값: 100, 최대: 2000)', required: false, type: 'number' })
  @ApiResponse({ status: 200, description: 'Registers 상태 조회 성공' })
  @ApiResponse({ status: 400, description: '잘못된 주소 범위' })
  @ApiResponse({ status: 500, description: 'PLC 연결 실패' })
  async getRegisters(
    @Query('start') start?: string,
    @Query('count') count?: string,
  ): Promise<{ data: number[]; start: number; count: number }> {
    try {
      const startAddr = start ? parseInt(start, 10) : 0;
      // Reduced default from 100 to 80 to work around pymodbus 3.11+ limit
      const readCount = count ? parseInt(count, 10) : 80;

      // 유효성 검사
      if (isNaN(startAddr) || startAddr < 0 || startAddr > 65535) {
        throw new HttpException('Invalid start address. Must be between 0-65535', HttpStatus.BAD_REQUEST);
      }
      if (isNaN(readCount) || readCount < 1 || readCount > 2000) {
        throw new HttpException('Invalid count. Must be between 1-2000', HttpStatus.BAD_REQUEST);
      }
      if (startAddr + readCount > 65536) {
        throw new HttpException('Address range exceeds maximum (start + count > 65536)', HttpStatus.BAD_REQUEST);
      }

      if (!this.modbusService.isPlcConnected()) {
        throw new HttpException('PLC is not connected', HttpStatus.SERVICE_UNAVAILABLE);
      }

      const registers = await this.modbusService.readHoldingRegisters(startAddr, readCount);
      return {
        data: registers,
        start: startAddr,
        count: readCount,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        `Failed to read registers: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('registers/:address')
  @ApiOperation({ summary: 'PLC Register 값 설정' })
  @ApiParam({ name: 'address', description: 'Register 주소 (0-65535)', type: 'number' })
  @ApiBody({ 
    schema: { 
      type: 'object', 
      properties: { 
        value: { type: 'number', description: '설정할 값 (0-65535)' } 
      },
      required: ['value']
    } 
  })
  @ApiResponse({ status: 200, description: 'Register 설정 성공' })
  @ApiResponse({ status: 400, description: '잘못된 주소 또는 값' })
  @ApiResponse({ status: 500, description: 'PLC 연결 실패' })
  async setRegister(
    @Param('address') address: string,
    @Body() body: { value: number },
  ): Promise<{ success: boolean; address: number; value: number }> {
    try {
      const registerAddress = parseInt(address, 10);
      
      if (isNaN(registerAddress) || registerAddress < 0 || registerAddress > 65535) {
        throw new HttpException('Invalid register address. Must be between 0-65535', HttpStatus.BAD_REQUEST);
      }

      if (body.value < 0 || body.value > 65535) {
        throw new HttpException('Invalid register value. Must be between 0-65535', HttpStatus.BAD_REQUEST);
      }

      if (!this.modbusService.isPlcConnected()) {
        throw new HttpException('PLC is not connected', HttpStatus.SERVICE_UNAVAILABLE);
      }

      await this.modbusService.writeRegister(registerAddress, body.value);

      return {
        success: true,
        address: registerAddress,
        value: body.value,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        `Failed to set register: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('status')
  @ApiOperation({ summary: 'PLC 연결 상태 조회' })
  @ApiResponse({ status: 200, description: 'PLC 상태 조회 성공' })
  async getPlcStatus(): Promise<{ connected: boolean; timestamp: string }> {
    return {
      connected: this.modbusService.isPlcConnected(),
      timestamp: new Date().toISOString(),
    };
  }

  @Post('momentary/:deviceKind')
  @ApiOperation({ summary: 'Momentary 스위치 실행 (Rising Edge Detection용)' })
  @ApiParam({ 
    name: 'deviceKind', 
    description: '디바이스 종류', 
    enum: DeviceKind,
    example: 'heat' 
  })
  @ApiResponse({ status: 200, description: 'Momentary 스위치 실행 성공' })
  @ApiResponse({ status: 400, description: '잘못된 디바이스 종류' })
  @ApiResponse({ status: 500, description: 'PLC 연결 실패' })
  async momentarySwitch(
    @Param('deviceKind') deviceKind: string,
  ): Promise<{ success: boolean; deviceKind: DeviceKind; message: string }> {
    try {
      // Validate device kind
      if (!Object.values(DeviceKind).includes(deviceKind as DeviceKind)) {
        throw new HttpException(
          `Invalid device kind: ${deviceKind}. Valid values: ${Object.values(DeviceKind).join(', ')}`,
          HttpStatus.BAD_REQUEST,
        );
      }

      if (!this.modbusService.isPlcConnected()) {
        throw new HttpException('PLC is not connected', HttpStatus.SERVICE_UNAVAILABLE);
      }

      await this.modbusService.momentarySwitch(deviceKind as DeviceKind);

      return {
        success: true,
        deviceKind: deviceKind as DeviceKind,
        message: `Momentary switch executed for ${deviceKind}`,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        `Failed to execute momentary switch: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('connect')
  @ApiOperation({ summary: 'PLC에 연결' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        protocol: { type: 'string', enum: ['modbusTCP', 'modbusRTU'], description: 'Protocol type' },
        host: { type: 'string', description: 'Host (for Modbus TCP)' },
        port: { type: 'number', description: 'Port (for Modbus TCP)' },
        device: { type: 'string', description: 'Device path (for Modbus RTU)' },
        baudRate: { type: 'number', description: 'Baud rate (for Modbus RTU)' },
      },
      required: ['protocol']
    }
  })
  @ApiResponse({ status: 200, description: 'PLC 연결 성공' })
  @ApiResponse({ status: 400, description: '잘못된 연결 설정' })
  @ApiResponse({ status: 500, description: 'PLC 연결 실패' })
  async connectPlc(
    @Body() body: {
      protocol: 'modbusTCP' | 'modbusRTU';
      host?: string;
      port?: number;
      device?: string;
      baudRate?: number;
    },
  ): Promise<{ success: boolean; message: string }> {
    try {
      const result = await this.modbusService.connectWithSettings(body);
      return result;
    } catch (error) {
      throw new HttpException(
        `Failed to connect PLC: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('disconnect')
  @ApiOperation({ summary: 'PLC 연결 해제' })
  @ApiResponse({ status: 200, description: 'PLC 연결 해제 성공' })
  async disconnectPlc(): Promise<{ success: boolean; message: string }> {
    try {
      await this.modbusService.disconnect();
      return {
        success: true,
        message: 'PLC disconnected successfully',
      };
    } catch (error) {
      throw new HttpException(
        `Failed to disconnect PLC: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}