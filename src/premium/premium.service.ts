import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { PremiumUserRegister } from './dto/dto';

import * as fs from 'fs';
import { DriveService } from 'src/drive.service';
import e from 'express';
import { MyMailService } from 'src/mail.service';

@Injectable()
export class PremiumService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly driveService: DriveService,
    private readonly mailService: MyMailService,
  ) {}

  async getUserPremium(email: string) {
    try {
      const user = await this.prisma.premiumMember.findUnique({
        where: {
          email: email,
        },
      });

      if (!user)
        throw new UnauthorizedException('You are not a premium member');

      return user;
    } catch (error) {
      console.log(error);
      throw new UnauthorizedException('You are not a premium member');
    }
  }

  //create new User
  async createPremiumMember(dto: PremiumUserRegister) {
    try {
      const isUser = await this.prisma.premiumMember.findUnique({
        where: {
          email: dto.email,
        },
      });
      if (isUser) throw new ConflictException('User already exists');

      const user = await this.prisma.premiumMember.create({
        data: dto,
      });
      if(user)
      {
        const data = {
          email: user.email,
          name: user.name,
          branch: user.branch,
          year: user.year,
          activateLink: 'http://localhost:3000/payment',

        };
        await this.mailService.sendAccountCreated(data);
        return user;

      }
      else{
        throw new InternalServerErrorException('Something went wrong!!');
      }
    } catch (error) {
      console.log(error);
      if (error.status === 409) throw error;
      else throw new InternalServerErrorException('Something went wrong!!');
    }
  }

  async uploadPaymentScreentShot(file: Express.Multer.File, email: string) {
    const fileBuffer = fs.createReadStream(file.path);

    console.log('fileBuffer', fileBuffer);
    const fileId = await this.driveService.uploadImage(
      fileBuffer,
      email,
      '1idiqXp9TcqARKCEXWN8VPK5myotH5Pv9',
      file.mimetype,
      file.path,
    );
    if (fileId) {
      const complete = await this.prisma.premiumMember.update({
        where: {
          email: email,
        },
        data: {
          paymentScreenshot: fileId,
          updatedAt: new Date(),
        },
      });

      
      if (complete){
        const data = {
          email: complete.email,
          name: complete.name,
          branch: complete.branch,
          year: complete.year,
          amount:"50",
          paymentDate: new Date().toLocaleDateString()+ " "+ new Date().toLocaleTimeString(),

        };
        await this.mailService.sendPaymentConfirmation(data)
        return complete;
      } 
      else {
        throw new InternalServerErrorException('Something went wrong!!');
      }
    } else {
      throw new InternalServerErrorException('Something went wrong!!');
    }
  }


  async activatePremium(email:string){
    const user = await this.prisma.premiumMember.findUnique({
      where: {
        email: email,
      },
    });
    if(user){
      const complete = await this.prisma.premiumMember.update({
        where: {
          email: email,
        },
        data: {
          isPremium: true,
        
        },
      });
      if(complete){
        const data = {
          email: complete.email,
          name: complete.name,
          branch: complete.branch,
          year: complete.year,
        };
        await this.mailService.sendAccountActivated(data);
        return complete;
      }
      else{
        throw new InternalServerErrorException('Something went wrong!!');
      }
    }
    else{
      throw new InternalServerErrorException('Something went wrong!!');
    }
  }


  async getPremiumUserWithPaymentScreenshot(){
    try {
      const users = await this.prisma.premiumMember.findMany({});
      return users;
    } catch (error) {
      
      throw new InternalServerErrorException('Something went wrong!!');
    }
  }
}
