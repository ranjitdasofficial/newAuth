import { Module } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { PrismaService } from 'src/prisma.service';
import { KiitUsersService } from 'src/kiit-users/kiit-users.service';
import { StorageService } from 'src/storage/storage.service';
import { MyMailService } from 'src/mail.service';
import { JwtService } from '@nestjs/jwt';

@Module({
  providers: [PaymentService,PrismaService,MyMailService]
})
export class PaymentModule {}
