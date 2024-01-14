import { Module } from '@nestjs/common';
import { PremiumService } from './premium.service';
import { PrismaService } from 'src/prisma.service';
import { DriveService } from 'src/drive.service';
import { MyMailService } from 'src/mail.service';

@Module({
  providers: [PremiumService,PrismaService,DriveService,MyMailService ]
})
export class PremiumModule {}
