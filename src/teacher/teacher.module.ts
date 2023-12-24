import { Module } from '@nestjs/common';
import { TeacherController } from './teacher.controller';
import { TeacherService } from './teacher.service';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from 'src/prisma.service';

@Module({
  controllers: [TeacherController],
  providers: [TeacherService,JwtService,PrismaService]
})
export class TeacherModule {}
