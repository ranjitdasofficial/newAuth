import { Module } from '@nestjs/common';
import { TimelineController } from './timeline.controller';
import { TimelineService } from './timeline.service';
import { PrismaService } from 'src/prisma.service';

@Module({
  controllers: [TimelineController],
  providers: [TimelineService, PrismaService],
  exports: [TimelineService],
})
export class TimelineModule {}