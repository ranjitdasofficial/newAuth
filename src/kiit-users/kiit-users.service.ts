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

      const p = await this.storageService.uploadFile(
      filebuffer,mediaId
      );


      if(!p) throw new InternalServerErrorException('Failed to Upload Image');



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
    const users = []
      let isContinueLoop = true;
    try {
      for (let i =0;i<users.length && isContinueLoop;i++) {
        if(!isContinueLoop) break;
        await this.mailService.sendPaymentReminder({
          email: users[i].user.email,
          name: users[i].user.name,
          branch: users[i].branch,
          year: users[i].year,
        });

        const u = await new Promise((resolve) => {
          setTimeout(() => {
            resolve(`send Success ${users[i].user.name} ${users[i].user.email}`);
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
      '21053420',
      "21051086",
      "2205008",
      "2205013",
      "2205014",
      "2205016",
      "2205017",
      "2205018",
      "2205020",
      "2205023",
      "2205024",
      "2205025",
      "2205026",
      "2205027",
      "2205029",
      "2205031",
      "2205032",
      "2205035",
      "2205036",
      "2205037",
      "2205044",
      "2205051",
      "2205053",
      "2205054",
      "2205055",
      "2205059",
      "2205060",
      "2205062",
      "2205064",
      "2205067",
      "2205068",
      "2205069",
      "2205073",
      "2205074",
      "2205076",
      "2205078",
      "2205082",
      "2205084",
      "2205088",
      "2205089",
      "2205091",
      "2205095",
      "2205099",
      "2205100",
      "22051000",
      "22051001",
      "22051004",
      "22051005",
      "22051006",
      "22051009",
      "22051010",
      "22051011",
      "22051012",
      "22051013",
      "22051014",
      "22051015",
      "22051017",
      "22051019",
      "2205102",
      "22051020",
      "22051021",
      "22051022",
      "22051023",
      "22051024",
      "22051028",
      "22051030",
      "22051033",
      "22051034",
      "22051036",
      "22051037",
      "22051038",
      "22051039",
      "22051040",
      "22051042",
      "22051044",
      "22051045",
      "22051048",
      "22051050",
      "22051051",
      "22051054",
      "22051055",
      "22051056",
      "22051057",
      "22051058",
      "22051059",
      "2205106",
      "22051060",
      "22051061",
      "22051062",
      "22051063",
      "22051064",
      "22051066",
      "22051067",
      "22051070",
      "22051071",
      "22051074",
      "22051077",
      "22051078",
      "22051079",
      "22051080",
      "22051082",
      "22051083",
      "22051084",
      "22051086",
      "2205109",
      "22051091",
      "22051092",
      "22051095",
      "22051098",
      "22051100",
      "22051101",
      "22051103",
      "22051106",
      "22051107",
      "22051108",
      "22051109",
      "2205111",
      "22051110",
      "22051111",
      "22051113",
      "22051114",
      "22051115",
      "22051116",
      "22051118",
      "2205112",
      "22051121",
      "22051123",
      "22051127",
      "22051128",
      "2205113",
      "22051130",
      "22051131",
      "22051134",
      "22051138",
      "22051139",
      "2205114",
      "22051140",
      "22051141",
      "22051142",
      "22051143",
      "22051146",
      "22051148",
      "22051149",
      "2205115",
      "22051150",
      "22051152",
      "22051153",
      "22051154",
      "22051155",
      "22051157",
      "22051158",
      "22051159",
      "2205116",
      "22051161",
      "22051163",
      "22051164",
      "22051165",
      "22051168",
      "22051169",
      "2205117",
      "22051170",
      "22051172",
      "22051174",
      "22051175",
      "22051176",
      "22051177",
      "22051178",
      "22051179",
      "22051181",
      "22051182",
      "22051183",
      "22051184",
      "22051186",
      "22051187",
      "22051188",
      "2205119",
      "22051190",
      "22051192",
      "22051193",
      "22051194",
      "22051195",
      "22051196",
      "22051197",
      "22051198",
      "22051199",
      "22051200",
      "22051201",
      "22051203",
      "2205121",
      "22051210",
      "22051212",
      "22051215",
      "22051216",
      "22051217",
      "22051220",
      "22051225",
      "22051230",
      "22051231",
      "22051233",
      "22051235",
      "22051236",
      "22051238",
      "2205124",
      "22051241",
      "22051243",
      "22051246",
      "22051247",
      "22051249",
      "2205125",
      "22051250",
      "22051252",
      "22051253",
      "22051255",
      "22051256",
      "22051257",
      "22051258",
      "22051259",
      "2205126",
      "22051262",
      "22051263",
      "22051265",
      "22051266",
      "22051268",
      "22051269",
      "22051270",
      "22051272",
      "22051273",
      "22051274",
      "22051276",
      "22051279",
      "2205128",
      "22051280",
      "22051284",
      "22051285",
      "22051286",
      "22051287",
      "22051288",
      "22051289",
      "22051291",
      "22051292",
      "22051293",
      "22051294",
      "22051295",
      "22051296",
      "22051297",
      "22051298",
      "22051299",
      "22051300",
      "22051301",
      "22051302",
      "22051303",
      "22051304",
      "22051305",
      "22051306",
      "22051307",
      "22051308",
      "22051309",
      "22051310",
      "22051311",
      "22051313",
      "22051314",
      "22051315",
      "22051316",
      "22051317",
      "22051319",
      "2205132",
      "22051320",
      "22051322",
      "22051323",
      "22051324",
      "22051326",
      "22051327",
      "22051328",
      "22051330",
      "22051331",
      "22051332",
      "22051335",
      "22051337",
      "22051339",
      "22051340",
      "22051341",
      "22051342",
      "22051343",
      "22051346",
      "22051350",
      "22051351",
      "22051354",
      "22051356",
      "22051357",
      "22051358",
      "22051359",
      "22051364",
      "22051367",
      "22051368",
      "22051369",
      "22051370",
      "22051371",
      "22051372",
      "22051373",
      "22051374",
      "22051375",
      "22051378",
      "22051379",
      "2205138",
      "22051380",
      "22051383",
      "22051384",
      "22051385",
      "22051387",
      "2205139",
      "22051392",
      "22051394",
      "22051396",
      "22051397",
      "22051399",
      "22051400",
      "22051401",
      "22051402",
      "22051403",
      "22051404",
      "22051405",
      "22051406",
      "22051407",
      "22051409",
      "22051410",
      "22051414",
      "2205142",
      "22051420",
      "22051422",
      "22051428",
      "22051429",
      "2205143",
      "22051431",
      "22051437",
      "2205144",
      "22051441",
      "22051442",
      "22051443",
      "22051445",
      "22051446",
      "22051451",
      "22051453",
      "22051454",
      "22051455",
      "22051458",
      "22051459",
      "2205146",
      "22051462",
      "22051464",
      "22051465",
      "22051466",
      "22051473",
      "22051474",
      "22051475",
      "22051476",
      "22051477",
      "22051481",
      "22051484",
      "22051486",
      "22051487",
      "2205149",
      "22051493",
      "22051494",
      "22051496",
      "22051497",
      "22051498",
      "2205150",
      "22051501",
      "22051502",
      "22051505",
      "22051506",
      "22051507",
      "22051508",
      "2205151",
      "22051510",
      "22051511",
      "22051513",
      "22051514",
      "22051516",
      "22051518",
      "22051519",
      "2205152",
      "22051520",
      "22051521",
      "22051523",
      "22051524",
      "22051527",
      "22051531",
      "22051533",
      "22051535",
      "22051537",
      "22051538",
      "2205154",
      "22051540",
      "22051542",
      "22051545",
      "22051546",
      "22051548",
      "22051551",
      "22051552",
      "22051553",
      "22051555",
      "22051556",
      "22051560",
      "22051561",
      "22051563",
      "22051564",
      "22051565",
      "22051566",
      "22051567",
      "22051569",
      "2205157",
      "22051570",
      "22051571",
      "22051572",
      "22051573",
      "22051575",
      "22051576",
      "22051578",
      "22051579",
      "2205158",
      "22051580",
      "22051582",
      "22051583",
      "22051586",
      "22051587",
      "2205159",
      "22051590",
      "22051594",
      "22051595",
      "22051596",
      "22051598",
      "22051599",
      "2205160",
      "22051602",
      "22051603",
      "22051604",
      "22051605",
      "22051607",
      "22051609",
      "22051610",
      "22051611",
      "22051612",
      "22051613",
      "22051614",
      "22051616",
      "22051618",
      "22051619",
      "22051620",
      "22051622",
      "22051623",
      "22051625",
      "22051629",
      "2205163",
      "22051631",
      "22051632",
      "22051633",
      "22051634",
      "22051636",
      "22051640",
      "22051643",
      "22051646",
      "22051648",
      "22051649",
      "22051650",
      "22051652",
      "22051653",
      "22051654",
      "22051655",
      "22051656",
      "22051657",
      "22051662",
      "22051664",
      "22051666",
      "22051667",
      "22051668",
      "22051669",
      "2205167",
      "22051671",
      "22051675",
      "22051676",
      "22051677",
      "22051678",
      "22051679",
      "2205168",
      "22051680",
      "22051682",
      "22051684",
      "22051687",
      "22051688",
      "2205169",
      "22051691",
      "22051692",
      "22051696",
      "22051698",
      "2205170",
      "22051701",
      "22051704",
      "22051708",
      "22051711",
      "22051712",
      "22051713",
      "22051715",
      "2205172",
      "22051720",
      "22051721",
      "22051722",
      "22051723",
      "22051725",
      "22051726",
      "22051728",
      "22051729",
      "22051732",
      "22051733",
      "22051734",
      "22051735",
      "22051737",
      "22051739",
      "22051746",
      "22051747",
      "22051748",
      "22051750",
      "22051751",
      "22051752",
      "22051753",
      "22051756",
      "22051757",
      "22051759",
      "22051763",
      "22051765",
      "22051766",
      "22051767",
      "2205177",
      "22051770",
      "22051771",
      "22051775",
      "22051776",
      "22051778",
      "22051779",
      "22051780",
      "22051781",
      "22051782",
      "22051783",
      "22051785",
      "22051786",
      "22051787",
      "22051789",
      "2205179",
      "22051791",
      "22051793",
      "22051795",
      "22051796",
      "22051797",
      "22051798",
      "22051799",
      "22051800",
      "22051801",
      "22051802",
      "22051803",
      "22051805",
      "22051806",
      "22051808",
      "22051809",
      "22051811",
      "22051812",
      "22051816",
      "22051818",
      "22051819",
      "22051826",
      "22051827",
      "22051828",
      "22051829",
      "22051832",
      "22051833",
      "22051834",
      "22051835",
      "22051836",
      "22051837",
      "22051840",
      "22051841",
      "22051845",
      "22051846",
      "22051849",
      "2205185",
      "22051852",
      "22051853",
      "22051854",
      "22051858",
      "22051859",
      "2205186",
      "22051860",
      "22051861",
      "22051865",
      "22051866",
      "22051867",
      "22051869",
      "22051870",
      "22051872",
      "22051874",
      "22051875",
      "22051876",
      "22051879",
      "22051882",
      "22051883",
      "22051884",
      "22051885",
      "22051888",
      "22051889",
      "2205189",
      "22051890",
      "22051892",
      "22051893",
      "22051894",
      "22051897",
      "22051899",
      "2205190",
      "22051901",
      "22051902",
      "22051903",
      "22051904",
      "22051905",
      "22051906",
      "22051908",
      "22051909",
      "2205191",
      "22051911",
      "22051912",
      "22051915",
      "22051917",
      "22051922",
      "22051923",
      "22051924",
      "22051926",
      "22051927",
      "22051928",
      "22051929",
      "22051931",
      "22051932",
      "22051933",
      "22051937",
      "22051939",
      "2205194",
      "22051940",
      "22051941",
      "22051943",
      "22051947",
      "2205195",
      "22051951",
      "22051955",
      "22051957",
      "22051958",
      "22051959",
      "2205196",
      "22051964",
      "22051967",
      "22051969",
      "22051970",
      "22051971",
      "22051972",
      "22051973",
      "22051974",
      "22051975",
      "22051976",
      "22051977",
      "22051978",
      "2205198",
      "22051980",
      "22051981",
      "22051982",
      "22051983",
      "22051984",
      "22051985",
      "22051986",
      "22051987",
      "22051988",
      "22051989",
      "2205199",
      "22051991",
      "22051992",
      "22051994",
      "22051995",
      "22051997",
      "22051998",
      "2205200",
      "22052001",
      "22052002",
      "22052003",
      "22052004",
      "22052005",
      "22052006",
      "22052007",
      "22052008",
      "22052009",
      "2205201",
      "22052010",
      "22052011",
      "22052012",
      "22052013",
      "22052014",
      "22052017",
      "22052018",
      "22052019",
      "2205202",
      "22052021",
      "22052022",
      "22052023",
      "22052024",
      "22052026",
      "22052027",
      "2205203",
      "22052031",
      "22052032",
      "22052034",
      "22052037",
      "22052038",
      "22052039",
      "2205204",
      "22052040",
      "22052041",
      "22052045",
      "22052047",
      "22052049",
      "2205205",
      "22052050",
      "22052052",
      "22052054",
      "22052057",
      "22052059",
      "2205206",
      "22052061",
      "22052062",
      "22052063",
      "22052064",
      "22052067",
      "22052068",
      "22052069",
      "2205207",
      "22052073",
      "22052074",
      "22052076",
      "22052079",
      "22052081",
      "22052083",
      "22052084",
      "22052087",
      "22052088",
      "22052089",
      "2205209",
      "22052090",
      "22052092",
      "22052093",
      "22052094",
      "22052095",
      "22052096",
      "22052097",
      "22052098",
      "2205210",
      "22052100",
      "22052102",
      "22052103",
      "22052104",
      "22052105",
      "22052106",
      "22052108",
      "22052109",
      "22052110",
      "22052113",
      "22052116",
      "2205212",
      "22052125",
      "22052126",
      "22052129",
      "2205213",
      "22052130",
      "22052136",
      "22052137",
      "22052140",
      "22052146",
      "22052148",
      "22052149",
      "2205215",
      "22052152",
      "22052154",
      "22052156",
      "22052158",
      "22052159",
      "2205216",
      "22052160",
      "22052161",
      "22052162",
      "22052163",
      "22052166",
      "22052167",
      "22052173",
      "22052174",
      "22052175",
      "22052178",
      "22052179",
      "22052180",
      "22052181",
      "22052182",
      "22052183",
      "22052185",
      "22052194",
      "22052195",
      "22052197",
      "22052199",
      "22052200",
      "22052201",
      "22052204",
      "22052205",
      "22052207",
      "22052208",
      "2205221",
      "22052210",
      "22052213",
      "22052215",
      "22052216",
      "22052217",
      "22052218",
      "2205222",
      "22052220",
      "22052222",
      "22052223",
      "22052225",
      "22052227",
      "22052229",
      "2205223",
      "22052231",
      "22052233",
      "22052234",
      "22052235",
      "22052236",
      "22052237",
      "22052238",
      "2205224",
      "22052240",
      "22052241",
      "22052242",
      "22052243",
      "22052248",
      "22052249",
      "22052252",
      "2205226",
      "22052260",
      "22052261",
      "22052265",
      "22052266",
      "22052267",
      "22052268",
      "2205227",
      "22052270",
      "22052271",
      "22052272",
      "22052273",
      "22052274",
      "22052275",
      "22052276",
      "22052277",
      "22052278",
      "2205228",
      "22052280",
      "22052282",
      "22052283",
      "22052285",
      "22052287",
      "22052288",
      "22052289",
      "2205229",
      "22052292",
      "22052295",
      "22052296",
      "22052297",
      "22052298",
      "22052299",
      "2205230",
      "22052301",
      "22052302",
      "22052303",
      "22052305",
      "22052307",
      "22052308",
      "22052312",
      "22052314",
      "22052315",
      "22052320",
      "22052322",
      "22052323",
      "22052324",
      "22052325",
      "22052329",
      "22052331",
      "22052332",
      "22052334",
      "22052336",
      "22052338",
      "2205234",
      "22052340",
      "22052341",
      "22052342",
      "22052343",
      "22052347",
      "22052348",
      "2205235",
      "22052350",
      "22052351",
      "22052352",
      "22052355",
      "22052356",
      "22052358",
      "22052359",
      "2205236",
      "22052361",
      "22052364",
      "22052366",
      "22052367",
      "2205237",
      "22052370",
      "22052375",
      "22052376",
      "22052377",
      "22052382",
      "22052384",
      "22052385",
      "22052386",
      "22052387",
      "22052388",
      "22052389",
      "2205239",
      "22052390",
      "22052391",
      "22052395",
      "22052396",
      "22052397",
      "22052398",
      "22052402",
      "22052403",
      "22052404",
      "22052405",
      "22052406",
      "22052407",
      "22052409",
      "2205241",
      "22052411",
      "22052412",
      "22052414",
      "22052416",
      "22052417",
      "2205242",
      "22052420",
      "22052421",
      "22052422",
      "22052423",
      "22052424",
      "22052425",
      "22052427",
      "22052428",
      "2205243",
      "22052430",
      "22052431",
      "22052432",
      "22052433",
      "22052434",
      "22052436",
      "22052439",
      "2205244",
      "22052440",
      "22052443",
      "22052444",
      "22052445",
      "22052446",
      "22052447",
      "22052450",
      "22052451",
      "2205246",
      "22052460",
      "22052461",
      "22052463",
      "22052464",
      "22052466",
      "22052467",
      "22052469",
      "2205247",
      "2205247",
      "22052470",
      "22052473",
      "22052474",
      "22052475",
      "22052476",
      "22052479",
      "22052485",
      "22052489",
      "22052490",
      "22052491",
      "22052495",
      "22052496",
      "22052497",
      "22052498",
      "22052502",
      "22052503",
      "22052505",
      "22052506",
      "22052508",
      "22052509",
      "22052511",
      "22052512",
      "22052517",
      "2205252",
      "22052523",
      "22052524",
      "22052527",
      "22052528",
      "22052530",
      "22052534",
      "22052535",
      "22052536",
      "22052537",
      "22052538",
      "22052539",
      "22052540",
      "22052542",
      "22052545",
      "22052548",
      "22052549",
      "22052552",
      "22052554",
      "22052556",
      "22052557",
      "2205256",
      "22052562",
      "22052564",
      "22052565",
      "22052572",
      "22052577",
      "22052579",
      "2205258",
      "22052580",
      "22052582",
      "22052583",
      "22052588",
      "22052590",
      "22052595",
      "22052599",
      "2205260",
      "22052600",
      "22052602",
      "22052603",
      "22052605",
      "22052606",
      "22052607",
      "22052608",
      "22052609",
      "2205261",
      "22052612",
      "22052613",
      "22052617",
      "2205262",
      "22052621",
      "22052622",
      "22052623",
      "22052625",
      "22052626",
      "22052629",
      "2205263",
      "22052630",
      "22052631",
      "22052636",
      "22052639",
      "22052640",
      "22052642",
      "22052644",
      "22052646",
      "22052647",
      "22052648",
      "22052651",
      "22052652",
      "22052653",
      "22052654",
      "22052657",
      "22052659",
      "2205266",
      "22052661",
      "22052663",
      "22052664",
      "22052668",
      "22052669",
      "22052670",
      "22052672",
      "22052673",
      "22052674",
      "22052675",
      "22052677",
      "22052678",
      "22052679",
      "22052683",
      "22052686",
      "22052687",
      "22052688",
      "22052689",
      "2205269",
      "22052691",
      "22052693",
      "22052694",
      "22052695",
      "22052696",
      "22052698",
      "22052699",
      "2205270",
      "22052701",
      "22052702",
      "22052705",
      "22052706",
      "22052709",
      "2205271",
      "22052711",
      "22052712",
      "22052716",
      "22052718",
      "22052720",
      "22052721",
      "22052722",
      "22052723",
      "22052724",
      "22052725",
      "22052726",
      "22052727",
      "22052728",
      "22052729",
      "2205273",
      "22052731",
      "22052733",
      "22052738",
      "22052739",
      "22052740",
      "22052742",
      "22052744",
      "22052745",
      "22052746",
      "22052747",
      "22052748",
      "2205275",
      "22052750",
      "22052751",
      "22052752",
      "22052754",
      "22052757",
      "2205276",
      "22052760",
      "22052761",
      "22052763",
      "22052764",
      "22052765",
      "22052767",
      "22052768",
      "22052771",
      "22052772",
      "22052773",
      "22052775",
      "22052779",
      "2205278",
      "22052780",
      "22052788",
      "22052794",
      "22052795",
      "22052796",
      "22052799",
      "22052800",
      "22052801",
      "22052802",
      "22052803",
      "22052808",
      "2205281",
      "22052812",
      "22052813",
      "22052815",
      "22052816",
      "22052817",
      "2205282",
      "22052820",
      "22052823",
      "22052824",
      "22052825",
      "22052826",
      "2205283",
      "22052830",
      "22052833",
      "22052837",
      "22052839",
      "22052842",
      "22052845",
      "2205285",
      "22052850",
      "22052851",
      "22052852",
      "22052854",
      "22052855",
      "22052856",
      "22052857",
      "22052858",
      "22052860",
      "22052862",
      "22052864",
      "22052866",
      "22052867",
      "22052869",
      "22052870",
      "22052871",
      "22052874",
      "22052875",
      "22052876",
      "22052877",
      "22052879",
      "22052880",
      "22052881",
      "22052883",
      "22052885",
      "22052886",
      "22052887",
      "22052888",
      "22052889",
      "2205289",
      "22052892",
      "22052897",
      "22052899",
      "2205290",
      "22052902",
      "22052906",
      "22052908",
      "22052909",
      "22052911",
      "22052912",
      "22052913",
      "22052915",
      "22052916",
      "22052919",
      "2205292",
      "22052921",
      "22052922",
      "22052923",
      "22052925",
      "22052926",
      "22052927",
      "22052928",
      "22052932",
      "22052933",
      "22052934",
      "22052935",
      "22052936",
      "22052937",
      "22052938",
      "2205294",
      "22052942",
      "22052944",
      "22052945",
      "22052946",
      "22052947",
      "22052948",
      "22052949",
      "2205295",
      "22052951",
      "22052952",
      "22052955",
      "22052956",
      "22052958",
      "22052959",
      "22052960",
      "22052961",
      "22052963",
      "22052964",
      "22052965",
      "22052966",
      "22052968",
      "22052969",
      "22052971",
      "22052975",
      "22052976",
      "22052979",
      "2205298",
      "22052981",
      "22052982",
      "22052983",
      "22052984",
      "22052986",
      "22052987",
      "2205299",
      "22052990",
      "22052993",
      "22052994",
      "22052996",
      "22052997",
      "2205300",
      "22053001",
      "22053003",
      "22053006",
      "22053009",
      "22053011",
      "22053013",
      "22053014",
      "22053015",
      "22053016",
      "22053017",
      "22053018",
      "22053019",
      "2205302",
      "22053020",
      "22053023",
      "22053024",
      "22053025",
      "22053027",
      "22053028",
      "2205303",
      "22053030",
      "22053032",
      "22053033",
      "22053034",
      "22053035",
      "22053036",
      "22053037",
      "22053038",
      "2205304",
      "22053040",
      "22053041",
      "22053042",
      "22053044",
      "22053045",
      "22053046",
      "22053047",
      "22053049",
      "22053051",
      "22053052",
      "22053053",
      "22053055",
      "22053059",
      "22053061",
      "22053067",
      "2205307",
      "22053070",
      "22053071",
      "22053072",
      "22053073",
      "22053077",
      "2205308",
      "22053081",
      "22053083",
      "22053086",
      "22053089",
      "2205309",
      "22053090",
      "22053091",
      "22053092",
      "22053093",
      "22053094",
      "22053095",
      "22053096",
      "22053097",
      "22053098",
      "22053099",
      "2205310",
      "22053100",
      "22053101",
      "22053102",
      "22053104",
      "22053105",
      "22053106",
      "22053109",
      "22053110",
      "22053111",
      "22053112",
      "22053115",
      "22053118",
      "2205312",
      "22053120",
      "22053123",
      "22053124",
      "22053125",
      "22053129",
      "2205313",
      "22053130",
      "22053131",
      "22053133",
      "22053136",
      "22053139",
      "2205314",
      "22053140",
      "22053141",
      "22053146",
      "22053150",
      "22053152",
      "22053153",
      "22053154",
      "22053156",
      "22053158",
      "22053159",
      "22053160",
      "22053161",
      "22053162",
      "22053164",
      "22053165",
      "22053169",
      "2205317",
      "22053170",
      "22053171",
      "22053175",
      "22053176",
      "22053177",
      "2205318",
      "22053181",
      "22053183",
      "22053186",
      "22053187",
      "22053188",
      "2205319",
      "22053190",
      "22053191",
      "22053193",
      "22053195",
      "22053196",
      "22053198",
      "22053199",
      "2205320",
      "22053202",
      "22053203",
      "22053204",
      "22053205",
      "22053206",
      "22053207",
      "22053209",
      "2205321",
      "22053210",
      "22053211",
      "22053216",
      "22053218",
      "2205322",
      "22053222",
      "22053223",
      "22053226",
      "22053228",
      "2205323",
      "22053230",
      "22053231",
      "22053232",
      "22053233",
      "22053234",
      "22053235",
      "22053236",
      "22053238",
      "22053239",
      "2205324",
      "22053240",
      "22053241",
      "22053242",
      "22053244",
      "22053245",
      "22053246",
      "22053247",
      "22053248",
      "22053249",
      "22053250",
      "22053251",
      "22053252",
      "22053253",
      "22053255",
      "22053257",
      "22053259",
      "2205326",
      "22053260",
      "22053261",
      "22053262",
      "22053263",
      "22053265",
      "22053267",
      "22053269",
      "2205327",
      "22053272",
      "22053273",
      "22053275",
      "22053276",
      "22053278",
      "22053279",
      "2205328",
      "22053280",
      "22053283",
      "22053284",
      "22053286",
      "22053287",
      "22053289",
      "22053292",
      "22053293",
      "22053294",
      "22053295",
      "22053296",
      "22053297",
      "22053298",
      "22053299",
      "2205330",
      "22053304",
      "22053305",
      "22053307",
      "22053308",
      "22053309",
      "2205331",
      "22053311",
      "22053312",
      "22053313",
      "22053314",
      "22053315",
      "22053316",
      "22053317",
      "22053319",
      "2205332",
      "22053321",
      "22053323",
      "22053326",
      "22053328",
      "22053332",
      "22053334",
      "22053335",
      "22053336",
      "22053337",
      "22053338",
      "22053343",
      "22053344",
      "22053348",
      "2205335",
      "22053350",
      "22053352",
      "22053353",
      "22053354",
      "22053355",
      "22053356",
      "22053358",
      "22053359",
      "2205336",
      "22053360",
      "22053363",
      "22053364",
      "22053365",
      "22053366",
      "22053368",
      "22053369",
      "2205337",
      "22053370",
      "22053372",
      "22053374",
      "22053376",
      "22053378",
      "22053379",
      "22053381",
      "22053382",
      "22053388",
      "22053391",
      "22053395",
      "22053396",
      "22053398",
      "22053399",
      "22053400",
      "22053401",
      "22053402",
      "22053405",
      "22053406",
      "22053408",
      "2205341",
      "22053410",
      "22053411",
      "22053414",
      "22053416",
      "22053417",
      "22053418",
      "2205342",
      "22053422",
      "22053423",
      "22053424",
      "22053425",
      "22053428",
      "22053429",
      "22053431",
      "22053432",
      "22053433",
      "22053434",
      "22053439",
      "22053441",
      "22053443",
      "22053444",
      "22053445",
      "22053447",
      "2205345",
      "22053450",
      "22053451",
      "22053452",
      "22053454",
      "22053458",
      "22053459",
      "22053460",
      "22053461",
      "22053462",
      "22053463",
      "22053464",
      "22053465",
      "22053466",
      "22053467",
      "22053468",
      "22053469",
      "2205347",
      "22053471",
      "22053475",
      "22053477",
      "22053478",
      "22053479",
      "2205348",
      "22053480",
      "22053482",
      "22053484",
      "22053485",
      "22053486",
      "22053488",
      "22053491",
      "22053494",
      "22053496",
      "22053497",
      "22053498",
      "22053499",
      "22053500",
      "22053501",
      "22053502",
      "22053503",
      "22053504",
      "22053505",
      "22053508",
      "22053510",
      "22053512",
      "22053513",
      "22053514",
      "22053515",
      "22053516",
      "22053519",
      "2205352",
      "22053522",
      "22053526",
      "22053528",
      "22053529",
      "2205353",
      "22053530",
      "22053531",
      "22053532",
      "22053534",
      "22053536",
      "22053539",
      "22053540",
      "22053541",
      "22053547",
      "2205355",
      "22053550",
      "22053555",
      "22053556",
      "22053564",
      "22053566",
      "22053567",
      "22053569",
      "22053570",
      "22053571",
      "22053572",
      "22053573",
      "22053577",
      "22053578",
      "2205358",
      "22053580",
      "22053581",
      "22053582",
      "22053583",
      "22053585",
      "22053587",
      "22053588",
      "22053589",
      "22053591",
      "22053592",
      "22053593",
      "22053596",
      "22053599",
      "2205360",
      "22053602",
      "22053603",
      "22053606",
      "22053607",
      "22053613",
      "22053615",
      "22053616",
      "22053618",
      "22053619",
      "2205362",
      "22053621",
      "22053622",
      "22053623",
      "22053624",
      "22053629",
      "2205363",
      "22053630",
      "22053631",
      "22053633",
      "22053635",
      "22053637",
      "22053638",
      "22053639",
      "2205364",
      "22053640",
      "2205365",
      "22053650",
      "22053654",
      "22053655",
      "22053659",
      "2205366",
      "22053662",
      "22053663",
      "22053664",
      "22053667",
      "22053668",
      "2205367",
      "22053672",
      "22053673",
      "22053674",
      "22053675",
      "22053676",
      "22053677",
      "22053679",
      "22053680",
      "22053682",
      "22053684",
      "22053685",
      "22053686",
      "22053687",
      "22053688",
      "22053690",
      "22053691",
      "22053692",
      "22053693",
      "22053694",
      "22053696",
      "22053699",
      "22053700",
      "22053702",
      "22053703",
      "22053704",
      "22053706",
      "22053709",
      "2205371",
      "22053711",
      "22053712",
      "22053713",
      "22053714",
      "22053717",
      "22053719",
      "2205372",
      "22053720",
      "22053722",
      "22053724",
      "22053726",
      "22053727",
      "22053728",
      "22053729",
      "22053731",
      "22053733",
      "22053734",
      "22053735",
      "22053737",
      "22053740",
      "22053742",
      "22053744",
      "22053745",
      "22053747",
      "2205375",
      "22053751",
      "22053752",
      "22053754",
      "22053755",
      "22053756",
      "22053757",
      "22053758",
      "22053759",
      "2205376",
      "22053760",
      "22053762",
      "22053763",
      "22053764",
      "22053766",
      "22053768",
      "2205377",
      "22053770",
      "22053772",
      "22053774",
      "22053776",
      "22053778",
      "2205378",
      "22053781",
      "22053783",
      "22053784",
      "22053787",
      "22053788",
      "22053789",
      "2205379",
      "22053791",
      "22053793",
      "22053794",
      "22053797",
      "2205380",
      "22053800",
      "22053805",
      "22053806",
      "22053807",
      "22053808",
      "22053810",
      "22053811",
      "22053813",
      "22053815",
      "22053816",
      "22053817",
      "2205382",
      "22053820",
      "22053821",
      "22053822",
      "22053826",
      "22053827",
      "22053828",
      "22053829",
      "22053830",
      "22053831",
      "22053832",
      "22053834",
      "22053835",
      "22053836",
      "22053839",
      "22053840",
      "22053842",
      "22053843",
      "22053844",
      "22053846",
      "22053848",
      "22053849",
      "22053850",
      "22053852",
      "22053856",
      "22053857",
      "22053858",
      "22053859",
      "22053860",
      "22053861",
      "22053864",
      "22053865",
      "22053866",
      "22053867",
      "22053868",
      "22053871",
      "22053875",
      "22053876",
      "22053878",
      "22053879",
      "2205388",
      "22053881",
      "22053883",
      "22053884",
      "22053885",
      "22053887",
      "22053888",
      "22053889",
      "2205389",
      "22053890",
      "22053892",
      "22053893",
      "22053895",
      "22053897",
      "22053898",
      "22053899",
      "22053902",
      "22053904",
      "22053905",
      "22053907",
      "22053908",
      "22053909",
      "2205391",
      "22053910",
      "22053911",
      "22053913",
      "22053915",
      "22053916",
      "22053918",
      "22053919",
      "2205392",
      "22053921",
      "22053922",
      "22053924",
      "22053925",
      "22053927",
      "2205393",
      "22053931",
      "22053934",
      "22053935",
      "22053937",
      "22053938",
      "22053939",
      "2205394",
      "22053942",
      "22053945",
      "22053946",
      "22053952",
      "22053953",
      "22053954",
      "22053956",
      "22053957",
      "22053958",
      "22053960",
      "22053961",
      "22053962",
      "22053963",
      "22053965",
      "22053966",
      "22053967",
      "2205397",
      "22053970",
      "22053971",
      "22053972",
      "22053973",
      "22053976",
      "22053977",
      "22053978",
      "22053979",
      "22053980",
      "22053981",
      "22053982",
      "22053985",
      "22053986",
      "22053987",
      "22053988",
      "22053989",
      "22053992",
      "22053995",
      "22053997",
      "22053999",
      "22054000",
      "22054007",
      "22054008",
      "22054009",
      "2205401",
      "22054012",
      "22054013",
      "22054014",
      "22054016",
      "2205402",
      "22054022",
      "22054023",
      "2205403",
      "22054034",
      "22054036",
      "22054037",
      "22054040",
      "22054042",
      "22054045",
      "22054046",
      "22054049",
      "2205405",
      "22054052",
      "22054053",
      "22054054",
      "22054056",
      "22054057",
      "2205406",
      "22054062",
      "22054064",
      "22054066",
      "2205407",
      "22054071",
      "22054073",
      "22054074",
      "22054075",
      "22054081",
      "22054083",
      "22054084",
      "22054089",
      "2205409",
      "22054091",
      "22054094",
      "22054095",
      "2205410",
      "22054100",
      "22054103",
      "22054106",
      "22054109",
      "2205411",
      "22054110",
      "22054113",
      "22054114",
      "22054117",
      "22054118",
      "22054119",
      "22054121",
      "22054122",
      "22054123",
      "22054125",
      "22054127",
      "22054128",
      "2205413",
      "22054130",
      "22054131",
      "22054132",
      "22054133",
      "22054134",
      "22054135",
      "22054137",
      "22054139",
      "22054141",
      "22054142",
      "22054143",
      "22054145",
      "22054146",
      "22054147",
      "22054156",
      "22054159",
      "2205416",
      "22054160",
      "22054162",
      "22054164",
      "22054165",
      "22054166",
      "22054167",
      "22054168",
      "22054169",
      "22054170",
      "22054172",
      "22054174",
      "22054181",
      "22054183",
      "22054186",
      "22054187",
      "22054188",
      "22054189",
      "2205419",
      "22054191",
      "22054192",
      "22054194",
      "22054197",
      "22054198",
      "22054200",
      "22054202",
      "22054210",
      "22054211",
      "22054213",
      "22054214",
      "22054215",
      "22054216",
      "22054217",
      "22054219",
      "22054220",
      "22054222",
      "22054224",
      "22054225",
      "22054228",
      "22054229",
      "2205423",
      "22054235",
      "22054236",
      "22054237",
      "22054239",
      "22054242",
      "22054245",
      "22054248",
      "22054250",
      "22054251",
      "22054254",
      "22054256",
      "22054261",
      "22054262",
      "22054263",
      "22054264",
      "22054266",
      "22054267",
      "22054269",
      "2205427",
      "22054270",
      "22054276",
      "22054277",
      "22054278",
      "22054279",
      "2205428",
      "22054281",
      "22054284",
      "22054285",
      "22054288",
      "22054289",
      "2205429",
      "22054291",
      "22054292",
      "2205430",
      "22054300",
      "22054301",
      "22054302",
      "22054303",
      "22054304",
      "22054305",
      "22054308",
      "2205431",
      "22054311",
      "22054314",
      "22054316",
      "2205432",
      "22054320",
      "22054322",
      "22054323",
      "22054324",
      "22054327",
      "2205433",
      "22054330",
      "22054332",
      "22054335",
      "22054337",
      "22054339",
      "22054340",
      "22054341",
      "22054342",
      "22054344",
      "22054345",
      "22054350",
      "22054352",
      "22054353",
      "22054355",
      "22054357",
      "22054358",
      "2205436",
      "22054360",
      "22054361",
      "22054363",
      "22054368",
      "22054369",
      "22054371",
      "22054372",
      "22054373",
      "22054376",
      "22054377",
      "22054380",
      "22054381",
      "22054383",
      "22054385",
      "22054386",
      "22054388",
      "22054389",
      "2205439",
      "22054395",
      "22054396",
      "22054397",
      "2205440",
      "22054400",
      "22054405",
      "22054407",
      "22054408",
      "22054410",
      "22054411",
      "22054412",
      "22054414",
      "22054415",
      "22054417",
      "22054418",
      "22054419",
      "2205442",
      "22054422",
      "22054425",
      "22054426",
      "2205443",
      "22054430",
      "22054432",
      "22054433",
      "22054434",
      "22054435",
      "22054437",
      "22054438",
      "22054439",
      "22054440",
      "22054442",
      "22054443",
      "22054445",
      "22054447",
      "22054449",
      "2205445",
      "22054450",
      "22054453",
      "22054455",
      "22054459",
      "22054460",
      "22054461",
      "22054462",
      "22054467",
      "22054468",
      "22054469",
      "2205447",
      "2205451",
      "2205453",
      "2205454",
      "2205456",
      "2205458",
      "2205459",
      "2205462",
      "2205464",
      "2205465",
      "2205467",
      "2205469",
      "2205472",
      "2205474",
      "2205476",
      "2205485",
      "2205486",
      "2205488",
      "2205489",
      "2205492",
      "2205493",
      "2205494",
      "2205495",
      "2205498",
      "2205499",
      "2205500",
      "2205502",
      "2205503",
      "2205509",
      "2205511",
      "2205512",
      "2205515",
      "2205516",
      "2205517",
      "2205518",
      "2205519",
      "2205520",
      "2205528",
      "2205529",
      "2205535",
      "2205537",
      "2205538",
      "2205540",
      "2205544",
      "2205548",
      "2205550",
      "2205553",
      "2205555",
      "2205556",
      "2205557",
      "2205561",
      "2205564",
      "2205565",
      "2205567",
      "2205569",
      "2205571",
      "2205575",
      "2205576",
      "2205577",
      "2205578",
      "2205580",
      "2205584",
      "2205586",
      "2205587",
      "2205589",
      "2205590",
      "2205592",
      "2205595",
      "2205596",
      "2205600",
      "2205601",
      "2205602",
      "2205604",
      "2205606",
      "2205607",
      "2205609",
      "2205610",
      "2205614",
      "2205616",
      "2205619",
      "2205621",
      "2205623",
      "2205624",
      "2205627",
      "2205628",
      "2205629",
      "2205630",
      "2205631",
      "2205636",
      "2205639",
      "2205641",
      "2205649",
      "2205651",
      "2205652",
      "2205653",
      "2205655",
      "2205658",
      "2205660",
      "2205661",
      "2205662",
      "2205663",
      "2205665",
      "2205666",
      "2205667",
      "2205668",
      "2205669",
      "2205670",
      "2205673",
      "2205674",
      "2205675",
      "2205676",
      "2205679",
      "2205680",
      "2205682",
      "2205683",
      "2205684",
      "2205687",
      "2205688",
      "2205689",
      "2205690",
      "2205691",
      "2205693",
      "2205694",
      "2205696",
      "2205698",
      "2205699",
      "2205701",
      "2205703",
      "2205704",
      "2205706",
      "2205707",
      "2205708",
      "2205709",
      "2205712",
      "2205714",
      "2205715",
      "2205723",
      "2205725",
      "2205729",
      "2205730",
      "2205731",
      "2205732",
      "2205735",
      "2205736",
      "2205737",
      "2205739",
      "2205740",
      "2205742",
      "2205743",
      "2205744",
      "2205746",
      "2205747",
      "2205748",
      "2205749",
      "2205750",
      "2205753",
      "2205754",
      "2205758",
      "2205762",
      "2205766",
      "2205767",
      "2205769",
      "2205772",
      "2205776",
      "2205777",
      "2205778",
      "2205779",
      "2205780",
      "2205786",
      "2205787",
      "2205789",
      "2205790",
      "2205791",
      "2205792",
      "2205793",
      "2205795",
      "2205796",
      "2205797",
      "2205798",
      "2205800",
      "2205801",
      "2205802",
      "2205804",
      "2205805",
      "2205807",
      "2205808",
      "2205809",
      "2205811",
      "2205812",
      "2205813",
      "2205815",
      "2205819",
      "2205820",
      "2205824",
      "2205825",
      "2205826",
      "2205828",
      "2205829",
      "2205831",
      "2205832",
      "2205834",
      "2205835",
      "2205837",
      "2205840",
      "2205841",
      "2205843",
      "2205847",
      "2205848",
      "2205850",
      "2205851",
      "2205852",
      "2205853",
      "2205854",
      "2205855",
      "2205856",
      "2205857",
      "2205859",
      "2205861",
      "2205862",
      "2205866",
      "2205867",
      "2205868",
      "2205869",
      "2205871",
      "2205872",
      "2205873",
      "2205874",
      "2205875",
      "2205877",
      "2205878",
      "2205880",
      "2205882",
      "2205883",
      "2205884",
      "2205885",
      "2205887",
      "2205888",
      "2205889",
      "2205890",
      "2205896",
      "2205897",
      "2205898",
      "2205900",
      "2205902",
      "2205903",
      "2205904",
      "2205906",
      "2205907",
      "2205909",
      "2205911",
      "2205912",
      "2205914",
      "2205915",
      "2205916",
      "2205917",
      "2205918",
      "2205919",
      "2205920",
      "2205929",
      "2205930",
      "2205931",
      "2205932",
      "2205934",
      "2205937",
      "2205938",
      "2205939",
      "2205942",
      "2205944",
      "2205945",
      "2205947",
      "2205948",
      "2205951",
      "2205952",
      "2205955",
      "2205956",
      "2205957",
      "2205958",
      "2205959",
      "2205961",
      "2205962",
      "2205964",
      "2205965",
      "2205966",
      "2205967",
      "2205968",
      "2205969",
      "2205970",
      "2205971",
      "2205972",
      "2205973",
      "2205974",
      "2205981",
      "2205983",
      "2205984",
      "2205985",
      "2205986",
      "2205988",
      "2205989",
      "2205991",
      "2205992",
      "2205995",
      "2205997",
      "2205998",
      "2206003",
      "2206005",
      "2206007",
      "2206008",
      "2206009",
      "2206011",
      "2206013",
      "2206015",
      "2206016",
      "2206018",
      "2206020",
      "2206025",
      "2206028",
      "2206029",
      "2206031",
      "2206033",
      "2206034",
      "2206035",
      "2206036",
      "2206043",
      "2206044",
      "2206050",
      "2206051",
      "2206052",
      "2206053",
      "2206060",
      "2206064",
      "2206066",
      "2206070",
      "2206071",
      "2206072",
      "2206073",
      "2206076",
      "2206077",
      "2206078",
      "2206086",
      "2206088",
      "2206089",
      "2206094",
      "2206099",
      "2206101",
      "2206102",
      "2206103",
      "2206105",
      "2206107",
      "2206109",
      "2206110",
      "2206111",
      "2206117",
      "2206118",
      "2206119",
      "2206122",
      "2206123",
      "2206127",
      "2206128",
      "2206129",
      "2206130",
      "2206131",
      "2206134",
      "2206135",
      "2206136",
      "2206138",
      "2206140",
      "2206141",
      "2206143",
      "2206145",
      "2206146",
      "2206149",
      "2206154",
      "2206155",
      "2206157",
      "2206158",
      "2206159",
      "2206160",
      "2206162",
      "2206167",
      "2206172",
      "2206173",
      "2206174",
      "2206177",
      "2206177",
      "2206178",
      "2206181",
      "2206182",
      "2206183",
      "2206184",
      "2206187",
      "2206192",
      "2206196",
      "2206199",
      "2206202",
      "2206204",
      "2206208",
      "2206209",
      "2206210",
      "2206213",
      "2206214",
      "2206217",
      "2206218",
      "2206219",
      "2206221",
      "2206222",
      "2206228",
      "2206229",
      "2206230",
      "2206232",
      "2206235",
      "2206239",
      "2206240",
      "2206242",
      "2206243",
      "2206245",
      "2206249",
      "2206250",
      "2206251",
      "2206253",
      "2206254",
      "2206255",
      "2206256",
      "2206257",
      "2206258",
      "2206259",
      "2206261",
      "2206263",
      "2206264",
      "2206265",
      "2206266",
      "2206267",
      "2206269",
      "2206270",
      "2206272",
      "2206273",
      "2206274",
      "2206276",
      "2206277",
      "2206278",
      "2206281",
      "2206283",
      "2206283",
      "2206285",
      "2206286",
      "2206287",
      "2206289",
      "2206292",
      "2206294",
      "2206297",
      "2206299",
      "2206302",
      "2206304",
      "2206305",
      "2206310",
      "2206312",
      "2206316",
      "2206318",
      "2206319",
      "2206322",
      "2206323",
      "2206324",
      "2206329",
      "2206333",
      "2206335",
      "2206341",
      "2206346",
      "2206348",
      "2206349",
      "2206358",
      "2206361",
      "2206367",
      "2206369",
      "2206372",
      "2206374",
      "2206377",
      "2206378",
      "2206383",
      "2206386",
      "2206395",
      "2206396",
      "2206401",
      "2206402",
      "2206403",
      "2206404",
      "2206407",
      "2206408",
      "2206410",
      "2206411",
      "2206412",
      "2206416",
      "2206418",
      "2206419",
      "2206424",
      "2206425",
      "2228001",
      "2228003",
      "2228004",
      "2228006",
      "2228010",
      "2228013",
      "2228015",
      "2228017",
      "2228018",
      "2228020",
      "2228022",
      "2228023",
      "2228026",
      "2228031",
      "2228032",
      "2228035",
      "2228037",
      "2228038",
      "2228039",
      "2228040",
      "2228043",
      "2228044",
      "2228046",
      "2228047",
      "2228048",
      "2228052",
      "2228057",
      "2228059",
      "2228061",
      "2228066",
      "2228067",
      "2228075",
      "2228078",
      "2228079",
      "2228080",
      "2228081",
      "2228082",
      "2228083",
      "2228087",
      "2228094",
      "2228095",
      "2228096",
      "2228100",
      "2228101",
      "2228107",
      "2228109",
      "2228115",
      "2228116",
      "2228117",
      "2228119",
      "2228120",
      "2228127",
      "2228132",
      "2228133",
      "2228137",
      "2228141",
      "2228148",
      "2228150",
      "2228154",
      "2228158",
      "2228161",
      "2228167",
      "2228169",
      "2228170",
      "2228171",
      "2228172",
      "2228178",
      "2228181",
      "2229006",
      "2229008",
      "2229009",
      "2229011",
      "2229017",
      "2229018",
      "2229021",
      "2229024",
      "2229030",
      "2229037",
      "2229038",
      "2229041",
      "2229044",
      "2229051",
      "2229052",
      "2229059",
      "2229061",
      "2229063",
      "2229064",
      "2229068",
      "2229069",
      "2229071",
      "2229072",
      "2229076",
      "2229079",
      "2229084",
      "2229087",
      "2229088",
      "2229090",
      "2229091",
      "2229095",
      "2229098",
      "2229112",
      "2229115",
      "2229116",
      "2229119",
      "2229120",
      "2229124",
      "2229125",
      "2229126",
      "2229130",
      "2229132",
      "2229133",
      "2229139",
      "2229143",
      "2229146",
      "2229148",
      "2229150",
      "2229165",
      "2229177",
      "2229185",
      "2229187",
      "2229189",
      "2229201",
      "23057001",
      "23057003",
      "23057004",
      "23057005",
      "23057007",
      "23057008",
      "23057010",
      "23057011",
      "23057016",
      "23057017",
      "23057019",
      "23057020",
      "23057021",
      "23057022",
      "23057024",
      "23057026",
      "23057029",
      "23057033",
      "23057036",
      "23057037",
      "23057039",
      "23057041",
      "23057042",
      "23057043",
      "23057044",
      "23057047",
      "23057048",
      "23057049",
      "23057052",
      "23057056",
      "23057058",
      "23057061",
      "23057063",
      "2306601"
    ]
    
    
    let continueLoop = true;

    try {
      for (let i = 0; i < users.length && continueLoop; i++) {
        if(!continueLoop) break;
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

  async redeemRequest(dto:{
    userId:string;
    amount:number;
    upiId:string
  }){
  try {
    const user = await this.prisma.user.findUnique({
      where:{
        id:dto.userId
      }
    });
    if(!user) throw new BadRequestException('User Not Found');

    if(user.refralAmount < dto.amount) throw new BadRequestException('Insufficient Balance');

    const redeemReq = await this.prisma.redeemRequest.create({
      data:{
        amount:dto.amount,
        userId:user.id,
        upiId:dto.upiId
      }
    });

    if(!redeemReq) throw new InternalServerErrorException('Failed to Create Redeem Request');

    await this.prisma.user.update({
      where:{
        id:user.id
      },
      data:{
        refralAmount:user.refralAmount - dto.amount
      }
    });

    return redeemReq;
  } catch (error) {
    console.log(error);
    throw new InternalServerErrorException('Internal Server Error');
  }

}

async getRedeemRequest(userId:string){
  try {
    const user = await this.prisma.user.findUnique({
      where:{
        id:userId
      },
      select:{
        id:true,
        refrealCode:true,
        refralAmount:true
      }
    });
    if(!user) throw new BadRequestException('User Not Found');

    const redeemReq = await this.prisma.redeemRequest.findMany({
      where:{
        userId:user.id
      }
    });



    return {
    user,
    redeemReq
    };
  } catch (error) {
    console.log(error);
    throw new InternalServerErrorException('Internal Server Error');
  }

}

async getUnknow(){
  try {
    
    const user = await this.prisma.user.findMany({
      select:{
        refrealCode:true,
        id:true
      }
    });

    return user;

  } catch (error) {
    
  }
}

async getTotalRedeemRequest(){
  try {
    const redeemReq = await this.prisma.redeemRequest.findMany({
      select:{
        id:true,
        amount:true,
        upiId:true,
        userId:true,
        createdAt:true
      }
    });

    return redeemReq;
  } catch (error) {
    console.log(error);
    throw new InternalServerErrorException('Internal Server Error');
  }
}


async testUpload(file:Express.Multer.File){
  try {
    const mediaId = await this.generateMediaId();
    const filebuffer = await sharp(file.buffer)
    .webp({ quality: 80 }) // Adjust quality as needed
    .toBuffer();

    console.log(file.buffer, 'buffer');

    const p = await this.storageService.uploadFile(
    filebuffer,mediaId
    );

    return p;
  } catch (error) {
    console.log(error);
    throw new InternalServerErrorException('Internal Server Error');
  }
}

async getPremiumWithoutPaid(){
  try {
    const user = await this.prisma.premiumMember.findMany({
      where:{
        
        paymentScreenshot:undefined,
        isActive:false,
      
      },
      select:{
      user:{
        select:{
          email:true,
          name:true,
           
        }
      },
      branch:true,
      year:true,
      }
    });

    return {
      length:user.length,
      user:user
    };
  } catch (error) {
    console.log(error);
    throw new InternalServerErrorException('Internal Server Error');
  }
}

async sendMailToPremiumButNotPaymentDone(){

  const user=[
    {
    "user": {
    "email": "21053420@kiit.ac.in",
    "name": "RD GAURAV TIWARI"
    }
    },
    
    {
    "user": {
    "email": "21052596@kiit.ac.in",
    "name": "596-KOUSHIKI BOSE"
    }
    },
    {
    "user": {
    "email": "21053267@kiit.ac.in",
    "name": "3267_ANAMOL KALWAR"
    }
    },
    {
    "user": {
    "email": "21052469@kiit.ac.in",
    "name": "Abhishek Yadav"
    }
    },
    {
    "user": {
    "email": "23052094@kiit.ac.in",
    "name": "REHAAN PAUL"
    }
    },
    {
    "user": {
    "email": "22054231@kiit.ac.in",
    "name": "4231_SHIVAM SHAH"
    }
    },
    {
    "user": {
    "email": "22051344@kiit.ac.in",
    "name": "KUNAL SAW"
    }
    },
    {
    "user": {
    "email": "21051859@kiit.ac.in",
    "name": "1859_Swapnil"
    }
    },
    {
    "user": {
    "email": "23053541@kiit.ac.in",
    "name": "3541_ASHMIT PATRA"
    }
    },
    {
    "user": {
    "email": "21051706@kiit.ac.in",
    "name": "1706_Abhishek Mallick"
    }
    },
    {
    "user": {
    "email": "22052730@kiit.ac.in",
    "name": "730-ISHU KANT"
    }
    },
    {
    "user": {
    "email": "22051990@kiit.ac.in",
    "name": "1990_SURYASNATA PAITAL"
    }
    },
    {
    "user": {
    "email": "22052042@kiit.ac.in",
    "name": "2042_RIDDHIMA BISWAS"
    }
    },
    {
    "user": {
    "email": "21052286@kiit.ac.in",
    "name": "2286_SOURODEEP KUNDU"
    }
    },
    {
    "user": {
    "email": "2105991@kiit.ac.in",
    "name": "5991_RUNGSHIT SAHA"
    }
    },
    {
    "user": {
    "email": "21052458@kiit.ac.in",
    "name": "458 _SWARNADEEP GHOSAL"
    }
    },
    {
    "user": {
    "email": "21051275@kiit.ac.in",
    "name": "VINIT AGARWAL"
    }
    },
    {
    "user": {
    "email": "2205386@kiit.ac.in",
    "name": "386_Kashish"
    }
    },
    {
    "user": {
    "email": "21052648@kiit.ac.in",
    "name": "2648_ANEESHA"
    }
    },
    {
    "user": {
    "email": "21051505@kiit.ac.in",
    "name": "1505_SAIM"
    }
    },
    {
    "user": {
    "email": "2305822@kiit.ac.in",
    "name": "SUMAN SINGHA"
    }
    },
    {
    "user": {
    "email": "2105989@kiit.ac.in",
    "name": "5989_RINKESH KUMAR SINHA"
    }
    },
    {
    "user": {
    "email": "21051750@kiit.ac.in",
    "name": "750_Piyush"
    }
    },
    {
    "user": {
    "email": "22054265@kiit.ac.in",
    "name": "SANJIV KUMAR"
    }
    },
    {
    "user": {
    "email": "2105073@kiit.ac.in",
    "name": "073_SRITAM DUTTA"
    }
    },
    {
    "user": {
    "email": "22053137@kiit.ac.in",
    "name": "ANIRAN SAHA"
    }
    },
    {
    "user": {
    "email": "2205635@kiit.ac.in",
    "name": "DEEPAYAN DAS"
    }
    },
    {
    "user": {
    "email": "21053289@kiit.ac.in",
    "name": "3289_MANDIP SAH"
    }
    },
    {
    "user": {
    "email": "22052043@kiit.ac.in",
    "name": "2043_ Ritajit Pal"
    }
    },
    {
    "user": {
    "email": "22051589@kiit.ac.in",
    "name": "589-MEGHANSH GOVIL"
    }
    },
    {
    "user": {
    "email": "2105629@kiit.ac.in",
    "name": "629_MANDIRA GHOSH"
    }
    },
    {
    "user": {
    "email": "22054077@kiit.ac.in",
    "name": "4077_Ritesh Sah"
    }
    },
    {
    "user": {
    "email": "21051801@kiit.ac.in",
    "name": "1801_ARNAV DEY"
    }
    },
    {
    "user": {
    "email": "22053403@kiit.ac.in",
    "name": "3403-AROSREE SATAPATHY"
    }
    },
    {
    "user": {
    "email": "22054107@kiit.ac.in",
    "name": "4107 Abhisek Singh"
    }
    },
    {
    "user": {
    "email": "21051833@kiit.ac.in",
    "name": "1833_PRANABIT PRADHAN"
    }
    },
    {
    "user": {
    "email": "2128123@kiit.ac.in",
    "name": "123_ABHA SRIVASTAVA"
    }
    },
    {
    "user": {
    "email": "2105098@kiit.ac.in",
    "name": "098 _AhonaGhosh"
    }
    },
    {
    "user": {
    "email": "23051288@kiit.ac.in",
    "name": "PRAYAG PATRO"
    }
    },
    {
    "user": {
    "email": "2205514@kiit.ac.in",
    "name": "514_TANYA CHAUDHARY"
    }
    },
    {
    "user": {
    "email": "22052907@kiit.ac.in",
    "name": "KUMAR ANURAG"
    }
    },
    {
    "user": {
    "email": "23051943@kiit.ac.in",
    "name": "SAAKSSHI PODDER"
    }
    },
    {
    "user": {
    "email": "21052386@kiit.ac.in",
    "name": "2386_AKASH DUTTACHOWDHURY"
    }
    },
    {
    "user": {
    "email": "2106314@kiit.ac.in",
    "name": "6314_ASHISH PATEL"
    }
    },
    {
    "user": {
    "email": "22054115@kiit.ac.in",
    "name": "4115 - Aadya Sharma"
    }
    },
    {
    "user": {
    "email": "21053437@kiit.ac.in",
    "name": "3437_PRIYANKA KUMARI"
    }
    },
    {
    "user": {
    "email": "22052164@kiit.ac.in",
    "name": "2164_SUBHAM BERA"
    }
    },
    {
    "user": {
    "email": "22052060@kiit.ac.in",
    "name": "2060_SINCHAL KAR"
    }
    },
    {
    "user": {
    "email": "2206201@kiit.ac.in",
    "name": "6201_RANGIN BERA"
    }
    },
    {
    "user": {
    "email": "2328062@kiit.ac.in",
    "name": "8062_Abhishek D"
    }
    },
    {
    "user": {
    "email": "21052533@kiit.ac.in",
    "name": "533_Sneha Behera"
    }
    },
    {
    "user": {
    "email": "22051085@kiit.ac.in",
    "name": "NILOTPAL BASU"
    }
    },
    {
    "user": {
    "email": "22053586@kiit.ac.in",
    "name": "3586-AVINASH PATRA"
    }
    },
    {
    "user": {
    "email": "2105469@kiit.ac.in",
    "name": "5469_NAKSHATRA GUPTA"
    }
    },
    {
    "user": {
    "email": "22052894@kiit.ac.in",
    "name": "2894_AYUSH RANJAN"
    }
    },
    {
    "user": {
    "email": "22053145@kiit.ac.in",
    "name": "145_Arani Maity"
    }
    },
    {
    "user": {
    "email": "22053474@kiit.ac.in",
    "name": "TAMONASH MAJUMDER (22053474)"
    }
    },
    {
    "user": {
    "email": "2105449@kiit.ac.in",
    "name": "449 Chaitanya"
    }
    },
    {
    "user": {
    "email": "21052365@kiit.ac.in",
    "name": "2365_Siddhartha Mukherjee"
    }
    },
    {
    "user": {
    "email": "22053285@kiit.ac.in",
    "name": "SOUMYA KUMAR"
    }
    },
    {
    "user": {
    "email": "21051468@kiit.ac.in",
    "name": "1468_ARVIND KAPHLEY"
    }
    },
    {
    "user": {
    "email": "22053007@kiit.ac.in",
    "name": "PROGYA BHATTACHARJEE"
    }
    },
    {
    "user": {
    "email": "2105653@kiit.ac.in",
    "name": "653_SAHIL RAJ SINGH"
    }
    },
    {
    "user": {
    "email": "2105177@kiit.ac.in",
    "name": "177_AHELI MANNA"
    }
    },
    {
    "user": {
    "email": "2305114@kiit.ac.in",
    "name": "Ansh Kumar Sharma"
    }
    },
    {
    "user": {
    "email": "21051085@kiit.ac.in",
    "name": "1085_SATYA PRAKASH"
    }
    },
    {
    "user": {
    "email": "2105270@kiit.ac.in",
    "name": "270_AYUSHI MOHANTY"
    }
    },
    {
    "user": {
    "email": "22054403@kiit.ac.in",
    "name": "4403ROHIT SHARMA"
    }
    },
    {
    "user": {
    "email": "21052332@kiit.ac.in",
    "name": "2332KUNAL KUMAR"
    }
    },
    {
    "user": {
    "email": "2105534@kiit.ac.in",
    "name": "534_AYUSH BISWAL"
    }
    },
    {
    "user": {
    "email": "2105471@kiit.ac.in",
    "name": "471_NAMRATA MAHAPATRA"
    }
    },
    {
    "user": {
    "email": "2105940@kiit.ac.in",
    "name": "5940_ADARSH TIWARI"
    }
    },
    {
    "user": {
    "email": "22053641@kiit.ac.in",
    "name": "3641 _SOURAV MALLICK"
    }
    },
    {
    "user": {
    "email": "22051008@kiit.ac.in",
    "name": "1008_SAHASRANSHU SHASTRI"
    }
    },
    {
    "user": {
    "email": "2206356@kiit.ac.in",
    "name": "356_Niladri Nag"
    }
    },
    {
    "user": {
    "email": "22054149@kiit.ac.in",
    "name": "4149 POORVI SINGH"
    }
    },
    {
    "user": {
    "email": "21051301@kiit.ac.in",
    "name": "301_Deblina"
    }
    },
    {
    "user": {
    "email": "21051785@kiit.ac.in",
    "name": "785-YUVRAJ SINGH"
    }
    },
    {
    "user": {
    "email": "21051368@kiit.ac.in",
    "name": "1368 _ Ahana Datta"
    }
    },
    {
    "user": {
    "email": "2106274@kiit.ac.in",
    "name": "6274_Ujjwal Pratap Singh"
    }
    },
    {
    "user": {
    "email": "22054347@kiit.ac.in",
    "name": "4347_Dipesh NAYAK"
    }
    },
    {
    "user": {
    "email": "22051470@kiit.ac.in",
    "name": "70 Tanishq"
    }
    },
    {
    "user": {
    "email": "21052476@kiit.ac.in",
    "name": "476_ANISH SINHA"
    }
    },
    {
    "user": {
    "email": "22052065@kiit.ac.in",
    "name": "SOUMILI DAS"
    }
    },
    {
    "user": {
    "email": "21052677@kiit.ac.in",
    "name": "677_Mohnish Mishra"
    }
    },
    {
    "user": {
    "email": "22052715@kiit.ac.in",
    "name": "2715_ARYAN RAJ CHOUDHURY"
    }
    },
    {
    "user": {
    "email": "2106032@kiit.ac.in",
    "name": "032 HARSH SINGH"
    }
    },
    {
    "user": {
    "email": "2228168@kiit.ac.in",
    "name": "8168-SubhamMohanty"
    }
    },
    {
    "user": {
    "email": "21053455@kiit.ac.in",
    "name": "3455_sanjay sah"
    }
    },
    {
    "user": {
    "email": "23053408@kiit.ac.in",
    "name": "3408_Pramity Majumder"
    }
    },
    {
    "user": {
    "email": "22053151@kiit.ac.in",
    "name": "3151_Ayush Kumar"
    }
    },
    {
    "user": {
    "email": "22053923@kiit.ac.in",
    "name": "AMITAV MOHANTY"
    }
    },
    {
    "user": {
    "email": "2129057@kiit.ac.in",
    "name": "057_Arpita P"
    }
    },
    {
    "user": {
    "email": "2205039@kiit.ac.in",
    "name": "HARSHIT"
    }
    },
    {
    "user": {
    "email": "2105825@kiit.ac.in",
    "name": "825_SAUMY"
    }
    },
    {
    "user": {
    "email": "2105268@kiit.ac.in",
    "name": "268_ AVANI"
    }
    },
    {
    "user": {
    "email": "21051770@kiit.ac.in",
    "name": "770 SRIJAN MUKHERJEE"
    }
    },
    {
    "user": {
    "email": "2105885@kiit.ac.in",
    "name": "5885_Gourav Chatterjee"
    }
    },
    {
    "user": {
    "email": "22054124@kiit.ac.in",
    "name": "4124 BABLI SAHU"
    }
    },
    {
    "user": {
    "email": "2105059@kiit.ac.in",
    "name": "059_ RUDRANSH MISHRA"
    }
    },
    {
    "user": {
    "email": "2105337@kiit.ac.in",
    "name": "337_abhay"
    }
    },
    {
    "user": {
    "email": "2105634@kiit.ac.in",
    "name": "634_OM SINGH"
    }
    },
    {
    "user": {
    "email": "22051075@kiit.ac.in",
    "name": "HARSH SANKRIT"
    }
    },
    {
    "user": {
    "email": "2228147@kiit.ac.in",
    "name": "8147_Shrinkhala Kumari"
    }
    },
    {
    "user": {
    "email": "21052110@kiit.ac.in",
    "name": "2110_SOUMYA RANJAN BEHERA"
    }
    },
    {
    "user": {
    "email": "2229062@kiit.ac.in",
    "name": "9062_SAYAN BANERJEE"
    }
    },
    {
    "user": {
    "email": "2205506@kiit.ac.in",
    "name": "506_SHOVIN BARIK"
    }
    },
    {
    "user": {
    "email": "2105018@kiit.ac.in",
    "name": "018_ARITRA MUHURI"
    }
    },
    {
    "user": {
    "email": "22051525@kiit.ac.in",
    "name": "1525_MAYUKH PATTANAYAK"
    }
    },
    {
    "user": {
    "email": "2306384@kiit.ac.in",
    "name": "RAMAN KURMI"
    }
    },
    {
    "user": {
    "email": "21051006@kiit.ac.in",
    "name": "1006_ SHIVANGI"
    }
    },
    {
    "user": {
    "email": "23052438@kiit.ac.in",
    "name": "SOVIK BURMA"
    }
    },
    {
    "user": {
    "email": "21052490@kiit.ac.in",
    "name": "490_BHAVYA KUMARI"
    }
    },
    {
    "user": {
    "email": "2105690@kiit.ac.in",
    "name": "690_Amit Kumar Yadav"
    }
    },
    {
    "user": {
    "email": "21052339@kiit.ac.in",
    "name": "2339"
    }
    },
    {
    "user": {
    "email": "22052684@kiit.ac.in",
    "name": "SOUNAK DUTTA"
    }
    },
    {
    "user": {
    "email": "21053316@kiit.ac.in",
    "name": "316_ SAGAR MAHATO"
    }
    },
    {
    "user": {
    "email": "21053247@kiit.ac.in",
    "name": "3247_ROHIT RAJ"
    }
    },
    {
    "user": {
    "email": "22051479@kiit.ac.in",
    "name": "AARUSH AMBAR"
    }
    },
    {
    "user": {
    "email": "2205130@kiit.ac.in",
    "name": "130_Kanishk"
    }
    },
    {
    "user": {
    "email": "2105670@kiit.ac.in",
    "name": "670_SNEHAN SAHOO"
    }
    },
    {
    "user": {
    "email": "21052467@kiit.ac.in",
    "name": "467_AAMOGHA BILLORE"
    }
    },
    {
    "user": {
    "email": "21052375@kiit.ac.in",
    "name": "2375_SWATI SUMAN SAHU"
    }
    },
    {
    "user": {
    "email": "22052429@kiit.ac.in",
    "name": "2429_UTKARSH NIGAM"
    }
    },
    {
    "user": {
    "email": "22054001@kiit.ac.in",
    "name": "VIKRAM KUMAR"
    }
    },
    {
    "user": {
    "email": "22054051@kiit.ac.in",
    "name": "4051_Madan Pandey"
    }
    },
    {
    "user": {
    "email": "21052759@kiit.ac.in",
    "name": "2759_GOURAV CHAKRABORTY"
    }
    },
    {
    "user": {
    "email": "21052501@kiit.ac.in",
    "name": "501_GAUTAM SINHA"
    }
    },
    {
    "user": {
    "email": "2106073@kiit.ac.in",
    "name": "6073_SUDIP MONDAL"
    }
    },
    {
    "user": {
    "email": "21051807@kiit.ac.in",
    "name": "1807_ BHAGWANT"
    }
    },
    {
    "user": {
    "email": "2129037@kiit.ac.in",
    "name": "037_SOUMYADEEP PAUL"
    }
    },
    {
    "user": {
    "email": "21052315@kiit.ac.in",
    "name": "2315AVIRUP SAMANTA"
    }
    },
    {
    "user": {
    "email": "2105823@kiit.ac.in",
    "name": "823_Sathwik Yaramala"
    }
    },
    {
    "user": {
    "email": "2206397@kiit.ac.in",
    "name": "6397_Samyog Sharma"
    }
    },
    {
    "user": {
    "email": "21052690@kiit.ac.in",
    "name": "690_ Reetika"
    }
    },
    {
    "user": {
    "email": "21051538@kiit.ac.in",
    "name": "1538_Aniket Raul"
    }
    },
    {
    "user": {
    "email": "21051481@kiit.ac.in",
    "name": "481_ Suhank"
    }
    },
    {
    "user": {
    "email": "2105313@kiit.ac.in",
    "name": "313_SAURABH SHUKLA"
    }
    },
    {
    "user": {
    "email": "2206200@kiit.ac.in",
    "name": "6200_Rajtanu"
    }
    },
    {
    "user": {
    "email": "21052969@kiit.ac.in",
    "name": "2969_ AARNAV Kumar"
    }
    },
    {
    "user": {
    "email": "2228065@kiit.ac.in",
    "name": "SIDDHARTHA"
    }
    },
    {
    "user": {
    "email": "21052956@kiit.ac.in",
    "name": "2956_SWAYAM"
    }
    },
    {
    "user": {
    "email": "22054325@kiit.ac.in",
    "name": "PRADEEP (22054325)"
    }
    },
    {
    "user": {
    "email": "2129160@kiit.ac.in",
    "name": "160- KAFIA ADEN MOHAMED"
    }
    },
    {
    "user": {
    "email": "21052370@kiit.ac.in",
    "name": "2370_SUMIT RANJAN"
    }
    },
    {
    "user": {
    "email": "21051877@kiit.ac.in",
    "name": "877_ALOK KUMAR JHA"
    }
    },
    {
    "user": {
    "email": "22052995@kiit.ac.in",
    "name": "LOKESH SINGH"
    }
    },
    {
    "user": {
    "email": "21051927@kiit.ac.in",
    "name": "1927_Satyadeb Chand"
    }
    },
    {
    "user": {
    "email": "21051697@kiit.ac.in",
    "name": "1697_vaibhav patel"
    }
    },
    {
    "user": {
    "email": "22053412@kiit.ac.in",
    "name": "AYUSH DAS"
    }
    },
    {
    "user": {
    "email": "2129010@kiit.ac.in",
    "name": "010_Aditya"
    }
    },
    {
    "user": {
    "email": "22052501@kiit.ac.in",
    "name": "SAMYA DAS"
    }
    },
    {
    "user": {
    "email": "21053244@kiit.ac.in",
    "name": "244 RISHABH KUMAR SINGH"
    }
    },
    {
    "user": {
    "email": "2105768@kiit.ac.in",
    "name": "768_AMLAN"
    }
    },
    {
    "user": {
    "email": "22051227@kiit.ac.in",
    "name": "AKANKHYA BEURIA"
    }
    },
    {
    "user": {
    "email": "21051084@kiit.ac.in",
    "name": "SASWAT JENA"
    }
    },
    {
    "user": {
    "email": "22054029@kiit.ac.in",
    "name": "4029_Bibek Chand"
    }
    },
    {
    "user": {
    "email": "2106286@kiit.ac.in",
    "name": "286-MANYTUCH MANGAR BENY RUEI"
    }
    },
    {
    "user": {
    "email": "21052585@kiit.ac.in",
    "name": "585_Ekaansh"
    }
    },
    {
    "user": {
    "email": "2206125@kiit.ac.in",
    "name": "6125_ shikhar bhadouria"
    }
    },
    {
    "user": {
    "email": "22052193@kiit.ac.in",
    "name": "2193_ Aparna Sinha"
    }
    },
    {
    "user": {
    "email": "22051697@kiit.ac.in",
    "name": "1697 Nikhil Aditya Nagvanshi"
    }
    },
    {
    "user": {
    "email": "2205066@kiit.ac.in",
    "name": "SHAKYA SINHA"
    }
    },
    {
    "user": {
    "email": "23052856@kiit.ac.in",
    "name": "2856_ Aayush kumar"
    }
    },
    {
    "user": {
    "email": "22053782@kiit.ac.in",
    "name": "KRISHNENDU PAN"
    }
    },
    {
    "user": {
    "email": "21051594@kiit.ac.in",
    "name": "594_SHAMIT SHEEL"
    }
    },
    {
    "user": {
    "email": "2105387@kiit.ac.in",
    "name": "387 OORJA SINGH"
    }
    },
    {
    "user": {
    "email": "22054326@kiit.ac.in",
    "name": "4326_Abhishek"
    }
    },
    {
    "user": {
    "email": "22052426@kiit.ac.in",
    "name": "SUMIT VERMA"
    }
    },
    {
    "user": {
    "email": "2228068@kiit.ac.in",
    "name": "STUTI SRIVASTAVA"
    }
    },
    {
    "user": {
    "email": "22052841@kiit.ac.in",
    "name": "RAHUL PANDEY"
    }
    },
    {
    "user": {
    "email": "21052688@kiit.ac.in",
    "name": "688_PUSHPAK KUMAR"
    }
    },
    {
    "user": {
    "email": "21052480@kiit.ac.in",
    "name": "480_ANTRA AMRIT"
    }
    },
    {
    "user": {
    "email": "22054362@kiit.ac.in",
    "name": "4362_NISTHA Panjiyar"
    }
    },
    {
    "user": {
    "email": "2205497@kiit.ac.in",
    "name": "SALONI GOEL"
    }
    },
    {
    "user": {
    "email": "22051452@kiit.ac.in",
    "name": "1452 SAHIL KHILAR"
    }
    },
    {
    "user": {
    "email": "22054152@kiit.ac.in",
    "name": "4152 HARSHITA BINAYAKIA"
    }
    },
    {
    "user": {
    "email": "21051367@kiit.ac.in",
    "name": "1367_ADARSH RAI"
    }
    },
    {
    "user": {
    "email": "2303036@kiit.ac.in",
    "name": "3036_SATWIK SHARMA"
    }
    },
    {
    "user": {
    "email": "22052811@kiit.ac.in",
    "name": "2811_Dev Shubhankar"
    }
    },
    {
    "user": {
    "email": "2228036@kiit.ac.in",
    "name": "NAURAV KUMAR"
    }
    },
    {
    "user": {
    "email": "2105219@kiit.ac.in",
    "name": "AKASH AGRAWAL"
    }
    },
    {
    "user": {
    "email": "22052533@kiit.ac.in",
    "name": "ANKIT BISWAS"
    }
    },
    {
    "user": {
    "email": "2105146@kiit.ac.in",
    "name": "146_SANDIPAN JANA"
    }
    },
    {
    "user": {
    "email": "2205180@kiit.ac.in",
    "name": "5180_ANIKET BHARDWAJ"
    }
    },
    {
    "user": {
    "email": "22051660@kiit.ac.in",
    "name": "ALI SAMAD"
    }
    },
    {
    "user": {
    "email": "22053082@kiit.ac.in",
    "name": "3082_PARAG DAS"
    }
    },
    {
    "user": {
    "email": "21053213@kiit.ac.in",
    "name": "3213 Ehteshamur"
    }
    },
    {
    "user": {
    "email": "2206417@kiit.ac.in",
    "name": "6417_Stuti Kudada"
    }
    },
    {
    "user": {
    "email": "21051605@kiit.ac.in",
    "name": "1605 _sreetama"
    }
    },
    {
    "user": {
    "email": "22052134@kiit.ac.in",
    "name": "2134_PRITHWIRAJ DAS"
    }
    },
    {
    "user": {
    "email": "2206048@kiit.ac.in",
    "name": "SARTTIK PANJA"
    }
    },
    {
    "user": {
    "email": "22052337@kiit.ac.in",
    "name": "2337_SUHAN MOHANTY"
    }
    },
    {
    "user": {
    "email": "22051873@kiit.ac.in",
    "name": "RAGHAV KUMAR"
    }
    },
    {
    "user": {
    "email": "22051032@kiit.ac.in",
    "name": "1032_SOURAV KUMAR PARIDA"
    }
    },
    {
    "user": {
    "email": "21051252@kiit.ac.in",
    "name": "252 SATYAM RAJ"
    }
    },
    {
    "user": {
    "email": "23051655@kiit.ac.in",
    "name": "1655_ANSUMAN DAS"
    }
    },
    {
    "user": {
    "email": "2205562@kiit.ac.in",
    "name": "KESHAB Gupta_562"
    }
    },
    {
    "user": {
    "email": "22054271@kiit.ac.in",
    "name": "PANKAJ KUMAR"
    }
    },
    {
    "user": {
    "email": "22053155@kiit.ac.in",
    "name": "DEBOTTAM MANDAL"
    }
    },
    {
    "user": {
    "email": "21052216@kiit.ac.in",
    "name": "2216_ABHISHEK ANAND"
    }
    },
    {
    "user": {
    "email": "22053669@kiit.ac.in",
    "name": "3669 - ARPAN MISHRA"
    }
    },
    {
    "user": {
    "email": "22053620@kiit.ac.in",
    "name": "3620_RUDRA PRATAP"
    }
    },
    {
    "user": {
    "email": "22054204@kiit.ac.in",
    "name": "204_RANJAN SHARMA"
    }
    },
    {
    "user": {
    "email": "2206017@kiit.ac.in",
    "name": "017_ARNAV GUPTA"
    }
    },
    {
    "user": {
    "email": "2306139@kiit.ac.in",
    "name": "SATYAM MISHRA"
    }
    },
    {
    "user": {
    "email": "2205040@kiit.ac.in",
    "name": "ISHANN MISHRA"
    }
    },
    {
    "user": {
    "email": "22054287@kiit.ac.in",
    "name": "GITESH KUMAR"
    }
    },
    {
    "user": {
    "email": "2206295@kiit.ac.in",
    "name": "6295_SIDDHARTHA Kasu"
    }
    },
    {
    "user": {
    "email": "21052791@kiit.ac.in",
    "name": "2791_ Sakshi Kumari"
    }
    },
    {
    "user": {
    "email": "2105398@kiit.ac.in",
    "name": "398- RIMO GHOSH"
    }
    },
    {
    "user": {
    "email": "2129090@kiit.ac.in",
    "name": "090_ RAJDEEP SARKAR"
    }
    },
    {
    "user": {
    "email": "22051027@kiit.ac.in",
    "name": "1027_SIDDHARTH SHUKLA"
    }
    },
    {
    "user": {
    "email": "22054196@kiit.ac.in",
    "name": "SAKSHAM"
    }
    },
    {
    "user": {
    "email": "2206006@kiit.ac.in",
    "name": "6006 Akash"
    }
    },
    {
    "user": {
    "email": "22054384@kiit.ac.in",
    "name": "4384_Sonu Thakur Lohar"
    }
    },
    {
    "user": {
    "email": "2129113@kiit.ac.in",
    "name": "9113SOUMIK GOSWAMI"
    }
    },
    {
    "user": {
    "email": "21052642@kiit.ac.in",
    "name": "642_Aditya Narayan Singh"
    }
    },
    {
    "user": {
    "email": "notification.kaksha@gmail.com",
    "name": "Kaksha"
    }
    },
    {
    "user": {
    "email": "2128040@kiit.ac.in",
    "name": "8040_Rajshekhar Ghosh"
    }
    },
    {
    "user": {
    "email": "21051000@kiit.ac.in",
    "name": "1000_SAYANDIP ADHIKARI"
    }
    },
    {
    "user": {
    "email": "22052680@kiit.ac.in",
    "name": "SNIGHDHA"
    }
    },
    {
    "user": {
    "email": "21051915@kiit.ac.in",
    "name": "1915_PRITI PALLABHI MISHRA"
    }
    },
    {
    "user": {
    "email": "2205646@kiit.ac.in",
    "name": "ISHAAN ROY"
    }
    },
    {
    "user": {
    "email": "2105470@kiit.ac.in",
    "name": "470_Naman jain"
    }
    },
    {
    "user": {
    "email": "21051972@kiit.ac.in",
    "name": "1972_ANSUMAN PATI"
    }
    },
    {
    "user": {
    "email": "2106038@kiit.ac.in",
    "name": "6038_MD FAIZAN ZAKIR"
    }
    },
    {
    "user": {
    "email": "21052637@kiit.ac.in",
    "name": "637 ABHAY"
    }
    },
    {
    "user": {
    "email": "22053119@kiit.ac.in",
    "name": "SWAGATO DE"
    }
    },
    {
    "user": {
    "email": "2205513@kiit.ac.in",
    "name": "5513_TANISH KHOSLA (Taanish)"
    }
    },
    {
    "user": {
    "email": "2105372@kiit.ac.in",
    "name": "372_HEMANT"
    }
    },
    {
    "user": {
    "email": "21052242@kiit.ac.in",
    "name": "2242_AYUSH SINGH"
    }
    },
    {
    "user": {
    "email": "22057072@kiit.ac.in",
    "name": "7072_Surya Pritam Satpathy"
    }
    },
    {
    "user": {
    "email": "2105359@kiit.ac.in",
    "name": "359-ARPITA PAL"
    }
    },
    {
    "user": {
    "email": "21052736@kiit.ac.in",
    "name": "2736_ ANSH ARYAN"
    }
    },
    {
    "user": {
    "email": "2126002@kiit.ac.in",
    "name": "6002_ADARSH J H"
    }
    },
    {
    "user": {
    "email": "23053650@kiit.ac.in",
    "name": "MUKUND SAH"
    }
    },
    {
    "user": {
    "email": "2206271@kiit.ac.in",
    "name": "6271-KUSHAGRA SINHA"
    }
    },
    {
    "user": {
    "email": "23053333@kiit.ac.in",
    "name": "SPRIHA SINGH"
    }
    },
    {
    "user": {
    "email": "21052613@kiit.ac.in",
    "name": "613_Samyantak Mukherjee"
    }
    },
    {
    "user": {
    "email": "22053377@kiit.ac.in",
    "name": "3377_SOUMYADIP ADHIKARI"
    }
    },
    {
    "user": {
    "email": "21051827@kiit.ac.in",
    "name": "827 NILAY SINGH"
    }
    },
    {
    "user": {
    "email": "2105880@kiit.ac.in",
    "name": "5880_BISWAJIT NAYAK"
    }
    },
    {
    "user": {
    "email": "22052033@kiit.ac.in",
    "name": "LUCKY KUMAR"
    }
    },
    {
    "user": {
    "email": "21051427@kiit.ac.in",
    "name": "1427_SHIVPREET PADHI"
    }
    },
    {
    "user": {
    "email": "21052776@kiit.ac.in",
    "name": "2776 OMM DAS"
    }
    },
    {
    "user": {
    "email": "21051218@kiit.ac.in",
    "name": "1218_PRANTIK BARIK"
    }
    },
    {
    "user": {
    "email": "22054020@kiit.ac.in",
    "name": "4020_Arsh"
    }
    },
    {
    "user": {
    "email": "2205412@kiit.ac.in",
    "name": "412_SANDIPAN CHAKRABORTY"
    }
    }
    ]

    let continueLoop = true;

    try {
      for (let i = 0; i < user.length && continueLoop; i++) {
        await this.mailService.sendNotPremium(
          user[i].user.name,
          user[i].user.email,
          i,
        );
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    } catch (error) {
      console.log(error);
      continueLoop = false;
    return ;
    }

}


async getPremiumUserAfter(){
  try {
    const user = await this.prisma.user.updateMany({
      where:{
        updatedAt:{
          lte:new Date('2024-04-26T00:00:00.000Z')
        }
      },
      data:{
        isPremium:false
      }
    });

    return user;
  } catch (error) {
    console.log(error);
    throw new Error('Error in fetching premium user');
  }
}

async clearAllTokens(){
  try {
    const user = await this.cacheService.reset();
    return user;
  } catch (error) {
    console.log(error);
    throw new Error('Error in clearing tokens');
  }
}
}
