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



  async createCompany(data:{
    name: string;
    description: string;
    logo: string;
    website: string;
    tagline: string;
    students: number;
    firstVisit: number;    
  }) {
    try {
      const generateSlug = data.name.toLowerCase().replace(/[^\w ]+/g, '').replace(/ +/g, '-');
      return await this.prisma.company.create({
        data: {...data,slug:generateSlug}
      });
    } catch (error) {
      throw new InternalServerErrorException(error);
    }

  }



  // year      String
  // iscompleted Boolean  @default(false)
  // totalStudentsApplied Int?
  // totalStudentsPlaced  Int?
  // highestPackage       Int?
  // averagePackage       Int?
  // lowestPackage        Int?

  async createYealyPlacements(data:{
    year: string;
    companyId: string;
    iscompleted: boolean;
    totalStudentsApplied: number;
    totalStudentsPlaced: number;
    highestPackage: number;
    averagePackage: number;
    lowestPackage: number;
  }) {
    try {
      return await this.prisma.yearlyPlacement.create({
        data: {
          ...data,
          companyId: data.companyId
        }
      });
    } catch (error) {
      console.log(error);
      throw new InternalServerErrorException(error);
    }

  }


  async getCompanies() {
    return await this.prisma.company.findMany({
      include:{
        yearlyPlacements:true
      }
    });
  }



  // model ExamPattern {
  //   id          String   @id @default(auto()) @map("_id") @db.ObjectId
  //   round       String?
  //   duration    String?
  //   description String?
  //   company     Company  @relation(fields: [companyId], references: [id], onDelete: Cascade)
  //   companyId   String   @db.ObjectId
  //   createdAt   DateTime @default(now())
  //   updatedAt   DateTime @updatedAt
  // }

  async addExamPatternToCompany(
    companyId: string,
    data:{
      round: string;
      duration: string;
      description: string;
    
  }[]) {
    try {
      return await this.prisma.company.update({
        where: {
          id: companyId
        },
        data: {
         examPattern: {
             push: data
         }
        }
      });
    } catch (error) {
      console.log(error)
      throw new InternalServerErrorException(error);
    }
  }


  // type CommonQuestions{
  //   id          String   @default(uuid())
  //   question   String
  //   answer     String
  // }
  
  // type CommonQuestion {
  //   id          String   @default(cuid()) 
  //   round       String?
  //   questions   CommonQuestions[]
  //   createdAt   DateTime @default(now())
  // }
  


  async addCommonQuestionsToCompany(
    companyId: string,
    data:{
      round: string;
       questions: {
        question: string;
        answer: string;
      }[]
    }[]) {
    try {
      return await this.prisma.company.update({
        where: {
          id: companyId
        },
        data: {
         commonQuestions: {
             push: data
         }
        }
      });
    } catch (error) {
      console.log(error)
      throw new InternalServerErrorException(error);
    }
  }
   

  async addShortlistingInfoToCompany(
    companyId: string,
    data:{
      shortlisted: number;
      criteriaPoints: string[];
      total: number;
    }) {  
    try {
      return await this.prisma.company.update({
        where: {
          id: companyId
        },
        data: {
         shortlistingInfo:data
        }
      });
    } catch (error) {
      console.log(error)
      throw new InternalServerErrorException(error);
    }
  }


  async addPlacementInfo(
    yearlyPlacements:{
      year: string
      iscompleted: boolean
      totalStudentsApplied: number
      totalStudentsPlaced: number
      highestPackage: number
      averagePackage: number
      lowestPackage: number
    }[],


    data:{
    examPattern: {
      round: string
      duration: string
      description: string,
      focusAreas: string[]
    }[]
    commonQuestions: {
      round: string
      questions: {
        id: string
        question: string
        answer: any
      }[]
    }[]
    shortlistingInfo: {
      total: number
      shortlisted: number
      criteriaPoints: string[]
    },
   
    name: string
    logo: string
    description: string
    tagline: string
    website: string
    students: number
    firstVisit: number
  }
){
  try {
  const company = await this.prisma.company.create({
    data: {
      ...data,
      yearlyPlacements:{
        createMany: {
          data: yearlyPlacements
        }
      },
      slug: data.name.toLowerCase().replace(/[^\w ]+/g, '').replace(/ +/g, '-')
    }
  });
    return company;
  } catch (error) {
    console.log(error);
    throw new InternalServerErrorException(error);
  }
}


async getCompanyBySlug(slug: string) {
  try {
    return await this.prisma.company.findUnique({
      where: {
        slug
      },
      include: {
        yearlyPlacements: true,
      }
    });
  } catch (error) {
    console.log(error);
    throw new InternalServerErrorException(error);
  }

}


async deleteCompanyById(companyId: string) {
  try {
    return await this.prisma.company.delete({
      where: {
        id: companyId
      }
    });
  } catch (error) {
    console.log(error);
    throw new InternalServerErrorException(error);
  }
}

}
