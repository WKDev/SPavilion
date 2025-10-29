import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { ModbusModule } from './modbus/modbus.module';
import { DevicesModule } from './devices/devices.module';
import { HeatmapModule } from './heatmap/heatmap.module';
import { BboxHistoryModule } from './bbox-history/bbox-history.module';
import { PlcModule } from './plc/plc.module';
import { SystemModule } from './system/system.module';
import { DatabaseModule } from './database/database.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    PrismaModule,
    ModbusModule,
    DevicesModule,
    HeatmapModule,
    BboxHistoryModule,
    PlcModule,
    SystemModule,
    DatabaseModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
