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
      if (getEmailSession) {
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
              // name: true,
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

      return users.map((u)=>u.user.email);
    } catch (error) {
      console.log(error);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Internal Server Error');
    }
  }

  async sendRemainderMail() {
    const users = [];
    let isContinueLoop = true;
    try {
      for (let i = 0; i < users.length && isContinueLoop; i++) {
        if (!isContinueLoop) break;
        await this.mailService.sendPaymentReminder({
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
    const users = [
      '21053420',
      '21051086',
      '2205008',
      '2205013',
      '2205014',
      '2205016',
      '2205017',
      '2205018',
      '2205020',
      '2205023',
      '2205024',
      '2205025',
      '2205026',
      '2205027',
      '2205029',
      '2205031',
      '2205032',
      '2205035',
      '2205036',
      '2205037',
      '2205044',
      '2205051',
      '2205053',
      '2205054',
      '2205055',
      '2205059',
      '2205060',
      '2205062',
      '2205064',
      '2205067',
      '2205068',
      '2205069',
      '2205073',
      '2205074',
      '2205076',
      '2205078',
      '2205082',
      '2205084',
      '2205088',
      '2205089',
      '2205091',
      '2205095',
      '2205099',
      '2205100',
      '22051000',
      '22051001',
      '22051004',
      '22051005',
      '22051006',
      '22051009',
      '22051010',
      '22051011',
      '22051012',
      '22051013',
      '22051014',
      '22051015',
      '22051017',
      '22051019',
      '2205102',
      '22051020',
      '22051021',
      '22051022',
      '22051023',
      '22051024',
      '22051028',
      '22051030',
      '22051033',
      '22051034',
      '22051036',
      '22051037',
      '22051038',
      '22051039',
      '22051040',
      '22051042',
      '22051044',
      '22051045',
      '22051048',
      '22051050',
      '22051051',
      '22051054',
      '22051055',
      '22051056',
      '22051057',
      '22051058',
      '22051059',
      '2205106',
      '22051060',
      '22051061',
      '22051062',
      '22051063',
      '22051064',
      '22051066',
      '22051067',
      '22051070',
      '22051071',
      '22051074',
      '22051077',
      '22051078',
      '22051079',
      '22051080',
      '22051082',
      '22051083',
      '22051084',
      '22051086',
      '2205109',
      '22051091',
      '22051092',
      '22051095',
      '22051098',
      '22051100',
      '22051101',
      '22051103',
      '22051106',
      '22051107',
      '22051108',
      '22051109',
      '2205111',
      '22051110',
      '22051111',
      '22051113',
      '22051114',
      '22051115',
      '22051116',
      '22051118',
      '2205112',
      '22051121',
      '22051123',
      '22051127',
      '22051128',
      '2205113',
      '22051130',
      '22051131',
      '22051134',
      '22051138',
      '22051139',
      '2205114',
      '22051140',
      '22051141',
      '22051142',
      '22051143',
      '22051146',
      '22051148',
      '22051149',
      '2205115',
      '22051150',
      '22051152',
      '22051153',
      '22051154',
      '22051155',
      '22051157',
      '22051158',
      '22051159',
      '2205116',
      '22051161',
      '22051163',
      '22051164',
      '22051165',
      '22051168',
      '22051169',
      '2205117',
      '22051170',
      '22051172',
      '22051174',
      '22051175',
      '22051176',
      '22051177',
      '22051178',
      '22051179',
      '22051181',
      '22051182',
      '22051183',
      '22051184',
      '22051186',
      '22051187',
      '22051188',
      '2205119',
      '22051190',
      '22051192',
      '22051193',
      '22051194',
      '22051195',
      '22051196',
      '22051197',
      '22051198',
      '22051199',
      '22051200',
      '22051201',
      '22051203',
      '2205121',
      '22051210',
      '22051212',
      '22051215',
      '22051216',
      '22051217',
      '22051220',
      '22051225',
      '22051230',
      '22051231',
      '22051233',
      '22051235',
      '22051236',
      '22051238',
      '2205124',
      '22051241',
      '22051243',
      '22051246',
      '22051247',
      '22051249',
      '2205125',
      '22051250',
      '22051252',
      '22051253',
      '22051255',
      '22051256',
      '22051257',
      '22051258',
      '22051259',
      '2205126',
      '22051262',
      '22051263',
      '22051265',
      '22051266',
      '22051268',
      '22051269',
      '22051270',
      '22051272',
      '22051273',
      '22051274',
      '22051276',
      '22051279',
      '2205128',
      '22051280',
      '22051284',
      '22051285',
      '22051286',
      '22051287',
      '22051288',
      '22051289',
      '22051291',
      '22051292',
      '22051293',
      '22051294',
      '22051295',
      '22051296',
      '22051297',
      '22051298',
      '22051299',
      '22051300',
      '22051301',
      '22051302',
      '22051303',
      '22051304',
      '22051305',
      '22051306',
      '22051307',
      '22051308',
      '22051309',
      '22051310',
      '22051311',
      '22051313',
      '22051314',
      '22051315',
      '22051316',
      '22051317',
      '22051319',
      '2205132',
      '22051320',
      '22051322',
      '22051323',
      '22051324',
      '22051326',
      '22051327',
      '22051328',
      '22051330',
      '22051331',
      '22051332',
      '22051335',
      '22051337',
      '22051339',
      '22051340',
      '22051341',
      '22051342',
      '22051343',
      '22051346',
      '22051350',
      '22051351',
      '22051354',
      '22051356',
      '22051357',
      '22051358',
      '22051359',
      '22051364',
      '22051367',
      '22051368',
      '22051369',
      '22051370',
      '22051371',
      '22051372',
      '22051373',
      '22051374',
      '22051375',
      '22051378',
      '22051379',
      '2205138',
      '22051380',
      '22051383',
      '22051384',
      '22051385',
      '22051387',
      '2205139',
      '22051392',
      '22051394',
      '22051396',
      '22051397',
      '22051399',
      '22051400',
      '22051401',
      '22051402',
      '22051403',
      '22051404',
      '22051405',
      '22051406',
      '22051407',
      '22051409',
      '22051410',
      '22051414',
      '2205142',
      '22051420',
      '22051422',
      '22051428',
      '22051429',
      '2205143',
      '22051431',
      '22051437',
      '2205144',
      '22051441',
      '22051442',
      '22051443',
      '22051445',
      '22051446',
      '22051451',
      '22051453',
      '22051454',
      '22051455',
      '22051458',
      '22051459',
      '2205146',
      '22051462',
      '22051464',
      '22051465',
      '22051466',
      '22051473',
      '22051474',
      '22051475',
      '22051476',
      '22051477',
      '22051481',
      '22051484',
      '22051486',
      '22051487',
      '2205149',
      '22051493',
      '22051494',
      '22051496',
      '22051497',
      '22051498',
      '2205150',
      '22051501',
      '22051502',
      '22051505',
      '22051506',
      '22051507',
      '22051508',
      '2205151',
      '22051510',
      '22051511',
      '22051513',
      '22051514',
      '22051516',
      '22051518',
      '22051519',
      '2205152',
      '22051520',
      '22051521',
      '22051523',
      '22051524',
      '22051527',
      '22051531',
      '22051533',
      '22051535',
      '22051537',
      '22051538',
      '2205154',
      '22051540',
      '22051542',
      '22051545',
      '22051546',
      '22051548',
      '22051551',
      '22051552',
      '22051553',
      '22051555',
      '22051556',
      '22051560',
      '22051561',
      '22051563',
      '22051564',
      '22051565',
      '22051566',
      '22051567',
      '22051569',
      '2205157',
      '22051570',
      '22051571',
      '22051572',
      '22051573',
      '22051575',
      '22051576',
      '22051578',
      '22051579',
      '2205158',
      '22051580',
      '22051582',
      '22051583',
      '22051586',
      '22051587',
      '2205159',
      '22051590',
      '22051594',
      '22051595',
      '22051596',
      '22051598',
      '22051599',
      '2205160',
      '22051602',
      '22051603',
      '22051604',
      '22051605',
      '22051607',
      '22051609',
      '22051610',
      '22051611',
      '22051612',
      '22051613',
      '22051614',
      '22051616',
      '22051618',
      '22051619',
      '22051620',
      '22051622',
      '22051623',
      '22051625',
      '22051629',
      '2205163',
      '22051631',
      '22051632',
      '22051633',
      '22051634',
      '22051636',
      '22051640',
      '22051643',
      '22051646',
      '22051648',
      '22051649',
      '22051650',
      '22051652',
      '22051653',
      '22051654',
      '22051655',
      '22051656',
      '22051657',
      '22051662',
      '22051664',
      '22051666',
      '22051667',
      '22051668',
      '22051669',
      '2205167',
      '22051671',
      '22051675',
      '22051676',
      '22051677',
      '22051678',
      '22051679',
      '2205168',
      '22051680',
      '22051682',
      '22051684',
      '22051687',
      '22051688',
      '2205169',
      '22051691',
      '22051692',
      '22051696',
      '22051698',
      '2205170',
      '22051701',
      '22051704',
      '22051708',
      '22051711',
      '22051712',
      '22051713',
      '22051715',
      '2205172',
      '22051720',
      '22051721',
      '22051722',
      '22051723',
      '22051725',
      '22051726',
      '22051728',
      '22051729',
      '22051732',
      '22051733',
      '22051734',
      '22051735',
      '22051737',
      '22051739',
      '22051746',
      '22051747',
      '22051748',
      '22051750',
      '22051751',
      '22051752',
      '22051753',
      '22051756',
      '22051757',
      '22051759',
      '22051763',
      '22051765',
      '22051766',
      '22051767',
      '2205177',
      '22051770',
      '22051771',
      '22051775',
      '22051776',
      '22051778',
      '22051779',
      '22051780',
      '22051781',
      '22051782',
      '22051783',
      '22051785',
      '22051786',
      '22051787',
      '22051789',
      '2205179',
      '22051791',
      '22051793',
      '22051795',
      '22051796',
      '22051797',
      '22051798',
      '22051799',
      '22051800',
      '22051801',
      '22051802',
      '22051803',
      '22051805',
      '22051806',
      '22051808',
      '22051809',
      '22051811',
      '22051812',
      '22051816',
      '22051818',
      '22051819',
      '22051826',
      '22051827',
      '22051828',
      '22051829',
      '22051832',
      '22051833',
      '22051834',
      '22051835',
      '22051836',
      '22051837',
      '22051840',
      '22051841',
      '22051845',
      '22051846',
      '22051849',
      '2205185',
      '22051852',
      '22051853',
      '22051854',
      '22051858',
      '22051859',
      '2205186',
      '22051860',
      '22051861',
      '22051865',
      '22051866',
      '22051867',
      '22051869',
      '22051870',
      '22051872',
      '22051874',
      '22051875',
      '22051876',
      '22051879',
      '22051882',
      '22051883',
      '22051884',
      '22051885',
      '22051888',
      '22051889',
      '2205189',
      '22051890',
      '22051892',
      '22051893',
      '22051894',
      '22051897',
      '22051899',
      '2205190',
      '22051901',
      '22051902',
      '22051903',
      '22051904',
      '22051905',
      '22051906',
      '22051908',
      '22051909',
      '2205191',
      '22051911',
      '22051912',
      '22051915',
      '22051917',
      '22051922',
      '22051923',
      '22051924',
      '22051926',
      '22051927',
      '22051928',
      '22051929',
      '22051931',
      '22051932',
      '22051933',
      '22051937',
      '22051939',
      '2205194',
      '22051940',
      '22051941',
      '22051943',
      '22051947',
      '2205195',
      '22051951',
      '22051955',
      '22051957',
      '22051958',
      '22051959',
      '2205196',
      '22051964',
      '22051967',
      '22051969',
      '22051970',
      '22051971',
      '22051972',
      '22051973',
      '22051974',
      '22051975',
      '22051976',
      '22051977',
      '22051978',
      '2205198',
      '22051980',
      '22051981',
      '22051982',
      '22051983',
      '22051984',
      '22051985',
      '22051986',
      '22051987',
      '22051988',
      '22051989',
      '2205199',
      '22051991',
      '22051992',
      '22051994',
      '22051995',
      '22051997',
      '22051998',
      '2205200',
      '22052001',
      '22052002',
      '22052003',
      '22052004',
      '22052005',
      '22052006',
      '22052007',
      '22052008',
      '22052009',
      '2205201',
      '22052010',
      '22052011',
      '22052012',
      '22052013',
      '22052014',
      '22052017',
      '22052018',
      '22052019',
      '2205202',
      '22052021',
      '22052022',
      '22052023',
      '22052024',
      '22052026',
      '22052027',
      '2205203',
      '22052031',
      '22052032',
      '22052034',
      '22052037',
      '22052038',
      '22052039',
      '2205204',
      '22052040',
      '22052041',
      '22052045',
      '22052047',
      '22052049',
      '2205205',
      '22052050',
      '22052052',
      '22052054',
      '22052057',
      '22052059',
      '2205206',
      '22052061',
      '22052062',
      '22052063',
      '22052064',
      '22052067',
      '22052068',
      '22052069',
      '2205207',
      '22052073',
      '22052074',
      '22052076',
      '22052079',
      '22052081',
      '22052083',
      '22052084',
      '22052087',
      '22052088',
      '22052089',
      '2205209',
      '22052090',
      '22052092',
      '22052093',
      '22052094',
      '22052095',
      '22052096',
      '22052097',
      '22052098',
      '2205210',
      '22052100',
      '22052102',
      '22052103',
      '22052104',
      '22052105',
      '22052106',
      '22052108',
      '22052109',
      '22052110',
      '22052113',
      '22052116',
      '2205212',
      '22052125',
      '22052126',
      '22052129',
      '2205213',
      '22052130',
      '22052136',
      '22052137',
      '22052140',
      '22052146',
      '22052148',
      '22052149',
      '2205215',
      '22052152',
      '22052154',
      '22052156',
      '22052158',
      '22052159',
      '2205216',
      '22052160',
      '22052161',
      '22052162',
      '22052163',
      '22052166',
      '22052167',
      '22052173',
      '22052174',
      '22052175',
      '22052178',
      '22052179',
      '22052180',
      '22052181',
      '22052182',
      '22052183',
      '22052185',
      '22052194',
      '22052195',
      '22052197',
      '22052199',
      '22052200',
      '22052201',
      '22052204',
      '22052205',
      '22052207',
      '22052208',
      '2205221',
      '22052210',
      '22052213',
      '22052215',
      '22052216',
      '22052217',
      '22052218',
      '2205222',
      '22052220',
      '22052222',
      '22052223',
      '22052225',
      '22052227',
      '22052229',
      '2205223',
      '22052231',
      '22052233',
      '22052234',
      '22052235',
      '22052236',
      '22052237',
      '22052238',
      '2205224',
      '22052240',
      '22052241',
      '22052242',
      '22052243',
      '22052248',
      '22052249',
      '22052252',
      '2205226',
      '22052260',
      '22052261',
      '22052265',
      '22052266',
      '22052267',
      '22052268',
      '2205227',
      '22052270',
      '22052271',
      '22052272',
      '22052273',
      '22052274',
      '22052275',
      '22052276',
      '22052277',
      '22052278',
      '2205228',
      '22052280',
      '22052282',
      '22052283',
      '22052285',
      '22052287',
      '22052288',
      '22052289',
      '2205229',
      '22052292',
      '22052295',
      '22052296',
      '22052297',
      '22052298',
      '22052299',
      '2205230',
      '22052301',
      '22052302',
      '22052303',
      '22052305',
      '22052307',
      '22052308',
      '22052312',
      '22052314',
      '22052315',
      '22052320',
      '22052322',
      '22052323',
      '22052324',
      '22052325',
      '22052329',
      '22052331',
      '22052332',
      '22052334',
      '22052336',
      '22052338',
      '2205234',
      '22052340',
      '22052341',
      '22052342',
      '22052343',
      '22052347',
      '22052348',
      '2205235',
      '22052350',
      '22052351',
      '22052352',
      '22052355',
      '22052356',
      '22052358',
      '22052359',
      '2205236',
      '22052361',
      '22052364',
      '22052366',
      '22052367',
      '2205237',
      '22052370',
      '22052375',
      '22052376',
      '22052377',
      '22052382',
      '22052384',
      '22052385',
      '22052386',
      '22052387',
      '22052388',
      '22052389',
      '2205239',
      '22052390',
      '22052391',
      '22052395',
      '22052396',
      '22052397',
      '22052398',
      '22052402',
      '22052403',
      '22052404',
      '22052405',
      '22052406',
      '22052407',
      '22052409',
      '2205241',
      '22052411',
      '22052412',
      '22052414',
      '22052416',
      '22052417',
      '2205242',
      '22052420',
      '22052421',
      '22052422',
      '22052423',
      '22052424',
      '22052425',
      '22052427',
      '22052428',
      '2205243',
      '22052430',
      '22052431',
      '22052432',
      '22052433',
      '22052434',
      '22052436',
      '22052439',
      '2205244',
      '22052440',
      '22052443',
      '22052444',
      '22052445',
      '22052446',
      '22052447',
      '22052450',
      '22052451',
      '2205246',
      '22052460',
      '22052461',
      '22052463',
      '22052464',
      '22052466',
      '22052467',
      '22052469',
      '2205247',
      '2205247',
      '22052470',
      '22052473',
      '22052474',
      '22052475',
      '22052476',
      '22052479',
      '22052485',
      '22052489',
      '22052490',
      '22052491',
      '22052495',
      '22052496',
      '22052497',
      '22052498',
      '22052502',
      '22052503',
      '22052505',
      '22052506',
      '22052508',
      '22052509',
      '22052511',
      '22052512',
      '22052517',
      '2205252',
      '22052523',
      '22052524',
      '22052527',
      '22052528',
      '22052530',
      '22052534',
      '22052535',
      '22052536',
      '22052537',
      '22052538',
      '22052539',
      '22052540',
      '22052542',
      '22052545',
      '22052548',
      '22052549',
      '22052552',
      '22052554',
      '22052556',
      '22052557',
      '2205256',
      '22052562',
      '22052564',
      '22052565',
      '22052572',
      '22052577',
      '22052579',
      '2205258',
      '22052580',
      '22052582',
      '22052583',
      '22052588',
      '22052590',
      '22052595',
      '22052599',
      '2205260',
      '22052600',
      '22052602',
      '22052603',
      '22052605',
      '22052606',
      '22052607',
      '22052608',
      '22052609',
      '2205261',
      '22052612',
      '22052613',
      '22052617',
      '2205262',
      '22052621',
      '22052622',
      '22052623',
      '22052625',
      '22052626',
      '22052629',
      '2205263',
      '22052630',
      '22052631',
      '22052636',
      '22052639',
      '22052640',
      '22052642',
      '22052644',
      '22052646',
      '22052647',
      '22052648',
      '22052651',
      '22052652',
      '22052653',
      '22052654',
      '22052657',
      '22052659',
      '2205266',
      '22052661',
      '22052663',
      '22052664',
      '22052668',
      '22052669',
      '22052670',
      '22052672',
      '22052673',
      '22052674',
      '22052675',
      '22052677',
      '22052678',
      '22052679',
      '22052683',
      '22052686',
      '22052687',
      '22052688',
      '22052689',
      '2205269',
      '22052691',
      '22052693',
      '22052694',
      '22052695',
      '22052696',
      '22052698',
      '22052699',
      '2205270',
      '22052701',
      '22052702',
      '22052705',
      '22052706',
      '22052709',
      '2205271',
      '22052711',
      '22052712',
      '22052716',
      '22052718',
      '22052720',
      '22052721',
      '22052722',
      '22052723',
      '22052724',
      '22052725',
      '22052726',
      '22052727',
      '22052728',
      '22052729',
      '2205273',
      '22052731',
      '22052733',
      '22052738',
      '22052739',
      '22052740',
      '22052742',
      '22052744',
      '22052745',
      '22052746',
      '22052747',
      '22052748',
      '2205275',
      '22052750',
      '22052751',
      '22052752',
      '22052754',
      '22052757',
      '2205276',
      '22052760',
      '22052761',
      '22052763',
      '22052764',
      '22052765',
      '22052767',
      '22052768',
      '22052771',
      '22052772',
      '22052773',
      '22052775',
      '22052779',
      '2205278',
      '22052780',
      '22052788',
      '22052794',
      '22052795',
      '22052796',
      '22052799',
      '22052800',
      '22052801',
      '22052802',
      '22052803',
      '22052808',
      '2205281',
      '22052812',
      '22052813',
      '22052815',
      '22052816',
      '22052817',
      '2205282',
      '22052820',
      '22052823',
      '22052824',
      '22052825',
      '22052826',
      '2205283',
      '22052830',
      '22052833',
      '22052837',
      '22052839',
      '22052842',
      '22052845',
      '2205285',
      '22052850',
      '22052851',
      '22052852',
      '22052854',
      '22052855',
      '22052856',
      '22052857',
      '22052858',
      '22052860',
      '22052862',
      '22052864',
      '22052866',
      '22052867',
      '22052869',
      '22052870',
      '22052871',
      '22052874',
      '22052875',
      '22052876',
      '22052877',
      '22052879',
      '22052880',
      '22052881',
      '22052883',
      '22052885',
      '22052886',
      '22052887',
      '22052888',
      '22052889',
      '2205289',
      '22052892',
      '22052897',
      '22052899',
      '2205290',
      '22052902',
      '22052906',
      '22052908',
      '22052909',
      '22052911',
      '22052912',
      '22052913',
      '22052915',
      '22052916',
      '22052919',
      '2205292',
      '22052921',
      '22052922',
      '22052923',
      '22052925',
      '22052926',
      '22052927',
      '22052928',
      '22052932',
      '22052933',
      '22052934',
      '22052935',
      '22052936',
      '22052937',
      '22052938',
      '2205294',
      '22052942',
      '22052944',
      '22052945',
      '22052946',
      '22052947',
      '22052948',
      '22052949',
      '2205295',
      '22052951',
      '22052952',
      '22052955',
      '22052956',
      '22052958',
      '22052959',
      '22052960',
      '22052961',
      '22052963',
      '22052964',
      '22052965',
      '22052966',
      '22052968',
      '22052969',
      '22052971',
      '22052975',
      '22052976',
      '22052979',
      '2205298',
      '22052981',
      '22052982',
      '22052983',
      '22052984',
      '22052986',
      '22052987',
      '2205299',
      '22052990',
      '22052993',
      '22052994',
      '22052996',
      '22052997',
      '2205300',
      '22053001',
      '22053003',
      '22053006',
      '22053009',
      '22053011',
      '22053013',
      '22053014',
      '22053015',
      '22053016',
      '22053017',
      '22053018',
      '22053019',
      '2205302',
      '22053020',
      '22053023',
      '22053024',
      '22053025',
      '22053027',
      '22053028',
      '2205303',
      '22053030',
      '22053032',
      '22053033',
      '22053034',
      '22053035',
      '22053036',
      '22053037',
      '22053038',
      '2205304',
      '22053040',
      '22053041',
      '22053042',
      '22053044',
      '22053045',
      '22053046',
      '22053047',
      '22053049',
      '22053051',
      '22053052',
      '22053053',
      '22053055',
      '22053059',
      '22053061',
      '22053067',
      '2205307',
      '22053070',
      '22053071',
      '22053072',
      '22053073',
      '22053077',
      '2205308',
      '22053081',
      '22053083',
      '22053086',
      '22053089',
      '2205309',
      '22053090',
      '22053091',
      '22053092',
      '22053093',
      '22053094',
      '22053095',
      '22053096',
      '22053097',
      '22053098',
      '22053099',
      '2205310',
      '22053100',
      '22053101',
      '22053102',
      '22053104',
      '22053105',
      '22053106',
      '22053109',
      '22053110',
      '22053111',
      '22053112',
      '22053115',
      '22053118',
      '2205312',
      '22053120',
      '22053123',
      '22053124',
      '22053125',
      '22053129',
      '2205313',
      '22053130',
      '22053131',
      '22053133',
      '22053136',
      '22053139',
      '2205314',
      '22053140',
      '22053141',
      '22053146',
      '22053150',
      '22053152',
      '22053153',
      '22053154',
      '22053156',
      '22053158',
      '22053159',
      '22053160',
      '22053161',
      '22053162',
      '22053164',
      '22053165',
      '22053169',
      '2205317',
      '22053170',
      '22053171',
      '22053175',
      '22053176',
      '22053177',
      '2205318',
      '22053181',
      '22053183',
      '22053186',
      '22053187',
      '22053188',
      '2205319',
      '22053190',
      '22053191',
      '22053193',
      '22053195',
      '22053196',
      '22053198',
      '22053199',
      '2205320',
      '22053202',
      '22053203',
      '22053204',
      '22053205',
      '22053206',
      '22053207',
      '22053209',
      '2205321',
      '22053210',
      '22053211',
      '22053216',
      '22053218',
      '2205322',
      '22053222',
      '22053223',
      '22053226',
      '22053228',
      '2205323',
      '22053230',
      '22053231',
      '22053232',
      '22053233',
      '22053234',
      '22053235',
      '22053236',
      '22053238',
      '22053239',
      '2205324',
      '22053240',
      '22053241',
      '22053242',
      '22053244',
      '22053245',
      '22053246',
      '22053247',
      '22053248',
      '22053249',
      '22053250',
      '22053251',
      '22053252',
      '22053253',
      '22053255',
      '22053257',
      '22053259',
      '2205326',
      '22053260',
      '22053261',
      '22053262',
      '22053263',
      '22053265',
      '22053267',
      '22053269',
      '2205327',
      '22053272',
      '22053273',
      '22053275',
      '22053276',
      '22053278',
      '22053279',
      '2205328',
      '22053280',
      '22053283',
      '22053284',
      '22053286',
      '22053287',
      '22053289',
      '22053292',
      '22053293',
      '22053294',
      '22053295',
      '22053296',
      '22053297',
      '22053298',
      '22053299',
      '2205330',
      '22053304',
      '22053305',
      '22053307',
      '22053308',
      '22053309',
      '2205331',
      '22053311',
      '22053312',
      '22053313',
      '22053314',
      '22053315',
      '22053316',
      '22053317',
      '22053319',
      '2205332',
      '22053321',
      '22053323',
      '22053326',
      '22053328',
      '22053332',
      '22053334',
      '22053335',
      '22053336',
      '22053337',
      '22053338',
      '22053343',
      '22053344',
      '22053348',
      '2205335',
      '22053350',
      '22053352',
      '22053353',
      '22053354',
      '22053355',
      '22053356',
      '22053358',
      '22053359',
      '2205336',
      '22053360',
      '22053363',
      '22053364',
      '22053365',
      '22053366',
      '22053368',
      '22053369',
      '2205337',
      '22053370',
      '22053372',
      '22053374',
      '22053376',
      '22053378',
      '22053379',
      '22053381',
      '22053382',
      '22053388',
      '22053391',
      '22053395',
      '22053396',
      '22053398',
      '22053399',
      '22053400',
      '22053401',
      '22053402',
      '22053405',
      '22053406',
      '22053408',
      '2205341',
      '22053410',
      '22053411',
      '22053414',
      '22053416',
      '22053417',
      '22053418',
      '2205342',
      '22053422',
      '22053423',
      '22053424',
      '22053425',
      '22053428',
      '22053429',
      '22053431',
      '22053432',
      '22053433',
      '22053434',
      '22053439',
      '22053441',
      '22053443',
      '22053444',
      '22053445',
      '22053447',
      '2205345',
      '22053450',
      '22053451',
      '22053452',
      '22053454',
      '22053458',
      '22053459',
      '22053460',
      '22053461',
      '22053462',
      '22053463',
      '22053464',
      '22053465',
      '22053466',
      '22053467',
      '22053468',
      '22053469',
      '2205347',
      '22053471',
      '22053475',
      '22053477',
      '22053478',
      '22053479',
      '2205348',
      '22053480',
      '22053482',
      '22053484',
      '22053485',
      '22053486',
      '22053488',
      '22053491',
      '22053494',
      '22053496',
      '22053497',
      '22053498',
      '22053499',
      '22053500',
      '22053501',
      '22053502',
      '22053503',
      '22053504',
      '22053505',
      '22053508',
      '22053510',
      '22053512',
      '22053513',
      '22053514',
      '22053515',
      '22053516',
      '22053519',
      '2205352',
      '22053522',
      '22053526',
      '22053528',
      '22053529',
      '2205353',
      '22053530',
      '22053531',
      '22053532',
      '22053534',
      '22053536',
      '22053539',
      '22053540',
      '22053541',
      '22053547',
      '2205355',
      '22053550',
      '22053555',
      '22053556',
      '22053564',
      '22053566',
      '22053567',
      '22053569',
      '22053570',
      '22053571',
      '22053572',
      '22053573',
      '22053577',
      '22053578',
      '2205358',
      '22053580',
      '22053581',
      '22053582',
      '22053583',
      '22053585',
      '22053587',
      '22053588',
      '22053589',
      '22053591',
      '22053592',
      '22053593',
      '22053596',
      '22053599',
      '2205360',
      '22053602',
      '22053603',
      '22053606',
      '22053607',
      '22053613',
      '22053615',
      '22053616',
      '22053618',
      '22053619',
      '2205362',
      '22053621',
      '22053622',
      '22053623',
      '22053624',
      '22053629',
      '2205363',
      '22053630',
      '22053631',
      '22053633',
      '22053635',
      '22053637',
      '22053638',
      '22053639',
      '2205364',
      '22053640',
      '2205365',
      '22053650',
      '22053654',
      '22053655',
      '22053659',
      '2205366',
      '22053662',
      '22053663',
      '22053664',
      '22053667',
      '22053668',
      '2205367',
      '22053672',
      '22053673',
      '22053674',
      '22053675',
      '22053676',
      '22053677',
      '22053679',
      '22053680',
      '22053682',
      '22053684',
      '22053685',
      '22053686',
      '22053687',
      '22053688',
      '22053690',
      '22053691',
      '22053692',
      '22053693',
      '22053694',
      '22053696',
      '22053699',
      '22053700',
      '22053702',
      '22053703',
      '22053704',
      '22053706',
      '22053709',
      '2205371',
      '22053711',
      '22053712',
      '22053713',
      '22053714',
      '22053717',
      '22053719',
      '2205372',
      '22053720',
      '22053722',
      '22053724',
      '22053726',
      '22053727',
      '22053728',
      '22053729',
      '22053731',
      '22053733',
      '22053734',
      '22053735',
      '22053737',
      '22053740',
      '22053742',
      '22053744',
      '22053745',
      '22053747',
      '2205375',
      '22053751',
      '22053752',
      '22053754',
      '22053755',
      '22053756',
      '22053757',
      '22053758',
      '22053759',
      '2205376',
      '22053760',
      '22053762',
      '22053763',
      '22053764',
      '22053766',
      '22053768',
      '2205377',
      '22053770',
      '22053772',
      '22053774',
      '22053776',
      '22053778',
      '2205378',
      '22053781',
      '22053783',
      '22053784',
      '22053787',
      '22053788',
      '22053789',
      '2205379',
      '22053791',
      '22053793',
      '22053794',
      '22053797',
      '2205380',
      '22053800',
      '22053805',
      '22053806',
      '22053807',
      '22053808',
      '22053810',
      '22053811',
      '22053813',
      '22053815',
      '22053816',
      '22053817',
      '2205382',
      '22053820',
      '22053821',
      '22053822',
      '22053826',
      '22053827',
      '22053828',
      '22053829',
      '22053830',
      '22053831',
      '22053832',
      '22053834',
      '22053835',
      '22053836',
      '22053839',
      '22053840',
      '22053842',
      '22053843',
      '22053844',
      '22053846',
      '22053848',
      '22053849',
      '22053850',
      '22053852',
      '22053856',
      '22053857',
      '22053858',
      '22053859',
      '22053860',
      '22053861',
      '22053864',
      '22053865',
      '22053866',
      '22053867',
      '22053868',
      '22053871',
      '22053875',
      '22053876',
      '22053878',
      '22053879',
      '2205388',
      '22053881',
      '22053883',
      '22053884',
      '22053885',
      '22053887',
      '22053888',
      '22053889',
      '2205389',
      '22053890',
      '22053892',
      '22053893',
      '22053895',
      '22053897',
      '22053898',
      '22053899',
      '22053902',
      '22053904',
      '22053905',
      '22053907',
      '22053908',
      '22053909',
      '2205391',
      '22053910',
      '22053911',
      '22053913',
      '22053915',
      '22053916',
      '22053918',
      '22053919',
      '2205392',
      '22053921',
      '22053922',
      '22053924',
      '22053925',
      '22053927',
      '2205393',
      '22053931',
      '22053934',
      '22053935',
      '22053937',
      '22053938',
      '22053939',
      '2205394',
      '22053942',
      '22053945',
      '22053946',
      '22053952',
      '22053953',
      '22053954',
      '22053956',
      '22053957',
      '22053958',
      '22053960',
      '22053961',
      '22053962',
      '22053963',
      '22053965',
      '22053966',
      '22053967',
      '2205397',
      '22053970',
      '22053971',
      '22053972',
      '22053973',
      '22053976',
      '22053977',
      '22053978',
      '22053979',
      '22053980',
      '22053981',
      '22053982',
      '22053985',
      '22053986',
      '22053987',
      '22053988',
      '22053989',
      '22053992',
      '22053995',
      '22053997',
      '22053999',
      '22054000',
      '22054007',
      '22054008',
      '22054009',
      '2205401',
      '22054012',
      '22054013',
      '22054014',
      '22054016',
      '2205402',
      '22054022',
      '22054023',
      '2205403',
      '22054034',
      '22054036',
      '22054037',
      '22054040',
      '22054042',
      '22054045',
      '22054046',
      '22054049',
      '2205405',
      '22054052',
      '22054053',
      '22054054',
      '22054056',
      '22054057',
      '2205406',
      '22054062',
      '22054064',
      '22054066',
      '2205407',
      '22054071',
      '22054073',
      '22054074',
      '22054075',
      '22054081',
      '22054083',
      '22054084',
      '22054089',
      '2205409',
      '22054091',
      '22054094',
      '22054095',
      '2205410',
      '22054100',
      '22054103',
      '22054106',
      '22054109',
      '2205411',
      '22054110',
      '22054113',
      '22054114',
      '22054117',
      '22054118',
      '22054119',
      '22054121',
      '22054122',
      '22054123',
      '22054125',
      '22054127',
      '22054128',
      '2205413',
      '22054130',
      '22054131',
      '22054132',
      '22054133',
      '22054134',
      '22054135',
      '22054137',
      '22054139',
      '22054141',
      '22054142',
      '22054143',
      '22054145',
      '22054146',
      '22054147',
      '22054156',
      '22054159',
      '2205416',
      '22054160',
      '22054162',
      '22054164',
      '22054165',
      '22054166',
      '22054167',
      '22054168',
      '22054169',
      '22054170',
      '22054172',
      '22054174',
      '22054181',
      '22054183',
      '22054186',
      '22054187',
      '22054188',
      '22054189',
      '2205419',
      '22054191',
      '22054192',
      '22054194',
      '22054197',
      '22054198',
      '22054200',
      '22054202',
      '22054210',
      '22054211',
      '22054213',
      '22054214',
      '22054215',
      '22054216',
      '22054217',
      '22054219',
      '22054220',
      '22054222',
      '22054224',
      '22054225',
      '22054228',
      '22054229',
      '2205423',
      '22054235',
      '22054236',
      '22054237',
      '22054239',
      '22054242',
      '22054245',
      '22054248',
      '22054250',
      '22054251',
      '22054254',
      '22054256',
      '22054261',
      '22054262',
      '22054263',
      '22054264',
      '22054266',
      '22054267',
      '22054269',
      '2205427',
      '22054270',
      '22054276',
      '22054277',
      '22054278',
      '22054279',
      '2205428',
      '22054281',
      '22054284',
      '22054285',
      '22054288',
      '22054289',
      '2205429',
      '22054291',
      '22054292',
      '2205430',
      '22054300',
      '22054301',
      '22054302',
      '22054303',
      '22054304',
      '22054305',
      '22054308',
      '2205431',
      '22054311',
      '22054314',
      '22054316',
      '2205432',
      '22054320',
      '22054322',
      '22054323',
      '22054324',
      '22054327',
      '2205433',
      '22054330',
      '22054332',
      '22054335',
      '22054337',
      '22054339',
      '22054340',
      '22054341',
      '22054342',
      '22054344',
      '22054345',
      '22054350',
      '22054352',
      '22054353',
      '22054355',
      '22054357',
      '22054358',
      '2205436',
      '22054360',
      '22054361',
      '22054363',
      '22054368',
      '22054369',
      '22054371',
      '22054372',
      '22054373',
      '22054376',
      '22054377',
      '22054380',
      '22054381',
      '22054383',
      '22054385',
      '22054386',
      '22054388',
      '22054389',
      '2205439',
      '22054395',
      '22054396',
      '22054397',
      '2205440',
      '22054400',
      '22054405',
      '22054407',
      '22054408',
      '22054410',
      '22054411',
      '22054412',
      '22054414',
      '22054415',
      '22054417',
      '22054418',
      '22054419',
      '2205442',
      '22054422',
      '22054425',
      '22054426',
      '2205443',
      '22054430',
      '22054432',
      '22054433',
      '22054434',
      '22054435',
      '22054437',
      '22054438',
      '22054439',
      '22054440',
      '22054442',
      '22054443',
      '22054445',
      '22054447',
      '22054449',
      '2205445',
      '22054450',
      '22054453',
      '22054455',
      '22054459',
      '22054460',
      '22054461',
      '22054462',
      '22054467',
      '22054468',
      '22054469',
      '2205447',
      '2205451',
      '2205453',
      '2205454',
      '2205456',
      '2205458',
      '2205459',
      '2205462',
      '2205464',
      '2205465',
      '2205467',
      '2205469',
      '2205472',
      '2205474',
      '2205476',
      '2205485',
      '2205486',
      '2205488',
      '2205489',
      '2205492',
      '2205493',
      '2205494',
      '2205495',
      '2205498',
      '2205499',
      '2205500',
      '2205502',
      '2205503',
      '2205509',
      '2205511',
      '2205512',
      '2205515',
      '2205516',
      '2205517',
      '2205518',
      '2205519',
      '2205520',
      '2205528',
      '2205529',
      '2205535',
      '2205537',
      '2205538',
      '2205540',
      '2205544',
      '2205548',
      '2205550',
      '2205553',
      '2205555',
      '2205556',
      '2205557',
      '2205561',
      '2205564',
      '2205565',
      '2205567',
      '2205569',
      '2205571',
      '2205575',
      '2205576',
      '2205577',
      '2205578',
      '2205580',
      '2205584',
      '2205586',
      '2205587',
      '2205589',
      '2205590',
      '2205592',
      '2205595',
      '2205596',
      '2205600',
      '2205601',
      '2205602',
      '2205604',
      '2205606',
      '2205607',
      '2205609',
      '2205610',
      '2205614',
      '2205616',
      '2205619',
      '2205621',
      '2205623',
      '2205624',
      '2205627',
      '2205628',
      '2205629',
      '2205630',
      '2205631',
      '2205636',
      '2205639',
      '2205641',
      '2205649',
      '2205651',
      '2205652',
      '2205653',
      '2205655',
      '2205658',
      '2205660',
      '2205661',
      '2205662',
      '2205663',
      '2205665',
      '2205666',
      '2205667',
      '2205668',
      '2205669',
      '2205670',
      '2205673',
      '2205674',
      '2205675',
      '2205676',
      '2205679',
      '2205680',
      '2205682',
      '2205683',
      '2205684',
      '2205687',
      '2205688',
      '2205689',
      '2205690',
      '2205691',
      '2205693',
      '2205694',
      '2205696',
      '2205698',
      '2205699',
      '2205701',
      '2205703',
      '2205704',
      '2205706',
      '2205707',
      '2205708',
      '2205709',
      '2205712',
      '2205714',
      '2205715',
      '2205723',
      '2205725',
      '2205729',
      '2205730',
      '2205731',
      '2205732',
      '2205735',
      '2205736',
      '2205737',
      '2205739',
      '2205740',
      '2205742',
      '2205743',
      '2205744',
      '2205746',
      '2205747',
      '2205748',
      '2205749',
      '2205750',
      '2205753',
      '2205754',
      '2205758',
      '2205762',
      '2205766',
      '2205767',
      '2205769',
      '2205772',
      '2205776',
      '2205777',
      '2205778',
      '2205779',
      '2205780',
      '2205786',
      '2205787',
      '2205789',
      '2205790',
      '2205791',
      '2205792',
      '2205793',
      '2205795',
      '2205796',
      '2205797',
      '2205798',
      '2205800',
      '2205801',
      '2205802',
      '2205804',
      '2205805',
      '2205807',
      '2205808',
      '2205809',
      '2205811',
      '2205812',
      '2205813',
      '2205815',
      '2205819',
      '2205820',
      '2205824',
      '2205825',
      '2205826',
      '2205828',
      '2205829',
      '2205831',
      '2205832',
      '2205834',
      '2205835',
      '2205837',
      '2205840',
      '2205841',
      '2205843',
      '2205847',
      '2205848',
      '2205850',
      '2205851',
      '2205852',
      '2205853',
      '2205854',
      '2205855',
      '2205856',
      '2205857',
      '2205859',
      '2205861',
      '2205862',
      '2205866',
      '2205867',
      '2205868',
      '2205869',
      '2205871',
      '2205872',
      '2205873',
      '2205874',
      '2205875',
      '2205877',
      '2205878',
      '2205880',
      '2205882',
      '2205883',
      '2205884',
      '2205885',
      '2205887',
      '2205888',
      '2205889',
      '2205890',
      '2205896',
      '2205897',
      '2205898',
      '2205900',
      '2205902',
      '2205903',
      '2205904',
      '2205906',
      '2205907',
      '2205909',
      '2205911',
      '2205912',
      '2205914',
      '2205915',
      '2205916',
      '2205917',
      '2205918',
      '2205919',
      '2205920',
      '2205929',
      '2205930',
      '2205931',
      '2205932',
      '2205934',
      '2205937',
      '2205938',
      '2205939',
      '2205942',
      '2205944',
      '2205945',
      '2205947',
      '2205948',
      '2205951',
      '2205952',
      '2205955',
      '2205956',
      '2205957',
      '2205958',
      '2205959',
      '2205961',
      '2205962',
      '2205964',
      '2205965',
      '2205966',
      '2205967',
      '2205968',
      '2205969',
      '2205970',
      '2205971',
      '2205972',
      '2205973',
      '2205974',
      '2205981',
      '2205983',
      '2205984',
      '2205985',
      '2205986',
      '2205988',
      '2205989',
      '2205991',
      '2205992',
      '2205995',
      '2205997',
      '2205998',
      '2206003',
      '2206005',
      '2206007',
      '2206008',
      '2206009',
      '2206011',
      '2206013',
      '2206015',
      '2206016',
      '2206018',
      '2206020',
      '2206025',
      '2206028',
      '2206029',
      '2206031',
      '2206033',
      '2206034',
      '2206035',
      '2206036',
      '2206043',
      '2206044',
      '2206050',
      '2206051',
      '2206052',
      '2206053',
      '2206060',
      '2206064',
      '2206066',
      '2206070',
      '2206071',
      '2206072',
      '2206073',
      '2206076',
      '2206077',
      '2206078',
      '2206086',
      '2206088',
      '2206089',
      '2206094',
      '2206099',
      '2206101',
      '2206102',
      '2206103',
      '2206105',
      '2206107',
      '2206109',
      '2206110',
      '2206111',
      '2206117',
      '2206118',
      '2206119',
      '2206122',
      '2206123',
      '2206127',
      '2206128',
      '2206129',
      '2206130',
      '2206131',
      '2206134',
      '2206135',
      '2206136',
      '2206138',
      '2206140',
      '2206141',
      '2206143',
      '2206145',
      '2206146',
      '2206149',
      '2206154',
      '2206155',
      '2206157',
      '2206158',
      '2206159',
      '2206160',
      '2206162',
      '2206167',
      '2206172',
      '2206173',
      '2206174',
      '2206177',
      '2206177',
      '2206178',
      '2206181',
      '2206182',
      '2206183',
      '2206184',
      '2206187',
      '2206192',
      '2206196',
      '2206199',
      '2206202',
      '2206204',
      '2206208',
      '2206209',
      '2206210',
      '2206213',
      '2206214',
      '2206217',
      '2206218',
      '2206219',
      '2206221',
      '2206222',
      '2206228',
      '2206229',
      '2206230',
      '2206232',
      '2206235',
      '2206239',
      '2206240',
      '2206242',
      '2206243',
      '2206245',
      '2206249',
      '2206250',
      '2206251',
      '2206253',
      '2206254',
      '2206255',
      '2206256',
      '2206257',
      '2206258',
      '2206259',
      '2206261',
      '2206263',
      '2206264',
      '2206265',
      '2206266',
      '2206267',
      '2206269',
      '2206270',
      '2206272',
      '2206273',
      '2206274',
      '2206276',
      '2206277',
      '2206278',
      '2206281',
      '2206283',
      '2206283',
      '2206285',
      '2206286',
      '2206287',
      '2206289',
      '2206292',
      '2206294',
      '2206297',
      '2206299',
      '2206302',
      '2206304',
      '2206305',
      '2206310',
      '2206312',
      '2206316',
      '2206318',
      '2206319',
      '2206322',
      '2206323',
      '2206324',
      '2206329',
      '2206333',
      '2206335',
      '2206341',
      '2206346',
      '2206348',
      '2206349',
      '2206358',
      '2206361',
      '2206367',
      '2206369',
      '2206372',
      '2206374',
      '2206377',
      '2206378',
      '2206383',
      '2206386',
      '2206395',
      '2206396',
      '2206401',
      '2206402',
      '2206403',
      '2206404',
      '2206407',
      '2206408',
      '2206410',
      '2206411',
      '2206412',
      '2206416',
      '2206418',
      '2206419',
      '2206424',
      '2206425',
      '2228001',
      '2228003',
      '2228004',
      '2228006',
      '2228010',
      '2228013',
      '2228015',
      '2228017',
      '2228018',
      '2228020',
      '2228022',
      '2228023',
      '2228026',
      '2228031',
      '2228032',
      '2228035',
      '2228037',
      '2228038',
      '2228039',
      '2228040',
      '2228043',
      '2228044',
      '2228046',
      '2228047',
      '2228048',
      '2228052',
      '2228057',
      '2228059',
      '2228061',
      '2228066',
      '2228067',
      '2228075',
      '2228078',
      '2228079',
      '2228080',
      '2228081',
      '2228082',
      '2228083',
      '2228087',
      '2228094',
      '2228095',
      '2228096',
      '2228100',
      '2228101',
      '2228107',
      '2228109',
      '2228115',
      '2228116',
      '2228117',
      '2228119',
      '2228120',
      '2228127',
      '2228132',
      '2228133',
      '2228137',
      '2228141',
      '2228148',
      '2228150',
      '2228154',
      '2228158',
      '2228161',
      '2228167',
      '2228169',
      '2228170',
      '2228171',
      '2228172',
      '2228178',
      '2228181',
      '2229006',
      '2229008',
      '2229009',
      '2229011',
      '2229017',
      '2229018',
      '2229021',
      '2229024',
      '2229030',
      '2229037',
      '2229038',
      '2229041',
      '2229044',
      '2229051',
      '2229052',
      '2229059',
      '2229061',
      '2229063',
      '2229064',
      '2229068',
      '2229069',
      '2229071',
      '2229072',
      '2229076',
      '2229079',
      '2229084',
      '2229087',
      '2229088',
      '2229090',
      '2229091',
      '2229095',
      '2229098',
      '2229112',
      '2229115',
      '2229116',
      '2229119',
      '2229120',
      '2229124',
      '2229125',
      '2229126',
      '2229130',
      '2229132',
      '2229133',
      '2229139',
      '2229143',
      '2229146',
      '2229148',
      '2229150',
      '2229165',
      '2229177',
      '2229185',
      '2229187',
      '2229189',
      '2229201',
      '23057001',
      '23057003',
      '23057004',
      '23057005',
      '23057007',
      '23057008',
      '23057010',
      '23057011',
      '23057016',
      '23057017',
      '23057019',
      '23057020',
      '23057021',
      '23057022',
      '23057024',
      '23057026',
      '23057029',
      '23057033',
      '23057036',
      '23057037',
      '23057039',
      '23057041',
      '23057042',
      '23057043',
      '23057044',
      '23057047',
      '23057048',
      '23057049',
      '23057052',
      '23057056',
      '23057058',
      '23057061',
      '23057063',
      '2306601',
    ];

    let continueLoop = true;

    try {
      for (let i = 0; i < users.length && continueLoop; i++) {
        if (!continueLoop) break;
        await this.mailService.sendNonRegistered(`${users[i]}@kiit.ac.in`, i);
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    } catch (error) {
      continueLoop = false;
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
  

}
