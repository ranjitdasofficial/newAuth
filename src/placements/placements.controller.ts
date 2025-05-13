import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { PlacementsService } from './placements.service';
import { data } from 'cheerio/lib/api/attributes';

@Controller('placements')
export class PlacementsController {
  constructor(private readonly placementsService: PlacementsService) {}

  @Post('createCompany')
  async createCompany(@Body() data: {
    name: string;
    description: string;
    logo: string;
    website: string;
    tagline: string;
    students: number;
    firstVisit: number;
  }) {
    return this.placementsService.createCompany(data);
  }

  @Post('createYealyPlacements')
  async createYealyPlacements(@Body() data: {
    year: string;
    companyId: string;
    iscompleted: boolean;
    totalStudentsApplied: number;
    totalStudentsPlaced: number;
    highestPackage: number;
    averagePackage: number;
    lowestPackage: number;
  }) {
    return this.placementsService.createYealyPlacements(data);
  }


  @Get('getCompanies')
  async getCompanies() {
    return this.placementsService.getCompanies();
  }

  @Post("addExamPatternToCompany")
  async addExamPatternToCompany(@Body() data:{companyId: string,
  data:{
    round: string;
    duration: string;
    description: string;
  
}[]}) {
    return this.placementsService.addExamPatternToCompany(data.companyId,data.data);
  }



  @Post("addCommonQuestionsToCompany")
  async addCommonQuestionsToCompany(@Body() data:{ companyId: string,
    data:{
      round: string;
       questions: {
        question: string;
        answer: string;
      }[]
    }[]}) {
    return this.placementsService.addCommonQuestionsToCompany(data.companyId,data.data);
  }

  @Post("addShortlistingInfoToCompany")
  async addShortlistingInfoToCompany(@Body() data:{companyId: string,
    data:{
      shortlisted: number;
      criteriaPoints: string[];
      total: number;
    }}) {
    return this.placementsService.addShortlistingInfoToCompany(data.companyId,data.data);
  }



  @Post("addPlacementInfo")
  async addPlacementInfo(@Body() data:
  
  {    
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
    jobDescription: string
    location: string
    tagline: string
    website: string
    students: number
    firstVisit: number
  }}) {
    console.log(data.yearlyPlacements,data.data);
    return this.placementsService.addPlacementInfo(data.yearlyPlacements,data.data);
  }


  @Get("getPlacementBySlug/:slug")
  async getPlacementBySlug(@Param('slug') slug: string) {
    return this.placementsService.getCompanyBySlug(slug);
  }

  @Post("deleteCompanyById/:id")
  async deleteCompanyById(@Param('id') id: string) {
    return this.placementsService.deleteCompanyById(id);
  }

}
