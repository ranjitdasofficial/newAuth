import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsEnum, IsArray, IsBoolean } from 'class-validator';
import { StudyMaterialType, StudyMaterialCategory } from '@prisma/client';

export class CreateStudyMaterialDto {
  @ApiProperty({ description: 'Title of the study material' })
  @IsString()
  title: string;

  @ApiProperty({ description: 'Description of the study material', required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'Type of study material', enum: StudyMaterialType })
  @IsEnum(StudyMaterialType)
  type: StudyMaterialType;

  @ApiProperty({ description: 'Category of study material', enum: StudyMaterialCategory })
  @IsEnum(StudyMaterialCategory)
  category: StudyMaterialCategory;

  @ApiProperty({ description: 'URL of the study material file' })
  @IsString()
  url: string;

  @ApiProperty({ description: 'File size', required: false })
  @IsOptional()
  @IsString()
  size?: string;

  @ApiProperty({ description: 'Whether the material is featured', required: false })
  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  @ApiProperty({ description: 'Tags for the study material', type: [String], required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiProperty({ description: 'Company ID this material belongs to' })
  @IsString()
  companyId: string;

  @ApiProperty({ description: 'Status of the study material', required: false })
  @IsOptional()
  @IsString()
  status?: 'ACTIVE' | 'INACTIVE';
} 