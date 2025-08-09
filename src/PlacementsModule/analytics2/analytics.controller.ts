import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ApiResponseDto } from '../../common/dto/api-response.dto';
import { AnalyticsService } from './analytics.service';

@ApiTags('analytics')
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('dashboard-stats')
  @ApiOperation({ summary: 'Get dashboard statistics' })
  @ApiResponse({ status: 200, description: 'Dashboard statistics retrieved successfully' })
  async getDashboardStats() {
    const stats = await this.analyticsService.getDashboardStats();
    return new ApiResponseDto(true, 'Dashboard statistics retrieved successfully', stats);
  }

  @Get('recent-companies')
  @ApiOperation({ summary: 'Get recent companies for dashboard' })
  @ApiResponse({ status: 200, description: 'Recent companies retrieved successfully' })
  async getRecentCompanies() {
    const companies = await this.analyticsService.getRecentCompanies();
    return new ApiResponseDto(true, 'Recent companies retrieved successfully', companies);
  }
} 