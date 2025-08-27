import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { UserService } from 'src/user/user.service';
import { PrismaService } from 'src/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { AuthenticatorService } from './authenticator.service';
import { AuthenticatorController } from './authenticator.controller';

@Module({
  controllers: [AuthController, AuthenticatorController],
  providers:[UserService,PrismaService,JwtService,AuthService,AuthenticatorService]
})
export class AuthModule {}
