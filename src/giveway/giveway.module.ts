import { Module } from '@nestjs/common';
import { GivewayService } from './giveway.service';
import { PrismaService } from 'src/prisma.service';

@Module({
  providers: [GivewayService,PrismaService]
})
export class GivewayModule {}
