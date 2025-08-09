import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { StudyMaterialsService } from './study-materials.service';
import { CreateStudyMaterialDto } from './dto/create-study-material.dto';
import { UpdateStudyMaterialDto } from './dto/update-study-material.dto';
import { StudyMaterial } from '@prisma/client';
import { ApiResponseDto } from '../../common/dto/api-response.dto';

@ApiTags('study-materials')
@Controller('study-materials')
export class StudyMaterialsController {
  constructor(private readonly studyMaterialsService: StudyMaterialsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new study material' })
  @ApiResponse({ status: 201, description: 'Study material created successfully' })
  async create(@Body() createStudyMaterialDto: CreateStudyMaterialDto): Promise<ApiResponseDto<StudyMaterial>> {
    const studyMaterial = await this.studyMaterialsService.create(createStudyMaterialDto);
    return new ApiResponseDto(true, 'Study material created successfully', studyMaterial);
  }

  @Get()
  @ApiOperation({ summary: 'Get all study materials with pagination and filters' })
  @ApiResponse({ status: 200, description: 'Study materials retrieved successfully' })
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('type') type?: string,
    @Query('category') category?: string,
    @Query('companyId') companyId?: string,
    @Query('isFeatured') isFeatured?: string,
  ): Promise<ApiResponseDto<{ studyMaterials: StudyMaterial[]; total: number }>> {
    const result = await this.studyMaterialsService.findAll({
      page: page ? parseInt(page) : undefined,
      limit: limit ? parseInt(limit) : undefined,
      search,
      type,
      category,
      companyId,
      isFeatured: isFeatured === 'true',
    });
    return new ApiResponseDto(true, 'Study materials retrieved successfully', result);
  }

  @Get('featured')
  @ApiOperation({ summary: 'Get featured study materials' })
  @ApiResponse({ status: 200, description: 'Featured study materials retrieved successfully' })
  async findFeatured(): Promise<ApiResponseDto<StudyMaterial[]>> {
    const studyMaterials = await this.studyMaterialsService.findFeatured();
    return new ApiResponseDto(true, 'Featured study materials retrieved successfully', studyMaterials);
  }

  @Get('company/:companyId')
  @ApiOperation({ summary: 'Get study materials by company' })
  @ApiResponse({ status: 200, description: 'Study materials by company retrieved successfully' })
  async findByCompany(@Param('companyId') companyId: string): Promise<ApiResponseDto<StudyMaterial[]>> {
    const studyMaterials = await this.studyMaterialsService.findByCompany(companyId);
    return new ApiResponseDto(true, 'Study materials by company retrieved successfully', studyMaterials);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get study material statistics' })
  @ApiResponse({ status: 200, description: 'Study material stats retrieved successfully' })
  async getStats(): Promise<ApiResponseDto<any>> {
    const stats = await this.studyMaterialsService.getStats();
    return new ApiResponseDto(true, 'Study material stats retrieved successfully', stats);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a study material by ID' })
  @ApiResponse({ status: 200, description: 'Study material retrieved successfully' })
  async findOne(@Param('id') id: string): Promise<ApiResponseDto<StudyMaterial>> {
    const studyMaterial = await this.studyMaterialsService.findOne(id);
    return new ApiResponseDto(true, 'Study material retrieved successfully', studyMaterial);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a study material' })
  @ApiResponse({ status: 200, description: 'Study material updated successfully' })
  async update(
    @Param('id') id: string,
    @Body() updateStudyMaterialDto: UpdateStudyMaterialDto,
  ): Promise<ApiResponseDto<StudyMaterial>> {
    const studyMaterial = await this.studyMaterialsService.update(id, updateStudyMaterialDto);
    return new ApiResponseDto(true, 'Study material updated successfully', studyMaterial);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a study material' })
  @ApiResponse({ status: 200, description: 'Study material deleted successfully' })
  async remove(@Param('id') id: string): Promise<ApiResponseDto<StudyMaterial>> {
    const studyMaterial = await this.studyMaterialsService.remove(id);
    return new ApiResponseDto(true, 'Study material deleted successfully', studyMaterial);
  }

  @Post(':id/download')
  @ApiOperation({ summary: 'Increment download count for a study material' })
  @ApiResponse({ status: 200, description: 'Download count incremented successfully' })
  async incrementDownloadCount(@Param('id') id: string): Promise<ApiResponseDto<StudyMaterial>> {
    const studyMaterial = await this.studyMaterialsService.incrementDownloadCount(id);
    return new ApiResponseDto(true, 'Download count incremented successfully', studyMaterial);
  }
} 