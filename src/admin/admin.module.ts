import { Module } from '@nestjs/common';
import { AdminService } from './admin.service';
import { PrismaService } from 'src/prisma.service';

@Module({
  providers: [AdminService,PrismaService]
})
export class AdminModule {}
