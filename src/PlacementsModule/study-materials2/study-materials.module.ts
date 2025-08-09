import { Module } from '@nestjs/common';
import { StudyMaterialsService } from './study-materials.service';
import { StudyMaterialsController } from './study-materials.controller';
import { PrismaService } from 'src/prisma.service';

@Module({
  controllers: [StudyMaterialsController],
  providers: [StudyMaterialsService, PrismaService],
  exports: [StudyMaterialsService],
})
export class StudyMaterialsModule {} 