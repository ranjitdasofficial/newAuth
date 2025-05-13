import { Module } from '@nestjs/common';
import { TicketsService } from './tickets.service';
import { PrismaService } from 'src/prisma.service';

@Module({
  providers: [TicketsService,PrismaService]
})
export class TicketsModule {}
