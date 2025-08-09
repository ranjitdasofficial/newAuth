import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { ApiResponseDto } from '../../common/dto/api-response.dto';
import { TimelineService, TimelineData } from './timeline.service';

@ApiTags('timeline')
@Controller('timeline')
export class TimelineController {
  constructor(private readonly timelineService: TimelineService) {}

  @Get()
  @ApiOperation({ summary: 'Get placement timeline data' })
  @ApiResponse({ status: 200, description: 'Timeline data retrieved successfully' })
  @ApiQuery({ name: 'year', required: false, description: 'Filter by specific year' })
  @ApiQuery({ name: 'domain', required: false, description: 'Filter by company domain' })
  async getTimelineData(
    @Query('year') year?: string,
    @Query('domain') domain?: string,
  ): Promise<ApiResponseDto<TimelineData[]>> {
    const timelineData = await this.timelineService.getTimelineData(year, domain);
    return new ApiResponseDto(true, 'Timeline data retrieved successfully', timelineData);
  }

  @Get('company-visits')
  @ApiOperation({ summary: 'Get company visit timeline' })
  @ApiResponse({ status: 200, description: 'Company visit timeline retrieved successfully' })
  @ApiQuery({ name: 'year', required: false, description: 'Filter by specific year' })
  async getCompanyVisits(@Query('year') year?: string) {
    const visits = await this.timelineService.getCompanyVisits(year);
    return new ApiResponseDto(true, 'Company visit timeline retrieved successfully', visits);
  }

  @Get('placement-statistics')
  @ApiOperation({ summary: 'Get placement statistics by year' })
  @ApiResponse({ status: 200, description: 'Placement statistics retrieved successfully' })
  async getPlacementStatistics() {
    const statistics = await this.timelineService.getPlacementStatistics();
    return new ApiResponseDto(true, 'Placement statistics retrieved successfully', statistics);
  }

  @Get('domain-wise-statistics')
  @ApiOperation({ summary: 'Get domain-wise placement statistics' })
  @ApiResponse({ status: 200, description: 'Domain-wise statistics retrieved successfully' })
  async getDomainWiseStatistics() {
    const statistics = await this.timelineService.getDomainWiseStatistics();
    return new ApiResponseDto(true, 'Domain-wise statistics retrieved successfully', statistics);
  }
}