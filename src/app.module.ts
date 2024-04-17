import { Module, } from '@nestjs/common';
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
import { KiitsocialController } from './kiitsocial/kiitsocial.controller';
import { KiitsocialModule } from './kiitsocial/kiitsocial.module';
import { KiitsocialService } from './kiitsocial/kiitsocial.service';
import { StorageService } from './storage/storage.service';
import { WhatsappService } from './whatsappweb/whatsappweb.service';
import { KiitUsersModule } from './kiit-users/kiit-users.module';
import { NotesService } from './notes/notes.service';
import { NotesModule } from './notes/notes.module';
import { NotesController } from './notes/notes.controller';
import { AdminController } from './admin/admin.controller';
import { AdminModule } from './admin/admin.module';
import { AdminService } from './admin/admin.service';
import { FacultiesReviewController } from './faculties-review/faculties-review.controller';
import { FacultiesReviewModule } from './faculties-review/faculties-review.module';
import { FacultiesReviewService } from './faculties-review/faculties-review.service';

import { CacheModule } from '@nestjs/cache-manager';  
import { redisStore } from 'cache-manager-redis-yet';
import { GivewayController } from './giveway/giveway.controller';
import { GivewayModule } from './giveway/giveway.module';
import { GivewayService } from './giveway/giveway.service';


@Module({
  imports: [CacheModule.register({ 
    store: redisStore, 
    isGlobal:true,
    host: 'localhost', //default host
    port: 6379, //default port,
    ttl: 100000000000, // seconds
  }),UserModule, AuthModule,ConfigModule.forRoot(), TeacherModule, PremiumModule,MulterModule.register({
    dest: './uploads', // Set your upload directory
  }), MailerModule.forRoot({
    transport: {
    // pool: true,
    host: 'smtp.gmail.com',
    // host: 'smtp.mailgun.com',
    // host:"rdmails.me",
    // port: 25,
    port:587,
      auth: { 
        user: `${process.env.MAIL_USERNAME}`,
        pass: `${process.env.MAIL_PASSWORD}`,


        // user: `postmaster@kiitconnect.live`,
        // pass: `ee2d617b16ea7116cb06a66ca6d223a2-408f32f3-2dc250bf`,


        //  user: `support@rdmails.me`,
        // pass: `Hijecked@#98`,
      
      }, 
      // tls:{ 
      //   rejectUnauthorized:false
      // }
    },
    defaults: {
      // from:"KIIT-CONNECT<mail@technicalranjit.com.np"
      // from: 'KIIT-CONNECT<notifications@kiitconnect.live>',
      // from: 'KIIT-CONNECT<newuser@kiitconnect.live>',
      // from: 'KIIT-CONNECT<postmaster@kiitconnect.live>',
      from: 'KIIT-CONNECT<support@kiitconnect.com>',
      // from: 'KIIT-CONNECT<support@rdmails.me>',
      // from: 'KIIT-CONNECT <support@rdmails.me>',
      // from: 'KIIT-CONNECT<account@kiitconnect.live>',
      // from: 'KIIT-CONNECT<reminder@kiitconnect.live>',
    },
    template: {
      dir: path.join(__dirname , '../src/template'), // Replace with the actual path to your templates
      adapter: new EjsAdapter(), // Use the appropriate adapter for your templating engine
      options: {
        strict: false,
      },
    },
  }), KiitsocialModule, KiitUsersModule, NotesModule, AdminModule, FacultiesReviewModule, GivewayModule],
  controllers: [UserController,AuthController, PremiumController, KiitsocialController, NotesController, AdminController, FacultiesReviewController, GivewayController],
  providers: [AuthService,PrismaService,UserService,JwtService,PremiumService,DriveService,MyMailService,KiitsocialService, StorageService, WhatsappService, NotesService,AdminService, FacultiesReviewService,GivewayService],
  exports:[CacheModule]
  
}) 
export class AppModule {}
