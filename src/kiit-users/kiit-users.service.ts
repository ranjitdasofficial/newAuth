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
//
// const secure = "Ranjit";

@Injectable()
export class KiitUsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly mailService: MyMailService,
    @Inject(CACHE_MANAGER) private readonly cacheService: Cache,
    private readonly jwtService: JwtService,
  ) {}

  private tokens = {};

  exceptionUser = ["test@kiitconnect.com","test.premium@kiitconnect.com","21053420@kiit.ac.in"]

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
        include:{
          PremiumMember:{
            select:{
              isActive:true,
            }
          },
        }
      });
      console.log(user);

      if (!user) throw new NotFoundException('User not found');

    

      if (!user.isPremium) {
        const p = user.PremiumMember;    
        return {
          user: {...user, isActive:p?p.isActive:true},
        };
      }

      const getEmailSession: string = await this.cacheService.get(email);
      console.log(getEmailSession);
      let getSessionData = [];

      if ( !this.exceptionUser.includes(email) && getEmailSession) {
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
        user: {...user, isActive:true},
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

  async activatePremiumUser(userId: string) {
    try {
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
        where:{
          user:{
            isPremium:false
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

  private async streamToBuffer(stream: Readable): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      stream.on('data', (chunk) => chunks.push(chunk));
      stream.on('error', reject);
      stream.on('end', () => resolve(Buffer.concat(chunks)));
    });
  }

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

     return users.map((u)=>{
        return {
          name:u.user.name,
          email:u.user.email,
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
    const users =[]
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




const users24=[  
 
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

const users000=[  

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


const users =[

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

const users12 =[


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

  async resetLoginAdmin(email:string) {
    try {

      const checkUser = await this.prisma.user.findUnique({
        where:{
          email:email
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
    } catch (error) {}
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
    } catch (error) {}
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
     

      const user =  await this.prisma.user.findMany({
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



  async getUserStatus(userId:string){
    try {
      const user = await this.prisma.premiumMember.findUnique({
        where: {
          userId: userId,
        },
        include:{
          user:{
            select:{
            allowedProfileUpdate:true,
            }
          }
        }
      });
      
      return {
        year:user.year,
        allowedToUpdate:user.user.allowedProfileUpdate
      };
    } catch (error) {
      console.log(error);
      throw new Error('Error in fetching user');
    }
  
  
  }

  async updateUserStatus(dto:{
    userId:string,
    year:string,
  }){
    try {

      const trans = await this.prisma.$transaction([
         this.prisma.premiumMember.update({
          where: {
            userId: dto.userId,
          },
          data:{
            year:dto.year
          }
        }),
  
         this.prisma.user.update({
          where:{
            id:dto.userId
          },
          data:{
            allowedProfileUpdate:false
          }
        })

      ]);
  
    
      return true;
    } catch (error) {
      console.log(error);
      throw new Error('Error in updating user');
    }
  }


  async deactivateUser(userId:string){
    try {
      const user = await this.prisma.premiumMember.update({
        where: {
          userId: userId,
        },
        data:{
          isActive:false
        },
        include:{
          user:true
        }
      });

      this.mailService.sendMailToDeactivateAccount(user.user.email,user.user.name);
      return true;
    } catch (error) {

      console.log(error);
      throw new Error('Error in deactivating user');
      
    }
  }

  async activateAll(){
    try {
      await this.prisma.premiumMember.updateMany({
        where:{
          isActive:false,
        },
        data:{
          isActive:true
        }
      })
      return true;
    } catch (error) {
      console.log(error);
      throw new Error('Error in activating users');
      
    }
  }


  async enableDisabledUser(){
    try {
     const p= await this.prisma.premiumMember.updateMany({
        where:{
          isActive:false,
        },
        // select:{
        //   user:{
        //     select:{
        //       email:true,
        //       name:true
        //     }
        //   }
        // }
        data:{
          isActive:true
        }
      })

      return p;
      // return p.map((p)=>p.user.email);
    } catch (error) {
      console.log(error);
      throw new Error('Error in activating users');
      
    }
  }


  async changeYear(dto:{
    userId:string,
    year:string,
  }){
    try {
      const user = await this.prisma.premiumMember.update({
        where: {
          userId: dto.userId,
        },
        data:{
          year:dto.year
        }
      });
      return true;
    } catch (error) {
      console.log(error);
      throw new Error('Error in changing year');
    }
  }


  async getNonPremiumUser(roll:string)
  {
    try {
      const user = await this.prisma.user.findMany({
        where:{
          email:{
            startsWith:roll
          },
          isPremium:false
        }
      })
      return {
        length:user.length,
        user
      }
    } catch (error) {
      console.log(error);
      throw new Error('Error in fetching user');
    }
  }
    async getPremiumUser(roll:string)
  {
    try {
      const user = await this.prisma.user.findMany({
        where:{
          email:{
            startsWith:roll,
          },
          isPremium:true
        }
      })
      return {
        length:user.length,
        user
      };
    } catch (error) {
      console.log(error);
      throw new Error('Error in fetching user');
    }
  }



  async getPremiumUserByYear(year:string)
  {
    try {
      const user = await this.prisma.premiumMember.findMany({
        where:{
         user:{ 
          email:{
            startsWith:year,
          },
          // isPremium:true
          
         },

         paymentScreenshot: undefined,
          isActive: false,

        },
        select:{
          user:{
            select:{
              email:true,
              name:true
            },
          
          },
          branch:true,
          year:true,
          userId:true,
          whatsappNumber:true,
          paymentScreenshot:true,
        }
      })
      return {
        length:user.length,
        user
      };
    } catch (error) {
      console.log(error);
      throw new Error('Error in fetching user');
    }
  }
  

  async getPremiumUserByYearN(year:string){
    try {
      const user = await this.prisma.premiumMember.findMany({
        where:{
          user:{
            email:{
              startsWith:year
            }
          }
        },
        select:{
          user:{
            select:{
              id:true,
            }
          }
        }
      

      });
      return {
        length:user.length,
        user
      }
    } catch (error) {
      console.log(error);
      throw new Error('Error in fetching user');
      
    }
}

  async removePremiumMembersByBatch(batch: string,dateBefore:string) {
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
    } catch (error) {
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
    try
    {
     const user =  await this.prisma.user.findUnique({
        where:{
        email:email
        },
       
      });

      await this.prisma.premiumMember.update({
        where:{
          userId:user.id
        },
        data:{
          paymentScreenshot:null
        }
      })
      return true;

    }catch(error)
    {
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

  async generateSignedUrlForUploadImage(dto:{
    filename: string;
    fileType:string
  }){
    try {
      console.log(dto);
      
      const signedUrl = await this.storageService.getPresignedUrl(dto.filename,dto.fileType);
      console.log(signedUrl)
      return {
        signedUrl: signedUrl,
      };
    } catch (error) {
      console.error('Error generating signed url:', error);
      throw new InternalServerErrorException('Error generating signed url');
      
    }
  }



async saveScreenShotToDb(userId:string,fileId:string){

  try{

    console.log(userId,fileId);

    if(!userId || !fileId) throw new BadRequestException('Invalid request');
   
    const user = await this.prisma.premiumMember.update({
      where:{
        userId:userId
      },
      include:{
        user:true
      },
      data:{
        paymentScreenshot:fileId
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
    if(error instanceof NotFoundException || error instanceof BadRequestException){
      throw error;
    }
    throw new InternalServerErrorException('Error saving screenshot');
  
}
}
  

}
