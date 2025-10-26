import {
  Controller,
  Get,
  Post,
  Body,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { ModbusService } from '../modbus/modbus.service';
import { PrismaService } from '../prisma/prisma.service';
import { DeviceControlDto } from '../dto/device-control.dto';
import { CreateDeviceUsageDto } from '../dto/device-usage.dto';

@ApiTags('devices')
@Controller('api/devices')
export class DevicesController {
  constructor(
    private readonly modbusService: ModbusService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  @ApiOperation({ summary: '모든 디바이스 상태 조회' })
  @ApiResponse({ status: 200, description: '디바이스 상태 조회 성공' })
  async getDevices() {
    try {
      const status = await this.modbusService.getDeviceStatus();
      return {
        connected: this.modbusService.isPlcConnected(),
        devices: status,
      };
    } catch (error) {
      throw new HttpException(
        `Failed to get device status: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('control')
  @ApiOperation({ summary: '디바이스 제어 명령 전송' })
  @ApiBody({ type: DeviceControlDto })
  @ApiResponse({ 
    status: 200, 
    description: '디바이스 제어 명령 전송 성공',
    schema: {
      example: {
        success: true,
        message: 'Device HEAT toggle command sent'
      }
    }
  })
  @ApiResponse({ status: 400, description: '잘못된 액션' })
  @ApiResponse({ status: 500, description: '디바이스 제어 실패' })
  async controlDevice(@Body() dto: DeviceControlDto) {
    try {
      const { device_kind, action } = dto;

      switch (action.toLowerCase()) {
        case 'toggle':
          await this.modbusService.toggleDevice(device_kind);
          break;
        case 'on':
          await this.modbusService.setDevice(device_kind, true);
          break;
        case 'off':
          await this.modbusService.setDevice(device_kind, false);
          break;
        default:
          throw new HttpException(
            `Invalid action: ${action}. Use 'toggle', 'on', or 'off'`,
            HttpStatus.BAD_REQUEST,
          );
      }

      return {
        success: true,
        message: `Device ${device_kind} ${action} command sent`,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        `Failed to control device: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('usage')
  @ApiOperation({ summary: '디바이스 사용 로그 기록' })
  @ApiBody({ type: CreateDeviceUsageDto })
  @ApiResponse({ 
    status: 200, 
    description: '디바이스 사용 로그 기록 성공',
    schema: {
      example: {
        success: true,
        id: 123
      }
    }
  })
  @ApiResponse({ status: 500, description: '디바이스 사용 로그 기록 실패' })
  async logDeviceUsage(@Body() dto: CreateDeviceUsageDto) {
    try {
      const usage = await this.prisma.deviceUsage.create({
        data: {
          deviceType: dto.device_kind,
          action: dto.action,
          value: dto.value ? 1.0 : 0.0,
        },
      });

      return {
        success: true,
        id: usage.id,
      };
    } catch (error) {
      throw new HttpException(
        `Failed to log device usage: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
