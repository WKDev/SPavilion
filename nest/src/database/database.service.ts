import { Injectable, Logger, BadRequestException, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TableStatsDto, DatabaseStatsDto } from './dto/database-stats.dto';

@Injectable()
export class DatabaseService {
  private readonly logger = new Logger(DatabaseService.name);

  // 허용된 테이블 목록 (보안을 위해 화이트리스트 사용)
  private readonly ALLOWED_TABLES = [
    'bbox_history',
    'heatmap_hour',
    'device_usage',
    'device_usage_hour',
  ];

  // 테이블 메타데이터 (표시 이름 및 설명)
  private readonly TABLE_METADATA: Record<string, { displayName: string; description: string }> = {
    bbox_history: {
      displayName: 'Bounding Box History',
      description: 'YOLOv8 detection 원시 데이터 (디버깅 및 재집계용)',
    },
    heatmap_hour: {
      displayName: 'Heatmap Hour',
      description: '시간별 사람 감지 히트맵 데이터 (1시간 단위 집계)',
    },
    device_usage: {
      displayName: 'Device Usage',
      description: 'PLC 장치 사용 이벤트 로그',
    },
    device_usage_hour: {
      displayName: 'Device Usage Hour',
      description: '시간별 장치 사용 통계 (1시간 단위 사전 집계)',
    },
  };

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 데이터베이스 통계 조회
   */
  async getDatabaseStats(): Promise<DatabaseStatsDto> {
    try {
      const tables: TableStatsDto[] = [];

      // 각 테이블에 대한 통계 조회
      for (const tableName of this.ALLOWED_TABLES) {
        const stats = await this.getTableStats(tableName);
        tables.push(stats);
      }

      return { tables };
    } catch (error) {
      this.logger.error(`데이터베이스 통계 조회 실패: ${error.message}`);
      throw new HttpException(
        `데이터베이스 통계 조회 실패: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 개별 테이블 통계 조회
   */
  private async getTableStats(tableName: string): Promise<TableStatsDto> {
    try {
      // 행 개수 조회 (실제 카운트)
      const rowCount = await this.getTableRowCount(tableName);

      // 디스크 사용량 조회 (PostgreSQL 시스템 카탈로그 사용)
      const diskSize = await this.getTableDiskSize(tableName);

      // 메타데이터 가져오기
      const metadata = this.TABLE_METADATA[tableName] || {
        displayName: tableName,
        description: '',
      };

      return {
        name: tableName,
        displayName: metadata.displayName,
        rowCount,
        diskSize,
        description: metadata.description,
      };
    } catch (error) {
      this.logger.error(`테이블 통계 조회 실패 (${tableName}): ${error.message}`);
      // 오류 발생 시 기본값 반환
      const metadata = this.TABLE_METADATA[tableName] || {
        displayName: tableName,
        description: '',
      };
      return {
        name: tableName,
        displayName: metadata.displayName,
        rowCount: 0,
        diskSize: 0,
        description: metadata.description,
      };
    }
  }

  /**
   * 테이블 행 개수 조회
   */
  private async getTableRowCount(tableName: string): Promise<number> {
    let result;

    switch (tableName) {
      case 'bbox_history':
        result = await this.prisma.bboxHistory.count();
        break;
      case 'heatmap_hour':
        result = await this.prisma.heatmapHour.count();
        break;
      case 'device_usage':
        result = await this.prisma.deviceUsage.count();
        break;
      case 'device_usage_hour':
        result = await this.prisma.deviceUsageHour.count();
        break;
      default:
        result = 0;
    }

    return result;
  }

  /**
   * 테이블 디스크 사용량 조회 (PostgreSQL 시스템 카탈로그 사용)
   */
  private async getTableDiskSize(tableName: string): Promise<number> {
    try {
      // pg_total_relation_size: 테이블 + 인덱스 + TOAST 전체 크기
      const result = await this.prisma.$queryRaw<[{ size: bigint }]>`
        SELECT pg_total_relation_size(${tableName}::regclass) as size
      `;

      if (result && result[0]) {
        return Number(result[0].size);
      }

      return 0;
    } catch (error) {
      this.logger.warn(`디스크 사용량 조회 실패 (${tableName}): ${error.message}`);
      return 0;
    }
  }

  /**
   * 테이블 데이터 삭제 (TRUNCATE)
   */
  async clearTable(tableName: string): Promise<{ success: boolean; message: string; tableName: string }> {
    // 허용된 테이블인지 검증
    if (!this.ALLOWED_TABLES.includes(tableName)) {
      throw new BadRequestException(`허용되지 않은 테이블입니다: ${tableName}`);
    }

    try {
      this.logger.log(`테이블 데이터 삭제 시작: ${tableName}`);

      // Prisma를 사용하여 모든 데이터 삭제
      switch (tableName) {
        case 'bbox_history':
          await this.prisma.bboxHistory.deleteMany({});
          break;
        case 'heatmap_hour':
          await this.prisma.heatmapHour.deleteMany({});
          break;
        case 'device_usage':
          await this.prisma.deviceUsage.deleteMany({});
          break;
        case 'device_usage_hour':
          await this.prisma.deviceUsageHour.deleteMany({});
          break;
        default:
          throw new BadRequestException(`지원되지 않는 테이블입니다: ${tableName}`);
      }

      this.logger.log(`테이블 데이터 삭제 완료: ${tableName}`);

      return {
        success: true,
        message: '테이블 데이터가 삭제되었습니다',
        tableName,
      };
    } catch (error) {
      this.logger.error(`테이블 데이터 삭제 실패 (${tableName}): ${error.message}`);
      throw new HttpException(
        `테이블 데이터 삭제 실패: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
