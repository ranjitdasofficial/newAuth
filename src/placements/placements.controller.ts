import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { PlacementsService } from './placements.service';
import { data } from 'cheerio/lib/api/attributes';

@Controller('placements')
export class PlacementsController {
  constructor(private readonly placementsService: PlacementsService) {}

  @Post('createCompany')
  async createCompany(
    @Body()
    data: {
      companyName: string;
      companyLogo?: string;
      companyDesc?: string;
      companyUrl?: string;
    },
  ) {
    return this.placementsService.createCompany(data);
  }

  @Get('getPlacementsDetails/:year')
  async getPlacementsDetails(@Param('year') year: number) {
    return this.placementsService.getPlacementsDetails(year);
  }

  @Get('getCompanies')
  async getCompanies() {
    return this.placementsService.getCompanies();
  }

  @Post('createMaterial')
  async createMaterial(
    @Body()
    data: {
      companyId: string;
      name: string;
      type: string;
      fileId: string;
    },
  ) {
    return this.placementsService.createMaterial(data);
  }

  @Get('getCompanyById/:companyId')
  async getCompanyById(@Param('companyId') companyId: string) {
    return this.placementsService.getCompanyById(companyId);
  }
}
