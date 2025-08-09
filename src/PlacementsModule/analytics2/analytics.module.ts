import { Module } from '@nestjs/common';

import { ResourcesModule } from '../resources2/resources.module';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { PrismaService } from 'src/prisma.service';

@Module({
  imports: [ResourcesModule],
  controllers: [AnalyticsController],
  providers: [AnalyticsService,PrismaService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {} 