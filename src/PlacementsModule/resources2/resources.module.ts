import { Module } from '@nestjs/common';
import { ResourcesService } from './resources.service';
import { ResourcesController } from './resources.controller';
import { CloudflareR3Service } from './cloudflare-r3.service';
import { PrismaService } from 'src/prisma.service';

@Module({
  controllers: [ResourcesController],
  providers: [ResourcesService, CloudflareR3Service,PrismaService],
  exports: [ResourcesService, CloudflareR3Service],
})
export class ResourcesModule {} 