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
      const refCode = this.generateReferralCode(6)
      const newUser = await this.prisma.user.create({
        data: {
          ...dto,
          refrealCode: refCode
        }
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

      const {refralCode,...res} = dto;
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
        activateLink: 'https://kiitconnect.live/payment',
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
      if (error instanceof ConflictException || error instanceof BadRequestException) {
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

      if(user.referredBy){

        const refUser = await this.prisma.user.findUnique({
          where:{
            id:user.referredBy
          }
        })
        console.log(refUser)
        if(refUser){
          const up = await this.prisma.user.update({
            where:{
              id:refUser.id
            },
            data:{
              refralAmount:{
                increment:10
              }
            }
          })
          if(!up) throw new InternalServerErrorException('Failed to Update Referral Amount');
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
    const users = [];
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
        name: 'DHIRAJ KUMAR',
        email: '23053722@kiit.ac.in',
      },
      {
        name: 'DEVYANI KUMARI SAH_3870',
        email: '23053870@kiit.ac.in',
      },
      {
        name: '2101_Aryan Saxena',
        email: '22052101@kiit.ac.in',
      },
      {
        name: '061_SASHANK PATNAIK',
        email: '2106061@kiit.ac.in',
      },
      {
        name: '582_Dhrubajyoti BANERJEE',
        email: '21052582@kiit.ac.in',
      },
      {
        name: 'SOUBHAGYA SWAIN',
        email: '22054199@kiit.ac.in',
      },
      {
        name: 'AYUSH ANTHONY',
        email: '2205722@kiit.ac.in',
      },
      {
        name: '6040_Prithvi raj Chouhan',
        email: '2306040@kiit.ac.in',
      },
      {
        name: 'PANKAJ KUMAR',
        email: '22054271@kiit.ac.in',
      },
      {
        name: 'SANU PRASAD',
        email: '22054343@kiit.ac.in',
      },
      {
        name: 'RISHIKA SARMA',
        email: '2330253@kiit.ac.in',
      },
      {
        name: '724_N Pavan Kumar',
        email: '2105724@kiit.ac.in',
      },
      {
        name: 'UMANG AGRAWAL (3561_UMANG AGRAWAL)',
        email: '22053561@kiit.ac.in',
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
      2105810, 2106043, 2106070, 2106132, 2106221, 2106231, 2106276, 2129003,
      2129016, 2129081, 2129083, 2129097, 2129107, 2129114, 2129135, 21051063,
      21051174, 21051333, 21051385, 21051389, 21051447, 21051539, 21051569,
      21051587, 21051597, 21051609, 21051622, 21051711, 21051712, 21051761,
      21051901, 21051965, 21051973, 21051981, 21052061, 21052227, 21052242,
      21052259, 21052293, 21052442, 21052494, 21052503, 21052542, 21052657,
      21052696, 21052735, 21052877, 21052971, 21053341, 21053350, 22057009,
      22057010, 22057016, 22057017, 22057021, 22057041, 22057062, 22057078,
      22057086, 2105058, 2105425, 21051273, 21051540, 21051733, 21051745,
      21051765, 2105101, 2105105, 2105191, 2105203, 2105265, 2105396, 2105703,
      2105716, 2105760, 2105947, 2128044, 2128058, 2128070, 2128078, 2128105,
      2128116, 2128146, 2129021, 2129054, 21051005, 21051022, 21051049,
      21051059, 21051136, 21051196, 21051376, 21051473, 21051579, 21051644,
      21051660, 21051691, 21051746, 21051851, 21052093, 21052124, 21052289,
      21052418, 21052438, 21052551, 21052588, 21052646, 21052704, 21052748,
      21052854, 21052891, 21053269, 2105084, 2105111, 2105124, 2105160, 2105285,
      2105379, 2105384, 2105391, 2105465, 2105475, 2105675, 2105676, 2105687,
      2105697, 2105779, 2105826, 2105828, 2105852, 2106003, 2106033, 2106136,
      2106169, 2106217, 2106254, 21051119, 21051156, 21051160, 21051167,
      21051206, 21051448, 21051537, 21051598, 21051599, 21051896, 21051945,
      21051961, 21051990, 21052086, 21052215, 21052222, 21052223, 21052230,
      21052252, 21052284, 21052299, 21052322, 21052376, 21052461, 21052516,
      21052617, 21052667, 21052675, 21052679, 21052718, 21052740, 21052921,
      21052934, 21052937, 21052940, 21052950, 21052955, 21053302, 21053324,
      21053371, 21053404, 21053406, 21053443, 21053457, 2105092, 2105163,
      2105165, 2105289, 2105422, 2105427, 2105462, 2105499, 2105573, 2105590,
      2105600, 2105612, 2105658, 2105848, 2105868, 2105998, 2106050, 2106262,
      2106288, 2128093, 2129006, 2129009, 2129017, 2129018, 2129025, 2129058,
      2129065, 2129156, 21051009, 21051657, 21051659, 21051661, 21051673,
      21051684, 21051798, 21051806, 21051832, 21051882, 21052018, 21052048,
      21052125, 21052127, 21052164, 21052642, 21052650, 21052912, 21052986,
      21053456, 22057001, 22057004, 22057047, 2105272, 2105279, 2105339,
      2105621, 2105886, 2106131, 2106172, 2106257, 21051109, 21051168, 21051195,
      21051197, 21051210, 21051213, 21051214, 21051215, 21051260, 21051318,
      21051396, 21051408, 21051555, 21051611, 21051614, 21051618, 21051886,
      21051894, 21051969, 21052159, 21052266, 21052288, 21052372, 21052397,
      21052431, 21052433, 21052453, 21052732, 21052752, 21052755, 21052763,
      21052773, 21052787, 21052855, 21052993, 21053215, 21053225, 2105249,
      2105488, 2105489, 2105657, 2105692, 2105745, 2105746, 2105759, 2105764,
      2105850, 2105859, 2105867, 2105938, 2105942, 2105967, 2106146, 2106154,
      2106234, 2106292, 2106295, 2106308, 2106316, 21051007, 21051030, 21051062,
      21051132, 21051166, 21051297, 21051311, 21051331, 21051380, 21051511,
      21051643, 21051690, 21051734, 21051736, 21051747, 21051779, 21051800,
      21051868, 21051876, 21051884, 21052051, 21052063, 21052290, 21052460,
      21052477, 21052555, 21052562, 21052592, 21052614, 21052681, 21052760,
      21052839, 21052849, 21052931, 2105022, 2105054, 2105159, 2105190, 2105214,
      2105227, 2105242, 2105255, 2105292, 2105294, 2105351, 2105655, 2105946,
      2105969, 2105990, 2105999, 2106205, 2106212, 2106244, 2106252, 21051042,
      21051157, 21051176, 21051185, 21051208, 21051211, 21051245, 21051344,
      21051392, 21051624, 21051966, 21051988, 21052000, 21052082, 21052089,
      21052178, 21052272, 21052274, 21052305, 21052466, 21052482, 21052561,
      21052606, 21052625, 21052643, 21052897, 21052983, 21053452, 2105173,
      2105218, 2105235, 2105463, 2105484, 2105518, 2105635, 2105737, 2105749,
      2105751, 2105752, 2106035, 2106144, 2106147, 2106158, 2106209, 2128073,
      2128074, 2128089, 2128094, 2128096, 2129011, 21051130, 21051249, 21051281,
      21051286, 21051336, 21051450, 21051475, 21051576, 21051638, 21051766,
      21051773, 21051792, 21052037, 21052097, 21052122, 21052225, 21052428,
      21052446, 21052724, 21052771, 21052776, 21052794, 21052812, 21052890,
      21052896, 21052984, 21053444, 2105026, 2105031, 2105085, 2105110, 2105156,
      2105205, 2105256, 2105440, 2105458, 2105605, 2105668, 2105881, 2106045,
      2106077, 2106285, 2106303, 2128042, 2128063, 2128077, 21051037, 21051081,
      21051083, 21051236, 21051237, 21051253, 21051255, 21051553, 21051567,
      21051664, 21051698, 21051880, 21051887, 21051908, 21051947, 21052056,
      21052220, 21052244, 21052380, 21052393, 21052395, 21052405, 21052449,
      21052508, 21052574, 21053229, 21053250, 21053399, 21053445, 2105076,
      2105081, 2105206, 2105291, 2105341, 2105399, 2105415, 2105646, 2105667,
      2105717, 2105726, 2105761, 2105792, 2105804, 2105894, 2105965, 2128066,
      2128080, 2128087, 21051076, 21051134, 21051142, 21051158, 21051220,
      21051261, 21051391, 21051526, 21051561, 21051642, 21051663, 21051674,
      21051753, 21051768, 21051830, 21051831, 21051846, 21052014, 21052118,
      21052219, 21052248, 21052419, 21052485, 21052818, 21052820, 21052841,
      21052875, 21052952, 22057052, 2105157, 2105319, 2105370, 2105432, 2105445,
      2105588, 2105845, 2105928, 2106223, 2106235, 2106237, 2106247, 2128006,
      2128008, 2129092, 2129154, 2129159, 21051065, 21051280, 21051320,
      21051488, 21051547, 21051554, 21051615, 21051820, 21051840, 21052020,
      21052029, 21052047, 21052145, 21052166, 21052369, 21052384, 21052445,
      21052525, 21052777, 21052853, 21052916, 2105033, 2105051, 2105357,
      2105426, 2105510, 2105540, 2105620, 2105829, 2105883, 2106007, 2106055,
      2106098, 2106150, 2106175, 2106181, 2106197, 2106251, 2106272, 2106273,
      2128037, 2128086, 2128115, 2128132, 2129022, 2129026, 2129028, 21051164,
      21051264, 21051342, 21051351, 21051492, 21051577, 21051654, 21051823,
      21051963, 21052136, 21052283, 21052330, 21052381, 21052487, 21052631,
      21052753, 21052807, 21052810, 21052832, 21052888, 21052900, 21053299,
      21053317, 2105104, 2105109, 2105135, 2105170, 2105186, 2105187, 2105217,
      2105223, 2105237, 2105334, 2105401, 2105409, 2105428, 2105434, 2105443,
      2105460, 2105480, 2105503, 2105545, 2105585, 2105592, 2105602, 2105618,
      2105627, 2105633, 2105679, 2105705, 2105730, 2105738, 2105754, 2105786,
      2105794, 2105797, 2105803, 2105816, 2105833, 2105937, 2105957, 2105964,
      2105975, 2105994, 2106016, 2106031, 2106072, 2106085, 2106087, 2106109,
      2106137, 2106161, 2106211, 2106281, 2106300, 2128005, 2128013, 2128015,
      2129029, 2129052, 2129066, 2129089, 2129119, 21051010, 21051026, 21051073,
      21051091, 21051093, 21051108, 21051120, 21051189, 21051231, 21051302,
      21051365, 21051398, 21051415, 21051418, 21051419, 21051433, 21051434,
      21051469, 21051667, 21051699, 21051726, 21051749, 21051757, 21051838,
      21051839, 21051916, 21051951, 21051956, 21052084, 21052085, 21052119,
      21052137, 21052161, 21052180, 21052217, 21052273, 21052275, 21052285,
      21052307, 21052390, 21052417, 21052474, 21052514, 21052535, 21052620,
      21052707, 21052711, 21052742, 21052774, 21052779, 21052825, 21052858,
      21052881, 21052906, 21052995, 21053205, 21053253, 21053335, 21053357,
      21053419, 21053453, 21053472, 22057038, 22057064, 2105062, 2105113,
      2105151, 2105171, 2105528, 2105596, 2105660, 2105750, 2105871, 2106164,
      2106178, 2106291, 2128034, 2128036, 2128054, 2128055, 2128062, 2128120,
      2129020, 2129047, 2129069, 21051152, 21051438, 21051693, 21051811,
      21052005, 21052131, 21052448, 21052725, 21052769, 21052796, 21052901,
      21052951, 21053233, 21053242, 2105108, 2105352, 2105955, 2106029, 2106036,
      2106040, 2106065, 2106124, 2106220, 2128048, 2128092, 2128114, 2128118,
      2128141, 2129067, 2129095, 21051029, 21051207, 21051243, 21051250,
      21051384, 21051404, 21051425, 21051544, 21051564, 21051580, 21051701,
      21051748, 21051780, 21051793, 21051869, 21051871, 21051888, 21052040,
      21052548, 21052757, 21052782, 21052868, 22057055, 2105012, 2105013,
      2105045, 2105052, 2105123, 2105129, 2105228, 2105250, 2105251, 2105302,
      2105349, 2105363, 2105438, 2105472, 2105538, 2105640, 2105680, 2105710,
      2105743, 2105758, 2105799, 2105916, 2105923, 2105924, 2105927, 2105948,
      2105981, 2105995, 2105997, 2106028, 2106094, 2106245, 2106313, 2128014,
      2128043, 2128050, 2128052, 2128082, 2128145, 2129030, 2129045, 2129053,
      2129064, 2129099, 2129101, 2129122, 21051036, 21051066, 21051129,
      21051147, 21051246, 21051352, 21051364, 21051370, 21051378, 21051395,
      21051424, 21051429, 21051478, 21051491, 21051546, 21051635, 21051652,
      21051665, 21051717, 21051724, 21051774, 21051917, 21051937, 21051962,
      21052023, 21052072, 21052078, 21052114, 21052182, 21052191, 21052206,
      21052264, 21052277, 21052304, 21052333, 21052342, 21052399, 21052507,
      21052511, 21052702, 21052863, 21052876, 21052880, 21052941, 21052962,
      21053216, 21053219, 21053235, 21053268, 21053414, 2105004, 2105030,
      2105072, 2105097, 2105102, 2105126, 2105150, 2105211, 2105329, 2105330,
      2105435, 2105526, 2105531, 2105736, 2105744, 2105896, 2106047, 2106084,
      2106092, 2106139, 2106167, 2106195, 2106299, 2128028, 2128046, 2129023,
      2129035, 2129113, 20051279, 21051075, 21051089, 21051114, 21051137,
      21051202, 21051266, 21051278, 21051285, 21051347, 21051355, 21051379,
      21051386, 21051417, 21051466, 21051477, 21051758, 21051860, 21051865,
      21051904, 21051935, 21051958, 21051980, 21052235, 21052236, 21052249,
      21052250, 21052281, 21052282, 21052334, 21052391, 21052499, 21052517,
      21052520, 21052634, 21052649, 21052697, 21052792, 21052884, 21052899,
      21052966, 21052991, 21053201, 21053284, 22057008, 22057013, 22057018,
      22057028, 22057077, 2105233, 2105936, 2105992, 2106008, 2106253, 2128023,
      2128100, 2128128, 2129014, 2129139, 21051032, 21051259, 21051467,
      21051482, 21051957, 21052006, 21052059, 21052199, 21052540, 21052568,
      21052621, 21052833, 21052847, 21053032, 21053207, 21053237, 21053251,
      2105025, 2105049, 2105070, 2105080, 2105141, 2105149, 2105154, 2105174,
      2105181, 2105320, 2105333, 2105483, 2105544, 2105549, 2105552, 2105574,
      2105595, 2105603, 2105708, 2105720, 2105767, 2105769, 2105772, 2105785,
      2105840, 2105872, 2105956, 2105970, 2106001, 2106049, 2106122, 2106140,
      2106232, 2106250, 2129088, 2129091, 2129100, 2129112, 2129128, 21051028,
      21051031, 21051046, 21051112, 21051121, 21051143, 21051258, 21051268,
      21051319, 21051330, 21051353, 21051497, 21051515, 21051531, 21051565,
      21051566, 21051592, 21051608, 21051616, 21051669, 21051672, 21051683,
      21051751, 21051782, 21051879, 21051892, 21051921, 21051946, 21051948,
      21051950, 21052008, 21052080, 21052135, 21052224, 21052361, 21052401,
      21052456, 21052462, 21052532, 21052573, 21052576, 21052605, 21052739,
      21052762, 21052778, 21052908, 21052957, 21053212, 21053312, 21053364,
      21053396, 22057085, 2105003, 2105056, 2105107, 2105178, 2105180, 2105213,
      2105273, 2105367, 2105385, 2105494, 2105666, 2105672, 2105695, 2105715,
      2105721, 2105728, 2105739, 2105755, 2105861, 2105910, 2105959, 2106026,
      2106034, 2106088, 2106138, 2106179, 2106208, 2106224, 2106287, 2106290,
      2128003, 2128012, 2128035, 2128038, 2128056, 2128133, 2128134, 2129136,
      2129158, 21051011, 21051039, 21051043, 21051106, 21051107, 21051138,
      21051163, 21051199, 21051374, 21051422, 21051476, 21051503, 21051509,
      21051517, 21051607, 21051633, 21051640, 21051689, 21051723, 21051738,
      21051808, 21051824, 21051856, 21052035, 21052050, 21052070, 21052098,
      21052172, 21052194, 21052195, 21052270, 21052357, 21052444, 21052639,
      21052680, 21052686, 21052930, 21053224, 21053238, 21053252, 21053315,
      21053336, 21053355, 21053365, 21053382, 2105009, 2105027, 2105041,
      2105089, 2105152, 2105164, 2105209, 2105269, 2105316, 2105332, 2105375,
      2105381, 2105410, 2105436, 2105619, 2105648, 2105684, 2105696, 2105701,
      2105735, 2105783, 2105809, 2105907, 2106069, 2106173, 2106176, 2106321,
      2128064, 2128097, 2128106, 2128108, 2128127, 2129141, 21051071, 21051072,
      21051074, 21051079, 21051087, 21051094, 21051095, 21051113, 21051116,
      21051151, 21051251, 21051329, 21051340, 21051416, 21051512, 21051528,
      21051548, 21051559, 21051630, 21051634, 21051722, 21051727, 21051756,
      21051762, 21051771, 21051781, 21051949, 21051974, 21051975, 21051985,
      21051998, 21052015, 21052066, 21052129, 21052234, 21052265, 21052303,
      21052325, 21052358, 21052373, 21052378, 21052404, 21052492, 21052496,
      21052571, 21052647, 21052698, 21052734, 21052737, 21052749, 21052837,
      21052843, 21052964, 21052980, 21053291, 21053334, 21053385, 21053386,
      21053438, 21053454, 22057044, 2105374, 2105408, 2105416, 2105722, 2105851,
      2105854, 2105857, 2105882, 2105982, 2105984, 2105986, 2106053, 2106170,
      2106187, 2106191, 2106289, 2106307, 2106309, 2128059, 2129041, 21051173,
      21051247, 21051483, 21051641, 21051740, 21051791, 21051928, 21051930,
      21051939, 21051940, 21051944, 21052156, 21052308, 21052337, 21052346,
      21052665, 21052746, 21052784, 21052967, 21052985, 21052994, 21053203,
      21053373, 2105631, 21052808, 21051864, 21052402, 21053344, 21053393,
      2105939, 2106104, 2128107, 2129126, 21052045, 22057049, 2128041, 2128045,
      2128069, 21051178,
    ];

    try {
      for (let i = 0; i < users.length; i++) {
        await this.mailService.sendNonRegistered(`${users[i]}@kiit.ac.in`, i);
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    } catch (error) {
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
        'support@kiitconnect.live',
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


  async refralInfo(userId:string){

    try {
      
      const user = await this.prisma.user.findUnique({
        where:{
          id:userId
        },
        select:{
          refrealCode:true,
          refralAmount:true,
          id:true
        }
      });
      if(!user) throw new BadRequestException('User Not Found');

      const totalRefral = await this.prisma.user.findMany({
        where:{
          referredBy:user.id
        },
        select:{
          id:true,
          name:true,
          email:true,
          updatedAt:true
        }
      });



      return {
        user,
        totalRefral
      }
    } catch (error) {
      
    }
  }
}
