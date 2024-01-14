import { Module } from '@nestjs/common';
import { UserModule } from './user/user.module';
import { AuthService } from './auth/auth.service';
import { AuthModule } from './auth/auth.module';
import { ConfigModule } from '@nestjs/config';
import { PrismaService } from './prisma.service';
import { UserController } from './user/user.controller';
import { AuthController } from './auth/auth.controller';
import { UserService } from './user/user.service';
import { JwtService } from '@nestjs/jwt';
import { TeacherModule } from './teacher/teacher.module';
// import { SpreadsheetService } from './google.service';
import { PremiumController } from './premium/premium.controller';
import { PremiumModule } from './premium/premium.module';
import { PremiumService } from './premium/premium.service';
import { DriveService } from './drive.service';
import { MulterModule } from '@nestjs/platform-express';
import { MailerModule } from '@nestjs-modules/mailer';
import { EjsAdapter } from '@nestjs-modules/mailer/dist/adapters/ejs.adapter';
import * as path from 'path';
import { MyMailService } from './mail.service';


@Module({
  imports: [UserModule, AuthModule,ConfigModule.forRoot(), TeacherModule, PremiumModule,MulterModule.register({
    dest: './uploads', // Set your upload directory
  }), MailerModule.forRoot({
    transport: {
      // service:"Mailgun",
    host: 'smtp.gmail.com',

      auth: {
        user: `${process.env.MAIL_USERNAME}`,
        pass: `${process.env.MAIL_PASSWORD}`,
      
      },
    },
    defaults: {
      from: 'KIIT-CONNECT<noreply@kiitconnect.live>',
    },
    template: {
      dir: path.join(__dirname , '../src/template'), // Replace with the actual path to your templates
      adapter: new EjsAdapter(), // Use the appropriate adapter for your templating engine
      options: {
        strict: false,
      },
    },
  })],
  controllers: [UserController,AuthController, PremiumController],
  providers: [AuthService,PrismaService,UserService,JwtService,PremiumService,DriveService,MyMailService ],
})
export class AppModule {}
