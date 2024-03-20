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
    const users = []
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
      "name": "417-SUSMITA PAL",
      "email": "2105417@kiit.ac.in"
      },
      {
      "name": "KANISHK DADHICH",
      "email": "2205042@kiit.ac.in"
      },
      {
      "name": "322_SIDHARTHA KUMAR DAS",
      "email": "2105322@kiit.ac.in"
      },
      {
      "name": "5989_RINKESH KUMAR SINHA",
      "email": "2105989@kiit.ac.in"
      },
      {
      "name": "5495_SHRUTI KUMARI",
      "email": "2105495@kiit.ac.in"
      },
      {
      "name": "515_ PRATYUSH PANY",
      "email": "21052515@kiit.ac.in"
      },
      {
      "name": "748_Sayan Chattopadhyay",
      "email": "2105748@kiit.ac.in"
      },
      {
      "name": "2151_Chetan Dev Maskara",
      "email": "21052151@kiit.ac.in"
      },
      {
      "name": "3818 SUBHAM MOHARANA",
      "email": "22053818@kiit.ac.in"
      },
      {
      "name": "2628_AyushKumar",
      "email": "22052628@kiit.ac.in"
      },
      {
      "name": "4038_Devraj",
      "email": "22054038@kiit.ac.in"
      },
      {
      "name": "750_Piyush",
      "email": "21051750@kiit.ac.in"
      },
      {
      "name": "2302_ADITYA SHUKLA",
      "email": "21052302@kiit.ac.in"
      },
      {
      "name": "SANJIV KUMAR",
      "email": "22054265@kiit.ac.in"
      },
      {
      "name": "073_SRITAM DUTTA",
      "email": "2105073@kiit.ac.in"
      },
      {
      "name": "065_SAURAV KUMAR",
      "email": "2105065@kiit.ac.in"
      },
      {
      "name": "ADITI SINHA",
      "email": "22051046@kiit.ac.in"
      },
      {
      "name": "2133_ Adrita Mohanty",
      "email": "21052133@kiit.ac.in"
      },
      {
      "name": "1191_SANKALP SINGH",
      "email": "22051191@kiit.ac.in"
      },
      {
      "name": "1426 - Shirsha Chakraborty",
      "email": "21051426@kiit.ac.in"
      },
      {
      "name": "1650_GOWTHAM DAS",
      "email": "21051650@kiit.ac.in"
      },
      {
      "name": "2700_SAKSHAM SHARMA",
      "email": "21052700@kiit.ac.in"
      },
      {
      "name": "4035_Chiranjibi Sah",
      "email": "22054035@kiit.ac.in"
      },
      {
      "name": "038_Mohit Yadav",
      "email": "2105038@kiit.ac.in"
      },
      {
      "name": "700_Archisha Verma",
      "email": "2105700@kiit.ac.in"
      },
      {
      "name": "239 PANKHURI KUMARI",
      "email": "2105239@kiit.ac.in"
      },
      {
      "name": "VISHALAKSHI KUMARI",
      "email": "22054003@kiit.ac.in"
      },
      {
      "name": "3466_UTKARSH SHRESTHA",
      "email": "21053466@kiit.ac.in"
      },
      {
      "name": "3319_SAPTHAK MOHAJON TURJYA",
      "email": "21053319@kiit.ac.in"
      },
      {
      "name": "DEEPAYAN DAS",
      "email": "2205635@kiit.ac.in"
      },
      {
      "name": "SOUMYA",
      "email": "22052419@kiit.ac.in"
      },
      {
      "name": "368_ASHUTOSH JHA",
      "email": "2205368@kiit.ac.in"
      },
      {
      "name": "8059_Aarsi Singh",
      "email": "2328059@kiit.ac.in"
      },
      {
      "name": "_5935_SHUBAM CHAKRABORTY",
      "email": "2205935@kiit.ac.in"
      },
      {
      "name": "400_ ROHIT NAYAK",
      "email": "2105400@kiit.ac.in"
      },
      {
      "name": "548_Kajal Kashyap",
      "email": "2105548@kiit.ac.in"
      },
      {
      "name": "4015_ Anil",
      "email": "22054015@kiit.ac.in"
      },
      {
      "name": "2499_ Raghavendra",
      "email": "22052499@kiit.ac.in"
      },
      {
      "name": "Bibhukalyani",
      "email": "2105787@kiit.ac.in"
      },
      {
      "name": "860 Ananya",
      "email": "2105860@kiit.ac.in"
      },
      {
      "name": "3398_Rishav Jha",
      "email": "21053398@kiit.ac.in"
      },
      {
      "name": "2454_SOUMYA RANJAN SAMAL",
      "email": "21052454@kiit.ac.in"
      },
      {
      "name": "978_PALLAVI",
      "email": "2105978@kiit.ac.in"
      },
      {
      "name": "418- SWARNADIP BHOWMIK",
      "email": "2105418@kiit.ac.in"
      },
      {
      "name": "3289_MANDIP SAH",
      "email": "21053289@kiit.ac.in"
      },
      {
      "name": "2043_ Ritajit Pal",
      "email": "22052043@kiit.ac.in"
      },
      {
      "name": "1543_ANUROOP ROY",
      "email": "21051543@kiit.ac.in"
      },
      {
      "name": "2776 Swarnim Tigga",
      "email": "22052776@kiit.ac.in"
      },
      {
      "name": "232 PARTH BATRA",
      "email": "21053232@kiit.ac.in"
      },
      {
      "name": "589-MEGHANSH GOVIL",
      "email": "22051589@kiit.ac.in"
      },
      {
      "name": "3681 - DEBESH ACHARYA",
      "email": "22053681@kiit.ac.in"
      },
      {
      "name": "629_MANDIRA GHOSH",
      "email": "2105629@kiit.ac.in"
      },
      {
      "name": "1437-SOUMYAKANT PARIDA",
      "email": "21051437@kiit.ac.in"
      },
      {
      "name": "2278_Shreyansh Srivastava",
      "email": "21052278@kiit.ac.in"
      },
      {
      "name": "2375_SWATI SUMAN SAHU",
      "email": "21052375@kiit.ac.in"
      },
      {
      "name": "6078-TATHAGATA KUNDU",
      "email": "2106078@kiit.ac.in"
      },
      {
      "name": "6215_Harshvardhan Ojha",
      "email": "2106215@kiit.ac.in"
      },
      {
      "name": "ISHAAN MISHRA",
      "email": "22052819@kiit.ac.in"
      },
      {
      "name": "6156_SHRUTI SACHAN",
      "email": "2106156@kiit.ac.in"
      },
      {
      "name": "DEBOTTAM MANDAL",
      "email": "22053155@kiit.ac.in"
      },
      {
      "name": "PRANJAL",
      "email": "21051835@kiit.ac.in"
      },
      {
      "name": "3116-SOUMI NANDY",
      "email": "22053116@kiit.ac.in"
      },
      {
      "name": "4138-ADITYA KUMAR TIWARI",
      "email": "22054138@kiit.ac.in"
      },
      {
      "name": "8106_AYUSH SRIVASTAVA",
      "email": "2228106@kiit.ac.in"
      },
      {
      "name": "1507_Samayita Bepari",
      "email": "21051507@kiit.ac.in"
      },
      {
      "name": "2678_MOUPIYA CHATTERJEE",
      "email": "21052678@kiit.ac.in"
      },
      {
      "name": "2186_Satyaki Ghosh",
      "email": "21052186@kiit.ac.in"
      },
      {
      "name": "1801_ARNAV DEY",
      "email": "21051801@kiit.ac.in"
      },
      {
      "name": "3471_Manju Kapadi",
      "email": "21053471@kiit.ac.in"
      },
      {
      "name": "976_NISHANT SINGH",
      "email": "2105976@kiit.ac.in"
      },
      {
      "name": "4107 Abhisek Singh",
      "email": "22054107@kiit.ac.in"
      },
      {
      "name": "708 APURVA SINHA",
      "email": "22052708@kiit.ac.in"
      },
      {
      "name": "3303_Prajit Kumar Yadav",
      "email": "21053303@kiit.ac.in"
      },
      {
      "name": "6199_AYUSH PAL",
      "email": "2106199@kiit.ac.in"
      },
      {
      "name": "6180_Akash Ghosh",
      "email": "2106180@kiit.ac.in"
      },
      {
      "name": "1394_DIMPLE PATEL",
      "email": "21051394@kiit.ac.in"
      },
      {
      "name": "RITIKA CHATTERJEE",
      "email": "2229144@kiit.ac.in"
      },
      {
      "name": "260_ANINDYA BAG",
      "email": "2105260@kiit.ac.in"
      },
      {
      "name": "210_MOHIT SHEKHAR",
      "email": "2105210@kiit.ac.in"
      },
      {
      "name": "1156-DEV MODAK",
      "email": "22051156@kiit.ac.in"
      },
      {
      "name": "123_ABHA SRIVASTAVA",
      "email": "2128123@kiit.ac.in"
      },
      {
      "name": "001_ABHIJEET KUMAR",
      "email": "2105001@kiit.ac.in"
      },
      {
      "name": "2245_SOUMYADIP MALASH (Dustu)",
      "email": "22052245@kiit.ac.in"
      },
      {
      "name": "1486_Moumita Sutradhar",
      "email": "21051486@kiit.ac.in"
      },
      {
      "name": "2892 Abanti",
      "email": "21052892@kiit.ac.in"
      },
      {
      "name": "1833_PRANABIT PRADHAN",
      "email": "21051833@kiit.ac.in"
      },
      {
      "name": "2797 Subhadipsasmal",
      "email": "21052797@kiit.ac.in"
      },
      {
      "name": "5799_AYUSH KEDIA",
      "email": "2205799@kiit.ac.in"
      },
      {
      "name": "3222 _TANISHA MOHAPATRA",
      "email": "21053222@kiit.ac.in"
      },
      {
      "name": "8139_ DIVANSHU",
      "email": "2128139@kiit.ac.in"
      },
      {
      "name": "Rajobrata Das",
      "email": "2105297@kiit.ac.in"
      },
      {
      "name": "2756_DIPISHA SHIVANGI",
      "email": "21052756@kiit.ac.in"
      },
      {
      "name": "5913_PRAKHAR BANSAL",
      "email": "2205913@kiit.ac.in"
      },
      {
      "name": "AMAN BAJPAI",
      "email": "22051232@kiit.ac.in"
      },
      {
      "name": "316_RAHUL LENKA",
      "email": "2205316@kiit.ac.in"
      },
      {
      "name": "6117_HIMANSHU DASH",
      "email": "2106117@kiit.ac.in"
      },
      {
      "name": "PRAYAG PATRO",
      "email": "23051288@kiit.ac.in"
      },
      {
      "name": "PRASUN SHAH",
      "email": "23051849@kiit.ac.in"
      },
      {
      "name": "Abhigya Kashyap",
      "email": "23053906@kiit.ac.in"
      },
      {
      "name": "514_TANYA CHAUDHARY",
      "email": "2205514@kiit.ac.in"
      },
      {
      "name": "SUBHRANGSHU CHATTERJEE",
      "email": "22053819@kiit.ac.in"
      },
      {
      "name": "4185 TANISA VERMA",
      "email": "22054185@kiit.ac.in"
      },
      {
      "name": "2144_Anushka Singh",
      "email": "21052144@kiit.ac.in"
      },
      {
      "name": "3274_BIDUR JHA",
      "email": "21053274@kiit.ac.in"
      },
      {
      "name": "2759_GOURAV CHAKRABORTY",
      "email": "21052759@kiit.ac.in"
      },
      {
      "name": "457_ FIONA DASH",
      "email": "2105457@kiit.ac.in"
      },
      {
      "name": "2121_Isha Mittal",
      "email": "22052121@kiit.ac.in"
      },
      {
      "name": "1267_TAMANNA PATNAIK",
      "email": "21051267@kiit.ac.in"
      },
      {
      "name": "3518_ARYAN MISHRA",
      "email": "23053518@kiit.ac.in"
      },
      {
      "name": "1352 MIHIR RAJ",
      "email": "23051352@kiit.ac.in"
      },
      {
      "name": "RITESH KUMAR",
      "email": "22051099@kiit.ac.in"
      },
      {
      "name": "903 SUMIT MANDAL",
      "email": "2305903@kiit.ac.in"
      },
      {
      "name": "SOUMILI DAS",
      "email": "2229181@kiit.ac.in"
      },
      {
      "name": "3287_Kunal Jha",
      "email": "21053287@kiit.ac.in"
      },
      {
      "name": "SWAYAMJIT SAHOO",
      "email": "2305826@kiit.ac.in"
      },
      {
      "name": "SAAKSSHI PODDER",
      "email": "23051943@kiit.ac.in"
      },
      {
      "name": "RAVIKANT DIWAKAR",
      "email": "21051499@kiit.ac.in"
      },
      {
      "name": "209_Aryan Kaushal",
      "email": "21051209@kiit.ac.in"
      },
      {
      "name": "1427_ISHITA CHATTERJEE",
      "email": "22051427@kiit.ac.in"
      },
      {
      "name": "568_ADARSH ROUT",
      "email": "22053568@kiit.ac.in"
      },
      {
      "name": "6146_SHRIYANS MUKHERJEE",
      "email": "2306146@kiit.ac.in"
      },
      {
      "name": "VIVEK MAHATO",
      "email": "22053126@kiit.ac.in"
      },
      {
      "name": "SWARNAVO MALLIK",
      "email": "22053386@kiit.ac.in"
      },
      {
      "name": "70 SAMPAD GHOSH",
      "email": "2130070@kiit.ac.in"
      },
      {
      "name": "2386_AKASH DUTTACHOWDHURY",
      "email": "21052386@kiit.ac.in"
      },
      {
      "name": "Naresh Sah",
      "email": "23053753@kiit.ac.in"
      },
      {
      "name": "6314_ASHISH PATEL",
      "email": "2106314@kiit.ac.in"
      },
      {
      "name": "4115 - Aadya Sharma",
      "email": "22054115@kiit.ac.in"
      },
      {
      "name": "3437_PRIYANKA KUMARI",
      "email": "21053437@kiit.ac.in"
      },
      {
      "name": "723_Muskan",
      "email": "2105723@kiit.ac.in"
      },
      {
      "name": "1469 SUMIT BARMAN",
      "email": "22051469@kiit.ac.in"
      },
      {
      "name": "SHASHANK RAJ",
      "email": "22052756@kiit.ac.in"
      },
      {
      "name": "294_YASH KUMAR SINGH",
      "email": "21052294@kiit.ac.in"
      },
      {
      "name": "156_SHAKSHAM SAINI",
      "email": "2205156@kiit.ac.in"
      },
      {
      "name": "NITISH KUMAR",
      "email": "22052831@kiit.ac.in"
      },
      {
      "name": "486_ARYAN KASHYAP",
      "email": "21052486@kiit.ac.in"
      },
      {
      "name": "2164_SUBHAM BERA",
      "email": "22052164@kiit.ac.in"
      },
      {
      "name": "SHAKTI SAH",
      "email": "23053855@kiit.ac.in"
      },
      {
      "name": "2060_SINCHAL KAR",
      "email": "22052060@kiit.ac.in"
      },
      {
      "name": "SATYAM PATEL",
      "email": "23052513@kiit.ac.in"
      },
      {
      "name": "1214_VINAYAK TIWARI",
      "email": "22051214@kiit.ac.in"
      },
      {
      "name": "626_HIMANSHU SHARMA",
      "email": "2105626@kiit.ac.in"
      },
      {
      "name": "JAGAJIT DAS",
      "email": "22053600@kiit.ac.in"
      },
      {
      "name": "068_Nishant Kumar",
      "email": "21051068@kiit.ac.in"
      },
      {
      "name": "43_ANSHUMAN SAHOO",
      "email": "2130043@kiit.ac.in"
      },
      {
      "name": "1427_SHIVPREET PADHI",
      "email": "21051427@kiit.ac.in"
      },
      {
      "name": "018_ARITRA MUHURI",
      "email": "2105018@kiit.ac.in"
      },
      {
      "name": "NIKHIL SINGH",
      "email": "2229131@kiit.ac.in"
      },
      {
      "name": "ARMAAN PANDEY",
      "email": "2205716@kiit.ac.in"
      },
      {
      "name": "2775_OM PATEL",
      "email": "21052775@kiit.ac.in"
      },
      {
      "name": "NITESH PATNAIK",
      "email": "2206357@kiit.ac.in"
      },
      {
      "name": "214 PIYUSH KUMAR",
      "email": "21053214@kiit.ac.in"
      },
      {
      "name": "3422_KRISHNA SHAH",
      "email": "21053422@kiit.ac.in"
      },
      {
      "name": "2232_Anshuman",
      "email": "21052232@kiit.ac.in"
      },
      {
      "name": "2866_SAMRIDDHI SHARMA",
      "email": "21052866@kiit.ac.in"
      },
      {
      "name": "586_Gourab Baroi",
      "email": "21052586@kiit.ac.in"
      },
      {
      "name": "SREEJA UPADHYAYA",
      "email": "23057051@kiit.ac.in"
      },
      {
      "name": "710 ADRIJA DAS",
      "email": "21051710@kiit.ac.in"
      },
      {
      "name": "465_YASH PRATAP SINGH",
      "email": "21052465@kiit.ac.in"
      },
      {
      "name": "107_Anushka Bajpai",
      "email": "2205107@kiit.ac.in"
      },
      {
      "name": "1423_SAMRAT CHAKRABORTY",
      "email": "21051423@kiit.ac.in"
      },
      {
      "name": "4098 U T K A R S H",
      "email": "22054098@kiit.ac.in"
      },
      {
      "name": "5950_ARIN CHOUDHARY",
      "email": "2105950@kiit.ac.in"
      },
      {
      "name": "2830 DEBANGAN BHATTACHARYYA",
      "email": "21052830@kiit.ac.in"
      },
      {
      "name": "319_SARTHAK AGARWAL",
      "email": "2106319@kiit.ac.in"
      },
      {
      "name": "8062_Abhishek D",
      "email": "2328062@kiit.ac.in"
      },
      {
      "name": "533_Sneha Behera",
      "email": "21052533@kiit.ac.in"
      },
      {
      "name": "NILOTPAL BASU",
      "email": "22051085@kiit.ac.in"
      },
      {
      "name": "9140_RAHUL _BAGARIA",
      "email": "2129140@kiit.ac.in"
      },
      {
      "name": "1590_sadaf Shahab",
      "email": "21051590@kiit.ac.in"
      },
      {
      "name": "5524_ANJALI BALI",
      "email": "2105524@kiit.ac.in"
      },
      {
      "name": "1529_ DEEPESH REDDY",
      "email": "21051529@kiit.ac.in"
      },
      {
      "name": "3586-AVINASH PATRA",
      "email": "22053586@kiit.ac.in"
      },
      {
      "name": "5469_NAKSHATRA GUPTA",
      "email": "2105469@kiit.ac.in"
      },
      {
      "name": "362 AYUSH KASHYAP",
      "email": "2105362@kiit.ac.in"
      },
      {
      "name": "Vertika Sharma",
      "email": "2229081@kiit.ac.in"
      },
      {
      "name": "4312_GIRIKNT M RAI",
      "email": "22054312@kiit.ac.in"
      },
      {
      "name": "2894_AYUSH RANJAN",
      "email": "22052894@kiit.ac.in"
      },
      {
      "name": "717 ASMITA GHOSH",
      "email": "22052717@kiit.ac.in"
      },
      {
      "name": "1794 AIMAN HASIB",
      "email": "21051794@kiit.ac.in"
      },
      {
      "name": "4321_BHUSHAN SAH",
      "email": "22054321@kiit.ac.in"
      },
      {
      "name": "1260 MARYADA RAY",
      "email": "22051260@kiit.ac.in"
      },
      {
      "name": "057_Arpita P",
      "email": "2129057@kiit.ac.in"
      },
      {
      "name": "389_Shiv Raut",
      "email": "21053389@kiit.ac.in"
      },
      {
      "name": "290_SHRAVAN YADAV",
      "email": "2230290@kiit.ac.in"
      },
      {
      "name": "457_Amit_Raj",
      "email": "21051457@kiit.ac.in"
      },
      {
      "name": "ADITYA SINGH",
      "email": "22053220@kiit.ac.in"
      },
      {
      "name": "9098_sanya sonu",
      "email": "2129098@kiit.ac.in"
      },
      {
      "name": "2401_ Sachin Kumar",
      "email": "22052401@kiit.ac.in"
      },
      {
      "name": "589_SAPTARSHI DUTTA",
      "email": "21052589@kiit.ac.in"
      },
      {
      "name": "TAMONASH MAJUMDER (22053474)",
      "email": "22053474@kiit.ac.in"
      },
      {
      "name": "1346_Srishti Jha",
      "email": "21051346@kiit.ac.in"
      },
      {
      "name": "ADITYA TULSYAN",
      "email": "22052962@kiit.ac.in"
      },
      {
      "name": "SRISTI SAHA",
      "email": "23052763@kiit.ac.in"
      },
      {
      "name": "122_BHOOMIKA GARG",
      "email": "2205122@kiit.ac.in"
      },
      {
      "name": "284_ARNAV PRIYADRSHI",
      "email": "22052284@kiit.ac.in"
      },
      {
      "name": "008_ ADITI SINGH",
      "email": "2129008@kiit.ac.in"
      },
      {
      "name": "276_INDRANUJ GHOSH",
      "email": "2105276@kiit.ac.in"
      },
      {
      "name": "3715 SANDEEP SAHOO",
      "email": "22053715@kiit.ac.in"
      },
      {
      "name": "1313_ Loyna",
      "email": "21051313@kiit.ac.in"
      },
      {
      "name": "2132_PRATEEK DASH",
      "email": "22052132@kiit.ac.in"
      },
      {
      "name": "1867_VISHAL KUMAR",
      "email": "21051867@kiit.ac.in"
      },
      {
      "name": "1016_Ritika Rani",
      "email": "21051016@kiit.ac.in"
      },
      {
      "name": "807_ NEHA BAJPAYEE",
      "email": "2105807@kiit.ac.in"
      },
      {
      "name": "473_ AKANKSHYA PARIDA",
      "email": "21052473@kiit.ac.in"
      },
      {
      "name": "SAKSHAM",
      "email": "22054196@kiit.ac.in"
      },
      {
      "name": "6079 Tushar Bhattacharya",
      "email": "2106079@kiit.ac.in"
      },
      {
      "name": "2365_Siddhartha Mukherjee",
      "email": "21052365@kiit.ac.in"
      },
      {
      "name": "546_TUSHAR TEOTIA",
      "email": "21052546@kiit.ac.in"
      },
      {
      "name": "4126_Shithan Ghosh",
      "email": "2204126@kiit.ac.in"
      },
      {
      "name": "733_RISHAV PANDEY",
      "email": "2105733@kiit.ac.in"
      },
      {
      "name": "420 TANISHA SAINI",
      "email": "2105420@kiit.ac.in"
      },
      {
      "name": "1468_ARVIND KAPHLEY",
      "email": "21051468@kiit.ac.in"
      },
      {
      "name": "AMLAN TANU DEY",
      "email": "2302087@kiit.ac.in"
      },
      {
      "name": "TULSI BASETTI",
      "email": "22051814@kiit.ac.in"
      },
      {
      "name": "VED PRAKASH",
      "email": "22054253@kiit.ac.in"
      },
      {
      "name": "579_Rishabh Raj",
      "email": "2205579@kiit.ac.in"
      },
      {
      "name": "2932_VIDYUN AGARWAL",
      "email": "21052932@kiit.ac.in"
      },
      {
      "name": "5945_Shourya Raj",
      "email": "2105945@kiit.ac.in"
      },
      {
      "name": "2121 TEJAS BINU",
      "email": "21052121@kiit.ac.in"
      },
      {
      "name": "PROGYA BHATTACHARJEE",
      "email": "22053007@kiit.ac.in"
      },
      {
      "name": "6296_Raunit Raj",
      "email": "2106296@kiit.ac.in"
      },
      {
      "name": "048_PRAGYNASMITA SAHOO",
      "email": "2105048@kiit.ac.in"
      },
      {
      "name": "1461_ANKIT KUMAR JENA",
      "email": "21051461@kiit.ac.in"
      },
      {
      "name": "2338_NAYEER NAUSHAD",
      "email": "21052338@kiit.ac.in"
      },
      {
      "name": "BIKASH YADAV",
      "email": "23053484@kiit.ac.in"
      },
      {
      "name": "174_PRATEEK KUMAR",
      "email": "2330174@kiit.ac.in"
      },
      {
      "name": "2597-SNEHA GUHA",
      "email": "23052597@kiit.ac.in"
      },
      {
      "name": "1467_Subrat Dash",
      "email": "22051467@kiit.ac.in"
      },
      {
      "name": "2658_DEBARKA CHAKRABORTI",
      "email": "21052658@kiit.ac.in"
      },
      {
      "name": "SOHAM GIRI",
      "email": "23051542@kiit.ac.in"
      },
      {
      "name": "1018_SATYAM SANJEEV",
      "email": "22051018@kiit.ac.in"
      },
      {
      "name": "5702 Harshit Belwal",
      "email": "2305702@kiit.ac.in"
      },
      {
      "name": "Mohit Sharma",
      "email": "21052676@kiit.ac.in"
      },
      {
      "name": "DEBADRI BANERJEE",
      "email": "2205894@kiit.ac.in"
      },
      {
      "name": "184_SAIKAT SAHA",
      "email": "22053184@kiit.ac.in"
      },
      {
      "name": "AASTHA KUMARI",
      "email": "22054221@kiit.ac.in"
      },
      {
      "name": "HIRENDRA CHAURASIYA",
      "email": "23053666@kiit.ac.in"
      },
      {
      "name": "434_ZAKI MOHAMMAD MAHFOOZ",
      "email": "2205434@kiit.ac.in"
      },
      {
      "name": "AAYUSH BHARUKA",
      "email": "2205002@kiit.ac.in"
      },
      {
      "name": "653_SAHIL RAJ SINGH",
      "email": "2105653@kiit.ac.in"
      },
      {
      "name": "SARTHAK DASH (22053538)",
      "email": "22053538@kiit.ac.in"
      },
      {
      "name": "2001_KHUSHI KUMARI",
      "email": "21052001@kiit.ac.in"
      },
      {
      "name": "412_SPARSH CHAUDHARY",
      "email": "2105412@kiit.ac.in"
      },
      {
      "name": "2878_SMRUTI PRIYA ROUT",
      "email": "21052878@kiit.ac.in"
      },
      {
      "name": "1954_Vasu Bhardwaj",
      "email": "21051954@kiit.ac.in"
      },
      {
      "name": "2406_ATIKA CHANDEL",
      "email": "21052406@kiit.ac.in"
      },
      {
      "name": "632_Uditaa Garg",
      "email": "21052632@kiit.ac.in"
      },
      {
      "name": "ANANT TIWARY",
      "email": "23057006@kiit.ac.in"
      },
      {
      "name": "177_AHELI MANNA",
      "email": "2105177@kiit.ac.in"
      },
      {
      "name": "072_JanviSingh",
      "email": "2129072@kiit.ac.in"
      },
      {
      "name": "MOHIT KUMAR",
      "email": "22052829@kiit.ac.in"
      },
      {
      "name": "2790_ CSE",
      "email": "21052790@kiit.ac.in"
      },
      {
      "name": "1699 NISCHAY JAIN",
      "email": "22051699@kiit.ac.in"
      },
      {
      "name": "Ansh Kumar Sharma",
      "email": "2305114@kiit.ac.in"
      },
      {
      "name": "SHIVANI SETHI",
      "email": "23051952@kiit.ac.in"
      },
      {
      "name": "SARTHAK SHARMA",
      "email": "22054207@kiit.ac.in"
      },
      {
      "name": "3280_Dinesh Paudel",
      "email": "21053280@kiit.ac.in"
      },
      {
      "name": "496_RUHANI BOSE",
      "email": "2205496@kiit.ac.in"
      },
      {
      "name": "1133_ADITYA PRABHU",
      "email": "22051133@kiit.ac.in"
      },
      {
      "name": "270_AYUSHI MOHANTY",
      "email": "2105270@kiit.ac.in"
      },
      {
      "name": "180_RAJESHWARI CHOUDHURY",
      "email": "22053180@kiit.ac.in"
      },
      {
      "name": "4403ROHIT SHARMA",
      "email": "22054403@kiit.ac.in"
      },
      {
      "name": "70 Tanishq",
      "email": "22051470@kiit.ac.in"
      },
      {
      "name": "2834_Dev Karan Pattnayak",
      "email": "21052834@kiit.ac.in"
      },
      {
      "name": "2332KUNAL KUMAR",
      "email": "21052332@kiit.ac.in"
      },
      {
      "name": "2882_Sriansh Raj Pradhan",
      "email": "21052882@kiit.ac.in"
      },
      {
      "name": "5895_Jayanti Goswami",
      "email": "2105895@kiit.ac.in"
      },
      {
      "name": "546_JAGANNATH MONDAL",
      "email": "2105546@kiit.ac.in"
      },
      {
      "name": "356_Anishka",
      "email": "2205356@kiit.ac.in"
      },
      {
      "name": "4104_Subham Luitel",
      "email": "22054104@kiit.ac.in"
      },
      {
      "name": "4206_Brejesh koushal",
      "email": "22054206@kiit.ac.in"
      },
      {
      "name": "021_ARYAN DEO",
      "email": "2105021@kiit.ac.in"
      },
      {
      "name": "232_Pranav Varshney",
      "email": "21051232@kiit.ac.in"
      },
      {
      "name": "603_ NIHARIKA RAGHAV",
      "email": "21052603@kiit.ac.in"
      },
      {
      "name": "5122_AYUSH RAJ",
      "email": "2305122@kiit.ac.in"
      },
      {
      "name": "MSC ARUNOPAL DUTTA",
      "email": "21051549@kiit.ac.in"
      },
      {
      "name": "403_ASHISH AMAN",
      "email": "21052403@kiit.ac.in"
      },
      {
      "name": "501_RISHAV DEO",
      "email": "21051501@kiit.ac.in"
      },
      {
      "name": "RAHUL KUMAR",
      "email": "2105731@kiit.ac.in"
      },
      {
      "name": "AYUSH KUMAR RANA",
      "email": "21052317@kiit.ac.in"
      },
      {
      "name": "1449_ABHISHEK KUMAR TIWARI",
      "email": "21051449@kiit.ac.in"
      },
      {
      "name": "1651_A Suchit",
      "email": "22051651@kiit.ac.in"
      },
      {
      "name": "1411_NISHU KUMARI RAY",
      "email": "21051411@kiit.ac.in"
      },
      {
      "name": "5844_TANYA SINGH",
      "email": "2105844@kiit.ac.in"
      },
      {
      "name": "MD HASNAIN",
      "email": "22052910@kiit.ac.in"
      },
      {
      "name": "NAVNEET KUMAR",
      "email": "2206275@kiit.ac.in"
      },
      {
      "name": "2387_AKASH CHAUDHARI",
      "email": "21052387@kiit.ac.in"
      },
      {
      "name": "433_ADITI SINGH ROY",
      "email": "2105433@kiit.ac.in"
      },
      {
      "name": "3151_Ayush Kumar",
      "email": "22053151@kiit.ac.in"
      },
      {
      "name": "2860 _Riddhima",
      "email": "21052860@kiit.ac.in"
      },
      {
      "name": "534_AYUSH BISWAL",
      "email": "2105534@kiit.ac.in"
      },
      {
      "name": "2255 _Tanisha Basu",
      "email": "22052255@kiit.ac.in"
      },
      {
      "name": "91_VAASHKAR PAUL",
      "email": "2130091@kiit.ac.in"
      },
      {
      "name": "RHITURAJ DATTA",
      "email": "22053341@kiit.ac.in"
      },
      {
      "name": "471_NAMRATA MAHAPATRA",
      "email": "2105471@kiit.ac.in"
      },
      {
      "name": "282_MANAN GARG",
      "email": "2105282@kiit.ac.in"
      },
      {
      "name": "Subhransu Sahoo",
      "email": "22053903@kiit.ac.in"
      },
      {
      "name": "092_AKASH PRASAD",
      "email": "2205092@kiit.ac.in"
      },
      {
      "name": "3376_AHMAT SENOUSSI",
      "email": "21053376@kiit.ac.in"
      },
      {
      "name": "5940_ADARSH TIWARI",
      "email": "2105940@kiit.ac.in"
      },
      {
      "name": "476_ANISH SINHA",
      "email": "21052476@kiit.ac.in"
      },
      {
      "name": "8030_NAYNIKA SARKAR",
      "email": "2128030@kiit.ac.in"
      },
      {
      "name": "1686_Shobhit Verma",
      "email": "21051686@kiit.ac.in"
      },
      {
      "name": "1282_SHRUTI SINHA",
      "email": "22051282@kiit.ac.in"
      },
      {
      "name": "1289_ARINDAM KANRAR",
      "email": "21051289@kiit.ac.in"
      },
      {
      "name": "029_DIVYA SWAROOP DASH",
      "email": "2105029@kiit.ac.in"
      },
      {
      "name": "673-LAGNAJEET MOHANTY",
      "email": "21052673@kiit.ac.in"
      },
      {
      "name": "3641 _SOURAV MALLICK",
      "email": "22053641@kiit.ac.in"
      },
      {
      "name": "1008_SAHASRANSHU SHASTRI",
      "email": "22051008@kiit.ac.in"
      },
      {
      "name": "Harsh Agrawalla",
      "email": "2230171@kiit.ac.in"
      },
      {
      "name": "2654_SANAM SAHU",
      "email": "21052654@kiit.ac.in"
      },
      {
      "name": "3409_MICHAEL MWENYA CHILESHE",
      "email": "21053409@kiit.ac.in"
      },
      {
      "name": "4050_Kunal Kewat",
      "email": "22054050@kiit.ac.in"
      },
      {
      "name": "5541_Devansh Kumar",
      "email": "2105541@kiit.ac.in"
      },
      {
      "name": "HARSH AGARWAL",
      "email": "2205642@kiit.ac.in"
      },
      {
      "name": "1119_UDDIPAN KALITA",
      "email": "22051119@kiit.ac.in"
      },
      {
      "name": "1096-SUCHARITA MOHAPATRA",
      "email": "21051096@kiit.ac.in"
      },
      {
      "name": "8018_Devangi Bhattacharjee",
      "email": "2128018@kiit.ac.in"
      },
      {
      "name": "5980_PRASANNA SAHOO",
      "email": "2105980@kiit.ac.in"
      },
      {
      "name": "SATYAKI DAS",
      "email": "22053718@kiit.ac.in"
      },
      {
      "name": "SAISAGAR SAHUKAR (22053535)",
      "email": "22053535@kiit.ac.in"
      },
      {
      "name": "MOHAMMAD SAHIL",
      "email": "23051681@kiit.ac.in"
      },
      {
      "name": "356_Niladri Nag",
      "email": "2206356@kiit.ac.in"
      },
      {
      "name": "5030 DEVANSH SINGH",
      "email": "2205030@kiit.ac.in"
      },
      {
      "name": "4149 POORVI SINGH",
      "email": "22054149@kiit.ac.in"
      },
      {
      "name": "2813_ANUSHKA PRIYADARSHINI",
      "email": "21052813@kiit.ac.in"
      },
      {
      "name": "196_SOHAM SANTRA",
      "email": "2330196@kiit.ac.in"
      },
      {
      "name": "AAYUSH SINGH",
      "email": "23053595@kiit.ac.in"
      },
      {
      "name": "455_ASHISH KUMAR GUPTA",
      "email": "2205455@kiit.ac.in"
      },
      {
      "name": "301_Deblina",
      "email": "21051301@kiit.ac.in"
      },
      {
      "name": "VIVEK SINGH (22052868)",
      "email": "22052868@kiit.ac.in"
      },
      {
      "name": "321Jagriti SINGH",
      "email": "2105321@kiit.ac.in"
      },
      {
      "name": "2822_ ASHUTOSH JHA",
      "email": "21052822@kiit.ac.in"
      },
      {
      "name": "DEBRUP SENGUPTA",
      "email": "23051017@kiit.ac.in"
      },
      {
      "name": "7006_AISHWARYA MOHANTY",
      "email": "22057006@kiit.ac.in"
      },
      {
      "name": "232_Rishita",
      "email": "2205232@kiit.ac.in"
      },
      {
      "name": "1686 KANIKA SINGH",
      "email": "22051686@kiit.ac.in"
      },
      {
      "name": "CHANDRA SHEKHAR MAHTO",
      "email": "22057081@kiit.ac.in"
      },
      {
      "name": "6185_ANIMESH ANAND",
      "email": "2106185@kiit.ac.in"
      },
      {
      "name": "316_ SAGAR MAHATO",
      "email": "21053316@kiit.ac.in"
      },
      {
      "name": "785-YUVRAJ SINGH",
      "email": "21051785@kiit.ac.in"
      },
      {
      "name": "120_SHASHANK",
      "email": "2129120@kiit.ac.in"
      },
      {
      "name": "1368 _ Ahana Datta",
      "email": "21051368@kiit.ac.in"
      },
      {
      "name": "RISHAV CHANDA",
      "email": "2105912@kiit.ac.in"
      },
      {
      "name": "2374_Swati Das",
      "email": "21052374@kiit.ac.in"
      },
      {
      "name": "2123_Vaibhav Yadav",
      "email": "21052123@kiit.ac.in"
      },
      {
      "name": "2010 Prateek",
      "email": "21052010@kiit.ac.in"
      },
      {
      "name": "6274_Ujjwal Pratap Singh",
      "email": "2106274@kiit.ac.in"
      },
      {
      "name": "4347_Dipesh NAYAK",
      "email": "22054347@kiit.ac.in"
      },
      {
      "name": "381_sudhir Jaiswal",
      "email": "21053381@kiit.ac.in"
      },
      {
      "name": "875_BAISHNABI PARIDA",
      "email": "2105875@kiit.ac.in"
      },
      {
      "name": "2344_PRIYANSHU MIDHA",
      "email": "21052344@kiit.ac.in"
      },
      {
      "name": "2094_Rupsa Mukhopadhyay",
      "email": "21052094@kiit.ac.in"
      },
      {
      "name": "SHIVANGI SHARMA",
      "email": "2229066@kiit.ac.in"
      },
      {
      "name": "5148 _SANJEEV CHOUBEY",
      "email": "2105148@kiit.ac.in"
      },
      {
      "name": "DIYA DEY",
      "email": "2305008@kiit.ac.in"
      },
      {
      "name": "2279_Shubham Mandal",
      "email": "21052279@kiit.ac.in"
      },
      {
      "name": "3439_PRASANNA DHUNGANA",
      "email": "21053439@kiit.ac.in"
      },
      {
      "name": "SOUMILI DAS",
      "email": "22052065@kiit.ac.in"
      },
      {
      "name": "677_Mohnish Mishra",
      "email": "21052677@kiit.ac.in"
      },
      {
      "name": "PRANJAL AGRAWAL",
      "email": "22051868@kiit.ac.in"
      },
      {
      "name": "296_ABHIGYAN ADITYA",
      "email": "2105296@kiit.ac.in"
      },
      {
      "name": "666_ Himanshu Sekhar Nayak",
      "email": "21052666@kiit.ac.in"
      },
      {
      "name": "593_Jatin bansal",
      "email": "21052593@kiit.ac.in"
      },
      {
      "name": "324_Soumya Ranjan Pradhan",
      "email": "2230324@kiit.ac.in"
      },
      {
      "name": "113_DIBYAJYOTI CHAKRAVARTI",
      "email": "2106113@kiit.ac.in"
      },
      {
      "name": "KUMAR ARYAN (22053520)",
      "email": "22053520@kiit.ac.in"
      },
      {
      "name": "1831_AHANA DATTA",
      "email": "22051831@kiit.ac.in"
      },
      {
      "name": "2422_JATIN PATHAK",
      "email": "21052422@kiit.ac.in"
      },
      {
      "name": "NIRAJ JHA",
      "email": "23053838@kiit.ac.in"
      },
      {
      "name": "2238_RIYA RAJ",
      "email": "21052238@kiit.ac.in"
      },
      {
      "name": "NAMAN SHUKLA",
      "email": "2205908@kiit.ac.in"
      },
      {
      "name": "1532_PRIYANKA SANYAL",
      "email": "22051532@kiit.ac.in"
      },
      {
      "name": "096_Antarin",
      "email": "2106096@kiit.ac.in"
      },
      {
      "name": "3301_NITU KARMAKAR",
      "email": "21053301@kiit.ac.in"
      },
      {
      "name": "2715_ARYAN RAJ CHOUDHURY",
      "email": "22052715@kiit.ac.in"
      },
      {
      "name": "Chaman Kumar (2105789)",
      "email": "2105789@kiit.ac.in"
      },
      {
      "name": "2842_Kumar Harsh",
      "email": "21052842@kiit.ac.in"
      },
      {
      "name": "RAJ SHEKHAR",
      "email": "22052575@kiit.ac.in"
      },
      {
      "name": "1903_KUMAR UTSAV",
      "email": "21051903@kiit.ac.in"
      },
      {
      "name": "1601_SOUMYAJIT ROY",
      "email": "21051601@kiit.ac.in"
      },
      {
      "name": "337 NIKHIL kUMAR",
      "email": "21053337@kiit.ac.in"
      },
      {
      "name": "541_SURYAYAN MUKHOPADHYAY",
      "email": "21052541@kiit.ac.in"
      },
      {
      "name": "032 HARSH SINGH",
      "email": "2106032@kiit.ac.in"
      },
      {
      "name": "353_AMISHA KUMARI",
      "email": "2105353@kiit.ac.in"
      },
      {
      "name": "2971_KRITIKA GAUR",
      "email": "23052971@kiit.ac.in"
      },
      {
      "name": "8168-SubhamMohanty",
      "email": "2228168@kiit.ac.in"
      },
      {
      "name": "053_UTKARSH SRIVASTAVA",
      "email": "2230053@kiit.ac.in"
      },
      {
      "name": "AADI RATN",
      "email": "23051560@kiit.ac.in"
      },
      {
      "name": "1862_Khushi Deshwal",
      "email": "22051862@kiit.ac.in"
      },
      {
      "name": "1709 PRAVEER",
      "email": "22051709@kiit.ac.in"
      },
      {
      "name": "5806_Disha Pulivadi",
      "email": "2205806@kiit.ac.in"
      },
      {
      "name": "MRINAL KAUSHIK",
      "email": "23051602@kiit.ac.in"
      },
      {
      "name": "RAHUL PANDEY",
      "email": "22052841@kiit.ac.in"
      },
      {
      "name": "3413_Hiruni Ekanayaka",
      "email": "21053413@kiit.ac.in"
      },
      {
      "name": "STUTI SRIVASTAVA",
      "email": "2228068@kiit.ac.in"
      },
      {
      "name": "188_Ved Prakash",
      "email": "21051188@kiit.ac.in"
      },
      {
      "name": "534_SONALIKA SAHOO",
      "email": "21052534@kiit.ac.in"
      },
      {
      "name": "44_APURVA SINGH",
      "email": "2130044@kiit.ac.in"
      },
      {
      "name": "GAURAV MISHRA",
      "email": "23053718@kiit.ac.in"
      },
      {
      "name": "5943_ Soumya Routray",
      "email": "2105943@kiit.ac.in"
      },
      {
      "name": "SAYAK LODH",
      "email": "2105314@kiit.ac.in"
      },
      {
      "name": "PRABHU PRASAD",
      "email": "22053795@kiit.ac.in"
      },
      {
      "name": "PRANJAL YADAV",
      "email": "22052918@kiit.ac.in"
      },
      {
      "name": "5088 _Rohan",
      "email": "2105088@kiit.ac.in"
      },
      {
      "name": "SATYAM MISHRA",
      "email": "2306139@kiit.ac.in"
      },
      {
      "name": "5766_AJAY SHANKER",
      "email": "2105766@kiit.ac.in"
      },
      {
      "name": "479_MEHUL AGARWAL",
      "email": "21051479@kiit.ac.in"
      },
      {
      "name": "2815_Aradhana",
      "email": "21052815@kiit.ac.in"
      },
      {
      "name": "2823_ASHUTOSH KUMAR PRASAD",
      "email": "21052823@kiit.ac.in"
      },
      {
      "name": "1923_SAHIL KUMAR",
      "email": "21051923@kiit.ac.in"
      },
      {
      "name": "1891_DHRUV NEHRU",
      "email": "21051891@kiit.ac.in"
      },
      {
      "name": "ROHAN DAS",
      "email": "23053378@kiit.ac.in"
      },
      {
      "name": "VENAY VERMA",
      "email": "2207031@kiit.ac.in"
      },
      {
      "name": "296 - SMRITI JHA",
      "email": "2206296@kiit.ac.in"
      },
      {
      "name": "BHUMI JAISWAL",
      "email": "22052454@kiit.ac.in"
      },
      {
      "name": "AMITAV MOHANTY",
      "email": "22053923@kiit.ac.in"
      },
      {
      "name": "2369_ASHUTOSH KUMAR TIWARI",
      "email": "22052369@kiit.ac.in"
      },
      {
      "name": "394_RAJESH CHOWDHURY",
      "email": "21053394@kiit.ac.in"
      },
      {
      "name": "1098_SWAPNIL SARKAR",
      "email": "21051098@kiit.ac.in"
      },
      {
      "name": "9008 AYUSH SINGH",
      "email": "2209008@kiit.ac.in"
      },
      {
      "name": "2801_TAPASYA RAY",
      "email": "21052801@kiit.ac.in"
      },
      {
      "name": "HARSHIT",
      "email": "2205039@kiit.ac.in"
      },
      {
      "name": "3107_SHRUTI MEHTA",
      "email": "22053107@kiit.ac.in"
      },
      {
      "name": "5096_ADITYA SINHA",
      "email": "2105096@kiit.ac.in"
      },
      {
      "name": "1027_ADARSH SRIVASTAVA",
      "email": "21051027@kiit.ac.in"
      },
      {
      "name": "014_ANURAG DAS",
      "email": "2105014@kiit.ac.in"
      },
      {
      "name": "770 SRIJAN MUKHERJEE",
      "email": "21051770@kiit.ac.in"
      },
      {
      "name": "825_SAUMY",
      "email": "2105825@kiit.ac.in"
      },
      {
      "name": "268_ AVANI",
      "email": "2105268@kiit.ac.in"
      },
      {
      "name": "SUBHAMITA PAUL",
      "email": "22051639@kiit.ac.in"
      },
      {
      "name": "ABHISHEK SHRIVASTAV",
      "email": "23053572@kiit.ac.in"
      },
      {
      "name": "734_ Rishikesh",
      "email": "2105734@kiit.ac.in"
      },
      {
      "name": "2743-NIKHIL KUMAR",
      "email": "22052743@kiit.ac.in"
      },
      {
      "name": "SHREYASH ROY",
      "email": "22052762@kiit.ac.in"
      },
      {
      "name": "ESHNA RAY",
      "email": "2228024@kiit.ac.in"
      },
      {
      "name": "1124 VEDANT VERMA",
      "email": "22051124@kiit.ac.in"
      },
      {
      "name": "463 Ansh Pathak",
      "email": "21051463@kiit.ac.in"
      },
      {
      "name": "Rishav Prasad",
      "email": "2105818@kiit.ac.in"
      },
      {
      "name": "RISHI RAJ VERMA_601",
      "email": "22051601@kiit.ac.in"
      },
      {
      "name": "1925_SANDEEP KUMAR",
      "email": "21051925@kiit.ac.in"
      },
      {
      "name": "2350_ROHAN KUMAR SHARMA",
      "email": "21052350@kiit.ac.in"
      },
      {
      "name": "055_Hritik Raj",
      "email": "21051055@kiit.ac.in"
      },
      {
      "name": "387_KIRIT BARUAH",
      "email": "2205387@kiit.ac.in"
      },
      {
      "name": "147_ VIKASH ANAND",
      "email": "2206147@kiit.ac.in"
      },
      {
      "name": "119_JEET HAIT",
      "email": "2106119@kiit.ac.in"
      },
      {
      "name": "DIPTA DAS",
      "email": "22054375@kiit.ac.in"
      },
      {
      "name": "5885_Gourav Chatterjee",
      "email": "2105885@kiit.ac.in"
      },
      {
      "name": "RITIKA BANERJEE 1007",
      "email": "22051007@kiit.ac.in"
      },
      {
      "name": "059_ RUDRANSH MISHRA",
      "email": "2105059@kiit.ac.in"
      },
      {
      "name": "2529_Satyam Behera",
      "email": "21052529@kiit.ac.in"
      },
      {
      "name": "5892_ INDRANATH MODAK",
      "email": "2105892@kiit.ac.in"
      },
      {
      "name": "051_Arijit Saha",
      "email": "2129051@kiit.ac.in"
      },
      {
      "name": "337_abhay",
      "email": "2105337@kiit.ac.in"
      },
      {
      "name": "3401_ABHI UPADHYAY",
      "email": "21053401@kiit.ac.in"
      },
      {
      "name": "3294_METHU PAROI",
      "email": "21053294@kiit.ac.in"
      },
      {
      "name": "153_SAINATH DEY",
      "email": "2205153@kiit.ac.in"
      },
      {
      "name": "328_SORUP CHAKRABORTY",
      "email": "21053328@kiit.ac.in"
      },
      {
      "name": "ARPREET MAHALA",
      "email": "22052804@kiit.ac.in"
      },
      {
      "name": "421- Tushar Anand",
      "email": "2105421@kiit.ac.in"
      },
      {
      "name": "754_RAUNAK",
      "email": "21051754@kiit.ac.in"
      },
      {
      "name": "3270_ASHWANI SAH",
      "email": "21053270@kiit.ac.in"
      },
      {
      "name": "2828_BHAWYA SINGH",
      "email": "21052828@kiit.ac.in"
      },
      {
      "name": "ARYANSHU PATTNAIK",
      "email": "2229102@kiit.ac.in"
      },
      {
      "name": "7039_LIKSHAYA",
      "email": "22057039@kiit.ac.in"
      },
      {
      "name": "882_SANKALP MOHAPATRA",
      "email": "22053882@kiit.ac.in"
      },
      {
      "name": "Pronoy Sharma",
      "email": "2205827@kiit.ac.in"
      },
      {
      "name": "1825_MEGHA SAHU",
      "email": "21051825@kiit.ac.in"
      },
      {
      "name": "6113_RAJDEEP THAKUR",
      "email": "2206113@kiit.ac.in"
      },
      {
      "name": "1025_ABHISHEK RAJ",
      "email": "21051025@kiit.ac.in"
      },
      {
      "name": "634_OM SINGH",
      "email": "2105634@kiit.ac.in"
      },
      {
      "name": "645_ADYASHA PATI",
      "email": "21052645@kiit.ac.in"
      },
      {
      "name": "HARSH SANKRIT",
      "email": "22051075@kiit.ac.in"
      },
      {
      "name": "089_ANGSHUMAN NATH",
      "email": "2106089@kiit.ac.in"
      },
      {
      "name": "8147_Shrinkhala Kumari",
      "email": "2228147@kiit.ac.in"
      },
      {
      "name": "2110_SOUMYA RANJAN BEHERA",
      "email": "21052110@kiit.ac.in"
      },
      {
      "name": "9062_SAYAN BANERJEE",
      "email": "2229062@kiit.ac.in"
      },
      {
      "name": "1972_ANSUMAN PATI",
      "email": "21051972@kiit.ac.in"
      },
      {
      "name": "506_SHOVIN BARIK",
      "email": "2205506@kiit.ac.in"
      },
      {
      "name": "ABIR SARKAR",
      "email": "2105090@kiit.ac.in"
      },
      {
      "name": "1235_PRIYADARSINI MOHARANA",
      "email": "21051235@kiit.ac.in"
      },
      {
      "name": "795_DIVYANSHI GORAI",
      "email": "2105795@kiit.ac.in"
      },
      {
      "name": "204_KRISHNENDU DAS",
      "email": "2105204@kiit.ac.in"
      },
      {
      "name": "5521_Aman Sinha",
      "email": "2105521@kiit.ac.in"
      },
      {
      "name": "670_SNEHAN SAHOO",
      "email": "2105670@kiit.ac.in"
      },
      {
      "name": "LAKKSHIT KHARE",
      "email": "2205045@kiit.ac.in"
      },
      {
      "name": "1525_MAYUKH PATTANAYAK",
      "email": "22051525@kiit.ac.in"
      },
      {
      "name": "542_ARUSH AGGARWAL",
      "email": "2205542@kiit.ac.in"
      },
      {
      "name": "MAYURAKSHEE SAHU",
      "email": "21051406@kiit.ac.in"
      },
      {
      "name": "5521_AAKRITI ROY",
      "email": "2205521@kiit.ac.in"
      },
      {
      "name": "RAMAN KURMI",
      "email": "2306384@kiit.ac.in"
      },
      {
      "name": "215_Vishal Singh",
      "email": "22053215@kiit.ac.in"
      },
      {
      "name": "4298-Hrushikesh Venkatasai",
      "email": "22054298@kiit.ac.in"
      },
      {
      "name": "SRASHTA DAHAL",
      "email": "23053605@kiit.ac.in"
      },
      {
      "name": "8128_PRATIK DAS",
      "email": "2228128@kiit.ac.in"
      },
      {
      "name": "PRAKHAR RAJ",
      "email": "22053087@kiit.ac.in"
      },
      {
      "name": "4126-BISMAYA KANTA DASH",
      "email": "22054126@kiit.ac.in"
      },
      {
      "name": "5154_SANKALPA GIRI",
      "email": "2305154@kiit.ac.in"
      },
      {
      "name": "1006_ SHIVANGI",
      "email": "21051006@kiit.ac.in"
      },
      {
      "name": "3625_SATVIK_BEURA",
      "email": "22053625@kiit.ac.in"
      },
      {
      "name": "200_SOUMALYA DAS",
      "email": "22053200@kiit.ac.in"
      },
      {
      "name": "ROHAN CHOUDHARY",
      "email": "2229054@kiit.ac.in"
      },
      {
      "name": "3804_Sahil Samal",
      "email": "22053804@kiit.ac.in"
      },
      {
      "name": "SOVIK BURMA",
      "email": "23052438@kiit.ac.in"
      },
      {
      "name": "575_ Ayush Amulya",
      "email": "21052575@kiit.ac.in"
      },
      {
      "name": "8124 Nirman Raj",
      "email": "2228124@kiit.ac.in"
      },
      {
      "name": "SUSHANT SHAH",
      "email": "23053495@kiit.ac.in"
      },
      {
      "name": "ARMAAN MOHAPATRA_4166",
      "email": "2304166@kiit.ac.in"
      },
      {
      "name": "622_ GORISH KUMAR",
      "email": "2105622@kiit.ac.in"
      },
      {
      "name": "179_ANKIT KUMAR",
      "email": "2105179@kiit.ac.in"
      },
      {
      "name": "669_SNEHAJIT DEY",
      "email": "2105669@kiit.ac.in"
      },
      {
      "name": "6269_SUKHARANJAN JANA",
      "email": "2106269@kiit.ac.in"
      },
      {
      "name": "2432_LUCKY MAHANTA",
      "email": "21052432@kiit.ac.in"
      },
      {
      "name": "490_BHAVYA KUMARI",
      "email": "21052490@kiit.ac.in"
      },
      {
      "name": "561_Omprakash Tripathy",
      "email": "2105561@kiit.ac.in"
      },
      {
      "name": "6025_deepak singh",
      "email": "2106025@kiit.ac.in"
      },
      {
      "name": "6178 - AKANCHA KHAITAN",
      "email": "2306178@kiit.ac.in"
      },
      {
      "name": "Abhishek Das",
      "email": "23053911@kiit.ac.in"
      },
      {
      "name": "PUSHPITA GHOSH",
      "email": "2305799@kiit.ac.in"
      },
      {
      "name": "MUKUND SAH",
      "email": "23053650@kiit.ac.in"
      },
      {
      "name": "MANISH SAH",
      "email": "23053550@kiit.ac.in"
      },
      {
      "name": "PRATIK DASH",
      "email": "22053449@kiit.ac.in"
      },
      {
      "name": "1589 RUDRANEEL DUTTA",
      "email": "21051589@kiit.ac.in"
      },
      {
      "name": "ANKITA MAJUMDER",
      "email": "2229099@kiit.ac.in"
      },
      {
      "name": "6216_SIDHANT SANGAM",
      "email": "2206216@kiit.ac.in"
      },
      {
      "name": "SRISHTY VERMA",
      "email": "22051381@kiit.ac.in"
      },
      {
      "name": "ADITI SINGH",
      "email": "2329090@kiit.ac.in"
      },
      {
      "name": "DEVASHISH GUPTA",
      "email": "23053675@kiit.ac.in"
      },
      {
      "name": "ARKO GHOSH",
      "email": "2306266@kiit.ac.in"
      },
      {
      "name": "559_NIKUNJ KHEMKA",
      "email": "2105559@kiit.ac.in"
      },
      {
      "name": "2730_Akashdip Saha",
      "email": "21052730@kiit.ac.in"
      },
      {
      "name": "1898_JAYAKRISHNAN M",
      "email": "21051898@kiit.ac.in"
      },
      {
      "name": "1872_ABHASH KUMAR JHA",
      "email": "21051872@kiit.ac.in"
      },
      {
      "name": "5880_BISWAJIT NAYAK",
      "email": "2105880@kiit.ac.in"
      },
      {
      "name": "2339",
      "email": "21052339@kiit.ac.in"
      },
      {
      "name": "SOUNAK DUTTA",
      "email": "22052684@kiit.ac.in"
      },
      {
      "name": "MARIA GEORGE",
      "email": "2105805@kiit.ac.in"
      },
      {
      "name": "ANKANA SEN",
      "email": "22051838@kiit.ac.in"
      },
      {
      "name": "GAUTAM YADAV _3847",
      "email": "23053847@kiit.ac.in"
      },
      {
      "name": "3247_ROHIT RAJ",
      "email": "21053247@kiit.ac.in"
      },
      {
      "name": "AARUSH AMBAR",
      "email": "22051479@kiit.ac.in"
      },
      {
      "name": "751_MEDHAVI SAHGAL",
      "email": "2205751@kiit.ac.in"
      },
      {
      "name": "DIGONTO BISWAS (3429)",
      "email": "23053429@kiit.ac.in"
      },
      {
      "name": "DUSHYANT",
      "email": "22051072@kiit.ac.in"
      },
      {
      "name": "563_ANIKET BARIK",
      "email": "21052563@kiit.ac.in"
      },
      {
      "name": "050_PRATIKSHYA BEHERA",
      "email": "2105050@kiit.ac.in"
      },
      {
      "name": "2523_ROHIT CHANDRA",
      "email": "21052523@kiit.ac.in"
      },
      {
      "name": "130_Kanishk",
      "email": "2205130@kiit.ac.in"
      },
      {
      "name": "982-SWAGATIKA BARIK",
      "email": "2305982@kiit.ac.in"
      },
      {
      "name": "SAYAN KUMAR (22053545)",
      "email": "22053545@kiit.ac.in"
      },
      {
      "name": "SIMRAN ARYA",
      "email": "2305894@kiit.ac.in"
      },
      {
      "name": "RIYA KUMARI",
      "email": "22052749@kiit.ac.in"
      },
      {
      "name": "AYUSH SINGH",
      "email": "22051850@kiit.ac.in"
      },
      {
      "name": "467_AAMOGHA BILLORE",
      "email": "21052467@kiit.ac.in"
      },
      {
      "name": "52_KAUSTUV SARKAR CHAKRAVARTY",
      "email": "2130052@kiit.ac.in"
      },
      {
      "name": "2398_ANUSHKA DUTTA",
      "email": "21052398@kiit.ac.in"
      },
      {
      "name": "ARADHYA SINGH",
      "email": "22052624@kiit.ac.in"
      },
      {
      "name": "8072_ANURUDDHA PAUL",
      "email": "2328072@kiit.ac.in"
      },
      {
      "name": "140_KENGUVA BHAVESH",
      "email": "21051140@kiit.ac.in"
      },
      {
      "name": "110_ADITI SRIVASTAVA",
      "email": "21051110@kiit.ac.in"
      },
      {
      "name": "1430_SHUBHAM CHATTERJEE",
      "email": "21051430@kiit.ac.in"
      },
      {
      "name": "2429_UTKARSH NIGAM",
      "email": "22052429@kiit.ac.in"
      },
      {
      "name": "127_SREYASHI BISHNU MAJUMDAR",
      "email": "2230127@kiit.ac.in"
      },
      {
      "name": "ARITRITA PAUL",
      "email": "2205881@kiit.ac.in"
      },
      {
      "name": "ANUBHABA SWAIN",
      "email": "2306105@kiit.ac.in"
      },
      {
      "name": "718_HARSHITA OLIVE AROHAN",
      "email": "2105718@kiit.ac.in"
      },
      {
      "name": "VIKRAM KUMAR",
      "email": "22054001@kiit.ac.in"
      },
      {
      "name": "VISHESH KUMAR",
      "email": "22051388@kiit.ac.in"
      },
      {
      "name": "583_DIPRA BANERJEE",
      "email": "21052583@kiit.ac.in"
      },
      {
      "name": "p c",
      "email": "21053354@kiit.ac.in"
      },
      {
      "name": "Genish Kumar",
      "email": "22054099@kiit.ac.in"
      },
      {
      "name": "1439_STHITAPRAGYAN ROUT",
      "email": "21051439@kiit.ac.in"
      },
      {
      "name": "2747-AYUSH PATHAK",
      "email": "21052747@kiit.ac.in"
      },
      {
      "name": "2800_ SYAMANTAK",
      "email": "21052800@kiit.ac.in"
      },
      {
      "name": "083_VEDANG VATSAL",
      "email": "2106083@kiit.ac.in"
      },
      {
      "name": "1307_ divyansh Suman",
      "email": "21051307@kiit.ac.in"
      },
      {
      "name": "2413_DEBANSHU PARIDA",
      "email": "21052413@kiit.ac.in"
      },
      {
      "name": "815_ DIPTANIL",
      "email": "21051815@kiit.ac.in"
      },
      {
      "name": "BHOOMIKA DASH",
      "email": "2206331@kiit.ac.in"
      },
      {
      "name": "836_Subhra Dash",
      "email": "2105836@kiit.ac.in"
      },
      {
      "name": "1162-Hritika Sharan",
      "email": "22051162@kiit.ac.in"
      },
      {
      "name": "SOHOM CHAKRABORTY",
      "email": "22052681@kiit.ac.in"
      },
      {
      "name": "134_Priya Rana",
      "email": "2105134@kiit.ac.in"
      },
      {
      "name": "318_SHREE SARAL",
      "email": "2106318@kiit.ac.in"
      },
      {
      "name": "8022_HARSHIT ANAND",
      "email": "2128022@kiit.ac.in"
      },
      {
      "name": "8156 SWAYANSA MISHRA",
      "email": "2228156@kiit.ac.in"
      },
      {
      "name": "387 YOGESH KUMAR SAH",
      "email": "21053387@kiit.ac.in"
      },
      {
      "name": "204_SNEHA GUPTA",
      "email": "2230204@kiit.ac.in"
      },
      {
      "name": "017_ARNAV GUPTA",
      "email": "2206017@kiit.ac.in"
      },
      {
      "name": "1788 Abhisek",
      "email": "21051788@kiit.ac.in"
      },
      {
      "name": "6279_TARUN KUMAR",
      "email": "2106279@kiit.ac.in"
      },
      {
      "name": "470_Naman jain",
      "email": "2105470@kiit.ac.in"
      },
      {
      "name": "221_RABNEET SINGH NANHRA",
      "email": "2105221@kiit.ac.in"
      },
      {
      "name": "1484_ AFAQUE",
      "email": "21051484@kiit.ac.in"
      },
      {
      "name": "4051_Madan Pandey",
      "email": "22054051@kiit.ac.in"
      },
      {
      "name": "1233_ Pratham Gupta",
      "email": "21051233@kiit.ac.in"
      },
      {
      "name": "208_MILAN KUMAR SAHOO",
      "email": "2105208@kiit.ac.in"
      },
      {
      "name": "ANURAG MODAK",
      "email": "22053143@kiit.ac.in"
      },
      {
      "name": "1861_TRISHA",
      "email": "21051861@kiit.ac.in"
      },
      {
      "name": "288_Nikhil Das",
      "email": "2105288@kiit.ac.in"
      },
      {
      "name": "206 ARCHIT JETHLIA",
      "email": "21053206@kiit.ac.in"
      },
      {
      "name": "5757_PARIDA PRATYUS SRIMAYSIS",
      "email": "2205757@kiit.ac.in"
      },
      {
      "name": "497_SIBASISH DUTTA",
      "email": "2105497@kiit.ac.in"
      },
      {
      "name": "474_PRACHI RAJ",
      "email": "2105474@kiit.ac.in"
      },
      {
      "name": "753_SOUBHAGYA ROY",
      "email": "2105753@kiit.ac.in"
      },
      {
      "name": "1890_DEEPANSHU SINGH",
      "email": "21051890@kiit.ac.in"
      },
      {
      "name": "2715_SUDEEPA",
      "email": "21052715@kiit.ac.in"
      },
      {
      "name": "MAINAK MAITRA",
      "email": "22053076@kiit.ac.in"
      },
      {
      "name": "1557 _Jaswanth Reddy Biyyala",
      "email": "21051557@kiit.ac.in"
      },
      {
      "name": "159_SIRSHA BASAK",
      "email": "2106159@kiit.ac.in"
      },
      {
      "name": "1377_ANSHUMAN RATH",
      "email": "21051377@kiit.ac.in"
      },
      {
      "name": "SUDHANSHU OM",
      "email": "22051559@kiit.ac.in"
      },
      {
      "name": "710_SOURAV NARAYAN",
      "email": "21052710@kiit.ac.in"
      },
      {
      "name": "202_VARUN MAURYA",
      "email": "2105202@kiit.ac.in"
      },
      {
      "name": "2726-achyutvardhan",
      "email": "21052726@kiit.ac.in"
      },
      {
      "name": "2127_Mushrraf ZAWED",
      "email": "22052127@kiit.ac.in"
      },
      {
      "name": "1210_RITWIKA AGARWALA",
      "email": "23051210@kiit.ac.in"
      },
      {
      "name": "3300_NITESH KUMAR MANDAL",
      "email": "21053300@kiit.ac.in"
      },
      {
      "name": "1758_KUMAR SHUBHAM",
      "email": "23051758@kiit.ac.in"
      },
      {
      "name": "1340_DEEPRO BHATTACHARYYA",
      "email": "23051340@kiit.ac.in"
      },
      {
      "name": "SAUMYA SHUKLA",
      "email": "2305156@kiit.ac.in"
      },
      {
      "name": "1218_SHREYA DUBEY",
      "email": "23051218@kiit.ac.in"
      },
      {
      "name": "1655_ANSUMAN DAS",
      "email": "23051655@kiit.ac.in"
      },
      {
      "name": "ANKIT MOHAPATRA",
      "email": "2309015@kiit.ac.in"
      },
      {
      "name": "3208_SWAPNIL SINHA",
      "email": "22053208@kiit.ac.in"
      },
      {
      "name": "SHIVAM PATRA",
      "email": "23052354@kiit.ac.in"
      },
      {
      "name": "AKANKSHA SHREYA",
      "email": "2330212@kiit.ac.in"
      },
      {
      "name": "806_NEEL JAIN",
      "email": "2105806@kiit.ac.in"
      },
      {
      "name": "395_RAFAT REDWAN",
      "email": "21053395@kiit.ac.in"
      },
      {
      "name": "ANYASH PRASAD",
      "email": "23051977@kiit.ac.in"
      },
      {
      "name": "PRATYUSH PATNAIK",
      "email": "23052744@kiit.ac.in"
      },
      {
      "name": "NISHMEET SINGH RAJPAL",
      "email": "2330452@kiit.ac.in"
      },
      {
      "name": "2589 REWA SHUKLA",
      "email": "23052589@kiit.ac.in"
      },
      {
      "name": "SAYALI DESHMUKH",
      "email": "2305157@kiit.ac.in"
      },
      {
      "name": "6073_SUDIP MONDAL",
      "email": "2106073@kiit.ac.in"
      },
      {
      "name": "SAMAVEDAM JANAKI BHAWANI SHREYA",
      "email": "23052101@kiit.ac.in"
      },
      {
      "name": "2030 PIYUSH JENA",
      "email": "2302030@kiit.ac.in"
      },
      {
      "name": "1807_ BHAGWANT",
      "email": "21051807@kiit.ac.in"
      },
      {
      "name": "3325_SHUBHAM ROUNIYAR",
      "email": "21053325@kiit.ac.in"
      },
      {
      "name": "223_Utkarsh Trivedi",
      "email": "21053223@kiit.ac.in"
      },
      {
      "name": "PRASENJEET SINGH",
      "email": "22052486@kiit.ac.in"
      },
      {
      "name": "1183_SUBHADEEP SHIL",
      "email": "21051183@kiit.ac.in"
      },
      {
      "name": "1524_ UDAY SHARMA",
      "email": "21051524@kiit.ac.in"
      },
      {
      "name": "664_HARSHDEEP SINGH",
      "email": "21052664@kiit.ac.in"
      },
      {
      "name": "KUSHAGRA MOHAN (23052649)",
      "email": "23052649@kiit.ac.in"
      },
      {
      "name": "2315AVIRUP SAMANTA",
      "email": "21052315@kiit.ac.in"
      },
      {
      "name": "037_SOUMYADEEP PAUL",
      "email": "2129037@kiit.ac.in"
      },
      {
      "name": "637__PRANAV REDDY",
      "email": "2105637@kiit.ac.in"
      },
      {
      "name": "AJITA SINGH",
      "email": "23052453@kiit.ac.in"
      },
      {
      "name": "010_ ANKIT SINGH",
      "email": "2105010@kiit.ac.in"
      },
      {
      "name": "212_SHIVANSHU THAKUR",
      "email": "2206212@kiit.ac.in"
      },
      {
      "name": "PUNYA PARUL",
      "email": "2330390@kiit.ac.in"
      },
      {
      "name": "032-RISHABH MOHATA",
      "email": "2129032@kiit.ac.in"
      },
      {
      "name": "ANURODH KUMAR",
      "email": "2206244@kiit.ac.in"
      },
      {
      "name": "SAUMYAJIT CHATTERJEE",
      "email": "2229060@kiit.ac.in"
      },
      {
      "name": "899_MANISH KUMAR SINGH",
      "email": "2105899@kiit.ac.in"
      },
      {
      "name": "2068_Dinesh",
      "email": "21052068@kiit.ac.in"
      },
      {
      "name": "498 Sidhant Guha",
      "email": "2105498@kiit.ac.in"
      },
      {
      "name": "2311_ASHISH KUMAR",
      "email": "21052311@kiit.ac.in"
      },
      {
      "name": "248_SOVNA PANDA",
      "email": "2105248@kiit.ac.in"
      },
      {
      "name": "SRIJONI BANERJI",
      "email": "2305418@kiit.ac.in"
      },
      {
      "name": "1391 SUNAINA ROY",
      "email": "23051391@kiit.ac.in"
      },
      {
      "name": "130_SHAKSHI JAISWAL",
      "email": "2129130@kiit.ac.in"
      },
      {
      "name": "2695_Ritik Kumar Sahoo",
      "email": "21052695@kiit.ac.in"
      },
      {
      "name": "2301_ADITYA RANJAN",
      "email": "21052301@kiit.ac.in"
      },
      {
      "name": "823_Sathwik Yaramala",
      "email": "2105823@kiit.ac.in"
      },
      {
      "name": "AANAND MISHRA",
      "email": "22054318@kiit.ac.in"
      },
      {
      "name": "Siddharth :3",
      "email": "22051026@kiit.ac.in"
      },
      {
      "name": "SURYANSH DEO - 1205",
      "email": "22051205@kiit.ac.in"
      },
      {
      "name": "188_MD SIBTAIN RAZA",
      "email": "2206188@kiit.ac.in"
      },
      {
      "name": "2016_RAKSHITA BHATNAGAR",
      "email": "21052016@kiit.ac.in"
      },
      {
      "name": "1194_Agrim Agrawal",
      "email": "21051194@kiit.ac.in"
      },
      {
      "name": "NISHANTH BANDARU",
      "email": "2330314@kiit.ac.in"
      },
      {
      "name": "MANASWINI PRIYADARSHINI (22053436)",
      "email": "22053436@kiit.ac.in"
      },
      {
      "name": "082_VEDIKA CHOWDHARY",
      "email": "2105082@kiit.ac.in"
      },
      {
      "name": "2208_ UTPALA DUTTA",
      "email": "21052208@kiit.ac.in"
      },
      {
      "name": "5570_shiksha Tiwari",
      "email": "2305570@kiit.ac.in"
      },
      {
      "name": "2169_PRATYUSH AMLAN SAHU",
      "email": "21052169@kiit.ac.in"
      },
      {
      "name": "2689_RAHUL SINHA",
      "email": "21052689@kiit.ac.in"
      },
      {
      "name": "1230_Omkar Mishra",
      "email": "21051230@kiit.ac.in"
      },
      {
      "name": "6397_Samyog Sharma",
      "email": "2206397@kiit.ac.in"
      },
      {
      "name": "298_RAKSHIT MEHRA",
      "email": "2105298@kiit.ac.in"
      },
      {
      "name": "318_SOUVIK",
      "email": "2230318@kiit.ac.in"
      },
      {
      "name": "9087_Priyanshu Garg",
      "email": "2129087@kiit.ac.in"
      },
      {
      "name": "0429_RISHAV RAJ",
      "email": "2330429@kiit.ac.in"
      },
      {
      "name": "366 Debjit Goswami",
      "email": "2105366@kiit.ac.in"
      },
      {
      "name": "321_SHEKHAR MALLIK",
      "email": "21053321@kiit.ac.in"
      },
      {
      "name": "1222_KANCHAN BALA",
      "email": "21051222@kiit.ac.in"
      },
      {
      "name": "313_SAURABH SHUKLA",
      "email": "2105313@kiit.ac.in"
      },
      {
      "name": "3308_RAHUL BISWAS",
      "email": "21053308@kiit.ac.in"
      },
      {
      "name": "690_ Reetika",
      "email": "21052690@kiit.ac.in"
      },
      {
      "name": "SAKSHI JINDAL",
      "email": "23052100@kiit.ac.in"
      },
      {
      "name": "5131_PANDEY UDIT RAY",
      "email": "2105131@kiit.ac.in"
      },
      {
      "name": "2997 - Surbhi Roy",
      "email": "21052997@kiit.ac.in"
      },
      {
      "name": "Ujval Kumar",
      "email": "22052080@kiit.ac.in"
      },
      {
      "name": "3036_SATWIK SHARMA",
      "email": "2303036@kiit.ac.in"
      },
      {
      "name": "594_SHAMIT SHEEL",
      "email": "21051594@kiit.ac.in"
      },
      {
      "name": "1538_Aniket Raul",
      "email": "21051538@kiit.ac.in"
      },
      {
      "name": "1982 Aryan shaw",
      "email": "21051982@kiit.ac.in"
      },
      {
      "name": "Yatharth Jain",
      "email": "21051918@kiit.ac.in"
      },
      {
      "name": "481_ Suhank",
      "email": "21051481@kiit.ac.in"
      },
      {
      "name": "SHASHANK SHAH",
      "email": "22052853@kiit.ac.in"
      },
      {
      "name": "1963_RiyaSinha",
      "email": "22051963@kiit.ac.in"
      },
      {
      "name": "SHIVANGI UPADHYAY",
      "email": "2305162@kiit.ac.in"
      },
      {
      "name": "GAURAV KUMAR",
      "email": "22051856@kiit.ac.in"
      },
      {
      "name": "0172_SOUMALYADEB BANERJEE",
      "email": "2130172@kiit.ac.in"
      },
      {
      "name": "0198_SOUMYAJIT KOLAY",
      "email": "2130198@kiit.ac.in"
      },
      {
      "name": "2799_SUYASH PRAKASH",
      "email": "21052799@kiit.ac.in"
      },
      {
      "name": "SAMYA DAS",
      "email": "22052501@kiit.ac.in"
      },
      {
      "name": "7032_HARSH PRASAD",
      "email": "22057032@kiit.ac.in"
      },
      {
      "name": "6200_Rajtanu",
      "email": "2206200@kiit.ac.in"
      },
      {
      "name": "2320_Dhruv Budhia",
      "email": "21052320@kiit.ac.in"
      },
      {
      "name": "100_Abbas Husain",
      "email": "21051100@kiit.ac.in"
      },
      {
      "name": "2731_AMITABH BAL",
      "email": "21052731@kiit.ac.in"
      },
      {
      "name": "SIDDHARTHA",
      "email": "2228065@kiit.ac.in"
      },
      {
      "name": "SUJAL KUMAR",
      "email": "22053906@kiit.ac.in"
      },
      {
      "name": "SONU KUMAR",
      "email": "22052418@kiit.ac.in"
      },
      {
      "name": "5447_Aviral Kishore",
      "email": "2105447@kiit.ac.in"
      },
      {
      "name": "211_Jashika_ sethi",
      "email": "2205211@kiit.ac.in"
      },
      {
      "name": "RICHA KUMARI",
      "email": "22052492@kiit.ac.in"
      },
      {
      "name": "037_MD DILSHAD ALAM",
      "email": "2106037@kiit.ac.in"
      },
      {
      "name": "034 - SHREYON GHOSH",
      "email": "2129034@kiit.ac.in"
      },
      {
      "name": "1156__ADITYA MUKHERJEE",
      "email": "23051156@kiit.ac.in"
      },
      {
      "name": "Awadhesh Gupta Kaulapuri",
      "email": "22054295@kiit.ac.in"
      },
      {
      "name": "1977-ARITRA KAR",
      "email": "21051977@kiit.ac.in"
      },
      {
      "name": "2956_SWAYAM",
      "email": "21052956@kiit.ac.in"
      },
      {
      "name": "6087_DEBDIP CHATTERJEE",
      "email": "2206087@kiit.ac.in"
      },
      {
      "name": "ADITYA RAJ",
      "email": "22052525@kiit.ac.in"
      },
      {
      "name": "9042_ AMIT KUMAR DHALL",
      "email": "2129042@kiit.ac.in"
      },
      {
      "name": "HRISHA DEY",
      "email": "2230612@kiit.ac.in"
      },
      {
      "name": "622_SHRISHTI SINGH",
      "email": "21052622@kiit.ac.in"
      },
      {
      "name": "PRADEEP (22054325)",
      "email": "22054325@kiit.ac.in"
      },
      {
      "name": "1276_Abhijeet",
      "email": "21051276@kiit.ac.in"
      },
      {
      "name": "160- KAFIA ADEN MOHAMED",
      "email": "2129160@kiit.ac.in"
      },
      {
      "name": "1495_Priyanshu",
      "email": "21051495@kiit.ac.in"
      },
      {
      "name": "AKSHAT KUTARIYAR",
      "email": "22052791@kiit.ac.in"
      },
      {
      "name": "AKSHAT RAJ",
      "email": "22051137@kiit.ac.in"
      },
      {
      "name": "2370_SUMIT RANJAN",
      "email": "21052370@kiit.ac.in"
      },
      {
      "name": "137_SRISHTI SINGH",
      "email": "2206137@kiit.ac.in"
      },
      {
      "name": "2035_Manish Raj",
      "email": "22052035@kiit.ac.in"
      },
      {
      "name": "SOUVIK CHANDRA",
      "email": "2206385@kiit.ac.in"
      },
      {
      "name": "1927_Satyadeb Chand",
      "email": "21051927@kiit.ac.in"
      },
      {
      "name": "ANISH KUNDU",
      "email": "22052797@kiit.ac.in"
      },
      {
      "name": "877_ALOK KUMAR JHA",
      "email": "21051877@kiit.ac.in"
      },
      {
      "name": "1637_ARUNIMA DAS",
      "email": "21051637@kiit.ac.in"
      },
      {
      "name": "2990_ZOYAH AFSHEEN SAYEED",
      "email": "21052990@kiit.ac.in"
      },
      {
      "name": "3932 Atish Dipankar DUTTA",
      "email": "22053932@kiit.ac.in"
      },
      {
      "name": "4068_Prajwal Goit",
      "email": "22054068@kiit.ac.in"
      },
      {
      "name": "Atul Rajput",
      "email": "2230158@kiit.ac.in"
      },
      {
      "name": "1697_vaibhav patel",
      "email": "21051697@kiit.ac.in"
      },
      {
      "name": "344_trisha",
      "email": "22052344@kiit.ac.in"
      },
      {
      "name": "AYUSH DAS",
      "email": "22053412@kiit.ac.in"
      },
      {
      "name": "7084_Saswata Dey",
      "email": "22057084@kiit.ac.in"
      },
      {
      "name": "HASAN MAHMUD",
      "email": "22054457@kiit.ac.in"
      },
      {
      "name": "SHIVANSH",
      "email": "22052408@kiit.ac.in"
      },
      {
      "name": "010_Aditya",
      "email": "2129010@kiit.ac.in"
      },
      {
      "name": "1680_SAYANDEEP",
      "email": "21051680@kiit.ac.in"
      },
      {
      "name": "ANIKET MAITY",
      "email": "22053660@kiit.ac.in"
      },
      {
      "name": "6017_ARYAN PARIHAR",
      "email": "2106017@kiit.ac.in"
      },
      {
      "name": "PREETAM DASH",
      "email": "22052488@kiit.ac.in"
      },
      {
      "name": "AYUSH KUMAR",
      "email": "22052546@kiit.ac.in"
      },
      {
      "name": "2209_GOUTAM VENKATESAN",
      "email": "22052209@kiit.ac.in"
      },
      {
      "name": "FAIZAN FAIYAZ",
      "email": "22052555@kiit.ac.in"
      },
      {
      "name": "1498_ Raihan Siddiqui",
      "email": "21051498@kiit.ac.in"
      },
      {
      "name": "125_KUMAR GAURAV",
      "email": "2105125@kiit.ac.in"
      },
      {
      "name": "ADITYA ROY",
      "email": "2330208@kiit.ac.in"
      },
      {
      "name": "1605 _sreetama",
      "email": "21051605@kiit.ac.in"
      },
      {
      "name": "244 RISHABH KUMAR SINGH",
      "email": "21053244@kiit.ac.in"
      },
      {
      "name": "768_AMLAN",
      "email": "2105768@kiit.ac.in"
      },
      {
      "name": "4108_Mitali Yadav",
      "email": "22054108@kiit.ac.in"
      },
      {
      "name": "Dip Biswas",
      "email": "22054244@kiit.ac.in"
      },
      {
      "name": "Apurba Modak",
      "email": "22054243@kiit.ac.in"
      },
      {
      "name": "100_ARGHAJIT DAS",
      "email": "2106100@kiit.ac.in"
      },
      {
      "name": "AKANKHYA BEURIA",
      "email": "22051227@kiit.ac.in"
      },
      {
      "name": "8084 AAKRITI GUPTA",
      "email": "2228084@kiit.ac.in"
      },
      {
      "name": "RAMASHANKAR SAH",
      "email": "23053812@kiit.ac.in"
      },
      {
      "name": "1724 SATYAJIT PRADHAN",
      "email": "22051724@kiit.ac.in"
      },
      {
      "name": "1023_ Abdul Majid",
      "email": "21051023@kiit.ac.in"
      },
      {
      "name": "1350 MANAS GOSWAMEE",
      "email": "23051350@kiit.ac.in"
      },
      {
      "name": "9104_Shomili Duary",
      "email": "2129104@kiit.ac.in"
      },
      {
      "name": "1778 SAMARTH SHUKLA",
      "email": "23051778@kiit.ac.in"
      },
      {
      "name": "445_Harshit Gupta",
      "email": "2006445@kiit.ac.in"
      },
      {
      "name": "MOITREYEE BHADURI",
      "email": "22052999@kiit.ac.in"
      },
      {
      "name": "229_ Rupal Pradhan",
      "email": "2105229@kiit.ac.in"
      },
      {
      "name": "5990 M Bhanu Sashank Varma",
      "email": "2205990@kiit.ac.in"
      },
      {
      "name": "3265_AMBRISH KUMAR MANDAL",
      "email": "21053265@kiit.ac.in"
      },
      {
      "name": "YASH KUMAR",
      "email": "22053128@kiit.ac.in"
      },
      {
      "name": "2873_Shradha Suman",
      "email": "21052873@kiit.ac.in"
      },
      {
      "name": "NILAY MALLIK",
      "email": "23053865@kiit.ac.in"
      },
      {
      "name": "1514_ Shrinkhala",
      "email": "21051514@kiit.ac.in"
      },
      {
      "name": "ADWIKA SARRAF",
      "email": "2205963@kiit.ac.in"
      },
      {
      "name": "1145_Moitreyee Das",
      "email": "21051145@kiit.ac.in"
      },
      {
      "name": "SASWAT JENA",
      "email": "21051084@kiit.ac.in"
      },
      {
      "name": "1584_Purnendu Thamb",
      "email": "21051584@kiit.ac.in"
      },
      {
      "name": "3345_ROHAN BOSE",
      "email": "22053345@kiit.ac.in"
      },
      {
      "name": "SANJOG YADAV",
      "email": "23053928@kiit.ac.in"
      },
      {
      "name": "348-ABHISHEK RANJAN",
      "email": "2105348@kiit.ac.in"
      },
      {
      "name": "5430_ABHISEK PANDA",
      "email": "2105430@kiit.ac.in"
      },
      {
      "name": "ADITYA RAJ",
      "email": "22052873@kiit.ac.in"
      },
      {
      "name": "MD ASHIQUL",
      "email": "22054452@kiit.ac.in"
      },
      {
      "name": "5921_SARTHAK Prusty",
      "email": "2105921@kiit.ac.in"
      },
      {
      "name": "286-MANYTUCH MANGAR BENY RUEI",
      "email": "2106286@kiit.ac.in"
      },
      {
      "name": "SAMBIT MOHAPATRA",
      "email": "23057040@kiit.ac.in"
      },
      {
      "name": "585_Ekaansh",
      "email": "21052585@kiit.ac.in"
      },
      {
      "name": "090_ RAJDEEP SARKAR",
      "email": "2129090@kiit.ac.in"
      },
      {
      "name": "1841 RITIK RAJ",
      "email": "21051841@kiit.ac.in"
      },
      {
      "name": "1017_Sourav Nayak",
      "email": "21051017@kiit.ac.in"
      },
      {
      "name": "6125_ shikhar bhadouria",
      "email": "2206125@kiit.ac.in"
      },
      {
      "name": "Ashutosh Agrawal",
      "email": "2105532@kiit.ac.in"
      },
      {
      "name": "1136_AKARSH RAJ",
      "email": "22051136@kiit.ac.in"
      },
      {
      "name": "656_Bhargav Rao",
      "email": "21052656@kiit.ac.in"
      },
      {
      "name": "876_BHAVYA PRIYADARSHINI",
      "email": "2105876@kiit.ac.in"
      },
      {
      "name": "KESHAB Gupta_562",
      "email": "2205562@kiit.ac.in"
      },
      {
      "name": "Manish Kumar",
      "email": "22054241@kiit.ac.in"
      },
      {
      "name": "DIVYANI PANDEY",
      "email": "22053948@kiit.ac.in"
      },
      {
      "name": "Kanchan Kumari",
      "email": "22054227@kiit.ac.in"
      },
      {
      "name": "9206_Rashmi Singha",
      "email": "2229206@kiit.ac.in"
      },
      {
      "name": "208_GARVIT RAI",
      "email": "2205208@kiit.ac.in"
      },
      {
      "name": "413_PAPPU KUMAR",
      "email": "22054413@kiit.ac.in"
      },
      {
      "name": "1697 Nikhil Aditya Nagvanshi",
      "email": "22051697@kiit.ac.in"
      },
      {
      "name": "065_Yashvardhan Singh",
      "email": "2206065@kiit.ac.in"
      },
      {
      "name": "NISHANT KUMAR",
      "email": "22054387@kiit.ac.in"
      },
      {
      "name": "SHAKYA SINHA",
      "email": "2205066@kiit.ac.in"
      },
      {
      "name": "ANKITA SINGH",
      "email": "23051651@kiit.ac.in"
      },
      {
      "name": "2856_ Aayush kumar",
      "email": "23052856@kiit.ac.in"
      },
      {
      "name": "RAJA SAH",
      "email": "23053769@kiit.ac.in"
      },
      {
      "name": "KUNAL SRIVASTAVA",
      "email": "22053254@kiit.ac.in"
      },
      {
      "name": "PIYUSH_1438",
      "email": "23051438@kiit.ac.in"
      },
      {
      "name": "1479_Aarna Anvi",
      "email": "23051479@kiit.ac.in"
      },
      {
      "name": "AYUSH RAJ",
      "email": "22052544@kiit.ac.in"
      },
      {
      "name": "387 OORJA SINGH",
      "email": "2105387@kiit.ac.in"
      },
      {
      "name": "KRISHNENDU PAN",
      "email": "22053782@kiit.ac.in"
      },
      {
      "name": "TANISHA PANDA",
      "email": "22051386@kiit.ac.in"
      },
      {
      "name": "VED PANDEY",
      "email": "23053645@kiit.ac.in"
      },
      {
      "name": "NITESH GUPTA",
      "email": "23053757@kiit.ac.in"
      },
      {
      "name": "DIPANJAN ROY",
      "email": "2305126@kiit.ac.in"
      },
      {
      "name": "Avoy Nath CHOWDHURY",
      "email": "23053559@kiit.ac.in"
      },
      {
      "name": "INDRONIL ARKO",
      "email": "23053553@kiit.ac.in"
      },
      {
      "name": "VISHWAJEET BHARTI",
      "email": "2205085@kiit.ac.in"
      },
      {
      "name": "ADITYA RAJ",
      "email": "2207001@kiit.ac.in"
      },
      {
      "name": "688_PUSHPAK KUMAR",
      "email": "21052688@kiit.ac.in"
      },
      {
      "name": "ANUSUA BISWAS",
      "email": "22052970@kiit.ac.in"
      },
      {
      "name": "4326_Abhishek",
      "email": "22054326@kiit.ac.in"
      },
      {
      "name": "1765_NITIN KUMAR",
      "email": "23051765@kiit.ac.in"
      },
      {
      "name": "700-ADRIJA KARMAKAR",
      "email": "22052700@kiit.ac.in"
      },
      {
      "name": "DARSH MOHAPATRA",
      "email": "2328163@kiit.ac.in"
      },
      {
      "name": "SUMIT VERMA",
      "email": "22052426@kiit.ac.in"
      },
      {
      "name": "3465_TAMJEED SIDDIQUE",
      "email": "23053465@kiit.ac.in"
      },
      {
      "name": "007-ADITI CHOUDHURY",
      "email": "2129007@kiit.ac.in"
      },
      {
      "name": "702 ARYAN BHATTACHARJEE",
      "email": "2105702@kiit.ac.in"
      },
      {
      "name": "SHREYAS PUROHIT",
      "email": "22053812@kiit.ac.in"
      },
      {
      "name": "302_ Aniket Lahiri",
      "email": "2106302@kiit.ac.in"
      },
      {
      "name": "1915_PRITI PALLABHI MISHRA",
      "email": "21051915@kiit.ac.in"
      },
      {
      "name": "Utkarsh Kumar Gupta",
      "email": "21051525@kiit.ac.in"
      },
      {
      "name": "1148_NISHITA RAJU",
      "email": "21051148@kiit.ac.in"
      },
      {
      "name": "1952_NEHA KUMARI",
      "email": "22051952@kiit.ac.in"
      },
      {
      "name": "6044_Pritam Mahata",
      "email": "2106044@kiit.ac.in"
      },
      {
      "name": "3039 Varutri Parihar",
      "email": "22053039@kiit.ac.in"
      },
      {
      "name": "517_RAHUL KUMAR",
      "email": "2105517@kiit.ac.in"
      },
      {
      "name": "481_RUDRANSH BHARADWAJ",
      "email": "2105481@kiit.ac.in"
      },
      {
      "name": "856_ Aishwarya Kumari",
      "email": "2105856@kiit.ac.in"
      },
      {
      "name": "382 KAUSHAL KISHOR",
      "email": "22054382@kiit.ac.in"
      },
      {
      "name": "AVIRAL SRIVASTAVA",
      "email": "22052806@kiit.ac.in"
      },
      {
      "name": "2105_SHREYA SHASHANK",
      "email": "21052105@kiit.ac.in"
      },
      {
      "name": "KUNAL SAHA",
      "email": "2328023@kiit.ac.in"
      },
      {
      "name": "827_SHASHANK DEEPAK",
      "email": "2105827@kiit.ac.in"
      },
      {
      "name": "3739_YASHITA ONDHIA",
      "email": "22053739@kiit.ac.in"
      },
      {
      "name": "1167_KHUSHAL JHINGAN",
      "email": "22051167@kiit.ac.in"
      },
      {
      "name": "398- RIMO GHOSH",
      "email": "2105398@kiit.ac.in"
      },
      {
      "name": "YUVRAJ SINGH",
      "email": "22054366@kiit.ac.in"
      },
      {
      "name": "1424 HARSHITA SHREYA",
      "email": "22051424@kiit.ac.in"
      },
      {
      "name": "172_ Abhay Singh",
      "email": "2105172@kiit.ac.in"
      },
      {
      "name": "NIRAMAY PUNETHA",
      "email": "22051264@kiit.ac.in"
      },
      {
      "name": "2502_Himanshu Pradhan",
      "email": "21052502@kiit.ac.in"
      },
      {
      "name": "1050_ Mukesh Kumar",
      "email": "21051050@kiit.ac.in"
      },
      {
      "name": "2601_SOURAV PRASAD",
      "email": "22052601@kiit.ac.in"
      },
      {
      "name": "6338_Debasmith Mishra",
      "email": "2206338@kiit.ac.in"
      },
      {
      "name": "3969 Rajdeep Roy Chowdhury",
      "email": "22053969@kiit.ac.in"
      },
      {
      "name": "1900_ KHUSHAL JENA",
      "email": "21051900@kiit.ac.in"
      },
      {
      "name": "ERIC MUKUL",
      "email": "22051515@kiit.ac.in"
      },
      {
      "name": "584 Hardik Ahuja",
      "email": "22051584@kiit.ac.in"
      },
      {
      "name": "1425-IFRA IMAM",
      "email": "22051425@kiit.ac.in"
      },
      {
      "name": "2791_ Sakshi Kumari",
      "email": "21052791@kiit.ac.in"
      },
      {
      "name": "682_Pratham",
      "email": "21052682@kiit.ac.in"
      },
      {
      "name": "2366_SOUNAK JYOTI",
      "email": "21052366@kiit.ac.in"
      },
      {
      "name": "742_SAMRIDDHI SINGH",
      "email": "2105742@kiit.ac.in"
      },
      {
      "name": "1812_DEEPANKAR SINGH",
      "email": "21051812@kiit.ac.in"
      },
      {
      "name": "SURYANSH TRIVEDI",
      "email": "22052516@kiit.ac.in"
      },
      {
      "name": "3701_PRADOSHA DHAL",
      "email": "22053701@kiit.ac.in"
      },
      {
      "name": "1218_PRANTIK BARIK",
      "email": "21051218@kiit.ac.in"
      },
      {
      "name": "DEBANGSHU SAIKIA",
      "email": "22052809@kiit.ac.in"
      },
      {
      "name": "6202_BIKASH KUMAR MAHANTA",
      "email": "2106202@kiit.ac.in"
      },
      {
      "name": "336_ADITI KHUNTIA",
      "email": "2105336@kiit.ac.in"
      },
      {
      "name": "5864- Annika Singh",
      "email": "2105864@kiit.ac.in"
      },
      {
      "name": "480_ANTRA AMRIT",
      "email": "21052480@kiit.ac.in"
      },
      {
      "name": "SHREYANSH",
      "email": "22052507@kiit.ac.in"
      },
      {
      "name": "1916_ALLU YESWANTH",
      "email": "22051916@kiit.ac.in"
      },
      {
      "name": "881_Aritra Pal",
      "email": "21051881@kiit.ac.in"
      },
      {
      "name": "777 Swastika",
      "email": "22052777@kiit.ac.in"
      },
      {
      "name": "6301 _SHIV SHANKAR",
      "email": "2106301@kiit.ac.in"
      },
      {
      "name": "3256_ Aaditya Karna",
      "email": "21053256@kiit.ac.in"
      },
      {
      "name": "ADWETA MISHRA",
      "email": "22053837@kiit.ac.in"
      },
      {
      "name": "1909_Mokshada Mohapatra",
      "email": "21051909@kiit.ac.in"
      },
      {
      "name": "AYUSHMAN PANIGRAHI",
      "email": "22053590@kiit.ac.in"
      },
      {
      "name": "8110 DHRUBADITYA CHAKRABARTY (2228110)",
      "email": "2228110@kiit.ac.in"
      },
      {
      "name": "472_ADITYA SHARMA",
      "email": "21052472@kiit.ac.in"
      },
      {
      "name": "1117_ Amit Sinha",
      "email": "21051117@kiit.ac.in"
      },
      {
      "name": "542_Anupam_Anubhav",
      "email": "21051542@kiit.ac.in"
      },
      {
      "name": "MICHAEL SENKAO",
      "email": "21053295@kiit.ac.in"
      },
      {
      "name": "869-ARYAMAN ACHARYA",
      "email": "2105869@kiit.ac.in"
      },
      {
      "name": "Ali Rizvi",
      "email": "22052616@kiit.ac.in"
      },
      {
      "name": "DEVJIT MONDAL",
      "email": "22052550@kiit.ac.in"
      },
      {
      "name": "7029_DIBYANSU MISHRA",
      "email": "22057029@kiit.ac.in"
      },
      {
      "name": "ANUSHA TRIPATHI",
      "email": "22051839@kiit.ac.in"
      },
      {
      "name": "SAKSHI ANAND (22053349)",
      "email": "22053349@kiit.ac.in"
      },
      {
      "name": "DIVYANSHU KUMAR",
      "email": "22052898@kiit.ac.in"
      },
      {
      "name": "2020_C Sai laxmi Gayatri",
      "email": "22052020@kiit.ac.in"
      },
      {
      "name": "6006 Akash",
      "email": "2206006@kiit.ac.in"
      },
      {
      "name": "ADARSH NAYAK (22053481)",
      "email": "22053481@kiit.ac.in"
      },
      {
      "name": "2425_KALLA SAI SURAJ",
      "email": "21052425@kiit.ac.in"
      },
      {
      "name": "SALONI GOEL",
      "email": "2205497@kiit.ac.in"
      },
      {
      "name": "1283 Simran",
      "email": "22051283@kiit.ac.in"
      },
      {
      "name": "1885_AYUSH BISWAS",
      "email": "21051885@kiit.ac.in"
      },
      {
      "name": "161_SHRUTI KUMARI",
      "email": "2205161@kiit.ac.in"
      },
      {
      "name": "NANDAKISHORE GUCHHAIT",
      "email": "2230092@kiit.ac.in"
      },
      {
      "name": "Shreya",
      "email": "22053022@kiit.ac.in"
      },
      {
      "name": "1325_AKSHAT GUPTA",
      "email": "23051325@kiit.ac.in"
      },
      {
      "name": "1452 SAHIL KHILAR",
      "email": "22051452@kiit.ac.in"
      },
      {
      "name": "4020_Arsh",
      "email": "22054020@kiit.ac.in"
      },
      {
      "name": "M SUDEEP",
      "email": "2228034@kiit.ac.in"
      },
      {
      "name": "4246-SOMYA BEHERA",
      "email": "22054246@kiit.ac.in"
      },
      {
      "name": "4063_pappu",
      "email": "22054063@kiit.ac.in"
      },
      {
      "name": "3189_SAPTAK GUHA",
      "email": "22053189@kiit.ac.in"
      },
      {
      "name": "4030_ Bibek_Das",
      "email": "22054030@kiit.ac.in"
      },
      {
      "name": "1000_SAYANDIP ADHIKARI",
      "email": "21051000@kiit.ac.in"
      },
      {
      "name": "023 DHIMAN RAY",
      "email": "2306023@kiit.ac.in"
      },
      {
      "name": "MANGAL KAMAKHI BISWASROY",
      "email": "22053872@kiit.ac.in"
      },
      {
      "name": "318_SHREEYANSHI CHANDRA",
      "email": "2105318@kiit.ac.in"
      },
      {
      "name": "2165_Nihar Ranjan",
      "email": "21052165@kiit.ac.in"
      },
      {
      "name": "9142_HARSH VARDHAN JHA",
      "email": "2129142@kiit.ac.in"
      },
      {
      "name": "TEJASVI SINGH",
      "email": "2205077@kiit.ac.in"
      },
      {
      "name": "4152 HARSHITA BINAYAKIA",
      "email": "22054152@kiit.ac.in"
      },
      {
      "name": "SHAMIK BHATTCHARJEE",
      "email": "23053327@kiit.ac.in"
      },
      {
      "name": "3461_Prajwal Yadav",
      "email": "21053461@kiit.ac.in"
      },
      {
      "name": "Shubham Agarwal",
      "email": "2305337@kiit.ac.in"
      },
      {
      "name": "2804_NAZIM QURESHI",
      "email": "21052804@kiit.ac.in"
      },
      {
      "name": "1864_MANAJIT MONDAL",
      "email": "22051864@kiit.ac.in"
      },
      {
      "name": "1019_VAISHNAVI KUMAR",
      "email": "21051019@kiit.ac.in"
      },
      {
      "name": "4370_ROHAN_KUSHWAHA",
      "email": "22054370@kiit.ac.in"
      },
      {
      "name": "1367_ADARSH RAI",
      "email": "21051367@kiit.ac.in"
      },
      {
      "name": "SATWIK MOHANTY",
      "email": "2229155@kiit.ac.in"
      },
      {
      "name": "3473-SIDDHARTHA GUPTA",
      "email": "23053473@kiit.ac.in"
      },
      {
      "name": "2652_ANUBHAV RANJAN",
      "email": "21052652@kiit.ac.in"
      },
      {
      "name": "853_SUBHAM PANDA",
      "email": "21051853@kiit.ac.in"
      },
      {
      "name": "ANUBHAB DUTTA",
      "email": "23053677@kiit.ac.in"
      },
      {
      "name": "PRACHI SAURABH",
      "email": "2105389@kiit.ac.in"
      },
      {
      "name": "LAMBODAR SARANGI",
      "email": "2230089@kiit.ac.in"
      },
      {
      "name": "4076_Rishavrajmandal",
      "email": "22054076@kiit.ac.in"
      },
      {
      "name": "1816_DIYA CHAKRABORTY",
      "email": "21051816@kiit.ac.in"
      },
      {
      "name": "4044_PRIYANSHU KUMAR",
      "email": "2204044@kiit.ac.in"
      },
      {
      "name": "843_SUYASH DUTTA",
      "email": "2105843@kiit.ac.in"
      },
      {
      "name": "495_DHRUV KUMAR",
      "email": "21052495@kiit.ac.in"
      },
      {
      "name": "AHANA DWARY",
      "email": "2229093@kiit.ac.in"
      },
      {
      "name": "1488_AKANKSHA GUPTA",
      "email": "22051488@kiit.ac.in"
      },
      {
      "name": "173_OM SINHA",
      "email": "22053173@kiit.ac.in"
      },
      {
      "name": "3127 YASH JHA",
      "email": "22053127@kiit.ac.in"
      },
      {
      "name": "219_MANAN SRIVASTAVA",
      "email": "2205219@kiit.ac.in"
      },
      {
      "name": "211 KUMAR ROSHAN",
      "email": "21053211@kiit.ac.in"
      },
      {
      "name": "421_SOUDEEP GHOSHAL",
      "email": "2205421@kiit.ac.in"
      },
      {
      "name": "MAYANK RAJ",
      "email": "22052560@kiit.ac.in"
      },
      {
      "name": "1090-ARYAMAN SANSKRITYAYAN (23051090)",
      "email": "23051090@kiit.ac.in"
      },
      {
      "name": "BISHESH SAHOO",
      "email": "22057023@kiit.ac.in"
      },
      {
      "name": "SHREEYA DEBNATH (22053628_Shreeya Debnath)",
      "email": "22053628@kiit.ac.in"
      },
      {
      "name": "PRATYUSH SINGH_1961",
      "email": "22051961@kiit.ac.in"
      },
      {
      "name": "2304_Khyati Agarwal",
      "email": "22052304@kiit.ac.in"
      },
      {
      "name": "SHASHANK PRATYUSH",
      "email": "22051792@kiit.ac.in"
      },
      {
      "name": "127_DEBADUTTA JENA",
      "email": "21051127@kiit.ac.in"
      },
      {
      "name": "GITESH KUMAR",
      "email": "22054287@kiit.ac.in"
      },
      {
      "name": "2811_Dev Shubhankar",
      "email": "22052811@kiit.ac.in"
      },
      {
      "name": "460_Bhaskar Lalwani",
      "email": "2205460@kiit.ac.in"
      },
      {
      "name": "SHUBH AGNIHOTRI",
      "email": "2305336@kiit.ac.in"
      },
      {
      "name": "NAURAV KUMAR",
      "email": "2228036@kiit.ac.in"
      },
      {
      "name": "3611_PIYUSH KUMAR JENA",
      "email": "22053611@kiit.ac.in"
      },
      {
      "name": "265_ADITYA MOHANTY",
      "email": "2205265@kiit.ac.in"
      },
      {
      "name": "AKASH AGRAWAL",
      "email": "2105219@kiit.ac.in"
      },
      {
      "name": "AMIT BEHERA",
      "email": "23053383@kiit.ac.in"
      },
      {
      "name": "369 MAYANK K KAUSHIK",
      "email": "21053369@kiit.ac.in"
      },
      {
      "name": "SATYAJEET SEN",
      "email": "2305155@kiit.ac.in"
      },
      {
      "name": "ANKIT BISWAS",
      "email": "22052533@kiit.ac.in"
      },
      {
      "name": "DEBASMITA CHANDA",
      "email": "23051826@kiit.ac.in"
      },
      {
      "name": "146_SANDIPAN JANA",
      "email": "2105146@kiit.ac.in"
      },
      {
      "name": "5180_ANIKET BHARDWAJ",
      "email": "2205180@kiit.ac.in"
      },
      {
      "name": "Never Exists",
      "email": "neverexists@gmail.com"
      },
      {
      "name": "DEBKANTA PAUL",
      "email": "2305694@kiit.ac.in"
      },
      {
      "name": "PRERIT PANDEY",
      "email": "22053333@kiit.ac.in"
      },
      {
      "name": "365_Debasish Das",
      "email": "2105365@kiit.ac.in"
      },
      {
      "name": "ALI SAMAD",
      "email": "22051660@kiit.ac.in"
      },
      {
      "name": "3604_Kushagra Yadav",
      "email": "22053604@kiit.ac.in"
      },
      {
      "name": "468_Meghana Sree Kamana",
      "email": "2105468@kiit.ac.in"
      },
      {
      "name": "JAY KUMAR",
      "email": "23052492@kiit.ac.in"
      },
      {
      "name": "ABIN MUKHERJEE",
      "email": "23051806@kiit.ac.in"
      },
      {
      "name": "037_Manavi Soni",
      "email": "2105037@kiit.ac.in"
      },
      {
      "name": "ADITI RAJ",
      "email": "2105047@kiit.ac.in"
      },
      {
      "name": "2261_Sandesh Kumar",
      "email": "23052261@kiit.ac.in"
      },
      {
      "name": "SAGAR RAJORIYA (2205923)",
      "email": "2205923@kiit.ac.in"
      },
      {
      "name": "2615_Aditya_Prakash",
      "email": "22052615@kiit.ac.in"
      },
      {
      "name": "Sanjay Sunar",
      "email": "sanjaysunar442@gmail.com"
      },
      {
      "name": "Technical Ranjit",
      "email": "technicalranjit@gmail.com"
      },
      {
      "name": "MADAN CHAUDHARY",
      "email": "23053886@kiit.ac.in"
      },
      {
      "name": "0031_Puja Guchhait",
      "email": "2130031@kiit.ac.in"
      },
      {
      "name": "563_SAKET SAURAV",
      "email": "2305563@kiit.ac.in"
      },
      {
      "name": "RUDRIKA PANIGRAHI",
      "email": "23052347@kiit.ac.in"
      },
      {
      "name": "Teamx Temp",
      "email": "tempteamx@gmail.com"
      },
      {
      "name": "1067-SRIRAM TRIPATHY",
      "email": "23051067@kiit.ac.in"
      },
      {
      "name": "3082_PARAG DAS",
      "email": "22053082@kiit.ac.in"
      },
      {
      "name": "3213 Ehteshamur",
      "email": "21053213@kiit.ac.in"
      },
      {
      "name": "Aradhana Behura",
      "email": "aradhana.behurafcs@kiit.ac.in"
      },
      {
      "name": "ADITYA SRIVASTAVA",
      "email": "23052452@kiit.ac.in"
      },
      {
      "name": "NEETI JHA",
      "email": "2328179@kiit.ac.in"
      },
      {
      "name": "9078_Mukul Jain",
      "email": "2129078@kiit.ac.in"
      },
      {
      "name": "PRASMIT PRAYANSU",
      "email": "2328035@kiit.ac.in"
      },
      {
      "name": "3018-ABHINAV KUMAR",
      "email": "23053018@kiit.ac.in"
      },
      {
      "name": "6417_Stuti Kudada",
      "email": "2206417@kiit.ac.in"
      },
      {
      "name": "SWARNAVA DUTTA",
      "email": "23052119@kiit.ac.in"
      },
      {
      "name": "5500_Surya Pratap Singh",
      "email": "2305500@kiit.ac.in"
      },
      {
      "name": "2348-Rishika P",
      "email": "21052348@kiit.ac.in"
      },
      {
      "name": "2134_PRITHWIRAJ DAS",
      "email": "22052134@kiit.ac.in"
      },
      {
      "name": "KAUSTUBH MAYANK",
      "email": "2305220@kiit.ac.in"
      }
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
    const user1 =[];
    const user2 =[]
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
    const users = []

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
    const users = []

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


  async generateResetDeviceToken(email:string){
    try {
      const user = await this.prisma.user.findUnique({
        where:{
          email:email
        }
      });

      console.log(user)
      if(!user){
        throw new BadRequestException("User Not Found");
      }
      if(!user.isPremium) throw new BadRequestException("This feature is only for Premium User");
      const token = await this.jwtService.signAsync({email:email},{
        secret:process.env.ACCESS_TOKEN_SECRET,
        expiresIn:60*5
      });
      if(!token) throw new InternalServerErrorException("Failed to Generate Tokens");   
      
      const resetLink = `https://kiitconnect.com/resetdevice?checkToken=${token}`
      console.log(email,resetLink)
      await this.mailService.sendResetDeviceLoginMail(user.email,user.name,resetLink);
      return true;
    } catch (error) {
      console.log(error);
      if(error instanceof BadRequestException){
        throw error;
      }
      throw new InternalServerErrorException("Failed to Generate token");
    }
  }

  async checkTokenAndResetDevice(token:string){
    try {
      const tk = await this.jwtService.verifyAsync(token,{
        secret:process.env.ACCESS_TOKEN_SECRET
      });
      if(tk.email){
       await this.cacheService.set(tk.email,JSON.stringify([]));
       return true;
      }
    } catch (error) {
      console.log(error)
      throw new BadRequestException("Invalid Token");
    }
  }

}
