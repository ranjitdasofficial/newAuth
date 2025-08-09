import { IsString, IsOptional, IsEnum, IsBoolean, IsArray, IsUrl, IsEmail, IsNumber, ValidateNested, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { CompanyStatus } from '@prisma/client';

export class YearwiseDataDto {
  @ApiProperty({ example: 2023 })
  @IsNumber()
  year: number;

  @ApiProperty({ example: 45 })
  @IsNumber()
  studentsPlaced: number;

  @ApiProperty({ example: '12.5 LPA' })
  @IsString()
  averagePackage: string;

  @ApiProperty({ example: '18.0 LPA' })
  @IsString()
  highestPackage: string;
}

export class EligibilityDto {
  @ApiProperty({ example: 7.5 })
  @IsNumber()
  minCGPA: number;

  @ApiProperty({ example: 0 })
  @IsNumber()
  maxBacklogs: number;

  @ApiProperty({ example: ['CSE', 'IT', 'ECE'] })
  @IsArray()
  @IsString({ each: true })
  branches: string[];
}

export class KiitPlacementDataDto {
  @ApiProperty({ example: 45 })
  @IsNumber()
  totalStudentsPlaced: number;

  @ApiProperty({ example: '12.5 LPA' })
  @IsString()
  averagePackage: string;

  @ApiProperty({ example: '18.0 LPA' })
  @IsString()
  highestPackage: string;

  @ApiPropertyOptional({ type: [YearwiseDataDto] })
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => YearwiseDataDto)
  yearwiseData?: YearwiseDataDto[];

  @ApiPropertyOptional({ example: ['CSE', 'IT', 'ECE'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  branches?: string[];

  @ApiPropertyOptional({ type: EligibilityDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => EligibilityDto)
  eligibility?: EligibilityDto;
}

export class SelectionProcessDto {
  @ApiProperty({ example: 4 })
  @IsNumber()
  rounds: number;

  @ApiProperty({ example: ['HackerRank', 'Teams'] })
  @IsArray()
  @IsString({ each: true })
  platforms: string[];

  @ApiProperty({ example: ['Online Assessment', 'Technical Interview'] })
  @IsArray()
  @IsString({ each: true })
  stages: string[];
}

export class RoleEligibilityDto {
  @ApiPropertyOptional({ example: 7.5 })
  @IsOptional()
  @IsNumber()
  minCGPA?: number;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsNumber()
  maxBacklogs?: number;

  @ApiPropertyOptional({ example: ['CSE', 'IT', 'ECE'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  branches?: string[];
}

export class RoleDto {
  @ApiProperty({ example: 'Software Engineer' })
  @IsString()
  title: string;

  @ApiProperty({ example: '10-15 LPA' })
  @IsString()
  ctcRange: string;

  @ApiPropertyOptional({ example: 'Bangalore' })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional({ example: '2024-03-15' })
  @IsOptional()
  deadline?: string;

  @ApiPropertyOptional({ example: 'Full-stack development role' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: ['B.Tech CSE', 'CGPA 7.5+'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  requirements?: string[];

  @ApiPropertyOptional({ example: 'Full-time' })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateNested()
  @Type(() => RoleEligibilityDto)
  eligibility?: RoleEligibilityDto;
}

export class StudyMaterialDto {
  @ApiProperty({ example: 'Coding Patterns Guide' })
  @IsString()
  title: string;

  @ApiProperty({ example: 'PDF' })
  @IsString()
  type: string;

  @ApiProperty({ example: '2.4 MB' })
  @IsString()
  size: string;

  @ApiProperty({ example: 'Comprehensive guide to coding patterns' })
  @IsString()
  description: string;

  @ApiProperty({ example: 'Technical' })
  @IsString()
  category: string;

  @ApiPropertyOptional({ example: 'https://example.com/file.pdf' })
  @IsOptional()
  @IsString()
  url?: string;
}

export class CreateCompanyDto {
  @ApiProperty({ example: 'Microsoft' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'Technology' })
  @IsString()
  domain: string;

  @ApiPropertyOptional({ example: 'Leading technology company' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 'https://microsoft.com' })
  @IsOptional()
  @IsUrl()
  website?: string;

  @ApiPropertyOptional({ example: 'careers@microsoft.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: '+1 (555) 123-4567' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: 'Redmond, WA' })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional({ example: '1975' })
  @IsOptional()
  @IsString()
  foundedYear?: string;

  @ApiPropertyOptional({ example: 100000 })
  @IsOptional()
  @IsNumber()
  employeeCount?: number;

  @ApiPropertyOptional({ example: 'https://logo.com/logo.png' })
  @IsOptional()
  @IsString()
  logo?: string;

  @ApiPropertyOptional({ example: ['Technology', 'MNC'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  @ApiPropertyOptional({ enum: CompanyStatus })
  @IsOptional()
  @IsEnum(CompanyStatus)
  status?: CompanyStatus;

  // Embedded data
  @ApiPropertyOptional({ type: KiitPlacementDataDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => KiitPlacementDataDto)
  kiitPlacementData?: KiitPlacementDataDto;

  @ApiPropertyOptional({ type: SelectionProcessDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => SelectionProcessDto)
  selectionProcess?: SelectionProcessDto;

  @ApiPropertyOptional({ type: [RoleDto] })
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => RoleDto)
  roles?: RoleDto[];

  @ApiPropertyOptional({ type: [StudyMaterialDto] })
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => StudyMaterialDto)
  studyMaterials?: StudyMaterialDto[];
} 