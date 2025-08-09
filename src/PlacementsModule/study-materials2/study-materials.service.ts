import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateStudyMaterialDto } from './dto/create-study-material.dto';
import { UpdateStudyMaterialDto } from './dto/update-study-material.dto';
import { StudyMaterial, Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma.service';

@Injectable()
export class StudyMaterialsService {
  constructor(private prisma: PrismaService) {}

  async create(createStudyMaterialDto: CreateStudyMaterialDto): Promise<StudyMaterial> {
    return this.prisma.studyMaterial.create({
      data: createStudyMaterialDto,
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
  }): Promise<{ studyMaterials: StudyMaterial[]; total: number }> {
    const { page = 1, limit = 10, search, type, category, companyId, isFeatured } = query || {};
    const skip = (page - 1) * limit;

    const where: Prisma.StudyMaterialWhereInput = {};

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

    const [studyMaterials, total] = await Promise.all([
      this.prisma.studyMaterial.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          company: true,
        },
      }),
      this.prisma.studyMaterial.count({ where }),
    ]);

    return { studyMaterials, total };
  }

  async findOne(id: string): Promise<StudyMaterial> {
    const studyMaterial = await this.prisma.studyMaterial.findUnique({
      where: { id },
      include: {
        company: true,
      },
    });

    if (!studyMaterial) {
      throw new NotFoundException(`Study material with ID ${id} not found`);
    }

    return studyMaterial;
  }

  async update(id: string, updateStudyMaterialDto: UpdateStudyMaterialDto): Promise<StudyMaterial> {
    try {
      return await this.prisma.studyMaterial.update({
        where: { id },
        data: updateStudyMaterialDto,
        include: {
          company: true,
        },
      });
    } catch (error) {
      if (error.code === 'P2025') {
        throw new NotFoundException(`Study material with ID ${id} not found`);
      }
      throw error;
    }
  }

  async remove(id: string): Promise<StudyMaterial> {
    try {
      return await this.prisma.studyMaterial.delete({
        where: { id },
      });
    } catch (error) {
      if (error.code === 'P2025') {
        throw new NotFoundException(`Study material with ID ${id} not found`);
      }
      throw error;
    }
  }

  async findByCompany(companyId: string): Promise<StudyMaterial[]> {
    return this.prisma.studyMaterial.findMany({
      where: { companyId },
      include: {
        company: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findFeatured(): Promise<StudyMaterial[]> {
    return this.prisma.studyMaterial.findMany({
      where: { isFeatured: true },
      include: {
        company: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async incrementDownloadCount(id: string): Promise<StudyMaterial> {
    return this.prisma.studyMaterial.update({
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
      this.prisma.studyMaterial.count(),
      this.prisma.studyMaterial.count({ where: { isFeatured: true } }),
      this.prisma.studyMaterial.groupBy({
        by: ['type'],
        _count: { type: true },
      }),
      this.prisma.studyMaterial.groupBy({
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
} 