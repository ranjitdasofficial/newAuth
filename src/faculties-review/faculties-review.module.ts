import { Module } from '@nestjs/common';
import { FacultiesReviewService } from './faculties-review.service';
import { PrismaService } from 'src/prisma.service';

@Module({
  providers: [FacultiesReviewService,PrismaService]
})
export class FacultiesReviewModule {}
