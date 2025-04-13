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
    const users = [
      {
        name: '1831 _MADHURI',
        email: '21051831@kiit.ac.in',
      },
      {
        name: '1856_ SUSHANT',
        email: '21051856@kiit.ac.in',
      },
      {
        name: '540_Devansh Agrawal',
        email: '2105540@kiit.ac.in',
      },
      {
        name: '3277_Bishal KUMAR RAUNIYAR',
        email: '21053277@kiit.ac.in',
      },
      {
        name: '597_SIDDHARTH_ JENA',
        email: '21051597@kiit.ac.in',
      },
      {
        name: '65_RUDRALI MAHAPATRA',
        email: '2130065@kiit.ac.in',
      },
      {
        name: 'ASHUTOSH KUMAR ROUT',
        email: '2105781@kiit.ac.in',
      },
      {
        name: '6246_SANTOSH KUMAR MANJHI',
        email: '2106246@kiit.ac.in',
      },
      {
        name: '5434-ADITYA KUMAR',
        email: '2105434@kiit.ac.in',
      },
      {
        name: '752_Simran Rai',
        email: '2105752@kiit.ac.in',
      },
      {
        name: '2149_Ayush Saha',
        email: '21052149@kiit.ac.in',
      },
      {
        name: '1284_Anchita Padhy',
        email: '21051284@kiit.ac.in',
      },
      {
        name: '2396_Ankita Mohan',
        email: '21052396@kiit.ac.in',
      },
      {
        name: '506_Milani Nayak',
        email: '21052506@kiit.ac.in',
      },
      {
        name: '133_farhat Tasnim',
        email: '21051133@kiit.ac.in',
      },
      {
        name: '2883_ SUKIRTI',
        email: '21052883@kiit.ac.in',
      },
      {
        name: '1965_Alisha Panigrahi',
        email: '21051965@kiit.ac.in',
      },
      {
        name: '2048_SATYA SIDHARTHA SETHY',
        email: '2102048@kiit.ac.in',
      },
      {
        name: '1374_Aniruddh Verma',
        email: '21051374@kiit.ac.in',
      },
      {
        name: '847_VISHAL BANERJEE',
        email: '2105847@kiit.ac.in',
      },
      {
        name: '4085_Neon Sambui',
        email: '2104085@kiit.ac.in',
      },
      {
        name: '9119_Tushar Bhatt',
        email: '2129119@kiit.ac.in',
      },
      {
        name: '4011_ARKAPRAVA GHOSH',
        email: '2104011@kiit.ac.in',
      },
      {
        name: '107_Shruti Dwivedi',
        email: '2129107@kiit.ac.in',
      },
      {
        name: '340 ANIMESH',
        email: '21053340@kiit.ac.in',
      },
      {
        name: '1563_Divyansh Chauhan',
        email: '21051563@kiit.ac.in',
      },
      {
        name: '453_DAWAR SHAFAQUE',
        email: '2105453@kiit.ac.in',
      },
      {
        name: '828_SHASHI PRAKASH',
        email: '2105828@kiit.ac.in',
      },
      {
        name: '1517_SREJA DUTTA',
        email: '21051517@kiit.ac.in',
      },
      {
        name: '106_Ayush Senapati',
        email: '2106106@kiit.ac.in',
      },
    ];
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

  async removeSiginToken(dto: { email: string; token: string }) {
    try {
      const token: string = await this.cacheService.get(dto.email);
      if (token) {
        const decode: string[] = await JSON.parse(token);
        if (decode.includes(dto.token)) {
          const newToken = decode.filter((item) => item !== dto.token);
          await this.cacheService.set(dto.email, JSON.stringify(newToken));
          return true;
        }
      }
      return false;
    } catch (error) {
      console.log(error);
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
  }) {
    try {
      const user = await this.prisma.premiumMember.update({
        where: {
          userId: dto.userId,
        },
        data: {
          year: dto.year
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
            // isPremium:true

          },

          paymentScreenshot: undefined,
          isActive: false,

        },
        select: {
          user: {
            select: {
              email: true,
              name: true
            },

          },
          branch: true,
          year: true,
          userId: true,
          whatsappNumber: true,
          paymentScreenshot: true,
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
            }
          }
        },
        select: {
          user: {
            select: {
              id: true,
            }
          }
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
            userId: usr.id,
            branch: 'CSE',
            whatsappNumber: '0000000000',
            paymentScreenshot: 'addedByuser',
            year: usr.batch,
            isActive: true,
          },
        }),
        userUpdate: this.prisma.user.update({
          where: {
            email: usr.email,
          },
          data: {
            isPremium: true,
            allowedProfileUpdate: true,
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





  async optimizeAndCompressPdf(fileContent: Buffer): Promise<Buffer> {
    try {
      // Step 1: Optimize the PDF structure using pdf-lib
      const pdfDoc = await PDFDocument.load(fileContent);
      pdfDoc.setCreator('NestJS Compression Service');
      pdfDoc.setProducer('PDF-lib');
      
      // Save optimized PDF to buffer
      const optimizedBuffer = await pdfDoc.save({ useObjectStreams: false });

      // Step 2: Compress using Ghostscript via compress-pdf
      const tempDir = path.resolve(__dirname, 'temp');
      await fs.promises.mkdir(tempDir, { recursive: true });

      const originalFilePath = path.join(tempDir, 'original.pdf');
      const compressedFilePath = path.join(tempDir, 'compressed.pdf');

      // Write optimized buffer to temporary file
      await fs.promises.writeFile(originalFilePath, optimizedBuffer);

      console.log('Compressing PDF...');
      const compressedBuffer = await compress(originalFilePath);

      // Clean up temporary files
      await fs.promises.unlink(originalFilePath);

      return compressedBuffer;
    } catch (error) {
      console.error('Error during PDF optimization/compression:', error.message);
      throw error;
    }
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
    const subjects = []
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

          if (pyq.status === "NO-SOLUTION" || pyq.status === "VERIFIED") {
            console.log("No solution found for pyq: ", pyq.name);
            continue;
          } else if (pyq.status === "APPROVED") {
            console.log("Approved pyq found: ", pyq.name);
            // Transfer the file
            await this.transferFile(pyq.nSolution, `${subjectSlug}/solutions/${pyq.nSolution}.pdf`);
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



  async transferFilesNotesFromGdriveToR2() {
    const subjects =[
      {
        "id": "65d212841bdc9aab413387ec",
        "name": "PHYSICS",
        "SUBCODE": "PH10001",
        "Credit": "3",
        "folderId": "1NBj0CZ5uc-ThiSApU58PpX9xKR_vhrv0",
        "notes": [
          {
            "id": "72ac6b26-f6fb-4e42-a063-a730a9d0f838",
            "name": "Physics Notes",
            "mimeType": "application/pdf",
            "isDownloadable": false,
            "status": "VERIFIED",
            "Notes": "18a8dpDOXzrcFfxD1cVT1c676_r6_2hRD"
          }
        ]
      },
      {
        "id": "65d213b11bdc9aab413387f7",
        "name": "ENGLISH",
        "SUBCODE": "HS10001",
        "Credit": "2",
        "folderId": "160pnTWAGgB2IOPSTl_17I4ofjY257obo",
        "notes": [
          {
            "id": "e8833391-a8a0-4a34-9b21-8e92968688d8",
            "name": "Professional Communication Notes",
            "mimeType": "application/pdf",
            "isDownloadable": false,
            "status": "VERIFIED",
            "Notes": "1GIX1PCOvwOrjUk_klO1lTH4Qpngg3qri"
          }
        ]
      },
      {
        "id": "65d213b11bdc9aab413387f8",
        "name": "BASIC ELECTRICAL ENGINEERING",
        "SUBCODE": "EC10001",
        "Credit": "2",
        "folderId": "1CMCRpagYf-Nrow_izVQAjfENbiDVoS0p",
        "notes": [
          {
            "id": "6d5c0ad0-81c3-43ba-b77f-0fb035c16da4",
            "name": "Basic Electrical Engineering Notes 1",
            "mimeType": "application/pdf",
            "isDownloadable": false,
            "status": "VERIFIED",
            "Notes": "11QUu-7Fe9MSZ9pkNzPMiJ4k4lKE8TEv2"
          },
          {
            "id": "094f7696-26f5-4013-9eaf-9269ff7e195c",
            "name": "Basic Electrical Engineering Notes 2",
            "mimeType": "application/pdf",
            "isDownloadable": false,
            "status": "VERIFIED",
            "Notes": "1Jc77vOG499halTgKYyLd8rKJF_fTnhWN"
          }
        ]
      },
      {
        "id": "65d213b11bdc9aab413387f5",
        "name": "CHEMISTRY",
        "SUBCODE": "CH10001",
        "Credit": "3",
        "folderId": "169Oi8YbSco-OJmkZE6LKnnty62IekBOM",
        "notes": [
          {
            "id": "290ce12a-82e3-43ff-9af4-8d29176d6f8b",
            "name": "Chemistry Notes",
            "mimeType": "application/pdf",
            "isDownloadable": false,
            "status": "VERIFIED",
            "Notes": "1sEWNjIB-QfzQUTBH_p8nH39ZzeSbRh3_"
          }
        ]
      },
      {
        "id": "65d214db1bdc9aab413387ff",
        "name": "Data Structure",
        "SUBCODE": "CS2001",
        "Credit": "4",
        "folderId": "1wylGvLGZXWnApRkc2noJUostT8FuGE6K",
        "notes": [
          {
            "id": "9e057cec-280d-4b0f-b8be-215a24b7ddc9",
            "name": "Data Structures and Algorithms Notes",
            "mimeType": "application/pdf",
            "isDownloadable": false,
            "status": "VERIFIED",
            "Notes": "1CSuJbYzUFCPGn97wx00UsLcfjLT-DFqD"
          }
        ]
      },
      {
        "id": "65d214db1bdc9aab41338800",
        "name": "Digital Systems Design",
        "SUBCODE": "EC20005",
        "Credit": "3",
        "folderId": "1PMBLip9V7jVPNy_MpOhgNtHEPwIC_tsu",
        "notes": [
          {
            "id": "1d96c7af-84be-44fe-bab3-d966c93a627c",
            "name": "Digital Electronics Notes",
            "mimeType": "application/pdf",
            "isDownloadable": false,
            "status": "VERIFIED",
            "Notes": "11SKJCmALy3LnJy-3O87OWGBY92eBaycO"
          }
        ]
      },
      {
        "id": "65d214db1bdc9aab41338804",
        "name": "Automata Theory and Formal Languages",
        "SUBCODE": "CS21003",
        "Credit": "4",
        "folderId": "1P-30fTnkY033P2rTaOZmq1p-EUg7ahom",
        "notes": [
          {
            "id": "af3c6931-75ed-4193-b43e-9bc510429aad",
            "name": "Automata and Formal Languages Notes 1",
            "mimeType": "application/pdf",
            "isDownloadable": false,
            "status": "VERIFIED",
            "Notes": "1RKp36drtFuL3QR_qXmr8GaDSV9wl_VK1"
          },
          {
            "id": "25670093-e4df-491f-af22-251e4c1491dd",
            "name": "Automata and Formal Languages Notes 2",
            "mimeType": "application/pdf",
            "isDownloadable": false,
            "status": "VERIFIED",
            "Notes": "1DjyAzje76qyk3SvpW8AQY82_XXN18Ufw"
          }
        ]
      },
      {
        "id": "65d214db1bdc9aab41338805",
        "name": "Probability and Statistics",
        "SUBCODE": "MA2011",
        "Credit": "4",
        "folderId": "1h2GkDhwd5NHhEo7TjUccF9KQu3bFIwCg",
        "notes": [
          {
            "id": "7718f08d-5db2-4542-bd6a-0d8e785d1ae0",
            "name": "Probability and Statistics Notes",
            "mimeType": "application/pdf",
            "isDownloadable": false,
            "status": "VERIFIED",
            "Notes": "1LyfhRaCwiqBDc4sNTMqPKwDrwbPb587L"
          }
        ]
      },
      {
        "id": "65d2211d1bdc9aab41338806",
        "name": "COMPUTER NETWORKS",
        "SUBCODE": "IT3009",
        "Credit": "3",
        "folderId": "1XJcx1-Ly2drudYy0vqr_cK20dJVJYpzX",
        "notes": [
          {
            "id": "61beea9b-9ba7-446f-9ae4-78c73f985e5c",
            "name": "Computer Networking Notes 1",
            "mimeType": "application/pdf",
            "isDownloadable": false,
            "status": "VERIFIED",
            "Notes": "1mV35BInPeTCc7lgkinEmo6U7xiLOF3iT"
          },
          {
            "id": "841730ca-e51a-409e-b1f6-51a2af22a5d9",
            "name": "Computer Networking Notes 2",
            "mimeType": "application/pdf",
            "isDownloadable": false,
            "status": "VERIFIED",
            "Notes": "1OUtfP9Vzk9yKzV0oRQ8lGXqqBabBUF7F"
          },
          {
            "id": "87a40ac0-28d5-43c1-8074-ca9f882edc50",
            "name": "Computer Networking Slides",
            "mimeType": "application/pdf",
            "isDownloadable": false,
            "status": "VERIFIED",
            "Notes": "1NrA0XfilVe0FMI2RtgYxOThNd1QDQS25"
          }
        ]
      },
      {
        "id": "65d2211d1bdc9aab41338809",
        "name": "SOFTWARE ENGINEERING",
        "SUBCODE": "IT3003",
        "Credit": "4",
        "folderId": "1LjbtjshmDlZVSN9scqnoMiXlNnTl9FB1",
        "notes": [
          {
            "id": "3698fdb4-b097-44ea-a7ac-98de484527c6",
            "name": "Software Engineering Notes 1",
            "mimeType": "application/pdf",
            "isDownloadable": false,
            "status": "VERIFIED",
            "Notes": "13UmUJ_Q5nDFm6Rg_MKjny8l3xRPai1eR"
          },
          {
            "id": "6ce927e2-51a9-43dd-8b5c-135eec42bd78",
            "name": "Software Engineering Notes 2",
            "mimeType": "application/pdf",
            "isDownloadable": false,
            "status": "VERIFIED",
            "Notes": "1whAGsOsTKv2RrkK5Hnghn3yv2P24AG-2"
          },
          {
            "id": "53851eea-16f3-4786-ad6f-bd08c0665e0f",
            "name": "Software Engineering Notes 3",
            "mimeType": "application/pdf",
            "isDownloadable": false,
            "status": "VERIFIED",
            "Notes": "1gkh5kG5EA2o3VikO-mnu--6m1UxHoFbP"
          },
          {
            "id": "ebbe2428-e21a-4c4a-9201-0fbb69ddc0b0",
            "name": "Software Engineering Slides",
            "mimeType": "application/pdf",
            "isDownloadable": false,
            "status": "VERIFIED",
            "Notes": "1UUdEE38HdWssrveZtD6HPC-6uQG35bVM"
          }
        ]
      },
      {
        "id": "65d2211d1bdc9aab41338808",
        "name": "HIGH PERFORMANCE COMPUT",
        "SUBCODE": "CS3010",
        "Credit": "4",
        "folderId": "1PGH1kRoS1BYOZbd3dIi8tzSjH7ruA3js",
        "notes": [
          {
            "id": "de8c6a97-2572-4c76-9d1d-9429274fb45e",
            "name": "High Performance Computing Notes 1",
            "mimeType": "application/pdf",
            "isDownloadable": false,
            "status": "VERIFIED",
            "Notes": "1mRzLyJhc0qs2R2zMUCBpIwoOrCj6Es0D"
          },
          {
            "id": "9c8b46f7-0082-4628-9667-3c0e4c338283",
            "name": "High Performance Computing Notes 2",
            "mimeType": "application/pdf",
            "isDownloadable": false,
            "status": "VERIFIED",
            "Notes": "1jsNxyJOcD0qJ9GscpObjeSyzTI7dyRdZ"
          },
          {
            "id": "b64b0eab-cd11-4c5b-bae9-1dcc1f32833b",
            "name": "High Performance Computing Notes 3",
            "mimeType": "application/pdf",
            "isDownloadable": false,
            "status": "VERIFIED",
            "Notes": "1Uka9QKaJCm3q3pLf51axGp_6HYS6H0GL"
          },
          {
            "id": "2deb851a-e9b7-44e1-a3e0-a1348a7807c7",
            "name": "High Performance Computing Slides",
            "mimeType": "application/pdf",
            "isDownloadable": false,
            "status": "VERIFIED",
            "Notes": "1mLDaR5kO-fFW0osntdD0LN7HQU5QFNmR"
          }
        ]
      },
      {
        "id": "65d2211d1bdc9aab41338807",
        "name": "DESIGN & ANALYSIS OF ALGO",
        "SUBCODE": "CS2012",
        "Credit": "3",
        "folderId": "1jPMKCPq5VvpdisqvnlRDw7ORQ4sVBccV",
        "notes": [
          {
            "id": "971a298e-2957-4fdc-b840-70a7a0944c1c",
            "name": "Design and Analysis of Algorithms Notes 1",
            "mimeType": "application/pdf",
            "isDownloadable": false,
            "status": "VERIFIED",
            "Notes": "1bCcP6-rTOEQPjNyCvPHJtu9kRHqC2Qmc"
          }
        ]
      },
      {
        "id": "65d221b01bdc9aab4133880c",
        "name": "COMPILER DESIGN",
        "SUBCODE": "CS3008",
        "Credit": "3",
        "folderId": "1XWuvoNDWq-n6W0azKIAcRNSUcPiL-jjV",
        "notes": [
          {
            "id": "b7b1214f-f8e4-4a95-9d4a-6d3b86998240",
            "name": "Compiler Design Notes 1",
            "mimeType": "application/pdf",
            "isDownloadable": false,
            "status": "VERIFIED",
            "Notes": "1eT68cNj8E5DDtgFnkpn8zJh4kL9jCu07"
          },
          {
            "id": "111d034f-89b4-49a2-b9a7-b51c5383e772",
            "name": "Compiler Design Notes 3",
            "mimeType": "application/pdf",
            "isDownloadable": false,
            "status": "VERIFIED",
            "Notes": "1Q8rkt8d1qCQcUCPjrMCNvxA9Yav_4NPK"
          }
        ]
      },
      {
        "id": "65d221b01bdc9aab4133880d",
        "name": "CLOUD COMPUTING",
        "SUBCODE": "IT3022",
        "Credit": "3",
        "folderId": "1YDWvKY3RVtDZG_Cs8_bBNf8FxEbeQK7b",
        "notes": [
          {
            "id": "670466d3-123c-4a50-a951-ddb48b8dc13e",
            "name": "Cloud Computing Slides 1",
            "mimeType": "application/pdf",
            "isDownloadable": false,
            "status": "VERIFIED",
            "Notes": "1499C_ohwSo2EjkAZ995tR3ngx0PzgQcM"
          },
          {
            "id": "949582c0-a0d9-465c-a315-be9eb810e00e",
            "name": "Cloud Computing Slides 2",
            "mimeType": "application/pdf",
            "isDownloadable": false,
            "status": "VERIFIED",
            "Notes": "1mNnwxIEtomae3B9npCfcsgzZqB0hKXOg"
          }
        ]
      },
      {
        "id": "65d221b01bdc9aab4133880e",
        "name": "Software Project Management",
        "SUBCODE": null,
        "Credit": "3",
        "folderId": "1WB2RqjXJJtMDRlaiVORwUMefP7af0bs_",
        "notes": [
          {
            "id": "0f1be501-c5e9-47b3-808d-9fcff26bda6e",
            "name": "Software Project Management Slides 1",
            "mimeType": "application/pdf",
            "isDownloadable": false,
            "status": "VERIFIED",
            "Notes": "1hKybD43QyA8f0fcP5uZL5CCBS7H0NQ_e"
          },
          {
            "id": "3f381753-25e4-474c-a049-7182ad50eea9",
            "name": "Software Project Management Slides 2",
            "mimeType": "application/pdf",
            "isDownloadable": false,
            "status": "VERIFIED",
            "Notes": "PHCCN5ZilJpmPyeNSnqz4S_h1lzk"
          }
        ]
      },
      {
        "id": "65d222721bdc9aab41338810",
        "name": "Data Analytics",
        "SUBCODE": null,
        "Credit": "3",
        "folderId": "1aa7g6m9e7IHOS98ZA9T4S1z1mJ0eW_Pf",
        "notes": [
          {
            "id": "b516b62f-b539-4eaa-812e-822db020f3d4",
            "name": "Data Analytics Slides",
            "mimeType": "application/pdf",
            "isDownloadable": false,
            "status": "VERIFIED",
            "Notes": "1t8w5ctejs7vLPWx_vIgd62tXTChumwnv"
          }
        ]
      },
      {
        "id": "65d222721bdc9aab41338812",
        "name": "Internet Of Things",
        "SUBCODE": null,
        "Credit": "3",
        "folderId": "1tXWyqCsnf4whXjOVbvWfvB-ERkWecKCI",
        "notes": [
          {
            "id": "04fb600b-686a-4960-bdb3-b29b6e14f2cf",
            "name": "Internet of Things Notes",
            "mimeType": "application/pdf",
            "isDownloadable": false,
            "status": "VERIFIED",
            "Notes": "1Kxz6cYa-2HtIB_zRcUJhh_R6p_wQB0ql"
          }
        ]
      },
      {
        "id": "65d222721bdc9aab4133880f",
        "name": "Machine Learning",
        "SUBCODE": null,
        "Credit": "3",
        "folderId": "1gB0JzDFuYETCKwZ7A-xhAgXvTbaiFYVf",
        "notes": [
          {
            "id": "f5736aa0-6b2e-4837-affc-5e8eeddb3328",
            "name": "Machine Learning Slides",
            "mimeType": "application/pdf",
            "isDownloadable": false,
            "status": "VERIFIED",
            "Notes": "1s_VsLu26okx8eni4q92H3fmdbw2PI2J7"
          }
        ]
      },
      {
        "id": "65d222721bdc9aab41338811",
        "name": "Natural Language Prcessing",
        "SUBCODE": null,
        "Credit": "3",
        "folderId": "1sqfTf3qrO56n2y3jEcJEB7KOVAPjBEAA",
        "notes": [
          {
            "id": "78c2a07c-689b-489c-ad8b-73f2ac2ab910",
            "name": "Natural Language Processing Slides",
            "mimeType": "application/pdf",
            "isDownloadable": false,
            "status": "VERIFIED",
            "Notes": "17XChTTDCRPTGfpMxXKW8Z10aWe69E4eK"
          },
          {
            "id": "2a6c372d-725a-49dc-875e-91079cc30ff0",
            "name": "Natural Language Processing Notes",
            "mimeType": "application/pdf",
            "isDownloadable": false,
            "status": "VERIFIED",
            "Notes": "1tyx9TbFm4W8XsEzIr7tFgLXCTAqRxi_G"
          }
        ]
      },
      {
        "id": "65d243b8567cea6553c6b51a",
        "name": "OS",
        "SUBCODE": "CS2002",
        "Credit": "3",
        "folderId": "1TbLCaB8-2PSReL8IZ-CXdnkrivRkmr5d",
        "notes": [
          {
            "id": "4c373165-0a87-42c0-80ae-3294b7254477",
            "name": "Operating Systems Notes 1",
            "mimeType": "application/pdf",
            "isDownloadable": false,
            "status": "VERIFIED",
            "Notes": "1Y8BDCOPkXr0juSZeIPdyk_HY4v8KRV7u"
          },
          {
            "id": "0198db2f-ec93-48aa-a6a8-edb1940a9a45",
            "name": "Operating Systems Notes 2",
            "mimeType": "application/pdf",
            "isDownloadable": false,
            "status": "VERIFIED",
            "Notes": "1AKkP2vKYQIP10Zj_2s0snm5ajPuDiD6F"
          },
          {
            "id": "dd7bf3a6-63b3-407f-88c3-5c7fc816f952",
            "name": "Operating Systems Notes 3",
            "mimeType": "application/pdf",
            "isDownloadable": false,
            "status": "VERIFIED",
            "Notes": "1CAdWuSsbOtD2Bm6knqxgm5Rc59_03BdA"
          },
          {
            "id": "84adfcfb-4bc7-4cb7-8a97-a4151a5ed252",
            "name": "Operating Systems Notes 4",
            "mimeType": "application/pdf",
            "isDownloadable": false,
            "status": "VERIFIED",
            "Notes": "1eby2juAqJo6LwUCmdhKccFgbLpjtbqvh"
          },
          {
            "id": "678b6b10-6fd6-4355-abe2-70a0074a89c2",
            "name": "Operating Systems Slides",
            "mimeType": "application/pdf",
            "isDownloadable": false,
            "status": "VERIFIED",
            "Notes": "1CjYoGvxgtkuh9VzQrkDkAZe1hKmfl2AT"
          }
        ]
      },
      {
        "id": "65d243b8567cea6553c6b51c",
        "name": "COA",
        "SUBCODE": "CS21002",
        "Credit": "4",
        "folderId": "1k8RbQS6fc_w9khO6goAEe95alrb_awN6",
        "notes": [
          {
            "id": "76a77fec-5d11-4098-a366-755ad383dfad",
            "name": "Computer Architecture Notes 1",
            "mimeType": "application/pdf",
            "isDownloadable": false,
            "status": "VERIFIED",
            "Notes": "1atSgjhNkc-LKJc5JcJ8ETVt12N-N8vVb"
          },
          {
            "id": "caf06ef2-f033-4254-8a60-b30d42038539",
            "name": "Computer Architecture Notes 2",
            "mimeType": "application/pdf",
            "isDownloadable": false,
            "status": "VERIFIED",
            "Notes": "1RCMBRH-WXFuhBSMVjdQVlsXpud8q69bl"
          }
        ]
      },
      {
        "id": "65d243b8567cea6553c6b519",
        "name": "OOP JAVA",
        "SUBCODE": "CS20004",
        "Credit": "3",
        "folderId": "19WSxWiqmXvSCIQNuTEAycnhhHX1I3nQm",
        "notes": [
          {
            "id": "b63af291-f27e-442a-a3c9-b4e82db8feb8",
            "name": "HTML Slides",
            "mimeType": "application/pdf",
            "isDownloadable": false,
            "status": "VERIFIED",
            "Notes": "1k60Q1C8cmPdIkZlDoeCD938HhrnfftI4"
          },
          {
            "id": "5ed67ce3-7077-433c-a22e-6ca5f68c716e",
            "name": "Java Slides",
            "mimeType": "application/pdf",
            "isDownloadable": false,
            "status": "VERIFIED",
            "Notes": "1rE1bYaHoHne1TBsrWe2hvndzUM7DGZ26"
          },
          {
            "id": "495eef96-3584-4d64-a661-caa51bc44973",
            "name": "JDBC Slides",
            "mimeType": "application/pdf",
            "isDownloadable": false,
            "status": "VERIFIED",
            "Notes": "1-7lyG5Ocu-gD_TWUVZCVWOFtbIZ27ZkN"
          }
        ]
      },
      {
        "id": "65d243b8567cea6553c6b51b",
        "name": "Discrete Structures",
        "SUBCODE": "MA21002",
        "Credit": "4",
        "folderId": "1GVMm-AtPcO7GtRBEZ-a18fOvqRuHCbkw",
        "notes": [
          {
            "id": "db92b507-1dad-4b8b-8c92-ee0c16faa182",
            "name": "Discrete Mathematics",
            "mimeType": "application/pdf",
            "isDownloadable": false,
            "status": "VERIFIED",
            "Notes": "1O87KW9j3Q5z0oGa58qFxJHOrWcwXiKbA"
          }
        ]
      },
      {
        "id": "65d243b8567cea6553c6b51d",
        "name": "DBMS",
        "SUBCODE": "CS20006",
        "Credit": "3",
        "folderId": "1KZx4AV-MF0m6qnvwIAyZxDoG7gnTCe9W",
        "notes": [
          {
            "id": "b490fbc4-8623-4b24-b734-325d80799ec0",
            "name": "Database Management Systems Notes 1",
            "mimeType": "application/pdf",
            "isDownloadable": false,
            "status": "VERIFIED",
            "Notes": "1R7vr8xkDTtAFvuVCnGaUQOuGeBRnDP4k"
          },
          {
            "id": "98e381ab-e600-4a1f-8cc1-afbd759e7a08",
            "name": "Database Management Systems Notes 2",
            "mimeType": "application/pdf",
            "isDownloadable": false,
            "status": "VERIFIED",
            "Notes": "1Mo3xmInesdt7St3p7mTEZklKrJgorLA2"
          },
          {
            "id": "9758e173-07cb-4c91-b557-3a856d2a5c84",
            "name": "Database Management Systems Notes 3",
            "mimeType": "application/pdf",
            "isDownloadable": false,
            "status": "VERIFIED",
            "Notes": "1EkztrPY58PrZm5RDv7BLG35zCUNJ3feW"
          },
          {
            "id": "a70d9c01-4ce4-4fee-9203-e4d8fa596eff",
            "name": "Database Management Systems Notes 4",
            "mimeType": "application/pdf",
            "isDownloadable": false,
            "status": "VERIFIED",
            "Notes": "13kg3ySn099SYYo73xsGoW9DO8eO490n9"
          },
          {
            "id": "f75e9038-358c-47fb-961b-f5e4bf033091",
            "name": "Database Management Systems Slides",
            "mimeType": "application/pdf",
            "isDownloadable": false,
            "status": "VERIFIED",
            "Notes": "1lPhp1pKBvNg5oLu4OwQ_5YOQsENtycfU"
          },
          {
            "id": "96b031ec-3d0e-4b9e-9dbd-b0fee7e38030",
            "name": "SQL and PL/SQL Slides",
            "mimeType": "application/pdf",
            "isDownloadable": false,
            "status": "VERIFIED",
            "Notes": "1d0xiz6DFbXo-_dNtuiSFoRVOKXIc7_gq"
          }
        ]
      },
      {
        "id": "65d2d560883f3cc806388704",
        "name": "Mobile Computing",
        "SUBCODE": null,
        "Credit": null,
        "folderId": "1ZjCacSY5rPV65uI0bs61VwqOKeKjfXcj",
        "notes": [
          {
            "id": "536cb451-0bc2-4e0e-8f72-fe07dd2cb12b",
            "name": "Mobile Computing Slides",
            "mimeType": "application/pdf",
            "isDownloadable": false,
            "status": "VERIFIED",
            "Notes": "1_rfffbrniyRD2enKG_uUC2TeHjoIqYsJ"
          }
        ]
      },
      {
        "id": "65d2d560883f3cc80638870c",
        "name": "Cryptography",
        "SUBCODE": null,
        "Credit": null,
        "folderId": "1BNytYhnQL7tzP3GsW4PGbL-nIaLGs8To",
        "notes": [
          {
            "id": "636b9348-5a11-4559-818a-f53fcd091036",
            "name": "Cryptography Slides",
            "mimeType": "application/pdf",
            "isDownloadable": false,
            "status": "VERIFIED",
            "Notes": "1sC-9di4OWRYyK5mOugczbviO9Cr3m4eY"
          }
        ]
      },
      {
        "id": "65d2d560883f3cc80638870a",
        "name": "Computational Intelligence",
        "SUBCODE": null,
        "Credit": null,
        "folderId": "1Rxofy0k6CWIMtI66E9bca_IhIWURwsGd",
        "notes": [
          {
            "id": "1e6f5cfd-14ff-42cb-a54b-e0fd0859a60a",
            "name": "Computational Intelligence Notes",
            "mimeType": "application/pdf",
            "isDownloadable": false,
            "status": "VERIFIED",
            "Notes": "1wfjLi9JwDRVWMlCNUf2SidHwBTjTNyM3"
          }
        ]
      },
      {
        "id": "65d2d560883f3cc806388709",
        "name": "Artificial Intelligence",
        "SUBCODE": null,
        "Credit": null,
        "folderId": "1N4NfPNlHGIiNtuoMoI8BKhJjf8ftHzaA",
        "notes": [
          {
            "id": "c7f7c854-6f93-4912-95a4-9aea990eb6cf",
            "name": "Artificial Intelligence Notes",
            "mimeType": "application/pdf",
            "isDownloadable": false,
            "status": "VERIFIED",
            "Notes": "1eX9aXjDFbb72MXhjIImT1xw7SipWIOqf"
          },
          {
            "id": "63d42bd9-6281-4af0-8253-f9ed21a3432b",
            "name": "Artificial Intelligence Slides",
            "mimeType": "application/pdf",
            "isDownloadable": false,
            "status": "VERIFIED",
            "Notes": "1pO8wd16Rdb8SbucCNhx0Ow-mlTCTBMOJ"
          }
        ]
      },
      {
        "id": "65d2d560883f3cc80638870b",
        "name": "Big Data",
        "SUBCODE": null,
        "Credit": null,
        "folderId": "1lKozSt66GymMKwb_rBNYjq7BkvfZUalm",
        "notes": [
          {
            "id": "6c0c27ff-e399-400e-8605-ce644fec7597",
            "name": "Big Data Slides",
            "mimeType": "application/pdf",
            "isDownloadable": false,
            "status": "VERIFIED",
            "Notes": "1SRFphHNbmsr9cLEPQvQGlqqTidE0JJhq"
          }
        ]
      },
      {
        "id": "65d2d560883f3cc80638870f",
        "name": "Data Mining and Data Warehousing",
        "SUBCODE": null,
        "Credit": null,
        "folderId": "1nOYMihlN8Er2_13Xd0FQdmdwH889lCuu",
        "notes": [
          {
            "id": "b8f1133e-f24b-4b1e-b47c-40c8be271f67",
            "name": "Data Mining and Data Warehousing Notes",
            "mimeType": "application/pdf",
            "isDownloadable": false,
            "status": "VERIFIED",
            "Notes": "1uc9-41er0rchsJtzRpL-3pLiQqnYzXt_"
          }
        ]
      }
    ]
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
          if ( note.status === "VERIFIED") {
            console.log("Approved pyq found: ", note.name);
            // Transfer the file
            await this.transferFile(note.Notes, `${subjectSlug}/notes/${note.Notes}.pdf`);
          } else if (note.status === "APPROVED") {
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


  async securityViolated(data:{
    userId:string
  }){
    try {
    
      const user = await this.prisma.securityViolated.create({
        data:{
          userId:data.userId
        }
      })
      return {
        success:true,
      }
    } catch (error) {
      console.error("Error transferring files: ", error);
      throw new InternalServerErrorException("Error saving security violated data");
    }
  }

  async getSecurityViolated(){
    try {
      const user = await this.prisma.securityViolated.findMany({
        orderBy:{
          createdAt:"desc"
        },
        include:{
          user:{
            select:{
              name:true,
              email:true,
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

  async getMonthlyPlan(){
    try {
      const user = await this.prisma.user.findMany({
        where:{
          plan:"Monthly",
          expiryDate:{
            lte:new Date()
          }
        },

        select:{
          id:true,
          name:true,
          email:true,
          plan:true,
          expiryDate:true,
        },
        orderBy:{
          createdAt:"desc"
        },
      
      })
      return {
        length:user.length,
        data:user
      }

    } catch (error) {
      console.error("Error fetching  monthly plan data: ", error);
      throw new InternalServerErrorException("Error getting monthly plan data");
    }
  }


  


  async expireMonthlyUsers(){
    try {
      const users = await this.prisma.user.findMany({
        where:{
          plan:"Monthly",
          expiryDate:{
            lte:new Date()
          },
          isPremium:true
        },
      });

      for (const user of users) {
        await this.prisma.premiumMember.delete({
          where:{
            userId:user.id
          },
        });

        await this.prisma.user.update({
          where:{
            id:user.id
          },
          data:{
            isPremium:false,
          plan:null,
            expiryDate:null
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

  async expireMonthlyUsersByHard(){
    try {
      const users =[
        {
            "id": "67cdfa8b8db82be398f21fed",
            "name": "PRATIK KUMAR SAH",
            "email": "24052521@kiit.ac.in",
            "plan": "Monthly",
            "expiryDate": "2025-04-10T12:50:56.185Z"
        },
        {
            "id": "67c6a16f55b9f267bcab9fe0",
            "name": "ANURAG PATEL",
            "email": "23053670@kiit.ac.in",
            "plan": "Monthly",
            "expiryDate": "2025-04-04T05:59:32.821Z"
        },
        {
            "id": "67c5e28655b9f267bcab9fcf",
            "name": "488_PRATYUSH SHRIVASTAVA",
            "email": "2205488@kiit.ac.in",
            "plan": "Monthly",
            "expiryDate": "2025-04-02T17:27:31.910Z"
        },
        {
            "id": "67c5e1b655b9f267bcab9fce",
            "name": "7063_SACHIN SUVIJAY",
            "email": "24057063@kiit.ac.in",
            "plan": "Monthly",
            "expiryDate": "2025-04-02T17:12:54.307Z"
        },
        {
            "id": "67c4c99255b9f267bcab9fb4",
            "name": "MEDHANSH VIBHU",
            "email": "23052812@kiit.ac.in",
            "plan": "Monthly",
            "expiryDate": "2025-04-01T21:13:16.693Z"
        },
        {
            "id": "67c3d559d3e72b4dfd56fa95",
            "name": "Anita Devi",
            "email": "anitadevidas625@gmail.com",
            "plan": "Monthly",
            "expiryDate": "2025-04-01T04:46:04.804Z"
        },
        {
            "id": "67c37ef3d3e72b4dfd56fa91",
            "name": "3860_DISHA KARMAKAR",
            "email": "22053860@kiit.ac.in",
            "plan": "Monthly",
            "expiryDate": "2025-04-02T15:58:58.163Z"
        },
        {
            "id": "672e14a15a965de869c43474",
            "name": "389_Shashwat Sharma",
            "email": "2306389@kiit.ac.in",
            "plan": "Monthly",
            "expiryDate": "2025-04-01T09:20:44.903Z"
        },
        {
            "id": "66c1c5c442841c454a166df9",
            "name": "PRIYANSHU DAS",
            "email": "2305231@kiit.ac.in",
            "plan": "Monthly",
            "expiryDate": "2025-04-02T13:01:35.053Z"
        },
        {
            "id": "669530bf42841c454a166bc5",
            "name": "NAITIK ANAND",
            "email": "23052335@kiit.ac.in",
            "plan": "Monthly",
            "expiryDate": "2025-04-01T12:20:16.056Z"
        },
        {
            "id": "6694b63a42841c454a166a0f",
            "name": "ANKIT SHAH",
            "email": "23053658@kiit.ac.in",
            "plan": "Monthly",
            "expiryDate": "2025-04-06T05:28:54.188Z"
        },
        {
            "id": "668e97a197969283509b089a",
            "name": "5640_Glena SAHA",
            "email": "2205640@kiit.ac.in",
            "plan": "Monthly",
            "expiryDate": "2025-04-01T07:52:15.073Z"
        },
        {
            "id": "66823aa9b73d79e426242b91",
            "name": "GAURAV KUNJILWAR",
            "email": "22052207@kiit.ac.in",
            "plan": "Monthly",
            "expiryDate": "2025-04-02T07:54:02.633Z"
        },
        {
            "id": "667eac433c448e32cdf1a368",
            "name": "Tusher Tarafder",
            "email": "22054096@kiit.ac.in",
            "plan": "Monthly",
            "expiryDate": "2025-04-02T20:13:57.994Z"
        },
        {
            "id": "664ef052d14af87f4424ffd0",
            "name": "115_Ashish Gulati",
            "email": "2205115@kiit.ac.in",
            "plan": "Monthly",
            "expiryDate": "2025-04-01T05:41:02.491Z"
        },
        {
            "id": "664055081cc9557b148663f1",
            "name": "PRASHAMSA BUDHATHOKI_3864",
            "email": "23053864@kiit.ac.in",
            "plan": "Monthly",
            "expiryDate": "2025-04-03T06:51:58.206Z"
        },
        {
            "id": "6615803ef3924a11a97cb303",
            "name": "ANIKET SINGH",
            "email": "2205876@kiit.ac.in",
            "plan": "Monthly",
            "expiryDate": "2025-04-13T04:53:55.258Z"
        },
        {
            "id": "6602e2a4ece362a62c15d4e4",
            "name": "PRAJWAL PANTH",
            "email": "22054402@kiit.ac.in",
            "plan": "Monthly",
            "expiryDate": "2025-04-05T06:22:42.502Z"
        },
        {
            "id": "65da2e7c0fb947f5b2548010",
            "name": "ANURAG MODAK",
            "email": "22053143@kiit.ac.in",
            "plan": "Monthly",
            "expiryDate": "2025-04-06T10:29:51.262Z"
        }
    ]

      for (const user of users) {
        await this.prisma.premiumMember.delete({
          where:{
            userId:user.id
          },
        });

        await this.prisma.user.update({
          where:{
            id:user.id
          },
          data:{
            isPremium:false,
          plan:null,
            expiryDate:null
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

}
