import { Module } from '@nestjs/common';
import { KiitUsersController } from './kiit-users.controller';
import { KiitUsersService } from './kiit-users.service';
import { PrismaService } from 'src/prisma.service';

@Module({
  controllers: [KiitUsersController],
  providers: [KiitUsersService,PrismaService]
})
export class KiitUsersModule {}
