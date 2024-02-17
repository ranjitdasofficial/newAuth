import { Module } from '@nestjs/common';
import { KiitUsersController } from './kiit-users.controller';
import { KiitUsersService } from './kiit-users.service';
import { PrismaService } from 'src/prisma.service';
import { StorageService } from 'src/storage/storage.service';
import { MyMailService } from 'src/mail.service';

@Module({
  controllers: [KiitUsersController],
  providers: [KiitUsersService,PrismaService,StorageService,MyMailService]
})
export class KiitUsersModule {}
