import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';

@Injectable()
export class PlacementsService {
  constructor(private readonly prisma: PrismaService) {}

  async createCompany(data: {
    companyName: string;
    companyLogo?: string;
    companyDesc?: string;
    companyUrl?: string;
  }) {
    try {
      return await this.prisma.company.create({
        data,
      });
    } catch (error) {
      console.log(error);
      throw new InternalServerErrorException('Internal Server Error');
    }
  }

  async getPlacementsDetails(year:number){
    try {
      const company = await this.prisma.placements.findUnique({
        where:{
          year:year
        },
        include:{
          Company:{
            select:{
              companyName:true,
              companyLogo:true,
              id:true
            }
          }
        }
      });

      if(!company){
        throw new NotFoundException('Record Not Found');
      }

      return company;
      
    } catch (error) {
      
    }
  }

  async getCompanies() {
    try {
      return await this.prisma.company.findMany({
        select: {
          companyName: true,
          companyLogo: true,
          id: true,
        },
      });
    } catch (error) {
      console.log(error);
      throw new InternalServerErrorException('Internal Server Error');
    }
  }

  async createMaterial(data: {
    companyId: string;
    name: string;
    type: string;
    fileId: string;
  }) {
    try {
      return await this.prisma.placmentMaterials.create({
        data: data,
      });
    } catch (error) {
      console.log(error);
      throw new InternalServerErrorException('Internal Server Error');
    }
  }

  async getCompanyById(companyId: string) {
    try {
      return await this.prisma.company.findUnique({
        where: {
          id: companyId,
        },
        include: {
          placementMaterials: {
            select: {
              id: true,
              fileId: true,
              name: true,
              type: true,
            },
          },
        },
      });
    } catch (error) {
      console.log(error);
      throw new InternalServerErrorException('Internal Server Error');
    }
  }

  async createPlacementRecord(data: {
    year: number;
    highestPackage: number;
    noOfCompaniesVisited: number;
    noOfJobOffered: number;
    extraInfo: string;
  }) {
    try {
      const record = await this.prisma.placements.findFirst({
        where: {
          year: data.year,
        },
      });

      if (record) {
        throw new InternalServerErrorException('Record Already Exists');
      }

      return await this.prisma.placements.create({
        data: data,
      });
    } catch (error) {
      console.log(error);
      throw new InternalServerErrorException('Internal Server Error');
    }
  }

  async getPlacementRecords() {
    try {
      return await this.prisma.placements.findMany({
        orderBy: {
          year: 'desc',
        },
      });
    } catch (error) {
      console.log(error);
      throw new InternalServerErrorException('Internal Server Error');
    }
  }

  async addCompanyToPlacement(data: {
    companyId: string;
    placementId: string;
  }) {
    try {
      const record = await this.prisma.placements.findFirst({
        where: {
          id: data.placementId,
        },
      });

      if (!record) {
        throw new NotFoundException('Record Not Found');
      }

      if (record.companyId.includes(data.companyId)) {
        throw new ConflictException('Company Already Added');
      }

      return await this.prisma.placements.update({
        where: {
          id: data.placementId,
        },
        data: {
          Company: {
            connect: {
              id: data.companyId,
            },
          },
        },
      });
    } catch (error) {
      console.log(error);
      if (
        error instanceof NotFoundException ||
        error instanceof ConflictException
      ) {
        throw error;
      }

      throw new InternalServerErrorException('Internal Server Error');
    }
  }

  async removeCompanyFromPlacement(data: {
    companyId: string;
    placementId: string;
  }) {
    try {
      const record = await this.prisma.placements.findFirst({
        where: {
          id: data.placementId,
        },
      });

      if (!record) {
        throw new NotFoundException('Record Not Found');
      }

      if (!record.companyId.includes(data.companyId)) {
        throw new ConflictException('Company Not Added');
      }

      return await this.prisma.placements.update({
        where: {
          id: data.placementId,
        },
        data: {
          Company: {
            disconnect: {
              id: data.companyId,
            },
          },
        },
      });
    } catch (error) {
      console.log(error);
      if (
        error instanceof NotFoundException ||
        error instanceof ConflictException
      ) {
        throw error;
      }

      throw new InternalServerErrorException('Internal Server Error');
    }
  }
}
