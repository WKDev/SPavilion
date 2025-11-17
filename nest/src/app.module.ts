import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
// import { ServeStaticModule } from '@nestjs/serve-static';
// import { join } from 'path';
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
    // ServeStaticModule 제거: Next.js를 별도 포트에서 실행하고 프록시 사용
    // ServeStaticModule.forRoot({
    //   rootPath: join(__dirname, '..', 'public'),
    // }),
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
