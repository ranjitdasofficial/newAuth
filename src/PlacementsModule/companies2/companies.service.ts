import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { Company, PlacementCompany, Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma.service';

@Injectable()
export class CompaniesService {
  constructor(private prisma: PrismaService) {}

  async create(createCompanyDto: CreateCompanyDto): Promise<PlacementCompany> {
    const { kiitPlacementData, selectionProcess, roles, studyMaterials, ...rest } = createCompanyDto;

    return this.prisma.placementCompany.create({
      data: {
        ...rest,
        kiitPlacementData: kiitPlacementData ? JSON.parse(JSON.stringify(kiitPlacementData)) : null,
        selectionProcess: selectionProcess ? JSON.parse(JSON.stringify(selectionProcess)) : null,
      },
    });
  }

  async findAll(query?: {
    page?: number;
    limit?: number;
    search?: string;
    domain?: string;
    status?: string;
    isFeatured?: boolean;
  }): Promise<{ companies: PlacementCompany[]; total: number }> {
    const { page = 1, limit = 10, search, domain, status, isFeatured } = query || {};
    const skip = (page - 1) * limit;

    const where: Prisma.PlacementCompanyWhereInput = {};


    

    if (search && search.trim() !== '') {
      // Try with mode: 'insensitive' first, if it doesn't work, we'll use regex
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { domain: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (domain) {
      where.domain = domain;
    }

    if (status) {
      where.status = status as any;
    }

    if (isFeatured !== undefined && isFeatured !== null) {
      where.isFeatured = isFeatured;
    }




    console.log('findAll query params:', { page, limit, search, domain, status, isFeatured });
    console.log('where clause:', JSON.stringify(where, null, 2));
    
    const [companies, total] = await Promise.all([
      this.prisma.placementCompany.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.placementCompany.count({ where }),
    ]);

    console.log('Found companies:', companies.length, 'Total:', total);
    return { companies, total };
  }

  async findOne(id: string): Promise<PlacementCompany> {
    const company = await this.prisma.placementCompany.findUnique({
      where: { id },
      include: {
        companyRoles: true,
        companyResources: true,
        companyStudyMaterials: true,
      },
    });

    console.log("company", company)

    if (!company) {
      throw new NotFoundException(`Company with ID ${id} not found`);
    }

    return company;
  }


  async deleteAllCompanies(): Promise<void> {
    //also delete all roles, resources, study materials
    await this.prisma.role.deleteMany();
    await this.prisma.resource.deleteMany();
    await this.prisma.studyMaterial.deleteMany();
    await this.prisma.company.deleteMany();
  }

  async update(id: string, updateCompanyDto: UpdateCompanyDto): Promise<PlacementCompany> {
    try {
      const { kiitPlacementData, selectionProcess, roles, studyMaterials, ...rest } = updateCompanyDto;

      return await this.prisma.placementCompany.update({
        where: { id },
        data: { 
          ...rest,
          ...(kiitPlacementData && { kiitPlacementData: JSON.parse(JSON.stringify(kiitPlacementData)) }),
          ...(selectionProcess && { selectionProcess: JSON.parse(JSON.stringify(selectionProcess)) }),
          ...(roles && { roles: roles.map(role => JSON.parse(JSON.stringify(role))) }),
          ...(studyMaterials && { studyMaterials: studyMaterials.map(material => JSON.parse(JSON.stringify(material))) }),
        },
      });
    } catch (error) {
      if (error.code === 'P2025') {
        throw new NotFoundException(`Company with ID ${id} not found`);
      }
      throw error;
    }
  }

  async remove(id: string): Promise<PlacementCompany> {
    try {
      return await this.prisma.placementCompany.delete({
        where: { id },
      });
    } catch (error) {
      if (error.code === 'P2025') {
        throw new NotFoundException(`Company with ID ${id} not found`);
      }
      throw error;
    }
  }

  async findByDomain(domain: string): Promise<PlacementCompany[]> {
    return this.prisma.placementCompany.findMany({
      where: { domain },
    });
  }

  async findFeatured(): Promise<PlacementCompany[]> {
    return this.prisma.placementCompany.findMany({
      where: { isFeatured: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getStats(): Promise<{
    total: number;
    active: number;
    featured: number;
    domains: string[];
  }> {
    const [total, active, featured, domains] = await Promise.all([
      this.prisma.placementCompany.count(),
      this.prisma.placementCompany.count({ where: { status: 'ACTIVE' } }),
      this.prisma.placementCompany.count({ where: { isFeatured: true } }),
      this.prisma.placementCompany.findMany({
        select: { domain: true },
        distinct: ['domain'],
      }),
    ]);

    return {
      total,
      active,
      featured,
      domains: domains.map(d => d.domain),
    };
  }
} 