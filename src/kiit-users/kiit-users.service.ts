import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import {
  KiitUserRegister,
  PremiumUserRegisterDto,
} from './dto/KiitUserRegister.dto';
import { Readable } from 'stream';
import * as sharp from 'sharp';
import * as fs from 'fs';
import { StorageService } from 'src/storage/storage.service';
import { MyMailService } from 'src/mail.service';
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager';
import { JwtService } from '@nestjs/jwt';
import { DriveService } from 'src/drive.service';
//
// const secure = "Ranjit";
import { compress } from 'compress-pdf';

import { PDFDocument } from 'pdf-lib'; // For structural optimization
import * as path from 'path';
import { log } from 'console';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);


@Injectable()
export class KiitUsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly driveService: DriveService,
    private readonly mailService: MyMailService,
    @Inject(CACHE_MANAGER) private readonly cacheService: Cache,
    private readonly jwtService: JwtService,
  ) { }

  private tokens = {};

  exceptionUser = ["test@kiitconnect.com", "test.premium@kiitconnect.com", "21053420@kiit.ac.in"]

  async registerUser(dto: KiitUserRegister) {
    try {
      const user = await this.prisma.user.findUnique({
        where: {
          email: dto.email,

        },
      });
      if (user) throw new ConflictException('User already exists');
      const refCode = this.generateReferralCode(6);
      const newUser = await this.prisma.user.create({
        data: {
          ...dto,
          refrealCode: refCode,
        },
      });
      if (!newUser) throw new Error('Something went wrong!');
      console.log(newUser);
      return newUser;
    } catch (error) {
      console.log(error);
      if (error instanceof ConflictException) {
        throw error;
      }
      throw new InternalServerErrorException('Internal Server Error');
    }
  }

async getDeviceDetails(email: string, deviceId: string) {
  try {
    const user = await this.cacheService.get(email);
    if (!user) throw new NotFoundException('User not found');
    const userData = JSON.parse(user as string);
    if(!userData[deviceId]) throw new NotFoundException('Device not found');
    return userData[deviceId];
  }
  catch (error) {
    console.log(error);
    throw new InternalServerErrorException('Internal Server Error');
  }
}


  async registerDevice(dto: { deviceId: string, email: string, registerDevice: {
    deviceType: string,
    browser: string,
    hardware: string,
    system: string,
    timestamp: string  } }) {
    try {
      const user = await this.cacheService.get(dto.email);
      if (!user || Object.keys(user).length === 0){
        const newUser = {
          [dto.deviceId]: dto.registerDevice
        }
        console.log("New user", newUser);
        await this.cacheService.set(dto.email, JSON.stringify(newUser));
        return newUser;
      }

      console.log("Registering device", dto.registerDevice);


      //mydata is like this 
      // const demoData = {
      //   "deviceId1":{
      //     deviceType: string,
      //     browser: string,
      //     hardware: string,
      //     system: string,
      //     timestamp: string
      //   },
      //   "deviceId2":{
      //     deviceType: string,
      //     browser: string,
      //     hardware: string,
      //     system: string,
      //     timestamp: string
      //   }
      // }

      const userData = JSON.parse(user as string) as {
        [key: string]: {
          deviceType: string,
          browser: string,
          hardware: string,
          system: string,
          timestamp: string
        }
      };
      console.log("Device details", userData);
      if(userData[dto.deviceId]) {
        return {
          status: "success",
          message: "Device already registered",
          data: userData[dto.deviceId]
        }
      }
      if(Object.keys(userData).length >= 2) {
        throw new ConflictException('You have reached the maximum number of devices');
      }
      userData[dto.deviceId] = dto.registerDevice;
      await this.cacheService.set(dto.email, JSON.stringify(userData));
      return {
        status: "success",
        message: "Device registered successfully",
      }
    } catch (error) {
      console.log(error);
      throw new InternalServerErrorException('Internal Server Error');
    }
  }


  async removePremiumStatus(email: string) {
    try {
      const user = await this.prisma.user.update({
        where: { email: email },
        data: { isPremium: false }
      });
      return user;
  }
  catch (error) {
    console.log(error);
    throw new InternalServerErrorException('Internal Server Error');
  }
}

  async createUserIfNotExist(dto: { email: string, name: string, profileImage: string }) {
    try {
      const user = await this.prisma.user.findUnique({
        where: {
          email: dto.email,
        },
      });
      if (!user){
      const newUser = await this.prisma.user.create({
        data: {
          email: dto.email,
          name: dto.name,
          profileImage: dto.profileImage,
          isPremium: false,
          refrealCode: this.generateReferralCode(6),
          totalEarned: 0,
        },
      });
      if (!newUser) throw new Error('Something went wrong!');
      return newUser; 
    }
    return user;
    } catch (error) {
      console.log(error);
      throw new InternalServerErrorException('Internal Server Error');
    }
  }

  async getUserByEmail(email: string) {
    try {
      const user = await this.prisma.user.findUnique({
        where: {
          email: email,
        },
        include: {
          PremiumMember: {
            select: {
              isActive: true,
            }
          },
        }
      });
      console.log(user);

      if (!user) throw new NotFoundException('User not found');



      if (!user.isPremium) {
        const p = user.PremiumMember;
        return {
          user: { ...user, isActive: p ? p.isActive : true },
        };
      }

      const getEmailSession: string = await this.cacheService.get(email);
      console.log(getEmailSession);
      let getSessionData = [];

      if (!this.exceptionUser.includes(email) && getEmailSession) {
        getSessionData = JSON.parse(getEmailSession);
        console.log(getSessionData, getSessionData.length);
        if (getSessionData.length >= 2) {
          throw new ConflictException(
            'Already two users are using with this id',
          );
        }
      }
      const uniqueCode = await this.generateMediaId();

      getSessionData.push(uniqueCode);
      await this.cacheService.set(email, JSON.stringify(getSessionData));
      console.log(getSessionData);

      const iat = Math.floor(Date.now() / 1000);
      const exp = iat + 60; // seconds
      const tokens = await this.jwtService.signAsync(
        { email: email },

        {
          expiresIn: '1m',

          secret: 'Ranjit',
        },
      );
      this.tokens[email] = tokens;
      return {
        user: { ...user, isActive: true },
        tokens: tokens,
        uniqueCode: uniqueCode,
      };
    } catch (error) {
      console.log(error);
      if (
        error instanceof NotFoundException ||
        error instanceof ConflictException
      ) {
        throw error;
      }

      throw new InternalServerErrorException('Internal Server Error');
    }
  }


  async getUserByEmailByPassword(email: string, password: string) {
    try {
      const user = await this.prisma.user.findUnique({
        where: {
          email: email,
        },
        include: {
          PremiumMember: {
            select: {
              isActive: true,
            }
          },
        }
      });
      console.log(user);


      if (!user) throw new NotFoundException('User not found');

      if (!user.password) {
        throw new BadRequestException('Password not set');
      }

      if (user.password !== password) {
        console.log(user.password, password, user.password !== password);
        throw new BadRequestException('Password not matched');
      }


      if (!user.isPremium) {
        const p = user.PremiumMember;
        return {
          user: { ...user, isActive: p ? p.isActive : true },
        };
      }

      // const getEmailSession: string = await this.cacheService.get(email);
      // console.log(getEmailSession);
      // let getSessionData = [];

      // if (!this.exceptionUser.includes(email) && getEmailSession) {
      //   getSessionData = JSON.parse(getEmailSession);
      //   console.log(getSessionData, getSessionData.length);
      //   if (getSessionData.length >= 2) {
      //     throw new ConflictException(
      //       'Already two users are using with this id',
      //     );
      //   }
      // }
      // const uniqueCode = await this.generateMediaId();

      // getSessionData.push(uniqueCode);
      // await this.cacheService.set(email, JSON.stringify(getSessionData));
      // console.log(getSessionData);

      // const iat = Math.floor(Date.now() / 1000);
      // const exp = iat + 60; // seconds
      // const tokens = await this.jwtService.signAsync(
      //   { email: email },

      //   {
      //     expiresIn: '1m',

      //     secret: 'Ranjit',
      //   },
      // );
      // this.tokens[email] = tokens;
      return {
        user: { ...user, isActive: true },
        // tokens: tokens,
        // uniqueCode: uniqueCode,
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof ConflictException
      ) {
        throw error;
      }
      throw new InternalServerErrorException('Internal Server Error');
    }
  }
  async verifyToken(token: string, email: string) {
    try {
      const getSession: string | null = await this.cacheService.get(email);
      console.log(token, getSession, email);
      if (email) {
        const getSessionDetails: string[] = await JSON.parse(getSession);
        if (getSessionDetails.includes(token)) {
          return true;
        }

        throw new BadRequestException('Session Expired');
      }
      throw new BadRequestException('Session Expired');
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException('Internal Server Error');
    }
  }

  async registerPremiumUser(dto: PremiumUserRegisterDto) {
    try {
      const user = await this.prisma.premiumMember.findUnique({
        where: {
          userId: dto.userId,
        },
      });
      if (user) throw new ConflictException('User already exists');

      let refUser = null;
      if (dto.refralCode) {
        refUser = await this.prisma.user.findUnique({
          where: {
            refrealCode: dto.refralCode,
          },
        });
        if (!refUser) {
          throw new BadRequestException('Referral code not found');
        }
      }

      const { refralCode, ...res } = dto;
      const newUser = await this.prisma.premiumMember.create({
        data: res,
        include: {
          user: true,
        },
      });

      if (!newUser) throw new Error('Something went wrong!');
      const data = {
        email: newUser.user.email,
        name: newUser.user.name,
        branch: newUser.branch,
        year: newUser.year,
        activateLink: 'https://kiitconnect.com/payment',
      };
      await this.mailService.sendAccountCreated(data);

      if (refUser) {
        const findRefbyUsr = await this.prisma.user.findUnique({
          where: {
            refrealCode: refralCode,
          },
        });

        if (!findRefbyUsr) {
          throw new BadRequestException('Referral code not found');
        }

        await this.prisma.user.update({
          where: {
            id: newUser.userId,
          },
          data: {
            referredBy: findRefbyUsr.id,
          },
        });
      }
      return newUser;
    } catch (error) {
      console.log(error);
      if (
        error instanceof ConflictException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new InternalServerErrorException('Internal Server Error');
    }
  }


  async setPassword(dto: { email: string; password: string }) {
    try {
      const user = await this.prisma.user.update({
        where: {
          email: dto.email,
        },
        data: {
          password: dto.password,
        },
      });
      if (!user) throw new NotFoundException('User not found');
      return user;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Internal Server Error');
    }
  }

  async getPremiumUserById(userId: string) {
    try {
      const user = await this.prisma.premiumMember.findUnique({
        where: {
          userId: userId,
        },
        include: {
          user: {
            select: {
              isPremium: true,
            }
          }
        }
      });

      if (!user) throw new NotFoundException('User not found');
      console.log(user);
      return user;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Internal Server Error');
    }
  }

  async savePayemntScreenshot(userId: string, file?: Express.Multer.File) {
    try {
      if (!file) throw new NotFoundException('File not found');
      // const buffer = await this.streamToBuffer(
      //   fs.createReadStream(file.path),
      // );

      const mediaId = await this.generateMediaId();
      const filebuffer = await sharp(file.buffer)
        .webp({ quality: 80 }) // Adjust quality as needed
        .toBuffer();

      console.log(file.buffer, 'buffer');

      const p = await this.storageService.uploadFile(filebuffer, mediaId);

      if (!p) throw new InternalServerErrorException('Failed to Upload Image');

      // const fileId = await this.uploadImage(file, createdByEmail);

      // fs.unlink(file.path, (err) => {
      //   if (err) {
      //     console.error(err);
      //     return;
      //   }
      // });

      const user = await this.prisma.premiumMember.update({
        where: {
          userId: userId,
        },
        include: {
          user: true,
        },
        data: {
          paymentScreenshot: p,
        },
      });
      if (!user) throw new NotFoundException('User not found');
      const data = {
        email: user.user.email,
        name: user.user.name,
        branch: user.branch,
        year: user.year,
        amount: '99',
        paymentDate:
          new Date().toLocaleDateString() +
          ' ' +
          new Date().toLocaleTimeString(),
      };
      await this.mailService.sendPaymentConfirmation(data);
      return user;
    } catch (error) {
      console.log(error);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Internal Server Error');
    }
  }



  async activatePremiumUser_by_phonepe(userId: string, merchantTransactionId: string) {
    try {

      await this.prisma.paymentOrder_phonepe.create({
        data: {
          userId: userId,
          merchantTransactionId: merchantTransactionId,
        }
      })



      const user = await this.prisma.user.update({
        where: {
          id: userId,
        },

        data: {
          isPremium: true,

        },
      });
      if (!user) throw new NotFoundException('User not found');

      if (user.referredBy) {
        const refUser = await this.prisma.user.findUnique({
          where: {
            id: user.referredBy,
          },
        });
        console.log(refUser);
        if (refUser) {
          const up = await this.prisma.user.update({
            where: {
              id: refUser.id,
            },
            data: {
              refralAmount: {
                increment: 10,
              },
            },
          });
          if (!up)
            throw new InternalServerErrorException(
              'Failed to Update Referral Amount',
            );
        }
      }

      const p = await this.prisma.premiumMember.update({
        where: {
          userId: userId,
        },
        data: {
          isActive: true,
        },
        include: {
          user: true,
        },
      });

      if (!p) throw new NotFoundException('User not found');

      const data = {
        email: p.user.email,
        name: p.user.name,
        branch: p.branch,
        year: p.year,
      };
      await this.mailService.sendAccountActivated(data);
      //       return complete;

      return user;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Internal Server Error');
    }
  }

  async activatePremiumUser(userId: string, razorpay_payment_id: string, razorpay_order_id: string, razorpay_signature: string, plan: string) {
    try {

      await this.prisma.paymentOrder.create({
        data: {
          userId: userId,
          razorpay_payment_id: razorpay_payment_id,
          razorpay_order_id: razorpay_order_id,
          razorpay_signature: razorpay_signature,
        }
      })



      const user = await this.prisma.user.update({
        where: {
          id: userId,
        },

        data: {
          isPremium: true,
          paymentDate: new Date(),
          plan: plan,
          expiryDate: plan === 'Monthly'
            ? new Date(new Date().setDate(new Date().getDate() + 30)) // Adds 30 days to the current date
            : null
        },
      });
      if (!user) throw new NotFoundException('User not found');

      if (user.referredBy) {
        const refUser = await this.prisma.user.findUnique({
          where: {
            id: user.referredBy,
          },
        });
        console.log(refUser);
        if (refUser) {
          const up = await this.prisma.user.update({
            where: {
              id: refUser.id,
            },
            data: {
              refralAmount: {
                increment: 10,
              },
            },
          });
          if (!up)
            throw new InternalServerErrorException(
              'Failed to Update Referral Amount',
            );
        }
      }

      const p = await this.prisma.premiumMember.update({
        where: {
          userId: userId,
        },
        data: {
          isActive: true,
        },
        include: {
          user: true,
        },
      });

      if (!p) throw new NotFoundException('User not found');

      const data = {
        email: p.user.email,
        name: p.user.name,
        branch: p.branch,
        year: p.year,
      };
      await this.mailService.sendAccountActivated(data);
      //       return complete;

      return user;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Internal Server Error');
    }
  }


  async activatePremiumUserByEmail(email: string, razorpay_payment_id: string, razorpay_order_id: string, razorpay_signature: string) {
    try {

      const usr = await this.prisma.user.findUnique({
        where: {
          email: email,
        },
      });

      if (!usr) throw new NotFoundException('User not found');

      await this.prisma.paymentOrder.create({
        data: {
          userId: usr.id,
          razorpay_payment_id: razorpay_payment_id,
          razorpay_order_id: razorpay_order_id,
          razorpay_signature: razorpay_signature,
        }
      })



      const user = await this.prisma.user.update({
        where: {
          id: usr.id,
        },

        data: {
          isPremium: true,

        },
      });
      if (!user) throw new NotFoundException('User not found');

      if (user.referredBy) {
        const refUser = await this.prisma.user.findUnique({
          where: {
            id: user.referredBy,
          },
        });
        console.log(refUser);
        if (refUser) {
          const up = await this.prisma.user.update({
            where: {
              id: refUser.id,
            },
            data: {
              refralAmount: {
                increment: 10,
              },
            },
          });
          if (!up)
            throw new InternalServerErrorException(
              'Failed to Update Referral Amount',
            );
        }
      }

      const p = await this.prisma.premiumMember.update({
        where: {
          userId: usr.id,
        },
        data: {
          isActive: true,
        },
        include: {
          user: true,
        },
      });

      if (!p) throw new NotFoundException('User not found');

      const data = {
        email: p.user.email,
        name: p.user.name,
        branch: p.branch,
        year: p.year,
      };
      await this.mailService.sendAccountActivated(data);
      //       return complete;

      return user;
    } catch (error) {
      console.log(error);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Internal Server Error');
    }
  }

  async getAllPremiumUser() {
    try {
      const users = await this.prisma.premiumMember.findMany({


        include: {
          user: true,
        },


        orderBy: {
          createdAt: 'desc',
        },
      });
      return users;
    } catch (error) {
      console.log(error);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Internal Server Error');
    }
  }

  async getNotPremiumUsers() {
    try {
      const users = await this.prisma.premiumMember.findMany({
        where: {
          user: {
            isPremium: false
          }
        },

        include: {
          user: true,
        },


        orderBy: {
          createdAt: 'desc',
        },
      });
      return users;
    } catch (error) {
      console.log(error);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Internal Server Error');
    }
  }

  // private async streamToBuffer(stream: Readable): Promise<Buffer> {
  //   return new Promise((resolve, reject) => {
  //     const chunks: Buffer[] = [];
  //     stream.on('data', (chunk) => chunks.push(chunk));
  //     stream.on('error', reject);
  //     stream.on('end', () => resolve(Buffer.concat(chunks)));
  //   });
  // }

  async generateMediaId() {
    return await this.storageService.generateMediaId();
  }

  async getPremiumUserWithoutPaymentScreenshot() {
    try {
      const users = await this.prisma.premiumMember.findMany({
        where: {
          paymentScreenshot: undefined,
          isActive: false,
        },
        select: {
          user: {
            select: {
              name: true,
              email: true,

            },
          },

          // paymentScreenshot: true,
          // isActive: true,
          // branch: true,
          // year: true,
        },
      });

      // const filterUser = users.filter((u) => u.user.email.startsWith('22'));

      return users.map((u) => {
        return {
          name: u.user.name,
          email: u.user.email,
        }
      });


    } catch (error) {
      console.log(error);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Internal Server Error');
    }
  }

  async sendRemainderMail() {
    const users = []
    let isContinueLoop = true;
    try {
      for (let i = 0; i < users.length && isContinueLoop; i++) {
        if (!isContinueLoop) break;
        await this.mailService.sendPaymentReminder({
          email: users[i].email,
          name: users[i].name,
          // branch: users[i].branch,
          // year: users[i].year,
        });

        const u = await new Promise((resolve) => {
          setTimeout(() => {
            resolve(
              `send Success ${users[i].name} ${users[i].email}`,
            );
          }, 2000);
        });
        console.log(u);
      }
    } catch (error) {
      isContinueLoop = false;
      console.log(error);
    }
  }



  async getUserWithoutPremiumAccount() {
    try {
      const users = await this.prisma.user.findMany({
        where: {
          isPremium: false,
          PremiumMember: undefined,
          email: {
            startsWith: '21',
          },
        },
        select: {
          name: true,
          email: true,
        },
      });
      return {
        length: users.length,
        users: users,
      };
    } catch (error) {
      console.log(error);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Internal Server Error');
    }
  }

  async sendMailToUserWithoutPremiumAccount() {
    const users = []
    try {
      for (let i = 0; i < users.length; i++) {
        await this.mailService.sendNotPremium(users[i].name, users[i].email, i);
        // await this.mailService.sendNotPremium("Ranjit","connectkiit@gmail.com",1);
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    } catch (error) {
      console.log(error);
    }
  }

  async addTotalEarnedToAllUsers() {
    try {
      const users = await this.prisma.user.updateMany({
        data: {
          totalEarned: 0,
        },
      });

      return {
        succuess: true,
      };

    } catch (error) {
      console.log(error);
    }
  }

  async sendTestMail() {
    try {
      await this.mailService.sendNotPremium('test', '21053420@kiit.ac.in', 0);
    } catch (error) {
      console.log('error');
    }
  }

  async getAllUsers() {
    try {
      return await this.prisma.user.findMany({
        select: {
          name: true,
          email: true,
        },
      });
    } catch (error) {
      console.log(error);
      throw new InternalServerErrorException('Internal Server Error');
    }
  }

  async filterUser() {
    const user1 = [];
    const user2 = [];
    const onlyEmail = user2.map((u2) => u2.email);

    const filterArray = user1.filter((u) => {
      if (!onlyEmail.includes(u.email)) {
        return u;
      }
    });

    return {
      length: filterArray.length,
      filterArray,
    };
  }

  async sendMailToNonKiitConnectUser() {
    const users = [];

    try {
      for (let i = 0; i < users.length; i++) {
        await this.mailService.sendNotPremium(
          users[i].user.name,
          users[i].user.email,
          i,
        );
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    } catch (error) {
      console.log(error);
    }
  }

  async sendMailToNonregisteredUser() {

    const users = []


    let continueLoop = true;

    try {
      for (let i = 0; i < users.length && continueLoop; i++) {
        if (!continueLoop) break;
        await this.mailService.sendNonRegistered(`${users[i]}`, i);
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    } catch (error) {
      continueLoop = false;
      //close the app running
      process.exit(1);
      console.log(error);
    }
  }

  async sendTo4thSem() {
    const users = [];

    try {
      for (let i = 0; i < users.length; i++) {
        await this.mailService.sendMailToNonKiitconnectUserSem4(
          users[i].email,
          i,
        );
        await new Promise((resolve) => setTimeout(resolve, 3000));
        console.log(users[i].email);
      }
    } catch (error) {
      console.log(error);
    }
  }

  async testMails() {
    try {
      await this.mailService.sendMailToNonKiitconnectUserSem4(
        'support@kiitconnect.com',
        1,
      );
    } catch (error) {
      console.log(error);
    }
  }

  async testCacheService() {
    try {
      const keys = await this.cacheService.get('test');
      const keys2 = await this.cacheService.get('sanjaysunar442@gmail.com');
      if (!keys) {
        await this.cacheService.set('test', 'Hello World');
        return 'Hello World From Non Cache';
      }
      return {
        keys: keys,
        keys2: keys2,
      };
      // await this.cacheService.reset();
    } catch (error) {
      console.log(error);
      throw new InternalServerErrorException('Internal Server error');
    }
  }

  async clearCache() {
    try {
      await this.cacheService.reset();
      return true;
    } catch (error) {
      console.log(error);
      throw new InternalServerErrorException('Internal Server Error');
    }
  }


  async getDeviceDetailsByEmail(email: string) {
    try {
      const user = await this.cacheService.get(email);
      if (!user) throw new NotFoundException('User not found');
      const userData = JSON.parse(user as string);
      return userData;
    }
    catch (error) {
      console.log(error);
      if(error instanceof NotFoundException) {
        throw error;
      }

      throw new InternalServerErrorException('Internal Server Error');
    }
  }

  async checkSession(email: string, deviceId: string) {
    try {
      const user = await this.cacheService.get(email);
      if (!user || Object.keys(user).length === 0) throw new NotFoundException('User not found');
      const userData = JSON.parse(user as string);
      console.log(userData, deviceId,userData[deviceId]);
      if(!userData[deviceId]) {
        throw new NotFoundException('Device not found');
      }
      return userData[deviceId];
    } catch (error) {
      console.log(error);

      if(error instanceof NotFoundException) {
        throw error;
      }

      throw new InternalServerErrorException('Internal Server Error');
    }
  }

  async removeSession(email: string) {
    try {
      await this.cacheService.del(email);
      return true;
    } catch (error) {
      console.log(error);

      throw new InternalServerErrorException('Internal Server Error');
    }
  }

  async removeSiginToken(dto: { email: string; deviceId: string }) {
    try {
      const token: string = await this.cacheService.get(dto.email);
      if (token) {
        const decode: {
          [key: string]: {
            deviceType: string,
            browser: string,
            hardware: string,
            system: string,
            timestamp: string
          }
        } = await JSON.parse(token);
        if (decode[dto.deviceId]) {
          delete decode[dto.deviceId];
          if(Object.keys(decode).length > 0) {
            await this.cacheService.set(dto.email, JSON.stringify(decode));
          } else {
            await this.cacheService.del(dto.email);
          }
          return {
            status: "success",
            message: "Device removed successfully",
            data: decode
          }
        }else{
          return{
            "status":"not deleted"
          }
        }
      }
      await this.cacheService.del(dto.email);
      return true;
    } catch (error) {
      console.log(error);
      if(error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Internal server Error');
    }
  }

  async generateResetDeviceToken(email: string) {
    try {
      const user = await this.prisma.user.findUnique({
        where: {
          email: email,
        },
      });

      console.log(user);
      if (!user) {
        throw new BadRequestException('User Not Found');
      }
      if (!user.isPremium)
        throw new BadRequestException('This feature is only for Premium User');
      const token = await this.jwtService.signAsync(
        { email: email },
        {
          secret: process.env.ACCESS_TOKEN_SECRET,
          expiresIn: 60 * 5,
        },
      );
      if (!token)
        throw new InternalServerErrorException('Failed to Generate Tokens');

      const resetLink = `https://kiitconnect.com/resetdevice?checkToken=${token}`;
      console.log(email, resetLink);
      await this.mailService.sendResetDeviceLoginMail(
        user.email,
        user.name,
        resetLink,
      );
      return true;
    } catch (error) {
      console.log(error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to Generate token');
    }
  }

  async checkTokenAndResetDevice(token: string) {
    try {
      const tk = await this.jwtService.verifyAsync(token, {
        secret: process.env.ACCESS_TOKEN_SECRET,
      });
      if (tk.email) {
        await this.cacheService.set(tk.email, JSON.stringify([]));
        return true;
      }
    } catch (error) {
      console.log(error);
      throw new BadRequestException('Invalid Token');
    }
  }

  async resetLoginAdmin(email: string) {
    try {

      const checkUser = await this.prisma.user.findUnique({
        where: {
          email: email
        }
      })

      if (checkUser.isPremium) {
        await this.cacheService.set(email, JSON.stringify([]));
        return true;
      }

      throw new BadRequestException("Invalid Mail");
    } catch (error) {
      console.log(error);
      throw new BadRequestException('Bad Email');
    }
  }

  generateReferralCode(length: number) {
    const characters =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const charactersLength = characters.length;
    let referralCode = '';
    for (let i = 0; i < length; i++) {
      referralCode += characters.charAt(
        Math.floor(Math.random() * charactersLength),
      );
    }
    // console.log(referralCode);
    return referralCode;
  }
  async updateUsers() {
    const user = await this.prisma.user.findMany({});

    for (const item of user) {
      const refCode = this.generateReferralCode(6);
      if (refCode) {
        await this.prisma.user.update({
          where: {
            id: item.id,
          },
          data: {
            refrealCode: refCode,
            refralAmount: 0,
          },
        });
      }
    }

    return 'Done';
  }

  async refralInfo(userId: string) {
    try {
      const user = await this.prisma.user.findUnique({
        where: {
          id: userId,
        },
        select: {
          refrealCode: true,
          refralAmount: true,
          id: true,
        },
      });
      if (!user) throw new BadRequestException('User Not Found');

      const totalRefral = await this.prisma.user.findMany({
        where: {
          referredBy: user.id,
        },
        select: {
          id: true,
          name: true,
          email: true,
          updatedAt: true,
        },
      });

      return {
        user,
        totalRefral,
      };
    } catch (error) { }
  }

  async redeemRequest(dto: { userId: string; amount: number; upiId: string }) {
    try {
      const user = await this.prisma.user.findUnique({
        where: {
          id: dto.userId,
        },
      });
      if (!user) throw new BadRequestException('User Not Found');

      if (user.refralAmount < dto.amount)
        throw new BadRequestException('Insufficient Balance');

      const redeemReq = await this.prisma.redeemRequest.create({
        data: {
          amount: dto.amount,
          userId: user.id,
          upiId: dto.upiId,
        },
      });

      if (!redeemReq)
        throw new InternalServerErrorException(
          'Failed to Create Redeem Request',
        );

      await this.prisma.user.update({
        where: {
          id: user.id,
        },
        data: {
          refralAmount: user.refralAmount - dto.amount,
        },
      });

      return redeemReq;
    } catch (error) {
      console.log(error);
      throw new InternalServerErrorException('Internal Server Error');
    }
  }

  async getRedeemRequest(userId: string) {
    try {
      const user = await this.prisma.user.findUnique({
        where: {
          id: userId,
        },
        select: {
          id: true,
          refrealCode: true,
          refralAmount: true,
        },
      });
      if (!user) throw new BadRequestException('User Not Found');

      const redeemReq = await this.prisma.redeemRequest.findMany({
        where: {
          userId: user.id,
        },
      });

      return {
        user,
        redeemReq,
      };
    } catch (error) {
      console.log(error);
      throw new InternalServerErrorException('Internal Server Error');
    }
  }

  async getUnknow() {
    try {
      const user = await this.prisma.user.findMany({
        select: {
          refrealCode: true,
          id: true,
        },
      });

      return user;
    } catch (error) { }
  }

  async getTotalRedeemRequest() {
    try {
      const redeemReq = await this.prisma.redeemRequest.findMany({
        select: {
          id: true,
          amount: true,
          upiId: true,
          userId: true,
          createdAt: true,
        },
      });

      return redeemReq;
    } catch (error) {
      console.log(error);
      throw new InternalServerErrorException('Internal Server Error');
    }
  }

  async testUpload(file: Express.Multer.File) {
    try {
      const mediaId = await this.generateMediaId();
      const filebuffer = await sharp(file.buffer)
        .webp({ quality: 80 }) // Adjust quality as needed
        .toBuffer();

      console.log(file.buffer, 'buffer');

      const p = await this.storageService.uploadFile(filebuffer, mediaId);

      return p;
    } catch (error) {
      console.log(error);
      throw new InternalServerErrorException('Internal Server Error');
    }
  }

  async getPremiumWithoutPaid() {
    try {
      const user = await this.prisma.premiumMember.findMany({
        where: {
          paymentScreenshot: undefined,
          isActive: false,
        },
        select: {
          user: {
            select: {
              email: true,
              name: true,
            },
          },
          branch: true,
          year: true,
        },
      });

      return {
        length: user.length,
        user: user,
      };
    } catch (error) {
      console.log(error);
      throw new InternalServerErrorException('Internal Server Error');
    }
  }

  async sendMailToPremiumButNotPaymentDone() {
    const user = []

    let continueLoop = true;

    try {
      for (let i = 0; i < user.length && continueLoop; i++) {
        await this.mailService.sendNotPremium(
          'hello',
          `${user[i]}@kiit.ac.in`,
          i,
        );
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    } catch (error) {
      console.log(error);
      continueLoop = false;
      return;
    }
  }

  async getPremiumUserAfter() {
    try {
      const user = await this.prisma.user.updateMany({
        where: {
          updatedAt: {
            lte: new Date('2024-04-26T00:00:00.000Z'),
          },
        },
        data: {
          isPremium: false,
        },
      });

      return user;
    } catch (error) {
      console.log(error);
      throw new Error('Error in fetching premium user');
    }
  }

  async getPremiumUsers() {
    try {


      const user = await this.prisma.user.findMany({
        where: {
          isPremium: true,
        },
        select: {
          email: true,
        },
      });


      return user.map((user) => user.email);


    } catch (error) {
      console.log(error);
      throw new Error('Error in fetching premium user');
    }
  }

  async clearAllTokens() {
    try {
      const user = await this.cacheService.reset();
      return user;
    } catch (error) {
      console.log(error);
      throw new Error('Error in clearing tokens');
    }
  }

  async sendMailAvoidBlockge() {
    const users = []
    let isContinueLoop = true;
    try {
      for (let i = 0; i < users.length && isContinueLoop; i++) {
        if (!isContinueLoop) break;
        await this.mailService.sendMailToAvoidBlockage({
          email: users[i].user.email,
          name: users[i].user.name,
          branch: users[i].branch,
          year: users[i].year,
        });

        const u = await new Promise((resolve) => {
          setTimeout(() => {
            resolve(
              `send Success ${users[i].user.name} ${users[i].user.email}`,
            );
          }, 2000);
        });
        console.log(u);
      }
    } catch (error) {
      isContinueLoop = false;
      console.log(error);
    }
  }



  async getUserStatus(userId: string) {
    try {
      const user = await this.prisma.premiumMember.findUnique({
        where: {
          userId: userId,
        },
        include: {
          user: {
            select: {
              allowedProfileUpdate: true,
            }
          }
        }
      });

      return {
        year: user.year,
        allowedToUpdate: user.user.allowedProfileUpdate
      };
    } catch (error) {
      console.log(error);
      throw new Error('Error in fetching user');
    }


  }

  async updateUserStatus(dto: {
    userId: string,
    year: string,
  }) {
    try {

      const trans = await this.prisma.$transaction([
        this.prisma.premiumMember.update({
          where: {
            userId: dto.userId,
          },
          data: {
            year: dto.year
          }
        }),

        this.prisma.user.update({
          where: {
            id: dto.userId
          },
          data: {
            allowedProfileUpdate: false
          }
        })

      ]);


      return true;
    } catch (error) {
      console.log(error);
      throw new Error('Error in updating user');
    }
  }


  async deactivateUser(userId: string) {
    try {
      const user = await this.prisma.premiumMember.update({
        where: {
          userId: userId,
        },
        data: {
          isActive: false
        },
        include: {
          user: true
        }
      });

      this.mailService.sendMailToDeactivateAccount(user.user.email, user.user.name);
      return true;
    } catch (error) {

      console.log(error);
      throw new Error('Error in deactivating user');

    }
  }

  async activateAll() {
    try {
      await this.prisma.premiumMember.updateMany({
        where: {
          isActive: false,
        },
        data: {
          isActive: true
        }
      })
      return true;
    } catch (error) {
      console.log(error);
      throw new Error('Error in activating users');

    }
  }


  async enableDisabledUser() {
    try {
      const p = await this.prisma.premiumMember.updateMany({
        where: {
          isActive: false,
        },
        // select:{
        //   user:{
        //     select:{
        //       email:true,
        //       name:true
        //     }
        //   }
        // }
        data: {
          isActive: true
        }
      })

      return p;
      // return p.map((p)=>p.user.email);
    } catch (error) {
      console.log(error);
      throw new Error('Error in activating users');

    }
  }


  async changeYear(dto: {
    userId: string,
    year: string,
    branch?: string
  }) {
    try {
      const user = await this.prisma.premiumMember.update({
        where: {
          userId: dto.userId,
        },
        data: {
          year: dto.year,
          branch: dto.branch
        }
      });
      return true;
    } catch (error) {
      console.log(error);
      throw new Error('Error in changing year');
    }
  }


  async getNonPremiumUser(roll: string) {
    try {
      const user = await this.prisma.user.findMany({
        where: {
          email: {
            startsWith: roll
          },
          isPremium: false
        }
      })
      return {
        length: user.length,
        user
      }
    } catch (error) {
      console.log(error);
      throw new Error('Error in fetching user');
    }
  }
  async getPremiumUser(roll: string) {
    try {
      const user = await this.prisma.user.findMany({
        where: {
          email: {
            startsWith: roll,
          },
          isPremium: true
        }
      })
      return {
        length: user.length,
        user
      };
    } catch (error) {
      console.log(error);
      throw new Error('Error in fetching user');
    }
  }



  async getPremiumUserByYear(year: string) {
    try {
      const user = await this.prisma.premiumMember.findMany({
        where: {
          user: {
            email: {
              startsWith: year,
            },
            isPremium: true,
            // updatedAt:{
            //   lte:new Date('2025-05-05T00:00:00.000Z')
            // }
          },



        },
        select: {
          user: {
            select: {
              email: true,
              name: true,
              expiryDate: true,
              isPremium: true,
              id: true,
            },

          },
          branch: true,
          year: true,
          userId: true,
          whatsappNumber: true,
          paymentScreenshot: true,
          createdAt: true,
          updatedAt: true,

        }
      })
      return {
        length: user.length,
        user
      };
    } catch (error) {
      console.log(error);
      throw new Error('Error in fetching user');
    }
  }


  async getPremiumUserByYearN(year: string) {
    try {
      const user = await this.prisma.premiumMember.findMany({
        where: {
          user: {
            email: {
              startsWith: year
            },
            isPremium: true,
            // updatedAt:{
            //   lte: new Date('2025-06-10T00:00:00.000Z')
            // } 
          }
        },
        include: {
          user: true

        }


      });
      return {
        length: user.length,
        user
      }
    } catch (error) {
      console.log(error);
      throw new Error('Error in fetching user');

    }
  }

  async removePremiumMembersByBatch(batch: string, dateBefore: string) {
    // try {
    const date = new Date(dateBefore);

    console.log(date);
    const users = await this.prisma.premiumMember.findMany({
      where: {
        user: {
          email: {
            startsWith: batch,
          },

          updatedAt: {
            lte: new Date('2025-06-10T00:00:00.000Z')
          }

        },
      },
      include: {
        user: true,
      },
    });

    const userIds = users.map((u) => u.userId);
    // const userEmails = users.map((u) => u.user.email);



    // Transaction to delete users from premium member and update users table
    await this.prisma.$transaction([
      this.prisma.premiumMember.deleteMany({
        where: {
          userId: {
            in: userIds,
          },
        },
      }),
      this.prisma.user.updateMany({
        where: {
          id: {
            in: userIds,
          },
        },
        data: {
          isPremium: false,
          allowedProfileUpdate: true,
        },
      }),
    ]);

    // // Remove from cache (outside the transaction)
    // await this.removeUsersFromCache(userEmails);
  } catch(error) {
    console.error('Error in deleting user:', error);
    throw new Error('Error in deleting user');
  }



  async removeUsersFromCache(userEmails: string[]) {
    try {
      await Promise.all(
        userEmails.map(async (email) => {
          if (this.cacheService.get(email)) {
            await this.cacheService.del(email);
          }
        })
      );
    } catch (error) {
      console.error('Error in deleting users from cache:', error);
      throw new Error('Error in deleting users from cache');
    }
  }


  async removePaymentScreenshot(email: string) {
    try {
      const user = await this.prisma.user.findUnique({
        where: {
          email: email
        },

      });

      await this.prisma.premiumMember.update({
        where: {
          userId: user.id
        },
        data: {
          paymentScreenshot: null
        }
      })
      return true;

    } catch (error) {
      console.log(error);
      throw new Error('Error in removing payment screenshot');

    }
  }


  // mapBatchToYear(email: string) {

  //   const batch = email.slice(0, 2);
  //   switch(batch){
  //     case '22':
  //       return '3rd Year';

  //     case '23':
  //       return '2nd Year';

  //     case '21':
  //       return '4th Year';

  //     case '24':
  //       return '1st Year';

  //     default:
  //       return 'Invalid Batch';

  //   }


  // }
  // async restorePremium(){

  //   const userPremium=[
  //     {
  //       "id": "65b51ea871212d151fedf6b8",
  //       "email": "22053256@kiit.ac.in",
  //       "name": "3256_MANIDIP MANDAL",
  //       "batch": "3rd Year"
  //   },
  //   {
  //       "id": "65b5267847ab2137a3346d2c",
  //       "email": "23052419@kiit.ac.in",
  //       "name": "SAKET SUMAN",
  //       "batch": "2nd Year"
  //   },
  //   ]

  // try {

  //   for(const usr of userPremium){

  //     const trans = await this.prisma.$transaction([
  //       this.prisma.premiumMember.create({
  //         data:{
  //           userId:usr.id,
  //           branch:'CSE',
  //           whatsappNumber:"0000000000",
  //           paymentScreenshot:"addedByuser",
  //           year:usr.batch,
  //           isActive:true
  //         }
  //       }),
  //       this.prisma.user.update({
  //         where:{
  //           email:usr.email
  //         },
  //         data:{
  //           isPremium:true,
  //           allowedProfileUpdate:true,

  //         }
  //       })
  //     ])
  //   }

  //   return true;


  //   // }

  // } catch (error) {

  //   console.log(error);
  //   return null;

  // }


  // }



  mapBatchToYear(email: string) {
    const batchToYearMap: Record<string, string> = {
      '22': '3rd Year',
      '23': '2nd Year',
      '21': '4th Year',
      '24': '1st Year',
    };

    const batch = email.slice(0, 2);
    return batchToYearMap[batch] || 'Invalid Batch';
  }

  async restorePremium() {
    const userPremium = []

    try {
      const transactions = userPremium.map((usr) => ({
        premiumMember: this.prisma.premiumMember.create({
          data: {
            userId: usr.user.id,
            branch: 'CSE',
            whatsappNumber: '0000000000',
            paymentScreenshot: 'willBeExpiredTomorrow',
            year: usr.year,
            isActive: true,
          },
        }),
        userUpdate: this.prisma.user.update({
          where: {
            email: usr.user.email,
          },
          data: {
            isPremium: true,
            allowedProfileUpdate: true,
            //tomorrow will be expired
            expiryDate: new Date(
              new Date().setDate(new Date().getDate() + 1)
            ).toISOString(),
          },
        }),
      }));

      await this.prisma.$transaction(
        transactions.flatMap((t) => [t.premiumMember, t.userUpdate])
      );
      return true;
    } catch (error) {
      console.error('Error restoring premium users:', error);
      return null;
    }
  }

  async generateSignedUrlForUploadImage(dto: {
    filename: string;
    fileType: string
  }) {
    try {
      console.log(dto);

      const signedUrl = await this.storageService.getPresignedUrl(dto.filename, dto.fileType);
      console.log(signedUrl)
      return {
        signedUrl: signedUrl,
      };
    } catch (error) {
      console.error('Error generating signed url:', error);
      throw new InternalServerErrorException('Error generating signed url');

    }
  }



  async saveScreenShotToDb(userId: string, fileId: string) {

    try {

      console.log(userId, fileId);

      if (!userId || !fileId) throw new BadRequestException('Invalid request');

      const user = await this.prisma.premiumMember.update({
        where: {
          userId: userId
        },
        include: {
          user: true
        },
        data: {
          paymentScreenshot: fileId
        }
      })
      if (!user) throw new NotFoundException('User not found');
      const data = {
        email: user.user.email,
        name: user.user.name,
        branch: user.branch,
        year: user.year,
        amount: '99',
        paymentDate:
          new Date().toLocaleDateString() +
          ' ' +
          new Date().toLocaleTimeString(),
      };
      await this.mailService.sendPaymentConfirmation(data);


    } catch (error) {
      console.error('Error saving screenshot:', error);
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException('Error saving screenshot');

    }
  }


  // -------------- Get all the orders of razorpay --------------
  async getAllOrders() {
    try {
      const orders = await this.prisma.paymentOrder.findMany({
        orderBy: {
          createdAt: 'desc',
        },
      });

      return {
        length: orders.length,
        orders: orders,
      };
    } catch (error) {
      console.error('Error getting all orders:', error);
      throw new InternalServerErrorException('Error getting all orders');

    }
  }


  async getSignedUrl() {
    try {
      const url = await this.storageService.getSignedUrl('test.pdf');
      if (!url) throw new BadRequestException('Invalid request');
      console.log(url);
      return url;
    } catch (error) {
      console.error('Error getting signed url:', error);
      throw new InternalServerErrorException('Error getting signed url');
    }
  }





  // async optimizeAndCompressPdf(fileContent: Buffer): Promise<Buffer> {
  //   try {
  //     // Step 1: Optimize the PDF structure using pdf-lib
  //     const pdfDoc = await PDFDocument.load(fileContent);
  //     pdfDoc.setCreator('NestJS Compression Service');
  //     pdfDoc.setProducer('PDF-lib');

  //     // Save optimized PDF to buffer
  //     const optimizedBuffer = await pdfDoc.save({ useObjectStreams: false });

  //     // Step 2: Compress using Ghostscript via compress-pdf
  //     const tempDir = path.resolve(__dirname, 'temp');
  //     await fs.promises.mkdir(tempDir, { recursive: true });

  //     const originalFilePath = path.join(tempDir, 'original.pdf');
  //     const compressedFilePath = path.join(tempDir, 'compressed.pdf');

  //     // Write optimized buffer to temporary file
  //     await fs.promises.writeFile(originalFilePath, optimizedBuffer);

  //     console.log('Compressing PDF...');
  //     const compressedBuffer = await compress(originalFilePath);

  //     // Clean up temporary files
  //     await fs.promises.unlink(originalFilePath);

  //     return compressedBuffer;
  //   } catch (error) {
  //     console.error('Error during PDF optimization/compression:', error.message);
  //     throw error;
  //   }
  // }

  async optimizeAndCompressPdf(fileContent: Buffer): Promise<Buffer> {
    const tempDir = path.resolve(__dirname, 'temp');
    let finalBuffer: Buffer;

    try {
      // Create temp directory
      await fs.promises.mkdir(tempDir, { recursive: true });

      // 1. PDF-lib Optimization
      const pdfDoc = await PDFDocument.load(fileContent);
      pdfDoc.setCreator('KIIT_CONNECT');
      pdfDoc.setProducer('KIIT_CONNECT');
      const optimizedBuffer = await pdfDoc.save({ useObjectStreams: false });

      // 2. Ghostscript Compression
      const originalPath = path.join(tempDir, `original-${Date.now()}.pdf`);
      const compressedPath = path.join(tempDir, `compressed-${Date.now()}.pdf`);
      await fs.promises.writeFile(originalPath, optimizedBuffer);

      console.log('Compressing PDF...');
      const compressedBuffer = await compress(originalPath);

      // 3. QPDF Linearization (Final Step)
      console.log('Linearizing PDF...');

      // Create unique temp file for linearization
      const tempLinearizedPath = path.join(tempDir, `linearized-${Date.now()}.pdf`);
      await fs.promises.writeFile(tempLinearizedPath, compressedBuffer);

      // Use --replace-input to safely overwrite the temp file
      await execAsync(`qpdf --linearize "${tempLinearizedPath}" --replace-input`);

      // Verify file exists before reading
      await fs.promises.access(tempLinearizedPath, fs.constants.R_OK);
      finalBuffer = await fs.promises.readFile(tempLinearizedPath);

    } catch (error) {
      console.error('PDF processing failed:', error.message);
      throw new Error(`PDF processing failed: ${error.message}`);
    } finally {
      // Cleanup all temp files
      try {
        const files = await fs.promises.readdir(tempDir);
        await Promise.all(files.map(file =>
          fs.promises.unlink(path.join(tempDir, file)).catch(() => { })
        ));
      } catch (cleanupError) {
        console.warn('Temp file cleanup failed:', cleanupError.message);
      }
    }

    return finalBuffer;
  }


  async transferFile(fileId: string, key: string): Promise<void> {
    // Step 1: Download file from Google Drive
    const fileContent = await this.driveService.downloadFile(fileId);
    const compressedContent = await this.optimizeAndCompressPdf(fileContent);

    // Step 2: Upload file to Amazon R2
    await this.storageService.uploadFileToAmazonR2(
      key,
      compressedContent,
    )

    log('File transferred successfully:', key);

  }




  async transferFilesFromGdriveToR2() {
    const subjects =[]
    try {
      let subjectSlug = "";

      for (const subject of subjects) {
        const pyqs = subject.pyqs;
        if (pyqs.length === 0) {
          console.log("No pyqs found for subject: ", subject.name);
          continue;
        }
        //return subject slug by name
        subjectSlug = subject.name.replace(/ /g, '-').toLowerCase();


        for (const pyq of pyqs) {

          // if (pyq.status === "NO-SOLUTION" || pyq.status === "VERIFIED") {
          //   console.log("No solution found for pyq: ", pyq.name);
          //   continue;
          // } else if (pyq.status === "APPROVED") {
          //   console.log("Approved pyq found: ", pyq.name);
          //   // Transfer the file
          //   await this.transferFile(pyq.nSolution, `${subjectSlug}/solutions/${pyq.nSolution}.pdf`);
          // }

          // if (pyq.type.toUpperCase() === pyq.type) {
          const question = pyq.Question;
          await this.transferFile(question, `${subjectSlug}/questions/${question}.pdf`);
          await this.transferFile(pyq.nSolution, `${subjectSlug}/solutions/${pyq.nSolution}.pdf`);
          await this.prisma.subject.update({
            where: {
              id: subject.id
            },
            data: {
              pyqs: {
                updateMany: {
                  where: {
                    id: pyq.id
                  },
                  data: {
                    nQuestion: question,
                  }
                }
              }
            }
          })
          console.log("File transferred successfully: ", question);
          // } else { 
          // }

        }


      }

    } catch (error) {
      console.error("Error transferring files: ", error);
      throw new InternalServerErrorException("Error transferring files");
    }
  }



  async transferFilesNotesFromGdriveToR2() {
    const subjects =[]
    try {
      let subjectSlug = "";

      for (const subject of subjects) {
        const notes = subject.notes;
        if (notes.length === 0) {
          console.log("No pyqs found for subject: ", subject.name);
          continue;
        }
        //return subject slug by name
        subjectSlug = subject.name.replace(/ /g, '-').toLowerCase();


        for (const note of notes) {
          if (note.status === "APPROVED") {
            console.log("Approved pyq found: ", note.name);
            // Transfer the file
            await this.transferFile(note.Notes, `${subjectSlug}/notes/${note.Notes}.pdf`);
          } else if (note.status === "VERIFIED") {
            console.log("No solution found for pyq: ", note.name);

            continue;
          }
        }

        // if (pyq.type.toUpperCase() === pyq.type) {
        //   const question = pyq.nQuestion;
        //   await this.transferFile(question, `${subjectSlug}/questions/${question}.pdf`);
        // }
      }

    } catch (error) {
      console.error("Error transferring files: ", error);
      throw new InternalServerErrorException("Error transferring files");
    }
  }


  async securityViolated(data: {
    userId: string
  }) {
    try {

      const user = await this.prisma.securityViolated.create({
        data: {
          userId: data.userId
        }
      })
      return {
        success: true,
      }
    } catch (error) {
      console.error("Error transferring files: ", error);
      throw new InternalServerErrorException("Error saving security violated data");
    }
  }

  async getSecurityViolated() {
    try {
      const user = await this.prisma.securityViolated.findMany({
        orderBy: {
          createdAt: "desc"
        },
        include: {
          user: {
            select: {
              name: true,
              email: true,
            }
          }
        }
      })
      return user;

    } catch (error) {
      console.error("Error fetching  security violated data: ", error);
      throw new InternalServerErrorException("Error getting security violated data");
    }
  }

  async getMonthlyPlan() {
    try {
      const user = await this.prisma.user.findMany({
        where: {
          plan: "Monthly",
          expiryDate: {
            lte: new Date()
          }
        },

        select: {
          id: true,
          name: true,
          email: true,
          plan: true,
          expiryDate: true,
        },
        orderBy: {
          createdAt: "desc"
        },

      })
      return {
        length: user.length,
        data: user
      }

    } catch (error) {
      console.error("Error fetching  monthly plan data: ", error);
      throw new InternalServerErrorException("Error getting monthly plan data");
    }
  }





  async expireMonthlyUsers() {
    try {
      const users = await this.prisma.user.findMany({
        where: {
          plan: "Monthly",
          expiryDate: {
            lte: new Date()
          },
          isPremium: true
        },
      });

      for (const user of users) {
        await this.prisma.premiumMember.delete({
          where: {
            userId: user.id
          },
        });

        await this.prisma.user.update({
          where: {
            id: user.id
          },
          data: {
            isPremium: false,
            plan: null,
            expiryDate: null
          }
        });
        await this.mailService.sendMailToPremiumExpired(user.email, user.name);
        await this.cacheService.del(user.email);


      }

      return users;


    } catch (error) {
      console.error("Error fetching  monthly plan data: ", error);
      throw new InternalServerErrorException("Error getting monthly plan data");
    }
  }

  async expireMonthlyUsersByHard() {
    try {
      const users = []

      for (const user of users) {
        // await this.prisma.premiumMember.delete({
        //   where:{
        //     userId:user.id
        //   },
        // });

        // await this.prisma.user.update({
        //   where:{
        //     id:user.id
        //   },
        //   data:{
        //     isPremium:false,
        //   plan:null,
        //     expiryDate:null
        //   }
        // });
        await this.mailService.sendMailToPremiumExpired(user.email, user.name);
        await this.cacheService.del(user.email);


      }

      return users;


    } catch (error) {
      console.error("Error fetching  monthly plan data: ", error);
      throw new InternalServerErrorException("Error getting monthly plan data");
    }
  }


  async filterUsersByEmail() {
    const users = []

    const users24 =[]

    // const rollNo = ["22053420","23948475"];

    try {


      const usersIds = users.map((user) => user.user.id);
      //delete all the premium members
      const transaction = await this.prisma.$transaction([
        this.prisma.premiumMember.deleteMany({
          where: {
            userId: {
              in: usersIds
            }
          }
        }),
        this.prisma.user.updateMany({
          where: {
            id: {
              in: usersIds
            }
          },
          data: {
            isPremium: false,
            plan: null,
            expiryDate: null,
            allowedProfileUpdate: true
          }
        })
      ]);
      console.log("Transaction completed successfully:", transaction);

      return {
        length: users.length,
        data: users
      };
    } catch (error) {
      console.error("Error fetching monthly plan data: ", error);
      throw new InternalServerErrorException("Error getting monthly plan data");
    }


  }

  async getUsersDetails(email: string) {
    try {
      const user = await this.prisma.user.findUnique({
        where: {
          email: email
        },
        include: {
          PremiumMember: true,
          securityViolated: true,

        }

      });
      if (!user) {
        throw new NotFoundException("User not found");
      }
      return user;

    } catch (error) {
      console.error("Error fetching user details: ", error);
      throw new InternalServerErrorException("Error getting user details");

    }
  }

  async getUserById(userId: string) {
    try {
      const user = await this.prisma.user.findUnique({
        where: {
          id: userId,
        },
        include: {
          PremiumMember: true,
          maintenanceFeeHistory: {
            where: {
              status: 'PAID'
            },
            orderBy: { paidDate: 'desc' },
            take: 10
          }
        }
      });

      console.log("user", user);

      if (!user) {
        throw new NotFoundException('User not found');
      }

      // Convert maintenance fees to payment records
      const maintenancePayments = user.maintenanceFeeHistory.map(fee => ({
        id: fee.id,
        type: 'maintenance' as const,
        amount: fee.amount,
        status: 'success' as const,
        date: fee.paidDate || fee.createdAt,
        razorpayPaymentId: fee.paymentId,
        razorpayOrderId: fee.orderId
      }));

      // Get subscription payment history from user's premium status and payment info
      const subscriptionPayments = [];

      if (user.isPremium && user.paymentDate) {
        subscriptionPayments.push({
          id: `sub_${user.id}_${user.paymentDate.getTime()}`,
          type: 'subscription' as const,
          amount: 99, // Assuming ₹99 subscription fee
          status: 'success' as const,
          date: user.paymentDate,
          razorpayPaymentId: null, // We don't store this in user table
          razorpayOrderId: null
        });
      }

      // Combine and sort all payments by date (newest first)
      const paymentHistory = [...maintenancePayments, ...subscriptionPayments]
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 10); // Limit to 10 most recent payments

      return {
        id: user.id,
        email: user.email,
        name: user.name,
        phone: user.PremiumMember?.whatsappNumber || null,
        branch: user.PremiumMember?.branch || null,
        year: user.PremiumMember?.year || null,
        isPremium: user.isPremium,
        maintenanceFeeDue: user.maintenanceFeeDue || 0,
        lastMaintenancePayment: user.lastMaintenancePayment,
        paymentHistory: paymentHistory,
        premiumMember: user.PremiumMember?true:false,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Internal Server Error');
    }
  }

}
