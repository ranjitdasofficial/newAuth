import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';

@Injectable()
export class GivewayService {
  constructor(private readonly prisma: PrismaService) {}

  async getAllGiveways() {
    try {
      return await this.prisma.premiumGiveway.findMany({});
    } catch (error) {
      console.log(error);
      throw new InternalServerErrorException('Internal Server Error!');
    }
  }

  async getPremiumAllotedGiveway() {
    try {
      return await this.prisma.premiumGiveway.findMany({
        where: {
          isPremiumAlloted: true,
        },
      });
    } catch (error) {
      throw new InternalServerErrorException('Internal Server Error!');
    }
  }

  listOfGiveways = ['3E7RM','X6CG3','W6N9Q','R9N6C','9G3QW','4R6N2','6MD3L','G3KYR','GM9HK','H3QZL'];

  listOfAllGivewaysNumber = [
    '3E7RM', 'JY9K6', 'UF4TG', 'C8DLY', 'VTSJ2', 'PZG7H', '6WX5N', 'B9M4R', '2HFTV', 'LKJ3C',
    '8VQZY', 'D6NXG', 'RPA4U', '5WJFB', 'Q7TLY', 'Z4P9K', 'T8C3D', 'JY6ZQ', '2V7FP', 'GM9HK',
    '3DUX5', 'LY5QF', 'KJ2B7', 'X6CG3', 'Z8V2T', 'H7NFK', 'Q4DV3', '6GBXT', 'F9JZY', 'U2RPQ',
    '4GQ8Y', 'CVN9W', 'H3QZL', 'T5F2X', 'P9BVW', '7RVZG', 'B3XMD', 'G2YZ7', '6WLHF', '8TQVN',
    'Z5LCG', 'M2DZY', '9GUC3', 'J3RK8', 'V6W5B', 'F4L2D', '2XQ6Y', '5NRP9', 'Y7B4K', '9XH6F',
    'Q4VY2', '3GJCF', 'X8FZM', 'B2HY9', 'N3DGU', '7F6KQ', 'R5UW2', 'D9ZP7', 'T3B5F', 'M7QNZ',
    '5C4BD', 'G3KYR', 'V8DJZ', '2QTXH', 'P7Y8N', 'J5FZU', 'W6N9Q', 'Z2TC8', 'B5XGH', '6MD3L',
    'Y9P7U', '4LQTF', 'T7YJD', 'G4BN8', '3FCMJ', 'U6D8V', 'Q5ZKB', 'N9FXG', '7W4HY', 'Z3RG6',
    'L8VKU', '2QBNJ', 'P5VZD', 'X7FTK', '9G3QW', 'C6ZJV', 'W4XHB', '8L5YJ', 'T2GBQ', 'R9N6C',
    'V5F3H', 'Y8BKD', '4R6N2', 'H5VCJ', 'G8FQK', '3T4NX', 'M6PZH', '9J7XV', 'C3KLV', 'B9Y2T'
];

  async getRandomGiveway() {
    const randomIndex = Math.floor(
      Math.random() * this.listOfAllGivewaysNumber.length,
    );
    const randomGivewayNumber = this.listOfAllGivewaysNumber[randomIndex];

    return randomGivewayNumber;
  }

  async createGiveway(userId: string) {
    try {
      const user = await this.prisma.user.findUnique({
        where: {
          id: userId,
        },
      });

      if (!user) {
        throw new InternalServerErrorException('User not found!');
      }
      const checkGiveaway = await this.prisma.premiumGiveway.findFirst({
        where: {
          userId: userId,
        },
      });


      if (checkGiveaway) {
        throw new InternalServerErrorException(
          'User already participated in giveway!',
        );


      }
      const premiumAllotedUsers = await this.prisma.premiumGiveway.findMany({
        where: {
          isPremiumAlloted: true,
        },
       
      });

      if (premiumAllotedUsers.length >= 10) {
        throw new InternalServerErrorException('All Premium Giveways are already alloted!');
      }

      const getRandomNumber = await this.getRandomGiveway();

      if (getRandomNumber) {
        const isFound = this.listOfGiveways.includes(getRandomNumber);

        return await this.prisma.premiumGiveway.create({
          data: {
            userId: userId,
            allotedCode: getRandomNumber,
            isPremiumAlloted: isFound,
            used: true,
          },
        });
      }

      throw new InternalServerErrorException('No Giveway Found!');
    } catch (error) {
      throw new InternalServerErrorException('Internal Server Error!');
    }
  }

  async getGivewayById(userId: string) {
    try {
      const currentUser= await this.prisma.premiumGiveway.findUnique({
        where: {
          userId: userId,
        },
        select:{
          allotedCode:true,
          isPremiumAlloted:true,
          used:true
        }
      });

      const premiumAllotedUsers = await this.prisma.premiumGiveway.findMany({
        where: {
          isPremiumAlloted: true,
        },
        select:{
          user:{
            select:{
              name:true,
              profileImage:true
            }
          
          }
        }
      });

      const totalParticipants = await this.prisma.premiumGiveway.count();

      return {
        totalParticipants,
        currentUser,
        premiumAllotedUsers
      }
    } catch (error) {
      throw new InternalServerErrorException('Internal Server Error!');
    }
  }
}
