import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateResourceDto } from './dto/create-resource.dto';
import { UpdateResourceDto } from './dto/update-resource.dto';
import { Resource, Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma.service';

@Injectable()
export class ResourcesService {
  constructor(private prisma: PrismaService) {}

  async create(createResourceDto: CreateResourceDto): Promise<Resource> {
    return this.prisma.resource.create({
      data: createResourceDto,
      include: {
        company: true,
      },
    });
  }

  async findAll(query?: {
    page?: number;
    limit?: number;
    search?: string;
    type?: string;
    category?: string;
    companyId?: string;
    isFeatured?: boolean;
  }): Promise<{ resources: Resource[]; total: number }> {
    const { page = 1, limit = 10, search, type, category, companyId, isFeatured } = query || {};
    const skip = (page - 1) * limit;

    const where: Prisma.ResourceWhereInput = {};

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { tags: { hasSome: [search] } },
      ];
    }

    if (type) {
      where.type = type as any;
    }

    if (category) {
      where.category = category as any;
    }

    if (companyId) {
      where.companyId = companyId;
    }

    if (isFeatured !== undefined) {
      where.isFeatured = isFeatured;
    }

    const [resources, total] = await Promise.all([
      this.prisma.resource.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          company: true,
        },
      }),
      this.prisma.resource.count({ where }),
    ]);

    return { resources, total };
  }

  async findOne(id: string): Promise<Resource> {
    const resource = await this.prisma.resource.findUnique({
      where: { id },
      include: {
        company: true,
      },
    });

    if (!resource) {
      throw new NotFoundException(`Resource with ID ${id} not found`);
    }

    return resource;
  }

  async update(id: string, updateResourceDto: UpdateResourceDto): Promise<Resource> {
    try {
      return await this.prisma.resource.update({
        where: { id },
        data: updateResourceDto,
        include: {
          company: true,
        },
      });
    } catch (error) {
      if (error.code === 'P2025') {
        throw new NotFoundException(`Resource with ID ${id} not found`);
      }
      throw error;
    }
  }

  async remove(id: string): Promise<Resource> {
    try {
      return await this.prisma.resource.delete({
        where: { id },
      });
    } catch (error) {
      if (error.code === 'P2025') {
        throw new NotFoundException(`Resource with ID ${id} not found`);
      }
      throw error;
    }
  }

  async findByCompany(companyId: string): Promise<Resource[]> {
    return this.prisma.resource.findMany({
      where: { companyId },
      include: {
        company: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findFeatured(): Promise<Resource[]> {
    return this.prisma.resource.findMany({
      where: { isFeatured: true },
      include: {
        company: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async incrementDownloadCount(id: string): Promise<Resource> {
    return this.prisma.resource.update({
      where: { id },
      data: {
        downloadCount: {
          increment: 1,
        },
      },
    });
  }

  async getStats(): Promise<{
    total: number;
    featured: number;
    types: Record<string, number>;
    categories: Record<string, number>;
  }> {
    const [total, featured, types, categories] = await Promise.all([
      this.prisma.resource.count(),
      this.prisma.resource.count({ where: { isFeatured: true } }),
      this.prisma.resource.groupBy({
        by: ['type'],
        _count: { type: true },
      }),
      this.prisma.resource.groupBy({
        by: ['category'],
        _count: { category: true },
      }),
    ]);

    return {
      total,
      featured,
      types: types.reduce((acc, item) => {
        acc[item.type] = item._count.type;
        return acc;
      }, {} as Record<string, number>),
      categories: categories.reduce((acc, item) => {
        acc[item.category] = item._count.category;
        return acc;
      }, {} as Record<string, number>),
    };
  }

  async getTotalResources(): Promise<number> {
    return this.prisma.resource.count();
  }

  async getTotalDownloads(): Promise<number> {
    const result = await this.prisma.resource.aggregate({
      _sum: {
        downloadCount: true,
      },
    });
    return result._sum.downloadCount || 0;
  }
} 