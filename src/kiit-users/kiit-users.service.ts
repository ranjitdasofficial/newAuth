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




    const users24 = [

      "24051737@kiit.ac.in",
      "24051738@kiit.ac.in",
      "24051739@kiit.ac.in",
      "24051740@kiit.ac.in",
      "24051741@kiit.ac.in",
      "24051742@kiit.ac.in",
      "24051743@kiit.ac.in",
      "24051744@kiit.ac.in",
      "24051745@kiit.ac.in",
      "24051746@kiit.ac.in",
      "24051747@kiit.ac.in",
      "24051748@kiit.ac.in",
      "24051749@kiit.ac.in",
      "24052399@kiit.ac.in",
      "24052400@kiit.ac.in",
      "24052401@kiit.ac.in",
      "24051750@kiit.ac.in",
      "24051751@kiit.ac.in",
      "24051752@kiit.ac.in",
      "24051753@kiit.ac.in",
      "24051754@kiit.ac.in",
      "24051755@kiit.ac.in",
      "24051756@kiit.ac.in",
      "24051757@kiit.ac.in",
      "24051758@kiit.ac.in",
      "24051759@kiit.ac.in",
      "24051760@kiit.ac.in",
      "24051761@kiit.ac.in",
      "24051762@kiit.ac.in",
      "24051763@kiit.ac.in",
      "24051764@kiit.ac.in",
      "24051765@kiit.ac.in",
      "24051766@kiit.ac.in",
      "24051767@kiit.ac.in",
      "24051768@kiit.ac.in",
      "24051769@kiit.ac.in",
      "24051770@kiit.ac.in",
      "24051771@kiit.ac.in",
      "24051772@kiit.ac.in",
      "24051773@kiit.ac.in",
      "24051774@kiit.ac.in",
      "24051775@kiit.ac.in",
      "24051776@kiit.ac.in",
      "24051777@kiit.ac.in",
      "24051778@kiit.ac.in",
      "24051779@kiit.ac.in",
      "24051780@kiit.ac.in",
      "24051781@kiit.ac.in",
      "24051782@kiit.ac.in",
      "24051783@kiit.ac.in",
      "24051784@kiit.ac.in",
      "24051786@kiit.ac.in",
      "24051787@kiit.ac.in",
      "24051788@kiit.ac.in",
      "24051789@kiit.ac.in",
      "24051790@kiit.ac.in",
      "24051791@kiit.ac.in",
      "24051792@kiit.ac.in",
      "24051793@kiit.ac.in",
      "24051794@kiit.ac.in",
      "24051795@kiit.ac.in",
      "24051796@kiit.ac.in",
      "24051797@kiit.ac.in",
      "24051798@kiit.ac.in",
      "24051799@kiit.ac.in",
      "24051800@kiit.ac.in",
      "24051801@kiit.ac.in",
      "24051802@kiit.ac.in",
      "24051803@kiit.ac.in",
      "24051804@kiit.ac.in",
      "24051805@kiit.ac.in",
      "24051806@kiit.ac.in",
      "24051807@kiit.ac.in",
      "24051808@kiit.ac.in",
      "24051809@kiit.ac.in",
      "24051810@kiit.ac.in",
      "24051811@kiit.ac.in",
      "24051812@kiit.ac.in",
      "24051813@kiit.ac.in",
      "24051814@kiit.ac.in",
      "24051815@kiit.ac.in",
      "24051816@kiit.ac.in",
      "24051817@kiit.ac.in",
      "24051818@kiit.ac.in",
      "24051819@kiit.ac.in",
      "24051821@kiit.ac.in",
      "24051822@kiit.ac.in",
      "24051823@kiit.ac.in",
      "24051824@kiit.ac.in",
      "24052458@kiit.ac.in",
      "24052459@kiit.ac.in",
      "24052461@kiit.ac.in",
      "24052462@kiit.ac.in",
      "24051825@kiit.ac.in",
      "24051826@kiit.ac.in",
      "24051827@kiit.ac.in",
      "24051828@kiit.ac.in",
      "24051829@kiit.ac.in",
      "24051830@kiit.ac.in",
      "24051831@kiit.ac.in",
      "24051832@kiit.ac.in",
      "24051833@kiit.ac.in",
      "24051834@kiit.ac.in",
      "24051835@kiit.ac.in",
      "24051836@kiit.ac.in",
      "24051837@kiit.ac.in",
      "24051838@kiit.ac.in",
      "24051839@kiit.ac.in",
      "24051840@kiit.ac.in",
      "24051841@kiit.ac.in",
      "24051842@kiit.ac.in",
      "24051843@kiit.ac.in",
      "24051844@kiit.ac.in",
      "24051845@kiit.ac.in",
      "24051846@kiit.ac.in",
      "24051847@kiit.ac.in",
      "24051848@kiit.ac.in",
      "24051849@kiit.ac.in",
      "24051850@kiit.ac.in",
      "24051851@kiit.ac.in",
      "24051852@kiit.ac.in",
      "24051853@kiit.ac.in",
      "24051854@kiit.ac.in",
      "24051855@kiit.ac.in",
      "24051856@kiit.ac.in",
      "24051857@kiit.ac.in",
      "24051858@kiit.ac.in",
      "24051859@kiit.ac.in",
      "24051860@kiit.ac.in",
      "24051861@kiit.ac.in",
      "24051862@kiit.ac.in",
      "24051863@kiit.ac.in",
      "24051864@kiit.ac.in",
      "24051865@kiit.ac.in",
      "24051866@kiit.ac.in",
      "24051867@kiit.ac.in",
      "24051868@kiit.ac.in",
      "24051869@kiit.ac.in",
      "24051870@kiit.ac.in",
      "24051871@kiit.ac.in",
      "24051872@kiit.ac.in",
      "24051873@kiit.ac.in",
      "24051874@kiit.ac.in",
      "24051875@kiit.ac.in",
      "24051876@kiit.ac.in",
      "24051877@kiit.ac.in",
      "24051878@kiit.ac.in",
      "24051879@kiit.ac.in",
      "24051880@kiit.ac.in",
      "24051881@kiit.ac.in",
      "24051882@kiit.ac.in",
      "24051883@kiit.ac.in",
      "24051884@kiit.ac.in",
      "24051885@kiit.ac.in",
      "24051886@kiit.ac.in",
      "24051887@kiit.ac.in",
      "24051888@kiit.ac.in",
      "24051889@kiit.ac.in",
      "24051890@kiit.ac.in",
      "24051891@kiit.ac.in",
      "24051893@kiit.ac.in",
      "24051894@kiit.ac.in",
      "24051895@kiit.ac.in",
      "24051896@kiit.ac.in",
      "24051897@kiit.ac.in",
      "24051899@kiit.ac.in",
      "24052448@kiit.ac.in",
      "24052449@kiit.ac.in",
      "24051900@kiit.ac.in",
      "24051901@kiit.ac.in",
      "24051902@kiit.ac.in",
      "24051903@kiit.ac.in",
      "24051904@kiit.ac.in",
      "24051905@kiit.ac.in",
      "24051906@kiit.ac.in",
      "24051907@kiit.ac.in",
      "24051908@kiit.ac.in",
      "24051909@kiit.ac.in",
      "24051910@kiit.ac.in",
      "24051911@kiit.ac.in",
      "24051912@kiit.ac.in",
      "24051913@kiit.ac.in",
      "24051914@kiit.ac.in",
      "24051915@kiit.ac.in",
      "24051916@kiit.ac.in",
      "24051917@kiit.ac.in",
      "24051918@kiit.ac.in",
      "24051919@kiit.ac.in",
      "24051920@kiit.ac.in",
      "24051921@kiit.ac.in",
      "24051922@kiit.ac.in",
      "24051923@kiit.ac.in",
      "24051924@kiit.ac.in",
      "24051925@kiit.ac.in",
      "24051926@kiit.ac.in",
      "24051927@kiit.ac.in",
      "24051928@kiit.ac.in",
      "24051929@kiit.ac.in",
      "24051930@kiit.ac.in",
      "24051931@kiit.ac.in",
      "24051932@kiit.ac.in",
      "24051933@kiit.ac.in",
      "24051934@kiit.ac.in",
      "24051935@kiit.ac.in",
      "24051936@kiit.ac.in",
      "24051937@kiit.ac.in",
      "24051938@kiit.ac.in",
      "24051939@kiit.ac.in",
      "24051940@kiit.ac.in",
      "24051941@kiit.ac.in",
      "24051942@kiit.ac.in",
      "24051943@kiit.ac.in",
      "24051944@kiit.ac.in",
      "24051945@kiit.ac.in",
      "24051946@kiit.ac.in",
      "24051947@kiit.ac.in",
      "24051948@kiit.ac.in",
      "24051949@kiit.ac.in",
      "24051950@kiit.ac.in",
      "24051951@kiit.ac.in",
      "24051952@kiit.ac.in",
      "24051953@kiit.ac.in",
      "24051954@kiit.ac.in",
      "24051955@kiit.ac.in",
      "24051956@kiit.ac.in",
      "24051957@kiit.ac.in",
      "24051958@kiit.ac.in",
      "24051959@kiit.ac.in",
      "24051960@kiit.ac.in",
      "24051961@kiit.ac.in",
      "24051962@kiit.ac.in",
      "24051963@kiit.ac.in",
      "24051964@kiit.ac.in",
      "24051965@kiit.ac.in",
      "24051966@kiit.ac.in",
      "24051967@kiit.ac.in",
      "24051968@kiit.ac.in",
      "24051969@kiit.ac.in",
      "24051970@kiit.ac.in",
      "24051971@kiit.ac.in",
      "24051972@kiit.ac.in",
      "24051973@kiit.ac.in",
      "24051974@kiit.ac.in",
      "24052451@kiit.ac.in",
      "24051975@kiit.ac.in",
      "24051976@kiit.ac.in",
      "24051977@kiit.ac.in",
      "24051978@kiit.ac.in",
      "24051979@kiit.ac.in",
      "24051980@kiit.ac.in",
      "24051981@kiit.ac.in",
      "24051982@kiit.ac.in",
      "24051983@kiit.ac.in",
      "24051984@kiit.ac.in",
      "24051985@kiit.ac.in",
      "24051986@kiit.ac.in",
      "24051987@kiit.ac.in",
      "24051988@kiit.ac.in",
      "24051989@kiit.ac.in",
      "24051990@kiit.ac.in",
      "24051991@kiit.ac.in",
      "24051992@kiit.ac.in",
      "24051993@kiit.ac.in",
      "24051994@kiit.ac.in",
      "24051995@kiit.ac.in",
      "24051996@kiit.ac.in",
      "24051997@kiit.ac.in",
      "24051998@kiit.ac.in",
      "24051999@kiit.ac.in",
      "24052000@kiit.ac.in",
      "24052002@kiit.ac.in",
      "24052003@kiit.ac.in",
      "24052004@kiit.ac.in",
      "24052005@kiit.ac.in",
      "24052006@kiit.ac.in",
      "24052007@kiit.ac.in",
      "24052008@kiit.ac.in",
      "24052009@kiit.ac.in",
      "24052010@kiit.ac.in",
      "24052011@kiit.ac.in",
      "24052012@kiit.ac.in",
      "24052013@kiit.ac.in",
      "24052014@kiit.ac.in",
      "24052015@kiit.ac.in",
      "24052016@kiit.ac.in",
      "24052017@kiit.ac.in",
      "24052018@kiit.ac.in",
      "24052019@kiit.ac.in",
      "24052020@kiit.ac.in",
      "24052021@kiit.ac.in",
      "24052022@kiit.ac.in",
      "24052023@kiit.ac.in",
      "24052024@kiit.ac.in",
      "24052025@kiit.ac.in",
      "24052026@kiit.ac.in",
      "24052027@kiit.ac.in",
      "24052028@kiit.ac.in",
      "24052029@kiit.ac.in",
      "24052030@kiit.ac.in",
      "24052031@kiit.ac.in",
      "24052032@kiit.ac.in",
      "24052033@kiit.ac.in",
      "24052034@kiit.ac.in",
      "24052035@kiit.ac.in",
      "24052036@kiit.ac.in",
      "24052037@kiit.ac.in",
      "24052038@kiit.ac.in",
      "24052039@kiit.ac.in",
      "24052040@kiit.ac.in",
      "24052041@kiit.ac.in",
      "24052042@kiit.ac.in",
      "24052043@kiit.ac.in",
      "24052044@kiit.ac.in",
      "24052045@kiit.ac.in",
      "24052046@kiit.ac.in",
      "24052047@kiit.ac.in",
      "24052048@kiit.ac.in",
      "24052049@kiit.ac.in",
      "24052050@kiit.ac.in",
      "24052051@kiit.ac.in",
      "24052052@kiit.ac.in",
      "24052053@kiit.ac.in",
      "24052054@kiit.ac.in",
      "24052055@kiit.ac.in",
      "24052056@kiit.ac.in",
      "24052057@kiit.ac.in",
      "24052058@kiit.ac.in",
      "24052059@kiit.ac.in",
      "24052060@kiit.ac.in",
      "24052061@kiit.ac.in",
      "24052062@kiit.ac.in",
      "24052063@kiit.ac.in",
      "24052064@kiit.ac.in",
      "24052065@kiit.ac.in",
      "24052066@kiit.ac.in",
      "24052067@kiit.ac.in",
      "24052068@kiit.ac.in",
      "24052069@kiit.ac.in",
      "24052070@kiit.ac.in",
      "24052071@kiit.ac.in",
      "24052072@kiit.ac.in",
      "24052073@kiit.ac.in",
      "24052074@kiit.ac.in",
      "24052075@kiit.ac.in",
      "24052076@kiit.ac.in",
      "24052077@kiit.ac.in",
      "24052078@kiit.ac.in",
      "24052079@kiit.ac.in",
      "24052080@kiit.ac.in",
      "24052081@kiit.ac.in",
      "24052082@kiit.ac.in",
      "24052083@kiit.ac.in",
      "24052084@kiit.ac.in",
      "24052085@kiit.ac.in",
      "24052086@kiit.ac.in",
      "24052087@kiit.ac.in",
      "24052088@kiit.ac.in",
      "24052089@kiit.ac.in",
      "24052090@kiit.ac.in",
      "24052091@kiit.ac.in",
      "24052092@kiit.ac.in",
      "24052093@kiit.ac.in",
      "24052094@kiit.ac.in",
      "24052095@kiit.ac.in",
      "24052096@kiit.ac.in",
      "24052097@kiit.ac.in",
      "24052098@kiit.ac.in",
      "24052099@kiit.ac.in",
      "24052100@kiit.ac.in",
      "24052101@kiit.ac.in",
      "24052102@kiit.ac.in",
      "24052103@kiit.ac.in",
      "24052104@kiit.ac.in",
      "24052105@kiit.ac.in",
      "24052106@kiit.ac.in",
      "24052107@kiit.ac.in",
      "24052108@kiit.ac.in",
      "24052109@kiit.ac.in",
      "24052110@kiit.ac.in",
      "24052111@kiit.ac.in",
      "24052112@kiit.ac.in",
      "24052113@kiit.ac.in",
      "24052114@kiit.ac.in",
      "24052115@kiit.ac.in",
      "24052116@kiit.ac.in",
      "24052117@kiit.ac.in",
      "24052118@kiit.ac.in",
      "24052119@kiit.ac.in",
      "24052120@kiit.ac.in",
      "24052121@kiit.ac.in",
      "24052122@kiit.ac.in",
      "24052123@kiit.ac.in",
      "24052124@kiit.ac.in",
      "24052415@kiit.ac.in",
      "24052125@kiit.ac.in",
      "24052126@kiit.ac.in",
      "24052127@kiit.ac.in",
      "24052128@kiit.ac.in",
      "24052129@kiit.ac.in",
      "24052130@kiit.ac.in",
      "24052131@kiit.ac.in",
      "24052132@kiit.ac.in",
      "24052133@kiit.ac.in",
      "24052134@kiit.ac.in",
      "24052135@kiit.ac.in",
      "24052136@kiit.ac.in",
      "24052137@kiit.ac.in",
      "24052138@kiit.ac.in",
      "24052139@kiit.ac.in",
      "24052140@kiit.ac.in",
      "24052141@kiit.ac.in",
      "24052142@kiit.ac.in",
      "24052143@kiit.ac.in",
      "24052144@kiit.ac.in",
      "24052145@kiit.ac.in",
      "24052146@kiit.ac.in",
      "24052147@kiit.ac.in",
      "24052148@kiit.ac.in",
      "24052149@kiit.ac.in",
      "24052150@kiit.ac.in",
      "24052151@kiit.ac.in",
      "24052152@kiit.ac.in",
      "24052153@kiit.ac.in",
      "24052154@kiit.ac.in",
      "24052155@kiit.ac.in",
      "24052156@kiit.ac.in",
      "24052157@kiit.ac.in",
      "24052158@kiit.ac.in",
      "24052159@kiit.ac.in",
      "24052160@kiit.ac.in",
      "24052161@kiit.ac.in",
      "24052162@kiit.ac.in",
      "24052163@kiit.ac.in",
      "24052164@kiit.ac.in",
      "24052165@kiit.ac.in",
      "24052166@kiit.ac.in",
      "24052167@kiit.ac.in",
      "24052168@kiit.ac.in",
      "24052169@kiit.ac.in",
      "24052170@kiit.ac.in",
      "24052171@kiit.ac.in",
      "24052172@kiit.ac.in",
      "24052173@kiit.ac.in",
      "24052174@kiit.ac.in",
      "24052175@kiit.ac.in",
      "24052176@kiit.ac.in",
      "24052177@kiit.ac.in",
      "24052178@kiit.ac.in",
      "24052179@kiit.ac.in",
      "24052180@kiit.ac.in",
      "24052181@kiit.ac.in",
      "24052182@kiit.ac.in",
      "24052183@kiit.ac.in",
      "24052184@kiit.ac.in",
      "24052185@kiit.ac.in",
      "24052186@kiit.ac.in",
      "24052187@kiit.ac.in",
      "24052188@kiit.ac.in",
      "24052191@kiit.ac.in",
      "24052192@kiit.ac.in",
      "24052193@kiit.ac.in",
      "24052194@kiit.ac.in",
      "24052195@kiit.ac.in",
      "24052196@kiit.ac.in",
      "24052197@kiit.ac.in",
      "24052198@kiit.ac.in",
      "24052199@kiit.ac.in",
      "24052413@kiit.ac.in",
      "24052414@kiit.ac.in",
      "24052445@kiit.ac.in",
      "24052446@kiit.ac.in",
      "24052447@kiit.ac.in",
      "24052450@kiit.ac.in",
      "24052200@kiit.ac.in",
      "24052201@kiit.ac.in",
      "24052202@kiit.ac.in",
      "24052203@kiit.ac.in",
      "24052204@kiit.ac.in",
      "24052205@kiit.ac.in",
      "24052206@kiit.ac.in",
      "24052207@kiit.ac.in",
      "24052208@kiit.ac.in",
      "24052209@kiit.ac.in",
      "24052210@kiit.ac.in",
      "24052211@kiit.ac.in",
      "24052212@kiit.ac.in",
      "24052213@kiit.ac.in",
      "24052214@kiit.ac.in",
      "24052215@kiit.ac.in",
      "24052216@kiit.ac.in",
      "24052217@kiit.ac.in",
      "24052218@kiit.ac.in",
      "24052219@kiit.ac.in",
      "24052220@kiit.ac.in",
      "24052221@kiit.ac.in",
      "24052222@kiit.ac.in",
      "24052223@kiit.ac.in",
      "24052224@kiit.ac.in",
      "24052225@kiit.ac.in",
      "24052226@kiit.ac.in",
      "24052227@kiit.ac.in",
      "24052228@kiit.ac.in",
      "24052229@kiit.ac.in",
      "24052230@kiit.ac.in",
      "24052231@kiit.ac.in",
      "24052232@kiit.ac.in",
      "24052233@kiit.ac.in",
      "24052234@kiit.ac.in",
      "24052235@kiit.ac.in",
      "24052236@kiit.ac.in",
      "24052237@kiit.ac.in",
      "24052238@kiit.ac.in",
      "24052239@kiit.ac.in",
      "24052240@kiit.ac.in",
      "24052241@kiit.ac.in",
      "24052242@kiit.ac.in",
      "24052243@kiit.ac.in",
      "24052244@kiit.ac.in",
      "24052245@kiit.ac.in",
      "24052246@kiit.ac.in",
      "24052247@kiit.ac.in",
      "24052248@kiit.ac.in",
      "24052249@kiit.ac.in",
      "24052250@kiit.ac.in",
      "24052251@kiit.ac.in",
      "24052252@kiit.ac.in",
      "24052253@kiit.ac.in",
      "24052254@kiit.ac.in",
      "24052255@kiit.ac.in",
      "24052256@kiit.ac.in",
      "24052257@kiit.ac.in",
      "24052258@kiit.ac.in",
      "24052259@kiit.ac.in",
      "24052260@kiit.ac.in",
      "24052261@kiit.ac.in",
      "24052262@kiit.ac.in",
      "24052263@kiit.ac.in",
      "24052264@kiit.ac.in",
      "24052265@kiit.ac.in",
      "24052266@kiit.ac.in",
      "24052267@kiit.ac.in",
      "24052268@kiit.ac.in",
      "24052269@kiit.ac.in",
      "24052270@kiit.ac.in",
      "24052271@kiit.ac.in",
      "24052272@kiit.ac.in",
      "24052273@kiit.ac.in",
      "24052274@kiit.ac.in",
      "24052347@kiit.ac.in",
      "24052352@kiit.ac.in",
      "24052275@kiit.ac.in",
      "24052276@kiit.ac.in",
      "24052277@kiit.ac.in",
      "24052278@kiit.ac.in",
      "24052279@kiit.ac.in",
      "24052280@kiit.ac.in",
      "24052281@kiit.ac.in",
      "24052282@kiit.ac.in",
      "24052283@kiit.ac.in",
      "24052284@kiit.ac.in",
      "24052285@kiit.ac.in",
      "24052286@kiit.ac.in",
      "24052287@kiit.ac.in",
      "24052288@kiit.ac.in",
      "24052289@kiit.ac.in",
      "24052290@kiit.ac.in",
      "24052291@kiit.ac.in",
      "24052292@kiit.ac.in",
      "24052293@kiit.ac.in",
      "24052294@kiit.ac.in",
      "24052295@kiit.ac.in",
      "24052296@kiit.ac.in",
      "24052297@kiit.ac.in",
      "24052298@kiit.ac.in",
      "24052299@kiit.ac.in",
      "24052300@kiit.ac.in",
      "24052301@kiit.ac.in",
      "24052302@kiit.ac.in",
      "24052303@kiit.ac.in",
      "24052304@kiit.ac.in",
      "24052305@kiit.ac.in",
      "24052306@kiit.ac.in",
      "24052307@kiit.ac.in",
      "24052308@kiit.ac.in",
      "24052309@kiit.ac.in",
      "24052310@kiit.ac.in",
      "24052311@kiit.ac.in",
      "24052312@kiit.ac.in",
      "24052313@kiit.ac.in",
      "24052314@kiit.ac.in",
      "24052315@kiit.ac.in",
      "24052316@kiit.ac.in",
      "24052317@kiit.ac.in",
      "24052318@kiit.ac.in",
      "24052319@kiit.ac.in",
      "24052320@kiit.ac.in",
      "24052321@kiit.ac.in",
      "24052322@kiit.ac.in",
      "24052323@kiit.ac.in",
      "24052324@kiit.ac.in",
      "24052325@kiit.ac.in",
      "24052326@kiit.ac.in",
      "24052327@kiit.ac.in",
      "24052328@kiit.ac.in",
      "24052329@kiit.ac.in",
      "24052330@kiit.ac.in",
      "24052331@kiit.ac.in",
      "24052332@kiit.ac.in",
      "24052333@kiit.ac.in",
      "24052334@kiit.ac.in",
      "24052335@kiit.ac.in",
      "24052336@kiit.ac.in",
      "24052337@kiit.ac.in",
      "24052338@kiit.ac.in",
      "24052339@kiit.ac.in",
      "24052340@kiit.ac.in",
      "24052341@kiit.ac.in",
      "24052342@kiit.ac.in",
      "24052343@kiit.ac.in",
      "24052344@kiit.ac.in",
      "24052345@kiit.ac.in",
      "24052346@kiit.ac.in",
      "24052348@kiit.ac.in",
      "24052349@kiit.ac.in",
      "24052350@kiit.ac.in",
      "24052351@kiit.ac.in",
      "24052439@kiit.ac.in",
      "24052440@kiit.ac.in",
      "24052441@kiit.ac.in",
      "24052442@kiit.ac.in"
    ]

    const users000 = [

      "23052216@kiit.ac.in",
      "23052220@kiit.ac.in",
      "23052222@kiit.ac.in",
      "23052227@kiit.ac.in",
      "23052231@kiit.ac.in",
      "23052263@kiit.ac.in",
      "23052265@kiit.ac.in",
      "23052287@kiit.ac.in",
      "23052292@kiit.ac.in",
      "23052303@kiit.ac.in",
      "23052305@kiit.ac.in",
      "2305232@kiit.ac.in",
      "23052334@kiit.ac.in",
      "23052336@kiit.ac.in",
      "23052358@kiit.ac.in",
      "23052371@kiit.ac.in",
      "23052386@kiit.ac.in",
      "23052403@kiit.ac.in",
      "23052423@kiit.ac.in",
      "23052428@kiit.ac.in",
      "23052460@kiit.ac.in",
      "23052464@kiit.ac.in",
      "23052477@kiit.ac.in",
      "23052480@kiit.ac.in",
      "23052482@kiit.ac.in",
      "23052491@kiit.ac.in",
      "23052493@kiit.ac.in",
      "23052496@kiit.ac.in",
      "23052497@kiit.ac.in",
      "23052500@kiit.ac.in",
      "23052502@kiit.ac.in",
      "23052534@kiit.ac.in",
      "23052546@kiit.ac.in",
      "23052553@kiit.ac.in",
      "23052556@kiit.ac.in",
      "23052560@kiit.ac.in",
      "23052562@kiit.ac.in",
      "23052563@kiit.ac.in",
      "23052565@kiit.ac.in",
      "2305258@kiit.ac.in",
      "23052603@kiit.ac.in",
      "23052611@kiit.ac.in",
      "23052616@kiit.ac.in",
      "23052623@kiit.ac.in",
      "23052636@kiit.ac.in",
      "23052655@kiit.ac.in",
      "23052659@kiit.ac.in",
      "23052669@kiit.ac.in",
      "23052671@kiit.ac.in",
      "23052684@kiit.ac.in",
      "23052694@kiit.ac.in",
      "23052695@kiit.ac.in",
      "23052696@kiit.ac.in",
      "23052698@kiit.ac.in",
      "23052699@kiit.ac.in",
      "23052722@kiit.ac.in",
      "23052725@kiit.ac.in",
      "23052729@kiit.ac.in",
      "23052738@kiit.ac.in",
      "23052753@kiit.ac.in",
      "23052757@kiit.ac.in",
      "2305276@kiit.ac.in",
      "23052762@kiit.ac.in",
      "2305279@kiit.ac.in",
      "23052809@kiit.ac.in",
      "23052811@kiit.ac.in",
      "23052819@kiit.ac.in",
      "23052823@kiit.ac.in",
      "2305286@kiit.ac.in",
      "2305287@kiit.ac.in",
      "23052888@kiit.ac.in",
      "23052891@kiit.ac.in",
      "23052941@kiit.ac.in",
      "23052965@kiit.ac.in",
      "23052981@kiit.ac.in",
      "23053018@kiit.ac.in",
      "23053020@kiit.ac.in",
      "2305303@kiit.ac.in",
      "23053030@kiit.ac.in",
      "23053036@kiit.ac.in",
      "23053043@kiit.ac.in",
      "23053044@kiit.ac.in",
      "23053050@kiit.ac.in",
      "23053060@kiit.ac.in",
      "23053067@kiit.ac.in",
      "23053082@kiit.ac.in",
      "23053100@kiit.ac.in",
      "23053102@kiit.ac.in",
      "23053114@kiit.ac.in",
      "23053115@kiit.ac.in",
      "23053120@kiit.ac.in",
      "23053123@kiit.ac.in",
      "23053134@kiit.ac.in",
      "23053136@kiit.ac.in",
      "23053165@kiit.ac.in",
      "23053171@kiit.ac.in",
      "2305318@kiit.ac.in",
      "23053211@kiit.ac.in",
      "23053224@kiit.ac.in",
      "23053234@kiit.ac.in",
      "23053243@kiit.ac.in",
      "23053255@kiit.ac.in",
      "23053268@kiit.ac.in",
      "23053269@kiit.ac.in",
      "23053298@kiit.ac.in",
      "2305335@kiit.ac.in",
      "23053360@kiit.ac.in",
      "23053375@kiit.ac.in",
      "23053390@kiit.ac.in",
      "23053450@kiit.ac.in",
      "2305346@kiit.ac.in",
      "23053460@kiit.ac.in",
      "23053509@kiit.ac.in",
      "23053511@kiit.ac.in",
      "23053523@kiit.ac.in",
      "23053531@kiit.ac.in",
      "23053534@kiit.ac.in",
      "23053541@kiit.ac.in",
      "2305367@kiit.ac.in",
      "23053682@kiit.ac.in",
      "23053686@kiit.ac.in",
      "23053702@kiit.ac.in",
      "23053729@kiit.ac.in",
      "2305375@kiit.ac.in",
      "2305386@kiit.ac.in",
      "2305390@kiit.ac.in",
      "2305393@kiit.ac.in",
      "2305397@kiit.ac.in",
      "2305441@kiit.ac.in",
      "2305450@kiit.ac.in",
      "2305512@kiit.ac.in",
      "2305523@kiit.ac.in",
      "2305531@kiit.ac.in",
      "2305537@kiit.ac.in",
      "2305538@kiit.ac.in",
      "2305542@kiit.ac.in",
      "2305549@kiit.ac.in",
      "2305563@kiit.ac.in",
      "2305581@kiit.ac.in",
      "2305583@kiit.ac.in",
      "2305587@kiit.ac.in",
      "2305592@kiit.ac.in",
      "2305598@kiit.ac.in",
      "2305606@kiit.ac.in",
      "2305607@kiit.ac.in",
      "2305613@kiit.ac.in",
      "2305634@kiit.ac.in",
      "2305638@kiit.ac.in",
      "2305646@kiit.ac.in",
      "2305671@kiit.ac.in",
      "2305676@kiit.ac.in",
      "2305683@kiit.ac.in",
      "2305730@kiit.ac.in",
      "2305752@kiit.ac.in",
      "2305755@kiit.ac.in",
      "2305761@kiit.ac.in",
      "2305764@kiit.ac.in",
      "2305782@kiit.ac.in",
      "2305786@kiit.ac.in",
      "2305789@kiit.ac.in",
      "2305796@kiit.ac.in",
      "2305800@kiit.ac.in",
      "2305830@kiit.ac.in",
      "2305845@kiit.ac.in",
      "2305854@kiit.ac.in",
      "2305862@kiit.ac.in",
      "2305871@kiit.ac.in",
      "2305876@kiit.ac.in",
      "2305892@kiit.ac.in",
      "2305916@kiit.ac.in",
      "2305950@kiit.ac.in",
      "2305986@kiit.ac.in",
      "2305989@kiit.ac.in",
      "2305005@kiit.ac.in",
      "2305017@kiit.ac.in",
      "2305025@kiit.ac.in",
      "2305040@kiit.ac.in",
      "2305043@kiit.ac.in",
      "2305051@kiit.ac.in",
      "2305053@kiit.ac.in",
      "2305077@kiit.ac.in",
      "2305091@kiit.ac.in",
      "2305099@kiit.ac.in",
      "23051026@kiit.ac.in",
      "23051080@kiit.ac.in",
      "23051097@kiit.ac.in",
      "23051103@kiit.ac.in",
      "23051124@kiit.ac.in",
      "23051125@kiit.ac.in",
      "23051154@kiit.ac.in",
      "23051179@kiit.ac.in",
      "23051204@kiit.ac.in",
      "23051206@kiit.ac.in",
      "23051256@kiit.ac.in",
      "23051282@kiit.ac.in",
      "2305130@kiit.ac.in",
      "23051319@kiit.ac.in",
      "23051339@kiit.ac.in",
      "23051350@kiit.ac.in",
      "23051364@kiit.ac.in",
      "23051385@kiit.ac.in",
      "23051402@kiit.ac.in",
      "23051410@kiit.ac.in",
      "23051458@kiit.ac.in",
      "2305147@kiit.ac.in",
      "23051474@kiit.ac.in",
      "23051486@kiit.ac.in",
      "23051488@kiit.ac.in",
      "2305150@kiit.ac.in",
      "23051503@kiit.ac.in",
      "23051509@kiit.ac.in",
      "23051530@kiit.ac.in",
      "23051541@kiit.ac.in",
      "23051548@kiit.ac.in",
      "23051560@kiit.ac.in",
      "23051588@kiit.ac.in",
      "23051597@kiit.ac.in",
      "23051610@kiit.ac.in",
      "23051639@kiit.ac.in",
      "23051652@kiit.ac.in",
      "23051658@kiit.ac.in",
      "23051677@kiit.ac.in",
      "2305169@kiit.ac.in",
      "23051704@kiit.ac.in",
      "23051717@kiit.ac.in",
      "23051747@kiit.ac.in",
      "23051770@kiit.ac.in",
      "23051781@kiit.ac.in",
      "23051783@kiit.ac.in",
      "23051811@kiit.ac.in",
      "23051819@kiit.ac.in",
      "23051823@kiit.ac.in",
      "23051824@kiit.ac.in",
      "23051893@kiit.ac.in",
      "2305191@kiit.ac.in",
      "23051912@kiit.ac.in",
      "23051928@kiit.ac.in",
      "23051964@kiit.ac.in",
      "23051971@kiit.ac.in",
      "23051983@kiit.ac.in",
      "23051995@kiit.ac.in",
      "23052002@kiit.ac.in",
      "23052004@kiit.ac.in",
      "2305201@kiit.ac.in",
      "23052030@kiit.ac.in",
      "23052035@kiit.ac.in",
      "23052068@kiit.ac.in",
      "23052073@kiit.ac.in",
      "23052089@kiit.ac.in",
      "23052118@kiit.ac.in",
      "23052123@kiit.ac.in",
      "23052126@kiit.ac.in",
      "23052128@kiit.ac.in",
      "23052141@kiit.ac.in",
      "23052207@kiit.ac.in",
      "2305222@kiit.ac.in",
      "23052221@kiit.ac.in",
      "23052239@kiit.ac.in",
      "23052240@kiit.ac.in",
      "23052278@kiit.ac.in",
      "23052302@kiit.ac.in",
      "23052312@kiit.ac.in",
      "23052318@kiit.ac.in",
      "23052322@kiit.ac.in",
      "23052333@kiit.ac.in",
      "23052357@kiit.ac.in",
      "23052368@kiit.ac.in",
      "23052380@kiit.ac.in",
      "23052407@kiit.ac.in",
      "23052408@kiit.ac.in",
      "2305249@kiit.ac.in",
      "23052507@kiit.ac.in",
      "2305257@kiit.ac.in",
      "23052579@kiit.ac.in",
      "23052580@kiit.ac.in",
      "23052617@kiit.ac.in",
      "23052626@kiit.ac.in",
      "23052633@kiit.ac.in",
      "23052656@kiit.ac.in",
      "23052682@kiit.ac.in",
      "23052705@kiit.ac.in",
      "23052734@kiit.ac.in",
      "2305274@kiit.ac.in",
      "23052751@kiit.ac.in",
      "23052758@kiit.ac.in",
      "23052773@kiit.ac.in",
      "2305280@kiit.ac.in",
      "23052814@kiit.ac.in",
      "23052845@kiit.ac.in",
      "23052850@kiit.ac.in",
      "23052861@kiit.ac.in",
      "23052879@kiit.ac.in",
      "23052900@kiit.ac.in",
      "23052915@kiit.ac.in",
      "23052930@kiit.ac.in",
      "23052933@kiit.ac.in",
      "2305296@kiit.ac.in",
      "23052967@kiit.ac.in",
      "23053012@kiit.ac.in",
      "23053015@kiit.ac.in",
      "23053019@kiit.ac.in",
      "23053027@kiit.ac.in",
      "23053031@kiit.ac.in",
      "23053037@kiit.ac.in",
      "23053052@kiit.ac.in",
      "23053057@kiit.ac.in",
      "23053063@kiit.ac.in",
      "23053093@kiit.ac.in",
      "23053112@kiit.ac.in",
      "23053119@kiit.ac.in",
      "2305315@kiit.ac.in",
      "23053153@kiit.ac.in",
      "23053155@kiit.ac.in",
      "23053194@kiit.ac.in",
      "23053200@kiit.ac.in",
      "23053231@kiit.ac.in",
      "23053258@kiit.ac.in",
      "23053262@kiit.ac.in",
      "23053266@kiit.ac.in",
      "23053273@kiit.ac.in",
      "23053275@kiit.ac.in",
      "23053300@kiit.ac.in",
      "23053307@kiit.ac.in",
      "23053313@kiit.ac.in",
      "23053324@kiit.ac.in",
      "23053338@kiit.ac.in",
      "23053340@kiit.ac.in",
      "23053350@kiit.ac.in",
      "23053371@kiit.ac.in",
      "23053377@kiit.ac.in",
      "23053381@kiit.ac.in",
      "23053387@kiit.ac.in",
      "23053391@kiit.ac.in",
      "23053442@kiit.ac.in",
      "23053446@kiit.ac.in",
      "2305345@kiit.ac.in",
      "23053452@kiit.ac.in",
      "23053453@kiit.ac.in",
      "23053458@kiit.ac.in",
      "23053519@kiit.ac.in",
      "23053526@kiit.ac.in",
      "23053536@kiit.ac.in",
      "23053566@kiit.ac.in",
      "23053568@kiit.ac.in",
      "23053570@kiit.ac.in",
      "23053622@kiit.ac.in",
      "23053623@kiit.ac.in",
      "23053625@kiit.ac.in",
      "2305384@kiit.ac.in",
      "2305402@kiit.ac.in",
      "2305438@kiit.ac.in",
      "2305451@kiit.ac.in",
      "2305470@kiit.ac.in",
      "2305478@kiit.ac.in",
      "2305481@kiit.ac.in",
      "2305486@kiit.ac.in",
      "2305525@kiit.ac.in",
      "2305551@kiit.ac.in",
      "2305552@kiit.ac.in",
      "2305557@kiit.ac.in",
      "2305585@kiit.ac.in",
      "2305620@kiit.ac.in",
      "2305622@kiit.ac.in",
      "2305668@kiit.ac.in",
      "2305716@kiit.ac.in",
      "2305731@kiit.ac.in",
      "2305753@kiit.ac.in",
      "2305763@kiit.ac.in",
      "2305783@kiit.ac.in",
      "2305790@kiit.ac.in",
      "2305808@kiit.ac.in",
      "2305817@kiit.ac.in",
      "2305864@kiit.ac.in",
      "2305877@kiit.ac.in",
      "2305882@kiit.ac.in",
      "2305885@kiit.ac.in",
      "2305897@kiit.ac.in",
      "2305905@kiit.ac.in",
      "2305933@kiit.ac.in",
      "2305952@kiit.ac.in",
      "2305958@kiit.ac.in",
      "2305960@kiit.ac.in",
      "2305981@kiit.ac.in",
      "23053252@kiit.ac.in",
      "23051595@kiit.ac.in",
      "2305891@kiit.ac.in",
      "23053130@kiit.ac.in",
      "23052679@kiit.ac.in",
      "2305491@kiit.ac.in",
      "23051381@kiit.ac.in",
      "23051139@kiit.ac.in",
      "23051373@kiit.ac.in",
      "23053316@kiit.ac.in",
      "23053085@kiit.ac.in",
      "2305256@kiit.ac.in",
      "23052267@kiit.ac.in",
      "23051380@kiit.ac.in",
      "23053365@kiit.ac.in",
      "2305566@kiit.ac.in",
      "2305975@kiit.ac.in",
      "23051382@kiit.ac.in",
      "2305992@kiit.ac.in",
      "2305887@kiit.ac.in",
      "23052360@kiit.ac.in",
      "23053158@kiit.ac.in",
      "23052228@kiit.ac.in",
      "23053124@kiit.ac.in",
      "2305448@kiit.ac.in",
      "23051247@kiit.ac.in",
      "23051001@kiit.ac.in",
      "23051074@kiit.ac.in",
      "23052542@kiit.ac.in",
      "23051018@kiit.ac.in",
      "23051978@kiit.ac.in",
      "23051816@kiit.ac.in",
      "2305049@kiit.ac.in",
      "23052453@kiit.ac.in",
      "23053193@kiit.ac.in",
      "23052532@kiit.ac.in",
      "23052130@kiit.ac.in",
      "23052478@kiit.ac.in",
      "23053196@kiit.ac.in",
      "2305106@kiit.ac.in",
      "2305515@kiit.ac.in",
      "23053183@kiit.ac.in",
      "23052451@kiit.ac.in",
      "23051239@kiit.ac.in",
      "23052782@kiit.ac.in",
      "2305996@kiit.ac.in",
      "23051013@kiit.ac.in",
      "2305675@kiit.ac.in",
      "23052080@kiit.ac.in",
      "2305014@kiit.ac.in",
      "2304164@kiit.ac.in",
      "23051126@kiit.ac.in",
      "23052660@kiit.ac.in",
      "23053522@kiit.ac.in",
      "23051418@kiit.ac.in",
      "2305422@kiit.ac.in",
      "23053356@kiit.ac.in",
      "23053621@kiit.ac.in",
      "23052642@kiit.ac.in",
      "23053627@kiit.ac.in",
      "23053665@kiit.ac.in",
      "23053684@kiit.ac.in",
      "23052935@kiit.ac.in",
      "23053706@kiit.ac.in",
      "23051518@kiit.ac.in",
      "2305008@kiit.ac.in",
      "23052154@kiit.ac.in",
      "23051160@kiit.ac.in",
      "23053203@kiit.ac.in",
      "23051493@kiit.ac.in",
      "23053107@kiit.ac.in",
      "23052558@kiit.ac.in",
      "23053198@kiit.ac.in",
      "23051664@kiit.ac.in",
      "2305529@kiit.ac.in",
      "23052552@kiit.ac.in",
      "23053229@kiit.ac.in",
      "23053142@kiit.ac.in",
      "23053128@kiit.ac.in",
      "2305935@kiit.ac.in",
      "23053294@kiit.ac.in",
      "23052145@kiit.ac.in",
      "23052876@kiit.ac.in",
      "23051483@kiit.ac.in",
      "23051592@kiit.ac.in",
      "23051696@kiit.ac.in",
      "2305310@kiit.ac.in",
      "23052206@kiit.ac.in",
      "23052131@kiit.ac.in",
      "2305198@kiit.ac.in",
      "2305177@kiit.ac.in",
      "2305987@kiit.ac.in",
      "23052973@kiit.ac.in",
      "23051072@kiit.ac.in",
      "23052055@kiit.ac.in",
      "23052309@kiit.ac.in",
      "23051008@kiit.ac.in",
      "2305365@kiit.ac.in",
      "23052640@kiit.ac.in",
      "23051897@kiit.ac.in",
      "23051249@kiit.ac.in",
      "2328073@kiit.ac.in",
      "2305847@kiit.ac.in",
      "23052166@kiit.ac.in",
      "23053106@kiit.ac.in",
      "23051056@kiit.ac.in",
      "23052837@kiit.ac.in",
      "23052095@kiit.ac.in",
      "2305455@kiit.ac.in",
      "2305392@kiit.ac.in",
      "23051281@kiit.ac.in",
      "23051423@kiit.ac.in",
      "2305624@kiit.ac.in",
      "23051029@kiit.ac.in",
      "2305719@kiit.ac.in",
      "23052161@kiit.ac.in",
      "23053292@kiit.ac.in",
      "23051183@kiit.ac.in",
      "2305558@kiit.ac.in",
      "23051520@kiit.ac.in",
      "23051515@kiit.ac.in",
      "2305645@kiit.ac.in",
      "23053064@kiit.ac.in",
      "2305657@kiit.ac.in",
      "23051534@kiit.ac.in",
      "23052337@kiit.ac.in",
      "23052170@kiit.ac.in",
      "2305457@kiit.ac.in",
      "23051359@kiit.ac.in",
      "2305140@kiit.ac.in",
      "23053053@kiit.ac.in",
      "23053287@kiit.ac.in",
      "23053438@kiit.ac.in",
      "23052590@kiit.ac.in",
      "23052414@kiit.ac.in",
      "23051850@kiit.ac.in",
      "2305792@kiit.ac.in",
      "23052741@kiit.ac.in",
      "23052521@kiit.ac.in",
      "23051199@kiit.ac.in",
      "2305640@kiit.ac.in",
      "2305029@kiit.ac.in",
      "2305036@kiit.ac.in",
      "2305039@kiit.ac.in",
      "2305054@kiit.ac.in",
      "2305067@kiit.ac.in",
      "23051123@kiit.ac.in",
      "2305115@kiit.ac.in",
      "23051162@kiit.ac.in",
      "23051175@kiit.ac.in",
      "2305119@kiit.ac.in",
      "23051235@kiit.ac.in",
      "23051241@kiit.ac.in",
      "23051243@kiit.ac.in",
      "23051270@kiit.ac.in",
      "23051344@kiit.ac.in",
      "23051433@kiit.ac.in",
      "23051446@kiit.ac.in",
      "23051451@kiit.ac.in",
      "23051495@kiit.ac.in",
      "23051499@kiit.ac.in",
      "23051585@kiit.ac.in",
      "23051596@kiit.ac.in",
      "23051614@kiit.ac.in",
      "23051661@kiit.ac.in",
      "23051662@kiit.ac.in",
      "23051681@kiit.ac.in",
      "23051692@kiit.ac.in",
      "23051729@kiit.ac.in",
      "23051734@kiit.ac.in",
      "23051744@kiit.ac.in",
      "23051763@kiit.ac.in",
      "23051825@kiit.ac.in",
      "23051837@kiit.ac.in",
      "23051838@kiit.ac.in",
      "23051854@kiit.ac.in",
      "23051895@kiit.ac.in",
      "23051903@kiit.ac.in",
      "23051972@kiit.ac.in",
      "23052006@kiit.ac.in",
      "23052051@kiit.ac.in",
      "23052071@kiit.ac.in",
      "23052078@kiit.ac.in",
      "23052140@kiit.ac.in",
      "23052180@kiit.ac.in",
      "2305223@kiit.ac.in",
      "2305224@kiit.ac.in",
      "2305226@kiit.ac.in",
      "23052359@kiit.ac.in",
      "23052375@kiit.ac.in",
      "23052389@kiit.ac.in",
      "23052454@kiit.ac.in",
      "23052455@kiit.ac.in",
      "23052476@kiit.ac.in",
      "23052479@kiit.ac.in",
      "23052540@kiit.ac.in",
      "23052566@kiit.ac.in",
      "23052575@kiit.ac.in",
      "23052587@kiit.ac.in",
      "23052613@kiit.ac.in",
      "23052621@kiit.ac.in",
      "23052631@kiit.ac.in",
      "23052644@kiit.ac.in",
      "2305267@kiit.ac.in",
      "23052714@kiit.ac.in",
      "23052721@kiit.ac.in",
      "23052744@kiit.ac.in",
      "23052806@kiit.ac.in",
      "2305283@kiit.ac.in",
      "23052859@kiit.ac.in",
      "23052862@kiit.ac.in",
      "23052871@kiit.ac.in",
      "23052880@kiit.ac.in",
      "23052955@kiit.ac.in",
      "23053032@kiit.ac.in",
      "23053034@kiit.ac.in",
      "23053062@kiit.ac.in",
      "2305313@kiit.ac.in",
      "23053143@kiit.ac.in",
      "23053149@kiit.ac.in",
      "2305317@kiit.ac.in",
      "23053204@kiit.ac.in",
      "23053264@kiit.ac.in",
      "23053528@kiit.ac.in",
      "23053529@kiit.ac.in",
      "23053539@kiit.ac.in",
      "23053567@kiit.ac.in",
      "23053664@kiit.ac.in",
      "23053689@kiit.ac.in",
      "2305370@kiit.ac.in",
      "23053708@kiit.ac.in",
      "23053709@kiit.ac.in",
      "23053760@kiit.ac.in",
      "23053794@kiit.ac.in",
      "2305429@kiit.ac.in",
      "2305475@kiit.ac.in",
      "2305479@kiit.ac.in",
      "2305518@kiit.ac.in",
      "2305546@kiit.ac.in",
      "2305621@kiit.ac.in",
      "2305642@kiit.ac.in",
      "2305662@kiit.ac.in",
      "2305695@kiit.ac.in",
      "2305720@kiit.ac.in",
      "2305749@kiit.ac.in",
      "2305774@kiit.ac.in",
      "2305895@kiit.ac.in",
      "2305912@kiit.ac.in",
      "2305938@kiit.ac.in",
      "2305946@kiit.ac.in",
      "2305998@kiit.ac.in",
      "2305022@kiit.ac.in",
      "2305027@kiit.ac.in",
      "2305055@kiit.ac.in",
      "2305069@kiit.ac.in",
      "2305074@kiit.ac.in",
      "2305080@kiit.ac.in",
      "2305089@kiit.ac.in",
      "23051058@kiit.ac.in",
      "23051068@kiit.ac.in",
      "23051095@kiit.ac.in",
      "23051113@kiit.ac.in",
      "23051157@kiit.ac.in",
      "2305122@kiit.ac.in",
      "2305127@kiit.ac.in",
      "23051332@kiit.ac.in",
      "23051334@kiit.ac.in",
      "23051345@kiit.ac.in",
      "23051360@kiit.ac.in",
      "23051421@kiit.ac.in",
      "23051468@kiit.ac.in",
      "2305151@kiit.ac.in",
      "23051523@kiit.ac.in",
      "23051613@kiit.ac.in",
      "23051623@kiit.ac.in",
      "23051666@kiit.ac.in",
      "23051679@kiit.ac.in",
      "23051720@kiit.ac.in",
      "23051759@kiit.ac.in",
      "23051803@kiit.ac.in",
      "23051809@kiit.ac.in",
      "23051848@kiit.ac.in",
      "23051874@kiit.ac.in",
      "23051880@kiit.ac.in",
      "23051882@kiit.ac.in",
      "23051888@kiit.ac.in",
      "23051906@kiit.ac.in",
      "23051908@kiit.ac.in",
      "23051915@kiit.ac.in",
      "23051921@kiit.ac.in",
      "23051938@kiit.ac.in",
      "23051956@kiit.ac.in",
      "23051998@kiit.ac.in",
      "23051999@kiit.ac.in",
      "23052020@kiit.ac.in",
      "23052031@kiit.ac.in",
      "23052076@kiit.ac.in",
      "2305213@kiit.ac.in",
      "2305227@kiit.ac.in",
      "23052279@kiit.ac.in",
      "23052281@kiit.ac.in",
      "23052323@kiit.ac.in",
      "23052325@kiit.ac.in",
      "23052335@kiit.ac.in",
      "23052343@kiit.ac.in",
      "2305236@kiit.ac.in",
      "23052376@kiit.ac.in",
      "23052381@kiit.ac.in",
      "23052388@kiit.ac.in",
      "23052429@kiit.ac.in",
      "23052449@kiit.ac.in",
      "23052461@kiit.ac.in",
      "23052465@kiit.ac.in",
      "23052490@kiit.ac.in",
      "23052492@kiit.ac.in",
      "23052494@kiit.ac.in",
      "23052516@kiit.ac.in",
      "23052541@kiit.ac.in",
      "23052601@kiit.ac.in",
      "23052612@kiit.ac.in",
      "23052615@kiit.ac.in",
      "23052622@kiit.ac.in",
      "23052746@kiit.ac.in",
      "23052754@kiit.ac.in",
      "23052768@kiit.ac.in",
      "23052812@kiit.ac.in",
      "23052858@kiit.ac.in",
      "23052875@kiit.ac.in",
      "23052920@kiit.ac.in",
      "23052939@kiit.ac.in",
      "23052964@kiit.ac.in",
      "23052998@kiit.ac.in",
      "23053072@kiit.ac.in",
      "23053127@kiit.ac.in",
      "23053133@kiit.ac.in",
      "23053145@kiit.ac.in",
      "23053161@kiit.ac.in",
      "23053162@kiit.ac.in",
      "23053178@kiit.ac.in",
      "23053212@kiit.ac.in",
      "23053249@kiit.ac.in",
      "23053265@kiit.ac.in",
      "23053286@kiit.ac.in",
      "23053319@kiit.ac.in",
      "23053330@kiit.ac.in",
      "23053374@kiit.ac.in",
      "23053462@kiit.ac.in",
      "2305369@kiit.ac.in",
      "23053710@kiit.ac.in",
      "2305432@kiit.ac.in",
      "2305493@kiit.ac.in",
      "2305501@kiit.ac.in",
      "2305503@kiit.ac.in",
      "2305547@kiit.ac.in",
      "2305673@kiit.ac.in",
      "2305723@kiit.ac.in",
      "2305815@kiit.ac.in",
      "2305825@kiit.ac.in",
      "2305841@kiit.ac.in",
      "2305907@kiit.ac.in",
      "2305951@kiit.ac.in",
      "2305954@kiit.ac.in",
      "2305968@kiit.ac.in",
      "2305990@kiit.ac.in",
      "2305993@kiit.ac.in",
      "23051137@kiit.ac.in",
      "23051148@kiit.ac.in",
      "23051149@kiit.ac.in",
      "23051215@kiit.ac.in",
      "23051226@kiit.ac.in",
      "23051379@kiit.ac.in",
      "23051460@kiit.ac.in",
      "2305160@kiit.ac.in",
      "23051622@kiit.ac.in",
      "23051625@kiit.ac.in",
      "23051680@kiit.ac.in",
      "23051702@kiit.ac.in",
      "2305176@kiit.ac.in",
      "23051780@kiit.ac.in",
      "23051847@kiit.ac.in",
      "23051870@kiit.ac.in",
      "23051875@kiit.ac.in",
      "23051962@kiit.ac.in",
      "2305199@kiit.ac.in",
      "23052063@kiit.ac.in",
      "23052098@kiit.ac.in",
      "23052104@kiit.ac.in",
      "23052124@kiit.ac.in",
      "23052191@kiit.ac.in",
      "23052249@kiit.ac.in",
      "23052404@kiit.ac.in",
      "23052446@kiit.ac.in",
      "23052512@kiit.ac.in",
      "23052513@kiit.ac.in",
      "23052599@kiit.ac.in",
      "23052608@kiit.ac.in",
      "23052627@kiit.ac.in",
      "23052801@kiit.ac.in",
      "23052825@kiit.ac.in",
      "23052833@kiit.ac.in",
      "23052916@kiit.ac.in",
      "23052919@kiit.ac.in",
      "2305300@kiit.ac.in",
      "23053019@kiit.ac.in",
      "23053090@kiit.ac.in",
      "23053131@kiit.ac.in",
      "23053168@kiit.ac.in",
      "23053169@kiit.ac.in",
      "23053173@kiit.ac.in",
      "23053308@kiit.ac.in",
      "2305331@kiit.ac.in",
      "23053393@kiit.ac.in",
      "23053507@kiit.ac.in",
      "2305579@kiit.ac.in",
      "2305648@kiit.ac.in",
      "2305655@kiit.ac.in",
      "2305773@kiit.ac.in",
      "2305775@kiit.ac.in",
      "2305821@kiit.ac.in",
      "2305828@kiit.ac.in",
      "2305858@kiit.ac.in",
      "23053755@kiit.ac.in",
      "23053757@kiit.ac.in",
      "23053427@kiit.ac.in",
      "23053433@kiit.ac.in",
      "23053436@kiit.ac.in",
      "23053468@kiit.ac.in",
      "23053475@kiit.ac.in",
      "23053548@kiit.ac.in",
      "23053551@kiit.ac.in",
      "23053554@kiit.ac.in",
      "23053558@kiit.ac.in",
      "23053577@kiit.ac.in",
      "23053587@kiit.ac.in",
      "23053588@kiit.ac.in",
      "23053589@kiit.ac.in",
      "23053590@kiit.ac.in",
      "23053591@kiit.ac.in",
      "23053592@kiit.ac.in",
      "23053595@kiit.ac.in",
      "23053596@kiit.ac.in",
      "23053597@kiit.ac.in",
      "23053598@kiit.ac.in",
      "23053599@kiit.ac.in",
      "23053601@kiit.ac.in",
      "23053602@kiit.ac.in",
      "23053603@kiit.ac.in",
      "23053604@kiit.ac.in",
      "23053607@kiit.ac.in",
      "23053611@kiit.ac.in",
      "23053634@kiit.ac.in",
      "23053636@kiit.ac.in",
      "23053642@kiit.ac.in",
      "23053643@kiit.ac.in",
      "23053644@kiit.ac.in",
      "23053648@kiit.ac.in",
      "23053650@kiit.ac.in",
      "23053651@kiit.ac.in",
      "23053652@kiit.ac.in",
      "23053653@kiit.ac.in",
      "23053654@kiit.ac.in",
      "23053661@kiit.ac.in",
      "23053662@kiit.ac.in",
      "23053672@kiit.ac.in",
      "23053673@kiit.ac.in",
      "23053674@kiit.ac.in",
      "23053690@kiit.ac.in",
      "23053698@kiit.ac.in",
      "23053701@kiit.ac.in",
      "23053712@kiit.ac.in",
      "23053713@kiit.ac.in",
      "23053714@kiit.ac.in",
      "23053715@kiit.ac.in",
      "23053716@kiit.ac.in",
      "23053734@kiit.ac.in",
      "23053735@kiit.ac.in",
      "23053743@kiit.ac.in",
      "23053744@kiit.ac.in",
      "23053745@kiit.ac.in",
      "23053747@kiit.ac.in",
      "23053749@kiit.ac.in",
      "23053750@kiit.ac.in",
      "23053560@kiit.ac.in",
      "23053400@kiit.ac.in",
      "23053402@kiit.ac.in",
      "23053403@kiit.ac.in",
      "23053406@kiit.ac.in",
      "23053407@kiit.ac.in",
      "23053411@kiit.ac.in",
      "23053416@kiit.ac.in",
      "23053418@kiit.ac.in",
      "23053422@kiit.ac.in",
      "23053431@kiit.ac.in",
      "23053434@kiit.ac.in",
      "23053435@kiit.ac.in",
      "23053464@kiit.ac.in",
      "23053470@kiit.ac.in",
      "23053485@kiit.ac.in",
      "23053486@kiit.ac.in",
      "23053488@kiit.ac.in",
      "23053489@kiit.ac.in",
      "23053491@kiit.ac.in",
      "23053492@kiit.ac.in",
      "23053493@kiit.ac.in",
      "23053494@kiit.ac.in",
      "23053495@kiit.ac.in",
      "23053498@kiit.ac.in",
      "23053500@kiit.ac.in",
      "23053543@kiit.ac.in",
      "23053557@kiit.ac.in",
      "23053571@kiit.ac.in",
      "23053572@kiit.ac.in",
      "23053574@kiit.ac.in",
      "23053581@kiit.ac.in",
      "23053584@kiit.ac.in",
      "23053613@kiit.ac.in",
      "23053616@kiit.ac.in",
      "23053617@kiit.ac.in",
      "23053641@kiit.ac.in",
      "23053740@kiit.ac.in",
      "2305009@kiit.ac.in",
      "2305028@kiit.ac.in",
      "2305102@kiit.ac.in",
      "23051023@kiit.ac.in",
      "23051034@kiit.ac.in",
      "23051036@kiit.ac.in",
      "23051044@kiit.ac.in",
      "23051048@kiit.ac.in",
      "23051061@kiit.ac.in",
      "23051081@kiit.ac.in",
      "23051083@kiit.ac.in",
      "23051096@kiit.ac.in",
      "23051115@kiit.ac.in",
      "23051121@kiit.ac.in",
      "23051133@kiit.ac.in",
      "23051145@kiit.ac.in",
      "23051152@kiit.ac.in",
      "23051176@kiit.ac.in",
      "23051180@kiit.ac.in",
      "23051182@kiit.ac.in",
      "23051186@kiit.ac.in",
      "23051201@kiit.ac.in",
      "23051207@kiit.ac.in",
      "23051216@kiit.ac.in",
      "23051223@kiit.ac.in",
      "23051252@kiit.ac.in",
      "23051259@kiit.ac.in",
      "23051261@kiit.ac.in",
      "23051276@kiit.ac.in",
      "23051284@kiit.ac.in",
      "23051287@kiit.ac.in",
      "23051288@kiit.ac.in",
      "23051290@kiit.ac.in",
      "23051295@kiit.ac.in",
      "23051303@kiit.ac.in",
      "23051306@kiit.ac.in",
      "23051307@kiit.ac.in",
      "2305131@kiit.ac.in",
      "23051324@kiit.ac.in",
      "23051353@kiit.ac.in",
      "2305136@kiit.ac.in",
      "23051378@kiit.ac.in",
      "2305138@kiit.ac.in",
      "23051384@kiit.ac.in",
      "23051388@kiit.ac.in",
      "23051390@kiit.ac.in",
      "2305141@kiit.ac.in",
      "23051448@kiit.ac.in",
      "23051455@kiit.ac.in",
      "23051465@kiit.ac.in",
      "2305148@kiit.ac.in",
      "23051487@kiit.ac.in",
      "2305152@kiit.ac.in",
      "23051522@kiit.ac.in",
      "23051529@kiit.ac.in",
      "23051536@kiit.ac.in",
      "23051549@kiit.ac.in",
      "23051564@kiit.ac.in",
      "23051584@kiit.ac.in",
      "23051617@kiit.ac.in",
      "23051618@kiit.ac.in",
      "23051648@kiit.ac.in",
      "23051654@kiit.ac.in",
      "23051655@kiit.ac.in",
      "2305166@kiit.ac.in",
      "23051714@kiit.ac.in",
      "23051735@kiit.ac.in",
      "23051736@kiit.ac.in",
      "23051739@kiit.ac.in",
      "23051749@kiit.ac.in",
      "2305175@kiit.ac.in",
      "23051756@kiit.ac.in",
      "23051786@kiit.ac.in",
      "23051796@kiit.ac.in",
      "23051839@kiit.ac.in",
      "2305185@kiit.ac.in",
      "23051884@kiit.ac.in",
      "23051886@kiit.ac.in",
      "23051917@kiit.ac.in",
      "23051922@kiit.ac.in",
      "23051934@kiit.ac.in",
      "23051937@kiit.ac.in",
      "23051944@kiit.ac.in",
      "23051960@kiit.ac.in",
      "23051984@kiit.ac.in",
      "2305200@kiit.ac.in",
      "23052012@kiit.ac.in",
      "2305202@kiit.ac.in",
      "23052021@kiit.ac.in",
      "23052025@kiit.ac.in",
      "23052028@kiit.ac.in",
      "23052039@kiit.ac.in",
      "23052041@kiit.ac.in",
      "23052047@kiit.ac.in",
      "23052048@kiit.ac.in",
      "23052054@kiit.ac.in",
      "23052058@kiit.ac.in",
      "23052075@kiit.ac.in",
      "23052116@kiit.ac.in",
      "23052132@kiit.ac.in",
      "23052138@kiit.ac.in",
      "23052148@kiit.ac.in",
      "23052152@kiit.ac.in",
      "23052177@kiit.ac.in",
      "23052186@kiit.ac.in",
      "23052197@kiit.ac.in",
      "23052229@kiit.ac.in",
      "23052241@kiit.ac.in",
      "23052259@kiit.ac.in",
      "23052262@kiit.ac.in",
      "23052274@kiit.ac.in",
      "23052280@kiit.ac.in",
      "23052289@kiit.ac.in",
      "23052293@kiit.ac.in",
      "23052304@kiit.ac.in",
      "23052320@kiit.ac.in",
      "23052321@kiit.ac.in",
      "23052326@kiit.ac.in",
      "23052332@kiit.ac.in",
      "23052339@kiit.ac.in",
      "23052342@kiit.ac.in",
      "23052348@kiit.ac.in",
      "23052370@kiit.ac.in",
      "23052373@kiit.ac.in",
      "23052377@kiit.ac.in",
      "23052379@kiit.ac.in",
      "23052435@kiit.ac.in",
      "23052438@kiit.ac.in",
      "23052470@kiit.ac.in",
      "23052475@kiit.ac.in",
      "2305250@kiit.ac.in",
      "23052501@kiit.ac.in",
      "23052509@kiit.ac.in",
      "23052538@kiit.ac.in",
      "2305254@kiit.ac.in",
      "23052550@kiit.ac.in",
      "23052571@kiit.ac.in",
      "23052582@kiit.ac.in",
      "23052583@kiit.ac.in",
      "2305259@kiit.ac.in",
      "23052598@kiit.ac.in",
      "23052624@kiit.ac.in",
      "23052628@kiit.ac.in",
      "23052639@kiit.ac.in",
      "23052667@kiit.ac.in",
      "23052677@kiit.ac.in",
      "23052688@kiit.ac.in",
      "23052689@kiit.ac.in",
      "2305270@kiit.ac.in",
      "2305273@kiit.ac.in",
      "23052767@kiit.ac.in",
      "23052774@kiit.ac.in",
      "23052780@kiit.ac.in",
      "23052783@kiit.ac.in",
      "23052786@kiit.ac.in",
      "23052788@kiit.ac.in",
      "23052792@kiit.ac.in",
      "23052796@kiit.ac.in",
      "23052804@kiit.ac.in",
      "23052815@kiit.ac.in",
      "23052824@kiit.ac.in",
      "23052840@kiit.ac.in",
      "23052841@kiit.ac.in",
      "23052847@kiit.ac.in",
      "23052851@kiit.ac.in",
      "23052855@kiit.ac.in",
      "23052860@kiit.ac.in",
      "23052878@kiit.ac.in",
      "23052884@kiit.ac.in",
      "23052885@kiit.ac.in",
      "23052887@kiit.ac.in",
      "23052931@kiit.ac.in",
      "23052932@kiit.ac.in",
      "23052946@kiit.ac.in",
      "23052956@kiit.ac.in",
      "23052961@kiit.ac.in",
      "23052993@kiit.ac.in",
      "23052994@kiit.ac.in",
      "23053001@kiit.ac.in",
      "23053024@kiit.ac.in",
      "23053028@kiit.ac.in",
      "23053038@kiit.ac.in",
      "23053039@kiit.ac.in",
      "23053054@kiit.ac.in",
      "23053061@kiit.ac.in",
      "23053065@kiit.ac.in",
      "23053071@kiit.ac.in",
      "23053075@kiit.ac.in",
      "23053079@kiit.ac.in",
      "23053087@kiit.ac.in",
      "23053089@kiit.ac.in",
      "23053091@kiit.ac.in",
      "23053095@kiit.ac.in",
      "23053147@kiit.ac.in",
      "23053157@kiit.ac.in",
      "23053164@kiit.ac.in",
      "23053170@kiit.ac.in",
      "23053182@kiit.ac.in",
      "23053188@kiit.ac.in",
      "23053206@kiit.ac.in",
      "23053236@kiit.ac.in",
      "23053245@kiit.ac.in",
      "23053247@kiit.ac.in",
      "2305325@kiit.ac.in",
      "23053271@kiit.ac.in",
      "23053284@kiit.ac.in",
      "23053295@kiit.ac.in",
      "23053303@kiit.ac.in",
      "23053309@kiit.ac.in",
      "23053320@kiit.ac.in",
      "23053322@kiit.ac.in",
      "23053323@kiit.ac.in",
      "23053332@kiit.ac.in",
      "23053333@kiit.ac.in",
      "23053376@kiit.ac.in",
      "23053404@kiit.ac.in",
      "23053405@kiit.ac.in",
      "23053409@kiit.ac.in",
      "23053410@kiit.ac.in",
      "23053412@kiit.ac.in",
      "23053414@kiit.ac.in",
      "23053421@kiit.ac.in",
      "23053423@kiit.ac.in",
      "23053425@kiit.ac.in",
      "23053426@kiit.ac.in",
      "23053427@kiit.ac.in",
      "23053428@kiit.ac.in",
      "23053429@kiit.ac.in",
      "23053430@kiit.ac.in",
      "23053433@kiit.ac.in",
      "23053436@kiit.ac.in",
      "23053454@kiit.ac.in",
      "23053455@kiit.ac.in",
      "23053456@kiit.ac.in",
      "23053459@kiit.ac.in",
      "23053465@kiit.ac.in",
      "23053468@kiit.ac.in",
      "23053469@kiit.ac.in",
      "23053472@kiit.ac.in",
      "23053473@kiit.ac.in",
      "23053475@kiit.ac.in",
      "23053476@kiit.ac.in",
      "23053477@kiit.ac.in",
      "23053478@kiit.ac.in",
      "23053479@kiit.ac.in",
      "2305348@kiit.ac.in",
      "23053480@kiit.ac.in",
      "23053481@kiit.ac.in",
      "23053482@kiit.ac.in",
      "23053484@kiit.ac.in",
      "23053490@kiit.ac.in",
      "23053496@kiit.ac.in",
      "23053501@kiit.ac.in",
      "23053503@kiit.ac.in",
      "23053508@kiit.ac.in",
      "2305352@kiit.ac.in",
      "23053527@kiit.ac.in",
      "23053542@kiit.ac.in",
      "23053544@kiit.ac.in",
      "23053545@kiit.ac.in",
      "23053546@kiit.ac.in",
      "23053547@kiit.ac.in",
      "23053548@kiit.ac.in",
      "23053549@kiit.ac.in",
      "23053550@kiit.ac.in",
      "23053551@kiit.ac.in",
      "23053552@kiit.ac.in",
      "23053553@kiit.ac.in",
      "23053554@kiit.ac.in",
      "23053555@kiit.ac.in",
      "23053556@kiit.ac.in",
      "23053558@kiit.ac.in",
      "23053559@kiit.ac.in",
      "23053564@kiit.ac.in",
      "23053576@kiit.ac.in",
      "23053577@kiit.ac.in",
      "23053579@kiit.ac.in",
      "23053580@kiit.ac.in",
      "23053582@kiit.ac.in",
      "23053583@kiit.ac.in",
      "23053585@kiit.ac.in",
      "23053587@kiit.ac.in",
      "23053588@kiit.ac.in",
      "23053589@kiit.ac.in",
      "23053590@kiit.ac.in",
      "23053591@kiit.ac.in",
      "23053592@kiit.ac.in",
      "23053594@kiit.ac.in",
      "23053595@kiit.ac.in",
      "23053596@kiit.ac.in",
      "23053597@kiit.ac.in",
      "23053598@kiit.ac.in",
      "23053599@kiit.ac.in",
      "23053601@kiit.ac.in",
      "23053602@kiit.ac.in",
      "23053603@kiit.ac.in",
      "23053604@kiit.ac.in",
      "23053606@kiit.ac.in",
      "23053607@kiit.ac.in",
      "23053608@kiit.ac.in",
      "23053609@kiit.ac.in",
      "23053610@kiit.ac.in",
      "23053611@kiit.ac.in",
      "23053612@kiit.ac.in",
      "23053614@kiit.ac.in",
      "23053615@kiit.ac.in",
      "23053629@kiit.ac.in",
      "23053633@kiit.ac.in",
      "23053634@kiit.ac.in",
      "23053636@kiit.ac.in",
      "23053642@kiit.ac.in",
      "23053643@kiit.ac.in",
      "23053644@kiit.ac.in",
      "23053646@kiit.ac.in",
      "23053648@kiit.ac.in",
      "23053649@kiit.ac.in",
      "23053650@kiit.ac.in",
      "23053651@kiit.ac.in",
      "23053652@kiit.ac.in",
      "23053653@kiit.ac.in",
      "23053654@kiit.ac.in",
      "23053658@kiit.ac.in",
      "23053661@kiit.ac.in",
      "23053662@kiit.ac.in",
      "23053663@kiit.ac.in",
      "23053668@kiit.ac.in",
      "23053670@kiit.ac.in",
      "23053672@kiit.ac.in",
      "23053673@kiit.ac.in",
      "23053674@kiit.ac.in",
      "23053680@kiit.ac.in",
      "23053681@kiit.ac.in",
      "23053687@kiit.ac.in",
      "23053690@kiit.ac.in",
      "23053691@kiit.ac.in",
      "23053694@kiit.ac.in",
      "23053696@kiit.ac.in",
      "23053697@kiit.ac.in",
      "23053698@kiit.ac.in",
      "23053701@kiit.ac.in",
      "23053704@kiit.ac.in",
      "23053712@kiit.ac.in",
      "23053713@kiit.ac.in",
      "23053714@kiit.ac.in",
      "23053715@kiit.ac.in",
      "23053716@kiit.ac.in",
      "23053717@kiit.ac.in",
      "23053719@kiit.ac.in",
      "23053720@kiit.ac.in",
      "23053723@kiit.ac.in",
      "23053724@kiit.ac.in",
      "23053725@kiit.ac.in",
      "23053727@kiit.ac.in",
      "23053731@kiit.ac.in",
      "23053732@kiit.ac.in",
      "23053734@kiit.ac.in",
      "23053735@kiit.ac.in",
      "23053736@kiit.ac.in",
      "23053737@kiit.ac.in",
      "23053738@kiit.ac.in",
      "23053739@kiit.ac.in",
      "2305374@kiit.ac.in",
      "23053743@kiit.ac.in",
      "23053744@kiit.ac.in",
      "23053745@kiit.ac.in",
      "23053747@kiit.ac.in",
      "23053749@kiit.ac.in",
      "23053750@kiit.ac.in",
      "23053753@kiit.ac.in",
      "23053754@kiit.ac.in",
      "23053755@kiit.ac.in",
      "23053756@kiit.ac.in",
      "23053757@kiit.ac.in",
      "23053761@kiit.ac.in",
      "23053762@kiit.ac.in",
      "23053763@kiit.ac.in",
      "23053764@kiit.ac.in",
      "23053765@kiit.ac.in",
      "23053767@kiit.ac.in",
      "23053768@kiit.ac.in",
      "23053770@kiit.ac.in",
      "23053772@kiit.ac.in",
      "23053774@kiit.ac.in",
      "23053775@kiit.ac.in",
      "23053776@kiit.ac.in",
      "23053777@kiit.ac.in",
      "23053778@kiit.ac.in",
      "23053779@kiit.ac.in",
      "23053780@kiit.ac.in",
      "23053781@kiit.ac.in",
      "23053782@kiit.ac.in",
      "23053783@kiit.ac.in",
      "23053785@kiit.ac.in",
      "23053786@kiit.ac.in",
      "23053790@kiit.ac.in",
      "23053792@kiit.ac.in",
      "23053795@kiit.ac.in",
      "2305413@kiit.ac.in",
      "2305419@kiit.ac.in",
      "2305456@kiit.ac.in",
      "2305462@kiit.ac.in",
      "2305468@kiit.ac.in",
      "2305480@kiit.ac.in",
      "2305485@kiit.ac.in",
      "2305490@kiit.ac.in",
      "2305508@kiit.ac.in",
      "2305509@kiit.ac.in",
      "2305590@kiit.ac.in",
      "2305595@kiit.ac.in",
      "2305597@kiit.ac.in",
      "2305605@kiit.ac.in",
      "2305616@kiit.ac.in",
      "2305618@kiit.ac.in",
      "2305643@kiit.ac.in",
      "2305652@kiit.ac.in",
      "2305654@kiit.ac.in",
      "2305663@kiit.ac.in",
      "2305679@kiit.ac.in",
      "2305690@kiit.ac.in",
      "2305742@kiit.ac.in",
      "2305794@kiit.ac.in",
      "2305843@kiit.ac.in",
      "2305850@kiit.ac.in",
      "2305851@kiit.ac.in",
      "2305853@kiit.ac.in",
      "2305861@kiit.ac.in",
      "2305863@kiit.ac.in",
      "2305865@kiit.ac.in",
      "2305884@kiit.ac.in",
      "2305886@kiit.ac.in",
      "2305901@kiit.ac.in",
      "2305908@kiit.ac.in",
      "2305936@kiit.ac.in",
      "2305953@kiit.ac.in",
      "2305974@kiit.ac.in",
      "2305979@kiit.ac.in",
      "2305985@kiit.ac.in",
      "2305995@kiit.ac.in"
    ]


    const users = [

      "22051051@kiit.ac.in",
      "22051054@kiit.ac.in",
      "22051055@kiit.ac.in",
      "22051057@kiit.ac.in",
      "22051059@kiit.ac.in",
      "22051061@kiit.ac.in",
      "22051071@kiit.ac.in",
      "22051076@kiit.ac.in",
      "22051079@kiit.ac.in",
      "22051081@kiit.ac.in",
      "22051082@kiit.ac.in",
      "22051083@kiit.ac.in",
      "22051085@kiit.ac.in",
      "22051091@kiit.ac.in",
      "22051092@kiit.ac.in",
      "22051096@kiit.ac.in",
      "22051101@kiit.ac.in",
      "22051114@kiit.ac.in",
      "22051116@kiit.ac.in",
      "22051118@kiit.ac.in",
      "22051120@kiit.ac.in",
      "22051121@kiit.ac.in",
      "22051122@kiit.ac.in",
      "22051123@kiit.ac.in",
      "22051127@kiit.ac.in",
      "22051128@kiit.ac.in",
      "22051133@kiit.ac.in",
      "22051136@kiit.ac.in",
      "22051137@kiit.ac.in",
      "22051148@kiit.ac.in",
      "22051149@kiit.ac.in",
      "22051150@kiit.ac.in",
      "22051153@kiit.ac.in",
      "22051154@kiit.ac.in",
      "22051155@kiit.ac.in",
      "22051156@kiit.ac.in",
      "22051170@kiit.ac.in",
      "22051175@kiit.ac.in",
      "22051183@kiit.ac.in",
      "22051186@kiit.ac.in",
      "22051191@kiit.ac.in",
      "22051192@kiit.ac.in",
      "22051193@kiit.ac.in",
      "22051196@kiit.ac.in",
      "22051198@kiit.ac.in",
      "22051200@kiit.ac.in",
      "22051201@kiit.ac.in",
      "22051203@kiit.ac.in",
      "22051211@kiit.ac.in",
      "22051213@kiit.ac.in",
      "22051214@kiit.ac.in",
      "22051216@kiit.ac.in",
      "22051225@kiit.ac.in",
      "22051226@kiit.ac.in",
      "22051228@kiit.ac.in",
      "22051231@kiit.ac.in",
      "22051238@kiit.ac.in",
      "22051241@kiit.ac.in",
      "22051243@kiit.ac.in",
      "22051245@kiit.ac.in",
      "22051246@kiit.ac.in",
      "22051248@kiit.ac.in",
      "22051255@kiit.ac.in",
      "22051256@kiit.ac.in",
      "22051258@kiit.ac.in",
      "22051267@kiit.ac.in",
      "22051273@kiit.ac.in",
      "22051284@kiit.ac.in",
      "22051288@kiit.ac.in",
      "22051291@kiit.ac.in",
      "22051296@kiit.ac.in",
      "22051298@kiit.ac.in",
      "22051299@kiit.ac.in",
      "22051300@kiit.ac.in",
      "22051307@kiit.ac.in",
      "22051308@kiit.ac.in",
      "22051310@kiit.ac.in",
      "22051318@kiit.ac.in",
      "22051322@kiit.ac.in",
      "22051328@kiit.ac.in",
      "22051331@kiit.ac.in",
      "22051336@kiit.ac.in",
      "22051339@kiit.ac.in",
      "22051341@kiit.ac.in",
      "22051344@kiit.ac.in",
      "22051345@kiit.ac.in",
      "22051346@kiit.ac.in",
      "22051348@kiit.ac.in",
      "22051350@kiit.ac.in",
      "22051352@kiit.ac.in",
      "22051354@kiit.ac.in",
      "22051358@kiit.ac.in",
      "22051360@kiit.ac.in",
      "22051364@kiit.ac.in",
      "22051365@kiit.ac.in",
      "22051367@kiit.ac.in",
      "22051368@kiit.ac.in",
      "22051369@kiit.ac.in",
      "22051371@kiit.ac.in",
      "22051372@kiit.ac.in",
      "22051374@kiit.ac.in",
      "22051376@kiit.ac.in",
      "22051378@kiit.ac.in",
      "22051379@kiit.ac.in",
      "22051382@kiit.ac.in",
      "22051383@kiit.ac.in",
      "22051385@kiit.ac.in",
      "22051387@kiit.ac.in",
      "22051388@kiit.ac.in",
      "22051392@kiit.ac.in",
      "22051394@kiit.ac.in",
      "22051396@kiit.ac.in",
      "22051398@kiit.ac.in",
      "22051406@kiit.ac.in",
      "22051409@kiit.ac.in",
      "22051410@kiit.ac.in",
      "22051421@kiit.ac.in",
      "22051422@kiit.ac.in",
      "22051425@kiit.ac.in",
      "22051430@kiit.ac.in",
      "22051431@kiit.ac.in",
      "22051432@kiit.ac.in",
      "22051434@kiit.ac.in",
      "22051442@kiit.ac.in",
      "22051444@kiit.ac.in",
      "22051446@kiit.ac.in",
      "22051447@kiit.ac.in",
      "22051451@kiit.ac.in",
      "22051453@kiit.ac.in",
      "22051458@kiit.ac.in",
      "22051464@kiit.ac.in",
      "22051466@kiit.ac.in",
      "22051468@kiit.ac.in",
      "22051469@kiit.ac.in",
      "22051470@kiit.ac.in",
      "22051471@kiit.ac.in",
      "22051474@kiit.ac.in",
      "22051484@kiit.ac.in",
      "22051487@kiit.ac.in",
      "22051488@kiit.ac.in",
      "22051494@kiit.ac.in",
      "22051496@kiit.ac.in",
      "22051498@kiit.ac.in",
      "22051500@kiit.ac.in",
      "22051504@kiit.ac.in",
      "22051506@kiit.ac.in",
      "22051507@kiit.ac.in",
      "22051509@kiit.ac.in",
      "22051511@kiit.ac.in",
      "22051518@kiit.ac.in",
      "22051523@kiit.ac.in",
      "22051525@kiit.ac.in",
      "22051529@kiit.ac.in",
      "22051539@kiit.ac.in",
      "22051541@kiit.ac.in",
      "22051543@kiit.ac.in",
      "22051544@kiit.ac.in",
      "22051547@kiit.ac.in",
      "22051551@kiit.ac.in",
      "22051557@kiit.ac.in",
      "22051559@kiit.ac.in",
      "22051562@kiit.ac.in",
      "22051565@kiit.ac.in",
      "22051566@kiit.ac.in",
      "22051567@kiit.ac.in",
      "22051569@kiit.ac.in",
      "22051571@kiit.ac.in",
      "22051572@kiit.ac.in",
      "22051576@kiit.ac.in",
      "22051578@kiit.ac.in",
      "22051583@kiit.ac.in",
      "22051586@kiit.ac.in",
      "22051589@kiit.ac.in",
      "22051591@kiit.ac.in",
      "22051595@kiit.ac.in",
      "22051600@kiit.ac.in",
      "22051601@kiit.ac.in",
      "22051603@kiit.ac.in",
      "22051608@kiit.ac.in",
      "22051609@kiit.ac.in",
      "22051610@kiit.ac.in",
      "22051612@kiit.ac.in",
      "22051613@kiit.ac.in",
      "22051614@kiit.ac.in",
      "22051615@kiit.ac.in",
      "22051616@kiit.ac.in",
      "22051619@kiit.ac.in",
      "22051620@kiit.ac.in",
      "22051625@kiit.ac.in",
      "22051626@kiit.ac.in",
      "22051630@kiit.ac.in",
      "22051631@kiit.ac.in",
      "22051634@kiit.ac.in",
      "22051636@kiit.ac.in",
      "22051638@kiit.ac.in",
      "22051639@kiit.ac.in",
      "22051642@kiit.ac.in",
      "22051644@kiit.ac.in",
      "22051645@kiit.ac.in",
      "22051654@kiit.ac.in",
      "22051656@kiit.ac.in",
      "22051657@kiit.ac.in",
      "22051659@kiit.ac.in",
      "22051662@kiit.ac.in",
      "22051666@kiit.ac.in",
      "22051667@kiit.ac.in",
      "22051672@kiit.ac.in",
      "22051673@kiit.ac.in",
      "22051675@kiit.ac.in",
      "22051681@kiit.ac.in",
      "22051682@kiit.ac.in",
      "22051684@kiit.ac.in",
      "22051686@kiit.ac.in",
      "22051691@kiit.ac.in",
      "22051694@kiit.ac.in",
      "22051695@kiit.ac.in",
      "22051696@kiit.ac.in",
      "22051699@kiit.ac.in",
      "22051703@kiit.ac.in",
      "22051704@kiit.ac.in",
      "22051712@kiit.ac.in",
      "22051715@kiit.ac.in",
      "22051723@kiit.ac.in",
      "22051724@kiit.ac.in",
      "22051731@kiit.ac.in",
      "22051738@kiit.ac.in",
      "22051741@kiit.ac.in",
      "22051742@kiit.ac.in",
      "22051743@kiit.ac.in",
      "22051744@kiit.ac.in",
      "22051748@kiit.ac.in",
      "22051756@kiit.ac.in",
      "22051762@kiit.ac.in",
      "22051765@kiit.ac.in",
      "22051766@kiit.ac.in",
      "22051767@kiit.ac.in",
      "22051768@kiit.ac.in",
      "22051770@kiit.ac.in",
      "22051771@kiit.ac.in",
      "22051774@kiit.ac.in",
      "22051775@kiit.ac.in",
      "22051780@kiit.ac.in",
      "22051788@kiit.ac.in",
      "22051793@kiit.ac.in",
      "22051798@kiit.ac.in",
      "22051802@kiit.ac.in",
      "22051803@kiit.ac.in",
      "22051805@kiit.ac.in",
      "22051813@kiit.ac.in",
      "22051817@kiit.ac.in",
      "22051819@kiit.ac.in",
      "22051820@kiit.ac.in",
      "22051822@kiit.ac.in",
      "22051823@kiit.ac.in",
      "22051824@kiit.ac.in",
      "22051827@kiit.ac.in",
      "22051828@kiit.ac.in",
      "22051832@kiit.ac.in",
      "22051833@kiit.ac.in",
      "22051837@kiit.ac.in",
      "22051845@kiit.ac.in",
      "22051846@kiit.ac.in",
      "22051847@kiit.ac.in",
      "22051848@kiit.ac.in",
      "22051849@kiit.ac.in",
      "22051855@kiit.ac.in",
      "22051857@kiit.ac.in",
      "22051858@kiit.ac.in",
      "22051861@kiit.ac.in",
      "22051863@kiit.ac.in",
      "22051864@kiit.ac.in",
      "22051866@kiit.ac.in",
      "22051867@kiit.ac.in",
      "22051874@kiit.ac.in",
      "22051877@kiit.ac.in",
      "22051878@kiit.ac.in",
      "22051879@kiit.ac.in",
      "22051882@kiit.ac.in",
      "22051885@kiit.ac.in",
      "22051890@kiit.ac.in",
      "22051895@kiit.ac.in",
      "22051897@kiit.ac.in",
      "22051903@kiit.ac.in",
      "22051906@kiit.ac.in",
      "22051907@kiit.ac.in",
      "22051908@kiit.ac.in",
      "22051921@kiit.ac.in",
      "22051922@kiit.ac.in",
      "22051923@kiit.ac.in",
      "22051925@kiit.ac.in",
      "22051926@kiit.ac.in",
      "22051927@kiit.ac.in",
      "22051929@kiit.ac.in",
      "22051931@kiit.ac.in",
      "22051932@kiit.ac.in",
      "22051934@kiit.ac.in",
      "22051937@kiit.ac.in",
      "22051940@kiit.ac.in",
      "22051942@kiit.ac.in",
      "22051949@kiit.ac.in",
      "22051951@kiit.ac.in",
      "22051952@kiit.ac.in",
      "22051958@kiit.ac.in",
      "22051959@kiit.ac.in",
      "22051960@kiit.ac.in",
      "22051965@kiit.ac.in",
      "22051968@kiit.ac.in",
      "22051969@kiit.ac.in",
      "22051973@kiit.ac.in",
      "22051979@kiit.ac.in",
      "22051986@kiit.ac.in",
      "22051992@kiit.ac.in",
      "22051993@kiit.ac.in",
      "22051996@kiit.ac.in",
      "22051999@kiit.ac.in",
      "22052001@kiit.ac.in",
      "22052003@kiit.ac.in",
      "22052005@kiit.ac.in",
      "22052007@kiit.ac.in",
      "22052009@kiit.ac.in",
      "22052012@kiit.ac.in",
      "22052013@kiit.ac.in",
      "22052018@kiit.ac.in",
      "22052027@kiit.ac.in",
      "22052031@kiit.ac.in",
      "22052033@kiit.ac.in",
      "22052034@kiit.ac.in",
      "22052035@kiit.ac.in",
      "22052036@kiit.ac.in",
      "22052037@kiit.ac.in",
      "22052038@kiit.ac.in",
      "22052040@kiit.ac.in",
      "22052042@kiit.ac.in",
      "22052050@kiit.ac.in",
      "22052051@kiit.ac.in",
      "22052052@kiit.ac.in",
      "22052053@kiit.ac.in",
      "22052054@kiit.ac.in",
      "22052056@kiit.ac.in",
      "22052058@kiit.ac.in",
      "22052059@kiit.ac.in",
      "22052067@kiit.ac.in",
      "22052072@kiit.ac.in",
      "22052073@kiit.ac.in",
      "22052075@kiit.ac.in",
      "22052080@kiit.ac.in",
      "22052082@kiit.ac.in",
      "22052083@kiit.ac.in",
      "22052087@kiit.ac.in",
      "22052088@kiit.ac.in",
      "22052090@kiit.ac.in",
      "22052091@kiit.ac.in",
      "22052092@kiit.ac.in",
      "22052100@kiit.ac.in",
      "22052107@kiit.ac.in",
      "22052108@kiit.ac.in",
      "22052109@kiit.ac.in",
      "22052116@kiit.ac.in",
      "22052118@kiit.ac.in",
      "22052119@kiit.ac.in",
      "22052122@kiit.ac.in",
      "22052128@kiit.ac.in",
      "22052129@kiit.ac.in",
      "22052130@kiit.ac.in",
      "22052132@kiit.ac.in",
      "22052133@kiit.ac.in",
      "22052135@kiit.ac.in",
      "22052136@kiit.ac.in",
      "22052140@kiit.ac.in",
      "22052141@kiit.ac.in",
      "22052143@kiit.ac.in",
      "22052147@kiit.ac.in",
      "22052148@kiit.ac.in",
      "22052151@kiit.ac.in",
      "22052153@kiit.ac.in",
      "22052155@kiit.ac.in",
      "22052159@kiit.ac.in",
      "22052162@kiit.ac.in",
      "22052167@kiit.ac.in",
      "22052172@kiit.ac.in",
      "22052175@kiit.ac.in",
      "22052180@kiit.ac.in",
      "22052185@kiit.ac.in",
      "22052188@kiit.ac.in",
      "22052198@kiit.ac.in",
      "22052199@kiit.ac.in",
      "22052200@kiit.ac.in",
      "22052209@kiit.ac.in",
      "22052211@kiit.ac.in",
      "22052214@kiit.ac.in",
      "22052215@kiit.ac.in",
      "22052218@kiit.ac.in",
      "22052219@kiit.ac.in",
      "22052221@kiit.ac.in",
      "22052224@kiit.ac.in",
      "22052238@kiit.ac.in",
      "22052241@kiit.ac.in",
      "22052245@kiit.ac.in",
      "22052246@kiit.ac.in",
      "22052248@kiit.ac.in",
      "22052249@kiit.ac.in",
      "22052251@kiit.ac.in",
      "22052252@kiit.ac.in",
      "22052253@kiit.ac.in",
      "22052254@kiit.ac.in",
      "22052255@kiit.ac.in",
      "22052258@kiit.ac.in",
      "22052259@kiit.ac.in",
      "22052260@kiit.ac.in",
      "22052261@kiit.ac.in",
      "22052262@kiit.ac.in",
      "22052266@kiit.ac.in",
      "22052267@kiit.ac.in",
      "22052268@kiit.ac.in",
      "22052271@kiit.ac.in",
      "22052274@kiit.ac.in",
      "22052275@kiit.ac.in",
      "22052277@kiit.ac.in",
      "22052278@kiit.ac.in",
      "22052283@kiit.ac.in",
      "22052285@kiit.ac.in",
      "22052288@kiit.ac.in",
      "22052289@kiit.ac.in",
      "22052294@kiit.ac.in",
      "22052297@kiit.ac.in",
      "22052302@kiit.ac.in",
      "22052303@kiit.ac.in",
      "22052306@kiit.ac.in",
      "22052309@kiit.ac.in",
      "22052313@kiit.ac.in",
      "22052325@kiit.ac.in",
      "22052330@kiit.ac.in",
      "22052333@kiit.ac.in",
      "22052334@kiit.ac.in",
      "22052343@kiit.ac.in",
      "22052344@kiit.ac.in",
      "22052347@kiit.ac.in",
      "22052348@kiit.ac.in",
      "22052350@kiit.ac.in",
      "22052351@kiit.ac.in",
      "22052352@kiit.ac.in",
      "22052355@kiit.ac.in",
      "22052356@kiit.ac.in",
      "22052363@kiit.ac.in",
      "22052364@kiit.ac.in",
      "22052366@kiit.ac.in",
      "22052367@kiit.ac.in",
      "22052368@kiit.ac.in",
      "22052369@kiit.ac.in",
      "22052378@kiit.ac.in",
      "22052384@kiit.ac.in",
      "22052385@kiit.ac.in",
      "22052386@kiit.ac.in",
      "22052390@kiit.ac.in",
      "22052395@kiit.ac.in",
      "22052397@kiit.ac.in",
      "22052402@kiit.ac.in",
      "22052403@kiit.ac.in",
      "22052411@kiit.ac.in",
      "22052414@kiit.ac.in",
      "22052421@kiit.ac.in",
      "22052427@kiit.ac.in",
      "22052429@kiit.ac.in",
      "22052430@kiit.ac.in",
      "22052432@kiit.ac.in",
      "22052434@kiit.ac.in",
      "22052436@kiit.ac.in",
      "22052446@kiit.ac.in",
      "22052451@kiit.ac.in",
      "22052458@kiit.ac.in",
      "22052459@kiit.ac.in",
      "22052467@kiit.ac.in",
      "22052471@kiit.ac.in",
      "22052472@kiit.ac.in",
      "22052473@kiit.ac.in",
      "22052474@kiit.ac.in",
      "22052475@kiit.ac.in",
      "22052477@kiit.ac.in",
      "22052479@kiit.ac.in",
      "22052483@kiit.ac.in",
      "22052484@kiit.ac.in",
      "22052500@kiit.ac.in",
      "22052505@kiit.ac.in",
      "22052512@kiit.ac.in",
      "22052513@kiit.ac.in",
      "22052516@kiit.ac.in",
      "22052518@kiit.ac.in",
      "22052521@kiit.ac.in",
      "22052536@kiit.ac.in",
      "22052539@kiit.ac.in",
      "22052540@kiit.ac.in",
      "22052541@kiit.ac.in",
      "22052542@kiit.ac.in",
      "22052544@kiit.ac.in",
      "22052547@kiit.ac.in",
      "22052552@kiit.ac.in",
      "22052555@kiit.ac.in",
      "22052558@kiit.ac.in",
      "22052563@kiit.ac.in",
      "22052571@kiit.ac.in",
      "22052573@kiit.ac.in",
      "22052575@kiit.ac.in",
      "22052576@kiit.ac.in",
      "22052577@kiit.ac.in",
      "22052580@kiit.ac.in",
      "22052582@kiit.ac.in",
      "22052587@kiit.ac.in",
      "22052590@kiit.ac.in",
      "22052592@kiit.ac.in",
      "22052594@kiit.ac.in",
      "22052601@kiit.ac.in",
      "22052602@kiit.ac.in",
      "22052606@kiit.ac.in",
      "22052608@kiit.ac.in",
      "22052609@kiit.ac.in",
      "22052614@kiit.ac.in",
      "22052616@kiit.ac.in",
      "22052617@kiit.ac.in",
      "22052619@kiit.ac.in",
      "22052624@kiit.ac.in",
      "22052625@kiit.ac.in",
      "22052626@kiit.ac.in",
      "22052627@kiit.ac.in",
      "22052631@kiit.ac.in",
      "22052632@kiit.ac.in",
      "22052636@kiit.ac.in",
      "22052640@kiit.ac.in",
      "22052644@kiit.ac.in",
      "22052646@kiit.ac.in",
      "22052648@kiit.ac.in",
      "22052651@kiit.ac.in",
      "22052653@kiit.ac.in",
      "22052654@kiit.ac.in",
      "22052658@kiit.ac.in",
      "22052659@kiit.ac.in",
      "22052661@kiit.ac.in",
      "22052664@kiit.ac.in",
      "22052668@kiit.ac.in",
      "22052673@kiit.ac.in",
      "22052675@kiit.ac.in",
      "22052677@kiit.ac.in",
      "22052681@kiit.ac.in",
      "22052682@kiit.ac.in",
      "22052688@kiit.ac.in",
      "22052689@kiit.ac.in",
      "22052690@kiit.ac.in",
      "22052691@kiit.ac.in",
      "22052692@kiit.ac.in",
      "22052695@kiit.ac.in",
      "22052696@kiit.ac.in",
      "22052697@kiit.ac.in",
      "22052698@kiit.ac.in",
      "22052700@kiit.ac.in",
      "22052702@kiit.ac.in",
      "22052708@kiit.ac.in",
      "22052711@kiit.ac.in",
      "22052720@kiit.ac.in",
      "22052725@kiit.ac.in",
      "22052727@kiit.ac.in",
      "22052730@kiit.ac.in",
      "22052732@kiit.ac.in",
      "22052733@kiit.ac.in",
      "22052734@kiit.ac.in",
      "22052735@kiit.ac.in",
      "22052738@kiit.ac.in",
      "22052743@kiit.ac.in",
      "22052746@kiit.ac.in",
      "22052747@kiit.ac.in",
      "22052749@kiit.ac.in",
      "22052750@kiit.ac.in",
      "22052757@kiit.ac.in",
      "22052766@kiit.ac.in",
      "22052767@kiit.ac.in",
      "22052769@kiit.ac.in",
      "22052772@kiit.ac.in",
      "22052775@kiit.ac.in",
      "22052779@kiit.ac.in",
      "22052782@kiit.ac.in",
      "22052784@kiit.ac.in",
      "22052785@kiit.ac.in",
      "22052788@kiit.ac.in",
      "22052791@kiit.ac.in",
      "22052792@kiit.ac.in",
      "22052797@kiit.ac.in",
      "22052799@kiit.ac.in",
      "22052801@kiit.ac.in",
      "22052803@kiit.ac.in",
      "22052804@kiit.ac.in",
      "22052809@kiit.ac.in",
      "22052812@kiit.ac.in",
      "22052819@kiit.ac.in",
      "22052820@kiit.ac.in",
      "22052821@kiit.ac.in",
      "22052823@kiit.ac.in",
      "22052825@kiit.ac.in",
      "22052826@kiit.ac.in",
      "22052827@kiit.ac.in",
      "22052830@kiit.ac.in",
      "22052831@kiit.ac.in",
      "22052833@kiit.ac.in",
      "22052835@kiit.ac.in",
      "22052839@kiit.ac.in",
      "22052845@kiit.ac.in",
      "22052846@kiit.ac.in",
      "22052848@kiit.ac.in",
      "22052852@kiit.ac.in",
      "22052856@kiit.ac.in",
      "22052858@kiit.ac.in",
      "22052861@kiit.ac.in",
      "22052862@kiit.ac.in",
      "22052863@kiit.ac.in",
      "22052865@kiit.ac.in",
      "22052866@kiit.ac.in",
      "22052867@kiit.ac.in",
      "22052869@kiit.ac.in",
      "22052870@kiit.ac.in",
      "22052872@kiit.ac.in",
      "22052876@kiit.ac.in",
      "22052881@kiit.ac.in",
      "22052882@kiit.ac.in",
      "22052883@kiit.ac.in",
      "22052884@kiit.ac.in",
      "22052892@kiit.ac.in",
      "22052894@kiit.ac.in",
      "22052898@kiit.ac.in",
      "22052900@kiit.ac.in",
      "22052903@kiit.ac.in",
      "22052904@kiit.ac.in",
      "22052906@kiit.ac.in",
      "22052907@kiit.ac.in",
      "22052908@kiit.ac.in",
      "22052909@kiit.ac.in",
      "22052910@kiit.ac.in",
      "22052912@kiit.ac.in",
      "22052914@kiit.ac.in",
      "22052916@kiit.ac.in",
      "22052918@kiit.ac.in",
      "22052919@kiit.ac.in",
      "22052921@kiit.ac.in",
      "22052924@kiit.ac.in",
      "22052926@kiit.ac.in",
      "22052927@kiit.ac.in",
      "22052928@kiit.ac.in",
      "22052929@kiit.ac.in",
      "22052930@kiit.ac.in",
      "22052932@kiit.ac.in",
      "22052933@kiit.ac.in",
      "22052936@kiit.ac.in",
      "22052937@kiit.ac.in",
      "22052938@kiit.ac.in",
      "22052945@kiit.ac.in",
      "22052948@kiit.ac.in",
      "22052950@kiit.ac.in",
      "22052952@kiit.ac.in",
      "22052953@kiit.ac.in",
      "22052955@kiit.ac.in",
      "22052961@kiit.ac.in",
      "22052962@kiit.ac.in",
      "22052965@kiit.ac.in",
      "22052968@kiit.ac.in",
      "22052976@kiit.ac.in",
      "22052985@kiit.ac.in",
      "22052989@kiit.ac.in",
      "22052990@kiit.ac.in",
      "22052991@kiit.ac.in",
      "22052994@kiit.ac.in",
      "22052997@kiit.ac.in",
      "22052998@kiit.ac.in",
      "22053002@kiit.ac.in",
      "22053003@kiit.ac.in",
      "22053004@kiit.ac.in",
      "22053007@kiit.ac.in",
      "22053008@kiit.ac.in",
      "22053011@kiit.ac.in",
      "22053013@kiit.ac.in",
      "22053014@kiit.ac.in",
      "22053019@kiit.ac.in",
      "22053021@kiit.ac.in",
      "22053022@kiit.ac.in",
      "22053025@kiit.ac.in",
      "22053032@kiit.ac.in",
      "22053033@kiit.ac.in",
      "22053041@kiit.ac.in",
      "22053043@kiit.ac.in",
      "22053046@kiit.ac.in",
      "22053048@kiit.ac.in",
      "22053051@kiit.ac.in",
      "22053052@kiit.ac.in",
      "22053053@kiit.ac.in",
      "22053059@kiit.ac.in",
      "22053062@kiit.ac.in",
      "22053063@kiit.ac.in",
      "22053074@kiit.ac.in",
      "22053077@kiit.ac.in",
      "22053079@kiit.ac.in",
      "22053080@kiit.ac.in",
      "22053081@kiit.ac.in",
      "22053087@kiit.ac.in",
      "22053088@kiit.ac.in",
      "22053091@kiit.ac.in",
      "22053092@kiit.ac.in",
      "22053097@kiit.ac.in",
      "22053098@kiit.ac.in",
      "22053105@kiit.ac.in",
      "22053108@kiit.ac.in",
      "22053111@kiit.ac.in",
      "22053112@kiit.ac.in",
      "22053115@kiit.ac.in",
      "22053116@kiit.ac.in",
      "22053120@kiit.ac.in",
      "22053127@kiit.ac.in",
      "22053129@kiit.ac.in",
      "22053130@kiit.ac.in",
      "22053133@kiit.ac.in",
      "22053135@kiit.ac.in",
      "22053140@kiit.ac.in",
      "22053142@kiit.ac.in",
      "22053143@kiit.ac.in",
      "22053146@kiit.ac.in",
      "22053147@kiit.ac.in",
      "22053148@kiit.ac.in",
      "22053151@kiit.ac.in",
      "22053152@kiit.ac.in",
      "22053153@kiit.ac.in",
      "22053156@kiit.ac.in",
      "22053157@kiit.ac.in",
      "22053160@kiit.ac.in",
      "22053161@kiit.ac.in",
      "22053162@kiit.ac.in",
      "22053163@kiit.ac.in",
      "22053165@kiit.ac.in",
      "22053166@kiit.ac.in",
      "22053169@kiit.ac.in",
      "22053170@kiit.ac.in",
      "22053172@kiit.ac.in",
      "22053176@kiit.ac.in",
      "22053178@kiit.ac.in",
      "22053179@kiit.ac.in",
      "22053181@kiit.ac.in",
      "22053183@kiit.ac.in",
      "22053189@kiit.ac.in",
      "22053194@kiit.ac.in",
      "22053195@kiit.ac.in",
      "22053196@kiit.ac.in",
      "22053201@kiit.ac.in",
      "22053203@kiit.ac.in",
      "22053208@kiit.ac.in",
      "22053210@kiit.ac.in",
      "22053211@kiit.ac.in",
      "22053214@kiit.ac.in",
      "22053217@kiit.ac.in",
      "22053220@kiit.ac.in",
      "22053222@kiit.ac.in",
      "22053223@kiit.ac.in",
      "22053226@kiit.ac.in",
      "22053227@kiit.ac.in",
      "22053228@kiit.ac.in",
      "22053231@kiit.ac.in",
      "22053232@kiit.ac.in",
      "22053235@kiit.ac.in",
      "22053237@kiit.ac.in",
      "22053238@kiit.ac.in",
      "22053241@kiit.ac.in",
      "22053242@kiit.ac.in",
      "22053243@kiit.ac.in",
      "22053244@kiit.ac.in",
      "22053247@kiit.ac.in",
      "22053248@kiit.ac.in",
      "22053252@kiit.ac.in",
      "22053253@kiit.ac.in",
      "22053254@kiit.ac.in",
      "22053255@kiit.ac.in",
      "22053257@kiit.ac.in",
      "22053258@kiit.ac.in",
      "22053259@kiit.ac.in",
      "22053260@kiit.ac.in",
      "22053266@kiit.ac.in",
      "22053269@kiit.ac.in",
      "22053271@kiit.ac.in",
      "22053272@kiit.ac.in",
      "22053274@kiit.ac.in",
      "22053278@kiit.ac.in",
      "22053280@kiit.ac.in",
      "22053281@kiit.ac.in",
      "22053283@kiit.ac.in",
      "22053284@kiit.ac.in",
      "22053289@kiit.ac.in",
      "22053293@kiit.ac.in",
      "22053297@kiit.ac.in",
      "22053301@kiit.ac.in",
      "22053304@kiit.ac.in",
      "22053308@kiit.ac.in",
      "22053311@kiit.ac.in",
      "22053312@kiit.ac.in",
      "22053315@kiit.ac.in",
      "22053321@kiit.ac.in",
      "22053322@kiit.ac.in",
      "22053323@kiit.ac.in",
      "22053324@kiit.ac.in",
      "22053326@kiit.ac.in",
      "22053331@kiit.ac.in",
      "22053332@kiit.ac.in",
      "22053335@kiit.ac.in",
      "22053346@kiit.ac.in",
      "22053348@kiit.ac.in",
      "22053349@kiit.ac.in",
      "22053352@kiit.ac.in",
      "22053353@kiit.ac.in",
      "22053354@kiit.ac.in",
      "22053355@kiit.ac.in",
      "22053356@kiit.ac.in",
      "22053357@kiit.ac.in",
      "22053358@kiit.ac.in",
      "22053359@kiit.ac.in",
      "22053360@kiit.ac.in",
      "22053362@kiit.ac.in",
      "22053363@kiit.ac.in",
      "22053368@kiit.ac.in",
      "22053369@kiit.ac.in",
      "22053375@kiit.ac.in",
      "22053387@kiit.ac.in",
      "22053388@kiit.ac.in",
      "22053390@kiit.ac.in",
      "22053392@kiit.ac.in",
      "22053395@kiit.ac.in",
      "22053396@kiit.ac.in",
      "22053402@kiit.ac.in",
      "22053403@kiit.ac.in",
      "22053409@kiit.ac.in",
      "22053411@kiit.ac.in",
      "22053412@kiit.ac.in",
      "22053418@kiit.ac.in",
      "22053423@kiit.ac.in",
      "22053424@kiit.ac.in",
      "22053431@kiit.ac.in",
      "22053433@kiit.ac.in",
      "22053434@kiit.ac.in",
      "22053441@kiit.ac.in",
      "22053443@kiit.ac.in",
      "22053444@kiit.ac.in",
      "22053447@kiit.ac.in",
      "22053450@kiit.ac.in",
      "22053452@kiit.ac.in",
      "22053455@kiit.ac.in",
      "22053456@kiit.ac.in",
      "22053458@kiit.ac.in",
      "22053459@kiit.ac.in",
      "22053465@kiit.ac.in",
      "22053468@kiit.ac.in",
      "22053471@kiit.ac.in",
      "22053478@kiit.ac.in",
      "22053481@kiit.ac.in",
      "22053488@kiit.ac.in",
      "22053498@kiit.ac.in",
      "22053501@kiit.ac.in",
      "22053503@kiit.ac.in",
      "22053504@kiit.ac.in",
      "22053510@kiit.ac.in",
      "22053512@kiit.ac.in",
      "22053513@kiit.ac.in",
      "22053520@kiit.ac.in",
      "22053522@kiit.ac.in",
      "22053523@kiit.ac.in",
      "22053533@kiit.ac.in",
      "22053535@kiit.ac.in",
      "22053542@kiit.ac.in",
      "22053545@kiit.ac.in",
      "22053548@kiit.ac.in",
      "22053549@kiit.ac.in",
      "22053554@kiit.ac.in",
      "22053555@kiit.ac.in",
      "22053560@kiit.ac.in",
      "22053566@kiit.ac.in",
      "22053567@kiit.ac.in",
      "22053568@kiit.ac.in",
      "22053571@kiit.ac.in",
      "22053573@kiit.ac.in",
      "22053574@kiit.ac.in",
      "22053577@kiit.ac.in",
      "22053578@kiit.ac.in",
      "22053581@kiit.ac.in",
      "22053582@kiit.ac.in",
      "22053585@kiit.ac.in",
      "22053587@kiit.ac.in",
      "22053588@kiit.ac.in",
      "22053589@kiit.ac.in",
      "22053592@kiit.ac.in",
      "22053594@kiit.ac.in",
      "22053597@kiit.ac.in",
      "22053602@kiit.ac.in",
      "22053604@kiit.ac.in",
      "22053605@kiit.ac.in",
      "22053606@kiit.ac.in",
      "22053608@kiit.ac.in",
      "22053610@kiit.ac.in",
      "22053614@kiit.ac.in",
      "22053616@kiit.ac.in",
      "22053624@kiit.ac.in",
      "22053628@kiit.ac.in",
      "22053631@kiit.ac.in",
      "22053632@kiit.ac.in",
      "22053633@kiit.ac.in",
      "22053634@kiit.ac.in",
      "22053636@kiit.ac.in",
      "22053641@kiit.ac.in",
      "22053642@kiit.ac.in",
      "22053643@kiit.ac.in",
      "22053648@kiit.ac.in",
      "22053649@kiit.ac.in",
      "22053650@kiit.ac.in",
      "22053655@kiit.ac.in",
      "22053668@kiit.ac.in",
      "22053673@kiit.ac.in",
      "22053675@kiit.ac.in",
      "22053688@kiit.ac.in",
      "22053693@kiit.ac.in",
      "22053697@kiit.ac.in",
      "22053698@kiit.ac.in",
      "22053704@kiit.ac.in",
      "22053706@kiit.ac.in",
      "22053709@kiit.ac.in",
      "22053714@kiit.ac.in",
      "22053722@kiit.ac.in",
      "22053727@kiit.ac.in",
      "22053742@kiit.ac.in",
      "22053747@kiit.ac.in",
      "22053751@kiit.ac.in",
      "22053756@kiit.ac.in",
      "22053762@kiit.ac.in",
      "22053763@kiit.ac.in",
      "22053764@kiit.ac.in",
      "22053772@kiit.ac.in",
      "22053774@kiit.ac.in",
      "22053787@kiit.ac.in",
      "22053794@kiit.ac.in",
      "22053795@kiit.ac.in",
      "22053803@kiit.ac.in",
      "22053804@kiit.ac.in",
      "22053805@kiit.ac.in",
      "22053810@kiit.ac.in",
      "22053811@kiit.ac.in",
      "22053812@kiit.ac.in",
      "22053814@kiit.ac.in",
      "22053815@kiit.ac.in",
      "22053816@kiit.ac.in",
      "22053817@kiit.ac.in",
      "22053818@kiit.ac.in",
      "22053819@kiit.ac.in",
      "22053820@kiit.ac.in",
      "22053827@kiit.ac.in",
      "22053830@kiit.ac.in",
      "22053834@kiit.ac.in",
      "22053835@kiit.ac.in",
      "22053837@kiit.ac.in",
      "22053839@kiit.ac.in",
      "22053841@kiit.ac.in",
      "22053844@kiit.ac.in",
      "22053847@kiit.ac.in",
      "22053850@kiit.ac.in",
      "22053857@kiit.ac.in",
      "22053859@kiit.ac.in",
      "22053860@kiit.ac.in",
      "22053861@kiit.ac.in",
      "22053866@kiit.ac.in",
      "22053877@kiit.ac.in",
      "22053878@kiit.ac.in",
      "22053880@kiit.ac.in",
      "22053881@kiit.ac.in",
      "22053883@kiit.ac.in",
      "22053885@kiit.ac.in",
      "22053888@kiit.ac.in",
      "22053891@kiit.ac.in",
      "22053895@kiit.ac.in",
      "22053898@kiit.ac.in",
      "22053901@kiit.ac.in",
      "22053904@kiit.ac.in",
      "22053907@kiit.ac.in",
      "22053909@kiit.ac.in",
      "22053910@kiit.ac.in",
      "22053912@kiit.ac.in",
      "22053913@kiit.ac.in",
      "22053914@kiit.ac.in",
      "22053921@kiit.ac.in",
      "22053922@kiit.ac.in",
      "22053929@kiit.ac.in",
      "22053940@kiit.ac.in",
      "22053942@kiit.ac.in",
      "22053948@kiit.ac.in",
      "22053954@kiit.ac.in",
      "22053960@kiit.ac.in",
      "22053962@kiit.ac.in",
      "22053963@kiit.ac.in",
      "22053966@kiit.ac.in",
      "22053968@kiit.ac.in",
      "22053973@kiit.ac.in",
      "22053982@kiit.ac.in",
      "22053988@kiit.ac.in",
      "22053989@kiit.ac.in",
      "22053990@kiit.ac.in",
      "22054002@kiit.ac.in",
      "22054009@kiit.ac.in",
      "22054021@kiit.ac.in",
      "22054022@kiit.ac.in",
      "22054024@kiit.ac.in",
      "22054029@kiit.ac.in",
      "22054031@kiit.ac.in",
      "22054032@kiit.ac.in",
      "22054035@kiit.ac.in",
      "22054036@kiit.ac.in",
      "22054040@kiit.ac.in",
      "22054041@kiit.ac.in",
      "22054046@kiit.ac.in",
      "22054050@kiit.ac.in",
      "22054053@kiit.ac.in",
      "22054054@kiit.ac.in",
      "22054058@kiit.ac.in",
      "22054059@kiit.ac.in",
      "22054064@kiit.ac.in",
      "22054070@kiit.ac.in",
      "22054072@kiit.ac.in",
      "22054075@kiit.ac.in",
      "22054076@kiit.ac.in",
      "22054080@kiit.ac.in",
      "22054081@kiit.ac.in",
      "22054082@kiit.ac.in",
      "22054083@kiit.ac.in",
      "22054089@kiit.ac.in",
      "22054093@kiit.ac.in",
      "22054100@kiit.ac.in",
      "22054104@kiit.ac.in",
      "22054109@kiit.ac.in",
      "22054110@kiit.ac.in",
      "22054114@kiit.ac.in",
      "22054115@kiit.ac.in",
      "22054120@kiit.ac.in",
      "22054121@kiit.ac.in",
      "22054124@kiit.ac.in",
      "22054126@kiit.ac.in",
      "22054128@kiit.ac.in",
      "22054131@kiit.ac.in",
      "22054133@kiit.ac.in",
      "22054134@kiit.ac.in",
      "22054139@kiit.ac.in",
      "22054143@kiit.ac.in",
      "22054149@kiit.ac.in",
      "22054161@kiit.ac.in",
      "22054163@kiit.ac.in",
      "22054170@kiit.ac.in",
      "22054171@kiit.ac.in",
      "22054173@kiit.ac.in",
      "22054181@kiit.ac.in",
      "22054184@kiit.ac.in",
      "22054185@kiit.ac.in",
      "22054186@kiit.ac.in",
      "22054191@kiit.ac.in",
      "22054192@kiit.ac.in",
      "22054194@kiit.ac.in",
      "22054199@kiit.ac.in",
      "22054200@kiit.ac.in",
      "22054203@kiit.ac.in",
      "22054216@kiit.ac.in",
      "22054217@kiit.ac.in",
      "22054220@kiit.ac.in",
      "22054224@kiit.ac.in",
      "22054227@kiit.ac.in",
      "22054231@kiit.ac.in",
      "22054234@kiit.ac.in",
      "22054237@kiit.ac.in",
      "22054243@kiit.ac.in",
      "22054248@kiit.ac.in",
      "22054254@kiit.ac.in",
      "22054261@kiit.ac.in",
      "22054262@kiit.ac.in",
      "22054270@kiit.ac.in",
      "22054275@kiit.ac.in",
      "22054277@kiit.ac.in",
      "22054280@kiit.ac.in",
      "22054283@kiit.ac.in",
      "22054284@kiit.ac.in",
      "22054287@kiit.ac.in",
      "22054288@kiit.ac.in",
      "22054290@kiit.ac.in",
      "22054303@kiit.ac.in",
      "22054304@kiit.ac.in",
      "22054307@kiit.ac.in",
      "22054319@kiit.ac.in",
      "22054322@kiit.ac.in",
      "22054332@kiit.ac.in",
      "22054335@kiit.ac.in",
      "22054344@kiit.ac.in",
      "22054352@kiit.ac.in",
      "22054359@kiit.ac.in",
      "22054361@kiit.ac.in",
      "22054362@kiit.ac.in",
      "22054365@kiit.ac.in",
      "22054372@kiit.ac.in",
      "22054376@kiit.ac.in",
      "22054387@kiit.ac.in",
      "22054390@kiit.ac.in",
      "22054391@kiit.ac.in",
      "22054393@kiit.ac.in",
      "22054401@kiit.ac.in",
      "22054402@kiit.ac.in",
      "22054403@kiit.ac.in",
      "22054424@kiit.ac.in",
      "22054431@kiit.ac.in",
      "22054434@kiit.ac.in",
      "22054440@kiit.ac.in",
      "22054441@kiit.ac.in",
      "22054448@kiit.ac.in",
      "22054453@kiit.ac.in",
      "22054457@kiit.ac.in",
      "22054464@kiit.ac.in",
      "22054469@kiit.ac.in",
      "22054470@kiit.ac.in",
      "22054472@kiit.ac.in",
      "23057001@kiit.ac.in",
      "23057003@kiit.ac.in",
      "23057017@kiit.ac.in",
      "23057022@kiit.ac.in",
      "23057025@kiit.ac.in",
      "23057037@kiit.ac.in",
      "23057043@kiit.ac.in",
      "23057047@kiit.ac.in",
      "23057049@kiit.ac.in",
      "23057052@kiit.ac.in",
      "23057053@kiit.ac.in",
      "23057055@kiit.ac.in",
      "23057056@kiit.ac.in",
      "23057057@kiit.ac.in",
      "23057059@kiit.ac.in",
      "23057063@kiit.ac.in"
    ]

    const users12 = [


      "22053668@kiit.ac.in",
      "2206099@kiit.ac.in",
      "2206012@kiit.ac.in",
      "2229116@kiit.ac.in",
      "22053634@kiit.ac.in",
      "2228078@kiit.ac.in",
      "22052988@kiit.ac.in",
      "2205988@kiit.ac.in",
      "2205121@kiit.ac.in",
      "2206382@kiit.ac.in",
      "22052595@kiit.ac.in",
      "22052835@kiit.ac.in",
      "22051271@kiit.ac.in",
      "22051869@kiit.ac.in",
      "2206307@kiit.ac.in",
      "2206072@kiit.ac.in",
      "2206094@kiit.ac.in",
      "2228120@kiit.ac.in",
      "22053379@kiit.ac.in",
      "2228032@kiit.ac.in",
      "22052374@kiit.ac.in",
      "2228007@kiit.ac.in",
      "22052109@kiit.ac.in",
      "22052061@kiit.ac.in",
      "22053693@kiit.ac.in",
      "22052979@kiit.ac.in",
      "2205625@kiit.ac.in",
      "2228150@kiit.ac.in",
      "2206111@kiit.ac.in",
      "2229009@kiit.ac.in",
      "22051349@kiit.ac.in",
      "2206110@kiit.ac.in",
      "2229093@kiit.ac.in",
      "2205602@kiit.ac.in",
      "22054246@kiit.ac.in",
      "22051437@kiit.ac.in",
      "22051843@kiit.ac.in",
      "22052996@kiit.ac.in",
      "22052267@kiit.ac.in",
      "22052709@kiit.ac.in",
      "22053343@kiit.ac.in",
      "22053908@kiit.ac.in",
      "2206131@kiit.ac.in",
      "22052564@kiit.ac.in",
      "22052260@kiit.ac.in",
      "22052949@kiit.ac.in",
      "22051631@kiit.ac.in",
      "2205314@kiit.ac.in",
      "22053289@kiit.ac.in",
      "22051617@kiit.ac.in",
      "22054223@kiit.ac.in",
      "22052869@kiit.ac.in",
      "22052537@kiit.ac.in",
      "2206129@kiit.ac.in",
      "22053355@kiit.ac.in",
      "22053893@kiit.ac.in",
      "22053539@kiit.ac.in",
      "22053466@kiit.ac.in",
      "22051400@kiit.ac.in",
      "22053315@kiit.ac.in",
      "22052279@kiit.ac.in",
      "22052264@kiit.ac.in",
      "22052329@kiit.ac.in",
      "22052333@kiit.ac.in",
      "2206214@kiit.ac.in",
      "22051888@kiit.ac.in",
      "22052935@kiit.ac.in",
      "22052955@kiit.ac.in",
      "2206324@kiit.ac.in",
      "2205686@kiit.ac.in",
      "22052925@kiit.ac.in",
      "22053968@kiit.ac.in",
      "22052549@kiit.ac.in",
      "2205973@kiit.ac.in",
      "22052601@kiit.ac.in",
      "2206202@kiit.ac.in",
      "22052062@kiit.ac.in",
      "22053189@kiit.ac.in",
      "22053488@kiit.ac.in",
      "22053633@kiit.ac.in",
      "22052485@kiit.ac.in",
      "22051859@kiit.ac.in",
      "22052675@kiit.ac.in",
      "2206015@kiit.ac.in",
      "2206265@kiit.ac.in",
      "22052938@kiit.ac.in",
      "2206043@kiit.ac.in",
      "2206219@kiit.ac.in",
      "22053698@kiit.ac.in",
      "22053875@kiit.ac.in",
      "22051567@kiit.ac.in",
      "22051402@kiit.ac.in",
      "22053236@kiit.ac.in",
      "2205138@kiit.ac.in",
      "2206162@kiit.ac.in",
      "22051994@kiit.ac.in",
      "22052980@kiit.ac.in",
      "2206269@kiit.ac.in",
      "22052688@kiit.ac.in",
      "2205144@kiit.ac.in",
      "22053091@kiit.ac.in",
      "22051603@kiit.ac.in",
      "22052006@kiit.ac.in",
      "22051262@kiit.ac.in",
      "22054169@kiit.ac.in",
      "22051818@kiit.ac.in",
      "22051839@kiit.ac.in",
      "2228047@kiit.ac.in",
      "2206122@kiit.ac.in",
      "2205859@kiit.ac.in",
      "2229018@kiit.ac.in",
      "22052005@kiit.ac.in",
      "22052557@kiit.ac.in",
      "2205014@kiit.ac.in",
      "2229072@kiit.ac.in",
      "22053522@kiit.ac.in",
      "22053508@kiit.ac.in",
      "2206329@kiit.ac.in",
      "22053140@kiit.ac.in",
      "2205289@kiit.ac.in",
      "22051410@kiit.ac.in",
      "2229006@kiit.ac.in",
      "22053193@kiit.ac.in",
      "2206232@kiit.ac.in",
      "2206066@kiit.ac.in",
      "22053992@kiit.ac.in",
      "22052966@kiit.ac.in",
      "22052017@kiit.ac.in",
      "22052952@kiit.ac.in",
      "22052105@kiit.ac.in",
      "2205641@kiit.ac.in",
      "22054136@kiit.ac.in",
      "2228180@kiit.ac.in",
      "2206036@kiit.ac.in",
      "2205980@kiit.ac.in",
      "2205068@kiit.ac.in",
      "2228006@kiit.ac.in",
      "2205282@kiit.ac.in",
      "22052816@kiit.ac.in",
      "22054165@kiit.ac.in",
      "22052218@kiit.ac.in",
      "2205323@kiit.ac.in",
      "22052194@kiit.ac.in",
      "22053112@kiit.ac.in",
      "22052686@kiit.ac.in",
      "2205200@kiit.ac.in",
      "22052856@kiit.ac.in",
      "22053824@kiit.ac.in",
      "22054164@kiit.ac.in",
      "22052398@kiit.ac.in",
      "22053565@kiit.ac.in",
      "22053730@kiit.ac.in",
      "22052049@kiit.ac.in",
      "22051033@kiit.ac.in",
      "22051763@kiit.ac.in",
      "22052965@kiit.ac.in",
      "22052302@kiit.ac.in",
      "22052825@kiit.ac.in",
      "22052670@kiit.ac.in",
      "22051807@kiit.ac.in",
      "22052336@kiit.ac.in",
      "22052607@kiit.ac.in",
      "22051256@kiit.ac.in",
      "22054193@kiit.ac.in",
      "22052729@kiit.ac.in",
      "22051572@kiit.ac.in",
      "22053762@kiit.ac.in",
      "22052404@kiit.ac.in",
      "22054311@kiit.ac.in",
      "22054251@kiit.ac.in",
      "22052314@kiit.ac.in",
      "22051501@kiit.ac.in",
      "22053496@kiit.ac.in",
      "22051010@kiit.ac.in",
      "22053222@kiit.ac.in",
      "22051728@kiit.ac.in",
      "22051625@kiit.ac.in",
      "2205694@kiit.ac.in",
      "22052552@kiit.ac.in",
      "2205509@kiit.ac.in",
      "2205065@kiit.ac.in",
      "22053133@kiit.ac.in",
      "22051038@kiit.ac.in",
      "22053255@kiit.ac.in",
      "22054172@kiit.ac.in",
      "22053023@kiit.ac.in",
      "22053066@kiit.ac.in",
      "22052349@kiit.ac.in",
      "2205340@kiit.ac.in",
      "22051910@kiit.ac.in",
      "2206136@kiit.ac.in",
      "22053609@kiit.ac.in",
      "22051565@kiit.ac.in",
      "22053631@kiit.ac.in",
      "22053360@kiit.ac.in",
      "22052275@kiit.ac.in",
      "22052592@kiit.ac.in",
      "22051576@kiit.ac.in",
      "22054166@kiit.ac.in",
      "22053308@kiit.ac.in",
      "22053304@kiit.ac.in",
      "22053052@kiit.ac.in",
      "22051752@kiit.ac.in",
      "2205185@kiit.ac.in",
      "22053944@kiit.ac.in",
      "2205809@kiit.ac.in",
      "2206240@kiit.ac.in",
      "22053629@kiit.ac.in",
      "22052740@kiit.ac.in",
      "2205821@kiit.ac.in",
      "2206004@kiit.ac.in",
      "22051911@kiit.ac.in",
      "22053424@kiit.ac.in",
      "22051023@kiit.ac.in",
      "2229150@kiit.ac.in",
      "22051791@kiit.ac.in",
      "2229126@kiit.ac.in",
      "22051847@kiit.ac.in",
      "2205962@kiit.ac.in",
      "22052265@kiit.ac.in",
      "22051879@kiit.ac.in",
      "22051593@kiit.ac.in",
      "22051835@kiit.ac.in",
      "22053188@kiit.ac.in",
      "22051905@kiit.ac.in",
      "2205712@kiit.ac.in",
      "22051253@kiit.ac.in",
      "22051261@kiit.ac.in",
      "22051374@kiit.ac.in",
      "22052297@kiit.ac.in",
      "2205316@kiit.ac.in",
      "22052409@kiit.ac.in",
      "22052372@kiit.ac.in",
      "2205514@kiit.ac.in",
      "22052644@kiit.ac.in",
      "22053082@kiit.ac.in",
      "22052610@kiit.ac.in",
      "22052612@kiit.ac.in",
      "22051901@kiit.ac.in",
      "2205693@kiit.ac.in",
      "22053640@kiit.ac.in",
      "22051000@kiit.ac.in",
      "22052892@kiit.ac.in",
      "22051110@kiit.ac.in",
      "22052764@kiit.ac.in",
      "2205977@kiit.ac.in",
      "22053081@kiit.ac.in",
      "2205972@kiit.ac.in",
      "22054197@kiit.ac.in",
      "22052162@kiit.ac.in",
      "22053816@kiit.ac.in",
      "22052200@kiit.ac.in",
      "22053829@kiit.ac.in",
      "22052030@kiit.ac.in",
      "22051709@kiit.ac.in",
      "22052303@kiit.ac.in",
      "2205335@kiit.ac.in",
      "22052428@kiit.ac.in",
      "22052819@kiit.ac.in",
      "22051498@kiit.ac.in",
      "2205963@kiit.ac.in",
      "22051523@kiit.ac.in",
      "22051642@kiit.ac.in",
      "22052312@kiit.ac.in",
      "22052100@kiit.ac.in",
      "22054135@kiit.ac.in",
      "2205213@kiit.ac.in",
      "22051656@kiit.ac.in",
      "22052008@kiit.ac.in",
      "22053778@kiit.ac.in",
      "22053740@kiit.ac.in",
      "2205302@kiit.ac.in",
      "22051109@kiit.ac.in",
      "2205334@kiit.ac.in",
      "2205167@kiit.ac.in",
      "2205180@kiit.ac.in",
      "22052695@kiit.ac.in",
      "22054115@kiit.ac.in",
      "22051005@kiit.ac.in",
      "22051111@kiit.ac.in",
      "22053257@kiit.ac.in",
      "22053501@kiit.ac.in",
      "2205575@kiit.ac.in",
      "22051475@kiit.ac.in",
      "22051861@kiit.ac.in",
      "22053208@kiit.ac.in",
      "2205736@kiit.ac.in",
      "22053213@kiit.ac.in",
      "2205209@kiit.ac.in",
      "2205968@kiit.ac.in",
      "22053754@kiit.ac.in",
      "22053924@kiit.ac.in",
      "22053996@kiit.ac.in",
      "22053211@kiit.ac.in",
      "22053703@kiit.ac.in",
      "2205176@kiit.ac.in",
      "22053976@kiit.ac.in",
      "2205961@kiit.ac.in",
      "22051011@kiit.ac.in",
      "22052322@kiit.ac.in",
      "2205443@kiit.ac.in",
      "22051862@kiit.ac.in",
      "2205324@kiit.ac.in",
      "22052031@kiit.ac.in",
      "22051127@kiit.ac.in",
      "2205153@kiit.ac.in",
      "2205309@kiit.ac.in",
      "22054298@kiit.ac.in",
      "22053834@kiit.ac.in",
      "22054114@kiit.ac.in",
      "2205792@kiit.ac.in",
      "2205177@kiit.ac.in",
      "22051566@kiit.ac.in",
      "22051100@kiit.ac.in",
      "22052052@kiit.ac.in",
      "2205829@kiit.ac.in",
      "2205966@kiit.ac.in",
      "2205982@kiit.ac.in",
      "22052288@kiit.ac.in",
      "22052774@kiit.ac.in",
      "2205223@kiit.ac.in",
      "22051713@kiit.ac.in",
      "22052654@kiit.ac.in",
      "22053263@kiit.ac.in",
      "22053185@kiit.ac.in",
      "2205341@kiit.ac.in",
      "22051403@kiit.ac.in",
      "2205790@kiit.ac.in",
      "2205026@kiit.ac.in",
      "22052229@kiit.ac.in",
      "2205212@kiit.ac.in",
      "22052292@kiit.ac.in",
      "2205661@kiit.ac.in",
      "22051443@kiit.ac.in",
      "22054304@kiit.ac.in",
      "22051077@kiit.ac.in",
      "22052278@kiit.ac.in",
      "2205063@kiit.ac.in",
      "22052055@kiit.ac.in",
      "22051997@kiit.ac.in",
      "22052044@kiit.ac.in",
      "22051001@kiit.ac.in",
      "22052423@kiit.ac.in",
      "22051184@kiit.ac.in",
      "22052721@kiit.ac.in",
      "22051013@kiit.ac.in",
      "22053540@kiit.ac.in",
      "2206348@kiit.ac.in",
      "22051115@kiit.ac.in",
      "22053650@kiit.ac.in",
      "22053794@kiit.ac.in",
      "2205944@kiit.ac.in",
      "22053093@kiit.ac.in",
      "2205017@kiit.ac.in",
      "22051858@kiit.ac.in",
      "22053088@kiit.ac.in",
      "2229091@kiit.ac.in",
      "22052626@kiit.ac.in",
      "22052461@kiit.ac.in",
      "22051846@kiit.ac.in",
      "22052163@kiit.ac.in",
      "22053145@kiit.ac.in",
      "2205106@kiit.ac.in",
      "22051827@kiit.ac.in",
      "22051327@kiit.ac.in",
      "2205991@kiit.ac.in",
      "2205986@kiit.ac.in",
      "22052990@kiit.ac.in",
      "22051900@kiit.ac.in",
      "2205847@kiit.ac.in",
      "2205298@kiit.ac.in",
      "22051602@kiit.ac.in",
      "22051871@kiit.ac.in",
      "22053675@kiit.ac.in",
      "22051832@kiit.ac.in",
      "22052598@kiit.ac.in",
      "22053484@kiit.ac.in",
      "2206395@kiit.ac.in",
      "22051853@kiit.ac.in",
      "2205192@kiit.ac.in",
      "22053487@kiit.ac.in",
      "2205997@kiit.ac.in",
      "2205989@kiit.ac.in",
      "22053209@kiit.ac.in",
      "22051006@kiit.ac.in",
      "22051258@kiit.ac.in",
      "22052659@kiit.ac.in",
      "22052637@kiit.ac.in",
      "22053450@kiit.ac.in",
      "22052926@kiit.ac.in",
      "22051848@kiit.ac.in",
      "22051002@kiit.ac.in",
      "22051652@kiit.ac.in",
      "22053817@kiit.ac.in",
      "22051107@kiit.ac.in",
      "22051995@kiit.ac.in",
      "22052159@kiit.ac.in",
      "22053781@kiit.ac.in",
      "22053813@kiit.ac.in",
      "22052335@kiit.ac.in",
      "22052728@kiit.ac.in",
      "22053545@kiit.ac.in",
      "22051874@kiit.ac.in",
      "22053905@kiit.ac.in",
      "22051735@kiit.ac.in",
      "22052174@kiit.ac.in",
      "22051837@kiit.ac.in",
      "22053309@kiit.ac.in",
      "22052639@kiit.ac.in",
      "2205584@kiit.ac.in",
      "22051389@kiit.ac.in",
      "22051875@kiit.ac.in",
      "22053419@kiit.ac.in",
      "22052422@kiit.ac.in",
      "22054121@kiit.ac.in",
      "22052405@kiit.ac.in",
      "22053600@kiit.ac.in",
      "22053070@kiit.ac.in",
      "2205493@kiit.ac.in",
      "22053195@kiit.ac.in",
      "2205956@kiit.ac.in",
      "22051274@kiit.ac.in",
      "22052433@kiit.ac.in",
      "22052266@kiit.ac.in",
      "2205322@kiit.ac.in",
      "22052410@kiit.ac.in",
      "22051371@kiit.ac.in",
      "22053115@kiit.ac.in",
      "2205758@kiit.ac.in",
      "22052560@kiit.ac.in",
      "22052269@kiit.ac.in",
      "22052542@kiit.ac.in",
      "22053977@kiit.ac.in",
      "22051668@kiit.ac.in",
      "22052352@kiit.ac.in",
      "22051372@kiit.ac.in",
      "2205983@kiit.ac.in",
      "22053728@kiit.ac.in",
      "2205970@kiit.ac.in",
      "22052301@kiit.ac.in",
      "22051008@kiit.ac.in",
      "2205653@kiit.ac.in",
      "22052330@kiit.ac.in",
      "22051828@kiit.ac.in",
      "2205964@kiit.ac.in",
      "22053206@kiit.ac.in",
      "22054198@kiit.ac.in",
      "2205720@kiit.ac.in",
      "22051004@kiit.ac.in",
      "22052299@kiit.ac.in",
      "22052455@kiit.ac.in",
      "2205730@kiit.ac.in",
      "22051502@kiit.ac.in",
      "22051399@kiit.ac.in",
      "22051605@kiit.ac.in",
      "22052505@kiit.ac.in",
      "22051840@kiit.ac.in",
      "22052414@kiit.ac.in",
      "2205969@kiit.ac.in",
      "2205726@kiit.ac.in",
      "2205489@kiit.ac.in",
      "22051804@kiit.ac.in",
      "22054191@kiit.ac.in",
      "2228015@kiit.ac.in",
      "22053902@kiit.ac.in",
      "22052702@kiit.ac.in",
      "22052035@kiit.ac.in",
      "22051114@kiit.ac.in",
      "22052263@kiit.ac.in",
      "22052725@kiit.ac.in",
      "22052565@kiit.ac.in",
      "22053159@kiit.ac.in",
      "2205750@kiit.ac.in",
      "22052059@kiit.ac.in",
      "22051753@kiit.ac.in",
      "2205064@kiit.ac.in",
      "22052283@kiit.ac.in",
      "22051747@kiit.ac.in",
      "22051883@kiit.ac.in",
      "2205476@kiit.ac.in",
      "22051489@kiit.ac.in",
      "22052536@kiit.ac.in",
      "2205959@kiit.ac.in",
      "2205158@kiit.ac.in",
      "22052126@kiit.ac.in",
      "22052429@kiit.ac.in",
      "2205149@kiit.ac.in",
      "22052467@kiit.ac.in",
      "22053349@kiit.ac.in",
      "2205657@kiit.ac.in",
      "22053672@kiit.ac.in",
      "22053155@kiit.ac.in",
      "2205015@kiit.ac.in",
      "22051586@kiit.ac.in",
      "22052024@kiit.ac.in",
      "2205308@kiit.ac.in",
      "22051521@kiit.ac.in",
      "22054213@kiit.ac.in",
      "22051908@kiit.ac.in",
      "22053391@kiit.ac.in",
      "22052545@kiit.ac.in",
      "22052363@kiit.ac.in",
      "2228148@kiit.ac.in",
      "2205201@kiit.ac.in",
      "22053866@kiit.ac.in",
      "22051326@kiit.ac.in",
      "22053547@kiit.ac.in",
      "22052343@kiit.ac.in",
      "22053706@kiit.ac.in",
      "2205540@kiit.ac.in",
      "2206128@kiit.ac.in",
      "22051633@kiit.ac.in",
      "2205780@kiit.ac.in",
      "2206217@kiit.ac.in",
      "2206005@kiit.ac.in",
      "22054245@kiit.ac.in",
      "2205985@kiit.ac.in",
      "2229052@kiit.ac.in",
      "22053795@kiit.ac.in",
      "2206338@kiit.ac.in",
      "22053334@kiit.ac.in",
      "2206148@kiit.ac.in",
      "2228061@kiit.ac.in",
      "2205920@kiit.ac.in",
      "22053700@kiit.ac.in",
      "22054183@kiit.ac.in",
      "2205189@kiit.ac.in",
      "22053673@kiit.ac.in",
      "22052147@kiit.ac.in",
      "2205313@kiit.ac.in",
      "22051108@kiit.ac.in",
      "22053922@kiit.ac.in",
      "22051303@kiit.ac.in",
      "2205550@kiit.ac.in",
      "22052273@kiit.ac.in",
      "2228095@kiit.ac.in",
      "22053752@kiit.ac.in",
      "22053685@kiit.ac.in",
      "2205132@kiit.ac.in",
      "2205300@kiit.ac.in",
      "2229114@kiit.ac.in",
      "22051655@kiit.ac.in",
      "2205621@kiit.ac.in",
      "22052588@kiit.ac.in",
      "22052969@kiit.ac.in",
      "2206141@kiit.ac.in",
      "2205967@kiit.ac.in",
      "22054194@kiit.ac.in",
      "22053939@kiit.ac.in",
      "2205199@kiit.ac.in",
      "22051273@kiit.ac.in",
      "2205947@kiit.ac.in",
      "2206064@kiit.ac.in",
      "2205215@kiit.ac.in",
      "2229090@kiit.ac.in",
      "22053827@kiit.ac.in",
      "22051106@kiit.ac.in",
      "2206305@kiit.ac.in",
      "22052207@kiit.ac.in",
      "22052272@kiit.ac.in",
      "2205709@kiit.ac.in",
      "2205931@kiit.ac.in",
      "22053120@kiit.ac.in",
      "2206053@kiit.ac.in",
      "2205082@kiit.ac.in",
      "22054124@kiit.ac.in",
      "2206130@kiit.ac.in",
      "2206236@kiit.ac.in",
      "22051235@kiit.ac.in",
      "2206008@kiit.ac.in",
      "22052458@kiit.ac.in",
      "2228158@kiit.ac.in",
      "2229064@kiit.ac.in",
      "2206125@kiit.ac.in",
      "22051486@kiit.ac.in",
      "2205799@kiit.ac.in",
      "22051551@kiit.ac.in",
      "2229119@kiit.ac.in",
      "2229051@kiit.ac.in",
      "22054220@kiit.ac.in",
      "2228013@kiit.ac.in",
      "2229038@kiit.ac.in",
      "22054002@kiit.ac.in",
      "22052690@kiit.ac.in",
      "22052672@kiit.ac.in",
      "22053717@kiit.ac.in",
      "22052134@kiit.ac.in",
      "2206249@kiit.ac.in",
      "2206312@kiit.ac.in",
      "2228039@kiit.ac.in",
      "22053881@kiit.ac.in",
      "22052102@kiit.ac.in",
      "2205130@kiit.ac.in",
      "2205735@kiit.ac.in",
      "22054453@kiit.ac.in",
      "22053348@kiit.ac.in",
      "2206372@kiit.ac.in",
      "22053121@kiit.ac.in",
      "2206319@kiit.ac.in",
      "22052094@kiit.ac.in",
      "22053401@kiit.ac.in",
      "22053241@kiit.ac.in",
      "22052131@kiit.ac.in",
      "2205812@kiit.ac.in",
      "2205241@kiit.ac.in",
      "2229176@kiit.ac.in",
      "22053009@kiit.ac.in",
      "22052947@kiit.ac.in",
      "22052795@kiit.ac.in",
      "2228115@kiit.ac.in",
      "2205246@kiit.ac.in",
      "2205211@kiit.ac.in",
      "22053332@kiit.ac.in",
      "2206159@kiit.ac.in",
      "2229024@kiit.ac.in",
      "22052954@kiit.ac.in",
      "2205453@kiit.ac.in",
      "22052417@kiit.ac.in",
      "22052568@kiit.ac.in",
      "2206286@kiit.ac.in",
      "2206275@kiit.ac.in",
      "22052801@kiit.ac.in",
      "2205243@kiit.ac.in",
      "2206118@kiit.ac.in",
      "22051445@kiit.ac.in",
      "22053125@kiit.ac.in",
      "22053358@kiit.ac.in",
      "2206272@kiit.ac.in",
      "22051564@kiit.ac.in",
      "2205238@kiit.ac.in",
      "2229076@kiit.ac.in",
      "2228154@kiit.ac.in",
      "22053555@kiit.ac.in",
      "22054109@kiit.ac.in",
      "22053298@kiit.ac.in",
      "2228081@kiit.ac.in",
      "22054247@kiit.ac.in",
      "2206253@kiit.ac.in",
      "2206210@kiit.ac.in",
      "22053980@kiit.ac.in",
      "22051446@kiit.ac.in",
      "2206261@kiit.ac.in",
      "2206181@kiit.ac.in",
      "22052469@kiit.ac.in",
      "22052140@kiit.ac.in",
      "22051720@kiit.ac.in",
      "22051678@kiit.ac.in",
      "22052937@kiit.ac.in",
      "2206119@kiit.ac.in",
      "22051306@kiit.ac.in",
      "22052089@kiit.ac.in",
      "2206358@kiit.ac.in",
      "2228003@kiit.ac.in",
      "22052523@kiit.ac.in",
      "22052891@kiit.ac.in",
      "22053718@kiit.ac.in",
      "2206274@kiit.ac.in",
      "22053395@kiit.ac.in",
      "22052960@kiit.ac.in",
      "22053445@kiit.ac.in",
      "2206184@kiit.ac.in",
      "22052823@kiit.ac.in",
      "22051442@kiit.ac.in",
      "2206105@kiit.ac.in",
      "22052010@kiit.ac.in",
      "22053971@kiit.ac.in",
      "22052106@kiit.ac.in",
      "2205222@kiit.ac.in",
      "22053985@kiit.ac.in",
      "2206039@kiit.ac.in",
      "2229037@kiit.ac.in",
      "2206013@kiit.ac.in",
      "22052936@kiit.ac.in",
      "2205230@kiit.ac.in",
      "22053952@kiit.ac.in",
      "22053276@kiit.ac.in",
      "22052693@kiit.ac.in",
      "22051712@kiit.ac.in",
      "2205855@kiit.ac.in",
      "22051473@kiit.ac.in",
      "2206263@kiit.ac.in",
      "22052270@kiit.ac.in",
      "22051597@kiit.ac.in",
      "2205456@kiit.ac.in",
      "2205825@kiit.ac.in",
      "22052439@kiit.ac.in",
      "2228045@kiit.ac.in",
      "22053550@kiit.ac.in",
      "2206209@kiit.ac.in",
      "2206235@kiit.ac.in",
      "22053711@kiit.ac.in",
      "22053988@kiit.ac.in",
      "22052934@kiit.ac.in",
      "22052842@kiit.ac.in",
      "22053491@kiit.ac.in",
      "22053898@kiit.ac.in",
      "22053776@kiit.ac.in",
      "22052730@kiit.ac.in",
      "22053658@kiit.ac.in",
      "22052427@kiit.ac.in",
      "2206257@kiit.ac.in",
      "22051737@kiit.ac.in",
      "22051841@kiit.ac.in",
      "2205710@kiit.ac.in",
      "22051561@kiit.ac.in",
      "22052039@kiit.ac.in",
      "22053204@kiit.ac.in",
      "22052391@kiit.ac.in",
      "2206174@kiit.ac.in",
      "2228094@kiit.ac.in",
      "22052582@kiit.ac.in",
      "2205704@kiit.ac.in",
      "22053512@kiit.ac.in",
      "22051378@kiit.ac.in",
      "2205732@kiit.ac.in",
      "2205163@kiit.ac.in",
      "22051247@kiit.ac.in",
      "22051348@kiit.ac.in",
      "22051684@kiit.ac.in",
      "22051639@kiit.ac.in",
      "22051535@kiit.ac.in",
      "22051604@kiit.ac.in",
      "2206316@kiit.ac.in",
      "22051583@kiit.ac.in",
      "22053704@kiit.ac.in",
      "2206048@kiit.ac.in",
      "22052951@kiit.ac.in",
      "22052486@kiit.ac.in",
      "22052923@kiit.ac.in",
      "22052047@kiit.ac.in",
      "22053267@kiit.ac.in",
      "22053825@kiit.ac.in",
      "2205865@kiit.ac.in",
      "2205242@kiit.ac.in",
      "22052811@kiit.ac.in",
      "22051337@kiit.ac.in",
      "22053975@kiit.ac.in",
      "22054426@kiit.ac.in",
      "22052449@kiit.ac.in",
      "22052939@kiit.ac.in",
      "22053105@kiit.ac.in",
      "22051320@kiit.ac.in",
      "22053356@kiit.ac.in",
      "2205569@kiit.ac.in",
      "22052914@kiit.ac.in",
      "22051653@kiit.ac.in",
      "22053831@kiit.ac.in",
      "22053901@kiit.ac.in",
      "22053994@kiit.ac.in",
      "22052799@kiit.ac.in",
      "22051350@kiit.ac.in",
      "22052804@kiit.ac.in",
      "2206255@kiit.ac.in",
      "22052791@kiit.ac.in",
      "22053664@kiit.ac.in",
      "22053104@kiit.ac.in",
      "2228116@kiit.ac.in",
      "22051482@kiit.ac.in",
      "2205253@kiit.ac.in",
      "22051453@kiit.ac.in",
      "22052173@kiit.ac.in",
      "22051809@kiit.ac.in",
      "22052481@kiit.ac.in",
      "22054157@kiit.ac.in",
      "2228155@kiit.ac.in",
      "22053106@kiit.ac.in",
      "2206006@kiit.ac.in",
      "22053687@kiit.ac.in",
      "2205447@kiit.ac.in",
      "22054249@kiit.ac.in",
      "22053320@kiit.ac.in",
      "22053247@kiit.ac.in",
      "22051508@kiit.ac.in",
      "22052832@kiit.ac.in",
      "22053709@kiit.ac.in",
      "2205084@kiit.ac.in",
      "2229092@kiit.ac.in",
      "2206317@kiit.ac.in",
      "22052577@kiit.ac.in",
      "22051440@kiit.ac.in",
      "22051354@kiit.ac.in",
      "22051510@kiit.ac.in",
      "22053676@kiit.ac.in",
      "22052538@kiit.ac.in",
      "22053822@kiit.ac.in",
      "2206070@kiit.ac.in",
      "2205048@kiit.ac.in",
      "22052539@kiit.ac.in",
      "22053406@kiit.ac.in",
      "22053244@kiit.ac.in",
      "22053818@kiit.ac.in",
      "22052271@kiit.ac.in",
      "2229059@kiit.ac.in",
      "22051322@kiit.ac.in",
      "22052129@kiit.ac.in",
      "22053652@kiit.ac.in",
      "22053098@kiit.ac.in",
      "22053819@kiit.ac.in",
      "2206258@kiit.ac.in",
      "22052942@kiit.ac.in",
      "22053231@kiit.ac.in",
      "22052019@kiit.ac.in",
      "22051317@kiit.ac.in",
      "22053558@kiit.ac.in",
      "22052786@kiit.ac.in",
      "22052464@kiit.ac.in",
      "2206285@kiit.ac.in",
      "22053353@kiit.ac.in",
      "2205772@kiit.ac.in",
      "22053826@kiit.ac.in",
      "22052810@kiit.ac.in",
      "22054301@kiit.ac.in",
      "22052069@kiit.ac.in",
      "22052812@kiit.ac.in",
      "22052802@kiit.ac.in",
      "2206243@kiit.ac.in",
      "22053370@kiit.ac.in",
      "22054134@kiit.ac.in",
      "2205604@kiit.ac.in",
      "22053669@kiit.ac.in",
      "2205439@kiit.ac.in",
      "22053428@kiit.ac.in",
      "2205955@kiit.ac.in",
      "2205445@kiit.ac.in",
      "22052826@kiit.ac.in",
      "22051358@kiit.ac.in",
      "2205728@kiit.ac.in",
      "22052460@kiit.ac.in",
      "2229112@kiit.ac.in",
      "2205562@kiit.ac.in",
      "2205450@kiit.ac.in",
      "22053654@kiit.ac.in",
      "22052788@kiit.ac.in",
      "2206361@kiit.ac.in",
      "22053238@kiit.ac.in",
      "2206127@kiit.ac.in",
      "2205217@kiit.ac.in",
      "22053699@kiit.ac.in",
      "22052606@kiit.ac.in",
      "22052928@kiit.ac.in",
      "22051334@kiit.ac.in",
      "22051330@kiit.ac.in",
      "2205824@kiit.ac.in",
      "2206003@kiit.ac.in",
      "22052817@kiit.ac.in",
      "2206242@kiit.ac.in",
      "2205085@kiit.ac.in",
      "22054192@kiit.ac.in",
      "22051454@kiit.ac.in",
      "22051452@kiit.ac.in",
      "22052808@kiit.ac.in",
      "22051451@kiit.ac.in",
      "22053973@kiit.ac.in",
      "2205114@kiit.ac.in",
      "2205557@kiit.ac.in",
      "2205564@kiit.ac.in",
      "22052435@kiit.ac.in",
      "22052034@kiit.ac.in",
      "22052800@kiit.ac.in",
      "22053928@kiit.ac.in",
      "2205055@kiit.ac.in",
      "2205636@kiit.ac.in",
      "22052240@kiit.ac.in",
      "22052830@kiit.ac.in",
      "22053449@kiit.ac.in",
      "22053249@kiit.ac.in",
      "22052579@kiit.ac.in",
      "22052945@kiit.ac.in",
      "2205160@kiit.ac.in",
      "22052820@kiit.ac.in",
      "22052793@kiit.ac.in",
      "2206283@kiit.ac.in",
      "22052814@kiit.ac.in",
      "22051310@kiit.ac.in",
      "22053967@kiit.ac.in",
      "2205172@kiit.ac.in",
      "22052946@kiit.ac.in",
      "22052933@kiit.ac.in",
      "22052815@kiit.ac.in",
      "22052004@kiit.ac.in",
      "2206396@kiit.ac.in",
      "2205225@kiit.ac.in",
      "22053275@kiit.ac.in",
      "22053405@kiit.ac.in",
      "22052796@kiit.ac.in",
      "22052452@kiit.ac.in",
      "2205714@kiit.ac.in",
      "22053755@kiit.ac.in",
      "22052948@kiit.ac.in",
      "22054305@kiit.ac.in",
      "22053674@kiit.ac.in",
      "2205455@kiit.ac.in",
      "2205840@kiit.ac.in",
      "22052803@kiit.ac.in",
      "2205610@kiit.ac.in",
      "2205548@kiit.ac.in",
      "22051722@kiit.ac.in",
      "22052470@kiit.ac.in",
      "22051335@kiit.ac.in",
      "22052797@kiit.ac.in",
      "22052220@kiit.ac.in",
      "2228035@kiit.ac.in",
      "22052968@kiit.ac.in",
      "2205454@kiit.ac.in",
      "22052833@kiit.ac.in",
      "22052829@kiit.ac.in",
      "22052064@kiit.ac.in",
      "2205800@kiit.ac.in",
      "22053111@kiit.ac.in",
      "22051397@kiit.ac.in",
      "2205556@kiit.ac.in",
      "2206143@kiit.ac.in",
      "22051700@kiit.ac.in",
      "22053248@kiit.ac.in",
      "22052932@kiit.ac.in",
      "22053262@kiit.ac.in",
      "22053864@kiit.ac.in",
      "2229144@kiit.ac.in",
      "22054159@kiit.ac.in",
      "22051471@kiit.ac.in",
      "22052063@kiit.ac.in",
      "2205786@kiit.ac.in",
      "2228087@kiit.ac.in",
      "2228101@kiit.ac.in",
      "22053713@kiit.ac.in",
      "22051686@kiit.ac.in",
      "22053946@kiit.ac.in",
      "22051677@kiit.ac.in",
      "22054225@kiit.ac.in",
      "22052562@kiit.ac.in",
      "2206256@kiit.ac.in",
      "2206040@kiit.ac.in",
      "22052921@kiit.ac.in",
      "22052922@kiit.ac.in",
      "2205120@kiit.ac.in",
      "22054185@kiit.ac.in",
      "22052927@kiit.ac.in",
      "2206244@kiit.ac.in",
      "22052824@kiit.ac.in",
      "2229132@kiit.ac.in",
      "22053760@kiit.ac.in",
      "2205762@kiit.ac.in",
      "22052480@kiit.ac.in",
      "22053223@kiit.ac.in",
      "2205815@kiit.ac.in",
      "22052447@kiit.ac.in",
      "22052451@kiit.ac.in",
      "22053765@kiit.ac.in",
      "22053766@kiit.ac.in",
      "2205932@kiit.ac.in",
      "22052014@kiit.ac.in",
      "22052590@kiit.ac.in",
      "22052794@kiit.ac.in",
      "2205128@kiit.ac.in",
      "22052450@kiit.ac.in",
      "2229088@kiit.ac.in",
      "22053015@kiit.ac.in",
      "22053891@kiit.ac.in",
      "22052904@kiit.ac.in",
      "22053396@kiit.ac.in",
      "22053763@kiit.ac.in",
      "22053759@kiit.ac.in",
      "22052081@kiit.ac.in",
      "2205001@kiit.ac.in",
      "22052889@kiit.ac.in",
      "22053943@kiit.ac.in",
      "22053366@kiit.ac.in",
      "22053808@kiit.ac.in",
      "22052918@kiit.ac.in",
      "2205776@kiit.ac.in",
      "22053925@kiit.ac.in",
      "22051470@kiit.ac.in",
      "2205077@kiit.ac.in",
      "22053941@kiit.ac.in",
      "22051455@kiit.ac.in",
      "2205110@kiit.ac.in",
      "22052023@kiit.ac.in",
      "2205616@kiit.ac.in",
      "22053036@kiit.ac.in",
      "2228127@kiit.ac.in",
      "22052899@kiit.ac.in",
      "22053032@kiit.ac.in",
      "22052013@kiit.ac.in",
      "22052041@kiit.ac.in",
      "22053019@kiit.ac.in",
      "2205609@kiit.ac.in",
      "22053443@kiit.ac.in",
      "2229146@kiit.ac.in",
      "2228031@kiit.ac.in",
      "2205813@kiit.ac.in",
      "22053745@kiit.ac.in",
      "22053312@kiit.ac.in",
      "22052872@kiit.ac.in",
      "22053007@kiit.ac.in",
      "2205578@kiit.ac.in",
      "22053758@kiit.ac.in",
      "22053235@kiit.ac.in",
      "22052874@kiit.ac.in",
      "2228100@kiit.ac.in",
      "2205440@kiit.ac.in",
      "2205834@kiit.ac.in",
      "22051315@kiit.ac.in",
      "22052046@kiit.ac.in",
      "22053313@kiit.ac.in",
      "2206267@kiit.ac.in",
      "22051690@kiit.ac.in",
      "22053034@kiit.ac.in",
      "22052018@kiit.ac.in",
      "22051441@kiit.ac.in",
      "22052032@kiit.ac.in",
      "2205592@kiit.ac.in",
      "2228034@kiit.ac.in",
      "2205442@kiit.ac.in",
      "22052444@kiit.ac.in",
      "2206076@kiit.ac.in",
      "22051328@kiit.ac.in",
      "22054397@kiit.ac.in",
      "22052002@kiit.ac.in",
      "22053041@kiit.ac.in",
      "2228018@kiit.ac.in",
      "22054218@kiit.ac.in",
      "2206273@kiit.ac.in",
      "22051357@kiit.ac.in",
      "22053305@kiit.ac.in",
      "22051435@kiit.ac.in",
      "22052009@kiit.ac.in",
      "2205793@kiit.ac.in",
      "22052076@kiit.ac.in",
      "22052885@kiit.ac.in",
      "22051351@kiit.ac.in",
      "22053953@kiit.ac.in",
      "2205811@kiit.ac.in",
      "2205208@kiit.ac.in",
      "22053033@kiit.ac.in",
      "22053806@kiit.ac.in",
      "22052880@kiit.ac.in",
      "22053025@kiit.ac.in",
      "22052057@kiit.ac.in",
      "22052575@kiit.ac.in",
      "22053337@kiit.ac.in",
      "22051563@kiit.ac.in",
      "22052583@kiit.ac.in",
      "22052466@kiit.ac.in",
      "22053903@kiit.ac.in",
      "2205937@kiit.ac.in",
      "22052876@kiit.ac.in",
      "22052909@kiit.ac.in",
      "22053147@kiit.ac.in",
      "22052897@kiit.ac.in",
      "22052580@kiit.ac.in",
      "2206034@kiit.ac.in",
      "22051324@kiit.ac.in",
      "22053357@kiit.ac.in",
      "22053042@kiit.ac.in",
      "22051343@kiit.ac.in",
      "22051464@kiit.ac.in",
      "2229189@kiit.ac.in",
      "22053317@kiit.ac.in",
      "22051307@kiit.ac.in",
      "2229069@kiit.ac.in",
      "22053328@kiit.ac.in",
      "22052986@kiit.ac.in",
      "22052901@kiit.ac.in",
      "22051465@kiit.ac.in",
      "22053422@kiit.ac.in",
      "2206103@kiit.ac.in",
      "22052121@kiit.ac.in",
      "22052883@kiit.ac.in",
      "22053931@kiit.ac.in",
      "2206289@kiit.ac.in",
      "22053431@kiit.ac.in",
      "2206077@kiit.ac.in",
      "2205795@kiit.ac.in",
      "22053804@kiit.ac.in",
      "22052148@kiit.ac.in",
      "22054174@kiit.ac.in",
      "22051332@kiit.ac.in",
      "22053037@kiit.ac.in",
      "22051339@kiit.ac.in",
      "2229044@kiit.ac.in",
      "2206295@kiit.ac.in",
      "22051355@kiit.ac.in",
      "22053040@kiit.ac.in",
      "22052888@kiit.ac.in",
      "2205746@kiit.ac.in",
      "2205571@kiit.ac.in",
      "22053784@kiit.ac.in",
      "22051542@kiit.ac.in",
      "22051331@kiit.ac.in",
      "22053852@kiit.ac.in",
      "2229041@kiit.ac.in",
      "22052572@kiit.ac.in",
      "22052098@kiit.ac.in",
      "2228083@kiit.ac.in",
      "22052906@kiit.ac.in",
      "2205437@kiit.ac.in",
      "22052916@kiit.ac.in",
      "22053805@kiit.ac.in",
      "22053035@kiit.ac.in",
      "22052910@kiit.ac.in",
      "22052894@kiit.ac.in",
      "22052975@kiit.ac.in",
      "2205801@kiit.ac.in",
      "22051308@kiit.ac.in",
      "22054276@kiit.ac.in",
      "22051598@kiit.ac.in",
      "22051729@kiit.ac.in",
      "22051555@kiit.ac.in",
      "22053751@kiit.ac.in",
      "22051687@kiit.ac.in",
      "22052886@kiit.ac.in",
      "22052915@kiit.ac.in",
      "2205156@kiit.ac.in",
      "22051336@kiit.ac.in",
      "22053954@kiit.ac.in",
      "22053460@kiit.ac.in",
      "22053335@kiit.ac.in",
      "2229120@kiit.ac.in",
      "22051466@kiit.ac.in",
      "22053890@kiit.ac.in",
      "22052875@kiit.ac.in",
      "22053018@kiit.ac.in",
      "2205112@kiit.ac.in",
      "22052911@kiit.ac.in",
      "2229133@kiit.ac.in",
      "22051314@kiit.ac.in",
      "22052146@kiit.ac.in",
      "22052476@kiit.ac.in",
      "22051311@kiit.ac.in",
      "2205119@kiit.ac.in",
      "22051342@kiit.ac.in",
      "2205060@kiit.ac.in",
      "2205089@kiit.ac.in",
      "2206377@kiit.ac.in",
      "22052327@kiit.ac.in",
      "2205122@kiit.ac.in",
      "22053381@kiit.ac.in",
      "22052870@kiit.ac.in",
      "22051459@kiit.ac.in",
      "22051584@kiit.ac.in",
      "2206268@kiit.ac.in",
      "22052902@kiit.ac.in",
      "22052205@kiit.ac.in",
      "2205218@kiit.ac.in",
      "22052133@kiit.ac.in",
      "22051556@kiit.ac.in",
      "2229011@kiit.ac.in",
      "22053022@kiit.ac.in",
      "2228107@kiit.ac.in",
      "2228038@kiit.ac.in",
      "2205953@kiit.ac.in",
      "22054312@kiit.ac.in",
      "2206318@kiit.ac.in",
      "2228137@kiit.ac.in",
      "22051340@kiit.ac.in",
      "22052403@kiit.ac.in",
      "22053039@kiit.ac.in",
      "2206278@kiit.ac.in",
      "2206123@kiit.ac.in",
      "2205605@kiit.ac.in",
      "22053959@kiit.ac.in",
      "22053432@kiit.ac.in",
      "22053020@kiit.ac.in",
      "2206323@kiit.ac.in",
      "22052603@kiit.ac.in",
      "22052898@kiit.ac.in",
      "22053097@kiit.ac.in",
      "22051671@kiit.ac.in",
      "22051701@kiit.ac.in",
      "2206266@kiit.ac.in",
      "2205929@kiit.ac.in",
      "22053016@kiit.ac.in",
      "22052295@kiit.ac.in",
      "22052912@kiit.ac.in",
      "22052871@kiit.ac.in",
      "22053028@kiit.ac.in",
      "22052879@kiit.ac.in",
      "22053452@kiit.ac.in",
      "22052127@kiit.ac.in",
      "22053011@kiit.ac.in",
      "22051458@kiit.ac.in",
      "22052160@kiit.ac.in",
      "22051309@kiit.ac.in",
      "22052156@kiit.ac.in",
      "2206386@kiit.ac.in",
      "22054188@kiit.ac.in",
      "22053398@kiit.ac.in",
      "22053038@kiit.ac.in",
      "2205951@kiit.ac.in",
      "22053956@kiit.ac.in",
      "22052103@kiit.ac.in",
      "2205113@kiit.ac.in",
      "22051313@kiit.ac.in",
      "22053810@kiit.ac.in",
      "22051474@kiit.ac.in",
      "22051708@kiit.ac.in",
      "22052166@kiit.ac.in",
      "2205600@kiit.ac.in",
      "22052168@kiit.ac.in",
      "22052907@kiit.ac.in",
      "22052436@kiit.ac.in",
      "2205887@kiit.ac.in",
      "22053883@kiit.ac.in",
      "2205934@kiit.ac.in",
      "22052104@kiit.ac.in",
      "22053899@kiit.ac.in",
      "2205580@kiit.ac.in",
      "22052877@kiit.ac.in",
      "22051698@kiit.ac.in",
      "22054278@kiit.ac.in",
      "2205582@kiit.ac.in",
      "22052136@kiit.ac.in",
      "22052600@kiit.ac.in",
      "22053030@kiit.ac.in",
      "22053026@kiit.ac.in",
      "22053935@kiit.ac.in",
      "22053791@kiit.ac.in",
      "22053027@kiit.ac.in",
      "2205579@kiit.ac.in",
      "22053008@kiit.ac.in",
      "22052587@kiit.ac.in",
      "2205779@kiit.ac.in",
      "22053229@kiit.ac.in",
      "22053757@kiit.ac.in",
      "22053336@kiit.ac.in",
      "22052881@kiit.ac.in",
      "22054125@kiit.ac.in",
      "2205203@kiit.ac.in",
      "22052913@kiit.ac.in",
      "22053981@kiit.ac.in",
      "22051580@kiit.ac.in",
      "22052687@kiit.ac.in",
      "22053465@kiit.ac.in",
      "22052298@kiit.ac.in",
      "2205565@kiit.ac.in",
      "22054061@kiit.ac.in",
      "22054068@kiit.ac.in",
      "22054009@kiit.ac.in",
      "22054023@kiit.ac.in",
      "22054076@kiit.ac.in",
      "22054093@kiit.ac.in",
      "22051545@kiit.ac.in",
      "2205131@kiit.ac.in",
      "2205660@kiit.ac.in",
      "2205561@kiit.ac.in",
      "2206084@kiit.ac.in",
      "22051255@kiit.ac.in",
      "22053109@kiit.ac.in",
      "22053094@kiit.ac.in",
      "2206173@kiit.ac.in",
      "22052445@kiit.ac.in",
      "22053797@kiit.ac.in",
      "2205195@kiit.ac.in",
      "22053344@kiit.ac.in",
      "22052680@kiit.ac.in",
      "2228161@kiit.ac.in",
      "22052908@kiit.ac.in",
      "22051413@kiit.ac.in",
      "22052242@kiit.ac.in",
      "22051319@kiit.ac.in",
      "22051632@kiit.ac.in",
      "22052209@kiit.ac.in",
      "22053413@kiit.ac.in",
      "22053444@kiit.ac.in",
      "2206335@kiit.ac.in",
      "22054156@kiit.ac.in",
      "2205555@kiit.ac.in",
      "22054308@kiit.ac.in",
      "22054154@kiit.ac.in",
      "22053997@kiit.ac.in",
      "2205216@kiit.ac.in",
      "22053789@kiit.ac.in",
      "22053889@kiit.ac.in",
      "22053858@kiit.ac.in",
      "2205567@kiit.ac.in",
      "22052328@kiit.ac.in",
      "22053441@kiit.ac.in",
      "22051734@kiit.ac.in",
      "22053876@kiit.ac.in",
      "22051540@kiit.ac.in",
      "22053793@kiit.ac.in",
      "2228026@kiit.ac.in",
      "22051732@kiit.ac.in",
      "22054046@kiit.ac.in",
      "22054062@kiit.ac.in",
      "22054040@kiit.ac.in",
      "22054041@kiit.ac.in",
      "22054058@kiit.ac.in",
      "22054072@kiit.ac.in",
      "2228178@kiit.ac.in",
      "22054084@kiit.ac.in",
      "22054024@kiit.ac.in",
      "22054074@kiit.ac.in",
      "22054073@kiit.ac.in",
      "22054020@kiit.ac.in",
      "22051805@kiit.ac.in",
      "22051803@kiit.ac.in",
      "22051359@kiit.ac.in",
      "22051731@kiit.ac.in",
      "22054117@kiit.ac.in",
      "22051533@kiit.ac.in",
      "22054222@kiit.ac.in",
      "2205024@kiit.ac.in",
      "2206021@kiit.ac.in",
      "2206029@kiit.ac.in",
      "2205030@kiit.ac.in",
      "2206404@kiit.ac.in",
      "2206187@kiit.ac.in",
      "22054137@kiit.ac.in",
      "22053454@kiit.ac.in",
      "2206192@kiit.ac.in",
      "22052249@kiit.ac.in",
      "22052199@kiit.ac.in",
      "2229061@kiit.ac.in",
      "2206407@kiit.ac.in",
      "2206011@kiit.ac.in",
      "22053477@kiit.ac.in",
      "22052180@kiit.ac.in",
      "2206315@kiit.ac.in",
      "2205018@kiit.ac.in",
      "22053417@kiit.ac.in",
      "2206349@kiit.ac.in",
      "22054167@kiit.ac.in",
      "22054214@kiit.ac.in",
      "2228141@kiit.ac.in",
      "2205769@kiit.ac.in",
      "22053556@kiit.ac.in",
      "22053475@kiit.ac.in",
      "22052227@kiit.ac.in",
      "22051618@kiit.ac.in",
      "2228102@kiit.ac.in",
      "22051664@kiit.ac.in",
      "2229079@kiit.ac.in",
      "22051654@kiit.ac.in",
      "22051666@kiit.ac.in",
      "22051401@kiit.ac.in",
      "22051511@kiit.ac.in",
      "22051692@kiit.ac.in",
      "22053835@kiit.ac.in",
      "22051516@kiit.ac.in",
      "22051404@kiit.ac.in",
      "22051341@kiit.ac.in",
      "22051595@kiit.ac.in",
      "2205036@kiit.ac.in",
      "22052215@kiit.ac.in",
      "22053860@kiit.ac.in",
      "22051249@kiit.ac.in",
      "22051575@kiit.ac.in",
      "22051723@kiit.ac.in",
      "22054152@kiit.ac.in",
      "22053857@kiit.ac.in",
      "22051529@kiit.ac.in",
      "22052216@kiit.ac.in",
      "2206177@kiit.ac.in",
      "22051634@kiit.ac.in",
      "22051746@kiit.ac.in",
      "22051356@kiit.ac.in",
      "22051733@kiit.ac.in",
      "22052231@kiit.ac.in",
      "22053378@kiit.ac.in",
      "22051548@kiit.ac.in",
      "22051360@kiit.ac.in",
      "2228132@kiit.ac.in",
      "22052245@kiit.ac.in",
      "22051396@kiit.ac.in",
      "22053958@kiit.ac.in",
      "2206332@kiit.ac.in",
      "22054201@kiit.ac.in",
      "2229139@kiit.ac.in",
      "22054120@kiit.ac.in",
      "2206415@kiit.ac.in",
      "22054118@kiit.ac.in",
      "22053455@kiit.ac.in",
      "22054133@kiit.ac.in",
      "2206175@kiit.ac.in",
      "22054131@kiit.ac.in",
      "22054389@kiit.ac.in",
      "22054128@kiit.ac.in",
      "2206374@kiit.ac.in",
      "2228164@kiit.ac.in",
      "2205939@kiit.ac.in",
      "2205620@kiit.ac.in",
      "22051346@kiit.ac.in",
      "2205109@kiit.ac.in",
      "22051619@kiit.ac.in",
      "22052210@kiit.ac.in",
      "22051730@kiit.ac.in",
      "22051640@kiit.ac.in",
      "2228025@kiit.ac.in",
      "2206402@kiit.ac.in",
      "22053965@kiit.ac.in",
      "2206416@kiit.ac.in",
      "22054211@kiit.ac.in",
      "2206417@kiit.ac.in",
      "22052250@kiit.ac.in",
      "2206333@kiit.ac.in",
      "2205154@kiit.ac.in",
      "22051611@kiit.ac.in",
      "22051506@kiit.ac.in",
      "22054244@kiit.ac.in",
      "22054094@kiit.ac.in",
      "22054262@kiit.ac.in",
      "22054034@kiit.ac.in",
      "22054054@kiit.ac.in",
      "22054080@kiit.ac.in",
      "22054110@kiit.ac.in",
      "2206369@kiit.ac.in",
      "22054408@kiit.ac.in",
      "22053983@kiit.ac.in",
      "2228170@kiit.ac.in",
      "22053982@kiit.ac.in",
      "2228117@kiit.ac.in",
      "2206408@kiit.ac.in",
      "2228169@kiit.ac.in",
      "2206397@kiit.ac.in",
      "22054049@kiit.ac.in",
      "22054044@kiit.ac.in",
      "22054052@kiit.ac.in",
      "22054007@kiit.ac.in",
      "22054014@kiit.ac.in",
      "22054036@kiit.ac.in",
      "22054048@kiit.ac.in",
      "22054083@kiit.ac.in",
      "22054053@kiit.ac.in",
      "22054042@kiit.ac.in",
      "22054067@kiit.ac.in",
      "22054022@kiit.ac.in",
      "22054016@kiit.ac.in",
      "22054056@kiit.ac.in",
      "22054051@kiit.ac.in",
      "22054008@kiit.ac.in",
      "22054155@kiit.ac.in",
      "22054187@kiit.ac.in",
      "22054097@kiit.ac.in",
      "22054098@kiit.ac.in",
      "22054064@kiit.ac.in",
      "22054013@kiit.ac.in",
      "22054066@kiit.ac.in",
      "22054085@kiit.ac.in",
      "22054081@kiit.ac.in",
      "22054037@kiit.ac.in",
      "22054089@kiit.ac.in",
      "22054091@kiit.ac.in",
      "22054057@kiit.ac.in",
      "22054095@kiit.ac.in",
      "22054082@kiit.ac.in",
      "22054075@kiit.ac.in",
      "22054005@kiit.ac.in",
      "22054047@kiit.ac.in",
      "22054019@kiit.ac.in",
      "2228171@kiit.ac.in",
      "2229201@kiit.ac.in",
      "2229202@kiit.ac.in",
      "2228172@kiit.ac.in",
      "22054200@kiit.ac.in",
      "22054100@kiit.ac.in",
      "22054104@kiit.ac.in",
      "22054106@kiit.ac.in",
      "22054108@kiit.ac.in",
      "2228167@kiit.ac.in",
      "22054243@kiit.ac.in",
      "2206410@kiit.ac.in",
      "22054242@kiit.ac.in",
      "22054239@kiit.ac.in",
      "22054237@kiit.ac.in",
      "22054236@kiit.ac.in",
      "22054235@kiit.ac.in",
      "22054233@kiit.ac.in",
      "22054231@kiit.ac.in",
      "22054230@kiit.ac.in",
      "22054229@kiit.ac.in",
      "22054228@kiit.ac.in",
      "22054227@kiit.ac.in",
      "22054248@kiit.ac.in",
      "22054252@kiit.ac.in",
      "22054253@kiit.ac.in",
      "22054254@kiit.ac.in",
      "22054255@kiit.ac.in",
      "22054256@kiit.ac.in",
      "22054263@kiit.ac.in",
      "22054264@kiit.ac.in",
      "22054265@kiit.ac.in",
      "22054266@kiit.ac.in",
      "22054267@kiit.ac.in",
      "22054268@kiit.ac.in",
      "22054269@kiit.ac.in",
      "22054270@kiit.ac.in",
      "22054271@kiit.ac.in",
      "22054279@kiit.ac.in",
      "22054281@kiit.ac.in",
      "22054284@kiit.ac.in",
      "2206412@kiit.ac.in",
      "22054285@kiit.ac.in",
      "22054286@kiit.ac.in",
      "22054288@kiit.ac.in",
      "22054289@kiit.ac.in",
      "22054290@kiit.ac.in",
      "22054291@kiit.ac.in",
      "22054292@kiit.ac.in",
      "22054293@kiit.ac.in",
      "22054294@kiit.ac.in",
      "22054342@kiit.ac.in",
      "22054348@kiit.ac.in",
      "22054332@kiit.ac.in",
      "22054330@kiit.ac.in",
      "22054329@kiit.ac.in",
      "22054327@kiit.ac.in",
      "22054326@kiit.ac.in",
      "22054324@kiit.ac.in",
      "22054323@kiit.ac.in",
      "22054322@kiit.ac.in",
      "22054321@kiit.ac.in",
      "22054320@kiit.ac.in",
      "22054318@kiit.ac.in",
      "22054395@kiit.ac.in",
      "22054396@kiit.ac.in",
      "22054335@kiit.ac.in",
      "22054337@kiit.ac.in",
      "22054339@kiit.ac.in",
      "22054340@kiit.ac.in",
      "22054341@kiit.ac.in",
      "22054343@kiit.ac.in",
      "22054344@kiit.ac.in",
      "22054345@kiit.ac.in",
      "22054346@kiit.ac.in",
      "22054347@kiit.ac.in",
      "22054350@kiit.ac.in",
      "22054352@kiit.ac.in",
      "22054353@kiit.ac.in",
      "22054355@kiit.ac.in",
      "22054357@kiit.ac.in",
      "22054358@kiit.ac.in",
      "22054360@kiit.ac.in",
      "22054361@kiit.ac.in",
      "22054362@kiit.ac.in",
      "22054363@kiit.ac.in",
      "22054364@kiit.ac.in",
      "22054365@kiit.ac.in",
      "22054366@kiit.ac.in",
      "22054368@kiit.ac.in",
      "22054370@kiit.ac.in",
      "22054371@kiit.ac.in",
      "22054372@kiit.ac.in",
      "22054373@kiit.ac.in",
      "22054374@kiit.ac.in",
      "22054375@kiit.ac.in",
      "22054376@kiit.ac.in",
      "22054377@kiit.ac.in",
      "2206418@kiit.ac.in",
      "22054380@kiit.ac.in",
      "22054381@kiit.ac.in",
      "22054382@kiit.ac.in",
      "22054384@kiit.ac.in",
      "22054385@kiit.ac.in",
      "22054386@kiit.ac.in",
      "22054388@kiit.ac.in",
      "22054390@kiit.ac.in",
      "22054393@kiit.ac.in",
      "22054400@kiit.ac.in",
      "22054401@kiit.ac.in",
      "22054402@kiit.ac.in",
      "22054403@kiit.ac.in",
      "22054405@kiit.ac.in",
      "22054407@kiit.ac.in",
      "2206419@kiit.ac.in",
      "22054410@kiit.ac.in",
      "22054411@kiit.ac.in",
      "22054412@kiit.ac.in",
      "22054413@kiit.ac.in",
      "22054414@kiit.ac.in",
      "22054415@kiit.ac.in",
      "22054417@kiit.ac.in",
      "22054418@kiit.ac.in",
      "22054419@kiit.ac.in",
      "22054421@kiit.ac.in",
      "22054422@kiit.ac.in",
      "22054423@kiit.ac.in",
      "22054428@kiit.ac.in",
      "22054430@kiit.ac.in",
      "22054432@kiit.ac.in",
      "22054433@kiit.ac.in",
      "22054434@kiit.ac.in",
      "22054435@kiit.ac.in",
      "22054437@kiit.ac.in",
      "22054438@kiit.ac.in",
      "22054439@kiit.ac.in",
      "22054440@kiit.ac.in",
      "22054441@kiit.ac.in",
      "22054442@kiit.ac.in",
      "22054443@kiit.ac.in",
      "22054445@kiit.ac.in",
      "22054447@kiit.ac.in",
      "22054449@kiit.ac.in",
      "22054450@kiit.ac.in",
      "22054454@kiit.ac.in",
      "22054455@kiit.ac.in",
      "2206424@kiit.ac.in",
      "2206425@kiit.ac.in",
      "22054458@kiit.ac.in",
      "22054459@kiit.ac.in",
      "22054460@kiit.ac.in",
      "22054461@kiit.ac.in",
      "22054462@kiit.ac.in",
      "22054467@kiit.ac.in",
      "22054468@kiit.ac.in",
      "22054469@kiit.ac.in",
      "22054470@kiit.ac.in",
      "22054472@kiit.ac.in",
      "23057015@kiit.ac.in",
      "23057016@kiit.ac.in",
      "23057058@kiit.ac.in",
      "23057056@kiit.ac.in",
      "23057010@kiit.ac.in",
      "23057047@kiit.ac.in",
      "23057011@kiit.ac.in",
      "23057029@kiit.ac.in",
      "23057020@kiit.ac.in",
      "23057039@kiit.ac.in",
      "23057009@kiit.ac.in",
      "23057005@kiit.ac.in",
      "2306601@kiit.ac.in",
      "23057004@kiit.ac.in",
      "23057048@kiit.ac.in",
      "23057052@kiit.ac.in",
      "23057024@kiit.ac.in",
      "23057013@kiit.ac.in",
      "23057014@kiit.ac.in",
      "23057026@kiit.ac.in",
      "23057007@kiit.ac.in",
      "23057001@kiit.ac.in",
      "23057045@kiit.ac.in",
      "23057049@kiit.ac.in",
      "23057041@kiit.ac.in",
      "23057042@kiit.ac.in",
      "23057022@kiit.ac.in",
      "23057036@kiit.ac.in",
      "23057053@kiit.ac.in",
      "23057031@kiit.ac.in",
      "23057028@kiit.ac.in",
      "23057017@kiit.ac.in",
      "23057035@kiit.ac.in",
      "23057033@kiit.ac.in",
      "23057023@kiit.ac.in",
      "23057008@kiit.ac.in",
      "23057043@kiit.ac.in",
      "23057025@kiit.ac.in",
      "23057062@kiit.ac.in",
      "23057002@kiit.ac.in",
      "23057044@kiit.ac.in",
      "23057003@kiit.ac.in",
      "23057037@kiit.ac.in",
      "23057063@kiit.ac.in",
      "23057061@kiit.ac.in",
      "23057064@kiit.ac.in"
    ]







    const users2 = ['21053420@kiit.ac.in']


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
    const user = [
      21051000, 21051001, 21051016, 21051023, 21053420, 21051038, 21051146,
      21051171, 21051323, 21051349, 21051358, 21051371, 21051445, 21051572,
      21051585, 21051586, 21051590, 21051656, 21051676, 21051700, 21051732,
      21051763, 21051795, 21051810, 21051812, 21051815, 21051870, 21051925,
      21051932, 21051967, 21051983, 21051999, 21052046, 21052069, 21052103,
      21052120, 21052130, 21052153, 21052157, 21052168, 21052173, 21052176,
      21052190, 21052196, 21052251, 21052278, 21052287, 21052311, 21052327,
      21052349, 21052400, 21052486, 21052495, 21052519, 21052549, 21052557,
      21052567, 21052575, 21052626, 21052632, 21052633, 21052668, 21052692,
      21052845, 21052936, 21052938, 21052939, 21052944, 21052946, 21052954,
      21053234, 21053248, 21053275, 21053310, 21053316, 21053330, 21053331,
      21053374, 21053417, 2105007, 2105035, 2105036, 2105042, 2105043, 2105071,
      2105096, 2105116, 2105167, 2105177, 2105253, 2105267, 2105274, 2105297,
      2105307, 2105340, 2105344, 2105348, 2105359, 2105368, 2105371, 2105377,
      2105397, 2105400, 2105411, 2105437, 2105479, 2105491, 2105502, 2105507,
      2105511, 2105543, 2105550, 2105561, 2105570, 2105582, 2105583, 2105586,
      2105594, 2105606, 2105638, 2105650, 2105808, 2105812, 2105841, 2105885,
      2105898, 2105918, 2105950, 2105954, 2105973, 2106057, 2106075, 2106076,
      2106091, 2106143, 2106163, 2106238, 2106239, 2106248, 2106270, 2128021,
      2128027, 2128040, 2128049, 2128060, 2129037, 2129075, 21051060, 21051090,
      21051127, 21051128, 21051222, 21051228, 21051275, 21051287, 21051294,
      21051308, 21051309, 21051449, 21051455, 21051470, 21051496, 21051499,
      21051516, 21051527, 21051534, 21051535, 21051541, 21051563, 21051603,
      21051649, 21051728, 21051737, 21051743, 21051805, 21051863, 21051873,
      21051905, 21051906, 21051953, 21051991, 21051994, 21052007, 21052021,
      21052094, 21052148, 21052254, 21052271, 21052371, 21052411, 21052488,
      21052570, 21052589, 21052637, 21052676, 21052705, 21052716, 21052741,
      21052822, 21052826, 21052838, 21052846, 21052861, 21052878, 21052892,
      21052898, 21052981, 21053339, 21053348, 21053349, 21053354, 2105008,
      2105093, 2105142, 2105147, 2105197, 2105212, 2105238, 2105244, 2105246,
      2105277, 2105392, 2105597, 2105601, 2105616, 2105639, 2105651, 2105709,
      2105778, 2105781, 2105832, 2105879, 2105887, 2105961, 2105962, 2105974,
      2105977, 2105987, 2105996, 2106005, 2106020, 2106025, 2106039, 2106051,
      2106064, 2106074, 2106110, 2106133, 2106157, 2106168, 2106260, 2106301,
      2106306, 2128144, 21051033, 21051055, 21051061, 21051200, 21051219,
      21051223, 21051239, 21051277, 21051279, 21051282, 21051289, 21051290,
      21051296, 21051298, 21051305, 21051328, 21051337, 21051348, 21051383,
      21051500, 21051552, 21051705, 21051801, 21051804, 21051854, 21051934,
      21051960, 21051997, 21052011, 21052025, 21052028, 21052031, 21052064,
      21052096, 21052110, 21052146, 21052149, 21052150, 21052174, 21052204,
      21052246, 21052256, 21052276, 21052296, 21052298, 21052331, 21052353,
      21052356, 21052359, 21052414, 21052427, 21052429, 21052558, 21052559,
      21052560, 21052563, 21052564, 21052591, 21052594, 21052622, 21052623,
      21052628, 21052644, 21052816, 21052827, 21052859, 21052887, 21052894,
      21052902, 21052905, 21052942, 21053213, 21053303, 21053311, 21053313,
      21053340, 21053362, 21053367, 21053368, 21053388, 21053435, 21053474,
      22057029, 2105083, 2105090, 2105094, 2105140, 2105144, 2105175, 2105182,
      2105183, 2105306, 2105343, 2105393, 2105398, 2105412, 2105450, 2105455,
      2105467, 2105468, 2105470, 2105509, 2105556, 2105568, 2105613, 2105622,
      2105645, 2105682, 2105711, 2105821, 2105825, 2105901, 2105917, 2105926,
      2105972, 2106002, 2106010, 2106018, 2106019, 2106041, 2106046, 2106054,
      2106068, 2106105, 2106111, 2106127, 2106141, 2106171, 2106185, 2106227,
      2106267, 2128001, 2128018, 2129056, 21051040, 21051057, 21051064,
      21051126, 21051181, 21051187, 21051201, 21051240, 21051284, 21051295,
      21051327, 21051411, 21051420, 21051421, 21051442, 21051444, 21051458,
      21051485, 21051536, 21051582, 21051625, 21051639, 21051677, 21051725,
      21051731, 21051752, 21051772, 21051817, 21051841, 21051875, 21051902,
      21051977, 21052036, 21052053, 21052068, 21052083, 21052095, 21052106,
      21052147, 21052162, 21052211, 21052212, 21052216, 21052253, 21052255,
      21052291, 21052292, 21052300, 21052314, 21052316, 21052355, 21052366,
      21052403, 21052407, 21052415, 21052425, 21052452, 21052489, 21052528,
      21052550, 21052569, 21052585, 21052607, 21052616, 21052624, 21052694,
      21052761, 21052795, 21052803, 21052848, 21052869, 21052903, 21052922,
      21052975, 21052987, 21053209, 21053223, 21053239, 21053246, 21053257,
      21053301, 21053347, 21053353, 21053370, 21053403, 21053421, 21053431,
      21053451, 21053463, 22057020, 22057023, 2105127, 2105161, 2105168,
      2105188, 2105198, 2105200, 2105230, 2105248, 2105300, 2105311, 2105355,
      2105376, 2105386, 2105421, 2105459, 2105473, 2105505, 2105558, 2105564,
      2105685, 2105727, 2105811, 2105820, 2105824, 2105834, 2105865, 2105877,
      2105893, 2105945, 2106073, 2106090, 2106102, 2106162, 2106165, 2106166,
      2106222, 2106243, 2106246, 2106268, 2106304, 2106314, 2106319, 2128057,
      2128091, 2128111, 2128119, 2129073, 2129157, 21051015, 21051045, 21051068,
      21051069, 21051097, 21051100, 21051122, 21051135, 21051205, 21051326,
      21051338, 21051354, 21051369, 21051453, 21051454, 21051465, 21051471,
      21051472, 21051530, 21051573, 21051578, 21051588, 21051620, 21051623,
      21051636, 21051637, 21051678, 21051679, 21051710, 21051759, 21051790,
      21051794, 21051802, 21051809, 21051816, 21051829, 21051847, 21051912,
      21051913, 21051995, 21052013, 21052071, 21052088, 21052090, 21052113,
      21052154, 21052163, 21052187, 21052193, 21052202, 21052207, 21052213,
      21052221, 21052257, 21052280, 21052313, 21052362, 21052364, 21052368,
      21052430, 21052437, 21052463, 21052484, 21052505, 21052509, 21052518,
      21052522, 21052556, 21052611, 21052714, 21052770, 21052860, 21052865,
      21052874, 21052889, 21052904, 21052923, 21052976, 21053343, 21053455,
      21053469, 22057011, 2105010, 2105038, 2105087, 2105115, 2105201, 2105221,
      2105254, 2105373, 2105402, 2105453, 2105551, 2105553, 2105617, 2105693,
      2105694, 2105702, 2105706, 2105712, 2105787, 2105791, 2105815, 2105822,
      2105839, 2105862, 2105866, 2105873, 2105888, 2105891, 2105915, 2105919,
      2106011, 2106021, 2106052, 2106056, 2106062, 2106063, 2106066, 2106067,
      2106079, 2106081, 2106082, 2106118, 2106123, 2106128, 2106134, 2106148,
      2106192, 2106218, 2106266, 2106282, 2128065, 2128095, 2128103, 2128122,
      2129010, 2129060, 21051008, 21051048, 21051056, 21051096, 21051105,
      21051148, 21051162, 21051172, 21051177, 21051190, 21051192, 21051204,
      21051300, 21051315, 21051350, 21051356, 21051357, 21051360, 21051361,
      21051375, 21051394, 21051403, 21051431, 21051480, 21051510, 21051560,
      21051589, 21051595, 21051619, 21051621, 21051628, 21051662, 21051666,
      21051668, 21051670, 21051695, 21051704, 21051708, 21051709, 21051785,
      21051821, 21051828, 21051849, 21051971, 21052022, 21052033, 21052077,
      21052087, 21052142, 21052171, 21052177, 21052184, 21052200, 21052205,
      21052226, 21052310, 21052382, 21052398, 21052441, 21052451, 21052455,
      21052481, 21052512, 21052552, 21052566, 21052580, 21052581, 21052582,
      21052786, 21052821, 21052907, 21052924, 21053258, 21053260, 21053262,
      21053273, 21053380, 2105245, 2105497, 2105801, 2129090, 21051155,
      21051387, 21051435, 21051519, 21052672, 21052926, 21052927, 21053202,
      21053263, 21053351, 22057030, 22057037, 22057068, 22057088, 2105295,
      2105863, 2128136, 2129121, 21052024, 21052653, 21053332, 21053416,
      2105015, 2105055, 2105120, 2105136, 2105153, 2105193, 2105222, 2105268,
      2105308, 2105324, 2105361, 2105442, 2105485, 2105539, 2105628, 2105644,
      2105656, 2105714, 2105725, 2105756, 2105813, 2105817, 2105831, 2105849,
      2105858, 2105875, 2105902, 2105922, 2105963, 2106059, 2106112, 2106116,
      2106219, 2106229, 2106264, 2106274, 2106275, 2128032, 2128051, 2128084,
      2128085, 2128110, 2128112, 2128121, 2128123, 2128126, 2129033, 2129048,
      2129049, 2129062, 2129080, 2129082, 2129098, 2129108, 2129138, 21051041,
      21051077, 21051080, 21051088, 21051118, 21051139, 21051141, 21051159,
      21051175, 21051179, 21051216, 21051234, 21051254, 21051288, 21051325,
      21051334, 21051359, 21051362, 21051390, 21051489, 21051508, 21051551,
      21051562, 21051570, 21051571, 21051583, 21051646, 21051658, 21051714,
      21051715, 21051721, 21051730, 21051786, 21051837, 21051843, 21051855,
      21051857, 21051866, 21051874, 21051878, 21051883, 21051889, 21051897,
      21051911, 21051933, 21051942, 21051955, 21051959, 21051986, 21051993,
      21052030, 21052038, 21052060, 21052065, 21052099, 21052112, 21052115,
      21052121, 21052144, 21052158, 21052165, 21052208, 21052237, 21052297,
      21052302, 21052309, 21052315, 21052328, 21052340, 21052341, 21052347,
      21052410, 21052412, 21052436, 21052439, 21052471, 21052480, 21052506,
      21052543, 21052544, 21052553, 21052578, 21052600, 21052601, 21052609,
      21052610, 21052619, 21052701, 21052756, 21052764, 21052781, 21052817,
      21052840, 21052885, 21052893, 21052948, 21052958, 21052961, 21052974,
      21052992, 21053240, 21053277, 21053288, 21053322, 21053323, 21053326,
      21053384, 21053402, 21053415, 21053425, 21053434, 21053458, 21053459,
      21053467, 21053470, 22057024, 22057025, 22057026, 22057033, 22057035,
      22057072, 2105176, 2105252, 2105513, 2105514, 2105555, 2105563, 2106009,
      2106120, 2128020, 2128075, 2128101, 2128140, 21051627, 21051718, 21051927,
      21052210, 21052279, 21052324, 21052434, 21052464, 21052772, 21053285,
      22057005, 22057039, 22057053, 22057056, 21051270, 21052027, 21053270,
      2105002, 2105098, 2105099, 2105139, 2105155, 2105216, 2105220, 2105278,
      2105284, 2105328, 2105336, 2105387, 2105430, 2105500, 2105504, 2105527,
      2105536, 2105577, 2105610, 2105793, 2105864, 2105870, 2105889, 2105900,
      2105932, 2105971, 2105976, 2105991, 2106042, 2106103, 2106129, 2106214,
      2106233, 2106240, 2106305, 2106322, 2128004, 2128011, 2128104, 2128117,
      2129002, 2129008, 2129061, 2129105, 2129111, 2129115, 2129120, 2129133,
      2129137, 2129144, 21051018, 21051115, 21051117, 21051123, 21051124,
      21051125, 21051133, 21051183, 21051184, 21051188, 21051198, 21051227,
      21051233, 21051274, 21051303, 21051321, 21051381, 21051406, 21051460,
      21051461, 21051487, 21051522, 21051542, 21051604, 21051613, 21051686,
      21051702, 21051716, 21051741, 21051750, 21051778, 21051796, 21051814,
      21051895, 21051919, 21051926, 21051929, 21051989, 21052016, 21052026,
      21052126, 21052179, 21052218, 21052233, 21052268, 21052396, 21052450,
      21052457, 21052545, 21052554, 21052565, 21052590, 21052598, 21052640,
      21052685, 21052688, 21052709, 21052713, 21052717, 21052728, 21052765,
      21052783, 21052802, 21052811, 21052814, 21052828, 21052886, 21052914,
      21052925, 21052935, 21052978, 21052999, 21053206, 21053226, 21053227,
      21053231, 21053243, 21053254, 21053280, 21053283, 21053287, 21053298,
      21053338, 21053342, 21053411, 21053418, 21053433, 21053437, 22057007,
      22057031, 22057054, 22057058, 22057063, 22057065, 2105011, 2105023,
      2105032, 2105039, 2105046, 2105048, 2105066, 2105138, 2105162, 2105172,
      2105199, 2105229, 2105234, 2105240, 2105259, 2105270, 2105290, 2105304,
      2105305, 2105312, 2105322, 2105327, 2105346, 2105354, 2105356, 2105369,
      2105372, 2105380, 2105382, 2105383, 2105404, 2105417, 2105420, 2105451,
      2105476, 2105477, 2105487, 2105496, 2105541, 2105542, 2105548, 2105575,
      2105598, 2105599, 2105607, 2105611, 2105636, 2105647, 2105652, 2105653,
      2105654, 2105659, 2105665, 2105669, 2105670, 2105686, 2105729, 2105732,
      2105741, 2105748, 2105765, 2105770, 2105771, 2105774, 2105776, 2105790,
      2105814, 2105830, 2105855, 2105903, 2105905, 2105911, 2105912, 2105925,
      2105929, 2105930, 2105931, 2105934, 2105968, 2105983, 2105993, 2106013,
      2106017, 2106022, 2106038, 2106113, 2106182, 2106183, 2106184, 2106200,
      2106226, 2106286, 2106298, 2106302, 2128019, 2128022, 2128025, 2128026,
      2128090, 2128098, 2128102, 2128113, 2129043, 2129068, 2129103, 2129109,
      2129124, 2129140, 21051003, 21051004, 21051013, 21051021, 21051058,
      21051110, 21051111, 21051131, 21051186, 21051191, 21051209, 21051212,
      21051248, 21051257, 21051265, 21051272, 21051283, 21051293, 21051299,
      21051307, 21051317, 21051363, 21051397, 21051402, 21051405, 21051436,
      21051452, 21051456, 21051486, 21051493, 21051498, 21051502, 21051514,
      21051521, 21051529, 21051532, 21051545, 21051550, 21051574, 21051593,
      21051596, 21051610, 21051617, 21051645, 21051647, 21051653, 21051655,
      21051688, 21051694, 21051697, 21051713, 21051720, 21051742, 21051754,
      21051783, 21051813, 21051822, 21051826, 21051836, 21051844, 21051853,
      21051903, 21051907, 21051910, 21051938, 21051943, 21051972, 21051978,
      21051979, 21051987, 21051992, 21052002, 21052004, 21052009, 21052041,
      21052042, 21052044, 21052055, 21052079, 21052092, 21052100, 21052123,
      21052139, 21052140, 21052155, 21052160, 21052167, 21052170, 21052181,
      21052188, 21052201, 21052245, 21052247, 21052294, 21052306, 21052312,
      21052317, 21052332, 21052363, 21052377, 21052379, 21052383, 21052388,
      21052394, 21052426, 21052435, 21052467, 21052483, 21052510, 21052513,
      21052515, 21052526, 21052537, 21052595, 21052604, 21052612, 21052635,
      21052648, 21052663, 21052669, 21052670, 21052678, 21052683, 21052700,
      21052715, 21052719, 21052720, 21052743, 21052745, 21052768, 21052789,
      21052790, 21052805, 21052831, 21052836, 21052852, 21052871, 21052883,
      21052913, 21052915, 21052917, 21052919, 21052968, 21052973, 21052979,
      21053211, 21053214, 21053217, 21053256, 21053278, 21053293, 21053309,
      21053319, 21053366, 21053389, 21053391, 21053424, 21053465, 21053468,
      21053475, 22057012, 22057015, 22057027, 22057042, 22057043, 22057046,
      22057066, 22057071, 22057075, 22057084, 2105057, 2105184, 2105283,
      2105296, 2105431, 2105433, 2105567, 2105677, 2105880, 2105909, 2105921,
      2106004, 2106060, 2106108, 2106117, 2106153, 2106189, 2128009, 2128029,
      2128039, 2128047, 2128061, 2128081, 2128109, 2129004, 2129015, 2129024,
      2129076, 2129077, 2129078, 2129079, 2129086, 2129116, 2129123, 2129151,
      2129160, 21051034, 21051054, 21051144, 21051313, 21051345, 21051372,
      21051474, 21051651, 21051685, 21051703, 21051729, 21051755, 21051787,
      21051789, 21051827, 21051848, 21051922, 21051970, 21052108, 21052134,
      21052241, 21052319, 21052572, 21052629, 21052636, 21052638, 21052655,
      21052712, 21052726, 21052758, 21052997, 21053000, 21053261, 21053290,
      21053327, 21053392, 21053394, 21053397, 22057002, 22057014, 22057040,
      22057051, 22057076, 22057083, 2105020, 2105064, 2105185, 2105194, 2105207,
      2105281, 2105326, 2105405, 2105414, 2105537, 2105557, 2105698, 2105740,
      2105742, 2105747, 2105838, 2105846, 2105874, 2129012, 2129087, 21051314,
      21051513, 21051520, 21051632, 21051799, 21051858, 21051862, 21051923,
      21051952, 21051964, 21052074, 21052076, 21052107, 21052109, 21052183,
      21052229, 21052389, 21052409, 21052459, 21052479, 21052524, 21052547,
      21052618, 21052641, 21052664, 21052671, 21052699, 21052708, 21052722,
      21052731, 21052829, 21053289, 21053296, 21053314, 21053333, 21053395,
      21053420, 21053436, 21053442, 21053448, 21053462, 22057057, 22057087,
      2105034, 2105050, 2105158, 2105179, 2105189, 2105196, 2105280, 2105293,
      2105299, 2105323, 2105360, 2105395, 2105424, 2105446, 2105559, 2105565,
      2105624, 2105625, 2105674, 2105796, 2105818, 2105906, 2105958, 2106006,
      2106089, 2106097, 2106106, 2106119, 2106125, 2106135, 2106190, 2106198,
      2106203, 2106206, 2106207, 2106213, 2106215, 2106216, 2106225, 2106242,
      2106249, 2106265, 2106297, 2106317, 21051012, 21051014, 21051017,
      21051035, 21051053, 21051092, 21051101, 21051150, 21051154, 21051161,
      21051169, 21051194, 21051335, 21051339, 21051388, 21051440, 21051443,
      21051446, 21051457, 21051495, 21051504, 21051523, 21051600, 21051631,
      21051764, 21051807, 21051818, 21051852, 21051885, 21051976, 21052043,
      21052101, 21052138, 21052192, 21052203, 21052258, 21052339, 21052443,
      21052470, 21052475, 21052493, 21052504, 21052529, 21052587, 21052656,
      21052721, 21052727, 21052835, 21052872, 21052895, 21052910, 21052911,
      21052943, 21052965, 21052970, 21052982, 21053221, 21053228, 21053255,
      21053292, 21053318, 21053346, 21053359, 21053369, 21053376, 21053390,
      21053413, 21053426, 21053464, 21053466, 21053473, 22057019, 22057034,
      22057036, 22057050, 22057069, 22057074, 22057079, 2105001, 2105019,
      2105040, 2105074, 2105079, 2105482, 2105495, 2105562, 2105584, 2105604,
      2105757, 2105802, 2105810, 2105890, 2106043, 2106070, 2106132, 2106221,
      2106231, 2106241, 2106269, 2106276, 2129003, 2129016, 2129081, 2129083,
      2129097, 2129104, 2129107, 2129114, 2129135, 21051063, 21051174, 21051333,
      21051343, 21051385, 21051389, 21051447, 21051539, 21051569, 21051587,
      21051597, 21051609, 21051622, 21051711, 21051712, 21051761, 21051901,
      21051965, 21051973, 21051981, 21052061, 21052227, 21052242, 21052259,
      21052293, 21052442, 21052494, 21052503, 21052542, 21052657, 21052696,
      21052735, 21052873, 21052877, 21052971, 21053341, 21053350, 22057009,
      22057010, 22057016, 22057017, 22057021, 22057041, 22057062, 22057078,
      22057086, 2105058, 2105425, 21051273, 21051540, 21051733, 21051745,
      21051765, 2105101, 2105105, 2105131, 2105191, 2105195, 2105203, 2105265,
      2105276, 2105321, 2105396, 2105703, 2105716, 2105760, 2105819, 2105869,
      2105899, 2105947, 2128044, 2128058, 2128070, 2128078, 2128105, 2128116,
      2128139, 2128146, 2129021, 2129054, 21051005, 21051022, 21051049,
      21051059, 21051136, 21051196, 21051376, 21051423, 21051473, 21051494,
      21051557, 21051579, 21051612, 21051644, 21051660, 21051691, 21051746,
      21051834, 21051851, 21052093, 21052124, 21052289, 21052418, 21052438,
      21052551, 21052588, 21052646, 21052704, 21052748, 21052800, 21052854,
      21052891, 21053269, 21053409, 22057006, 2105084, 2105111, 2105124,
      2105160, 2105192, 2105285, 2105358, 2105366, 2105379, 2105384, 2105391,
      2105449, 2105465, 2105475, 2105675, 2105676, 2105687, 2105697, 2105779,
      2105789, 2105826, 2105827, 2105828, 2105852, 2105920, 2106003, 2106033,
      2106136, 2106169, 2106217, 2106254, 21051119, 21051156, 21051160,
      21051167, 21051206, 21051437, 21051448, 21051537, 21051598, 21051599,
      21051877, 21051896, 21051945, 21051961, 21051990, 21052086, 21052151,
      21052215, 21052222, 21052223, 21052230, 21052252, 21052284, 21052299,
      21052322, 21052376, 21052461, 21052516, 21052608, 21052613, 21052617,
      21052666, 21052667, 21052673, 21052675, 21052677, 21052679, 21052682,
      21052695, 21052718, 21052740, 21052754, 21052766, 21052844, 21052921,
      21052934, 21052937, 21052940, 21052950, 21052955, 21052959, 21052960,
      21053264, 21053274, 21053286, 21053300, 21053302, 21053304, 21053305,
      21053324, 21053371, 21053398, 21053404, 21053406, 21053443, 21053457,
      2105092, 2105163, 2105165, 2105289, 2105422, 2105427, 2105462, 2105499,
      2105560, 2105573, 2105590, 2105600, 2105612, 2105643, 2105658, 2105848,
      2105868, 2105952, 2105998, 2106050, 2106071, 2106262, 2106288, 2128093,
      2129006, 2129009, 2129017, 2129018, 2129025, 2129038, 2129055, 2129058,
      2129065, 2129156, 21051009, 21051463, 21051650, 21051657, 21051659,
      21051661, 21051673, 21051680, 21051684, 21051798, 21051806, 21051832,
      21051882, 21051900, 21052018, 21052048, 21052125, 21052127, 21052164,
      21052232, 21052432, 21052642, 21052650, 21052730, 21052912, 21052986,
      21053294, 21053320, 21053328, 21053456, 22057001, 22057004, 22057047,
      2105091, 2105262, 2105272, 2105279, 2105339, 2105407, 2105469, 2105474,
      2105529, 2105566, 2105621, 2105886, 2105914, 2106131, 2106172, 2106257,
      21051109, 21051168, 21051195, 21051197, 21051210, 21051213, 21051214,
      21051215, 21051260, 21051318, 21051396, 21051408, 21051555, 21051611,
      21051614, 21051618, 21051833, 21051859, 21051886, 21051894, 21051969,
      21052159, 21052266, 21052288, 21052336, 21052372, 21052387, 21052397,
      21052431, 21052433, 21052453, 21052454, 21052523, 21052732, 21052736,
      21052752, 21052755, 21052763, 21052773, 21052775, 21052787, 21052815,
      21052855, 21052993, 21053215, 21053225, 21053281, 2105017, 2105249,
      2105457, 2105488, 2105489, 2105657, 2105691, 2105692, 2105718, 2105733,
      2105734, 2105745, 2105746, 2105759, 2105764, 2105850, 2105859, 2105867,
      2105938, 2105942, 2105967, 2106146, 2106154, 2106234, 2106292, 2106295,
      2106308, 2106316, 2128030, 21051007, 21051030, 21051062, 21051132,
      21051166, 21051297, 21051311, 21051331, 21051377, 21051380, 21051507,
      21051511, 21051643, 21051690, 21051734, 21051735, 21051736, 21051747,
      21051779, 21051800, 21051868, 21051876, 21051881, 21051884, 21051899,
      21052051, 21052063, 21052290, 21052460, 21052477, 21052478, 21052555,
      21052562, 21052592, 21052614, 21052681, 21052706, 21052760, 21052839,
      21052849, 21052931, 21053259, 2105021, 2105022, 2105054, 2105159, 2105190,
      2105214, 2105227, 2105242, 2105255, 2105292, 2105294, 2105351, 2105481,
      2105524, 2105655, 2105768, 2105946, 2105969, 2105990, 2105999, 2106205,
      2106212, 2106244, 2106252, 2129013, 21051042, 21051157, 21051176,
      21051185, 21051208, 21051211, 21051245, 21051344, 21051392, 21051426,
      21051533, 21051624, 21051966, 21051988, 21052000, 21052082, 21052089,
      21052178, 21052272, 21052274, 21052305, 21052344, 21052350, 21052413,
      21052422, 21052423, 21052465, 21052466, 21052482, 21052561, 21052606,
      21052625, 21052643, 21052791, 21052897, 21052983, 21053452, 2105173,
      2105218, 2105235, 2105463, 2105484, 2105518, 2105635, 2105689, 2105731,
      2105737, 2105749, 2105751, 2105752, 2105860, 2105980, 2106035, 2106096,
      2106144, 2106147, 2106158, 2106209, 2128073, 2128074, 2128089, 2128094,
      2128096, 2129011, 2129036, 21051130, 21051230, 21051242, 21051249,
      21051281, 21051286, 21051336, 21051450, 21051475, 21051576, 21051638,
      21051766, 21051767, 21051773, 21051792, 21052037, 21052097, 21052122,
      21052225, 21052428, 21052446, 21052724, 21052771, 21052776, 21052794,
      21052812, 21052890, 21052896, 21052984, 21053276, 21053401, 21053444,
      2105026, 2105031, 2105065, 2105073, 2105085, 2105110, 2105156, 2105205,
      2105256, 2105365, 2105440, 2105458, 2105534, 2105605, 2105668, 2105844,
      2105878, 2105881, 2106045, 2106077, 2106285, 2106303, 2128042, 2128063,
      2128077, 21051037, 21051081, 21051083, 21051224, 21051236, 21051237,
      21051253, 21051255, 21051549, 21051553, 21051567, 21051664, 21051698,
      21051880, 21051887, 21051891, 21051908, 21051947, 21052056, 21052220,
      21052238, 21052244, 21052380, 21052393, 21052395, 21052405, 21052449,
      21052508, 21052574, 21052723, 21053229, 21053250, 21053387, 21053399,
      21053445, 2105076, 2105081, 2105206, 2105247, 2105291, 2105341, 2105399,
      2105415, 2105579, 2105646, 2105667, 2105717, 2105726, 2105761, 2105792,
      2105804, 2105894, 2105965, 2128066, 2128080, 2128087, 2129050, 21051076,
      21051134, 21051142, 21051158, 21051218, 21051220, 21051261, 21051391,
      21051526, 21051561, 21051605, 21051642, 21051663, 21051674, 21051753,
      21051768, 21051830, 21051831, 21051846, 21052010, 21052014, 21052118,
      21052128, 21052133, 21052219, 21052248, 21052419, 21052485, 21052527,
      21052645, 21052660, 21052818, 21052820, 21052841, 21052875, 21052882,
      21052952, 21052963, 21053360, 22057052, 2105157, 2105208, 2105264,
      2105271, 2105287, 2105319, 2105370, 2105418, 2105432, 2105445, 2105532,
      2105572, 2105576, 2105588, 2105637, 2105719, 2105763, 2105845, 2105908,
      2105928, 2106223, 2106235, 2106237, 2106247, 2128006, 2128008, 2129092,
      2129154, 2129159, 21051044, 21051065, 21051082, 21051085, 21051280,
      21051320, 21051484, 21051488, 21051525, 21051547, 21051554, 21051615,
      21051777, 21051820, 21051840, 21051898, 21052020, 21052029, 21052047,
      21052117, 21052145, 21052166, 21052263, 21052369, 21052384, 21052385,
      21052445, 21052473, 21052525, 21052703, 21052777, 21052853, 21052916,
      2105033, 2105051, 2105298, 2105357, 2105426, 2105510, 2105540, 2105620,
      2105629, 2105780, 2105829, 2105883, 2106007, 2106055, 2106061, 2106083,
      2106098, 2106101, 2106150, 2106175, 2106181, 2106197, 2106251, 2106272,
      2106273, 2106283, 2128037, 2128072, 2128086, 2128115, 2128132, 2129022,
      2129026, 2129028, 21051164, 21051264, 21051342, 21051351, 21051367,
      21051468, 21051492, 21051577, 21051601, 21051654, 21051681, 21051823,
      21051918, 21051963, 21052136, 21052283, 21052295, 21052329, 21052330,
      21052381, 21052386, 21052487, 21052501, 21052502, 21052631, 21052651,
      21052753, 21052807, 21052810, 21052832, 21052888, 21052900, 21053210,
      21053265, 21053299, 21053317, 21053461, 2105029, 2105047, 2105059,
      2105104, 2105109, 2105125, 2105135, 2105170, 2105186, 2105187, 2105217,
      2105223, 2105237, 2105318, 2105334, 2105362, 2105388, 2105401, 2105409,
      2105428, 2105434, 2105443, 2105460, 2105480, 2105503, 2105517, 2105545,
      2105578, 2105585, 2105589, 2105592, 2105602, 2105614, 2105618, 2105626,
      2105627, 2105633, 2105679, 2105705, 2105707, 2105713, 2105723, 2105730,
      2105738, 2105753, 2105754, 2105786, 2105794, 2105797, 2105803, 2105816,
      2105833, 2105842, 2105937, 2105943, 2105957, 2105964, 2105975, 2105994,
      2106016, 2106031, 2106032, 2106072, 2106078, 2106085, 2106087, 2106109,
      2106137, 2106156, 2106161, 2106196, 2106211, 2106277, 2106281, 2106300,
      2128005, 2128013, 2128015, 2128016, 2128031, 2129029, 2129052, 2129066,
      2129089, 2129093, 2129119, 21051010, 21051026, 21051073, 21051091,
      21051093, 21051108, 21051120, 21051189, 21051231, 21051302, 21051332,
      21051365, 21051373, 21051398, 21051415, 21051418, 21051419, 21051433,
      21051434, 21051451, 21051469, 21051501, 21051505, 21051584, 21051667,
      21051699, 21051706, 21051726, 21051739, 21051749, 21051757, 21051770,
      21051784, 21051825, 21051838, 21051839, 21051916, 21051951, 21051956,
      21051996, 21052012, 21052084, 21052085, 21052119, 21052137, 21052161,
      21052180, 21052186, 21052217, 21052269, 21052273, 21052275, 21052285,
      21052307, 21052365, 21052370, 21052390, 21052406, 21052417, 21052458,
      21052474, 21052514, 21052530, 21052535, 21052583, 21052597, 21052602,
      21052620, 21052707, 21052711, 21052742, 21052774, 21052779, 21052801,
      21052825, 21052858, 21052881, 21052906, 21052995, 21053205, 21053253,
      21053267, 21053335, 21053337, 21053357, 21053419, 21053422, 21053453,
      21053472, 22057038, 22057064, 2105062, 2105113, 2105151, 2105171, 2105528,
      2105596, 2105660, 2105663, 2105750, 2105784, 2105871, 2106164, 2106177,
      2106178, 2106279, 2106291, 2128034, 2128036, 2128054, 2128055, 2128062,
      2128120, 2129020, 2129032, 2129042, 2129047, 2129069, 21051152, 21051438,
      21051693, 21051769, 21051811, 21052005, 21052131, 21052375, 21052448,
      21052593, 21052603, 21052725, 21052769, 21052796, 21052809, 21052830,
      21052901, 21052951, 21052953, 21052990, 21053233, 21053242, 2105067,
      2105077, 2105108, 2105352, 2105389, 2105649, 2105955, 2106029, 2106036,
      2106037, 2106040, 2106065, 2106124, 2106220, 2128048, 2128092, 2128114,
      2128118, 2128141, 2129067, 2129095, 21051029, 21051103, 21051207,
      21051243, 21051250, 21051368, 21051384, 21051404, 21051425, 21051544,
      21051564, 21051580, 21051581, 21051701, 21051748, 21051780, 21051793,
      21051867, 21051869, 21051871, 21051872, 21051888, 21051890, 21052040,
      21052141, 21052374, 21052541, 21052548, 21052747, 21052757, 21052782,
      21052799, 21052823, 21052868, 21053471, 22057055, 2105012, 2105013,
      2105045, 2105052, 2105088, 2105123, 2105129, 2105134, 2105228, 2105250,
      2105251, 2105302, 2105349, 2105363, 2105438, 2105472, 2105538, 2105640,
      2105680, 2105710, 2105743, 2105758, 2105766, 2105799, 2105823, 2105876,
      2105916, 2105923, 2105924, 2105927, 2105944, 2105948, 2105966, 2105981,
      2105995, 2105997, 2106028, 2106094, 2106245, 2106313, 2128010, 2128014,
      2128043, 2128050, 2128052, 2128082, 2128145, 2129007, 2129030, 2129039,
      2129045, 2129051, 2129053, 2129064, 2129099, 2129101, 2129122, 21051019,
      21051020, 21051025, 21051036, 21051066, 21051129, 21051147, 21051170,
      21051246, 21051352, 21051364, 21051370, 21051378, 21051395, 21051409,
      21051424, 21051429, 21051430, 21051478, 21051481, 21051491, 21051524,
      21051546, 21051626, 21051635, 21051652, 21051665, 21051696, 21051717,
      21051724, 21051774, 21051803, 21051917, 21051937, 21051954, 21051962,
      21052023, 21052072, 21052078, 21052114, 21052182, 21052191, 21052206,
      21052264, 21052277, 21052304, 21052333, 21052338, 21052342, 21052399,
      21052469, 21052472, 21052507, 21052511, 21052546, 21052702, 21052804,
      21052863, 21052876, 21052880, 21052941, 21052962, 21053216, 21053219,
      21053235, 21053268, 21053414, 22057081, 2105004, 2105030, 2105037,
      2105072, 2105097, 2105102, 2105126, 2105150, 2105211, 2105219, 2105329,
      2105330, 2105435, 2105526, 2105531, 2105736, 2105744, 2105762, 2105896,
      2106047, 2106084, 2106092, 2106139, 2106167, 2106180, 2106195, 2106299,
      2128028, 2128046, 2129023, 2129035, 2129113, 20051279, 21051075, 21051089,
      21051098, 21051114, 21051137, 21051145, 21051202, 21051266, 21051278,
      21051285, 21051346, 21051347, 21051355, 21051379, 21051386, 21051417,
      21051466, 21051477, 21051479, 21051758, 21051860, 21051865, 21051904,
      21051915, 21051935, 21051958, 21051980, 21052143, 21052189, 21052198,
      21052235, 21052236, 21052249, 21052250, 21052267, 21052281, 21052282,
      21052334, 21052391, 21052499, 21052517, 21052520, 21052634, 21052649,
      21052662, 21052697, 21052792, 21052884, 21052899, 21052932, 21052966,
      21052991, 21053201, 21053271, 21053284, 21053308, 22057008, 22057013,
      22057018, 22057028, 22057077, 2105086, 2105233, 2105260, 2105936, 2105992,
      2106008, 2106253, 2128023, 2128100, 2128128, 2129014, 2129139, 21051032,
      21051259, 21051301, 21051467, 21051482, 21051957, 21052006, 21052059,
      21052169, 21052199, 21052500, 21052540, 21052568, 21052621, 21052833,
      21052847, 21053032, 21053207, 21053237, 21053244, 21053251, 21053372,
      2105018, 2105025, 2105049, 2105069, 2105070, 2105080, 2105082, 2105106,
      2105141, 2105149, 2105154, 2105174, 2105181, 2105239, 2105320, 2105333,
      2105342, 2105483, 2105521, 2105544, 2105549, 2105552, 2105574, 2105595,
      2105603, 2105630, 2105688, 2105708, 2105720, 2105767, 2105769, 2105772,
      2105785, 2105795, 2105836, 2105840, 2105872, 2105956, 2105970, 2106001,
      2106049, 2106100, 2106122, 2106140, 2106232, 2106250, 2106296, 2128068,
      2129072, 2129088, 2129091, 2129100, 2129112, 2129128, 2129130, 21051028,
      21051031, 21051046, 21051084, 21051112, 21051121, 21051140, 21051143,
      21051217, 21051258, 21051268, 21051319, 21051330, 21051353, 21051439,
      21051497, 21051515, 21051531, 21051565, 21051566, 21051592, 21051608,
      21051616, 21051669, 21051672, 21051683, 21051751, 21051775, 21051782,
      21051788, 21051879, 21051892, 21051921, 21051946, 21051948, 21051950,
      21052008, 21052080, 21052135, 21052224, 21052361, 21052401, 21052456,
      21052462, 21052476, 21052490, 21052532, 21052573, 21052576, 21052596,
      21052605, 21052739, 21052762, 21052778, 21052813, 21052857, 21052866,
      21052870, 21052908, 21052957, 21053212, 21053282, 21053312, 21053321,
      21053364, 21053396, 21053408, 22057085, 2105003, 2105056, 2105078,
      2105107, 2105178, 2105180, 2105213, 2105273, 2105367, 2105385, 2105494,
      2105498, 2105666, 2105672, 2105695, 2105715, 2105721, 2105728, 2105739,
      2105755, 2105856, 2105861, 2105910, 2105940, 2105949, 2105959, 2106026,
      2106034, 2106088, 2106138, 2106159, 2106179, 2106199, 2106208, 2106224,
      2106287, 2106290, 2106318, 2128003, 2128012, 2128035, 2128038, 2128056,
      2128088, 2128133, 2128134, 2129136, 2129158, 21051002, 21051006, 21051011,
      21051039, 21051043, 21051050, 21051106, 21051107, 21051138, 21051163,
      21051199, 21051267, 21051276, 21051374, 21051393, 21051422, 21051476,
      21051503, 21051509, 21051517, 21051594, 21051606, 21051607, 21051633,
      21051640, 21051689, 21051723, 21051738, 21051808, 21051824, 21051856,
      21051931, 21052035, 21052050, 21052070, 21052098, 21052105, 21052172,
      21052194, 21052195, 21052270, 21052357, 21052444, 21052533, 21052534,
      21052639, 21052658, 21052680, 21052686, 21052689, 21052690, 21052710,
      21052842, 21052930, 21053224, 21053238, 21053252, 21053315, 21053325,
      21053329, 21053336, 21053355, 21053365, 21053381, 21053382, 21053405,
      21053450, 21053460, 2105005, 2105009, 2105016, 2105027, 2105041, 2105075,
      2105089, 2105100, 2105152, 2105164, 2105202, 2105204, 2105209, 2105269,
      2105282, 2105313, 2105314, 2105316, 2105331, 2105332, 2105375, 2105381,
      2105410, 2105436, 2105447, 2105512, 2105530, 2105546, 2105619, 2105648,
      2105684, 2105696, 2105701, 2105735, 2105783, 2105806, 2105807, 2105809,
      2105843, 2105907, 2106069, 2106086, 2106173, 2106176, 2106202, 2106321,
      2128064, 2128097, 2128106, 2128108, 2128127, 2129118, 2129141, 21051067,
      21051071, 21051072, 21051074, 21051079, 21051087, 21051094, 21051095,
      21051113, 21051116, 21051151, 21051235, 21051251, 21051329, 21051340,
      21051416, 21051512, 21051528, 21051538, 21051548, 21051559, 21051630,
      21051634, 21051722, 21051727, 21051756, 21051762, 21051771, 21051781,
      21051835, 21051909, 21051949, 21051974, 21051975, 21051985, 21051998,
      21052015, 21052066, 21052129, 21052234, 21052260, 21052261, 21052265,
      21052301, 21052303, 21052325, 21052358, 21052373, 21052378, 21052404,
      21052492, 21052496, 21052571, 21052647, 21052652, 21052654, 21052698,
      21052734, 21052737, 21052749, 21052780, 21052793, 21052834, 21052837,
      21052843, 21052949, 21052964, 21052980, 21053222, 21053291, 21053334,
      21053363, 21053385, 21053386, 21053438, 21053439, 21053454, 22057044,
      2105374, 2105408, 2105416, 2105569, 2105722, 2105851, 2105854, 2105857,
      2105882, 2105982, 2105984, 2105986, 2106053, 2106170, 2106187, 2106191,
      2106289, 2106307, 2106309, 2128059, 2129041, 21051027, 21051173, 21051247,
      21051483, 21051568, 21051641, 21051740, 21051791, 21051928, 21051930,
      21051939, 21051940, 21051944, 21052156, 21052308, 21052320, 21052337,
      21052346, 21052539, 21052577, 21052665, 21052746, 21052784, 21052945,
      21052967, 21052985, 21052994, 21053203, 21053373, 21053412, 22057032,
      2105520, 2105631, 21052440, 21052808, 21051864, 21052402, 21053344,
      21053393, 2105939, 2106104, 2128107, 2129057, 2129126, 21052045, 21053295,
      22057049, 2128041, 2128045, 2128069, 21051178, 21051982,
    ];

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
    const users = [
      {
        "user": {
          "name": "882_Arkaprobho Das",
          "email": "2205882@kiit.ac.in"
        },
        "paymentScreenshot": null,
        "isActive": false,
        "branch": "CSE",
        "year": "2nd Year"
      },
      {
        "user": {
          "name": "3671- Asish Mohapatra",
          "email": "22053671@kiit.ac.in"
        },
        "paymentScreenshot": null,
        "isActive": false,
        "branch": "CSE",
        "year": "3rd Year"
      },
      {
        "user": {
          "name": "TANMAYA PATRA",
          "email": "22053994@kiit.ac.in"
        },
        "paymentScreenshot": null,
        "isActive": false,
        "branch": "CSE",
        "year": "3rd Year"
      },
      {
        "user": {
          "name": "GAURAV KUMAR",
          "email": "22052383@kiit.ac.in"
        },
        "paymentScreenshot": null,
        "isActive": false,
        "branch": "CSE",
        "year": "3rd Year"
      },
      {
        "user": {
          "name": "AASTHA KUMARI",
          "email": "22054221@kiit.ac.in"
        },
        "paymentScreenshot": null,
        "isActive": false,
        "branch": "CSE",
        "year": "2nd Year"
      },
      {
        "user": {
          "name": "3201_SOUPTIK KARAN",
          "email": "22053201@kiit.ac.in"
        },
        "paymentScreenshot": null,
        "isActive": false,
        "branch": "CSE",
        "year": "3rd Year"
      },
      {
        "user": {
          "name": "PRATHMESH GANGARDE",
          "email": "22052487@kiit.ac.in"
        },
        "paymentScreenshot": null,
        "isActive": false,
        "branch": "CSE",
        "year": "3rd Year"
      },
      {
        "user": {
          "name": "1212 - VEDANT VAIBHAV",
          "email": "22051212@kiit.ac.in"
        },
        "paymentScreenshot": null,
        "isActive": false,
        "branch": "CSE",
        "year": "3rd Year"
      },
      {
        "user": {
          "name": "1707 Pranjal Kumar",
          "email": "22051707@kiit.ac.in"
        },
        "paymentScreenshot": null,
        "isActive": false,
        "branch": "CSE",
        "year": "3rd Year"
      },
      {
        "user": {
          "name": "315_Adrish Banerjee",
          "email": "2206315@kiit.ac.in"
        },
        "paymentScreenshot": null,
        "isActive": false,
        "branch": "IT",
        "year": "3rd Year"
      },
      {
        "user": {
          "name": "SHREYA AGARWAL",
          "email": "22051024@kiit.ac.in"
        },
        "paymentScreenshot": null,
        "isActive": false,
        "branch": "CSE",
        "year": "3rd Year"
      },
      {
        "user": {
          "name": "9024_AYUSH PANDEY",
          "email": "2229024@kiit.ac.in"
        },
        "paymentScreenshot": null,
        "isActive": false,
        "branch": "CSCE",
        "year": "3rd Year"
      },
      {
        "user": {
          "name": "141_Nilesh Patel",
          "email": "2205141@kiit.ac.in"
        },
        "paymentScreenshot": null,
        "isActive": false,
        "branch": "CSE",
        "year": "3rd Year"
      },
      {
        "user": {
          "name": "700_AJIT SHAH",
          "email": "2205700@kiit.ac.in"
        },
        "paymentScreenshot": null,
        "isActive": false,
        "branch": "CSE",
        "year": "3rd Year"
      },
      {
        "user": {
          "name": "MAYANK RAJ",
          "email": "22052560@kiit.ac.in"
        },
        "paymentScreenshot": null,
        "isActive": false,
        "branch": "CSE",
        "year": "3rd Year"
      },
      {
        "user": {
          "name": "BISHNU PRASAD SAHU",
          "email": "22051504@kiit.ac.in"
        },
        "paymentScreenshot": null,
        "isActive": false,
        "branch": "CSE",
        "year": "2nd Year"
      },
      {
        "user": {
          "name": "132_Adhiraj Ghosal",
          "email": "22053132@kiit.ac.in"
        },
        "paymentScreenshot": null,
        "isActive": false,
        "branch": "CSE",
        "year": "3rd Year"
      },
      {
        "user": {
          "name": "SANJEEVANI DAS (22053465)",
          "email": "22053465@kiit.ac.in"
        },
        "paymentScreenshot": null,
        "isActive": false,
        "branch": "CSE",
        "year": "3rd Year"
      },
      {
        "user": {
          "name": "5872_adrika",
          "email": "2205872@kiit.ac.in"
        },
        "paymentScreenshot": null,
        "isActive": false,
        "branch": "CSE",
        "year": "3rd Year"
      },
      {
        "user": {
          "name": "673_SHREYA ALLUPATI",
          "email": "2205673@kiit.ac.in"
        },
        "paymentScreenshot": null,
        "isActive": false,
        "branch": "CSE",
        "year": "3rd Year"
      },
      {
        "user": {
          "name": "RIDDHI DEEP",
          "email": "22051097@kiit.ac.in"
        },
        "paymentScreenshot": null,
        "isActive": false,
        "branch": "CSE",
        "year": "3rd Year"
      },
      {
        "user": {
          "name": "UTKARSH SHUKLA",
          "email": "22052948@kiit.ac.in"
        },
        "paymentScreenshot": null,
        "isActive": false,
        "branch": "CSE",
        "year": "3rd Year"
      },
      {
        "user": {
          "name": "ANIT DAS",
          "email": "2205015@kiit.ac.in"
        },
        "paymentScreenshot": null,
        "isActive": false,
        "branch": "CSE",
        "year": "3rd Year"
      },
      {
        "user": {
          "name": "180_RAJESHWARI CHOUDHURY",
          "email": "22053180@kiit.ac.in"
        },
        "paymentScreenshot": null,
        "isActive": false,
        "branch": "CSE",
        "year": "3rd Year"
      },
      {
        "user": {
          "name": "1018_SATYAM SANJEEV",
          "email": "22051018@kiit.ac.in"
        },
        "paymentScreenshot": null,
        "isActive": false,
        "branch": "CSE",
        "year": "3rd Year"
      },
      {
        "user": {
          "name": "3403-AROSREE SATAPATHY",
          "email": "22053403@kiit.ac.in"
        },
        "paymentScreenshot": null,
        "isActive": false,
        "branch": "CSE",
        "year": "3rd Year"
      },
      {
        "user": {
          "name": "ANURAG ANAND",
          "email": "22052364@kiit.ac.in"
        },
        "paymentScreenshot": null,
        "isActive": false,
        "branch": "CSE",
        "year": "2nd Year"
      },
      {
        "user": {
          "name": "9018_ARYA ASHUTOSH DAS",
          "email": "2229018@kiit.ac.in"
        },
        "paymentScreenshot": null,
        "isActive": false,
        "branch": "CSCE",
        "year": "2nd Year"
      },
      {
        "user": {
          "name": "2098_Apurva Jaiswal",
          "email": "22052098@kiit.ac.in"
        },
        "paymentScreenshot": null,
        "isActive": false,
        "branch": "CSE",
        "year": "3rd Year"
      },
      {
        "user": {
          "name": "HRITIK SHAH",
          "email": "22054331@kiit.ac.in"
        },
        "paymentScreenshot": null,
        "isActive": false,
        "branch": "CSE",
        "year": "3rd Year"
      },
      {
        "user": {
          "name": "5816_KESHAV NARAYAN RATH",
          "email": "2205816@kiit.ac.in"
        },
        "paymentScreenshot": null,
        "isActive": false,
        "branch": "CSE",
        "year": "3rd Year"
      },
      {
        "user": {
          "name": "1162-Hritika Sharan",
          "email": "22051162@kiit.ac.in"
        },
        "paymentScreenshot": null,
        "isActive": false,
        "branch": "CSE",
        "year": "3rd Year"
      },
      {
        "user": {
          "name": "SHAION SANYAL",
          "email": "22053807@kiit.ac.in"
        },
        "paymentScreenshot": null,
        "isActive": false,
        "branch": "CSE",
        "year": "3rd Year"
      },
      {
        "user": {
          "name": "PREETAM KUMAR",
          "email": "22051870@kiit.ac.in"
        },
        "paymentScreenshot": null,
        "isActive": false,
        "branch": "CSE",
        "year": "3rd Year"
      },
      {
        "user": {
          "name": "ANANYA BISOI",
          "email": "22052881@kiit.ac.in"
        },
        "paymentScreenshot": null,
        "isActive": false,
        "branch": "CSE",
        "year": "3rd Year"
      },
      {
        "user": {
          "name": "VIVEK SINGH (22052868)",
          "email": "22052868@kiit.ac.in"
        },
        "paymentScreenshot": null,
        "isActive": false,
        "branch": "CSE",
        "year": "3rd Year"
      },
      {
        "user": {
          "name": "5339_SWARNALI CHATTERJEE",
          "email": "2205339@kiit.ac.in"
        },
        "paymentScreenshot": null,
        "isActive": false,
        "branch": "CSE",
        "year": "3rd Year"
      },
      {
        "user": {
          "name": "PRANJAL YADAV",
          "email": "22052918@kiit.ac.in"
        },
        "paymentScreenshot": null,
        "isActive": false,
        "branch": "CSE",
        "year": "3rd Year"
      },
      {
        "user": {
          "name": "280_ANWESHA MONDAL",
          "email": "22052280@kiit.ac.in"
        },
        "paymentScreenshot": null,
        "isActive": false,
        "branch": "CSE",
        "year": "2nd Year"
      },
      {
        "user": {
          "name": "4043_Ghanshyam Yadav",
          "email": "22054043@kiit.ac.in"
        },
        "paymentScreenshot": null,
        "isActive": false,
        "branch": "CSE",
        "year": "3rd Year"
      },
      {
        "user": {
          "name": "4388_AMIT SHAH",
          "email": "22054388@kiit.ac.in"
        },
        "paymentScreenshot": null,
        "isActive": false,
        "branch": "CSE",
        "year": "3rd Year"
      },
      {
        "user": {
          "name": "1458_SHANTANU",
          "email": "22051458@kiit.ac.in"
        },
        "paymentScreenshot": null,
        "isActive": false,
        "branch": "CSE",
        "year": "2nd Year"
      },
      {
        "user": {
          "name": "SOMEN MISHRA",
          "email": "22053891@kiit.ac.in"
        },
        "paymentScreenshot": null,
        "isActive": false,
        "branch": "CSE",
        "year": "3rd Year"
      },
      {
        "user": {
          "name": "NISCHAL PANDEY",
          "email": "22054282@kiit.ac.in"
        },
        "paymentScreenshot": null,
        "isActive": false,
        "branch": "CSE",
        "year": "3rd Year"
      },
      {
        "user": {
          "name": "3604_Kushagra Yadav",
          "email": "22053604@kiit.ac.in"
        },
        "paymentScreenshot": null,
        "isActive": false,
        "branch": "CSE",
        "year": "3rd Year"
      },
      {
        "user": {
          "name": "ADITYA RAJ_1829",
          "email": "22051829@kiit.ac.in"
        },
        "paymentScreenshot": null,
        "isActive": false,
        "branch": "CSE",
        "year": "3rd Year"
      },
      {
        "user": {
          "name": "SHREYARTHA ROY",
          "email": "22051376@kiit.ac.in"
        },
        "paymentScreenshot": null,
        "isActive": false,
        "branch": "CSE",
        "year": "3rd Year"
      },
      {
        "user": {
          "name": "GAURAV PANDEY 583",
          "email": "22051583@kiit.ac.in"
        },
        "paymentScreenshot": null,
        "isActive": false,
        "branch": "CSE",
        "year": "3rd Year"
      },
      {
        "user": {
          "name": "419 Chiranjib Muduli",
          "email": "22051419@kiit.ac.in"
        },
        "paymentScreenshot": null,
        "isActive": false,
        "branch": "CSE",
        "year": "3rd Year"
      },
      {
        "user": {
          "name": "PIYUSH RANJAN",
          "email": "22052564@kiit.ac.in"
        },
        "paymentScreenshot": null,
        "isActive": false,
        "branch": "CSE",
        "year": "3rd Year"
      },
      {
        "user": {
          "name": "SUJAL KUMAR",
          "email": "22053906@kiit.ac.in"
        },
        "paymentScreenshot": null,
        "isActive": false,
        "branch": "CSE",
        "year": "3rd Year"
      },
      {
        "user": {
          "name": "3739_YASHITA ONDHIA",
          "email": "22053739@kiit.ac.in"
        },
        "paymentScreenshot": null,
        "isActive": false,
        "branch": "CSE",
        "year": "3rd Year"
      },
      {
        "user": {
          "name": "4341 Prem Kumar Gupta",
          "email": "22054341@kiit.ac.in"
        },
        "paymentScreenshot": null,
        "isActive": false,
        "branch": "CSE",
        "year": "3rd Year"
      },
      {
        "user": {
          "name": "2256 _UPAL PAHARI",
          "email": "22052256@kiit.ac.in"
        },
        "paymentScreenshot": null,
        "isActive": false,
        "branch": "CSE",
        "year": "3rd Year"
      },
      {
        "user": {
          "name": "ARPIT SHIVHARE",
          "email": "22052014@kiit.ac.in"
        },
        "paymentScreenshot": null,
        "isActive": false,
        "branch": "CSE",
        "year": "2nd Year"
      },
      {
        "user": {
          "name": "ASHUTOSH BEDI",
          "email": "22053851@kiit.ac.in"
        },
        "paymentScreenshot": null,
        "isActive": false,
        "branch": "CSE",
        "year": "3rd Year"
      },
      {
        "user": {
          "name": "4344__SHASHANK CHAUDHARY",
          "email": "22054344@kiit.ac.in"
        },
        "paymentScreenshot": null,
        "isActive": false,
        "branch": "CSE",
        "year": "3rd Year"
      },
      {
        "user": {
          "name": "SOURAV ADHIKARI",
          "email": "22053816@kiit.ac.in"
        },
        "paymentScreenshot": null,
        "isActive": false,
        "branch": "CSE",
        "year": "2nd Year"
      },
      {
        "user": {
          "name": "ANUSHKA SHRIVASTAVA",
          "email": "2205710@kiit.ac.in"
        },
        "paymentScreenshot": null,
        "isActive": false,
        "branch": "CSE",
        "year": "3rd Year"
      },
      {
        "user": {
          "name": "ARNAV CHANDUKA",
          "email": "2205973@kiit.ac.in"
        },
        "paymentScreenshot": null,
        "isActive": false,
        "branch": "CSE",
        "year": "2nd Year"
      },
      {
        "user": {
          "name": "2101_Aryan Saxena",
          "email": "22052101@kiit.ac.in"
        },
        "paymentScreenshot": null,
        "isActive": false,
        "branch": "CSE",
        "year": "3rd Year"
      },
      {
        "user": {
          "name": "4362_NISTHA Panjiyar",
          "email": "22054362@kiit.ac.in"
        },
        "paymentScreenshot": null,
        "isActive": false,
        "branch": "CSE",
        "year": "2nd Year"
      },
      {
        "user": {
          "name": "6107_ Pratyush Prasoon",
          "email": "2206107@kiit.ac.in"
        },
        "paymentScreenshot": null,
        "isActive": false,
        "branch": "IT",
        "year": "2nd Year"
      },
      {
        "user": {
          "name": "JAYESH NAHAR",
          "email": "22053248@kiit.ac.in"
        },
        "paymentScreenshot": null,
        "isActive": false,
        "branch": "CSE",
        "year": "3rd Year"
      },
      {
        "user": {
          "name": "ARIB NAWAZ",
          "email": "22053402@kiit.ac.in"
        },
        "paymentScreenshot": null,
        "isActive": false,
        "branch": "CSE",
        "year": "3rd Year"
      },
      {
        "user": {
          "name": "5748_Mandira Biswas",
          "email": "2205748@kiit.ac.in"
        },
        "paymentScreenshot": null,
        "isActive": false,
        "branch": "CSE",
        "year": "3rd Year"
      },
      {
        "user": {
          "name": "SURYANSH DEO - 1205",
          "email": "22051205@kiit.ac.in"
        },
        "paymentScreenshot": null,
        "isActive": false,
        "branch": "CSE",
        "year": "3rd Year"
      },
      {
        "user": {
          "name": "LAKKSHIT KHARE",
          "email": "2205045@kiit.ac.in"
        },
        "paymentScreenshot": null,
        "isActive": false,
        "branch": "CSE",
        "year": "3rd Year"
      },
      {
        "user": {
          "name": "536_ ANKIT",
          "email": "2205536@kiit.ac.in"
        },
        "paymentScreenshot": null,
        "isActive": false,
        "branch": "CSE",
        "year": "3rd Year"
      },
      {
        "user": {
          "name": "1167_KHUSHAL JHINGAN",
          "email": "22051167@kiit.ac.in"
        },
        "paymentScreenshot": null,
        "isActive": false,
        "branch": "CSE",
        "year": "3rd Year"
      },
      {
        "user": {
          "name": "6032_KRISHNANSHU RATH",
          "email": "2206032@kiit.ac.in"
        },
        "paymentScreenshot": null,
        "isActive": false,
        "branch": "IT",
        "year": "2nd Year"
      },
      {
        "user": {
          "name": "GAURAV KUMAR",
          "email": "22051856@kiit.ac.in"
        },
        "paymentScreenshot": null,
        "isActive": false,
        "branch": "CSE",
        "year": "3rd Year"
      },
      {
        "user": {
          "name": "2175_AAYUSH",
          "email": "22052175@kiit.ac.in"
        },
        "paymentScreenshot": null,
        "isActive": false,
        "branch": "CSE",
        "year": "3rd Year"
      },
      {
        "user": {
          "name": "4122-ANIK BANERJEE",
          "email": "22054122@kiit.ac.in"
        },
        "paymentScreenshot": null,
        "isActive": false,
        "branch": "CSE",
        "year": "3rd Year"
      },
      {
        "user": {
          "name": "2004_AMRIT SINGH",
          "email": "22052004@kiit.ac.in"
        },
        "paymentScreenshot": null,
        "isActive": false,
        "branch": "CSE",
        "year": "3rd Year"
      },
      {
        "user": {
          "name": "3185_SAMBIT",
          "email": "22053185@kiit.ac.in"
        },
        "paymentScreenshot": null,
        "isActive": false,
        "branch": "CSE",
        "year": "2nd Year"
      },
      {
        "user": {
          "name": "2333_Shreya",
          "email": "22052333@kiit.ac.in"
        },
        "paymentScreenshot": null,
        "isActive": false,
        "branch": "CSE",
        "year": "3rd Year"
      },
      {
        "user": {
          "name": "MAINAK MAITRA",
          "email": "22053076@kiit.ac.in"
        },
        "paymentScreenshot": null,
        "isActive": false,
        "branch": "CSE",
        "year": "2nd Year"
      },
      {
        "user": {
          "name": "4185 TANISA VERMA",
          "email": "22054185@kiit.ac.in"
        },
        "paymentScreenshot": null,
        "isActive": false,
        "branch": "CSE",
        "year": "3rd Year"
      },
      {
        "user": {
          "name": "448_ANNU PRIYA",
          "email": "2205448@kiit.ac.in"
        },
        "paymentScreenshot": null,
        "isActive": false,
        "branch": "CSE",
        "year": "3rd Year"
      },
      {
        "user": {
          "name": "3614_PRATEEK PARIJA",
          "email": "22053614@kiit.ac.in"
        },
        "paymentScreenshot": null,
        "isActive": false,
        "branch": "CSE",
        "year": "3rd Year"
      },
      {
        "user": {
          "name": "SHRUTI KUNDU",
          "email": "2205508@kiit.ac.in"
        },
        "paymentScreenshot": null,
        "isActive": false,
        "branch": "CSE",
        "year": "3rd Year"
      },
      {
        "user": {
          "name": "1414_ASHUTOSH KUMAR",
          "email": "22051414@kiit.ac.in"
        },
        "paymentScreenshot": null,
        "isActive": false,
        "branch": "CSE",
        "year": "3rd Year"
      },
      {
        "user": {
          "name": "2724-DURJAYA DAS",
          "email": "22052724@kiit.ac.in"
        },
        "paymentScreenshot": null,
        "isActive": false,
        "branch": "CSE",
        "year": "3rd Year"
      },
      {
        "user": {
          "name": "5756_Ojash Kumar Jana",
          "email": "2205756@kiit.ac.in"
        },
        "paymentScreenshot": null,
        "isActive": false,
        "branch": "CSE",
        "year": "3rd Year"
      },
      {
        "user": {
          "name": "TANIYA SHAH",
          "email": "22054454@kiit.ac.in"
        },
        "paymentScreenshot": null,
        "isActive": false,
        "branch": "CSE",
        "year": "2nd Year"
      },
      {
        "user": {
          "name": "SHALINI DAS",
          "email": "22054264@kiit.ac.in"
        },
        "paymentScreenshot": null,
        "isActive": false,
        "branch": "CSE",
        "year": "3rd Year"
      },
      {
        "user": {
          "name": "2020_C Sai laxmi Gayatri",
          "email": "22052020@kiit.ac.in"
        },
        "paymentScreenshot": null,
        "isActive": false,
        "branch": "CSE",
        "year": "3rd Year"
      },
      {
        "user": {
          "name": "4067_Pratik Timilsina",
          "email": "22054067@kiit.ac.in"
        },
        "paymentScreenshot": null,
        "isActive": false,
        "branch": "CSE",
        "year": "3rd Year"
      },
      {
        "user": {
          "name": "SAMRIDHI PRAKASH",
          "email": "2229152@kiit.ac.in"
        },
        "paymentScreenshot": null,
        "isActive": false,
        "branch": "CSCE",
        "year": "3rd Year"
      },
      {
        "user": {
          "name": "782_AARAB NISHCHAL (Aarab Nishchal)",
          "email": "2205782@kiit.ac.in"
        },
        "paymentScreenshot": null,
        "isActive": false,
        "branch": "CSE",
        "year": "3rd Year"
      },
      {
        "user": {
          "name": "SOURAV PAUL (22051031)",
          "email": "22051031@kiit.ac.in"
        },
        "paymentScreenshot": null,
        "isActive": false,
        "branch": "CSE",
        "year": "3rd Year"
      },
      {
        "user": {
          "name": "4338 RAJESH DAHAL",
          "email": "22054338@kiit.ac.in"
        },
        "paymentScreenshot": null,
        "isActive": false,
        "branch": "CSE",
        "year": "3rd Year"
      },
      {
        "user": {
          "name": "4008 _aayushi",
          "email": "22054008@kiit.ac.in"
        },
        "paymentScreenshot": null,
        "isActive": false,
        "branch": "CSE",
        "year": "2nd Year"
      },
      {
        "user": {
          "name": "Genish Kumar",
          "email": "22054099@kiit.ac.in"
        },
        "paymentScreenshot": null,
        "isActive": false,
        "branch": "CSE",
        "year": "2nd Year"
      },
      {
        "user": {
          "name": "ARYADEEP PRADHAN",
          "email": "22051843@kiit.ac.in"
        },
        "paymentScreenshot": null,
        "isActive": false,
        "branch": "CSE",
        "year": "3rd Year"
      },
      {
        "user": {
          "name": "1488_AKANKSHA GUPTA",
          "email": "22051488@kiit.ac.in"
        },
        "paymentScreenshot": null,
        "isActive": false,
        "branch": "CSE",
        "year": "3rd Year"
      },
      {
        "user": {
          "name": "3675_Baishali Dash",
          "email": "22053675@kiit.ac.in"
        },
        "paymentScreenshot": null,
        "isActive": false,
        "branch": "CSE",
        "year": "3rd Year"
      },
      {
        "user": {
          "name": "1009_SAI MANIKANTA PATRO",
          "email": "22051009@kiit.ac.in"
        },
        "paymentScreenshot": null,
        "isActive": false,
        "branch": "CSE",
        "year": "3rd Year"
      },
      {
        "user": {
          "name": "2710-ARNAB KAR",
          "email": "22052710@kiit.ac.in"
        },
        "paymentScreenshot": null,
        "isActive": false,
        "branch": "CSE",
        "year": "3rd Year"
      },
      {
        "user": {
          "name": "Bishal Thakur",
          "email": "22054234@kiit.ac.in"
        },
        "paymentScreenshot": null,
        "isActive": false,
        "branch": "CSE",
        "year": "3rd Year"
      },
      {
        "user": {
          "name": "4376_Nirmala Chhetri",
          "email": "22054376@kiit.ac.in"
        },
        "paymentScreenshot": null,
        "isActive": false,
        "branch": "CSE",
        "year": "3rd Year"
      },
      {
        "user": {
          "name": "MAYANK SINHA",
          "email": "22052909@kiit.ac.in"
        },
        "paymentScreenshot": null,
        "isActive": false,
        "branch": "CSE",
        "year": "3rd Year"
      },
      {
        "user": {
          "name": "2860_ Spandan",
          "email": "22052860@kiit.ac.in"
        },
        "paymentScreenshot": null,
        "isActive": false,
        "branch": "CSE",
        "year": "3rd Year"
      },
      {
        "user": {
          "name": "9064_Shaurya BS Raghav",
          "email": "2229064@kiit.ac.in"
        },
        "paymentScreenshot": "hll3y8akk8v",
        "isActive": false,
        "branch": "CSCE",
        "year": "2nd Year"
      },
      {
        "user": {
          "name": "2740 - NANDINI BHARDWAJ",
          "email": "22052740@kiit.ac.in"
        },
        "paymentScreenshot": null,
        "isActive": false,
        "branch": "CSE",
        "year": "2nd Year"
      },
      {
        "user": {
          "name": "1204 - SUKRIT ROY",
          "email": "22051204@kiit.ac.in"
        },
        "paymentScreenshot": null,
        "isActive": false,
        "branch": "CSE",
        "year": "3rd Year"
      }
    ]
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
    const userPremium = [












      {
        "id": "66e486e8f740b2b3e5002c23",
        "email": "23053217@kiit.ac.in",
        "name": "KUSHAGRA BHARTIYAM",
        "batch": "2nd Year"
      },
      {
        "id": "66e4ae07f740b2b3e5002c29",
        "email": "2205554@kiit.ac.in",
        "name": "554_GOURAB MONDAL",
        "batch": "3rd Year"
      },
      {
        "id": "66e55d0bf740b2b3e5002c35",
        "email": "2329217@kiit.ac.in",
        "name": "TANMAY VERMA",
        "batch": "2nd Year"
      },
      {
        "id": "66e59261f740b2b3e5002c37",
        "email": "24051898@kiit.ac.in",
        "name": "VANSHIKA VIRMANI",
        "batch": "1st Year"
      },
      {
        "id": "66e67e46f740b2b3e5002c45",
        "email": "2305855@kiit.ac.in",
        "name": "DEV DAS",
        "batch": "2nd Year"
      },
      {
        "id": "66e68641f740b2b3e5002c47",
        "email": "24155793@kiit.ac.in",
        "name": "5793_RITIKA SRIVASTAVA",
        "batch": "1st Year"
      },
      {
        "id": "66e68eaaf740b2b3e5002c49",
        "email": "2405921@kiit.ac.in",
        "name": "TEJAS VERMA",
        "batch": "1st Year"
      },
      {
        "id": "66e6ee8ef740b2b3e5002c57",
        "email": "23052091@kiit.ac.in",
        "name": "RAJARSHI MUKHERJEE",
        "batch": "2nd Year"
      },
      {
        "id": "66e7b68af740b2b3e5002c61",
        "email": "24057074@kiit.ac.in",
        "name": "SIDDHID RAGHAVANSHA",
        "batch": "1st Year"
      },
      {
        "id": "66e863d0f740b2b3e5002c76",
        "email": "24158133@kiit.ac.in",
        "name": "ZORAVAR SINGH",
        "batch": "1st Year"
      },
      {
        "id": "66e87e51f740b2b3e5002c82",
        "email": "23052745@kiit.ac.in",
        "name": "PUNIT MOHAN",
        "batch": "2nd Year"
      },
      {
        "id": "66e87fa4f740b2b3e5002c83",
        "email": "22053783@kiit.ac.in",
        "name": "LOPAMUDRA TRIPATHY",
        "batch": "3rd Year"
      },
      {
        "id": "66e8977af740b2b3e5002c88",
        "email": "2305555@kiit.ac.in",
        "name": "5555_Rachit Kumar Singh",
        "batch": "2nd Year"
      },
      {
        "id": "66e920d8f740b2b3e5002c8f",
        "email": "23053437@kiit.ac.in",
        "name": "HUSSAIN PATEL",
        "batch": "2nd Year"
      },
      {
        "id": "66eac0b7f740b2b3e5002caf",
        "email": "24057050@kiit.ac.in",
        "name": "OMKAR PATRA",
        "batch": "1st Year"
      },
      {
        "id": "66eae08cf740b2b3e5002cb1",
        "email": "22053056@kiit.ac.in",
        "name": "ARKA KUNDU",
        "batch": "3rd Year"
      },
      {
        "id": "66eaf36df740b2b3e5002cb3",
        "email": "22051015@kiit.ac.in",
        "name": "1015_SANSKAR SINGH",
        "batch": "3rd Year"
      },
      {
        "id": "66ebb8aaf740b2b3e5002cd2",
        "email": "22054071@kiit.ac.in",
        "name": "4071_Priyansh Sahu",
        "batch": "3rd Year"
      },
      {
        "id": "66ec05eef740b2b3e5002cda",
        "email": "23051003@kiit.ac.in",
        "name": "ANIKET SAHOO",
        "batch": "2nd Year"
      },
      {
        "id": "66ec2c88f740b2b3e5002cdf",
        "email": "2305926@kiit.ac.in",
        "name": "926_Aryaman Verma",
        "batch": "2nd Year"
      },
      {
        "id": "66ed1155f740b2b3e5002cf1",
        "email": "2328221@kiit.ac.in",
        "name": "ARYAN GUPTA",
        "batch": "2nd Year"
      },
      {
        "id": "66ed4319f740b2b3e5002cf3",
        "email": "23051110@kiit.ac.in",
        "name": "1110 JATINDRA DASH",
        "batch": "2nd Year"
      },
      {
        "id": "66ed91adf740b2b3e5002d41",
        "email": "24057004@kiit.ac.in",
        "name": "ABHISEK PAL",
        "batch": "1st Year"
      },
      {
        "id": "66ed9532f740b2b3e5002d4b",
        "email": "24052379@kiit.ac.in",
        "name": "SABBIR AHMED ABIR",
        "batch": "1st Year"
      },
      {
        "id": "66eda2b2f740b2b3e5002d5b",
        "email": "24155590@kiit.ac.in",
        "name": "TRIPTI RAJ",
        "batch": "1st Year"
      },
      {
        "id": "66ee4dd3f740b2b3e5002d70",
        "email": "24052389@kiit.ac.in",
        "name": "SUKANYA MITRA",
        "batch": "1st Year"
      },
      {
        "id": "66eea122f740b2b3e5002d75",
        "email": "2305600@kiit.ac.in",
        "name": "ANKIT JHA",
        "batch": "2nd Year"
      },
      {
        "id": "66eecdc9f740b2b3e5002d79",
        "email": "24052679@kiit.ac.in",
        "name": "ANUP KUMAR GUPTA",
        "batch": "1st Year"
      },
      {
        "id": "66eeddbff740b2b3e5002d7b",
        "email": "23052072@kiit.ac.in",
        "name": "Binit",
        "batch": "2nd Year"
      },
      {
        "id": "66eeebe3f740b2b3e5002d7c",
        "email": "23051500@kiit.ac.in",
        "name": "1500-DEBARPITA MOHANTY",
        "batch": "2nd Year"
      },
      {
        "id": "66efb2f5f740b2b3e5002d83",
        "email": "24052026@kiit.ac.in",
        "name": "SARTHAK SINGH",
        "batch": "1st Year"
      },
      {
        "id": "66efe53df740b2b3e5002d8a",
        "email": "2405026@kiit.ac.in",
        "name": "ABEER AGARWAL",
        "batch": "1st Year"
      },
      {
        "id": "66f02186f740b2b3e5002d8d",
        "email": "2305602@kiit.ac.in",
        "name": "5602_Anurag",
        "batch": "2nd Year"
      },
      {
        "id": "66f044dbf740b2b3e5002d93",
        "email": "23051760@kiit.ac.in",
        "name": "1760_Manish kumar Kandpan",
        "batch": "2nd Year"
      },
      {
        "id": "66f1458ef740b2b3e5002d99",
        "email": "2405137@kiit.ac.in",
        "name": "PRACHI RANJAN",
        "batch": "1st Year"
      },
      {
        "id": "66f18d25f740b2b3e5002d9e",
        "email": "24052614@kiit.ac.in",
        "name": "SHREYA JHA",
        "batch": "1st Year"
      },
      {
        "id": "66f1dacff740b2b3e5002da4",
        "email": "23051323@kiit.ac.in",
        "name": "AGNIPRAVO ALI",
        "batch": "2nd Year"
      },
      {
        "id": "66f2b169f740b2b3e5002dab",
        "email": "2430104@kiit.ac.in",
        "name": "MADHUSUDAN TRIPATHY",
        "batch": "1st Year"
      },
      {
        "id": "66f6a506f740b2b3e5002dbf",
        "email": "2405679@kiit.ac.in",
        "name": "RUDRAKSH SINHA",
        "batch": "1st Year"
      },
      {
        "id": "66f7b4e6f740b2b3e5002dc6",
        "email": "2405847@kiit.ac.in",
        "name": "TANISHQ ARYA",
        "batch": "1st Year"
      },
      {
        "id": "66f83c41f740b2b3e5002dc9",
        "email": "23053914@kiit.ac.in",
        "name": "Shivam Gupta",
        "batch": "2nd Year"
      },
      {
        "id": "66f8f428f740b2b3e5002dcf",
        "email": "24158073@kiit.ac.in",
        "name": "8073_SAI SWARUP MISHRA",
        "batch": "1st Year"
      },
      {
        "id": "66f9889cf740b2b3e5002dd2",
        "email": "24052654@kiit.ac.in",
        "name": "ROHIT GUPTA",
        "batch": "1st Year"
      },
      {
        "id": "66fa35d1f740b2b3e5002dd4",
        "email": "23051973@kiit.ac.in",
        "name": "1973_ALIMPAN",
        "batch": "2nd Year"
      },
      {
        "id": "66fcd048f740b2b3e5002dd9",
        "email": "24052730@kiit.ac.in",
        "name": "MANIBHUSHAN YADAV",
        "batch": "1st Year"
      },
      {
        "id": "67076156f740b2b3e5002e28",
        "email": "24052744@kiit.ac.in",
        "name": "PIYUSH KUMAR GUPTA",
        "batch": "1st Year"
      },
      {
        "id": "671127aa5a965de869c432b9",
        "email": "23053773@kiit.ac.in",
        "name": "PRINCE SHAH",
        "batch": "2nd Year"
      },
      {
        "id": "6713d3265a965de869c432ca",
        "email": "2228002@kiit.ac.in",
        "name": "ADITYA SINGH",
        "batch": "3rd Year"
      },
      {
        "id": "6713fc035a965de869c432cc",
        "email": "22052324@kiit.ac.in",
        "name": "324_ PREETI SUMAN",
        "batch": "3rd Year"
      },
      {
        "id": "671609005a965de869c432d4",
        "email": "23051805@kiit.ac.in",
        "name": "ABHIJEET PATRA",
        "batch": "2nd Year"
      },
      {
        "id": "671bcaea5a965de869c432e5",
        "email": "2205282@kiit.ac.in",
        "name": "282_DEBLEENA BISWAS (2205282_DEBLEENA)",
        "batch": "3rd Year"
      },
      {
        "id": "671d0e045a965de869c43310",
        "email": "24155063@kiit.ac.in",
        "name": "5063_Tanish",
        "batch": "1st Year"
      },
      {
        "id": "671d132c5a965de869c43313",
        "email": "2428010@kiit.ac.in",
        "name": "AYAN DAS",
        "batch": "1st Year"
      },
      {
        "id": "671d16c65a965de869c43317",
        "email": "24155128@kiit.ac.in",
        "name": "5128_SOHAN DAS",
        "batch": "1st Year"
      },
      {
        "id": "671e5b075a965de869c43346",
        "email": "23051630@kiit.ac.in",
        "name": "SNEHAN DEO",
        "batch": "2nd Year"
      },
      {
        "id": "671e67ca5a965de869c43348",
        "email": "24155654@kiit.ac.in",
        "name": "SAYAN PAL",
        "batch": "1st Year"
      },
      {
        "id": "671e9e165a965de869c43353",
        "email": "23053730@kiit.ac.in",
        "name": "SUMIT SHAH",
        "batch": "2nd Year"
      },
      {
        "id": "671fc22a5a965de869c43362",
        "email": "24051828@kiit.ac.in",
        "name": "AFREEN AKTAR",
        "batch": "1st Year"
      },
      {
        "id": "672277c45a965de869c433a8",
        "email": "24156093@kiit.ac.in",
        "name": "SAYAN MONDAL",
        "batch": "1st Year"
      },
      {
        "id": "672343665a965de869c433b7",
        "email": "24155986@kiit.ac.in",
        "name": "HRIDAY SHARMA",
        "batch": "1st Year"
      },
      {
        "id": "6723a4e55a965de869c433b9",
        "email": "2405393@kiit.ac.in",
        "name": "SWASTIK DAS MOHAPATRA",
        "batch": "1st Year"
      },
      {
        "id": "6723e1d95a965de869c433bc",
        "email": "24155772@kiit.ac.in",
        "name": "5772_Gunagnya Nayak",
        "batch": "1st Year"
      },
      {
        "id": "6724fec05a965de869c433ca",
        "email": "2429050@kiit.ac.in",
        "name": "MOHAMED ABDIRAHMAN WARSAME",
        "batch": "1st Year"
      },
      {
        "id": "672666b05a965de869c433e4",
        "email": "23053869@kiit.ac.in",
        "name": "RITU DAS_3869",
        "batch": "2nd Year"
      },
      {
        "id": "6726b9bc5a965de869c433ea",
        "email": "22054276@kiit.ac.in",
        "name": "Ayush Prasad",
        "batch": "3rd Year"
      },
      {
        "id": "6726e7245a965de869c433ed",
        "email": "2405314@kiit.ac.in",
        "name": "TANAYA DALABEHERA",
        "batch": "1st Year"
      },
      {
        "id": "672767075a965de869c433f8",
        "email": "24158142@kiit.ac.in",
        "name": "ABHINAV MISHRA",
        "batch": "1st Year"
      },
      {
        "id": "672847a55a965de869c43409",
        "email": "23052088@kiit.ac.in",
        "name": "PRIYANSHU RANJAN",
        "batch": "2nd Year"
      },
      {
        "id": "672861d55a965de869c4340f",
        "email": "24052369@kiit.ac.in",
        "name": "KRISHNASHIS BARMAN KABYA",
        "batch": "1st Year"
      },
      {
        "id": "6729cfeb5a965de869c4342e",
        "email": "23057048@kiit.ac.in",
        "name": "SOUHARDYA BOSE",
        "batch": "2nd Year"
      },
      {
        "id": "672cd3aa5a965de869c43468",
        "email": "24052768@kiit.ac.in",
        "name": "RODRO DEY DIPU",
        "batch": "1st Year"
      },
      {
        "id": "672cec855a965de869c4346a",
        "email": "2405739@kiit.ac.in",
        "name": "MRINAL SINGH",
        "batch": "1st Year"
      },
      {
        "id": "6730f9cd5a965de869c43499",
        "email": "24057110@kiit.ac.in",
        "name": "MAYUKH CHATTERJEE",
        "batch": "1st Year"
      },
      {
        "id": "67319f6b5a965de869c4349f",
        "email": "22052158@kiit.ac.in",
        "name": "2158_ SOHAM SAHU",
        "batch": "3rd Year"
      },
      {
        "id": "673231db5a965de869c434af",
        "email": "24159019@kiit.ac.in",
        "name": "TIYASHA CHOWDHURI",
        "batch": "1st Year"
      },
      {
        "id": "6734b2f55a965de869c434c3",
        "email": "2205214@kiit.ac.in",
        "name": "214_KANISHK RAJ",
        "batch": "3rd Year"
      },
      {
        "id": "67375e9a5a965de869c4352d",
        "email": "22053399@kiit.ac.in",
        "name": "3399_Ankita",
        "batch": "3rd Year"
      },
      {
        "id": "673782ff5a965de869c43534",
        "email": "2205733@kiit.ac.in",
        "name": "JAGANNATH BEHERA",
        "batch": "3rd Year"
      },
      {
        "id": "673829845a965de869c4353e",
        "email": "22052163@kiit.ac.in",
        "name": "2163 _Subhajit Senapati",
        "batch": "3rd Year"
      },
      {
        "id": "673833995a965de869c43544",
        "email": "22053911@kiit.ac.in",
        "name": "3911_SUVANSH CHOUDHARY",
        "batch": "3rd Year"
      },
      {
        "id": "673838b85a965de869c4354a",
        "email": "23057019@kiit.ac.in",
        "name": "7019_DEBASIS MISHRA",
        "batch": "2nd Year"
      },
      {
        "id": "673846465a965de869c4354e",
        "email": "22052095@kiit.ac.in",
        "name": "2095_ANKITA MAHAPATRA",
        "batch": "3rd Year"
      },
      {
        "id": "673859c45a965de869c43553",
        "email": "22053067@kiit.ac.in",
        "name": "3067_Debarchita",
        "batch": "3rd Year"
      },
      {
        "id": "673893b25a965de869c4355c",
        "email": "23052363@kiit.ac.in",
        "name": "TANMAYA DWIVEDY",
        "batch": "2nd Year"
      },
      {
        "id": "6738e98b5a965de869c43569",
        "email": "23057018@kiit.ac.in",
        "name": "BISESWAR SAHOO",
        "batch": "2nd Year"
      },
      {
        "id": "67390ae15a965de869c43570",
        "email": "2205304@kiit.ac.in",
        "name": "304_MEENAKSHI SAHU",
        "batch": "3rd Year"
      },
      {
        "id": "673970b05a965de869c43578",
        "email": "23051364@kiit.ac.in",
        "name": "1364 PRIYANSHU KUMAR",
        "batch": "2nd Year"
      },
      {
        "id": "67398fbe5a965de869c43585",
        "email": "23051071@kiit.ac.in",
        "name": "TANISHQ AGARKAR",
        "batch": "2nd Year"
      },
      {
        "id": "6739a0335a965de869c43589",
        "email": "2305931@kiit.ac.in",
        "name": "931 - Ayush",
        "batch": "2nd Year"
      },
      {
        "id": "6739ce4b5a965de869c43593",
        "email": "24051664@kiit.ac.in",
        "name": "SOUMYADIP DAS",
        "batch": "1st Year"
      },
      {
        "id": "6739e43d5a965de869c4359b",
        "email": "2305508@kiit.ac.in",
        "name": "508_ABINASH MOHANTY",
        "batch": "2nd Year"
      },
      {
        "id": "6739e68c5a965de869c4359e",
        "email": "2405751@kiit.ac.in",
        "name": "ROUNAK GOPE",
        "batch": "1st Year"
      },
      {
        "id": "673a13925a965de869c435aa",
        "email": "22053480@kiit.ac.in",
        "name": "ABHISHEK ACHARYA (22053480)",
        "batch": "3rd Year"
      },
      {
        "id": "673a32155a965de869c435b3",
        "email": "24051158@kiit.ac.in",
        "name": "ANJALI RAVISH",
        "batch": "1st Year"
      },
      {
        "id": "673a41be5a965de869c435c0",
        "email": "23053899@kiit.ac.in",
        "name": "MD MONAM HOSSAIN",
        "batch": "2nd Year"
      },
      {
        "id": "673b496a5a965de869c43605",
        "email": "2305015@kiit.ac.in",
        "name": "SNEHA BISWAS",
        "batch": "2nd Year"
      },
      {
        "id": "673b4af75a965de869c43607",
        "email": "24155790@kiit.ac.in",
        "name": "PRIYANSH SINGH",
        "batch": "1st Year"
      },
      {
        "id": "673b4b655a965de869c4360a",
        "email": "2330015@kiit.ac.in",
        "name": "ARKA MITRA",
        "batch": "2nd Year"
      },
      {
        "id": "673b567d5a965de869c4360f",
        "email": "23053063@kiit.ac.in",
        "name": "PRABAL DEEP 3063",
        "batch": "2nd Year"
      },
      {
        "id": "673b6b0b5a965de869c43614",
        "email": "241551024@kiit.ac.in",
        "name": "1024_ankita",
        "batch": "1st Year"
      },
      {
        "id": "673b71d85a965de869c43617",
        "email": "2428059@kiit.ac.in",
        "name": "AYUB ABDISALAN DUALE",
        "batch": "1st Year"
      },
      {
        "id": "673bbc085a965de869c4362b",
        "email": "23053848@kiit.ac.in",
        "name": "PROSANJIT GUPTA",
        "batch": "2nd Year"
      },
      {
        "id": "673c2dc35a965de869c4363d",
        "email": "23051035@kiit.ac.in",
        "name": "1035NUPUR KUMARI",
        "batch": "2nd Year"
      },
      {
        "id": "673c47935a965de869c43645",
        "email": "23052234@kiit.ac.in",
        "name": "AYUSH KUMAR",
        "batch": "2nd Year"
      },
      {
        "id": "673c53165a965de869c43648",
        "email": "2306379@kiit.ac.in",
        "name": "379_HRUSHIKESH BEHERA",
        "batch": "2nd Year"
      },
      {
        "id": "673de5c65a965de869c43685",
        "email": "23051604@kiit.ac.in",
        "name": "NAYANI PAUL",
        "batch": "2nd Year"
      },
      {
        "id": "673def7b5a965de869c4368b",
        "email": "2405669@kiit.ac.in",
        "name": "NIHAL SINGH",
        "batch": "1st Year"
      },
      {
        "id": "673ec9485a965de869c436a3",
        "email": "23052768@kiit.ac.in",
        "name": "SWASTIK NAYAK",
        "batch": "2nd Year"
      },
      {
        "id": "673eccea5a965de869c436a5",
        "email": "23052380@kiit.ac.in",
        "name": "ALOK BHARDWAJ",
        "batch": "2nd Year"
      },
      {
        "id": "673f08265a965de869c436ae",
        "email": "2305402@kiit.ac.in",
        "name": "5402_SABYASACHI MISHRA",
        "batch": "2nd Year"
      },
      {
        "id": "673f462b5a965de869c436b6",
        "email": "2205342@kiit.ac.in",
        "name": "342_UDAY CHAKRABORTY",
        "batch": "3rd Year"
      },
      {
        "id": "673fde015a965de869c436bf",
        "email": "24057055@kiit.ac.in",
        "name": "PRIYANSHU THAKUR",
        "batch": "1st Year"
      },
      {
        "id": "67415e085a965de869c436e5",
        "email": "24051829@kiit.ac.in",
        "name": "AGNISHWAR RANJIT",
        "batch": "1st Year"
      },
      {
        "id": "6741fd095a965de869c436f7",
        "email": "24155109@kiit.ac.in",
        "name": "MANAS KAUSHAL",
        "batch": "1st Year"
      },
      {
        "id": "6742295f5a965de869c436fe",
        "email": "2305182@kiit.ac.in",
        "name": "YACHNA SHIVALI",
        "batch": "2nd Year"
      },
      {
        "id": "67440ac35a965de869c43726",
        "email": "24052485@kiit.ac.in",
        "name": "SHUBHAYAN CHAKRABORTY",
        "batch": "1st Year"
      },
      {
        "id": "67455b9f5a965de869c43743",
        "email": "24052391@kiit.ac.in",
        "name": "SUYASH GUPTA",
        "batch": "1st Year"
      },
      {
        "id": "6745beb672375d8fe31136de",
        "email": "2229055@kiit.ac.in",
        "name": "RYAN",
        "batch": "3rd Year"
      },
      {
        "id": "6746b19172375d8fe311377f",
        "email": "22053234@kiit.ac.in",
        "name": "3234_AYUSH KISHOR",
        "batch": "3rd Year"
      },
      {
        "id": "6746ba4972375d8fe311378d",
        "email": "22051985@kiit.ac.in",
        "name": "1985_SMAYAN KUMAR",
        "batch": "3rd Year"
      },
      {
        "id": "6746d28272375d8fe31137ae",
        "email": "2205668@kiit.ac.in",
        "name": "5668_SAMPURNA SEN",
        "batch": "3rd Year"
      },
      {
        "id": "6746dcf172375d8fe31137be",
        "email": "23052078@kiit.ac.in",
        "name": "KAUSTUBH TIWARI",
        "batch": "2nd Year"
      },
      {
        "id": "6746ecb972375d8fe31137da",
        "email": "22053047@kiit.ac.in",
        "name": "3047_ABHIJEET RAJ",
        "batch": "3rd Year"
      },
      {
        "id": "6746eccc72375d8fe31137dc",
        "email": "22054316@kiit.ac.in",
        "name": "AJAY KUMAR",
        "batch": "3rd Year"
      },
      {
        "id": "6746fd0e72375d8fe31137f7",
        "email": "2206146@kiit.ac.in",
        "name": "6146_vidisha",
        "batch": "3rd Year"
      },
      {
        "id": "6747106572375d8fe311381d",
        "email": "22052813@kiit.ac.in",
        "name": "2813_DIVYANSH MODI",
        "batch": "3rd Year"
      },
      {
        "id": "6747121372375d8fe3113820",
        "email": "2229166@kiit.ac.in",
        "name": "SUMEDHA PAL",
        "batch": "3rd Year"
      },
      {
        "id": "6747163f72375d8fe311382a",
        "email": "22053058@kiit.ac.in",
        "name": "ARPANKUMAR DAS",
        "batch": "3rd Year"
      },
      {
        "id": "67471a2272375d8fe3113831",
        "email": "2306279@kiit.ac.in",
        "name": "279_DrishtiJoshi",
        "batch": "2nd Year"
      },
      {
        "id": "674720db72375d8fe311383d",
        "email": "22053233@kiit.ac.in",
        "name": "3233_AVIRUP BANERJEE",
        "batch": "3rd Year"
      },
      {
        "id": "67472c3a72375d8fe3113855",
        "email": "22051236@kiit.ac.in",
        "name": "ANIRUDHA DEY",
        "batch": "3rd Year"
      },
      {
        "id": "674738df72375d8fe311387c",
        "email": "22052234@kiit.ac.in",
        "name": "SAPTARSHI PAL",
        "batch": "3rd Year"
      },
      {
        "id": "6747411e72375d8fe311389d",
        "email": "22051786@kiit.ac.in",
        "name": "SANDIPAN BASAK",
        "batch": "3rd Year"
      },
      {
        "id": "674756a2539efe3be1810d89",
        "email": "2205344@kiit.ac.in",
        "name": "344_VANSH RAJ SOOD",
        "batch": "3rd Year"
      },
      {
        "id": "674757d9539efe3be1810d8f",
        "email": "22051301@kiit.ac.in",
        "name": "VEDRAJ THAKUR",
        "batch": "3rd Year"
      },
      {
        "id": "67476179539efe3be1810db4",
        "email": "22051190@kiit.ac.in",
        "name": "Sanak Aich Bhowmick",
        "batch": "3rd Year"
      },
      {
        "id": "67476420539efe3be1810db9",
        "email": "22053547@kiit.ac.in",
        "name": "SHIVANI NAYAK (22053547)",
        "batch": "3rd Year"
      },
      {
        "id": "6747b708539efe3be1810de7",
        "email": "2306003@kiit.ac.in",
        "name": "003_Abhilasha Kakoty",
        "batch": "2nd Year"
      },
      {
        "id": "6747f4a8539efe3be1810e21",
        "email": "22051806@kiit.ac.in",
        "name": "1806_Suhita Sikdar",
        "batch": "3rd Year"
      },
      {
        "id": "6747f4e7539efe3be1810e24",
        "email": "22052085@kiit.ac.in",
        "name": "2085_YASH RAJ",
        "batch": "3rd Year"
      },
      {
        "id": "6747f590539efe3be1810e2c",
        "email": "22052039@kiit.ac.in",
        "name": "2039_PRATYAY SAMANTA",
        "batch": "3rd Year"
      },
      {
        "id": "6747fa26539efe3be1810e58",
        "email": "22053036@kiit.ac.in",
        "name": "UTKARSH SINGH",
        "batch": "3rd Year"
      },
      {
        "id": "674800eb539efe3be1810e7d",
        "email": "22053846@kiit.ac.in",
        "name": "ARMAAN GUPTA",
        "batch": "3rd Year"
      },
      {
        "id": "674801ea539efe3be1810e80",
        "email": "2205813@kiit.ac.in",
        "name": "5813_Kanya Sahu",
        "batch": "3rd Year"
      },
      {
        "id": "67481a12539efe3be1810ec6",
        "email": "2205534@kiit.ac.in",
        "name": "534_ANKAN BANERJEE",
        "batch": "3rd Year"
      },
      {
        "id": "674865a55be95033336bffef",
        "email": "22053972@kiit.ac.in",
        "name": "3972_Rishabh Shrivastav",
        "batch": "3rd Year"
      },
      {
        "id": "6748795e5be95033336bfffb",
        "email": "2205484@kiit.ac.in",
        "name": "484_Piyush",
        "batch": "3rd Year"
      }
    ];

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
    const subjects = [

      {
        "id": "65d212841bdc9aab413387ef",
        "name": "ENVIROMENTAL SCIENCE",
        "SUBCODE": "CH10003",
        "Credit": "2",
        "folderId": "1yRnAfw0Z1C1RHZPbO2sm2tO4ETG-T-SK",
        "pyqs": [
          {
            "id": "c41c0a6c-3a30-4b1a-9e8c-273afe4770ae",
            "name": "Autumn Mid Sem Exam",
            "year": "2016",
            "type": "MID SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1fHNJ9lGjE5ZCl9pSlWSD5KCebEru-vd9",
            "solution": null,
            "nQuestion": "1dmYzXnCBFO3JLyZqS8I0uDXDqQdczMhY",
            "nSolution": null
          },
          {
            "id": "c86e4eec-70b5-4515-bafc-0db2c52912a3",
            "name": "Autumn Mid Sem Exam",
            "year": "2015",
            "type": "Mid Semester",
            "status": "APPROVED",
            "solutionUploadedBy": "66203d24ad6e7bd16c843f45",
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "11tIG2snbOCe3tmilTYsxVabo2vPJhOoe",
            "solution": "1-XyZYdTLKBGmUlG0zzwefitizo4nKgGu",
            "nQuestion": "11tIG2snbOCe3tmilTYsxVabo2vPJhOoe",
            "nSolution": "1-2ILaqN1zpUjSAl3McefaEp7aGl47iUn"
          },
          {
            "id": "e1d7a131-7456-4e34-9869-ee812966aa03",
            "name": "Spring End Sem Exam",
            "year": "2016",
            "type": "End Semester",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1V87XY_dak-JQ6MNdf6GiGrG_lGqDnwN5",
            "solution": null,
            "nQuestion": "1V87XY_dak-JQ6MNdf6GiGrG_lGqDnwN5",
            "nSolution": null
          },
          {
            "id": "655abfd7-edf7-4eb3-beda-0f3da533459e",
            "name": "Autumn End Sem Exam",
            "year": "2016",
            "type": "END SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1TWRE8aEvPoo2NN0dqlL3CHOaJGfUjqcx",
            "solution": null,
            "nQuestion": "1zV2_brMBj-Je3Rcbgm4VmDWRISBT47lT",
            "nSolution": null
          },
          {
            "id": "f13f59e9-03f2-458c-ae71-1899be63ba70",
            "name": "Autumn End Sem Exam",
            "year": "2015",
            "type": "End Semester",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1t2t7F2XIWyCb28ahTsJN9YL2kPZ9MpgF",
            "solution": null,
            "nQuestion": "1t2t7F2XIWyCb28ahTsJN9YL2kPZ9MpgF",
            "nSolution": null
          },
          {
            "id": "042e7bb7-6cf9-4f24-97a6-fc44351a4a7d",
            "name": "Autumn Mid Sem",
            "year": "2014",
            "type": "MID SEMESTER",
            "status": "APPROVED",
            "solutionUploadedBy": "66fe42b4f740b2b3e5002dde",
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1YLkhbRkR8Gt4Q12r0OTv4drvtniwatZO",
            "solution": "1wuQKjhcqN7cA8pMvVCuMsFgRlF9vXJUU",
            "nQuestion": "16RZcZcsrKiLWdbksjD1W0ltToHsfny98",
            "nSolution": "1zIXqSe3igh_jXK3MKER-eaDGtvOJ68PW"
          },
          {
            "id": "acce4c1a-5b2d-4c8e-86ee-3f8c818ca1c1",
            "name": "Autumn End Sem",
            "year": "2015",
            "type": "END SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1wLXfqdh0zGIcYrPk2MAEV4kCaTZ7JNIQ",
            "solution": null,
            "nQuestion": "1iVWcGNWmqi3ymyQj9GnkgVlmX4oNHa59",
            "nSolution": null
          },
          {
            "id": "28df80b3-457a-4820-92ec-16f08fa510f1",
            "name": "Mid Sem",
            "year": "2015",
            "type": "MID SEMESTER",
            "status": "APPROVED",
            "solutionUploadedBy": "66fe4821f740b2b3e5002ddf",
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1xMMUvNAgO3UBO_86hb1D7FLesTUx4vS_",
            "solution": "1dImCCPtpVAlaNCNle5Ek_8w0XO5Aveoi",
            "nQuestion": "1gf3QbJHPdn_DwZ4aC5Az1IKRkFCEVd_y",
            "nSolution": "11b0px-0t_3F64JJ1-0Kqgt9YwfCT4Tfh"
          },
          {
            "id": "de40284e-7d72-4f54-804f-f1cea07bccd2",
            "name": "Spring End Sem",
            "year": "2013",
            "type": "END SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1gn0TWWoD18PMETSKfvaDSCOV08IFYvps",
            "solution": null,
            "nQuestion": "12lhBO6Uy70WF6AYA3mRLdkaG9kya7JTb",
            "nSolution": null
          },
          {
            "id": "727ca344-f96e-4331-9583-94f664c79d91",
            "name": "Spring End Sem",
            "year": "2014",
            "type": "END SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1DQPjWsc3w_D77bmgKYl7516-Xgm27RPm",
            "solution": null,
            "nQuestion": "1hPSdsJqRA8FAOB2OMRQyj1tWrjvIKrVW",
            "nSolution": null
          },
          {
            "id": "cf2ffc8f-4aaa-4ef5-b2f5-8b598f568389",
            "name": "Spring End Sem",
            "year": "2016",
            "type": "END SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1vq-BHkF2Uq8p0x52MkK-zqfOASIHL-ek",
            "solution": null,
            "nQuestion": "16wb4QluWTzGVreOvpYFOnDT66I5eZUag",
            "nSolution": null
          },
          {
            "id": "214923c7-e4b7-4a2c-ab5e-a7279d23294d",
            "name": "Spring Mid Sem",
            "year": "2015",
            "type": "MID SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1OVmStLcfsYvWIBou0RdBc3XG4QXHjrVB",
            "solution": null,
            "nQuestion": "1KJbldM_UAYYibcH93Av40Q3l3tweVY_W",
            "nSolution": null
          },
          {
            "id": "5d4f1396-d2ba-481e-bc35-b2535d6f9161",
            "name": "Spring End Sem",
            "year": "2015",
            "type": "END SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "139njXA_7jCANfF3Q-5vT2u8uc9aEaTak",
            "solution": null,
            "nQuestion": "1gm77lwSZdCRpwhiX2NtFFi0R_-xjSk85",
            "nSolution": null
          },
          {
            "id": "27dc4c4d-68d3-488c-b98f-82a8b574074b",
            "name": "Autumn Mid Sem",
            "year": "2017",
            "type": "MID SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1w-JpZeV38Y1cEPsQIGfNyWJL7A0KgN9H",
            "solution": null,
            "nQuestion": "1dbu_NxW9Zo46iVdaK-ygM-WkIXqtiYSf",
            "nSolution": null
          },
          {
            "id": "91010b7e-e32f-4de2-9748-ef8ff3fc888f",
            "name": "Autumn End Sem-2",
            "year": "2015",
            "type": "END SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "10pGErclKv4y5BA2XIi9tuveTnSM7PZrI",
            "solution": null,
            "nQuestion": "1xHo8aADXKAz7-0PS_Z_sQTnQQPo8yWMU",
            "nSolution": null
          },
          {
            "id": "2bf5b8d5-a41e-4388-a93b-292b94386b6d",
            "name": "Spring End Sem",
            "year": "2017",
            "type": "END SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1h0xlZUTivANlt8UPG7u5bu0iwJsQP0Gt",
            "solution": null,
            "nQuestion": "161G1lkvccvLAgHt8xS5IyZAd0XoKzsr0",
            "nSolution": null
          },
          {
            "id": "bba3aad8-7631-4117-aa0c-1eaff7d47f7c",
            "name": "Spring End Sem",
            "year": "2016",
            "type": "END SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1jN_eMplmytpzRBDZCNRJ_P5dPIvOkSRS",
            "solution": null,
            "nQuestion": "1OSpsrEXe8F_mbZ3R2UBvvZvLs-asiN2n",
            "nSolution": null
          },
          {
            "id": "c39898af-566f-4d02-ab4a-71562fe2f07d",
            "name": "Spring End Sem",
            "year": "2018",
            "type": "END SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "13MFM4wD6xrSM1Xq7SYOw_cCve2KvAmfp",
            "solution": null,
            "nQuestion": "1DBGDoT50eNbyFkCxY8PxtTCo5DdNGl9V",
            "nSolution": null
          },
          {
            "id": "d61a9808-8731-4635-9445-96c7f581958f",
            "name": "Autumn End Sem",
            "year": "2023",
            "type": "END SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1ptcTs-ATjF3v43ORF0dVzHbjXu5zJR8v",
            "solution": null,
            "nQuestion": "1quFZXcPiNoBeAbv1jAcVzqSGL28UwNog",
            "nSolution": null
          },
          {
            "id": "6392c073-2ffd-4390-b19d-390c1f71b7ef",
            "name": "Spring End Sem",
            "year": "2023",
            "type": "END SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1UyRlD2e0jTAHVzCPAdzv9YeTEJj2PWUC",
            "solution": null,
            "nQuestion": "1Rejy3YT4p8Ny-2Mk0Ym9nOY1xLKowomd",
            "nSolution": null
          },
          {
            "id": "e2c45864-a82d-4212-9e28-906abc977da2",
            "name": "Autumn End Sem",
            "year": "2017",
            "type": "END SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1VfgueJ8I3petGYT4eOdfHdc2BRhJrVrd",
            "solution": null,
            "nQuestion": "1jVEz0-ca_V1DmKv7z8GlIr0MDOKdIyU5",
            "nSolution": null
          },
          {
            "id": "8b6b70a5-e773-4cd7-b2b9-5dc129e91667",
            "name": "Spring Mid Sem",
            "year": "2018",
            "type": "MID SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1IvhjgYvQ_eB8aeuXwBR9vcmu3MolEuEJ",
            "solution": null,
            "nQuestion": "1v4u3rq2r7GPQ7ty0JBnxGZMjjYDY1Drh",
            "nSolution": null
          },
          {
            "id": "66d189cb-01b9-4542-ab7b-4e0d12201aba",
            "name": "Autumn End Sem",
            "year": "2022",
            "type": "END SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "17rkR074i0S6Dp75OsOJgN3o7ukqQd-5Y",
            "solution": null,
            "nQuestion": "1P1-83OnkSJqgjlXFOLyZziidNQCo323W",
            "nSolution": null
          },
          {
            "id": "2708e468-f046-4da5-b6c3-0fc8504a7d27",
            "name": "Mid Sem",
            "year": "2017",
            "type": "MID SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1F_C1FoiYKALeLjUMjMZai13TaFoAs2L0",
            "solution": null,
            "nQuestion": "1qkMzMd6FlYcN8UsRFLqf9rCKGOGMjX3Z",
            "nSolution": null
          },
          {
            "id": "68830a5d-eda5-423f-af32-4c8fcd9168de",
            "name": "Redmid",
            "year": "2017",
            "type": "MID SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1wWfBt6NnCLjV4SvzhatEWLVwcwoL5ZCh",
            "solution": null,
            "nQuestion": "1IXcQOB35qPYku2ht2doKkgVdI4DkaTO-",
            "nSolution": null
          },
          {
            "id": "db6c7590-a567-4bb3-8e9e-6fc249a4f53f",
            "name": "Spring End Sem",
            "year": "2024",
            "type": "END SEMESTER",
            "status": "APPROVED",
            "solutionUploadedBy": "66f2dc45f740b2b3e5002daf",
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1fTWc5IeZkzt4kujYJMWHiaEEOg0skirM",
            "solution": "1LBevnso89SEO-FyZV26GQb6I2xczT3jd",
            "nQuestion": "1OBAjmuKNsWnEDlnGKWWqHUnDKc2Qp1yb",
            "nSolution": "10Um7zLqn-Lgy2gYatjNNYUi7mNSIfYPs"
          }
        ]
      },



      {
        "id": "65d213b11bdc9aab413387f5",
        "name": "CHEMISTRY",
        "SUBCODE": "CH10001",
        "Credit": "3",
        "folderId": "169Oi8YbSco-OJmkZE6LKnnty62IekBOM",
        "pyqs": [
          {
            "id": "b459ef55-145b-4dc1-b450-8273f879eece",
            "name": "Autumn Mid Sem Exam",
            "year": "2015",
            "type": "MID SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1Az7NeFmz_jHoGctZiGL94s6VSTHYWzoD",
            "solution": null,
            "nQuestion": "1__bnWCsr8RRdZvnfH0LezCEKNbTjeo8_",
            "nSolution": null
          },
          {
            "id": "e4233b06-31e3-4f22-9bfe-b7ae3bc5d263",
            "name": "Spring Mid Sem Exam",
            "year": "2014",
            "type": "MID SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1ECd2F5yiMWJh-cER1VK9X_sbTjH-h9Ay",
            "solution": null,
            "nQuestion": "186WXXykk-M7htnNfkrbP4Gnk8eOMEvwf",
            "nSolution": null
          },
          {
            "id": "195fc947-be12-4e95-92c8-dc14f370a8ca",
            "name": "Spring End Sem Exam",
            "year": "2018",
            "type": "END SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "14Ng4RV1qk365j5j9IYRWdOZAWQ279YNu",
            "solution": null,
            "nQuestion": "1x6ZQzKFjrVXAtzo2MRwSmUeqq2jV0HK5",
            "nSolution": null
          },
          {
            "id": "ae7db469-8db9-44ca-83d0-3f41eaf2ec00",
            "name": "Autumn End Sem Exam",
            "year": "2017",
            "type": "END SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1spM0dVDHzPj8R-DRfhpo9Sb_X7tr_By5",
            "solution": null,
            "nQuestion": "1Py7hnvF8bEEn544YAT8dL8MXpWOfGqwh",
            "nSolution": null
          },
          {
            "id": "dc8c3f94-7be3-4364-bfe6-dc8b2d79db99",
            "name": "Spring End Sem Exam",
            "year": "2016",
            "type": "END SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "15U4jFFz5GcW9I3lOhv4ghV3Y8qQO-RyI",
            "solution": null,
            "nQuestion": "1q6Au2a3U55L6FHx1OQbfaNEwPtAWu9o4",
            "nSolution": null
          },
          {
            "id": "c08d1f12-a1cc-4e8d-9899-a5ef01fe94a2",
            "name": "Autumn End Sem Exam",
            "year": "2016",
            "type": "END SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1EsvVrWAvDV5h_Oj8lUtKF6rqEkQuSKnL",
            "solution": null,
            "nQuestion": "1kcxF2inuh5mScaIxBEE0ZOAf63Aa31mU",
            "nSolution": null
          },
          {
            "id": "e543192f-8c1e-4759-9aec-62976dd00868",
            "name": "Spring End Sem Exam",
            "year": "2013",
            "type": "END SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1TB-suqBQ9QJycYHZjvJS1iJIYn6XbgUe",
            "solution": null,
            "nQuestion": "19EWtR78TcgyLbVaFrpud3qSxvWfbKwRQ",
            "nSolution": null
          },
          {
            "id": "207ce548-0b89-43fd-b4d5-f4c44221b93c",
            "name": "Autumn Mid Sem",
            "year": "2017",
            "type": "MID SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1TtXFOEUecYj2slrvPQt5kT27QZzFTZiW",
            "solution": null,
            "nQuestion": "1HVhf1t1BPcgOs4PJUH90FzPEEbNRK6J9",
            "nSolution": null
          },
          {
            "id": "3bb371f1-7e11-42b4-a69d-97e9bf91de44",
            "name": "Autumn End Sem",
            "year": "2015",
            "type": "END SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1MmDTv4G31i5rwOpp0jNiFkEFGf3kgcLR",
            "solution": null,
            "nQuestion": "1IxTWa6_ckh3pCVSKC_6i2VhFR2aOIzEn",
            "nSolution": null
          },
          {
            "id": "49a9feb5-037b-42f2-9953-f151829d7c43",
            "name": "Spring End Sem",
            "year": "2015",
            "type": "END SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1BGeuINYRTffDFiZC8bw0Wi9SN9NegX_z",
            "solution": null,
            "nQuestion": "178appfjFvw82ZWIKxTfuuR_iuJY7_vgj",
            "nSolution": null
          },
          {
            "id": "fe233d12-3565-4d0d-9659-debe6996ea16",
            "name": "Spring End Sem",
            "year": "2017",
            "type": "END SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1tvuisnGxfLTD0h3k4myQVOIpxHTNyzpP",
            "solution": null,
            "nQuestion": "1h9g01sf09g4iMTO9R8jSnXWaVwTBf_je",
            "nSolution": null
          },
          {
            "id": "7b588ffb-e9af-44ce-b14f-ad2d0606bc90",
            "name": "Spring End Sem",
            "year": "2015",
            "type": "END SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1onLubZtsy2NT2hf56yNYIz3rv5-FDRD0",
            "solution": null,
            "nQuestion": "18vFLAedqItrailgS4mHYZxsCtk1K0Xuh",
            "nSolution": null
          },
          {
            "id": "e002acde-c06b-4aff-bfee-923a48eb3fa7",
            "name": "Autumn End Sem",
            "year": "2014",
            "type": "END SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1MPecTUx2N6Pn6GtF42rLr2Z_uNuF0Q77",
            "solution": null,
            "nQuestion": "1VAzkksdEsZ77T_U_wqXmP1oCAF7vdfOT",
            "nSolution": null
          },
          {
            "id": "711dd448-7b7b-47d8-9ca9-b3c375419779",
            "name": "Autumn End Sem",
            "year": "2016",
            "type": "END SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1f8TL3D15lsuO9OvOlL7YNuHHmnd1NJfH",
            "solution": null,
            "nQuestion": "1AcPsXkVGxGggMJoLZ_OpRz_DC3cnEn7p",
            "nSolution": null
          },
          {
            "id": "1fc8eae3-1a6e-44cd-bc1d-e4217d17a9ef",
            "name": "End Sem",
            "year": "2010",
            "type": "END SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1_mCPCUP0Ap2mkJ145j0XJMa-nSiLMUaX",
            "solution": null,
            "nQuestion": "17gD1ZfJinBPwEG6EHDzhc0iIdl_NirRb",
            "nSolution": null
          },
          {
            "id": "723aac93-c7be-4e1a-8675-d1eb529059bd",
            "name": "End Sem",
            "year": "2011",
            "type": "END SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1Qaug-GkqL9XcZ-QJ_mfvEzYLZjgwdahX",
            "solution": null,
            "nQuestion": "1BlVNmaKpM4_sjutuhQD-pwD43ZGer6fp",
            "nSolution": null
          },
          {
            "id": "18f5c731-6275-4f47-93c8-40c9dc2fb1f9",
            "name": "End Sem",
            "year": "2023",
            "type": "END SEMESTER",
            "status": "APPROVED",
            "solutionUploadedBy": "66f2dda6f740b2b3e5002db1",
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1OZ6CLmY3eYTs6lIaF3v46vUsQRzLboNw",
            "solution": "1Vx28RCJAZUVCvnAJjUyHsQ0XJm0AlR6g",
            "nQuestion": "1ovcqrJ12KkxslpYvr6o1elSEHfFx59eW",
            "nSolution": "1SdnZf25C33_sJItUYWMZt61YJUaVk3yH"
          },
          {
            "id": "939a65a9-f99e-4793-9346-fcf9a0b4dbd6",
            "name": "Autumn End Sem",
            "year": "2022",
            "type": "END SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1HRLw8Wb8gC7sTaKiOy2BrGAEAvtUzxoT",
            "solution": null,
            "nQuestion": "1JQS4uDEGBSWpRDaXegQvm0Bwy-5IShze",
            "nSolution": null
          },
          {
            "id": "a2fd75c8-894f-473f-a361-42189bab5f7a",
            "name": "Autumn End Sem",
            "year": "2020",
            "type": "END SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1NFdmgnZ_Z-8UWYEfJRYplV5U4nfPYVeP",
            "solution": null,
            "nQuestion": "1qspnQcBZEq3bjRi1QhIulXRVZrc4DsmK",
            "nSolution": null
          },
          {
            "id": "e0740327-d715-42b1-b164-b9e3305e34db",
            "name": "Autumn End Sem",
            "year": "2021",
            "type": "END SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1O9pWT260wiOqgadmbDGbYFkj-iu1EX9E",
            "solution": null,
            "nQuestion": "1cP1Sn88boqZiZaXljUXgNn5QbNM_4uF3",
            "nSolution": null
          },
          {
            "id": "7edeedc9-fa5e-4cd1-bacc-8ea334dbb8ee",
            "name": "Autumn Mid Sem",
            "year": "2016",
            "type": "MID SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1qnoPlEXy-xNcX3RfW4ur2sM04k5eDhuP",
            "solution": null,
            "nQuestion": "1-NqYqmxLckDAJUR_ZMssAnNE7ix7NRCq",
            "nSolution": null
          },
          {
            "id": "0d8c5509-9070-4c4f-86cd-ab12e5d9a9e8",
            "name": "Spring End Sem",
            "year": "2023",
            "type": "END SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1Y2LtFGY6TdC4DRxxAi_N6r8r-IviHJie",
            "solution": null,
            "nQuestion": "1Dug7hYHZsrOq5ow_bclPc0dIeq7fnE6u",
            "nSolution": null
          },
          {
            "id": "54578a8e-9ffd-4ebc-998f-4673d9c4663a",
            "name": "Autumn Mid Sem",
            "year": "2019",
            "type": "MID SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1L3lzAoMVFWKl8rGwg0MiwAmy0jpMmXsG",
            "solution": null,
            "nQuestion": "1TlxEnC6uen-daIuy8y2rl2Md3im0aP88",
            "nSolution": null
          },
          {
            "id": "9a62f656-ae55-4698-94a0-694116cee5b5",
            "name": "Spring End Sem",
            "year": "2021",
            "type": "END SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1pQp2NK2G_-JR-isz8dhbgx2ATI_iztF8",
            "solution": null,
            "nQuestion": "1wV95kMrEMFohOdRBAf-NIXRYaILddnXK",
            "nSolution": null
          },
          {
            "id": "b4000091-588e-4284-b806-13562ec6f8c1",
            "name": "Autumn End Sem",
            "year": "2019",
            "type": "END SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1l1_6-TQi2XOL5TfIOoYe1hdxljNL_2Md",
            "solution": null,
            "nQuestion": "1CZwhNw-kS6rsVgxpiP9X85TqcqVubas-",
            "nSolution": null
          },
          {
            "id": "6dffec64-8062-4723-be1b-6c2b4dd04e19",
            "name": "Autumn End Sem-2",
            "year": "2019",
            "type": "END SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1y48m98G4vhawYkZiaTwXtNk6ubXvMsOS",
            "solution": null,
            "nQuestion": "1_-P3ZqqJZkfjU5eCckEdH7YCgP7-0iac",
            "nSolution": null
          },
          {
            "id": "b06c7609-0cb2-4c7e-8c46-2b0351e11739",
            "name": "Spring Mid Sem",
            "year": "2018",
            "type": "MID SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1xa7Y61aNDVoObLv_PFFCjkZ39OLG6wpk",
            "solution": null,
            "nQuestion": "1ZB5VWREAFVPSMYj8tPOarCb7L_AOEKLD",
            "nSolution": null
          },
          {
            "id": "619d8287-1aae-492b-a7dc-ad8823f0a107",
            "name": "Autumn End Sem",
            "year": "2018",
            "type": "END SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1jQhqb0ZoyOu3RoS9R-RJZQxqohkCKbXX",
            "solution": null,
            "nQuestion": "1JK32gq5Lsw3wVkol5v4ibhkgK_caNpBG",
            "nSolution": null
          },
          {
            "id": "47a5868f-ff5b-4c81-a100-7d0e971cf0b3",
            "name": "Autumn Mid Sem",
            "year": "2018",
            "type": "MID SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1Yya6aRpPG3lKxLZjGlrZECW_x6EkxOop",
            "solution": null,
            "nQuestion": "1iOVjFmoL2apsMG0-jZy5b7V64wz9zcxL",
            "nSolution": null
          },
          {
            "id": "7f3cc5ee-e7f0-4e48-b326-0dd29d7f588c",
            "name": "Spring End Sem",
            "year": "2019",
            "type": "END SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1fIFVZMzJIjgcMO_HPB7vqLC9o8J4x_Iz",
            "solution": null,
            "nQuestion": "1wjDiLaQKLkWUdb-35x6cr5x43HZdVPuN",
            "nSolution": null
          },
          {
            "id": "e4f73427-e21b-44f9-b0b9-8f228f789c3a",
            "name": "Spring Mid Sem",
            "year": "2019",
            "type": "MID SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1zSJlq5XqsX0NgAwkSYWGbBpR0fo7uCFc",
            "solution": null,
            "nQuestion": "1k0h_Kae-vdYcdNtF-8RLz1OKAfZEppD9",
            "nSolution": null
          },
          {
            "id": "3cd976ea-b010-4355-9384-01f1cb4accae",
            "name": "Spring Mid Sem",
            "year": "2017",
            "type": "MID SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1A0U4DRh5PCAas-qz79mOtDP4ZoBx57cA",
            "solution": null,
            "nQuestion": "1vSaD9TWbKVkYSb46dnnMcZucGyQ_qq5n",
            "nSolution": null
          },
          {
            "id": "04259ed7-246d-4be7-bc01-dfc1f1d5ec2a",
            "name": "Autumn End Sem-2",
            "year": "2014",
            "type": "END SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1456hNMADB-NTbOcHfzRQ4gy9CHU4xvGW",
            "solution": null,
            "nQuestion": "1a-63k8lr47olKKJYOhGxcBDbEBLzFF3l",
            "nSolution": null
          },
          {
            "id": "7fcaef17-a051-4dcf-aa85-c773ff6c138b",
            "name": "Spring End Sem",
            "year": "2014",
            "type": "END SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1yUmYNiu3Mj2inWXgQfJ3zyE1SPv900ho",
            "solution": null,
            "nQuestion": "1QXH0SieXNULkoo1kthA5uOA7EcPYO6Y-",
            "nSolution": null
          },
          {
            "id": "f550724b-244c-4b35-896d-503506a009d3",
            "name": "Spring End Sem-2",
            "year": "2014",
            "type": "END SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1ejN_cQRTpAiMEqXFW11iCF3EdBS75HcD",
            "solution": null,
            "nQuestion": "16OWxTF6dN6UCsGiDEnV5JFzVwjEcWjdM",
            "nSolution": null
          },
          {
            "id": "2dabed8f-d047-487a-a504-a8e5798e04fb",
            "name": "Redmid",
            "year": "2017",
            "type": "MID SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "14GWvGssZhcwVmyvvumGTbktfCYtGdKBQ",
            "solution": null,
            "nQuestion": "1-DBJS5e3pwXAhX0D6MoHicX-JGYtTBCP",
            "nSolution": null
          },
          {
            "id": "5f3a242b-dffd-43c2-b2de-4b2836cfc1a0",
            "name": "Spring End Sem",
            "year": "2024",
            "type": "END SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1s26xlZ8i3ptO3IwjYpWU3lt4hM1Xq7ZL",
            "solution": null,
            "nQuestion": "189JPK2pcyxgiupQOWdbBElGZo5XhANOd",
            "nSolution": null
          },
          {
            "id": "16ee62f3-a555-49cb-b7c4-d547a729cb80",
            "name": "Autumn Mid Sem",
            "year": "2023",
            "type": "MID SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "11h_pAI5ExK_cPTMY5-Sy1C7cQG22Bkow",
            "solution": null,
            "nQuestion": "1zNrxbY6qLetOZZrteDQPwTwtk94UGTad",
            "nSolution": null
          },
          {
            "id": "1b445184-57cd-4876-9414-041ff55ee032",
            "name": "Spring Mid Sem",
            "year": "2024",
            "type": "MID SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "10zxzrW7228x7jJ5H9kpGU9U5_FRlWGka",
            "solution": null,
            "nQuestion": "10k_p3de7vD7XZcie15NjC3DuCQY0_BTq",
            "nSolution": null
          }
        ]
      },
      {
        "id": "65d214db1bdc9aab41338803",
        "name": "Industry 4.0 Technologies",
        "SUBCODE": "EX20001",
        "Credit": "2",
        "folderId": "1aO_AsMZIEOCe9karKTjW85gHzZMSOQkd",
        "pyqs": [
          {
            "id": "07008c90-5fa4-496b-937b-9b3aaae3666a",
            "name": "Autumn Mid Sem",
            "year": "2023",
            "type": "MID SEMESTER",
            "status": "APPROVED",
            "solutionUploadedBy": "6623bab4ad6e7bd16c843fad",
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1WehTewj244YSnUQiLk3lkUuQufAsSs9R",
            "solution": "1blkxc0kNllCBSTsJKfx1VBk5uYoSBEuX",
            "nQuestion": "1lAsuc7nNQSB9FVhnChfkITtcHnqdbW7A",
            "nSolution": "1QbYX2KSlbr-DZkqqa9Ktos5e6phy1rl5"
          },
          {
            "id": "b78f80a7-b793-4cc3-be21-5f988a6d8a28",
            "name": "Autumn End Sem",
            "year": "2023",
            "type": "END SEMESTER",
            "status": "APPROVED",
            "solutionUploadedBy": "66ddd9e742841c454a166ed3",
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1bjMCg56RVluCI7X0DJFZ97_sB-YMYcMS",
            "solution": "1Cf7GNPhA97f-uNhEw7u-zc2i-p3Wwofs",
            "nQuestion": "1yEi7FxGbjm1NiOK1-SVCfidvUwzEQFsG",
            "nSolution": "1pS0WZgUEsqpOCVX5Lw6MD53_8sQlQ6yW"
          },
          {
            "id": "5976e41d-c16c-4141-bc02-905c37e01deb",
            "name": "Spring Mid Sem",
            "year": "2024",
            "type": "MID SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1FE-RbPZcQ8invUW8b11HS7YwpJPC1uc9",
            "solution": null,
            "nQuestion": "1mC24h8YrqFo0jP6J8u09-IKOXLCifYYF",
            "nSolution": null
          },
          {
            "id": "7ebb498b-ecef-48d3-b8a2-ce6f7f4a8087",
            "name": "Spring End Sem",
            "year": "2024",
            "type": "END SEMESTER",
            "status": "APPROVED",
            "solutionUploadedBy": "673e3ae15a965de869c4369d",
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1zWwcSe61OP6kHs-cWWxpOIhfiuxmUDCR",
            "solution": "13nLDOrMrt_hTtW4_1tJdyou6QOVWucmP",
            "nQuestion": "17asZz7Sr_GBa7ND4B1t3sGwpwFRLQ_xl",
            "nSolution": "138qP6yKum7qLnCrkNDUmn3KTxVmiGDQ0"
          },
          {
            "id": "decb9c54-5e30-4836-83c2-be24d6f4bc9a",
            "name": "MakeUp Mid Sem",
            "year": "2023",
            "type": "MID SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1V2graeyo-G4_L6tlqu8njTqTDZWuD5vi",
            "solution": null,
            "nQuestion": "1kzoxRlQ3YAy8ny4hMfu4VCEpIeuBI-rZ",
            "nSolution": null
          },
          {
            "id": "05c1f475-2cba-4043-bc4f-8c785f74299c",
            "name": "Autumn Mid Sem",
            "year": "2024",
            "type": "MID SEMESTER",
            "status": "APPROVED",
            "solutionUploadedBy": "6721ca165a965de869c4338a",
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1PAKxYaIt_JDvbZRzgKgRzT4k94JUSNB8",
            "solution": "1elPDrE3mtqWZ9QQFu7Rd2V_EfTGhwN9Z",
            "nQuestion": "1PEKXN32uiXxlMvDHfu6pCxfKA8xuaq3x",
            "nSolution": "1K5fAhL_6bjkt36QtuL8PID2FV2YCRXMn"
          },
          {
            "id": "1d6c3a5e-650e-4dd4-823e-a6bb9d42033b",
            "name": "Autumn End Sem",
            "year": "2024",
            "type": "END SEMESTER",
            "status": "APPROVED",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1dJ3rp7rkH3tMa3hNfsv0aP448lYgYAua",
            "solution": "16jz1dl6vF11t9W4-KXkY6rRhD4nhOO7w",
            "nQuestion": "1ywS4bJMe4UX5GDDROCoQCozXcD-Hps2I",
            "nSolution": "1u_QqQGwP9D1izP9SFKBAOVM7v7S-I-ou"
          }
        ]
      },


      {
        "id": "65d214db1bdc9aab413387ff",
        "name": "Data Structure",
        "SUBCODE": "CS2001",
        "Credit": "4",
        "folderId": "1wylGvLGZXWnApRkc2noJUostT8FuGE6K",
        "pyqs": [
          {
            "id": "2a0460b3-6143-48cc-bd47-d80a1979246d",
            "name": "Autumn Mid Sem Exam",
            "year": "2019",
            "type": "MID SEMESTER",
            "status": "APPROVED",
            "solutionUploadedBy": "65d7006aa226064c68a248da",
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1UcXgIurxnjNuvEAQULoNI0o7RO1vr9lW",
            "solution": "1g8YsutFpbd3p2-KmgKqXEswrWj0U2YUf",
            "nQuestion": "1RpWK50bM3krK7N66njMG-zMEreIVS-HJ",
            "nSolution": "1g0NWUp6fnbBM083K7cC2JGWqIMMtNkAE"
          },
          {
            "id": "5286e02e-4f03-40cc-a4d5-fc8a0bdee146",
            "name": "Supplementary Mid Sem Exam",
            "year": "2018",
            "type": "Mid Semester",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1Am4kyNWQ40RPr1AQB3JYqECm0YTmvr32",
            "solution": null,
            "nQuestion": "1Am4kyNWQ40RPr1AQB3JYqECm0YTmvr32",
            "nSolution": null
          },
          {
            "id": "f18ba544-7d2a-40a4-a493-e279928757b2",
            "name": "Supplementary Mid Sem Exam",
            "year": "2017",
            "type": "Mid Semester",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1CeioW_oiGqjQokROUU-cGVqJt6Gymehv",
            "solution": null,
            "nQuestion": "1CeioW_oiGqjQokROUU-cGVqJt6Gymehv",
            "nSolution": null
          },
          {
            "id": "a2b8ede0-bff1-46e1-a114-97374cb9940c",
            "name": "Set 2 Autumn Mid Sem Exam",
            "year": "2017",
            "type": "MID SEMESTER",
            "status": "APPROVED",
            "solutionUploadedBy": "65d6ff86a226064c68a248d8",
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1A1Mr-3cgrAuRZAM8ZSaKk7TcIZuVTS1o",
            "solution": "1wxn35f3T94s4xMPprp5KB7RJn1J16mPC",
            "nQuestion": "1gRU2NIxSoP5c9ji6uOHHdOyya3UVKXgn",
            "nSolution": "1azxzCeLoGx57zbtn5EOi45HOe5csHbaC"
          },
          {
            "id": "9192274d-6cdc-4a89-a73c-d6f052549642",
            "name": "Supplementary Spring Mid Sem Exam",
            "year": "2016",
            "type": "MID SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "18I33Cs9UH2-wCzFU725PVznZBBxZMVaI",
            "solution": null,
            "nQuestion": "1zdZHtU5WBrvDLJi_92YMcMtphWYEz766",
            "nSolution": null
          },
          {
            "id": "71388cf4-14a2-4b67-a832-531855759aba",
            "name": "Set 2 Mid Sem Exam",
            "year": "2015",
            "type": "MID SEMESTER",
            "status": "APPROVED",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "11E1EslU7_iYExz8GkBRojIZtnVmgYgD3",
            "solution": "1fTUcLASI6bNg8FpmabDmcncKj_fTmHcv",
            "nQuestion": "1ufbuGQ1Cmofm3NtLTRRzgvdwu6LiQ1a0",
            "nSolution": "1uz4bC0-VNurKQVER1Dl8xhwTi5VTsuTP"
          },
          {
            "id": "11d80adf-4564-4c9b-bfee-805a27341b67",
            "name": "Mid Sem Exam",
            "year": "2014",
            "type": "MID SEMESTER",
            "status": "APPROVED",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1mCSyYEN1077K3mtzyhEwujyRej79bf8C",
            "solution": "1JA-xmHe_d9qmul6RTRMfe35kWCosohGE",
            "nQuestion": "10uq82sZnfzHOC809kd8xOkZLveSNQt-e",
            "nSolution": "18PWiRdpkBJsT0cd1YIqJ8K-E52c_5L9P"
          },
          {
            "id": "db7b30dd-f5c1-40a3-ba42-2faf424870ef",
            "name": "Supplementary Autumn End Sem Exam",
            "year": "2018",
            "type": "End Semester",
            "status": "APPROVED",
            "solutionUploadedBy": "674219455a965de869c436fd",
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1ljy02IKa8BkfBKUuuXE7GrvlPcRHrCQO",
            "solution": "14cuWduOuMtSAl4Ua_jOLhQDAYTo8mYjp",
            "nQuestion": "1ljy02IKa8BkfBKUuuXE7GrvlPcRHrCQO",
            "nSolution": "1Bfsdm9yEQP4h6cDMWguIykRicJA-fve5"
          },
          {
            "id": "6c14a50b-c953-49b3-b361-03b25dda5122",
            "name": "Autumn End Sem Exam",
            "year": "2017",
            "type": "END SEMESTER",
            "status": "APPROVED",
            "solutionUploadedBy": "674218b85a965de869c436fc",
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1QJz7pjF1zGiamkm28O5GQSny12vMn3lN",
            "solution": "1ed2kdStf2g0Xhr55mn0HdcC506qXVjbf",
            "nQuestion": "1ksXsInXIWScbkvfwqXY08eaI-4Mxedc5",
            "nSolution": "1TOOyLHKOkO2ckpLiK3SBszHliAXgGSXB"
          },
          {
            "id": "1cb668e4-43da-4168-9fcd-0fedd36cd1a4",
            "name": "Supplementary End Sem Exam",
            "year": "2016",
            "type": "END SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1ejiQwvUD-ek5v0pVJNZxKC4xSpveNNgW",
            "solution": null,
            "nQuestion": "1RD0rVcE3sSEdwAt16uhMjy379RsQng5g",
            "nSolution": null
          },
          {
            "id": "fd2ad68d-39eb-4045-b46a-2e00405cf797",
            "name": "Autumn End Sem Exam",
            "year": "2016",
            "type": "End Semester",
            "status": "APPROVED",
            "solutionUploadedBy": "65d4c95baa980c579a71dacf",
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1XlBdW2CqzSAbN7CMSbOqBcJR26gNsI6z",
            "solution": "11lzrwGKLUlLDmAl14tcKv3gJYyjlRnYL",
            "nQuestion": "1XlBdW2CqzSAbN7CMSbOqBcJR26gNsI6z",
            "nSolution": "13dG8dWaDoqS5CBLpwaMM75dk5MlS0ovA"
          },
          {
            "id": "f981e584-b53d-468e-9217-491dd35d58a5",
            "name": "Autumn End Sem Exam",
            "year": "2014",
            "type": "END SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "18QyAmBY0XTrBcFrhgFCZhXC-cwecFWeW",
            "solution": null,
            "nQuestion": "1B9sH8HySxFVTuiGVcBcPJHW_JSrfUO1G",
            "nSolution": null
          },
          {
            "id": "68a5b6c7-ea3e-453b-8b86-90da88c83ecf",
            "name": "Autumn End Sem Exam",
            "year": "2013",
            "type": "END SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "15q_jkxTBJov5fosEKUIo6J5mUlmHv0QZ",
            "solution": null,
            "nQuestion": "1RjTgCb1aHc8LOzslX7ZHT3AaNKLcxoq8",
            "nSolution": null
          },
          {
            "id": "4e46d30c-feeb-44fe-a729-94e8b7bf69e5",
            "name": "End Sem Exam",
            "year": "2012",
            "type": "END SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1lYCgn0HXtDkeoTjg9KQ_HmAHgaqLy8cK",
            "solution": null,
            "nQuestion": "1Q3z1SBiaUyshyEUTemusMSgEULWJkAR_",
            "nSolution": null
          },
          {
            "id": "1008e464-83e3-4679-ac2c-7d8bb1a8a2db",
            "name": "Autumn Mid Sem",
            "year": "2022",
            "type": "MID SEMESTER",
            "status": "APPROVED",
            "solutionUploadedBy": "660c5fa530641ad00aae8ad6",
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "11kRX_ZKVF-SoMIwDon459oiLfTJWvz36",
            "solution": "1bHwBxTfdkQG4jbJ_llZ73-fup6xd4cro",
            "nQuestion": "1kNwqj31-IGHzgjbHtp7qytqiAM0X22Lq",
            "nSolution": "1oux4B_HIflrvRnYxsTzxpyGCtoiua7lq"
          },
          {
            "id": "e1276cfb-75e9-4f21-ad28-f4f8d8d8ffa0",
            "name": "Spring Mid Sem",
            "year": "2020",
            "type": "MID SEMESTER",
            "status": "APPROVED",
            "solutionUploadedBy": "65d70af6a226064c68a248df",
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1Kvad7U4_IsaTXIoU0PoqIeF3Yj67b7K5",
            "solution": "1IWvIvtbvjSfTaJEUe0CyFI2T0KpOvmu9",
            "nQuestion": "1BjIJA3z4EinXJRr3Cj0H-aJGpZ4weGNa",
            "nSolution": "13zbIYtYNk-YSBobuVuFfmyluXal8ioBC"
          },
          {
            "id": "ffca36b4-33bc-485b-99cd-ca739b2afac4",
            "name": "Autumn End Sem",
            "year": "2019",
            "type": "END SEMESTER",
            "status": "APPROVED",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1PAzJWRenx71HKISLI0QOgS6JsmueTNH_",
            "solution": "1TkM888cNnqze7bEr2s9qVR29iATyoqSV",
            "nQuestion": "1HMA1_ExPC-__2urWa1XqmFzlM9ITnHe1",
            "nSolution": "15ZaUSg11A7CDRcl_WmJhAKZDuzMkTbXw"
          },
          {
            "id": "20552fd0-7800-4c56-a7b6-de5465ef09bb",
            "name": "Autumn End Sem",
            "year": "2022",
            "type": "END SEMESTER",
            "status": "APPROVED",
            "solutionUploadedBy": "67423b1f5a965de869c43702",
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1na32Zz87lOx5iPO8JIoEp3jUD2ivn11R",
            "solution": "1CUavmS5s32xs-EeClLLudRpBXW8SOxu0",
            "nQuestion": "1TxZxiasMPXBg50Hh6GybP2sC3gNEDuaj",
            "nSolution": "1mPRuwaYTxOD50nwUKwaUwfk6blo-C6tu"
          },
          {
            "id": "7944532c-5868-48d2-9cc0-63eeaa22bf96",
            "name": "Autumn End Sem",
            "year": "2023",
            "type": "END SEMESTER",
            "status": "APPROVED",
            "solutionUploadedBy": "66dddaa042841c454a166ed5",
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1PWqx6MvxGTT8_Rdb-W1Q0PDjC_0INQuc",
            "solution": "1aTEddY12ANvnlpQED5LOeNiQHjwj9b14",
            "nQuestion": "1PRqG3-sfWAeCqNWGtFyiI3fWTevRVY__",
            "nSolution": "1MKqZB0bLYvTTBx1ftk3PwV-5YuHC2cSj"
          },
          {
            "id": "5e175652-f78c-4c7a-b3e7-09844bd39116",
            "name": "Spring End Sem",
            "year": "2021",
            "type": "END SEMESTER",
            "status": "REVIEW",
            "solutionUploadedBy": "674384da5a965de869c43721",
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1hKytcFt0oHMrsMWlFEeW54gckVJVq5Al",
            "solution": null,
            "nQuestion": "1gbEXsXpg1KHV_wnbUiOYPt3nmSnLT8JM",
            "nSolution": null
          },
          {
            "id": "3b6ef17d-7b55-4bf4-af1c-16a0270a5294",
            "name": "Autumn Mid Sem",
            "year": "2023",
            "type": "MID SEMESTER",
            "status": "APPROVED",
            "solutionUploadedBy": "6623bc78ad6e7bd16c843fae",
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "17sk-Vkv2yDjnMPZtQk7MLjw8Ry3Ulek7",
            "solution": "18GprrfjGhCN7JRhh23eYX6ZnPCh5u-Uj",
            "nQuestion": "1onE3Wy25_UMdgjc8PTQ_uRhK8UEI_s_8",
            "nSolution": "1ICHDHkGqYhNIvkUfHgIEHlf89luByVUA"
          },
          {
            "id": "e3887bc7-cc56-4e70-82ef-111c49b03d6c",
            "name": "Autumn End Sem",
            "year": "2018",
            "type": "END SEMESTER",
            "status": "APPROVED",
            "solutionUploadedBy": "660a4e1b30641ad00aae8aab",
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1NXPJUGCaGP_2MFOadEPmOTpfRJFDsxM7",
            "solution": "1Y03YTeZAwFjGa2OPBh9Lr_W2e5i1afI9",
            "nQuestion": "15tRW7Q1Sg4TIPj_oC9p584NDnXeiDEkf",
            "nSolution": "1E9SUoSBjOR9zGCzdF92ebUxtonI8stWK"
          },
          {
            "id": "7b0ed91d-4eca-4ecd-8031-c4b0750a4cf1",
            "name": "Autumn Mid Sem",
            "year": "2018",
            "type": "MID SEMESTER",
            "status": "APPROVED",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1BZbq1K7OdEO5Z0hA7fW4W-1tO27_QJt1",
            "solution": "1l0LUFLNtfU2WuDWtMDxwssSK-Hz6y1d1",
            "nQuestion": "1L9X_Ed5GJHihg0I30vMWgL98JtW0OcqI",
            "nSolution": "1QRA2vcG891zUBrKuvcqDE4HNcmX7qkfy"
          },
          {
            "id": "6212df10-0620-4565-9786-c961717615ad",
            "name": "Autumn End Sem",
            "year": "2015",
            "type": "END SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1llpwm_Jwgv37MXUVapADWv5QvrlOQ7Bt",
            "solution": null,
            "nQuestion": "1nrkav4eI3uNnp52xRiVo27Qs5JPKMdhW",
            "nSolution": null
          },
          {
            "id": "e2c44e4a-9a62-4f2d-bba6-d94d8e45fffb",
            "name": "Autumn Mid Sem",
            "year": "2016",
            "type": "MID SEMESTER",
            "status": "APPROVED",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1mJYewdw2CFXjFj4TyFhpesmqSzwKZf3Z",
            "solution": "19816theXU556H9KVU7-ikt4aV9MmHSPH",
            "nQuestion": "1nMT2IxZGbdOzehOU5axNjDRXLjhnnPa5",
            "nSolution": "1zM51QxKP6zHP8L8dgGyCbsq0LfNDsOmf"
          },
          {
            "id": "e681a3c0-4403-471f-8ee8-31b5f2a4dbb8",
            "name": "Autumn End Sem",
            "year": "2020",
            "type": "END SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1y4zKDfYJ9UrOtsiwKxRtR7-BnMm9j7RD",
            "solution": null,
            "nQuestion": "1rM1pfT_377tyNp_2hYtVM4kB8ocf7xxE",
            "nSolution": null
          },
          {
            "id": "229f48f8-bf8b-49ea-8e8b-73ce7adf2b51",
            "name": "Spring End Sem",
            "year": "2019",
            "type": "END SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1lYtLY4ICGuzmReS1xaEs6bBVNY4UzU0J",
            "solution": null,
            "nQuestion": "1F56YJbHW2J9h5T6ojKKyVc7w_4rboqzu",
            "nSolution": null
          },
          {
            "id": "3ae06ccd-1256-4c71-805a-8568817614ec",
            "name": "Spring End Sem",
            "year": "2018",
            "type": "END SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1tMPNmWEC0jX0zQMMaftn3kSEqBFx9u1u",
            "solution": null,
            "nQuestion": "1FqKkEa46MVqmnUQswTcWf3BzRdCgbr5b",
            "nSolution": null
          },
          {
            "id": "d58c1657-36a9-4e69-a99c-6252b74e8242",
            "name": "Spring Mid Sem",
            "year": "2019",
            "type": "MID SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1TG3MX0WPLMyjtUj7xlPTTSDy3rpHemei",
            "solution": null,
            "nQuestion": "1EtqZmE1oQRp70GEiZ5fE1eh0NDqDOgVN",
            "nSolution": null
          },
          {
            "id": "30548b50-3667-4f31-9e03-9d87d68408db",
            "name": "Autumn End Sem-2",
            "year": "2020",
            "type": "END SEMESTER",
            "status": "APPROVED",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1yHTjQp8MliZFUns0aHjid9a3n3Y6dj3d",
            "solution": "1l5qM8tChbfvdl_KM0M_gWPBNpvPz9j9O",
            "nQuestion": "17Vy_mU5R7cTWgGfYamhr5DG6PpGfgKAP",
            "nSolution": "1VwF6O_Fw8JtoA7JIJOCAGVsf-ZBZQGro"
          },
          {
            "id": "265499db-b55c-4e9a-8130-6c066b1b9787",
            "name": "Autumn Mid Sem",
            "year": "2024",
            "type": "MID SEMESTER",
            "status": "APPROVED",
            "solutionUploadedBy": "6721c9b75a965de869c43388",
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1xjrk-E29lm9o4l3KL5FZU_uIz-inZKuC",
            "solution": "1wZ5dtHa2sqlqg_4kND90LNdXwYMU-LOR",
            "nQuestion": "1yrKT-rCk0EmEPknHhO9ZZf6LrWLXF277",
            "nSolution": "1_9AYkHFgVr4KtHpeN3Ihu-wA0n7AstK2"
          },
          {
            "id": "0e8cf2f4-5417-4197-b412-c1452c1aacb7",
            "name": "Autumn End Sem",
            "year": "2024",
            "type": "END SEMESTER",
            "status": "APPROVED",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1ROoVMj50WZonI34dmc3oDCLorh8angb4",
            "solution": "1eolkrFJqFQDM9GXUvRFxwRhoHPP011_N",
            "nQuestion": "1JsXGAEoEvnKYPNRbJarzuEH6qeVUoxdW",
            "nSolution": "1zyKI9-V2-WfO9lFftg2dTEHeAzZZEYy5"
          }
        ]
      },
      {
        "id": "65d214db1bdc9aab41338800",
        "name": "Digital Systems Design",
        "SUBCODE": "EC20005",
        "Credit": "3",
        "folderId": "1PMBLip9V7jVPNy_MpOhgNtHEPwIC_tsu",
        "pyqs": [
          {
            "id": "4eeaa480-cb8f-4b28-86ac-7c5d43959d02",
            "name": "Spring Mid Sem Exam",
            "year": "2020",
            "type": "MID SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1mgoPTeBgEoCluvHA__550_lvLsNw4unN",
            "solution": null,
            "nQuestion": "1CGrANRQ9-dVphQBpxcZ522-gtHkfpx0n",
            "nSolution": null
          },
          {
            "id": "f64f63d8-5f0c-4b8f-8710-4b3b005807b3",
            "name": "Autumn Mid Sem Exam",
            "year": "2019",
            "type": "MID SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "19QI7Q0eTYQPbF0Tr6u1QdDLodGyS6N4k",
            "solution": null,
            "nQuestion": "1XH3DwnuVgLYJzXiwSb7KbepHOpK_YlEi",
            "nSolution": null
          },
          {
            "id": "9701639f-58bf-4c63-a024-26c75f3af42e",
            "name": "Autumn Mid Sem Exam",
            "year": "2018",
            "type": "MID SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "14gMXoOy7mPQRCbmMxHIIQFHMfB0SPfPh",
            "solution": null,
            "nQuestion": "1Jn-iAceRXcTcDNDjvvH7cQSW5_1aJFiU",
            "nSolution": null
          },
          {
            "id": "3068e0a0-f8cd-4ff8-b8d2-6a6c9dc669bf",
            "name": "Autumn Mid Sem Exam",
            "year": "2016",
            "type": "MID SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1NzakyXLFSE9qX-P03cOlQ3nUo4fDasx_",
            "solution": null,
            "nQuestion": "1vdkYXVx-x8qCQ3DTvTJE4zc8ZwYdCd9P",
            "nSolution": null
          },
          {
            "id": "02038d1c-538c-4468-bf74-34e221541b49",
            "name": "Autumn Mid Sem Exam",
            "year": "2015",
            "type": "MID SEMESTER",
            "status": "APPROVED",
            "solutionUploadedBy": "673b0d8a5a965de869c435f3",
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1pwQpNVUMGpv1aq1X5NmDr7X0u5WTG4se",
            "solution": "1P1BVt8UlqHpFNZ05qNqhElUtU1Fd_U1i",
            "nQuestion": "1TeK2RkOaxdDiufG7m0nzbE-AkjggDAlz",
            "nSolution": "1cZbu1ABxYEc9EZyjYQTrg_pKjU1JqHZ4"
          },
          {
            "id": "5eb8f739-9e02-4f50-8164-2315cb9d0d06",
            "name": "Autumn Mid Sem Exam",
            "year": "2014",
            "type": "MID SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1Mf7U3RNnU3kPcROqzJqpDXyoWOIvKCh-",
            "solution": null,
            "nQuestion": "15zkQ_Wq-UQYZRFtjvLXat6c3DbR_NyFT",
            "nSolution": null
          },
          {
            "id": "3b74b34f-3b1c-43f9-ae2e-e7517f0f6e23",
            "name": "Autumn End Sem Exam",
            "year": "2017",
            "type": "END SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1jGjo1CRK68-Q152OJUI13SdQGo7tbozu",
            "solution": null,
            "nQuestion": "1bDOvHnGl5lhNrHr1KVfhLo5ULYZd8Osd",
            "nSolution": null
          },
          {
            "id": "a547d9da-3c42-4fa8-bd6d-86cb8742afda",
            "name": "Autumn End Sem Exam",
            "year": "2016",
            "type": "END SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1thCCdnnzVg0PFCOuOKOGU7OgmHjlZ7kE",
            "solution": null,
            "nQuestion": "1f17_nVk1P-VSGJ6GrTuXKgNdl1WrJ3cO",
            "nSolution": null
          },
          {
            "id": "833c9c85-894a-4200-adf6-e4a4199f2add",
            "name": "Autumn End Sem Exam",
            "year": "2015",
            "type": "END SEMESTER",
            "status": "APPROVED",
            "solutionUploadedBy": "673aff0e5a965de869c435ef",
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1r9Ie6E6PW1PrklT-fv7X-koWpqrpqVOR",
            "solution": "1HAeBBgwpwxLj5BjiQtQaOR1kQRugf8AR",
            "nQuestion": "1mR03XFBMpthMtwNZugx5dfaSmR9t5Znq",
            "nSolution": "1IlBdmMIrOIqlwqp5-z79JDuboNEPtKxy"
          },
          {
            "id": "5483bc66-31db-40b0-9de4-b5f901784913",
            "name": "Autumn End Sem Exam",
            "year": "2014",
            "type": "END SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1FoXW1MVi4QLMmy3IM7BvWb-B_2js7JOx",
            "solution": null,
            "nQuestion": "1Zvt6RKLytAKAvb_AvOm2dCQPa-eLHmpU",
            "nSolution": null
          },
          {
            "id": "48c6401b-4d96-489a-85f0-eb4d0ab19c61",
            "name": "Autumn Mid Sem",
            "year": "2022",
            "type": "MID SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1Ua5A-PjKnU9kWCMl1IOncUc-Hx79VWs9",
            "solution": null,
            "nQuestion": "1j2Hu8dSMohSyTilUUMeJo7aEuIxx5ArH",
            "nSolution": null
          },
          {
            "id": "1ad8e28a-b244-4f3e-8a35-a875cbd5aa47",
            "name": "Autumn End Sem",
            "year": "2022",
            "type": "END SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1XxRKa84WJ-HHs-yZAgaivWILOC6git05",
            "solution": null,
            "nQuestion": "1KK8ZZHPluEzstDew1sobg2xkqXI4Jviy",
            "nSolution": null
          },
          {
            "id": "04f5a56e-66fa-49b2-8c86-244773721d5b",
            "name": "Autumn End Sem",
            "year": "2023",
            "type": "END SEMESTER",
            "status": "APPROVED",
            "solutionUploadedBy": "673a66555a965de869c435ca",
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1UFI3clV6YcGZOgFNMHNkVCOTaDH_29t9",
            "solution": "1Q6neaAsko32nYuL6vnVHxrp_72N-iWs7",
            "nQuestion": "1GAX-stw2DiVa3NQG1Do9LsffDWXLo9e-",
            "nSolution": "1R7TmTBe5_nbncQODMafpNYohdvOAE39G"
          },
          {
            "id": "ca096a68-b19e-46e0-8134-2e77180a4426",
            "name": "Autumn Mid Sem",
            "year": "2023",
            "type": "MID SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "10K6IBwhYz_g43BKEvG7PKpONo44RKNQe",
            "solution": null,
            "nQuestion": "1NlZs2-hyeLWJuKGwc5zZ2c4BRQqyZ1s1",
            "nSolution": null
          },
          {
            "id": "bff0b45e-e39f-47e3-acd1-c2c6de00dc28",
            "name": "Spring End Sem",
            "year": "2023",
            "type": "END SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1W5eLfjhKnMgn8R9bn-_0BJ3_te3y9ngY",
            "solution": null,
            "nQuestion": "18oT2D50LBcXMBZ-bX-6mCWXbA6ejXItR",
            "nSolution": null
          },
          {
            "id": "8c745353-20a1-4594-977c-d5d831e732e2",
            "name": "Spring Mid Sem",
            "year": "2023",
            "type": "MID SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "11fHk_txyj0MSxfKijkch3V03ImVSynRA",
            "solution": null,
            "nQuestion": "1Hssifxh0Ivjjxx4Kuo9d_t6uTEKwq47f",
            "nSolution": null
          },
          {
            "id": "59eef541-d75a-417f-afb1-f34702cfc6a7",
            "name": "Spring End Sem",
            "year": "2015",
            "type": "END SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "17kBNnqj9Ef1UKqvX3B5_VrHiqWQgtVH7",
            "solution": null,
            "nQuestion": "1BvDSRN4TSr6F5MgybFSsLfOu9zxCXfss",
            "nSolution": null
          },
          {
            "id": "95480ae7-fdba-4f8b-990e-b929e321e6d3",
            "name": "End Sem",
            "year": "2012",
            "type": "END SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1eT_jZyuNxROvkEQOjDJtt5WF5aAGas8J",
            "solution": null,
            "nQuestion": "1p_FWNW5u75swCYRObtBcrBiYAahQEWTh",
            "nSolution": null
          },
          {
            "id": "0644ce55-88d2-4262-aeb7-229391a26315",
            "name": "Spring Mid Sem",
            "year": "2013",
            "type": "MID SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1Q0kGrZYGkrJTsXl9s4mq4gnKGDzfcQre",
            "solution": null,
            "nQuestion": "1awKoYbW3SAvhzzda2TiwSXsq72BNM0nx",
            "nSolution": null
          },
          {
            "id": "a55b940c-2680-4d95-a6e9-019ea4f6383d",
            "name": "Spring Mid Sem",
            "year": "2014",
            "type": "MID SEMESTER",
            "status": "APPROVED",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1g5FFWK5tAXbFzZDUnf59cHHzOHzNKSLM",
            "solution": "1cljyJcJwMBsTN6t7yb-rkqGCi4FXcTHn",
            "nQuestion": "1fzTiM0aLXOR23Q0dVDoKvQ0IREyp5BNP",
            "nSolution": "1Xd2rJ45RER59zPCctwprOaXl52LaHV49"
          },
          {
            "id": "200d441b-7926-4cb0-9fb9-b78eb7e65ed2",
            "name": "Spring Mid Sem",
            "year": "2015",
            "type": "MID SEMESTER",
            "status": "APPROVED",
            "solutionUploadedBy": "673b0cab5a965de869c435f1",
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1R9XGr-yHLs01rJEpt9emURyhTiUzKMjf",
            "solution": "1kGgaUBB_TvPfcwyghbY1N2Ukpa9HC9gg",
            "nQuestion": "15vBconP3I-Q3ekxWXu49VaPFSBbCxF04",
            "nSolution": "1u6FsZNm6gYC_XewXEFz4ZXnmbeRCHd-R"
          },
          {
            "id": "8a921499-e01c-43c2-9033-ebf11d4660ec",
            "name": "Spring End Sem",
            "year": "2020",
            "type": "END SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1_9I8Jz_uLVsjd5gPWFfOt9RuIfnxCuIa",
            "solution": null,
            "nQuestion": "1ra7N4_GQAj5h6uoqWA7rgKuBGmkFpG6J",
            "nSolution": null
          },
          {
            "id": "f6e90a57-3751-41e5-b339-883962c9b1a0",
            "name": "Autumn End Sem-2",
            "year": "2017",
            "type": "END SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1BPmv5d9Wno42CdJUpv4n-_sQ_r9ygZbj",
            "solution": null,
            "nQuestion": "1hj5_nfBGB3iZVPvOEm5wpdqVZH3qfjcw",
            "nSolution": null
          },
          {
            "id": "8b4f6787-52b5-4ff3-a393-1d6f51632ddd",
            "name": "Supplementary",
            "year": "2018",
            "type": "END SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1f2BKaSgszpUabHKzw2_CuOJ_Hant3-zC",
            "solution": null,
            "nQuestion": "1rFYT_2vZAUOSdTaBnRln-e0Y0vEZNYEo",
            "nSolution": null
          },
          {
            "id": "2c7e322c-1470-4541-a4b6-3686057dffdd",
            "name": "Autumn End Sem",
            "year": "2018",
            "type": "END SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1ZzJPY_hhbszZPBhicM4gJw8zE8U0-Vpp",
            "solution": null,
            "nQuestion": "1CENiupn2IVUbkvigxSs6rEI-UgkwoWDL",
            "nSolution": null
          },
          {
            "id": "2882a00f-51a6-4c50-9b48-e969aa35e7c7",
            "name": "Spring End Sem",
            "year": "2017",
            "type": "END SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1Xr55eZBELnrIFCrkVT39QfU22vT2a29n",
            "solution": null,
            "nQuestion": "1VENMqUpA7cIvnsTf9ZkcwptrlH2Sv53C",
            "nSolution": null
          },
          {
            "id": "3f8d4829-e66d-4651-9ef0-8385096cb89e",
            "name": "Autumn End Sem",
            "year": "2020",
            "type": "END SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1LdKqVezIQdSQF9mECSkwNGYh-dJNMIim",
            "solution": null,
            "nQuestion": "1-Pn8lcSXFmbz7qRpwxD19kmkXjgmh5nH",
            "nSolution": null
          },
          {
            "id": "64c9dc59-970b-4b37-a87b-a0efe2c315b2",
            "name": "Spring End Sem",
            "year": "2019",
            "type": "END SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1EKCsYpYHuhTNcl37YFi_9RlTGWSy3RuI",
            "solution": null,
            "nQuestion": "1YBCRhP6DgFnyQ9_prnNg1p7_3Fepuj5r",
            "nSolution": null
          },
          {
            "id": "b9f41b68-8098-4116-bc93-52aa6e36ec3c",
            "name": "Autumn End Sem",
            "year": "2021",
            "type": "END SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1pVt9C4G05fQhYrM7pxqpREzsrTVdF_m1",
            "solution": null,
            "nQuestion": "19Cuup2SW0MC0V6jsIQQnXJVom5D7I0nN",
            "nSolution": null
          },
          {
            "id": "d6d5cf6d-d932-4f0e-9877-3bdfbe6613eb",
            "name": "Spring End Sem",
            "year": "2021",
            "type": "END SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1fDY9HeJ3FCzfehlD1p9g-EdJ6HNgCRyK",
            "solution": null,
            "nQuestion": "11RSJb2Z71XdiJNrl628IpGpxeGjyTfqv",
            "nSolution": null
          },
          {
            "id": "949c1b51-9901-4c86-bc16-7cf89a70a257",
            "name": "Spring End Sem-2",
            "year": "2020",
            "type": "END SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1UsraDpnLZo_-BdHe2IN3q_k-MhT2bvtt",
            "solution": null,
            "nQuestion": "1RUIYs9e95EXjf8NQZ21_zf4Nhc7_MMDY",
            "nSolution": null
          },
          {
            "id": "bf1926cd-e42a-448b-8765-f9b82fe3944d",
            "name": "Spring End Sem-3",
            "year": "2020",
            "type": "END SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1xdvNszcFX-uFlX6kSyNbXEZ5rhffHe-_",
            "solution": null,
            "nQuestion": "1rjuIZPVIXNcVXVuH6T4kfeGacCEMFA7_",
            "nSolution": null
          },
          {
            "id": "65bc46e6-4417-40b2-9dac-54243cc7c71a",
            "name": "Supplementary",
            "year": "2024",
            "type": "END SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1iJteL2-xV_DBwt-U4KSqNBNXR-jTlrgT",
            "solution": null,
            "nQuestion": "1C_uT10Gt_c48mK8seGjn3NGR-urA-LFv",
            "nSolution": null
          },
          {
            "id": "361a8f1a-7862-48cb-84db-1821c6829661",
            "name": "Spring Mid Sem",
            "year": "2021",
            "type": "MID SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1v26dyyco3_R_l4TYAmwn4Rpc--eT4mPr",
            "solution": null,
            "nQuestion": "1zNAgaeE9Q9kIetBPxfdcT9ggjoYlLBB1",
            "nSolution": null
          },
          {
            "id": "b05ac8c0-618b-4b77-a920-e3fd1968e8a0",
            "name": "Autumn Mid Sem",
            "year": "2024",
            "type": "MID SEMESTER",
            "status": "APPROVED",
            "solutionUploadedBy": "6721c98b5a965de869c43387",
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "12vZB3nrYh059b9edmVje--l7dDuaQiUF",
            "solution": "1dSBUPStYxZzZR_lhh0wx7SluOA7ATzgS",
            "nQuestion": "17LSLp_6euq6dHdMMbKNOQhNQcNyAFNCL",
            "nSolution": "1D-qDHpO12yyv7VjZpwfAqhQjj3JHyVqJ"
          },
          {
            "id": "93f5bbf0-73bb-4110-aebc-093b49a651ef",
            "name": "Autumn End Sem",
            "year": "2024",
            "type": "END SEMESTER",
            "status": "APPROVED",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1SGPTjrfBP5iDk-7U7zg5Do9UFTjx_shF",
            "solution": "1VTbk9802RntdHvyIMIvUoHl4IEv-nk7H",
            "nQuestion": "1qOKfY22--07xsmXNwOPVWLbuI9Z5rQf4",
            "nSolution": "1bKCn8Ju-FJ74M6HR9bSfXR7uRenzbNn6"
          }
        ]
      },

      {
        "id": "65d214db1bdc9aab41338804",
        "name": "Automata Theory and Formal Languages",
        "SUBCODE": "CS21003",
        "Credit": "4",
        "folderId": "1P-30fTnkY033P2rTaOZmq1p-EUg7ahom",
        "pyqs": [
          {
            "id": "5a157d27-ff45-4a27-aa07-8c18d77459e3",
            "name": "Spring Mid Sem Exam",
            "year": "2020",
            "type": "MID SEMESTER",
            "status": "VERIFIED",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1EWpl1dkW62Zld5AF9yYj5vZcV_npSvS7",
            "solution": "1ewPqDZk81GXXW5b79iLfJbApzqGg9C3L",
            "nQuestion": "1fBqUsdRolQNmTSjByhF-ySYvkeupLddX",
            "nSolution": "1ewPqDZk81GXXW5b79iLfJbApzqGg9C3L"
          },
          {
            "id": "ebf85db4-57cc-4dcc-9a14-d4ac1eaa9a06",
            "name": "Mid Sem Exam",
            "year": "2019",
            "type": "MID SEMESTER",
            "status": "APPROVED",
            "solutionUploadedBy": "673b98a65a965de869c43625",
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1ORuyk0A4-4flfdnUhlpwSJqi2vyQmTP8",
            "solution": "1XtIieoGZ7D5tzszM9zEPmmWa6IUb--bV",
            "nQuestion": "1xpW2KKUnEOgYbMQo2V-va313nCEgao0k",
            "nSolution": "1R3z-UJT3NN5AJgU09A6ZWb9WCYpIUV7n"
          },
          {
            "id": "90634ddc-ddab-49c7-9d53-47f96a77ca93",
            "name": "Autumn Mid Sem Exam",
            "year": "2018",
            "type": "MID SEMESTER",
            "status": "APPROVED",
            "solutionUploadedBy": "673b98555a965de869c43623",
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1DNfKLll7gEZRtfl124xwQpOjXPtytWck",
            "solution": "127ntwf_6ii33PH1ZgS482Y0MLmNnBB3n",
            "nQuestion": "1Za9TCoZvhC2FxMxYZ8AscmKXjCILfT9Z",
            "nSolution": "1bd5p5Hgr0kGH7wJLpPuLlaxFsVeOIG-h"
          },
          {
            "id": "3d5a6e5f-9a5e-4115-8fb4-84a81ebae508",
            "name": "Mid Sem Exam",
            "year": "2017",
            "type": "Mid Semester",
            "status": "APPROVED",
            "solutionUploadedBy": "673b981f5a965de869c43622",
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1Sfi6eGvoflLSbmMtbdmpGT6p5u9nMMTy",
            "solution": "10qK4zzZG2MHhS_cTzK0RmtCX2ApI_ZsF",
            "nQuestion": "1Sfi6eGvoflLSbmMtbdmpGT6p5u9nMMTy",
            "nSolution": "16jxPcdJ_0s0uj-44BuJEGtE2-zRX92Sv"
          },
          {
            "id": "12495cc1-04e3-4910-bf41-99fa7c4a106b",
            "name": "Mid Sem Exam",
            "year": "2016",
            "type": "MID SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1iVTSdUHLuFG3FxWgEq4nNEvL-W6lTD96",
            "solution": null,
            "nQuestion": "1KCBvgwn67DIAFGHIXtFXgRYrbJwhAa7M",
            "nSolution": null
          },
          {
            "id": "c02e8c29-c1e8-4be0-9a28-8a6cb94f3545",
            "name": "Mid Sem Exam",
            "year": "2015",
            "type": "MID SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1Ay9mn4dgXcvT-6A93Q0Yxuf5NY2PYOFG",
            "solution": null,
            "nQuestion": "17gHlYK6NZ-boRs-Apf4aBAtAvLCVgYZZ",
            "nSolution": null
          },
          {
            "id": "77476842-62ab-4691-ac3b-58b54eb5ef04",
            "name": "Spring End Sem Exam",
            "year": "2021",
            "type": "END SEMESTER",
            "status": "APPROVED",
            "solutionUploadedBy": "660a549430641ad00aae8ab4",
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1GQAjBdlohnc4bnY7qOFdGmlyoQA4FJ-n",
            "solution": "13ESG3Jj1EptJwoSCq5EkS7icIjjYueuu",
            "nQuestion": "16CdzuGVb6p8Mj1gn18atPpPz4sNs00x-",
            "nSolution": "1PUYogDfsfLKJtvrXMmbbq8RZ6mwoFFPO"
          },
          {
            "id": "5dac9588-30a0-40a2-bc95-70ba170cbb1e",
            "name": "Autumn End Sem Exam",
            "year": "2019",
            "type": "END SEMESTER",
            "status": "APPROVED",
            "solutionUploadedBy": "65d5b28ccbccf4670b3ca0ee",
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "11JwIbNG2DKo--MekjiMZRPZqhA7C1Psf",
            "solution": "1BY4qPLl7HWIm7cH6HNbeORYJ6iv6ByPf",
            "nQuestion": "1-lKQnJnuZaMb2M7NrX0LsKCTe3Yw4Sb-",
            "nSolution": "1qzkTGCbzWldoU0n7h9BnwPLa3q1Zzfnf"
          },
          {
            "id": "e05750fe-4eeb-41a4-a952-ba2fbd967eb3",
            "name": "Autumn Mid Sem",
            "year": "2023",
            "type": "MID SEMESTER",
            "status": "APPROVED",
            "solutionUploadedBy": "6623bcb4ad6e7bd16c843faf",
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1Ux2o1_3gxJNRQ6PMilE9QG1i7fhiO3Jk",
            "solution": "1ulL_ljj-G3-FIA6IlhO_ClNqhrp92jqf",
            "nQuestion": "1ifyOQLqRwNKl787__-hewV0ujPxfseB5",
            "nSolution": "1f09isjYiBlNFcEvldKt0GLcdy-E_THwR"
          },
          {
            "id": "6c5a5dc4-faa0-40c9-a4d3-b360b485ca58",
            "name": "Autumn End Sem",
            "year": "2023",
            "type": "END SEMESTER",
            "status": "APPROVED",
            "solutionUploadedBy": "673e191d5a965de869c4369a",
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1a6OjOH-qtNaioAwiBYpcccGQovJt9iE3",
            "solution": "1cSYm_553572BxisShlkrCftwI7oXrKBZ",
            "nQuestion": "1EMHkDzHK7-kyuPX08_YEdEEHJi2256tt",
            "nSolution": "19QJ3JSiDkhy8MHSUB7_jA3Ja26t6t_PY"
          },
          {
            "id": "6893df22-360f-4d34-b2f0-233d2f4a64ee",
            "name": "Spring Mid Sem",
            "year": "2023",
            "type": "MID SEMESTER",
            "status": "APPROVED",
            "solutionUploadedBy": "661aacd4a909c6db59a4203d",
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1kObbTNtL-5z5ekQXlVZCSEJmnCzLe3BT",
            "solution": "1gF8N55d6h54SaVx3O_x6CvzNMlsQ-DcU",
            "nQuestion": "1j9mbEk8Xa_criWSIMN8I7TLb7et08H7P",
            "nSolution": "1tbffZL1N3O7L6eFfIPQUumJW6y430lNV"
          },
          {
            "id": "c17ee082-24ce-4a19-b274-f9a225ce35af",
            "name": "Autumn End Sem",
            "year": "2018",
            "type": "END SEMESTER",
            "status": "APPROVED",
            "solutionUploadedBy": "660a523b30641ad00aae8ab1",
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1XuH3IxxSz1LLwjwPacUF5-sXw-QATiCk",
            "solution": "14GR4d8nnFwvuDH7OHnuMnNisV-QHrfk2",
            "nQuestion": "1XS_0Xv5OIgf9dUYzHqgiIfiXm2PtM5z7",
            "nSolution": "1shOWyhylQDTmKaGIS3-0qkJMqt0UnIPY"
          },
          {
            "id": "eb5443e7-2699-44f6-aec2-de78035e5605",
            "name": "Autumn End Sem",
            "year": "2017",
            "type": "END SEMESTER",
            "status": "APPROVED",
            "solutionUploadedBy": "660a522230641ad00aae8ab0",
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1UxP8Zv8WNl6n5VQElqcdNo5wxZO0ftPx",
            "solution": "1H5OavitdnJJ68PiYv72bVrUmaxUfu8Ih",
            "nQuestion": "1wnSP7HjcBEqUpJ-knxX2Gmw5ptU3uUGe",
            "nSolution": "1bHI0GtMgYsI-Jf0woBvbgyQd1k0qr9pQ"
          },
          {
            "id": "37e85a38-ef77-4f1a-9a6a-28ad62f10cb5",
            "name": "Spring End Sem",
            "year": "2023",
            "type": "END SEMESTER",
            "status": "APPROVED",
            "solutionUploadedBy": "660a525c30641ad00aae8ab2",
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1vAJ06SYkOo8TxS8tkdOF-AypXuMNOc_7",
            "solution": "1YdxNfTSxTfQZBxuKDBxnUb7-I4qEzNaZ",
            "nQuestion": "1HXJSStpg6Zleq5IIF81XsRFKYx1jmnp1",
            "nSolution": "10D3CBMCbKVXr8zcLqvcjbl0kh2ptEq4T"
          },
          {
            "id": "b04eb98c-9e10-40aa-86c0-269fc9b802b7",
            "name": "Mid Sem",
            "year": "2014",
            "type": "MID SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1c8LGPpvJGjonKAc9v9a9Idvg-NqCdf1B",
            "solution": null,
            "nQuestion": "1zmkvWtLyUbRXJrkdUc1U17kGsIX4mhAU",
            "nSolution": null
          },
          {
            "id": "f1060093-0077-41df-8985-f0b6273f5117",
            "name": "Autumn End Sem",
            "year": "2015",
            "type": "END SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "10CavpmlZv443l-yHOXAjac0XiO-YI6jY",
            "solution": null,
            "nQuestion": "1AHMZfwjtoehPhMewThLvwyZXsqM0xns_",
            "nSolution": null
          },
          {
            "id": "c8a339ce-65e6-4d35-a840-2f9f0faab8ef",
            "name": "Autumn End Sem-2",
            "year": "2015",
            "type": "END SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1UirX38nnAMEhy71m8hVjrl864wMxFw2_",
            "solution": null,
            "nQuestion": "1zGx7n3OH3HTw9w8ZQqXHhliCxOcIObsh",
            "nSolution": null
          },
          {
            "id": "49b943f4-a30e-4739-86ac-0a23564ddb6d",
            "name": "Autumn End Sem",
            "year": "2014",
            "type": "END SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1jb44o6KPX1opveiTt5LkYCTOj512cHqK",
            "solution": null,
            "nQuestion": "1XQC7ICOdi-ma6WufxtW3IPmt9kySI_xa",
            "nSolution": null
          },
          {
            "id": "85675039-338b-4161-b909-190178421eda",
            "name": "Autumn End Sem",
            "year": "2013",
            "type": "END SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1TAjzhynrWZbzaDXj4XKbkH26ie2KgxiL",
            "solution": null,
            "nQuestion": "13aegwNfRrXW5QkKqICuNWmDf9zlbJPB-",
            "nSolution": null
          },
          {
            "id": "6b9583b5-f0df-4773-8d5b-7125a531c0fa",
            "name": "Spring End Sem",
            "year": "2024",
            "type": "END SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "12SsWe-FGWnP_jKkHhYWnDjxvW7HDrpgW",
            "solution": null,
            "nQuestion": "1bn7ZG8ddTwULEaj5vTM3UUThcM4B-dYH",
            "nSolution": null
          },
          {
            "id": "01226c3b-16e1-46da-b22a-290b3ffabdcb",
            "name": "Autumn Mid Sem",
            "year": "2024",
            "type": "MID SEMESTER",
            "status": "APPROVED",
            "solutionUploadedBy": "672243535a965de869c43397",
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1jmo3oq46Mvaiuv0RXA1_jHRZ9OLl3y74",
            "solution": "1BHXhgC2AueOMlep-GycmiQ3hvHsiBXGf",
            "nQuestion": "1EDQ0jhZvVc5A53Tp6kAPBhBHzuWnXWPm",
            "nSolution": "1hlzlPdYwc8J7yvlNU92SzoT9rqmVIj6y"
          },
          {
            "id": "d9161ba7-4888-4d64-95ad-0f0c7bfba957",
            "name": "Redmid",
            "year": "2017",
            "type": "MID SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "19areL_RBJTW3rn-v198vjcOoVMmnES1g",
            "solution": null,
            "nQuestion": "1q17Y32olkdLPpF8n5CdBoYEOLQGnxh3t",
            "nSolution": null
          },
          {
            "id": "5bfa69a1-7b75-4c63-8541-d21bc00d2602",
            "name": "Redmid",
            "year": "2018",
            "type": "MID SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1DJ_RyhGRGomKLYY2KF3XZC6O_HhT4kP-",
            "solution": null,
            "nQuestion": "1QBpCisw1vEj9doZ8xM5_UqNh7pNT6E2M",
            "nSolution": null
          },
          {
            "id": "b8978224-aae8-48a0-9340-eea51381da4e",
            "name": "Supplementary",
            "year": "2019",
            "type": "MID SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1O19Foh8SSqAALaCpuENxr8j12IHy2i3l",
            "solution": null,
            "nQuestion": "1sZv7RdZ_bLD_7sSW7OerDVMKpssqFf2Z",
            "nSolution": null
          },
          {
            "id": "9bc11327-6e77-4fbb-aaa5-36ca820a859a",
            "name": "Spring Mid Sem",
            "year": "2021",
            "type": "MID SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1uk7rnUGhHgvK_IwzXF8wiTMKAVVw10ez",
            "solution": null,
            "nQuestion": "1DkXDE2YYmOhfxCqW7aqYldymcQeTnLLj",
            "nSolution": null
          },
          {
            "id": "18a97114-654d-4171-b39b-f62c8855933f",
            "name": "MakeUp End Sem",
            "year": "2021",
            "type": "MID SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "15Mhf_Kadesnq50F2AuWllZ0RPcbZMG6H",
            "solution": null,
            "nQuestion": "18soMaQ0pV6ERCGqzdZlrsYhfb7tCVDv3",
            "nSolution": null
          },
          {
            "id": "0f8af6f8-e02b-48e2-8484-8a7a4c3c6e97",
            "name": "Autumn End Sem",
            "year": "2024",
            "type": "END SEMESTER",
            "status": "APPROVED",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "108Jf29kNBXHtZty4yVJK1KhHGtdOVBza",
            "solution": "1dOUWR6G88G06KTm3JhimXv9NLMKtLHjj",
            "nQuestion": "1UnCoc8h18rwtGhm9jk6OgBgQjJn4CxHI",
            "nSolution": "1YbjzRKkmkIyywOzyyXwnITFvJUnOscmH"
          }
        ]
      },
      {
        "id": "65d214db1bdc9aab41338805",
        "name": "Probability and Statistics",
        "SUBCODE": "MA2011",
        "Credit": "4",
        "folderId": "1h2GkDhwd5NHhEo7TjUccF9KQu3bFIwCg",
        "pyqs": [
          {
            "id": "a6213475-5a33-44c3-b18a-f879f37b03d6",
            "name": "Spring Mid Sem Exam",
            "year": "2020",
            "type": "MID SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1yuo-JWwrKlxzfe0PnFKBzbowY5ZtzJ1x",
            "solution": null,
            "nQuestion": "1ZYkFfdBUZoh_oq_BKcvsuIDOH-Oopbvx",
            "nSolution": null
          },
          {
            "id": "892662d2-8f81-49ef-82c1-a51321033754",
            "name": "Autumn Mid Sem Exam",
            "year": "2019",
            "type": "MID SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1REb8IRWU7LZFd-ad8Iq8722RJcuP00mh",
            "solution": null,
            "nQuestion": "1Gd1qDtZhlnt7Nu2Ro86ox4V6FsgFgHFT",
            "nSolution": null
          },
          {
            "id": "41294576-61c5-4f06-a293-038d7159c7b9",
            "name": "Spring Mid Sem",
            "year": "2023",
            "type": "MID SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1h_rZwoW7n1YQazXBalrFYpvUBpL-cQtx",
            "solution": null,
            "nQuestion": "1kXODWK2AN9u4-qZMMPD5Ki0Vd0cmSOQ9",
            "nSolution": null
          },
          {
            "id": "b1a43a96-15dd-4860-ba92-7d725833eee9",
            "name": "Autumn End Sem",
            "year": "2019",
            "type": "END SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1qs0poupKhFI2wrZ2babp5H1T3S2BMHs3",
            "solution": null,
            "nQuestion": "1fvIT0gRVAhB8Nwoch4OyMc76NoISxfhO",
            "nSolution": null
          },
          {
            "id": "bc070827-a730-4c44-82c7-00108e442a08",
            "name": "Autumn End Sem",
            "year": "2022",
            "type": "END SEMESTER",
            "status": "APPROVED",
            "solutionUploadedBy": "660a38a130641ad00aae8aa4",
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1rNUktWe3DAUEdgG3_CEocFYIWIRpGucZ",
            "solution": "1T2KuHMrsVLUymU2ZK2QLpG2RljYmchYS",
            "nQuestion": "1ez6xKuPd_mA8neBYaudROUMZBoAK0kqp",
            "nSolution": "1d0py3OdxlP1eYRyeK4KuQUX_dHf4i_Z6"
          },
          {
            "id": "0e99ebb9-4414-44a0-be51-da891bb77f44",
            "name": "Autumn End Sem",
            "year": "2023",
            "type": "END SEMESTER",
            "status": "APPROVED",
            "solutionUploadedBy": "673516fa5a965de869c434cc",
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1qSYlq6L98hvAe_AJ8XwdrjZMzL3W-SIf",
            "solution": "1lwsMoEPUd9IJevTQQlWusqxotpmAugth",
            "nQuestion": "1q4XfJzLS5pbJz_5H9Wl7sq86aKByVuFV",
            "nSolution": "1cPdxBH1xwAhgZxNbtWP4qp5BD-S2_RQO"
          },
          {
            "id": "209eb595-09c9-4120-aa14-bf989c843c43",
            "name": "Autumn Mid Sem",
            "year": "2023",
            "type": "MID SEMESTER",
            "status": "APPROVED",
            "solutionUploadedBy": "6623bd63ad6e7bd16c843fb0",
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1JsdcyOy8y4vQYeM7N2Fr6AKG0B0zavuo",
            "solution": "1PZsGyNxrcQxQnZKNEpYY085YZ9N3q2sC",
            "nQuestion": "13VzoH9b0WTij814txaiwGpd_cJ8GA8ZG",
            "nSolution": "1rxzwB7N_NU_0xo0BGImhQhO8wW9COXxj"
          },
          {
            "id": "a4c7d3f3-9ce8-48d0-bdaf-e316121809a1",
            "name": "Autumn Mid Sem",
            "year": "2022",
            "type": "MID SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1GFRGW6OCMKI14KhXxyFObIY3YmiJEyGd",
            "solution": null,
            "nQuestion": "1GDfsSQdpLBLtg4nCL-EYAvicp2jOw22A",
            "nSolution": null
          },
          {
            "id": "70cca8f6-8c26-47cb-bafa-8e5e86c3c6e3",
            "name": "Spring End Sem",
            "year": "2023",
            "type": "END SEMESTER",
            "status": "APPROVED",
            "solutionUploadedBy": "6684333cf6aabfe19cf4fd16",
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1qpQjHiNNGwjcDOvp5cyXBgKDUJoq9yfi",
            "solution": "1iTHHWkxIbKrmSOizYR9zWc8N5ll9O984",
            "nQuestion": "169WQPjYmzaG40VkRmMdD_409LvdcrRC3",
            "nSolution": "1JULR11vGwioBDKqnz3bN0jUdiM1xesiz"
          },
          {
            "id": "b4595c66-394b-47be-93cc-fea490219a1a",
            "name": "Spring End Sem",
            "year": "2024",
            "type": "END SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1sB9M8zy0TgYBpygM6tpHvBtX6MYLEvAh",
            "solution": null,
            "nQuestion": "1_KjbdsaC6uZxrOdpJk6htHYbB4zcrZul",
            "nSolution": null
          },
          {
            "id": "6c1de6fa-9ba5-46d1-89f4-e1d2b57a414b",
            "name": "Autumn Mid Sem",
            "year": "2024",
            "type": "MID SEMESTER",
            "status": "APPROVED",
            "solutionUploadedBy": "6721c2095a965de869c43386",
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1MdHIDVWHmEJ61Cy3iJsZ6IPri5PQW3OP",
            "solution": "1mO1vYdy1bdHNVkJndtja18lImHvr1Shn",
            "nQuestion": "1kI8kSHaTPNyQKpGY6ZhrgwNNoiJGFGQz",
            "nSolution": "1T2KmsjpZsVA7OXiEh_iiAQInFjTCdiQp"
          },
          {
            "id": "947169b1-5724-4781-8a60-e6378d753b21",
            "name": "Autumn End Sem",
            "year": "2024",
            "type": "END SEMESTER",
            "status": "APPROVED",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "16gbi15ItyYV6OyXxbzPbyGNGifup3oUR",
            "solution": "1nQ4pyE6a7EZKoRoReZGrO7Fqz1JvZcAN",
            "nQuestion": "1LgyRJjSpCl61tVpoPpbkT_t1SqP1nUBh",
            "nSolution": "182odmCqlYVInYDiv4bAsNzfZS3Z1k-uq"
          }
        ]
      },
      {
        "id": "65d2211d1bdc9aab41338806",
        "name": "COMPUTER NETWORKS",
        "SUBCODE": "IT3009",
        "Credit": "3",
        "folderId": "1XJcx1-Ly2drudYy0vqr_cK20dJVJYpzX",
        "pyqs": [
          {
            "id": "9c7332a5-3567-4ad3-9f5e-072575135aed",
            "name": "Question Bank",
            "year": "2018",
            "type": "Question Bank",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "12rxgy5sXTs5uua8HzQZ84FdogTADxohw",
            "solution": null,
            "nQuestion": "12rxgy5sXTs5uua8HzQZ84FdogTADxohw",
            "nSolution": null
          },
          {
            "id": "f3355af4-ecc2-4b44-a638-a96816894b26",
            "name": "Autumn Mid Sem Exam",
            "year": "2022",
            "type": "MID SEMESTER",
            "status": "APPROVED",
            "solutionUploadedBy": "667d01ff3c448e32cdf1a308",
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1v-wf5H_OQMscUEm56Gi_s21EjimcUWea",
            "solution": "1ih-IdzLBLzUWQCMWCBVVvZ7YYs98qgnQ",
            "nQuestion": "1dPJGCXg_JQIyRl_oXenVzwdDXcJ0pzzR",
            "nSolution": "1hwumPfQEVxmK-aqkKx-UsCPWgm9jkgCn"
          },
          {
            "id": "88341672-4924-4c96-b235-0c4832cfc9ac",
            "name": "Mid Sem Exam",
            "year": "2020",
            "type": "MID SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1pN0GlO7r-Lz5dgV_g4qCp35V7wYFHSpH",
            "solution": null,
            "nQuestion": "1Ma0xSeODUuiDnPlFaEg_PrHE2SkynFL2",
            "nSolution": null
          },
          {
            "id": "d5e25739-d6fe-4692-af31-edbc384465a5",
            "name": "Autumn Mid Sem Exam",
            "year": "2019",
            "type": "MID SEMESTER",
            "status": "APPROVED",
            "solutionUploadedBy": "66dbed8a42841c454a166ebc",
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1OOqnEB8wt4-G0jvHznrLrfafjAlqUgDr",
            "solution": "1uBZ8Me8jXvovDrfs0w9gcrYGGazU-7hz",
            "nQuestion": "14qu7khQLtkpAA3wAZiTBzmXYZNpuzE9I",
            "nSolution": "1KR9vWbsE5TfeeHnHjbgB_m0ETADLxvBG"
          },
          {
            "id": "ffa9fd16-efd1-44c7-8c25-97792a6734a0",
            "name": "Spring Mid Sem Exam",
            "year": "2019",
            "type": "MID SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1ByLjZh7pUcTZtCsndiPkpnBh7V8Vh9As",
            "solution": null,
            "nQuestion": "1hdhphdaItZjdKO96Q7GFgU5I0l_XX4k3",
            "nSolution": null
          },
          {
            "id": "e77c7bef-78ea-451d-ae84-d005dfea74e7",
            "name": "Set 1 Supplementary Mid Sem Exam",
            "year": "2019",
            "type": "Mid Semester",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1dKjoKlSViVVhJT-K-jBYFPWbM397mFXi",
            "solution": null,
            "nQuestion": "1dKjoKlSViVVhJT-K-jBYFPWbM397mFXi",
            "nSolution": null
          },
          {
            "id": "2ad78b13-d9f6-4359-b72e-6d31235c2639",
            "name": "Set 2 Supplementary Mid Sem Exam",
            "year": "2019",
            "type": "Mid Semester",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1Qttr7gvVJ6cZ2_2IxdGpgue4PdWyFtiO",
            "solution": null,
            "nQuestion": "1Qttr7gvVJ6cZ2_2IxdGpgue4PdWyFtiO",
            "nSolution": null
          },
          {
            "id": "000c04a9-8149-40ff-a562-ef6a134cbc6b",
            "name": "Spring Re-Mid Sem Exam",
            "year": "2019",
            "type": "MID SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1-56IEFwR-4RpAReZwjI5oUdscDKWr1he",
            "solution": null,
            "nQuestion": "1vH1tzz3EsPedKn5QuKsF7ru_dE6Rq29X",
            "nSolution": null
          },
          {
            "id": "83abd55f-c307-4192-9895-fdc271a6edbd",
            "name": "Set 1 Autumn Mid Sem Exam",
            "year": "2018",
            "type": "MID SEMESTER",
            "status": "APPROVED",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1RoNj9nMkzfjlKiuMHZ67IG6AJdF61Oqx",
            "solution": "1qO2wT3Ccya2nLWfPWyQ6EKDb2Hime5Wb",
            "nQuestion": "1oQF6ib_RCieQcnjDi976JbQ639sPjKyn",
            "nSolution": "1wOMm1Wty6RT221qbm9dJXu3QhpgyPtBv"
          },
          {
            "id": "2281b9d5-6f4a-418e-8b4b-9921c91b77c5",
            "name": "Set 2 Autumn Mid Sem Exam",
            "year": "2018",
            "type": "MID SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1dZgTARD3jVet3xNPkluevgHWkf-6NLSk",
            "solution": null,
            "nQuestion": "1ValpITdE_QbOm1QScD40lBhG67YAWSYO",
            "nSolution": null
          },
          {
            "id": "df83c2e2-5c7a-4baf-8907-094df3a0941e",
            "name": "Autumn Mid Sem Exam",
            "year": "2017",
            "type": "Mid Semester",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1sBUKW4Cd2lhyYszsbYaliLahT0x1B2Zp",
            "solution": null,
            "nQuestion": "1sBUKW4Cd2lhyYszsbYaliLahT0x1B2Zp",
            "nSolution": null
          },
          {
            "id": "255ec93c-cbaf-46d6-bc86-8855753da903",
            "name": "Mid Sem Exam",
            "year": "2016",
            "type": "MID SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1fOxAkUzYNjbzIisyS7JlHtCTLKurOp8R",
            "solution": null,
            "nQuestion": "1SzzQeLTczkyctLqQFPqD2NqOC800LkI2",
            "nSolution": null
          },
          {
            "id": "036f751d-5d3b-43a9-944b-0cb0af9bfe51",
            "name": "Autumn End Sem Exam",
            "year": "2022",
            "type": "END SEMESTER",
            "status": "VERIFIED",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "17lXftQ2uNeHvLcYrQyBVdO1FfI-6Q8H2",
            "solution": "1HeiYPmvt_RQYOYIrUrhldqTHeATsoiVo",
            "nQuestion": "1KBwaGcHb_hNqOseJl3xx6spsZ3TGjRTa",
            "nSolution": "1HeiYPmvt_RQYOYIrUrhldqTHeATsoiVo"
          },
          {
            "id": "47027101-ff86-4b15-a93f-17f0ff5ba8a8",
            "name": "Autumn End Sem Exam",
            "year": "2019",
            "type": "END SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "19Tk_p7L8s9QroisC3DT-jMqFDjmmTdFF",
            "solution": null,
            "nQuestion": "11y89I29UUc7yJS0VKKtrshRivlkn8XhO",
            "nSolution": null
          },
          {
            "id": "59ad52e0-4d7f-4b77-b11a-216972206957",
            "name": "Spring End Sem Exam",
            "year": "2019",
            "type": "END SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1Znc4wuxg3hLiv7pq5oNo5H3cHqT3hEDb",
            "solution": null,
            "nQuestion": "1-gOEgn7fBvlgnDbpjAUyCnYKDo2GK56E",
            "nSolution": null
          },
          {
            "id": "5d4ead40-4f37-45eb-9d3f-cc1f9658c16d",
            "name": "Supplementary End Sem Exam",
            "year": "2019",
            "type": "End Semester",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1rE8a-RbonH4LGmItjHiDxv6aLO4ylfNH",
            "solution": null,
            "nQuestion": "1rE8a-RbonH4LGmItjHiDxv6aLO4ylfNH",
            "nSolution": null
          },
          {
            "id": "1024ed25-eeeb-44bb-96af-3766b55bfc66",
            "name": "Autumn End Sem Exam",
            "year": "2018",
            "type": "END SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1yu_e7RFvPu5ZV_eFU7-G_xq5WBvybfbf",
            "solution": null,
            "nQuestion": "1nbjU0ef7YsUuU0sqLSvBQzUXsIk_06Gt",
            "nSolution": null
          },
          {
            "id": "c7166562-a38e-4c6d-9509-f18682c3c593",
            "name": "Supplementary Autumn End Sem Exam",
            "year": "2018",
            "type": "End Semester",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1uxyAMXOiTAUtjeCXXUr65GEkUjyQb6Ky",
            "solution": null,
            "nQuestion": "1uxyAMXOiTAUtjeCXXUr65GEkUjyQb6Ky",
            "nSolution": null
          },
          {
            "id": "caef2346-db21-4074-96a8-d6ed1bf0f084",
            "name": "Autumn End Sem Exam",
            "year": "2017",
            "type": "END SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1ULnCfcovmNEJFbng9tAhbDwB-Hn9Nivh",
            "solution": null,
            "nQuestion": "1tZLeFOxq7TA3nxATm7NNxXALEvupKGH9",
            "nSolution": null
          },
          {
            "id": "a2f30b2e-bd38-42e0-94c6-92496c2ac5b6",
            "name": "Autumn Mid Sem",
            "year": "2023",
            "type": "MID SEMESTER",
            "status": "APPROVED",
            "solutionUploadedBy": "66d6c29942841c454a166e91",
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1rEwIdnPrIU954sjP8L146dRx-yeuRcgw",
            "solution": "1CtcKizIFEMSQR8m-sDLSd68NfzJwaV_u",
            "nQuestion": "1Z2f71HwbZ85gVuNict54BSr8QL4cITcO",
            "nSolution": "1kI-qvr6nPT_TYzwVQgs1SC79fKFGYcn3"
          },
          {
            "id": "5b2f677e-7695-4c72-91ec-ce110d38118c",
            "name": "MakeUp Mid Sem",
            "year": "2015",
            "type": "MID SEMESTER",
            "status": "APPROVED",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1ctZbQQA7amXtF28RxdYbNELCIvrqXL1p",
            "solution": "1mzlFo7GWZb3nQgTMjd_aX0JV7w-6hAJS",
            "nQuestion": "1vKIV67h7xX56uYbV6rNf-WRrwI8W0pwI",
            "nSolution": "1xh8vQItCRPv9ywRz7fe_W5AgMafS8JB9"
          },
          {
            "id": "788a60bc-05eb-4fdc-94bf-6edad8b8b1be",
            "name": "Autumn End Sem",
            "year": "2023",
            "type": "END SEMESTER",
            "status": "APPROVED",
            "solutionUploadedBy": "661aa9f9a909c6db59a42033",
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1Rm_9LQez9ZxeH1KK4aLJNRaCIlJXeWYY",
            "solution": "17f3VR9PVmlCmtsFjo0RPZqWPUJZfwyQl",
            "nQuestion": "1PllOgreTlNothQgIx2KjREjyYrIebM7N",
            "nSolution": "1qX6lcdGzbgdL432WZE7LeJ_xlKZw6P2Q"
          },
          {
            "id": "50875e94-be07-451d-90a0-2889d81560f5",
            "name": "Autumn End Sem",
            "year": "2016",
            "type": "END SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1wjN6ZOs47Y0HPRA4Q8Bvh4ZFt-yvovIc",
            "solution": null,
            "nQuestion": "1fQ3nRssSaV2-40saI0cqQoGWS4Prxkwk",
            "nSolution": null
          },
          {
            "id": "8092e19a-ca6d-4f31-9165-e9b4ef312c24",
            "name": "Autumn End Sem",
            "year": "2015",
            "type": "END SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1kfTQyHBNZxGpNYjyvKurhoVOGmVl7tQ0",
            "solution": null,
            "nQuestion": "1Mwjymp52cpBgT8njb_pSS1jnSorJoA0e",
            "nSolution": null
          },
          {
            "id": "dcc4c45e-bce5-43e3-806f-84cc714877c2",
            "name": "Mid Sem",
            "year": "2015",
            "type": "MID SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1sAcvczrgkZCRxhQ4HUt7XRdZXpmnXAux",
            "solution": null,
            "nQuestion": "1dpCaE_EH8iGEfqnXb4MDU8Rsr7oni-44",
            "nSolution": null
          },
          {
            "id": "9a3b3609-ae84-44ea-b73d-bc1977e51fb5",
            "name": "Spring End Sem",
            "year": "2013",
            "type": "END SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1_H0MxRJF-TT3CS1IadcX0eH4wmmz9w1l",
            "solution": null,
            "nQuestion": "1kn_z_9sBiRL9uAWIeuV_lgZ-7oxGXo3Q",
            "nSolution": null
          },
          {
            "id": "d72b3d47-bf8b-4deb-b599-e729caf58967",
            "name": "Supplementary",
            "year": "2013",
            "type": "END SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1PYTboqca0s_c4jm9hti_UH0sEdO0C8gq",
            "solution": null,
            "nQuestion": "1YyJIJh1ZCMiInkKk6xB0FAxzrNVexh38",
            "nSolution": null
          },
          {
            "id": "b4ca3963-82c7-43b8-aeb1-7d010bbc83b4",
            "name": "Spring End Sem",
            "year": "2014",
            "type": "END SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1ClAW9rprmT-jh6PjEUeyzCDOSgslp_Wh",
            "solution": null,
            "nQuestion": "1bRTwugoTUftaDowm3BC9QZwFUyCGPV97",
            "nSolution": null
          },
          {
            "id": "fa95f16a-ad2d-4f4f-b8b7-8c30c73927bf",
            "name": "Spring Mid Sem-2",
            "year": "2015",
            "type": "MID SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1CIvDfLHJmqfY0wC_idGX9O0f45Aq6gzQ",
            "solution": null,
            "nQuestion": "1NsofM53ZYcjwCRjXm8W53cBDxPeJbbHx",
            "nSolution": null
          },
          {
            "id": "4e04b4fd-1bf2-4b36-a0ab-7f78cca16a92",
            "name": "Spring End Sem",
            "year": "2015",
            "type": "END SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1iyTh4T91NoqVwwVNm7YngtRi2vn1AZAS",
            "solution": null,
            "nQuestion": "1QBKaf_Bia-ACMBRnXl_IFKKrm9RfIk89",
            "nSolution": null
          },
          {
            "id": "a4531da8-3e4f-4a8e-bddb-dd7b6abc4396",
            "name": "Spring End Sem",
            "year": "2016",
            "type": "END SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1iUSNp2VgHKB-N4OD7kJVrk9RQW9OT1-J",
            "solution": null,
            "nQuestion": "1ZAW_z12PKOtH6EjOOx9W4w7xPBmWS-Aa",
            "nSolution": null
          },
          {
            "id": "dffb742c-6b2d-43b0-a121-f1147f6689b9",
            "name": "Autumn End Sem",
            "year": "2020",
            "type": "END SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1ssZYyN8fEBYas7G_7PUAyls5Jp5FBRJJ",
            "solution": null,
            "nQuestion": "1lvhcn3X5kGRKzN_ex0um5uMkLb8xh8aG",
            "nSolution": null
          },
          {
            "id": "308b7b6d-e3dd-4d67-9858-017f78fa361c",
            "name": "Spring End Sem",
            "year": "2021",
            "type": "END SEMESTER",
            "status": "APPROVED",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1DdwJ8KnlMcJiMauqo0Tvh6LKRNChoomS",
            "solution": "1IUfvR3Vepinv3T4_gf4dsZOl9Q61j0Tz",
            "nQuestion": "1HLbnsr7Qz_ln1_1KVfZECBOdhBxnWihI",
            "nSolution": "1qcIrupK0K92IN_oAem6BKalubXsI06qg"
          },
          {
            "id": "47d8d7dd-72e5-409b-a6ea-cc292b37fc44",
            "name": "Autumn Mid Sem",
            "year": "2024",
            "type": "MID SEMESTER",
            "status": "APPROVED",
            "solutionUploadedBy": "6721b1935a965de869c4337a",
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1xeHxvzXHRdkKSU0KePfPo9KkexJTElbz",
            "solution": "1CwKJyqhDPN6cDjsW5LjfbnWzBRP--8Gx",
            "nQuestion": "1YWuXnwzHbWWc6j2wkBeLR39gV6Xct7_h",
            "nSolution": "1ypw0R0PjBV293R-fOnynsP1SoLiocX66"
          },
          {
            "id": "87d81479-3e33-4059-99c1-94e7ad63daff",
            "name": "Autumn End Sem",
            "year": "2024",
            "type": "END SEMESTER",
            "status": "APPROVED",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "12tb645Aw_q_jTaHdWqNWOiHhJ5ozFfpK",
            "solution": "1vfeQJD5TYlXL7xPM_S0AFV4GzeHDLycK",
            "nQuestion": "1Y-OUuDTZpriYjgVKQH2x2MCWgQR9hQqt",
            "nSolution": "1UdCzENgzezbRQiZEjspxT6v3oW5EYzki"
          }
        ]
      },
      {
        "id": "65d2211d1bdc9aab41338809",
        "name": "SOFTWARE ENGINEERING",
        "SUBCODE": "IT3003",
        "Credit": "4",
        "folderId": "1LjbtjshmDlZVSN9scqnoMiXlNnTl9FB1",
        "pyqs": [
          {
            "id": "f05d2f7c-a7b2-4f09-a6d8-586bf74e2129",
            "name": "Autumn Mid Sem Exam",
            "year": "2022",
            "type": "Mid Semester",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1EpKGZOyCN5SfNmAiOQoZHDeZAgHibLir",
            "solution": null,
            "nQuestion": "1EpKGZOyCN5SfNmAiOQoZHDeZAgHibLir",
            "nSolution": null
          },
          {
            "id": "a72a919a-b564-4e80-a724-ff9243924297",
            "name": "Autumn Mid Sem Exam",
            "year": "2020",
            "type": "Mid Semester",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1yRcIfZE-HgyofZTGWTBqWxD_NF7SsRD_",
            "solution": null,
            "nQuestion": "1yRcIfZE-HgyofZTGWTBqWxD_NF7SsRD_",
            "nSolution": null
          },
          {
            "id": "b68b4d1c-ddf2-44de-8fe9-c3e496a9f044",
            "name": "Set 1 Mid Sem Exam",
            "year": "2019",
            "type": "MID SEMESTER",
            "status": "APPROVED",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1DpF-qYvS-RhpHUhoIiSlSybYRs8XAtPh",
            "solution": "1KEWsjjKvSoVAAHEIwBVpWLLFcd4Sm3nY",
            "nQuestion": "1izGGPaukxpLC4iImTx_bW4x6sZvbte-L",
            "nSolution": "1IHuFp26B3hVVWyhmVp0Ubpne6udcslx8"
          },
          {
            "id": "5404ba26-dac2-437c-951c-8e9174294e6d",
            "name": "Set 2 Mid Sem Exam",
            "year": "2019",
            "type": "MID SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1_YZPD4OszZKRkeeBZmHCp3m8qxc1Db1G",
            "solution": null,
            "nQuestion": "1bByjjbwJFklEAVJXonkiig2JYgggqHMa",
            "nSolution": null
          },
          {
            "id": "10b9ed22-82db-4128-8b45-3c554e01a420",
            "name": "Autumn Mid Sem Exam",
            "year": "2018",
            "type": "MID SEMESTER",
            "status": "APPROVED",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1Ca1LmCUllIt62jaayv6rOVkoNOHsXUle",
            "solution": "1w63Mpi3aBlxtnE6RPhqEV07L7pySTFat",
            "nQuestion": "18LxDlyGzYt72KlA4sI-5weu4FwMwk_7l",
            "nSolution": "15pk7mDf7HVi41kT2lJGXSo950b_Vt1eW"
          },
          {
            "id": "86728eee-0ba5-4e2c-acdc-5b304da8eae0",
            "name": "Autumn Re-Mid Sem Exam",
            "year": "2018",
            "type": "Mid Semester",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1InQZ1J5h-RA5GaTnc4AmN46ZPXbKLC7H",
            "solution": null,
            "nQuestion": "1InQZ1J5h-RA5GaTnc4AmN46ZPXbKLC7H",
            "nSolution": null
          },
          {
            "id": "d4dd3be7-5c30-4e23-bbb4-4d5b4d99d26e",
            "name": "Mid Sem Exam",
            "year": "2016",
            "type": "MID SEMESTER",
            "status": "APPROVED",
            "solutionUploadedBy": "66eda058f740b2b3e5002d56",
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1LUG7zW6YbL4p2kojm8yhlSo6OYgnF8m5",
            "solution": "1ZM4P-vmHwuq9DHIrYB83dsb1aFWxXbb3",
            "nQuestion": "1hX9wLusGS2NS7uI7omqXH4QVv3T4lgtN",
            "nSolution": "10uY_G69QY7c34FDubKCqW3t2QgKE3cPa"
          },
          {
            "id": "ba6145ea-4471-4e44-8563-4b1102c2602b",
            "name": "Mid Sem Exam",
            "year": "2015",
            "type": "MID SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1NzPHnlDw0LDlloVI4hr9JGVkMnmKlqXz",
            "solution": null,
            "nQuestion": "1KG8SUKYCJ83lB1Ehe7E5Qc9P6adr34yy",
            "nSolution": null
          },
          {
            "id": "ba2ac1be-1cbd-49d3-acfd-8004748c1aba",
            "name": "Autumn End Sem Exam",
            "year": "2022",
            "type": "END SEMESTER",
            "status": "VERIFIED",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1x3YSthZ6NqAspksZsxgH8ouWMgvemgPI",
            "solution": "1OAVK-Ds_rSGsnBGoTLPw1Ghpu1QHAwpD",
            "nQuestion": "1ONrYZ_bfcTTH-zD8sjSnt1Ta0rKQBukC",
            "nSolution": "1OAVK-Ds_rSGsnBGoTLPw1Ghpu1QHAwpD"
          },
          {
            "id": "b03db306-3f26-407b-9e91-0dab0760d14f",
            "name": "Autumn End Sem Exam",
            "year": "2019",
            "type": "END SEMESTER",
            "status": "APPROVED",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1m2pO6j_K5BbEWcwMHQuLkXZQfCsrtj1v",
            "solution": "1q0Veo6VF7SwPmDf1pVq0D28a_kmKwxYc",
            "nQuestion": "1nq-SSDL_q9k2W3c9QVTT3_sBbBpEmbGZ",
            "nSolution": "1NO5iWBV0nbndFgN-LCbSJiS7TiLyLfjc"
          },
          {
            "id": "ef27c410-d6a1-4910-865b-3fd28902b774",
            "name": "Set 1 Autumn End Sem Exam",
            "year": "2018",
            "type": "END SEMESTER",
            "status": "VERIFIED",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1F5ObPo8fLYqiK4rVwl3anSlvM-_6cHTI",
            "solution": "1aNddlJyFfOPiakPK7Wz5FgaqE8Gx8z7S",
            "nQuestion": "1r59NplYLekPmQhGXCzFiHkkXP8YggHfF",
            "nSolution": "1aNddlJyFfOPiakPK7Wz5FgaqE8Gx8z7S"
          },
          {
            "id": "c25bedde-c17c-4879-9942-f3ea9492a6e6",
            "name": "Set 2 Autumn End Sem Exam",
            "year": "2018",
            "type": "End Semester",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1d-MQ9cL-5MiDprgKlmrn9xTilKsK--H7",
            "solution": null,
            "nQuestion": "1d-MQ9cL-5MiDprgKlmrn9xTilKsK--H7",
            "nSolution": null
          },
          {
            "id": "ff19ece6-b0fc-4f02-9b4c-62ad3c9af3b8",
            "name": "Autumn End Sem Exam",
            "year": "2017",
            "type": "END SEMESTER",
            "status": "VERIFIED",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "177Qk9ooFuu0karfJB1JPZn5CrbFyvbRF",
            "solution": "1PMXOMyHh9FTLO-xRZ8uWu_asmOay0SQK",
            "nQuestion": "1mlJqayHU-Rs9GLG5gnK0VLqAtjzpdC4e",
            "nSolution": "1PMXOMyHh9FTLO-xRZ8uWu_asmOay0SQK"
          },
          {
            "id": "9e4cfde5-c2ba-408c-b1b0-bc71b747a90f",
            "name": "Autumn End Sem Exam",
            "year": "2016",
            "type": "End Semester",
            "status": "VERIFIED",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1HAoRFv68fyDu3c1tEytzmWd2mKNSY997",
            "solution": "1Id5s88VVaZfczTDE6QD9fXNXId6Xp1nK",
            "nQuestion": "1HAoRFv68fyDu3c1tEytzmWd2mKNSY997",
            "nSolution": "1Id5s88VVaZfczTDE6QD9fXNXId6Xp1nK"
          },
          {
            "id": "8c78c92f-a788-4fe9-bc02-6d5844261263",
            "name": "Spring End Sem Exam",
            "year": "2016",
            "type": "End Semester",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1R-2fA2yub4tQ6v6_3ITx5OZtWZ7l63f4",
            "solution": null,
            "nQuestion": "1R-2fA2yub4tQ6v6_3ITx5OZtWZ7l63f4",
            "nSolution": null
          },
          {
            "id": "b727084d-52b1-40da-b0d3-c7e23ec1bbee",
            "name": "Spring End Sem Exam",
            "year": "2014",
            "type": "END SEMESTER",
            "status": "VERIFIED",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1kwWSHO9KO9Pbsb4lL5RVGkbOkgNVGaUO",
            "solution": "1HAEOEJ7_i7egGu8FYMfsbmOA30KzzD6O",
            "nQuestion": "1RiUjcUT1ojQbWcdZcDIt8eo8r1Rdnyej",
            "nSolution": "1HAEOEJ7_i7egGu8FYMfsbmOA30KzzD6O"
          },
          {
            "id": "c3dc69f2-aa67-40d0-83b3-f3121cbbc26c",
            "name": "Set 1 Spring End Sem Exam",
            "year": "2013",
            "type": "End Semester",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1U8EpawfvDKOGKPqcdiJpsWcXF9224Yxz",
            "solution": null,
            "nQuestion": "1U8EpawfvDKOGKPqcdiJpsWcXF9224Yxz",
            "nSolution": null
          },
          {
            "id": "e32b6eb7-ff85-430b-beea-3a3fdc0eac79",
            "name": "Set 2 Spring End Sem Exam",
            "year": "2013",
            "type": "END SEMESTER",
            "status": "VERIFIED",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1Z8xfBhq6zV2XAy3fF2g_vmwdFu18Hlqs",
            "solution": "135tZF6SUURq9nFpZh5cO-3PMGVprpCKj",
            "nQuestion": "1nWjnKmAJ7bggFKcwrebCehNBIOSpUtyj",
            "nSolution": "135tZF6SUURq9nFpZh5cO-3PMGVprpCKj"
          },
          {
            "id": "96b70247-7044-4d9e-bd7e-74d3ecb3f04b",
            "name": "End Sem Exam",
            "year": "2010",
            "type": "END SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "13alkPmrgtXgKK5JVNn6w22VH1atQ5VQd",
            "solution": null,
            "nQuestion": "1GHXSmnrxEAwRWS7jXwjJ93Uaew-VfLxr",
            "nSolution": null
          },
          {
            "id": "57713620-f335-469b-a65e-17274864cb0d",
            "name": "Autumn Mid Sem",
            "year": "2023",
            "type": "MID SEMESTER",
            "status": "APPROVED",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1adt_nRqOArmkAu0bLGCcEYFL5AD3bufI",
            "solution": "1MpMfUx1qTsmhZsOncqjXwXfLnExcgyL4",
            "nQuestion": "18Bw_GDLGuGGrukNUrGCY7u6PART2MyBV",
            "nSolution": "1y279s2-UGaOk7eLoeZniw9tyFJjqx5bI"
          },
          {
            "id": "c33b8899-1a1d-4528-ab6c-101c7b35bca2",
            "name": "Autumn Mid Sem",
            "year": "2019",
            "type": "MID SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1aebRCRFADxXq-bGFLhLNVqdhC5TJLuVy",
            "solution": null,
            "nQuestion": "1WhaWYUrn7TTyiZzkpHuybDD4WxzJMI2E",
            "nSolution": null
          },
          {
            "id": "a438747a-7e57-4ec0-9ebe-c568cc0ad3d4",
            "name": "Autumn End Sem",
            "year": "2023",
            "type": "END SEMESTER",
            "status": "APPROVED",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "11bosXtmT15HhXH4MjD9XRqPZ5r7OntUj",
            "solution": "1LHqIlE1N90OXodGa2GQv_F68tYoDJd0x",
            "nQuestion": "1smEEprrdo8T5b42H3A2kW2sSqFGQc1Zg",
            "nSolution": "1Yh0d6vPyJER3hfy-TDBRMU8o7lGCYVHJ"
          },
          {
            "id": "a4de010b-18e5-4d5e-a281-d53fd27172b2",
            "name": "Spring End Sem",
            "year": "2018",
            "type": "END SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1r3gsFj_mPGH2w7qm6CRlK8VHYfyNaOpA",
            "solution": null,
            "nQuestion": "1p1wiF09D5ckcLPylIX-Zg24CI_QJVNJU",
            "nSolution": null
          },
          {
            "id": "da7f7d6e-a422-41cc-a500-dc7ebacd53a7",
            "name": "Spring End Sem",
            "year": "2023",
            "type": "END SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1FFwbyctxUP0KrHXQk_m9XPa_eGLDeJ7h",
            "solution": null,
            "nQuestion": "1yG_NqVCm-gNiZvtjXjyz0FLf_6Hy0SOC",
            "nSolution": null
          },
          {
            "id": "6ecf9296-4e3c-4981-9dc8-d7153ffac937",
            "name": "Spring End Sem",
            "year": "2015",
            "type": "END SEMESTER",
            "status": "REVIEW",
            "solutionUploadedBy": "66eda0a8f740b2b3e5002d58",
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1cb4_ny2kcxlUlMMFa-Ou5GafCZRt6sxM",
            "solution": null,
            "nQuestion": "1bJfXa2zH9D0PLq3LiIJFM00_IqffFEGz",
            "nSolution": null
          },
          {
            "id": "577dcad9-45b1-4f51-8bed-8d36cd5c5678",
            "name": "Spring Mid Sem",
            "year": "2020",
            "type": "MID SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1zlNb1zgJBLr5S0-EPDKMbYwttOBxOkcb",
            "solution": null,
            "nQuestion": "1-cx_mVu3bbHuRNvHfYKfFh4wFUV6k-Fb",
            "nSolution": null
          },
          {
            "id": "3b7d7250-435a-4339-88da-b39c55b0af7e",
            "name": "Autumn End Sem",
            "year": "2023",
            "type": "END SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1AYtsg1ddT7uRB41H2w-3Z543pGRn9RVe",
            "solution": null,
            "nQuestion": "1v0rFKZ5NoPP4yF9JcXiz4bz1SS5XdS-x",
            "nSolution": null
          },
          {
            "id": "af9e3d3d-e017-4b8f-bbf0-dd46f811fb00",
            "name": "Spring End Sem",
            "year": "2019",
            "type": "END SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1HtYAIWjjvwwGK-y5B9cbBtLp03jihWp3",
            "solution": null,
            "nQuestion": "12D7D63LueFV7Z0imdZp9XaP3zVcAW0NR",
            "nSolution": null
          },
          {
            "id": "e8be69ab-b938-47ca-8891-de3011565968",
            "name": "Mid Sem",
            "year": "2019",
            "type": "MID SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1eQNEFSdS3fRVqUykrxo8URRUv2cJU79W",
            "solution": null,
            "nQuestion": "1XuG82BVPVtdvaS3edUnySDyEhw14whDN",
            "nSolution": null
          },
          {
            "id": "815c5dd3-c7ba-4b8c-9016-8374fecf2722",
            "name": "Spring End Sem",
            "year": "2021",
            "type": "END SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1HbFPKBcki4vKAHJQHh7d5H17-vDkLh2q",
            "solution": null,
            "nQuestion": "1Sve9fQ5U6-qa4nhmP8bSCp3uc5GLF6R3",
            "nSolution": null
          },
          {
            "id": "22a88cb0-70a5-4c03-8c28-6f4d612ce387",
            "name": "Autumn Mid Sem",
            "year": "2024",
            "type": "MID SEMESTER",
            "status": "APPROVED",
            "solutionUploadedBy": "6721b2a55a965de869c4337c",
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1AyZp5ArvSJqPpybN4R73LBEkD5FWYq0i",
            "solution": "1bcYid3xN-kXw7FKMj1_Kx72U0R5r7FJA",
            "nQuestion": "1NXJQfs7bKi29f9fLHlwrBGAXWCqFaCUV",
            "nSolution": "1sHGw-xQYdUYpA37Sh_xlyYeh7UvPIM9U"
          },
          {
            "id": "18ecf894-fc39-4020-891a-6ba5d7ce6e17",
            "name": "Autumn End Sem",
            "year": "2020",
            "type": "END SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1w9YnCje6ADscPkJAy_rnCE9l9TQVBWzD",
            "solution": null,
            "nQuestion": "1cAGAV0i7t9Fhu37UNzvgB6D_3_RMtl4q",
            "nSolution": null
          },
          {
            "id": "0bb53921-b2be-4c63-9eba-14bdacdfadb2",
            "name": "Autumn End Sem",
            "year": "2024",
            "type": "END SEMESTER",
            "status": "APPROVED",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "13UC150D6RpGliRgYSzeyRvGYWzoq_AFk",
            "solution": "1FSeeaHUMWNzxszE-iCppwcLIPXYPmFg-",
            "nQuestion": "1HSI_q4OA_uXCSibBewWcm0DzCcINZEK0",
            "nSolution": "1WeS-FCgJ7GVAzR2FqCp5plniry0vsK3n"
          }
        ]
      },
      {
        "id": "65d2211d1bdc9aab41338808",
        "name": "HIGH PERFORMANCE COMPUT",
        "SUBCODE": "CS3010",
        "Credit": "4",
        "folderId": "1PGH1kRoS1BYOZbd3dIi8tzSjH7ruA3js",
        "pyqs": [
          {
            "id": "93c12e1f-8f24-4698-af6f-f9a0290aa089",
            "name": "Question Bank",
            "year": "2022",
            "type": "Question Bank",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1sXo28m--8k6cJAzIYy8UJbrqaInOucay",
            "solution": null,
            "nQuestion": "1sXo28m--8k6cJAzIYy8UJbrqaInOucay",
            "nSolution": null
          },
          {
            "id": "f34eed64-e5d7-4b0d-9d8e-1d47603e4b66",
            "name": "Autumn Mid Sem Exam",
            "year": "2022",
            "type": "Mid Semester",
            "status": "APPROVED",
            "solutionUploadedBy": "66c2370742841c454a166dff",
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1xESjZgelAv6hK79FW80zgQfGoRsPrJWZ",
            "solution": "1-J02GppP9h3OVKutOgqlVj-aP5HbttVn",
            "nQuestion": "1xESjZgelAv6hK79FW80zgQfGoRsPrJWZ",
            "nSolution": "1yJH5CDuKtbFqgPOyli9eisO268wvxGtX"
          },
          {
            "id": "26c22303-b012-449d-9d2a-f030db7e1c35",
            "name": "Autumn Mid Sem Exam",
            "year": "2018",
            "type": "MID SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1l80oOfInKXtNR7idDhC2RMveMIUKm_wG",
            "solution": null,
            "nQuestion": "1ZDej4axyWvooSWmfeCqE5ww9OnQfqn3o",
            "nSolution": null
          },
          {
            "id": "a84d87ac-3ad2-4817-b69a-a3bc49068654",
            "name": "Spring Mid Sem Exam",
            "year": "2017",
            "type": "MID SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1RuJAMw0sixlZ5fNdiNxVHt1Q5rmlTfUA",
            "solution": null,
            "nQuestion": "1NzDQ_v3t_2YDaRA-wLjgNM2lMSgDFpbf",
            "nSolution": null
          },
          {
            "id": "ca95a425-417e-4b6a-b1b4-4ed349a9fb3c",
            "name": "Autumn Mid Sem Exam",
            "year": "2017",
            "type": "Mid Semester",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1mkXUGWW2gAxX6Nhnrl74TXQjJKiC9Vgi",
            "solution": null,
            "nQuestion": "1mkXUGWW2gAxX6Nhnrl74TXQjJKiC9Vgi",
            "nSolution": null
          },
          {
            "id": "93a92a5e-3468-46f4-85b5-fb4cea3fdb53",
            "name": "Special Mid Sem Exam",
            "year": "2017",
            "type": "Mid Semester",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1lDbNoZZnjMRNVYJ7HeIVY1dtRAcqmlpi",
            "solution": null,
            "nQuestion": "1lDbNoZZnjMRNVYJ7HeIVY1dtRAcqmlpi",
            "nSolution": null
          },
          {
            "id": "c4fa188b-aa98-4a93-89f8-8b9dcc13a722",
            "name": "Repeat Spring Mid Sem Exam",
            "year": "2017",
            "type": "Mid Semester",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1Wvl1RKMRQErTotu3xNWa7dW6S69A3xc7",
            "solution": null,
            "nQuestion": "1Wvl1RKMRQErTotu3xNWa7dW6S69A3xc7",
            "nSolution": null
          },
          {
            "id": "e888dc13-eda7-4b1f-a722-ee2fc0d71341",
            "name": "Set 1 Mid Sem Exam",
            "year": "2016",
            "type": "MID SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1sOxEMGNQG0cAB0s4MnL1mjENWnebaddj",
            "solution": null,
            "nQuestion": "1hu5iOzbwGa2rm4l-98nPR6poddDJKnvv",
            "nSolution": null
          },
          {
            "id": "4862949c-97d5-495d-9134-0b21d29a4089",
            "name": "Set 2 Mid Sem Exam",
            "year": "2016",
            "type": "Mid Semester",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1f3UqZ9t5wx9KJ2YPU7IvUp8Fr_6DQky1",
            "solution": null,
            "nQuestion": "1f3UqZ9t5wx9KJ2YPU7IvUp8Fr_6DQky1",
            "nSolution": null
          },
          {
            "id": "c7645a36-de72-4155-8aac-dcfd328fe452",
            "name": "Set 1 Mid Sem Exam",
            "year": "2015",
            "type": "Mid Semester",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "12I7iQdJnXF7mE_btq4kIWLCnTm-LCH27",
            "solution": null,
            "nQuestion": "12I7iQdJnXF7mE_btq4kIWLCnTm-LCH27",
            "nSolution": null
          },
          {
            "id": "f14c860b-e100-4a24-a1d0-a134670286b0",
            "name": "Set 2 Mid Sem Exam",
            "year": "2015",
            "type": "Mid Semester",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1m3ODrb-O46M5Lm1TVY9vltYexfu7V5YY",
            "solution": null,
            "nQuestion": "1m3ODrb-O46M5Lm1TVY9vltYexfu7V5YY",
            "nSolution": null
          },
          {
            "id": "0c1288b5-343b-4a5d-a323-c90f6aa320d6",
            "name": "Autumn End Sem Exam",
            "year": "2022",
            "type": "END SEMESTER",
            "status": "VERIFIED",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1w54fm-35ATvWrpI4wE-cRZ9v9ookZg6J",
            "solution": "1UYkli36XLSUEHNYSE6IemKXAcGXKa1GZ",
            "nQuestion": "1gJsThL2VI5Gd_Dl-4GJLZ2Up2B5bwXPh",
            "nSolution": "1UYkli36XLSUEHNYSE6IemKXAcGXKa1GZ"
          },
          {
            "id": "b1a7f9d6-f42c-4ae7-9b3c-cc512dc4b032",
            "name": "Autumn End Sem Exam",
            "year": "2021",
            "type": "End Semester",
            "status": "VERIFIED",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1HKXki49sDOb05FU9K8k-9jmLNz3x1Uhb",
            "solution": "1HKXki49sDOb05FU9K8k-9jmLNz3x1Uhb",
            "nQuestion": "1HKXki49sDOb05FU9K8k-9jmLNz3x1Uhb",
            "nSolution": "1HKXki49sDOb05FU9K8k-9jmLNz3x1Uhb"
          },
          {
            "id": "ca3d184f-3077-48c9-b0b1-f11a3aa98fac",
            "name": "Autumn End Sem Exam",
            "year": "2020",
            "type": "End Semester",
            "status": "VERIFIED",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1pA0joh85PhA9_Q1zmkJcqvlSRrVggOHl",
            "solution": "1pA0joh85PhA9_Q1zmkJcqvlSRrVggOHl",
            "nQuestion": "1pA0joh85PhA9_Q1zmkJcqvlSRrVggOHl",
            "nSolution": "1pA0joh85PhA9_Q1zmkJcqvlSRrVggOHl"
          },
          {
            "id": "535395ac-d308-4a9d-83eb-748be563c19e",
            "name": "Spring End Sem Exam",
            "year": "2015",
            "type": "End Semester",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1pqf3Lpg3M3gdoJbv2NXvRcsLKYzO83vH",
            "solution": null,
            "nQuestion": "1pqf3Lpg3M3gdoJbv2NXvRcsLKYzO83vH",
            "nSolution": null
          },
          {
            "id": "6850b638-a081-4d93-b755-66cf9704e0c4",
            "name": "Autumn End Sem Exam",
            "year": "2015",
            "type": "End Semester",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1WBcH6lwLmdjW1XMM8UpP9vyK5rjMQ4_3",
            "solution": null,
            "nQuestion": "1WBcH6lwLmdjW1XMM8UpP9vyK5rjMQ4_3",
            "nSolution": null
          },
          {
            "id": "f8cfc912-c47e-4483-8777-cc37a6c796cd",
            "name": "Autumn Set 1 End Sem Exam",
            "year": "2013",
            "type": "End Semester",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "19AJXg6-Ncyek_ENXNO_aDBqJXzaETD8V",
            "solution": null,
            "nQuestion": "19AJXg6-Ncyek_ENXNO_aDBqJXzaETD8V",
            "nSolution": null
          },
          {
            "id": "ee5c9966-5cdd-4489-b4e4-5e0b3d161cf4",
            "name": "Autumn Set 2 End Sem Exam",
            "year": "2013",
            "type": "End Semester",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1--0wUX9erE8z9QeiyNnujCrUwpw5lZrc",
            "solution": null,
            "nQuestion": "1--0wUX9erE8z9QeiyNnujCrUwpw5lZrc",
            "nSolution": null
          },
          {
            "id": "a714dbdf-bebc-4c65-8e29-e085be4c6860",
            "name": "End Sem Exam",
            "year": "2009",
            "type": "End Semester",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1_doJM0fzfrWkV9a78Hom38nhuu03Nka4",
            "solution": null,
            "nQuestion": "1_doJM0fzfrWkV9a78Hom38nhuu03Nka4",
            "nSolution": null
          },
          {
            "id": "5bf6ce71-2d44-4bb9-8938-36cc76747a38",
            "name": "Autumn End Sem",
            "year": "2023",
            "type": "END SEMESTER",
            "status": "APPROVED",
            "solutionUploadedBy": "661aaa9ba909c6db59a42038",
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1HtLzvGNPddK4jQylxJZEMoxk0JYKM3en",
            "solution": "1UjOGZJUAcdn2IywfMbd4EZFYM9y3iAoa",
            "nQuestion": "1Icw1QdmXqB16Ud1vN9kQBPIGqN3Se1mY",
            "nSolution": "14cY-SannG8r6fN1ssNScqANoo7R1o6P3"
          },
          {
            "id": "f4001a00-a778-47c7-ba5c-8a18ca40bec9",
            "name": "Autumn Mid Sem",
            "year": "2019",
            "type": "MID SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "15hnfGUVlYxITTW6hP2kFtTHkHuBPlqn-",
            "solution": null,
            "nQuestion": "1pkY2BuvSFNZBjWnfN8yL_z4dQ5M6Kxd3",
            "nSolution": null
          },
          {
            "id": "31ef95d8-0288-4c23-9e1d-95bd66451a38",
            "name": "Autumn Mid Sem",
            "year": "2023",
            "type": "MID SEMESTER",
            "status": "APPROVED",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "12Kmmr6jEe_izAGEfXgXBgqdmeYbAp1Ig",
            "solution": "1RHBYvbKVtmXjCAVRMVbkA96rCK6GFDbE",
            "nQuestion": "1jhiqs0poqiiR5s1WvI6sAuT9UBbi0Mss",
            "nSolution": "1Nu9v3qPagHivPqmCovV9mJA3ROUO74A-"
          },
          {
            "id": "3fc085b0-d8f3-45af-9b60-782fd10192ff",
            "name": "Autumn End Sem",
            "year": "2017",
            "type": "END SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1j2G-QNFUdxjIEKnX42qRhrOPlxcZj2zH",
            "solution": null,
            "nQuestion": "1WNHJH1e4XofuDb0yZunMHkfekk-FMfK5",
            "nSolution": null
          },
          {
            "id": "8bf0a484-6816-4ef2-8c9f-607247324337",
            "name": "Autumn End Sem",
            "year": "2018",
            "type": "END SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1gX4fqUfHKz9FB1lpq24HT6LKqY8UAB3s",
            "solution": null,
            "nQuestion": "1xMfOr3S4CsR3v5bMTHVSAoM-uZOcNW0q",
            "nSolution": null
          },
          {
            "id": "3f160892-4cf6-49a7-af39-dd440f51fb45",
            "name": "Autumn End Sem",
            "year": "2019",
            "type": "END SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1veEu10H1_tuCJ2syw5CxcM7SDpsS3v-z",
            "solution": null,
            "nQuestion": "1njQi9EyvkkSuQaJhGG6ip5nkoUfAUfVL",
            "nSolution": null
          },
          {
            "id": "d8475ab7-7208-48df-bcd0-d49fb7b9253a",
            "name": "Spring End Sem",
            "year": "2016",
            "type": "END SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "168DRRBKBmP2nNwoTF9URRbFx3_0V_szx",
            "solution": null,
            "nQuestion": "1NHvmUtCe_P7af6qqn4Kc9e6OWQL1Yn8C",
            "nSolution": null
          },
          {
            "id": "9798264d-0ae6-41c2-8c05-40bb208b339c",
            "name": "Autumn Mid Sem",
            "year": "2024",
            "type": "MID SEMESTER",
            "status": "APPROVED",
            "solutionUploadedBy": "6721b51c5a965de869c4337d",
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1_VdooTExKbCTPfq5BJfmyQ0B4I6fXOY4",
            "solution": "1ti67S868c8RfG7FjAhdp_dgwYcLj8HTv",
            "nQuestion": "1eQd9mAfJezIbOZ1F2ROkEotHkwxeuYMh",
            "nSolution": "12HXOhTe66B12tziy0WJgSU7ex85u4nky"
          },
          {
            "id": "0ee844c3-294d-4ae7-9d5c-2ee170562bdb",
            "name": "Autumn End Sem",
            "year": "2024",
            "type": "END SEMESTER",
            "status": "APPROVED",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1ipxlz4UTLUAb-fvdZSmIY9BD9711CFah",
            "solution": "10uYQahvyF9OXt5mXN1u1fF6Wv1X-uNCH",
            "nQuestion": "1pre7OQ-ntceXDbusunTMo_w-KS2OE5HN",
            "nSolution": "1CcsdzPFdQCXViSdRw1koLz9amt_NjE0c"
          }
        ]
      },



      {
        "id": "65d2211d1bdc9aab41338807",
        "name": "DESIGN & ANALYSIS OF ALGO",
        "SUBCODE": "CS2012",
        "Credit": "3",
        "folderId": "1jPMKCPq5VvpdisqvnlRDw7ORQ4sVBccV",
        "pyqs": [
          {
            "id": "ce87c9e4-5d87-4b23-ad10-5e25f3851d30",
            "name": "Spring Mid Sem Exam",
            "year": "2019",
            "type": "MID SEMESTER",
            "status": "VERIFIED",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1bkIk54i7op9Egkr_Rdb-gVxITPOUGCsJ",
            "solution": "1L54A5BsmzdiO4v9jw8weX3vh_I6_8GuP",
            "nQuestion": "1W0YVgN29RKePEDIK-eTIpFcXtg1ulkcL",
            "nSolution": "1L54A5BsmzdiO4v9jw8weX3vh_I6_8GuP"
          },
          {
            "id": "45199561-c4f2-474e-bdd6-32f16616232e",
            "name": "Spring Mid Sem Exam",
            "year": "2018",
            "type": "Mid Semester",
            "status": "VERIFIED",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "16auJmPKG3I3VE2o51D-3cyjHzFZYdOCx",
            "solution": "12E2zYg9lcl8tXEIVpcghK_MOXrEO-6bi",
            "nQuestion": "16auJmPKG3I3VE2o51D-3cyjHzFZYdOCx",
            "nSolution": "12E2zYg9lcl8tXEIVpcghK_MOXrEO-6bi"
          },
          {
            "id": "40836ce0-fa46-4460-ae6b-21a1b09da6e3",
            "name": "Spring Mid Sem Exam",
            "year": "2017",
            "type": "Mid Semester",
            "status": "VERIFIED",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1Q8D78rj_GgfhxgILUOHGDbUPByvVpJS0",
            "solution": "1FiBY8qOcmgNP9WFN1XSfTGDQmRULGKak",
            "nQuestion": "1Q8D78rj_GgfhxgILUOHGDbUPByvVpJS0",
            "nSolution": "1FiBY8qOcmgNP9WFN1XSfTGDQmRULGKak"
          },
          {
            "id": "b0d30d20-6614-40eb-8b7d-1f8b1b6ba8e7",
            "name": "Spring Mid Sem Exam",
            "year": "2016",
            "type": "Mid Semester",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1qecBGAdmQ4LQ_xQ73A0MaFL4hI57o3vS",
            "solution": null,
            "nQuestion": "1qecBGAdmQ4LQ_xQ73A0MaFL4hI57o3vS",
            "nSolution": null
          },
          {
            "id": "dab72b5a-c31e-42f4-b9bc-4b207eb13f69",
            "name": "Autumn Mid Sem Exam",
            "year": "2016",
            "type": "MID SEMESTER",
            "status": "VERIFIED",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1Vmt3wc9354c63nvpiAGQclKUSn68BD46",
            "solution": "1FQglimRA3Zsr-HFXOPSpLNrejnoEk3-z",
            "nQuestion": "12zyv69G__sVsUfEa0d9guelDUs4rWRfR",
            "nSolution": "1FQglimRA3Zsr-HFXOPSpLNrejnoEk3-z"
          },
          {
            "id": "b0f2c154-a44e-4037-8d22-cee22e7a8ea0",
            "name": "Autumn Mid Sem Exam",
            "year": "2015",
            "type": "MID SEMESTER",
            "status": "APPROVED",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1JxRMQLz1Rcpev5ORM7AuWxUMf8vYfmF_",
            "solution": "1AI99a_4yQeDaT2lJer_jXYICRS01vk6k",
            "nQuestion": "1DYAj7aBDqtTPg9a8IjKvg1AKsnMCjRhL",
            "nSolution": "1DsL3TPZZalmUkLk1xuNN9KpfZ8hvmqSN"
          },
          {
            "id": "d6acebb2-1bab-4c6d-879c-728d85dcdf8c",
            "name": "Autumn End Sem Exam",
            "year": "2022",
            "type": "END SEMESTER",
            "status": "VERIFIED",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1DWkY7s5V2JEkBt-3jgghN5JB8h0wpGzs",
            "solution": "1QqK6GFFFMa82nWrVtOZYJmGUkeP4P2XN",
            "nQuestion": "1mZqRx5SVCNizLKtqjfME9wQ5OLqbAUHj",
            "nSolution": "1QqK6GFFFMa82nWrVtOZYJmGUkeP4P2XN"
          },
          {
            "id": "49c1d413-1107-450e-8447-de652851f8cc",
            "name": "Spring End Sem Exam",
            "year": "2020",
            "type": "End Semester",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1F345eLqpv_5InPo1ZyQWDD90LSN7bscI",
            "solution": null,
            "nQuestion": "1F345eLqpv_5InPo1ZyQWDD90LSN7bscI",
            "nSolution": null
          },
          {
            "id": "2012b5f1-7740-46f7-8f82-4fa285935155",
            "name": "Autumn End Sem",
            "year": "2020",
            "type": "End Semester",
            "status": "APPROVED",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1N8ZRC0OvDHgXAogXK5FPMfyb-08U5n3b",
            "solution": "1IV1uGL0btRgIkL5uqJ9W3BuBRqzHt7YX",
            "nQuestion": "1N8ZRC0OvDHgXAogXK5FPMfyb-08U5n3b",
            "nSolution": "1m4SWLgFdv1ayCUqNkNo8692tllUVB26S"
          },
          {
            "id": "36176fdf-67cb-48a1-aac8-b50e663f8c79",
            "name": "Spring End Sem Exam",
            "year": "2019",
            "type": "END SEMESTER",
            "status": "APPROVED",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1PuNoQRLdGmADvzmXUcMVbUQ6raOXrUyN",
            "solution": "1yACW6UOsNu7ffvKOZ52xWdxiuRhmJRE8",
            "nQuestion": "16R4CzMLr0JXg5KtqQHa74dXSuN2cxTwz",
            "nSolution": "1dACciJIwAYyVNMg92hI6haGKAAmMR_bO"
          },
          {
            "id": "b65bf876-0005-4547-8497-ba65dcb3e29c",
            "name": "Spring End Sem Exam",
            "year": "2018",
            "type": "END SEMESTER",
            "status": "APPROVED",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1kgcfaEfhsYyiomPQsWCXDhbkmQ--tgUr",
            "solution": "1zodp7GBJdBEBetwu_hilQfbeV2vvNSji",
            "nQuestion": "1nW9qbOKnVQMhGf68O_Uap9MR9jJf2mec",
            "nSolution": "1ZffUvMHCwK_yFqSOQtWjh-4hZhBHfN4X"
          },
          {
            "id": "1e29ccd8-89b7-4d2b-8e8b-053d4bb8532f",
            "name": "Autumn End Sem Exam",
            "year": "2018",
            "type": "End Semester",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1yLJnDQa097H7-RCxQmH1hJGliv8wn1zH",
            "solution": null,
            "nQuestion": "1yLJnDQa097H7-RCxQmH1hJGliv8wn1zH",
            "nSolution": null
          },
          {
            "id": "24961016-2c12-4743-ab44-5df39df480d0",
            "name": "Supplementary End Sem Exam",
            "year": "2016",
            "type": "End Semester",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1wGOAkJIN5z2E57tB7ppwPAM1Z4doyBHb",
            "solution": null,
            "nQuestion": "1wGOAkJIN5z2E57tB7ppwPAM1Z4doyBHb",
            "nSolution": null
          },
          {
            "id": "67517b96-7dfe-4c82-9fe6-f487dbd014ce",
            "name": "Autumn End Sem Exam",
            "year": "2015",
            "type": "END SEMESTER",
            "status": "APPROVED",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1gQACYUHOYkZZ_gbScXbbwH05Mo6OgNH-",
            "solution": "1SNPQiBWHUx3ro2ub5DDjffRY_4M20qI_",
            "nQuestion": "1SjGT8szOhCrhw80zheq_U-iaqcjr3EmG",
            "nSolution": "1xj-mImXGLU3_5p-9GYo5OH2fL7vqze11"
          },
          {
            "id": "84fd6d91-315f-4b71-879e-dc605ebfcd55",
            "name": "Spring End Sem Exam",
            "year": "2014",
            "type": "END SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1DK2nzIDDBuH54EnfslNw3QST0vE1ncBz",
            "solution": null,
            "nQuestion": "1XY7b7UgTI_g0j_GWULok1BdkiNlxxqpw",
            "nSolution": null
          },
          {
            "id": "6c162057-9925-4d02-8c70-c67511483b32",
            "name": "Autumn End Sem Exam",
            "year": "2013",
            "type": "End Semester",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "17mSrtPzqAkI-faeQKaKyxAfRsMR3Y5lr",
            "solution": null,
            "nQuestion": "17mSrtPzqAkI-faeQKaKyxAfRsMR3Y5lr",
            "nSolution": null
          },
          {
            "id": "fdef8490-3b21-4815-9056-826c422b7481",
            "name": "End Sem Exam",
            "year": "2012",
            "type": "End Semester",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1lY2puXhDY6k3o7k_EE-X4TQo5gUhEDVs",
            "solution": null,
            "nQuestion": "1lY2puXhDY6k3o7k_EE-X4TQo5gUhEDVs",
            "nSolution": null
          },
          {
            "id": "fdc25313-eaa5-4cad-84ae-8879a2d53edb",
            "name": "Supplementary End Sem Exam",
            "year": "2012",
            "type": "End Semester",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1kMaF7wqtnF65cpO-EORVo4PyUE0ZRP77",
            "solution": null,
            "nQuestion": "1kMaF7wqtnF65cpO-EORVo4PyUE0ZRP77",
            "nSolution": null
          },
          {
            "id": "3c33e640-c3f3-456f-99af-e800bca13cc9",
            "name": "End Sem Exam",
            "year": "2011",
            "type": "End Semester",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1At30ReE4bH-1S_J-VxgSKEDihumveKEW",
            "solution": null,
            "nQuestion": "1At30ReE4bH-1S_J-VxgSKEDihumveKEW",
            "nSolution": null
          },
          {
            "id": "fc860194-e4c4-4e03-b200-3da1f6ba8d0c",
            "name": "End Sem Exam",
            "year": "2010",
            "type": "End Semester",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1zMSMnYTwTpsZF12IHCkom6JjipWktCKJ",
            "solution": null,
            "nQuestion": "1zMSMnYTwTpsZF12IHCkom6JjipWktCKJ",
            "nSolution": null
          },
          {
            "id": "4349ec34-066e-48b5-8efd-19975cb577b5",
            "name": "Supplementary End Sem Exam",
            "year": "2010",
            "type": "End Semester",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1iS32XHYfgL_WqXzRJbevShbWQYWXJ2Nl",
            "solution": null,
            "nQuestion": "1iS32XHYfgL_WqXzRJbevShbWQYWXJ2Nl",
            "nSolution": null
          },
          {
            "id": "fdec84a9-07e2-426d-b78c-3dcfc239f4f0",
            "name": "End Sem Exam",
            "year": "2009",
            "type": "End Semester",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1NHu0zW5bjYwW-qmYDxBfT2mINcWo3G2_",
            "solution": null,
            "nQuestion": "1NHu0zW5bjYwW-qmYDxBfT2mINcWo3G2_",
            "nSolution": null
          },
          {
            "id": "ea19f3c4-83d9-4f7f-b2a7-70d24896fabc",
            "name": "Autumn Mid Sem",
            "year": "2023",
            "type": "MID SEMESTER",
            "status": "APPROVED",
            "solutionUploadedBy": "669bf81442841c454a166c93",
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1NphnIqrlaNdHdWGDNpRGoOXcyTMn0RbV",
            "solution": "1UrA0IWFE7FmxX_EyB92cLQXLGnOf7npA",
            "nQuestion": "1sZF6dqiJJMfcClblbST0TVao_RpIcy2I",
            "nSolution": "11CraI4nyU6Bu3Xi7z0oDYtc1W7bj_W_y"
          },
          {
            "id": "47045ab9-5305-4c10-b875-fb03ff582813",
            "name": "Spring End Sem",
            "year": "2023",
            "type": "END SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1zBzZxbIvNak66hddw5R-5cy6gBBFTw9S",
            "solution": null,
            "nQuestion": "1ixMrxHw24PZiyNWwal652aCfGXiRs3F5",
            "nSolution": null
          },
          {
            "id": "d2cf5094-0bf6-4130-a6a3-9c9182d55ff2",
            "name": "Spring Mid Sem",
            "year": "2023",
            "type": "MID SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1TBVqsdNT_a0jO0SotyjJtvkWEMeP9U9f",
            "solution": null,
            "nQuestion": "1Dv-BrybpN3-YpZFAq11_tsZ5KXS7LJav",
            "nSolution": null
          },
          {
            "id": "af4a2caa-2375-46c2-bcf1-632d13781e30",
            "name": "Spring Mid Sem",
            "year": "2020",
            "type": "MID SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1YQfAfY90dxT4NS1pIvlGR77znxD_Jece",
            "solution": null,
            "nQuestion": "1Tqv9V_dSc7dlAgytSF8vdPW8ngvnEbVu",
            "nSolution": null
          },
          {
            "id": "473bc414-a141-4b78-b0a7-136bd710c0d6",
            "name": "End Sem",
            "year": "2012",
            "type": "END SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "10ZvdfYUy5OCtfkt__JBhyKb3VlRcYKnB",
            "solution": null,
            "nQuestion": "1SRDVlaCrS-i7fkop60oJNHwKkPnhP3X3",
            "nSolution": null
          },
          {
            "id": "766f7415-2627-4957-9828-ab8eac94bb36",
            "name": "Autumn End Sem",
            "year": "2023",
            "type": "END SEMESTER",
            "status": "APPROVED",
            "solutionUploadedBy": "661aaa2fa909c6db59a42034",
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1UZFt6ZqJtxaY3cK_VGw5lnM7DhUTNYpY",
            "solution": "1vltrKOvzDh5x3pQUDqNzIhkjYAWW2BDM",
            "nQuestion": "1v9sAYz7_HadeQFsj_iKxy_bLwddSfFDo",
            "nSolution": "1haPSRUNKJiVdBYXzSy3phH3rLpgR9JoI"
          },
          {
            "id": "8ca02aa1-ee73-4c9a-8033-eca0f6bf982c",
            "name": "Autumn Mid Sem",
            "year": "2022",
            "type": "MID SEMESTER",
            "status": "APPROVED",
            "solutionUploadedBy": "66bdb30a42841c454a166de7",
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1Q-hSb5VJWvyMDB3UhS5a_g2L-JpD4HPM",
            "solution": "1aA7EqxXuu36KyciL22eXLbK05Tk6GklW",
            "nQuestion": "14IP1qnkwpMlaE0hegRaSt25DCrfietK6",
            "nSolution": "1SpUaqgPGyUZm4aXpwDJZ-F3x5KXHCvsF"
          },
          {
            "id": "04b3688f-aa25-4654-bb26-0b0058c869a3",
            "name": "Autumn End Sem",
            "year": "2014",
            "type": "END SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1ptaaSzTZAPZoNLQEE_NfgU-M2Tgj_hkx",
            "solution": null,
            "nQuestion": "1kkTjPV-lXZqgocZg6h5aQSTT9F51hGUq",
            "nSolution": null
          },
          {
            "id": "42a9dcbf-78ca-4899-84a8-ceb7a68709fc",
            "name": "Supplementary",
            "year": "2024",
            "type": "END SEMESTER",
            "status": "APPROVED",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1I7_r6B74z2RPhlBQOXM9PFz_DKL2QCYr",
            "solution": "1-9DkVj2-_EBer8eMUutd-Ck6ubvursbN",
            "nQuestion": "1UHPY7V-K8Lszl7NORw2NPo0FRtR18Nva",
            "nSolution": "1wiI3IZsp0ksBIrojgU3IhZsH9AA72jlo"
          },
          {
            "id": "a59c0aad-e7bc-4621-b3cf-231ebe2ff11f",
            "name": "Autumn Mid Sem",
            "year": "2024",
            "type": "MID SEMESTER",
            "status": "APPROVED",
            "solutionUploadedBy": "6721b2265a965de869c4337b",
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1IrGSPMWu_OlwUiNJ4k0xRxx1sNElhpHy",
            "solution": "1lBiOwRHDuwyAqtkr9rUyKsjD9p2Yc5P1",
            "nQuestion": "1_E8f1wbkjIOmxe-Y11hXm_JNQOw0QjLN",
            "nSolution": "1PysjdKSABHFz83ImAWeyhEpySVzryNJd"
          }
        ]
      },

      {
        "id": "65d213b11bdc9aab413387f7",
        "name": "ENGLISH",
        "SUBCODE": "HS10001",
        "Credit": "2",
        "folderId": "160pnTWAGgB2IOPSTl_17I4ofjY257obo",
        "pyqs": [
          {
            "id": "cebd515c-6cb4-48f1-9fe8-c667f607f593",
            "name": "Mid Sem Exam",
            "year": "2015",
            "type": "MID SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1e2Cdq8y2TzDEbO3JF_TCu8_ZyZBLLFww",
            "solution": null,
            "nQuestion": "1NyAR8NvJhhyeA46Hmew9C6PFCy8JTFNY",
            "nSolution": null
          },
          {
            "id": "1123346d-b133-48c8-8b90-dd98d335728d",
            "name": "Mid Sem Exam",
            "year": "2014",
            "type": "MID SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1rslUTzDqQeabHGQzw5cEII11ey8JQ48h",
            "solution": null,
            "nQuestion": "1ZoOp4cFAoGWp1RplTLZk4oZ8yDlKKPZV",
            "nSolution": null
          },
          {
            "id": "7e0382a7-e162-4e5b-acc3-544588d4ee90",
            "name": "Spring End Sem Exam",
            "year": "2016",
            "type": "End Semester",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1p841V67HwaG3u3SXGk5DPghmFpB4M221",
            "solution": null,
            "nQuestion": "1p841V67HwaG3u3SXGk5DPghmFpB4M221",
            "nSolution": null
          },
          {
            "id": "3621220e-dfa7-4299-8474-69f5063e56aa",
            "name": "Autumn End Sem Exam",
            "year": "2015",
            "type": "END SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "12pgN20nbH-faE_9ICKFMGbw181wt67d9",
            "solution": null,
            "nQuestion": "12WYL75ldu0APmjyZTE1cGAWcHH4iUZIt",
            "nSolution": null
          },
          {
            "id": "4140aee8-3751-4450-a192-8cdeb4c9e071",
            "name": "Spring End Sem Exam",
            "year": "2014",
            "type": "END SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1jwb-5BB9EW2CQYILAtGmSWpBu0mLbUAq",
            "solution": null,
            "nQuestion": "1ckcGCb3Ecm3VuBnEHYQi9WaGJfdMWPCM",
            "nSolution": null
          },
          {
            "id": "b408254b-ed0b-4f94-9704-0ef1593f2468",
            "name": "Autumn End Sem Exam",
            "year": "2014",
            "type": "END SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1xAHtTA7O1hIEqxvwLQxy2XiyBRrCJ_Ib",
            "solution": null,
            "nQuestion": "1uVyLce-9XxWbxsafzE_Tyc_w_1_W_7b_",
            "nSolution": null
          },
          {
            "id": "2f3d87c1-91c2-418f-8619-86417ad56bdc",
            "name": "Spring End Sem Exam",
            "year": "2013",
            "type": "END SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1xF1n5i052N2yuM2oPtgQXVcjY-GmzyYR",
            "solution": null,
            "nQuestion": "1ukSAf8gFib69V9qkuAHZ9tA34DSWItfY",
            "nSolution": null
          },
          {
            "id": "fe0589b8-2eca-490a-8edd-87e025de8fed",
            "name": "Mid Sem",
            "year": "2017",
            "type": "MID SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1alSypaO2tpeWj_qXPO3xWScx5hkJmHeD",
            "solution": null,
            "nQuestion": "1fXBXlgS59qCCmcxJJq7I3AKT2sMAL-nN",
            "nSolution": null
          },
          {
            "id": "51e99d8a-fe60-4f26-a6cd-697d621497a7",
            "name": "Spring End Sem",
            "year": "2015",
            "type": "END SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1ILrO3OpZGeDZQ6rO88Yp5zxpKqc6NjOe",
            "solution": null,
            "nQuestion": "10_21wiN4KPVT1KECLL3o6bgo4IvcuuWt",
            "nSolution": null
          },
          {
            "id": "71c384d5-fda7-48bf-9e46-d2a174c30200",
            "name": "Spring End Sem",
            "year": "2017",
            "type": "END SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1-7rYTFTJ0ta0lwerMgCAzgm_QdT7Kl3r",
            "solution": null,
            "nQuestion": "1uPCBgTVOPxc8zWk6fewBUnlUdmXPCD66",
            "nSolution": null
          },
          {
            "id": "9aa34734-b3fb-4363-9187-360059bc74e0",
            "name": "Autumn End Sem",
            "year": "2016",
            "type": "END SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1pFvR6aJYbhCrFwk1QV95W5jZrleEBKCr",
            "solution": null,
            "nQuestion": "14Wd3gp3SM3siz24UrHetnjTCsl2kFL5C",
            "nSolution": null
          },
          {
            "id": "78e436b3-962c-4fee-b597-44e18c118cb1",
            "name": "Mid Sem",
            "year": "2014",
            "type": "MID SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1dx7gL8el8fTdJu3tazJB7lUOBNlopnI5",
            "solution": null,
            "nQuestion": "1AIcGP9U1P92dtcIdSbOqep7E6FecijYz",
            "nSolution": null
          },
          {
            "id": "698cdbb0-5d10-4246-a58c-c576808f3d0d",
            "name": "Spring Mid Sem",
            "year": "2017",
            "type": "MID SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1AbMV6DG5KfDkILmY6EZm7fegNENAGt69",
            "solution": null,
            "nQuestion": "1HkRXEnctI3j3VHpNrGhY3mDnuGGqUjED",
            "nSolution": null
          },
          {
            "id": "e78a6e08-01bd-42e7-8d94-7287965e6002",
            "name": "Autumn End Sem",
            "year": "2013",
            "type": "END SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1WY9ePx7X2mRQIJXXG8I36pX2tvkgQYal",
            "solution": null,
            "nQuestion": "1sRgNrKxBVK3Ep__HQlcoeXohI779rBXO",
            "nSolution": null
          },
          {
            "id": "08fa7ad8-519c-414a-9126-993bd76af8c0",
            "name": "Autumn End Sem",
            "year": "2022",
            "type": "END SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1-54kjpwOaBiRkEdID5x8LukSy0bHwTNg",
            "solution": null,
            "nQuestion": "1973HyPpiueqTxff2Ycii7WS3J88PsYRY",
            "nSolution": null
          },
          {
            "id": "64917c3e-fcc3-4d7f-ad39-47b610518d9c",
            "name": "Autumn End Sem",
            "year": "2020",
            "type": "END SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1VrOR9_6OGh3u_9GoRVoH_MzpAwpfKvHV",
            "solution": null,
            "nQuestion": "1BzQl7gV9Jprbw5J6VZI-1onA4MeZOvIO",
            "nSolution": null
          },
          {
            "id": "f7e6b06c-f671-487b-8326-079befc6a1e0",
            "name": "Autumn End Sem",
            "year": "2021",
            "type": "END SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1YVG5sZSQLbJ-Z28JfGDN7LEy99HJea98",
            "solution": null,
            "nQuestion": "1PUheZvTcntzjuCJWWDAvS8kCNQgXcByo",
            "nSolution": null
          },
          {
            "id": "b3fdf434-706e-421a-82c7-524f780697a6",
            "name": "Mid Sem",
            "year": "2016",
            "type": "MID SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1OwMDJZ948AxipIVp1qhTxQjj-t9sS0G2",
            "solution": null,
            "nQuestion": "1EY6WixWBxqX6hsJ5yHVX_v80vBCSTwsS",
            "nSolution": null
          },
          {
            "id": "26622c1c-2ce5-402e-97e6-ec24a1e534cd",
            "name": "Autumn Mid Sem",
            "year": "2019",
            "type": "MID SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1PNaST47a_mqUzCt5NAZ6He4UM62d5FNF",
            "solution": null,
            "nQuestion": "1n5CCi3SPRqeYEZM3j6zMYQlxrVe3J9q7",
            "nSolution": null
          },
          {
            "id": "3d2a7723-2298-40df-8026-96f132903834",
            "name": "Spring End Sem",
            "year": "2021",
            "type": "END SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1HgZxElGqK5zIHxYLBnEbN4OzlIJG86vQ",
            "solution": null,
            "nQuestion": "1A0o6xF7l1rb1pw81FH2nXgmfxjdkYuJT",
            "nSolution": null
          },
          {
            "id": "93f6bb7a-98e7-410c-b9a6-ce87784bb225",
            "name": "Autumn End Sem",
            "year": "2017",
            "type": "END SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1M5VtdftEzo4B3Zn8U1c-nmLWHZShBU4I",
            "solution": null,
            "nQuestion": "1dqOUUGzRlKiT_pD9iLiZpA32ULmRqMDC",
            "nSolution": null
          },
          {
            "id": "7030fcc4-1599-443b-8c33-2e04047faadd",
            "name": "Spring End Sem",
            "year": "2018",
            "type": "END SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1g1NLowPFxQe0bd7AJyf6mqr7qwxgtTrW",
            "solution": null,
            "nQuestion": "1wXbirICmStVlYhMb4LH7avBpcY_GoAid",
            "nSolution": null
          },
          {
            "id": "f2a3cb56-4ad0-40e2-b9cb-3fd4a41db745",
            "name": "Spring Mid Sem",
            "year": "2018",
            "type": "MID SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1EsUOxn6S9A8vtThGDQnQPbuAJNv7FP5n",
            "solution": null,
            "nQuestion": "1XIOBgX5UGRJyYYtg7j09xnaHqbjpnKHh",
            "nSolution": null
          },
          {
            "id": "a3149178-48e1-45a0-8f12-c98ecb4bcb85",
            "name": "Autumn End Sem",
            "year": "2019",
            "type": "END SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1RCq76Sb_7wispbHtglnhd-QWUREbRaJm",
            "solution": null,
            "nQuestion": "1gcTLjmyPsXSDsv9YwVFQz_6nks9ouss0",
            "nSolution": null
          },
          {
            "id": "2cb8d573-e3fe-4db0-b52a-83964ba626b6",
            "name": "Autumn End Sem",
            "year": "2018",
            "type": "END SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1xgyRbfLDo-8mW9BZCsN51j0U-MQdxdyh",
            "solution": null,
            "nQuestion": "1uoE5pel4xlPHHvFFiRpbBKre9zVrLZkl",
            "nSolution": null
          },
          {
            "id": "202cf96a-cdc8-4b8a-a258-16ff8fefbd7e",
            "name": "Autumn Mid Sem",
            "year": "2018",
            "type": "MID SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "19AEgCH5U5eQW_m2VKyABGn8Hch8qkp2C",
            "solution": null,
            "nQuestion": "10TBziKqvnfxG6xA1k-lK3nZMVjzQTHKS",
            "nSolution": null
          },
          {
            "id": "9bf2d59c-e361-4774-afd8-cc409df75025",
            "name": "Spring End Sem",
            "year": "2019",
            "type": "END SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1UhREEh2ytvH79nfFNtsSYPudX-qC26Cn",
            "solution": null,
            "nQuestion": "1iF3Ng5eoMmf8lLxvStA9dpsizkhGSOmF",
            "nSolution": null
          },
          {
            "id": "b1ca789e-9840-426d-ae14-b4270d2f298d",
            "name": "Spring Mid Sem",
            "year": "2019",
            "type": "MID SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1--uAqSayyD9FZHqrhfBQVCk0cEEEvwcq",
            "solution": null,
            "nQuestion": "1EWKyLwfCzCW8zrKtnD6NscU0tOhurarb",
            "nSolution": null
          },
          {
            "id": "437c1577-fd17-407e-ac3f-36c10882fed3",
            "name": "Spring End Sem",
            "year": "2014",
            "type": "END SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1p37Dn2k0hLzJ9rdAfUkBpetGgGnnxbiY",
            "solution": null,
            "nQuestion": "1lUBWHpwXgomtLiTFPjdvJfBNujALlB0p",
            "nSolution": null
          },
          {
            "id": "29fa29f4-b7d8-43e8-bee0-fe431d614e8e",
            "name": "Spring End Sem-2",
            "year": "2014",
            "type": "END SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "12h87ea1xz48g3UsKE4TEBB4UvLjacyuk",
            "solution": null,
            "nQuestion": "14Nz_KUJS8Sk42qFxkhWUrppDmNqdgozg",
            "nSolution": null
          },
          {
            "id": "f18ed2ff-9981-4fb2-970e-90d57cc4658a",
            "name": "Autumn End Sem-2",
            "year": "2014",
            "type": "END SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1yAfQniOrVxhGVw_NfPFUkCN9jAp_J3cZ",
            "solution": null,
            "nQuestion": "1px951OfscwSqmuPU-SQsCYHGsEH0PbPU",
            "nSolution": null
          },
          {
            "id": "fec38bdc-2949-4f53-80e5-25732128c61e",
            "name": "Autumn End Sem-3",
            "year": "2014",
            "type": "END SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1iMmzqizrlvlefj9YZAdXSXR6g8K0TNxc",
            "solution": null,
            "nQuestion": "19vQWor1b3FPUshuL70RyTgXXavZckKe8",
            "nSolution": null
          },
          {
            "id": "dcfb00c9-e0ee-430a-bc67-43af70adc0ea",
            "name": "Redmid",
            "year": "2017",
            "type": "MID SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1HbpaN40ZND40VN_XhLFWCtSI8kMTngjO",
            "solution": null,
            "nQuestion": "1Rplo-DKwuB16UIud2o8ba9ICO4G5UIti",
            "nSolution": null
          },
          {
            "id": "b9c49b05-3b14-4630-8397-99560cd248b5",
            "name": "Spring End Sem-3",
            "year": "2015",
            "type": "END SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1kJWZupJ2LvH-hnaoXZDFcpUQ6Vp8j8Wn",
            "solution": null,
            "nQuestion": "1YIb1TJ4I-A4CdjIv1MfmsT07C25AUdSi",
            "nSolution": null
          },
          {
            "id": "11600c15-744d-4927-b8af-6a6ed3a731f2",
            "name": "Autumn End Sem",
            "year": "2023",
            "type": "END SEMESTER",
            "status": "APPROVED",
            "solutionUploadedBy": "66f2dd2ef740b2b3e5002db0",
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1hHXMZCk4HCYvrGVdbSUeiEhQGdsL3tZt",
            "solution": "1HqsjZkhu4Ntrek-2zwcVE-krlLl54AYU",
            "nQuestion": "1SSl_g3rkgqsknq6Tci_5MI-uRyY9xZLP",
            "nSolution": "1xm1SIX3ivJhJ4yip5RS0m736Ze4R9Pbt"
          },
          {
            "id": "e2a639d9-7284-4adf-9087-82a82d1f59cd",
            "name": "Spring End Sem",
            "year": "2023",
            "type": "END SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1RdCS1EhjPx1l88qAWtVcalHBcoBKJkpm",
            "solution": null,
            "nQuestion": "1oMBMtaXFN_iRy-EtdVMN_tfK58-Fxy3y",
            "nSolution": null
          },
          {
            "id": "7905915c-f6cb-483b-89bc-657b2ad42b33",
            "name": "Spring End Sem",
            "year": "2024",
            "type": "END SEMESTER",
            "status": "REVIEW",
            "solutionUploadedBy": "676c3f38afff4821c3ae221d",
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1_NGz_4cYdUoQy5y2r-AQAjP7YNzCQQKN",
            "solution": null,
            "nQuestion": "1HAHVwhnegAAHJjCBZrzWgE4XwrW5y8e8",
            "nSolution": null
          },
          {
            "id": "5439746f-ace9-4141-b603-a6f4e39b9880",
            "name": "Spring Mid Sem",
            "year": "2024",
            "type": "MID SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1slkXeiFXSfQOSzOqpxblhYuAAiS345La",
            "solution": null,
            "nQuestion": "1pl1mi51mAVYp-WWUhidwQhAcJYGufxgM",
            "nSolution": null
          }
        ]
      }, {
        "id": "65d2d560883f3cc806388709",
        "name": "Artificial Intelligence",
        "SUBCODE": null,
        "Credit": null,
        "folderId": "1N4NfPNlHGIiNtuoMoI8BKhJjf8ftHzaA",
        "pyqs": [
          {
            "id": "343874fe-bc2a-484f-bd54-2d5ecb01a581",
            "name": "Question Bank",
            "year": "2022",
            "type": "Question Bank",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1Lo3UW5ID3_YANd_zgzjFDFfBUWu-s52c",
            "solution": null,
            "nQuestion": "1Lo3UW5ID3_YANd_zgzjFDFfBUWu-s52c",
            "nSolution": null
          },
          {
            "id": "aa96a1a9-af11-4b0a-a8a6-0b727228ad83",
            "name": "Question Bank",
            "year": "-",
            "type": "Question Bank",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1MMKJOFeBj0KReq4HwDs_OpO2do-CZeQZ",
            "solution": null,
            "nQuestion": "1MMKJOFeBj0KReq4HwDs_OpO2do-CZeQZ",
            "nSolution": null
          },
          {
            "id": "049dc852-7a27-4c5c-84df-1ca23e4ada71",
            "name": "Autumn Mid Sem Exam",
            "year": "2022",
            "type": "MID SEMESTER",
            "status": "APPROVED",
            "solutionUploadedBy": "67425caf5a965de869c43705",
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1g4EP4J7WTaS6LvkJbJva3nupGRM5_R6E",
            "solution": "12gRxj2ioqT0s5fX3QsPVYTgqvw17hl3D",
            "nQuestion": "1UCEmBAar5ITj119hhe3Tz5D2ftNqtDsY",
            "nSolution": "1_gL8VjmKnlT1lMaAos3sywo_QEldSEAt"
          },
          {
            "id": "51a9e1de-bc2b-4720-b07c-b38efdd97b28",
            "name": "Autumn End Sem Exam",
            "year": "2022",
            "type": "END SEMESTER",
            "status": "VERIFIED",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1IUhvHM9UlCUXhMAYa41c-lLue78m8C2c",
            "solution": "1wk6MnQou6uonQ9PbLfxEnKyDVJr5HAjW",
            "nQuestion": "1bbtRRS2aftLnuFVhBm-EqcPD8KAr9TW3",
            "nSolution": "1wk6MnQou6uonQ9PbLfxEnKyDVJr5HAjW"
          },
          {
            "id": "2192405c-4811-40e6-8e33-4aea2a2488c9",
            "name": "Autumn Mid Sem",
            "year": "2023",
            "type": "MID SEMESTER",
            "status": "APPROVED",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1u0JUAdkTJ7x91dw0Opm2-Zdw1rVetumU",
            "solution": "1Ovyi-pAF4Fof1gXcfN4I4EH3e0hocsxd",
            "nQuestion": "1wW-68sb6ROxSnlRqVpMtA8K6jgIK8fMA",
            "nSolution": "1_Vqc7yy177XRmkjDtz4Hicrvx_W36Pd-"
          },
          {
            "id": "bf7888e6-115f-48c8-9f5f-c7165fb07c9b",
            "name": "Autumn End Sem",
            "year": "2023",
            "type": "END SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1B2Pk725mWEsGml6eeZ5hAI_fO6vNwCBy",
            "solution": null,
            "nQuestion": "1BxiAp6E1cvgqf1ixI9-LDlKLSq6asScE",
            "nSolution": null
          },
          {
            "id": "cea0c007-0dd4-426d-a7ff-27d4a782200b",
            "name": "Spring End Sem",
            "year": "2022",
            "type": "END SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1pr_hG2zul8JffGCNEmeiJaIHcpl6R-s0",
            "solution": null,
            "nQuestion": "1wDZ0w6glFfaY2p7AqegqOl5OMJsCd-yk",
            "nSolution": null
          },
          {
            "id": "237a63bb-b633-45fd-9cd5-e4137a048231",
            "name": "Spring End Sem",
            "year": "2023",
            "type": "END SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1WBGBXxxNcEwWedA0bLgfgCsftRXueVIx",
            "solution": null,
            "nQuestion": "1LqZRfjrHbxDMPhloPTHyN_-z_PboNtA6",
            "nSolution": null
          },
          {
            "id": "7791a080-52dc-44f6-82ae-39ae636e072b",
            "name": "Autumn Mid Sem",
            "year": "2023",
            "type": "MID SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1NMPiTSVvzp9_5N7kc3w-AeMTv7eLWVkH",
            "solution": null,
            "nQuestion": "1vKx4cID5TfWH0PHOUnGt_f4Wm6xA9L_r",
            "nSolution": null
          },
          {
            "id": "e6181b01-5fd8-4764-97c4-c31dcb39ca21",
            "name": "Autumn End Sem",
            "year": "2019",
            "type": "END SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1I2I__kl_PJfhKqBy71GAVmZHkP2JrNYD",
            "solution": null,
            "nQuestion": "1X5lKQAeZ5NcWOHgc0S3qPt3l3xit8jkG",
            "nSolution": null
          },
          {
            "id": "c8b897fa-f7de-4b00-a2b3-de87761ef4f0",
            "name": "Autumn End Sem-2",
            "year": "2019",
            "type": "END SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1veXldnvFTa-BLLqM0Eihm4YtZz6d5hmU",
            "solution": null,
            "nQuestion": "1Rrq4aqKIKXcWAmPFXhoP9PcFW9nVbsY2",
            "nSolution": null
          },
          {
            "id": "c2959e9e-6e54-4fe4-810e-70f08086e0ec",
            "name": "Autumn Mid Sem",
            "year": "2019",
            "type": "MID SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1saVljWwsL_kPr-s6YYNg9PdJ7m2mkOLW",
            "solution": null,
            "nQuestion": "1P5bArtAE0A1XEJstQv7VDOayehzVG0Le",
            "nSolution": null
          },
          {
            "id": "252a5156-9447-4f74-84c3-aad1084d4080",
            "name": "Autumn Mid Sem",
            "year": "2019",
            "type": "MID SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1W8tPQIPne3jceeTWeDVCNv90tuKoEMMH",
            "solution": null,
            "nQuestion": "1aCLmRydS-JHixA35Gjgrr3ZsEDRmO9VH",
            "nSolution": null
          },
          {
            "id": "c5bea2c8-e454-4de5-9d68-9f94b2063146",
            "name": "Autumn End Sem",
            "year": "2016",
            "type": "END SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1SCVyl7zIEwRuuIv2OMmMqiLNlBJP9Xbw",
            "solution": null,
            "nQuestion": "1M0V8OeFzYuAYDhaJ5MMpWy19-DFnkGB3",
            "nSolution": null
          },
          {
            "id": "b5c2afd8-3b6f-46f5-8faa-9bd53480c1f1",
            "name": "Autumn End Sem",
            "year": "2018",
            "type": "END SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1-yRYpKMu5DEHlgfRw-_HYCFz9yF9dCwx",
            "solution": null,
            "nQuestion": "15rQUhKg8ZuLqfTFqyRIfWqs1m8r15qRQ",
            "nSolution": null
          },
          {
            "id": "c750519e-4322-404d-8497-31c96eae80ea",
            "name": "Mid Sem",
            "year": "2016",
            "type": "MID SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "11oSwb3FRS0WI4MJxlsJJPOUA3Bl8a3Ye",
            "solution": null,
            "nQuestion": "1oK4XqGdvFMPUkUzH58dKO1Nlyo9F7smx",
            "nSolution": null
          },
          {
            "id": "15db7bbe-d6ab-47b1-99d8-f7ef1cea8a86",
            "name": "Mid Sem",
            "year": "2017",
            "type": "MID SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1jnMJlNuh2w0te6hdlOrR2ZHag8QaKxb9",
            "solution": null,
            "nQuestion": "1jmQtRc3D_Hs41z_9OEwg_BMO4_AR23OH",
            "nSolution": null
          },
          {
            "id": "fc72073e-b20e-4fef-8b7d-e2cc3203417e",
            "name": "Autumn End Sem",
            "year": "2017",
            "type": "END SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "12I7d-QkxKpD0Abh126j3sFiRSvH8Uhil",
            "solution": null,
            "nQuestion": "1qop2nF-xoWPvsHOD2wWfmqpul7m6uoqz",
            "nSolution": null
          },
          {
            "id": "826f7a42-ed9e-428e-9f44-7a19b647d5b4",
            "name": "Autumn End Sem",
            "year": "2013",
            "type": "END SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1sPitFlI1gthiSoBdqMr9-JXfHo1yvuo3",
            "solution": null,
            "nQuestion": "1kaUZQY6IqTkfbgboHISYZQof84DxwTRJ",
            "nSolution": null
          },
          {
            "id": "108c5ef8-c8d2-44d6-9420-cd58bd5fdee0",
            "name": "Autumn End Sem",
            "year": "2014",
            "type": "END SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1quPWNT_wdDMe7gXgYQXEGKxWPAhpSZQj",
            "solution": null,
            "nQuestion": "11DBxevG9bhH6KDx2lYw_A17Enf6ZiQuK",
            "nSolution": null
          },
          {
            "id": "5bc58221-1e33-4b06-9f38-046c38df6180",
            "name": "Autumn End Sem",
            "year": "2015",
            "type": "END SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1ZmKGqh4AkIAL7_F4gMIHf83JzIXdryGL",
            "solution": null,
            "nQuestion": "12e95CxRZmYzi2lOjgD1sRNZW78JlO6z9",
            "nSolution": null
          },
          {
            "id": "0503d24e-11bf-4a8e-922c-40a8eb85002d",
            "name": "Spring End Sem",
            "year": "2021",
            "type": "END SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1ubFInomCTs1dY_cN0Ar1AP2yGI6giHK5",
            "solution": null,
            "nQuestion": "1ywAej1U_1pv_l8TBDLDqEmQyBvdlKdl5",
            "nSolution": null
          },
          {
            "id": "8f9cfe0b-51f6-4ef8-9e62-936e5d4842b6",
            "name": "Autumn End Sem",
            "year": "2021",
            "type": "END SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1gsbOhDfl3_6J0hrAtmq8-y2ytuea12_T",
            "solution": null,
            "nQuestion": "1luDFGG7QD1GPZIUOfofAstRf3W02KCHO",
            "nSolution": null
          },
          {
            "id": "2a768b80-0478-47d5-a0f3-dc9f0c68bf88",
            "name": "Spring End Sem",
            "year": "2024",
            "type": "END SEMESTER",
            "status": "APPROVED",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1Lu_SgChKBZZmvQ-j6StQZ7MsWskeNhCV",
            "solution": null,
            "nQuestion": "1CcBhpsTVdz_yHROwtujXibXPhLiYztpn",
            "nSolution": "15zSDrG-TKf3dNSuXNTlvsp8sbPImhSES"
          },
          {
            "id": "f62990b6-fb6b-43b9-9d18-b2c7fa9a5d88",
            "name": "Autumn Mid Sem",
            "year": "2024",
            "type": "MID SEMESTER",
            "status": "NO-SOLUTION",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1lJ_yH7ubFpna503wUld9hFYtLMak6ApK",
            "solution": null,
            "nQuestion": "1SWzx71SGuEbY6xtAh0djdkLz9HdrOKFh",
            "nSolution": null
          },
          {
            "id": "97cfbbcc-e095-46ca-85f3-a3a03c2ed4e3",
            "name": "Spring Mid Sem",
            "year": "2025",
            "type": "MID SEMESTER",
            "status": "APPROVED",
            "solutionUploadedBy": null,
            "QuestionUploadedBy": null,
            "mimeType": "application/pdf",
            "Question": "1fOurXOZlJy69YXEFHo-jA-cw49Um8prq",
            "solution": null,
            "nQuestion": null,
            "nSolution": "1VfqX7pAfA2KIXaSBcL9N904rlUxzV1m9"
          }
        ]
      }



    ]
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
      const user = await this.prisma.securityViolated.findMany({})
      return user;

    } catch (error) {
      console.error("Error fetching  security violated data: ", error);
      throw new InternalServerErrorException("Error getting security violated data");
    }
  }

}
