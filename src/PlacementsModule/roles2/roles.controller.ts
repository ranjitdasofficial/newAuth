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
import { RolesService } from './roles.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { Role } from '@prisma/client';
import { ApiResponseDto } from '../../common/dto/api-response.dto';

@ApiTags('roles')
@Controller('roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new role' })
  @ApiResponse({ status: 201, description: 'Role created successfully' })
  async create(@Body() createRoleDto: CreateRoleDto): Promise<ApiResponseDto<Role>> {
    const role = await this.rolesService.create(createRoleDto);
    return new ApiResponseDto(true, 'Role created successfully', role);
  }

  @Get()
  @ApiOperation({ summary: 'Get all roles with pagination and filters' })
  @ApiResponse({ status: 200, description: 'Roles retrieved successfully' })
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('companyId') companyId?: string,
    @Query('status') status?: string,
  ): Promise<ApiResponseDto<{ roles: Role[]; total: number }>> {
    const result = await this.rolesService.findAll({
      page: page ? parseInt(page) : undefined,
      limit: limit ? parseInt(limit) : undefined,
      search,
      companyId,
      status,
    });
    return new ApiResponseDto(true, 'Roles retrieved successfully', result);
  }

  @Get('company/:companyId')
  @ApiOperation({ summary: 'Get roles by company' })
  @ApiResponse({ status: 200, description: 'Roles by company retrieved successfully' })
  async findByCompany(@Param('companyId') companyId: string): Promise<ApiResponseDto<Role[]>> {
    const roles = await this.rolesService.findByCompany(companyId);
    return new ApiResponseDto(true, 'Roles by company retrieved successfully', roles);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get role statistics' })
  @ApiResponse({ status: 200, description: 'Role stats retrieved successfully' })
  async getStats(): Promise<ApiResponseDto<any>> {
    const stats = await this.rolesService.getStats();
    return new ApiResponseDto(true, 'Role stats retrieved successfully', stats);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a role by ID' })
  @ApiResponse({ status: 200, description: 'Role retrieved successfully' })
  async findOne(@Param('id') id: string): Promise<ApiResponseDto<Role>> {
    const role = await this.rolesService.findOne(id);
    return new ApiResponseDto(true, 'Role retrieved successfully', role);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a role' })
  @ApiResponse({ status: 200, description: 'Role updated successfully' })
  async update(
    @Param('id') id: string,
    @Body() updateRoleDto: UpdateRoleDto,
  ): Promise<ApiResponseDto<Role>> {
    const role = await this.rolesService.update(id, updateRoleDto);
    return new ApiResponseDto(true, 'Role updated successfully', role);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a role' })
  @ApiResponse({ status: 200, description: 'Role deleted successfully' })
  async remove(@Param('id') id: string): Promise<ApiResponseDto<Role>> {
    const role = await this.rolesService.remove(id);
    return new ApiResponseDto(true, 'Role deleted successfully', role);
  }
} 