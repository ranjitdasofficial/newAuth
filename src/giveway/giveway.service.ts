import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';

@Injectable()
export class GivewayService {
  constructor(private readonly prisma: PrismaService) {}

  async getAllGiveways() {
    try {
     const p = await this.prisma.premiumGiveway.findMany({});

      return {
        totalParticipants: p.length,
        giveways: p,
      }
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

  listOfGiveways = [
    "3E7RM", "4H7QX", "8D3MG", "7M3KV", "9H6KV",
    "0N5KV", "4K7FT", "5D1QX", "2X3WV", "9C6MG"
  ]

  listOfAllGivewaysNumber = [
  "3E7RM", "4Y6TP", "9J3KL", "1F2BN", "5D4GC", "7V8QX", "0H5LW", "2N3ZP", "6K4RJ", "8X7MB",
  "1G2FV", "3C6RP", "5Y4KM", "7N8TW", "0J9LP", "2H5QX", "4D3BV", "6F1ZG", "8P7MJ", "9K2RX",
  "0L5WV", "1T8PN", "3Q6LB", "4M7JZ", "6X3KC", "8G2FT", "2V9HR", "5N6QJ", "7B4MP", "9W1LX",
  "3G5RJ", "0Y8PN", "1L6QX", "4M3FT", "6P7KV", "8B2LW", "2N9RJ", "5D1QX", "7H4MG", "9X3FT",
  "1F8KV", "3B6LW", "0T9RJ", "4N5QX", "6J2MG", "8M7FT", "2K4WV", "5P3RJ", "7L1QX", "9D8MG",
  "0C5KV", "1N6LW", "3J9RJ", "4H7QX", "6G2MG", "8T3FT", "2F1WV", "5X4RJ", "7K8QX", "9B6MG",
  "0M2FT", "1H5KV", "3P6LW", "4J9RJ", "6N8QX", "8D3MG", "2C7FT", "5L1WV", "7G4RJ", "9T2QX",
  "1K8MG", "0B5FT", "3N6KV", "4G2LW", "6X7RJ", "8J9QX", "2P1MG", "5H4FT", "7M3KV", "9L6LW",
  "0D9RJ", "1T8QX", "3C2MG", "4K7FT", "6L1WV", "8N4RJ", "2J3QX", "5G8MG", "7D5FT", "9H6KV",
  "0X2LW", "1P9RJ", "3B8QX", "4F3MG", "6T7FT", "8K1WV", "2G4RJ", "5L2QX", "7C9MG", "9N8FT",
  "0M5KV", "1G6LW", "3J2RJ", "4T7QX", "6D1MG", "8H9FT", "2X3WV", "5P4RJ", "7B8QX", "9K6MG",
  "0F2LW", "1L9RJ", "3C8QX", "4H3MG", "6P7FT", "8G1WV", "2M4RJ", "5J2QX", "7T9MG", "9D6FT",
  "0N5KV", "1X6LW", "3F2RJ", "4K7QX", "6L1MG", "8B9FT", "2T3WV", "5G4RJ", "7N8QX", "9C6MG",
  "0M2FT", "1H5KV", "3P6LW", "4J9RJ", "6N8QX", "8D3MG", "2C7FT", "5L1WV", "7G4RJ", "9T2QX",
  "1K8MG", "0B5FT", "3N6KV", "4G2LW", "6X7RJ", "8J9QX", "2P1MG", "5H4FT", "7M3KV", "9L6LW",
  "0D9RJ", "1T8QX", "3C2MG", "4K7FT", "6L1WV", "8N4RJ", "2J3QX", "5G8MG", "7D5FT", "9H6KV",
  "0X2LW", "1P9RJ", "3B8QX", "4F3MG", "6T7FT", "8K1WV", "2G4RJ", "5L2QX", "7C9MG", "9N8FT",
  "0M5KV", "1G6LW", "3J2RJ", "4T7QX", "6D1MG", "8H9FT", "2X3WV", "5P4RJ", "7B8QX", "9K6MG",
  "0F2LW", "1L9RJ", "3C8QX", "4H3MG", "6P7FT", "8G1WV", "2M4RJ", "5J2QX", "7T9MG", "9D6FT",
  "0N5KV", "1X6LW", "3F2RJ", "4K7QX", "6L1MG", "8B9FT", "2T3WV", "5G4RJ", "7N8QX", "9C6MG"
]



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
