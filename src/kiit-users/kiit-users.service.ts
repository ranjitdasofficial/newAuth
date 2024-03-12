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
      const newUser = await this.prisma.user.create({
        data: dto,
      });
      if (!newUser) throw new Error('Something went wrong!');
      console.log(newUser)
      return newUser;
    } catch (error) {
      console.log(error)
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
      });
      console.log(user);
      if (!user) throw new NotFoundException('User not found');

      if (!user.isPremium) {
        return {
          user: user,
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

      const tokens = await this.jwtService.signAsync(
        { email: email },
        {
          expiresIn: 60,
          secret: 'Ranjit',
        },
      );
      this.tokens[email] = tokens;
      return {
        user: user,
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
      console.log(token,getSession,email)
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
      const newUser = await this.prisma.premiumMember.create({
        data: dto,
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
        activateLink: 'https://kiitconnect.live/payment',
      };
      await this.mailService.sendAccountCreated(data);
      //   return user;
      return newUser;
    } catch (error) {
      console.log(error);
      if (error instanceof ConflictException) {
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

      const p = await this.storageService.save(
        'payemnt/' + mediaId,
        'image/webp', // Set the mimetype for WebP
        filebuffer,
        [{ mediaId: mediaId }],
      );
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
          paymentScreenshot: p.mediaId,
        },
      });
      if (!user) throw new NotFoundException('User not found');
      const data = {
        email: user.user.email,
        name: user.user.name,
        branch: user.branch,
        year: user.year,
        amount: '50',
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

          paymentScreenshot: true,
          isActive: true,
          branch: true,
          year: true,
        },
      });

      const filterUser = users.filter((u) => u.user.email.startsWith('22'));

      return filterUser;
    } catch (error) {
      console.log(error);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Internal Server Error');
    }
  }

  async sendRemainderMail() {
    const users = [
      {
        user: {
          name: 'REHAAN PAUL',
          email: '23052094@kiit.ac.in',
        },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '1st Year',
      },
      {
        user: {
          name: '4231_SHIVAM SHAH',
          email: '22054231@kiit.ac.in',
        },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '2nd Year',
      },
      {
        user: {
          name: 'KUNAL SAW',
          email: '22051344@kiit.ac.in',
        },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '2nd Year',
      },
      {
        user: {
          name: 'SHREYANK DUTTA',
          email: '23053399@kiit.ac.in',
        },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '1st Year',
      },
      {
        user: {
          name: '1859_Swapnil',
          email: '21051859@kiit.ac.in',
        },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '3rd Year',
      },
      {
        user: {
          name: '484_ ARKA GHOSH',
          email: '21052484@kiit.ac.in',
        },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '3rd Year',
      },
      {
        user: {
          name: '3541_ASHMIT PATRA',
          email: '23053541@kiit.ac.in',
        },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '1st Year',
      },
      {
        user: {
          name: '1706_Abhishek Mallick',
          email: '21051706@kiit.ac.in',
        },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '3rd Year',
      },
      {
        user: {
          name: '730-ISHU KANT',
          email: '22052730@kiit.ac.in',
        },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '2nd Year',
      },
      {
        user: {
          name: '703_SATWIK SINGH',
          email: '21052703@kiit.ac.in',
        },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '3rd Year',
      },
      {
        user: {
          name: '1990_SURYASNATA PAITAL',
          email: '22051990@kiit.ac.in',
        },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '2nd Year',
      },
      {
        user: {
          name: '3612_PRAGYADIPTA PRADHAN',
          email: '22053612@kiit.ac.in',
        },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '2nd Year',
      },
      {
        user: {
          name: '2042_RIDDHIMA BISWAS',
          email: '22052042@kiit.ac.in',
        },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '2nd Year',
      },
      {
        user: {
          name: '2286_SOURODEEP KUNDU',
          email: '21052286@kiit.ac.in',
        },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '3rd Year',
      },
      {
        user: {
          name: '5991_RUNGSHIT SAHA',
          email: '2105991@kiit.ac.in',
        },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '3rd Year',
      },
      {
        user: {
          name: '458 _SWARNADEEP GHOSAL',
          email: '21052458@kiit.ac.in',
        },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '3rd Year',
      },
      {
        user: {
          name: 'VINIT AGARWAL',
          email: '21051275@kiit.ac.in',
        },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '3rd Year',
      },
      {
        user: {
          name: 'AYUSH KUMAR',
          email: '22051065@kiit.ac.in',
        },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '2nd Year',
      },
      {
        user: {
          name: '3450_ Rahul Kumar Gupta',
          email: '21053450@kiit.ac.in',
        },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '3rd Year',
      },
      {
        user: {
          name: '1898_SRINJOY KUNDU',
          email: '22051898@kiit.ac.in',
        },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '2nd Year',
      },
      {
        user: {
          name: '1715_ANUBHUTI PRERNA',
          email: '21051715@kiit.ac.in',
        },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '3rd Year',
      },
      {
        user: {
          name: '386_Kashish',
          email: '2205386@kiit.ac.in',
        },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '2nd Year',
      },
      {
        user: {
          name: '383-MANSHI PRATAP',
          email: '2105383@kiit.ac.in',
        },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '3rd Year',
      },
      {
        user: {
          name: '2648_ANEESHA',
          email: '21052648@kiit.ac.in',
        },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '3rd Year',
      },
      {
        user: {
          name: '1505_SAIM',
          email: '21051505@kiit.ac.in',
        },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '3rd Year',
      },
      {
        user: {
          name: 'AISWARYA AYASKANT',
          email: '22053658@kiit.ac.in',
        },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '2nd Year',
      },
      {
        user: {
          name: 'SUMAN SINGHA',
          email: '2305822@kiit.ac.in',
        },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '1st Year',
      },
      {
        user: {
          name: '5989_RINKESH KUMAR SINHA',
          email: '2105989@kiit.ac.in',
        },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '3rd Year',
      },
      {
        user: {
          name: 'DEBJYOTI SHIT',
          email: '22052978@kiit.ac.in',
        },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '2nd Year',
      },
      {
        user: {
          name: '750_Piyush',
          email: '21051750@kiit.ac.in',
        },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '3rd Year',
      },
      {
        user: {
          name: 'SANJIV KUMAR',
          email: '22054265@kiit.ac.in',
        },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '2nd Year',
      },
      {
        user: {
          name: '073_SRITAM DUTTA',
          email: '2105073@kiit.ac.in',
        },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '3rd Year',
      },
      {
        user: {
          name: '2133_ Adrita Mohanty',
          email: '21052133@kiit.ac.in',
        },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '3rd Year',
      },
      {
        user: {
          name: 'ANIRAN SAHA',
          email: '22053137@kiit.ac.in',
        },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '2nd Year',
      },
      {
        user: {
          name: 'DEEPAYAN DAS',
          email: '2205635@kiit.ac.in',
        },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '2nd Year',
      },
      {
        user: {
          name: '_5935_SHUBAM CHAKRABORTY',
          email: '2205935@kiit.ac.in',
        },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '2nd Year',
      },
      {
        user: {
          name: '3289_MANDIP SAH',
          email: '21053289@kiit.ac.in',
        },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '3rd Year',
      },
      {
        user: {
          name: '2043_ Ritajit Pal',
          email: '22052043@kiit.ac.in',
        },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '2nd Year',
      },
      {
        user: {
          name: '589-MEGHANSH GOVIL',
          email: '22051589@kiit.ac.in',
        },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '2nd Year',
      },
      {
        user: {
          name: '629_MANDIRA GHOSH',
          email: '2105629@kiit.ac.in',
        },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '3rd Year',
      },
      {
        user: {
          name: '4077_Ritesh Sah',
          email: '22054077@kiit.ac.in',
        },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '2nd Year',
      },
      {
        user: {
          name: '1801_ARNAV DEY',
          email: '21051801@kiit.ac.in',
        },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '3rd Year',
      },
      {
        user: {
          name: '3403-AROSREE SATAPATHY',
          email: '22053403@kiit.ac.in',
        },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '2nd Year',
      },
      {
        user: {
          name: '4107 Abhisek Singh',
          email: '22054107@kiit.ac.in',
        },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '2nd Year',
      },
      {
        user: {
          name: '1833_PRANABIT PRADHAN',
          email: '21051833@kiit.ac.in',
        },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '3rd Year',
      },
      {
        user: {
          name: '123_ABHA SRIVASTAVA',
          email: '2128123@kiit.ac.in',
        },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSSE',
        year: '3rd Year',
      },
      {
        user: {
          name: '098 _AhonaGhosh',
          email: '2105098@kiit.ac.in',
        },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '3rd Year',
      },
      {
        user: {
          name: '280_KUMAR YASH MEHUL',
          email: '2105280@kiit.ac.in',
        },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '3rd Year',
      },
      {
        user: {
          name: '072-GYAN PRAKASH DASH',
          email: '2128072@kiit.ac.in',
        },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSSE',
        year: '3rd Year',
      },
      {
        user: {
          name: 'PRAYAG PATRO',
          email: '23051288@kiit.ac.in',
        },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '1st Year',
      },
      {
        user: {
          name: '514_TANYA CHAUDHARY',
          email: '2205514@kiit.ac.in',
        },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '2nd Year',
      },
      {
        user: {
          name: 'KUMAR ANURAG',
          email: '22052907@kiit.ac.in',
        },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '2nd Year',
      },
      {
        user: {
          name: 'SAAKSSHI PODDER',
          email: '23051943@kiit.ac.in',
        },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '1st Year',
      },
      {
        user: {
          name: '3474_UJJAWAL ANAND',
          email: '23053474@kiit.ac.in',
        },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '1st Year',
      },
      {
        user: {
          name: '2386_AKASH DUTTACHOWDHURY',
          email: '21052386@kiit.ac.in',
        },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '3rd Year',
      },
      {
        user: {
          name: '6314_ASHISH PATEL',
          email: '2106314@kiit.ac.in',
        },
        paymentScreenshot: null,
        isActive: false,
        branch: 'IT',
        year: '3rd Year',
      },
      {
        user: {
          name: '4115 - Aadya Sharma',
          email: '22054115@kiit.ac.in',
        },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '2nd Year',
      },
      {
        user: {
          name: '3437_PRIYANKA KUMARI',
          email: '21053437@kiit.ac.in',
        },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '3rd Year',
      },
      {
        user: {
          name: '2164_SUBHAM BERA',
          email: '22052164@kiit.ac.in',
        },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '2nd Year',
      },
      {
        user: {
          name: '2060_SINCHAL KAR',
          email: '22052060@kiit.ac.in',
        },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '4th Year',
      },
      {
        user: {
          name: '6201_RANGIN BERA',
          email: '2206201@kiit.ac.in',
        },
        paymentScreenshot: null,
        isActive: false,
        branch: 'IT',
        year: '2nd Year',
      },
      {
        user: {
          name: '8062_Abhishek D',
          email: '2328062@kiit.ac.in',
        },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSSE',
        year: '1st Year',
      },
      {
        user: {
          name: '533_Sneha Behera',
          email: '21052533@kiit.ac.in',
        },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '3rd Year',
      },
      {
        user: {
          name: 'NILOTPAL BASU',
          email: '22051085@kiit.ac.in',
        },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '2nd Year',
      },
      {
        user: {
          name: '3586-AVINASH PATRA',
          email: '22053586@kiit.ac.in',
        },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '2nd Year',
      },
      {
        user: {
          name: '5469_NAKSHATRA GUPTA',
          email: '2105469@kiit.ac.in',
        },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '3rd Year',
      },
      {
        user: {
          name: '2894_AYUSH RANJAN',
          email: '22052894@kiit.ac.in',
        },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '2nd Year',
      },
      {
        user: {
          name: '145_Arani Maity',
          email: '22053145@kiit.ac.in',
        },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '2nd Year',
      },
      {
        user: {
          name: 'TAMONASH MAJUMDER (22053474)',
          email: '22053474@kiit.ac.in',
        },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '2nd Year',
      },
      {
        user: {
          name: '449 Chaitanya',
          email: '2105449@kiit.ac.in',
        },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '3rd Year',
      },
      {
        user: {
          name: '2365_Siddhartha Mukherjee',
          email: '21052365@kiit.ac.in',
        },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '3rd Year',
      },
      {
        user: {
          name: 'SOUMYA KUMAR',
          email: '22053285@kiit.ac.in',
        },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '2nd Year',
      },
      {
        user: {
          name: '1468_ARVIND KAPHLEY',
          email: '21051468@kiit.ac.in',
        },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '3rd Year',
      },
      {
        user: {
          name: 'PROGYA BHATTACHARJEE',
          email: '22053007@kiit.ac.in',
        },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '2nd Year',
      },
      {
        user: {
          name: '653_SAHIL RAJ SINGH',
          email: '2105653@kiit.ac.in',
        },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '3rd Year',
      },
      {
        user: {
          name: '177_AHELI MANNA',
          email: '2105177@kiit.ac.in',
        },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '3rd Year',
      },
      {
        user: {
          name: '1699 NISCHAY JAIN',
          email: '22051699@kiit.ac.in',
        },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '2nd Year',
      },
      {
        user: {
          name: 'Ansh Kumar Sharma',
          email: '2305114@kiit.ac.in',
        },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '1st Year',
      },
      {
        user: {
          name: '1085_SATYA PRAKASH',
          email: '21051085@kiit.ac.in',
        },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '3rd Year',
      },
      {
        user: {
          name: '270_AYUSHI MOHANTY',
          email: '2105270@kiit.ac.in',
        },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '3rd Year',
      },
      {
        user: {
          name: '4403ROHIT SHARMA',
          email: '22054403@kiit.ac.in',
        },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '4th Year',
      },
      {
        user: {
          name: '2332KUNAL KUMAR',
          email: '21052332@kiit.ac.in',
        },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '3rd Year',
      },
      {
        user: {
          name: '3363 KHUSHI',
          email: '21053363@kiit.ac.in',
        },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '3rd Year',
      },
      {
        user: {
          name: '534_AYUSH BISWAL',
          email: '2105534@kiit.ac.in',
        },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '3rd Year',
      },
      {
        user: {
          name: '471_NAMRATA MAHAPATRA',
          email: '2105471@kiit.ac.in',
        },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '3rd Year',
      },
      {
        user: {
          name: '5940_ADARSH TIWARI',
          email: '2105940@kiit.ac.in',
        },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '3rd Year',
      },
      {
        user: {
          name: '8030_NAYNIKA SARKAR',
          email: '2128030@kiit.ac.in',
        },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSCE',
        year: '3rd Year',
      },
      {
        user: {
          name: '3641 _SOURAV MALLICK',
          email: '22053641@kiit.ac.in',
        },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '2nd Year',
      },
      {
        user: {
          name: '1008_SAHASRANSHU SHASTRI',
          email: '22051008@kiit.ac.in',
        },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '2nd Year',
      },
      {
        user: {
          name: 'ARKOPRAVO DE',
          email: '22051755@kiit.ac.in',
        },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '2nd Year',
      },
      {
        user: {
          name: '356_Niladri Nag',
          email: '2206356@kiit.ac.in',
        },
        paymentScreenshot: null,
        isActive: false,
        branch: 'IT',
        year: '2nd Year',
      },
      {
        user: {
          name: '4149 POORVI SINGH',
          email: '22054149@kiit.ac.in',
        },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '2nd Year',
      },
      {
        user: {
          name: '301_Deblina',
          email: '21051301@kiit.ac.in',
        },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '3rd Year',
      },
      {
        user: {
          name: '785-YUVRAJ SINGH',
          email: '21051785@kiit.ac.in',
        },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '3rd Year',
      },
      {
        user: {
          name: '1368 _ Ahana Datta',
          email: '21051368@kiit.ac.in',
        },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '3rd Year',
      },
      {
        user: {
          name: '6274_Ujjwal Pratap Singh',
          email: '2106274@kiit.ac.in',
        },
        paymentScreenshot: null,
        isActive: false,
        branch: 'IT',
        year: '3rd Year',
      },
      {
        user: {
          name: '4347_Dipesh NAYAK',
          email: '22054347@kiit.ac.in',
        },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '2nd Year',
      },
      {
        user: {
          name: '70 Tanishq',
          email: '22051470@kiit.ac.in',
        },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '2nd Year',
      },
      {
        user: {
          name: '476_ANISH SINHA',
          email: '21052476@kiit.ac.in',
        },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '3rd Year',
      },
      {
        user: {
          name: 'SOUMILI DAS',
          email: '22052065@kiit.ac.in',
        },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '2nd Year',
      },
      {
        user: {
          name: '677_Mohnish Mishra',
          email: '21052677@kiit.ac.in',
        },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '3rd Year',
      },
      {
        user: {
          name: '526_SAMANGYA NAYAK',
          email: '21052526@kiit.ac.in',
        },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '3rd Year',
      },
      {
        user: {
          name: '2715_ARYAN RAJ CHOUDHURY',
          email: '22052715@kiit.ac.in',
        },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '2nd Year',
      },
      {
        user: {
          name: '032 HARSH SINGH',
          email: '2106032@kiit.ac.in',
        },
        paymentScreenshot: null,
        isActive: false,
        branch: 'IT',
        year: '3rd Year',
      },
      {
        user: {
          name: '8168-SubhamMohanty',
          email: '2228168@kiit.ac.in',
        },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSSE',
        year: '3rd Year',
      },
      {
        user: {
          name: '3455_sanjay sah',
          email: '21053455@kiit.ac.in',
        },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '3rd Year',
      },
      {
        user: {
          name: '3408_Pramity Majumder',
          email: '23053408@kiit.ac.in',
        },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '1st Year',
      },
      {
        user: {
          name: '3151_Ayush Kumar',
          email: '22053151@kiit.ac.in',
        },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '2nd Year',
      },
      {
        user: {
          name: 'AMITAV MOHANTY',
          email: '22053923@kiit.ac.in',
        },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '4th Year',
      },
      {
        user: {
          name: '057_Arpita P',
          email: '2129057@kiit.ac.in',
        },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSCE',
        year: '3rd Year',
      },
      {
        user: {
          name: 'HARSHIT',
          email: '2205039@kiit.ac.in',
        },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '2nd Year',
      },
      {
        user: {
          name: '825_SAUMY',
          email: '2105825@kiit.ac.in',
        },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '3rd Year',
      },
      {
        user: {
          name: '268_ AVANI',
          email: '2105268@kiit.ac.in',
        },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '3rd Year',
      },
      {
        user: {
          name: '770 SRIJAN MUKHERJEE',
          email: '21051770@kiit.ac.in',
        },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '3rd Year',
      },
      {
        user: {
          name: '5885_Gourav Chatterjee',
          email: '2105885@kiit.ac.in',
        },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '3rd Year',
      },
      {
        user: {
          name: '4124 BABLI SAHU',
          email: '22054124@kiit.ac.in',
        },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '2nd Year',
      },
      {
        user: {
          name: '059_ RUDRANSH MISHRA',
          email: '2105059@kiit.ac.in',
        },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '3rd Year',
      },
      {
        user: {
          name: '337_abhay',
          email: '2105337@kiit.ac.in',
        },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '3rd Year',
      },
      {
        user: {
          name: '634_OM SINGH',
          email: '2105634@kiit.ac.in',
        },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '3rd Year',
      },
      {
        user: {
          name: '645_ADYASHA PATI',
          email: '21052645@kiit.ac.in',
        },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '3rd Year',
      },
      {
        user: {
          name: '334_SRISHTI JAISWAL',
          email: '2205334@kiit.ac.in',
        },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '2nd Year',
      },
      {
        user: {
          name: 'HARSH SANKRIT',
          email: '22051075@kiit.ac.in',
        },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '2nd Year',
      },
      {
        user: {
          name: '571_ADHYAN AGRAWAL',
          email: '21051571@kiit.ac.in',
        },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '3rd Year',
      },
      {
        user: {
          name: '8147_Shrinkhala Kumari',
          email: '2228147@kiit.ac.in',
        },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSSE',
        year: '2nd Year',
      },
      {
        user: {
          name: '2110_SOUMYA RANJAN BEHERA',
          email: '21052110@kiit.ac.in',
        },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '3rd Year',
      },
      {
        user: {
          name: '9062_SAYAN BANERJEE',
          email: '2229062@kiit.ac.in',
        },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSCE',
        year: '2nd Year',
      },
      {
        user: {
          name: '506_SHOVIN BARIK',
          email: '2205506@kiit.ac.in',
        },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '2nd Year',
      },
      {
        user: {
          name: '018_ARITRA MUHURI',
          email: '2105018@kiit.ac.in',
        },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '3rd Year',
      },
      {
        user: {
          name: '1525_MAYUKH PATTANAYAK',
          email: '22051525@kiit.ac.in',
        },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '2nd Year',
      },
      {
        user: {
          name: 'RAMAN KURMI',
          email: '2306384@kiit.ac.in',
        },
        paymentScreenshot: null,
        isActive: false,
        branch: 'IT',
        year: '1st Year',
      },
      {
        user: {
          name: '3283_JITENDRA KUMAR MANDAL',
          email: '21053283@kiit.ac.in',
        },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '3rd Year',
      },
      {
        user: {
          name: 'Ranjit Das',
          email: '21053420@kiit.ac.in',
        },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '3rd Year',
      },
      {
        user: {
          name: '1006_ SHIVANGI',
          email: '21051006@kiit.ac.in',
        },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '3rd Year',
      },
      {
        user: {
          name: 'SOVIK BURMA',
          email: '23052438@kiit.ac.in',
        },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '1st Year',
      },
      {
        user: {
          name: '490_BHAVYA KUMARI',
          email: '21052490@kiit.ac.in',
        },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '3rd Year',
      },
      {
        user: {
          name: '690_Amit Kumar Yadav',
          email: '2105690@kiit.ac.in',
        },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '3rd Year',
      },
      {
        user: {
          name: '2339',
          email: '21052339@kiit.ac.in',
        },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '3rd Year',
      },
      {
        user: {
          name: 'SOUNAK DUTTA',
          email: '22052684@kiit.ac.in',
        },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '2nd Year',
      },
      {
        user: {
          name: '316_ SAGAR MAHATO',
          email: '21053316@kiit.ac.in',
        },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '3rd Year',
      },
      {
        user: {
          name: '3247_ROHIT RAJ',
          email: '21053247@kiit.ac.in',
        },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '3rd Year',
      },
      {
        user: {
          name: 'AARUSH AMBAR',
          email: '22051479@kiit.ac.in',
        },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '2nd Year',
      },
      {
        user: {
          name: '130_Kanishk',
          email: '2205130@kiit.ac.in',
        },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '2nd Year',
      },
      {
        user: {
          name: '670_SNEHAN SAHOO',
          email: '2105670@kiit.ac.in',
        },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '3rd Year',
      },
      {
        user: {
          name: '467_AAMOGHA BILLORE',
          email: '21052467@kiit.ac.in',
        },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '3rd Year',
      },
      {
        user: {
          name: '2375_SWATI SUMAN SAHU',
          email: '21052375@kiit.ac.in',
        },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '3rd Year',
      },
      {
        user: {
          name: '2429_UTKARSH NIGAM',
          email: '22052429@kiit.ac.in',
        },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '2nd Year',
      },
      {
        user: {
          name: 'VIKRAM KUMAR',
          email: '22054001@kiit.ac.in',
        },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '2nd Year',
      },
      {
        user: {
          name: '4051_Madan Pandey',
          email: '22054051@kiit.ac.in',
        },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '2nd Year',
      },
      {
        user: {
          name: '288_Nikhil Das',
          email: '2105288@kiit.ac.in',
        },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '3rd Year',
      },
      {
        user: {
          name: '5757_PARIDA PRATYUS SRIMAYSIS',
          email: '2205757@kiit.ac.in',
        },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '2nd Year',
      },
      {
        user: {
          name: '497_SIBASISH DUTTA',
          email: '2105497@kiit.ac.in',
        },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '3rd Year',
      },
      {
        user: {
          name: '2759_GOURAV CHAKRABORTY',
          email: '21052759@kiit.ac.in',
        },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '3rd Year',
      },
      {
        user: {
          name: '501_GAUTAM SINHA',
          email: '21052501@kiit.ac.in',
        },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '3rd Year',
      },
      {
        user: {
          name: '6073_SUDIP MONDAL',
          email: '2106073@kiit.ac.in',
        },
        paymentScreenshot: null,
        isActive: false,
        branch: 'IT',
        year: '3rd Year',
      },
      {
        user: {
          name: '2198_Souhardya Rakshit',
          email: '21052198@kiit.ac.in',
        },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '3rd Year',
      },
      {
        user: {
          name: '1807_ BHAGWANT',
          email: '21051807@kiit.ac.in',
        },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '3rd Year',
      },
      {
        user: {
          name: '1067_NIMISHA MOHANTA',
          email: '21051067@kiit.ac.in',
        },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '3rd Year',
      },
    ];
    try {
      for (const user of users) {
        await this.mailService.sendPaymentReminder({
          email: user.user.email,
          name: user.user.name,
          branch: user.branch,
          year: user.year,
        });

        const u = await new Promise((resolve) => {
          setTimeout(() => {
            resolve(`send Success ${user.user.name} ${user.user.email}`);
          }, 2000);
        });
        console.log(u);
      }
    } catch (error) {
      console.log(error);
    }
  }

  async getUserWithoutPremiumAccount() {
    try {
      const users = await this.prisma.user.findMany({
        where: {
          isPremium: false,
          PremiumMember: undefined,
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
        name: 'JAGAJIT DAS',
        email: '22053600@kiit.ac.in',
      },
      {
        name: '068_Nishant Kumar',
        email: '21051068@kiit.ac.in',
      },
      {
        name: '43_ANSHUMAN SAHOO',
        email: '2130043@kiit.ac.in',
      },
      {
        name: '1427_SHIVPREET PADHI',
        email: '21051427@kiit.ac.in',
      },
      {
        name: '018_ARITRA MUHURI',
        email: '2105018@kiit.ac.in',
      },
      {
        name: 'NIKHIL SINGH',
        email: '2229131@kiit.ac.in',
      },
      {
        name: 'ARMAAN PANDEY',
        email: '2205716@kiit.ac.in',
      },
      {
        name: '2775_OM PATEL',
        email: '21052775@kiit.ac.in',
      },
      {
        name: 'NITESH PATNAIK',
        email: '2206357@kiit.ac.in',
      },
      {
        name: '214 PIYUSH KUMAR',
        email: '21053214@kiit.ac.in',
      },
      {
        name: '3422_KRISHNA SHAH',
        email: '21053422@kiit.ac.in',
      },
      {
        name: '2232_Anshuman',
        email: '21052232@kiit.ac.in',
      },
      {
        name: '2866_SAMRIDDHI SHARMA',
        email: '21052866@kiit.ac.in',
      },
      {
        name: '586_Gourab Baroi',
        email: '21052586@kiit.ac.in',
      },
      {
        name: 'SREEJA UPADHYAYA',
        email: '23057051@kiit.ac.in',
      },
      {
        name: '710 ADRIJA DAS',
        email: '21051710@kiit.ac.in',
      },
      {
        name: '465_YASH PRATAP SINGH',
        email: '21052465@kiit.ac.in',
      },
      {
        name: '107_Anushka Bajpai',
        email: '2205107@kiit.ac.in',
      },
      {
        name: '1423_SAMRAT CHAKRABORTY',
        email: '21051423@kiit.ac.in',
      },
      {
        name: '4098 U T K A R S H',
        email: '22054098@kiit.ac.in',
      },
      {
        name: '5950_ARIN CHOUDHARY',
        email: '2105950@kiit.ac.in',
      },
      {
        name: '2830 DEBANGAN BHATTACHARYYA',
        email: '21052830@kiit.ac.in',
      },
      {
        name: '319_SARTHAK AGARWAL',
        email: '2106319@kiit.ac.in',
      },
      {
        name: '8062_Abhishek D',
        email: '2328062@kiit.ac.in',
      },
      {
        name: '533_Sneha Behera',
        email: '21052533@kiit.ac.in',
      },
      {
        name: 'NILOTPAL BASU',
        email: '22051085@kiit.ac.in',
      },
      {
        name: '9140_RAHUL _BAGARIA',
        email: '2129140@kiit.ac.in',
      },
      {
        name: '1590_sadaf Shahab',
        email: '21051590@kiit.ac.in',
      },
      {
        name: '5524_ANJALI BALI',
        email: '2105524@kiit.ac.in',
      },
      {
        name: '1529_ DEEPESH REDDY',
        email: '21051529@kiit.ac.in',
      },
      {
        name: '3586-AVINASH PATRA',
        email: '22053586@kiit.ac.in',
      },
      {
        name: '5469_NAKSHATRA GUPTA',
        email: '2105469@kiit.ac.in',
      },
      {
        name: '362 AYUSH KASHYAP',
        email: '2105362@kiit.ac.in',
      },
      {
        name: 'Vertika Sharma',
        email: '2229081@kiit.ac.in',
      },
      {
        name: '4312_GIRIKNT M RAI',
        email: '22054312@kiit.ac.in',
      },
      {
        name: '2894_AYUSH RANJAN',
        email: '22052894@kiit.ac.in',
      },
      {
        name: '717 ASMITA GHOSH',
        email: '22052717@kiit.ac.in',
      },
      {
        name: '1794 AIMAN HASIB',
        email: '21051794@kiit.ac.in',
      },
      {
        name: '4321_BHUSHAN SAH',
        email: '22054321@kiit.ac.in',
      },
      {
        name: '1260 MARYADA RAY',
        email: '22051260@kiit.ac.in',
      },
      {
        name: '057_Arpita P',
        email: '2129057@kiit.ac.in',
      },
      {
        name: '389_Shiv Raut',
        email: '21053389@kiit.ac.in',
      },
      {
        name: '290_SHRAVAN YADAV',
        email: '2230290@kiit.ac.in',
      },
      {
        name: '457_Amit_Raj',
        email: '21051457@kiit.ac.in',
      },
      {
        name: 'ADITYA SINGH',
        email: '22053220@kiit.ac.in',
      },
      {
        name: '9098_sanya sonu',
        email: '2129098@kiit.ac.in',
      },
      {
        name: '2401_ Sachin Kumar',
        email: '22052401@kiit.ac.in',
      },
      {
        name: '589_SAPTARSHI DUTTA',
        email: '21052589@kiit.ac.in',
      },
      {
        name: 'TAMONASH MAJUMDER (22053474)',
        email: '22053474@kiit.ac.in',
      },
      {
        name: '1346_Srishti Jha',
        email: '21051346@kiit.ac.in',
      },
      {
        name: 'ADITYA TULSYAN',
        email: '22052962@kiit.ac.in',
      },
      {
        name: 'SRISTI SAHA',
        email: '23052763@kiit.ac.in',
      },
      {
        name: '122_BHOOMIKA GARG',
        email: '2205122@kiit.ac.in',
      },
      {
        name: '284_ARNAV PRIYADRSHI',
        email: '22052284@kiit.ac.in',
      },
      {
        name: '008_ ADITI SINGH',
        email: '2129008@kiit.ac.in',
      },
      {
        name: '276_INDRANUJ GHOSH',
        email: '2105276@kiit.ac.in',
      },
      {
        name: '3715 SANDEEP SAHOO',
        email: '22053715@kiit.ac.in',
      },
      {
        name: '1313_ Loyna',
        email: '21051313@kiit.ac.in',
      },
      {
        name: '2132_PRATEEK DASH',
        email: '22052132@kiit.ac.in',
      },
      {
        name: '1867_VISHAL KUMAR',
        email: '21051867@kiit.ac.in',
      },
      {
        name: '1016_Ritika Rani',
        email: '21051016@kiit.ac.in',
      },
      {
        name: '807_ NEHA BAJPAYEE',
        email: '2105807@kiit.ac.in',
      },
      {
        name: '473_ AKANKSHYA PARIDA',
        email: '21052473@kiit.ac.in',
      },
      {
        name: 'SAKSHAM',
        email: '22054196@kiit.ac.in',
      },
      {
        name: '6079 Tushar Bhattacharya',
        email: '2106079@kiit.ac.in',
      },
      {
        name: '2365_Siddhartha Mukherjee',
        email: '21052365@kiit.ac.in',
      },
      {
        name: '546_TUSHAR TEOTIA',
        email: '21052546@kiit.ac.in',
      },
      {
        name: '4126_Shithan Ghosh',
        email: '2204126@kiit.ac.in',
      },
      {
        name: '733_RISHAV PANDEY',
        email: '2105733@kiit.ac.in',
      },
      {
        name: '420 TANISHA SAINI',
        email: '2105420@kiit.ac.in',
      },
      {
        name: '1468_ARVIND KAPHLEY',
        email: '21051468@kiit.ac.in',
      },
      {
        name: 'AMLAN TANU DEY',
        email: '2302087@kiit.ac.in',
      },
      {
        name: 'TULSI BASETTI',
        email: '22051814@kiit.ac.in',
      },
      {
        name: 'VED PRAKASH',
        email: '22054253@kiit.ac.in',
      },
      {
        name: '579_Rishabh Raj',
        email: '2205579@kiit.ac.in',
      },
      {
        name: '2932_VIDYUN AGARWAL',
        email: '21052932@kiit.ac.in',
      },
      {
        name: '5945_Shourya Raj',
        email: '2105945@kiit.ac.in',
      },
      {
        name: '2121 TEJAS BINU',
        email: '21052121@kiit.ac.in',
      },
      {
        name: 'PROGYA BHATTACHARJEE',
        email: '22053007@kiit.ac.in',
      },
      {
        name: '6296_Raunit Raj',
        email: '2106296@kiit.ac.in',
      },
      {
        name: '048_PRAGYNASMITA SAHOO',
        email: '2105048@kiit.ac.in',
      },
      {
        name: '1461_ANKIT KUMAR JENA',
        email: '21051461@kiit.ac.in',
      },
      {
        name: '2338_NAYEER NAUSHAD',
        email: '21052338@kiit.ac.in',
      },
      {
        name: 'BIKASH YADAV',
        email: '23053484@kiit.ac.in',
      },
      {
        name: '174_PRATEEK KUMAR',
        email: '2330174@kiit.ac.in',
      },
      {
        name: '2597-SNEHA GUHA',
        email: '23052597@kiit.ac.in',
      },
      {
        name: '1467_Subrat Dash',
        email: '22051467@kiit.ac.in',
      },
      {
        name: '2658_DEBARKA CHAKRABORTI',
        email: '21052658@kiit.ac.in',
      },
      {
        name: 'SOHAM GIRI',
        email: '23051542@kiit.ac.in',
      },
      {
        name: '1018_SATYAM SANJEEV',
        email: '22051018@kiit.ac.in',
      },
      {
        name: '5702 Harshit Belwal',
        email: '2305702@kiit.ac.in',
      },
      {
        name: 'Mohit Sharma',
        email: '21052676@kiit.ac.in',
      },
      {
        name: 'DEBADRI BANERJEE',
        email: '2205894@kiit.ac.in',
      },
      {
        name: '184_SAIKAT SAHA',
        email: '22053184@kiit.ac.in',
      },
      {
        name: 'AASTHA KUMARI',
        email: '22054221@kiit.ac.in',
      },
      {
        name: 'HIRENDRA CHAURASIYA',
        email: '23053666@kiit.ac.in',
      },
      {
        name: '434_ZAKI MOHAMMAD MAHFOOZ',
        email: '2205434@kiit.ac.in',
      },
      {
        name: 'AAYUSH BHARUKA',
        email: '2205002@kiit.ac.in',
      },
      {
        name: '653_SAHIL RAJ SINGH',
        email: '2105653@kiit.ac.in',
      },
      {
        name: 'SARTHAK DASH (22053538)',
        email: '22053538@kiit.ac.in',
      },
      {
        name: '2001_KHUSHI KUMARI',
        email: '21052001@kiit.ac.in',
      },
      {
        name: '412_SPARSH CHAUDHARY',
        email: '2105412@kiit.ac.in',
      },
      {
        name: '2878_SMRUTI PRIYA ROUT',
        email: '21052878@kiit.ac.in',
      },
      {
        name: '1954_Vasu Bhardwaj',
        email: '21051954@kiit.ac.in',
      },
      {
        name: '2406_ATIKA CHANDEL',
        email: '21052406@kiit.ac.in',
      },
      {
        name: '632_Uditaa Garg',
        email: '21052632@kiit.ac.in',
      },
      {
        name: 'ANANT TIWARY',
        email: '23057006@kiit.ac.in',
      },
      {
        name: '177_AHELI MANNA',
        email: '2105177@kiit.ac.in',
      },
      {
        name: '072_JanviSingh',
        email: '2129072@kiit.ac.in',
      },
      {
        name: 'MOHIT KUMAR',
        email: '22052829@kiit.ac.in',
      },
      {
        name: '2790_ CSE',
        email: '21052790@kiit.ac.in',
      },
      {
        name: '1699 NISCHAY JAIN',
        email: '22051699@kiit.ac.in',
      },
      {
        name: 'Ansh Kumar Sharma',
        email: '2305114@kiit.ac.in',
      },
      {
        name: 'SHIVANI SETHI',
        email: '23051952@kiit.ac.in',
      },
      {
        name: 'SARTHAK SHARMA',
        email: '22054207@kiit.ac.in',
      },
      {
        name: '3280_Dinesh Paudel',
        email: '21053280@kiit.ac.in',
      },
      {
        name: '496_RUHANI BOSE',
        email: '2205496@kiit.ac.in',
      },
      {
        name: '1133_ADITYA PRABHU',
        email: '22051133@kiit.ac.in',
      },
      {
        name: '270_AYUSHI MOHANTY',
        email: '2105270@kiit.ac.in',
      },
      {
        name: '180_RAJESHWARI CHOUDHURY',
        email: '22053180@kiit.ac.in',
      },
      {
        name: '4403ROHIT SHARMA',
        email: '22054403@kiit.ac.in',
      },
      {
        name: '70 Tanishq',
        email: '22051470@kiit.ac.in',
      },
      {
        name: '2834_Dev Karan Pattnayak',
        email: '21052834@kiit.ac.in',
      },
      {
        name: '2332KUNAL KUMAR',
        email: '21052332@kiit.ac.in',
      },
      {
        name: '2882_Sriansh Raj Pradhan',
        email: '21052882@kiit.ac.in',
      },
      {
        name: '5895_Jayanti Goswami',
        email: '2105895@kiit.ac.in',
      },
      {
        name: '546_JAGANNATH MONDAL',
        email: '2105546@kiit.ac.in',
      },
      {
        name: '356_Anishka',
        email: '2205356@kiit.ac.in',
      },
      {
        name: '4104_Subham Luitel',
        email: '22054104@kiit.ac.in',
      },
      {
        name: '4206_Brejesh koushal',
        email: '22054206@kiit.ac.in',
      },
      {
        name: '021_ARYAN DEO',
        email: '2105021@kiit.ac.in',
      },
      {
        name: '232_Pranav Varshney',
        email: '21051232@kiit.ac.in',
      },
      {
        name: '603_ NIHARIKA RAGHAV',
        email: '21052603@kiit.ac.in',
      },
      {
        name: '5122_AYUSH RAJ',
        email: '2305122@kiit.ac.in',
      },
      {
        name: 'MSC ARUNOPAL DUTTA',
        email: '21051549@kiit.ac.in',
      },
      {
        name: '403_ASHISH AMAN',
        email: '21052403@kiit.ac.in',
      },
      {
        name: '501_RISHAV DEO',
        email: '21051501@kiit.ac.in',
      },
      {
        name: 'RAHUL KUMAR',
        email: '2105731@kiit.ac.in',
      },
      {
        name: 'AYUSH KUMAR RANA',
        email: '21052317@kiit.ac.in',
      },
      {
        name: '1449_ABHISHEK KUMAR TIWARI',
        email: '21051449@kiit.ac.in',
      },
      {
        name: '1651_A Suchit',
        email: '22051651@kiit.ac.in',
      },
      {
        name: '1411_NISHU KUMARI RAY',
        email: '21051411@kiit.ac.in',
      },
      {
        name: '5844_TANYA SINGH',
        email: '2105844@kiit.ac.in',
      },
      {
        name: 'MD HASNAIN',
        email: '22052910@kiit.ac.in',
      },
      {
        name: 'NAVNEET KUMAR',
        email: '2206275@kiit.ac.in',
      },
      {
        name: '2387_AKASH CHAUDHARI',
        email: '21052387@kiit.ac.in',
      },
      {
        name: '433_ADITI SINGH ROY',
        email: '2105433@kiit.ac.in',
      },
      {
        name: '3151_Ayush Kumar',
        email: '22053151@kiit.ac.in',
      },
      {
        name: '2860 _Riddhima',
        email: '21052860@kiit.ac.in',
      },
      {
        name: '534_AYUSH BISWAL',
        email: '2105534@kiit.ac.in',
      },
      {
        name: '2255 _Tanisha Basu',
        email: '22052255@kiit.ac.in',
      },
      {
        name: '91_VAASHKAR PAUL',
        email: '2130091@kiit.ac.in',
      },
      {
        name: 'RHITURAJ DATTA',
        email: '22053341@kiit.ac.in',
      },
      {
        name: '471_NAMRATA MAHAPATRA',
        email: '2105471@kiit.ac.in',
      },
      {
        name: '282_MANAN GARG',
        email: '2105282@kiit.ac.in',
      },
      {
        name: 'Subhransu Sahoo',
        email: '22053903@kiit.ac.in',
      },
      {
        name: '092_AKASH PRASAD',
        email: '2205092@kiit.ac.in',
      },
      {
        name: '3376_AHMAT SENOUSSI',
        email: '21053376@kiit.ac.in',
      },
      {
        name: '5940_ADARSH TIWARI',
        email: '2105940@kiit.ac.in',
      },
      {
        name: '476_ANISH SINHA',
        email: '21052476@kiit.ac.in',
      },
      {
        name: '8030_NAYNIKA SARKAR',
        email: '2128030@kiit.ac.in',
      },
      {
        name: '1686_Shobhit Verma',
        email: '21051686@kiit.ac.in',
      },
      {
        name: '1282_SHRUTI SINHA',
        email: '22051282@kiit.ac.in',
      },
      {
        name: '1289_ARINDAM KANRAR',
        email: '21051289@kiit.ac.in',
      },
      {
        name: '029_DIVYA SWAROOP DASH',
        email: '2105029@kiit.ac.in',
      },
      {
        name: '673-LAGNAJEET MOHANTY',
        email: '21052673@kiit.ac.in',
      },
      {
        name: '3641 _SOURAV MALLICK',
        email: '22053641@kiit.ac.in',
      },
      {
        name: '1008_SAHASRANSHU SHASTRI',
        email: '22051008@kiit.ac.in',
      },
      {
        name: 'Harsh Agrawalla',
        email: '2230171@kiit.ac.in',
      },
      {
        name: '2654_SANAM SAHU',
        email: '21052654@kiit.ac.in',
      },
      {
        name: '3409_MICHAEL MWENYA CHILESHE',
        email: '21053409@kiit.ac.in',
      },
      {
        name: '4050_Kunal Kewat',
        email: '22054050@kiit.ac.in',
      },
      {
        name: '5541_Devansh Kumar',
        email: '2105541@kiit.ac.in',
      },
      {
        name: 'HARSH AGARWAL',
        email: '2205642@kiit.ac.in',
      },
      {
        name: '1119_UDDIPAN KALITA',
        email: '22051119@kiit.ac.in',
      },
      {
        name: '1096-SUCHARITA MOHAPATRA',
        email: '21051096@kiit.ac.in',
      },
      {
        name: '8018_Devangi Bhattacharjee',
        email: '2128018@kiit.ac.in',
      },
      {
        name: '5980_PRASANNA SAHOO',
        email: '2105980@kiit.ac.in',
      },
      {
        name: 'SATYAKI DAS',
        email: '22053718@kiit.ac.in',
      },
      {
        name: 'SAISAGAR SAHUKAR (22053535)',
        email: '22053535@kiit.ac.in',
      },
      {
        name: 'MOHAMMAD SAHIL',
        email: '23051681@kiit.ac.in',
      },
      {
        name: '356_Niladri Nag',
        email: '2206356@kiit.ac.in',
      },
      {
        name: '5030 DEVANSH SINGH',
        email: '2205030@kiit.ac.in',
      },
      {
        name: '4149 POORVI SINGH',
        email: '22054149@kiit.ac.in',
      },
      {
        name: '2813_ANUSHKA PRIYADARSHINI',
        email: '21052813@kiit.ac.in',
      },
      {
        name: '196_SOHAM SANTRA',
        email: '2330196@kiit.ac.in',
      },
      {
        name: 'AAYUSH SINGH',
        email: '23053595@kiit.ac.in',
      },
      {
        name: '455_ASHISH KUMAR GUPTA',
        email: '2205455@kiit.ac.in',
      },
      {
        name: '301_Deblina',
        email: '21051301@kiit.ac.in',
      },
      {
        name: 'VIVEK SINGH (22052868)',
        email: '22052868@kiit.ac.in',
      },
      {
        name: '321Jagriti SINGH',
        email: '2105321@kiit.ac.in',
      },
      {
        name: '2822_ ASHUTOSH JHA',
        email: '21052822@kiit.ac.in',
      },
      {
        name: 'DEBRUP SENGUPTA',
        email: '23051017@kiit.ac.in',
      },
      {
        name: '7006_AISHWARYA MOHANTY',
        email: '22057006@kiit.ac.in',
      },
      {
        name: '232_Rishita',
        email: '2205232@kiit.ac.in',
      },
      {
        name: '1686 KANIKA SINGH',
        email: '22051686@kiit.ac.in',
      },
      {
        name: 'CHANDRA SHEKHAR MAHTO',
        email: '22057081@kiit.ac.in',
      },
      {
        name: '6185_ANIMESH ANAND',
        email: '2106185@kiit.ac.in',
      },
      {
        name: '316_ SAGAR MAHATO',
        email: '21053316@kiit.ac.in',
      },
      {
        name: '785-YUVRAJ SINGH',
        email: '21051785@kiit.ac.in',
      },
      {
        name: '120_SHASHANK',
        email: '2129120@kiit.ac.in',
      },
      {
        name: '1368 _ Ahana Datta',
        email: '21051368@kiit.ac.in',
      },
      {
        name: 'RISHAV CHANDA',
        email: '2105912@kiit.ac.in',
      },
      {
        name: '2374_Swati Das',
        email: '21052374@kiit.ac.in',
      },
      {
        name: '2123_Vaibhav Yadav',
        email: '21052123@kiit.ac.in',
      },
      {
        name: '2010 Prateek',
        email: '21052010@kiit.ac.in',
      },
      {
        name: '6274_Ujjwal Pratap Singh',
        email: '2106274@kiit.ac.in',
      },
      {
        name: '4347_Dipesh NAYAK',
        email: '22054347@kiit.ac.in',
      },
      {
        name: '381_sudhir Jaiswal',
        email: '21053381@kiit.ac.in',
      },
      {
        name: '875_BAISHNABI PARIDA',
        email: '2105875@kiit.ac.in',
      },
      {
        name: '2344_PRIYANSHU MIDHA',
        email: '21052344@kiit.ac.in',
      },
      {
        name: '2094_Rupsa Mukhopadhyay',
        email: '21052094@kiit.ac.in',
      },
      {
        name: 'SHIVANGI SHARMA',
        email: '2229066@kiit.ac.in',
      },
      {
        name: '5148 _SANJEEV CHOUBEY',
        email: '2105148@kiit.ac.in',
      },
      {
        name: 'DIYA DEY',
        email: '2305008@kiit.ac.in',
      },
      {
        name: '2279_Shubham Mandal',
        email: '21052279@kiit.ac.in',
      },
      {
        name: '3439_PRASANNA DHUNGANA',
        email: '21053439@kiit.ac.in',
      },
      {
        name: 'SOUMILI DAS',
        email: '22052065@kiit.ac.in',
      },
      {
        name: '677_Mohnish Mishra',
        email: '21052677@kiit.ac.in',
      },
      {
        name: 'PRANJAL AGRAWAL',
        email: '22051868@kiit.ac.in',
      },
      {
        name: '296_ABHIGYAN ADITYA',
        email: '2105296@kiit.ac.in',
      },
      {
        name: '666_ Himanshu Sekhar Nayak',
        email: '21052666@kiit.ac.in',
      },
      {
        name: '593_Jatin bansal',
        email: '21052593@kiit.ac.in',
      },
      {
        name: '324_Soumya Ranjan Pradhan',
        email: '2230324@kiit.ac.in',
      },
      {
        name: '113_DIBYAJYOTI CHAKRAVARTI',
        email: '2106113@kiit.ac.in',
      },
      {
        name: 'KUMAR ARYAN (22053520)',
        email: '22053520@kiit.ac.in',
      },
      {
        name: '1831_AHANA DATTA',
        email: '22051831@kiit.ac.in',
      },
      {
        name: '2422_JATIN PATHAK',
        email: '21052422@kiit.ac.in',
      },
      {
        name: 'NIRAJ JHA',
        email: '23053838@kiit.ac.in',
      },
      {
        name: '2238_RIYA RAJ',
        email: '21052238@kiit.ac.in',
      },
      {
        name: 'NAMAN SHUKLA',
        email: '2205908@kiit.ac.in',
      },
      {
        name: '1532_PRIYANKA SANYAL',
        email: '22051532@kiit.ac.in',
      },
      {
        name: '096_Antarin',
        email: '2106096@kiit.ac.in',
      },
      {
        name: '3301_NITU KARMAKAR',
        email: '21053301@kiit.ac.in',
      },
      {
        name: '2715_ARYAN RAJ CHOUDHURY',
        email: '22052715@kiit.ac.in',
      },
      {
        name: 'Chaman Kumar (2105789)',
        email: '2105789@kiit.ac.in',
      },
      {
        name: '2842_Kumar Harsh',
        email: '21052842@kiit.ac.in',
      },
      {
        name: 'RAJ SHEKHAR',
        email: '22052575@kiit.ac.in',
      },
      {
        name: '1903_KUMAR UTSAV',
        email: '21051903@kiit.ac.in',
      },
      {
        name: '1601_SOUMYAJIT ROY',
        email: '21051601@kiit.ac.in',
      },
      {
        name: '337 NIKHIL kUMAR',
        email: '21053337@kiit.ac.in',
      },
      {
        name: '541_SURYAYAN MUKHOPADHYAY',
        email: '21052541@kiit.ac.in',
      },
      {
        name: '032 HARSH SINGH',
        email: '2106032@kiit.ac.in',
      },
      {
        name: '353_AMISHA KUMARI',
        email: '2105353@kiit.ac.in',
      },
      {
        name: '2971_KRITIKA GAUR',
        email: '23052971@kiit.ac.in',
      },
      {
        name: '8168-SubhamMohanty',
        email: '2228168@kiit.ac.in',
      },
      {
        name: '053_UTKARSH SRIVASTAVA',
        email: '2230053@kiit.ac.in',
      },
      {
        name: 'AADI RATN',
        email: '23051560@kiit.ac.in',
      },
      {
        name: '1862_Khushi Deshwal',
        email: '22051862@kiit.ac.in',
      },
      {
        name: '1709 PRAVEER',
        email: '22051709@kiit.ac.in',
      },
      {
        name: '5806_Disha Pulivadi',
        email: '2205806@kiit.ac.in',
      },
      {
        name: 'MRINAL KAUSHIK',
        email: '23051602@kiit.ac.in',
      },
      {
        name: 'RAHUL PANDEY',
        email: '22052841@kiit.ac.in',
      },
      {
        name: '3413_Hiruni Ekanayaka',
        email: '21053413@kiit.ac.in',
      },
      {
        name: 'STUTI SRIVASTAVA',
        email: '2228068@kiit.ac.in',
      },
      {
        name: '188_Ved Prakash',
        email: '21051188@kiit.ac.in',
      },
      {
        name: '534_SONALIKA SAHOO',
        email: '21052534@kiit.ac.in',
      },
      {
        name: '44_APURVA SINGH',
        email: '2130044@kiit.ac.in',
      },
      {
        name: 'GAURAV MISHRA',
        email: '23053718@kiit.ac.in',
      },
      {
        name: '5943_ Soumya Routray',
        email: '2105943@kiit.ac.in',
      },
      {
        name: 'SAYAK LODH',
        email: '2105314@kiit.ac.in',
      },
      {
        name: 'PRABHU PRASAD',
        email: '22053795@kiit.ac.in',
      },
      {
        name: 'PRANJAL YADAV',
        email: '22052918@kiit.ac.in',
      },
      {
        name: '5088 _Rohan',
        email: '2105088@kiit.ac.in',
      },
      {
        name: 'SATYAM MISHRA',
        email: '2306139@kiit.ac.in',
      },
      {
        name: '5766_AJAY SHANKER',
        email: '2105766@kiit.ac.in',
      },
      {
        name: '479_MEHUL AGARWAL',
        email: '21051479@kiit.ac.in',
      },
      {
        name: '2815_Aradhana',
        email: '21052815@kiit.ac.in',
      },
      {
        name: '2823_ASHUTOSH KUMAR PRASAD',
        email: '21052823@kiit.ac.in',
      },
      {
        name: '1923_SAHIL KUMAR',
        email: '21051923@kiit.ac.in',
      },
      {
        name: '1891_DHRUV NEHRU',
        email: '21051891@kiit.ac.in',
      },
      {
        name: 'ROHAN DAS',
        email: '23053378@kiit.ac.in',
      },
      {
        name: 'VENAY VERMA',
        email: '2207031@kiit.ac.in',
      },
      {
        name: '296 - SMRITI JHA',
        email: '2206296@kiit.ac.in',
      },
      {
        name: 'BHUMI JAISWAL',
        email: '22052454@kiit.ac.in',
      },
      {
        name: 'AMITAV MOHANTY',
        email: '22053923@kiit.ac.in',
      },
      {
        name: '2369_ASHUTOSH KUMAR TIWARI',
        email: '22052369@kiit.ac.in',
      },
      {
        name: '394_RAJESH CHOWDHURY',
        email: '21053394@kiit.ac.in',
      },
      {
        name: '1098_SWAPNIL SARKAR',
        email: '21051098@kiit.ac.in',
      },
      {
        name: '9008 AYUSH SINGH',
        email: '2209008@kiit.ac.in',
      },
      {
        name: '2801_TAPASYA RAY',
        email: '21052801@kiit.ac.in',
      },
      {
        name: 'HARSHIT',
        email: '2205039@kiit.ac.in',
      },
      {
        name: '3107_SHRUTI MEHTA',
        email: '22053107@kiit.ac.in',
      },
      {
        name: '5096_ADITYA SINHA',
        email: '2105096@kiit.ac.in',
      },
      {
        name: '1027_ADARSH SRIVASTAVA',
        email: '21051027@kiit.ac.in',
      },
      {
        name: '014_ANURAG DAS',
        email: '2105014@kiit.ac.in',
      },
      {
        name: '770 SRIJAN MUKHERJEE',
        email: '21051770@kiit.ac.in',
      },
      {
        name: '825_SAUMY',
        email: '2105825@kiit.ac.in',
      },
      {
        name: '268_ AVANI',
        email: '2105268@kiit.ac.in',
      },
      {
        name: 'SUBHAMITA PAUL',
        email: '22051639@kiit.ac.in',
      },
      {
        name: 'ABHISHEK SHRIVASTAV',
        email: '23053572@kiit.ac.in',
      },
      {
        name: '734_ Rishikesh',
        email: '2105734@kiit.ac.in',
      },
      {
        name: '2743-NIKHIL KUMAR',
        email: '22052743@kiit.ac.in',
      },
      {
        name: 'SHREYASH ROY',
        email: '22052762@kiit.ac.in',
      },
      {
        name: 'ESHNA RAY',
        email: '2228024@kiit.ac.in',
      },
      {
        name: '1124 VEDANT VERMA',
        email: '22051124@kiit.ac.in',
      },
      {
        name: '463 Ansh Pathak',
        email: '21051463@kiit.ac.in',
      },
      {
        name: 'Rishav Prasad',
        email: '2105818@kiit.ac.in',
      },
      {
        name: 'RISHI RAJ VERMA_601',
        email: '22051601@kiit.ac.in',
      },
      {
        name: '1925_SANDEEP KUMAR',
        email: '21051925@kiit.ac.in',
      },
      {
        name: '2350_ROHAN KUMAR SHARMA',
        email: '21052350@kiit.ac.in',
      },
      {
        name: '055_Hritik Raj',
        email: '21051055@kiit.ac.in',
      },
      {
        name: '387_KIRIT BARUAH',
        email: '2205387@kiit.ac.in',
      },
      {
        name: '147_ VIKASH ANAND',
        email: '2206147@kiit.ac.in',
      },
      {
        name: '119_JEET HAIT',
        email: '2106119@kiit.ac.in',
      },
      {
        name: 'DIPTA DAS',
        email: '22054375@kiit.ac.in',
      },
      {
        name: '5885_Gourav Chatterjee',
        email: '2105885@kiit.ac.in',
      },
      {
        name: 'RITIKA BANERJEE 1007',
        email: '22051007@kiit.ac.in',
      },
      {
        name: '059_ RUDRANSH MISHRA',
        email: '2105059@kiit.ac.in',
      },
      {
        name: '2529_Satyam Behera',
        email: '21052529@kiit.ac.in',
      },
      {
        name: '5892_ INDRANATH MODAK',
        email: '2105892@kiit.ac.in',
      },
      {
        name: '051_Arijit Saha',
        email: '2129051@kiit.ac.in',
      },
      {
        name: '337_abhay',
        email: '2105337@kiit.ac.in',
      },
      {
        name: '3401_ABHI UPADHYAY',
        email: '21053401@kiit.ac.in',
      },
      {
        name: '3294_METHU PAROI',
        email: '21053294@kiit.ac.in',
      },
      {
        name: '153_SAINATH DEY',
        email: '2205153@kiit.ac.in',
      },
      {
        name: '328_SORUP CHAKRABORTY',
        email: '21053328@kiit.ac.in',
      },
      {
        name: 'ARPREET MAHALA',
        email: '22052804@kiit.ac.in',
      },
      {
        name: '421- Tushar Anand',
        email: '2105421@kiit.ac.in',
      },
      {
        name: '754_RAUNAK',
        email: '21051754@kiit.ac.in',
      },
      {
        name: '3270_ASHWANI SAH',
        email: '21053270@kiit.ac.in',
      },
      {
        name: '2828_BHAWYA SINGH',
        email: '21052828@kiit.ac.in',
      },
      {
        name: 'ARYANSHU PATTNAIK',
        email: '2229102@kiit.ac.in',
      },
      {
        name: '7039_LIKSHAYA',
        email: '22057039@kiit.ac.in',
      },
      {
        name: '882_SANKALP MOHAPATRA',
        email: '22053882@kiit.ac.in',
      },
      {
        name: 'Pronoy Sharma',
        email: '2205827@kiit.ac.in',
      },
      {
        name: '1825_MEGHA SAHU',
        email: '21051825@kiit.ac.in',
      },
      {
        name: '6113_RAJDEEP THAKUR',
        email: '2206113@kiit.ac.in',
      },
      {
        name: '1025_ABHISHEK RAJ',
        email: '21051025@kiit.ac.in',
      },
      {
        name: '634_OM SINGH',
        email: '2105634@kiit.ac.in',
      },
      {
        name: '645_ADYASHA PATI',
        email: '21052645@kiit.ac.in',
      },
      {
        name: 'HARSH SANKRIT',
        email: '22051075@kiit.ac.in',
      },
      {
        name: '089_ANGSHUMAN NATH',
        email: '2106089@kiit.ac.in',
      },
      {
        name: '8147_Shrinkhala Kumari',
        email: '2228147@kiit.ac.in',
      },
      {
        name: '2110_SOUMYA RANJAN BEHERA',
        email: '21052110@kiit.ac.in',
      },
      {
        name: '9062_SAYAN BANERJEE',
        email: '2229062@kiit.ac.in',
      },
      {
        name: '1972_ANSUMAN PATI',
        email: '21051972@kiit.ac.in',
      },
      {
        name: '506_SHOVIN BARIK',
        email: '2205506@kiit.ac.in',
      },
      {
        name: 'ABIR SARKAR',
        email: '2105090@kiit.ac.in',
      },
      {
        name: '1235_PRIYADARSINI MOHARANA',
        email: '21051235@kiit.ac.in',
      },
      {
        name: '795_DIVYANSHI GORAI',
        email: '2105795@kiit.ac.in',
      },
      {
        name: '204_KRISHNENDU DAS',
        email: '2105204@kiit.ac.in',
      },
      {
        name: '5521_Aman Sinha',
        email: '2105521@kiit.ac.in',
      },
      {
        name: '670_SNEHAN SAHOO',
        email: '2105670@kiit.ac.in',
      },
      {
        name: 'LAKKSHIT KHARE',
        email: '2205045@kiit.ac.in',
      },
      {
        name: '1525_MAYUKH PATTANAYAK',
        email: '22051525@kiit.ac.in',
      },
      {
        name: '542_ARUSH AGGARWAL',
        email: '2205542@kiit.ac.in',
      },
      {
        name: 'MAYURAKSHEE SAHU',
        email: '21051406@kiit.ac.in',
      },
      {
        name: '5521_AAKRITI ROY',
        email: '2205521@kiit.ac.in',
      },
      {
        name: 'RAMAN KURMI',
        email: '2306384@kiit.ac.in',
      },
      {
        name: '215_Vishal Singh',
        email: '22053215@kiit.ac.in',
      },
      {
        name: '4298-Hrushikesh Venkatasai',
        email: '22054298@kiit.ac.in',
      },
      {
        name: 'SRASHTA DAHAL',
        email: '23053605@kiit.ac.in',
      },
      {
        name: '8128_PRATIK DAS',
        email: '2228128@kiit.ac.in',
      },
      {
        name: 'PRAKHAR RAJ',
        email: '22053087@kiit.ac.in',
      },
      {
        name: '4126-BISMAYA KANTA DASH',
        email: '22054126@kiit.ac.in',
      },
      {
        name: '5154_SANKALPA GIRI',
        email: '2305154@kiit.ac.in',
      },
      {
        name: '1006_ SHIVANGI',
        email: '21051006@kiit.ac.in',
      },
      {
        name: '3625_SATVIK_BEURA',
        email: '22053625@kiit.ac.in',
      },
      {
        name: '200_SOUMALYA DAS',
        email: '22053200@kiit.ac.in',
      },
      {
        name: 'ROHAN CHOUDHARY',
        email: '2229054@kiit.ac.in',
      },
      {
        name: '3804_Sahil Samal',
        email: '22053804@kiit.ac.in',
      },
      {
        name: 'SOVIK BURMA',
        email: '23052438@kiit.ac.in',
      },
      {
        name: '575_ Ayush Amulya',
        email: '21052575@kiit.ac.in',
      },
      {
        name: '8124 Nirman Raj',
        email: '2228124@kiit.ac.in',
      },
      {
        name: 'SUSHANT SHAH',
        email: '23053495@kiit.ac.in',
      },
      {
        name: 'ARMAAN MOHAPATRA_4166',
        email: '2304166@kiit.ac.in',
      },
      {
        name: '622_ GORISH KUMAR',
        email: '2105622@kiit.ac.in',
      },
      {
        name: '179_ANKIT KUMAR',
        email: '2105179@kiit.ac.in',
      },
      {
        name: '669_SNEHAJIT DEY',
        email: '2105669@kiit.ac.in',
      },
      {
        name: '6269_SUKHARANJAN JANA',
        email: '2106269@kiit.ac.in',
      },
      {
        name: '2432_LUCKY MAHANTA',
        email: '21052432@kiit.ac.in',
      },
      {
        name: '490_BHAVYA KUMARI',
        email: '21052490@kiit.ac.in',
      },
      {
        name: '561_Omprakash Tripathy',
        email: '2105561@kiit.ac.in',
      },
      {
        name: '6025_deepak singh',
        email: '2106025@kiit.ac.in',
      },
      {
        name: '6178 - AKANCHA KHAITAN',
        email: '2306178@kiit.ac.in',
      },
      {
        name: 'Abhishek Das',
        email: '23053911@kiit.ac.in',
      },
      {
        name: 'PUSHPITA GHOSH',
        email: '2305799@kiit.ac.in',
      },
      {
        name: 'MUKUND SAH',
        email: '23053650@kiit.ac.in',
      },
      {
        name: 'MANISH SAH',
        email: '23053550@kiit.ac.in',
      },
      {
        name: 'PRATIK DASH',
        email: '22053449@kiit.ac.in',
      },
      {
        name: '1589 RUDRANEEL DUTTA',
        email: '21051589@kiit.ac.in',
      },
      {
        name: 'ANKITA MAJUMDER',
        email: '2229099@kiit.ac.in',
      },
      {
        name: '6216_SIDHANT SANGAM',
        email: '2206216@kiit.ac.in',
      },
      {
        name: 'SRISHTY VERMA',
        email: '22051381@kiit.ac.in',
      },
      {
        name: 'ADITI SINGH',
        email: '2329090@kiit.ac.in',
      },
      {
        name: 'DEVASHISH GUPTA',
        email: '23053675@kiit.ac.in',
      },
      {
        name: 'ARKO GHOSH',
        email: '2306266@kiit.ac.in',
      },
      {
        name: '559_NIKUNJ KHEMKA',
        email: '2105559@kiit.ac.in',
      },
      {
        name: '2730_Akashdip Saha',
        email: '21052730@kiit.ac.in',
      },
      {
        name: '1898_JAYAKRISHNAN M',
        email: '21051898@kiit.ac.in',
      },
      {
        name: '1872_ABHASH KUMAR JHA',
        email: '21051872@kiit.ac.in',
      },
      {
        name: '5880_BISWAJIT NAYAK',
        email: '2105880@kiit.ac.in',
      },
      {
        name: '2339',
        email: '21052339@kiit.ac.in',
      },
      {
        name: 'SOUNAK DUTTA',
        email: '22052684@kiit.ac.in',
      },
      {
        name: 'MARIA GEORGE',
        email: '2105805@kiit.ac.in',
      },
      {
        name: 'ANKANA SEN',
        email: '22051838@kiit.ac.in',
      },
      {
        name: 'GAUTAM YADAV _3847',
        email: '23053847@kiit.ac.in',
      },
      {
        name: '3247_ROHIT RAJ',
        email: '21053247@kiit.ac.in',
      },
      {
        name: 'AARUSH AMBAR',
        email: '22051479@kiit.ac.in',
      },
      {
        name: '751_MEDHAVI SAHGAL',
        email: '2205751@kiit.ac.in',
      },
      {
        name: 'DIGONTO BISWAS (3429)',
        email: '23053429@kiit.ac.in',
      },
      {
        name: 'DUSHYANT',
        email: '22051072@kiit.ac.in',
      },
      {
        name: '563_ANIKET BARIK',
        email: '21052563@kiit.ac.in',
      },
      {
        name: '050_PRATIKSHYA BEHERA',
        email: '2105050@kiit.ac.in',
      },
      {
        name: '2523_ROHIT CHANDRA',
        email: '21052523@kiit.ac.in',
      },
      {
        name: '130_Kanishk',
        email: '2205130@kiit.ac.in',
      },
      {
        name: '982-SWAGATIKA BARIK',
        email: '2305982@kiit.ac.in',
      },
      {
        name: 'SAYAN KUMAR (22053545)',
        email: '22053545@kiit.ac.in',
      },
      {
        name: 'SAGNIK MAITY',
        email: '2305324@kiit.ac.in',
      },
      {
        name: 'SIMRAN ARYA',
        email: '2305894@kiit.ac.in',
      },
      {
        name: 'RIYA KUMARI',
        email: '22052749@kiit.ac.in',
      },
      {
        name: 'AYUSH SINGH',
        email: '22051850@kiit.ac.in',
      },
      {
        name: '467_AAMOGHA BILLORE',
        email: '21052467@kiit.ac.in',
      },
      {
        name: '52_KAUSTUV SARKAR CHAKRAVARTY',
        email: '2130052@kiit.ac.in',
      },
      {
        name: '2398_ANUSHKA DUTTA',
        email: '21052398@kiit.ac.in',
      },
      {
        name: 'ARADHYA SINGH',
        email: '22052624@kiit.ac.in',
      },
      {
        name: '8072_ANURUDDHA PAUL',
        email: '2328072@kiit.ac.in',
      },
      {
        name: '140_KENGUVA BHAVESH',
        email: '21051140@kiit.ac.in',
      },
      {
        name: '110_ADITI SRIVASTAVA',
        email: '21051110@kiit.ac.in',
      },
      {
        name: '1430_SHUBHAM CHATTERJEE',
        email: '21051430@kiit.ac.in',
      },
      {
        name: '2429_UTKARSH NIGAM',
        email: '22052429@kiit.ac.in',
      },
      {
        name: '127_SREYASHI BISHNU MAJUMDAR',
        email: '2230127@kiit.ac.in',
      },
      {
        name: 'ARITRITA PAUL',
        email: '2205881@kiit.ac.in',
      },
      {
        name: 'ANUBHABA SWAIN',
        email: '2306105@kiit.ac.in',
      },
      {
        name: '718_HARSHITA OLIVE AROHAN',
        email: '2105718@kiit.ac.in',
      },
      {
        name: 'VIKRAM KUMAR',
        email: '22054001@kiit.ac.in',
      },
      {
        name: 'VISHESH KUMAR',
        email: '22051388@kiit.ac.in',
      },
      {
        name: '583_DIPRA BANERJEE',
        email: '21052583@kiit.ac.in',
      },
      {
        name: 'p c',
        email: '21053354@kiit.ac.in',
      },
      {
        name: 'Genish Kumar',
        email: '22054099@kiit.ac.in',
      },
      {
        name: '1439_STHITAPRAGYAN ROUT',
        email: '21051439@kiit.ac.in',
      },
      {
        name: '2747-AYUSH PATHAK',
        email: '21052747@kiit.ac.in',
      },
      {
        name: '2800_ SYAMANTAK',
        email: '21052800@kiit.ac.in',
      },
      {
        name: '083_VEDANG VATSAL',
        email: '2106083@kiit.ac.in',
      },
      {
        name: '1307_ divyansh Suman',
        email: '21051307@kiit.ac.in',
      },
      {
        name: '2413_DEBANSHU PARIDA',
        email: '21052413@kiit.ac.in',
      },
      {
        name: '815_ DIPTANIL',
        email: '21051815@kiit.ac.in',
      },
      {
        name: 'BHOOMIKA DASH',
        email: '2206331@kiit.ac.in',
      },
      {
        name: '836_Subhra Dash',
        email: '2105836@kiit.ac.in',
      },
      {
        name: '1162-Hritika Sharan',
        email: '22051162@kiit.ac.in',
      },
      {
        name: 'SOHOM CHAKRABORTY',
        email: '22052681@kiit.ac.in',
      },
      {
        name: '134_Priya Rana',
        email: '2105134@kiit.ac.in',
      },
      {
        name: '318_SHREE SARAL',
        email: '2106318@kiit.ac.in',
      },
      {
        name: '8022_HARSHIT ANAND',
        email: '2128022@kiit.ac.in',
      },
      {
        name: '8156 SWAYANSA MISHRA',
        email: '2228156@kiit.ac.in',
      },
      {
        name: '387 YOGESH KUMAR SAH',
        email: '21053387@kiit.ac.in',
      },
      {
        name: '204_SNEHA GUPTA',
        email: '2230204@kiit.ac.in',
      },
      {
        name: '017_ARNAV GUPTA',
        email: '2206017@kiit.ac.in',
      },
      {
        name: '1788 Abhisek',
        email: '21051788@kiit.ac.in',
      },
      {
        name: '6279_TARUN KUMAR',
        email: '2106279@kiit.ac.in',
      },
      {
        name: '470_Naman jain',
        email: '2105470@kiit.ac.in',
      },
      {
        name: '221_RABNEET SINGH NANHRA',
        email: '2105221@kiit.ac.in',
      },
      {
        name: '1484_ AFAQUE',
        email: '21051484@kiit.ac.in',
      },
      {
        name: '4051_Madan Pandey',
        email: '22054051@kiit.ac.in',
      },
      {
        name: '1233_ Pratham Gupta',
        email: '21051233@kiit.ac.in',
      },
      {
        name: '208_MILAN KUMAR SAHOO',
        email: '2105208@kiit.ac.in',
      },
      {
        name: 'ANURAG MODAK',
        email: '22053143@kiit.ac.in',
      },
      {
        name: '1861_TRISHA',
        email: '21051861@kiit.ac.in',
      },
      {
        name: '288_Nikhil Das',
        email: '2105288@kiit.ac.in',
      },
      {
        name: '206 ARCHIT JETHLIA',
        email: '21053206@kiit.ac.in',
      },
      {
        name: '5757_PARIDA PRATYUS SRIMAYSIS',
        email: '2205757@kiit.ac.in',
      },
      {
        name: '497_SIBASISH DUTTA',
        email: '2105497@kiit.ac.in',
      },
      {
        name: '474_PRACHI RAJ',
        email: '2105474@kiit.ac.in',
      },
      {
        name: '753_SOUBHAGYA ROY',
        email: '2105753@kiit.ac.in',
      },
      {
        name: '1890_DEEPANSHU SINGH',
        email: '21051890@kiit.ac.in',
      },
      {
        name: '2715_SUDEEPA',
        email: '21052715@kiit.ac.in',
      },
      {
        name: 'MAINAK MAITRA',
        email: '22053076@kiit.ac.in',
      },
      {
        name: '1557 _Jaswanth Reddy Biyyala',
        email: '21051557@kiit.ac.in',
      },
      {
        name: '159_SIRSHA BASAK',
        email: '2106159@kiit.ac.in',
      },
      {
        name: '1377_ANSHUMAN RATH',
        email: '21051377@kiit.ac.in',
      },
      {
        name: 'SUDHANSHU OM',
        email: '22051559@kiit.ac.in',
      },
      {
        name: '710_SOURAV NARAYAN',
        email: '21052710@kiit.ac.in',
      },
      {
        name: '202_VARUN MAURYA',
        email: '2105202@kiit.ac.in',
      },
      {
        name: '2726-achyutvardhan',
        email: '21052726@kiit.ac.in',
      },
      {
        name: '2127_Mushrraf ZAWED',
        email: '22052127@kiit.ac.in',
      },
      {
        name: '1210_RITWIKA AGARWALA',
        email: '23051210@kiit.ac.in',
      },
      {
        name: '3300_NITESH KUMAR MANDAL',
        email: '21053300@kiit.ac.in',
      },
      {
        name: '1758_KUMAR SHUBHAM',
        email: '23051758@kiit.ac.in',
      },
      {
        name: '1340_DEEPRO BHATTACHARYYA',
        email: '23051340@kiit.ac.in',
      },
      {
        name: 'SAUMYA SHUKLA',
        email: '2305156@kiit.ac.in',
      },
      {
        name: '1218_SHREYA DUBEY',
        email: '23051218@kiit.ac.in',
      },
      {
        name: '1655_ANSUMAN DAS',
        email: '23051655@kiit.ac.in',
      },
      {
        name: 'ANKIT MOHAPATRA',
        email: '2309015@kiit.ac.in',
      },
      {
        name: '3208_SWAPNIL SINHA',
        email: '22053208@kiit.ac.in',
      },
      {
        name: 'SHIVAM PATRA',
        email: '23052354@kiit.ac.in',
      },
      {
        name: 'AKANKSHA SHREYA',
        email: '2330212@kiit.ac.in',
      },
      {
        name: '806_NEEL JAIN',
        email: '2105806@kiit.ac.in',
      },
      {
        name: '395_RAFAT REDWAN',
        email: '21053395@kiit.ac.in',
      },
      {
        name: 'ANYASH PRASAD',
        email: '23051977@kiit.ac.in',
      },
      {
        name: 'PRATYUSH PATNAIK',
        email: '23052744@kiit.ac.in',
      },
      {
        name: 'NISHMEET SINGH RAJPAL',
        email: '2330452@kiit.ac.in',
      },
      {
        name: '2589 REWA SHUKLA',
        email: '23052589@kiit.ac.in',
      },
      {
        name: 'SAYALI DESHMUKH',
        email: '2305157@kiit.ac.in',
      },
      {
        name: '6073_SUDIP MONDAL',
        email: '2106073@kiit.ac.in',
      },
      {
        name: 'SAMAVEDAM JANAKI BHAWANI SHREYA',
        email: '23052101@kiit.ac.in',
      },
      {
        name: '2030 PIYUSH JENA',
        email: '2302030@kiit.ac.in',
      },
      {
        name: '1807_ BHAGWANT',
        email: '21051807@kiit.ac.in',
      },
      {
        name: '3325_SHUBHAM ROUNIYAR',
        email: '21053325@kiit.ac.in',
      },
      {
        name: '223_Utkarsh Trivedi',
        email: '21053223@kiit.ac.in',
      },
      {
        name: 'PRASENJEET SINGH',
        email: '22052486@kiit.ac.in',
      },
      {
        name: '1183_SUBHADEEP SHIL',
        email: '21051183@kiit.ac.in',
      },
      {
        name: '1524_ UDAY SHARMA',
        email: '21051524@kiit.ac.in',
      },
      {
        name: '664_HARSHDEEP SINGH',
        email: '21052664@kiit.ac.in',
      },
      {
        name: 'KUSHAGRA MOHAN (23052649)',
        email: '23052649@kiit.ac.in',
      },
      {
        name: '2315AVIRUP SAMANTA',
        email: '21052315@kiit.ac.in',
      },
      {
        name: '037_SOUMYADEEP PAUL',
        email: '2129037@kiit.ac.in',
      },
      {
        name: '637__PRANAV REDDY',
        email: '2105637@kiit.ac.in',
      },
      {
        name: 'AJITA SINGH',
        email: '23052453@kiit.ac.in',
      },
      {
        name: '010_ ANKIT SINGH',
        email: '2105010@kiit.ac.in',
      },
      {
        name: '212_SHIVANSHU THAKUR',
        email: '2206212@kiit.ac.in',
      },
      {
        name: 'PUNYA PARUL',
        email: '2330390@kiit.ac.in',
      },
      {
        name: '032-RISHABH MOHATA',
        email: '2129032@kiit.ac.in',
      },
      {
        name: 'ANURODH KUMAR',
        email: '2206244@kiit.ac.in',
      },
      {
        name: 'SAUMYAJIT CHATTERJEE',
        email: '2229060@kiit.ac.in',
      },
      {
        name: '899_MANISH KUMAR SINGH',
        email: '2105899@kiit.ac.in',
      },
      {
        name: '2068_Dinesh',
        email: '21052068@kiit.ac.in',
      },
      {
        name: '498 Sidhant Guha',
        email: '2105498@kiit.ac.in',
      },
      {
        name: '2311_ASHISH KUMAR',
        email: '21052311@kiit.ac.in',
      },
      {
        name: '248_SOVNA PANDA',
        email: '2105248@kiit.ac.in',
      },
      {
        name: 'SRIJONI BANERJI',
        email: '2305418@kiit.ac.in',
      },
      {
        name: '1391 SUNAINA ROY',
        email: '23051391@kiit.ac.in',
      },
      {
        name: '130_SHAKSHI JAISWAL',
        email: '2129130@kiit.ac.in',
      },
      {
        name: '2695_Ritik Kumar Sahoo',
        email: '21052695@kiit.ac.in',
      },
      {
        name: '2301_ADITYA RANJAN',
        email: '21052301@kiit.ac.in',
      },
      {
        name: '823_Sathwik Yaramala',
        email: '2105823@kiit.ac.in',
      },
      {
        name: 'AANAND MISHRA',
        email: '22054318@kiit.ac.in',
      },
      {
        name: 'Siddharth :3',
        email: '22051026@kiit.ac.in',
      },
      {
        name: 'SURYANSH DEO - 1205',
        email: '22051205@kiit.ac.in',
      },
      {
        name: '188_MD SIBTAIN RAZA',
        email: '2206188@kiit.ac.in',
      },
      {
        name: '2016_RAKSHITA BHATNAGAR',
        email: '21052016@kiit.ac.in',
      },
      {
        name: '1194_Agrim Agrawal',
        email: '21051194@kiit.ac.in',
      },
      {
        name: 'NISHANTH BANDARU',
        email: '2330314@kiit.ac.in',
      },
      {
        name: 'MANASWINI PRIYADARSHINI (22053436)',
        email: '22053436@kiit.ac.in',
      },
      {
        name: '082_VEDIKA CHOWDHARY',
        email: '2105082@kiit.ac.in',
      },
      {
        name: '2208_ UTPALA DUTTA',
        email: '21052208@kiit.ac.in',
      },
      {
        name: '5570_shiksha Tiwari',
        email: '2305570@kiit.ac.in',
      },
      {
        name: '2169_PRATYUSH AMLAN SAHU',
        email: '21052169@kiit.ac.in',
      },
      {
        name: '2689_RAHUL SINHA',
        email: '21052689@kiit.ac.in',
      },
      {
        name: '1230_Omkar Mishra',
        email: '21051230@kiit.ac.in',
      },
      {
        name: '6397_Samyog Sharma',
        email: '2206397@kiit.ac.in',
      },
      {
        name: '298_RAKSHIT MEHRA',
        email: '2105298@kiit.ac.in',
      },
      {
        name: '318_SOUVIK',
        email: '2230318@kiit.ac.in',
      },
      {
        name: '9087_Priyanshu Garg',
        email: '2129087@kiit.ac.in',
      },
      {
        name: '0429_RISHAV RAJ',
        email: '2330429@kiit.ac.in',
      },
      {
        name: '366 Debjit Goswami',
        email: '2105366@kiit.ac.in',
      },
      {
        name: '321_SHEKHAR MALLIK',
        email: '21053321@kiit.ac.in',
      },
      {
        name: '1222_KANCHAN BALA',
        email: '21051222@kiit.ac.in',
      },
      {
        name: '313_SAURABH SHUKLA',
        email: '2105313@kiit.ac.in',
      },
      {
        name: '3308_RAHUL BISWAS',
        email: '21053308@kiit.ac.in',
      },
      {
        name: '690_ Reetika',
        email: '21052690@kiit.ac.in',
      },
      {
        name: 'SAKSHI JINDAL',
        email: '23052100@kiit.ac.in',
      },
      {
        name: '5131_PANDEY UDIT RAY',
        email: '2105131@kiit.ac.in',
      },
      {
        name: '2997 - Surbhi Roy',
        email: '21052997@kiit.ac.in',
      },
      {
        name: 'Ujval Kumar',
        email: '22052080@kiit.ac.in',
      },
      {
        name: '3036_SATWIK SHARMA',
        email: '2303036@kiit.ac.in',
      },
      {
        name: '594_SHAMIT SHEEL',
        email: '21051594@kiit.ac.in',
      },
      {
        name: '1538_Aniket Raul',
        email: '21051538@kiit.ac.in',
      },
      {
        name: '1982 Aryan shaw',
        email: '21051982@kiit.ac.in',
      },
      {
        name: 'Yatharth Jain',
        email: '21051918@kiit.ac.in',
      },
      {
        name: '481_ Suhank',
        email: '21051481@kiit.ac.in',
      },
      {
        name: 'SHASHANK SHAH',
        email: '22052853@kiit.ac.in',
      },
      {
        name: '1963_RiyaSinha',
        email: '22051963@kiit.ac.in',
      },
      {
        name: 'SHIVANGI UPADHYAY',
        email: '2305162@kiit.ac.in',
      },
      {
        name: 'GAURAV KUMAR',
        email: '22051856@kiit.ac.in',
      },
      {
        name: '0172_SOUMALYADEB BANERJEE',
        email: '2130172@kiit.ac.in',
      },
      {
        name: '0198_SOUMYAJIT KOLAY',
        email: '2130198@kiit.ac.in',
      },
      {
        name: '2799_SUYASH PRAKASH',
        email: '21052799@kiit.ac.in',
      },
      {
        name: 'SAMYA DAS',
        email: '22052501@kiit.ac.in',
      },
      {
        name: '7032_HARSH PRASAD',
        email: '22057032@kiit.ac.in',
      },
      {
        name: '6200_Rajtanu',
        email: '2206200@kiit.ac.in',
      },
      {
        name: '2320_Dhruv Budhia',
        email: '21052320@kiit.ac.in',
      },
      {
        name: '100_Abbas Husain',
        email: '21051100@kiit.ac.in',
      },
      {
        name: '2731_AMITABH BAL',
        email: '21052731@kiit.ac.in',
      },
      {
        name: 'SIDDHARTHA',
        email: '2228065@kiit.ac.in',
      },
      {
        name: 'SUJAL KUMAR',
        email: '22053906@kiit.ac.in',
      },
      {
        name: 'SONU KUMAR',
        email: '22052418@kiit.ac.in',
      },
      {
        name: '5447_Aviral Kishore',
        email: '2105447@kiit.ac.in',
      },
      {
        name: '211_Jashika_ sethi',
        email: '2205211@kiit.ac.in',
      },
      {
        name: 'RICHA KUMARI',
        email: '22052492@kiit.ac.in',
      },
      {
        name: '037_MD DILSHAD ALAM',
        email: '2106037@kiit.ac.in',
      },
      {
        name: '034 - SHREYON GHOSH',
        email: '2129034@kiit.ac.in',
      },
      {
        name: '1156__ADITYA MUKHERJEE',
        email: '23051156@kiit.ac.in',
      },
      {
        name: 'Awadhesh Gupta Kaulapuri',
        email: '22054295@kiit.ac.in',
      },
      {
        name: '1977-ARITRA KAR',
        email: '21051977@kiit.ac.in',
      },
      {
        name: '2956_SWAYAM',
        email: '21052956@kiit.ac.in',
      },
      {
        name: '6087_DEBDIP CHATTERJEE',
        email: '2206087@kiit.ac.in',
      },
      {
        name: 'ADITYA RAJ',
        email: '22052525@kiit.ac.in',
      },
      {
        name: '9042_ AMIT KUMAR DHALL',
        email: '2129042@kiit.ac.in',
      },
      {
        name: 'HRISHA DEY',
        email: '2230612@kiit.ac.in',
      },
      {
        name: '622_SHRISHTI SINGH',
        email: '21052622@kiit.ac.in',
      },
      {
        name: 'PRADEEP (22054325)',
        email: '22054325@kiit.ac.in',
      },
      {
        name: '1276_Abhijeet',
        email: '21051276@kiit.ac.in',
      },
      {
        name: '160- KAFIA ADEN MOHAMED',
        email: '2129160@kiit.ac.in',
      },
      {
        name: '1495_Priyanshu',
        email: '21051495@kiit.ac.in',
      },
      {
        name: 'AKSHAT KUTARIYAR',
        email: '22052791@kiit.ac.in',
      },
      {
        name: 'AKSHAT RAJ',
        email: '22051137@kiit.ac.in',
      },
      {
        name: '2370_SUMIT RANJAN',
        email: '21052370@kiit.ac.in',
      },
      {
        name: '137_SRISHTI SINGH',
        email: '2206137@kiit.ac.in',
      },
      {
        name: '2035_Manish Raj',
        email: '22052035@kiit.ac.in',
      },
      {
        name: 'SOUVIK CHANDRA',
        email: '2206385@kiit.ac.in',
      },
      {
        name: '1927_Satyadeb Chand',
        email: '21051927@kiit.ac.in',
      },
      {
        name: 'ANISH KUNDU',
        email: '22052797@kiit.ac.in',
      },
      {
        name: '877_ALOK KUMAR JHA',
        email: '21051877@kiit.ac.in',
      },
      {
        name: '1637_ARUNIMA DAS',
        email: '21051637@kiit.ac.in',
      },
      {
        name: '2990_ZOYAH AFSHEEN SAYEED',
        email: '21052990@kiit.ac.in',
      },
      {
        name: '3932 Atish Dipankar DUTTA',
        email: '22053932@kiit.ac.in',
      },
      {
        name: '4068_Prajwal Goit',
        email: '22054068@kiit.ac.in',
      },
      {
        name: 'Atul Rajput',
        email: '2230158@kiit.ac.in',
      },
      {
        name: '1697_vaibhav patel',
        email: '21051697@kiit.ac.in',
      },
      {
        name: '344_trisha',
        email: '22052344@kiit.ac.in',
      },
      {
        name: 'AYUSH DAS',
        email: '22053412@kiit.ac.in',
      },
      {
        name: '7084_Saswata Dey',
        email: '22057084@kiit.ac.in',
      },
      {
        name: 'HASAN MAHMUD',
        email: '22054457@kiit.ac.in',
      },
      {
        name: 'SHIVANSH',
        email: '22052408@kiit.ac.in',
      },
      {
        name: '010_Aditya',
        email: '2129010@kiit.ac.in',
      },
      {
        name: '1680_SAYANDEEP',
        email: '21051680@kiit.ac.in',
      },
      {
        name: 'ANIKET MAITY',
        email: '22053660@kiit.ac.in',
      },
      {
        name: '6017_ARYAN PARIHAR',
        email: '2106017@kiit.ac.in',
      },
      {
        name: 'PREETAM DASH',
        email: '22052488@kiit.ac.in',
      },
      {
        name: 'AYUSH KUMAR',
        email: '22052546@kiit.ac.in',
      },
      {
        name: '2209_GOUTAM VENKATESAN',
        email: '22052209@kiit.ac.in',
      },
      {
        name: 'FAIZAN FAIYAZ',
        email: '22052555@kiit.ac.in',
      },
      {
        name: '1498_ Raihan Siddiqui',
        email: '21051498@kiit.ac.in',
      },
      {
        name: '125_KUMAR GAURAV',
        email: '2105125@kiit.ac.in',
      },
      {
        name: 'ADITYA ROY',
        email: '2330208@kiit.ac.in',
      },
      {
        name: '1605 _sreetama',
        email: '21051605@kiit.ac.in',
      },
      {
        name: '244 RISHABH KUMAR SINGH',
        email: '21053244@kiit.ac.in',
      },
      {
        name: '768_AMLAN',
        email: '2105768@kiit.ac.in',
      },
      {
        name: '4108_Mitali Yadav',
        email: '22054108@kiit.ac.in',
      },
      {
        name: 'Dip Biswas',
        email: '22054244@kiit.ac.in',
      },
      {
        name: 'Apurba Modak',
        email: '22054243@kiit.ac.in',
      },
      {
        name: '100_ARGHAJIT DAS',
        email: '2106100@kiit.ac.in',
      },
      {
        name: 'AKANKHYA BEURIA',
        email: '22051227@kiit.ac.in',
      },
      {
        name: '8084 AAKRITI GUPTA',
        email: '2228084@kiit.ac.in',
      },
      {
        name: 'RAMASHANKAR SAH',
        email: '23053812@kiit.ac.in',
      },
      {
        name: '1724 SATYAJIT PRADHAN',
        email: '22051724@kiit.ac.in',
      },
      {
        name: '1023_ Abdul Majid',
        email: '21051023@kiit.ac.in',
      },
      {
        name: '1350 MANAS GOSWAMEE',
        email: '23051350@kiit.ac.in',
      },
      {
        name: '9104_Shomili Duary',
        email: '2129104@kiit.ac.in',
      },
      {
        name: '1778 SAMARTH SHUKLA',
        email: '23051778@kiit.ac.in',
      },
      {
        name: '445_Harshit Gupta',
        email: '2006445@kiit.ac.in',
      },
      {
        name: 'MOITREYEE BHADURI',
        email: '22052999@kiit.ac.in',
      },
      {
        name: '229_ Rupal Pradhan',
        email: '2105229@kiit.ac.in',
      },
      {
        name: '5990 M Bhanu Sashank Varma',
        email: '2205990@kiit.ac.in',
      },
      {
        name: '3265_AMBRISH KUMAR MANDAL',
        email: '21053265@kiit.ac.in',
      },
      {
        name: 'YASH KUMAR',
        email: '22053128@kiit.ac.in',
      },
      {
        name: '2873_Shradha Suman',
        email: '21052873@kiit.ac.in',
      },
      {
        name: 'NILAY MALLIK',
        email: '23053865@kiit.ac.in',
      },
      {
        name: '1514_ Shrinkhala',
        email: '21051514@kiit.ac.in',
      },
      {
        name: 'ADWIKA SARRAF',
        email: '2205963@kiit.ac.in',
      },
      {
        name: '1145_Moitreyee Das',
        email: '21051145@kiit.ac.in',
      },
      {
        name: 'SASWAT JENA',
        email: '21051084@kiit.ac.in',
      },
      {
        name: '1584_Purnendu Thamb',
        email: '21051584@kiit.ac.in',
      },
      {
        name: '3345_ROHAN BOSE',
        email: '22053345@kiit.ac.in',
      },
      {
        name: 'SANJOG YADAV',
        email: '23053928@kiit.ac.in',
      },
      {
        name: '348-ABHISHEK RANJAN',
        email: '2105348@kiit.ac.in',
      },
      {
        name: '5430_ABHISEK PANDA',
        email: '2105430@kiit.ac.in',
      },
      {
        name: 'ADITYA RAJ',
        email: '22052873@kiit.ac.in',
      },
      {
        name: 'MD ASHIQUL',
        email: '22054452@kiit.ac.in',
      },
      {
        name: '5921_SARTHAK Prusty',
        email: '2105921@kiit.ac.in',
      },
      {
        name: '286-MANYTUCH MANGAR BENY RUEI',
        email: '2106286@kiit.ac.in',
      },
      {
        name: 'SAMBIT MOHAPATRA',
        email: '23057040@kiit.ac.in',
      },
      {
        name: '585_Ekaansh',
        email: '21052585@kiit.ac.in',
      },
      {
        name: '090_ RAJDEEP SARKAR',
        email: '2129090@kiit.ac.in',
      },
      {
        name: '1841 RITIK RAJ',
        email: '21051841@kiit.ac.in',
      },
      {
        name: '1017_Sourav Nayak',
        email: '21051017@kiit.ac.in',
      },
      {
        name: '6125_ shikhar bhadouria',
        email: '2206125@kiit.ac.in',
      },
      {
        name: 'Ashutosh Agrawal',
        email: '2105532@kiit.ac.in',
      },
      {
        name: '1136_AKARSH RAJ',
        email: '22051136@kiit.ac.in',
      },
      {
        name: '656_Bhargav Rao',
        email: '21052656@kiit.ac.in',
      },
      {
        name: '876_BHAVYA PRIYADARSHINI',
        email: '2105876@kiit.ac.in',
      },
      {
        name: 'KESHAB Gupta_562',
        email: '2205562@kiit.ac.in',
      },
      {
        name: 'Manish Kumar',
        email: '22054241@kiit.ac.in',
      },
      {
        name: 'DIVYANI PANDEY',
        email: '22053948@kiit.ac.in',
      },
      {
        name: 'Kanchan Kumari',
        email: '22054227@kiit.ac.in',
      },
      {
        name: '9206_Rashmi Singha',
        email: '2229206@kiit.ac.in',
      },
      {
        name: '208_GARVIT RAI',
        email: '2205208@kiit.ac.in',
      },
      {
        name: '413_PAPPU KUMAR',
        email: '22054413@kiit.ac.in',
      },
      {
        name: '1697 Nikhil Aditya Nagvanshi',
        email: '22051697@kiit.ac.in',
      },
      {
        name: '065_Yashvardhan Singh',
        email: '2206065@kiit.ac.in',
      },
      {
        name: 'NISHANT KUMAR',
        email: '22054387@kiit.ac.in',
      },
      {
        name: 'SHAKYA SINHA',
        email: '2205066@kiit.ac.in',
      },
      {
        name: 'ANKITA SINGH',
        email: '23051651@kiit.ac.in',
      },
      {
        name: '2856_ Aayush kumar',
        email: '23052856@kiit.ac.in',
      },
      {
        name: 'RAJA SAH',
        email: '23053769@kiit.ac.in',
      },
      {
        name: 'KUNAL SRIVASTAVA',
        email: '22053254@kiit.ac.in',
      },
      {
        name: 'PIYUSH_1438',
        email: '23051438@kiit.ac.in',
      },
      {
        name: '1479_Aarna Anvi',
        email: '23051479@kiit.ac.in',
      },
      {
        name: 'AYUSH RAJ',
        email: '22052544@kiit.ac.in',
      },
      {
        name: '387 OORJA SINGH',
        email: '2105387@kiit.ac.in',
      },
      {
        name: 'KRISHNENDU PAN',
        email: '22053782@kiit.ac.in',
      },
      {
        name: 'TANISHA PANDA',
        email: '22051386@kiit.ac.in',
      },
      {
        name: 'VED PANDEY',
        email: '23053645@kiit.ac.in',
      },
      {
        name: 'NITESH GUPTA',
        email: '23053757@kiit.ac.in',
      },
      {
        name: 'DIPANJAN ROY',
        email: '2305126@kiit.ac.in',
      },
      {
        name: 'Avoy Nath CHOWDHURY',
        email: '23053559@kiit.ac.in',
      },
      {
        name: 'INDRONIL ARKO',
        email: '23053553@kiit.ac.in',
      },
      {
        name: 'VISHWAJEET BHARTI',
        email: '2205085@kiit.ac.in',
      },
      {
        name: 'ADITYA RAJ',
        email: '2207001@kiit.ac.in',
      },
      {
        name: '688_PUSHPAK KUMAR',
        email: '21052688@kiit.ac.in',
      },
      {
        name: 'ANUSUA BISWAS',
        email: '22052970@kiit.ac.in',
      },
      {
        name: '4326_Abhishek',
        email: '22054326@kiit.ac.in',
      },
      {
        name: '1765_NITIN KUMAR',
        email: '23051765@kiit.ac.in',
      },
      {
        name: '700-ADRIJA KARMAKAR',
        email: '22052700@kiit.ac.in',
      },
      {
        name: 'DARSH MOHAPATRA',
        email: '2328163@kiit.ac.in',
      },
      {
        name: 'SUMIT VERMA',
        email: '22052426@kiit.ac.in',
      },
      {
        name: '3465_TAMJEED SIDDIQUE',
        email: '23053465@kiit.ac.in',
      },
      {
        name: '007-ADITI CHOUDHURY',
        email: '2129007@kiit.ac.in',
      },
      {
        name: '702 ARYAN BHATTACHARJEE',
        email: '2105702@kiit.ac.in',
      },
      {
        name: 'SHREYAS PUROHIT',
        email: '22053812@kiit.ac.in',
      },
      {
        name: '302_ Aniket Lahiri',
        email: '2106302@kiit.ac.in',
      },
      {
        name: '1915_PRITI PALLABHI MISHRA',
        email: '21051915@kiit.ac.in',
      },
      {
        name: 'Utkarsh Kumar Gupta',
        email: '21051525@kiit.ac.in',
      },
      {
        name: '1148_NISHITA RAJU',
        email: '21051148@kiit.ac.in',
      },
      {
        name: '1952_NEHA KUMARI',
        email: '22051952@kiit.ac.in',
      },
      {
        name: '6044_Pritam Mahata',
        email: '2106044@kiit.ac.in',
      },
      {
        name: '3039 Varutri Parihar',
        email: '22053039@kiit.ac.in',
      },
      {
        name: '517_RAHUL KUMAR',
        email: '2105517@kiit.ac.in',
      },
      {
        name: '481_RUDRANSH BHARADWAJ',
        email: '2105481@kiit.ac.in',
      },
      {
        name: '856_ Aishwarya Kumari',
        email: '2105856@kiit.ac.in',
      },
      {
        name: '382 KAUSHAL KISHOR',
        email: '22054382@kiit.ac.in',
      },
      {
        name: 'AVIRAL SRIVASTAVA',
        email: '22052806@kiit.ac.in',
      },
      {
        name: '2105_SHREYA SHASHANK',
        email: '21052105@kiit.ac.in',
      },
      {
        name: 'KUNAL SAHA',
        email: '2328023@kiit.ac.in',
      },
      {
        name: '827_SHASHANK DEEPAK',
        email: '2105827@kiit.ac.in',
      },
      {
        name: '3739_YASHITA ONDHIA',
        email: '22053739@kiit.ac.in',
      },
      {
        name: '1167_KHUSHAL JHINGAN',
        email: '22051167@kiit.ac.in',
      },
      {
        name: '398- RIMO GHOSH',
        email: '2105398@kiit.ac.in',
      },
      {
        name: 'YUVRAJ SINGH',
        email: '22054366@kiit.ac.in',
      },
      {
        name: '1424 HARSHITA SHREYA',
        email: '22051424@kiit.ac.in',
      },
      {
        name: '172_ Abhay Singh',
        email: '2105172@kiit.ac.in',
      },
      {
        name: 'NIRAMAY PUNETHA',
        email: '22051264@kiit.ac.in',
      },
      {
        name: '2502_Himanshu Pradhan',
        email: '21052502@kiit.ac.in',
      },
      {
        name: '1050_ Mukesh Kumar',
        email: '21051050@kiit.ac.in',
      },
      {
        name: '2601_SOURAV PRASAD',
        email: '22052601@kiit.ac.in',
      },
      {
        name: '6338_Debasmith Mishra',
        email: '2206338@kiit.ac.in',
      },
      {
        name: '3969 Rajdeep Roy Chowdhury',
        email: '22053969@kiit.ac.in',
      },
      {
        name: '1900_ KHUSHAL JENA',
        email: '21051900@kiit.ac.in',
      },
      {
        name: 'ERIC MUKUL',
        email: '22051515@kiit.ac.in',
      },
      {
        name: '584 Hardik Ahuja',
        email: '22051584@kiit.ac.in',
      },
      {
        name: '1425-IFRA IMAM',
        email: '22051425@kiit.ac.in',
      },
      {
        name: '2791_ Sakshi Kumari',
        email: '21052791@kiit.ac.in',
      },
      {
        name: '682_Pratham',
        email: '21052682@kiit.ac.in',
      },
      {
        name: '2366_SOUNAK JYOTI',
        email: '21052366@kiit.ac.in',
      },
      {
        name: '742_SAMRIDDHI SINGH',
        email: '2105742@kiit.ac.in',
      },
      {
        name: '1812_DEEPANKAR SINGH',
        email: '21051812@kiit.ac.in',
      },
      {
        name: 'SURYANSH TRIVEDI',
        email: '22052516@kiit.ac.in',
      },
      {
        name: '3701_PRADOSHA DHAL',
        email: '22053701@kiit.ac.in',
      },
      {
        name: '1218_PRANTIK BARIK',
        email: '21051218@kiit.ac.in',
      },
      {
        name: 'DEBANGSHU SAIKIA',
        email: '22052809@kiit.ac.in',
      },
      {
        name: '6202_BIKASH KUMAR MAHANTA',
        email: '2106202@kiit.ac.in',
      },
      {
        name: '336_ADITI KHUNTIA',
        email: '2105336@kiit.ac.in',
      },
      {
        name: '5864- Annika Singh',
        email: '2105864@kiit.ac.in',
      },
      {
        name: '480_ANTRA AMRIT',
        email: '21052480@kiit.ac.in',
      },
      {
        name: 'SHREYANSH',
        email: '22052507@kiit.ac.in',
      },
      {
        name: '1916_ALLU YESWANTH',
        email: '22051916@kiit.ac.in',
      },
      {
        name: '881_Aritra Pal',
        email: '21051881@kiit.ac.in',
      },
      {
        name: '777 Swastika',
        email: '22052777@kiit.ac.in',
      },
      {
        name: '6301 _SHIV SHANKAR',
        email: '2106301@kiit.ac.in',
      },
      {
        name: '3256_ Aaditya Karna',
        email: '21053256@kiit.ac.in',
      },
      {
        name: 'ADWETA MISHRA',
        email: '22053837@kiit.ac.in',
      },
      {
        name: '1909_Mokshada Mohapatra',
        email: '21051909@kiit.ac.in',
      },
      {
        name: 'AYUSHMAN PANIGRAHI',
        email: '22053590@kiit.ac.in',
      },
      {
        name: '8110 DHRUBADITYA CHAKRABARTY (2228110)',
        email: '2228110@kiit.ac.in',
      },
      {
        name: '472_ADITYA SHARMA',
        email: '21052472@kiit.ac.in',
      },
      {
        name: '1117_ Amit Sinha',
        email: '21051117@kiit.ac.in',
      },
      {
        name: '542_Anupam_Anubhav',
        email: '21051542@kiit.ac.in',
      },
      {
        name: 'MICHAEL SENKAO',
        email: '21053295@kiit.ac.in',
      },
      {
        name: '869-ARYAMAN ACHARYA',
        email: '2105869@kiit.ac.in',
      },
      {
        name: 'Ali Rizvi',
        email: '22052616@kiit.ac.in',
      },
      {
        name: 'DEVJIT MONDAL',
        email: '22052550@kiit.ac.in',
      },
      {
        name: '7029_DIBYANSU MISHRA',
        email: '22057029@kiit.ac.in',
      },
      {
        name: 'ANUSHA TRIPATHI',
        email: '22051839@kiit.ac.in',
      },
      {
        name: 'SAKSHI ANAND (22053349)',
        email: '22053349@kiit.ac.in',
      },
      {
        name: 'DIVYANSHU KUMAR',
        email: '22052898@kiit.ac.in',
      },
      {
        name: '2020_C Sai laxmi Gayatri',
        email: '22052020@kiit.ac.in',
      },
      {
        name: '6006 Akash',
        email: '2206006@kiit.ac.in',
      },
      {
        name: 'ADARSH NAYAK (22053481)',
        email: '22053481@kiit.ac.in',
      },
      {
        name: '2425_KALLA SAI SURAJ',
        email: '21052425@kiit.ac.in',
      },
      {
        name: 'SALONI GOEL',
        email: '2205497@kiit.ac.in',
      },
      {
        name: '1283 Simran',
        email: '22051283@kiit.ac.in',
      },
      {
        name: '1885_AYUSH BISWAS',
        email: '21051885@kiit.ac.in',
      },
      {
        name: '161_SHRUTI KUMARI',
        email: '2205161@kiit.ac.in',
      },
      {
        name: 'NANDAKISHORE GUCHHAIT',
        email: '2230092@kiit.ac.in',
      },
      {
        name: 'Shreya',
        email: '22053022@kiit.ac.in',
      },
      {
        name: '1325_AKSHAT GUPTA',
        email: '23051325@kiit.ac.in',
      },
      {
        name: '1452 SAHIL KHILAR',
        email: '22051452@kiit.ac.in',
      },
      {
        name: '4020_Arsh',
        email: '22054020@kiit.ac.in',
      },
      {
        name: 'M SUDEEP',
        email: '2228034@kiit.ac.in',
      },
      {
        name: '4246-SOMYA BEHERA',
        email: '22054246@kiit.ac.in',
      },
      {
        name: '4063_pappu',
        email: '22054063@kiit.ac.in',
      },
      {
        name: '3189_SAPTAK GUHA',
        email: '22053189@kiit.ac.in',
      },
      {
        name: '4030_ Bibek_Das',
        email: '22054030@kiit.ac.in',
      },
      {
        name: '1000_SAYANDIP ADHIKARI',
        email: '21051000@kiit.ac.in',
      },
      {
        name: '023 DHIMAN RAY',
        email: '2306023@kiit.ac.in',
      },
      {
        name: 'MANGAL KAMAKHI BISWASROY',
        email: '22053872@kiit.ac.in',
      },
      {
        name: '318_SHREEYANSHI CHANDRA',
        email: '2105318@kiit.ac.in',
      },
      {
        name: '2165_Nihar Ranjan',
        email: '21052165@kiit.ac.in',
      },
      {
        name: '9142_HARSH VARDHAN JHA',
        email: '2129142@kiit.ac.in',
      },
      {
        name: 'TEJASVI SINGH',
        email: '2205077@kiit.ac.in',
      },
      {
        name: '4152 HARSHITA BINAYAKIA',
        email: '22054152@kiit.ac.in',
      },
      {
        name: 'SHAMIK BHATTCHARJEE',
        email: '23053327@kiit.ac.in',
      },
      {
        name: '3461_Prajwal Yadav',
        email: '21053461@kiit.ac.in',
      },
      {
        name: 'Shubham Agarwal',
        email: '2305337@kiit.ac.in',
      },
      {
        name: '2804_NAZIM QURESHI',
        email: '21052804@kiit.ac.in',
      },
      {
        name: '1864_MANAJIT MONDAL',
        email: '22051864@kiit.ac.in',
      },
      {
        name: '1019_VAISHNAVI KUMAR',
        email: '21051019@kiit.ac.in',
      },
      {
        name: '4370_ROHAN_KUSHWAHA',
        email: '22054370@kiit.ac.in',
      },
      {
        name: '1367_ADARSH RAI',
        email: '21051367@kiit.ac.in',
      },
      {
        name: 'SATWIK MOHANTY',
        email: '2229155@kiit.ac.in',
      },
      {
        name: '3473-SIDDHARTHA GUPTA',
        email: '23053473@kiit.ac.in',
      },
      {
        name: '2652_ANUBHAV RANJAN',
        email: '21052652@kiit.ac.in',
      },
      {
        name: '853_SUBHAM PANDA',
        email: '21051853@kiit.ac.in',
      },
      {
        name: 'ANUBHAB DUTTA',
        email: '23053677@kiit.ac.in',
      },
      {
        name: 'PRACHI SAURABH',
        email: '2105389@kiit.ac.in',
      },
      {
        name: 'LAMBODAR SARANGI',
        email: '2230089@kiit.ac.in',
      },
      {
        name: '4076_Rishavrajmandal',
        email: '22054076@kiit.ac.in',
      },
      {
        name: '1816_DIYA CHAKRABORTY',
        email: '21051816@kiit.ac.in',
      },
      {
        name: '4044_PRIYANSHU KUMAR',
        email: '2204044@kiit.ac.in',
      },
      {
        name: '843_SUYASH DUTTA',
        email: '2105843@kiit.ac.in',
      },
      {
        name: '495_DHRUV KUMAR',
        email: '21052495@kiit.ac.in',
      },
      {
        name: 'AHANA DWARY',
        email: '2229093@kiit.ac.in',
      },
      {
        name: '1488_AKANKSHA GUPTA',
        email: '22051488@kiit.ac.in',
      },
      {
        name: '173_OM SINHA',
        email: '22053173@kiit.ac.in',
      },
      {
        name: '3127 YASH JHA',
        email: '22053127@kiit.ac.in',
      },
      {
        name: '219_MANAN SRIVASTAVA',
        email: '2205219@kiit.ac.in',
      },
      {
        name: '211 KUMAR ROSHAN',
        email: '21053211@kiit.ac.in',
      },
      {
        name: '421_SOUDEEP GHOSHAL',
        email: '2205421@kiit.ac.in',
      },
      {
        name: 'MAYANK RAJ',
        email: '22052560@kiit.ac.in',
      },
      {
        name: '1090-ARYAMAN SANSKRITYAYAN (23051090)',
        email: '23051090@kiit.ac.in',
      },
      {
        name: 'BISHESH SAHOO',
        email: '22057023@kiit.ac.in',
      },
      {
        name: 'SHREEYA DEBNATH (22053628_Shreeya Debnath)',
        email: '22053628@kiit.ac.in',
      },
      {
        name: 'PRATYUSH SINGH_1961',
        email: '22051961@kiit.ac.in',
      },
      {
        name: '2304_Khyati Agarwal',
        email: '22052304@kiit.ac.in',
      },
      {
        name: 'SHASHANK PRATYUSH',
        email: '22051792@kiit.ac.in',
      },
      {
        name: '127_DEBADUTTA JENA',
        email: '21051127@kiit.ac.in',
      },
      {
        name: 'GITESH KUMAR',
        email: '22054287@kiit.ac.in',
      },
      {
        name: '2811_Dev Shubhankar',
        email: '22052811@kiit.ac.in',
      },
      {
        name: '460_Bhaskar Lalwani',
        email: '2205460@kiit.ac.in',
      },
      {
        name: 'SHUBH AGNIHOTRI',
        email: '2305336@kiit.ac.in',
      },
      {
        name: 'NAURAV KUMAR',
        email: '2228036@kiit.ac.in',
      },
      {
        name: '602_NABASURJA DATTA',
        email: '2306602@kiit.ac.in',
      },
      {
        name: '3611_PIYUSH KUMAR JENA',
        email: '22053611@kiit.ac.in',
      },
      {
        name: '265_ADITYA MOHANTY',
        email: '2205265@kiit.ac.in',
      },
      {
        name: 'AKASH AGRAWAL',
        email: '2105219@kiit.ac.in',
      },
      {
        name: 'AMIT BEHERA',
        email: '23053383@kiit.ac.in',
      },
      {
        name: '369 MAYANK K KAUSHIK',
        email: '21053369@kiit.ac.in',
      },
      {
        name: 'SATYAJEET SEN',
        email: '2305155@kiit.ac.in',
      },
      {
        name: 'ANKIT BISWAS',
        email: '22052533@kiit.ac.in',
      },
      {
        name: 'DEBASMITA CHANDA',
        email: '23051826@kiit.ac.in',
      },
      {
        name: '146_SANDIPAN JANA',
        email: '2105146@kiit.ac.in',
      },
      {
        name: '5180_ANIKET BHARDWAJ',
        email: '2205180@kiit.ac.in',
      },
      {
        name: 'Never Exists',
        email: 'neverexists@gmail.com',
      },
      {
        name: 'DEBKANTA PAUL',
        email: '2305694@kiit.ac.in',
      },
      {
        name: 'PRERIT PANDEY',
        email: '22053333@kiit.ac.in',
      },
      {
        name: '365_Debasish Das',
        email: '2105365@kiit.ac.in',
      },
      {
        name: 'ALI SAMAD',
        email: '22051660@kiit.ac.in',
      },
      {
        name: '3604_Kushagra Yadav',
        email: '22053604@kiit.ac.in',
      },
      {
        name: '468_Meghana Sree Kamana',
        email: '2105468@kiit.ac.in',
      },
      {
        name: 'JAY KUMAR',
        email: '23052492@kiit.ac.in',
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
      await this.mailService.sendNotPremium('test', '21053420@kiit.', 0);
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
    const user1 = [
      { email: '2005171@kiit.ac.in', name: 'JITENDRA  SAINI' },
      { email: '2105060@kiit.ac.in', name: 'SAGAR  MAITY' },
      { email: '2105146@kiit.ac.in', name: 'SANDIPAN  JANA' },
      { email: '2105166@kiit.ac.in', name: 'SWARNIM  MANDAL' },
      { email: '2105310@kiit.ac.in', name: 'SAMPREET VEER SINGH' },
      { email: '2105364@kiit.ac.in', name: 'BHRAMARI  SARKAR' },
      { email: '2105429@kiit.ac.in', name: 'ABHINAV  RAJ' },
      { email: '2105441@kiit.ac.in', name: 'ANIMESH  JHA' },
      { email: '2105454@kiit.ac.in', name: 'DEEPAK  YADAV' },
      { email: '2105478@kiit.ac.in', name: 'RAHUL  RANJAN' },
      { email: '2105519@kiit.ac.in', name: 'ADITYA  SINHA' },
      { email: '2105897@kiit.ac.in', name: 'LOPAMUDRA  DALAI' },
      { email: '2105960@kiit.ac.in', name: 'DEBOLINA  RAY' },
      { email: '2105989@kiit.ac.in', name: 'RINKESH KUMAR SINHA' },
      { email: '2106259@kiit.ac.in', name: 'SOUMYA  PRAMANIK' },
      { email: '2106271@kiit.ac.in', name: 'SYAMANTAK  DUTTA' },
      { email: '2129146@kiit.ac.in', name: 'ANTARYAMI  SING' },
      { email: '2129147@kiit.ac.in', name: 'BASUDEV  MALLICK' },
      { email: '2129149@kiit.ac.in', name: 'DHARAMENDRA  SING' },
      { email: '2129150@kiit.ac.in', name: 'KUNA  HASADA' },
      { email: '2129152@kiit.ac.in', name: 'MANJU  BASKEY' },
      { email: '21051102@kiit.ac.in', name: 'UJJAWAL  SINGH' },
      { email: '21051203@kiit.ac.in', name: 'ANIRBAN  SARKAR' },
      { email: '21051229@kiit.ac.in', name: 'NITU  KUMARI' },
      { email: '21051400@kiit.ac.in', name: 'KRISHNAKALI  BANERJEE' },
      { email: '21051401@kiit.ac.in', name: 'KRITI  SRIVASTAVA' },
      { email: '21051410@kiit.ac.in', name: 'NILAY  SHUKLA' },
      { email: '21051432@kiit.ac.in', name: 'SIDDHANT  SAHA' },
      { email: '21051629@kiit.ac.in', name: 'ANIRBAN  ROY' },
      { email: '21051936@kiit.ac.in', name: 'SHREYAS  PANDE' },
      { email: '21052057@kiit.ac.in', name: 'ARITRA  BHATTACHARYA' },
      { email: '21052062@kiit.ac.in', name: 'ASHUTOSH  PRASAD' },
      { email: '21052091@kiit.ac.in', name: 'RAKSHIT  AGRAWAL' },
      { email: '21052231@kiit.ac.in', name: 'TANMAY  PANDEY' },
      { email: '21052354@kiit.ac.in', name: 'SAMBIT  MISHRA' },
      { email: '21052360@kiit.ac.in', name: 'SHIRSHAK  PATTNAIK' },
      { email: '21052421@kiit.ac.in', name: 'ISHITA  SINGH' },
      { email: '21052521@kiit.ac.in', name: 'RAJARSHI  GHOSH' },
      { email: '21052579@kiit.ac.in', name: 'BIPRAJIT  GHOSHAL' },
      { email: '21052586@kiit.ac.in', name: 'GOURAB  BAROI' },
      { email: '21052788@kiit.ac.in', name: 'SARTHAK  SATAPATHY' },
      { email: '21052918@kiit.ac.in', name: 'SAUMYADEEP  MAHANTA' },
      { email: '21052956@kiit.ac.in', name: 'SWAYAM  YADAV' },
      { email: '21052969@kiit.ac.in', name: 'AARNAV' },
      { email: '21052996@kiit.ac.in', name: 'PRACHI  MOHANTY' },
      { email: '21053247@kiit.ac.in', name: 'ROHIT  RAJ' },
      { email: '21053358@kiit.ac.in', name: 'RAHUL  KUMAR' },
      { email: '22057070@kiit.ac.in', name: 'SUBRADEEP  GHOSH' },
      { email: '2105068@kiit.ac.in', name: 'SHIVAM  JHA' },
      { email: '2105095@kiit.ac.in', name: 'ADITYA  SHRIVASTAVA' },
      { email: '2105119@kiit.ac.in', name: 'DEVIPRASAD  NAYAK' },
      { email: '2105132@kiit.ac.in', name: 'PRANJALI  YADAV' },
      { email: '2105236@kiit.ac.in', name: 'SAYAK  HATUI' },
      { email: '2105335@kiit.ac.in', name: 'TRISHANKU  SATPATHY' },
      { email: '2105456@kiit.ac.in', name: 'DIYANSHI  SHARMA' },
      { email: '2105641@kiit.ac.in', name: 'PREETIPARNA  MISHRA' },
      { email: '2105724@kiit.ac.in', name: 'N PAVAN  KUMAR' },
      { email: '2105895@kiit.ac.in', name: 'JAYANTI  GOSWAMI' },
      { email: '2105913@kiit.ac.in', name: 'KIRITI AAJAD' },
      { email: '2106027@kiit.ac.in', name: 'DIYA  DAS' },
      { email: '2106030@kiit.ac.in', name: 'GYANESH  BHUYAN' },
      { email: '2106210@kiit.ac.in', name: 'G SIDDHI SUDARSHAN' },
      { email: '2129034@kiit.ac.in', name: 'SHREYON  GHOSH' },
      { email: '2129084@kiit.ac.in', name: 'PRATYUSHA  CHOUDHURY' },
      { email: '2129142@kiit.ac.in', name: 'HARSH VARDHAN JHA' },
      { email: '2129155@kiit.ac.in', name: 'MUKUND KUMAR RAUT' },
      { email: '21051070@kiit.ac.in', name: 'PALASH KRISHNA VISHWAS' },
      { email: '21051104@kiit.ac.in', name: 'ABHINAV  UNIYAL' },
      { email: '21051225@kiit.ac.in', name: 'LIKHITA  SAHU' },
      { email: '21051226@kiit.ac.in', name: 'MAYUKH  PATRA' },
      { email: '21051269@kiit.ac.in', name: 'UTKARSH  CHOUDHARY' },
      { email: '21051322@kiit.ac.in', name: 'PULKIT  BHARDWAJ' },
      { email: '21051366@kiit.ac.in', name: 'ABHISHEK KUMAR' },
      { email: '21051427@kiit.ac.in', name: 'SHIVPREET  PADHI' },
      { email: '21051543@kiit.ac.in', name: 'ANUROOP  ROY' },
      { email: '21051692@kiit.ac.in', name: 'SOURISH  DAS' },
      { email: '21051760@kiit.ac.in', name: 'SANGRAM KESHARI OJHA' },
      { email: '21051941@kiit.ac.in', name: 'SNEHA  CHATTERJEE' },
      { email: '21052039@kiit.ac.in', name: 'TISHYA  MOULICK' },
      { email: '21052067@kiit.ac.in', name: 'DEEPMALYA  SINHA' },
      { email: '21052073@kiit.ac.in', name: 'JANHAVEE  SINGH' },
      { email: '21052239@kiit.ac.in', name: 'ASTHA  NATHANI' },
      { email: '21052240@kiit.ac.in', name: 'AYUSH  DWIVEDI' },
      { email: '21052262@kiit.ac.in', name: 'PANKAJ  KUMAR' },
      { email: '21052286@kiit.ac.in', name: 'SOURODEEP  KUNDU' },
      { email: '21052318@kiit.ac.in', name: 'BIDIPTA  BHOWMIK' },
      { email: '21052323@kiit.ac.in', name: 'DIVYANSH SINGH BISHT' },
      { email: '21052447@kiit.ac.in', name: 'ARATRIKA  BASAK' },
      { email: '21052536@kiit.ac.in', name: 'SOUMILI  GHOSH' },
      { email: '21052538@kiit.ac.in', name: 'SRIJITA  MAITI' },
      { email: '21052599@kiit.ac.in', name: 'NANDINI  DAS' },
      { email: '21052674@kiit.ac.in', name: 'M  ADITYA' },
      { email: '21052759@kiit.ac.in', name: 'GOURAV  CHAKRABORTY' },
      { email: '21052797@kiit.ac.in', name: 'SUBHADIP  SASMAL' },
      { email: '21052989@kiit.ac.in', name: 'KAUSIK  KAR' },
      { email: '21053218@kiit.ac.in', name: 'SANKALP  MOHANTY' },
      { email: '21053356@kiit.ac.in', name: 'SHASHWAT  MISHRA' },
      { email: '21053449@kiit.ac.in', name: 'KRISHNA  SHREEVASTAV' },
      { email: '22057022@kiit.ac.in', name: 'B TARUN KUMAR' },
      { email: '22057082@kiit.ac.in', name: 'LISA  NAYAK' },
      { email: '2105006@kiit.ac.in', name: 'AKASH  SHARMA' },
      { email: '2105014@kiit.ac.in', name: 'ANURAG  DAS' },
      { email: '2105024@kiit.ac.in', name: 'AYUSH  MOHAPATRA' },
      { email: '2105118@kiit.ac.in', name: 'DEONANDINI  SINGH' },
      { email: '2105231@kiit.ac.in', name: 'SACHIN KUMAR' },
      { email: '2105241@kiit.ac.in', name: 'SHREYA  TIWARI' },
      { email: '2105243@kiit.ac.in', name: 'SHUBHIKA KASHYAP OJHA' },
      { email: '2105325@kiit.ac.in', name: 'SOUMYAJIT  MAITY' },
      { email: '2105345@kiit.ac.in', name: 'ABHILASH  BANDYOPADHYAY' },
      { email: '2105347@kiit.ac.in', name: 'ABHIRUP  CHOWDHURY' },
      { email: '2105403@kiit.ac.in', name: 'SATTWIK  SEN' },
      { email: '2105464@kiit.ac.in', name: 'KHUSHI  BHADANI' },
      { email: '2105486@kiit.ac.in', name: 'SANNIDHYA  SARANSH' },
      { email: '2105515@kiit.ac.in', name: 'ADITYA  DALAL' },
      { email: '2105533@kiit.ac.in', name: 'AVINASH CHANDRASHEKHAR PARUGOND' },
      { email: '2105642@kiit.ac.in', name: 'PRITAM  ADHYA' },
      { email: '2105690@kiit.ac.in', name: 'AMIT KUMAR YADAV' },
      { email: '2105775@kiit.ac.in', name: 'ANWAY  GHOSH' },
      { email: '2105777@kiit.ac.in', name: 'ARYAN  MAITRA' },
      { email: '2105800@kiit.ac.in', name: 'KARTHIK SARMA DHULIPATI' },
      { email: '2105847@kiit.ac.in', name: 'VISHAL  BANERJEE' },
      { email: '2105884@kiit.ac.in', name: 'GITISHAN  BISWAL' },
      { email: '2105951@kiit.ac.in', name: 'ARNAB  MAITY' },
      { email: '2106121@kiit.ac.in', name: 'KANISHK  SHUKLA' },
      { email: '2106126@kiit.ac.in', name: 'NILESH KUMAR THAKUR' },
      { email: '2106142@kiit.ac.in', name: 'RAHUL  KUMAR' },
      { email: '2106152@kiit.ac.in', name: 'SHASWAT  KUMAR' },
      { email: '2106155@kiit.ac.in', name: 'SHRUTI  KUMARI' },
      { email: '2106186@kiit.ac.in', name: 'ANIMIT  DASH' },
      { email: '2106188@kiit.ac.in', name: 'ANKUR' },
      { email: '2106193@kiit.ac.in', name: 'ARYAN' },
      { email: '2106194@kiit.ac.in', name: 'ARYAN  CHOURASIA' },
      { email: '2106204@kiit.ac.in', name: 'CHANDRAGUPTA  MAURYA' },
      { email: '2106255@kiit.ac.in', name: 'SHIVANSHU KRISHNA GUPTA' },
      { email: '2106258@kiit.ac.in', name: 'SOM PRAKASH SAHU' },
      { email: '2129074@kiit.ac.in', name: 'KHUSHI  RAI' },
      { email: '2129102@kiit.ac.in', name: 'SHASWAT  NANDAN' },
      { email: '2129106@kiit.ac.in', name: 'SHREYASH  SINGH' },
      { email: '21051047@kiit.ac.in', name: 'DEBARGHYA  ROY' },
      { email: '21051221@kiit.ac.in', name: 'IRAM SIDDIQUI' },
      { email: '21051232@kiit.ac.in', name: 'PRANAV  VARSHNEY' },
      { email: '21051238@kiit.ac.in', name: 'RAVI  RANJAN' },
      { email: '21051244@kiit.ac.in', name: 'SAMIKSHA  ALOK' },
      { email: '21051252@kiit.ac.in', name: 'SATYAM  RAJ' },
      { email: '21051262@kiit.ac.in', name: 'SOUMYA KANTI DATTA' },
      { email: '21051263@kiit.ac.in', name: 'SRIJAN  AGRAWAL' },
      { email: '21051271@kiit.ac.in', name: 'UTSAV JAIVISHNU CHOUDHARY' },
      { email: '21051292@kiit.ac.in', name: 'ARYAN  KUMAR' },
      { email: '21051459@kiit.ac.in', name: 'ANJALI KUMARI SINGH' },
      { email: '21051648@kiit.ac.in', name: 'DEVAANSH  SAXENA' },
      { email: '21051675@kiit.ac.in', name: 'PULKIT  GOYAL' },
      { email: '21051682@kiit.ac.in', name: 'SHASHI  RANJAN' },
      { email: '21051707@kiit.ac.in', name: 'ABHISHEK KUMAR' },
      { email: '21051861@kiit.ac.in', name: 'TRISHA  GHOSH' },
      { email: '21051968@kiit.ac.in', name: 'ANEEKESH  RAJ' },
      { email: '21052001@kiit.ac.in', name: 'KHUSHI  KUMARI' },
      { email: '21052019@kiit.ac.in', name: 'RITIKESH  KUMAR' },
      { email: '21052209@kiit.ac.in', name: 'WAIBHAV  JHA' },
      { email: '21052326@kiit.ac.in', name: 'ESHA  MONDAL' },
      { email: '21052584@kiit.ac.in', name: 'HARSHIT KUMAR VERMA' },
      { email: '21052767@kiit.ac.in', name: 'MANAS  NATRAJ' },
      { email: '21052798@kiit.ac.in', name: 'SUBHAM SURANJAN DASH' },
      { email: '21052851@kiit.ac.in', name: 'PAYAL  BURMAN' },
      { email: '21052862@kiit.ac.in', name: 'RITIKA SHAILJA' },
      { email: '21052920@kiit.ac.in', name: 'SHUBHAM  KUMAR' },
      { email: '21053232@kiit.ac.in', name: 'PARTH  BATRA' },
      { email: '21053345@kiit.ac.in', name: 'MAHI  KUMARI' },
      { email: '21053361@kiit.ac.in', name: 'SIDDHARTH  GUPTA' },
      { email: '21053383@kiit.ac.in', name: 'NIRMAL KUMAR GUPTA' },
      { email: '2105053@kiit.ac.in', name: 'RANJANA  SAHA' },
      { email: '2105063@kiit.ac.in', name: 'SAKSHI ARUNIMA XALXO' },
      { email: '2105117@kiit.ac.in', name: 'DEBASMITA  DHAR' },
      { email: '2105130@kiit.ac.in', name: 'OWAIZ  KHAN' },
      { email: '2105137@kiit.ac.in', name: 'RAGHAV  KILLA' },
      { email: '2105145@kiit.ac.in', name: 'SANANYA  NANDI' },
      { email: '2105148@kiit.ac.in', name: 'SANJEEV  CHOUBEY' },
      { email: '2105210@kiit.ac.in', name: 'MOHIT  SHEKHAR' },
      { email: '2105224@kiit.ac.in', name: 'RAUL  DAS' },
      { email: '2105263@kiit.ac.in', name: 'ANKIT KUMAR' },
      { email: '2105286@kiit.ac.in', name: 'MOHAK VAGISH PATHAK' },
      { email: '2105301@kiit.ac.in', name: 'RISHABH  SHUKLA' },
      { email: '2105303@kiit.ac.in', name: 'RITIK  RAJ' },
      { email: '2105309@kiit.ac.in', name: 'SAKSHAM  SRIVASTAVA' },
      { email: '2105315@kiit.ac.in', name: 'SAYAN SHOURYA MUHURI' },
      { email: '2105337@kiit.ac.in', name: 'ABHAY NATH SHARMA' },
      { email: '2105338@kiit.ac.in', name: 'VIKALP  RAJ' },
      { email: '2105353@kiit.ac.in', name: 'AMISHA  KUMARI' },
      { email: '2105444@kiit.ac.in', name: 'ANKUSH  BANDYOPADHYAY' },
      { email: '2105452@kiit.ac.in', name: 'D CHANDRASHEKHAR  REDDY' },
      { email: '2105471@kiit.ac.in', name: 'NAMRATA  MAHAPATRA' },
      { email: '2105490@kiit.ac.in', name: 'SHASHWAT  NAIK' },
      { email: '2105501@kiit.ac.in', name: 'SOUMYADEEP  PAUL' },
      { email: '2105535@kiit.ac.in', name: 'AYUSH  KUMAR' },
      { email: '2105580@kiit.ac.in', name: 'SHATADRU  BANERJEE' },
      { email: '2105587@kiit.ac.in', name: 'TANISHQ  CHAURASIA' },
      { email: '2105591@kiit.ac.in', name: 'UDIT NARAYAN PRASAD' },
      { email: '2105634@kiit.ac.in', name: 'OM  SINGH' },
      { email: '2105662@kiit.ac.in', name: 'SHAURYA  BISHT' },
      { email: '2105664@kiit.ac.in', name: 'SHIBANI  SARKAR' },
      { email: '2105681@kiit.ac.in', name: 'SANCHARI  CHOWDHURY' },
      { email: '2105700@kiit.ac.in', name: 'ARCHISHA  VERMA' },
      { email: '2105798@kiit.ac.in', name: 'HEETESH PRIYADARSHI  BHANJA' },
      { email: '2105805@kiit.ac.in', name: 'MARIA GEORGE' },
      { email: '2105853@kiit.ac.in', name: 'DIPANJAN  KAMILLA' },
      { email: '2105892@kiit.ac.in', name: 'INDRANATH  MODAK' },
      { email: '2105904@kiit.ac.in', name: 'PRANSHU  SAHAY' },
      { email: '2105978@kiit.ac.in', name: 'PALLAVI' },
      { email: '2105979@kiit.ac.in', name: 'PRACHI  ARUNIMA' },
      { email: '2106012@kiit.ac.in', name: 'ANASH  RAJ' },
      { email: '2106014@kiit.ac.in', name: 'ARJUN  SHANDILYA' },
      { email: '2106044@kiit.ac.in', name: 'PRITAM  MAHATA' },
      { email: '2106095@kiit.ac.in', name: 'ANSUL  DASH' },
      { email: '2106145@kiit.ac.in', name: 'RAJAT  PATIDAR' },
      { email: '2106293@kiit.ac.in', name: 'ADARSH  ANURAG' },
      { email: '2128067@kiit.ac.in', name: 'ARYAN RAJ' },
      { email: '2128071@kiit.ac.in', name: 'BHASKAR CHANDRA MANDAL' },
      { email: '2128076@kiit.ac.in', name: 'KUMAR  ANIKET' },
      { email: '2128079@kiit.ac.in', name: 'NIKHIL  RAJ' },
      { email: '2129031@kiit.ac.in', name: 'RESHAM  JHA' },
      { email: '2129040@kiit.ac.in', name: 'VAIBHAV  RAJ' },
      { email: '2129059@kiit.ac.in', name: 'ASHISH  KUMAR' },
      { email: '2129096@kiit.ac.in', name: 'SAKSHI  MAURYA' },
      { email: '2129125@kiit.ac.in', name: 'VIVEK KUMAR BHARTI' },
      { email: '21051000@kiit.ac.in', name: 'SAYANDIP  ADHIKARI' },
      { email: '21051001@kiit.ac.in', name: 'SHAKIB AMAN MAZUMDER' },
      { email: '21051016@kiit.ac.in', name: 'RITIKA  RANI' },
      { email: '21051023@kiit.ac.in', name: 'ABDUL  MAJID' },
      { email: '21051038@kiit.ac.in', name: 'ARITRA  BANERJEE' },
      { email: '21051146@kiit.ac.in', name: 'MONOJIT  MAHATA' },
      { email: '21051171@kiit.ac.in', name: 'SHIVAM KUMAR SINGH' },
      { email: '21051323@kiit.ac.in', name: 'RAJ  SINGH' },
      { email: '21051349@kiit.ac.in', name: 'SUNIDHI  GOEL' },
      { email: '21051358@kiit.ac.in', name: 'VAISHNAVI  SINGH' },
      { email: '21051371@kiit.ac.in', name: 'AMIT KUMAR PANI' },
      { email: '21051445@kiit.ac.in', name: 'VIDHI  AGARWAL' },
      { email: '21051572@kiit.ac.in', name: 'KUMAR VIMLENDRA' },
      { email: '21051585@kiit.ac.in', name: 'RAHUL KUMAR SINGH' },
      { email: '21051586@kiit.ac.in', name: 'ANKITA  PADHY' },
      { email: '21051590@kiit.ac.in', name: 'SADAF  SHAHAB' },
      { email: '21051656@kiit.ac.in', name: 'KRITY  KUMARI' },
      { email: '21051676@kiit.ac.in', name: 'RISHI' },
      { email: '21051700@kiit.ac.in', name: 'VIVEK  JENA' },
      { email: '21051732@kiit.ac.in', name: 'SHIVAM  SINGH' },
      { email: '21051763@kiit.ac.in', name: 'SHIVANGI  DAS' },
      { email: '21051795@kiit.ac.in', name: 'AMBIKA PRASAD RATH' },
      { email: '21051810@kiit.ac.in', name: 'ARYAN  VERMA' },
      { email: '21051812@kiit.ac.in', name: 'DEEPANKAR  SINGH' },
      { email: '21051815@kiit.ac.in', name: 'DIPTANIL  DEY' },
      { email: '21051870@kiit.ac.in', name: 'ZAIN  HASHIM' },
      { email: '21051925@kiit.ac.in', name: 'SANDEEP  KUMAR' },
      { email: '21051932@kiit.ac.in', name: 'SHIVAM  MISHRA' },
      { email: '21051967@kiit.ac.in', name: 'AMRITA  SINHA' },
      { email: '21051983@kiit.ac.in', name: 'INDRANIL  BHATTACHARJEE' },
      { email: '21051999@kiit.ac.in', name: 'KAUSTUBH  SRIVASTAVA' },
      { email: '21052046@kiit.ac.in', name: 'ABHISIKTA  SENGUPTA' },
      { email: '21052069@kiit.ac.in', name: 'GEET  MAINI' },
      { email: '21052103@kiit.ac.in', name: 'SHIBANGI  GANTAYAT' },
      { email: '21052120@kiit.ac.in', name: 'TANMAY SACHCHIDANAND MOTE' },
      { email: '21052130@kiit.ac.in', name: 'ADARSH  KUMAR' },
      { email: '21052153@kiit.ac.in', name: 'GAGAN  BANSAL' },
      { email: '21052157@kiit.ac.in', name: 'JATIN  PRASAD' },
      { email: '21052168@kiit.ac.in', name: 'PRATEEK  SAHOO' },
      { email: '21052173@kiit.ac.in', name: 'RAJ  RATAN' },
      { email: '21052176@kiit.ac.in', name: 'RISHABH  PATHANIA' },
      { email: '21052190@kiit.ac.in', name: 'SHAURYA  SINGH' },
      { email: '21052196@kiit.ac.in', name: 'SIMRAN  SHREE' },
      { email: '21052251@kiit.ac.in', name: 'HARSHIT  SANGWAN' },
      { email: '21052278@kiit.ac.in', name: 'SHREYANSH  SRIVASTAVA' },
      { email: '21052287@kiit.ac.in', name: 'STHITAPRAJNYA  SAHOO' },
      { email: '21052311@kiit.ac.in', name: 'ASHISH  KUMAR' },
      { email: '21052327@kiit.ac.in', name: 'GOURAB  SAHA' },
      { email: '21052349@kiit.ac.in', name: 'RITOJA  PODDAR' },
      { email: '21052400@kiit.ac.in', name: 'ARJUN  DUTTA' },
      { email: '21052486@kiit.ac.in', name: 'ARYAN  KASHYAP' },
      { email: '21052495@kiit.ac.in', name: 'DHRUV  KUMAR' },
      { email: '21052519@kiit.ac.in', name: 'RACHIT  RAJ' },
      { email: '21052549@kiit.ac.in', name: 'ABHISHEK  KUMAR' },
      { email: '21052557@kiit.ac.in', name: 'ADYAN  RAUF' },
      { email: '21052567@kiit.ac.in', name: 'ANUNAY  KUMAR' },
      { email: '21052575@kiit.ac.in', name: 'AYUSH  AMULYA' },
      { email: '21052626@kiit.ac.in', name: 'SUJAL  GUPTA' },
      { email: '21052632@kiit.ac.in', name: 'UDITAA  GARG' },
      { email: '21052633@kiit.ac.in', name: 'UTKARSH  SINGH' },
      { email: '21052668@kiit.ac.in', name: 'JACOB GEORGE' },
      { email: '21052692@kiit.ac.in', name: 'RION  BARUA' },
      { email: '21052845@kiit.ac.in', name: 'MOHIT KUMAR PANDEY' },
      { email: '21052936@kiit.ac.in', name: 'ANURAG  JAISWAL' },
      { email: '21052938@kiit.ac.in', name: 'ASHISH  GUPTA' },
      { email: '21052939@kiit.ac.in', name: 'BIBHUTI  ADHIKARI' },
      { email: '21052944@kiit.ac.in', name: 'NIRANJAN  SAH' },
      { email: '21052946@kiit.ac.in', name: 'PURUSHOTAM PRASAD KURMI' },
      { email: '21052954@kiit.ac.in', name: 'SUNIL  YADAV' },
      { email: '21053234@kiit.ac.in', name: 'JAHANVI' },
      { email: '21053248@kiit.ac.in', name: 'DEEPIKA  SONI' },
      { email: '21053275@kiit.ac.in', name: 'BIJAY PRASAD  SHAH RAUNIYAR' },
      { email: '21053310@kiit.ac.in', name: 'RAHUL  YADAV' },
      { email: '21053316@kiit.ac.in', name: 'SAGAR  MAHATO' },
      { email: '21053330@kiit.ac.in', name: 'SUJEET KUMAR YADAV' },
      { email: '21053331@kiit.ac.in', name: 'SURYA NARAYAN SAH' },
      { email: '21053374@kiit.ac.in', name: 'PAWAN  GUPTA' },
      { email: '21053417@kiit.ac.in', name: 'PRITHVI NARAYAN SAH' },
      { email: '2105007@kiit.ac.in', name: 'AMLAN  MOHANTA' },
      { email: '2105035@kiit.ac.in', name: 'KUMAR  ADITYA' },
      { email: '2105036@kiit.ac.in', name: 'KUMAR ABHISHEK' },
      { email: '2105042@kiit.ac.in', name: 'NEESHIKANT  NANDA' },
      { email: '2105043@kiit.ac.in', name: 'NUPUR  MISHRA' },
      { email: '2105071@kiit.ac.in', name: 'SPANDAN  MONDAL' },
      { email: '2105096@kiit.ac.in', name: 'ADITYA  SINHA' },
      { email: '2105116@kiit.ac.in', name: 'DEBAPRATIM  PAUL' },
      { email: '2105167@kiit.ac.in', name: 'TAMONASH  GHOSH' },
      { email: '2105177@kiit.ac.in', name: 'AHELI  MANNA' },
      { email: '2105253@kiit.ac.in', name: 'VAIBHAV  SAHAY' },
      { email: '2105267@kiit.ac.in', name: 'ATREYEE  PATRA' },
      { email: '2105274@kiit.ac.in', name: 'ESHAAN  GUPTA' },
      { email: '2105297@kiit.ac.in', name: 'RAJOBRATA  DAS' },
      { email: '2105307@kiit.ac.in', name: 'ROSHAN  HAJRA' },
      { email: '2105340@kiit.ac.in', name: 'VURA  SURYA SUPRATHIK' },
      { email: '2105344@kiit.ac.in', name: 'AAYUSH  KUMAR' },
      { email: '2105348@kiit.ac.in', name: 'ABHISHEK  RANJAN' },
      { email: '2105359@kiit.ac.in', name: 'ARPITA  PAL' },
      { email: '2105368@kiit.ac.in', name: 'G  GAYATRI' },
      { email: '2105371@kiit.ac.in', name: 'HARSH  RAJ' },
      { email: '2105377@kiit.ac.in', name: 'KESHAV  SRIVASTAV' },
      { email: '2105397@kiit.ac.in', name: 'RAJ  NANDANI' },
      { email: '2105400@kiit.ac.in', name: 'ROHIT  NAYAK' },
      { email: '2105411@kiit.ac.in', name: 'SOUMYAM  SHARAN' },
      { email: '2105437@kiit.ac.in', name: 'AMAAN  BHATI' },
      { email: '2105479@kiit.ac.in', name: 'RAVI PRAKASH TIWARI' },
      { email: '2105491@kiit.ac.in', name: 'SHIBANI PRIYADARSHINI BASA' },
      { email: '2105502@kiit.ac.in', name: 'SREEJANEE  MANDAL' },
      { email: '2105507@kiit.ac.in', name: 'SWASTIK  SHARMA' },
      { email: '2105511@kiit.ac.in', name: 'AAKASH  KUMAR' },
      { email: '2105543@kiit.ac.in', name: 'HARSH  KUMAR' },
      { email: '2105550@kiit.ac.in', name: 'KRISHANU  ROY' },
      { email: '2105561@kiit.ac.in', name: 'OMPRAKASH  TRIPATHY' },
      { email: '2105570@kiit.ac.in', name: 'ROSHAN  ARYAN' },
      { email: '2105582@kiit.ac.in', name: 'SOUNAK  DUTTA' },
      { email: '2105583@kiit.ac.in', name: 'SOUVIK  BASAK' },
      { email: '2105586@kiit.ac.in', name: 'TANGUDU VIJAY SANKAR' },
      { email: '2105594@kiit.ac.in', name: 'VIJAY  VISHAL' },
      { email: '2105606@kiit.ac.in', name: 'KUNAL  PANIGRAHI' },
      { email: '2105638@kiit.ac.in', name: 'PRANJAL  SINGH' },
      { email: '2105650@kiit.ac.in', name: 'RITOBRATA  SARKAR' },
      { email: '2105808@kiit.ac.in', name: 'PALLAVI  KUMARI' },
      { email: '2105812@kiit.ac.in', name: 'PRIYAM  GHOSHAL' },
      { email: '2105841@kiit.ac.in', name: 'SUSREE SOUMYA ROUT' },
      { email: '2105885@kiit.ac.in', name: 'GOURAV  CHATTERJEE' },
      { email: '2105898@kiit.ac.in', name: 'MANASWINI  PATTANAIK' },
      { email: '2105918@kiit.ac.in', name: 'ROUNIT  KUMAR' },
      { email: '2105950@kiit.ac.in', name: 'ARIN  CHOUDHARY' },
      { email: '2105954@kiit.ac.in', name: 'ATRIJO  DUTTA' },
      { email: '2105973@kiit.ac.in', name: 'MUGDHA  SHARMA' },
      { email: '2106057@kiit.ac.in', name: 'SAMRIT  ROY' },
      { email: '2106075@kiit.ac.in', name: 'SWAPNA NEEL DAS' },
      { email: '2106076@kiit.ac.in', name: 'SWASTIK ROY CHOUDHURY' },
      { email: '2106091@kiit.ac.in', name: 'ANKIT  PRAKASH' },
      { email: '2106143@kiit.ac.in', name: 'RAIMA  MUKHERJEE' },
      { email: '2106163@kiit.ac.in', name: 'SOVAN KALYAN PATTANAYAK' },
      { email: '2106238@kiit.ac.in', name: 'RAJDEEP  DATTA' },
      { email: '2106239@kiit.ac.in', name: 'RISHABH  KHETAN' },
      { email: '2106248@kiit.ac.in', name: 'SAWANI AB DOSAJ' },
      { email: '2106270@kiit.ac.in', name: 'SURAJ KUMAR NAYAK' },
      { email: '2128021@kiit.ac.in', name: 'HARSH KUMAR NAYAK' },
      { email: '2128027@kiit.ac.in', name: 'MD SALIK SARFRAZ' },
      { email: '2128040@kiit.ac.in', name: 'RAJSHEKHAR  GHOSH' },
      { email: '2128049@kiit.ac.in', name: 'SARTHAK  MAITI' },
      { email: '2128060@kiit.ac.in', name: 'SHUBHAM  BOSE' },
      { email: '2129037@kiit.ac.in', name: 'SOUMYADEEP  PAUL' },
      { email: '2129075@kiit.ac.in', name: 'MADHURIMA  BANIK' },
      { email: '21051060@kiit.ac.in', name: 'KUNAL  KISHORE' },
      { email: '21051090@kiit.ac.in', name: 'SHASHANK  SHIVAM' },
      { email: '21051127@kiit.ac.in', name: 'DEBADUTTA  JENA' },
      { email: '21051128@kiit.ac.in', name: 'DEEPANJAN  SHIT' },
      { email: '21051222@kiit.ac.in', name: 'KANCHAN  BALA' },
      { email: '21051228@kiit.ac.in', name: 'MUSKAN  BAJAJ' },
      { email: '21051275@kiit.ac.in', name: 'VINIT  AGARWAL' },
      { email: '21051287@kiit.ac.in', name: 'ANUSHKA  PANDEY' },
      { email: '21051294@kiit.ac.in', name: 'ASHISH KUMAR SINGH' },
      { email: '21051308@kiit.ac.in', name: 'GOPAL  GUPTA' },
      { email: '21051309@kiit.ac.in', name: 'HARDATT SINGH RATHOD' },
      { email: '21051449@kiit.ac.in', name: 'ABHISHEK KUMAR TIWARI' },
      { email: '21051455@kiit.ac.in', name: 'ALOK KUMAR' },
      { email: '21051470@kiit.ac.in', name: 'ATHARV  GUPTA' },
      { email: '21051496@kiit.ac.in', name: 'PURNAVA  SARKAR' },
      { email: '21051499@kiit.ac.in', name: 'RAVIKANT  DIWAKAR' },
      { email: '21051516@kiit.ac.in', name: 'SIDDHANTH  SARGAM' },
      { email: '21051527@kiit.ac.in', name: 'VAIBHAV  TIWARI' },
      { email: '21051534@kiit.ac.in', name: 'ADITYA  CHOUDHARY' },
      { email: '21051535@kiit.ac.in', name: 'AMIT  KUMAR' },
      { email: '21051541@kiit.ac.in', name: 'ANSHUMAN  MAHAPATRA' },
      { email: '21051563@kiit.ac.in', name: 'DIVYANSH  CHAUHAN' },
      { email: '21051603@kiit.ac.in', name: 'SOURADEEP  SARKAR' },
      { email: '21051649@kiit.ac.in', name: 'GAURAV  KUMAR' },
      { email: '21051728@kiit.ac.in', name: 'AVIPSHA ASIS PATNAIK' },
      { email: '21051737@kiit.ac.in', name: 'KUMAR  AYUSH' },
      { email: '21051743@kiit.ac.in', name: 'MAYUKH  BANIK' },
      { email: '21051805@kiit.ac.in', name: 'BODHISATTWA  TALUKDER' },
      { email: '21051863@kiit.ac.in', name: 'UTKARSH  ANAND' },
      { email: '21051873@kiit.ac.in', name: 'ADARSH  TIWARI' },
      { email: '21051905@kiit.ac.in', name: 'DIVYANSHU BINAY KUMAR' },
      { email: '21051906@kiit.ac.in', name: 'ANANT  UPADHYAY' },
      { email: '21051953@kiit.ac.in', name: 'TUSHAR  SHARMA' },
      { email: '21051991@kiit.ac.in', name: 'ESHAAN  MODH' },
      { email: '21051994@kiit.ac.in', name: 'HARSHITA  SHARMA' },
      { email: '21052007@kiit.ac.in', name: 'PRABAL KUMAR KOUNDILYA' },
      { email: '21052021@kiit.ac.in', name: 'SAGNIK  SEN' },
      { email: '21052094@kiit.ac.in', name: 'RUPSA  MUKHOPADHYAY' },
      { email: '21052148@kiit.ac.in', name: 'AYUSH  KUMAR' },
      { email: '21052254@kiit.ac.in', name: 'KHUSI  CHOUDHURY' },
      { email: '21052271@kiit.ac.in', name: 'ROUNAK  ROY' },
      { email: '21052371@kiit.ac.in', name: 'SURYA  PRAKASH' },
      { email: '21052411@kiit.ac.in', name: 'DARSHAN  RAWAT' },
      { email: '21052488@kiit.ac.in', name: 'ASHUTOSH  MAURYA' },
      { email: '21052570@kiit.ac.in', name: 'ARITRA  KOLAY' },
      { email: '21052589@kiit.ac.in', name: 'SAPTARSHI  DUTTA' },
      { email: '21052637@kiit.ac.in', name: 'ABHAY SINGH GEHLOT' },
      { email: '21052676@kiit.ac.in', name: 'MOHIT  SHARMA' },
      { email: '21052705@kiit.ac.in', name: 'SHIVAM  AWASTHI' },
      { email: '21052716@kiit.ac.in', name: 'SUDIPTA  DEB' },
      { email: '21052741@kiit.ac.in', name: 'ARITRA  SAHA' },
      { email: '21052822@kiit.ac.in', name: 'ASHUTOSH  JHA' },
      { email: '21052826@kiit.ac.in', name: 'AYUSH  SRIVASTAVA' },
      { email: '21052838@kiit.ac.in', name: 'DIVYAK PRATAP SINGH' },
      { email: '21052846@kiit.ac.in', name: 'MOHIT PRASAD GUPTA' },
      { email: '21052861@kiit.ac.in', name: 'RITESH  KUMAR' },
      { email: '21052878@kiit.ac.in', name: 'SMRUTI PRIYA ROUT' },
      { email: '21052892@kiit.ac.in', name: 'ABANTI  GHOSH' },
      { email: '21052898@kiit.ac.in', name: 'APALA  MAITI' },
      { email: '21052981@kiit.ac.in', name: 'ANUSKA  DASH' },
      { email: '21053339@kiit.ac.in', name: 'SUHANI  SINGH' },
      { email: '21053348@kiit.ac.in', name: 'ABHISHEK  DEEP' },
      { email: '21053349@kiit.ac.in', name: 'BINEET  ROY' },
      { email: '21053354@kiit.ac.in', name: 'PRAFULLA  CHANDRA' },
      { email: '2105008@kiit.ac.in', name: 'ANANT KUMAR SRIVASTAVA' },
      { email: '2105093@kiit.ac.in', name: 'ADITYA  KUMAR' },
      { email: '2105142@kiit.ac.in', name: 'SAAI NANDAN  JENA' },
      { email: '2105147@kiit.ac.in', name: 'SANIDHYA  MOHAN' },
      { email: '2105197@kiit.ac.in', name: 'HARSH VARDHAN SINGH' },
      { email: '2105212@kiit.ac.in', name: 'NIRMALLYA  DUTTA' },
      { email: '2105238@kiit.ac.in', name: 'SHRADHA  SAHAY' },
      { email: '2105244@kiit.ac.in', name: 'SNEHAN  BANERJEE' },
      { email: '2105246@kiit.ac.in', name: 'SOUMYADEEP  SAHA' },
      { email: '2105277@kiit.ac.in', name: 'KANHAIYA  KUNJ' },
      { email: '2105392@kiit.ac.in', name: 'PRIYADARSHI  ABHISHEK' },
      { email: '2105597@kiit.ac.in', name: 'ABHISHEK  GAUR' },
      { email: '2105601@kiit.ac.in', name: 'AMAN KUMAR SAHU' },
      { email: '2105616@kiit.ac.in', name: 'CHAUDHURY SAUMEN DASH' },
      { email: '2105639@kiit.ac.in', name: 'PRATIK  MOHANTY' },
      { email: '2105651@kiit.ac.in', name: 'RIYA  RAJ' },
      { email: '2105709@kiit.ac.in', name: 'AYASKANT  DASH' },
      { email: '2105778@kiit.ac.in', name: 'ARYAN KUMAR JHA' },
      { email: '2105781@kiit.ac.in', name: 'ASHUTOSH KUMAR ROUT' },
      { email: '2105832@kiit.ac.in', name: 'SOUMYENDU  DAS' },
      { email: '2105879@kiit.ac.in', name: 'BIKRAM KESHARI RATH' },
      { email: '2105887@kiit.ac.in', name: 'HARSH  RAJ' },
      { email: '2105961@kiit.ac.in', name: 'DHRUV KUMAR MISHRA' },
      { email: '2105962@kiit.ac.in', name: 'DIKSHA  CHAUDHARY' },
      { email: '2105974@kiit.ac.in', name: 'MUSKAN PRITAM' },
      { email: '2105977@kiit.ac.in', name: 'OJASI  LAVANYA' },
      { email: '2105987@kiit.ac.in', name: 'RAJBEER  CHANDRA' },
      { email: '2105996@kiit.ac.in', name: 'SANJIDAH MUNIM MAZUMDER' },
      { email: '2106005@kiit.ac.in', name: 'ADITYA  ANAND' },
      { email: '2106020@kiit.ac.in', name: 'ATREYEE  JOARDAR' },
      { email: '2106025@kiit.ac.in', name: 'DEEPAK  SINGH' },
      { email: '2106039@kiit.ac.in', name: 'MOHAMMAD SAUD KHAN' },
      { email: '2106051@kiit.ac.in', name: 'RION  SUTRADHAR' },
      { email: '2106064@kiit.ac.in', name: 'SHAYAN  MANDAL' },
      { email: '2106074@kiit.ac.in', name: 'SURAJIT  HATI' },
      { email: '2106110@kiit.ac.in', name: 'CHHAGAN RAM CHOUDHARY' },
      { email: '2106133@kiit.ac.in', name: 'PRAKHAR  DWIVEDI' },
      { email: '2106157@kiit.ac.in', name: 'SHUBH  DESHMUKH' },
      { email: '2106168@kiit.ac.in', name: 'SWATI  KUMARI' },
      { email: '2106260@kiit.ac.in', name: 'SOUMYASHREE  SAHOO' },
      { email: '2106301@kiit.ac.in', name: 'SHIV  SHANKAR' },
      { email: '2106306@kiit.ac.in', name: 'RAKESH  SAH' },
      { email: '2128144@kiit.ac.in', name: 'ANKIT KUMAR YADAV' },
      { email: '21051033@kiit.ac.in', name: 'ANKIT  KUMAR' },
      { email: '21051055@kiit.ac.in', name: 'HRITIK  RAJ' },
      { email: '21051061@kiit.ac.in', name: 'MANAS RANJAN MUDULI' },
      { email: '21051200@kiit.ac.in', name: 'AKASH  SINGH' },
      { email: '21051219@kiit.ac.in', name: 'HIMANSHU  SINGH' },
      { email: '21051223@kiit.ac.in', name: 'KANISH  BISWAS' },
      { email: '21051239@kiit.ac.in', name: 'RITABRATA NATH SARKAR' },
      { email: '21051277@kiit.ac.in', name: 'ADITYA  MONDAL' },
      { email: '21051279@kiit.ac.in', name: 'ADITYA KUMAR PANDA' },
      { email: '21051282@kiit.ac.in', name: 'AMLAN ANURAG LENKA' },
      { email: '21051289@kiit.ac.in', name: 'ARINDAM  KANRAR' },
      { email: '21051290@kiit.ac.in', name: 'ARITRA  CHATTERJEE' },
      { email: '21051296@kiit.ac.in', name: 'ATUL KUMAR SINGH' },
      { email: '21051298@kiit.ac.in', name: 'AYUSH  MOHAPATRA' },
      { email: '21051305@kiit.ac.in', name: 'DIPTIMAYEE  PRADHAN' },
      { email: '21051328@kiit.ac.in', name: 'RISHIT  PATTANAIK' },
      { email: '21051337@kiit.ac.in', name: 'SHIVAM KUMAR SINHA' },
      { email: '21051348@kiit.ac.in', name: 'SUHAN  RANASINGHA' },
      { email: '21051383@kiit.ac.in', name: 'ASEEM  ANAND' },
      { email: '21051500@kiit.ac.in', name: 'RISHABH  TRIVEDI' },
      { email: '21051552@kiit.ac.in', name: 'AYUSHMAN  PANDA' },
      { email: '21051705@kiit.ac.in', name: 'ABHISHEK  KUMAR' },
      { email: '21051801@kiit.ac.in', name: 'ARNAV KUMAR DEY' },
      { email: '21051804@kiit.ac.in', name: 'BHAVNEET  GILL' },
      { email: '21051854@kiit.ac.in', name: 'SUBHAM  PATRA' },
      { email: '21051934@kiit.ac.in', name: 'SHIVANI  SHIVAPRIYA' },
      { email: '21051960@kiit.ac.in', name: 'PRATIKSHYA  MISHRA' },
      { email: '21051997@kiit.ac.in', name: 'JIGNASHU  DASH' },
      { email: '21052011@kiit.ac.in', name: 'PRIYABRATA  BEHERA' },
      { email: '21052025@kiit.ac.in', name: 'SHAYONI  CHATTERJEE' },
      { email: '21052028@kiit.ac.in', name: 'SHUBHASMITA  BABU' },
      { email: '21052031@kiit.ac.in', name: 'SOMESH  KUMAR' },
      { email: '21052064@kiit.ac.in', name: 'AYAN KUMAR PAUL' },
      { email: '21052096@kiit.ac.in', name: 'SAKSHAM  BAIDYANATH' },
      { email: '21052110@kiit.ac.in', name: 'SOUMYA RANJAN BEHERA' },
      { email: '21052146@kiit.ac.in', name: 'AVIRUP  MUKHERJEE' },
      { email: '21052149@kiit.ac.in', name: 'AYUSH  SAHA' },
      { email: '21052150@kiit.ac.in', name: 'BISWA  BISMAY' },
      { email: '21052174@kiit.ac.in', name: 'RANA  MONDAL' },
      { email: '21052204@kiit.ac.in', name: 'SWAPNA DIP  MANDAL' },
      { email: '21052246@kiit.ac.in', name: 'CHINMAY  TIWARI' },
      { email: '21052256@kiit.ac.in', name: 'KOMAL P RAJ' },
      { email: '21052276@kiit.ac.in', name: 'SHOBHIT  NAUTIYAL' },
      { email: '21052296@kiit.ac.in', name: 'AASTHA  KAMAL' },
      { email: '21052298@kiit.ac.in', name: 'MONALISHA  PRIYADARSHINI' },
      { email: '21052331@kiit.ac.in', name: 'KHUSHBOO  MOHANTY' },
      { email: '21052353@kiit.ac.in', name: 'SADAF  KHAN' },
      { email: '21052356@kiit.ac.in', name: 'SANJANA  PANIGRAHI' },
      { email: '21052359@kiit.ac.in', name: 'SHIKHA  KUMARI' },
      { email: '21052414@kiit.ac.in', name: 'DEEPANSHU  PANDEY' },
      { email: '21052427@kiit.ac.in', name: 'KAUSHTAB  MUKHERJEE' },
      { email: '21052429@kiit.ac.in', name: 'KHUSHI  SINHA' },
      { email: '21052558@kiit.ac.in', name: 'SAKSHI' },
      { email: '21052559@kiit.ac.in', name: 'AGRIM  SRIVASTAVA' },
      { email: '21052560@kiit.ac.in', name: 'AJAY  SINHA' },
      { email: '21052563@kiit.ac.in', name: 'ANIKET  BARIK' },
      { email: '21052564@kiit.ac.in', name: 'ANISH  RANJAN' },
      { email: '21052591@kiit.ac.in', name: 'ISHANI  MOHAPATRA' },
      { email: '21052594@kiit.ac.in', name: 'JYOTI  KUMARI' },
      { email: '21052622@kiit.ac.in', name: 'SHRISHTI  SINGH' },
      { email: '21052623@kiit.ac.in', name: 'SMRITI  SINHA' },
      { email: '21052628@kiit.ac.in', name: 'SUNALI  PATRO' },
      { email: '21052644@kiit.ac.in', name: 'ADRIJA  SADHU' },
      { email: '21052816@kiit.ac.in', name: 'ARITRA  SARKAR' },
      { email: '21052827@kiit.ac.in', name: 'AYUSH ADARSH PARIDA' },
      { email: '21052859@kiit.ac.in', name: 'RICK  CHAUDHURI' },
      { email: '21052887@kiit.ac.in', name: 'TANYA  KUMARI' },
      { email: '21052894@kiit.ac.in', name: 'AKSHIT  AGGARWAL' },
      { email: '21052902@kiit.ac.in', name: 'CHINMAYA  SAHOO' },
      { email: '21052905@kiit.ac.in', name: 'HARSH  SINGH' },
      { email: '21052942@kiit.ac.in', name: 'KRISHN NARAYAN YADAV' },
      { email: '21053213@kiit.ac.in', name: 'MD EHTESHAMUR RAHMAN' },
      { email: '21053303@kiit.ac.in', name: 'PRAJIT KUMAR YADAV' },
      { email: '21053311@kiit.ac.in', name: 'RAHUL KUMAR AGRAWAL' },
      { email: '21053313@kiit.ac.in', name: 'RITIK  THAKUR' },
      { email: '21053340@kiit.ac.in', name: 'ANIMESH KUMAR SINGH' },
      { email: '21053362@kiit.ac.in', name: 'SUJAL KUMAR TIMILSINA' },
      { email: '21053367@kiit.ac.in', name: 'SAGNIK  RAY' },
      { email: '21053368@kiit.ac.in', name: 'ANKITA  OJASWI' },
      { email: '21053388@kiit.ac.in', name: 'ROUSHAN KUMAR SINGH' },
      { email: '21053435@kiit.ac.in', name: 'LOVE KUMAR SAH' },
      { email: '21053474@kiit.ac.in', name: 'AMIT  GUPTA' },
      { email: '22057029@kiit.ac.in', name: 'DIBYANSU  MISHRA' },
      { email: '2105083@kiit.ac.in', name: 'VIKASH  KUMAR' },
      { email: '2105090@kiit.ac.in', name: 'ABIR DEBASIS SARKAR' },
      { email: '2105094@kiit.ac.in', name: 'ADITYA  MAURYA' },
      { email: '2105140@kiit.ac.in', name: 'RUPAYAN  BHUINYA' },
      { email: '2105144@kiit.ac.in', name: 'SAMRIDHI  LAL' },
      { email: '2105175@kiit.ac.in', name: 'ADITYA  RAJ' },
      { email: '2105182@kiit.ac.in', name: 'ARGHYAJYOTI  MONDAL' },
      { email: '2105183@kiit.ac.in', name: 'ARNAB  DAS' },
      { email: '2105306@kiit.ac.in', name: 'ROHIT  RAJ' },
      { email: '2105343@kiit.ac.in', name: 'AARNAB  DUTTA' },
      { email: '2105393@kiit.ac.in', name: 'PRIYANSHU  GUPTA' },
      { email: '2105398@kiit.ac.in', name: 'RIMO  GHOSH' },
      { email: '2105412@kiit.ac.in', name: 'SPARSH  CHAUDHARY' },
      { email: '2105450@kiit.ac.in', name: 'CHINMAY KUMAR OJHA' },
      { email: '2105455@kiit.ac.in', name: 'DIVITA  TOPNO' },
      { email: '2105467@kiit.ac.in', name: 'MEET  SONEJI' },
      { email: '2105468@kiit.ac.in', name: 'MEGHANA SREE KAMANA' },
      { email: '2105470@kiit.ac.in', name: 'NAMAN  JAIN' },
      { email: '2105509@kiit.ac.in', name: 'VAIBHAV KUMAR SINGH' },
      { email: '2105556@kiit.ac.in', name: 'LAXMIKANT DWIVEDI' },
      { email: '2105568@kiit.ac.in', name: 'RITESH  KUMAR' },
      { email: '2105613@kiit.ac.in', name: 'AYUSH  KESHARI' },
      { email: '2105622@kiit.ac.in', name: 'GORISH  KUMAR' },
      { email: '2105645@kiit.ac.in', name: 'RAJAT  GUPTA' },
      { email: '2105682@kiit.ac.in', name: 'ABHIJEET  KUMAR' },
      { email: '2105711@kiit.ac.in', name: 'B  ASUTOSH' },
      { email: '2105821@kiit.ac.in', name: 'SAMUDRANEEL  SENGUPTA' },
      { email: '2105825@kiit.ac.in', name: 'SAUMY' },
      { email: '2105901@kiit.ac.in', name: 'P  NIKITA' },
      { email: '2105917@kiit.ac.in', name: 'ROMA  KUMARI' },
      { email: '2105926@kiit.ac.in', name: 'SHIVAM  KUMAR' },
      { email: '2105972@kiit.ac.in', name: 'MD ANAITULLAH' },
      { email: '2106002@kiit.ac.in', name: 'ABHIJEET  KUMAR' },
      { email: '2106010@kiit.ac.in', name: 'AMAN  CHANDRAVANSHI' },
      { email: '2106018@kiit.ac.in', name: 'ASHISH  KUMAR' },
      { email: '2106019@kiit.ac.in', name: 'AYONA  SAHU' },
      { email: '2106041@kiit.ac.in', name: 'ONKAR  CHAUDHARY' },
      { email: '2106046@kiit.ac.in', name: 'PRIYANSHU  SRIVASTAVA' },
      { email: '2106054@kiit.ac.in', name: 'SAGNIK  MUKHERJEE' },
      { email: '2106068@kiit.ac.in', name: 'SHREERUPA  MALLICK' },
      { email: '2106105@kiit.ac.in', name: 'AYUSH  RAJ' },
      { email: '2106111@kiit.ac.in', name: 'DEV  DASHORA' },
      { email: '2106127@kiit.ac.in', name: 'NISHANT  GUPTA' },
      { email: '2106141@kiit.ac.in', name: 'RAHUL  BARIK' },
      { email: '2106171@kiit.ac.in', name: 'AAYUSH  BHARDWAJ' },
      { email: '2106185@kiit.ac.in', name: 'ANIMESH  ANAND' },
      { email: '2106227@kiit.ac.in', name: 'MONIKANCHAN  CHATTERJEE' },
      { email: '2106267@kiit.ac.in', name: 'SRUTI PRAKASH BEHERA' },
      { email: '2128001@kiit.ac.in', name: 'AARYAN  JORDAN' },
      { email: '2128018@kiit.ac.in', name: 'DEVANGI  BHATTACHARJEE' },
      { email: '2129056@kiit.ac.in', name: 'ARPAN  BAGCHI' },
      { email: '21051040@kiit.ac.in', name: 'ARPIT  KANUNGO' },
      { email: '21051057@kiit.ac.in', name: 'ISHAAN  PATHAK' },
      { email: '21051064@kiit.ac.in', name: 'MEDHA  PRAGYA' },
      { email: '21051126@kiit.ac.in', name: 'DEBABRATA  KUMAR' },
      { email: '21051181@kiit.ac.in', name: 'SOUVIK  ROY' },
      { email: '21051187@kiit.ac.in', name: 'TANISHA  TANZIM' },
      { email: '21051201@kiit.ac.in', name: 'AMAN' },
      { email: '21051240@kiit.ac.in', name: 'ROHIT  RAI' },
      { email: '21051284@kiit.ac.in', name: 'ANCHITA  PADHY' },
      { email: '21051295@kiit.ac.in', name: 'ASITA  DEKA' },
      { email: '21051327@kiit.ac.in', name: 'RISHAV KUMAR SINGH' },
      { email: '21051411@kiit.ac.in', name: 'NISHU KUMARI RAY' },
      { email: '21051420@kiit.ac.in', name: 'ROHIT  GHOSH' },
      { email: '21051421@kiit.ac.in', name: 'ROSHNI RAY CHOUDHURY' },
      { email: '21051442@kiit.ac.in', name: 'TANISHA  VERMA' },
      { email: '21051444@kiit.ac.in', name: 'VANSHIKA  RAJ' },
      { email: '21051458@kiit.ac.in', name: 'ANANYA  GUPTA' },
      { email: '21051485@kiit.ac.in', name: 'MOHA' },
      { email: '21051536@kiit.ac.in', name: 'ANANDA SWAROOP SAHOO' },
      { email: '21051582@kiit.ac.in', name: 'PRIYA KUMARI PRASAD' },
      { email: '21051625@kiit.ac.in', name: 'ALOK  KUMAR' },
      { email: '21051639@kiit.ac.in', name: 'ARYAN  AGARWAL' },
      { email: '21051677@kiit.ac.in', name: 'RITIKA' },
      { email: '21051725@kiit.ac.in', name: 'ARYAN  RAJ' },
      { email: '21051731@kiit.ac.in', name: 'AYUSH  SARKAR' },
      { email: '21051752@kiit.ac.in', name: 'PRATYUSH KUMAR SHRIVASTAVA' },
      { email: '21051772@kiit.ac.in', name: 'SUPRATIM  CHAKRABORTY' },
      { email: '21051817@kiit.ac.in', name: 'GOGADA KASYAP SAI' },
      { email: '21051841@kiit.ac.in', name: 'RITIK  RAJ' },
      { email: '21051875@kiit.ac.in', name: 'AKARSH  DUBEY' },
      { email: '21051902@kiit.ac.in', name: 'KOUSIK  CHAKRABORTY' },
      { email: '21051977@kiit.ac.in', name: 'ARITRA  KAR' },
      { email: '21052036@kiit.ac.in', name: 'SUPRITI  PARIA' },
      { email: '21052053@kiit.ac.in', name: 'ANKIT  SAHOO' },
      { email: '21052068@kiit.ac.in', name: 'DINESH  MOHANTY' },
      { email: '21052083@kiit.ac.in', name: 'NANDITA  RANJAN' },
      { email: '21052095@kiit.ac.in', name: 'BARSHIT  CHIRAG' },
      { email: '21052106@kiit.ac.in', name: 'SHUBHAM  UPADHYAY' },
      { email: '21052147@kiit.ac.in', name: 'AYUSH  BHARATI' },
      { email: '21052162@kiit.ac.in', name: 'MEGHANA  PANDA' },
      { email: '21052211@kiit.ac.in', name: 'AADITYA NARAYAN SHARMA' },
      { email: '21052212@kiit.ac.in', name: 'AASHU  KUMAR' },
      { email: '21052216@kiit.ac.in', name: 'ABHISHEK  ANAND' },
      { email: '21052253@kiit.ac.in', name: 'JAI ANAND PANDEY' },
      { email: '21052255@kiit.ac.in', name: 'KINSHUK  TRIPATHI' },
      { email: '21052291@kiit.ac.in', name: 'SWARNABHA  KAR' },
      { email: '21052292@kiit.ac.in', name: 'TUHIN  HAZRA' },
      { email: '21052300@kiit.ac.in', name: 'ABHISHEK KUMAR DAS' },
      { email: '21052314@kiit.ac.in', name: 'AUROPRAKASH  MOHAPATRA' },
      { email: '21052316@kiit.ac.in', name: 'AYUSH KUMAR DUBEY' },
      { email: '21052355@kiit.ac.in', name: 'SAMEER  SINHA' },
      { email: '21052366@kiit.ac.in', name: 'SOUNAK  JYOTI' },
      { email: '21052403@kiit.ac.in', name: 'ASHISH AMAN' },
      { email: '21052407@kiit.ac.in', name: 'ATUL  RAJ' },
      { email: '21052415@kiit.ac.in', name: 'DIPAN  MANDAL' },
      { email: '21052425@kiit.ac.in', name: 'KALLA SAI SURAJ' },
      { email: '21052452@kiit.ac.in', name: 'SHASHANK  MISHRA' },
      { email: '21052489@kiit.ac.in', name: 'BASUNDHARA  DAS' },
      { email: '21052528@kiit.ac.in', name: 'SARTHAK  GHOSH' },
      { email: '21052550@kiit.ac.in', name: 'YASH  SHUKLA' },
      { email: '21052569@kiit.ac.in', name: 'ANUSHREE' },
      { email: '21052585@kiit.ac.in', name: 'EKAANSH  DAS' },
      { email: '21052607@kiit.ac.in', name: 'RAJVEER  SHAW' },
      { email: '21052616@kiit.ac.in', name: 'SARTHAK  BHOWMIK' },
      { email: '21052624@kiit.ac.in', name: 'ROUNIT KUMAR SINGH' },
      { email: '21052694@kiit.ac.in', name: 'RISHI  PRADHAN' },
      { email: '21052761@kiit.ac.in', name: 'HINDOL  ROY' },
      { email: '21052795@kiit.ac.in', name: 'SOUBHAGYA  MUKHERJEE' },
      { email: '21052803@kiit.ac.in', name: 'VEMANA SUMANTH' },
      { email: '21052848@kiit.ac.in', name: 'NITISH  SINGH' },
      { email: '21052869@kiit.ac.in', name: 'SATVIK  AGRAWAL' },
      { email: '21052903@kiit.ac.in', name: 'DISHA  KUMARI' },
      { email: '21052922@kiit.ac.in', name: 'SINJINI  BOSE' },
      { email: '21052975@kiit.ac.in', name: 'ANANYA SHIVANI TELU' },
      { email: '21052987@kiit.ac.in', name: 'ABHILASHA  KUMARI' },
      { email: '21053209@kiit.ac.in', name: 'AYUSH  SINGH' },
      { email: '21053223@kiit.ac.in', name: 'UTKARSH  TRIVEDI' },
      { email: '21053239@kiit.ac.in', name: 'PRASENJEET  PAUL' },
      { email: '21053246@kiit.ac.in', name: 'ARKA  MANDAL' },
      { email: '21053257@kiit.ac.in', name: 'AASUTOSH KUMAR SONY' },
      { email: '21053301@kiit.ac.in', name: 'NITU  KARMAKAR' },
      { email: '21053347@kiit.ac.in', name: 'ARYA  PATTNAYAK' },
      { email: '21053353@kiit.ac.in', name: 'SAURABH SINGH YADAV' },
      { email: '21053370@kiit.ac.in', name: 'ASHOK RAJ SINGH' },
      { email: '21053403@kiit.ac.in', name: 'KOMAL  ROUNIYAR' },
      { email: '21053421@kiit.ac.in', name: 'ABHISHEK  BISHWAS' },
      { email: '21053431@kiit.ac.in', name: 'UTKRISHT  BHANDARI' },
      { email: '21053451@kiit.ac.in', name: 'BIPIN KUMAR CHAUDHARY' },
      { email: '21053463@kiit.ac.in', name: 'ANUJ KUMAR PRAJAPATI' },
      { email: '22057020@kiit.ac.in', name: 'AURO SASWAT RAJ' },
      { email: '22057023@kiit.ac.in', name: 'BISHESH  SAHOO' },
      { email: '2105127@kiit.ac.in', name: 'MAHARNAV  KASHYAP' },
      { email: '2105161@kiit.ac.in', name: 'YOGESH KUMAR JHA' },
      { email: '2105168@kiit.ac.in', name: 'TUSHAR  SAHU' },
      { email: '2105188@kiit.ac.in', name: 'BASTAB  BARIK' },
      { email: '2105198@kiit.ac.in', name: 'HRIDESH  BEHERA' },
      { email: '2105200@kiit.ac.in', name: 'JAYANT  SINGH' },
      { email: '2105230@kiit.ac.in', name: 'SACHIN  SINGH' },
      { email: '2105248@kiit.ac.in', name: 'SOVNA  PANDA' },
      { email: '2105300@kiit.ac.in', name: 'RIK  MAHAPATRA' },
      { email: '2105311@kiit.ac.in', name: 'SANSKRUTI  DAS' },
      { email: '2105355@kiit.ac.in', name: 'ANKITA  GHOSH' },
      { email: '2105376@kiit.ac.in', name: 'ISHITA  CHOUDHURI' },
      { email: '2105386@kiit.ac.in', name: 'OMM PRIYADARSHAN PARIDA' },
      { email: '2105421@kiit.ac.in', name: 'TUSHAR  ANAND' },
      { email: '2105459@kiit.ac.in', name: 'GARVITA  MISHRA' },
      { email: '2105473@kiit.ac.in', name: 'NAYAN  KUMAR' },
      { email: '2105505@kiit.ac.in', name: 'SUNNY  SRIVASTAVA' },
      { email: '2105558@kiit.ac.in', name: 'NALIN KUMAR SINGH' },
      { email: '2105564@kiit.ac.in', name: 'RAJASHREE  DEB' },
      { email: '2105685@kiit.ac.in', name: 'ADITYA  PATEL' },
      { email: '2105727@kiit.ac.in', name: 'REDDY  SWAMY' },
      { email: '2105811@kiit.ac.in', name: 'PREMCHANDRA  BHARTI' },
      { email: '2105820@kiit.ac.in', name: 'HARSHIT  NAYAN' },
      { email: '2105824@kiit.ac.in', name: 'SATYAM KUMAR MAURYA' },
      { email: '2105834@kiit.ac.in', name: 'SUBHAM' },
      { email: '2105865@kiit.ac.in', name: 'ANSHUL  KUMAR' },
      { email: '2105877@kiit.ac.in', name: 'KRIPA  BHADANI' },
      { email: '2105893@kiit.ac.in', name: 'IPSITA' },
      { email: '2105945@kiit.ac.in', name: 'SHOURYA  RAJ' },
      { email: '2106073@kiit.ac.in', name: 'SUDIP  MONDAL' },
      { email: '2106090@kiit.ac.in', name: 'ANJANA PRASANTA MOHANTY' },
      { email: '2106102@kiit.ac.in', name: 'ASHUTOSH  PRIYADARSHI' },
      { email: '2106162@kiit.ac.in', name: 'SOUMYAJIT  NAYEK' },
      { email: '2106165@kiit.ac.in', name: 'SUDAKSHINA  BHATTACHARJEE' },
      { email: '2106166@kiit.ac.in', name: 'SUJIT KUMAR DASH' },
      { email: '2106222@kiit.ac.in', name: 'KUKKALA LOKESH SRIRAM' },
      { email: '2106243@kiit.ac.in', name: 'RITESH  RANJAN' },
      { email: '2106246@kiit.ac.in', name: 'SANTOSH KUMAR MANJHI' },
      { email: '2106268@kiit.ac.in', name: 'SUBHRANSU  MOHAPATRA' },
      { email: '2106304@kiit.ac.in', name: 'RASHI  MAWANDIA' },
      { email: '2106314@kiit.ac.in', name: 'ASHISH  PATEL' },
      { email: '2106319@kiit.ac.in', name: 'SARTHAK  AGARWAL' },
      { email: '2128057@kiit.ac.in', name: 'SHASHWAT  AMBASTA' },
      { email: '2128091@kiit.ac.in', name: 'SOUMADEEP  MITRA' },
      { email: '2128111@kiit.ac.in', name: 'VAIDEHI UDAY DADHI' },
      { email: '2128119@kiit.ac.in', name: 'NISHANT  KUMAR' },
      { email: '2129073@kiit.ac.in', name: 'KANISHKA  SINGH' },
      { email: '2129157@kiit.ac.in', name: 'PRIYANSH  NAYAK' },
      { email: '21051015@kiit.ac.in', name: 'SOUMILI  MONDAL' },
      { email: '21051045@kiit.ac.in', name: 'CHIRAYU  DAS' },
      { email: '21051068@kiit.ac.in', name: 'NISHANT  KUMAR' },
      { email: '21051069@kiit.ac.in', name: 'P M SIMRAN JENA' },
      { email: '21051097@kiit.ac.in', name: 'SUHANI  SRIVASTAVA' },
      { email: '21051100@kiit.ac.in', name: 'SYED ABBAS HUSAIN' },
      { email: '21051122@kiit.ac.in', name: 'SWETA KRISHNA BISWAL' },
      { email: '21051135@kiit.ac.in', name: 'HARSHIT KUMAR PANDEY' },
      { email: '21051205@kiit.ac.in', name: 'ANKUR  VERMA' },
      { email: '21051326@kiit.ac.in', name: 'RIDDHI  AGRAWAL' },
      { email: '21051338@kiit.ac.in', name: 'SHREYA  SNEHAL' },
      { email: '21051354@kiit.ac.in', name: 'TANMAY  SAHU' },
      { email: '21051369@kiit.ac.in', name: 'AISHANYA  VERMA' },
      { email: '21051453@kiit.ac.in', name: 'ADYASHA  MOHANTY' },
      { email: '21051454@kiit.ac.in', name: 'AKASH  OJHA' },
      { email: '21051465@kiit.ac.in', name: 'APOORVA  RAI' },
      { email: '21051471@kiit.ac.in', name: 'AYUSH  ARYAN' },
      { email: '21051472@kiit.ac.in', name: 'BANDHAN  MOHANTY' },
      { email: '21051530@kiit.ac.in', name: 'YASH  KIRTY' },
      { email: '21051573@kiit.ac.in', name: 'KUNAL  RAJ' },
      { email: '21051578@kiit.ac.in', name: 'NANDINI  MISHRA' },
      { email: '21051588@kiit.ac.in', name: 'ROKKAM SURYA SRINIVAS' },
      { email: '21051620@kiit.ac.in', name: 'ABHISHEK  KUMAR' },
      { email: '21051623@kiit.ac.in', name: 'AKANKSHA  GUPTA' },
      { email: '21051636@kiit.ac.in', name: 'ARPIT  DAS' },
      { email: '21051637@kiit.ac.in', name: 'ARUNIMA  DAS' },
      { email: '21051678@kiit.ac.in', name: 'SAKSHI  KESHRI' },
      { email: '21051679@kiit.ac.in', name: 'SAMARJEET  MALIK' },
      { email: '21051710@kiit.ac.in', name: 'ADRIJA  DAS' },
      { email: '21051759@kiit.ac.in', name: 'SAKSHI  BANSAL' },
      { email: '21051790@kiit.ac.in', name: 'ABHISHEK  PRADHAN' },
      { email: '21051794@kiit.ac.in', name: 'AIMAN  HASIB' },
      { email: '21051802@kiit.ac.in', name: 'ARUNAV  PHUKAN' },
      { email: '21051809@kiit.ac.in', name: 'DEBOLEENA  POREL' },
      { email: '21051816@kiit.ac.in', name: 'DIYA  CHAKRABORTY' },
      { email: '21051829@kiit.ac.in', name: 'NORMAN  KUMAR' },
      { email: '21051847@kiit.ac.in', name: 'SHAMBHAVI' },
      { email: '21051912@kiit.ac.in', name: 'PENMETHSA KODANDA ROHITH VARMA' },
      { email: '21051913@kiit.ac.in', name: 'PRADIPTO  CHOWDHURY' },
      { email: '21051995@kiit.ac.in', name: 'ISHITA  RASTOGI' },
      { email: '21052013@kiit.ac.in', name: 'PRIYANSHU  SAGAR' },
      { email: '21052071@kiit.ac.in', name: 'HEMANTH  KAPALAVAI' },
      { email: '21052088@kiit.ac.in', name: 'PRANAV  PRAKASH' },
      { email: '21052090@kiit.ac.in', name: 'PRIYAM  RAHA' },
      { email: '21052113@kiit.ac.in', name: 'SRIJANI  DUTTA' },
      { email: '21052154@kiit.ac.in', name: 'GNYANEESH  SINGH' },
      { email: '21052163@kiit.ac.in', name: 'ADITYA  BHARDWAJ' },
      { email: '21052187@kiit.ac.in', name: 'SATYAM  KUMAR' },
      { email: '21052193@kiit.ac.in', name: 'SHUBHAM SHASHI PRASAD' },
      { email: '21052202@kiit.ac.in', name: 'SURYANSH  SRIVASTAVA' },
      { email: '21052207@kiit.ac.in', name: 'UTKRISHT  SIDDHARTH' },
      { email: '21052213@kiit.ac.in', name: 'ABHIK  PATRA' },
      { email: '21052221@kiit.ac.in', name: 'AGNIVA  BHATTACHARYYA' },
      { email: '21052257@kiit.ac.in', name: 'MANISH  KUMAR' },
      { email: '21052280@kiit.ac.in', name: 'ARYAN  TETE' },
      { email: '21052313@kiit.ac.in', name: 'ATUL  RAJ' },
      { email: '21052362@kiit.ac.in', name: 'SHREYA  MONDAL' },
      { email: '21052364@kiit.ac.in', name: 'SHUBHRADEEP  MANDAL' },
      { email: '21052368@kiit.ac.in', name: 'SUBHAROOP  KABI' },
      { email: '21052430@kiit.ac.in', name: 'KONCHADA  ABHINAV' },
      { email: '21052437@kiit.ac.in', name: 'PARIDHI  CHAWHAN' },
      { email: '21052463@kiit.ac.in', name: 'UTKARSH  BHARATI' },
      { email: '21052484@kiit.ac.in', name: 'ARKA  GHOSH' },
      { email: '21052505@kiit.ac.in', name: 'MEENAKSHI  PANDEY' },
      { email: '21052509@kiit.ac.in', name: 'NAVYA SONAL  AGARWAL' },
      { email: '21052518@kiit.ac.in', name: 'PRIYANSH KUMAR SINGH' },
      { email: '21052522@kiit.ac.in', name: 'RIYA  GUPTA' },
      { email: '21052556@kiit.ac.in', name: 'ADITYA KUMAR THAKUR' },
      { email: '21052611@kiit.ac.in', name: 'ROSHAN  SISODIA' },
      { email: '21052714@kiit.ac.in', name: 'SRINJOY  SUR' },
      { email: '21052770@kiit.ac.in', name: 'MOYUKH  BHATTACHARJEE' },
      { email: '21052860@kiit.ac.in', name: 'RIDDHIMA SINGH RIDDHIMA SINGH' },
      { email: '21052865@kiit.ac.in', name: 'SAMARTH  RAI' },
      { email: '21052874@kiit.ac.in', name: 'SHREYA  SINGH' },
      { email: '21052889@kiit.ac.in', name: 'UTKARSH  DUBEY' },
      { email: '21052904@kiit.ac.in', name: 'HARDIK  CHAUHAN' },
      { email: '21052923@kiit.ac.in', name: 'SNEHA  GUPTA' },
      { email: '21052976@kiit.ac.in', name: 'JITEN  AGARWAL' },
      { email: '21053343@kiit.ac.in', name: 'PRASHANTA RAJON BAROOAH' },
      { email: '21053455@kiit.ac.in', name: 'SANJAY  SAH' },
      { email: '21053469@kiit.ac.in', name: 'SURAJ KUMAR SAH' },
      { email: '22057011@kiit.ac.in', name: 'ANIKET  TALUKDAR' },
      { email: '2105010@kiit.ac.in', name: 'ANKIT  SINGH' },
      { email: '2105038@kiit.ac.in', name: 'MOHIT  YADAV' },
      { email: '2105087@kiit.ac.in', name: 'AASTHA  SINHA' },
      { email: '2105115@kiit.ac.in', name: 'DEBABRATA  KAR' },
      { email: '2105201@kiit.ac.in', name: 'KAVYA  SUMAN' },
      { email: '2105221@kiit.ac.in', name: 'RABNEET SINGH NANHRA' },
      { email: '2105254@kiit.ac.in', name: 'VARTIKA' },
      { email: '2105373@kiit.ac.in', name: 'HIMANK  SINGH' },
      { email: '2105402@kiit.ac.in', name: 'SANKALP  PATRA' },
      { email: '2105453@kiit.ac.in', name: 'DAWAR  SHAFAQUE' },
      { email: '2105551@kiit.ac.in', name: 'KRITICA  ARORA' },
      { email: '2105553@kiit.ac.in', name: 'KUMAR  AYUSH' },
      { email: '2105617@kiit.ac.in', name: 'CHITRANSH  JAISWAL' },
      { email: '2105693@kiit.ac.in', name: 'ANANYA  MONDAL' },
      { email: '2105694@kiit.ac.in', name: 'ANANYA  RAI' },
      { email: '2105702@kiit.ac.in', name: 'ARYAN  BHATTACHARJEE' },
      { email: '2105706@kiit.ac.in', name: 'ASTHA  TIWARI' },
      { email: '2105712@kiit.ac.in', name: 'BIKRAM  SUTRADHAR' },
      { email: '2105787@kiit.ac.in', name: 'BIBHUKALYANI  SWAIN' },
      { email: '2105791@kiit.ac.in', name: 'CHETNA  BHALOTIA' },
      { email: '2105815@kiit.ac.in', name: 'RANAJOY  CHATTERJEE' },
      { email: '2105822@kiit.ac.in', name: 'SARBAJIT  NEOGI' },
      { email: '2105839@kiit.ac.in', name: 'SUPRATIM  BHATTACHARJEE' },
      { email: '2105862@kiit.ac.in', name: 'ANKIT  KUMAR' },
      { email: '2105866@kiit.ac.in', name: 'ANURAG  GUPTA' },
      { email: '2105873@kiit.ac.in', name: 'AYUSH  YADAV' },
      { email: '2105888@kiit.ac.in', name: 'HARSH KUMAR PANDEY' },
      { email: '2105891@kiit.ac.in', name: 'HARSHIT  YADAV' },
      { email: '2105915@kiit.ac.in', name: 'ROHAN  GANGULY' },
      { email: '2105919@kiit.ac.in', name: 'SAMBIT  KONAR' },
      { email: '2106011@kiit.ac.in', name: 'AMAN  KUMAR' },
      { email: '2106021@kiit.ac.in', name: 'AYUSH  JANA' },
      { email: '2106052@kiit.ac.in', name: 'RISHABH DATT UPADHYAY' },
      { email: '2106056@kiit.ac.in', name: 'SAMARTH  MISHRA' },
      { email: '2106062@kiit.ac.in', name: 'SAYAN HASAN MANDAL' },
      { email: '2106063@kiit.ac.in', name: 'SAYANTAN  BANERJEE' },
      { email: '2106066@kiit.ac.in', name: 'SHOBHIT KUMAR YADAV' },
      { email: '2106067@kiit.ac.in', name: 'SHOUVIK  GHOSH' },
      { email: '2106079@kiit.ac.in', name: 'TUSHAR  BHATTACHARYA' },
      { email: '2106081@kiit.ac.in', name: 'VAIBHAV KUMAR BHARDWAJ' },
      { email: '2106082@kiit.ac.in', name: 'VATSAL  PODDAR' },
      { email: '2106118@kiit.ac.in', name: 'JAYASH  PREM' },
      { email: '2106123@kiit.ac.in', name: 'MD HAMMAAD  ISLAM' },
      { email: '2106128@kiit.ac.in', name: 'NISHIT MANOJ SINHA' },
      { email: '2106134@kiit.ac.in', name: 'PRAKHAR  TRIPATHI' },
      { email: '2106148@kiit.ac.in', name: 'SAKSHI  SUMAN' },
      { email: '2106192@kiit.ac.in', name: 'ARNAV  KUSHWAHA' },
      { email: '2106218@kiit.ac.in', name: 'JOYEE  DOLUI' },
      { email: '2106266@kiit.ac.in', name: 'SRIYANSH  SHEKHAR' },
      { email: '2106282@kiit.ac.in', name: 'AYUSH  PUROHIT' },
      { email: '2128065@kiit.ac.in', name: 'ANUBHAV  TRIPATHI' },
      { email: '2128095@kiit.ac.in', name: 'SRIHARSHA  MOHANTY' },
      { email: '2128103@kiit.ac.in', name: 'SWASTIK  DAS' },
      { email: '2128122@kiit.ac.in', name: 'DIBYA DARSHAN DASH' },
      { email: '2129010@kiit.ac.in', name: 'ADITYA KUMAR SINGH' },
      { email: '2129060@kiit.ac.in', name: 'ASUTOSH  DASH' },
      { email: '21051008@kiit.ac.in', name: 'SHREYANSH  SAHAY' },
      { email: '21051048@kiit.ac.in', name: 'DEBDATTA  PAL' },
      { email: '21051056@kiit.ac.in', name: 'IPSIT  CHANDRA' },
      { email: '21051096@kiit.ac.in', name: 'SUCHARITA  MOHAPATRA' },
      { email: '21051105@kiit.ac.in', name: 'YATHARTH  RAGHUVANSHI' },
      { email: '21051148@kiit.ac.in', name: 'NISHITA RAJU V' },
      { email: '21051162@kiit.ac.in', name: 'SACHIN KUMAR MEHTA' },
      { email: '21051172@kiit.ac.in', name: 'SHOVIT  RAJ' },
      { email: '21051177@kiit.ac.in', name: 'SIDDHANT  SAHA' },
      { email: '21051190@kiit.ac.in', name: 'YASH  UPADHYAY' },
      { email: '21051192@kiit.ac.in', name: 'ABHISHEK  PANI' },
      { email: '21051204@kiit.ac.in', name: 'ANISH  ROY' },
      { email: '21051300@kiit.ac.in', name: 'BHOOMIKA  SEHTA' },
      { email: '21051315@kiit.ac.in', name: 'NAVNEET  KUMAR' },
      { email: '21051350@kiit.ac.in', name: 'SUPRATYUSH  SAHOO' },
      { email: '21051356@kiit.ac.in', name: 'VAIBHAV  KUMAR' },
      { email: '21051357@kiit.ac.in', name: 'ANAND' },
      { email: '21051360@kiit.ac.in', name: 'YASHI  GUPTA' },
      { email: '21051361@kiit.ac.in', name: 'AADYA  GUPTA' },
      { email: '21051375@kiit.ac.in', name: 'ANISH  CHATTOPADHYAY' },
      { email: '21051394@kiit.ac.in', name: 'DIMPLE  PATEL' },
      { email: '21051403@kiit.ac.in', name: 'MADHUSNUHI  PANDA' },
      { email: '21051431@kiit.ac.in', name: 'SHUBHANGI  DUTTA' },
      { email: '21051480@kiit.ac.in', name: 'JANBHI  TRIPATHY' },
      { email: '21051510@kiit.ac.in', name: 'SARTHAK  SHUKLA' },
      { email: '21051560@kiit.ac.in', name: 'DEBMALYA  MUKHERJEE' },
      { email: '21051589@kiit.ac.in', name: 'RUDRANEEL  DUTTA' },
      { email: '21051595@kiit.ac.in', name: 'SHREYA  MOHANTY' },
      { email: '21051619@kiit.ac.in', name: 'ABHIMANYU' },
      { email: '21051621@kiit.ac.in', name: 'ADITYA  RAJ' },
      { email: '21051628@kiit.ac.in', name: 'ANANYA  MUKHERJEE' },
      { email: '21051662@kiit.ac.in', name: 'ANANYA  SHARMA' },
      { email: '21051666@kiit.ac.in', name: 'PARITOSH  KUMAR' },
      { email: '21051668@kiit.ac.in', name: 'PRAKHAR  SINGH' },
      { email: '21051670@kiit.ac.in', name: 'PRATYAY  SAMANTA' },
      { email: '21051695@kiit.ac.in', name: 'TANAYA  SAXENA' },
      { email: '21051704@kiit.ac.in', name: 'ABHINAV  BISHT' },
      { email: '21051708@kiit.ac.in', name: 'ADITYA  BIRNAVE' },
      { email: '21051709@kiit.ac.in', name: 'ADITYA  RAJ' },
      { email: '21051785@kiit.ac.in', name: 'YUVRAJ  SINGH' },
      { email: '21051821@kiit.ac.in', name: 'HIMANSHU  GUPTA' },
      { email: '21051828@kiit.ac.in', name: 'NITIN  KUMAR' },
      { email: '21051849@kiit.ac.in', name: 'SNEHA  GUPTA' },
      { email: '21051971@kiit.ac.in', name: 'ANJALI  VAISH' },
      { email: '21052022@kiit.ac.in', name: 'SALONEE  MISHRA' },
      { email: '21052033@kiit.ac.in', name: 'SRISHTI  PAUL' },
      { email: '21052077@kiit.ac.in', name: 'KOMAL  TIWARI' },
      { email: '21052087@kiit.ac.in', name: 'PALAK  PARHAWK' },
      { email: '21052142@kiit.ac.in', name: 'ANUNAY  KUMAR' },
      { email: '21052171@kiit.ac.in', name: 'PRIYANSHI  PRATEEK' },
      { email: '21052177@kiit.ac.in', name: 'RISHABH  SINGH' },
      { email: '21052184@kiit.ac.in', name: 'MAAZ  ASHRAF' },
      { email: '21052200@kiit.ac.in', name: 'SUBHANKAR  GHOSH' },
      { email: '21052205@kiit.ac.in', name: 'TANMAY  PADHI' },
      { email: '21052226@kiit.ac.in', name: 'ANIKET KRISH DAS' },
      { email: '21052310@kiit.ac.in', name: 'APOORVA GAURAV TIWARI' },
      { email: '21052382@kiit.ac.in', name: 'ABHIROOP  TRIVEDI' },
      { email: '21052398@kiit.ac.in', name: 'ANUSHKA  DUTTA' },
      { email: '21052441@kiit.ac.in', name: 'RITABRATA  PAUL' },
      { email: '21052451@kiit.ac.in', name: 'BHAGYASHREE  SAMANTSINGHAR' },
      { email: '21052455@kiit.ac.in', name: 'SOURJYA  ROY' },
      { email: '21052481@kiit.ac.in', name: 'SAHIL  SINGH' },
      { email: '21052512@kiit.ac.in', name: 'PARTH  PATEL' },
      { email: '21052552@kiit.ac.in', name: 'ABHIJEET  PANI' },
      { email: '21052566@kiit.ac.in', name: 'ANKITA  JANA' },
      { email: '21052580@kiit.ac.in', name: 'CHANDRAKANTA  MEHER' },
      { email: '21052581@kiit.ac.in', name: 'DEBANGSHU  SAHA' },
      { email: '21052582@kiit.ac.in', name: 'DHRUBAJYOTI  BANERJEE' },
      { email: '21052786@kiit.ac.in', name: 'SAMBIT KUMAR NAYAK' },
      { email: '21052821@kiit.ac.in', name: 'ASHISH  PANDEY' },
      { email: '21052907@kiit.ac.in', name: 'MAITRI  KESHRI' },
      { email: '21052924@kiit.ac.in', name: 'SOUMIK  GHOSH' },
      { email: '21053258@kiit.ac.in', name: 'AAYUSH  SINHA' },
      { email: '21053260@kiit.ac.in', name: 'ABENEZER  ABERA GOLDA' },
      { email: '21053262@kiit.ac.in', name: 'ABTSEGA  TESFAYE  CHUFARE' },
      { email: '21053273@kiit.ac.in', name: 'BEALU GIRMA GEBRESILASSIE' },
      { email: '21053380@kiit.ac.in', name: 'FADIL MOHAMMED SURUR' },
      { email: '2105245@kiit.ac.in', name: 'SONAKSHI  PANDA' },
      { email: '2105497@kiit.ac.in', name: 'SIBASISH  DUTTA' },
      { email: '2105801@kiit.ac.in', name: 'KARTIKA  PATEL' },
      { email: '2129090@kiit.ac.in', name: 'RAJDEEP  SARKAR' },
      { email: '21051155@kiit.ac.in', name: 'PRIYANSHU SINGH CHAUHAN' },
      { email: '21051387@kiit.ac.in', name: 'AYUSH  KUMAR' },
      { email: '21051435@kiit.ac.in', name: 'SOMADRITA  GOSWAMI' },
      { email: '21051519@kiit.ac.in', name: 'SUPRATIM  CHOUDHURY' },
      { email: '21052672@kiit.ac.in', name: 'KUSHAGRA  YADAV' },
      { email: '21052926@kiit.ac.in', name: 'SUBHASMITA  DASH' },
      { email: '21052927@kiit.ac.in', name: 'SUJAL  SINGH' },
      { email: '21053202@kiit.ac.in', name: 'ABHISHEK  TUDU' },
      { email: '21053263@kiit.ac.in', name: 'ABU SAID  AKUNJI' },
      { email: '21053351@kiit.ac.in', name: 'SUDHANSHU  KUMAR' },
      { email: '22057030@kiit.ac.in', name: 'GOURAV  SAHOO' },
      { email: '22057037@kiit.ac.in', name: 'KAUSHIK  DAS' },
      { email: '22057068@kiit.ac.in', name: 'SUBHAM  CHOUDHURY' },
      { email: '22057088@kiit.ac.in', name: 'NUPUR  KUMARI' },
      { email: '2105295@kiit.ac.in', name: 'RAHUL  MOHANTY' },
      { email: '2105863@kiit.ac.in', name: 'ANKIT KISHORE SHARAN' },
      { email: '2128136@kiit.ac.in', name: 'MOHAMED ABDIFATAH  OSMAN' },
      { email: '2129121@kiit.ac.in', name: 'Vaastavikta' },
      { email: '21052024@kiit.ac.in', name: 'SHASHWAT' },
      { email: '21052653@kiit.ac.in', name: 'ARPITA  MALLICK' },
      { email: '21053332@kiit.ac.in', name: 'TUSHER  BHAKTA' },
      { email: '21053416@kiit.ac.in', name: 'JOYETA MONDAL KOTHA' },
      { email: '2105015@kiit.ac.in', name: 'ANURAG  SINGH' },
      { email: '2105055@kiit.ac.in', name: 'RIDDHI  BAJPAYEE' },
      { email: '2105120@kiit.ac.in', name: 'DIBYOJYOTI  DEB' },
      { email: '2105136@kiit.ac.in', name: 'PRIYANSHU  KUMAR' },
      { email: '2105153@kiit.ac.in', name: 'SAUJANYA  CHANDRAKAR' },
      { email: '2105193@kiit.ac.in', name: 'DIPANWITA  GHOSH' },
      { email: '2105222@kiit.ac.in', name: 'RAJASHREE RAJALAXMI ROUT' },
      { email: '2105268@kiit.ac.in', name: 'AVANI' },
      { email: '2105308@kiit.ac.in', name: 'RUSHALI PADHIARY' },
      { email: '2105324@kiit.ac.in', name: 'SOHAM  MAZUMDAR' },
      { email: '2105361@kiit.ac.in', name: 'AYUSH  ANAND' },
      { email: '2105442@kiit.ac.in', name: 'ANISH  SINGH' },
      { email: '2105485@kiit.ac.in', name: 'SAMBUDDHA  CHATTERJEE' },
      { email: '2105539@kiit.ac.in', name: 'DEEKSHA  J' },
      { email: '2105628@kiit.ac.in', name: 'KRRISH' },
      { email: '2105644@kiit.ac.in', name: 'PUNYA PRASUN MOHANTY' },
      { email: '2105656@kiit.ac.in', name: 'SAMIDH  DASCHAUDHURI' },
      { email: '2105714@kiit.ac.in', name: 'FARHAN  JAFFER' },
      { email: '2105725@kiit.ac.in', name: 'NAALI  MOKSHA' },
      { email: '2105756@kiit.ac.in', name: 'SUDEEPTA  JENA' },
      { email: '2105813@kiit.ac.in', name: 'PRIYANSH SHARMA' },
      { email: '2105817@kiit.ac.in', name: 'RISHABH  CHAKRABORTY' },
      { email: '2105831@kiit.ac.in', name: 'SOHAM  PATRA' },
      { email: '2105849@kiit.ac.in', name: 'WRITANKAR  BISWAS' },
      { email: '2105858@kiit.ac.in', name: 'AKASH KUMAR JHA' },
      { email: '2105875@kiit.ac.in', name: 'BAISHNABI  PARIDA' },
      { email: '2105902@kiit.ac.in', name: 'PAARTH  PAREEK' },
      { email: '2105922@kiit.ac.in', name: 'SARTHAK KUMAR ROUT' },
      { email: '2105963@kiit.ac.in', name: 'DIPANKAR  KHANRA' },
      { email: '2106059@kiit.ac.in', name: 'SAPTADIP  ROOJ' },
      { email: '2106112@kiit.ac.in', name: 'DHANANJAY KUMAR SHARMA' },
      { email: '2106116@kiit.ac.in', name: 'GAURAV  KUMAR' },
      { email: '2106219@kiit.ac.in', name: 'JYOTI PROKASH  ROY' },
      { email: '2106229@kiit.ac.in', name: 'NIDHI  SINGH' },
      { email: '2106264@kiit.ac.in', name: 'SRISHTI  RUPA' },
      { email: '2106274@kiit.ac.in', name: 'UJJWAL PRATAP SINGH' },
      { email: '2106275@kiit.ac.in', name: 'VIVEK SHIVAM SAHARIA' },
      { email: '2128032@kiit.ac.in', name: 'OM  SINGH' },
      { email: '2128051@kiit.ac.in', name: 'SATWIKA  PANIGRAHI' },
      { email: '2128084@kiit.ac.in', name: 'SHALU  KUMARI' },
      { email: '2128085@kiit.ac.in', name: 'SHEEFA  NAAZ' },
      { email: '2128110@kiit.ac.in', name: 'VAIBHAV  GUPTA' },
      { email: '2128112@kiit.ac.in', name: 'VANSH  CHOURASIA' },
      { email: '2128121@kiit.ac.in', name: 'SHAMBHAVI  KASHYAP' },
      { email: '2128123@kiit.ac.in', name: 'ABHA  SRIVASTAVA' },
      { email: '2128126@kiit.ac.in', name: 'SAMAY  SINGH' },
      { email: '2129033@kiit.ac.in', name: 'SAUMYA  KUMARI' },
      { email: '2129048@kiit.ac.in', name: 'ANURAG  MISHRA' },
      { email: '2129049@kiit.ac.in', name: 'ANUSHKA  CHAUBEY' },
      { email: '2129062@kiit.ac.in', name: 'AVI  BHAGAT' },
      { email: '2129080@kiit.ac.in', name: 'NIKUNJ RANJAN JHA' },
      { email: '2129082@kiit.ac.in', name: 'PRADYUMN  MUKHOPADHYAY' },
      { email: '2129098@kiit.ac.in', name: 'SANYA SONU SINHA' },
      { email: '2129108@kiit.ac.in', name: 'SHRUTI BAIJNATH SAO' },
      { email: '2129138@kiit.ac.in', name: 'KANDREGULA UJWAL SUSANTH' },
      { email: '21051041@kiit.ac.in', name: 'ASTHA  RAJPUT' },
      { email: '21051077@kiit.ac.in', name: 'REKHA  SHEKHAWAT' },
      { email: '21051080@kiit.ac.in', name: 'SAAHEN SRIYAN MISHRA' },
      { email: '21051088@kiit.ac.in', name: 'SAYANIL  BANERJEE' },
      { email: '21051118@kiit.ac.in', name: 'ANANGSHA  SARKAR' },
      { email: '21051139@kiit.ac.in', name: 'KANAN  SINGH' },
      { email: '21051141@kiit.ac.in', name: 'KOMAL  TIWARY' },
      { email: '21051159@kiit.ac.in', name: 'RITISHA  GHOSH' },
      { email: '21051175@kiit.ac.in', name: 'SHRISTI  PRADHAN' },
      { email: '21051179@kiit.ac.in', name: 'SIMANDHAR KUMAR BAID' },
      { email: '21051216@kiit.ac.in', name: 'DIPTI  KUMARI' },
      { email: '21051234@kiit.ac.in', name: 'PRATHAM PRATEEK MOHANTY' },
      { email: '21051254@kiit.ac.in', name: 'SHEETAL  PANDA' },
      { email: '21051288@kiit.ac.in', name: 'ANUSUA  BISWAS' },
      { email: '21051325@kiit.ac.in', name: 'RAYAN  ALAM' },
      { email: '21051334@kiit.ac.in', name: 'SANGBARTIKA  SAHA' },
      { email: '21051359@kiit.ac.in', name: 'VRAJ NILAY SHAH' },
      { email: '21051362@kiit.ac.in', name: 'AAKASH DEEP SAH' },
      { email: '21051390@kiit.ac.in', name: 'BHASKAR  KUMAR' },
      { email: '21051489@kiit.ac.in', name: 'NITIN  PANDEY' },
      { email: '21051508@kiit.ac.in', name: 'SANJIVANI  MOHANTY' },
      { email: '21051551@kiit.ac.in', name: 'AYUSH  SINGH' },
      { email: '21051562@kiit.ac.in', name: 'DIPTENDRA  MAITY' },
      { email: '21051570@kiit.ac.in', name: 'KAUSTUBH MANDIT BAISAKH' },
      { email: '21051571@kiit.ac.in', name: 'ADHYAN  AGRAWAL' },
      { email: '21051583@kiit.ac.in', name: 'PROMIL  PIYUSH' },
      { email: '21051646@kiit.ac.in', name: 'CHITRA  SHARMA' },
      { email: '21051658@kiit.ac.in', name: 'LOHITAKSHYA  SAHOO' },
      { email: '21051714@kiit.ac.in', name: 'ANUBHAV  KERKETTA' },
      { email: '21051715@kiit.ac.in', name: 'ANUBHUTI  PRERNA' },
      { email: '21051721@kiit.ac.in', name: 'ARIJIT  MISTRY' },
      { email: '21051730@kiit.ac.in', name: 'AYUSH  RAJ' },
      { email: '21051786@kiit.ac.in', name: 'AAHANA  NATH' },
      { email: '21051837@kiit.ac.in', name: 'PRIYANKA  SAHA ROY' },
      { email: '21051843@kiit.ac.in', name: 'RONAK  SINHA' },
      { email: '21051855@kiit.ac.in', name: 'SUPRAVO  ROY' },
      { email: '21051857@kiit.ac.in', name: 'SUVRADEEP  SARKAR' },
      { email: '21051866@kiit.ac.in', name: 'VIKRANT  SINGH' },
      { email: '21051874@kiit.ac.in', name: 'ADITI  SINGH' },
      { email: '21051878@kiit.ac.in', name: 'AMARANAND  KUMAR' },
      { email: '21051883@kiit.ac.in', name: 'ARYAN  KUMAR' },
      { email: '21051889@kiit.ac.in', name: 'DEBASISH  NAYAK' },
      { email: '21051897@kiit.ac.in', name: 'ISHIKA  GUHA' },
      { email: '21051911@kiit.ac.in', name: 'NOMULA  SRIMLIKA' },
      { email: '21051933@kiit.ac.in', name: 'SHIVAM  SINGH' },
      { email: '21051942@kiit.ac.in', name: 'SOHAM  DAS' },
      { email: '21051955@kiit.ac.in', name: 'YASH  RAJ' },
      { email: '21051959@kiit.ac.in', name: 'ADHIRAJ  CHATTERJEE' },
      { email: '21051986@kiit.ac.in', name: 'BISWA BHUSAN DASH' },
      { email: '21051993@kiit.ac.in', name: 'HARSHITA  JENA' },
      { email: '21052030@kiit.ac.in', name: 'SIDHANT  MISHRA' },
      { email: '21052038@kiit.ac.in', name: 'AISHWARYA  ROUTRAY' },
      { email: '21052060@kiit.ac.in', name: 'RAHUL' },
      { email: '21052065@kiit.ac.in', name: 'AYUSH  KUMAR' },
      { email: '21052099@kiit.ac.in', name: 'SAPTASWA  MISTRI' },
      { email: '21052112@kiit.ac.in', name: 'SREYANS KUMAR PATRA' },
      { email: '21052115@kiit.ac.in', name: 'SUBHAM  PRADHAN' },
      { email: '21052121@kiit.ac.in', name: 'TEJAS  BINU' },
      { email: '21052144@kiit.ac.in', name: 'ANUSHKA  SINGH' },
      { email: '21052158@kiit.ac.in', name: 'JENIT PRAKASH KUMAR HARNESHA' },
      { email: '21052165@kiit.ac.in', name: 'NIHAR RANJAN SAHOO' },
      { email: '21052208@kiit.ac.in', name: 'UTPALA  DUTTA' },
      { email: '21052237@kiit.ac.in', name: 'ARYAN  CHOUDHRY' },
      { email: '21052297@kiit.ac.in', name: 'ABHILIPSA  SAHOO' },
      { email: '21052302@kiit.ac.in', name: 'ADITYA  SHUKLA' },
      { email: '21052309@kiit.ac.in', name: 'ANUBHAV  KUMAR' },
      { email: '21052315@kiit.ac.in', name: 'AVIRUP  SAMANTA' },
      { email: '21052328@kiit.ac.in', name: 'GOURAV  MAHAWAR' },
      { email: '21052340@kiit.ac.in', name: 'OM  JHA' },
      { email: '21052341@kiit.ac.in', name: 'PIYUSH  RAJ' },
      { email: '21052347@kiit.ac.in', name: 'RISHAV  DAS' },
      { email: '21052410@kiit.ac.in', name: 'BRIJIT  ADAK' },
      { email: '21052412@kiit.ac.in', name: 'DEBABRATA  NAYAK' },
      { email: '21052436@kiit.ac.in', name: 'OISHY  SUR' },
      { email: '21052439@kiit.ac.in', name: 'PRITISHA  GIRI' },
      { email: '21052471@kiit.ac.in', name: 'ADITYA  PANDEY' },
      { email: '21052480@kiit.ac.in', name: 'ANTRA  AMRIT' },
      { email: '21052506@kiit.ac.in', name: 'MILANI  NAYAK' },
      { email: '21052543@kiit.ac.in', name: 'SYED AYAAN WASIM' },
      { email: '21052544@kiit.ac.in', name: 'SYED ZAUREZ AHMED' },
      { email: '21052553@kiit.ac.in', name: 'ABHISHEK  DEWASI' },
      { email: '21052578@kiit.ac.in', name: 'BIBEK  MOHANTY' },
      { email: '21052600@kiit.ac.in', name: 'LOHIT  MISHRA' },
      { email: '21052601@kiit.ac.in', name: 'MAYANK  AGARWAL' },
      { email: '21052609@kiit.ac.in', name: 'RITWIKA  GHOSH' },
      { email: '21052610@kiit.ac.in', name: 'ROHAN  AGARWAL' },
      { email: '21052619@kiit.ac.in', name: 'SHARIF  PERWEZ' },
      { email: '21052701@kiit.ac.in', name: 'SAMRIDDHA  DAS BAIRAGYA' },
      { email: '21052756@kiit.ac.in', name: 'DIPISHA  SHIVANGI' },
      { email: '21052764@kiit.ac.in', name: 'KETAN KUMAR SUREKA' },
      { email: '21052781@kiit.ac.in', name: 'RISHI  KAR' },
      { email: '21052817@kiit.ac.in', name: 'ARNAB  MUKHERJEE' },
      { email: '21052840@kiit.ac.in', name: 'INDRASISH  BHATTACHARJEE' },
      { email: '21052885@kiit.ac.in', name: 'SWASTIK  PADHY' },
      { email: '21052893@kiit.ac.in', name: 'ABHISHEK  SATAPATHY' },
      { email: '21052948@kiit.ac.in', name: 'SARIKA  NEUPANE' },
      { email: '21052958@kiit.ac.in', name: 'TUSHAR  BHATTARAI' },
      { email: '21052961@kiit.ac.in', name: 'ANSHIKA  JAISWAL' },
      { email: '21052974@kiit.ac.in', name: 'YUVRAJ ROY CHOWDHURY' },
      { email: '21052992@kiit.ac.in', name: 'ARMAN  SINHA' },
      { email: '21053240@kiit.ac.in', name: 'RANVIJAY  HARICHANDAN' },
      { email: '21053277@kiit.ac.in', name: 'BISHAL KUMAR RAUNIYAR' },
      { email: '21053288@kiit.ac.in', name: 'MAMTA  KUMARI' },
      { email: '21053322@kiit.ac.in', name: 'SHREYA  MALLIK' },
      { email: '21053323@kiit.ac.in', name: 'SHRUTI  ROUNIYAR' },
      { email: '21053326@kiit.ac.in', name: 'SHWETA  KUMARI  SHAH' },
      { email: '21053384@kiit.ac.in', name: 'HEMANT  KUMAR' },
      { email: '21053402@kiit.ac.in', name: 'RANJAN  SRIVASTAV' },
      { email: '21053415@kiit.ac.in', name: 'CHANDRA BAHADUR CHHETRI' },
      { email: '21053425@kiit.ac.in', name: 'MEGHANJALI  SAHA' },
      { email: '21053434@kiit.ac.in', name: 'MUSKAN  SHARMA' },
      { email: '21053458@kiit.ac.in', name: 'SAPHAL  PANTH' },
      { email: '21053459@kiit.ac.in', name: 'SHRIJAN  POUDEL' },
      { email: '21053467@kiit.ac.in', name: 'PASHUPATI SHAMSHER SAH' },
      { email: '21053470@kiit.ac.in', name: 'SULAV  BHANDARI' },
      { email: '22057024@kiit.ac.in', name: 'BISWAJIT  SAMANTARAY' },
      { email: '22057025@kiit.ac.in', name: 'BODHISATTA  BHATTACHARJEE' },
      { email: '22057026@kiit.ac.in', name: 'C NIBEDITA SWAIN' },
      { email: '22057033@kiit.ac.in', name: 'HIRANMAYEE SAI SWAIN' },
      { email: '22057035@kiit.ac.in', name: 'JAYAKRUSHNA  PATTNAIK' },
      { email: '22057072@kiit.ac.in', name: 'SURYA PRITAM SATPATHY' },
      { email: '2105176@kiit.ac.in', name: 'ADITYA  SAHA' },
      { email: '2105252@kiit.ac.in', name: 'SWASTIK  PAIKARAY' },
      { email: '2105513@kiit.ac.in', name: 'ABHINAV  THAKUR' },
      { email: '2105514@kiit.ac.in', name: 'ABINASH  DAS' },
      { email: '2105555@kiit.ac.in', name: 'KUNAL KUMAR SINGH' },
      { email: '2105563@kiit.ac.in', name: 'PRIYANSHU  SINGH' },
      { email: '2106009@kiit.ac.in', name: 'ALOK  KUMAR' },
      { email: '2106120@kiit.ac.in', name: 'JEET AGARWAL' },
      { email: '2128020@kiit.ac.in', name: 'FANINDRA  KRISHNA' },
      { email: '2128075@kiit.ac.in', name: 'KALYANBRATA  GIRI' },
      { email: '2128101@kiit.ac.in', name: 'SUDESHNA  RATH' },
      { email: '2128140@kiit.ac.in', name: 'SIBONAKALISO  KINGLSY  MDLOVU' },
      { email: '21051627@kiit.ac.in', name: 'AMRITRAJ  BAJAPAYI' },
      { email: '21051718@kiit.ac.in', name: 'APRAJEETA  DUTTA' },
      { email: '21051927@kiit.ac.in', name: 'SATYADEB  CHAND' },
      { email: '21052210@kiit.ac.in', name: 'YASHVARDHAN  PANDEY' },
      { email: '21052279@kiit.ac.in', name: 'SHUBHAM KUMAR MANDAL' },
      { email: '21052324@kiit.ac.in', name: 'DIVYANSHU  TIWARI' },
      { email: '21052434@kiit.ac.in', name: 'NIKHIL  KUMAR' },
      { email: '21052464@kiit.ac.in', name: 'VISHAL  SINGH' },
      { email: '21052772@kiit.ac.in', name: 'NEEL  SHANKAR' },
      { email: '21053285@kiit.ac.in', name: 'KHALID MOHAMUD MOHAMED' },
      { email: '22057005@kiit.ac.in', name: 'AINDRILA  CHAKRABORTY' },
      { email: '22057039@kiit.ac.in', name: 'LIKSHAYA' },
      { email: '22057053@kiit.ac.in', name: 'SANKALP  CHAUHAN' },
      { email: '22057056@kiit.ac.in', name: 'SHOUMIK  BISWAS' },
      { email: '21051270@kiit.ac.in', name: 'UTKARSH  SHUKLA' },
      { email: '21052027@kiit.ac.in', name: 'SHREYA  DAS' },
      { email: '21053270@kiit.ac.in', name: 'ASHWANI  SAH' },
      { email: '2105002@kiit.ac.in', name: 'ABHISHEK  GAURAV' },
      { email: '2105098@kiit.ac.in', name: 'AHONA  GHOSH' },
      { email: '2105099@kiit.ac.in', name: 'AMEYA KUMAR CHANDRAKAR' },
      { email: '2105139@kiit.ac.in', name: 'ROHAN  KUMAR' },
      { email: '2105155@kiit.ac.in', name: 'SEMANTI  DAS' },
      { email: '2105216@kiit.ac.in', name: 'PRADYUNNA  PODDAR' },
      { email: '2105220@kiit.ac.in', name: 'PRAVAS RANJAN SAHOO' },
      { email: '2105278@kiit.ac.in', name: 'KANISHQ  MANDHYAN' },
      { email: '2105284@kiit.ac.in', name: 'MANISH KUMAR DAS' },
      { email: '2105328@kiit.ac.in', name: 'SRISHTI  BANERJEE' },
      { email: '2105336@kiit.ac.in', name: 'ADITI SUBHASHISH KHUNTIA' },
      { email: '2105387@kiit.ac.in', name: 'OORJA  SINGH' },
      { email: '2105430@kiit.ac.in', name: 'ABHISEK  PANDA' },
      { email: '2105500@kiit.ac.in', name: 'SK MD ARIF' },
      { email: '2105504@kiit.ac.in', name: 'SUBHASMIT  RAY' },
      { email: '2105527@kiit.ac.in', name: 'ANVIKSHA  SINGH' },
      { email: '2105536@kiit.ac.in', name: 'AYUSH  RAJ' },
      { email: '2105577@kiit.ac.in', name: 'SAYAN  ADHIKARI' },
      { email: '2105610@kiit.ac.in', name: 'ASHUTOSH  SAHOO' },
      { email: '2105793@kiit.ac.in', name: 'DEBJYOTI  GON' },
      { email: '2105864@kiit.ac.in', name: 'ANNIKA  SINGH' },
      { email: '2105870@kiit.ac.in', name: 'PRAKHAR  CHANDEL' },
      { email: '2105889@kiit.ac.in', name: 'HARSHIL  GUPTA' },
      { email: '2105900@kiit.ac.in', name: 'MAYANK  MISHRA' },
      { email: '2105932@kiit.ac.in', name: 'TOOBA  SULTANA' },
      { email: '2105971@kiit.ac.in', name: 'MANSI GANGA NAYAK' },
      { email: '2105976@kiit.ac.in', name: 'NISHANT  SINGH' },
      { email: '2105991@kiit.ac.in', name: 'RUNGSHIT  SAHA' },
      { email: '2106042@kiit.ac.in', name: 'PRASOON  AGRAWAL' },
      { email: '2106103@kiit.ac.in', name: 'ATUL  TUSHAR' },
      { email: '2106129@kiit.ac.in', name: 'PIYALI  MURMU' },
      { email: '2106214@kiit.ac.in', name: 'HARSH KUMAR MISHRA' },
      { email: '2106233@kiit.ac.in', name: 'PRASHASTI  SRIVASTAVA' },
      { email: '2106240@kiit.ac.in', name: 'RISHABH  SRIVASTAVA' },
      { email: '2106305@kiit.ac.in', name: 'ISTIAK AHAMED TURJYA' },
      { email: '2106322@kiit.ac.in', name: 'RITIKA SUMAN ROY' },
      { email: '2128004@kiit.ac.in', name: 'ADITI  BISWAS' },
      { email: '2128011@kiit.ac.in', name: 'ANAS  KHAN' },
      { email: '2128104@kiit.ac.in', name: 'SWATI  KAPOOR' },
      { email: '2128117@kiit.ac.in', name: 'ANIMESH  KUMAR' },
      { email: '2129002@kiit.ac.in', name: 'AARUSHI  RAY' },
      { email: '2129008@kiit.ac.in', name: 'ADITI  SINGH' },
      { email: '2129061@kiit.ac.in', name: 'AUGUSTINE S TOM' },
      { email: '2129105@kiit.ac.in', name: 'SHOURYA  SANYAL' },
      { email: '2129111@kiit.ac.in', name: 'SINJINEE  BANDYOPADHYAY' },
      { email: '2129115@kiit.ac.in', name: 'SUBHAJIT  ADHIKARY' },
      { email: '2129120@kiit.ac.in', name: 'V SHASHANK' },
      { email: '2129133@kiit.ac.in', name: 'ADWAY  PRATAP' },
      { email: '2129137@kiit.ac.in', name: 'KRISHNA   SAH' },
      { email: '2129144@kiit.ac.in', name: 'RAKESH  KUMAR' },
      { email: '21051018@kiit.ac.in', name: 'SURESH KUMAR' },
      { email: '21051115@kiit.ac.in', name: 'AMAN  KUMAR' },
      { email: '21051117@kiit.ac.in', name: 'AMIT KUMAR SINHA' },
      { email: '21051123@kiit.ac.in', name: 'AYUSH KUMAR HOTA' },
      { email: '21051124@kiit.ac.in', name: 'AYUSHA  SHARMA' },
      { email: '21051125@kiit.ac.in', name: 'DANISH IMROZ KHAN' },
      { email: '21051133@kiit.ac.in', name: 'FARHAT TASNIM LASKAR' },
      { email: '21051183@kiit.ac.in', name: 'SUBHADEEP  SHIL' },
      { email: '21051184@kiit.ac.in', name: 'SUBHAJIT  PATI' },
      { email: '21051188@kiit.ac.in', name: 'VEDPRAKASH  YADAV' },
      { email: '21051198@kiit.ac.in', name: 'AKASH  KUMAR' },
      { email: '21051227@kiit.ac.in', name: 'MITTAL  SHIT' },
      { email: '21051233@kiit.ac.in', name: 'PRATHAM PRAMOD GUPTA' },
      { email: '21051274@kiit.ac.in', name: 'VAISHNAVI  VERMA' },
      { email: '21051303@kiit.ac.in', name: 'SWASTIK  PANDA' },
      { email: '21051321@kiit.ac.in', name: 'PROMA  RAY' },
      { email: '21051381@kiit.ac.in', name: 'ARPIT  DARA' },
      { email: '21051406@kiit.ac.in', name: 'MAYURAKSHEE  SAHU' },
      { email: '21051460@kiit.ac.in', name: 'ANKIT KUMAR DAS' },
      { email: '21051461@kiit.ac.in', name: 'ANKIT KUMAR JENA' },
      { email: '21051487@kiit.ac.in', name: 'NAMAN  BHARTI' },
      { email: '21051522@kiit.ac.in', name: 'SWARNALI  MUKHOPADHYAY' },
      { email: '21051542@kiit.ac.in', name: 'ANUPAM  ANUBHAV' },
      { email: '21051604@kiit.ac.in', name: 'SPANDAN  SAHOO' },
      { email: '21051613@kiit.ac.in', name: 'UTKARSH  KUMAR' },
      { email: '21051686@kiit.ac.in', name: 'SHOBHIT  VERMA' },
      { email: '21051702@kiit.ac.in', name: 'AADESH KUMAR THAKUR' },
      { email: '21051716@kiit.ac.in', name: 'ANUJ  PRADHAN' },
      { email: '21051741@kiit.ac.in', name: 'MANTHAN PRASHANT MODI' },
      { email: '21051750@kiit.ac.in', name: 'PIYUSH  SHAW' },
      { email: '21051778@kiit.ac.in', name: 'TEJAS  JHA' },
      { email: '21051796@kiit.ac.in', name: 'ANJALI  PRIYA' },
      { email: '21051814@kiit.ac.in', name: 'DIPTA  TALUKDAR' },
      { email: '21051895@kiit.ac.in', name: 'HARSHIT  SINHA' },
      { email: '21051919@kiit.ac.in', name: 'RIDDHIMA  GHOSH' },
      { email: '21051926@kiit.ac.in', name: 'SATYA SUBHAM NAYAK' },
      { email: '21051929@kiit.ac.in', name: 'SAYANTANI  CHAKRABORTY' },
      { email: '21051989@kiit.ac.in', name: 'D PRASANTI PRIYA' },
      { email: '21052016@kiit.ac.in', name: 'RAKSHITA  BHATNAGAR' },
      { email: '21052026@kiit.ac.in', name: 'SHEKHAR  MAJHI' },
      { email: '21052126@kiit.ac.in', name: 'AASTHA  ANAND' },
      { email: '21052179@kiit.ac.in', name: 'ROHIT  TRIPATHY' },
      { email: '21052218@kiit.ac.in', name: 'ADDYA  TIWARI' },
      { email: '21052233@kiit.ac.in', name: 'ANUBHA  GHOSH' },
      { email: '21052268@kiit.ac.in', name: 'RICK  CHAKRABORTY' },
      { email: '21052396@kiit.ac.in', name: 'ANKITA  MOHAN' },
      { email: '21052450@kiit.ac.in', name: 'SATYAKAM  NAYAK' },
      { email: '21052457@kiit.ac.in', name: 'SUDIPTO  GHOSH' },
      { email: '21052545@kiit.ac.in', name: 'TUSHAR  AGRAWAL' },
      { email: '21052554@kiit.ac.in', name: 'ADARSH  TIWARI' },
      { email: '21052565@kiit.ac.in', name: 'ANKIT  KUMAR' },
      { email: '21052590@kiit.ac.in', name: 'HIMESH  MOHAPATRA' },
      { email: '21052598@kiit.ac.in', name: 'KUMAR VIMAL KIRTI SINGH' },
      { email: '21052640@kiit.ac.in', name: 'ABHISEK  MOHANTY' },
      { email: '21052685@kiit.ac.in', name: 'PRATYUSH KUMAR SAHOO' },
      { email: '21052688@kiit.ac.in', name: 'PUSHPAK KUMAR SAHU' },
      { email: '21052709@kiit.ac.in', name: 'SOHOM SHLOK PANDA' },
      { email: '21052713@kiit.ac.in', name: 'SRIDIP  SEAL' },
      { email: '21052717@kiit.ac.in', name: 'SWATI  KUMARI' },
      { email: '21052728@kiit.ac.in', name: 'ADITYA PRASAD RATH' },
      { email: '21052765@kiit.ac.in', name: 'KOYELI  HALDER' },
      { email: '21052783@kiit.ac.in', name: 'RIYA  SINGH' },
      { email: '21052802@kiit.ac.in', name: 'URBI  DAS' },
      { email: '21052811@kiit.ac.in', name: 'AMRITA  SINGH' },
      { email: '21052814@kiit.ac.in', name: 'ANUSHKA  SARKAR' },
      { email: '21052828@kiit.ac.in', name: 'BHAWYA  SINGH' },
      { email: '21052886@kiit.ac.in', name: 'TANISHA  SAMANTARAY' },
      { email: '21052914@kiit.ac.in', name: 'PRANAY  HARCHANDANI' },
      { email: '21052925@kiit.ac.in', name: 'SOUMYADEEP  CHANDRA' },
      { email: '21052935@kiit.ac.in', name: 'AKASH  KUMAR JAISHWAL' },
      { email: '21052978@kiit.ac.in', name: 'DEBANJAN  DHAR' },
      { email: '21052999@kiit.ac.in', name: 'KULANGE KRISHNA VIJAY' },
      { email: '21053206@kiit.ac.in', name: 'ARCHIT  JETHLIA' },
      { email: '21053226@kiit.ac.in', name: 'YASHARTH  SINHA' },
      { email: '21053227@kiit.ac.in', name: 'GAGAN PREET KAUR' },
      { email: '21053231@kiit.ac.in', name: 'LALAM  TEJASWINI' },
      { email: '21053243@kiit.ac.in', name: 'ANWESH  PATNAIK' },
      { email: '21053254@kiit.ac.in', name: 'PRIYANSHU  JAISWAL' },
      { email: '21053280@kiit.ac.in', name: 'DINESH  PAUDEL' },
      { email: '21053283@kiit.ac.in', name: 'JITENDRA KUMAR MANDAL' },
      { email: '21053287@kiit.ac.in', name: 'KUNAL  JHA' },
      { email: '21053298@kiit.ac.in', name: 'NEETU  DEY' },
      { email: '21053338@kiit.ac.in', name: 'GIRIJA PRASAD NAYAK' },
      { email: '21053342@kiit.ac.in', name: 'ROHIT RANJAN ROUT' },
      { email: '21053411@kiit.ac.in', name: 'MANOJ KUMAR  SARRAF' },
      { email: '21053418@kiit.ac.in', name: 'KOMALIKA  DAS' },
      { email: '21053433@kiit.ac.in', name: 'ANUPA  SHAH' },
      { email: '21053437@kiit.ac.in', name: 'PRIYANKA  KUMARI' },
      { email: '22057007@kiit.ac.in', name: 'AJIT YS' },
      { email: '22057031@kiit.ac.in', name: 'HARAPRASAD  PRADHAN' },
      { email: '22057054@kiit.ac.in', name: 'SAPA  ARPITA' },
      { email: '22057058@kiit.ac.in', name: 'SHREYA  KUMARI' },
      { email: '22057063@kiit.ac.in', name: 'SIDHARTH  PATTANAIK' },
      { email: '22057065@kiit.ac.in', name: 'SOURAJIT  MITRA' },
      { email: '2105011@kiit.ac.in', name: 'ANSHUMAN  MISHRA' },
      { email: '2105023@kiit.ac.in', name: 'AYANAVA  CHAKRABORTY' },
      { email: '2105032@kiit.ac.in', name: 'HIMANSHU  KUMAR' },
      { email: '2105039@kiit.ac.in', name: 'MRINMOY  BORDOLOI' },
      { email: '2105046@kiit.ac.in', name: 'PARTHIV  DEY' },
      { email: '2105048@kiit.ac.in', name: 'PRAGYNASMITA  SAHOO' },
      { email: '2105066@kiit.ac.in', name: 'SHAKSHI  KUMARI' },
      { email: '2105138@kiit.ac.in', name: 'RIPUDAMAN SINGH WALIA' },
      { email: '2105162@kiit.ac.in', name: 'SABHYA  RAJ' },
      { email: '2105172@kiit.ac.in', name: 'ABHAY  SINGH' },
      { email: '2105199@kiit.ac.in', name: 'JAHNVI  JAIN' },
      { email: '2105229@kiit.ac.in', name: 'RUPAL  PRADHAN' },
      { email: '2105234@kiit.ac.in', name: 'SANKET  AGARWAL' },
      { email: '2105240@kiit.ac.in', name: 'AMOGH' },
      { email: '2105259@kiit.ac.in', name: 'ANANYA  MATHUR' },
      { email: '2105270@kiit.ac.in', name: 'AYUSHI  MOHANTY' },
      { email: '2105290@kiit.ac.in', name: 'AKASH  RAJ' },
      { email: '2105304@kiit.ac.in', name: 'RITIKA  JAIN' },
      { email: '2105305@kiit.ac.in', name: 'ROHIT  KUMAR' },
      { email: '2105312@kiit.ac.in', name: 'SUBHASIS KUMAR PANDA' },
      { email: '2105322@kiit.ac.in', name: 'SIDHARTHA KUMAR DAS' },
      { email: '2105327@kiit.ac.in', name: 'SOURAV  PAL' },
      { email: '2105346@kiit.ac.in', name: 'ABHINANDAN  AGRAWAL' },
      { email: '2105354@kiit.ac.in', name: 'ANKIT' },
      { email: '2105356@kiit.ac.in', name: 'ANKUR SANTOSH WAGHAMODE' },
      { email: '2105369@kiit.ac.in', name: 'GAURAV  RAWAT' },
      { email: '2105372@kiit.ac.in', name: 'HEMANT' },
      { email: '2105380@kiit.ac.in', name: 'LOKESH BINDU DASH' },
      { email: '2105382@kiit.ac.in', name: 'MANSHI  KUMARI' },
      { email: '2105383@kiit.ac.in', name: 'MANSHI  PRATAP' },
      { email: '2105404@kiit.ac.in', name: 'SHANTANU  SHARMA' },
      { email: '2105417@kiit.ac.in', name: 'SUSMITA  PAL' },
      { email: '2105420@kiit.ac.in', name: 'TANISHA  SAINI' },
      { email: '2105451@kiit.ac.in', name: 'CHIRAG  TAK' },
      { email: '2105476@kiit.ac.in', name: 'PRIYANSHU  SARKAR' },
      { email: '2105477@kiit.ac.in', name: 'RAGHAV  MEHTA' },
      { email: '2105487@kiit.ac.in', name: 'SAPTARSHI  SHIL' },
      { email: '2105496@kiit.ac.in', name: 'RAHUL  GORAI' },
      { email: '2105541@kiit.ac.in', name: 'DEVANSH  KUMAR' },
      { email: '2105542@kiit.ac.in', name: 'GAURAV  KUMAR' },
      { email: '2105548@kiit.ac.in', name: 'KAJAL  KASHYAP' },
      { email: '2105575@kiit.ac.in', name: 'SARTHAK  PANDEY' },
      { email: '2105598@kiit.ac.in', name: 'ABHISHEK  KUMAR' },
      { email: '2105599@kiit.ac.in', name: 'ABHISHEK RAJ GUPTA' },
      { email: '2105607@kiit.ac.in', name: 'ARPIT  SAHU' },
      { email: '2105611@kiit.ac.in', name: 'AYUSH  AGARWALA' },
      { email: '2105636@kiit.ac.in', name: 'PRANAV  PRATEEK' },
      { email: '2105647@kiit.ac.in', name: 'RIMITA  MISRA' },
      { email: '2105652@kiit.ac.in', name: 'ROSHAN  JAMIL' },
      { email: '2105653@kiit.ac.in', name: 'SAHIL RAJ SINGH' },
      { email: '2105654@kiit.ac.in', name: 'SAHIL SINGH RAJPUT' },
      { email: '2105659@kiit.ac.in', name: 'DHRUV  CHAUHAN' },
      { email: '2105665@kiit.ac.in', name: 'SHIVANSH MANI TRIPATHI' },
      { email: '2105669@kiit.ac.in', name: 'SNEHAJIT  DEY' },
      { email: '2105670@kiit.ac.in', name: 'SNEHAN  SAHOO' },
      { email: '2105686@kiit.ac.in', name: 'ADITYA KUMAR SINGH' },
      { email: '2105729@kiit.ac.in', name: 'PRITAM  KHAN' },
      { email: '2105732@kiit.ac.in', name: 'RAJ  SINGH' },
      { email: '2105741@kiit.ac.in', name: 'SAMRIDDHA  SIL' },
      { email: '2105748@kiit.ac.in', name: 'SAYAN  CHATTOPADHYAY' },
      { email: '2105765@kiit.ac.in', name: 'VINITA  RAJAN' },
      { email: '2105770@kiit.ac.in', name: 'ANKIT  SINHA' },
      { email: '2105771@kiit.ac.in', name: 'ANKIT ANURAG SENAPATI' },
      { email: '2105774@kiit.ac.in', name: 'ANUSKA  JENA' },
      { email: '2105776@kiit.ac.in', name: 'ARPIT BARUN KUMAR' },
      { email: '2105790@kiit.ac.in', name: 'PRITISH  BHAWAL' },
      { email: '2105814@kiit.ac.in', name: 'PRIYESH  RAI' },
      { email: '2105830@kiit.ac.in', name: 'SIDHANT  RAJ' },
      { email: '2105855@kiit.ac.in', name: 'ADARSHA  ANURAG' },
      { email: '2105903@kiit.ac.in', name: 'PRABAL  VERMA' },
      { email: '2105905@kiit.ac.in', name: 'PRATYUSH  AGARWAL' },
      { email: '2105911@kiit.ac.in', name: 'RASHMI  VERMA' },
      { email: '2105912@kiit.ac.in', name: 'RISHAV  CHANDA' },
      { email: '2105925@kiit.ac.in', name: 'SHINJINI  CHATTERJEE' },
      { email: '2105929@kiit.ac.in', name: 'SREEJA  SINHA' },
      { email: '2105930@kiit.ac.in', name: 'SRIJAN  PATRO' },
      { email: '2105931@kiit.ac.in', name: 'SUBHADEEP  DAS' },
      { email: '2105934@kiit.ac.in', name: 'UPASANA  CHAUDHURI' },
      { email: '2105968@kiit.ac.in', name: 'KATYAYINI  MISHRA' },
      { email: '2105983@kiit.ac.in', name: 'PRINCY' },
      { email: '2105993@kiit.ac.in', name: 'SAAIM  FAAIZ' },
      { email: '2106013@kiit.ac.in', name: 'ANKIT KUMAR GHOSH' },
      { email: '2106017@kiit.ac.in', name: 'ARYAN  PARIHAR' },
      { email: '2106022@kiit.ac.in', name: 'AYUSH KUMAR RAY' },
      { email: '2106038@kiit.ac.in', name: 'MD FAIZAN  ZAKIR' },
      { email: '2106113@kiit.ac.in', name: 'DIBYAJYOTI  CHAKRAVARTI' },
      { email: '2106182@kiit.ac.in', name: 'SHRAYASI  MISTRI' },
      { email: '2106183@kiit.ac.in', name: 'AMAN KUMAR SINGH' },
      { email: '2106184@kiit.ac.in', name: 'AMMAR  YASIR' },
      { email: '2106200@kiit.ac.in', name: 'NATASHA  SHARMA' },
      { email: '2106226@kiit.ac.in', name: 'MIR NIYAZUL HAQUE' },
      { email: '2106286@kiit.ac.in', name: 'MANYTUCH  MANGAR BENY  RUEI' },
      { email: '2106298@kiit.ac.in', name: 'VISHAL KUMAR MAHATO' },
      { email: '2106302@kiit.ac.in', name: 'ANIKET  LAHIRI' },
      { email: '2128019@kiit.ac.in', name: 'DIPTODIP  BASU' },
      { email: '2128022@kiit.ac.in', name: 'HARSHIT  ANAND' },
      { email: '2128025@kiit.ac.in', name: 'LIPIKA' },
      { email: '2128026@kiit.ac.in', name: 'MD ADNAN AFZAL' },
      { email: '2128090@kiit.ac.in', name: 'SNEHA  RAJ' },
      { email: '2128098@kiit.ac.in', name: 'SRIRAM NILAKANTHA PADHY' },
      { email: '2128102@kiit.ac.in', name: 'SUMIT KUMAR SAMAL' },
      { email: '2128113@kiit.ac.in', name: 'VIMAL  PANDA' },
      { email: '2129043@kiit.ac.in', name: 'ANIKA  PRAKASH' },
      { email: '2129068@kiit.ac.in', name: 'PURUSHOTAM  KUMAR' },
      { email: '2129103@kiit.ac.in', name: 'SHIVAM  JANA' },
      { email: '2129109@kiit.ac.in', name: 'SHUBHANSHU  MISHRA' },
      { email: '2129124@kiit.ac.in', name: 'VISHESH RAJ SOLANKI' },
      { email: '2129140@kiit.ac.in', name: 'RAHUL  BAGARIA' },
      { email: '21051003@kiit.ac.in', name: 'SHASHWAT  SINGH' },
      { email: '21051004@kiit.ac.in', name: 'SHATAKSHI  SINGH' },
      { email: '21051013@kiit.ac.in', name: 'SOHAM  PANDA' },
      { email: '21051021@kiit.ac.in', name: 'A SUBHAM PATRO' },
      { email: '21051058@kiit.ac.in', name: 'JAYANT KUMAR JHA' },
      { email: '21051110@kiit.ac.in', name: 'ADITI  SRIVASTAVA' },
      { email: '21051111@kiit.ac.in', name: 'ADITYA  SRIVASTAVA' },
      { email: '21051131@kiit.ac.in', name: 'DRISHTI  PRIYADARSHINI' },
      { email: '21051186@kiit.ac.in', name: 'SWETA  PANDEY' },
      { email: '21051191@kiit.ac.in', name: 'SOUMYA SUBHADRA SATPATHY' },
      { email: '21051209@kiit.ac.in', name: 'ARYAN  KAUSHAL' },
      { email: '21051212@kiit.ac.in', name: 'AYUSH  DAS' },
      { email: '21051248@kiit.ac.in', name: 'SAPEKSH' },
      { email: '21051257@kiit.ac.in', name: 'SHIVANSH  MISHRA' },
      { email: '21051265@kiit.ac.in', name: 'SUCHETAN  MUKHERJEE' },
      { email: '21051272@kiit.ac.in', name: 'VAIBHAV  LALL' },
      { email: '21051283@kiit.ac.in', name: 'ANANYA  SENGUPTA' },
      { email: '21051293@kiit.ac.in', name: 'ARYAN  SINGH' },
      { email: '21051299@kiit.ac.in', name: 'BARUN KUMAR GUPTA' },
      { email: '21051307@kiit.ac.in', name: 'DIVYANSH  SUMAN' },
      { email: '21051317@kiit.ac.in', name: 'PARV  AHUJA' },
      { email: '21051363@kiit.ac.in', name: 'ABHIJEET  ANAND' },
      { email: '21051397@kiit.ac.in', name: 'HARSH  SINHA' },
      { email: '21051402@kiit.ac.in', name: 'LAV  KUMAR' },
      { email: '21051405@kiit.ac.in', name: 'MAYUKH  MONDAL' },
      { email: '21051436@kiit.ac.in', name: 'SOUMYABRATA  SAMANTA' },
      { email: '21051452@kiit.ac.in', name: 'ADITYA  RAJ' },
      { email: '21051456@kiit.ac.in', name: 'AMAN ANOOP SAXENA' },
      { email: '21051486@kiit.ac.in', name: 'MOUMITA  SUTRADHAR' },
      { email: '21051493@kiit.ac.in', name: 'PRARTHANA  JOSHI' },
      { email: '21051498@kiit.ac.in', name: 'RAIHAN  SIDDIQUI' },
      { email: '21051502@kiit.ac.in', name: 'RISHI  RAJ' },
      { email: '21051514@kiit.ac.in', name: 'SHRINKHALA' },
      { email: '21051521@kiit.ac.in', name: 'SWAPNIL  DAS' },
      {
        email: '21051529@kiit.ac.in',
        name: 'YANAMALA DEEPESH SAI KUMAR REDDY',
      },
      { email: '21051532@kiit.ac.in', name: 'AAKASH KUMAR SINHA' },
      { email: '21051545@kiit.ac.in', name: 'ARKAJYOTI  SARMA' },
      { email: '21051550@kiit.ac.in', name: 'ASHUTOSH  RAI' },
      { email: '21051574@kiit.ac.in', name: 'KUSHAGRA  SRIVASTAVA' },
      { email: '21051593@kiit.ac.in', name: 'SASWATI  MOHANTY' },
      { email: '21051596@kiit.ac.in', name: 'SHRUTI  DUTTA' },
      { email: '21051610@kiit.ac.in', name: 'SHREY  KHARE' },
      { email: '21051617@kiit.ac.in', name: 'AAKIF  OSMANI' },
      { email: '21051645@kiit.ac.in', name: 'ASHISH  ANAND' },
      { email: '21051647@kiit.ac.in', name: 'DEBASISH  RAY' },
      { email: '21051653@kiit.ac.in', name: 'ISHIKA  PADHI' },
      { email: '21051655@kiit.ac.in', name: 'KRISH  PUNDIR' },
      { email: '21051688@kiit.ac.in', name: 'SHUBHOM  SRIVASTAVA' },
      { email: '21051694@kiit.ac.in', name: 'SWAYAM SEKHAR SAHOO' },
      { email: '21051697@kiit.ac.in', name: 'VAIBHAV  PATEL' },
      { email: '21051713@kiit.ac.in', name: 'ANIKET KUMAR GUPTA' },
      { email: '21051720@kiit.ac.in', name: 'ARGHYA ROOPAM BEHERA' },
      { email: '21051742@kiit.ac.in', name: 'APURBA  MANDAL' },
      { email: '21051754@kiit.ac.in', name: 'RAUNAK KUMAR JHA' },
      { email: '21051783@kiit.ac.in', name: 'YASH  AGRAWAL' },
      { email: '21051813@kiit.ac.in', name: 'DEVASHISH' },
      { email: '21051822@kiit.ac.in', name: 'IPSHITA  DAS' },
      { email: '21051826@kiit.ac.in', name: 'NIDA  FARNAZ' },
      { email: '21051836@kiit.ac.in', name: 'PRIYANKA  PANIGRAHI' },
      { email: '21051844@kiit.ac.in', name: 'SAHIL  ISLAM' },
      { email: '21051853@kiit.ac.in', name: 'SUBHAM  PANDA' },
      { email: '21051903@kiit.ac.in', name: 'KUMAR  UTSAV' },
      { email: '21051907@kiit.ac.in', name: 'MAYANK  SRIVASTAVA' },
      { email: '21051910@kiit.ac.in', name: 'NISHITA  DEO' },
      { email: '21051938@kiit.ac.in', name: 'SHUBHAM  SHANKAR' },
      { email: '21051943@kiit.ac.in', name: 'SREYASI  MAKHAL' },
      { email: '21051972@kiit.ac.in', name: 'ANSUMAN  PATI' },
      { email: '21051978@kiit.ac.in', name: 'ARITRA  PATTANAYAK' },
      { email: '21051979@kiit.ac.in', name: 'ARNAB  BERA' },
      { email: '21051987@kiit.ac.in', name: 'CHANDAN  GUPTA' },
      { email: '21051992@kiit.ac.in', name: 'GITANSH  VATS' },
      { email: '21052002@kiit.ac.in', name: 'LADLY  SWAIN' },
      { email: '21052004@kiit.ac.in', name: 'NALLA SREE HARSHITHA' },
      { email: '21052009@kiit.ac.in', name: 'PRANEET SAMPARN SWAIN' },
      { email: '21052041@kiit.ac.in', name: 'A VIGNESH  RAO' },
      { email: '21052042@kiit.ac.in', name: 'AAKASH KUMAR GORAI' },
      { email: '21052044@kiit.ac.in', name: 'ABHIJIT  KUMAR' },
      { email: '21052055@kiit.ac.in', name: 'ANUSHKA  GHOSH' },
      { email: '21052079@kiit.ac.in', name: 'LAXMIISHRII  PRUSTY' },
      { email: '21052092@kiit.ac.in', name: 'RATINDRA  KATYAYAN' },
      { email: '21052100@kiit.ac.in', name: 'SARVANSH  JAIN' },
      { email: '21052123@kiit.ac.in', name: 'VAIBHAV  YADAV' },
      { email: '21052139@kiit.ac.in', name: 'ANIRAN  SARKAR' },
      { email: '21052140@kiit.ac.in', name: 'ANISHA RAJ' },
      { email: '21052155@kiit.ac.in', name: 'HARSHIL  GAUTAM' },
      { email: '21052160@kiit.ac.in', name: 'JUHI  KUMARI' },
      { email: '21052167@kiit.ac.in', name: 'PRAJNADEEP  PRADHAN' },
      { email: '21052170@kiit.ac.in', name: 'PRIYABRATA  GHOSH' },
      { email: '21052181@kiit.ac.in', name: 'S  KHUSHI' },
      { email: '21052188@kiit.ac.in', name: 'SAYANTI  GHOSH' },
      { email: '21052201@kiit.ac.in', name: 'SUBHASIS  SWAIN' },
      { email: '21052245@kiit.ac.in', name: 'BINAY KUMAR SAHU' },
      { email: '21052247@kiit.ac.in', name: 'DEBJIT  MAJI' },
      { email: '21052294@kiit.ac.in', name: 'YASH KUMAR SINGH' },
      { email: '21052306@kiit.ac.in', name: 'ANANYA  PRAKASH' },
      { email: '21052312@kiit.ac.in', name: 'ASHWINI  KAPOOR' },
      { email: '21052317@kiit.ac.in', name: 'AYUSH KUMAR RANA' },
      { email: '21052332@kiit.ac.in', name: 'KUNAL  KUMAR' },
      { email: '21052363@kiit.ac.in', name: 'SHUBHAM  AGARWAL' },
      { email: '21052377@kiit.ac.in', name: 'VARUN  MISHRA' },
      { email: '21052379@kiit.ac.in', name: 'YASH  DWIVEDI' },
      { email: '21052383@kiit.ac.in', name: 'ABHISHEK  KUMAR' },
      { email: '21052388@kiit.ac.in', name: 'AKSHAY  KUMAR' },
      { email: '21052394@kiit.ac.in', name: 'ANIMESH KUMAR KAR' },
      { email: '21052426@kiit.ac.in', name: 'KARAN KUMAR SAINI' },
      { email: '21052435@kiit.ac.in', name: 'OINDRELLA  CHATTERJEE' },
      { email: '21052467@kiit.ac.in', name: 'AAMOGHA  BILLORE' },
      { email: '21052483@kiit.ac.in', name: 'APURVA  JHA' },
      { email: '21052510@kiit.ac.in', name: 'NEHA  MEHER' },
      { email: '21052513@kiit.ac.in', name: 'DHRUV KUMAR' },
      { email: '21052515@kiit.ac.in', name: 'PRATYUSH  PANY' },
      { email: '21052526@kiit.ac.in', name: 'SAMANGYA  NAYAK' },
      { email: '21052537@kiit.ac.in', name: 'SRIJAN  SAHA' },
      { email: '21052595@kiit.ac.in', name: 'KAVYA  PRIYADARSHI' },
      { email: '21052604@kiit.ac.in', name: 'PRAKHAR  BHARDWAJ' },
      { email: '21052612@kiit.ac.in', name: 'SAMARPITA  PANIGRAHY' },
      { email: '21052635@kiit.ac.in', name: 'VIVEK  KUMAR' },
      { email: '21052648@kiit.ac.in', name: 'ANEESHA  BANIK' },
      { email: '21052663@kiit.ac.in', name: 'RISHIKESH  KUMAR' },
      { email: '21052669@kiit.ac.in', name: 'JATIN  NAYAK' },
      { email: '21052670@kiit.ac.in', name: 'JEYSUWI  CHOWLEK' },
      { email: '21052678@kiit.ac.in', name: 'MOUPIYA  CHATTERJEE' },
      { email: '21052683@kiit.ac.in', name: 'PRATISHTHA  KUMARI' },
      { email: '21052700@kiit.ac.in', name: 'SAKSHAM  SHARMA' },
      { email: '21052715@kiit.ac.in', name: 'SUDEEPA  NANDI' },
      { email: '21052719@kiit.ac.in', name: 'TANUJ  SINGH' },
      { email: '21052720@kiit.ac.in', name: 'TIYASHA  KUNDU' },
      { email: '21052743@kiit.ac.in', name: 'ASHLEY ANN JOSEPH' },
      { email: '21052745@kiit.ac.in', name: 'AVANIP  KUMAR' },
      { email: '21052768@kiit.ac.in', name: 'MANDAKANI  MISHRA' },
      { email: '21052789@kiit.ac.in', name: 'SATWIK  SATPATHY' },
      { email: '21052790@kiit.ac.in', name: 'SHARIQUE  IQUBAL' },
      { email: '21052805@kiit.ac.in', name: 'VISHAL  BHAGAT' },
      { email: '21052831@kiit.ac.in', name: 'DEBISMITA  DEY' },
      { email: '21052836@kiit.ac.in', name: 'DEVASHISH KUMAR SINGH' },
      { email: '21052852@kiit.ac.in', name: 'PRADIP  KARAN' },
      { email: '21052871@kiit.ac.in', name: 'SHASHWAT  SINGH' },
      { email: '21052883@kiit.ac.in', name: 'SUKIRTI' },
      { email: '21052913@kiit.ac.in', name: 'PRACHI  JATIA' },
      { email: '21052915@kiit.ac.in', name: 'RAXIT  SINGH' },
      { email: '21052917@kiit.ac.in', name: 'SACHI  VERMA' },
      { email: '21052919@kiit.ac.in', name: 'SAUMYAJEET  JENA' },
      { email: '21052968@kiit.ac.in', name: 'PARIJA  RAUL' },
      { email: '21052973@kiit.ac.in', name: 'HARSH KUMAR JHA' },
      { email: '21052979@kiit.ac.in', name: 'ANUSHREE' },
      { email: '21053211@kiit.ac.in', name: 'KUMAR ROSHAN' },
      { email: '21053214@kiit.ac.in', name: 'PIYUSH  KUMAR' },
      { email: '21053217@kiit.ac.in', name: 'DEWANSH  SABOO' },
      { email: '21053256@kiit.ac.in', name: 'AADITYA  KARNA' },
      { email: '21053278@kiit.ac.in', name: 'CHANDRA BHUSHAN DEO' },
      { email: '21053293@kiit.ac.in', name: 'MD TARIQ  HOSSAIN' },
      { email: '21053309@kiit.ac.in', name: 'RAHUL  DEV MALLICK' },
      { email: '21053319@kiit.ac.in', name: 'SAPTHAK MOHAJON TURJYA' },
      { email: '21053366@kiit.ac.in', name: 'BHAWNA TEWARY' },
      { email: '21053389@kiit.ac.in', name: 'SHIV KUMAR RAUT' },
      { email: '21053391@kiit.ac.in', name: 'MOLLIKA  DAS' },
      { email: '21053424@kiit.ac.in', name: 'ANIL KUMAR YADAV' },
      { email: '21053465@kiit.ac.in', name: 'SUMAN  PANDIT' },
      { email: '21053468@kiit.ac.in', name: 'SHRISTI  DUTTA' },
      { email: '21053475@kiit.ac.in', name: 'AAYUSHMA  GAUTAM' },
      { email: '22057012@kiit.ac.in', name: 'ANIMESH  MAJI' },
      { email: '22057015@kiit.ac.in', name: 'ANKITA ACHARYA' },
      { email: '22057027@kiit.ac.in', name: 'CHAUDHURY SHAIKH SAHIL NASIR' },
      { email: '22057042@kiit.ac.in', name: 'MD  ARQAM' },
      { email: '22057043@kiit.ac.in', name: 'MUKESH  KUMAR' },
      { email: '22057046@kiit.ac.in', name: 'PREETY  GOUR' },
      { email: '22057066@kiit.ac.in', name: 'SRUTI  NAYAK' },
      { email: '22057071@kiit.ac.in', name: 'SUMANT KUMAR NAIK' },
      { email: '22057075@kiit.ac.in', name: 'SWAYOM SHREE SHIVANEE BEHERA' },
      { email: '22057084@kiit.ac.in', name: 'SASWATA  DEY' },
      { email: '2105057@kiit.ac.in', name: 'RISHAV  RAJ' },
      { email: '2105184@kiit.ac.in', name: 'ARYAN  THAKUR' },
      { email: '2105283@kiit.ac.in', name: 'MANAS KUMAR SINGH' },
      { email: '2105296@kiit.ac.in', name: 'ABHIGYAN  ADITYA' },
      { email: '2105431@kiit.ac.in', name: 'ABHISHEK  PANDEY' },
      { email: '2105433@kiit.ac.in', name: 'ADITI SINGH ROY' },
      { email: '2105567@kiit.ac.in', name: 'RISHABH RAJ PATHAK' },
      { email: '2105677@kiit.ac.in', name: 'ARION LEONEL BARAL' },
      { email: '2105880@kiit.ac.in', name: 'BISWAJIT  NAYAK' },
      { email: '2105909@kiit.ac.in', name: 'PRIYANSH  SENAPATI' },
      { email: '2105921@kiit.ac.in', name: 'SARTHAK  PRUSTY' },
      { email: '2106004@kiit.ac.in', name: 'ADIL ROHAN SHAH' },
      { email: '2106060@kiit.ac.in', name: 'SARTHAK  SINGH' },
      { email: '2106108@kiit.ac.in', name: 'BISWA PRAKASH `PATRA' },
      { email: '2106117@kiit.ac.in', name: 'HIMANSHU  DASH' },
      { email: '2106153@kiit.ac.in', name: 'SHREYA  DAS' },
      { email: '2106189@kiit.ac.in', name: 'ANSHUMAN  SARANGI' },
      { email: '2128009@kiit.ac.in', name: 'ALOK KUMAR SADANGI' },
      { email: '2128029@kiit.ac.in', name: 'MUKUND  SHARMA' },
      { email: '2128039@kiit.ac.in', name: 'RAJENDRAN  SRINIVASAN' },
      { email: '2128047@kiit.ac.in', name: 'SANJANA  MOHANTY' },
      { email: '2128061@kiit.ac.in', name: 'ABHISHEK KUMAR SINGH' },
      { email: '2128081@kiit.ac.in', name: 'PRAVIN KUMAR PATTNAIK' },
      { email: '2128109@kiit.ac.in', name: 'UTKARSH  PALLAV' },
      { email: '2129004@kiit.ac.in', name: 'ABHIJEET  SHAHI' },
      { email: '2129015@kiit.ac.in', name: 'AHAANA  MANGA' },
      { email: '2129024@kiit.ac.in', name: 'ISHIKA  GOYAL' },
      { email: '2129076@kiit.ac.in', name: 'MANYA  MODI' },
      { email: '2129077@kiit.ac.in', name: 'MEHZAR  KHAN' },
      { email: '2129078@kiit.ac.in', name: 'MUKUL JAIN' },
      { email: '2129079@kiit.ac.in', name: 'MUSKAAN  SHARMA' },
      { email: '2129086@kiit.ac.in', name: 'PRIYANKA  GHARA' },
      { email: '2129116@kiit.ac.in', name: 'SUJAL PRATAP SINGH' },
      { email: '2129123@kiit.ac.in', name: 'VIKASH  PRASAD' },
      { email: '2129151@kiit.ac.in', name: 'LATIKA  HEMBRAM' },
      { email: '2129160@kiit.ac.in', name: 'KAFIA ADEN MOHMED' },
      { email: '21051034@kiit.ac.in', name: 'ANMOL  RAJ' },
      { email: '21051054@kiit.ac.in', name: 'HARSH KUMAR VERMA' },
      { email: '21051144@kiit.ac.in', name: 'ADITYA KUNWAR SINGH' },
      { email: '21051313@kiit.ac.in', name: 'LOYNA  DUTTA' },
      { email: '21051345@kiit.ac.in', name: 'SONALI' },
      { email: '21051372@kiit.ac.in', name: 'AMRITA  PRADHAN' },
      { email: '21051474@kiit.ac.in', name: 'DEV NARAYAN PRASAD' },
      { email: '21051651@kiit.ac.in', name: 'HARSH  GUPTA' },
      { email: '21051685@kiit.ac.in', name: 'SHIVANSHU  PATEL' },
      { email: '21051703@kiit.ac.in', name: 'PARAV  SHARMA' },
      { email: '21051729@kiit.ac.in', name: 'AYUSH  KUMAR' },
      { email: '21051755@kiit.ac.in', name: 'REHAN  QUADARY' },
      { email: '21051787@kiit.ac.in', name: 'ABHIROOP  MAJUMDER' },
      { email: '21051789@kiit.ac.in', name: 'ABHISHEK  ANKUR' },
      { email: '21051827@kiit.ac.in', name: 'NILAY  SINGH' },
      { email: '21051848@kiit.ac.in', name: 'SMRUTI RANJAN KODAMASINGH' },
      { email: '21051922@kiit.ac.in', name: 'SAGNIK  SEN' },
      { email: '21051970@kiit.ac.in', name: 'ANISHA  NAYAK' },
      { email: '21052108@kiit.ac.in', name: 'SONDEEPON  ROY' },
      { email: '21052134@kiit.ac.in', name: 'AKASH  SINGH' },
      { email: '21052241@kiit.ac.in', name: 'AYUSH  RAJ' },
      { email: '21052319@kiit.ac.in', name: 'DEVI PRASAD MISHRA' },
      { email: '21052572@kiit.ac.in', name: 'ARPAN  KANYAKUBJA' },
      { email: '21052629@kiit.ac.in', name: 'SUSHIL KUMAR' },
      { email: '21052636@kiit.ac.in', name: 'AAYUSHMAN  ATTREYA' },
      { email: '21052638@kiit.ac.in', name: 'ABHIGYAN ANAND' },
      { email: '21052655@kiit.ac.in', name: 'BAYAN KUMAR SAHU' },
      { email: '21052712@kiit.ac.in', name: 'SRABANI  TRIPATHY' },
      { email: '21052726@kiit.ac.in', name: 'ACHYUT  VARDHAN' },
      { email: '21052758@kiit.ac.in', name: 'GIRIDHAR  GOPAL' },
      { email: '21052997@kiit.ac.in', name: 'SURBHI  ROY' },
      { email: '21053000@kiit.ac.in', name: 'PROTHAM  SARKAR' },
      { email: '21053261@kiit.ac.in', name: 'ABIY ABINET   MAMO' },
      { email: '21053290@kiit.ac.in', name: 'MD  RASEL  UDDIN' },
      { email: '21053327@kiit.ac.in', name: 'SISAY BEYENE JUJA' },
      { email: '21053392@kiit.ac.in', name: 'KAZI REZAUL KABIR  RAFI' },
      { email: '21053394@kiit.ac.in', name: 'RAJESH  CHOWDHURY' },
      { email: '21053397@kiit.ac.in', name: 'MUNISH  KUMAR' },
      { email: '22057002@kiit.ac.in', name: 'ABHISEK  SAHOO' },
      { email: '22057014@kiit.ac.in', name: 'ANJALI PANDA' },
      { email: '22057040@kiit.ac.in', name: 'MAITHILI  SAHA' },
      { email: '22057051@kiit.ac.in', name: 'SAI RAJ SATAPATHY' },
      { email: '22057076@kiit.ac.in', name: 'SWOSTI PRIYA JENA' },
      { email: '22057083@kiit.ac.in', name: 'ANKITA  SINGH' },
      { email: '2105020@kiit.ac.in', name: 'ARYAN  DEBRAY' },
      { email: '2105064@kiit.ac.in', name: 'SASWATA  PURI' },
      { email: '2105185@kiit.ac.in', name: 'ASHISH  KUMAR' },
      { email: '2105194@kiit.ac.in', name: 'DIYA  BASU' },
      { email: '2105207@kiit.ac.in', name: 'MANISH KUMAR DALAI' },
      { email: '2105281@kiit.ac.in', name: 'MADHU  MUKTA' },
      { email: '2105326@kiit.ac.in', name: 'SOURAV  KUMAR' },
      { email: '2105405@kiit.ac.in', name: 'SHIBHAM KUMAR SINGH' },
      { email: '2105414@kiit.ac.in', name: 'SUDIN  BEBORTA' },
      { email: '2105537@kiit.ac.in', name: 'BIDISHA BISWARUPA MUDULI' },
      { email: '2105557@kiit.ac.in', name: 'MANOJ KUMAR PRADHAN' },
      { email: '2105698@kiit.ac.in', name: 'ANKUR ANIL BORAH' },
      { email: '2105740@kiit.ac.in', name: 'SHUBH  MITTAL' },
      { email: '2105742@kiit.ac.in', name: 'SAMRIDDHI  SINGH' },
      { email: '2105747@kiit.ac.in', name: 'SAYAK  MONDAL' },
      { email: '2105838@kiit.ac.in', name: 'SUPRASAD  SARANGI' },
      { email: '2105846@kiit.ac.in', name: 'UTKAL  SAHOO' },
      { email: '2105874@kiit.ac.in', name: 'AYUSHMAN  BHOWMIK' },
      { email: '2129012@kiit.ac.in', name: 'ADRIJA  CHATTERJEE' },
      { email: '2129087@kiit.ac.in', name: 'PRIYANSHU  GARG' },
      { email: '21051314@kiit.ac.in', name: 'MOHIT  TIWARY' },
      { email: '21051513@kiit.ac.in', name: 'SAYAN  SARKAR' },
      { email: '21051520@kiit.ac.in', name: 'SUVOJIT  GHOSH' },
      { email: '21051632@kiit.ac.in', name: 'ARANYA KUMAR SEN' },
      { email: '21051799@kiit.ac.in', name: 'AONJANEYA  BANERJEE' },
      { email: '21051858@kiit.ac.in', name: 'SWAPNAJIT  SARKAR' },
      { email: '21051862@kiit.ac.in', name: 'UDITA  SINGH' },
      { email: '21051923@kiit.ac.in', name: 'SAHIL  KUMAR' },
      { email: '21051952@kiit.ac.in', name: 'TANMAY  MISHRA' },
      { email: '21051964@kiit.ac.in', name: 'AKSHITA  GHOSH' },
      { email: '21052074@kiit.ac.in', name: 'JAY  SINGH' },
      { email: '21052076@kiit.ac.in', name: 'KISHALAY  GHOSH' },
      { email: '21052107@kiit.ac.in', name: 'SNEHASISH  PRADHAN' },
      { email: '21052109@kiit.ac.in', name: 'SOUMMADEEP  SENGUPTA' },
      { email: '21052183@kiit.ac.in', name: 'SAMPAN  BASU' },
      { email: '21052229@kiit.ac.in', name: 'MISHAN  MAURYA' },
      { email: '21052389@kiit.ac.in', name: 'ALOUKIK  PATI' },
      { email: '21052409@kiit.ac.in', name: 'AYUSHI  PRAHARAJ' },
      { email: '21052459@kiit.ac.in', name: 'SWETANK  SHEKHAR' },
      { email: '21052479@kiit.ac.in', name: 'ANSHUL  KUMAR' },
      { email: '21052524@kiit.ac.in', name: 'RUDRAJYOTI  DAS' },
      { email: '21052547@kiit.ac.in', name: 'VEDANT  KUMAR' },
      { email: '21052618@kiit.ac.in', name: 'SHAHID  ALI' },
      { email: '21052641@kiit.ac.in', name: 'ADITYA  PANDEY' },
      { email: '21052664@kiit.ac.in', name: 'HARSHDEEP  SINGH' },
      { email: '21052671@kiit.ac.in', name: 'AMLAN  PATI' },
      { email: '21052699@kiit.ac.in', name: 'SAGNIK  GHOSH' },
      { email: '21052708@kiit.ac.in', name: 'SHREYA  RAKSHIT' },
      { email: '21052722@kiit.ac.in', name: 'AARUSHI  PHULRE' },
      { email: '21052731@kiit.ac.in', name: 'AMITABH  BAL' },
      { email: '21052829@kiit.ac.in', name: 'CHAITANYA  YADAV' },
      { email: '21053289@kiit.ac.in', name: 'MANDIP  SAH' },
      { email: '21053296@kiit.ac.in', name: 'MITHILA  DAS' },
      { email: '21053314@kiit.ac.in', name: 'ROSHAN  BARNWAL' },
      { email: '21053333@kiit.ac.in', name: 'VEDPRAKASH  PATEL' },
      { email: '21053395@kiit.ac.in', name: 'RAFAT   REDWAN' },
      { email: '21053420@kiit.ac.in', name: 'RANJIT KUMAR DAS' },
      { email: '21053436@kiit.ac.in', name: 'ROHAN  KARN' },
      { email: '21053442@kiit.ac.in', name: 'SUPREET  SHAH' },
      { email: '21053448@kiit.ac.in', name: 'ANIKET  ROUNIYAR' },
      { email: '21053462@kiit.ac.in', name: 'AYUSH KUMAR AGRAWAL' },
      { email: '22057057@kiit.ac.in', name: 'SHREYA  DAS' },
      { email: '22057087@kiit.ac.in', name: 'AKASH  PATRO' },
      { email: '2105034@kiit.ac.in', name: 'JYOTIRMAY  MANNA' },
      { email: '2105050@kiit.ac.in', name: 'PRATIKSHYA  BEHERA' },
      { email: '2105158@kiit.ac.in', name: 'SHIV PRASAD  ROUL' },
      { email: '2105179@kiit.ac.in', name: 'ANKIT  KUMAR' },
      { email: '2105189@kiit.ac.in', name: 'BHARATI  MAJUMDER' },
      { email: '2105196@kiit.ac.in', name: 'HARSH PREET SINGH' },
      { email: '2105280@kiit.ac.in', name: 'KUMAR YASH MEHUL' },
      { email: '2105293@kiit.ac.in', name: 'PRIYANSHU  KUMAR' },
      { email: '2105299@kiit.ac.in', name: 'RASHI  VERMA' },
      { email: '2105323@kiit.ac.in', name: 'SMRUTI REKHA MOHANTY' },
      { email: '2105360@kiit.ac.in', name: 'ASHUTOSH  DAS' },
      { email: '2105395@kiit.ac.in', name: 'PRIYANSHU SUMAN PANDA' },
      { email: '2105424@kiit.ac.in', name: 'GOLAKH BIHARI MOHAPATRA' },
      { email: '2105446@kiit.ac.in', name: 'ARITRA  MAITI' },
      { email: '2105559@kiit.ac.in', name: 'NIKUNJ  KHEMKA' },
      { email: '2105565@kiit.ac.in', name: 'REYANSH' },
      { email: '2105624@kiit.ac.in', name: 'HARSH KUMAR SHARMA' },
      { email: '2105625@kiit.ac.in', name: 'HARSH KUMAR SINHA' },
      { email: '2105674@kiit.ac.in', name: 'MAYANK  RAJ' },
      { email: '2105796@kiit.ac.in', name: 'GOMZEE SINGH TEOTIA' },
      { email: '2105818@kiit.ac.in', name: 'RISHAV  PRASAD' },
      { email: '2105906@kiit.ac.in', name: 'PRATYUSH  SAHOO' },
      { email: '2105958@kiit.ac.in', name: 'B SRUJAL NAYAK' },
      { email: '2106006@kiit.ac.in', name: 'AKASH  PAL' },
      { email: '2106089@kiit.ac.in', name: 'ANGSHUMAN  NATH' },
      { email: '2106097@kiit.ac.in', name: 'KRITARTHA  KASHYAP' },
      { email: '2106106@kiit.ac.in', name: 'AYUSH  SENAPATI' },
      { email: '2106119@kiit.ac.in', name: 'JEET  HAIT' },
      { email: '2106125@kiit.ac.in', name: 'MEGHA  VERMA' },
      { email: '2106135@kiit.ac.in', name: 'PRANJAL  CHOWDHURY' },
      { email: '2106190@kiit.ac.in', name: 'APARAJITA  MISHRA' },
      { email: '2106198@kiit.ac.in', name: 'AYUSH  KUMAR' },
      { email: '2106203@kiit.ac.in', name: 'BISHAKHA  PANDA' },
      { email: '2106206@kiit.ac.in', name: 'DIBYA  VERMA' },
      { email: '2106207@kiit.ac.in', name: 'DIKSHA  SINGH' },
      { email: '2106213@kiit.ac.in', name: 'HARSH  KUMAR' },
      { email: '2106215@kiit.ac.in', name: 'HARSHVARDHAN  OJHA' },
      { email: '2106216@kiit.ac.in', name: 'IPSITA  SAMAL' },
      { email: '2106225@kiit.ac.in', name: 'MANI  RATNAM' },
      { email: '2106242@kiit.ac.in', name: 'RITESH  RAJ' },
      { email: '2106249@kiit.ac.in', name: 'SAYANTAN  DAS' },
      { email: '2106265@kiit.ac.in', name: 'SRIYA  PANDA' },
      { email: '2106297@kiit.ac.in', name: 'SAHIL  KUMAR' },
      { email: '2106317@kiit.ac.in', name: 'MOHAMED ASHRAF  USAMA' },
      { email: '21051012@kiit.ac.in', name: 'SNEHA  BHASKAR' },
      { email: '21051014@kiit.ac.in', name: 'SOHAN  BANERJEE' },
      { email: '21051017@kiit.ac.in', name: 'SOURAV  NAYAK' },
      { email: '21051035@kiit.ac.in', name: 'ANURUP  MOHANTY' },
      { email: '21051053@kiit.ac.in', name: 'GYANA RANJAN PARIDA' },
      { email: '21051092@kiit.ac.in', name: 'SHREYANSHU  KASHYAP' },
      { email: '21051101@kiit.ac.in', name: 'SYED AYMAN ALI' },
      { email: '21051150@kiit.ac.in', name: 'PARIVESH  SRIVASTAVA' },
      { email: '21051154@kiit.ac.in', name: 'PRIYANSHU  PRIYADARSHI' },
      { email: '21051161@kiit.ac.in', name: 'ROWNAK  MONDAL' },
      { email: '21051169@kiit.ac.in', name: 'SATYAM KUMAR SINGH' },
      { email: '21051194@kiit.ac.in', name: 'AGRIM  AGRAWAL' },
      { email: '21051335@kiit.ac.in', name: 'SAURABH SUSHANT SRIVASTAVA' },
      { email: '21051339@kiit.ac.in', name: 'SHREYAS  RAMA' },
      { email: '21051388@kiit.ac.in', name: 'AYUSH  KUMAR' },
      { email: '21051440@kiit.ac.in', name: 'SUBHAM  RAJ' },
      { email: '21051443@kiit.ac.in', name: 'U  LIPIKA' },
      { email: '21051446@kiit.ac.in', name: 'ABHIGYAN  MOHANTY' },
      { email: '21051457@kiit.ac.in', name: 'AMIT  RAJ' },
      { email: '21051495@kiit.ac.in', name: 'PRIYANSHU  TIWARI' },
      { email: '21051504@kiit.ac.in', name: 'RONIT  RAJ' },
      { email: '21051523@kiit.ac.in', name: 'KAPPALA TANVI ANANYA' },
      { email: '21051600@kiit.ac.in', name: 'SOUMIT MANAS PRADHAN' },
      { email: '21051631@kiit.ac.in', name: 'ANWAYA KUMAR NAYAK' },
      { email: '21051764@kiit.ac.in', name: 'SHREYA  ROY' },
      { email: '21051807@kiit.ac.in', name: 'CS  BHAGWANT' },
      { email: '21051818@kiit.ac.in', name: 'ANANYA  KHUNTIA' },
      { email: '21051852@kiit.ac.in', name: 'SUBHAM  MOHANTY' },
      { email: '21051885@kiit.ac.in', name: 'AYUSH  BISWAS' },
      { email: '21051976@kiit.ac.in', name: 'ARCHI  PRIYAM' },
      { email: '21052043@kiit.ac.in', name: 'AASTHA  MAHAPATRA' },
      { email: '21052101@kiit.ac.in', name: 'SATYAM  RAJ' },
      { email: '21052138@kiit.ac.in', name: 'ANANYA  PRIYADARSHINI' },
      { email: '21052192@kiit.ac.in', name: 'SHUBHAM  ROY' },
      { email: '21052203@kiit.ac.in', name: 'SUSHREE SOMYAKANTI SWOYAM SUDHA' },
      { email: '21052258@kiit.ac.in', name: 'MUKTESH  MISHRA' },
      { email: '21052339@kiit.ac.in', name: 'NIKHIL  GEORGE' },
      { email: '21052443@kiit.ac.in', name: 'RITIK  RAJ' },
      { email: '21052470@kiit.ac.in', name: 'ABHYUDAY  UPADHYAY' },
      { email: '21052475@kiit.ac.in', name: 'ANGANA  MITRA' },
      { email: '21052493@kiit.ac.in', name: 'DEBARYA  ROY' },
      { email: '21052504@kiit.ac.in', name: 'KANAV  PRADHAN' },
      { email: '21052529@kiit.ac.in', name: 'SATYAM  BEHERA' },
      { email: '21052587@kiit.ac.in', name: 'HANZLA  ANIS' },
      { email: '21052656@kiit.ac.in', name: 'BHARGAV  RAO' },
      { email: '21052721@kiit.ac.in', name: 'AAKARSH KUMAR SINGH' },
      { email: '21052727@kiit.ac.in', name: 'ADITYA  KUMAR' },
      { email: '21052835@kiit.ac.in', name: 'DEVALEENA  DAS' },
      { email: '21052872@kiit.ac.in', name: 'SHAYARI  HALDER' },
      { email: '21052895@kiit.ac.in', name: 'AMAN  ANAND' },
      { email: '21052910@kiit.ac.in', name: 'MONALISA PRIYADARSINI SWAIN' },
      { email: '21052911@kiit.ac.in', name: 'NILANJAN  PAUL' },
      { email: '21052943@kiit.ac.in', name: 'MUHIT  KHAN' },
      { email: '21052965@kiit.ac.in', name: 'RISHAB  JAIN' },
      { email: '21052970@kiit.ac.in', name: 'SIDDHANT  KUMAR' },
      { email: '21052982@kiit.ac.in', name: 'MANJARI  SAHU' },
      { email: '21053221@kiit.ac.in', name: 'TANISHA  BERA' },
      { email: '21053228@kiit.ac.in', name: 'RAKSHIT  ANAND' },
      { email: '21053255@kiit.ac.in', name: 'MOHIT  KUNDU' },
      { email: '21053292@kiit.ac.in', name: 'MD MUSHTAQ SHAHREAR TONMOY' },
      { email: '21053318@kiit.ac.in', name: 'SANYAM  SAH' },
      { email: '21053346@kiit.ac.in', name: 'AYUSH' },
      { email: '21053359@kiit.ac.in', name: 'ADITYA  PANDEY' },
      { email: '21053369@kiit.ac.in', name: 'MAYANK K KAUSHIK' },
      { email: '21053376@kiit.ac.in', name: 'AHMAT SENOUSSI  AHMAT' },
      { email: '21053390@kiit.ac.in', name: 'MD SHAHRIAR HOSAN PARVEZ' },
      {
        email: '21053413@kiit.ac.in',
        name: 'EKANAYAKA MUDIYANSELAGE HIRUNI DINESHA E',
      },
      {
        email: '21053426@kiit.ac.in',
        name: 'SINGAPPULI ARACHCHIGE THARUSHI DEWMINI',
      },
      { email: '21053464@kiit.ac.in', name: 'RIZAN  KHANAL' },
      { email: '21053466@kiit.ac.in', name: 'UTKARSH  SHRESTHA' },
      { email: '21053473@kiit.ac.in', name: 'SHUBHAM  DAWADI' },
      { email: '22057019@kiit.ac.in', name: 'ASHISH KUMAR JENA' },
      { email: '22057034@kiit.ac.in', name: 'INSIYA  PARVEZ' },
      { email: '22057036@kiit.ac.in', name: 'JOYDEV  BEHERA' },
      { email: '22057050@kiit.ac.in', name: 'RAJSHREE' },
      { email: '22057069@kiit.ac.in', name: 'SUBHASISH  NAYAK' },
      { email: '22057074@kiit.ac.in', name: 'SWAPNIL RAJKUMAR BOSE' },
      { email: '22057079@kiit.ac.in', name: 'DIPTA SUNDAR DAS' },
      { email: '2105001@kiit.ac.in', name: 'ABHIJEET  KUMAR' },
      { email: '2105019@kiit.ac.in', name: 'ARK  UPADHYAY' },
      { email: '2105040@kiit.ac.in', name: 'MRINMOY  NASKAR' },
      { email: '2105074@kiit.ac.in', name: 'SRUTI  MONDAL' },
      { email: '2105079@kiit.ac.in', name: 'UNNATI  SINGH' },
      { email: '2105482@kiit.ac.in', name: 'SAGNIK  ROY' },
      { email: '2105495@kiit.ac.in', name: 'SHRUTI  KUMARI' },
      { email: '2105562@kiit.ac.in', name: 'PANKAJ KUMAR CHOUDHURY' },
      { email: '2105584@kiit.ac.in', name: 'SUHANI  MAITRA' },
      { email: '2105604@kiit.ac.in', name: 'ANKANA  MUKHERJEE' },
      { email: '2105757@kiit.ac.in', name: 'SUJIT KUMAR ROUT' },
      { email: '2105802@kiit.ac.in', name: 'KAUSTAV  MITRA' },
      { email: '2105810@kiit.ac.in', name: 'PRATYUSH  ADHIKARI' },
      { email: '2105890@kiit.ac.in', name: 'HARSHIT  SINGHANIA' },
      { email: '2106043@kiit.ac.in', name: 'PRATIBH  SINHA' },
      { email: '2106070@kiit.ac.in', name: 'SHUBHAM  KUMAR' },
      { email: '2106132@kiit.ac.in', name: 'PRAKASH  KUMAR' },
      { email: '2106221@kiit.ac.in', name: 'KHUSHAL  SETH' },
      { email: '2106231@kiit.ac.in', name: 'PAVAKI MAITHILI' },
      { email: '2106241@kiit.ac.in', name: 'RISHIKA  RANJAN' },
      { email: '2106269@kiit.ac.in', name: 'SUKHARANJAN  JANA' },
      { email: '2106276@kiit.ac.in', name: 'PARTHASARATHI  BHARADWAJ' },
      { email: '2129003@kiit.ac.in', name: 'AARYAN  RAJ' },
      { email: '2129016@kiit.ac.in', name: 'AKASH  CHANDRAKAR' },
      { email: '2129081@kiit.ac.in', name: 'PRACHEELAGNA  PANY' },
      { email: '2129083@kiit.ac.in', name: 'PRATHAM  KUMAR' },
      { email: '2129097@kiit.ac.in', name: 'SANIA' },
      { email: '2129104@kiit.ac.in', name: 'SHOMILI  DUARY' },
      { email: '2129107@kiit.ac.in', name: 'SHRUTI  DWIVEDI' },
      { email: '2129114@kiit.ac.in', name: 'SOUVIK  CHANDA' },
      { email: '2129135@kiit.ac.in', name: 'ABDULLATEEF  MUADH OLAMILEKAN' },
      { email: '21051063@kiit.ac.in', name: 'MD NOOR E  SHADAN' },
      { email: '21051174@kiit.ac.in', name: 'SHREYA  BHATTACHARYA' },
      { email: '21051333@kiit.ac.in', name: 'SAMYAK  NATH' },
      { email: '21051343@kiit.ac.in', name: 'SHUBHADEEP  GHATAK' },
      { email: '21051385@kiit.ac.in', name: 'ASUTOSH  GOUDA' },
      { email: '21051389@kiit.ac.in', name: 'AYUSH  MISHRA' },
      { email: '21051447@kiit.ac.in', name: 'ABHILASHA  BANERJEE' },
      { email: '21051539@kiit.ac.in', name: 'ANKAN  MOHANTY' },
      { email: '21051569@kiit.ac.in', name: 'ISHTAJ KAUR DEOL' },
      { email: '21051587@kiit.ac.in', name: 'RATNAABH  SINGH' },
      { email: '21051597@kiit.ac.in', name: 'SIDDHARTH  JENA' },
      { email: '21051609@kiit.ac.in', name: 'SWETA  BARAL' },
      { email: '21051622@kiit.ac.in', name: 'AFRAH  MIRZA' },
      { email: '21051711@kiit.ac.in', name: 'AMITAYAS  BANERJEE' },
      { email: '21051712@kiit.ac.in', name: 'ANANYA  MISHRA' },
      { email: '21051761@kiit.ac.in', name: 'SATYA  PRAKASH' },
      { email: '21051901@kiit.ac.in', name: 'KHUSHI  ARYA' },
      { email: '21051965@kiit.ac.in', name: 'ALISHA  PANIGRAHI' },
      { email: '21051973@kiit.ac.in', name: 'ANTULI  DEY' },
      { email: '21051981@kiit.ac.in', name: 'ARYA PRAKASH DAS' },
      { email: '21052061@kiit.ac.in', name: 'ASHUTOSH  GARANAYAK' },
      { email: '21052227@kiit.ac.in', name: 'ANIMESH  SINGH' },
      { email: '21052242@kiit.ac.in', name: 'AYUSH  SINGH' },
      { email: '21052259@kiit.ac.in', name: 'NILESH  ANAND' },
      { email: '21052293@kiit.ac.in', name: 'ARVIND  KUMAR' },
      { email: '21052442@kiit.ac.in', name: 'RITANKAR  JANA' },
      { email: '21052494@kiit.ac.in', name: 'DEEPANSHU  PADHY' },
      { email: '21052503@kiit.ac.in', name: 'KALPITA  CHAKRABORTY' },
      { email: '21052542@kiit.ac.in', name: 'SWAYAM  PATTNAIK' },
      { email: '21052657@kiit.ac.in', name: 'BIKASH KUMAR MUNI' },
      { email: '21052696@kiit.ac.in', name: 'RIYA  BISHT' },
      { email: '21052735@kiit.ac.in', name: 'ANKITA  SAMANTARAY' },
      { email: '21052873@kiit.ac.in', name: 'SHRADHA  SUMAN' },
      { email: '21052877@kiit.ac.in', name: 'SK SHAHABAZ AMIN' },
      { email: '21052971@kiit.ac.in', name: 'MD ABU FARHAN' },
      { email: '21053341@kiit.ac.in', name: 'AAYUSHI  MODI' },
      { email: '21053350@kiit.ac.in', name: 'ELINA  CHAKRABORTY' },
      { email: '22057009@kiit.ac.in', name: 'ANANYA  ROUT' },
      { email: '22057010@kiit.ac.in', name: 'ANANYA SAMANTA SINGHAR' },
      { email: '22057016@kiit.ac.in', name: 'APARAJITA  DASH' },
      { email: '22057017@kiit.ac.in', name: 'ARUNESH  SAGAR' },
      { email: '22057021@kiit.ac.in', name: 'AUROSHREE  MOHANTY' },
      { email: '22057041@kiit.ac.in', name: 'MAYANK  PUROHIT' },
      { email: '22057062@kiit.ac.in', name: 'SIDHARTH  MISHRA' },
      { email: '22057078@kiit.ac.in', name: 'VENKATESH' },
      { email: '22057086@kiit.ac.in', name: 'SINGH ANKITA RAJIV' },
      { email: '2105058@kiit.ac.in', name: 'ROUDRAK  SAHA' },
      { email: '2105425@kiit.ac.in', name: 'ZOYA  KHAN' },
      { email: '21051273@kiit.ac.in', name: 'VAIBHAV  TIWARI' },
      { email: '21051540@kiit.ac.in', name: 'ANKLESH  MISHRA' },
      { email: '21051733@kiit.ac.in', name: 'DIBYADYUTI  SENGUPTA' },
      { email: '21051745@kiit.ac.in', name: 'MRINAL  RAJ' },
      { email: '21051765@kiit.ac.in', name: 'SHREYASEE  SARKAR' },
      { email: '2105101@kiit.ac.in', name: 'AMLAN  BHATTACHARYA' },
      { email: '2105105@kiit.ac.in', name: 'ANKIT RAJ KUSHWAHA' },
      { email: '2105131@kiit.ac.in', name: 'PANDEY UDIT  RAY' },
      { email: '2105191@kiit.ac.in', name: 'DEBALEENA  BASU' },
      { email: '2105195@kiit.ac.in', name: 'GAURAV  MOHANTY' },
      { email: '2105203@kiit.ac.in', name: 'KRISHNA  KUMAR' },
      { email: '2105265@kiit.ac.in', name: 'ANU  RAJ' },
      { email: '2105276@kiit.ac.in', name: 'INDRANUJ  GHOSH' },
      { email: '2105321@kiit.ac.in', name: 'JAGRITI  SINGH' },
      { email: '2105396@kiit.ac.in', name: 'RACHIT  GAUTAM' },
      { email: '2105703@kiit.ac.in', name: 'ASHUTOSH  RATH' },
      { email: '2105716@kiit.ac.in', name: 'GARVIT  BABBAR' },
      { email: '2105760@kiit.ac.in', name: 'NIKHIL KUMAR CHAUDHARY' },
      { email: '2105819@kiit.ac.in', name: 'RITIKA  SINGH' },
      { email: '2105869@kiit.ac.in', name: 'ARYAMAN  ACHARYA' },
      { email: '2105899@kiit.ac.in', name: 'MANISH KUMAR SINGH' },
      { email: '2105947@kiit.ac.in', name: 'ANANYA  DIKSHIT' },
      { email: '2128044@kiit.ac.in', name: 'RUPKATHA  CHOWDHURY' },
      { email: '2128058@kiit.ac.in', name: 'SHASWATA  DAM' },
      { email: '2128070@kiit.ac.in', name: 'ATUL  SHARMA' },
      { email: '2128078@kiit.ac.in', name: 'NATASHA  PATI' },
      { email: '2128105@kiit.ac.in', name: 'SWAYAM RUDRAKSHYA NAYAK' },
      { email: '2128116@kiit.ac.in', name: 'TARUNJIT  SAHA' },
      { email: '2128139@kiit.ac.in', name: 'DIVANSHU' },
      { email: '2128146@kiit.ac.in', name: 'K V PRANAY' },
      { email: '2129021@kiit.ac.in', name: 'ALKESH  SINGH' },
      { email: '2129054@kiit.ac.in', name: 'KISHLAY KUMAR RAI' },
      { email: '21051005@kiit.ac.in', name: 'SHILPA  KUMARI' },
      { email: '21051022@kiit.ac.in', name: 'AAINA  BHAWNANI' },
      { email: '21051049@kiit.ac.in', name: 'DEVANGA  PAUL' },
      { email: '21051059@kiit.ac.in', name: 'SAURABH  BANDYOPADHYAY' },
      { email: '21051136@kiit.ac.in', name: 'HRISHIKESH  HAZARIKA' },
      { email: '21051196@kiit.ac.in', name: 'AKANKSHA  YADAV' },
      { email: '21051376@kiit.ac.in', name: 'ANNESHA  MUKHOPADHYAY' },
      { email: '21051423@kiit.ac.in', name: 'SAMRAT  CHAKRABORTY' },
      { email: '21051473@kiit.ac.in', name: 'DEEPRATIM  SAIKIA' },
      { email: '21051494@kiit.ac.in', name: 'PRATHAM  PRITHIRAJ' },
      { email: '21051557@kiit.ac.in', name: 'BIYYALA JASWANTH REDDY' },
      { email: '21051579@kiit.ac.in', name: 'NEERAJ SAIKUMAR ADDETLA' },
      { email: '21051612@kiit.ac.in', name: 'TUSHAR  JOSHI' },
      { email: '21051644@kiit.ac.in', name: 'BIRANCHI NARAYAN MISHRA' },
      { email: '21051660@kiit.ac.in', name: 'MARUSHIKA  SHUKLA' },
      { email: '21051691@kiit.ac.in', name: 'SOURAV  BEHERA' },
      { email: '21051746@kiit.ac.in', name: 'NEELKAMAL  PATTANAIK' },
      { email: '21051834@kiit.ac.in', name: 'PRANAV  JALAN' },
      { email: '21051851@kiit.ac.in', name: 'SUBANDHU' },
      { email: '21052093@kiit.ac.in', name: 'RISHIK  SUDDAPALLI' },
      { email: '21052124@kiit.ac.in', name: 'VARUN  SHANKAR' },
      { email: '21052289@kiit.ac.in', name: 'SUSHAN  NAYAK' },
      { email: '21052418@kiit.ac.in', name: 'GAURAV  NAHATA' },
      { email: '21052438@kiit.ac.in', name: 'PARTH  PANDEY' },
      { email: '21052551@kiit.ac.in', name: 'AARYAN' },
      { email: '21052588@kiit.ac.in', name: 'HARMANJOT  SINGH' },
      { email: '21052646@kiit.ac.in', name: 'AKSHAT  JAISWAL' },
      { email: '21052704@kiit.ac.in', name: 'SHIBAA  NAIK' },
      { email: '21052748@kiit.ac.in', name: 'BINAY KUMAR DAS' },
      { email: '21052800@kiit.ac.in', name: 'SYAMANTAK  MANDAL' },
      { email: '21052854@kiit.ac.in', name: 'PRATHAM  MISHRA' },
      { email: '21052891@kiit.ac.in', name: 'AANCHAL  PANDEY' },
      { email: '21053269@kiit.ac.in', name: 'ASHISH  KANDEL' },
      { email: '21053409@kiit.ac.in', name: 'MICHAEL MWENYA CHILESHE' },
      { email: '22057006@kiit.ac.in', name: 'AISHWARYA  MOHANTY' },
      { email: '2105084@kiit.ac.in', name: 'VISHAL  SINGH' },
      { email: '2105111@kiit.ac.in', name: 'ATULYA  PRATAP' },
      { email: '2105124@kiit.ac.in', name: 'KISHLAY VATS' },
      { email: '2105160@kiit.ac.in', name: 'SHREYA' },
      { email: '2105192@kiit.ac.in', name: 'DIKSHIKA  DWEEPANITA' },
      { email: '2105285@kiit.ac.in', name: 'MEGH  SINGHAL' },
      { email: '2105358@kiit.ac.in', name: 'ARJUN RAJESH NAIR' },
      { email: '2105366@kiit.ac.in', name: 'DEBJIT  GOSWAMI' },
      { email: '2105379@kiit.ac.in', name: 'KUMARI KHUSHI' },
      { email: '2105384@kiit.ac.in', name: 'NAMAN  AGARWAL' },
      { email: '2105391@kiit.ac.in', name: 'PREETI PADMA SAHU' },
      { email: '2105449@kiit.ac.in', name: 'CHAITANYA BHARAT BHISE' },
      { email: '2105465@kiit.ac.in', name: 'KRISH  BATRA' },
      { email: '2105475@kiit.ac.in', name: 'PRIYANSH  BANSAL' },
      { email: '2105675@kiit.ac.in', name: 'SUBHRONIL  MUKHERJEE' },
      { email: '2105676@kiit.ac.in', name: 'SUDIP  CHANDA' },
      { email: '2105687@kiit.ac.in', name: 'ADITYA SINGH CHAUHAN' },
      { email: '2105697@kiit.ac.in', name: 'ANKOOR KUMAR KASHYAP' },
      { email: '2105779@kiit.ac.in', name: 'ASHIS  PATTANAIK' },
      { email: '2105789@kiit.ac.in', name: 'CHAMAN  KUMAR' },
      { email: '2105826@kiit.ac.in', name: 'SAYANEE  SUR' },
      { email: '2105827@kiit.ac.in', name: 'SHASHANK  DEEPAK' },
      { email: '2105828@kiit.ac.in', name: 'SHASHI  PRAKASH' },
      { email: '2105852@kiit.ac.in', name: 'AMAN  KUMAR' },
      { email: '2105920@kiit.ac.in', name: 'SARTHAK  MOHANTY' },
      { email: '2106003@kiit.ac.in', name: 'ABHIRAJ  SINGH' },
      { email: '2106033@kiit.ac.in', name: 'JIGISHA  GUPTA' },
      { email: '2106136@kiit.ac.in', name: 'PRATYUSH' },
      { email: '2106169@kiit.ac.in', name: 'SYAMANTAK  MUKHERJEE' },
      { email: '2106217@kiit.ac.in', name: 'JAYAM  GUPTA' },
      { email: '2106254@kiit.ac.in', name: 'SHIVAM  KUMAR' },
      { email: '21051119@kiit.ac.in', name: 'TRIRANGA  SENAPATI' },
      { email: '21051156@kiit.ac.in', name: 'PRIYESH  GOSWAMI' },
      { email: '21051160@kiit.ac.in', name: 'ROHIT  AGARWAL' },
      { email: '21051167@kiit.ac.in', name: 'SASHREEK  DAS' },
      { email: '21051206@kiit.ac.in', name: 'ANSHIKA  DWARI' },
      { email: '21051437@kiit.ac.in', name: 'SOUMYAKANT  PARIDA' },
      { email: '21051448@kiit.ac.in', name: 'ABHIRAJ KISHORE DAS' },
      { email: '21051537@kiit.ac.in', name: 'ANANYA  GUPTA' },
      { email: '21051598@kiit.ac.in', name: 'SNEHA  SAHA' },
      { email: '21051599@kiit.ac.in', name: 'SOHAM  BANERJEE' },
      { email: '21051877@kiit.ac.in', name: 'ALOK KUMAR JHA' },
      { email: '21051896@kiit.ac.in', name: 'ISHAAN  NANDI' },
      { email: '21051945@kiit.ac.in', name: 'SURAJ  SINGH' },
      { email: '21051961@kiit.ac.in', name: 'ADITYA  SINGH' },
      { email: '21051990@kiit.ac.in', name: 'DEBOSMITA  CHAKRABORTY' },
      { email: '21052086@kiit.ac.in', name: 'PALAK  GUPTA' },
      { email: '21052151@kiit.ac.in', name: 'CHETAN DEV MASKARA' },
      { email: '21052215@kiit.ac.in', name: 'ABHINAV  YADAV' },
      { email: '21052222@kiit.ac.in', name: 'AHONA  ROYCHOUDHURY' },
      { email: '21052223@kiit.ac.in', name: 'AKASHIKA  ANSHUM' },
      { email: '21052230@kiit.ac.in', name: 'ANMOL KUMAR SINGH' },
      { email: '21052252@kiit.ac.in', name: 'HIMANSHU  RANJAN' },
      { email: '21052284@kiit.ac.in', name: 'SOUMYADEEP  ROY' },
      { email: '21052299@kiit.ac.in', name: 'ABHISHEK  PANDA' },
      { email: '21052322@kiit.ac.in', name: 'DHRUV KANT GUPTA' },
      { email: '21052376@kiit.ac.in', name: 'VAISHNAVI  SINGH' },
      { email: '21052461@kiit.ac.in', name: 'TUSHAR  ANAND' },
      { email: '21052516@kiit.ac.in', name: 'PRATYUSH  RATH' },
      { email: '21052608@kiit.ac.in', name: 'RISHI  SINGH' },
      { email: '21052613@kiit.ac.in', name: 'SAMYANTAK  MUKHERJEE' },
      { email: '21052617@kiit.ac.in', name: 'SAYANGSHREE  PANDA' },
      { email: '21052666@kiit.ac.in', name: 'HIMANSHU SEKHAR NAYAK' },
      { email: '21052667@kiit.ac.in', name: 'HRISHABH  KHANDELWAL' },
      { email: '21052673@kiit.ac.in', name: 'LAGNAJEET  MOHANTY' },
      { email: '21052675@kiit.ac.in', name: 'MOHAMMAD  RUMAN' },
      { email: '21052677@kiit.ac.in', name: 'MOHNISH  MISHRA' },
      { email: '21052679@kiit.ac.in', name: 'NANDINEE  AANAND' },
      { email: '21052682@kiit.ac.in', name: 'PRATHAM PRASHANT TAPDIYA' },
      { email: '21052695@kiit.ac.in', name: 'RITIK KUMAR SAHOO' },
      { email: '21052718@kiit.ac.in', name: 'SWETAPADMA  SINGH' },
      { email: '21052740@kiit.ac.in', name: 'AMAN  ARPIT' },
      { email: '21052754@kiit.ac.in', name: 'DHAIRYA  AGARWAL' },
      { email: '21052766@kiit.ac.in', name: 'KUSH' },
      { email: '21052844@kiit.ac.in', name: 'MOHAN  AGRAWALLA' },
      { email: '21052921@kiit.ac.in', name: 'SIMAAK  KHAN' },
      { email: '21052934@kiit.ac.in', name: 'AJAY KUMAR KASAUDHAN BANIYA' },
      { email: '21052937@kiit.ac.in', name: 'ARPAN  KHADKA' },
      { email: '21052940@kiit.ac.in', name: 'BIPIN  GHIMIRE' },
      { email: '21052950@kiit.ac.in', name: 'SHIVAM  TRIPATHI' },
      { email: '21052955@kiit.ac.in', name: 'SUYOG  ACHARYA' },
      { email: '21052959@kiit.ac.in', name: 'UNIK  DAHAL' },
      { email: '21052960@kiit.ac.in', name: 'YISHAP  KHANAL' },
      { email: '21053264@kiit.ac.in', name: 'AJAY KHATRI CHHETRI' },
      { email: '21053274@kiit.ac.in', name: 'BIDUR  JHA' },
      { email: '21053286@kiit.ac.in', name: 'KSHITIZ  MAHATO' },
      { email: '21053300@kiit.ac.in', name: 'NITESH KUMAR MANDAL' },
      { email: '21053302@kiit.ac.in', name: 'OM PRAKASH PODDAR DEV' },
      { email: '21053304@kiit.ac.in', name: 'PRANAY   SHAH' },
      { email: '21053305@kiit.ac.in', name: 'PRASHANT  REGMI' },
      { email: '21053324@kiit.ac.in', name: 'SHUBHAM  KC' },
      { email: '21053371@kiit.ac.in', name: 'NEKHIL KUMAR AGARWAL' },
      { email: '21053398@kiit.ac.in', name: 'RISHAV  JHA' },
      { email: '21053404@kiit.ac.in', name: 'AADITYA  DAHAL' },
      { email: '21053406@kiit.ac.in', name: 'SAURAV SHARMA WAGLE' },
      { email: '21053443@kiit.ac.in', name: 'SUMAN  SHARMA' },
      { email: '21053457@kiit.ac.in', name: 'TUSHAR  KARNA' },
      { email: '2105092@kiit.ac.in', name: 'ADITYA  ARYAN' },
      { email: '2105163@kiit.ac.in', name: 'SNEHIL' },
      { email: '2105165@kiit.ac.in', name: 'SURAJ  DEY' },
      { email: '2105289@kiit.ac.in', name: 'NIPUN  ASWAL' },
      { email: '2105422@kiit.ac.in', name: 'VIPUL  GUPTA' },
      { email: '2105427@kiit.ac.in', name: 'AAYUSH  DAHIYA' },
      { email: '2105462@kiit.ac.in', name: 'GOURAV VARDHAN PANIGRAHI' },
      { email: '2105499@kiit.ac.in', name: 'SIDHYANT KUMAR SINGH' },
      { email: '2105560@kiit.ac.in', name: 'OMPRAKASH' },
      { email: '2105573@kiit.ac.in', name: 'SHIVANI  KUMARI' },
      { email: '2105590@kiit.ac.in', name: 'UDHAY KUMAR GANDHAMSETTY' },
      { email: '2105600@kiit.ac.in', name: 'ADITYA  RAJ' },
      { email: '2105612@kiit.ac.in', name: 'AYUSH  BEHERA' },
      { email: '2105643@kiit.ac.in', name: 'PRIYANSHU  KUMAR' },
      { email: '2105658@kiit.ac.in', name: 'SAPTARSHI  SAMANTA' },
      { email: '2105848@kiit.ac.in', name: 'VIVESH  SINGH' },
      { email: '2105868@kiit.ac.in', name: 'ARYAK  MOHANTY' },
      { email: '2105952@kiit.ac.in', name: 'ARYAN KAUSHIK VORA' },
      { email: '2105998@kiit.ac.in', name: 'SASANAPURI  MANIRAJA' },
      { email: '2106050@kiit.ac.in', name: 'RAUNAK  SINGH' },
      { email: '2106071@kiit.ac.in', name: 'SHUBHOJIT  HAZRA' },
      { email: '2106262@kiit.ac.in', name: 'SOURAV  GUHARAY' },
      { email: '2106288@kiit.ac.in', name: 'Urias Kermue' },
      { email: '2128093@kiit.ac.in', name: 'SOUMYADEEP  PAL' },
      { email: '2129006@kiit.ac.in', name: 'ABHISHEK  SENGUPTA' },
      { email: '2129009@kiit.ac.in', name: 'ADITYA  PARIDA' },
      { email: '2129017@kiit.ac.in', name: 'AKASH DEEP ROY' },
      { email: '2129018@kiit.ac.in', name: 'AKSHAY  HIMATSINGKA' },
      { email: '2129025@kiit.ac.in', name: 'JANNAV  DUTTA' },
      { email: '2129038@kiit.ac.in', name: 'SUBHAM  NANDI' },
      { email: '2129055@kiit.ac.in', name: 'ARNAV  SAGAR' },
      { email: '2129058@kiit.ac.in', name: 'ARUNABH  ANAND' },
      { email: '2129065@kiit.ac.in', name: 'BINOY KRISHNA DEBNATH' },
      { email: '2129156@kiit.ac.in', name: 'ABHISHEK KUMAR YADAV' },
      { email: '21051009@kiit.ac.in', name: 'SHREYANSH  SINGH' },
      { email: '21051463@kiit.ac.in', name: 'ANSH  PATHAK' },
      { email: '21051650@kiit.ac.in', name: 'GOWTHAM  DAS' },
      { email: '21051657@kiit.ac.in', name: 'KUSHAGRA  SINGH' },
      { email: '21051659@kiit.ac.in', name: 'MANISH  KUMAR' },
      { email: '21051661@kiit.ac.in', name: 'MOHAMMED  AQUIB' },
      { email: '21051673@kiit.ac.in', name: 'PRIYANSHU KUMAR SINHA' },
      { email: '21051680@kiit.ac.in', name: 'SAYANDEEP  DEY' },
      { email: '21051684@kiit.ac.in', name: 'SHIVAM  KUMAR' },
      { email: '21051798@kiit.ac.in', name: 'ANUKRITY  GUPTA' },
      { email: '21051806@kiit.ac.in', name: 'B VINAY KUMAR' },
      { email: '21051832@kiit.ac.in', name: 'PIYUSH' },
      { email: '21051882@kiit.ac.in', name: 'SIMRAN  DALMIA' },
      { email: '21051900@kiit.ac.in', name: 'KHUSHAL  JENA' },
      { email: '21052018@kiit.ac.in', name: 'RITESH  KADU' },
      { email: '21052048@kiit.ac.in', name: 'AKASH  SINGH' },
      { email: '21052125@kiit.ac.in', name: 'W NIHITH' },
      { email: '21052127@kiit.ac.in', name: 'ABHINAV  ADITYA' },
      { email: '21052164@kiit.ac.in', name: 'NIHAR RANJAN BISWAL' },
      { email: '21052232@kiit.ac.in', name: 'ANSHUMAN  SATAPATHY' },
      { email: '21052432@kiit.ac.in', name: 'LUCKY  MAHANTA' },
      { email: '21052642@kiit.ac.in', name: 'ADITYA NARAIN SINGH' },
      { email: '21052650@kiit.ac.in', name: 'ANISH MATHEW JOSE' },
      { email: '21052730@kiit.ac.in', name: 'AKASHDIP  SAHA' },
      { email: '21052912@kiit.ac.in', name: 'PEELA  CHARAN' },
      { email: '21052986@kiit.ac.in', name: 'SWAYAM  SRIVASTAVA' },
      { email: '21053294@kiit.ac.in', name: 'METHU   PAROI' },
      { email: '21053320@kiit.ac.in', name: 'SAURAV  DEVKOTA' },
      { email: '21053328@kiit.ac.in', name: 'SORUP  CHAKRABORTY' },
      { email: '21053456@kiit.ac.in', name: 'SOUROV ROY  SHUVO' },
      { email: '22057001@kiit.ac.in', name: 'ABHIJEET KUMAR' },
      { email: '22057004@kiit.ac.in', name: 'ADITYA SANKAR MISHRA' },
      { email: '22057047@kiit.ac.in', name: 'PRITAM KUMAR NAYAK' },
      { email: '2105091@kiit.ac.in', name: 'ADITI  PANDEY' },
      { email: '2105262@kiit.ac.in', name: 'ANISHA  RAJ' },
      { email: '2105272@kiit.ac.in', name: 'DEBANANDAN  PRADHAN' },
      { email: '2105279@kiit.ac.in', name: 'KOLLA GAYATRI SHRUTI' },
      { email: '2105339@kiit.ac.in', name: 'VINNAMALA SAI SUJITH' },
      { email: '2105407@kiit.ac.in', name: 'SHRESTHA  GHOSHAL' },
      { email: '2105469@kiit.ac.in', name: 'NAKSHATRA  GUPTA' },
      { email: '2105474@kiit.ac.in', name: 'PRACHI  RAJ' },
      { email: '2105529@kiit.ac.in', name: 'ARNAV  SUBUDHI' },
      { email: '2105566@kiit.ac.in', name: 'RIDDHI  GHOSH' },
      { email: '2105621@kiit.ac.in', name: 'DIVYANSHI  TIWARY' },
      { email: '2105886@kiit.ac.in', name: 'HARDIK  AGRAHARI' },
      { email: '2105914@kiit.ac.in', name: 'SAKSHI  SHREYA' },
      { email: '2106131@kiit.ac.in', name: 'PRACHI  PRAKASH' },
      { email: '2106172@kiit.ac.in', name: 'ABHILASH A SHASINI' },
      { email: '2106257@kiit.ac.in', name: 'SOHINI  CHANDA' },
      { email: '21051109@kiit.ac.in', name: 'ABINASH  SAMAL' },
      { email: '21051168@kiit.ac.in', name: 'SASHWIN  NIRANJAN' },
      { email: '21051195@kiit.ac.in', name: 'AKANKSHA  RATH' },
      { email: '21051197@kiit.ac.in', name: 'AKARSH  VERMA' },
      { email: '21051210@kiit.ac.in', name: 'AVINASH  PANDEY' },
      { email: '21051213@kiit.ac.in', name: 'AYUSH  KUMAR' },
      { email: '21051214@kiit.ac.in', name: 'BAHNIKANA  BISWAS' },
      { email: '21051215@kiit.ac.in', name: 'DEBAPRIYA  JHA' },
      { email: '21051260@kiit.ac.in', name: 'ABHINEET  YADAV' },
      { email: '21051318@kiit.ac.in', name: 'PRATIKSHA  DUBEY' },
      { email: '21051396@kiit.ac.in', name: 'HARSH  SINGH' },
      { email: '21051408@kiit.ac.in', name: 'MRINALINI  BHATTACHARJEE' },
      { email: '21051555@kiit.ac.in', name: 'BANTI KUMAR MANDAL' },
      { email: '21051611@kiit.ac.in', name: 'SITANSHU RANJAN TRIPATHY' },
      { email: '21051614@kiit.ac.in', name: 'AYUSH  BACHAN' },
      { email: '21051618@kiit.ac.in', name: 'AASTHA  CHITLANGIA' },
      { email: '21051833@kiit.ac.in', name: 'PRANABIT  PRADHAN' },
      { email: '21051859@kiit.ac.in', name: 'SWAPNIL  SHARMA' },
      { email: '21051886@kiit.ac.in', name: 'AYUSH  DEWANGAN' },
      { email: '21051894@kiit.ac.in', name: 'HARSHIT  SHUKLA' },
      { email: '21051969@kiit.ac.in', name: 'ANIMESH  OJHA' },
      { email: '21052159@kiit.ac.in', name: 'JOYDEEP  SAHA' },
      { email: '21052266@kiit.ac.in', name: 'PRIYANSHU' },
      { email: '21052288@kiit.ac.in', name: 'SUBARNA  SUTRADHAR' },
      { email: '21052336@kiit.ac.in', name: 'NAINCY' },
      { email: '21052372@kiit.ac.in', name: 'SUSHANT KUMAR BHADRA' },
      { email: '21052387@kiit.ac.in', name: 'AKASH RAMLALIT CHAUDHARI' },
      { email: '21052397@kiit.ac.in', name: 'ANUBHAB  BHAUMIK' },
      { email: '21052431@kiit.ac.in', name: 'KUMAR  ABHISHEK' },
      { email: '21052433@kiit.ac.in', name: 'MANAS  BARIYAR' },
      { email: '21052453@kiit.ac.in', name: 'SHIVAM KUMAR PANDEY' },
      { email: '21052454@kiit.ac.in', name: 'SOUMYA RANJAN SAMAL' },
      { email: '21052523@kiit.ac.in', name: 'ROHIT  CHANDRA' },
      { email: '21052732@kiit.ac.in', name: 'AMULYA  JAISWAL' },
      { email: '21052736@kiit.ac.in', name: 'ANSH  ARYAN' },
      { email: '21052752@kiit.ac.in', name: 'DEEPAK KUMAR SINGH' },
      { email: '21052755@kiit.ac.in', name: 'DHANJEE  TIWARI' },
      { email: '21052763@kiit.ac.in', name: 'KESHAV  JHA' },
      { email: '21052773@kiit.ac.in', name: 'NITIN  RAJ' },
      { email: '21052775@kiit.ac.in', name: 'OM  PATEL' },
      { email: '21052787@kiit.ac.in', name: 'SANSKAR  KUMAR' },
      { email: '21052815@kiit.ac.in', name: 'ARADHANA' },
      { email: '21052855@kiit.ac.in', name: 'PRITAM  SASMAL' },
      { email: '21052993@kiit.ac.in', name: 'ANURAG  SWAIN' },
      { email: '21053215@kiit.ac.in', name: 'PRACHI  SINHA' },
      { email: '21053225@kiit.ac.in', name: 'YASH  VARDHAN' },
      { email: '21053281@kiit.ac.in', name: 'FARIYA   AFRIN' },
      { email: '2105017@kiit.ac.in', name: 'ARGHADEEP  SAHA' },
      { email: '2105249@kiit.ac.in', name: 'SUBHAM  SUDEEPTA' },
      { email: '2105457@kiit.ac.in', name: 'FIONA  DASH' },
      { email: '2105488@kiit.ac.in', name: 'SARANSH  KUMAR' },
      { email: '2105489@kiit.ac.in', name: 'SAUMYADEEP  BANIK' },
      { email: '2105657@kiit.ac.in', name: 'SAMRUDDHI PRAFULLA LANDE' },
      { email: '2105691@kiit.ac.in', name: 'AMRITANSH JAI SINGH' },
      { email: '2105692@kiit.ac.in', name: 'ANANT  TRIPATHI' },
      { email: '2105718@kiit.ac.in', name: 'HARSHITA OLIVE AROHAN' },
      { email: '2105733@kiit.ac.in', name: 'RISHAV  PANDEY' },
      { email: '2105734@kiit.ac.in', name: 'RISHIKESH' },
      { email: '2105745@kiit.ac.in', name: 'SATYABRAT  SAHOO' },
      { email: '2105746@kiit.ac.in', name: "SAURABH '" },
      { email: '2105759@kiit.ac.in', name: 'SUVANKAR  DASH' },
      { email: '2105764@kiit.ac.in', name: 'VAISHNAVI  RANI' },
      { email: '2105850@kiit.ac.in', name: 'YUGAL  MISHRA' },
      { email: '2105859@kiit.ac.in', name: 'ANANT  GUPTA' },
      { email: '2105867@kiit.ac.in', name: 'ARNAV  AMITABH' },
      { email: '2105938@kiit.ac.in', name: 'VIREN  MAHAWAR' },
      { email: '2105942@kiit.ac.in', name: 'ADITYA  KHANDELWAL' },
      { email: '2105967@kiit.ac.in', name: 'ISHITA  MUKHERJEE' },
      { email: '2106146@kiit.ac.in', name: 'SAGNIK  DEY' },
      { email: '2106154@kiit.ac.in', name: 'SHREYAS  SRIVASTAVA' },
      { email: '2106234@kiit.ac.in', name: 'PRIYADARSHINI  BASU' },
      { email: '2106292@kiit.ac.in', name: 'TARANG  SULTANIA' },
      { email: '2106295@kiit.ac.in', name: 'ANIKET  VERMA' },
      { email: '2106308@kiit.ac.in', name: 'ABHINAV' },
      { email: '2106316@kiit.ac.in', name: 'NYASIJIN KUOL  MATHIANG' },
      { email: '2128030@kiit.ac.in', name: 'NAYNIKA  SARKAR' },
      { email: '21051007@kiit.ac.in', name: 'SHREYAM  HEMANTA' },
      { email: '21051030@kiit.ac.in', name: 'ANAM DEV ROY' },
      { email: '21051062@kiit.ac.in', name: 'MANI SHANKAR SWARAJ' },
      { email: '21051132@kiit.ac.in', name: 'ESHAAN  BAHL' },
      { email: '21051166@kiit.ac.in', name: 'SARVAGYA' },
      { email: '21051297@kiit.ac.in', name: 'AVNEESH  DUBEY' },
      { email: '21051311@kiit.ac.in', name: 'HARSHIT  SINGH' },
      { email: '21051331@kiit.ac.in', name: 'RITWIK DEV SINGH' },
      { email: '21051377@kiit.ac.in', name: 'ANSHUMAN  RATH' },
      { email: '21051380@kiit.ac.in', name: 'ARCHISHMAN  BISWAS' },
      { email: '21051507@kiit.ac.in', name: 'SAMAYITA  BEPARI' },
      { email: '21051511@kiit.ac.in', name: 'SAUMYA RANJAN JENA' },
      { email: '21051643@kiit.ac.in', name: 'BHASKAR  MISHRA' },
      { email: '21051690@kiit.ac.in', name: 'SOHAM  SANYAL' },
      { email: '21051734@kiit.ac.in', name: 'HARSHITA  LAAD' },
      { email: '21051735@kiit.ac.in', name: 'ANKIT  KUMAR' },
      { email: '21051736@kiit.ac.in', name: 'KATYAYANI  VERMA' },
      { email: '21051747@kiit.ac.in', name: 'NIMISHA  GHOSH' },
      { email: '21051779@kiit.ac.in', name: 'TUSHAR  DHANRAJ' },
      { email: '21051800@kiit.ac.in', name: 'ARCHISHMAN  BHAUMIK' },
      { email: '21051868@kiit.ac.in', name: 'VISHAL  MONDAL' },
      { email: '21051876@kiit.ac.in', name: 'AKSHAT  BANTHIYA' },
      { email: '21051881@kiit.ac.in', name: 'ARITRA  PAL' },
      { email: '21051884@kiit.ac.in', name: 'ASHUTOSH  DAS' },
      { email: '21051899@kiit.ac.in', name: 'K SMARAN SAI' },
      { email: '21052051@kiit.ac.in', name: 'ANIRUDH  SHARMA' },
      { email: '21052063@kiit.ac.in', name: 'AVISHIKTA  MAJUMDER' },
      { email: '21052290@kiit.ac.in', name: 'SWARAJ  BASU' },
      { email: '21052460@kiit.ac.in', name: 'T SAI  SUVARNA' },
      { email: '21052477@kiit.ac.in', name: 'ANKIT  RAJ' },
      { email: '21052478@kiit.ac.in', name: 'ANKITA  ACHARYA' },
      { email: '21052555@kiit.ac.in', name: 'ADITYA  JHA' },
      { email: '21052562@kiit.ac.in', name: 'AMRIT  AGRAWAL' },
      { email: '21052592@kiit.ac.in', name: 'ITISH  SRIVASTAVA' },
      { email: '21052614@kiit.ac.in', name: 'SANKARANA TEJA RAJU' },
      { email: '21052681@kiit.ac.in', name: 'PATHIKRITH  SARKAR' },
      { email: '21052706@kiit.ac.in', name: 'SHREEMAA  SENAPATI' },
      { email: '21052760@kiit.ac.in', name: 'GUNUPATI THIRUMALA REDDY' },
      { email: '21052839@kiit.ac.in', name: 'DIVYANSH  AGARWAL' },
      { email: '21052849@kiit.ac.in', name: 'OMM SHREE MOHANTY' },
      { email: '21052931@kiit.ac.in', name: 'VARANYA  DWIVEDI' },
      { email: '21053259@kiit.ac.in', name: 'ABDULLA AL  MUHIT' },
      { email: '2105021@kiit.ac.in', name: 'ARYAN  DEO' },
      { email: '2105022@kiit.ac.in', name: 'ARYAN  LOHAR' },
      { email: '2105054@kiit.ac.in', name: 'RAVI  SHANKAR' },
      { email: '2105159@kiit.ac.in', name: 'SHREETI  GOSWAMI' },
      { email: '2105190@kiit.ac.in', name: 'CHIRAG  AGARWAL' },
      { email: '2105214@kiit.ac.in', name: 'VAIDEHI  GUPTA' },
      { email: '2105227@kiit.ac.in', name: 'ROHAN KUMAR NARAYAN' },
      { email: '2105242@kiit.ac.in', name: 'SHRUTI  SINGH' },
      { email: '2105255@kiit.ac.in', name: 'YASHWANT  SINGH' },
      { email: '2105292@kiit.ac.in', name: 'PRATYASHA  NANDA' },
      { email: '2105294@kiit.ac.in', name: 'PRIYANSHU  RAJ' },
      { email: '2105351@kiit.ac.in', name: 'AMAN  RAJ' },
      { email: '2105481@kiit.ac.in', name: 'RUDRANSH  BHARADWAJ' },
      { email: '2105524@kiit.ac.in', name: 'ANJALI  BALI' },
      { email: '2105655@kiit.ac.in', name: 'SAMBIT  BHATTACHARJEE' },
      { email: '2105768@kiit.ac.in', name: 'AMLAN RANJAN GOGOI' },
      { email: '2105946@kiit.ac.in', name: 'AMITANSH  CHATURVEDI' },
      { email: '2105969@kiit.ac.in', name: 'KRISHNA MOHAN SHUKLA' },
      { email: '2105990@kiit.ac.in', name: 'RITUSOME  DAS' },
      { email: '2105999@kiit.ac.in', name: 'SAUMYA  MISHRA' },
      { email: '2106205@kiit.ac.in', name: 'D SIDHANT PATRO' },
      { email: '2106212@kiit.ac.in', name: 'HAIMANTI  CHOWDHURY' },
      { email: '2106244@kiit.ac.in', name: 'ROUMODIP  CHATTERJEE' },
      { email: '2106252@kiit.ac.in', name: 'SHASWAT  SINHA' },
      { email: '2129013@kiit.ac.in', name: 'ADWAITH  P J' },
      { email: '21051042@kiit.ac.in', name: 'ATISHAY  TRIPATHI' },
      { email: '21051157@kiit.ac.in', name: 'PUSHPENDRA  VERMA' },
      { email: '21051176@kiit.ac.in', name: 'SHUBHADEEP  SEN' },
      { email: '21051185@kiit.ac.in', name: 'SWAPNIL KETAN ASHAR' },
      { email: '21051208@kiit.ac.in', name: 'ARKAPRABHA  BANERJEE' },
      { email: '21051211@kiit.ac.in', name: 'AYON  MONDAL' },
      { email: '21051245@kiit.ac.in', name: 'SANDIP  ROY' },
      { email: '21051344@kiit.ac.in', name: 'SOMNATH  SAMAL' },
      { email: '21051392@kiit.ac.in', name: 'CHINMAY  JAIN' },
      { email: '21051426@kiit.ac.in', name: 'SHIRSHA  CHAKRABORTY' },
      { email: '21051533@kiit.ac.in', name: 'ABHISHEK  BARNWAL' },
      { email: '21051624@kiit.ac.in', name: 'AKASH  KUMAR' },
      { email: '21051966@kiit.ac.in', name: 'AMLANDEEP  PRAHARAJ' },
      { email: '21051988@kiit.ac.in', name: 'CHHAVI  SOIN' },
      { email: '21052000@kiit.ac.in', name: 'KETAN CHAUHAN' },
      { email: '21052082@kiit.ac.in', name: 'MUKUL  MISRA' },
      { email: '21052089@kiit.ac.in', name: 'PRATHAM  HALDER' },
      { email: '21052178@kiit.ac.in', name: 'ANSHUL  VERMA' },
      { email: '21052272@kiit.ac.in', name: 'RUDRA SHEKHAR BASAK' },
      { email: '21052274@kiit.ac.in', name: 'SAMRIDDHI  SHARMA' },
      { email: '21052305@kiit.ac.in', name: 'ANAND  PANDA' },
      { email: '21052344@kiit.ac.in', name: 'PRIYANSHU  MIDHA' },
      { email: '21052350@kiit.ac.in', name: 'ROHAN KUMAR SHARMA' },
      { email: '21052413@kiit.ac.in', name: 'DEBANSHU  PARIDA' },
      { email: '21052422@kiit.ac.in', name: 'JATIN  PATHAK' },
      { email: '21052423@kiit.ac.in', name: 'JPS  SAAHIL' },
      { email: '21052465@kiit.ac.in', name: 'YASH PRATAP SINGH' },
      { email: '21052466@kiit.ac.in', name: 'AAKANKSHA  KASHAYAP' },
      { email: '21052482@kiit.ac.in', name: 'ANWESHA  SAHOO' },
      { email: '21052561@kiit.ac.in', name: 'BORA DHRUV SINGH DANSINGH' },
      { email: '21052606@kiit.ac.in', name: 'RAJ  ROUSHAN' },
      { email: '21052625@kiit.ac.in', name: 'SUBHRANKITA  DIXIT' },
      { email: '21052643@kiit.ac.in', name: 'ADITYA SHANKAR PANDEY' },
      { email: '21052791@kiit.ac.in', name: 'SAKSHI  KUMARI' },
      { email: '21052897@kiit.ac.in', name: 'ANKIT  HATI' },
      { email: '21052983@kiit.ac.in', name: 'VASU  AGARWAL' },
      { email: '21053452@kiit.ac.in', name: 'AKASH  SAHA' },
      { email: '2105173@kiit.ac.in', name: 'ABHISHEK  MALLICK' },
      { email: '2105218@kiit.ac.in', name: 'PRATIK KUMAR SAHU' },
      { email: '2105235@kiit.ac.in', name: 'SANYA  SINGH' },
      { email: '2105463@kiit.ac.in', name: 'JAHANVI  SINGH' },
      { email: '2105484@kiit.ac.in', name: 'SAKSHI  KUMARI' },
      { email: '2105518@kiit.ac.in', name: 'ADITYA  MISHRA' },
      { email: '2105635@kiit.ac.in', name: 'PRADYUMNNA  BANERJEE' },
      { email: '2105689@kiit.ac.in', name: 'AMARJEET  GHOSH' },
      { email: '2105731@kiit.ac.in', name: 'RAHUL  KUMAR' },
      { email: '2105737@kiit.ac.in', name: 'RITUPARNA  BANIK' },
      { email: '2105749@kiit.ac.in', name: 'SHIVAM  KUMAR' },
      { email: '2105751@kiit.ac.in', name: 'SHUBHAM' },
      { email: '2105752@kiit.ac.in', name: 'SIMRAN  RAI' },
      { email: '2105860@kiit.ac.in', name: 'ANANYA  CHOUDHARY' },
      { email: '2105980@kiit.ac.in', name: 'PRASANNA  SAHOO' },
      { email: '2106035@kiit.ac.in', name: 'KUSHAL  CHAND' },
      { email: '2106096@kiit.ac.in', name: 'ANTARIN  GHOSAL' },
      { email: '2106144@kiit.ac.in', name: 'RAJARSHI  SANDILYA' },
      { email: '2106147@kiit.ac.in', name: 'SAHIL  EDISON' },
      { email: '2106158@kiit.ac.in', name: 'SIDDHARTH  BORMAN' },
      { email: '2106209@kiit.ac.in', name: 'ESHIKA  DAS' },
      { email: '2128073@kiit.ac.in', name: 'HARSH' },
      { email: '2128074@kiit.ac.in', name: 'HEMANG  MITRA' },
      { email: '2128089@kiit.ac.in', name: 'SK ASIF HOSSAIN' },
      { email: '2128094@kiit.ac.in', name: 'SOURAV  GOEL' },
      { email: '2128096@kiit.ac.in', name: 'SRIJANEE  KAUNDA' },
      { email: '2129011@kiit.ac.in', name: 'ADITYA NARAYANA CHOUDHURY' },
      { email: '2129036@kiit.ac.in', name: 'SOHAM  BASURI' },
      { email: '21051130@kiit.ac.in', name: 'DIKHYA  KAR' },
      { email: '21051230@kiit.ac.in', name: 'OMKAR  MISHRA' },
      { email: '21051242@kiit.ac.in', name: 'RUDRA NARAYAN PRADHAN' },
      { email: '21051249@kiit.ac.in', name: 'SAPRIT  ANAND' },
      { email: '21051281@kiit.ac.in', name: 'AMITANSHU  PADHEE' },
      { email: '21051286@kiit.ac.in', name: 'ANUJIT  RAJ' },
      { email: '21051336@kiit.ac.in', name: 'SHASHWAT  KUMAR' },
      { email: '21051450@kiit.ac.in', name: 'ADHINAYAK SATABDI SAMANTRAJ' },
      { email: '21051475@kiit.ac.in', name: 'EASHAN  MAHARATHI' },
      { email: '21051576@kiit.ac.in', name: 'MADHURIMA  AICH' },
      { email: '21051638@kiit.ac.in', name: 'ARYA  JHA' },
      { email: '21051766@kiit.ac.in', name: 'SHREYASH  KUMAR' },
      { email: '21051767@kiit.ac.in', name: 'SHUBHAM KUMAR SINGH' },
      { email: '21051773@kiit.ac.in', name: 'SUSHANT  SHUBHAM' },
      { email: '21051792@kiit.ac.in', name: 'ADITYA VIKRAM KIRTANIA' },
      { email: '21052037@kiit.ac.in', name: 'SWASTIK  DAS' },
      { email: '21052097@kiit.ac.in', name: 'SAKSHI  PRIYA' },
      { email: '21052122@kiit.ac.in', name: 'VAIBHAV  RAO' },
      { email: '21052225@kiit.ac.in', name: 'ANANYA  THAKUR' },
      { email: '21052428@kiit.ac.in', name: 'KHUSHI' },
      { email: '21052446@kiit.ac.in', name: 'SAHIL  SAHANI' },
      { email: '21052724@kiit.ac.in', name: 'ABHIJEET KUMAR GIRI' },
      { email: '21052771@kiit.ac.in', name: 'NATASHA  SETH' },
      { email: '21052776@kiit.ac.in', name: 'OMM  DAS' },
      { email: '21052794@kiit.ac.in', name: 'SHUBHANGI KUMARI SHARMA' },
      { email: '21052812@kiit.ac.in', name: 'ANSHUM  TRIPATHI' },
      { email: '21052890@kiit.ac.in', name: 'VEDANT  VERMA' },
      { email: '21052896@kiit.ac.in', name: 'ANIMESH KUMAR YADAV' },
      { email: '21052984@kiit.ac.in', name: 'ROHIT  KUMAR' },
      { email: '21053276@kiit.ac.in', name: 'BIKSHIT KUMAR GUPTA' },
      { email: '21053401@kiit.ac.in', name: 'ABHI  UPADHYAY' },
      { email: '21053444@kiit.ac.in', name: 'ABHISHEK KUMAR SINGH' },
      { email: '2105026@kiit.ac.in', name: 'D VEDANT' },
      { email: '2105031@kiit.ac.in', name: 'HARSH SARAN' },
      { email: '2105065@kiit.ac.in', name: 'SAURAV  KUMAR' },
      { email: '2105073@kiit.ac.in', name: 'SRITAM  DUTTA' },
      { email: '2105085@kiit.ac.in', name: 'RAJEEV  KUMAR' },
      { email: '2105110@kiit.ac.in', name: 'ARYAN' },
      { email: '2105156@kiit.ac.in', name: 'SHAIVYA  SHASHWAT' },
      { email: '2105205@kiit.ac.in', name: 'KUMAR  HARSH' },
      { email: '2105256@kiit.ac.in', name: 'ABHIGYAN KUMAR PANDEY' },
      { email: '2105365@kiit.ac.in', name: 'DEBASISH  DAS' },
      { email: '2105440@kiit.ac.in', name: 'AMRIT  RAJ' },
      { email: '2105458@kiit.ac.in', name: 'GARGI  CHOWDHURY' },
      { email: '2105534@kiit.ac.in', name: 'AYUSH  BISWAL' },
      { email: '2105605@kiit.ac.in', name: 'SATYAM  TIWARY' },
      { email: '2105668@kiit.ac.in', name: 'SMRUTI  MOHANTY' },
      { email: '2105844@kiit.ac.in', name: 'TANYA  SINGH' },
      { email: '2105878@kiit.ac.in', name: 'BIBHUDUTTA  SWAIN' },
      { email: '2105881@kiit.ac.in', name: 'BURIDI BHANU PRASANTH' },
      { email: '2106045@kiit.ac.in', name: 'PRITAM  MANDAL' },
      { email: '2106077@kiit.ac.in', name: 'TANIYA  DE' },
      { email: '2106285@kiit.ac.in', name: 'KIDUS ABEBE MEKONEN' },
      { email: '2106303@kiit.ac.in', name: 'SHASHANK  GUPTA' },
      { email: '2128042@kiit.ac.in', name: 'RIMJHIM' },
      { email: '2128063@kiit.ac.in', name: 'AMANATA  NAYAK' },
      { email: '2128077@kiit.ac.in', name: 'LAVANYA  UPADHYAY' },
      { email: '21051037@kiit.ac.in', name: 'ARHAAN  RAJ' },
      { email: '21051081@kiit.ac.in', name: 'SABYASACHIN  BISWAL' },
      { email: '21051083@kiit.ac.in', name: 'SARTHAK  RAY' },
      { email: '21051224@kiit.ac.in', name: 'KUMAR  SNEHDEEP' },
      { email: '21051236@kiit.ac.in', name: 'AMIT  PRAKASH' },
      { email: '21051237@kiit.ac.in', name: 'RAJARSHI  DEY' },
      { email: '21051253@kiit.ac.in', name: 'SAYEED  ANWAR' },
      { email: '21051255@kiit.ac.in', name: 'SHIVAM  KUMAR' },
      { email: '21051549@kiit.ac.in', name: 'ARUNOPAL  DUTTA' },
      { email: '21051553@kiit.ac.in', name: 'AYUSHMAN  TRIPATHI' },
      { email: '21051567@kiit.ac.in', name: 'INDRANIL  NAG' },
      { email: '21051664@kiit.ac.in', name: 'NIHARIKA  PANT' },
      { email: '21051698@kiit.ac.in', name: 'VATSAL  SAXENA' },
      { email: '21051880@kiit.ac.in', name: 'ANIRBAN  BASAK' },
      { email: '21051887@kiit.ac.in', name: 'DEBANJAN  GHOSH' },
      { email: '21051891@kiit.ac.in', name: 'DHRUV  NEHRU' },
      { email: '21051908@kiit.ac.in', name: 'MOHAMMAD  HAMZA' },
      { email: '21051947@kiit.ac.in', name: 'SWADESH  MAHAPATRA' },
      { email: '21052056@kiit.ac.in', name: 'SK  REAJ' },
      { email: '21052220@kiit.ac.in', name: 'ADITYA PRATAP SINGH' },
      { email: '21052238@kiit.ac.in', name: 'RIYA  RAJ' },
      { email: '21052244@kiit.ac.in', name: 'BIBEK RANJAN SAHOO' },
      { email: '21052380@kiit.ac.in', name: 'YUVRAJ  SINGH' },
      { email: '21052393@kiit.ac.in', name: 'ANIMESH  SINGH' },
      { email: '21052395@kiit.ac.in', name: 'ANKIT  RAJ' },
      { email: '21052405@kiit.ac.in', name: 'ASHWINI KUMAR SINGH' },
      { email: '21052449@kiit.ac.in', name: 'SANSKAR  GARG' },
      { email: '21052508@kiit.ac.in', name: 'MUDIT  YADAV' },
      { email: '21052574@kiit.ac.in', name: 'ASMIT  SAHU' },
      { email: '21052723@kiit.ac.in', name: 'AASHISH  SAHU' },
      { email: '21053229@kiit.ac.in', name: 'ADWAITA BASU BAL' },
      { email: '21053250@kiit.ac.in', name: 'ADARSH  MISHRA' },
      { email: '21053387@kiit.ac.in', name: 'YOGESH KUMAR SAH' },
      { email: '21053399@kiit.ac.in', name: 'SHIV  PAL' },
      { email: '21053445@kiit.ac.in', name: 'ROHAN KUMAR SAH' },
      { email: '2105076@kiit.ac.in', name: 'SWAYAM  SWAROOP' },
      { email: '2105081@kiit.ac.in', name: 'VAVILAPALLI  GREESHMITHA' },
      { email: '2105206@kiit.ac.in', name: 'KUSH PINAKIN PATEL' },
      { email: '2105247@kiit.ac.in', name: 'SOVAN  PATTANAIK' },
      { email: '2105291@kiit.ac.in', name: 'PRASOON  MODI' },
      { email: '2105341@kiit.ac.in', name: 'AADITYA  CHOWDHURY' },
      { email: '2105399@kiit.ac.in', name: 'RITESH  PATRO' },
      { email: '2105415@kiit.ac.in', name: 'SUDIPTA  GANGULY' },
      { email: '2105579@kiit.ac.in', name: 'SHASHWAT KUMAR BEHERA' },
      { email: '2105646@kiit.ac.in', name: 'RANA SHIVANG SINGH' },
      { email: '2105667@kiit.ac.in', name: 'SHUBHAM KUMAR SAHOO' },
      { email: '2105717@kiit.ac.in', name: 'GEETANSH  SHARMA' },
      { email: '2105726@kiit.ac.in', name: 'PATATRI  GOSWAMI' },
      { email: '2105761@kiit.ac.in', name: 'SWAPNADEEP  BISWAS' },
      { email: '2105792@kiit.ac.in', name: 'CHHAVI  JHA' },
      { email: '2105804@kiit.ac.in', name: 'KUNAL BRAJASANKAR DASH' },
      { email: '2105894@kiit.ac.in', name: 'JASWARAJ  SAHOO' },
      { email: '2105965@kiit.ac.in', name: 'ISHAAN  GUPTA' },
      { email: '2128066@kiit.ac.in', name: 'ARPITA  DAS' },
      { email: '2128080@kiit.ac.in', name: 'PIYUSH RANJAN SATAPATHY' },
      { email: '2128087@kiit.ac.in', name: 'SHUBHANGI  HAZRA' },
      { email: '2129050@kiit.ac.in', name: 'ANUSHREE  SINHA' },
      { email: '21051076@kiit.ac.in', name: 'RAUNAK ROY CHOWDHURY' },
      { email: '21051134@kiit.ac.in', name: 'GUPTA  ANSHIKA' },
      { email: '21051142@kiit.ac.in', name: 'KUSHAGRA  SHUKLA' },
      { email: '21051158@kiit.ac.in', name: 'RAJVEER  SINGH' },
      { email: '21051218@kiit.ac.in', name: 'PRANTIK  BARIK' },
      { email: '21051220@kiit.ac.in', name: 'HUZAIFA  AHMAD' },
      { email: '21051261@kiit.ac.in', name: 'SOHAN  PATTNAIK' },
      { email: '21051391@kiit.ac.in', name: 'CHANDANA  MISHRA' },
      { email: '21051526@kiit.ac.in', name: 'UTKRIST  JAISWAL' },
      { email: '21051561@kiit.ac.in', name: 'DHRUBOJYOTI  MAHATO' },
      { email: '21051605@kiit.ac.in', name: 'SREETAMA  MUKHERJEE' },
      { email: '21051642@kiit.ac.in', name: 'AVINASH KUMAR RAJ' },
      { email: '21051663@kiit.ac.in', name: 'MRIGANSHU  PATRA' },
      { email: '21051674@kiit.ac.in', name: 'PRIYASHI  JAISWAL' },
      { email: '21051753@kiit.ac.in', name: 'SHAURYA  BHATNAGAR' },
      { email: '21051768@kiit.ac.in', name: 'SNEHASIS  NAYAK' },
      { email: '21051830@kiit.ac.in', name: 'P  MADHAVI' },
      { email: '21051831@kiit.ac.in', name: 'P  MADHURI' },
      { email: '21051846@kiit.ac.in', name: 'SAUJANYA  MOHANTY' },
      { email: '21052010@kiit.ac.in', name: 'PRATEEK  RAJ' },
      { email: '21052014@kiit.ac.in', name: 'RAGHAV  NAULAKHA' },
      { email: '21052118@kiit.ac.in', name: 'SUSHEN  PANDEY' },
      { email: '21052128@kiit.ac.in', name: 'ABHINAV  RAPARTIWAR' },
      { email: '21052133@kiit.ac.in', name: 'ADRITA  MOHANTY' },
      { email: '21052219@kiit.ac.in', name: 'ADITYA  BHATTACHARYYA' },
      { email: '21052248@kiit.ac.in', name: 'ABHISHEK  KUMAR' },
      { email: '21052419@kiit.ac.in', name: 'HARSH  KUMAR' },
      { email: '21052485@kiit.ac.in', name: 'ARSHITA SINGH BISEN' },
      { email: '21052527@kiit.ac.in', name: 'SANSKRUTI  MOHANTY' },
      { email: '21052645@kiit.ac.in', name: 'ADYASHA  PATI' },
      { email: '21052660@kiit.ac.in', name: 'DEEPA  KUMARI' },
      { email: '21052818@kiit.ac.in', name: 'ARPIT  KUMAR' },
      { email: '21052820@kiit.ac.in', name: 'ARYAN  SINGH' },
      { email: '21052841@kiit.ac.in', name: 'ISHA  PATRA' },
      { email: '21052875@kiit.ac.in', name: 'SHREYA  SINGH' },
      { email: '21052882@kiit.ac.in', name: 'SRIANSH RAJ PRADHAN' },
      { email: '21052952@kiit.ac.in', name: 'SUMIT  CHAUDHARY' },
      { email: '21052963@kiit.ac.in', name: 'AUROBINDA  MISHRA' },
      { email: '21053360@kiit.ac.in', name: 'ARCHITAA  SWAIN' },
      { email: '22057052@kiit.ac.in', name: 'SAMSON  RAJ' },
      { email: '2105157@kiit.ac.in', name: 'SHIBAJYOTI  CHOUDHURY' },
      { email: '2105208@kiit.ac.in', name: 'MILAN KUMAR SAHOO' },
      { email: '2105264@kiit.ac.in', name: 'ANKITA  SENAPAATI' },
      { email: '2105271@kiit.ac.in', name: 'AYYAAN  ALIM' },
      { email: '2105287@kiit.ac.in', name: 'MONALISA  PAL' },
      { email: '2105319@kiit.ac.in', name: 'SHREYANSH  UPADHYAY' },
      { email: '2105370@kiit.ac.in', name: 'GIRGILANI AKSH SUNDERLAL' },
      { email: '2105418@kiit.ac.in', name: 'SWARNADIP  BHOWMIK' },
      { email: '2105432@kiit.ac.in', name: 'ADITI  TAPADAR' },
      { email: '2105445@kiit.ac.in', name: 'ARCHIT  KAYAL' },
      { email: '2105532@kiit.ac.in', name: 'ASHUTOSH  AGRAWAL' },
      { email: '2105572@kiit.ac.in', name: 'SAKSHI' },
      { email: '2105576@kiit.ac.in', name: 'SATYAJIT  SATAPATHY' },
      { email: '2105588@kiit.ac.in', name: 'TANNU  KUMARI' },
      { email: '2105637@kiit.ac.in', name: 'PRANAV REDDY NAREDDHULA' },
      { email: '2105719@kiit.ac.in', name: 'HIMANSHU  MOHANTY' },
      { email: '2105763@kiit.ac.in', name: 'UTTAKARSH' },
      { email: '2105845@kiit.ac.in', name: 'TARISH DEEPAK CHATURANI' },
      { email: '2105908@kiit.ac.in', name: 'PRIYADARSHINI  PANIGRAHI' },
      { email: '2105928@kiit.ac.in', name: 'SHRUTI  DUTTA' },
      { email: '2106223@kiit.ac.in', name: 'KUWAR VISHAL SINGH' },
      { email: '2106235@kiit.ac.in', name: 'PRIYANSHI  RAJ' },
      { email: '2106237@kiit.ac.in', name: 'RAASHNA  KRISHN' },
      { email: '2106247@kiit.ac.in', name: 'SATTWIK  ROY' },
      { email: '2128006@kiit.ac.in', name: 'ADYANT KUMAR VERMA' },
      { email: '2128008@kiit.ac.in', name: 'AKUL  AKAND' },
      { email: '2129092@kiit.ac.in', name: 'ROHIT  ARYA' },
      { email: '2129154@kiit.ac.in', name: 'MEGHA VARSHINI NUKAM' },
      { email: '2129159@kiit.ac.in', name: 'SHIVAM  AGARWAL' },
      { email: '21051044@kiit.ac.in', name: 'SIDDHARTH  PATEL' },
      { email: '21051065@kiit.ac.in', name: 'MOHIT  KUMAR' },
      { email: '21051082@kiit.ac.in', name: 'SANKALP  SINHA' },
      { email: '21051085@kiit.ac.in', name: 'SATYA  PRAKASH' },
      { email: '21051280@kiit.ac.in', name: 'AKANSHA  TIWARI' },
      { email: '21051320@kiit.ac.in', name: 'PRITAM  SARKAR' },
      { email: '21051484@kiit.ac.in', name: 'MD AFAQUE  AKHTAR' },
      { email: '21051488@kiit.ac.in', name: 'NISHANT' },
      { email: '21051525@kiit.ac.in', name: 'UTKARSH KUMAR GUPTA' },
      { email: '21051547@kiit.ac.in', name: 'ARNAB  DUTTA' },
      { email: '21051554@kiit.ac.in', name: 'ARYAN  RAJ' },
      { email: '21051615@kiit.ac.in', name: 'VINIT  KUMAR' },
      { email: '21051777@kiit.ac.in', name: 'TANVI  GARNAYAK' },
      { email: '21051820@kiit.ac.in', name: 'HARSHVARDHAN  SHARMA' },
      { email: '21051840@kiit.ac.in', name: 'RISHU RAJ NAYAK' },
      { email: '21051898@kiit.ac.in', name: 'JAYAKRISHNAN  M' },
      { email: '21052020@kiit.ac.in', name: 'S M AAYAN WASI' },
      { email: '21052029@kiit.ac.in', name: 'SIDDHARTH  SINGH' },
      { email: '21052047@kiit.ac.in', name: 'SURAJ KUMAR YADAV' },
      { email: '21052117@kiit.ac.in', name: 'SUNAINA  SENAPATI' },
      { email: '21052145@kiit.ac.in', name: 'ASHUTOSHA  DANGA' },
      { email: '21052166@kiit.ac.in', name: 'NIKHIL  CHOUDHARY' },
      { email: '21052263@kiit.ac.in', name: 'PRAJUKTA  DEY' },
      { email: '21052369@kiit.ac.in', name: 'SUDHANSHU  RANJAN' },
      { email: '21052384@kiit.ac.in', name: 'ADIPTA  MOOKERJEE' },
      { email: '21052385@kiit.ac.in', name: 'ADVAY  HANI' },
      { email: '21052445@kiit.ac.in', name: 'ROSHAN  KUMAR' },
      { email: '21052473@kiit.ac.in', name: 'AKANKSHYA  PARIDA' },
      { email: '21052525@kiit.ac.in', name: 'SAKSHI  RAI' },
      { email: '21052703@kiit.ac.in', name: 'SATWIK  SINGH' },
      { email: '21052777@kiit.ac.in', name: 'PRANAY  PRADHAN' },
      { email: '21052853@kiit.ac.in', name: 'PRANSHU  SARTHAK' },
      { email: '21052916@kiit.ac.in', name: 'RISHI  RAJ' },
      { email: '2105033@kiit.ac.in', name: 'HIMANSHU  PRASAD' },
      { email: '2105051@kiit.ac.in', name: 'PRATYUSH  KUMAR' },
      { email: '2105298@kiit.ac.in', name: 'RAKSHIT  MEHRA' },
      { email: '2105357@kiit.ac.in', name: 'ANSHUMAN  SAHOO' },
      { email: '2105426@kiit.ac.in', name: 'AAKARSH  MITTAL' },
      { email: '2105510@kiit.ac.in', name: 'VARUN KUMAR SINHA' },
      { email: '2105540@kiit.ac.in', name: 'DEVANSH  AGRAWAL' },
      { email: '2105620@kiit.ac.in', name: 'DHAVAL  AERON' },
      { email: '2105629@kiit.ac.in', name: 'MANDIRA  GHOSH' },
      { email: '2105780@kiit.ac.in', name: 'ASHUTOSH  ROUT' },
      { email: '2105829@kiit.ac.in', name: 'SHUBHAM  PAL' },
      { email: '2105883@kiit.ac.in', name: 'GIRISH  KYAL' },
      { email: '2106007@kiit.ac.in', name: 'AKSHAT PUNJ' },
      { email: '2106055@kiit.ac.in', name: 'SAGNIK  MUKHERJEE' },
      { email: '2106061@kiit.ac.in', name: 'SASHANK  PATNAIK' },
      { email: '2106083@kiit.ac.in', name: 'VEDANG  VATSAL' },
      { email: '2106098@kiit.ac.in', name: 'ARATRIKA  DAS' },
      { email: '2106101@kiit.ac.in', name: 'ARNAB  MANDAL' },
      { email: '2106150@kiit.ac.in', name: 'SARTHAK  SRIVASTAVA' },
      { email: '2106175@kiit.ac.in', name: 'ABHYUDEY  SAMRAT' },
      { email: '2106181@kiit.ac.in', name: 'AKSHAT  RAJ' },
      { email: '2106197@kiit.ac.in', name: 'AYAN  MITRA' },
      { email: '2106251@kiit.ac.in', name: 'SHASHANK  SHEKHAR' },
      { email: '2106272@kiit.ac.in', name: 'TANIA  CHANDRA' },
      { email: '2106273@kiit.ac.in', name: 'TUSHAR  BHARDWAJ' },
      { email: '2106283@kiit.ac.in', name: 'SHANTANU  BASU' },
      { email: '2128037@kiit.ac.in', name: 'PRIYANSU  MISHRA' },
      { email: '2128072@kiit.ac.in', name: 'GYAN PRAKASH DASH' },
      { email: '2128086@kiit.ac.in', name: 'SHRUTI  SINHA' },
      { email: '2128115@kiit.ac.in', name: 'IPSITA  MAJHI' },
      { email: '2128132@kiit.ac.in', name: 'ADITI  SINGH' },
      { email: '2129022@kiit.ac.in', name: 'BHAWAN' },
      { email: '2129026@kiit.ac.in', name: 'NIKET  RAJ' },
      { email: '2129028@kiit.ac.in', name: 'PRANTIK KUMAR MAHATA' },
      { email: '21051164@kiit.ac.in', name: 'SAI SANKET BAL' },
      { email: '21051264@kiit.ac.in', name: 'SRIJANI  GUPTA' },
      { email: '21051342@kiit.ac.in', name: 'SHRUTILEKHA  GHOSH' },
      { email: '21051351@kiit.ac.in', name: 'SWARNAV  KUMAR' },
      { email: '21051367@kiit.ac.in', name: 'ADARSH  RAI' },
      { email: '21051468@kiit.ac.in', name: 'ARVIND  KAPHLEY' },
      { email: '21051492@kiit.ac.in', name: 'PRANAV  KUMAR' },
      { email: '21051577@kiit.ac.in', name: 'MANAV  MALHOTRA' },
      { email: '21051601@kiit.ac.in', name: 'SOUMYAJIT  ROY' },
      { email: '21051654@kiit.ac.in', name: 'KAUSTUBH  VATSA' },
      { email: '21051681@kiit.ac.in', name: 'SAYANTEKA  SAHA' },
      { email: '21051823@kiit.ac.in', name: 'KETAN  KUMAR' },
      { email: '21051918@kiit.ac.in', name: 'YATHARTH  JAIN' },
      { email: '21051963@kiit.ac.in', name: 'AKSHAT  BANERJEE' },
      { email: '21052136@kiit.ac.in', name: 'AMLAN  PRASAD' },
      { email: '21052283@kiit.ac.in', name: 'SOHEL AHMED' },
      { email: '21052295@kiit.ac.in', name: 'SYED  FAISAL' },
      { email: '21052329@kiit.ac.in', name: 'GOURAV KUMAR DAS' },
      { email: '21052330@kiit.ac.in', name: 'HARSHIT KUMAR SRIVASTAVA' },
      { email: '21052381@kiit.ac.in', name: 'AASTHA  SAHANI' },
      { email: '21052386@kiit.ac.in', name: 'AKASH  DUTTACHOWDHURY' },
      { email: '21052487@kiit.ac.in', name: 'ARYAN  RAJ' },
      { email: '21052501@kiit.ac.in', name: 'GAUTAM  SINHA' },
      { email: '21052502@kiit.ac.in', name: 'HIMANSHU  PRADHAN' },
      { email: '21052631@kiit.ac.in', name: 'UDIT  OJHA' },
      { email: '21052651@kiit.ac.in', name: 'ANSHUMAN  RAI' },
      { email: '21052753@kiit.ac.in', name: 'DEVI PRASAD PANDA' },
      { email: '21052807@kiit.ac.in', name: 'ABHISHRI  SRIVASTAVA' },
      { email: '21052810@kiit.ac.in', name: 'ADARSH  PARIDA' },
      { email: '21052832@kiit.ac.in', name: 'DEBNEEL  PAUL' },
      { email: '21052888@kiit.ac.in', name: 'TANYA  RAJ' },
      { email: '21052900@kiit.ac.in', name: 'AYUSH  BANSAL' },
      { email: '21053210@kiit.ac.in', name: 'DEVANSH  BHADAURIA' },
      { email: '21053265@kiit.ac.in', name: 'AMBRISH  KUMAR MANDAL' },
      { email: '21053299@kiit.ac.in', name: 'NIKESH KUMAR MANDAL' },
      { email: '21053317@kiit.ac.in', name: 'SANDEEP KUMAR GAUTAM' },
      { email: '21053461@kiit.ac.in', name: 'PRAJWAL  YADAV' },
      { email: '2105029@kiit.ac.in', name: 'DIVYA SWAROOP DASH' },
      { email: '2105047@kiit.ac.in', name: 'ADITI  RAJ' },
      { email: '2105059@kiit.ac.in', name: 'RUDRANSH  MISHRA' },
      { email: '2105104@kiit.ac.in', name: 'ANAY  ROY' },
      { email: '2105109@kiit.ac.in', name: 'ARSALAN  SIDDIQUE' },
      { email: '2105125@kiit.ac.in', name: 'KUMAR  GAURAV' },
      { email: '2105135@kiit.ac.in', name: 'PRIYANSHU  GUPTA' },
      { email: '2105170@kiit.ac.in', name: 'YASH  TRIPATHI' },
      { email: '2105186@kiit.ac.in', name: 'AYUSH  GHOSH' },
      { email: '2105187@kiit.ac.in', name: 'AYUSHMAN  PATTANAIK' },
      { email: '2105217@kiit.ac.in', name: 'PRATHAM PRIYANSHU MOHANTY' },
      { email: '2105223@kiit.ac.in', name: 'RAMANUJ RAJ' },
      { email: '2105237@kiit.ac.in', name: 'SHIVLI  SINGH' },
      { email: '2105318@kiit.ac.in', name: 'SHREEYANSHI  CHANDRA' },
      { email: '2105334@kiit.ac.in', name: 'TANAY  JAIN' },
      { email: '2105362@kiit.ac.in', name: 'AYUSH  KASHYAP' },
      { email: '2105388@kiit.ac.in', name: 'PARTHIV  PATNAIK' },
      { email: '2105401@kiit.ac.in', name: 'SANJANA  SARKAR' },
      { email: '2105409@kiit.ac.in', name: 'SHRUTI  MUKHERJEE' },
      { email: '2105428@kiit.ac.in', name: 'SWASTIK  PANDEY' },
      { email: '2105434@kiit.ac.in', name: 'ADITYA  KUMAR' },
      { email: '2105443@kiit.ac.in', name: 'ANKIT  KUMAR' },
      { email: '2105460@kiit.ac.in', name: 'GEETIKA  PADAM' },
      { email: '2105480@kiit.ac.in', name: 'ROHIT  ROUTRAY' },
      { email: '2105503@kiit.ac.in', name: 'SUBHAM  JENA' },
      { email: '2105517@kiit.ac.in', name: 'RAHUL  KUMAR' },
      { email: '2105545@kiit.ac.in', name: 'HIMAGHNA  DAS' },
      { email: '2105578@kiit.ac.in', name: 'SHAMEIK  DUTTA' },
      { email: '2105585@kiit.ac.in', name: 'SUVANKAR  PANIGRAHI' },
      { email: '2105589@kiit.ac.in', name: 'TAVISHI  SINGH' },
      { email: '2105592@kiit.ac.in', name: 'UTKARSH  SINGH' },
      { email: '2105602@kiit.ac.in', name: 'AMBUJ  KUMAR' },
      { email: '2105614@kiit.ac.in', name: 'AYUSH  PARIDA' },
      { email: '2105618@kiit.ac.in', name: 'DEBASMITA  BHAKAT' },
      { email: '2105626@kiit.ac.in', name: 'HIMANSHU  SHARMA' },
      { email: '2105627@kiit.ac.in', name: 'KAMAKSHYA PRASAD PANDA' },
      { email: '2105633@kiit.ac.in', name: 'NIKHITA  BHATTACHARYA' },
      { email: '2105679@kiit.ac.in', name: 'TASHA  RAJPAL' },
      { email: '2105705@kiit.ac.in', name: 'ASMITA  MITRA' },
      { email: '2105707@kiit.ac.in', name: 'AVILASHA  BHATTACHARYYA' },
      { email: '2105713@kiit.ac.in', name: 'DEVENDRA MOULI BHATTACHARYA' },
      { email: '2105723@kiit.ac.in', name: 'MUSKAN AGARWAL' },
      { email: '2105730@kiit.ac.in', name: 'RADHIKA  MANISH' },
      { email: '2105738@kiit.ac.in', name: 'ROHAN  NAG' },
      { email: '2105753@kiit.ac.in', name: 'SOUBHAGYA  ROY' },
      { email: '2105754@kiit.ac.in', name: 'SREEJATA  BANERJEE' },
      { email: '2105786@kiit.ac.in', name: 'BIBHASH' },
      { email: '2105794@kiit.ac.in', name: 'DHRUV  BHARGAVA' },
      { email: '2105797@kiit.ac.in', name: 'HARSH KUMAR DUBEY' },
      { email: '2105803@kiit.ac.in', name: 'KHUSHI  SINGH' },
      { email: '2105816@kiit.ac.in', name: 'RAVI RAJ  SHRIVASTAVA' },
      { email: '2105833@kiit.ac.in', name: 'SOURIN  MUKHERJEE' },
      { email: '2105842@kiit.ac.in', name: 'SUVRA  MUKHERJEE' },
      { email: '2105937@kiit.ac.in', name: 'ABHAY  KUMAR' },
      { email: '2105943@kiit.ac.in', name: 'ADYASHA SOUMYA ROUTRAY' },
      { email: '2105957@kiit.ac.in', name: 'BANJARE  PUSHKAR' },
      { email: '2105964@kiit.ac.in', name: 'HARSH  CHOUBEY' },
      { email: '2105975@kiit.ac.in', name: 'NABEEL ANWAR SIDDIQUI' },
      { email: '2105994@kiit.ac.in', name: 'SAI  BATHULA' },
      { email: '2106016@kiit.ac.in', name: 'ARPIT  KUMAR' },
      { email: '2106031@kiit.ac.in', name: 'HARSH KUMAR TIWARI' },
      { email: '2106032@kiit.ac.in', name: 'HARSH SINGH' },
      { email: '2106072@kiit.ac.in', name: 'SOUMYADEEP  PAUL' },
      { email: '2106078@kiit.ac.in', name: 'TATHAGATA  KUNDU' },
      { email: '2106085@kiit.ac.in', name: 'YASH KUMAR' },
      { email: '2106087@kiit.ac.in', name: 'AHANA  MONDAL' },
      { email: '2106109@kiit.ac.in', name: 'CHAITANYA  PUNJA' },
      { email: '2106137@kiit.ac.in', name: 'PRATYUSH  SHARMA' },
      { email: '2106156@kiit.ac.in', name: 'SHRUTI  SACHAN' },
      { email: '2106161@kiit.ac.in', name: 'SOUMILI  SAHA' },
      { email: '2106196@kiit.ac.in', name: 'AVIRUP  PARIA' },
      { email: '2106211@kiit.ac.in', name: 'GAURAV  RAJ' },
      { email: '2106277@kiit.ac.in', name: 'ADITYA  KAMAL' },
      { email: '2106281@kiit.ac.in', name: 'JYOTIRADITYA  SINGH' },
      { email: '2106300@kiit.ac.in', name: 'ANKIT  SAHOO' },
      { email: '2128005@kiit.ac.in', name: 'ADITYA  SATAPATHY' },
      { email: '2128013@kiit.ac.in', name: 'ANKIT  KUMAR' },
      { email: '2128015@kiit.ac.in', name: 'AVIKSHITH  SUBUDHI' },
      { email: '2128016@kiit.ac.in', name: 'BHARGAB  MEDHI' },
      { email: '2128031@kiit.ac.in', name: 'NISHANT  BHARALI' },
      { email: '2129029@kiit.ac.in', name: 'PRITHWISH  BHOWMIK' },
      { email: '2129052@kiit.ac.in', name: 'ARITRA  PODDAR' },
      { email: '2129066@kiit.ac.in', name: 'BIYAS  GHOSH' },
      { email: '2129089@kiit.ac.in', name: 'RABI NARAYAN ROUT' },
      { email: '2129093@kiit.ac.in', name: 'SABYASACHI  GHOSH' },
      { email: '2129119@kiit.ac.in', name: 'TUSHAR  BHATT' },
      { email: '21051010@kiit.ac.in', name: 'SIDDHARTH KUMAR' },
      { email: '21051026@kiit.ac.in', name: 'ABHRAJIT  DAS' },
      { email: '21051073@kiit.ac.in', name: 'RAHUL  NAUGARIYA' },
      { email: '21051091@kiit.ac.in', name: 'SHINJINI  ROY' },
      { email: '21051093@kiit.ac.in', name: 'SHUBHAM  KUMAR' },
      { email: '21051108@kiit.ac.in', name: 'ABHINEET  PANI' },
      { email: '21051120@kiit.ac.in', name: 'ANSUMAN  SAHU' },
      { email: '21051189@kiit.ac.in', name: 'VISHAL  KUMAR' },
      { email: '21051231@kiit.ac.in', name: 'PRAJUKTA  SAHOO' },
      { email: '21051302@kiit.ac.in', name: 'DEEPRAJ  BERA' },
      { email: '21051332@kiit.ac.in', name: 'ROHAN  KUMAR' },
      { email: '21051365@kiit.ac.in', name: 'ABHISHEK  PRADHAN' },
      { email: '21051373@kiit.ac.in', name: 'ANINDYA  BAG' },
      { email: '21051398@kiit.ac.in', name: 'HARSHIT  MANIA' },
      { email: '21051415@kiit.ac.in', name: 'PRIYANSHU  SHEKHAR' },
      { email: '21051418@kiit.ac.in', name: 'RAJ  SRIVASTAVA' },
      { email: '21051419@kiit.ac.in', name: 'RISHAV  RAJ' },
      { email: '21051433@kiit.ac.in', name: 'SIPRA SONALI PALTA' },
      { email: '21051434@kiit.ac.in', name: 'SNEHAJIT  SOM' },
      { email: '21051451@kiit.ac.in', name: 'ADIL AHMAD' },
      { email: '21051469@kiit.ac.in', name: 'ARYAN  DHAL' },
      { email: '21051501@kiit.ac.in', name: 'RISHAV  DEO' },
      { email: '21051505@kiit.ac.in', name: 'SAIM  SACHDEVA' },
      { email: '21051584@kiit.ac.in', name: 'PURNENDU  THAMB' },
      { email: '21051667@kiit.ac.in', name: 'PARTH  BANSAL' },
      { email: '21051699@kiit.ac.in', name: 'VIPASHYANA  DEEPAK' },
      { email: '21051706@kiit.ac.in', name: 'ABHISHEK  MALLICK' },
      { email: '21051726@kiit.ac.in', name: 'ASEER  AHMED' },
      { email: '21051739@kiit.ac.in', name: 'LAKSHYA  AGARWAL' },
      { email: '21051749@kiit.ac.in', name: 'PARTH  BHATNAGAR' },
      { email: '21051757@kiit.ac.in', name: 'ROUNAK  BAIDYA' },
      { email: '21051770@kiit.ac.in', name: 'SRIJAN  MUKHERJEE' },
      { email: '21051784@kiit.ac.in', name: 'YASH  PRIYADARSHI' },
      { email: '21051825@kiit.ac.in', name: 'MEGHA  SAHU' },
      { email: '21051838@kiit.ac.in', name: 'RAJSHREE' },
      { email: '21051839@kiit.ac.in', name: 'RAVI SHANKAR SUMAN' },
      { email: '21051916@kiit.ac.in', name: 'PRIYANKA  DUBEY' },
      { email: '21051951@kiit.ac.in', name: 'TANMAY  ANAND' },
      { email: '21051956@kiit.ac.in', name: 'ABHIGYAN  PRAKASH' },
      { email: '21051996@kiit.ac.in', name: 'JAYANTI  BHUSHAN' },
      { email: '21052012@kiit.ac.in', name: 'PRIYANSHU' },
      { email: '21052084@kiit.ac.in', name: 'NIPUN  DEVINENI' },
      { email: '21052085@kiit.ac.in', name: 'NOMAAN  SIRAJ' },
      { email: '21052119@kiit.ac.in', name: 'TANISHA VIKRAM SINGH' },
      { email: '21052137@kiit.ac.in', name: 'AMOL  KSHITIJ' },
      { email: '21052161@kiit.ac.in', name: 'MAYANK PRASOON BHARDWAJ' },
      { email: '21052180@kiit.ac.in', name: 'RUCHI  MAHATO' },
      { email: '21052186@kiit.ac.in', name: 'SATYAKI  GHOSH' },
      { email: '21052217@kiit.ac.in', name: 'ABHISHT  VERMA' },
      { email: '21052269@kiit.ac.in', name: 'RIYA  SINGH' },
      { email: '21052273@kiit.ac.in', name: 'RUDRAKSHA  JHA' },
      { email: '21052275@kiit.ac.in', name: 'SAMYABRATA  DEB' },
      { email: '21052285@kiit.ac.in', name: 'HARIT  MOHANTA' },
      { email: '21052307@kiit.ac.in', name: 'ANIKET  KUMAR' },
      { email: '21052365@kiit.ac.in', name: 'SIDDHARTHA  MUKHERJEE' },
      { email: '21052370@kiit.ac.in', name: 'SUMIT  RANJAN' },
      { email: '21052390@kiit.ac.in', name: 'AMIT KUMAR GARNAIK' },
      { email: '21052406@kiit.ac.in', name: 'ATIKA  CHANDEL' },
      { email: '21052417@kiit.ac.in', name: 'GAURAV' },
      { email: '21052458@kiit.ac.in', name: 'SWARNADEEP  GHOSAL' },
      { email: '21052474@kiit.ac.in', name: 'AKSHAT  KUMAR' },
      { email: '21052514@kiit.ac.in', name: 'PRAKHAR PARTH' },
      { email: '21052530@kiit.ac.in', name: 'BISWA RANJAN MOHANTY' },
      { email: '21052535@kiit.ac.in', name: 'SOUMIK  DEY' },
      { email: '21052583@kiit.ac.in', name: 'DIPRA  BANERJEE' },
      { email: '21052597@kiit.ac.in', name: 'KRISHNENDU  BOSE' },
      { email: '21052602@kiit.ac.in', name: 'MOHIDDIN  SHAIK' },
      { email: '21052620@kiit.ac.in', name: 'SHIRSHARKA  TALUKDER' },
      { email: '21052707@kiit.ac.in', name: 'SHREYA  CHOWDHURY' },
      { email: '21052711@kiit.ac.in', name: 'RIYA  CHANDA' },
      { email: '21052742@kiit.ac.in', name: 'ARYAN  TRIPATHI' },
      { email: '21052774@kiit.ac.in', name: 'NUKALA KAGHUVAHAN REDDY' },
      { email: '21052779@kiit.ac.in', name: 'RAGHAV  KHANDELWAL' },
      { email: '21052801@kiit.ac.in', name: 'TAPASYA  RAY' },
      { email: '21052825@kiit.ac.in', name: 'AVANI  SINGH' },
      { email: '21052858@kiit.ac.in', name: 'RAJ  ARYAN' },
      { email: '21052881@kiit.ac.in', name: 'SREETAMA  GHOSH' },
      { email: '21052906@kiit.ac.in', name: 'JOEL EPAPHARAS SAMUEL BONTHU' },
      { email: '21052995@kiit.ac.in', name: 'ANIKET  BURMAN' },
      { email: '21053205@kiit.ac.in', name: 'ANUSHKA  DEY' },
      { email: '21053253@kiit.ac.in', name: 'SHAKTIJA  SINGH' },
      { email: '21053267@kiit.ac.in', name: 'ANAMOL KUMAR KALWAR' },
      { email: '21053335@kiit.ac.in', name: 'AAYUSH  ANSH' },
      { email: '21053337@kiit.ac.in', name: 'NIKHIL KUMAR SAHU' },
      { email: '21053357@kiit.ac.in', name: 'RAJBIR  SINGH' },
      { email: '21053419@kiit.ac.in', name: 'SASWATI  PADHY' },
      { email: '21053422@kiit.ac.in', name: 'KRISHNA  SHAH' },
      { email: '21053453@kiit.ac.in', name: 'ABHISHEK' },
      { email: '21053472@kiit.ac.in', name: 'RITESH  YADAV' },
      { email: '22057038@kiit.ac.in', name: 'KUNAL  SAHU' },
      { email: '22057064@kiit.ac.in', name: 'SOUMYA GAYATRI DAS' },
      { email: '2105062@kiit.ac.in', name: 'SAKSHAM  AGARWAL' },
      { email: '2105113@kiit.ac.in', name: 'AYUSH  DAS' },
      { email: '2105151@kiit.ac.in', name: 'DIVYANSHI  TIWARI' },
      { email: '2105171@kiit.ac.in', name: 'AARYAK  PRASAD' },
      { email: '2105528@kiit.ac.in', name: 'ARITRA  MONDAL' },
      { email: '2105596@kiit.ac.in', name: 'ABHILIPSA  DAS' },
      { email: '2105660@kiit.ac.in', name: 'SAUNAK  SAHA' },
      { email: '2105663@kiit.ac.in', name: 'SHEETAL  SAHOO' },
      { email: '2105750@kiit.ac.in', name: 'SHREYA' },
      { email: '2105784@kiit.ac.in', name: 'AYESHA  MOHANTY' },
      { email: '2105871@kiit.ac.in', name: 'ARYAN  PRASAD' },
      { email: '2106164@kiit.ac.in', name: 'SPANDAN  BASACK' },
      { email: '2106177@kiit.ac.in', name: 'ADITYA KUMAR PRAJAPATI' },
      { email: '2106178@kiit.ac.in', name: 'AHANA  SAHA' },
      { email: '2106279@kiit.ac.in', name: 'TARUN  KUMAR' },
      { email: '2106291@kiit.ac.in', name: 'GAGANDEEP SINGH HORA' },
      { email: '2128034@kiit.ac.in', name: 'PRATEEK PREET PATTANAIK' },
      { email: '2128036@kiit.ac.in', name: 'PRIYA  KUMARI' },
      { email: '2128054@kiit.ac.in', name: 'SAURAV  KUMAR' },
      { email: '2128055@kiit.ac.in', name: 'SHANU PREMENDRA GOPAL' },
      { email: '2128062@kiit.ac.in', name: 'ADITEE  KASHYAP' },
      { email: '2128120@kiit.ac.in', name: 'SONIT KUMAR SWAIN' },
      { email: '2129020@kiit.ac.in', name: 'AKSHITA  SRIVASTAVA' },
      { email: '2129032@kiit.ac.in', name: 'RISHABH  MOHATA' },
      { email: '2129042@kiit.ac.in', name: 'AMIT KUMAR DHALL' },
      { email: '2129047@kiit.ac.in', name: 'ANKIT RAKESH SHARMA' },
      { email: '2129069@kiit.ac.in', name: 'DIVYA  AVTARAN' },
      { email: '21051152@kiit.ac.in', name: 'PRAKRIT  GHOSH' },
      { email: '21051438@kiit.ac.in', name: 'SOUPTIK  SAHA' },
      { email: '21051693@kiit.ac.in', name: 'SUTAM  MONDAL' },
      { email: '21051769@kiit.ac.in', name: 'SOUMIK  BANERJEE' },
      { email: '21051811@kiit.ac.in', name: 'DEEPAK KUMAR MISHRA' },
      { email: '21052005@kiit.ac.in', name: 'NIRAJ KUMAR DUTTA' },
      { email: '21052131@kiit.ac.in', name: 'ADITYA  KUMAR' },
      { email: '21052375@kiit.ac.in', name: 'SWATI SUMAN SAHU' },
      { email: '21052448@kiit.ac.in', name: 'SANDALI DEV SINHA' },
      { email: '21052593@kiit.ac.in', name: 'JATIN  BANSAL' },
      { email: '21052603@kiit.ac.in', name: 'NIHARIKA  RAGHAV' },
      { email: '21052725@kiit.ac.in', name: 'ABHIPSHA  DAS' },
      { email: '21052769@kiit.ac.in', name: 'MANSHA  PATRA' },
      { email: '21052796@kiit.ac.in', name: 'SOURAV  SAMANTARA' },
      { email: '21052809@kiit.ac.in', name: 'ADITI  TOPPO' },
      { email: '21052830@kiit.ac.in', name: 'DEBANGAN  BHATTACHARYYA' },
      { email: '21052901@kiit.ac.in', name: 'BIBASWAN  NANDI' },
      { email: '21052951@kiit.ac.in', name: 'SHUBHAM S PANT' },
      { email: '21052953@kiit.ac.in', name: 'SUMIT  TIWARI' },
      { email: '21052990@kiit.ac.in', name: 'ZOYAH AFSHEEN SAYEED' },
      { email: '21053233@kiit.ac.in', name: 'JHANVI  JAIN' },
      { email: '21053242@kiit.ac.in', name: 'ABHINAV  AAKASH' },
      { email: '2105067@kiit.ac.in', name: 'SHIKHA  CHATURVEDI' },
      { email: '2105077@kiit.ac.in', name: 'TANISHA  VERMA' },
      { email: '2105108@kiit.ac.in', name: 'ARPIT  DANDOTIYA' },
      { email: '2105352@kiit.ac.in', name: 'AMAN NIHAR MOHAPATRA' },
      { email: '2105389@kiit.ac.in', name: 'PRACHI  SAURABH' },
      { email: '2105649@kiit.ac.in', name: 'RITIKA  MISHRA' },
      { email: '2105955@kiit.ac.in', name: 'AYUSH  KUMAR' },
      { email: '2106029@kiit.ac.in', name: 'GOURAV  CHAKI' },
      { email: '2106036@kiit.ac.in', name: 'MD ALTAMASH DANYAL' },
      { email: '2106037@kiit.ac.in', name: 'MD DILSHAD  ALAM' },
      { email: '2106040@kiit.ac.in', name: 'MOULI  BOSE' },
      { email: '2106065@kiit.ac.in', name: 'SHEETAL  PATRA' },
      { email: '2106124@kiit.ac.in', name: 'MD JUNED EQBAL' },
      { email: '2106220@kiit.ac.in', name: 'KAUSHAL  KUMAR' },
      { email: '2128048@kiit.ac.in', name: 'SANTANU  GIRI' },
      { email: '2128092@kiit.ac.in', name: 'SOUMYA RANJAN SAHOO' },
      { email: '2128114@kiit.ac.in', name: 'YASH RAJ KUMAR' },
      { email: '2128118@kiit.ac.in', name: 'VITTHAL  TEWARI' },
      { email: '2128141@kiit.ac.in', name: 'SHURBI  GUPTA' },
      { email: '2129067@kiit.ac.in', name: 'DEEPTI  CHOUDHARY' },
      { email: '2129095@kiit.ac.in', name: 'SAHIL KUMAR SINGH' },
      { email: '21051029@kiit.ac.in', name: 'AKANKSHA  KUMARI' },
      { email: '21051103@kiit.ac.in', name: 'YASHDEEP' },
      { email: '21051207@kiit.ac.in', name: 'ANUSMITA  SAMANTA' },
      { email: '21051243@kiit.ac.in', name: 'SAKSHI  MOHAN' },
      { email: '21051250@kiit.ac.in', name: 'SASWAT  DASH' },
      { email: '21051368@kiit.ac.in', name: 'AHANA  DATTA' },
      { email: '21051384@kiit.ac.in', name: 'ASHUTOSH  RATH' },
      { email: '21051404@kiit.ac.in', name: 'MANAS  PRABHU' },
      { email: '21051425@kiit.ac.in', name: 'SAURABH  RAJ' },
      { email: '21051544@kiit.ac.in', name: 'ANUSUYA  DEB' },
      { email: '21051564@kiit.ac.in', name: 'GARGEE  BHOWMICK' },
      { email: '21051580@kiit.ac.in', name: 'PAVINI  CHANNA' },
      { email: '21051581@kiit.ac.in', name: 'PRACHURJYA RANI DOWARAH' },
      { email: '21051701@kiit.ac.in', name: 'AADARSH  VERMA' },
      { email: '21051748@kiit.ac.in', name: 'PAGILLA  BHUVAN' },
      { email: '21051780@kiit.ac.in', name: 'UJJWAL  KASHYAP' },
      { email: '21051793@kiit.ac.in', name: 'ADYA  SINGH' },
      { email: '21051867@kiit.ac.in', name: 'VISHAL  KUMAR' },
      { email: '21051869@kiit.ac.in', name: 'YASH  GUPTA' },
      { email: '21051871@kiit.ac.in', name: 'AARYASH  KUMAR' },
      { email: '21051872@kiit.ac.in', name: 'ABHASH KUMAR JHA' },
      { email: '21051888@kiit.ac.in', name: 'DEBARKA  MANDAL' },
      { email: '21051890@kiit.ac.in', name: 'DEEPANSHU  SINGH' },
      { email: '21052040@kiit.ac.in', name: 'VAIBHAV  RAJ' },
      { email: '21052141@kiit.ac.in', name: 'ANNANYA  MISHRA' },
      { email: '21052374@kiit.ac.in', name: 'SWATI  DAS' },
      { email: '21052541@kiit.ac.in', name: 'SURYAYAN  MUKHOPADHYAY' },
      { email: '21052548@kiit.ac.in', name: 'VEMURI PARTH SARATHI' },
      { email: '21052747@kiit.ac.in', name: 'AYUSH  PATHAK' },
      { email: '21052757@kiit.ac.in', name: 'DIVYESH  KULSHRESHTHA' },
      { email: '21052782@kiit.ac.in', name: 'RITESH KUMAR BEHERA' },
      { email: '21052799@kiit.ac.in', name: 'SUYASH  PRAKASH' },
      { email: '21052823@kiit.ac.in', name: 'ASHUTOSH KUMAR PRASAD' },
      { email: '21052868@kiit.ac.in', name: 'SARTHAK  SUR' },
      { email: '21053471@kiit.ac.in', name: 'MANJU  KAPADI' },
      { email: '22057055@kiit.ac.in', name: 'SHAHEEN  HAQUE' },
      { email: '2105012@kiit.ac.in', name: 'ANTARA  DUBEY' },
      { email: '2105013@kiit.ac.in', name: 'ANUBHAB  MISHRA' },
      { email: '2105045@kiit.ac.in', name: 'PADMANAVAN  KUMAR' },
      { email: '2105052@kiit.ac.in', name: 'PRATYUSH KUMAR SAHOO' },
      { email: '2105088@kiit.ac.in', name: 'ROHAN  CHANDRA' },
      { email: '2105123@kiit.ac.in', name: 'KASHIF  EQUBAL' },
      { email: '2105129@kiit.ac.in', name: 'NIVEDITA  NATH' },
      { email: '2105134@kiit.ac.in', name: 'PRIYA  RANA' },
      { email: '2105228@kiit.ac.in', name: 'ROSHNI' },
      { email: '2105250@kiit.ac.in', name: 'SURYANSH  BHAGAT' },
      { email: '2105251@kiit.ac.in', name: 'SUVENDU  PANDA' },
      { email: '2105302@kiit.ac.in', name: 'RITHWIK KUMAR SAHU' },
      { email: '2105349@kiit.ac.in', name: 'ABHRAJIT  RAY' },
      { email: '2105363@kiit.ac.in', name: 'AYUSH  MAITRA' },
      { email: '2105438@kiit.ac.in', name: 'AMAN  NIYAD' },
      { email: '2105472@kiit.ac.in', name: 'NANCY  BAKHLA' },
      { email: '2105538@kiit.ac.in', name: 'BIKRAMADITYA  MUNSHI' },
      { email: '2105640@kiit.ac.in', name: 'PRAVDEEP' },
      { email: '2105680@kiit.ac.in', name: 'TUSHAR  SUNDI' },
      { email: '2105710@kiit.ac.in', name: 'AYUSH KUMAR' },
      { email: '2105743@kiit.ac.in', name: 'SANEYIKA  DAS' },
      { email: '2105758@kiit.ac.in', name: 'SUPRIYA  PRIYADARSHI' },
      { email: '2105766@kiit.ac.in', name: 'AJAY  SHANKER' },
      { email: '2105799@kiit.ac.in', name: 'HRITIK KUMAR MOHANTY' },
      { email: '2105823@kiit.ac.in', name: 'SATHWIK NARESH KUMAR YARAMALA' },
      { email: '2105876@kiit.ac.in', name: 'BHAVYA  PRIYADARSHINI' },
      { email: '2105916@kiit.ac.in', name: 'ROHAN  SINGH' },
      { email: '2105923@kiit.ac.in', name: 'SATYAJEET  BEHERA' },
      { email: '2105924@kiit.ac.in', name: 'SHASHWATA  GAUTAM' },
      { email: '2105927@kiit.ac.in', name: 'SHIVANI  DIXIT' },
      { email: '2105944@kiit.ac.in', name: 'AKSHAT  SRIVASTAVA' },
      { email: '2105948@kiit.ac.in', name: 'ANUSHKA  RAJ' },
      { email: '2105966@kiit.ac.in', name: 'ISHIKA  DALAI' },
      { email: '2105981@kiit.ac.in', name: 'PRASHANT  GAUTAM' },
      { email: '2105995@kiit.ac.in', name: 'SANJANA  SUBUDHI' },
      { email: '2105997@kiit.ac.in', name: 'SANKALP  ANAND' },
      { email: '2106028@kiit.ac.in', name: 'ESHNA  GHOSH' },
      { email: '2106094@kiit.ac.in', name: 'ANSHUMAN  DASH' },
      { email: '2106245@kiit.ac.in', name: 'SAGAR  SINGH' },
      { email: '2106313@kiit.ac.in', name: 'RUDRA  MAJUMDER' },
      { email: '2128010@kiit.ac.in', name: 'AMAN  GUPTA' },
      { email: '2128014@kiit.ac.in', name: 'ATHARVA  DATRE' },
      { email: '2128043@kiit.ac.in', name: 'RITAM  SANYAL' },
      { email: '2128050@kiit.ac.in', name: 'SARVAGYA PRATAP SINGH' },
      { email: '2128052@kiit.ac.in', name: 'SATYA PRAKASH NIRALA' },
      { email: '2128082@kiit.ac.in', name: 'SAHIL RAJ' },
      { email: '2128145@kiit.ac.in', name: 'ADITYA  MANI' },
      { email: '2129007@kiit.ac.in', name: 'ADITI  CHOUDHURY' },
      { email: '2129030@kiit.ac.in', name: 'RAJARSHI  ADHIKARI' },
      { email: '2129039@kiit.ac.in', name: 'SWETA  PRUSETH' },
      { email: '2129045@kiit.ac.in', name: 'ANIRBAN  MONDAL' },
      { email: '2129051@kiit.ac.in', name: 'ARIJIT  SAHA' },
      { email: '2129053@kiit.ac.in', name: 'ARJUN  MAHESHWARI' },
      { email: '2129064@kiit.ac.in', name: 'BINAYAK  SAHOO' },
      { email: '2129099@kiit.ac.in', name: 'SATWIK  MUKHERJEE' },
      { email: '2129101@kiit.ac.in', name: 'SHAAKIR ATA KARIM' },
      { email: '2129122@kiit.ac.in', name: 'VAIBHAV  TIWARI' },
      { email: '21051019@kiit.ac.in', name: 'VAISHNAVI  KUMAR' },
      { email: '21051020@kiit.ac.in', name: 'VINEET  KUMAR' },
      { email: '21051025@kiit.ac.in', name: 'ABHISHEK  RAJ' },
      { email: '21051036@kiit.ac.in', name: 'ANUV  PANIGRAHI' },
      { email: '21051066@kiit.ac.in', name: 'NILAY  SHARMA' },
      { email: '21051129@kiit.ac.in', name: 'DEEPANK  SAINI' },
      { email: '21051147@kiit.ac.in', name: 'NISHCHAL KUMAR SINGH' },
      { email: '21051170@kiit.ac.in', name: 'SHABBIR  HUSSAIN' },
      { email: '21051246@kiit.ac.in', name: 'SANKET KUMAR MOHAPATRA' },
      { email: '21051352@kiit.ac.in', name: 'SWAYANTAN  MAJI' },
      { email: '21051364@kiit.ac.in', name: 'ABHINAV  KUMAR' },
      { email: '21051370@kiit.ac.in', name: 'AMAN  CHAURASIA' },
      { email: '21051378@kiit.ac.in', name: 'ANUSHKA  MOOKERJEA' },
      { email: '21051395@kiit.ac.in', name: 'GUNJAN  CHAKRABORTY' },
      { email: '21051409@kiit.ac.in', name: 'NAMAN  SINHA' },
      { email: '21051424@kiit.ac.in', name: 'PRAGYA' },
      { email: '21051429@kiit.ac.in', name: 'SHUBH  SRIVASTAVA' },
      { email: '21051430@kiit.ac.in', name: 'SHUBHAM  CHATTERJEE' },
      { email: '21051478@kiit.ac.in', name: 'HARSH  DEWANGAN' },
      { email: '21051481@kiit.ac.in', name: 'KALI  SUHANK' },
      { email: '21051491@kiit.ac.in', name: 'PALASH  KAR' },
      { email: '21051524@kiit.ac.in', name: 'UDAY  SHARMA' },
      { email: '21051546@kiit.ac.in', name: 'ARMAAN  SARASWAT' },
      { email: '21051626@kiit.ac.in', name: 'AMAR NATH MOHANTY' },
      { email: '21051635@kiit.ac.in', name: 'ARNAV  SHARMA' },
      { email: '21051652@kiit.ac.in', name: 'HARSHIT  GUPTA' },
      { email: '21051665@kiit.ac.in', name: 'NITISH  KUMAR' },
      { email: '21051696@kiit.ac.in', name: 'UDDHAV  SANYAL' },
      { email: '21051717@kiit.ac.in', name: 'ANUSHKA  MISHRA' },
      { email: '21051724@kiit.ac.in', name: 'ARNAV  KAPUR' },
      { email: '21051774@kiit.ac.in', name: 'SWAPNIL  RAJ' },
      { email: '21051803@kiit.ac.in', name: 'ARYAN  MOHANTY' },
      { email: '21051917@kiit.ac.in', name: 'PRIYANKAR  SAH' },
      { email: '21051937@kiit.ac.in', name: 'SHUBHADEEP  MOHANTA' },
      { email: '21051954@kiit.ac.in', name: 'VASU  BHARDWAJ' },
      { email: '21051962@kiit.ac.in', name: 'AKHILESH  PRAKASH' },
      { email: '21052023@kiit.ac.in', name: 'SAYASH  SARTHAK' },
      { email: '21052072@kiit.ac.in', name: 'KUSHAL  BERA' },
      { email: '21052078@kiit.ac.in', name: 'KUNAL  GUPTA' },
      { email: '21052114@kiit.ac.in', name: 'SUBHADIP  DAS' },
      { email: '21052182@kiit.ac.in', name: 'ASADI SAKET REDDY' },
      { email: '21052191@kiit.ac.in', name: 'SHIBASHISH  GUHA' },
      { email: '21052206@kiit.ac.in', name: 'TOONAM  MANIDEEPAK' },
      { email: '21052264@kiit.ac.in', name: 'PRANEESH  SHARMA' },
      { email: '21052277@kiit.ac.in', name: 'SHRAVAN  SEREL' },
      { email: '21052304@kiit.ac.in', name: 'AMRITANSHU' },
      { email: '21052333@kiit.ac.in', name: 'MD NEDAUR RAHMAN' },
      { email: '21052338@kiit.ac.in', name: 'NAYEER  NAUSHAD' },
      { email: '21052342@kiit.ac.in', name: 'PREENON  SAHA' },
      { email: '21052399@kiit.ac.in', name: 'ARBIND  MISHRA' },
      { email: '21052469@kiit.ac.in', name: 'ABHISHEK  YADAV' },
      { email: '21052472@kiit.ac.in', name: 'ADITYA  SHARMA' },
      { email: '21052507@kiit.ac.in', name: 'MOKSH  DUTT' },
      { email: '21052511@kiit.ac.in', name: 'NILOY  BISWAS' },
      { email: '21052546@kiit.ac.in', name: 'TUSHAR  TEOTIA' },
      { email: '21052702@kiit.ac.in', name: 'SASWAT  MISRA' },
      { email: '21052804@kiit.ac.in', name: 'MOHAMMAD NAZIM QURESHI' },
      { email: '21052863@kiit.ac.in', name: 'ROHIT  JOSHI' },
      { email: '21052876@kiit.ac.in', name: 'SIDDHARTH  TEWARI' },
      { email: '21052880@kiit.ac.in', name: 'SONALI  PRIYA' },
      { email: '21052941@kiit.ac.in', name: 'DIPCHAND  KALWAR' },
      { email: '21052962@kiit.ac.in', name: 'SWAPNANIL  BERA' },
      { email: '21053216@kiit.ac.in', name: 'RAVISH  RAJ' },
      { email: '21053219@kiit.ac.in', name: 'SHITAL PRIYADARSHINI' },
      { email: '21053235@kiit.ac.in', name: 'ANKITA KUMARI' },
      { email: '21053268@kiit.ac.in', name: 'ANKIT KUMAR JHA' },
      { email: '21053414@kiit.ac.in', name: 'MANDELA MARKO ALEX KARLO' },
      { email: '22057081@kiit.ac.in', name: 'CHANDRA SHEKHAR MAHTO' },
      { email: '2105004@kiit.ac.in', name: 'ABINASH PRASAD SAMAL' },
      { email: '2105030@kiit.ac.in', name: 'DIYANISHA  DEY' },
      { email: '2105037@kiit.ac.in', name: 'MANAVI  SONI' },
      { email: '2105072@kiit.ac.in', name: 'SRIJAN  RAJ' },
      { email: '2105097@kiit.ac.in', name: 'ADRIJA  CHAKRABARTY' },
      { email: '2105102@kiit.ac.in', name: 'AMLAN  TRIBEDI' },
      { email: '2105126@kiit.ac.in', name: 'LUCKY  DAS' },
      { email: '2105150@kiit.ac.in', name: 'SANKHADEEP  CHAKRABORTY' },
      { email: '2105211@kiit.ac.in', name: 'NIMESH  KUMAR' },
      { email: '2105219@kiit.ac.in', name: 'AKASH  AGRAWAL' },
      { email: '2105329@kiit.ac.in', name: 'SUPRATIM  BANIK' },
      { email: '2105330@kiit.ac.in', name: 'SURYANK  PRIYADARSHI' },
      { email: '2105435@kiit.ac.in', name: 'ADITYA  SARAF' },
      { email: '2105526@kiit.ac.in', name: 'ANSHUMAN  TIWARY' },
      { email: '2105531@kiit.ac.in', name: 'ARYASHI  AWASTHI' },
      { email: '2105736@kiit.ac.in', name: 'RITABRATA ROY CHOUDHURY' },
      { email: '2105744@kiit.ac.in', name: 'SATYA PRAKASH SARANGI' },
      { email: '2105762@kiit.ac.in', name: 'TANISHA  SARKAR' },
      { email: '2105896@kiit.ac.in', name: 'KOUSTAV  MONDAL' },
      { email: '2106047@kiit.ac.in', name: 'RAJDEEP  HALDAR' },
      { email: '2106084@kiit.ac.in', name: 'VISHAL GARG' },
      { email: '2106092@kiit.ac.in', name: 'ANKIT  RATH' },
      { email: '2106139@kiit.ac.in', name: 'PRIYANSHU  LADHA' },
      { email: '2106167@kiit.ac.in', name: 'SUSHANT  GUPTA' },
      { email: '2106180@kiit.ac.in', name: 'AKASH  GHOSH' },
      { email: '2106195@kiit.ac.in', name: 'ASHLESHA  MOHANTY' },
      { email: '2106299@kiit.ac.in', name: 'NEHA  BHARTI' },
      { email: '2128028@kiit.ac.in', name: 'MOUPRIYA  GUIN' },
      { email: '2128046@kiit.ac.in', name: 'SAKSHAM  SOOD' },
      { email: '2129023@kiit.ac.in', name: 'DIPTANGSHU  BHATTACHARJEE' },
      { email: '2129035@kiit.ac.in', name: 'SHWARNAV  SINHA CHOWDHURY' },
      { email: '2129113@kiit.ac.in', name: 'SOUMIK  GOSWAMI' },
      { email: '20051279@kiit.ac.in', name: 'SNEH KALPESH SHETH' },
      { email: '21051075@kiit.ac.in', name: 'RANIT  DAS' },
      { email: '21051089@kiit.ac.in', name: 'TANISHKA  SINGH' },
      { email: '21051098@kiit.ac.in', name: 'SWAPNIL  SARKAR' },
      { email: '21051114@kiit.ac.in', name: 'ALINA  TONGBRAM' },
      { email: '21051137@kiit.ac.in', name: 'ISHAN  RAIZADA' },
      { email: '21051145@kiit.ac.in', name: 'MOITREYEE  DAS' },
      { email: '21051202@kiit.ac.in', name: 'ANIKET  SAMANTA' },
      { email: '21051266@kiit.ac.in', name: 'SWATI  BAKSHI' },
      { email: '21051278@kiit.ac.in', name: 'ADITYA  RAJ' },
      { email: '21051285@kiit.ac.in', name: 'ANJALI  KUMARI' },
      { email: '21051346@kiit.ac.in', name: 'SRISHTI  JHA' },
      { email: '21051347@kiit.ac.in', name: 'SUBHASHREE  NAYAK' },
      { email: '21051355@kiit.ac.in', name: 'UTKARSH  KUMAR' },
      { email: '21051379@kiit.ac.in', name: 'ANWESHA  SAHU' },
      { email: '21051386@kiit.ac.in', name: 'AYAN KANTI DAS' },
      { email: '21051417@kiit.ac.in', name: 'RAHUL  SHARMA' },
      { email: '21051466@kiit.ac.in', name: 'ARHAN  PAUL' },
      { email: '21051477@kiit.ac.in', name: 'HARPREET  KAUR' },
      { email: '21051479@kiit.ac.in', name: 'MEHUL  AGARWAL' },
      { email: '21051758@kiit.ac.in', name: 'SAHUKARA SHRAVAN KUMAR' },
      { email: '21051860@kiit.ac.in', name: 'SHREYA  SAHAI' },
      { email: '21051865@kiit.ac.in', name: 'VANSHIKA PUNEET' },
      { email: '21051904@kiit.ac.in', name: 'KUSUM  JHAWAR' },
      { email: '21051915@kiit.ac.in', name: 'PRITI PALLABHI MISHRA' },
      { email: '21051935@kiit.ac.in', name: 'SHREYA  CHAKRABORTY' },
      { email: '21051958@kiit.ac.in', name: 'ABHISHEK  SAURAV' },
      { email: '21051980@kiit.ac.in', name: 'ARUNDHATI  SAHOO' },
      { email: '21052143@kiit.ac.in', name: 'ANURAG  SINGH' },
      { email: '21052189@kiit.ac.in', name: 'SHARADIYA  BANERJEE' },
      { email: '21052198@kiit.ac.in', name: 'SOUHARDYA  RAKSHIT' },
      { email: '21052235@kiit.ac.in', name: 'ARANYA  GHOSH' },
      { email: '21052236@kiit.ac.in', name: 'ARYA  SAHA' },
      { email: '21052249@kiit.ac.in', name: 'DIPTA  DEBNATH' },
      { email: '21052250@kiit.ac.in', name: 'GAURAV  KUMAR' },
      { email: '21052267@kiit.ac.in', name: 'RAVI  KUMAR' },
      { email: '21052281@kiit.ac.in', name: 'SHUVAM  DINDA' },
      { email: '21052282@kiit.ac.in', name: 'SOHAM  DEBNATH' },
      { email: '21052334@kiit.ac.in', name: 'MEDHA' },
      { email: '21052391@kiit.ac.in', name: 'AMIT KUMAR JENA' },
      { email: '21052499@kiit.ac.in', name: 'DRISTI  DAS' },
      { email: '21052517@kiit.ac.in', name: 'PRIYANGSHU  DAS' },
      { email: '21052520@kiit.ac.in', name: 'RAHUL  VIKRAMADITYA' },
      { email: '21052634@kiit.ac.in', name: 'YASHRAJ  KANUNGO' },
      { email: '21052649@kiit.ac.in', name: 'ANIKET  ACHARYA' },
      { email: '21052662@kiit.ac.in', name: 'DHAIRYA  SHEKHAR' },
      { email: '21052697@kiit.ac.in', name: 'RONITA  CHAKRABORTY' },
      { email: '21052792@kiit.ac.in', name: 'SHREECHANDAN  BEHERA' },
      { email: '21052884@kiit.ac.in', name: 'SURYA PRASAD SAHOO' },
      { email: '21052899@kiit.ac.in', name: 'ARYAN  MOHAPATRA' },
      { email: '21052932@kiit.ac.in', name: 'VIDYUN  AGARWAL' },
      { email: '21052966@kiit.ac.in', name: 'NEEL  SINHA' },
      { email: '21052991@kiit.ac.in', name: 'ABHISHIKT  MOHANTY' },
      { email: '21053201@kiit.ac.in', name: 'ABHINAY KUMAR SINGH' },
      { email: '21053271@kiit.ac.in', name: 'ASIF  MAHMUD  SHUVRO' },
      { email: '21053284@kiit.ac.in', name: 'K M NAFIZ RAHMAN VUBON' },
      { email: '21053308@kiit.ac.in', name: 'RAHUL   BISWAS' },
      { email: '22057008@kiit.ac.in', name: 'AMARNATH  BHUYAN' },
      { email: '22057013@kiit.ac.in', name: 'ANINDITA  ACHARJEE' },
      { email: '22057018@kiit.ac.in', name: 'ARYA KUMAR DASH' },
      { email: '22057028@kiit.ac.in', name: 'DEV KUMAR MOHANTY' },
      { email: '22057077@kiit.ac.in', name: 'UJJESHA  SHANKAR' },
      { email: '2105086@kiit.ac.in', name: 'AASTHA  SHUKLA' },
      { email: '2105233@kiit.ac.in', name: 'SAHIL  SAMAL' },
      { email: '2105260@kiit.ac.in', name: 'ANINDYA  BAG' },
      { email: '2105936@kiit.ac.in', name: 'ABDUL AZIZ KHAN' },
      { email: '2105992@kiit.ac.in', name: 'RUPAM KUMAR JENA' },
      { email: '2106008@kiit.ac.in', name: 'AKSHIT  YADAV' },
      { email: '2106253@kiit.ac.in', name: 'SHATAKSHI SNEH' },
      { email: '2128023@kiit.ac.in', name: 'KUNAL  NAYAK' },
      { email: '2128100@kiit.ac.in', name: 'SUBHRANSHU  PATTANAYAK' },
      { email: '2128128@kiit.ac.in', name: 'SAROJ  SANYASI' },
      { email: '2129014@kiit.ac.in', name: 'ADYA  SHUKLA' },
      { email: '2129139@kiit.ac.in', name: 'SUPREETI  SINGH' },
      { email: '21051032@kiit.ac.in', name: 'ANJALI  RAJ' },
      { email: '21051259@kiit.ac.in', name: 'SHRIMOYEE  BANERJEE' },
      { email: '21051301@kiit.ac.in', name: 'DEBLINA  MANDAL' },
      { email: '21051467@kiit.ac.in', name: 'ARNAB  PUTHAL' },
      { email: '21051482@kiit.ac.in', name: 'KRISHNAV  DEKA' },
      { email: '21051957@kiit.ac.in', name: 'ABHISHEK  ANAND' },
      { email: '21052006@kiit.ac.in', name: 'PIYUSH  SOMANI' },
      { email: '21052059@kiit.ac.in', name: 'ASHIRWAAD  DHIR' },
      { email: '21052169@kiit.ac.in', name: 'PRATYUSH AMLAN SAHU' },
      { email: '21052199@kiit.ac.in', name: 'SOURAV  ACHARYA' },
      { email: '21052500@kiit.ac.in', name: 'G  DIVYA' },
      { email: '21052540@kiit.ac.in', name: 'SUJIB RANJAN MANDAL' },
      { email: '21052568@kiit.ac.in', name: 'ANUSHKA  SINGH' },
      { email: '21052621@kiit.ac.in', name: 'SHREYANSH  PANDEY' },
      { email: '21052833@kiit.ac.in', name: 'DEEPAK KUMAR MOHANTY' },
      { email: '21052847@kiit.ac.in', name: 'NISHIRAJ  BHARALI' },
      { email: '21053032@kiit.ac.in', name: 'OMKAR  NAYAK' },
      { email: '21053207@kiit.ac.in', name: 'ARMAN  DAS' },
      { email: '21053237@kiit.ac.in', name: 'RUDRADITYA  DAS' },
      { email: '21053244@kiit.ac.in', name: 'RISHABH KUMAR SINGH' },
      { email: '21053251@kiit.ac.in', name: 'JOYDIPTO  SAHA' },
      { email: '21053372@kiit.ac.in', name: 'SHIVAAY  GUSAIN' },
      { email: '2105018@kiit.ac.in', name: 'ARITRA  MUHURI' },
      { email: '2105025@kiit.ac.in', name: 'BARENYA  MOHANTY' },
      { email: '2105049@kiit.ac.in', name: 'PRAJNABRATA  MOHANTY' },
      { email: '2105069@kiit.ac.in', name: 'KATTA SIVA SAI SUSMITHA' },
      { email: '2105070@kiit.ac.in', name: 'SOHAME  MUKHERJEE' },
      { email: '2105080@kiit.ac.in', name: 'VELUPULA SRAVAN KUMAR' },
      { email: '2105082@kiit.ac.in', name: 'VEDIKA  CHOWDHARY' },
      { email: '2105106@kiit.ac.in', name: 'ANKITA  LAL' },
      { email: '2105141@kiit.ac.in', name: 'S L ARAMATH' },
      { email: '2105149@kiit.ac.in', name: 'SANJUKTA  MAJI' },
      { email: '2105154@kiit.ac.in', name: 'SAYAN  BANERJEE' },
      { email: '2105174@kiit.ac.in', name: 'ADITYA KAMAL THAMMINENI' },
      { email: '2105181@kiit.ac.in', name: 'ANURAG  PANDA' },
      { email: '2105239@kiit.ac.in', name: 'PANKHURI  KUMARI' },
      { email: '2105320@kiit.ac.in', name: 'SHRUTI  GUHA' },
      { email: '2105333@kiit.ac.in', name: 'SWABHIMAN  BAISAK' },
      { email: '2105342@kiit.ac.in', name: 'AARADHYA  SARKAR' },
      { email: '2105483@kiit.ac.in', name: 'SAHIL  CHAKRABORTY' },
      { email: '2105521@kiit.ac.in', name: 'AMAN  SINHA' },
      { email: '2105544@kiit.ac.in', name: 'HARSHIT  RAJ' },
      { email: '2105549@kiit.ac.in', name: 'KISHU KUMAR' },
      { email: '2105552@kiit.ac.in', name: 'KRUSHNA CHANDRA MISHRA' },
      { email: '2105574@kiit.ac.in', name: 'SWETA  SUMAN' },
      { email: '2105595@kiit.ac.in', name: 'YASH  PRIYAM' },
      { email: '2105603@kiit.ac.in', name: 'ANANY  MATHUR' },
      { email: '2105630@kiit.ac.in', name: 'SWARUP PADMAKAR SURYAWANSHI' },
      { email: '2105688@kiit.ac.in', name: 'ALANKRIT  GUPTA' },
      { email: '2105708@kiit.ac.in', name: 'AVIPSA  NAYAK' },
      { email: '2105720@kiit.ac.in', name: 'HRITIKA  GUPTA' },
      { email: '2105767@kiit.ac.in', name: 'AMISH  SINGH' },
      { email: '2105769@kiit.ac.in', name: 'ANIRUDDH  SINGH' },
      { email: '2105772@kiit.ac.in', name: 'ANURAG RANJAN DAS' },
      { email: '2105785@kiit.ac.in', name: 'AYUSHI  HARSHAL' },
      { email: '2105795@kiit.ac.in', name: 'DIVYANSHI  GORAI' },
      { email: '2105836@kiit.ac.in', name: 'SUBHRA  DASH' },
      { email: '2105840@kiit.ac.in', name: 'SURACHITA ESHMI DAS' },
      { email: '2105872@kiit.ac.in', name: 'ASISH KUMAR SAHOO' },
      { email: '2105956@kiit.ac.in', name: 'AMRITANSH KUMAR VERMA' },
      { email: '2105970@kiit.ac.in', name: 'KUMAR  NISHKAM' },
      { email: '2106001@kiit.ac.in', name: 'AAYAN  GOGOI' },
      { email: '2106049@kiit.ac.in', name: 'RASHIK  GOGOI' },
      { email: '2106100@kiit.ac.in', name: 'ARGHAJIT  DAS' },
      { email: '2106122@kiit.ac.in', name: 'MAYANK  RAJPUT' },
      { email: '2106140@kiit.ac.in', name: 'PURAN KUMAR SAHU' },
      { email: '2106232@kiit.ac.in', name: 'PIYUSH  JAISWAL' },
      { email: '2106250@kiit.ac.in', name: 'SEEMA  KUMARI' },
      { email: '2106296@kiit.ac.in', name: 'RAUNIT  RAJ' },
      { email: '2128068@kiit.ac.in', name: 'ASISH  PADHY' },
      { email: '2129072@kiit.ac.in', name: 'JANVI  SINGH' },
      { email: '2129088@kiit.ac.in', name: 'PUJA  SARKAR' },
      { email: '2129091@kiit.ac.in', name: 'ROHAN  TRIPATHY' },
      { email: '2129100@kiit.ac.in', name: 'SAUMYA' },
      { email: '2129112@kiit.ac.in', name: 'SOMEWRIK  BANDYOPADHYAY' },
      { email: '2129128@kiit.ac.in', name: 'ASHUTOSH  DUBEY' },
      { email: '2129130@kiit.ac.in', name: 'SHAKSHI  JAISWAL' },
      { email: '21051028@kiit.ac.in', name: 'ADITYA RAJ SAHU' },
      { email: '21051031@kiit.ac.in', name: 'ANIL  PADHAN' },
      { email: '21051046@kiit.ac.in', name: 'CHITRANSHI SINGH' },
      { email: '21051084@kiit.ac.in', name: 'SASWAT  JENA' },
      { email: '21051112@kiit.ac.in', name: 'ADITYA KUMAR MOHAPATRA' },
      { email: '21051121@kiit.ac.in', name: 'ARANTA  RICHHARIA' },
      { email: '21051140@kiit.ac.in', name: 'KENGUVA  BHAVESH' },
      { email: '21051143@kiit.ac.in', name: 'MAHAK  MAHAWAR' },
      { email: '21051217@kiit.ac.in', name: 'DIVYANSH  KUMAR' },
      { email: '21051258@kiit.ac.in', name: 'SHOUMIKI  MAULIK' },
      { email: '21051268@kiit.ac.in', name: 'UJJEISHEEI  PANDA' },
      { email: '21051319@kiit.ac.in', name: 'PRATYUSH  PANDA' },
      { email: '21051330@kiit.ac.in', name: 'RITIKA  MOITRA' },
      { email: '21051353@kiit.ac.in', name: 'TAHSEEN  AHMAD' },
      { email: '21051439@kiit.ac.in', name: 'STHITAPRAGYAN  ROUT' },
      { email: '21051497@kiit.ac.in', name: 'RAHUL RAJ' },
      { email: '21051515@kiit.ac.in', name: 'SHRUTI  PANDEY' },
      { email: '21051531@kiit.ac.in', name: 'AADRIKA  JAISWAL' },
      { email: '21051565@kiit.ac.in', name: 'HARSHITA  ANMOL' },
      { email: '21051566@kiit.ac.in', name: 'HIMANSHU  RAJ' },
      { email: '21051592@kiit.ac.in', name: 'SAKSHAM  CHHAWAN' },
      { email: '21051608@kiit.ac.in', name: 'SURYAPRATAP SINGH VARMA' },
      { email: '21051616@kiit.ac.in', name: 'AADVIK SINH GOHIL' },
      { email: '21051669@kiit.ac.in', name: 'PRATIK KUMAR SINGH' },
      { email: '21051672@kiit.ac.in', name: 'JAYA VASHISTHA' },
      { email: '21051683@kiit.ac.in', name: 'SHILPI  TIKADER' },
      { email: '21051751@kiit.ac.in', name: 'PRASOON  KARN' },
      { email: '21051775@kiit.ac.in', name: 'T MAHESHWARAN' },
      { email: '21051782@kiit.ac.in', name: 'WANSH SURENDER BISWAKARMA' },
      { email: '21051788@kiit.ac.in', name: 'ABHISEK  SAHOO' },
      { email: '21051879@kiit.ac.in', name: 'AMISHA  KHICHARIYA' },
      { email: '21051892@kiit.ac.in', name: 'DIVYAM' },
      { email: '21051921@kiit.ac.in', name: 'RUDRANSH  PRATHAM' },
      { email: '21051946@kiit.ac.in', name: 'SURBHI  NEGI' },
      { email: '21051948@kiit.ac.in', name: 'SWADHIN  DALAI' },
      { email: '21051950@kiit.ac.in', name: 'TANISHA  KARMAKAR' },
      { email: '21052008@kiit.ac.in', name: 'PRAGYAN PROTIM GOSWAMI' },
      { email: '21052080@kiit.ac.in', name: 'MAYANK  GAJWE' },
      { email: '21052135@kiit.ac.in', name: 'AKSHAT  ANIKET' },
      { email: '21052224@kiit.ac.in', name: 'AMAN KUMAR JENA' },
      { email: '21052361@kiit.ac.in', name: 'SHOUNAK  MISHRA' },
      { email: '21052401@kiit.ac.in', name: 'ARSLAN  SALIM' },
      { email: '21052456@kiit.ac.in', name: 'SRUSHTI ANANT CHOUDHARY' },
      { email: '21052462@kiit.ac.in', name: 'TUSHAR  GOYAL' },
      { email: '21052476@kiit.ac.in', name: 'ANISH  SINHA' },
      { email: '21052490@kiit.ac.in', name: 'BHAVYA  KUMARI' },
      { email: '21052532@kiit.ac.in', name: 'SIDDHARTH  SINHA' },
      { email: '21052573@kiit.ac.in', name: 'ASHUTOSH  PRABHAKAR' },
      { email: '21052576@kiit.ac.in', name: 'AYUSHI  GUPTA' },
      { email: '21052596@kiit.ac.in', name: 'KOUSHIKI  BOSE' },
      { email: '21052605@kiit.ac.in', name: 'RAINEE  BHANGRE' },
      { email: '21052739@kiit.ac.in', name: 'UDISHA  PANDEY' },
      { email: '21052762@kiit.ac.in', name: 'KAMALESH  DATTA' },
      { email: '21052778@kiit.ac.in', name: 'PRATYUSH  KUMAR' },
      { email: '21052813@kiit.ac.in', name: 'ANUSHKA  PRIYADARSHINI' },
      { email: '21052857@kiit.ac.in', name: 'PRIYANSU  MOHANTY' },
      { email: '21052866@kiit.ac.in', name: 'SAMRIDDHI  SHARMA' },
      { email: '21052870@kiit.ac.in', name: 'SHAMBHAWI  SHREYA' },
      { email: '21052908@kiit.ac.in', name: 'MAMOON  RASHID' },
      { email: '21052957@kiit.ac.in', name: 'SWEETY  KUMARI' },
      { email: '21053212@kiit.ac.in', name: 'LONGJAM NIRISH SINGH' },
      { email: '21053282@kiit.ac.in', name: 'HARIOM  GUPTA' },
      { email: '21053312@kiit.ac.in', name: 'RAMEEZ  WAHID' },
      { email: '21053321@kiit.ac.in', name: 'SHEKHAR  MALLIK' },
      { email: '21053364@kiit.ac.in', name: 'ARYAN  PAL' },
      { email: '21053396@kiit.ac.in', name: 'GOURAV  SADOTRA' },
      { email: '21053408@kiit.ac.in', name: 'NITESH KUMAR MEHTA' },
      { email: '22057085@kiit.ac.in', name: 'NIRMALYA GAUTAM ACHARYA' },
      { email: '2105003@kiit.ac.in', name: 'ABHISHEK  KUMAR' },
      { email: '2105056@kiit.ac.in', name: 'RISHABH RAJ SRIVASTAVA' },
      { email: '2105078@kiit.ac.in', name: 'TEJASWI  DALAL' },
      { email: '2105107@kiit.ac.in', name: 'ANUSHKA  SINGH' },
      { email: '2105178@kiit.ac.in', name: 'AMAN KUMAR SINHA' },
      { email: '2105180@kiit.ac.in', name: 'ANSHUMAN  SEN' },
      { email: '2105213@kiit.ac.in', name: 'NITISH  KUMAR' },
      { email: '2105273@kiit.ac.in', name: 'DEEP  MURARI' },
      { email: '2105367@kiit.ac.in', name: 'DHRUV  MUTREJA' },
      { email: '2105385@kiit.ac.in', name: 'NIRET SANTOSH BADGIRE' },
      { email: '2105494@kiit.ac.in', name: 'SHOBHIT KUMAR SINHA' },
      { email: '2105498@kiit.ac.in', name: 'SIDHANT  GUHA' },
      { email: '2105666@kiit.ac.in', name: 'SHRESHTHA  MISHRA' },
      { email: '2105672@kiit.ac.in', name: 'SOUMIK  SAHA' },
      { email: '2105695@kiit.ac.in', name: 'ANCHAL  SAHOO' },
      { email: '2105715@kiit.ac.in', name: 'GARGI  SANSANWAL' },
      { email: '2105721@kiit.ac.in', name: 'KUMAR  ADITYA' },
      { email: '2105728@kiit.ac.in', name: 'PRANAV  KUMAR' },
      { email: '2105739@kiit.ac.in', name: 'ROHIT  PANDEY' },
      { email: '2105755@kiit.ac.in', name: 'SUBHRANSU  SATHUA' },
      { email: '2105856@kiit.ac.in', name: 'AISHWARYA  KUMARI' },
      { email: '2105861@kiit.ac.in', name: 'ANANYA  SINGH' },
      { email: '2105910@kiit.ac.in', name: 'RAJ  VERMA' },
      { email: '2105940@kiit.ac.in', name: 'ADARSH  TIWARI' },
      { email: '2105949@kiit.ac.in', name: 'ARGHA  ROY' },
      { email: '2105959@kiit.ac.in', name: 'DEBANJAN  KHAWASH' },
      { email: '2106026@kiit.ac.in', name: 'DIPAYAN  GOSWAMI' },
      { email: '2106034@kiit.ac.in', name: 'KRITTIKA  GHOSH' },
      { email: '2106088@kiit.ac.in', name: 'ANANYA  KUMARI' },
      { email: '2106138@kiit.ac.in', name: 'PRIYA  SINHA' },
      { email: '2106159@kiit.ac.in', name: 'SIRSHA  BASAK' },
      { email: '2106179@kiit.ac.in', name: 'AKANKSHA  DEO' },
      { email: '2106199@kiit.ac.in', name: 'AYUSH  PAL' },
      { email: '2106208@kiit.ac.in', name: 'DITSA  GHOSH' },
      { email: '2106224@kiit.ac.in', name: 'MAHATWAKANSHI  SHARMA' },
      { email: '2106287@kiit.ac.in', name: 'PAPPU  BISHWAS' },
      { email: '2106290@kiit.ac.in', name: 'ANJALI  SINGH' },
      { email: '2106318@kiit.ac.in', name: 'SHREE  SARAL' },
      { email: '2128003@kiit.ac.in', name: 'ABHIGNA  MOTLA' },
      { email: '2128012@kiit.ac.in', name: 'ANISHA  PANDA' },
      { email: '2128035@kiit.ac.in', name: 'PRATYUSH KUMAR PRASAD' },
      { email: '2128038@kiit.ac.in', name: 'PURVI  MOHAPATRA' },
      { email: '2128056@kiit.ac.in', name: 'SHARANYA  SAMANTA' },
      { email: '2128088@kiit.ac.in', name: 'SINJINI  SENGUPTA' },
      { email: '2128133@kiit.ac.in', name: 'KHYAATI  SHARMA' },
      { email: '2128134@kiit.ac.in', name: 'AARYAN  KUMAR' },
      { email: '2129136@kiit.ac.in', name: 'ABHAY KUMAR MANDAL' },
      { email: '2129158@kiit.ac.in', name: 'SANIL  SINGH' },
      { email: '21051002@kiit.ac.in', name: 'SHANTANU  TRIPATHI' },
      { email: '21051006@kiit.ac.in', name: 'SHIVANGI' },
      { email: '21051011@kiit.ac.in', name: 'SIDDHARTHA  AGRAWAL' },
      { email: '21051039@kiit.ac.in', name: 'ARKA SUNDAR MAITI' },
      { email: '21051043@kiit.ac.in', name: 'AVINASH  PRADHAN' },
      { email: '21051050@kiit.ac.in', name: 'MUKESH  KUMAR' },
      { email: '21051106@kiit.ac.in', name: 'ABHAY KUMAR RAUT' },
      { email: '21051107@kiit.ac.in', name: 'ABHINAV  PANDEY' },
      { email: '21051138@kiit.ac.in', name: 'JANARDHAN  KUMAR' },
      { email: '21051163@kiit.ac.in', name: 'SAHIL  KUMAR' },
      { email: '21051199@kiit.ac.in', name: 'AKASH  ROY' },
      { email: '21051267@kiit.ac.in', name: 'TAMANNA  PATNAIK' },
      { email: '21051276@kiit.ac.in', name: 'ABHIJEET  KUMAR' },
      { email: '21051374@kiit.ac.in', name: 'ANIRUDDH  VERMA' },
      { email: '21051393@kiit.ac.in', name: 'DEBANSHEE  PADHI' },
      { email: '21051422@kiit.ac.in', name: 'SAHIL  KUMAR' },
      { email: '21051476@kiit.ac.in', name: 'GARIMA  SINGH' },
      { email: '21051503@kiit.ac.in', name: 'ROHAN  TOSH' },
      { email: '21051509@kiit.ac.in', name: 'SANU  VERMA' },
      { email: '21051517@kiit.ac.in', name: 'SREJA  DUTTA' },
      { email: '21051594@kiit.ac.in', name: 'SHAMIT  SHEEL' },
      { email: '21051606@kiit.ac.in', name: 'SUDITI  SARKAR' },
      { email: '21051607@kiit.ac.in', name: 'SUMAN  BEHERA' },
      { email: '21051633@kiit.ac.in', name: 'ARKA  DUTTA' },
      { email: '21051640@kiit.ac.in', name: 'ASHISH  BHARTI' },
      { email: '21051689@kiit.ac.in', name: 'SNEHA  SARKAR' },
      { email: '21051723@kiit.ac.in', name: 'ARMAAN  ROUTRAI' },
      { email: '21051738@kiit.ac.in', name: 'KUMAR KRISHANU' },
      { email: '21051808@kiit.ac.in', name: 'DEBADRITA  MANDAL' },
      { email: '21051824@kiit.ac.in', name: 'MANISHA  KUMARI' },
      { email: '21051856@kiit.ac.in', name: 'SUSHANT' },
      { email: '21051931@kiit.ac.in', name: 'SHIVAM  KASHYAP' },
      { email: '21052035@kiit.ac.in', name: 'SUBHASIS  PANDA' },
      { email: '21052050@kiit.ac.in', name: 'ANIKET  KASHYAP' },
      { email: '21052070@kiit.ac.in', name: 'GYANANJAN  PAUL' },
      { email: '21052098@kiit.ac.in', name: 'SANA  ROY' },
      { email: '21052105@kiit.ac.in', name: 'SHREYA  SHASHANK' },
      { email: '21052172@kiit.ac.in', name: 'RAHUL KUMAR BISWAS' },
      { email: '21052194@kiit.ac.in', name: 'SHUBHANKAR  SHAHI' },
      { email: '21052195@kiit.ac.in', name: 'SIDDHARTHA  KUMAR' },
      { email: '21052270@kiit.ac.in', name: 'ROBIN  NAGAR' },
      { email: '21052357@kiit.ac.in', name: 'SAUMYA  MISHRA' },
      { email: '21052444@kiit.ac.in', name: 'ROHAN  JOHN' },
      { email: '21052533@kiit.ac.in', name: 'SNEHA  BEHERA' },
      { email: '21052534@kiit.ac.in', name: 'SONALIKA  SAHOO' },
      { email: '21052639@kiit.ac.in', name: 'ABHINAV  MANGRATI' },
      { email: '21052658@kiit.ac.in', name: 'DEBARKA  CHAKRABORTI' },
      { email: '21052680@kiit.ac.in', name: 'PARINITI  SINHA' },
      { email: '21052686@kiit.ac.in', name: 'PRIYANSHU KUMAR ROY' },
      { email: '21052689@kiit.ac.in', name: 'RAHUL  SINHA' },
      { email: '21052690@kiit.ac.in', name: 'REETIKA' },
      { email: '21052710@kiit.ac.in', name: 'SOURAV  NARAYAN' },
      { email: '21052842@kiit.ac.in', name: 'KUMAR HARSH' },
      { email: '21052930@kiit.ac.in', name: 'UZAIF  ALI' },
      { email: '21053224@kiit.ac.in', name: 'VASU  AGRAWAL' },
      { email: '21053238@kiit.ac.in', name: 'VINAYAK  MAJHI' },
      { email: '21053252@kiit.ac.in', name: 'AANYA  SRIVASTAVA' },
      { email: '21053315@kiit.ac.in', name: 'SADIA AKTER POLY' },
      { email: '21053325@kiit.ac.in', name: 'SHUBHAM PRASAD ROUNIYAR' },
      { email: '21053329@kiit.ac.in', name: 'SUDIP  CHAKRABARTY' },
      { email: '21053336@kiit.ac.in', name: 'HARSH KUMAR SINGH' },
      { email: '21053355@kiit.ac.in', name: 'ARPIT  SINGH' },
      { email: '21053365@kiit.ac.in', name: 'SOMYA  SINHA' },
      { email: '21053381@kiit.ac.in', name: 'SUDHIR  JAISWAL' },
      { email: '21053382@kiit.ac.in', name: 'ARPITA  DATTA' },
      { email: '21053405@kiit.ac.in', name: 'ANSHU  GUPTA' },
      { email: '21053450@kiit.ac.in', name: 'RAHUL KUMAR GUPTA' },
      { email: '21053460@kiit.ac.in', name: 'JAY PRAKASH GIRI' },
      { email: '2105005@kiit.ac.in', name: 'ADITYA PRATAP SINGH' },
      { email: '2105009@kiit.ac.in', name: 'ANKIT  MOHAPATRA' },
      { email: '2105016@kiit.ac.in', name: 'ANUSHKA  RAWAT' },
      { email: '2105027@kiit.ac.in', name: 'DEBALINA  BANDYOPADHYAY' },
      { email: '2105041@kiit.ac.in', name: 'NAVONIL  GHOSH' },
      { email: '2105075@kiit.ac.in', name: 'SUBHALAXMI  BISWAL' },
      { email: '2105089@kiit.ac.in', name: 'ABHISHEK  SONI' },
      { email: '2105100@kiit.ac.in', name: 'AMIYA  KUMARI' },
      { email: '2105152@kiit.ac.in', name: 'SAPTAK  CHAUDHURI' },
      { email: '2105164@kiit.ac.in', name: 'SOHAM  CHATTERJEE' },
      { email: '2105202@kiit.ac.in', name: 'VARUN  MAURYA' },
      { email: '2105204@kiit.ac.in', name: 'KRISHNENDU  DAS' },
      { email: '2105209@kiit.ac.in', name: 'MOHD AYAAN KHAN' },
      { email: '2105269@kiit.ac.in', name: 'AYUSH  KUREEL' },
      { email: '2105282@kiit.ac.in', name: 'MANAN  GARG' },
      { email: '2105313@kiit.ac.in', name: 'SAURABH  SHUKLA' },
      { email: '2105314@kiit.ac.in', name: 'SAYAK  LODH' },
      { email: '2105316@kiit.ac.in', name: 'SAYANTANI  RAY' },
      { email: '2105331@kiit.ac.in', name: 'SUSHANT  JAIN' },
      { email: '2105332@kiit.ac.in', name: 'SUSHANT  JHA' },
      { email: '2105375@kiit.ac.in', name: 'ISHA  DUTTA MAZUMDAR' },
      { email: '2105381@kiit.ac.in', name: 'MALOTH  RAJSHEKHAR' },
      { email: '2105410@kiit.ac.in', name: 'SOHAM RAJ JAIN' },
      { email: '2105436@kiit.ac.in', name: 'AHSAN SHAJEE AHMED' },
      { email: '2105447@kiit.ac.in', name: 'AVIRAL  KISHORE' },
      { email: '2105512@kiit.ac.in', name: 'AARYAN  TIWARI' },
      { email: '2105530@kiit.ac.in', name: 'ARUNIMA  SHANDILYA' },
      { email: '2105546@kiit.ac.in', name: 'JAGANNATH  MONDAL' },
      { email: '2105619@kiit.ac.in', name: 'DEVANSH  MISHRA' },
      { email: '2105648@kiit.ac.in', name: 'RITABAN  BANERJEE' },
      { email: '2105684@kiit.ac.in', name: 'ADITYA  CHOUDHURY' },
      { email: '2105696@kiit.ac.in', name: 'ANISH  SAHA' },
      { email: '2105701@kiit.ac.in', name: 'ARCHIT  GUPTA' },
      { email: '2105735@kiit.ac.in', name: 'RISHITA  KUNDU' },
      { email: '2105783@kiit.ac.in', name: 'AYAN  CHAKRABORTY' },
      { email: '2105806@kiit.ac.in', name: 'NEEL  JAIN' },
      { email: '2105807@kiit.ac.in', name: 'NEHA  BAJPAYEE' },
      { email: '2105809@kiit.ac.in', name: 'PRANAVA  NIHAL' },
      { email: '2105843@kiit.ac.in', name: 'SUYASH  DUTTA' },
      { email: '2105907@kiit.ac.in', name: 'SPONDAN  BANDYOPADHYAY' },
      { email: '2106069@kiit.ac.in', name: 'SHRUTI GARG' },
      { email: '2106086@kiit.ac.in', name: 'ABHIGYA  ISHAN' },
      { email: '2106173@kiit.ac.in', name: 'ABHISHEK  PANDA' },
      { email: '2106176@kiit.ac.in', name: 'ADITYA  BANKA' },
      { email: '2106202@kiit.ac.in', name: 'BIKASH KUMAR MAHANTA' },
      { email: '2106321@kiit.ac.in', name: 'ARVIND KUMAR RAI' },
      { email: '2128064@kiit.ac.in', name: 'ANIKET  SINGH' },
      { email: '2128097@kiit.ac.in', name: 'SRINIVAS  PADHI' },
      { email: '2128106@kiit.ac.in', name: 'TRIDIB KUMAR DAS' },
      { email: '2128108@kiit.ac.in', name: 'UTKARSH  NIGAM' },
      { email: '2128127@kiit.ac.in', name: 'NORBU  TSHERING  LEPCHA' },
      { email: '2129118@kiit.ac.in', name: 'SUYASH  GURU' },
      { email: '2129141@kiit.ac.in', name: 'SREEJIT  DAS' },
      { email: '21051067@kiit.ac.in', name: 'NIMISHA  MOHANTA' },
      { email: '21051071@kiit.ac.in', name: 'PRATHAM  AGRAWAL' },
      { email: '21051072@kiit.ac.in', name: 'PRAVIN  SHARMA' },
      { email: '21051074@kiit.ac.in', name: 'JYOTIRADITYA  SAMAL' },
      { email: '21051079@kiit.ac.in', name: 'RUDRA PRATAP SINGH KUSHWAH' },
      { email: '21051087@kiit.ac.in', name: 'SAYAN  BANERJEE' },
      { email: '21051094@kiit.ac.in', name: 'SHUBHAM  PATEL' },
      { email: '21051095@kiit.ac.in', name: 'SONIA  KUNDU' },
      { email: '21051113@kiit.ac.in', name: 'AHANA  BASU' },
      { email: '21051116@kiit.ac.in', name: 'AMAN  SINGH' },
      { email: '21051151@kiit.ac.in', name: 'POOJITH  PINNAMARAJU' },
      { email: '21051235@kiit.ac.in', name: 'PRIYADARSINI  MOHARANA' },
      { email: '21051251@kiit.ac.in', name: 'SATYAM  RAI' },
      { email: '21051329@kiit.ac.in', name: 'RITAV  JASH' },
      { email: '21051340@kiit.ac.in', name: 'SHRUTI  KUMARI' },
      { email: '21051416@kiit.ac.in', name: 'PUNEET  CHOUDHARY' },
      { email: '21051512@kiit.ac.in', name: 'SAYAN  MONDAL' },
      { email: '21051528@kiit.ac.in', name: 'AYUSHI  GAUTAM' },
      { email: '21051538@kiit.ac.in', name: 'ANIKET  RAUL' },
      { email: '21051548@kiit.ac.in', name: 'ARSH RAJ SINGH' },
      { email: '21051559@kiit.ac.in', name: 'VEZZU VENKATA REVANTH' },
      { email: '21051630@kiit.ac.in', name: 'ANISHA  BIRLA' },
      { email: '21051634@kiit.ac.in', name: 'ARKAPRAVA  ROY' },
      { email: '21051722@kiit.ac.in', name: 'ARITRA  DATTA' },
      { email: '21051727@kiit.ac.in', name: 'ASMITA  PATNAIK' },
      { email: '21051756@kiit.ac.in', name: 'RITUPARN  PANDA' },
      { email: '21051762@kiit.ac.in', name: 'SAYANTAN  BASAK' },
      { email: '21051771@kiit.ac.in', name: 'SRIJONI  BHATTACHARYYA' },
      { email: '21051781@kiit.ac.in', name: 'VIPASHYNA  SHARMA' },
      { email: '21051835@kiit.ac.in', name: 'PRANJAL' },
      { email: '21051909@kiit.ac.in', name: 'MOKSHADA  MOHAPATRA' },
      { email: '21051949@kiit.ac.in', name: 'SWATI  MISHRA' },
      { email: '21051974@kiit.ac.in', name: 'ANULIPI  JANA' },
      { email: '21051975@kiit.ac.in', name: 'ANURUPA  SAHA' },
      { email: '21051985@kiit.ac.in', name: 'BISAKHA  GHOSH' },
      { email: '21051998@kiit.ac.in', name: 'JVS AJITESH' },
      { email: '21052015@kiit.ac.in', name: 'ZIAUL  HODA' },
      { email: '21052066@kiit.ac.in', name: 'BITAN  SARKAR' },
      { email: '21052129@kiit.ac.in', name: 'ABHIRUP  DUTTA' },
      { email: '21052234@kiit.ac.in', name: 'APURVA KRISHNA VERMA' },
      { email: '21052260@kiit.ac.in', name: 'OM ASHOK RADE' },
      { email: '21052261@kiit.ac.in', name: 'OMMKAR  BISOI' },
      { email: '21052265@kiit.ac.in', name: 'PRITISH  MESHRAM' },
      { email: '21052301@kiit.ac.in', name: 'ADITYA  RANJAN' },
      { email: '21052303@kiit.ac.in', name: 'AMANDEEP  PARIJA' },
      { email: '21052325@kiit.ac.in', name: 'DIVYANSHU YOGESHWAR RANDIVE' },
      { email: '21052358@kiit.ac.in', name: 'SHASHANK  DEWANGAN' },
      { email: '21052373@kiit.ac.in', name: 'SWAGAT SHUBHAM DAS' },
      { email: '21052378@kiit.ac.in', name: 'VINAYAK  SRIVASTAVA' },
      { email: '21052404@kiit.ac.in', name: 'ASHUTOSH  SAHOO' },
      { email: '21052492@kiit.ac.in', name: 'DEBARGHYA  BANDYOPADHYAY' },
      { email: '21052496@kiit.ac.in', name: 'DIBAS KUMAR DE' },
      { email: '21052571@kiit.ac.in', name: 'ARJAB  CHAKRABARTI' },
      { email: '21052647@kiit.ac.in', name: 'AKSHIT  AGGARWAL' },
      { email: '21052652@kiit.ac.in', name: 'ANUBHAV  RANJAN' },
      { email: '21052654@kiit.ac.in', name: 'SANAM  SAHU' },
      { email: '21052698@kiit.ac.in', name: 'RUBELA  GOSWAMI' },
      { email: '21052734@kiit.ac.in', name: 'ANINDITA  PATNAIK' },
      { email: '21052737@kiit.ac.in', name: 'ANSHUMAN  CHAKRABORTY' },
      { email: '21052749@kiit.ac.in', name: 'BINIT  DAS' },
      { email: '21052780@kiit.ac.in', name: 'RASHID MAZHAR' },
      { email: '21052793@kiit.ac.in', name: 'SHREYANSHU  YADAV' },
      { email: '21052834@kiit.ac.in', name: 'DEV KARAN PATTNAYAK' },
      { email: '21052837@kiit.ac.in', name: 'DIBYASAI  JENA' },
      { email: '21052843@kiit.ac.in', name: 'MISBAHUR  RAHMAN' },
      { email: '21052949@kiit.ac.in', name: 'SHIBHANG  POUDEL' },
      { email: '21052964@kiit.ac.in', name: 'SOMYA RANJAN BARIK' },
      { email: '21052980@kiit.ac.in', name: 'ANSHUMAN  DAS' },
      { email: '21053222@kiit.ac.in', name: 'TANISHA  MOHAPATRA' },
      { email: '21053291@kiit.ac.in', name: 'MD MEHEDI  HASAN' },
      { email: '21053334@kiit.ac.in', name: 'KHUSHI  MANTRI' },
      { email: '21053363@kiit.ac.in', name: 'KHUSHI  KUMARI' },
      { email: '21053385@kiit.ac.in', name: 'SUSHANT NAND SINGH' },
      { email: '21053386@kiit.ac.in', name: 'DIVYARANJAN  SAHOO' },
      { email: '21053438@kiit.ac.in', name: 'PUSHKAR  NIROULA' },
      { email: '21053439@kiit.ac.in', name: 'PRASANNA  DHUNGANA' },
      { email: '21053454@kiit.ac.in', name: 'AYUSHMAN  PANTHEE' },
      { email: '22057044@kiit.ac.in', name: 'PRATAP  MAHATA' },
      { email: '2105374@kiit.ac.in', name: 'HRITOM  MALLICK' },
      { email: '2105408@kiit.ac.in', name: 'SHREYAS  NAYAK' },
      { email: '2105416@kiit.ac.in', name: 'SULAGNA  PATI' },
      { email: '2105569@kiit.ac.in', name: 'ROBINS  KUMAR' },
      { email: '2105722@kiit.ac.in', name: 'MALVIKA  NARSIPURAM' },
      { email: '2105851@kiit.ac.in', name: 'AANCHAL  CHOUDHARY' },
      { email: '2105854@kiit.ac.in', name: 'ABHIJEET  ANAND' },
      { email: '2105857@kiit.ac.in', name: 'AKASH  ACHARYA' },
      { email: '2105882@kiit.ac.in', name: 'DIVYA  BHARDWAJ' },
      { email: '2105982@kiit.ac.in', name: 'PRASHANT KUMAR ARYAN' },
      { email: '2105984@kiit.ac.in', name: 'PRITI MOHAN  PATTANAYAK' },
      { email: '2105986@kiit.ac.in', name: 'RAJ  ARYAN' },
      { email: '2106053@kiit.ac.in', name: 'RITAMBHAR  DAS' },
      { email: '2106170@kiit.ac.in', name: 'TUNEER  GOSWAMI' },
      { email: '2106187@kiit.ac.in', name: 'ANJALI  KUMARI' },
      { email: '2106191@kiit.ac.in', name: 'ARNAB  BHATTACHARJEE' },
      { email: '2106289@kiit.ac.in', name: 'VANISHA  RAI' },
      { email: '2106307@kiit.ac.in', name: 'AYUSH  SRIVASTAVA' },
      { email: '2106309@kiit.ac.in', name: 'SURYA  PRASAD' },
      { email: '2128059@kiit.ac.in', name: 'SHIVANSH SINGH CHAUHAN' },
      { email: '2129041@kiit.ac.in', name: 'AMIT KUMAR BHARTI' },
      { email: '21051027@kiit.ac.in', name: 'ADARSH  SRIVASTAVA' },
      { email: '21051173@kiit.ac.in', name: 'ADYASHA  ROSALINA' },
      { email: '21051247@kiit.ac.in', name: 'SANSKAR  SHUKLA' },
      { email: '21051483@kiit.ac.in', name: 'MADHURJYA  RABHA' },
      { email: '21051568@kiit.ac.in', name: 'ISHA  MISHRA' },
      { email: '21051641@kiit.ac.in', name: 'AVINANDAN  MITRA' },
      { email: '21051740@kiit.ac.in', name: 'MANASH  KUMAR' },
      { email: '21051791@kiit.ac.in', name: 'ADARSH  PATRO' },
      { email: '21051928@kiit.ac.in', name: 'SAYAN  KARAN' },
      { email: '21051930@kiit.ac.in', name: 'SHAGUFTA  FARHEEN' },
      { email: '21051939@kiit.ac.in', name: 'SHUBHANGI' },
      { email: '21051940@kiit.ac.in', name: 'SHYAM  KAKANI' },
      { email: '21051944@kiit.ac.in', name: 'AKSHAY  SINGH' },
      { email: '21052156@kiit.ac.in', name: 'HEMA  MALIK' },
      { email: '21052308@kiit.ac.in', name: 'ANMOL  KUMAR' },
      { email: '21052320@kiit.ac.in', name: 'DHRUV  BUDHIA' },
      { email: '21052337@kiit.ac.in', name: 'NANDINI  NAYAK' },
      { email: '21052346@kiit.ac.in', name: 'RHEA  SARAVANAN' },
      { email: '21052539@kiit.ac.in', name: 'SUBHASHREE  PANDA' },
      { email: '21052577@kiit.ac.in', name: 'BARENYA  NAYAK' },
      { email: '21052665@kiit.ac.in', name: 'HARSHITA  BARNWAL' },
      { email: '21052746@kiit.ac.in', name: 'AYAN  BERA' },
      { email: '21052784@kiit.ac.in', name: 'RUPAL YADAV' },
      { email: '21052945@kiit.ac.in', name: 'PRAMIT KUMAR SAH' },
      { email: '21052967@kiit.ac.in', name: 'PRITAM KUMAR PAL' },
      { email: '21052985@kiit.ac.in', name: 'KUMAR  SATYAM' },
      { email: '21052994@kiit.ac.in', name: 'LALKRISHNA  PATEL' },
      { email: '21053203@kiit.ac.in', name: 'KUMARI  AYUSHI' },
      { email: '21053373@kiit.ac.in', name: 'APOORAV  RAJ' },
      { email: '21053412@kiit.ac.in', name: 'JIGME   CHODEN' },
      { email: '22057032@kiit.ac.in', name: 'HARSH  PRASAD' },
      { email: '2105520@kiit.ac.in', name: 'AKSHYAYANAND  PANI' },
      { email: '2105631@kiit.ac.in', name: 'Mohak Kumar Srivastava ' },
      { email: '21052440@kiit.ac.in', name: 'RAJKUMAR  MISHRA' },
      { email: '21052808@kiit.ac.in', name: 'ADARSH \xa0KUMAR' },
      { email: '21051864@kiit.ac.in', name: 'UTKARSH  ANAND' },
      { email: '21052402@kiit.ac.in', name: 'ASHISH  SHARMA' },
      { email: '21053344@kiit.ac.in', name: 'NINAD  PARASHAR' },
      { email: '21053393@kiit.ac.in', name: 'Al  Araf' },
      { email: '2105939@kiit.ac.in', name: 'ABHIJEET KUMAR JHA' },
      { email: '2106104@kiit.ac.in', name: 'AVNISH  ANAND' },
      { email: '2128107@kiit.ac.in', name: 'UNNAT  BISWAL' },
      { email: '2129057@kiit.ac.in', name: 'ARPITA SAROJ PARIDA' },
      { email: '2129126@kiit.ac.in', name: 'YASH  ARNAV' },
      { email: '21052045@kiit.ac.in', name: 'ABHINAV KUMAR TOOFANI' },
      { email: '21053295@kiit.ac.in', name: 'Michael   Senkao' },
      { email: '22057049@kiit.ac.in', name: 'RAJKUMAR ISHANJIT SINGHA' },
      { email: '2128041@kiit.ac.in', name: 'RAUNAK MADHAB JENA' },
      { email: '2128045@kiit.ac.in', name: 'SAGNIK  DAS' },
      { email: '2128069@kiit.ac.in', name: 'ATUL  PREM' },
      { email: '21051178@kiit.ac.in', name: 'SIDDHARTH HIMANSHEE' },
      { email: '21051982@kiit.ac.in', name: 'ARYAN KUMAR SHAW' },
    ];
    const user2 = [
      {
        name: '072-GYAN PRAKASH DASH',
        email: '2128072@kiit.ac.in',
      },
      {
        name: '2610_ABHIK SAMANTA',
        email: '22052610@kiit.ac.in',
      },
      {
        name: '3256_MANIDIP MANDAL',
        email: '22053256@kiit.ac.in',
      },
      {
        name: '484_ ARKA GHOSH',
        email: '21052484@kiit.ac.in',
      },
      {
        name: 'SRINJOY PAUL',
        email: '22053990@kiit.ac.in',
      },
      {
        name: '3338_Girija Nayak',
        email: '21053338@kiit.ac.in',
      },
      {
        name: '1756_KAUSHIK BARIK',
        email: '23051756@kiit.ac.in',
      },
      {
        name: '4365_SAURAV CHAUDHARY',
        email: '22054365@kiit.ac.in',
      },
      {
        name: '468 SUGANDHA PAUL',
        email: '22051468@kiit.ac.in',
      },
      {
        name: '4043_Ghanshyam Yadav',
        email: '22054043@kiit.ac.in',
      },
      {
        name: '3257_AASUTOSH KUMAR SONY',
        email: '21053257@kiit.ac.in',
      },
      {
        name: 'SAKET SUMAN',
        email: '23052419@kiit.ac.in',
      },
      {
        name: '449 Chaitanya',
        email: '2105449@kiit.ac.in',
      },
      {
        name: 'PRATHMESH GANGARDE',
        email: '22052487@kiit.ac.in',
      },
      {
        name: 'NATASHA BAG',
        email: '2330242@kiit.ac.in',
      },
      {
        name: '832_Soumyendu Das',
        email: '2105832@kiit.ac.in',
      },
      {
        name: '3264_AJAY KHATRI CHHETRI',
        email: '21053264@kiit.ac.in',
      },
      {
        name: '3405_Anshu Gupta',
        email: '21053405@kiit.ac.in',
      },
      {
        name: '247_SOVAN “2105247” PATTANAIK',
        email: '2105247@kiit.ac.in',
      },
      {
        name: '3541_ASHMIT PATRA',
        email: '23053541@kiit.ac.in',
      },
      {
        name: '2963_AUROBINDA MISHRA',
        email: '21052963@kiit.ac.in',
      },
      {
        name: '3040_SHUBHRANIL DAS',
        email: '2303040@kiit.ac.in',
      },
      {
        name: '8130_SOUVIK BOSE',
        email: '2328130@kiit.ac.in',
      },
      {
        name: '2960_YISHAP KHANAL',
        email: '21052960@kiit.ac.in',
      },
      {
        name: 'ABHISHEK CHATTERJEE',
        email: '23051885@kiit.ac.in',
      },
      {
        name: 'PARITOSH PARITOSH',
        email: '23052007@kiit.ac.in',
      },
      {
        name: '388_PARTHIV PATNAIK',
        email: '2105388@kiit.ac.in',
      },
      {
        name: '576_SATYAJIT SATAPATHY',
        email: '2105576@kiit.ac.in',
      },
      {
        name: 'SAFIN SAMYO',
        email: '2309018@kiit.ac.in',
      },
      {
        name: '2253_SURYA SNATA MANTRI',
        email: '22052253@kiit.ac.in',
      },
      {
        name: 'SWAYAM MISHRA',
        email: '23052120@kiit.ac.in',
      },
      {
        name: '2172_VISHWAJEET KUMAR',
        email: '22052172@kiit.ac.in',
      },
      {
        name: 'SUMEET BEHERA',
        email: '2305171@kiit.ac.in',
      },
      {
        name: '5512_AARYAN TIWARI',
        email: '2105512@kiit.ac.in',
      },
      {
        name: 'DHRUV KUMAR',
        email: '22053683@kiit.ac.in',
      },
      {
        name: 'ANISHA SARANGI',
        email: '22053661@kiit.ac.in',
      },
      {
        name: '7034_INSIYA PARVEZ',
        email: '22057034@kiit.ac.in',
      },
      {
        name: '3281_Fariya Afrin',
        email: '21053281@kiit.ac.in',
      },
      {
        name: '0810_ IshitaSrivastava',
        email: '2205810@kiit.ac.in',
      },
      {
        name: '3436_ROHAN KARN',
        email: '21053436@kiit.ac.in',
      },
      {
        name: '3451_BIPIN KUMAR CHAUDHARY',
        email: '21053451@kiit.ac.in',
      },
      {
        name: '5931-SUBHADEEP DAS',
        email: '2105931@kiit.ac.in',
      },
      {
        name: '3421_Abhishek Bishwas',
        email: '21053421@kiit.ac.in',
      },
      {
        name: 'ADITYA NARAYAN',
        email: '23052701@kiit.ac.in',
      },
      {
        name: 'AAYUSH SIWACH',
        email: '22052177@kiit.ac.in',
      },
      {
        name: '1772_SUPRATIM CHAKRABORTY',
        email: '21051772@kiit.ac.in',
      },
      {
        name: 'ANIRAN SAHA',
        email: '22053137@kiit.ac.in',
      },
      {
        name: 'MOHAMMED HAROON',
        email: '2304170@kiit.ac.in',
      },
      {
        name: 'Ruby Sah',
        email: '23053910@kiit.ac.in',
      },
      {
        name: '311_SANSKRUTI DAS',
        email: '2105311@kiit.ac.in',
      },
      {
        name: '079_Nikhil Raj',
        email: '2128079@kiit.ac.in',
      },
      {
        name: '4317_Deep Chaulagain',
        email: '22054317@kiit.ac.in',
      },
      {
        name: '707_Avilasha Bhattacharyya',
        email: '2105707@kiit.ac.in',
      },
      {
        name: 'Shwetanka Jha',
        email: '22054097@kiit.ac.in',
      },
      {
        name: 'KIIT Connect',
        email: 'connectkiit@gmail.com',
      },
      {
        name: '873_HARSHIT KUMAR',
        email: '2005873@kiit.ac.in',
      },
      {
        name: '4082 ѕᴀɴᴅᴇᴇᴘツ',
        email: '22054082@kiit.ac.in',
      },
      {
        name: 'AYUSH SHRIVASTAVA',
        email: '23053760@kiit.ac.in',
      },
      {
        name: 'Deepjyoti Roy',
        email: '22051421@kiit.ac.in',
      },
      {
        name: 'ASTHA PATEL',
        email: '2205976@kiit.ac.in',
      },
      {
        name: 'PRATIK POKHREL',
        email: '23053498@kiit.ac.in',
      },
      {
        name: '501_GAUTAM SINHA',
        email: '21052501@kiit.ac.in',
      },
      {
        name: '4078 ROHIT GUPTA',
        email: '22054078@kiit.ac.in',
      },
      {
        name: '6177_Aditya Kumar Prajapati',
        email: '2106177@kiit.ac.in',
      },
      {
        name: 'PRATIK MAITY',
        email: '22052133@kiit.ac.in',
      },
      {
        name: 'SOUMYA KUMAR',
        email: '22053285@kiit.ac.in',
      },
      {
        name: 'TEJAS SONI',
        email: '22052169@kiit.ac.in',
      },
      {
        name: 'SUMIT BARDOLAI (22051807)',
        email: '22051807@kiit.ac.in',
      },
      {
        name: '4349 _Smith Rouniyar',
        email: '22054349@kiit.ac.in',
      },
      {
        name: '3403-AROSREE SATAPATHY',
        email: '22053403@kiit.ac.in',
      },
      {
        name: '120_BHAVYA SINGH',
        email: '2205120@kiit.ac.in',
      },
      {
        name: 'DEBJYOTI SHIT',
        email: '22052978@kiit.ac.in',
      },
      {
        name: '162_SHUBHAM MOHAPATRA',
        email: '2205162@kiit.ac.in',
      },
      {
        name: '2774 - SOURENDU MANDAL',
        email: '22052774@kiit.ac.in',
      },
      {
        name: '39_ADITYA Singh',
        email: '2130039@kiit.ac.in',
      },
      {
        name: 'ABHISHEK GUPTA',
        email: '22054436@kiit.ac.in',
      },
      {
        name: '3119_Chirag Sharma',
        email: '23053119@kiit.ac.in',
      },
      {
        name: '5338_SWARALIPI SAMANTA',
        email: '2205338@kiit.ac.in',
      },
      {
        name: '408 ARPITA SINGH',
        email: '22051408@kiit.ac.in',
      },
      {
        name: 'DEBDEEP SANYAL',
        email: '22052634@kiit.ac.in',
      },
      {
        name: '5890_HARSHIT SINGHANIA',
        email: '2105890@kiit.ac.in',
      },
      {
        name: '1032_SOURAV KUMAR PARIDA',
        email: '22051032@kiit.ac.in',
      },
      {
        name: 'LOKESH SINGH',
        email: '22052995@kiit.ac.in',
      },
      {
        name: 'AMAN KUMAR',
        email: '2205012@kiit.ac.in',
      },
      {
        name: '2832_OM KUMAR',
        email: '22052832@kiit.ac.in',
      },
      {
        name: 'SHAIKH SAQUIB JAMAL',
        email: '23057046@kiit.ac.in',
      },
      {
        name: '2953_SUMIT TIWARI',
        email: '21052953@kiit.ac.in',
      },
      {
        name: 'MASOOM CHOUDHURY',
        email: '22052828@kiit.ac.in',
      },
      {
        name: '2872_ADITYA_KUMAR',
        email: '22052872@kiit.ac.in',
      },
      {
        name: 'Ayush Keshri (22053413)',
        email: '22053413@kiit.ac.in',
      },
      {
        name: '182_RIDDHIMA BHANJA',
        email: '22053182@kiit.ac.in',
      },
      {
        name: '2219_Madhu Hazra',
        email: '22052219@kiit.ac.in',
      },
      {
        name: '2981- Anuska Dash',
        email: '21052981@kiit.ac.in',
      },
      {
        name: '359SACHIN RAY',
        email: '22054359@kiit.ac.in',
      },
      {
        name: '354_AKANGKSHYA',
        email: '2205354@kiit.ac.in',
      },
      {
        name: '4029_Bibek Chand',
        email: '22054029@kiit.ac.in',
      },
      {
        name: 'PRAJWAL MAINALI',
        email: '23053732@kiit.ac.in',
      },
      {
        name: '1950_Mohak Agrawal',
        email: '22051950@kiit.ac.in',
      },
      {
        name: '8134 / RONIT',
        email: '2228134@kiit.ac.in',
      },
      {
        name: '326_SHWETA KUMARI SHAH',
        email: '21053326@kiit.ac.in',
      },
      {
        name: '2224_OISHANI',
        email: '22052224@kiit.ac.in',
      },
      {
        name: '3114-SONAL KUMARI',
        email: '22053114@kiit.ac.in',
      },
      {
        name: 'Aniruddh Dubey',
        email: '2228009@kiit.ac.in',
      },
      {
        name: 'YUKTI DIXIT',
        email: '22051910@kiit.ac.in',
      },
      {
        name: 'PRANJAL SHARMA',
        email: '22054297@kiit.ac.in',
      },
      {
        name: '345_ Sonali',
        email: '21051345@kiit.ac.in',
      },
      {
        name: 'RUDRA PRABHAT PATTANAIK',
        email: '22052847@kiit.ac.in',
      },
      {
        name: '4247_ SWAGNIK CHAKRABORTY',
        email: '22054247@kiit.ac.in',
      },
      {
        name: 'PRABHAKAR SINGH',
        email: '22052914@kiit.ac.in',
      },
      {
        name: '074_ANSHUMAN GHOSH',
        email: '2206074@kiit.ac.in',
      },
      {
        name: 'OM KUMAR TRIVEDI',
        email: '2206359@kiit.ac.in',
      },
      {
        name: 'SOUMIK MANNA',
        email: '23053250@kiit.ac.in',
      },
      {
        name: '2920_ SHUBHAM KUMAR',
        email: '21052920@kiit.ac.in',
      },
      {
        name: '3225_Aniket Das',
        email: '22053225@kiit.ac.in',
      },
      {
        name: '770_Ankit Sinha',
        email: '2105770@kiit.ac.in',
      },
      {
        name: 'Swastika Datta',
        email: '22051644@kiit.ac.in',
      },
      {
        name: 'JOGADIPAN SWAIN (22053517)',
        email: '22053517@kiit.ac.in',
      },
      {
        name: '1774_NITISH KUMAR',
        email: '22051774@kiit.ac.in',
      },
      {
        name: 'TANMAYA PATRA',
        email: '22053994@kiit.ac.in',
      },
      {
        name: 'TARUN KUMAR UTTAM',
        email: '22052168@kiit.ac.in',
      },
      {
        name: 'SAHIL KUMAR',
        email: '22051784@kiit.ac.in',
      },
      {
        name: '4058_Nabin Kumar',
        email: '22054058@kiit.ac.in',
      },
      {
        name: 'SNEHA GHOSAL',
        email: '22052597@kiit.ac.in',
      },
      {
        name: '4351_SHREYA WAGLE',
        email: '22054351@kiit.ac.in',
      },
      {
        name: '1303_Swastik',
        email: '21051303@kiit.ac.in',
      },
      {
        name: 'AMIT JAISWAL',
        email: '22054273@kiit.ac.in',
      },
      {
        name: '1820_UTTKARSH ANAND',
        email: '22051820@kiit.ac.in',
      },
      {
        name: 'MOHAMMAD RIZWANUL',
        email: '22053873@kiit.ac.in',
      },
      {
        name: '771_ANKIT ANURAG SENAPATI',
        email: '2105771@kiit.ac.in',
      },
      {
        name: '264_ANKITA SENAPATI',
        email: '2105264@kiit.ac.in',
      },
      {
        name: 'AKSHAT SAXENA',
        email: '22051229@kiit.ac.in',
      },
      {
        name: '3565-ABHILASH DALAI',
        email: '22053565@kiit.ac.in',
      },
      {
        name: '739_LAKSHYA AGARWAL',
        email: '21051739@kiit.ac.in',
      },
      {
        name: '1767_SHUBHAM KUMAR SINGH',
        email: '21051767@kiit.ac.in',
      },
      {
        name: '1393_DEBANSHEE PADHI',
        email: '21051393@kiit.ac.in',
      },
      {
        name: 'RAGHAV KUMAR',
        email: '22051873@kiit.ac.in',
      },
      {
        name: 'AYAN DAS (Ayan Das_2205370)',
        email: '2205370@kiit.ac.in',
      },
      {
        name: 'KIIT University',
        email: '22054390@kiit.ac.in',
      },
      {
        name: '612 _SAMARPITA PANIGRAHY',
        email: '21052612@kiit.ac.in',
      },
      {
        name: '6284_PRIYASMITA DAS',
        email: '2206284@kiit.ac.in',
      },
      {
        name: 'UNMESHA SINGH (22053562)',
        email: '22053562@kiit.ac.in',
      },
      {
        name: 'GEETANSHI DEWANGAN',
        email: '22051336@kiit.ac.in',
      },
      {
        name: 'SUJIT PANGENI',
        email: '22054293@kiit.ac.in',
      },
      {
        name: '1518_DEEP AIND',
        email: '20051518@kiit.ac.in',
      },
      {
        name: 'ANURAG MOHAN',
        email: '22052363@kiit.ac.in',
      },
      {
        name: '9065 SHAURYA (‪Manthan‬)',
        email: '2229065@kiit.ac.in',
      },
      {
        name: 'SRITAMA MITRA_340',
        email: '2305340@kiit.ac.in',
      },
      {
        name: '4077_Ritesh Sah',
        email: '22054077@kiit.ac.in',
      },
      {
        name: '2643__KALPATARU ROY',
        email: '22052643@kiit.ac.in',
      },
      {
        name: 'PRATEEK BISWAL',
        email: '22053448@kiit.ac.in',
      },
      {
        name: '2117_SUNAINA SENAPATI',
        email: '21052117@kiit.ac.in',
      },
      {
        name: '015_Anurag Singh',
        email: '2105015@kiit.ac.in',
      },
      {
        name: 'SAMRAT JHA',
        email: '22053351@kiit.ac.in',
      },
      {
        name: '3670 ARYABRAT MISHRA',
        email: '22053670@kiit.ac.in',
      },
      {
        name: 'SATYAM RAJ',
        email: '2228054@kiit.ac.in',
      },
      {
        name: 'SANSKAR',
        email: '2005825@kiit.ac.in',
      },
      {
        name: '762_TANISHA SARKAR',
        email: '2105762@kiit.ac.in',
      },
      {
        name: 'ARYAN RAJ',
        email: '22052973@kiit.ac.in',
      },
      {
        name: '1135 AdwayLachhiramka',
        email: '22051135@kiit.ac.in',
      },
      {
        name: '1170_Shabbir Hussain',
        email: '21051170@kiit.ac.in',
      },
      {
        name: '556_Laxmikant Dwivedi',
        email: '2105556@kiit.ac.in',
      },
      {
        name: '6264_SRISHTI RUPA',
        email: '2106264@kiit.ac.in',
      },
      {
        name: '3901_SUBHANKAR MOHAPATRA',
        email: '22053901@kiit.ac.in',
      },
      {
        name: 'SAYAN HAZRA',
        email: '22053277@kiit.ac.in',
      },
      {
        name: '2628_SUNALI PATRO',
        email: '21052628@kiit.ac.in',
      },
      {
        name: 'shivam',
        email: '21051931@kiit.ac.in',
      },
      {
        name: '284_DEVNA SHARMA',
        email: '2205284@kiit.ac.in',
      },
      {
        name: '5584_UMASANKAR SAO',
        email: '2305584@kiit.ac.in',
      },
      {
        name: 'RIDDHI DEEP',
        email: '22051097@kiit.ac.in',
      },
      {
        name: '1400_KRISHNAKALI BANERJEE',
        email: '21051400@kiit.ac.in',
      },
      {
        name: '8016_BHARGAB MEDHI',
        email: '2128016@kiit.ac.in',
      },
      {
        name: '5914_Sakshi Shreya',
        email: '2105914@kiit.ac.in',
      },
      {
        name: '315_Adrish Banerjee',
        email: '2206315@kiit.ac.in',
      },
      {
        name: '1558_Subhadeep Pramanik',
        email: '22051558@kiit.ac.in',
      },
      {
        name: 'JIBITESH MOHAPATRA',
        email: '23057025@kiit.ac.in',
      },
      {
        name: '713_SRIDIP SEAL',
        email: '21052713@kiit.ac.in',
      },
      {
        name: 'PRANAV SHAH',
        email: '23053612@kiit.ac.in',
      },
      {
        name: '6101_ARNAB MANDAL',
        email: '2106101@kiit.ac.in',
      },
      {
        name: '3634_SIDDHARTH NAYAK',
        email: '22053634@kiit.ac.in',
      },
      {
        name: 'PREETI GUPTA',
        email: '23051444@kiit.ac.in',
      },
      {
        name: '596_Shruti Dutta',
        email: '21051596@kiit.ac.in',
      },
      {
        name: '2388_Akshay Kumar',
        email: '21052388@kiit.ac.in',
      },
      {
        name: '315_Rafat Tausique',
        email: '2205315@kiit.ac.in',
      },
      {
        name: 'TEJASWI KUMAR',
        email: '22052865@kiit.ac.in',
      },
      {
        name: '803 ARYAN MOHANTY',
        email: '21051803@kiit.ac.in',
      },
      {
        name: '604 SPANDAN SAHOO',
        email: '21051604@kiit.ac.in',
      },
      {
        name: 'ANANYA GHOSH',
        email: '23053362@kiit.ac.in',
      },
      {
        name: 'AASHISH MAHTO',
        email: '2306083@kiit.ac.in',
      },
      {
        name: 'SIDHARTH SETHIA',
        email: '2306363@kiit.ac.in',
      },
      {
        name: '1338_BINAYAK SHOME',
        email: '23051338@kiit.ac.in',
      },
      {
        name: '2267_ RAVI KUMAR',
        email: '21052267@kiit.ac.in',
      },
      {
        name: 'ARYAN KUMAR',
        email: '22053060@kiit.ac.in',
      },
      {
        name: '2710-ARNAB KAR',
        email: '22052710@kiit.ac.in',
      },
      {
        name: 'AASHITA DASH',
        email: '2305266@kiit.ac.in',
      },
      {
        name: 'Tabish Perwaiz',
        email: '2205686@kiit.ac.in',
      },
      {
        name: '2226_PRAGYA',
        email: '22052226@kiit.ac.in',
      },
      {
        name: '1790_SOUMIK MAITI',
        email: '23051790@kiit.ac.in',
      },
      {
        name: 'SAYANIKA GUPTA',
        email: '22051790@kiit.ac.in',
      },
      {
        name: 'BIKASH NAYAK',
        email: '22051329@kiit.ac.in',
      },
      {
        name: '088-Sinjini Sengupta',
        email: '2128088@kiit.ac.in',
      },
      {
        name: '2329 GOURAV KUMAR DAS',
        email: '21052329@kiit.ac.in',
      },
      {
        name: '104_ Swati Kapoor',
        email: '2128104@kiit.ac.in',
      },
      {
        name: 'Pratyush Kumar Shrivastava',
        email: '21051752@kiit.ac.in',
      },
      {
        name: 'DIYA AGARWAL (23052640)',
        email: '23052640@kiit.ac.in',
      },
      {
        name: '608_ RISHI SINGH',
        email: '21052608@kiit.ac.in',
      },
      {
        name: '3653_Abhishek Kushwaha',
        email: '23053653@kiit.ac.in',
      },
      {
        name: 'ANIKET DHAR',
        email: '23051570@kiit.ac.in',
      },
      {
        name: '5497_SombarnaBasu',
        email: '2305497@kiit.ac.in',
      },
      {
        name: '283_SHANTANU BASU',
        email: '2106283@kiit.ac.in',
      },
      {
        name: '139_Rohan Kumar',
        email: '2105139@kiit.ac.in',
      },
      {
        name: '407- SHRESTHA GHOSHAL',
        email: '2105407@kiit.ac.in',
      },
      {
        name: 'Ranjit Kumar Das',
        email: 'dranjitkumar16@gmail.com',
      },

      {
        name: 'RITANKAR MUKHERJEE',
        email: '22052665@kiit.ac.in',
      },
      {
        name: 'ASTHA AMRITI',
        email: '2229104@kiit.ac.in',
      },
      {
        name: '5560_ Omprakash',
        email: '2105560@kiit.ac.in',
      },
      {
        name: 'RAHUL SINGH',
        email: '23053826@kiit.ac.in',
      },
      {
        name: '2260_ OM ASHOK RADE',
        email: '21052260@kiit.ac.in',
      },
      {
        name: '1606_SUDITI SARKAR',
        email: '21051606@kiit.ac.in',
      },
      {
        name: '1706_Abhishek Mallick',
        email: '21051706@kiit.ac.in',
      },
      {
        name: '1995_ISHITA RASTOGI',
        email: '21051995@kiit.ac.in',
      },
      {
        name: 'ADITI MUKHERJEE',
        email: '22051395@kiit.ac.in',
      },
      {
        name: 'ARPIT SHARMA',
        email: '2228016@kiit.ac.in',
      },
      {
        name: '763_Uttakarsh',
        email: '2105763@kiit.ac.in',
      },
      {
        name: '649_RITIKA MISHRA',
        email: '2105649@kiit.ac.in',
      },
      {
        name: 'SIDDHARTH GOUTAM (22052415)',
        email: '22052415@kiit.ac.in',
      },
      {
        name: 'SAYAN GHOSH',
        email: '22053103@kiit.ac.in',
      },
      {
        name: '171_UTKARSH JHA',
        email: '2205171@kiit.ac.in',
      },
      {
        name: '3601_JAGANNATH TRIPATHY',
        email: '22053601@kiit.ac.in',
      },
      {
        name: 'HRISHAV RANJAN',
        email: '22053163@kiit.ac.in',
      },
      {
        name: '317_Neeladri Bandopadhyay',
        email: '22052317@kiit.ac.in',
      },
      {
        name: '4072_Priyanshu Morbaita',
        email: '22054072@kiit.ac.in',
      },
      {
        name: '5071_SHREYASH ARYAA',
        email: '2205071@kiit.ac.in',
      },
      {
        name: 'SHER CHAUDHARY',
        email: '23053574@kiit.ac.in',
      },
      {
        name: 'SOMNATH METYA',
        email: '22052598@kiit.ac.in',
      },
      {
        name: '3469_Suraj Kumar Sah',
        email: '21053469@kiit.ac.in',
      },
      {
        name: 'SOUMYADEEP MOHAPATRA',
        email: '22053723@kiit.ac.in',
      },
      {
        name: '1082_SANKALP SINHA',
        email: '21051082@kiit.ac.in',
      },
      {
        name: 'SUMAN SINGHA',
        email: '2305822@kiit.ac.in',
      },
      {
        name: '2015_Ashish Kumar',
        email: '22052015@kiit.ac.in',
      },
      {
        name: '8031_NISHANT BHARALI',
        email: '2128031@kiit.ac.in',
      },
      {
        name: 'AARNAV SHRIVASTAV',
        email: '2205001@kiit.ac.in',
      },
      {
        name: '6201_RANGIN BERA',
        email: '2206201@kiit.ac.in',
      },
      {
        name: '_2107 AYUSH',
        email: '22052107@kiit.ac.in',
      },
      {
        name: 'DILEEP KUMAR',
        email: '22054268@kiit.ac.in',
      },
      {
        name: '5569_ROBINS KUMAR',
        email: '2105569@kiit.ac.in',
      },
      {
        name: 'DEBMALYA DEBNATH',
        email: '2205895@kiit.ac.in',
      },
      {
        name: '504_Shaurya Bhargava',
        email: '2205504@kiit.ac.in',
      },
      {
        name: '4362_NISTHA Panjiyar',
        email: '22054362@kiit.ac.in',
      },
      {
        name: '204_RANJAN SHARMA',
        email: '22054204@kiit.ac.in',
      },
      {
        name: 'SWAPNIL RAJ',
        email: '22051810@kiit.ac.in',
      },
      {
        name: '2889_UTKARSH DUBEY',
        email: '21052889@kiit.ac.in',
      },
      {
        name: '537_Bidisha B Muduli',
        email: '2105537@kiit.ac.in',
      },
      {
        name: '098 _AhonaGhosh',
        email: '2105098@kiit.ac.in',
      },
      {
        name: '5643_Harsh Deep',
        email: '2205643@kiit.ac.in',
      },
      {
        name: '1366_ABHISHEK KUMAR',
        email: '21051366@kiit.ac.in',
      },
      {
        name: '553_KUMAR AYUSH',
        email: '2105553@kiit.ac.in',
      },
      {
        name: '3472_kritish Yadav',
        email: '23053472@kiit.ac.in',
      },
      {
        name: 'Shreya Bangia',
        email: '2205773@kiit.ac.in',
      },
      {
        name: '392_KAZI REZAUL KABIR RAFI',
        email: '21053392@kiit.ac.in',
      },
      {
        name: 'AYUSH KUMAR',
        email: '22052891@kiit.ac.in',
      },
      {
        name: 'Chris Wilson',
        email: '2205893@kiit.ac.in',
      },
      {
        name: '8180 ARUP PATRA',
        email: '2228180@kiit.ac.in',
      },
      {
        name: '4329_ROSHAN KUMAR SINGH',
        email: '22054329@kiit.ac.in',
      },
      {
        name: '2042_RIDDHIMA BISWAS',
        email: '22052042@kiit.ac.in',
      },
      {
        name: '1714 Rajat Sinha',
        email: '22051714@kiit.ac.in',
      },
      {
        name: '383_ ISHA',
        email: '2205383@kiit.ac.in',
      },
      {
        name: 'KOUSTAV MOHAPATRA',
        email: '2229121@kiit.ac.in',
      },
      {
        name: 'PRASOON MISHRA',
        email: '2230182@kiit.ac.in',
      },
      {
        name: 'TARUN SAI NATH (22053560)',
        email: '22053560@kiit.ac.in',
      },
      {
        name: '2295_SYED FAISAL',
        email: '21052295@kiit.ac.in',
      },
      {
        name: '3062_ASHISH POTHAL',
        email: '22053062@kiit.ac.in',
      },
      {
        name: 'MALAY',
        email: '22051863@kiit.ac.in',
      },
      {
        name: '4384_Sonu Thakur Lohar',
        email: '22054384@kiit.ac.in',
      },
      {
        name: '1002_SHANTANU TRIPATHI',
        email: '21051002@kiit.ac.in',
      },
      {
        name: '1135_ Harshit KUMAR PANDEY',
        email: '21051135@kiit.ac.in',
      },
      {
        name: '225_PARAYUSH SWAMI',
        email: '2205225@kiit.ac.in',
      },
      {
        name: 'ISHA',
        email: '22052985@kiit.ac.in',
      },
      {
        name: '690_Amit Kumar Yadav',
        email: '2105690@kiit.ac.in',
      },
      {
        name: 'ABHIJEET SAHU',
        email: '22053917@kiit.ac.in',
      },
      {
        name: '118_AYUSH RANJAN',
        email: '2205118@kiit.ac.in',
      },
      {
        name: 'RUDRANEEL SANNIGRAHI',
        email: '22051606@kiit.ac.in',
      },
      {
        name: 'ADITYA CHANDEL',
        email: '2305678@kiit.ac.in',
      },
      {
        name: 'TANA BALLOVE_3830',
        email: '23053830@kiit.ac.in',
      },
      {
        name: '3594_BRAHMANANDA SAHOO',
        email: '22053594@kiit.ac.in',
      },
      {
        name: 'UTSAV SANYAL',
        email: '22053122@kiit.ac.in',
      },
      {
        name: '286_Guneet Kaur',
        email: '2205286@kiit.ac.in',
      },
      {
        name: '270_RAJDEEP SAHA',
        email: '2230270@kiit.ac.in',
      },
      {
        name: '210_SUBHADIPDAS',
        email: '2230210@kiit.ac.in',
      },
      {
        name: '3263_ABU SAID AKUNJI',
        email: '21053263@kiit.ac.in',
      },
      {
        name: 'DIKSHITA DAS',
        email: '2205980@kiit.ac.in',
      },
      {
        name: 'PRITAM HAZRA',
        email: '22053088@kiit.ac.in',
      },
      {
        name: '1871_PRIYANSHU RAJ',
        email: '22051871@kiit.ac.in',
      },
      {
        name: '098_ALYONA ROUT',
        email: '2205098@kiit.ac.in',
      },
      {
        name: '3463_ANUJ PRAJAPATI',
        email: '21053463@kiit.ac.in',
      },
      {
        name: '637 ABHAY',
        email: '21052637@kiit.ac.in',
      },
      {
        name: '1866_Vikrant Singh',
        email: '21051866@kiit.ac.in',
      },
      {
        name: '3575_ANAND AYUSHMAN DAS',
        email: '22053575@kiit.ac.in',
      },
      {
        name: '583_SOUVIK BASAK',
        email: '2105583@kiit.ac.in',
      },
      {
        name: '571_ADHYAN AGRAWAL',
        email: '21051571@kiit.ac.in',
      },
      {
        name: '691_Amritansh Jai Singh',
        email: '2105691@kiit.ac.in',
      },
      {
        name: '3420_RANJIT KUMAR DAS',
        email: '21053420@kiit.ac.in',
      },
      {
        name: '334_SRISHTI JAISWAL',
        email: '2205334@kiit.ac.in',
      },
      {
        name: '1085_SATYA PRAKASH',
        email: '21051085@kiit.ac.in',
      },
      {
        name: '364_Sugam Pudasain',
        email: '22054364@kiit.ac.in',
      },
      {
        name: 'SATYAM SUBHAM (22053543)',
        email: '22053543@kiit.ac.in',
      },
      {
        name: 'SWAGATO DE',
        email: '22053119@kiit.ac.in',
      },
      {
        name: '2200_Subhankar Ghosh',
        email: '21052200@kiit.ac.in',
      },
      {
        name: 'SOURAV KUMAR',
        email: '22053117@kiit.ac.in',
      },
      {
        name: '572_SAKSHI',
        email: '2105572@kiit.ac.in',
      },
      {
        name: '1976_ ARCHI PRIYAM',
        email: '21051976@kiit.ac.in',
      },
      {
        name: '5578_Shameik Dutta',
        email: '2105578@kiit.ac.in',
      },
      {
        name: 'SAI HARSHA',
        email: '2229149@kiit.ac.in',
      },
      {
        name: 'TANIYA SHAH',
        email: '22054454@kiit.ac.in',
      },
      {
        name: '477_Raghav Mehta',
        email: '2105477@kiit.ac.in',
      },
      {
        name: '5966_ Ishika Dalai',
        email: '2105966@kiit.ac.in',
      },
      {
        name: '1208_THAKUR_ ADITYA',
        email: '22051208@kiit.ac.in',
      },
      {
        name: '055_Arnav Sagar',
        email: '2129055@kiit.ac.in',
      },
      {
        name: 'AASHRAYA KHANAL',
        email: '23053751@kiit.ac.in',
      },
      {
        name: '2250_Subhajit Mazumdar',
        email: '22052250@kiit.ac.in',
      },
      {
        name: '1755_ Rehan Quadary',
        email: '21051755@kiit.ac.in',
      },
      {
        name: '137_KUMAR HARSH',
        email: '2205137@kiit.ac.in',
      },
      {
        name: '4393_Sanjana Kumari Thakur',
        email: '22054393@kiit.ac.in',
      },
      {
        name: 'dreach',
        email: 'dreach.service@gmail.com',
      },
      {
        name: 'Soumyadeep Kundu',
        email: '2305820@kiit.ac.in',
      },
      {
        name: '288_ISHAN KURNAL',
        email: '2205288@kiit.ac.in',
      },
      {
        name: 'RUDRA SANKHA',
        email: '22051880@kiit.ac.in',
      },
      {
        name: '384_ISHIKA DUBEY',
        email: '2205384@kiit.ac.in',
      },
      {
        name: '4061_Nirajan Shah',
        email: '22054061@kiit.ac.in',
      },
      {
        name: 'Ranjit Das',
        email: 'dasr6565667@gmail.com',
      },
      {
        name: 'Sriansh S',
        email: '2328208@kiit.ac.in',
      },
      {
        name: '4066 - Aditi Roy',
        email: '2304066@kiit.ac.in',
      },
      {
        name: '5450_CHINMAY KUMAR OJHA',
        email: '2105450@kiit.ac.in',
      },
      {
        name: 'Priyanshu Gupta',
        email: '2105393@kiit.ac.in',
      },
      {
        name: '3320_Saurav Devkota',
        email: '21053320@kiit.ac.in',
      },
      {
        name: 'DIVYANSHU GUPTA',
        email: '2205899@kiit.ac.in',
      },
      {
        name: 'Roshan Sisodia',
        email: '21052611@kiit.ac.in',
      },
      {
        name: 'SHILKY DWIVEDI',
        email: '22052058@kiit.ac.in',
      },
      {
        name: '7060 VINEET MEHER',
        email: '23057060@kiit.ac.in',
      },
      {
        name: '2310_APOORVA GAURAV TIWARI',
        email: '21052310@kiit.ac.in',
      },
      {
        name: '2723_AASHISH SAHU',
        email: '21052723@kiit.ac.in',
      },
      {
        name: '3258_Aayush Sinha',
        email: '21053258@kiit.ac.in',
      },
      {
        name: '408_Sahil Roy Chowdhury',
        email: '2205408@kiit.ac.in',
      },
      {
        name: '1720_ARGHYA ROOPAM BEHERA',
        email: '21051720@kiit.ac.in',
      },
      {
        name: '2193_ Aparna Sinha',
        email: '22052193@kiit.ac.in',
      },
      {
        name: '524_ADITI GUPTA',
        email: '2205524@kiit.ac.in',
      },
      {
        name: '2959_Unik Dahal',
        email: '21052959@kiit.ac.in',
      },
      {
        name: '1899_K SMARAN SAI',
        email: '21051899@kiit.ac.in',
      },
      {
        name: '2568_PRITAM KARMAKAR',
        email: '22052568@kiit.ac.in',
      },
      {
        name: '3066_D. SRI SATYA',
        email: '22053066@kiit.ac.in',
      },
      {
        name: 'ABHISHEK KUMAR MISHRA',
        email: '22054286@kiit.ac.in',
      },
      {
        name: '8010_AMAN GUPTA',
        email: '2128010@kiit.ac.in',
      },
      {
        name: '2012_PRIYANSHU',
        email: '21052012@kiit.ac.in',
      },
      {
        name: '2592_SHIVIKA AGARWAL',
        email: '22052592@kiit.ac.in',
      },
      {
        name: '2036_SUPRITI PARIA',
        email: '21052036@kiit.ac.in',
      },
      {
        name: '155_PRIYANSHU SINGH CHAUHAN',
        email: '21051155@kiit.ac.in',
      },
      {
        name: '714_SRINJOY SUR',
        email: '21052714@kiit.ac.in',
      },
      {
        name: '697-Aditya GUPTA',
        email: '22052697@kiit.ac.in',
      },
      {
        name: 'TUSHAR MITRA (1815_Tushar)',
        email: '22051815@kiit.ac.in',
      },
      {
        name: '595_KAVYA PRIYADARSHI',
        email: '21052595@kiit.ac.in',
      },
      {
        name: 'THOTA KARTHIKEYA',
        email: '22052519@kiit.ac.in',
      },
      {
        name: '1759_SAKSHI',
        email: '21051759@kiit.ac.in',
      },
      {
        name: '2423',
        email: '21052423@kiit.ac.in',
      },
      {
        name: 'DEVIPRASAD Nayak',
        email: '2105119@kiit.ac.in',
      },
      {
        name: 'PREETAM GIRI',
        email: '23051363@kiit.ac.in',
      },
      {
        name: '2945_ PRAMIT KUMAR SAH',
        email: '21052945@kiit.ac.in',
      },
      {
        name: 'RAHUL ROY',
        email: '22052574@kiit.ac.in',
      },
      {
        name: '741_SAMRIDDHA',
        email: '2105741@kiit.ac.in',
      },
      {
        name: '596-KOUSHIKI BOSE',
        email: '21052596@kiit.ac.in',
      },
      {
        name: '8140_KRISHNA',
        email: '2328140@kiit.ac.in',
      },
      {
        name: 'NIDHIRR AGRAWAL',
        email: '2205305@kiit.ac.in',
      },
      {
        name: '3267_ANAMOL KALWAR',
        email: '21053267@kiit.ac.in',
      },
      {
        name: '831_SOHAM PATRA',
        email: '2105831@kiit.ac.in',
      },
      {
        name: '290_Samarth Singh Rawat',
        email: '2206290@kiit.ac.in',
      },
      {
        name: 'Abhishek Yadav',
        email: '21052469@kiit.ac.in',
      },
      {
        name: 'KUMAR ANURAG',
        email: '22052907@kiit.ac.in',
      },
      {
        name: 'PRIYANSHU ARYAN PANDA',
        email: '2305798@kiit.ac.in',
      },
      {
        name: 'SUBHRANIL ROY',
        email: '22052513@kiit.ac.in',
      },
      {
        name: 'REHAAN PAUL',
        email: '23052094@kiit.ac.in',
      },
      {
        name: 'MASHEERA AFRIN',
        email: '22051348@kiit.ac.in',
      },
      {
        name: '490_RAGHAV BAJAJ',
        email: '2205490@kiit.ac.in',
      },
      {
        name: '4423_Sambhavi Choudhary',
        email: '22054423@kiit.ac.in',
      },
      {
        name: '5671_SHAFAQUE AKHTAR',
        email: '2205671@kiit.ac.in',
      },
      {
        name: 'ANULA MISHRA',
        email: '2305843@kiit.ac.in',
      },
      {
        name: '360 ARCHITAA SWAIN',
        email: '21053360@kiit.ac.in',
      },
      {
        name: '3558_SUSHREE SUCHARITA BEHERA',
        email: '22053558@kiit.ac.in',
      },
      {
        name: '4231_SHIVAM SHAH',
        email: '22054231@kiit.ac.in',
      },
      {
        name: '1393_AASHAY RISHURAJ',
        email: '22051393@kiit.ac.in',
      },
      {
        name: '607_ARPIT SAHU',
        email: '2105607@kiit.ac.in',
      },
      {
        name: 'ANANYA PODDAR',
        email: '2307007@kiit.ac.in',
      },
      {
        name: '2886_Tanisha Samantaray',
        email: '21052886@kiit.ac.in',
      },
      {
        name: '577_ Barenya',
        email: '21052577@kiit.ac.in',
      },
      {
        name: '2025_GOURAB PAL',
        email: '22052025@kiit.ac.in',
      },
      {
        name: '1020_VINEET KUMAR',
        email: '21051020@kiit.ac.in',
      },
      {
        name: '2244_ Sohini',
        email: '22052244@kiit.ac.in',
      },
      {
        name: '3605_LINGAM TANMAI',
        email: '22053605@kiit.ac.in',
      },
      {
        name: 'Isha Mishra',
        email: '21051568@kiit.ac.in',
      },
      {
        name: 'M RAO',
        email: '2329042@kiit.ac.in',
      },
      {
        name: 'AKARSHAN DAS',
        email: '22051489@kiit.ac.in',
      },
      {
        name: 'KUNAL SAW',
        email: '22051344@kiit.ac.in',
      },
      {
        name: '846_UTKAL SAHOO',
        email: '2105846@kiit.ac.in',
      },
      {
        name: '6307-Tufan Dey',
        email: '2206307@kiit.ac.in',
      },
      {
        name: '1945 ツ KUSHAGRA SRIVASTAVA',
        email: '22051945@kiit.ac.in',
      },
      {
        name: 'DHRUV GORAI',
        email: '22052551@kiit.ac.in',
      },
      {
        name: 'SHREYANK DUTTA',
        email: '23053399@kiit.ac.in',
      },
      {
        name: '6260_ SOUMYASHREE SAHOO',
        email: '2106260@kiit.ac.in',
      },
      {
        name: 'SANTOSH SAH',
        email: '23053926@kiit.ac.in',
      },
      {
        name: '1859_Swapnil',
        email: '21051859@kiit.ac.in',
      },
      {
        name: '2269_RIYA SINGH',
        email: '21052269@kiit.ac.in',
      },
      {
        name: 'GAUTAM PRASAD',
        email: '22054252@kiit.ac.in',
      },
      {
        name: 'SOHON SEN',
        email: '2304122@kiit.ac.in',
      },
      {
        name: '4154 - AMAN RAJ',
        email: '22054154@kiit.ac.in',
      },
      {
        name: '790_PRITISH BHAWAL',
        email: '2105790@kiit.ac.in',
      },
      {
        name: '8040_Rajshekhar Ghosh',
        email: '2128040@kiit.ac.in',
      },
      {
        name: '1373- ANINDYA BAG',
        email: '21051373@kiit.ac.in',
      },
      {
        name: '4124 BABLI SAHU',
        email: '22054124@kiit.ac.in',
      },
      {
        name: '5819_Ritika Singh (2105819)',
        email: '2105819@kiit.ac.in',
      },
      {
        name: 'SOUVIK DEBNATH',
        email: '23057050@kiit.ac.in',
      },
      {
        name: 'SIYONA JENA',
        email: '2205681@kiit.ac.in',
      },
      {
        name: '6071_ Shubhojit',
        email: '2106071@kiit.ac.in',
      },
      {
        name: '3276_BIKSHIT KUMAR GUPTA',
        email: '21053276@kiit.ac.in',
      },
      {
        name: '719_HIMANSHU MOHANTY',
        email: '2105719@kiit.ac.in',
      },
      {
        name: '802_Kaustav Mitra',
        email: '2105802@kiit.ac.in',
      },
      {
        name: '374_DEVAGYA SINGH',
        email: '2205374@kiit.ac.in',
      },
      {
        name: '730-ISHU KANT',
        email: '22052730@kiit.ac.in',
      },
      {
        name: 'Shubham Singh',
        email: '2229202@kiit.ac.in',
      },
      {
        name: '703_SATWIK SINGH',
        email: '21052703@kiit.ac.in',
      },
      {
        name: '5991_RUNGSHIT SAHA',
        email: '2105991@kiit.ac.in',
      },
      {
        name: '581_Prachurjya Rani Dowarah',
        email: '21051581@kiit.ac.in',
      },
      {
        name: '1132 ADITYA HAZRA',
        email: '22051132@kiit.ac.in',
      },
      {
        name: '5925_ Shinjini Chatterjee',
        email: '2105925@kiit.ac.in',
      },
      {
        name: '5153_SAUJANYA CHANDRAKAR',
        email: '2105153@kiit.ac.in',
      },
      {
        name: '71_TANU SINGH',
        email: '22051471@kiit.ac.in',
      },
      {
        name: '2905-HARSH SINGH',
        email: '21052905@kiit.ac.in',
      },
      {
        name: '1990_SURYASNATA PAITAL',
        email: '22051990@kiit.ac.in',
      },
      {
        name: '1360_ Yashi Gupta',
        email: '21051360@kiit.ac.in',
      },
      {
        name: '3612_PRAGYADIPTA PRADHAN',
        email: '22053612@kiit.ac.in',
      },
      {
        name: 'SARTHAK DAS',
        email: '22053716@kiit.ac.in',
      },
      {
        name: '2095_BARSHIT CHIRAG',
        email: '21052095@kiit.ac.in',
      },
      {
        name: '2754_ “‪21052754_Dhairya Agarwal‬” Dhairya AGARWAL',
        email: '21052754@kiit.ac.in',
      },
      {
        name: '238_SARVANSH',
        email: '2205238@kiit.ac.in',
      },
      {
        name: '1410_NILAY SHUKLA',
        email: '21051410@kiit.ac.in',
      },
      {
        name: 'SOMNATH MAHAPATRA',
        email: '23052676@kiit.ac.in',
      },
      {
        name: '1160_HARSH PRASAD',
        email: '22051160@kiit.ac.in',
      },
      {
        name: 'PANKHURI SOLANKI',
        email: '22051355@kiit.ac.in',
      },
      {
        name: '852 SUBHAM MOHANTY',
        email: '21051852@kiit.ac.in',
      },
      {
        name: '5944_ Akshat Srivastava',
        email: '2105944@kiit.ac.in',
      },
      {
        name: 'Anurag Singh',
        email: '21052143@kiit.ac.in',
      },
      {
        name: '017_ARGHADEEP SAHA',
        email: '2105017@kiit.ac.in',
      },
      {
        name: '2969_ AARNAV Kumar',
        email: '21052969@kiit.ac.in',
      },
      {
        name: '784_Ayesha Mohanty',
        email: '2105784@kiit.ac.in',
      },
      {
        name: '3408_Pramity Majumder',
        email: '23053408@kiit.ac.in',
      },
      {
        name: '2286_SOURODEEP KUNDU',
        email: '21052286@kiit.ac.in',
      },
      {
        name: '8045_Rahul Srivastava',
        email: '2228045@kiit.ac.in',
      },
      {
        name: '458 _SWARNADEEP GHOSAL',
        email: '21052458@kiit.ac.in',
      },
      {
        name: 'TANIYA CHOUHAN',
        email: '23053317@kiit.ac.in',
      },
      {
        name: '3271_ASIF MAHMUD SHUVRO',
        email: '21053271@kiit.ac.in',
      },
      {
        name: 'NABIN PAUDEL',
        email: '23053747@kiit.ac.in',
      },
      {
        name: '587_TANISHQ CHAURASIA',
        email: '2105587@kiit.ac.in',
      },
      {
        name: '698_Ankur Borah',
        email: '2105698@kiit.ac.in',
      },
      {
        name: '2181_S KHUSHI',
        email: '21052181@kiit.ac.in',
      },
      {
        name: '6196_AVIRUP PARIA',
        email: '2106196@kiit.ac.in',
      },
      {
        name: '2939_Bibhuti ADHIKARI',
        email: '21052939@kiit.ac.in',
      },
      {
        name: 'Anurag Bhattacharjee',
        email: '22051925@kiit.ac.in',
      },
      {
        name: '606_KUNAL PANIGRAHI',
        email: '2105606@kiit.ac.in',
      },
      {
        name: '1001_Shakib Mazumder',
        email: '21051001@kiit.ac.in',
      },
      {
        name: '598_ABHISHEK KUMAR',
        email: '2105598@kiit.ac.in',
      },
      {
        name: 'VINIT AGARWAL',
        email: '21051275@kiit.ac.in',
      },
      {
        name: '2637_GAURAV YADAV',
        email: '22052637@kiit.ac.in',
      },
      {
        name: '1634_SWAYAM DAS',
        email: '23051634@kiit.ac.in',
      },
      {
        name: 'Abhishek Jha',
        email: '2229195@kiit.ac.in',
      },
      {
        name: 'PAWAN SINGH',
        email: '23053768@kiit.ac.in',
      },
      {
        name: 'PRIYANSHU RANJAN',
        email: '22052571@kiit.ac.in',
      },
      {
        name: 'CHHAGAN RAM CHOUDHARY',
        email: '2106110@kiit.ac.in',
      },
      {
        name: '3442_ Supreet Shah',
        email: '21053442@kiit.ac.in',
      },
      {
        name: '1743_MAYUKH BANIK',
        email: '21051743@kiit.ac.in',
      },
      {
        name: '1784_Yash Priyadarshi',
        email: '21051784@kiit.ac.in',
      },
      {
        name: '7033_ HIRANMAYEE',
        email: '22057033@kiit.ac.in',
      },
      {
        name: 'AYUSH KUMAR',
        email: '22051065@kiit.ac.in',
      },
      {
        name: '192_DIKSHIKA DWEEPANITA',
        email: '2105192@kiit.ac.in',
      },
      {
        name: 'Eshaan Modh',
        email: '21051991@kiit.ac.in',
      },
      {
        name: '3943 DEEPSHIKHA GHOSH',
        email: '22053943@kiit.ac.in',
      },
      {
        name: '5091Pandey Aditi',
        email: '2105091@kiit.ac.in',
      },
      {
        name: '3450_ Rahul Kumar Gupta',
        email: '21053450@kiit.ac.in',
      },
      {
        name: '212_NIRMALLYA DUTTA',
        email: '2105212@kiit.ac.in',
      },
      {
        name: '218_ joyee',
        email: '2106218@kiit.ac.in',
      },
      {
        name: '530_BISWA RANJAN MOHANTY',
        email: '21052530@kiit.ac.in',
      },
      {
        name: '2216_ABHISHEK ANAND',
        email: '21052216@kiit.ac.in',
      },
      {
        name: '6227_MONIKANCHAN CHATTERJEE',
        email: '2106227@kiit.ac.in',
      },
      {
        name: '383_NIRMAL KUMAR GUPTA',
        email: '21053383@kiit.ac.in',
      },
      {
        name: '296_KRISHNA GULATI',
        email: '2205296@kiit.ac.in',
      },
      {
        name: '3732 SWASTIK PRADHAN',
        email: '22053732@kiit.ac.in',
      },
      {
        name: '329_SUDIP CHAKRABARTY',
        email: '21053329@kiit.ac.in',
      },
      {
        name: 'SHASHWAT DEVAN',
        email: '2229159@kiit.ac.in',
      },
      {
        name: '3651-VIKAS PRIYADARSHI (3651-Vikas Priyadarshi)',
        email: '22053651@kiit.ac.in',
      },
      {
        name: '1898_SRINJOY KUNDU',
        email: '22051898@kiit.ac.in',
      },
      {
        name: '419 Chiranjib Muduli',
        email: '22051419@kiit.ac.in',
      },
      {
        name: '145_Arani Maity',
        email: '22053145@kiit.ac.in',
      },
      {
        name: '613_Samyantak Mukherjee',
        email: '21052613@kiit.ac.in',
      },
      {
        name: 'RAJBIR SINGH',
        email: '22053705@kiit.ac.in',
      },
      {
        name: '1715_ANUBHUTI PRERNA',
        email: '21051715@kiit.ac.in',
      },
      {
        name: '580_SHATADRU BANERJEE',
        email: '2105580@kiit.ac.in',
      },
      {
        name: '2385_ADVAY HANI',
        email: '21052385@kiit.ac.in',
      },
      {
        name: '714_ KERKETTA',
        email: '21051714@kiit.ac.in',
      },
      {
        name: '386_Kashish',
        email: '2205386@kiit.ac.in',
      },
      {
        name: '383-MANSHI PRATAP',
        email: '2105383@kiit.ac.in',
      },
      {
        name: 'ANURAG RAY CHAUDHURI',
        email: '2205449@kiit.ac.in',
      },
      {
        name: '6277_ADITYA KAMAL',
        email: '2106277@kiit.ac.in',
      },
      {
        name: '2026-SHEKHAR MAJHI',
        email: '21052026@kiit.ac.in',
      },
      {
        name: '392_PRIYADARSHI ABHISHEK',
        email: '2105392@kiit.ac.in',
      },
      {
        name: 'MANU GUPTA',
        email: '22051347@kiit.ac.in',
      },
      {
        name: 'Saharsh Pandey',
        email: '22051881@kiit.ac.in',
      },
      {
        name: '1480_AAYUSHI AWASTHI',
        email: '22051480@kiit.ac.in',
      },
      {
        name: '5816_KESHAV NARAYAN RATH',
        email: '2205816@kiit.ac.in',
      },
      {
        name: 'DEBJEET PRAMANIK',
        email: '2205979@kiit.ac.in',
      },
      {
        name: '2648_ANEESHA',
        email: '21052648@kiit.ac.in',
      },
      {
        name: '2142_ANUNAY KUMAR',
        email: '21052142@kiit.ac.in',
      },
      {
        name: '3455_sanjay sah',
        email: '21053455@kiit.ac.in',
      },
      {
        name: '602_MOHIDDIN SHAIK',
        email: '21052602@kiit.ac.in',
      },
      {
        name: 'NOOR HASSAN BADSAH',
        email: '22051700@kiit.ac.in',
      },
      {
        name: '100_Amiya Kumari',
        email: '2105100@kiit.ac.in',
      },
      {
        name: '1505_SAIM',
        email: '21051505@kiit.ac.in',
      },
      {
        name: '3983_SHREYA CHAKRABORTY',
        email: '22053983@kiit.ac.in',
      },
      {
        name: 'AISWARYA AYASKANT',
        email: '22053658@kiit.ac.in',
      },
      {
        name: '9118_SUYASH GURU',
        email: '2129118@kiit.ac.in',
      },
      {
        name: '689 AMARJEET_GHOSH',
        email: '2105689@kiit.ac.in',
      },
      {
        name: '9043_ANIKA PRAKASH',
        email: '2129043@kiit.ac.in',
      },
      {
        name: '133 _ Adway Pratap',
        email: '2129133@kiit.ac.in',
      },
      {
        name: '1103_YASHDEEP',
        email: '21051103@kiit.ac.in',
      },
      {
        name: '417-SUSMITA PAL',
        email: '2105417@kiit.ac.in',
      },
      {
        name: 'KANISHK DADHICH',
        email: '2205042@kiit.ac.in',
      },
      {
        name: '322_SIDHARTHA KUMAR DAS',
        email: '2105322@kiit.ac.in',
      },
      {
        name: '2857_PRIYANSU MOHANTY',
        email: '21052857@kiit.ac.in',
      },
      {
        name: '2173_Raj Ratan',
        email: '21052173@kiit.ac.in',
      },
      {
        name: '5989_RINKESH KUMAR SINHA',
        email: '2105989@kiit.ac.in',
      },
      {
        name: '5495_SHRUTI KUMARI',
        email: '2105495@kiit.ac.in',
      },
      {
        name: '5920_SARTHAK MOHANTY',
        email: '2105920@kiit.ac.in',
      },
      {
        name: '515_ PRATYUSH PANY',
        email: '21052515@kiit.ac.in',
      },
      {
        name: 'Dhairya Shekhar',
        email: '21052662@kiit.ac.in',
      },
      {
        name: '748_Sayan Chattopadhyay',
        email: '2105748@kiit.ac.in',
      },
      {
        name: '2151_Chetan Dev Maskara',
        email: '21052151@kiit.ac.in',
      },
      {
        name: '3818 SUBHAM MOHARANA',
        email: '22053818@kiit.ac.in',
      },
      {
        name: 'SUMIT KRISHNA',
        email: '2205946@kiit.ac.in',
      },
      {
        name: '2628_AyushKumar',
        email: '22052628@kiit.ac.in',
      },
      {
        name: '4038_Devraj',
        email: '22054038@kiit.ac.in',
      },
      {
        name: '750_Piyush',
        email: '21051750@kiit.ac.in',
      },
      {
        name: '2302_ADITYA SHUKLA',
        email: '21052302@kiit.ac.in',
      },
      {
        name: 'SANJIV KUMAR',
        email: '22054265@kiit.ac.in',
      },
      {
        name: '073_SRITAM DUTTA',
        email: '2105073@kiit.ac.in',
      },
      {
        name: '065_SAURAV KUMAR',
        email: '2105065@kiit.ac.in',
      },
      {
        name: 'ADITI SINHA',
        email: '22051046@kiit.ac.in',
      },
      {
        name: '2048_ Sachidananda Patra',
        email: '22052048@kiit.ac.in',
      },
      {
        name: '2133_ Adrita Mohanty',
        email: '21052133@kiit.ac.in',
      },
      {
        name: '2128_ Abhinav Rapartiwar',
        email: '21052128@kiit.ac.in',
      },
      {
        name: '735_ANKIT KUMAR',
        email: '21051735@kiit.ac.in',
      },
      {
        name: '1191_SANKALP SINGH',
        email: '22051191@kiit.ac.in',
      },
      {
        name: '777-TANVI GARNAYAK',
        email: '21051777@kiit.ac.in',
      },
      {
        name: '663_SHEETAL SAHOO',
        email: '2105663@kiit.ac.in',
      },
      {
        name: '1426 - Shirsha Chakraborty',
        email: '21051426@kiit.ac.in',
      },
      {
        name: '1650_GOWTHAM DAS',
        email: '21051650@kiit.ac.in',
      },
      {
        name: '2700_SAKSHAM SHARMA',
        email: '21052700@kiit.ac.in',
      },
      {
        name: '4035_Chiranjibi Sah',
        email: '22054035@kiit.ac.in',
      },
      {
        name: '4039_Dipta Dhar',
        email: '22054039@kiit.ac.in',
      },
      {
        name: '038_Mohit Yadav',
        email: '2105038@kiit.ac.in',
      },
      {
        name: '700_Archisha Verma',
        email: '2105700@kiit.ac.in',
      },
      {
        name: '239 PANKHURI KUMARI',
        email: '2105239@kiit.ac.in',
      },
      {
        name: 'VISHALAKSHI KUMARI',
        email: '22054003@kiit.ac.in',
      },
      {
        name: '3466_UTKARSH SHRESTHA',
        email: '21053466@kiit.ac.in',
      },
      {
        name: '3319_SAPTHAK MOHAJON TURJYA',
        email: '21053319@kiit.ac.in',
      },
      {
        name: 'DEEPAYAN DAS',
        email: '2205635@kiit.ac.in',
      },
      {
        name: 'SOUMYA',
        email: '22052419@kiit.ac.in',
      },
      {
        name: '368_ASHUTOSH JHA',
        email: '2205368@kiit.ac.in',
      },
      {
        name: '8059_Aarsi Singh',
        email: '2328059@kiit.ac.in',
      },
      {
        name: '_5935_SHUBAM CHAKRABORTY',
        email: '2205935@kiit.ac.in',
      },
      {
        name: '400_ ROHIT NAYAK',
        email: '2105400@kiit.ac.in',
      },
      {
        name: '548_Kajal Kashyap',
        email: '2105548@kiit.ac.in',
      },
      {
        name: '4015_ Anil',
        email: '22054015@kiit.ac.in',
      },
      {
        name: '2499_ Raghavendra',
        email: '22052499@kiit.ac.in',
      },
      {
        name: 'Bibhukalyani',
        email: '2105787@kiit.ac.in',
      },
      {
        name: '860 Ananya',
        email: '2105860@kiit.ac.in',
      },
      {
        name: '1452_ADITYA RAJ',
        email: '21051452@kiit.ac.in',
      },
      {
        name: '1676_ Rishi',
        email: '21051676@kiit.ac.in',
      },
      {
        name: '3398_Rishav Jha',
        email: '21053398@kiit.ac.in',
      },
      {
        name: '2454_SOUMYA RANJAN SAMAL',
        email: '21052454@kiit.ac.in',
      },
      {
        name: '569_Anushree',
        email: '21052569@kiit.ac.in',
      },
      {
        name: '978_PALLAVI',
        email: '2105978@kiit.ac.in',
      },
      {
        name: '066-SHAKSHI KUMARI',
        email: '2105066@kiit.ac.in',
      },
      {
        name: '3926_Arnab Bhattacharya',
        email: '22053926@kiit.ac.in',
      },
      {
        name: '418- SWARNADIP BHOWMIK',
        email: '2105418@kiit.ac.in',
      },
      {
        name: '3289_MANDIP SAH',
        email: '21053289@kiit.ac.in',
      },
      {
        name: '2043_ Ritajit Pal',
        email: '22052043@kiit.ac.in',
      },
      {
        name: '1543_ANUROOP ROY',
        email: '21051543@kiit.ac.in',
      },
      {
        name: '2776 Swarnim Tigga',
        email: '22052776@kiit.ac.in',
      },
      {
        name: '232 PARTH BATRA',
        email: '21053232@kiit.ac.in',
      },
      {
        name: '589-MEGHANSH GOVIL',
        email: '22051589@kiit.ac.in',
      },
      {
        name: '3681 - DEBESH ACHARYA',
        email: '22053681@kiit.ac.in',
      },
      {
        name: '629_MANDIRA GHOSH',
        email: '2105629@kiit.ac.in',
      },
      {
        name: '1437-SOUMYAKANT PARIDA',
        email: '21051437@kiit.ac.in',
      },
      {
        name: '3657 ADITYA MOHANTY',
        email: '22053657@kiit.ac.in',
      },
      {
        name: '2278_Shreyansh Srivastava',
        email: '21052278@kiit.ac.in',
      },
      {
        name: '3460_Jay Prakash Giri',
        email: '21053460@kiit.ac.in',
      },
      {
        name: '2375_SWATI SUMAN SAHU',
        email: '21052375@kiit.ac.in',
      },
      {
        name: '6078-TATHAGATA KUNDU',
        email: '2106078@kiit.ac.in',
      },
      {
        name: '6215_Harshvardhan Ojha',
        email: '2106215@kiit.ac.in',
      },
      {
        name: '630_SWARUP SURYAWANSHI',
        email: '2105630@kiit.ac.in',
      },
      {
        name: 'ISHAAN MISHRA',
        email: '22052819@kiit.ac.in',
      },
      {
        name: '6156_SHRUTI SACHAN',
        email: '2106156@kiit.ac.in',
      },
      {
        name: 'JANMEJAYA KRISHNA',
        email: '2205734@kiit.ac.in',
      },
      {
        name: 'DEBOTTAM MANDAL',
        email: '22053155@kiit.ac.in',
      },
      {
        name: 'PRANJAL',
        email: '21051835@kiit.ac.in',
      },
      {
        name: '3116-SOUMI NANDY',
        email: '22053116@kiit.ac.in',
      },
      {
        name: '4138-ADITYA KUMAR TIWARI',
        email: '22054138@kiit.ac.in',
      },
      {
        name: '1451_Adil Ahmad',
        email: '21051451@kiit.ac.in',
      },
      {
        name: '8106_AYUSH SRIVASTAVA',
        email: '2228106@kiit.ac.in',
      },
      {
        name: 'VINEET CHAUDHARY',
        email: '22054002@kiit.ac.in',
      },
      {
        name: '1507_Samayita Bepari',
        email: '21051507@kiit.ac.in',
      },
      {
        name: '3431_Utkrisht Bhandari',
        email: '21053431@kiit.ac.in',
      },
      {
        name: '2678_MOUPIYA CHATTERJEE',
        email: '21052678@kiit.ac.in',
      },
      {
        name: '2186_Satyaki Ghosh',
        email: '21052186@kiit.ac.in',
      },
      {
        name: 'Tushar Joshi',
        email: '21051612@kiit.ac.in',
      },
      {
        name: '1801_ARNAV DEY',
        email: '21051801@kiit.ac.in',
      },
      {
        name: '3471_Manju Kapadi',
        email: '21053471@kiit.ac.in',
      },
      {
        name: '1409_NAMAN SINHA',
        email: '21051409@kiit.ac.in',
      },
      {
        name: '7057_SHREYA DAS',
        email: '22057057@kiit.ac.in',
      },
      {
        name: '976_NISHANT SINGH',
        email: '2105976@kiit.ac.in',
      },
      {
        name: '2168_Prateek Sahoo',
        email: '21052168@kiit.ac.in',
      },
      {
        name: '4107 Abhisek Singh',
        email: '22054107@kiit.ac.in',
      },
      {
        name: '708 APURVA SINHA',
        email: '22052708@kiit.ac.in',
      },
      {
        name: '3303_Prajit Kumar Yadav',
        email: '21053303@kiit.ac.in',
      },
      {
        name: '6199_AYUSH PAL',
        email: '2106199@kiit.ac.in',
      },
      {
        name: '6180_Akash Ghosh',
        email: '2106180@kiit.ac.in',
      },
      {
        name: '629_ ANIRBAN ROY',
        email: '21051629@kiit.ac.in',
      },
      {
        name: '654_SAHIL SINGH RAJPUT',
        email: '2105654@kiit.ac.in',
      },
      {
        name: '1394_DIMPLE PATEL',
        email: '21051394@kiit.ac.in',
      },
      {
        name: '3474_Amit Gupta',
        email: '21053474@kiit.ac.in',
      },
      {
        name: '566_ANKITA JANA',
        email: '21052566@kiit.ac.in',
      },
      {
        name: 'RITIKA CHATTERJEE',
        email: '2229144@kiit.ac.in',
      },
      {
        name: '260_ANINDYA BAG',
        email: '2105260@kiit.ac.in',
      },
      {
        name: 'Maheshwaran',
        email: '21051775@kiit.ac.in',
      },
      {
        name: '949_ ARGHA ROY',
        email: '2105949@kiit.ac.in',
      },
      {
        name: '456-AMAN ANOOP SAXENA',
        email: '21051456@kiit.ac.in',
      },
      {
        name: '1446_ABHIGYAN MOHANTY',
        email: '21051446@kiit.ac.in',
      },
      {
        name: '210_MOHIT SHEKHAR',
        email: '2105210@kiit.ac.in',
      },
      {
        name: '1156-DEV MODAK',
        email: '22051156@kiit.ac.in',
      },
      {
        name: '1067_NIMISHA MOHANTA',
        email: '21051067@kiit.ac.in',
      },
      {
        name: '8067-ARYAN RAJ',
        email: '2128067@kiit.ac.in',
      },
      {
        name: '8071_Bhaskar Mandal',
        email: '2128071@kiit.ac.in',
      },
      {
        name: '123_ABHA SRIVASTAVA',
        email: '2128123@kiit.ac.in',
      },
      {
        name: '001_ABHIJEET KUMAR',
        email: '2105001@kiit.ac.in',
      },
      {
        name: '2245_SOUMYADIP MALASH (Dustu)',
        email: '22052245@kiit.ac.in',
      },
      {
        name: '4173-SIDDHARTH SENGUPTA',
        email: '22054173@kiit.ac.in',
      },
      {
        name: '1486_Moumita Sutradhar',
        email: '21051486@kiit.ac.in',
      },
      {
        name: '2892 Abanti',
        email: '21052892@kiit.ac.in',
      },
      {
        name: '1833_PRANABIT PRADHAN',
        email: '21051833@kiit.ac.in',
      },
      {
        name: '203_RICHIK DEY',
        email: '2206203@kiit.ac.in',
      },
      {
        name: '821_SAMUDRANEEL SENGUPTA',
        email: '2105821@kiit.ac.in',
      },
      {
        name: '2797 Subhadipsasmal',
        email: '21052797@kiit.ac.in',
      },
      {
        name: '5799_AYUSH KEDIA',
        email: '2205799@kiit.ac.in',
      },
      {
        name: '3222 _TANISHA MOHAPATRA',
        email: '21053222@kiit.ac.in',
      },
      {
        name: '8139_ DIVANSHU',
        email: '2128139@kiit.ac.in',
      },
      {
        name: 'Rajobrata Das',
        email: '2105297@kiit.ac.in',
      },
      {
        name: '2756_DIPISHA SHIVANGI',
        email: '21052756@kiit.ac.in',
      },
      {
        name: '5913_PRAKHAR BANSAL',
        email: '2205913@kiit.ac.in',
      },
      {
        name: '280_KUMAR YASH MEHUL',
        email: '2105280@kiit.ac.in',
      },
      {
        name: 'AMAN BAJPAI',
        email: '22051232@kiit.ac.in',
      },
      {
        name: '316_RAHUL LENKA',
        email: '2205316@kiit.ac.in',
      },
      {
        name: '6117_HIMANSHU DASH',
        email: '2106117@kiit.ac.in',
      },
      {
        name: '2887_TANYA KUMARI',
        email: '21052887@kiit.ac.in',
      },
      {
        name: 'PRAYAG PATRO',
        email: '23051288@kiit.ac.in',
      },
      {
        name: '277_ KANHAIYA KUNJ',
        email: '2105277@kiit.ac.in',
      },
      {
        name: '708_Shreya Rakshit',
        email: '21052708@kiit.ac.in',
      },
      {
        name: 'PRASUN SHAH',
        email: '23051849@kiit.ac.in',
      },
      {
        name: 'Abhigya Kashyap',
        email: '23053906@kiit.ac.in',
      },
      {
        name: '514_TANYA CHAUDHARY',
        email: '2205514@kiit.ac.in',
      },
      {
        name: 'SUBHRANGSHU CHATTERJEE',
        email: '22053819@kiit.ac.in',
      },
      {
        name: '4185 TANISA VERMA',
        email: '22054185@kiit.ac.in',
      },
      {
        name: '2144_Anushka Singh',
        email: '21052144@kiit.ac.in',
      },
      {
        name: 'SPARSH GUHA',
        email: '2205333@kiit.ac.in',
      },
      {
        name: '3274_BIDUR JHA',
        email: '21053274@kiit.ac.in',
      },
      {
        name: '2759_GOURAV CHAKRABORTY',
        email: '21052759@kiit.ac.in',
      },
      {
        name: '457_ FIONA DASH',
        email: '2105457@kiit.ac.in',
      },
      {
        name: 'DEBASHRITA MANDAL',
        email: '22052810@kiit.ac.in',
      },
      {
        name: '2121_Isha Mittal',
        email: '22052121@kiit.ac.in',
      },
      {
        name: 'Aryan Vora 952',
        email: '2105952@kiit.ac.in',
      },
      {
        name: '1267_TAMANNA PATNAIK',
        email: '21051267@kiit.ac.in',
      },
      {
        name: 'RAVIRANJAN PATEL 800',
        email: '23053800@kiit.ac.in',
      },
      {
        name: '3518_ARYAN MISHRA',
        email: '23053518@kiit.ac.in',
      },
      {
        name: '1352 MIHIR RAJ',
        email: '23051352@kiit.ac.in',
      },
      {
        name: '267_ADRIJA DAS',
        email: '2205267@kiit.ac.in',
      },
      {
        name: 'RITESH KUMAR',
        email: '22051099@kiit.ac.in',
      },
      {
        name: '611_AYUSH AGARWALA',
        email: '2105611@kiit.ac.in',
      },
      {
        name: '903 SUMIT MANDAL',
        email: '2305903@kiit.ac.in',
      },
      {
        name: 'SOUMILI DAS',
        email: '2229181@kiit.ac.in',
      },
      {
        name: '3287_Kunal Jha',
        email: '21053287@kiit.ac.in',
      },
      {
        name: '1056_IPSIT CHANDRA',
        email: '21051056@kiit.ac.in',
      },
      {
        name: 'SWAYAMJIT SAHOO',
        email: '2305826@kiit.ac.in',
      },
      {
        name: 'SAAKSSHI PODDER',
        email: '23051943@kiit.ac.in',
      },
      {
        name: 'RAVIKANT DIWAKAR',
        email: '21051499@kiit.ac.in',
      },
      {
        name: '209_Aryan Kaushal',
        email: '21051209@kiit.ac.in',
      },
      {
        name: '1427_ISHITA CHATTERJEE',
        email: '22051427@kiit.ac.in',
      },
      {
        name: '068_Purushotam',
        email: '2129068@kiit.ac.in',
      },
      {
        name: '568_ADARSH ROUT',
        email: '22053568@kiit.ac.in',
      },
      {
        name: '3474_UJJAWAL ANAND',
        email: '23053474@kiit.ac.in',
      },
      {
        name: '6146_SHRIYANS MUKHERJEE',
        email: '2306146@kiit.ac.in',
      },
      {
        name: '068- Asish padhy',
        email: '2128068@kiit.ac.in',
      },
      {
        name: 'VIVEK MAHATO',
        email: '22053126@kiit.ac.in',
      },
      {
        name: 'SWARNAVO MALLIK',
        email: '22053386@kiit.ac.in',
      },
      {
        name: '70 SAMPAD GHOSH',
        email: '2130070@kiit.ac.in',
      },
      {
        name: '2386_AKASH DUTTACHOWDHURY',
        email: '21052386@kiit.ac.in',
      },
      {
        name: 'Naresh Sah',
        email: '23053753@kiit.ac.in',
      },
      {
        name: '6314_ASHISH PATEL',
        email: '2106314@kiit.ac.in',
      },
      {
        name: '4115 - Aadya Sharma',
        email: '22054115@kiit.ac.in',
      },
      {
        name: 'Krutika Verma',
        email: 'krutika.vermafcs@kiit.ac.in',
      },
      {
        name: 'PUJA DAS',
        email: '22053008@kiit.ac.in',
      },
      {
        name: '2793_AMAN PANDEY',
        email: '22052793@kiit.ac.in',
      },
      {
        name: '3437_PRIYANKA KUMARI',
        email: '21053437@kiit.ac.in',
      },
      {
        name: '723_Muskan',
        email: '2105723@kiit.ac.in',
      },
      {
        name: '1469 SUMIT BARMAN',
        email: '22051469@kiit.ac.in',
      },
      {
        name: '519_ADITYA SINHA',
        email: '2105519@kiit.ac.in',
      },
      {
        name: '236_SAYAK HATUI',
        email: '2105236@kiit.ac.in',
      },
      {
        name: 'ADITYA SAXENA 3833',
        email: '22053833@kiit.ac.in',
      },
      {
        name: 'SHASHANK RAJ',
        email: '22052756@kiit.ac.in',
      },
      {
        name: '294_YASH KUMAR SINGH',
        email: '21052294@kiit.ac.in',
      },
      {
        name: '709_ayaskant dash',
        email: '2105709@kiit.ac.in',
      },
      {
        name: '156_SHAKSHAM SAINI',
        email: '2205156@kiit.ac.in',
      },
      {
        name: 'NITISH KUMAR',
        email: '22052831@kiit.ac.in',
      },
      {
        name: '486_ARYAN KASHYAP',
        email: '21052486@kiit.ac.in',
      },
      {
        name: '2164_SUBHAM BERA',
        email: '22052164@kiit.ac.in',
      },
      {
        name: 'SHAKTI SAH',
        email: '23053855@kiit.ac.in',
      },
      {
        name: '356 SHASHWAT MISHRA',
        email: '21053356@kiit.ac.in',
      },
      {
        name: '2060_SINCHAL KAR',
        email: '22052060@kiit.ac.in',
      },
      {
        name: 'SATYAM PATEL',
        email: '23052513@kiit.ac.in',
      },
      {
        name: '1214_VINAYAK TIWARI',
        email: '22051214@kiit.ac.in',
      },
      {
        name: '626_HIMANSHU SHARMA',
        email: '2105626@kiit.ac.in',
      },
      {
        name: '394_ANIMESH KUMAR KAR',
        email: '21052394@kiit.ac.in',
      },
      {
        name: '3941-DEBRUPA SAHA',
        email: '22053941@kiit.ac.in',
      },
      {
        name: 'JAGAJIT DAS',
        email: '22053600@kiit.ac.in',
      },
      {
        name: '068_Nishant Kumar',
        email: '21051068@kiit.ac.in',
      },
      {
        name: '43_ANSHUMAN SAHOO',
        email: '2130043@kiit.ac.in',
      },
      {
        name: '1427_SHIVPREET PADHI',
        email: '21051427@kiit.ac.in',
      },
      {
        name: '018_ARITRA MUHURI',
        email: '2105018@kiit.ac.in',
      },
      {
        name: 'NIKHIL SINGH',
        email: '2229131@kiit.ac.in',
      },
      {
        name: 'ARMAAN PANDEY',
        email: '2205716@kiit.ac.in',
      },
      {
        name: '2775_OM PATEL',
        email: '21052775@kiit.ac.in',
      },
      {
        name: 'NITESH PATNAIK',
        email: '2206357@kiit.ac.in',
      },
      {
        name: '214 PIYUSH KUMAR',
        email: '21053214@kiit.ac.in',
      },
      {
        name: '3422_KRISHNA SHAH',
        email: '21053422@kiit.ac.in',
      },
      {
        name: '2232_Anshuman',
        email: '21052232@kiit.ac.in',
      },
      {
        name: '2866_SAMRIDDHI SHARMA',
        email: '21052866@kiit.ac.in',
      },
      {
        name: '586_Gourab Baroi',
        email: '21052586@kiit.ac.in',
      },
      {
        name: 'SREEJA UPADHYAYA',
        email: '23057051@kiit.ac.in',
      },
      {
        name: '710 ADRIJA DAS',
        email: '21051710@kiit.ac.in',
      },
      {
        name: '465_YASH PRATAP SINGH',
        email: '21052465@kiit.ac.in',
      },
      {
        name: '107_Anushka Bajpai',
        email: '2205107@kiit.ac.in',
      },
      {
        name: '016_Anushka Rawat',
        email: '2105016@kiit.ac.in',
      },
      {
        name: '1423_SAMRAT CHAKRABORTY',
        email: '21051423@kiit.ac.in',
      },
      {
        name: '5898_MANASWINI PATTANAIK',
        email: '2105898@kiit.ac.in',
      },
      {
        name: '4098 U T K A R S H',
        email: '22054098@kiit.ac.in',
      },
      {
        name: '5950_ARIN CHOUDHARY',
        email: '2105950@kiit.ac.in',
      },
      {
        name: '2830 DEBANGAN BHATTACHARYYA',
        email: '21052830@kiit.ac.in',
      },
      {
        name: '3309_RAHUL DEV MALLICK',
        email: '21053309@kiit.ac.in',
      },
      {
        name: '319_SARTHAK AGARWAL',
        email: '2106319@kiit.ac.in',
      },
      {
        name: '5466_Dhruv Saxena',
        email: '2205466@kiit.ac.in',
      },
      {
        name: '8062_Abhishek D',
        email: '2328062@kiit.ac.in',
      },
      {
        name: '533_Sneha Behera',
        email: '21052533@kiit.ac.in',
      },
      {
        name: 'NILOTPAL BASU',
        email: '22051085@kiit.ac.in',
      },
      {
        name: '9140_RAHUL _BAGARIA',
        email: '2129140@kiit.ac.in',
      },
      {
        name: '1590_sadaf Shahab',
        email: '21051590@kiit.ac.in',
      },
      {
        name: '5524_ANJALI BALI',
        email: '2105524@kiit.ac.in',
      },
      {
        name: '9056_ARPAN BAGCHI',
        email: '2129056@kiit.ac.in',
      },
      {
        name: '1529_ DEEPESH REDDY',
        email: '21051529@kiit.ac.in',
      },
      {
        name: '231_Riddhima Singh',
        email: '2205231@kiit.ac.in',
      },
      {
        name: '1508_Sanjivani Mohanty',
        email: '21051508@kiit.ac.in',
      },
      {
        name: '3586-AVINASH PATRA',
        email: '22053586@kiit.ac.in',
      },
      {
        name: '5469_NAKSHATRA GUPTA',
        email: '2105469@kiit.ac.in',
      },
      {
        name: '362 AYUSH KASHYAP',
        email: '2105362@kiit.ac.in',
      },
      {
        name: '1834_PRANAV',
        email: '21051834@kiit.ac.in',
      },
      {
        name: 'Vertika Sharma',
        email: '2229081@kiit.ac.in',
      },
      {
        name: '4312_GIRIKNT M RAI',
        email: '22054312@kiit.ac.in',
      },
      {
        name: '2894_AYUSH RANJAN',
        email: '22052894@kiit.ac.in',
      },
      {
        name: 'AYUSHYA RAJ',
        email: '22052452@kiit.ac.in',
      },
      {
        name: '717 ASMITA GHOSH',
        email: '22052717@kiit.ac.in',
      },
      {
        name: '1794 AIMAN HASIB',
        email: '21051794@kiit.ac.in',
      },
      {
        name: '4321_BHUSHAN SAH',
        email: '22054321@kiit.ac.in',
      },
      {
        name: '1260 MARYADA RAY',
        email: '22051260@kiit.ac.in',
      },
      {
        name: '057_Arpita P',
        email: '2129057@kiit.ac.in',
      },
      {
        name: 'ANMOL TEWARI',
        email: '22051237@kiit.ac.in',
      },
      {
        name: '389_Shiv Raut',
        email: '21053389@kiit.ac.in',
      },
      {
        name: 'BISWAJEET BEHERA',
        email: '2305046@kiit.ac.in',
      },
      {
        name: '290_SHRAVAN YADAV',
        email: '2230290@kiit.ac.in',
      },
      {
        name: 'Kaustabh Shit',
        email: '2205131@kiit.ac.in',
      },
      {
        name: '457_Amit_Raj',
        email: '21051457@kiit.ac.in',
      },
      {
        name: 'ADITYA SINGH',
        email: '22053220@kiit.ac.in',
      },
      {
        name: '9098_sanya sonu',
        email: '2129098@kiit.ac.in',
      },
      {
        name: '2401_ Sachin Kumar',
        email: '22052401@kiit.ac.in',
      },
      {
        name: 'ASHIM UPADHYAYA',
        email: '22054346@kiit.ac.in',
      },
      {
        name: 'HRITIK SHAH',
        email: '22054331@kiit.ac.in',
      },
      {
        name: '589_SAPTARSHI DUTTA',
        email: '21052589@kiit.ac.in',
      },
      {
        name: 'TAMONASH MAJUMDER (22053474)',
        email: '22053474@kiit.ac.in',
      },
      {
        name: '1346_Srishti Jha',
        email: '21051346@kiit.ac.in',
      },
      {
        name: 'ADITYA TULSYAN',
        email: '22052962@kiit.ac.in',
      },
      {
        name: 'SRISTI SAHA',
        email: '23052763@kiit.ac.in',
      },
      {
        name: '122_BHOOMIKA GARG',
        email: '2205122@kiit.ac.in',
      },
      {
        name: '284_ARNAV PRIYADRSHI',
        email: '22052284@kiit.ac.in',
      },
      {
        name: '008_ ADITI SINGH',
        email: '2129008@kiit.ac.in',
      },
      {
        name: 'VIVEK RAJ SINGH',
        email: '2229192@kiit.ac.in',
      },
      {
        name: '276_INDRANUJ GHOSH',
        email: '2105276@kiit.ac.in',
      },
      {
        name: '3715 SANDEEP SAHOO',
        email: '22053715@kiit.ac.in',
      },
      {
        name: '195_GAURAV MOHANTY',
        email: '2105195@kiit.ac.in',
      },
      {
        name: '5291_K NIRUPAMA',
        email: '2205291@kiit.ac.in',
      },
      {
        name: 'ANUSHKA SHRIVASTAVA',
        email: '2205710@kiit.ac.in',
      },
      {
        name: '1313_ Loyna',
        email: '21051313@kiit.ac.in',
      },
      {
        name: '2132_PRATEEK DASH',
        email: '22052132@kiit.ac.in',
      },
      {
        name: '1867_VISHAL KUMAR',
        email: '21051867@kiit.ac.in',
      },
      {
        name: '1016_Ritika Rani',
        email: '21051016@kiit.ac.in',
      },
      {
        name: '3357_SAYANDEEP KANRAR',
        email: '22053357@kiit.ac.in',
      },
      {
        name: 'Rudra Pradhan',
        email: '21051242@kiit.ac.in',
      },
      {
        name: '625_AVI SAHAI',
        email: '2205625@kiit.ac.in',
      },
      {
        name: '1494_PRATHAM PRITHIRAJ',
        email: '21051494@kiit.ac.in',
      },
      {
        name: '807_ NEHA BAJPAYEE',
        email: '2105807@kiit.ac.in',
      },
      {
        name: '2870_SHAMBHAWI SHREYA',
        email: '21052870@kiit.ac.in',
      },
      {
        name: 'Adib',
        email: '22053786@kiit.ac.in',
      },
      {
        name: '473_ AKANKSHYA PARIDA',
        email: '21052473@kiit.ac.in',
      },
      {
        name: 'SAKSHAM',
        email: '22054196@kiit.ac.in',
      },
      {
        name: '6079 Tushar Bhattacharya',
        email: '2106079@kiit.ac.in',
      },
      {
        name: '2263_Prajukta Dey',
        email: '21052263@kiit.ac.in',
      },
      {
        name: '2365_Siddhartha Mukherjee',
        email: '21052365@kiit.ac.in',
      },
      {
        name: '546_TUSHAR TEOTIA',
        email: '21052546@kiit.ac.in',
      },
      {
        name: '4126_Shithan Ghosh',
        email: '2204126@kiit.ac.in',
      },
      {
        name: '733_RISHAV PANDEY',
        email: '2105733@kiit.ac.in',
      },
      {
        name: '1943_SREYASI MAKHAL',
        email: '21051943@kiit.ac.in',
      },
      {
        name: '420 TANISHA SAINI',
        email: '2105420@kiit.ac.in',
      },
      {
        name: '1468_ARVIND KAPHLEY',
        email: '21051468@kiit.ac.in',
      },
      {
        name: 'AMLAN TANU DEY',
        email: '2302087@kiit.ac.in',
      },
      {
        name: 'TULSI BASETTI',
        email: '22051814@kiit.ac.in',
      },
      {
        name: 'VED PRAKASH',
        email: '22054253@kiit.ac.in',
      },
      {
        name: '579_Rishabh Raj',
        email: '2205579@kiit.ac.in',
      },
      {
        name: '2904 Jay Kishan Behera',
        email: '22052904@kiit.ac.in',
      },
      {
        name: '2932_VIDYUN AGARWAL',
        email: '21052932@kiit.ac.in',
      },
      {
        name: '5945_Shourya Raj',
        email: '2105945@kiit.ac.in',
      },
      {
        name: '2121 TEJAS BINU',
        email: '21052121@kiit.ac.in',
      },
      {
        name: 'PROGYA BHATTACHARJEE',
        email: '22053007@kiit.ac.in',
      },
      {
        name: '6296_Raunit Raj',
        email: '2106296@kiit.ac.in',
      },
      {
        name: '048_PRAGYNASMITA SAHOO',
        email: '2105048@kiit.ac.in',
      },
      {
        name: '1461_ANKIT KUMAR JENA',
        email: '21051461@kiit.ac.in',
      },
      {
        name: '005_Aditya',
        email: '2105005@kiit.ac.in',
      },
      {
        name: '039_Sweta Pruseth',
        email: '2129039@kiit.ac.in',
      },
      {
        name: '2338_NAYEER NAUSHAD',
        email: '21052338@kiit.ac.in',
      },
      {
        name: '312_SUBHASIS KUMAR PANDA',
        email: '2105312@kiit.ac.in',
      },
      {
        name: '1729_AYUSH KUMAR',
        email: '21051729@kiit.ac.in',
      },
      {
        name: '1967_Amrita Sinha',
        email: '21051967@kiit.ac.in',
      },
      {
        name: '4338 RAJESH DAHAL',
        email: '22054338@kiit.ac.in',
      },
      {
        name: 'BIKASH YADAV',
        email: '23053484@kiit.ac.in',
      },
      {
        name: '174_PRATEEK KUMAR',
        email: '2330174@kiit.ac.in',
      },
      {
        name: '2597-SNEHA GUHA',
        email: '23052597@kiit.ac.in',
      },
      {
        name: '1467_Subrat Dash',
        email: '22051467@kiit.ac.in',
      },
      {
        name: '2658_DEBARKA CHAKRABORTI',
        email: '21052658@kiit.ac.in',
      },
      {
        name: 'SOHAM GIRI',
        email: '23051542@kiit.ac.in',
      },
      {
        name: '1018_SATYAM SANJEEV',
        email: '22051018@kiit.ac.in',
      },
      {
        name: '706_SHREEMAA SENAPATI',
        email: '21052706@kiit.ac.in',
      },
      {
        name: '5702 Harshit Belwal',
        email: '2305702@kiit.ac.in',
      },
      {
        name: '1826_NIDA FARNAZ',
        email: '21051826@kiit.ac.in',
      },
      {
        name: 'Mohit Sharma',
        email: '21052676@kiit.ac.in',
      },
      {
        name: '262_ANISHA RAJ',
        email: '2105262@kiit.ac.in',
      },
      {
        name: 'DEBADRI BANERJEE',
        email: '2205894@kiit.ac.in',
      },
      {
        name: '184_SAIKAT SAHA',
        email: '22053184@kiit.ac.in',
      },
      {
        name: 'AASTHA KUMARI',
        email: '22054221@kiit.ac.in',
      },
      {
        name: 'HIRENDRA CHAURASIYA',
        email: '23053666@kiit.ac.in',
      },
      {
        name: '434_ZAKI MOHAMMAD MAHFOOZ',
        email: '2205434@kiit.ac.in',
      },
      {
        name: '067_SHIKHA CHATURVEDI',
        email: '2105067@kiit.ac.in',
      },
      {
        name: '1626_AMARNATH MOHANTY',
        email: '21051626@kiit.ac.in',
      },
      {
        name: '2247_DEBJIT MAJI',
        email: '21052247@kiit.ac.in',
      },
      {
        name: '3880_SAANVI KHANDURI',
        email: '22053880@kiit.ac.in',
      },
      {
        name: 'AAYUSH BHARUKA',
        email: '2205002@kiit.ac.in',
      },
      {
        name: '653_SAHIL RAJ SINGH',
        email: '2105653@kiit.ac.in',
      },
      {
        name: 'SARTHAK DASH (22053538)',
        email: '22053538@kiit.ac.in',
      },
      {
        name: '2254_KHUSI CHOUDHURY',
        email: '21052254@kiit.ac.in',
      },
      {
        name: '2001_KHUSHI KUMARI',
        email: '21052001@kiit.ac.in',
      },
      {
        name: '412_SPARSH CHAUDHARY',
        email: '2105412@kiit.ac.in',
      },
      {
        name: '1343_Shubhadeep Ghatak',
        email: '21051343@kiit.ac.in',
      },
      {
        name: '2878_SMRUTI PRIYA ROUT',
        email: '21052878@kiit.ac.in',
      },
      {
        name: '1954_Vasu Bhardwaj',
        email: '21051954@kiit.ac.in',
      },
      {
        name: '2406_ATIKA CHANDEL',
        email: '21052406@kiit.ac.in',
      },
      {
        name: '632_Uditaa Garg',
        email: '21052632@kiit.ac.in',
      },
      {
        name: '3614_PRATEEK PARIJA',
        email: '22053614@kiit.ac.in',
      },
      {
        name: '2162_ MeghanaPanda',
        email: '21052162@kiit.ac.in',
      },
      {
        name: 'ANANT TIWARY',
        email: '23057006@kiit.ac.in',
      },
      {
        name: '177_AHELI MANNA',
        email: '2105177@kiit.ac.in',
      },
      {
        name: '072_JanviSingh',
        email: '2129072@kiit.ac.in',
      },
      {
        name: 'MOHIT KUMAR',
        email: '22052829@kiit.ac.in',
      },
      {
        name: 'ANSH JAIN',
        email: '22051495@kiit.ac.in',
      },
      {
        name: '2790_ CSE',
        email: '21052790@kiit.ac.in',
      },
      {
        name: '1699 NISCHAY JAIN',
        email: '22051699@kiit.ac.in',
      },
      {
        name: 'Ansh Kumar Sharma',
        email: '2305114@kiit.ac.in',
      },
      {
        name: 'SHIVANI SETHI',
        email: '23051952@kiit.ac.in',
      },
      {
        name: 'SARTHAK SHARMA',
        email: '22054207@kiit.ac.in',
      },
      {
        name: '3280_Dinesh Paudel',
        email: '21053280@kiit.ac.in',
      },
      {
        name: '496_RUHANI BOSE',
        email: '2205496@kiit.ac.in',
      },
      {
        name: '1133_ADITYA PRABHU',
        email: '22051133@kiit.ac.in',
      },
      {
        name: '270_AYUSHI MOHANTY',
        email: '2105270@kiit.ac.in',
      },
      {
        name: '6241_RISHIKA RANJAN',
        email: '2106241@kiit.ac.in',
      },
      {
        name: '180_RAJESHWARI CHOUDHURY',
        email: '22053180@kiit.ac.in',
      },
      {
        name: '4403ROHIT SHARMA',
        email: '22054403@kiit.ac.in',
      },
      {
        name: '70 Tanishq',
        email: '22051470@kiit.ac.in',
      },
      {
        name: '2834_Dev Karan Pattnayak',
        email: '21052834@kiit.ac.in',
      },
      {
        name: '2332KUNAL KUMAR',
        email: '21052332@kiit.ac.in',
      },
      {
        name: '2882_Sriansh Raj Pradhan',
        email: '21052882@kiit.ac.in',
      },
      {
        name: '5895_Jayanti Goswami',
        email: '2105895@kiit.ac.in',
      },
      {
        name: '546_JAGANNATH MONDAL',
        email: '2105546@kiit.ac.in',
      },
      {
        name: '356_Anishka',
        email: '2205356@kiit.ac.in',
      },
      {
        name: '4104_Subham Luitel',
        email: '22054104@kiit.ac.in',
      },
      {
        name: '4206_Brejesh koushal',
        email: '22054206@kiit.ac.in',
      },
      {
        name: '2441__RITABRATA PAUL',
        email: '21052441@kiit.ac.in',
      },
      {
        name: '021_ARYAN DEO',
        email: '2105021@kiit.ac.in',
      },
      {
        name: '232_Pranav Varshney',
        email: '21051232@kiit.ac.in',
      },
      {
        name: '603_ NIHARIKA RAGHAV',
        email: '21052603@kiit.ac.in',
      },
      {
        name: '863_ANKIT SHARAN',
        email: '2105863@kiit.ac.in',
      },
      {
        name: '5122_AYUSH RAJ',
        email: '2305122@kiit.ac.in',
      },
      {
        name: 'MSC ARUNOPAL DUTTA',
        email: '21051549@kiit.ac.in',
      },
      {
        name: '403_ASHISH AMAN',
        email: '21052403@kiit.ac.in',
      },
      {
        name: '501_RISHAV DEO',
        email: '21051501@kiit.ac.in',
      },
      {
        name: 'RAHUL KUMAR',
        email: '2105731@kiit.ac.in',
      },
      {
        name: 'SAYAN DAS',
        email: '2228056@kiit.ac.in',
      },
      {
        name: 'AYUSH KUMAR RANA',
        email: '21052317@kiit.ac.in',
      },
      {
        name: '1449_ABHISHEK KUMAR TIWARI',
        email: '21051449@kiit.ac.in',
      },
      {
        name: '1651_A Suchit',
        email: '22051651@kiit.ac.in',
      },
      {
        name: '1411_NISHU KUMARI RAY',
        email: '21051411@kiit.ac.in',
      },
      {
        name: '5844_TANYA SINGH',
        email: '2105844@kiit.ac.in',
      },
      {
        name: 'MD HASNAIN',
        email: '22052910@kiit.ac.in',
      },
      {
        name: 'NAVNEET KUMAR',
        email: '2206275@kiit.ac.in',
      },
      {
        name: '3363 KHUSHI',
        email: '21053363@kiit.ac.in',
      },
      {
        name: '2387_AKASH CHAUDHARI',
        email: '21052387@kiit.ac.in',
      },
      {
        name: '741_Manthan Prashant Modi',
        email: '21051741@kiit.ac.in',
      },
      {
        name: '433_ADITI SINGH ROY',
        email: '2105433@kiit.ac.in',
      },
      {
        name: '3151_Ayush Kumar',
        email: '22053151@kiit.ac.in',
      },
      {
        name: '2860 _Riddhima',
        email: '21052860@kiit.ac.in',
      },
      {
        name: '534_AYUSH BISWAL',
        email: '2105534@kiit.ac.in',
      },
      {
        name: '2255 _Tanisha Basu',
        email: '22052255@kiit.ac.in',
      },
      {
        name: '2029_KAMLESH BEHERA',
        email: '22052029@kiit.ac.in',
      },
      {
        name: '91_VAASHKAR PAUL',
        email: '2130091@kiit.ac.in',
      },
      {
        name: '448 RAKSHA RAJ',
        email: '22051448@kiit.ac.in',
      },
      {
        name: 'RHITURAJ DATTA',
        email: '22053341@kiit.ac.in',
      },
      {
        name: '471_NAMRATA MAHAPATRA',
        email: '2105471@kiit.ac.in',
      },
      {
        name: '282_MANAN GARG',
        email: '2105282@kiit.ac.in',
      },
      {
        name: '2360_SHIRSHAK PATTNAIK',
        email: '21052360@kiit.ac.in',
      },
      {
        name: 'Subhransu Sahoo',
        email: '22053903@kiit.ac.in',
      },
      {
        name: '092_AKASH PRASAD',
        email: '2205092@kiit.ac.in',
      },
      {
        name: '3376_AHMAT SENOUSSI',
        email: '21053376@kiit.ac.in',
      },
      {
        name: '5940_ADARSH TIWARI',
        email: '2105940@kiit.ac.in',
      },
      {
        name: '476_ANISH SINHA',
        email: '21052476@kiit.ac.in',
      },
      {
        name: '8030_NAYNIKA SARKAR',
        email: '2128030@kiit.ac.in',
      },
      {
        name: '1686_Shobhit Verma',
        email: '21051686@kiit.ac.in',
      },
      {
        name: '1282_SHRUTI SINHA',
        email: '22051282@kiit.ac.in',
      },
      {
        name: '1289_ARINDAM KANRAR',
        email: '21051289@kiit.ac.in',
      },
      {
        name: '029_DIVYA SWAROOP DASH',
        email: '2105029@kiit.ac.in',
      },
      {
        name: '673-LAGNAJEET MOHANTY',
        email: '21052673@kiit.ac.in',
      },
      {
        name: '3641 _SOURAV MALLICK',
        email: '22053641@kiit.ac.in',
      },
      {
        name: '1008_SAHASRANSHU SHASTRI',
        email: '22051008@kiit.ac.in',
      },
      {
        name: 'Harsh Agrawalla',
        email: '2230171@kiit.ac.in',
      },
      {
        name: '2654_SANAM SAHU',
        email: '21052654@kiit.ac.in',
      },
      {
        name: '3409_MICHAEL MWENYA CHILESHE',
        email: '21053409@kiit.ac.in',
      },
      {
        name: '4050_Kunal Kewat',
        email: '22054050@kiit.ac.in',
      },
      {
        name: '5541_Devansh Kumar',
        email: '2105541@kiit.ac.in',
      },
      {
        name: '451_CHIRAG TAK',
        email: '2105451@kiit.ac.in',
      },
      {
        name: 'HARSH AGARWAL',
        email: '2205642@kiit.ac.in',
      },
      {
        name: 'Bikash Prasad',
        email: '22054033@kiit.ac.in',
      },
      {
        name: 'ARKOPRAVO DE',
        email: '22051755@kiit.ac.in',
      },
      {
        name: 'ANKIT KUMAR',
        email: '22052620@kiit.ac.in',
      },
      {
        name: '2949_Shibhang Poudel',
        email: '21052949@kiit.ac.in',
      },
      {
        name: '1119_UDDIPAN KALITA',
        email: '22051119@kiit.ac.in',
      },
      {
        name: '1096-SUCHARITA MOHAPATRA',
        email: '21051096@kiit.ac.in',
      },
      {
        name: '8018_Devangi Bhattacharjee',
        email: '2128018@kiit.ac.in',
      },
      {
        name: '5980_PRASANNA SAHOO',
        email: '2105980@kiit.ac.in',
      },
      {
        name: 'SATYAKI DAS',
        email: '22053718@kiit.ac.in',
      },
      {
        name: 'SAISAGAR SAHUKAR (22053535)',
        email: '22053535@kiit.ac.in',
      },
      {
        name: 'MOHAMMAD SAHIL',
        email: '23051681@kiit.ac.in',
      },
      {
        name: 'RITANKAR DAS',
        email: '22052044@kiit.ac.in',
      },
      {
        name: '1013_Soham Panda',
        email: '21051013@kiit.ac.in',
      },
      {
        name: 'AKSHYA PANI',
        email: '2105520@kiit.ac.in',
      },
      {
        name: '356_Niladri Nag',
        email: '2206356@kiit.ac.in',
      },
      {
        name: '5030 DEVANSH SINGH',
        email: '2205030@kiit.ac.in',
      },
      {
        name: 'ASHMITA GHOSH',
        email: '22052543@kiit.ac.in',
      },
      {
        name: '4149 POORVI SINGH',
        email: '22054149@kiit.ac.in',
      },
      {
        name: '2813_ANUSHKA PRIYADARSHINI',
        email: '21052813@kiit.ac.in',
      },
      {
        name: 'MD Maruf Hossain',
        email: '22054463@kiit.ac.in',
      },
      {
        name: '808_PALLAVI KUMARI',
        email: '2105808@kiit.ac.in',
      },
      {
        name: '196_SOHAM SANTRA',
        email: '2330196@kiit.ac.in',
      },
      {
        name: 'AAYUSH SINGH',
        email: '23053595@kiit.ac.in',
      },
      {
        name: '2028_SHUBHASMITA',
        email: '21052028@kiit.ac.in',
      },
      {
        name: '455_ASHISH KUMAR GUPTA',
        email: '2205455@kiit.ac.in',
      },
      {
        name: '3652_AADYA CHANDRA',
        email: '22053652@kiit.ac.in',
      },
      {
        name: '301_Deblina',
        email: '21051301@kiit.ac.in',
      },
      {
        name: 'VIVEK SINGH (22052868)',
        email: '22052868@kiit.ac.in',
      },
      {
        name: '321Jagriti SINGH',
        email: '2105321@kiit.ac.in',
      },
      {
        name: '2822_ ASHUTOSH JHA',
        email: '21052822@kiit.ac.in',
      },
      {
        name: 'PIYUSH RAJ',
        email: '2330383@kiit.ac.in',
      },
      {
        name: 'DEBRUP SENGUPTA',
        email: '23051017@kiit.ac.in',
      },
      {
        name: '7006_AISHWARYA MOHANTY',
        email: '22057006@kiit.ac.in',
      },
      {
        name: '232_Rishita',
        email: '2205232@kiit.ac.in',
      },
      {
        name: '1686 KANIKA SINGH',
        email: '22051686@kiit.ac.in',
      },
      {
        name: '2844_MOHAN AGRAWALLA',
        email: '21052844@kiit.ac.in',
      },
      {
        name: 'CHANDRA SHEKHAR MAHTO',
        email: '22057081@kiit.ac.in',
      },
      {
        name: '6185_ANIMESH ANAND',
        email: '2106185@kiit.ac.in',
      },
      {
        name: '316_ SAGAR MAHATO',
        email: '21053316@kiit.ac.in',
      },
      {
        name: '759- SHIVAM GUPTA',
        email: '22052759@kiit.ac.in',
      },
      {
        name: '785-YUVRAJ SINGH',
        email: '21051785@kiit.ac.in',
      },
      {
        name: '3283_JITENDRA KUMAR MANDAL',
        email: '21053283@kiit.ac.in',
      },
      {
        name: '120_SHASHANK',
        email: '2129120@kiit.ac.in',
      },
      {
        name: '1368 _ Ahana Datta',
        email: '21051368@kiit.ac.in',
      },
      {
        name: '402- SANKALP PATRA',
        email: '2105402@kiit.ac.in',
      },
      {
        name: '1035_SUDIP SAO',
        email: '22051035@kiit.ac.in',
      },
      {
        name: '2393_RAHUL KUMAR',
        email: '22052393@kiit.ac.in',
      },
      {
        name: 'RISHAV CHANDA',
        email: '2105912@kiit.ac.in',
      },
      {
        name: '2374_Swati Das',
        email: '21052374@kiit.ac.in',
      },
      {
        name: '2123_Vaibhav Yadav',
        email: '21052123@kiit.ac.in',
      },
      {
        name: '4144 Niladri Sarkar',
        email: '22054144@kiit.ac.in',
      },
      {
        name: '2010 Prateek',
        email: '21052010@kiit.ac.in',
      },
      {
        name: '6274_Ujjwal Pratap Singh',
        email: '2106274@kiit.ac.in',
      },
      {
        name: '4347_Dipesh NAYAK',
        email: '22054347@kiit.ac.in',
      },
      {
        name: '381_sudhir Jaiswal',
        email: '21053381@kiit.ac.in',
      },
      {
        name: '875_BAISHNABI PARIDA',
        email: '2105875@kiit.ac.in',
      },
      {
        name: '2344_PRIYANSHU MIDHA',
        email: '21052344@kiit.ac.in',
      },
      {
        name: '2094_Rupsa Mukhopadhyay',
        email: '21052094@kiit.ac.in',
      },
      {
        name: 'SHATADAL SAMUI (3361)',
        email: '22053361@kiit.ac.in',
      },
      {
        name: 'SHIVANGI SHARMA',
        email: '2229066@kiit.ac.in',
      },
      {
        name: '5148 _SANJEEV CHOUBEY',
        email: '2105148@kiit.ac.in',
      },
      {
        name: 'DIYA DEY',
        email: '2305008@kiit.ac.in',
      },
      {
        name: '2279_Shubham Mandal',
        email: '21052279@kiit.ac.in',
      },
      {
        name: '3439_PRASANNA DHUNGANA',
        email: '21053439@kiit.ac.in',
      },
      {
        name: 'SOUMILI DAS',
        email: '22052065@kiit.ac.in',
      },
      {
        name: 'Aishwarya Ranjan',
        email: '2229207@kiit.ac.in',
      },
      {
        name: '677_Mohnish Mishra',
        email: '21052677@kiit.ac.in',
      },
      {
        name: 'Meet Soneji',
        email: '2105467@kiit.ac.in',
      },
      {
        name: 'PRANJAL AGRAWAL',
        email: '22051868@kiit.ac.in',
      },
      {
        name: '296_ABHIGYAN ADITYA',
        email: '2105296@kiit.ac.in',
      },
      {
        name: '2766_Kush',
        email: '21052766@kiit.ac.in',
      },
      {
        name: '5878_BIBHUDUTTA SWAIN',
        email: '2105878@kiit.ac.in',
      },
      {
        name: 'Yash Mohapatra',
        email: '22051389@kiit.ac.in',
      },
      {
        name: '666_ Himanshu Sekhar Nayak',
        email: '21052666@kiit.ac.in',
      },
      {
        name: '581_DEBANGSHU SAHA',
        email: '21052581@kiit.ac.in',
      },
      {
        name: '593_Jatin bansal',
        email: '21052593@kiit.ac.in',
      },
      {
        name: '324_Soumya Ranjan Pradhan',
        email: '2230324@kiit.ac.in',
      },
      {
        name: 'Aryan Aaditya',
        email: '2229019@kiit.ac.in',
      },
      {
        name: '113_DIBYAJYOTI CHAKRAVARTI',
        email: '2106113@kiit.ac.in',
      },
      {
        name: 'KUMAR ARYAN (22053520)',
        email: '22053520@kiit.ac.in',
      },
      {
        name: '2601_Mayank Agarwal',
        email: '21052601@kiit.ac.in',
      },
      {
        name: 'AHNIK NIYOGI',
        email: '2304068@kiit.ac.in',
      },
      {
        name: '1831_AHANA DATTA',
        email: '22051831@kiit.ac.in',
      },
      {
        name: '2422_JATIN PATHAK',
        email: '21052422@kiit.ac.in',
      },
      {
        name: 'NIRAJ JHA',
        email: '23053838@kiit.ac.in',
      },
      {
        name: '3305_ Prashant Regmi',
        email: '21053305@kiit.ac.in',
      },
      {
        name: '526_SAMANGYA NAYAK',
        email: '21052526@kiit.ac.in',
      },
      {
        name: '2238_RIYA RAJ',
        email: '21052238@kiit.ac.in',
      },
      {
        name: 'ADITYA ROUTRAY',
        email: '22053306@kiit.ac.in',
      },
      {
        name: '1681_ SAYANTEKA SAHA',
        email: '21051681@kiit.ac.in',
      },
      {
        name: '5473_NAYAN KUMAR',
        email: '2105473@kiit.ac.in',
      },
      {
        name: 'NAMAN SHUKLA',
        email: '2205908@kiit.ac.in',
      },
      {
        name: '1532_PRIYANKA SANYAL',
        email: '22051532@kiit.ac.in',
      },
      {
        name: '096_Antarin',
        email: '2106096@kiit.ac.in',
      },
      {
        name: '3301_NITU KARMAKAR',
        email: '21053301@kiit.ac.in',
      },
      {
        name: '2715_ARYAN RAJ CHOUDHURY',
        email: '22052715@kiit.ac.in',
      },
      {
        name: 'Chaman Kumar (2105789)',
        email: '2105789@kiit.ac.in',
      },
      {
        name: '2842_Kumar Harsh',
        email: '21052842@kiit.ac.in',
      },
      {
        name: 'RAJ SHEKHAR',
        email: '22052575@kiit.ac.in',
      },
      {
        name: '1903_KUMAR UTSAV',
        email: '21051903@kiit.ac.in',
      },
      {
        name: '1601_SOUMYAJIT ROY',
        email: '21051601@kiit.ac.in',
      },
      {
        name: '337 NIKHIL kUMAR',
        email: '21053337@kiit.ac.in',
      },
      {
        name: '062_AviBhagat',
        email: '2129062@kiit.ac.in',
      },
      {
        name: '6126 SHRESHTHA SRIVASTAVA',
        email: '2206126@kiit.ac.in',
      },
      {
        name: '541_SURYAYAN MUKHOPADHYAY',
        email: '21052541@kiit.ac.in',
      },
      {
        name: '2229_MISHAN MAURYA',
        email: '21052229@kiit.ac.in',
      },
      {
        name: '032 HARSH SINGH',
        email: '2106032@kiit.ac.in',
      },
      {
        name: '353_AMISHA KUMARI',
        email: '2105353@kiit.ac.in',
      },
      {
        name: '2971_KRITIKA GAUR',
        email: '23052971@kiit.ac.in',
      },
      {
        name: '8168-SubhamMohanty',
        email: '2228168@kiit.ac.in',
      },
      {
        name: '053_UTKARSH SRIVASTAVA',
        email: '2230053@kiit.ac.in',
      },
      {
        name: 'AADI RATN',
        email: '23051560@kiit.ac.in',
      },
      {
        name: '1605_OMKAR DEY',
        email: '23051605@kiit.ac.in',
      },
      {
        name: '1862_Khushi Deshwal',
        email: '22051862@kiit.ac.in',
      },
      {
        name: '1709 PRAVEER',
        email: '22051709@kiit.ac.in',
      },
      {
        name: '5806_Disha Pulivadi',
        email: '2205806@kiit.ac.in',
      },
      {
        name: 'MRINAL KAUSHIK',
        email: '23051602@kiit.ac.in',
      },
      {
        name: 'RAHUL PANDEY',
        email: '22052841@kiit.ac.in',
      },
      {
        name: '5697_ABHAY RATHORE',
        email: '2205697@kiit.ac.in',
      },
      {
        name: '3413_Hiruni Ekanayaka',
        email: '21053413@kiit.ac.in',
      },
      {
        name: 'STUTI SRIVASTAVA',
        email: '2228068@kiit.ac.in',
      },
      {
        name: '188_Ved Prakash',
        email: '21051188@kiit.ac.in',
      },
      {
        name: '534_SONALIKA SAHOO',
        email: '21052534@kiit.ac.in',
      },
      {
        name: '44_APURVA SINGH',
        email: '2130044@kiit.ac.in',
      },
      {
        name: 'GAURAV MISHRA',
        email: '23053718@kiit.ac.in',
      },
      {
        name: 'DEBJIT MANDAL',
        email: '22051069@kiit.ac.in',
      },
      {
        name: '5943_ Soumya Routray',
        email: '2105943@kiit.ac.in',
      },
      {
        name: '3290_MD RASEL UDDIN',
        email: '21053290@kiit.ac.in',
      },
      {
        name: 'SAYAK LODH',
        email: '2105314@kiit.ac.in',
      },
      {
        name: 'PRABHU PRASAD',
        email: '22053795@kiit.ac.in',
      },
      {
        name: 'PRANJAL YADAV',
        email: '22052918@kiit.ac.in',
      },
      {
        name: '5088 _Rohan',
        email: '2105088@kiit.ac.in',
      },
      {
        name: 'SATYAM MISHRA',
        email: '2306139@kiit.ac.in',
      },
      {
        name: '5766_AJAY SHANKER',
        email: '2105766@kiit.ac.in',
      },
      {
        name: '479_MEHUL AGARWAL',
        email: '21051479@kiit.ac.in',
      },
      {
        name: '2815_Aradhana',
        email: '21052815@kiit.ac.in',
      },
      {
        name: '264_ABISHAI EMANUEL EKKA',
        email: '2205264@kiit.ac.in',
      },
      {
        name: '2823_ASHUTOSH KUMAR PRASAD',
        email: '21052823@kiit.ac.in',
      },
      {
        name: '1923_SAHIL KUMAR',
        email: '21051923@kiit.ac.in',
      },
      {
        name: '1891_DHRUV NEHRU',
        email: '21051891@kiit.ac.in',
      },
      {
        name: 'ROHAN DAS',
        email: '23053378@kiit.ac.in',
      },
      {
        name: 'VENAY VERMA',
        email: '2207031@kiit.ac.in',
      },
      {
        name: 'S',
        email: '21052189@kiit.ac.in',
      },
      {
        name: '296 - SMRITI JHA',
        email: '2206296@kiit.ac.in',
      },
      {
        name: '358 ARJUN RAJESH NAIR',
        email: '2105358@kiit.ac.in',
      },
      {
        name: 'BHUMI JAISWAL',
        email: '22052454@kiit.ac.in',
      },
      {
        name: 'AMITAV MOHANTY',
        email: '22053923@kiit.ac.in',
      },
      {
        name: '2369_ASHUTOSH KUMAR TIWARI',
        email: '22052369@kiit.ac.in',
      },
      {
        name: '394_RAJESH CHOWDHURY',
        email: '21053394@kiit.ac.in',
      },
      {
        name: '1098_SWAPNIL SARKAR',
        email: '21051098@kiit.ac.in',
      },
      {
        name: '9008 AYUSH SINGH',
        email: '2209008@kiit.ac.in',
      },
      {
        name: '2801_TAPASYA RAY',
        email: '21052801@kiit.ac.in',
      },
      {
        name: '6301-SUJEET BISWAL',
        email: '2206301@kiit.ac.in',
      },
      {
        name: '2261_OMMKAR BISOI',
        email: '21052261@kiit.ac.in',
      },
      {
        name: 'HARSHIT',
        email: '2205039@kiit.ac.in',
      },
      {
        name: '013-ADWAITH PJ',
        email: '2129013@kiit.ac.in',
      },
      {
        name: '3107_SHRUTI MEHTA',
        email: '22053107@kiit.ac.in',
      },
      {
        name: '614_AYUSH',
        email: '2105614@kiit.ac.in',
      },
      {
        name: '184_ANKIT BASAK',
        email: '2205184@kiit.ac.in',
      },
      {
        name: '5096_ADITYA SINHA',
        email: '2105096@kiit.ac.in',
      },
      {
        name: '1027_ADARSH SRIVASTAVA',
        email: '21051027@kiit.ac.in',
      },
      {
        name: '014_ANURAG DAS',
        email: '2105014@kiit.ac.in',
      },
      {
        name: '770 SRIJAN MUKHERJEE',
        email: '21051770@kiit.ac.in',
      },
      {
        name: '825_SAUMY',
        email: '2105825@kiit.ac.in',
      },
      {
        name: '268_ AVANI',
        email: '2105268@kiit.ac.in',
      },
      {
        name: 'SUBHAMITA PAUL',
        email: '22051639@kiit.ac.in',
      },
      {
        name: 'ABHISHEK SHRIVASTAV',
        email: '23053572@kiit.ac.in',
      },
      {
        name: '734_ Rishikesh',
        email: '2105734@kiit.ac.in',
      },
      {
        name: '539_SUBHASHREE PANDA',
        email: '21052539@kiit.ac.in',
      },
      {
        name: '458_Ananya Gupta',
        email: '21051458@kiit.ac.in',
      },
      {
        name: '2743-NIKHIL KUMAR',
        email: '22052743@kiit.ac.in',
      },
      {
        name: '3292_ MUSHTAQ SHAHREAR TONMOY',
        email: '21053292@kiit.ac.in',
      },
      {
        name: 'GOURANGA MAITY',
        email: '22052814@kiit.ac.in',
      },
      {
        name: 'SHREYASH ROY',
        email: '22052762@kiit.ac.in',
      },
      {
        name: 'ESHNA RAY',
        email: '2228024@kiit.ac.in',
      },
      {
        name: '1124 VEDANT VERMA',
        email: '22051124@kiit.ac.in',
      },
      {
        name: '2809_Aditi _Toppo',
        email: '21052809@kiit.ac.in',
      },
      {
        name: '463 Ansh Pathak',
        email: '21051463@kiit.ac.in',
      },
      {
        name: 'Rishav Prasad',
        email: '2105818@kiit.ac.in',
      },
      {
        name: '769_SOUMIK BANERJEE',
        email: '21051769@kiit.ac.in',
      },
      {
        name: 'RISHI RAJ VERMA_601',
        email: '22051601@kiit.ac.in',
      },
      {
        name: '1925_SANDEEP KUMAR',
        email: '21051925@kiit.ac.in',
      },
      {
        name: '2350_ROHAN KUMAR SHARMA',
        email: '21052350@kiit.ac.in',
      },
      {
        name: '055_Hritik Raj',
        email: '21051055@kiit.ac.in',
      },
      {
        name: '387_KIRIT BARUAH',
        email: '2205387@kiit.ac.in',
      },
      {
        name: '147_ VIKASH ANAND',
        email: '2206147@kiit.ac.in',
      },
      {
        name: '119_JEET HAIT',
        email: '2106119@kiit.ac.in',
      },
      {
        name: 'DIPTA DAS',
        email: '22054375@kiit.ac.in',
      },
      {
        name: '5885_Gourav Chatterjee',
        email: '2105885@kiit.ac.in',
      },
      {
        name: '077_TANISHA VERMA',
        email: '2105077@kiit.ac.in',
      },
      {
        name: 'RITIKA BANERJEE 1007',
        email: '22051007@kiit.ac.in',
      },
      {
        name: '059_ RUDRANSH MISHRA',
        email: '2105059@kiit.ac.in',
      },
      {
        name: '3462_Ayush Agrawal',
        email: '21053462@kiit.ac.in',
      },
      {
        name: '2529_Satyam Behera',
        email: '21052529@kiit.ac.in',
      },
      {
        name: '5892_ INDRANATH MODAK',
        email: '2105892@kiit.ac.in',
      },
      {
        name: '051_Arijit Saha',
        email: '2129051@kiit.ac.in',
      },
      {
        name: '567_Anunay kumar',
        email: '21052567@kiit.ac.in',
      },
      {
        name: '337_abhay',
        email: '2105337@kiit.ac.in',
      },
      {
        name: '3401_ABHI UPADHYAY',
        email: '21053401@kiit.ac.in',
      },
      {
        name: '3294_METHU PAROI',
        email: '21053294@kiit.ac.in',
      },
      {
        name: '153_SAINATH DEY',
        email: '2205153@kiit.ac.in',
      },
      {
        name: '328_SORUP CHAKRABORTY',
        email: '21053328@kiit.ac.in',
      },
      {
        name: 'ARPREET MAHALA',
        email: '22052804@kiit.ac.in',
      },
      {
        name: '421- Tushar Anand',
        email: '2105421@kiit.ac.in',
      },
      {
        name: '2312 ASHWINI KAPOOR',
        email: '21052312@kiit.ac.in',
      },
      {
        name: 'SHREEKAR MAHAPATRA',
        email: '22053548@kiit.ac.in',
      },
      {
        name: '2246_CHINMAY TIWARI',
        email: '21052246@kiit.ac.in',
      },
      {
        name: '754_RAUNAK',
        email: '21051754@kiit.ac.in',
      },
      {
        name: '3270_ASHWANI SAH',
        email: '21053270@kiit.ac.in',
      },
      {
        name: '2828_BHAWYA SINGH',
        email: '21052828@kiit.ac.in',
      },
      {
        name: 'ARYANSHU PATTNAIK',
        email: '2229102@kiit.ac.in',
      },
      {
        name: '7039_LIKSHAYA',
        email: '22057039@kiit.ac.in',
      },
      {
        name: '882_SANKALP MOHAPATRA',
        email: '22053882@kiit.ac.in',
      },
      {
        name: 'Pronoy Sharma',
        email: '2205827@kiit.ac.in',
      },
      {
        name: '1825_MEGHA SAHU',
        email: '21051825@kiit.ac.in',
      },
      {
        name: '6113_RAJDEEP THAKUR',
        email: '2206113@kiit.ac.in',
      },
      {
        name: '1025_ABHISHEK RAJ',
        email: '21051025@kiit.ac.in',
      },
      {
        name: '634_OM SINGH',
        email: '2105634@kiit.ac.in',
      },
      {
        name: '331_ Sushant jain',
        email: '2105331@kiit.ac.in',
      },
      {
        name: '645_ADYASHA PATI',
        email: '21052645@kiit.ac.in',
      },
      {
        name: 'VIGYAT SINGH',
        email: '22051213@kiit.ac.in',
      },
      {
        name: '1883_ARYAN KUMAR',
        email: '21051883@kiit.ac.in',
      },
      {
        name: 'HARSH SANKRIT',
        email: '22051075@kiit.ac.in',
      },
      {
        name: '089_ANGSHUMAN NATH',
        email: '2106089@kiit.ac.in',
      },
      {
        name: '8147_Shrinkhala Kumari',
        email: '2228147@kiit.ac.in',
      },
      {
        name: '2110_SOUMYA RANJAN BEHERA',
        email: '21052110@kiit.ac.in',
      },
      {
        name: '9062_SAYAN BANERJEE',
        email: '2229062@kiit.ac.in',
      },
      {
        name: '2440 RAJKUMAR MISHRA',
        email: '21052440@kiit.ac.in',
      },
      {
        name: '1972_ANSUMAN PATI',
        email: '21051972@kiit.ac.in',
      },
      {
        name: '506_SHOVIN BARIK',
        email: '2205506@kiit.ac.in',
      },
      {
        name: 'ABIR SARKAR',
        email: '2105090@kiit.ac.in',
      },
      {
        name: '1235_PRIYADARSINI MOHARANA',
        email: '21051235@kiit.ac.in',
      },
      {
        name: '795_DIVYANSHI GORAI',
        email: '2105795@kiit.ac.in',
      },
      {
        name: '3470_SOUMYADEEP MOULICK',
        email: '22053470@kiit.ac.in',
      },
      {
        name: '204_KRISHNENDU DAS',
        email: '2105204@kiit.ac.in',
      },
      {
        name: '5521_Aman Sinha',
        email: '2105521@kiit.ac.in',
      },
      {
        name: 'ARITRO BANERJEE',
        email: '23053264@kiit.ac.in',
      },
      {
        name: '4067_Pratik Timilsina',
        email: '22054067@kiit.ac.in',
      },
      {
        name: '670_SNEHAN SAHOO',
        email: '2105670@kiit.ac.in',
      },
      {
        name: 'HARSH KHAITAN',
        email: '22052638@kiit.ac.in',
      },
      {
        name: 'SAYANI MONDAL',
        email: '22052153@kiit.ac.in',
      },
      {
        name: 'LAKKSHIT KHARE',
        email: '2205045@kiit.ac.in',
      },
      {
        name: '1525_MAYUKH PATTANAYAK',
        email: '22051525@kiit.ac.in',
      },
      {
        name: '542_ARUSH AGGARWAL',
        email: '2205542@kiit.ac.in',
      },
      {
        name: 'MAYURAKSHEE SAHU',
        email: '21051406@kiit.ac.in',
      },
      {
        name: 'KUSHAL MISHRA',
        email: '2229122@kiit.ac.in',
      },
      {
        name: '5521_AAKRITI ROY',
        email: '2205521@kiit.ac.in',
      },
      {
        name: 'RAMAN KURMI',
        email: '2306384@kiit.ac.in',
      },
      {
        name: '215_Vishal Singh',
        email: '22053215@kiit.ac.in',
      },
      {
        name: '4298-Hrushikesh Venkatasai',
        email: '22054298@kiit.ac.in',
      },
      {
        name: 'SRASHTA DAHAL',
        email: '23053605@kiit.ac.in',
      },
      {
        name: 'RANAB PAUL ARGHA',
        email: '23053497@kiit.ac.in',
      },
      {
        name: '8128_PRATIK DAS',
        email: '2228128@kiit.ac.in',
      },
      {
        name: 'PRAKHAR RAJ',
        email: '22053087@kiit.ac.in',
      },
      {
        name: '4126-BISMAYA KANTA DASH',
        email: '22054126@kiit.ac.in',
      },
      {
        name: '5154_SANKALPA GIRI',
        email: '2305154@kiit.ac.in',
      },
      {
        name: '1006_ SHIVANGI',
        email: '21051006@kiit.ac.in',
      },
      {
        name: '3625_SATVIK_BEURA',
        email: '22053625@kiit.ac.in',
      },
      {
        name: '200_SOUMALYA DAS',
        email: '22053200@kiit.ac.in',
      },
      {
        name: 'DRONI SINGH',
        email: '23057064@kiit.ac.in',
      },
      {
        name: 'ROHAN CHOUDHARY',
        email: '2229054@kiit.ac.in',
      },
      {
        name: '3804_Sahil Samal',
        email: '22053804@kiit.ac.in',
      },
    ];

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
    const users = [
      {
        user: { name: 'Ranjit Das', email: '21053420@kiit.ac.in' },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '2nd Year',
      },
      {
        user: { name: '4231_SHIVAM SHAH', email: '22054231@kiit.ac.in' },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '2nd Year',
      },
      {
        user: { name: 'KUNAL SAW', email: '22051344@kiit.ac.in' },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '2nd Year',
      },
      {
        user: { name: '730-ISHU KANT', email: '22052730@kiit.ac.in' },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '2nd Year',
      },
      {
        user: {
          name: '1990_SURYASNATA PAITAL',
          email: '22051990@kiit.ac.in',
        },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '2nd Year',
      },
      {
        user: { name: '2042_RIDDHIMA BISWAS', email: '22052042@kiit.ac.in' },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '2nd Year',
      },
      {
        user: { name: 'AYUSH KUMAR', email: '22051065@kiit.ac.in' },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '2nd Year',
      },
      {
        user: { name: '1898_SRINJOY KUNDU', email: '22051898@kiit.ac.in' },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '2nd Year',
      },
      {
        user: { name: '386_Kashish', email: '2205386@kiit.ac.in' },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '2nd Year',
      },
      {
        user: { name: 'AISWARYA AYASKANT', email: '22053658@kiit.ac.in' },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '2nd Year',
      },
      {
        user: { name: 'DEBJYOTI SHIT', email: '22052978@kiit.ac.in' },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '2nd Year',
      },
      {
        user: { name: 'SANJIV KUMAR', email: '22054265@kiit.ac.in' },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '2nd Year',
      },
      {
        user: { name: 'ANIRAN SAHA', email: '22053137@kiit.ac.in' },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '2nd Year',
      },
      {
        user: { name: 'DEEPAYAN DAS', email: '2205635@kiit.ac.in' },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '2nd Year',
      },
      {
        user: {
          name: '_5935_SHUBAM CHAKRABORTY',
          email: '2205935@kiit.ac.in',
        },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '2nd Year',
      },
      {
        user: { name: '2043_ Ritajit Pal', email: '22052043@kiit.ac.in' },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '2nd Year',
      },
      {
        user: { name: '589-MEGHANSH GOVIL', email: '22051589@kiit.ac.in' },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '2nd Year',
      },
      {
        user: { name: '4077_Ritesh Sah', email: '22054077@kiit.ac.in' },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '2nd Year',
      },
      {
        user: {
          name: '3403-AROSREE SATAPATHY',
          email: '22053403@kiit.ac.in',
        },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '2nd Year',
      },
      {
        user: { name: '4107 Abhisek Singh', email: '22054107@kiit.ac.in' },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '2nd Year',
      },
      {
        user: { name: '514_TANYA CHAUDHARY', email: '2205514@kiit.ac.in' },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '2nd Year',
      },
      {
        user: { name: 'KUMAR ANURAG', email: '22052907@kiit.ac.in' },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '2nd Year',
      },
      {
        user: { name: '4115 - Aadya Sharma', email: '22054115@kiit.ac.in' },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '2nd Year',
      },
      {
        user: { name: '2164_SUBHAM BERA', email: '22052164@kiit.ac.in' },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '2nd Year',
      },
      {
        user: { name: '2060_SINCHAL KAR', email: '22052060@kiit.ac.in' },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '4th Year',
      },
      {
        user: { name: '6201_RANGIN BERA', email: '2206201@kiit.ac.in' },
        paymentScreenshot: null,
        isActive: false,
        branch: 'IT',
        year: '2nd Year',
      },
      {
        user: { name: 'NILOTPAL BASU', email: '22051085@kiit.ac.in' },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '2nd Year',
      },
      {
        user: { name: '3586-AVINASH PATRA', email: '22053586@kiit.ac.in' },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '2nd Year',
      },
      {
        user: { name: '2894_AYUSH RANJAN', email: '22052894@kiit.ac.in' },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '2nd Year',
      },
      {
        user: { name: '145_Arani Maity', email: '22053145@kiit.ac.in' },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '2nd Year',
      },
      {
        user: {
          name: 'TAMONASH MAJUMDER (22053474)',
          email: '22053474@kiit.ac.in',
        },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '2nd Year',
      },
      {
        user: { name: 'SOUMYA KUMAR', email: '22053285@kiit.ac.in' },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '2nd Year',
      },
      {
        user: { name: 'PROGYA BHATTACHARJEE', email: '22053007@kiit.ac.in' },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '2nd Year',
      },
      {
        user: { name: '1699 NISCHAY JAIN', email: '22051699@kiit.ac.in' },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '2nd Year',
      },
      {
        user: { name: '4403ROHIT SHARMA', email: '22054403@kiit.ac.in' },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '4th Year',
      },
      {
        user: { name: '3641 _SOURAV MALLICK', email: '22053641@kiit.ac.in' },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '2nd Year',
      },
      {
        user: {
          name: '1008_SAHASRANSHU SHASTRI',
          email: '22051008@kiit.ac.in',
        },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '2nd Year',
      },
      {
        user: { name: 'ARKOPRAVO DE', email: '22051755@kiit.ac.in' },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '2nd Year',
      },
      {
        user: { name: '356_Niladri Nag', email: '2206356@kiit.ac.in' },
        paymentScreenshot: null,
        isActive: false,
        branch: 'IT',
        year: '2nd Year',
      },
      {
        user: { name: '4149 POORVI SINGH', email: '22054149@kiit.ac.in' },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '2nd Year',
      },
      {
        user: { name: '4347_Dipesh NAYAK', email: '22054347@kiit.ac.in' },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '2nd Year',
      },
      {
        user: { name: '70 Tanishq', email: '22051470@kiit.ac.in' },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '2nd Year',
      },
      {
        user: { name: 'SOUMILI DAS', email: '22052065@kiit.ac.in' },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '2nd Year',
      },
      {
        user: {
          name: '2715_ARYAN RAJ CHOUDHURY',
          email: '22052715@kiit.ac.in',
        },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '2nd Year',
      },
      {
        user: { name: '8168-SubhamMohanty', email: '2228168@kiit.ac.in' },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSSE',
        year: '3rd Year',
      },
      {
        user: { name: '3151_Ayush Kumar', email: '22053151@kiit.ac.in' },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '2nd Year',
      },
      {
        user: { name: 'AMITAV MOHANTY', email: '22053923@kiit.ac.in' },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '4th Year',
      },
      {
        user: { name: 'HARSHIT', email: '2205039@kiit.ac.in' },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '2nd Year',
      },
      {
        user: { name: '4124 BABLI SAHU', email: '22054124@kiit.ac.in' },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '2nd Year',
      },
      {
        user: { name: '334_SRISHTI JAISWAL', email: '2205334@kiit.ac.in' },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '2nd Year',
      },
      {
        user: { name: 'HARSH SANKRIT', email: '22051075@kiit.ac.in' },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '2nd Year',
      },
      {
        user: { name: '8147_Shrinkhala Kumari', email: '2228147@kiit.ac.in' },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSSE',
        year: '2nd Year',
      },
      {
        user: { name: '9062_SAYAN BANERJEE', email: '2229062@kiit.ac.in' },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSCE',
        year: '2nd Year',
      },
      {
        user: { name: '506_SHOVIN BARIK', email: '2205506@kiit.ac.in' },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '2nd Year',
      },
      {
        user: {
          name: '1525_MAYUKH PATTANAYAK',
          email: '22051525@kiit.ac.in',
        },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '2nd Year',
      },
      {
        user: { name: 'SOUNAK DUTTA', email: '22052684@kiit.ac.in' },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '2nd Year',
      },
      {
        user: { name: 'AARUSH AMBAR', email: '22051479@kiit.ac.in' },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '2nd Year',
      },
      {
        user: { name: '130_Kanishk', email: '2205130@kiit.ac.in' },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '2nd Year',
      },
      {
        user: { name: '2429_UTKARSH NIGAM', email: '22052429@kiit.ac.in' },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '2nd Year',
      },
      {
        user: { name: 'VIKRAM KUMAR', email: '22054001@kiit.ac.in' },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '2nd Year',
      },
      {
        user: { name: '4051_Madan Pandey', email: '22054051@kiit.ac.in' },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '2nd Year',
      },
      {
        user: {
          name: '5757_PARIDA PRATYUS SRIMAYSIS',
          email: '2205757@kiit.ac.in',
        },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '2nd Year',
      },
      {
        user: { name: 'SAUMYAJIT CHATTERJEE', email: '2229060@kiit.ac.in' },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSCE',
        year: '2nd Year',
      },
      {
        user: { name: '6397_Samyog Sharma', email: '2206397@kiit.ac.in' },
        paymentScreenshot: null,
        isActive: false,
        branch: 'IT',
        year: '2nd Year',
      },
      {
        user: { name: '6200_Rajtanu', email: '2206200@kiit.ac.in' },
        paymentScreenshot: null,
        isActive: false,
        branch: 'IT',
        year: '2nd Year',
      },
      {
        user: { name: 'SIDDHARTHA', email: '2228065@kiit.ac.in' },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSSE',
        year: '2nd Year',
      },
      {
        user: { name: 'PRADEEP (22054325)', email: '22054325@kiit.ac.in' },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '2nd Year',
      },
      {
        user: { name: 'LOKESH SINGH', email: '22052995@kiit.ac.in' },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '2nd Year',
      },
      {
        user: { name: 'AYUSH DAS', email: '22053412@kiit.ac.in' },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '2nd Year',
      },
      {
        user: { name: 'SAMYA DAS', email: '22052501@kiit.ac.in' },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '2nd Year',
      },
      {
        user: { name: 'AKANKHYA BEURIA', email: '22051227@kiit.ac.in' },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '2nd Year',
      },
      {
        user: { name: '4029_Bibek Chand', email: '22054029@kiit.ac.in' },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '2nd Year',
      },
      {
        user: {
          name: '6125_ shikhar bhadouria',
          email: '2206125@kiit.ac.in',
        },
        paymentScreenshot: null,
        isActive: false,
        branch: 'IT',
        year: '2nd Year',
      },
      {
        user: { name: 'Manish Kumar', email: '22054241@kiit.ac.in' },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '2nd Year',
      },
      {
        user: { name: '2193_ Aparna Sinha', email: '22052193@kiit.ac.in' },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '2nd Year',
      },
      {
        user: {
          name: '1697 Nikhil Aditya Nagvanshi',
          email: '22051697@kiit.ac.in',
        },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '2nd Year',
      },
      {
        user: { name: 'SHAKYA SINHA', email: '2205066@kiit.ac.in' },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '2nd Year',
      },
      {
        user: { name: 'KRISHNENDU PAN', email: '22053782@kiit.ac.in' },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '2nd Year',
      },
      {
        user: { name: '4326_Abhishek', email: '22054326@kiit.ac.in' },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '2nd Year',
      },
      {
        user: { name: 'SUMIT VERMA', email: '22052426@kiit.ac.in' },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '2nd Year',
      },
      {
        user: { name: 'SATYAM RAJ', email: '2228054@kiit.ac.in' },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSSE',
        year: '2nd Year',
      },
      {
        user: { name: 'STUTI SRIVASTAVA', email: '2228068@kiit.ac.in' },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSSE',
        year: '2nd Year',
      },
      {
        user: { name: 'RAHUL PANDEY', email: '22052841@kiit.ac.in' },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '2nd Year',
      },
      {
        user: { name: '4362_NISTHA Panjiyar', email: '22054362@kiit.ac.in' },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '2nd Year',
      },
      {
        user: { name: 'SALONI GOEL', email: '2205497@kiit.ac.in' },
        paymentScreenshot: null,
        isActive: false,
        branch: 'CSE',
        year: '2nd Year',
      },
    ];

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

  async sendTo4thSem() {
    const users = [
      {
        email: '22054139@kiit.ac.in',
      },
      {
        email: '22054140@kiit.ac.in',
      },
      {
        email: '22054141@kiit.ac.in',
      },
      {
        email: '22054142@kiit.ac.in',
      },
      {
        email: '22054143@kiit.ac.in',
      },
      {
        email: '22054145@kiit.ac.in',
      },
      {
        email: '22054146@kiit.ac.in',
      },
      {
        email: '22054147@kiit.ac.in',
      },
      {
        email: '22054148@kiit.ac.in',
      },
      {
        email: '22054150@kiit.ac.in',
      },
      {
        email: '22054151@kiit.ac.in',
      },
      {
        email: '22054152@kiit.ac.in',
      },
      {
        email: '22054153@kiit.ac.in',
      },
      {
        email: '22054155@kiit.ac.in',
      },
      {
        email: '22054156@kiit.ac.in',
      },
      {
        email: '22054157@kiit.ac.in',
      },
      {
        email: '22054158@kiit.ac.in',
      },
      {
        email: '22054159@kiit.ac.in',
      },
      {
        email: '22054160@kiit.ac.in',
      },
      {
        email: '22054161@kiit.ac.in',
      },
      {
        email: '22054162@kiit.ac.in',
      },
      {
        email: '22054163@kiit.ac.in',
      },
      {
        email: '22054164@kiit.ac.in',
      },
      {
        email: '22054165@kiit.ac.in',
      },
      {
        email: '22054166@kiit.ac.in',
      },
      {
        email: '22054167@kiit.ac.in',
      },
      {
        email: '22054168@kiit.ac.in',
      },
      {
        email: '22054169@kiit.ac.in',
      },
      {
        email: '22054170@kiit.ac.in',
      },
      {
        email: '22054171@kiit.ac.in',
      },
      {
        email: '22054172@kiit.ac.in',
      },
      {
        email: '22054174@kiit.ac.in',
      },
      {
        email: '22054176@kiit.ac.in',
      },
      {
        email: '22054177@kiit.ac.in',
      },
      {
        email: '22054178@kiit.ac.in',
      },
      {
        email: '22054179@kiit.ac.in',
      },
      {
        email: '22054180@kiit.ac.in',
      },
      {
        email: '22054181@kiit.ac.in',
      },
      {
        email: '22054182@kiit.ac.in',
      },
      {
        email: '22054183@kiit.ac.in',
      },
      {
        email: '22054184@kiit.ac.in',
      },
      {
        email: '22054186@kiit.ac.in',
      },
      {
        email: '22054187@kiit.ac.in',
      },
      {
        email: '22054188@kiit.ac.in',
      },
      {
        email: '22054189@kiit.ac.in',
      },
      {
        email: '22054190@kiit.ac.in',
      },
      {
        email: '22054191@kiit.ac.in',
      },
      {
        email: '22054192@kiit.ac.in',
      },
      {
        email: '22054193@kiit.ac.in',
      },
      {
        email: '22054194@kiit.ac.in',
      },
      {
        email: '22054197@kiit.ac.in',
      },
      {
        email: '22054198@kiit.ac.in',
      },
      {
        email: '22054199@kiit.ac.in',
      },
      {
        email: '22054200@kiit.ac.in',
      },
      {
        email: '22054201@kiit.ac.in',
      },
      {
        email: '22054202@kiit.ac.in',
      },
      {
        email: '22054203@kiit.ac.in',
      },
      {
        email: '22054208@kiit.ac.in',
      },
      {
        email: '22054209@kiit.ac.in',
      },
      {
        email: '22054210@kiit.ac.in',
      },
      {
        email: '22054211@kiit.ac.in',
      },
      {
        email: '22054212@kiit.ac.in',
      },
      {
        email: '22054213@kiit.ac.in',
      },
      {
        email: '22054214@kiit.ac.in',
      },
      {
        email: '22054215@kiit.ac.in',
      },
      {
        email: '22054216@kiit.ac.in',
      },
      {
        email: '22054217@kiit.ac.in',
      },
      {
        email: '22054218@kiit.ac.in',
      },
      {
        email: '22054219@kiit.ac.in',
      },
      {
        email: '22054220@kiit.ac.in',
      },
      {
        email: '22054222@kiit.ac.in',
      },
      {
        email: '22054223@kiit.ac.in',
      },
      {
        email: '22054224@kiit.ac.in',
      },
      {
        email: '22054225@kiit.ac.in',
      },
      {
        email: '22054226@kiit.ac.in',
      },
      {
        email: '22054227@kiit.ac.in',
      },
      {
        email: '22054228@kiit.ac.in',
      },
      {
        email: '22054229@kiit.ac.in',
      },
      {
        email: '22054230@kiit.ac.in',
      },
      {
        email: '22054232@kiit.ac.in',
      },
      {
        email: '22054233@kiit.ac.in',
      },
      {
        email: '22054234@kiit.ac.in',
      },
      {
        email: '22054235@kiit.ac.in',
      },
      {
        email: '22054236@kiit.ac.in',
      },
      {
        email: '22054237@kiit.ac.in',
      },
      {
        email: '22054238@kiit.ac.in',
      },
      {
        email: '22054239@kiit.ac.in',
      },
      {
        email: '22054240@kiit.ac.in',
      },
      {
        email: '22054241@kiit.ac.in',
      },
      {
        email: '22054242@kiit.ac.in',
      },
      {
        email: '22054243@kiit.ac.in',
      },
      {
        email: '22054244@kiit.ac.in',
      },
      {
        email: '22054245@kiit.ac.in',
      },
      {
        email: '22054246@kiit.ac.in',
      },
      {
        email: '22054248@kiit.ac.in',
      },
      {
        email: '22054249@kiit.ac.in',
      },
      {
        email: '22054250@kiit.ac.in',
      },
      {
        email: '22054251@kiit.ac.in',
      },
      {
        email: '22054254@kiit.ac.in',
      },
      {
        email: '22054255@kiit.ac.in',
      },
      {
        email: '22054256@kiit.ac.in',
      },
      {
        email: '22054257@kiit.ac.in',
      },
      {
        email: '22054258@kiit.ac.in',
      },
      {
        email: '22054259@kiit.ac.in',
      },
      {
        email: '22054261@kiit.ac.in',
      },
      {
        email: '22054262@kiit.ac.in',
      },
      {
        email: '22054263@kiit.ac.in',
      },
      {
        email: '22054264@kiit.ac.in',
      },
      {
        email: '22054266@kiit.ac.in',
      },
      {
        email: '22054267@kiit.ac.in',
      },
      {
        email: '22054269@kiit.ac.in',
      },
      {
        email: '22054270@kiit.ac.in',
      },
      {
        email: '22054271@kiit.ac.in',
      },
      {
        email: '22054272@kiit.ac.in',
      },
      {
        email: '22054274@kiit.ac.in',
      },
      {
        email: '22054275@kiit.ac.in',
      },
      {
        email: '22054276@kiit.ac.in',
      },
      {
        email: '22054277@kiit.ac.in',
      },
      {
        email: '22054278@kiit.ac.in',
      },
      {
        email: '22054279@kiit.ac.in',
      },
      {
        email: '22054280@kiit.ac.in',
      },
      {
        email: '22054281@kiit.ac.in',
      },
      {
        email: '22054282@kiit.ac.in',
      },
      {
        email: '22054283@kiit.ac.in',
      },
      {
        email: '22054284@kiit.ac.in',
      },
      {
        email: '22054285@kiit.ac.in',
      },
      {
        email: '22054287@kiit.ac.in',
      },
      {
        email: '22054288@kiit.ac.in',
      },
      {
        email: '22054289@kiit.ac.in',
      },
      {
        email: '22054290@kiit.ac.in',
      },
      {
        email: '22054291@kiit.ac.in',
      },
      {
        email: '22054292@kiit.ac.in',
      },
      {
        email: '22054294@kiit.ac.in',
      },
      {
        email: '22054295@kiit.ac.in',
      },
      {
        email: '22054296@kiit.ac.in',
      },
      {
        email: '22054299@kiit.ac.in',
      },
      {
        email: '22054300@kiit.ac.in',
      },
      {
        email: '22054301@kiit.ac.in',
      },
      {
        email: '22054302@kiit.ac.in',
      },
      {
        email: '22054303@kiit.ac.in',
      },
      {
        email: '22054304@kiit.ac.in',
      },
      {
        email: '22054305@kiit.ac.in',
      },
      {
        email: '22054306@kiit.ac.in',
      },
      {
        email: '22054307@kiit.ac.in',
      },
      {
        email: '22054308@kiit.ac.in',
      },
      {
        email: '22054310@kiit.ac.in',
      },
      {
        email: '22054311@kiit.ac.in',
      },
      {
        email: '22054313@kiit.ac.in',
      },
      {
        email: '22054314@kiit.ac.in',
      },
      {
        email: '22054315@kiit.ac.in',
      },
      {
        email: '22054316@kiit.ac.in',
      },
      {
        email: '22054318@kiit.ac.in',
      },
      {
        email: '22054319@kiit.ac.in',
      },
      {
        email: '22054320@kiit.ac.in',
      },
      {
        email: '22054322@kiit.ac.in',
      },
      {
        email: '22054323@kiit.ac.in',
      },
      {
        email: '22054324@kiit.ac.in',
      },
      {
        email: '22054325@kiit.ac.in',
      },
      {
        email: '22054326@kiit.ac.in',
      },
      {
        email: '22054327@kiit.ac.in',
      },
      {
        email: '22054328@kiit.ac.in',
      },
      {
        email: '22054330@kiit.ac.in',
      },
      {
        email: '22054332@kiit.ac.in',
      },
      {
        email: '22054333@kiit.ac.in',
      },
      {
        email: '22054334@kiit.ac.in',
      },
      {
        email: '22054335@kiit.ac.in',
      },
      {
        email: '22054336@kiit.ac.in',
      },
      {
        email: '22054337@kiit.ac.in',
      },
      {
        email: '22054339@kiit.ac.in',
      },
      {
        email: '22054340@kiit.ac.in',
      },
      {
        email: '22054341@kiit.ac.in',
      },
      {
        email: '22054342@kiit.ac.in',
      },
      {
        email: '22054343@kiit.ac.in',
      },
      {
        email: '22054344@kiit.ac.in',
      },
      {
        email: '22054345@kiit.ac.in',
      },
      {
        email: '22054348@kiit.ac.in',
      },
      {
        email: '22054350@kiit.ac.in',
      },
      {
        email: '22054352@kiit.ac.in',
      },
      {
        email: '22054353@kiit.ac.in',
      },
      {
        email: '22054354@kiit.ac.in',
      },
      {
        email: '22054355@kiit.ac.in',
      },
      {
        email: '22054356@kiit.ac.in',
      },
      {
        email: '22054357@kiit.ac.in',
      },
      {
        email: '22054358@kiit.ac.in',
      },
      {
        email: '22054360@kiit.ac.in',
      },
      {
        email: '22054361@kiit.ac.in',
      },
      {
        email: '22054363@kiit.ac.in',
      },
      {
        email: '22054366@kiit.ac.in',
      },
      {
        email: '22054367@kiit.ac.in',
      },
      {
        email: '22054368@kiit.ac.in',
      },
      {
        email: '22054369@kiit.ac.in',
      },
      {
        email: '22054370@kiit.ac.in',
      },
      {
        email: '22054371@kiit.ac.in',
      },
      {
        email: '22054372@kiit.ac.in',
      },
      {
        email: '22054373@kiit.ac.in',
      },
      {
        email: '22054374@kiit.ac.in',
      },
      {
        email: '22054376@kiit.ac.in',
      },
      {
        email: '22054377@kiit.ac.in',
      },
      {
        email: '22054378@kiit.ac.in',
      },
      {
        email: '22054379@kiit.ac.in',
      },
      {
        email: '22054380@kiit.ac.in',
      },
      {
        email: '22054381@kiit.ac.in',
      },
      {
        email: '22054382@kiit.ac.in',
      },
      {
        email: '22054383@kiit.ac.in',
      },
      {
        email: '22054385@kiit.ac.in',
      },
      {
        email: '22054386@kiit.ac.in',
      },
      {
        email: '22054387@kiit.ac.in',
      },
      {
        email: '22054388@kiit.ac.in',
      },
      {
        email: '22054389@kiit.ac.in',
      },
      {
        email: '22054391@kiit.ac.in',
      },
      {
        email: '22054392@kiit.ac.in',
      },
      {
        email: '22054394@kiit.ac.in',
      },
      {
        email: '22054395@kiit.ac.in',
      },
      {
        email: '22054396@kiit.ac.in',
      },
      {
        email: '22054397@kiit.ac.in',
      },
      {
        email: '22054398@kiit.ac.in',
      },
      {
        email: '22054399@kiit.ac.in',
      },
      {
        email: '22054400@kiit.ac.in',
      },
      {
        email: '22054401@kiit.ac.in',
      },
      {
        email: '22054402@kiit.ac.in',
      },
      {
        email: '22054404@kiit.ac.in',
      },
      {
        email: '22054405@kiit.ac.in',
      },
      {
        email: '22054406@kiit.ac.in',
      },
      {
        email: '22054407@kiit.ac.in',
      },
      {
        email: '22054408@kiit.ac.in',
      },
      {
        email: '22054409@kiit.ac.in',
      },
      {
        email: '22054410@kiit.ac.in',
      },
      {
        email: '22054411@kiit.ac.in',
      },
      {
        email: '22054412@kiit.ac.in',
      },
      {
        email: '22054413@kiit.ac.in',
      },
      {
        email: '22054414@kiit.ac.in',
      },
      {
        email: '22054415@kiit.ac.in',
      },
      {
        email: '22054416@kiit.ac.in',
      },
      {
        email: '22054417@kiit.ac.in',
      },
      {
        email: '22054418@kiit.ac.in',
      },
      {
        email: '22054419@kiit.ac.in',
      },
      {
        email: '22054420@kiit.ac.in',
      },
      {
        email: '22054421@kiit.ac.in',
      },
      {
        email: '22054422@kiit.ac.in',
      },
      {
        email: '22054424@kiit.ac.in',
      },
      {
        email: '22054425@kiit.ac.in',
      },
      {
        email: '22054426@kiit.ac.in',
      },
      {
        email: '22054427@kiit.ac.in',
      },
      {
        email: '22054428@kiit.ac.in',
      },
      {
        email: '22054429@kiit.ac.in',
      },
      {
        email: '22054430@kiit.ac.in',
      },
      {
        email: '22054431@kiit.ac.in',
      },
      {
        email: '22054432@kiit.ac.in',
      },
      {
        email: '22054433@kiit.ac.in',
      },
      {
        email: '22054434@kiit.ac.in',
      },
      {
        email: '22054435@kiit.ac.in',
      },
      {
        email: '22054437@kiit.ac.in',
      },
      {
        email: '22054438@kiit.ac.in',
      },
      {
        email: '22054439@kiit.ac.in',
      },
      {
        email: '22054440@kiit.ac.in',
      },
      {
        email: '22054441@kiit.ac.in',
      },
      {
        email: '22054442@kiit.ac.in',
      },
      {
        email: '22054443@kiit.ac.in',
      },
      {
        email: '22054444@kiit.ac.in',
      },
      {
        email: '22054445@kiit.ac.in',
      },
      {
        email: '22054446@kiit.ac.in',
      },
      {
        email: '22054447@kiit.ac.in',
      },
      {
        email: '22054448@kiit.ac.in',
      },
      {
        email: '22054449@kiit.ac.in',
      },
      {
        email: '22054450@kiit.ac.in',
      },
      {
        email: '22054451@kiit.ac.in',
      },
      {
        email: '22054452@kiit.ac.in',
      },
      {
        email: '22054453@kiit.ac.in',
      },
      {
        email: '22054455@kiit.ac.in',
      },
      {
        email: '22054456@kiit.ac.in',
      },
      {
        email: '22054457@kiit.ac.in',
      },
      {
        email: '22054458@kiit.ac.in',
      },
      {
        email: '22054459@kiit.ac.in',
      },
      {
        email: '22054460@kiit.ac.in',
      },
      {
        email: '22054461@kiit.ac.in',
      },
      {
        email: '22054462@kiit.ac.in',
      },
      {
        email: '22054464@kiit.ac.in',
      },
      {
        email: '22054465@kiit.ac.in',
      },
      {
        email: '22054466@kiit.ac.in',
      },
      {
        email: '22054467@kiit.ac.in',
      },
      {
        email: '22054468@kiit.ac.in',
      },
      {
        email: '22054469@kiit.ac.in',
      },
      {
        email: '22054470@kiit.ac.in',
      },
      {
        email: '22054471@kiit.ac.in',
      },
      {
        email: '22054472@kiit.ac.in',
      },
      {
        email: '22054473@kiit.ac.in',
      },
      {
        email: '22054474@kiit.ac.in',
      },
      {
        email: '23057001@kiit.ac.in',
      },
      {
        email: '23057002@kiit.ac.in',
      },
      {
        email: '23057003@kiit.ac.in',
      },
      {
        email: '23057004@kiit.ac.in',
      },
      {
        email: '23057005@kiit.ac.in',
      },
      {
        email: '23057007@kiit.ac.in',
      },
      {
        email: '23057008@kiit.ac.in',
      },
      {
        email: '23057009@kiit.ac.in',
      },
      {
        email: '23057010@kiit.ac.in',
      },
      {
        email: '23057011@kiit.ac.in',
      },
      {
        email: '23057012@kiit.ac.in',
      },
      {
        email: '23057013@kiit.ac.in',
      },
      {
        email: '23057014@kiit.ac.in',
      },
      {
        email: '23057015@kiit.ac.in',
      },
      {
        email: '23057016@kiit.ac.in',
      },
      {
        email: '23057017@kiit.ac.in',
      },
      {
        email: '23057018@kiit.ac.in',
      },
      {
        email: '23057019@kiit.ac.in',
      },
      {
        email: '23057020@kiit.ac.in',
      },
      {
        email: '23057021@kiit.ac.in',
      },
      {
        email: '23057022@kiit.ac.in',
      },
      {
        email: '23057023@kiit.ac.in',
      },
      {
        email: '23057024@kiit.ac.in',
      },
      {
        email: '23057026@kiit.ac.in',
      },
      {
        email: '23057027@kiit.ac.in',
      },
      {
        email: '23057028@kiit.ac.in',
      },
      {
        email: '23057029@kiit.ac.in',
      },
      {
        email: '23057030@kiit.ac.in',
      },
      {
        email: '23057031@kiit.ac.in',
      },
      {
        email: '23057032@kiit.ac.in',
      },
      {
        email: '23057033@kiit.ac.in',
      },
      {
        email: '23057034@kiit.ac.in',
      },
      {
        email: '23057035@kiit.ac.in',
      },
      {
        email: '23057036@kiit.ac.in',
      },
      {
        email: '23057037@kiit.ac.in',
      },
      {
        email: '23057038@kiit.ac.in',
      },
      {
        email: '23057039@kiit.ac.in',
      },
      {
        email: '23057040@kiit.ac.in',
      },
      {
        email: '23057041@kiit.ac.in',
      },
      {
        email: '23057042@kiit.ac.in',
      },
      {
        email: '23057043@kiit.ac.in',
      },
      {
        email: '23057044@kiit.ac.in',
      },
      {
        email: '23057045@kiit.ac.in',
      },
      {
        email: '23057047@kiit.ac.in',
      },
      {
        email: '23057048@kiit.ac.in',
      },
      {
        email: '23057049@kiit.ac.in',
      },
      {
        email: '23057052@kiit.ac.in',
      },
      {
        email: '23057053@kiit.ac.in',
      },
      {
        email: '23057054@kiit.ac.in',
      },
      {
        email: '23057055@kiit.ac.in',
      },
      {
        email: '23057056@kiit.ac.in',
      },
      {
        email: '23057057@kiit.ac.in',
      },
      {
        email: '23057058@kiit.ac.in',
      },
      {
        email: '23057059@kiit.ac.in',
      },
      {
        email: '23057061@kiit.ac.in',
      },
      {
        email: '23057062@kiit.ac.in',
      },
      {
        email: '23057063@kiit.ac.in',
      },
    ];

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
        'support@kiitconnect.live',
        1,
      );
    } catch (error) {
      console.log(error);
    }
  }

  async testCacheService() {
    try {
        const keys = await this.cacheService.get("test");
      const keys2 = await this.cacheService.get("sanjaysunar442@gmail.com");
      if(!keys){
        await this.cacheService.set("test","Hello World");
        return "Hello World From Non Cache";
      }
      return {
        keys:keys,
        keys2:keys2
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
      throw new InternalServerErrorException("Internal server Error");
    }
  }
}
