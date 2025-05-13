import { Module } from '@nestjs/common';
import { WebSocketService } from './webSocket.service';
import { TicketsService } from 'src/tickets/tickets.service';
import { PrismaService } from 'src/prisma.service';

@Module({
  providers: [WebSocketService,TicketsService,PrismaService]
})
export class WebSocketModule {}
