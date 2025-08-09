import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { ResourcesService } from '../resources2/resources.service';

@Injectable()
export class AnalyticsService {
  constructor(
    private prisma: PrismaService,
    private resourcesService: ResourcesService,
  ) {}

  async getDashboardStats() {
    const totalCompanies = await this.prisma.placementCompany.count({
      where: { status: 'ACTIVE' }
    });
    
    const featuredCompanies = await this.prisma.placementCompany.count({
      where: { isFeatured: true, status: 'ACTIVE' }
    });

    const recentCompanies = await this.prisma.placementCompany.count({
      where: {
        createdAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
        }
      }
    });

    // Get real resource data
    const [totalResources, totalDownloads] = await Promise.all([
      this.resourcesService.getTotalResources(),
      this.resourcesService.getTotalDownloads(),
    ]);

    const recentVisits = 8; // Mock data for now

    return {
      totalCompanies,
      featuredCompanies,
      recentCompanies,
      totalResources,
      totalDownloads,
      recentVisits,
      trends: {
        companiesGrowth: '+12% this year',
        resourcesGrowth: '+8 this month',
        downloadsGrowth: '+23% this month',
        visitsGrowth: '+4 this month'
      }
    };
  }

  async getRecentCompanies() {
    const companies = await this.prisma.placementCompany.findMany({
      where: { status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' },
      take: 4,
      select: {
        id: true,
        name: true,
        domain: true,
        tags: true,
        createdAt: true,
        companyRoles: true,
        kiitPlacementData: true,
      }
    });

    return companies.map(company => {
      const roles = company.companyRoles as any[] || [];
      const kiitData = company.kiitPlacementData as any || {};
      
      return {
        id: company.id,
        name: company.name,
        logo: '🏢', // Default logo
        domain: company.domain,
        role: roles[0]?.title || 'Multiple Roles',
        ctcRange: roles[0]?.ctcRange || 'Not specified',
        cgpaRequired: kiitData?.eligibility?.minCGPA ? 
          `${kiitData.eligibility.minCGPA}+` : 'Not specified',
        tags: company.tags || [],
        lastVisited: new Date(company.createdAt).getFullYear().toString(),
        mode: 'On-campus',
        createdAt: company.createdAt
      };
    });
  }
} 