import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async getUsers(dto: { pageNo: number; pageSize: number }) {
    try {
      const { pageNo, pageSize } = dto;
      console.log(pageNo, pageSize);
      //  get the users from latest to oldest
      const users = await this.prisma.user.findMany({
        skip: (pageNo - 1) * Number(pageSize),
        take: Number(pageSize),
        orderBy: {
          createdAt: 'desc',
        },
        select: {
          id: true,
          email: true,
          name: true,
          profileImage: true,
          isPremium: true,
          PremiumMember: {
            select: {
              branch: true,
              whatsappNumber: true,
              year: true,
              paymentScreenshot: true,
            },
          },
        },
      });
      return users;
    } catch (error) {
      console.log(error);
      throw new InternalServerErrorException('Error while fetching users');
    }
  }

  async getPremiumUsers(dto: { pageNo: number; pageSize: number }) {
    const { pageNo, pageSize } = dto;
    console.log(pageNo, pageSize);
    //  get the users from latest to oldest
    const users = await this.prisma.user.findMany({
      skip: (pageNo - 1) * Number(pageSize),
      take: Number(pageSize),
      orderBy: {
        updatedAt: 'desc',
      },
      where: {
        PremiumMember: {
          isNot: null,
        },
      },
      select: {
        id: true,
        email: true,
        name: true,
        profileImage: true,
        isPremium: true,
        PremiumMember: {
          select: {
            branch: true,
            whatsappNumber: true,
            year: true,
            paymentScreenshot: true,
          },
        },
      },
    });
    return users;
  }
  catch(error) {
    console.log(error);
    throw new InternalServerErrorException('Error while fetching users');
  }

  // async getCompanies() {
  //   try {
  //     return await this.prisma.placements.findMany({
  //       select: {
  //         // companyName: true,
  //         id: true,
  //       },
  //     });
  //   } catch (error) {
  //     console.log(error);
  //     throw new InternalServerErrorException('Internal Server Error');
  //   }
  // }
}
