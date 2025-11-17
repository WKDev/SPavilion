import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    await this.connectWithRetry();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  private async connectWithRetry(retryIntervalMs: number = 1000): Promise<void> {
    while (true) {
      try {
        await this.$connect();
        this.logger.log('Database connection established successfully');
        break;
      } catch (error) {
        this.logger.warn(
          `Failed to connect to database: ${error.message}. Retrying in ${retryIntervalMs}ms...`
        );
        await this.sleep(retryIntervalMs);
      }
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
