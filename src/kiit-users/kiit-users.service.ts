import {
  ConflictException,
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

@Injectable()
export class KiitUsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly mailService: MyMailService,
  ) {}

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
      return newUser;
    } catch (error) {
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
      if (!user) throw new NotFoundException('User not found');
      return user;
    } catch (error) {
      if (error instanceof NotFoundException) {
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
        orderBy:{
          createdAt:'desc'
        }
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

      return users;
    } catch (error) {
      console.log(error);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Internal Server Error');
    }
  }

  async sendRemainderMail() {
   const users=[{"user":{"name":"KIIT Connect","email":"connectkiit@gmail.com"},"paymentScreenshot":null,"isActive":false,"branch":"CSE","year":"3rd Year"},{"user":{"name":"PRATHMESH GANGARDE","email":"22052487@kiit.ac.in"},"paymentScreenshot":null,"isActive":false,"branch":"CSE","year":"2nd Year"},{"user":{"name":"2310_APOORVA GAURAV TIWARI","email":"21052310@kiit.ac.in"},"paymentScreenshot":null,"isActive":false,"branch":"CSE","year":"3rd Year"},{"user":{"name":"2036_SUPRITI PARIA","email":"21052036@kiit.ac.in"},"paymentScreenshot":null,"isActive":false,"branch":"CSE","year":"3rd Year"},{"user":{"name":"596-KOUSHIKI BOSE","email":"21052596@kiit.ac.in"},"paymentScreenshot":null,"isActive":false,"branch":"CSE","year":"3rd Year"},{"user":{"name":"3267_ANAMOL KALWAR","email":"21053267@kiit.ac.in"},"paymentScreenshot":null,"isActive":false,"branch":"CSE","year":"3rd Year"},{"user":{"name":"Abhishek Yadav","email":"21052469@kiit.ac.in"},"paymentScreenshot":null,"isActive":false,"branch":"CSE","year":"3rd Year"},{"user":{"name":"REHAAN PAUL","email":"23052094@kiit.ac.in"},"paymentScreenshot":null,"isActive":false,"branch":"CSE","year":"1st Year"},{"user":{"name":"4231_SHIVAM SHAH","email":"22054231@kiit.ac.in"},"paymentScreenshot":null,"isActive":false,"branch":"CSE","year":"2nd Year"},{"user":{"name":"KUNAL SAW","email":"22051344@kiit.ac.in"},"paymentScreenshot":null,"isActive":false,"branch":"CSE","year":"2nd Year"},{"user":{"name":"SHREYANK DUTTA","email":"23053399@kiit.ac.in"},"paymentScreenshot":null,"isActive":false,"branch":"CSE","year":"1st Year"},{"user":{"name":"1859_Swapnil","email":"21051859@kiit.ac.in"},"paymentScreenshot":null,"isActive":false,"branch":"CSE","year":"3rd Year"},{"user":{"name":"484_ ARKA GHOSH","email":"21052484@kiit.ac.in"},"paymentScreenshot":null,"isActive":false,"branch":"CSE","year":"3rd Year"},{"user":{"name":"3541_ASHMIT PATRA","email":"23053541@kiit.ac.in"},"paymentScreenshot":null,"isActive":false,"branch":"CSE","year":"1st Year"},{"user":{"name":"6307-Tufan Dey","email":"2206307@kiit.ac.in"},"paymentScreenshot":null,"isActive":false,"branch":"IT","year":"2nd Year"},{"user":{"name":"1706_Abhishek Mallick","email":"21051706@kiit.ac.in"},"paymentScreenshot":null,"isActive":false,"branch":"CSE","year":"3rd Year"},{"user":{"name":"730-ISHU KANT","email":"22052730@kiit.ac.in"},"paymentScreenshot":null,"isActive":false,"branch":"CSE","year":"2nd Year"},{"user":{"name":"703_SATWIK SINGH","email":"21052703@kiit.ac.in"},"paymentScreenshot":null,"isActive":false,"branch":"CSE","year":"3rd Year"},{"user":{"name":"1990_SURYASNATA PAITAL","email":"22051990@kiit.ac.in"},"paymentScreenshot":null,"isActive":false,"branch":"CSE","year":"2nd Year"},{"user":{"name":"3612_PRAGYADIPTA PRADHAN","email":"22053612@kiit.ac.in"},"paymentScreenshot":null,"isActive":false,"branch":"CSE","year":"2nd Year"},{"user":{"name":"2042_RIDDHIMA BISWAS","email":"22052042@kiit.ac.in"},"paymentScreenshot":null,"isActive":false,"branch":"CSE","year":"2nd Year"},{"user":{"name":"2286_SOURODEEP KUNDU","email":"21052286@kiit.ac.in"},"paymentScreenshot":null,"isActive":false,"branch":"CSE","year":"3rd Year"},{"user":{"name":"5991_RUNGSHIT SAHA","email":"2105991@kiit.ac.in"},"paymentScreenshot":null,"isActive":false,"branch":"CSE","year":"3rd Year"},{"user":{"name":"458 _SWARNADEEP GHOSAL","email":"21052458@kiit.ac.in"},"paymentScreenshot":null,"isActive":false,"branch":"CSE","year":"3rd Year"},{"user":{"name":"VINIT AGARWAL","email":"21051275@kiit.ac.in"},"paymentScreenshot":null,"isActive":false,"branch":"CSE","year":"3rd Year"},{"user":{"name":"AYUSH KUMAR","email":"22051065@kiit.ac.in"},"paymentScreenshot":null,"isActive":false,"branch":"CSE","year":"2nd Year"},{"user":{"name":"3450_ Rahul Kumar Gupta","email":"21053450@kiit.ac.in"},"paymentScreenshot":null,"isActive":false,"branch":"CSE","year":"3rd Year"},{"user":{"name":"1898_SRINJOY KUNDU","email":"22051898@kiit.ac.in"},"paymentScreenshot":null,"isActive":false,"branch":"CSE","year":"2nd Year"},{"user":{"name":"1715_ANUBHUTI PRERNA","email":"21051715@kiit.ac.in"},"paymentScreenshot":null,"isActive":false,"branch":"CSE","year":"3rd Year"},{"user":{"name":"386_Kashish","email":"2205386@kiit.ac.in"},"paymentScreenshot":null,"isActive":false,"branch":"CSE","year":"2nd Year"},{"user":{"name":"Shwetanka Jha","email":"22054097@kiit.ac.in"},"paymentScreenshot":null,"isActive":false,"branch":"CSE","year":"2nd Year"},{"user":{"name":"383-MANSHI PRATAP","email":"2105383@kiit.ac.in"},"paymentScreenshot":null,"isActive":false,"branch":"CSE","year":"3rd Year"},{"user":{"name":"2648_ANEESHA","email":"21052648@kiit.ac.in"},"paymentScreenshot":null,"isActive":false,"branch":"CSE","year":"3rd Year"},{"user":{"name":"1505_SAIM","email":"21051505@kiit.ac.in"},"paymentScreenshot":null,"isActive":false,"branch":"CSE","year":"3rd Year"},{"user":{"name":"AISWARYA AYASKANT","email":"22053658@kiit.ac.in"},"paymentScreenshot":null,"isActive":false,"branch":"CSE","year":"2nd Year"},{"user":{"name":"SUMAN SINGHA","email":"2305822@kiit.ac.in"},"paymentScreenshot":null,"isActive":false,"branch":"CSE","year":"1st Year"},{"user":{"name":"5989_RINKESH KUMAR SINHA","email":"2105989@kiit.ac.in"},"paymentScreenshot":null,"isActive":false,"branch":"CSE","year":"3rd Year"},{"user":{"name":"DEBJYOTI SHIT","email":"22052978@kiit.ac.in"},"paymentScreenshot":null,"isActive":false,"branch":"CSE","year":"2nd Year"},{"user":{"name":"750_Piyush","email":"21051750@kiit.ac.in"},"paymentScreenshot":null,"isActive":false,"branch":"CSE","year":"3rd Year"},{"user":{"name":"SANJIV KUMAR","email":"22054265@kiit.ac.in"},"paymentScreenshot":null,"isActive":false,"branch":"CSE","year":"2nd Year"},{"user":{"name":"073_SRITAM DUTTA","email":"2105073@kiit.ac.in"},"paymentScreenshot":null,"isActive":false,"branch":"CSE","year":"3rd Year"},{"user":{"name":"2133_ Adrita Mohanty","email":"21052133@kiit.ac.in"},"paymentScreenshot":null,"isActive":false,"branch":"CSE","year":"3rd Year"},{"user":{"name":"ANIRAN SAHA","email":"22053137@kiit.ac.in"},"paymentScreenshot":null,"isActive":false,"branch":"CSE","year":"2nd Year"},{"user":{"name":"DEEPAYAN DAS","email":"2205635@kiit.ac.in"},"paymentScreenshot":null,"isActive":false,"branch":"CSE","year":"2nd Year"},{"user":{"name":"_5935_SHUBAM CHAKRABORTY","email":"2205935@kiit.ac.in"},"paymentScreenshot":null,"isActive":false,"branch":"CSE","year":"2nd Year"},{"user":{"name":"3289_MANDIP SAH","email":"21053289@kiit.ac.in"},"paymentScreenshot":null,"isActive":false,"branch":"CSE","year":"3rd Year"},{"user":{"name":"2043_ Ritajit Pal","email":"22052043@kiit.ac.in"},"paymentScreenshot":null,"isActive":false,"branch":"CSE","year":"2nd Year"},{"user":{"name":"589-MEGHANSH GOVIL","email":"22051589@kiit.ac.in"},"paymentScreenshot":null,"isActive":false,"branch":"CSE","year":"2nd Year"},{"user":{"name":"629_MANDIRA GHOSH","email":"2105629@kiit.ac.in"},"paymentScreenshot":null,"isActive":false,"branch":"CSE","year":"3rd Year"},{"user":{"name":"4077_Ritesh Sah","email":"22054077@kiit.ac.in"},"paymentScreenshot":null,"isActive":false,"branch":"CSE","year":"2nd Year"},{"user":{"name":"1801_ARNAV DEY","email":"21051801@kiit.ac.in"},"paymentScreenshot":null,"isActive":false,"branch":"CSE","year":"3rd Year"},{"user":{"name":"3403-AROSREE SATAPATHY","email":"22053403@kiit.ac.in"},"paymentScreenshot":null,"isActive":false,"branch":"CSE","year":"2nd Year"},{"user":{"name":"4107 Abhisek Singh","email":"22054107@kiit.ac.in"},"paymentScreenshot":null,"isActive":false,"branch":"CSE","year":"2nd Year"},{"user":{"name":"4173-SIDDHARTH SENGUPTA","email":"22054173@kiit.ac.in"},"paymentScreenshot":null,"isActive":false,"branch":"CSE","year":"2nd Year"},{"user":{"name":"1833_PRANABIT PRADHAN","email":"21051833@kiit.ac.in"},"paymentScreenshot":null,"isActive":false,"branch":"CSE","year":"3rd Year"},{"user":{"name":"203_RICHIK DEY","email":"2206203@kiit.ac.in"},"paymentScreenshot":null,"isActive":false,"branch":"IT","year":"2nd Year"},{"user":{"name":"123_ABHA SRIVASTAVA","email":"2128123@kiit.ac.in"},"paymentScreenshot":null,"isActive":false,"branch":"CSSE","year":"3rd Year"},{"user":{"name":"098 _AhonaGhosh","email":"2105098@kiit.ac.in"},"paymentScreenshot":null,"isActive":false,"branch":"CSE","year":"3rd Year"},{"user":{"name":"280_KUMAR YASH MEHUL","email":"2105280@kiit.ac.in"},"paymentScreenshot":null,"isActive":false,"branch":"CSE","year":"3rd Year"},{"user":{"name":"072-GYAN PRAKASH DASH","email":"2128072@kiit.ac.in"},"paymentScreenshot":null,"isActive":false,"branch":"CSSE","year":"3rd Year"},{"user":{"name":"PRAYAG PATRO","email":"23051288@kiit.ac.in"},"paymentScreenshot":null,"isActive":false,"branch":"CSE","year":"1st Year"},{"user":{"name":"514_TANYA CHAUDHARY","email":"2205514@kiit.ac.in"},"paymentScreenshot":null,"isActive":false,"branch":"CSE","year":"2nd Year"},{"user":{"name":"KUMAR ANURAG","email":"22052907@kiit.ac.in"},"paymentScreenshot":null,"isActive":false,"branch":"CSE","year":"2nd Year"},{"user":{"name":"DEBASHRITA MANDAL","email":"22052810@kiit.ac.in"},"paymentScreenshot":null,"isActive":false,"branch":"CSE","year":"2nd Year"},{"user":{"name":"SAAKSSHI PODDER","email":"23051943@kiit.ac.in"},"paymentScreenshot":null,"isActive":false,"branch":"CSE","year":"1st Year"},{"user":{"name":"3474_UJJAWAL ANAND","email":"23053474@kiit.ac.in"},"paymentScreenshot":null,"isActive":false,"branch":"CSE","year":"1st Year"},{"user":{"name":"2386_AKASH DUTTACHOWDHURY","email":"21052386@kiit.ac.in"},"paymentScreenshot":null,"isActive":false,"branch":"CSE","year":"3rd Year"},{"user":{"name":"6314_ASHISH PATEL","email":"2106314@kiit.ac.in"},"paymentScreenshot":null,"isActive":false,"branch":"IT","year":"3rd Year"},{"user":{"name":"4115 - Aadya Sharma","email":"22054115@kiit.ac.in"},"paymentScreenshot":null,"isActive":false,"branch":"CSE","year":"2nd Year"},{"user":{"name":"3437_PRIYANKA KUMARI","email":"21053437@kiit.ac.in"},"paymentScreenshot":null,"isActive":false,"branch":"CSE","year":"3rd Year"},{"user":{"name":"2164_SUBHAM BERA","email":"22052164@kiit.ac.in"},"paymentScreenshot":null,"isActive":false,"branch":"CSE","year":"2nd Year"},{"user":{"name":"2060_SINCHAL KAR","email":"22052060@kiit.ac.in"},"paymentScreenshot":null,"isActive":false,"branch":"CSE","year":"4th Year"},{"user":{"name":"6201_RANGIN BERA","email":"2206201@kiit.ac.in"},"paymentScreenshot":null,"isActive":false,"branch":"IT","year":"2nd Year"},{"user":{"name":"8062_Abhishek D","email":"2328062@kiit.ac.in"},"paymentScreenshot":null,"isActive":false,"branch":"CSSE","year":"1st Year"},{"user":{"name":"533_Sneha Behera","email":"21052533@kiit.ac.in"},"paymentScreenshot":null,"isActive":false,"branch":"CSE","year":"3rd Year"},{"user":{"name":"NILOTPAL BASU","email":"22051085@kiit.ac.in"},"paymentScreenshot":null,"isActive":false,"branch":"CSE","year":"2nd Year"},{"user":{"name":"3586-AVINASH PATRA","email":"22053586@kiit.ac.in"},"paymentScreenshot":null,"isActive":false,"branch":"CSE","year":"2nd Year"},{"user":{"name":"5469_NAKSHATRA GUPTA","email":"2105469@kiit.ac.in"},"paymentScreenshot":null,"isActive":false,"branch":"CSE","year":"3rd Year"},{"user":{"name":"2894_AYUSH RANJAN","email":"22052894@kiit.ac.in"},"paymentScreenshot":null,"isActive":false,"branch":"CSE","year":"2nd Year"},{"user":{"name":"145_Arani Maity","email":"22053145@kiit.ac.in"},"paymentScreenshot":null,"isActive":false,"branch":"CSE","year":"2nd Year"},{"user":{"name":"TAMONASH MAJUMDER (22053474)","email":"22053474@kiit.ac.in"},"paymentScreenshot":null,"isActive":false,"branch":"CSE","year":"2nd Year"},{"user":{"name":"449 Chaitanya","email":"2105449@kiit.ac.in"},"paymentScreenshot":null,"isActive":false,"branch":"CSE","year":"3rd Year"},{"user":{"name":"625_AVI SAHAI","email":"2205625@kiit.ac.in"},"paymentScreenshot":null,"isActive":false,"branch":"CSE","year":"2nd Year"},{"user":{"name":"2365_Siddhartha Mukherjee","email":"21052365@kiit.ac.in"},"paymentScreenshot":null,"isActive":false,"branch":"CSE","year":"3rd Year"},{"user":{"name":"SOUMYA KUMAR","email":"22053285@kiit.ac.in"},"paymentScreenshot":null,"isActive":false,"branch":"CSE","year":"2nd Year"},{"user":{"name":"1468_ARVIND KAPHLEY","email":"21051468@kiit.ac.in"},"paymentScreenshot":null,"isActive":false,"branch":"CSE","year":"3rd Year"},{"user":{"name":"PROGYA BHATTACHARJEE","email":"22053007@kiit.ac.in"},"paymentScreenshot":null,"isActive":false,"branch":"CSE","year":"2nd Year"},{"user":{"name":"653_SAHIL RAJ SINGH","email":"2105653@kiit.ac.in"},"paymentScreenshot":null,"isActive":false,"branch":"CSE","year":"3rd Year"},{"user":{"name":"1343_Shubhadeep Ghatak","email":"21051343@kiit.ac.in"},"paymentScreenshot":null,"isActive":false,"branch":"CSE","year":"3rd Year"},{"user":{"name":"3614_PRATEEK PARIJA","email":"22053614@kiit.ac.in"},"paymentScreenshot":null,"isActive":false,"branch":"CSE","year":"2nd Year"},{"user":{"name":"177_AHELI MANNA","email":"2105177@kiit.ac.in"},"paymentScreenshot":null,"isActive":false,"branch":"CSE","year":"3rd Year"},{"user":{"name":"1699 NISCHAY JAIN","email":"22051699@kiit.ac.in"},"paymentScreenshot":null,"isActive":false,"branch":"CSE","year":"2nd Year"},{"user":{"name":"Ansh Kumar Sharma","email":"2305114@kiit.ac.in"},"paymentScreenshot":null,"isActive":false,"branch":"CSE","year":"1st Year"},{"user":{"name":"1085_SATYA PRAKASH","email":"21051085@kiit.ac.in"},"paymentScreenshot":null,"isActive":false,"branch":"CSE","year":"3rd Year"},{"user":{"name":"270_AYUSHI MOHANTY","email":"2105270@kiit.ac.in"},"paymentScreenshot":null,"isActive":false,"branch":"CSE","year":"3rd Year"},{"user":{"name":"4403ROHIT SHARMA","email":"22054403@kiit.ac.in"},"paymentScreenshot":null,"isActive":false,"branch":"CSE","year":"4th Year"},{"user":{"name":"2332KUNAL KUMAR","email":"21052332@kiit.ac.in"},"paymentScreenshot":null,"isActive":false,"branch":"CSE","year":"3rd Year"},{"user":{"name":"SAYAN DAS","email":"2228056@kiit.ac.in"},"paymentScreenshot":null,"isActive":false,"branch":"CSSE","year":"2nd Year"},{"user":{"name":"3363 KHUSHI","email":"21053363@kiit.ac.in"},"paymentScreenshot":null,"isActive":false,"branch":"CSE","year":"3rd Year"},{"user":{"name":"1967_Amrita Sinha","email":"21051967@kiit.ac.in"},"paymentScreenshot":null,"isActive":false,"branch":"CSE","year":"3rd Year"},{"user":{"name":"534_AYUSH BISWAL","email":"2105534@kiit.ac.in"},"paymentScreenshot":null,"isActive":false,"branch":"CSE","year":"3rd Year"},{"user":{"name":"471_NAMRATA MAHAPATRA","email":"2105471@kiit.ac.in"},"paymentScreenshot":null,"isActive":false,"branch":"CSE","year":"3rd Year"},{"user":{"name":"5940_ADARSH TIWARI","email":"2105940@kiit.ac.in"},"paymentScreenshot":null,"isActive":false,"branch":"CSE","year":"3rd Year"},{"user":{"name":"8030_NAYNIKA SARKAR","email":"2128030@kiit.ac.in"},"paymentScreenshot":null,"isActive":false,"branch":"CSCE","year":"3rd Year"},{"user":{"name":"3641 _SOURAV MALLICK","email":"22053641@kiit.ac.in"},"paymentScreenshot":null,"isActive":false,"branch":"CSE","year":"2nd Year"},{"user":{"name":"1008_SAHASRANSHU SHASTRI","email":"22051008@kiit.ac.in"},"paymentScreenshot":null,"isActive":false,"branch":"CSE","year":"2nd Year"},{"user":{"name":"Bikash Prasad","email":"22054033@kiit.ac.in"},"paymentScreenshot":null,"isActive":false,"branch":"CSE","year":"2nd Year"}]

    try {
      for (const user of users) {
        // setTimeout(async() => {
           await this.mailService.sendPaymentReminder({
             email: user.user.email,
             name: user.user.name,
             branch: user.branch,
             year: user.year,
           });
          // console.log('Mail sent to ' + user.user.name);
        // }, 3000);
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
    const user = [
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
        name: '3264_AJAY KHATRI CHHETRI',
        email: '21053264@kiit.ac.in',
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
        name: '3281_Fariya Afrin',
        email: '21053281@kiit.ac.in',
      },
      {
        name: '0810_ IshitaSrivastava',
        email: '2205810@kiit.ac.in',
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
        name: 'SATYAM RAJ',
        email: '2228054@kiit.ac.in',
      },
      {
        name: 'SANSKAR',
        email: '2005825@kiit.ac.in',
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
        name: 'Tanik Saikh',
        email: 'tanik.saikhfcs@kiit.ac.in',
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
        name: 'Soumyadeep Kundu',
        email: '2305820@kiit.ac.in',
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
        name: 'Roshan Sisodia',
        email: '21052611@kiit.ac.in',
      },
      {
        name: 'SHILKY DWIVEDI',
        email: '22052058@kiit.ac.in',
      },
      {
        name: '2310_APOORVA GAURAV TIWARI',
        email: '21052310@kiit.ac.in',
      },
      {
        name: '3258_Aayush Sinha',
        email: '21053258@kiit.ac.in',
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
        name: '4231_SHIVAM SHAH',
        email: '22054231@kiit.ac.in',
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
        name: '3605_LINGAM TANMAI',
        email: '22053605@kiit.ac.in',
      },
      {
        name: 'Isha Mishra',
        email: '21051568@kiit.ac.in',
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
        name: '5944_ Akshat Srivastava',
        email: '2105944@kiit.ac.in',
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
        name: 'NABIN PAUDEL',
        email: '23053747@kiit.ac.in',
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
        name: '1715_ANUBHUTI PRERNA',
        email: '21051715@kiit.ac.in',
      },
      {
        name: '580_SHATADRU BANERJEE',
        email: '2105580@kiit.ac.in',
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
        name: '6277_ADITYA KAMAL',
        email: '2106277@kiit.ac.in',
      },
      {
        name: '2026-SHEKHAR MAJHI',
        email: '21052026@kiit.ac.in',
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
    ];

    try {
      for (let i = 0; i < user.length; i++) {
        await this.mailService.sendNotPremium(user[i].name, user[i].email, i);
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
        succuess:true
      }
    } catch (error) {
      console.log(error)
    }
  }
}
