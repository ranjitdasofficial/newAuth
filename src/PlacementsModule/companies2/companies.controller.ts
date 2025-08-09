import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { CompaniesService } from './companies.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { Company, PlacementCompany } from '@prisma/client';
import { ApiResponseDto } from '../../common/dto/api-response.dto';

@ApiTags('companies')
@Controller('companies')
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new company' })
  @ApiResponse({ status: 201, description: 'Company created successfully' })
  async create(@Body() createCompanyDto: CreateCompanyDto): Promise<ApiResponseDto<PlacementCompany>> {
    const company = await this.companiesService.create(createCompanyDto);
    return new ApiResponseDto(true, 'Company created successfully', company);
  }

  @Delete('/deleteAll')
  @ApiOperation({ summary: 'Delete all companies' })
  @ApiResponse({ status: 200, description: 'All companies deleted successfully' })
  async deleteAll(): Promise<ApiResponseDto<void>> {
    await this.companiesService.deleteAllCompanies();
    return new ApiResponseDto(true, 'All companies deleted successfully', null);
  }

  @Get()
  @ApiOperation({ summary: 'Get all companies with pagination and filters' })
  @ApiResponse({ status: 200, description: 'Companies retrieved successfully' })
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('domain') domain?: string,
    @Query('status') status?: string,
    @Query('isFeatured') isFeatured?: string,
  ): Promise<ApiResponseDto<{ companies: PlacementCompany[]; total: number }>> {
    const result = await this.companiesService.findAll({
      page: page ? parseInt(page) : undefined,
      limit: limit ? parseInt(limit) : undefined,
      search,
      domain,
      status,
      isFeatured: isFeatured ? isFeatured === 'true' : undefined,
    });
    return new ApiResponseDto(true, 'Companies retrieved successfully', result);
  }

  @Get('featured')
  @ApiOperation({ summary: 'Get featured companies' })
  @ApiResponse({ status: 200, description: 'Featured companies retrieved successfully' })
  async findFeatured(): Promise<ApiResponseDto<PlacementCompany[]>> {
    const companies = await this.companiesService.findFeatured();
    return new ApiResponseDto(true, 'Featured companies retrieved successfully', companies);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get company statistics' })
  @ApiResponse({ status: 200, description: 'Company stats retrieved successfully' })
  async getStats(): Promise<ApiResponseDto<any>> {
    const stats = await this.companiesService.getStats();
    return new ApiResponseDto(true, 'Company stats retrieved successfully', stats);
  }

  @Get('domain/:domain')
  @ApiOperation({ summary: 'Get companies by domain' })
  @ApiResponse({ status: 200, description: 'Companies by domain retrieved successfully' })
  async findByDomain(@Param('domain') domain: string): Promise<ApiResponseDto<PlacementCompany[]>> {
    const companies = await this.companiesService.findByDomain(domain);
    return new ApiResponseDto(true, 'Companies by domain retrieved successfully', companies);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a company by ID' })
  @ApiResponse({ status: 200, description: 'Company retrieved successfully' })
  async findOne(@Param('id') id: string): Promise<ApiResponseDto<PlacementCompany>> {
    const company = await this.companiesService.findOne(id);
    return new ApiResponseDto(true, 'Company retrieved successfully', company);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a company' })
  @ApiResponse({ status: 200, description: 'Company updated successfully' })
  async update(
    @Param('id') id: string,
    @Body() updateCompanyDto: UpdateCompanyDto,
  ): Promise<ApiResponseDto<PlacementCompany>> {
    const company = await this.companiesService.update(id, updateCompanyDto);
    return new ApiResponseDto(true, 'Company updated successfully', company);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a company' })
  @ApiResponse({ status: 200, description: 'Company deleted successfully' })
  async remove(@Param('id') id: string): Promise<ApiResponseDto<PlacementCompany>> {
    const company = await this.companiesService.remove(id);
    return new ApiResponseDto(true, 'Company deleted successfully', company);
  }


} 