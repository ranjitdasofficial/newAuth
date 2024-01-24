import { Module } from '@nestjs/common';
import { KiitsocialService } from './kiitsocial.service';
import { PrismaService } from 'src/prisma.service';
import { DriveService } from 'src/drive.service';
import { StorageService } from 'src/storage/storage.service';
import { WhatsappService } from 'src/whatsappweb/whatsappweb.service';

@Module({
  providers: [KiitsocialService,PrismaService,DriveService,StorageService,WhatsappService]
})
export class KiitsocialModule {}
