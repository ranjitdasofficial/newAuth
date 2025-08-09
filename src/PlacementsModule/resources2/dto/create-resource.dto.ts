import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsEnum, IsOptional, IsArray, IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';
import { ResourceType, ResourceCategory } from '@prisma/client';

export class CreateResourceDto {
  @ApiProperty({ example: 'System Design Interview Guide' })
  @IsString()
  title: string;

  @ApiPropertyOptional({ example: 'Comprehensive guide for system design interviews' })
  @IsOptional()
  @IsString() 
  description?: string; 

  @ApiProperty({ enum: ResourceType, example: ResourceType.PDF })
  @IsEnum(ResourceType)
  type: ResourceType;

  @ApiProperty({ enum: ResourceCategory, example: ResourceCategory.SYSTEM_DESIGN })
  @IsEnum(ResourceCategory)
  category: ResourceCategory;

  @ApiPropertyOptional({ example: 'https://example.com/resource.pdf' })
  @IsOptional()
  @IsString()
  url?: string;

  @ApiPropertyOptional({ example: '/uploads/resource.pdf' })
  @IsOptional()
  @IsString()
  filePath?: string;

  @ApiPropertyOptional({ example: '2.5 MB' })
  @IsOptional()
  @IsString()
  size?: string;

  @ApiPropertyOptional({ example: ['system-design', 'interview', 'guide'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  @ApiPropertyOptional({ example: 'user123' })
  @IsOptional()
  @IsString()
  uploadedBy?: string;

  @ApiPropertyOptional({ example: 'company123' })
  @IsOptional()
  @IsString()
  companyId?: string;

  @ApiPropertyOptional({ example: 'random.pdf' })
  @IsOptional()
  @IsString()
  fileName?: string;

   @ApiPropertyOptional({ example: 'ACTIVE' })
  @IsOptional()
  @IsString()
  status?: string;
} 