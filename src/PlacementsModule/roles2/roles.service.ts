import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { Role, Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma.service';

@Injectable()
export class RolesService {
  constructor(private prisma: PrismaService) {}

  async create(createRoleDto: CreateRoleDto): Promise<Role> {
    const { eligibility, ...rest } = createRoleDto;
    
    return this.prisma.role.create({
      data: {
        ...rest,
        eligibility: eligibility ? JSON.parse(JSON.stringify(eligibility)) : null,
      },
      include: {
        company: true,
      },
    });
  }

  async findAll(query?: {
    page?: number;
    limit?: number;
    search?: string;
    companyId?: string;
    status?: string;
  }): Promise<{ roles: Role[]; total: number }> {
    const { page = 1, limit = 10, search, companyId, status } = query || {};
    const skip = (page - 1) * limit;

    const where: Prisma.RoleWhereInput = {};

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { location: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (companyId) {
      where.companyId = companyId;
    }

    if (status) {
      where.status = status;
    }

    const [roles, total] = await Promise.all([
      this.prisma.role.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          company: true,
        },
      }),
      this.prisma.role.count({ where }),
    ]);

    return { roles, total };
  }

  async findOne(id: string): Promise<Role> {
    const role = await this.prisma.role.findUnique({
      where: { id },
      include: {
        company: true,
      },
    });

    if (!role) {
      throw new NotFoundException(`Role with ID ${id} not found`);
    }

    return role;
  }

  async update(id: string, updateRoleDto: UpdateRoleDto): Promise<Role> {
    try {
      const { eligibility, ...rest } = updateRoleDto;
      
      return await this.prisma.role.update({
        where: { id },
        data: {
          ...rest,
          ...(eligibility && { eligibility: JSON.parse(JSON.stringify(eligibility)) }),
        },
        include: {
          company: true,
        },
      });
    } catch (error) {
      if (error.code === 'P2025') {
        throw new NotFoundException(`Role with ID ${id} not found`);
      }
      throw error;
    }
  }

  async remove(id: string): Promise<Role> {
    try {
      return await this.prisma.role.delete({
        where: { id },
      });
    } catch (error) {
      if (error.code === 'P2025') {
        throw new NotFoundException(`Role with ID ${id} not found`);
      }
      throw error;
    }
  }

  async findByCompany(companyId: string): Promise<Role[]> {
    return this.prisma.role.findMany({
      where: { companyId },
      include: {
        company: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getStats(): Promise<{
    total: number;
    active: number;
    inactive: number;
    companies: string[];
  }> {
    const [total, active, inactive, companies] = await Promise.all([
      this.prisma.role.count(),
      this.prisma.role.count({ where: { status: 'ACTIVE' } }),
      this.prisma.role.count({ where: { status: 'INACTIVE' } }),
      this.prisma.role.findMany({
        select: { companyId: true },
        distinct: ['companyId'],
      }),
    ]);

    return {
      total,
      active,
      inactive,
      companies: companies.map(c => c.companyId),
    };
  }
} 