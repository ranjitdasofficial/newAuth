import { Module } from '@nestjs/common';
import { KiitUsersController } from './kiit-users.controller';
import { KiitUsersService } from './kiit-users.service';
import { PrismaService } from 'src/prisma.service';
import { StorageService } from 'src/storage/storage.service';
import { MyMailService } from 'src/mail.service';
import { JwtService } from '@nestjs/jwt';
import { CACHE_MANAGER, CacheModule } from '@nestjs/cache-manager';
import { AppModule } from 'src/app.module';

@Module({
  controllers: [KiitUsersController],
  imports: [],
  providers: [KiitUsersService,PrismaService,StorageService,MyMailService,JwtService,],
  
})
export class KiitUsersModule {}
