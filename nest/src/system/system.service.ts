import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as os from 'os';
import * as si from 'systeminformation';
import { SystemInfoDto, CpuInfoDto, MemoryInfoDto, DiskInfoDto } from './dto/system-info.dto';

@Injectable()
export class SystemService {
  private readonly logger = new Logger(SystemService.name);
  private readonly hostMonitorUrl: string;
  private readonly useHostMonitor: boolean;

  constructor(private readonly configService: ConfigService) {
    this.hostMonitorUrl = this.configService.get<string>('HOST_MONITOR_URL', '');
    this.useHostMonitor = !!this.hostMonitorUrl;

    if (this.useHostMonitor) {
      this.logger.log(`Windows Host Monitor enabled: ${this.hostMonitorUrl}`);
    } else {
      this.logger.warn('HOST_MONITOR_URL not set - using container metrics');
    }
  }

  /**
   * 시스템 리소스 정보 조회
   * Windows Host Monitor가 설정되어 있으면 호스트 메트릭을 가져옴
   * 실패 시 컨테이너 메트릭으로 폴백
   */
  async getSystemInfo(): Promise<SystemInfoDto> {
    try {
      // Try Windows Host Monitor first
      if (this.useHostMonitor) {
        try {
          return await this.getHostSystemInfo();
        } catch (hostError) {
          this.logger.warn(
            `Host monitor failed (${hostError.message}), falling back to container metrics`
          );
        }
      }

      // Fallback to container metrics
      return await this.getContainerSystemInfo();
    } catch (error) {
      this.logger.error(`시스템 정보 조회 실패: ${error.message}`);
      throw error;
    }
  }

  /**
   * Windows Host Monitor에서 시스템 정보 조회
   */
  private async getHostSystemInfo(): Promise<SystemInfoDto> {
    const url = `${this.hostMonitorUrl}/api/system/info`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5초 타임아웃

    try {
      const response = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      this.logger.debug('Host system info retrieved successfully');
      return data;
    } catch (error) {
      clearTimeout(timeoutId);
      throw new Error(`Failed to fetch from host monitor: ${error.message}`);
    }
  }

  /**
   * 컨테이너 내부 시스템 정보 조회 (폴백)
   */
  private async getContainerSystemInfo(): Promise<SystemInfoDto> {
    // CPU 정보
    const cpuInfo = await this.getCpuInfo();

    // 메모리 정보
    const memoryInfo = this.getMemoryInfo();

    // 디스크 정보
    const diskInfo = await this.getDiskInfo();

    return {
      cpu: cpuInfo,
      memory: memoryInfo,
      disk: diskInfo,
    };
  }

  /**
   * CPU 정보 조회
   */
  private async getCpuInfo(): Promise<CpuInfoDto> {
    const cpus = os.cpus();
    const cores = cpus.length;

    // systeminformation을 사용하여 현재 CPU 부하 조회
    const load = await si.currentLoad();
    const usage = Math.round(load.currentLoad * 10) / 10; // 소수점 1자리

    return {
      usage,
      cores,
    };
  }

  /**
   * 메모리 정보 조회
   */
  private getMemoryInfo(): MemoryInfoDto {
    const total = os.totalmem();
    const free = os.freemem();
    const used = total - free;
    const percentage = Math.round((used / total) * 100 * 10) / 10; // 소수점 1자리

    return {
      total,
      used,
      free,
      percentage,
    };
  }

  /**
   * 디스크 정보 조회
   */
  private async getDiskInfo(): Promise<DiskInfoDto> {
    try {
      // systeminformation을 사용하여 파일시스템 정보 조회
      const fsSize = await si.fsSize();

      // 루트 파티션 또는 가장 큰 파티션 선택
      let rootFs = fsSize.find((fs) => fs.mount === '/');
      if (!rootFs && fsSize.length > 0) {
        // 루트 파티션이 없으면 가장 큰 파티션 사용
        rootFs = fsSize.reduce((prev, current) =>
          current.size > prev.size ? current : prev
        );
      }

      if (!rootFs) {
        throw new Error('디스크 정보를 찾을 수 없습니다');
      }

      const total = rootFs.size;
      const used = rootFs.used;
      const free = total - used;
      const percentage = Math.round(rootFs.use * 10) / 10; // 소수점 1자리

      return {
        total,
        used,
        free,
        percentage,
      };
    } catch (error) {
      this.logger.error(`디스크 정보 조회 실패: ${error.message}`);
      // 디스크 정보 조회 실패 시 기본값 반환
      return {
        total: 0,
        used: 0,
        free: 0,
        percentage: 0,
      };
    }
  }
}
